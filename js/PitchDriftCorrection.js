// js/PitchDriftCorrection.js - Correct Pitch Drift in Audio Recordings
// Analyzes audio for gradual pitch drift and applies correction

import { showNotification } from './utils.js';

/**
 * PitchDriftCorrector - Analyzes and corrects gradual pitch drift in audio
 * Uses autocorrelation for pitch detection and applies correction curves
 */
export class PitchDriftCorrector {
    constructor(options = {}) {
        this.sampleRate = options.sampleRate || 44100;
        this.windowSize = options.windowSize || 2048;
        this.hopSize = options.hopSize || 512;
        this.minFrequency = options.minFrequency || 60;  // Hz
        this.maxFrequency = options.maxFrequency || 2000; // Hz
        
        // Correction settings
        this.enabled = false;
        this.correctionStrength = options.correctionStrength ?? 1.0; // 0-1
        this.maxCorrection = options.maxCorrection ?? 50; // cents (half semitone)
        
        // Analysis results
        this.driftCurve = []; // Array of {time, pitchOffset, confidence}
        this.detectedDriftPPM = 0; // Parts per million drift rate
    }
    
    /**
     * Detect pitch using autocorrelation
     */
    detectPitch(audioData, hopIndex = 0) {
        const windowSize = this.windowSize;
        const startSample = hopIndex * this.hopSize;
        const endSample = Math.min(startSample + windowSize, audioData.length);
        
        if (endSample - startSample < windowSize / 2) {
            return { pitch: 0, confidence: 0 };
        }
        
        // Extract window
        const window = new Float32Array(windowSize);
        for (let i = 0; i < windowSize; i++) {
            const idx = startSample + i;
            window[i] = idx < audioData.length ? audioData[idx] : 0;
        }
        
        // Apply Hann window
        for (let i = 0; i < windowSize; i++) {
            window[i] *= 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)));
        }
        
        // Autocorrelation
        const minLag = Math.floor(this.sampleRate / this.maxFrequency);
        const maxLag = Math.floor(this.sampleRate / this.minFrequency);
        const correlations = new Float32Array(maxLag + 1);
        
        for (let lag = minLag; lag <= maxLag; lag++) {
            let sum = 0;
            for (let i = 0; i < windowSize - lag; i++) {
                sum += window[i] * window[i + lag];
            }
            correlations[lag] = sum;
        }
        
        // Find peak in correlations
        let maxCorr = 0;
        let peakLag = minLag;
        for (let lag = minLag + 1; lag < maxLag; lag++) {
            if (correlations[lag] > maxCorr) {
                maxCorr = correlations[lag];
                peakLag = lag;
            }
        }
        
        // Parabolic interpolation for better precision
        if (peakLag > minLag && peakLag < maxLag - 1) {
            const y0 = correlations[peakLag - 1];
            const y1 = correlations[peakLag];
            const y2 = correlations[peakLag + 1];
            const delta = (y0 - y2) / (2 * (y0 - 2 * y1 + y2));
            peakLag += delta;
        }
        
        // Calculate pitch
        const pitch = this.sampleRate / peakLag;
        
        // Calculate confidence based on correlation peak prominence
        const avgCorr = correlations.slice(minLag, maxLag).reduce((a, b) => a + b, 0) / (maxLag - minLag);
        const confidence = Math.min(1, maxCorr / (avgCorr * 10));
        
        return { pitch, confidence };
    }
    
    /**
     * Analyze audio for pitch drift over time
     * @param {Float32Array} audioData - Audio samples
     * @returns {Array} Drift curve data
     */
    analyze(audioData) {
        const numHops = Math.floor((audioData.length - this.windowSize) / this.hopSize);
        const driftCurve = [];
        
        for (let hop = 0; hop < numHops; hop++) {
            const { pitch, confidence } = this.detectPitch(audioData, hop);
            
            if (confidence > 0.3) {
                const time = (hop * this.hopSize) / this.sampleRate;
                driftCurve.push({ time, pitch, confidence });
            }
        }
        
        // Calculate drift relative to first stable detection
        if (driftCurve.length > 5) {
            // Find stable reference pitch (average of first 10 detections)
            const refPitch = driftCurve.slice(0, 10)
                .reduce((sum, d) => sum + d.pitch, 0) / Math.min(10, driftCurve.length);
            
            // Calculate pitch offset in cents
            for (const point of driftCurve) {
                if (point.pitch > 0 && refPitch > 0) {
                    point.pitchOffset = 1200 * Math.log2(point.pitch / refPitch);
                    point.cents = point.pitchOffset;
                }
            }
        }
        
        this.driftCurve = driftCurve;
        return driftCurve;
    }
    
    /**
     * Estimate overall drift rate
     * @returns {number} Drift rate in cents per minute
     */
    estimateDriftRate() {
        if (this.driftCurve.length < 10) return 0;
        
        // Use linear regression on pitch offset vs time
        const firstHalf = this.driftCurve.slice(0, Math.floor(this.driftCurve.length / 2));
        const lastHalf = this.driftCurve.slice(Math.floor(this.driftCurve.length / 2));
        
        const avgFirst = firstHalf.reduce((sum, d) => sum + (d.cents || 0), 0) / firstHalf.length;
        const avgLast = lastHalf.reduce((sum, d) => sum + (d.cents || 0), 0) / lastHalf.length;
        
        const firstTime = firstHalf[0].time;
        const lastTime = lastHalf[lastHalf.length - 1].time;
        
        if (lastTime <= firstTime) return 0;
        
        const driftRate = ((avgLast - avgFirst) / (lastTime - firstTime)) * 60; // cents per minute
        
        this.detectedDriftPPM = driftRate;
        return driftRate;
    }
    
    /**
     * Apply correction to audio
     * @param {Float32Array} audioData - Input audio
     * @param {Object} options - Correction options
     * @returns {Float32Array} Corrected audio
     */
    applyCorrection(audioData, options = {}) {
        if (!this.enabled || this.driftCurve.length < 5) {
            return audioData; // Return unchanged
        }
        
        const { strength = this.correctionStrength, maxCents = this.maxCorrection } = options;
        
        // Build correction curve
        const numSamples = audioData.length;
        const correctionCurve = new Float32Array(numSamples);
        
        // Interpolate correction from drift curve
        for (let i = 0; i < numSamples; i++) {
            const time = i / this.sampleRate;
            const cents = this.interpolateDrift(time) * strength;
            
            // Clamp correction
            const clampedCents = Math.max(-maxCents, Math.min(maxCents, cents));
            correctionCurve[i] = clampedCents;
        }
        
        // Apply pitch correction using resampling
        const output = new Float32Array(numSamples);
        const processingWindow = 1024;
        
        for (let i = 0; i < numSamples; i += processingWindow) {
            const end = Math.min(i + processingWindow, numSamples);
            const windowSize = end - i;
            
            // Get correction for this window
            const windowCorrection = correctionCurve.slice(i, end);
            const avgCorrection = windowCorrection.reduce((a, b) => a + b, 0) / windowSize;
            
            // Calculate pitch ratio (cents to ratio)
            const pitchRatio = Math.pow(2, avgCorrection / 1200);
            
            // Simple pitch shift via resampling
            const inputIndex = i / pitchRatio;
            for (let j = 0; j < windowSize; j++) {
                const srcIdx = (inputIndex + j / pitchRatio);
                const srcIdx_floor = Math.floor(srcIdx);
                const frac = srcIdx - srcIdx_floor;
                
                if (srcIdx_floor >= 0 && srcIdx_floor < audioData.length - 1) {
                    // Linear interpolation
                    output[i + j] = audioData[srcIdx_floor] * (1 - frac) + 
                                   audioData[srcIdx_floor + 1] * frac;
                } else if (srcIdx_floor < audioData.length) {
                    output[i + j] = audioData[srcIdx_floor] || 0;
                }
            }
        }
        
        return output;
    }
    
    /**
     * Interpolate drift value at given time
     */
    interpolateDrift(time) {
        if (this.driftCurve.length === 0) return 0;
        
        // Find surrounding points
        let before = this.driftCurve[0];
        let after = this.driftCurve[this.driftCurve.length - 1];
        
        for (const point of this.driftCurve) {
            if (point.time <= time) {
                before = point;
            }
            if (point.time > time && !after) {
                after = point;
                break;
            }
        }
        
        if (!after) after = before;
        if (before === after) return before.cents || 0;
        
        // Linear interpolation
        const t = (time - before.time) / (after.time - before.time);
        const beforeCents = before.cents || 0;
        const afterCents = after.cents || 0;
        
        return beforeCents + (afterCents - beforeCents) * t;
    }
    
    /**
     * Set enabled state
     */
    setEnabled(enabled) {
        this.enabled = !!enabled;
    }
    
    /**
     * Set correction strength
     */
    setStrength(strength) {
        this.correctionStrength = Math.max(0, Math.min(1, strength));
    }
    
    /**
     * Reset state
     */
    reset() {
        this.driftCurve = [];
        this.detectedDriftPPM = 0;
    }
}

/**
 * Pitch Drift Correction Panel UI
 */
export function openPitchDriftCorrectionPanel(track = null) {
    const panel = document.createElement('div');
    panel.className = 'pitch-drift-correction-panel';
    panel.innerHTML = `
        <div class="pdcp-header">
            <h3>Pitch Drift Correction</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="pdcp-content">
            <div class="pdcp-info">
                <p>Analyze and correct gradual pitch drift in audio recordings.</p>
            </div>
            <div class="pdcp-status">
                <span class="label">Status:</span>
                <span id="pdcp-status">Ready</span>
            </div>
            <div class="pdcp-results" style="display:none;">
                <div class="pdcp-result-row">
                    <span class="label">Drift Rate:</span>
                    <span id="pdcp-drift-rate">0 cents/min</span>
                </div>
                <div class="pdcp-result-row">
                    <span class="label">Direction:</span>
                    <span id="pdcp-direction">Stable</span>
                </div>
                <div class="pdcp-result-row">
                    <span class="label">Max Offset:</span>
                    <span id="pdcp-max-offset">0 cents</span>
                </div>
            </div>
            <div class="pdcp-display">
                <canvas id="pdcp-viz" width="300" height="100"></canvas>
            </div>
            <div class="pdcp-controls">
                <div class="pdcp-row">
                    <label>Strength:</label>
                    <input type="range" id="pdcp-strength" min="0" max="100" value="100">
                    <span id="pdcp-strength-val">100%</span>
                </div>
                <div class="pdcp-row">
                    <label>Max Corr:</label>
                    <input type="range" id="pdcp-max" min="5" max="50" value="50">
                    <span id="pdcp-max-val">50 cents</span>
                </div>
            </div>
            <div class="pdcp-actions">
                <button id="pdcp-analyze" class="action-btn">Analyze</button>
                <button id="pdcp-correct" class="action-btn primary" disabled>Apply Correction</button>
                <button id="pdcp-reset" class="action-btn">Reset</button>
            </div>
        </div>
    `;
    
    // Styles
    const style = document.createElement('style');
    style.textContent = `
        .pitch-drift-correction-panel {
            background: #1e1e2e;
            border: 1px solid #3a3a5e;
            border-radius: 8px;
            padding: 16px;
            width: 340px;
            font-family: system-ui, sans-serif;
            color: #e0e0e0;
        }
        .pdcp-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .pdcp-header h3 { margin: 0; font-size: 14px; }
        .close-btn {
            background: none;
            border: none;
            color: inherit;
            font-size: 18px;
            cursor: pointer;
        }
        .pdcp-info {
            font-size: 11px;
            color: #888;
            margin-bottom: 12px;
        }
        .pdcp-status {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            font-size: 12px;
        }
        .pdcp-status .label { color: #888; }
        .pdcp-results {
            background: #2a2a3e;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 12px;
        }
        .pdcp-result-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 4px;
        }
        .pdcp-result-row .label { color: #888; }
        .pdcp-display {
            margin-bottom: 12px;
        }
        .pdcp-display canvas {
            width: 100%;
            height: 100px;
            background: #0a0a1a;
            border-radius: 4px;
        }
        .pdcp-row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
            font-size: 12px;
        }
        .pdcp-row label { width: 60px; color: #aaa; }
        .pdcp-row input[type="range"] { flex: 1; margin: 0 8px; }
        .pdcp-row span { width: 55px; text-align: right; font-size: 11px; font-family: monospace; }
        .pdcp-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        .action-btn {
            flex: 1;
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            background: #3a3a5e;
            color: #e0e0e0;
        }
        .action-btn:hover { background: #4a4a6e; }
        .action-btn.primary { background: #4a7c59; }
        .action-btn.primary:hover { background: #5a8c69; }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    `;
    
    if (!document.querySelector('#pitch-drift-correction-styles')) {
        style.id = 'pitch-drift-correction-styles';
        document.head.appendChild(style);
    }
    
    const corrector = new PitchDriftCorrector();
    let analyzed = false;
    let currentTrack = track;
    
    // Canvas setup
    const canvas = panel.querySelector('#pdcp-viz');
    const ctx = canvas.getContext('2d');
    
    function drawDriftCurve() {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw center line
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        if (corrector.driftCurve.length === 0) {
            ctx.fillStyle = '#555';
            ctx.font = '11px monospace';
            ctx.fillText('Click Analyze to detect pitch drift', 20, canvas.height / 2 + 4);
            return;
        }
        
        // Find min/max for scaling
        let minCents = Infinity, maxCents = -Infinity;
        for (const point of corrector.driftCurve) {
            const cents = point.cents || 0;
            minCents = Math.min(minCents, cents);
            maxCents = Math.max(maxCents, cents);
        }
        
        const range = Math.max(10, maxCents - minCents);
        const midY = canvas.height / 2;
        
        // Draw curve
        ctx.strokeStyle = '#6a9fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        
        for (let i = 0; i < corrector.driftCurve.length; i++) {
            const point = corrector.driftCurve[i];
            const x = (i / corrector.driftCurve.length) * canvas.width;
            const y = midY - ((point.cents || 0) / range) * (canvas.height / 2 - 10);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        ctx.stroke();
        
        // Draw points with low confidence faded
        for (let i = 0; i < corrector.driftCurve.length; i++) {
            const point = corrector.driftCurve[i];
            const x = (i / corrector.driftCurve.length) * canvas.width;
            const y = midY - ((point.cents || 0) / range) * (canvas.height / 2 - 10);
            const alpha = point.confidence || 1;
            
            ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Labels
        ctx.fillStyle = '#888';
        ctx.font = '9px monospace';
        ctx.fillText(`+${maxCents.toFixed(1)}c`, 2, 10);
        ctx.fillText(`${minCents.toFixed(1)}c`, 2, canvas.height - 5);
    }
    
    // Event handlers
    panel.querySelector('#pdcp-strength').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        corrector.setStrength(val / 100);
        panel.querySelector('#pdcp-strength-val').textContent = `${val}%`;
    });
    
    panel.querySelector('#pdcp-max').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        corrector.maxCorrection = val;
        panel.querySelector('#pdcp-max-val').textContent = `${val} cents`;
    });
    
    panel.querySelector('#pdcp-analyze').addEventListener('click', async () => {
        const status = panel.querySelector('#pdcp-status');
        status.textContent = 'Analyzing...';
        
        try {
            // Get audio from current track or use demo data
            let audioData = null;
            
            if (currentTrack && currentTrack.getAudioBuffer) {
                const buffer = await currentTrack.getAudioBuffer();
                if (buffer) {
                    audioData = buffer.getChannelData(0);
                }
            }
            
            if (!audioData) {
                // Use synthetic test data for demo
                status.textContent = 'No audio data - using demo';
                const duration = 10; // seconds
                const numSamples = duration * corrector.sampleRate;
                audioData = new Float32Array(numSamples);
                
                // Generate test signal with slight drift
                const baseFreq = 440;
                for (let i = 0; i < numSamples; i++) {
                    const time = i / corrector.sampleRate;
                    const drift = 1 + (time / 60) * 0.002; // 0.2% drift per minute
                    audioData[i] = Math.sin(2 * Math.PI * baseFreq * drift * time) * 0.5;
                    // Add harmonics
                    audioData[i] += Math.sin(2 * Math.PI * baseFreq * 2 * drift * time) * 0.2;
                }
            }
            
            corrector.analyze(audioData);
            const driftRate = corrector.estimateDriftRate();
            
            // Show results
            panel.querySelector('.pdcp-results').style.display = 'block';
            panel.querySelector('#pdcp-drift-rate').textContent = `${driftRate.toFixed(2)} cents/min`;
            
            const direction = driftRate > 1 ? 'Rising' : driftRate < -1 ? 'Falling' : 'Stable';
            panel.querySelector('#pdcp-direction').textContent = direction;
            
            const maxOffset = Math.max(...corrector.driftCurve.map(d => Math.abs(d.cents || 0)));
            panel.querySelector('#pdcp-max-offset').textContent = `${maxOffset.toFixed(1)} cents`;
            
            panel.querySelector('#pdcp-correct').disabled = false;
            analyzed = true;
            status.textContent = 'Analysis complete';
            
            drawDriftCurve();
            
        } catch (err) {
            console.error('Pitch drift analysis error:', err);
            status.textContent = 'Analysis failed';
        }
    });
    
    panel.querySelector('#pdcp-correct').addEventListener('click', async () => {
        if (!analyzed) return;
        
        const status = panel.querySelector('#pdcp-status');
        status.textContent = 'Applying correction...';
        
        try {
            let audioData = null;
            
            if (currentTrack && currentTrack.getAudioBuffer) {
                const buffer = await currentTrack.getAudioBuffer();
                if (buffer) {
                    audioData = buffer.getChannelData(0);
                }
            }
            
            if (audioData) {
                const corrected = corrector.applyCorrection(audioData);
                
                if (currentTrack && currentTrack.setAudioBuffer) {
                    await currentTrack.setAudioBuffer(corrected);
                }
                
                corrector.reset();
                panel.querySelector('.pdcp-results').style.display = 'none';
                panel.querySelector('#pdcp-correct').disabled = true;
                analyzed = false;
                status.textContent = 'Correction applied';
                
                if (typeof showNotification === 'function') {
                    showNotification('Pitch drift correction applied', 2000);
                }
            } else {
                status.textContent = 'No audio to correct';
            }
            
        } catch (err) {
            console.error('Pitch drift correction error:', err);
            status.textContent = 'Correction failed';
        }
    });
    
    panel.querySelector('#pdcp-reset').addEventListener('click', () => {
        corrector.reset();
        analyzed = false;
        panel.querySelector('.pdcp-results').style.display = 'none';
        panel.querySelector('#pdcp-correct').disabled = true;
        panel.querySelector('#pdcp-status').textContent = 'Ready';
        drawDriftCurve();
    });
    
    panel.querySelector('.close-btn').addEventListener('click', () => {
        panel.remove();
        corrector.reset();
    });
    
    // Initial draw
    drawDriftCurve();
    
    return { panel, corrector };
}

// Default export
export default {
    PitchDriftCorrector,
    openPitchDriftCorrectionPanel
};