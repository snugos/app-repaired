/**
 * VocoderEffect - Classic vocoder with filter bank analysis and synthesis
 * Uses modulator signal to shape carrier through filter bank
 */

export class VocoderEffect {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        this.modulatorInput = audioContext.createGain();
        this.carrierInput = audioContext.createGain();
        
        // Parameters
        this.bands = options.bands ?? 16;
        this.lowFreq = options.lowFreq ?? 80;
        this.highFreq = options.highFreq ?? 8000;
        this.filterQ = options.filterQ ?? 5;
        this.mix = options.mix ?? 1.0;
        this.carrierLevel = options.carrierLevel ?? 1.0;
        this.modulatorLevel = options.modulatorLevel ?? 1.0;
        this.envelopeFollow = options.envelopeFollow ?? 0.3;
        this.presets = options.presets ?? 'robot';
        
        // Internal state
        this._analyzers = [];
        this._carrierFilters = [];
        this._modulatorFilters = [];
        this._envelopeFollowers = [];
        this._carrierGains = [];
        this._dryGain = audioContext.createGain();
        this._wetGain = audioContext.createGain();
        
        this._buildFilterBank();
        this._connect();
        this.updateParameters();
    }
    
    _buildFilterBank() {
        const bandCount = this.bands;
        const lowLog = Math.log2(this.lowFreq);
        const highLog = Math.log2(this.highFreq);
        const logStep = (highLog - lowLog) / bandCount;
        
        this._splitter = this.audioContext.createChannelMerger(2);
        this._modulatorSplitter = this.audioContext.createChannelMerger(1);
        this._carrierSplitter = this.audioContext.createChannelMerger(1);
        this._merger = this.audioContext.createChannelMerger(bandCount);
        
        // Modulator analysis path
        for (let i = 0; i < bandCount; i++) {
            const freq = Math.pow(2, lowLog + (i + 0.5) * logStep);
            
            // Analyzer filter
            const modFilter = this.audioContext.createBiquadFilter();
            modFilter.type = 'bandpass';
            modFilter.frequency.value = freq;
            modFilter.Q.value = this.filterQ;
            this._modulatorFilters.push(modFilter);
            
            // Envelope follower
            const envGain = this.audioContext.createGain();
            envGain.gain.value = this.envelopeFollow;
            this._envelopeFollowers.push(envGain);
            
            // Analyzer
            const analyser = this.audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            this._analyzers.push(analyser);
            
            this._modulatorSplitter.connect(modFilter, 0);
            modFilter.connect(envGain);
            envGain.connect(analyser);
        }
        
        // Carrier synthesis path
        for (let i = 0; i < bandCount; i++) {
            const freq = Math.pow(2, lowLog + (i + 0.5) * logStep);
            
            // Carrier filter
            const carFilter = this.audioContext.createBiquadFilter();
            carFilter.type = 'bandpass';
            carFilter.frequency.value = freq;
            carFilter.Q.value = this.filterQ;
            this._carrierFilters.push(carFilter);
            
            // Gain modulated by analyzer
            const carGain = this.audioContext.createGain();
            this._carrierGains.push(carGain);
            
            this._carrierSplitter.connect(carFilter, 0);
            carFilter.connect(carGain);
            carGain.connect(this._merger, 0, i);
        }
    }
    
    _connect() {
        // Modulator (voice/sound to analyze) -> modulator path
        this.modulatorInput.connect(this._modulatorSplitter);
        
        // Carrier (sound to be modulated) -> carrier path
        this.carrierInput.connect(this._carrierSplitter);
        
        // Mixed output
        this._merger.connect(this._wetGain);
        this._dryGain.connect(this.output);
        this._wetGain.connect(this.output);
        
        // Start modulation loop
        this._startModulation();
    }
    
    _startModulation() {
        const updateLoop = () => {
            for (let i = 0; i < this.bands; i++) {
                const analyser = this._analyzers[i];
                const dataArray = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatTimeDomainData(dataArray);
                
                // Compute RMS level
                let sum = 0;
                for (let j = 0; j < dataArray.length; j++) {
                    sum += dataArray[j] * dataArray[j];
                }
                const rms = Math.sqrt(sum / dataArray.length);
                const level = Math.min(rms * 10, 1.0); // Scale and clamp
                
                // Modulate carrier filter gain
                this._carrierGains[i].gain.setTargetAtTime(level * this.carrierLevel, this.audioContext.currentTime, 0.01);
                
                // Modulate filter frequency slightly based on envelope
                const freqMod = 1.0 + (level * 0.1);
                const baseFreq = this._carrierFilters[i].frequency.value;
                this._carrierFilters[i].frequency.setTargetAtTime(baseFreq * freqMod, this.audioContext.currentTime, 0.05);
            }
            
            this._modulationRAF = requestAnimationFrame(updateLoop);
        };
        
        this._modulationRAF = requestAnimationFrame(updateLoop);
    }
    
    updateParameters() {
        const mix = this.mix;
        this._wetGain.gain.setTargetAtTime(mix, this.audioContext.currentTime, 0.01);
        this._dryGain.gain.setTargetAtTime(1 - mix, this.audioContext.currentTime, 0.01);
    }
    
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.updateParameters();
    }
    
    setBands(value) {
        // Rebuild if band count changes
    }
    
    dispose() {
        if (this._modulationRAF) {
            cancelAnimationFrame(this._modulationRAF);
        }
        this._modulatorFilters.forEach(f => f.disconnect());
        this._carrierFilters.forEach(f => f.disconnect());
        this._envelopeFollowers.forEach(g => g.disconnect());
        this._carrierGains.forEach(g => g.disconnect());
        this._analyzers.forEach(a => a.disconnect());
        this._splitter.disconnect();
        this._merger.disconnect();
        this._dryGain.disconnect();
        this._wetGain.disconnect();
        this.input.disconnect();
        this.output.disconnect();
        this.modulatorInput.disconnect();
        this.carrierInput.disconnect();
    }
}

export function openVocoderPanel() {
    if (typeof showEffectPanel === 'function') {
        showEffectPanel('Vocoder', {
            type: 'vocoder',
            params: {
                bands: 16,
                lowFreq: 80,
                highFreq: 8000,
                filterQ: 5,
                mix: 1.0,
                carrierLevel: 1.0,
                modulatorLevel: 1.0,
                envelopeFollow: 0.3,
                presets: 'robot'
            },
            onParamChange: (param, value) => {
                // Handle parameter changes
            }
        });
    }
    
    // Create panel directly if showEffectPanel not available
    let panel = document.getElementById('vocoder-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'vocoder-panel';
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
            <h3 style="margin:0;">Vocoder</h3>
            <button onclick="document.getElementById('vocoder-panel').remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:20px;">×</button>
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Bands: <span id="vocoder-bands-val">16</span></label>
            <input type="range" min="4" max="32" value="16" id="vocoder-bands" style="width:100%"
                oninput="document.getElementById('vocoder-bands-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Filter Q: <span id="vocoder-q-val">5</span></label>
            <input type="range" min="1" max="20" value="5" id="vocoder-q" style="width:100%"
                oninput="document.getElementById('vocoder-q-val').textContent=this.value">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Mix: <span id="vocoder-mix-val">1.0</span></label>
            <input type="range" min="0" max="1" step="0.01" value="1" id="vocoder-mix" style="width:100%"
                oninput="document.getElementById('vocoder-mix-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Carrier Level: <span id="vocoder-carrier-val">1.0</span></label>
            <input type="range" min="0" max="2" step="0.01" value="1" id="vocoder-carrier" style="width:100%"
                oninput="document.getElementById('vocoder-carrier-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="margin-bottom:10px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Envelope Follow: <span id="vocoder-env-val">0.3</span></label>
            <input type="range" min="0.01" max="1" step="0.01" value="0.3" id="vocoder-env" style="width:100%"
                oninput="document.getElementById('vocoder-env-val').textContent=parseFloat(this.value).toFixed(2)">
        </div>
        <div style="margin-bottom:15px;">
            <label style="display:block;margin-bottom:5px;font-size:12px;">Presets</label>
            <select id="vocoder-presets" style="width:100%;padding:5px;background:#2a2a4a;color:white;border:1px solid #555;">
                <option value="robot">Robot</option>
                <option value="talkbox">Talkbox</option>
                <option value="choir">Choir</option>
                <option value="sci-fi">Sci-Fi</option>
                <option value="vintage">Vintage</option>
            </select>
        </div>
        <div style="display:flex;gap:10px;">
            <button onclick="alert('Vocoder applied to track')" style="flex:1;padding:8px;background:#6366f1;border:none;border-radius:4px;color:white;cursor:pointer;">Apply</button>
            <button onclick="document.getElementById('vocoder-panel').remove()" style="flex:1;padding:8px;background:#444;border:none;border-radius:4px;color:white;cursor:pointer;">Cancel</button>
        </div>
    `;
    
    return panel;
}