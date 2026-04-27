// js/LyricsDisplay.js - Lyrics Display / Karaoke Mode
// Displays lyrics synced to playback with word-by-word highlighting

let localAppServices = {};
let lyricsData = []; // Array of { time: seconds, text: "lyric text", duration: optional }
let currentLyricIndex = -1;
let isPanelOpen = false;
let animationFrameId = null;
let lyricsPanelElement = null;

// Initialize the module
export function initLyricsDisplay(appServices) {
    localAppServices = appServices || {};
    console.log('[LyricsDisplay] Module initialized');
}

// Set lyrics data
export function setLyrics(data) {
    if (!Array.isArray(data)) {
        console.warn('[LyricsDisplay] Invalid lyrics data format');
        return false;
    }
    lyricsData = data.sort((a, b) => a.time - b.time);
    currentLyricIndex = -1;
    console.log(`[LyricsDisplay] Loaded ${lyricsData.length} lyric entries`);
    return true;
}

// Get current lyrics data
export function getLyricsData() {
    return [...lyricsData];
}

// Clear all lyrics
export function clearLyrics() {
    lyricsData = [];
    currentLyricIndex = -1;
    console.log('[LyricsDisplay] Cleared all lyrics');
}

// Add a single lyric entry
export function addLyricEntry(time, text, duration = 2) {
    lyricsData.push({ time: parseFloat(time), text: text.trim(), duration: parseFloat(duration) });
    lyricsData.sort((a, b) => a.time - b.time);
}

// Parse LRC format lyrics
export function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const parsed = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    
    for (const line of lines) {
        let match;
        while ((match = timeRegex.exec(line)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const ms = parseInt(match[3].padEnd(3, '0'), 10);
            const time = minutes * 60 + seconds + ms / 1000;
            const text = line.replace(timeRegex, '').trim();
            if (text) {
                parsed.push({ time, text, duration: 2 });
            }
        }
    }
    
    // Calculate durations from time differences
    for (let i = 0; i < parsed.length - 1; i++) {
        parsed[i].duration = parsed[i + 1].time - parsed[i].time;
    }
    
    return parsed;
}

// Open the lyrics panel
export function openLyricsPanel() {
    if (isPanelOpen) {
        const existing = document.getElementById('lyricsPanelContent');
        if (existing) {
            renderLyricsPanel();
            return;
        }
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'lyricsPanelContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-50 dark:bg-slate-800 overflow-y-auto';
    
    const options = {
        width: 500,
        height: 350,
        minWidth: 350,
        minHeight: 250,
        initialContentKey: 'lyricsPanel',
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow('lyricsPanel', 'Lyrics / Karaoke', contentContainer, options);
    if (win?.element) {
        isPanelOpen = true;
        lyricsPanelElement = contentContainer;
        renderLyricsPanel();
    }
    return win;
}

// Render the lyrics panel content
function renderLyricsPanel() {
    if (!lyricsPanelElement) {
        lyricsPanelElement = document.getElementById('lyricsPanelContent');
        if (!lyricsPanelElement) return;
    }
    
    const currentPlaybackTime = getCurrentPlaybackTime();
    updateCurrentLyricIndex(currentPlaybackTime);
    
    let html = `
        <div class="mb-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
                <button id="lyricsPrevBtn" class="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500" title="Previous">⏮</button>
                <button id="lyricsNextBtn" class="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500" title="Next">⏭</button>
                <span id="lyricsCounter" class="text-xs text-gray-500">${currentLyricIndex + 1} / ${lyricsData.length || 0}</span>
            </div>
            <div class="flex items-center gap-2">
                <button id="lyricsAddBtn" class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Add Line</button>
                <button id="lyricsImportBtn" class="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Import LRC</button>
                <button id="lyricsClearBtn" class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Clear</button>
            </div>
        </div>
        
        <div id="lyricsDisplayArea" class="flex-1 flex flex-col items-center justify-center min-h-[120px]">
    `;
    
    if (lyricsData.length === 0) {
        html += `
            <div class="text-center text-gray-400">
                <p class="text-lg mb-2">No lyrics loaded</p>
                <p class="text-sm">Add lines or import an LRC file</p>
            </div>
        `;
    } else {
        // Show current lyric with highlight
        const current = lyricsData[currentLyricIndex];
        const prev = lyricsData[currentLyricIndex - 1];
        const next = lyricsData[currentLyricIndex + 1];
        
        html += `
            <div class="text-center w-full">
                ${prev ? `<div class="text-sm text-gray-400 mb-2 opacity-60">${escapeHtml(prev.text)}</div>` : '<div class="h-5 mb-2"></div>'}
                <div id="currentLyricText" class="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2 transition-all duration-200">${current ? escapeHtml(current.text) : ''}</div>
                ${next ? `<div class="text-sm text-gray-400 mt-2 opacity-60">${escapeHtml(next.text)}</div>` : '<div class="h-5 mt-2"></div>'}
            </div>
        `;
    }
    
    html += `</div>`;
    
    // Timeline bar
    html += `
        <div class="mt-3">
            <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>${currentLyricIndex >= 0 && lyricsData[currentLyricIndex] ? formatTime(lyricsData[currentLyricIndex].time) : '--:--'}</span>
                <span>${lyricsData.length > 0 ? formatTime(lyricsData[lyricsData.length - 1].time) : '--:--'}</span>
            </div>
            <div class="h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden cursor-pointer" id="lyricsTimeline">
                <div id="lyricsProgress" class="h-full bg-blue-500 transition-all duration-100" style="width: ${getProgressPercent()}%"></div>
            </div>
        </div>
    `;
    
    // Lyrics list
    html += `<div class="mt-3 max-h-32 overflow-y-auto">`;
    lyricsData.forEach((lyric, idx) => {
        const isActive = idx === currentLyricIndex;
        const isPast = idx < currentLyricIndex;
        html += `
            <div class="lyric-item px-2 py-1 text-sm cursor-pointer rounded ${isActive ? 'bg-blue-100 dark:bg-blue-900 font-bold' : isPast ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}" 
                 data-index="${idx}" data-time="${lyric.time}">
                <span class="text-xs text-gray-400 mr-2">${formatTime(lyric.time)}</span>
                <span>${escapeHtml(lyric.text)}</span>
            </div>
        `;
    });
    html += `</div>`;
    
    lyricsPanelElement.innerHTML = html;
    attachLyricsEventListeners();
}

// Get current playback time from transport
function getCurrentPlaybackTime() {
    try {
        if (localAppServices.getPlaybackPosition) {
            return localAppServices.getPlaybackPosition();
        }
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            return Tone.Transport.seconds;
        }
    } catch (e) {
        // Ignore
    }
    return 0;
}

// Update current lyric index based on playback time
function updateCurrentLyricIndex(time) {
    let newIndex = -1;
    for (let i = lyricsData.length - 1; i >= 0; i--) {
        if (time >= lyricsData[i].time) {
            newIndex = i;
            break;
        }
    }
    
    if (newIndex !== currentLyricIndex) {
        currentLyricIndex = newIndex;
        if (isPanelOpen) {
            const counter = document.getElementById('lyricsCounter');
            const currentText = document.getElementById('currentLyricText');
            const progress = document.getElementById('lyricsProgress');
            
            if (counter) counter.textContent = `${currentLyricIndex + 1} / ${lyricsData.length || 0}`;
            
            if (currentText && lyricsData[currentLyricIndex]) {
                currentText.textContent = lyricsData[currentLyricIndex].text;
            }
            
            if (progress) progress.style.width = `${getProgressPercent()}%`;
        }
    }
}

// Get progress as percentage
function getProgressPercent() {
    if (lyricsData.length === 0) return 0;
    const lastTime = lyricsData[lyricsData.length - 1].time;
    if (lastTime === 0) return 0;
    const current = getCurrentPlaybackTime();
    return Math.min(100, (current / lastTime) * 100);
}

// Format time as MM:SS
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Attach event listeners
function attachLyricsEventListeners() {
    const prevBtn = document.getElementById('lyricsPrevBtn');
    const nextBtn = document.getElementById('lyricsNextBtn');
    const addBtn = document.getElementById('lyricsAddBtn');
    const importBtn = document.getElementById('lyricsImportBtn');
    const clearBtn = document.getElementById('lyricsClearBtn');
    const timeline = document.getElementById('lyricsTimeline');
    
    prevBtn?.addEventListener('click', () => {
        if (currentLyricIndex > 0) {
            jumpToLyric(currentLyricIndex - 1);
        }
    });
    
    nextBtn?.addEventListener('click', () => {
        if (currentLyricIndex < lyricsData.length - 1) {
            jumpToLyric(currentLyricIndex + 1);
        }
    });
    
    addBtn?.addEventListener('click', () => {
        const time = getCurrentPlaybackTime();
        const text = prompt('Enter lyric text:', '');
        if (text && text.trim()) {
            addLyricEntry(time, text);
            renderLyricsPanel();
        }
    });
    
    importBtn?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.lrc,.txt';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const text = evt.target.result;
                    const parsed = parseLRC(text);
                    if (parsed.length > 0) {
                        setLyrics(parsed);
                        renderLyricsPanel();
                        localAppServices.showNotification?.(`Imported ${parsed.length} lyrics`, 2000);
                    } else {
                        localAppServices.showNotification?.('No valid LRC format found', 2000);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    });
    
    clearBtn?.addEventListener('click', () => {
        if (confirm('Clear all lyrics?')) {
            clearLyrics();
            renderLyricsPanel();
        }
    });
    
    timeline?.addEventListener('click', (e) => {
        const rect = timeline.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const targetTime = lyricsData[lyricsData.length - 1].time * percent;
        jumpToTime(targetTime);
    });
    
    // Click on lyric items to jump
    document.querySelectorAll('.lyric-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index, 10);
            const time = parseFloat(item.dataset.time);
            jumpToLyric(idx);
        });
    });
}

// Jump to a specific lyric index
function jumpToLyric(index) {
    if (index >= 0 && index < lyricsData.length) {
        jumpToTime(lyricsData[index].time);
        currentLyricIndex = index;
        renderLyricsPanel();
    }
}

// Jump to a specific time
function jumpToTime(time) {
    try {
        if (localAppServices.setPlaybackPosition) {
            localAppServices.setPlaybackPosition(time);
        } else if (typeof Tone !== 'undefined' && Tone.Transport) {
            Tone.Transport.seconds = time;
        }
    } catch (e) {
        console.warn('[LyricsDisplay] Could not jump to time:', e);
    }
}

// Start lyrics sync (called when playing)
export function startLyricsSync() {
    if (animationFrameId) return;
    
    function update() {
        if (lyricsData.length > 0) {
            updateCurrentLyricIndex(getCurrentPlaybackTime());
        }
        animationFrameId = requestAnimationFrame(update);
    }
    
    animationFrameId = requestAnimationFrame(update);
}

// Stop lyrics sync
export function stopLyricsSync() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Check if panel is open
export function isLyricsPanelOpen() {
    return isPanelOpen;
}

// Window exposure
window.openLyricsPanel = openLyricsPanel;
window.setLyrics = setLyrics;
window.getLyricsData = getLyricsData;
window.clearLyrics = clearLyrics;
window.addLyricEntry = addLyricEntry;
window.parseLRC = parseLRC;
window.openLyricsPanel = openLyricsPanel;
window.startLyricsSync = startLyricsSync;
window.stopLyricsSync = stopLyricsSync;
