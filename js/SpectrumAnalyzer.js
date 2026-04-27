// js/SpectrumAnalyzer.js - Real-time FFT Spectrum Analyzer
// Displays frequency spectrum of audio using AnalyserNode

let analyserNode = null;
let analyserData = null;
let animationId = null;
let isActive = false;
let currentSource = null;
let localAppServices = typeof window !== 'undefined' && window.localAppServices ? window.localAppServices : {};
let canvasElement = null;
let canvasCtx = null;
let rafId = null;

// Frequency bands labels
const FREQ_LABELS = ['20', '60', '150', '300', '600', '1k', '3k', '6k', '12k', '20k'];
const BAR_COLORS = [
    '#22c55e', '#4ade80', '#86efac', // low (green)
    '#eab308', '#facc15', '#fde047', // mid (yellow)
    '#f97316', '#fb923c', '#fdba74', // high (orange)
    '#ef4444', '#f87171'  // very high (red)
];

export function initSpectrumAnalyzer(appServices) {
    localAppServices = appServices || {};
    console.log('[SpectrumAnalyzer] Initialized');
}

function getAnalyserContext() {
    if (typeof Tone === 'undefined' || !Tone.getContext) {
        // Fallback to Web Audio API
        if (!window.audioContext && typeof AudioContext !== 'undefined') {
            window.audioContext = new AudioContext();
        }
        return window.audioContext;
    }
    return Tone.getContext().rawContext;
}

function createAnalyser() {
    const ctx = getAnalyserContext();
    if (!ctx) return null;
    
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;
    analyserData = new Uint8Array(analyserNode.frequencyBinCount);
    
    return analyserNode;
}

function connectToMaster() {
    if (!analyserNode) return;
    
    // Disconnect previous source
    if (currentSource) {
        try { currentSource.disconnect(analyserNode); } catch(e) {}
    }
    
    // Try to connect Tone.js master output
    if (typeof Tone !== 'undefined' && Tone.getDestination) {
        try {
            const dest = Tone.getDestination();
            dest.connect(analyserNode);
            currentSource = dest;
            return;
        } catch(e) {}
    }
    
    // Connect to Web Audio destination
    try {
        analyserNode.connect(getAnalyserContext().destination);
        currentSource = getAnalyserContext().destination;
    } catch(e) {}
}

export function openSpectrumAnalyzerPanel(savedState = null) {
    const windowId = 'spectrumAnalyzer';
    const getOpenWindows = localAppServices.getOpenWindows || (() => new Map());
    const openWindows = getOpenWindows();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderSpectrumContent();
        startAnimation();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'spectrumContent';
    contentContainer.className = 'p-3 flex flex-col h-full bg-gray-900 dark:bg-slate-900';

    const options = {
        width: 480, height: 320, minWidth: 400, minHeight: 280,
        initialContentKey: windowId, closable: true, minimizable: true, resizable: true
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

    const createWindowFn = localAppServices.createWindow || window.createWindow;
    if (!createWindowFn) {
        console.error('[SpectrumAnalyzer] createWindow not available');
        return null;
    }

    const win = createWindowFn(windowId, 'Spectrum Analyzer', contentContainer, options);
    if (win?.element) {
        renderSpectrumContent();
        startAnimation();
    }
    return win;
}

function renderSpectrumContent() {
    const container = document.getElementById('spectrumContent');
    if (!container) return;

    container.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">FFT</span>
                <select id="spectrumFftSize" class="bg-gray-700 text-white text-xs px-2 py-1 rounded">
                    <option value="128">128</option>
                    <option value="256" selected>256</option>
                    <option value="512">512</option>
                    <option value="1024">1024</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">Smoothing</span>
                <input type="range" id="spectrumSmoothing" min="0" max="95" value="80" class="w-20">
            </div>
        </div>
        <canvas id="spectrumCanvas" class="w-full flex-1 rounded bg-black/50" style="min-height:200px"></canvas>
        <div id="spectrumFreqLabels" class="flex justify-between mt-1 px-1">
            ${FREQ_LABELS.map((f, i) => `<span class="text-[9px] text-gray-500" style="color:${BAR_COLORS[i % BAR_COLORS.length]}">${f}</span>`).join('')}
        </div>
    `;

    canvasElement = document.getElementById('spectrumCanvas');
    if (canvasElement) {
        canvasCtx = canvasElement.getContext('2d');
        resizeCanvas();
    }

    // Event listeners
    const fftSelect = document.getElementById('spectrumFftSize');
    if (fftSelect) {
        fftSelect.addEventListener('change', (e) => {
            if (analyserNode) {
                analyserNode.fftSize = parseInt(e.target.value);
                analyserData = new Uint8Array(analyserNode.frequencyBinCount);
            }
        });
    }

    const smoothingSlider = document.getElementById('spectrumSmoothing');
    if (smoothingSlider) {
        smoothingSlider.addEventListener('input', (e) => {
            if (analyserNode) {
                analyserNode.smoothingTimeConstant = parseInt(e.target.value) / 100;
            }
        });
    }
}

function resizeCanvas() {
    if (canvasElement && canvasElement.parentElement) {
        canvasElement.width = canvasElement.parentElement.clientWidth - 24;
        canvasElement.height = canvasElement.parentElement.clientHeight - 60;
    }
}

function startAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
    isActive = true;
    
    if (!analyserNode) {
        createAnalyser();
        connectToMaster();
    }
    
    animate();
}

function stopAnimation() {
    isActive = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function animate() {
    if (!isActive || !analyserNode || !analyserData || !canvasCtx || !canvasElement) {
        animationId = requestAnimationFrame(animate);
        return;
    }

    analyserNode.getByteFrequencyData(analyserData);
    
    const width = canvasElement.width;
    const height = canvasElement.height;
    
    // Clear
    canvasCtx.fillStyle = 'rgba(0,0,0,0.3)';
    canvasCtx.fillRect(0, 0, width, height);
    
    // Draw spectrum bars
    const barCount = FREQ_LABELS.length;
    const barWidth = width / barCount - 2;
    const binStep = Math.floor(analyserData.length / barCount);
    
    for (let i = 0; i < barCount; i++) {
        // Average bins for this frequency band
        let sum = 0;
        for (let j = 0; j < binStep; j++) {
            sum += analyserData[i * binStep + j] || 0;
        }
        const value = sum / binStep;
        const barHeight = (value / 255) * height;
        
        const x = i * (barWidth + 2);
        const y = height - barHeight;
        
        // Gradient color based on frequency
        canvasCtx.fillStyle = BAR_COLORS[i % BAR_COLORS.length];
        
        // Draw bar with glow
        canvasCtx.shadowColor = BAR_COLORS[i % BAR_COLORS.length];
        canvasCtx.shadowBlur = 8;
        canvasCtx.fillRect(x, y, barWidth, barHeight);
        canvasCtx.shadowBlur = 0;
        
        // Peak indicator
        if (barHeight > 10) {
            canvasCtx.fillStyle = '#ffffff';
            canvasCtx.fillRect(x, y - 2, barWidth, 2);
        }
    }
    
    // Grid lines
    canvasCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    canvasCtx.lineWidth = 1;
    for (let y = 0; y < height; y += height / 4) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, y);
        canvasCtx.lineTo(width, y);
        canvasCtx.stroke();
    }
    
    animationId = requestAnimationFrame(animate);
}

export function getSpectrumData() {
    if (!analyserNode || !analyserData) return null;
    return Array.from(analyserData);
}

export function closeSpectrumPanel() {
    stopAnimation();
}

window.addEventListener('resize', () => {
    if (canvasElement) resizeCanvas();
});