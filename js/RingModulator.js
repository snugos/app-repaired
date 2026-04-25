// Ring Modulator Effect
// Multiplies input signal with a carrier oscillator for metallic/robotic tones

class RingModulator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.enabled = false;
        
        // Main nodes
        this.inputGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        this.carrierOsc = audioContext.createOscillator();
        this.modGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.mergeGain = audioContext.createGain();
        
        // Carrier frequency
        this.frequency = 440;
        this.carrierOsc.frequency.value = this.frequency;
        
        // Waveform type
        this.waveform = 'sine';
        this.carrierOsc.type = this.waveform;
        
        // Mix control (0 = dry, 1 = wet)
        this.mix = 0.5;
        this.wetGain.gain.value = this.mix;
        this.dryGain.gain.value = 1 - this.mix;
        
        // Modulation depth
        this.depth = 1.0;
        this.modGain.gain.value = this.depth;
        
        // Carrier level
        this.carrierLevel = 1.0;
        
        // Connect the ring modulator graph
        // Input → Split → Dry path → Merge
        //                 └→ Mod path (modulated carrier) → Merge → Output
        
        this.inputGain.connect(this.dryGain);
        this.inputGain.connect(this.modGain);
        
        this.carrierOsc.connect(this.modGain);
        this.modGain.connect(this.mergeGain);
        
        this.dryGain.connect(this.outputGain);
        this.mergeGain.connect(this.outputGain);
        
        // Start carrier
        this.carrierOsc.start();
    }
    
    setFrequency(freq) {
        this.frequency = freq;
        this.carrierOsc.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01);
    }
    
    setWaveform(type) {
        this.waveform = type;
        this.carrierOsc.type = type;
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this.dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
    }
    
    setDepth(value) {
        this.depth = Math.max(0, Math.min(2, value));
        this.modGain.gain.setTargetAtTime(this.depth, this.audioContext.currentTime, 0.01);
    }
    
    setCarrierLevel(value) {
        this.carrierLevel = Math.max(0, Math.min(2, value));
        this.modGain.gain.setTargetAtTime(this.depth * this.carrierLevel, this.audioContext.currentTime, 0.01);
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
        this.carrierOsc.stop();
        this.inputGain.disconnect();
        this.outputGain.disconnect();
        this.dryGain.disconnect();
        this.wetGain.disconnect();
        this.mergeGain.disconnect();
        this.modGain.disconnect();
    }
    
    // Get current parameters for UI
    getParams() {
        return {
            frequency: this.frequency,
            waveform: this.waveform,
            mix: this.mix,
            depth: this.depth,
            carrierLevel: this.carrierLevel,
            enabled: this.enabled
        };
    }
    
    // Set parameters from object
    setParams(params) {
        if (params.frequency !== undefined) this.setFrequency(params.frequency);
        if (params.waveform !== undefined) this.setWaveform(params.waveform);
        if (params.mix !== undefined) this.setMix(params.mix);
        if (params.depth !== undefined) this.setDepth(params.depth);
        if (params.carrierLevel !== undefined) this.setCarrierLevel(params.carrierLevel);
        if (params.enabled !== undefined) this.enabled = params.enabled;
    }
}

// Export for use
window.RingModulator = RingModulator;