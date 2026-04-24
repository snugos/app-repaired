/**
 * FrequencyShifter - Linear frequency shifting (not pitch shifting)
 * Shifts all frequencies by a fixed amount using single-sideband modulation
 */

class FrequencyShifter {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isActive = false;
        
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        this.dryNode = audioContext.createGain();
        this.wetNode = audioContext.createGain();
        
        // Create Hilbert transform approximator using allpass filters
        // This creates the 90-degree phase shift needed for single-sideband modulation
        this.hilbertDelay = audioContext.createDelay();
        this.hilbertAllpass = audioContext.createBiquadFilter();
        
        // Quadrature oscillators (carrier 0° and 90° phases)
        this.carrierSin = audioContext.createOscillator();
        this.carrierCos = audioContext.createOscillator();
        
        // Modulation multipliers
        this.modSin = audioContext.createGain();
        this.modCos = audioContext.createGain();
        
        // Add/subtract for up/down shifting
        this.addGain = audioContext.createGain();
        this.subGain = audioContext.createGain();
        
        // Filters
        this.inputFilter = audioContext.createBiquadFilter();
        this.outputFilter = audioContext.createBiquadFilter();
        
        // Parameters
        this.params = {
            shift: 0,              // Hz to shift (positive = up, negative = down)
            mode: 'up',            // 'up', 'down', or 'both'
            mix: 0.5,
            feedback: 0,
            inputFilterFreq: 20000,
            outputFilterFreq: 20000
        };
        
        this.feedbackDelay = audioContext.createDelay();
        this.feedbackGain = audioContext.createGain();
        
        this.setupNodes();
        this.connectNodes();
        this.startOscillators();
    }
    
    setupNodes() {
        // Hilbert transform approximation
        this.hilbertAllpass.type = 'allpass';
        this.hilbertAllpass.frequency.value = 1000;
        this.hilbertAllpass.Q.value = 0.707;
        this.hilbertDelay.delayTime.value = 0.001; // Approximate 90° phase shift
        
        // Carrier oscillators (same frequency, different phases)
        this.carrierSin.type = 'sine';
        this.carrierSin.frequency.value = Math.abs(this.params.shift);
        
        this.carrierCos.type = 'sine';
        this.carrierCos.frequency.value = Math.abs(this.params.shift);
        
        // Start with sin at 0° and cos at 90°
        // We'll use oscillator detuning to create the phase difference
        this.carrierCosDetune = 0; // Will be handled in JavaScript
        
        // Modulation gains
        this.modSin.gain.value = 1;
        this.modCos.gain.value = 1;
        
        // Add/subtract gains
        this.addGain.gain.value = 1;
        this.subGain.gain.value = 1;
        
        // Filters
        this.inputFilter.type = 'lowpass';
        this.inputFilter.frequency.value = this.params.inputFilterFreq;
        
        this.outputFilter.type = 'lowpass';
        this.outputFilter.frequency.value = this.params.outputFilterFreq;
        
        // Feedback
        this.feedbackDelay.delayTime.value = 0.05;
        this.feedbackGain.gain.value = this.params.feedback;
    }
    
    connectNodes() {
        // Input path
        this.inputNode.connect(this.inputFilter);
        this.inputFilter.connect(this.dryNode);
        
        // Hilbert transform (approximate)
        const inputBranch = this.inputFilter;
        
        // Path 1: Direct (for sin modulation)
        inputBranch.connect(this.modSin);
        this.carrierSin.connect(this.modSin.gain);
        
        // Path 2: Delayed/phase-shifted (for cos modulation)
        inputBranch.connect(this.hilbertAllpass);
        this.hilbertAllpass.connect(this.hilbertDelay);
        this.hilbertDelay.connect(this.modCos);
        this.carrierCos.connect(this.modCos.gain);
        
        // Combine for frequency shifting
        // Up-shift: (in * sin + hilbert * cos)
        // Down-shift: (in * sin - hilbert * cos)
        this.modSin.connect(this.addGain);
        this.modCos.connect(this.addGain);
        
        this.modSin.connect(this.subGain);
        this.modCos.connect(this.subGain);
        this.subGain.gain.value = -1; // Invert for subtraction
        
        // Output based on mode
        this.addGain.connect(this.outputFilter);
        this.subGain.connect(this.outputFilter);
        
        // Wet output
        this.outputFilter.connect(this.wetNode);
        this.wetNode.connect(this.outputNode);
        
        // Dry output
        this.dryNode.connect(this.outputNode);
        
        // Feedback loop
        this.outputFilter.connect(this.feedbackDelay);
        this.feedbackDelay.connect(this.feedbackGain);
        this.feedbackGain.connect(this.inputNode);
        
        this.updateMix();
        this.updateMode();
    }
    
    startOscillators() {
        this.carrierSin.start();
        this.carrierCos.start();
    }
    
    updateMix() {
        this.dryNode.gain.value = 1 - this.params.mix;
        this.wetNode.gain.value = this.params.mix;
    }
    
    updateMode() {
        const mode = this.params.mode;
        if (mode === 'up') {
            this.addGain.gain.value = 1;
            this.subGain.gain.value = 0;
        } else if (mode === 'down') {
            this.addGain.gain.value = 0;
            this.subGain.gain.value = 1;
        } else { // both
            this.addGain.gain.value = 0.5;
            this.subGain.gain.value = 0.5;
        }
    }
    
    setParam(name, value) {
        if (this.params.hasOwnProperty(name)) {
            this.params[name] = value;
            if (name === 'mix') {
                this.updateMix();
            } else if (name === 'shift') {
                const absShift = Math.abs(value);
                this.carrierSin.frequency.setValueAtTime(absShift, this.audioContext.currentTime);
                this.carrierCos.frequency.setValueAtTime(absShift, this.audioContext.currentTime);
            } else if (name === 'mode') {
                this.updateMode();
            } else if (name === 'feedback') {
                this.feedbackGain.gain.setValueAtTime(value, this.audioContext.currentTime);
            } else if (name === 'inputFilterFreq') {
                this.inputFilter.frequency.setValueAtTime(value, this.audioContext.currentTime);
            } else if (name === 'outputFilterFreq') {
                this.outputFilter.frequency.setValueAtTime(value, this.audioContext.currentTime);
            }
        }
    }
    
    start() {
        if (this.isActive) return;
        this.isActive = true;
    }
    
    stop() {
        this.isActive = false;
    }
    
    connect(destination) {
        this.outputNode.connect(destination);
    }
    
    disconnect() {
        this.outputNode.disconnect();
    }
    
    getInput() {
        return this.inputNode;
    }
    
    getOutput() {
        return this.outputNode;
    }
}

// Global frequency shifter instance
let frequencyShifterInstance = null;

function openFrequencyShifterPanel() {
    const existingPanel = document.getElementById('frequency-shifter-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'frequency-shifter-panel';
    panel.style.cssText = `
        position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #4a4a6a; border-radius: 8px; padding: 20px;
        width: 450px; z-index: 10000; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #e0e0e0; margin: 0; font-size: 18px;">Frequency Shifter</h2>
            <button id="closeFreqShift" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 8px;">Shift Mode</label>
            <div style="display: flex; gap: 8px;">
                <button class="shift-mode-btn" data-mode="up" style="padding: 8px 20px; background: #4CAF50; border: none; border-radius: 4px; color: white; cursor: pointer;">Up</button>
                <button class="shift-mode-btn" data-mode="down" style="padding: 8px 20px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">Down</button>
                <button class="shift-mode-btn" data-mode="both" style="padding: 8px 20px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">Both</button>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Frequency Shift (Hz)</label>
            <input type="range" id="freqShift" min="-2000" max="2000" value="0" style="width: 100%;">
            <span id="freqShiftVal" style="color: #e0e0e0; font-size: 12px;">0 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Feedback</label>
            <input type="range" id="freqFeedback" min="0" max="90" value="0" style="width: 100%;">
            <span id="freqFeedbackVal" style="color: #e0e0e0; font-size: 12px;">0%</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Input Filter (Hz)</label>
            <input type="range" id="freqInputFilter" min="100" max="20000" value="20000" style="width: 100%;">
            <span id="freqInputFilterVal" style="color: #e0e0e0; font-size: 12px;">20000 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Output Filter (Hz)</label>
            <input type="range" id="freqOutputFilter" min="100" max="20000" value="20000" style="width: 100%;">
            <span id="freqOutputFilterVal" style="color: #e0e0e0; font-size: 12px;">20000 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Mix</label>
            <input type="range" id="freqMix" min="0" max="100" value="50" style="width: 100%;">
            <span id="freqMixVal" style="color: #e0e0e0; font-size: 12px;">50%</span>
        </div>
        
        <div id="freqShiftPresets" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #333;">
            <label style="color: #a0a0a0; font-size: 12px;">Presets</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                <button class="freqshift-preset" data-preset="subtle" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Subtle</button>
                <button class="freqshift-preset" data-preset="thickening" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Thickening</button>
                <button class="freqshift-preset" data-preset="harmonizer" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Harmonizer</button>
                <button class="freqshift-preset" data-preset="metallic" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Metallic</button>
                <button class="freqshift-preset" data-preset="fx" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">FX</button>
                <button class="freqshift-preset" data-preset="extreme" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Extreme</button>
            </div>
        </div>
        
        <div style="margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 4px; font-size: 12px; color: #888;">
            <div>Shift: <span id="shiftDirection" style="color: #e0e0e0;">None</span></div>
            <div>Amount: <span id="shiftAmount" style="color: #e0e0e0;">0 Hz</span></div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Close button
    document.getElementById('closeFreqShift').onclick = () => panel.remove();
    
    // Initialize processor
    if (!frequencyShifterInstance && window.audioContext) {
        frequencyShifterInstance = new FrequencyShifter(window.audioContext);
    }
    
    // Mode buttons
    document.querySelectorAll('.shift-mode-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.shift-mode-btn').forEach(b => {
                b.style.background = '#333';
                b.style.color = '#e0e0e0';
            });
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            
            if (frequencyShifterInstance) {
                frequencyShifterInstance.setParam('mode', btn.dataset.mode);
                updateShiftInfo();
            }
        };
    });
    
    // Parameter sliders
    const sliders = [
        { id: 'freqShift', param: 'shift', display: 'freqShiftVal', suffix: ' Hz', scale: 1 },
        { id: 'freqFeedback', param: 'feedback', display: 'freqFeedbackVal', suffix: '%', scale: 0.01 },
        { id: 'freqInputFilter', param: 'inputFilterFreq', display: 'freqInputFilterVal', suffix: ' Hz', scale: 1 },
        { id: 'freqOutputFilter', param: 'outputFilterFreq', display: 'freqOutputFilterVal', suffix: ' Hz', scale: 1 },
        { id: 'freqMix', param: 'mix', display: 'freqMixVal', suffix: '%', scale: 0.01 }
    ];
    
    sliders.forEach(({ id, param, display, suffix, scale }) => {
        const slider = document.getElementById(id);
        slider.oninput = () => {
            const value = slider.value * scale;
            document.getElementById(display).textContent = slider.value + suffix;
            if (frequencyShifterInstance) {
                frequencyShifterInstance.setParam(param, value);
            }
            updateShiftInfo();
        };
    });
    
    function updateShiftInfo() {
        if (!frequencyShifterInstance) return;
        const shift = frequencyShifterInstance.params.shift;
        const mode = frequencyShifterInstance.params.mode;
        
        document.getElementById('shiftAmount').textContent = Math.abs(shift) + ' Hz';
        
        let direction = 'None';
        if (shift > 0) direction = 'Up';
        else if (shift < 0) direction = 'Down';
        else direction = mode.charAt(0).toUpperCase() + mode.slice(1);
        
        document.getElementById('shiftDirection').textContent = direction;
    }
    
    // Presets
    const presets = {
        subtle: { shift: 5, mode: 'both', feedback: 0, inputFilterFreq: 20000, outputFilterFreq: 20000, mix: 0.3 },
        thickening: { shift: 20, mode: 'both', feedback: 0.1, inputFilterFreq: 8000, outputFilterFreq: 8000, mix: 0.4 },
        harmonizer: { shift: 100, mode: 'up', feedback: 0.05, inputFilterFreq: 10000, outputFilterFreq: 10000, mix: 0.5 },
        metallic: { shift: 500, mode: 'both', feedback: 0.3, inputFilterFreq: 5000, outputFilterFreq: 8000, mix: 0.7 },
        fx: { shift: 800, mode: 'down', feedback: 0.5, inputFilterFreq: 3000, outputFilterFreq: 6000, mix: 0.8 },
        extreme: { shift: 1500, mode: 'both', feedback: 0.7, inputFilterFreq: 2000, outputFilterFreq: 10000, mix: 1.0 }
    };
    
    document.querySelectorAll('.freqshift-preset').forEach(btn => {
        btn.onclick = () => {
            const preset = presets[btn.dataset.preset];
            if (!preset || !frequencyShifterInstance) return;
            
            Object.entries(preset).forEach(([param, value]) => {
                frequencyShifterInstance.setParam(param, value);
            });
            
            // Update UI
            document.getElementById('freqShift').value = preset.shift;
            document.getElementById('freqShiftVal').textContent = preset.shift + ' Hz';
            document.getElementById('freqFeedback').value = preset.feedback * 100;
            document.getElementById('freqFeedbackVal').textContent = (preset.feedback * 100) + '%';
            document.getElementById('freqInputFilter').value = preset.inputFilterFreq;
            document.getElementById('freqInputFilterVal').textContent = preset.inputFilterFreq + ' Hz';
            document.getElementById('freqOutputFilter').value = preset.outputFilterFreq;
            document.getElementById('freqOutputFilterVal').textContent = preset.outputFilterFreq + ' Hz';
            document.getElementById('freqMix').value = preset.mix * 100;
            document.getElementById('freqMixVal').textContent = (preset.mix * 100) + '%';
            
            // Update mode button
            document.querySelectorAll('.shift-mode-btn').forEach(b => {
                b.style.background = '#333';
                b.style.color = '#e0e0e0';
                if (b.dataset.mode === preset.mode) {
                    b.style.background = '#4CAF50';
                    b.style.color = 'white';
                }
            });
            
            updateShiftInfo();
        };
    });
}

window.FrequencyShifter = FrequencyShifter;
window.openFrequencyShifterPanel = openFrequencyShifterPanel;