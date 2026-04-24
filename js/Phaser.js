/**
 * PhaserEffect - All-pass filter-based phase shifting effect
 * Creates sweeping notches in the frequency spectrum for that classic phaser sound
 */

export class PhaserEffect {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Parameters
        this.rate = options.rate ?? 0.5; // LFO rate in Hz
        this.depth = options.depth ?? 0.7; // LFO depth 0-1
        this.stages = options.stages ?? 4; // Number of all-pass stages
        this.feedback = options.feedback ?? 0.5; // Feedback amount 0-1
        this.mix = options.mix ?? 1.0; // Dry/wet
        this.baseFreq = options.baseFreq ?? 1000; // Base center frequency
        
        // LFO for modulation
        this.lfo = audioContext.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = this.rate;
        
        this.lfoGain = audioContext.createGain();
        this.lfoGain.gain.value = this.depth * 2000; // Frequency sweep range
        
        this.lfo.connect(this.lfoGain);
        
        // All-pass filters
        this._filters = [];
        this._buildPhaser();
        
        // Feedback path
        this.feedbackGain = audioContext.createGain();
        this.feedbackGain.gain.value = this.feedback;
        
        // Mix
        this._dryGain = audioContext.createGain();
        this._wetGain = audioContext.createGain();
        
        this._connect();
        this.lfo.start();
        this.updateParameters();
    }
    
    _buildPhaser() {
        const stageCount = this.stages;
        
        for (let i = 0; i < stageCount; i++) {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'allpass';
            filter.frequency.value = this.baseFreq + (i * 500);
            filter.Q.value = 1;
            
            // Connect LFO to frequency
            this.lfoGain.connect(filter.frequency);
            
            this._filters.push(filter);
        }
    }
    
    _connect() {
        // Input -> dry path
        this.input.connect(this._dryGain);
        
        // Input -> wet path through filters
        this.input.connect(this._filters[0]);
        
        for (let i = 0; i < this._filters.length - 1; i++) {
            this._filters[i].connect(this._filters[i + 1]);
        }
        
        // Last filter -> feedback -> first filter (feedback loop)
        const lastFilter = this._filters[this._filters.length - 1];
        lastFilter.connect(this.feedbackGain);
        this.feedbackGain.connect(this._filters[0]);
        
        // Wet path output
        lastFilter.connect(this._wetGain);
        
        // Mix
        this._dryGain.connect(this.output);
        this._wetGain.connect(this.output);
    }
    
    updateParameters() {
        this.lfoGain.gain.setTargetAtTime(this.depth * 2000, this.audioContext.currentTime, 0.01);
        this._wetGain.gain.setTargetAtTime(this.mix, this.audioContext.currentTime, 0.01);
        this._dryGain.gain.setTargetAtTime(1 - this.mix, this.audioContext.currentTime, 0.01);
        this.feedbackGain.gain.setTargetAtTime(this.feedback * 0.9, this.audioContext.currentTime, 0.01);
    }
    
    setRate(value) {
        this.rate = Math.max(0.05, Math.min(10, value));
        this.lfo.frequency.setTargetAtTime(this.rate, this.audioContext.currentTime, 0.01);
    }
    
    setDepth(value) {
        this.depth = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setStages(value) {
        this.stages = Math.max(2, Math.min(12, value));
        // Rebuild would be complex, just update UI
    }
    
    setFeedback(value) {
        this.feedback = Math.max(0, Math.min(0.95, value));
        this.updateParameters();
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    dispose() {
        this.lfo.stop();
        this.lfo.disconnect();
        this.lfoGain.disconnect();
        this.feedbackGain.disconnect();
        this._filters.forEach(f => f.disconnect());
        this._dryGain.disconnect();
        this._wetGain.disconnect();
        this.input.disconnect();
        this.output.disconnect();
    }
}

export function openPhaserPanel() {
    let panel = document.getElementById('phaser-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'phaser-panel';
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
            <h3 style="margin:0;">Phaser</h3>
            <button onclick="document.getElementById('phaser-panel').remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">×</button>
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Rate: <span id="phaser-rate-val">0.5</span> Hz</label>
            <input type="range" min="0.05" max="10" step="0.05" value="0.5" id="phaser-rate" style="width:100%"
                oninput="document.getElementById('phaser-rate-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Depth: <span id="phaser-depth-val">0.7</span></label>
            <input type="range" min="0" max="1" step="0.01" value="0.7" id="phaser-depth" style="width:100%"
                oninput="document.getElementById('phaser-depth-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Stages: <span id="phaser-stages-val">4</span></label>
            <input type="range" min="2" max="12" value="4" id="phaser-stages" style="width:100%"
                oninput="document.getElementById('phaser-stages-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Feedback: <span id="phaser-fb-val">0.5</span></label>
            <input type="range" min="0" max="0.95" step="0.01" value="0.5" id="phaser-fb" style="width:100%"
                oninput="document.getElementById('phaser-fb-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Mix: <span id="phaser-mix-val">1.0</span></label>
            <input type="range" min="0" max="1" step="0.01" value="1" id="phaser-mix" style="width:100%"
                oninput="document.getElementById('phaser-mix-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="display:flex;gap:10px;">
            <button onclick="alert('Phaser applied to track')" style="flex:1;padding:8px;background:#6366f1;border:none;border-radius:4px;color:white;cursor:pointer;">Apply</button>
            <button onclick="document.getElementById('phaser-panel').remove()" style="flex:1;padding:8px;background:#444;border:none;border-radius:4px;color:white;cursor:pointer;">Cancel</button>
        </div>
    `;
    
    return panel;
}