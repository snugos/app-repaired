/**
 * ConvolutionReverb - Impulse response-based reverb effect
 * Uses WebAudio ConvolverNode for realistic space simulation
 */

class ConvolutionReverb {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isActive = false;
        
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        this.dryNode = audioContext.createGain();
        this.wetNode = audioContext.createGain();
        this.convolver = audioContext.createConvolver();
        this.preDelay = audioContext.createDelay();
        this.eqLow = audioContext.createBiquadFilter();
        this.eqHigh = audioContext.createBiquadFilter();
        
        // Parameters
        this.params = {
            mix: 0.3,
            preDelay: 0.01,
            eqLow: 100,
            eqHigh: 8000,
            decay: 2.0,
            size: 'medium'
        };
        
        // Built-in impulse responses
        this.impulseResponses = new Map();
        this.currentIR = null;
        
        this.setupFilters();
        this.connectNodes();
        this.generateBuiltInImpulses();
    }
    
    setupFilters() {
        this.eqLow.type = 'lowshelf';
        this.eqLow.frequency.value = 200;
        this.eqLow.gain.value = 0;
        
        this.eqHigh.type = 'highshelf';
        this.eqHigh.frequency.value = 5000;
        this.eqHigh.gain.value = 0;
    }
    
    connectNodes() {
        this.inputNode.connect(this.dryNode);
        this.inputNode.connect(this.preDelay);
        this.preDelay.connect(this.convolver);
        this.convolver.connect(this.eqLow);
        this.eqLow.connect(this.eqHigh);
        this.eqHigh.connect(this.wetNode);
        this.wetNode.connect(this.outputNode);
        this.dryNode.connect(this.outputNode);
        this.updateMix();
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
            } else if (name === 'preDelay') {
                this.preDelay.delayTime.value = value;
            } else if (name === 'eqLow') {
                this.eqLow.frequency.value = value;
            } else if (name === 'eqHigh') {
                this.eqHigh.frequency.value = value;
            }
        }
    }
    
    generateBuiltInImpulses() {
        const sizes = {
            'small-room': { duration: 0.5, decay: 1.5 },
            'medium-room': { duration: 1.0, decay: 2.0 },
            'large-hall': { duration: 2.5, decay: 2.5 },
            'cathedral': { duration: 4.0, decay: 3.0 },
            'plate': { duration: 1.5, decay: 1.8 },
            'spring': { duration: 1.0, decay: 2.2 },
            'chamber': { duration: 1.2, decay: 1.7 },
            'tunnel': { duration: 3.0, decay: 2.8 },
            'bathroom': { duration: 0.3, decay: 2.0 },
            'stadium': { duration: 5.0, decay: 3.5 }
        };
        
        Object.entries(sizes).forEach(([name, config]) => {
            const impulse = this.generateImpulse(config.duration, config.decay);
            this.impulseResponses.set(name, impulse);
        });
    }
    
    generateImpulse(duration, decay) {
        const sampleRate = this.audioContext.sampleRate;
        const length = Math.ceil(duration * sampleRate);
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                const envelope = Math.exp(-decay * t);
                const noise = (Math.random() * 2 - 1);
                
                // Add some early reflections
                let earlyReflections = 0;
                const earlyTimes = [0.01, 0.02, 0.035, 0.05, 0.07];
                earlyTimes.forEach((et, idx) => {
                    const earlySample = Math.floor(et * sampleRate);
                    if (i >= earlySample && i < earlySample + 100) {
                        earlyReflections += (Math.random() * 2 - 1) * (0.5 - idx * 0.08);
                    }
                });
                
                // Mix noise with early reflections
                data[i] = (noise * envelope * 0.7 + earlyReflections * envelope) * 0.5;
            }
        }
        
        return impulse;
    }
    
    loadImpulse(name) {
        if (this.impulseResponses.has(name)) {
            this.convolver.buffer = this.impulseResponses.get(name);
            this.currentIR = name;
            return true;
        }
        return false;
    }
    
    async loadImpulseFromFile(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.convolver.buffer = audioBuffer;
            return true;
        } catch (e) {
            console.error('Failed to load impulse response:', e);
            return false;
        }
    }
    
    async loadImpulseFromURL(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.convolver.buffer = audioBuffer;
            return true;
        } catch (e) {
            console.error('Failed to load impulse response from URL:', e);
            return false;
        }
    }
    
    start() {
        if (this.isActive) return;
        this.isActive = true;
        if (!this.convolver.buffer) {
            this.loadImpulse('medium-room');
        }
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

// Global convolution reverb instance
let convolutionReverbInstance = null;

function openConvolutionReverbPanel() {
    const existingPanel = document.getElementById('convolution-reverb-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'convolution-reverb-panel';
    panel.style.cssText = `
        position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #4a4a6a; border-radius: 8px; padding: 20px;
        width: 400px; z-index: 10000; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #e0e0e0; margin: 0; font-size: 18px;">Convolution Reverb</h2>
            <button id="closeConvReverb" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 8px;">Impulse Response</label>
            <select id="irSelect" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 4px; color: #e0e0e0; font-size: 14px;">
                <option value="small-room">Small Room</option>
                <option value="medium-room" selected>Medium Room</option>
                <option value="large-hall">Large Hall</option>
                <option value="cathedral">Cathedral</option>
                <option value="plate">Plate</option>
                <option value="spring">Spring</option>
                <option value="chamber">Chamber</option>
                <option value="tunnel">Tunnel</option>
                <option value="bathroom">Bathroom</option>
                <option value="stadium">Stadium</option>
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Mix</label>
            <input type="range" id="convMix" min="0" max="100" value="30" style="width: 100%;">
            <span id="convMixVal" style="color: #e0e0e0; font-size: 12px;">30%</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Pre-Delay (ms)</label>
            <input type="range" id="convPreDelay" min="0" max="200" value="10" style="width: 100%;">
            <span id="convPreDelayVal" style="color: #e0e0e0; font-size: 12px;">10 ms</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Low Cut (Hz)</label>
            <input type="range" id="convEqLow" min="20" max="500" value="200" style="width: 100%;">
            <span id="convEqLowVal" style="color: #e0e0e0; font-size: 12px;">200 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">High Cut (Hz)</label>
            <input type="range" id="convEqHigh" min="2000" max="15000" value="5000" style="width: 100%;">
            <span id="convEqHighVal" style="color: #e0e0e0; font-size: 12px;">5000 Hz</span>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="loadIRFile" style="flex: 1; padding: 12px; background: #2196F3; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">Load IR File</button>
        </div>
        
        <div id="convReverbInfo" style="margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 4px; font-size: 12px; color: #888;">
            <div>Current IR: <span id="currentIRName" style="color: #e0e0e0;">medium-room</span></div>
            <div>Sample Rate: <span id="irSampleRate" style="color: #e0e0e0;">48000 Hz</span></div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Close button
    document.getElementById('closeConvReverb').onclick = () => panel.remove();
    
    // Initialize processor
    if (!convolutionReverbInstance && window.audioContext) {
        convolutionReverbInstance = new ConvolutionReverb(window.audioContext);
    }
    
    // IR selection
    document.getElementById('irSelect').onchange = (e) => {
        if (convolutionReverbInstance) {
            convolutionReverbInstance.loadImpulse(e.target.value);
            document.getElementById('currentIRName').textContent = e.target.value;
        }
    };
    
    // Parameter sliders
    const sliders = [
        { id: 'convMix', param: 'mix', display: 'convMixVal', suffix: '%', scale: 0.01 },
        { id: 'convPreDelay', param: 'preDelay', display: 'convPreDelayVal', suffix: ' ms', scale: 0.001 },
        { id: 'convEqLow', param: 'eqLow', display: 'convEqLowVal', suffix: ' Hz', scale: 1 },
        { id: 'convEqHigh', param: 'eqHigh', display: 'convEqHighVal', suffix: ' Hz', scale: 1 }
    ];
    
    sliders.forEach(({ id, param, display, suffix, scale }) => {
        const slider = document.getElementById(id);
        slider.oninput = () => {
            const value = slider.value * scale;
            document.getElementById(display).textContent = slider.value + suffix;
            if (convolutionReverbInstance) {
                convolutionReverbInstance.setParam(param, value);
            }
        };
    });
    
    // Load IR file
    document.getElementById('loadIRFile').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*,.wav,.aiff,.aif';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (convolutionReverbInstance) {
                const success = await convolutionReverbInstance.loadImpulseFromFile(file);
                if (success) {
                    document.getElementById('currentIRName').textContent = file.name;
                    alert(`Loaded impulse response: ${file.name}`);
                } else {
                    alert('Failed to load impulse response');
                }
            }
        };
        input.click();
    };
}

window.ConvolutionReverb = ConvolutionReverb;
window.openConvolutionReverbPanel = openConvolutionReverbPanel;