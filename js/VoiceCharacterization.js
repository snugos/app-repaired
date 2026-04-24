// js/VoiceCharacterization.js - Vocal Character Analysis and Enhancement
// Provides vocal character analysis, formant detection, and enhancement tools

/**
 * VoiceCharacteristics - Analysis of vocal characteristics
 */
class VoiceCharacteristics {
    constructor() {
        // Fundamental frequency
        this.f0 = 0;
        this.f0Confidence = 0;
        this.f0Stability = 0;
        this.f0Range = { min: 0, max: 0 };
        this.vibratoRate = 0;
        this.vibratoDepth = 0;
        
        // Formants
        this.formants = [
            { frequency: 0, bandwidth: 0, amplitude: 0 },
            { frequency: 0, bandwidth: 0, amplitude: 0 },
            { frequency: 0, bandwidth: 0, amplitude: 0 },
            { frequency: 0, bandwidth: 0, amplitude: 0 }
        ];
        
        // Voice type classification
        this.voiceType = 'unknown';
        this.gender = 'unknown';
        this.register = 'unknown';
        
        // Breathiness and tension
        this.breathiness = 0;
        this.tension = 0;
        this.sonority = 0;
        this.nasality = 0;
        
        // Dynamics
        this.dynamicRange = 0;
        this.averageLevel = 0;
        this.crestFactor = 0;
        
        // Articulation
        this.articulation = 0;
        this.clarity = 0;
        this.sibilanceLevel = 0;
        
        // Harmonic content
        this.h2h1Ratio = 0;  // Harmonic to fundamental ratio
        this.harmonicRichness = 0;
        this.inharmonicity = 0;
        
        // Timing
        this.vibratoExtent = 0;
        this.jitter = 0;     // Frequency perturbation
        this.shimmer = 0;    // Amplitude perturbation
    }
}

/**
 * FormantAnalyzer - Analyzes formant frequencies
 */
class FormantAnalyzer {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 8192;
        this.sampleRate = audioContext.sampleRate;
    }

    /**
     * Analyze formants from audio buffer
     */
    analyze(audioBuffer, startTime = 0, duration = 0.5) {
        const channelData = audioBuffer.getChannelData(0);
        const startSample = Math.floor(startTime * this.sampleRate);
        const numSamples = Math.floor(duration * this.sampleRate);
        
        // Extract segment
        const segment = channelData.slice(startSample, startSample + numSamples);
        
        // Compute LPC coefficients for formant analysis
        const lpcOrder = 16;
        const lpcCoeffs = this.computeLPC(segment, lpcOrder);
        
        // Find roots of LPC polynomial to get formants
        const formants = this.findFormants(lpcCoeffs);
        
        return formants.slice(0, 4);  // Return first 4 formants
    }

    /**
     * Compute Linear Predictive Coding coefficients
     */
    computeLPC(signal, order) {
        const r = new Float32Array(order + 1);
        const a = new Float32Array(order + 1);
        const coeffs = new Float32Array(order);
        
        // Compute autocorrelation
        for (let i = 0; i <= order; i++) {
            for (let j = 0; j < signal.length - i; j++) {
                r[i] += signal[j] * signal[j + i];
            }
        }
        
        // Levinson-Durbin algorithm
        let error = r[0];
        
        for (let i = 1; i <= order; i++) {
            let reflection = r[i];
            for (let j = 1; j < i; j++) {
                reflection -= a[j] * r[i - j];
            }
            reflection /= error;
            
            a[i] = reflection;
            
            for (let j = 1; j < i; j++) {
                a[j] -= reflection * a[i - j];
            }
            
            error *= (1 - reflection * reflection);
        }
        
        for (let i = 0; i < order; i++) {
            coeffs[i] = -a[i + 1];
        }
        
        return coeffs;
    }

    /**
     * Find formant frequencies from LPC coefficients
     */
    findFormants(lpcCoeffs) {
        const formants = [];
        const roots = this.findPolynomialRoots([1, ...lpcCoeffs.map(c => -c)]);
        
        for (const root of roots) {
            if (root.imag >= 0) continue;  // Only positive imaginary parts
            
            const freq = Math.abs(root.angle) * this.sampleRate / (2 * Math.PI);
            const bandwidth = -Math.log(root.magnitude * root.magnitude) * this.sampleRate / (2 * Math.PI);
            
            if (freq > 50 && freq < 5000 && bandwidth < 500) {
                formants.push({
                    frequency: freq,
                    bandwidth: Math.abs(bandwidth),
                    amplitude: 1 / Math.sqrt(1 + Math.pow(bandwidth / 50, 2))
                });
            }
        }
        
        return formants.sort((a, b) => a.frequency - b.frequency);
    }

    /**
     * Find roots of polynomial using Durand-Kerner method
     */
    findPolynomialRoots(coeffs) {
        const n = coeffs.length - 1;
        const roots = [];
        
        // Initial guesses
        for (let i = 0; i < n; i++) {
            const angle = (2 * Math.PI * i + Math.PI / 4) / n;
            roots.push({
                real: Math.cos(angle),
                imag: Math.sin(angle)
            });
        }
        
        // Iterate
        for (let iter = 0; iter < 50; iter++) {
            for (let i = 0; i < n; i++) {
                const root = roots[i];
                
                // Evaluate polynomial
                let pReal = 0, pImag = 0;
                for (let j = 0; j <= n; j++) {
                    const pow = this.complexPow({ real: root.real, imag: root.imag }, n - j);
                    pReal += coeffs[j] * pow.real;
                    pImag += coeffs[j] * pow.imag;
                }
                
                // Evaluate derivative (product of (root - other roots))
                let dReal = 1, dImag = 0;
                for (let j = 0; j < n; j++) {
                    if (j !== i) {
                        const diff = { real: root.real - roots[j].real, imag: root.imag - roots[j].imag };
                        const newReal = dReal * diff.real - dImag * diff.imag;
                        const newImag = dReal * diff.imag + dImag * diff.real;
                        dReal = newReal;
                        dImag = newImag;
                    }
                }
                
                // Newton's method update
                const denom = dReal * dReal + dImag * dImag;
                if (denom > 0.0001) {
                    root.real -= (pReal * dReal + pImag * dImag) / denom;
                    root.imag -= (pImag * dReal - pReal * dImag) / denom;
                }
            }
        }
        
        return roots.map(r => ({
            real: r.real,
            imag: r.imag,
            magnitude: Math.sqrt(r.real * r.real + r.imag * r.imag),
            angle: Math.atan2(r.imag, r.real)
        }));
    }

    /**
     * Complex power
     */
    complexPow(c, n) {
        const r = Math.pow(c.real * c.real + c.imag * c.imag, n / 2);
        const theta = Math.atan2(c.imag, c.real) * n;
        return { real: r * Math.cos(theta), imag: r * Math.sin(theta) };
    }
}

/**
 * VoiceCharacterization - Main voice characterization class
 */
export class VoiceCharacterization {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.options = options;
        
        this.formantAnalyzer = new FormantAnalyzer(audioContext);
        this.characteristics = new VoiceCharacteristics();
        
        // Processing nodes
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        this.analyserNode = audioContext.createAnalyser();
        this.analyserNode.fftSize = 8192;
        
        this.inputNode.connect(this.analyserNode);
        this.inputNode.connect(this.outputNode);
        
        // Analysis state
        this.isAnalyzing = false;
        this.analysisBuffer = [];
        this.maxBufferLength = Math.floor(audioContext.sampleRate * 5);  // 5 seconds max
        
        // Enhancement nodes
        this.deEsser = this.createDeEsser();
        this.breathRemover = this.createBreathRemover();
        this.presenceEQ = this.createPresenceEQ();
        
        // Connect enhancement chain
        this.analyserNode.connect(this.deEsser.input);
        this.deEsser.output.connect(this.breathRemover.input);
        this.breathRemover.output.connect(this.presenceEQ.input);
        this.presenceEQ.output.connect(this.outputNode);
    }

    /**
     * Create de-esser
     */
    createDeEsser() {
        const input = this.audioContext.createGain();
        const output = this.audioContext.createGain();
        
        const highPass = this.audioContext.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 6000;
        
        const compressor = this.audioContext.createDynamicsCompressor();
        compressor.threshold.value = -30;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.001;
        compressor.release.value = 0.05;
        
        const bandGain = this.audioContext.createGain();
        bandGain.gain.value = 1;
        
        input.connect(output);
        input.connect(highPass);
        highPass.connect(compressor);
        compressor.connect(bandGain);
        
        // Sidechain: compress when sibilant
        // This is a simplified version
        
        return { input, output, highPass, compressor, bandGain };
    }

    /**
     * Create breath remover
     */
    createBreathRemover() {
        const input = this.audioContext.createGain();
        const output = this.audioContext.createGain();
        
        const gate = this.audioContext.createDynamicsCompressor();
        gate.threshold.value = -40;
        gate.ratio.value = 10;
        gate.attack.value = 0.01;
        gate.release.value = 0.1;
        
        input.connect(gate);
        gate.connect(output);
        
        return { input, output, gate };
    }

    /**
     * Create presence EQ
     */
    createPresenceEQ() {
        const input = this.audioContext.createGain();
        const output = this.audioContext.createGain();
        
        const presence = this.audioContext.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = 3000;
        presence.Q.value = 1;
        presence.gain.value = 0;
        
        const air = this.audioContext.createBiquadFilter();
        air.type = 'highshelf';
        air.frequency.value = 10000;
        air.gain.value = 0;
        
        input.connect(presence);
        presence.connect(air);
        air.connect(output);
        
        return { input, output, presence, air };
    }

    /**
     * Analyze voice from audio buffer
     */
    async analyzeVoice(audioBuffer) {
        const chars = new VoiceCharacteristics();
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Detect fundamental frequency
        const f0Result = this.detectF0(channelData, sampleRate);
        chars.f0 = f0Result.frequency;
        chars.f0Confidence = f0Result.confidence;
        chars.f0Stability = f0Result.stability;
        
        // Classify voice type
        this.classifyVoice(chars);
        
        // Analyze formants
        const formants = this.formantAnalyzer.analyze(audioBuffer, 0, Math.min(1, audioBuffer.duration));
        if (formants.length > 0) {
            chars.formants = formants;
        }
        
        // Analyze breathiness (H1-H2 ratio)
        chars.breathiness = this.analyzeBreathiness(channelData, sampleRate, chars.f0);
        
        // Analyze jitter and shimmer
        chars.jitter = this.analyzeJitter(channelData, sampleRate, chars.f0);
        chars.shimmer = this.analyzeShimmer(channelData, sampleRate);
        
        // Harmonic analysis
        chars.harmonicRichness = this.analyzeHarmonics(channelData, sampleRate, chars.f0);
        
        // Dynamic analysis
        chars.dynamicRange = this.analyzeDynamics(channelData);
        
        this.characteristics = chars;
        return chars;
    }

    /**
     * Detect fundamental frequency using YIN algorithm
     */
    detectF0(signal, sampleRate) {
        const yinBufferSize = signal.length / 2;
        const yinBuffer = new Float32Array(yinBufferSize);
        const threshold = 0.15;
        
        // Compute difference function
        for (let tau = 0; tau < yinBufferSize; tau++) {
            yinBuffer[tau] = 0;
            for (let j = 0; j < yinBufferSize; j++) {
                const delta = signal[j] - signal[j + tau];
                yinBuffer[tau] += delta * delta;
            }
        }
        
        // Cumulative mean normalized difference
        yinBuffer[0] = 1;
        let runningSum = 0;
        for (let tau = 1; tau < yinBufferSize; tau++) {
            runningSum += yinBuffer[tau];
            yinBuffer[tau] *= tau / runningSum;
        }
        
        // Find the first dip below threshold
        let tauEstimate = -1;
        for (let tau = 2; tau < yinBufferSize; tau++) {
            if (yinBuffer[tau] < threshold) {
                while (tau + 1 < yinBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }
        
        if (tauEstimate === -1) {
            return { frequency: 0, confidence: 0, stability: 0 };
        }
        
        // Parabolic interpolation
        let betterTau;
        const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
        const x2 = tauEstimate + 1 < yinBufferSize ? tauEstimate + 1 : tauEstimate;
        
        if (x0 === tauEstimate) {
            betterTau = yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
        } else if (x2 === tauEstimate) {
            betterTau = yinBuffer[tauEstimate] <= yinBuffer[x0] ? tauEstimate : x0;
        } else {
            const s0 = yinBuffer[x0];
            const s1 = yinBuffer[tauEstimate];
            const s2 = yinBuffer[x2];
            betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        }
        
        const frequency = sampleRate / betterTau;
        const confidence = 1 - yinBuffer[tauEstimate];
        
        // Compute stability (variance of nearby estimates)
        let stability = 1;
        // Simplified - would need multiple windows for real stability calculation
        
        return { frequency, confidence, stability };
    }

    /**
     * Classify voice type based on F0
     */
    classifyVoice(chars) {
        const f0 = chars.f0;
        
        if (f0 < 100) {
            chars.voiceType = 'bass';
            chars.gender = 'male';
            chars.register = 'low';
        } else if (f0 < 150) {
            chars.voiceType = 'baritone';
            chars.gender = 'male';
            chars.register = 'low-mid';
        } else if (f0 < 200) {
            chars.voiceType = 'tenor';
            chars.gender = 'male';
            chars.register = 'mid';
        } else if (f0 < 250) {
            chars.voiceType = 'countertenor';
            chars.gender = 'male';
            chars.register = 'high';
        } else if (f0 < 350) {
            chars.voiceType = 'alto';
            chars.gender = 'female';
            chars.register = 'low';
        } else if (f0 < 450) {
            chars.voiceType = 'mezzo-soprano';
            chars.gender = 'female';
            chars.register = 'mid';
        } else if (f0 < 600) {
            chars.voiceType = 'soprano';
            chars.gender = 'female';
            chars.register = 'high';
        } else {
            chars.voiceType = 'coloratura';
            chars.gender = 'female';
            chars.register = 'very high';
        }
    }

    /**
     * Analyze breathiness
     */
    analyzeBreathiness(signal, sampleRate, f0) {
        if (f0 <= 0) return 0;
        
        // Analyze spectral tilt (H1-H2 ratio)
        // Higher values indicate more breathiness
        const fftSize = 4096;
        const fft = this.computeFFT(signal.slice(0, fftSize));
        const binSize = sampleRate / fftSize;
        
        const h1Bin = Math.round(f0 / binSize);
        const h2Bin = Math.round(f0 * 2 / binSize);
        
        const h1 = fft[h1Bin] || 0;
        const h2 = fft[h2Bin] || 0;
        
        // H1-H2 difference (positive = breathy)
        const h1h2Diff = h1 - h2;
        
        // Normalize to 0-1
        return Math.max(0, Math.min(1, h1h2Diff / 30));
    }

    /**
     * Analyze jitter (frequency perturbation)
     */
    analyzeJitter(signal, sampleRate, f0) {
        if (f0 <= 0) return 0;
        
        // Simplified jitter analysis
        // Real implementation would track periods and compute variation
        const period = sampleRate / f0;
        const numPeriods = Math.floor(signal.length / period);
        
        if (numPeriods < 3) return 0;
        
        // Estimate period lengths
        const periods = [];
        for (let i = 0; i < numPeriods; i++) {
            const start = Math.floor(i * period);
            const end = Math.floor((i + 1) * period);
            periods.push(this.findPeriod(signal, start, end));
        }
        
        // Compute relative period variation
        let sumDiff = 0;
        for (let i = 1; i < periods.length; i++) {
            sumDiff += Math.abs(periods[i] - periods[i - 1]) / period;
        }
        
        return sumDiff / (periods.length - 1);
    }

    /**
     * Find period using autocorrelation
     */
    findPeriod(signal, start, end) {
        const segment = signal.slice(start, end);
        let maxCorr = -1;
        let period = segment.length;
        
        for (let lag = segment.length / 4; lag < segment.length * 0.75; lag++) {
            let corr = 0;
            for (let i = 0; i < segment.length - lag; i++) {
                corr += segment[i] * segment[i + lag];
            }
            if (corr > maxCorr) {
                maxCorr = corr;
                period = lag;
            }
        }
        
        return period;
    }

    /**
     * Analyze shimmer (amplitude perturbation)
     */
    analyzeShimmer(signal, sampleRate) {
        // Analyze amplitude variation between periods
        const windowSize = 1024;
        const amplitudes = [];
        
        for (let i = 0; i < signal.length - windowSize; i += windowSize / 2) {
            let rms = 0;
            for (let j = 0; j < windowSize; j++) {
                rms += signal[i + j] * signal[i + j];
            }
            amplitudes.push(Math.sqrt(rms / windowSize));
        }
        
        // Compute coefficient of variation
        const mean = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
        const variance = amplitudes.reduce((a, b) => a + (b - mean) ** 2, 0) / amplitudes.length;
        
        return Math.sqrt(variance) / mean;
    }

    /**
     * Analyze harmonic content
     */
    analyzeHarmonics(signal, sampleRate, f0) {
        if (f0 <= 0) return 0;
        
        const fft = this.computeFFT(signal);
        const binSize = sampleRate / fft.length;
        
        let harmonicEnergy = 0;
        let totalEnergy = 0;
        
        // Sum harmonic energy
        for (let h = 1; h <= 10; h++) {
            const hBin = Math.round(f0 * h / binSize);
            if (hBin < fft.length) {
                harmonicEnergy += fft[hBin];
            }
        }
        
        // Total energy in voice range
        const lowBin = Math.round(50 / binSize);
        const highBin = Math.round(4000 / binSize);
        for (let i = lowBin; i < highBin && i < fft.length; i++) {
            totalEnergy += fft[i];
        }
        
        return harmonicEnergy / (totalEnergy + 0.001);
    }

    /**
     * Compute magnitude spectrum
     */
    computeFFT(signal) {
        // Simplified FFT - real implementation would use proper FFT library
        const n = signal.length;
        const magnitude = new Float32Array(n / 2);
        
        for (let k = 0; k < n / 2; k++) {
            let real = 0, imag = 0;
            for (let j = 0; j < n; j++) {
                const angle = (2 * Math.PI * k * j) / n;
                real += signal[j] * Math.cos(angle);
                imag -= signal[j] * Math.sin(angle);
            }
            magnitude[k] = Math.sqrt(real * real + imag * imag) / n;
        }
        
        return magnitude;
    }

    /**
     * Analyze dynamics
     */
    analyzeDynamics(signal) {
        let peak = 0;
        let rmsSum = 0;
        
        for (let i = 0; i < signal.length; i++) {
            const abs = Math.abs(signal[i]);
            if (abs > peak) peak = abs;
            rmsSum += signal[i] * signal[i];
        }
        
        const rms = Math.sqrt(rmsSum / signal.length);
        const peakDB = 20 * Math.log10(peak + 0.00001);
        const rmsDB = 20 * Math.log10(rms + 0.00001);
        
        return peakDB - rmsDB;
    }

    /**
     * Apply enhancement based on analysis
     */
    applyEnhancement(settings = {}) {
        const { deEss, deBreath, presence, air, warmth } = settings;
        
        if (deEss !== undefined) {
            this.deEsser.compressor.threshold.value = -30 - deEss * 10;
            this.deEsser.compressor.ratio.value = 2 + deEss * 6;
        }
        
        if (deBreath !== undefined) {
            this.breathRemover.gate.threshold.value = -40 - deBreath * 10;
        }
        
        if (presence !== undefined) {
            this.presenceEQ.presence.gain.value = presence * 6;
        }
        
        if (air !== undefined) {
            this.presenceEQ.air.gain.value = air * 4;
        }
        
        if (warmth !== undefined) {
            // Add warmth via low-mid boost
        }
    }

    /**
     * Get input node
     */
    getInput() {
        return this.inputNode;
    }

    /**
     * Get output node
     */
    getOutput() {
        return this.outputNode;
    }

    /**
     * Connect to destination
     */
    connect(destination) {
        this.outputNode.connect(destination);
    }

    /**
     * Disconnect
     */
    disconnect() {
        this.outputNode.disconnect();
    }

    /**
     * Get current characteristics
     */
    getCharacteristics() {
        return this.characteristics;
    }
}

/**
 * VoiceTypePresets - Presets for different voice types
 */
export const VoiceTypePresets = {
    bass: { presence: 2, air: 1, warmth: 3, deEss: 0.5 },
    baritone: { presence: 2, air: 1.5, warmth: 2, deEss: 0.5 },
    tenor: { presence: 2.5, air: 2, warmth: 1.5, deEss: 1 },
    alto: { presence: 2, air: 2, warmth: 1, deEss: 1 },
    mezzo: { presence: 2, air: 2, warmth: 1, deEss: 1.5 },
    soprano: { presence: 1.5, air: 2.5, warmth: 0.5, deEss: 2 }
};

/**
 * Open voice characterization panel
 */
export function openVoiceCharacterizationPanel(services = {}) {
    const { audioContext, getDestination, showNotification } = services;
    
    if (!audioContext) {
        console.error('VoiceCharacterization: audioContext required');
        return null;
    }
    
    // Remove existing panel
    const existing = document.getElementById('voice-char-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'voice-char-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #4a4a6a;
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 700px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const voiceChar = new VoiceCharacterization(audioContext);
    const destination = getDestination ? getDestination() : audioContext.destination;
    voiceChar.connect(destination);
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #fff; margin: 0;">🎤 Voice Characterization</h2>
            <button id="close-voice-char" style="background: #ef4444; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
        
        <!-- Input Source -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Input Source</h3>
            <div style="display: flex; gap: 10px;">
                <input type="file" id="voice-file" accept="audio/*" style="display: none;">
                <button id="load-voice-file" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                    Load Audio File
                </button>
                <div id="file-info" style="flex: 2; background: #0a0a14; padding: 12px; border-radius: 4px; color: #666;">
                    No file loaded
                </div>
            </div>
        </div>
        
        <!-- Voice Characteristics -->
        <div style="margin-bottom: 20px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Analysis Results</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div style="background: #0f0f1f; padding: 16px; border-radius: 6px;">
                    <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Voice Type</div>
                    <div id="voice-type" style="color: #10b981; font-size: 18px; font-weight: bold;">--</div>
                </div>
                <div style="background: #0f0f1f; padding: 16px; border-radius: 6px;">
                    <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Fundamental (F0)</div>
                    <div id="voice-f0" style="color: #f59e0b; font-size: 18px; font-weight: bold;">-- Hz</div>
                </div>
                <div style="background: #0f0f1f; padding: 16px; border-radius: 6px;">
                    <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Gender/Register</div>
                    <div id="voice-register" style="color: #8b5cf6; font-size: 18px; font-weight: bold;">--</div>
                </div>
                <div style="background: #0f0f1f; padding: 16px; border-radius: 6px;">
                    <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Breathiness</div>
                    <div id="voice-breath" style="color: #ec4899; font-size: 18px; font-weight: bold;">--</div>
                </div>
                <div style="background: #0f0f1f; padding: 16px; border-radius: 6px;">
                    <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Jitter</div>
                    <div id="voice-jitter" style="color: #06b6d4; font-size: 18px; font-weight: bold;">--</div>
                </div>
                <div style="background: #0f0f1f; padding: 16px; border-radius: 6px;">
                    <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Shimmer</div>
                    <div id="voice-shimmer" style="color: #84cc16; font-size: 18px; font-weight: bold;">--</div>
                </div>
            </div>
        </div>
        
        <!-- Formants -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Formants</h3>
            <div id="formants-display" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <div style="text-align: center;">
                    <div style="color: #666; font-size: 10px;">F1</div>
                    <div style="color: #fff; font-size: 14px;">-- Hz</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: #666; font-size: 10px;">F2</div>
                    <div style="color: #fff; font-size: 14px;">-- Hz</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: #666; font-size: 10px;">F3</div>
                    <div style="color: #fff; font-size: 14px;">-- Hz</div>
                </div>
                <div style="text-align: center;">
                    <div style="color: #666; font-size: 10px;">F4</div>
                    <div style="color: #fff; font-size: 14px;">-- Hz</div>
                </div>
            </div>
        </div>
        
        <!-- Enhancement Controls -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Enhancement</h3>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px;">
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">De-Ess</label>
                    <input type="range" id="de-ess" min="0" max="3" step="0.1" value="1" style="width: 100%;">
                    <div id="de-ess-val" style="color: #fff; text-align: center; font-size: 12px;">1.0</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">De-Breath</label>
                    <input type="range" id="de-breath" min="0" max="3" step="0.1" value="0" style="width: 100%;">
                    <div id="de-breath-val" style="color: #fff; text-align: center; font-size: 12px;">0.0</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Presence</label>
                    <input type="range" id="presence" min="0" max="6" step="0.1" value="2" style="width: 100%;">
                    <div id="presence-val" style="color: #fff; text-align: center; font-size: 12px;">2.0</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Air</label>
                    <input type="range" id="air" min="0" max="6" step="0.1" value="2" style="width: 100%;">
                    <div id="air-val" style="color: #fff; text-align: center; font-size: 12px;">2.0</div>
                </div>
                <div>
                    <label style="display: block; color: #888; font-size: 11px; margin-bottom: 4px;">Warmth</label>
                    <input type="range" id="warmth" min="0" max="3" step="0.1" value="1" style="width: 100%;">
                    <div id="warmth-val" style="color: #fff; text-align: center; font-size: 12px;">1.0</div>
                </div>
            </div>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; gap: 10px;">
            <button id="analyze-voice" style="flex: 1; padding: 14px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                🔍 Analyze Voice
            </button>
            <button id="apply-preset" style="flex: 1; padding: 14px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                ✨ Apply Auto Enhancement
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    let audioBuffer = null;
    
    // Update display
    function updateDisplay(chars) {
        panel.querySelector('#voice-type').textContent = chars.voiceType || '--';
        panel.querySelector('#voice-f0').textContent = `${chars.f0.toFixed(1)} Hz`;
        panel.querySelector('#voice-register').textContent = `${chars.gender} / ${chars.register}`;
        panel.querySelector('#voice-breath').textContent = (chars.breathiness * 100).toFixed(0) + '%';
        panel.querySelector('#voice-jitter').textContent = (chars.jitter * 100).toFixed(2) + '%';
        panel.querySelector('#voice-shimmer').textContent = (chars.shimmer * 100).toFixed(2) + '%';
        
        // Formants
        const formantsDiv = panel.querySelector('#formants-display');
        const formantLabels = ['F1', 'F2', 'F3', 'F4'];
        formantsDiv.innerHTML = formantLabels.map((label, i) => {
            const f = chars.formants[i];
            return `
                <div style="text-align: center;">
                    <div style="color: #666; font-size: 10px;">${label}</div>
                    <div style="color: #fff; font-size: 14px;">${f ? f.frequency.toFixed(0) : '--'} Hz</div>
                </div>
            `;
        }).join('');
    }
    
    // Close
    panel.querySelector('#close-voice-char').onclick = () => {
        voiceChar.disconnect();
        panel.remove();
    };
    
    // Load file
    panel.querySelector('#load-voice-file').onclick = () => {
        panel.querySelector('#voice-file').click();
    };
    
    panel.querySelector('#voice-file').onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            panel.querySelector('#file-info').textContent = 'Loading...';
            try {
                const arrayBuffer = await file.arrayBuffer();
                audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                panel.querySelector('#file-info').textContent = `${file.name} (${audioBuffer.duration.toFixed(1)}s)`;
                if (showNotification) showNotification('Audio loaded', 1500);
            } catch (err) {
                panel.querySelector('#file-info').textContent = 'Failed to load audio';
            }
        }
    };
    
    // Analyze
    panel.querySelector('#analyze-voice').onclick = async () => {
        if (!audioBuffer) {
            if (showNotification) showNotification('Please load an audio file first', 2000);
            return;
        }
        
        const chars = await voiceChar.analyzeVoice(audioBuffer);
        updateDisplay(chars);
        if (showNotification) showNotification('Voice analysis complete', 2000);
    };
    
    // Apply preset
    panel.querySelector('#apply-preset').onclick = () => {
        const chars = voiceChar.getCharacteristics();
        const preset = VoiceTypePresets[chars.voiceType] || { presence: 2, air: 2, warmth: 1, deEss: 1 };
        
        voiceChar.applyEnhancement({
            deEss: preset.deEss,
            deBreath: 0,
            presence: preset.presence,
            air: preset.air,
            warmth: preset.warmth
        });
        
        // Update sliders
        ['de-ess', 'de-breath', 'presence', 'air', 'warmth'].forEach(param => {
            const slider = panel.querySelector(`#${param}`);
            const val = panel.querySelector(`#${param}-val`);
            const presetKey = param.replace('-', '');
            const value = preset[presetKey === 'deEss' ? 'deEss' : presetKey] || 0;
            slider.value = value;
            val.textContent = value.toFixed(1);
        });
        
        if (showNotification) showNotification(`Applied ${chars.voiceType} preset`, 2000);
    };
    
    // Enhancement sliders
    ['de-ess', 'de-breath', 'presence', 'air', 'warmth'].forEach(param => {
        const slider = panel.querySelector(`#${param}`);
        const val = panel.querySelector(`#${param}-val`);
        slider.oninput = () => {
            val.textContent = parseFloat(slider.value).toFixed(1);
            
            const key = param === 'de-ess' ? 'deEss' : param === 'de-breath' ? 'deBreath' : param;
            voiceChar.applyEnhancement({ [key]: parseFloat(slider.value) });
        };
    });
    
    return voiceChar;
}

export default VoiceCharacterization;