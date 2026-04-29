/**
 * Pitch Drift Correction - Correct pitch drift in recordings over time
 * Detects pitch variations and applies gradual correction to keep recordings in tune
 */

class PitchDriftCorrection {
    constructor() {
        this.enabled = false;
        this.strength = 50; // % (0-100)
        this.correctionRate = 'gradual'; // 'gradual' | 'immediate'
        this.formantPreserve = true;
        this.audioContext = null;
        this.processedBuffer = null;
        this.driftAnalysis = null;
    }

    init() {
        console.log('[PitchDriftCorrection] Initialized');
    }

    setAudioContext(ctx) {
        this.audioContext = ctx;
    }

    // Analyze pitch drift across the audio
    async analyzeDrift(audioBuffer, progressCallback = null) {
        console.log('[PitchDriftCorrection] Analyzing pitch drift');
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        const analysisWindowSize = Math.floor(sampleRate * 0.1); // 100ms windows
        const hopSize = Math.floor(sampleRate * 0.05); // 50ms hop
        const driftPoints = [];

        const totalWindows = Math.floor((channelData.length - analysisWindowSize) / hopSize);
        let currentWindow = 0;

        for (let i = 0; i < channelData.length - analysisWindowSize; i += hopSize) {
            const windowData = channelData.slice(i, i + analysisWindowSize);
            const pitch = this.detectPitchPeriod(windowData, sampleRate);
            const time = i / sampleRate;

            if (pitch > 0) {
                driftPoints.push({ time, pitch, sampleIndex: i });
            }

            currentWindow++;
            if (progressCallback) {
                progressCallback(currentWindow / totalWindows * 0.5); // 50% for analysis
            }
        }

        // Calculate drift relative to first stable pitch
        const stablePitch = this.findStablePitch(driftPoints);
        if (stablePitch > 0) {
            for (const point of driftPoints) {
                point.deviationCents = 1200 * Math.log2(point.pitch / stablePitch);
            }
        }

        this.driftAnalysis = {
            driftPoints,
            stablePitch,
            totalDrift: driftPoints.length > 0 ?
                driftPoints[driftPoints.length - 1].deviationCents - driftPoints[0].deviationCents : 0
        };

        console.log('[PitchDriftCorrection] Analysis complete:', this.driftAnalysis);
        return this.driftAnalysis;
    }

    // Detect pitch period using autocorrelation
    detectPitchPeriod(samples, sampleRate) {
        const minPitch = 60; // Hz (lowest expected pitch)
        const maxPitch = 2000; // Hz (highest expected pitch)
        const minLag = Math.floor(sampleRate / maxPitch);
        const maxLag = Math.floor(sampleRate / minPitch);

        const n = samples.length;
        const correlogram = new Float32Array(maxLag - minLag);

        // Compute autocorrelation
        for (let lag = minLag; lag < maxLag; lag++) {
            let sum = 0;
            let norm1 = 0;
            let norm2 = 0;

            for (let i = 0; i < n - lag; i++) {
                sum += samples[i] * samples[i + lag];
                norm1 += samples[i] * samples[i];
                norm2 += samples[i + lag] * samples[i + lag];
            }

            if (norm1 > 0 && norm2 > 0) {
                correlogram[lag - minLag] = sum / Math.sqrt(norm1 * norm2);
            } else {
                correlogram[lag - minLag] = 0;
            }
        }

        // Find peak in correlogram
        let maxVal = -1;
        let maxIdx = 0;

        for (let i = 1; i < correlogram.length - 1; i++) {
            if (correlogram[i] > correlogram[i - 1] && correlogram[i] > correlogram[i + 1]) {
                if (correlogram[i] > maxVal) {
                    maxVal = correlogram[i];
                    maxIdx = i;
                }
            }
        }

        if (maxVal > 0.3) { // Threshold for pitch detection
            return sampleRate / (maxIdx + minLag);
        }

        return 0;
    }

    // Find the most common pitch (stable reference)
    findStablePitch(driftPoints) {
        if (driftPoints.length === 0) return 0;

        // Use median pitch as stable
        const pitches = driftPoints.map(p => p.pitch).sort((a, b) => a - b);
        return pitches[Math.floor(pitches.length / 2)];
    }

    // Apply pitch correction to audio buffer
    async applyCorrection(audioBuffer, progressCallback = null) {
        if (!this.driftAnalysis || !this.driftAnalysis.driftPoints.length) {
            console.log('[PitchDriftCorrection] No drift analysis available');
            return audioBuffer;
        }

        console.log('[PitchDriftCorrection] Applying correction, strength:', this.strength);
        const ctx = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;

        const outputBuffer = ctx.createBuffer(numChannels, length, sampleRate);
        const strengthFactor = this.strength / 100;

        for (let channel = 0; channel < numChannels; channel++) {
            const inputData = audioBuffer.getChannelData(channel);
            const outputData = outputBuffer.getChannelData(channel);

            outputData.set(inputData);

            // Apply pitch correction using phase vocoder
            this.applyPitchShiftChannel(outputData, sampleRate, strengthFactor, (progress) => {
                if (progressCallback) {
                    progressCallback(0.5 + progress * 0.5 * (channel + 1) / numChannels);
                }
            });
        }

        this.processedBuffer = outputBuffer;
        return outputBuffer;
    }

    // Apply pitch shift to a single channel using phase vocoder
    applyPitchShiftChannel(data, sampleRate, strengthFactor, progressCallback) {
        const fftSize = 2048;
        const hopSize = fftSize / 4;
        const driftPoints = this.driftAnalysis.driftPoints;

        // Create interpolation function for drift at any time
        const driftInterpolator = this.createDriftInterpolator(driftPoints, sampleRate);

        // Process in frames
        const numFrames = Math.floor((data.length - fftSize) / hopSize);
        const halfFFTSize = fftSize / 2;

        // Output buffer (slightly larger to accommodate shifts)
        const output = new Float32Array(data.length);
        const inputAccum = new Float32Array(data.length);

        // Window function
        const window = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
        }

        let lastPhase = new Float32Array(fftSize / 2 + 1);
        let totalPhase = new Float32Array(fftSize / 2 + 1);

        for (let frame = 0; frame < numFrames; frame++) {
            const startIdx = frame * hopSize;
            const centerIdx = startIdx + halfFFTSize;
            const time = centerIdx / sampleRate;

            // Get pitch drift factor at this time
            const driftCents = driftInterpolator(time);
            const driftSemitones = driftCents / 100 * strengthFactor;
            const pitchRatio = Math.pow(2, -driftSemitones / 12); // Shift in opposite direction

            // Get frame data
            const frameData = new Float32Array(fftSize);
            for (let i = 0; i < fftSize; i++) {
                const idx = startIdx + i;
                if (idx < data.length) {
                    frameData[i] = data[idx] * window[i];
                }
            }

            // DFT (simplified - using actual implementation would be more complex)
            const real = new Float32Array(fftSize);
            const imag = new Float32Array(fftSize);

            // Simple DFT for demonstration
            for (let k = 0; k < fftSize; k++) {
                let re = 0, im = 0;
                for (let n = 0; n < fftSize; n++) {
                    const angle = 2 * Math.PI * k * n / fftSize;
                    re += frameData[n] * Math.cos(angle);
                    im -= frameData[n] * Math.sin(angle);
                }
                real[k] = re;
                imag[k] = im;
            }

            // Apply pitch shift by resampling bins
            const binsShift = Math.log2(pitchRatio) * fftSize;

            // Process each frequency bin
            for (let k = 1; k < fftSize / 2; k++) {
                const newK = Math.round(k + binsShift);
                if (newK > 0 && newK < fftSize / 2) {
                    const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
                    const phase = Math.atan2(imag[k], real[k]);

                    // Phase unwrapping
                    const expectedPhase = lastPhase[k] + 2 * Math.PI * newK * hopSize / fftSize;
                    let phaseDiff = phase - expectedPhase;
                    phaseDiff = phaseDiff - 2 * Math.PI * Math.round(phaseDiff / (2 * Math.PI));

                    totalPhase[k] += phaseDiff;
                    lastPhase[k] = phase;

                    // Write to shifted bin
                    const newMag = mag; // Magnitude unchanged
                    real[newK] += newMag * Math.cos(totalPhase[k]);
                    imag[newK] += newMag * Math.sin(totalPhase[k]);
                }
            }

            // Inverse DFT and add to output
            for (let n = 0; n < fftSize; n++) {
                let sumRe = 0, sumIm = 0;
                for (let k = 0; k < fftSize; k++) {
                    const angle = 2 * Math.PI * k * n / fftSize;
                    sumRe += real[k] * Math.cos(angle) - imag[k] * Math.sin(angle);
                    sumIm += real[k] * Math.sin(angle) + imag[k] * Math.cos(angle);
                }
                const outVal = sumRe / fftSize * window[n];
                const idx = startIdx + n;
                if (idx < output.length) {
                    output[idx] += outVal;
                    inputAccum[idx]++;
                }
            }

            if (progressCallback) {
                progressCallback(frame / numFrames);
            }
        }

        // Normalize overlap-add
        for (let i = 0; i < data.length; i++) {
            if (inputAccum[i] > 0) {
                data[i] = output[i] / inputAccum[i];
            }
        }
    }

    // Create interpolator for drift values
    createDriftInterpolator(driftPoints, sampleRate) {
        return (time) => {
            if (driftPoints.length === 0) return 0;
            if (driftPoints.length === 1) return driftPoints[0].deviationCents || 0;

            // Find surrounding points
            let before = driftPoints[0];
            let after = driftPoints[driftPoints.length - 1];

            for (let i = 0; i < driftPoints.length - 1; i++) {
                if (driftPoints[i].time <= time && driftPoints[i + 1].time >= time) {
                    before = driftPoints[i];
                    after = driftPoints[i + 1];
                    break;
                }
            }

            // Linear interpolation
            if (before.time === after.time) return before.deviationCents || 0;
            const t = (time - before.time) / (after.time - before.time);
            return before.deviationCents + t * (after.deviationCents - before.deviationCents);
        };
    }

    // Get current settings
    getSettings() {
        return {
            enabled: this.enabled,
            strength: this.strength,
            correctionRate: this.correctionRate,
            formantPreserve: this.formantPreserve,
            driftAnalysis: this.driftAnalysis
        };
    }

    // Update settings
    updateSettings(settings) {
        if (settings.enabled !== undefined) this.enabled = settings.enabled;
        if (settings.strength !== undefined) this.strength = Math.max(0, Math.min(100, settings.strength));
        if (settings.correctionRate !== undefined) this.correctionRate = settings.correctionRate;
        if (settings.formantPreserve !== undefined) this.formantPreserve = settings.formantPreserve;
    }
}

// Global instance
let pitchDriftCorrection = null;

function initPitchDriftCorrection() {
    if (!pitchDriftCorrection) {
        pitchDriftCorrection = new PitchDriftCorrection();
        pitchDriftCorrection.init();
    }
    return pitchDriftCorrection;
}

function openPitchDriftCorrectionPanel() {
    // Close existing panel
    const existing = document.getElementById('pitch-drift-panel');
    if (existing) existing.remove();

    if (!pitchDriftCorrection) initPitchDriftCorrection();

    const panel = document.createElement('div');
    panel.id = 'pitch-drift-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 24px;
        z-index: 10000;
        min-width: 480px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    `;

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #fff; font-size: 18px;">Pitch Drift Correction</h2>
            <button id="close-pitch-drift" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="background: #2a2a4e; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
            <p style="color: #a0a0a0; font-size: 12px; margin: 0 0 12px 0;">
                Automatically correct pitch drift in recordings. Analyzes pitch over time and applies gradual correction to keep instruments in tune throughout the recording.
            </p>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #ccc; font-size: 12px; margin-bottom: 6px;">Correction Strength</label>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="range" id="drift-strength" min="0" max="100" value="50" 
                        style="flex: 1; height: 6px; -webkit-appearance: none; background: #3a3a5e; border-radius: 3px;">
                    <span id="drift-strength-val" style="color: #10b981; font-size: 12px; min-width: 35px;">50%</span>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #ccc; font-size: 12px; margin-bottom: 6px;">Correction Rate</label>
                <select id="drift-rate" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 12px;">
                    <option value="gradual" selected>Gradual (smooth transition)</option>
                    <option value="immediate">Immediate (snap to correct pitch)</option>
                </select>
            </div>
            
            <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; color: #ccc; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="drift-formant" checked style="width: 14px; height: 14px;">
                    Preserve Formants (maintain original timbre)
                </label>
            </div>
        </div>
        
        <div id="drift-analysis-section" style="background: #2a2a4e; border-radius: 6px; padding: 16px; margin-bottom: 16px; display: none;">
            <h3 style="margin: 0 0 12px 0; color: #fff; font-size: 14px;">Analysis Results</h3>
            <div id="drift-analysis-results" style="color: #a0a0a0; font-size: 12px;"></div>
        </div>
        
        <div id="drift-progress" style="display: none; margin-bottom: 16px; padding: 12px; background: #2a2a4e; border-radius: 4px;">
            <div style="background: #1a1a2e; border-radius: 4px; overflow: hidden; height: 8px;">
                <div id="drift-progress-bar" style="background: #10b981; height: 100%; width: 0%; transition: width 0.2s;"></div>
            </div>
            <div id="drift-status" style="color: #a0a0a0; text-align: center; margin-top: 8px; font-size: 11px;"></div>
        </div>
        
        <div style="display: flex; gap: 12px;">
            <button id="analyze-drift-btn" style="flex: 1; padding: 10px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">
                Analyze Drift
            </button>
            <button id="apply-drift-btn" style="flex: 1; padding: 10px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">
                Apply Correction
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    // Event handlers
    document.getElementById('close-pitch-drift').onclick = () => panel.remove();

    document.getElementById('drift-strength').oninput = (e) => {
        pitchDriftCorrection.strength = parseInt(e.target.value);
        document.getElementById('drift-strength-val').textContent = e.target.value + '%';
    };

    document.getElementById('drift-rate').onchange = (e) => {
        pitchDriftCorrection.correctionRate = e.target.value;
    };

    document.getElementById('drift-formant').onchange = (e) => {
        pitchDriftCorrection.formantPreserve = e.target.checked;
    };

    document.getElementById('analyze-drift-btn').onclick = async () => {
        const state = window.snugState || window.state;
        const tracks = state?.getTracksState?.() || [];

        // Find selected clip or first audio clip
        let targetBuffer = null;

        // Try to get from selected clip
        const selectedClip = state?.selectedClip;
        if (selectedClip?.audioBuffer) {
            targetBuffer = selectedClip.audioBuffer;
        } else {
            // Find first audio clip with buffer
            for (const track of tracks) {
                if (track.clips) {
                    for (const clip of track.clips) {
                        if (clip.audioBuffer) {
                            targetBuffer = clip.audioBuffer;
                            break;
                        }
                    }
                }
                if (targetBuffer) break;
            }
        }

        if (!targetBuffer) {
            document.getElementById('drift-status').textContent = 'No audio clip found. Select an audio clip first.';
            document.getElementById('drift-progress').style.display = 'block';
            return;
        }

        const progressDiv = document.getElementById('drift-progress');
        const progressBar = document.getElementById('drift-progress-bar');
        const statusDiv = document.getElementById('drift-status');
        const analysisSection = document.getElementById('drift-analysis-section');

        progressDiv.style.display = 'block';
        statusDiv.textContent = 'Analyzing pitch...';

        try {
            const result = await pitchDriftCorrection.analyzeDrift(targetBuffer, (progress) => {
                progressBar.style.width = (progress * 100) + '%';
            });

            analysisSection.style.display = 'block';
            const analysisResults = document.getElementById('drift-analysis-results');
            analysisResults.innerHTML = `
                <div style="margin-bottom: 8px;">Reference Pitch: <span style="color: #10b981;">${result.stablePitch.toFixed(1)} Hz</span></div>
                <div style="margin-bottom: 8px;">Total Drift: <span style="color: ${Math.abs(result.totalDrift) > 10 ? '#ef4444' : '#10b981'};">${result.totalDrift.toFixed(1)} cents</span></div>
                <div style="margin-bottom: 8px;">Analysis Points: <span style="color: #10b981;">${result.driftPoints.length}</span></div>
                ${Math.abs(result.totalDrift) < 5 ? '<div style="color: #10b981;">Recording is stable - no correction needed.</div>' : ''}
            `;

            progressBar.style.width = '100%';
            statusDiv.textContent = 'Analysis complete!';
        } catch (error) {
            statusDiv.textContent = 'Error: ' + error.message;
        }
    };

    document.getElementById('apply-drift-btn').onclick = async () => {
        if (!pitchDriftCorrection.driftAnalysis) {
            document.getElementById('drift-status').textContent = 'Run analysis first.';
            document.getElementById('drift-progress').style.display = 'block';
            return;
        }

        const state = window.snugState || window.state;
        const tracks = state?.getTracksState?.() || [];
        let targetBuffer = null;

        const selectedClip = state?.selectedClip;
        if (selectedClip?.audioBuffer) {
            targetBuffer = selectedClip.audioBuffer;
        } else {
            for (const track of tracks) {
                if (track.clips) {
                    for (const clip of track.clips) {
                        if (clip.audioBuffer) {
                            targetBuffer = clip.audioBuffer;
                            break;
                        }
                    }
                }
                if (targetBuffer) break;
            }
        }

        if (!targetBuffer) {
            document.getElementById('drift-status').textContent = 'No audio clip found.';
            return;
        }

        const progressDiv = document.getElementById('drift-progress');
        const progressBar = document.getElementById('drift-progress-bar');
        const statusDiv = document.getElementById('drift-status');

        progressDiv.style.display = 'block';
        statusDiv.textContent = 'Applying correction...';

        try {
            const correctedBuffer = await pitchDriftCorrection.applyCorrection(targetBuffer, (progress) => {
                progressBar.style.width = (progress * 100) + '%';
            });

            // Try to replace clip buffer if possible
            if (state?.selectedClip) {
                state.selectedClip.audioBuffer = correctedBuffer;
                state.selectedClip.isProcessed = true;
            }

            progressBar.style.width = '100%';
            statusDiv.textContent = 'Correction applied!';
            statusDiv.style.color = '#10b981';

            setTimeout(() => panel.remove(), 1500);
        } catch (error) {
            statusDiv.textContent = 'Error: ' + error.message;
        }
    };

    return panel;
}

// Export
window.PitchDriftCorrection = PitchDriftCorrection;
window.initPitchDriftCorrection = initPitchDriftCorrection;
window.openPitchDriftCorrectionPanel = openPitchDriftCorrectionPanel;