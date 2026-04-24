/**
 * Spectrum Analyzer Enhancements
 * Adds spectrogram view, freeze peak, and multiple FFT sizes to the spectrum analyzer
 */

class SpectrumAnalyzerEnhancements {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            fftSizes: options.fftSizes || [256, 512, 1024, 2048, 4096, 8192],
            defaultFftSize: options.defaultFftSize || 2048,
            smoothing: options.smoothing ?? 0.8,
            freezePeak: options.freezePeak ?? false,
            spectrogramEnabled: options.spectrogramEnabled ?? true,
            spectrogramScrollSpeed: options.spectrogramScrollSpeed || 2, // pixels per frame
            colorScheme: options.colorScheme || 'viridis', // viridis, magma, plasma, inferno, turbo
            minDecibels: options.minDecibels || -100,
            maxDecibels: options.maxDecibels || -10,
        };
        
        // State
        this.currentFftSize = this.config.defaultFftSize;
        this.peakData = null;
        this.spectrogramData = [];
        this.maxSpectrogramLines = 200;
        this.isRunning = false;
        
        // Create analyzer nodes for different FFT sizes
        this.analyzers = new Map();
        this._createAnalyzers();
        
        // Spectrogram canvas
        this.spectrogramCanvas = null;
        this.spectrogramCtx = null;
        
        // Color schemes
        this.colorSchemes = {
            viridis: this._viridis.bind(this),
            magma: this._magma.bind(this),
            plasma: this._plasma.bind(this),
            inferno: this._inferno.bind(this),
            turbo: this._turbo.bind(this),
            grayscale: this._grayscale.bind(this),
        };
    }
    
    _createAnalyzers() {
        for (const fftSize of this.config.fftSizes) {
            const analyzer = this.audioContext.createAnalyser();
            analyzer.fftSize = fftSize;
            analyzer.smoothingTimeConstant = this.config.smoothing;
            analyzer.minDecibels = this.config.minDecibels;
            analyzer.maxDecibels = this.config.maxDecibels;
            this.analyzers.set(fftSize, analyzer);
        }
    }
    
    setFftSize(size) {
        if (this.config.fftSizes.includes(size)) {
            this.currentFftSize = size;
        } else {
            console.warn(`FFT size ${size} not available. Using ${this.currentFftSize}`);
        }
    }
    
    getCurrentAnalyzer() {
        return this.analyzers.get(this.currentFftSize);
    }
    
    connect(source) {
        // Connect to all analyzers
        for (const analyzer of this.analyzers.values()) {
            try {
                source.connect(analyzer);
            } catch (e) {
                console.warn('Could not connect analyzer:', e);
            }
        }
        this.inputNode = source;
        return this;
    }
    
    disconnect() {
        for (const analyzer of this.analyzers.values()) {
            try {
                analyzer.disconnect();
            } catch (e) {}
        }
    }
    
    // Get frequency data with current FFT size
    getFrequencyData() {
        const analyzer = this.getCurrentAnalyzer();
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(dataArray);
        
        // Update peak data if freeze is enabled
        if (this.config.freezePeak) {
            if (!this.peakData || this.peakData.length !== dataArray.length) {
                this.peakData = new Uint8Array(dataArray);
            } else {
                for (let i = 0; i < dataArray.length; i++) {
                    if (dataArray[i] > this.peakData[i]) {
                        this.peakData[i] = dataArray[i];
                    }
                }
            }
        }
        
        return dataArray;
    }
    
    // Get peak data (for freeze peak display)
    getPeakData() {
        return this.peakData || this.getFrequencyData();
    }
    
    // Reset peak data
    resetPeak() {
        this.peakData = null;
    }
    
    // Enable/disable freeze peak
    setFreezePeak(enabled) {
        this.config.freezePeak = enabled;
        if (!enabled) {
            this.resetPeak();
        }
    }
    
    // Spectrogram functions
    initSpectrogram(canvas) {
        this.spectrogramCanvas = canvas;
        this.spectrogramCtx = canvas.getContext('2d');
        this.spectrogramData = [];
        
        // Clear canvas
        this.spectrogramCtx.fillStyle = '#000';
        this.spectrogramCtx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    updateSpectrogram() {
        if (!this.spectrogramCanvas || !this.spectrogramCtx) return;
        
        const analyzer = this.getCurrentAnalyzer();
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(dataArray);
        
        // Add new line to spectrogram data
        this.spectrogramData.push(new Uint8Array(dataArray));
        
        // Limit the number of lines
        if (this.spectrogramData.length > this.maxSpectrogramLines) {
            this.spectrogramData.shift();
        }
        
        // Draw spectrogram
        this._drawSpectrogram();
    }
    
    _drawSpectrogram() {
        const ctx = this.spectrogramCtx;
        const canvas = this.spectrogramCanvas;
        const width = canvas.width;
        const height = canvas.height;
        
        // Scroll existing content
        const scrollSpeed = this.config.spectrogramScrollSpeed;
        const imageData = ctx.getImageData(scrollSpeed, 0, width - scrollSpeed, height);
        ctx.putImageData(imageData, 0, 0);
        
        // Clear the right edge
        ctx.fillStyle = '#000';
        ctx.fillRect(width - scrollSpeed, 0, scrollSpeed, height);
        
        // Draw new line
        const lastLine = this.spectrogramData[this.spectrogramData.length - 1];
        if (!lastLine) return;
        
        const binHeight = height / lastLine.length;
        const colorFunc = this.colorSchemes[this.config.colorScheme] || this.colorSchemes.viridis;
        
        for (let i = 0; i < lastLine.length; i++) {
            const value = lastLine[i] / 255;
            const color = colorFunc(value);
            ctx.fillStyle = color;
            ctx.fillRect(width - scrollSpeed, height - (i + 1) * binHeight, scrollSpeed, binHeight + 1);
        }
    }
    
    clearSpectrogram() {
        this.spectrogramData = [];
        if (this.spectrogramCtx && this.spectrogramCanvas) {
            this.spectrogramCtx.fillStyle = '#000';
            this.spectrogramCtx.fillRect(0, 0, this.spectrogramCanvas.width, this.spectrogramCanvas.height);
        }
    }
    
    setColorScheme(scheme) {
        if (this.colorSchemes[scheme]) {
            this.config.colorScheme = scheme;
        }
    }
    
    // Color scheme functions
    _viridis(t) {
        // Viridis color map approximation
        const r = Math.round(68 + t * (253 - 68));
        const g = Math.round(1 + t * (231 - 1));
        const b = Math.round(84 + t * (37 - 84));
        return `rgb(${r},${g},${b})`;
    }
    
    _magma(t) {
        const r = Math.round(0 + t * (252 - 0));
        const g = Math.round(4 + t * (253 - 4));
        const b = Math.round(21 + t * (191 - 21));
        return `rgb(${r},${g},${b})`;
    }
    
    _plasma(t) {
        const r = Math.round(13 + t * (240 - 13));
        const g = Math.round(8 + t * (249 - 8));
        const b = Math.round(135 + t * (33 - 135));
        return `rgb(${r},${g},${b})`;
    }
    
    _inferno(t) {
        const r = Math.round(0 + t * (252 - 0));
        const g = Math.round(0 + t * (255 - 0));
        const b = Math.round(4 + t * (4 - 4));
        return `rgb(${r},${g},${b})`;
    }
    
    _turbo(t) {
        // Turbo colormap approximation
        const r = Math.round(48 + t * (224 - 48));
        const g = Math.round(18 + t * (249 - 18));
        const b = Math.round(59 + t * (41 - 59));
        return `rgb(${r},${g},${b})`;
    }
    
    _grayscale(t) {
        const v = Math.round(t * 255);
        return `rgb(${v},${v},${v})`;
    }
    
    // Get frequency bin info
    getFrequencyBinInfo() {
        const analyzer = this.getCurrentAnalyzer();
        const sampleRate = this.audioContext.sampleRate;
        const binCount = analyzer.frequencyBinCount;
        const binWidth = sampleRate / analyzer.fftSize;
        
        return {
            binCount,
            binWidth,
            nyquist: sampleRate / 2,
            fftSize: analyzer.fftSize,
        };
    }
    
    // Get available FFT sizes
    getAvailableFftSizes() {
        return [...this.config.fftSizes];
    }
    
    // Create UI panel
    createPanel(container) {
        const panel = document.createElement('div');
        panel.className = 'spectrum-analyzer-enhancements-panel';
        panel.innerHTML = `
            <style>
                .spectrum-analyzer-enhancements-panel {
                    background: #1a1a2e;
                    border-radius: 8px;
                    padding: 16px;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .sae-header {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 16px;
                    border-bottom: 1px solid #333;
                    padding-bottom: 8px;
                }
                .sae-section {
                    margin-bottom: 16px;
                }
                .sae-section-title {
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: #888;
                }
                .sae-control {
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .sae-label {
                    flex: 0 0 140px;
                    font-size: 13px;
                }
                .sae-select, .sae-input {
                    background: #0a0a14;
                    border: 1px solid #333;
                    border-radius: 4px;
                    padding: 8px 12px;
                    color: #fff;
                    font-size: 13px;
                }
                .sae-btn {
                    background: #10b981;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    color: #fff;
                    cursor: pointer;
                    font-weight: 600;
                }
                .sae-btn:hover {
                    background: #059669;
                }
                .sae-btn-secondary {
                    background: #333;
                }
                .sae-btn-secondary:hover {
                    background: #444;
                }
                .sae-canvas-container {
                    background: #000;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .sae-spectrum-canvas {
                    width: 100%;
                    height: 150px;
                }
                .sae-spectrogram-canvas {
                    width: 100%;
                    height: 200px;
                }
                .sae-info {
                    font-size: 12px;
                    color: #666;
                    margin-top: 8px;
                }
            </style>
            
            <div class="sae-header">Spectrum Analyzer</div>
            
            <div class="sae-section">
                <div class="sae-section-title">FFT Settings</div>
                <div class="sae-control">
                    <span class="sae-label">FFT Size:</span>
                    <select id="sae-fft-size" class="sae-select">
                        ${this.config.fftSizes.map(size => 
                            `<option value="${size}" ${size === this.currentFftSize ? 'selected' : ''}>${size}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="sae-info" id="sae-fft-info"></div>
            </div>
            
            <div class="sae-section">
                <div class="sae-section-title">Display Options</div>
                <div class="sae-control">
                    <span class="sae-label">Freeze Peak:</span>
                    <input type="checkbox" id="sae-freeze-peak" ${this.config.freezePeak ? 'checked' : ''}>
                </div>
                <div class="sae-control">
                    <span class="sae-label">Color Scheme:</span>
                    <select id="sae-color-scheme" class="sae-select">
                        <option value="viridis" ${this.config.colorScheme === 'viridis' ? 'selected' : ''}>Viridis</option>
                        <option value="magma" ${this.config.colorScheme === 'magma' ? 'selected' : ''}>Magma</option>
                        <option value="plasma" ${this.config.colorScheme === 'plasma' ? 'selected' : ''}>Plasma</option>
                        <option value="inferno" ${this.config.colorScheme === 'inferno' ? 'selected' : ''}>Inferno</option>
                        <option value="turbo" ${this.config.colorScheme === 'turbo' ? 'selected' : ''}>Turbo</option>
                        <option value="grayscale" ${this.config.colorScheme === 'grayscale' ? 'selected' : ''}>Grayscale</option>
                    </select>
                </div>
            </div>
            
            <div class="sae-section">
                <div class="sae-section-title">Spectrum</div>
                <div class="sae-canvas-container">
                    <canvas id="sae-spectrum-canvas" class="sae-spectrum-canvas"></canvas>
                </div>
            </div>
            
            <div class="sae-section">
                <div class="sae-section-title">Spectrogram</div>
                <div class="sae-canvas-container">
                    <canvas id="sae-spectrogram-canvas" class="sae-spectrogram-canvas"></canvas>
                </div>
                <div style="margin-top: 8px;">
                    <button id="sae-clear-spectrogram" class="sae-btn sae-btn-secondary">Clear</button>
                </div>
            </div>
        `;
        
        container.appendChild(panel);
        
        // Initialize canvases
        const spectrumCanvas = panel.querySelector('#sae-spectrum-canvas');
        const spectrogramCanvas = panel.querySelector('#sae-spectrogram-canvas');
        
        spectrumCanvas.width = spectrumCanvas.offsetWidth * 2;
        spectrumCanvas.height = 150 * 2;
        spectrogramCanvas.width = spectrogramCanvas.offsetWidth * 2;
        spectrogramCanvas.height = 200 * 2;
        
        this.initSpectrogram(spectrogramCanvas);
        
        // Event handlers
        panel.querySelector('#sae-fft-size').addEventListener('change', (e) => {
            this.setFftSize(parseInt(e.target.value));
            this._updateFftInfo(panel);
        });
        
        panel.querySelector('#sae-freeze-peak').addEventListener('change', (e) => {
            this.setFreezePeak(e.target.checked);
        });
        
        panel.querySelector('#sae-color-scheme').addEventListener('change', (e) => {
            this.setColorScheme(e.target.value);
        });
        
        panel.querySelector('#sae-clear-spectrogram').addEventListener('click', () => {
            this.clearSpectrogram();
        });
        
        this._updateFftInfo(panel);
        
        // Start visualization loop
        this._startVisualization(spectrumCanvas);
        
        return panel;
    }
    
    _updateFftInfo(panel) {
        const info = panel.querySelector('#sae-fft-info');
        const binInfo = this.getFrequencyBinInfo();
        info.textContent = `Bins: ${binInfo.binCount} | Bin width: ${binInfo.binWidth.toFixed(1)} Hz | Nyquist: ${binInfo.nyquist} Hz`;
    }
    
    _startVisualization(canvas) {
        const ctx = canvas.getContext('2d');
        const draw = () => {
            if (!this.isRunning) return;
            
            const width = canvas.width;
            const height = canvas.height;
            
            // Get frequency data
            const data = this.getFrequencyData();
            const peakData = this.config.freezePeak ? this.getPeakData() : null;
            
            // Clear
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            
            // Draw frequency bars
            const barWidth = width / data.length;
            const colorFunc = this.colorSchemes[this.config.colorScheme] || this.colorSchemes.viridis;
            
            for (let i = 0; i < data.length; i++) {
                const value = data[i] / 255;
                const barHeight = value * height;
                
                ctx.fillStyle = colorFunc(value);
                ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
            }
            
            // Draw peak line if freeze is enabled
            if (peakData) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let i = 0; i < peakData.length; i++) {
                    const x = i * barWidth + barWidth / 2;
                    const y = height - (peakData[i] / 255) * height;
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.stroke();
            }
            
            // Update spectrogram
            this.updateSpectrogram();
            
            requestAnimationFrame(draw);
        };
        
        this.isRunning = true;
        draw();
    }
    
    stop() {
        this.isRunning = false;
    }
    
    destroy() {
        this.stop();
        this.disconnect();
    }
}

// Export for use in main DAW
export function createSpectrumAnalyzerEnhancements(audioContext, options = {}) {
    return new SpectrumAnalyzerEnhancements(audioContext, options);
}

export function openSpectrumAnalyzerEnhancementsPanel(services = {}) {
    const { audioContext, container } = services;
    
    if (!audioContext || !container) {
        console.warn('Missing required services for Spectrum Analyzer Enhancements panel');
        return null;
    }
    
    const enhancer = new SpectrumAnalyzerEnhancements(audioContext);
    return enhancer.createPanel(container);
}