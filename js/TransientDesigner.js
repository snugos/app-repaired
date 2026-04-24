// TransientDesigner.js - Transient shaping without level dependency
// Enhance or reduce attack and sustain portions of audio signals

class TransientDesigner {
    constructor(audioContext, options = {}) {
        this.ctx = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Input/output gains
        this.inputGain = audioContext.createGain();
        this.inputGain.gain.value = options.inputGain || 1.0;
        
        this.outputGain = audioContext.createGain();
        this.outputGain.gain.value = options.outputGain || 1.0;
        
        // Splitter for multi-band processing
        this.splitter = audioContext.createChannelMerger(3);
        
        // Merger for recombining bands
        this.merger = audioContext.createChannelSplitter(3);
        
        // Low-pass filter for attack detection
        this.lowpass = audioContext.createBiquadFilter();
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.value = options.cutoffFreq || 5000;
        
        // High-pass filter for attack detection
        this.highpass = audioContext.createBiquadFilter();
        this.highpass.type = 'highpass';
        this.highpass.frequency.value = options.cutoffFreq || 5000;
        
        // Envelope followers for transient detection
        this.attackFollower = audioContext.createGain();
        this.sustainFollower = audioContext.createGain();
        
        // Attack enhancement
        this.attackGain = audioContext.createGain();
        this.attackGain.gain.value = options.attackGain || 2.0;
        
        // Sustain suppression
        this.sustainGain = audioContext.createGain();
        this.sustainGain.gain.value = options.sustainGain || 0.5;
        
        // Attack filter (bandpass for attack band)
        this.attackFilter = audioContext.createBiquadFilter();
        this.attackFilter.type = 'bandpass';
        this.attackFilter.frequency.value = options.attackFreq || 2000;
        this.attackFilter.Q.value = 1;
        
        // Sustain filter (lowpass for sustain band)
        this.sustainFilter = audioContext.createBiquadFilter();
        this.sustainFilter.type = 'lowpass';
        this.sustainFilter.frequency.value = options.sustainFreq || 1000;
        this.sustainFilter.Q.value = 1;
        
        // Transient detector
        this.transientDetector = audioContext.createBiquadFilter();
        this.transientDetector.type = 'highpass';
        this.transientDetector.frequency.value = 500;
        
        // Envelope detector
        this.envelope = audioContext.createAnalyser();
        this.envelope.fftSize = 512;
        
        // Mixing
        this.mixer = audioContext.createGain();
        this.mixer.gain.value = 1.0;
        
        // Attack/Sustain ratio (0 = all sustain, 1 = all attack)
        this.asRatio = options.asRatio || 0.5;
        
        // Connect the signal path
        this.input.connect(this.inputGain);
        this.inputGain.connect(this.attackFilter);
        this.inputGain.connect(this.sustainFilter);
        
        this.attackFilter.connect(this.attackGain);
        this.sustainFilter.connect(this.sustainGain);
        
        this.attackGain.connect(this.mixer);
        this.sustainGain.connect(this.mixer);
        
        this.mixer.connect(this.outputGain);
        this.outputGain.connect(this.output);
        
        // Parallel processing path for better transient detection
        this.inputGain.connect(this.transientDetector);
        this.transientDetector.connect(this.envelope);
        
        // State
        this.detectedAttack = 0;
        this.detectedSustain = 0;
        this.running = true;
        
        // Start analysis
        this.analyzeTransients();
    }
    
    analyzeTransients() {
        if (!this.running) return;
        
        const data = new Float32Array(this.envelope.fftSize);
        this.envelope.getFloatTimeDomainData(data);
        
        // Calculate peak and RMS
        let peak = 0;
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > peak) peak = abs;
            sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);
        
        // Simple transient detection
        const ratio = peak / (rms + 0.0001);
        
        // Smooth the values
        const coeff = 0.3;
        this.detectedAttack = coeff * ratio + (1 - coeff) * this.detectedAttack;
        this.detectedSustain = coeff * rms + (1 - coeff) * this.detectedSustain;
        
        // Apply gain based on detection
        // High transient = sharp attack, apply attack gain
        // Low transient = sustained, apply sustain gain
        const attackAmount = Math.min(3, Math.max(0.1, this.detectedAttack * this.attackGain.gain.value));
        const sustainAmount = Math.min(2, Math.max(0.1, (1 - this.detectedSustain) * this.sustainGain.gain.value));
        
        this.attackGain.gain.setTargetAtTime(attackAmount, this.ctx.currentTime, 0.01);
        this.sustainGain.gain.setTargetAtTime(sustainAmount, this.ctx.currentTime, 0.01);
        
        setTimeout(() => this.analyzeTransients(), 16);
    }
    
    setAttackGain(gain) {
        this.attackGain.gain.setTargetAtTime(Math.max(0.1, Math.min(5, gain)), this.ctx.currentTime, 0.02);
    }
    
    getAttackGain() {
        return this.attackGain.gain.value;
    }
    
    setSustainGain(gain) {
        this.sustainGain.gain.setTargetAtTime(Math.max(0.1, Math.min(3, gain)), this.ctx.currentTime, 0.02);
    }
    
    getSustainGain() {
        return this.sustainGain.gain.value;
    }
    
    setAttackFreq(freq) {
        this.attackFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
    }
    
    getAttackFreq() {
        return this.attackFilter.frequency.value;
    }
    
    setSustainFreq(freq) {
        this.sustainFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
    }
    
    getSustainFreq() {
        return this.sustainFilter.frequency.value;
    }
    
    setCutoffFreq(freq) {
        this.lowpass.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
        this.highpass.frequency.setTargetAtTime(freq * 0.5, this.ctx.currentTime, 0.02);
    }
    
    getCutoffFreq() {
        return this.lowpass.frequency.value;
    }
    
    setASRatio(ratio) {
        this.asRatio = Math.max(0, Math.min(1, ratio));
        // Adjust gains based on ratio
        const baseAttack = 1 + this.asRatio;
        const baseSustain = 1 - this.asRatio * 0.5;
        this.setAttackGain(baseAttack);
        this.setSustainGain(baseSustain);
    }
    
    getASRatio() {
        return this.asRatio;
    }
    
    setInputGain(gain) {
        this.inputGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.02);
    }
    
    getInputGain() {
        return this.inputGain.gain.value;
    }
    
    setOutputGain(gain) {
        this.outputGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.02);
    }
    
    getOutputGain() {
        return this.outputGain.gain.value;
    }
    
    getAnalyser() {
        return this.envelope;
    }
    
    getDetectedAttack() {
        return this.detectedAttack;
    }
    
    getDetectedSustain() {
        return this.detectedSustain;
    }
    
    // Preset for punchy kick drum
    applyKickPreset() {
        this.setAttackGain(3.0);
        this.setSustainGain(0.3);
        this.setAttackFreq(100);
        this.setSustainFreq(200);
    }
    
    // Preset for snappy snare
    applySnarePreset() {
        this.setAttackGain(2.5);
        this.setSustainGain(0.4);
        this.setAttackFreq(2000);
        this.setSustainFreq(500);
    }
    
    // Preset for bass punch
    applyBassPreset() {
        this.setAttackGain(2.0);
        this.setSustainGain(0.5);
        this.setAttackFreq(80);
        this.setSustainFreq(150);
    }
    
    // Preset for ambient/sustained
    applyAmbientPreset() {
        this.setAttackGain(0.5);
        this.setSustainGain(1.5);
        this.setAttackFreq(3000);
        this.setSustainFreq(800);
    }
    
    dispose() {
        this.running = false;
        this.attackFilter.disconnect();
        this.sustainFilter.disconnect();
        this.attackGain.disconnect();
        this.sustainGain.disconnect();
        this.inputGain.disconnect();
        this.outputGain.disconnect();
        this.lowpass.disconnect();
        this.highpass.disconnect();
        this.transientDetector.disconnect();
        this.envelope.disconnect();
        this.input.disconnect();
        this.output.disconnect();
    }
}

// Register with Tone namespace for effectsRegistry.createEffectInstance
if (typeof Tone !== 'undefined') {
    Tone.TransientDesigner = TransientDesigner;
}

// Register on window for direct access
if (typeof window !== 'undefined') {
    window.TransientDesigner = TransientDesigner;
}

// Register with effects registry if available
if (typeof effectsRegistry !== 'undefined') {
    effectsRegistry.register('TransientDesigner', TransientDesigner, {
        category: 'dynamics',
        parameters: {
            attackGain: { default: 2.0, min: 0.1, max: 5, step: 0.1 },
            sustainGain: { default: 0.5, min: 0.1, max: 3, step: 0.1 },
            attackFreq: { default: 2000, min: 100, max: 8000, step: 100, unit: 'Hz' },
            sustainFreq: { default: 1000, min: 100, max: 5000, step: 100, unit: 'Hz' },
            cutoffFreq: { default: 5000, min: 500, max: 15000, step: 100, unit: 'Hz' },
            asRatio: { default: 0.5, min: 0, max: 1, step: 0.01 },
            inputGain: { default: 1, min: 0, max: 2, step: 0.01 },
            outputGain: { default: 1, min: 0, max: 2, step: 0.01 }
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TransientDesigner;
}