/**
 * Resonant Low-Pass Gate - Buchla-style low-pass gate with resonance
 * Provides amplitude and timbre control with vactrol response
 */

class ResonantLowPassGate {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Configuration
        this.config = {
            cutoff: options.cutoff || 800,
            resonance: options.resonance || 0.5,
            mode: options.mode || 'both', // 'lowpass', 'amplitude', 'both'
            envAmount: options.envAmount || 0.8,
            attack: options.attack || 0.01,
            decay: options.decay || 0.3,
            sustain: options.sustain || 0.5,
            release: options.release || 0.5,
            vactrolResponse: options.vactrolResponse !== false,
            vibrato: options.vibrato || 0
        };
        
        // Vactrol simulation (slow response)
        this.vactrolTimeConstant = 0.02; // 20ms response
        this.vactrolCutoff = audioContext.createGain();
        this.vactrolCutoff.gain.value = this.config.cutoff;
        
        // Low-pass filter with resonance
        this.filter = audioContext.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = this.config.cutoff;
        this.filter.Q.value = this.resonanceToQ(this.config.resonance);
        
        // Amplitude control (VCA)
        this.vca = audioContext.createGain();
        this.vca.gain.value = 0;
        
        // Envelope generator
        this.envelope = {
            value: 0,
            state: 'idle',
            target: 0,
            lastTime: 0
        };
        
        // LFO for vibrato
        this.lfo = audioContext.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 5;
        
        this.lfoGain = audioContext.createGain();
        this.lfoGain.gain.value = this.config.vibrato;
        
        // Modulation input
        this.modulationInput = audioContext.createGain();
        this.modulationInput.gain.value = 1;
        
        // Build signal path
        this.buildSignalPath();
        
        // Start LFO
        this.lfo.start();
        
        // Presets
        this.presets = {
            'Pluck': { cutoff: 1200, resonance: 0.6, attack: 0.001, decay: 0.4, sustain: 0, release: 0.2, mode: 'both' },
            'Pad': { cutoff: 400, resonance: 0.3, attack: 0.3, decay: 0.5, sustain: 0.7, release: 1.0, mode: 'lowpass' },
            'Percussive': { cutoff: 2000, resonance: 0.7, attack: 0.001, decay: 0.1, sustain: 0, release: 0.1, mode: 'both' },
            'Sustained': { cutoff: 600, resonance: 0.4, attack: 0.05, decay: 0.3, sustain: 0.8, release: 0.5, mode: 'both' },
            'Bright': { cutoff: 3000, resonance: 0.5, attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3, mode: 'lowpass' },
            'Dark': { cutoff: 300, resonance: 0.2, attack: 0.1, decay: 0.5, sustain: 0.4, release: 0.8, mode: 'lowpass' },
            'Resonant': { cutoff: 500, resonance: 0.9, attack: 0.001, decay: 0.3, sustain: 0.3, release: 0.3, mode: 'lowpass' },
            'Bell': { cutoff: 1500, resonance: 0.8, attack: 0.001, decay: 1.5, sustain: 0, release: 0.5, mode: 'both' },
            'Wah': { cutoff: 800, resonance: 0.7, attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3, mode: 'lowpass', envAmount: 1.0 },
            'Soft': { cutoff: 500, resonance: 0.2, attack: 0.2, decay: 0.4, sustain: 0.6, release: 0.6, mode: 'amplitude' }
        };
    }
    
    /**
     * Build signal path
     */
    buildSignalPath() {
        // Input goes to filter and VCA
        this.input.connect(this.filter);
        
        // Vactrol-controlled cutoff
        this.vactrolCutoff.connect(this.filter.frequency);
        
        // LFO vibrato
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.filter.frequency);
        
        // Modulation input affects cutoff
        this.modulationInput.connect(this.filter.frequency);
        this.modulationInput.connect(this.vca.gain);
        
        // Mode-dependent routing
        this.updateRouting();
    }
    
    /**
     * Update routing based on mode
     */
    updateRouting() {
        this.filter.disconnect();
        this.vca.disconnect();
        
        switch (this.config.mode) {
            case 'lowpass':
                // Filter only
                this.input.connect(this.filter);
                this.filter.connect(this.output);
                this.vca.gain.value = 1;
                break;
                
            case 'amplitude':
                // VCA only
                this.input.connect(this.vca);
                this.vca.connect(this.output);
                this.filter.frequency.value = 20000; // Open filter
                break;
                
            case 'both':
            default:
                // Both filter and VCA (classic LPG behavior)
                this.input.connect(this.filter);
                this.filter.connect(this.vca);
                this.vca.connect(this.output);
                break;
        }
    }
    
    /**
     * Convert resonance (0-1) to Q value
     */
    resonanceToQ(resonance) {
        // Q ranges from 0.707 (no resonance) to ~20 (high resonance)
        return 0.707 + resonance * resonance * 19.3;
    }
    
    /**
     * Trigger envelope (note on)
     */
    trigger(time = null) {
        const t = time || this.audioContext.currentTime;
        this.envelope.state = 'attack';
        this.envelope.lastTime = t;
        
        this.updateEnvelope(t);
    }
    
    /**
     * Release envelope (note off)
     */
    release(time = null) {
        const t = time || this.audioContext.currentTime;
        this.envelope.state = 'release';
        this.envelope.lastTime = t;
        this.envelope.target = 0;
    }
    
    /**
     * Update envelope generator
     */
    updateEnvelope(time) {
        const elapsed = time - this.envelope.lastTime;
        const config = this.config;
        
        switch (this.envelope.state) {
            case 'attack':
                const attackRate = 1 / config.attack;
                this.envelope.value = Math.min(1, this.envelope.value + attackRate * elapsed);
                if (this.envelope.value >= 1) {
                    this.envelope.state = 'decay';
                }
                break;
                
            case 'decay':
                const decayRate = 1 / config.decay;
                const sustainLevel = config.sustain;
                this.envelope.value = Math.max(sustainLevel, this.envelope.value - (1 - sustainLevel) * decayRate * elapsed);
                if (this.envelope.value <= sustainLevel) {
                    this.envelope.state = 'sustain';
                }
                break;
                
            case 'sustain':
                this.envelope.value = config.sustain;
                break;
                
            case 'release':
                const releaseRate = 1 / config.release;
                this.envelope.value = Math.max(0, this.envelope.value - releaseRate * elapsed);
                if (this.envelope.value <= 0) {
                    this.envelope.state = 'idle';
                }
                break;
                
            case 'idle':
            default:
                this.envelope.value = 0;
                break;
        }
        
        this.envelope.lastTime = time;
        this.applyEnvelopeToSignal(time);
    }
    
    /**
     * Apply envelope to filter and VCA
     */
    applyEnvelopeToSignal(time) {
        const env = this.envelope.value;
        const config = this.config;
        
        // Calculate vactrol response
        let envValue = env;
        if (config.vactrolResponse) {
            // Simulate vactrol's slower response
            envValue = this.applyVactrolResponse(env, time);
        }
        
        // Apply to cutoff frequency
        const baseCutoff = config.cutoff;
        const envCutoff = baseCutoff + (envValue * config.envAmount * 5000);
        
        if (config.vactrolResponse) {
            // Smooth vactrol-like cutoff changes
            this.vactrolCutoff.gain.setTargetAtTime(envCutoff, time, this.vactrolTimeConstant);
        } else {
            this.filter.frequency.setValueAtTime(envCutoff, time);
        }
        
        // Apply to VCA (if not in lowpass-only mode)
        if (config.mode !== 'lowpass') {
            this.vca.gain.setValueAtTime(envValue * 0.9 + 0.1, time);
        }
    }
    
    /**
     * Apply vactrol response curve
     */
    applyVactrolResponse(value, time) {
        // Vactrols have asymmetric response - fast attack, slow decay
        const attackFactor = 0.9;
        const decayFactor = 0.3;
        
        // Simplified vactrol curve
        if (this.envelope.state === 'attack') {
            return value * attackFactor + (1 - attackFactor);
        } else {
            return value * (1 - decayFactor) + decayFactor;
        }
    }
    
    /**
     * Set cutoff frequency
     */
    setCutoff(value) {
        this.config.cutoff = Math.max(50, Math.min(15000, value));
    }
    
    /**
     * Set resonance
     */
    setResonance(value) {
        this.config.resonance = Math.max(0, Math.min(1, value));
        this.filter.Q.value = this.resonanceToQ(this.config.resonance);
    }
    
    /**
     * Set mode
     */
    setMode(mode) {
        const validModes = ['lowpass', 'amplitude', 'both'];
        if (validModes.includes(mode)) {
            this.config.mode = mode;
            this.updateRouting();
        }
    }
    
    /**
     * Set envelope parameters
     */
    setAttack(value) {
        this.config.attack = Math.max(0.001, Math.min(5, value));
    }
    
    setDecay(value) {
        this.config.decay = Math.max(0.001, Math.min(10, value));
    }
    
    setSustain(value) {
        this.config.sustain = Math.max(0, Math.min(1, value));
    }
    
    setRelease(value) {
        this.config.release = Math.max(0.001, Math.min(10, value));
    }
    
    /**
     * Set envelope amount
     */
    setEnvAmount(value) {
        this.config.envAmount = Math.max(0, Math.min(1, value));
    }
    
    /**
     * Set vactrol response
     */
    setVactrolResponse(enabled) {
        this.config.vactrolResponse = enabled;
    }
    
    /**
     * Set vibrato amount
     */
    setVibrato(value) {
        this.config.vibrato = Math.max(0, Math.min(100, value));
        this.lfoGain.gain.value = this.config.vibrato;
    }
    
    /**
     * Apply preset
     */
    applyPreset(name) {
        const preset = this.presets[name];
        if (!preset) return false;
        
        Object.assign(this.config, preset);
        
        this.filter.Q.value = this.resonanceToQ(this.config.resonance);
        this.updateRouting();
        
        return true;
    }
    
    /**
     * Get available presets
     */
    getPresets() {
        return Object.keys(this.presets);
    }
    
    /**
     * Process audio with envelope
     */
    process(buffer, startTime = null) {
        const t = startTime || this.audioContext.currentTime;
        const duration = buffer.duration;
        const sampleRate = this.audioContext.sampleRate;
        
        // Create offline context for processing
        const offlineCtx = new OfflineAudioContext(
            buffer.numberOfChannels,
            buffer.length,
            sampleRate
        );
        
        // Clone the LPG setup for offline processing
        // ... (simplified for real-time usage)
        
        return buffer;
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
        if (settings.cutoff !== undefined) this.setCutoff(settings.cutoff);
        if (settings.resonance !== undefined) this.setResonance(settings.resonance);
        if (settings.mode !== undefined) this.setMode(settings.mode);
        if (settings.attack !== undefined) this.setAttack(settings.attack);
        if (settings.decay !== undefined) this.setDecay(settings.decay);
        if (settings.sustain !== undefined) this.setSustain(settings.sustain);
        if (settings.release !== undefined) this.setRelease(settings.release);
        if (settings.envAmount !== undefined) this.setEnvAmount(settings.envAmount);
        if (settings.vactrolResponse !== undefined) this.setVactrolResponse(settings.vactrolResponse);
        if (settings.vibrato !== undefined) this.setVibrato(settings.vibrato);
    }
}

// Factory function
function createResonantLowPassGate(audioContext, options = {}) {
    return new ResonantLowPassGate(audioContext, options);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ResonantLowPassGate, createResonantLowPassGate };
}