// js/DrumReplace.js - Intelligent Drum Replacement System
// Detects and replaces drum hits (kick, snare, hihat) in audio recordings

import { showNotification } from './utils.js';

// Drum type classification based on frequency characteristics
const DRUM_TYPES = {
    KICK: 'kick',
    SNARE: 'snare',
    HIHAT_CLOSED: 'hihat_closed',
    HIHAT_OPEN: 'hihat_open',
    TOM: 'tom',
    UNKNOWN: 'unknown'
};

// Frequency ranges for drum classification
const FREQUENCY_BANDS = {
    KICK: { low: 30, high: 150 },      // Deep bass
    SNARE: { low: 150, high: 400 },    // Midrange attack
    HIHAT: { low: 4000, high: 12000 }, // High frequency
    TOM: { low: 100, high: 300 }        // Low-mid
};

// Attack threshold for transient detection
const TRANSIENT_THRESHOLD = 0.3;
const MIN_INTERVAL_MS = 50; // Minimum time between hits

export class DrumReplace {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.isAnalyzing = false;
        this.detectedHits = [];
        this.replacementSamples = {};
        this.onHitsDetected = null;
    }

    async initialize() {
        if (this.audioContext) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        console.log('[DrumReplace] Initialized');
    }

    /**
     * Load an audio buffer from a file or blob
     */
    async loadAudioBuffer(source) {
        await this.initialize();
        let arrayBuffer;
        
        if (source instanceof File || source instanceof Blob) {
            arrayBuffer = await source.arrayBuffer();
        } else if (typeof source === 'string') {
            const response = await fetch(source);
            arrayBuffer = await response.arrayBuffer();
        } else {
            throw new Error('Invalid audio source');
        }
        
        return await this.audioContext.decodeAudioData(arrayBuffer);
    }

    /**
     * Detect transients in audio data
     */
    detectTransients(audioBuffer) {
        const data = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const transients = [];
        
        // Calculate energy in short windows
        const windowSize = Math.floor(sampleRate * 0.005); // 5ms windows
        const hopSize = Math.floor(windowSize / 2);
        
        let prevEnergy = 0;
        let lastTransientTime = 0;
        
        for (let i = 0; i < data.length - windowSize; i += hopSize) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += data[i + j] * data[i + j];
            }
            energy = Math.sqrt(energy / windowSize);
            
            // Detect sudden increase in energy (transient)
            const delta = energy - prevEnergy;
            if (delta > TRANSIENT_THRESHOLD && energy > 0.05) {
                const timeMs = (i / sampleRate) * 1000;
                // Enforce minimum interval between hits
                if (timeMs - lastTransientTime > MIN_INTERVAL_MS) {
                    transients.push({
                        time: i / sampleRate,
                        timeMs: timeMs,
                        energy: energy,
                        delta: delta
                    });
                    lastTransientTime = timeMs;
                }
            }
            prevEnergy = energy * 0.9 + prevEnergy * 0.1; // Smooth decay
        }
        
        return transients;
    }

    /**
     * Classify a drum hit based on spectral content around the transient
     */
    classifyHit(audioBuffer, transientIndex, transients) {
        if (transientIndex >= transients.length) return DRUM_TYPES.UNKNOWN;
        
        const transient = transients[transientIndex];
        const sampleRate = audioBuffer.sampleRate;
        const data = audioBuffer.getChannelData(0);
        
        // Window around the transient
        const windowStart = Math.floor((transient.time - 0.01) * sampleRate);
        const windowEnd = Math.floor((transient.time + 0.05) * sampleRate);
        const windowLength = windowEnd - windowStart;
        
        if (windowStart < 0 || windowEnd > data.length) return DRUM_TYPES.UNKNOWN;
        
        // Calculate energy in different frequency bands
        const fftSize = 1024;
        const fft = new FFT(fftSize);
        
        // Simple frequency analysis using DFT for key bands
        const bands = {
            bass: this.calculateBandEnergy(data, windowStart, windowLength, 30, 150, sampleRate),
            mid: this.calculateBandEnergy(data, windowStart, windowLength, 150, 400, sampleRate),
            high: this.calculateBandEnergy(data, windowStart, windowLength, 4000, 12000, sampleRate)
        };
        
        // Classification logic
        if (bands.bass > bands.mid && bands.bass > bands.high && bands.bass > 0.3) {
            // Strong bass content = kick
            return DRUM_TYPES.KICK;
        } else if (bands.mid > bands.bass && bands.mid > bands.high * 0.5) {
            // Midrange dominant with some high = snare
            // Check for characteristic snare rattle
            const midHigh = this.calculateBandEnergy(data, windowStart, windowLength, 400, 2000, sampleRate);
            if (midHigh > bands.mid * 0.3) {
                return DRUM_TYPES.SNARE;
            }
            return DRUM_TYPES.TOM;
        } else if (bands.high > bands.mid && bands.high > bands.bass) {
            // High frequency dominant = hihat
            // Check duration to distinguish open/closed
            const duration = this.measureDecayTime(audioBuffer, transient.time, sampleRate);
            if (duration > 0.15) {
                return DRUM_TYPES.HIHAT_OPEN;
            }
            return DRUM_TYPES.HIHAT_CLOSED;
        }
        
        return DRUM_TYPES.UNKNOWN;
    }

    /**
     * Calculate energy in a frequency band using simple Goertzel-like algorithm
     */
    calculateBandEnergy(data, start, length, lowFreq, highFreq, sampleRate) {
        const binSize = sampleRate / length;
        const lowBin = Math.floor(lowFreq / binSize);
        const highBin = Math.floor(highFreq / binSize);
        
        let energy = 0;
        for (let i = lowBin; i <= highBin && i < length; i++) {
            let sumReal = 0, sumImag = 0;
            const omega = (2 * Math.PI * i) / length;
            
            for (let j = 0; j < length; j++) {
                const angle = omega * j;
                sumReal += data[start + j] * Math.cos(angle);
                sumImag += data[start + j] * Math.sin(angle);
            }
            energy += (sumReal * sumReal + sumImag * sumImag) / length;
        }
        
        return Math.sqrt(energy);
    }

    /**
     * Measure decay time to distinguish open/closed hihats
     */
    measureDecayTime(audioBuffer, startTime, sampleRate) {
        const data = audioBuffer.getChannelData(0);
        const startSample = Math.floor(startTime * sampleRate);
        const initialEnergy = Math.abs(data[startSample]);
        
        // Find time until energy drops to 10%
        for (let i = 1; i < data.length - startSample; i++) {
            if (Math.abs(data[startSample + i]) < initialEnergy * 0.1) {
                return i / sampleRate;
            }
        }
        return 0.3; // Default decay time
    }

    /**
     * Analyze audio and detect all drum hits
     */
    async analyzeAudio(audioSource) {
        await this.initialize();
        
        const audioBuffer = await this.loadAudioBuffer(audioSource);
        const transients = this.detectTransients(audioBuffer);
        
        this.detectedHits = [];
        
        for (let i = 0; i < transients.length; i++) {
            const type = this.classifyHit(audioBuffer, i, transients);
            this.detectedHits.push({
                index: i,
                time: transients[i].time,
                timeMs: transients[i].timeMs,
                type: type,
                energy: transients[i].energy,
                transientIndex: i
            });
        }
        
        console.log(`[DrumReplace] Detected ${this.detectedHits.length} drum hits`);
        
        if (this.onHitsDetected) {
            this.onHitsDetected(this.detectedHits);
        }
        
        return this.detectedHits;
    }

    /**
     * Get hit statistics by type
     */
    getHitStats() {
        const stats = {};
        for (const type of Object.values(DRUM_TYPES)) {
            stats[type] = 0;
        }
        
        for (const hit of this.detectedHits) {
            if (stats[hit.type] !== undefined) {
                stats[hit.type]++;
            } else {
                stats[DRUM_TYPES.UNKNOWN]++;
            }
        }
        
        return stats;
    }

    /**
     * Set replacement sample for a drum type
     */
    setReplacementSample(drumType, audioSource) {
        this.replacementSamples[drumType] = audioSource;
        console.log(`[DrumReplace] Set replacement for ${drumType}`);
    }

    /**
     * Apply drum replacement to audio buffer
     * Returns a new audio buffer with replacements applied
     */
    async applyReplacement(audioSource) {
        const audioBuffer = await this.loadAudioBuffer(audioSource);
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        
        // Create offline context for rendering
        const offlineCtx = new OfflineAudioContext(
            numChannels,
            audioBuffer.length,
            sampleRate
        );
        
        // Clone the original buffer
        const newBuffer = audioBuffer;
        const newData = [];
        for (let c = 0; c < numChannels; c++) {
            newData.push(new Float32Array(audioBuffer.getChannelData(c)));
        }
        
        // Apply replacements at each detected hit
        for (const hit of this.detectedHits) {
            if (this.replacementSamples[hit.type]) {
                await this.spliceSample(
                    newData,
                    hit.time,
                    sampleRate,
                    this.replacementSamples[hit.type],
                    offlineCtx
                );
            }
        }
        
        console.log(`[DrumReplace] Applied replacements`);
        return newBuffer;
    }

    /**
     * Splice a replacement sample at a specific time position
     */
    async spliceSample(data, startTime, sampleRate, replacementSource, audioCtx) {
        const replacementBuffer = await this.loadAudioBuffer(replacementSource);
        const startSample = Math.floor(startTime * sampleRate);
        const replacementData = replacementBuffer.getChannelData(0);
        
        // Crossfade parameters
        const crossfadeSamples = Math.floor(sampleRate * 0.01); // 10ms crossfade
        
        for (let channel = 0; channel < data.length; channel++) {
            const channelData = data[channel];
            const repChannelData = replacementBuffer.getChannelData(
                Math.min(channel, replacementBuffer.numberOfChannels - 1)
            );
            
            // Calculate splice region
            const repLength = repChannelData.length;
            const endSample = Math.min(startSample + repLength, channelData.length);
            const actualLength = endSample - startSample;
            
            // Apply crossfade at start
            for (let i = 0; i < crossfadeSamples && startSample + i < channelData.length; i++) {
                const t = i / crossfadeSamples;
                const origValue = channelData[startSample + i];
                const repValue = repChannelData[i] || 0;
                channelData[startSample + i] = origValue * (1 - t) + repValue * t;
            }
            
            // Apply main replacement (after crossfade)
            for (let i = crossfadeSamples; i < actualLength && startSample + i < channelData.length; i++) {
                channelData[startSample + i] = repChannelData[i] || 0;
            }
            
            // Apply crossfade at end
            const endFadeStart = startSample + actualLength - crossfadeSamples;
            for (let i = 0; i < crossfadeSamples && endFadeStart + i < channelData.length; i++) {
                const t = i / crossfadeSamples;
                const repValue = repChannelData[actualLength - crossfadeSamples + i] || 0;
                channelData[endFadeStart + i] = repValue * (1 - t) + channelData[endFadeStart + i] * t;
            }
        }
    }

    /**
     * Export the replaced audio as a WAV blob
     */
    async exportAsWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = audioBuffer.length * blockAlign;
        
        const wavBuffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(wavBuffer);
        
        // RIFF header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        this.writeString(view, 8, 'WAVE');
        
        // fmt chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        
        // data chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);
        
        // Write audio data
        let offset = 44;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }
        
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    dispose() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.analyser = null;
        this.detectedHits = [];
        this.replacementSamples = {};
    }
}

// Simple FFT implementation for frequency analysis
class FFT {
    constructor(size) {
        this.size = size;
        this.cosTable = new Float64Array(size / 2);
        this.sinTable = new Float64Array(size / 2);
        
        for (let i = 0; i < size / 2; i++) {
            this.cosTable[i] = Math.cos(2 * Math.PI * i / size);
            this.sinTable[i] = Math.sin(2 * Math.PI * i / size);
        }
    }
}

// Singleton instance
let drumReplaceInstance = null;

export function getDrumReplace() {
    if (!drumReplaceInstance) {
        drumReplaceInstance = new DrumReplace();
    }
    return drumReplaceInstance;
}

export function initDrumReplace() {
    console.log('[DrumReplace] Module initialized');
}