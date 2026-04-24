/**
 * MultibandGate - Frequency-selective gate for surgical dynamics control
 * Splits signal into 3 frequency bands and applies independent gating per band
 */

export class MultibandGate {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Parameters
        this.threshold = options.threshold ?? -40; // dB
        this.attack = options.attack ?? 0.01; // seconds
        this.hold = options.hold ?? 0.05; // seconds
        this.release = options.release ?? 0.1; // seconds
        this.range = options.range ?? -80; // dB (below threshold)
        this.lowBandEnabled = options.lowBandEnabled ?? true;
        this.midBandEnabled = options.midBandEnabled ?? true;
        this.highBandEnabled = options.highBandEnabled ?? true;
        
        // Crossover frequencies
        this.lowCrossover = options.lowCrossover ?? 200; // Hz
        this.highCrossover = options.highCrossover ?? 4000; // Hz
        
        // Per-band settings
        this.lowThreshold = options.lowThreshold ?? this.threshold;
        this.midThreshold = options.midThreshold ?? this.threshold;
        this.highThreshold = options.highThreshold ?? this.threshold;
        
        // Create crossover filters
        // Low band: lowpass
        this.lowLowpass = audioContext.createBiquadFilter();
        this.lowLowpass.type = 'lowpass';
        this.lowLowpass.frequency.value = this.lowCrossover;
        this.lowLowpass.Q.value = 0.7;
        
        // High band: highpass
        this.highHighpass = audioContext.createBiquadFilter();
        this.highHighpass.type = 'highpass';
        this.highHighpass.frequency.value = this.highCrossover;
        this.highHighpass.Q.value = 0.7;
        
        // Mid band: bandpass (created by subtracting low and high from full signal)
        this.midLowpass = audioContext.createBiquadFilter();
        this.midLowpass.type = 'lowpass';
        this.midLowpass.frequency.value = this.highCrossover;
        this.midLowpass.Q.value = 0.7;
        
        this.midHighpass = audioContext.createBiquadFilter();
        this.midHighpass.type = 'highpass';
        this.midHighpass.frequency.value = this.lowCrossover;
        this.midHighpass.Q.value = 0.7;
        
        // Band outputs
        this.lowGain = audioContext.createGain();
        this.midGain = audioContext.createGain();
        this.highGain = audioContext.createGain();
        
        // Signal inversion for mid band calculation
        this.inverter = audioContext.createGain();
        this.inverter.gain.value = -1;
        
        // Full signal for mid band calculation
        this.fullSignalGain = audioContext.createGain();
        this.fullSignalGain.gain.value = 1;
        
        // Analyzers for each band
        this.lowAnalyser = audioContext.createAnalyser();
        this.midAnalyser = audioContext.createAnalyser();
        this.highAnalyser = audioContext.createAnalyser();
        
        [this.lowAnalyser, this.midAnalyser, this.highAnalyser].forEach(analyser => {
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.1;
        });
        
        this.lowData = new Float32Array(this.lowAnalyser.frequencyBinCount);
        this.midData = new Float32Array(this.midAnalyser.frequencyBinCount);
        this.highData = new Float32Array(this.highAnalyser.frequencyBinCount);
        
        // Connect low band
        this.input.connect(this.lowLowpass);
        this.lowLowpass.connect(this.lowAnalyser);
        this.lowAnalyser.connect(this.lowGain);
        this.lowGain.connect(this.output);
        
        // Connect high band
        this.input.connect(this.highHighpass);
        this.highHighpass.connect(this.highAnalyser);
        this.highAnalyser.connect(this.highGain);
        this.highGain.connect(this.output);
        
        // Connect mid band (full signal - low - high)
        this.input.connect(this.midHighpass);
        this.midHighpass.connect(this.midLowpass);
        this.midLowpass.connect(this.midAnalyser);
        this.midAnalyser.connect(this.midGain);
        this.midGain.connect(this.output);
        
        // Gate state tracking
        this.lowGateOpen = false;
        this.midGateOpen = false;
        this.highGateOpen = false;
        this.lowLastAbove = 0;
        this.midLastAbove = 0;
        this.highLastAbove = 0;
        
        // Start processing
        this.processInterval = null;
        this.startProcessing();
    }
    
    dBToLinear(dB) {
        return Math.pow(10, dB / 20);
    }
    
    linearToDb(linear) {
        return 20 * Math.log10(Math.max(linear, 0.00001));
    }
    
    startProcessing() {
        this.processInterval = setInterval(() => {
            const now = this.audioContext.currentTime;
            
            // Process each band
            this.processBand('low', this.lowAnalyser, this.lowData, this.lowGain, 
                this.lowThreshold, this.lowBandEnabled, now);
            this.processBand('mid', this.midAnalyser, this.midData, this.midGain, 
                this.midThreshold, this.midBandEnabled, now);
            this.processBand('high', this.highAnalyser, this.highData, this.highGain, 
                this.highThreshold, this.highBandEnabled, now);
        }, 10); // 100Hz update rate
    }
    
    processBand(band, analyser, data, gainNode, threshold, enabled, now) {
        if (!enabled) {
            gainNode.gain.setValueAtTime(1, now);
            return;
        }
        
        analyser.getFloatTimeDomainData(data);
        
        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);
        const rmsDb = this.linearToDb(rms);
        
        const gateProp = `${band}GateOpen`;
        const lastAboveProp = `${band}LastAbove`;
        const rangeLinear = this.dBToLinear(this.range);
        
        if (rmsDb >= threshold) {
            // Signal above threshold - open gate
            this[gateProp] = true;
            this[lastAboveProp] = now;
            gainNode.gain.setTargetAtTime(1, now, this.attack);
        } else if (this[gateProp]) {
            // Signal below threshold
            const timeSinceAbove = now - this[lastAboveProp];
            
            if (timeSinceAbove > this.hold) {
                // Hold period passed - close gate
                gainNode.gain.setTargetAtTime(rangeLinear, now + this.hold, this.release);
                this[gateProp] = false;
            }
        }
    }
    
    stopProcessing() {
        if (this.processInterval) {
            clearInterval(this.processInterval);
            this.processInterval = null;
        }
    }
    
    setThreshold(dB) {
        this.threshold = dB;
    }
    
    setAttack(seconds) {
        this.attack = Math.max(0.001, seconds);
    }
    
    setHold(seconds) {
        this.hold = Math.max(0, seconds);
    }
    
    setRelease(seconds) {
        this.release = Math.max(0.01, seconds);
    }
    
    setRange(dB) {
        this.range = Math.max(-100, dB);
    }
    
    setLowThreshold(dB) {
        this.lowThreshold = dB;
    }
    
    setMidThreshold(dB) {
        this.midThreshold = dB;
    }
    
    setHighThreshold(dB) {
        this.highThreshold = dB;
    }
    
    setLowBandEnabled(enabled) {
        this.lowBandEnabled = enabled;
    }
    
    setMidBandEnabled(enabled) {
        this.midBandEnabled = enabled;
    }
    
    setHighBandEnabled(enabled) {
        this.highBandEnabled = enabled;
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
            { name: 'threshold', label: 'Threshold', min: -80, max: 0, default: -40, unit: 'dB' },
            { name: 'attack', label: 'Attack', min: 0.001, max: 0.5, default: 0.01, unit: 's' },
            { name: 'hold', label: 'Hold', min: 0, max: 1, default: 0.05, unit: 's' },
            { name: 'release', label: 'Release', min: 0.01, max: 2, default: 0.1, unit: 's' },
            { name: 'range', label: 'Range', min: -100, max: 0, default: -80, unit: 'dB' },
            { name: 'lowCrossover', label: 'Low X-Over', min: 20, max: 1000, default: 200, unit: 'Hz' },
            { name: 'highCrossover', label: 'High X-Over', min: 1000, max: 20000, default: 4000, unit: 'Hz' },
            { name: 'lowThreshold', label: 'Low Thresh', min: -80, max: 0, default: -40, unit: 'dB' },
            { name: 'midThreshold', label: 'Mid Thresh', min: -80, max: 0, default: -40, unit: 'dB' },
            { name: 'highThreshold', label: 'High Thresh', min: -80, max: 0, default: -40, unit: 'dB' }
        ];
    }
    
    getPresets() {
        return [
            { 
                name: 'Drum Gate', 
                settings: { 
                    threshold: -30, attack: 0.005, hold: 0.02, release: 0.1, range: -60,
                    lowCrossover: 100, highCrossover: 5000,
                    lowThreshold: -25, midThreshold: -30, highThreshold: -35
                } 
            },
            { 
                name: 'Vocal Breath Removal', 
                settings: { 
                    threshold: -45, attack: 0.01, hold: 0.05, release: 0.15, range: -80,
                    lowCrossover: 200, highCrossover: 6000,
                    lowThreshold: -50, midThreshold: -45, highThreshold: -40
                } 
            },
            { 
                name: 'Bass Tighten', 
                settings: { 
                    threshold: -35, attack: 0.005, hold: 0.03, release: 0.08, range: -70,
                    lowCrossover: 150, highCrossover: 3000,
                    lowThreshold: -30, midThreshold: -45, highThreshold: -50
                } 
            },
            { 
                name: 'Hi-Hat Tighten', 
                settings: { 
                    threshold: -25, attack: 0.002, hold: 0.01, release: 0.05, range: -60,
                    lowCrossover: 500, highCrossover: 8000,
                    lowThreshold: -50, midThreshold: -40, highThreshold: -25
                } 
            },
            { 
                name: 'Full Range Gate', 
                settings: { 
                    threshold: -40, attack: 0.01, hold: 0.05, release: 0.1, range: -80,
                    lowCrossover: 200, highCrossover: 4000,
                    lowThreshold: -40, midThreshold: -40, highThreshold: -40
                } 
            },
            { 
                name: 'Low End Control', 
                settings: { 
                    threshold: -35, attack: 0.01, hold: 0.05, release: 0.12, range: -70,
                    lowCrossover: 200, highCrossover: 4000,
                    lowThreshold: -30, midThreshold: -50, highThreshold: -50
                } 
            }
        ];
    }
    
    getState() {
        return {
            threshold: this.threshold,
            attack: this.attack,
            hold: this.hold,
            release: this.release,
            range: this.range,
            lowCrossover: this.lowCrossover,
            highCrossover: this.highCrossover,
            lowThreshold: this.lowThreshold,
            midThreshold: this.midThreshold,
            highThreshold: this.highThreshold,
            lowBandEnabled: this.lowBandEnabled,
            midBandEnabled: this.midBandEnabled,
            highBandEnabled: this.highBandEnabled
        };
    }
    
    setState(state) {
        if (state.threshold !== undefined) this.threshold = state.threshold;
        if (state.attack !== undefined) this.attack = state.attack;
        if (state.hold !== undefined) this.hold = state.hold;
        if (state.release !== undefined) this.release = state.release;
        if (state.range !== undefined) this.range = state.range;
        if (state.lowCrossover !== undefined) this.setLowCrossover(state.lowCrossover);
        if (state.highCrossover !== undefined) this.setHighCrossover(state.highCrossover);
        if (state.lowThreshold !== undefined) this.lowThreshold = state.lowThreshold;
        if (state.midThreshold !== undefined) this.midThreshold = state.midThreshold;
        if (state.highThreshold !== undefined) this.highThreshold = state.highThreshold;
        if (state.lowBandEnabled !== undefined) this.lowBandEnabled = state.lowBandEnabled;
        if (state.midBandEnabled !== undefined) this.midBandEnabled = state.midBandEnabled;
        if (state.highBandEnabled !== undefined) this.highBandEnabled = state.highBandEnabled;
    }
}

/**
 * UI Panel for Multiband Gate
 */
export function openMultibandGatePanel(effect, onClose) {
    const existingPanel = document.getElementById('multiband-gate-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'multiband-gate-panel';
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
            <h2 style="margin: 0; font-size: 20px; color: #00d4aa;">🎚️ Multiband Gate</h2>
            <button id="close-mbg-panel" style="background: #3a3a5a; border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer;">✕</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #a0a0a0;">Preset</label>
            <select id="mbg-preset" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #fff; font-size: 14px;">
                <option value="">-- Select Preset --</option>
                ${presets.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            </select>
        </div>
        
        <div style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6a6a8a;">Global Settings</h3>
            <div style="display: grid; gap: 12px;">
    `;
    
    // Global params
    ['threshold', 'attack', 'hold', 'release', 'range'].forEach(paramName => {
        const param = params.find(p => p.name === paramName);
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 12px; color: #a0a0a0;">${param.label}</label>
                    <span id="mbg-${param.name}-value" style="font-size: 12px; color: #00d4aa;">${state[param.name]}${param.unit}</span>
                </div>
                <input type="range" id="mbg-${param.name}" min="${param.min}" max="${param.max}" step="${param.name === 'attack' || param.name === 'hold' || param.name === 'release' ? 0.001 : 1}" value="${state[param.name]}"
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
                    <input type="checkbox" id="mbg-low-enabled" ${state.lowBandEnabled ? 'checked' : ''} style="margin-right: 4px;">
                    <label style="font-size: 12px; color: #ff6b6b;">Low Band</label>
                </div>
                <div style="flex: 1; text-align: center;">
                    <input type="checkbox" id="mbg-mid-enabled" ${state.midBandEnabled ? 'checked' : ''} style="margin-right: 4px;">
                    <label style="font-size: 12px; color: #4ecdc4;">Mid Band</label>
                </div>
                <div style="flex: 1; text-align: center;">
                    <input type="checkbox" id="mbg-high-enabled" ${state.highBandEnabled ? 'checked' : ''} style="margin-right: 4px;">
                    <label style="font-size: 12px; color: #ffe66d;">High Band</label>
                </div>
            </div>
            
            <div style="display: grid; gap: 12px;">
    `;
    
    // Crossover and band thresholds
    ['lowCrossover', 'highCrossover', 'lowThreshold', 'midThreshold', 'highThreshold'].forEach(paramName => {
        const param = params.find(p => p.name === paramName);
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 12px; color: #a0a0a0;">${param.label}</label>
                    <span id="mbg-${param.name}-value" style="font-size: 12px; color: #00d4aa;">${state[param.name]}${param.unit}</span>
                </div>
                <input type="range" id="mbg-${param.name}" min="${param.min}" max="${param.max}" step="${param.name.includes('Crossover') ? 10 : 1}" value="${state[param.name]}"
                    style="width: 100%; height: 6px; -webkit-appearance: none; background: #2a2a4e; border-radius: 3px; outline: none;">
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div style="margin-top: 20px; display: flex; gap: 12px;">
            <button id="mbg-reset" style="flex: 1; padding: 12px; background: #3a3a5a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Reset</button>
            <button id="mbg-bypass" style="flex: 1; padding: 12px; background: #4a4a6a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Bypass All</button>
        </div>
    `;
    
    panel.innerHTML = html;
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('close-mbg-panel').addEventListener('click', () => {
        panel.remove();
        if (onClose) onClose();
    });
    
    document.getElementById('mbg-preset').addEventListener('change', (e) => {
        const preset = presets.find(p => p.name === e.target.value);
        if (preset) {
            effect.setState(preset.settings);
            updateSliders();
        }
    });
    
    params.forEach(param => {
        const slider = document.getElementById(`mbg-${param.name}`);
        if (slider) {
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                const setter = `set${param.name.charAt(0).toUpperCase() + param.name.slice(1)}`;
                if (effect[setter]) {
                    effect[setter](value);
                }
                const unit = param.unit === 'dB' || param.unit === 's' || param.unit === 'Hz' ? param.unit : '';
                document.getElementById(`mbg-${param.name}-value`).textContent = `${value}${unit}`;
            });
        }
    });
    
    // Band enable checkboxes
    ['low', 'mid', 'high'].forEach(band => {
        const checkbox = document.getElementById(`mbg-${band}-enabled`);
        checkbox.addEventListener('change', (e) => {
            const setter = `set${band.charAt(0).toUpperCase() + band.slice(1)}BandEnabled`;
            effect[setter](e.target.checked);
        });
    });
    
    document.getElementById('mbg-reset').addEventListener('click', () => {
        const defaults = { 
            threshold: -40, attack: 0.01, hold: 0.05, release: 0.1, range: -80,
            lowCrossover: 200, highCrossover: 4000,
            lowThreshold: -40, midThreshold: -40, highThreshold: -40,
            lowBandEnabled: true, midBandEnabled: true, highBandEnabled: true
        };
        effect.setState(defaults);
        updateSliders();
    });
    
    document.getElementById('mbg-bypass').addEventListener('click', (e) => {
        const allBypassed = !effect.lowBandEnabled && !effect.midBandEnabled && !effect.highBandEnabled;
        effect.setLowBandEnabled(allBypassed);
        effect.setMidBandEnabled(allBypassed);
        effect.setHighBandEnabled(allBypassed);
        e.target.textContent = allBypassed ? 'Bypass All' : 'Engage All';
        document.getElementById('mbg-low-enabled').checked = allBypassed;
        document.getElementById('mbg-mid-enabled').checked = allBypassed;
        document.getElementById('mbg-high-enabled').checked = allBypassed;
    });
    
    function updateSliders() {
        const currentState = effect.getState();
        params.forEach(param => {
            const slider = document.getElementById(`mbg-${param.name}`);
            if (slider) {
                slider.value = currentState[param.name];
                const unit = param.unit === 'dB' || param.unit === 's' || param.unit === 'Hz' ? param.unit : '';
                document.getElementById(`mbg-${param.name}-value`).textContent = `${currentState[param.name]}${unit}`;
            }
        });
        document.getElementById('mbg-low-enabled').checked = currentState.lowBandEnabled;
        document.getElementById('mbg-mid-enabled').checked = currentState.midBandEnabled;
        document.getElementById('mbg-high-enabled').checked = currentState.highBandEnabled;
    }
    
    return panel;
}

export default MultibandGate;