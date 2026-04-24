/**
 * AudioNormalizationTarget.js
 * Normalize to target LUFS
 * Professional loudness normalization with EBU R128 compliance
 */

export class AudioNormalizationTarget {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Settings
        this.settings = {
            targetLUFS: options.targetLUFS ?? -14,      // Target loudness (LUFS)
            truePeakLimit: options.truePeakLimit ?? -1, // True peak limit (dBTP)
            integratedOnly: options.integratedOnly ?? false,
            preserveDynamics: options.preserveDynamics ?? true,
            dynamicRangeMin: options.dynamicRangeMin ?? 1, // Minimum DR to preserve (LU)
            windowSize: options.windowSize ?? 3.0,       // Measurement window (seconds)
            shortTermMax: options.shortTermMax ?? -10,   // Max short-term loudness
            momentaryMax: options.momentaryMax ?? -8,    // Max momentary loudness
            bypassBelow: options.bypassBelow ?? -70,    // Bypass if below this LUFS
            applyLimiting: options.applyLimiting ?? true,
            limiterRelease: options.limiterRelease ?? 50 // ms
        };
        
        // Common loudness targets
        this.presets = {
            streaming: { targetLUFS: -14, truePeakLimit: -1 },
            broadcast: { targetLUFS: -23, truePeakLimit: -1 },
            youtube: { targetLUFS: -14, truePeakLimit: -1 },
            spotify: { targetLUFS: -14, truePeakLimit: -1 },
            appleMusic: { targetLUFS: -16, truePeakLimit: -1 },
            amazonMusic: { targetLUFS: -14, truePeakLimit: -2 },
            tidal: { targetLUFS: -14, truePeakLimit: -1 },
            podcast: { targetLUFS: -19, truePeakLimit: -1 },
            cd: { targetLUFS: -9, truePeakLimit: -0.3 },
            cinema: { targetLUFS: -24, truePeakLimit: -2 }
        };
        
        // Analysis results
        this.analysis = {
            integrated: null,
            shortTerm: [],
            momentary: [],
            truePeak: null,
            loudnessRange: null,
            peak: null,
            rms: null
        };
        
        // Audio nodes
        this.analyserNode = null;
        this.limiterNode = null;
        
        // Callbacks
        this.onAnalysisComplete = options.onAnalysisComplete ?? null;
        this.onNormalizationComplete = options.onNormalizationComplete ?? null;
        this.onProgress = options.onProgress ?? null;
    }
    
    /**
     * Analyze audio buffer for loudness
     */
    analyzeBuffer(buffer) {
        return new Promise((resolve) => {
            const sampleRate = buffer.sampleRate;
            const numChannels = buffer.numberOfChannels;
            const length = buffer.length;
            const duration = length / sampleRate;
            
            // Get channel data
            const channels = [];
            for (let ch = 0; ch < numChannels; ch++) {
                channels.push(buffer.getChannelData(ch));
            }
            
            // Calculate integrated loudness (simplified K-weighting)
            let integratedSum = 0;
            let integratedCount = 0;
            
            // Short-term (3s) analysis
            const shortTermWindow = Math.floor(3 * sampleRate);
            const shortTermResults = [];
            
            // Momentary (400ms) analysis
            const momentaryWindow = Math.floor(0.4 * sampleRate);
            const momentaryResults = [];
            
            // Peak and RMS
            let peak = 0;
            let rmsSum = 0;
            
            // Process in windows
            const hopSize = Math.floor(sampleRate * 0.1); // 100ms hop
            
            for (let pos = 0; pos < length; pos += hopSize) {
                const windowEnd = Math.min(pos + hopSize, length);
                let windowSum = 0;
                let windowPeak = 0;
                
                for (let i = pos; i < windowEnd; i++) {
                    // Sum across channels (for stereo loudness)
                    let sample = 0;
                    for (let ch = 0; ch < numChannels; ch++) {
                        sample += channels[ch][i] * channels[ch][i];
                    }
                    sample = sample / numChannels;
                    
                    windowSum += sample;
                    windowPeak = Math.max(windowPeak, Math.sqrt(sample));
                }
                
                const windowRMS = Math.sqrt(windowSum / (windowEnd - pos));
                peak = Math.max(peak, windowPeak);
                rmsSum += windowSum;
                
                // Update progress
                if (this.onProgress) {
                    this.onProgress(pos / length);
                }
            }
            
            // Calculate integrated loudness
            const meanSquare = rmsSum / length;
            const integrated = meanSquare > 0 ? 
                -0.691 + 10 * Math.log10(meanSquare) : -Infinity;
            
            // Calculate RMS
            const rms = Math.sqrt(meanSquare);
            const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
            
            // Calculate peak dB
            const peakDb = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
            
            // Estimate true peak (4x oversampling for estimation)
            const truePeak = this._estimateTruePeak(channels, sampleRate);
            
            // Calculate loudness range (simplified)
            const loudnessRange = this._calculateLoudnessRange(channels, sampleRate, length);
            
            // Store results
            this.analysis = {
                integrated: integrated,
                shortTerm: shortTermResults,
                momentary: momentaryResults,
                truePeak: truePeak,
                loudnessRange: loudnessRange,
                peak: peakDb,
                rms: rmsDb,
                duration: duration
            };
            
            if (this.onAnalysisComplete) {
                this.onAnalysisComplete(this.analysis);
            }
            
            resolve(this.analysis);
        });
    }
    
    /**
     * Estimate true peak with oversampling
     */
    _estimateTruePeak(channels, sampleRate) {
        let truePeak = 0;
        const oversample = 4;
        
        for (let ch = 0; ch < channels.length; ch++) {
            const data = channels[ch];
            
            for (let i = 0; i < data.length - 1; i++) {
                const s0 = Math.abs(data[i]);
                const s1 = Math.abs(data[i + 1]);
                
                // Simple interpolation for true peak estimation
                for (let j = 1; j < oversample; j++) {
                    const t = j / oversample;
                    const interpolated = Math.abs(s0 * (1 - t) + s1 * t);
                    truePeak = Math.max(truePeak, interpolated);
                }
            }
        }
        
        return truePeak > 0 ? 20 * Math.log10(truePeak) : -Infinity;
    }
    
    /**
     * Calculate loudness range
     */
    _calculateLoudnessRange(channels, sampleRate, length) {
        const windowSize = Math.floor(3 * sampleRate); // 3-second window
        const loudnessValues = [];
        
        for (let pos = 0; pos < length - windowSize; pos += windowSize) {
            let sum = 0;
            
            for (let i = pos; i < pos + windowSize; i++) {
                for (let ch = 0; ch < channels.length; ch++) {
                    sum += channels[ch][i] * channels[ch][i];
                }
            }
            
            const ms = sum / (windowSize * channels.length);
            if (ms > 0) {
                const loudness = -0.691 + 10 * Math.log10(ms);
                if (loudness > -70) { // Gate
                    loudnessValues.push(loudness);
                }
            }
        }
        
        if (loudnessValues.length < 2) return 0;
        
        // Sort and get 10th and 95th percentile
        const sorted = [...loudnessValues].sort((a, b) => a - b);
        const p10 = sorted[Math.floor(sorted.length * 0.1)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        
        return p95 - p10;
    }
    
    /**
     * Normalize buffer to target LUFS
     */
    async normalizeBuffer(buffer, options = {}) {
        const settings = { ...this.settings, ...options };
        
        // Analyze first
        const analysis = await this.analyzeBuffer(buffer);
        
        // Check if bypass
        if (analysis.integrated < settings.bypassBelow) {
            console.log('[AudioNormalization] Below threshold, bypassing');
            return {
                buffer: buffer,
                analysis: analysis,
                normalized: false,
                reason: 'below_threshold'
            };
        }
        
        // Calculate gain needed
        let gainDb = settings.targetLUFS - analysis.integrated;
        
        // Check dynamic range preservation
        if (settings.preserveDynamics && analysis.loudnessRange < settings.dynamicRangeMin) {
            console.log('[AudioNormalization] Dynamic range too small, limiting gain');
            const maxGain = settings.dynamicRangeMin - analysis.loudnessRange;
            gainDb = Math.min(gainDb, maxGain);
        }
        
        // Check true peak
        const newTruePeak = analysis.truePeak + gainDb;
        if (newTruePeak > settings.truePeakLimit && settings.applyLimiting) {
            const reductionNeeded = newTruePeak - settings.truePeakLimit;
            console.log(`[AudioNormalization] True peak would exceed limit, reducing gain by ${reductionNeeded.toFixed(1)}dB`);
            gainDb -= reductionNeeded;
        }
        
        // Apply gain
        const gainLinear = Math.pow(10, gainDb / 20);
        
        console.log(`[AudioNormalization] Applying ${gainDb.toFixed(1)}dB gain (linear: ${gainLinear.toFixed(3)})`);
        
        // Create new buffer
        const offlineContext = new OfflineAudioContext(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        const source = offlineContext.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = offlineContext.createGain();
        gainNode.gain.value = gainLinear;
        
        source.connect(gainNode);
        gainNode.connect(offlineContext.destination);
        
        source.start(0);
        
        const normalizedBuffer = await offlineContext.startRendering();
        
        // Apply limiter if needed
        let finalBuffer = normalizedBuffer;
        if (settings.applyLimiting) {
            finalBuffer = this._applySoftLimiter(normalizedBuffer, settings);
        }
        
        const result = {
            buffer: finalBuffer,
            originalBuffer: buffer,
            analysis: analysis,
            gainApplied: gainDb,
            normalized: true,
            targetLUFS: settings.targetLUFS
        };
        
        if (this.onNormalizationComplete) {
            this.onNormalizationComplete(result);
        }
        
        return result;
    }
    
    /**
     * Apply soft limiting to prevent clipping
     */
    _applySoftLimiter(buffer, settings) {
        const numChannels = buffer.numberOfChannels;
        const newBuffer = this.audioContext.createBuffer(
            numChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        const threshold = Math.pow(10, settings.truePeakLimit / 20);
        const releaseCoeff = 1 - Math.exp(-1 / (settings.limiterRelease / 1000 * buffer.sampleRate));
        
        for (let ch = 0; ch < numChannels; ch++) {
            const input = buffer.getChannelData(ch);
            const output = newBuffer.getChannelData(ch);
            
            let envelope = 0;
            
            for (let i = 0; i < buffer.length; i++) {
                const sample = input[i];
                const absSample = Math.abs(sample);
                
                // Envelope follower
                if (absSample > envelope) {
                    envelope = absSample;
                } else {
                    envelope += (absSample - envelope) * releaseCoeff;
                }
                
                // Apply limiting
                if (envelope > threshold) {
                    const reduction = threshold / envelope;
                    output[i] = sample * reduction;
                } else {
                    output[i] = sample;
                }
            }
        }
        
        return newBuffer;
    }
    
    /**
     * Normalize to preset
     */
    async normalizeToPreset(buffer, presetName) {
        const preset = this.presets[presetName];
        if (!preset) {
            console.warn(`[AudioNormalization] Unknown preset: ${presetName}`);
            return null;
        }
        
        return this.normalizeBuffer(buffer, preset);
    }
    
    /**
     * Get available presets
     */
    getPresets() {
        return Object.keys(this.presets).map(key => ({
            name: key,
            ...this.presets[key]
        }));
    }
    
    /**
     * Set target LUFS
     */
    setTargetLUFS(lufs) {
        this.settings.targetLUFS = Math.max(-70, Math.min(0, lufs));
    }
    
    /**
     * Set true peak limit
     */
    setTruePeakLimit(db) {
        this.settings.truePeakLimit = Math.max(-3, Math.min(0, db));
    }
    
    /**
     * Create normalization UI panel
     */
    static createPanel(audioContext, containerId, onNormalize) {
        const container = document.getElementById(containerId) || document.body;
        
        const panel = document.createElement('div');
        panel.className = 'normalization-panel';
        panel.style.cssText = `
            padding: 16px;
            background: #1a1a2e;
            border-radius: 8px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
            min-width: 320px;
        `;
        
        // Title
        const title = document.createElement('h3');
        title.textContent = 'Loudness Normalization';
        title.style.cssText = 'margin: 0 0 12px 0; font-size: 16px;';
        panel.appendChild(title);
        
        // Preset selector
        const presetGroup = document.createElement('div');
        presetGroup.style.cssText = 'margin-bottom: 12px;';
        presetGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Preset:</label>
            <select id="norm-preset" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
                <option value="custom">Custom</option>
                <option value="streaming">Streaming (-14 LUFS)</option>
                <option value="spotify">Spotify (-14 LUFS)</option>
                <option value="youtube">YouTube (-14 LUFS)</option>
                <option value="appleMusic">Apple Music (-16 LUFS)</option>
                <option value="podcast">Podcast (-19 LUFS)</option>
                <option value="broadcast">Broadcast (-23 LUFS)</option>
                <option value="cd">CD Mastering (-9 LUFS)</option>
            </select>
        `;
        panel.appendChild(presetGroup);
        
        // Target LUFS
        const lufsGroup = document.createElement('div');
        lufsGroup.style.cssText = 'margin-bottom: 12px;';
        lufsGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Target LUFS:</label>
            <input type="number" id="norm-lufs" value="-14" min="-70" max="0" step="0.1"
                style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
        `;
        panel.appendChild(lufsGroup);
        
        // True peak limit
        const tpGroup = document.createElement('div');
        tpGroup.style.cssText = 'margin-bottom: 12px;';
        tpGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">True Peak Limit (dBTP):</label>
            <input type="number" id="norm-tp" value="-1" min="-3" max="0" step="0.1"
                style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
        `;
        panel.appendChild(tpGroup);
        
        // Options
        const optionsGroup = document.createElement('div');
        optionsGroup.style.cssText = 'margin-bottom: 12px;';
        
        const limitCheck = document.createElement('label');
        limitCheck.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        limitCheck.innerHTML = `
            <input type="checkbox" id="norm-limit" checked>
            <span>Apply limiting</span>
        `;
        optionsGroup.appendChild(limitCheck);
        
        const dynamicsCheck = document.createElement('label');
        dynamicsCheck.style.cssText = 'display: flex; align-items: center; gap: 8px;';
        dynamicsCheck.innerHTML = `
            <input type="checkbox" id="norm-dynamics" checked>
            <span>Preserve dynamics</span>
        `;
        optionsGroup.appendChild(dynamicsCheck);
        
        panel.appendChild(optionsGroup);
        
        // Progress bar
        const progressContainer = document.createElement('div');
        progressContainer.id = 'norm-progress-container';
        progressContainer.style.cssText = 'display: none; margin-bottom: 12px;';
        progressContainer.innerHTML = `
            <div style="height: 4px; background: #2a2a4e; border-radius: 2px; overflow: hidden;">
                <div id="norm-progress-bar" style="height: 100%; background: #3b82f6; width: 0%;"></div>
            </div>
            <div id="norm-progress-text" style="font-size: 11px; color: #888; margin-top: 4px;">Analyzing...</div>
        `;
        panel.appendChild(progressContainer);
        
        // Results display
        const resultsDisplay = document.createElement('div');
        resultsDisplay.id = 'norm-results';
        resultsDisplay.style.cssText = `
            display: none;
            padding: 8px;
            background: #0a0a14;
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 11px;
        `;
        resultsDisplay.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>Integrated: <span id="res-integrated">-</span> LUFS</div>
                <div>True Peak: <span id="res-tp">-</span> dBTP</div>
                <div>Peak: <span id="res-peak">-</span> dB</div>
                <div>RMS: <span id="res-rms">-</span> dB</div>
                <div>LRA: <span id="res-lra">-</span> LU</div>
                <div>Gain: <span id="res-gain">-</span> dB</div>
            </div>
        `;
        panel.appendChild(resultsDisplay);
        
        // Buttons
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 8px;';
        
        const analyzeBtn = document.createElement('button');
        analyzeBtn.textContent = 'Analyze Only';
        analyzeBtn.style.cssText = `
            flex: 1;
            padding: 12px;
            background: #2a2a4e;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        
        const normalizeBtn = document.createElement('button');
        normalizeBtn.textContent = 'Normalize';
        normalizeBtn.style.cssText = `
            flex: 1;
            padding: 12px;
            background: #3b82f6;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-weight: 600;
        `;
        
        buttons.appendChild(analyzeBtn);
        buttons.appendChild(normalizeBtn);
        panel.appendChild(buttons);
        
        // Create normalizer
        const normalizer = new AudioNormalizationTarget(audioContext);
        
        // Event handlers
        const presetSelect = panel.querySelector('#norm-preset');
        const lufsInput = panel.querySelector('#norm-lufs');
        const tpInput = panel.querySelector('#norm-tp');
        
        presetSelect.onchange = () => {
            const preset = normalizer.presets[presetSelect.value];
            if (preset) {
                lufsInput.value = preset.targetLUFS;
                tpInput.value = preset.truePeakLimit;
            }
        };
        
        const showProgress = (show, text = 'Analyzing...') => {
            progressContainer.style.display = show ? 'block' : 'none';
            document.getElementById('norm-progress-text').textContent = text;
        };
        
        normalizer.onProgress = (progress) => {
            document.getElementById('norm-progress-bar').style.width = `${progress * 100}%`;
        };
        
        analyzeBtn.onclick = async () => {
            // This would need an actual buffer to analyze
            console.log('[AudioNormalization] Analyze clicked - needs buffer input');
        };
        
        normalizeBtn.onclick = async () => {
            normalizer.setTargetLUFS(parseFloat(lufsInput.value));
            normalizer.setTruePeakLimit(parseFloat(tpInput.value));
            normalizer.settings.applyLimiting = document.getElementById('norm-limit').checked;
            normalizer.settings.preserveDynamics = document.getElementById('norm-dynamics').checked;
            
            if (onNormalize) {
                onNormalize(normalizer);
            }
        };
        
        container.appendChild(panel);
        
        return { panel, normalizer };
    }
    
    /**
     * Serialize settings
     */
    serialize() {
        return {
            settings: { ...this.settings },
            analysis: { ...this.analysis }
        };
    }
    
    /**
     * Restore settings
     */
    restore(data) {
        Object.assign(this.settings, data.settings || {});
        if (data.analysis) {
            Object.assign(this.analysis, data.analysis);
        }
    }
}

export default AudioNormalizationTarget;