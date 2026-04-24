/**
 * FormantFilter - Vowel-shaped filter for vocal synthesis
 * Creates formant peaks to simulate vowel sounds
 */

class FormantFilter {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isActive = false;
        
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        this.dryNode = audioContext.createGain();
        this.wetNode = audioContext.createGain();
        
        // Create formant bandpass filters (typically 5 formants for vowels)
        this.formants = [];
        for (let i = 0; i < 5; i++) {
            const filter = audioContext.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.value = 10;
            this.formants.push({
                filter,
                frequency: 500,
                gain: 1,
                bandwidth: 50
            });
        }
        
        // Vowel presets with formant frequencies (F1-F5)
        this.vowels = {
            'a': { f1: 730, b1: 90, f2: 1090, b2: 110, f3: 2440, b3: 170, f4: 3500, b4: 250, f5: 4500, b5: 300 },
            'e': { f1: 530, b1: 90, f2: 1840, b2: 110, f3: 2480, b3: 170, f4: 3500, b4: 250, f5: 5000, b5: 300 },
            'i': { f1: 270, b1: 90, f2: 2290, b2: 110, f3: 3010, b3: 170, f4: 3500, b4: 250, f5: 5000, b5: 300 },
            'o': { f1: 570, b1: 90, f2: 840, b2: 110, f3: 2410, b3: 170, f4: 3500, b4: 250, f5: 4500, b5: 300 },
            'u': { f1: 300, b1: 90, f2: 870, b2: 110, f3: 2240, b3: 170, f4: 3500, b4: 250, f5: 4500, b5: 300 },
            'ae': { f1: 660, b1: 90, f2: 1720, b2: 110, f3: 2410, b3: 170, f4: 3500, b4: 250, f5: 5000, b5: 300 },
            'oo': { f1: 440, b1: 90, f2: 1020, b2: 110, f3: 2240, b3: 170, f4: 3500, b4: 250, f5: 4500, b5: 300 },
            'ee': { f1: 260, b1: 90, f2: 2310, b2: 110, f3: 3150, b3: 170, f4: 3800, b4: 250, f5: 5200, b5: 300 }
        };
        
        // Parameters
        this.params = {
            vowel: 'a',
            formant1: 730,
            formant2: 1090,
            formant3: 2440,
            formant4: 3500,
            formant5: 4500,
            bandwidth: 1,
            resonance: 10,
            mix: 0.5,
            glide: 0.1
        };
        
        this.connectNodes();
        this.setVowel('a');
    }
    
    connectNodes() {
        this.inputNode.connect(this.dryNode);
        
        // Connect formants in parallel
        this.formants.forEach(f => {
            this.inputNode.connect(f.filter);
            f.filter.connect(this.wetNode);
        });
        
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
            } else if (name === 'resonance') {
                this.formants.forEach(f => {
                    f.filter.Q.value = value;
                });
            } else if (name === 'bandwidth') {
                this.updateFormantBandwidths();
            } else if (name.startsWith('formant')) {
                const idx = parseInt(name.replace('formant', '')) - 1;
                if (idx >= 0 && idx < this.formants.length) {
                    this.setFormantFrequency(idx, value);
                }
            }
        }
    }
    
    setFormantFrequency(idx, freq) {
        const f = this.formants[idx];
        const glideTime = this.params.glide;
        
        if (glideTime > 0) {
            f.filter.frequency.linearRampToValueAtTime(freq, this.audioContext.currentTime + glideTime);
        } else {
            f.filter.frequency.value = freq;
        }
        f.frequency = freq;
    }
    
    updateFormantBandwidths() {
        const scale = this.params.bandwidth;
        this.formants.forEach((f, idx) => {
            const baseBandwidth = [90, 110, 170, 250, 300][idx];
            f.filter.Q.value = f.frequency / (baseBandwidth * scale);
        });
    }
    
    setVowel(vowel) {
        const preset = this.vowels[vowel];
        if (!preset) return;
        
        this.params.vowel = vowel;
        
        const frequencies = [preset.f1, preset.f2, preset.f3, preset.f4, preset.f5];
        const bandwidths = [preset.b1, preset.b2, preset.b3, preset.b4, preset.b5];
        
        this.formants.forEach((f, idx) => {
            this.setFormantFrequency(idx, frequencies[idx]);
            const scale = this.params.bandwidth;
            f.filter.Q.value = frequencies[idx] / (bandwidths[idx] * scale);
        });
    }
    
    morphVowel(from, to, amount) {
        const fromPreset = this.vowels[from] || this.vowels['a'];
        const toPreset = this.vowels[to] || this.vowels['a'];
        
        const fromFreqs = [fromPreset.f1, fromPreset.f2, fromPreset.f3, fromPreset.f4, fromPreset.f5];
        const toFreqs = [toPreset.f1, toPreset.f2, toPreset.f3, toPreset.f4, toPreset.f5];
        
        this.formants.forEach((f, idx) => {
            const freq = fromFreqs[idx] + (toFreqs[idx] - fromFreqs[idx]) * amount;
            this.setFormantFrequency(idx, freq);
        });
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

// Global formant filter instance
let formantFilterInstance = null;

function openFormantFilterPanel() {
    const existingPanel = document.getElementById('formant-filter-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'formant-filter-panel';
    panel.style.cssText = `
        position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #4a4a6a; border-radius: 8px; padding: 20px;
        width: 450px; z-index: 10000; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #e0e0e0; margin: 0; font-size: 18px;">Formant Filter</h2>
            <button id="closeFormant" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 8px;">Vowel</label>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="vowel-btn" data-vowel="a" style="padding: 10px 16px; background: #4CAF50; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">A</button>
                <button class="vowel-btn" data-vowel="e" style="padding: 10px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">E</button>
                <button class="vowel-btn" data-vowel="i" style="padding: 10px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">I</button>
                <button class="vowel-btn" data-vowel="o" style="padding: 10px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">O</button>
                <button class="vowel-btn" data-vowel="u" style="padding: 10px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">U</button>
                <button class="vowel-btn" data-vowel="ae" style="padding: 10px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">AE</button>
                <button class="vowel-btn" data-vowel="oo" style="padding: 10px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">OO</button>
                <button class="vowel-btn" data-vowel="ee" style="padding: 10px 16px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer;">EE</button>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Formant 1 (Hz)</label>
            <input type="range" id="formant1" min="200" max="1000" value="730" style="width: 100%;">
            <span id="formant1Val" style="color: #e0e0e0; font-size: 12px;">730 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Formant 2 (Hz)</label>
            <input type="range" id="formant2" min="500" max="2500" value="1090" style="width: 100%;">
            <span id="formant2Val" style="color: #e0e0e0; font-size: 12px;">1090 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Formant 3 (Hz)</label>
            <input type="range" id="formant3" min="2000" max="3500" value="2440" style="width: 100%;">
            <span id="formant3Val" style="color: #e0e0e0; font-size: 12px;">2440 Hz</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Resonance (Q)</label>
            <input type="range" id="formantResonance" min="1" max="30" value="10" step="0.5" style="width: 100%;">
            <span id="formantResonanceVal" style="color: #e0e0e0; font-size: 12px;">10</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Glide Time (s)</label>
            <input type="range" id="formantGlide" min="0" max="100" value="10" style="width: 100%;">
            <span id="formantGlideVal" style="color: #e0e0e0; font-size: 12px;">0.1 s</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Mix</label>
            <input type="range" id="formantMix" min="0" max="100" value="50" style="width: 100%;">
            <span id="formantMixVal" style="color: #e0e0e0; font-size: 12px;">50%</span>
        </div>
        
        <div id="formantVisualizer" style="height: 80px; background: #0a0a14; border-radius: 4px; margin-top: 16px; display: flex; align-items: flex-end; justify-content: space-around; padding: 10px;">
            <div class="formant-bar" style="width: 30px; background: #4CAF50; height: 50%; border-radius: 2px;"></div>
            <div class="formant-bar" style="width: 30px; background: #2196F3; height: 70%; border-radius: 2px;"></div>
            <div class="formant-bar" style="width: 30px; background: #FF9800; height: 60%; border-radius: 2px;"></div>
            <div class="formant-bar" style="width: 30px; background: #E91E63; height: 40%; border-radius: 2px;"></div>
            <div class="formant-bar" style="width: 30px; background: #9C27B0; height: 30%; border-radius: 2px;"></div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Close button
    document.getElementById('closeFormant').onclick = () => panel.remove();
    
    // Initialize processor
    if (!formantFilterInstance && window.audioContext) {
        formantFilterInstance = new FormantFilter(window.audioContext);
    }
    
    // Vowel buttons
    document.querySelectorAll('.vowel-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.vowel-btn').forEach(b => {
                b.style.background = '#333';
                b.style.color = '#e0e0e0';
            });
            btn.style.background = '#4CAF50';
            btn.style.color = 'white';
            
            if (formantFilterInstance) {
                formantFilterInstance.setVowel(btn.dataset.vowel);
                updateFormantUI();
            }
        };
    });
    
    // Parameter sliders
    const sliders = [
        { id: 'formant1', param: 'formant1', display: 'formant1Val', suffix: ' Hz', scale: 1 },
        { id: 'formant2', param: 'formant2', display: 'formant2Val', suffix: ' Hz', scale: 1 },
        { id: 'formant3', param: 'formant3', display: 'formant3Val', suffix: ' Hz', scale: 1 },
        { id: 'formantResonance', param: 'resonance', display: 'formantResonanceVal', suffix: '', scale: 1 },
        { id: 'formantGlide', param: 'glide', display: 'formantGlideVal', suffix: ' s', scale: 0.01 },
        { id: 'formantMix', param: 'mix', display: 'formantMixVal', suffix: '%', scale: 0.01 }
    ];
    
    sliders.forEach(({ id, param, display, suffix, scale }) => {
        const slider = document.getElementById(id);
        slider.oninput = () => {
            const value = slider.value * scale;
            document.getElementById(display).textContent = slider.value + suffix;
            if (formantFilterInstance) {
                formantFilterInstance.setParam(param, value);
            }
            updateFormantVisualizer();
        };
    });
    
    function updateFormantUI() {
        if (!formantFilterInstance) return;
        
        document.getElementById('formant1').value = formantFilterInstance.params.formant1;
        document.getElementById('formant1Val').textContent = formantFilterInstance.params.formant1 + ' Hz';
        document.getElementById('formant2').value = formantFilterInstance.params.formant2;
        document.getElementById('formant2Val').textContent = formantFilterInstance.params.formant2 + ' Hz';
        document.getElementById('formant3').value = formantFilterInstance.params.formant3;
        document.getElementById('formant3Val').textContent = formantFilterInstance.params.formant3 + ' Hz';
        updateFormantVisualizer();
    }
    
    function updateFormantVisualizer() {
        const bars = document.querySelectorAll('.formant-bar');
        const maxFreq = 5000;
        [formantFilterInstance?.params.formant1, 
         formantFilterInstance?.params.formant2, 
         formantFilterInstance?.params.formant3,
         formantFilterInstance?.params.formant4,
         formantFilterInstance?.params.formant5].forEach((freq, idx) => {
            if (bars[idx] && freq) {
                const height = (freq / maxFreq) * 100;
                bars[idx].style.height = height + '%';
            }
        });
    }
}

window.FormantFilter = FormantFilter;
window.openFormantFilterPanel = openFormantFilterPanel;