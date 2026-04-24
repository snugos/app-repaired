/**
 * TextureSynthesizer - Generates atmospheric textures from noise
 * Creates ambient soundscapes, pads, and evolving textures
 */

export class TextureSynthesizer {
    constructor(options = {}) {
        this.name = 'TextureSynthesizer';
        
        // Configuration
        this.density = options.density ?? 0.5;        // Grain density
        this.grainSize = options.grainSize ?? 0.1;     // Grain size in seconds
        this.pitchVariation = options.pitchVariation ?? 0.2; // Pitch randomization
        this.spatialSpread = options.spatialSpread ?? 0.5; // Stereo spread
        this.filterFreq = options.filterFreq ?? 2000; // Filter cutoff
        this.filterRes = options.filterRes ?? 1;      // Filter resonance
        this.attack = options.attack ?? 0.5;          // Attack time
        this.release = options.release ?? 2;          // Release time
        this.amp = options.amp ?? 0.3;                // Amplitude
        
        // Noise source type
        this.noiseType = options.noiseType ?? 'pink'; // 'white', 'pink', 'brown', 'crackle'
        
        // State
        this.isPlaying = false;
        this.sampleRate = 44100;
        this.phase = 0;
        
        // Grain buffer
        this.grainBuffer = null;
        this.grainIndex = 0;
        this.grainLength = 0;
        
        // Filter state
        this.filterState = {
            x1: 0, x2: 0, y1: 0, y2: 0
        };
        
        // Generate initial grain
        this._generateGrain();
    }
    
    /**
     * Generate a noise grain
     */
    _generateGrain() {
        this.grainLength = Math.floor(this.grainSize * this.sampleRate);
        this.grainBuffer = new Float32Array(this.grainLength);
        
        // Generate noise based on type
        switch (this.noiseType) {
            case 'white':
                this._generateWhiteNoise();
                break;
            case 'pink':
                this._generatePinkNoise();
                break;
            case 'brown':
                this._generateBrownNoise();
                break;
            case 'crackle':
                this._generateCrackle();
                break;
            case 'vinyl':
                this._generateVinylNoise();
                break;
            case 'wind':
                this._generateWindNoise();
                break;
            default:
                this._generatePinkNoise();
        }
        
        // Apply window (Hann window)
        for (let i = 0; i < this.grainLength; i++) {
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.grainLength));
            this.grainBuffer[i] *= window;
        }
    }
    
    /**
     * Generate white noise
     */
    _generateWhiteNoise() {
        for (let i = 0; i < this.grainLength; i++) {
            this.grainBuffer[i] = Math.random() * 2 - 1;
        }
    }
    
    /**
     * Generate pink noise (1/f noise)
     */
    _generatePinkNoise() {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        
        for (let i = 0; i < this.grainLength; i++) {
            const white = Math.random() * 2 - 1;
            
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            
            this.grainBuffer[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }
    }
    
    /**
     * Generate brown noise (1/f² noise)
     */
    _generateBrownNoise() {
        let lastOut = 0;
        
        for (let i = 0; i < this.grainLength; i++) {
            const white = Math.random() * 2 - 1;
            const output = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output;
            this.grainBuffer[i] = output * 3.5;
        }
    }
    
    /**
     * Generate crackle noise
     */
    _generateCrackle() {
        const density = this.density * 0.1;
        
        for (let i = 0; i < this.grainLength; i++) {
            if (Math.random() < density) {
                this.grainBuffer[i] = (Math.random() * 2 - 1) * (0.5 + Math.random() * 0.5);
            } else {
                this.grainBuffer[i] = 0;
            }
        }
    }
    
    /**
     * Generate vinyl-like noise
     */
    _generateVinylNoise() {
        // Base brown noise
        let lastOut = 0;
        
        for (let i = 0; i < this.grainLength; i++) {
            const white = Math.random() * 2 - 1;
            const brown = (lastOut + (0.02 * white)) / 1.02;
            lastOut = brown;
            
            // Add occasional clicks/pops
            const click = Math.random() < 0.001 ? (Math.random() * 2 - 1) * 0.5 : 0;
            
            // Add rumble
            const rumble = Math.sin(i * 0.001) * 0.1;
            
            this.grainBuffer[i] = (brown * 0.5 + click + rumble) * 2;
        }
    }
    
    /**
     * Generate wind-like noise
     */
    _generateWindNoise() {
        let phase = 0;
        const modFreq = 0.5 + Math.random() * 1;
        
        for (let i = 0; i < this.grainLength; i++) {
            // Modulated bandpass noise
            const white = Math.random() * 2 - 1;
            const mod = 0.5 + 0.5 * Math.sin(phase);
            phase += modFreq * 2 * Math.PI / this.sampleRate;
            
            // Simple lowpass
            const filtered = white * 0.3 + (this.grainBuffer[i - 1] || 0) * 0.7;
            
            this.grainBuffer[i] = filtered * mod;
        }
    }
    
    /**
     * Process and generate texture audio
     * @param {number} numSamples - Number of samples to generate
     * @returns {object} Left and right channel buffers
     */
    process(numSamples) {
        const left = new Float32Array(numSamples);
        const right = new Float32Array(numSamples);
        
        const attackSamples = Math.floor(this.attack * this.sampleRate);
        const releaseSamples = Math.floor(this.release * this.sampleRate);
        
        for (let i = 0; i < numSamples; i++) {
            // Check if we need a new grain based on density
            if (this.grainIndex >= this.grainLength || Math.random() < this.density * 0.01) {
                // Regenerate grain with pitch variation
                const pitchShift = 1 + (Math.random() * 2 - 1) * this.pitchVariation;
                const newLength = Math.floor(this.grainLength / pitchShift);
                
                if (this.grainIndex >= this.grainLength) {
                    this._generateGrain();
                    this.grainIndex = 0;
                }
            }
            
            // Get sample from grain
            let sample = 0;
            if (this.grainBuffer && this.grainIndex < this.grainLength) {
                sample = this.grainBuffer[this.grainIndex];
                this.grainIndex++;
            }
            
            // Apply filter
            sample = this._applyFilter(sample);
            
            // Apply envelope
            let envelope = 1;
            const pos = this.phase / (attackSamples + releaseSamples + numSamples);
            if (this.phase < attackSamples) {
                envelope = this.phase / attackSamples;
            }
            
            sample *= envelope * this.amp;
            
            // Apply spatial spread
            const panAngle = (Math.random() - 0.5) * this.spatialSpread * Math.PI;
            const leftGain = Math.cos(panAngle);
            const rightGain = Math.sin(panAngle);
            
            left[i] = sample * leftGain;
            right[i] = sample * rightGain;
            
            this.phase++;
        }
        
        return { left, right };
    }
    
    /**
     * Apply a lowpass filter to the sample
     * @param {number} sample - Input sample
     * @returns {number} Filtered sample
     */
    _applyFilter(sample) {
        const w0 = 2 * Math.PI * this.filterFreq / this.sampleRate;
        const Q = this.filterRes;
        const alpha = Math.sin(w0) / (2 * Q);
        
        const b0 = (1 - Math.cos(w0)) / 2;
        const b1 = 1 - Math.cos(w0);
        const b2 = (1 - Math.cos(w0)) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - alpha;
        
        const y = (b0 / a0) * sample + 
                  (b1 / a0) * this.filterState.x1 + 
                  (b2 / a0) * this.filterState.x2 -
                  (a1 / a0) * this.filterState.y1 - 
                  (a2 / a0) * this.filterState.y2;
        
        this.filterState.x2 = this.filterState.x1;
        this.filterState.x1 = sample;
        this.filterState.y2 = this.filterState.y1;
        this.filterState.y1 = y;
        
        return y;
    }
    
    /**
     * Start generating texture
     */
    start() {
        this.isPlaying = true;
        this.phase = 0;
        this.grainIndex = 0;
    }
    
    /**
     * Stop generating texture
     */
    stop() {
        this.isPlaying = false;
    }
    
    /**
     * Set noise type
     * @param {string} type - Noise type ('white', 'pink', 'brown', 'crackle', 'vinyl', 'wind')
     */
    setNoiseType(type) {
        const validTypes = ['white', 'pink', 'brown', 'crackle', 'vinyl', 'wind'];
        if (validTypes.includes(type)) {
            this.noiseType = type;
            this._generateGrain();
        }
    }
    
    /**
     * Apply a preset
     * @param {string} preset - Preset name
     */
    applyPreset(preset) {
        const presets = {
            'ambient': {
                noiseType: 'pink',
                density: 0.3,
                grainSize: 0.5,
                pitchVariation: 0.1,
                spatialSpread: 0.8,
                filterFreq: 1500,
                filterRes: 0.7,
                attack: 2,
                release: 3,
                amp: 0.2
            },
            'rain': {
                noiseType: 'white',
                density: 0.7,
                grainSize: 0.05,
                pitchVariation: 0.05,
                spatialSpread: 1,
                filterFreq: 3000,
                filterRes: 0.5,
                attack: 0.1,
                release: 0.3,
                amp: 0.15
            },
            'wind': {
                noiseType: 'wind',
                density: 0.5,
                grainSize: 1,
                pitchVariation: 0.2,
                spatialSpread: 0.6,
                filterFreq: 800,
                filterRes: 0.8,
                attack: 3,
                release: 4,
                amp: 0.25
            },
            'fire': {
                noiseType: 'crackle',
                density: 0.6,
                grainSize: 0.1,
                pitchVariation: 0.15,
                spatialSpread: 0.4,
                filterFreq: 1200,
                filterRes: 1,
                attack: 0.5,
                release: 1,
                amp: 0.3
            },
            'vinyl': {
                noiseType: 'vinyl',
                density: 0.8,
                grainSize: 0.2,
                pitchVariation: 0.02,
                spatialSpread: 0.2,
                filterFreq: 4000,
                filterRes: 0.3,
                attack: 0,
                release: 0.1,
                amp: 0.1
            },
            'ocean': {
                noiseType: 'brown',
                density: 0.4,
                grainSize: 2,
                pitchVariation: 0.05,
                spatialSpread: 1,
                filterFreq: 600,
                filterRes: 0.6,
                attack: 4,
                release: 5,
                amp: 0.2
            },
            'static': {
                noiseType: 'white',
                density: 1,
                grainSize: 0.01,
                pitchVariation: 0,
                spatialSpread: 0,
                filterFreq: 8000,
                filterRes: 0.1,
                attack: 0,
                release: 0.1,
                amp: 0.15
            }
        };
        
        const config = presets[preset];
        if (config) {
            Object.assign(this, config);
            this._generateGrain();
        }
    }
    
    /**
     * Reset the synthesizer
     */
    reset() {
        this.phase = 0;
        this.grainIndex = 0;
        this.filterState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        this._generateGrain();
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.grainBuffer = null;
        this.isPlaying = false;
    }
}

/**
 * Create a texture synthesizer panel UI
 */
export function openTextureSynthesizerPanel(synth) {
    const panel = document.createElement('div');
    panel.className = 'texture-synth-panel snug-panel';
    panel.innerHTML = `
        <div class="panel-header">
            <h3>Texture Synthesizer</h3>
            <button class="close-btn">×</button>
        </div>
        <div class="panel-content">
            <div class="texture-display">
                <canvas class="texture-viz" width="280" height="80"></canvas>
            </div>
            <div class="preset-section">
                <label>Presets:</label>
                <select id="texture-preset">
                    <option value="ambient">Ambient</option>
                    <option value="rain">Rain</option>
                    <option value="wind">Wind</option>
                    <option value="fire">Fire</option>
                    <option value="vinyl">Vinyl</option>
                    <option value="ocean">Ocean</option>
                    <option value="static">Static</option>
                </select>
            </div>
            <div class="noise-section">
                <label>Noise Type:</label>
                <select id="texture-noise">
                    <option value="pink">Pink</option>
                    <option value="white">White</option>
                    <option value="brown">Brown</option>
                    <option value="crackle">Crackle</option>
                    <option value="vinyl">Vinyl</option>
                    <option value="wind">Wind</option>
                </select>
            </div>
            <div class="controls-section">
                <div class="control-row">
                    <label>Density:</label>
                    <input type="range" min="0" max="1" step="0.01" value="${synth.density}" id="tex-density">
                    <span id="tex-density-val">${(synth.density * 100).toFixed(0)}%</span>
                </div>
                <div class="control-row">
                    <label>Grain Size:</label>
                    <input type="range" min="0.01" max="2" step="0.01" value="${synth.grainSize}" id="tex-grain">
                    <span id="tex-grain-val">${synth.grainSize.toFixed(2)}s</span>
                </div>
                <div class="control-row">
                    <label>Pitch Var:</label>
                    <input type="range" min="0" max="1" step="0.01" value="${synth.pitchVariation}" id="tex-pitch">
                    <span id="tex-pitch-val">${(synth.pitchVariation * 100).toFixed(0)}%</span>
                </div>
                <div class="control-row">
                    <label>Stereo:</label>
                    <input type="range" min="0" max="1" step="0.01" value="${synth.spatialSpread}" id="tex-stereo">
                    <span id="tex-stereo-val">${(synth.spatialSpread * 100).toFixed(0)}%</span>
                </div>
                <div class="control-row">
                    <label>Filter:</label>
                    <input type="range" min="100" max="8000" step="100" value="${synth.filterFreq}" id="tex-filter">
                    <span id="tex-filter-val">${synth.filterFreq}Hz</span>
                </div>
                <div class="control-row">
                    <label>Resonance:</label>
                    <input type="range" min="0.1" max="5" step="0.1" value="${synth.filterRes}" id="tex-res">
                    <span id="tex-res-val">${synth.filterRes.toFixed(1)}</span>
                </div>
                <div class="control-row">
                    <label>Attack:</label>
                    <input type="range" min="0" max="5" step="0.1" value="${synth.attack}" id="tex-attack">
                    <span id="tex-attack-val">${synth.attack.toFixed(1)}s</span>
                </div>
                <div class="control-row">
                    <label>Release:</label>
                    <input type="range" min="0" max="10" step="0.1" value="${synth.release}" id="tex-release">
                    <span id="tex-release-val">${synth.release.toFixed(1)}s</span>
                </div>
                <div class="control-row">
                    <label>Volume:</label>
                    <input type="range" min="0" max="1" step="0.01" value="${synth.amp}" id="tex-amp">
                    <span id="tex-amp-val">${(synth.amp * 100).toFixed(0)}%</span>
                </div>
            </div>
            <div class="actions-section">
                <button id="texture-start" class="action-btn">Start</button>
                <button id="texture-stop" class="action-btn">Stop</button>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .texture-synth-panel {
            background: var(--panel-bg, #1a1a2e);
            border: 1px solid var(--border-color, #3a3a5e);
            border-radius: 8px;
            padding: 16px;
            width: 320px;
            font-family: system-ui, sans-serif;
            color: var(--text-color, #e0e0e0);
            max-height: 500px;
            overflow-y: auto;
        }
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        .panel-header h3 {
            margin: 0;
            font-size: 14px;
        }
        .close-btn {
            background: none;
            border: none;
            color: inherit;
            font-size: 18px;
            cursor: pointer;
        }
        .texture-viz {
            width: 100%;
            height: 80px;
            background: #0a0a1a;
            border-radius: 4px;
            margin-bottom: 12px;
        }
        .preset-section, .noise-section {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .preset-section label, .noise-section label {
            width: 80px;
            font-size: 12px;
        }
        .preset-section select, .noise-section select {
            flex: 1;
            background: #0a0a1a;
            border: 1px solid #3a3a5e;
            color: inherit;
            padding: 4px;
            border-radius: 4px;
            font-size: 11px;
        }
        .control-row {
            display: flex;
            align-items: center;
            margin-bottom: 6px;
        }
        .control-row label {
            width: 80px;
            font-size: 11px;
        }
        .control-row input[type="range"] {
            flex: 1;
            margin-right: 8px;
        }
        .control-row span {
            width: 50px;
            text-align: right;
            font-size: 10px;
            font-family: monospace;
        }
        .actions-section {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        .action-btn {
            flex: 1;
            background: #3a3a5e;
            border: none;
            color: inherit;
            padding: 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        .action-btn:hover {
            background: #4a4a7e;
        }
        .action-btn.active {
            background: #4CAF50;
        }
    `;
    
    if (!document.querySelector('#texture-synth-styles')) {
        style.id = 'texture-synth-styles';
        document.head.appendChild(style);
    }
    
    // Wire up controls
    const presetSelect = panel.querySelector('#texture-preset');
    const noiseSelect = panel.querySelector('#texture-noise');
    const startBtn = panel.querySelector('#texture-start');
    const stopBtn = panel.querySelector('#texture-stop');
    
    const sliders = {
        density: panel.querySelector('#tex-density'),
        grain: panel.querySelector('#tex-grain'),
        pitch: panel.querySelector('#tex-pitch'),
        stereo: panel.querySelector('#tex-stereo'),
        filter: panel.querySelector('#tex-filter'),
        res: panel.querySelector('#tex-res'),
        attack: panel.querySelector('#tex-attack'),
        release: panel.querySelector('#tex-release'),
        amp: panel.querySelector('#tex-amp')
    };
    
    presetSelect.addEventListener('change', (e) => {
        synth.applyPreset(e.target.value);
        noiseSelect.value = synth.noiseType;
        updateSliderValues();
    });
    
    noiseSelect.addEventListener('change', (e) => {
        synth.setNoiseType(e.target.value);
    });
    
    sliders.density.addEventListener('input', (e) => {
        synth.density = parseFloat(e.target.value);
        panel.querySelector('#tex-density-val').textContent = `${(synth.density * 100).toFixed(0)}%`;
    });
    
    sliders.grain.addEventListener('input', (e) => {
        synth.grainSize = parseFloat(e.target.value);
        synth._generateGrain();
        panel.querySelector('#tex-grain-val').textContent = `${synth.grainSize.toFixed(2)}s`;
    });
    
    sliders.pitch.addEventListener('input', (e) => {
        synth.pitchVariation = parseFloat(e.target.value);
        panel.querySelector('#tex-pitch-val').textContent = `${(synth.pitchVariation * 100).toFixed(0)}%`;
    });
    
    sliders.stereo.addEventListener('input', (e) => {
        synth.spatialSpread = parseFloat(e.target.value);
        panel.querySelector('#tex-stereo-val').textContent = `${(synth.spatialSpread * 100).toFixed(0)}%`;
    });
    
    sliders.filter.addEventListener('input', (e) => {
        synth.filterFreq = parseFloat(e.target.value);
        panel.querySelector('#tex-filter-val').textContent = `${synth.filterFreq}Hz`;
    });
    
    sliders.res.addEventListener('input', (e) => {
        synth.filterRes = parseFloat(e.target.value);
        panel.querySelector('#tex-res-val').textContent = synth.filterRes.toFixed(1);
    });
    
    sliders.attack.addEventListener('input', (e) => {
        synth.attack = parseFloat(e.target.value);
        panel.querySelector('#tex-attack-val').textContent = `${synth.attack.toFixed(1)}s`;
    });
    
    sliders.release.addEventListener('input', (e) => {
        synth.release = parseFloat(e.target.value);
        panel.querySelector('#tex-release-val').textContent = `${synth.release.toFixed(1)}s`;
    });
    
    sliders.amp.addEventListener('input', (e) => {
        synth.amp = parseFloat(e.target.value);
        panel.querySelector('#tex-amp-val').textContent = `${(synth.amp * 100).toFixed(0)}%`;
    });
    
    startBtn.addEventListener('click', () => {
        synth.start();
        startBtn.classList.add('active');
    });
    
    stopBtn.addEventListener('click', () => {
        synth.stop();
        startBtn.classList.remove('active');
    });
    
    // Close button
    panel.querySelector('.close-btn').addEventListener('click', () => {
        synth.stop();
        panel.remove();
    });
    
    function updateSliderValues() {
        sliders.density.value = synth.density;
        sliders.grain.value = synth.grainSize;
        sliders.pitch.value = synth.pitchVariation;
        sliders.stereo.value = synth.spatialSpread;
        sliders.filter.value = synth.filterFreq;
        sliders.res.value = synth.filterRes;
        sliders.attack.value = synth.attack;
        sliders.release.value = synth.release;
        sliders.amp.value = synth.amp;
        
        panel.querySelector('#tex-density-val').textContent = `${(synth.density * 100).toFixed(0)}%`;
        panel.querySelector('#tex-grain-val').textContent = `${synth.grainSize.toFixed(2)}s`;
        panel.querySelector('#tex-pitch-val').textContent = `${(synth.pitchVariation * 100).toFixed(0)}%`;
        panel.querySelector('#tex-stereo-val').textContent = `${(synth.spatialSpread * 100).toFixed(0)}%`;
        panel.querySelector('#tex-filter-val').textContent = `${synth.filterFreq}Hz`;
        panel.querySelector('#tex-res-val').textContent = synth.filterRes.toFixed(1);
        panel.querySelector('#tex-attack-val').textContent = `${synth.attack.toFixed(1)}s`;
        panel.querySelector('#tex-release-val').textContent = `${synth.release.toFixed(1)}s`;
        panel.querySelector('#tex-amp-val').textContent = `${(synth.amp * 100).toFixed(0)}%`;
    }
    
    // Draw visualization
    const canvas = panel.querySelector('.texture-viz');
    const ctx = canvas.getContext('2d');
    
    function drawVisualization() {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (synth.isPlaying && synth.grainBuffer) {
            // Draw grain waveform
            ctx.strokeStyle = '#4CAF50';
            ctx.lineWidth = 1;
            ctx.beginPath();
            
            const step = Math.floor(synth.grainBuffer.length / canvas.width);
            for (let i = 0; i < canvas.width; i++) {
                const sample = synth.grainBuffer[Math.min(i * step, synth.grainBuffer.length - 1)];
                const y = canvas.height / 2 + sample * canvas.height * 0.4;
                if (i === 0) {
                    ctx.moveTo(i, y);
                } else {
                    ctx.lineTo(i, y);
                }
            }
            ctx.stroke();
        } else {
            // Draw idle state
            ctx.fillStyle = '#3a3a5e';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Press Start to generate texture', canvas.width / 2, canvas.height / 2);
        }
        
        requestAnimationFrame(drawVisualization);
    }
    
    drawVisualization();
    
    return panel;
}

export default TextureSynthesizer;