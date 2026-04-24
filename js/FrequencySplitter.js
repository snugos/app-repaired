/**
 * FrequencySplitter - Split audio into multiple frequency bands for parallel processing
 * Creates Crossover-based multi-band output for parallel effect chains
 */

export class FrequencySplitter {
    constructor(options = {}) {
        this.name = 'FrequencySplitter';
        
        // Crossover frequencies in Hz
        this.bands = options.bands || [
            { name: 'Sub', lowFreq: 20, highFreq: 80 },
            { name: 'Low', lowFreq: 80, highFreq: 250 },
            { name: 'Mid', lowFreq: 250, highFreq: 2000 },
            { name: 'High', lowFreq: 2000, highFreq: 8000 },
            { name: 'Air', lowFreq: 8000, highFreq: 20000 }
        ];
        
        // Band gains (linear)
        this.gains = options.gains || [1, 1, 1, 1, 1];
        
        // Output state
        this.bandOutputs = this.bands.map(() => new Float32Array(0));
        this.sampleRate = options.sampleRate || 44100;
        this.isActive = true;
        
        // Initialize filter coefficients
        this.filters = [];
        this._initializeFilters();
    }
    
    /**
     * Initialize the crossover filters for each band
     */
    _initializeFilters() {
        this.filters = [];
        
        for (let i = 0; i < this.bands.length; i++) {
            const band = this.bands[i];
            
            // Create a chain of biquad filters for steep crossover
            // For a proper crossover, we need:
            // 1. Lowpass filter at highFreq
            // 2. Highpass filter at lowFreq
            // 3. Bandpass for the middle bands
            
            const filters = {
                lowpass: this._createLowpassCoefficients(band.highFreq),
                highpass: this._createHighpassCoefficients(band.lowFreq),
                // State for IIR filtering
                lpState: [0, 0, 0, 0],
                hpState: [0, 0, 0, 0]
            };
            
            this.filters.push(filters);
        }
        
        // For multiband, we need to track previous bands to subtract
        // This is a simplified crossover - bands are processed in series
        this._crossoverState = new Array(this.bands.length).fill(null).map(() => [0, 0, 0, 0]);
    }
    
    /**
     * Create lowpass filter coefficients
     */
    _createLowpassCoefficients(frequency) {
        const w0 = 2 * Math.PI * frequency / this.sampleRate;
        const Q = 0.707; // Butterworth
        const alpha = Math.sin(w0) / (2 * Q);
        const cosW0 = Math.cos(w0);
        
        const b0 = (1 - cosW0) / 2;
        const b1 = 1 - cosW0;
        const b2 = (1 - cosW0) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * cosW0;
        const a2 = 1 - alpha;
        
        return {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0
        };
    }
    
    /**
     * Create highpass filter coefficients
     */
    _createHighpassCoefficients(frequency) {
        const w0 = 2 * Math.PI * frequency / this.sampleRate;
        const Q = 0.707; // Butterworth
        const alpha = Math.sin(w0) / (2 * Q);
        const cosW0 = Math.cos(w0);
        
        const b0 = (1 + cosW0) / 2;
        const b1 = -(1 + cosW0);
        const b2 = (1 + cosW0) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * cosW0;
        const a2 = 1 - alpha;
        
        return {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0
        };
    }
    
    /**
     * Create bandpass filter coefficients
     */
    _createBandpassCoefficients(frequency, bandwidth) {
        const w0 = 2 * Math.PI * frequency / this.sampleRate;
        const Q = frequency / bandwidth;
        const alpha = Math.sin(w0) / (2 * Q);
        const cosW0 = Math.cos(w0);
        
        const b0 = alpha;
        const b1 = 0;
        const b2 = -alpha;
        const a0 = 1 + alpha;
        const a1 = -2 * cosW0;
        const a2 = 1 - alpha;
        
        return {
            b0: b0 / a0,
            b1: b1 / a0,
            b2: b2 / a0,
            a1: a1 / a0,
            a2: a2 / a0
        };
    }
    
    /**
     * Process audio through the frequency splitter
     * Returns array of band outputs
     */
    process(samples) {
        if (!samples || samples.length === 0) {
            return this.bands.map(() => samples);
        }
        
        const numBands = this.bands.length;
        const outputs = this.bands.map(() => new Float32Array(samples.length));
        
        // Simple 4-band crossover using cascaded filters
        // Band 0: 20-80 Hz (Sub)
        // Band 1: 80-250 Hz (Low)
        // Band 2: 250-2000 Hz (Mid)
        // Band 3: 2000-8000 Hz (High)
        // Band 4: 8000-20000 Hz (Air)
        
        // Process each band with cascaded lowpass/highpass
        for (let i = 0; i < samples.length; i++) {
            const input = samples[i];
            
            // Band 0: Sub (lowpass at 80Hz only)
            outputs[0][i] = this._applyLowpass(input, 0) * this.gains[0];
            
            // Band 1: Low (highpass at 80, lowpass at 250)
            const afterHP80 = this._applyHighpass(input, 0);
            outputs[1][i] = this._applyLowpass(afterHP80, 1) * this.gains[1];
            
            // Band 2: Mid (highpass at 250, lowpass at 2000)
            const afterHP250 = this._applyHighpass(input, 1);
            const afterLP2000 = this._applyLowpass(afterHP250, 2);
            outputs[2][i] = afterLP2000 * this.gains[2];
            
            // Band 3: High (highpass at 2000, lowpass at 8000)
            const afterHP2000 = this._applyHighpass(input, 2);
            const afterLP8000 = this._applyLowpass(afterHP2000, 3);
            outputs[3][i] = afterLP8000 * this.gains[3];
            
            // Band 4: Air (highpass at 8000 only)
            const afterHP8000 = this._applyHighpass(input, 3);
            outputs[4][i] = afterHP8000 * this.gains[4];
        }
        
        return outputs;
    }
    
    /**
     * Apply lowpass filter to input
     */
    _applyLowpass(input, bandIndex) {
        const coeffs = this.filters[bandIndex]?.lowpass;
        if (!coeffs) return input;
        
        const state = this.filters[bandIndex].lpState;
        
        const output = coeffs.b0 * input + 
                       coeffs.b1 * state[0] + 
                       coeffs.b2 * state[1] -
                       coeffs.a1 * state[2] - 
                       coeffs.a2 * state[3];
        
        state[1] = state[0];
        state[0] = input;
        state[3] = state[2];
        state[2] = output;
        
        return output;
    }
    
    /**
     * Apply highpass filter to input
     */
    _applyHighpass(input, bandIndex) {
        const coeffs = this.filters[bandIndex]?.highpass;
        if (!coeffs) return input;
        
        const state = this.filters[bandIndex].hpState;
        
        const output = coeffs.b0 * input + 
                       coeffs.b1 * state[0] + 
                       coeffs.b2 * state[1] -
                       coeffs.a1 * state[2] - 
                       coeffs.a2 * state[3];
        
        state[1] = state[0];
        state[0] = input;
        state[3] = state[2];
        state[2] = output;
        
        return output;
    }
    
    /**
     * Set crossover frequency for a band boundary
     */
    setCrossoverFrequency(bandIndex, frequency) {
        if (bandIndex < 0 || bandIndex >= this.bands.length - 1) return;
        
        this.bands[bandIndex].highFreq = Math.max(20, Math.min(18000, frequency));
        this.bands[bandIndex + 1].lowFreq = this.bands[bandIndex].highFreq;
        
        this._initializeFilters();
    }
    
    /**
     * Set gain for a specific band
     */
    setBandGain(bandIndex, gain) {
        if (bandIndex < 0 || bandIndex >= this.gains.length) return;
        this.gains[bandIndex] = Math.max(0, Math.min(2, gain));
    }
    
    /**
     * Set number of bands
     */
    setBandCount(count) {
        const numBands = Math.max(2, Math.min(8, count));
        
        if (numBands === this.bands.length) return;
        
        // Default frequencies for different band counts
        const defaultFreqs = {
            2: [100, 20000],
            3: [100, 1000, 20000],
            4: [80, 250, 2000, 20000],
            5: [20, 80, 250, 2000, 8000, 20000],
            6: [20, 60, 150, 500, 2000, 8000, 20000]
        };
        
        const freqs = defaultFreqs[numBands] || defaultFreqs[4];
        
        this.bands = [];
        for (let i = 0; i < numBands; i++) {
            this.bands.push({
                name: `Band ${i + 1}`,
                lowFreq: freqs[i] || 20,
                highFreq: freqs[i + 1] || 20000
            });
        }
        
        // Extend gains array
        while (this.gains.length < numBands) {
            this.gains.push(1);
        }
        
        this._initializeFilters();
    }
    
    /**
     * Get current band configuration
     */
    getBands() {
        return this.bands.map((band, i) => ({
            ...band,
            gain: this.gains[i] || 1
        }));
    }
    
    /**
     * Reset filter states
     */
    reset() {
        for (const filter of this.filters) {
            filter.lpState = [0, 0, 0, 0];
            filter.hpState = [0, 0, 0, 0];
        }
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.filters = [];
        this.bandOutputs = [];
    }
}

/**
 * FrequencySplitterProcessor - Web Audio API compatible processor
 * Can be used as AudioWorklet processor or standalone
 */
export class FrequencySplitterProcessor {
    constructor(options = {}) {
        this.splitter = new FrequencySplitter(options);
        this.bufferSize = options.bufferSize || 256;
    }
    
    /**
     * Process a block of samples
     */
    process(samples) {
        return this.splitter.process(samples);
    }
    
    /**
     * Get band outputs
     */
    getBandOutputs() {
        return this.splitter.getBands();
    }
    
    /**
     * Set crossover frequency
     */
    setCrossover(index, freq) {
        this.splitter.setCrossoverFrequency(index, freq);
    }
    
    /**
     * Set band gain
     */
    setBandGain(index, gain) {
        this.splitter.setBandGain(index, gain);
    }
}

export default FrequencySplitter;