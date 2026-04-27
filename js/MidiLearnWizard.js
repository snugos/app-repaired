// js/MidiLearnWizard.js - MIDI Learn Wizard for mapping CC controllers to parameters
let localAppServices = {};
let midiMappings = {}; // { mappingId: { cc, channel, targetParam, targetValue, min, max } }
let isMidiLearnMode = false;
let midiLearnTargetParam = null;
let pendingMappings = []; // CC messages received during learn mode awaiting confirmation

export function initMidiLearnWizard(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    console.log('[MidiLearnWizard] Initialized');
}

export function isMidiLearnModeActive() {
    return isMidiLearnMode;
}

export function getMidiLearnTarget() {
    return midiLearnTargetParam;
}

/**
 * Enter MIDI learn mode for a specific parameter
 * @param {string} paramPath - The parameter path (e.g., "track.0.volume")
 */
export function enterMidiLearnMode(paramPath) {
    isMidiLearnMode = true;
    midiLearnTargetParam = paramPath;
    pendingMappings = [];
    console.log(`[MidiLearnWizard] Learn mode active for: ${paramPath}`);
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification('MIDI Learn: Move a CC knob to map it. Press ESC to cancel.', 3000);
    }
    
    return true;
}

/**
 * Exit MIDI learn mode
 */
export function exitMidiLearnMode() {
    isMidiLearnMode = false;
    midiLearnTargetParam = null;
    pendingMappings = [];
    console.log('[MidiLearnWizard] Learn mode exited');
}

/**
 * Handle a MIDI CC message during learn mode
 * @param {number} ccNumber - CC number (0-127)
 * @param {number} channel - MIDI channel (0-15)
 * @param {number} value - CC value (0-127)
 */
export function handleMidiCCDuringLearn(ccNumber, channel, value) {
    if (!isMidiLearnMode || !midiLearnTargetParam) return false;
    
    // Store the mapping
    const mappingId = `cc_${ccNumber}_ch_${channel}`;
    
    // Check if this mapping already exists
    if (midiMappings[mappingId]) {
        // Update existing mapping
        midiMappings[mappingId].targetParam = midiLearnTargetParam;
        console.log(`[MidiLearnWizard] Updated existing mapping: CC${ccNumber} Ch${channel} → ${midiLearnTargetParam}`);
    } else {
        // Create new mapping
        midiMappings[mappingId] = {
            id: mappingId,
            cc: ccNumber,
            channel: channel,
            targetParam: midiLearnTargetParam,
            min: 0,
            max: 127,
            value: value
        };
        console.log(`[MidiLearnWizard] Created new mapping: CC${ccNumber} Ch${channel} → ${midiLearnTargetParam}`);
    }
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Mapped CC${ccNumber} Ch${channel} → ${midiLearnTargetParam}`, 2000);
    }
    
    exitMidiLearnMode();
    return true;
}

/**
 * Apply a MIDI CC value to a mapped parameter
 * @param {number} ccNumber - CC number (0-127)
 * @param {number} channel - MIDI channel (0-15)
 * @param {number} value - CC value (0-127)
 */
export function applyMidiCCMapping(ccNumber, channel, value) {
    const mappingId = `cc_${ccNumber}_ch_${channel}`;
    const mapping = midiMappings[mappingId];
    
    if (!mapping) return false;
    
    // Map the CC value (0-127) to the parameter range
    const normalizedValue = value / 127;
    const paramValue = mapping.min + normalizedValue * (mapping.max - mapping.min);
    
    // Apply to the parameter
    if (localAppServices.applyParameterByPath) {
        localAppServices.applyParameterByPath(mapping.targetParam, paramValue);
    }
    
    return true;
}

/**
 * Get all current MIDI mappings
 */
export function getMidiMappings() {
    return JSON.parse(JSON.stringify(midiMappings));
}

/**
 * Get a specific mapping by ID
 */
export function getMidiMapping(mappingId) {
    return midiMappings[mappingId] ? { ...midiMappings[mappingId] } : null;
}

/**
 * Remove a MIDI mapping
 */
export function removeMidiMapping(mappingId) {
    if (midiMappings[mappingId]) {
        delete midiMappings[mappingId];
        console.log(`[MidiLearnWizard] Removed mapping: ${mappingId}`);
        return true;
    }
    return false;
}

/**
 * Clear all MIDI mappings
 */
export function clearAllMidiMappings() {
    midiMappings = {};
    console.log('[MidiLearnWizard] Cleared all mappings');
}

/**
 * Export mappings for project save
 */
export function exportMidiMappingsForProject() {
    return Object.values(midiMappings).map(m => ({
        cc: m.cc,
        channel: m.channel,
        targetParam: m.targetParam,
        min: m.min,
        max: m.max
    }));
}

/**
 * Import mappings from project load
 */
export function importMidiMappingsFromProject(mappings) {
    if (!Array.isArray(mappings)) return;
    
    midiMappings = {};
    mappings.forEach(m => {
        const mappingId = `cc_${m.cc}_ch_${m.channel}`;
        midiMappings[mappingId] = {
            id: mappingId,
            cc: m.cc,
            channel: m.channel,
            targetParam: m.targetParam,
            min: m.min || 0,
            max: m.max || 127,
            value: 0
        };
    });
    console.log(`[MidiLearnWizard] Imported ${mappings.length} MIDI mappings`);
}

/**
 * Open the MIDI Learn Wizard panel
 */
export function openMidiLearnWizardPanel(savedState = null) {
    const windowId = 'midiLearnWizard';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderMidiLearnContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'midiLearnContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = { width: 500, height: 450, minWidth: 400, minHeight: 350, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    if (localAppServices.createWindow) {
        const win = localAppServices.createWindow(windowId, 'MIDI Learn Wizard', contentContainer, options);
        if (win?.element) {
            renderMidiLearnContent();
        }
        return win;
    }
    return null;
}

function renderMidiLearnContent() {
    const container = document.getElementById('midiLearnContent');
    if (!container) return;

    const mappingsList = Object.values(midiMappings);
    const learnModeActive = isMidiLearnMode;
    
    let html = `
        <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-blue-700 dark:text-blue-300">MIDI Learn Mode</span>
                <button id="toggleLearnMode" class="px-3 py-1 text-xs ${learnModeActive ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'} rounded hover:opacity-80">
                    ${learnModeActive ? 'Cancel Learn' : 'Start Learn'}
                </button>
            </div>
            <p class="text-xs text-blue-600 dark:text-blue-400">
                ${learnModeActive 
                    ? `Learning: <strong>${midiLearnTargetParam}</strong><br>Move a CC knob on your MIDI controller...`
                    : 'Click "Start Learn", then click any parameter knob to assign MIDI CC control.'}
            </p>
        </div>
        
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Current Mappings (${mappingsList.length})</h3>
            ${mappingsList.length === 0 ? `
                <div class="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                    No MIDI mappings yet. Click "Start Learn" to create one.
                </div>
            ` : `
                <div class="space-y-2 max-h-48 overflow-y-auto">
                    ${mappingsList.map(m => `
                        <div class="flex items-center justify-between p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                            <div class="flex items-center gap-2">
                                <span class="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded font-mono">
                                    CC${m.cc}
                                </span>
                                <span class="text-xs text-gray-500">Ch${m.channel}</span>
                                <span class="text-gray-400">→</span>
                                <span class="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[180px]">${m.targetParam}</span>
                            </div>
                            <button class="remove-mapping px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200" data-mapping-id="${m.id}">✕</button>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
        
        <div class="flex gap-2 mb-4">
            <button id="clearAllMappings" class="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 ${mappingsList.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${mappingsList.length === 0 ? 'disabled' : ''}>
                Clear All
            </button>
            <button id="exportMappings" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 ${mappingsList.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${mappingsList.length === 0 ? 'disabled' : ''}>
                Export List
            </button>
        </div>
        
        <div class="p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Quick Tips</h4>
            <ul class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <li>• Click any knob/slider in the DAW, then click "Start Learn"</li>
                <li>• Move a CC knob on your MIDI controller to map it</li>
                <li>• Press ESC to cancel learning</li>
                <li>• Mappings are saved with your project</li>
            </ul>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Toggle learn mode button
    container.querySelector('#toggleLearnMode')?.addEventListener('click', () => {
        if (learnModeActive) {
            exitMidiLearnMode();
        } else {
            enterMidiLearnMode('pending-parameter');
        }
        renderMidiLearnContent();
    });
    
    // Remove mapping buttons
    container.querySelectorAll('.remove-mapping').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mappingId = e.target.dataset.mappingId;
            removeMidiMapping(mappingId);
            renderMidiLearnContent();
            if (localAppServices.showNotification) {
                localAppServices.showNotification('Mapping removed', 1500);
            }
        });
    });
    
    // Clear all button
    container.querySelector('#clearAllMappings')?.addEventListener('click', () => {
        clearAllMidiMappings();
        renderMidiLearnContent();
        if (localAppServices.showNotification) {
            localAppServices.showNotification('All mappings cleared', 1500);
        }
    });
    
    // Export button
    container.querySelector('#exportMappings')?.addEventListener('click', () => {
        const mappings = exportMidiMappingsForProject();
        const text = mappings.map(m => `CC${m.cc} Ch${m.channel} → ${m.targetParam}`).join('\n');
        
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'midi_mappings.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Exported ${mappings.length} mappings`, 2000);
        }
    });
}

// Export for external access
export function updateMidiLearnPanel() {
    const container = document.getElementById('midiLearnContent');
    if (container) renderMidiLearnContent();
}