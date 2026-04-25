// js/AudioTapTempo.js - Tap Tempo feature using audio input timing detection
// Allows setting project tempo by tapping a button OR using audio input beat detection

let localAppServices = {};
let tapTimes = [];
let lastTapTime = 0;
const MAX_TAP_INTERVAL = 3000;
const MIN_TAPS = 3;

// Audio input state
let audioContext = null;
let analyser = null;
let micStream = null;
let isListening = false;
let beatTimestamps = [];
let listenTimeout = null;
const LISTEN_DURATION = 10000; // Listen for up to 10 seconds

/**
 * Initialize the Audio Tap Tempo module
 * @param {Object} services - App services including get/set BPM functions
 */
export function initAudioTapTempo(services) {
    localAppServices = services;
    console.log('[AudioTapTempo] Initialized');
}

/**
 * Record a tap and calculate BPM (button-based)
 * @returns {number|null} Calculated BPM or null if not enough taps
 */
export function recordTap() {
    const now = performance.now();
    
    if (now - lastTapTime > MAX_TAP_INTERVAL) {
        tapTimes = [];
    }
    
    lastTapTime = now;
    tapTimes.push(now);
    
    if (tapTimes.length > 16) {
        tapTimes = tapTimes.slice(-16);
    }
    
    if (tapTimes.length < MIN_TAPS) {
        return null;
    }
    
    let totalInterval = 0;
    for (let i = 1; i < tapTimes.length; i++) {
        totalInterval += tapTimes[i] - tapTimes[i - 1];
    }
    const avgInterval = totalInterval / (tapTimes.length - 1);
    const bpm = Math.round(60000 / avgInterval);
    const clampedBpm = Math.max(20, Math.min(300, bpm));
    
    return clampedBpm;
}

/**
 * Set the BPM via button tap
 * @returns {number} The BPM that was set, or 0 if not ready
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
 * Start listening for audio beats via microphone
 * @returns {Promise<boolean>} Success
 */
export async function startAudioBeatDetection() {
    try {
        // Request microphone access
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create audio context
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Create analyser
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        
        // Connect mic to analyser
        const source = audioContext.createMediaStreamSource(micStream);
        source.connect(analyser);
        
        isListening = true;
        beatTimestamps = [];
        
        // Start analyzing audio
        detectBeats();
        
        // Auto-stop after listen duration
        listenTimeout = setTimeout(() => {
            stopAudioBeatDetection();
        }, LISTEN_DURATION);
        
        return true;
    } catch (err) {
        console.warn('[AudioTapTempo] Microphone access denied:', err);
        showNotification('Microphone access denied. Please allow audio input.', 'warning');
        return false;
    }
}

/**
 * Detect beats from audio input using onset detection
 */
function detectBeats() {
    if (!isListening || !analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function analyze() {
        if (!isListening) return;
        
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate RMS energy
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        
        // Simple onset detection: energy spike above threshold
        const threshold = 50;
        const now = performance.now();
        
        if (rms > threshold) {
            // Check if enough time has passed since last beat (minimum 150ms)
            const lastBeat = beatTimestamps.length > 0 ? beatTimestamps[beatTimestamps.length - 1] : 0;
            if (now - lastBeat > 150) {
                beatTimestamps.push(now);
                updateAudioBeatDisplay();
            }
        }
        
        if (isListening) {
            requestAnimationFrame(analyze);
        }
    }
    
    analyze();
}

/**
 * Stop audio beat detection and calculate BPM
 * @returns {number|null} Detected BPM or null
 */
export function stopAudioBeatDetection() {
    isListening = false;
    
    if (listenTimeout) {
        clearTimeout(listenTimeout);
        listenTimeout = null;
    }
    
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    
    updateAudioBeatDisplay();
    
    // Calculate BPM from detected beats
    if (beatTimestamps.length >= MIN_TAPS) {
        let totalInterval = 0;
        for (let i = 1; i < beatTimestamps.length; i++) {
            totalInterval += beatTimestamps[i] - beatTimestamps[i - 1];
        }
        const avgInterval = totalInterval / (beatTimestamps.length - 1);
        const bpm = Math.round(60000 / avgInterval);
        const clampedBpm = Math.max(20, Math.min(300, bpm));
        
        if (localAppServices.setBPM) {
            localAppServices.setBPM(clampedBpm);
        }
        
        showNotification(`Audio detected: ${clampedBpm} BPM`, 'info');
        return clampedBpm;
    }
    
    return null;
}

/**
 * Get audio detection status
 * @returns {Object} Status
 */
export function getAudioBeatStatus() {
    return {
        isListening,
        beatCount: beatTimestamps.length,
        ready: beatTimestamps.length >= MIN_TAPS
    };
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
        width: 400,
        height: 380,
        minWidth: 320,
        minHeight: 300,
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
            <div class="text-xs text-gray-500" id="tapCountDisplay">Tap ${MIN_TAPS}+ times or use audio input</div>
        </div>
        
        <div class="flex justify-center mb-4">
            <button id="tapButton" class="w-28 h-28 rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xl font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95">
                TAP
            </button>
        </div>
        
        <div class="border-t border-gray-700 pt-3 mb-3">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-400">Audio Input Detection</span>
                <button id="audioListenBtn" class="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-white text-xs">
                    Listen
                </button>
            </div>
            <div id="audioLevelBar" class="h-2 bg-gray-700 rounded overflow-hidden mb-1">
                <div id="audioLevelFill" class="h-full bg-purple-500 transition-all" style="width: 0%"></div>
            </div>
            <div class="flex items-center justify-between text-xs text-gray-500">
                <span id="audioBeatCount">Beats: 0</span>
                <span id="audioStatus">Idle</span>
            </div>
        </div>
        
        <div class="flex items-center justify-between text-xs text-gray-500">
            <button id="tapResetBtn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white">
                Reset
            </button>
            <button id="tapApplyBtn" class="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-white" disabled>
                Apply BPM
            </button>
        </div>
        
        <div class="mt-3 pt-3 border-t border-gray-700">
            <div class="text-xs text-gray-400 text-center">
                Tap button or clap/click in rhythm. Audio detection uses microphone.
            </div>
        </div>
    `;
    
    setupTapTempoHandlers();
    startAudioLevelMonitoring();
}

/**
 * Start monitoring audio input level for visual feedback
 */
function startAudioLevelMonitoring() {
    const updateLevel = () => {
        if (!isListening || !analyser) {
            // Check if mic is available even when not listening
            return;
        }
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const level = Math.min(100, (rms / 100) * 100);
        
        const fill = document.getElementById('audioLevelFill');
        if (fill) {
            fill.style.width = `${level}%`;
        }
        
        requestAnimationFrame(updateLevel);
    };
}

/**
 * Update audio beat detection display
 */
function updateAudioBeatDisplay() {
    const beatCount = document.getElementById('audioBeatCount');
    const status = document.getElementById('audioStatus');
    const listenBtn = document.getElementById('audioListenBtn');
    
    if (beatCount) {
        beatCount.textContent = `Beats: ${beatTimestamps.length}`;
    }
    
    if (status) {
        status.textContent = isListening ? 'Listening...' : (beatTimestamps.length >= MIN_TAPS ? 'Ready' : 'Idle');
    }
    
    if (listenBtn) {
        if (isListening) {
            listenBtn.textContent = 'Stop';
            listenBtn.className = 'px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white text-xs';
        } else {
            listenBtn.textContent = 'Listen';
            listenBtn.className = 'px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-white text-xs';
        }
    }
    
    // Update BPM display if we have enough beats
    if (beatTimestamps.length >= MIN_TAPS) {
        let totalInterval = 0;
        for (let i = 1; i < beatTimestamps.length; i++) {
            totalInterval += beatTimestamps[i] - beatTimestamps[i - 1];
        }
        const avgInterval = totalInterval / (beatTimestamps.length - 1);
        const bpm = Math.round(60000 / avgInterval);
        const clampedBpm = Math.max(20, Math.min(300, bpm));
        
        const display = document.getElementById('tapTempoDisplay');
        if (display) {
            display.textContent = clampedBpm;
            display.className = 'text-5xl font-bold text-purple-400 mb-2';
        }
        
        const applyBtn = document.getElementById('tapApplyBtn');
        if (applyBtn) applyBtn.disabled = false;
    }
}

/**
 * Setup event handlers for tap tempo panel
 */
function setupTapTempoHandlers() {
    const tapButton = document.getElementById('tapButton');
    const tapResetBtn = document.getElementById('tapResetBtn');
    const tapApplyBtn = document.getElementById('tapApplyBtn');
    const audioListenBtn = document.getElementById('audioListenBtn');
    
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
            beatTimestamps = [];
            updateTapTempoDisplay();
            updateAudioBeatDisplay();
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
    
    if (audioListenBtn) {
        audioListenBtn.addEventListener('click', async () => {
            if (isListening) {
                stopAudioBeatDetection();
            } else {
                const success = await startAudioBeatDetection();
                if (success) {
                    updateAudioBeatDisplay();
                }
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
            const bpm = recordTap();
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
            countDisplay.textContent = `Tap ${MIN_TAPS}+ times or use audio input`;
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