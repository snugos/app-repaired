/**
 * DynamicTubeSaturation - Analog-style tube saturation with variable drive and character
 * Provides warm, harmonically-rich saturation with dynamic response to input signal
 */

export class DynamicTubeSaturation {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Parameters
        this.drive = options.drive ?? 0.5; // 0-1
        this.character = options.character ?? 0.5; // 0=clean, 1=crunchy
        this.mix = options.mix ?? 1.0; // 0-1 dry/wet
        this.outputGain = options.outputGain ?? 1.0;
        this.bass = options.bass ?? 0.5; // Bass enhancement
        this.treble = options.treble ?? 0.5; // Treble presence
        this.dynamics = options.dynamics ?? 0.5; // Dynamic response
        
        // Audio nodes
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.preGain = audioContext.createGain();
        this.postGain = audioContext.createGain();
        
        // EQ for tone shaping
        this.bassFilter = audioContext.createBiquadFilter();
        this.bassFilter.type = 'lowshelf';
        this.bassFilter.frequency.value = 200;
        this.bassFilter.gain.value = 0;
        
        this.trebleFilter = audioContext.createBiquadFilter();
        this.trebleFilter.type = 'highshelf';
        this.trebleFilter.frequency.value = 4000;
        this.trebleFilter.gain.value = 0;
        
        // Input analyser for dynamic response
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyserData = new Float32Array(this.analyser.frequencyBinCount);
        
        // Wave shaper for saturation
        this.saturator = audioContext.createWaveShaper();
        this.updateCurve();
        
        // Connect the chain
        this.input.connect(this.dryGain);
        this.input.connect(this.analyser);
        this.analyser.connect(this.preGain);
        this.preGain.connect(this.saturator);
        this.saturator.connect(this.bassFilter);
        this.bassFilter.connect(this.trebleFilter);
        this.trebleFilter.connect(this.postGain);
        this.postGain.connect(this.wetGain);
        
        this.dryGain.connect(this.output);
        this.wetGain.connect(this.output);
        
        this.updateParameters();
        
        // Dynamic processing loop
        this.dynamicInterval = null;
        this.startDynamicProcessing();
    }
    
    // Generate saturation curve based on drive and character
    updateCurve() {
        const samples = 4096;
        const curve = new Float32Array(samples);
        const drive = 1 + (this.drive * 9); // 1-10 range
        const character = this.character;
        
        for (let i = 0; i < samples; i++) {
            const x = (i / samples) * 2 - 1; // -1 to 1
            
            // Tube-like asymmetric saturation
            let y;
            
            if (x >= 0) {
                // Positive half - warmer compression
                y = Math.tanh(x * drive * (1 + character * 0.5));
            } else {
                // Negative half - more aggressive
                y = -Math.tanh(-x * drive * (1 + character * 0.8));
            }
            
            // Add subtle even harmonics for warmth
            y += Math.sin(y * Math.PI * 2) * character * 0.15;
            
            // Soft clip
            y = Math.tanh(y * 1.2);
            
            curve[i] = y;
        }
        
        this.saturator.curve = curve;
    }
    
    updateParameters() {
        // Pre-gain based on drive
        this.preGain.gain.value = 1 + this.drive * 2;
        
        // Mix
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
        
        // Output gain with auto-compensation
        const autoCompensate = 1 / (1 + this.drive * 0.5);
        this.postGain.gain.value = this.outputGain * autoCompensate;
        
        // EQ
        this.bassFilter.gain.value = (this.bass - 0.5) * 12; // -6 to +6 dB
        this.trebleFilter.gain.value = (this.treble - 0.5) * 12;
        
        // Update saturation curve
        this.updateCurve();
    }
    
    startDynamicProcessing() {
        this.dynamicInterval = setInterval(() => {
            if (!this.analyser || this.dynamics === 0) return;
            
            this.analyser.getFloatTimeDomainData(this.analyserData);
            
            // Calculate RMS level
            let sum = 0;
            for (let i = 0; i < this.analyserData.length; i++) {
                sum += this.analyserData[i] * this.analyserData[i];
            }
            const rms = Math.sqrt(sum / this.analyserData.length);
            
            // Dynamic drive adjustment based on input level
            const dynamicFactor = 1 + (1 - rms) * this.dynamics * 0.5;
            this.preGain.gain.setValueAtTime(
                (1 + this.drive * 2) * dynamicFactor,
                this.audioContext.currentTime
            );
        }, 50);
    }
    
    stopDynamicProcessing() {
        if (this.dynamicInterval) {
            clearInterval(this.dynamicInterval);
            this.dynamicInterval = null;
        }
    }
    
    setDrive(value) {
        this.drive = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setCharacter(value) {
        this.character = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setOutputGain(value) {
        this.outputGain = Math.max(0, Math.min(2, value));
        this.updateParameters();
    }
    
    setBass(value) {
        this.bass = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setTreble(value) {
        this.treble = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setDynamics(value) {
        this.dynamics = Math.max(0, Math.min(1, value));
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.stopDynamicProcessing();
        this.output.disconnect();
    }
    
    getParameterDefinitions() {
        return [
            { name: 'drive', label: 'Drive', min: 0, max: 1, default: 0.5, unit: '' },
            { name: 'character', label: 'Character', min: 0, max: 1, default: 0.5, unit: '' },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 1, unit: '' },
            { name: 'outputGain', label: 'Output', min: 0, max: 2, default: 1, unit: '' },
            { name: 'bass', label: 'Bass', min: 0, max: 1, default: 0.5, unit: '' },
            { name: 'treble', label: 'Treble', min: 0, max: 1, default: 0.5, unit: '' },
            { name: 'dynamics', label: 'Dynamics', min: 0, max: 1, default: 0.5, unit: '' }
        ];
    }
    
    getPresets() {
        return [
            { name: 'Warm Glow', settings: { drive: 0.3, character: 0.2, mix: 0.7, outputGain: 1, bass: 0.6, treble: 0.5, dynamics: 0.3 } },
            { name: 'Vintage Amp', settings: { drive: 0.5, character: 0.4, mix: 1, outputGain: 0.9, bass: 0.7, treble: 0.6, dynamics: 0.5 } },
            { name: 'Crunch', settings: { drive: 0.7, character: 0.7, mix: 1, outputGain: 0.85, bass: 0.5, treble: 0.7, dynamics: 0.4 } },
            { name: 'High Gain', settings: { drive: 0.9, character: 0.9, mix: 1, outputGain: 0.75, bass: 0.4, treble: 0.8, dynamics: 0.6 } },
            { name: 'Subtle Warmth', settings: { drive: 0.15, character: 0.1, mix: 0.5, outputGain: 1, bass: 0.55, treble: 0.55, dynamics: 0.2 } },
            { name: 'Fat Bass', settings: { drive: 0.6, character: 0.3, mix: 0.9, outputGain: 0.95, bass: 0.8, treble: 0.3, dynamics: 0.5 } },
            { name: 'Bright Lead', settings: { drive: 0.5, character: 0.6, mix: 1, outputGain: 0.9, bass: 0.3, treble: 0.8, dynamics: 0.4 } },
            { name: 'Dynamic Response', settings: { drive: 0.4, character: 0.5, mix: 0.85, outputGain: 1, bass: 0.5, treble: 0.5, dynamics: 0.9 } }
        ];
    }
    
    getState() {
        return {
            drive: this.drive,
            character: this.character,
            mix: this.mix,
            outputGain: this.outputGain,
            bass: this.bass,
            treble: this.treble,
            dynamics: this.dynamics
        };
    }
    
    setState(state) {
        if (state.drive !== undefined) this.drive = state.drive;
        if (state.character !== undefined) this.character = state.character;
        if (state.mix !== undefined) this.mix = state.mix;
        if (state.outputGain !== undefined) this.outputGain = state.outputGain;
        if (state.bass !== undefined) this.bass = state.bass;
        if (state.treble !== undefined) this.treble = state.treble;
        if (state.dynamics !== undefined) this.dynamics = state.dynamics;
        this.updateParameters();
    }
}

/**
 * UI Panel for Dynamic Tube Saturation
 */
export function openTubeSaturationPanel(effect, onClose) {
    const existingPanel = document.getElementById('tube-saturation-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'tube-saturation-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #4a4a6a;
        border-radius: 12px;
        padding: 24px;
        min-width: 400px;
        max-width: 500px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        color: #e0e0e0;
    `;
    
    const params = effect.getParameterDefinitions();
    const presets = effect.getPresets();
    const state = effect.getState();
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 20px; color: #f0a500;">🎹 Dynamic Tube Saturation</h2>
            <button id="close-tube-panel" style="background: #3a3a5a; border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer;">✕</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #a0a0a0;">Preset</label>
            <select id="tube-preset" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #fff; font-size: 14px;">
                <option value="">-- Select Preset --</option>
                ${presets.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            </select>
        </div>
        
        <div style="display: grid; gap: 16px;">
    `;
    
    params.forEach(param => {
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 13px; color: #a0a0a0;">${param.label}</label>
                    <span id="tube-${param.name}-value" style="font-size: 13px; color: #f0a500;">${(state[param.name] * 100).toFixed(0)}%</span>
                </div>
                <input type="range" id="tube-${param.name}" min="${param.min}" max="${param.max}" step="0.01" value="${state[param.name]}"
                    style="width: 100%; height: 6px; -webkit-appearance: none; background: #2a2a4e; border-radius: 3px; outline: none;">
            </div>
        `;
    });
    
    html += `
        </div>
        
        <div style="margin-top: 20px; display: flex; gap: 12px;">
            <button id="tube-reset" style="flex: 1; padding: 12px; background: #3a3a5a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Reset</button>
            <button id="tube-bypass" style="flex: 1; padding: 12px; background: #4a4a6a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Bypass</button>
        </div>
        
        <div style="margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 6px; font-size: 12px; color: #6a6a8a;">
            <strong>Tip:</strong> Drive controls the intensity of saturation. Character shapes the tone from clean to crunchy. 
            Dynamics adjusts how the saturation responds to your playing intensity.
        </div>
    `;
    
    panel.innerHTML = html;
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('close-tube-panel').addEventListener('click', () => {
        panel.remove();
        if (onClose) onClose();
    });
    
    document.getElementById('tube-preset').addEventListener('change', (e) => {
        const preset = presets.find(p => p.name === e.target.value);
        if (preset) {
            effect.setState(preset.settings);
            updateSliders();
        }
    });
    
    params.forEach(param => {
        const slider = document.getElementById(`tube-${param.name}`);
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const setter = `set${param.name.charAt(0).toUpperCase() + param.name.slice(1)}`;
            if (effect[setter]) {
                effect[setter](value);
            }
            document.getElementById(`tube-${param.name}-value`).textContent = `${(value * 100).toFixed(0)}%`;
        });
    });
    
    document.getElementById('tube-reset').addEventListener('click', () => {
        const defaults = { drive: 0.5, character: 0.5, mix: 1, outputGain: 1, bass: 0.5, treble: 0.5, dynamics: 0.5 };
        effect.setState(defaults);
        updateSliders();
    });
    
    document.getElementById('tube-bypass').addEventListener('click', (e) => {
        const isBypassed = effect.mix === 0;
        effect.setMix(isBypassed ? 1 : 0);
        e.target.textContent = isBypassed ? 'Bypass' : 'Engage';
        e.target.style.background = isBypassed ? '#4a4a6a' : '#f0a500';
    });
    
    function updateSliders() {
        const currentState = effect.getState();
        params.forEach(param => {
            document.getElementById(`tube-${param.name}`).value = currentState[param.name];
            document.getElementById(`tube-${param.name}-value`).textContent = `${(currentState[param.name] * 100).toFixed(0)}%`;
        });
    }
    
    return panel;
}

export default DynamicTubeSaturation;