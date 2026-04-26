// js/BPMDetector.js - Real-time BPM Detection
// Detect tempo from audio input using onset detection

let localAppServices = {};
let analyserNode = null;
let audioContext = null;
let isDetecting = false;
let lastOnsets = [];
let currentBPM = 0;
let confidence = 0;
let rafId = null;

const ONSET_THRESHOLD = 0.15;
const MIN_INTERVAL = 0.25; // Max BPM ~240
const MAX_INTERVAL = 2.0;  // Min BPM ~30
const HISTORY_SIZE = 16;

export function initBPMDetector(appServices) {
    localAppServices = appServices || {};
    console.log('[BPMDetector] Initialized');
}

function setupAudioAnalysis() {
    if (analyserNode) return;
    
    try {
        if (typeof Tone !== 'undefined' && Tone.getContext) {
            audioContext = Tone.getContext().rawContext;
        } else if (typeof AudioContext !== 'undefined') {
            audioContext = new AudioContext();
        }
        
        if (audioContext) {
            analyserNode = audioContext.createAnalyser();
            analyserNode.fftSize = 2048;
            analyserNode.smoothingTimeConstant = 0.3;
        }
    } catch (e) {
        console.warn('[BPMDetector] Failed to setup audio:', e);
    }
}

export function startBPMDetection() {
    if (isDetecting) return;
    
    setupAudioAnalysis();
    if (!analyserNode) {
        console.warn('[BPMDetector] No analyser available');
        return;
    }
    
    isDetecting = true;
    lastOnsets = [];
    currentBPM = 0;
    confidence = 0;
    
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let prevEnergy = 0;
    
    function detect() {
        if (!isDetecting) return;
        
        analyserNode.getByteFrequencyData(dataArray);
        
        // Sum low frequency energy (bass drum detection)
        let energy = 0;
        const bassEnd = Math.floor(bufferLength * 0.1);
        for (let i = 0; i < bassEnd; i++) {
            energy += dataArray[i];
        }
        energy /= bassEnd * 255;
        
        const now = audioContext.currentTime;
        
        // Onset detection: energy spike
        if (energy > ONSET_THRESHOLD && energy > prevEnergy * 1.2) {
            if (lastOnsets.length > 0) {
                const lastOnset = lastOnsets[lastOnsets.length - 1];
                const interval = now - lastOnset;
                
                if (interval > MIN_INTERVAL && interval < MAX_INTERVAL) {
                    lastOnsets.push(now);
                    if (lastOnsets.length > HISTORY_SIZE) {
                        lastOnsets.shift();
                    }
                    calculateBPM();
                } else if (interval >= MAX_INTERVAL) {
                    lastOnsets = [now];
                }
            } else {
                lastOnsets.push(now);
            }
        }
        
        prevEnergy = energy;
        rafId = requestAnimationFrame(detect);
    }
    
    detect();
    console.log('[BPMDetector] Detection started');
}

export function stopBPMDetection() {
    isDetecting = false;
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    console.log('[BPMDetector] Detection stopped');
}

function calculateBPM() {
    if (lastOnsets.length < 3) return;
    
    const intervals = [];
    for (let i = 1; i < lastOnsets.length; i++) {
        intervals.push(lastOnsets[i] - lastOnsets[i - 1]);
    }
    
    // Median interval to avoid outliers
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    
    if (medianInterval > 0) {
        const bpm = 60 / medianInterval;
        
        // Sanity check: 60-200 BPM range is typical for music
        if (bpm >= 60 && bpm <= 200) {
            currentBPM = Math.round(bpm * 10) / 10;
            
            // Calculate confidence based on interval consistency
            const variance = intervals.reduce((sum, int) => {
                return sum + Math.pow(int - medianInterval, 2);
            }, 0) / intervals.length;
            const stdDev = Math.sqrt(variance);
            confidence = Math.max(0, 1 - (stdDev / medianInterval));
            
            updateUI();
        }
    }
}

function updateUI() {
    const displayEl = document.getElementById('bpmDisplay');
    const barEl = document.getElementById('bpmConfidenceBar');
    
    if (displayEl) {
        displayEl.textContent = currentBPM > 0 ? currentBPM.toFixed(1) : '--.-';
    }
    
    if (barEl && confidence > 0) {
        barEl.style.width = `${confidence * 100}%`;
        barEl.title = `Confidence: ${Math.round(confidence * 100)}%`;
    }
}

export function getDetectedBPM() {
    return { bpm: currentBPM, confidence };
}

export function isActive() {
    return isDetecting;
}

export function openBPMDetectorPanel() {
    const windowId = 'bpmDetector';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'bpmDetectorContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 select-none';
    
    contentContainer.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-white mb-1">BPM Detector</h3>
            <p class="text-sm text-gray-400">Tap or play a rhythm to detect tempo</p>
        </div>
        
        <div class="mb-4 p-4 bg-gray-800 rounded border border-gray-700 text-center">
            <div class="text-5xl font-bold text-blue-400" id="bpmDisplay">--.-</div>
            <div class="text-sm text-gray-500 mt-1">BPM</div>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-300">Confidence</span>
                <span class="text-sm text-gray-400" id="bpmConfidenceValue">--</span>
            </div>
            <div class="w-full h-2 bg-gray-700 rounded overflow-hidden">
                <div id="bpmConfidenceBar" class="h-full bg-green-500 transition-all duration-300" style="width: 0%"></div>
            </div>
        </div>
        
        <div class="flex-1"></div>
        
        <div class="flex gap-2">
            <button id="bpmStartBtn" class="flex-1 px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-500">
                Start
            </button>
            <button id="bpmStopBtn" class="flex-1 px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-500" disabled>
                Stop
            </button>
        </div>
        
        <button id="bpmTapBtn" class="mt-3 w-full px-4 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-500">
            Tap Tempo
        </button>
        
        <div class="mt-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-500">
                <strong>Tips:</strong>
                <ul class="mt-1 space-y-1">
                    <li>• Play audio with a clear beat for auto-detection</li>
                    <li>• Use Tap Tempo for manual tempo entry</li>
                    <li>• Tap the button in rhythm to set tempo</li>
                </ul>
            </div>
        </div>
    `;
    
    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'BPM Detector', contentContainer, {
        width: 320,
        height: 400,
        minWidth: 280,
        minHeight: 350,
        closable: true,
        minimizable: true,
        resizable: true
    }) : null;
    
    setTimeout(() => {
        const startBtn = document.getElementById('bpmStartBtn');
        const stopBtn = document.getElementById('bpmStopBtn');
        const tapBtn = document.getElementById('bpmTapBtn');
        
        startBtn?.addEventListener('click', () => {
            startBPMDetection();
            startBtn.disabled = true;
            stopBtn.disabled = false;
        });
        
        stopBtn?.addEventListener('click', () => {
            stopBPMDetection();
            startBtn.disabled = false;
            stopBtn.disabled = true;
        });
        
        // Tap tempo
        let tapTimes = [];
        const TAP_TIMEOUT = 2000;
        
        tapBtn?.addEventListener('click', () => {
            const now = Date.now();
            
            if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_TIMEOUT) {
                tapTimes = [];
            }
            
            tapTimes.push(now);
            
            if (tapTimes.length > 1) {
                const intervals = [];
                for (let i = 1; i < tapTimes.length; i++) {
                    intervals.push(tapTimes[i] - tapTimes[i - 1]);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                currentBPM = Math.round((60000 / avgInterval) * 10) / 10;
                confidence = 1;
                updateUI();
                
                document.getElementById('bpmConfidenceValue').textContent = '100% (Manual)';
            }
            
            if (tapTimes.length > 8) {
                tapTimes = tapTimes.slice(-8);
            }
        });
        
        updateUI();
    }, 50);
    
    return win;
}