// js/AudioSpectralEditor.js - Audio Spectral Editor for SnugOS DAW
// This module provides visual frequency spectrum editing for audio manipulation

/**
 * AudioSpectralEditor provides a visual interface for editing audio in the frequency domain.
 * 
 * Features:
 * - Real-time FFT spectrum visualization
 * - Frequency band selection and editing
 * - Spectral processing (EQ, filtering, noise reduction)
 * - Spectrum freeze and draw modes
 * - Harmonic analysis and manipulation
 */

/**
 * Spectral processing modes
 */
export const SpectralMode = {
    VIEW: 'view',           // View spectrum only
    EQ: 'eq',               // EQ mode - adjust frequency bands
    FILTER: 'filter',       // Filter mode - draw filter curves
    FREEZE: 'freeze',       // Freeze spectrum for editing
    DRAW: 'draw',           // Draw spectrum directly
    ANALYZE: 'analyze'      // Harmonic analysis
};

/**
 * FFT window types
 */
export const FFTWindow = {
    RECTANGULAR: 'rectangular',
    HANN: 'hann',
    HAMMING: 'hamming',
    BLACKMAN: 'blackman',
    BLACKMAN_HARRIS: 'blackman-harris'
};

/**
 * SpectralEditor - Main class for spectral editing
 */
export class SpectralEditor {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = options.sampleRate || 44100;
        this.fftSize = options.fftSize || 2048;
        this.hopSize = options.hopSize || 512;
        this.windowType = options.windowType || FFTWindow.HANN;
        
        // Canvas elements
        this.spectrumCanvas = null;
        this.spectrogramCanvas = null;
        this.spectrumCtx = null;
        this.spectrogramCtx = null;
        
        // Spectrum data
        this.frequencyData = new Float32Array(this.fftSize / 2);
        this.timeDomainData = new Float32Array(this.fftSize);
        this.spectrogramHistory = [];
        const maxHistory = options.maxSpectrogramHistory || 200;
        
        // Editing state
        this.mode = SpectralMode.VIEW;
        this.currentBuffer = null;
        this.selection = null; // { startFreq, endFreq, startTime, endTime }
        
        // EQ bands
        this.eqBands = [];
        this.initializeDefaultEQBands();
        
        // Analysis nodes
        this.analyserNode = null;
        this.sourceNode = null;
        
        // Callbacks
        this.onSpectrumUpdate = options.onSpectrumUpdate || null;
        this.onSelectionChange = options.onSelectionChange || null;
        
        // Display settings
        this.freqMin = options.freqMin || 20;
        this.freqMax = options.freqMax || 20000;
        this.dbMin = options.dbMin || -100;
        this.dbMax = options.dbMax || 0;
        
        this.isInitialized = false;
    }
    
    /**
     * Initialize the spectral editor with audio context.
     * @param {AudioContext} audioContext - Audio context
     * @returns {boolean} True if initialized
     */
    initialize(audioContext) {
        if (this.isInitialized) return true;
        
        try {
            this.audioContext = audioContext;
            this.sampleRate = audioContext.sampleRate;
            
            // Create analyser node
            this.analyserNode = audioContext.createAnalyser();
            this.analyserNode.fftSize = this.fftSize;
            this.analyserNode.smoothingTimeConstant = 0.8;
            
            // Initialize arrays
            this.frequencyData = new Float32Array(this.analyserNode.frequencyBinCount);
            this.timeDomainData = new Float32Array(this.analyserNode.fftSize);
            
            this.isInitialized = true;
            console.log('[SpectralEditor] Initialized');
            return true;
        } catch (e) {
            console.error('[SpectralEditor] Initialization failed:', e);
            return false;
        }
    }
    
    /**
     * Initialize default EQ bands (10-band EQ).
     */
    initializeDefaultEQBands() {
        const frequencies = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        this.eqBands = frequencies.map((freq, index) => ({
            id: `eq_${index}`,
            frequency: freq,
            gain: 0,           // dB
            Q: 1.0,
            type: 'peaking',
            enabled: true
        }));
    }
    
    /**
     * Set up canvases for visualization.
     * @param {HTMLCanvasElement} spectrumCanvas - Spectrum display canvas
     * @param {HTMLCanvasElement} spectrogramCanvas - Spectrogram display canvas
     */
    setCanvases(spectrumCanvas, spectrogramCanvas = null) {
        this.spectrumCanvas = spectrumCanvas;
        this.spectrumCtx = spectrumCanvas.getContext('2d');
        
        if (spectrogramCanvas) {
            this.spectrogramCanvas = spectrogramCanvas;
            this.spectrogramCtx = spectrogramCanvas.getContext('2d');
        }
        
        console.log('[SpectralEditor] Canvases set');
    }
    
    /**
     * Connect an audio source for analysis.
     * @param {AudioNode} source - Audio source node
     */
    connectSource(source) {
        if (!this.analyserNode) {
            console.error('[SpectralEditor] Not initialized');
            return;
        }
        
        // Disconnect previous source
        if (this.sourceNode) {
            this.sourceNode.disconnect(this.analyserNode);
        }
        
        this.sourceNode = source;
        source.connect(this.analyserNode);
        console.log('[SpectralEditor] Source connected');
    }
    
    /**
     * Disconnect current source.
     */
    disconnectSource() {
        if (this.sourceNode && this.analyserNode) {
            this.sourceNode.disconnect(this.analyserNode);
            this.sourceNode = null;
            console.log('[SpectralEditor] Source disconnected');
        }
    }
    
    /**
     * Get current spectrum data.
     * @returns {Float32Array} Frequency data in dB
     */
    getSpectrum() {
        if (!this.analyserNode) return this.frequencyData;
        
        this.analyserNode.getFloatFrequencyData(this.frequencyData);
        return this.frequencyData;
    }
    
    /**
     * Get current waveform data.
     * @returns {Float32Array} Time domain data
     */
    getWaveform() {
        if (!this.analyserNode) return this.timeDomainData;
        
        this.analyserNode.getFloatTimeDomainData(this.timeDomainData);
        return this.timeDomainData;
    }
    
    /**
     * Analyze an audio buffer.
     * @param {AudioBuffer} buffer - Audio buffer to analyze
     * @returns {Object} Analysis results
     */
    analyzeBuffer(buffer) {
        const channelData = buffer.getChannelData(0);
        const results = {
            duration: buffer.duration,
            sampleRate: buffer.sampleRate,
            length: buffer.length,
            peakAmplitude: 0,
            rmsAmplitude: 0,
            spectrum: null,
            spectrogram: [],
            harmonics: []
        };
        
        // Calculate peak and RMS
        let sumSquares = 0;
        for (let i = 0; i < channelData.length; i++) {
            const abs = Math.abs(channelData[i]);
            if (abs > results.peakAmplitude) {
                results.peakAmplitude = abs;
            }
            sumSquares += channelData[i] * channelData[i];
        }
        results.rmsAmplitude = Math.sqrt(sumSquares / channelData.length);
        
        // Calculate spectrum (simple FFT for the first segment)
        const fftSize = Math.min(this.fftSize, channelData.length);
        const segment = channelData.slice(0, fftSize);
        results.spectrum = this.computeSpectrum(segment);
        
        // Calculate spectrogram (STFT)
        const numSegments = Math.floor(channelData.length / this.hopSize);
        for (let i = 0; i < Math.min(numSegments, 200); i++) {
            const start = i * this.hopSize;
            const segment = channelData.slice(start, start + this.fftSize);
            const spectrum = this.computeSpectrum(segment);
            results.spectrogram.push(spectrum);
        }
        
        // Detect harmonics
        results.harmonics = this.detectHarmonics(results.spectrum);
        
        console.log('[SpectralEditor] Buffer analyzed');
        return results;
    }
    
    /**
     * Compute spectrum for a signal segment.
     * @param {Float32Array} signal - Signal data
     * @returns {Float32Array} Spectrum magnitudes
     */
    computeSpectrum(signal) {
        const N = signal.length;
        const spectrum = new Float32Array(N / 2);
        
        // Apply window function
        const windowed = this.applyWindow(signal);
        
        // Simple DFT (for real FFT, would use FFT library)
        for (let k = 0; k < N / 2; k++) {
            let real = 0;
            let imag = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                real += windowed[n] * Math.cos(angle);
                imag -= windowed[n] * Math.sin(angle);
            }
            
            spectrum[k] = Math.sqrt(real * real + imag * imag) / N;
        }
        
        return spectrum;
    }
    
    /**
     * Apply window function to signal.
     * @param {Float32Array} signal - Signal data
     * @returns {Float32Array} Windowed signal
     */
    applyWindow(signal) {
        const N = signal.length;
        const windowed = new Float32Array(N);
        
        for (let n = 0; n < N; n++) {
            let w = 1;
            
            switch (this.windowType) {
                case FFTWindow.HANN:
                    w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
                    break;
                case FFTWindow.HAMMING:
                    w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
                    break;
                case FFTWindow.BLACKMAN:
                    w = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) + 
                        0.08 * Math.cos((4 * Math.PI * n) / (N - 1));
                    break;
                case FFTWindow.BLACKMAN_HARRIS:
                    w = 0.35875 - 0.48829 * Math.cos((2 * Math.PI * n) / (N - 1)) +
                        0.14128 * Math.cos((4 * Math.PI * n) / (N - 1)) -
                        0.01168 * Math.cos((6 * Math.PI * n) / (N - 1));
                    break;
                default: // RECTANGULAR
                    w = 1;
            }
            
            windowed[n] = signal[n] * w;
        }
        
        return windowed;
    }
    
    /**
     * Detect harmonics in spectrum.
     * @param {Float32Array} spectrum - Spectrum data
     * @returns {Array} Array of harmonic frequencies and amplitudes
     */
    detectHarmonics(spectrum) {
        const harmonics = [];
        const binWidth = this.sampleRate / (spectrum.length * 2);
        
        // Find peaks
        for (let i = 2; i < spectrum.length - 2; i++) {
            const freq = i * binWidth;
            
            // Check if this is a local maximum
            if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1] &&
                spectrum[i] > spectrum[i - 2] && spectrum[i] > spectrum[i + 2] &&
                spectrum[i] > 0.01) { // Threshold
                
                harmonics.push({
                    frequency: freq,
                    amplitude: spectrum[i],
                    bin: i
                });
            }
        }
        
        // Sort by amplitude
        harmonics.sort((a, b) => b.amplitude - a.amplitude);
        
        // Return top harmonics
        return harmonics.slice(0, 10);
    }
    
    /**
     * Draw spectrum visualization.
     */
    drawSpectrum() {
        if (!this.spectrumCtx || !this.spectrumCanvas) return;
        
        const ctx = this.spectrumCtx;
        const width = this.spectrumCanvas.width;
        const height = this.spectrumCanvas.height;
        
        // Clear
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // Get spectrum data
        const spectrum = this.getSpectrum();
        
        // Draw frequency grid
        this.drawFrequencyGrid(ctx, width, height);
        
        // Draw spectrum
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        
        const binCount = spectrum.length;
        const binWidth = this.sampleRate / (binCount * 2);
        
        for (let i = 0; i < binCount; i++) {
            const freq = i * binWidth;
            
            // Log frequency scale
            const x = this.freqToX(freq, width);
            
            // Convert to dB and scale
            const db = Math.max(this.dbMin, Math.min(this.dbMax, spectrum[i]));
            const y = this.dbToY(db, height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Draw selection if exists
        if (this.selection) {
            this.drawSelection(ctx, width, height);
        }
        
        // Call update callback
        if (this.onSpectrumUpdate) {
            this.onSpectrumUpdate(spectrum);
        }
    }
    
    /**
     * Draw spectrogram (time-frequency visualization).
     */
    drawSpectrogram() {
        if (!this.spectrogramCtx || !this.spectrogramCanvas) return;
        
        const ctx = this.spectrogramCtx;
        const width = this.spectrogramCanvas.width;
        const height = this.spectrogramCanvas.height;
        
        // Get current spectrum and add to history
        const spectrum = this.getSpectrum();
        this.spectrogramHistory.push(new Float32Array(spectrum));
        
        // Limit history
        if (this.spectrogramHistory.length > this.maxSpectrogramHistory) {
            this.spectrogramHistory.shift();
        }
        
        // Scroll existing content
        const imageData = ctx.getImageData(1, 0, width - 1, height);
        ctx.putImageData(imageData, 0, 0);
        
        // Draw new column
        const binCount = spectrum.length;
        const binWidth = this.sampleRate / (binCount * 2);
        
        for (let i = 0; i < binCount; i++) {
            const freq = i * binWidth;
            const y = this.freqToY(freq, height);
            
            // Convert to dB and map to color
            const db = Math.max(this.dbMin, Math.min(this.dbMax, spectrum[i]));
            const normalized = (db - this.dbMin) / (this.dbMax - this.dbMin);
            
            ctx.fillStyle = this.dbToColor(normalized);
            ctx.fillRect(width - 2, y, 2, 2);
        }
    }
    
    /**
     * Draw frequency grid lines.
     */
    drawFrequencyGrid(ctx, width, height) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#666';
        
        // Frequency lines (log scale)
        const frequencies = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        
        for (const freq of frequencies) {
            if (freq >= this.freqMin && freq <= this.freqMax) {
                const x = this.freqToX(freq, width);
                
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
                
                // Label
                const label = freq >= 1000 ? `${freq/1000}k` : freq;
                ctx.fillText(label, x + 2, height - 5);
            }
        }
        
        // dB lines
        const dbLevels = [-20, -40, -60, -80];
        
        for (const db of dbLevels) {
            if (db >= this.dbMin && db <= this.dbMax) {
                const y = this.dbToY(db, height);
                
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
                
                ctx.fillText(`${db}dB`, 5, y - 2);
            }
        }
    }
    
    /**
     * Draw selection rectangle.
     */
    drawSelection(ctx, width, height) {
        if (!this.selection) return;
        
        const x1 = this.freqToX(this.selection.startFreq, width);
        const x2 = this.freqToX(this.selection.endFreq, width);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.fillRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), height);
        
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), height);
    }
    
    /**
     * Convert frequency to X coordinate.
     */
    freqToX(freq, width) {
        const logMin = Math.log10(this.freqMin);
        const logMax = Math.log10(this.freqMax);
        const logFreq = Math.log10(Math.max(this.freqMin, Math.min(this.freqMax, freq)));
        return ((logFreq - logMin) / (logMax - logMin)) * width;
    }
    
    /**
     * Convert X coordinate to frequency.
     */
    xToFreq(x, width) {
        const logMin = Math.log10(this.freqMin);
        const logMax = Math.log10(this.freqMax);
        const logFreq = logMin + (x / width) * (logMax - logMin);
        return Math.pow(10, logFreq);
    }
    
    /**
     * Convert frequency to Y coordinate (for spectrogram).
     */
    freqToY(freq, height) {
        const logMin = Math.log10(this.freqMin);
        const logMax = Math.log10(this.freqMax);
        const logFreq = Math.log10(Math.max(this.freqMin, Math.min(this.freqMax, freq)));
        return height - ((logFreq - logMin) / (logMax - logMin)) * height;
    }
    
    /**
     * Convert dB to Y coordinate.
     */
    dbToY(db, height) {
        const normalized = (db - this.dbMin) / (this.dbMax - this.dbMin);
        return height - normalized * height;
    }
    
    /**
     * Convert normalized value to color.
     */
    dbToColor(normalized) {
        // Blue to red gradient
        const r = Math.floor(normalized * 255);
        const g = Math.floor(normalized * 100);
        const b = Math.floor((1 - normalized) * 255);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    /**
     * Set selection by frequency range.
     */
    setSelection(startFreq, endFreq) {
        this.selection = {
            startFreq: Math.min(startFreq, endFreq),
            endFreq: Math.max(startFreq, endFreq)
        };
        
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selection);
        }
    }
    
    /**
     * Clear selection.
     */
    clearSelection() {
        this.selection = null;
        
        if (this.onSelectionChange) {
            this.onSelectionChange(null);
        }
    }
    
    /**
     * Set EQ band gain.
     * @param {number} bandIndex - Band index
     * @param {number} gain - Gain in dB
     */
    setEQBandGain(bandIndex, gain) {
        if (bandIndex >= 0 && bandIndex < this.eqBands.length) {
            this.eqBands[bandIndex].gain = Math.max(-24, Math.min(24, gain));
            console.log(`[SpectralEditor] EQ band ${bandIndex} gain: ${gain}dB`);
        }
    }
    
    /**
     * Toggle EQ band enabled.
     * @param {number} bandIndex - Band index
     */
    toggleEQBand(bandIndex) {
        if (bandIndex >= 0 && bandIndex < this.eqBands.length) {
            this.eqBands[bandIndex].enabled = !this.eqBands[bandIndex].enabled;
        }
    }
    
    /**
     * Get EQ bands.
     * @returns {Array} EQ bands
     */
    getEQBands() {
        return [...this.eqBands];
    }
    
    /**
     * Apply spectral processing to audio buffer.
     * @param {AudioBuffer} buffer - Audio buffer
     * @param {Object} processing - Processing options
     * @returns {AudioBuffer} Processed buffer
     */
    processBuffer(buffer, processing = {}) {
        console.log('[SpectralEditor] Processing buffer with options:', processing);
        
        const {
            applyEQ = true,
            applyFilter = false,
            filterType = 'lowpass',
            filterCutoff = 20000,
            applyNoiseReduction = false,
            noiseReductionAmount = 0.5,
            applyGain = false,
            gainAmount = 1.0,
            frequencySelection = null // { startFreq, endFreq, action: 'boost'|'cut'|'mute' }
        } = processing;
        
        // Get audio context or create offline context
        const audioContext = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = buffer.sampleRate;
        const numChannels = buffer.numberOfChannels;
        const length = buffer.length;
        
        // Create output buffer
        const outputBuffer = audioContext.createBuffer(numChannels, length, sampleRate);
        
        // Process each channel
        for (let ch = 0; ch < numChannels; ch++) {
            const inputData = buffer.getChannelData(ch);
            const outputData = outputBuffer.getChannelData(ch);
            
            // Perform STFT processing
            this.processChannelSTFT(inputData, outputData, sampleRate, {
                applyEQ,
                eqBands: this.eqBands,
                applyFilter,
                filterType,
                filterCutoff,
                applyNoiseReduction,
                noiseReductionAmount,
                applyGain,
                gainAmount,
                frequencySelection,
                fftSize: this.fftSize,
                hopSize: this.hopSize,
                windowType: this.windowType
            });
        }
        
        console.log('[SpectralEditor] Buffer processing complete');
        return outputBuffer;
    }
    
    /**
     * Process a single channel using STFT.
     * @param {Float32Array} inputData - Input channel data
     * @param {Float32Array} outputData - Output channel data
     * @param {number} sampleRate - Sample rate
     * @param {Object} options - Processing options
     */
    processChannelSTFT(inputData, outputData, sampleRate, options) {
        const {
            fftSize = 2048,
            hopSize = 512,
            windowType = FFTWindow.HANN,
            applyEQ = false,
            eqBands = [],
            applyFilter = false,
            filterType = 'lowpass',
            filterCutoff = 20000,
            applyNoiseReduction = false,
            noiseReductionAmount = 0.5,
            applyGain = false,
            gainAmount = 1.0,
            frequencySelection = null
        } = options;
        
        const N = fftSize;
        const hop = hopSize;
        const length = inputData.length;
        
        // Initialize output with zeros
        outputData.fill(0);
        
        // Create window function
        const window = this.createWindow(N, windowType);
        
        // Create overlap-add buffer for normalization
        const windowSum = new Float32Array(length);
        windowSum.fill(0);
        
        // Calculate number of frames
        const numFrames = Math.floor((length - N) / hop) + 1;
        
        // Process each frame
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * hop;
            
            // Extract frame with window
            const frameData = new Float32Array(N);
            for (let i = 0; i < N; i++) {
                if (startSample + i < length) {
                    frameData[i] = inputData[startSample + i] * window[i];
                }
            }
            
            // Compute FFT (using real-valued FFT)
            const fftResult = this.computeRealFFT(frameData);
            const magnitudes = fftResult.magnitudes;
            const phases = fftResult.phases;
            
            // Apply processing in frequency domain
            const binFreq = sampleRate / N;
            
            for (let k = 0; k < magnitudes.length; k++) {
                const freq = k * binFreq;
                
                // Apply EQ
                if (applyEQ && eqBands.length > 0) {
                    let totalGain = 1.0;
                    for (const band of eqBands) {
                        if (band.enabled) {
                            const bandGain = this.calculateEQGain(freq, band);
                            totalGain *= bandGain;
                        }
                    }
                    magnitudes[k] *= totalGain;
                }
                
                // Apply filter
                if (applyFilter) {
                    const filterGain = this.calculateFilterGain(freq, filterType, filterCutoff, sampleRate);
                    magnitudes[k] *= filterGain;
                }
                
                // Apply noise reduction (spectral gating)
                if (applyNoiseReduction) {
                    const threshold = noiseReductionAmount * 0.1; // Noise floor estimation
                    if (magnitudes[k] < threshold) {
                        // Reduce low-level noise
                        magnitudes[k] *= (1 - noiseReductionAmount * 0.8);
                    }
                }
                
                // Apply frequency selection processing
                if (frequencySelection) {
                    const { startFreq, endFreq, action } = frequencySelection;
                    if (freq >= startFreq && freq <= endFreq) {
                        if (action === 'mute') {
                            magnitudes[k] = 0;
                        } else if (action === 'cut') {
                            magnitudes[k] *= 0.25;
                        } else if (action === 'boost') {
                            magnitudes[k] *= 2.0;
                        }
                    }
                }
                
                // Apply overall gain
                if (applyGain) {
                    magnitudes[k] *= gainAmount;
                }
            }
            
            // Compute inverse FFT
            const processedFrame = this.computeRealIFFT(magnitudes, phases);
            
            // Overlap-add with window
            for (let i = 0; i < N; i++) {
                const outIdx = startSample + i;
                if (outIdx < length) {
                    outputData[outIdx] += processedFrame[i] * window[i];
                    windowSum[outIdx] += window[i] * window[i];
                }
            }
        }
        
        // Normalize by window sum (for overlap-add)
        for (let i = 0; i < length; i++) {
            if (windowSum[i] > 1e-8) {
                outputData[i] /= windowSum[i];
            }
        }
    }
    
    /**
     * Create window function.
     * @param {number} size - Window size
     * @param {string} type - Window type
     * @returns {Float32Array} Window values
     */
    createWindow(size, type) {
        const window = new Float32Array(size);
        const N = size;
        
        for (let n = 0; n < N; n++) {
            let w = 1;
            
            switch (type) {
                case FFTWindow.HANN:
                    w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
                    break;
                case FFTWindow.HAMMING:
                    w = 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1));
                    break;
                case FFTWindow.BLACKMAN:
                    w = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)) +
                        0.08 * Math.cos((4 * Math.PI * n) / (N - 1));
                    break;
                case FFTWindow.BLACKMAN_HARRIS:
                    w = 0.35875 - 0.48829 * Math.cos((2 * Math.PI * n) / (N - 1)) +
                        0.14128 * Math.cos((4 * Math.PI * n) / (N - 1)) -
                        0.01168 * Math.cos((6 * Math.PI * n) / (N - 1));
                    break;
                default: // RECTANGULAR
                    w = 1;
            }
            
            window[n] = w;
        }
        
        return window;
    }
    
    /**
     * Compute real-valued FFT (simplified DFT for real signals).
     * @param {Float32Array} signal - Input signal (real values only)
     * @returns {Object} { magnitudes, phases }
     */
    computeRealFFT(signal) {
        const N = signal.length;
        const numBins = Math.floor(N / 2) + 1;
        const magnitudes = new Float32Array(numBins);
        const phases = new Float32Array(numBins);
        
        // Simplified DFT for real input
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
     * @param {Float32Array} magnitudes - Frequency magnitudes
     * @param {Float32Array} phases - Frequency phases
     * @returns {Float32Array} Reconstructed signal
     */
    computeRealIFFT(magnitudes, phases) {
        const numBins = magnitudes.length;
        const N = (numBins - 1) * 2; // Reconstruct original size
        const signal = new Float32Array(N);
        
        // Simplified IDFT
        for (let n = 0; n < N; n++) {
            let sum = 0;
            
            for (let k = 0; k < numBins; k++) {
                const angle = (2 * Math.PI * k * n) / N;
                const mag = magnitudes[k] * N; // Scale back
                sum += mag * Math.cos(angle + phases[k]);
            }
            
            signal[n] = sum / N;
        }
        
        return signal;
    }
    
    /**
     * Calculate EQ gain for a frequency.
     * @param {number} freq - Frequency in Hz
     * @param {Object} band - EQ band parameters
     * @returns {number} Linear gain
     */
    calculateEQGain(freq, band) {
        const { frequency, gain, Q, type } = band;
        
        // Convert dB gain to linear
        const linearGain = Math.pow(10, gain / 20);
        
        // Calculate frequency response based on filter type
        const ratio = freq / frequency;
        
        switch (type) {
            case 'peaking': {
                // Peaking EQ - bell curve centered at frequency
                const bandwidth = frequency / Q;
                const distance = Math.abs(freq - frequency) / (bandwidth / 2);
                const response = 1 + (linearGain - 1) * Math.exp(-distance * distance);
                return response;
            }
            case 'lowshelf': {
                // Low shelf - boost/cut below frequency
                if (freq < frequency / 2) return linearGain;
                if (freq > frequency * 2) return 1.0;
                const t = (Math.log2(freq / frequency) + 1) / 2;
                return 1 + (linearGain - 1) * (1 - t);
            }
            case 'highshelf': {
                // High shelf - boost/cut above frequency
                if (freq > frequency * 2) return linearGain;
                if (freq < frequency / 2) return 1.0;
                const t = (Math.log2(freq / frequency) - 1) / 2;
                return 1 + (linearGain - 1) * t;
            }
            case 'lowpass': {
                // Low pass - pass below frequency
                if (freq < frequency) return 1.0;
                const rolloff = Math.pow(2, -((freq / frequency) - 1) * Q);
                return rolloff;
            }
            case 'highpass': {
                // High pass - pass above frequency
                if (freq > frequency) return 1.0;
                const rolloff = Math.pow(2, -((frequency / freq) - 1) * Q);
                return rolloff;
            }
            case 'notch': {
                // Notch - cut at frequency
                const distance = Math.abs(freq - frequency) / (frequency / Q);
                return distance < 0.5 ? 0.1 : 1.0;
            }
            default:
                return 1.0;
        }
    }
    
    /**
     * Calculate filter gain for a frequency.
     * @param {number} freq - Frequency in Hz
     * @param {string} filterType - Filter type
     * @param {number} cutoff - Cutoff frequency
     * @param {number} sampleRate - Sample rate
     * @returns {number} Linear gain (0-1)
     */
    calculateFilterGain(freq, filterType, cutoff, sampleRate) {
        const ratio = freq / cutoff;
        
        switch (filterType) {
            case 'lowpass': {
                // Butterworth-like lowpass
                if (freq < cutoff) return 1.0;
                return 1 / (1 + Math.pow(ratio, 4));
            }
            case 'highpass': {
                // Butterworth-like highpass
                if (freq > cutoff) return 1.0;
                return 1 / (1 + Math.pow(1 / ratio, 4));
            }
            case 'bandpass': {
                // Bandpass (Q = 1)
                const bandwidth = cutoff * 0.5;
                const distance = Math.abs(freq - cutoff) / bandwidth;
                return Math.exp(-distance * distance);
            }
            case 'notch': {
                // Notch filter
                const bandwidth = cutoff * 0.1;
                const distance = Math.abs(freq - cutoff) / bandwidth;
                return 1 - Math.exp(-distance * distance) * 0.95;
            }
            default:
                return 1.0;
        }
    }
    
    /**
     * Set display mode.
     * @param {string} mode - SpectralMode value
     */
    setMode(mode) {
        this.mode = mode;
        console.log(`[SpectralEditor] Mode set to: ${mode}`);
    }
    
    /**
     * Dispose of resources.
     */
    dispose() {
        this.disconnectSource();
        this.analyserNode = null;
        this.spectrumCanvas = null;
        this.spectrogramCanvas = null;
        this.spectrogramHistory = [];
        
        console.log('[SpectralEditor] Disposed');
    }
}

/**
 * Create a spectral editor instance.
 */
export function createSpectralEditor(options = {}) {
    return new SpectralEditor(options);
}

// Default export
export default {
    SpectralMode,
    FFTWindow,
    SpectralEditor,
    createSpectralEditor
};