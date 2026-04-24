// js/VocoderWorklet.js - AudioWorklet-based Vocoder for robot/voice effects
// Uses modulator signal to shape carrier through filter bank analysis

class VocoderWorklet {
    constructor(initialParams = {}) {
        this._bandCount = initialParams.bandCount !== undefined ? initialParams.bandCount : 28;
        this._wet = initialParams.wet !== undefined ? initialParams.wet : 1;
        this._carrierGain = initialParams.carrierGain !== undefined ? initialParams.carrierGain : 1;
        this._modulatorGain = initialParams.modulatorGain !== undefined ? initialParams.modulatorGain : 1;
        
        // Clamp band count
        this._bandCount = Math.max(4, Math.min(64, this._bandCount));
        
        // Create audio nodes
        this.input = new Tone.Gain();
        this.output = new Tone.Gain();
        this.carrierInput = new Tone.Gain();
        this.modulatorInput = new Tone.Gain();
        
        // Dry/wet mix
        this._dryGain = new Tone.Gain(1 - this._wet);
        this._wetGain = new Tone.Gain(this._wet);
        
        // Filter bank arrays
        this._modulatorFilters = [];
        this._carrierFilters = [];
        this._envelopeFollowers = [];
        this._bandGains = [];
        
        // Build filter bank
        this._buildFilterBank();
        
        // Connect dry path
        this.input.connect(this._dryGain);
        this._dryGain.connect(this.output);
    }
    
    _buildFilterBank() {
        // Frequency range for vocoder (80Hz to 8kHz is typical for voice)
        const lowFreq = 80;
        const highFreq = 8000;
        
        // Calculate center frequencies logarithmically
        const frequencies = [];
        for (let i = 0; i < this._bandCount; i++) {
            const t = i / (this._bandCount - 1);
            const freq = lowFreq * Math.pow(highFreq / lowFreq, t);
            frequencies.push(freq);
        }
        
        // Q factor for bandpass filters
        const Q = 15;
        
        // Create bandpass filters for each band
        for (let i = 0; i < this._bandCount; i++) {
            const freq = frequencies[i];
            
            // Modulator analysis filter
            const modFilter = new Tone.Filter({
                type: 'bandpass',
                frequency: freq,
                Q: Q
            });
            this._modulatorFilters.push(modFilter);
            
            // Envelope follower for modulator band
            const follower = new Tone.Follower({
                attack: 0.005,
                release: 0.05
            });
            this._envelopeFollowers.push(follower);
            
            // Carrier synthesis filter
            const carrierFilter = new Tone.Filter({
                type: 'bandpass',
                frequency: freq,
                Q: Q
            });
            this._carrierFilters.push(carrierFilter);
            
            // Band gain (controlled by modulator envelope)
            const bandGain = new Tone.Gain(0);
            this._bandGains.push(bandGain);
            
            // Connect modulator path: modulator -> filter -> follower -> band gain
            this.modulatorInput.connect(modFilter);
            modFilter.connect(follower);
            
            // Connect carrier path: carrier -> filter -> band gain -> output
            this.carrierInput.connect(carrierFilter);
            carrierFilter.connect(bandGain);
            bandGain.connect(this.output);
        }
        
        // Connect wet path
        this.input.connect(this._wetGain);
        this._wetGain.connect(this.output);
    }
    
    // Update band gains based on modulator signal
    updateBands() {
        for (let i = 0; i < this._bandCount; i++) {
            const level = this._envelopeFollowers[i].value;
            this._bandGains[i].gain.value = level * this._modulatorGain * this._carrierGain;
        }
    }
    
    // Parameters
    get wet() {
        return this._wet;
    }
    
    set wet(value) {
        this._wet = Math.max(0, Math.min(1, value));
        this._dryGain.gain.value = 1 - this._wet;
        this._wetGain.gain.value = this._wet;
    }
    
    get carrierGain() {
        return this._carrierGain;
    }
    
    set carrierGain(value) {
        this._carrierGain = Math.max(0, Math.min(2, value));
    }
    
    get modulatorGain() {
        return this._modulatorGain;
    }
    
    set modulatorGain(value) {
        this._modulatorGain = Math.max(0, Math.min(2, value));
    }
    
    get bandCount() {
        return this._bandCount;
    }
    
    set bandCount(value) {
        // Band count can't be changed after construction in this implementation
        console.warn('[VocoderWorklet] Band count cannot be changed after construction');
    }
    
    // Connect carrier signal
    connectCarrier(source) {
        source.connect(this.carrierInput);
        return this;
    }
    
    // Connect modulator signal (typically voice/mic)
    connectModulator(source) {
        source.connect(this.modulatorInput);
        return this;
    }
    
    // Standard Tone.js connect/dispose
    connect(destination) {
        this.output.connect(destination);
        return this;
    }
    
    disconnect(destination) {
        if (destination) {
            this.output.disconnect(destination);
        } else {
            this.output.disconnect();
        }
        return this;
    }
    
    dispose() {
        // Dispose all filters and followers
        this._modulatorFilters.forEach(f => f.dispose());
        this._carrierFilters.forEach(f => f.dispose());
        this._envelopeFollowers.forEach(f => f.dispose());
        this._bandGains.forEach(g => g.dispose());
        
        this.input.dispose();
        this.output.dispose();
        this.carrierInput.dispose();
        this.modulatorInput.dispose();
        this._dryGain.dispose();
        this._wetGain.dispose();
        
        return this;
    }
    
    // Create with noise carrier (common use case)
    static createWithNoiseCarrier(audioContext, params = {}) {
        const vocoder = new VocoderWorklet(params);
        
        // Create noise carrier
        const noise = new Tone.Noise('pink');
        const noiseGain = new Tone.Gain(params.carrierGain || 1);
        noise.connect(noiseGain);
        noiseGain.connect(vocoder.carrierInput);
        
        // Start noise
        noise.start();
        
        return { vocoder, noise, noiseGain };
    }
    
    // Create with synth carrier
    static createWithSynthCarrier(audioContext, params = {}) {
        const vocoder = new VocoderWorklet(params);
        
        // Create polyphonic synth as carrier
        const synth = new Tone.PolySynth(Tone.Synth);
        const synthGain = new Tone.Gain(params.carrierGain || 1);
        synth.connect(synthGain);
        synthGain.connect(vocoder.carrierInput);
        
        return { vocoder, synth, synthGain };
    }
}

// Export for use in effects registry
export { VocoderWorklet };

// Also export as default
export default VocoderWorklet;