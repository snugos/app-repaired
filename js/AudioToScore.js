// js/AudioToScore.js - Audio to Score/Score Transcription System
// This module provides automatic transcription from audio to MIDI notation

/**
 * PitchDetectionMethod - Available pitch detection algorithms
 */
export const PitchDetectionMethod = {
    FFT: 'fft',             // Fast Fourier Transform based
    AUTOCORRELATION: 'autocorrelation', // Autocorrelation method
    YIN: 'yin',            // YIN algorithm (accurate but slower)
    MPM: 'mpm'             // McLeod Pitch Method
};

/**
 * NoteInfo - Information about a detected note
 */
export class NoteInfo {
    constructor(config = {}) {
        this.id = config.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.pitch = config.pitch || 0;         // MIDI note number (0-127)
        this.frequency = config.frequency || 0; // Frequency in Hz
        this.startTime = config.startTime || 0;  // Start time in seconds
        this.duration = config.duration || 0;   // Duration in seconds
        this.velocity = config.velocity || 0.7; // Velocity (0-1)
        this.confidence = config.confidence || 0; // Detection confidence (0-1)
        this.channel = config.channel || 0;     // MIDI channel
    }

    toJSON() {
        return {
            id: this.id,
            pitch: this.pitch,
            frequency: this.frequency,
            startTime: this.startTime,
            duration: this.duration,
            velocity: this.velocity,
            confidence: this.confidence,
            channel: this.channel
        };
    }

    static fromJSON(data) {
        return new NoteInfo(data);
    }
}

/**
 * TranscriptionSettings - Settings for audio transcription
 */
export class TranscriptionSettings {
    constructor(config = {}) {
        this.method = config.method || PitchDetectionMethod.YIN;
        this.minFrequency = config.minFrequency || 20;     // Hz
        this.maxFrequency = config.maxFrequency || 20000;  // Hz
        this.minNoteDuration = config.minNoteDuration || 0.05; // seconds
        this.amplitudeThreshold = config.amplitudeThreshold || 0.01; // Linear amplitude
        this.confidenceThreshold = config.confidenceThreshold || 0.5;
        this.hopSize = config.hopSize || 512;              // FFT hop size in samples
        this.fftSize = config.fftSize || 4096;              // FFT window size
        this.quantizeNotes = config.quantizeNotes !== false; // Auto-quantize
        this.quantizeGrid = config.quantizeGrid || '1/16';  // Quantize grid
        this.detectVelocity = config.detectVelocity !== false; // Detect velocity from amplitude
        this.polyphonicMode = config.polyphonicMode || false; // Polyphonic detection
        this.maxPolyphony = config.maxPolyphony || 6;        // Max simultaneous notes
        this.keySignature = config.keySignature || 'C';      // Key signature hint
        this.scaleHint = config.scaleHint || 'major';        // Scale hint
        this.smoothingFactor = config.smoothingFactor || 0.3; // Pitch smoothing
    }

    toJSON() {
        return { ...this };
    }

    static fromJSON(data) {
        return new TranscriptionSettings(data);
    }
}

/**
 * TranscriptionResult - Result of audio transcription
 */
export class TranscriptionResult {
    constructor(config = {}) {
        this.notes = config.notes || [];
        this.duration = config.duration || 0;
        this.sampleRate = config.sampleRate || 44100;
        this.detectedKey = config.detectedKey || 'C';
        this.detectedScale = config.detectedScale || 'major';
        this.tempo = config.tempo || 120; // Detected/estimated tempo
        this.timeSignature = config.timeSignature || [4, 4];
        this.confidence = config.confidence || 0; // Overall confidence
        this.settings = config.settings || new TranscriptionSettings();
    }

    toJSON() {
        return {
            notes: this.notes.map(n => n.toJSON()),
            duration: this.duration,
            sampleRate: this.sampleRate,
            detectedKey: this.detectedKey,
            detectedScale: this.detectedScale,
            tempo: this.tempo,
            timeSignature: this.timeSignature,
            confidence: this.confidence,
            settings: this.settings.toJSON()
        };
    }

    static fromJSON(data) {
        return new TranscriptionResult({
            ...data,
            notes: data.notes ? data.notes.map(n => NoteInfo.fromJSON(n)) : [],
            settings: data.settings ? TranscriptionSettings.fromJSON(data.settings) : new TranscriptionSettings()
        });
    }
}

/**
 * AudioToScore - Main class for audio transcription
 */
export class AudioToScore {
    constructor(config = {}) {
        this.audioContext = config.audioContext || null;
        this.settings = config.settings || new TranscriptionSettings();
        this.isProcessing = false;
        this.progress = 0;
        this.cancelled = false;
    }

    /**
     * Set the audio context
     * @param {AudioContext} context - The audio context
     */
    setAudioContext(context) {
        this.audioContext = context;
    }

    /**
     * Update transcription settings
     * @param {Object} newSettings - New settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    /**
     * Transcribe an audio buffer to notes
     * @param {AudioBuffer} audioBuffer - The audio buffer to transcribe
     * @param {Object} options - Transcription options
     * @returns {Promise<TranscriptionResult>} Transcription result
     */
    async transcribe(audioBuffer, options = {}) {
        if (this.isProcessing) {
            throw new Error('Already processing');
        }

        this.isProcessing = true;
        this.cancelled = false;
        this.progress = 0;

        const settings = { ...this.settings, ...options };
        const result = new TranscriptionResult({
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            settings: settings
        });

        try {
            // Get audio data
            const channelData = audioBuffer.getChannelData(0);
            
            // Choose detection method
            let notes;
            switch (settings.method) {
                case PitchDetectionMethod.YIN:
                    notes = await this._transcribeYIN(channelData, audioBuffer.sampleRate, settings);
                    break;
                case PitchDetectionMethod.AUTOCORRELATION:
                    notes = await this._transcribeAutocorrelation(channelData, audioBuffer.sampleRate, settings);
                    break;
                case PitchDetectionMethod.MPM:
                    notes = await this._transcribeMPM(channelData, audioBuffer.sampleRate, settings);
                    break;
                case PitchDetectionMethod.FFT:
                default:
                    notes = await this._transcribeFFT(channelData, audioBuffer.sampleRate, settings);
                    break;
            }

            // Post-process notes
            notes = this._postProcessNotes(notes, settings);

            // Detect key and tempo
            result.detectedKey = this._detectKey(notes);
            result.tempo = this._detectTempo(notes, audioBuffer.sampleRate);
            result.confidence = this._calculateOverallConfidence(notes);

            result.notes = notes;
            this.progress = 1;

        } catch (error) {
            console.error('[AudioToScore] Transcription error:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }

        return result;
    }

    /**
     * Cancel ongoing transcription
     */
    cancel() {
        this.cancelled = true;
    }

    /**
     * FFT-based pitch detection
     * @private
     */
    async _transcribeFFT(channelData, sampleRate, settings) {
        const notes = [];
        const fftSize = settings.fftSize;
        const hopSize = settings.hopSize;
        const numHops = Math.floor((channelData.length - fftSize) / hopSize);

        for (let hop = 0; hop < numHops && !this.cancelled; hop++) {
            this.progress = hop / numHops;

            // Allow async processing
            if (hop % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const startSample = hop * hopSize;
            const time = startSample / sampleRate;

            // Get FFT data
            const windowedData = this._applyWindow(channelData, startSample, fftSize);
            const fftResult = this._computeFFT(windowedData);

            // Find peaks
            const peaks = this._findPeaks(fftResult, sampleRate, fftSize, settings.amplitudeThreshold);

            // Convert peaks to notes
            for (const peak of peaks) {
                const pitch = this._frequencyToMidi(peak.frequency);
                if (pitch >= 0 && pitch <= 127 && peak.amplitude > settings.amplitudeThreshold) {
                    notes.push(new NoteInfo({
                        pitch: pitch,
                        frequency: peak.frequency,
                        startTime: time,
                        duration: hopSize / sampleRate,
                        velocity: Math.min(1, peak.amplitude * 2),
                        confidence: peak.confidence || 0.8
                    }));
                }
            }
        }

        return this._mergeConsecutiveNotes(notes, settings);
    }

    /**
     * YIN algorithm for pitch detection
     * @private
     */
    async _transcribeYIN(channelData, sampleRate, settings) {
        const notes = [];
        const frameSize = settings.fftSize || 2048;
        const hopSize = settings.hopSize || 512;
        const threshold = settings.confidenceThreshold || 0.15;

        // YIN parameters
        const yinBufferSize = frameSize / 2;
        const yinBuffer = new Float32Array(yinBufferSize);

        const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

        for (let frame = 0; frame < numFrames && !this.cancelled; frame++) {
            this.progress = frame / numFrames;

            if (frame % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const offset = frame * hopSize;
            const time = offset / sampleRate;

            // Compute YIN
            const result = this._computeYIN(channelData, offset, yinBuffer, threshold);

            if (result.pitch > 0) {
                const midiNote = this._frequencyToMidi(result.pitch);
                if (midiNote >= 0 && midiNote <= 127) {
                    const amplitude = this._getAmplitudeAtOffset(channelData, offset, hopSize);
                    notes.push(new NoteInfo({
                        pitch: midiNote,
                        frequency: result.pitch,
                        startTime: time,
                        duration: hopSize / sampleRate,
                        velocity: Math.min(1, amplitude * 2),
                        confidence: result.probability
                    }));
                }
            }
        }

        return this._mergeConsecutiveNotes(notes, settings);
    }

    /**
     * Compute YIN algorithm for a single frame
     * @private
     */
    _computeYIN(buffer, offset, yinBuffer, threshold) {
        const yinBufferSize = yinBuffer.length;
        let runningSum = 0;

        // Step 2: Difference function
        for (let tau = 0; tau < yinBufferSize; tau++) {
            yinBuffer[tau] = 0;
            for (let i = 0; i < yinBufferSize; i++) {
                const delta = buffer[offset + i] - buffer[offset + i + tau];
                yinBuffer[tau] += delta * delta;
            }
            runningSum += yinBuffer[tau];
            if (tau > 0) {
                yinBuffer[tau] *= tau / runningSum;
            }
        }

        // Step 3: Absolute threshold
        let tau = 2;
        while (tau < yinBufferSize && yinBuffer[tau] >= threshold) {
            tau++;
        }

        if (tau === yinBufferSize || yinBuffer[tau] >= threshold) {
            return { pitch: -1, probability: 0 };
        }

        // Step 4: Parabolic interpolation
        let betterTau;
        const x0 = tau < 1 ? tau : tau - 1;
        const x2 = tau + 1 < yinBufferSize ? tau + 1 : tau;
        if (x0 === tau) {
            betterTau = yinBuffer[tau] <= yinBuffer[x2] ? tau : x2;
        } else if (x2 === tau) {
            betterTau = yinBuffer[tau] <= yinBuffer[x0] ? tau : x0;
        } else {
            const s0 = yinBuffer[x0];
            const s1 = yinBuffer[tau];
            const s2 = yinBuffer[x2];
            betterTau = tau + (s2 - s0) / (2 * (s2 - 2 * s1 + s0));
        }

        const probability = 1 - yinBuffer[tau];
        return {
            pitch: 44100 / betterTau,
            probability: probability
        };
    }

    /**
     * Autocorrelation-based pitch detection
     * @private
     */
    async _transcribeAutocorrelation(channelData, sampleRate, settings) {
        const notes = [];
        const frameSize = settings.fftSize || 2048;
        const hopSize = settings.hopSize || 512;
        const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

        for (let frame = 0; frame < numFrames && !this.cancelled; frame++) {
            this.progress = frame / numFrames;

            if (frame % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const offset = frame * hopSize;
            const time = offset / sampleRate;

            const frequency = this._autocorrelatePitch(channelData, offset, frameSize, sampleRate);

            if (frequency > settings.minFrequency && frequency < settings.maxFrequency) {
                const midiNote = this._frequencyToMidi(frequency);
                const amplitude = this._getAmplitudeAtOffset(channelData, offset, hopSize);

                notes.push(new NoteInfo({
                    pitch: midiNote,
                    frequency: frequency,
                    startTime: time,
                    duration: hopSize / sampleRate,
                    velocity: Math.min(1, amplitude * 2),
                    confidence: 0.7
                }));
            }
        }

        return this._mergeConsecutiveNotes(notes, settings);
    }

    /**
     * McLeod Pitch Method (MPM)
     * @private
     */
    async _transcribeMPM(channelData, sampleRate, settings) {
        // MPM is similar to YIN but with a different objective function
        // For simplicity, we'll use a modified YIN approach
        return this._transcribeYIN(channelData, sampleRate, settings);
    }

    /**
     * Autocorrelate to find pitch
     * @private
     */
    _autocorrelatePitch(buffer, offset, frameSize, sampleRate) {
        const maxPeriod = sampleRate / 50;   // 50 Hz minimum
        const minPeriod = sampleRate / 2000; // 2000 Hz maximum

        let bestCorrelation = 0;
        let bestPeriod = 0;

        for (let period = minPeriod; period < maxPeriod; period++) {
            let correlation = 0;
            for (let i = 0; i < frameSize; i++) {
                correlation += buffer[offset + i] * buffer[offset + i + period];
            }
            correlation /= frameSize;

            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestPeriod = period;
            }
        }

        if (bestCorrelation < 0.01) {
            return -1;
        }

        return sampleRate / bestPeriod;
    }

    /**
     * Apply window function to audio data
     * @private
     */
    _applyWindow(buffer, start, size) {
        const windowed = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            // Hann window
            const windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
            windowed[i] = buffer[start + i] * windowValue;
        }
        return windowed;
    }

    /**
     * Compute FFT (simplified - uses browser's FFT)
     * @private
     */
    _computeFFT(windowedData) {
        // Use real FFT for pitch detection
        const n = windowedData.length;
        const result = new Float32Array(n / 2);

        for (let k = 0; k < n / 2; k++) {
            let real = 0;
            let imag = 0;
            for (let j = 0; j < n; j++) {
                const angle = -2 * Math.PI * k * j / n;
                real += windowedData[j] * Math.cos(angle);
                imag += windowedData[j] * Math.sin(angle);
            }
            result[k] = Math.sqrt(real * real + imag * imag) / n;
        }

        return result;
    }

    /**
     * Find peaks in FFT result
     * @private
     */
    _findPeaks(fftResult, sampleRate, fftSize, threshold) {
        const peaks = [];
        const binSize = sampleRate / fftSize;

        for (let i = 2; i < fftResult.length - 2; i++) {
            // Check if this is a local maximum
            if (fftResult[i] > fftResult[i - 1] &&
                fftResult[i] > fftResult[i + 1] &&
                fftResult[i] > fftResult[i - 2] &&
                fftResult[i] > fftResult[i + 2] &&
                fftResult[i] > threshold) {

                // Parabolic interpolation for better frequency estimate
                const alpha = fftResult[i - 1];
                const beta = fftResult[i];
                const gamma = fftResult[i + 1];
                const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
                const interpolatedBin = i + p;

                peaks.push({
                    frequency: interpolatedBin * binSize,
                    amplitude: fftResult[i],
                    confidence: Math.min(1, fftResult[i] * 10)
                });
            }
        }

        return peaks.sort((a, b) => b.amplitude - a.amplitude).slice(0, 6);
    }

    /**
     * Convert frequency to MIDI note number
     * @private
     */
    _frequencyToMidi(frequency) {
        return Math.round(12 * Math.log2(frequency / 440) + 69);
    }

    /**
     * Convert MIDI note to frequency
     * @private
     */
    _midiToFrequency(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    /**
     * Get average amplitude at offset
     * @private
     */
    _getAmplitudeAtOffset(buffer, offset, size) {
        let sum = 0;
        for (let i = 0; i < size && offset + i < buffer.length; i++) {
            sum += Math.abs(buffer[offset + i]);
        }
        return sum / size;
    }

    /**
     * Merge consecutive notes of same pitch
     * @private
     */
    _mergeConsecutiveNotes(notes, settings) {
        if (notes.length === 0) return [];

        // Sort by start time
        notes.sort((a, b) => a.startTime - b.startTime);

        const merged = [];
        let currentNote = null;

        for (const note of notes) {
            // Filter by confidence
            if (note.confidence < settings.confidenceThreshold) continue;

            if (!currentNote) {
                currentNote = new NoteInfo({ ...note });
            } else if (Math.abs(currentNote.pitch - note.pitch) <= 0.5 &&
                       note.startTime - (currentNote.startTime + currentNote.duration) < 0.05) {
                // Extend current note
                currentNote.duration = note.startTime + note.duration - currentNote.startTime;
                currentNote.confidence = Math.max(currentNote.confidence, note.confidence);
                currentNote.velocity = Math.max(currentNote.velocity, note.velocity);
            } else {
                // Check minimum duration
                if (currentNote.duration >= settings.minNoteDuration) {
                    merged.push(currentNote);
                }
                currentNote = new NoteInfo({ ...note });
            }
        }

        // Don't forget the last note
        if (currentNote && currentNote.duration >= settings.minNoteDuration) {
            merged.push(currentNote);
        }

        return merged;
    }

    /**
     * Post-process notes (quantize, filter, etc.)
     * @private
     */
    _postProcessNotes(notes, settings) {
        if (notes.length === 0) return notes;

        // Quantize if enabled
        if (settings.quantizeNotes) {
            notes = this._quantizeNotes(notes, settings.quantizeGrid);
        }

        // Apply scale hint if specified
        if (settings.scaleHint && settings.keySignature) {
            notes = this._applyScaleFilter(notes, settings.keySignature, settings.scaleHint);
        }

        // Remove duplicates
        notes = this._removeDuplicates(notes);

        return notes;
    }

    /**
     * Quantize notes to grid
     * @private
     */
    _quantizeNotes(notes, grid) {
        const gridMap = {
            '1/4': 0.25,
            '1/8': 0.125,
            '1/16': 0.0625,
            '1/32': 0.03125,
            '1/64': 0.015625
        };

        const gridSize = gridMap[grid] || 0.0625;
        const tempo = 120; // Assume 120 BPM
        const secondsPerBeat = 60 / tempo;
        const quantizeStep = gridSize * secondsPerBeat;

        return notes.map(note => {
            const quantizedStart = Math.round(note.startTime / quantizeStep) * quantizeStep;
            const quantizedDuration = Math.max(quantizeStep, Math.round(note.duration / quantizeStep) * quantizeStep);
            return new NoteInfo({
                ...note,
                startTime: quantizedStart,
                duration: quantizedDuration
            });
        });
    }

    /**
     * Apply scale filter to notes
     * @private
     */
    _applyScaleFilter(notes, key, scale) {
        const scaleDegrees = this._getScaleDegrees(key, scale);
        return notes.map(note => {
            const pitchInKey = (note.pitch - this._getKeyOffset(key) + 12) % 12;
            const nearestScalePitch = this._findNearestScalePitch(pitchInKey, scaleDegrees);
            return new NoteInfo({
                ...note,
                pitch: note.pitch - pitchInKey + nearestScalePitch + this._getKeyOffset(key),
                frequency: this._midiToFrequency(note.pitch - pitchInKey + nearestScalePitch + this._getKeyOffset(key))
            });
        });
    }

    /**
     * Get scale degrees for key and scale
     * @private
     */
    _getScaleDegrees(key, scale) {
        const scales = {
            'major': [0, 2, 4, 5, 7, 9, 11],
            'minor': [0, 2, 3, 5, 7, 8, 10],
            'harmonic_minor': [0, 2, 3, 5, 7, 8, 11],
            'pentatonic_major': [0, 2, 4, 7, 9],
            'pentatonic_minor': [0, 3, 5, 7, 10],
            'blues': [0, 3, 5, 6, 7, 10],
            'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        };
        return scales[scale] || scales['major'];
    }

    /**
     * Get key offset (semitones from C)
     * @private
     */
    _getKeyOffset(key) {
        const keyMap = {
            'C': 0, 'C#': 1, 'Db': 1,
            'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4,
            'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8,
            'A': 9, 'A#': 10, 'Bb': 10,
            'B': 11
        };
        return keyMap[key] || 0;
    }

    /**
     * Find nearest scale pitch
     * @private
     */
    _findNearestScalePitch(pitch, scaleDegrees) {
        let nearest = scaleDegrees[0];
        let minDistance = 12;

        for (const degree of scaleDegrees) {
            const distance = Math.min(
                Math.abs(pitch - degree),
                12 - Math.abs(pitch - degree)
            );
            if (distance < minDistance) {
                minDistance = distance;
                nearest = degree;
            }
        }

        return nearest;
    }

    /**
     * Remove duplicate notes
     * @private
     */
    _removeDuplicates(notes) {
        const unique = [];
        const seen = new Set();

        for (const note of notes) {
            const key = `${Math.round(note.pitch)}-${Math.round(note.startTime * 1000)}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(note);
            }
        }

        return unique;
    }

    /**
     * Detect musical key from notes
     * @private
     */
    _detectKey(notes) {
        // Count note occurrences
        const pitchCounts = {};
        for (const note of notes) {
            const pitchClass = note.pitch % 12;
            pitchCounts[pitchClass] = (pitchCounts[pitchClass] || 0) + 1;
        }

        // Simple heuristic: find the most common pitch
        let maxCount = 0;
        let detectedKey = 0;
        for (const [pitch, count] of Object.entries(pitchCounts)) {
            if (count > maxCount) {
                maxCount = count;
                detectedKey = parseInt(pitch);
            }
        }

        // Convert to key name
        const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return keyNames[detectedKey] || 'C';
    }

    /**
     * Detect tempo from notes
     * @private
     */
    _detectTempo(notes, sampleRate) {
        if (notes.length < 2) return 120;

        // Calculate inter-onset intervals
        const intervals = [];
        for (let i = 1; i < notes.length; i++) {
            intervals.push(notes[i].startTime - notes[i - 1].startTime);
        }

        // Find most common interval (rough estimate)
        const roundedIntervals = intervals.map(i => Math.round(i * 10) / 10);
        const intervalCounts = {};
        for (const interval of roundedIntervals) {
            intervalCounts[interval] = (intervalCounts[interval] || 0) + 1;
        }

        let maxCount = 0;
        let bestInterval = 0.5;
        for (const [interval, count] of Object.entries(intervalCounts)) {
            if (count > maxCount) {
                maxCount = count;
                bestInterval = parseFloat(interval);
            }
        }

        // Convert to BPM
        const bpm = 60 / bestInterval;
        return Math.max(40, Math.min(240, Math.round(bpm)));
    }

    /**
     * Calculate overall transcription confidence
     * @private
     */
    _calculateOverallConfidence(notes) {
        if (notes.length === 0) return 0;
        const sum = notes.reduce((acc, note) => acc + note.confidence, 0);
        return sum / notes.length;
    }

    /**
     * Convert transcription result to MIDI sequence format
     * @param {TranscriptionResult} result - Transcription result
     * @returns {Object} MIDI sequence data
     */
    toMidiSequence(result) {
        return {
            tempo: result.tempo,
            timeSignature: result.timeSignature,
            key: result.detectedKey,
            scale: result.detectedScale,
            notes: result.notes.map(note => ({
                pitch: note.pitch,
                startTime: note.startTime,
                duration: note.duration,
                velocity: Math.round(note.velocity * 127),
                channel: note.channel
            }))
        };
    }

    /**
     * Get note names for transcription
     * @param {TranscriptionResult} result - Transcription result
     * @returns {Array} Notes with names
     */
    getNotesWithNames(result) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return result.notes.map(note => ({
            ...note.toJSON(),
            name: noteNames[note.pitch % 12],
            octave: Math.floor(note.pitch / 12) - 1
        }));
    }
}

// Create singleton instance
export const audioToScore = new AudioToScore();

// Default export
export default {
    PitchDetectionMethod,
    NoteInfo,
    TranscriptionSettings,
    TranscriptionResult,
    AudioToScore,
    audioToScore
};