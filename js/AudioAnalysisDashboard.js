/**
 * Audio Analysis Dashboard - Comprehensive analysis panel
 * Provides detailed audio analysis tools and visualizations
 */

class AudioAnalysisDashboard {
    constructor(audioContext, options = {}) {
        this.name = 'AudioAnalysisDashboard';
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            fftSize: options.fftSize || 4096,
            smoothing: options.smoothing || 0.8,
            updateRate: options.updateRate || 60, // fps
            ...options
        };
        
        // Analysis nodes
        this.analyser = null;
        this.analyserNode = null;
        this.inputNode = null;
        this.outputNode = null;
        
        // Data buffers
        this.frequencyData = null;
        this.timeDomainData = null;
        this.spectrogramHistory = [];
        
        // Analysis results
        this.analysis = {
            // Level
            peakLevel: 0,
            rmsLevel: 0,
            loudnessLUFS: 0,
            headroom: 0,
            
            // Spectrum
            fundamentalFrequency: 0,
            spectralCentroid: 0,
            spectralSpread: 0,
            spectralFlatness: 0,
            spectralRolloff: 0,
            spectralFlux: 0,
            spectralCrest: 0,
            spectralKurtosis: 0,
            
            // Dynamics
            dynamicRange: 0,
            crestFactor: 0,
            
            // Stereo
            stereoWidth: 1,
            correlation: 1,
            balance: 0,
            
            // Tempo
            bpm: 0,
            bpmConfidence: 0,
            
            // Key
            key: 'Unknown',
            keyConfidence: 0,
            scale: 'Major'
        };
        
        // UI
        this.canvas = null;
        this.ctx = null;
        this.container = null;
        this.isRunning = false;
        this.animationId = null;
        
        // Callbacks
        this.onAnalysis = null;
    }
    
    connect(sourceNode) {
        this.inputNode = sourceNode;
        
        // Create analyser
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = this.config.fftSize;
        this.analyserNode.smoothingTimeConstant = this.config.smoothing;
        
        // Connect
        sourceNode.connect(this.analyserNode);
        this.analyserNode.connect(this.audioContext.destination);
        this.outputNode = this.analyserNode;
        
        // Initialize buffers
        this.frequencyData = new Float32Array(this.analyserNode.frequencyBinCount);
        this.timeDomainData = new Float32Array(this.analyserNode.fftSize);
        
        return this.outputNode;
    }
    
    disconnect() {
        this.stop();
        if (this.analyserNode) {
            this.analyserNode.disconnect();
        }
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.update();
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    update() {
        if (!this.isRunning) return;
        
        this.analyze();
        this.updateDisplay();
        
        if (this.onAnalysis) {
            this.onAnalysis(this.analysis);
        }
        
        this.animationId = requestAnimationFrame(() => this.update());
    }
    
    analyze() {
        if (!this.analyserNode) return;
        
        // Get data
        this.analyserNode.getFloatTimeDomainData(this.timeDomainData);
        this.analyserNode.getFloatFrequencyData(this.frequencyData);
        
        // Convert to linear scale
        for (let i = 0; i < this.frequencyData.length; i++) {
            this.frequencyData[i] = Math.pow(10, this.frequencyData[i] / 10);
        }
        
        // Run all analyses
        this.analyzeLevels();
        this.analyzeSpectrum();
        this.analyzeDynamics();
        this.analyzeTempo();
        this.analyzeKey();
        
        // Update spectrogram
        this.updateSpectrogram();
    }
    
    analyzeLevels() {
        const data = this.timeDomainData;
        
        // Peak level
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
            peak = Math.max(peak, Math.abs(data[i]));
        }
        this.analysis.peakLevel = peak;
        
        // RMS level
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
            sumSquares += data[i] * data[i];
        }
        this.analysis.rmsLevel = Math.sqrt(sumSquares / data.length);
        
        // Convert to dB
        const peakDb = 20 * Math.log10(Math.max(peak, 1e-10));
        const rmsDb = 20 * Math.log10(Math.max(this.analysis.rmsLevel, 1e-10));
        
        // Headroom
        this.analysis.headroom = 0 - peakDb; // dBFS
        
        // Loudness (simplified LUFS estimate)
        // Real LUFS requires K-weighting and integration
        this.analysis.loudnessLUFS = rmsDb - 3; // Rough approximation
        
        // Crest factor
        this.analysis.crestFactor = peak / Math.max(this.analysis.rmsLevel, 1e-10);
    }
    
    analyzeSpectrum() {
        const data = this.frequencyData;
        const sampleRate = this.audioContext.sampleRate;
        const binSize = sampleRate / this.config.fftSize;
        
        // Spectral centroid (brightness)
        let weightedSum = 0;
        let totalEnergy = 0;
        for (let i = 0; i < data.length; i++) {
            const freq = i * binSize;
            weightedSum += freq * data[i];
            totalEnergy += data[i];
        }
        this.analysis.spectralCentroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;
        
        // Spectral spread
        let spreadSum = 0;
        for (let i = 0; i < data.length; i++) {
            const freq = i * binSize;
            spreadSum += data[i] * Math.pow(freq - this.analysis.spectralCentroid, 2);
        }
        this.analysis.spectralSpread = totalEnergy > 0 ? Math.sqrt(spreadSum / totalEnergy) : 0;
        
        // Spectral flatness (noisiness)
        let logSum = 0;
        let linearSum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i++) {
            if (data[i] > 1e-10) {
                logSum += Math.log(data[i]);
                linearSum += data[i];
                count++;
            }
        }
        if (count > 0 && linearSum > 0) {
            const geometricMean = Math.exp(logSum / count);
            const arithmeticMean = linearSum / count;
            this.analysis.spectralFlatness = geometricMean / arithmeticMean;
        } else {
            this.analysis.spectralFlatness = 0;
        }
        
        // Spectral rolloff (85% energy)
        let energySum = 0;
        const threshold = 0.85 * totalEnergy;
        let rolloffIndex = data.length - 1;
        for (let i = 0; i < data.length; i++) {
            energySum += data[i];
            if (energySum >= threshold) {
                rolloffIndex = i;
                break;
            }
        }
        this.analysis.spectralRolloff = rolloffIndex * binSize;
        
        // Spectral crest
        const maxEnergy = Math.max(...data);
        const avgEnergy = totalEnergy / data.length;
        this.analysis.spectralCrest = avgEnergy > 0 ? maxEnergy / avgEnergy : 0;
        
        // Fundamental frequency (autocorrelation)
        this.analysis.fundamentalFrequency = this.detectFundamental();
    }
    
    detectFundamental() {
        const data = this.timeDomainData;
        const sampleRate = this.audioContext.sampleRate;
        
        // Autocorrelation
        const minLag = Math.round(sampleRate / 2000); // Max 2kHz
        const maxLag = Math.round(sampleRate / 50); // Min 50Hz
        
        let maxCorr = 0;
        let bestLag = 0;
        
        for (let lag = minLag; lag < maxLag; lag++) {
            let corr = 0;
            for (let i = 0; i < data.length - lag; i++) {
                corr += data[i] * data[i + lag];
            }
            corr /= data.length - lag;
            
            if (corr > maxCorr) {
                maxCorr = corr;
                bestLag = lag;
            }
        }
        
        if (bestLag > 0 && maxCorr > 0.1) {
            return sampleRate / bestLag;
        }
        return 0;
    }
    
    analyzeDynamics() {
        // Dynamic range estimation
        // This would require longer-term analysis
        // Simplified version
        const data = this.timeDomainData;
        
        let min = 1;
        let max = 0;
        
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > 1e-6) {
                min = Math.min(min, abs);
                max = Math.max(max, abs);
            }
        }
        
        this.analysis.dynamicRange = 20 * Math.log10(max / Math.max(min, 1e-10));
    }
    
    analyzeTempo() {
        // BPM detection using spectral flux onset detection
        // This is a simplified version
        // Real BPM detection requires longer analysis
        
        const sampleRate = this.audioContext.sampleRate;
        const historyLength = this.spectrogramHistory.length;
        
        if (historyLength < 10) {
            this.analysis.bpm = 0;
            this.analysis.bpmConfidence = 0;
            return;
        }
        
        // Calculate spectral flux
        const flux = [];
        for (let i = 1; i < historyLength; i++) {
            const prev = this.spectrogramHistory[i - 1];
            const curr = this.spectrogramHistory[i];
            
            let diff = 0;
            for (let j = 0; j < prev.length; j++) {
                diff += Math.max(0, curr[j] - prev[j]);
            }
            flux.push(diff);
        }
        
        // Find peaks in flux (onsets)
        const peaks = [];
        for (let i = 1; i < flux.length - 1; i++) {
            if (flux[i] > flux[i - 1] && flux[i] > flux[i + 1] && flux[i] > 0.01) {
                peaks.push(i);
            }
        }
        
        // Calculate average interval between peaks
        if (peaks.length >= 2) {
            const intervals = [];
            for (let i = 1; i < peaks.length; i++) {
                intervals.push(peaks[i] - peaks[i - 1]);
            }
            
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const frameTime = 1 / this.config.updateRate;
            
            // BPM = 60 / (interval * frameTime)
            this.analysis.bpm = 60 / (avgInterval * frameTime);
            this.analysis.bpmConfidence = Math.min(1, peaks.length / 10);
        }
    }
    
    analyzeKey() {
        // Key detection using chroma analysis
        // Simplified version - real key detection is more complex
        
        const data = this.frequencyData;
        const sampleRate = this.audioContext.sampleRate;
        const binSize = sampleRate / this.config.fftSize;
        
        // Chroma vector (12 semitones)
        const chroma = new Array(12).fill(0);
        
        // Map frequency bins to chroma
        const a4 = 440;
        for (let i = 0; i < data.length; i++) {
            const freq = i * binSize;
            if (freq < 20 || freq > 5000) continue;
            
            // Calculate semitone from A4
            const semitone = 12 * Math.log2(freq / a4);
            const chromaIndex = Math.round(semitone) % 12;
            const normalizedIndex = ((chromaIndex % 12) + 12) % 12;
            
            chroma[normalizedIndex] += data[i];
        }
        
        // Key profiles (Krumhansl-Schmuckler)
        const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
        const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Correlate with profiles
        let bestCorr = -1;
        let bestKey = 'C';
        let bestScale = 'Major';
        
        for (let shift = 0; shift < 12; shift++) {
            // Major correlation
            let majorCorr = 0;
            let minorCorr = 0;
            
            for (let i = 0; i < 12; i++) {
                const index = (i + shift) % 12;
                majorCorr += chroma[index] * majorProfile[i];
                minorCorr += chroma[index] * minorProfile[i];
            }
            
            if (majorCorr > bestCorr) {
                bestCorr = majorCorr;
                bestKey = noteNames[shift];
                bestScale = 'Major';
            }
            
            if (minorCorr > bestCorr) {
                bestCorr = minorCorr;
                bestKey = noteNames[shift];
                bestScale = 'Minor';
            }
        }
        
        this.analysis.key = bestKey;
        this.analysis.scale = bestScale;
        this.analysis.keyConfidence = Math.min(1, bestCorr / 10);
    }
    
    updateSpectrogram() {
        // Add current spectrum to history
        this.spectrogramHistory.push(new Float32Array(this.frequencyData));
        
        // Limit history length
        const maxHistory = 200;
        if (this.spectrogramHistory.length > maxHistory) {
            this.spectrogramHistory.shift();
        }
    }
    
    // UI
    createUI(container) {
        this.container = container;
        
        container.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 8px;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #fff;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 14px;">Audio Analysis Dashboard</h3>
                    <div>
                        <button id="analysis-start-btn" style="padding: 8px 16px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">Start</button>
                        <button id="analysis-stop-btn" style="padding: 8px 16px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">Stop</button>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
                    <!-- Visualizations -->
                    <div>
                        <!-- Spectrum -->
                        <div style="background: #2a2a4e; border-radius: 4px; padding: 12px; margin-bottom: 12px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">SPECTRUM</h4>
                            <canvas id="spectrum-canvas" width="400" height="100" style="width: 100%; border-radius: 4px;"></canvas>
                        </div>
                        
                        <!-- Spectrogram -->
                        <div style="background: #2a2a4e; border-radius: 4px; padding: 12px; margin-bottom: 12px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">SPECTROGRAM</h4>
                            <canvas id="spectrogram-canvas" width="400" height="100" style="width: 100%; border-radius: 4px;"></canvas>
                        </div>
                        
                        <!-- Waveform -->
                        <div style="background: #2a2a4e; border-radius: 4px; padding: 12px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">WAVEFORM</h4>
                            <canvas id="waveform-canvas" width="400" height="80" style="width: 100%; border-radius: 4px;"></canvas>
                        </div>
                    </div>
                    
                    <!-- Metrics -->
                    <div>
                        <!-- Level Meters -->
                        <div style="background: #2a2a4e; border-radius: 4px; padding: 12px; margin-bottom: 12px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">LEVELS</h4>
                            <div style="display: flex; gap: 16px;">
                                <div style="flex: 1;">
                                    <div style="font-size: 10px; color: #888; margin-bottom: 4px;">Peak</div>
                                    <div id="peak-meter" style="height: 20px; background: #1a1a2e; border-radius: 2px; overflow: hidden;">
                                        <div id="peak-bar" style="height: 100%; width: 0%; background: #ef4444; transition: width 0.05s;"></div>
                                    </div>
                                    <div id="peak-value" style="font-size: 10px; color: #888; text-align: right;">0 dBFS</div>
                                </div>
                                <div style="flex: 1;">
                                    <div style="font-size: 10px; color: #888; margin-bottom: 4px;">RMS</div>
                                    <div id="rms-meter" style="height: 20px; background: #1a1a2e; border-radius: 2px; overflow: hidden;">
                                        <div id="rms-bar" style="height: 100%; width: 0%; background: #10b981; transition: width 0.1s;"></div>
                                    </div>
                                    <div id="rms-value" style="font-size: 10px; color: #888; text-align: right;">0 dBFS</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Spectrum Metrics -->
                        <div style="background: #2a2a4e; border-radius: 4px; padding: 12px; margin-bottom: 12px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">SPECTRUM</h4>
                            <div id="spectrum-metrics" style="font-size: 11px; color: #888;"></div>
                        </div>
                        
                        <!-- Musical Analysis -->
                        <div style="background: #2a2a4e; border-radius: 4px; padding: 12px; margin-bottom: 12px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">MUSICAL</h4>
                            <div id="musical-metrics" style="font-size: 11px; color: #888;"></div>
                        </div>
                        
                        <!-- Dynamics -->
                        <div style="background: #2a2a4e; border-radius: 4px; padding: 12px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">DYNAMICS</h4>
                            <div id="dynamics-metrics" style="font-size: 11px; color: #888;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.spectrumCanvas = container.querySelector('#spectrum-canvas');
        this.spectrogramCanvas = container.querySelector('#spectrogram-canvas');
        this.waveformCanvas = container.querySelector('#waveform-canvas');
        
        this.spectrumCtx = this.spectrumCanvas.getContext('2d');
        this.spectrogramCtx = this.spectrogramCanvas.getContext('2d');
        this.waveformCtx = this.waveformCanvas.getContext('2d');
        
        this.setupEventHandlers(container);
    }
    
    setupEventHandlers(container) {
        container.querySelector('#analysis-start-btn').onclick = () => this.start();
        container.querySelector('#analysis-stop-btn').onclick = () => this.stop();
    }
    
    updateDisplay() {
        this.drawSpectrum();
        this.drawSpectrogram();
        this.drawWaveform();
        this.updateMeters();
        this.updateMetrics();
    }
    
    drawSpectrum() {
        const canvas = this.spectrumCanvas;
        const ctx = this.spectrumCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        if (!this.frequencyData) return;
        
        const barWidth = width / this.frequencyData.length;
        
        for (let i = 0; i < this.frequencyData.length; i++) {
            const value = this.frequencyData[i];
            const barHeight = value * height * 2;
            
            // Color based on frequency
            const hue = (i / this.frequencyData.length) * 300;
            ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
            
            ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
    }
    
    drawSpectrogram() {
        const canvas = this.spectrogramCanvas;
        const ctx = this.spectrogramCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Scroll spectrogram
        ctx.drawImage(canvas, -1, 0);
        
        if (this.spectrogramHistory.length === 0) return;
        
        const latest = this.spectrogramHistory[this.spectrogramHistory.length - 1];
        const columnWidth = 1;
        const binHeight = height / latest.length;
        
        // Draw new column
        for (let i = 0; i < latest.length; i++) {
            const value = latest[i];
            const intensity = Math.min(1, value * 10);
            
            // Color
            const hue = 240 - intensity * 240; // Blue to red
            ctx.fillStyle = `hsl(${hue}, 80%, ${intensity * 50}%)`;
            
            ctx.fillRect(width - columnWidth, height - (i + 1) * binHeight, columnWidth, binHeight);
        }
    }
    
    drawWaveform() {
        const canvas = this.waveformCanvas;
        const ctx = this.waveformCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        if (!this.timeDomainData) return;
        
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const sliceWidth = width / this.timeDomainData.length;
        const centerY = height / 2;
        
        for (let i = 0; i < this.timeDomainData.length; i++) {
            const x = i * sliceWidth;
            const y = centerY + this.timeDomainData[i] * centerY;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
    }
    
    updateMeters() {
        const peakDb = 20 * Math.log10(Math.max(this.analysis.peakLevel, 1e-10));
        const rmsDb = 20 * Math.log10(Math.max(this.analysis.rmsLevel, 1e-10));
        
        // Map -60 to 0 dBFS to 0-100%
        const peakPercent = Math.max(0, Math.min(100, (peakDb + 60) / 60 * 100));
        const rmsPercent = Math.max(0, Math.min(100, (rmsDb + 60) / 60 * 100));
        
        document.getElementById('peak-bar').style.width = `${peakPercent}%`;
        document.getElementById('rms-bar').style.width = `${rmsPercent}%`;
        
        document.getElementById('peak-value').textContent = `${peakDb.toFixed(1)} dBFS`;
        document.getElementById('rms-value').textContent = `${rmsDb.toFixed(1)} dBFS`;
        
        // Color warning
        if (peakPercent > 95) {
            document.getElementById('peak-bar').style.background = '#ef4444';
        } else if (peakPercent > 85) {
            document.getElementById('peak-bar').style.background = '#f59e0b';
        } else {
            document.getElementById('peak-bar').style.background = '#10b981';
        }
    }
    
    updateMetrics() {
        // Spectrum metrics
        document.getElementById('spectrum-metrics').innerHTML = `
            <div>Fundamental: <span style="color: #fff;">${this.analysis.fundamentalFrequency > 0 ? `${this.analysis.fundamentalFrequency.toFixed(1)} Hz` : 'N/A'}</span></div>
            <div>Centroid: <span style="color: #fff;">${this.analysis.spectralCentroid.toFixed(0)} Hz</span></div>
            <div>Spread: <span style="color: #fff;">${this.analysis.spectralSpread.toFixed(0)} Hz</span></div>
            <div>Flatness: <span style="color: #fff;">${this.analysis.spectralFlatness.toFixed(3)}</span></div>
            <div>Rolloff: <span style="color: #fff;">${this.analysis.spectralRolloff.toFixed(0)} Hz</span></div>
        `;
        
        // Musical metrics
        document.getElementById('musical-metrics').innerHTML = `
            <div>Key: <span style="color: #fff;">${this.analysis.key} ${this.analysis.scale}</span></div>
            <div>Confidence: <span style="color: #fff;">${(this.analysis.keyConfidence * 100).toFixed(0)}%</span></div>
            <div>BPM: <span style="color: #fff;">${this.analysis.bpm > 0 ? this.analysis.bpm.toFixed(1) : 'N/A'}</span></div>
        `;
        
        // Dynamics metrics
        document.getElementById('dynamics-metrics').innerHTML = `
            <div>Dynamic Range: <span style="color: #fff;">${this.analysis.dynamicRange.toFixed(1)} dB</span></div>
            <div>Crest Factor: <span style="color: #fff;">${this.analysis.crestFactor.toFixed(2)}</span></div>
            <div>Headroom: <span style="color: #fff;">${this.analysis.headroom.toFixed(1)} dB</span></div>
        `;
    }
    
    openPanel() {
        const existing = document.getElementById('audio-analysis-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'audio-analysis-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
        `;
        
        document.body.appendChild(panel);
        this.createUI(panel);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 6px 12px;
            background: #ef4444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        closeBtn.onclick = () => {
            this.stop();
            panel.remove();
        };
        panel.appendChild(closeBtn);
    }
    
    getAnalysis() {
        return { ...this.analysis };
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioAnalysisDashboard };
} else if (typeof window !== 'undefined') {
    window.AudioAnalysisDashboard = AudioAnalysisDashboard;
}