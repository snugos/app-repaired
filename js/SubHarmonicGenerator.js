// js/SubHarmonicGenerator.js - Adds sub-bass content for weight and power
// Uses Tone.js to generate low-frequency content that enhances the bass

class SubHarmonicGenerator {
    constructor(initialParams = {}) {
        this._params = {
            enabled: initialParams.enabled !== undefined ? initialParams.enabled : true,
            frequency: initialParams.frequency || 'C1', // Sub frequency
            blend: initialParams.blend !== undefined ? initialParams.blend : 0.5, // Mix with dry
            level: initialParams.level !== undefined ? initialParams.level : 0.8, // Output level
            filterFreq: initialParams.filterFreq !== undefined ? initialParams.filterFreq : 60 // Cutoff
        };
        
        this._initialized = false;
        this._nodes = [];
        
        // Internal Tone components (set up in initialize)
        this._input = null;
        this._output = null;
        this._oscillator = null;
        this._filter = null;
        this._mix = null;
    }
    
    async initialize() {
        if (this._initialized) return;
        
        try {
            const ctx = Tone.context;
            
            // Create nodes
            this._input = ctx.createGain();
            this._output = ctx.createGain();
            
            // Sub oscillator
            this._oscillator = ctx.createOscillator();
            this._oscillator.type = 'sine';
            this._oscillator.frequency.value = 40; // ~C1
            
            // Low-pass filter for sub
            this._filter = ctx.createBiquadFilter();
            this._filter.type = 'lowpass';
            this._filter.frequency.value = this._params.filterFreq;
            
            // Level and mix controls
            this._oscGain = ctx.createGain();
            this._oscGain.gain.value = this._params.level;
            
            this._mix = ctx.createGain();
            this._mix.gain.value = this._params.blend;
            
            // Dry path
            this._dry = ctx.createGain();
            this._dry.gain.value = 1 - this._params.blend;
            
            // Connect chain
            this._input.connect(this._dry);
            this._input.connect(this._filter);
            this._filter.connect(this._oscGain);
            this._oscGain.connect(this._mix);
            this._mix.connect(this._output);
            
            this._oscillator.connect(this._oscGain);
            
            this._initialized = true;
        } catch (e) {
            console.warn('SubHarmonicGenerator initialization failed:', e);
        }
    }
    
    getInput() { return this._input; }
    getOutput() { return this._output; }
    
    async start() {
        if (!this._initialized) await this.initialize();
        if (this._oscillator && this._oscillator.state !== 'running') {
            this._oscillator.start();
        }
    }
    
    setFrequency(freq) {
        this._params.frequency = freq;
        // Convert note to Hz
        try {
            const freqHz = Tone.Frequency(freq).toFrequency();
            if (this._oscillator) this._oscillator.frequency.value = freqHz;
        } catch (e) {}
    }
    
    setBlend(value) {
        this._params.blend = value;
        if (this._mix) this._mix.gain.value = value;
        if (this._dry) this._dry.gain.value = 1 - value;
    }
    
    setLevel(value) {
        this._params.level = value;
        if (this._oscGain) this._oscGain.gain.value = value;
    }
    
    setFilterFreq(value) {
        this._params.filterFreq = value;
        if (this._filter) this._filter.frequency.value = value;
    }
    
    setEnabled(enabled) {
        this._params.enabled = enabled;
        if (this._oscGain) {
            this._oscGain.gain.value = enabled ? this._params.level : 0;
        }
    }
    
    getParams() {
        return { ...this._params };
    }
    
    dispose() {
        if (this._oscillator) {
            this._oscillator.stop();
            this._oscillator.disconnect();
        }
        this._input = null;
        this._output = null;
        this._oscillator = null;
        this._filter = null;
        this._mix = null;
        this._dry = null;
        this._oscGain = null;
    }
}

// Backward compatible
class SubHarmonicGeneratorEffect extends SubHarmonicGenerator {}

export { SubHarmonicGenerator, SubHarmonicGeneratorEffect };