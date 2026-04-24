/**
 * RingModulator - Classic ring modulation effect
 * Multiplies audio signal with a carrier oscillator for metallic/bell-like sounds
 */

class RingModulator {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isActive = false;
        
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        this.dryNode = audioContext.createGain();
        this.wetNode = audioContext.createGain();
        
        // Carrier oscillator
        this.carrierOsc = audioContext.createOscillator();
        this.carrierGain = audioContext.createGain();
        
        // Modulation components
        this.modulatorOsc = audioContext.createOscillator();
        this.modulatorGain = audioContext.createGain();
        
        // Ring mod multiplier (using script processor for true ring modulation)
        this.multiplier = audioContext.createGain();
        this.modulationGain = audioContext.createGain();
        
        // Filters for tone shaping
        this.inputFilter = audioContext.createBiquadFilter();
        this.outputFilter = audioContext.createBiquadFilter();
        
        // Parameters
        this.params = {
            carrierFreq: 400,
            carrierType: 'sine',
            modulatorFreq: 1,
            modulatorDepth: 0,
            mix: 0.5,
            inputFilterFreq: 5000,
            outputFilterFreq: 5000,
            tracking: false,
            trackRatio: 1
        };
        
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        
        this.setupNodes();
        this.connectNodes();
        this.startOscillators();
    }
    
    setupNodes() {
        this.inputFilter.type = 'lowpass';
        this.inputFilter.frequency.value = this.params.inputFilterFreq;
        
        this.outputFilter.type = 'lowpass';
        this.outputFilter.frequency.value = this.params.outputFilterFreq;
        
        this.carrierOsc.type = 'sine';
        this.carrierOsc.frequency.value = this.params.carrierFreq;
        
        this.modulatorOsc.type = 'sine';
        this.modulatorOsc.frequency.value = this.params.modulatorFreq;
        this.modulatorGain.gain.value = this.params.modulatorDepth;
        
        this.multiplier.gain.value = 0;
        this.carrierGain.gain.value = 1;
        this.modulationGain.gain.value = 1;
    }
    
    connectNodes() {
        this.inputNode.connect(this.inputFilter);
        
        // Dry path
        this.inputFilter.connect(this.dryNode);
        
        // Ring mod path - multiply input by carrier
        this.inputFilter.connect(this.multiplier);
        this.carrierOsc.connect(this.carrierGain);
        this.carrierGain.connect(this.multiplier.gain);
        
        // LFO modulation of carrier frequency
        this.modulatorOsc.connect(this.modulatorGain);
        this.modulatorGain.connect(this.carrierOsc.frequency);
        
        // Output
        this.multiplier.connect(this.outputFilter);
        this.outputFilter.connect(this.wetNode);
        this.wetNode.connect(this.outputNode);
        this.dryNode.connect(this.outputNode);
        
        // Analyser
        this.outputNode.connect(this.analyser);
        
        this.updateMix();
    }
    
    startOscillators() {
        this.carrierOsc.start();
        this.modulatorOsc.start();
    }
    
    updateMix() {
        this.dryNode.gain.value = 1 - this.params.mix;
        this.wetNode.gain.value = this.params.mix;
    }
    
    setParam(name, value) {
        if (this.params.hasOwnProperty(name)) {
            this.params[name] = value;
            if (name === 'mix') {
                this.updateMix();
            } else if (name === 'carrierFreq') {
                this.carrierOsc.frequency.setValueAtTime(value, this.audioContext.currentTime);
            } else if (name === 'carrierType') {
                this.carrierOsc.type = value;
            } else if (name === 'modulatorFreq') {
                this.modulatorOsc.frequency.setValueAtTime(value, this.audioContext.currentTime);
            } else if (name === 'modulatorDepth') {
                this.modulatorGain.gain.setValueAtTime(value, this.audioContext.currentTime);
            } else if (name === 'inputFilterFreq') {
                this.inputFilter.frequency.setValueAtTime(value, this.audioContext.currentTime);
            } else if (name === 'outputFilterFreq') {
                this.outputFilter.frequency.setValueAtTime(value, this.audioContext.currentTime);
            }
        }
    }
    
    setCarrierFrequency(freq) {
        this.params.carrierFreq = freq;
        this.carrierOsc.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    }
    
    enableTracking(enabled) {
        this.params.tracking = enabled;
    }
    
    trackPitch(frequency) {
        if (this.params.tracking) {
            const carrierFreq = frequency * this.params.trackRatio;
            this.setCarrierFrequency(carrierFreq);
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
    
    getAnalyser() {
        return this.analyser;
    }
}

// Global ring modulator instance
let ringModulatorInstance = null;

function openRingModulatorPanel() {
    const existingPanel = document.getElementById('ring-modulator-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'ring-modulator-panel';
    panel.style.cssText = `
        position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #4a4a6a; border-radius: 8px; padding: 20px;
        width: 450px; z-index: 10000; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #e0e0e0; margin: 0; font-size: 18px;">Ring Modulator</h2>
            <button id="closeRingMod" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 8px;">Carrier Type</label>
            <div style="display: flex; gap: 8px;">
                <button class="carrier-type-btn" data-type="sine" style="padding: 8px 16px; background: #4CAF50; border: none; border-radius: 4px; color: white; cursor: pointer;">Sine</button>
                <button class="carrier-type-btn" data-type="square" style="padding: 8px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">Square</button>
                <button class="carrier-type-btn" data-type="sawtooth" style="padding: 8px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">Saw</button>
                <button class="carrier-type-btn" data-type="triangle" style="padding: 8px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">Triangle</button>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Carrier Frequency (Hz)</label>
            <input type="range" id="carrierFreq" min="20" max="5000" value="400" style="width: 100%;">
            <span id="carrierFreqVal" style="color: #e0e0e0; font-size: 12px;">400 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">LFO Rate (Hz)</label>
            <input type="range" id="lfoRate" min="0" max="50" value="1" step="0.1" style="width: 100%;">
            <span id="lfoRateVal" style="color: #e0e0e0; font-size: 12px;">1 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">LFO Depth (Hz)</label>
            <input type="range" id="lfoDepth" min="0" max="500" value="0" style="width: 100%;">
            <span id="lfoDepthVal" style="color: #e0e0e0; font-size: 12px;">0 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Input Filter (Hz)</label>
            <input type="range" id="inputFilter" min="100" max="10000" value="5000" style="width: 100%;">
            <span id="inputFilterVal" style="color: #e0e0e0; font-size: 12px;">5000 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Output Filter (Hz)</label>
            <input type="range" id="outputFilter" min="100" max="10000" value="5000" style="width: 100%;">
            <span id="outputFilterVal" style="color: #e0e0e0; font-size: 12px;">5000 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Mix</label>
            <input type="range" id="ringMix" min="0" max="100" value="50" style="width: 100%;">
            <span id="ringMixVal" style="color: #e0e0e0; font-size: 12px;">50%</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="pitchTracking" style="margin: 0;">
                Pitch Tracking
            </label>
        </div>
        
        <div id="ringModPresets" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #333;">
            <label style="color: #a0a0a0; font-size: 12px;">Presets</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                <button class="ring-preset" data-preset="metallic" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Metallic</button>
                <button class="ring-preset" data-preset="bell" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Bell</button>
                <button class="ring-preset" data-preset="robotic" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Robotic</button>
                <button class="ring-preset" data-preset="tremolo" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Tremolo</button>
                <button class="ring-preset" data-preset="alien" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Alien</button>
                <button class="ring-preset" data-preset="harsh" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Harsh</button>
            </div>
        </div>
        
        <canvas id="ringModCanvas" style="width: 100%; height: 60px; background: #0a0a14; border-radius: 4px; margin-top: 16px;"></canvas>
    `;
    
    document.body.appendChild(panel);
    
    // Close button
    document.getElementById('closeRingMod').onclick = () => panel.remove();
    
    // Initialize processor
    if (!ringModulatorInstance && window.audioContext) {
        ringModulatorInstance = new RingModulator(window.audioContext);
    }
    
    // Carrier type buttons
    document.querySelectorAll('.carrier-type-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.carrier-type-btn').forEach(b => {
                b.style.background = '#333';
                b.style.color = '#e0e0e0';
            });
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            
            if (ringModulatorInstance) {
                ringModulatorInstance.setParam('carrierType', btn.dataset.type);
            }
        };
    });
    
    // Parameter sliders
    const sliders = [
        { id: 'carrierFreq', param: 'carrierFreq', display: 'carrierFreqVal', suffix: ' Hz', scale: 1 },
        { id: 'lfoRate', param: 'modulatorFreq', display: 'lfoRateVal', suffix: ' Hz', scale: 1 },
        { id: 'lfoDepth', param: 'modulatorDepth', display: 'lfoDepthVal', suffix: ' Hz', scale: 1 },
        { id: 'inputFilter', param: 'inputFilterFreq', display: 'inputFilterVal', suffix: ' Hz', scale: 1 },
        { id: 'outputFilter', param: 'outputFilterFreq', display: 'outputFilterVal', suffix: ' Hz', scale: 1 },
        { id: 'ringMix', param: 'mix', display: 'ringMixVal', suffix: '%', scale: 0.01 }
    ];
    
    sliders.forEach(({ id, param, display, suffix, scale }) => {
        const slider = document.getElementById(id);
        slider.oninput = () => {
            const value = slider.value * scale;
            document.getElementById(display).textContent = slider.value + suffix;
            if (ringModulatorInstance) {
                ringModulatorInstance.setParam(param, value);
            }
        };
    });
    
    // Pitch tracking checkbox
    document.getElementById('pitchTracking').onchange = (e) => {
        if (ringModulatorInstance) {
            ringModulatorInstance.enableTracking(e.target.checked);
        }
    };
    
    // Presets
    const presets = {
        metallic: { carrierFreq: 800, carrierType: 'sine', modulatorFreq: 0.5, modulatorDepth: 50, inputFilterFreq: 3000, outputFilterFreq: 4000, mix: 0.7 },
        bell: { carrierFreq: 1200, carrierType: 'sine', modulatorFreq: 0, modulatorDepth: 0, inputFilterFreq: 8000, outputFilterFreq: 6000, mix: 0.6 },
        robotic: { carrierFreq: 400, carrierType: 'square', modulatorFreq: 5, modulatorDepth: 100, inputFilterFreq: 4000, outputFilterFreq: 3000, mix: 0.8 },
        tremolo: { carrierFreq: 100, carrierType: 'sine', modulatorFreq: 8, modulatorDepth: 200, inputFilterFreq: 5000, outputFilterFreq: 5000, mix: 0.4 },
        alien: { carrierFreq: 2500, carrierType: 'sawtooth', modulatorFreq: 3, modulatorDepth: 300, inputFilterFreq: 2000, outputFilterFreq: 8000, mix: 0.9 },
        harsh: { carrierFreq: 1500, carrierType: 'square', modulatorFreq: 0, modulatorDepth: 0, inputFilterFreq: 10000, outputFilterFreq: 2000, mix: 1.0 }
    };
    
    document.querySelectorAll('.ring-preset').forEach(btn => {
        btn.onclick = () => {
            const preset = presets[btn.dataset.preset];
            if (!preset || !ringModulatorInstance) return;
            
            Object.entries(preset).forEach(([param, value]) => {
                ringModulatorInstance.setParam(param, value);
            });
            
            // Update UI
            document.getElementById('carrierFreq').value = preset.carrierFreq;
            document.getElementById('carrierFreqVal').textContent = preset.carrierFreq + ' Hz';
            document.getElementById('lfoRate').value = preset.modulatorFreq;
            document.getElementById('lfoRateVal').textContent = preset.modulatorFreq + ' Hz';
            document.getElementById('lfoDepth').value = preset.modulatorDepth;
            document.getElementById('lfoDepthVal').textContent = preset.modulatorDepth + ' Hz';
            document.getElementById('inputFilter').value = preset.inputFilterFreq;
            document.getElementById('inputFilterVal').textContent = preset.inputFilterFreq + ' Hz';
            document.getElementById('outputFilter').value = preset.outputFilterFreq;
            document.getElementById('outputFilterVal').textContent = preset.outputFilterFreq + ' Hz';
            document.getElementById('ringMix').value = preset.mix * 100;
            document.getElementById('ringMixVal').textContent = (preset.mix * 100) + '%';
            
            // Update carrier type button
            document.querySelectorAll('.carrier-type-btn').forEach(b => {
                b.style.background = '#333';
                b.style.color = '#e0e0e0';
                if (b.dataset.type === preset.carrierType) {
                    b.style.background = '#4CAF50';
                    b.style.color = 'white';
                }
            });
        };
    });
    
    // Visualizer
    const canvas = document.getElementById('ringModCanvas');
    const ctx = canvas.getContext('2d');
    
    function drawVisualizer() {
        if (!ringModulatorInstance || !document.getElementById('ring-modulator-panel')) return;
        
        const analyser = ringModulatorInstance.getAnalyser();
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);
        
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#4CAF50';
        ctx.beginPath();
        
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        requestAnimationFrame(drawVisualizer);
    }
    
    drawVisualizer();
}

window.RingModulator = RingModulator;
window.openRingModulatorPanel = openRingModulatorPanel;