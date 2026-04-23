// js/AudioRestoration.js - Audio Restoration Tools for SnugOS DAW
// Provides noise reduction, click removal, hum removal, and other audio restoration features

/**
 * AudioRestoration provides tools for cleaning up audio recordings.
 * 
 * Features:
 * - Noise Reduction: Spectral gating with noise profile learning
 * - Click/Pop Removal: Transient detection and smoothing
 * - Hum Removal: Notch filtering at 50/60Hz and harmonics
 * - De-essing: Reduce sibilance in vocal recordings
 * - Breath Removal: Detect and reduce breath sounds
 */

/**
 * Noise reduction modes
 */
export const NoiseReductionMode = {
    SPECTRAL_GATE: 'spectral_gate',     // Simple spectral gating
    ADAPTIVE: 'adaptive',               // Adaptive noise reduction
    PROFILE: 'profile'                  // Learn from noise profile
};

/**
 * Click detection sensitivity levels
 */
export const ClickSensitivity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high'
};

/**
 * Hum frequencies to target
 */
export const HumFrequency = {
    HZ_50: 50,      // European/Asian mains hum
    HZ_60: 60       // US mains hum
};

/**
 * AudioRestoration - Main class for audio restoration processing
 */
export class AudioRestoration {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = options.sampleRate || 44100;
        
        // Processing settings
        this.noiseReductionAmount = 0.5;
        this.noiseProfile = null;
        this.clickThreshold = 0.8;
        this.clickSensitivity = ClickSensitivity.MEDIUM;
        this.humFrequency = HumFrequency.HZ_60;
        this.deEsserFrequency = 6000;
        this.deEsserAmount = 0.5;
        
        // Noise profile data
        this.noiseProfileData = null;
        this.noiseProfileLearned = false;
        
        // Processing state
        this.isProcessing = false;
        
        // Callbacks
        this.onProgress = options.onProgress || null;
        this.onComplete = options.onComplete || null;
        this.onError = options.onError || null;
        
        this.isInitialized = false;
    }
    
    /**
     * Initialize with audio context.
     */
    initialize(audioContext) {
        if (this.isInitialized) return true;
        
        try {
            this.audioContext = audioContext;
            this.sampleRate = audioContext.sampleRate;
            this.isInitialized = true;
            console.log('[AudioRestoration] Initialized');
            return true;
        } catch (e) {
            console.error('[AudioRestoration] Initialization failed:', e);
            return false;
        }
    }
    
    /**
     * Learn noise profile from a selection.
     * @param {AudioBuffer} buffer - Audio buffer containing noise only
     * @param {number} startSample - Start sample
     * @param {number} endSample - End sample
     */
    learnNoiseProfile(buffer, startSample = 0, endSample = null) {
        const channelData = buffer.getChannelData(0);
        const end = endSample || channelData.length;
        const length = end - startSample;
        
        if (length < 1024) {
            console.warn('[AudioRestoration] Noise profile too short, need at least 1024 samples');
            return false;
        }
        
        // Extract noise segment
        const noiseSegment = channelData.slice(startSample, end);
        
        // Compute noise profile (average spectrum)
        const fftSize = 2048;
        const numFrames = Math.floor(length / fftSize);
        
        // Accumulate spectrum data
        const spectrumSum = new Float32Array(fftSize / 2 + 1);
        
        for (let frame = 0; frame < numFrames; frame++) {
            const frameStart = frame * fftSize;
            const frameData = noiseSegment.slice(frameStart, frameStart + fftSize);
            
            // Apply window
            const windowed = this.applyHannWindow(frameData);
            
            // Compute FFT magnitude
            const spectrum = this.computeFFTMagnitude(windowed);
            
            // Accumulate
            for (let i = 0; i < spectrum.length; i++) {
                spectrumSum[i] += spectrum[i];
            }
        }
        
        // Average
        for (let i = 0; i < spectrumSum.length; i++) {
            spectrumSum[i] /= numFrames;
        }
        
        this.noiseProfileData = spectrumSum;
        this.noiseProfileLearned = true;
        
        console.log('[AudioRestoration] Noise profile learned from', length, 'samples');
        return true;
    }
    
    /**
     * Clear learned noise profile.
     */
    clearNoiseProfile() {
        this.noiseProfileData = null;
        this.noiseProfileLearned = false;
        console.log('[AudioRestoration] Noise profile cleared');
    }
    
    /**
     * Apply noise reduction to audio buffer.
     * @param {AudioBuffer} buffer - Input audio buffer
     * @param {Object} options - Processing options
     * @returns {AudioBuffer} Processed audio buffer
     */
    applyNoiseReduction(buffer, options = {}) {
        const {
            amount = this.noiseReductionAmount,
            mode = NoiseReductionMode.ADAPTIVE,
            useProfile = this.noiseProfileLearned
        } = options;
        
        console.log('[AudioRestoration] Applying noise reduction, amount:', amount, 'mode:', mode);
        
        // Create output buffer
        const outputBuffer = this.audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        const fftSize = 2048;
        const hopSize = fftSize / 4;
        
        // Process each channel
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const inputData = buffer.getChannelData(ch);
            const outputData = outputBuffer.getChannelData(ch);
            
            this.applySpectralGating(inputData, outputData, {
                fftSize,
                hopSize,
                amount,
                noiseProfile: useProfile ? this.noiseProfileData : null,
                mode
            });
        }
        
        return outputBuffer;
    }
    
    /**
     * Apply spectral gating for noise reduction.
     */
    applySpectralGating(inputData, outputData, options) {
        const { fftSize, hopSize, amount, noiseProfile, mode } = options;
        const length = inputData.length;
        
        // Initialize output
        outputData.fill(0);
        
        // Window function
        const window = this.createHannWindow(fftSize);
        const windowSum = new Float32Array(length);
        windowSum.fill(0);
        
        const numFrames = Math.floor((length - fftSize) / hopSize) + 1;
        
        // Estimate noise floor if no profile
        let noiseFloor = noiseProfile;
        if (!noiseFloor && mode !== NoiseReductionMode.PROFILE) {
            // Use first few frames as noise estimate
            noiseFloor = this.estimateNoiseFloor(inputData, fftSize, 5);
        }
        
        // Process each frame
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * hopSize;
            
            // Extract and window frame
            const frameData = new Float32Array(fftSize);
            for (let i = 0; i < fftSize; i++) {
                const idx = startSample + i;
                if (idx < length) {
                    frameData[i] = inputData[idx] * window[i];
                }
            }
            
            // FFT
            const fftResult = this.computeRealFFT(frameData);
            const magnitudes = fftResult.magnitudes;
            const phases = fftResult.phases;
            
            // Apply noise reduction in frequency domain
            const threshold = amount * 0.1;
            
            for (let k = 0; k < magnitudes.length; k++) {
                const mag = magnitudes[k];
                
                // Get threshold from profile or estimated floor
                let gateThreshold = threshold;
                if (noiseFloor && k < noiseFloor.length) {
                    gateThreshold = noiseFloor[k] * (1 + amount);
                }
                
                // Spectral gating
                if (mag < gateThreshold) {
                    // Below threshold - reduce
                    const reductionFactor = 1 - amount * 0.9;
                    magnitudes[k] *= reductionFactor;
                } else {
                    // Above threshold - soft gating at the boundary
                    const ratio = mag / gateThreshold;
                    if (ratio < 2) {
                        magnitudes[k] *= (ratio / 2) * 0.5 + 0.5;
                    }
                }
            }
            
            // Inverse FFT
            const processedFrame = this.computeRealIFFT(magnitudes, phases);
            
            // Overlap-add
            for (let i = 0; i < fftSize; i++) {
                const idx = startSample + i;
                if (idx < length) {
                    outputData[idx] += processedFrame[i] * window[i];
                    windowSum[idx] += window[i] * window[i];
                }
            }
        }
        
        // Normalize
        for (let i = 0; i < length; i++) {
            if (windowSum[i] > 1e-8) {
                outputData[i] /= windowSum[i];
            }
        }
    }
    
    /**
     * Estimate noise floor from quiet sections.
     */
    estimateNoiseFloor(inputData, fftSize, numFrames) {
        const noiseFloor = new Float32Array(fftSize / 2 + 1);
        const length = inputData.length;
        const frameHop = Math.min(length / numFrames, fftSize);
        
        const window = this.createHannWindow(fftSize);
        
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * frameHop;
            
            const frameData = new Float32Array(fftSize);
            for (let i = 0; i < fftSize; i++) {
                const idx = startSample + i;
                if (idx < length) {
                    frameData[i] = inputData[idx] * window[i];
                }
            }
            
            const spectrum = this.computeFFTMagnitude(frameData);
            
            // Average
            for (let k = 0; k < spectrum.length; k++) {
                noiseFloor[k] += spectrum[k];
            }
        }
        
        for (let k = 0; k < noiseFloor.length; k++) {
            noiseFloor[k] /= numFrames;
        }
        
        return noiseFloor;
    }
    
    /**
     * Detect and remove clicks/pops from audio.
     * @param {AudioBuffer} buffer - Input audio buffer
     * @param {Object} options - Processing options
     * @returns {AudioBuffer} Processed audio buffer
     */
    applyClickRemoval(buffer, options = {}) {
        const {
            threshold = this.clickThreshold,
            sensitivity = this.clickSensitivity,
            windowSize = 32
        } = options;
        
        console.log('[AudioRestoration] Applying click removal, threshold:', threshold);
        
        const outputBuffer = this.audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        // Sensitivity multipliers
        const sensitivityMult = {
            [ClickSensitivity.LOW]: 1.5,
            [ClickSensitivity.MEDIUM]: 1.0,
            [ClickSensitivity.HIGH]: 0.7
        };
        
        const adjustedThreshold = threshold * sensitivityMult[sensitivity];
        
        // Process each channel
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const inputData = buffer.getChannelData(ch);
            const outputData = outputBuffer.getChannelData(ch);
            
            // Copy input to output
            outputData.set(inputData);
            
            // Detect clicks
            const clicks = this.detectClicks(inputData, adjustedThreshold, windowSize);
            
            // Repair clicks
            for (const click of clicks) {
                this.repairClick(outputData, click.position, click.width);
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Detect clicks in audio.
     */
    detectClicks(inputData, threshold, windowSize) {
        const clicks = [];
        const length = inputData.length;
        
        // Compute local energy and detect transients
        for (let i = windowSize; i < length - windowSize; i++) {
            // Calculate local RMS before and after
            let rmsBefore = 0;
            let rmsAfter = 0;
            
            for (let j = 1; j <= windowSize; j++) {
                rmsBefore += inputData[i - j] * inputData[i - j];
                rmsAfter += inputData[i + j] * inputData[i + j];
            }
            
            rmsBefore = Math.sqrt(rmsBefore / windowSize);
            rmsAfter = Math.sqrt(rmsAfter / windowSize);
            
            // Current sample magnitude
            const currentMag = Math.abs(inputData[i]);
            
            // Check for transient (sudden change)
            const avgLocal = (rmsBefore + rmsAfter) / 2;
            
            if (currentMag > avgLocal * threshold && currentMag > 0.1) {
                // Check if this is likely a click (not a legitimate transient)
                const ratio = currentMag / Math.max(avgLocal, 0.001);
                
                if (ratio > 10) {
                    // Very sudden spike - likely a click
                    clicks.push({
                        position: i,
                        width: Math.ceil(windowSize * 0.5),
                        magnitude: currentMag
                    });
                    
                    // Skip ahead to avoid detecting the same click multiple times
                    i += windowSize;
                }
            }
        }
        
        console.log('[AudioRestoration] Detected', clicks.length, 'clicks');
        return clicks;
    }
    
    /**
     * Repair a detected click using interpolation.
     */
    repairClick(outputData, position, width) {
        const halfWidth = Math.ceil(width / 2);
        const start = Math.max(0, position - halfWidth);
        const end = Math.min(outputData.length, position + halfWidth);
        
        // Linear interpolation to repair
        const startVal = outputData[start];
        const endVal = outputData[end - 1];
        const slope = (endVal - startVal) / (end - start - 1);
        
        for (let i = start; i < end; i++) {
            const t = (i - start) / (end - start - 1);
            // Smooth interpolation using cosine
            const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
            outputData[i] = startVal * (1 - smoothT) + endVal * smoothT;
        }
    }
    
    /**
     * Remove hum (50/60Hz and harmonics).
     * @param {AudioBuffer} buffer - Input audio buffer
     * @param {Object} options - Processing options
     * @returns {AudioBuffer} Processed audio buffer
     */
    applyHumRemoval(buffer, options = {}) {
        const {
            fundamentalFreq = this.humFrequency,
            numHarmonics = 5,
            bandwidth = 5,
            amount = 0.9
        } = options;
        
        console.log('[AudioRestoration] Applying hum removal at', fundamentalFreq, 'Hz');
        
        const outputBuffer = this.audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        const fftSize = 4096;
        const hopSize = fftSize / 4;
        
        // Process each channel
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const inputData = buffer.getChannelData(ch);
            const outputData = outputBuffer.getChannelData(ch);
            
            this.applyHumRemovalChannel(inputData, outputData, {
                fftSize,
                hopSize,
                fundamentalFreq,
                numHarmonics,
                bandwidth,
                amount,
                sampleRate: buffer.sampleRate
            });
        }
        
        return outputBuffer;
    }
    
    /**
     * Apply hum removal to a single channel.
     */
    applyHumRemovalChannel(inputData, outputData, options) {
        const { fftSize, hopSize, fundamentalFreq, numHarmonics, bandwidth, amount, sampleRate } = options;
        const length = inputData.length;
        
        outputData.fill(0);
        
        const window = this.createHannWindow(fftSize);
        const windowSum = new Float32Array(length);
        windowSum.fill(0);
        
        const binFreq = sampleRate / fftSize;
        
        const numFrames = Math.floor((length - fftSize) / hopSize) + 1;
        
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * hopSize;
            
            const frameData = new Float32Array(fftSize);
            for (let i = 0; i < fftSize; i++) {
                const idx = startSample + i;
                if (idx < length) {
                    frameData[i] = inputData[idx] * window[i];
                }
            }
            
            const fftResult = this.computeRealFFT(frameData);
            const magnitudes = fftResult.magnitudes;
            const phases = fftResult.phases;
            
            // Apply notch filters at fundamental and harmonics
            for (let harmonic = 1; harmonic <= numHarmonics; harmonic++) {
                const targetFreq = fundamentalFreq * harmonic;
                const targetBin = Math.round(targetFreq / binFreq);
                
                if (targetBin < magnitudes.length) {
                    // Create notch around this frequency
                    const notchWidth = Math.ceil(bandwidth / binFreq);
                    
                    for (let k = -notchWidth; k <= notchWidth; k++) {
                        const bin = targetBin + k;
                        if (bin >= 0 && bin < magnitudes.length) {
                            // Gaussian notch
                            const dist = Math.abs(k) / notchWidth;
                            const notchAmount = amount * Math.exp(-dist * dist * 2);
                            magnitudes[bin] *= (1 - notchAmount);
                        }
                    }
                }
            }
            
            const processedFrame = this.computeRealIFFT(magnitudes, phases);
            
            for (let i = 0; i < fftSize; i++) {
                const idx = startSample + i;
                if (idx < length) {
                    outputData[idx] += processedFrame[i] * window[i];
                    windowSum[idx] += window[i] * window[i];
                }
            }
        }
        
        for (let i = 0; i < length; i++) {
            if (windowSum[i] > 1e-8) {
                outputData[i] /= windowSum[i];
            }
        }
    }
    
    /**
     * Apply de-essing to reduce sibilance.
     * @param {AudioBuffer} buffer - Input audio buffer
     * @param {Object} options - Processing options
     * @returns {AudioBuffer} Processed audio buffer
     */
    applyDeEssing(buffer, options = {}) {
        const {
            frequency = this.deEsserFrequency,
            threshold = -20, // dB
            amount = this.deEsserAmount,
            bandwidth = 2000
        } = options;
        
        console.log('[AudioRestoration] Applying de-essing at', frequency, 'Hz');
        
        const outputBuffer = this.audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        const fftSize = 2048;
        const hopSize = fftSize / 4;
        
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const inputData = buffer.getChannelData(ch);
            const outputData = outputBuffer.getChannelData(ch);
            
            this.applyDeEssingChannel(inputData, outputData, {
                fftSize,
                hopSize,
                frequency,
                threshold,
                amount,
                bandwidth,
                sampleRate: buffer.sampleRate
            });
        }
        
        return outputBuffer;
    }
    
    /**
     * Apply de-essing to a single channel.
     */
    applyDeEssingChannel(inputData, outputData, options) {
        const { fftSize, hopSize, frequency, threshold, amount, bandwidth, sampleRate } = options;
        const length = inputData.length;
        
        outputData.fill(0);
        
        const window = this.createHannWindow(fftSize);
        const windowSum = new Float32Array(length);
        windowSum.fill(0);
        
        const binFreq = sampleRate / fftSize;
        const centerBin = Math.round(frequency / binFreq);
        const binWidth = Math.round(bandwidth / binFreq / 2);
        
        const thresholdLinear = Math.pow(10, threshold / 20);
        
        const numFrames = Math.floor((length - fftSize) / hopSize) + 1;
        
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * hopSize;
            
            const frameData = new Float32Array(fftSize);
            for (let i = 0; i < fftSize; i++) {
                const idx = startSample + i;
                if (idx < length) {
                    frameData[i] = inputData[idx] * window[i];
                }
            }
            
            const fftResult = this.computeRealFFT(frameData);
            const magnitudes = fftResult.magnitudes;
            const phases = fftResult.phases;
            
            // Calculate sibilance energy
            let sibilanceEnergy = 0;
            let totalCount = 0;
            
            for (let k = centerBin - binWidth; k <= centerBin + binWidth; k++) {
                if (k >= 0 && k < magnitudes.length) {
                    sibilanceEnergy += magnitudes[k] * magnitudes[k];
                    totalCount++;
                }
            }
            
            const avgSibilance = Math.sqrt(sibilanceEnergy / totalCount) * fftSize;
            
            // Apply reduction if above threshold
            if (avgSibilance > thresholdLinear) {
                const reductionAmount = Math.min(amount, (avgSibilance - thresholdLinear) / avgSibilance);
                
                for (let k = centerBin - binWidth; k <= centerBin + binWidth; k++) {
                    if (k >= 0 && k < magnitudes.length) {
                        // Soft knee reduction
                        const dist = Math.abs(k - centerBin) / binWidth;
                        const knee = Math.exp(-dist * dist * 2);
                        magnitudes[k] *= (1 - reductionAmount * knee * 0.8);
                    }
                }
            }
            
            const processedFrame = this.computeRealIFFT(magnitudes, phases);
            
            for (let i = 0; i < fftSize; i++) {
                const idx = startSample + i;
                if (idx < length) {
                    outputData[idx] += processedFrame[i] * window[i];
                    windowSum[idx] += window[i] * window[i];
                }
            }
        }
        
        for (let i = 0; i < length; i++) {
            if (windowSum[i] > 1e-8) {
                outputData[i] /= windowSum[i];
            }
        }
    }
    
    /**
     * Apply full restoration chain.
     * @param {AudioBuffer} buffer - Input audio buffer
     * @param {Object} options - Processing options
     * @returns {AudioBuffer} Processed audio buffer
     */
    applyFullRestoration(buffer, options = {}) {
        const {
            noiseReduction = true,
            noiseReductionAmount = this.noiseReductionAmount,
            clickRemoval = true,
            clickThreshold = this.clickThreshold,
            humRemoval = true,
            humFrequency = this.humFrequency,
            deEssing = false,
            deEssingAmount = this.deEsserAmount
        } = options;
        
        console.log('[AudioRestoration] Applying full restoration chain');
        
        let currentBuffer = buffer;
        
        // Apply in order: clicks first, then hum, then noise, then de-essing
        if (clickRemoval) {
            currentBuffer = this.applyClickRemoval(currentBuffer, { threshold: clickThreshold });
        }
        
        if (humRemoval) {
            currentBuffer = this.applyHumRemoval(currentBuffer, { fundamentalFreq: humFrequency });
        }
        
        if (noiseReduction) {
            currentBuffer = this.applyNoiseReduction(currentBuffer, { amount: noiseReductionAmount });
        }
        
        if (deEssing) {
            currentBuffer = this.applyDeEssing(currentBuffer, { amount: deEssingAmount });
        }
        
        return currentBuffer;
    }
    
    // === Helper methods ===
    
    /**
     * Create Hann window.
     */
    createHannWindow(size) {
        const window = new Float32Array(size);
        for (let n = 0; n < size; n++) {
            window[n] = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (size - 1)));
        }
        return window;
    }
    
    /**
     * Apply Hann window to signal.
     */
    applyHannWindow(signal) {
        const N = signal.length;
        const windowed = new Float32Array(N);
        for (let n = 0; n < N; n++) {
            const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
            windowed[n] = signal[n] * w;
        }
        return windowed;
    }
    
    /**
     * Compute FFT magnitude.
     */
    computeFFTMagnitude(signal) {
        const N = signal.length;
        const numBins = Math.floor(N / 2) + 1;
        const magnitudes = new Float32Array(numBins);
        
        for (let k = 0; k < numBins; k++) {
            let real = 0;
            let imag = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                real += signal[n] * Math.cos(angle);
                imag -= signal[n] * Math.sin(angle);
            }
            
            magnitudes[k] = Math.sqrt(real * real + imag * imag) / N;
        }
        
        return magnitudes;
    }
    
    /**
     * Compute real-valued FFT.
     */
    computeRealFFT(signal) {
        const N = signal.length;
        const numBins = Math.floor(N / 2) + 1;
        const magnitudes = new Float32Array(numBins);
        const phases = new Float32Array(numBins);
        
        for (let k = 0; k < numBins; k++) {
            let real = 0;
            let imag = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                real += signal[n] * Math.cos(angle);
                imag -= signal[n] * Math.sin(angle);
            }
            
            magnitudes[k] = Math.sqrt(real * real + imag * imag) / N;
            phases[k] = Math.atan2(imag, real);
        }
        
        return { magnitudes, phases };
    }
    
    /**
     * Compute real-valued inverse FFT.
     */
    computeRealIFFT(magnitudes, phases) {
        const numBins = magnitudes.length;
        const N = (numBins - 1) * 2;
        const signal = new Float32Array(N);
        
        for (let n = 0; n < N; n++) {
            let sum = 0;
            
            for (let k = 0; k < numBins; k++) {
                const angle = (2 * Math.PI * k * n) / N;
                const mag = magnitudes[k] * N;
                sum += mag * Math.cos(angle + phases[k]);
            }
            
            signal[n] = sum / N;
        }
        
        return signal;
    }
    
    /**
     * Dispose resources.
     */
    dispose() {
        this.audioContext = null;
        this.noiseProfileData = null;
        this.noiseProfileLearned = false;
        console.log('[AudioRestoration] Disposed');
    }
}

/**
 * Create audio restoration instance.
 */
export function createAudioRestoration(options = {}) {
    return new AudioRestoration(options);
}

// Default export
export default {
    NoiseReductionMode,
    ClickSensitivity,
    HumFrequency,
    AudioRestoration,
    createAudioRestoration
};