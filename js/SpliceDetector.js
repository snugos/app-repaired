// js/SpliceDetector.js - Auto-detect and mark transient events in audio

let localAppServices = {};
let analyserNode = null;

/**
 * Initialize SpliceDetector with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initSpliceDetector(appServices) {
    localAppServices = appServices || {};
}

/**
 * Opens the Splice Detector panel
 * @param {string} trackId - Track ID to analyze
 * @param {string} clipId - Optional specific clip ID
 */
export function openSpliceDetectorPanel(trackId = null, clipId = null) {
    const windowId = 'spliceDetector';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        updateSpliceDetectorUI(trackId, clipId);
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'spliceDetectorContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const options = { 
        width: 500, 
        height: 450, 
        minWidth: 400, 
        minHeight: 350,
        initialContentKey: windowId,
        closable: true, 
        minimizable: true, 
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Splice Detector', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderSpliceDetectorContent(trackId, clipId), 50);
    }
    return win;
}

/**
 * Renders the Splice Detector panel content
 */
function renderSpliceDetectorContent(trackId, clipId) {
    const container = document.getElementById('spliceDetectorContent');
    if (!container) return;

    container.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-semibold text-white mb-1">Splice Detector</h3>
            <p class="text-sm text-gray-400">Auto-detect and mark transient events in audio</p>
        </div>

        <div class="mb-4">
            <label class="block text-sm text-gray-300 mb-2">Select Track</label>
            <select id="spliceTrackSelect" class="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm">
                <option value="">-- Select a track --</option>
            </select>
        </div>

        <div id="clipSelectionSection" class="mb-4 hidden">
            <label class="block text-sm text-gray-300 mb-2">Select Clip</label>
            <select id="spliceClipSelect" class="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm">
                <option value="">-- Select a clip --</option>
            </select>
        </div>

        <div id="spliceResultsSection" class="mb-4 hidden">
            <div class="bg-slate-800 rounded p-3 border border-slate-700 mb-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-white font-medium">Detection Results</span>
                    <span id="spliceCount" class="text-gray-400 text-sm">0 transients found</span>
                </div>
                <div id="spliceList" class="max-h-40 overflow-y-auto text-sm"></div>
            </div>
        </div>

        <div class="mb-4 p-3 bg-slate-800 rounded border border-slate-700">
            <h4 class="text-white font-medium mb-3">Detection Settings</h4>
            
            <div class="mb-3">
                <label class="block text-sm text-gray-300 mb-1">Sensitivity (dB threshold)</label>
                <div class="flex items-center gap-3">
                    <input type="range" id="spliceSensitivity" min="1" max="40" value="12" step="1" class="flex-1">
                    <span id="spliceSensitivityValue" class="text-white text-sm w-12 text-right">12 dB</span>
                </div>
            </div>

            <div class="mb-3">
                <label class="block text-sm text-gray-300 mb-1">Min Duration Between Splices</label>
                <div class="flex items-center gap-3">
                    <input type="range" id="spliceMinDuration" min="0.01" max="1" value="0.1" step="0.01" class="flex-1">
                    <span id="spliceMinDurationValue" class="text-white text-sm w-12 text-right">0.1s</span>
                </div>
            </div>

            <div class="mb-3">
                <label class="block text-sm text-gray-300 mb-1">Window Size (ms)</label>
                <div class="flex items-center gap-3">
                    <input type="range" id="spliceWindowSize" min="10" max="200" value="50" step="10" class="flex-1">
                    <span id="spliceWindowSizeValue" class="text-white text-sm w-12 text-right">50ms</span>
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between mt-4">
            <button id="analyzeAudioBtn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium transition-colors" disabled>
                🔍 Analyze Audio
            </button>
            <button id="markSplicesBtn" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-medium transition-colors hidden">
                ✂️ Mark Splices
            </button>
            <button id="closeSpliceBtn" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors">
                Close
            </button>
        </div>
    `;

    // Populate track dropdown
    const trackSelect = document.getElementById('spliceTrackSelect');
    const tracks = localAppServices.getTracks?.() || [];
    tracks.forEach(track => {
        if (track.type === 'Audio' && track.timelineClips?.length > 0) {
            const option = document.createElement('option');
            option.value = track.id;
            option.textContent = track.name;
            trackSelect.appendChild(option);
        }
    });

    if (trackId) {
        trackSelect.value = trackId;
        updateClipSelection(trackId);
    }

    // Event listeners
    trackSelect.addEventListener('change', (e) => {
        updateClipSelection(e.target.value);
    });

    document.getElementById('spliceSensitivity').addEventListener('input', (e) => {
        document.getElementById('spliceSensitivityValue').textContent = `${e.target.value} dB`;
    });

    document.getElementById('spliceMinDuration').addEventListener('input', (e) => {
        document.getElementById('spliceMinDurationValue').textContent = `${parseFloat(e.target.value).toFixed(2)}s`;
    });

    document.getElementById('spliceWindowSize').addEventListener('input', (e) => {
        document.getElementById('spliceWindowSizeValue').textContent = `${e.target.value}ms`;
    });

    document.getElementById('analyzeAudioBtn').addEventListener('click', () => {
        const trackId = trackSelect.value;
        const clipId = document.getElementById('spliceClipSelect').value;
        if (trackId && clipId) {
            analyzeAudioForTransients(trackId, clipId);
        }
    });

    document.getElementById('markSplicesBtn').addEventListener('click', () => {
        markSplicesOnTimeline();
    });

    document.getElementById('closeSpliceBtn').addEventListener('click', () => {
        const win = openWindows.get(windowId);
        if (win) win.close();
    });
}

/**
 * Update clip selection dropdown based on selected track
 */
function updateClipSelection(trackId) {
    const clipSelect = document.getElementById('spliceClipSelect');
    const clipSection = document.getElementById('clipSelectionSection');
    const analyzeBtn = document.getElementById('analyzeAudioBtn');
    
    clipSelect.innerHTML = '<option value="">-- Select a clip --</option>';
    
    if (!trackId) {
        clipSection.classList.add('hidden');
        analyzeBtn.disabled = true;
        return;
    }

    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    
    if (track && track.timelineClips?.length > 0) {
        track.timelineClips.forEach(clip => {
            const option = document.createElement('option');
            option.value = clip.id;
            option.textContent = `${clip.name || 'Unnamed'} (${clip.duration?.toFixed(2) || '?'}s)`;
            clipSelect.appendChild(option);
        });
        clipSection.classList.remove('hidden');
        analyzeBtn.disabled = clipSelect.value === '';
    } else {
        clipSection.classList.add('hidden');
        analyzeBtn.disabled = true;
    }
}

/**
 * Analyze audio for transients
 */
async function analyzeAudioForTransients(trackId, clipId) {
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) return;

    // Get sensitivity settings
    const sensitivity = parseInt(document.getElementById('spliceSensitivity').value);
    const minDuration = parseFloat(document.getElementById('spliceMinDuration').value);
    const windowSize = parseInt(document.getElementById('spliceWindowSize').value);

    // Show analyzing state
    const resultSection = document.getElementById('spliceResultsSection');
    const spliceList = document.getElementById('spliceList');
    const markBtn = document.getElementById('markSplicesBtn');
    
    resultSection.classList.remove('hidden');
    spliceList.innerHTML = '<div class="text-gray-400">Analyzing audio...</div>';
    markBtn.classList.add('hidden');

    try {
        // Get audio buffer for analysis
        let audioBuffer = null;
        
        // Try to get from source audio
        if (clip.sourceId && localAppServices.getAudioBuffer) {
            audioBuffer = await localAppServices.getAudioBuffer(clip.sourceId);
        }
        
        // Fall back: try to get from track's audio buffers
        if (!audioBuffer && track._audioBuffers && track._audioBuffers[clip.sourceId]) {
            audioBuffer = track._audioBuffers[clip.sourceId];
        }

        if (!audioBuffer) {
            spliceList.innerHTML = '<div class="text-yellow-400">⚠️ Audio buffer not available for analysis. Please ensure the audio clip is fully loaded.</div>';
            return;
        }

        // Perform transient detection using energy analysis
        const transients = detectTransients(audioBuffer, {
            sensitivity: sensitivity,
            minDuration: minDuration,
            windowSize: windowSize
        });

        // Store transients globally for marking
        window._lastSpliceTransients = transients;
        window._lastSpliceTrackId = trackId;
        window._lastSpliceClipId = clipId;

        // Update UI
        document.getElementById('spliceCount').textContent = `${transients.length} transient(s) found`;

        if (transients.length === 0) {
            spliceList.innerHTML = '<div class="text-gray-400">No transients detected. Try lowering the sensitivity.</div>';
        } else {
            spliceList.innerHTML = transients.map((t, i) => `
                <div class="flex items-center justify-between py-1 border-b border-slate-700 last:border-0">
                    <span class="text-gray-300">${i + 1}.</span>
                    <span class="text-white">${t.time.toFixed(3)}s</span>
                    <span class="text-gray-400">${t.energy.toFixed(1)} dB</span>
                </div>
            `).join('');
            markBtn.classList.remove('hidden');
        }

    } catch (error) {
        console.error('[SpliceDetector] Analysis error:', error);
        spliceList.innerHTML = `<div class="text-red-400">Error: ${error.message}</div>`;
    }
}

/**
 * Detect transients in audio buffer using energy analysis
 */
function detectTransients(audioBuffer, options = {}) {
    const { sensitivity = 12, minDuration = 0.1, windowSize = 50 } = options;
    
    const sampleRate = audioBuffer.sampleRate;
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const windowSamples = Math.floor((windowSize / 1000) * sampleRate);
    
    const transients = [];
    let lastTransientTime = -minDuration;
    
    // Calculate energy in windows
    for (let i = windowSamples; i < channelData.length - windowSamples; i += windowSamples) {
        // Calculate RMS energy for this window
        let sumSquares = 0;
        for (let j = 0; j < windowSamples; j++) {
            sumSquares += channelData[i + j] * channelData[i + j];
        }
        const rms = Math.sqrt(sumSquares / windowSamples);
        const energyDb = rms > 0 ? 20 * Math.log10(rms) : -100;

        // Compare with previous window
        let prevSumSquares = 0;
        for (let j = 0; j < windowSamples; j++) {
            prevSumSquares += channelData[i - windowSamples + j] * channelData[i - windowSamples + j];
        }
        const prevRms = Math.sqrt(prevSumSquares / windowSamples);
        const prevEnergyDb = prevRms > 0 ? 20 * Math.log10(prevRms) : -100;

        // Check if energy jumped significantly
        const energyJump = energyDb - prevEnergyDb;
        
        if (energyJump > sensitivity) {
            const time = i / sampleRate;
            
            // Check minimum duration since last transient
            if (time - lastTransientTime >= minDuration) {
                transients.push({ time, energy: energyDb, jump: energyJump });
                lastTransientTime = time;
            }
        }
    }

    return transients;
}

/**
 * Mark splices on the timeline
 */
function markSplicesOnTimeline() {
    const transients = window._lastSpliceTransients;
    const trackId = window._lastSpliceTrackId;
    const clipId = window._lastSpliceClipId;

    if (!transients || transients.length === 0) return;

    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) return;

    // Store splice markers on the clip
    if (!clip.spliceMarkers) clip.spliceMarkers = [];
    
    transients.forEach(t => {
        clip.spliceMarkers.push({
            time: t.time,
            type: 'transient',
            energy: t.energy
        });
    });

    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Marked ${transients.length} splice points on clip "${clip.name}"`, 2000);
    }

    // Re-render timeline to show markers
    if (localAppServices.renderTimeline) {
        localAppServices.renderTimeline();
    }
}

/**
 * Update the UI (when reopening)
 */
function updateSpliceDetectorUI(trackId, clipId) {
    // Could update values if needed
}