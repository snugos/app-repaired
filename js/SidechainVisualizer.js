/**
 * Sidechain Visualizer - Visualize sidechain signal in real-time
 * Shows the sidechain signal's waveform, envelope, and gain reduction
 */

export class SidechainVisualizer {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Sidechain input
        this.sidechainInput = audioContext.createGain();
        
        // Main signal input (for gain reduction display)
        this.mainInput = audioContext.createGain();
        
        // Output
        this.output = audioContext.createGain();
        
        // Analyzers
        this.sidechainAnalyser = audioContext.createAnalyser();
        this.sidechainAnalyser.fftSize = 2048;
        
        this.mainAnalyser = audioContext.createAnalyser();
        this.mainAnalyser.fftSize = 2048;
        
        // Envelope follower for sidechain
        this.envelopeAttack = options.envelopeAttack ?? 0.01;
        this.envelopeRelease = options.envelopeRelease ?? 0.1;
        this.envelopeValue = 0;
        
        // Visualization settings
        this.mode = options.mode ?? 'waveform'; // 'waveform', 'spectrum', 'meter'
        this.color = options.color ?? '#22c55e';
        this.backgroundColor = options.backgroundColor ?? '#0a0a14';
        this.lineWidth = options.lineWidth ?? 2;
        
        // Meter settings
        this.peakHoldTime = options.peakHoldTime ?? 1000; // ms
        this.peakValues = { left: -Infinity, right: -Infinity };
        this.peakHoldTimers = { left: null, right: null };
        
        // Canvas
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        
        // Callbacks
        this.onEnvelopeUpdate = null;
        this.onPeakUpdate = null;
        
        this.setupRouting();
        this.enabled = true;
    }
    
    setupRouting() {
        // Sidechain input -> analyser
        this.sidechainInput.connect(this.sidechainAnalyser);
        
        // Main input -> analyser -> output
        this.mainInput.connect(this.mainAnalyser);
        this.mainInput.connect(this.output);
    }
    
    attachCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Start animation
        this.startVisualization();
    }
    
    detachCanvas() {
        this.stopVisualization();
        this.canvas = null;
        this.ctx = null;
    }
    
    startVisualization() {
        if (!this.canvas || !this.ctx) return;
        
        const draw = () => {
            if (!this.enabled || !this.canvas) return;
            
            this.animationId = requestAnimationFrame(draw);
            
            switch (this.mode) {
                case 'waveform':
                    this.drawWaveform();
                    break;
                case 'spectrum':
                    this.drawSpectrum();
                    break;
                case 'meter':
                    this.drawMeter();
                    break;
                case 'envelope':
                    this.drawEnvelope();
                    break;
                default:
                    this.drawWaveform();
            }
        };
        
        draw();
    }
    
    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    drawWaveform() {
        const { width, height } = this.canvas;
        const bufferLength = this.sidechainAnalyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        
        this.sidechainAnalyser.getFloatTimeDomainData(dataArray);
        
        // Clear canvas
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw waveform
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.strokeStyle = this.color;
        this.ctx.beginPath();
        
        const sliceWidth = width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i];
            const y = (v + 1) / 2 * height;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        this.ctx.stroke();
        
        // Draw center line
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, height / 2);
        this.ctx.lineTo(width, height / 2);
        this.ctx.stroke();
    }
    
    drawSpectrum() {
        const { width, height } = this.canvas;
        const bufferLength = this.sidechainAnalyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        
        this.sidechainAnalyser.getFloatFrequencyData(dataArray);
        
        // Clear canvas
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw spectrum
        const barWidth = width / bufferLength * 2.5;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            // Convert from dB to linear
            const db = dataArray[i];
            const minDb = -100;
            const maxDb = -10;
            const value = (db - minDb) / (maxDb - minDb);
            
            const barHeight = Math.max(1, value * height);
            
            // Color based on level
            if (value > 0.9) {
                this.ctx.fillStyle = '#ef4444';
            } else if (value > 0.7) {
                this.ctx.fillStyle = '#f59e0b';
            } else {
                this.ctx.fillStyle = this.color;
            }
            
            this.ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
            
            x += barWidth;
        }
    }
    
    drawMeter() {
        const { width, height } = this.canvas;
        const bufferLength = this.sidechainAnalyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        
        this.sidechainAnalyser.getFloatTimeDomainData(dataArray);
        
        // Calculate peak level
        let peak = 0;
        for (let i = 0; i < bufferLength; i++) {
            peak = Math.max(peak, Math.abs(dataArray[i]));
        }
        
        // Clear canvas
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw meter background
        const meterWidth = width * 0.8;
        const meterHeight = 20;
        const meterX = (width - meterWidth) / 2;
        const meterY = height / 2 - meterHeight / 2;
        
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
        
        // Draw level
        const level = peak;
        const levelWidth = level * meterWidth;
        
        // Gradient for level
        const gradient = this.ctx.createLinearGradient(meterX, 0, meterX + meterWidth, 0);
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(0.7, '#f59e0b');
        gradient.addColorStop(0.9, '#ef4444');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(meterX, meterY, levelWidth, meterHeight);
        
        // Draw peak hold
        const peakX = meterX + level * meterWidth;
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(peakX - 2, meterY, 4, meterHeight);
        
        // Draw dB scale
        this.ctx.fillStyle = '#666';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        
        const dbMarks = [-40, -20, -10, -6, -3, 0];
        for (const db of dbMarks) {
            const x = meterX + meterToDbScale(db) * meterWidth;
            this.ctx.fillText(`${db}`, x, meterY + meterHeight + 15);
        }
        
        // Update peak
        const peakDb = 20 * Math.log10(peak + 0.0001);
        if (peakDb > this.peakValues.left) {
            this.peakValues.left = peakDb;
            this.updatePeakHold('left');
        }
        
        if (this.onPeakUpdate) {
            this.onPeakUpdate(peakDb, this.peakValues.left);
        }
    }
    
    drawEnvelope() {
        const { width, height } = this.canvas;
        const bufferLength = this.sidechainAnalyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        
        this.sidechainAnalyser.getFloatTimeDomainData(dataArray);
        
        // Calculate current level
        let currentLevel = 0;
        for (let i = 0; i < bufferLength; i++) {
            currentLevel = Math.max(currentLevel, Math.abs(dataArray[i]));
        }
        
        // Update envelope
        const attackCoef = Math.exp(-1 / (this.envelopeAttack * this.audioContext.sampleRate));
        const releaseCoef = Math.exp(-1 / (this.envelopeRelease * this.audioContext.sampleRate));
        
        if (currentLevel > this.envelopeValue) {
            this.envelopeValue = currentLevel + (this.envelopeValue - currentLevel) * attackCoef;
        } else {
            this.envelopeValue = currentLevel + (this.envelopeValue - currentLevel) * releaseCoef;
        }
        
        if (this.onEnvelopeUpdate) {
            this.onEnvelopeUpdate(this.envelopeValue);
        }
        
        // Clear canvas
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw envelope
        this.ctx.fillStyle = this.color;
        const envelopeHeight = this.envelopeValue * height * 0.8;
        this.ctx.fillRect(10, height - envelopeHeight - 10, width - 20, envelopeHeight);
        
        // Draw input level (instantaneous)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        const instantHeight = currentLevel * height * 0.8;
        this.ctx.fillRect(10, height - instantHeight - 10, width - 20, instantHeight);
        
        // Draw threshold line
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        const thresholdY = height - 0.5 * height * 0.8 - 10;
        this.ctx.moveTo(10, thresholdY);
        this.ctx.lineTo(width - 10, thresholdY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Draw labels
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px system-ui';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Envelope: ${(this.envelopeValue * 100).toFixed(1)}%`, 10, 20);
        this.ctx.fillText(`Input: ${(currentLevel * 100).toFixed(1)}%`, 10, 35);
    }
    
    meterToDbScale(db) {
        // Convert dB to linear scale for meter
        const minDb = -60;
        const maxDb = 0;
        return Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
    }
    
    updatePeakHold(channel) {
        if (this.peakHoldTimers[channel]) {
            clearTimeout(this.peakHoldTimers[channel]);
        }
        
        this.peakHoldTimers[channel] = setTimeout(() => {
            this.peakValues[channel] = -Infinity;
        }, this.peakHoldTime);
    }
    
    setMode(mode) {
        this.mode = mode;
    }
    
    setColor(color) {
        this.color = color;
    }
    
    setBackgroundColor(color) {
        this.backgroundColor = color;
    }
    
    setEnvelopeAttack(seconds) {
        this.envelopeAttack = seconds;
    }
    
    setEnvelopeRelease(seconds) {
        this.envelopeRelease = seconds;
    }
    
    getEnvelopeValue() {
        return this.envelopeValue;
    }
    
    getLevel() {
        const bufferLength = this.sidechainAnalyser.fftSize;
        const dataArray = new Float32Array(bufferLength);
        this.sidechainAnalyser.getFloatTimeDomainData(dataArray);
        
        let peak = 0;
        for (let i = 0; i < bufferLength; i++) {
            peak = Math.max(peak, Math.abs(dataArray[i]));
        }
        
        return peak;
    }
    
    getLevelDB() {
        return 20 * Math.log10(this.getLevel() + 0.0001);
    }
    
    connectSidechain(source) {
        source.connect(this.sidechainInput);
    }
    
    connectMain(source) {
        source.connect(this.mainInput);
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
    
    enable() {
        this.enabled = true;
        if (this.canvas) {
            this.startVisualization();
        }
    }
    
    disable() {
        this.enabled = false;
        this.stopVisualization();
    }
    
    destroy() {
        this.stopVisualization();
        this.sidechainInput.disconnect();
        this.mainInput.disconnect();
        this.output.disconnect();
        this.sidechainAnalyser.disconnect();
        this.mainAnalyser.disconnect();
    }
}

// Factory function
export function createSidechainVisualizer(audioContext, options = {}) {
    return new SidechainVisualizer(audioContext, options);
}

// UI Panel
export function createSidechainVisualizerPanel(visualizer, appServices) {
    const container = document.createElement('div');
    container.className = 'sidechain-visualizer-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 400px;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Sidechain Visualizer';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Canvas container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = `
        background: #0a0a14;
        border-radius: 4px;
        margin-bottom: 16px;
        position: relative;
    `;
    
    const canvas = document.createElement('canvas');
    canvas.width = 380;
    canvas.height = 150;
    canvas.style.cssText = 'display: block; width: 100%;';
    canvasContainer.appendChild(canvas);
    container.appendChild(canvasContainer);
    
    // Attach canvas to visualizer
    visualizer.attachCanvas(canvas);
    
    // Mode selection
    const modeContainer = document.createElement('div');
    modeContainer.style.cssText = 'margin-bottom: 16px;';
    modeContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Display Mode</div>
        <div style="display: flex; gap: 8px;">
            <button class="mode-btn" data-mode="waveform" style="flex: 1; padding: 8px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Waveform
            </button>
            <button class="mode-btn" data-mode="spectrum" style="flex: 1; padding: 8px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Spectrum
            </button>
            <button class="mode-btn" data-mode="meter" style="flex: 1; padding: 8px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Meter
            </button>
            <button class="mode-btn" data-mode="envelope" style="flex: 1; padding: 8px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Envelope
            </button>
        </div>
    `;
    container.appendChild(modeContainer);
    
    // Envelope controls
    const envelopeContainer = document.createElement('div');
    envelopeContainer.id = 'envelopeControls';
    envelopeContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    envelopeContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Envelope Settings</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
                <label style="font-size: 12px; color: #9ca3af;">Attack (ms)</label>
                <input type="range" id="envelopeAttack" min="1" max="100" value="${visualizer.envelopeAttack * 1000}" style="width: 100%;">
                <span id="attackValue">${(visualizer.envelopeAttack * 1000).toFixed(0)} ms</span>
            </div>
            <div>
                <label style="font-size: 12px; color: #9ca3af;">Release (ms)</label>
                <input type="range" id="envelopeRelease" min="10" max="1000" value="${visualizer.envelopeRelease * 1000}" style="width: 100%;">
                <span id="releaseValue">${(visualizer.envelopeRelease * 1000).toFixed(0)} ms</span>
            </div>
        </div>
    `;
    container.appendChild(envelopeContainer);
    
    // Stats
    const statsContainer = document.createElement('div');
    statsContainer.id = 'stats';
    statsContainer.style.cssText = 'padding: 12px; background: #0a0a14; border-radius: 4px;';
    statsContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between;">
            <span>Level</span>
            <span id="levelValue">-∞ dB</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
            <span>Envelope</span>
            <span id="envelopeValue">0%</span>
        </div>
    `;
    container.appendChild(statsContainer);
    
    // Mode button handlers
    modeContainer.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            visualizer.setMode(btn.dataset.mode);
            
            modeContainer.querySelectorAll('.mode-btn').forEach(b => {
                b.style.background = b.dataset.mode === visualizer.mode ? '#3b82f6' : '#374151';
            });
        });
    });
    
    // Envelope controls
    document.getElementById('envelopeAttack').addEventListener('input', (e) => {
        const ms = parseFloat(e.target.value);
        visualizer.setEnvelopeAttack(ms / 1000);
        document.getElementById('attackValue').textContent = `${ms.toFixed(0)} ms`;
    });
    
    document.getElementById('envelopeRelease').addEventListener('input', (e) => {
        const ms = parseFloat(e.target.value);
        visualizer.setEnvelopeRelease(ms / 1000);
        document.getElementById('releaseValue').textContent = `${ms.toFixed(0)} ms`;
    });
    
    // Update stats
    const statsInterval = setInterval(() => {
        document.getElementById('levelValue').textContent = `${visualizer.getLevelDB().toFixed(1)} dB`;
        document.getElementById('envelopeValue').textContent = `${(visualizer.getEnvelopeValue() * 100).toFixed(1)}%`;
    }, 100);
    
    // Cleanup
    container.destroy = () => {
        clearInterval(statsInterval);
        visualizer.detachCanvas();
    };
    
    return container;
}

export default SidechainVisualizer;