/**
 * Noise Gate - Threshold-based gating with lookahead
 * Provides professional gating with attack, release, and lookahead
 */

class NoiseGate {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Input/Output
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Gain control for gating
        this.gateGain = audioContext.createGain();
        this.gateGain.gain.value = 0;
        
        // Analysis
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.3;
        
        // Lookahead delay
        this.lookaheadDelay = audioContext.createDelay(0.05);
        this.lookaheadDelay.delayTime.value = options.lookahead || 0.005;
        
        // Configuration
        this.config = {
            threshold: options.threshold || -40,     // dB
            range: options.range || -80,             // dB (gate floor)
            attack: options.attack || 0.001,        // seconds
            hold: options.hold || 0.05,              // seconds
            release: options.release || 0.1,        // seconds
            lookahead: options.lookahead || 0.005,  // seconds
            knee: options.knee || 6,                // dB
            ratio: options.ratio || 100,            // effectively infinite for gate
            stereoLink: options.stereoLink !== false,
            sidechain: options.sidechain || false,
            keyFilter: options.keyFilter || false   // Frequency-sensitive gating
        };
        
        // Key filter (for frequency-sensitive gating)
        this.keyLowCut = audioContext.createBiquadFilter();
        this.keyLowCut.type = 'highpass';
        this.keyLowCut.frequency.value = 100;
        
        this.keyHighCut = audioContext.createBiquadFilter();
        this.keyHighCut.type = 'lowpass';
        this.keyHighCut.frequency.value = 10000;
        
        // Sidechain input
        this.sidechainInput = audioContext.createGain();
        this.sidechainAnalyser = audioContext.createAnalyser();
        this.sidechainAnalyser.fftSize = 2048;
        
        // State
        this.state = {
            isOpen: false,
            isHolding: false,
            currentGain: 0,
            holdTimer: 0,
            lastLevel: -100
        };
        
        // Processing
        this.isProcessing = false;
        this.processInterval = null;
        
        // Metering
        this.meterLevel = 0;
        this.meterGainReduction = 0;
        
        // Build signal path
        this.buildSignalPath();
        
        // Presets
        this.presets = {
            'Light': { threshold: -30, range: -20, attack: 0.001, hold: 0.02, release: 0.1 },
            'Standard': { threshold: -40, range: -60, attack: 0.001, hold: 0.05, release: 0.15 },
            'Heavy': { threshold: -50, range: -80, attack: 0.001, hold: 0.03, release: 0.2 },
            'Drums': { threshold: -25, range: -40, attack: 0.0005, hold: 0.01, release: 0.05 },
            'Vocal': { threshold: -35, range: -50, attack: 0.002, hold: 0.08, release: 0.25 },
            'Guitar': { threshold: -30, range: -40, attack: 0.003, hold: 0.05, release: 0.15 },
            'Bass': { threshold: -28, range: -35, attack: 0.002, hold: 0.06, release: 0.18 },
            'De-Ess': { threshold: -20, range: -10, attack: 0.001, hold: 0.005, release: 0.05, keyFilter: true, keyFreq: 5000 },
            'Expander': { threshold: -45, range: -20, attack: 0.005, hold: 0.1, release: 0.3, ratio: 4 }
        };
    }
    
    /**
     * Build signal path
     */
    buildSignalPath() {
        // Signal path with lookahead
        this.input.connect(this.lookaheadDelay);
        this.lookaheadDelay.connect(this.gateGain);
        this.gateGain.connect(this.output);
        
        // Analysis path (pre-lookahead for accurate level detection)
        this.input.connect(this.keyLowCut);
        this.keyLowCut.connect(this.keyHighCut);
        this.keyHighCut.connect(this.analyser);
        
        // Sidechain path
        this.sidechainInput.connect(this.sidechainAnalyser);
    }
    
    /**
     * Start gating
     */
    start() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.processLoop();
    }
    
    /**
     * Stop gating
     */
    stop() {
        this.isProcessing = false;
        if (this.processInterval) {
            clearInterval(this.processInterval);
            this.processInterval = null;
        }
    }
    
    /**
     * Processing loop
     */
    processLoop() {
        if (!this.isProcessing) return;
        
        this.process();
        
        // Schedule next iteration
        this.processInterval = setTimeout(() => this.processLoop(), 5);
    }
    
    /**
     * Process audio level
     */
    process() {
        const timeData = new Float32Array(this.analyser.frequencyBinCount);
        this.analyser.getFloatTimeDomainData(timeData);
        
        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
            sum += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sum / timeData.length);
        const levelDb = 20 * Math.log10(rms + 0.0001);
        
        // Smooth level
        this.state.lastLevel = this.state.lastLevel * 0.7 + levelDb * 0.3;
        
        // Update meter
        this.meterLevel = this.state.lastLevel;
        
        // Apply gating
        this.applyGate(this.state.lastLevel);
    }
    
    /**
     * Apply gate based on level
     */
    applyGate(levelDb) {
        const config = this.config;
        const threshold = config.threshold;
        const range = config.range;
        const knee = config.knee;
        
        const now = this.audioContext.currentTime;
        
        // Calculate target gain
        let targetGain = 1;
        
        if (levelDb < threshold - knee / 2) {
            // Below threshold - gate closed
            targetGain = Math.pow(10, range / 20);
        } else if (levelDb < threshold + knee / 2) {
            // In knee - gradual transition
            const kneePos = (levelDb - (threshold - knee / 2)) / knee;
            const kneeGain = Math.pow(10, range / 20);
            targetGain = kneeGain + (1 - kneeGain) * kneePos;
        }
        
        // Handle state transitions
        if (targetGain > 0.5 && !this.state.isOpen) {
            // Open gate
            this.state.isOpen = true;
            this.state.isHolding = true;
            this.state.holdTimer = config.hold;
            
            // Apply attack
            this.gateGain.gain.cancelScheduledValues(now);
            this.gateGain.gain.setTargetAtTime(1, now, config.attack);
        } else if (targetGain < 0.5 && this.state.isOpen) {
            if (this.state.isHolding) {
                // Decrement hold timer
                this.state.holdTimer -= 0.005;
                if (this.state.holdTimer <= 0) {
                    this.state.isHolding = false;
                }
            }
            
            if (!this.state.isHolding) {
                // Close gate
                this.state.isOpen = false;
                
                // Apply release
                this.gateGain.gain.cancelScheduledValues(now);
                this.gateGain.gain.setTargetAtTime(Math.pow(10, range / 20), now, config.release);
            }
        }
        
        // Update gain reduction meter
        this.meterGainReduction = (1 - (this.gateGain.gain.value)) * 60;
    }
    
    /**
     * Set threshold (dB)
     */
    setThreshold(db) {
        this.config.threshold = Math.max(-100, Math.min(0, db));
    }
    
    /**
     * Set range (dB floor)
     */
    setRange(db) {
        this.config.range = Math.max(-100, Math.min(0, db));
    }
    
    /**
     * Set attack (seconds)
     */
    setAttack(seconds) {
        this.config.attack = Math.max(0.0001, Math.min(0.1, seconds));
    }
    
    /**
     * Set hold (seconds)
     */
    setHold(seconds) {
        this.config.hold = Math.max(0, Math.min(1, seconds));
    }
    
    /**
     * Set release (seconds)
     */
    setRelease(seconds) {
        this.config.release = Math.max(0.001, Math.min(2, seconds));
    }
    
    /**
     * Set lookahead (seconds)
     */
    setLookahead(seconds) {
        this.config.lookahead = Math.max(0, Math.min(0.05, seconds));
        this.lookaheadDelay.delayTime.value = this.config.lookahead;
    }
    
    /**
     * Set knee (dB)
     */
    setKnee(db) {
        this.config.knee = Math.max(0, Math.min(24, db));
    }
    
    /**
     * Set key filter frequency range
     */
    setKeyFilterRange(low, high) {
        this.keyLowCut.frequency.value = Math.max(20, Math.min(20000, low));
        this.keyHighCut.frequency.value = Math.max(20, Math.min(20000, high));
    }
    
    /**
     * Enable/disable key filter
     */
    setKeyFilter(enabled) {
        this.config.keyFilter = enabled;
    }
    
    /**
     * Get current meter readings
     */
    getMeters() {
        return {
            level: this.meterLevel,
            gainReduction: this.meterGainReduction,
            isOpen: this.state.isOpen
        };
    }
    
    /**
     * Apply preset
     */
    applyPreset(name) {
        const preset = this.presets[name];
        if (!preset) return false;
        
        Object.assign(this.config, preset);
        
        if (preset.keyFreq !== undefined) {
            this.keyLowCut.frequency.value = preset.keyFreq;
            this.keyHighCut.frequency.value = preset.keyFreq * 2;
        }
        
        return true;
    }
    
    /**
     * Get available presets
     */
    getPresets() {
        return Object.keys(this.presets);
    }
    
    /**
     * Connect nodes
     */
    connect(destination) {
        this.output.connect(destination.input || destination);
    }
    
    /**
     * Disconnect
     */
    disconnect() {
        this.output.disconnect();
    }
    
    /**
     * Get settings
     */
    getSettings() {
        return { ...this.config };
    }
    
    /**
     * Apply settings
     */
    applySettings(settings) {
        if (settings.threshold !== undefined) this.setThreshold(settings.threshold);
        if (settings.range !== undefined) this.setRange(settings.range);
        if (settings.attack !== undefined) this.setAttack(settings.attack);
        if (settings.hold !== undefined) this.setHold(settings.hold);
        if (settings.release !== undefined) this.setRelease(settings.release);
        if (settings.lookahead !== undefined) this.setLookahead(settings.lookahead);
        if (settings.knee !== undefined) this.setKnee(settings.knee);
    }
}

// Factory function
function createNoiseGate(audioContext, options = {}) {
    return new NoiseGate(audioContext, options);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NoiseGate, createNoiseGate };
}