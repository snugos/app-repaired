// js/TimestretchDisplay.js - Visual preview of time-stretching
// Shows how audio will be affected before applying time stretch

class TimestretchDisplay {
    constructor(width = 400, height = 150) {
        this._width = width;
        this._height = height;
        this._canvas = null;
        this._ctx = null;
        
        this._params = {
            stretchFactor: 1.0, // 0.5 = twice as long, 2.0 = half as long
            preservePitch: true,
            algorithm: 'default' // 'default', 'OLA', 'phase-vocoder'
        };
        
        this._originalWaveform = null;
        this._stretchedWaveform = null;
        this._animationId = null;
    }
    
    initialize() {
        if (this._canvas) return;
        
        this._canvas = document.createElement('canvas');
        this._canvas.width = this._width;
        this._canvas.height = this._height;
        this._canvas.style.cssText = 'display:block;border-radius:8px;cursor:pointer;';
        
        this._ctx = this._canvas.getContext('2d');
        this._drawGrid();
    }
    
    getCanvas() {
        this.initialize();
        return this._canvas;
    }
    
    setOriginalWaveform(data) {
        this._originalWaveform = data;
        this._updateStretchedWaveform();
        this._draw();
    }
    
    setStretchFactor(factor) {
        this._params.stretchFactor = Math.max(0.25, Math.min(4.0, factor));
        this._updateStretchedWaveform();
        this._draw();
    }
    
    setAlgorithm(algo) {
        this._params.algorithm = algo;
        this._updateStretchedWaveform();
        this._draw();
    }
    
    _updateStretchedWaveform() {
        if (!this._originalWaveform || this._originalWaveform.length === 0) return;
        
        const original = this._originalWaveform;
        const factor = this._params.stretchFactor;
        
        // Simple time-domain stretching by resampling
        const newLength = Math.floor(original.length * factor);
        this._stretchedWaveform = new Float32Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
            const srcIndex = i / factor;
            const srcIndexFloor = Math.floor(srcIndex);
            const srcIndexCeil = Math.min(srcIndexFloor + 1, original.length - 1);
            const frac = srcIndex - srcIndexFloor;
            
            // Linear interpolation
            this._stretchedWaveform[i] = original[srcIndexFloor] * (1 - frac) + original[srcIndexCeil] * frac;
        }
    }
    
    _drawGrid() {
        const ctx = this._ctx;
        const w = this._width;
        const h = this._height;
        
        // Background
        ctx.fillStyle = '#0d0d12';
        ctx.fillRect(0, 0, w, h);
        
        // Grid lines
        ctx.strokeStyle = '#1a1a24';
        ctx.lineWidth = 1;
        
        // Vertical divisions
        for (let i = 0; i <= 8; i++) {
            const x = (w / 8) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        
        // Horizontal center line
        ctx.strokeStyle = '#2a2a3a';
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        
        // Zero crossing line
        ctx.strokeStyle = '#333344';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    _draw() {
        if (!this._ctx) return;
        
        const ctx = this._ctx;
        const w = this._width;
        const h = this._height;
        
        // Clear
        this._drawGrid();
        
        // Draw original waveform (ghost/preview)
        if (this._originalWaveform && this._originalWaveform.length > 0) {
            ctx.strokeStyle = 'rgba(80, 80, 120, 0.4)';
            ctx.lineWidth = 1;
            this._drawWaveform(ctx, this._originalWaveform, w * 0.5, 0.3); // Scaled to half width
        }
        
        // Draw stretched waveform
        if (this._stretchedWaveform && this._stretchedWaveform.length > 0) {
            const stretchColor = this._getStretchColor();
            ctx.strokeStyle = stretchColor;
            ctx.lineWidth = 2;
            this._drawWaveform(ctx, this._stretchedWaveform, w, 0.85);
        }
        
        // Draw labels
        this._drawLabels();
    }
    
    _drawWaveform(ctx, data, width, alpha) {
        const h = this._height;
        const centerY = h / 2;
        const amplitude = h * 0.4 * alpha;
        
        ctx.beginPath();
        
        const step = Math.max(1, Math.floor(data.length / width));
        
        for (let i = 0; i < width; i++) {
            const dataIndex = Math.floor(i * step);
            if (dataIndex >= data.length) break;
            
            const value = data[dataIndex];
            const y = centerY - (value * amplitude);
            
            if (i === 0) {
                ctx.moveTo(i, y);
            } else {
                ctx.lineTo(i, y);
            }
        }
        
        ctx.stroke();
    }
    
    _getStretchColor() {
        const factor = this._params.stretchFactor;
        if (factor < 0.8) return '#ff6644'; // Speed up = orange
        if (factor > 1.2) return '#44aaff'; // Slow down = blue
        return '#44ff88'; // Normal = green
    }
    
    _drawLabels() {
        const ctx = this._ctx;
        const w = this._width;
        
        ctx.font = '11px monospace';
        ctx.fillStyle = '#666';
        
        // Factor display
        const factor = this._params.stretchFactor;
        ctx.fillText(`Stretch: ${factor.toFixed(2)}x`, 10, 20);
        
        // Duration change
        if (this._originalWaveform && this._originalWaveform.length > 0) {
            const origDur = this._originalWaveform.length;
            const newDur = Math.floor(origDur * factor);
            ctx.fillText(`Duration: ${origDur} → ${newDur} samples`, 10, 36);
        }
        
        // Algorithm
        ctx.fillText(`Algorithm: ${this._params.algorithm}`, w - 120, 20);
        
        // Legend
        ctx.fillStyle = '#444466';
        ctx.fillText('Original', 10, h => h - 30);
        ctx.fillStyle = this._getStretchColor();
        ctx.fillText('Stretched', 10, h => h - 15);
    }
    
    animate() {
        if (this._animationId) return;
        
        const animate = () => {
            this._draw();
            this._animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    stop() {
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
    }
    
    dispose() {
        this.stop();
        this._originalWaveform = null;
        this._stretchedWaveform = null;
        this._canvas = null;
        this._ctx = null;
    }
}

// UI Panel
function openTimestretchDisplayPanel() {
    const existing = document.getElementById('timestretchDisplayPanel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'timestretchDisplayPanel';
    panel.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: #151520;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 16px;
        z-index: 1000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    `;
    
    const title = document.createElement('div');
    title.textContent = 'Timestretch Preview';
    title.style.cssText = 'font-size:13px;font-weight:bold;color:#888;margin-bottom:12px;text-align:center;';
    panel.appendChild(title);
    
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 150;
    canvas.style.cssText = 'display:block;border-radius:8px;background:#0d0d12;';
    panel.appendChild(canvas);
    
    const controls = document.createElement('div');
    controls.style.cssText = 'margin-top:12px;display:flex;gap:12px;align-items:center;';
    
    const factorLabel = document.createElement('label');
    factorLabel.textContent = 'Factor:';
    factorLabel.style.cssText = 'font-size:11px;color:#888;';
    
    const factorSlider = document.createElement('input');
    factorSlider.type = 'range';
    factorSlider.min = '0.25';
    factorSlider.max = '4.0';
    factorSlider.step = '0.05';
    factorSlider.value = '1.0';
    factorSlider.style.cssText = 'width:180px;';
    
    const factorValue = document.createElement('span');
    factorValue.textContent = '1.00x';
    factorValue.style.cssText = 'font-size:11px;color:#44aaff;min-width:45px;';
    
    factorSlider.oninput = () => {
        const val = parseFloat(factorSlider.value);
        factorValue.textContent = val.toFixed(2) + 'x';
        display.setStretchFactor(val);
    };
    
    controls.appendChild(factorLabel);
    controls.appendChild(factorSlider);
    controls.appendChild(factorValue);
    panel.appendChild(controls);
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 10px;
        background: none;
        border: none;
        color: #555;
        cursor: pointer;
        font-size: 14px;
    `;
    closeBtn.onclick = () => panel.remove();
    panel.appendChild(closeBtn);
    
    document.body.appendChild(panel);
    
    // Initialize display with demo waveform
    const display = new TimestretchDisplay(400, 150);
    const ctx = canvas.getContext('2d');
    
    // Generate demo waveform (sine wave with harmonics)
    const demoData = new Float32Array(500);
    for (let i = 0; i < demoData.length; i++) {
        const t = i / demoData.length;
        demoData[i] = Math.sin(2 * Math.PI * 5 * t) * 0.5 +
                      Math.sin(2 * Math.PI * 10 * t) * 0.3 +
                      Math.sin(2 * Math.PI * 20 * t) * 0.2;
    }
    
    display.setOriginalWaveform(demoData);
    
    // Animate to show stretching
    let factor = 0.5;
    const animateFactor = () => {
        factor += 0.002;
        if (factor > 4) factor = 0.5;
        factorSlider.value = factor;
        factorValue.textContent = factor.toFixed(2) + 'x';
        display.setStretchFactor(factor);
        if (panel.parentNode) requestAnimationFrame(animateFactor);
    };
    animateFactor();
}

export { TimestretchDisplay, openTimestretchDisplayPanel };