/**
 * DynamicResonanceFilter - Resonant filter that responds to input dynamics
 * Filter resonance and cutoff respond to input signal level for expressive filtering
 */

export class DynamicResonanceFilter {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Parameters
        this.baseFrequency = options.baseFrequency ?? 1000; // Hz
        this.resonance = options.resonance ?? 5; // Q value
        this.filterType = options.filterType ?? 'lowpass'; // lowpass, highpass, bandpass
        this.depth = options.depth ?? 0.5; // How much dynamics affect filter
        this.sensitivity = options.sensitivity ?? 0.5; // How sensitive to input
        this.attack = options.attack ?? 0.01; // seconds
        this.release = options.release ?? 0.2; // seconds
        this.mix = options.mix ?? 1.0;
        this.frequencyRange = options.frequencyRange ?? { min: 100, max: 8000 };
        
        // Create filter
        this.filter = audioContext.createBiquadFilter();
        this.filter.type = this.filterType;
        this.filter.frequency.value = this.baseFrequency;
        this.filter.Q.value = this.resonance;
        
        // Analyser for dynamics detection
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.3;
        this.analyserData = new Float32Array(this.analyser.frequencyBinCount);
        
        // Envelope follower
        this.envelope = 0;
        this.lastEnvelope = 0;
        
        // Dry/wet mix
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Connect nodes
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        this.input.connect(this.analyser);
        this.analyser.connect(this.filter);
        this.filter.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
        
        // Start processing
        this.processInterval = null;
        this.startProcessing();
    }
    
    followEnvelope() {
        this.analyser.getFloatTimeDomainData(this.analyserData);
        
        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < this.analyserData.length; i++) {
            sum += this.analyserData[i] * this.analyserData[i];
        }
        const rms = Math.sqrt(sum / this.analyserData.length);
        
        // Smooth envelope follower
        const attackCoeff = Math.exp(-1 / (this.attack * this.audioContext.sampleRate / 100));
        const releaseCoeff = Math.exp(-1 / (this.release * this.audioContext.sampleRate / 100));
        
        if (rms > this.envelope) {
            this.envelope = rms + attackCoeff * (this.envelope - rms);
        } else {
            this.envelope = rms + releaseCoeff * (this.envelope - rms);
        }
        
        return this.envelope;
    }
    
    startProcessing() {
        this.processInterval = setInterval(() => {
            const now = this.audioContext.currentTime;
            const envelope = this.followEnvelope();
            
            // Calculate target frequency based on envelope
            // Higher envelope = higher frequency (for upward sweep)
            const normalizedEnvelope = Math.min(1, envelope * (1 + this.sensitivity * 2));
            const freqRange = this.frequencyRange.max - this.frequencyRange.min;
            const targetFreq = this.frequencyRange.min + (normalizedEnvelope * this.depth * freqRange);
            
            // Apply to filter
            this.filter.frequency.setTargetAtTime(
                Math.max(this.frequencyRange.min, Math.min(this.frequencyRange.max, targetFreq)),
                now,
                0.01
            );
            
            // Dynamic resonance based on envelope
            const dynamicQ = this.resonance * (1 + normalizedEnvelope * this.depth * 0.5);
            this.filter.Q.setTargetAtTime(
                Math.max(0.1, Math.min(30, dynamicQ)),
                now,
                0.05
            );
        }, 10); // 100Hz update rate
    }
    
    stopProcessing() {
        if (this.processInterval) {
            clearInterval(this.processInterval);
            this.processInterval = null;
        }
    }
    
    setBaseFrequency(freq) {
        this.baseFrequency = Math.max(20, Math.min(20000, freq));
        this.filter.frequency.value = this.baseFrequency;
    }
    
    setResonance(q) {
        this.resonance = Math.max(0.1, Math.min(30, q));
        this.filter.Q.value = this.resonance;
    }
    
    setFilterType(type) {
        if (['lowpass', 'highpass', 'bandpass', 'notch'].includes(type)) {
            this.filterType = type;
            this.filter.type = type;
        }
    }
    
    setDepth(value) {
        this.depth = Math.max(0, Math.min(1, value));
    }
    
    setSensitivity(value) {
        this.sensitivity = Math.max(0, Math.min(1, value));
    }
    
    setAttack(seconds) {
        this.attack = Math.max(0.001, seconds);
    }
    
    setRelease(seconds) {
        this.release = Math.max(0.01, seconds);
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
    }
    
    setFrequencyMin(freq) {
        this.frequencyRange.min = Math.max(20, freq);
    }
    
    setFrequencyMax(freq) {
        this.frequencyRange.max = Math.min(20000, freq);
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.stopProcessing();
        this.output.disconnect();
    }
    
    getParameterDefinitions() {
        return [
            { name: 'baseFrequency', label: 'Base Frequency', min: 20, max: 20000, default: 1000, unit: 'Hz' },
            { name: 'resonance', label: 'Resonance (Q)', min: 0.1, max: 30, default: 5, unit: '' },
            { name: 'depth', label: 'Depth', min: 0, max: 1, default: 0.5, unit: '' },
            { name: 'sensitivity', label: 'Sensitivity', min: 0, max: 1, default: 0.5, unit: '' },
            { name: 'attack', label: 'Attack', min: 0.001, max: 1, default: 0.01, unit: 's' },
            { name: 'release', label: 'Release', min: 0.01, max: 2, default: 0.2, unit: 's' },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 1, unit: '' }
        ];
    }
    
    getPresets() {
        return [
            { 
                name: 'Auto Wah', 
                settings: { 
                    baseFrequency: 400, resonance: 10, filterType: 'lowpass',
                    depth: 0.8, sensitivity: 0.7, attack: 0.01, release: 0.15, mix: 1,
                    frequencyRange: { min: 200, max: 3000 }
                } 
            },
            { 
                name: 'Envelope Filter', 
                settings: { 
                    baseFrequency: 800, resonance: 6, filterType: 'lowpass',
                    depth: 0.6, sensitivity: 0.5, attack: 0.02, release: 0.3, mix: 1,
                    frequencyRange: { min: 300, max: 4000 }
                } 
            },
            { 
                name: 'Sonic Sweep', 
                settings: { 
                    baseFrequency: 500, resonance: 15, filterType: 'lowpass',
                    depth: 1.0, sensitivity: 0.9, attack: 0.005, release: 0.1, mix: 1,
                    frequencyRange: { min: 100, max: 8000 }
                } 
            },
            { 
                name: 'Subtle Glow', 
                settings: { 
                    baseFrequency: 2000, resonance: 3, filterType: 'lowpass',
                    depth: 0.3, sensitivity: 0.4, attack: 0.05, release: 0.5, mix: 0.7,
                    frequencyRange: { min: 500, max: 5000 }
                } 
            },
            { 
                name: 'High Pass Sweep', 
                settings: { 
                    baseFrequency: 2000, resonance: 8, filterType: 'highpass',
                    depth: 0.7, sensitivity: 0.6, attack: 0.01, release: 0.2, mix: 1,
                    frequencyRange: { min: 200, max: 6000 }
                } 
            },
            { 
                name: 'Bandpass Resonance', 
                settings: { 
                    baseFrequency: 1500, resonance: 20, filterType: 'bandpass',
                    depth: 0.5, sensitivity: 0.5, attack: 0.02, release: 0.25, mix: 0.9,
                    frequencyRange: { min: 500, max: 4000 }
                } 
            },
            { 
                name: 'Notch Sweeper', 
                settings: { 
                    baseFrequency: 1000, resonance: 10, filterType: 'notch',
                    depth: 0.6, sensitivity: 0.6, attack: 0.03, release: 0.3, mix: 0.8,
                    frequencyRange: { min: 200, max: 5000 }
                } 
            }
        ];
    }
    
    getState() {
        return {
            baseFrequency: this.baseFrequency,
            resonance: this.resonance,
            filterType: this.filterType,
            depth: this.depth,
            sensitivity: this.sensitivity,
            attack: this.attack,
            release: this.release,
            mix: this.mix,
            frequencyRange: { ...this.frequencyRange }
        };
    }
    
    setState(state) {
        if (state.baseFrequency !== undefined) this.setBaseFrequency(state.baseFrequency);
        if (state.resonance !== undefined) this.setResonance(state.resonance);
        if (state.filterType !== undefined) this.setFilterType(state.filterType);
        if (state.depth !== undefined) this.setDepth(state.depth);
        if (state.sensitivity !== undefined) this.setSensitivity(state.sensitivity);
        if (state.attack !== undefined) this.setAttack(state.attack);
        if (state.release !== undefined) this.setRelease(state.release);
        if (state.mix !== undefined) this.setMix(state.mix);
        if (state.frequencyRange !== undefined) {
            this.frequencyRange = { ...state.frequencyRange };
        }
    }
}

/**
 * UI Panel for Dynamic Resonance Filter
 */
export function openDynamicResonanceFilterPanel(effect, onClose) {
    const existingPanel = document.getElementById('dynamic-resonance-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'dynamic-resonance-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #4a4a6a;
        border-radius: 12px;
        padding: 24px;
        min-width: 450px;
        max-width: 550px;
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
            <h2 style="margin: 0; font-size: 20px; color: #00ff88;">🌀 Dynamic Resonance Filter</h2>
            <button id="close-drf-panel" style="background: #3a3a5a; border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer;">✕</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #a0a0a0;">Preset</label>
            <select id="drf-preset" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #fff; font-size: 14px;">
                <option value="">-- Select Preset --</option>
                ${presets.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            </select>
        </div>
        
        <div style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6a6a8a;">Filter Type</h3>
            <div style="display: flex; gap: 8px;">
                ${['lowpass', 'highpass', 'bandpass', 'notch'].map(type => `
                    <button id="drf-type-${type}" style="flex: 1; padding: 10px; background: ${state.filterType === type ? '#00ff88' : '#3a3a5a'}; border: none; color: ${state.filterType === type ? '#000' : '#fff'}; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        ${type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div style="display: grid; gap: 16px;">
    `;
    
    params.forEach(param => {
        const isHz = param.name.includes('Frequency') || param.name.includes('Min') || param.name.includes('Max');
        const isSeconds = param.name === 'attack' || param.name === 'release';
        const isPercent = param.name === 'depth' || param.name === 'sensitivity' || param.name === 'mix';
        
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 13px; color: #a0a0a0;">${param.label}</label>
                    <span id="drf-${param.name}-value" style="font-size: 13px; color: #00ff88;">${
                        isHz ? state[param.name] + ' Hz' :
                        isSeconds ? state[param.name] + ' s' :
                        isPercent ? (state[param.name] * 100).toFixed(0) + '%' :
                        state[param.name].toFixed(1)
                    }</span>
                </div>
                <input type="range" id="drf-${param.name}" min="${param.min}" max="${param.max}" step="${isHz ? 10 : isSeconds ? 0.001 : 0.01}" value="${state[param.name]}"
                    style="width: 100%; height: 6px; -webkit-appearance: none; background: #2a2a4e; border-radius: 3px; outline: none;">
            </div>
        `;
    });
    
    html += `
        </div>
        
        <div style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6a6a8a;">Frequency Range</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                    <label style="font-size: 12px; color: #a0a0a0;">Min Freq</label>
                    <input type="range" id="drf-freq-min" min="20" max="5000" value="${state.frequencyRange.min}"
                        style="width: 100%; height: 6px; -webkit-appearance: none; background: #2a2a4e; border-radius: 3px; outline: none;">
                    <span id="drf-freq-min-value" style="font-size: 12px; color: #00ff88;">${state.frequencyRange.min} Hz</span>
                </div>
                <div>
                    <label style="font-size: 12px; color: #a0a0a0;">Max Freq</label>
                    <input type="range" id="drf-freq-max" min="1000" max="20000" value="${state.frequencyRange.max}"
                        style="width: 100%; height: 6px; -webkit-appearance: none; background: #2a2a4e; border-radius: 3px; outline: none;">
                    <span id="drf-freq-max-value" style="font-size: 12px; color: #00ff88;">${state.frequencyRange.max} Hz</span>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 20px; display: flex; gap: 12px;">
            <button id="drf-reset" style="flex: 1; padding: 12px; background: #3a3a5a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Reset</button>
            <button id="drf-bypass" style="flex: 1; padding: 12px; background: #4a4a6a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Bypass</button>
        </div>
        
        <div style="margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 6px; font-size: 12px; color: #6a6a8a;">
            <strong>Tip:</strong> The filter responds to input dynamics. Higher input = higher frequency sweep.
        </div>
    `;
    
    panel.innerHTML = html;
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('close-drf-panel').addEventListener('click', () => {
        panel.remove();
        if (onClose) onClose();
    });
    
    document.getElementById('drf-preset').addEventListener('change', (e) => {
        const preset = presets.find(p => p.name === e.target.value);
        if (preset) {
            effect.setState(preset.settings);
            updateSliders();
            updateTypeButtons();
        }
    });
    
    // Filter type buttons
    ['lowpass', 'highpass', 'bandpass', 'notch'].forEach(type => {
        document.getElementById(`drf-type-${type}`).addEventListener('click', () => {
            effect.setFilterType(type);
            updateTypeButtons();
        });
    });
    
    params.forEach(param => {
        const slider = document.getElementById(`drf-${param.name}`);
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const setter = `set${param.name.charAt(0).toUpperCase() + param.name.slice(1)}`;
            if (effect[setter]) {
                effect[setter](value);
            }
            updateValueDisplay(param.name, value);
        });
    });
    
    // Frequency range sliders
    document.getElementById('drf-freq-min').addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        effect.setFrequencyMin(value);
        document.getElementById('drf-freq-min-value').textContent = `${value} Hz`;
    });
    
    document.getElementById('drf-freq-max').addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        effect.setFrequencyMax(value);
        document.getElementById('drf-freq-max-value').textContent = `${value} Hz`;
    });
    
    document.getElementById('drf-reset').addEventListener('click', () => {
        const defaults = { 
            baseFrequency: 1000, resonance: 5, filterType: 'lowpass',
            depth: 0.5, sensitivity: 0.5, attack: 0.01, release: 0.2, mix: 1,
            frequencyRange: { min: 100, max: 8000 }
        };
        effect.setState(defaults);
        updateSliders();
        updateTypeButtons();
    });
    
    document.getElementById('drf-bypass').addEventListener('click', (e) => {
        const isBypassed = effect.mix === 0;
        effect.setMix(isBypassed ? 1 : 0);
        e.target.textContent = isBypassed ? 'Bypass' : 'Engage';
        e.target.style.background = isBypassed ? '#4a4a6a' : '#00ff88';
        e.target.style.color = isBypassed ? '#fff' : '#000';
    });
    
    function updateValueDisplay(paramName, value) {
        const param = params.find(p => p.name === paramName);
        const isHz = paramName.includes('Frequency');
        const isSeconds = paramName === 'attack' || paramName === 'release';
        const isPercent = paramName === 'depth' || paramName === 'sensitivity' || paramName === 'mix';
        
        document.getElementById(`drf-${paramName}-value`).textContent = 
            isHz ? `${value} Hz` :
            isSeconds ? `${value} s` :
            isPercent ? `${(value * 100).toFixed(0)}%` :
            value.toFixed(1);
    }
    
    function updateTypeButtons() {
        ['lowpass', 'highpass', 'bandpass', 'notch'].forEach(type => {
            const btn = document.getElementById(`drf-type-${type}`);
            const isActive = effect.filterType === type;
            btn.style.background = isActive ? '#00ff88' : '#3a3a5a';
            btn.style.color = isActive ? '#000' : '#fff';
        });
    }
    
    function updateSliders() {
        const currentState = effect.getState();
        params.forEach(param => {
            document.getElementById(`drf-${param.name}`).value = currentState[param.name];
            updateValueDisplay(param.name, currentState[param.name]);
        });
        document.getElementById('drf-freq-min').value = currentState.frequencyRange.min;
        document.getElementById('drf-freq-max').value = currentState.frequencyRange.max;
        document.getElementById('drf-freq-min-value').textContent = `${currentState.frequencyRange.min} Hz`;
        document.getElementById('drf-freq-max-value').textContent = `${currentState.frequencyRange.max} Hz`;
    }
    
    return panel;
}

export default DynamicResonanceFilter;