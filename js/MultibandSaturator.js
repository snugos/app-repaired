/**
 * Multiband Saturator - Add saturation per frequency band
 * Provides harmonic saturation with independent control over frequency bands
 */

class MultibandSaturator {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Configuration
        this.numBands = options.numBands || 4;
        this.crossoverFrequencies = options.crossoverFrequencies || [200, 1000, 4000];
        
        // Bands
        this.bands = [];
        this.bandFilters = [];
        this.saturators = [];
        this.bandGains = [];
        this.bandMixes = [];
        
        // Create multiband structure
        this.createBands();
        
        // Mix control
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain.gain.value = 0;
        this.wetGain.gain.value = 1;
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Presets
        this.presets = {
            'Warm Saturation': {
                bands: [
                    { drive: 0.3, tone: 0.4, mix: 0.8, type: 'tape' },
                    { drive: 0.2, tone: 0.5, mix: 0.6, type: 'tube' },
                    { drive: 0.1, tone: 0.6, mix: 0.4, type: 'tube' },
                    { drive: 0.05, tone: 0.7, mix: 0.3, type: 'soft' }
                ],
                crossover: [150, 800, 3000],
                globalMix: 0.4
            },
            'Vintage Tape': {
                bands: [
                    { drive: 0.5, tone: 0.3, mix: 0.9, type: 'tape' },
                    { drive: 0.4, tone: 0.4, mix: 0.7, type: 'tape' },
                    { drive: 0.3, tone: 0.5, mix: 0.5, type: 'tape' },
                    { drive: 0.2, tone: 0.6, mix: 0.4, type: 'tape' }
                ],
                crossover: [200, 1000, 4000],
                globalMix: 0.5
            },
            'Punchy Drums': {
                bands: [
                    { drive: 0.6, tone: 0.3, mix: 0.9, type: 'hard' },
                    { drive: 0.3, tone: 0.5, mix: 0.5, type: 'tube' },
                    { drive: 0.2, tone: 0.6, mix: 0.4, type: 'soft' },
                    { drive: 0.1, tone: 0.7, mix: 0.2, type: 'soft' }
                ],
                crossover: [80, 400, 2000],
                globalMix: 0.6
            },
            'Vocal Warmth': {
                bands: [
                    { drive: 0.3, tone: 0.4, mix: 0.7, type: 'tube' },
                    { drive: 0.2, tone: 0.5, mix: 0.8, type: 'tube' },
                    { drive: 0.1, tone: 0.6, mix: 0.5, type: 'soft' },
                    { drive: 0.05, tone: 0.7, mix: 0.3, type: 'soft' }
                ],
                crossover: [150, 800, 3000],
                globalMix: 0.35
            },
            'Bass Overdrive': {
                bands: [
                    { drive: 0.7, tone: 0.2, mix: 0.9, type: 'hard' },
                    { drive: 0.3, tone: 0.4, mix: 0.5, type: 'tube' },
                    { drive: 0.1, tone: 0.6, mix: 0.2, type: 'soft' },
                    { drive: 0.05, tone: 0.7, mix: 0.1, type: 'soft' }
                ],
                crossover: [100, 500, 2000],
                globalMix: 0.5
            },
            'High Sparkle': {
                bands: [
                    { drive: 0.1, tone: 0.5, mix: 0.3, type: 'soft' },
                    { drive: 0.15, tone: 0.6, mix: 0.4, type: 'soft' },
                    { drive: 0.25, tone: 0.7, mix: 0.6, type: 'tube' },
                    { drive: 0.35, tone: 0.8, mix: 0.8, type: 'tube' }
                ],
                crossover: [300, 1500, 5000],
                globalMix: 0.4
            },
            'Heavy Distortion': {
                bands: [
                    { drive: 0.8, tone: 0.3, mix: 0.95, type: 'hard' },
                    { drive: 0.7, tone: 0.4, mix: 0.9, type: 'hard' },
                    { drive: 0.6, tone: 0.5, mix: 0.8, type: 'hard' },
                    { drive: 0.5, tone: 0.6, mix: 0.7, type: 'hard' }
                ],
                crossover: [200, 1000, 4000],
                globalMix: 0.7
            },
            'Smooth Analog': {
                bands: [
                    { drive: 0.25, tone: 0.4, mix: 0.6, type: 'tube' },
                    { drive: 0.2, tone: 0.5, mix: 0.5, type: 'tube' },
                    { drive: 0.15, tone: 0.6, mix: 0.4, type: 'tube' },
                    { drive: 0.1, tone: 0.7, mix: 0.3, type: 'tube' }
                ],
                crossover: [180, 900, 3500],
                globalMix: 0.35
            }
        };
        
        this.saturationTypes = ['soft', 'tube', 'tape', 'hard', 'fuzz', 'rectify'];
    }
    
    createBands() {
        // Create crossover filters
        this.lowpass = this.audioContext.createBiquadFilter();
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.value = this.crossoverFrequencies[0];
        this.lowpass.Q.value = 0.707;
        
        this.highpassFilters = [];
        this.bandpassFilters = [];
        
        // Create highpass filters
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
                bandpass.Q.value = 0.707;
                this.bandpassFilters.push(bandpass);
            }
        }
        
        // Create saturation and gain for each band
        for (let i = 0; i < this.numBands; i++) {
            // Create wave shaper for saturation
            const shaper = this.audioContext.createWaveShaper();
            shaper.curve = this.createSaturationCurve(0.5, 'soft');
            shaper.oversample = '4x';
            
            // Create gain for band output
            const gain = this.audioContext.createGain();
            gain.gain.value = 1;
            
            // Create dry/wet mix for band
            const dryBand = this.audioContext.createGain();
            const wetBand = this.audioContext.createGain();
            dryBand.gain.value = 0.3;
            wetBand.gain.value = 0.7;
            
            this.saturators.push(shaper);
            this.bandGains.push(gain);
            this.bandMixes.push({ dry: dryBand, wet: wetBand });
            
            // Connect band
            shaper.connect(wetBand);
            wetBand.connect(gain);
            gain.connect(this.wetGain);
            this.wetGain.connect(this.output);
            
            this.bands.push({
                drive: 0.5,
                tone: 0.5,
                mix: 0.7,
                type: 'soft',
                enabled: true
            });
        }
        
        // Connect filters to saturators
        // Low band
        this.input.connect(this.lowpass);
        this.lowpass.connect(this.saturators[0]);
        
        // Middle bands
        for (let i = 0; i < this.bandpassFilters.length; i++) {
            this.input.connect(this.highpassFilters[i]);
            this.highpassFilters[i].connect(this.bandpassFilters[i]);
            this.bandpassFilters[i].connect(this.saturators[i + 1]);
        }
        
        // High band
        const lastHighpass = this.highpassFilters[this.highpassFilters.length - 1];
        this.input.connect(lastHighpass);
        lastHighpass.connect(this.saturators[this.numBands - 1]);
    }
    
    createSaturationCurve(drive, type) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const k = drive * 100; // Drive amount
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1; // -1 to 1
            
            switch (type) {
                case 'soft':
                    // Soft saturation
                    curve[i] = Math.tanh(x * (1 + k * 0.5));
                    break;
                    
                case 'tube':
                    // Tube-like asymmetric saturation
                    const a = 1 + Math.max(0, x) * k * 0.3;
                    const b = 1 - Math.min(0, x) * k * 0.3;
                    curve[i] = Math.tanh(x * a * b);
                    break;
                    
                case 'tape':
                    // Tape saturation with soft knee
                    if (Math.abs(x) < 0.5) {
                        curve[i] = x * (1 + k * 0.2);
                    } else {
                        curve[i] = Math.sign(x) * (0.5 + 0.5 * Math.tanh((Math.abs(x) - 0.5) * k * 0.5));
                    }
                    break;
                    
                case 'hard':
                    // Hard clipping
                    curve[i] = Math.max(-1, Math.min(1, x * (1 + k * 0.5)));
                    break;
                    
                case 'fuzz':
                    // Fuzz - extreme octave up style
                    curve[i] = Math.tanh(x * x * Math.sign(x) * (1 + k * 0.3));
                    break;
                    
                case 'rectify':
                    // Half-wave rectifier
                    curve[i] = x > 0 ? Math.tanh(x * (1 + k * 0.5)) : x * 0.5;
                    break;
                    
                default:
                    curve[i] = Math.tanh(x * (1 + k * 0.5));
            }
        }
        
        return curve;
    }
    
    setBandDrive(bandIndex, drive) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bands[bandIndex].drive = drive;
            this.saturators[bandIndex].curve = this.createSaturationCurve(drive, this.bands[bandIndex].type);
        }
    }
    
    setBandTone(bandIndex, tone) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bands[bandIndex].tone = tone;
            // Tone affects the output gain (brighter = more high freq content)
            const gainCompensation = 1 - tone * 0.3;
            this.bandGains[bandIndex].gain.value = gainCompensation;
        }
    }
    
    setBandMix(bandIndex, mix) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bands[bandIndex].mix = mix;
            this.bandMixes[bandIndex].dry.gain.value = 1 - mix;
            this.bandMixes[bandIndex].wet.gain.value = mix;
        }
    }
    
    setBandType(bandIndex, type) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bands[bandIndex].type = type;
            this.saturators[bandIndex].curve = this.createSaturationCurve(this.bands[bandIndex].drive, type);
        }
    }
    
    setBandEnabled(bandIndex, enabled) {
        if (bandIndex >= 0 && bandIndex < this.numBands) {
            this.bands[bandIndex].enabled = enabled;
            this.bandGains[bandIndex].gain.value = enabled ? 1 : 0;
        }
    }
    
    setCrossover(index, frequency) {
        if (index >= 0 && index < this.crossoverFrequencies.length) {
            this.crossoverFrequencies[index] = frequency;
            
            // Update filters
            if (index === 0) {
                this.lowpass.frequency.value = frequency;
            }
            
            this.highpassFilters.forEach((hp, i) => {
                if (i <= index) {
                    hp.frequency.value = this.crossoverFrequencies[i];
                }
            });
            
            this.bandpassFilters.forEach((bp, i) => {
                const low = this.crossoverFrequencies[i];
                const high = this.crossoverFrequencies[i + 1] || low * 2;
                bp.frequency.value = (low + high) / 2;
            });
        }
    }
    
    setGlobalMix(mix) {
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
                this.setBandDrive(i, band.drive);
                this.setBandTone(i, band.tone);
                this.setBandMix(i, band.mix);
                this.setBandType(i, band.type);
            }
        });
        
        // Apply global mix
        this.setGlobalMix(preset.globalMix);
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
}

/**
 * Create Multiband Saturator UI Panel
 */
export function openMultibandSaturatorPanel(services = {}) {
    const { audioContext, masterOutput, container = document.body } = services;
    
    if (!audioContext) {
        console.error('Multiband Saturator: audioContext required');
        return null;
    }
    
    // Create saturator instance
    const saturator = new MultibandSaturator(audioContext);
    
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
        min-width: 650px;
        max-width: 850px;
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
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #e67e22;">🔥 Multiband Saturator</h2>
        <button id="close-btn" style="background: #e67e22; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: white;">✕ Close</button>
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
            ${Object.keys(saturator.presets).map(name => `<option value="${name}">${name}</option>`).join('')}
        </select>
    `;
    panel.appendChild(presetSection);
    
    // Crossover frequencies
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
            <span id="crossover-val-0" style="font-size: 12px; color: #e67e22;">200 Hz</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Crossover 2 (Hz)</label>
            <input type="range" id="crossover-1" min="200" max="2000" value="1000" style="width: 100%;">
            <span id="crossover-val-1" style="font-size: 12px; color: #e67e22;">1000 Hz</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Crossover 3 (Hz)</label>
            <input type="range" id="crossover-2" min="1000" max="10000" value="4000" style="width: 100%;">
            <span id="crossover-val-2" style="font-size: 12px; color: #e67e22;">4000 Hz</span>
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
                <label style="font-size: 11px; color: #a0a0a0;">Drive</label>
                <input type="range" id="band-drive-${i}" min="0" max="100" value="50" style="width: 100%;">
                <span id="band-drive-val-${i}" style="font-size: 11px; color: #e0e0e0;">50%</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Tone</label>
                <input type="range" id="band-tone-${i}" min="0" max="100" value="50" style="width: 100%;">
                <span id="band-tone-val-${i}" style="font-size: 11px; color: #e0e0e0;">50%</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Mix</label>
                <input type="range" id="band-mix-${i}" min="0" max="100" value="70" style="width: 100%;">
                <span id="band-mix-val-${i}" style="font-size: 11px; color: #e0e0e0;">70%</span>
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="font-size: 11px; color: #a0a0a0;">Type</label>
                <select id="band-type-${i}" style="width: 100%; padding: 5px; background: #1a1a2e; border: 1px solid #3a3a5e; border-radius: 4px; color: #e0e0e0;">
                    <option value="soft">Soft</option>
                    <option value="tube">Tube</option>
                    <option value="tape">Tape</option>
                    <option value="hard">Hard</option>
                    <option value="fuzz">Fuzz</option>
                    <option value="rectify">Rectify</option>
                </select>
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
            <label style="font-size: 14px; color: #a0a0a0;">Global Dry/Wet Mix</label>
            <input type="range" id="global-mix-control" min="0" max="100" value="100" style="flex: 1;">
            <span id="global-mix-val" style="font-size: 14px; color: #e67e22; min-width: 50px;">100%</span>
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
            saturator.applyPreset(e.target.value);
            updateUIFromSaturator();
        }
    };
    
    // Crossover controls
    for (let i = 0; i < 3; i++) {
        document.getElementById(`crossover-${i}`).oninput = (e) => {
            saturator.setCrossover(i, parseInt(e.target.value));
            document.getElementById(`crossover-val-${i}`).textContent = `${e.target.value} Hz`;
        };
    }
    
    // Band controls
    for (let i = 0; i < 4; i++) {
        document.getElementById(`band-enable-${i}`).onchange = (e) => {
            saturator.setBandEnabled(i, e.target.checked);
        };
        
        document.getElementById(`band-drive-${i}`).oninput = (e) => {
            saturator.setBandDrive(i, parseInt(e.target.value) / 100);
            document.getElementById(`band-drive-val-${i}`).textContent = `${e.target.value}%`;
        };
        
        document.getElementById(`band-tone-${i}`).oninput = (e) => {
            saturator.setBandTone(i, parseInt(e.target.value) / 100);
            document.getElementById(`band-tone-val-${i}`).textContent = `${e.target.value}%`;
        };
        
        document.getElementById(`band-mix-${i}`).oninput = (e) => {
            saturator.setBandMix(i, parseInt(e.target.value) / 100);
            document.getElementById(`band-mix-val-${i}`).textContent = `${e.target.value}%`;
        };
        
        document.getElementById(`band-type-${i}`).onchange = (e) => {
            saturator.setBandType(i, e.target.value);
        };
    }
    
    // Global mix
    document.getElementById('global-mix-control').oninput = (e) => {
        saturator.setGlobalMix(parseInt(e.target.value) / 100);
        document.getElementById('global-mix-val').textContent = `${e.target.value}%`;
    };
    
    function updateUIFromSaturator() {
        for (let i = 0; i < 4; i++) {
            document.getElementById(`band-drive-${i}`).value = saturator.bands[i].drive * 100;
            document.getElementById(`band-drive-val-${i}`).textContent = `${Math.round(saturator.bands[i].drive * 100)}%`;
            
            document.getElementById(`band-tone-${i}`).value = saturator.bands[i].tone * 100;
            document.getElementById(`band-tone-val-${i}`).textContent = `${Math.round(saturator.bands[i].tone * 100)}%`;
            
            document.getElementById(`band-mix-${i}`).value = saturator.bands[i].mix * 100;
            document.getElementById(`band-mix-val-${i}`).textContent = `${Math.round(saturator.bands[i].mix * 100)}%`;
            
            document.getElementById(`band-type-${i}`).value = saturator.bands[i].type;
            document.getElementById(`band-enable-${i}`).checked = saturator.bands[i].enabled;
        }
        
        for (let i = 0; i < 3; i++) {
            if (saturator.crossoverFrequencies[i]) {
                document.getElementById(`crossover-${i}`).value = saturator.crossoverFrequencies[i];
                document.getElementById(`crossover-val-${i}`).textContent = `${saturator.crossoverFrequencies[i]} Hz`;
            }
        }
    }
    
    return saturator;
}

export { MultibandSaturator };
export default MultibandSaturator;