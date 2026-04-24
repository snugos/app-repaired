/**
 * Audio Pitch Correction - Real-time pitch correction for vocals
 * Provides automatic pitch correction with various modes and scales
 */

export class AudioPitchCorrection {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = this.audioContext?.sampleRate || 44100;
        
        // Correction settings
        this.settings = {
            scale: options.scale || 'chromatic',
            key: options.key || 'C',
            mode: options.mode || 'auto', // auto, manual, midi
            speed: options.speed || 50, // 0-100, correction speed
            strength: options.strength || 100, // 0-100, correction strength
            pitchShift: options.pitchShift || 0, // semitones
            formantPreservation: options.formantPreservation || true,
            formantShift: options.formantShift || 0, // semitones for formants
            vibratoDepth: options.vibratoDepth || 0, // cents
            vibratoRate: options.vibratoRate || 5, // Hz
            octaveRange: options.octaveRange || [2, 6],
            detune: options.detune || 0, // cents
            humanize: options.humanize || 0, // 0-100, allows some pitch drift
            pitchTracking: options.pitchTracking || 'fast' // fast, medium, accurate
        };
        
        // Scale definitions (intervals from root)
        this.scales = {
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            pentatonicMajor: [0, 2, 4, 7, 9],
            pentatonicMinor: [0, 3, 5, 7, 10],
            blues: [0, 3, 5, 6, 7, 10],
            dorian: [0, 2, 3, 5, 7, 9, 10],
            mixolydian: [0, 2, 4, 5, 7, 9, 10],
            lydian: [0, 2, 4, 6, 7, 9, 11],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
            melodicMinor: [0, 2, 3, 5, 7, 9, 11],
            custom: []
        };
        
        // Note names
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Processing state
        this.isProcessing = false;
        this.inputNode = null;
        this.outputNode = null;
        this.correctionNode = null;
        
        // Tracking data
        this.detectedPitch = null;
        this.targetPitch = null;
        this.correctionAmount = 0;
        
        // Analysis buffers
        this.analysisBuffer = new Float32Array(2048);
        this.fftBuffer = new Float32Array(4096);
        
        // Formant filter coefficients
        this.formantFilters = [];
    }
    
    /**
     * Initialize audio nodes for real-time processing
     */
    initialize(audioContext) {
        this.audioContext = audioContext;
        this.sampleRate = audioContext.sampleRate;
        
        // Create script processor for analysis and correction
        // Note: In production, would use AudioWorklet for better performance
        this.correctionNode = audioContext.createScriptProcessor(2048, 1, 1);
        
        this.correctionNode.onaudioprocess = (event) => {
            if (!this.isProcessing) return;
            
            const input = event.inputBuffer.getChannelData(0);
            const output = event.outputBuffer.getChannelData(0);
            
            this.processAudio(input, output);
        };
        
        // Initialize formant preservation filters
        this.initializeFormantFilters();
        
        return this.correctionNode;
    }
    
    /**
     * Initialize formant filters for formant preservation
     */
    initializeFormantFilters() {
        // Typical vocal formant frequencies
        const formantFreqs = [800, 1200, 2500, 3500];
        const formantQ = [10, 10, 10, 10];
        const formantGain = [3, 2, 1, 1]; // dB
        
        this.formantFilters = formantFreqs.map((freq, i) => ({
            frequency: freq,
            Q: formantQ[i],
            gain: formantGain[i]
        }));
    }
    
    /**
     * Connect to audio graph
     */
    connect(source, destination) {
        if (!this.correctionNode) {
            this.initialize(this.audioContext || source.context);
        }
        
        this.inputNode = source;
        this.outputNode = destination;
        
        source.connect(this.correctionNode);
        this.correctionNode.connect(destination);
        
        this.isProcessing = true;
        
        console.log('[AudioPitchCorrection] Connected and processing');
    }
    
    /**
     * Disconnect from audio graph
     */
    disconnect() {
        if (this.inputNode) {
            this.inputNode.disconnect(this.correctionNode);
        }
        if (this.correctionNode && this.outputNode) {
            this.correctionNode.disconnect(this.outputNode);
        }
        
        this.isProcessing = false;
        this.inputNode = null;
        this.outputNode = null;
        
        console.log('[AudioPitchCorrection] Disconnected');
    }
    
    /**
     * Process audio buffer
     */
    processAudio(input, output) {
        // Detect pitch
        const pitchResult = this.detectPitch(input);
        
        if (pitchResult.frequency > 0) {
            this.detectedPitch = pitchResult;
            
            // Find target pitch based on scale
            const targetNote = this.findTargetNote(pitchResult.frequency);
            this.targetPitch = targetNote;
            
            // Calculate correction
            const correctionCents = this.calculateCorrection(
                pitchResult.frequency,
                targetNote.frequency,
                pitchResult.confidence
            );
            
            this.correctionAmount = correctionCents;
            
            // Apply pitch shift
            this.applyPitchShift(input, output, correctionCents);
        } else {
            // No pitch detected, pass through
            output.set(input);
        }
    }
    
    /**
     * Detect pitch using autocorrelation
     */
    detectPitch(buffer) {
        const minPeriod = Math.round(this.sampleRate / 1200); // Max freq
        const maxPeriod = Math.round(this.sampleRate / 80); // Min freq
        
        // Calculate RMS
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);
        
        // Threshold for voice activity
        if (rms < 0.01) {
            return { frequency: 0, confidence: 0, rms };
        }
        
        // Autocorrelation
        let bestPeriod = minPeriod;
        let bestCorrelation = -1;
        let prevCorrelation = -1;
        
        for (let period = minPeriod; period < maxPeriod; period++) {
            let correlation = 0;
            
            for (let i = 0; i < buffer.length - period; i++) {
                correlation += buffer[i] * buffer[i + period];
            }
            
            correlation /= buffer.length;
            
            // Find peak (local maximum)
            if (correlation > bestCorrelation && correlation > prevCorrelation) {
                bestCorrelation = correlation;
                bestPeriod = period;
            }
            
            prevCorrelation = correlation;
        }
        
        // Parabolic interpolation for better accuracy
        const refinedPeriod = this.parabolicInterpolation(
            this.sampleRate,
            bestPeriod - 1,
            bestPeriod,
            bestPeriod + 1,
            bestCorrelation
        );
        
        const frequency = this.sampleRate / refinedPeriod;
        const confidence = bestCorrelation / rms;
        
        return { frequency, confidence: Math.min(1, confidence), rms, period: bestPeriod };
    }
    
    /**
     * Parabolic interpolation for accurate pitch detection
     */
    parabolicInterpolation(sampleRate, p1, p2, p3, y2) {
        // Simplified - would measure y1 and y3 for full interpolation
        return p2;
    }
    
    /**
     * Find target note based on scale and settings
     */
    findTargetNote(detectedFrequency) {
        const rootNote = this.noteNames.indexOf(this.settings.key);
        const scale = this.scales[this.settings.scale] || this.scales.chromatic;
        
        // Convert detected frequency to MIDI
        const detectedMidi = 69 + 12 * Math.log2(detectedFrequency / 440);
        
        // Find nearest scale note
        let nearestNote = null;
        let minDistance = Infinity;
        
        for (let octave = this.settings.octaveRange[0]; octave <= this.settings.octaveRange[1]; octave++) {
            for (const interval of scale) {
                const noteMidi = rootNote + interval + (octave * 12);
                const distance = Math.abs(detectedMidi - noteMidi);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestNote = {
                        midi: noteMidi,
                        frequency: 440 * Math.pow(2, (noteMidi - 69) / 12),
                        name: this.noteNames[(rootNote + interval) % 12],
                        octave,
                        distance: minDistance
                    };
                }
            }
        }
        
        return nearestNote || { midi: Math.round(detectedMidi), frequency: detectedFrequency, name: '?', octave: 4, distance: 0 };
    }
    
    /**
     * Calculate correction amount in cents
     */
    calculateCorrection(detectedFreq, targetFreq, confidence) {
        // Calculate cents difference
        const centsDiff = 1200 * Math.log2(targetFreq / detectedFreq);
        
        // Apply settings
        const speedFactor = this.settings.speed / 100;
        const strengthFactor = this.settings.strength / 100;
        const humanizeFactor = this.settings.humanize / 100;
        
        // Correction formula
        let correction = centsDiff * strengthFactor * speedFactor * confidence;
        
        // Allow humanize drift
        if (humanizeFactor > 0) {
            const allowedDrift = 50 * humanizeFactor; // cents
            if (Math.abs(centsDiff) < allowedDrift) {
                correction = 0; // Don't correct small drifts
            }
        }
        
        return correction;
    }
    
    /**
     * Apply pitch shift to audio buffer
     */
    applyPitchShift(input, output, cents) {
        if (Math.abs(cents) < 1) {
            output.set(input);
            return;
        }
        
        // Convert cents to pitch ratio
        const pitchRatio = Math.pow(2, cents / 1200);
        
        // Simple pitch shifting using overlap-add
        // In production, would use phase vocoder or PSOLA
        const windowSize = 1024;
        const hopSize = 256;
        const overlap = windowSize - hopSize;
        
        for (let i = 0; i < input.length; i++) {
            const sourceIndex = i / pitchRatio;
            
            if (sourceIndex < input.length && sourceIndex >= 0) {
                // Linear interpolation
                const index1 = Math.floor(sourceIndex);
                const index2 = Math.min(index1 + 1, input.length - 1);
                const frac = sourceIndex - index1;
                
                output[i] = input[index1] * (1 - frac) + input[index2] * frac;
            } else {
                output[i] = 0;
            }
        }
        
        // Apply formant preservation if enabled
        if (this.settings.formantPreservation) {
            this.preserveFormants(output);
        }
    }
    
    /**
     * Preserve formants after pitch shift
     */
    preserveFormants(buffer) {
        // Simplified formant preservation
        // In production, would use filter bank and resynthesis
        const formantShift = this.settings.formantShift;
        
        if (formantShift !== 0) {
            // Apply formant shift
            const shiftRatio = Math.pow(2, formantShift / 12);
            // Would re-impose formants here
        }
    }
    
    /**
     * Process audio file (non-realtime)
     */
    async processAudioFile(audioBuffer, options = {}) {
        const settings = { ...this.settings, ...options };
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        
        // Create output buffer
        const outputBuffer = this.audioContext.createBuffer(
            numChannels,
            length,
            audioBuffer.sampleRate
        );
        
        // Process each channel
        for (let channel = 0; channel < numChannels; channel++) {
            const input = audioBuffer.getChannelData(channel);
            const output = outputBuffer.getChannelData(channel);
            
            // Process in chunks for better quality
            const chunkSize = 4096;
            
            for (let i = 0; i < length; i += chunkSize) {
                const end = Math.min(i + chunkSize, length);
                const chunkInput = input.slice(i, end);
                const chunkOutput = new Float32Array(chunkInput.length);
                
                this.processAudio(chunkInput, chunkOutput);
                
                for (let j = 0; j < chunkOutput.length; j++) {
                    output[i + j] = chunkOutput[j];
                }
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Get current detection data for UI
     */
    getDetectionData() {
        return {
            detectedPitch: this.detectedPitch,
            targetPitch: this.targetPitch,
            correctionAmount: this.correctionAmount,
            settings: { ...this.settings }
        };
    }
    
    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('[AudioPitchCorrection] Settings updated:', this.settings);
    }
    
    /**
     * Set scale programmatically
     */
    setScale(scale, key = 'C') {
        if (this.scales[scale]) {
            this.settings.scale = scale;
            this.settings.key = key;
        } else {
            console.warn(`[AudioPitchCorrection] Unknown scale: ${scale}`);
        }
    }
    
    /**
     * Set custom scale
     */
    setCustomScale(intervals) {
        this.scales.custom = intervals;
        this.settings.scale = 'custom';
    }
    
    /**
     * Create UI panel for pitch correction
     */
    createUI() {
        const panel = document.createElement('div');
        panel.id = 'pitch-correction-panel';
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
            min-width: 450px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        panel.innerHTML = `
            <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">Audio Pitch Correction</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Scale</label>
                    <select id="pc-scale" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                        <option value="chromatic">Chromatic</option>
                        <option value="major">Major</option>
                        <option value="minor">Minor</option>
                        <option value="pentatonicMajor">Pentatonic Major</option>
                        <option value="pentatonicMinor">Pentatonic Minor</option>
                        <option value="blues">Blues</option>
                        <option value="dorian">Dorian</option>
                        <option value="mixolydian">Mixolydian</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Key</label>
                    <select id="pc-key" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                        ${this.noteNames.map(n => `<option value="${n}">${n}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Speed: <span id="speed-value">${this.settings.speed}%</span></label>
                <input type="range" id="pc-speed" min="1" max="100" value="${this.settings.speed}" style="width: 100%;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Strength: <span id="strength-value">${this.settings.strength}%</span></label>
                <input type="range" id="pc-strength" min="0" max="100" value="${this.settings.strength}" style="width: 100%;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Humanize: <span id="humanize-value">${this.settings.humanize}%</span></label>
                <input type="range" id="pc-humanize" min="0" max="100" value="${this.settings.humanize}" style="width: 100%;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" id="pc-formant" ${this.settings.formantPreservation ? 'checked' : ''} style="accent-color: #10b981;">
                    Preserve Formants
                </label>
            </div>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 20px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Detection</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px;">
                    <div>Detected: <strong id="pc-detected-note">--</strong></div>
                    <div>Target: <strong id="pc-target-note">--</strong></div>
                    <div>Freq: <strong id="pc-detected-freq">--</strong> Hz</div>
                    <div>Correction: <strong id="pc-correction">--</strong> cents</div>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="pc-toggle-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Enable Correction
                </button>
                <button id="pc-close-btn" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupUIEvents(panel);
        
        // Start detection display update
        this.startDetectionUpdate();
        
        return panel;
    }
    
    setupUIEvents(panel) {
        // Scale select
        panel.querySelector('#pc-scale').addEventListener('change', (e) => {
            this.settings.scale = e.target.value;
        });
        
        // Key select
        panel.querySelector('#pc-key').addEventListener('change', (e) => {
            this.settings.key = e.target.value;
        });
        
        // Speed slider
        const speedSlider = panel.querySelector('#pc-speed');
        const speedValue = panel.querySelector('#speed-value');
        speedSlider.addEventListener('input', () => {
            this.settings.speed = parseInt(speedSlider.value);
            speedValue.textContent = this.settings.speed + '%';
        });
        
        // Strength slider
        const strengthSlider = panel.querySelector('#pc-strength');
        const strengthValue = panel.querySelector('#strength-value');
        strengthSlider.addEventListener('input', () => {
            this.settings.strength = parseInt(strengthSlider.value);
            strengthValue.textContent = this.settings.strength + '%';
        });
        
        // Humanize slider
        const humanizeSlider = panel.querySelector('#pc-humanize');
        const humanizeValue = panel.querySelector('#humanize-value');
        humanizeSlider.addEventListener('input', () => {
            this.settings.humanize = parseInt(humanizeSlider.value);
            humanizeValue.textContent = this.settings.humanize + '%';
        });
        
        // Formant checkbox
        panel.querySelector('#pc-formant').addEventListener('change', (e) => {
            this.settings.formantPreservation = e.target.checked;
        });
        
        // Toggle button
        const toggleBtn = panel.querySelector('#pc-toggle-btn');
        toggleBtn.addEventListener('click', () => {
            if (this.isProcessing) {
                this.disconnect();
                toggleBtn.textContent = 'Enable Correction';
                toggleBtn.style.background = '#10b981';
            } else {
                console.log('[AudioPitchCorrection] Enable - connect to audio source');
                toggleBtn.textContent = 'Disable Correction';
                toggleBtn.style.background = '#ef4444';
            }
        });
        
        // Close button
        panel.querySelector('#pc-close-btn').addEventListener('click', () => {
            this.stopDetectionUpdate();
            panel.remove();
        });
    }
    
    startDetectionUpdate() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }
        
        this.detectionInterval = setInterval(() => {
            const panel = document.querySelector('#pitch-correction-panel');
            if (!panel) {
                this.stopDetectionUpdate();
                return;
            }
            
            const data = this.getDetectionData();
            
            if (data.detectedPitch) {
                const noteName = this.midiToNoteName(
                    69 + 12 * Math.log2(data.detectedPitch.frequency / 440)
                );
                panel.querySelector('#pc-detected-note').textContent = noteName;
                panel.querySelector('#pc-detected-freq').textContent = 
                    Math.round(data.detectedPitch.frequency);
            }
            
            if (data.targetPitch) {
                panel.querySelector('#pc-target-note').textContent = 
                    data.targetPitch.name + data.targetPitch.octave;
            }
            
            if (data.correctionAmount) {
                panel.querySelector('#pc-correction').textContent = 
                    Math.round(data.correctionAmount);
            }
        }, 50); // 20fps update
    }
    
    stopDetectionUpdate() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
    }
    
    midiToNoteName(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const note = noteNames[midi % 12];
        return note + octave;
    }
}

// Export singleton instance
let audioPitchCorrectionInstance = null;

export function getAudioPitchCorrection(options = {}) {
    if (!audioPitchCorrectionInstance) {
        audioPitchCorrectionInstance = new AudioPitchCorrection(options);
    }
    return audioPitchCorrectionInstance;
}

export function openPitchCorrectionPanel() {
    const correction = getAudioPitchCorrection();
    return correction.createUI();
}