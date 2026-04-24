/**
 * Smart BPM Detection - Detect BPM from audio files automatically
 * Uses onset detection and beat tracking algorithms
 */

class SmartBPMDetection {
    constructor() {
        this.sampleRate = 44100;
        this.fftSize = 2048;
        this.hopSize = 512;
        this.energyThreshold = 1.5;
        this.minBPM = 40;
        this.maxBPM = 240;
        this.lastDetectedBPM = null;
        this.detectionHistory = [];
        this.audioContext = null;
        this.onInitialized = null;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.sampleRate = this.audioContext.sampleRate;
            if (this.onInitialized) this.onInitialized(true);
            return true;
        } catch (e) {
            console.error('[SmartBPMDetection] Failed to initialize:', e);
            if (this.onInitialized) this.onInitialized(false);
            return false;
        }
    }

    /**
     * Detect BPM from an audio buffer
     * @param {AudioBuffer} audioBuffer - The audio buffer to analyze
     * @returns {Object} - Detection result with BPM and confidence
     */
    async detectFromBuffer(audioBuffer) {
        if (!audioBuffer) {
            return { bpm: null, confidence: 0, error: 'No audio buffer provided' };
        }

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Calculate onset strength envelope
        const onsetEnvelope = this.calculateOnsetEnvelope(channelData, sampleRate);
        
        // Find peaks in onset envelope
        const peaks = this.findPeaks(onsetEnvelope);
        
        // Calculate inter-onset intervals
        const intervals = this.calculateIntervals(peaks, sampleRate);
        
        // Estimate tempo from intervals
        const bpmResult = this.estimateTempo(intervals);
        
        // Store detection for averaging
        this.lastDetectedBPM = bpmResult.bpm;
        this.detectionHistory.push({
            bpm: bpmResult.bpm,
            confidence: bpmResult.confidence,
            timestamp: Date.now()
        });
        
        // Keep only last 10 detections
        if (this.detectionHistory.length > 10) {
            this.detectionHistory.shift();
        }

        return {
            bpm: bpmResult.bpm,
            confidence: bpmResult.confidence,
            beats: peaks.map(p => p.time),
            onsetEnvelope: onsetEnvelope
        };
    }

    /**
     * Detect BPM from an audio file URL
     * @param {string} url - URL of the audio file
     * @returns {Object} - Detection result
     */
    async detectFromURL(url) {
        try {
            if (!this.audioContext) {
                await this.initialize();
            }

            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            return await this.detectFromBuffer(audioBuffer);
        } catch (e) {
            console.error('[SmartBPMDetection] Failed to detect from URL:', e);
            return { bpm: null, confidence: 0, error: e.message };
        }
    }

    /**
     * Detect BPM from audio blob
     * @param {Blob} blob - Audio blob
     * @returns {Object} - Detection result
     */
    async detectFromBlob(blob) {
        try {
            if (!this.audioContext) {
                await this.initialize();
            }

            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            return await this.detectFromBuffer(audioBuffer);
        } catch (e) {
            console.error('[SmartBPMDetection] Failed to detect from blob:', e);
            return { bpm: null, confidence: 0, error: e.message };
        }
    }

    /**
     * Calculate onset strength envelope using spectral flux
     */
    calculateOnsetEnvelope(channelData, sampleRate) {
        const fftSize = this.fftSize;
        const hopSize = this.hopSize;
        const numFrames = Math.floor((channelData.length - fftSize) / hopSize);
        
        const envelope = [];
        let prevSpectrum = null;
        
        for (let i = 0; i < numFrames; i++) {
            const start = i * hopSize;
            const frame = channelData.slice(start, start + fftSize);
            
            // Apply Hann window
            const windowedFrame = frame.map((v, idx) => 
                v * (0.5 - 0.5 * Math.cos(2 * Math.PI * idx / fftSize))
            );
            
            // Calculate magnitude spectrum (simplified FFT approximation)
            const spectrum = this.calculateSpectrum(windowedFrame);
            
            // Calculate spectral flux
            if (prevSpectrum) {
                let flux = 0;
                for (let j = 0; j < spectrum.length; j++) {
                    const diff = spectrum[j] - prevSpectrum[j];
                    if (diff > 0) {
                        flux += diff * diff;
                    }
                }
                envelope.push({
                    time: start / sampleRate,
                    value: Math.sqrt(flux)
                });
            }
            
            prevSpectrum = spectrum;
        }
        
        return envelope;
    }

    /**
     * Simplified spectrum calculation
     */
    calculateSpectrum(frame) {
        const n = frame.length;
        const spectrum = new Array(n / 2).fill(0);
        
        // Simplified DFT for magnitude spectrum
        for (let k = 0; k < n / 2; k++) {
            let real = 0, imag = 0;
            for (let t = 0; t < n; t++) {
                const angle = 2 * Math.PI * k * t / n;
                real += frame[t] * Math.cos(angle);
                imag -= frame[t] * Math.sin(angle);
            }
            spectrum[k] = Math.sqrt(real * real + imag * imag);
        }
        
        return spectrum;
    }

    /**
     * Find peaks in onset envelope
     */
    findPeaks(envelope) {
        if (envelope.length < 3) return [];
        
        const peaks = [];
        const threshold = this.calculateAdaptiveThreshold(envelope);
        
        for (let i = 1; i < envelope.length - 1; i++) {
            const current = envelope[i].value;
            const prev = envelope[i - 1].value;
            const next = envelope[i + 1].value;
            
            if (current > prev && current > next && current > threshold) {
                peaks.push({
                    time: envelope[i].time,
                    value: current,
                    index: i
                });
            }
        }
        
        return peaks;
    }

    /**
     * Calculate adaptive threshold for peak detection
     */
    calculateAdaptiveThreshold(envelope) {
        if (envelope.length === 0) return 0;
        
        const values = envelope.map(e => e.value);
        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        
        return Math.max(median, mean) * this.energyThreshold;
    }

    /**
     * Calculate inter-onset intervals from peaks
     */
    calculateIntervals(peaks, sampleRate) {
        if (peaks.length < 2) return [];
        
        const intervals = [];
        for (let i = 1; i < peaks.length; i++) {
            const interval = peaks[i].time - peaks[i - 1].time;
            intervals.push(interval);
        }
        
        return intervals;
    }

    /**
     * Estimate tempo from intervals using autocorrelation
     */
    estimateTempo(intervals) {
        if (intervals.length < 3) {
            return { bpm: this.lastDetectedBPM || 120, confidence: 0.1 };
        }
        
        // Convert intervals to BPM
        const bpms = intervals.map(i => 60 / i);
        
        // Filter BPM range
        const validBPMs = bpms.filter(bpm => bpm >= this.minBPM && bpm <= this.maxBPM);
        
        if (validBPMs.length === 0) {
            return { bpm: 120, confidence: 0.1 };
        }
        
        // Create BPM histogram
        const histogram = new Map();
        const binSize = 0.5; // BPM bins
        
        for (const bpm of validBPMs) {
            const bin = Math.round(bpm / binSize) * binSize;
            histogram.set(bin, (histogram.get(bin) || 0) + 1);
        }
        
        // Find most common BPM
        let maxCount = 0;
        let estimatedBPM = validBPMs[0];
        
        for (const [bpm, count] of histogram) {
            if (count > maxCount) {
                maxCount = count;
                estimatedBPM = bpm;
            }
        }
        
        // Calculate confidence
        const confidence = maxCount / validBPMs.length;
        
        // Check for half/double tempo
        const halfBPM = estimatedBPM / 2;
        const doubleBPM = estimatedBPM * 2;
        
        let finalBPM = estimatedBPM;
        const halfCount = histogram.get(halfBPM) || 0;
        const doubleCount = histogram.get(doubleBPM) || 0;
        
        // Prefer BPM in 60-150 range
        if (estimatedBPM < 60 && doubleBPM >= 60 && doubleBPM <= 150) {
            finalBPM = doubleBPM;
        } else if (estimatedBPM > 150 && halfBPM >= 60 && halfBPM <= 150) {
            finalBPM = halfBPM;
        }
        
        return {
            bpm: Math.round(finalBPM * 100) / 100,
            confidence: Math.round(confidence * 100) / 100,
            histogram: Object.fromEntries(histogram)
        };
    }

    /**
     * Get average BPM from detection history
     */
    getAverageBPM() {
        if (this.detectionHistory.length === 0) return null;
        
        const sum = this.detectionHistory.reduce((acc, d) => acc + d.bpm, 0);
        return Math.round(sum / this.detectionHistory.length * 100) / 100;
    }

    /**
     * Get weighted average BPM (higher confidence = more weight)
     */
    getWeightedAverageBPM() {
        if (this.detectionHistory.length === 0) return null;
        
        const weightedSum = this.detectionHistory.reduce(
            (acc, d) => acc + d.bpm * d.confidence, 0
        );
        const totalWeight = this.detectionHistory.reduce(
            (acc, d) => acc + d.confidence, 0
        );
        
        return Math.round(weightedSum / totalWeight * 100) / 100;
    }

    /**
     * Clear detection history
     */
    clearHistory() {
        this.detectionHistory = [];
        this.lastDetectedBPM = null;
    }

    /**
     * Open detection panel UI
     */
    openDetectionPanel(onBPMdetected) {
        const existing = document.getElementById('bpm-detection-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'bpm-detection-panel';
        panel.innerHTML = `
            <div class="bpm-panel-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 500px;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">🎵 Smart BPM Detection</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Detect BPM from:</label>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <button id="bpm-detect-clip" class="bpm-btn" style="flex: 1; padding: 10px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                            Selected Clip
                        </button>
                        <button id="bpm-detect-file" class="bpm-btn" style="flex: 1; padding: 10px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                            Audio File
                        </button>
                        <button id="bpm-detect-tap" class="bpm-btn" style="flex: 1; padding: 10px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                            Tap Tempo
                        </button>
                    </div>
                </div>

                <input type="file" id="bpm-file-input" accept="audio/*" style="display: none;">
                
                <div id="bpm-result" style="display: none; background: #2a2a4e; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <div style="color: #a0a0a0; font-size: 12px;">Detected BPM</div>
                            <div id="bpm-value" style="font-size: 32px; font-weight: bold; color: #10b981;">--</div>
                        </div>
                        <div>
                            <div style="color: #a0a0a0; font-size: 12px;">Confidence</div>
                            <div id="bpm-confidence" style="font-size: 18px; color: #fbbf24;">--</div>
                        </div>
                    </div>
                    <div id="bpm-beats-info" style="margin-top: 12px; color: #a0a0a0; font-size: 11px;"></div>
                </div>

                <div id="tap-tempo-area" style="display: none; text-align: center; margin-bottom: 16px;">
                    <button id="tap-button" style="width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border: none; color: white; font-size: 24px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);">
                        TAP
                    </button>
                    <div id="tap-result" style="margin-top: 16px; font-size: 24px; color: #fff;">-- BPM</div>
                    <div style="color: #a0a0a0; font-size: 12px; margin-top: 8px;">Tap at least 3 times</div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="bpm-apply" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" disabled>
                        Apply to Project
                    </button>
                    <button id="bpm-close" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #bpm-detection-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
            .bpm-btn:hover {
                filter: brightness(1.2);
            }
            #tap-button:active {
                transform: scale(0.95);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // State
        let detectedBPM = null;
        let tapTimes = [];

        // Event handlers
        const detectClipBtn = document.getElementById('bpm-detect-clip');
        const detectFileBtn = document.getElementById('bpm-detect-file');
        const tapTempoBtn = document.getElementById('bpm-detect-tap');
        const fileInput = document.getElementById('bpm-file-input');
        const applyBtn = document.getElementById('bpm-apply');
        const closeBtn = document.getElementById('bpm-close');
        const tapButton = document.getElementById('tap-button');
        const bpmResult = document.getElementById('bpm-result');
        const tapArea = document.getElementById('tap-tempo-area');

        // Detect from selected clip
        detectClipBtn.addEventListener('click', async () => {
            // This would integrate with the DAW's clip selection system
            bpmResult.style.display = 'block';
            tapArea.style.display = 'none';
            document.getElementById('bpm-value').textContent = 'Analyzing...';
            document.getElementById('bpm-confidence').textContent = '--';
            
            // Placeholder - in real implementation, would get selected clip audio
            const result = await this.detectFromURL('/test-audio.wav');
            
            if (result.bpm) {
                detectedBPM = result.bpm;
                document.getElementById('bpm-value').textContent = result.bpm;
                document.getElementById('bpm-confidence').textContent = `${Math.round(result.confidence * 100)}%`;
                document.getElementById('bpm-beats-info').textContent = 
                    `Found ${result.beats?.length || 0} beats`;
                applyBtn.disabled = false;
            } else {
                document.getElementById('bpm-value').textContent = 'Error';
                document.getElementById('bpm-confidence').textContent = result.error || 'Failed';
            }
        });

        // Detect from file
        detectFileBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            bpmResult.style.display = 'block';
            tapArea.style.display = 'none';
            document.getElementById('bpm-value').textContent = 'Analyzing...';

            const result = await this.detectFromBlob(file);
            
            if (result.bpm) {
                detectedBPM = result.bpm;
                document.getElementById('bpm-value').textContent = result.bpm;
                document.getElementById('bpm-confidence').textContent = `${Math.round(result.confidence * 100)}%`;
                applyBtn.disabled = false;
            } else {
                document.getElementById('bpm-value').textContent = 'Error';
                document.getElementById('bpm-confidence').textContent = result.error || 'Failed';
            }
        });

        // Tap tempo
        tapTempoBtn.addEventListener('click', () => {
            bpmResult.style.display = 'none';
            tapArea.style.display = 'block';
            tapTimes = [];
            document.getElementById('tap-result').textContent = '-- BPM';
        });

        tapButton.addEventListener('click', () => {
            const now = Date.now();
            tapTimes.push(now);
            
            // Keep only last 8 taps
            if (tapTimes.length > 8) {
                tapTimes.shift();
            }

            if (tapTimes.length >= 3) {
                const intervals = [];
                for (let i = 1; i < tapTimes.length; i++) {
                    intervals.push(tapTimes[i] - tapTimes[i - 1]);
                }
                
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const bpm = 60000 / avgInterval;
                
                detectedBPM = Math.round(bpm * 100) / 100;
                document.getElementById('tap-result').textContent = `${detectedBPM} BPM`;
                applyBtn.disabled = false;
            }
        });

        // Apply BPM
        applyBtn.addEventListener('click', () => {
            if (detectedBPM && onBPMdetected) {
                onBPMdetected(detectedBPM);
                panel.remove();
                style.remove();
            }
        });

        // Close
        closeBtn.addEventListener('click', () => {
            panel.remove();
            style.remove();
        });
    }

    /**
     * Dispose resources
     */
    dispose() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.clearHistory();
    }
}

// Export singleton
const smartBPMDetection = new SmartBPMDetection();

export { SmartBPMDetection, smartBPMDetection };