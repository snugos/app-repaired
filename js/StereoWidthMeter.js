// js/StereoWidthMeter.js - Stereo Width Meter for SnugOS DAW
// Visual meter showing stereo width correlation

import * as Tone from 'tone';

export class StereoWidthMeter {
    constructor(options = {}) {
        this.analyserL = null;
        this.analyserR = null;
        this.analyserMid = null;
        this.analyserSide = null;
        
        this.fftSize = options.fftSize ?? 2048;
        this.smoothing = options.smoothing ?? 0.8;
        
        this.inputL = null;
        this.inputR = null;
        
        this.widthValue = 0; // 0 = mono, 1 = normal, 2 = wide
        this.correlationValue = 0; // -1 to 1 (1 = in phase, -1 = out of phase)
        this.panLaw = options.panLaw ?? '-3dB'; // '-3dB', '-4.5dB', '0dB'
        
        this.isRunning = false;
        this.animationFrame = null;
        this.onUpdate = null;
    }

    async initialize(audioContext) {
        // Create analysers for L and R channels
        this.analyserL = audioContext.createAnalyser();
        this.analyserR = audioContext.createAnalyser();
        this.analyserL.fftSize = this.fftSize;
        this.analyserR.fftSize = this.fftSize;
        this.analyserL.smoothingTimeConstant = this.smoothing;
        this.analyserR.smoothingTimeConstant = this.smoothing;
        
        // Create merger to get mid/side
        this.merger = audioContext.createChannelMerger(2);
        this.splitter = audioContext.createChannelSplitter(2);
        
        // Create mid/side analysers
        this.analyserMid = audioContext.createAnalyser();
        this.analyserSide = audioContext.createAnalyser();
        this.analyserMid.fftSize = this.fftSize;
        this.analyserSide.fftSize = this.fftSize;
        this.analyserMid.smoothingTimeConstant = this.smoothing;
        this.analyserSide.smoothingTimeConstant = this.smoothing;
        
        // Input nodes
        this.inputL = new Tone.Gain(1);
        this.inputR = new Tone.Gain(1);
        
        return this;
    }

    connect(leftSource, rightSource) {
        if (!this.analyserL || !this.analyserR) {
            console.warn('[StereoWidthMeter] Not initialized');
            return;
        }
        
        // Connect left to left analyser
        if (leftSource) {
            if (leftSource.connect) {
                leftSource.connect(this.analyserL);
            }
        }
        
        // Connect right to right analyser
        if (rightSource) {
            if (rightSource.connect) {
                rightSource.connect(this.analyserR);
            }
        }
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.updateLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    updateLoop() {
        if (!this.isRunning) return;
        
        this.calculateWidth();
        
        if (this.onUpdate) {
            this.onUpdate(this.widthValue, this.correlationValue);
        }
        
        this.animationFrame = requestAnimationFrame(() => this.updateLoop());
    }

    calculateWidth() {
        if (!this.analyserL || !this.analyserR) return;
        
        const bufferLength = this.analyserL.frequencyBinCount;
        const dataL = new Float32Array(bufferLength);
        const dataR = new Float32Array(bufferLength);
        
        this.analyserL.getFloatTimeDomainData(dataL);
        this.analyserR.getFloatTimeDomainData(dataR);
        
        // Calculate correlation coefficient
        let sumL = 0, sumR = 0, sumLR = 0;
        let sumL2 = 0, sumR2 = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const l = dataL[i];
            const r = dataR[i];
            
            sumL += l;
            sumR += r;
            sumLR += l * r;
            sumL2 += l * l;
            sumR2 += r * r;
        }
        
        const meanL = sumL / bufferLength;
        const meanR = sumR / bufferLength;
        
        // Pearson correlation coefficient
        const covariance = (sumLR / bufferLength) - (meanL * meanR);
        const varianceL = (sumL2 / bufferLength) - (meanL * meanL);
        const varianceR = (sumR2 / bufferLength) - (meanR * meanR);
        
        const stdDevL = Math.sqrt(Math.max(0, varianceL));
        const stdDevR = Math.sqrt(Math.max(0, varianceR));
        
        if (stdDevL > 0 && stdDevR > 0) {
            this.correlationValue = covariance / (stdDevL * stdDevR);
        } else {
            this.correlationValue = 0;
        }
        
        // Clamp correlation to [-1, 1]
        this.correlationValue = Math.max(-1, Math.min(1, this.correlationValue));
        
        // Calculate stereo width
        // Width is based on the difference between L and R
        // Mid = (L + R) / 2
        // Side = (L - R) / 2
        // Width = Side / Mid (when Mid > threshold)
        
        let midEnergy = 0;
        let sideEnergy = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const mid = (dataL[i] + dataR[i]) / 2;
            const side = (dataL[i] - dataR[i]) / 2;
            midEnergy += mid * mid;
            sideEnergy += side * side;
        }
        
        midEnergy = Math.sqrt(midEnergy / bufferLength);
        sideEnergy = Math.sqrt(sideEnergy / bufferLength);
        
        // Width calculation: ratio of side to mid
        // 0 = mono (no side), 1 = normal stereo, >1 = wide stereo
        if (midEnergy > 0.0001) {
            this.widthValue = sideEnergy / midEnergy;
        } else {
            this.widthValue = sideEnergy > 0.0001 ? 2 : 0;
        }
        
        // Clamp width
        this.widthValue = Math.max(0, Math.min(2, this.widthValue));
    }

    getWidth() {
        return this.widthValue;
    }

    getCorrelation() {
        return this.correlationValue;
    }

    getPhaseStatus() {
        if (this.correlationValue < 0) {
            return 'out-of-phase';
        } else if (this.correlationValue < 0.3) {
            return 'warning';
        } else if (this.correlationValue < 0.7) {
            return 'acceptable';
        } else {
            return 'good';
        }
    }

    getPhaseStatusText() {
        const status = this.getPhaseStatus();
        switch (status) {
            case 'out-of-phase':
                return 'Out of Phase';
            case 'warning':
                return 'Phase Warning';
            case 'acceptable':
                return 'Acceptable';
            case 'good':
                return 'Good';
            default:
                return 'Unknown';
        }
    }

    getPhaseStatusColor() {
        const status = this.getPhaseStatus();
        switch (status) {
            case 'out-of-phase':
                return '#ef4444'; // red
            case 'warning':
                return '#f59e0b'; // amber
            case 'acceptable':
                return '#84cc16'; // lime
            case 'good':
                return '#22c55e'; // green
            default:
                return '#a1a1aa'; // gray
        }
    }

    setSmoothing(smoothing) {
        this.smoothing = Math.max(0, Math.min(1, smoothing));
        if (this.analyserL) this.analyserL.smoothingTimeConstant = this.smoothing;
        if (this.analyserR) this.analyserR.smoothingTimeConstant = this.smoothing;
        if (this.analyserMid) this.analyserMid.smoothingTimeConstant = this.smoothing;
        if (this.analyserSide) this.analyserSide.smoothingTimeConstant = this.smoothing;
        return this.smoothing;
    }

    setOnUpdate(callback) {
        this.onUpdate = callback;
    }

    // Get vector display for Lissajous-style visualization
    getVectorDisplay(numPoints = 100) {
        if (!this.analyserL || !this.analyserR) return [];
        
        const bufferLength = this.analyserL.frequencyBinCount;
        const dataL = new Float32Array(bufferLength);
        const dataR = new Float32Array(bufferLength);
        
        this.analyserL.getFloatTimeDomainData(dataL);
        this.analyserR.getFloatTimeDomainData(dataR);
        
        const points = [];
        const step = Math.floor(bufferLength / numPoints);
        
        for (let i = 0; i < bufferLength; i += step) {
            points.push({
                x: dataL[i], // Left = X
                y: dataR[i]  // Right = Y
            });
        }
        
        return points;
    }

    dispose() {
        this.stop();
        
        if (this.analyserL) {
            this.analyserL.disconnect();
            this.analyserL = null;
        }
        
        if (this.analyserR) {
            this.analyserR.disconnect();
            this.analyserR = null;
        }
        
        if (this.analyserMid) {
            this.analyserMid.disconnect();
            this.analyserMid = null;
        }
        
        if (this.analyserSide) {
            this.analyserSide.disconnect();
            this.analyserSide = null;
        }
        
        if (this.merger) {
            this.merger.disconnect();
            this.merger = null;
        }
        
        if (this.splitter) {
            this.splitter.disconnect();
            this.splitter = null;
        }
        
        if (this.inputL) {
            this.inputL.dispose();
            this.inputL = null;
        }
        
        if (this.inputR) {
            this.inputR.dispose();
            this.inputR = null;
        }
        
        this.onUpdate = null;
    }
}

// Singleton instance
let stereoWidthMeterInstance = null;

export function getStereoWidthMeter(options = {}) {
    if (!stereoWidthMeterInstance) {
        stereoWidthMeterInstance = new StereoWidthMeter(options);
    }
    return stereoWidthMeterInstance;
}

export function openStereoWidthMeterPanel() {
    const meter = getStereoWidthMeter();
    
    const panel = document.createElement('div');
    panel.id = 'stereo-width-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-lg p-6 w-full max-w-lg">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Stereo Width Meter</h2>
                <button id="close-width-panel" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="mb-6">
                <label class="text-zinc-300 text-sm">Stereo Width</label>
                <div class="bg-zinc-800 rounded h-8 mt-2 relative overflow-hidden">
                    <div id="width-bar" class="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-100" style="width: 50%"></div>
                    <span id="width-value" class="absolute inset-0 flex items-center justify-center text-white font-bold">1.00</span>
                </div>
                <div class="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>Mono</span>
                    <span>Normal</span>
                    <span>Wide</span>
                </div>
            </div>
            
            <div class="mb-6">
                <label class="text-zinc-300 text-sm">Phase Correlation</label>
                <div class="bg-zinc-800 rounded h-8 mt-2 relative overflow-hidden">
                    <div id="correlation-bar" class="absolute inset-y-0 bg-green-500 transition-all duration-100" style="left: 50%; width: 0%"></div>
                    <span id="correlation-value" class="absolute inset-0 flex items-center justify-center text-white font-bold">0.00</span>
                </div>
                <div class="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>Out of Phase</span>
                    <span>In Phase</span>
                </div>
            </div>
            
            <div class="mb-6">
                <label class="text-zinc-300 text-sm">Phase Status</label>
                <div class="flex items-center gap-3 mt-2">
                    <div id="phase-indicator" class="w-4 h-4 rounded-full bg-green-500"></div>
                    <span id="phase-status" class="text-white font-medium">Good</span>
                </div>
            </div>
            
            <div class="mb-4">
                <label class="text-zinc-300 text-sm">Vector Display</label>
                <div class="bg-zinc-800 rounded h-48 mt-2 relative overflow-hidden">
                    <canvas id="vector-canvas" width="400" height="180" class="w-full h-full"></canvas>
                </div>
            </div>
            
            <div class="mb-4">
                <label class="text-zinc-300 text-sm">Smoothing</label>
                <input type="range" id="meter-smoothing" value="${meter.smoothing}" min="0" max="0.99" step="0.01"
                    class="w-full mt-1">
                <span id="smoothing-value" class="text-zinc-400 text-sm">${meter.smoothing.toFixed(2)}</span>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    const canvas = document.getElementById('vector-canvas');
    const ctx = canvas.getContext('2d');
    
    // Event listeners
    document.getElementById('close-width-panel').onclick = () => {
        meter.stop();
        panel.remove();
    };
    
    document.getElementById('meter-smoothing').oninput = (e) => {
        const value = parseFloat(e.target.value);
        meter.setSmoothing(value);
        document.getElementById('smoothing-value').textContent = value.toFixed(2);
    };
    
    // Update loop
    function updateDisplay() {
        if (!document.getElementById('width-bar')) return;
        
        const width = meter.getWidth();
        const correlation = meter.getCorrelation();
        const phaseStatus = meter.getPhaseStatusText();
        const phaseColor = meter.getPhaseStatusColor();
        
        // Update width bar (0-2 maps to 0-100%)
        const widthPercent = Math.min(100, (width / 2) * 100);
        document.getElementById('width-bar').style.width = `${widthPercent}%`;
        document.getElementById('width-value').textContent = width.toFixed(2);
        
        // Update correlation bar (-1 to 1 maps to 0-100%)
        const corrPercent = Math.abs(correlation) * 50;
        if (correlation >= 0) {
            document.getElementById('correlation-bar').style.left = '50%';
            document.getElementById('correlation-bar').style.width = `${corrPercent}%`;
        } else {
            document.getElementById('correlation-bar').style.left = `${50 - corrPercent}%`;
            document.getElementById('correlation-bar').style.width = `${corrPercent}%`;
        }
        document.getElementById('correlation-value').textContent = correlation.toFixed(2);
        
        // Update phase indicator
        document.getElementById('phase-indicator').style.backgroundColor = phaseColor;
        document.getElementById('phase-status').textContent = phaseStatus;
        
        // Update correlation bar color
        if (correlation < 0) {
            document.getElementById('correlation-bar').className = 'absolute inset-y-0 bg-red-500 transition-all duration-100';
        } else if (correlation < 0.3) {
            document.getElementById('correlation-bar').className = 'absolute inset-y-0 bg-yellow-500 transition-all duration-100';
        } else {
            document.getElementById('correlation-bar').className = 'absolute inset-y-0 bg-green-500 transition-all duration-100';
        }
        
        // Draw vector display
        drawVectorDisplay();
    }
    
    function drawVectorDisplay() {
        const points = meter.getVectorDisplay(200);
        
        // Clear canvas
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1;
        
        // Center lines
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        // Draw diagonal guides
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        ctx.lineTo(canvas.width, 0);
        ctx.moveTo(0, 0);
        ctx.lineTo(canvas.width, canvas.height);
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
        
        points.forEach(point => {
            const x = ((point.x + 1) / 2) * canvas.width;
            const y = ((1 - point.y) / 2) * canvas.height;
            
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw center point
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    meter.setOnUpdate(updateDisplay);
    meter.start();
    
    return panel;
}