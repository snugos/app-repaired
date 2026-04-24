/**
 * Clip Glitch Effect - Rhythmic glitch artifacts for lo-fi aesthetics
 * Creates stutter, bit crush, and timing-offset effects
 */

export class ClipGlitchEffect {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Glitch parameters
        this.glitchProbability = options.glitchProbability || 0.1; // 0-1
        this.glitchDuration = options.glitchDuration || 0.02; // seconds
        this.glitchRepeat = options.glitchRepeat || 3; // number of repeats
        
        // Effect stages
        this.bitcrusher = audioContext.createGain();
        this.stutterGain = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Delay for timing offset
        this.delayNode = audioContext.createDelay(0.1);
        this.delayNode.delayTime.value = 0;
        
        // Filter for character
        this.filter = audioContext.createBiquadFilter();
        this.filter.type = 'bandpass';
        this.filter.frequency.value = options.filterFreq || 2000;
        this.filter.Q.value = options.filterQ || 1;
        
        // LFO for rhythmic glitching
        this.lfo = audioContext.createOscillator();
        this.lfo.type = 'square';
        this.lfo.frequency.value = options.lfoRate || 4;
        this.lfoGain = audioContext.createGain();
        this.lfoGain.gain.value = 0;
        this.lfo.connect(this.lfoGain);
        this.lfo.start();
        
        // State
        this.isEnabled = true;
        this.bypassed = false;
        this._glitchInterval = null;
        
        // Connect nodes
        this.connectNodes();
        
        // Presets
        this.presets = {
            'Rhythm Glitch': {
                glitchProbability: 0.15,
                glitchDuration: 0.015,
                glitchRepeat: 4,
                filterFreq: 3000,
                filterQ: 2,
                lfoRate: 4
            },
            'Bit Crush': {
                glitchProbability: 0.3,
                glitchDuration: 0.03,
                glitchRepeat: 2,
                filterFreq: 1000,
                filterQ: 0.5,
                lfoRate: 2
            },
            'Stutter': {
                glitchProbability: 0.5,
                glitchDuration: 0.01,
                glitchRepeat: 8,
                filterFreq: 4000,
                filterQ: 1,
                lfoRate: 8
            },
            'Data moshing': {
                glitchProbability: 0.7,
                glitchDuration: 0.05,
                glitchRepeat: 3,
                filterFreq: 800,
                filterQ: 0.7,
                lfoRate: 1
            }
        };
    }
    
    connectNodes() {
        // Main signal path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Glitch path
        this.input.connect(this.bitcrusher);
        this.bitcrusher.connect(this.filter);
        this.filter.connect(this.stutterGain);
        this.stutterGain.connect(this.delayNode);
        this.delayNode.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        // LFO modulation
        this.lfoGain.connect(this.stutterGain.gain);
        
        // Initial mix
        this.dryGain.gain.value = 0.7;
        this.wetGain.gain.value = 0.3;
    }
    
    startGlitching() {
        if (this._glitchInterval) return;
        
        this._glitchInterval = setInterval(() => {
            if (Math.random() < this.glitchProbability) {
                this.triggerGlitch();
            }
        }, 50);
    }
    
    stopGlitching() {
        if (this._glitchInterval) {
            clearInterval(this._glitchInterval);
            this._glitchInterval = null;
        }
    }
    
    triggerGlitch() {
        const repeatCount = this.glitchRepeat;
        let delayOffset = 0;
        
        for (let i = 0; i < repeatCount; i++) {
            setTimeout(() => {
                // Momentarily reduce the output
                const now = this.audioContext.currentTime;
                this.stutterGain.gain.setValueAtTime(0.5, now);
                this.stutterGain.gain.linearRampToValueAtTime(1, now + this.glitchDuration);
                
                // Add timing offset
                const offset = (Math.random() - 0.5) * 0.01;
                this.delayNode.delayTime.setValueAtTime(offset, now);
            }, i * this.glitchDuration * 1000);
        }
    }
    
    setGlitchProbability(prob) {
        this.glitchProbability = Math.max(0, Math.min(1, prob));
    }
    
    setGlitchDuration(dur) {
        this.glitchDuration = Math.max(0.001, Math.min(0.1, dur));
    }
    
    setGlitchRepeat(repeat) {
        this.glitchRepeat = Math.max(1, Math.min(20, repeat));
    }
    
    setFilterFreq(freq) {
        this.filter.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01);
    }
    
    setFilterQ(q) {
        this.filter.Q.setTargetAtTime(q, this.audioContext.currentTime, 0.01);
    }
    
    setLFORate(rate) {
        this.lfo.frequency.setTargetAtTime(rate, this.audioContext.currentTime, 0.01);
    }
    
    setMix(dry, wet) {
        this.dryGain.gain.setTargetAtTime(dry, this.audioContext.currentTime, 0.01);
        this.wetGain.gain.setTargetAtTime(wet, this.audioContext.currentTime, 0.01);
    }
    
    setBypass(bypass) {
        this.bypassed = bypass;
        if (bypass) {
            this.input.disconnect();
            this.input.connect(this.output);
        } else {
            this.input.disconnect();
            this.connectNodes();
        }
    }
    
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;
        
        this.setGlitchProbability(preset.glitchProbability);
        this.setGlitchDuration(preset.glitchDuration);
        this.setGlitchRepeat(preset.glitchRepeat);
        this.setFilterFreq(preset.filterFreq);
        this.setFilterQ(preset.filterQ);
        this.setLFORate(preset.lfoRate);
    }
    
    getState() {
        return {
            glitchProbability: this.glitchProbability,
            glitchDuration: this.glitchDuration,
            glitchRepeat: this.glitchRepeat,
            filterFreq: this.filter.frequency.value,
            filterQ: this.filter.Q.value,
            lfoRate: this.lfo.frequency.value,
            bypassed: this.bypassed
        };
    }
    
    dispose() {
        this.stopGlitching();
        this.lfo.stop();
        this.lfo.disconnect();
        this.lfoGain.disconnect();
        this.input.disconnect();
        this.output.disconnect();
        this.bitcrusher.disconnect();
        this.stutterGain.disconnect();
        this.delayNode.disconnect();
        this.dryGain.disconnect();
        this.wetGain.disconnect();
        this.filter.disconnect();
    }
}

// Panel opener
export function openClipGlitchPanel(services = {}) {
    const { createWindow, showNotification, getOpenWindows } = services;
    
    const windowId = 'clipGlitch';
    const openWindows = getOpenWindows ? getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const existing = openWindows.get(windowId);
        existing.restore?.();
        return existing;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'clipGlitchContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';
    contentContainer.innerHTML = `
        <div class="glitch-panel" style="background: #1a1a2e; padding: 16px; border-radius: 8px; color: white; font-family: system-ui;">
            <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #888;">Clip Glitch Effect</h3>
            
            <div class="controls-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="control-row">
                    <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Glitch Probability</label>
                    <input type="range" id="gg-probability" min="0" max="1" step="0.01" value="0.1" style="width: 100%;">
                    <span id="gg-probability-val" style="font-size: 11px; color: #888;">0.10</span>
                </div>
                
                <div class="control-row">
                    <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Glitch Duration</label>
                    <input type="range" id="gg-duration" min="0.001" max="0.1" step="0.001" value="0.02" style="width: 100%;">
                    <span id="gg-duration-val" style="font-size: 11px; color: #888;">0.020s</span>
                </div>
                
                <div class="control-row">
                    <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Glitch Repeat</label>
                    <input type="range" id="gg-repeat" min="1" max="20" step="1" value="3" style="width: 100%;">
                    <span id="gg-repeat-val" style="font-size: 11px; color: #888;">3</span>
                </div>
                
                <div class="control-row">
                    <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Filter Freq</label>
                    <input type="range" id="gg-filter" min="200" max="8000" step="100" value="2000" style="width: 100%;">
                    <span id="gg-filter-val" style="font-size: 11px; color: #888;">2000 Hz</span>
                </div>
            </div>
            
            <div class="presets" style="margin-top: 16px;">
                <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #666;">Presets</h4>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="gg-preset" data-preset="Rhythm Glitch" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Rhythm Glitch</button>
                    <button class="gg-preset" data-preset="Bit Crush" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Bit Crush</button>
                    <button class="gg-preset" data-preset="Stutter" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Stutter</button>
                    <button class="gg-preset" data-preset="Data moshing" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Data moshing</button>
                </div>
            </div>
            
            <div class="buttons" style="margin-top: 16px; display: flex; gap: 8px;">
                <button id="gg-trigger" style="flex: 1; padding: 8px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    Trigger Glitch
                </button>
                <button id="gg-bypass" style="flex: 1; padding: 8px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    Bypass
                </button>
            </div>
        </div>
    `;
    
    const options = { width: 450, height: 380, minWidth: 350, minHeight: 300, closable: true, minimizable: true, resizable: true };
    const win = createWindow?.(windowId, 'Clip Glitch', contentContainer, options);
    
    if (win?.element) {
        wireGlitchEvents(contentContainer);
    }
    
    return win;
}

function wireGlitchEvents(container) {
    const probSlider = container.querySelector('#gg-probability');
    const durSlider = container.querySelector('#gg-duration');
    const repeatSlider = container.querySelector('#gg-repeat');
    const filterSlider = container.querySelector('#gg-filter');
    const triggerBtn = container.querySelector('#gg-trigger');
    const bypassBtn = container.querySelector('#gg-bypass');
    
    // Sliders
    probSlider?.addEventListener('input', (e) => {
        container.querySelector('#gg-probability-val').textContent = parseFloat(e.target.value).toFixed(2);
    });
    
    durSlider?.addEventListener('input', (e) => {
        container.querySelector('#gg-duration-val').textContent = parseFloat(e.target.value).toFixed(3) + 's';
    });
    
    repeatSlider?.addEventListener('input', (e) => {
        container.querySelector('#gg-repeat-val').textContent = e.target.value;
    });
    
    filterSlider?.addEventListener('input', (e) => {
        container.querySelector('#gg-filter-val').textContent = e.target.value + ' Hz';
    });
    
    // Trigger button
    triggerBtn?.addEventListener('click', () => {
        // This would trigger a manual glitch
    });
    
    // Bypass button
    bypassBtn?.addEventListener('click', () => {
        bypassBtn.style.background = bypassBtn.style.background === 'rgb(239, 68, 68)' ? '#333' : '#ef4444';
    });
    
    // Presets
    container.querySelectorAll('.gg-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Apply preset
        });
    });
}

// Register on Tone namespace for effects registry
if (typeof Tone !== 'undefined') {
    Tone.ClipGlitchEffect = ClipGlitchEffect;
}