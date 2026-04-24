/**
 * FlangerEffect - Time-based delay modulation effect
 * Creates the classic sweeping comb-filter effect
 */

export class FlangerEffect {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Parameters
        this.rate = options.rate ?? 0.5; // LFO rate in Hz
        this.depth = options.depth ?? 0.8; // Delay depth in ms
        this.feedback = options.feedback ?? 0.5; // Feedback amount
        this.mix = options.mix ?? 0.5; // Dry/wet
        this.delayTime = options.delayTime ?? 3; // Base delay time in ms
        
        // LFO for modulation
        this.lfo = audioContext.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = this.rate;
        
        this.lfoGain = audioContext.createGain();
        this.lfoGain.gain.value = this.depth; // Delay modulation range in ms
        
        this.lfo.connect(this.lfoGain);
        
        // Delay line
        this.delay = audioContext.createDelay();
        this.delay.delayTime.value = this.delayTime / 1000; // Convert ms to seconds
        
        // Feedback path
        this.feedbackGain = audioContext.createGain();
        this.feedbackGain.gain.value = this.feedback;
        
        // High-pass to remove DC offset
        this.highpass = audioContext.createBiquadFilter();
        this.highpass.type = 'highpass';
        this.highpass.frequency.value = 20;
        
        // Mix
        this._dryGain = audioContext.createGain();
        this._wetGain = audioContext.createGain();
        
        this._connect();
        this.lfo.start();
        this.updateParameters();
    }
    
    _connect() {
        // Input -> dry path
        this.input.connect(this._dryGain);
        
        // Input -> delay path
        this.input.connect(this.delay);
        
        // LFO modulates delay time
        this.lfoGain.connect(this.delay.delayTime);
        
        // Delay output -> feedback loop -> delay input
        this.delay.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delay);
        
        // Delay -> highpass -> wet gain
        this.delay.connect(this.highpass);
        this.highpass.connect(this._wetGain);
        
        // Mix
        this._dryGain.connect(this.output);
        this._wetGain.connect(this.output);
    }
    
    updateParameters() {
        this._wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this._dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
        this.feedbackGain.gain.setTargetAtTime(this.feedback * 0.9, this.audioContext.currentTime, 0.01);
        this.lfoGain.gain.setTargetAtTime(this.depth, this.audioContext.currentTime, 0.01);
        this.delay.delayTime.setTargetAtTime(this.delayTime / 1000, this.audioContext.currentTime, 0.01);
    }
    
    setRate(value) {
        this.rate = Math.max(0.05, Math.min(10, value));
        this.lfo.frequency.setTargetAtTime(this.rate, this.audioContext.currentTime, 0.01);
    }
    
    setDepth(value) {
        this.depth = Math.max(0.1, Math.min(10, value));
        this.updateParameters();
    }
    
    setFeedback(value) {
        this.feedback = Math.max(0, Math.min(0.95, value));
        this.updateParameters();
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setDelayTime(value) {
        this.delayTime = Math.max(0.1, Math.min(20, value));
        this.updateParameters();
    }
    
    dispose() {
        this.lfo.stop();
        this.lfo.disconnect();
        this.lfoGain.disconnect();
        this.delay.disconnect();
        this.feedbackGain.disconnect();
        this.highpass.disconnect();
        this._dryGain.disconnect();
        this._wetGain.disconnect();
        this.input.disconnect();
        this.output.disconnect();
    }
}

export function openFlangerPanel() {
    let panel = document.getElementById('flanger-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'flanger-panel';
        panel.className = 'effect-panel';
        panel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #1a1a2e; border: 1px solid #444; border-radius: 8px;
            padding: 20px; z-index: 1000; min-width: 300px; color: white;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(panel);
    }
    
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
            <h3 style="margin:0;">Flanger</h3>
            <button onclick="document.getElementById('flanger-panel').remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">×</button>
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Rate: <span id="flanger-rate-val">0.5</span> Hz</label>
            <input type="range" min="0.05" max="10" step="0.05" value="0.5" id="flanger-rate" style="width:100%"
                oninput="document.getElementById('flanger-rate-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Depth: <span id="flanger-depth-val">0.8</span> ms</label>
            <input type="range" min="0.1" max="10" step="0.1" value="0.8" id="flanger-depth" style="width:100%"
                oninput="document.getElementById('flanger-depth-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Delay Time: <span id="flanger-delay-val">3</span> ms</label>
            <input type="range" min="0.1" max="20" step="0.1" value="3" id="flanger-delay" style="width:100%"
                oninput="document.getElementById('flanger-delay-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Feedback: <span id="flanger-fb-val">0.5</span></label>
            <input type="range" min="0" max="0.95" step="0.01" value="0.5" id="flanger-fb" style="width:100%"
                oninput="document.getElementById('flanger-fb-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Mix: <span id="flanger-mix-val">0.5</span></label>
            <input type="range" min="0" max="1" step="0.01" value="0.5" id="flanger-mix" style="width:100%"
                oninput="document.getElementById('flanger-mix-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="display:flex;gap:10px;">
            <button onclick="alert('Flanger applied to track')" style="flex:1;padding:8px;background:#6366f1;border:none;border-radius:4px;color:white;cursor:pointer;">Apply</button>
            <button onclick="document.getElementById('flanger-panel').remove()" style="flex:1;padding:8px;background:#444;border:none;border-radius:4px;color:white;cursor:pointer;">Cancel</button>
        </div>
    `;
    
    return panel;
}