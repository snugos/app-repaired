/**
 * HarmonicExciter - Add harmonic content to dull recordings
 * Uses phase manipulation and harmonic generation to enhance presence and brilliance
 */

export class HarmonicExciter {
    constructor(options = {}) {
        this.name = 'HarmonicExciter';
        
        // Excitation parameters
        this.amount = options.amount ?? 0.5; // 0-1, intensity of harmonics
        this.frequency = options.frequency ?? 2500; // Focus frequency in Hz
        this.oddEvenMix = options.oddEvenMix ?? 0.5; // 0 = even (warm), 1 = odd (present)
        this.oversample = options.oversample ?? 2; // Oversampling factor
        this.mix = options.mix ?? 0.5; // Wet/dry mix
        
        // Internal state
        this.sampleRate = options.sampleRate || 44100;
        this.phase = 0;
        
        // Delay buffer for oversampling
        this.delayBuffer = new Float32Array(16);
        this.delayIndex = 0;
        
        // Harmonic generation state
        this.harmonicBuffer = new Float32Array(0);
    }
    
    /**
     * Generate harmonics from input sample
     */
    _generateHarmonics(sample) {
        // Simple harmonic generation using waveshaping
        const input = sample * this.amount;
        
        // Generate odd harmonics (more aggressive, present)
        const odd = Math.sign(input) * (1 - Math.exp(-Math.abs(input) * 10));
        
        // Generate even harmonics (softer, warmer)
        const even = Math.sin(input * Math.PI);
        
        // Mix odd and even
        const harmonics = odd * this.oddEvenMix + even * (1 - this.oddEvenMix);
        
        return harmonics;
    }
    
    /**
     * Process a single sample with oversampling
     */
    _processSampleOversampled(input) {
        let output = 0;
        
        // Simple 2x oversampling via linear interpolation
        const samples = [
            input,
            (this.delayBuffer[this.delayIndex] + input) * 0.5
        ];
        
        for (const sample of samples) {
            const harmonic = this._generateHarmonics(sample);
            output += harmonic;
        }
        
        return output / 2; // Average the oversampled results
    }
    
    /**
     * Process audio through the harmonic exciter
     */
    process(samples) {
        if (!samples || samples.length === 0) {
            return samples;
        }
        
        const output = new Float32Array(samples.length);
        
        for (let i = 0; i < samples.length; i++) {
            const inputSample = samples[i];
            
            // Store for next iteration (delay)
            const delayedSample = this.delayBuffer[this.delayIndex];
            this.delayBuffer[this.delayIndex] = inputSample;
            this.delayIndex = (this.delayIndex + 1) % this.delayBuffer.length;
            
            // Process with oversampling
            let processed;
            if (this.oversample > 1) {
                processed = this._processSampleOversampled(inputSample);
            } else {
                processed = this._generateHarmonics(inputSample);
            }
            
            // Mix dry and wet
            output[i] = inputSample * (1 - this.mix) + processed * this.mix;
        }
        
        return output;
    }
    
    /**
     * Set excitation amount (0-1)
     */
    setAmount(amount) {
        this.amount = Math.max(0, Math.min(1, amount));
    }
    
    /**
     * Set focus frequency
     */
    setFrequency(freq) {
        this.frequency = Math.max(500, Math.min(12000, freq));
    }
    
    /**
     * Set odd/even harmonic mix (0 = even/warm, 1 = odd/present)
     */
    setOddEvenMix(mix) {
        this.oddEvenMix = Math.max(0, Math.min(1, mix));
    }
    
    /**
     * Set oversampling factor
     */
    setOversample(factor) {
        this.oversample = Math.max(1, Math.min(8, factor));
    }
    
    /**
     * Set wet/dry mix
     */
    setMix(mix) {
        this.mix = Math.max(0, Math.min(1, mix));
    }
    
    /**
     * Apply a preset
     */
    applyPreset(preset) {
        const presets = {
            'subtle': { amount: 0.3, freq: 3000, oddEvenMix: 0.3 },
            'presence': { amount: 0.5, freq: 4000, oddEvenMix: 0.6 },
            'air': { amount: 0.4, freq: 8000, oddEvenMix: 0.8 },
            'warm': { amount: 0.5, freq: 2000, oddEvenMix: 0.2 },
            'aggressive': { amount: 0.8, freq: 5000, oddEvenMix: 0.9 },
            'vocal': { amount: 0.5, freq: 3500, oddEvenMix: 0.5 }
        };
        
        const config = presets[preset];
        if (config) {
            this.amount = config.amount;
            this.frequency = config.freq;
            this.oddEvenMix = config.oddEvenMix;
        }
    }
    
    /**
     * Get current parameters
     */
    getParams() {
        return {
            amount: this.amount,
            frequency: this.frequency,
            oddEvenMix: this.oddEvenMix,
            oversample: this.oversample,
            mix: this.mix
        };
    }
    
    /**
     * Reset state
     */
    reset() {
        this.delayBuffer.fill(0);
        this.phase = 0;
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.delayBuffer = null;
        this.harmonicBuffer = null;
    }
}

/**
 * HarmonicExciterPanel - UI panel for harmonic exciter controls
 */
export function openHarmonicExciterPanel() {
    const processor = new HarmonicExciter();
    
    const panel = document.createElement('div');
    panel.className = 'harmonic-exciter-panel';
    panel.innerHTML = `
        <div class="he-header">
            <h3>Harmonic Exciter</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="he-content">
            <div class="he-display">
                <canvas class="he-viz" width="260" height="80"></canvas>
            </div>
            <div class="he-presets">
                <label>Presets:</label>
                <select id="he-preset">
                    <option value="subtle">Subtle</option>
                    <option value="presence">Presence</option>
                    <option value="air">Air</option>
                    <option value="warm">Warm</option>
                    <option value="aggressive">Aggressive</option>
                    <option value="vocal">Vocal</option>
                </select>
            </div>
            <div class="he-controls">
                <div class="he-row">
                    <label>Amount:</label>
                    <input type="range" id="he-amount" min="0" max="1" step="0.01" value="0.5">
                    <span id="he-amount-val">50%</span>
                </div>
                <div class="he-row">
                    <label>Frequency:</label>
                    <input type="range" id="he-freq" min="500" max="12000" step="100" value="2500">
                    <span id="he-freq-val">2.5 kHz</span>
                </div>
                <div class="he-row">
                    <label>Character:</label>
                    <input type="range" id="he-char" min="0" max="1" step="0.01" value="0.5">
                    <span id="he-char-val">Warm</span>
                </div>
                <div class="he-row">
                    <label>Mix:</label>
                    <input type="range" id="he-mix" min="0" max="1" step="0.01" value="0.5">
                    <span id="he-mix-val">50%</span>
                </div>
            </div>
        </div>
    `;
    
    // Styles
    const style = document.createElement('style');
    style.textContent = `
        .harmonic-exciter-panel {
            background: #1a1a2e;
            border: 1px solid #3a3a5e;
            border-radius: 8px;
            padding: 16px;
            width: 300px;
            font-family: system-ui, sans-serif;
            color: #e0e0e0;
        }
        .he-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .he-header h3 { margin: 0; font-size: 14px; }
        .close-btn { background: none; border: none; color: inherit; font-size: 18px; cursor: pointer; }
        .he-display { margin-bottom: 12px; }
        .he-viz { width: 100%; height: 80px; background: #0a0a1a; border-radius: 4px; }
        .he-presets { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .he-presets label { font-size: 12px; }
        .he-presets select { flex: 1; }
        .he-row { display: flex; align-items: center; margin-bottom: 8px; }
        .he-row label { width: 80px; font-size: 12px; }
        .he-row input[type="range"] { flex: 1; margin: 0 8px; }
        .he-row span { width: 70px; text-align: right; font-size: 11px; font-family: monospace; }
    `;
    
    if (!document.querySelector('#harmonic-exciter-styles')) {
        style.id = 'harmonic-exciter-styles';
        document.head.appendChild(style);
    }
    
    // Wire up
    panel.querySelector('#he-amount').addEventListener('input', (e) => {
        processor.setAmount(parseFloat(e.target.value));
        panel.querySelector('#he-amount-val').textContent = `${(processor.amount * 100).toFixed(0)}%`;
    });
    
    panel.querySelector('#he-freq').addEventListener('input', (e) => {
        processor.setFrequency(parseFloat(e.target.value));
        const freq = processor.frequency;
        panel.querySelector('#he-freq-val').textContent = freq >= 1000 ? `${(freq/1000).toFixed(1)} kHz` : `${freq.toFixed(0)} Hz`;
    });
    
    panel.querySelector('#he-char').addEventListener('input', (e) => {
        processor.setOddEvenMix(parseFloat(e.target.value));
        const char = processor.oddEvenMix < 0.4 ? 'Warm' : processor.oddEvenMix > 0.6 ? 'Present' : 'Balanced';
        panel.querySelector('#he-char-val').textContent = char;
    });
    
    panel.querySelector('#he-mix').addEventListener('input', (e) => {
        processor.setMix(parseFloat(e.target.value));
        panel.querySelector('#he-mix-val').textContent = `${(processor.mix * 100).toFixed(0)}%`;
    });
    
    panel.querySelector('#he-preset').addEventListener('change', (e) => {
        processor.applyPreset(e.target.value);
        panel.querySelector('#he-amount').value = processor.amount;
        panel.querySelector('#he-freq').value = processor.frequency;
        panel.querySelector('#he-char').value = processor.oddEvenMix;
        panel.querySelector('#he-amount-val').textContent = `${(processor.amount * 100).toFixed(0)}%`;
        const freq = processor.frequency;
        panel.querySelector('#he-freq-val').textContent = freq >= 1000 ? `${(freq/1000).toFixed(1)} kHz` : `${freq.toFixed(0)} Hz`;
        const char = processor.oddEvenMix < 0.4 ? 'Warm' : processor.oddEvenMix > 0.6 ? 'Present' : 'Balanced';
        panel.querySelector('#he-char-val').textContent = char;
    });
    
    panel.querySelector('.close-btn').addEventListener('click', () => {
        panel.remove();
        processor.dispose();
    });
    
    // Visualize harmonics
    const canvas = panel.querySelector('.he-viz');
    const ctx = canvas.getContext('2d');
    
    function drawHarmonics() {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const params = processor.getParams();
        
        // Draw frequency spectrum representation
        const bands = ['Sub', 'Low', 'Mid', 'High', 'Air'];
        const barWidth = canvas.width / bands.length - 4;
        
        for (let i = 0; i < bands.length; i++) {
            const x = i * (barWidth + 4) + 2;
            // Higher bands get more harmonic content based on amount
            const intensity = (i + 1) / bands.length;
            const height = intensity * params.amount * 60 + 5;
            const y = canvas.height - height - 10;
            
            // Color based on odd/even mix
            const hue = params.oddEvenMix < 0.5 ? 45 : 120;
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            
            ctx.fillRect(x, y, barWidth, height);
            
            // Labels
            ctx.fillStyle = '#888';
            ctx.font = '9px sans-serif';
            ctx.fillText(bands[i], x + barWidth/2 - 8, canvas.height - 2);
        }
        
        requestAnimationFrame(drawHarmonics);
    }
    
    drawHarmonics();
    
    return { panel, processor };
}

export default HarmonicExciter;