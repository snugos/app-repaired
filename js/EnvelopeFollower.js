/**
 * EnvelopeFollower - Detects amplitude envelope and provides modulation output
 * Useful for ducking, sidechain-style effects, and dynamic processing
 */

export class EnvelopeFollower {
    constructor(options = {}) {
        this.name = 'EnvelopeFollower';
        
        // Configuration
        this.attack = options.attack ?? 0.01;  // Attack time in seconds
        this.release = options.release ?? 0.1; // Release time in seconds
        this.smoothing = options.smoothing ?? 0.5; // Additional smoothing factor
        this.threshold = options.threshold ?? -60; // Threshold in dB
        this.range = options.range ?? 60; // Range above threshold in dB
        
        // State
        this.lastValue = 0;
        this.lastPeak = 0;
        this.sampleRate = 44100;
        
        // Callbacks for envelope events
        this.onPeak = null;
        this.onEnvelope = null;
        this.onThresholdCross = null;
        
        // Modulation output
        this.modulationOutput = 0;
        this.normalizedOutput = 0;
        
        // Analysis buffer
        this.analysisBuffer = new Float32Array(256);
        this.bufferIndex = 0;
        
        // Frequency tracking
        this.zeroCrossings = 0;
        this.lastSampleSign = 0;
    }
    
    /**
     * Process audio buffer and extract envelope
     * @param {Float32Array} samples - Audio samples to analyze
     * @returns {object} Envelope data and modulation values
     */
    process(samples) {
        if (!samples || samples.length === 0) {
            return { envelope: 0, normalized: 0, peak: false };
        }
        
        const attackCoeff = Math.exp(-1 / (this.attack * this.sampleRate));
        const releaseCoeff = Math.exp(-1 / (this.release * this.sampleRate));
        
        let currentEnvelope = this.lastValue;
        let peakDetected = false;
        let maxSample = 0;
        
        // Process each sample
        for (let i = 0; i < samples.length; i++) {
            const absSample = Math.abs(samples[i]);
            maxSample = Math.max(maxSample, absSample);
            
            // Envelope detection with attack/release
            if (absSample > currentEnvelope) {
                currentEnvelope = attackCoeff * currentEnvelope + (1 - attackCoeff) * absSample;
            } else {
                currentEnvelope = releaseCoeff * currentEnvelope + (1 - releaseCoeff) * absSample;
            }
            
            // Zero crossing detection for frequency estimation
            const currentSign = samples[i] >= 0 ? 1 : -1;
            if (currentSign !== this.lastSampleSign) {
                this.zeroCrossings++;
            }
            this.lastSampleSign = currentSign;
        }
        
        // Apply smoothing
        currentEnvelope = this.smoothing * this.lastValue + (1 - this.smoothing) * currentEnvelope;
        this.lastValue = currentEnvelope;
        
        // Convert to dB
        const db = 20 * Math.log10(Math.max(currentEnvelope, 1e-10));
        
        // Normalize to 0-1 range based on threshold and range
        const normalizedValue = Math.max(0, Math.min(1, 
            (db - this.threshold) / this.range
        ));
        this.normalizedOutput = normalizedValue;
        this.modulationOutput = currentEnvelope;
        
        // Peak detection
        if (currentEnvelope > this.lastPeak * 1.5) {
            peakDetected = true;
            if (this.onPeak) {
                this.onPeak(currentEnvelope, db);
            }
        }
        this.lastPeak = currentEnvelope;
        
        // Threshold crossing detection
        const thresholdLinear = Math.pow(10, this.threshold / 20);
        if (currentEnvelope > thresholdLinear && this.lastValue <= thresholdLinear) {
            if (this.onThresholdCross) {
                this.onThresholdCross(true, db);
            }
        }
        
        // Envelope callback
        if (this.onEnvelope) {
            this.onEnvelope(currentEnvelope, normalizedValue, db);
        }
        
        // Store in analysis buffer for visualization
        this.analysisBuffer[this.bufferIndex] = currentEnvelope;
        this.bufferIndex = (this.bufferIndex + 1) % this.analysisBuffer.length;
        
        return {
            envelope: currentEnvelope,
            normalized: normalizedValue,
            db: db,
            peak: peakDetected,
            maxSample: maxSample,
            frequency: this.estimateFrequency(samples.length)
        };
    }
    
    /**
     * Estimate frequency from zero crossings
     * @param {number} sampleCount - Number of samples analyzed
     * @returns {number} Estimated frequency in Hz
     */
    estimateFrequency(sampleCount) {
        if (this.zeroCrossings === 0 || sampleCount === 0) {
            return 0;
        }
        const frequency = (this.zeroCrossings / 2) * (this.sampleRate / sampleCount);
        this.zeroCrossings = 0; // Reset for next analysis
        return frequency;
    }
    
    /**
     * Get modulation output suitable for controlling parameters
     * @param {number} amount - Amount of modulation (0-1)
     * @param {string} mode - 'direct', 'inverted', or 'bipolar'
     * @returns {number} Modulation value scaled by amount
     */
    getModulation(amount = 1, mode = 'direct') {
        switch (mode) {
            case 'inverted':
                return (1 - this.normalizedOutput) * amount;
            case 'bipolar':
                return (this.normalizedOutput * 2 - 1) * amount;
            case 'direct':
            default:
                return this.normalizedOutput * amount;
        }
    }
    
    /**
     * Get the analysis buffer for visualization
     * @returns {Float32Array} Buffer of envelope values
     */
    getAnalysisBuffer() {
        const buffer = new Float32Array(this.analysisBuffer.length);
        // Copy in correct order (oldest to newest)
        for (let i = 0; i < this.analysisBuffer.length; i++) {
            buffer[i] = this.analysisBuffer[(this.bufferIndex + i) % this.analysisBuffer.length];
        }
        return buffer;
    }
    
    /**
     * Reset the follower state
     */
    reset() {
        this.lastValue = 0;
        this.lastPeak = 0;
        this.modulationOutput = 0;
        this.normalizedOutput = 0;
        this.zeroCrossings = 0;
        this.analysisBuffer.fill(0);
        this.bufferIndex = 0;
    }
    
    /**
     * Configure the follower parameters
     * @param {object} options - Configuration options
     */
    configure(options) {
        if (options.attack !== undefined) this.attack = options.attack;
        if (options.release !== undefined) this.release = options.release;
        if (options.smoothing !== undefined) this.smoothing = options.smoothing;
        if (options.threshold !== undefined) this.threshold = options.threshold;
        if (options.range !== undefined) this.range = options.range;
        if (options.sampleRate !== undefined) this.sampleRate = options.sampleRate;
    }
    
    /**
     * Create a ducking processor using this follower
     * @param {object} options - Ducking options
     * @returns {function} Ducking processor function
     */
    createDucker(options = {}) {
        const reduction = options.reduction ?? -12; // dB reduction when ducking
        const knee = options.knee ?? 6; // dB knee width
        
        return (inputSamples, sidechainSamples) => {
            // Process sidechain to get envelope
            const env = this.process(sidechainSamples);
            
            // Calculate gain reduction
            const normalized = env.normalized;
            const reductionLinear = Math.pow(10, reduction / 20);
            
            // Apply soft knee
            const kneeStart = 0.5;
            let gainReduction;
            if (normalized < kneeStart) {
                gainReduction = 1;
            } else {
                const kneeProgress = (normalized - kneeStart) / (1 - kneeStart);
                gainReduction = 1 - (1 - reductionLinear) * kneeProgress;
            }
            
            // Apply gain reduction to input
            const output = new Float32Array(inputSamples.length);
            for (let i = 0; i < inputSamples.length; i++) {
                output[i] = inputSamples[i] * gainReduction;
            }
            
            return output;
        };
    }
    
    /**
     * Create an RMS-based envelope follower
     * @param {number} windowSize - Window size in samples
     * @returns {function} RMS processor function
     */
    createRMSFollower(windowSize = 512) {
        const window = new Float32Array(windowSize);
        let windowIndex = 0;
        let sumSquares = 0;
        
        return (samples) => {
            let rmsSum = 0;
            
            for (let i = 0; i < samples.length; i++) {
                // Remove oldest sample from sum
                sumSquares -= window[windowIndex] * window[windowIndex];
                
                // Add new sample
                const sample = samples[i];
                window[windowIndex] = sample;
                sumSquares += sample * sample;
                
                // Move window
                windowIndex = (windowIndex + 1) % windowSize;
                
                // Calculate RMS
                rmsSum += Math.sqrt(sumSquares / windowSize);
            }
            
            return rmsSum / samples.length;
        };
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.analysisBuffer = null;
        this.onPeak = null;
        this.onEnvelope = null;
        this.onThresholdCross = null;
    }
}

/**
 * Create an envelope follower panel UI
 */
export function openEnvelopeFollowerPanel(follower) {
    const panel = document.createElement('div');
    panel.className = 'envelope-follower-panel snug-panel';
    panel.innerHTML = `
        <div class="panel-header">
            <h3>Envelope Follower</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="panel-content">
            <div class="display-section">
                <canvas class="envelope-display" width="300" height="100"></canvas>
                <div class="meter-row">
                    <label>Level:</label>
                    <div class="meter-bar">
                        <div class="meter-fill" id="env-level"></div>
                    </div>
                    <span id="env-db">-∞ dB</span>
                </div>
            </div>
            <div class="controls-section">
                <div class="control-row">
                    <label>Attack:</label>
                    <input type="range" min="0.001" max="0.5" step="0.001" value="${follower.attack}" id="env-attack">
                    <span id="env-attack-val">${follower.attack.toFixed(3)}s</span>
                </div>
                <div class="control-row">
                    <label>Release:</label>
                    <input type="range" min="0.01" max="2" step="0.01" value="${follower.release}" id="env-release">
                    <span id="env-release-val">${follower.release.toFixed(2)}s</span>
                </div>
                <div class="control-row">
                    <label>Smoothing:</label>
                    <input type="range" min="0" max="1" step="0.01" value="${follower.smoothing}" id="env-smoothing">
                    <span id="env-smoothing-val">${follower.smoothing.toFixed(2)}</span>
                </div>
                <div class="control-row">
                    <label>Threshold:</label>
                    <input type="range" min="-96" max="0" step="1" value="${follower.threshold}" id="env-threshold">
                    <span id="env-threshold-val">${follower.threshold} dB</span>
                </div>
                <div class="control-row">
                    <label>Range:</label>
                    <input type="range" min="6" max="96" step="6" value="${follower.range}" id="env-range">
                    <span id="env-range-val">${follower.range} dB</span>
                </div>
            </div>
            <div class="output-section">
                <h4>Modulation Output</h4>
                <div class="output-row">
                    <label>Direct:</label>
                    <div class="meter-bar">
                        <div class="meter-fill" id="mod-direct"></div>
                    </div>
                    <span id="mod-direct-val">0.00</span>
                </div>
                <div class="output-row">
                    <label>Inverted:</label>
                    <div class="meter-bar">
                        <div class="meter-fill" id="mod-inverted"></div>
                    </div>
                    <span id="mod-inverted-val">1.00</span>
                </div>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .envelope-follower-panel {
            background: var(--panel-bg, #1a1a2e);
            border: 1px solid var(--border-color, #3a3a5e);
            border-radius: 8px;
            padding: 16px;
            width: 340px;
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
        .envelope-display {
            width: 100%;
            height: 100px;
            background: #0a0a1a;
            border-radius: 4px;
            margin-bottom: 12px;
        }
        .meter-row, .control-row, .output-row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .meter-row label, .control-row label, .output-row label {
            width: 70px;
            font-size: 12px;
        }
        .meter-bar {
            flex: 1;
            height: 8px;
            background: #0a0a1a;
            border-radius: 4px;
            overflow: hidden;
            margin: 0 8px;
        }
        .meter-fill {
            height: 100%;
            background: linear-gradient(to right, #4CAF50, #8BC34A, #FFEB3B, #FF9800, #F44336);
            width: 0%;
            transition: width 0.05s;
        }
        .control-row input[type="range"] {
            flex: 1;
            margin-right: 8px;
        }
        .control-row span, .output-row span, .meter-row span {
            width: 60px;
            text-align: right;
            font-size: 11px;
            font-family: monospace;
        }
        .output-section h4 {
            font-size: 12px;
            margin: 12px 0 8px;
            border-top: 1px solid #3a3a5e;
            padding-top: 8px;
        }
    `;
    
    if (!document.querySelector('#envelope-follower-styles')) {
        style.id = 'envelope-follower-styles';
        document.head.appendChild(style);
    }
    
    // Wire up controls
    const attackSlider = panel.querySelector('#env-attack');
    const releaseSlider = panel.querySelector('#env-release');
    const smoothingSlider = panel.querySelector('#env-smoothing');
    const thresholdSlider = panel.querySelector('#env-threshold');
    const rangeSlider = panel.querySelector('#env-range');
    
    attackSlider.addEventListener('input', (e) => {
        follower.attack = parseFloat(e.target.value);
        panel.querySelector('#env-attack-val').textContent = `${follower.attack.toFixed(3)}s`;
    });
    
    releaseSlider.addEventListener('input', (e) => {
        follower.release = parseFloat(e.target.value);
        panel.querySelector('#env-release-val').textContent = `${follower.release.toFixed(2)}s`;
    });
    
    smoothingSlider.addEventListener('input', (e) => {
        follower.smoothing = parseFloat(e.target.value);
        panel.querySelector('#env-smoothing-val').textContent = follower.smoothing.toFixed(2);
    });
    
    thresholdSlider.addEventListener('input', (e) => {
        follower.threshold = parseFloat(e.target.value);
        panel.querySelector('#env-threshold-val').textContent = `${follower.threshold} dB`;
    });
    
    rangeSlider.addEventListener('input', (e) => {
        follower.range = parseFloat(e.target.value);
        panel.querySelector('#env-range-val').textContent = `${follower.range} dB`;
    });
    
    // Close button
    panel.querySelector('.close-btn').addEventListener('click', () => {
        panel.remove();
    });
    
    // Animation loop for display
    const canvas = panel.querySelector('.envelope-display');
    const ctx = canvas.getContext('2d');
    let animationId;
    
    function updateDisplay() {
        const buffer = follower.getAnalysisBuffer();
        
        // Clear canvas
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw envelope waveform
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < buffer.length; i++) {
            const x = (i / buffer.length) * canvas.width;
            const y = canvas.height - (buffer[i] * canvas.height);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Update meters
        const normalized = follower.normalizedOutput;
        panel.querySelector('#env-level').style.width = `${normalized * 100}%`;
        panel.querySelector('#env-db').textContent = follower.lastValue > 0 
            ? `${(20 * Math.log10(follower.lastValue)).toFixed(1)} dB`
            : '-∞ dB';
        
        panel.querySelector('#mod-direct').style.width = `${normalized * 100}%`;
        panel.querySelector('#mod-direct-val').textContent = normalized.toFixed(2);
        
        const inverted = 1 - normalized;
        panel.querySelector('#mod-inverted').style.width = `${inverted * 100}%`;
        panel.querySelector('#mod-inverted-val').textContent = inverted.toFixed(2);
        
        animationId = requestAnimationFrame(updateDisplay);
    }
    
    updateDisplay();
    
    return panel;
}

export default EnvelopeFollower;