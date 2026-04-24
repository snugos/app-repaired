/**
 * Audio Phase Correlation Display - Real-time phase visualization
 * Visualizes phase relationship between stereo channels
 */

class AudioPhaseCorrelationDisplay {
    constructor(audioContext, options = {}) {
        this.name = 'AudioPhaseCorrelationDisplay';
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            fftSize: options.fftSize || 2048,
            smoothing: options.smoothing || 0.8,
            updateInterval: options.updateInterval || 50, // ms
            historyLength: options.historyLength || 100,
            phaseThreshold: options.phaseThreshold || 0.3, // Warning threshold
            ...options
        };
        
        // Analysis nodes
        this.analyserLeft = null;
        this.analyserRight = null;
        this.splitter = null;
        this.merger = null;
        
        // Data buffers
        this.leftData = null;
        this.rightData = null;
        this.phaseData = new Float32Array(this.config.historyLength);
        this.correlationHistory = [];
        
        // State
        this.isRunning = false;
        this.animationId = null;
        this.lastUpdateTime = 0;
        
        // Metrics
        this.metrics = {
            currentCorrelation: 1.0,
            averageCorrelation: 1.0,
            minCorrelation: 1.0,
            maxCorrelation: 1.0,
            phaseShift: 0,
            stereoWidth: 1.0,
            monoCompatibility: 'Good'
        };
        
        // Callbacks
        this.onUpdate = null;
        this.onPhaseIssue = null;
        
        // UI
        this.canvas = null;
        this.ctx = null;
        this.container = null;
    }
    
    connect(sourceNode) {
        // Create analyser nodes for each channel
        this.analyserLeft = this.audioContext.createAnalyser();
        this.analyserRight = this.audioContext.createAnalyser();
        
        this.analyserLeft.fftSize = this.config.fftSize;
        this.analyserRight.fftSize = this.config.fftSize;
        this.analyserLeft.smoothingTimeConstant = this.config.smoothing;
        this.analyserRight.smoothingTimeConstant = this.config.smoothing;
        
        // Channel splitter
        this.splitter = this.audioContext.createChannelSplitter(2);
        this.merger = this.audioContext.createChannelMerger(2);
        
        // Route: source -> splitter -> analysers -> merger -> output
        sourceNode.connect(this.splitter);
        this.splitter.connect(this.analyserLeft, 0);
        this.splitter.connect(this.analyserRight, 1);
        this.analyserLeft.connect(this.merger, 0, 0);
        this.analyserRight.connect(this.merger, 0, 1);
        
        // Initialize data buffers
        this.leftData = new Float32Array(this.analyserLeft.frequencyBinCount);
        this.rightData = new Float32Array(this.analyserRight.frequencyBinCount);
        
        return this.merger;
    }
    
    disconnect() {
        this.stop();
        if (this.splitter) {
            this.splitter.disconnect();
        }
        if (this.analyserLeft) {
            this.analyserLeft.disconnect();
        }
        if (this.analyserRight) {
            this.analyserRight.disconnect();
        }
        if (this.merger) {
            this.merger.disconnect();
        }
    }
    
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastUpdateTime = performance.now();
        this.update();
    }
    
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    update() {
        if (!this.isRunning) return;
        
        const now = performance.now();
        if (now - this.lastUpdateTime >= this.config.updateInterval) {
            this.lastUpdateTime = now;
            this.analyzePhase();
        }
        
        this.animationId = requestAnimationFrame(() => this.update());
    }
    
    analyzePhase() {
        if (!this.analyserLeft || !this.analyserRight) return;
        
        // Get time domain data
        this.analyserLeft.getFloatTimeDomainData(this.leftData);
        this.analyserRight.getFloatTimeDomainData(this.rightData);
        
        // Calculate phase correlation
        const correlation = this.calculateCorrelation(this.leftData, this.rightData);
        
        // Update metrics
        this.metrics.currentCorrelation = correlation;
        this.correlationHistory.push(correlation);
        
        if (this.correlationHistory.length > this.config.historyLength) {
            this.correlationHistory.shift();
        }
        
        // Calculate statistics
        this.calculateStatistics();
        
        // Check for phase issues
        if (correlation < this.config.phaseThreshold && this.onPhaseIssue) {
            this.onPhaseIssue({
                correlation,
                time: this.audioContext.currentTime
            });
        }
        
        // Update UI
        this.updateDisplay();
        
        if (this.onUpdate) {
            this.onUpdate(this.metrics);
        }
    }
    
    calculateCorrelation(left, right) {
        // Pearson correlation coefficient
        let sumL = 0, sumR = 0, sumLR = 0, sumL2 = 0, sumR2 = 0;
        const n = left.length;
        
        for (let i = 0; i < n; i++) {
            const l = left[i];
            const r = right[i];
            sumL += l;
            sumR += r;
            sumLR += l * r;
            sumL2 += l * l;
            sumR2 += r * r;
        }
        
        const meanL = sumL / n;
        const meanR = sumR / n;
        const varL = sumL2 / n - meanL * meanL;
        const varR = sumR2 / n - meanR * meanR;
        const covLR = sumLR / n - meanL * meanR;
        
        const stdL = Math.sqrt(Math.max(0, varL));
        const stdR = Math.sqrt(Math.max(0, varR));
        
        if (stdL < 1e-10 || stdR < 1e-10) {
            return 1.0; // No signal, assume correlated
        }
        
        return Math.max(-1, Math.min(1, covLR / (stdL * stdR)));
    }
    
    calculateStatistics() {
        if (this.correlationHistory.length === 0) return;
        
        const history = this.correlationHistory;
        
        this.metrics.averageCorrelation = history.reduce((a, b) => a + b, 0) / history.length;
        this.metrics.minCorrelation = Math.min(...history);
        this.metrics.maxCorrelation = Math.max(...history);
        
        // Calculate stereo width from correlation
        // Width = sqrt(1 - correlation^2) * 2 (0 = mono, 2 = max width)
        this.metrics.stereoWidth = Math.sqrt(1 - this.metrics.averageCorrelation * this.metrics.averageCorrelation) * 2;
        
        // Calculate phase shift estimate
        this.metrics.phaseShift = this.estimatePhaseShift();
        
        // Determine mono compatibility
        if (this.metrics.averageCorrelation > 0.7) {
            this.metrics.monoCompatibility = 'Excellent';
        } else if (this.metrics.averageCorrelation > 0.5) {
            this.metrics.monoCompatibility = 'Good';
        } else if (this.metrics.averageCorrelation > 0.3) {
            this.metrics.monoCompatibility = 'Acceptable';
        } else if (this.metrics.averageCorrelation > 0) {
            this.metrics.monoCompatibility = 'Poor';
        } else {
            this.metrics.monoCompatibility = 'Phase Inverted';
        }
    }
    
    estimatePhaseShift() {
        // Cross-correlation to estimate phase shift
        if (!this.leftData || !this.rightData) return 0;
        
        const left = this.leftData;
        const right = this.rightData;
        const n = left.length;
        const maxShift = Math.min(100, n / 4);
        
        let maxCorr = -1;
        let bestShift = 0;
        
        for (let shift = -maxShift; shift <= maxShift; shift++) {
            let corr = 0;
            let count = 0;
            
            for (let i = 0; i < n; i++) {
                const j = i + shift;
                if (j >= 0 && j < n) {
                    corr += left[i] * right[j];
                    count++;
                }
            }
            
            if (count > 0) {
                corr /= count;
                if (corr > maxCorr) {
                    maxCorr = corr;
                    bestShift = shift;
                }
            }
        }
        
        // Convert shift to degrees
        const samplesToDegrees = (360 * this.audioContext.sampleRate) / this.config.fftSize;
        return bestShift * samplesToDegrees;
    }
    
    updateDisplay() {
        if (!this.ctx || !this.canvas) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw correlation meter (vertical)
        this.drawCorrelationMeter();
        
        // Draw history graph
        this.drawHistoryGraph();
        
        // Draw phase scope (Lissajous)
        this.drawPhaseScope();
        
        // Draw metrics text
        this.drawMetrics();
    }
    
    drawCorrelationMeter() {
        const x = 30;
        const y = 60;
        const meterWidth = 30;
        const meterHeight = 200;
        
        // Background
        this.ctx.fillStyle = '#2a2a4e';
        this.ctx.fillRect(x, y, meterWidth, meterHeight);
        
        // Correlation value
        const corr = this.metrics.currentCorrelation;
        const fillHeight = (corr + 1) / 2 * meterHeight; // -1 to 1 -> 0 to 1
        const fillY = y + meterHeight - fillHeight;
        
        // Color based on correlation
        let color;
        if (corr > 0.5) {
            color = '#10b981'; // Green
        } else if (corr > 0) {
            color = '#f59e0b'; // Orange
        } else {
            color = '#ef4444'; // Red
        }
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, fillY, meterWidth, fillHeight);
        
        // Labels
        this.ctx.fillStyle = '#888';
        this.ctx.font = '11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('+1', x + meterWidth / 2, y - 5);
        this.ctx.fillText('0', x + meterWidth / 2, y + meterHeight / 2);
        this.ctx.fillText('-1', x + meterWidth / 2, y + meterHeight + 15);
        
        // Title
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.fillText('Correlation', x + meterWidth / 2, 50);
    }
    
    drawHistoryGraph() {
        const x = 80;
        const y = 60;
        const graphWidth = 200;
        const graphHeight = 100;
        
        // Background
        this.ctx.fillStyle = '#2a2a4e';
        this.ctx.fillRect(x, y, graphWidth, graphHeight);
        
        // Draw threshold lines
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        
        // 0.5 line
        const line05 = y + graphHeight * 0.25;
        this.ctx.beginPath();
        this.ctx.moveTo(x, line05);
        this.ctx.lineTo(x + graphWidth, line05);
        this.ctx.stroke();
        
        // 0 line
        const line0 = y + graphHeight * 0.5;
        this.ctx.beginPath();
        this.ctx.moveTo(x, line0);
        this.ctx.lineTo(x + graphWidth, line0);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        // Draw history
        if (this.correlationHistory.length > 1) {
            this.ctx.strokeStyle = '#10b981';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            
            for (let i = 0; i < this.correlationHistory.length; i++) {
                const px = x + (i / this.config.historyLength) * graphWidth;
                const py = y + graphHeight - ((this.correlationHistory[i] + 1) / 2) * graphHeight;
                
                if (i === 0) {
                    this.ctx.moveTo(px, py);
                } else {
                    this.ctx.lineTo(px, py);
                }
            }
            
            this.ctx.stroke();
        }
        
        // Title
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('History', x, 50);
    }
    
    drawPhaseScope() {
        const x = 300;
        const y = 60;
        const scopeSize = 150;
        
        // Background
        this.ctx.fillStyle = '#2a2a4e';
        this.ctx.fillRect(x, y, scopeSize, scopeSize);
        
        // Center cross
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + scopeSize / 2, y);
        this.ctx.lineTo(x + scopeSize / 2, y + scopeSize);
        this.ctx.moveTo(x, y + scopeSize / 2);
        this.ctx.lineTo(x + scopeSize, y + scopeSize / 2);
        this.ctx.stroke();
        
        // Diagonal reference (perfect correlation)
        this.ctx.strokeStyle = '#555';
        this.ctx.setLineDash([4, 4]);
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + scopeSize, y + scopeSize);
        this.ctx.moveTo(x + scopeSize, y);
        this.ctx.lineTo(x, y + scopeSize);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Draw Lissajous figure
        if (this.leftData && this.rightData) {
            const centerX = x + scopeSize / 2;
            const centerY = y + scopeSize / 2;
            const scale = scopeSize / 2.5;
            
            this.ctx.strokeStyle = '#10b981';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            
            const step = Math.max(1, Math.floor(this.leftData.length / 500));
            
            for (let i = 0; i < this.leftData.length; i += step) {
                const px = centerX + this.leftData[i] * scale;
                const py = centerY - this.rightData[i] * scale;
                
                if (i === 0) {
                    this.ctx.moveTo(px, py);
                } else {
                    this.ctx.lineTo(px, py);
                }
            }
            
            this.ctx.stroke();
        }
        
        // Title
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Phase Scope', x, 50);
    }
    
    drawMetrics() {
        const x = 470;
        const y = 60;
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Metrics', x, 50);
        
        this.ctx.font = '11px monospace';
        this.ctx.fillStyle = '#888';
        
        const lines = [
            `Current: ${this.metrics.currentCorrelation.toFixed(3)}`,
            `Average: ${this.metrics.averageCorrelation.toFixed(3)}`,
            `Min: ${this.metrics.minCorrelation.toFixed(3)}`,
            `Max: ${this.metrics.maxCorrelation.toFixed(3)}`,
            `Width: ${this.metrics.stereoWidth.toFixed(2)}`,
            `Phase: ${this.metrics.phaseShift.toFixed(1)}°`,
            '',
            `Mono: ${this.metrics.monoCompatibility}`
        ];
        
        lines.forEach((line, i) => {
            // Color the mono compatibility line
            if (line.startsWith('Mono:')) {
                let color;
                const comp = this.metrics.monoCompatibility;
                if (comp === 'Excellent') color = '#10b981';
                else if (comp === 'Good') color = '#22c55e';
                else if (comp === 'Acceptable') color = '#f59e0b';
                else color = '#ef4444';
                this.ctx.fillStyle = color;
            } else {
                this.ctx.fillStyle = '#888';
            }
            this.ctx.fillText(line, x, y + 20 + i * 16);
        });
    }
    
    createUI(container) {
        this.container = container;
        
        container.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 8px;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #fff;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 14px;">Audio Phase Correlation Display</h3>
                    <div>
                        <button id="phase-start-btn" style="padding: 6px 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">Start</button>
                        <button id="phase-stop-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Stop</button>
                    </div>
                </div>
                <canvas id="phase-canvas" width="600" height="260" style="width: 100%; border-radius: 4px;"></canvas>
                <div style="margin-top: 12px; display: flex; gap: 16px;">
                    <label style="font-size: 12px; color: #888;">
                        Warning Threshold:
                        <input type="range" id="phase-threshold" min="0" max="1" step="0.05" value="${this.config.phaseThreshold}" style="width: 100px;">
                        <span id="threshold-value">${this.config.phaseThreshold}</span>
                    </label>
                    <label style="font-size: 12px; color: #888;">
                        Smoothing:
                        <input type="range" id="phase-smoothing" min="0" max="0.99" step="0.01" value="${this.config.smoothing}" style="width: 100px;">
                        <span id="smoothing-value">${this.config.smoothing}</span>
                    </label>
                </div>
            </div>
        `;
        
        this.canvas = container.querySelector('#phase-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Event handlers
        container.querySelector('#phase-start-btn').onclick = () => this.start();
        container.querySelector('#phase-stop-btn').onclick = () => this.stop();
        
        const thresholdInput = container.querySelector('#phase-threshold');
        const thresholdValue = container.querySelector('#threshold-value');
        thresholdInput.oninput = () => {
            this.config.phaseThreshold = parseFloat(thresholdInput.value);
            thresholdValue.textContent = this.config.phaseThreshold;
        };
        
        const smoothingInput = container.querySelector('#phase-smoothing');
        const smoothingValue = container.querySelector('#smoothing-value');
        smoothingInput.oninput = () => {
            this.config.smoothing = parseFloat(smoothingInput.value);
            if (this.analyserLeft) {
                this.analyserLeft.smoothingTimeConstant = this.config.smoothing;
                this.analyserRight.smoothingTimeConstant = this.config.smoothing;
            }
            smoothingValue.textContent = this.config.smoothing;
        };
        
        // Initial display
        this.updateDisplay();
    }
    
    openPanel() {
        const existing = document.getElementById('phase-correlation-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'phase-correlation-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 700px;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
        `;
        
        document.body.appendChild(panel);
        this.createUI(panel);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 6px 12px;
            background: #ef4444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        closeBtn.onclick = () => {
            this.stop();
            panel.remove();
        };
        panel.appendChild(closeBtn);
    }
    
    getMetrics() {
        return { ...this.metrics };
    }
    
    getHistory() {
        return [...this.correlationHistory];
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioPhaseCorrelationDisplay };
} else if (typeof window !== 'undefined') {
    window.AudioPhaseCorrelationDisplay = AudioPhaseCorrelationDisplay;
}