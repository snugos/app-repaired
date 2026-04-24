/**
 * GranularProcessor - Granular synthesis effect for time-stretching and pitch manipulation
 * Provides control over grain size, density, pitch, and spatialization
 */

class GranularProcessor {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.isActive = false;
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        this.dryNode = audioContext.createGain();
        this.wetNode = audioContext.createGain();
        
        // Grain parameters
        this.params = {
            grainSize: 0.1,        // seconds
            grainDensity: 10,       // grains per second
            pitchShift: 0,          // semitones
            pitchSpread: 0,         // semitones random spread
            timeStretch: 1,         // 1 = normal speed
            position: 0,            // 0-1 position in buffer
            positionSpread: 0.01,   // random position spread
            panSpread: 0.5,         // stereo spread
            grainAttack: 0.01,      // attack time
            grainRelease: 0.05,     // release time
            feedback: 0,            // feedback amount
            mix: 0.5,               // dry/wet mix
            bufferSize: 2           // buffer size in seconds
        };
        
        this.grainBuffer = null;
        this.grains = [];
        this.isProcessing = false;
        this.lastGrainTime = 0;
        this.scheduleAhead = 0.1;
        
        this.connectNodes();
    }
    
    connectNodes() {
        this.inputNode.connect(this.dryNode);
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
            }
        }
    }
    
    loadBuffer(audioBuffer) {
        this.grainBuffer = audioBuffer;
    }
    
    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.isProcessing = true;
        this.lastGrainTime = this.audioContext.currentTime;
        this.scheduleGrains();
    }
    
    stop() {
        this.isActive = false;
        this.isProcessing = false;
        this.grains.forEach(g => {
            try {
                g.source.stop();
            } catch (e) {}
        });
        this.grains = [];
    }
    
    scheduleGrains() {
        if (!this.isProcessing || !this.grainBuffer) return;
        
        const currentTime = this.audioContext.currentTime;
        const interval = 1 / this.params.grainDensity;
        
        while (this.lastGrainTime < currentTime + this.scheduleAhead) {
            this.createGrain(this.lastGrainTime);
            this.lastGrainTime += interval + (Math.random() - 0.5) * interval * 0.3;
        }
        
        if (this.isActive) {
            setTimeout(() => this.scheduleGrains(), 50);
        }
    }
    
    createGrain(time) {
        if (!this.grainBuffer) return;
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        const panNode = this.audioContext.createStereoPanner();
        
        // Calculate grain parameters
        const pitchRatio = Math.pow(2, (this.params.pitchShift + (Math.random() - 0.5) * this.params.pitchSpread) / 12);
        const duration = this.params.grainSize * (1 + (Math.random() - 0.5) * 0.2);
        const position = this.params.position + (Math.random() - 0.5) * this.params.positionSpread;
        const pan = (Math.random() - 0.5) * this.params.panSpread * 2;
        
        // Set up source
        source.buffer = this.grainBuffer;
        source.playbackRate.value = pitchRatio;
        
        // Calculate start position
        const startOffset = Math.max(0, Math.min(
            position * this.grainBuffer.duration,
            this.grainBuffer.duration - duration
        ));
        
        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(this.wetNode);
        panNode.pan.value = pan;
        
        // Envelope
        const attackTime = Math.min(this.params.grainAttack, duration * 0.5);
        const releaseTime = Math.min(this.params.grainRelease, duration * 0.5);
        
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(1, time + attackTime);
        gainNode.gain.setValueAtTime(1, time + duration - releaseTime);
        gainNode.gain.linearRampToValueAtTime(0, time + duration);
        
        // Start and stop
        source.start(time, startOffset, duration / pitchRatio);
        source.stop(time + duration + 0.01);
        
        const grain = { source, gainNode, panNode, time };
        this.grains.push(grain);
        
        source.onended = () => {
            const idx = this.grains.indexOf(grain);
            if (idx > -1) this.grains.splice(idx, 1);
        };
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

// Global granular processor instance
let granularProcessorInstance = null;

function openGranularProcessorPanel() {
    const existingPanel = document.getElementById('granular-processor-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'granular-processor-panel';
    panel.style.cssText = `
        position: fixed; top: 100px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #4a4a6a; border-radius: 8px; padding: 20px;
        width: 450px; z-index: 10000; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #e0e0e0; margin: 0; font-size: 18px;">Granular Processor</h2>
            <button id="closeGranular" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Grain Size (ms)</label>
            <input type="range" id="grainSize" min="10" max="500" value="100" style="width: 100%;">
            <span id="grainSizeVal" style="color: #e0e0e0; font-size: 12px;">100 ms</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Grain Density</label>
            <input type="range" id="grainDensity" min="1" max="50" value="10" style="width: 100%;">
            <span id="grainDensityVal" style="color: #e0e0e0; font-size: 12px;">10 grains/sec</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Pitch Shift (semitones)</label>
            <input type="range" id="pitchShift" min="-24" max="24" value="0" step="1" style="width: 100%;">
            <span id="pitchShiftVal" style="color: #e0e0e0; font-size: 12px;">0 st</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Pitch Spread</label>
            <input type="range" id="pitchSpread" min="0" max="12" value="0" step="0.5" style="width: 100%;">
            <span id="pitchSpreadVal" style="color: #e0e0e0; font-size: 12px;">0 st</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Position</label>
            <input type="range" id="position" min="0" max="100" value="0" style="width: 100%;">
            <span id="positionVal" style="color: #e0e0e0; font-size: 12px;">0%</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Position Spread</label>
            <input type="range" id="positionSpread" min="0" max="100" value="1" style="width: 100%;">
            <span id="positionSpreadVal" style="color: #e0e0e0; font-size: 12px;">1%</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Stereo Spread</label>
            <input type="range" id="panSpread" min="0" max="100" value="50" style="width: 100%;">
            <span id="panSpreadVal" style="color: #e0e0e0; font-size: 12px;">50%</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Grain Attack (ms)</label>
            <input type="range" id="grainAttack" min="1" max="100" value="10" style="width: 100%;">
            <span id="grainAttackVal" style="color: #e0e0e0; font-size: 12px;">10 ms</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Grain Release (ms)</label>
            <input type="range" id="grainRelease" min="5" max="200" value="50" style="width: 100%;">
            <span id="grainReleaseVal" style="color: #e0e0e0; font-size: 12px;">50 ms</span>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="color: #a0a0a0; font-size: 12px; display: block; margin-bottom: 4px;">Mix</label>
            <input type="range" id="granularMix" min="0" max="100" value="50" style="width: 100%;">
            <span id="granularMixVal" style="color: #e0e0e0; font-size: 12px;">50%</span>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="toggleGranular" style="flex: 1; padding: 12px; background: #4CAF50; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">Start</button>
            <button id="loadBuffer" style="flex: 1; padding: 12px; background: #2196F3; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">Load Buffer</button>
        </div>
        
        <div id="granularPresets" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #333;">
            <label style="color: #a0a0a0; font-size: 12px;">Presets</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                <button class="granular-preset" data-preset="timeStretch" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Time Stretch</button>
                <button class="granular-preset" data-preset="clouds" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Clouds</button>
                <button class="granular-preset" data-preset="octaveDown" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Octave Down</button>
                <button class="granular-preset" data-preset="shimmer" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Shimmer</button>
                <button class="granular-preset" data-preset="freeze" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Freeze</button>
                <button class="granular-preset" data-preset="chaos" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: #e0e0e0; cursor: pointer; font-size: 11px;">Chaos</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Close button
    document.getElementById('closeGranular').onclick = () => panel.remove();
    
    // Initialize processor
    if (!granularProcessorInstance && window.audioContext) {
        granularProcessorInstance = new GranularProcessor(window.audioContext);
    }
    
    // Toggle button
    const toggleBtn = document.getElementById('toggleGranular');
    toggleBtn.onclick = () => {
        if (!granularProcessorInstance) return;
        if (granularProcessorInstance.isActive) {
            granularProcessorInstance.stop();
            toggleBtn.textContent = 'Start';
            toggleBtn.style.background = '#4CAF50';
        } else {
            granularProcessorInstance.start();
            toggleBtn.textContent = 'Stop';
            toggleBtn.style.background = '#ef4444';
        }
    };
    
    // Parameter sliders
    const sliders = [
        { id: 'grainSize', param: 'grainSize', display: 'grainSizeVal', suffix: ' ms', scale: 0.001 },
        { id: 'grainDensity', param: 'grainDensity', display: 'grainDensityVal', suffix: ' grains/sec', scale: 1 },
        { id: 'pitchShift', param: 'pitchShift', display: 'pitchShiftVal', suffix: ' st', scale: 1 },
        { id: 'pitchSpread', param: 'pitchSpread', display: 'pitchSpreadVal', suffix: ' st', scale: 1 },
        { id: 'position', param: 'position', display: 'positionVal', suffix: '%', scale: 0.01 },
        { id: 'positionSpread', param: 'positionSpread', display: 'positionSpreadVal', suffix: '%', scale: 0.01 },
        { id: 'panSpread', param: 'panSpread', display: 'panSpreadVal', suffix: '%', scale: 0.01 },
        { id: 'grainAttack', param: 'grainAttack', display: 'grainAttackVal', suffix: ' ms', scale: 0.001 },
        { id: 'grainRelease', param: 'grainRelease', display: 'grainReleaseVal', suffix: ' ms', scale: 0.001 },
        { id: 'granularMix', param: 'mix', display: 'granularMixVal', suffix: '%', scale: 0.01 }
    ];
    
    sliders.forEach(({ id, param, display, suffix, scale }) => {
        const slider = document.getElementById(id);
        slider.oninput = () => {
            const value = slider.value * scale;
            document.getElementById(display).textContent = slider.value + suffix;
            if (granularProcessorInstance) {
                granularProcessorInstance.setParam(param, value);
            }
        };
    });
    
    // Presets
    const presets = {
        timeStretch: { grainSize: 0.2, grainDensity: 15, pitchShift: 0, pitchSpread: 0, position: 0.5, positionSpread: 0.02, panSpread: 0.3, grainAttack: 0.01, grainRelease: 0.08, mix: 0.7 },
        clouds: { grainSize: 0.5, grainDensity: 20, pitchShift: 0, pitchSpread: 5, position: 0.5, positionSpread: 0.3, panSpread: 1, grainAttack: 0.05, grainRelease: 0.2, mix: 0.8 },
        octaveDown: { grainSize: 0.15, grainDensity: 12, pitchShift: -12, pitchSpread: 0.5, position: 0.3, positionSpread: 0.05, panSpread: 0.2, grainAttack: 0.02, grainRelease: 0.05, mix: 0.6 },
        shimmer: { grainSize: 0.3, grainDensity: 25, pitchShift: 12, pitchSpread: 3, position: 0.5, positionSpread: 0.1, panSpread: 0.8, grainAttack: 0.03, grainRelease: 0.1, mix: 0.5 },
        freeze: { grainSize: 0.1, grainDensity: 30, pitchShift: 0, pitchSpread: 0, position: 0.5, positionSpread: 0.01, panSpread: 0.4, grainAttack: 0.01, grainRelease: 0.04, mix: 0.9 },
        chaos: { grainSize: 0.05, grainDensity: 40, pitchShift: 0, pitchSpread: 12, position: 0.5, positionSpread: 0.5, panSpread: 1, grainAttack: 0.001, grainRelease: 0.02, mix: 0.7 }
    };
    
    document.querySelectorAll('.granular-preset').forEach(btn => {
        btn.onclick = () => {
            const preset = presets[btn.dataset.preset];
            if (!preset || !granularProcessorInstance) return;
            
            Object.entries(preset).forEach(([param, value]) => {
                granularProcessorInstance.setParam(param, value);
            });
            
            // Update UI
            const paramMap = {
                grainSize: { id: 'grainSize', display: 'grainSizeVal', suffix: ' ms', inverse: v => v * 1000 },
                grainDensity: { id: 'grainDensity', display: 'grainDensityVal', suffix: ' grains/sec', inverse: v => v },
                pitchShift: { id: 'pitchShift', display: 'pitchShiftVal', suffix: ' st', inverse: v => v },
                pitchSpread: { id: 'pitchSpread', display: 'pitchSpreadVal', suffix: ' st', inverse: v => v },
                position: { id: 'position', display: 'positionVal', suffix: '%', inverse: v => v * 100 },
                positionSpread: { id: 'positionSpread', display: 'positionSpreadVal', suffix: '%', inverse: v => v * 100 },
                panSpread: { id: 'panSpread', display: 'panSpreadVal', suffix: '%', inverse: v => v * 100 },
                grainAttack: { id: 'grainAttack', display: 'grainAttackVal', suffix: ' ms', inverse: v => v * 1000 },
                grainRelease: { id: 'grainRelease', display: 'grainReleaseVal', suffix: ' ms', inverse: v => v * 1000 },
                mix: { id: 'granularMix', display: 'granularMixVal', suffix: '%', inverse: v => v * 100 }
            };
            
            Object.entries(paramMap).forEach(([param, config]) => {
                if (preset[param] !== undefined) {
                    document.getElementById(config.id).value = config.inverse(preset[param]);
                    document.getElementById(config.display).textContent = config.inverse(preset[param]) + config.suffix;
                }
            });
        };
    });
    
    // Load buffer button
    document.getElementById('loadBuffer').onclick = async () => {
        if (!window.audioContext) {
            alert('Audio context not available');
            return;
        }
        
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await window.audioContext.decodeAudioData(arrayBuffer);
            
            if (granularProcessorInstance) {
                granularProcessorInstance.loadBuffer(audioBuffer);
                alert(`Loaded: ${file.name}`);
            }
        };
        input.click();
    };
}

window.GranularProcessor = GranularProcessor;
window.openGranularProcessorPanel = openGranularProcessorPanel;