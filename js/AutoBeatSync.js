// js/AutoBeatSync.js - Auto-Beat Sync feature for SnugOS DAW
// Feature: Automatically sync tempo to detected BPM from audio input

let localAppServices = {};
let analyser = null;
let audioContext = null;
let isAnalyzing = false;
let beatDetectionLoop = null;
let detectedBpm = null;
let lastBeatTime = 0;
let beatIntervals = [];
let enabled = false;

export function initAutoBeatSync(services) {
    localAppServices = services;
    console.log('[AutoBeatSync] Initialized');
}

export function openAutoBeatSyncPanel(savedState = null) {
    const windowId = 'autoBeatSync';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'autoBeatSyncContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';

    const options = {
        width: 400,
        height: 300,
        minWidth: 300,
        minHeight: 250,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    if (savedState) {
        Object.assign(options, {
            x: parseInt(savedState.left, 10),
            y: parseInt(savedState.top, 10),
            width: parseInt(savedState.width, 10),
            height: parseInt(savedState.height, 10),
            zIndex: savedState.zIndex,
            isMinimized: savedState.isMinimized
        });
    }

    const win = localAppServices.createWindow(windowId, 'Auto-Beat Sync', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderAutoBeatSyncContent(), 50);
    }
    return win;
}

function renderAutoBeatSyncContent() {
    const container = document.getElementById('autoBeatSyncContent');
    if (!container) return;

    container.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="autoBeatEnabled" ${enabled ? 'checked' : ''} class="w-5 h-5 accent-blue-500">
                    <span class="text-sm font-medium">Enable Auto-Beat Sync</span>
                </label>
            </div>
            <div id="beatIndicator" class="w-4 h-4 rounded-full bg-gray-600 ${isAnalyzing ? 'animate-pulse bg-green-500' : ''}"></div>
        </div>
        
        <div class="mb-4 p-4 bg-gray-800 rounded-lg text-center">
            <div class="text-xs text-gray-400 mb-1">Detected BPM</div>
            <div id="detectedBpmDisplay" class="text-4xl font-bold text-blue-400">--</div>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-400 mb-2">Beat Visualization</div>
            <div id="beatVizContainer" class="h-8 bg-gray-900 rounded flex items-center justify-center">
                <canvas id="beatVizCanvas" class="w-full h-full rounded"></canvas>
            </div>
        </div>
        
        <div class="flex items-center justify-between text-sm">
            <div class="flex items-center gap-2">
                <label class="text-gray-400">Sensitivity:</label>
                <input type="range" id="beatSensitivity" min="1" max="10" value="5" class="w-24 accent-blue-500">
            </div>
            <div class="flex items-center gap-2">
                <label class="text-gray-400">Tolerance:</label>
                <input type="range" id="beatTolerance" min="1" max="20" value="10" class="w-24 accent-blue-500">
                <span id="beatToleranceValue" class="text-xs text-gray-500 w-8">10%</span>
            </div>
        </div>
        
        <div class="mt-4 flex items-center justify-between text-xs text-gray-500">
            <span>Tap to set manually or let it auto-detect</span>
            <button id="tapBpmBtn" class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Tap BPM</button>
        </div>
    `;

    setupAutoBeatSyncEvents();
    
    if (enabled && isAnalyzing) {
        startBeatDetection();
    }
}

function setupAutoBeatSyncEvents() {
    const container = document.getElementById('autoBeatSyncContent');
    if (!container) return;

    const enabledCheckbox = container.querySelector('#autoBeatEnabled');
    const sensitivitySlider = container.querySelector('#beatSensitivity');
    const toleranceSlider = container.querySelector('#beatTolerance');
    const toleranceValue = container.querySelector('#beatToleranceValue');
    const tapBtn = container.querySelector('#tapBpmBtn');

    if (enabledCheckbox) {
        enabledCheckbox.addEventListener('change', (e) => {
            enabled = e.target.checked;
            if (enabled) {
                startBeatDetection();
            } else {
                stopBeatDetection();
            }
            localAppServices.showNotification?.(`Auto-Beat Sync ${enabled ? 'enabled' : 'disabled'}`, 1500);
        });
    }

    if (toleranceSlider && toleranceValue) {
        toleranceSlider.addEventListener('input', (e) => {
            toleranceValue.textContent = `${e.target.value}%`;
        });
    }

    if (tapBtn) {
        let tapTimes = [];
        tapBtn.addEventListener('click', () => {
            const now = Date.now();
            tapTimes.push(now);
            if (tapTimes.length > 4) tapTimes.shift();
            
            if (tapTimes.length >= 2) {
                const intervals = [];
                for (let i = 1; i < tapTimes.length; i++) {
                    intervals.push(tapTimes[i] - tapTimes[i-1]);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const bpm = Math.round(60000 / avgInterval);
                
                if (bpm >= 40 && bpm <= 300) {
                    detectedBpm = bpm;
                    updateBpmDisplay(bpm);
                    if (localAppServices.setTempo) {
                        localAppServices.setTempo(bpm);
                        localAppServices.showNotification?.(`Tempo set to ${bpm} BPM`, 1500);
                    }
                }
            }
        });
    }
}

async function startBeatDetection() {
    if (isAnalyzing) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        
        isAnalyzing = true;
        beatIntervals = [];
        lastBeatTime = 0;
        
        runBeatDetectionLoop();
        updateBeatIndicator(true);
    } catch (error) {
        console.error('[AutoBeatSync] Could not access microphone:', error);
        localAppServices.showNotification?.('Microphone access denied', 2000);
        isAnalyzing = false;
        updateBeatIndicator(false);
    }
}

function stopBeatDetection() {
    isAnalyzing = false;
    if (beatDetectionLoop) {
        cancelAnimationFrame(beatDetectionLoop);
        beatDetectionLoop = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    updateBeatIndicator(false);
}

function runBeatDetectionLoop() {
    if (!isAnalyzing || !analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate energy in bass frequencies (60-180 Hz where kick drum is)
    const bassStart = Math.floor(60 / (audioContext.sampleRate / analyser.fftSize));
    const bassEnd = Math.floor(180 / (audioContext.sampleRate / analyser.fftSize));
    let bassEnergy = 0;
    for (let i = bassStart; i < bassEnd && i < bufferLength; i++) {
        bassEnergy += dataArray[i];
    }
    bassEnergy /= (bassEnd - bassStart);
    
    // Beat detection with threshold
    const threshold = 100;
    const now = performance.now();
    
    if (bassEnergy > threshold && (now - lastBeatTime) > 200) {
        const interval = now - lastBeatTime;
        if (lastBeatTime > 0 && interval > 150 && interval < 1500) {
            beatIntervals.push(interval);
            if (beatIntervals.length > 8) beatIntervals.shift();
            
            // Calculate BPM
            if (beatIntervals.length >= 2) {
                const avgInterval = beatIntervals.reduce((a, b) => a + b, 0) / beatIntervals.length;
                const bpm = Math.round(60000 / avgInterval);
                
                if (bpm >= 40 && bpm <= 300) {
                    detectedBpm = bpm;
                    updateBpmDisplay(bpm);
                }
            }
        }
        lastBeatTime = now;
    }
    
    // Draw visualization
    drawBeatViz(dataArray, bufferLength);
    
    beatDetectionLoop = requestAnimationFrame(runBeatDetectionLoop);
}

function drawBeatViz(dataArray, bufferLength) {
    const canvas = document.getElementById('beatVizCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = canvas.width / 32;
    for (let i = 0; i < 32; i++) {
        const value = dataArray[i * 4] || 0;
        const height = (value / 255) * canvas.height;
        ctx.fillStyle = `rgb(${100 + value * 0.5}, ${150 + value * 0.3}, ${200})`;
        ctx.fillRect(i * barWidth, canvas.height - height, barWidth - 1, height);
    }
}

function updateBpmDisplay(bpm) {
    const display = document.getElementById('detectedBpmDisplay');
    if (display) {
        display.textContent = bpm;
        display.classList.add('text-green-400');
        setTimeout(() => display.classList.remove('text-green-400'), 500);
    }
    
    // Auto-update tempo if enabled
    if (enabled && localAppServices.setTempo) {
        localAppServices.setTempo(bpm);
    }
}

function updateBeatIndicator(active) {
    const indicator = document.getElementById('beatIndicator');
    if (indicator) {
        if (active) {
            indicator.classList.add('animate-pulse', 'bg-green-500');
            indicator.classList.remove('bg-gray-600');
        } else {
            indicator.classList.remove('animate-pulse', 'bg-green-500');
            indicator.classList.add('bg-gray-600');
        }
    }
}

export function getAutoBeatSyncState() {
    return {
        enabled,
        isAnalyzing,
        detectedBpm
    };
}

export function isAutoBeatSyncEnabled() {
    return enabled;
}

export function getDetectedBpm() {
    return detectedBpm;
}

console.log('[AutoBeatSync] Module loaded');