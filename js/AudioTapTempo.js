// js/AudioTapTempo.js - Tap Tempo feature using audio input timing detection
// Allows setting project tempo by tapping audio beats or a button

let localAppServices = {};
let tapTimes = [];
let lastTapTime = 0;
let tapTimeout = null;
const MAX_TAP_INTERVAL = 3000; // ms - reset if no tap within this time
const MIN_TAPS = 3; // minimum taps needed to calculate BPM

/**
 * Initialize the Audio Tap Tempo module
 * @param {Object} services - App services including get/set BPM functions
 */
export function initAudioTapTempo(services) {
    localAppServices = services;
    console.log('[AudioTapTempo] Initialized');
}

/**
 * Record a tap and calculate BPM
 * @returns {number|null} Calculated BPM or null if not enough taps
 */
export function recordTap() {
    const now = performance.now();
    
    // Reset if too much time has passed since last tap
    if (now - lastTapTime > MAX_TAP_INTERVAL) {
        tapTimes = [];
    }
    
    lastTapTime = now;
    tapTimes.push(now);
    
    // Keep only recent taps (last 16)
    if (tapTimes.length > 16) {
        tapTimes = tapTimes.slice(-16);
    }
    
    // Need minimum taps for reliable calculation
    if (tapTimes.length < MIN_TAPS) {
        return null;
    }
    
    // Calculate average interval between consecutive taps
    let totalInterval = 0;
    for (let i = 1; i < tapTimes.length; i++) {
        totalInterval += tapTimes[i] - tapTimes[i - 1];
    }
    const avgInterval = totalInterval / (tapTimes.length - 1);
    
    // Convert interval (ms) to BPM
    const bpm = Math.round(60000 / avgInterval);
    
    // Clamp to reasonable BPM range
    const clampedBpm = Math.max(20, Math.min(300, bpm));
    
    return clampedBpm;
}

/**
 * Set the BPM via tap tempo
 * @returns {number} The BPM that was set
 */
export function setTempoFromTap() {
    const bpm = recordTap();
    if (bpm !== null && localAppServices.setBPM) {
        localAppServices.setBPM(bpm);
        return bpm;
    }
    return 0;
}

/**
 * Get current tap count and status
 * @returns {Object} Status info
 */
export function getTapStatus() {
    return {
        tapCount: tapTimes.length,
        lastTapAgo: lastTapTime ? Math.round((performance.now() - lastTapTime)) : null,
        ready: tapTimes.length >= MIN_TAPS
    };
}

/**
 * Reset tap history
 */
export function resetTapHistory() {
    tapTimes = [];
    lastTapTime = 0;
}

/**
 * Open the Audio Tap Tempo panel
 */
export function openAudioTapTempoPanel() {
    const windowId = 'audioTapTempo';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'audioTapTempoContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900 select-none';
    
    const options = {
        width: 350,
        height: 280,
        minWidth: 280,
        minHeight: 220,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Audio Tap Tempo', contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderTapTempoContent(), 50);
    }
    
    return win;
}

/**
 * Render the tap tempo panel content
 */
function renderTapTempoContent() {
    const container = document.getElementById('audioTapTempoContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="text-center mb-4">
            <div class="text-5xl font-bold text-green-400 mb-2" id="tapTempoDisplay">--</div>
            <div class="text-sm text-gray-400 mb-1">BPM</div>
            <div class="text-xs text-gray-500" id="tapCountDisplay">Tap ${MIN_TAPS}+ times to set tempo</div>
        </div>
        
        <div class="flex justify-center mb-4">
            <button id="tapButton" class="w-32 h-32 rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xl font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95">
                TAP
            </button>
        </div>
        
        <div class="flex items-center justify-between text-xs text-gray-500">
            <button id="tapResetBtn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white">
                Reset
            </button>
            <div class="flex items-center gap-4">
                <span id="tapIntervalDisplay"></span>
            </div>
            <button id="tapApplyBtn" class="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-white" disabled>
                Apply BPM
            </button>
        </div>
        
        <div class="mt-3 pt-3 border-t border-gray-700">
            <div class="text-xs text-gray-400 text-center">
                Tip: Tap in rhythm to detect the tempo. Works with audio beats too.
            </div>
        </div>
    `;
    
    setupTapTempoHandlers();
}

/**
 * Setup event handlers for tap tempo panel
 */
function setupTapTempoHandlers() {
    const tapButton = document.getElementById('tapButton');
    const tapResetBtn = document.getElementById('tapResetBtn');
    const tapApplyBtn = document.getElementById('tapApplyBtn');
    
    if (tapButton) {
        tapButton.addEventListener('click', handleTap);
        tapButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleTap();
        });
    }
    
    if (tapResetBtn) {
        tapResetBtn.addEventListener('click', () => {
            resetTapHistory();
            updateTapTempoDisplay();
        });
    }
    
    if (tapApplyBtn) {
        tapApplyBtn.addEventListener('click', () => {
            const bpm = recordTap();
            if (bpm !== null && localAppServices.setBPM) {
                localAppServices.setBPM(bpm);
                showNotification(`Tempo set to ${bpm} BPM`, 'info');
            }
        });
    }
    
    // Keyboard shortcut: spacebar to tap
    document.addEventListener('keydown', handleTapKeydown);
}

/**
 * Handle tap button press
 */
function handleTap() {
    const bpm = setTempoFromTap();
    updateTapTempoDisplay();
    
    if (bpm !== null) {
        const applyBtn = document.getElementById('tapApplyBtn');
        if (applyBtn) applyBtn.disabled = false;
    }
}

/**
 * Handle spacebar for tap
 */
function handleTapKeydown(e) {
    if (e.code === 'Space' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        handleTap();
    }
}

/**
 * Update the tap tempo display
 */
function updateTapTempoDisplay() {
    const status = getTapStatus();
    const display = document.getElementById('tapTempoDisplay');
    const countDisplay = document.getElementById('tapCountDisplay');
    const intervalDisplay = document.getElementById('tapIntervalDisplay');
    const applyBtn = document.getElementById('tapApplyBtn');
    
    if (display) {
        if (status.ready) {
            const bpm = setTempoFromTap() || recordTap();
            display.textContent = bpm || '--';
            display.className = 'text-5xl font-bold text-green-400 mb-2';
        } else {
            display.textContent = '--';
            display.className = 'text-5xl font-bold text-gray-500 mb-2';
        }
    }
    
    if (countDisplay) {
        const needed = MIN_TAPS - status.tapCount;
        if (status.tapCount === 0) {
            countDisplay.textContent = `Tap ${MIN_TAPS}+ times to set tempo`;
        } else if (needed > 0) {
            countDisplay.textContent = `Need ${needed} more tap${needed > 1 ? 's' : ''}`;
        } else {
            countDisplay.textContent = `${status.tapCount} taps recorded`;
        }
    }
    
    if (intervalDisplay && lastTapTime) {
        intervalDisplay.textContent = status.lastTapAgo !== null ? `${status.lastTapAgo}ms ago` : '';
    }
    
    if (applyBtn && status.ready) {
        applyBtn.disabled = false;
    }
}

function showNotification(message, type = 'info') {
    if (localAppServices.showNotification) {
        localAppServices.showNotification(message, type);
    } else {
        console.log(`[TapTempo] ${message}`);
    }
}