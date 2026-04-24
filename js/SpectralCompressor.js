/**
 * Spectral Compressor - Frequency-aware compression with independent band control
 * Provides multi-band compression with per-band threshold, ratio, attack, and release
 */

class SpectralCompressor {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Configuration
        this.numBands = options.numBands || 4;
        this.crossoverFrequencies = options.crossoverFrequencies || [200, 1000, 4000];
        
        // Ensure we have correct number of crossover frequencies
        while (this.crossoverFrequencies.length < this.numBands - 1) {
            const lastFreq = this.crossoverFrequencies[this.crossoverFrequencies.length - 1] || 1000;
            this.crossoverFrequencies.push(lastFreq * 2);
        }
        
        // Band state
        this.bands = [];
        this.bandEnables = [];
        this.analyzers = [];
        
        // Create filter banks and compressors
        this.createBands();
        
        // Connect input to all band filters
        this.input.connect(this.lowpassFilter);
        this.input.connect(this.highpassFilters[0]);
        
        // Mix control
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain.gain.value = 0;
        this.wetGain.gain.value = 1;
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Presets
        this.presets = {
            'Transparent': {
                bands: [
                    { threshold: -20, ratio: 2, attack: 20, release: 100, gain: 0 },
                    { threshold: -18, ratio: 2.5, attack: 15, release: 80, gain: 0 },
                    { threshold: -16, ratio: 3, attack: 10, release: 60, gain: 0 },
                    { threshold: -14, ratio: 3.5, attack: 5, release: 40, gain: 0 }
                ],
                crossover: [200, 1000, 4000],
                mix: 1
            },
            'Punchy Drums': {
                bands: [
                    { threshold: -15, ratio: 4, attack: 5, release: 50, gain: 2 },
                    { threshold: -12, ratio: 3, attack: 10, release: 80, gain: 1 },
                    { threshold: -10, ratio: 2.5, attack: 15, release: 100, gain: 0 },
                    { threshold: -8, ratio: 2, attack: 20, release: 120, gain: -1 }
                ],
                crossover: [80, 400, 2000],
                mix: 1
            },
            'Vocal Polish': {
                bands: [
                    { threshold: -18, ratio: 3, attack: 30, release: 150, gain: 0 },
                    { threshold: -15, ratio: 2.5, attack: 20, release: 100, gain: 1 },
                    { threshold: -12, ratio: 2, attack: 15, release: 80, gain: 0 },
                    { threshold: -10, ratio: 2, attack: 10, release: 60, gain: 0 }
                ],
                crossover: [150, 800, 3000],
                mix: 0.8
            },
            'Mastering Glue': {
                bands: [
                    { threshold: -12, ratio: 1.5, attack: 30, release: 200, gain: 0 },
                    { threshold: -10, ratio: 1.8, attack: 25, release: 180, gain: 0 },
                    { threshold: -8, ratio: 2, attack: 20, release: 150, gain: 0 },
                    { threshold: -6, ratio: 2.2, attack: 15, release: 120, gain: 0 }
                ],
                crossover: [200, 1200, 5000],
                mix: 0.7
            },
            'Bass Control': {
                bands: [
                    { threshold: -10, ratio: 4, attack: 10, release: 80, gain: 2 },
                    { threshold: -15, ratio: 2, attack: 20, release: 100, gain: 0 },
                    { threshold: -18, ratio: 1.5, attack: 25, release: 120, gain: 0 },
                    { threshold: -20, ratio: 1.5, attack: 30, release: 150, gain: 0 }
                ],
                crossover: [100, 500, 2000],
                mix: 1
            },
            'De-Ess': {
                bands: [
                    { threshold: -30, ratio: 1, attack: 20, release: 100, gain: 0 },
                    { threshold: -25, ratio: 1.2, attack: 15, release: 80, gain: 0 },
                    { threshold: -18, ratio: 6, attack: 1, release: 50, gain: -2 },
                    { threshold: -20, ratio: 3, attack: 5, release: 60, gain: -1 }
                ],
                crossover: [200, 2000, 6000],
                mix: 1
            }
        };
    }
    
    createBands() {
        // Create lowpass for lowest band
        this.lowpassFilter = this.audioContext.createBiquadFilter();
        this.lowpassFilter.type = 'lowpass';
        this.lowpassFilter.frequency.value = this.crossoverFrequencies[0];
        this.lowpassFilter.Q.value = 0.707;
        
        // Create highpass filters and bandpass combinations
        this.highpassFilters = [];
        this.bandpassFilters = [];
        
        for (let i = 0; i < this.numBands - 1; i++) {
            const highpass = this.audioContext.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = this.crossoverFrequencies[i];
            highpass.Q.value = 0.707;
            this.highpassFilters.push(highpass);
            
            if (i < this.numBands - 2) {
                const bandpass = this.audioContext.createBiquadFilter();
                bandpass.type = 'bandpass';
                bandpass.frequency.value = (this.crossoverFrequencies[i] + this.crossoverFrequencies[i + 1]) / 2;
                bandpass.Q.value = this.calculateBandQ(this.crossoverFrequencies[i], this.crossoverFrequencies[i + 1]);
                this.bandpassFilters.push(bandpass);
            }
        }
        
        // Create compressor for each band
        this.compressorNodes = [];
        this.gainNodes = [];
        
        for (let i = 0; i < this.numBands; i++) {
            const compressor = this.audioContext.createDynamicsCompressor();
            compressor.threshold.value = -20;
            compressor.knee.value = 6;
            compressor.ratio.value = 4;
            compressor.attack.value = 0.01;
            compressor.release.value = 0.1;
            this.compressorNodes.push(compressor);
            
            const gain = this.audioContext.createGain();
            gain.gain.value = 1;
            this.gainNodes.push(gain);
            
            // Create analyzer for metering
            const analyzer = this.audioContext.createAnalyser();
            analyzer.fftSize = 256;
            this.analyzers.push(analyzer);
            
            // Connect compressor to gain to analyzer to output
            compressor.connect(gain);
            gain.connect(analyzer);
            analyzer.connect(this.output);
            
            this.bands.push({
                threshold: -20,
                ratio: 4,
                attack: 0.01,
                release: 0.1,
                knee: 6,
                gain: 1,
                enabled: true
            });
            this.bandEnables.push(true);
        }
        
        // Connect filters to compressors
        // Low band
        this.lowpassFilter.connect(this.compressorNodes[0]);
        
        // Middle bands
        for (let i = 0; i < this.bandpassFilters.length; i++) {
            this.highpassFilters[i].connect(this.bandpassFilters[i]);
            this.bandpassFilters[i].connect(this.compressorNodes[i + 1]);
        }
        
        // High band
        const lastHighpass = this.highpassFilters[this.highpassFilters.length - 1];
        lastHighpass.connect(this.compressorNodes[this.numBands - 1]);
    }
    
    calculateBandQ(lowFreq, highFreq) {
        const centerFreq = Math.sqrt(lowFreq * highFreq);
        const bandwidth = highFreq - lowFreq;
        return centerFreq / bandwidth;
    }
    
    setBandThreshold(bandIndex, threshold) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.compressorNodes[bandIndex].threshold.value = threshold;
            this.bands[bandIndex].threshold = threshold;
        }
    }
    
    setBandRatio(bandIndex, ratio) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.compressorNodes[bandIndex].ratio.value = ratio;
            this.bands[bandIndex].ratio = ratio;
        }
    }
    
    setBandAttack(bandIndex, attack) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.compressorNodes[bandIndex].attack.value = attack / 1000; // Convert ms to seconds
            this.bands[bandIndex].attack = attack;
        }
    }
    
    setBandRelease(bandIndex, release) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.compressorNodes[bandIndex].release.value = release / 1000; // Convert ms to seconds
            this.bands[bandIndex].release = release;
        }
    }
    
    setBandGain(bandIndex, gain) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.gainNodes[bandIndex].gain.value = Math.pow(10, gain / 20); // Convert dB to linear
            this.bands[bandIndex].gain = gain;
        }
    }
    
    setBandEnabled(bandIndex, enabled) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.gainNodes[bandIndex].gain.value = enabled ? Math.pow(10, this.bands[bandIndex].gain / 20) : 0;
            this.bandEnables[bandIndex] = enabled;
            this.bands[bandIndex].enabled = enabled;
        }
    }
    
    setCrossover(index, frequency) {
        if (index >= 0 && index < this.crossoverFrequencies.length) {
            this.crossoverFrequencies[index] = frequency;
            
            // Update filter frequencies
            if (index === 0) {
                this.lowpassFilter.frequency.value = frequency;
            }
            
            for (let i = 0; i < this.highpassFilters.length; i++) {
                if (i <= index) {
                    this.highpassFilters[i].frequency.value = this.crossoverFrequencies[i];
                }
            }
            
            for (let i = 0; i < this.bandpassFilters.length; i++) {
                const low = this.crossoverFrequencies[i];
                const high = this.crossoverFrequencies[i + 1] || low * 2;
                this.bandpassFilters[i].frequency.value = (low + high) / 2;
                this.bandpassFilters[i].Q.value = this.calculateBandQ(low, high);
            }
        }
    }
    
    setMix(mix) {
        this.dryGain.gain.value = 1 - mix;
        this.wetGain.gain.value = mix;
    }
    
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;
        
        // Apply crossover frequencies
        preset.crossover.forEach((freq, i) => {
            this.setCrossover(i, freq);
        });
        
        // Apply band settings
        preset.bands.forEach((band, i) => {
            if (i < this.numBands) {
                this.setBandThreshold(i, band.threshold);
                this.setBandRatio(i, band.ratio);
                this.setBandAttack(i, band.attack);
                this.setBandRelease(i, band.release);
                this.setBandGain(i, band.gain);
            }
        });
        
        // Apply mix
        this.setMix(preset.mix);
    }
    
    getBandGainReduction(bandIndex) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            return this.compressorNodes[bandIndex].reduction;
        }
        return 0;
    }
    
    getBandLevels() {
        const levels = [];
        for (let i = 0; i < this.numBands; i++) {
            const dataArray = new Float32Array(this.analyzers[i].fftSize);
            this.analyzers[i].getFloatTimeDomainData(dataArray);
            
            // Calculate RMS
            let sum = 0;
            for (let j = 0; j < dataArray.length; j++) {
                sum += dataArray[j] * dataArray[j];
            }
            const rms = Math.sqrt(sum / dataArray.length);
            levels.push(20 * Math.log10(rms + 0.00001)); // Convert to dB
        }
        return levels;
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
    
    getBandNames() {
        return ['Low Band', 'Low-Mid Band', 'High-Mid Band', 'High Band'];
    }
}

/**
 * Create Spectral Compressor UI Panel
 */
export function openSpectralCompressorPanel(services = {}) {
    const { audioContext, masterOutput, container = document.body } = services;
    
    if (!audioContext) {
        console.error('Spectral Compressor: audioContext required');
        return null;
    }
    
    // Create compressor instance
    const compressor = new SpectralCompressor(audioContext);
    
    // Create UI container
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #3a3a5e;
        border-radius: 12px;
        padding: 20px;
        min-width: 600px;
        max-width: 800px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #3a3a5e;
    `;
    header.innerHTML = `
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #e94560;">🎚️ Spectral Compressor</h2>
        <button id="close-btn" style="background: #e94560; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: white;">✕ Close</button>
    `;
    panel.appendChild(header);
    
    // Preset selector
    const presetSection = document.createElement('div');
    presetSection.style.cssText = 'margin-bottom: 20px;';
    presetSection.innerHTML = `
        <label style="font-size: 14px; color: #a0a0a0; display: block; margin-bottom: 8px;">Preset</label>
        <select id="preset-select" style="
            width: 100%;
            padding: 10px;
            background: #0a0a14;
            border: 1px solid #3a3a5e;
            border-radius: 6px;
            color: #e0e0e0;
            font-size: 14px;
        ">
            <option value="">-- Select Preset --</option>
            ${Object.keys(compressor.presets).map(name => `<option value="${name}">${name}</option>`).join('')}
        </select>
    `;
    panel.appendChild(presetSection);
    
    // Crossover frequencies section
    const crossoverSection = document.createElement('div');
    crossoverSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin-bottom: 20px;
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
    `;
    crossoverSection.innerHTML = `
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Crossover 1 (Hz)</label>
            <input type="range" id="crossover-0" min="50" max="500" value="200" style="width: 100%;">
            <span id="crossover-val-0" style="font-size: 12px; color: #e94560;">200 Hz</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Crossover 2 (Hz)</label>
            <input type="range" id="crossover-1" min="200" max="2000" value="1000" style="width: 100%;">
            <span id="crossover-val-1" style="font-size: 12px; color: #e94560;">1000 Hz</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Crossover 3 (Hz)</label>
            <input type="range" id="crossover-2" min="1000" max="10000" value="4000" style="width: 100%;">
            <span id="crossover-val-2" style="font-size: 12px; color: #e94560;">4000 Hz</span>
        </div>
    `;
    panel.appendChild(crossoverSection);
    
    // Bands container
    const bandsContainer = document.createElement('div');
    bandsContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        margin-bottom: 20px;
    `;
    
    const bandNames = compressor.getBandNames();
    const bandColors = ['#e94560', '#f39c12', '#27ae60', '#3498db'];
    
    for (let i = 0; i < 4; i++) {
        const bandDiv = document.createElement('div');
        bandDiv.style.cssText = `
            background: #0a0a14;
            border-radius: 8px;
            padding: 15px;
            border-left: 3px solid ${bandColors[i]};
        `;
        bandDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 600; color: ${bandColors[i]}; font-size: 13px;">${bandNames[i]}</span>
                <input type="checkbox" id="band-enable-${i}" checked style="transform: scale(1.2);">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Threshold</label>
                <input type="range" id="band-threshold-${i}" min="-60" max="0" value="-20" style="width: 100%;">
                <span id="band-threshold-val-${i}" style="font-size: 11px; color: #e0e0e0;">-20 dB</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Ratio</label>
                <input type="range" id="band-ratio-${i}" min="1" max="20" value="4" step="0.5" style="width: 100%;">
                <span id="band-ratio-val-${i}" style="font-size: 11px; color: #e0e0e0;">4:1</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Attack</label>
                <input type="range" id="band-attack-${i}" min="1" max="100" value="10" style="width: 100%;">
                <span id="band-attack-val-${i}" style="font-size: 11px; color: #e0e0e0;">10 ms</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Release</label>
                <input type="range" id="band-release-${i}" min="10" max="500" value="100" style="width: 100%;">
                <span id="band-release-val-${i}" style="font-size: 11px; color: #e0e0e0;">100 ms</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Output Gain</label>
                <input type="range" id="band-gain-${i}" min="-12" max="12" value="0" style="width: 100%;">
                <span id="band-gain-val-${i}" style="font-size: 11px; color: #e0e0e0;">0 dB</span>
            </div>
            
            <div style="background: #1a1a2e; border-radius: 4px; padding: 8px; text-align: center;">
                <span style="font-size: 10px; color: #a0a0a0;">Gain Reduction</span>
                <div id="band-gr-${i}" style="font-size: 16px; font-weight: bold; color: ${bandColors[i]};">0 dB</div>
            </div>
        `;
        bandsContainer.appendChild(bandDiv);
    }
    panel.appendChild(bandsContainer);
    
    // Global mix control
    const mixSection = document.createElement('div');
    mixSection.style.cssText = `
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
        margin-bottom: 15px;
    `;
    mixSection.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px;">
            <label style="font-size: 14px; color: #a0a0a0;">Dry/Wet Mix</label>
            <input type="range" id="mix-control" min="0" max="100" value="100" style="flex: 1;">
            <span id="mix-val" style="font-size: 14px; color: #e94560; min-width: 50px;">100%</span>
        </div>
    `;
    panel.appendChild(mixSection);
    
    container.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-btn').onclick = () => {
        panel.remove();
    };
    
    document.getElementById('preset-select').onchange = (e) => {
        if (e.target.value) {
            compressor.applyPreset(e.target.value);
            // Update UI
            updateUIFromCompressor();
        }
    };
    
    // Crossover controls
    for (let i = 0; i < 3; i++) {
        const crossoverInput = document.getElementById(`crossover-${i}`);
        const crossoverVal = document.getElementById(`crossover-val-${i}`);
        crossoverInput.oninput = (e) => {
            const freq = parseInt(e.target.value);
            compressor.setCrossover(i, freq);
            crossoverVal.textContent = `${freq} Hz`;
        };
    }
    
    // Band controls
    for (let i = 0; i < 4; i++) {
        // Enable checkbox
        document.getElementById(`band-enable-${i}`).onchange = (e) => {
            compressor.setBandEnabled(i, e.target.checked);
        };
        
        // Threshold
        const thresholdInput = document.getElementById(`band-threshold-${i}`);
        const thresholdVal = document.getElementById(`band-threshold-val-${i}`);
        thresholdInput.oninput = (e) => {
            compressor.setBandThreshold(i, parseInt(e.target.value));
            thresholdVal.textContent = `${e.target.value} dB`;
        };
        
        // Ratio
        const ratioInput = document.getElementById(`band-ratio-${i}`);
        const ratioVal = document.getElementById(`band-ratio-val-${i}`);
        ratioInput.oninput = (e) => {
            compressor.setBandRatio(i, parseFloat(e.target.value));
            ratioVal.textContent = `${e.target.value}:1`;
        };
        
        // Attack
        const attackInput = document.getElementById(`band-attack-${i}`);
        const attackVal = document.getElementById(`band-attack-val-${i}`);
        attackInput.oninput = (e) => {
            compressor.setBandAttack(i, parseInt(e.target.value));
            attackVal.textContent = `${e.target.value} ms`;
        };
        
        // Release
        const releaseInput = document.getElementById(`band-release-${i}`);
        const releaseVal = document.getElementById(`band-release-val-${i}`);
        releaseInput.oninput = (e) => {
            compressor.setBandRelease(i, parseInt(e.target.value));
            releaseVal.textContent = `${e.target.value} ms`;
        };
        
        // Gain
        const gainInput = document.getElementById(`band-gain-${i}`);
        const gainVal = document.getElementById(`band-gain-val-${i}`);
        gainInput.oninput = (e) => {
            compressor.setBandGain(i, parseInt(e.target.value));
            gainVal.textContent = `${e.target.value} dB`;
        };
    }
    
    // Mix control
    const mixInput = document.getElementById('mix-control');
    const mixVal = document.getElementById('mix-val');
    mixInput.oninput = (e) => {
        const mix = parseInt(e.target.value) / 100;
        compressor.setMix(mix);
        mixVal.textContent = `${e.target.value}%`;
    };
    
    // Update UI from compressor state
    function updateUIFromCompressor() {
        for (let i = 0; i < 4; i++) {
            document.getElementById(`band-threshold-${i}`).value = compressor.bands[i].threshold;
            document.getElementById(`band-threshold-val-${i}`).textContent = `${compressor.bands[i].threshold} dB`;
            
            document.getElementById(`band-ratio-${i}`).value = compressor.bands[i].ratio;
            document.getElementById(`band-ratio-val-${i}`).textContent = `${compressor.bands[i].ratio}:1`;
            
            document.getElementById(`band-attack-${i}`).value = compressor.bands[i].attack;
            document.getElementById(`band-attack-val-${i}`).textContent = `${compressor.bands[i].attack} ms`;
            
            document.getElementById(`band-release-${i}`).value = compressor.bands[i].release;
            document.getElementById(`band-release-val-${i}`).textContent = `${compressor.bands[i].release} ms`;
            
            document.getElementById(`band-gain-${i}`).value = compressor.bands[i].gain;
            document.getElementById(`band-gain-val-${i}`).textContent = `${compressor.bands[i].gain} dB`;
        }
        
        // Update crossovers
        for (let i = 0; i < 3; i++) {
            if (compressor.crossoverFrequencies[i]) {
                document.getElementById(`crossover-${i}`).value = compressor.crossoverFrequencies[i];
                document.getElementById(`crossover-val-${i}`).textContent = `${compressor.crossoverFrequencies[i]} Hz`;
            }
        }
    }
    
    // Update gain reduction meters
    function updateGRMeters() {
        for (let i = 0; i < 4; i++) {
            const gr = compressor.getBandGainReduction(i);
            document.getElementById(`band-gr-${i}`).textContent = `${gr.toFixed(1)} dB`;
        }
        requestAnimationFrame(updateGRMeters);
    }
    updateGRMeters();
    
    return compressor;
}

export { SpectralCompressor };
export default SpectralCompressor;