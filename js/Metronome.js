// js/Metronome.js - Metronome with audio click and visual beat indication
// Provides a simple metronome with adjustable tempo, time signature, and audio/visual feedback

let metronomeInterval = null;
let currentBeat = 0;
let isRunning = false;

// Audio context for click sounds (lazy init)
let audioContext = null;

function getAudioContext() {
    if (!audioContext && typeof AudioContext !== 'undefined') {
        audioContext = new AudioContext();
    }
    return audioContext;
}

// Generate a click sound using Tone.js if available, otherwise Web Audio
export function playClick(accent = false) {
    try {
        if (typeof Tone !== 'undefined') {
            const osc = new Tone.Oscillator(accent ? 1000 : 800, "sine").toDestination();
            const env = new Tone.AmplitudeEnvelope().release;
            osc.start();
            osc.stop(Tone.now() + 0.05);
        } else {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = accent ? 1000 : 800;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.05);
        }
    } catch (e) {
        // Silently fail if audio not available
    }
}

function tick() {
    const settings = getMetronomeSettings();
    const totalBeats = settings.numerator;
    
    currentBeat = (currentBeat % totalBeats) + 1;
    const isAccent = currentBeat === 1;
    
    if (settings.audioEnabled) {
        playClick(isAccent);
    }
    
    updateVisualBeat(currentBeat, isAccent, totalBeats);
    
    if (settings.cpuSaver && typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => {}, { timeout: 5 });
    }
}

function updateVisualBeat(beat, isAccent, total) {
    const indicator = document.getElementById('metronomeBeatIndicator');
    if (!indicator) return;
    
    indicator.innerHTML = '';
    for (let i = 1; i <= total; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${i === beat ? (isAccent ? '#ef4444' : '#f97316') : '#374151'};
            box-shadow: ${i === beat ? (isAccent ? '0 0 8px #ef4444' : '0 0 8px #f97316') : 'none'};
            transition: all 0.1s ease;
        `;
        indicator.appendChild(dot);
    }
}

function getMetronomeSettings() {
    const globalState = window.state || {};
    return {
        bpm: globalState.metronomeBPM || 120,
        numerator: globalState.metronomeTimeSigTop || 4,
        denominator: globalState.metronomeTimeSigBottom || 4,
        audioEnabled: globalState.metronomeAudioEnabled !== false,
        visualEnabled: globalState.metronomeVisualEnabled !== false,
        cpuSaver: globalState.metronomeCpuSaver || false,
    };
}

export function startMetronome() {
    if (isRunning) return;
    
    const settings = getMetronomeSettings();
    const intervalMs = (60 / settings.bpm) * 1000;
    
    isRunning = true;
    currentBeat = 0;
    
    // Immediate first tick
    tick();
    
    metronomeInterval = setInterval(tick, intervalMs);
    updateMetronomeUI(true);
}

export function stopMetronome() {
    if (!isRunning) return;
    
    isRunning = false;
    if (metronomeInterval) {
        clearInterval(metronomeInterval);
        metronomeInterval = null;
    }
    updateMetronomeUI(false);
}

export function toggleMetronome() {
    if (isRunning) {
        stopMetronome();
    } else {
        startMetronome();
    }
    return isRunning;
}

export function setMetronomeBPM(bpm) {
    bpm = Math.max(20, Math.min(300, bpm));
    if (window.state) window.state.metronomeBPM = bpm;
    
    if (isRunning) {
        stopMetronome();
        startMetronome();
    }
}

export function setMetronomeTimeSignature(top, bottom) {
    if (window.state) {
        window.state.metronomeTimeSigTop = top;
        window.state.metronomeTimeSigBottom = bottom;
    }
    if (isRunning) {
        stopMetronome();
        startMetronome();
    }
}

function updateMetronomeUI(running) {
    const btn = document.getElementById('metronomeToggle');
    const indicator = document.getElementById('metronomeBeatIndicator');
    if (btn) {
        btn.textContent = running ? 'Stop' : 'Start';
        btn.className = running 
            ? 'px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded'
            : 'px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded';
    }
}

/**
 * Opens the Metronome panel window.
 */
export function openMetronomePanel(savedState = null) {
    const windowId = 'metronome';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderMetronomeContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'metronomeContent';
    contentContainer.className = 'p-4 h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-slate-800';

    const options = { width: 300, height: 280, minWidth: 250, minHeight: 220, initialContentKey: windowId, closable: true, minimizable: true, resizable: false };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    const win = localAppServices.createWindow(windowId, 'Metronome', contentContainer, options);
    if (win?.element) {
        renderMetronomeContent();
    }
    return win;
}

function renderMetronomeContent() {
    const container = document.getElementById('metronomeContent');
    if (!container) return;
    
    const settings = getMetronomeSettings();
    const bpm = settings.bpm;
    const top = settings.numerator;
    const bottom = settings.denominator;
    
    container.innerHTML = `
        <div class="flex flex-col items-center gap-4 w-full">
            <div id="metronomeBeatIndicator" class="flex items-center justify-center gap-2 p-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm min-h-[40px] w-full">
            </div>
            
            <div class="text-center">
                <div id="metronomeBPMDisplay" class="text-4xl font-bold text-gray-800 dark:text-white">${bpm}</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">BPM</div>
            </div>
            
            <div class="flex items-center gap-3">
                <button id="metronomeMinus10" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500 rounded text-sm">-10</button>
                <button id="metronomeMinus1" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500 rounded text-sm">-1</button>
                <button id="metronomeBPMInput" class="px-3 py-1 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded text-sm font-mono">${bpm}</button>
                <button id="metronomePlus1" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500 rounded text-sm">+1</button>
                <button id="metronomePlus10" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500 rounded text-sm">+10</button>
            </div>
            
            <div class="flex items-center gap-2">
                <label class="text-xs text-gray-600 dark:text-gray-300">Time Sig:</label>
                <select id="metronomeTimeSigTop" class="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-sm">
                    ${[2,3,4,5,6,7,8,9,12].map(n => `<option value="${n}" ${n === top ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
                <span class="text-gray-500">/</span>
                <select id="metronomeTimeSigBottom" class="px-2 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-sm">
                    ${[2,4,8,16].map(n => `<option value="${n}" ${n === bottom ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
            </div>
            
            <div class="flex items-center gap-3">
                <button id="metronomeToggle" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded shadow-sm">
                    Start
                </button>
                <button id="metronomeTap" class="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded shadow-sm">
                    Tap
                </button>
            </div>
            
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="metronomeAudioEnabled" ${settings.audioEnabled ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                <span class="text-xs text-gray-600 dark:text-gray-300">Audio Click</span>
            </label>
        </div>
    `;
    
    // Attach event listeners
    document.getElementById('metronomeToggle')?.addEventListener('click', () => {
        toggleMetronome();
        renderMetronomeContent();
    });
    
    document.getElementById('metronomeMinus10')?.addEventListener('click', () => {
        setMetronomeBPM(bpm - 10);
        renderMetronomeContent();
    });
    
    document.getElementById('metronomeMinus1')?.addEventListener('click', () => {
        setMetronomeBPM(bpm - 1);
        renderMetronomeContent();
    });
    
    document.getElementById('metronomePlus1')?.addEventListener('click', () => {
        setMetronomeBPM(bpm + 1);
        renderMetronomeContent();
    });
    
    document.getElementById('metronomePlus10')?.addEventListener('click', () => {
        setMetronomeBPM(bpm + 10);
        renderMetronomeContent();
    });
    
    document.getElementById('metronomeTimeSigTop')?.addEventListener('change', (e) => {
        setMetronomeTimeSignature(parseInt(e.target.value), bottom);
    });
    
    document.getElementById('metronomeTimeSigBottom')?.addEventListener('change', (e) => {
        setMetronomeTimeSignature(top, parseInt(e.target.value));
    });
    
    document.getElementById('metronomeAudioEnabled')?.addEventListener('change', (e) => {
        if (window.state) window.state.metronomeAudioEnabled = e.target.checked;
    });
    
    // Tap tempo
    let tapTimes = [];
    document.getElementById('metronomeTap')?.addEventListener('click', () => {
        const now = Date.now();
        tapTimes.push(now);
        if (tapTimes.length > 4) tapTimes.shift();
        if (tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < tapTimes.length; i++) {
                intervals.push(tapTimes[i] - tapTimes[i-1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            const newBPM = Math.round(60000 / avgInterval);
            if (newBPM >= 20 && newBPM <= 300) {
                setMetronomeBPM(newBPM);
                renderMetronomeContent();
            }
        }
    });
}

// Auto-initialize visual beats on first render
setTimeout(() => {
    updateVisualBeat(0, false, getMetronomeSettings().numerator);
}, 100);