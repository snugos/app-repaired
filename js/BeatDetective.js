// js/BeatDetective.js - Automatic Beat/Tempo Grid Detection
// Detect tempo from audio clips using onset detection and beat analysis

let localAppServices = {};
let selectedTrackId = null;
let detectedTempo = 120;
let confidence = 0;
let analysisWorker = null;

export function initBeatDetective(appServices) {
    localAppServices = appServices || {};
    console.log('[BeatDetective] Initialized');
}

export function openBeatDetectivePanel() {
    const windowId = 'beatDetective';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        updateBeatDetectiveUI();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'beatDetectiveContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 select-none';
    
    contentContainer.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-white mb-1">Beat Detective</h3>
            <p class="text-sm text-gray-400">Automatic beat/tempo grid detection from audio</p>
        </div>
        
        <div class="mb-3">
            <label class="text-xs text-gray-400 mb-1 block">Select Audio Track:</label>
            <select id="bdTrackSelect" class="w-full p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm">
                <option value="">-- Select an audio track --</option>
            </select>
        </div>
        
        <div class="mb-4 p-4 bg-gray-800 rounded border border-gray-700 text-center">
            <div class="text-4xl font-bold text-green-400" id="bdDetectedTempo">--.-</div>
            <div class="text-sm text-gray-500 mt-1">Detected BPM</div>
            <div class="mt-2 flex items-center justify-center gap-2">
                <span class="text-xs text-gray-400">Confidence:</span>
                <div class="w-24 h-2 bg-gray-700 rounded overflow-hidden">
                    <div id="bdConfidenceBar" class="h-full bg-blue-500 transition-all duration-300" style="width: 0%"></div>
                </div>
                <span id="bdConfidenceValue" class="text-xs text-gray-400">--</span>
            </div>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-400 mb-2">Manual Tempo Adjustment</div>
            <div class="flex items-center gap-2">
                <button id="bdTempoDown" class="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600">−</button>
                <input type="number" id="bdManualTempo" value="120" min="30" max="300" step="0.1" 
                    class="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-white text-center">
                <button id="bdTempoUp" class="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600">+</button>
            </div>
            <div class="flex items-center gap-2 mt-2">
                <button id="bdHalveTempo" class="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600">÷2</button>
                <button id="bdDoubleTempo" class="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600">×2</button>
                <div class="flex-1"></div>
                <button id="bdSwapFeel" class="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600">Swap Feel</button>
            </div>
        </div>
        
        <div id="bdBeatGridPreview" class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-400 mb-2">Beat Grid Preview</div>
            <div id="bdBeatGrid" class="flex gap-1 overflow-x-auto pb-2">
                <span class="text-xs text-gray-500">Select a track to see beat grid</span>
            </div>
        </div>
        
        <div class="flex-1"></div>
        
        <div class="flex gap-2 mb-2">
            <button id="bdDetectBtn" class="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-500">
                Detect Tempo
            </button>
        </div>
        
        <div class="flex gap-2">
            <button id="bdApplyBtn" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-500" disabled>
                Apply to Track
            </button>
            <button id="bdCloseBtn" class="px-4 py-2 bg-gray-700 text-white rounded font-medium hover:bg-gray-600">
                Close
            </button>
        </div>
        
        <div class="mt-3 p-2 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-500">
                <strong>How it works:</strong>
                <ul class="mt-1 space-y-1">
                    <li>• Select an audio track with clear rhythmic content</li>
                    <li>• Click "Detect Tempo" to analyze onset patterns</li>
                    <li>• Adjust manually if detection is off</li>
                    <li>• Click "Apply" to set the track's beat grid</li>
                </ul>
            </div>
        </div>
    `;
    
    const options = {
        width: 380,
        height: 520,
        minWidth: 320,
        minHeight: 450,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Beat Detective', contentContainer, options) : null;
    
    setTimeout(() => {
        populateTrackSelect();
        setupEventListeners();
        updateBeatDetectiveUI();
    }, 50);
    
    return win;
}

function populateTrackSelect() {
    const select = document.getElementById('bdTrackSelect');
    if (!select) return;
    
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const audioTracks = tracks.filter(t => t.type === 'Audio' || t.type === 'Sampler');
    
    select.innerHTML = '<option value="">-- Select an audio track --</option>';
    
    audioTracks.forEach(track => {
        const option = document.createElement('option');
        option.value = track.id;
        option.textContent = track.name;
        select.appendChild(option);
    });
    
    if (audioTracks.length === 0) {
        select.innerHTML = '<option value="">No audio tracks found</option>';
    }
}

function setupEventListeners() {
    const select = document.getElementById('bdTrackSelect');
    const detectBtn = document.getElementById('bdDetectBtn');
    const applyBtn = document.getElementById('bdApplyBtn');
    const closeBtn = document.getElementById('bdCloseBtn');
    const tempoDown = document.getElementById('bdTempoDown');
    const tempoUp = document.getElementById('bdTempoUp');
    const manualTempo = document.getElementById('bdManualTempo');
    const halveBtn = document.getElementById('bdHalveTempo');
    const doubleBtn = document.getElementById('bdDoubleTempo');
    const swapFeelBtn = document.getElementById('bdSwapFeel');
    
    select?.addEventListener('change', (e) => {
        selectedTrackId = e.target.value ? parseInt(e.target.value, 10) : null;
        detectedTempo = 120;
        confidence = 0;
        updateBeatDetectiveUI();
        updateBeatGridPreview();
    });
    
    detectBtn?.addEventListener('click', () => {
        if (selectedTrackId) {
            detectTempoFromTrack(selectedTrackId);
        } else {
            showNotification('Please select an audio track first', 2000);
        }
    });
    
    applyBtn?.addEventListener('click', () => {
        if (selectedTrackId && detectedTempo > 0) {
            applyTempoToTrack(selectedTrackId, detectedTempo);
        }
    });
    
    closeBtn?.addEventListener('click', () => {
        const win = localAppServices.getWindowById ? localAppServices.getWindowById('beatDetective') : null;
        if (win?.close) win.close();
    });
    
    tempoDown?.addEventListener('click', () => {
        let val = parseFloat(manualTempo.value) || 120;
        val = Math.max(30, val - 0.5);
        manualTempo.value = val.toFixed(1);
        detectedTempo = val;
        updateBeatDetectiveUI();
    });
    
    tempoUp?.addEventListener('click', () => {
        let val = parseFloat(manualTempo.value) || 120;
        val = Math.min(300, val + 0.5);
        manualTempo.value = val.toFixed(1);
        detectedTempo = val;
        updateBeatDetectiveUI();
    });
    
    manualTempo?.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value) || 120;
        val = Math.max(30, Math.min(300, val));
        manualTempo.value = val.toFixed(1);
        detectedTempo = val;
        confidence = 1;
        updateBeatDetectiveUI();
    });
    
    halveBtn?.addEventListener('click', () => {
        let val = detectedTempo / 2;
        val = Math.max(30, Math.min(300, val));
        manualTempo.value = val.toFixed(1);
        detectedTempo = val;
        updateBeatDetectiveUI();
    });
    
    doubleBtn?.addEventListener('click', () => {
        let val = detectedTempo * 2;
        val = Math.max(30, Math.min(300, val));
        manualTempo.value = val.toFixed(1);
        detectedTempo = val;
        updateBeatDetectiveUI();
    });
    
    swapFeelBtn?.addEventListener('click', () => {
        let val = detectedTempo;
        // Swap between straight and triplet feel (multiply by 2/3 or 3/2)
        if (val % 1 === 0) {
            // Try to detect if it's a triplet feel and swap
            val = val * 2 / 3;
        } else {
            val = val * 3 / 2;
        }
        val = Math.max(30, Math.min(300, val));
        manualTempo.value = val.toFixed(1);
        detectedTempo = val;
        updateBeatDetectiveUI();
    });
}

async function detectTempoFromTrack(trackId) {
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        showNotification('Track not found', 2000);
        return;
    }
    
    const detectBtn = document.getElementById('bdDetectBtn');
    if (detectBtn) {
        detectBtn.textContent = 'Analyzing...';
        detectBtn.disabled = true;
    }
    
    try {
        // Get audio buffer from track
        let audioBuffer = null;
        
        if (track.audioBuffer) {
            audioBuffer = track.audioBuffer;
        } else if (track.samplerAudioData?.audioBufferDataURL) {
            // Load from data URL
            const response = await fetch(track.samplerAudioData.audioBufferDataURL);
            const arrayBuffer = await response.arrayBuffer();
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } else if (track.instrumentSamplerSettings?.audioBufferDataURL) {
            const response = await fetch(track.instrumentSamplerSettings.audioBufferDataURL);
            const arrayBuffer = await response.arrayBuffer();
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        }
        
        if (!audioBuffer) {
            showNotification('No audio data found in track', 2000);
            resetDetectButton();
            return;
        }
        
        // Perform onset detection and tempo analysis
        const result = analyzeAudioForTempo(audioBuffer);
        detectedTempo = result.tempo;
        confidence = result.confidence;
        
        updateBeatDetectiveUI();
        updateBeatGridPreview();
        
        const confidencePercent = Math.round(confidence * 100);
        showNotification(`Detected ${detectedTempo.toFixed(1)} BPM (${confidencePercent}% confidence)`, 2500);
        
    } catch (error) {
        console.error('[BeatDetective] Detection error:', error);
        showNotification('Error analyzing audio', 2000);
    }
    
    resetDetectButton();
}

function analyzeAudioForTempo(audioBuffer) {
    // Get the audio data
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Onset detection parameters
    const blockSize = 1024;
    const hopSize = 512;
    const energyHistory = [];
    const onsets = [];
    
    // Calculate energy in blocks
    for (let i = 0; i < channelData.length; i += hopSize) {
        let energy = 0;
        const end = Math.min(i + blockSize, channelData.length);
        for (let j = i; j < end; j++) {
            energy += channelData[j] * channelData[j];
        }
        energy = Math.sqrt(energy / blockSize);
        energyHistory.push(energy);
    }
    
    // Find onsets (energy spikes)
    const threshold = 0.15;
    for (let i = 1; i < energyHistory.length; i++) {
        if (energyHistory[i] > threshold && energyHistory[i] > energyHistory[i - 1] * 1.3) {
            const timeInSeconds = (i * hopSize) / sampleRate;
            onsets.push(timeInSeconds);
        }
    }
    
    if (onsets.length < 3) {
        return { tempo: 120, confidence: 0 };
    }
    
    // Calculate intervals between onsets
    const intervals = [];
    for (let i = 1; i < onsets.length; i++) {
        intervals.push(onsets[i] - onsets[i - 1]);
    }
    
    // Filter to plausible beat intervals (0.25s to 2s = 30-240 BPM)
    const plausibleIntervals = intervals.filter(int => int >= 0.25 && int <= 2.0);
    
    if (plausibleIntervals.length < 2) {
        return { tempo: 120, confidence: 0 };
    }
    
    // Find the most common interval (median)
    plausibleIntervals.sort((a, b) => a - b);
    const medianInterval = plausibleIntervals[Math.floor(plausibleIntervals.length / 2)];
    
    if (medianInterval <= 0) {
        return { tempo: 120, confidence: 0 };
    }
    
    // Calculate BPM from median interval
    let bpm = 60 / medianInterval;
    
    // Normalize to reasonable range (allow halves/doubles)
    while (bpm < 40) bpm *= 2;
    while (bpm > 200) bpm /= 2;
    
    // Calculate confidence based on interval consistency
    const variance = plausibleIntervals.reduce((sum, int) => {
        return sum + Math.pow(int - medianInterval, 2);
    }, 0) / plausibleIntervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / medianInterval; // coefficient of variation
    const conf = Math.max(0, Math.min(1, 1 - cv * 5));
    
    // Round to one decimal
    bpm = Math.round(bpm * 10) / 10;
    
    return { tempo: bpm, confidence: conf };
}

function updateBeatDetectiveUI() {
    const tempoDisplay = document.getElementById('bdDetectedTempo');
    const confidenceBar = document.getElementById('bdConfidenceBar');
    const confidenceValue = document.getElementById('bdConfidenceValue');
    const manualTempo = document.getElementById('bdManualTempo');
    const applyBtn = document.getElementById('bdApplyBtn');
    
    if (tempoDisplay) {
        tempoDisplay.textContent = detectedTempo > 0 ? detectedTempo.toFixed(1) : '--.-';
    }
    
    if (confidenceBar && confidenceValue) {
        const percent = Math.round(confidence * 100);
        confidenceBar.style.width = `${percent}%`;
        confidenceValue.textContent = `${percent}%`;
        
        // Color based on confidence
        if (confidence >= 0.7) {
            confidenceBar.className = 'h-full bg-green-500 transition-all duration-300';
        } else if (confidence >= 0.4) {
            confidenceBar.className = 'h-full bg-yellow-500 transition-all duration-300';
        } else {
            confidenceBar.className = 'h-full bg-red-500 transition-all duration-300';
        }
    }
    
    if (manualTempo && detectedTempo > 0) {
        manualTempo.value = detectedTempo.toFixed(1);
    }
    
    if (applyBtn) {
        applyBtn.disabled = !selectedTrackId || detectedTempo <= 0;
    }
}

function updateBeatGridPreview() {
    const gridContainer = document.getElementById('bdBeatGrid');
    if (!gridContainer) return;
    
    if (!selectedTrackId || detectedTempo <= 0) {
        gridContainer.innerHTML = '<span class="text-xs text-gray-500">Select a track to see beat grid</span>';
        return;
    }
    
    // Generate a visual representation of the beat grid
    const beatDuration = 60 / detectedTempo;
    const barDuration = beatDuration * 4; // 4/4 time
    const numBeats = 8;
    
    let html = '';
    for (let i = 0; i < numBeats; i++) {
        const isDownbeat = i % 4 === 0;
        const time = (i * beatDuration).toFixed(2);
        html += `
            <div class="flex-shrink-0 w-12 h-8 rounded flex flex-col items-center justify-center ${isDownbeat ? 'bg-blue-600' : 'bg-gray-700'}">
                <span class="text-xs text-white font-bold">${i + 1}</span>
                <span class="text-[9px] text-gray-300">${time}s</span>
            </div>
        `;
    }
    
    gridContainer.innerHTML = html;
}

function applyTempoToTrack(trackId, tempo) {
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        showNotification('Track not found', 2000);
        return;
    }
    
    // Update the track's beat grid / warp settings if available
    if (track.setBeatGridTempo) {
        track.setBeatGridTempo(tempo);
    }
    
    // Also update the global tempo if user wants
    if (localAppServices.setTempo) {
        localAppServices.setTempo(tempo);
    }
    
    showNotification(`Applied ${tempo.toFixed(1)} BPM to ${track.name}`, 2500);
    
    const applyBtn = document.getElementById('bdApplyBtn');
    if (applyBtn) {
        applyBtn.textContent = 'Applied!';
        setTimeout(() => {
            applyBtn.textContent = 'Apply to Track';
        }, 1500);
    }
}

function resetDetectButton() {
    const detectBtn = document.getElementById('bdDetectBtn');
    if (detectBtn) {
        detectBtn.textContent = 'Detect Tempo';
        detectBtn.disabled = false;
    }
}

function showNotification(message, duration = 2000) {
    if (localAppServices.showNotification) {
        localAppServices.showNotification(message, duration);
    }
}