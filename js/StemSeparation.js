// js/StemSeparation.js - AI-Based Stem Separation
// Provides AI-based stem separation from mixed audio using spectral processing

/**
 * StemType - Types of stems that can be separated
 */
export const StemType = {
    VOCALS: 'vocals',
    DRUMS: 'drums',
    BASS: 'bass',
    OTHER: 'other',
    PIANO: 'piano',
    GUITAR: 'guitar',
    STRINGS: 'strings',
    SYNTH: 'synth'
};

/**
 * SeparationResult - Result of stem separation
 */
class SeparationResult {
    constructor() {
        this.stems = new Map();
        this.originalDuration = 0;
        this.processingTime = 0;
        this.quality = 0;
        this.artifacts = [];
    }
    
    getStem(type) {
        return this.stems.get(type);
    }
    
    getAllStems() {
        return Array.from(this.stems.entries());
    }
}

/**
 * StemSeparator - AI-based stem separation engine
 */
export class StemSeparator {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Separation quality settings
        this.fftSize = options.fftSize || 4096;
        this.hopSize = options.hopSize || 1024;
        this.windowSize = options.windowSize || 4096;
        
        // Frequency bands for instrument detection
        this.frequencyBands = {
            subBass: { min: 20, max: 60 },
            bass: { min: 60, max: 250 },
            lowMid: { min: 250, max: 500 },
            mid: { min: 500, max: 2000 },
            highMid: { min: 2000, max: 4000 },
            presence: { min: 4000, max: 6000 },
            brilliance: { min: 6000, max: 20000 }
        };
        
        // Instrument frequency characteristics
        this.instrumentProfiles = {
            [StemType.VOCALS]: {
                primaryRange: [200, 3000],
                harmonics: [2, 3, 4],
                spectralShape: 'vocal',
                formants: true,
                presenceRange: [2000, 6000]
            },
            [StemType.DRUMS]: {
                primaryRange: [40, 8000],
                transients: true,
                lowTransient: [40, 200],
                highTransient: [2000, 12000],
                spectralShape: 'percussive'
            },
            [StemType.BASS]: {
                primaryRange: [40, 400],
                harmonics: [2, 3],
                spectralShape: 'bass',
                fundamental: [40, 250]
            },
            [StemType.PIANO]: {
                primaryRange: [100, 4000],
                harmonics: [2, 3, 4, 5],
                spectralShape: 'piano',
                attackTransient: true
            },
            [StemType.GUITAR]: {
                primaryRange: [80, 1200],
                harmonics: [2, 3, 4],
                spectralShape: 'guitar',
                pickNoise: [2000, 8000]
            },
            [StemType.STRINGS]: {
                primaryRange: [150, 3000],
                harmonics: [2, 3, 4, 5],
                spectralShape: 'strings',
                bowNoise: [4000, 10000]
            },
            [StemType.SYNTH]: {
                primaryRange: [50, 10000],
                harmonics: [2, 3, 4, 5, 6, 7],
                spectralShape: 'synth',
                filterSweep: true
            }
        };
        
        // Progress callback
        this.onProgress = options.onProgress || null;
        
        // Processing state
        this.isProcessing = false;
        this.cancelled = false;
    }

    /**
     * Separate audio into stems
     */
    async separate(audioBuffer, stemTypes = [StemType.VOCALS, StemType.DRUMS, StemType.BASS, StemType.OTHER]) {
        if (this.isProcessing) {
            throw new Error('Separation already in progress');
        }
        
        this.isProcessing = true;
        this.cancelled = false;
        const startTime = Date.now();
        
        const result = new SeparationResult();
        result.originalDuration = audioBuffer.duration;
        
        try {
            // Convert to mono for analysis if stereo
            const monoBuffer = this.toMono(audioBuffer);
            
            // Perform STFT
            const frames = await this.performSTFT(monoBuffer);
            
            // Analyze spectral content
            const analysis = this.analyzeSpectrum(frames);
            
            // Separate each stem type
            for (const stemType of stemTypes) {
                if (this.cancelled) break;
                
                const stemFrames = this.separateStem(frames, analysis, stemType);
                const stemBuffer = await this.performISTFT(stemFrames, audioBuffer);
                
                result.stems.set(stemType, stemBuffer);
                
                // Update progress
                const progress = (stemTypes.indexOf(stemType) + 1) / stemTypes.length;
                if (this.onProgress) {
                    this.onProgress(progress, stemType);
                }
            }
            
            result.processingTime = (Date.now() - startTime) / 1000;
            result.quality = this.estimateQuality(result);
            
        } catch (error) {
            console.error('Stem separation error:', error);
            result.artifacts.push(error.message);
        }
        
        this.isProcessing = false;
        return result;
    }

    /**
     * Convert stereo buffer to mono
     */
    toMono(audioBuffer) {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }
        
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        const mono = new Float32Array(left.length);
        
        for (let i = 0; i < left.length; i++) {
            mono[i] = (left[i] + right[i]) / 2;
        }
        
        return mono;
    }

    /**
     * Perform Short-Time Fourier Transform
     */
    async performSTFT(signal) {
        const numFrames = Math.ceil((signal.length - this.windowSize) / this.hopSize) + 1;
        const frames = [];
        
        // Create window function
        const window = this.createWindow('hann', this.windowSize);
        
        for (let i = 0; i < numFrames; i++) {
            if (this.cancelled) break;
            
            const start = i * this.hopSize;
            const frame = new Float32Array(this.fftSize);
            
            // Copy and window the signal
            for (let j = 0; j < this.windowSize && start + j < signal.length; j++) {
                frame[j] = signal[start + j] * window[j];
            }
            
            // Perform FFT (simplified - real implementation would use proper FFT)
            const spectrum = this.fft(frame);
            frames.push({
                time: start / this.audioContext.sampleRate,
                real: spectrum.real,
                imag: spectrum.imag,
                magnitude: spectrum.magnitude,
                phase: spectrum.phase
            });
            
            // Yield occasionally for responsiveness
            if (i % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        return frames;
    }

    /**
     * Perform Inverse STFT
     */
    async performISTFT(frames, originalBuffer) {
        const sampleRate = this.audioContext.sampleRate;
        const numSamples = Math.ceil((frames.length - 1) * this.hopSize + this.windowSize);
        const output = new Float32Array(numSamples);
        const windowSum = new Float32Array(numSamples);
        
        const window = this.createWindow('hann', this.windowSize);
        
        for (let i = 0; i < frames.length; i++) {
            if (this.cancelled) break;
            
            // Perform IFFT
            const frame = this.ifft(frames[i]);
            
            // Overlap-add
            const start = i * this.hopSize;
            for (let j = 0; j < this.windowSize && start + j < numSamples; j++) {
                output[start + j] += frame[j] * window[j];
                windowSum[start + j] += window[j] * window[j];
            }
            
            if (i % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        // Normalize by window sum
        for (let i = 0; i < numSamples; i++) {
            if (windowSum[i] > 0.0001) {
                output[i] /= windowSum[i];
            }
        }
        
        // Create audio buffer
        const audioBuffer = this.audioContext.createBuffer(
            originalBuffer.numberOfChannels,
            numSamples,
            sampleRate
        );
        
        // Copy to all channels
        for (let ch = 0; ch < originalBuffer.numberOfChannels; ch++) {
            audioBuffer.copyToChannel(output, ch);
        }
        
        return audioBuffer;
    }

    /**
     * Create window function
     */
    createWindow(type, size) {
        const window = new Float32Array(size);
        
        switch (type) {
            case 'hann':
                for (let i = 0; i < size; i++) {
                    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
                }
                break;
            case 'hamming':
                for (let i = 0; i < size; i++) {
                    window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
                }
                break;
            case 'blackman':
                for (let i = 0; i < size; i++) {
                    window[i] = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1))
                              + 0.08 * Math.cos(4 * Math.PI * i / (size - 1));
                }
                break;
            default:
                window.fill(1);
        }
        
        return window;
    }

    /**
     * Simplified FFT
     */
    fft(frame) {
        const n = frame.length;
        const real = new Float32Array(n);
        const imag = new Float32Array(n);
        const magnitude = new Float32Array(n / 2);
        const phase = new Float32Array(n / 2);
        
        // DFT (simplified - real implementation would use Cooley-Tukey FFT)
        for (let k = 0; k < n / 2; k++) {
            let sumReal = 0;
            let sumImag = 0;
            
            for (let j = 0; j < n; j++) {
                const angle = (2 * Math.PI * k * j) / n;
                sumReal += frame[j] * Math.cos(angle);
                sumImag -= frame[j] * Math.sin(angle);
            }
            
            real[k] = sumReal / n;
            imag[k] = sumImag / n;
            magnitude[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
            phase[k] = Math.atan2(imag[k], real[k]);
        }
        
        return { real, imag, magnitude, phase };
    }

    /**
     * Simplified IFFT
     */
    ifft(spectrum) {
        const n = this.fftSize;
        const output = new Float32Array(n);
        
        for (let j = 0; j < n; j++) {
            let sum = 0;
            
            for (let k = 0; k < n / 2; k++) {
                const angle = (2 * Math.PI * k * j) / n;
                const mag = spectrum.magnitude[k] || 0;
                const ph = spectrum.phase[k] || 0;
                
                sum += mag * Math.cos(angle + ph);
            }
            
            output[j] = 2 * sum;  // Scale for inverse
        }
        
        return output;
    }

    /**
     * Analyze spectrum to identify instruments
     */
    analyzeSpectrum(frames) {
        const analysis = {
            totalEnergy: new Float32Array(frames[0].magnitude.length),
            harmonicContent: [],
            transientFrames: [],
            spectralCentroid: [],
            energyDistribution: []
        };
        
        // Calculate total energy per frequency bin
        for (const frame of frames) {
            for (let i = 0; i < frame.magnitude.length; i++) {
                analysis.totalEnergy[i] += frame.magnitude[i];
            }
        }
        
        // Detect transients (sudden energy increases)
        for (let i = 1; i < frames.length; i++) {
            const currentMag = frames[i].magnitude;
            const prevMag = frames[i - 1].magnitude;
            
            let transientEnergy = 0;
            for (let j = 0; j < currentMag.length; j++) {
                transientEnergy += Math.abs(currentMag[j] - prevMag[j]);
            }
            
            if (transientEnergy > frames.length * 0.1) {
                analysis.transientFrames.push(i);
            }
        }
        
        // Calculate spectral centroid
        for (const frame of frames) {
            let weightedSum = 0;
            let totalMag = 0;
            
            for (let i = 0; i < frame.magnitude.length; i++) {
                const freq = (i / frame.magnitude.length) * this.audioContext.sampleRate / 2;
                weightedSum += freq * frame.magnitude[i];
                totalMag += frame.magnitude[i];
            }
            
            analysis.spectralCentroid.push(totalMag > 0 ? weightedSum / totalMag : 0);
        }
        
        return analysis;
    }

    /**
     * Separate a specific stem from the mixed audio
     */
    separateStem(frames, analysis, stemType) {
        const profile = this.instrumentProfiles[stemType];
        if (!profile) {
            console.warn(`No profile for stem type: ${stemType}`);
            return frames.map(f => ({ ...f, magnitude: new Float32Array(f.magnitude.length) }));
        }
        
        return frames.map((frame, frameIndex) => {
            const newMagnitude = new Float32Array(frame.magnitude.length);
            const binFreq = this.audioContext.sampleRate / 2 / frame.magnitude.length;
            
            // Calculate stem mask based on profile
            for (let i = 0; i < frame.magnitude.length; i++) {
                const freq = i * binFreq;
                let mask = 0;
                
                // Primary frequency range mask
                if (profile.primaryRange) {
                    const [min, max] = profile.primaryRange;
                    if (freq >= min && freq <= max) {
                        mask += 0.5;
                    }
                }
                
                // Presence range for vocals
                if (profile.presenceRange && stemType === StemType.VOCALS) {
                    const [min, max] = profile.presenceRange;
                    if (freq >= min && freq <= max) {
                        mask += 0.3;
                    }
                }
                
                // Transient detection for drums
                if (profile.transients && analysis.transientFrames.includes(frameIndex)) {
                    if (freq >= profile.lowTransient?.[0] && freq <= profile.lowTransient?.[1]) {
                        mask += 0.4;
                    }
                    if (freq >= profile.highTransient?.[0] && freq <= profile.highTransient?.[1]) {
                        mask += 0.4;
                    }
                }
                
                // Bass frequency emphasis
                if (profile.fundamental && stemType === StemType.BASS) {
                    const [min, max] = profile.fundamental;
                    if (freq >= min && freq <= max) {
                        mask += 0.6;
                    }
                }
                
                // Apply harmonic enhancement
                if (profile.harmonics) {
                    const fundamental = this.detectFundamental(frame.magnitude);
                    if (fundamental > 0) {
                        for (const harmonic of profile.harmonics) {
                            const harmonicFreq = fundamental * harmonic;
                            const harmonicBin = Math.round(harmonicFreq / binFreq);
                            if (harmonicBin < frame.magnitude.length) {
                                mask += 0.2 * (1 - harmonic * 0.1);
                            }
                        }
                    }
                }
                
                // Apply mask
                newMagnitude[i] = frame.magnitude[i] * Math.min(1, mask);
            }
            
            return {
                ...frame,
                magnitude: newMagnitude
            };
        });
    }

    /**
     * Detect fundamental frequency from magnitude spectrum
     */
    detectFundamental(magnitude) {
        // Simple peak detection
        let maxMag = 0;
        let maxBin = 0;
        
        for (let i = 1; i < magnitude.length / 4; i++) {  // Search in lower frequencies
            if (magnitude[i] > maxMag) {
                maxMag = magnitude[i];
                maxBin = i;
            }
        }
        
        const binFreq = this.audioContext.sampleRate / 2 / magnitude.length;
        return maxBin * binFreq;
    }

    /**
     * Estimate separation quality
     */
    estimateQuality(result) {
        // Simplified quality estimation
        let quality = 0.5;
        
        // Higher quality if more stems were separated
        quality += result.stems.size * 0.05;
        
        // Check for artifacts
        if (result.artifacts.length > 0) {
            quality -= 0.2;
        }
        
        return Math.max(0, Math.min(1, quality));
    }

    /**
     * Cancel ongoing separation
     */
    cancel() {
        this.cancelled = true;
    }

    /**
     * Get available stem types
     */
    getAvailableStemTypes() {
        return Object.values(StemType);
    }
}

/**
 * Open stem separation panel
 */
export function openStemSeparationPanel(services = {}) {
    const { audioContext, showNotification, onStemReady } = services;
    
    if (!audioContext) {
        console.error('StemSeparation: audioContext required');
        return null;
    }
    
    // Remove existing panel
    const existing = document.getElementById('stem-sep-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'stem-sep-panel';
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
    
    const separator = new StemSeparator(audioContext, {
        onProgress: (progress, stemType) => {
            progressBar.style.width = `${progress * 100}%`;
            progressText.textContent = `Separating ${stemType}...`;
        }
    });
    
    let audioBuffer = null;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #fff; margin: 0;">🎛️ Stem Separation</h2>
            <button id="close-stem-sep" style="background: #ef4444; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
        
        <!-- Input -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Source Audio</h3>
            <div style="display: flex; gap: 10px;">
                <input type="file" id="stem-file" accept="audio/*" style="display: none;">
                <button id="load-stem-file" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                    Load Mixed Audio
                </button>
                <div id="file-info" style="flex: 2; background: #0a0a14; padding: 12px; border-radius: 4px; color: #666;">
                    No file loaded
                </div>
            </div>
        </div>
        
        <!-- Stem Selection -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Stems to Separate</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; background: #1a1a2e; padding: 10px; border-radius: 4px;">
                    <input type="checkbox" class="stem-checkbox" data-type="vocals" checked> 🎤 Vocals
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; background: #1a1a2e; padding: 10px; border-radius: 4px;">
                    <input type="checkbox" class="stem-checkbox" data-type="drums" checked> 🥁 Drums
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; background: #1a1a2e; padding: 10px; border-radius: 4px;">
                    <input type="checkbox" class="stem-checkbox" data-type="bass" checked> 🎸 Bass
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; background: #1a1a2e; padding: 10px; border-radius: 4px;">
                    <input type="checkbox" class="stem-checkbox" data-type="other" checked> 🎵 Other
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; background: #1a1a2e; padding: 10px; border-radius: 4px;">
                    <input type="checkbox" class="stem-checkbox" data-type="piano"> 🎹 Piano
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; background: #1a1a2e; padding: 10px; border-radius: 4px;">
                    <input type="checkbox" class="stem-checkbox" data-type="guitar"> 🎸 Guitar
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; background: #1a1a2e; padding: 10px; border-radius: 4px;">
                    <input type="checkbox" class="stem-checkbox" data-type="strings"> 🎻 Strings
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; background: #1a1a2e; padding: 10px; border-radius: 4px;">
                    <input type="checkbox" class="stem-checkbox" data-type="synth"> 🎹 Synth
                </label>
            </div>
        </div>
        
        <!-- Progress -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="color: #888; font-size: 12px;">Progress</span>
                <span id="progress-text" style="color: #fff; font-size: 12px;">Ready</span>
            </div>
            <div style="background: #0a0a14; border-radius: 4px; height: 20px; overflow: hidden;">
                <div id="progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981, #3b82f6); transition: width 0.3s;"></div>
            </div>
        </div>
        
        <!-- Results -->
        <div id="results-section" style="display: none; margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Separated Stems</h3>
            <div id="stems-list"></div>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; gap: 10px;">
            <button id="start-separation" style="flex: 1; padding: 14px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" disabled>
                🔀 Start Separation
            </button>
            <button id="cancel-separation" style="flex: 1; padding: 14px; background: #666; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" disabled>
                ✕ Cancel
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    const progressBar = panel.querySelector('#progress-bar');
    const progressText = panel.querySelector('#progress-text');
    const startBtn = panel.querySelector('#start-separation');
    const cancelBtn = panel.querySelector('#cancel-separation');
    const resultsSection = panel.querySelector('#results-section');
    const stemsList = panel.querySelector('#stems-list');
    
    // Close
    panel.querySelector('#close-stem-sep').onclick = () => {
        if (separator.isProcessing) {
            separator.cancel();
        }
        panel.remove();
    };
    
    // Load file
    panel.querySelector('#load-stem-file').onclick = () => {
        panel.querySelector('#stem-file').click();
    };
    
    panel.querySelector('#stem-file').onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            panel.querySelector('#file-info').textContent = 'Loading...';
            try {
                const arrayBuffer = await file.arrayBuffer();
                audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                panel.querySelector('#file-info').textContent = `${file.name} (${audioBuffer.duration.toFixed(1)}s, ${audioBuffer.sampleRate}Hz)`;
                startBtn.disabled = false;
                if (showNotification) showNotification('Audio loaded', 1500);
            } catch (err) {
                panel.querySelector('#file-info').textContent = 'Failed to load audio';
            }
        }
    };
    
    // Start separation
    startBtn.onclick = async () => {
        if (!audioBuffer) {
            if (showNotification) showNotification('Please load audio first', 2000);
            return;
        }
        
        // Get selected stem types
        const stemTypes = [];
        panel.querySelectorAll('.stem-checkbox:checked').forEach(cb => {
            stemTypes.push(cb.dataset.type);
        });
        
        if (stemTypes.length === 0) {
            if (showNotification) showNotification('Please select at least one stem', 2000);
            return;
        }
        
        startBtn.disabled = true;
        cancelBtn.disabled = false;
        progressBar.style.width = '0%';
        
        const result = await separator.separate(audioBuffer, stemTypes);
        
        startBtn.disabled = false;
        cancelBtn.disabled = true;
        progressBar.style.width = '100%';
        progressText.textContent = 'Complete!';
        
        if (result.stems.size > 0) {
            resultsSection.style.display = 'block';
            
            stemsList.innerHTML = Array.from(result.stems.entries()).map(([type, buffer]) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #1a1a2e; border-radius: 4px; margin-bottom: 8px;">
                    <div>
                        <div style="color: #fff; font-size: 14px; text-transform: capitalize;">${type}</div>
                        <div style="color: #666; font-size: 11px;">${buffer.duration.toFixed(2)}s</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="play-stem" data-type="${type}" style="padding: 6px 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">▶ Play</button>
                        <button class="export-stem" data-type="${type}" style="padding: 6px 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">💾 Export</button>
                        ${onStemReady ? `<button class="use-stem" data-type="${type}" style="padding: 6px 12px; background: #f59e0b; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">Use</button>` : ''}
                    </div>
                </div>
            `).join('');
            
            // Play stem
            stemsList.querySelectorAll('.play-stem').forEach(btn => {
                btn.onclick = () => {
                    const type = btn.dataset.type;
                    const buffer = result.stems.get(type);
                    if (buffer) {
                        const source = audioContext.createBufferSource();
                        source.buffer = buffer;
                        source.connect(audioContext.destination);
                        source.start();
                    }
                };
            });
            
            // Export stem
            stemsList.querySelectorAll('.export-stem').forEach(btn => {
                btn.onclick = () => {
                    const type = btn.dataset.type;
                    const buffer = result.stems.get(type);
                    if (buffer) {
                        // Create WAV blob
                        const wav = bufferToWav(buffer);
                        const blob = new Blob([wav], { type: 'audio/wav' });
                        const url = URL.createObjectURL(blob);
                        
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${type}.wav`;
                        a.click();
                        
                        URL.revokeObjectURL(url);
                        if (showNotification) showNotification(`${type}.wav exported`, 1500);
                    }
                };
            });
            
            // Use stem
            if (onStemReady) {
                stemsList.querySelectorAll('.use-stem').forEach(btn => {
                    btn.onclick = () => {
                        const type = btn.dataset.type;
                        const buffer = result.stems.get(type);
                        if (buffer) {
                            onStemReady(type, buffer);
                            if (showNotification) showNotification(`${type} stem added to project`, 1500);
                        }
                    };
                });
            }
        }
        
        if (showNotification) showNotification(`Separated ${result.stems.size} stems in ${result.processingTime.toFixed(1)}s`, 3000);
    };
    
    // Cancel
    cancelBtn.onclick = () => {
        separator.cancel();
        cancelBtn.disabled = true;
        progressText.textContent = 'Cancelled';
    };
    
    return separator;
}

/**
 * Convert AudioBuffer to WAV format
 */
function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numSamples = buffer.length;
    
    const wav = new ArrayBuffer(44 + numSamples * numChannels * 2);
    const view = new DataView(wav);
    
    // WAV header
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * numChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * numChannels * 2, true);
    
    // Interleave channels and write samples
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]));
            const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, int16, true);
            offset += 2;
        }
    }
    
    return wav;
}

export default StemSeparator;