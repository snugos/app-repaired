// js/PhaseCorrelationMeter.js - Stereo Phase Correlation Meter
// Real-time display of stereo phase correlation (-1 to +1)

let localAppServices = {};
let analyserLeft = null;
let analyserRight = null;
let splitterNode = null;
let mergerNode = null;
let rafId = null;
let isConnected = false;
let correlationHistory = [];
const HISTORY_SIZE = 128;

// Mid-side gain nodes
let midGain = null;
let sideGain = null;

export function initPhaseCorrelationMeter(appServices) {
    localAppServices = appServices || {};
    console.log('[PhaseCorrelationMeter] Initialized');
}

function getAudioContext() {
    if (typeof Tone !== 'undefined' && Tone.getContext) {
        return Tone.getContext().rawContext;
    }
    if (window.audioContext) return window.audioContext;
    if (typeof AudioContext !== 'undefined') {
        window.audioContext = new AudioContext();
        return window.audioContext;
    }
    return null;
}

function connectToMaster() {
    if (isConnected) return;
    
    const ctx = getAudioContext();
    if (!ctx) {
        console.warn('[PhaseCorrelationMeter] No audio context available');
        return;
    }

    try {
        // Create mid-side splitter
        splitterNode = ctx.createChannelSplitter(2);
        mergerNode = ctx.createChannelMerger(2);
        
        // Gains for mid and side calculation
        midGain = ctx.createGain();
        sideGain = ctx.createGain();
        
        // Create analysers for L and R
        analyserLeft = ctx.createAnalyser();
        analyserRight = ctx.createAnalyser();
        analyserLeft.fftSize = 256;
        analyserRight.fftSize = 256;
        
        // Connect master output to our analysis chain
        // We'll use a MediaElementSource or ScriptProcessor if available
        // For now, use the destination
        const dest = ctx.destination;
        
        // Try to get master output from Tone.js
        if (typeof Tone !== 'undefined' && Tone.getDestination) {
            try {
                const toneDest = Tone.getDestination();
                toneDest.connect(splitterNode);
                isConnected = true;
                console.log('[PhaseCorrelationMeter] Connected to Tone.js destination');
                return;
            } catch(e) {
                console.warn('[PhaseCorrelationMeter] Could not connect to Tone.js:', e);
            }
        }
        
        // Connect to raw context destination
        dest.connect(splitterNode);
        isConnected = true;
        console.log('[PhaseCorrelationMeter] Connected to audio context destination');
        
    } catch(e) {
        console.error('[PhaseCorrelationMeter] Connection error:', e);
    }
}

function calculateCorrelation() {
    if (!analyserLeft || !analyserRight) return 0;
    
    const leftData = new Uint8Array(analyserLeft.frequencyBinCount);
    const rightData = new Uint8Array(analyserRight.frequencyBinCount);
    
    analyserLeft.getByteFrequencyData(leftData);
    analyserRight.getByteFrequencyData(rightData);
    
    // Calculate RMS values
    let sumLeft = 0, sumRight = 0, sumProduct = 0;
    let n = leftData.length;
    
    for (let i = 0; i < n; i++) {
        const L = (leftData[i] / 255) * 2 - 1;
        const R = (rightData[i] / 255) * 2 - 1;
        sumLeft += L * L;
        sumRight += R * R;
        sumProduct += L * R;
    }
    
    const denom = Math.sqrt(sumLeft * sumRight);
    if (denom < 0.0001) return 1; // Both silent = correlated
    
    const correlation = sumProduct / denom;
    return Math.max(-1, Math.min(1, correlation));
}

function getCorrelationLabel(value) {
    if (value >= 0.75) return { text: 'EXCELLENT', color: '#22c55e', desc: 'Mono compatible' };
    if (value >= 0.5) return { text: 'GOOD', color: '#84cc16', desc: 'Slight spread' };
    if (value >= 0.25) return { text: 'MODERATE', color: '#eab308', desc: 'Check phase' };
    if (value >= 0) return { text: 'WEAK', color: '#f97316', desc: 'Phase issues' };
    if (value >= -0.5) return { text: 'POOR', color: '#ef4444', desc: 'Severe issues' };
    return { text: 'OUT OF PHASE', color: '#dc2626', desc: 'Dangerous!' };
}

function openPanel(savedState = null) {
    const windowId = 'phaseCorrelationMeter';
    const getOpenWindows = localAppServices.getOpenWindows || (() => new Map());
    const openWindows = getOpenWindows();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        startMeterLoop();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'phaseCorrContent';
    contentContainer.className = 'p-4 flex flex-col h-full bg-gray-900 dark:bg-slate-900';

    const options = {
        width: 380,
        height: 280,
        minWidth: 300,
        minHeight: 220,
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

    const win = localAppServices.createWindow(windowId, 'Phase Correlation', contentContainer, options);
    
    if (win?.element) {
        connectToMaster();
        renderPanel();
        startMeterLoop();
    }
    
    return win;
}

function renderPanel() {
    const container = document.getElementById('phaseCorrContent');
    if (!container) return;

    const html = `
        <div class="flex items-center justify-between mb-3">
            <div class="text-xs text-gray-400">Stereo Phase Correlation</div>
            <div class="flex items-center gap-2">
                <div id="corrValue" class="text-2xl font-bold text-green-500">+1.00</div>
                <div id="corrLabel" class="px-2 py-0.5 rounded text-xs font-bold bg-green-500 text-white">EXCELLENT</div>
            </div>
        </div>
        
        <!-- Main Correlation Gauge -->
        <div class="relative mb-3">
            <div class="h-8 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-yellow-400 to-red-500 relative overflow-hidden">
                <div id="corrNeedle" class="absolute top-0 w-0.5 h-full bg-white shadow-lg transition-all duration-75"
                     style="left: 50%; transform: translateX(-50%);">
                    <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow"></div>
                </div>
            </div>
            <div class="flex justify-between mt-1 px-1">
                <span class="text-xs text-red-400">-1</span>
                <span class="text-xs text-yellow-400">0</span>
                <span class="text-xs text-green-400">+1</span>
            </div>
        </div>
        
        <!-- Correlation Bar Graph (History) -->
        <div class="mb-3">
            <div class="text-xs text-gray-500 mb-1">History</div>
            <div id="corrHistory" class="flex items-end gap-px h-16 bg-gray-800 rounded p-1 overflow-hidden">
                ${Array(HISTORY_SIZE).fill('<div class="flex-1 bg-green-500 rounded-sm transition-all duration-50" style="height: 50%"></div>').join('')}
            </div>
        </div>
        
        <!-- Phase Info -->
        <div class="grid grid-cols-3 gap-2 text-center">
            <div class="p-2 bg-gray-800 rounded">
                <div class="text-xs text-gray-500">Mono Sum</div>
                <div id="monoLevel" class="text-lg font-bold text-blue-400">0%</div>
            </div>
            <div class="p-2 bg-gray-800 rounded">
                <div class="text-xs text-gray-500">Side Level</div>
                <div id="sideLevel" class="text-lg font-bold text-purple-400">0%</div>
            </div>
            <div class="p-2 bg-gray-800 rounded">
                <div class="text-xs text-gray-500">Stereo Width</div>
                <div id="stereoWidth" class="text-lg font-bold text-cyan-400">0%</div>
            </div>
        </div>
        
        <!-- Description -->
        <div id="corrDesc" class="mt-2 text-center text-xs text-gray-400">
            Excellent mono compatibility
        </div>
    `;

    container.innerHTML = html;
}

function startMeterLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    
    function update() {
        const container = document.getElementById('phaseCorrContent');
        if (!container) {
            rafId = null;
            return;
        }
        
        const corrValue = calculateCorrelation();
        
        // Update history
        correlationHistory.push(corrValue);
        if (correlationHistory.length > HISTORY_SIZE) {
            correlationHistory.shift();
        }
        
        // Update UI
        const valueEl = container.querySelector('#corrValue');
        const labelEl = container.querySelector('#corrLabel');
        const needleEl = container.querySelector('#corrNeedle');
        const historyEl = container.querySelector('#corrHistory');
        const descEl = container.querySelector('#corrDesc');
        const monoEl = container.querySelector('#monoLevel');
        const sideEl = container.querySelector('#sideLevel');
        const widthEl = container.querySelector('#stereoWidth');
        
        if (valueEl) {
            valueEl.textContent = (corrValue >= 0 ? '+' : '') + corrValue.toFixed(2);
            valueEl.className = `text-2xl font-bold`;
            if (corrValue >= 0.75) valueEl.classList.add('text-green-500');
            else if (corrValue >= 0.25) valueEl.classList.add('text-yellow-500');
            else if (corrValue >= 0) valueEl.classList.add('text-orange-500');
            else valueEl.classList.add('text-red-500');
        }
        
        if (labelEl) {
            const info = getCorrelationLabel(corrValue);
            labelEl.textContent = info.text;
            labelEl.style.backgroundColor = info.color;
        }
        
        if (needleEl) {
            // Map -1..+1 to 0..100%
            const pct = ((corrValue + 1) / 2) * 100;
            needleEl.style.left = `${pct}%`;
        }
        
        if (historyEl) {
            const bars = historyEl.querySelectorAll('div');
            bars.forEach((bar, i) => {
                const idx = i;
                const val = correlationHistory[idx] !== undefined ? correlationHistory[idx] : 0;
                const heightPct = ((val + 1) / 2) * 100;
                bar.style.height = `${Math.max(5, heightPct)}%`;
                
                if (val >= 0.75) bar.style.backgroundColor = '#22c55e';
                else if (val >= 0.5) bar.style.backgroundColor = '#84cc16';
                else if (val >= 0.25) bar.style.backgroundColor = '#eab308';
                else if (val >= 0) bar.style.backgroundColor = '#f97316';
                else bar.style.backgroundColor = '#ef4444';
            });
        }
        
        if (descEl) {
            const info = getCorrelationLabel(corrValue);
            descEl.textContent = info.desc;
        }
        
        if (monoEl) {
            // Approximate mono level from correlation
            const mono = Math.round((1 + corrValue) * 50);
            monoEl.textContent = `${mono}%`;
        }
        
        if (sideEl) {
            const side = Math.round((1 - corrValue) * 50);
            sideEl.textContent = `${side}%`;
        }
        
        if (widthEl) {
            const width = Math.round(Math.abs(corrValue) * 100);
            widthEl.textContent = `${width}%`;
        }
        
        rafId = requestAnimationFrame(update);
    }
    
    rafId = requestAnimationFrame(update);
}

export function openPhaseCorrelationMeterPanel(savedState) {
    return openPanel(savedState);
}

export function closePhaseCorrelationMeterPanel() {
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
}
