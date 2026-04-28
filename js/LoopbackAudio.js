// js/LoopbackAudio.js - Route audio output back to input for external source sampling
// Uses browser's virtual audio loopback (Web Audio API + MediaStream)

let loopbackEnabled = false;
let loopbackStream = null;
let loopbackSource = null;
let loopbackGain = null;
let loopbackDestination = null;
let loopbackAnalyser = null;

// UI elements
let loopbackPanel = null;
let loopbackStatusEl = null;
let loopbackMeterEl = null;
let loopbackEnableBtn = null;
let loopbackInputSelect = null;

const LOOPBACK_GAIN = 1.0;

export function isLoopbackEnabled() {
    return loopbackEnabled;
}

export async function initLoopback() {
    // Create the loopback panel if it doesn't exist
    createLoopbackPanel();
    console.log('[Loopback] Initialized');
}

function createLoopbackPanel() {
    // Check if panel already exists
    if (document.getElementById('loopbackPanel')) return;

    loopbackPanel = document.createElement('div');
    loopbackPanel.id = 'loopbackPanel';
    loopbackPanel.className = 'fixed bottom-10 left-2 z-[9000] bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg p-3 shadow-lg hidden';
    loopbackPanel.style.minWidth = '220px';
    loopbackPanel.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-semibold text-[#e0e0e0]">Loopback Audio</span>
            <button id="loopbackCloseBtn" class="text-xs text-gray-400 hover:text-white">✕</button>
        </div>
        <div class="flex items-center gap-2 mb-2">
            <label class="text-xs text-gray-400">Input:</label>
            <select id="loopbackInputSelect" class="bg-[#282828] border border-[#4a4a4a] rounded text-[#e0e0e0] text-xs px-2 py-1 flex-1">
                <option value="">Select audio source...</option>
            </select>
        </div>
        <div class="flex items-center gap-2 mb-2">
            <button id="loopbackEnableBtn" class="transport-btn text-xs px-3">Enable Loopback</button>
            <span id="loopbackStatus" class="text-xs text-gray-400">Disabled</span>
        </div>
        <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">Level:</span>
            <div id="loopbackMeterContainer" class="flex-1 h-3 bg-[#101010] rounded border border-[#3a3a3a] overflow-hidden">
                <div id="loopbackMeterBar" class="h-full bg-[#00b0b0]" style="width: 0%"></div>
            </div>
        </div>
        <div id="loopbackError" class="text-xs text-red-400 mt-2 hidden"></div>
    `;
    document.body.appendChild(loopbackPanel);

    // Get elements
    loopbackStatusEl = document.getElementById('loopbackStatus');
    loopbackMeterEl = document.getElementById('loopbackMeterBar');
    loopbackEnableBtn = document.getElementById('loopbackEnableBtn');
    loopbackInputSelect = document.getElementById('loopbackInputSelect');
    const closeBtn = document.getElementById('loopbackCloseBtn');

    // Event listeners
    loopbackEnableBtn.addEventListener('click', toggleLoopback);
    closeBtn.addEventListener('click', hideLoopbackPanel);

    // Populate input devices
    populateAudioInputs();
}

// List audio input devices
async function populateAudioInputs() {
    if (!loopbackInputSelect) return;

    try {
        // Request permission to list devices
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');

        loopbackInputSelect.innerHTML = '<option value="">Select audio source...</option>';

        audioInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
            loopbackInputSelect.appendChild(option);
        });

        // If only one device, select it automatically
        if (audioInputs.length === 1) {
            loopbackInputSelect.value = audioInputs[0].deviceId;
        }
    } catch (err) {
        console.warn('[Loopback] Cannot enumerate devices:', err);
        loopbackInputSelect.innerHTML = '<option value="">Permission required</option>';
    }
}

async function toggleLoopback() {
    if (loopbackEnabled) {
        await disableLoopback();
    } else {
        await enableLoopback();
    }
}

async function enableLoopback() {
    const errorEl = document.getElementById('loopbackError');

    try {
        const deviceId = loopbackInputSelect?.value;

        // Request microphone with loopback (system audio)
        const constraints = {
            audio: deviceId ? {
                deviceId: { exact: deviceId }
            } : {
                // Try to get system audio (loopback) - browser will show "system audio" option
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        };

        console.log('[Loopback] Requesting audio input...');
        loopbackStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Create audio context for processing
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();

        // Create source from stream
        loopbackSource = ctx.createMediaStreamSource(loopbackStream);

        // Create gain node
        loopbackGain = ctx.createGain();
        loopbackGain.gain.value = LOOPBACK_GAIN;

        // Create analyser for metering
        loopbackAnalyser = ctx.createAnalyser();
        loopbackAnalyser.fftSize = 256;

        // Create destination for routing to tracks
        loopbackDestination = ctx.createMediaStreamDestination();

        // Connect: source -> gain -> analyser -> destination
        loopbackSource.connect(loopbackGain);
        loopbackGain.connect(loopbackAnalyser);
        loopbackAnalyser.connect(loopbackDestination);

        // Start metering
        startLoopbackMetering();

        loopbackEnabled = true;
        if (loopbackEnableBtn) loopbackEnableBtn.textContent = 'Disable Loopback';
        if (loopbackStatusEl) loopbackStatusEl.textContent = 'Active';
        if (loopbackStatusEl) loopbackStatusEl.className = 'text-xs text-green-400';
        if (errorEl) errorEl.classList.add('hidden');

        // Publish to global state so tracks can use this as input
        if (typeof window !== 'undefined') {
            window.loopbackStream = loopbackStream;
            window.loopbackAudioNode = loopbackSource;
        }

        console.log('[Loopback] Enabled successfully');

    } catch (err) {
        console.error('[Loopback] Failed to enable:', err);
        if (errorEl) {
            errorEl.textContent = err.message || 'Failed to enable loopback';
            errorEl.classList.remove('hidden');
        }
    }
}

async function disableLoopback() {
    if (loopbackSource) {
        loopbackSource.disconnect();
        loopbackSource = null;
    }
    if (loopbackGain) {
        loopbackGain.disconnect();
        loopbackGain = null;
    }
    if (loopbackAnalyser) {
        loopbackAnalyser.disconnect();
        loopbackAnalyser = null;
    }
    if (loopbackStream) {
        loopbackStream.getTracks().forEach(track => track.stop());
        loopbackStream = null;
    }
    loopbackDestination = null;

    loopbackEnabled = false;
    if (loopbackEnableBtn) loopbackEnableBtn.textContent = 'Enable Loopback';
    if (loopbackStatusEl) loopbackStatusEl.textContent = 'Disabled';
    if (loopbackStatusEl) loopbackStatusEl.className = 'text-xs text-gray-400';
    if (loopbackMeterEl) loopbackMeterEl.style.width = '0%';

    if (typeof window !== 'undefined') {
        window.loopbackStream = null;
        window.loopbackAudioNode = null;
    }

    console.log('[Loopback] Disabled');
}

function startLoopbackMetering() {
    if (!loopbackAnalyser) return;

    const dataArray = new Uint8Array(loopbackAnalyser.frequencyBinCount);

    function updateMeter() {
        if (!loopbackEnabled || !loopbackAnalyser) return;

        loopbackAnalyser.getByteFrequencyData(dataArray);

        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const percent = Math.min(100, (rms / 128) * 100);

        if (loopbackMeterEl) {
            loopbackMeterEl.style.width = `${percent}%`;
            // Color based on level
            if (percent > 80) {
                loopbackMeterEl.style.backgroundColor = '#ff4444';
            } else if (percent > 60) {
                loopbackMeterEl.style.backgroundColor = '#ffaa00';
            } else {
                loopbackMeterEl.style.backgroundColor = '#00b0b0';
            }
        }

        requestAnimationFrame(updateMeter);
    }

    updateMeter();
}

function hideLoopbackPanel() {
    if (loopbackPanel) {
        loopbackPanel.classList.add('hidden');
    }
}

function showLoopbackPanel() {
    if (!loopbackPanel) {
        createLoopbackPanel();
    }
    loopbackPanel.classList.remove('hidden');
    // Refresh device list
    populateAudioInputs();
}

// Get loopback stream for routing to a track
export function getLoopbackStream() {
    return loopbackStream;
}

export function getLoopbackNode() {
    return loopbackSource;
}

// Toggle panel visibility
export function toggleLoopbackPanel() {
    if (loopbackPanel && !loopbackPanel.classList.contains('hidden')) {
        hideLoopbackPanel();
    } else {
        showLoopbackPanel();
    }
}

// Cleanup
export function disposeLoopback() {
    disableLoopback();
    if (loopbackPanel && loopbackPanel.parentNode) {
        loopbackPanel.parentNode.removeChild(loopbackPanel);
    }
    loopbackPanel = null;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Listen for showLoopbackPanel event from menu
    const startMenu = document.getElementById('startMenu');
    if (startMenu) {
        // The menu item will trigger showLoopbackPanel through main.js
    }
});

// Auto-init when script loads
initLoopback();