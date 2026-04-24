/**
 * Tremoloauto - Tempo-synced tremolo that locks to project BPM
 * Automatically syncs LFO frequency to musical note values based on tempo
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
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 460,
        height: 540,
        minWidth: 380,
        minHeight: 480,
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

    const win = localAppServices.createWindow(windowId, 'Tremolo Auto', contentContainer, options);
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

    const syncOptions = [
        { value: '1n', label: 'Whole (1n)' },
        { value: '2n', label: 'Half (2n)' },
        { value: '4n', label: 'Quarter (4n)' },
        { value: '8n', label: 'Eighth (8n)' },
        { value: '16n', label: 'Sixteenth (16n)' },
        { value: '32n', label: 'Thirty-second (32n)' },
        { value: '4t', label: 'Quarter Triplet (4t)' },
        { value: '8t', label: 'Eighth Triplet (8t)' },
        { value: '16t', label: 'Sixteenth Triplet (16t)' }
    ];

    let html = `
        <div class="mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Tempo-synced tremolo that automatically locks to your project BPM and note subdivisions.
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Sync Note Value</label>
            <select id="tremoloautoSyncNote" onchange="updateTremoloautoFrequency()" 
                    class="w-full p-2 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 text-sm">
                ${syncOptions.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
            </select>
        </div>
        
        <div class="mb-4 p-3 bg-gray-200 dark:bg-slate-700 rounded">
            <div class="flex justify-between items-center">
                <span class="text-sm text-gray-700 dark:text-gray-200">Current LFO Rate:</span>
                <span id="tremoloautoFreqDisplay" class="text-lg font-bold text-blue-500">3.00 Hz</span>
            </div>
            <div class="flex justify-between items-center mt-1">
                <span class="text-xs text-gray-500">At BPM:</span>
                <span id="tremoloautoBpmDisplay" class="text-sm text-gray-600 dark:text-gray-300">120</span>
            </div>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Depth: <span id="tremoloautoDepthValue">70</span>%</label>
            <input type="range" id="tremoloautoDepth" min="0" max="100" value="70" step="1"
                   class="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded appearance-none cursor-pointer"
                   oninput="updateTremoloautoDepth()">
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Waveform</label>
            <select id="tremoloautoType" onchange="updateTremoloautoWaveform()" 
                    class="w-full p-2 border rounded bg-white dark:bg-slate-700 dark:border-slate-600 text-sm">
                <option value="sine">Sine</option>
                <option value="square">Square</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="triangle">Triangle</option>
            </select>
        </div>
        
        <div class="mb-4 flex gap-2">
            <button id="tremoloautoToggle" onclick="toggleTremoloauto()" 
                    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors">
                Enable Tremolo
            </button>
            <button onclick="testTremoloautoLFO()" 
                    class="px-4 py-2 bg-gray-300 dark:bg-slate-600 rounded hover:bg-gray-400 dark:hover:bg-slate-500 text-sm transition-colors">
                Test LFO
            </button>
        </div>
        
        <div class="mt-4 p-3 bg-gray-200 dark:bg-slate-700 rounded">
            <h4 class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Quick Presets</h4>
            <div class="grid grid-cols-3 gap-2">
                <button onclick="setTremoloautoPreset('16t')" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 rounded text-xs hover:bg-gray-400 dark:hover:bg-slate-500">16th Trip</button>
                <button onclick="setTremoloautoPreset('8t')" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 rounded text-xs hover:bg-gray-400 dark:hover:bg-slate-500">8th Trip</button>
                <button onclick="setTremoloautoPreset('8n')" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 rounded text-xs hover:bg-gray-400 dark:hover:bg-slate-500">8th Note</button>
                <button onclick="setTremoloautoPreset('4t')" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 rounded text-xs hover:bg-gray-400 dark:hover:bg-slate-500">Quarter Trip</button>
                <button onclick="setTremoloautoPreset('4n')" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 rounded text-xs hover:bg-gray-400 dark:hover:bg-slate-500">Quarter</button>
                <button onclick="setTremoloautoPreset('2n')" class="px-2 py-1 bg-gray-300 dark:bg-slate-600 rounded text-xs hover:bg-gray-400 dark:hover:bg-slate-500">Half Note</button>
            </div>
        </div>
        
        <div class="mt-4 border-t border-gray-300 dark:border-slate-600 pt-4">
            <h4 class="text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">Note Values Reference</h4>
            <div class="text-xs text-gray-500 dark:text-gray-400 font-mono space-y-1">
                <div>Whole (1n) = 4 beats | Half (2n) = 2 beats | Quarter (4n) = 1 beat</div>
                <div>Eighth (8n) = 1/2 beat | 16th (16n) = 1/4 beat | 32nd (32n) = 1/8 beat</div>
                <div>Triplets divide a beat into 3 equal parts</div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    // Initial frequency calculation
    setTimeout(() => updateTremoloautoFrequency(), 100);
}

// Global state
let tremoloautoActive = false;
let tremoloautoDepth = 0.7;
let tremoloautoWaveform = 'sine';
let tremoloautoSyncNote = '8n';

// Note duration lookup (in beats)
const noteDurations = {
    '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125,
    '4t': 2/3, '8t': 1/3, '16t': 0.125/1.5
};

/**
 * Get current BPM from app services or default
 */
function getCurrentBPM() {
    // Try to get BPM from localAppServices
    if (localAppServices.getTempo) {
        return localAppServices.getTempo();
    }
    return 120; // Default BPM
}

/**
 * Calculate LFO frequency from BPM and note value
 */
function calculateFrequency(bpm, noteValue) {
    const beats = noteDurations[noteValue] || 1;
    const beatsPerSecond = bpm / 60;
    return beatsPerSecond * beats;
}

/**
 * Update frequency display
 */
function updateTremoloautoFrequency() {
    const bpm = getCurrentBPM();
    const noteValue = document.getElementById('tremoloautoSyncNote')?.value || '8n';
    const freq = calculateFrequency(bpm, noteValue);
    
    const freqDisplay = document.getElementById('tremoloautoFreqDisplay');
    const bpmDisplay = document.getElementById('tremoloautoBpmDisplay');
    
    if (freqDisplay) freqDisplay.textContent = `${freq.toFixed(2)} Hz`;
    if (bpmDisplay) bpmDisplay.textContent = bpm;
}

/**
 * Update depth display
 */
function updateTremoloautoDepth() {
    const depth = document.getElementById('tremoloautoDepth')?.value || 70;
    const depthDisplay = document.getElementById('tremoloautoDepthValue');
    if (depthDisplay) depthDisplay.textContent = depth;
    tremoloautoDepth = depth / 100;
}

/**
 * Update waveform
 */
function updateTremoloautoWaveform() {
    tremoloautoWaveform = document.getElementById('tremoloautoType')?.value || 'sine';
}

/**
 * Toggle tremolo on/off
 */
function toggleTremoloauto() {
    const toggleBtn = document.getElementById('tremoloautoToggle');
    
    tremoloautoActive = !tremoloautoActive;
    
    if (tremoloautoActive) {
        toggleBtn.textContent = 'Disable Tremolo';
        toggleBtn.className = 'px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-sm font-medium transition-colors';
        localAppServices.showSafeNotification?.('Tremolo enabled - synced to BPM', 2000);
    } else {
        toggleBtn.textContent = 'Enable Tremolo';
        toggleBtn.className = 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors';
        localAppServices.showSafeNotification?.('Tremolo disabled.', 1500);
    }
}

/**
 * Set preset note value
 */
function setTremoloautoPreset(noteValue) {
    const select = document.getElementById('tremoloautoSyncNote');
    if (select) {
        select.value = noteValue;
        tremoloautoSyncNote = noteValue;
        updateTremoloautoFrequency();
    }
}

/**
 * Test LFO modulation
 */
function testTremoloautoLFO() {
    const bpm = getCurrentBPM();
    const noteValue = document.getElementById('tremoloautoSyncNote')?.value || '8n';
    const freq = calculateFrequency(bpm, noteValue);
    const depth = document.getElementById('tremoloautoDepth')?.value || 70;
    const waveform = document.getElementById('tremoloautoType')?.value || 'sine';
    
    localAppServices.showSafeNotification?.(`Test: ${freq.toFixed(2)}Hz, ${depth}% depth, ${waveform} wave`, 2000);
}

// Make functions globally accessible
window.toggleTremoloauto = toggleTremoloauto;
window.updateTremoloautoFrequency = updateTremoloautoFrequency;
window.updateTremoloautoDepth = updateTremoloautoDepth;
window.updateTremoloautoWaveform = updateTremoloautoWaveform;
window.setTremoloautoPreset = setTremoloautoPreset;
window.testTremoloautoLFO = testTremoloautoLFO;

class TremoloautoEngine {
    constructor() {
        this.isActive = false;
        this.syncNote = '8n';
        this.depth = 0.7;
        this.waveform = 'sine';
        this.bpm = 120;
        this.toneNode = null;
    }

    getFrequency() {
        return calculateFrequency(this.bpm, this.syncNote);
    }

    setSyncNote(note) {
        this.syncNote = note;
    }

    setDepth(depth) {
        this.depth = Math.max(0, Math.min(1, depth));
    }

    setWaveform(type) {
        this.waveform = type;
    }

    setBPM(bpm) {
        this.bpm = Math.max(20, Math.min(300, bpm));
    }

    setActive(active) {
        this.isActive = active;
    }
}

export { TremoloautoEngine };
export const tremoloEngine = new TremoloautoEngine();