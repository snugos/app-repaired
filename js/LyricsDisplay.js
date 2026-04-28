// js/LyricsDisplay.js - Lyrics Display / Karaoke Mode
// Display lyrics synced to playback with word-by-word highlighting

let localAppServices = {};
let isPanelOpen = false;
let lyricsPanelElement = null;
let lyricsData = [];
let currentWordIndex = -1;
let lyricsUpdateInterval = null;
let isKaraokeMode = true;
let lyricsPanel = null;

/**
 * Initialize the Lyrics Display module
 * @param {Object} services - App services from main.js
 */
export function initLyricsDisplay(services) {
    localAppServices = services || {};
    console.log('[LyricsDisplay] Module initialized');
}

/**
 * Get lyrics-related state from app
 */
function getLyricsState() {
    const state = localAppServices.stateModule || {};
    return {
        getTransportPosition: state.getTransportPosition || (() => 0),
        getIsPlaying: state.getIsPlaying || (() => false),
        getBPM: state.getBPM || (() => 120),
        lyricsText: state.lyricsText || '',
        lyricsWordTiming: state.lyricsWordTiming || [],
        setLyricsText: state.setLyricsText || ((t) => {}),
        setLyricsWordTiming: state.setLyricsWordTiming || ((a) => {})
    };
}

/**
 * Open the Lyrics Display panel
 */
export function openLyricsDisplayPanel() {
    if (isPanelOpen && lyricsPanel?.element) {
        lyricsPanel.restore();
        return lyricsPanel;
    }

    const windowId = 'lyricsDisplay';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'lyricsDisplayContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white';

    const options = {
        width: 500,
        height: 400,
        minWidth: 350,
        minHeight: 300,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Lyrics Display', contentContainer, options);
    if (win?.element) {
        isPanelOpen = true;
        lyricsPanel = win;
        renderPanelContent();
    }
    return win;
}

/**
 * Render the lyrics panel content
 */
function renderPanelContent() {
    const container = document.getElementById('lyricsDisplayContent');
    if (!container) return;

    const lyricsState = getLyricsState();

    container.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-300">Karaoke Mode</h3>
            <div class="flex items-center gap-2">
                <label class="flex items-center gap-1 cursor-pointer text-xs">
                    <input type="checkbox" id="karaokeModeToggle" ${isKaraokeMode ? 'checked' : ''} class="w-3 h-3 accent-purple-500">
                    <span>Karaoke</span>
                </label>
                <button id="lyricsImportBtn" class="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded">Import</button>
                <button id="lyricsClearBtn" class="px-2 py-1 bg-slate-600 hover:bg-slate-700 text-white text-xs rounded">Clear</button>
            </div>
        </div>

        <div class="flex-1 relative">
            <div id="lyricsTextArea" class="w-full h-full p-4 bg-slate-800 border border-slate-600 rounded text-sm font-medium leading-relaxed overflow-y-auto resize-none" placeholder="Paste or type lyrics here...">${escapeHtml(lyricsState.lyricsText)}</div>
            <div id="lyricsHighlightOverlay" class="absolute inset-0 p-4 text-sm font-medium leading-relaxed overflow-y-auto pointer-events-none whitespace-pre-wrap"></div>
        </div>

        <div class="mt-3 flex items-center gap-3">
            <div class="text-xs text-slate-400">
                Position: <span id="lyricsCurrentPos" class="text-white">0:00</span>
            </div>
            <div class="text-xs text-slate-400">
                Word: <span id="lyricsCurrentWord" class="text-purple-400">-</span> / <span id="lyricsTotalWords" class="text-slate-500">0</span>
            </div>
            <div class="flex-1"></div>
            <button id="lyricsPlayFromStartBtn" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">Play from Start</button>
        </div>

        <div class="mt-2 text-xs text-slate-500 text-center">
            Lyrics are highlighted word-by-word as playback progresses
        </div>
    `;

    setupPanelEvents(container, lyricsState);
    startLyricsSync(lyricsState);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

/**
 * Setup panel event listeners
 */
function setupPanelEvents(container, lyricsState) {
    const textArea = container.querySelector('#lyricsTextArea');
    const karaokeToggle = container.querySelector('#karaokeModeToggle');
    const importBtn = container.querySelector('#lyricsImportBtn');
    const clearBtn = container.querySelector('#lyricsClearBtn');
    const playFromStartBtn = container.querySelector('#lyricsPlayFromStartBtn');

    // Text change handler with debounce
    let textDebounceTimer = null;
    textArea?.addEventListener('input', () => {
        clearTimeout(textDebounceTimer);
        textDebounceTimer = setTimeout(() => {
            lyricsState.setLyricsText(textArea.value);
            if (isKaraokeMode) {
                updateKaraokeOverlay(textArea.value, lyricsState);
            }
        }, 500);
    });

    // Karaoke mode toggle
    karaokeToggle?.addEventListener('change', () => {
        isKaraokeMode = karaokeToggle.checked;
        if (isKaraokeMode) {
            updateKaraokeOverlay(textArea?.value || '', lyricsState);
        }
    });

    // Import button - simple prompt for lyrics
    importBtn?.addEventListener('click', () => {
        const inputText = prompt('Paste your lyrics (one line per paragraph):');
        if (inputText !== null) {
            textArea.value = inputText;
            lyricsState.setLyricsText(inputText);
            if (isKaraokeMode) {
                updateKaraokeOverlay(inputText, lyricsState);
            }
        }
    });

    // Clear button
    clearBtn?.addEventListener('click', () => {
        if (confirm('Clear all lyrics?')) {
            textArea.value = '';
            lyricsState.setLyricsText('');
            lyricsState.setLyricsWordTiming([]);
            currentWordIndex = -1;
            updateHighlightDisplay(-1, '');
        }
    });

    // Play from start
    playFromStartBtn?.addEventListener('click', () => {
        // Stop current playback and restart from beginning
        localAppServices.stopPlayback?.();
        setTimeout(() => {
            localAppServices.startPlayback?.();
        }, 100);
    });

    // Initial karaoke overlay update
    if (isKaraokeMode && textArea?.value) {
        updateKaraokeOverlay(textArea.value, lyricsState);
    }
}

/**
 * Update karaoke overlay with word highlighting
 */
function updateKaraokeOverlay(text, lyricsState) {
    const overlay = document.getElementById('lyricsHighlightOverlay');
    if (!overlay) return;

    const words = text.split(/\s+/).filter(w => w.length > 0);
    let html = '';
    words.forEach((word, idx) => {
        const isHighlighted = idx < currentWordIndex;
        const isCurrent = idx === currentWordIndex;
        const classes = isHighlighted ? 'text-green-400' : (isCurrent ? 'text-yellow-300 bg-yellow-900/30 rounded px-0.5' : 'text-slate-500');
        html += `<span class="${classes}">${escapeHtml(word)}</span> `;
    });
    overlay.innerHTML = html;

    // Sync scroll with text area
    const textArea = document.getElementById('lyricsTextArea');
    if (textArea) {
        overlay.scrollTop = textArea.scrollTop;
        overlay.scrollLeft = textArea.scrollLeft;
    }
}

/**
 * Start lyrics synchronization with playback
 */
function startLyricsSync(lyricsState) {
    // Stop any existing interval
    stopLyricsSync();

    // Update sync every 50ms
    lyricsUpdateInterval = setInterval(() => {
        const pos = lyricsState.getTransportPosition();
        const isPlaying = lyricsState.getIsPlaying();

        if (!isPlaying) {
            // Update position display
            const posEl = document.getElementById('lyricsCurrentPos');
            if (posEl) posEl.textContent = formatTime(pos);
            return;
        }

        // Update position display
        const posEl = document.getElementById('lyricsCurrentPos');
        if (posEl) posEl.textContent = formatTime(pos);

        // Update word index based on position
        const wordTiming = lyricsState.lyricsWordTiming || [];
        const text = lyricsState.lyricsText || '';
        const words = text.split(/\s+/).filter(w => w.length > 0);

        // Calculate which word should be highlighted based on position
        // Simple approach: evenly distribute words over a duration (e.g., 3 minutes)
        // Or use word timing if available
        let newWordIndex = -1;
        if (wordTiming.length > 0) {
            // Use timing data
            for (let i = 0; i < wordTiming.length; i++) {
                if (pos >= wordTiming[i]) {
                    newWordIndex = i;
                }
            }
        } else {
            // Estimate: assume average of 2 words per second
            const avgWordsPerSecond = 2;
            const estimatedWords = Math.floor(pos * avgWordsPerSecond);
            newWordIndex = Math.min(estimatedWords, words.length - 1);
        }

        if (newWordIndex !== currentWordIndex) {
            currentWordIndex = newWordIndex;
            updateHighlightDisplay(currentWordIndex, words[currentWordIndex] || '');
            if (isKaraokeMode) {
                updateKaraokeOverlay(text, lyricsState);
            }
        }
    }, 50);
}

/**
 * Stop lyrics synchronization
 */
function stopLyricsSync() {
    if (lyricsUpdateInterval) {
        clearInterval(lyricsUpdateInterval);
        lyricsUpdateInterval = null;
    }
}

/**
 * Update highlight display with current word info
 */
function updateHighlightDisplay(wordIdx, currentWord) {
    const wordEl = document.getElementById('lyricsCurrentWord');
    const totalEl = document.getElementById('lyricsTotalWords');
    const lyricsState = getLyricsState();
    const words = (lyricsState.lyricsText || '').split(/\s+/).filter(w => w.length > 0);

    if (wordEl) {
        wordEl.textContent = wordIdx >= 0 ? currentWord : '-';
    }
    if (totalEl) {
        totalEl.textContent = words.length;
    }
}

/**
 * Format time as M:SS
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Close and cleanup panel
 */
export function closeLyricsDisplayPanel() {
    stopLyricsSync();
    isPanelOpen = false;
    lyricsPanel = null;
}

// Window exposure
window.openLyricsDisplayPanel = openLyricsDisplayPanel;
window.openLyricsPanel = openLyricsDisplayPanel;
window.closeLyricsDisplayPanel = closeLyricsDisplayPanel;
window.setLyricsText = (text) => {
    const state = localAppServices.stateModule || {};
    if (state.setLyricsText) state.setLyricsText(text);
};
window.getLyricsText = () => {
    const state = localAppServices.stateModule || {};
    return state.lyricsText || '';
};