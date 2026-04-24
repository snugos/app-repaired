/**
 * Auto-Panner - Automatic panning with various patterns
 * Provides rhythmic and dynamic panning effects
 */

class AutoPanner {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        
        // Panner node
        this.panner = audioContext.createStereoPanner();
        
        // LFO for panning modulation
        this.lfo = audioContext.createOscillator();
        this.lfoGain = audioContext.createGain();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 1;
        this.lfoGain.gain.value = 1;
        
        // Connect LFO to panner
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.panner.pan);
        this.lfo.start();
        
        // Dry/wet mix
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        this.dryGain.gain.value = 0;
        this.wetGain.gain.value = 1;
        
        // Connect signal path
        this.input.connect(this.panner);
        this.panner.connect(this.wetGain);
        this.wetGain.connect(this.output);
        
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        
        // Configuration
        this.rate = options.rate || 1;
        this.depth = options.depth || 1;
        this.width = options.width || 1;
        this.phase = options.phase || 0;
        this.pattern = options.pattern || 'sine';
        this.syncMode = options.syncMode || 'free';
        this.syncRate = options.syncRate || '1/4';
        
        // Envelope follower for dynamic panning
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.input.connect(this.analyser);
        
        // Internal state
        this.isPlaying = false;
        this.currentPosition = 0;
        this.envelope = 0;
        
        // Presets
        this.presets = {
            'Gentle Sway': {
                rate: 0.5,
                depth: 0.5,
                width: 0.8,
                pattern: 'sine',
                syncMode: 'free'
            },
            'Fast Tremolo': {
                rate: 6,
                depth: 0.9,
                width: 1,
                pattern: 'triangle',
                syncMode: 'free'
            },
            'Slow Wander': {
                rate: 0.1,
                depth: 1,
                width: 1,
                pattern: 'sine',
                syncMode: 'free'
            },
            'Rhythmic 1/4': {
                rate: 1,
                depth: 0.8,
                width: 1,
                pattern: 'square',
                syncMode: 'sync',
                syncRate: '1/4'
            },
            'Rhythmic 1/8': {
                rate: 2,
                depth: 0.7,
                width: 1,
                pattern: 'square',
                syncMode: 'sync',
                syncRate: '1/8'
            },
            'Rhythmic 1/16': {
                rate: 4,
                depth: 0.6,
                width: 1,
                pattern: 'square',
                syncMode: 'sync',
                syncRate: '1/16'
            },
            'Auto Pan Wide': {
                rate: 0.3,
                depth: 1,
                width: 1,
                pattern: 'sine',
                syncMode: 'free'
            },
            'Pendulum': {
                rate: 0.8,
                depth: 1,
                width: 1,
                pattern: 'triangle',
                syncMode: 'free'
            },
            'Random Jump': {
                rate: 2,
                depth: 1,
                width: 1,
                pattern: 'random',
                syncMode: 'free'
            },
            'Triggered Pan': {
                rate: 1,
                depth: 1,
                width: 1,
                pattern: 'trigger',
                syncMode: 'free'
            },
            'Ping Pong': {
                rate: 1,
                depth: 1,
                width: 1,
                pattern: 'pingpong',
                syncMode: 'free'
            },
            'Circular': {
                rate: 0.5,
                depth: 0.8,
                width: 1,
                pattern: 'circular',
                syncMode: 'free'
            }
        };
        
        this.patterns = ['sine', 'triangle', 'square', 'sawtooth', 'random', 'trigger', 'pingpong', 'circular'];
        this.syncRates = ['1/16', '1/8', '1/4', '1/2', '1', '2', '4'];
        
        // Random pan state
        this.lastRandomPan = 0;
        this.randomTarget = 0;
        
        // Trigger state
        this.lastEnvelope = 0;
        this.triggerThreshold = 0.1;
        
        // Ping pong state
        this.pingPongSide = -1;
        
        // Circular state
        this.circularPhase = 0;
    }
    
    setRate(rate) {
        this.rate = Math.max(0.01, Math.min(20, rate));
        this.lfo.frequency.value = this.rate;
    }
    
    setDepth(depth) {
        this.depth = Math.max(0, Math.min(1, depth));
        this.lfoGain.gain.value = this.depth * this.width;
    }
    
    setWidth(width) {
        this.width = Math.max(0, Math.min(1, width));
        this.lfoGain.gain.value = this.depth * this.width;
    }
    
    setPhase(phase) {
        this.phase = phase;
        // Phase is set by advancing the oscillator
    }
    
    setPattern(pattern) {
        this.pattern = pattern;
        
        // Set LFO type if standard waveform
        const standardTypes = ['sine', 'triangle', 'square', 'sawtooth'];
        if (standardTypes.includes(pattern)) {
            this.lfo.type = pattern;
        } else {
            // For custom patterns, use sine and modulate manually
            this.lfo.type = 'sine';
        }
    }
    
    setSyncMode(mode) {
        this.syncMode = mode;
    }
    
    setSyncRate(rate) {
        this.syncRate = rate;
    }
    
    setMix(mix) {
        this.dryGain.gain.value = 1 - mix;
        this.wetGain.gain.value = mix;
    }
    
    // Calculate sync rate in Hz based on BPM
    calculateSyncRate(bpm) {
        const beatDuration = 60 / bpm;
        const rateMultipliers = {
            '1/16': 4,
            '1/8': 2,
            '1/4': 1,
            '1/2': 0.5,
            '1': 0.25,
            '2': 0.125,
            '4': 0.0625
        };
        
        const multiplier = rateMultipliers[this.syncRate] || 1;
        return (1 / beatDuration) * multiplier;
    }
    
    // Sync to tempo
    syncToTempo(bpm) {
        if (this.syncMode === 'sync') {
            const rate = this.calculateSyncRate(bpm);
            this.lfo.frequency.value = rate;
        }
    }
    
    // Get current pan position (-1 to 1)
    getPanPosition() {
        return this.panner.pan.value;
    }
    
    // Custom pattern processing
    processCustomPatterns(deltaTime) {
        const time = this.audioContext.currentTime;
        
        switch (this.pattern) {
            case 'random':
                // Random pan at rate
                if (Math.random() < deltaTime * this.rate) {
                    this.randomTarget = (Math.random() * 2 - 1) * this.depth * this.width;
                }
                // Smooth to target
                this.panner.pan.value += (this.randomTarget - this.panner.pan.value) * 0.1;
                break;
                
            case 'trigger':
                // Trigger-based panning
                const dataArray = new Float32Array(this.analyser.fftSize);
                this.analyser.getFloatTimeDomainData(dataArray);
                
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += Math.abs(dataArray[i]);
                }
                this.envelope = sum / dataArray.length;
                
                // Detect trigger (rising edge)
                if (this.envelope > this.triggerThreshold && this.lastEnvelope <= this.triggerThreshold) {
                    this.pingPongSide *= -1;
                    this.panner.pan.setTargetAtTime(this.pingPongSide * this.depth * this.width, time, 0.01);
                }
                
                this.lastEnvelope = this.envelope;
                break;
                
            case 'pingpong':
                // Alternate between left and right at rate
                const period = 1 / this.rate;
                const phase = (time % period) / period;
                
                if (phase < 0.5) {
                    this.panner.pan.setTargetAtTime(-this.depth * this.width, time, 0.001);
                } else {
                    this.panner.pan.setTargetAtTime(this.depth * this.width, time, 0.001);
                }
                break;
                
            case 'circular':
                // Circular panning with phase shift
                this.circularPhase += deltaTime * this.rate * 2 * Math.PI;
                const circularPan = Math.sin(this.circularPhase) * this.depth * this.width;
                this.panner.pan.value = circularPan;
                break;
        }
    }
    
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) return;
        
        this.setRate(preset.rate);
        this.setDepth(preset.depth);
        this.setWidth(preset.width);
        this.setPattern(preset.pattern);
        this.setSyncMode(preset.syncMode);
        if (preset.syncRate) this.setSyncRate(preset.syncRate);
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
}

/**
 * Create Auto-Panner UI Panel
 */
export function openAutoPannerPanel(services = {}) {
    const { audioContext, masterOutput, bpm = 120, container = document.body } = services;
    
    if (!audioContext) {
        console.error('Auto-Panner: audioContext required');
        return null;
    }
    
    // Create auto-panner instance
    const autoPanner = new AutoPanner(audioContext);
    
    // Create UI container
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #3a3a5e;
        border-radius: 12px;
        padding: 20px;
        min-width: 500px;
        max-width: 650px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #3a3a5e;
    `;
    header.innerHTML = `
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #00bcd4;">🔊 Auto-Panner</h2>
        <button id="close-btn" style="background: #00bcd4; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; color: white;">✕ Close</button>
    `;
    panel.appendChild(header);
    
    // Preset selector
    const presetSection = document.createElement('div');
    presetSection.style.cssText = 'margin-bottom: 20px;';
    presetSection.innerHTML = `
        <label style="font-size: 14px; color: #a0a0a0; display: block; margin-bottom: 8px;">Preset</label>
        <select id="preset-select" style="
            width: 100%;
            padding: 10px;
            background: #0a0a14;
            border: 1px solid #3a3a5e;
            border-radius: 6px;
            color: #e0e0e0;
            font-size: 14px;
        ">
            <option value="">-- Select Preset --</option>
            ${Object.keys(autoPanner.presets).map(name => `<option value="${name}">${name}</option>`).join('')}
        </select>
    `;
    panel.appendChild(presetSection);
    
    // Main controls
    const controlsSection = document.createElement('div');
    controlsSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        margin-bottom: 20px;
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
    `;
    controlsSection.innerHTML = `
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Rate (Hz)</label>
            <input type="range" id="rate-control" min="1" max="200" value="100" style="width: 100%;">
            <span id="rate-val" style="font-size: 12px; color: #00bcd4;">1.00 Hz</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Depth</label>
            <input type="range" id="depth-control" min="0" max="100" value="100" style="width: 100%;">
            <span id="depth-val" style="font-size: 12px; color: #00bcd4;">100%</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Width</label>
            <input type="range" id="width-control" min="0" max="100" value="100" style="width: 100%;">
            <span id="width-val" style="font-size: 12px; color: #00bcd4;">100%</span>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Mix</label>
            <input type="range" id="mix-control" min="0" max="100" value="100" style="width: 100%;">
            <span id="mix-val" style="font-size: 12px; color: #00bcd4;">100%</span>
        </div>
    `;
    panel.appendChild(controlsSection);
    
    // Pattern selection
    const patternSection = document.createElement('div');
    patternSection.style.cssText = `
        margin-bottom: 20px;
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
    `;
    patternSection.innerHTML = `
        <label style="font-size: 14px; color: #a0a0a0; display: block; margin-bottom: 10px;">Pattern</label>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            ${autoPanner.patterns.map(p => `
                <button class="pattern-btn" data-pattern="${p}" style="padding: 10px; background: ${p === 'sine' ? '#00bcd4' : '#0a0a14'}; border: 1px solid #3a3a5e; border-radius: 6px; color: ${p === 'sine' ? 'white' : '#e0e0e0'}; cursor: pointer; font-size: 12px; text-transform: capitalize;">${p}</button>
            `).join('')}
        </div>
    `;
    panel.appendChild(patternSection);
    
    // Sync options
    const syncSection = document.createElement('div');
    syncSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        margin-bottom: 20px;
        padding: 15px;
        background: #0a0a14;
        border-radius: 8px;
    `;
    syncSection.innerHTML = `
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Sync Mode</label>
            <select id="sync-mode" style="width: 100%; padding: 10px; background: #1a1a2e; border: 1px solid #3a3a5e; border-radius: 6px; color: #e0e0e0;">
                <option value="free">Free</option>
                <option value="sync">Tempo Sync</option>
            </select>
        </div>
        <div>
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 5px;">Sync Rate</label>
            <select id="sync-rate" style="width: 100%; padding: 10px; background: #1a1a2e; border: 1px solid #3a3a5e; border-radius: 6px; color: #e0e0e0;">
                ${autoPanner.syncRates.map(r => `<option value="${r}" ${r === '1/4' ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
        </div>
    `;
    panel.appendChild(syncSection);
    
    // Pan position meter
    const meterSection = document.createElement('div');
    meterSection.style.cssText = `
        padding: 15px;
        background: #1a1a2e;
        border-radius: 8px;
    `;
    meterSection.innerHTML = `
        <div style="text-align: center;">
            <label style="font-size: 12px; color: #a0a0a0; display: block; margin-bottom: 10px;">Pan Position</label>
            <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                <span style="font-size: 14px; color: #a0a0a0;">L</span>
                <div style="flex: 1; max-width: 300px; height: 20px; background: #0a0a14; border-radius: 10px; position: relative;">
                    <div id="pan-indicator" style="position: absolute; width: 10px; height: 20px; background: #00bcd4; border-radius: 5px; left: 50%; transform: translateX(-50%);"></div>
                </div>
                <span style="font-size: 14px; color: #a0a0a0;">R</span>
            </div>
            <div id="pan-value" style="font-size: 16px; font-weight: bold; color: #00bcd4; margin-top: 10px;">C</div>
        </div>
    `;
    panel.appendChild(meterSection);
    
    container.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-btn').onclick = () => {
        panel.remove();
    };
    
    document.getElementById('preset-select').onchange = (e) => {
        if (e.target.value) {
            autoPanner.applyPreset(e.target.value);
            updateUIFromAutoPanner();
        }
    };
    
    // Rate control
    document.getElementById('rate-control').oninput = (e) => {
        const rate = parseInt(e.target.value) / 100;
        autoPanner.setRate(rate);
        document.getElementById('rate-val').textContent = `${rate.toFixed(2)} Hz`;
    };
    
    // Depth control
    document.getElementById('depth-control').oninput = (e) => {
        autoPanner.setDepth(parseInt(e.target.value) / 100);
        document.getElementById('depth-val').textContent = `${e.target.value}%`;
    };
    
    // Width control
    document.getElementById('width-control').oninput = (e) => {
        autoPanner.setWidth(parseInt(e.target.value) / 100);
        document.getElementById('width-val').textContent = `${e.target.value}%`;
    };
    
    // Mix control
    document.getElementById('mix-control').oninput = (e) => {
        autoPanner.setMix(parseInt(e.target.value) / 100);
        document.getElementById('mix-val').textContent = `${e.target.value}%`;
    };
    
    // Pattern buttons
    document.querySelectorAll('.pattern-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.pattern-btn').forEach(b => {
                b.style.background = '#0a0a14';
                b.style.color = '#e0e0e0';
            });
            e.target.style.background = '#00bcd4';
            e.target.style.color = 'white';
            autoPanner.setPattern(e.target.dataset.pattern);
        };
    });
    
    // Sync mode
    document.getElementById('sync-mode').onchange = (e) => {
        autoPanner.setSyncMode(e.target.value);
        if (e.target.value === 'sync') {
            autoPanner.syncToTempo(bpm);
        }
    };
    
    // Sync rate
    document.getElementById('sync-rate').onchange = (e) => {
        autoPanner.setSyncRate(e.target.value);
        if (autoPanner.syncMode === 'sync') {
            autoPanner.syncToTempo(bpm);
        }
    };
    
    function updateUIFromAutoPanner() {
        document.getElementById('rate-control').value = autoPanner.rate * 100;
        document.getElementById('rate-val').textContent = `${autoPanner.rate.toFixed(2)} Hz`;
        
        document.getElementById('depth-control').value = autoPanner.depth * 100;
        document.getElementById('depth-val').textContent = `${Math.round(autoPanner.depth * 100)}%`;
        
        document.getElementById('width-control').value = autoPanner.width * 100;
        document.getElementById('width-val').textContent = `${Math.round(autoPanner.width * 100)}%`;
        
        document.getElementById('sync-mode').value = autoPanner.syncMode;
        document.getElementById('sync-rate').value = autoPanner.syncRate;
        
        // Update pattern buttons
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.style.background = btn.dataset.pattern === autoPanner.pattern ? '#00bcd4' : '#0a0a14';
            btn.style.color = btn.dataset.pattern === autoPanner.pattern ? 'white' : '#e0e0e0';
        });
    }
    
    // Update pan meter
    function updatePanMeter() {
        const pan = autoPanner.getPanPosition();
        const indicator = document.getElementById('pan-indicator');
        const value = document.getElementById('pan-value');
        
        // Position indicator (0% = left, 50% = center, 100% = right)
        const position = ((pan + 1) / 2) * 100;
        indicator.style.left = `${position}%`;
        
        // Update value text
        if (Math.abs(pan) < 0.05) {
            value.textContent = 'C';
        } else if (pan < 0) {
            value.textContent = `L${Math.round(Math.abs(pan) * 100)}`;
        } else {
            value.textContent = `R${Math.round(pan * 100)}`;
        }
        
        requestAnimationFrame(updatePanMeter);
    }
    updatePanMeter();
    
    return autoPanner;
}

export { AutoPanner };
export default AutoPanner;
// Register on Tone namespace for effectsRegistry.createEffectInstance
if (typeof Tone !== 'undefined') {
    Tone.AutoPanner = AutoPanner;
}
