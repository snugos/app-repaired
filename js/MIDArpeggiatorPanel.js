// js/MIDArpeggiatorPanel.js - MIDI Arpeggiator Panel for SnugOS DAW
// Feature: Visual arpeggiator with pattern editing and direction controls

let localAppServices = {};
let arpeggiatorState = {
    enabled: false,
    rate: '1/4', // 1/4, 1/8, 1/16, 1/32
    octaveRange: 1,
    direction: 'up', // 'up', 'down', 'updown', 'random', 'order'
    pattern: [], // Array of note offsets
    gate: 0.8, // 0-1, note length percentage
    hold: false,
    lastInputNotes: [],
    arpeggioIndex: 0,
    scheduledNotes: []
};

export function initMIDArpeggiatorPanel(services) {
    localAppServices = services;
    console.log('[MIDArpeggiatorPanel] Initialized');
}

/**
 * Opens the MIDI Arpeggiator panel
 */
export function openMIDArpeggiatorPanel(savedState = null) {
    const windowId = 'midiArpeggiator';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderArpeggiatorContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'arpeggiatorContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-900 text-white';

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

    const win = localAppServices.createWindow(windowId, 'MIDI Arpeggiator', contentContainer, options);
    
    if (win?.element) {
        renderArpeggiatorContent();
    }
    
    return win;
}

/**
 * Renders the arpeggiator panel content
 */
function renderArpeggiatorContent() {
    const container = document.getElementById('arpeggiatorContent');
    if (!container) return;

    const rateOptions = ['1/32', '1/16', '1/8', '1/4', '1/2', '1'];
    const directionOptions = [
        { value: 'up', label: '↑ Up' },
        { value: 'down', label: '↓ Down' },
        { value: 'updown', label: '↕ Up-Down' },
        { value: 'random', label: '⚡ Random' },
        { value: 'order', label: '→ As Played' }
    ];

    container.innerHTML = `
        <div class="space-y-4">
            <!-- Enable/Disable -->
            <div class="flex items-center justify-between p-3 bg-gray-800 rounded">
                <span class="text-sm font-medium">Arpeggiator</span>
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="arpEnabled" ${arpeggiatorState.enabled ? 'checked' : ''} 
                           class="w-5 h-5 accent-green-500">
                    <span class="text-sm">${arpeggiatorState.enabled ? 'ON' : 'OFF'}</span>
                </label>
            </div>

            <!-- Rate and Octave -->
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-gray-800 rounded p-3">
                    <label class="block text-xs text-gray-400 mb-2">Rate</label>
                    <select id="arpRate" class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
                        ${rateOptions.map(r => `<option value="${r}" ${arpeggiatorState.rate === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                </div>
                <div class="bg-gray-800 rounded p-3">
                    <label class="block text-xs text-gray-400 mb-2">Octave Range</label>
                    <select id="arpOctave" class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
                        ${[1, 2, 3, 4].map(o => `<option value="${o}" ${arpeggiatorState.octaveRange === o ? 'selected' : ''}>${o} Octave${o > 1 ? 's' : ''}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Direction -->
            <div class="bg-gray-800 rounded p-3">
                <label class="block text-xs text-gray-400 mb-2">Direction</label>
                <div class="grid grid-cols-5 gap-2">
                    ${directionOptions.map(d => `
                        <button class="arp-dir-btn px-2 py-2 rounded text-sm font-medium transition-colors ${arpeggiatorState.direction === d.value ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}" 
                                data-dir="${d.value}">${d.label}</button>
                    `).join('')}
                </div>
            </div>

            <!-- Gate -->
            <div class="bg-gray-800 rounded p-3">
                <div class="flex items-center justify-between mb-2">
                    <label class="text-xs text-gray-400">Gate (Note Length)</label>
                    <span id="arpGateValue" class="text-sm text-green-400">${Math.round(arpeggiatorState.gate * 100)}%</span>
                </div>
                <input type="range" id="arpGate" min="10" max="100" value="${Math.round(arpeggiatorState.gate * 100)}" 
                       class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
            </div>

            <!-- Hold -->
            <div class="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div>
                    <span class="text-sm font-medium">Hold Notes</span>
                    <p class="text-xs text-gray-500">Continue arpeggio after releasing keys</p>
                </div>
                <label class="flex items-center cursor-pointer">
                    <input type="checkbox" id="arpHold" ${arpeggiatorState.hold ? 'checked' : ''} 
                           class="w-5 h-5 accent-green-500">
                </label>
            </div>

            <!-- Arpeggio Preview -->
            <div class="bg-gray-800 rounded p-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs text-gray-400">Arpeggio Pattern</span>
                    <button id="arpClearBtn" class="px-2 py-1 text-xs bg-red-600/30 hover:bg-red-600/50 rounded text-red-300">Clear</button>
                </div>
                <div id="arpPatternDisplay" class="flex flex-wrap gap-1 min-h-[40px] p-2 bg-gray-900 rounded">
                    ${arpeggiatorState.pattern.length === 0 ? 
                        '<span class="text-xs text-gray-600">Play notes to build pattern...</span>' :
                        arpeggiatorState.pattern.map((note, i) => `
                            <div class="arp-note px-2 py-1 bg-green-700/50 rounded text-xs font-mono" data-index="${i}">
                                ${note.name || note.note}
                            </div>
                        `).join('')
                    }
                </div>
            </div>

            <!-- Status -->
            <div class="flex items-center justify-between text-xs text-gray-500 border-t border-gray-700 pt-3">
                <span>Mode: ${arpeggiatorState.direction}</span>
                <span>Notes: ${arpeggiatorState.pattern.length}</span>
            </div>
        </div>
    `;

    setupArpeggiatorEvents();
}

/**
 * Sets up event handlers for the arpeggiator panel
 */
function setupArpeggiatorEvents() {
    const container = document.getElementById('arpeggiatorContent');
    if (!container) return;

    // Enable toggle
    const enabledCb = container.querySelector('#arpEnabled');
    if (enabledCb) {
        enabledCb.addEventListener('change', (e) => {
            arpeggiatorState.enabled = e.target.checked;
            const label = enabledCb.nextElementSibling;
            if (label) label.textContent = arpeggiatorState.enabled ? 'ON' : 'OFF';
            localAppServices.showNotification?.(`Arpeggiator ${arpeggiatorState.enabled ? 'enabled' : 'disabled'}`, 1000);
        });
    }

    // Rate select
    const rateSelect = container.querySelector('#arpRate');
    if (rateSelect) {
        rateSelect.addEventListener('change', (e) => {
            arpeggiatorState.rate = e.target.value;
        });
    }

    // Octave select
    const octaveSelect = container.querySelector('#arpOctave');
    if (octaveSelect) {
        octaveSelect.addEventListener('change', (e) => {
            arpeggiatorState.octaveRange = parseInt(e.target.value, 10);
        });
    }

    // Direction buttons
    container.querySelectorAll('.arp-dir-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dir = e.target.dataset.dir || e.target.closest('.arp-dir-btn').dataset.dir;
            arpeggiatorState.direction = dir;
            renderArpeggiatorContent();
        });
    });

    // Gate slider
    const gateSlider = container.querySelector('#arpGate');
    const gateValue = container.querySelector('#arpGateValue');
    if (gateSlider && gateValue) {
        gateSlider.addEventListener('input', (e) => {
            arpeggiatorState.gate = parseInt(e.target.value, 10) / 100;
            gateValue.textContent = `${Math.round(arpeggiatorState.gate * 100)}%`;
        });
    }

    // Hold toggle
    const holdCb = container.querySelector('#arpHold');
    if (holdCb) {
        holdCb.addEventListener('change', (e) => {
            arpeggiatorState.hold = e.target.checked;
        });
    }

    // Clear button
    const clearBtn = container.querySelector('#arpClearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            arpeggiatorState.pattern = [];
            arpeggiatorState.lastInputNotes = [];
            renderArpeggiatorContent();
        });
    }
}

/**
 * Process incoming MIDI notes for arpeggiator
 * @param {Array} notes - Array of {note, velocity, time} objects
 * @param {Function} triggerNote - Callback to trigger a note
 * @param {Function} releaseNote - Callback to release a note
 */
export function processArpeggiatorNotes(notes, triggerNote, releaseNote) {
    if (!arpeggiatorState.enabled || notes.length === 0) {
        // Pass through without arpeggio
        return;
    }

    // Add notes to pattern
    notes.forEach(n => {
        if (!arpeggiatorState.pattern.find(p => p.note === n.note)) {
            arpeggiatorState.pattern.push({ note: n.note, velocity: n.velocity || 0.8 });
        }
    });
    arpeggiatorState.lastInputNotes = notes.slice();

    // Update panel if open
    const container = document.getElementById('arpeggiatorContent');
    if (container) {
        renderArpeggiatorContent();
    }
}

/**
 * Get current arpeggiator state
 */
export function getArpeggiatorState() {
    return { ...arpeggiatorState };
}

/**
 * Set arpeggiator state
 */
export function setArpeggiatorState(state) {
    Object.assign(arpeggiatorState, state);
}

/**
 * Update the panel display
 */
export function updateArpeggiatorPanel() {
    const container = document.getElementById('arpeggiatorContent');
    if (container) {
        renderArpeggiatorContent();
    }
}

console.log('[MIDArpeggiatorPanel] Module loaded');