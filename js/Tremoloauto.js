/**
 * Tremoloauto - Tempo-synced tremolo that locks to project BPM
 * A tremolo effect that automatically syncs to the DAW's tempo
 */

let localAppServices = {};

/**
 * Initialize Tremoloauto with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initTremoloauto(appServices) {
    localAppServices = appServices || {};
    console.log('[Tremoloauto] Initialized');
}

/**
 * Opens the Tremoloauto panel
 * @param {Object} savedState - Optional saved window state
 */
export function openTremoloautoPanel(savedState = null) {
    const windowId = 'tremoloauto';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTremoloautoContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tremoloautoContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 420,
        height: 480,
        minWidth: 360,
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

    const win = localAppServices.createWindow(windowId, 'Tremoloauto', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderTremoloautoContent(), 50);
    }
    return win;
}

/**
 * Render the Tremoloauto panel content
 */
function renderTremoloautoContent() {
    const container = document.getElementById('tremoloautoContent');
    if (!container) return;

    const tracks = localAppServices.getTracks?.() || [];
    const trackOptions = tracks.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    let html = `
        <div class="mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Tempo-synced tremolo that automatically locks to project BPM.
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Target Track</label>
            <select id="tremoloautoTrack" class="w-full p-2 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 text-sm">
                <option value="">-- Select Track --</option>
                ${trackOptions}
            </select>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Sync Rate</label>
            <select id="tremoloautoRate" class="w-full p-2 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 text-sm">
                <option value="1">1 Bar</option>
                <option value="0.5">1/2 Bar</option>
                <option value="0.25">1/4 Bar</option>
                <option value="0.125">1/8 Bar</option>
                <option value="0.0625">1/16 Bar</option>
                <option value="2">2 Bars</option>
                <option value="4">4 Bars</option>
            </select>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Depth: <span id="tremoloautoDepthValue">50</span>%</label>
            <input type="range" id="tremoloautoDepth" min="0" max="100" value="50" step="1"
                   class="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded appearance-none cursor-pointer"
                   oninput="document.getElementById('tremoloautoDepthValue').textContent = this.value">
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Waveform</label>
            <select id="tremoloautoWave" class="w-full p-2 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 text-sm">
                <option value="sine">Sine</option>
                <option value="triangle">Triangle</option>
                <option value="square">Square</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="ramp">Ramp Down</option>
            </select>
        </div>
        
        <div class="mb-4">
            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" id="tremoloautoSyncPhase" checked class="w-4 h-4">
                Sync Phase to Bar Start
            </label>
        </div>
        
        <div class="mb-4">
            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" id="tremoloautoEnabled" class="w-4 h-4">
                Enable Tremoloauto
            </label>
        </div>
        
        <div class="mb-4 flex gap-2">
            <button id="tremoloautoToggle" onclick="toggleTremoloauto()" 
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors">
                Apply
            </button>
            <button onclick="previewTremoloauto()" 
                    class="px-4 py-2 bg-gray-300 dark:bg-slate-600 rounded hover:bg-gray-400 dark:hover:bg-slate-500 text-sm transition-colors">
                Preview
            </button>
            <button onclick="bypassTremoloauto()" 
                    class="px-4 py-2 bg-gray-300 dark:bg-slate-600 rounded hover:bg-gray-400 dark:hover:bg-slate-500 text-sm transition-colors">
                Bypass
            </button>
        </div>
        
        <div class="mt-4 p-3 bg-gray-200 dark:bg-slate-700 rounded">
            <h4 class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Current BPM</h4>
            <div id="tremoloautoBpmDisplay" class="text-2xl font-bold text-center text-blue-600 dark:text-blue-400">
                ${localAppServices.getTempo ? localAppServices.getTempo().toFixed(1) : '120.0'} BPM
            </div>
        </div>
        
        <div class="mt-4 p-3 bg-gray-200 dark:bg-slate-700 rounded">
            <h4 class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Sync Info</h4>
            <div id="tremoloautoSyncInfo" class="text-xs text-gray-600 dark:text-gray-300 font-mono">
                Not synced
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Global state for Tremoloauto
let tremoloautoState = {
    enabled: false,
    trackId: null,
    rate: 1, // bars
    depth: 50,
    waveform: 'sine',
    syncPhase: true,
    toneNode: null
};

/**
 * Toggle tremoloauto on/off
 */
function toggleTremoloauto() {
    const trackId = document.getElementById('tremoloautoTrack')?.value;
    const enabled = document.getElementById('tremoloautoEnabled')?.checked;
    const toggleBtn = document.getElementById('tremoloautoToggle');
    
    if (!trackId) {
        localAppServices.showSafeNotification?.('Please select a track first.', 2000);
        return;
    }
    
    tremoloautoState.enabled = enabled;
    tremoloautoState.trackId = parseInt(trackId, 10);
    tremoloautoState.rate = parseFloat(document.getElementById('tremoloautoRate')?.value || '1');
    tremoloautoState.depth = parseFloat(document.getElementById('tremoloautoDepth')?.value || '50');
    tremoloautoState.waveform = document.getElementById('tremoloautoWave')?.value || 'sine';
    tremoloautoState.syncPhase = document.getElementById('tremoloautoSyncPhase')?.checked || true;
    
    if (enabled) {
        applyTremoloauto();
        toggleBtn.textContent = 'Remove';
        toggleBtn.className = 'px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium transition-colors';
        localAppServices.showSafeNotification?.('Tremoloauto applied to track.', 2000);
    } else {
        removeTremoloauto();
        toggleBtn.textContent = 'Apply';
        toggleBtn.className = 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors';
        localAppServices.showSafeNotification?.('Tremoloauto removed.', 2000);
    }
}

/**
 * Apply tremoloauto effect to track
 */
function applyTremoloauto() {
    if (!tremoloautoState.trackId || !tremoloautoState.enabled) return;
    
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === tremoloautoState.trackId);
    if (!track) return;
    
    // Create tremolo LFO
    const lfo = new Tone.LFO({
        frequency: getTremoloFrequency(),
        min: 0,
        max: 1,
        type: tremoloautoState.waveform
    });
    
    // Create gain for modulation (0 = full, 1 = silent at trough)
    const tremoloGain = new Tone.Gain(1);
    
    // Connect LFO to gain modulation
    // At LFO=0: no modulation (full volume)
    // At LFO=1: full modulation (depth applies)
    const depthMult = tremoloautoState.depth / 100;
    lfo.connect(tremoloGain.gain);
    
    // We need a second gain node to actually do the tremolo effect
    // The LFO will modulate the volume between (1-depth) and 1
    const baseGain = 1 - depthMult;
    tremoloGain.gain.value = baseGain;
    
    // Actually for a proper tremolo, we need to modulate the track's gain
    // Find the track's output gain node and insert our modulation
    if (track.gainNode && !track.gainNode.disposed) {
        // Store original gain
        const originalGain = track.gainNode.gain.value;
        
        // Create modulation gain
        const modGain = new Tone.Gain(originalGain);
        
        // LFO modulates the modGain value
        lfo.connect(modGain.gain);
        
        // Connect track output through modGain to destination
        track.gainNode.connect(modGain);
        modGain.connect(Tone.Destination);
        
        // Start LFO
        lfo.start();
        
        tremoloautoState.toneNode = { lfo, modGain };
    }
    
    updateSyncInfo();
}

/**
 * Remove tremoloauto effect
 */
function removeTremoloauto() {
    if (tremoloautoState.toneNode) {
        const { lfo, modGain } = tremoloautoState.toneNode;
        if (lfo && !lfo.disposed) lfo.stop();
        if (modGain && !modGain.disposed) modGain.dispose();
        tremoloautoState.toneNode = null;
    }
    updateSyncInfo();
}

/**
 * Get tremolo frequency based on rate and BPM
 */
function getTremoloFrequency() {
    const bpm = localAppServices.getTempo?.() || 120;
    const beatsPerBar = 4;
    const bars = tremoloautoState.rate;
    
    // Frequency = BPM / (60 * bars)
    const freq = (bpm / 60) / bars;
    return freq;
}

/**
 * Preview tremolo effect
 */
function previewTremoloauto() {
    const bpm = localAppServices.getTempo?.() || 120;
    const rate = parseFloat(document.getElementById('tremoloautoRate')?.value || '1');
    const freq = (bpm / 60) / rate;
    
    const previewGain = new Tone.Gain(0.5).toDestination();
    const previewLfo = new Tone.LFO({
        frequency: freq,
        min: 0,
        max: 1,
        type: document.getElementById('tremoloautoWave')?.value || 'sine'
    });
    
    previewLfo.connect(previewGain.gain);
    previewLfo.start();
    
    // Play a note through
    const synth = new Tone.Synth().connect(previewGain);
    synth.triggerAttackRelease('C4', '2n');
    
    // Stop after 2 seconds
    setTimeout(() => {
        previewLfo.stop();
        previewLfo.dispose();
        previewGain.dispose();
        synth.dispose();
    }, 2000);
    
    localAppServices.showSafeNotification?.(`Preview: ${freq.toFixed(2)} Hz tremolo`, 1500);
}

/**
 * Bypass tremolo (pass-through without effect)
 */
function bypassTremoloauto() {
    removeTremoloauto();
    const toggleBtn = document.getElementById('tremoloautoToggle');
    toggleBtn.textContent = 'Apply';
    toggleBtn.className = 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors';
    document.getElementById('tremoloautoEnabled').checked = false;
    tremoloautoState.enabled = false;
    localAppServices.showSafeNotification?.('Tremoloauto bypassed.', 1500);
}

/**
 * Update sync info display
 */
function updateSyncInfo() {
    const infoEl = document.getElementById('tremoloautoSyncInfo');
    const bpmEl = document.getElementById('tremoloautoBpmDisplay');
    if (!infoEl || !bpmEl) return;
    
    const bpm = localAppServices.getTempo?.() || 120;
    bpmEl.textContent = `${bpm.toFixed(1)} BPM`;
    
    if (tremoloautoState.enabled && tremoloautoState.toneNode) {
        const freq = getTremoloFrequency();
        const periodMs = (1000 / freq).toFixed(1);
        infoEl.innerHTML = `
            <div class="text-green-500">Synced to BPM</div>
            <div>Rate: ${tremoloautoState.rate} bar(s)</div>
            <div>Frequency: ${freq.toFixed(4)} Hz</div>
            <div>Period: ${periodMs} ms</div>
        `;
    } else {
        infoEl.textContent = 'Not synced';
    }
}

// Make functions globally accessible
window.toggleTremoloauto = toggleTremoloauto;
window.previewTremoloauto = previewTremoloauto;
window.bypassTremoloauto = bypassTremoloauto;

/**
 * TremoloautoEngine - Core engine class
 */
export class TremoloautoEngine {
    constructor() {
        this.enabled = false;
        this.rate = 1; // bars
        this.depth = 50;
        this.waveform = 'sine';
        this.syncPhase = true;
        this.trackId = null;
    }
    
    /**
     * Set the rate in bars
     */
    setRate(bars) {
        this.rate = Math.max(0.0625, Math.min(8, bars));
    }
    
    /**
     * Set tremolo depth (0-100)
     */
    setDepth(depth) {
        this.depth = Math.max(0, Math.min(100, depth));
    }
    
    /**
     * Set waveform type
     */
    setWaveform(type) {
        this.waveform = type;
    }
    
    /**
     * Get current frequency based on BPM
     */
    getFrequency(bpm) {
        const beatsPerBar = 4;
        return (bpm / 60) / this.rate;
    }
}

/**
 * Get the TremoloautoEngine singleton
 */
export const tremoloautoEngine = new TremoloautoEngine();