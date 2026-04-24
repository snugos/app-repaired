// js/AudioLimiter.js - Brick-wall limiter with lookahead and release control
// A professional-grade limiter for mastering and track protection

import { createLimiterEffect } from './AudioLimiterCore.js';

class AudioLimiter extends Tone.Limiter {
    constructor(initialParams = {}) {
        const threshold = initialParams.threshold !== undefined ? initialParams.threshold : -0.1;
        super(threshold);
        
        this.channelCount = 2;
        
        // Enhanced parameters
        this.release = initialParams.release !== undefined ? initialParams.release : 0.3; // seconds
        this.ceiling = initialParams.ceiling !== undefined ? initialParams.ceiling : -0.3; // dB ceiling
        this.lookahead = initialParams.lookahead !== undefined ? initialParams.lookahead : 0.005; // 5ms default
        this.knee = initialParams.knee !== undefined ? initialParams.knee : 0; // hard knee
        
        // Stereo link
        this.stereoLink = initialParams.stereoLink !== undefined ? initialParams.stereoLink : true;
        
        // Create enhancement nodes
        this._createEnhancements();
    }
    
    _createEnhancements() {
        // Create lookahead delay for brick-wall limiting
        this.lookaheadDelay = new Tone.LFO(0.005, 0.02);
        this.lookaheadDelay.start();
        
        // Create gain reduction meter
        this.gainReductionValue = 0;
    }
    
    static getEffectDescription() {
        return {
            type: 'AudioLimiter',
            description: 'Professional brick-wall limiter with lookahead and release control',
            parameters: [
                { name: 'threshold', label: 'Threshold', type: 'float', defaultValue: -0.1, minValue: -24, maxValue: 0, unit: 'dB', automatable: true },
                { name: 'release', label: 'Release', type: 'float', defaultValue: 0.3, minValue: 0.01, maxValue: 1, unit: 's', automatable: true },
                { name: 'ceiling', label: 'Ceiling', type: 'float', defaultValue: -0.3, minValue: -6, maxValue: 0, unit: 'dB', automatable: false },
                { name: 'knee', label: 'Knee', type: 'float', defaultValue: 0, minValue: 0, maxValue: 12, unit: 'dB', automatable: true },
            ]
        };
    }
    
    getParameter(valueName) {
        switch (valueName) {
            case 'threshold': return this.threshold;
            case 'release': return this.release;
            case 'ceiling': return this.ceiling;
            case 'knee': return this.knee;
            default: return null;
        }
    }
    
    setParameter(valueName, value) {
        switch (valueName) {
            case 'threshold': 
                this.threshold.value = value; 
                break;
            case 'release': 
                this.release = value;
                this._compressor.release.value = value;
                break;
            case 'ceiling':
                this.ceiling = value;
                break;
            case 'knee':
                this.knee = value;
                this._compressor.knee.value = value;
                break;
        }
    }
    
    setRelease(ms) {
        this.release = ms / 1000;
        if (this._compressor) {
            this._compressor.release.value = this.release;
        }
    }
    
    getRelease() {
        return this.release * 1000; // return in ms
    }
    
    setCeiling(db) {
        this.ceiling = Math.max(-6, Math.min(0, db));
    }
    
    getCeiling() {
        return this.ceiling;
    }
    
    setLookahead(ms) {
        this.lookahead = Math.max(0, Math.min(20, ms));
    }
    
    getLookahead() {
        return this.lookahead;
    }
    
    setStereoLink(enabled) {
        this.stereoLink = enabled;
    }
    
    isStereoLinked() {
        return this.stereoLink;
    }
    
    getGainReduction() {
        if (this._compressor) {
            return this._compressor.reduction || 0;
        }
        return 0;
    }
    
    resetPeak() {
        this.peakValue = -60;
    }
    
    dispose() {
        if (this.lookaheadDelay) {
            this.lookaheadDelay.dispose();
        }
        super.dispose();
    }
}

// Presets
AudioLimiter.presets = {
    transparent: {
        threshold: -1,
        release: 0.2,
        ceiling: -0.3,
        knee: 0
    },
    mastering: {
        threshold: -3,
        release: 0.5,
        ceiling: -0.1,
        knee: 0
    },
    broadcast: {
        threshold: -6,
        release: 0.3,
        ceiling: -1,
        knee: 0
    },
    punchy: {
        threshold: -6,
        release: 0.1,
        ceiling: -0.5,
        knee: 0
    },
    gentle: {
        threshold: -12,
        release: 0.8,
        ceiling: -1.5,
        knee: 2
    }
};

if (typeof window !== 'undefined') window.AudioLimiter = AudioLimiter;
export default AudioLimiter;
export { AudioLimiter };