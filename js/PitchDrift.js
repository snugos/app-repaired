/**
 * PitchDrift - Gradual pitch drift effect for creating subtle vibrato/wobble
 * Uses a slow LFO to modulate pitch for organic, imperfect sound
 */

export class PitchDrift {
    constructor(options = {}) {
        this.name = 'PitchDrift';
        
        // Drift amount in semitones
        this.driftAmount = options.driftAmount ?? 2; // +/- 2 semitones
        this.driftRate = options.driftRate ?? 0.5; // LFO rate in Hz
        this.driftShape = options.driftShape ?? 'sine'; // sine, triangle, saw, square
        this.mix = options.mix ?? 0.5; // Wet/dry mix
        
        // Phase and state
        this.phase = 0;
        this.sampleRate = options.sampleRate || 44100;
        
        // For pitch-shifting, we use a simple time-stretch approach
        this.writeIndex = 0;
        this.readIndex = 0;
        this.delayBuffer = new Float32Array(this.sampleRate * 2); // 2 second buffer
        this.delayBuffer.fill(0);
        
        // Current pitch offset
        this.currentOffset = 0;
        this.targetOffset = 0;
        
        // Interpolation
        this.lastSample = 0;
        this.lastOffset = 0;
    }
    
    /**
     * Generate LFO value based on shape
     */
    _getLFOValue(phase) {
        switch (this.driftShape) {
            case 'sine':
                return Math.sin(phase * 2 * Math.PI);
            case 'triangle':
                return 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1;
            case 'saw':
                return 2 * (phase - Math.floor(phase + 0.5));
            case 'square':
                return phase < 0.5 ? 1 : -1;
            default:
                return Math.sin(phase * 2 * Math.PI);
        }
    }
    
    /**
     * Apply pitch drift to a single sample
     */
    _applyPitchDrift(sample) {
        // Write to delay buffer
        this.delayBuffer[this.writeIndex] = sample;
        this.writeIndex = (this.writeIndex + 1) % this.delayBuffer.length;
        
        // Calculate LFO phase
        const lfoValue = this._getLFOValue(this.phase);
        this.targetOffset = lfoValue * (this.driftAmount / 12); // Convert semitones to ratio
        
        // Smooth offset changes
        this.currentOffset += (this.targetOffset - this.currentOffset) * 0.1;
        
        // Calculate pitch-shifted read position
        // Pitch ratio: 1 = no change, >1 = higher, <1 = lower
        const pitchRatio = Math.pow(2, this.currentOffset);
        const readOffset = pitchRatio - 1;
        
        // Read from buffer with pitch shift
        let readPos = this.writeIndex - Math.floor(readOffset * 100);
        if (readPos < 0) readPos += this.delayBuffer.length;
        if (readPos >= this.delayBuffer.length) readPos -= this.delayBuffer.length;
        
        const readIndex = Math.floor(readPos) % this.delayBuffer.length;
        const frac = readPos - Math.floor(readPos);
        const nextIndex = (readIndex + 1) % this.delayBuffer.length;
        
        // Linear interpolation
        const delayed = this.delayBuffer[readIndex] * (1 - frac) + 
                       this.delayBuffer[nextIndex] * frac;
        
        // Update phase
        this.phase += this.driftRate / this.sampleRate;
        if (this.phase >= 1) this.phase -= 1;
        
        return delayed;
    }
    
    /**
     * Process audio through the pitch drift effect
     */
    process(samples) {
        if (!samples || samples.length === 0) {
            return samples;
        }
        
        const output = new Float32Array(samples.length);
        
        for (let i = 0; i < samples.length; i++) {
            const drySample = samples[i];
            const wetSample = this._applyPitchDrift(drySample);
            
            output[i] = drySample * (1 - this.mix) + wetSample * this.mix;
        }
        
        return output;
    }
    
    /**
     * Set drift amount in semitones
     */
    setDriftAmount(semitones) {
        this.driftAmount = Math.max(0, Math.min(12, semitones));
    }
    
    /**
     * Set drift rate in Hz
     */
    setDriftRate(rate) {
        this.driftRate = Math.max(0.01, Math.min(10, rate));
    }
    
    /**
     * Set LFO shape
     */
    setDriftShape(shape) {
        const validShapes = ['sine', 'triangle', 'saw', 'square'];
        if (validShapes.includes(shape)) {
            this.driftShape = shape;
        }
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
            'subtle': { amount: 0.5, rate: 0.2, shape: 'sine' },
            'vibrato': { amount: 3, rate: 5, shape: 'sine' },
            'wobble': { amount: 5, rate: 0.5, shape: 'triangle' },
            'drift': { amount: 2, rate: 0.3, shape: 'sine' },
            'warble': { amount: 4, rate: 2, shape: 'saw' },
            'flange': { amount: 1, rate: 1, shape: 'square' },
            'robotic': { amount: 6, rate: 8, shape: 'square' }
        };
        
        const config = presets[preset];
        if (config) {
            this.driftAmount = config.amount;
            this.driftRate = config.rate;
            this.driftShape = config.shape;
        }
    }
    
    /**
     * Get current LFO phase (for visualization)
     */
    getCurrentPhase() {
        return this.phase;
    }
    
    /**
     * Get current pitch offset ratio
     */
    getCurrentPitchRatio() {
        return Math.pow(2, this.currentOffset);
    }
    
    /**
     * Sync LFO phase to external clock
     */
    syncToClock(bpm) {
        // Sync to beat divisions
        const beatsPerCycle = 4; // 4 beats per LFO cycle
        const cyclesPerMinute = bpm / beatsPerCycle / 60;
        this.driftRate = cyclesPerMinute;
    }
    
    /**
     * Reset state
     */
    reset() {
        this.phase = 0;
        this.delayBuffer.fill(0);
        this.writeIndex = 0;
        this.currentOffset = 0;
        this.targetOffset = 0;
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.delayBuffer = null;
    }
}

/**
 * PitchDriftPanel - UI panel for pitch drift controls
 */
export function openPitchDriftPanel() {
    const panel = document.createElement('div');
    panel.className = 'pitch-drift-panel';
    panel.innerHTML = `
        <div class="pd-header">
            <h3>Pitch Drift</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="pd-content">
            <div class="pd-display">
                <canvas class="pd-viz" width="260" height="60"></canvas>
            </div>
            <div class="pd-presets">
                <label>Presets:</label>
                <select id="pd-preset">
                    <option value="subtle">Subtle</option>
                    <option value="vibrato">Vibrato</option>
                    <option value="wobble">Wobble</option>
                    <option value="drift">Drift</option>
                    <option value="warble">Warble</option>
                    <option value="flange">Flange</option>
                    <option value="robotic">Robotic</option>
                </select>
            </div>
            <div class="pd-controls">
                <div class="pd-row">
                    <label>Amount:</label>
                    <input type="range" id="pd-amount" min="0" max="12" step="0.1" value="2">
                    <span id="pd-amount-val">2.0 st</span>
                </div>
                <div class="pd-row">
                    <label>Rate:</label>
                    <input type="range" id="pd-rate" min="0.01" max="10" step="0.01" value="0.5">
                    <span id="pd-rate-val">0.50 Hz</span>
                </div>
                <div class="pd-row">
                    <label>Shape:</label>
                    <select id="pd-shape">
                        <option value="sine">Sine</option>
                        <option value="triangle">Triangle</option>
                        <option value="saw">Saw</option>
                        <option value="square">Square</option>
                    </select>
                </div>
                <div class="pd-row">
                    <label>Mix:</label>
                    <input type="range" id="pd-mix" min="0" max="1" step="0.01" value="0.5">
                    <span id="pd-mix-val">50%</span>
                </div>
            </div>
        </div>
    `;
    
    // Styles
    const style = document.createElement('style');
    style.textContent = `
        .pitch-drift-panel {
            background: #1a1a2e;
            border: 1px solid #3a3a5e;
            border-radius: 8px;
            padding: 16px;
            width: 300px;
            font-family: system-ui, sans-serif;
            color: #e0e0e0;
        }
        .pd-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
        }
        .pd-header h3 { margin: 0; font-size: 14px; }
        .close-btn {
            background: none;
            border: none;
            color: inherit;
            font-size: 18px;
            cursor: pointer;
        }
        .pd-display { margin-bottom: 12px; }
        .pd-viz {
            width: 100%;
            height: 60px;
            background: #0a0a1a;
            border-radius: 4px;
        }
        .pd-presets {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }
        .pd-presets label { font-size: 12px; }
        .pd-presets select { flex: 1; }
        .pd-row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .pd-row label { width: 60px; font-size: 12px; }
        .pd-row input[type="range"] { flex: 1; margin: 0 8px; }
        .pd-row select { flex: 1; }
        .pd-row span {
            width: 60px;
            text-align: right;
            font-size: 11px;
            font-family: monospace;
        }
    `;
    
    if (!document.querySelector('#pitch-drift-styles')) {
        style.id = 'pitch-drift-styles';
        document.head.appendChild(style);
    }
    
    // Wire up
    const processor = new PitchDrift();
    
    panel.querySelector('#pd-amount').addEventListener('input', (e) => {
        processor.setDriftAmount(parseFloat(e.target.value));
        panel.querySelector('#pd-amount-val').textContent = `${processor.driftAmount.toFixed(1)} st`;
    });
    
    panel.querySelector('#pd-rate').addEventListener('input', (e) => {
        processor.setDriftRate(parseFloat(e.target.value));
        panel.querySelector('#pd-rate-val').textContent = `${processor.driftRate.toFixed(2)} Hz`;
    });
    
    panel.querySelector('#pd-shape').addEventListener('change', (e) => {
        processor.setDriftShape(e.target.value);
    });
    
    panel.querySelector('#pd-mix').addEventListener('input', (e) => {
        processor.setMix(parseFloat(e.target.value));
        panel.querySelector('#pd-mix-val').textContent = `${(processor.mix * 100).toFixed(0)}%`;
    });
    
    panel.querySelector('#pd-preset').addEventListener('change', (e) => {
        processor.applyPreset(e.target.value);
        panel.querySelector('#pd-amount').value = processor.driftAmount;
        panel.querySelector('#pd-rate').value = processor.driftRate;
        panel.querySelector('#pd-shape').value = processor.driftShape;
        panel.querySelector('#pd-amount-val').textContent = `${processor.driftAmount.toFixed(1)} st`;
        panel.querySelector('#pd-rate-val').textContent = `${processor.driftRate.toFixed(2)} Hz`;
    });
    
    panel.querySelector('.close-btn').addEventListener('click', () => {
        panel.remove();
        processor.dispose();
    });
    
    // Visualize LFO
    const canvas = panel.querySelector('.pd-viz');
    const ctx = canvas.getContext('2d');
    
    function drawLFO() {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw center line
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        // Draw LFO wave
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let x = 0; x < canvas.width; x++) {
            const phase = (x / canvas.width + processor.getCurrentPhase()) % 1;
            const lfoValue = Math.sin(phase * Math.PI * 2);
            const y = canvas.height / 2 - (lfoValue * processor.driftAmount * 5);
            
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        requestAnimationFrame(drawLFO);
    }
    
    drawLFO();
    
    return { panel, processor };
}

export default PitchDrift;