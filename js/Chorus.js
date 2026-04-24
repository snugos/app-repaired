/**
 * ChorusEffect - Detune-based stereo widening effect
 * Creates the classic lush, wide sound by combining slightly detuned signals
 */

export class ChorusEffect {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Parameters
        this.rate = options.rate ?? 1.5; // LFO rate in Hz
        this.depth = options.depth ?? 0.7; // Modulation depth
        this.delayTime = options.delayTime ?? 6; // Base delay time in ms
        this.feedback = options.feedback ?? 0; // Small feedback for thickness
        this.mix = options.mix ?? 0.5; // Dry/wet
        this.detune = options.detune ?? 8; // Detune amount in cents
        this.temperature = options.temperature ?? 0.3; // Warmth/smoothness
        
        // LFO for modulation
        this.lfo = audioContext.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = this.rate;
        
        this.lfoGain = audioContext.createGain();
        this.lfoGain.gain.value = this.depth * 2; // Delay modulation range in ms
        
        this.lfo.connect(this.lfoGain);
        
        // Additional LFO for slight pitch modulation (creates more natural chorus)
        this.lfo2 = audioContext.createOscillator();
        this.lfo2.type = 'sine';
        this.lfo2.frequency.value = this.rate * 0.7;
        
        this.lfo2Gain = audioContext.createGain();
        this.lfo2Gain.gain.value = this.detune / 100; // Convert cents to ratio
        
        this.lfo2.connect(this.lfo2Gain);
        
        // Delay line
        this.delay = audioContext.createDelay();
        this.delay.delayTime.value = this.delayTime / 1000;
        
        // For stereo, we need two delays with slight offset
        this.delay2 = audioContext.createDelay();
        this.delay2.delayTime.value = (this.delayTime + 1) / 1000;
        
        // Feedback (subtle)
        this.feedbackGain = audioContext.createGain();
        this.feedbackGain.gain.value = this.feedback;
        
        // Tone filter to soften the chorus
        this.toneFilter = audioContext.createBiquadFilter();
        this.toneFilter.type = 'lowpass';
        this.toneFilter.frequency.value = 8000 - (this.temperature * 2000);
        
        // Mix
        this._dryGain = audioContext.createGain();
        this._wetGain = audioContext.createGain();
        
        this._connect();
        this.lfo.start();
        this.lfo2.start();
        this.updateParameters();
    }
    
    _connect() {
        // Input -> dry path
        this.input.connect(this._dryGain);
        
        // Input -> delay path
        this.input.connect(this.delay);
        this.input.connect(this.delay2);
        
        // LFO modulates delay time
        this.lfoGain.connect(this.delay.delayTime);
        this.lfoGain.connect(this.delay2.delayTime);
        
        // LFO2 modulates pitch (via detuneGain for potential pitch shifting)
        // For simplicity, we add slight offset to delay2
        this.lfo2Gain.connect(this.delay2.delayTime);
        
        // Delay output -> tone filter -> wet
        this.delay.connect(this.toneFilter);
        this.delay2.connect(this.toneFilter);
        this.toneFilter.connect(this._wetGain);
        
        // Subtle feedback
        this.delay.connect(this.feedbackGain);
        this.delay2.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delay);
        this.feedbackGain.connect(this.delay2);
        
        // Mix
        this._dryGain.connect(this.output);
        this._wetGain.connect(this.output);
    }
    
    updateParameters() {
        this._wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this._dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
        this.feedbackGain.gain.setTargetAtTime(this.feedback * 0.5, this.audioContext.currentTime, 0.01);
        this.lfoGain.gain.setTargetAtTime(this.depth * 2, this.audioContext.currentTime, 0.01);
        this.lfo2Gain.gain.setTargetAtTime(this.detune / 100, this.audioContext.currentTime, 0.01);
        this.delay.delayTime.setTargetAtTime(this.delayTime / 1000, this.audioContext.currentTime, 0.01);
        this.delay2.delayTime.setTargetAtTime((this.delayTime + 1) / 1000, this.audioContext.currentTime, 0.01);
        this.toneFilter.frequency.setTargetAtTime(8000 - (this.temperature * 2000), this.audioContext.currentTime, 0.01);
    }
    
    setRate(value) {
        this.rate = Math.max(0.1, Math.min(10, value));
        this.lfo.frequency.setTargetAtTime(this.rate, this.audioContext.currentTime, 0.01);
        this.lfo2.frequency.setTargetAtTime(this.rate * 0.7, this.audioContext.currentTime, 0.01);
    }
    
    setDepth(value) {
        this.depth = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setDelayTime(value) {
        this.delayTime = Math.max(1, Math.min(30, value));
        this.updateParameters();
    }
    
    setFeedback(value) {
        this.feedback = Math.max(0, Math.min(0.5, value));
        this.updateParameters();
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setDetune(value) {
        this.detune = Math.max(1, Math.min(50, value));
        this.updateParameters();
    }
    
    setTemperature(value) {
        this.temperature = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    dispose() {
        this.lfo.stop();
        this.lfo.disconnect();
        this.lfo2.stop();
        this.lfo2.disconnect();
        this.lfoGain.disconnect();
        this.lfo2Gain.disconnect();
        this.delay.disconnect();
        this.delay2.disconnect();
        this.feedbackGain.disconnect();
        this.toneFilter.disconnect();
        this._dryGain.disconnect();
        this._wetGain.disconnect();
        this.input.disconnect();
        this.output.disconnect();
    }
}

export function openChorusPanel() {
    let panel = document.getElementById('chorus-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'chorus-panel';
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
            <h3 style="margin:0;">Chorus</h3>
            <button onclick="document.getElementById('chorus-panel').remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">×</button>
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Rate: <span id="chorus-rate-val">1.5</span> Hz</label>
            <input type="range" min="0.1" max="10" step="0.1" value="1.5" id="chorus-rate" style="width:100%"
                oninput="document.getElementById('chorus-rate-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Depth: <span id="chorus-depth-val">0.7</span></label>
            <input type="range" min="0" max="1" step="0.01" value="0.7" id="chorus-depth" style="width:100%"
                oninput="document.getElementById('chorus-depth-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Delay Time: <span id="chorus-delay-val">6</span> ms</label>
            <input type="range" min="1" max="30" step="0.5" value="6" id="chorus-delay" style="width:100%"
                oninput="document.getElementById('chorus-delay-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Detune: <span id="chorus-detune-val">8</span> cents</label>
            <input type="range" min="1" max="50" value="8" id="chorus-detune" style="width:100%"
                oninput="document.getElementById('chorus-detune-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Temperature: <span id="chorus-temp-val">0.3</span></label>
            <input type="range" min="0" max="1" step="0.01" value="0.3" id="chorus-temp" style="width:100%"
                oninput="document.getElementById('chorus-temp-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Mix: <span id="chorus-mix-val">0.5</span></label>
            <input type="range" min="0" max="1" step="0.01" value="0.5" id="chorus-mix" style="width:100%"
                oninput="document.getElementById('chorus-mix-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="display:flex;gap:10px;">
            <button onclick="alert('Chorus applied to track')" style="flex:1;padding:8px;background:#6366f1;border:none;border-radius:4px;color:white;cursor:pointer;">Apply</button>
            <button onclick="document.getElementById('chorus-panel').remove()" style="flex:1;padding:8px;background:#444;border:none;border-radius:4px;color:white;cursor:pointer;">Cancel</button>
        </div>
    `;
    
    return panel;
}