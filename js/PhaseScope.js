// js/PhaseScope.js - Real-time phase correlation visualization
// Shows the phase relationship between left and right channels
// Values range from -1 (out of phase) to +1 (perfectly in phase)

class PhaseScope {
    constructor(width = 200, height = 100) {
        this._width = width;
        this._height = height;
        this._canvas = null;
        this._ctx = null;
        this._analyserL = null;
        this._analyserR = null;
        this._dataArrayL = null;
        this._dataArrayR = null;
        this._correlationHistory = [];
        this._maxHistory = 100;
        this._running = false;
        this._drawCallback = null;
    }
    
    initialize() {
        if (this._canvas) return;
        
        // Create canvas
        this._canvas = document.createElement('canvas');
        this._canvas.width = this._width;
        this._canvas.height = this._height;
        this._canvas.style.cssText = 'display:block;background:#111;border-radius:4px;';
        this._ctx = this._canvas.getContext('2d');
        
        // Clear
        this._ctx.fillStyle = '#111';
        this._ctx.fillRect(0, 0, this._width, this._height);
        
        // Draw center line
        this._ctx.strokeStyle = '#333';
        this._ctx.beginPath();
        this._ctx.moveTo(0, this._height / 2);
        this._ctx.lineTo(this._width, this._height / 2);
        this._ctx.stroke();
    }
    
    getCanvas() {
        this.initialize();
        return this._canvas;
    }
    
    connect(leftAnalyser, rightAnalyser) {
        this._analyserL = leftAnalyser;
        this._analyserR = rightAnalyser;
        
        const bufferLength = leftAnalyser.fftSize;
        this._dataArrayL = new Float32Array(bufferLength);
        this._dataArrayR = new Float32Array(bufferLength);
    }
    
    computeCorrelation() {
        if (!this._analyserL || !this._analyserR) return 0;
        
        this._analyserL.getFloatTimeDomainData(this._dataArrayL);
        this._analyserR.getFloatTimeDomainData(this._dataArrayR);
        
        // Compute Pearson correlation coefficient
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        const n = this._dataArrayL.length;
        
        for (let i = 0; i < n; i++) {
            const x = this._dataArrayL[i];
            const y = this._dataArrayR[i];
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
            sumY2 += y * y;
        }
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        if (denominator === 0) return 1; // Both silent = correlated
        return numerator / denominator;
    }
    
    update() {
        const correlation = this.computeCorrelation();
        
        // Add to history
        this._correlationHistory.push(correlation);
        if (this._correlationHistory.length > this._maxHistory) {
            this._correlationHistory.shift();
        }
        
        // Draw
        this._draw(correlation);
    }
    
    _draw(correlation) {
        if (!this._ctx) return;
        
        const ctx = this._ctx;
        const w = this._width;
        const h = this._height;
        
        // Clear with fade effect
        ctx.fillStyle = 'rgba(17, 17, 17, 0.3)';
        ctx.fillRect(0, 0, w, h);
        
        // Draw center line
        ctx.strokeStyle = '#444';
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        
        // Draw correlation history as waveform
        ctx.beginPath();
        ctx.strokeStyle = this._getCorrelationColor(correlation);
        ctx.lineWidth = 2;
        
        const step = w / this._maxHistory;
        for (let i = 0; i < this._correlationHistory.length; i++) {
            const x = i * step;
            const y = h / 2 - (this._correlationHistory[i] * h / 2);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Draw current value marker
        const dotX = w - 10;
        const dotY = h / 2 - (correlation * h / 2);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = this._getCorrelationColor(correlation);
        ctx.fill();
        
        // Draw correlation value text
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`Corr: ${correlation.toFixed(2)}`, w - 5, 12);
    }
    
    _getCorrelationColor(correlation) {
        // Green = good phase (+1), yellow = mono (0), red = out of phase (-1)
        if (correlation > 0.5) return '#00ff88';
        if (correlation > 0) return '#aaff00';
        if (correlation > -0.5) return '#ffaa00';
        return '#ff4444';
    }
    
    start(callback) {
        this._drawCallback = callback;
        this._running = true;
        this._animate();
    }
    
    _animate() {
        if (!this._running) return;
        this.update();
        if (this._drawCallback) this._drawCallback(this._canvas);
        requestAnimationFrame(() => this._animate());
    }
    
    stop() {
        this._running = false;
    }
    
    dispose() {
        this.stop();
        this._analyserL = null;
        this._analyserR = null;
        this._dataArrayL = null;
        this._dataArrayR = null;
        this._correlationHistory = [];
        if (this._canvas) {
            this._canvas = null;
            this._ctx = null;
        }
    }
}

// UI Panel for PhaseScope
function openPhaseScopePanel() {
    // Check if already open
    const existing = document.getElementById('phaseScopePanel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'phaseScopePanel';
    panel.style.cssText = `
        position: fixed;
        bottom: 120px;
        right: 20px;
        width: 220px;
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 12px;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    const title = document.createElement('div');
    title.textContent = 'Phase Scope';
    title.style.cssText = 'font-size:12px;font-weight:bold;color:#888;margin-bottom:8px;';
    panel.appendChild(title);
    
    const canvas = document.createElement('canvas');
    canvas.width = 196;
    canvas.height = 80;
    canvas.style.cssText = 'display:block;border-radius:4px;background:#111;';
    panel.appendChild(canvas);
    
    const info = document.createElement('div');
    info.style.cssText = 'font-size:10px;color:#666;margin-top:8px;text-align:center;';
    info.textContent = '+1 = In Phase | 0 = Mono | -1 = Out of Phase';
    panel.appendChild(info);
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 10px;
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        font-size: 14px;
    `;
    closeBtn.onclick = () => panel.remove();
    panel.appendChild(closeBtn);
    
    // Initialize phase scope
    const scope = new PhaseScope(196, 80);
    scope.connect(app.masterAnalyserL, app.masterAnalyserR);
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 196, 80);
    
    // Start animation
    scope.start((c) => {
        // canvas already updated
    });
    
    document.body.appendChild(panel);
}

export { PhaseScope, openPhaseScopePanel };