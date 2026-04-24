/**
 * VocalDoubler - Automatic vocal doubling with pitch and timing variation
 * Creates thick, wide vocal sounds by simulating multiple layered performances
 */

export class VocalDoubler {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Parameters
        this.detune = options.detune ?? 10; // cents (0-50)
        this.timing = options.timing ?? 15; // ms (0-50)
        this.voices = options.voices ?? 2; // Number of doubled voices (1-4)
        this.width = options.width ?? 0.8; // Stereo width (0-1)
        this.mix = options.mix ?? 0.5; // Dry/wet mix
        this.formantShift = options.formantShift ?? 0; // Formant shift in semitones
        this.pitchRandom = options.pitchRandom ?? 5; // Random pitch variation in cents
        this.timingRandom = options.timingRandom ?? 5; // Random timing variation in ms
        
        // Create voice nodes
        this.voiceNodes = [];
        this.delayNodes = [];
        this.panNodes = [];
        
        // Dry/wet mix
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Initialize voices
        this.createVoices();
        
        // Connect dry signal
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Set initial mix
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
    }
    
    createVoices() {
        // Clear existing
        this.voiceNodes.forEach(v => {
            if (v.disconnect) v.disconnect();
        });
        this.delayNodes.forEach(d => {
            if (d.disconnect) d.disconnect();
        });
        this.panNodes.forEach(p => {
            if (p.disconnect) p.disconnect();
        });
        
        this.voiceNodes = [];
        this.delayNodes = [];
        this.panNodes = [];
        
        // Create voice delay lines with pitch modulation
        for (let i = 0; i < this.voices; i++) {
            // Delay for timing offset
            const delay = this.audioContext.createDelay(0.1);
            delay.delayTime.value = this.timing / 1000;
            
            // Gain for this voice
            const voiceGain = this.audioContext.createGain();
            voiceGain.gain.value = 1 / (this.voices + 1);
            
            // Panner for stereo width
            const panner = this.audioContext.createStereoPanner();
            // Alternate left/right for width
            const panValue = (i % 2 === 0 ? -1 : 1) * this.width * (0.5 + (i * 0.1));
            panner.pan.value = Math.max(-1, Math.min(1, panValue));
            
            // Modulation for pitch variation (using oscillator on delay time)
            const lfo = this.audioContext.createOscillator();
            const lfoGain = this.audioContext.createGain();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + (i * 0.05); // Different rate per voice
            lfoGain.gain.value = this.pitchRandom / 1000; // Small timing modulation for pitch effect
            lfo.connect(lfoGain);
            lfoGain.connect(delay.delayTime);
            lfo.start();
            
            // Connect voice chain
            this.input.connect(delay);
            delay.connect(voiceGain);
            voiceGain.connect(panner);
            panner.connect(this.wetGain);
            
            this.voiceNodes.push({ gain: voiceGain, lfo, lfoGain });
            this.delayNodes.push(delay);
            this.panNodes.push(panner);
        }
        
        // Connect wet output
        this.wetGain.connect(this.output);
    }
    
    setDetune(cents) {
        this.detune = Math.max(0, Math.min(50, cents));
        // Detune is implemented via timing modulation
        this.voiceNodes.forEach((v, i) => {
            v.lfoGain.gain.value = (this.detune + (i * this.pitchRandom / 10)) / 1000;
        });
    }
    
    setTiming(ms) {
        this.timing = Math.max(0, Math.min(50, ms));
        this.delayNodes.forEach((delay, i) => {
            const baseDelay = this.timing / 1000;
            const randomOffset = (i * this.timingRandom / 1000) - (this.timingRandom / 2000);
            delay.delayTime.value = baseDelay + randomOffset;
        });
    }
    
    setVoices(count) {
        this.voices = Math.max(1, Math.min(4, count));
        this.createVoices();
        this.updateWidth();
    }
    
    setWidth(value) {
        this.width = Math.max(0, Math.min(1, value));
        this.updateWidth();
    }
    
    updateWidth() {
        this.panNodes.forEach((panner, i) => {
            const panValue = (i % 2 === 0 ? -1 : 1) * this.width * (0.5 + (i * 0.1));
            panner.pan.value = Math.max(-1, Math.min(1, panValue));
        });
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
    }
    
    setFormantShift(semitones) {
        this.formantShift = semitones;
        // Formant shifting would require formant filter adjustment
        // Simplified implementation
    }
    
    setPitchRandom(cents) {
        this.pitchRandom = Math.max(0, Math.min(20, cents));
        this.voiceNodes.forEach((v, i) => {
            v.lfoGain.gain.value = (this.detune + (i * this.pitchRandom / 10)) / 1000;
        });
    }
    
    setTimingRandom(ms) {
        this.timingRandom = Math.max(0, Math.min(20, ms));
        this.delayNodes.forEach((delay, i) => {
            const baseDelay = this.timing / 1000;
            const randomOffset = (i * this.timingRandom / 1000) - (this.timingRandom / 2000);
            delay.delayTime.value = baseDelay + randomOffset;
        });
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.voiceNodes.forEach(v => {
            if (v.lfo) v.lfo.stop();
        });
        this.output.disconnect();
    }
    
    getParameterDefinitions() {
        return [
            { name: 'detune', label: 'Detune', min: 0, max: 50, default: 10, unit: 'cents' },
            { name: 'timing', label: 'Timing', min: 0, max: 50, default: 15, unit: 'ms' },
            { name: 'voices', label: 'Voices', min: 1, max: 4, default: 2, unit: '' },
            { name: 'width', label: 'Width', min: 0, max: 1, default: 0.8, unit: '' },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, unit: '' },
            { name: 'pitchRandom', label: 'Pitch Random', min: 0, max: 20, default: 5, unit: 'cents' },
            { name: 'timingRandom', label: 'Timing Random', min: 0, max: 20, default: 5, unit: 'ms' }
        ];
    }
    
    getPresets() {
        return [
            { 
                name: 'Subtle Double', 
                settings: { 
                    detune: 5, timing: 10, voices: 1, width: 0.3, mix: 0.3,
                    pitchRandom: 2, timingRandom: 3
                } 
            },
            { 
                name: 'Classic Double', 
                settings: { 
                    detune: 10, timing: 15, voices: 2, width: 0.7, mix: 0.5,
                    pitchRandom: 5, timingRandom: 5
                } 
            },
            { 
                name: 'Wide Stereo', 
                settings: { 
                    detune: 15, timing: 20, voices: 3, width: 1.0, mix: 0.6,
                    pitchRandom: 8, timingRandom: 8
                } 
            },
            { 
                name: 'Thick Chorus', 
                settings: { 
                    detune: 20, timing: 25, voices: 4, width: 0.9, mix: 0.7,
                    pitchRandom: 10, timingRandom: 10
                } 
            },
            { 
                name: 'ADT (Automatic Double Tracking)', 
                settings: { 
                    detune: 8, timing: 12, voices: 1, width: 0.5, mix: 0.4,
                    pitchRandom: 3, timingRandom: 4
                } 
            },
            { 
                name: 'Ensemble', 
                settings: { 
                    detune: 12, timing: 18, voices: 4, width: 0.8, mix: 0.65,
                    pitchRandom: 7, timingRandom: 7
                } 
            },
            { 
                name: 'Demo vocal', 
                settings: { 
                    detune: 25, timing: 30, voices: 2, width: 0.6, mix: 0.55,
                    pitchRandom: 12, timingRandom: 12
                } 
            }
        ];
    }
    
    getState() {
        return {
            detune: this.detune,
            timing: this.timing,
            voices: this.voices,
            width: this.width,
            mix: this.mix,
            formantShift: this.formantShift,
            pitchRandom: this.pitchRandom,
            timingRandom: this.timingRandom
        };
    }
    
    setState(state) {
        if (state.detune !== undefined) this.setDetune(state.detune);
        if (state.timing !== undefined) this.setTiming(state.timing);
        if (state.voices !== undefined) this.setVoices(state.voices);
        if (state.width !== undefined) this.setWidth(state.width);
        if (state.mix !== undefined) this.setMix(state.mix);
        if (state.formantShift !== undefined) this.formantShift = state.formantShift;
        if (state.pitchRandom !== undefined) this.setPitchRandom(state.pitchRandom);
        if (state.timingRandom !== undefined) this.setTimingRandom(state.timingRandom);
    }
}

/**
 * UI Panel for Vocal Doubler
 */
export function openVocalDoublerPanel(effect, onClose) {
    const existingPanel = document.getElementById('vocal-doubler-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'vocal-doubler-panel';
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
            <h2 style="margin: 0; font-size: 20px; color: #ff88ff;">🎤 Vocal Doubler</h2>
            <button id="close-vd-panel" style="background: #3a3a5a; border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer;">✕</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #a0a0a0;">Preset</label>
            <select id="vd-preset" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #fff; font-size: 14px;">
                <option value="">-- Select Preset --</option>
                ${presets.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            </select>
        </div>
        
        <!-- Voice Count -->
        <div style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6a6a8a;">Voices</h3>
            <div style="display: flex; gap: 8px;">
                ${[1, 2, 3, 4].map(v => `
                    <button id="vd-voice-${v}" style="flex: 1; padding: 12px; background: ${state.voices === v ? '#ff88ff' : '#3a3a5a'}; border: none; color: ${state.voices === v ? '#000' : '#fff'}; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">
                        ${v}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div style="display: grid; gap: 16px;">
    `;
    
    params.forEach(param => {
        // Skip voices as it's handled with buttons
        if (param.name === 'voices') return;
        
        const isCents = param.name.includes('detune') || param.name.includes('pitchRandom');
        const isMs = param.name.includes('timing') || param.name.includes('timingRandom');
        const isPercent = param.name === 'width' || param.name === 'mix';
        
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 13px; color: #a0a0a0;">${param.label}</label>
                    <span id="vd-${param.name}-value" style="font-size: 13px; color: #ff88ff;">${
                        isCents ? state[param.name] + ' cents' :
                        isMs ? state[param.name] + ' ms' :
                        isPercent ? (state[param.name] * 100).toFixed(0) + '%' :
                        state[param.name]
                    }</span>
                </div>
                <input type="range" id="vd-${param.name}" min="${param.min}" max="${param.max}" step="${isPercent ? 0.01 : 1}" value="${state[param.name]}"
                    style="width: 100%; height: 6px; -webkit-appearance: none; background: #2a2a4e; border-radius: 3px; outline: none;">
            </div>
        `;
    });
    
    html += `
        </div>
        
        <div style="margin-top: 20px; display: flex; gap: 12px;">
            <button id="vd-reset" style="flex: 1; padding: 12px; background: #3a3a5a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Reset</button>
            <button id="vd-bypass" style="flex: 1; padding: 12px; background: #4a4a6a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Bypass</button>
        </div>
        
        <div style="margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 6px; font-size: 12px; color: #6a6a8a;">
            <strong>Tip:</strong> More voices = thicker sound. Increase detune and timing for a more pronounced effect.
        </div>
    `;
    
    panel.innerHTML = html;
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('close-vd-panel').addEventListener('click', () => {
        panel.remove();
        if (onClose) onClose();
    });
    
    document.getElementById('vd-preset').addEventListener('change', (e) => {
        const preset = presets.find(p => p.name === e.target.value);
        if (preset) {
            effect.setState(preset.settings);
            updateSliders();
            updateVoiceButtons();
        }
    });
    
    // Voice buttons
    [1, 2, 3, 4].forEach(v => {
        document.getElementById(`vd-voice-${v}`).addEventListener('click', () => {
            effect.setVoices(v);
            updateVoiceButtons();
        });
    });
    
    params.forEach(param => {
        if (param.name === 'voices') return;
        
        const slider = document.getElementById(`vd-${param.name}`);
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const setter = `set${param.name.charAt(0).toUpperCase() + param.name.slice(1)}`;
            if (effect[setter]) {
                effect[setter](value);
            }
            updateValueDisplay(param.name, value);
        });
    });
    
    document.getElementById('vd-reset').addEventListener('click', () => {
        const defaults = { 
            detune: 10, timing: 15, voices: 2, width: 0.8, mix: 0.5,
            pitchRandom: 5, timingRandom: 5
        };
        effect.setState(defaults);
        updateSliders();
        updateVoiceButtons();
    });
    
    document.getElementById('vd-bypass').addEventListener('click', (e) => {
        const isBypassed = effect.mix === 0;
        effect.setMix(isBypassed ? 0.5 : 0);
        e.target.textContent = isBypassed ? 'Bypass' : 'Engage';
        e.target.style.background = isBypassed ? '#4a4a6a' : '#ff88ff';
        e.target.style.color = isBypassed ? '#fff' : '#000';
    });
    
    function updateValueDisplay(paramName, value) {
        const isCents = paramName.includes('detune') || paramName.includes('pitchRandom');
        const isMs = paramName.includes('timing') || paramName.includes('timingRandom');
        const isPercent = paramName === 'width' || paramName === 'mix';
        
        document.getElementById(`vd-${paramName}-value`).textContent = 
            isCents ? `${value} cents` :
            isMs ? `${value} ms` :
            isPercent ? `${(value * 100).toFixed(0)}%` :
            value;
    }
    
    function updateVoiceButtons() {
        [1, 2, 3, 4].forEach(v => {
            const btn = document.getElementById(`vd-voice-${v}`);
            const isActive = effect.voices === v;
            btn.style.background = isActive ? '#ff88ff' : '#3a3a5a';
            btn.style.color = isActive ? '#000' : '#fff';
        });
    }
    
    function updateSliders() {
        const currentState = effect.getState();
        params.forEach(param => {
            if (param.name === 'voices') return;
            const slider = document.getElementById(`vd-${param.name}`);
            if (slider) {
                slider.value = currentState[param.name];
                updateValueDisplay(param.name, currentState[param.name]);
            }
        });
    }
    
    return panel;
}

export default VocalDoubler;