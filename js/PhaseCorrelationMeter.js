/**
 * Phase Correlation Meter - Real-time phase correlation display
 * Shows stereo phase relationship between left and right channels
 */

export class PhaseCorrelationMeter {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            smoothing: options.smoothing ?? 0.9,
            holdTime: options.holdTime ?? 0.5,
            warnThreshold: options.warnThreshold ?? 0.3,
            criticalThreshold: options.criticalThreshold ?? 0.0,
            ...options
        };
        
        // Audio nodes
        this.analyzerLeft = audioContext.createAnalyser();
        this.analyzerRight = audioContext.createAnalyser();
        this.merger = audioContext.createChannelMerger(2);
        this.splitter = audioContext.createChannelSplitter(2);
        
        // Analyzer settings
        this.analyzerLeft.fftSize = 2048;
        this.analyzerRight.fftSize = 2048;
        this.analyzerLeft.smoothingTimeConstant = this.config.smoothing;
        this.analyzerRight.smoothingTimeConstant = this.config.smoothing;
        
        // Data buffers
        this.dataLeft = new Float32Array(this.analyzerLeft.fftSize);
        this.dataRight = new Float32Array(this.analyzerRight.fftSize);
        
        // State
        this.correlation = 1.0;
        this.history = [];
        this.maxHistoryLength = 100;
        this.isRunning = false;
        this.holdValue = 1.0;
        this.holdTimer = null;
        
        // UI
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
    }
    
    // Connect input
    connect(inputNode) {
        // Split stereo into left/right
        inputNode.connect(this.splitter);
        
        // Connect each channel to analyzers
        this.splitter.connect(this.analyzerLeft, 0);
        this.splitter.connect(this.analyzerRight, 1);
        
        // Re-merge for output
        this.analyzerLeft.connect(this.merger, 0, 0);
        this.analyzerRight.connect(this.merger, 0, 1);
        
        return this.merger;
    }
    
    // Get output node
    getOutput() {
        return this.merger;
    }
    
    // Calculate phase correlation
    calculateCorrelation() {
        this.analyzerLeft.getFloatTimeDomainData(this.dataLeft);
        this.analyzerRight.getFloatTimeDomainData(this.dataRight);
        
        const length = this.dataLeft.length;
        
        // Calculate correlation coefficient
        let sumL = 0, sumR = 0, sumLR = 0;
        let sumL2 = 0, sumR2 = 0;
        
        for (let i = 0; i < length; i++) {
            const l = this.dataLeft[i];
            const r = this.dataRight[i];
            
            sumL += l;
            sumR += r;
            sumLR += l * r;
            sumL2 += l * l;
            sumR2 += r * r;
        }
        
        const meanL = sumL / length;
        const meanR = sumR / length;
        const meanLR = sumLR / length;
        const meanL2 = sumL2 / length;
        const meanR2 = sumR2 / length;
        
        // Pearson correlation coefficient
        const varianceL = meanL2 - meanL * meanL;
        const varianceR = meanR2 - meanR * meanR;
        const covariance = meanLR - meanL * meanR;
        
        const stdL = Math.sqrt(Math.max(0, varianceL));
        const stdR = Math.sqrt(Math.max(0, varianceR));
        
        if (stdL < 0.0001 || stdR < 0.0001) {
            return 1.0; // Silent signal, assume in phase
        }
        
        const correlation = covariance / (stdL * stdR);
        
        // Clamp to [-1, 1]
        return Math.max(-1, Math.min(1, correlation));
    }
    
    // Start monitoring
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.update();
    }
    
    // Stop monitoring
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    // Update loop
    update() {
        if (!this.isRunning) return;
        
        this.correlation = this.calculateCorrelation();
        
        // Update history
        this.history.push({
            value: this.correlation,
            time: this.audioContext.currentTime
        });
        
        if (this.history.length > this.maxHistoryLength) {
            this.history.shift();
        }
        
        // Update hold value (minimum seen recently)
        if (this.correlation < this.holdValue) {
            this.holdValue = this.correlation;
            clearTimeout(this.holdTimer);
            this.holdTimer = setTimeout(() => {
                this.holdValue = this.correlation;
            }, this.config.holdTime * 1000);
        }
        
        // Render if UI exists
        if (this.canvas) {
            this.render();
        }
        
        this.animationId = requestAnimationFrame(() => this.update());
    }
    
    // Get status
    getStatus() {
        return {
            correlation: this.correlation,
            holdValue: this.holdValue,
            status: this.getStatusLevel(),
            isMono: Math.abs(this.correlation) > 0.95,
            isPhaseIssue: this.correlation < this.config.warnThreshold
        };
    }
    
    // Get status level
    getStatusLevel() {
        if (this.correlation >= this.config.warnThreshold) return 'good';
        if (this.correlation >= this.config.criticalThreshold) return 'warning';
        return 'critical';
    }
    
    // Create UI
    createUI(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = containerId;
            document.body.appendChild(this.container);
        }
        
        this.container.innerHTML = `
            <div class="phase-correlation-meter" style="background: #1a1a2e; padding: 16px; border-radius: 8px; color: white; font-family: system-ui;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Phase Correlation</h3>
                <div class="meter-container" style="display: flex; gap: 12px; align-items: stretch;">
                    <div class="meter-vertical" style="width: 60px; display: flex; flex-direction: column; align-items: center;">
                        <canvas id="phase-meter-canvas" width="60" height="200" style="background: #0a0a14; border-radius: 4px;"></canvas>
                        <div class="meter-value" id="phase-value" style="font-size: 18px; font-weight: bold; margin-top: 8px; color: #10b981;">1.00</div>
                    </div>
                    <div class="history-container" style="flex: 1;">
                        <canvas id="phase-history-canvas" width="300" height="200" style="background: #0a0a14; border-radius: 4px;"></canvas>
                    </div>
                </div>
                <div class="status-bar" style="display: flex; justify-content: space-between; margin-top: 12px; font-size: 12px;">
                    <span id="phase-status" style="color: #10b981;">● In Phase</span>
                    <span id="phase-hold" style="color: #666;">Min: 1.00</span>
                </div>
                <div class="legend" style="display: flex; gap: 16px; margin-top: 12px; font-size: 11px; color: #666;">
                    <span><span style="color: #10b981;">●</span> Good (>0.3)</span>
                    <span><span style="color: #f59e0b;">●</span> Warning (0-0.3)</span>
                    <span><span style="color: #ef4444;">●</span> Critical (<0)</span>
                </div>
            </div>
        `;
        
        this.canvas = document.getElementById('phase-meter-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.historyCanvas = document.getElementById('phase-history-canvas');
        this.historyCtx = this.historyCanvas.getContext('2d');
        
        return this.container;
    }
    
    // Render meter
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear
        ctx.clearRect(0, 0, width, height);
        
        // Draw background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#ef4444');    // Red (anti-phase)
        gradient.addColorStop(0.5, '#f59e0b');  // Yellow (center)
        gradient.addColorStop(1, '#10b981');    // Green (in phase)
        
        // Draw meter track
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(10, 10, width - 20, height - 20);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.strokeRect(12, 12, width - 24, height - 24);
        
        // Draw scale lines
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = 10 + (height - 20) * (i / 4);
            ctx.beginPath();
            ctx.moveTo(5, y);
            ctx.lineTo(10, y);
            ctx.stroke();
        }
        
        // Draw current value
        const meterHeight = height - 20;
        const normalizedValue = (this.correlation + 1) / 2; // [-1,1] -> [0,1]
        const y = 10 + meterHeight * (1 - normalizedValue);
        
        // Current value bar
        ctx.fillStyle = this.getStatusColor();
        ctx.fillRect(15, y - 3, width - 30, 6);
        
        // Draw hold indicator
        const holdNormalized = (this.holdValue + 1) / 2;
        const holdY = 10 + meterHeight * (1 - holdNormalized);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(15, holdY);
        ctx.lineTo(width - 15, holdY);
        ctx.stroke();
        
        // Draw history
        this.renderHistory();
        
        // Update text
        const valueEl = document.getElementById('phase-value');
        const statusEl = document.getElementById('phase-status');
        const holdEl = document.getElementById('phase-hold');
        
        if (valueEl) {
            valueEl.textContent = this.correlation.toFixed(2);
            valueEl.style.color = this.getStatusColor();
        }
        
        if (statusEl) {
            const status = this.getStatus();
            statusEl.innerHTML = `<span style="color: ${this.getStatusColor()};">●</span> ${status.isMono ? 'Mono' : status.isPhaseIssue ? 'Phase Issue!' : 'In Phase'}`;
        }
        
        if (holdEl) {
            holdEl.textContent = `Min: ${this.holdValue.toFixed(2)}`;
        }
    }
    
    // Render history graph
    renderHistory() {
        const ctx = this.historyCtx;
        const width = this.historyCanvas.width;
        const height = this.historyCanvas.height;
        
        // Clear
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);
        
        // Draw center line (0)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        
        // Draw warning threshold lines
        ctx.strokeStyle = '#444';
        ctx.setLineDash([4, 4]);
        
        const warnY = height * (1 - (this.config.warnThreshold + 1) / 2);
        ctx.beginPath();
        ctx.moveTo(0, warnY);
        ctx.lineTo(width, warnY);
        ctx.stroke();
        
        const criticalY = height * (1 - (this.config.criticalThreshold + 1) / 2);
        ctx.beginPath();
        ctx.moveTo(0, criticalY);
        ctx.lineTo(width, criticalY);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Draw history line
        if (this.history.length < 2) return;
        
        ctx.beginPath();
        ctx.strokeStyle = this.getStatusColor();
        ctx.lineWidth = 2;
        
        for (let i = 0; i < this.history.length; i++) {
            const x = (i / this.maxHistoryLength) * width;
            const normalizedValue = (this.history[i].value + 1) / 2;
            const y = height * (1 - normalizedValue);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Fill under curve
        const lastX = (this.history.length / this.maxHistoryLength) * width;
        ctx.lineTo(lastX, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        
        const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
        fillGradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
        fillGradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.2)');
        fillGradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
        ctx.fillStyle = fillGradient;
        ctx.fill();
    }
    
    // Get status color
    getStatusColor() {
        const status = this.getStatusLevel();
        switch (status) {
            case 'good': return '#10b981';
            case 'warning': return '#f59e0b';
            case 'critical': return '#ef4444';
            default: return '#666';
        }
    }
    
    // Dispose
    dispose() {
        this.stop();
        this.analyzerLeft.disconnect();
        this.analyzerRight.disconnect();
        this.splitter.disconnect();
        this.merger.disconnect();
        
        if (this.container) {
            this.container.remove();
        }
    }
}

// Factory function
export function createPhaseCorrelationMeter(audioContext, options = {}) {
    return new PhaseCorrelationMeter(audioContext, options);
}

// Panel opener
export function openPhaseCorrelationPanel(audioContext, options = {}) {
    const meter = new PhaseCorrelationMeter(audioContext, options);
    meter.createUI('phase-correlation-panel');
    meter.start();
    return meter;
}