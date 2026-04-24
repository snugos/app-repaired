/**
 * Real-time Spectrogram - Visual frequency display during playback
 * Creates a scrolling spectrogram visualization with FFT analysis
 */

export class RealtimeSpectrogram {
    constructor(containerId, audioContext, options = {}) {
        this.containerId = containerId;
        this.audioContext = audioContext;
        
        // Parameters
        this.fftSize = options.fftSize ?? 2048;
        this.smoothing = options.smoothing ?? 0.8;
        this.scrollSpeed = options.scrollSpeed ?? 2; // pixels per frame
        this.colorScheme = options.colorScheme ?? 'viridis'; // viridis, magma, plasma, inferno
        this.minFreq = options.minFreq ?? 20;
        this.maxFreq = options.maxFreq ?? 20000;
        this.dbRange = options.dbRange ?? [-100, 0]; // dB range for coloring
        this.windowFunction = options.windowFunction ?? 'hann'; // hann, hamming, blackman
        
        // Canvas elements
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        
        // Audio nodes
        this.analyzer = null;
        this.sourceNode = null;
        
        // State
        this.isRunning = false;
        this.animationFrame = null;
        this.spectrogramBuffer = null;
        this.bufferWidth = 0;
        
        // Initialize
        this._init();
    }
    
    _init() {
        // Get container
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`[RealtimeSpectrogram] Container "${this.containerId}" not found`);
            return;
        }
        
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '200px';
        this.canvas.style.backgroundColor = '#1a1a2e';
        this.container.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this._resizeCanvas();
        
        // Create analyzer
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = this.fftSize;
        this.analyzer.smoothingTimeConstant = this.smoothing;
        this.analyzer.minDecibels = this.dbRange[0];
        this.analyzer.maxDecibels = this.dbRange[1];
        
        // Initialize spectrogram buffer
        this.bufferWidth = this.canvas.width;
        this.spectrogramBuffer = new Float32Array(this.bufferWidth * this.fftSize / 2);
        
        // Handle resize
        window.addEventListener('resize', () => this._resizeCanvas());
        
        console.log('[RealtimeSpectrogram] Initialized');
    }
    
    _resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = 200;
        
        // Reinitialize buffer
        this.bufferWidth = this.canvas.width;
        this.spectrogramBuffer = new Float32Array(this.bufferWidth * this.fftSize / 2);
    }
    
    // Connect to audio source
    connect(sourceNode) {
        this.sourceNode = sourceNode;
        this.sourceNode.connect(this.analyzer);
        return this;
    }
    
    // Connect to destination (pass-through)
    connectToDestination(destination) {
        this.analyzer.connect(destination);
        return this;
    }
    
    // Start visualization
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this._draw();
        
        console.log('[RealtimeSpectrogram] Started');
    }
    
    // Stop visualization
    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        
        console.log('[RealtimeSpectrogram] Stopped');
    }
    
    _draw() {
        if (!this.isRunning) return;
        
        // Get frequency data
        const frequencyData = new Float32Array(this.analyzer.frequencyBinCount);
        this.analyzer.getFloatFrequencyData(frequencyData);
        
        // Shift buffer left (scrolling effect)
        this._shiftBuffer();
        
        // Add new column to right edge
        this._addColumn(frequencyData);
        
        // Render
        this._render();
        
        this.animationFrame = requestAnimationFrame(() => this._draw());
    }
    
    _shiftBuffer() {
        const numBins = this.fftSize / 2;
        
        // Shift all columns left by scrollSpeed pixels
        for (let x = 0; x < this.bufferWidth - this.scrollSpeed; x++) {
            for (let y = 0; y < numBins; y++) {
                const srcIdx = (x + this.scrollSpeed) * numBins + y;
                const dstIdx = x * numBins + y;
                if (srcIdx < this.spectrogramBuffer.length) {
                    this.spectrogramBuffer[dstIdx] = this.spectrogramBuffer[srcIdx];
                }
            }
        }
    }
    
    _addColumn(frequencyData) {
        const numBins = this.fftSize / 2;
        const startX = this.bufferWidth - 1;
        
        for (let y = 0; y < numBins; y++) {
            const idx = startX * numBins + y;
            if (idx < this.spectrogramBuffer.length) {
                // Normalize to 0-1 range
                const db = frequencyData[y];
                const normalized = Math.max(0, Math.min(1, (db - this.dbRange[0]) / (this.dbRange[1] - this.dbRange[0])));
                this.spectrogramBuffer[idx] = normalized;
            }
        }
    }
    
    _render() {
        const numBins = this.fftSize / 2;
        const height = this.canvas.height;
        const width = this.canvas.width;
        
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, width, height);
        
        // Create ImageData for efficient rendering
        const imageData = this.ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Frequency bin mapping
        const nyquist = this.audioContext.sampleRate / 2;
        const minLog = Math.log10(this.minFreq);
        const maxLog = Math.log10(Math.min(this.maxFreq, nyquist));
        
        for (let x = 0; x < width && x < this.bufferWidth; x++) {
            for (let y = 0; y < height; y++) {
                // Map y position to frequency bin (logarithmic scale)
                const normalizedY = 1 - y / height;
                const freq = Math.pow(10, minLog + normalizedY * (maxLog - minLog));
                const bin = Math.floor(freq / nyquist * numBins);
                
                // Get value from buffer
                const bufferX = Math.min(x, this.bufferWidth - 1);
                const idx = bufferX * numBins + bin;
                let value = 0;
                if (idx >= 0 && idx < this.spectrogramBuffer.length) {
                    value = this.spectrogramBuffer[idx];
                }
                
                // Get color
                const color = this._getColor(value);
                
                // Set pixel
                const pixelIdx = (y * width + x) * 4;
                data[pixelIdx] = color.r;
                data[pixelIdx + 1] = color.g;
                data[pixelIdx + 2] = color.b;
                data[pixelIdx + 3] = 255;
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        
        // Draw frequency axis
        this._drawFrequencyAxis();
    }
    
    _getColor(value) {
        // Apply color scheme
        const v = Math.max(0, Math.min(1, value));
        
        switch (this.colorScheme) {
            case 'viridis':
                return this._viridisColor(v);
            case 'magma':
                return this._magmaColor(v);
            case 'plasma':
                return this._plasmaColor(v);
            case 'inferno':
                return this._infernoColor(v);
            default:
                return this._viridisColor(v);
        }
    }
    
    _viridisColor(v) {
        // Approximate viridis color map
        const r = Math.round(68 + v * (253 - 68));
        const g = Math.round(1 + v * (231 - 1));
        const b = Math.round(84 + v * (37 - 84));
        return { r, g, b };
    }
    
    _magmaColor(v) {
        const r = Math.round(0 + v * 252);
        const g = Math.round(3 + v * 175);
        const b = Math.round(100 + v * 95);
        return { r, g, b };
    }
    
    _plasmaColor(v) {
        const r = Math.round(13 + v * 240);
        const g = Math.round(8 + v * 95);
        const b = Math.round(135 + v * 95);
        return { r, g, b };
    }
    
    _infernoColor(v) {
        const r = Math.round(0 + v * 252);
        const g = Math.round(0 + v * 178);
        const b = Math.round(4 + v * 94);
        return { r, g, b };
    }
    
    _drawFrequencyAxis() {
        const height = this.canvas.height;
        const width = this.canvas.width;
        
        // Draw frequency labels
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '10px sans-serif';
        this.ctx.textAlign = 'left';
        
        const freqs = [20, 100, 500, 1000, 5000, 10000, 20000];
        const nyquist = this.audioContext.sampleRate / 2;
        const minLog = Math.log10(this.minFreq);
        const maxLog = Math.log10(Math.min(this.maxFreq, nyquist));
        
        freqs.forEach(freq => {
            if (freq >= this.minFreq && freq <= this.maxFreq && freq <= nyquist) {
                const normalized = (Math.log10(freq) - minLog) / (maxLog - minLog);
                const y = height - normalized * height;
                
                this.ctx.fillText(freq >= 1000 ? `${freq/1000}k` : `${freq}`, 5, y + 3);
                
                // Draw tick
                this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(width, y);
                this.ctx.stroke();
            }
        });
    }
    
    // Parameter setters
    setColorScheme(scheme) {
        this.colorScheme = scheme;
    }
    
    getColorScheme() {
        return this.colorScheme;
    }
    
    setScrollSpeed(speed) {
        this.scrollSpeed = Math.max(1, Math.min(10, speed));
    }
    
    getScrollSpeed() {
        return this.scrollSpeed;
    }
    
    setDbRange(minDb, maxDb) {
        this.dbRange = [minDb, maxDb];
        if (this.analyzer) {
            this.analyzer.minDecibels = minDb;
            this.analyzer.maxDecibels = maxDb;
        }
    }
    
    getDbRange() {
        return this.dbRange;
    }
    
    setFrequencyRange(minFreq, maxFreq) {
        this.minFreq = minFreq;
        this.maxFreq = maxFreq;
    }
    
    getFrequencyRange() {
        return [this.minFreq, this.maxFreq];
    }
    
    setSmoothing(value) {
        this.smoothing = Math.max(0, Math.min(1, value));
        if (this.analyzer) {
            this.analyzer.smoothingTimeConstant = this.smoothing;
        }
    }
    
    getSmoothing() {
        return this.smoothing;
    }
    
    // Export current spectrogram as image
    exportAsImage() {
        return this.canvas.toDataURL('image/png');
    }
    
    // Clear spectrogram
    clear() {
        this.spectrogramBuffer.fill(0);
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Get input node for connecting
    getInputNode() {
        return this.analyzer;
    }
    
    dispose() {
        this.stop();
        
        if (this.sourceNode) {
            try { this.sourceNode.disconnect(this.analyzer); } catch (e) {}
        }
        
        if (this.analyzer) {
            this.analyzer.disconnect();
        }
        
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        
        window.removeEventListener('resize', this._resizeCanvas);
        
        console.log('[RealtimeSpectrogram] Disposed');
    }
}

// Static methods
RealtimeSpectrogram.getMetronomeAudioLabel = function() { return 'Real-time Spectrogram'; };

console.log('[RealtimeSpectrogram] Module loaded');