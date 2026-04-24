/**
 * Spectral Subtractive EQ - Notch EQ that auto-removes feedback frequencies
 * Uses spectral analysis to detect and attenuate feedback-prone frequencies
 */

class SpectralSubtractiveEQ {
    constructor() {
        this.isActive = false;
        this.fftSize = 2048;
        this.smoothing = 0.8;
        this.threshold = -40; // dB threshold for feedback detection
        this.attackTime = 0.01;
        this.releaseTime = 0.1;
        this.attenuationGain = 0.3; // How much to reduce feedback frequencies
        
        this.analyser = null;
        this.frequencyHistory = [];
        this.maxHistoryLength = 10;
        
        this.feedbackFrequencies = [];
        this.notchFilters = [];
        
        this.audioContext = null;
        this.onFeedbackDetected = null;
        this.onFrequencyDetected = null;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothing;
            
            // Create notch filters for each band
            const bands = [60, 120, 250, 500, 1000, 2000, 4000, 8000];
            this.notchFilters = bands.map(freq => {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = 'notch';
                filter.frequency.value = freq;
                filter.Q.value = 10;
                filter.gain.value = 0;
                return filter;
            });
            
            return true;
        } catch (e) {
            console.error('[SpectralSubtractiveEQ] Failed to initialize:', e);
            return false;
        }
    }

    /**
     * Get analyser node for connecting to audio chain
     * @returns {AnalyserNode} - The analyser node
     */
    getAnalyser() {
        return this.analyser;
    }

    /**
     * Connect to audio source
     * @param {AudioNode} source - Audio source node
     */
    connect(source) {
        if (this.analyser) {
            source.connect(this.analyser);
        }
    }

    /**
     * Analyze current spectrum for feedback
     * @returns {Float32Array} - Frequency data
     */
    analyzeSpectrum() {
        if (!this.analyser) return null;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatFrequencyData(dataArray);
        
        return dataArray;
    }

    /**
     * Detect feedback-prone frequencies from spectrum
     * @param {Float32Array} spectrumData - Frequency spectrum data
     * @returns {Array} - Detected feedback frequencies
     */
    detectFeedbackFrequencies(spectrumData) {
        if (!spectrumData) return [];
        
        const detected = [];
        const binWidth = this.audioContext.sampleRate / this.fftSize;
        
        // Find peaks that are above threshold
        const thresholdLinear = Math.pow(10, this.threshold / 20);
        
        for (let i = 1; i < spectrumData.length - 1; i++) {
            const freq = i * binWidth;
            
            // Skip DC and very low frequencies
            if (freq < 40) continue;
            
            // Check if this bin is a local maximum
            if (spectrumData[i] > spectrumData[i - 1] && 
                spectrumData[i] > spectrumData[i + 1]) {
                
                // Check if it's above threshold and stands out from neighbors
                const neighborAvg = (spectrumData[i - 1] + spectrumData[i + 1]) / 2;
                const difference = spectrumData[i] - neighborAvg;
                
                if (spectrumData[i] > this.threshold && difference > 10) {
                    detected.push({
                        frequency: Math.round(freq),
                        level: spectrumData[i],
                        binIndex: i
                    });
                }
            }
        }
        
        // Sort by level and take top candidates
        detected.sort((a, b) => b.level - a.level);
        return detected.slice(0, 4);
    }

    /**
     * Apply notch filtering to detected feedback frequencies
     * @param {Array} feedbackFreqs - Array of feedback frequencies
     */
    applyNotchFiltering(feedbackFreqs) {
        // Reset all notch filters
        this.notchFilters.forEach(filter => {
            filter.gain.value = 0;
        });
        
        // Apply attenuation to detected frequencies
        feedbackFreqs.forEach(feedback => {
            // Find closest notch filter
            let closestIdx = 0;
            let minDiff = Infinity;
            
            this.notchFilters.forEach((filter, idx) => {
                const diff = Math.abs(filter.frequency.value - feedback.frequency);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = idx;
                }
            });
            
            // Apply attenuation if close enough
            if (minDiff < feedback.frequency * 0.15) { // within 15%
                const filter = this.notchFilters[closestIdx];
                const attenuationDb = Math.min(feedback.level + 20, 15); // Attenuate based on level
                filter.gain.value = -attenuationDb;
            }
        });
    }

    /**
     * Process and auto-remove feedback
     * @returns {Object} - Processing result
     */
    process() {
        if (!this.isActive) return null;
        
        const spectrumData = this.analyzeSpectrum();
        const feedbackFreqs = this.detectFeedbackFrequencies(spectrumData);
        
        if (feedbackFreqs.length > 0) {
            this.applyNotchFiltering(feedbackFreqs);
            
            if (this.onFeedbackDetected) {
                this.onFeedbackDetected(feedbackFreqs);
            }
        }
        
        // Update history
        this.frequencyHistory.push(feedbackFreqs);
        if (this.frequencyHistory.length > this.maxHistoryLength) {
            this.frequencyHistory.shift();
        }
        
        if (this.onFrequencyDetected) {
            this.onFrequencyDetected({
                detected: feedbackFreqs,
                history: this.frequencyHistory
            });
        }
        
        return {
            detectedFrequencies: feedbackFreqs,
            historyLength: this.frequencyHistory.length
        };
    }

    /**
     * Set detection threshold
     * @param {number} dB - Threshold in dB
     */
    setThreshold(dB) {
        this.threshold = Math.max(-60, Math.min(0, dB));
    }

    /**
     * Set notch attenuation amount
     * @param {number} gain - Attenuation gain (0-1)
     */
    setAttenuation(gain) {
        this.attenuationGain = Math.max(0, Math.min(1, gain));
    }

    /**
     * Enable/disable processing
     * @param {boolean} active - Enable state
     */
    setActive(active) {
        this.isActive = active;
        console.log(`[SpectralSubtractiveEQ] ${active ? 'Enabled' : 'Disabled'}`);
    }

    /**
     * Get current settings
     * @returns {Object} - Current settings
     */
    getSettings() {
        return {
            isActive: this.isActive,
            threshold: this.threshold,
            attenuationGain: this.attenuationGain,
            fftSize: this.fftSize,
            detectedFeedbackCount: this.feedbackFrequencies.length
        };
    }

    /**
     * Reset notch filters
     */
    reset() {
        this.notchFilters.forEach(filter => {
            filter.gain.value = 0;
        });
        this.feedbackFrequencies = [];
        this.frequencyHistory = [];
    }

    /**
     * Get notch filter chain (for connecting to audio graph)
     * @returns {Array} - Array of BiquadFilter nodes
     */
    getNotchFilterChain() {
        return this.notchFilters;
    }

    dispose() {
        this.isActive = false;
        this.reset();
        this.analyser = null;
        this.notchFilters = [];
        this.audioContext = null;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpectralSubtractiveEQ;
}
if (typeof window !== 'undefined') {
    window.SpectralSubtractiveEQ = SpectralSubtractiveEQ;
}