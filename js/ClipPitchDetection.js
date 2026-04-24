/**
 * Clip Pitch Detection - Detect pitch of audio clips
 * Uses autocorrelation and FFT-based methods for pitch detection
 */

class ClipPitchDetection {
    constructor() {
        this.minFrequency = 20; // Hz
        this.maxFrequency = 2000; // Hz
        this.bufferSize = 4096;
        this.confidenceThreshold = 0.8;
        this.detectedPitches = [];
        this.audioContext = null;
    }

    async initialize() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        return true;
    }

    /**
     * Detect fundamental frequency using autocorrelation
     * @param {Float32Array} buffer - Audio buffer
     * @param {number} sampleRate - Sample rate
     * @returns {Object} - Detected pitch info
     */
    detectPitchAutocorrelation(buffer, sampleRate) {
        const bufferSize = Math.min(buffer.length, this.bufferSize);
        const correlations = new Float32Array(bufferSize);

        // Calculate autocorrelation
        for (let lag = 0; lag < bufferSize; lag++) {
            let sum = 0;
            for (let i = 0; i < bufferSize - lag; i++) {
                sum += buffer[i] * buffer[i + lag];
            }
            correlations[lag] = sum;
        }

        // Normalize
        const maxCorr = Math.max(...correlations);
        if (maxCorr === 0) return null;

        // Find first peak after initial decay
        let bestLag = 0;
        let bestCorr = 0;
        let started = false;

        const minLag = Math.floor(sampleRate / this.maxFrequency);
        const maxLag = Math.floor(sampleRate / this.minFrequency);

        for (let lag = minLag; lag < Math.min(maxLag, bufferSize); lag++) {
            // Start looking after correlation drops below 0.5
            if (!started && correlations[lag] < maxCorr * 0.5) {
                started = true;
            }
            if (started && correlations[lag] > bestCorr) {
                bestCorr = correlations[lag];
                bestLag = lag;
            }
        }

        if (bestLag === 0) return null;

        const frequency = sampleRate / bestLag;
        const confidence = bestCorr / maxCorr;

        return {
            frequency,
            confidence,
            method: 'autocorrelation'
        };
    }

    /**
     * Detect pitch using FFT-based cepstrum method
     * @param {Float32Array} buffer - Audio buffer
     * @param {number} sampleRate - Sample rate
     * @returns {Object} - Detected pitch info
     */
    detectPitchCepstrum(buffer, sampleRate) {
        const n = buffer.length;
        const fftSize = this.bufferSize;

        // Compute log magnitude spectrum
        const spectrum = new Float32Array(fftSize / 2);
        for (let k = 0; k < fftSize / 2; k++) {
            let real = 0, imag = 0;
            for (let t = 0; t < n && t < fftSize; t++) {
                const angle = 2 * Math.PI * k * t / fftSize;
                real += buffer[t] * Math.cos(angle);
                imag -= buffer[t] * Math.sin(angle);
            }
            spectrum[k] = Math.log(Math.sqrt(real * real + imag * imag) + 1e-10);
        }

        // Compute cepstrum (IFFT of log spectrum)
        const cepstrum = new Float32Array(fftSize / 2);
        for (let quefrency = 0; quefrency < fftSize / 2; quefrency++) {
            let sum = 0;
            for (let k = 0; k < fftSize / 2; k++) {
                const angle = 2 * Math.PI * k * quefrency / fftSize;
                sum += spectrum[k] * Math.cos(angle);
            }
            cepstrum[quefrency] = sum;
        }

        // Find peak in cepstrum (quefrency corresponds to period)
        const minQuefrency = Math.floor(sampleRate / this.maxFrequency);
        const maxQuefrency = Math.floor(sampleRate / this.minFrequency);

        let bestQuefrency = 0;
        let bestValue = -Infinity;

        for (let q = minQuefrency; q < Math.min(maxQuefrency, cepstrum.length); q++) {
            if (cepstrum[q] > bestValue) {
                bestValue = cepstrum[q];
                bestQuefrency = q;
            }
        }

        if (bestQuefrency === 0) return null;

        const frequency = sampleRate / bestQuefrency;

        return {
            frequency,
            confidence: bestValue / Math.max(...cepstrum),
            method: 'cepstrum'
        };
    }

    /**
     * Convert frequency to MIDI note number
     * @param {number} frequency - Frequency in Hz
     * @returns {Object} - MIDI note info
     */
    frequencyToMidi(frequency) {
        if (!frequency || frequency <= 0) return null;

        // MIDI note number: 69 = A4 (440 Hz)
        const midiNote = 69 + 12 * Math.log2(frequency / 440);
        const roundedNote = Math.round(midiNote);
        const cents = Math.round((midiNote - roundedNote) * 100);

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteName = noteNames[roundedNote % 12];
        const octave = Math.floor(roundedNote / 12) - 1;

        return {
            midiNote: roundedNote,
            noteName,
            octave,
            fullNote: `${noteName}${octave}`,
            cents,
            frequency
        };
    }

    /**
     * Detect pitch from audio buffer
     * @param {AudioBuffer} audioBuffer - Audio buffer
     * @returns {Object} - Detection result
     */
    async detectFromBuffer(audioBuffer) {
        if (!audioBuffer) {
            return { error: 'No audio buffer provided' };
        }

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        // Try both methods and pick the better one
        const autocorr = this.detectPitchAutocorrelation(channelData, sampleRate);
        const cepstrum = this.detectPitchCepstrum(channelData, sampleRate);

        let bestResult = null;

        if (autocorr && autocorr.confidence > (cepstrum?.confidence || 0)) {
            bestResult = autocorr;
        } else if (cepstrum) {
            bestResult = cepstrum;
        }

        if (!bestResult) {
            return { error: 'No pitch detected' };
        }

        const midiInfo = this.frequencyToMidi(bestResult.frequency);

        return {
            ...bestResult,
            ...midiInfo,
            duration: audioBuffer.duration
        };
    }

    /**
     * Detect pitch over time (pitch tracking)
     * @param {AudioBuffer} audioBuffer - Audio buffer
     * @param {number} hopSize - Hop size in samples
     * @returns {Array} - Array of pitch detections over time
     */
    async trackPitch(audioBuffer, hopSize = 2048) {
        if (!audioBuffer) return [];

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const pitches = [];

        for (let i = 0; i < channelData.length - this.bufferSize; i += hopSize) {
            const frame = channelData.slice(i, i + this.bufferSize);
            const result = this.detectPitchAutocorrelation(frame, sampleRate);

            if (result && result.confidence > this.confidenceThreshold) {
                const midiInfo = this.frequencyToMidi(result.frequency);
                pitches.push({
                    time: i / sampleRate,
                    ...result,
                    ...midiInfo
                });
            } else {
                pitches.push({
                    time: i / sampleRate,
                    frequency: null,
                    midiNote: null
                });
            }
        }

        return pitches;
    }

    /**
     * Get average pitch from audio clip
     * @param {AudioBuffer} audioBuffer - Audio buffer
     * @returns {Object} - Average pitch result
     */
    async getAveragePitch(audioBuffer) {
        const pitches = await this.trackPitch(audioBuffer);
        const validPitches = pitches.filter(p => p.frequency !== null);

        if (validPitches.length === 0) {
            return { error: 'No valid pitches detected' };
        }

        // Use median for robustness
        const frequencies = validPitches.map(p => p.frequency).sort((a, b) => a - b);
        const medianFreq = frequencies[Math.floor(frequencies.length / 2)];

        const avgConfidence = validPitches.reduce((sum, p) => sum + p.confidence, 0) / validPitches.length;
        const midiInfo = this.frequencyToMidi(medianFreq);

        return {
            ...midiInfo,
            confidence: avgConfidence,
            pitchCount: validPitches.length,
            duration: audioBuffer.duration
        };
    }

    /**
     * Detect multiple pitches (chord detection)
     * @param {AudioBuffer} audioBuffer - Audio buffer
     * @returns {Object} - Chord detection result
     */
    async detectChord(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        // FFT to find multiple peaks
        const fftSize = 4096;
        const spectrum = new Float32Array(fftSize / 2);

        for (let k = 0; k < fftSize / 2; k++) {
            let real = 0, imag = 0;
            for (let t = 0; t < Math.min(channelData.length, fftSize); t++) {
                const angle = 2 * Math.PI * k * t / fftSize;
                real += channelData[t] * Math.cos(angle);
                imag -= channelData[t] * Math.sin(angle);
            }
            spectrum[k] = Math.sqrt(real * real + imag * imag);
        }

        // Find peaks in spectrum
        const peaks = [];
        for (let k = 2; k < fftSize / 2 - 2; k++) {
            if (spectrum[k] > spectrum[k - 1] &&
                spectrum[k] > spectrum[k + 1] &&
                spectrum[k] > spectrum[k - 2] &&
                spectrum[k] > spectrum[k + 2]) {
                const frequency = k * sampleRate / fftSize;
                if (frequency >= this.minFrequency && frequency <= this.maxFrequency) {
                    peaks.push({
                        frequency,
                        magnitude: spectrum[k],
                        bin: k
                    });
                }
            }
        }

        // Sort by magnitude and take top peaks
        peaks.sort((a, b) => b.magnitude - a.magnitude);
        const topPeaks = peaks.slice(0, 6);

        // Convert to MIDI notes
        const notes = topPeaks.map(p => ({
            ...this.frequencyToMidi(p.frequency),
            magnitude: p.magnitude
        }));

        // Detect chord from notes
        const uniqueNotes = [...new Set(notes.map(n => n.midiNote).filter(n => n))];
        const chordName = this.identifyChord(uniqueNotes);

        return {
            notes,
            chord: chordName,
            fundamental: notes[0] || null
        };
    }

    /**
     * Identify chord from MIDI notes
     * @param {Array} midiNotes - Array of MIDI note numbers
     * @returns {Object} - Chord identification
     */
    identifyChord(midiNotes) {
        if (midiNotes.length < 3) return { name: 'N/A', quality: 'unknown' };

        // Get intervals from root
        const root = Math.min(...midiNotes);
        const intervals = [...new Set(midiNotes.map(n => (n - root) % 12))].sort((a, b) => a - b);

        // Chord patterns
        const patterns = {
            '0,4,7': { name: 'Major', quality: 'major' },
            '0,3,7': { name: 'Minor', quality: 'minor' },
            '0,4,7,10': { name: 'Dominant 7', quality: 'dominant' },
            '0,4,7,11': { name: 'Major 7', quality: 'major' },
            '0,3,7,10': { name: 'Minor 7', quality: 'minor' },
            '0,3,6': { name: 'Diminished', quality: 'diminished' },
            '0,4,8': { name: 'Augmented', quality: 'augmented' },
            '0,5,7': { name: 'Sus4', quality: 'sus' },
            '0,2,7': { name: 'Sus2', quality: 'sus' }
        };

        const patternKey = intervals.join(',');
        const pattern = patterns[patternKey];

        if (pattern) {
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const rootName = noteNames[root % 12];
            return {
                name: `${rootName} ${pattern.name}`,
                quality: pattern.quality,
                root: rootName
            };
        }

        return { name: 'Unknown', quality: 'unknown', intervals };
    }

    /**
     * Open pitch detection panel
     */
    openDetectionPanel(clips, onResult) {
        const existing = document.getElementById('pitch-detection-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'pitch-detection-panel';

        panel.innerHTML = `
            <div class="pitch-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 600px;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">🎵 Clip Pitch Detection</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Select Clip</label>
                    <select id="pitch-clip-select" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        <option value="">Select a clip...</option>
                        ${(clips || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>

                <div style="margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button id="detect-single" style="padding: 10px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Detect Pitch
                    </button>
                    <button id="detect-track" style="padding: 10px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Track Pitch Over Time
                    </button>
                </div>

                <div id="pitch-result" style="display: none; background: #2a2a4e; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div>
                            <div style="color: #a0a0a0; font-size: 12px;">Detected Note</div>
                            <div id="detected-note" style="font-size: 48px; font-weight: bold; color: #10b981;">--</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="color: #a0a0a0; font-size: 12px;">Frequency</div>
                            <div id="detected-freq" style="font-size: 24px; color: #fff;">-- Hz</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 12px;">
                        <div>
                            <div style="color: #6b7280;">MIDI Note</div>
                            <div id="detected-midi" style="color: #fff;">--</div>
                        </div>
                        <div>
                            <div style="color: #6b7280;">Cents</div>
                            <div id="detected-cents" style="color: #fff;">--</div>
                        </div>
                        <div>
                            <div style="color: #6b7280;">Confidence</div>
                            <div id="detected-conf" style="color: #fff;">--</div>
                        </div>
                    </div>
                </div>

                <div id="pitch-graph" style="display: none; background: #2a2a4e; padding: 16px; border-radius: 4px; margin-bottom: 16px; height: 150px; overflow: hidden;">
                    <canvas id="pitch-canvas" width="540" height="130"></canvas>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="pitch-apply" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" disabled>
                        Apply Transpose
                    </button>
                    <button id="pitch-close" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #pitch-detection-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // State
        let currentDetection = null;

        // Event handlers
        const clipSelect = document.getElementById('pitch-clip-select');
        const detectSingleBtn = document.getElementById('detect-single');
        const detectTrackBtn = document.getElementById('detect-track');
        const resultDiv = document.getElementById('pitch-result');
        const graphDiv = document.getElementById('pitch-graph');
        const applyBtn = document.getElementById('pitch-apply');
        const closeBtn = document.getElementById('pitch-close');

        // Detect single pitch
        detectSingleBtn.addEventListener('click', async () => {
            const clipId = clipSelect.value;
            if (!clipId) return;

            const clip = clips.find(c => c.id === clipId);
            if (!clip || !clip.audioBuffer) {
                alert('No audio in selected clip');
                return;
            }

            const result = await this.detectFromBuffer(clip.audioBuffer);
            currentDetection = result;

            if (result.error) {
                document.getElementById('detected-note').textContent = 'Error';
                document.getElementById('detected-freq').textContent = result.error;
            } else {
                document.getElementById('detected-note').textContent = result.fullNote || '--';
                document.getElementById('detected-freq').textContent = `${Math.round(result.frequency)} Hz`;
                document.getElementById('detected-midi').textContent = result.midiNote || '--';
                document.getElementById('detected-cents').textContent = `${result.cents || 0}¢`;
                document.getElementById('detected-conf').textContent = `${Math.round(result.confidence * 100)}%`;
            }

            resultDiv.style.display = 'block';
            graphDiv.style.display = 'none';
            applyBtn.disabled = false;
        });

        // Track pitch over time
        detectTrackBtn.addEventListener('click', async () => {
            const clipId = clipSelect.value;
            if (!clipId) return;

            const clip = clips.find(c => c.id === clipId);
            if (!clip || !clip.audioBuffer) {
                alert('No audio in selected clip');
                return;
            }

            const pitches = await this.trackPitch(clip.audioBuffer);

            resultDiv.style.display = 'block';
            graphDiv.style.display = 'block';
            applyBtn.disabled = false;

            // Draw pitch graph
            const canvas = document.getElementById('pitch-canvas');
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const validPitches = pitches.filter(p => p.midiNote);
            if (validPitches.length === 0) {
                ctx.fillStyle = '#6b7280';
                ctx.font = '12px sans-serif';
                ctx.fillText('No pitches detected', 10, 70);
                return;
            }

            const minMidi = Math.min(...validPitches.map(p => p.midiNote));
            const maxMidi = Math.max(...validPitches.map(p => p.midiNote));
            const duration = clip.audioBuffer.duration;

            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();

            let started = false;
            pitches.forEach((p, i) => {
                if (p.midiNote) {
                    const x = (p.time / duration) * canvas.width;
                    const y = canvas.height - ((p.midiNote - minMidi) / (maxMidi - minMidi + 1)) * canvas.height * 0.9 - 10;

                    if (!started) {
                        ctx.moveTo(x, y);
                        started = true;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });

            ctx.stroke();
        });

        // Apply transpose
        applyBtn.addEventListener('click', () => {
            if (currentDetection && currentDetection.midiNote && onResult) {
                onResult(currentDetection);
            }

            panel.remove();
            style.remove();
        });

        // Close
        closeBtn.addEventListener('click', () => {
            panel.remove();
            style.remove();
        });
    }
}

// Export singleton
const clipPitchDetection = new ClipPitchDetection();

export { ClipPitchDetection, clipPitchDetection };