// js/Vocoder.js - Vocoder effect for robot/voice effects
// A vocoder analyzes the spectral content of the modulator (voice)
// and applies it to the carrier (synthesizer)

class Vocoder {
    constructor(initialParams = {}) {
        // Get number of frequency bands (4-64)
        this._bandCount = initialParams.bandCount !== undefined ? initialParams.bandCount : 28;
        
        // Analyze filters
        this._analyzer = new Tone.FFT(this._bandCount);
        
        // Resolution mapping for band visualization
        this._bandCount = Math.max(4, Math.min(64, this._bandCount));
        
        // Create bandpass filters for each frequency band
        this._filters = [];
        this._filterGains = [];
        
        // Build frequency band filters (logarithmic distribution from 100Hz to 8kHz)
        const minFreq = 100;
        const maxFreq = 8000;
        const logMin = Math.log10(minFreq);
        const logMax = Math.log10(maxFreq);
        
        for (let i = 0; i < this._bandCount; i++) {
            const ratio = i / (this._bandCount - 1);
            const freq = Math.pow(10, logMin + ratio * (logMax - logMin));
            
            const filter = new Tone.BiquadFilter({
                type: 'bandpass',
                frequency: freq,
                Q: 5
            });
            
            const gain = new Tone.Gain(0);
            
            this._filters.push(filter);
            this._filterGains.push(gain);
        }
        
        // Wet/dry mix
        this._wetGain = new Tone.Gain(initialParams.wet !== undefined ? initialParams.wet : 1);
        this._dryGain = new Tone.Gain(1 - (initialParams.wet !== undefined ? initialParams.wet : 1));
        
        // Input gains for carrier/modulator
        this._carrierGain = new Tone.Gain(initialParams.carrierGain !== undefined ? initialParams.carrierGain : 1);
        this._modulatorGain = new Tone.Gain(initialParams.modulatorGain !== undefined ? initialParams.modulatorGain : 1);
        
        // Built vocoder from Tone.js
        this._vocoder = new Tone.Vocoder(this._bandCount);
        
        // Connect carrier gain to vocoder carrier input
        this._carrierGain.connect(this._vocoder.carrier);
        
        // Connect modulator gain to vocoder modulator input  
        this._modulatorGain.connect(this._vocoder.modulator);
        
        // Connect vocoder output through wet/dry
        this._vocoder.connect(this._wetGain);
        this._vocoder.connect(this._dryGain);
        
        // Dry passthrough from carrier
        this._carrierGain.connect(this._dryGain);
        
        // The vocoder's built-in analyzer
        this._analyzerFFT = new Tone.Analyser('fft', 128);
        this._vocoder.connect(this._analyzerFFT);
        
        // Input nodes
        this.input = this._carrierGain;
        this.modulatorInput = this._modulatorGain;
        
        // Output node
        this.output = new Tone.Gain(1);
        this._wetGain.connect(this.output);
        this._dryGain.connect(this.output);
        
        // Set initial wet/dry mix
        this._wet = initialParams.wet !== undefined ? initialParams.wet : 1;
        this._dry = 1 - this._wet;
    }
    
    // Get current analyzer values for visualization
    getAnalyzers() {
        return {
            fft: this._analyzerFFT.getValue()
        };
    }
    
    // Get frequency bands for visualization
    getFrequencyBands() {
        return this._filters.map(f => f.frequency.value);
    }
    
    // Set wet/dry mix
    set wet(value) {
        this._wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1 - value;
    }
    
    get wet() {
        return this._wet;
    }
    
    // Set carrier gain
    set carrierGain(value) {
        this._carrierGain.gain.value = value;
    }
    
    get carrierGain() {
        return this._carrierGain.gain.value;
    }
    
    // Set modulator gain
    set modulatorGain(value) {
        this._modulatorGain.gain.value = value;
    }
    
    get modulatorGain() {
        return this._modulatorGain.gain.value;
    }
    
    // Set number of bands (rebuilds filters)
    set bandCount(value) {
        // Note: band count cannot be changed after construction in Tone.Vocoder
        this._bandCount = Math.max(4, Math.min(64, value));
    }
    
    get bandCount() {
        return this._bandCount;
    }
    
    // Dispose of all nodes
    dispose() {
        if (this._analyzer) this._analyzer.dispose();
        if (this._vocoder) this._vocoder.dispose();
        if (this._carrierGain) this._carrierGain.dispose();
        if (this._modulatorGain) this._modulatorGain.dispose();
        if (this._wetGain) this._wetGain.dispose();
        if (this._dryGain) this._dryGain.dispose();
        if (this._analyzerFFT) this._analyzerFFT.dispose();
        this._filters.forEach(f => f.dispose());
        this._filterGains.forEach(g => g.dispose());
    }
}

// Register on Tone namespace if available
if (typeof Tone !== 'undefined') {
    Tone.VocoderWorklet = Vocoder;
}

export { Vocoder };
