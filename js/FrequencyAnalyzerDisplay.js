/**
 * Frequency Analyzer Display - Real-time frequency spectrum display with peak hold
 * Provides FFT analysis, peak detection, and visualization
 */

class FrequencyAnalyzerDisplay {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Analyser node
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = options.fftSize || 2048;
        this.analyser.smoothingTimeConstant = options.smoothing || 0.8;
        this.analyser.minDecibels = options.minDecibels || -100;
        this.analyser.maxDecibels = options.maxDecibels || -30;
        
        // Configuration
        this.mode = options.mode || 'spectrum'; // spectrum, octave, thirdOctave
        this.peakHold = options.peakHold || true;
        this.peakDecay = options.peakDecay || 0.95;
        this.scale = options.scale || 'log'; // log, linear
        this.window = options.window || 'hann';
        
        // Data buffers
        this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
        this.byteFrequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.peakData = new Float32Array(this.analyser.frequencyBinCount);
        
        // Peak tracking
        this.peakTimes = new Float32Array(this.analyser.frequencyBinCount);
        this.peakHoldTime = options.peakHoldTime || 1.5; // seconds
        this.maxPeaks = [];
        
        // Frequency bands (octave bands)
        this.octaveBands = [
            { freq: 31.5, min: 22, max: 44 },
            { freq: 63, min: 44, max: 88 },
            { freq: 125, min: 88, max: 177 },
            { freq: 250, min: 177, max: 354 },
            { freq: 500, min: 354, max: 707 },
            { freq: 1000, min: 707, max: 1414 },
            { freq: 2000, min: 1414, max: 2828 },
            { freq: 4000, min: 2828, max: 5657 },
            { freq: 8000, min: 5657, max: 11314 },
            { freq: 16000, min: 11314, max: 22627 }
        ];
        
        // Third octave bands
        this.thirdOctaveBands = this.generateThirdOctaveBands();
        
        // Statistics
        this.stats = {
            peakFrequency: 0,
            peakLevel: -100,
            averageLevel: -100,
            totalPower: 0,
            spectralCentroid: 0,
            spectralFlatness: 0,
            spectralRolloff: 0
        };
        
        // Visualization settings
        this.colorScheme = options.colorScheme || 'warm';
        this.displayRange = { min: -100, max: 0 };
        
        // Connect
        this.input.connect(this.analyser);
        this.input.connect(this.output);
        
        // Start analysis loop
        this.isRunning = false;
        this.animationFrame = null;
    }
    
    /**
     * Generate third octave band definitions
     */
    generateThirdOctaveBands() {
        const bands = [];
        const centerFrequencies = [
            25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200,
            250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000,
            2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
        ];
        
        for (const freq of centerFrequencies) {
            const factor = Math.pow(2, 1/6);
            bands.push({
                freq: freq,
                min: freq / factor,
                max: freq * factor
            });
        }
        
        return bands;
    }
    
    /**
     * Start analysis
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.analysisLoop();
    }
    
    /**
     * Stop analysis
     */
    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    /**
     * Analysis loop
     */
    analysisLoop() {
        if (!this.isRunning) return;
        
        this.analyse();
        this.animationFrame = requestAnimationFrame(() => this.analysisLoop());
    }
    
    /**
     * Perform analysis
     */
    analyse() {
        // Get frequency data
        this.analyser.getFloatFrequencyData(this.frequencyData);
        
        // Update peaks with decay
        const now = this.audioContext.currentTime;
        for (let i = 0; i < this.frequencyData.length; i++) {
            // Track peak with hold
            if (this.frequencyData[i] > this.peakData[i]) {
                this.peakData[i] = this.frequencyData[i];
                this.peakTimes[i] = now;
            } else if (this.peakHold) {
                const timeSincePeak = now - this.peakTimes[i];
                if (timeSincePeak > this.peakHoldTime) {
                    // Decay peak
                    this.peakData[i] *= this.peakDecay;
                }
            } else {
                // Continuous decay
                this.peakData[i] = Math.max(this.frequencyData[i], this.peakData[i] * this.peakDecay);
            }
        }
        
        // Calculate statistics
        this.calculateStatistics();
    }
    
    /**
     * Calculate spectrum statistics
     */
    calculateStatistics() {
        const data = this.frequencyData;
        const sampleRate = this.audioContext.sampleRate;
        const binCount = data.length;
        const binWidth = sampleRate / (binCount * 2);
        
        // Find peak
        let peakLevel = -100;
        let peakBin = 0;
        let sum = 0;
        let weightedSum = 0;
        let totalPower = 0;
        
        for (let i = 0; i < binCount; i++) {
            const level = data[i];
            
            if (level > peakLevel) {
                peakLevel = level;
                peakBin = i;
            }
            
            // Convert to linear for calculations
            const linear = Math.pow(10, level / 20);
            sum += linear;
            weightedSum += linear * i;
            totalPower += linear * linear;
        }
        
        // Peak frequency
        this.stats.peakFrequency = peakBin * binWidth;
        this.stats.peakLevel = peakLevel;
        this.stats.averageLevel = 20 * Math.log10(sum / binCount);
        this.stats.totalPower = totalPower;
        
        // Spectral centroid (weighted average of frequencies)
        if (sum > 0) {
            this.stats.spectralCentroid = (weightedSum / sum) * binWidth;
        }
        
        // Spectral flatness (geometric mean / arithmetic mean)
        let geometricSum = 0;
        let arithmeticSum = 0;
        let validBins = 0;
        
        for (let i = 0; i < binCount; i++) {
            const linear = Math.pow(10, data[i] / 20);
            if (linear > 0) {
                geometricSum += Math.log(linear);
                arithmeticSum += linear;
                validBins++;
            }
        }
        
        if (validBins > 0 && arithmeticSum > 0) {
            const geometricMean = Math.exp(geometricSum / validBins);
            const arithmeticMean = arithmeticSum / validBins;
            this.stats.spectralFlatness = geometricMean / arithmeticMean;
        }
        
        // Spectral rolloff (frequency below which 85% of energy is contained)
        const targetPower = totalPower * 0.85;
        let cumulativePower = 0;
        let rolloffBin = binCount - 1;
        
        for (let i = 0; i < binCount; i++) {
            const linear = Math.pow(10, data[i] / 20);
            cumulativePower += linear * linear;
            if (cumulativePower >= targetPower) {
                rolloffBin = i;
                break;
            }
        }
        
        this.stats.spectralRolloff = rolloffBin * binWidth;
        
        // Track max peaks
        this.updateMaxPeaks(peakBin, peakLevel);
    }
    
    /**
     * Track maximum peaks over time
     */
    updateMaxPeaks(bin, level) {
        const freq = bin * (this.audioContext.sampleRate / (this.frequencyData.length * 2));
        
        // Add to peaks list
        this.maxPeaks.push({
            frequency: freq,
            level: level,
            time: this.audioContext.currentTime
        });
        
        // Keep only recent peaks
        const maxAge = 5; // seconds
        const now = this.audioContext.currentTime;
        this.maxPeaks = this.maxPeaks.filter(p => now - p.time < maxAge);
        
        // Sort by level
        this.maxPeaks.sort((a, b) => b.level - a.level);
        
        // Keep top 5
        if (this.maxPeaks.length > 5) {
            this.maxPeaks = this.maxPeaks.slice(0, 5);
        }
    }
    
    /**
     * Get frequency data for visualization
     */
    getFrequencyData() {
        return {
            data: this.frequencyData,
            peaks: this.peakData,
            sampleRate: this.audioContext.sampleRate,
            fftSize: this.analyser.fftSize
        };
    }
    
    /**
     * Get octave band data
     */
    getOctaveBandData() {
        const bandData = [];
        const sampleRate = this.audioContext.sampleRate;
        const binWidth = sampleRate / (this.analyser.frequencyBinCount * 2);
        
        for (const band of this.octaveBands) {
            const minBin = Math.floor(band.min / binWidth);
            const maxBin = Math.ceil(band.max / binWidth);
            
            let sum = 0;
            let count = 0;
            
            for (let i = minBin; i <= maxBin && i < this.frequencyData.length; i++) {
                sum += Math.pow(10, this.frequencyData[i] / 20);
                count++;
            }
            
            const level = count > 0 ? 20 * Math.log10(sum / count) : -100;
            
            bandData.push({
                frequency: band.freq,
                level: level,
                minBin: minBin,
                maxBin: maxBin
            });
        }
        
        return bandData;
    }
    
    /**
     * Get third octave band data
     */
    getThirdOctaveBandData() {
        const bandData = [];
        const sampleRate = this.audioContext.sampleRate;
        const binWidth = sampleRate / (this.analyser.frequencyBinCount * 2);
        
        for (const band of this.thirdOctaveBands) {
            const minBin = Math.floor(band.min / binWidth);
            const maxBin = Math.ceil(band.max / binWidth);
            
            let sum = 0;
            let count = 0;
            
            for (let i = minBin; i <= maxBin && i < this.frequencyData.length; i++) {
                sum += Math.pow(10, this.frequencyData[i] / 20);
                count++;
            }
            
            const level = count > 0 ? 20 * Math.log10(sum / count) : -100;
            
            bandData.push({
                frequency: band.freq,
                level: level,
                minBin: minBin,
                maxBin: maxBin
            });
        }
        
        return bandData;
    }
    
    /**
     * Get statistics
     */
    getStatistics() {
        return { ...this.stats };
    }
    
    /**
     * Get top peaks
     */
    getTopPeaks(count = 3) {
        return this.maxPeaks.slice(0, count);
    }
    
    /**
     * Set FFT size
     */
    setFftSize(size) {
        const validSizes = [256, 512, 1024, 2048, 4096, 8192, 16384];
        if (validSizes.includes(size)) {
            this.analyser.fftSize = size;
            this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
            this.byteFrequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.peakData = new Float32Array(this.analyser.frequencyBinCount);
            this.peakTimes = new Float32Array(this.analyser.frequencyBinCount);
        }
    }
    
    /**
     * Set smoothing
     */
    setSmoothing(value) {
        this.analyser.smoothingTimeConstant = Math.max(0, Math.min(1, value));
    }
    
    /**
     * Set display range in dB
     */
    setDisplayRange(min, max) {
        this.analyser.minDecibels = min;
        this.analyser.maxDecibels = max;
        this.displayRange = { min, max };
    }
    
    /**
     * Set color scheme
     */
    setColorScheme(scheme) {
        const schemes = ['warm', 'cool', 'mono', 'rainbow', 'plasma', 'viridis'];
        if (schemes.includes(scheme)) {
            this.colorScheme = scheme;
        }
    }
    
    /**
     * Detect dominant frequency
     */
    detectDominantFrequency() {
        const data = this.frequencyData;
        const sampleRate = this.audioContext.sampleRate;
        const binWidth = sampleRate / (data.length * 2);
        
        let maxLevel = -100;
        let maxBin = 0;
        
        for (let i = 1; i < data.length; i++) {
            if (data[i] > maxLevel) {
                maxLevel = data[i];
                maxBin = i;
            }
        }
        
        // Interpolate for better accuracy
        if (maxBin > 0 && maxBin < data.length - 1) {
            const alpha = data[maxBin - 1];
            const beta = data[maxBin];
            const gamma = data[maxBin + 1];
            
            const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
            const interpolatedBin = maxBin + p;
            
            return {
                frequency: interpolatedBin * binWidth,
                level: maxLevel,
                confidence: this.calculateConfidence(maxLevel, this.stats.averageLevel)
            };
        }
        
        return {
            frequency: maxBin * binWidth,
            level: maxLevel,
            confidence: 0.5
        };
    }
    
    /**
     * Calculate detection confidence
     */
    calculateConfidence(peakLevel, averageLevel) {
        const dynamicRange = peakLevel - averageLevel;
        return Math.min(1, Math.max(0, dynamicRange / 20));
    }
    
    /**
     * Connect nodes
     */
    connect(destination) {
        this.output.connect(destination.input || destination);
    }
    
    /**
     * Disconnect
     */
    disconnect() {
        this.output.disconnect();
    }
    
    /**
     * Get settings
     */
    getSettings() {
        return {
            fftSize: this.analyser.fftSize,
            smoothing: this.analyser.smoothingTimeConstant,
            minDecibels: this.analyser.minDecibels,
            maxDecibels: this.analyser.maxDecibels,
            mode: this.mode,
            peakHold: this.peakHold,
            colorScheme: this.colorScheme
        };
    }
    
    /**
     * Apply settings
     */
    applySettings(settings) {
        if (settings.fftSize) this.setFftSize(settings.fftSize);
        if (settings.smoothing !== undefined) this.setSmoothing(settings.smoothing);
        if (settings.minDecibels !== undefined && settings.maxDecibels !== undefined) {
            this.setDisplayRange(settings.minDecibels, settings.maxDecibels);
        }
        if (settings.mode) this.mode = settings.mode;
        if (settings.peakHold !== undefined) this.peakHold = settings.peakHold;
        if (settings.colorScheme) this.setColorScheme(settings.colorScheme);
    }
}

// Factory function
function createFrequencyAnalyzerDisplay(audioContext, options = {}) {
    return new FrequencyAnalyzerDisplay(audioContext, options);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FrequencyAnalyzerDisplay, createFrequencyAnalyzerDisplay };
}