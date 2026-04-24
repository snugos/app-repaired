/**
 * Waveshaper Distortion - Custom waveshaping curves with anti-aliasing
 * Provides waveshaping distortion with multiple curves and oversampling
 */

class WaveshaperDistortion {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Input/Output
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Dry/Wet mix
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Waveshaper
        this.waveshaper = audioContext.createWaveShaper();
        this.waveshaper.oversample = options.oversample || '2x'; // 'none', '2x', '4x'
        
        // Pre/post gain
        this.inputGain = audioContext.createGain();
        this.outputGain = audioContext.createGain();
        
        // Tone control (post-shaping EQ)
        this.lowCut = audioContext.createBiquadFilter();
        this.lowCut.type = 'highpass';
        this.lowCut.frequency.value = 80;
        
        this.highCut = audioContext.createBiquadFilter();
        this.highCut.type = 'lowpass';
        this.highCut.frequency.value = 8000;
        
        // Configuration
        this.config = {
            drive: options.drive || 0.5,
            curve: options.curve || 'soft',
            oversample: options.oversample || '2x',
            mix: options.mix || 0.5,
            tone: options.tone || 0.5,
            inputGain: options.inputGain || 1,
            outputGain: options.outputGain || 1
        };
        
        // Available curves
        this.curveTypes = {
            'soft': this.generateSoftCurve.bind(this),
            'hard': this.generateHardCurve.bind(this),
            'asymmetric': this.generateAsymmetricCurve.bind(this),
            'tube': this.generateTubeCurve.bind(this),
            'fuzz': this.generateFuzzCurve.bind(this),
            'rectifier': this.generateRectifierCurve.bind(this),
            'saturate': this.generateSaturateCurve.bind(this),
            'fold': this.generateFoldCurve.bind(this),
            'wrap': this.generateWrapCurve.bind(this),
            'clip': this.generateClipCurve.bind(this),
            'tanh': this.generateTanhCurve.bind(this),
            'cubic': this.generateCubicCurve.bind(this),
            'chebyshev': this.generateChebyshevCurve.bind(this),
            'arctan': this.generateArctanCurve.bind(this),
            'sine': this.generateSineCurve.bind(this)
        };
        
        // Custom curve support
        this.customCurves = new Map();
        
        // Build signal path
        this.buildSignalPath();
        
        // Generate initial curve
        this.generateCurve();
        
        // Presets
        this.presets = {
            'Clean': { drive: 0.2, curve: 'soft', mix: 0.3, tone: 0.7 },
            'Crunch': { drive: 0.4, curve: 'tube', mix: 0.5, tone: 0.6 },
            'Overdrive': { drive: 0.6, curve: 'asymmetric', mix: 0.6, tone: 0.5 },
            'Distortion': { drive: 0.8, curve: 'hard', mix: 0.7, tone: 0.4 },
            'Fuzz': { drive: 0.9, curve: 'fuzz', mix: 0.8, tone: 0.3 },
            'Metal': { drive: 0.85, curve: 'rectifier', mix: 0.75, tone: 0.5 },
            'Warm': { drive: 0.35, curve: 'tube', mix: 0.4, tone: 0.8 },
            'Bright': { drive: 0.5, curve: 'soft', mix: 0.45, tone: 0.3 },
            'Bass': { drive: 0.4, curve: 'tanh', mix: 0.5, tone: 0.9 },
            'Lead': { drive: 0.6, curve: 'saturate', mix: 0.55, tone: 0.45 },
            'Sustain': { drive: 0.7, curve: 'soft', mix: 0.6, tone: 0.55 },
            'Chaos': { drive: 0.95, curve: 'fold', mix: 0.85, tone: 0.4 }
        };
    }
    
    /**
     * Build signal path
     */
    buildSignalPath() {
        // Dry path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Wet path
        this.input.connect(this.inputGain);
        this.inputGain.connect(this.waveshaper);
        this.waveshaper.connect(this.lowCut);
        this.lowCut.connect(this.highCut);
        this.highCut.connect(this.outputGain);
        this.outputGain.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        // Apply initial settings
        this.dryGain.gain.value = 1 - this.config.mix;
        this.wetGain.gain.value = this.config.mix;
        this.inputGain.gain.value = this.config.inputGain;
        this.outputGain.gain.value = this.config.outputGain;
    }
    
    /**
     * Generate the current waveshaper curve
     */
    generateCurve() {
        const curveGenerator = this.curveTypes[this.config.curve];
        
        if (curveGenerator) {
            const curve = curveGenerator(this.config.drive);
            this.waveshaper.curve = curve;
        }
    }
    
    /**
     * Create a Float32Array curve
     */
    createCurveArray(length = 4096) {
        return new Float32Array(length);
    }
    
    /**
     * Soft clipping curve (smooth saturation)
     */
    generateSoftCurve(drive) {
        const curve = this.createCurveArray();
        const k = drive * 10 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            curve[i] = Math.tanh(x * k) / Math.tanh(k);
        }
        
        return curve;
    }
    
    /**
     * Hard clipping curve
     */
    generateHardCurve(drive) {
        const curve = this.createCurveArray();
        const threshold = 1 - drive * 0.8;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            const k = 1 + drive * 5;
            const shaped = x * k;
            
            if (shaped > threshold) {
                curve[i] = threshold;
            } else if (shaped < -threshold) {
                curve[i] = -threshold;
            } else {
                curve[i] = shaped;
            }
        }
        
        return curve;
    }
    
    /**
     * Asymmetric curve (tube-like)
     */
    generateAsymmetricCurve(drive) {
        const curve = this.createCurveArray();
        const k = drive * 4 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            
            // Asymmetric saturation
            if (x > 0) {
                curve[i] = Math.tanh(x * k * 0.8) / Math.tanh(k * 0.8);
            } else {
                curve[i] = Math.tanh(x * k * 1.2) / Math.tanh(k * 1.2);
            }
        }
        
        return curve;
    }
    
    /**
     * Tube amp curve
     */
    generateTubeCurve(drive) {
        const curve = this.createCurveArray();
        const k = drive * 3 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            
            // Tube-like transfer function
            const absX = Math.abs(x);
            const sign = x >= 0 ? 1 : -1;
            
            curve[i] = sign * (1 - Math.exp(-absX * k)) / (1 - Math.exp(-k));
        }
        
        return curve;
    }
    
    /**
     * Fuzz face curve
     */
    generateFuzzCurve(drive) {
        const curve = this.createCurveArray();
        const k = drive * 8 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            const shaped = x * k;
            
            // Hard clip with sustain
            if (Math.abs(shaped) > 0.8) {
                curve[i] = Math.sign(shaped) * (0.8 + 0.2 * Math.tanh((Math.abs(shaped) - 0.8) * 2));
            } else {
                curve[i] = shaped;
            }
        }
        
        // Normalize
        let max = 0;
        for (let i = 0; i < curve.length; i++) {
            max = Math.max(max, Math.abs(curve[i]));
        }
        if (max > 0) {
            for (let i = 0; i < curve.length; i++) {
                curve[i] /= max;
            }
        }
        
        return curve;
    }
    
    /**
     * Rectifier curve
     */
    generateRectifierCurve(drive) {
        const curve = this.createCurveArray();
        const threshold = 1 - drive * 0.5;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            const k = 1 + drive * 3;
            
            // Half-wave rectification with drive
            if (x > 0) {
                curve[i] = Math.min(threshold, x * k);
            } else {
                curve[i] = x * k * (1 - drive * 0.3); // Reduced negative
            }
        }
        
        return curve;
    }
    
    /**
     * Saturation curve
     */
    generateSaturateCurve(drive) {
        const curve = this.createCurveArray();
        const k = drive * 5 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            // Cubic soft clipper
            curve[i] = (Math.atan(x * k) / Math.atan(k));
        }
        
        return curve;
    }
    
    /**
     * Wave folding curve
     */
    generateFoldCurve(drive) {
        const curve = this.createCurveArray();
        const folds = Math.floor(drive * 4) + 1;
        const range = 1 + drive;
        
        for (let i = 0; i < curve.length; i++) {
            let x = (i / curve.length) * 2 - 1;
            x *= (1 + drive);
            
            // Fold the wave
            for (let f = 0; f < folds; f++) {
                if (x > 1) {
                    x = 2 - x;
                } else if (x < -1) {
                    x = -2 - x;
                }
            }
            
            curve[i] = Math.max(-1, Math.min(1, x));
        }
        
        return curve;
    }
    
    /**
     * Wave wrapping curve
     */
    generateWrapCurve(drive) {
        const curve = this.createCurveArray();
        const wrap = 1 + drive * 2;
        
        for (let i = 0; i < curve.length; i++) {
            let x = (i / curve.length) * 2 - 1;
            x *= (1 + drive);
            
            // Wrap around
            while (x > 1 || x < -1) {
                if (x > 1) {
                    x = x - 2;
                } else if (x < -1) {
                    x = x + 2;
                }
            }
            
            curve[i] = x;
        }
        
        return curve;
    }
    
    /**
     * Hard clip curve
     */
    generateClipCurve(drive) {
        const curve = this.createCurveArray();
        const threshold = 1 - drive * 0.7;
        const gain = 1 + drive * 3;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            const shaped = x * gain;
            
            curve[i] = Math.max(-threshold, Math.min(threshold, shaped));
        }
        
        return curve;
    }
    
    /**
     * Tanh curve
     */
    generateTanhCurve(drive) {
        const curve = this.createCurveArray();
        const k = drive * 10 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            curve[i] = Math.tanh(x * k);
        }
        
        return curve;
    }
    
    /**
     * Cubic curve
     */
    generateCubicCurve(drive) {
        const curve = this.createCurveArray();
        const k = drive * 2 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            // Cubic distortion: x - x^3/3
            const shaped = x * k;
            curve[i] = shaped - (shaped * shaped * shaped) / 3;
            curve[i] = Math.max(-1, Math.min(1, curve[i]));
        }
        
        return curve;
    }
    
    /**
     * Chebyshev polynomial curve (for odd harmonics)
     */
    generateChebyshevCurve(drive) {
        const curve = this.createCurveArray();
        const order = Math.floor(drive * 8) + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            // Chebyshev polynomial of order n
            curve[i] = this.chebyshev(x, order);
        }
        
        return curve;
    }
    
    /**
     * Chebyshev polynomial
     */
    chebyshev(x, n) {
        if (n === 0) return 1;
        if (n === 1) return x;
        return 2 * x * this.chebyshev(x, n - 1) - this.chebyshev(x, n - 2);
    }
    
    /**
     * Arctan curve
     */
    generateArctanCurve(drive) {
        const curve = this.createCurveArray();
        const k = drive * 5 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            curve[i] = Math.atan(x * k) / Math.atan(k);
        }
        
        return curve;
    }
    
    /**
     * Sine-based curve
     */
    generateSineCurve(drive) {
        const curve = this.createCurveArray();
        const k = drive * Math.PI / 2;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            curve[i] = Math.sin(x * (1 + drive) * Math.PI / 2);
        }
        
        return curve;
    }
    
    /**
     * Set drive amount
     */
    setDrive(value) {
        this.config.drive = Math.max(0, Math.min(1, value));
        this.generateCurve();
    }
    
    /**
     * Set curve type
     */
    setCurve(type) {
        if (this.curveTypes[type] || this.customCurves.has(type)) {
            this.config.curve = type;
            this.generateCurve();
        }
    }
    
    /**
     * Set oversample
     */
    setOversample(value) {
        const valid = ['none', '2x', '4x'];
        if (valid.includes(value)) {
            this.config.oversample = value;
            this.waveshaper.oversample = value;
        }
    }
    
    /**
     * Set mix
     */
    setMix(value) {
        this.config.mix = Math.max(0, Math.min(1, value));
        this.dryGain.gain.value = 1 - this.config.mix;
        this.wetGain.gain.value = this.config.mix;
    }
    
    /**
     * Set tone (EQ)
     */
    setTone(value) {
        this.config.tone = Math.max(0, Math.min(1, value));
        // Higher tone = brighter
        this.highCut.frequency.value = 2000 + value * 14000;
        this.lowCut.frequency.value = 200 - value * 150;
    }
    
    /**
     * Set input gain
     */
    setInputGain(value) {
        this.config.inputGain = Math.max(0.1, Math.min(5, value));
        this.inputGain.gain.value = this.config.inputGain;
    }
    
    /**
     * Set output gain
     */
    setOutputGain(value) {
        this.config.outputGain = Math.max(0.1, Math.min(5, value));
        this.outputGain.gain.value = this.config.outputGain;
    }
    
    /**
     * Add custom curve
     */
    addCustomCurve(name, curveFunction) {
        this.customCurves.set(name, curveFunction);
        this.curveTypes[name] = curveFunction.bind(this);
    }
    
    /**
     * Get available curves
     */
    getAvailableCurves() {
        return [...Object.keys(this.curveTypes)];
    }
    
    /**
     * Apply preset
     */
    applyPreset(name) {
        const preset = this.presets[name];
        if (!preset) return false;
        
        Object.assign(this.config, preset);
        this.generateCurve();
        this.setTone(preset.tone || 0.5);
        this.dryGain.gain.value = 1 - this.config.mix;
        this.wetGain.gain.value = this.config.mix;
        
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
        if (settings.drive !== undefined) this.setDrive(settings.drive);
        if (settings.curve !== undefined) this.setCurve(settings.curve);
        if (settings.oversample !== undefined) this.setOversample(settings.oversample);
        if (settings.mix !== undefined) this.setMix(settings.mix);
        if (settings.tone !== undefined) this.setTone(settings.tone);
        if (settings.inputGain !== undefined) this.setInputGain(settings.inputGain);
        if (settings.outputGain !== undefined) this.setOutputGain(settings.outputGain);
    }
}

// Factory function
function createWaveshaperDistortion(audioContext, options = {}) {
    return new WaveshaperDistortion(audioContext, options);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WaveshaperDistortion, createWaveshaperDistortion };
}