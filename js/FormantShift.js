/**
 * FormantShift - Shifts formant frequencies independently of pitch
 * Creates vocal-like filtering and "gender shift" effects
 */

export class FormantShift {
    constructor(options = {}) {
        this.name = 'FormantShift';
        
        // Configuration
        this.shift = options.shift ?? 0;      // Shift in semitones (0 = no shift, + = brighter, - = darker)
        this.formantScale = options.formantScale ?? 1; // Scale factor for formant frequencies
        this.mix = options.mix ?? 1;          // Wet/dry mix
        this.resonance = options.resonance ?? 1; // Resonance amount
        
        // Formant definitions (center frequencies and bandwidths)
        this.formants = [
            { freq: 800, bw: 80, amp: 1.0 },    // F1
            { freq: 1150, bw: 90, amp: 0.63 },  // F2
            { freq: 2900, bw: 120, amp: 0.1 },  // F3
            { freq: 3900, bw: 130, amp: 0.015 }, // F4
            { freq: 4950, bw: 140, amp: 0.001 } // F5
        ];
        
        // Create filter bank
        this.filters = [];
        this.sampleRate = 44100;
        
        // State for filters
        this.filterStates = [];
        
        this._initializeFilters();
    }
    
    /**
     * Initialize the formant filter bank
     */
    _initializeFilters() {
        this.filters = [];
        this.filterStates = [];
        
        for (const formant of this.formants) {
            this.filters.push({
                frequency: formant.freq,
                bandwidth: formant.bw,
                amplitude: formant.amp,
                // Biquad coefficients
                b0: 0, b1: 0, b2: 0,
                a1: 0, a2: 0
            });
            
            // Filter state (for IIR)
            this.filterStates.push({
                x1: 0, x2: 0,
                y1: 0, y2: 0
            });
        }
        
        this._updateFilterCoefficients();
    }
    
    /**
     * Update filter coefficients based on current formant settings
     */
    _updateFilterCoefficients() {
        const semitoneRatio = Math.pow(2, this.shift / 12);
        
        for (let i = 0; i < this.filters.length; i++) {
            const formant = this.formants[i];
            const filter = this.filters[i];
            
            // Apply shift and scale
            const shiftedFreq = formant.freq * semitoneRatio * this.formantScale;
            const scaledBw = formant.bw * this.formantScale;
            
            filter.frequency = Math.min(shiftedFreq, this.sampleRate / 2 - 100);
            filter.bandwidth = scaledBw;
            filter.amplitude = formant.amp * this.resonance;
            
            // Calculate bandpass filter coefficients (Peaking EQ)
            const freq = filter.frequency;
            const bw = filter.bandwidth;
            const gain = filter.amplitude * 20; // Convert to dB gain
            
            const w0 = 2 * Math.PI * freq / this.sampleRate;
            const cosW0 = Math.cos(w0);
            const sinW0 = Math.sin(w0);
            
            // Bandwidth to Q
            const Q = freq / bw;
            const A = Math.pow(10, gain / 40);
            const alpha = sinW0 / (2 * Q);
            
            // Peaking EQ coefficients
            const b0 = 1 + alpha * A;
            const b1 = -2 * cosW0;
            const b2 = 1 - alpha * A;
            const a0 = 1 + alpha / A;
            const a1 = -2 * cosW0;
            const a2 = 1 - alpha / A;
            
            // Normalize
            filter.b0 = b0 / a0;
            filter.b1 = b1 / a0;
            filter.b2 = b2 / a0;
            filter.a1 = a1 / a0;
            filter.a2 = a2 / a0;
        }
    }
    
    /**
     * Process audio through the formant filter bank
     * @param {Float32Array} samples - Input audio samples
     * @returns {Float32Array} Processed audio with formant shifting
     */
    process(samples) {
        if (!samples || samples.length === 0) {
            return samples;
        }
        
        const output = new Float32Array(samples.length);
        const wet = new Float32Array(samples.length);
        
        // Process through each formant filter (parallel)
        for (let f = 0; f < this.filters.length; f++) {
            const filter = this.filters[f];
            const state = this.filterStates[f];
            
            for (let i = 0; i < samples.length; i++) {
                const x = samples[i];
                
                // Direct Form I implementation
                const y = filter.b0 * x + 
                          filter.b1 * state.x1 + 
                          filter.b2 * state.x2 -
                          filter.a1 * state.y1 - 
                          filter.a2 * state.y2;
                
                // Update state
                state.x2 = state.x1;
                state.x1 = x;
                state.y2 = state.y1;
                state.y1 = y;
                
                // Sum wet signal (weighted by amplitude)
                wet[i] += y * filter.amplitude;
            }
        }
        
        // Normalize wet signal
        const maxWet = this.formants.reduce((sum, f) => sum + f.amp, 0);
        
        // Mix dry and wet
        for (let i = 0; i < samples.length; i++) {
            output[i] = samples[i] * (1 - this.mix) + (wet[i] / maxWet) * this.mix;
        }
        
        return output;
    }
    
    /**
     * Set formant shift in semitones
     * @param {number} semitones - Shift amount (-24 to +24)
     */
    setShift(semitones) {
        this.shift = Math.max(-24, Math.min(24, semitones));
        this._updateFilterCoefficients();
    }
    
    /**
     * Set formant scale factor
     * @param {number} scale - Scale factor (0.5 to 2.0)
     */
    setFormantScale(scale) {
        this.formantScale = Math.max(0.5, Math.min(2, scale));
        this._updateFilterCoefficients();
    }
    
    /**
     * Apply a vocal preset
     * @param {string} preset - Preset name ('male', 'female', 'child', 'deep', 'bright')
     */
    applyPreset(preset) {
        const presets = {
            'male': { shift: -2, scale: 0.85, resonance: 1.0 },
            'female': { shift: 4, scale: 1.15, resonance: 1.0 },
            'child': { shift: 8, scale: 1.3, resonance: 1.2 },
            'deep': { shift: -6, scale: 0.7, resonance: 1.3 },
            'bright': { shift: 6, scale: 1.2, resonance: 0.9 },
            'neutral': { shift: 0, scale: 1.0, resonance: 1.0 },
            'robot': { shift: 0, scale: 1.5, resonance: 1.5 },
            'whisper': { shift: 12, scale: 0.6, resonance: 0.7 }
        };
        
        const config = presets[preset];
        if (config) {
            this.shift = config.shift;
            this.formantScale = config.scale;
            this.resonance = config.resonance;
            this._updateFilterCoefficients();
        }
    }
    
    /**
     * Get current formant frequencies (for visualization)
     * @returns {Array} Array of formant objects with frequency, bandwidth, amplitude
     */
    getFormants() {
        return this.filters.map((f, i) => ({
            index: i,
            name: `F${i + 1}`,
            frequency: f.frequency,
            bandwidth: f.bandwidth,
            amplitude: f.amplitude
        }));
    }
    
    /**
     * Set a custom formant configuration
     * @param {Array} formants - Array of {freq, bw, amp} objects
     */
    setCustomFormants(formants) {
        if (!formants || formants.length === 0) return;
        
        this.formants = formants.map((f, i) => ({
            freq: f.freq ?? (500 + i * 500),
            bw: f.bw ?? 100,
            amp: f.amp ?? (1 / (i + 1))
        }));
        
        this._initializeFilters();
    }
    
    /**
     * Create an LPC-based formant estimator
     * @param {number} order - LPC order (number of formants to estimate)
     * @returns {function} Formant estimation function
     */
    createFormantEstimator(order = 5) {
        // Simple autocorrelation-based formant estimation
        return (samples) => {
            if (!samples || samples.length < order * 2) {
                return [];
            }
            
            const estimatedFormants = [];
            
            // Compute autocorrelation
            const r = new Float32Array(order + 1);
            for (let i = 0; i <= order; i++) {
                r[i] = 0;
                for (let j = 0; j < samples.length - i; j++) {
                    r[i] += samples[j] * samples[j + i];
                }
            }
            
            // Levinson-Durbin recursion for LPC coefficients
            const a = new Float32Array(order + 1);
            const aTemp = new Float32Array(order + 1);
            let E = r[0];
            
            a[0] = 1;
            
            for (let i = 1; i <= order; i++) {
                let sum = 0;
                for (let j = 1; j < i; j++) {
                    sum += a[j] * r[i - j];
                }
                
                const lambda = (r[i] - sum) / E;
                
                if (Math.abs(lambda) > 1) {
                    break; // Stability check
                }
                
                // Update coefficients
                for (let j = 1; j < i; j++) {
                    aTemp[j] = a[j] - lambda * a[i - j];
                }
                
                aTemp[i] = -lambda;
                
                for (let j = 1; j <= i; j++) {
                    a[j] = aTemp[j];
                }
                
                E = E * (1 - lambda * lambda);
            }
            
            // Find roots of the LPC polynomial to get formants
            // (Simplified - just return peaks from spectrum)
            for (let i = 1; i < order; i++) {
                if (i < order - 1) {
                    const freq = Math.abs(a[i]) * this.sampleRate / 2;
                    if (freq > 100 && freq < this.sampleRate / 2) {
                        estimatedFormants.push({
                            freq: freq,
                            bw: 50 + Math.abs(a[i + 1]) * 100,
                            amp: 1 / (i + 1)
                        });
                    }
                }
            }
            
            return estimatedFormants.slice(0, 5);
        };
    }
    
    /**
     * Reset filter states
     */
    reset() {
        for (const state of this.filterStates) {
            state.x1 = 0;
            state.x2 = 0;
            state.y1 = 0;
            state.y2 = 0;
        }
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.filters = [];
        this.filterStates = [];
    }
}

/**
 * Create a formant shift panel UI
 */
export function openFormantShiftPanel(processor) {
    const panel = document.createElement('div');
    panel.className = 'formant-shift-panel snug-panel';
    panel.innerHTML = `
        <div class="panel-header">
            <h3>Formant Shift</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="panel-content">
            <div class="formant-display">
                <canvas class="formant-viz" width="280" height="120"></canvas>
            </div>
            <div class="preset-section">
                <label>Presets:</label>
                <select id="formant-preset">
                    <option value="neutral">Neutral</option>
                    <option value="male">Male Voice</option>
                    <option value="female">Female Voice</option>
                    <option value="child">Child Voice</option>
                    <option value="deep">Deep Voice</option>
                    <option value="bright">Bright Voice</option>
                    <option value="robot">Robot</option>
                    <option value="whisper">Whisper</option>
                </select>
            </div>
            <div class="controls-section">
                <div class="control-row">
                    <label>Shift:</label>
                    <input type="range" min="-24" max="24" step="1" value="${processor.shift}" id="formant-shift">
                    <span id="formant-shift-val">${processor.shift} st</span>
                </div>
                <div class="control-row">
                    <label>Scale:</label>
                    <input type="range" min="0.5" max="2" step="0.01" value="${processor.formantScale}" id="formant-scale">
                    <span id="formant-scale-val">${processor.formantScale.toFixed(2)}x</span>
                </div>
                <div class="control-row">
                    <label>Resonance:</label>
                    <input type="range" min="0.5" max="2" step="0.01" value="${processor.resonance}" id="formant-resonance">
                    <span id="formant-resonance-val">${processor.resonance.toFixed(2)}</span>
                </div>
                <div class="control-row">
                    <label>Mix:</label>
                    <input type="range" min="0" max="1" step="0.01" value="${processor.mix}" id="formant-mix">
                    <span id="formant-mix-val">${(processor.mix * 100).toFixed(0)}%</span>
                </div>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .formant-shift-panel {
            background: var(--panel-bg, #1a1a2e);
            border: 1px solid var(--border-color, #3a3a5e);
            border-radius: 8px;
            padding: 16px;
            width: 320px;
            font-family: system-ui, sans-serif;
            color: var(--text-color, #e0e0e0);
        }
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .panel-header h3 {
            margin: 0;
            font-size: 14px;
        }
        .close-btn {
            background: none;
            border: none;
            color: inherit;
            font-size: 18px;
            cursor: pointer;
        }
        .formant-viz {
            width: 100%;
            height: 120px;
            background: #0a0a1a;
            border-radius: 4px;
            margin-bottom: 12px;
        }
        .preset-section {
            display: flex;
            align-items: center;
            margin-bottom: 12px;
        }
        .preset-section label {
            margin-right: 8px;
            font-size: 12px;
        }
        .preset-section select {
            flex: 1;
            background: #0a0a1a;
            border: 1px solid #3a3a5e;
            color: inherit;
            padding: 4px;
            border-radius: 4px;
        }
        .control-row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .control-row label {
            width: 80px;
            font-size: 12px;
        }
        .control-row input[type="range"] {
            flex: 1;
            margin-right: 8px;
        }
        .control-row span {
            width: 50px;
            text-align: right;
            font-size: 11px;
            font-family: monospace;
        }
    `;
    
    if (!document.querySelector('#formant-shift-styles')) {
        style.id = 'formant-shift-styles';
        document.head.appendChild(style);
    }
    
    // Wire up controls
    const presetSelect = panel.querySelector('#formant-preset');
    const shiftSlider = panel.querySelector('#formant-shift');
    const scaleSlider = panel.querySelector('#formant-scale');
    const resonanceSlider = panel.querySelector('#formant-resonance');
    const mixSlider = panel.querySelector('#formant-mix');
    
    presetSelect.addEventListener('change', (e) => {
        processor.applyPreset(e.target.value);
        shiftSlider.value = processor.shift;
        scaleSlider.value = processor.formantScale;
        resonanceSlider.value = processor.resonance;
        
        panel.querySelector('#formant-shift-val').textContent = `${processor.shift} st`;
        panel.querySelector('#formant-scale-val').textContent = `${processor.formantScale.toFixed(2)}x`;
        panel.querySelector('#formant-resonance-val').textContent = processor.resonance.toFixed(2);
    });
    
    shiftSlider.addEventListener('input', (e) => {
        processor.setShift(parseFloat(e.target.value));
        panel.querySelector('#formant-shift-val').textContent = `${processor.shift} st`;
    });
    
    scaleSlider.addEventListener('input', (e) => {
        processor.setFormantScale(parseFloat(e.target.value));
        panel.querySelector('#formant-scale-val').textContent = `${processor.formantScale.toFixed(2)}x`;
    });
    
    resonanceSlider.addEventListener('input', (e) => {
        processor.resonance = parseFloat(e.target.value);
        processor._updateFilterCoefficients();
        panel.querySelector('#formant-resonance-val').textContent = processor.resonance.toFixed(2);
    });
    
    mixSlider.addEventListener('input', (e) => {
        processor.mix = parseFloat(e.target.value);
        panel.querySelector('#formant-mix-val').textContent = `${(processor.mix * 100).toFixed(0)}%`;
    });
    
    // Close button
    panel.querySelector('.close-btn').addEventListener('click', () => {
        panel.remove();
    });
    
    // Draw formant visualization
    const canvas = panel.querySelector('.formant-viz');
    const ctx = canvas.getContext('2d');
    
    function drawFormants() {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const formants = processor.getFormants();
        const maxFreq = 6000;
        
        // Draw frequency axis
        ctx.strokeStyle = '#3a3a5e';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height - 20);
        ctx.lineTo(canvas.width, canvas.height - 20);
        ctx.stroke();
        
        // Draw formant peaks
        ctx.fillStyle = '#4CAF50';
        
        for (const formant of formants) {
            const x = (formant.frequency / maxFreq) * canvas.width;
            const height = formant.amplitude * 80;
            const width = Math.max(2, formant.bandwidth / 50);
            
            ctx.beginPath();
            ctx.ellipse(x, canvas.height - 20 - height / 2, width, height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Label
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '10px sans-serif';
            ctx.fillText(formant.name, x - 5, canvas.height - 5);
            ctx.fillStyle = '#4CAF50';
        }
        
        requestAnimationFrame(drawFormants);
    }
    
    drawFormants();
    
    return panel;
}

export default FormantShift;