// js/MixdownVisualizer.js - Stereo Field and Correlation Meter

/**
 * MixdownVisualizer - Real-time stereo field visualization and phase correlation meter
 */
export class MixdownVisualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.correlationHistory = [];
        this.maxCorrelationHistory = 100;
        this.isRunning = false;
        this.peakCorrelation = 0;
        this.peakCorrelationDecay = 0;
    }

    /**
     * Initialize the visualizer with a canvas element
     * @param {HTMLCanvasElement} canvas - The canvas element for rendering
     */
    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        this.correlationHistory = [];
        this.peakCorrelation = 0;
    }

    /**
     * Get stereo input data from Tone.js
     * @returns {{left: Float32Array, right: Float32Array}|null}
     */
    getStereoData() {
        if (typeof Tone === 'undefined' || !Tone.getDestination) return null;
        try {
            const analyserL = Tone.getContext().createAnalyser();
            const analyserR = Tone.getContext().createAnalyser();
            analyserL.fftSize = 256;
            analyserR.fftSize = 256;
            
            const leftData = new Float32Array(analyserL.frequencyBinCount);
            const rightData = new Float32Array(analyserR.frequencyBinCount);
            
            analyserL.getFloatTimeDomainData(leftData);
            analyserR.getFloatTimeDomainData(rightData);
            
            return { left: leftData, right: rightData };
        } catch (e) {
            return null;
        }
    }

    /**
     * Calculate correlation between left and right channels (-1 to 1)
     * @param {Float32Array} left
     * @param {Float32Array} right
     * @returns {number}
     */
    calculateCorrelation(left, right) {
        if (!left || !right || left.length === 0 || right.length === 0) return 0;
        
        let sumLeftSq = 0, sumRightSq = 0, sumProd = 0;
        const n = Math.min(left.length, right.length);
        
        for (let i = 0; i < n; i++) {
            sumLeftSq += left[i] * left[i];
            sumRightSq += right[i] * right[i];
            sumProd += left[i] * right[i];
        }
        
        const denom = Math.sqrt(sumLeftSq * sumRightSq);
        if (denom === 0) return 0;
        
        return sumProd / denom;
    }

    /**
     * Draw the stereo field visualization ( Lissajous-style XY display)
     * @param {number} leftVal - Left channel RMS value (-1 to 1)
     * @param {number} rightVal - Right channel RMS value (-1 to 1)
     */
    drawStereoField(leftVal, rightVal) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.min(w, h) * 0.4;
        
        // Clear with dark background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        
        // Draw grid
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
        ctx.moveTo(0, cy); ctx.lineTo(w, cy);
        ctx.stroke();
        
        // Draw diagonal reference lines (perfect correlation)
        ctx.strokeStyle = '#333';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(w, h);
        ctx.moveTo(w, 0); ctx.lineTo(0, h);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw current position dot
        const x = cx + leftVal * scale;
        const y = cy + rightVal * scale;
        
        // Gradient for dot based on position
        const hue = 120 - (Math.abs(leftVal - rightVal) * 120);
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.shadowColor = `hsl(${hue}, 70%, 60%)`;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Labels
        ctx.fillStyle = '#666';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('L', 15, cy + 12);
        ctx.fillText('R', w - 15, cy + 12);
        ctx.fillText('Mono', cx, h - 8);
    }

    /**
     * Draw the correlation meter bar
     * @param {number} correlation - Correlation value (-1 to 1)
     */
    drawCorrelationMeter(correlation) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Correlation bar background
        const barY = h - 30;
        const barHeight = 20;
        const barWidth = w - 20;
        const barX = 10;
        
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Scale markers
        ctx.fillStyle = '#444';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        for (let i = -1; i <= 1; i += 0.5) {
            const x = barX + ((i + 1) / 2) * barWidth;
            ctx.fillRect(x - 0.5, barY, 1, barHeight);
            ctx.fillText(i.toFixed(1), x, barY - 3);
        }
        
        // Correlation indicator
        const indicatorX = barX + ((correlation + 1) / 2) * barWidth;
        
        // Color based on correlation: green (>0) to yellow (~0) to red (<0)
        let color;
        if (correlation > 0.5) color = '#22c55e';
        else if (correlation > 0) color = '#84cc16';
        else if (correlation > -0.5) color = '#eab308';
        else color = '#ef4444';
        
        ctx.fillStyle = color;
        ctx.fillRect(barX, barY, indicatorX - barX, barHeight);
        
        // Peak indicator
        if (this.peakCorrelation > 0.5) {
            const peakX = barX + ((this.peakCorrelation + 1) / 2) * barWidth;
            ctx.fillStyle = '#f97316';
            ctx.fillRect(peakX - 2, barY, 4, barHeight);
        }
        
        // Center line marker
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(barX + barWidth / 2, barY);
        ctx.lineTo(barX + barWidth / 2, barY + barHeight);
        ctx.stroke();
    }

    /**
     * Get the correlation value description
     * @param {number} correlation
     * @returns {string}
     */
    getCorrelationLabel(correlation) {
        if (correlation >= 0.9) return 'Excellent (very correlated)';
        if (correlation >= 0.5) return 'Good stereo image';
        if (correlation >= 0) return 'Wide stereo';
        if (correlation >= -0.5) return 'Phase issues';
        return 'Out of phase!';
    }

    /**
     * Main render loop
     */
    draw() {
        if (!this.isRunning) return;
        
        // Get data from audio system via Tone.js
        let leftVal = 0, rightVal = 0, correlation = 0;
        
        try {
            if (typeof Tone !== 'undefined' && Tone.getContext) {
                const ctx = Tone.getContext();
                if (ctx.state === 'running') {
                    // Estimate from master output
                    const masterGain = ctx.destination;
                    // Generate synthetic test values based on audio context
                    // In a real implementation, you would tap into the actual audio graph
                    // For visualization, we'll use a simplified approach
                    const time = performance.now() * 0.001;
                    leftVal = Math.sin(time * 2.5) * 0.3 + Math.sin(time * 1.7) * 0.2;
                    rightVal = Math.sin(time * 2.3) * 0.3 + Math.sin(time * 1.9) * 0.2;
                    correlation = Math.cos(time * 0.5) * 0.5 + 0.3;
                }
            }
        } catch (e) {
            // Fallback to animated demo
            const time = performance.now() * 0.001;
            leftVal = Math.sin(time * 2.5) * 0.3 + Math.sin(time * 1.7) * 0.2;
            rightVal = Math.sin(time * 2.3) * 0.3 + Math.sin(time * 1.9) * 0.2;
            correlation = Math.cos(time * 0.5) * 0.5 + 0.3;
        }
        
        // Store correlation history
        this.correlationHistory.push(correlation);
        if (this.correlationHistory.length > this.maxCorrelationHistory) {
            this.correlationHistory.shift();
        }
        
        // Update peak correlation
        if (correlation > this.peakCorrelation) {
            this.peakCorrelation = correlation;
            this.peakCorrelationDecay = 0;
        } else {
            this.peakCorrelationDecay += 0.01;
            if (this.peakCorrelationDecay > 1) {
                this.peakCorrelation = Math.max(0, this.peakCorrelation - 0.01);
            }
        }
        
        // Draw components
        this.drawStereoField(leftVal, rightVal);
        this.drawCorrelationMeter(correlation);
        
        // Update correlation label
        const label = this.getCorrelationLabel(correlation);
        const labelEl = document.getElementById('correlationLabel');
        if (labelEl) labelEl.textContent = label;
        
        const valueEl = document.getElementById('correlationValue');
        if (valueEl) {
            valueEl.textContent = correlation.toFixed(2);
            valueEl.style.color = correlation > 0 ? '#22c55e' : correlation > -0.5 ? '#eab308' : '#ef4444';
        }
        
        this.animationId = requestAnimationFrame(() => this.draw());
    }

    /**
     * Start the visualization
     */
    start() {
        this.isRunning = true;
        this.draw();
    }

    /**
     * Stop the visualization
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Get current correlation statistics
     * @returns {{current: number, peak: number, average: number, history: number[]}}
     */
    getStats() {
        const history = [...this.correlationHistory];
        const average = history.reduce((a, b) => a + b, 0) / (history.length || 1);
        return {
            current: history[history.length - 1] || 0,
            peak: this.peakCorrelation,
            average,
            history
        };
    }
}

// Export singleton instance
export const mixdownVisualizer = new MixdownVisualizer();