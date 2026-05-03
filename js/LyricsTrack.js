// js/LyricsTrack.js - Lyrics Track Timeline Feature
// Display lyrics synced to the timeline for vocal recording/visualization

let localAppServices = {};
let lyrics = []; // { id, text, startTime, endTime, trackId }
let currentLyricIndex = -1;
let isEnabled = true;
const LYRICS_PANEL_ID = 'lyricsTrackContent';
const LYRICS_LAYER_CLASS = 'lyrics-track-display';

/**
 * Initialize Lyrics Track module
 * @param {Object} appServices - Application services from main.js
 */
export function initLyricsTrack(appServices) {
    localAppServices = appServices || {};
    
    // Wait for timeline to be ready
    setTimeout(() => {
        setupLyricsDisplay();
    }, 500);
    
    console.log('[LyricsTrack] Initialized');
}

/**
 * Get all lyrics
 * @returns {Array}
 */
export function getLyrics() {
    return JSON.parse(JSON.stringify(lyrics));
}

/**
 * Get lyrics by track ID
 * @param {number} trackId
 * @returns {Array}
 */
export function getLyricsByTrack(trackId) {
    return lyrics.filter(l => l.trackId === trackId);
}

/**
 * Get current active lyric based on playback position
 * @returns {Object|null}
 */
export function getCurrentLyric() {
    if (!localAppServices.getCurrentPlaybackPosition) return null;
    const position = localAppServices.getCurrentPlaybackPosition();
    return lyrics.find(l => position >= l.startTime && position <= l.endTime) || null;
}

/**
 * Add a new lyric
 * @param {string} text - Lyric text
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {number} trackId - Track ID (optional, defaults to first MIDI track)
 * @returns {string|null} Lyric ID
 */
export function addLyric(text, startTime, endTime, trackId = null) {
    if (!text || typeof text !== 'string') {
        console.warn('[LyricsTrack] Invalid lyric text');
        return null;
    }
    
    const id = `lyric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Find default track if not specified
    if (trackId === null) {
        const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
        const midiTrack = tracks.find(t => t.type === 'midi' || t.type === 'instrument');
        trackId = midiTrack ? midiTrack.id : null;
    }
    
    lyrics.push({
        id,
        text: text.trim(),
        startTime: Math.max(0, parseFloat(startTime) || 0),
        endTime: Math.max(0.1, parseFloat(endTime) || startTime + 2),
        trackId,
        createdAt: new Date().toISOString()
    });
    
    // Sort by start time
    lyrics.sort((a, b) => a.startTime - b.startTime);
    
    console.log(`[LyricsTrack] Added lyric: "${text.substring(0, 30)}..." at ${startTime}s`);
    
    updateLyricsDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Add lyric');
    }
    
    return id;
}

/**
 * Update a lyric
 * @param {string} lyricId
 * @param {Object} updates - Fields to update
 * @returns {boolean}
 */
export function updateLyric(lyricId, updates) {
    const index = lyrics.findIndex(l => l.id === lyricId);
    if (index === -1) {
        console.warn(`[LyricsTrack] Lyric ${lyricId} not found`);
        return false;
    }
    
    if (updates.text !== undefined) lyrics[index].text = updates.text.trim();
    if (updates.startTime !== undefined) lyrics[index].startTime = Math.max(0, parseFloat(updates.startTime) || 0);
    if (updates.endTime !== undefined) lyrics[index].endTime = Math.max(0.1, parseFloat(updates.endTime) || 0.1);
    if (updates.trackId !== undefined) lyrics[index].trackId = updates.trackId;
    
    // Re-sort
    lyrics.sort((a, b) => a.startTime - b.startTime);
    
    updateLyricsDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Update lyric');
    }
    
    return true;
}

/**
 * Remove a lyric
 * @param {string} lyricId
 * @returns {boolean}
 */
export function removeLyric(lyricId) {
    const index = lyrics.findIndex(l => l.id === lyricId);
    if (index === -1) {
        console.warn(`[LyricsTrack] Lyric ${lyricId} not found`);
        return false;
    }
    
    lyrics.splice(index, 1);
    updateLyricsDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Remove lyric');
    }
    
    return true;
}

/**
 * Clear all lyrics
 */
export function clearAllLyrics() {
    const count = lyrics.length;
    lyrics = [];
    currentLyricIndex = -1;
    updateLyricsDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Clear all lyrics');
    }
    
    console.log(`[LyricsTrack] Cleared ${count} lyrics`);
}

/**
 * Import lyrics from text (one line per lyric, tab-separated time)
 * Format: "00:00.00\tLyric text" or just "Lyric text" (will auto-space)
 * @param {string} text - Multi-line lyrics text
 * @param {number} startTime - Starting time for first lyric
 * @param {number} durationPerLine - Duration for each lyric line
 */
export function importLyricsText(text, startTime = 0, durationPerLine = 3) {
    if (!text) return 0;
    
    const lines = text.split('\n').filter(l => l.trim());
    let currentTime = startTime;
    let count = 0;
    
    lines.forEach(line => {
        const lineText = line.replace(/^\d+[:\.]\d+\s*/, '').trim(); // Remove timestamp prefix if present
        if (lineText) {
            addLyric(lineText, currentTime, currentTime + durationPerLine);
            currentTime += durationPerLine;
            count++;
        }
    });
    
    console.log(`[LyricsTrack] Imported ${count} lyrics from text`);
    return count;
}

/**
 * Setup lyrics display on timeline
 */
function setupLyricsDisplay() {
    // Create lyrics layer if it doesn't exist
    const existingLayer = document.querySelector(`.${LYRICS_LAYER_CLASS}`);
    if (existingLayer) return;
    
    // Create lyrics track container
    const lyricsContainer = document.createElement('div');
    lyricsContainer.className = LYRICS_LAYER_CLASS;
    lyricsContainer.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 60px;
        background: linear-gradient(to top, rgba(138, 43, 226, 0.1), transparent);
        pointer-events: none;
        z-index: 5;
        display: none;
    `;
    
    // Find timeline content area
    const timelineContent = document.querySelector('.timeline-content') || 
                           document.getElementById('timelineContent') ||
                           document.querySelector('.timeline');
    
    if (timelineContent) {
        timelineContent.style.position = 'relative';
        timelineContent.appendChild(lyricsContainer);
    }
    
    console.log('[LyricsTrack] Lyrics display setup complete');
}

/**
 * Update lyrics display based on current playback position
 */
function updateLyricsDisplay() {
    const lyricsLayer = document.querySelector(`.${LYRICS_LAYER_CLASS}`);
    if (!lyricsLayer) return;
    
    // Get current playback position
    const position = localAppServices.getCurrentPlaybackPosition ? 
                    localAppServices.getCurrentPlaybackPosition() : 0;
    
    // Find current lyric
    const currentLyric = lyrics.find(l => position >= l.startTime && position <= l.endTime);
    
    if (!isEnabled || !currentLyric) {
        lyricsLayer.style.display = 'none';
        return;
    }
    
    lyricsLayer.style.display = 'block';
    
    const pixelsPerSecond = localAppServices.getPixelsPerSecond ? 
                           localAppServices.getPixelsPerSecond() : 100;
    
    // Calculate position
    const lyricLeft = currentLyric.startTime * pixelsPerSecond;
    const lyricWidth = (currentLyric.endTime - currentLyric.startTime) * pixelsPerSecond;
    
    lyricsLayer.innerHTML = `
        <div class="current-lyric-display" style="
            position: absolute;
            left: ${lyricLeft}px;
            top: 50%;
            transform: translateY(-50%);
            padding: 8px 16px;
            background: rgba(138, 43, 226, 0.9);
            color: white;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: ${lyricWidth}px;
            overflow: hidden;
            text-overflow: ellipsis;
        ">
            ${escapeHtml(currentLyric.text)}
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Enable/disable the feature
 * @param {boolean} enabled
 */
export function setLyricsTrackEnabled(enabled) {
    isEnabled = !!enabled;
    updateLyricsDisplay();
    console.log(`[LyricsTrack] ${isEnabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Check if feature is enabled
 * @returns {boolean}
 */
export function isLyricsTrackEnabled() {
    return isEnabled;
}

/**
 * Open the Lyrics Track panel
 */
export function openLyricsTrackPanel() {
    const windowId = 'lyricsTrack';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderLyricsPanel();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = LYRICS_PANEL_ID;
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-100 dark:bg-slate-800';
    
    const options = {
        width: 480,
        height: 600,
        minWidth: 400,
        minHeight: 500,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow ? 
                localAppServices.createWindow(windowId, 'Lyrics Track', contentContainer, options) : null;
    
    if (win?.element) {
        renderLyricsPanel();
        
        // Connect to playback position updates
        startLyricsSync();
    }
    
    return win;
}

/**
 * Render the lyrics panel content
 */
function renderLyricsPanel() {
    const container = document.getElementById(LYRICS_PANEL_ID);
    if (!container) return;
    
    const position = localAppServices.getCurrentPlaybackPosition ? 
                    localAppServices.getCurrentPlaybackPosition() : 0;
    
    let html = `
        <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="lyricsTrackEnabled" ${isEnabled ? 'checked' : ''} class="w-4 h-4 accent-purple-500">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Show on Timeline</span>
                </label>
            </div>
            <div class="flex gap-2">
                <button id="lyricsImportBtn" class="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Import</button>
                <button id="lyricsClearBtn" class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Clear All</button>
            </div>
        </div>
        
        <div class="mb-3 p-2 bg-slate-700 rounded text-xs text-slate-300">
            <strong>Current:</strong> <span id="lyricsCurrentPos">${formatTime(position)}</span> | 
            <span id="lyricsCurrentText">${getCurrentLyric()?.text || 'No lyric'}</span>
        </div>
        
        <div class="mb-3 flex gap-2">
            <button id="lyricsAddBtn" class="px-3 py-1.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600">+ Add Lyric</button>
            <button id="lyricsFromSelectionBtn" class="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">+ From Selection</button>
        </div>
        
        <div id="lyricsList" class="flex-1 overflow-y-auto space-y-2">
    `;
    
    if (lyrics.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No lyrics yet</p>
                <p class="text-xs mt-1">Add lyrics manually or import from text</p>
            </div>
        `;
    } else {
        lyrics.forEach((lyric, index) => {
            const isActive = position >= lyric.startTime && position <= lyric.endTime;
            html += `
                <div class="p-3 bg-white dark:bg-slate-700 rounded border ${isActive ? 'border-purple-500' : 'border-gray-200 dark:border-slate-600'} lyric-item" data-id="${lyric.id}">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-xs text-gray-500">#${index + 1}</span>
                        <div class="flex gap-1">
                            <button class="lyricEditBtn px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Edit</button>
                            <button class="lyricDeleteBtn px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600">×</button>
                        </div>
                    </div>
                    <div class="text-sm text-gray-700 dark:text-gray-300 lyric-text mb-1" style="word-break: break-word;">${escapeHtml(lyric.text)}</div>
                    <div class="text-xs text-gray-500">
                        <span class="lyric-time">${formatTime(lyric.startTime)}</span> → <span class="lyric-end">${formatTime(lyric.endTime)}</span>
                        <span class="text-gray-400 ml-2">(${formatDuration(lyric.endTime - lyric.startTime)})</span>
                    </div>
                </div>
            `;
        });
    }
    
    html += `</div>`;
    
    container.innerHTML = html;
    
    // Attach event listeners
    const enabledCheckbox = container.querySelector('#lyricsTrackEnabled');
    enabledCheckbox?.addEventListener('change', (e) => {
        setLyricsTrackEnabled(e.target.checked);
    });
    
    const importBtn = container.querySelector('#lyricsImportBtn');
    importBtn?.addEventListener('click', showImportDialog);
    
    const clearBtn = container.querySelector('#lyricsClearBtn');
    clearBtn?.addEventListener('click', () => {
        if (lyrics.length > 0 && confirm('Clear all lyrics?')) {
            clearAllLyrics();
            renderLyricsPanel();
        }
    });
    
    const addBtn = container.querySelector('#lyricsAddBtn');
    addBtn?.addEventListener('click', showAddLyricDialog);
    
    const fromSelBtn = container.querySelector('#lyricsFromSelectionBtn');
    fromSelBtn?.addEventListener('click', addLyricFromSelection);
    
    container.querySelectorAll('.lyricEditBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.lyric-item');
            const lyricId = item.dataset.id;
            openEditLyricDialog(lyricId);
        });
    });
    
    container.querySelectorAll('.lyricDeleteBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.lyric-item');
            const lyricId = item.dataset.id;
            removeLyric(lyricId);
            renderLyricsPanel();
        });
    });
}

/**
 * Format time as MM:SS.ms
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`;
}

/**
 * Format duration as seconds
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
    return `${seconds.toFixed(1)}s`;
}

/**
 * Show import dialog
 */
function showImportDialog() {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 16px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        width: 400px;
    `;
    
    dialog.innerHTML = `
        <div class="text-white text-sm font-medium mb-3">Import Lyrics</div>
        <div class="mb-3">
            <label class="text-gray-400 text-xs">Start Time (seconds)</label>
            <input type="number" id="lyricImportStart" value="0" step="0.1" min="0"
                class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1">
        </div>
        <div class="mb-3">
            <label class="text-gray-400 text-xs">Duration per line (seconds)</label>
            <input type="number" id="lyricImportDuration" value="3" step="0.5" min="0.5"
                class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1">
        </div>
        <div class="mb-3">
            <label class="text-gray-400 text-xs">Lyrics Text (one line per lyric)</label>
            <textarea id="lyricImportText" rows="8" placeholder="Enter lyrics here, one per line..."
                class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1 resize-none"></textarea>
        </div>
        <div class="flex justify-end gap-2">
            <button id="lyricImportCancel" class="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Cancel</button>
            <button id="lyricImportConfirm" class="px-3 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600">Import</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('#lyricImportCancel').addEventListener('click', () => dialog.remove());
    dialog.querySelector('#lyricImportConfirm').addEventListener('click', () => {
        const startTime = parseFloat(dialog.querySelector('#lyricImportStart').value) || 0;
        const duration = parseFloat(dialog.querySelector('#lyricImportDuration').value) || 3;
        const text = dialog.querySelector('#lyricImportText').value;
        
        if (text.trim()) {
            importLyricsText(text, startTime, duration);
            dialog.remove();
            renderLyricsPanel();
        }
    });
    
    // Escape to close
    document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
            dialog.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    });
}

/**
 * Show add lyric dialog
 */
function showAddLyricDialog() {
    const position = localAppServices.getCurrentPlaybackPosition ? 
                    localAppServices.getCurrentPlaybackPosition() : 0;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 16px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        width: 360px;
    `;
    
    dialog.innerHTML = `
        <div class="text-white text-sm font-medium mb-3">Add Lyric</div>
        <div class="mb-3">
            <label class="text-gray-400 text-xs">Lyric Text</label>
            <input type="text" id="lyricAddText" placeholder="Enter lyric text..."
                class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1">
        </div>
        <div class="mb-3 flex gap-2">
            <div class="flex-1">
                <label class="text-gray-400 text-xs">Start Time</label>
                <input type="number" id="lyricAddStart" value="${position.toFixed(1)}" step="0.1" min="0"
                    class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1">
            </div>
            <div class="flex-1">
                <label class="text-gray-400 text-xs">Duration</label>
                <input type="number" id="lyricAddDuration" value="3" step="0.5" min="0.5"
                    class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1">
            </div>
        </div>
        <div class="flex justify-end gap-2">
            <button id="lyricAddCancel" class="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Cancel</button>
            <button id="lyricAddConfirm" class="px-3 py-1.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600">Add</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('#lyricAddCancel').addEventListener('click', () => dialog.remove());
    dialog.querySelector('#lyricAddConfirm').addEventListener('click', () => {
        const text = dialog.querySelector('#lyricAddText').value.trim();
        const startTime = parseFloat(dialog.querySelector('#lyricAddStart').value) || 0;
        const duration = parseFloat(dialog.querySelector('#lyricAddDuration').value) || 3;
        
        if (text) {
            addLyric(text, startTime, startTime + duration);
            dialog.remove();
            renderLyricsPanel();
        }
    });
    
    // Enter to submit
    dialog.querySelector('#lyricAddText').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            dialog.querySelector('#lyricAddConfirm').click();
        } else if (e.key === 'Escape') {
            dialog.remove();
        }
    });
    
    setTimeout(() => dialog.querySelector('#lyricAddText').focus(), 50);
}

/**
 * Add lyric from current selection
 */
function addLyricFromSelection() {
    const position = localAppServices.getCurrentPlaybackPosition ? 
                    localAppServices.getCurrentPlaybackPosition() : 0;
    showAddLyricDialog();
    // Pre-fill start time with current position
    const startInput = document.querySelector('#lyricAddStart');
    if (startInput) startInput.value = position.toFixed(1);
}

/**
 * Open edit lyric dialog
 * @param {string} lyricId
 */
function openEditLyricDialog(lyricId) {
    const lyric = lyrics.find(l => l.id === lyricId);
    if (!lyric) return;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 16px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        width: 360px;
    `;
    
    dialog.innerHTML = `
        <div class="text-white text-sm font-medium mb-3">Edit Lyric</div>
        <div class="mb-3">
            <label class="text-gray-400 text-xs">Lyric Text</label>
            <input type="text" id="lyricEditText" value="${escapeHtml(lyric.text)}"
                class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1">
        </div>
        <div class="mb-3 flex gap-2">
            <div class="flex-1">
                <label class="text-gray-400 text-xs">Start Time</label>
                <input type="number" id="lyricEditStart" value="${lyric.startTime.toFixed(1)}" step="0.1" min="0"
                    class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1">
            </div>
            <div class="flex-1">
                <label class="text-gray-400 text-xs">End Time</label>
                <input type="number" id="lyricEditEnd" value="${lyric.endTime.toFixed(1)}" step="0.1" min="0"
                    class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1">
            </div>
        </div>
        <div class="flex justify-between">
            <button id="lyricEditDelete" class="px-3 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
            <div class="flex gap-2">
                <button id="lyricEditCancel" class="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Cancel</button>
                <button id="lyricEditSave" class="px-3 py-1.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('#lyricEditCancel').addEventListener('click', () => dialog.remove());
    dialog.querySelector('#lyricEditDelete').addEventListener('click', () => {
        removeLyric(lyricId);
        dialog.remove();
        renderLyricsPanel();
    });
    dialog.querySelector('#lyricEditSave').addEventListener('click', () => {
        const text = dialog.querySelector('#lyricEditText').value.trim();
        const startTime = parseFloat(dialog.querySelector('#lyricEditStart').value) || 0;
        const endTime = parseFloat(dialog.querySelector('#lyricEditEnd').value) || startTime + 1;
        
        if (text) {
            updateLyric(lyricId, { text, startTime, endTime });
            dialog.remove();
            renderLyricsPanel();
        }
    });
    
    // Escape to close
    document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
            dialog.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    });
}

// Sync loop
let lyricsSyncInterval = null;

/**
 * Start lyrics sync with playback
 */
function startLyricsSync() {
    if (lyricsSyncInterval) return;
    
    const syncLoop = () => {
        updateLyricsDisplay();
        // Update current position in panel if open
        const posEl = document.getElementById('lyricsCurrentPos');
        const textEl = document.getElementById('lyricsCurrentText');
        if (posEl || textEl) {
            const position = localAppServices.getCurrentPlaybackPosition ? 
                            localAppServices.getCurrentPlaybackPosition() : 0;
            const current = getCurrentLyric();
            if (posEl) posEl.textContent = formatTime(position);
            if (textEl) textEl.textContent = current?.text || 'No lyric';
        }
    };
    
    lyricsSyncInterval = setInterval(syncLoop, 100);
    console.log('[LyricsTrack] Sync loop started');
}

/**
 * Stop lyrics sync
 */
function stopLyricsSync() {
    if (lyricsSyncInterval) {
        clearInterval(lyricsSyncInterval);
        lyricsSyncInterval = null;
        console.log('[LyricsTrack] Sync loop stopped');
    }
}