/**
 * Stereo Delay Effect - Ping-pong delay with sync options
 * Provides tempo-synced delay with stereo spread and feedback control
 */

class StereoDelayEffect {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Input/Output
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Dry/Wet mix
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Delay lines (stereo)
        this.leftDelay = audioContext.createDelay(10);
        this.rightDelay = audioContext.createDelay(10);
        
        // Feedback
        this.leftFeedback = audioContext.createGain();
        this.rightFeedback = audioContext.createGain();
        
        // Ping-pong routing
        this.pingPongGain = audioContext.createGain();
        this.crossFeedGain = audioContext.createGain();
        
        // Filters for feedback path
        this.lowCut = audioContext.createBiquadFilter();
        this.lowCut.type = 'highpass';
        this.lowCut.frequency.value = 80;
        
        this.highDamp = audioContext.createBiquadFilter();
        this.highDamp.type = 'lowpass';
        this.highDamp.frequency.value = 12000;
        
        // Configuration
        this.config = {
            time: options.time || 0.5,
            sync: options.sync || false,
            syncNote: options.syncNote || 'quarter', // 'quarter', 'eighth', 'sixteenth', 'dotted', 'triplet'
            feedback: options.feedback || 0.4,
            pingPong: options.pingPong !== false,
            stereoSpread: options.stereoSpread || 0.1,
            modDepth: options.modDepth || 0,
            modRate: options.modRate || 0.5,
            mix: options.mix || 0.3
        };
        
        // Tempo sync
        this.tempo = 120; // BPM
        this.syncMultiplier = {
            'sixteenth': 0.25,
            'eighth': 0.5,
            'quarter': 1,
            'dotted': 1.5,
            'half': 2,
            'dottedHalf': 3,
            'whole': 4,
            'triplet': 2/3,
            'tripletEighth': 1/3,
            'tripletSixteenth': 1/6
        };
        
        // LFO for modulation
        this.lfo = audioContext.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = this.config.modRate;
        
        this.lfoGain = audioContext.createGain();
        this.lfoGain.gain.value = this.config.modDepth;
        
        // Panning for stereo spread
        this.leftPan = audioContext.createStereoPanner();
        this.rightPan = audioContext.createStereoPanner();
        
        // Build signal path
        this.buildSignalPath();
        
        // Start LFO
        this.lfo.start();
        
        // Presets
        this.presets = {
            'Simple': { time: 0.5, feedback: 0.3, pingPong: false, stereoSpread: 0, mix: 0.2 },
            'Ping Pong': { time: 0.4, feedback: 0.5, pingPong: true, stereoSpread: 0.3, mix: 0.3 },
            'Wide Ping Pong': { time: 0.375, feedback: 0.45, pingPong: true, stereoSpread: 0.5, mix: 0.35 },
            'Slapback': { time: 0.08, feedback: 0.1, pingPong: false, stereoSpread: 0.1, mix: 0.25 },
            'Dub Echo': { time: 0.75, feedback: 0.6, pingPong: true, stereoSpread: 0.2, mix: 0.4 },
            'Rhythmic': { time: 0.25, feedback: 0.35, pingPong: true, stereoSpread: 0.4, mix: 0.3 },
            'Ambient': { time: 1.5, feedback: 0.5, pingPong: true, stereoSpread: 0.6, mix: 0.45 },
            'Lo-Fi': { time: 0.5, feedback: 0.4, pingPong: true, stereoSpread: 0.3, mix: 0.35, highDamp: 4000 },
            'Tape': { time: 0.45, feedback: 0.45, pingPong: false, stereoSpread: 0.1, mix: 0.3, modDepth: 0.002 },
            'Modulated': { time: 0.5, feedback: 0.35, pingPong: true, stereoSpread: 0.3, mix: 0.3, modDepth: 0.003, modRate: 0.3 }
        };
    }
    
    /**
     * Build signal path
     */
    buildSignalPath() {
        // Dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        this.dryGain.gain.value = 1 - this.config.mix;
        
        // Wet path - split into left and right
        this.input.connect(this.lowCut);
        this.lowCut.connect(this.highDamp);
        
        // Left delay chain
        this.highDamp.connect(this.leftDelay);
        this.leftDelay.connect(this.leftPan);
        this.leftPan.pan.value = -1;
        this.leftPan.connect(this.wetGain);
        
        // Right delay chain
        this.highDamp.connect(this.rightDelay);
        this.rightDelay.connect(this.rightPan);
        this.rightPan.pan.value = 1;
        this.rightPan.connect(this.wetGain);
        
        // Feedback
        if (this.config.pingPong) {
            // Ping-pong: left feeds right, right feeds left
            this.leftDelay.connect(this.rightFeedback);
            this.rightFeedback.connect(this.rightDelay);
            
            this.rightDelay.connect(this.leftFeedback);
            this.leftFeedback.connect(this.leftDelay);
        } else {
            // Parallel: each side feeds itself
            this.leftDelay.connect(this.leftFeedback);
            this.leftFeedback.connect(this.leftDelay);
            
            this.rightDelay.connect(this.rightFeedback);
            this.rightFeedback.connect(this.rightDelay);
        }
        
        // Cross-feed for stereo spread
        this.leftDelay.connect(this.crossFeedGain);
        this.crossFeedGain.connect(this.rightDelay);
        this.rightDelay.connect(this.crossFeedGain);
        this.crossFeedGain.connect(this.leftDelay);
        
        // LFO modulation
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.leftDelay.delayTime);
        this.lfoGain.connect(this.rightDelay.delayTime);
        
        // Wet output
        this.wetGain.connect(this.output);
        this.wetGain.gain.value = this.config.mix;
        
        // Apply initial settings
        this.applyConfig();
    }
    
    /**
     * Apply configuration
     */
    applyConfig() {
        const delayTime = this.config.sync ? 
            this.getSyncedTime(this.config.syncNote) : 
            this.config.time;
        
        // Set delay times with slight offset for stereo spread
        this.leftDelay.delayTime.value = delayTime * (1 - this.config.stereoSpread / 2);
        this.rightDelay.delayTime.value = delayTime * (1 + this.config.stereoSpread / 2);
        
        // Set feedback
        this.leftFeedback.gain.value = this.config.feedback;
        this.rightFeedback.gain.value = this.config.feedback;
        
        // Set cross-feed for stereo spread
        this.crossFeedGain.gain.value = this.config.stereoSpread * 0.3;
        
        // Set mix
        this.dryGain.gain.value = 1 - this.config.mix;
        this.wetGain.gain.value = this.config.mix;
        
        // Set modulation
        this.lfo.frequency.value = this.config.modRate;
        this.lfoGain.gain.value = this.config.modDepth;
    }
    
    /**
     * Get sync'd delay time
     */
    getSyncedTime(note) {
        const multiplier = this.syncMultiplier[note] || 1;
        const beatDuration = 60 / this.tempo;
        return beatDuration * multiplier;
    }
    
    /**
     * Set delay time (ms or sync note)
     */
    setTime(time) {
        if (this.config.sync) {
            if (this.syncMultiplier[time]) {
                this.config.syncNote = time;
                this.applyConfig();
            }
        } else {
            this.config.time = Math.max(0.01, Math.min(10, time));
            this.leftDelay.delayTime.value = this.config.time * (1 - this.config.stereoSpread / 2);
            this.rightDelay.delayTime.value = this.config.time * (1 + this.config.stereoSpread / 2);
        }
    }
    
    /**
     * Set feedback
     */
    setFeedback(value) {
        this.config.feedback = Math.max(0, Math.min(0.95, value));
        this.leftFeedback.gain.value = this.config.feedback;
        this.rightFeedback.gain.value = this.config.feedback;
    }
    
    /**
     * Set mix (dry/wet)
     */
    setMix(value) {
        this.config.mix = Math.max(0, Math.min(1, value));
        this.dryGain.gain.value = 1 - this.config.mix;
        this.wetGain.gain.value = this.config.mix;
    }
    
    /**
     * Set ping-pong mode
     */
    setPingPong(enabled) {
        if (this.config.pingPong === enabled) return;
        
        // Rebuild feedback routing
        this.leftFeedback.disconnect();
        this.rightFeedback.disconnect();
        
        this.config.pingPong = enabled;
        
        if (enabled) {
            this.leftDelay.connect(this.rightFeedback);
            this.rightFeedback.connect(this.rightDelay);
            this.rightDelay.connect(this.leftFeedback);
            this.leftFeedback.connect(this.leftDelay);
        } else {
            this.leftDelay.connect(this.leftFeedback);
            this.leftFeedback.connect(this.leftDelay);
            this.rightDelay.connect(this.rightFeedback);
            this.rightFeedback.connect(this.rightDelay);
        }
    }
    
    /**
     * Set stereo spread
     */
    setStereoSpread(value) {
        this.config.stereoSpread = Math.max(0, Math.min(1, value));
        this.crossFeedGain.gain.value = this.config.stereoSpread * 0.3;
        
        // Update delay times with spread
        const baseTime = this.config.sync ? 
            this.getSyncedTime(this.config.syncNote) : 
            this.config.time;
        this.leftDelay.delayTime.value = baseTime * (1 - this.config.stereoSpread / 2);
        this.rightDelay.delayTime.value = baseTime * (1 + this.config.stereoSpread / 2);
    }
    
    /**
     * Set sync mode
     */
    setSync(enabled) {
        this.config.sync = enabled;
        this.applyConfig();
    }
    
    /**
     * Set tempo (BPM)
     */
    setTempo(bpm) {
        this.tempo = Math.max(20, Math.min(300, bpm));
        if (this.config.sync) {
            this.applyConfig();
        }
    }
    
    /**
     * Set sync note
     */
    setSyncNote(note) {
        if (this.syncMultiplier[note]) {
            this.config.syncNote = note;
            if (this.config.sync) {
                this.applyConfig();
            }
        }
    }
    
    /**
     * Set modulation depth
     */
    setModDepth(value) {
        this.config.modDepth = Math.max(0, Math.min(0.01, value));
        this.lfoGain.gain.value = this.config.modDepth;
    }
    
    /**
     * Set modulation rate
     */
    setModRate(value) {
        this.config.modRate = Math.max(0.01, Math.min(10, value));
        this.lfo.frequency.value = this.config.modRate;
    }
    
    /**
     * Set high damp frequency
     */
    setHighDamp(value) {
        this.highDamp.frequency.value = Math.max(1000, Math.min(20000, value));
    }
    
    /**
     * Set low cut frequency
     */
    setLowCut(value) {
        this.lowCut.frequency.value = Math.max(20, Math.min(1000, value));
    }
    
    /**
     * Apply preset
     */
    applyPreset(name) {
        const preset = this.presets[name];
        if (!preset) return false;
        
        Object.assign(this.config, preset);
        
        if (preset.highDamp) this.highDamp.frequency.value = preset.highDamp;
        if (preset.lowCut) this.lowCut.frequency.value = preset.lowCut;
        
        this.applyConfig();
        return true;
    }
    
    /**
     * Get available presets
     */
    getPresets() {
        return Object.keys(this.presets);
    }
    
    /**
     * Clear delay buffer
     */
    clear() {
        // Temporarily set feedback to 0 and let buffers empty
        const originalFeedback = this.config.feedback;
        this.leftFeedback.gain.value = 0;
        this.rightFeedback.gain.value = 0;
        
        setTimeout(() => {
            this.leftFeedback.gain.value = originalFeedback;
            this.rightFeedback.gain.value = originalFeedback;
        }, 100);
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
        return { ...this.config, tempo: this.tempo };
    }
    
    /**
     * Apply settings
     */
    applySettings(settings) {
        if (settings.time !== undefined) this.setTime(settings.time);
        if (settings.feedback !== undefined) this.setFeedback(settings.feedback);
        if (settings.mix !== undefined) this.setMix(settings.mix);
        if (settings.pingPong !== undefined) this.setPingPong(settings.pingPong);
        if (settings.stereoSpread !== undefined) this.setStereoSpread(settings.stereoSpread);
        if (settings.sync !== undefined) this.setSync(settings.sync);
        if (settings.syncNote !== undefined) this.setSyncNote(settings.syncNote);
        if (settings.tempo !== undefined) this.setTempo(settings.tempo);
        if (settings.modDepth !== undefined) this.setModDepth(settings.modDepth);
        if (settings.modRate !== undefined) this.setModRate(settings.modRate);
    }
}

// Factory function
function createStereoDelayEffect(audioContext, options = {}) {
    return new StereoDelayEffect(audioContext, options);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StereoDelayEffect, createStereoDelayEffect };
}