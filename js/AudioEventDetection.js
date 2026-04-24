/**
 * AudioEventDetection.js
 * Detect transients, onsets, beats, and other audio events
 */

class AudioEventDetection {
    constructor() {
        this.isEnabled = true;
        this.detectionMode = 'full'; // full, transients, beats, onsets
        this.sampleRate = 44100;
        this.fftSize = 2048;
        this.hopSize = 512;
        
        // Detection thresholds
        this.thresholds = {
            transient: 0.3,      // Amplitude threshold for transient detection
            onset: 0.15,         // Spectral flux threshold for onset detection
            beat: 0.25,          // Beat detection threshold
            silence: -60,        // dB threshold for silence detection
            minInterval: 0.05    // Minimum interval between events (seconds)
        };
        
        // Detected events
        this.events = [];
        this.transients = [];
        this.onsets = [];
        this.beats = [];
        this.silenceRegions = [];
        
        // Analysis buffers
        this.analysisBuffer = null;
        this.spectralFluxHistory = [];
        this.energyHistory = [];
        
        // Beat tracking state
        this.bpm = 120;
        this.beatPhase = 0;
        this.beatConfidence = 0;
        
        // Callbacks
        this.onEventDetected = null;
        this.onBeatDetected = null;
        this.onTransientDetected = null;
        
        this.init();
    }
    
    init() {
        console.log('[EventDetection] Initialized');
    }
    
    // Set audio buffer for analysis
    setAudioBuffer(buffer, sampleRate = 44100) {
        this.sampleRate = sampleRate;
        this.analysisBuffer = buffer;
        this.events = [];
        this.transients = [];
        this.onsets = [];
        this.beats = [];
        this.silenceRegions = [];
        this.spectralFluxHistory = [];
        this.energyHistory = [];
    }
    
    // Main detection method
    detectAll(buffer = null, sampleRate = 44100) {
        if (buffer) {
            this.setAudioBuffer(buffer, sampleRate);
        }
        
        if (!this.analysisBuffer) {
            console.error('[EventDetection] No audio buffer set');
            return null;
        }
        
        const startTime = Date.now();
        
        // Reset results
        this.events = [];
        this.transients = [];
        this.onsets = [];
        this.beats = [];
        this.silenceRegions = [];
        
        // Get audio data
        const channelData = this.analysisBuffer.getChannelData ? 
            this.analysisBuffer.getChannelData(0) : 
            this.analysisBuffer;
        
        // Run all detection algorithms
        this.detectTransients(channelData);
        this.detectOnsets(channelData);
        this.detectBeats(channelData);
        this.detectSilence(channelData);
        
        // Merge all events
        this.mergeEvents();
        
        const duration = Date.now() - startTime;
        console.log(`[EventDetection] Detected ${this.events.length} events in ${duration}ms`);
        
        return {
            events: this.events,
            transients: this.transients,
            onsets: this.onsets,
            beats: this.beats,
            silence: this.silenceRegions,
            bpm: this.bpm,
            beatConfidence: this.beatConfidence,
            analysisTime: duration
        };
    }
    
    // Transient detection (amplitude-based)
    detectTransients(samples) {
        const threshold = this.thresholds.transient;
        const minInterval = Math.floor(this.thresholds.minInterval * this.sampleRate);
        const windowSize = Math.floor(0.01 * this.sampleRate); // 10ms window
        
        let lastTransient = -minInterval;
        let prevEnergy = 0;
        
        for (let i = windowSize; i < samples.length - windowSize; i += windowSize) {
            // Calculate energy in window
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += samples[i - windowSize + j] ** 2;
            }
            energy = Math.sqrt(energy / windowSize);
            
            // Check for transient (sudden energy increase)
            const energyDiff = energy - prevEnergy;
            
            if (energyDiff > threshold && i - lastTransient > minInterval) {
                this.transients.push({
                    type: 'transient',
                    time: i / this.sampleRate,
                    sample: i,
                    strength: energyDiff,
                    energy: energy
                });
                lastTransient = i;
            }
            
            this.energyHistory.push(energy);
            prevEnergy = energy * 0.9; // Smooth
        }
        
        console.log(`[EventDetection] Found ${this.transients.length} transients`);
        return this.transients;
    }
    
    // Onset detection (spectral flux based)
    detectOnsets(samples) {
        const hopSize = this.hopSize;
        const fftSize = this.fftSize;
        const threshold = this.thresholds.onset;
        const minInterval = Math.floor(this.thresholds.minInterval * this.sampleRate / hopSize);
        
        let prevSpectrum = null;
        let lastOnset = -minInterval;
        
        // Process in frames
        for (let i = 0; i < samples.length - fftSize; i += hopSize) {
            // Get spectrum for this frame (simplified FFT)
            const spectrum = this.computeSpectrum(samples, i, fftSize);
            
            if (prevSpectrum) {
                // Calculate spectral flux
                let flux = 0;
                for (let j = 0; j < spectrum.length; j++) {
                    const diff = spectrum[j] - prevSpectrum[j];
                    if (diff > 0) {
                        flux += diff ** 2;
                    }
                }
                flux = Math.sqrt(flux / spectrum.length);
                
                this.spectralFluxHistory.push(flux);
                
                // Check for onset
                if (flux > threshold && this.spectralFluxHistory.length - lastOnset > minInterval) {
                    this.onsets.push({
                        type: 'onset',
                        time: i / this.sampleRate,
                        sample: i,
                        spectralFlux: flux
                    });
                    lastOnset = this.spectralFluxHistory.length;
                }
            }
            
            prevSpectrum = spectrum;
        }
        
        console.log(`[EventDetection] Found ${this.onsets.length} onsets`);
        return this.onsets;
    }
    
    // Compute spectrum using simplified DFT
    computeSpectrum(samples, start, size) {
        const spectrum = new Float32Array(size / 2);
        
        for (let k = 0; k < size / 2; k++) {
            let real = 0;
            let imag = 0;
            
            for (let n = 0; n < size && start + n < samples.length; n++) {
                const angle = (2 * Math.PI * k * n) / size;
                real += samples[start + n] * Math.cos(angle);
                imag -= samples[start + n] * Math.sin(angle);
            }
            
            spectrum[k] = Math.sqrt(real * real + imag * imag) / size;
        }
        
        return spectrum;
    }
    
    // Beat detection
    detectBeats(samples) {
        // Use onset positions for beat tracking
        if (this.onsets.length < 4) {
            // Not enough onsets for beat tracking
            this.bpm = 0;
            this.beatConfidence = 0;
            return [];
        }
        
        // Calculate inter-onset intervals
        const iois = [];
        for (let i = 1; i < this.onsets.length; i++) {
            iois.push(this.onsets[i].time - this.onsets[i - 1].time);
        }
        
        // Cluster IOIs to find most common interval
        const clusters = this.clusterIntervals(iois);
        
        // Find the most significant cluster (likely the beat interval)
        let bestCluster = clusters[0];
        for (const cluster of clusters) {
            if (cluster.count > bestCluster.count) {
                bestCluster = cluster;
            }
        }
        
        // Calculate BPM from beat interval
        const beatInterval = bestCluster.mean;
        this.bpm = Math.round(60 / beatInterval);
        this.beatConfidence = bestCluster.count / this.onsets.length;
        
        // Generate beat positions
        const beats = [];
        let beatTime = 0;
        const duration = samples.length / this.sampleRate;
        
        while (beatTime < duration) {
            beats.push({
                type: 'beat',
                time: beatTime,
                sample: Math.floor(beatTime * this.sampleRate),
                bpm: this.bpm,
                confidence: this.beatConfidence
            });
            beatTime += beatInterval;
        }
        
        this.beats = beats;
        console.log(`[EventDetection] Detected BPM: ${this.bpm} (confidence: ${Math.round(this.beatConfidence * 100)}%)`);
        
        return beats;
    }
    
    // Cluster intervals using simple k-means-like approach
    clusterIntervals(intervals) {
        const clusters = [];
        const tolerance = 0.05; // 50ms tolerance
        
        for (const interval of intervals) {
            // Find matching cluster
            let matched = false;
            for (const cluster of clusters) {
                if (Math.abs(cluster.mean - interval) < tolerance) {
                    // Update cluster
                    cluster.sum += interval;
                    cluster.count++;
                    cluster.mean = cluster.sum / cluster.count;
                    matched = true;
                    break;
                }
            }
            
            if (!matched) {
                // Create new cluster
                clusters.push({
                    sum: interval,
                    count: 1,
                    mean: interval
                });
            }
        }
        
        // Sort by count (most common first)
        clusters.sort((a, b) => b.count - a.count);
        
        return clusters;
    }
    
    // Silence detection
    detectSilence(samples) {
        const threshold = Math.pow(10, this.thresholds.silence / 20);
        const windowSize = Math.floor(0.1 * this.sampleRate); // 100ms window
        
        let silenceStart = -1;
        
        for (let i = 0; i < samples.length; i += windowSize) {
            // Calculate RMS in window
            let sumSquares = 0;
            let count = 0;
            
            for (let j = 0; j < windowSize && i + j < samples.length; j++) {
                sumSquares += samples[i + j] ** 2;
                count++;
            }
            
            const rms = Math.sqrt(sumSquares / count);
            
            if (rms < threshold) {
                // Silence detected
                if (silenceStart < 0) {
                    silenceStart = i;
                }
            } else {
                // Non-silence
                if (silenceStart >= 0) {
                    this.silenceRegions.push({
                        type: 'silence',
                        startTime: silenceStart / this.sampleRate,
                        endTime: i / this.sampleRate,
                        duration: (i - silenceStart) / this.sampleRate
                    });
                    silenceStart = -1;
                }
            }
        }
        
        // Handle trailing silence
        if (silenceStart >= 0) {
            this.silenceRegions.push({
                type: 'silence',
                startTime: silenceStart / this.sampleRate,
                endTime: samples.length / this.sampleRate,
                duration: (samples.length - silenceStart) / this.sampleRate
            });
        }
        
        console.log(`[EventDetection] Found ${this.silenceRegions.length} silence regions`);
        return this.silenceRegions;
    }
    
    // Merge all events into sorted list
    mergeEvents() {
        this.events = [
            ...this.transients.map(e => ({ ...e, category: 'transient' })),
            ...this.onsets.map(e => ({ ...e, category: 'onset' })),
            ...this.beats.map(e => ({ ...e, category: 'beat' })),
            ...this.silenceRegions.map(e => ({ ...e, category: 'silence' }))
        ];
        
        // Sort by time
        this.events.sort((a, b) => a.time - b.time);
    }
    
    // Get events in time range
    getEventsInRange(startTime, endTime, type = null) {
        return this.events.filter(e => {
            if (e.time < startTime || e.time > endTime) return false;
            if (type && e.category !== type) return false;
            return true;
        });
    }
    
    // Get events by type
    getEventsByType(type) {
        switch (type) {
            case 'transient': return this.transients;
            case 'onset': return this.onsets;
            case 'beat': return this.beats;
            case 'silence': return this.silenceRegions;
            default: return this.events;
        }
    }
    
    // Real-time detection from audio node
    startRealTimeDetection(audioContext, sourceNode) {
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        sourceNode.connect(this.analyser);
        
        this.isRealTimeActive = true;
        this.realTimeLoop();
    }
    
    realTimeLoop() {
        if (!this.isRealTimeActive || !this.analyser) return;
        
        const dataArray = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(dataArray);
        
        // Detect transient in real-time
        let energy = 0;
        for (let i = 0; i < dataArray.length; i++) {
            energy += dataArray[i] ** 2;
        }
        energy = Math.sqrt(energy / dataArray.length);
        
        if (energy > this.thresholds.transient && this.onTransientDetected) {
            this.onTransientDetected({
                time: this.analyser.context.currentTime,
                energy: energy
            });
        }
        
        // Continue loop
        requestAnimationFrame(() => this.realTimeLoop());
    }
    
    stopRealTimeDetection() {
        this.isRealTimeActive = false;
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
    }
    
    // Export events
    exportEvents() {
        return {
            events: this.events,
            transients: this.transients,
            onsets: this.onsets,
            beats: this.beats,
            silence: this.silenceRegions,
            bpm: this.bpm,
            beatConfidence: this.beatConfidence,
            thresholds: this.thresholds
        };
    }
    
    // Import events
    importEvents(data) {
        if (data.events) this.events = data.events;
        if (data.transients) this.transients = data.transients;
        if (data.onsets) this.onsets = data.onsets;
        if (data.beats) this.beats = data.beats;
        if (data.silence) this.silenceRegions = data.silence;
        if (data.bpm) this.bpm = data.bpm;
        if (data.beatConfidence) this.beatConfidence = data.beatConfidence;
        if (data.thresholds) Object.assign(this.thresholds, data.thresholds);
    }
    
    // UI Panel
    openPanel() {
        const existing = document.getElementById('event-detection-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'event-detection-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 750px;
            max-height: 85vh;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            color: white;
            font-family: system-ui;
            z-index: 10000;
            overflow: hidden;
        `;
        
        panel.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 18px;">🔊 Audio Event Detection</h3>
                    <button id="close-detection-panel" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
                </div>
            </div>
            
            <div style="padding: 16px; max-height: 70vh; overflow-y: auto;">
                <!-- File input -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Audio Source</h4>
                    <label style="
                        display: block;
                        padding: 20px;
                        border: 2px dashed #333;
                        border-radius: 6px;
                        text-align: center;
                        cursor: pointer;
                    " onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#333'">
                        <input type="file" id="audio-file" accept="audio/*" style="display: none;">
                        <div style="font-size: 24px; margin-bottom: 8px;">🎵</div>
                        <div style="font-size: 12px; color: #888;">Drop audio file to analyze</div>
                    </label>
                </div>
                
                <!-- Detection mode -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Detection Mode</h4>
                    <select id="detection-mode" style="width: 100%; padding: 10px; background: #0a0a14; border: 1px solid #333; color: white; border-radius: 4px;">
                        <option value="full">Full (All Events)</option>
                        <option value="transients">Transients Only</option>
                        <option value="beats">Beat Detection</option>
                        <option value="onsets">Onsets Only</option>
                    </select>
                </div>
                
                <!-- Thresholds -->
                <div style="margin-bottom: 20px; background: #0a0a14; padding: 12px; border-radius: 4px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Thresholds</h4>
                    
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 11px; color: #888;">Transient: <span id="trans-val">${this.thresholds.transient}</span></label>
                        <input type="range" id="trans-threshold" min="0.1" max="1" step="0.05" value="${this.thresholds.transient}" style="width: 100%;">
                    </div>
                    
                    <div style="margin-bottom: 8px;">
                        <label style="font-size: 11px; color: #888;">Onset: <span id="onset-val">${this.thresholds.onset}</span></label>
                        <input type="range" id="onset-threshold" min="0.05" max="0.5" step="0.01" value="${this.thresholds.onset}" style="width: 100%;">
                    </div>
                    
                    <div>
                        <label style="font-size: 11px; color: #888;">Beat: <span id="beat-val">${this.thresholds.beat}</span></label>
                        <input type="range" id="beat-threshold" min="0.1" max="0.5" step="0.01" value="${this.thresholds.beat}" style="width: 100%;">
                    </div>
                </div>
                
                <!-- Analyze button -->
                <button id="analyze-btn" style="width: 100%; padding: 14px; background: #667eea; border: none; color: white; border-radius: 6px; font-size: 14px; cursor: pointer; margin-bottom: 20px;" disabled>
                    🔍 Analyze Audio
                </button>
                
                <!-- Results -->
                <div id="results" style="display: none;">
                    ${this.renderResults()}
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupPanelEvents();
    }
    
    renderResults() {
        const r = {
            events: this.events,
            transients: this.transients,
            onsets: this.onsets,
            beats: this.beats,
            silence: this.silenceRegions,
            bpm: this.bpm,
            beatConfidence: this.beatConfidence
        };
        
        return `
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Detection Results</h4>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 12px;">
                    <div style="padding: 8px; background: #1a1a2e; border-radius: 4px; text-align: center;">
                        <div style="color: #888;">Transients</div>
                        <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${r.transients.length}</div>
                    </div>
                    
                    <div style="padding: 8px; background: #1a1a2e; border-radius: 4px; text-align: center;">
                        <div style="color: #888;">Onsets</div>
                        <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${r.onsets.length}</div>
                    </div>
                    
                    <div style="padding: 8px; background: #1a1a2e; border-radius: 4px; text-align: center;">
                        <div style="color: #888;">Beats</div>
                        <div style="font-size: 24px; font-weight: bold; color: #10b981;">${r.beats.length}</div>
                    </div>
                </div>
                
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #333;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="color: #888;">Detected BPM:</span>
                            <span style="font-size: 24px; font-weight: bold; margin-left: 8px;">${r.bpm}</span>
                        </div>
                        <div style="font-size: 12px; color: ${r.beatConfidence > 0.5 ? '#10b981' : '#f59e0b'};">
                            ${Math.round(r.beatConfidence * 100)}% confidence
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Event Timeline -->
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Event Timeline</h4>
                <div style="max-height: 200px; overflow-y: auto;">
                    ${this.renderEventTimeline(r.events)}
                </div>
            </div>
        `;
    }
    
    renderEventTimeline(events) {
        if (events.length === 0) {
            return '<div style="color: #666; font-size: 12px; text-align: center;">No events detected</div>';
        }
        
        const categoryColors = {
            transient: '#ef4444',
            onset: '#f59e0b',
            beat: '#10b981',
            silence: '#666'
        };
        
        return events.slice(0, 100).map(e => `
            <div style="display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid #222; font-size: 11px;">
                <div style="min-width: 80px; color: #888;">${e.time.toFixed(3)}s</div>
                <div style="min-width: 60px; color: ${categoryColors[e.category] || '#888'};">${e.category.toUpperCase()}</div>
                <div style="color: #666;">${e.strength ? `strength: ${e.strength.toFixed(2)}` : ''}</div>
            </div>
        `).join('');
    }
    
    setupPanelEvents() {
        const panel = document.getElementById('event-detection-panel');
        if (!panel) return;
        
        panel.querySelector('#close-detection-panel').onclick = () => panel.remove();
        
        // File input
        panel.querySelector('#audio-file').onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                this.audioFile = file;
                panel.querySelector('#analyze-btn').disabled = false;
            }
        };
        
        // Thresholds
        const updateThreshold = (id, key, displayId) => {
            panel.querySelector(id).oninput = (e) => {
                this.thresholds[key] = parseFloat(e.target.value);
                panel.querySelector(displayId).textContent = e.target.value;
            };
        };
        
        updateThreshold('#trans-threshold', 'transient', '#trans-val');
        updateThreshold('#onset-threshold', 'onset', '#onset-val');
        updateThreshold('#beat-threshold', 'beat', '#beat-val');
        
        // Analyze
        panel.querySelector('#analyze-btn').onclick = async () => {
            if (!this.audioFile) return;
            
            const btn = panel.querySelector('#analyze-btn');
            btn.textContent = '⏳ Analyzing...';
            btn.disabled = true;
            
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const arrayBuffer = await this.audioFile.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                this.detectAll(audioBuffer, audioContext.sampleRate);
                
                panel.querySelector('#results').style.display = 'block';
                panel.querySelector('#results').innerHTML = this.renderResults();
            } catch (error) {
                console.error('[EventDetection] Analysis failed:', error);
                alert('Failed to analyze audio file');
            }
            
            btn.textContent = '🔍 Analyze Audio';
            btn.disabled = false;
        };
    }
    
    closePanel() {
        const panel = document.getElementById('event-detection-panel');
        if (panel) panel.remove();
    }
    
    // Cleanup
    dispose() {
        this.closePanel();
        this.stopRealTimeDetection();
        this.events = [];
        this.transients = [];
        this.onsets = [];
        this.beats = [];
        this.silenceRegions = [];
    }
}

// Export singleton instance
const audioEventDetection = new AudioEventDetection();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioEventDetection, audioEventDetection };
}