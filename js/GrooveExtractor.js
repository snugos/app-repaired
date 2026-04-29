/**
 * Groove Extractor - Extract swing/groove feel from audio and apply to MIDI patterns
 * Analyzes rhythmic feel and exports groove templates
 */

export class GrooveExtractor {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = this.audioContext?.sampleRate || 44100;
        
        this.settings = {
            minTempo: options.minTempo || 60,
            maxTempo: options.maxTempo || 200,
            timeSignature: options.timeSignature || 4,
            gridResolution: options.gridResolution || 16, // 16th notes
            windowSize: options.windowSize || 2048,
            hopSize: options.hopSize || 512,
            sensitivity: options.sensitivity || 0.5,
            analyzeVelocity: options.analyzeVelocity !== false,
            extractTiming: options.extractTiming !== false
        };
        
        this.grooveData = null;
        this.audioBuffer = null;
        this.analysisResult = null;
    }

    /**
     * Initialize audio context
     */
    async initialize() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.sampleRate = this.audioContext.sampleRate;
                console.log('[GrooveExtractor] Audio context initialized');
                return true;
            } catch (e) {
                console.error('[GrooveExtractor] Failed to initialize audio context:', e);
                return false;
            }
        }
        return true;
    }

    /**
     * Load audio file for analysis
     */
    async loadAudioFile(file) {
        await this.initialize();
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('[GrooveExtractor] Audio loaded:', this.audioBuffer.duration.toFixed(2), 's');
            return this.audioBuffer;
        } catch (e) {
            console.error('[GrooveExtractor] Failed to load audio:', e);
            return null;
        }
    }

    /**
     * Analyze audio and extract groove
     */
    async analyze(audioBuffer = null) {
        const buffer = audioBuffer || this.audioBuffer;
        if (!buffer) {
            console.warn('[GrooveExtractor] No audio buffer to analyze');
            return null;
        }

        const monoData = this.getMonoChannel(buffer);
        const tempo = this.detectTempo(monoData, buffer.sampleRate);
        const beatPositions = this.detectBeats(monoData, buffer.sampleRate, tempo);
        const groove = this.calculateGroove(beatPositions, tempo);
        const velocityPattern = this.settings.analyzeVelocity 
            ? this.analyzeVelocityPattern(monoData, beatPositions, buffer.sampleRate) 
            : null;

        this.analysisResult = {
            tempo: tempo.bpm,
            tempoConfidence: tempo.confidence,
            beats: beatPositions,
            groove: groove,
            velocityPattern: velocityPattern,
            settings: { ...this.settings },
            duration: buffer.duration,
            sampleRate: buffer.sampleRate
        };

        console.log('[GrooveExtractor] Analysis complete:', {
            tempo: tempo.bpm.toFixed(1),
            beats: beatPositions.length,
            swing: (groove.swing * 100).toFixed(1) + '%'
        });

        return this.analysisResult;
    }

    /**
     * Get mono channel data
     */
    getMonoChannel(audioBuffer) {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }
        
        const mono = new Float32Array(audioBuffer.length);
        const numChannels = audioBuffer.numberOfChannels;
        
        for (let ch = 0; ch < numChannels; ch++) {
            const channelData = audioBuffer.getChannelData(ch);
            for (let i = 0; i < channelData.length; i++) {
                mono[i] += channelData[i] / numChannels;
            }
        }
        
        return mono;
    }

    /**
     * Detect tempo using onset detection
     */
    detectTempo(audioData, sampleRate) {
        const { minTempo, maxTempo } = this.settings;
        
        // Calculate onset envelope
        const onsetEnvelope = this.calculateOnsetEnvelope(audioData, sampleRate);
        
        // Autocorrelate to find periodicity
        const minPeriod = Math.floor(60 / maxTempo * sampleRate / this.settings.hopSize);
        const maxPeriod = Math.ceil(60 / minTempo * sampleRate / this.settings.hopSize);
        
        let bestPeriod = minPeriod;
        let bestScore = 0;
        
        for (let period = minPeriod; period < Math.min(maxPeriod, onsetEnvelope.length); period++) {
            let score = 0;
            for (let i = 0; i < onsetEnvelope.length - period; i++) {
                score += onsetEnvelope[i] * onsetEnvelope[i + period];
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestPeriod = period;
            }
        }
        
        const bpm = 60 * sampleRate / (bestPeriod * this.settings.hopSize);
        const confidence = Math.min(1, bestScore / (onsetEnvelope.length * 0.1));
        
        return { bpm: Math.round(bpm * 10) / 10, confidence };
    }

    /**
     * Calculate onset envelope using energy flux
     */
    calculateOnsetEnvelope(audioData, sampleRate) {
        const { windowSize, hopSize } = this.settings;
        const numFrames = Math.floor((audioData.length - windowSize) / hopSize);
        const envelope = new Float32Array(numFrames);
        
        let prevEnergy = 0;
        
        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * hopSize;
            let energy = 0;
            
            // Calculate frame energy
            for (let i = 0; i < windowSize; i++) {
                const sample = audioData[start + i] || 0;
                energy += sample * sample;
            }
            energy = Math.sqrt(energy / windowSize);
            
            // Positive energy change = onset
            const flux = Math.max(0, energy - prevEnergy);
            envelope[frame] = flux;
            prevEnergy = energy;
        }
        
        // Normalize
        const maxVal = Math.max(...envelope);
        if (maxVal > 0) {
            for (let i = 0; i < envelope.length; i++) {
                envelope[i] /= maxVal;
            }
        }
        
        return envelope;
    }

    /**
     * Detect beat positions
     */
    detectBeats(audioData, sampleRate, tempo) {
        const beatPeriod = 60 / tempo.bpm;
        const onsetEnvelope = this.calculateOnsetEnvelope(audioData, sampleRate);
        
        const hopSize = this.settings.hopSize;
        const beats = [];
        const threshold = this.settings.sensitivity * 0.3;
        
        let lastBeatTime = -beatPeriod * 2;
        
        for (let i = 1; i < onsetEnvelope.length - 1; i++) {
            // Peak detection
            if (onsetEnvelope[i] > onsetEnvelope[i - 1] && 
                onsetEnvelope[i] > onsetEnvelope[i + 1] &&
                onsetEnvelope[i] > threshold) {
                
                const time = (i * hopSize) / sampleRate;
                const timeSinceLastBeat = time - lastBeatTime;
                
                // Allow beats that are at least half the expected period away
                if (timeSinceLastBeat >= beatPeriod * 0.5) {
                    beats.push({
                        time: time,
                        strength: onsetEnvelope[i],
                        frame: i
                    });
                    lastBeatTime = time;
                }
            }
        }
        
        return beats;
    }

    /**
     * Calculate groove from beat positions
     */
    calculateGroove(beats, tempo) {
        if (beats.length < 4) {
            return { swing: 0, timing: [], regularity: 0 };
        }
        
        const beatPeriod = 60 / tempo.bpm;
        const timing = [];
        
        // Calculate timing deviations for each beat
        for (let i = 1; i < beats.length; i++) {
            const expectedTime = beats[0].time + i * beatPeriod;
            const actualTime = beats[i].time;
            const deviation = actualTime - expectedTime;
            const deviationRatio = deviation / beatPeriod;
            
            timing.push({
                beatIndex: i,
                expected: expectedTime,
                actual: actualTime,
                deviationMs: deviation * 1000,
                deviationRatio: deviationRatio
            });
        }
        
        // Calculate swing (deviation on off-beats)
        const offBeatDeviations = timing.filter((_, i) => i % 2 === 1);
        const swing = offBeatDeviations.length > 0
            ? offBeatDeviations.reduce((sum, t) => sum + t.deviationRatio, 0) / offBeatDeviations.length
            : 0;
        
        // Calculate regularity (standard deviation of deviations)
        const avgDeviation = timing.reduce((sum, t) => sum + t.deviationRatio, 0) / timing.length;
        const variance = timing.reduce((sum, t) => sum + Math.pow(t.deviationRatio - avgDeviation, 2), 0) / timing.length;
        const regularity = 1 - Math.min(1, Math.sqrt(variance) * 2);
        
        return {
            swing: Math.max(-0.5, Math.min(0.5, swing)), // Clamp to [-0.5, 0.5]
            timing: timing,
            regularity: Math.max(0, regularity),
            averageDeviation: avgDeviation
        };
    }

    /**
     * Analyze velocity pattern
     */
    analyzeVelocityPattern(audioData, beats, sampleRate) {
        if (beats.length < 2) return null;
        
        const velocities = [];
        const beatDuration = 60 / (this.analysisResult?.tempo || 120);
        const windowMs = 50;
        const windowSamples = Math.floor(windowMs / 1000 * sampleRate);
        
        for (const beat of beats) {
            const startSample = Math.floor(beat.time * sampleRate);
            let maxEnergy = 0;
            
            for (let i = 0; i < windowSamples && startSample + i < audioData.length; i++) {
                const sample = audioData[startSample + i];
                maxEnergy = Math.max(maxEnergy, Math.abs(sample));
            }
            
            velocities.push({
                beatIndex: beat.beatIndex || velocities.length,
                velocity: maxEnergy
            });
        }
        
        // Normalize velocities
        const maxVel = Math.max(...velocities.map(v => v.velocity));
        if (maxVel > 0) {
            velocities.forEach(v => v.velocity /= maxVel);
        }
        
        return velocities;
    }

    /**
     * Apply groove to MIDI notes
     */
    applyGrooveToNotes(notes, groove = null) {
        const g = groove || this.analysisResult?.groove;
        if (!g || !notes.length) return notes;
        
        const beatDuration = 60 / (this.analysisResult?.tempo || 120);
        
        return notes.map(note => {
            // Find closest groove timing
            const noteBeatIndex = Math.round(note.startTime / beatDuration);
            const grooveTiming = g.timing.find(t => t.beatIndex === noteBeatIndex);
            
            if (grooveTiming) {
                return {
                    ...note,
                    startTime: note.startTime + grooveTiming.deviation,
                    grooveApplied: true,
                    grooveDeviationMs: grooveTiming.deviationMs
                };
            }
            
            return note;
        });
    }

    /**
     * Apply swing to MIDI notes
     */
    applySwingToNotes(notes, swingAmount = null) {
        const swing = swingAmount !== null ? swingAmount : (this.analysisResult?.groove?.swing || 0);
        if (!notes.length) return notes;
        
        const beatDuration = 60 / (this.analysisResult?.tempo || 120);
        const sixteenthDuration = beatDuration / 4;
        
        return notes.map(note => {
            const sixteenthIndex = Math.round(note.startTime / sixteenthDuration);
            
            // Apply swing to off-beat 16ths (every other one)
            if (sixteenthIndex % 2 === 1) {
                const swingOffset = swing * sixteenthDuration;
                return {
                    ...note,
                    startTime: note.startTime + swingOffset,
                    swingApplied: true,
                    swingAmount: swing
                };
            }
            
            return note;
        });
    }

    /**
     * Export groove as JSON
     */
    exportGrooveJSON() {
        if (!this.analysisResult) return null;
        
        return {
            name: 'Groove Template',
            tempo: this.analysisResult.tempo,
            timeSignature: this.settings.timeSignature,
            swing: this.analysisResult.groove.swing,
            regularity: this.analysisResult.groove.regularity,
            timing: this.analysisResult.groove.timing.map(t => ({
                beatIndex: t.beatIndex,
                deviationMs: t.deviationMs,
                deviationRatio: t.deviationRatio
            })),
            velocityPattern: this.analysisResult.velocityPattern?.map(v => v.velocity) || null,
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import groove from JSON
     */
    importGrooveJSON(json) {
        try {
            const data = typeof json === 'string' ? JSON.parse(json) : json;
            
            this.grooveData = {
                swing: data.swing || 0,
                regularity: data.regularity || 1,
                timing: (data.timing || []).map(t => ({
                    beatIndex: t.beatIndex,
                    deviation: t.deviationMs / 1000,
                    deviationMs: t.deviationMs,
                    deviationRatio: t.deviationRatio
                })),
                tempo: data.tempo || 120,
                velocityPattern: data.velocityPattern?.map(v => ({ velocity: v })) || null
            };
            
            console.log('[GrooveExtractor] Groove imported:', this.grooveData.swing);
            return this.grooveData;
        } catch (e) {
            console.error('[GrooveExtractor] Failed to import groove:', e);
            return null;
        }
    }

    /**
     * Create and show UI panel
     */
    createPanel() {
        const existing = document.getElementById('groove-extractor-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'groove-extractor-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a2e;
            border: 1px solid #3a3a5e;
            border-radius: 12px;
            padding: 24px;
            z-index: 10000;
            width: 480px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 18px; color: #10b981;">
                    🎵 Groove Extractor
                </h2>
                <button id="gx-close" style="background: none; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
            </div>

            <div style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center;">
                    <div>
                        <div id="gx-tempo" style="font-size: 28px; font-weight: bold; color: #10b981;">--</div>
                        <div style="font-size: 11px; color: #666;">BPM</div>
                    </div>
                    <div>
                        <div id="gx-swing" style="font-size: 28px; font-weight: bold; color: #f59e0b;">--</div>
                        <div style="font-size: 11px; color: #666;">Swing %</div>
                    </div>
                    <div>
                        <div id="gx-regularity" style="font-size: 28px; font-weight: bold; color: #8b5cf6;">--</div>
                        <div style="font-size: 11px; color: #666;">Regularity</div>
                    </div>
                </div>
            </div>

            <div id="gx-waveform-area" style="background: #0a0a14; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <canvas id="gx-waveform" width="432" height="60" style="width: 100%; background: #1a1a2e; border-radius: 4px;"></canvas>
                <canvas id="gx-beats" width="432" height="24" style="width: 100%; margin-top: 4px;"></canvas>
            </div>

            <div style="background: #0a0a14; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 12px;">Settings</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="font-size: 11px; color: #666;">Time Signature</label>
                        <select id="gx-timesig" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                            <option value="3">3/4</option>
                            <option value="4" selected>4/4</option>
                            <option value="6">6/8</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Sensitivity</label>
                        <input type="range" id="gx-sensitivity" min="0.1" max="1" step="0.1" value="0.5" 
                            style="width: 100%; margin-top: 8px;">
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button id="gx-load" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;">
                    Load Audio
                </button>
                <button id="gx-analyze" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;">
                    Analyze
                </button>
            </div>

            <div style="display: flex; gap: 8px;">
                <button id="gx-export" style="flex: 1; padding: 12px; background: #8b5cf6; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;" disabled>
                    Export Groove
                </button>
                <button id="gx-apply" style="flex: 1; padding: 12px; background: #f59e0b; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;" disabled>
                    Apply to Selection
                </button>
            </div>
        `;

        document.body.appendChild(panel);
        this.setupPanelEvents(panel);

        return panel;
    }

    setupPanelEvents(panel) {
        panel.querySelector('#gx-close').addEventListener('click', () => panel.remove());

        panel.querySelector('#gx-load').addEventListener('click', async () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/*';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.audioBuffer = await this.loadAudioFile(file);
                    this.drawWaveform();
                }
            };
            input.click();
        });

        panel.querySelector('#gx-analyze').addEventListener('click', async () => {
            if (!this.audioBuffer) {
                alert('Load audio first');
                return;
            }
            this.analysisResult = await this.analyze();
            this.updatePanel(panel);
            this.drawBeatMarkers();
        });

        panel.querySelector('#gx-export').addEventListener('click', () => {
            const json = this.exportGrooveJSON();
            if (json) {
                const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'groove-template.json';
                a.click();
                URL.revokeObjectURL(url);
            }
        });

        panel.querySelector('#gx-timesig').addEventListener('change', (e) => {
            this.settings.timeSignature = parseInt(e.target.value);
        });

        panel.querySelector('#gx-sensitivity').addEventListener('input', (e) => {
            this.settings.sensitivity = parseFloat(e.target.value);
        });

        // Apply to Selection button handler
        panel.querySelector('#gx-apply').addEventListener('click', async () => {
            // Try to get selected tracks from the app
            let getSelectedTracks = null;
            if (typeof localAppServices !== 'undefined' && localAppServices.getSelectedTracks) {
                getSelectedTracks = localAppServices.getSelectedTracks;
            } else if (typeof getSelectedTracksForGroove === 'function') {
                getSelectedTracks = getSelectedTracksForGroove;
            } else if (typeof window.getSelectedTracksForGroove === 'function') {
                getSelectedTracks = window.getSelectedTracksForGroove;
            }

            if (!getSelectedTracks) {
                // Fallback: try to get tracks from the track list
                const tracks = typeof getTracksState === 'function' ? getTracksState() : [];
                if (tracks.length > 0) {
                    getSelectedTracks = () => tracks.filter(t => t.isSelected);
                    // If no tracks are selected, apply to all
                    const selected = getSelectedTracks();
                    if (selected.length === 0) {
                        getSelectedTracks = () => tracks;
                    }
                }
            }

            const result = await this.applyGrooveToSelection(getSelectedTracks);
            if (result) {
                // Show success feedback
                const btn = panel.querySelector('#gx-apply');
                const originalText = btn.textContent;
                btn.textContent = 'Applied!';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 2000);
            }
        });

    }

    updatePanel(panel) {
        if (!this.analysisResult) return;

        const { tempo, groove } = this.analysisResult;
        
        panel.querySelector('#gx-tempo').textContent = tempo.toFixed(1);
        panel.querySelector('#gx-swing').textContent = ((groove.swing || 0) * 100).toFixed(0) + '%';
        panel.querySelector('#gx-regularity').textContent = ((groove.regularity || 0) * 100).toFixed(0) + '%';
        
        panel.querySelector('#gx-export').disabled = false;
        panel.querySelector('#gx-apply').disabled = false;
    }

    /**
     * Apply groove to selected tracks/sequences
     * @param {Function} getSelectedTracks - Callback to get selected tracks
     */
    async applyGrooveToSelection(getSelectedTracks) {
        if (!this.analysisResult) {
            console.warn('[GrooveExtractor] No analysis result to apply');
            return;
        }

        const selectedTracks = getSelectedTracks ? getSelectedTracks() : [];
        if (selectedTracks.length === 0) {
            console.warn('[GrooveExtractor] No tracks selected for groove application');
            return;
        }

        const { tempo, groove } = this.analysisResult;
        const swing = groove.swing || 0;

        // Build custom groove pattern from analysis
        const groovePattern = this.buildGroovePatternFromAnalysis(tempo, swing);
        if (!groovePattern) {
            console.warn('[GrooveExtractor] Failed to build groove pattern');
            return;
        }

        // Apply to each selected track
        for (const track of selectedTracks) {
            if (track && typeof track.setCustomGroovePattern === 'function') {
                track.setCustomGroovePattern(groovePattern);
                console.log(`[GrooveExtractor] Applied groove to track ${track.id}`);
            }
        }

        // Also save to state for persistence
        if (typeof saveCustomGroovePattern === 'function') {
            saveCustomGroovePattern(`Groove-${Date.now()}`, 16, groovePattern.points);
        }

        console.log(`[GrooveExtractor] Applied groove (swing: ${(swing * 100).toFixed(0)}%) to ${selectedTracks.length} tracks`);
        return groovePattern;
    }

    /**
     * Build a custom groove pattern from analysis result
     */
    buildGroovePatternFromAnalysis(tempo, swing) {
        const sixteenthDuration = 60 / tempo / 4;
        const points = [];

        for (let i = 0; i < 16; i++) {
            // Apply swing only to off-beat 16ths (every other one)
            let offset = 0;
            if (i % 2 === 1) {
                offset = swing * sixteenthDuration;
            }
            points.push({
                id: `gp-${i}`,
                division: i,
                offset: offset,
                velocity: 0.5,
                duration: 1
            });
        }

        return {
            name: `Extracted Groove (${tempo.bpm?.toFixed(1) || 120} BPM)`,
            divisions: 16,
            points: points,
            swing: swing,
            tempo: tempo
        };
    }

    drawWaveform() {
        const canvas = document.querySelector('#gx-waveform');
        if (!canvas || !this.audioBuffer) return;

        const ctx = canvas.getContext('2d');
        const mono = this.getMonoChannel(this.audioBuffer);
        const samplesPerPixel = Math.floor(mono.length / canvas.width);

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#10b981';
        ctx.beginPath();

        for (let x = 0; x < canvas.width; x++) {
            let max = 0;
            for (let i = 0; i < samplesPerPixel; i++) {
                const idx = x * samplesPerPixel + i;
                if (idx < mono.length) {
                    max = Math.max(max, Math.abs(mono[idx]));
                }
            }
            const y = canvas.height / 2 - max * canvas.height / 2;
            ctx.moveTo(x, canvas.height / 2);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    drawBeatMarkers() {
        const canvas = document.querySelector('#gx-beats');
        if (!canvas || !this.analysisResult?.beats?.length) return;

        const ctx = canvas.getContext('2d');
        const { beats, duration } = this.analysisResult;

        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#3b82f6';
        for (const beat of beats) {
            const x = (beat.time / duration) * canvas.width;
            ctx.fillRect(x - 1, 0, 2, canvas.height);
        }
    }
}

// Export singleton
let grooveExtractorInstance = null;

export function getGrooveExtractor(options = {}) {
    if (!grooveExtractorInstance) {
        grooveExtractorInstance = new GrooveExtractor(options);
    }
    return grooveExtractorInstance;
}

export function openGrooveExtractorPanel() {
    const extractor = getGrooveExtractor();
    return extractor.createPanel();
}
