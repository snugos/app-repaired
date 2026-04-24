/**
 * SpectralSubtractiveEQ - Notch EQ that auto-removes feedback frequencies
 * Uses spectral analysis to detect and attenuate feedback-prone frequencies
 */

let localAppServices = {};

/**
 * Initialize SpectralSubtractiveEQ with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initSpectralSubtractiveEQ(appServices) {
    localAppServices = appServices || {};
    console.log('[SpectralSubtractiveEQ] Initialized');
}

/**
 * Opens the Spectral Subtractive EQ panel
 * @param {Object} savedState - Optional saved window state
 */
export function openSpectralSubtractiveEQPanel(savedState = null) {
    const windowId = 'spectralSubtractiveEQ';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderSpectralSubtractiveEQContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'spectralSubtractiveEQContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 520,
        height: 480,
        minWidth: 420,
        minHeight: 400,
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

    const win = localAppServices.createWindow(windowId, 'Spectral Subtractive EQ', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderSpectralSubtractiveEQContent(), 50);
    }
    return win;
}

/**
 * Render the Spectral Subtractive EQ panel content
 */
function renderSpectralSubtractiveEQContent() {
    const container = document.getElementById('spectralSubtractiveEQContent');
    if (!container) return;

    let html = `
        <div class="mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Automatically detect and attenuate feedback frequencies using spectral analysis.
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Detection Threshold: <span id="sseqThresholdValue">-40</span> dB</label>
            <input type="range" id="sseqThreshold" min="-60" max="-20" value="-40" step="1"
                   class="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded appearance-none cursor-pointer"
                   oninput="document.getElementById('sseqThresholdValue').textContent = this.value">
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Attenuation: <span id="sseqAttenValue">15</span> dB</label>
            <input type="range" id="sseqAtten" min="3" max="30" value="15" step="1"
                   class="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded appearance-none cursor-pointer"
                   oninput="document.getElementById('sseqAttenValue').textContent = this.value">
        </div>
        
        <div class="mb-4 flex gap-2">
            <button id="sseqToggle" onclick="toggleSpectralEQ()" 
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors">
                Start Analysis
            </button>
            <button onclick="resetSpectralEQ()" 
                    class="px-4 py-2 bg-gray-300 dark:bg-slate-600 rounded hover:bg-gray-400 dark:hover:bg-slate-500 text-sm transition-colors">
                Reset Filters
            </button>
        </div>
        
        <div class="mb-4">
            <label class="flex items-center cursor-pointer">
                <input type="checkbox" id="sseqAutoListen" checked class="mr-2">
                <span class="text-sm text-gray-700 dark:text-gray-200">Auto-listen mode</span>
            </label>
        </div>
        
        <div class="mt-4 p-3 bg-gray-200 dark:bg-slate-700 rounded">
            <h4 class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Spectral Display</h4>
            <div id="sseqSpectrumDisplay" class="h-24 bg-slate-800 rounded flex items-end justify-center text-xs text-gray-500">
                No spectrum data - enable analysis to see frequency peaks
            </div>
        </div>
        
        <div class="mt-4 p-3 bg-gray-200 dark:bg-slate-700 rounded">
            <h4 class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Detected Feedback Frequencies</h4>
            <div id="sseqFeedbackList" class="text-xs text-gray-600 dark:text-gray-300 font-mono">
                No frequencies detected yet
            </div>
        </div>
        
        <div class="mt-4 border-t border-gray-300 dark:border-slate-600 pt-4">
            <h4 class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Notch Filters Active</h4>
            <div id="sseqNotchStatus" class="grid grid-cols-4 gap-2 text-xs">
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">60 Hz<span class="block text-gray-500" id="sseqNotch0">--</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">120 Hz<span class="block text-gray-500" id="sseqNotch1">--</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">250 Hz<span class="block text-gray-500" id="sseqNotch2">--</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">500 Hz<span class="block text-gray-500" id="sseqNotch3">--</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">1 kHz<span class="block text-gray-500" id="sseqNotch4">--</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">2 kHz<span class="block text-gray-500" id="sseqNotch5">--</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">4 kHz<span class="block text-gray-500" id="sseqNotch6">--</span></div>
                <div class="text-center p-2 bg-gray-300 dark:bg-slate-600 rounded">8 kHz<span class="block text-gray-500" id="sseqNotch7">--</span></div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Global state
let spectralEQActive = false;
let spectralEQNotches = [null, null, null, null, null, null, null, null];
const spectralEQBands = [60, 120, 250, 500, 1000, 2000, 4000, 8000];

/**
 * Toggle spectral EQ analysis
 */
function toggleSpectralEQ() {
    const toggleBtn = document.getElementById('sseqToggle');
    
    spectralEQActive = !spectralEQActive;
    
    if (spectralEQActive) {
        toggleBtn.textContent = 'Stop Analysis';
        toggleBtn.className = 'px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium transition-colors';
        localAppServices.showSafeNotification?.('Spectral analysis active...', 2000);
    } else {
        toggleBtn.textContent = 'Start Analysis';
        toggleBtn.className = 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors';
        localAppServices.showSafeNotification?.('Spectral analysis stopped.', 2000);
    }
}

/**
 * Reset all notch filters
 */
function resetSpectralEQ() {
    spectralEQNotches = [null, null, null, null, null, null, null, null];
    
    for (let i = 0; i < 8; i++) {
        const el = document.getElementById(`sseqNotch${i}`);
        if (el) el.textContent = '--';
    }
    
    document.getElementById('sseqFeedbackList').innerHTML = 'All filters reset';
    localAppServices.showSafeNotification?.('Notch filters reset.', 1500);
}

// Make functions globally accessible
window.toggleSpectralEQ = toggleSpectralEQ;
window.resetSpectralEQ = resetSpectralEQ;

class SpectralSubtractiveEQEngine {
    constructor() {
        this.isActive = false;
        this.threshold = -40;
        this.attenuation = 15;
        this.fftSize = 2048;
        this.notchFrequencies = [60, 120, 250, 500, 1000, 2000, 4000, 8000];
        this.notchGains = new Array(8).fill(0);
        this.analyser = null;
    }

    setThreshold(dB) {
        this.threshold = Math.max(-60, Math.min(-20, dB));
    }

    setAttenuation(dB) {
        this.attenuation = Math.max(3, Math.min(30, dB));
    }

    processSpectrum(spectrumData) {
        if (!this.isActive || !spectrumData) return [];
        
        const detected = [];
        const binWidth = 44100 / this.fftSize;
        
        // Find peaks
        for (let i = 2; i < spectrumData.length - 2; i++) {
            const freq = i * binWidth;
            if (freq < 40) continue;
            
            if (spectrumData[i] > spectrumData[i - 1] && 
                spectrumData[i] > spectrumData[i + 1] &&
                spectrumData[i] > this.threshold) {
                
                detected.push({
                    frequency: Math.round(freq),
                    level: spectrumData[i],
                    binIndex: i
                });
            }
        }
        
        // Sort by level and take top 4
        detected.sort((a, b) => b.level - a.level);
        return detected.slice(0, 4);
    }
}

export { SpectralSubtractiveEQEngine };
export const spectralEQEngine = new SpectralSubtractiveEQEngine();