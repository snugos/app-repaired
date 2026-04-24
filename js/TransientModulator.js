/**
 * TransientModulator - Detailed transient shaping with multi-band control
 * Allows independent control of attack and sustain transients across frequency bands
 */

export class TransientModulator {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Global parameters
        this.attackGain = options.attackGain ?? 1.0; // -2 to 2
        this.sustainGain = options.sustainGain ?? 1.0; // -2 to 2
        this.releaseGain = options.releaseGain ?? 1.0; // -2 to 2
        this.mix = options.mix ?? 1.0; // 0-1
        
        // Multi-band settings
        this.lowCrossover = options.lowCrossover ?? 200;
        this.highCrossover = options.highCrossover ?? 4000;
        
        // Per-band transient control
        this.lowAttack = options.lowAttack ?? 1.0;
        this.lowSustain = options.lowSustain ?? 1.0;
        this.midAttack = options.midAttack ?? 1.0;
        this.midSustain = options.midSustain ?? 1.0;
        this.highAttack = options.highAttack ?? 1.0;
        this.highSustain = options.highSustain ?? 1.0;
        
        // Band enable
        this.lowEnabled = options.lowEnabled ?? true;
        this.midEnabled = options.midEnabled ?? true;
        this.highEnabled = options.highEnabled ?? true;
        
        // Attack/Release times
        this.attackTime = options.attackTime ?? 0.01;
        this.sustainTime = options.sustainTime ?? 0.05;
        this.releaseTime = options.releaseTime ?? 0.1;
        
        // Create crossover network
        this.createCrossovers();
        
        // Create transient shapers for each band
        this.createTransientShapers();
        
        // Connect everything
        this.connectNodes();
        
        // Start processing
        this.processInterval = null;
        this.startProcessing();
    }
    
    createCrossovers() {
        // Low band (lowpass)
        this.lowLowpass = this.audioContext.createBiquadFilter();
        this.lowLowpass.type = 'lowpass';
        this.lowLowpass.frequency.value = this.lowCrossover;
        this.lowLowpass.Q.value = 0.7;
        
        // High band (highpass)
        this.highHighpass = this.audioContext.createBiquadFilter();
        this.highHighpass.type = 'highpass';
        this.highHighpass.frequency.value = this.highCrossover;
        this.highHighpass.Q.value = 0.7;
        
        // Mid band (bandpass)
        this.midLowpass = this.audioContext.createBiquadFilter();
        this.midLowpass.type = 'lowpass';
        this.midLowpass.frequency.value = this.highCrossover;
        this.midLowpass.Q.value = 0.7;
        
        this.midHighpass = this.audioContext.createBiquadFilter();
        this.midHighpass.type = 'highpass';
        this.midHighpass.frequency.value = this.lowCrossover;
        this.midHighpass.Q.value = 0.7;
        
        // Band gains
        this.lowInputGain = this.audioContext.createGain();
        this.midInputGain = this.audioContext.createGain();
        this.highInputGain = this.audioContext.createGain();
        
        this.lowOutputGain = this.audioContext.createGain();
        this.midOutputGain = this.audioContext.createGain();
        this.highOutputGain = this.audioContext.createGain();
        
        // Wet/dry mix
        this.dryGain = this.audioContext.createGain();
        this.wetGain = this.audioContext.createGain();
    }
    
    createTransientShapers() {
        // Analyzers for each band
        this.lowAnalyser = this.audioContext.createAnalyser();
        this.midAnalyser = this.audioContext.createAnalyser();
        this.highAnalyser = this.audioContext.createAnalyser();
        
        [this.lowAnalyser, this.midAnalyser, this.highAnalyser].forEach(a => {
            a.fftSize = 512;
            a.smoothingTimeConstant = 0.0; // No smoothing for transient detection
        });
        
        this.lowData = new Float32Array(this.lowAnalyser.frequencyBinCount);
        this.midData = new Float32Array(this.midAnalyser.frequencyBinCount);
        this.highData = new Float32Array(this.highAnalyser.frequencyBinCount);
        
        // History for transient detection
        this.lowHistory = [];
        this.midHistory = [];
        this.highHistory = [];
        this.historyLength = 10;
    }
    
    connectNodes() {
        // Dry signal
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Low band
        this.input.connect(this.lowInputGain);
        this.lowInputGain.connect(this.lowLowpass);
        this.lowLowpass.connect(this.lowAnalyser);
        this.lowAnalyser.connect(this.lowOutputGain);
        this.lowOutputGain.connect(this.wetGain);
        
        // Mid band
        this.input.connect(this.midInputGain);
        this.midInputGain.connect(this.midHighpass);
        this.midHighpass.connect(this.midLowpass);
        this.midLowpass.connect(this.midAnalyser);
        this.midAnalyser.connect(this.midOutputGain);
        this.midOutputGain.connect(this.wetGain);
        
        // High band
        this.input.connect(this.highInputGain);
        this.highInputGain.connect(this.highHighpass);
        this.highHighpass.connect(this.highAnalyser);
        this.highAnalyser.connect(this.highOutputGain);
        this.highOutputGain.connect(this.wetGain);
        
        // Wet output
        this.wetGain.connect(this.output);
        
        // Set initial mix
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
    }
    
    calculateTransientRMS(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        return Math.sqrt(sum / data.length);
    }
    
    detectTransient(history, currentRMS) {
        if (history.length < 3) return { attack: 0, sustain: 0, release: 0 };
        
        // Calculate rate of change
        const recent = history.slice(-5);
        const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
        
        // Attack: sudden increase
        const attack = Math.max(0, currentRMS - avgRecent) * 10;
        
        // Sustain: current level relative to recent
        const sustain = currentRMS;
        
        // Release: sudden decrease
        const release = Math.max(0, avgRecent - currentRMS) * 10;
        
        return { attack, sustain, release };
    }
    
    startProcessing() {
        this.processInterval = setInterval(() => {
            const now = this.audioContext.currentTime;
            
            // Process each band
            this.processBand('low', this.lowAnalyser, this.lowData, this.lowHistory, 
                this.lowOutputGain, this.lowAttack, this.lowSustain, this.lowEnabled, now);
            this.processBand('mid', this.midAnalyser, this.midData, this.midHistory, 
                this.midOutputGain, this.midAttack, this.midSustain, this.midEnabled, now);
            this.processBand('high', this.highAnalyser, this.highData, this.highHistory, 
                this.highOutputGain, this.highAttack, this.highSustain, this.highEnabled, now);
        }, 5); // 200Hz update rate for fast transient response
    }
    
    processBand(band, analyser, data, history, outputGain, attackMult, sustainMult, enabled, now) {
        analyser.getFloatTimeDomainData(data);
        const rms = this.calculateTransientRMS(data);
        
        // Update history
        history.push(rms);
        if (history.length > this.historyLength) {
            history.shift();
        }
        
        if (!enabled) {
            outputGain.gain.setValueAtTime(1, now);
            return;
        }
        
        const transient = this.detectTransient(history, rms);
        
        // Calculate gain based on attack and sustain
        let gain = 1.0;
        
        // Attack emphasis
        if (transient.attack > 0) {
            const attackBoost = 1 + (transient.attack * (attackMult - 1) * 0.5);
            gain *= attackBoost;
        }
        
        // Sustain control
        const sustainFactor = 1 + (sustainMult - 1) * transient.sustain * 0.5;
        gain *= sustainFactor;
        
        // Clamp gain
        gain = Math.max(0.01, Math.min(4, gain));
        
        // Apply with smoothing
        outputGain.gain.setTargetAtTime(gain, now, 0.005);
    }
    
    stopProcessing() {
        if (this.processInterval) {
            clearInterval(this.processInterval);
            this.processInterval = null;
        }
    }
    
    // Setters
    setAttackGain(value) {
        this.attackGain = value;
    }
    
    setSustainGain(value) {
        this.sustainGain = value;
    }
    
    setReleaseGain(value) {
        this.releaseGain = value;
    }
    
    setMix(value) {
        this.mix = value;
        this.dryGain.gain.value = 1 - value;
        this.wetGain.gain.value = value;
    }
    
    setLowAttack(value) {
        this.lowAttack = value;
    }
    
    setLowSustain(value) {
        this.lowSustain = value;
    }
    
    setMidAttack(value) {
        this.midAttack = value;
    }
    
    setMidSustain(value) {
        this.midSustain = value;
    }
    
    setHighAttack(value) {
        this.highAttack = value;
    }
    
    setHighSustain(value) {
        this.highSustain = value;
    }
    
    setLowEnabled(enabled) {
        this.lowEnabled = enabled;
        if (!enabled) {
            this.lowOutputGain.gain.value = 1;
        }
    }
    
    setMidEnabled(enabled) {
        this.midEnabled = enabled;
        if (!enabled) {
            this.midOutputGain.gain.value = 1;
        }
    }
    
    setHighEnabled(enabled) {
        this.highEnabled = enabled;
        if (!enabled) {
            this.highOutputGain.gain.value = 1;
        }
    }
    
    setLowCrossover(freq) {
        this.lowCrossover = freq;
        this.lowLowpass.frequency.value = freq;
        this.midHighpass.frequency.value = freq;
    }
    
    setHighCrossover(freq) {
        this.highCrossover = freq;
        this.highHighpass.frequency.value = freq;
        this.midLowpass.frequency.value = freq;
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
            { name: 'attackGain', label: 'Attack', min: 0, max: 3, default: 1, unit: '' },
            { name: 'sustainGain', label: 'Sustain', min: 0, max: 3, default: 1, unit: '' },
            { name: 'releaseGain', label: 'Release', min: 0, max: 3, default: 1, unit: '' },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 1, unit: '' },
            { name: 'lowCrossover', label: 'Low X-Over', min: 20, max: 1000, default: 200, unit: 'Hz' },
            { name: 'highCrossover', label: 'High X-Over', min: 1000, max: 20000, default: 4000, unit: 'Hz' },
            { name: 'lowAttack', label: 'Low Attack', min: 0, max: 3, default: 1, unit: '' },
            { name: 'lowSustain', label: 'Low Sustain', min: 0, max: 3, default: 1, unit: '' },
            { name: 'midAttack', label: 'Mid Attack', min: 0, max: 3, default: 1, unit: '' },
            { name: 'midSustain', label: 'Mid Sustain', min: 0, max: 3, default: 1, unit: '' },
            { name: 'highAttack', label: 'High Attack', min: 0, max: 3, default: 1, unit: '' },
            { name: 'highSustain', label: 'High Sustain', min: 0, max: 3, default: 1, unit: '' }
        ];
    }
    
    getPresets() {
        return [
            { 
                name: 'Drum Punch', 
                settings: { 
                    attackGain: 1.5, sustainGain: 0.8, releaseGain: 1, mix: 1,
                    lowCrossover: 100, highCrossover: 5000,
                    lowAttack: 1.3, lowSustain: 0.7,
                    midAttack: 1.6, midSustain: 0.8,
                    highAttack: 2.0, highSustain: 0.6
                } 
            },
            { 
                name: 'Transient Sweetener', 
                settings: { 
                    attackGain: 1.3, sustainGain: 0.9, releaseGain: 1, mix: 0.7,
                    lowCrossover: 200, highCrossover: 4000,
                    lowAttack: 1.2, lowSustain: 0.9,
                    midAttack: 1.4, midSustain: 0.85,
                    highAttack: 1.5, highSustain: 0.8
                } 
            },
            { 
                name: 'Tighten Bass', 
                settings: { 
                    attackGain: 1.2, sustainGain: 0.7, releaseGain: 1, mix: 1,
                    lowCrossover: 150, highCrossover: 3000,
                    lowAttack: 1.5, lowSustain: 0.6,
                    midAttack: 1.2, midSustain: 0.8,
                    highAttack: 1.0, highSustain: 1.0
                } 
            },
            { 
                name: 'Snap Attack', 
                settings: { 
                    attackGain: 2.0, sustainGain: 0.7, releaseGain: 0.8, mix: 1,
                    lowCrossover: 200, highCrossover: 6000,
                    lowAttack: 1.5, lowSustain: 0.7,
                    midAttack: 2.0, midSustain: 0.6,
                    highAttack: 2.5, highSustain: 0.5
                } 
            },
            { 
                name: 'Subtle Enhancement', 
                settings: { 
                    attackGain: 1.1, sustainGain: 0.95, releaseGain: 1, mix: 0.5,
                    lowCrossover: 200, highCrossover: 4000,
                    lowAttack: 1.05, lowSustain: 0.95,
                    midAttack: 1.1, midSustain: 0.95,
                    highAttack: 1.15, highSustain: 0.9
                } 
            },
            { 
                name: 'Hi-Hat Crisp', 
                settings: { 
                    attackGain: 1.0, sustainGain: 1.0, releaseGain: 1, mix: 1,
                    lowCrossover: 500, highCrossover: 8000,
                    lowAttack: 1.0, lowSustain: 1.0,
                    midAttack: 1.2, midSustain: 0.9,
                    highAttack: 1.8, highSustain: 0.6
                } 
            }
        ];
    }
    
    getState() {
        return {
            attackGain: this.attackGain,
            sustainGain: this.sustainGain,
            releaseGain: this.releaseGain,
            mix: this.mix,
            lowCrossover: this.lowCrossover,
            highCrossover: this.highCrossover,
            lowAttack: this.lowAttack,
            lowSustain: this.lowSustain,
            midAttack: this.midAttack,
            midSustain: this.midSustain,
            highAttack: this.highAttack,
            highSustain: this.highSustain,
            lowEnabled: this.lowEnabled,
            midEnabled: this.midEnabled,
            highEnabled: this.highEnabled
        };
    }
    
    setState(state) {
        if (state.attackGain !== undefined) this.attackGain = state.attackGain;
        if (state.sustainGain !== undefined) this.sustainGain = state.sustainGain;
        if (state.releaseGain !== undefined) this.releaseGain = state.releaseGain;
        if (state.mix !== undefined) this.setMix(state.mix);
        if (state.lowCrossover !== undefined) this.setLowCrossover(state.lowCrossover);
        if (state.highCrossover !== undefined) this.setHighCrossover(state.highCrossover);
        if (state.lowAttack !== undefined) this.lowAttack = state.lowAttack;
        if (state.lowSustain !== undefined) this.lowSustain = state.lowSustain;
        if (state.midAttack !== undefined) this.midAttack = state.midAttack;
        if (state.midSustain !== undefined) this.midSustain = state.midSustain;
        if (state.highAttack !== undefined) this.highAttack = state.highAttack;
        if (state.highSustain !== undefined) this.highSustain = state.highSustain;
        if (state.lowEnabled !== undefined) this.lowEnabled = state.lowEnabled;
        if (state.midEnabled !== undefined) this.midEnabled = state.midEnabled;
        if (state.highEnabled !== undefined) this.highEnabled = state.highEnabled;
    }
}

/**
 * UI Panel for Transient Modulator
 */
export function openTransientModulatorPanel(effect, onClose) {
    const existingPanel = document.getElementById('transient-modulator-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'transient-modulator-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #4a4a6a;
        border-radius: 12px;
        padding: 24px;
        min-width: 500px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
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
            <h2 style="margin: 0; font-size: 20px; color: #ff6b9d;">⚡ Transient Modulator</h2>
            <button id="close-tm-panel" style="background: #3a3a5a; border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer;">✕</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #a0a0a0;">Preset</label>
            <select id="tm-preset" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #fff; font-size: 14px;">
                <option value="">-- Select Preset --</option>
                ${presets.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            </select>
        </div>
        
        <div style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6a6a8a;">Global Controls</h3>
            <div style="display: grid; gap: 12px;">
    `;
    
    ['attackGain', 'sustainGain', 'releaseGain', 'mix'].forEach(paramName => {
        const param = params.find(p => p.name === paramName);
        const isPercent = paramName === 'mix';
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 12px; color: #a0a0a0;">${param.label}</label>
                    <span id="tm-${paramName}-value" style="font-size: 12px; color: #ff6b9d;">${isPercent ? (state[paramName] * 100).toFixed(0) + '%' : state[paramName].toFixed(2)}</span>
                </div>
                <input type="range" id="tm-${paramName}" min="${param.min}" max="${param.max}" step="0.01" value="${state[paramName]}"
                    style="width: 100%; height: 6px; -webkit-appearance: none; background: #2a2a4e; border-radius: 3px; outline: none;">
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6a6a8a;">Band Controls</h3>
            
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <div style="flex: 1; text-align: center;">
                    <input type="checkbox" id="tm-low-enabled" ${state.lowEnabled ? 'checked' : ''} style="margin-right: 4px;">
                    <label style="font-size: 12px; color: #ff6b6b;">Low</label>
                </div>
                <div style="flex: 1; text-align: center;">
                    <input type="checkbox" id="tm-mid-enabled" ${state.midEnabled ? 'checked' : ''} style="margin-right: 4px;">
                    <label style="font-size: 12px; color: #4ecdc4;">Mid</label>
                </div>
                <div style="flex: 1; text-align: center;">
                    <input type="checkbox" id="tm-high-enabled" ${state.highEnabled ? 'checked' : ''} style="margin-right: 4px;">
                    <label style="font-size: 12px; color: #ffe66d;">High</label>
                </div>
            </div>
            
            <div style="display: grid; gap: 12px;">
    `;
    
    ['lowCrossover', 'highCrossover', 'lowAttack', 'lowSustain', 'midAttack', 'midSustain', 'highAttack', 'highSustain'].forEach(paramName => {
        const param = params.find(p => p.name === paramName);
        const isHz = paramName.includes('Crossover');
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 12px; color: #a0a0a0;">${param.label}</label>
                    <span id="tm-${paramName}-value" style="font-size: 12px; color: #ff6b9d;">${isHz ? state[paramName] + ' Hz' : state[paramName].toFixed(2)}</span>
                </div>
                <input type="range" id="tm-${paramName}" min="${param.min}" max="${param.max}" step="${isHz ? 10 : 0.01}" value="${state[paramName]}"
                    style="width: 100%; height: 6px; -webkit-appearance: none; background: #2a2a4e; border-radius: 3px; outline: none;">
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div style="margin-top: 20px; display: flex; gap: 12px;">
            <button id="tm-reset" style="flex: 1; padding: 12px; background: #3a3a5a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Reset</button>
            <button id="tm-bypass" style="flex: 1; padding: 12px; background: #4a4a6a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Bypass</button>
        </div>
        
        <div style="margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 6px; font-size: 12px; color: #6a6a8a;">
            <strong>Tip:</strong> Attack controls transient emphasis, Sustain controls body level. Values above 1 boost, below 1 reduce.
        </div>
    `;
    
    panel.innerHTML = html;
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('close-tm-panel').addEventListener('click', () => {
        panel.remove();
        if (onClose) onClose();
    });
    
    document.getElementById('tm-preset').addEventListener('change', (e) => {
        const preset = presets.find(p => p.name === e.target.value);
        if (preset) {
            effect.setState(preset.settings);
            updateSliders();
        }
    });
    
    params.forEach(param => {
        const slider = document.getElementById(`tm-${param.name}`);
        if (slider) {
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                const setter = `set${param.name.charAt(0).toUpperCase() + param.name.slice(1)}`;
                if (effect[setter]) {
                    effect[setter](value);
                }
                const isPercent = param.name === 'mix';
                const isHz = param.name.includes('Crossover');
                document.getElementById(`tm-${param.name}-value`).textContent = 
                    isPercent ? `${(value * 100).toFixed(0)}%` : 
                    isHz ? `${value} Hz` : value.toFixed(2);
            });
        }
    });
    
    ['low', 'mid', 'high'].forEach(band => {
        const checkbox = document.getElementById(`tm-${band}-enabled`);
        checkbox.addEventListener('change', (e) => {
            const setter = `set${band.charAt(0).toUpperCase() + band.slice(1)}Enabled`;
            effect[setter](e.target.checked);
        });
    });
    
    document.getElementById('tm-reset').addEventListener('click', () => {
        const defaults = { 
            attackGain: 1, sustainGain: 1, releaseGain: 1, mix: 1,
            lowCrossover: 200, highCrossover: 4000,
            lowAttack: 1, lowSustain: 1, midAttack: 1, midSustain: 1, highAttack: 1, highSustain: 1,
            lowEnabled: true, midEnabled: true, highEnabled: true
        };
        effect.setState(defaults);
        updateSliders();
    });
    
    document.getElementById('tm-bypass').addEventListener('click', (e) => {
        const isBypassed = effect.mix === 0;
        effect.setMix(isBypassed ? 1 : 0);
        e.target.textContent = isBypassed ? 'Bypass' : 'Engage';
        e.target.style.background = isBypassed ? '#4a4a6a' : '#ff6b9d';
    });
    
    function updateSliders() {
        const currentState = effect.getState();
        params.forEach(param => {
            const slider = document.getElementById(`tm-${param.name}`);
            if (slider) {
                slider.value = currentState[param.name];
                const isPercent = param.name === 'mix';
                const isHz = param.name.includes('Crossover');
                document.getElementById(`tm-${param.name}-value`).textContent = 
                    isPercent ? `${(currentState[param.name] * 100).toFixed(0)}%` : 
                    isHz ? `${currentState[param.name]} Hz` : currentState[param.name].toFixed(2);
            }
        });
        document.getElementById('tm-low-enabled').checked = currentState.lowEnabled;
        document.getElementById('tm-mid-enabled').checked = currentState.midEnabled;
        document.getElementById('tm-high-enabled').checked = currentState.highEnabled;
    }
    
    return panel;
}

export default TransientModulator;