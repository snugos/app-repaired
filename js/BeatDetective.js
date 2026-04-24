/**
 * Beat Detective - Detect and extract beat patterns from audio
 * Analyzes audio to find tempo, beats, and rhythmic patterns
 */

export class BeatDetective {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = this.audioContext?.sampleRate || 44100;
        
        // Detection settings
        this.settings = {
            minTempo: options.minTempo || 60,
            maxTempo: options.maxTempo || 200,
            timeSignature: options.timeSignature || 4,
            sensitivity: options.sensitivity || 0.5,
            gridSize: options.gridSize || 16, // 16th notes
            analyzeGroove: options.analyzeGroove || true,
            extractPattern: options.extractPattern || true
        };
        
        // Analysis results
        this.analysisResult = null;
        this.beats = [];
        this.downbeats = [];
        this.tempo = null;
        this.groove = null;
    }
    
    /**
     * Analyze audio for beat information
     */
    async analyze(audioBuffer, options = {}) {
        const settings = { ...this.settings, ...options };
        
        // Get mono data
        const monoData = this.getMonoData(audioBuffer);
        
        // 1. Detect tempo
        const tempoResult = this.detectTempo(monoData, audioBuffer.sampleRate, settings);
        this.tempo = tempoResult.tempo;
        
        // 2. Detect beat positions
        const beatResult = this.detectBeats(monoData, audioBuffer.sampleRate, this.tempo, settings);
        this.beats = beatResult.beats;
        
        // 3. Find downbeats (first beat of each bar)
        this.downbeats = this.findDownbeats(this.beats, settings.timeSignature);
        
        // 4. Analyze groove if enabled
        if (settings.analyzeGroove) {
            this.groove = this.analyzeGroove(this.beats, this.tempo);
        }
        
        // 5. Extract pattern if enabled
        let pattern = null;
        if (settings.extractPattern) {
            pattern = this.extractPattern(monoData, this.beats, audioBuffer.sampleRate, settings);
        }
        
        this.analysisResult = {
            tempo: this.tempo,
            tempoConfidence: tempoResult.confidence,
            beats: this.beats,
            downbeats: this.downbeats,
            groove: this.groove,
            pattern,
            duration: audioBuffer.duration,
            timeSignature: settings.timeSignature
        };
        
        console.log(`[BeatDetective] Analysis complete: ${this.tempo.toFixed(1)} BPM, ${this.beats.length} beats`);
        
        return this.analysisResult;
    }
    
    /**
     * Get mono data from audio buffer
     */
    getMonoData(audioBuffer) {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }
        
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
     * Detect tempo using autocorrelation
     */
    detectTempo(audioData, sampleRate, settings) {
        const { minTempo, maxTempo } = settings;
        
        // Convert tempo range to beat periods (in samples)
        const minBeatPeriod = Math.round(60 / maxTempo * sampleRate);
        const maxBeatPeriod = Math.round(60 / minTempo * sampleRate);
        
        // Calculate onset envelope
        const onsetEnvelope = this.calculateOnsetEnvelope(audioData, sampleRate);
        
        // Autocorrelate onset envelope
        const autocorr = this.autocorrelate(onsetEnvelope);
        
        // Find peak in tempo range
        let bestPeriod = minBeatPeriod;
        let bestValue = 0;
        
        // Normalize onset envelope length to samples
        const hopSize = 512;
        
        for (let period = Math.floor(minBeatPeriod / hopSize); period < Math.floor(maxBeatPeriod / hopSize); period++) {
            if (period < autocorr.length && autocorr[period] > bestValue) {
                bestValue = autocorr[period];
                bestPeriod = period * hopSize;
            }
        }
        
        const tempo = 60 * sampleRate / bestPeriod;
        const confidence = bestValue / Math.max(...autocorr);
        
        return { tempo, confidence, period: bestPeriod };
    }
    
    /**
     * Calculate onset envelope
     */
    calculateOnsetEnvelope(audioData, sampleRate) {
        const fftSize = 2048;
        const hopSize = 512;
        const numFrames = Math.floor((audioData.length - fftSize) / hopSize);
        
        const envelope = new Float32Array(numFrames);
        let prevSpectrum = null;
        
        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * hopSize;
            
            // Simple spectral flux
            let flux = 0;
            
            // Compute spectrum (simplified)
            const spectrum = new Float32Array(fftSize / 2);
            for (let k = 0; k < fftSize / 2; k++) {
                let real = 0;
                let imag = 0;
                
                for (let n = 0; n < fftSize; n++) {
                    const idx = start + n;
                    if (idx < audioData.length) {
                        const window = 0.5 * (1 - Math.cos(2 * Math.PI * n / fftSize));
                        const sample = audioData[idx] * window;
                        real += sample * Math.cos(2 * Math.PI * k * n / fftSize);
                        imag -= sample * Math.sin(2 * Math.PI * k * n / fftSize);
                    }
                }
                
                spectrum[k] = Math.sqrt(real * real + imag * imag);
            }
            
            // Calculate positive spectral difference
            if (prevSpectrum) {
                for (let k = 0; k < spectrum.length; k++) {
                    const diff = spectrum[k] - prevSpectrum[k];
                    if (diff > 0) {
                        flux += diff;
                    }
                }
            }
            
            envelope[frame] = flux;
            prevSpectrum = spectrum;
        }
        
        return envelope;
    }
    
    /**
     * Autocorrelate signal
     */
    autocorrelate(signal) {
        const n = signal.length;
        const result = new Float32Array(n);
        
        for (let lag = 0; lag < n; lag++) {
            let sum = 0;
            for (let i = 0; i < n - lag; i++) {
                sum += signal[i] * signal[i + lag];
            }
            result[lag] = sum;
        }
        
        return result;
    }
    
    /**
     * Detect beat positions
     */
    detectBeats(audioData, sampleRate, tempo, settings) {
        const beats = [];
        const beatPeriod = 60 / tempo; // in seconds
        const hopSize = 512;
        
        // Get onset envelope
        const onsetEnvelope = this.calculateOnsetEnvelope(audioData, sampleRate);
        
        // Find peaks
        const threshold = settings.sensitivity * 0.5 * Math.max(...onsetEnvelope);
        
        // Expected beat frames
        const beatFrames = Math.round(beatPeriod * sampleRate / hopSize);
        
        // Dynamic threshold around expected beats
        let lastBeatFrame = -beatFrames * 2;
        
        for (let i = 1; i < onsetEnvelope.length - 1; i++) {
            const frame = onsetEnvelope[i];
            
            // Check if peak
            if (frame > onsetEnvelope[i - 1] && frame > onsetEnvelope[i + 1]) {
                // Check timing constraint (should be near expected beat)
                const framesSinceLastBeat = i - lastBeatFrame;
                const expectedFrames = beatFrames;
                
                // Allow some tolerance
                if (framesSinceLastBeat >= beatFrames * 0.5) {
                    const localThreshold = threshold * (0.8 + 0.2 * Math.min(1, framesSinceLastBeat / expectedFrames));
                    
                    if (frame > localThreshold) {
                        const time = i * hopSize / sampleRate;
                        const samplePosition = i * hopSize;
                        
                        beats.push({
                            time,
                            samplePosition,
                            frame: i,
                            strength: frame,
                            beatNumber: beats.length
                        });
                        
                        lastBeatFrame = i;
                    }
                }
            }
        }
        
        return beats;
    }
    
    /**
     * Find downbeats (bar starts)
     */
    findDownbeats(beats, timeSignature) {
        const downbeats = [];
        
        // Look for patterns in beat strengths
        const strengths = beats.map(b => b.strength);
        
        // Simple approach: every Nth beat is a downbeat
        for (let i = 0; i < beats.length; i += timeSignature) {
            if (beats[i]) {
                downbeats.push({
                    ...beats[i],
                    barNumber: Math.floor(i / timeSignature),
                    type: 'downbeat'
                });
            }
        }
        
        return downbeats;
    }
    
    /**
     * Analyze groove (timing deviations)
     */
    analyzeGroove(beats, tempo) {
        if (beats.length < 2) return null;
        
        const beatPeriod = 60 / tempo;
        const deviations = [];
        
        // Calculate timing deviations from perfect grid
        for (let i = 1; i < beats.length; i++) {
            const expectedTime = beats[0].time + i * beatPeriod;
            const actualTime = beats[i].time;
            const deviation = (actualTime - expectedTime) / beatPeriod; // As fraction of beat
            
            deviations.push({
                beatIndex: i,
                expectedTime,
                actualTime,
                deviation,
                deviationMs: deviation * beatPeriod * 1000
            });
        }
        
        // Calculate statistics
        const avgDeviation = deviations.reduce((sum, d) => sum + d.deviation, 0) / deviations.length;
        const stdDev = Math.sqrt(
            deviations.reduce((sum, d) => sum + Math.pow(d.deviation - avgDeviation, 2), 0) / deviations.length
        );
        
        return {
            deviations,
            averageDeviation: avgDeviation,
            standardDeviation: stdDev,
            swing: this.calculateSwing(deviations)
        };
    }
    
    /**
     * Calculate swing feel
     */
    calculateSwing(deviations) {
        // Swing is typically on off-beats (every other beat)
        const offBeatDeviations = deviations.filter((_, i) => i % 2 === 1);
        
        if (offBeatDeviations.length === 0) return 0;
        
        const avgOffBeatDeviation = offBeatDeviations.reduce((sum, d) => sum + d.deviation, 0) / offBeatDeviations.length;
        
        // Swing percentage (0 = straight, 1 = full swing triplet)
        return avgOffBeatDeviation * 2; // Normalize to 0-1 range
    }
    
    /**
     * Extract rhythmic pattern
     */
    extractPattern(audioData, beats, sampleRate, settings) {
        const gridSubdivisions = settings.gridSize;
        const beatDuration = 60 / this.tempo;
        const subdivisionDuration = beatDuration / (gridSubdivisions / 4);
        
        // Create pattern grid
        const totalBars = Math.ceil(beats[beats.length - 1].time / (beatDuration * settings.timeSignature));
        const totalSubdivisions = totalBars * settings.timeSignature * (gridSubdivisions / 4);
        
        const pattern = new Array(totalSubdivisions).fill(0);
        
        // Fill pattern with onset strengths
        const onsetEnvelope = this.calculateOnsetEnvelope(audioData, sampleRate);
        const hopSize = 512;
        
        for (let i = 0; i < onsetEnvelope.length; i++) {
            const time = i * hopSize / sampleRate;
            const subdivision = Math.floor(time / subdivisionDuration);
            
            if (subdivision < pattern.length) {
                pattern[subdivision] = Math.max(pattern[subdivision], onsetEnvelope[i]);
            }
        }
        
        // Normalize
        const maxVal = Math.max(...pattern);
        if (maxVal > 0) {
            for (let i = 0; i < pattern.length; i++) {
                pattern[i] /= maxVal;
            }
        }
        
        return {
            grid: pattern,
            subdivisions: gridSubdivisions,
            beatDuration,
            subdivisionDuration,
            totalBars
        };
    }
    
    /**
     * Apply detected groove to MIDI pattern
     */
    applyGrooveToPattern(notes, groove, originalTempo) {
        if (!groove) return notes;
        
        const beatDuration = 60 / originalTempo;
        
        return notes.map((note, i) => {
            const beatIndex = Math.floor(note.startTime / beatDuration);
            const deviation = groove.deviations[beatIndex % groove.deviations.length];
            
            if (deviation) {
                return {
                    ...note,
                    startTime: note.startTime + deviation.deviation * beatDuration,
                    grooveApplied: true,
                    grooveDeviation: deviation.deviation
                };
            }
            
            return note;
        });
    }
    
    /**
     * Quantize beats to grid
     */
    quantizeBeats(beats, gridSize, tempo) {
        const beatDuration = 60 / tempo;
        const gridDuration = beatDuration / gridSize * 4;
        
        return beats.map(beat => ({
            ...beat,
            originalTime: beat.time,
            time: Math.round(beat.time / gridDuration) * gridDuration,
            quantized: true
        }));
    }
    
    /**
     * Create UI panel
     */
    createUI() {
        const panel = document.createElement('div');
        panel.id = 'beat-detective-panel';
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
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        panel.innerHTML = `
            <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">Beat Detective</h2>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Analysis Results</div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; text-align: center;">
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #10b981;" id="bd-tempo">--</div>
                        <div style="font-size: 11px; color: #666;">BPM</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #3b82f6;" id="bd-beats">--</div>
                        <div style="font-size: 11px; color: #666;">Beats</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #f59e0b;" id="bd-bars">--</div>
                        <div style="font-size: 11px; color: #666;">Bars</div>
                    </div>
                    <div>
                        <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;" id="bd-swing">--</div>
                        <div style="font-size: 11px; color: #666;">Swing %</div>
                    </div>
                </div>
            </div>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Waveform & Beats</div>
                <canvas id="bd-waveform" width="460" height="80" style="width: 100%; background: #1a1a2e; border-radius: 4px;"></canvas>
                <canvas id="bd-beat-markers" width="460" height="30" style="width: 100%; margin-top: 4px;"></canvas>
            </div>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Settings</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="font-size: 11px; color: #666;">Time Signature</label>
                        <select id="bd-timesig" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                            <option value="3">3/4</option>
                            <option value="4" selected>4/4</option>
                            <option value="6">6/8</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Grid Size</label>
                        <select id="bd-grid" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                            <option value="8">8th notes</option>
                            <option value="16" selected>16th notes</option>
                            <option value="32">32nd notes</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="bd-load-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Load Audio
                </button>
                <button id="bd-analyze-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Analyze
                </button>
                <button id="bd-export-btn" style="flex: 1; padding: 12px; background: #8b5cf6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Export
                </button>
                <button id="bd-close-btn" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupUIEvents(panel);
        
        return panel;
    }
    
    setupUIEvents(panel) {
        panel.querySelector('#bd-load-btn').addEventListener('click', () => {
            this.loadFromUI();
        });
        
        panel.querySelector('#bd-analyze-btn').addEventListener('click', () => {
            this.analyzeFromUI();
        });
        
        panel.querySelector('#bd-export-btn').addEventListener('click', () => {
            this.exportFromUI();
        });
        
        panel.querySelector('#bd-close-btn').addEventListener('click', () => {
            panel.remove();
        });
        
        panel.querySelector('#bd-timesig').addEventListener('change', (e) => {
            this.settings.timeSignature = parseInt(e.target.value);
        });
        
        panel.querySelector('#bd-grid').addEventListener('change', (e) => {
            this.settings.gridSize = parseInt(e.target.value);
        });
    }
    
    async loadFromUI() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const arrayBuffer = await file.arrayBuffer();
            this.currentBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.drawWaveform();
        };
        
        input.click();
    }
    
    async analyzeFromUI() {
        if (!this.currentBuffer) {
            alert('Load audio first');
            return;
        }
        
        const result = await this.analyze(this.currentBuffer);
        this.updateUI(result);
        this.drawBeatMarkers();
    }
    
    updateUI(result) {
        const panel = document.querySelector('#beat-detective-panel');
        if (!panel) return;
        
        panel.querySelector('#bd-tempo').textContent = result.tempo.toFixed(1);
        panel.querySelector('#bd-beats').textContent = result.beats.length;
        panel.querySelector('#bd-bars').textContent = Math.ceil(result.beats.length / result.timeSignature);
        panel.querySelector('#bd-swing').textContent = result.groove 
            ? Math.round(result.groove.swing * 100) 
            : '--';
    }
    
    drawWaveform() {
        const canvas = document.querySelector('#bd-waveform');
        if (!canvas || !this.currentBuffer) return;
        
        const ctx = canvas.getContext('2d');
        const mono = this.getMonoData(this.currentBuffer);
        const samplesPerPixel = Math.floor(mono.length / canvas.width);
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#10b981';
        ctx.beginPath();
        
        for (let x = 0; x < canvas.width; x++) {
            let max = 0;
            for (let i = 0; i < samplesPerPixel; i++) {
                max = Math.max(max, Math.abs(mono[x * samplesPerPixel + i] || 0));
            }
            
            const y = canvas.height / 2 - max * canvas.height / 2;
            ctx.moveTo(x, canvas.height / 2);
            ctx.lineTo(x, y);
        }
        
        ctx.stroke();
    }
    
    drawBeatMarkers() {
        const canvas = document.querySelector('#bd-beat-markers');
        if (!canvas || !this.beats.length || !this.currentBuffer) return;
        
        const ctx = canvas.getContext('2d');
        const duration = this.currentBuffer.duration;
        
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw beats
        ctx.fillStyle = '#3b82f6';
        for (const beat of this.beats) {
            const x = (beat.time / duration) * canvas.width;
            ctx.fillRect(x - 1, 0, 2, canvas.height);
        }
        
        // Draw downbeats
        ctx.fillStyle = '#f59e0b';
        for (const downbeat of this.downbeats) {
            const x = (downbeat.time / duration) * canvas.width;
            ctx.fillRect(x - 2, 0, 4, canvas.height);
        }
    }
    
    exportFromUI() {
        if (!this.analysisResult) {
            alert('Analyze audio first');
            return;
        }
        
        console.log('[BeatDetective] Export result:', this.analysisResult);
        alert('Analysis data exported to console');
    }
}

// Export singleton
let beatDetectiveInstance = null;

export function getBeatDetective(options = {}) {
    if (!beatDetectiveInstance) {
        beatDetectiveInstance = new BeatDetective(options);
    }
    return beatDetectiveInstance;
}

export function openBeatDetectivePanel() {
    const detective = getBeatDetective();
    return detective.createUI();
}