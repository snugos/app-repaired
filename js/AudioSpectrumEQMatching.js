/**
 * AudioSpectrumEQMatching.js
 * Match EQ from one track to another
 * Analyzes frequency spectrum and applies matching EQ curve
 */

export class AudioSpectrumEQMatching {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Settings
        this.settings = {
            fftSize: options.fftSize ?? 4096,
            smoothing: options.smoothing ?? 0.8,
            matchStrength: options.matchStrength ?? 0.7, // 0-1 how strongly to match
            bands: options.bands ?? 31, // Number of EQ bands
            minFreq: options.minFreq ?? 20,
            maxFreq: options.maxFreq ?? 20000,
            normalize: options.normalize ?? true
        };
        
        // Analyser nodes
        this.sourceAnalyser = null;
        this.targetAnalyser = null;
        
        // Frequency data
        this.sourceSpectrum = null;
        this.targetSpectrum = null;
        this.matchCurve = null;
        
        // EQ nodes
        this.eqBands = [];
        
        // Callbacks
        this.onAnalysisComplete = options.onAnalysisComplete ?? null;
        this.onMatchApplied = options.onMatchApplied ?? null;
    }
    
    /**
     * Initialize the EQ matching system
     */
    async init() {
        // Create source analyser
        this.sourceAnalyser = this.audioContext.createAnalyser();
        this.sourceAnalyser.fftSize = this.settings.fftSize;
        this.sourceAnalyser.smoothingTimeConstant = this.settings.smoothing;
        
        // Create target analyser
        this.targetAnalyser = this.audioContext.createAnalyser();
        this.targetAnalyser.fftSize = this.settings.fftSize;
        this.targetAnalyser.smoothingTimeConstant = this.settings.smoothing;
        
        // Create EQ band filters
        this._createEQBands();
    }
    
    /**
     * Create EQ band filters
     */
    _createEQBands() {
        this.eqBands = [];
        
        // Calculate band frequencies (logarithmic distribution)
        const { bands, minFreq, maxFreq } = this.settings;
        const bandFrequencies = this._calculateBandFrequencies(bands, minFreq, maxFreq);
        
        // Create filters for each band
        bandFrequencies.forEach(freq => {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = Math.sqrt(2); // Standard Q for 1 octave
            filter.gain.value = 0;
            
            this.eqBands.push({
                filter,
                frequency: freq,
                gain: 0,
                targetGain: 0
            });
        });
    }
    
    /**
     * Calculate band frequencies logarithmically
     */
    _calculateBandFands(bands, minFreq, maxFreq) {
        const frequencies = [];
        const logMin = Math.log2(minFreq);
        const logMax = Math.log2(maxFreq);
        const step = (logMax - logMin) / (bands - 1);
        
        for (let i = 0; i < bands; i++) {
            frequencies.push(Math.pow(2, logMin + i * step));
        }
        
        return frequencies;
    }
    
    _calculateBandFrequencies(bands, minFreq, maxFreq) {
        return this._calculateBandFands(bands, minFreq, maxFreq);
    }
    
    /**
     * Analyze source track spectrum
     */
    analyzeSource(duration = 5) {
        return new Promise((resolve) => {
            const bufferLength = this.sourceAnalyser.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);
            const samples = [];
            const sampleCount = Math.ceil(duration / 0.1); // Sample every 100ms
            let samplesCollected = 0;
            
            const collectSample = () => {
                this.sourceAnalyser.getFloatFrequencyData(dataArray);
                samples.push(new Float32Array(dataArray));
                samplesCollected++;
                
                if (samplesCollected < sampleCount) {
                    setTimeout(collectSample, 100);
                } else {
                    // Average the samples
                    this.sourceSpectrum = this._averageSpectra(samples);
                    
                    if (this.onAnalysisComplete) {
                        this.onAnalysisComplete('source', this.sourceSpectrum);
                    }
                    
                    resolve(this.sourceSpectrum);
                }
            };
            
            collectSample();
        });
    }
    
    /**
     * Analyze target track spectrum
     */
    analyzeTarget(duration = 5) {
        return new Promise((resolve) => {
            const bufferLength = this.targetAnalyser.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);
            const samples = [];
            const sampleCount = Math.ceil(duration / 0.1);
            let samplesCollected = 0;
            
            const collectSample = () => {
                this.targetAnalyser.getFloatFrequencyData(dataArray);
                samples.push(new Float32Array(dataArray));
                samplesCollected++;
                
                if (samplesCollected < sampleCount) {
                    setTimeout(collectSample, 100);
                } else {
                    this.targetSpectrum = this._averageSpectra(samples);
                    
                    if (this.onAnalysisComplete) {
                        this.onAnalysisComplete('target', this.targetSpectrum);
                    }
                    
                    resolve(this.targetSpectrum);
                }
            };
            
            collectSample();
        });
    }
    
    /**
     * Average multiple spectrum samples
     */
    _averageSpectra(samples) {
        const length = samples[0].length;
        const average = new Float32Array(length);
        
        for (let i = 0; i < length; i++) {
            let sum = 0;
            samples.forEach(sample => {
                sum += sample[i];
            });
            average[i] = sum / samples.length;
        }
        
        return average;
    }
    
    /**
     * Calculate EQ matching curve
     */
    calculateMatchCurve() {
        if (!this.sourceSpectrum || !this.targetSpectrum) {
            console.warn('Both source and target spectrums must be analyzed first');
            return null;
        }
        
        const { matchStrength, normalize } = this.settings;
        const bufferLength = this.sourceSpectrum.length;
        
        // Calculate difference curve
        const difference = new Float32Array(bufferLength);
        
        for (let i = 0; i < bufferLength; i++) {
            // Target - Source = what we need to add
            let diff = this.targetSpectrum[i] - this.sourceSpectrum[i];
            
            // Apply match strength
            diff *= matchStrength;
            
            difference[i] = diff;
        }
        
        // Normalize if requested
        if (normalize) {
            const maxDiff = Math.max(...difference.map(Math.abs));
            if (maxDiff > 0) {
                for (let i = 0; i < bufferLength; i++) {
                    difference[i] = difference[i] / maxDiff * 12; // Max 12dB adjustment
                }
            }
        }
        
        this.matchCurve = difference;
        
        return this.matchCurve;
    }
    
    /**
     * Apply matching EQ to audio
     */
    applyMatchEQ() {
        if (!this.matchCurve) {
            this.calculateMatchCurve();
        }
        
        if (!this.matchCurve) return;
        
        // Map spectrum difference to EQ bands
        const { fftSize } = this.settings;
        const nyquist = this.audioContext.sampleRate / 2;
        const binSize = nyquist / (fftSize / 2);
        
        this.eqBands.forEach(band => {
            const freq = band.frequency;
            const binIndex = Math.round(freq / binSize);
            
            if (binIndex >= 0 && binIndex < this.matchCurve.length) {
                // Convert dB difference to gain
                const targetGain = this.matchCurve[binIndex];
                
                // Smooth transition to new gain
                band.targetGain = targetGain;
                band.filter.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.1);
            }
        });
        
        if (this.onMatchApplied) {
            this.onMatchApplied(this.matchCurve, this.eqBands);
        }
    }
    
    /**
     * Connect source audio for analysis
     */
    connectSource(sourceNode) {
        sourceNode.connect(this.sourceAnalyser);
    }
    
    /**
     * Connect target audio for analysis
     */
    connectTarget(targetNode) {
        targetNode.connect(this.targetAnalyser);
    }
    
    /**
     * Connect audio through EQ chain
     */
    connectThroughEQ(sourceNode, destinationNode) {
        let lastNode = sourceNode;
        
        this.eqBands.forEach(band => {
            lastNode.connect(band.filter);
            lastNode = band.filter;
        });
        
        lastNode.connect(destinationNode);
    }
    
    /**
     * Get current EQ settings
     */
    getEQSettings() {
        return this.eqBands.map(band => ({
            frequency: band.frequency,
            gain: band.gain,
            targetGain: band.targetGain,
            Q: band.filter.Q.value
        }));
    }
    
    /**
     * Set match strength
     */
    setMatchStrength(strength) {
        this.settings.matchStrength = Math.max(0, Math.min(1, strength));
    }
    
    /**
     * Reset EQ to flat
     */
    resetEQ() {
        this.eqBands.forEach(band => {
            band.filter.gain.setValueAtTime(0, this.audioContext.currentTime);
            band.gain = 0;
            band.targetGain = 0;
        });
    }
    
    /**
     * Get spectrum visualization data
     */
    getVisualizationData() {
        return {
            source: this.sourceSpectrum ? new Float32Array(this.sourceSpectrum) : null,
            target: this.targetSpectrum ? new Float32Array(this.targetSpectrum) : null,
            match: this.matchCurve ? new Float32Array(this.matchCurve) : null,
            bands: this.eqBands.map(b => ({ freq: b.frequency, gain: b.targetGain }))
        };
    }
    
    /**
     * Create visualization canvas
     */
    createVisualization(containerId, width = 600, height = 200) {
        const container = document.getElementById(containerId) || document.body;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'spectrum-matching-viz';
        wrapper.style.cssText = `
            background: #1a1a2e;
            border-radius: 8px;
            padding: 12px;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.cssText = 'width: 100%; border-radius: 4px;';
        
        const ctx = canvas.getContext('2d');
        
        // Legend
        const legend = document.createElement('div');
        legend.style.cssText = `
            display: flex;
            gap: 16px;
            margin-top: 8px;
            font-size: 11px;
        `;
        legend.innerHTML = `
            <span style="color: #ef4444;">■ Source</span>
            <span style="color: #10b981;">■ Target</span>
            <span style="color: #3b82f6;">■ EQ Curve</span>
        `;
        
        wrapper.appendChild(canvas);
        wrapper.appendChild(legend);
        container.appendChild(wrapper);
        
        // Draw function
        const draw = () => {
            ctx.fillStyle = '#0a0a14';
            ctx.fillRect(0, 0, width, height);
            
            const data = this.getVisualizationData();
            
            // Draw spectrums
            if (data.source) {
                this._drawSpectrum(ctx, data.source, '#ef4444', width, height);
            }
            
            if (data.target) {
                this._drawSpectrum(ctx, data.target, '#10b981', width, height);
            }
            
            // Draw EQ curve
            if (data.match) {
                this._drawEQCurve(ctx, data.match, width, height);
            }
            
            // Draw band markers
            this._drawBandMarkers(ctx, data.bands, width, height);
            
            // Frequency labels
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            const freqs = [20, 100, 500, 1000, 5000, 10000, 20000];
            freqs.forEach(freq => {
                const x = this._freqToX(freq, width);
                ctx.fillText(freq >= 1000 ? `${freq/1000}k` : freq, x, height - 5);
            });
            
            requestAnimationFrame(draw);
        };
        
        draw();
        
        return wrapper;
    }
    
    _drawSpectrum(ctx, data, color, width, height) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        
        const step = width / data.length;
        
        for (let i = 0; i < data.length; i++) {
            const x = i * step;
            const y = height - ((data[i] + 100) / 100) * height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    
    _drawEQCurve(ctx, data, width, height) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const step = width / data.length;
        
        for (let i = 0; i < data.length; i++) {
            const x = i * step;
            const y = height / 2 - (data[i] / 12) * (height / 2);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Center line
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
    }
    
    _drawBandMarkers(ctx, bands, width, height) {
        ctx.fillStyle = '#3b82f6';
        ctx.globalAlpha = 0.5;
        
        bands.forEach(band => {
            const x = this._freqToX(band.freq, width);
            const barHeight = (band.gain / 12) * (height / 2);
            
            ctx.fillRect(x - 2, height / 2, 4, -barHeight);
        });
        
        ctx.globalAlpha = 1;
    }
    
    _freqToX(freq, width) {
        const { minFreq, maxFreq } = this.settings;
        const logMin = Math.log2(minFreq);
        const logMax = Math.log2(maxFreq);
        const logFreq = Math.log2(Math.max(minFreq, Math.min(maxFreq, freq)));
        
        return (logFreq - logMin) / (logMax - logMin) * width;
    }
    
    /**
     * Create match panel UI
     */
    static createMatchPanel(audioContext, onMatch) {
        const container = document.createElement('div');
        container.className = 'eq-matching-panel';
        container.style.cssText = `
            padding: 16px;
            background: #1a1a2e;
            border-radius: 8px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        // Title
        const title = document.createElement('h3');
        title.textContent = 'Spectrum EQ Matching';
        title.style.cssText = 'margin: 0 0 12px 0; font-size: 16px;';
        container.appendChild(title);
        
        // Match strength slider
        const strengthGroup = document.createElement('div');
        strengthGroup.style.cssText = 'margin-bottom: 12px;';
        strengthGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Match Strength:</label>
            <input type="range" id="match-strength" min="0" max="100" value="70"
                style="width: 100%; accent-color: #3b82f6;">
            <span id="strength-value" style="font-size: 11px; color: #888;">70%</span>
        `;
        container.appendChild(strengthGroup);
        
        // Analysis duration
        const durationGroup = document.createElement('div');
        durationGroup.style.cssText = 'margin-bottom: 12px;';
        durationGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Analysis Duration (s):</label>
            <input type="number" id="analysis-duration" value="5" min="1" max="30"
                style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
        `;
        container.appendChild(durationGroup);
        
        // Buttons
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';
        
        const analyzeBtn = document.createElement('button');
        analyzeBtn.textContent = 'Analyze & Match';
        analyzeBtn.style.cssText = `
            flex: 1;
            padding: 12px;
            background: #3b82f6;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-weight: 600;
        `;
        
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset EQ';
        resetBtn.style.cssText = `
            flex: 1;
            padding: 12px;
            background: #2a2a4e;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        
        buttons.appendChild(analyzeBtn);
        buttons.appendChild(resetBtn);
        container.appendChild(buttons);
        
        // Visualization area
        const vizArea = document.createElement('div');
        vizArea.id = 'eq-viz-area';
        vizArea.style.cssText = 'min-height: 150px;';
        container.appendChild(vizArea);
        
        // Create matcher instance
        const matcher = new AudioSpectrumEQMatching(audioContext);
        matcher.init().then(() => {
            matcher.createVisualization(vizArea);
        });
        
        // Event handlers
        const strengthInput = container.querySelector('#match-strength');
        const strengthValue = container.querySelector('#strength-value');
        
        strengthInput.oninput = () => {
            strengthValue.textContent = `${strengthInput.value}%`;
            matcher.setMatchStrength(parseInt(strengthInput.value) / 100);
        };
        
        analyzeBtn.onclick = async () => {
            analyzeBtn.disabled = true;
            analyzeBtn.textContent = 'Analyzing...';
            
            const duration = parseFloat(document.getElementById('analysis-duration').value);
            
            // This would connect to actual audio sources in real implementation
            await matcher.analyzeSource(duration);
            await matcher.analyzeTarget(duration);
            matcher.applyMatchEQ();
            
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze & Match';
            
            if (onMatch) {
                onMatch(matcher.getEQSettings());
            }
        };
        
        resetBtn.onclick = () => {
            matcher.resetEQ();
        };
        
        return { container, matcher };
    }
    
    /**
     * Serialize settings
     */
    serialize() {
        return {
            settings: { ...this.settings },
            eqSettings: this.getEQSettings()
        };
    }
    
    /**
     * Restore settings
     */
    restore(data) {
        Object.assign(this.settings, data.settings || {});
        
        if (data.eqSettings) {
            data.eqSettings.forEach((band, i) => {
                if (this.eqBands[i]) {
                    this.eqBands[i].filter.gain.setValueAtTime(band.gain, this.audioContext.currentTime);
                }
            });
        }
    }
    
    destroy() {
        this.eqBands.forEach(band => {
            band.filter.disconnect();
        });
        this.eqBands = [];
        
        if (this.sourceAnalyser) {
            this.sourceAnalyser.disconnect();
        }
        if (this.targetAnalyser) {
            this.targetAnalyser.disconnect();
        }
    }
}

export default AudioSpectrumEQMatching;