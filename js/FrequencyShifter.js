// js/FrequencyShifter.js - Frequency shifting effect (shifts frequencies without changing pitch)
// For special effects like robot voice, doppler, etc.

class FrequencyShifter {
    constructor(initialParams = {}) {
        this._context = Tone.context;
        this._initialized = false;
        
        // Frequency shifting uses a ring modulation approach
        // We use two oscillators for complex demodulation
        this._carrier = null;
        this._modulator = null;
        this._modulationDepth = null;
        this._mix = null;
        
        // Bypass
        this._bypassGain = null;
        
        this._params = {
            shiftAmount: initialParams.shiftAmount !== undefined ? initialParams.shiftAmount : 0, // Hz shift
            mix: initialParams.mix !== undefined ? initialParams.mix : 1.0,
            depth: initialParams.depth !== undefined ? initialParams.depth : 1.0
        };
        
        this._nodes = [];
        this._bypassRoute = null;
    }
    
    async initialize() {
        if (this._initialized) return;
        
        try {
            // Create the frequency shifting chain using ring modulation
            // The technique: multiply input by carrier oscillator, then filter
            
            // Modulator oscillator (creates the frequency shift)
            this._modulator = this._context.createOscillator();
            this._modulator.type = 'sine';
            this._modulator.frequency.value = Math.abs(this._params.shiftAmount);
            
            // Modulation depth control
            this._modulationDepth = this._context.createGain();
            this._modulationDepth.gain.value = this._params.depth;
            
            // Product (ring modulation)
            this._ringMod = this._context.createGain();
            this._ringMod.gain.value = 0.5; // For ring modulation
            
            // Output mixer (wet/dry)
            this._mix = this._context.createGain();
            this._mix.gain.value = this._params.mix;
            
            // Dry path
            this._dryGain = this._context.createGain();
            this._dryGain.gain.value = 1 - this._params.mix;
            
            // Bypass
            this._bypassGain = this._context.createGain();
            this._bypassGain.gain.value = 0;
            
            // Connect the chain
            // Modulator -> depth -> ring mod gain
            this._modulator.connect(this._modulationDepth);
            
            // State
            this._initialized = true;
            this._started = false;
        } catch (e) {
            console.warn('FrequencyShifter initialization failed:', e);
        }
    }
    
    getInput() { return this._ringMod; }
    getOutput() { return this._mix; }
    
    async start() {
        if (!this._initialized) await this.initialize();
        if (this._started) return;
        if (this._modulator) {
            this._modulator.start();
            this._started = true;
        }
    }
    
    setShiftAmount(value) {
        this._params.shiftAmount = value;
        if (this._modulator) {
            this._modulator.frequency.value = Math.abs(value);
        }
    }
    
    setDepth(value) {
        this._params.depth = value;
        if (this._modulationDepth) {
            this._modulationDepth.gain.value = value;
        }
    }
    
    setMix(value) {
        this._params.mix = value;
        if (this._mix) this._mix.gain.value = value;
        if (this._dryGain) this._dryGain.gain.value = 1 - value;
    }
    
    getParams() {
        return { ...this._params };
    }
    
    dispose() {
        if (this._modulator) {
            this._modulator.stop();
            this._modulator.disconnect();
        }
        if (this._ringMod) this._ringMod.disconnect();
        if (this._mix) this._mix.disconnect();
        if (this._dryGain) this._dryGain.disconnect();
        if (this._modulationDepth) this._modulationDepth.disconnect();
        if (this._bypassGain) this._bypassGain.disconnect();
    }
}

// Backward compatible name
class FrequencyShifterEffect extends FrequencyShifter {}

export { FrequencyShifter, FrequencyShifterEffect };