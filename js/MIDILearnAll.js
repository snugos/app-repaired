/**
 * MIDI Learn All - Batch MIDI learn for all visible parameters
 * Allows quickly mapping MIDI CC to multiple parameters at once
 */

export class MIDILearnAll {
    constructor(dawState, options = {}) {
        this.dawState = dawState;
        
        // Parameters that can be learned
        this.learnableParameters = new Map();
        
        // Active mappings
        this.mappings = new Map(); // parameterId -> { cc, channel, min, max }
        
        // MIDI input
        this.midiAccess = null;
        this.midiInput = null;
        
        // Learning state
        this.isLearning = false;
        this.currentLearningParam = null;
        this.learningQueue = [];
        
        // CC to parameter reverse lookup
        this.ccToParameter = new Map(); // "cc-channel" -> parameterId
        
        // Options
        this.defaultChannel = options.defaultChannel ?? 1;
        this.autoLearnDelay = options.autoLearnDelay ?? 1000; // ms
        
        // Callbacks
        this.onMappingCreated = null;
        this.onMappingRemoved = null;
        this.onLearningStart = null;
        this.onLearningComplete = null;
        this.onParameterUpdate = null;
        
        this.enabled = true;
    }
    
    async initialize() {
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            
            // Connect to first available input
            for (const input of this.midiAccess.inputs.values()) {
                this.setInput(input);
                break;
            }
            
            // Listen for device changes
            this.midiAccess.onstatechange = (e) => {
                if (e.port.type === 'input' && e.port.state === 'connected') {
                    this.setInput(e.port);
                }
            };
            
            return true;
        } catch (error) {
            console.warn('MIDI Learn: MIDI access not available', error);
            return false;
        }
    }
    
    setInput(input) {
        // Disconnect previous input
        if (this.midiInput) {
            this.midiInput.onmidimessage = null;
        }
        
        this.midiInput = input;
        
        if (input) {
            input.onmidimessage = (message) => this.handleMIDIMessage(message);
        }
    }
    
    handleMIDIMessage(message) {
        if (!this.enabled) return;
        
        const data = message.data;
        const status = data[0] & 0xF0;
        const channel = (data[0] & 0x0F) + 1;
        
        // Only handle Control Change messages
        if (status !== 0xB0) return;
        
        const cc = data[1];
        const value = data[2] / 127; // Normalize to 0-1
        
        // If learning, create mapping
        if (this.isLearning && this.currentLearningParam) {
            this.createMapping(this.currentLearningParam, cc, channel);
            this.nextInQueue();
            return;
        }
        
        // Otherwise, apply existing mapping
        const key = `${cc}-${channel}`;
        const parameterId = this.ccToParameter.get(key);
        
        if (parameterId) {
            this.applyParameterUpdate(parameterId, value);
        }
    }
    
    registerParameter(parameter) {
        const param = {
            id: parameter.id,
            name: parameter.name,
            group: parameter.group,
            min: parameter.min ?? 0,
            max: parameter.max ?? 1,
            current: parameter.current ?? 0.5,
            setValue: parameter.setValue,
            getValue: parameter.getValue,
            ui: parameter.ui, // Reference to UI element
            visible: parameter.visible ?? true
        };
        
        this.learnableParameters.set(param.id, param);
        return param;
    }
    
    unregisterParameter(parameterId) {
        // Remove any existing mapping
        this.removeMapping(parameterId);
        this.learnableParameters.delete(parameterId);
    }
    
    getParameter(parameterId) {
        return this.learnableParameters.get(parameterId);
    }
    
    getAllParameters() {
        return Array.from(this.learnableParameters.values());
    }
    
    getVisibleParameters() {
        return this.getAllParameters().filter(p => p.visible);
    }
    
    createMapping(parameterId, cc, channel, options = {}) {
        const parameter = this.learnableParameters.get(parameterId);
        
        if (!parameter) {
            throw new Error(`Parameter ${parameterId} not found`);
        }
        
        // Remove any existing mapping for this parameter
        this.removeMapping(parameterId);
        
        // Remove any existing parameter for this CC
        const key = `${cc}-${channel}`;
        const existingParam = this.ccToParameter.get(key);
        if (existingParam) {
            this.removeMapping(existingParam);
        }
        
        const mapping = {
            parameterId,
            cc,
            channel,
            min: options.min ?? parameter.min,
            max: options.max ?? parameter.max,
            curve: options.curve ?? 'linear', // 'linear', 'log', 'exp'
            created: Date.now()
        };
        
        this.mappings.set(parameterId, mapping);
        this.ccToParameter.set(key, parameterId);
        
        if (this.onMappingCreated) {
            this.onMappingCreated(parameter, mapping);
        }
        
        return mapping;
    }
    
    removeMapping(parameterId) {
        const mapping = this.mappings.get(parameterId);
        
        if (!mapping) return false;
        
        const key = `${mapping.cc}-${mapping.channel}`;
        this.ccToParameter.delete(key);
        this.mappings.delete(parameterId);
        
        if (this.onMappingRemoved) {
            this.onMappingRemoved(parameterId, mapping);
        }
        
        return true;
    }
    
    getMapping(parameterId) {
        return this.mappings.get(parameterId);
    }
    
    getAllMappings() {
        return Array.from(this.mappings.entries()).map(([id, mapping]) => ({
            parameterId: id,
            ...mapping,
            parameter: this.learnableParameters.get(id)
        }));
    }
    
    applyParameterUpdate(parameterId, normalizedValue) {
        const parameter = this.learnableParameters.get(parameterId);
        const mapping = this.mappings.get(parameterId);
        
        if (!parameter || !mapping) return;
        
        // Apply curve transformation
        let value = normalizedValue;
        
        if (mapping.curve === 'log') {
            value = Math.pow(10, value * 2 - 1) / 10;
        } else if (mapping.curve === 'exp') {
            value = Math.pow(value, 2);
        }
        
        // Scale to parameter range
        const scaledValue = mapping.min + value * (mapping.max - mapping.min);
        
        // Update parameter
        if (parameter.setValue) {
            parameter.setValue(scaledValue);
        }
        
        parameter.current = scaledValue;
        
        if (this.onParameterUpdate) {
            this.onParameterUpdate(parameterId, scaledValue, normalizedValue);
        }
    }
    
    // Batch learning
    startLearningAll(parameterIds = null) {
        if (parameterIds) {
            this.learningQueue = parameterIds.filter(id => this.learnableParameters.has(id));
        } else {
            this.learningQueue = this.getVisibleParameters()
                .filter(p => !this.mappings.has(p.id))
                .map(p => p.id);
        }
        
        if (this.learningQueue.length === 0) {
            return false;
        }
        
        this.isLearning = true;
        this.currentLearningParam = null;
        this.nextInQueue();
        
        return true;
    }
    
    nextInQueue() {
        if (this.learningQueue.length === 0) {
            this.stopLearning();
            return;
        }
        
        this.currentLearningParam = this.learningQueue.shift();
        const parameter = this.learnableParameters.get(this.currentLearningParam);
        
        if (this.onLearningStart) {
            this.onLearningStart(parameter);
        }
    }
    
    stopLearning() {
        this.isLearning = false;
        this.currentLearningParam = null;
        this.learningQueue = [];
        
        if (this.onLearningComplete) {
            this.onLearningComplete();
        }
    }
    
    cancelLearning() {
        this.stopLearning();
    }
    
    // Quick mapping functions
    mapCCRange(startCC, count, parameterIds) {
        const mappings = [];
        
        for (let i = 0; i < count && i < parameterIds.length; i++) {
            const parameterId = parameterIds[i];
            const cc = startCC + i;
            
            try {
                const mapping = this.createMapping(parameterId, cc, this.defaultChannel);
                mappings.push(mapping);
            } catch (error) {
                console.warn(`Failed to map CC ${cc} to ${parameterId}`);
            }
        }
        
        return mappings;
    }
    
    // Clear all mappings
    clearAllMappings() {
        for (const parameterId of this.mappings.keys()) {
            this.removeMapping(parameterId);
        }
    }
    
    // Import/Export mappings
    exportMappings() {
        return {
            version: 1,
            mappings: Array.from(this.mappings.entries()).map(([id, mapping]) => ({
                parameterId: id,
                cc: mapping.cc,
                channel: mapping.channel,
                min: mapping.min,
                max: mapping.max,
                curve: mapping.curve
            }))
        };
    }
    
    importMappings(data) {
        if (!data.mappings) return 0;
        
        let imported = 0;
        
        for (const mapping of data.mappings) {
            try {
                this.createMapping(
                    mapping.parameterId,
                    mapping.cc,
                    mapping.channel,
                    {
                        min: mapping.min,
                        max: mapping.max,
                        curve: mapping.curve
                    }
                );
                imported++;
            } catch (error) {
                console.warn(`Failed to import mapping for ${mapping.parameterId}`);
            }
        }
        
        return imported;
    }
    
    destroy() {
        this.stopLearning();
        this.clearAllMappings();
        this.learnableParameters.clear();
        
        if (this.midiInput) {
            this.midiInput.onmidimessage = null;
        }
    }
}

// Factory function
export function createMIDILearnAll(dawState, options = {}) {
    return new MIDILearnAll(dawState, options);
}

// Common MIDI CC mappings
export const COMMON_CC_MAPPINGS = {
    volume: 7,
    pan: 10,
    expression: 11,
    sustain: 64,
    modulation: 1,
    breath: 2,
    foot: 4,
    dataEntry: 6,
    reverb: 91,
    chorus: 93
};

// UI Panel
export function createMIDILearnPanel(midiLearn, appServices) {
    const container = document.createElement('div');
    container.className = 'midi-learn-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 450px;
        max-height: 600px;
        overflow-y: auto;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'MIDI Learn';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Learning status
    const statusContainer = document.createElement('div');
    statusContainer.id = 'learningStatus';
    statusContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px; text-align: center;';
    statusContainer.innerHTML = `
        <div id="learningText">Ready to learn</div>
        <div id="learningParamName" style="font-size: 18px; font-weight: 600; margin-top: 8px; display: none;"></div>
    `;
    container.appendChild(statusContainer);
    
    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';
    buttonsContainer.innerHTML = `
        <button id="learnAllBtn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
            Learn All Parameters
        </button>
        <button id="stopLearnBtn" style="flex: 1; padding: 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600; display: none;">
            Stop Learning
        </button>
    `;
    container.appendChild(buttonsContainer);
    
    // Mappings list
    const mappingsContainer = document.createElement('div');
    mappingsContainer.id = 'mappingsList';
    mappingsContainer.style.cssText = 'margin-bottom: 16px;';
    container.appendChild(mappingsContainer);
    
    // Quick mapping
    const quickMapContainer = document.createElement('div');
    quickMapContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    quickMapContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Quick Map (Common CCs)</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="quick-map-btn" data-cc="7" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                CC7 Volume
            </button>
            <button class="quick-map-btn" data-cc="10" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                CC10 Pan
            </button>
            <button class="quick-map-btn" data-cc="1" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                CC1 Mod
            </button>
            <button class="quick-map-btn" data-cc="64" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                CC64 Sustain
            </button>
        </div>
    `;
    container.appendChild(quickMapContainer);
    
    // Actions
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = 'display: flex; gap: 8px;';
    actionsContainer.innerHTML = `
        <button id="exportMappings" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Export Mappings
        </button>
        <button id="importMappings" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Import Mappings
        </button>
        <button id="clearMappings" style="flex: 1; padding: 10px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Clear All
        </button>
    `;
    container.appendChild(actionsContainer);
    
    // Hidden file input for import
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    container.appendChild(fileInput);
    
    // Update mappings list
    updateMappingsList(mappingsContainer, midiLearn);
    
    // Event handlers
    document.getElementById('learnAllBtn').addEventListener('click', () => {
        if (midiLearn.startLearningAll()) {
            document.getElementById('learnAllBtn').style.display = 'none';
            document.getElementById('stopLearnBtn').style.display = 'block';
            document.getElementById('learningParamName').style.display = 'block';
        }
    });
    
    document.getElementById('stopLearnBtn').addEventListener('click', () => {
        midiLearn.cancelLearning();
        document.getElementById('learnAllBtn').style.display = 'block';
        document.getElementById('stopLearnBtn').style.display = 'none';
        document.getElementById('learningParamName').style.display = 'none';
        document.getElementById('learningText').textContent = 'Ready to learn';
    });
    
    // Quick map buttons
    quickMapContainer.querySelectorAll('.quick-map-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cc = parseInt(btn.dataset.cc);
            // Quick map would prompt user to click a parameter
            if (appServices && appServices.showNotification) {
                appServices.showNotification(`Click a parameter to map to CC${cc}`, 3000);
            }
        });
    });
    
    // Export
    document.getElementById('exportMappings').addEventListener('click', () => {
        const data = midiLearn.exportMappings();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'midi-mappings.json';
        a.click();
        
        URL.revokeObjectURL(url);
    });
    
    // Import
    document.getElementById('importMappings').addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const text = await file.text();
            const data = JSON.parse(text);
            const count = midiLearn.importMappings(data);
            updateMappingsList(mappingsContainer, midiLearn);
            
            if (appServices && appServices.showNotification) {
                appServices.showNotification(`Imported ${count} mappings`, 2000);
            }
        }
    });
    
    // Clear
    document.getElementById('clearMappings').addEventListener('click', () => {
        if (confirm('Clear all MIDI mappings?')) {
            midiLearn.clearAllMappings();
            updateMappingsList(mappingsContainer, midiLearn);
        }
    });
    
    // Callbacks
    midiLearn.onMappingCreated = () => {
        updateMappingsList(mappingsContainer, midiLearn);
    };
    
    midiLearn.onMappingRemoved = () => {
        updateMappingsList(mappingsContainer, midiLearn);
    };
    
    midiLearn.onLearningStart = (parameter) => {
        document.getElementById('learningText').textContent = `Move MIDI control for:`;
        document.getElementById('learningParamName').textContent = parameter.name;
    };
    
    midiLearn.onLearningComplete = () => {
        document.getElementById('learnAllBtn').style.display = 'block';
        document.getElementById('stopLearnBtn').style.display = 'none';
        document.getElementById('learningParamName').style.display = 'none';
        document.getElementById('learningText').textContent = 'Learning complete!';
        
        setTimeout(() => {
            document.getElementById('learningText').textContent = 'Ready to learn';
        }, 2000);
    };
    
    return container;
}

function updateMappingsList(container, midiLearn) {
    const mappings = midiLearn.getAllMappings();
    
    if (mappings.length === 0) {
        container.innerHTML = `
            <div style="color: #6b7280; font-style: italic; text-align: center; padding: 16px;">
                No mappings configured
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Current Mappings (${mappings.length})</div>
        <div style="max-height: 200px; overflow-y: auto;">
            ${mappings.map(m => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #1e1e2e; margin-bottom: 4px; border-radius: 4px;">
                    <div>
                        <span style="color: #22c55e;">CC${m.cc}</span>
                        <span style="color: #9ca3af;">→</span>
                        <span>${m.parameter?.name || m.parameterId}</span>
                    </div>
                    <button class="remove-mapping" data-param="${m.parameterId}" style="padding: 4px 8px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">
                        ✕
                    </button>
                </div>
            `).join('')}
        </div>
    `;
    
    container.querySelectorAll('.remove-mapping').forEach(btn => {
        btn.addEventListener('click', () => {
            midiLearn.removeMapping(btn.dataset.param);
        });
    });
}

export default MIDILearnAll;