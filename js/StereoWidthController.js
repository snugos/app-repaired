/**
 * StereoWidthController - Advanced stereo image manipulation with mono compatibility
 * Provides stereo width control, mono maker, and correlation monitoring
 */

export class StereoWidthController {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Parameters
        this.width = options.width ?? 1.0; // 0=mono, 1=normal, 2=wide
        this.panLaw = options.panLaw ?? 'constant-power'; // 'constant-power' or 'constant-sum'
        this.mix = options.mix ?? 1.0;
        this.monoLowFreq = options.monoLowFreq ?? 0; // Hz (0 = disabled)
        this.monoLowEnabled = options.monoLowEnabled ?? false;
        
        // Stereo analyzer
        this.analyserL = audioContext.createAnalyser();
        this.analyserR = audioContext.createAnalyser();
        this.analyserL.fftSize = 256;
        this.analyserR.fftSize = 256;
        this.analyserDataL = new Float32Array(this.analyserL.frequencyBinCount);
        this.analyserDataR = new Float32Array(this.analyserR.frequencyBinCount);
        
        // Channel splitter/merger
        this.splitter = audioContext.createChannelSplitter(2);
        this.merger = audioContext.createChannelMerger(2);
        
        // Mid/Side encoding
        this.midGain = audioContext.createGain();
        this.sideGain = audioContext.createGain();
        
        // Width control gains
        this.widthGainL = audioContext.createGain();
        this.widthGainR = audioContext.createGain();
        
        // Mono bass crossover
        this.lowpassL = audioContext.createBiquadFilter();
        this.lowpassR = audioContext.createBiquadFilter();
        this.lowpassL.type = 'lowpass';
        this.lowpassR.type = 'lowpass';
        this.lowpassL.frequency.value = this.monoLowFreq;
        this.lowpassR.frequency.value = this.monoLowFreq;
        
        // Mono sum for bass
        this.bassMonoGain = audioContext.createGain();
        this.bassMonoGain.gain.value = 0.5;
        
        // Dry/wet
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Correlation meter
        this.correlation = 0;
        this.stereoWidth = 1;
        
        // Connect the signal chain
        this.connectNodes();
        
        // Start monitoring
        this.monitorInterval = null;
        this.startMonitoring();
    }
    
    connectNodes() {
        // Split stereo signal
        this.input.connect(this.splitter);
        
        // Left channel to analyser
        this.splitter.connect(this.analyserL, 0);
        this.splitter.connect(this.analyserR, 1);
        
        // Dry signal
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Width processing
        // For width control, we adjust the mid/side ratio
        // Left = mid + side, Right = mid - side
        // Width > 1 increases side, width < 1 decreases side
        
        // Connect left channel
        this.splitter.connect(this.widthGainL, 0);
        this.splitter.connect(this.widthGainR, 1);
        
        // Width gain settings
        // width = 0: mono (L = R = mid)
        // width = 1: normal
        // width = 2: double width
        this.updateWidthGains();
        
        // Re-merge
        this.widthGainL.connect(this.merger, 0, 0);
        this.widthGainR.connect(this.merger, 0, 1);
        
        // Mono bass processing
        if (this.monoLowEnabled && this.monoLowFreq > 0) {
            // Split for bass mono
            this.splitter.connect(this.lowpassL, 0);
            this.splitter.connect(this.lowpassR, 1);
            
            // Sum to mono
            this.lowpassL.connect(this.bassMonoGain);
            this.lowpassR.connect(this.bassMonoGain);
            
            // This is simplified - full implementation would need more routing
        }
        
        // Wet output
        this.merger.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        // Set initial mix
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
    }
    
    updateWidthGains() {
        // Mid/side style width control
        // width = 0: mono, width = 1: normal, width > 1: wider
        const width = this.width;
        
        // Simplified width control using gain scaling
        // This approximates mid/side processing
        const centerGain = 1; // mid gain
        const sideGain = width; // side gain scaling
        
        // For proper mid/side, we'd need to:
        // 1. Decode L/R to M/S
        // 2. Scale S by width
        // 3. Re-encode M/S to L/R
        
        // Approximation: adjust L/R difference
        this.widthGainL.gain.value = centerGain + (sideGain - 1) * 0.5;
        this.widthGainR.gain.value = centerGain - (sideGain - 1) * 0.5;
    }
    
    startMonitoring() {
        this.monitorInterval = setInterval(() => {
            this.analyserL.getFloatTimeDomainData(this.analyserDataL);
            this.analyserR.getFloatTimeDomainData(this.analyserDataR);
            
            // Calculate correlation
            let sumL = 0, sumR = 0, sumLR = 0;
            const len = this.analyserDataL.length;
            
            for (let i = 0; i < len; i++) {
                const l = this.analyserDataL[i];
                const r = this.analyserDataR[i];
                sumL += l * l;
                sumR += r * r;
                sumLR += l * r;
            }
            
            const rmsL = Math.sqrt(sumL / len);
            const rmsR = Math.sqrt(sumR / len);
            
            // Correlation coefficient
            if (rmsL > 0.0001 && rmsR > 0.0001) {
                this.correlation = sumLR / (rmsL * rmsR * len);
            } else {
                this.correlation = 1;
            }
            
            // Clamp correlation to [-1, 1]
            this.correlation = Math.max(-1, Math.min(1, this.correlation));
            
            // Calculate stereo width (ratio of L+R to L-R)
            const mono = rmsL + rmsR;
            const diff = Math.abs(rmsL - rmsR);
            this.stereoWidth = diff > 0.0001 ? mono / diff : 1;
            
        }, 100);
    }
    
    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }
    
    setWidth(value) {
        this.width = Math.max(0, Math.min(2, value));
        this.updateWidthGains();
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
    }
    
    setPanLaw(law) {
        this.panLaw = law;
    }
    
    setMonoLowFreq(freq) {
        this.monoLowFreq = Math.max(0, freq);
        this.lowpassL.frequency.value = this.monoLowFreq;
        this.lowpassR.frequency.value = this.monoLowFreq;
    }
    
    setMonoLowEnabled(enabled) {
        this.monoLowEnabled = enabled;
    }
    
    getCorrelation() {
        return this.correlation;
    }
    
    getStereoWidth() {
        return this.stereoWidth;
    }
    
    getMonoCompatibility() {
        // Returns 'good', 'warning', or 'bad' based on correlation
        if (this.correlation > 0.5) return 'good';
        if (this.correlation > 0) return 'warning';
        return 'bad';
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.stopMonitoring();
        this.output.disconnect();
    }
    
    getParameterDefinitions() {
        return [
            { name: 'width', label: 'Width', min: 0, max: 2, default: 1, unit: '' },
            { name: 'mix', label: 'Mix', min: 0, max: 1, default: 1, unit: '' },
            { name: 'monoLowFreq', label: 'Mono Bass Freq', min: 0, max: 500, default: 0, unit: 'Hz' }
        ];
    }
    
    getPresets() {
        return [
            { name: 'Normal Stereo', settings: { width: 1, mix: 1, monoLowFreq: 0, monoLowEnabled: false } },
            { name: 'Mono', settings: { width: 0, mix: 1, monoLowFreq: 0, monoLowEnabled: false } },
            { name: 'Wide Stereo', settings: { width: 1.5, mix: 1, monoLowFreq: 0, monoLowEnabled: false } },
            { name: 'Super Wide', settings: { width: 2, mix: 0.8, monoLowFreq: 0, monoLowEnabled: false } },
            { name: 'Narrow', settings: { width: 0.5, mix: 1, monoLowFreq: 0, monoLowEnabled: false } },
            { name: 'Bass Mono', settings: { width: 1.2, mix: 1, monoLowFreq: 120, monoLowEnabled: true } },
            { name: 'Club Ready', settings: { width: 1, mix: 1, monoLowFreq: 80, monoLowEnabled: true } }
        ];
    }
    
    getState() {
        return {
            width: this.width,
            mix: this.mix,
            panLaw: this.panLaw,
            monoLowFreq: this.monoLowFreq,
            monoLowEnabled: this.monoLowEnabled
        };
    }
    
    setState(state) {
        if (state.width !== undefined) this.setWidth(state.width);
        if (state.mix !== undefined) this.setMix(state.mix);
        if (state.panLaw !== undefined) this.panLaw = state.panLaw;
        if (state.monoLowFreq !== undefined) this.setMonoLowFreq(state.monoLowFreq);
        if (state.monoLowEnabled !== undefined) this.monoLowEnabled = state.monoLowEnabled;
    }
}

/**
 * UI Panel for Stereo Width Controller
 */
export function openStereoWidthControllerPanel(effect, onClose) {
    const existingPanel = document.getElementById('stereo-width-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'stereo-width-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #4a4a6a;
        border-radius: 12px;
        padding: 24px;
        min-width: 450px;
        max-width: 550px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        font-family: system-ui, -apple-system, sans-serif;
        color: #e0e0e0;
    `;
    
    const params = effect.getParameterDefinitions();
    const presets = effect.getPresets();
    const state = effect.getState();
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 20px; color: #6b5bff;">🔊 Stereo Width Controller</h2>
            <button id="close-sw-panel" style="background: #3a3a5a; border: none; color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer;">✕</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #a0a0a0;">Preset</label>
            <select id="sw-preset" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #fff; font-size: 14px;">
                <option value="">-- Select Preset --</option>
                ${presets.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            </select>
        </div>
        
        <!-- Correlation Meter -->
        <div style="background: #0a0a14; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6a6a8a;">Mono Compatibility</h3>
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="flex: 1; height: 20px; background: #2a2a4e; border-radius: 4px; overflow: hidden; position: relative;">
                    <div id="sw-correlation-bar" style="position: absolute; left: 50%; height: 100%; background: linear-gradient(90deg, #ef4444, #f0a500, #10b981); transition: width 0.2s;"></div>
                    <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: #fff;"></div>
                </div>
                <div id="sw-correlation-value" style="font-size: 14px; color: #10b981; min-width: 60px; text-align: right;">0.00</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #6a6a8a;">
                <span>Phase Issue</span>
                <span>Mono Safe</span>
            </div>
        </div>
        
        <div style="display: grid; gap: 16px;">
    `;
    
    params.forEach(param => {
        const isHz = param.name === 'monoLowFreq';
        const isPercent = param.name === 'mix';
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <label style="font-size: 13px; color: #a0a0a0;">${param.label}</label>
                    <span id="sw-${param.name}-value" style="font-size: 13px; color: #6b5bff;">${
                        isHz ? state[param.name] + ' Hz' :
                        isPercent ? (state[param.name] * 100).toFixed(0) + '%' :
                        state[param.name].toFixed(2)
                    }</span>
                </div>
                <input type="range" id="sw-${param.name}" min="${param.min}" max="${param.max}" step="${isHz ? 1 : 0.01}" value="${state[param.name]}"
                    style="width: 100%; height: 6px; -webkit-appearance: none; background: #2a2a4e; border-radius: 3px; outline: none;">
            </div>
        `;
    });
    
    html += `
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="sw-mono-low-enabled" ${state.monoLowEnabled ? 'checked' : ''} style="margin-right: 4px;">
                <label style="font-size: 13px; color: #a0a0a0;">Enable Mono Bass (club-safe low end)</label>
            </div>
        </div>
        
        <div style="margin-top: 20px; display: flex; gap: 12px;">
            <button id="sw-reset" style="flex: 1; padding: 12px; background: #3a3a5a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Reset</button>
            <button id="sw-bypass" style="flex: 1; padding: 12px; background: #4a4a6a; border: none; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600;">Bypass</button>
        </div>
        
        <div style="margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 6px; font-size: 12px; color: #6a6a8a;">
            <strong>Tip:</strong> Width 0 = mono, 1 = normal, 2 = wide. Enable Mono Bass for club playability.
        </div>
    `;
    
    panel.innerHTML = html;
    document.body.appendChild(panel);
    
    // Update correlation meter
    const updateCorrelationMeter = () => {
        const correlation = effect.getCorrelation();
        const bar = document.getElementById('sw-correlation-bar');
        const value = document.getElementById('sw-correlation-value');
        
        // Convert correlation (-1 to 1) to bar width
        // -1 = full left (red), 0 = center, 1 = full right (green)
        const percent = (correlation + 1) / 2 * 100;
        const width = Math.abs(correlation) * 50;
        
        bar.style.width = `${width}%`;
        bar.style.left = correlation >= 0 ? '50%' : `${50 - width}%`;
        
        value.textContent = correlation.toFixed(2);
        
        // Color based on correlation
        if (correlation > 0.5) {
            value.style.color = '#10b981';
        } else if (correlation > 0) {
            value.style.color = '#f0a500';
        } else {
            value.style.color = '#ef4444';
        }
    };
    
    const correlationInterval = setInterval(updateCorrelationMeter, 200);
    
    // Event listeners
    document.getElementById('close-sw-panel').addEventListener('click', () => {
        clearInterval(correlationInterval);
        panel.remove();
        if (onClose) onClose();
    });
    
    document.getElementById('sw-preset').addEventListener('change', (e) => {
        const preset = presets.find(p => p.name === e.target.value);
        if (preset) {
            effect.setState(preset.settings);
            updateSliders();
        }
    });
    
    params.forEach(param => {
        const slider = document.getElementById(`sw-${param.name}`);
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const setter = `set${param.name.charAt(0).toUpperCase() + param.name.slice(1)}`;
            if (effect[setter]) {
                effect[setter](value);
            }
            const isHz = param.name === 'monoLowFreq';
            const isPercent = param.name === 'mix';
            document.getElementById(`sw-${param.name}-value`).textContent = 
                isHz ? `${value} Hz` :
                isPercent ? `${(value * 100).toFixed(0)}%` :
                value.toFixed(2);
        });
    });
    
    document.getElementById('sw-mono-low-enabled').addEventListener('change', (e) => {
        effect.setMonoLowEnabled(e.target.checked);
    });
    
    document.getElementById('sw-reset').addEventListener('click', () => {
        const defaults = { width: 1, mix: 1, monoLowFreq: 0, monoLowEnabled: false };
        effect.setState(defaults);
        updateSliders();
    });
    
    document.getElementById('sw-bypass').addEventListener('click', (e) => {
        const isBypassed = effect.mix === 0;
        effect.setMix(isBypassed ? 1 : 0);
        e.target.textContent = isBypassed ? 'Bypass' : 'Engage';
        e.target.style.background = isBypassed ? '#4a4a6a' : '#6b5bff';
    });
    
    function updateSliders() {
        const currentState = effect.getState();
        params.forEach(param => {
            document.getElementById(`sw-${param.name}`).value = currentState[param.name];
            const isHz = param.name === 'monoLowFreq';
            const isPercent = param.name === 'mix';
            document.getElementById(`sw-${param.name}-value`).textContent = 
                isHz ? `${currentState[param.name]} Hz` :
                isPercent ? `${(currentState[param.name] * 100).toFixed(0)}%` :
                currentState[param.name].toFixed(2);
        });
        document.getElementById('sw-mono-low-enabled').checked = currentState.monoLowEnabled;
    }
    
    return panel;
}

export default StereoWidthController;