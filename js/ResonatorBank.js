/**
 * ResonatorBank - Multiple resonant filters for metallic and bell-like sounds
 * Creates additive-style resonances at harmonic or custom frequencies
 */

export class ResonatorBank {
    constructor(options = {}) {
        this.name = 'ResonatorBank';
        
        // Configuration
        this.numResonators = options.numResonators ?? 8;
        this.fundamental = options.fundamental ?? 220; // Base frequency in Hz
        this.decay = options.decay ?? 2.0;             // Decay time in seconds
        this.brightness = options.brightness ?? 0.7;    // Brightness (affects higher partials)
        this.inharmonicity = options.inharmonicity ?? 0; // Inharmonicity factor (for bell-like sounds)
        this.mix = options.mix ?? 0.5;                  // Wet/dry mix
        this.feedback = options.feedback ?? 0;          // Feedback amount
        
        // Resonator states
        this.resonators = [];
        this.sampleRate = 44100;
        
        this._initializeResonators();
    }
    
    /**
     * Initialize the resonator bank
     */
    _initializeResonators() {
        this.resonators = [];
        
        for (let i = 0; i < this.numResonators; i++) {
            const harmonic = i + 1;
            
            // Calculate frequency with inharmonicity
            const inharmonicityShift = this.inharmonicity * Math.pow(harmonic, 2) * 0.01;
            const freq = this.fundamental * harmonic * (1 + inharmonicityShift);
            
            // Calculate decay per resonator
            const decayScale = Math.pow(this.brightness, i);
            const resonatorDecay = this.decay * decayScale;
            
            // Bandwidth based on decay (shorter decay = wider bandwidth)
            const bandwidth = 1 / (resonatorDecay * Math.PI * 2);
            
            this.resonators.push({
                harmonic: harmonic,
                frequency: Math.min(freq, this.sampleRate / 2 - 100),
                decay: resonatorDecay,
                bandwidth: bandwidth,
                amplitude: decayScale,
                // Filter state
                y1: 0, y2: 0,
                // Excitation
                excitation: 0,
                excitationDecay: 0
            });
        }
        
        this._updateCoefficients();
    }
    
    /**
     * Update filter coefficients for all resonators
     */
    _updateCoefficients() {
        for (const res of this.resonators) {
            const w0 = 2 * Math.PI * res.frequency / this.sampleRate;
            const bandwidth = Math.max(1, res.bandwidth);
            const Q = res.frequency / bandwidth;
            
            // Bandpass resonator coefficients
            const alpha = Math.sin(w0) / (2 * Q);
            
            res.b0 = alpha;
            res.b1 = 0;
            res.b2 = -alpha;
            res.a1 = -2 * Math.cos(w0);
            res.a2 = 1 - alpha;
            
            // Normalize
            const a0 = 1 + alpha;
            res.b0 /= a0;
            res.b1 /= a0;
            res.b2 /= a0;
            res.a1 /= a0;
            res.a2 /= a0;
        }
    }
    
    /**
     * Excite all resonators (trigger mode)
     * @param {number} velocity - Excitation velocity (0-1)
     */
    excite(velocity = 1) {
        for (const res of this.resonators) {
            res.excitation = velocity * res.amplitude;
            res.excitationDecay = 0.999;
        }
    }
    
    /**
     * Process audio through the resonator bank
     * @param {Float32Array} samples - Input audio samples
     * @returns {Float32Array} Processed audio
     */
    process(samples) {
        if (!samples || samples.length === 0) {
            return samples;
        }
        
        const output = new Float32Array(samples.length);
        const wet = new Float32Array(samples.length);
        
        // Process through each resonator (parallel)
        for (const res of this.resonators) {
            for (let i = 0; i < samples.length; i++) {
                // Input with excitation
                const x = samples[i] + res.excitation;
                
                // Apply resonant filter (Direct Form I)
                const y = res.b0 * x + 
                          res.b1 * res.x1 + 
                          res.b2 * res.x2 -
                          res.a1 * res.y1 - 
                          res.a2 * res.y2;
                
                // Update state
                res.x2 = res.x1;
                res.x1 = x;
                res.y2 = res.y1;
                res.y1 = y;
                
                // Decay excitation
                res.excitation *= res.excitationDecay;
                
                // Sum wet signal
                wet[i] += y * res.amplitude;
            }
        }
        
        // Apply feedback
        if (this.feedback > 0) {
            for (let i = 0; i < samples.length; i++) {
                wet[i] += wet[i] * this.feedback;
            }
        }
        
        // Mix dry and wet
        const wetGain = 1 / Math.sqrt(this.numResonators);
        for (let i = 0; i < samples.length; i++) {
            output[i] = samples[i] * (1 - this.mix) + wet[i] * wetGain * this.mix;
        }
        
        return output;
    }
    
    /**
     * Set the fundamental frequency
     * @param {number} freq - Fundamental frequency in Hz
     */
    setFundamental(freq) {
        this.fundamental = Math.max(20, Math.min(10000, freq));
        this._initializeResonators();
    }
    
    /**
     * Set decay time
     * @param {number} decay - Decay time in seconds
     */
    setDecay(decay) {
        this.decay = Math.max(0.01, Math.min(30, decay));
        this._initializeResonators();
    }
    
    /**
     * Set brightness
     * @param {number} brightness - Brightness (0-1)
     */
    setBrightness(brightness) {
        this.brightness = Math.max(0, Math.min(1, brightness));
        this._initializeResonators();
    }
    
    /**
     * Set inharmonicity
     * @param {number} inharm - Inharmonicity factor (0-1)
     */
    setInharmonicity(inharm) {
        this.inharmonicity = Math.max(0, Math.min(1, inharm));
        this._initializeResonators();
    }
    
    /**
     * Apply a preset
     * @param {string} preset - Preset name
     */
    applyPreset(preset) {
        const presets = {
            'string': { fundamental: 220, decay: 3, brightness: 0.7, inharmonicity: 0 },
            'piano': { fundamental: 261.63, decay: 4, brightness: 0.6, inharmonicity: 0.01 },
            'bell': { fundamental: 440, decay: 8, brightness: 0.9, inharmonicity: 0.5 },
            'gong': { fundamental: 150, decay: 12, brightness: 0.8, inharmonicity: 0.8 },
            'marimba': { fundamental: 330, decay: 1.5, brightness: 0.5, inharmonicity: 0 },
            'glass': { fundamental: 880, decay: 6, brightness: 0.95, inharmonicity: 0.1 },
            'metal': { fundamental: 200, decay: 5, brightness: 0.85, inharmonicity: 0.7 },
            'wood': { fundamental: 180, decay: 0.8, brightness: 0.3, inharmonicity: 0.05 }
        };
        
        const config = presets[preset];
        if (config) {
            this.fundamental = config.fundamental;
            this.decay = config.decay;
            this.brightness = config.brightness;
            this.inharmonicity = config.inharmonicity;
            this._initializeResonators();
        }
    }
    
    /**
     * Get resonator data for visualization
     * @returns {Array} Array of resonator states
     */
    getResonators() {
        return this.resonators.map((r, i) => ({
            index: i,
            harmonic: r.harmonic,
            frequency: r.frequency,
            decay: r.decay,
            amplitude: r.amplitude
        }));
    }
    
    /**
     * Set custom resonator frequencies
     * @param {Array} frequencies - Array of frequency values
     */
    setCustomFrequencies(frequencies) {
        if (!frequencies || frequencies.length === 0) return;
        
        this.numResonators = frequencies.length;
        this._initializeResonators();
        
        for (let i = 0; i < frequencies.length; i++) {
            if (this.resonators[i]) {
                this.resonators[i].frequency = Math.min(frequencies[i], this.sampleRate / 2 - 100);
            }
        }
        
        this._updateCoefficients();
    }
    
    /**
     * Create a resonator tuned to a specific note
     * @param {number} midiNote - MIDI note number
     * @param {number} detune - Detune in cents
     * @returns {number} Frequency in Hz
     */
    static midiToFreq(midiNote, detune = 0) {
        return 440 * Math.pow(2, (midiNote - 69 + detune / 100) / 12);
    }
    
    /**
     * Create a chord of resonators
     * @param {Array} midiNotes - Array of MIDI note numbers
     */
    setChord(midiNotes) {
        if (!midiNotes || midiNotes.length === 0) return;
        
        const frequencies = midiNotes.map(note => ResonatorBank.midiToFreq(note));
        this.setCustomFrequencies(frequencies);
    }
    
    /**
     * Create a harmonic series from a fundamental
     * @param {number} fundamental - Fundamental frequency
     * @param {number} numHarmonics - Number of harmonics to generate
     */
    setHarmonicSeries(fundamental, numHarmonics = 8) {
        this.fundamental = fundamental;
        this.numResonators = numHarmonics;
        this.inharmonicity = 0;
        this._initializeResonators();
    }
    
    /**
     * Create an inharmonic series (for bells, gongs, etc.)
     * @param {number} fundamental - Fundamental frequency
     * @param {Array} ratios - Array of frequency ratios
     */
    setInharmonicSeries(fundamental, ratios) {
        if (!ratios || ratios.length === 0) return;
        
        const frequencies = ratios.map(ratio => fundamental * ratio);
        this.setCustomFrequencies(frequencies);
    }
    
    /**
     * Reset all resonator states
     */
    reset() {
        for (const res of this.resonators) {
            res.y1 = 0;
            res.y2 = 0;
            res.x1 = 0;
            res.x2 = 0;
            res.excitation = 0;
        }
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.resonators = [];
    }
}

/**
 * Create a resonator bank panel UI
 */
export function openResonatorBankPanel(processor) {
    const panel = document.createElement('div');
    panel.className = 'resonator-bank-panel snug-panel';
    panel.innerHTML = `
        <div class="panel-header">
            <h3>Resonator Bank</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="panel-content">
            <div class="resonator-display">
                <canvas class="resonator-viz" width="280" height="100"></canvas>
            </div>
            <div class="preset-section">
                <label>Presets:</label>
                <select id="resonator-preset">
                    <option value="string">String</option>
                    <option value="piano">Piano</option>
                    <option value="bell">Bell</option>
                    <option value="gong">Gong</option>
                    <option value="marimba">Marimba</option>
                    <option value="glass">Glass</option>
                    <option value="metal">Metal</option>
                    <option value="wood">Wood</option>
                </select>
            </div>
            <div class="controls-section">
                <div class="control-row">
                    <label>Fundamental:</label>
                    <input type="range" min="20" max="1000" step="1" value="${processor.fundamental}" id="res-fundamental">
                    <span id="res-fundamental-val">${processor.fundamental.toFixed(0)} Hz</span>
                </div>
                <div class="control-row">
                    <label>Decay:</label>
                    <input type="range" min="0.1" max="15" step="0.1" value="${processor.decay}" id="res-decay">
                    <span id="res-decay-val">${processor.decay.toFixed(1)}s</span>
                </div>
                <div class="control-row">
                    <label>Brightness:</label>
                    <input type="range" min="0" max="1" step="0.01" value="${processor.brightness}" id="res-brightness">
                    <span id="res-brightness-val">${(processor.brightness * 100).toFixed(0)}%</span>
                </div>
                <div class="control-row">
                    <label>Inharmonicity:</label>
                    <input type="range" min="0" max="1" step="0.01" value="${processor.inharmonicity}" id="res-inharmonicity">
                    <span id="res-inharmonicity-val">${(processor.inharmonicity * 100).toFixed(0)}%</span>
                </div>
                <div class="control-row">
                    <label>Mix:</label>
                    <input type="range" min="0" max="1" step="0.01" value="${processor.mix}" id="res-mix">
                    <span id="res-mix-val">${(processor.mix * 100).toFixed(0)}%</span>
                </div>
                <div class="control-row">
                    <label>Feedback:</label>
                    <input type="range" min="0" max="0.95" step="0.01" value="${processor.feedback}" id="res-feedback">
                    <span id="res-feedback-val">${(processor.feedback * 100).toFixed(0)}%</span>
                </div>
            </div>
            <div class="actions-section">
                <button id="resonator-excite" class="action-btn">Excite</button>
                <button id="resonator-reset" class="action-btn">Reset</button>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .resonator-bank-panel {
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
        .resonator-viz {
            width: 100%;
            height: 100px;
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
            width: 90px;
            font-size: 12px;
        }
        .control-row input[type="range"] {
            flex: 1;
            margin-right: 8px;
        }
        .control-row span {
            width: 60px;
            text-align: right;
            font-size: 11px;
            font-family: monospace;
        }
        .actions-section {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        .action-btn {
            flex: 1;
            background: #3a3a5e;
            border: none;
            color: inherit;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .action-btn:hover {
            background: #4a4a7e;
        }
    `;
    
    if (!document.querySelector('#resonator-bank-styles')) {
        style.id = 'resonator-bank-styles';
        document.head.appendChild(style);
    }
    
    // Wire up controls
    const presetSelect = panel.querySelector('#resonator-preset');
    const fundamentalSlider = panel.querySelector('#res-fundamental');
    const decaySlider = panel.querySelector('#res-decay');
    const brightnessSlider = panel.querySelector('#res-brightness');
    const inharmonicitySlider = panel.querySelector('#res-inharmonicity');
    const mixSlider = panel.querySelector('#res-mix');
    const feedbackSlider = panel.querySelector('#res-feedback');
    const exciteBtn = panel.querySelector('#resonator-excite');
    const resetBtn = panel.querySelector('#resonator-reset');
    
    presetSelect.addEventListener('change', (e) => {
        processor.applyPreset(e.target.value);
        fundamentalSlider.value = processor.fundamental;
        decaySlider.value = processor.decay;
        brightnessSlider.value = processor.brightness;
        inharmonicitySlider.value = processor.inharmonicity;
        
        updateDisplayValues();
    });
    
    fundamentalSlider.addEventListener('input', (e) => {
        processor.setFundamental(parseFloat(e.target.value));
        panel.querySelector('#res-fundamental-val').textContent = `${processor.fundamental.toFixed(0)} Hz`;
    });
    
    decaySlider.addEventListener('input', (e) => {
        processor.setDecay(parseFloat(e.target.value));
        panel.querySelector('#res-decay-val').textContent = `${processor.decay.toFixed(1)}s`;
    });
    
    brightnessSlider.addEventListener('input', (e) => {
        processor.setBrightness(parseFloat(e.target.value));
        panel.querySelector('#res-brightness-val').textContent = `${(processor.brightness * 100).toFixed(0)}%`;
    });
    
    inharmonicitySlider.addEventListener('input', (e) => {
        processor.setInharmonicity(parseFloat(e.target.value));
        panel.querySelector('#res-inharmonicity-val').textContent = `${(processor.inharmonicity * 100).toFixed(0)}%`;
    });
    
    mixSlider.addEventListener('input', (e) => {
        processor.mix = parseFloat(e.target.value);
        panel.querySelector('#res-mix-val').textContent = `${(processor.mix * 100).toFixed(0)}%`;
    });
    
    feedbackSlider.addEventListener('input', (e) => {
        processor.feedback = parseFloat(e.target.value);
        panel.querySelector('#res-feedback-val').textContent = `${(processor.feedback * 100).toFixed(0)}%`;
    });
    
    exciteBtn.addEventListener('click', () => {
        processor.excite(1);
    });
    
    resetBtn.addEventListener('click', () => {
        processor.reset();
    });
    
    // Close button
    panel.querySelector('.close-btn').addEventListener('click', () => {
        panel.remove();
    });
    
    function updateDisplayValues() {
        panel.querySelector('#res-fundamental-val').textContent = `${processor.fundamental.toFixed(0)} Hz`;
        panel.querySelector('#res-decay-val').textContent = `${processor.decay.toFixed(1)}s`;
        panel.querySelector('#res-brightness-val').textContent = `${(processor.brightness * 100).toFixed(0)}%`;
        panel.querySelector('#res-inharmonicity-val').textContent = `${(processor.inharmonicity * 100).toFixed(0)}%`;
    }
    
    // Draw resonator visualization
    const canvas = panel.querySelector('.resonator-viz');
    const ctx = canvas.getContext('2d');
    
    function drawResonators() {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const resonators = processor.getResonators();
        const maxFreq = processor.fundamental * processor.numResonators * 1.5;
        
        // Draw resonators as bars
        const barWidth = canvas.width / resonators.length - 4;
        
        for (let i = 0; i < resonators.length; i++) {
            const res = resonators[i];
            const x = i * (barWidth + 4) + 2;
            const height = res.amplitude * 70;
            const y = canvas.height - height - 20;
            
            // Frequency-based color
            const hue = (res.frequency / maxFreq) * 120 + 180; // Green to cyan
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            
            ctx.fillRect(x, y, barWidth, height);
            
            // Frequency label
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '8px sans-serif';
            ctx.fillText(`${res.frequency.toFixed(0)}`, x, canvas.height - 8);
        }
        
        requestAnimationFrame(drawResonators);
    }
    
    drawResonators();
    
    return panel;
}

export default ResonatorBank;