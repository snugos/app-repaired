/**
 * Phase Correlation Meter
 * Displays real-time phase relationship between stereo channels (-1 to +1)
 * +1 = perfectly in phase (mono compatible)
 * 0 = no correlation
 * -1 = perfectly out of phase (phase cancellation)
 */
class PhaseCorrelationMeter {
    constructor(container, track) {
        this.container = container;
        this.track = track;
        this.analyserL = null;
        this.analyserR = null;
        this.splitter = null;
        this.context = null;
        this.canvas = null;
        this.ctx = null;
        this.isRunning = false;
        this.correlation = 0;
        this.animationId = null;
    }

    async initialize() {
        if (!this.track.audioChannel) return false;
        
        this.context = this.track.audioChannel.context;
        
        // Create splitter to get left/right channels
        this.splitter = this.context.createChannelSplitter(2);
        
        // Create analysers
        this.analyserL = this.context.createAnalyser();
        this.analyserL.fftSize = 2048;
        this.analyserR = this.context.createAnalyser();
        this.analyserR.fftSize = 2048;
        
        // Connect track to splitter, then to analysers
        try {
            const gainNode = this.track.gainNode;
            gainNode.connect(this.splitter);
            this.splitter.connect(this.analyserL, 0);
            this.splitter.connect(this.analyserR, 1);
        } catch (e) {
            console.warn("PhaseCorrelationMeter: Could not connect to track", e);
            return false;
        }
        
        return true;
    }

    createUI() {
        const wrapper = document.createElement('div');
        wrapper.className = 'phase-correlation-meter';
        wrapper.style.cssText = `
            width: 200px;
            padding: 10px;
            background: #1a1a1a;
            border-radius: 8px;
            margin: 5px;
        `;
        
        const title = document.createElement('div');
        title.style.cssText = 'color: #888; font-size: 10px; margin-bottom: 5px;';
        title.textContent = 'PHASE CORRELATION';
        wrapper.appendChild(title);
        
        this.canvas = document.createElement('canvas');
        this.canvas.width = 180;
        this.canvas.height = 60;
        this.canvas.style.cssText = 'background: #0a0a0a; border-radius: 4px;';
        wrapper.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        
        this.valueDisplay = document.createElement('div');
        this.valueDisplay.style.cssText = `
            color: #0f0;
            font-size: 14px;
            font-family: monospace;
            text-align: center;
            margin-top: 5px;
        `;
        this.valueDisplay.textContent = '0.00';
        wrapper.appendChild(this.valueDisplay);
        
        this.label = document.createElement('div');
        this.label.style.cssText = 'color: #666; font-size: 9px; text-align: center; margin-top: 2px;';
        this.label.textContent = '+1 = IN PHASE | -1 = OUT OF PHASE';
        wrapper.appendChild(this.label);
        
        return wrapper;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.draw();
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }

    calculateCorrelation() {
        if (!this.analyserL || !this.analyserR) return 0;
        
        const bufferLength = this.analyserL.fftSize;
        const dataL = new Float32Array(bufferLength);
        const dataR = new Float32Array(bufferLength);
        
        this.analyserL.getFloatTimeDomainData(dataL);
        this.analyserR.getFloatTimeDomainData(dataR);
        
        // Calculate RMS for each channel
        let sumL = 0, sumR = 0, sumLR = 0;
        for (let i = 0; i < bufferLength; i++) {
            sumL += dataL[i] * dataL[i];
            sumR += dataR[i] * dataR[i];
            sumLR += dataL[i] * dataR[i];
        }
        
        const rmsL = Math.sqrt(sumL / bufferLength);
        const rmsR = Math.sqrt(sumR / bufferLength);
        
        if (rmsL < 0.001 || rmsR < 0.001) return 0;
        
        const correlation = sumLR / (bufferLength * rmsL * rmsR);
        return Math.max(-1, Math.min(1, correlation));
    }

    draw() {
        if (!this.isRunning) return;
        
        this.correlation = this.calculateCorrelation();
        
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        
        // Draw meter background gradient
        const gradient = ctx.createLinearGradient(0, 0, w, 0);
        gradient.addColorStop(0, '#c00');
        gradient.addColorStop(0.5, '#0c0');
        gradient.addColorStop(1, '#c00');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, h - 10, w, 10);
        
        // Draw correlation indicator
        const normalizedCorr = (this.correlation + 1) / 2; // 0 to 1
        const indicatorX = normalizedCorr * w;
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(indicatorX, 0);
        ctx.lineTo(indicatorX - 8, h - 10);
        ctx.lineTo(indicatorX + 8, h - 10);
        ctx.closePath();
        ctx.fill();
        
        // Update value display
        const color = this.correlation < 0 ? '#f00' : '#0f0';
        this.valueDisplay.style.color = color;
        this.valueDisplay.textContent = this.correlation.toFixed(2);
        
        // Draw labels
        ctx.fillStyle = '#444';
        ctx.font = '8px monospace';
        ctx.fillText('-1', 2, h - 15);
        ctx.fillText('0', w / 2 - 4, h - 15);
        ctx.fillText('+1', w - 14, h - 15);
        
        // Warning for phase issues
        if (this.correlation < -0.5) {
            ctx.fillStyle = '#f00';
            ctx.font = '9px sans-serif';
            ctx.fillText('⚠ PHASE ISSUE', w / 2 - 30, 12);
        }
        
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    dispose() {
        this.stop();
        if (this.splitter) {
            try { this.splitter.disconnect(); } catch(e) {}
        }
        this.analyserL = null;
        this.analyserR = null;
        this.splitter = null;
        this.container = null;
    }
}

// Export for use in other modules
window.PhaseCorrelationMeter = PhaseCorrelationMeter;