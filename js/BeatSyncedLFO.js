/**
 * Beat-synced LFO
 * LFO with tempo-locked rate divisions (1/4, 1/8, 1/16, etc.) for filter/amp modulation
 */

class BeatSyncedLFO {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // LFO nodes
        this.lfo = audioContext.createOscillator();
        this.lfo.type = options.type || 'sine';
        this.lfo.frequency.value = options.frequency || 1;
        
        // Gain for bipolar output (-1 to 1)
        this.lfoGain = audioContext.createGain();
        this.lfoGain.gain.value = 1;
        
        // Output level
        this.outputGain = audioContext.createGain();
        this.outputGain.gain.value = options.depth || 1;
        
        // Connect LFO
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.outputGain);
        
        // State
        this.isRunning = false;
        this.tempo = options.tempo || 120;
        this.rateDivision = options.rateDivision || '1/4';
        this.depth = options.depth || 1;
        
        // Available rate divisions
        this.rateDivisions = {
            '1/1': 1,
            '1/2': 2,
            '1/4': 4,
            '1/8': 8,
            '1/16': 16,
            '1/32': 32,
            '1/64': 64,
            '2/1': 0.5,
            '4/1': 0.25
        };
        
        // LFO waveform types
        this.waveTypes = ['sine', 'triangle', 'square', 'sawtooth', 'reverseSaw'];
        
        // Build signal path
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        this.input.connect(this.output);
    }
    
    /**
     * Connect LFO output to a parameter (e.g., filter frequency)
     */
    connectToParameter(param) {
        this.lfoGain.connect(param);
    }
    
    /**
     * Disconnect from parameter
     */
    disconnectFrom(param) {
        try {
            this.lfoGain.disconnect(param);
        } catch (e) {
            // Already disconnected
        }
    }
    
    /**
     * Start the LFO
     */
    start() {
        if (!this.isRunning) {
            this.lfo.start();
            this.isRunning = true;
        }
    }
    
    /**
     * Stop the LFO
     */
    stop() {
        if (this.isRunning) {
            this.lfo.stop();
            this.isRunning = false;
        }
    }
    
    /**
     * Set tempo in BPM
     */
    setTempo(bpm) {
        this.tempo = bpm;
        this._updateRateFromDivision();
    }
    
    /**
     * Set rate division (e.g., '1/4', '1/8')
     */
    setRateDivision(division) {
        if (this.rateDivisions[division] !== undefined) {
            this.rateDivision = division;
            this._updateRateFromDivision();
        }
    }
    
    /**
     * Update LFO frequency based on tempo and division
     */
    _updateRateFromDivision() {
        const multiplier = this.rateDivisions[this.rateDivision] || 4;
        // Frequency = (tempo / 60) * division
        // e.g., 120 BPM / 4 = 2Hz (2 cycles per beat = 1/2 note at 120 BPM)
        const frequency = (this.tempo / 60) * (multiplier / 4);
        this.lfo.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    }
    
    /**
     * Set LFO waveform type
     */
    setType(type) {
        if (this.waveTypes.includes(type)) {
            this.lfo.type = type;
        }
    }
    
    /**
     * Set modulation depth (0-1)
     */
    setDepth(value) {
        this.depth = Math.max(0, Math.min(1, value));
        this.outputGain.gain.setTargetAtTime(this.depth, this.audioContext.currentTime, 0.01);
    }
    
    /**
     * Set LFO frequency directly (Hz)
     */
    setFrequency(hz) {
        this.lfo.frequency.setTargetAtTime(hz, this.audioContext.currentTime, 0.01);
    }
    
    /**
     * Get available rate divisions
     */
    getRateDivisions() {
        return Object.keys(this.rateDivisions);
    }
    
    /**
     * Get available waveform types
     */
    getWaveTypes() {
        return this.waveTypes;
    }
    
    /**
     * Get current settings
     */
    getSettings() {
        return {
            type: this.lfo.type,
            rateDivision: this.rateDivision,
            depth: this.depth,
            tempo: this.tempo,
            frequency: this.lfo.frequency.value,
            isRunning: this.isRunning
        };
    }
    
    /**
     * Get output node for connecting to audio chain
     */
    getOutput() {
        return this.output;
    }
    
    /**
     * Get LFO output node (for modulation)
     */
    getModulationOutput() {
        return this.lfoGain;
    }
    
    /**
     * Connect to audio chain
     */
    connect(destination) {
        this.output.connect(destination);
    }
    
    /**
     * Disconnect
     */
    disconnect() {
        this.output.disconnect();
    }
    
    /**
     * Dispose
     */
    dispose() {
        this.stop();
        this.lfo.disconnect();
        this.lfoGain.disconnect();
        this.outputGain.disconnect();
        this.input.disconnect();
        this.output.disconnect();
    }
}

/**
 * Create BeatSyncedLFO instance
 */
function createBeatSyncedLFO(audioContext, options = {}) {
    return new BeatSyncedLFO(audioContext, options);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BeatSyncedLFO, createBeatSyncedLFO };
}
