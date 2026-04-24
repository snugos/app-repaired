/**
 * VisualizationModes.js
 * Different visualization modes for waveforms and audio analysis
 */

// Visualization mode types
export const VISUALIZATION_MODES = {
    WAVEFORM: 'waveform',
    SPECTRUM: 'spectrum',
    SPECTROGRAM: 'spectrogram',
    OSCILLOSCOPE: 'oscilloscope',
    VU_METER: 'vu_meter',
    PHASE_CORRELATION: 'phase_correlation',
    STEREO_FIELD: 'stereo_field',
    FREQUENCY_ANALYZER: 'frequency_analyzer',
    LOUDNESS_METER: 'loudness_meter',
    CORRELATION_METER: 'correlation_meter'
};

// Color schemes for visualizations
export const COLOR_SCHEMES = {
    default: {
        primary: '#00ff88',
        secondary: '#ff6600',
        background: '#1a1a2e',
        grid: '#333355',
        peak: '#ff0044'
    },
    neon: {
        primary: '#00ffff',
        secondary: '#ff00ff',
        background: '#0a0a1a',
        grid: '#222244',
        peak: '#ffff00'
    },
    classic: {
        primary: '#88ff00',
        secondary: '#ff8800',
        background: '#000000',
        grid: '#333333',
        peak: '#ff0000'
    },
    ocean: {
        primary: '#00aaff',
        secondary: '#00ffaa',
        background: '#001122',
        grid: '#003344',
        peak: '#ff4488'
    },
    sunset: {
        primary: '#ff6600',
        secondary: '#ff0066',
        background: '#1a0a1a',
        grid: '#442244',
        peak: '#ffff00'
    }
};

// Global visualization state
let currentMode = VISUALIZATION_MODES.WAVEFORM;
let currentColorScheme = 'default';
let visualizationCanvas = null;
let visualizationCtx = null;
let animationId = null;
let analyserNode = null;
let isActive = false;

// Settings
let settings = {
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    refreshRate: 60,
    holdTime: 1500,
    peakHold: true,
    showGrid: true,
    showLabels: true,
    stereoMode: true,
    logScale: true,
    amplitudeScale: 1.0
};

// Visualization mode class
export class VisualizationModes {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = { ...settings, ...options };
        this.mode = currentMode;
        this.colorScheme = currentColorScheme;
        this.audioContext = null;
        this.sourceNode = null;
        this.analyserLeft = null;
        this.analyserRight = null;
        this.splitter = null;
        this.merger = null;
        this.animationId = null;
        this.isActive = false;
        
        // Data buffers
        this.frequencyData = null;
        this.timeData = null;
        this.frequencyDataLeft = null;
        this.frequencyDataRight = null;
        this.timeDataLeft = null;
        this.timeDataRight = null;
        
        // History for spectrogram
        this.spectrogramHistory = [];
        this.maxHistoryLength = 200;
        
        // Peak holds
        this.peakHolds = new Float32Array(this.options.fftSize / 2);
        this.peakHoldTimers = new Float32Array(this.options.fftSize / 2);
        
        // Loudness meter
        this.loudnessHistory = [];
        this.integratedLoudness = -70;
        this.shortTermLoudness = -70;
        this.momentaryLoudness = -70;
        
        this.init();
    }
    
    init() {
        this.createCanvas();
        this.createUI();
        this.initAnalyser();
    }
    
    createCanvas() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container "${this.containerId}" not found`);
            return;
        }
        
        // Clear container
        container.innerHTML = '';
        container.style.position = 'relative';
        container.style.background = COLOR_SCHEMES[this.colorScheme].background;
        
        // Create main canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = container.clientWidth || 800;
        this.canvas.height = container.clientHeight || 400;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        visualizationCanvas = this.canvas;
        visualizationCtx = this.ctx;
    }
    
    createUI() {
        const container = document.getElementById(this.containerId);
        
        // Create mode selector
        const modeSelector = document.createElement('div');
        modeSelector.className = 'visualization-mode-selector';
        modeSelector.style.cssText = `
            position: absolute;
            top: 8px;
            left: 8px;
            display: flex;
            gap: 4px;
            z-index: 10;
        `;
        
        Object.values(VISUALIZATION_MODES).forEach(mode => {
            const btn = document.createElement('button');
            btn.className = 'mode-btn';
            btn.textContent = mode.replace('_', ' ').toUpperCase();
            btn.style.cssText = `
                padding: 4px 8px;
                background: rgba(0, 255, 136, 0.2);
                border: 1px solid rgba(0, 255, 136, 0.4);
                border-radius: 4px;
                color: #00ff88;
                cursor: pointer;
                font-size: 10px;
                transition: all 0.2s;
            `;
            
            if (mode === this.mode) {
                btn.style.background = 'rgba(0, 255, 136, 0.4)';
            }
            
            btn.addEventListener('click', () => this.setMode(mode));
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(0, 255, 136, 0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                if (mode !== this.mode) {
                    btn.style.background = 'rgba(0, 255, 136, 0.2)';
                }
            });
            
            modeSelector.appendChild(btn);
        });
        
        container.appendChild(modeSelector);
        
        // Create color scheme selector
        const colorSelector = document.createElement('div');
        colorSelector.className = 'color-scheme-selector';
        colorSelector.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            display: flex;
            gap: 4px;
            z-index: 10;
        `;
        
        Object.keys(COLOR_SCHEMES).forEach(scheme => {
            const btn = document.createElement('button');
            btn.className = 'color-btn';
            btn.style.cssText = `
                width: 20px;
                height: 20px;
                background: linear-gradient(135deg, ${COLOR_SCHEMES[scheme].primary}, ${COLOR_SCHEMES[scheme].secondary});
                border: 1px solid ${COLOR_SCHEMES[scheme].grid};
                border-radius: 4px;
                cursor: pointer;
                transition: transform 0.2s;
            `;
            
            if (scheme === this.colorScheme) {
                btn.style.transform = 'scale(1.2)';
                btn.style.borderWidth = '2px';
            }
            
            btn.addEventListener('click', () => this.setColorScheme(scheme));
            colorSelector.appendChild(btn);
        });
        
        container.appendChild(colorSelector);
        
        // Create settings panel toggle
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'settings-toggle';
        settingsBtn.innerHTML = '⚙️';
        settingsBtn.style.cssText = `
            position: absolute;
            bottom: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            background: rgba(0, 255, 136, 0.2);
            border: 1px solid rgba(0, 255, 136, 0.4);
            border-radius: 4px;
            cursor: pointer;
            z-index: 10;
        `;
        settingsBtn.addEventListener('click', () => this.toggleSettings());
        container.appendChild(settingsBtn);
    }
    
    initAnalyser() {
        // This will be connected when audio context is available
        // Called from setAudioContext
    }
    
    setAudioContext(ctx, sourceNode = null) {
        this.audioContext = ctx;
        this.sourceNode = sourceNode;
        
        // Create analyser nodes
        this.analyserLeft = ctx.createAnalyser();
        this.analyserLeft.fftSize = this.options.fftSize;
        this.analyserLeft.smoothingTimeConstant = this.options.smoothingTimeConstant;
        
        this.analyserRight = ctx.createAnalyser();
        this.analyserRight.fftSize = this.options.fftSize;
        this.analyserRight.smoothingTimeConstant = this.options.smoothingTimeConstant;
        
        // Create splitter for stereo analysis
        this.splitter = ctx.createChannelSplitter(2);
        this.merger = ctx.createChannelMerger(2);
        
        // Initialize data buffers
        this.frequencyData = new Float32Array(this.analyserLeft.frequencyBinCount);
        this.timeData = new Float32Array(this.analyserLeft.fftSize);
        this.frequencyDataLeft = new Float32Array(this.analyserLeft.frequencyBinCount);
        this.frequencyDataRight = new Float32Array(this.analyserRight.frequencyBinCount);
        this.timeDataLeft = new Float32Array(this.analyserLeft.fftSize);
        this.timeDataRight = new Float32Array(this.analyserRight.fftSize);
        
        analyserNode = this.analyserLeft;
    }
    
    connectSource(source) {
        if (!this.audioContext) {
            console.warn('Audio context not set');
            return;
        }
        
        // Connect: source -> splitter -> analysers -> merger -> destination
        source.connect(this.splitter);
        this.splitter.connect(this.analyserLeft, 0);
        this.splitter.connect(this.analyserRight, 1);
        this.analyserLeft.connect(this.merger, 0, 0);
        this.analyserRight.connect(this.merger, 0, 1);
    }
    
    setMode(mode) {
        this.mode = mode;
        currentMode = mode;
        
        // Update button states
        const buttons = document.querySelectorAll('.mode-btn');
        buttons.forEach(btn => {
            if (btn.textContent.toLowerCase().replace(' ', '_') === mode) {
                btn.style.background = 'rgba(0, 255, 136, 0.4)';
            } else {
                btn.style.background = 'rgba(0, 255, 136, 0.2)';
            }
        });
        
        // Clear spectrogram history when switching modes
        if (mode === VISUALIZATION_MODES.SPECTROGRAM) {
            this.spectrogramHistory = [];
        }
        
        console.log(`[VisualizationModes] Mode set to: ${mode}`);
    }
    
    setColorScheme(scheme) {
        this.colorScheme = scheme;
        currentColorScheme = scheme;
        
        // Update background
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.background = COLOR_SCHEMES[scheme].background;
        }
        
        // Update button states
        const buttons = document.querySelectorAll('.color-btn');
        buttons.forEach((btn, i) => {
            const btnScheme = Object.keys(COLOR_SCHEMES)[i];
            if (btnScheme === scheme) {
                btn.style.transform = 'scale(1.2)';
                btn.style.borderWidth = '2px';
            } else {
                btn.style.transform = 'scale(1)';
                btn.style.borderWidth = '1px';
            }
        });
        
        console.log(`[VisualizationModes] Color scheme set to: ${scheme}`);
    }
    
    toggleSettings() {
        // Toggle settings panel
        let panel = document.getElementById('viz-settings-panel');
        if (panel) {
            panel.remove();
            return;
        }
        
        panel = document.createElement('div');
        panel.id = 'viz-settings-panel';
        panel.style.cssText = `
            position: absolute;
            bottom: 40px;
            right: 8px;
            background: rgba(26, 26, 46, 0.95);
            border: 1px solid rgba(0, 255, 136, 0.4);
            border-radius: 8px;
            padding: 16px;
            z-index: 10;
            min-width: 200px;
        `;
        
        const controls = [
            { name: 'FFT Size', key: 'fftSize', values: [512, 1024, 2048, 4096, 8192] },
            { name: 'Smoothing', key: 'smoothingTimeConstant', min: 0, max: 0.99, step: 0.01 },
            { name: 'Amplitude', key: 'amplitudeScale', min: 0.1, max: 3, step: 0.1 },
            { name: 'Peak Hold', key: 'peakHold', type: 'checkbox' },
            { name: 'Show Grid', key: 'showGrid', type: 'checkbox' },
            { name: 'Show Labels', key: 'showLabels', type: 'checkbox' },
            { name: 'Log Scale', key: 'logScale', type: 'checkbox' },
            { name: 'Stereo Mode', key: 'stereoMode', type: 'checkbox' }
        ];
        
        controls.forEach(ctrl => {
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';
            
            const label = document.createElement('label');
            label.textContent = ctrl.name;
            label.style.cssText = 'color: #00ff88; font-size: 12px;';
            row.appendChild(label);
            
            if (ctrl.type === 'checkbox') {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = this.options[ctrl.key];
                input.addEventListener('change', (e) => {
                    this.options[ctrl.key] = e.target.checked;
                });
                row.appendChild(input);
            } else if (ctrl.values) {
                const select = document.createElement('select');
                ctrl.values.forEach(val => {
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = val;
                    if (val === this.options[ctrl.key]) opt.selected = true;
                    select.appendChild(opt);
                });
                select.addEventListener('change', (e) => {
                    this.options[ctrl.key] = parseInt(e.target.value);
                    if (this.analyserLeft) {
                        this.analyserLeft.fftSize = this.options.fftSize;
                        this.analyserRight.fftSize = this.options.fftSize;
                    }
                });
                row.appendChild(select);
            } else {
                const input = document.createElement('input');
                input.type = 'range';
                input.min = ctrl.min;
                input.max = ctrl.max;
                input.step = ctrl.step;
                input.value = this.options[ctrl.key];
                input.style.cssText = 'width: 80px;';
                input.addEventListener('input', (e) => {
                    this.options[ctrl.key] = parseFloat(e.target.value);
                });
                row.appendChild(input);
            }
            
            panel.appendChild(row);
        });
        
        document.getElementById(this.containerId).appendChild(panel);
    }
    
    start() {
        this.isActive = true;
        isActive = true;
        this.draw();
        console.log('[VisualizationModes] Visualization started');
    }
    
    stop() {
        this.isActive = false;
        isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        console.log('[VisualizationModes] Visualization stopped');
    }
    
    draw() {
        if (!this.isActive) return;
        
        this.animationId = requestAnimationFrame(() => this.draw());
        
        // Get audio data
        this.getAudioData();
        
        // Clear canvas
        const colors = COLOR_SCHEMES[this.colorScheme];
        this.ctx.fillStyle = colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw based on mode
        switch (this.mode) {
            case VISUALIZATION_MODES.WAVEFORM:
                this.drawWaveform();
                break;
            case VISUALIZATION_MODES.SPECTRUM:
                this.drawSpectrum();
                break;
            case VISUALIZATION_MODES.SPECTROGRAM:
                this.drawSpectrogram();
                break;
            case VISUALIZATION_MODES.OSCILLOSCOPE:
                this.drawOscilloscope();
                break;
            case VISUALIZATION_MODES.VU_METER:
                this.drawVUMeter();
                break;
            case VISUALIZATION_MODES.PHASE_CORRELATION:
                this.drawPhaseCorrelation();
                break;
            case VISUALIZATION_MODES.STEREO_FIELD:
                this.drawStereoField();
                break;
            case VISUALIZATION_MODES.FREQUENCY_ANALYZER:
                this.drawFrequencyAnalyzer();
                break;
            case VISUALIZATION_MODES.LOUDNESS_METER:
                this.drawLoudnessMeter();
                break;
            case VISUALIZATION_MODES.CORRELATION_METER:
                this.drawCorrelationMeter();
                break;
            default:
                this.drawWaveform();
        }
        
        // Draw grid if enabled
        if (this.options.showGrid) {
            this.drawGrid();
        }
    }
    
    getAudioData() {
        if (!this.analyserLeft) return;
        
        this.analyserLeft.getFloatFrequencyData(this.frequencyDataLeft);
        this.analyserLeft.getFloatTimeDomainData(this.timeDataLeft);
        
        if (this.options.stereoMode && this.analyserRight) {
            this.analyserRight.getFloatFrequencyData(this.frequencyDataRight);
            this.analyserRight.getFloatTimeDomainData(this.timeDataRight);
        }
        
        // Copy to main buffers
        this.frequencyData = this.frequencyDataLeft;
        this.timeData = this.timeDataLeft;
        
        // Update peak holds
        if (this.options.peakHold) {
            for (let i = 0; i < this.frequencyDataLeft.length; i++) {
                if (this.frequencyDataLeft[i] > this.peakHolds[i]) {
                    this.peakHolds[i] = this.frequencyDataLeft[i];
                    this.peakHoldTimers[i] = Date.now();
                } else if (Date.now() - this.peakHoldTimers[i] > this.options.holdTime) {
                    this.peakHolds[i] -= 0.5; // Slow decay
                }
            }
        }
        
        // Calculate loudness
        this.calculateLoudness();
    }
    
    calculateLoudness() {
        // Simple RMS-based loudness estimation
        let sum = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            sum += this.timeData[i] * this.timeData[i];
        }
        const rms = Math.sqrt(sum / this.timeData.length);
        const dB = 20 * Math.log10(Math.max(rms, 0.00001));
        
        this.momentaryLoudness = dB;
        
        // Short-term (400ms)
        this.loudnessHistory.push(dB);
        if (this.loudnessHistory.length > 24) { // ~400ms at 60fps
            this.loudnessHistory.shift();
        }
        this.shortTermLoudness = this.loudnessHistory.reduce((a, b) => a + b, 0) / this.loudnessHistory.length;
    }
    
    drawWaveform() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.timeData;
        const sliceWidth = width / data.length;
        
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = colors.primary;
        this.ctx.beginPath();
        
        let x = 0;
        for (let i = 0; i < data.length; i++) {
            const v = data[i] * this.options.amplitudeScale;
            const y = (height / 2) * (1 + v);
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        this.ctx.stroke();
        
        // Draw stereo if enabled
        if (this.options.stereoMode && this.timeDataRight) {
            this.ctx.strokeStyle = colors.secondary;
            this.ctx.beginPath();
            
            x = 0;
            for (let i = 0; i < this.timeDataRight.length; i++) {
                const v = this.timeDataRight[i] * this.options.amplitudeScale;
                const y = (height / 2) * (1 + v);
                
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
                
                x += sliceWidth;
            }
            
            this.ctx.stroke();
        }
    }
    
    drawSpectrum() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.options.peakHold ? this.peakHolds : this.frequencyData;
        const bufferLength = data.length;
        
        // Logarithmic frequency mapping
        const logMin = Math.log10(20);
        const logMax = Math.log10(this.audioContext?.sampleRate / 2 || 22050);
        const logRange = logMax - logMin;
        
        this.ctx.fillStyle = colors.primary;
        
        for (let i = 0; i < bufferLength; i++) {
            // Logarithmic x position
            const freq = (i / bufferLength) * (this.audioContext?.sampleRate / 2 || 22050);
            const logFreq = Math.log10(Math.max(freq, 20));
            const x = ((logFreq - logMin) / logRange) * width;
            
            // Convert from dB to linear
            const dB = Math.max(data[i], -100);
            const linear = (dB + 100) / 100; // 0-1 range
            const barHeight = linear * height * this.options.amplitudeScale;
            
            // Draw bar
            const barWidth = width / bufferLength;
            this.ctx.fillStyle = linear > 0.9 ? colors.peak : colors.primary;
            this.ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        }
        
        // Draw stereo overlay if enabled
        if (this.options.stereoMode && this.frequencyDataRight) {
            this.ctx.fillStyle = colors.secondary + '40'; // Semi-transparent
            for (let i = 0; i < this.frequencyDataRight.length; i++) {
                const freq = (i / this.frequencyDataRight.length) * (this.audioContext?.sampleRate / 2 || 22050);
                const logFreq = Math.log10(Math.max(freq, 20));
                const x = ((logFreq - logMin) / logRange) * width;
                
                const dB = Math.max(this.frequencyDataRight[i], -100);
                const linear = (dB + 100) / 100;
                const barHeight = linear * height * this.options.amplitudeScale;
                
                const barWidth = width / this.frequencyDataRight.length;
                this.ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
            }
        }
        
        // Draw frequency labels
        if (this.options.showLabels) {
            this.ctx.fillStyle = colors.grid;
            this.ctx.font = '10px monospace';
            const freqLabels = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
            freqLabels.forEach(freq => {
                const logFreq = Math.log10(freq);
                const x = ((logFreq - logMin) / logRange) * width;
                this.ctx.fillText(freq >= 1000 ? `${freq/1000}k` : freq, x, height - 5);
            });
        }
    }
    
    drawSpectrogram() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Add current spectrum to history
        this.spectrogramHistory.push(new Float32Array(this.frequencyData));
        if (this.spectrogramHistory.length > this.maxHistoryLength) {
            this.spectrogramHistory.shift();
        }
        
        // Draw spectrogram
        const binHeight = height / this.frequencyData.length;
        const colWidth = width / this.maxHistoryLength;
        
        for (let x = 0; x < this.spectrogramHistory.length; x++) {
            const spectrum = this.spectrogramHistory[x];
            for (let i = 0; i < spectrum.length; i++) {
                const dB = Math.max(spectrum[i], -100);
                const linear = (dB + 100) / 100;
                
                // Color mapping
                const hue = 240 - linear * 240; // Blue to red
                this.ctx.fillStyle = `hsl(${hue}, 100%, ${linear * 50}%)`;
                
                const y = height - (i * binHeight);
                this.ctx.fillRect(x * colWidth, y, colWidth, binHeight);
            }
        }
    }
    
    drawOscilloscope() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.timeData;
        
        // Draw phosphor-like effect (trails)
        this.ctx.fillStyle = colors.background + '20';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw trace
        this.ctx.strokeStyle = colors.primary;
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = colors.primary;
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        
        const sliceWidth = width / data.length;
        let x = 0;
        
        for (let i = 0; i < data.length; i++) {
            const v = data[i] * this.options.amplitudeScale;
            const y = (height / 2) * (1 + v);
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        // Draw center line
        this.ctx.strokeStyle = colors.grid;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Draw time divisions
        if (this.options.showLabels) {
            this.ctx.strokeStyle = colors.grid;
            this.ctx.beginPath();
            for (let i = 0; i < 10; i++) {
                const xPos = (width / 10) * i;
                this.ctx.moveTo(xPos, 0);
                this.ctx.lineTo(xPos, height);
            }
            this.ctx.stroke();
        }
    }
    
    drawVUMeter() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Calculate RMS
        let sumLeft = 0, sumRight = 0;
        for (let i = 0; i < this.timeDataLeft.length; i++) {
            sumLeft += this.timeDataLeft[i] * this.timeDataLeft[i];
        }
        if (this.timeDataRight) {
            for (let i = 0; i < this.timeDataRight.length; i++) {
                sumRight += this.timeDataRight[i] * this.timeDataRight[i];
            }
        }
        
        const rmsLeft = Math.sqrt(sumLeft / this.timeDataLeft.length);
        const rmsRight = Math.sqrt(sumRight / this.timeDataRight.length);
        
        const dBLeft = 20 * Math.log10(Math.max(rmsLeft, 0.00001));
        const dBRight = 20 * Math.log10(Math.max(rmsRight, 0.00001));
        
        // Draw meter bars
        const meterWidth = width / 4;
        const meterHeight = height * 0.8;
        const startY = height * 0.1;
        
        // Left channel
        this.drawMeterBar(meterWidth, startY, meterWidth, meterHeight, dBLeft, colors);
        
        // Right channel
        if (this.options.stereoMode) {
            this.drawMeterBar(meterWidth * 2.5, startY, meterWidth, meterHeight, dBRight, colors);
        }
        
        // Draw dB scale
        if (this.options.showLabels) {
            this.ctx.fillStyle = colors.grid;
            this.ctx.font = '10px monospace';
            const dbMarks = [0, -6, -12, -18, -24, -36, -48, -60];
            dbMarks.forEach(db => {
                const y = startY + ((-db / 60) * meterHeight);
                this.ctx.fillText(`${db}`, 5, y + 4);
            });
        }
    }
    
    drawMeterBar(x, y, width, height, dB, colors) {
        const normalized = Math.max(0, Math.min(1, (dB + 60) / 60));
        
        // Background
        this.ctx.fillStyle = colors.background;
        this.ctx.fillRect(x, y, width, height);
        
        // Meter level
        const meterHeight = height * normalized;
        
        // Gradient
        const gradient = this.ctx.createLinearGradient(x, y + height, x, y);
        gradient.addColorStop(0, '#00ff00');
        gradient.addColorStop(0.6, '#ffff00');
        gradient.addColorStop(0.8, '#ff6600');
        gradient.addColorStop(1, '#ff0000');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x, y + height - meterHeight, width, meterHeight);
        
        // Peak marker
        if (dB > -3) {
            this.ctx.fillStyle = colors.peak;
            this.ctx.fillRect(x, y, width, 3);
        }
    }
    
    drawPhaseCorrelation() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Calculate phase correlation
        let sumProduct = 0, sumSqLeft = 0, sumSqRight = 0;
        for (let i = 0; i < this.timeDataLeft.length; i++) {
            sumProduct += this.timeDataLeft[i] * (this.timeDataRight?.[i] || this.timeDataLeft[i]);
            sumSqLeft += this.timeDataLeft[i] * this.timeDataLeft[i];
            sumSqRight += (this.timeDataRight?.[i] || this.timeDataLeft[i]) * (this.timeDataRight?.[i] || this.timeDataLeft[i]);
        }
        
        const correlation = sumProduct / (Math.sqrt(sumSqLeft * sumSqRight) + 0.00001);
        
        // Draw X-Y plot
        this.ctx.fillStyle = colors.primary + '60';
        this.ctx.strokeStyle = colors.primary;
        this.ctx.lineWidth = 1;
        
        const step = Math.max(1, Math.floor(this.timeDataLeft.length / 500));
        for (let i = 0; i < this.timeDataLeft.length; i += step) {
            const x = centerX + this.timeDataLeft[i] * centerX * this.options.amplitudeScale;
            const y = centerY - (this.timeDataRight?.[i] || this.timeDataLeft[i]) * centerY * this.options.amplitudeScale;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 1, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw correlation meter
        const meterWidth = width * 0.8;
        const meterX = (width - meterWidth) / 2;
        const meterY = height - 40;
        
        this.ctx.fillStyle = colors.background;
        this.ctx.fillRect(meterX, meterY, meterWidth, 20);
        
        // Correlation bar
        const corrPos = ((correlation + 1) / 2) * meterWidth;
        this.ctx.fillStyle = correlation > 0 ? colors.primary : colors.secondary;
        this.ctx.fillRect(meterX, meterY, corrPos, 20);
        
        // Labels
        if (this.options.showLabels) {
            this.ctx.fillStyle = colors.grid;
            this.ctx.font = '12px monospace';
            this.ctx.fillText('-1', meterX - 20, meterY + 15);
            this.ctx.fillText('0', centerX - 5, meterY + 15);
            this.ctx.fillText('+1', meterX + meterWidth + 5, meterY + 15);
            this.ctx.fillText(`Correlation: ${correlation.toFixed(2)}`, 10, 30);
        }
    }
    
    drawStereoField() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Draw stereo field as a 2D plot
        // X = left-right, Y = up-down (phase)
        this.ctx.fillStyle = colors.primary + '40';
        
        const step = Math.max(1, Math.floor(this.timeDataLeft.length / 200));
        for (let i = 0; i < this.timeDataLeft.length; i += step) {
            const left = this.timeDataLeft[i];
            const right = this.timeDataRight?.[i] || left;
            
            // X: stereo position (-1 = left, 1 = right)
            const x = ((left - right + 1) / 2) * width * 0.8 + width * 0.1;
            // Y: amplitude
            const y = height / 2 - (left + right) * height * 0.3 * this.options.amplitudeScale;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw axes
        this.ctx.strokeStyle = colors.grid;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(width / 2, 0);
        this.ctx.lineTo(width / 2, height);
        this.ctx.stroke();
        
        // Labels
        if (this.options.showLabels) {
            this.ctx.fillStyle = colors.grid;
            this.ctx.font = '12px monospace';
            this.ctx.fillText('L', 10, height / 2);
            this.ctx.fillText('R', width - 15, height / 2);
            this.ctx.fillText('M', width / 2 - 5, 20);
            this.ctx.fillText('S', width / 2 - 5, height - 10);
        }
    }
    
    drawFrequencyAnalyzer() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Draw spectrum with detailed analysis
        this.drawSpectrum();
        
        // Add frequency bands
        const bands = [
            { name: 'Sub', range: [20, 60], color: '#ff0066' },
            { name: 'Bass', range: [60, 250], color: '#ff6600' },
            { name: 'Low Mid', range: [250, 500], color: '#ffcc00' },
            { name: 'Mid', range: [500, 2000], color: '#00ff00' },
            { name: 'High Mid', range: [2000, 4000], color: '#00ffff' },
            { name: 'Presence', range: [4000, 6000], color: '#0066ff' },
            { name: 'Brilliance', range: [6000, 20000], color: '#9900ff' }
        ];
        
        const sampleRate = this.audioContext?.sampleRate || 44100;
        const binFreq = sampleRate / this.options.fftSize;
        
        // Calculate band levels
        const bandLevels = bands.map(band => {
            const startBin = Math.floor(band.range[0] / binFreq);
            const endBin = Math.min(Math.floor(band.range[1] / binFreq), this.frequencyData.length);
            
            let sum = 0;
            let count = 0;
            for (let i = startBin; i < endBin; i++) {
                sum += this.frequencyData[i];
                count++;
            }
            
            return count > 0 ? sum / count : -100;
        });
        
        // Draw band indicators
        if (this.options.showLabels) {
            const barWidth = width / bands.length;
            
            bandLevels.forEach((level, i) => {
                const x = i * barWidth;
                const normalized = Math.max(0, Math.min(1, (level + 60) / 60));
                const barHeight = height * 0.2 * normalized;
                
                this.ctx.fillStyle = bands[i].color + '40';
                this.ctx.fillRect(x, 0, barWidth - 2, barHeight);
                
                this.ctx.fillStyle = bands[i].color;
                this.ctx.font = '10px monospace';
                this.ctx.fillText(bands[i].name, x + 2, height - 25);
                this.ctx.fillText(`${level.toFixed(0)}dB`, x + 2, height - 10);
            });
        }
    }
    
    drawLoudnessMeter() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Draw loudness meters
        const meters = [
            { name: 'Momentary', value: this.momentaryLoudness, y: height * 0.15 },
            { name: 'Short-term', value: this.shortTermLoudness, y: height * 0.35 },
            { name: 'Integrated', value: this.integratedLoudness, y: height * 0.55 }
        ];
        
        const meterWidth = width * 0.7;
        const meterHeight = 25;
        const startX = width * 0.15;
        
        // Target LUFS lines
        const targets = [-23, -16, -14, -11]; // Broadcast, Streaming, CD, Club
        targets.forEach(lufs => {
            const x = startX + ((luufs + 40) / 30) * meterWidth;
            this.ctx.strokeStyle = colors.grid;
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(x, height * 0.1);
            this.ctx.lineTo(x, height * 0.65);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        });
        
        meters.forEach(meter => {
            // Background
            this.ctx.fillStyle = colors.background;
            this.ctx.fillRect(startX, meter.y, meterWidth, meterHeight);
            
            // Level
            const normalized = Math.max(0, Math.min(1, (meter.value + 40) / 30));
            const levelWidth = meterWidth * normalized;
            
            const gradient = this.ctx.createLinearGradient(startX, 0, startX + meterWidth, 0);
            gradient.addColorStop(0, '#00ff00');
            gradient.addColorStop(0.6, '#ffff00');
            gradient.addColorStop(0.8, '#ff6600');
            gradient.addColorStop(1, '#ff0000');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(startX, meter.y, levelWidth, meterHeight);
            
            // Label
            this.ctx.fillStyle = colors.primary;
            this.ctx.font = '12px monospace';
            this.ctx.fillText(`${meter.name}: ${meter.value.toFixed(1)} LUFS`, startX, meter.y - 5);
        });
        
        // Target reference
        if (this.options.showLabels) {
            this.ctx.fillStyle = colors.grid;
            this.ctx.font = '10px monospace';
            this.ctx.fillText('-40', startX - 20, height * 0.65);
            this.ctx.fillText('-10', startX + meterWidth - 10, height * 0.65);
            this.ctx.fillText('LUFS', startX + meterWidth + 5, height * 0.35);
        }
    }
    
    drawCorrelationMeter() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Calculate correlation
        let sumProduct = 0, sumSqLeft = 0, sumSqRight = 0;
        for (let i = 0; i < this.timeDataLeft.length; i++) {
            sumProduct += this.timeDataLeft[i] * (this.timeDataRight?.[i] || this.timeDataLeft[i]);
            sumSqLeft += this.timeDataLeft[i] * this.timeDataLeft[i];
            sumSqRight += (this.timeDataRight?.[i] || this.timeDataLeft[i]) * (this.timeDataRight?.[i] || this.timeDataLeft[i]);
        }
        
        const correlation = sumProduct / (Math.sqrt(sumSqLeft * sumSqRight) + 0.00001);
        
        // Draw correlation meter
        const meterWidth = width * 0.8;
        const meterHeight = height * 0.6;
        const startX = (width - meterWidth) / 2;
        const startY = (height - meterHeight) / 2;
        
        // Background with scale
        this.ctx.fillStyle = colors.background;
        this.ctx.fillRect(startX, startY, meterWidth, meterHeight);
        
        // Scale gradient (red -> yellow -> green)
        const gradient = this.ctx.createLinearGradient(startX, 0, startX + meterWidth, 0);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(0.5, '#ffff00');
        gradient.addColorStop(1, '#00ff00');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(startX, startY, meterWidth, meterHeight * 0.5);
        
        // Correlation indicator
        const corrX = startX + ((correlation + 1) / 2) * meterWidth;
        this.ctx.fillStyle = colors.primary;
        this.ctx.beginPath();
        this.ctx.moveTo(corrX, startY);
        this.ctx.lineTo(corrX - 10, startY - 15);
        this.ctx.lineTo(corrX + 10, startY - 15);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Labels
        if (this.options.showLabels) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '14px monospace';
            this.ctx.textAlign = 'center';
            
            this.ctx.fillText('MONO', startX + meterWidth * 0.5, startY + meterHeight * 0.35);
            this.ctx.fillText('-1', startX, startY + meterHeight * 0.7);
            this.ctx.fillText('0', startX + meterWidth * 0.5, startY + meterHeight * 0.7);
            this.ctx.fillText('+1', startX + meterWidth, startY + meterHeight * 0.7);
            
            // Status
            let status = '';
            if (correlation > 0.5) status = 'GOOD STEREO';
            else if (correlation > 0) status = 'ACCEPTABLE';
            else if (correlation > -0.5) status = 'PHASE ISSUES';
            else status = 'PHASE PROBLEM';
            
            this.ctx.fillText(status, width / 2, startY + meterHeight - 10);
            this.ctx.textAlign = 'left';
        }
    }
    
    drawGrid() {
        const colors = COLOR_SCHEMES[this.colorScheme];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        this.ctx.strokeStyle = colors.grid;
        this.ctx.lineWidth = 0.5;
        this.ctx.setLineDash([2, 4]);
        
        // Vertical lines
        const xStep = width / 10;
        for (let x = xStep; x < width; x += xStep) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        const yStep = height / 10;
        for (let y = yStep; y < height; y += yStep) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
    }
    
    // Public API
    getCurrentMode() {
        return this.mode;
    }
    
    getColorScheme() {
        return this.colorScheme;
    }
    
    getSettings() {
        return { ...this.options };
    }
    
    updateSettings(newSettings) {
        this.options = { ...this.options, ...newSettings };
        if (newSettings.fftSize && this.analyserLeft) {
            this.analyserLeft.fftSize = newSettings.fftSize;
            this.analyserRight.fftSize = newSettings.fftSize;
        }
        if (newSettings.smoothingTimeConstant !== undefined) {
            this.analyserLeft.smoothingTimeConstant = newSettings.smoothingTimeConstant;
            this.analyserRight.smoothingTimeConstant = newSettings.smoothingTimeConstant;
        }
    }
    
    resize() {
        const container = document.getElementById(this.containerId);
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
    }
    
    destroy() {
        this.stop();
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }
    }
}

// Standalone functions for global visualization
export function getCurrentMode() {
    return currentMode;
}

export function setColorScheme(scheme) {
    currentColorScheme = scheme;
}

export function getVisualizationCanvas() {
    return visualizationCanvas;
}

export function getVisualizationContext() {
    return visualizationCtx;
}

export function isVisualizationActive() {
    return isActive;
}

export function getAnalyserNode() {
    return analyserNode;
}

// UI Panel for visualization modes
export function openVisualizationModesPanel() {
    // Remove existing panel
    const existing = document.getElementById('visualization-modes-panel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'visualization-modes-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(26, 26, 46, 0.95);
        border: 1px solid rgba(0, 255, 136, 0.4);
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 600px;
        min-height: 400px;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
    header.innerHTML = `
        <h3 style="color: #00ff88; margin: 0;">Visualization Modes</h3>
        <button id="close-viz-panel" style="background: transparent; border: 1px solid #ff4444; color: #ff4444; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Close</button>
    `;
    panel.appendChild(header);
    
    // Visualization container
    const vizContainer = document.createElement('div');
    vizContainer.id = 'viz-panel-container';
    vizContainer.style.cssText = 'width: 100%; height: 350px; border-radius: 4px; overflow: hidden;';
    panel.appendChild(vizContainer);
    
    document.body.appendChild(panel);
    
    // Initialize visualization
    const viz = new VisualizationModes('viz-panel-container', {
        fftSize: 2048,
        stereoMode: true,
        showGrid: true,
        showLabels: true
    });
    
    // Close button
    document.getElementById('close-viz-panel').addEventListener('click', () => {
        viz.destroy();
        panel.remove();
    });
    
    return viz;
}

console.log('[VisualizationModes] Module loaded');