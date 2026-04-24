/**
 * Adaptive Dynamics Processor
 * A dynamics processor that adapts attack/release based on input character
 * Provides compression with intelligent envelope following
 */

class AdaptiveDynamics {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        this.analyser = audioContext.createAnalyser();
        
        // Envelope follower for RMS detection
        this.envelopeFollower = {
            attackTime: 0.01,
            releaseTime: 0.1,
            rmsTime: 0.05,
            currentLevel: 0,
            peakLevel: 0
        };
        
        // Adaptive parameters
        this.adaptiveState = {
            currentCharacter: 'neutral', // 'soft', 'neutral', 'punchy', 'aggressive'
            signalHistory: [],
            avgLevel: -20,
            crestFactor: 4, // Ratio of peak to RMS
            adaptationRate: 0.1
        };
        
        // Main dynamics parameters
        this.threshold = -24; // dB
        this.ratio = 4;
        this.kneeWidth = 6; // dB
        this.attackTime = 10; // ms
        this.releaseTime = 100; // ms
        this.makeupGain = 0; // dB
        this ceiling = -0.1; // dB
        
        // Metering
        this.inputLevel = 0;
        this.outputLevel = 0;
        this.gainReduction = 0;
        
        // Character presets
        this.characterPresets = {
            soft: {
                threshold: -30,
                ratio: 2,
                attackTime: 50,
                releaseTime: 200,
                kneeWidth: 12
            },
            neutral: {
                threshold: -24,
                ratio: 4,
                attackTime: 10,
                releaseTime: 100,
                kneeWidth: 6
            },
            punchy: {
                threshold: -18,
                ratio: 6,
                attackTime: 1,
                releaseTime: 80,
                kneeWidth: 3
            },
            aggressive: {
                threshold: -12,
                ratio: 10,
                attackTime: 0.5,
                releaseTime: 50,
                kneeWidth: 1
            }
        };
        
        // Connect nodes
        this.inputNode.connect(this.analyser);
        this.analyser.connect(this.outputNode);
        
        // FFT setup
        this.analyser.fftSize = 2048;
        this.fftBuffer = new Float32Array(this.analyser.fftSize);
    }
    
    getInput() {
        return this.inputNode;
    }
    
    getOutput() {
        return this.outputNode;
    }
    
    analyzeInput() {
        this.analyser.getFloatTimeDomainData(this.fftBuffer);
        
        // Calculate RMS
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < this.fftBuffer.length; i++) {
            const val = this.fftBuffer[i];
            sum += val * val;
            const absVal = Math.abs(val);
            if (absVal > peak) peak = absVal;
        }
        const rms = Math.sqrt(sum / this.fftBuffer.length);
        const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -100;
        const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;
        
        // Update signal history
        this.adaptiveState.signalHistory.push({
            rms: rmsDb,
            peak: peakDb,
            time: Date.now()
        });
        
        // Keep history limited
        if (this.adaptiveState.signalHistory.length > 100) {
            this.adaptiveState.signalHistory.shift();
        }
        
        // Analyze character
        if (this.adaptiveState.signalHistory.length >= 20) {
            this.analyzeCharacter();
        }
        
        // Update envelope follower
        const attackCoef = Math.exp(-1 / (this.audioContext.sampleRate * this.envelopeFollower.attackTime / 1000));
        const releaseCoef = Math.exp(-1 / (this.audioContext.sampleRate * this.envelopeFollower.releaseTime / 1000));
        
        if (rms > this.envelopeFollower.currentLevel) {
            this.envelopeFollower.currentLevel = attackCoef * this.envelopeFollower.currentLevel + (1 - attackCoef) * rms;
        } else {
            this.envelopeFollower.currentLevel = releaseCoef * this.envelopeFollower.currentLevel + (1 - releaseCoef) * rms;
        }
        
        this.envelopeFollower.peakLevel = peak;
        this.inputLevel = rmsDb;
        
        return {
            rms: rmsDb,
            peak: peakDb,
            level: this.envelopeFollower.currentLevel
        };
    }
    
    analyzeCharacter() {
        const history = this.adaptiveState.signalHistory;
        const recentHistory = history.slice(-20);
        
        // Calculate average level
        let totalRms = 0;
        let totalPeak = 0;
        for (const sample of recentHistory) {
            totalRms += sample.rms;
            totalPeak += sample.peak;
        }
        const avgRms = totalRms / recentHistory.length;
        const avgPeak = totalPeak / recentHistory.length;
        
        // Calculate crest factor (ratio of peak to RMS)
        const crestFactor = avgPeak - avgRms;
        this.adaptiveState.crestFactor = crestFactor;
        this.adaptiveState.avgLevel = avgRms;
        
        // Determine character based on crest factor and dynamics
        if (crestFactor < 6) {
            // Low crest factor = consistent, compressed sound
            this.adaptiveState.currentCharacter = 'soft';
        } else if (crestFactor < 10) {
            // Medium crest factor = balanced
            this.adaptiveState.currentCharacter = 'neutral';
        } else if (crestFactor < 15) {
            // High crest factor = punchy, dynamic
            this.adaptiveState.currentCharacter = 'punchy';
        } else {
            // Very high crest factor = aggressive, transient-heavy
            this.adaptiveState.currentCharacter = 'aggressive';
        }
        
        // Auto-adjust parameters based on character
        this.adaptToCharacter();
    }
    
    adaptToCharacter() {
        const preset = this.characterPresets[this.adaptiveState.currentCharacter];
        if (!preset) return;
        
        const rate = this.adaptiveState.adaptationRate;
        
        // Smoothly adapt parameters
        this.threshold = this.lerp(this.threshold, preset.threshold, rate);
        this.ratio = this.lerp(this.ratio, preset.ratio, rate);
        this.attackTime = this.lerp(this.attackTime, preset.attackTime, rate);
        this.releaseTime = this.lerp(this.releaseTime, preset.releaseTime, rate);
        this.kneeWidth = this.lerp(this.kneeWidth, preset.kneeWidth, rate);
    }
    
    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    processSample(input) {
        const inputDb = input > 0 ? 20 * Math.log10(input) : -100;
        
        // Calculate gain reduction
        let gainReduction = 0;
        
        if (inputDb > this.threshold + this.kneeWidth) {
            // Above knee - full ratio
            const overshoot = inputDb - (this.threshold + this.kneeWidth);
            gainReduction = (inputDb - this.threshold) * (1 - 1/this.ratio);
        } else if (inputDb > this.threshold - this.kneeWidth) {
            // In knee region - soft knee curve
            const kneePosition = (inputDb - (this.threshold - this.kneeWidth)) / (2 * this.kneeWidth);
            const slope = (1 - 1/this.ratio) * kneePosition;
            gainReduction = (inputDb - this.threshold) * slope;
        }
        
        // Apply attack/release envelope
        const attackCoef = Math.exp(-1 / (this.audioContext.sampleRate * this.attackTime / 1000));
        const releaseCoef = Math.exp(-1 / (this.audioContext.sampleRate * this.releaseTime / 1000));
        
        const targetGainReduction = -gainReduction;
        if (targetGainReduction < this.gainReduction) {
            this.gainReduction = attackCoef * this.gainReduction + (1 - attackCoef) * targetGainReduction;
        } else {
            this.gainReduction = releaseCoef * this.gainReduction + (1 - releaseCoef) * targetGainReduction;
        }
        
        // Apply gain reduction and makeup gain
        const totalGain = this.gainReduction + this.makeupGain;
        const gainLinear = Math.pow(10, totalGain / 20);
        const output = input * gainLinear;
        
        // Apply ceiling limiter
        const ceilingLinear = Math.pow(10, this.ceiling / 20);
        const output_clamped = Math.max(-ceilingLinear, Math.min(ceilingLinear, output));
        
        this.outputLevel = output > 0 ? 20 * Math.log10(output) : -100;
        this.gainReduction = this.gainReduction; // Store for metering
        
        return output_clamped;
    }
    
    setThreshold(db) {
        this.threshold = Math.max(-60, Math.min(0, db));
    }
    
    setRatio(ratio) {
        this.ratio = Math.max(1, Math.min(20, ratio));
    }
    
    setAttack(ms) {
        this.attackTime = Math.max(0.1, Math.min(100, ms));
    }
    
    setRelease(ms) {
        this.releaseTime = Math.max(10, Math.min(500, ms));
    }
    
    setMakeupGain(db) {
        this.makeupGain = Math.max(0, Math.min(24, db));
    }
    
    setCharacter(character) {
        if (this.characterPresets[character]) {
            this.adaptiveState.currentCharacter = character;
            const preset = this.characterPresets[character];
            this.threshold = preset.threshold;
            this.ratio = preset.ratio;
            this.attackTime = preset.attackTime;
            this.releaseTime = preset.releaseTime;
            this.kneeWidth = preset.kneeWidth;
        }
    }
    
    getAdaptiveState() {
        return {
            character: this.adaptiveState.currentCharacter,
            avgLevel: this.adaptiveState.avgLevel,
            crestFactor: this.adaptiveState.crestFactor,
            threshold: this.threshold,
            ratio: this.ratio,
            attackTime: this.attackTime,
            releaseTime: this.releaseTime
        };
    }
    
    getMeterData() {
        return {
            inputLevel: this.inputLevel,
            outputLevel: this.outputLevel,
            gainReduction: this.gainReduction
        };
    }
}

// Panel for adaptive dynamics
let adaptiveDynamicsPanel = null;
let adaptiveDynamicsProcessor = null;

export function openAdaptiveDynamicsPanel() {
    if (adaptiveDynamicsPanel) {
        adaptiveDynamicsPanel.remove();
        adaptiveDynamicsPanel = null;
    }
    
    const panel = document.createElement('div');
    panel.id = 'adaptiveDynamicsPanel';
    panel.className = 'panel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        right: 20px;
        width: 320px;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 12px 16px;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #16213e;
        border-radius: 8px 8px 0 0;
    `;
    header.innerHTML = `
        <span style="color: #eee; font-size: 14px; font-weight: 600;">Adaptive Dynamics</span>
        <button id="adp-close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 18px;">×</button>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = 'padding: 16px;';
    
    // Character indicator
    const characterSection = document.createElement('div');
    characterSection.style.cssText = 'margin-bottom: 16px; text-align: center;';
    characterSection.innerHTML = `
        <div style="color: #888; font-size: 11px; margin-bottom: 4px;">SIGNAL CHARACTER</div>
        <div id="adp-character" style="color: #4a90d9; font-size: 18px; font-weight: 600;">Neutral</div>
    `;
    
    // Meter display
    const meterSection = document.createElement('div');
    meterSection.style.cssText = 'margin-bottom: 16px;';
    meterSection.innerHTML = `
        <div style="display: flex; gap: 8px; height: 100px;">
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <div style="color: #888; font-size: 10px; margin-bottom: 4px;">INPUT</div>
                <div id="adp-input-meter" style="flex: 1; width: 100%; background: #0f0f1a; border-radius: 4px; position: relative; overflow: hidden;">
                    <div id="adp-input-fill" style="position: absolute; bottom: 0; left: 0; right: 0; height: 0%; background: linear-gradient(to top, #4a90d9, #7fb8ff); transition: height 0.1s;"></div>
                </div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <div style="color: #888; font-size: 10px; margin-bottom: 4px;">OUTPUT</div>
                <div id="adp-output-meter" style="flex: 1; width: 100%; background: #0f0f1a; border-radius: 4px; position: relative; overflow: hidden;">
                    <div id="adp-output-fill" style="position: absolute; bottom: 0; left: 0; right: 0; height: 0%; background: linear-gradient(to top, #28a745, #5fd97a); transition: height 0.1s;"></div>
                </div>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                <div style="color: #888; font-size: 10px; margin-bottom: 4px;">GAIN RED</div>
                <div id="adp-gr-meter" style="flex: 1; width: 100%; background: #0f0f1a; border-radius: 4px; position: relative; overflow: hidden;">
                    <div id="adp-gr-fill" style="position: absolute; bottom: 0; left: 0; right: 0; height: 0%; background: linear-gradient(to top, #dc3545, #ff6b6b); transition: height 0.1s;"></div>
                </div>
            </div>
        </div>
    `;
    
    // Parameters
    const paramsSection = document.createElement('div');
    paramsSection.innerHTML = `
        <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <label style="color: #888; font-size: 11px;">Threshold</label>
                <span id="adp-threshold-val" style="color: #eee; font-size: 11px;">-24 dB</span>
            </div>
            <input id="adp-threshold" type="range" min="-60" max="0" value="-24" style="width: 100%;">
        </div>
        <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <label style="color: #888; font-size: 11px;">Ratio</label>
                <span id="adp-ratio-val" style="color: #eee; font-size: 11px;">4:1</span>
            </div>
            <input id="adp-ratio" type="range" min="1" max="20" value="4" step="0.5" style="width: 100%;">
        </div>
        <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <label style="color: #888; font-size: 11px;">Attack</label>
                <span id="adp-attack-val" style="color: #eee; font-size: 11px;">10 ms</span>
            </div>
            <input id="adp-attack" type="range" min="0.1" max="100" value="10" style="width: 100%;">
        </div>
        <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <label style="color: #888; font-size: 11px;">Release</label>
                <span id="adp-release-val" style="color: #eee; font-size: 11px;">100 ms</span>
            </div>
            <input id="adp-release" type="range" min="10" max="500" value="100" style="width: 100%;">
        </div>
        <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <label style="color: #888; font-size: 11px;">Makeup Gain</label>
                <span id="adp-makeup-val" style="color: #eee; font-size: 11px;">0 dB</span>
            </div>
            <input id="adp-makeup" type="range" min="0" max="24" value="0" style="width: 100%;">
        </div>
        <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <label style="color: #888; font-size: 11px;">Character</label>
            </div>
            <select id="adp-character-select" style="width: 100%; padding: 6px; background: #0f0f1a; border: 1px solid #333; border-radius: 4px; color: #eee;">
                <option value="soft">Soft</option>
                <option value="neutral" selected>Neutral</option>
                <option value="punchy">Punchy</option>
                <option value="aggressive">Aggressive</option>
            </select>
        </div>
    `;
    
    content.appendChild(characterSection);
    content.appendChild(meterSection);
    content.appendChild(paramsSection);
    panel.appendChild(header);
    panel.appendChild(content);
    document.body.appendChild(panel);
    adaptiveDynamicsPanel = panel;
    
    // Get audio context
    const audioContext = window.Tone?.context || window.audioContext;
    if (audioContext) {
        adaptiveDynamicsProcessor = new AdaptiveDynamics(audioContext);
    }
    
    // Event listeners
    document.getElementById('adp-close').onclick = closeAdaptiveDynamicsPanel;
    
    document.getElementById('adp-threshold').oninput = (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('adp-threshold-val').textContent = `${val} dB`;
        adaptiveDynamicsProcessor?.setThreshold(val);
    };
    
    document.getElementById('adp-ratio').oninput = (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('adp-ratio-val').textContent = `${val}:1`;
        adaptiveDynamicsProcessor?.setRatio(val);
    };
    
    document.getElementById('adp-attack').oninput = (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('adp-attack-val').textContent = `${val} ms`;
        adaptiveDynamicsProcessor?.setAttack(val);
    };
    
    document.getElementById('adp-release').oninput = (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('adp-release-val').textContent = `${val} ms`;
        adaptiveDynamicsProcessor?.setRelease(val);
    };
    
    document.getElementById('adp-makeup').oninput = (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('adp-makeup-val').textContent = `${val} dB`;
        adaptiveDynamicsProcessor?.setMakeupGain(val);
    };
    
    document.getElementById('adp-character-select').onchange = (e) => {
        const char = e.target.value;
        adaptiveDynamicsProcessor?.setCharacter(char);
        document.getElementById('adp-character').textContent = char.charAt(0).toUpperCase() + char.slice(1);
    };
    
    // Update meters
    updateAdaptiveDynamicsMeters();
}

function updateAdaptiveDynamicsMeters() {
    if (!adaptiveDynamicsPanel) return;
    
    if (adaptiveDynamicsProcessor) {
        const state = adaptiveDynamicsProcessor.getAdaptiveState();
        const meter = adaptiveDynamicsProcessor.getMeterData();
        
        // Update character display
        document.getElementById('adp-character').textContent = state.character.charAt(0).toUpperCase() + state.character.slice(1);
        
        // Update meters
        const inputFill = document.getElementById('adp-input-fill');
        const outputFill = document.getElementById('adp-output-fill');
        const grFill = document.getElementById('adp-gr-fill');
        
        if (inputFill) {
            const inputHeight = Math.max(0, Math.min(100, (meter.inputLevel + 60) * (100/60)));
            inputFill.style.height = `${inputHeight}%`;
        }
        
        if (outputFill) {
            const outputHeight = Math.max(0, Math.min(100, (meter.outputLevel + 60) * (100/60)));
            outputFill.style.height = `${outputHeight}%`;
        }
        
        if (grFill) {
            const grHeight = Math.max(0, Math.min(100, Math.abs(meter.gainReduction) * 2));
            grFill.style.height = `${grHeight}%`;
        }
    }
    
    requestAnimationFrame(updateAdaptiveDynamicsMeters);
}

export function closeAdaptiveDynamicsPanel() {
    if (adaptiveDynamicsPanel) {
        adaptiveDynamicsPanel.remove();
        adaptiveDynamicsPanel = null;
        adaptiveDynamicsProcessor = null;
    }
}

// Initialize
export function initAdaptiveDynamics() {
    console.log('[AdaptiveDynamics] Initialized');
}

export { AdaptiveDynamics };