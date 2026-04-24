/**
 * MIDI Macro Controls - Assign multiple parameters to one control
 * Create macro controls that can control multiple parameters simultaneously
 */

class MIDIMacroControls {
    constructor(audioContext) {
        this.name = 'MIDIMacroControls';
        this.audioContext = audioContext;
        
        // Macro controls registry
        this.macros = new Map();
        
        // MIDI learn state
        this.isLearning = false;
        this.learningMacroId = null;
        
        // Active macro values (for smooth interpolation)
        this.macroValues = new Map();
        this.targetValues = new Map();
        
        // MIDI access
        this.midiAccess = null;
        this.midiInput = null;
        
        // Callbacks
        this.onMacroChange = null;
        this.onLearnComplete = null;
        
        // Animation
        this.isAnimating = false;
        
        this.init();
    }
    
    async init() {
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            
            // Use first available input
            for (const input of this.midiAccess.inputs.values()) {
                this.midiInput = input;
                input.onmidimessage = (e) => this.handleMIDI(e);
                break;
            }
            
            console.log('[MIDIMacroControls] Initialized with MIDI access');
        } catch (err) {
            console.warn('[MIDIMacroControls] Web MIDI API not available:', err);
        }
    }
    
    handleMIDI(event) {
        const [status, data1, data2] = event.data;
        const messageType = status & 0xF0;
        
        // Handle CC messages
        if (messageType === 0xB0) {
            const ccNumber = data1;
            const value = data2 / 127; // Normalize to 0-1
            
            // If learning, assign this CC to the learning macro
            if (this.isLearning && this.learningMacroId) {
                this.assignMIDIToMacro(this.learningMacroId, ccNumber);
                this.isLearning = false;
                this.learningMacroId = null;
                
                if (this.onLearnComplete) {
                    this.onLearnComplete({ macroId: this.learningMacroId, cc: ccNumber });
                }
                return;
            }
            
            // Check if any macro uses this CC
            for (const [id, macro] of this.macros) {
                if (macro.midiCC === ccNumber) {
                    this.setMacroValue(id, value);
                }
            }
        }
    }
    
    // Macro creation
    createMacro(id, options = {}) {
        const macro = {
            id,
            name: options.name || `Macro ${this.macros.size + 1}`,
            value: options.value ?? 0.5,
            min: options.min ?? 0,
            max: options.max ?? 1,
            default: options.default ?? 0.5,
            midiCC: options.midiCC ?? null,
            midiChannel: options.midiChannel ?? 1,
            parameters: [], // List of parameters controlled by this macro
            curves: [], // Curve shapes for each parameter
            color: options.color || `hsl(${(this.macros.size * 60) % 360}, 70%, 50%)`,
            enabled: true
        };
        
        this.macros.set(id, macro);
        this.macroValues.set(id, macro.value);
        this.targetValues.set(id, macro.value);
        
        return macro;
    }
    
    removeMacro(id) {
        this.macros.delete(id);
        this.macroValues.delete(id);
        this.targetValues.delete(id);
    }
    
    // Parameter assignment
    addParameterToMacro(macroId, parameter, options = {}) {
        const macro = this.macros.get(macroId);
        if (!macro) return false;
        
        const assignment = {
            parameter, // Web Audio AudioParam or custom object with setValue method
            name: options.name || 'Parameter',
            min: options.min ?? 0,
            max: options.max ?? 1,
            curve: options.curve || 'linear', // 'linear', 'exp', 'log', 's-curve', 'custom'
            customCurve: options.customCurve || null, // Array of [x, y] points for custom curve
            invert: options.invert ?? false,
            enabled: true
        };
        
        macro.parameters.push(assignment);
        
        return true;
    }
    
    removeParameterFromMacro(macroId, parameterIndex) {
        const macro = this.macros.get(macroId);
        if (!macro) return false;
        
        macro.parameters.splice(parameterIndex, 1);
        return true;
    }
    
    // Value control
    setMacroValue(id, value, smooth = false) {
        const macro = this.macros.get(id);
        if (!macro || !macro.enabled) return;
        
        // Clamp value
        value = Math.max(macro.min, Math.min(macro.max, value));
        
        if (smooth) {
            this.targetValues.set(id, value);
            if (!this.isAnimating) {
                this.startAnimation();
            }
        } else {
            this.macroValues.set(id, value);
            macro.value = value;
            this.applyMacroToParameters(id, value);
        }
        
        if (this.onMacroChange) {
            this.onMacroChange({ id, value });
        }
    }
    
    applyMacroToParameters(id, value) {
        const macro = this.macros.get(id);
        if (!macro) return;
        
        for (const param of macro.parameters) {
            if (!param.enabled || !param.parameter) continue;
            
            // Transform value through curve
            let transformedValue = this.applyCurve(value, param);
            
            // Invert if needed
            if (param.invert) {
                transformedValue = 1 - transformedValue;
            }
            
            // Scale to parameter range
            const scaledValue = param.min + transformedValue * (param.max - param.min);
            
            // Apply to parameter
            if (param.parameter.setValueAtTime) {
                // Web Audio AudioParam
                param.parameter.setValueAtTime(scaledValue, this.audioContext.currentTime);
            } else if (typeof param.parameter.setValue === 'function') {
                // Custom setter
                param.parameter.setValue(scaledValue);
            } else if (typeof param.parameter === 'function') {
                // Direct function call
                param.parameter(scaledValue);
            }
        }
    }
    
    applyCurve(value, param) {
        // value is 0-1, return transformed 0-1
        switch (param.curve) {
            case 'linear':
                return value;
            
            case 'exp':
                // Exponential curve (more sensitive in lower range)
                return Math.pow(value, 2);
            
            case 'log':
                // Logarithmic curve (more sensitive in upper range)
                return Math.sqrt(value);
            
            case 's-curve':
                // Sigmoid-like S-curve
                return 1 / (1 + Math.exp(-10 * (value - 0.5)));
            
            case 'custom':
                if (param.customCurve && param.customCurve.length >= 2) {
                    return this.interpolateCustomCurve(value, param.customCurve);
                }
                return value;
            
            default:
                return value;
        }
    }
    
    interpolateCustomCurve(value, curve) {
        // curve is array of [x, y] points, x and y are 0-1
        // Find surrounding points
        for (let i = 0; i < curve.length - 1; i++) {
            if (value >= curve[i][0] && value <= curve[i + 1][0]) {
                const t = (value - curve[i][0]) / (curve[i + 1][0] - curve[i][0]);
                return curve[i][1] + t * (curve[i + 1][1] - curve[i][1]);
            }
        }
        
        // Fallback
        return curve[curve.length - 1][1];
    }
    
    // Smooth animation
    startAnimation() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.animate();
    }
    
    animate() {
        let needsAnimation = false;
        const smoothingFactor = 0.1;
        
        for (const [id, target] of this.targetValues) {
            const current = this.macroValues.get(id);
            const diff = target - current;
            
            if (Math.abs(diff) > 0.001) {
                const newValue = current + diff * smoothingFactor;
                this.macroValues.set(id, newValue);
                const macro = this.macros.get(id);
                if (macro) {
                    macro.value = newValue;
                    this.applyMacroToParameters(id, newValue);
                }
                needsAnimation = true;
            } else {
                this.macroValues.set(id, target);
                const macro = this.macros.get(id);
                if (macro) {
                    macro.value = target;
                    this.applyMacroToParameters(id, target);
                }
            }
        }
        
        if (needsAnimation) {
            requestAnimationFrame(() => this.animate());
        } else {
            this.isAnimating = false;
        }
    }
    
    // MIDI assignment
    assignMIDIToMacro(macroId, ccNumber, channel = 1) {
        const macro = this.macros.get(macroId);
        if (!macro) return false;
        
        macro.midiCC = ccNumber;
        macro.midiChannel = channel;
        
        return true;
    }
    
    startMIDILearn(macroId) {
        this.isLearning = true;
        this.learningMacroId = macroId;
    }
    
    cancelMIDILearn() {
        this.isLearning = false;
        this.learningMacroId = null;
    }
    
    // Preset management
    savePreset() {
        const preset = {
            macros: []
        };
        
        for (const [id, macro] of this.macros) {
            preset.macros.push({
                id: macro.id,
                name: macro.name,
                value: macro.value,
                min: macro.min,
                max: macro.max,
                default: macro.default,
                midiCC: macro.midiCC,
                midiChannel: macro.midiChannel,
                color: macro.color,
                parameters: macro.parameters.map(p => ({
                    name: p.name,
                    min: p.min,
                    max: p.max,
                    curve: p.curve,
                    customCurve: p.customCurve,
                    invert: p.invert
                    // Note: we don't save the actual parameter reference
                }))
            });
        }
        
        return preset;
    }
    
    loadPreset(preset) {
        this.macros.clear();
        this.macroValues.clear();
        this.targetValues.clear();
        
        for (const macroData of preset.macros) {
            this.createMacro(macroData.id, macroData);
            // Note: parameters need to be re-connected after loading
        }
    }
    
    // Get all macros
    getMacros() {
        const result = [];
        for (const [id, macro] of this.macros) {
            result.push({ ...macro });
        }
        return result;
    }
    
    getMacro(id) {
        const macro = this.macros.get(id);
        return macro ? { ...macro } : null;
    }
    
    // UI
    createUI(container) {
        container.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 8px;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #fff;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 14px;">MIDI Macro Controls</h3>
                    <div>
                        <button id="add-macro-btn" style="padding: 8px 16px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">Add Macro</button>
                        <button id="save-preset-btn" style="padding: 8px 16px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">Save</button>
                        <button id="load-preset-btn" style="padding: 8px 16px; background: #6366f1; border: none; border-radius: 4px; color: white; cursor: pointer;">Load</button>
                    </div>
                </div>
                
                <div id="macros-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;"></div>
                
                <div id="no-macros-message" style="text-align: center; padding: 40px; color: #888; display: ${this.macros.size === 0 ? 'block' : 'none'};">
                    <p>No macro controls defined</p>
                    <p style="font-size: 12px;">Click "Add Macro" to create a new macro control</p>
                </div>
            </div>
        `;
        
        this.macrosContainer = container.querySelector('#macros-container');
        this.noMacrosMessage = container.querySelector('#no-macros-message');
        
        this.setupEventHandlers(container);
        this.updateMacrosDisplay();
    }
    
    setupEventHandlers(container) {
        container.querySelector('#add-macro-btn').onclick = () => {
            const id = `macro_${Date.now()}`;
            this.createMacro(id);
            this.updateMacrosDisplay();
        };
        
        container.querySelector('#save-preset-btn').onclick = () => {
            const preset = this.savePreset();
            const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'midi_macro_preset.json';
            a.click();
            URL.revokeObjectURL(url);
        };
        
        container.querySelector('#load-preset-btn').onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const text = await file.text();
                    try {
                        const preset = JSON.parse(text);
                        this.loadPreset(preset);
                        this.updateMacrosDisplay();
                    } catch (err) {
                        console.error('Failed to load preset:', err);
                    }
                }
            };
            input.click();
        };
    }
    
    updateMacrosDisplay() {
        if (!this.macrosContainer) return;
        
        this.noMacrosMessage.style.display = this.macros.size === 0 ? 'block' : 'none';
        
        this.macrosContainer.innerHTML = '';
        
        for (const [id, macro] of this.macros) {
            const card = document.createElement('div');
            card.className = 'macro-card';
            card.dataset.macroId = id;
            card.style.cssText = `
                background: #2a2a4e;
                border-radius: 8px;
                padding: 16px;
                border-left: 4px solid ${macro.color};
            `;
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <input type="text" class="macro-name-input" value="${macro.name}" style="
                        background: transparent;
                        border: none;
                        color: white;
                        font-size: 14px;
                        font-weight: 600;
                        width: 150px;
                    ">
                    <button class="delete-macro-btn" style="padding: 4px 8px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">Delete</button>
                </div>
                
                <!-- Value slider -->
                <div style="margin-bottom: 12px;">
                    <input type="range" class="macro-value-slider" min="0" max="1" step="0.001" value="${macro.value}" style="
                        width: 100%;
                        accent-color: ${macro.color};
                    ">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #888;">
                        <span class="macro-value-display">${(macro.value * 100).toFixed(1)}%</span>
                        <button class="reset-macro-btn" style="padding: 2px 6px; background: #555; border: none; border-radius: 2px; color: white; cursor: pointer; font-size: 10px;">Reset</button>
                    </div>
                </div>
                
                <!-- MIDI assignment -->
                <div style="margin-bottom: 12px; padding: 8px; background: #1a1a2e; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; color: #888;">MIDI CC:</span>
                        <span class="midi-cc-display" style="font-size: 11px; color: ${macro.midiCC ? '#10b981' : '#666'};">${macro.midiCC ?? 'None'}</span>
                    </div>
                    <button class="learn-midi-btn" style="
                        margin-top: 4px;
                        width: 100%;
                        padding: 4px;
                        background: ${this.isLearning && this.learningMacroId === id ? '#f59e0b' : '#555'};
                        border: none;
                        border-radius: 4px;
                        color: white;
                        cursor: pointer;
                        font-size: 11px;
                    ">${this.isLearning && this.learningMacroId === id ? 'Learning...' : 'Learn MIDI'}</button>
                </div>
                
                <!-- Parameters -->
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-size: 11px; color: #888;">Parameters (${macro.parameters.length})</span>
                        <button class="add-param-btn" style="padding: 2px 6px; background: #3b82f6; border: none; border-radius: 2px; color: white; cursor: pointer; font-size: 10px;">+ Add</button>
                    </div>
                    <div class="parameters-list" style="max-height: 100px; overflow-y: auto;">
                        ${macro.parameters.map((p, i) => `
                            <div class="param-item" style="
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                padding: 4px 8px;
                                background: #1a1a2e;
                                border-radius: 2px;
                                margin-bottom: 4px;
                                font-size: 11px;
                            ">
                                <span style="color: #888;">${p.name}</span>
                                <div>
                                    <select class="param-curve-select" data-param-index="${i}" style="
                                        padding: 2px;
                                        background: #2a2a4e;
                                        border: 1px solid #444;
                                        border-radius: 2px;
                                        color: white;
                                        font-size: 10px;
                                    ">
                                        <option value="linear" ${p.curve === 'linear' ? 'selected' : ''}>Lin</option>
                                        <option value="exp" ${p.curve === 'exp' ? 'selected' : ''}>Exp</option>
                                        <option value="log" ${p.curve === 'log' ? 'selected' : ''}>Log</option>
                                        <option value="s-curve" ${p.curve === 's-curve' ? 'selected' : ''}>S</option>
                                    </select>
                                    <button class="remove-param-btn" data-param-index="${i}" style="padding: 2px 4px; background: #ef4444; border: none; border-radius: 2px; color: white; cursor: pointer; font-size: 10px;">×</button>
                                </div>
                            </div>
                        `).join('')}
                        ${macro.parameters.length === 0 ? '<div style="text-align: center; color: #666; font-size: 10px; padding: 8px;">No parameters assigned</div>' : ''}
                    </div>
                </div>
            `;
            
            this.macrosContainer.appendChild(card);
            
            // Event handlers for this macro card
            const macroId = id;
            
            // Name input
            card.querySelector('.macro-name-input').onchange = (e) => {
                macro.name = e.target.value;
            };
            
            // Value slider
            const slider = card.querySelector('.macro-value-slider');
            slider.oninput = (e) => {
                const value = parseFloat(e.target.value);
                this.setMacroValue(macroId, value);
                card.querySelector('.macro-value-display').textContent = `${(value * 100).toFixed(1)}%`;
            };
            
            // Reset button
            card.querySelector('.reset-macro-btn').onclick = () => {
                this.setMacroValue(macroId, macro.default);
                slider.value = macro.default;
                card.querySelector('.macro-value-display').textContent = `${(macro.default * 100).toFixed(1)}%`;
            };
            
            // Delete macro
            card.querySelector('.delete-macro-btn').onclick = () => {
                this.removeMacro(macroId);
                this.updateMacrosDisplay();
            };
            
            // MIDI learn
            card.querySelector('.learn-midi-btn').onclick = () => {
                if (this.isLearning && this.learningMacroId === macroId) {
                    this.cancelMIDILearn();
                } else {
                    this.startMIDILearn(macroId);
                }
                this.updateMacrosDisplay();
            };
            
            // Add parameter
            card.querySelector('.add-param-btn').onclick = () => {
                // Show parameter selection dialog
                this.showParameterSelectionDialog(macroId);
            };
            
            // Parameter curve selects
            card.querySelectorAll('.param-curve-select').forEach(select => {
                select.onchange = (e) => {
                    const paramIndex = parseInt(e.target.dataset.paramIndex);
                    macro.parameters[paramIndex].curve = e.target.value;
                };
            });
            
            // Remove parameter
            card.querySelectorAll('.remove-param-btn').forEach(btn => {
                btn.onclick = (e) => {
                    const paramIndex = parseInt(e.target.dataset.paramIndex);
                    this.removeParameterFromMacro(macroId, paramIndex);
                    this.updateMacrosDisplay();
                };
            });
        }
    }
    
    showParameterSelectionDialog(macroId) {
        // This would show a dialog to select available parameters
        // For now, just add a placeholder parameter
        const macro = this.macros.get(macroId);
        if (!macro) return;
        
        this.addParameterToMacro(macroId, null, {
            name: `Parameter ${macro.parameters.length + 1}`,
            min: 0,
            max: 1,
            curve: 'linear'
        });
        
        this.updateMacrosDisplay();
    }
    
    openPanel() {
        const existing = document.getElementById('midi-macro-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'midi-macro-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
        `;
        
        document.body.appendChild(panel);
        this.createUI(panel);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 6px 12px;
            background: #ef4444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        closeBtn.onclick = () => panel.remove();
        panel.appendChild(closeBtn);
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MIDIMacroControls };
} else if (typeof window !== 'undefined') {
    window.MIDIMacroControls = MIDIMacroControls;
}