// js/NoiseGateEnhancement.js - Advanced gate with frequency-aware triggering

class NoiseGateEnhancement {
    constructor(initialParams = {}) {
        this._params = {
            threshold: initialParams.threshold !== undefined ? initialParams.threshold : -40, // dB
            attack: initialParams.attack !== undefined ? initialParams.attack : 0.001, // seconds
            release: initialParams.release !== undefined ? initialParams.release : 0.1, // seconds
            hold: initialParams.hold !== undefined ? initialParams.hold : 0.02, // seconds
            range: initialParams.range !== undefined ? initialParams.range : -80, // dB (how much it cuts)
            lookahead: initialParams.lookahead !== undefined ? initialParams.lookahead : 0.005, // seconds
            enabled: initialParams.enabled !== undefined ? initialParams.enabled : true,
            // Frequency-aware settings
            filterFreq: initialParams.filterFreq !== undefined ? initialParams.filterFreq : 200, // Hz - only look at lows
            filterQ: initialParams.filterQ !== undefined ? initialParams.filterQ : 0.7
        };
        
        this._context = Tone.context;
        this._initialized = false;
        this._nodes = [];
        
        // Internal nodes
        this._input = null;
        this._output = null;
        this._filter = null;
        this._detector = null;
        this._envFollower = null;
        this._gain = null;
        this._wetGain = null;
        this._dryGain = null;
    }
    
    async initialize() {
        if (this._initialized) return;
        
        try {
            const ctx = this._context;
            
            this._input = ctx.createGain();
            this._output = ctx.createGain();
            
            // Bandpass filter for frequency-aware triggering
            this._filter = ctx.createBiquadFilter();
            this._filter.type = 'bandpass';
            this._filter.frequency.value = this._params.filterFreq;
            this._filter.Q.value = this._params.filterQ;
            
            // Envelope follower for detection
            this._envFollower = ctx.createGain();
            
            // Gate gain node
            this._gateGain = ctx.createGain();
            this._gateGain.gain.value = 0; // Start closed
            
            // Wet/dry mix
            this._wetGain = ctx.createGain();
            this._wetGain.gain.value = 1;
            
            this._dryGain = ctx.createGain();
            this._dryGain.gain.value = 0;
            
            // Connect signal path
            // Input -> direct to output (dry)
            this._input.connect(this._dryGain);
            this._dryGain.connect(this._output);
            
            // Input -> filter -> envelope -> gate -> wet -> output
            this._input.connect(this._filter);
            this._filter.connect(this._gateGain);
            this._gateGain.connect(this._wetGain);
            this._wetGain.connect(this._output);
            
            this._initialized = true;
            this._startTime = ctx.currentTime;
            this._lastGateState = false;
            this._holdCounter = 0;
            
        } catch (e) {
            console.warn('NoiseGateEnhancement initialization failed:', e);
        }
    }
    
    getInput() { return this._input; }
    getOutput() { return this._output; }
    
    async start() {
        if (!this._initialized) await this.initialize();
    }
    
    setThreshold(value) {
        this._params.threshold = value;
    }
    
    setAttack(value) {
        this._params.attack = value;
    }
    
    setRelease(value) {
        this._params.release = value;
    }
    
    setHold(value) {
        this._params.hold = value;
    }
    
    setRange(value) {
        this._params.range = value;
    }
    
    setFilterFreq(value) {
        this._params.filterFreq = value;
        if (this._filter) this._filter.frequency.value = value;
    }
    
    setFilterQ(value) {
        this._params.filterQ = value;
        if (this._filter) this._filter.Q.value = value;
    }
    
    setEnabled(enabled) {
        this._params.enabled = enabled;
        if (!enabled && this._gateGain) {
            this._gateGain.gain.value = 1; // Pass through
        }
    }
    
    // Process audio - called on each audio chunk
    process(inputBuffer, outputBuffer) {
        if (!this._params.enabled) {
            // Bypass
            outputBuffer.set(inputBuffer);
            return;
        }
        
        const ctx = this._context;
        const threshold = Math.pow(10, this._params.threshold / 20);
        const rangeGain = Math.pow(10, this._params.range / 20);
        const attackTime = this._params.attack;
        const releaseTime = this._params.release;
        const holdTime = this._params.hold;
        
        const blockSize = inputBuffer.length;
        
        // Get filtered RMS from input
        // Simplified envelope follower
        let sum = 0;
        for (let i = 0; i < blockSize; i++) {
            sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / blockSize);
        
        // Gate decision
        let gateOpen = rms > threshold;
        
        // Apply hold
        if (gateOpen) {
            this._holdCounter = holdTime * ctx.sampleRate;
        } else if (this._holdCounter > 0) {
            gateOpen = true;
            this._holdCounter -= blockSize;
        }
        
        // Apply attack/release smoothing
        const targetGain = gateOpen ? 1.0 : rangeGain;
        const currentGain = this._gateGain.gain.value;
        const timeConstant = gateOpen ? attackTime : releaseTime;
        const alpha = 1 - Math.exp(-1 / (timeConstant * ctx.sampleRate));
        
        this._gateGain.gain.value = currentGain + alpha * (targetGain - currentGain);
        
        // Mix wet/dry
        const wet = this._params.enabled ? 1 : 0;
        this._wetGain.gain.value = wet;
        this._dryGain.gain.value = 1 - wet;
    }
    
    getParams() {
        return { ...this._params };
    }
    
    dispose() {
        this._input = null;
        this._output = null;
        this._filter = null;
        this._envFollower = null;
        this._gateGain = null;
        this._wetGain = null;
        this._dryGain = null;
    }
}

// Backward compatible
class AdvancedNoiseGate extends NoiseGateEnhancement {}

export { NoiseGateEnhancement, AdvancedNoiseGate };