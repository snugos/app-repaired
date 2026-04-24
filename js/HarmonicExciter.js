/**
 * Harmonic Exciter - Add harmonic content for brightness enhancement
 * Creates high-frequency harmonics to add presence and sparkle
 */

export class HarmonicExciter {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Parameters
        this.drive = options.drive ?? 2;
        this.frequency = options.frequency ?? 2000; // Hz, crossover frequency
        this.mix = options.mix ?? 0.5;
        this.outputGain = options.outputGain ?? 1;
        this.mode = options.mode ?? 'odd'; // 'odd', 'even', 'both'
        this.harmoAmount = options.harmoAmount ?? 0.7;
        
        // Audio nodes
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Crossover filters
        this.lowpass = audioContext.createBiquadFilter();
        this.highpass = audioContext.createBiquadFilter();
        
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.value = this.frequency;
        this.lowpass.Q.value = 1;
        
        this.highpass.type = 'highpass';
        this.highpass.frequency.value = this.frequency;
        this.highpass.Q.value = 1;
        
        // Dry path
        this.dryGain = audioContext.createGain();
        this.dryGain.gain.value = 1 - this.mix;
        
        // Wet path
        this.wetGain = audioContext.createGain();
        this.wetGain.gain.value = this.mix;
        
        // Distortion for harmonic generation
        this.distortion = audioContext.createWaveShaper();
        this.distortion.curve = this.createDistortionCurve();
        this.distortion.oversample = '4x';
        
        // Output filter to tame harshness
        this.outputFilter = audioContext.createBiquadFilter();
        this.outputFilter.type = 'highshelf';
        this.outputFilter.frequency.value = 8000;
        this.outputFilter.gain.value = -3;
        
        // Metering
        this.inputMeter = audioContext.createAnalyser();
        this.outputMeter = audioContext.createAnalyser();
        this.inputMeter.fftSize = 256;
        this.outputMeter.fftSize = 256;
        
        this.setupRouting();
        this.updateParameters();
        
        this.enabled = true;
    }
    
    createDistortionCurve() {
        const samples = 256;
        const curve = new Float32Array(samples);
        const drive = this.drive;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            
            let shaped;
            
            if (this.mode === 'odd') {
                // Odd harmonics (tanh-like)
                shaped = Math.tanh(x * drive);
            } else if (this.mode === 'even') {
                // Even harmonics (soft saturation with DC offset)
                shaped = (Math.abs(x + 0.1) - Math.abs(x - 0.1)) * drive / 2;
            } else {
                // Both
                shaped = Math.tanh(x * drive) * 0.7 + 
                         (Math.abs(x + 0.1) - Math.abs(x - 0.1)) * 0.3;
            }
            
            curve[i] = shaped * this.harmoAmount;
        }
        
        return curve;
    }
    
    setupRouting() {
        // Input -> crossover split
        this.input.connect(this.inputMeter);
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // High band -> distortion -> wet path
        this.input.connect(this.highpass);
        this.highpass.connect(this.distortion);
        this.distortion.connect(this.outputFilter);
        this.outputFilter.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        // Low band passes through clean
        this.input.connect(this.lowpass);
        this.lowpass.connect(this.output);
        
        // Output metering
        this.output.connect(this.outputMeter);
    }
    
    updateParameters() {
        this.lowpass.frequency.value = this.frequency;
        this.highpass.frequency.value = this.frequency;
        
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
        
        this.output.gain.value = this.outputGain;
        
        // Recreate distortion curve with new parameters
        this.distortion.curve = this.createDistortionCurve();
    }
    
    setDrive(value) {
        this.drive = Math.max(1, Math.min(10, value));
        this.updateParameters();
    }
    
    setFrequency(hz) {
        this.frequency = Math.max(500, Math.min(10000, hz));
        this.updateParameters();
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setOutputGain(value) {
        this.outputGain = Math.max(0, Math.min(2, value));
        this.output.gain.value = this.outputGain;
    }
    
    setMode(mode) {
        if (['odd', 'even', 'both'].includes(mode)) {
            this.mode = mode;
            this.updateParameters();
        }
    }
    
    setHarmonicAmount(value) {
        this.harmoAmount = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    enable() {
        this.enabled = true;
    }
    
    disable() {
        this.enabled = false;
    }
    
    getInputLevel() {
        const dataArray = new Float32Array(this.inputMeter.fftSize);
        this.inputMeter.getFloatTimeDomainData(dataArray);
        
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
            max = Math.max(max, Math.abs(dataArray[i]));
        }
        
        return 20 * Math.log10(max + 0.0001);
    }
    
    getOutputLevel() {
        const dataArray = new Float32Array(this.outputMeter.fftSize);
        this.outputMeter.getFloatTimeDomainData(dataArray);
        
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
            max = Math.max(max, Math.abs(dataArray[i]));
        }
        
        return 20 * Math.log10(max + 0.0001);
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
    
    getParameters() {
        return {
            drive: this.drive,
            frequency: this.frequency,
            mix: this.mix,
            outputGain: this.outputGain,
            mode: this.mode,
            harmoAmount: this.harmoAmount,
            enabled: this.enabled,
            inputLevel: this.getInputLevel(),
            outputLevel: this.getOutputLevel()
        };
    }
    
    setParameters(params) {
        if (params.drive !== undefined) this.setDrive(params.drive);
        if (params.frequency !== undefined) this.setFrequency(params.frequency);
        if (params.mix !== undefined) this.setMix(params.mix);
        if (params.outputGain !== undefined) this.setOutputGain(params.outputGain);
        if (params.mode !== undefined) this.setMode(params.mode);
        if (params.harmoAmount !== undefined) this.setHarmonicAmount(params.harmoAmount);
    }
    
    destroy() {
        this.input.disconnect();
        this.output.disconnect();
        this.dryGain.disconnect();
        this.wetGain.disconnect();
        this.lowpass.disconnect();
        this.highpass.disconnect();
        this.distortion.disconnect();
        this.outputFilter.disconnect();
        this.inputMeter.disconnect();
        this.outputMeter.disconnect();
    }
}

// Factory function
export function createHarmonicExciter(audioContext, options = {}) {
    return new HarmonicExciter(audioContext, options);
}

// Presets
export const EXCITER_PRESETS = {
    subtle: {
        drive: 1.5,
        frequency: 4000,
        mix: 0.2,
        outputGain: 1,
        mode: 'odd',
        harmoAmount: 0.5
    },
    presence: {
        drive: 2,
        frequency: 3000,
        mix: 0.4,
        outputGain: 1,
        mode: 'odd',
        harmoAmount: 0.7
    },
    sparkle: {
        drive: 3,
        frequency: 5000,
        mix: 0.5,
        outputGain: 1,
        mode: 'odd',
        harmoAmount: 0.8
    },
    air: {
        drive: 2,
        frequency: 8000,
        mix: 0.3,
        outputGain: 1.1,
        mode: 'both',
        harmoAmount: 0.6
    },
    warmth: {
        drive: 2,
        frequency: 1500,
        mix: 0.35,
        outputGain: 1,
        mode: 'even',
        harmoAmount: 0.6
    },
    saturate: {
        drive: 4,
        frequency: 2000,
        mix: 0.6,
        outputGain: 0.9,
        mode: 'both',
        harmoAmount: 0.8
    }
};

// UI Panel
export function createExciterPanel(exciter, appServices) {
    const container = document.createElement('div');
    container.className = 'harmonic-exciter-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 300px;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Harmonic Exciter';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Drive control
    const driveGroup = createControlGroup('Drive', 1, 10, exciter.drive, 0.1, (value) => {
        exciter.setDrive(value);
    });
    container.appendChild(driveGroup);
    
    // Frequency control
    const freqGroup = createControlGroup('Crossover (Hz)', 500, 10000, exciter.frequency, 100, (value) => {
        exciter.setFrequency(value);
    }, 'log');
    container.appendChild(freqGroup);
    
    // Mix control
    const mixGroup = createControlGroup('Mix', 0, 1, exciter.mix, 0.01, (value) => {
        exciter.setMix(value);
    });
    container.appendChild(mixGroup);
    
    // Output gain control
    const outputGroup = createControlGroup('Output', 0, 2, exciter.outputGain, 0.1, (value) => {
        exciter.setOutputGain(value);
    });
    container.appendChild(outputGroup);
    
    // Harmonic amount
    const harmoGroup = createControlGroup('Harmonics', 0, 1, exciter.harmoAmount, 0.05, (value) => {
        exciter.setHarmonicAmount(value);
    });
    container.appendChild(harmoGroup);
    
    // Mode selection
    const modeContainer = document.createElement('div');
    modeContainer.style.cssText = 'margin-bottom: 16px;';
    modeContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Mode</div>
        <div style="display: flex; gap: 8px;">
            <button class="mode-btn" data-mode="odd" style="flex: 1; padding: 8px; background: ${exciter.mode === 'odd' ? '#3b82f6' : '#374151'}; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Odd
            </button>
            <button class="mode-btn" data-mode="even" style="flex: 1; padding: 8px; background: ${exciter.mode === 'even' ? '#3b82f6' : '#374151'}; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Even
            </button>
            <button class="mode-btn" data-mode="both" style="flex: 1; padding: 8px; background: ${exciter.mode === 'both' ? '#3b82f6' : '#374151'}; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Both
            </button>
        </div>
    `;
    container.appendChild(modeContainer);
    
    // Add mode click handlers
    modeContainer.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            exciter.setMode(btn.dataset.mode);
            modeContainer.querySelectorAll('.mode-btn').forEach(b => {
                b.style.background = b.dataset.mode === exciter.mode ? '#3b82f6' : '#374151';
            });
        });
    });
    
    // Meter
    const meterContainer = document.createElement('div');
    meterContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    meterContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Input</span>
            <span id="inputLevel">-∞ dB</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
            <span>Output</span>
            <span id="outputLevel">-∞ dB</span>
        </div>
    `;
    container.appendChild(meterContainer);
    
    // Presets
    const presetsContainer = document.createElement('div');
    presetsContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Presets</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${Object.keys(EXCITER_PRESETS).map(name => `
                <button class="preset-btn" data-preset="${name}" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">
                    ${name.charAt(0).toUpperCase() + name.slice(1)}
                </button>
            `).join('')}
        </div>
    `;
    container.appendChild(presetsContainer);
    
    // Preset click handlers
    presetsContainer.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = EXCITER_PRESETS[btn.dataset.preset];
            exciter.setParameters(preset);
            
            // Update UI
            driveGroup.querySelector('input').value = preset.drive;
            freqGroup.querySelector('input').value = preset.frequency;
            mixGroup.querySelector('input').value = preset.mix;
            outputGroup.querySelector('input').value = preset.outputGain;
            harmoGroup.querySelector('input').value = preset.harmoAmount;
            
            // Update mode buttons
            modeContainer.querySelectorAll('.mode-btn').forEach(b => {
                b.style.background = b.dataset.mode === preset.mode ? '#3b82f6' : '#374151';
            });
            
            // Update value displays
            driveGroup.querySelector('span:last-of-type').textContent = preset.drive.toFixed(1);
            freqGroup.querySelector('span:last-of-type').textContent = preset.frequency;
            mixGroup.querySelector('span:last-of-type').textContent = preset.mix.toFixed(2);
            outputGroup.querySelector('span:last-of-type').textContent = preset.outputGain.toFixed(1);
            harmoGroup.querySelector('span:last-of-type').textContent = preset.harmoAmount.toFixed(2);
        });
    });
    
    // Update meters
    const meterInterval = setInterval(() => {
        document.getElementById('inputLevel').textContent = `${exciter.getInputLevel().toFixed(1)} dB`;
        document.getElementById('outputLevel').textContent = `${exciter.getOutputLevel().toFixed(1)} dB`;
    }, 100);
    
    // Cleanup
    container.destroy = () => {
        clearInterval(meterInterval);
    };
    
    return container;
}

function createControlGroup(label, min, max, value, step, onChange, scale = 'linear') {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 12px;';
    
    group.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
            <span>${label}</span>
            <span id="${label.replace(/\s+/g, '')}Value">${value}</span>
        </div>
        <input type="range" min="${min}" max="${max}" value="${value}" step="${step}" style="width: 100%;">
    `;
    
    const input = group.querySelector('input');
    const valueDisplay = group.querySelector('span:last-of-type');
    
    input.addEventListener('input', (e) => {
        let val = parseFloat(e.target.value);
        
        if (scale === 'log') {
            // Convert linear slider to log scale
            const ratio = (val - min) / (max - min);
            val = min * Math.pow(max / min, ratio);
        }
        
        onChange(val);
        
        if (scale === 'log') {
            valueDisplay.textContent = Math.round(val);
        } else if (step < 1) {
            valueDisplay.textContent = val.toFixed(2);
        } else {
            valueDisplay.textContent = val.toFixed(1);
        }
    });
    
    return group;
}

export default HarmonicExciter;