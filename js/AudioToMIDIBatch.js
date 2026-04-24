/**
 * Audio-to-MIDI Batch - Convert multiple audio clips to MIDI
 * Batch processing for converting audio recordings to MIDI sequences
 */

export class AudioToMIDIBatch {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = this.audioContext?.sampleRate || 44100;
        
        // Processing settings
        this.settings = {
            fftSize: options.fftSize || 4096,
            hopSize: options.hopSize || 512,
            minFrequency: options.minFrequency || 80, // Hz
            maxFrequency: options.maxFrequency || 1200, // Hz
            amplitudeThreshold: options.amplitudeThreshold || -40, // dB
            minNoteDuration: options.minNoteDuration || 0.05, // seconds
            pitchSmoothing: options.pitchSmoothing || 0.1,
            velocitySensitivity: options.velocitySensitivity || 0.8,
            polyphonicMode: options.polyphonicMode || false,
            maxPolyphony: options.maxPolyphony || 4
        };
        
        // Processing queue
        this.queue = [];
        this.isProcessing = false;
        this.currentBatch = null;
        
        // Results storage
        this.results = new Map();
    }
    
    /**
     * Add audio clips to the batch queue
     */
    addToBatch(clips) {
        if (!Array.isArray(clips)) {
            clips = [clips];
        }
        
        for (const clip of clips) {
            this.queue.push({
                id: clip.id || `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                audioBuffer: clip.audioBuffer,
                trackId: clip.trackId,
                startTime: clip.startTime || 0,
                settings: { ...this.settings, ...clip.settings }
            });
        }
        
        console.log(`[AudioToMIDIBatch] Added ${clips.length} clips to queue. Queue size: ${this.queue.length}`);
    }
    
    /**
     * Process all clips in the queue
     */
    async processBatch(progressCallback = null) {
        if (this.isProcessing) {
            console.warn('[AudioToMIDIBatch] Already processing a batch');
            return null;
        }
        
        this.isProcessing = true;
        this.currentBatch = {
            startTime: Date.now(),
            totalClips: this.queue.length,
            processedClips: 0,
            results: []
        };
        
        const batchResults = [];
        
        while (this.queue.length > 0) {
            const clip = this.queue.shift();
            
            try {
                const result = await this.convertAudioToMIDI(clip);
                batchResults.push(result);
                this.results.set(clip.id, result);
                
                this.currentBatch.processedClips++;
                
                if (progressCallback) {
                    progressCallback({
                        progress: this.currentBatch.processedClips / this.currentBatch.totalClips,
                        processed: this.currentBatch.processedClips,
                        total: this.currentBatch.totalClips,
                        currentClip: clip.id,
                        result
                    });
                }
            } catch (error) {
                console.error(`[AudioToMIDIBatch] Error processing clip ${clip.id}:`, error);
                batchResults.push({
                    clipId: clip.id,
                    success: false,
                    error: error.message
                });
            }
        }
        
        this.isProcessing = false;
        this.currentBatch.endTime = Date.now();
        this.currentBatch.results = batchResults;
        
        console.log(`[AudioToMIDIBatch] Batch complete. Processed ${batchResults.length} clips in ${this.currentBatch.endTime - this.currentBatch.startTime}ms`);
        
        return batchResults;
    }
    
    /**
     * Convert a single audio buffer to MIDI
     */
    async convertAudioToMIDI(clipData) {
        const { audioBuffer, settings } = clipData;
        
        if (!audioBuffer) {
            throw new Error('No audio buffer provided');
        }
        
        // Get audio data (mono)
        const channelData = this.getMonoData(audioBuffer);
        
        // Perform pitch detection
        const pitchTrack = this.detectPitch(channelData, audioBuffer.sampleRate, settings);
        
        // Convert pitch track to MIDI notes
        const midiNotes = this.pitchTrackToMIDI(pitchTrack, audioBuffer.sampleRate, settings);
        
        // Post-process: clean up notes
        const cleanedNotes = this.cleanMIDINotes(midiNotes, settings);
        
        return {
            clipId: clipData.id,
            trackId: clipData.trackId,
            startTime: clipData.startTime,
            success: true,
            midiNotes: cleanedNotes,
            pitchTrack,
            duration: audioBuffer.duration,
            noteCount: cleanedNotes.length
        };
    }
    
    /**
     * Get mono audio data from buffer
     */
    getMonoData(audioBuffer) {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }
        
        // Mix down to mono
        const mono = new Float32Array(audioBuffer.length);
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                mono[i] += channelData[i] / audioBuffer.numberOfChannels;
            }
        }
        
        return mono;
    }
    
    /**
     * Detect pitch using autocorrelation
     */
    detectPitch(audioData, sampleRate, settings) {
        const pitches = [];
        const { fftSize, hopSize, minFrequency, maxFrequency, amplitudeThreshold } = settings;
        
        const minPeriod = Math.round(sampleRate / maxFrequency);
        const maxPeriod = Math.round(sampleRate / minFrequency);
        
        let frameStart = 0;
        let frameIndex = 0;
        
        while (frameStart + fftSize < audioData.length) {
            // Get frame energy
            let energy = 0;
            for (let i = frameStart; i < frameStart + fftSize; i++) {
                energy += audioData[i] * audioData[i];
            }
            
            const rmsDb = 10 * Math.log10(energy / fftSize + 1e-10);
            
            if (rmsDb > amplitudeThreshold) {
                // Perform autocorrelation
                const correlation = this.autocorrelate(audioData, frameStart, fftSize, minPeriod, maxPeriod);
                
                // Find the peak (fundamental period)
                let bestPeriod = minPeriod;
                let bestCorrelation = -1;
                
                for (let period = minPeriod; period < maxPeriod; period++) {
                    if (correlation[period] > bestCorrelation) {
                        bestCorrelation = correlation[period];
                        bestPeriod = period;
                    }
                }
                
                // Calculate frequency and confidence
                const frequency = sampleRate / bestPeriod;
                const confidence = bestCorrelation;
                
                if (frequency >= minFrequency && frequency <= maxFrequency && confidence > 0.3) {
                    // Convert to MIDI note
                    const midiNote = this.frequencyToMIDI(frequency);
                    const amplitude = Math.sqrt(energy / fftSize);
                    
                    pitches.push({
                        frameIndex,
                        time: frameStart / sampleRate,
                        frequency,
                        midiNote,
                        confidence,
                        amplitude,
                        rmsDb
                    });
                }
            }
            
            frameStart += hopSize;
            frameIndex++;
        }
        
        return pitches;
    }
    
    /**
     * Autocorrelation function
     */
    autocorrelate(audioData, start, length, minPeriod, maxPeriod) {
        const correlation = new Float32Array(maxPeriod + 1);
        
        for (let lag = minPeriod; lag <= maxPeriod; lag++) {
            let sum = 0;
            let count = 0;
            
            for (let i = start; i < start + length - lag; i++) {
                sum += audioData[i] * audioData[i + lag];
                count++;
            }
            
            correlation[lag] = sum / count;
        }
        
        return correlation;
    }
    
    /**
     * Convert frequency to MIDI note number
     */
    frequencyToMIDI(frequency) {
        // A4 = 440Hz = MIDI 69
        return Math.round(69 + 12 * Math.log2(frequency / 440));
    }
    
    /**
     * Convert MIDI note to frequency
     */
    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }
    
    /**
     * Convert pitch track to MIDI notes
     */
    pitchTrackToMIDI(pitchTrack, sampleRate, settings) {
        if (pitchTrack.length === 0) return [];
        
        const { minNoteDuration, pitchSmoothing, velocitySensitivity } = settings;
        const notes = [];
        
        // Smooth pitch track
        const smoothed = this.smoothPitchTrack(pitchTrack, pitchSmoothing);
        
        // Segment into notes
        let currentNote = null;
        
        for (let i = 0; i < smoothed.length; i++) {
            const pitch = smoothed[i];
            
            if (pitch.midiNote > 0) {
                if (currentNote === null) {
                    // Start new note
                    currentNote = {
                        midiNote: pitch.midiNote,
                        startTime: pitch.time,
                        startFrame: i,
                        velocities: [this.amplitudeToVelocity(pitch.amplitude, velocitySensitivity)],
                        frequencies: [pitch.frequency],
                        confidences: [pitch.confidence]
                    };
                } else if (Math.abs(pitch.midiNote - currentNote.midiNote) > 0.5) {
                    // Pitch changed significantly - end current note and start new
                    currentNote.endTime = pitch.time;
                    currentNote.duration = currentNote.endTime - currentNote.startTime;
                    
                    if (currentNote.duration >= minNoteDuration) {
                        currentNote.velocity = Math.round(
                            currentNote.velocities.reduce((a, b) => a + b) / currentNote.velocities.length
                        );
                        notes.push(currentNote);
                    }
                    
                    currentNote = {
                        midiNote: pitch.midiNote,
                        startTime: pitch.time,
                        startFrame: i,
                        velocities: [this.amplitudeToVelocity(pitch.amplitude, velocitySensitivity)],
                        frequencies: [pitch.frequency],
                        confidences: [pitch.confidence]
                    };
                } else {
                    // Continue current note
                    currentNote.velocities.push(this.amplitudeToVelocity(pitch.amplitude, velocitySensitivity));
                    currentNote.frequencies.push(pitch.frequency);
                    currentNote.confidences.push(pitch.confidence);
                }
            } else if (currentNote !== null) {
                // End current note
                currentNote.endTime = pitch.time;
                currentNote.duration = currentNote.endTime - currentNote.startTime;
                
                if (currentNote.duration >= minNoteDuration) {
                    currentNote.velocity = Math.round(
                        currentNote.velocities.reduce((a, b) => a + b) / currentNote.velocities.length
                    );
                    notes.push(currentNote);
                }
                
                currentNote = null;
            }
        }
        
        // Handle last note
        if (currentNote !== null && smoothed.length > 0) {
            currentNote.endTime = smoothed[smoothed.length - 1].time;
            currentNote.duration = currentNote.endTime - currentNote.startTime;
            
            if (currentNote.duration >= minNoteDuration) {
                currentNote.velocity = Math.round(
                    currentNote.velocities.reduce((a, b) => a + b) / currentNote.velocities.length
                );
                notes.push(currentNote);
            }
        }
        
        return notes;
    }
    
    /**
     * Smooth pitch track using median filtering
     */
    smoothPitchTrack(pitchTrack, smoothing) {
        if (smoothing === 0 || pitchTrack.length < 3) return pitchTrack;
        
        const windowSize = Math.max(3, Math.round(smoothing * 10) * 2 + 1);
        const smoothed = [];
        
        for (let i = 0; i < pitchTrack.length; i++) {
            const window = [];
            const halfWindow = Math.floor(windowSize / 2);
            
            for (let j = Math.max(0, i - halfWindow); j <= Math.min(pitchTrack.length - 1, i + halfWindow); j++) {
                if (pitchTrack[j].midiNote > 0) {
                    window.push(pitchTrack[j].midiNote);
                }
            }
            
            if (window.length > 0) {
                window.sort((a, b) => a - b);
                const medianMidi = window[Math.floor(window.length / 2)];
                
                smoothed.push({
                    ...pitchTrack[i],
                    midiNote: medianMidi
                });
            } else {
                smoothed.push(pitchTrack[i]);
            }
        }
        
        return smoothed;
    }
    
    /**
     * Convert amplitude to MIDI velocity
     */
    amplitudeToVelocity(amplitude, sensitivity) {
        // Normalize amplitude (assuming range 0-1)
        const normalized = Math.min(1, Math.max(0, amplitude * sensitivity));
        
        // Map to MIDI velocity range (1-127)
        return Math.round(1 + normalized * 126);
    }
    
    /**
     * Clean MIDI notes (remove duplicates, fix overlaps)
     */
    cleanMIDINotes(notes, settings) {
        if (notes.length === 0) return [];
        
        // Sort by start time
        const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
        const cleaned = [];
        
        for (const note of sorted) {
            // Skip very short notes
            if (note.duration < settings.minNoteDuration) continue;
            
            // Check for overlapping notes with same pitch
            const overlapping = cleaned.filter(n => 
                n.midiNote === note.midiNote &&
                n.endTime > note.startTime &&
                n.startTime < note.endTime
            );
            
            if (overlapping.length === 0) {
                cleaned.push(note);
            } else {
                // Merge with overlapping note
                for (const existing of overlapping) {
                    existing.endTime = Math.max(existing.endTime, note.endTime);
                    existing.duration = existing.endTime - existing.startTime;
                    existing.velocity = Math.max(existing.velocity, note.velocity);
                }
            }
        }
        
        return cleaned;
    }
    
    /**
     * Convert results to MIDI file format
     */
    convertToMIDIFile(results) {
        // Basic MIDI file structure
        const ticksPerBeat = 480;
        const tempo = 120; // Default tempo
        
        // Build track data
        const tracks = [];
        
        for (const result of results) {
            if (!result.success || !result.midiNotes) continue;
            
            const trackEvents = [];
            
            for (const note of result.midiNotes) {
                const startTick = Math.round((note.startTime / 60 * tempo) * ticksPerBeat);
                const durationTicks = Math.round((note.duration / 60 * tempo) * ticksPerBeat);
                
                // Note on event
                trackEvents.push({
                    tick: startTick,
                    type: 'noteOn',
                    channel: 0,
                    note: note.midiNote,
                    velocity: note.velocity
                });
                
                // Note off event
                trackEvents.push({
                    tick: startTick + durationTicks,
                    type: 'noteOff',
                    channel: 0,
                    note: note.midiNote,
                    velocity: 0
                });
            }
            
            // Sort events by tick
            trackEvents.sort((a, b) => a.tick - b.tick);
            
            tracks.push({
                events: trackEvents,
                name: `Track ${result.clipId}`
            });
        }
        
        return {
            format: 1, // Multi-track
            ticksPerBeat,
            tempo,
            tracks
        };
    }
    
    /**
     * Create UI panel for batch conversion
     */
    createUI() {
        const panel = document.createElement('div');
        panel.id = 'audio-to-midi-batch-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a2e;
            border: 1px solid #3a3a5e;
            border-radius: 8px;
            padding: 24px;
            z-index: 10000;
            min-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        panel.innerHTML = `
            <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">Audio to MIDI Batch Converter</h2>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Settings</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="font-size: 11px; color: #666;">Min Frequency (Hz)</label>
                        <input type="number" id="batch-min-freq" value="${this.settings.minFrequency}" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Max Frequency (Hz)</label>
                        <input type="number" id="batch-max-freq" value="${this.settings.maxFrequency}" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Threshold (dB)</label>
                        <input type="number" id="batch-threshold" value="${this.settings.amplitudeThreshold}" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Min Note Duration (s)</label>
                        <input type="number" id="batch-min-duration" value="${this.settings.minNoteDuration}" step="0.01" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                    </div>
                </div>
            </div>
            
            <div id="batch-clips-list" style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px; min-height: 100px; max-height: 200px; overflow-y: auto;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Clips in Queue: <span id="clip-count">0</span></div>
                <div id="clips-list-content" style="font-size: 12px;"></div>
            </div>
            
            <div id="batch-progress" style="display: none; background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 12px; color: #888;">Processing...</span>
                    <span id="progress-text" style="font-size: 12px; color: #10b981;">0%</span>
                </div>
                <div style="background: #1a1a2e; border-radius: 4px; height: 8px; overflow: hidden;">
                    <div id="progress-bar" style="width: 0%; height: 100%; background: #10b981; transition: width 0.3s;"></div>
                </div>
            </div>
            
            <div id="batch-results" style="display: none; background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Results</div>
                <div id="results-content"></div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="add-clips-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Add Selected Clips
                </button>
                <button id="start-batch-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Start Batch
                </button>
                <button id="export-midi-btn" style="flex: 1; padding: 12px; background: #8b5cf6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Export MIDI
                </button>
                <button id="close-batch-panel" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupUIEvents(panel);
        
        return panel;
    }
    
    setupUIEvents(panel) {
        // Add clips button
        panel.querySelector('#add-clips-btn').addEventListener('click', () => {
            // This would typically be called with selected clips from the DAW
            console.log('[AudioToMIDIBatch] Add clips button clicked - integrate with DAW selection');
        });
        
        // Start batch button
        panel.querySelector('#start-batch-btn').addEventListener('click', () => {
            this.startBatchFromUI();
        });
        
        // Export MIDI button
        panel.querySelector('#export-midi-btn').addEventListener('click', () => {
            this.exportFromUI();
        });
        
        // Close button
        panel.querySelector('#close-batch-panel').addEventListener('click', () => {
            panel.remove();
        });
        
        // Settings inputs
        panel.querySelector('#batch-min-freq').addEventListener('change', (e) => {
            this.settings.minFrequency = parseFloat(e.target.value);
        });
        panel.querySelector('#batch-max-freq').addEventListener('change', (e) => {
            this.settings.maxFrequency = parseFloat(e.target.value);
        });
        panel.querySelector('#batch-threshold').addEventListener('change', (e) => {
            this.settings.amplitudeThreshold = parseFloat(e.target.value);
        });
        panel.querySelector('#batch-min-duration').addEventListener('change', (e) => {
            this.settings.minNoteDuration = parseFloat(e.target.value);
        });
    }
    
    updateClipsList() {
        const content = document.querySelector('#clips-list-content');
        const count = document.querySelector('#clip-count');
        
        if (content && count) {
            count.textContent = this.queue.length;
            
            if (this.queue.length === 0) {
                content.innerHTML = '<div style="color: #666;">No clips in queue</div>';
            } else {
                content.innerHTML = this.queue.map((clip, i) => `
                    <div style="padding: 4px 0; border-bottom: 1px solid #1a1a2e; display: flex; justify-content: space-between;">
                        <span>${clip.id}</span>
                        <span style="color: #666;">${clip.audioBuffer?.duration?.toFixed(2) || '?'}s</span>
                    </div>
                `).join('');
            }
        }
    }
    
    async startBatchFromUI() {
        const progressDiv = document.querySelector('#batch-progress');
        const progressBar = document.querySelector('#progress-bar');
        const progressText = document.querySelector('#progress-text');
        
        if (progressDiv) {
            progressDiv.style.display = 'block';
        }
        
        const results = await this.processBatch((progress) => {
            if (progressBar && progressText) {
                progressBar.style.width = `${progress.progress * 100}%`;
                progressText.textContent = `${Math.round(progress.progress * 100)}%`;
            }
        });
        
        this.displayResults(results);
    }
    
    displayResults(results) {
        const resultsDiv = document.querySelector('#batch-results');
        const resultsContent = document.querySelector('#results-content');
        
        if (resultsDiv && resultsContent) {
            resultsDiv.style.display = 'block';
            
            const successCount = results.filter(r => r.success).length;
            const totalNotes = results.reduce((sum, r) => sum + (r.midiNotes?.length || 0), 0);
            
            resultsContent.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <strong>${successCount}</strong> of ${results.length} clips converted successfully
                </div>
                <div style="margin-bottom: 12px;">
                    <strong>${totalNotes}</strong> total MIDI notes generated
                </div>
                <div style="font-size: 11px; color: #666;">
                    ${results.map(r => `
                        <div style="padding: 4px 0;">
                            ${r.clipId}: ${r.success ? `${r.noteCount} notes` : `Error: ${r.error}`}
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
    
    exportFromUI() {
        const results = Array.from(this.results.values());
        if (results.length === 0) {
            alert('No conversion results to export');
            return;
        }
        
        const midiData = this.convertToMIDIFile(results);
        console.log('[AudioToMIDIBatch] MIDI file data:', midiData);
        
        // Trigger download (simplified - would need proper MIDI binary encoding)
        alert('MIDI export ready - integrate with MIDI file encoder');
    }
}

// Export singleton instance
let audioToMIDIBatchInstance = null;

export function getAudioToMIDIBatch(options = {}) {
    if (!audioToMIDIBatchInstance) {
        audioToMIDIBatchInstance = new AudioToMIDIBatch(options);
    }
    return audioToMIDIBatchInstance;
}

export function openAudioToMIDIBatchPanel() {
    const converter = getAudioToMIDIBatch();
    return converter.createUI();
}