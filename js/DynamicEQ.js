/**
 * Dynamic EQ - EQ bands that respond to input level
 * Provides frequency bands that adjust gain based on signal dynamics
 */

class DynamicEQ {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Configuration
        this.numBands = options.numBands || 4;
        this.bands = [];
        this.bandFilters = [];
        this.bandCompressors = [];
        this.bandAnalyzers = [];
        this.bandGains = [];
        
        // Band frequencies (default)
        this.frequencies = options.frequencies || [100, 400, 1600, 6400];
        
        // Create bands
        this.createBands();
        
        // Sidechain input
        this.sidechainInput = audioContext.createGain();
        this.sidechainAnalyser = audioContext.createAnalyser();
        this.sidechainAnalyser.fftSize = 256;
        this.sidechainInput.connect(this.sidechainAnalyser);
        
        // Mix control
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain.gain.value = 0;
        this.wetGain.gain.value = 1;
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Presets
        this.presets = {
            'Vocal De-Ess': {
                bands: [
                    { frequency: 100, Q: 1, threshold: -20, range: 0, enabled: false },
                    { frequency: 400, Q: 1, threshold: -20, range: 0, enabled: false },
                    { frequency: 4000, Q: 2, threshold: -30, range: -6, enabled: true },
                    { frequency: 8000, Q: 2, threshold: -25, range: -4, enabled: true }
                ],
                mix: 1
            },
            'Drum Punch': {
                bands: [
                    { frequency: 80, Q: 1.5, threshold: -15, range: 4, enabled: true },
                    { frequency: 400, Q: 1, threshold: -20, range: 0, enabled: false },
                    { frequency: 2000, Q: 1, threshold: -18, range: 2, enabled: true },
                    { frequency: 8000, Q: 0.7, threshold: -22, range: 0, enabled: false }
                ],
                mix: 0.8
            },
            'Bass Control': {
                bands: [
                    { frequency: 60, Q: 2, threshold: -12, range: -3, enabled: true },
                    { frequency: 200, Q: 1, threshold: -18, range: 0, enabled: false },
                    { frequency: 1000, Q: 0.7, threshold: -20, range: 0, enabled: false },
                    { frequency: 4000, Q: 0.7, threshold: -22, range: 0, enabled: false }
                ],
                mix: 1
            },
            'Presence Boost': {
                bands: [
                    { frequency: 100, Q: 0.7, threshold: -20, range: 0, enabled: false },
                    { frequency: 400, Q: 0.7, threshold: -20, range: 0, enabled: false },
                    { frequency: 2000, Q: 1, threshold: -18, range: 3, enabled: true },
                    { frequency: 6000, Q: 1, threshold: -20, range: 2, enabled: true }
                ],
                mix: 0.6
            },
            'Mastering EQ': {
                bands: [
                    { frequency: 80, Q: 0.7, threshold: -15, range: 1, enabled: true },
                    { frequency: 300, Q: 0.7, threshold: -18, range: 0, enabled: false },
                    { frequency: 1500, Q: 0.7, threshold: -20, range: 1, enabled: true },
                    { frequency: 8000, Q: 0.7, threshold: -22, range: 1, enabled: true }
                ],
                mix: 0.5
            },
            'High Frequency Tamer': {
                bands: [
                    { frequency: 100, Q: 0.7, threshold: -20, range: 0, enabled: false },
                    { frequency: 500, Q: 0.7, threshold: -20, range: 0, enabled: false },
                    { frequency: 4000, Q: 1.5, threshold: -15, range: -4, enabled: true },
                    { frequency: 10000, Q: 1.5, threshold: -12, range: -6, enabled: true }
                ],
                mix: 0.7
            }
        };
    }
    
    createBands() {
        for (let i = 0; i < this.numBands; i++) {
            // Create band filter (peaking)
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = this.frequencies[i];
            filter.Q.value = 1;
            filter.gain.value = 0;
            
            // Create compressor for dynamic control
            const compressor = this.audioContext.createDynamicsCompressor();
            compressor.threshold.value = -20;
            compressor.knee.value = 10;
            compressor.ratio.value = 12;
            compressor.attack.value = 0.005;
            compressor.release.value = 0.05;
            
            // Create analyzer for metering
            const analyzer = this.audioContext.createAnalyser();
            analyzer.fftSize = 256;
            
            // Create gain for range control
            const gain = this.audioContext.createGain();
            gain.gain.value = 1;
            
            // Create envelope follower for input level detection
            const envelopeFollower = this.audioContext.createGain();
            
            // Connect signal path
            this.input.connect(filter);
            filter.connect(compressor);
            compressor.connect(gain);
            gain.connect(analyzer);
            analyzer.connect(this.wetGain);
            this.wetGain.connect(this.output);
            
            this.bandFilters.push(filter);
            this.bandCompressors.push(compressor);
            this.bandAnalyzers.push(analyzer);
            this.bandGains.push(gain);
            
            this.bands.push({
                frequency: this.frequencies[i],
                Q: 1,
                threshold: -20,
                range: 0,
                enabled: true,
                attack: 5,
                release: 50
            });
        }
    }
    
    setBandFrequency(bandIndex, frequency) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bandFilters[bandIndex].frequency.value = frequency;
            this.bands[bandIndex].frequency = frequency;
        }
    }
    
    setBandQ(bandIndex, Q) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bandFilters[bandIndex].Q.value = Q;
            this.bands[bandIndex].Q = Q;
        }
    }
    
    setBandThreshold(bandIndex, threshold) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bandCompressors[bandIndex].threshold.value = threshold;
            this.bands[bandIndex].threshold = threshold;
        }
    }
    
    setBandRange(bandIndex, range) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            // Range is the maximum gain reduction (negative values = reduction)
            // We use a makeup gain inverted approach
            const absRange = Math.abs(range);
            if (range < 0) {
                // Reduction mode - compressor reduces when threshold exceeded
                this.bandGains[bandIndex].gain.value = 1;
            } else {
                // Boost mode - inverse compressor behavior
                this.bandGains[bandIndex].gain.value = Math.pow(10, range / 20);
            }
            this.bands[bandIndex].range = range;
        }
    }
    
    setBandAttack(bandIndex, attack) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bandCompressors[bandIndex].attack.value = attack / 1000;
            this.bands[bandIndex].attack = attack;
        }
    }
    
    setBandRelease(bandIndex, release) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bandCompressors[bandIndex].release.value = release / 1000;
            this.bands[bandIndex].release = release;
        }
    }
    
    setBandEnabled(bandIndex, enabled) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            // Bypass by setting filter gain to 0 and compressor threshold to max
            if (enabled) {
                this.bandFilters[bandIndex].gain.value = 0;
                this.bandCompressors[bandIndex].threshold.value = this.bands[bandIndex].threshold;
            } else {
                this.bandFilters[bandIndex].gain.value = 0;
                this.bandCompressors[bandIndex].threshold.value = 0;
            }
            this.bands[bandIndex].enabled = enabled;
        }
    }
    
    setMix(mix) {
        this.dryGain.gain.value = 1 - mix;
        this.wetGain.gain.value = mix;
    }
    
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;
        
        preset.bands.forEach((band, i) => {
            if (i < this.numBands) {
                this.setBandFrequency(i, band.frequency);
                this.setBandQ(i, band.Q);
                this.setBandThreshold(i, band.threshold);
                this.setBandRange(i, band.range);
                this.setBandEnabled(i, band.enabled);
            }
        });
        
        this.setMix(preset.mix);
    }
    
    getBandGainReduction(bandIndex) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            return this.bandCompressors[bandIndex].reduction;
        }
        return 0;
    }
    
    getBandLevel(bandIndex) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            const dataArray = new Float32Array(this.bandAnalyzers[bandIndex].fftSize);
            this.bandAnalyzers[bandIndex].getFloatTimeDomainData(dataArray);
            
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i] * dataArray[i];
            }
            return 20 * Math.log10(Math.sqrt(sum / dataArray.length) + 0.00001);
        }
        return -100;
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
}

/**
 * Create Dynamic EQ UI Panel
 */
export function openDynamicEQPanel(services = {}) {
    const { audioContext, masterOutput, container = document.body } = services;
    
    if (!audioContext) {
        console.error('Dynamic EQ: audioContext required');
        return null;
    }
    
    // Create dynamic EQ instance
    const dynamicEQ = new DynamicEQ(audioContext);
    
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
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #27ae60;">📊 Dynamic EQ</h2>
        <button id="close-btn" style="background: #27ae60; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: white;">✕ Close</button>
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
            ${Object.keys(dynamicEQ.presets).map(name => `<option value="${name}">${name}</option>`).join('')}
        </select>
    `;
    panel.appendChild(presetSection);
    
    // Bands container
    const bandsContainer = document.createElement('div');
    bandsContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        margin-bottom: 20px;
    `;
    
    const bandNames = ['Low Band', 'Low-Mid', 'High-Mid', 'High Band'];
    const bandColors = ['#e74c3c', '#f39c12', '#27ae60', '#3498db'];
    
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
                <label style="font-size: 11px; color: #a0a0a0;">Frequency</label>
                <input type="range" id="band-freq-${i}" min="20" max="20000" value="${dynamicEQ.bands[i].frequency}" style="width: 100%;">
                <span id="band-freq-val-${i}" style="font-size: 11px; color: #e0e0e0;">${dynamicEQ.bands[i].frequency} Hz</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Q</label>
                <input type="range" id="band-q-${i}" min="0.1" max="10" step="0.1" value="1" style="width: 100%;">
                <span id="band-q-val-${i}" style="font-size: 11px; color: #e0e0e0;">1.0</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Threshold</label>
                <input type="range" id="band-threshold-${i}" min="-60" max="0" value="-20" style="width: 100%;">
                <span id="band-threshold-val-${i}" style="font-size: 11px; color: #e0e0e0;">-20 dB</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Range</label>
                <input type="range" id="band-range-${i}" min="-12" max="12" value="0" style="width: 100%;">
                <span id="band-range-val-${i}" style="font-size: 11px; color: #e0e0e0;">0 dB</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Attack</label>
                <input type="range" id="band-attack-${i}" min="1" max="100" value="5" style="width: 100%;">
                <span id="band-attack-val-${i}" style="font-size: 11px; color: #e0e0e0;">5 ms</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Release</label>
                <input type="range" id="band-release-${i}" min="10" max="500" value="50" style="width: 100%;">
                <span id="band-release-val-${i}" style="font-size: 11px; color: #e0e0e0;">50 ms</span>
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
    `;
    mixSection.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px;">
            <label style="font-size: 14px; color: #a0a0a0;">Dry/Wet Mix</label>
            <input type="range" id="mix-control" min="0" max="100" value="100" style="flex: 1;">
            <span id="mix-val" style="font-size: 14px; color: #27ae60; min-width: 50px;">100%</span>
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
            dynamicEQ.applyPreset(e.target.value);
            updateUIFromDynamicEQ();
        }
    };
    
    // Band controls
    for (let i = 0; i < 4; i++) {
        // Enable checkbox
        document.getElementById(`band-enable-${i}`).onchange = (e) => {
            dynamicEQ.setBandEnabled(i, e.target.checked);
        };
        
        // Frequency
        document.getElementById(`band-freq-${i}`).oninput = (e) => {
            const freq = parseInt(e.target.value);
            dynamicEQ.setBandFrequency(i, freq);
            document.getElementById(`band-freq-val-${i}`).textContent = `${freq} Hz`;
        };
        
        // Q
        document.getElementById(`band-q-${i}`).oninput = (e) => {
            dynamicEQ.setBandQ(i, parseFloat(e.target.value));
            document.getElementById(`band-q-val-${i}`).textContent = parseFloat(e.target.value).toFixed(1);
        };
        
        // Threshold
        document.getElementById(`band-threshold-${i}`).oninput = (e) => {
            dynamicEQ.setBandThreshold(i, parseInt(e.target.value));
            document.getElementById(`band-threshold-val-${i}`).textContent = `${e.target.value} dB`;
        };
        
        // Range
        document.getElementById(`band-range-${i}`).oninput = (e) => {
            dynamicEQ.setBandRange(i, parseInt(e.target.value));
            document.getElementById(`band-range-val-${i}`).textContent = `${e.target.value} dB`;
        };
        
        // Attack
        document.getElementById(`band-attack-${i}`).oninput = (e) => {
            dynamicEQ.setBandAttack(i, parseInt(e.target.value));
            document.getElementById(`band-attack-val-${i}`).textContent = `${e.target.value} ms`;
        };
        
        // Release
        document.getElementById(`band-release-${i}`).oninput = (e) => {
            dynamicEQ.setBandRelease(i, parseInt(e.target.value));
            document.getElementById(`band-release-val-${i}`).textContent = `${e.target.value} ms`;
        };
    }
    
    // Mix control
    document.getElementById('mix-control').oninput = (e) => {
        dynamicEQ.setMix(parseInt(e.target.value) / 100);
        document.getElementById('mix-val').textContent = `${e.target.value}%`;
    };
    
    function updateUIFromDynamicEQ() {
        for (let i = 0; i < 4; i++) {
            document.getElementById(`band-freq-${i}`).value = dynamicEQ.bands[i].frequency;
            document.getElementById(`band-freq-val-${i}`).textContent = `${dynamicEQ.bands[i].frequency} Hz`;
            
            document.getElementById(`band-q-${i}`).value = dynamicEQ.bands[i].Q;
            document.getElementById(`band-q-val-${i}`).textContent = dynamicEQ.bands[i].Q.toFixed(1);
            
            document.getElementById(`band-threshold-${i}`).value = dynamicEQ.bands[i].threshold;
            document.getElementById(`band-threshold-val-${i}`).textContent = `${dynamicEQ.bands[i].threshold} dB`;
            
            document.getElementById(`band-range-${i}`).value = dynamicEQ.bands[i].range;
            document.getElementById(`band-range-val-${i}`).textContent = `${dynamicEQ.bands[i].range} dB`;
            
            document.getElementById(`band-enable-${i}`).checked = dynamicEQ.bands[i].enabled;
        }
    }
    
    // Update gain reduction meters
    function updateGRMeters() {
        for (let i = 0; i < 4; i++) {
            const gr = dynamicEQ.getBandGainReduction(i);
            document.getElementById(`band-gr-${i}`).textContent = `${gr.toFixed(1)} dB`;
        }
        requestAnimationFrame(updateGRMeters);
    }
    updateGRMeters();
    
    return dynamicEQ;
}

export { DynamicEQ };
export default DynamicEQ;