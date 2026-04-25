// Distortion Enhancements
// Additional distortion types: tube, wave, and fuzz

class DistortionEnhancements {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.enabled = false;
        
        // Main nodes
        this.inputGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.merge = audioContext.createGain();
        this.preGain = audioContext.createGain();
        this.postGain = audioContext.createGain();
        
        // Distortion types
        this.distortionType = 'tube'; // 'tube', 'wave', 'fuzz'
        
        // Waveshaper for distortion curves
        this.tube = audioContext.createWaveShaper();
        this.wave = audioContext.createWaveShaper();
        this.fuzz = audioContext.createWaveShaper();
        
        // Parameters
        this.amount = 0.5; // 0-1
        this.mix = 0.7; // 0 = dry, 1 = wet
        this.tone = 0.5; // 0 = dark, 1 = bright
        
        // Create distortion curves
        this.tube.curve = this.createTubeCurve();
        this.tube.oversample = '4x';
        
        this.wave.curve = this.createWaveCurve();
        this.wave.oversample = '4x';
        
        this.fuzz.curve = this.createFuzzCurve();
        this.fuzz.oversample = '4x';
        
        // Tone filter
        this.toneFilter = audioContext.createBiquadFilter();
        this.toneFilter.type = 'lowpass';
        this.toneFilter.frequency.value = 5000 + (this.tone * 10000);
        
        // Set initial values
        this.preGain.gain.value = 1 + this.amount * 5;
        this.postGain.gain.value = 1 / (1 + this.amount * 2);
        this.wetGain.gain.value = this.mix;
        this.dryGain.gain.value = 1 - this.mix;
        
        // Active waveshaper (switches based on type)
        this.activeDistortion = this.tube;
        
        // Connect the graph
        this.inputGain.connect(this.preGain);
        this.preGain.connect(this.activeDistortion);
        this.activeDistortion.connect(this.toneFilter);
        this.toneFilter.connect(this.postGain);
        this.postGain.connect(this.wetGain);
        
        this.inputGain.connect(this.dryGain);
        this.wetGain.connect(this.merge);
        this.dryGain.connect(this.merge);
        this.merge.connect(this.outputGain);
    }
    
    createTubeCurve() {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            // Soft tube-like clipping with asymmetric response
            curve[i] = Math.tanh(x * 3) * 0.9 + Math.sin(x * 2) * 0.1;
        }
        
        return curve;
    }
    
    createWaveCurve() {
        const samples = 44100;
        const curve = new Float32Array(samples);
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            // Hard clipping wave shaper
            if (x < -0.5) {
                curve[i] = -1;
            } else if (x > 0.5) {
                curve[i] = 1;
            } else {
                // Square-like wave transformation
                curve[i] = Math.sign(x) * Math.pow(Math.abs(x) * 2, 0.5);
            }
        }
        
        return curve;
    }
    
    createFuzzCurve() {
        const samples = 44100;
        const curve = new Float32Array(samples);
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            // Extreme fuzz with octave doubling
            const clipped = Math.max(-1, Math.min(1, x * 10));
            curve[i] = Math.sign(clipped) * (1 - Math.exp(-Math.abs(clipped) * 3));
        }
        
        return curve;
    }
    
    setDistortionType(type) {
        if (['tube', 'wave', 'fuzz'].includes(type)) {
            this.distortionType = type;
            
            // Disconnect all
            this.preGain.disconnect();
            this.tube.disconnect();
            this.wave.disconnect();
            this.fuzz.disconnect();
            this.toneFilter.disconnect();
            this.postGain.disconnect();
            
            // Set active
            switch(type) {
                case 'tube':
                    this.activeDistortion = this.tube;
                    break;
                case 'wave':
                    this.activeDistortion = this.wave;
                    break;
                case 'fuzz':
                    this.activeDistortion = this.fuzz;
                    break;
            }
            
            // Reconnect
            this.preGain.connect(this.activeDistortion);
            this.activeDistortion.connect(this.toneFilter);
            this.toneFilter.connect(this.postGain);
        }
    }
    
    setAmount(value) {
        this.amount = Math.max(0, Math.min(1, value));
        this.preGain.gain.setTargetAtTime(1 + this.amount * 5, this.audioContext.currentTime, 0.01);
        this.postGain.gain.setTargetAtTime(1 / (1 + this.amount * 2), this.audioContext.currentTime, 0.01);
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
    }
    
    setTone(value) {
        this.tone = Math.max(0, Math.min(1, value));
        // 0 = dark (2kHz), 1 = bright (15kHz)
        this.toneFilter.frequency.setTargetAtTime(2000 + this.tone * 13000, this.audioContext.currentTime, 0.01);
    }
    
    getInput() {
        return this.inputGain;
    }
    
    getOutput() {
        return this.outputGain;
    }
    
    connect(destination) {
        this.outputGain.connect(destination);
    }
    
    disconnect() {
        this.outputGain.disconnect();
    }
    
    dispose() {
        this.inputGain.disconnect();
        this.outputGain.disconnect();
        this.wetGain.disconnect();
        this.dryGain.disconnect();
        this.merge.disconnect();
        this.preGain.disconnect();
        this.postGain.disconnect();
        this.tube.disconnect();
        this.wave.disconnect();
        this.fuzz.disconnect();
        this.toneFilter.disconnect();
    }
    
    getParams() {
        return {
            distortionType: this.distortionType,
            amount: this.amount,
            mix: this.mix,
            tone: this.tone,
            enabled: this.enabled
        };
    }
    
    setParams(params) {
        if (params.distortionType !== undefined) this.setDistortionType(params.distortionType);
        if (params.amount !== undefined) this.setAmount(params.amount);
        if (params.mix !== undefined) this.setMix(params.mix);
        if (params.tone !== undefined) this.setTone(params.tone);
        if (params.enabled !== undefined) this.enabled = params.enabled;
    }
}

// Export for use
window.DistortionEnhancements = DistortionEnhancements;