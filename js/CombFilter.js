/**
 * Comb Filter - Comb filtering with feedback control
 * Provides flanging and phasing-like effects with feedback
 */

class CombFilter {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Input/Output
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Dry/Wet mix
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Delay line
        this.delay = audioContext.createDelay(1);
        this.delay.delayTime.value = options.delayTime || 0.001;
        
        // Feedback
        this.feedback = audioContext.createGain();
        this.feedback.gain.value = options.feedbackGain || 0.5;
        
        // Feedforward
        this.feedforward = audioContext.createGain();
        this.feedforward.gain.value = options.feedforwardGain || 0.5;
        
        // Configuration
        this.config = {
            delayTime: options.delayTime || 0.001,    // seconds (0.1ms to 50ms)
            feedbackGain: options.feedbackGain || 0.5, // -1 to 1
            feedforwardGain: options.feedforwardGain || 0.5, // -1 to 1
            mix: options.mix || 0.5,
            lfoRate: options.lfoRate || 0,
            lfoDepth: options.lfoDepth || 0,
            lfoType: options.lfoType || 'sine',
            polarity: options.polarity || 'positive', // 'positive', 'negative'
            diffusion: options.diffusion || 0
        };
        
        // LFO for modulation
        this.lfo = audioContext.createOscillator();
        this.lfo.type = this.config.lfoType;
        this.lfo.frequency.value = this.config.lfoRate;
        
        this.lfoGain = audioContext.createGain();
        this.lfoGain.gain.value = this.config.lfoDepth;
        
        // Tone control
        this.lowCut = audioContext.createBiquadFilter();
        this.lowCut.type = 'highpass';
        this.lowCut.frequency.value = 100;
        
        this.highDamp = audioContext.createBiquadFilter();
        this.highDamp.type = 'lowpass';
        this.highDamp.frequency.value = 10000;
        
        // Diffusion (all-pass filters for smearing)
        this.diffusionFilters = [];
        for (let i = 0; i < 4; i++) {
            const ap = audioContext.createBiquadFilter();
            ap.type = 'allpass';
            ap.frequency.value = 1000 + i * 500;
            ap.Q.value = 1;
            this.diffusionFilters.push(ap);
        }
        
        // Build signal path
        this.buildSignalPath();
        
        // Start LFO
        this.lfo.start();
        
        // Presets
        this.presets = {
            'Flanger': { delayTime: 0.002, feedbackGain: 0.7, feedforwardGain: 0.5, mix: 0.5, lfoRate: 0.2, lfoDepth: 0.001 },
            'Chorus': { delayTime: 0.025, feedbackGain: 0.1, feedforwardGain: 0.3, mix: 0.4, lfoRate: 0.5, lfoDepth: 0.005 },
            'Phaser': { delayTime: 0.001, feedbackGain: 0.8, feedforwardGain: 0.3, mix: 0.6, lfoRate: 0.3, lfoDepth: 0.0005 },
            'Comb': { delayTime: 0.01, feedbackGain: 0.6, feedforwardGain: 0.4, mix: 0.7, lfoRate: 0, lfoDepth: 0 },
            'Resonator': { delayTime: 0.005, feedbackGain: 0.85, feedforwardGain: 0.2, mix: 0.6 },
            'Short': { delayTime: 0.0005, feedbackGain: 0.5, feedforwardGain: 0.5, mix: 0.5 },
            'Long': { delayTime: 0.05, feedbackGain: 0.4, feedforwardGain: 0.3, mix: 0.4 },
            'Metallic': { delayTime: 0.001, feedbackGain: 0.9, feedforwardGain: 0.1, mix: 0.8 },
            'Filter': { delayTime: 0.003, feedbackGain: 0.5, feedforwardGain: -0.5, mix: 0.5 },
            'Spread': { delayTime: 0.015, feedbackGain: 0.3, feedforwardGain: 0.6, mix: 0.5, diffusion: 0.5 }
        };
    }
    
    /**
     * Build signal path
     */
    buildSignalPath() {
        // Dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Wet path - comb filter topology
        // Input -> Feedforward -> Delay -> Feedback -> back to input
        // Output = Input + Feedforward*Delay(input) + Feedback*Delay(output)
        
        // Feedforward path
        this.input.connect(this.feedforward);
        this.feedforward.connect(this.delay);
        
        // Feedback loop
        this.delay.connect(this.feedback);
        this.feedback.connect(this.delay);
        
        // Feedback polarity
        if (this.config.polarity === 'negative') {
            this.feedback.gain.value = -Math.abs(this.config.feedbackGain);
        }
        
        // LFO modulation
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.delay.delayTime);
        
        // Tone control in feedback path
        this.delay.connect(this.lowCut);
        this.lowCut.connect(this.highDamp);
        
        // Diffusion (if enabled)
        let chain = this.highDamp;
        for (const ap of this.diffusionFilters) {
            chain.connect(ap);
            chain = ap;
        }
        
        // Wet output
        chain.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        // Also send dry to wet for parallel comb
        this.input.connect(this.wetGain);
        
        // Apply initial settings
        this.setMix(this.config.mix);
        this.setDelayTime(this.config.delayTime);
        this.setFeedback(this.config.feedbackGain);
        this.setFeedforward(this.config.feedforwardGain);
    }
    
    /**
     * Set delay time (seconds)
     */
    setDelayTime(time) {
        this.config.delayTime = Math.max(0.0001, Math.min(0.05, time));
        this.delay.delayTime.value = this.config.delayTime;
    }
    
    /**
     * Set delay time in ms (convenience)
     */
    setDelayMs(ms) {
        this.setDelayTime(ms / 1000);
    }
    
    /**
     * Set feedback gain (-1 to 1)
     */
    setFeedback(value) {
        this.config.feedbackGain = Math.max(-0.99, Math.min(0.99, value));
        if (this.config.polarity === 'negative') {
            this.feedback.gain.value = -Math.abs(this.config.feedbackGain);
        } else {
            this.feedback.gain.value = this.config.feedbackGain;
        }
    }
    
    /**
     * Set feedforward gain (-1 to 1)
     */
    setFeedforward(value) {
        this.config.feedforwardGain = Math.max(-1, Math.min(1, value));
        this.feedforward.gain.value = this.config.feedforwardGain;
    }
    
    /**
     * Set mix (dry/wet)
     */
    setMix(value) {
        this.config.mix = Math.max(0, Math.min(1, value));
        this.dryGain.gain.value = 1 - this.config.mix;
        this.wetGain.gain.value = this.config.mix * 0.5; // Factor for parallel mix
    }
    
    /**
     * Set LFO rate (Hz)
     */
    setLfoRate(rate) {
        this.config.lfoRate = Math.max(0, Math.min(20, rate));
        this.lfo.frequency.value = this.config.lfoRate;
    }
    
    /**
     * Set LFO depth (seconds)
     */
    setLfoDepth(depth) {
        this.config.lfoDepth = Math.max(0, Math.min(0.01, depth));
        this.lfoGain.gain.value = this.config.lfoDepth;
    }
    
    /**
     * Set LFO waveform type
     */
    setLfoType(type) {
        const validTypes = ['sine', 'square', 'sawtooth', 'triangle'];
        if (validTypes.includes(type)) {
            this.config.lfoType = type;
            this.lfo.type = type;
        }
    }
    
    /**
     * Set polarity ('positive' or 'negative')
     */
    setPolarity(polarity) {
        if (polarity === 'positive' || polarity === 'negative') {
            this.config.polarity = polarity;
            this.setFeedback(this.config.feedbackGain);
        }
    }
    
    /**
     * Set diffusion amount
     */
    setDiffusion(value) {
        this.config.diffusion = Math.max(0, Math.min(1, value));
        // Adjust all-pass Q for more/less diffusion
        for (const ap of this.diffusionFilters) {
            ap.Q.value = 1 + this.config.diffusion * 5;
        }
    }
    
    /**
     * Set low cut frequency
     */
    setLowCut(freq) {
        this.lowCut.frequency.value = Math.max(20, Math.min(500, freq));
    }
    
    /**
     * Set high damp frequency
     */
    setHighDamp(freq) {
        this.highDamp.frequency.value = Math.max(2000, Math.min(20000, freq));
    }
    
    /**
     * Calculate comb filter frequency
     */
    getCombFrequency() {
        return 1 / this.config.delayTime;
    }
    
    /**
     * Set comb frequency directly
     */
    setCombFrequency(freq) {
        if (freq > 0) {
            this.setDelayTime(1 / freq);
        }
    }
    
    /**
     * Apply preset
     */
    applyPreset(name) {
        const preset = this.presets[name];
        if (!preset) return false;
        
        Object.assign(this.config, preset);
        
        this.delay.delayTime.value = preset.delayTime;
        this.setFeedback(preset.feedbackGain);
        this.setFeedforward(preset.feedforwardGain);
        this.setMix(preset.mix);
        if (preset.lfoRate !== undefined) this.setLfoRate(preset.lfoRate);
        if (preset.lfoDepth !== undefined) this.setLfoDepth(preset.lfoDepth);
        if (preset.diffusion !== undefined) this.setDiffusion(preset.diffusion);
        
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
        if (settings.delayTime !== undefined) this.setDelayTime(settings.delayTime);
        if (settings.feedbackGain !== undefined) this.setFeedback(settings.feedbackGain);
        if (settings.feedforwardGain !== undefined) this.setFeedforward(settings.feedforwardGain);
        if (settings.mix !== undefined) this.setMix(settings.mix);
        if (settings.lfoRate !== undefined) this.setLfoRate(settings.lfoRate);
        if (settings.lfoDepth !== undefined) this.setLfoDepth(settings.lfoDepth);
        if (settings.lfoType !== undefined) this.setLfoType(settings.lfoType);
        if (settings.polarity !== undefined) this.setPolarity(settings.polarity);
        if (settings.diffusion !== undefined) this.setDiffusion(settings.diffusion);
    }
}

// Factory function
function createCombFilter(audioContext, options = {}) {
    return new CombFilter(audioContext, options);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CombFilter, createCombFilter };
}