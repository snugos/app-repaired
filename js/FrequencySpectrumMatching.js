/**
 * FrequencySpectrumMatching.js
 * Match frequency spectrum to a reference track for tonal matching
 */

class FrequencySpectrumMatching {
    constructor() {
        this.referenceSpectrum = null;
        this.targetSpectrum = null;
        this.matchResult = null;
        this.isEnabled = true;
        this.matchMode = 'overall'; // overall, bands, custom
        this.smoothing = 0.85;
        this.matchStrength = 0.7; // 0-1, how strongly to apply the match
        
        // Frequency bands for matching
        this.frequencyBands = [
            { name: 'Sub', min: 20, max: 60, target: 0 },
            { name: 'Bass', min: 60, max: 250, target: 0 },
            { name: 'Low-Mid', min: 250, max: 500, target: 0 },
            { name: 'Mid', min: 500, max: 2000, target: 0 },
            { name: 'High-Mid', min: 2000, max: 4000, target: 0 },
            { name: 'Presence', min: 4000, max: 8000, target: 0 },
            { name: 'Air', min: 8000, max: 20000, target: 0 }
        ];
        
        // EQ nodes for correction
        this.correctionFilters = [];
        this.correctionAmounts = [];
        
        // Match history
        this.matchHistory = [];
        this.maxHistory = 20;
        
        // FFT settings
        this.fftSize = 8192;
        this.analyserNode = null;
        this.referenceAnalyser = null;
        
        this.init();
    }
    
    init() {
        console.log('[SpectrumMatching] Initialized');
    }
    
    // Set up audio analysis
    setupAnalysis(audioContext) {
        this.audioContext = audioContext;
        this.analyserNode = audioContext.createAnalyser();
        this.analyserNode.fftSize = this.fftSize;
        this.analyserNode.smoothingTimeConstant = this.smoothing;
        
        this.referenceAnalyser = audioContext.createAnalyser();
        this.referenceAnalyser.fftSize = this.fftSize;
        this.referenceAnalyser.smoothingTimeConstant = this.smoothing;
    }
    
    // Load reference from audio file
    async loadReferenceFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioContext.decodeAudioData(e.target.result);
                    
                    // Analyze the reference
                    const spectrum = this.analyzeBuffer(audioBuffer, audioContext);
                    this.referenceSpectrum = spectrum;
                    
                    // Calculate band targets
                    this.calculateBandTargets(spectrum);
                    
                    console.log('[SpectrumMatching] Reference loaded from file');
                    resolve(spectrum);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    // Load reference from URL
    async loadReferenceFromURL(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const spectrum = this.analyzeBuffer(audioBuffer, audioContext);
        this.referenceSpectrum = spectrum;
        
        this.calculateBandTargets(spectrum);
        
        console.log('[SpectrumMatching] Reference loaded from URL');
        return spectrum;
    }
    
    // Set reference from live audio node
    setReferenceFromNode(node) {
        if (!this.referenceAnalyser) {
            this.setupAnalysis(node.context);
        }
        
        node.connect(this.referenceAnalyser);
        
        // Capture spectrum snapshot
        const spectrum = this.captureSpectrum(this.referenceAnalyser);
        this.referenceSpectrum = spectrum;
        
        this.calculateBandTargets(spectrum);
        
        console.log('[SpectrumMatching] Reference captured from live node');
        return spectrum;
    }
    
    // Analyze audio buffer to get spectrum
    analyzeBuffer(audioBuffer, audioContext) {
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        // Create analyser
        const analyser = offlineContext.createAnalyser();
        analyser.fftSize = this.fftSize;
        
        // Connect buffer source
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        analyser.connect(offlineContext.destination);
        
        // Render
        source.start();
        const renderedBuffer = offlineContext.startRendering();
        
        // This is synchronous for offline context
        // Return frequency data
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        
        // Analyze the actual audio data directly
        const channelData = audioBuffer.getChannelData(0);
        const spectrum = this.computeSpectrum(channelData, audioBuffer.sampleRate);
        
        return {
            data: spectrum,
            sampleRate: audioBuffer.sampleRate,
            duration: audioBuffer.duration,
            bands: this.analyzeBands(spectrum, audioBuffer.sampleRate)
        };
    }
    
    // Compute spectrum from time-domain data
    computeSpectrum(samples, sampleRate) {
        const N = samples.length;
        const spectrum = new Float32Array(N / 2);
        
        // Simple DFT for spectrum (in production, would use FFT)
        for (let k = 0; k < N / 2; k++) {
            let real = 0;
            let imag = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = (2 * Math.PI * k * n) / N;
                real += samples[n] * Math.cos(angle);
                imag -= samples[n] * Math.sin(angle);
            }
            
            spectrum[k] = Math.sqrt(real * real + imag * imag);
        }
        
        return spectrum;
    }
    
    // Capture current spectrum from analyser
    captureSpectrum(analyser) {
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(frequencyData);
        
        return {
            data: frequencyData,
            sampleRate: analyser.context.sampleRate,
            bands: this.analyzeBands(frequencyData, analyser.context.sampleRate)
        };
    }
    
    // Analyze frequency bands
    analyzeBands(spectrum, sampleRate) {
        const binSize = sampleRate / (spectrum.length * 2);
        const bands = {};
        
        for (const band of this.frequencyBands) {
            const startBin = Math.floor(band.min / binSize);
            const endBin = Math.min(Math.floor(band.max / binSize), spectrum.length - 1);
            
            let sum = 0;
            let count = 0;
            
            for (let i = startBin; i <= endBin; i++) {
                if (spectrum[i] !== -Infinity) {
                    sum += spectrum[i];
                    count++;
                }
            }
            
            bands[band.name] = {
                level: count > 0 ? sum / count : -100,
                min: band.min,
                max: band.max
            };
        }
        
        return bands;
    }
    
    // Calculate target levels for each band
    calculateBandTargets(spectrum) {
        if (!spectrum || !spectrum.bands) return;
        
        for (const band of this.frequencyBands) {
            const bandData = spectrum.bands[band.name];
            if (bandData) {
                band.target = bandData.level;
            }
        }
    }
    
    // Analyze target audio
    analyzeTarget(node) {
        if (!this.analyserNode) {
            this.setupAnalysis(node.context);
        }
        
        node.connect(this.analyserNode);
        this.targetSpectrum = this.captureSpectrum(this.analyserNode);
        
        return this.targetSpectrum;
    }
    
    // Compare spectra
    compareSpectra() {
        if (!this.referenceSpectrum || !this.targetSpectrum) {
            return null;
        }
        
        const comparison = {
            overallDiff: 0,
            bandDiffs: {},
            correlation: 0,
            corrections: []
        };
        
        // Calculate per-band differences
        const refBands = this.referenceSpectrum.bands;
        const targetBands = this.targetSpectrum.bands;
        
        let totalDiff = 0;
        let bandCount = 0;
        
        for (const band of this.frequencyBands) {
            const refLevel = refBands[band.name]?.level || 0;
            const targetLevel = targetBands[band.name]?.level || 0;
            const diff = targetLevel - refLevel;
            
            comparison.bandDiffs[band.name] = {
                reference: refLevel,
                target: targetLevel,
                diff: diff,
                correction: -diff * this.matchStrength
            };
            
            // Calculate correction
            if (Math.abs(diff) > 1) {
                comparison.corrections.push({
                    band: band.name,
                    freq: (band.min + band.max) / 2,
                    q: (band.max - band.min) / ((band.min + band.max) / 2),
                    gain: -diff * this.matchStrength
                });
            }
            
            totalDiff += Math.abs(diff);
            bandCount++;
        }
        
        comparison.overallDiff = totalDiff / bandCount;
        
        // Calculate correlation
        comparison.correlation = this.calculateCorrelation(
            this.referenceSpectrum.data,
            this.targetSpectrum.data
        );
        
        this.matchResult = comparison;
        return comparison;
    }
    
    // Calculate correlation coefficient
    calculateCorrelation(arr1, arr2) {
        const len = Math.min(arr1.length, arr2.length);
        
        let sum1 = 0, sum2 = 0;
        for (let i = 0; i < len; i++) {
            sum1 += arr1[i];
            sum2 += arr2[i];
        }
        
        const mean1 = sum1 / len;
        const mean2 = sum2 / len;
        
        let numerator = 0;
        let denom1 = 0, denom2 = 0;
        
        for (let i = 0; i < len; i++) {
            const diff1 = arr1[i] - mean1;
            const diff2 = arr2[i] - mean2;
            
            numerator += diff1 * diff2;
            denom1 += diff1 * diff1;
            denom2 += diff2 * diff2;
        }
        
        const denom = Math.sqrt(denom1 * denom2);
        return denom > 0 ? numerator / denom : 0;
    }
    
    // Apply spectrum matching
    applyMatching(audioContext, targetNode, outputNode) {
        const comparison = this.compareSpectra();
        if (!comparison) return null;
        
        // Clear existing filters
        this.clearCorrectionFilters();
        
        // Create EQ filters for correction
        for (const correction of comparison.corrections) {
            const filter = audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = correction.freq;
            filter.Q.value = correction.q;
            filter.gain.value = correction.gain;
            
            this.correctionFilters.push(filter);
        }
        
        // Connect filters
        let currentNode = targetNode;
        for (const filter of this.correctionFilters) {
            currentNode.connect(filter);
            currentNode = filter;
        }
        currentNode.connect(outputNode);
        
        console.log(`[SpectrumMatching] Applied ${this.correctionFilters.length} correction filters`);
        
        return comparison.corrections;
    }
    
    // Clear correction filters
    clearCorrectionFilters() {
        for (const filter of this.correctionFilters) {
            try {
                filter.disconnect();
            } catch (e) {}
        }
        this.correctionFilters = [];
    }
    
    // Set match strength
    setMatchStrength(strength) {
        this.matchStrength = Math.max(0, Math.min(1, strength));
    }
    
    // Export match settings
    exportSettings() {
        return {
            matchStrength: this.matchStrength,
            matchMode: this.matchMode,
            smoothing: this.smoothing,
            referenceSpectrum: this.referenceSpectrum,
            frequencyBands: this.frequencyBands.map(b => ({
                name: b.name,
                min: b.min,
                max: b.max,
                target: b.target
            }))
        };
    }
    
    // Import match settings
    importSettings(settings) {
        if (settings.matchStrength !== undefined) {
            this.matchStrength = settings.matchStrength;
        }
        if (settings.matchMode !== undefined) {
            this.matchMode = settings.matchMode;
        }
        if (settings.smoothing !== undefined) {
            this.smoothing = settings.smoothing;
        }
        if (settings.referenceSpectrum) {
            this.referenceSpectrum = settings.referenceSpectrum;
        }
        if (settings.frequencyBands) {
            for (const imported of settings.frequencyBands) {
                const band = this.frequencyBands.find(b => b.name === imported.name);
                if (band) {
                    band.target = imported.target;
                }
            }
        }
    }
    
    // UI Panel
    openPanel() {
        const existing = document.getElementById('spectrum-matching-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'spectrum-matching-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 700px;
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
                    <h3 style="margin: 0; font-size: 18px;">📊 Frequency Spectrum Matching</h3>
                    <button id="close-spectrum-panel" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
                </div>
            </div>
            
            <div style="padding: 16px; max-height: 70vh; overflow-y: auto;">
                <!-- Reference Section -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Reference Track</h4>
                    
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <label style="
                            flex: 1;
                            padding: 20px;
                            border: 2px dashed #333;
                            border-radius: 6px;
                            text-align: center;
                            cursor: pointer;
                            transition: border-color 0.2s;
                        " onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#333'">
                            <input type="file" id="reference-file" accept="audio/*" style="display: none;">
                            <div style="font-size: 24px; margin-bottom: 8px;">📁</div>
                            <div style="font-size: 12px; color: #888;">Drop reference audio file</div>
                        </label>
                    </div>
                    
                    <div id="reference-info" style="display: none; background: #0a0a14; padding: 12px; border-radius: 4px;">
                        <div style="font-size: 12px; color: #10b981;">✓ Reference loaded</div>
                        <div id="reference-name" style="font-size: 14px; margin-top: 4px;"></div>
                    </div>
                </div>
                
                <!-- Match Strength -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Match Strength</h4>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <input type="range" id="match-strength" min="0" max="100" value="${this.matchStrength * 100}" style="flex: 1;">
                        <span id="strength-value" style="font-size: 14px; min-width: 50px;">${Math.round(this.matchStrength * 100)}%</span>
                    </div>
                </div>
                
                <!-- Frequency Bands -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Frequency Band Targets</h4>
                    <div id="band-sliders" style="background: #0a0a14; padding: 12px; border-radius: 4px;">
                        ${this.renderBandSliders()}
                    </div>
                </div>
                
                <!-- Actions -->
                <div style="display: flex; gap: 8px; margin-bottom: 20px;">
                    <button id="analyze-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        🔍 Compare Spectra
                    </button>
                    <button id="apply-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer;" ${!this.referenceSpectrum ? 'disabled' : ''}>
                        ✨ Apply Matching
                    </button>
                </div>
                
                <!-- Results -->
                <div id="match-results" style="display: none;">
                    ${this.renderResults()}
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupPanelEvents();
    }
    
    renderBandSliders() {
        return this.frequencyBands.map(band => `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <span style="min-width: 80px; font-size: 11px; color: #888;">${band.name}</span>
                <input type="range" class="band-slider" data-band="${band.name}" min="-20" max="20" value="${band.target || 0}" step="0.5" style="flex: 1;">
                <span class="band-value" style="min-width: 50px; font-size: 11px; text-align: right;">${(band.target || 0).toFixed(1)} dB</span>
            </div>
        `).join('');
    }
    
    renderResults() {
        if (!this.matchResult) return '';
        
        const r = this.matchResult;
        
        return `
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Match Results</h4>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 12px; margin-bottom: 16px;">
                    <div>
                        <div style="color: #888;">Overall Difference</div>
                        <div style="font-size: 18px; font-weight: bold;">${r.overallDiff.toFixed(1)} dB</div>
                    </div>
                    <div>
                        <div style="color: #888;">Correlation</div>
                        <div style="font-size: 18px; font-weight: bold;">${(r.correlation * 100).toFixed(0)}%</div>
                    </div>
                </div>
                
                <h5 style="margin: 12px 0 8px 0; font-size: 12px; color: #888;">Corrections Applied</h5>
                <div style="max-height: 150px; overflow-y: auto;">
                    ${r.corrections.map(c => `
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #222; font-size: 11px;">
                            <span>${c.band}</span>
                            <span style="color: ${c.gain > 0 ? '#10b981' : '#ef4444'};">${c.gain > 0 ? '+' : ''}${c.gain.toFixed(1)} dB</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    setupPanelEvents() {
        const panel = document.getElementById('spectrum-matching-panel');
        if (!panel) return;
        
        // Close
        panel.querySelector('#close-spectrum-panel').onclick = () => panel.remove();
        
        // Reference file
        const fileInput = panel.querySelector('#reference-file');
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    panel.querySelector('#reference-info').style.display = 'block';
                    panel.querySelector('#reference-name').textContent = file.name;
                    
                    await this.loadReferenceFromFile(file);
                    
                    // Update band sliders
                    panel.querySelector('#band-sliders').innerHTML = this.renderBandSliders();
                    this.setupBandSliderEvents();
                    
                    panel.querySelector('#apply-btn').disabled = false;
                } catch (error) {
                    console.error('[SpectrumMatching] Failed to load reference:', error);
                    alert('Failed to load reference file');
                }
            }
        };
        
        // Match strength
        const strengthSlider = panel.querySelector('#match-strength');
        const strengthValue = panel.querySelector('#strength-value');
        strengthSlider.oninput = () => {
            const value = strengthSlider.value / 100;
            this.setMatchStrength(value);
            strengthValue.textContent = Math.round(value * 100) + '%';
        };
        
        // Band sliders
        this.setupBandSliderEvents();
        
        // Analyze button
        panel.querySelector('#analyze-btn').onclick = () => {
            this.dispatchEvent('analyze-requested');
            const comparison = this.compareSpectra();
            if (comparison) {
                panel.querySelector('#match-results').style.display = 'block';
                panel.querySelector('#match-results').innerHTML = this.renderResults();
            }
        };
        
        // Apply button
        panel.querySelector('#apply-btn').onclick = () => {
            this.dispatchEvent('apply-requested');
            alert('Spectrum matching applied!');
        };
    }
    
    setupBandSliderEvents() {
        const panel = document.getElementById('spectrum-matching-panel');
        if (!panel) return;
        
        panel.querySelectorAll('.band-slider').forEach(slider => {
            const bandName = slider.dataset.band;
            const valueSpan = slider.parentElement.querySelector('.band-value');
            
            slider.oninput = () => {
                const value = parseFloat(slider.value);
                const band = this.frequencyBands.find(b => b.name === bandName);
                if (band) {
                    band.target = value;
                }
                valueSpan.textContent = value.toFixed(1) + ' dB';
            };
        });
    }
    
    closePanel() {
        const panel = document.getElementById('spectrum-matching-panel');
        if (panel) panel.remove();
    }
    
    // Event system
    dispatchEvent(eventName, data = {}) {
        window.dispatchEvent(new CustomEvent(`spectrum-matching:${eventName}`, { detail: data }));
    }
    
    on(eventName, callback) {
        window.addEventListener(`spectrum-matching:${eventName}`, (e) => callback(e.detail));
    }
    
    off(eventName, callback) {
        window.removeEventListener(`spectrum-matching:${eventName}`, callback);
    }
    
    // Cleanup
    dispose() {
        this.closePanel();
        this.clearCorrectionFilters();
        this.referenceSpectrum = null;
        this.targetSpectrum = null;
    }
}

// Export singleton instance
const frequencySpectrumMatching = new FrequencySpectrumMatching();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FrequencySpectrumMatching, frequencySpectrumMatching };
}