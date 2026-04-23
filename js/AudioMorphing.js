// js/AudioMorphing.js - Audio Morphing for SnugOS DAW
// Provides smooth transitions and morphing between different sounds/audio clips

/**
 * AudioMorphing provides:
 * - Cross-synthesis between two audio sources
 * - Spectral morphing (interpolating between spectra)
 * - Timbral morphing
 * - Grain-based morphing
 * - Real-time morphing with adjustable parameters
 */

/**
 * Morphing modes
 */
export const MorphMode = {
    CROSSFADE: 'crossfade',           // Simple amplitude crossfade
    SPECTRAL: 'spectral',             // Spectral interpolation
    TIMBRAL: 'timbral',               // Timbre-based morphing
    GRAIN: 'grain',                   // Granular morphing
    CONVOLUTION: 'convolution',       // Convolution-based morphing
    FORMANT: 'formant'                // Formant preservation morphing
};

/**
 * Morphing curve types
 */
export const MorphCurve = {
    LINEAR: 'linear',
    EQUAL_POWER: 'equal_power',
    EXPONENTIAL: 'exponential',
    LOGARITHMIC: 'logarithmic',
    S_CURVE: 's_curve',
    CUSTOM: 'custom'
};

/**
 * AudioMorpher - Main morphing engine
 */
export class AudioMorpher {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = options.sampleRate || 44100;
        
        // Morphing settings
        this.settings = {
            mode: MorphMode.SPECTRAL,
            curve: MorphCurve.EQUAL_POWER,
            duration: 2.0,             // Default morph duration in seconds
            grainSize: 0.05,           // Grain size in seconds
            grainOverlap: 4,           // Grain overlap factor
            spectralSmoothing: 0.5,    // Spectral interpolation smoothing
            formantPreservation: 0.3,  // Formant preservation amount
            pitchCorrection: true      // Maintain pitch during morph
        };
        
        // Audio sources
        this.sourceA = null;           // First audio buffer
        this.sourceB = null;           // Second audio buffer
        this.sourceAName = '';
        this.sourceBName = '';
        
        // Analysis data
        this.analysisA = null;
        this.analysisB = null;
        
        // Morph state
        this.morphPosition = 0;        // 0 = source A, 1 = source B
        this.isPlaying = false;
        this.morphInterval = null;
        
        // Callbacks
        this.onProgress = null;
        this.onComplete = null;
        
        // FFT for spectral analysis
        this.fftSize = 2048;
    }
    
    /**
     * Initialize with audio context
     */
    init(audioContext) {
        this.audioContext = audioContext;
        this.sampleRate = audioContext.sampleRate;
    }
    
    /**
     * Set source A (first audio buffer)
     */
    setSourceA(audioBuffer, name = 'Source A') {
        this.sourceA = audioBuffer;
        this.sourceAName = name;
        this.analysisA = this.analyzeSource(audioBuffer);
        console.log(`[AudioMorphing] Source A set: ${name}`);
    }
    
    /**
     * Set source B (second audio buffer)
     */
    setSourceB(audioBuffer, name = 'Source B') {
        this.sourceB = audioBuffer;
        this.sourceBName = name;
        this.analysisB = this.analyzeSource(audioBuffer);
        console.log(`[AudioMorphing] Source B set: ${name}`);
    }
    
    /**
     * Analyze audio source for morphing
     */
    analyzeSource(audioBuffer) {
        if (!audioBuffer) return null;
        
        const analysis = {
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            rms: 0,
            peak: 0,
            spectralCentroid: 0,
            spectralFlatness: 0,
            spectralRolloff: 0,
            zeroCrossingRate: 0,
            fftFrames: []
        };
        
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Calculate RMS and peak
        let sumSquares = 0;
        let peak = 0;
        let zeroCrossings = 0;
        
        for (let i = 0; i < channelData.length; i++) {
            sumSquares += channelData[i] * channelData[i];
            peak = Math.max(peak, Math.abs(channelData[i]));
            
            if (i > 0 && channelData[i] * channelData[i - 1] < 0) {
                zeroCrossings++;
            }
        }
        
        analysis.rms = Math.sqrt(sumSquares / channelData.length);
        analysis.peak = peak;
        analysis.zeroCrossingRate = zeroCrossings / channelData.length;
        
        // FFT analysis in frames
        const frameSize = this.fftSize;
        const hopSize = frameSize / 4;
        
        for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
            const frame = channelData.slice(i, i + frameSize);
            const fftFrame = this.computeFFT(frame);
            analysis.fftFrames.push(fftFrame);
        }
        
        // Calculate spectral features from first frame
        if (analysis.fftFrames.length > 0) {
            const spectrum = analysis.fftFrames[0].magnitude;
            
            analysis.spectralCentroid = this.calculateSpectralCentroid(spectrum, sampleRate);
            analysis.spectralFlatness = this.calculateSpectralFlatness(spectrum);
            analysis.spectralRolloff = this.calculateSpectralRolloff(spectrum, sampleRate);
        }
        
        return analysis;
    }
    
    /**
     * Compute FFT (simplified implementation)
     */
    computeFFT(frame) {
        const N = frame.length;
        const real = new Float32Array(N);
        const imag = new Float32Array(N);
        const magnitude = new Float32Array(N / 2);
        const phase = new Float32Array(N / 2);
        
        // Apply Hann window
        const windowed = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            windowed[i] = frame[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
        }
        
        // DFT (simplified - would use FFT algorithm in production)
        for (let k = 0; k < N / 2; k++) {
            let sumReal = 0;
            let sumImag = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = 2 * Math.PI * k * n / N;
                sumReal += windowed[n] * Math.cos(angle);
                sumImag -= windowed[n] * Math.sin(angle);
            }
            
            real[k] = sumReal;
            imag[k] = sumImag;
            magnitude[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag) / N;
            phase[k] = Math.atan2(sumImag, sumReal);
        }
        
        return { real, imag, magnitude, phase };
    }
    
    /**
     * Calculate spectral centroid
     */
    calculateSpectralCentroid(spectrum, sampleRate) {
        let weightedSum = 0;
        let sum = 0;
        
        for (let i = 0; i < spectrum.length; i++) {
            const frequency = i * sampleRate / (spectrum.length * 2);
            weightedSum += frequency * spectrum[i];
            sum += spectrum[i];
        }
        
        return sum > 0 ? weightedSum / sum : 0;
    }
    
    /**
     * Calculate spectral flatness
     */
    calculateSpectralFlatness(spectrum) {
        if (spectrum.length === 0) return 0;
        
        let geometricMean = 1;
        let arithmeticMean = 0;
        
        for (let i = 0; i < spectrum.length; i++) {
            if (spectrum[i] > 0) {
                geometricMean *= Math.pow(spectrum[i], 1 / spectrum.length);
            }
            arithmeticMean += spectrum[i];
        }
        
        arithmeticMean /= spectrum.length;
        
        return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
    }
    
    /**
     * Calculate spectral rolloff
     */
    calculateSpectralRolloff(spectrum, sampleRate, threshold = 0.85) {
        let totalEnergy = 0;
        
        for (let i = 0; i < spectrum.length; i++) {
            totalEnergy += spectrum[i] * spectrum[i];
        }
        
        const targetEnergy = totalEnergy * threshold;
        let cumulativeEnergy = 0;
        
        for (let i = 0; i < spectrum.length; i++) {
            cumulativeEnergy += spectrum[i] * spectrum[i];
            
            if (cumulativeEnergy >= targetEnergy) {
                return i * sampleRate / (spectrum.length * 2);
            }
        }
        
        return sampleRate / 2;
    }
    
    /**
     * Generate morphed audio at position (0-1)
     */
    generateMorph(position) {
        if (!this.sourceA || !this.sourceB) {
            console.error('[AudioMorphing] Sources not set');
            return null;
        }
        
        position = Math.max(0, Math.min(1, position));
        
        switch (this.settings.mode) {
            case MorphMode.CROSSFADE:
                return this.generateCrossfadeMorph(position);
            case MorphMode.SPECTRAL:
                return this.generateSpectralMorph(position);
            case MorphMode.TIMBRAL:
                return this.generateTimbralMorph(position);
            case MorphMode.GRAIN:
                return this.generateGrainMorph(position);
            case MorphMode.CONVOLUTION:
                return this.generateConvolutionMorph(position);
            case MorphMode.FORMANT:
                return this.generateFormantMorph(position);
            default:
                return this.generateCrossfadeMorph(position);
        }
    }
    
    /**
     * Calculate crossfade gain for position
     */
    calculateCrossfadeGain(position, curve = this.settings.curve) {
        switch (curve) {
            case MorphCurve.LINEAR:
                return { gainA: 1 - position, gainB: position };
            
            case MorphCurve.EQUAL_POWER:
                // Equal power crossfade preserves perceived loudness
                return {
                    gainA: Math.cos(position * Math.PI / 2),
                    gainB: Math.sin(position * Math.PI / 2)
                };
            
            case MorphCurve.EXPONENTIAL:
                return {
                    gainA: Math.pow(1 - position, 2),
                    gainB: Math.pow(position, 2)
                };
            
            case MorphCurve.LOGARITHMIC:
                return {
                    gainA: position < 0.99 ? -20 * Math.log10(1 - position + 0.01) / 20 : 0,
                    gainB: position > 0.01 ? -20 * Math.log10(position + 0.01) / 20 : 0
                };
            
            case MorphCurve.S_CURVE:
                // Sigmoid S-curve
                const sigmoid = (x) => 1 / (1 + Math.exp(-10 * (x - 0.5)));
                const smooth = sigmoid(position);
                return { gainA: 1 - smooth, gainB: smooth };
            
            default:
                return { gainA: 1 - position, gainB: position };
        }
    }
    
    /**
     * Generate crossfade morph
     */
    generateCrossfadeMorph(position) {
        const { gainA, gainB } = this.calculateCrossfadeGain(position);
        
        const duration = Math.max(this.sourceA.duration, this.sourceB.duration);
        const length = Math.ceil(duration * this.sampleRate);
        
        const outputBuffer = this.audioContext.createBuffer(2, length, this.sampleRate);
        const leftOut = outputBuffer.getChannelData(0);
        const rightOut = outputBuffer.getChannelData(1);
        
        const leftA = this.sourceA.getChannelData(0);
        const rightA = this.sourceA.numberOfChannels > 1 ? this.sourceA.getChannelData(1) : leftA;
        const leftB = this.sourceB.getChannelData(0);
        const rightB = this.sourceB.numberOfChannels > 1 ? this.sourceB.getChannelData(1) : leftB;
        
        for (let i = 0; i < length; i++) {
            const sampleA = i < leftA.length ? leftA[i] * gainA : 0;
            const sampleB = i < leftB.length ? leftB[i] * gainB : 0;
            leftOut[i] = sampleA + sampleB;
            
            const sampleRightA = i < rightA.length ? rightA[i] * gainA : 0;
            const sampleRightB = i < rightB.length ? rightB[i] * gainB : 0;
            rightOut[i] = sampleRightA + sampleRightB;
        }
        
        return outputBuffer;
    }
    
    /**
     * Generate spectral morph
     */
    generateSpectralMorph(position) {
        if (!this.analysisA || !this.analysisB) {
            return this.generateCrossfadeMorph(position);
        }
        
        const duration = Math.max(this.sourceA.duration, this.sourceB.duration);
        const length = Math.ceil(duration * this.sampleRate);
        
        const outputBuffer = this.audioContext.createBuffer(2, length, this.sampleRate);
        const leftOut = outputBuffer.getChannelData(0);
        const rightOut = outputBuffer.getChannelData(1);
        
        // Interpolate between spectral frames
        const numFrames = Math.min(this.analysisA.fftFrames.length, this.analysisB.fftFrames.length);
        const hopSize = this.fftSize / 4;
        
        for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
            const frameA = this.analysisA.fftFrames[frameIdx];
            const frameB = this.analysisB.fftFrames[frameIdx];
            
            if (!frameA || !frameB) continue;
            
            // Interpolate magnitude and phase
            const morphedMagnitude = new Float32Array(frameA.magnitude.length);
            const morphedPhase = new Float32Array(frameA.phase.length);
            
            for (let i = 0; i < morphedMagnitude.length; i++) {
                morphedMagnitude[i] = frameA.magnitude[i] * (1 - position) + frameB.magnitude[i] * position;
                morphedPhase[i] = frameA.phase[i] * (1 - position) + frameB.phase[i] * position;
            }
            
            // Apply smoothing
            if (this.settings.spectralSmoothing > 0) {
                for (let i = 1; i < morphedMagnitude.length - 1; i++) {
                    morphedMagnitude[i] = morphedMagnitude[i] * (1 - this.settings.spectralSmoothing) +
                        (morphedMagnitude[i - 1] + morphedMagnitude[i + 1]) / 2 * this.settings.spectralSmoothing;
                }
            }
            
            // Inverse FFT to get time domain
            const timeFrame = this.inverseFFT(morphedMagnitude, morphedPhase);
            
            // Overlap-add to output
            const outputIndex = frameIdx * hopSize;
            for (let i = 0; i < timeFrame.length && outputIndex + i < length; i++) {
                // Apply Hann window for overlap-add
                const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / timeFrame.length);
                leftOut[outputIndex + i] += timeFrame[i] * window;
                rightOut[outputIndex + i] += timeFrame[i] * window;
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Inverse FFT
     */
    inverseFFT(magnitude, phase) {
        const N = magnitude.length * 2;
        const output = new Float32Array(N);
        
        // Reconstruct real and imaginary from magnitude and phase
        for (let n = 0; n < N; n++) {
            let sumReal = 0;
            let sumImag = 0;
            
            for (let k = 0; k < magnitude.length; k++) {
                const angle = 2 * Math.PI * k * n / N - phase[k];
                sumReal += magnitude[k] * Math.cos(angle);
                sumImag += magnitude[k] * Math.sin(angle);
            }
            
            output[n] = (sumReal + sumImag) / N;
        }
        
        return output;
    }
    
    /**
     * Generate timbral morph
     */
    generateTimbralMorph(position) {
        if (!this.analysisA || !this.analysisB) {
            return this.generateCrossfadeMorph(position);
        }
        
        // Timbral morphing focuses on spectral shape
        const morphedSpectralCentroid = this.analysisA.spectralCentroid * (1 - position) +
            this.analysisB.spectralCentroid * position;
        
        // Use spectral morph with emphasis on timbral features
        const buffer = this.generateSpectralMorph(position);
        
        // Apply EQ to match target spectral centroid
        if (this.audioContext && buffer) {
            const centroidRatio = morphedSpectralCentroid / 
                (this.analysisA.spectralCentroid + this.analysisB.spectralCentroid) * 2;
            
            // Simple brightness adjustment (would use proper EQ in production)
            const channelData = buffer.getChannelData(0);
            
            // High shelf adjustment based on centroid
            const brightness = centroidRatio > 1 ? 1.2 : 0.8;
            
            // Simple first-order high shelf simulation
            let prevSample = 0;
            for (let i = 0; i < channelData.length; i++) {
                const highFreq = channelData[i] - prevSample * 0.95;
                channelData[i] = channelData[i] + highFreq * (brightness - 1);
                prevSample = channelData[i];
            }
        }
        
        return buffer;
    }
    
    /**
     * Generate grain morph
     */
    generateGrainMorph(position) {
        const duration = Math.max(this.sourceA.duration, this.sourceB.duration);
        const length = Math.ceil(duration * this.sampleRate);
        
        const outputBuffer = this.audioContext.createBuffer(2, length, this.sampleRate);
        const leftOut = outputBuffer.getChannelData(0);
        const rightOut = outputBuffer.getChannelData(1);
        
        const grainSize = this.settings.grainSize;
        const grainSamples = Math.floor(grainSize * this.sampleRate);
        const overlap = this.settings.grainOverlap;
        const hopSize = Math.floor(grainSamples / overlap);
        
        const leftA = this.sourceA.getChannelData(0);
        const rightA = this.sourceA.numberOfChannels > 1 ? this.sourceA.getChannelData(1) : leftA;
        const leftB = this.sourceB.getChannelData(0);
        const rightB = this.sourceB.numberOfChannels > 1 ? this.sourceB.getChannelData(1) : leftB;
        
        // Generate grains
        let grainIndex = 0;
        
        for (let i = 0; i < length; i += hopSize) {
            // Determine which source to pull grain from
            const useSourceB = Math.random() < position;
            const source = useSourceB ? this.sourceB : this.sourceA;
            const leftSource = useSourceB ? leftB : leftA;
            const rightSource = useSourceB ? rightB : rightA;
            
            // Random position in source
            const sourcePosition = Math.floor(Math.random() * (source.length - grainSamples));
            
            // Apply grain with envelope
            for (let j = 0; j < grainSamples && i + j < length; j++) {
                // Gaussian envelope
                const x = (j / grainSamples - 0.5) * 4;
                const envelope = Math.exp(-x * x);
                
                const sourceIdx = sourcePosition + j;
                if (sourceIdx < leftSource.length) {
                    leftOut[i + j] += leftSource[sourceIdx] * envelope;
                    rightOut[i + j] += rightSource[sourceIdx] * envelope;
                }
            }
            
            grainIndex++;
        }
        
        // Normalize
        const maxAmp = Math.max(
            ...leftOut.map(Math.abs),
            ...rightOut.map(Math.abs)
        );
        
        if (maxAmp > 1) {
            for (let i = 0; i < length; i++) {
                leftOut[i] /= maxAmp;
                rightOut[i] /= maxAmp;
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Generate convolution morph
     */
    generateConvolutionMorph(position) {
        // Convolution-based morphing combines the impulse responses
        // of both sources
        
        const duration = Math.max(this.sourceA.duration, this.sourceB.duration);
        const length = Math.ceil(duration * this.sampleRate);
        
        const outputBuffer = this.audioContext.createBuffer(2, length, this.sampleRate);
        const leftOut = outputBuffer.getChannelData(0);
        const rightOut = outputBuffer.getChannelData(1);
        
        // Simplified convolution morph (full implementation would use FFT convolution)
        const leftA = this.sourceA.getChannelData(0);
        const leftB = this.sourceB.getChannelData(0);
        
        // Mix with position-dependent convolution
        const convLength = Math.min(1024, Math.floor(length / 10));
        
        for (let i = 0; i < length; i++) {
            let sumA = 0;
            let sumB = 0;
            
            for (let j = 0; j < convLength && i - j >= 0; j++) {
                const weightA = Math.exp(-j / convLength) * (1 - position);
                const weightB = Math.exp(-j / convLength) * position;
                
                sumA += (leftA[(i - j) % leftA.length] || 0) * weightA;
                sumB += (leftB[(i - j) % leftB.length] || 0) * weightB;
            }
            
            leftOut[i] = sumA + sumB;
            rightOut[i] = sumA + sumB;
        }
        
        // Normalize
        const maxAmp = Math.max(...leftOut.map(Math.abs));
        if (maxAmp > 1) {
            for (let i = 0; i < length; i++) {
                leftOut[i] /= maxAmp;
                rightOut[i] /= maxAmp;
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Generate formant-preserving morph
     */
    generateFormantMorph(position) {
        if (!this.analysisA || !this.analysisB) {
            return this.generateCrossfadeMorph(position);
        }
        
        const preservation = this.settings.formantPreservation;
        const spectralBuffer = this.generateSpectralMorph(position);
        
        if (!spectralBuffer) return null;
        
        // Formant preservation adjusts the spectral envelope
        // to maintain vocal formant structure
        
        const channelData = spectralBuffer.getChannelData(0);
        
        // Simple formant filter simulation
        const formantFreqs = [
            { freq: 500, q: 10 },
            { freq: 1500, q: 8 },
            { freq: 2500, q: 6 }
        ];
        
        // Apply formant emphasis
        for (let i = 0; i < channelData.length; i++) {
            // Simple harmonic enhancement at formant frequencies
            const t = i / this.sampleRate;
            
            let formantBoost = 0;
            for (const formant of formantFreqs) {
                const freq = formant.freq * (1 + (position - 0.5) * 0.1);
                formantBoost += Math.sin(2 * Math.PI * freq * t) * 0.02 * preservation;
            }
            
            channelData[i] += formantBoost;
            channelData[i] = Math.max(-1, Math.min(1, channelData[i]));
        }
        
        return spectralBuffer;
    }
    
    /**
     * Start real-time morphing playback
     */
    startMorphing(duration = this.settings.duration, onComplete = null) {
        if (!this.sourceA || !this.sourceB) {
            console.error('[AudioMorphing] Sources not set');
            return;
        }
        
        this.isPlaying = true;
        this.morphPosition = 0;
        this.onComplete = onComplete;
        
        const updateInterval = 50; // ms
        const positionIncrement = updateInterval / 1000 / duration;
        
        this.morphInterval = setInterval(() => {
            if (!this.isPlaying) return;
            
            this.morphPosition += positionIncrement;
            
            if (this.onProgress) {
                this.onProgress(this.morphPosition);
            }
            
            if (this.morphPosition >= 1) {
                this.stopMorphing();
                
                if (this.onComplete) {
                    this.onComplete();
                }
            }
        }, updateInterval);
        
        console.log(`[AudioMorphing] Started morphing from "${this.sourceAName}" to "${this.sourceBName}"`);
    }
    
    /**
     * Stop morphing
     */
    stopMorphing() {
        this.isPlaying = false;
        
        if (this.morphInterval) {
            clearInterval(this.morphInterval);
            this.morphInterval = null;
        }
    }
    
    /**
     * Set morph position (for real-time control)
     */
    setMorphPosition(position) {
        this.morphPosition = Math.max(0, Math.min(1, position));
    }
    
    /**
     * Generate complete morph sequence (all frames)
     */
    generateMorphSequence(numSteps = 10) {
        const sequence = [];
        
        for (let i = 0; i <= numSteps; i++) {
            const position = i / numSteps;
            const buffer = this.generateMorph(position);
            sequence.push({
                position,
                buffer,
                name: `${this.sourceAName} → ${this.sourceBName} (${Math.round(position * 100)}%)`
            });
        }
        
        return sequence;
    }
    
    /**
     * Export morphed audio at specific position
     */
    exportMorphAt(position, format = 'wav') {
        const buffer = this.generateMorph(position);
        
        if (!buffer) return null;
        
        // Return buffer (actual encoding would happen elsewhere)
        return {
            buffer,
            position,
            format,
            duration: buffer.duration
        };
    }
    
    /**
     * Get morph presets
     */
    getMorphPresets() {
        return [
            { name: 'Smooth Crossfade', mode: MorphMode.CROSSFADE, curve: MorphCurve.EQUAL_POWER },
            { name: 'Spectral Blend', mode: MorphMode.SPECTRAL, spectralSmoothing: 0.7 },
            { name: 'Timbral Shift', mode: MorphMode.TIMBRAL, spectralSmoothing: 0.5 },
            { name: 'Granular Dissolve', mode: MorphMode.GRAIN, grainSize: 0.03 },
            { name: 'Formant Preserve', mode: MorphMode.FORMANT, formantPreservation: 0.8 },
            { name: 'Convolution Mix', mode: MorphMode.CONVOLUTION }
        ];
    }
    
    /**
     * Apply preset
     */
    applyPreset(presetName) {
        const presets = this.getMorphPresets();
        const preset = presets.find(p => p.name === presetName);
        
        if (preset) {
            this.settings.mode = preset.mode;
            if (preset.curve) this.settings.curve = preset.curve;
            if (preset.spectralSmoothing) this.settings.spectralSmoothing = preset.spectralSmoothing;
            if (preset.grainSize) this.settings.grainSize = preset.grainSize;
            if (preset.formantPreservation) this.settings.formantPreservation = preset.formantPreservation;
            
            console.log(`[AudioMorphing] Applied preset: ${presetName}`);
        }
    }
    
    /**
     * Clear sources
     */
    clearSources() {
        this.sourceA = null;
        this.sourceB = null;
        this.analysisA = null;
        this.analysisB = null;
        this.sourceAName = '';
        this.sourceBName = '';
        this.stopMorphing();
    }
    
    /**
     * Dispose
     */
    dispose() {
        this.stopMorphing();
        this.clearSources();
        this.audioContext = null;
    }
}

/**
 * Create an AudioMorpher instance
 */
export function createAudioMorpher(options = {}) {
    return new AudioMorpher(options);
}

// Default export
export default {
    MorphMode,
    MorphCurve,
    AudioMorpher,
    createAudioMorpher
};