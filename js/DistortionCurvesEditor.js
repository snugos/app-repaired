/**
 * Distortion Curves Editor
 * Visual curve editor for waveshaper distortion with preset shapes and custom curve drawing
 */

class DistortionCurvesEditor {
    constructor(options = {}) {
        this.audioContext = options.audioContext || new AudioContext();
        
        // Canvas settings
        this.canvasWidth = options.canvasWidth || 400;
        this.canvasHeight = options.canvasHeight || 300;
        this.padding = { top: 20, right: 20, bottom: 30, left: 40 };
        
        // Curve state
        this.points = new Float32Array(512);
        this.drive = options.drive || 0.5;
        this.curveType = options.curveType || 'soft';
        
        // Preset curves
        this.curvePresets = {
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
            'sine': this.generateSineCurve.bind(this),
            'custom': null // User-defined custom curve
        };
        
        // Built-in presets metadata for UI
        this.presetMetadata = {
            'soft': { name: 'Soft Clip', description: 'Smooth saturation, gentle harmonics' },
            'hard': { name: 'Hard Clip', description: 'Square wave-like, aggressive' },
            'asymmetric': { name: 'Asymmetric', description: 'Tube-like, even harmonics' },
            'tube': { name: 'Tube', description: 'Warm analog tube saturation' },
            'fuzz': { name: 'Fuzz', description: 'Extreme distortion, octave doubling' },
            'rectifier': { name: 'Rectifier', description: 'Half-wave rectification' },
            'saturate': { name: 'Saturation', description: 'Smooth nonlinear saturation' },
            'fold': { name: 'Wave Fold', description: 'Wave folding distortion' },
            'wrap': { name: 'Wrap', description: 'Phase wrapping effect' },
            'clip': { name: 'Hard Clip', description: 'Hard clipping with threshold' },
            'tanh': { name: 'Tanh', description: 'Hyperbolic tangent curve' },
            'cubic': { name: 'Cubic', description: 'Cubic distortion: x - x³/3' },
            'chebyshev': { name: 'Chebyshev', description: 'Odd harmonic series' },
            'arctan': { name: 'Arctan', description: 'Arctangent saturation' },
            'sine': { name: 'Sine', description: 'Sine-based soft clipping' },
            'custom': { name: 'Custom', description: 'User-defined curve' }
        };
        
        // Custom curve state
        this.isCustomCurve = false;
        this.customCurvePoints = new Float32Array(512);
        
        // UI state
        this.selectedPreset = 'soft';
        this.editingMode = 'preset'; // 'preset' or 'custom'
        
        // Callbacks
        this.onCurveChange = options.onCurveChange || null;
        
        // Initialize with preset
        this.generateFromPreset(this.selectedPreset);
    }
    
    /**
     * Generate curve from preset
     */
    generateFromPreset(presetName) {
        const generator = this.curvePresets[presetName];
        if (generator) {
            this.curveType = presetName;
            this.isCustomCurve = false;
            this.selectedPreset = presetName;
            this.points = generator(this.drive);
            this._notifyCurveChange();
        }
    }
    
    /**
     * Generate soft clipping curve
     */
    generateSoftCurve(drive) {
        const curve = new Float32Array(512);
        const k = drive * 10 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            curve[i] = Math.tanh(x * k) / Math.tanh(k);
        }
        
        return curve;
    }
    
    /**
     * Generate hard clipping curve
     */
    generateHardCurve(drive) {
        const curve = new Float32Array(512);
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
     * Generate asymmetric curve
     */
    generateAsymmetricCurve(drive) {
        const curve = new Float32Array(512);
        const k = drive * 4 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            
            if (x > 0) {
                curve[i] = Math.tanh(x * k * 0.8) / Math.tanh(k * 0.8);
            } else {
                curve[i] = Math.tanh(x * k * 1.2) / Math.tanh(k * 1.2);
            }
        }
        
        return curve;
    }
    
    /**
     * Generate tube curve
     */
    generateTubeCurve(drive) {
        const curve = new Float32Array(512);
        const k = drive * 3 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            const absX = Math.abs(x);
            const sign = x >= 0 ? 1 : -1;
            
            curve[i] = sign * (1 - Math.exp(-absX * k)) / (1 - Math.exp(-k));
        }
        
        return curve;
    }
    
    /**
     * Generate fuzz curve
     */
    generateFuzzCurve(drive) {
        const curve = new Float32Array(512);
        const k = drive * 8 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            const shaped = x * k;
            
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
     * Generate rectifier curve
     */
    generateRectifierCurve(drive) {
        const curve = new Float32Array(512);
        const threshold = 1 - drive * 0.5;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            const k = 1 + drive * 3;
            
            if (x > 0) {
                curve[i] = Math.min(threshold, x * k);
            } else {
                curve[i] = x * k * (1 - drive * 0.3);
            }
        }
        
        return curve;
    }
    
    /**
     * Generate saturation curve
     */
    generateSaturateCurve(drive) {
        const curve = new Float32Array(512);
        const k = drive * 5 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            curve[i] = Math.atan(x * k) / Math.atan(k);
        }
        
        return curve;
    }
    
    /**
     * Generate fold curve
     */
    generateFoldCurve(drive) {
        const curve = new Float32Array(512);
        const folds = Math.floor(drive * 4) + 1;
        
        for (let i = 0; i < curve.length; i++) {
            let x = (i / curve.length) * 2 - 1;
            x *= (1 + drive);
            
            for (let f = 0; f < folds; f++) {
                if (x > 1) x = 2 - x;
                else if (x < -1) x = -2 - x;
            }
            
            curve[i] = Math.max(-1, Math.min(1, x));
        }
        
        return curve;
    }
    
    /**
     * Generate wrap curve
     */
    generateWrapCurve(drive) {
        const curve = new Float32Array(512);
        
        for (let i = 0; i < curve.length; i++) {
            let x = (i / curve.length) * 2 - 1;
            x *= (1 + drive);
            
            while (x > 1 || x < -1) {
                if (x > 1) x = x - 2;
                else if (x < -1) x = x + 2;
            }
            
            curve[i] = x;
        }
        
        return curve;
    }
    
    /**
     * Generate clip curve
     */
    generateClipCurve(drive) {
        const curve = new Float32Array(512);
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
     * Generate tanh curve
     */
    generateTanhCurve(drive) {
        const curve = new Float32Array(512);
        const k = drive * 10 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            curve[i] = Math.tanh(x * k);
        }
        
        return curve;
    }
    
    /**
     * Generate cubic curve
     */
    generateCubicCurve(drive) {
        const curve = new Float32Array(512);
        const k = drive * 2 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            const shaped = x * k;
            curve[i] = shaped - (shaped * shaped * shaped) / 3;
            curve[i] = Math.max(-1, Math.min(1, curve[i]));
        }
        
        return curve;
    }
    
    /**
     * Generate chebyshev curve
     */
    generateChebyshevCurve(drive) {
        const curve = new Float32Array(512);
        const order = Math.floor(drive * 8) + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            curve[i] = this._chebyshev(x, order);
        }
        
        return curve;
    }
    
    _chebyshev(x, n) {
        if (n === 0) return 1;
        if (n === 1) return x;
        return 2 * x * this._chebyshev(x, n - 1) - this._chebyshev(x, n - 2);
    }
    
    /**
     * Generate arctan curve
     */
    generateArctanCurve(drive) {
        const curve = new Float32Array(512);
        const k = drive * 5 + 1;
        
        for (let i = 0; i < curve.length; i++) {
            const x = (i / curve.length) * 2 - 1;
            curve[i] = Math.atan(x * k) / Math.atan(k);
        }
        
        return curve;
    }
    
    /**
     * Generate sine curve
     */
    generateSineCurve(drive) {
        const curve = new Float32Array(512);
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
        this.drive = Math.max(0, Math.min(1, value));
        if (!this.isCustomCurve) {
            this.points = this.curvePresets[this.selectedPreset]?.(this.drive) || this.points;
            this._notifyCurveChange();
        }
    }
    
    /**
     * Get current curve as Float32Array
     */
    getCurve() {
        return this.isCustomCurve ? this.customCurvePoints : this.points;
    }
    
    /**
     * Get curve for Web Audio WaveShaper
     */
    getWaveShaperCurve() {
        return this.getCurve();
    }
    
    /**
     * Set custom curve points (from canvas editing)
     */
    setCustomCurve(points) {
        this.customCurvePoints = new Float32Array(points);
        this.isCustomCurve = true;
        this.selectedPreset = 'custom';
        this._notifyCurveChange();
    }
    
    /**
     * Get available presets
     */
    getPresets() {
        return Object.keys(this.curvePresets).filter(p => p !== 'custom');
    }
    
    /**
     * Get preset metadata
     */
    getPresetMetadata(name) {
        return this.presetMetadata[name] || { name: name, description: '' };
    }
    
    /**
     * Notify curve change callback
     */
    _notifyCurveChange() {
        if (this.onCurveChange) {
            this.onCurveChange({
                curve: this.getCurve(),
                curveType: this.curveType,
                drive: this.drive,
                isCustom: this.isCustomCurve
            });
        }
    }
    
    /**
     * Get current state for serialization
     */
    getState() {
        return {
            drive: this.drive,
            curveType: this.curveType,
            selectedPreset: this.selectedPreset,
            isCustomCurve: this.isCustomCurve,
            customCurvePoints: Array.from(this.customCurvePoints)
        };
    }
    
    /**
     * Restore state from serialization
     */
    setState(state) {
        if (state.drive !== undefined) this.drive = state.drive;
        if (state.selectedPreset !== undefined) {
            this.selectedPreset = state.selectedPreset;
            if (state.isCustomCurve && state.customCurvePoints) {
                this.customCurvePoints = new Float32Array(state.customCurvePoints);
                this.isCustomCurve = true;
            } else {
                this.generateFromPreset(state.selectedPreset);
            }
        }
        this._notifyCurveChange();
    }
}

/**
 * Create a DistortionCurvesEditor instance
 */
function createDistortionCurvesEditor(audioContext, options = {}) {
    return new DistortionCurvesEditor({
        audioContext,
        ...options
    });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DistortionCurvesEditor, createDistortionCurvesEditor };
}