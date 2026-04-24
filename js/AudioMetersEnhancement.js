/**
 * AudioMetersEnhancement.js
 * Peak/RMS/EBU R128 metering modes
 * Professional audio metering with multiple standards
 */

export class AudioMetersEnhancement {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.enabled = options.enabled ?? true;
        
        // Metering mode: 'peak', 'rms', 'ebu'
        this.mode = options.mode ?? 'peak';
        
        // Peak meter settings
        this.peakSettings = {
            holdTime: options.peakHoldTime ?? 1.5,      // seconds to hold peak
            fallTime: options.peakFallTime ?? 0.5,      // seconds to fall back
            fallDbPerSecond: options.fallDbPerSecond ?? 20
        };
        
        // RMS settings
        this.rmsSettings = {
            windowSize: options.rmsWindowSize ?? 0.3,   // seconds
            smoothing: options.rmsSmoothing ?? 0.95
        };
        
        // EBU R128 settings
        this.ebuSettings = {
            targetLevel: options.ebuTargetLevel ?? -23, // LUFS
            tolerance: options.ebuTolerance ?? 1,       // ±1 LU
            maxShortTerm: options.ebuMaxShortTerm ?? -18,
            maxMomentary: options.ebuMaxMomentary ?? -15
        };
        
        // Integration times for EBU
        this.ebuIntegrationTimes = {
            momentary: 0.4,   // 400ms
            shortTerm: 3.0,   // 3 seconds
            integrated: Infinity // Full duration
        };
        
        // Audio nodes
        this.analyserNode = null;
        this.inputNode = null;
        
        // Meter values
        this.meterValues = {
            peak: { left: -Infinity, right: -Infinity },
            peakHold: { left: -Infinity, right: -Infinity },
            rms: { left: -Infinity, right: -Infinity },
            ebu: {
                momentary: -Infinity,
                shortTerm: -Infinity,
                integrated: -Infinity,
                loudnessRange: 0
            }
        };
        
        // History for EBU calculations
        this.ebuHistory = [];
        this.ebuIntegrated = null;
        this.ebuStartTime = null;
        
        // Peak hold timers
        this.peakHoldTimers = { left: null, right: null };
        this.peakHoldValues = { left: -Infinity, right: -Infinity };
        
        // Callback for meter updates
        this.onMeterUpdate = options.onMeterUpdate ?? null;
        
        // Update interval
        this.updateInterval = options.updateInterval ?? 50; // ms
        this.updateTimer = null;
        
        // Visual element
        this.canvasElement = null;
        this.canvasContext = null;
        this.meterContainer = null;
        
        this._initialized = false;
    }
    
    async init() {
        if (this._initialized) return;
        
        // Create analyser node
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.analyserNode.smoothingTimeConstant = this.rmsSettings.smoothing;
        
        this.inputNode = this.analyserNode;
        
        // Initialize EBU integrated metering
        this.ebuStartTime = this.audioContext.currentTime;
        
        this._initialized = true;
        
        // Start update loop
        this._startUpdateLoop();
    }
    
    _startUpdateLoop() {
        if (this.updateTimer) return;
        
        this.updateTimer = setInterval(() => {
            this._updateMeters();
        }, this.updateInterval);
    }
    
    _stopUpdateLoop() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }
    
    _updateMeters() {
        if (!this._initialized || !this.analyserNode) return;
        
        const bufferLength = this.analyserNode.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyserNode.getFloatTimeDomainData(dataArray);
        
        // Calculate values
        this._calculatePeak(dataArray);
        this._calculateRMS(dataArray);
        this._calculateEBU(dataArray);
        
        // Notify callback
        if (this.onMeterUpdate) {
            this.onMeterUpdate(this.getMeterValues());
        }
        
        // Update visual if attached
        this._updateVisual();
    }
    
    _calculatePeak(dataArray) {
        let maxL = 0, maxR = 0;
        const halfLen = Math.floor(dataArray.length / 2);
        
        // Assuming interleaved stereo for analysis
        for (let i = 0; i < dataArray.length; i++) {
            const absValue = Math.abs(dataArray[i]);
            if (i < halfLen) {
                maxL = Math.max(maxL, absValue);
            } else {
                maxR = Math.max(maxR, absValue);
            }
        }
        
        // For mono, duplicate
        if (maxR === 0 && maxL > 0) {
            maxR = maxL;
        }
        
        const leftDb = maxL > 0 ? 20 * Math.log10(maxL) : -Infinity;
        const rightDb = maxR > 0 ? 20 * Math.log10(maxR) : -Infinity;
        
        this.meterValues.peak.left = leftDb;
        this.meterValues.peak.right = rightDb;
        
        // Update peak hold
        this._updatePeakHold('left', leftDb);
        this._updatePeakHold('right', rightDb);
    }
    
    _updatePeakHold(channel, value) {
        if (value > this.peakHoldValues[channel]) {
            this.peakHoldValues[channel] = value;
            this.meterValues.peakHold[channel] = value;
            
            // Reset hold timer
            if (this.peakHoldTimers[channel]) {
                clearTimeout(this.peakHoldTimers[channel]);
            }
            
            this.peakHoldTimers[channel] = setTimeout(() => {
                this._startPeakFall(channel);
            }, this.peakSettings.holdTime * 1000);
        }
    }
    
    _startPeakFall(channel) {
        const fallRate = this.peakSettings.fallDbPerSecond / (1000 / this.updateInterval);
        
        const fall = () => {
            if (this.peakHoldValues[channel] > -Infinity) {
                this.peakHoldValues[channel] -= fallRate;
                this.meterValues.peakHold[channel] = this.peakHoldValues[channel];
                
                if (this.peakHoldValues[channel] > -60) {
                    requestAnimationFrame(fall);
                } else {
                    this.peakHoldValues[channel] = -Infinity;
                    this.meterValues.peakHold[channel] = -Infinity;
                }
            }
        };
        
        fall();
    }
    
    _calculateRMS(dataArray) {
        const windowSamples = Math.floor(this.rmsSettings.windowSize * this.audioContext.sampleRate);
        const samples = Math.min(windowSamples, dataArray.length);
        
        let sumSquares = 0;
        for (let i = 0; i < samples; i++) {
            sumSquares += dataArray[i] * dataArray[i];
        }
        
        const rms = Math.sqrt(sumSquares / samples);
        const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
        
        this.meterValues.rms.left = rmsDb;
        this.meterValues.rms.right = rmsDb; // Simplified for mono analysis
    }
    
    _calculateEBU(dataArray) {
        // EBU R128 loudness measurement
        // K-weighting: high-pass + high-shelf filter
        
        const sampleRate = this.audioContext.sampleRate;
        
        // Calculate momentary loudness (400ms window)
        const momentarySamples = Math.floor(0.4 * sampleRate);
        const momentaryLoudness = this._calculateLoudness(dataArray.slice(-momentarySamples), sampleRate);
        this.meterValues.ebu.momentary = momentaryLoudness;
        
        // Calculate short-term loudness (3s window)
        const shortTermSamples = Math.floor(3.0 * sampleRate);
        const shortTermLoudness = this._calculateLoudness(dataArray.slice(-shortTermSamples), sampleRate);
        this.meterValues.ebu.shortTerm = shortTermLoudness;
        
        // Store for integrated calculation
        if (this.ebuHistory.length < 10000) {
            this.ebuHistory.push(momentaryLoudness);
        }
        
        // Calculate integrated loudness
        this.meterValues.ebu.integrated = this._calculateIntegratedLoudness();
        
        // Calculate loudness range (LRA)
        this.meterValues.ebu.loudnessRange = this._calculateLoudnessRange();
    }
    
    _calculateLoudness(samples, sampleRate) {
        if (samples.length === 0) return -Infinity;
        
        // Apply K-weighting (simplified)
        // In practice, this would use proper filter coefficients
        
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i++) {
            // Simple high-pass approximation (remove DC)
            const weighted = samples[i];
            sumSquares += weighted * weighted;
        }
        
        const meanSquare = sumSquares / samples.length;
        
        if (meanSquare <= 0) return -Infinity;
        
        // EBU R128 absolute threshold: -70 LUFS
        if (meanSquare < Math.pow(10, -70 / 10)) {
            return -Infinity;
        }
        
        // Convert to loudness (LKFS/LUFS)
        const loudness = -0.691 + 10 * Math.log10(meanSquare);
        
        return loudness;
    }
    
    _calculateIntegratedLoudness() {
        if (this.ebuHistory.length === 0) return -Infinity;
        
        // Gating: only include blocks above -70 LUFS
        const gatedBlocks = this.ebuHistory.filter(l => l > -70);
        
        if (gatedBlocks.length === 0) return -Infinity;
        
        // Calculate mean
        const sum = gatedBlocks.reduce((a, b) => a + b, 0);
        const mean = sum / gatedBlocks.length;
        
        // Apply relative threshold (-10 LU below mean)
        const relativeThreshold = mean - 10;
        const relativeGated = gatedBlocks.filter(l => l > relativeThreshold);
        
        if (relativeGated.length === 0) return mean;
        
        return relativeGated.reduce((a, b) => a + b, 0) / relativeGated.length;
    }
    
    _calculateLoudnessRange() {
        if (this.ebuHistory.length < 2) return 0;
        
        const gatedBlocks = this.ebuHistory.filter(l => l > -70);
        if (gatedBlocks.length < 2) return 0;
        
        // Calculate LRA as difference between 95th and 10th percentile
        const sorted = [...gatedBlocks].sort((a, b) => a - b);
        const p10 = sorted[Math.floor(sorted.length * 0.1)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        
        return p95 - p10;
    }
    
    /**
     * Get current meter values
     */
    getMeterValues() {
        return {
            mode: this.mode,
            peak: { ...this.meterValues.peak },
            peakHold: { ...this.meterValues.peakHold },
            rms: { ...this.meterValues.rms },
            ebu: { ...this.meterValues.ebu }
        };
    }
    
    /**
     * Set metering mode
     */
    setMode(mode) {
        this.mode = mode;
    }
    
    /**
     * Get level for current mode
     */
    getCurrentLevel() {
        switch (this.mode) {
            case 'peak':
                return Math.max(this.meterValues.peak.left, this.meterValues.peak.right);
            case 'rms':
                return Math.max(this.meterValues.rms.left, this.meterValues.rms.right);
            case 'ebu':
                return this.meterValues.ebu.shortTerm;
            default:
                return -Infinity;
        }
    }
    
    /**
     * Check if level is clipping
     */
    isClipping() {
        return this.getCurrentLevel() >= -0.1;
    }
    
    /**
     * Check if EBU R128 is compliant
     */
    isEBUCompliant() {
        const integrated = this.meterValues.ebu.integrated;
        const { targetLevel, tolerance } = this.ebuSettings;
        return integrated >= targetLevel - tolerance && integrated <= targetLevel + tolerance;
    }
    
    /**
     * Get EBU compliance status
     */
    getEBUStatus() {
        const integrated = this.meterValues.ebu.integrated;
        const { targetLevel, tolerance } = this.ebuSettings;
        
        if (integrated < -70) {
            return { status: 'silent', message: 'No signal detected' };
        }
        
        if (integrated < targetLevel - tolerance) {
            return { status: 'too-quiet', message: `Too quiet (${integrated.toFixed(1)} LUFS)` };
        }
        
        if (integrated > targetLevel + tolerance) {
            return { status: 'too-loud', message: `Too loud (${integrated.toFixed(1)} LUFS)` };
        }
        
        return { status: 'compliant', message: `EBU R128 compliant (${integrated.toFixed(1)} LUFS)` };
    }
    
    /**
     * Create visual meter UI
     */
    createMeterUI(containerId) {
        const container = document.getElementById(containerId) || document.body;
        
        this.meterContainer = document.createElement('div');
        this.meterContainer.className = 'audio-meters-container';
        this.meterContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 12px;
            background: #1a1a2e;
            border-radius: 8px;
            min-width: 120px;
        `;
        
        // Mode selector
        const modeSelector = document.createElement('div');
        modeSelector.style.cssText = `
            display: flex;
            gap: 4px;
            margin-bottom: 8px;
        `;
        
        ['peak', 'rms', 'ebu'].forEach(mode => {
            const btn = document.createElement('button');
            btn.textContent = mode.toUpperCase();
            btn.style.cssText = `
                flex: 1;
                padding: 6px 8px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
                transition: all 0.2s;
                ${this.mode === mode ? 'background: #4f46e5; color: white;' : 'background: #2a2a4e; color: #888;'}
            `;
            btn.onclick = () => {
                this.setMode(mode);
                modeSelector.querySelectorAll('button').forEach(b => {
                    b.style.background = b.textContent.toLowerCase() === mode ? '#4f46e5' : '#2a2a4e';
                    b.style.color = b.textContent.toLowerCase() === mode ? 'white' : '#888';
                });
            };
            modeSelector.appendChild(btn);
        });
        
        this.meterContainer.appendChild(modeSelector);
        
        // Meter canvas
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.width = 100;
        this.canvasElement.height = 200;
        this.canvasElement.style.cssText = `
            width: 100%;
            border-radius: 4px;
            background: #0a0a14;
        `;
        this.canvasContext = this.canvasElement.getContext('2d');
        
        this.meterContainer.appendChild(this.canvasElement);
        
        // EBU status (if EBU mode)
        const ebuStatus = document.createElement('div');
        ebuStatus.id = 'ebu-status';
        ebuStatus.style.cssText = `
            font-size: 11px;
            color: #888;
            margin-top: 4px;
            text-align: center;
        `;
        this.meterContainer.appendChild(ebuStatus);
        
        // Peak readout
        const readout = document.createElement('div');
        readout.id = 'peak-readout';
        readout.style.cssText = `
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            text-align: center;
            margin-top: 4px;
            font-family: 'Courier New', monospace;
        `;
        this.meterContainer.appendChild(readout);
        
        container.appendChild(this.meterContainer);
        
        return this.meterContainer;
    }
    
    _updateVisual() {
        if (!this.canvasContext || !this.canvasElement) return;
        
        const ctx = this.canvasContext;
        const width = this.canvasElement.width;
        const height = this.canvasElement.height;
        
        // Clear
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);
        
        const level = this.getCurrentLevel();
        const normalizedLevel = Math.max(0, Math.min(1, (level + 60) / 60));
        
        // Draw meter
        const meterHeight = height * normalizedLevel;
        const meterY = height - meterHeight;
        
        // Color gradient based on level
        let color;
        if (level > -6) {
            color = '#ef4444'; // Red
        } else if (level > -12) {
            color = '#f59e0b'; // Orange
        } else if (level > -24) {
            color = '#10b981'; // Green
        } else {
            color = '#3b82f6'; // Blue
        }
        
        // Draw meter bar
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(0.5, '#f59e0b');
        gradient.addColorStop(0.9, '#ef4444');
        gradient.addColorStop(1, '#ef4444');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(10, meterY, width - 20, meterHeight);
        
        // Draw scale marks
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        
        const dbMarks = [0, -6, -12, -18, -24, -36, -48, -60];
        dbMarks.forEach(db => {
            const y = height - ((db + 60) / 60) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(5, y);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = '#666';
            ctx.font = '8px sans-serif';
            ctx.fillText(db.toString(), 2, y - 2);
        });
        
        // Draw peak hold line
        const peakHoldLevel = Math.max(this.meterValues.peakHold.left, this.meterValues.peakHold.right);
        if (peakHoldLevel > -60) {
            const peakY = height - ((peakHoldLevel + 60) / 60) * height;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, peakY);
            ctx.lineTo(width - 10, peakY);
            ctx.stroke();
        }
        
        // Update readout
        const readout = document.getElementById('peak-readout');
        if (readout) {
            readout.textContent = `${level > -Infinity ? level.toFixed(1) : '-∞'} dB`;
            readout.style.color = color;
        }
        
        // Update EBU status
        const ebuStatus = document.getElementById('ebu-status');
        if (ebuStatus && this.mode === 'ebu') {
            const status = this.getEBUStatus();
            ebuStatus.textContent = status.message;
            ebuStatus.style.color = status.status === 'compliant' ? '#10b981' : 
                                    status.status === 'too-loud' ? '#ef4444' : '#f59e0b';
        }
    }
    
    /**
     * Connect audio source to meter
     */
    connect(source) {
        if (!this._initialized) {
            console.warn('AudioMetersEnhancement not initialized. Call init() first.');
            return;
        }
        source.connect(this.inputNode);
    }
    
    /**
     * Connect meter to destination (pass-through)
     */
    connectTo(destination) {
        if (this.analyserNode) {
            this.analyserNode.connect(destination);
        }
    }
    
    /**
     * Reset meter history
     */
    reset() {
        this.meterValues = {
            peak: { left: -Infinity, right: -Infinity },
            peakHold: { left: -Infinity, right: -Infinity },
            rms: { left: -Infinity, right: -Infinity },
            ebu: {
                momentary: -Infinity,
                shortTerm: -Infinity,
                integrated: -Infinity,
                loudnessRange: 0
            }
        };
        this.ebuHistory = [];
        this.ebuStartTime = this.audioContext.currentTime;
        this.peakHoldValues = { left: -Infinity, right: -Infinity };
    }
    
    /**
     * Enable/disable metering
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this._startUpdateLoop();
        } else {
            this._stopUpdateLoop();
        }
    }
    
    /**
     * Serialize settings
     */
    serialize() {
        return {
            enabled: this.enabled,
            mode: this.mode,
            peakSettings: { ...this.peakSettings },
            rmsSettings: { ...this.rmsSettings },
            ebuSettings: { ...this.ebuSettings }
        };
    }
    
    /**
     * Restore settings
     */
    restore(data) {
        this.enabled = data.enabled ?? true;
        this.mode = data.mode ?? 'peak';
        this.peakSettings = { ...this.peakSettings, ...data.peakSettings };
        this.rmsSettings = { ...this.rmsSettings, ...data.rmsSettings };
        this.ebuSettings = { ...this.ebuSettings, ...data.ebuSettings };
    }
    
    destroy() {
        this._stopUpdateLoop();
        
        // Clear timers
        Object.keys(this.peakHoldTimers).forEach(key => {
            if (this.peakHoldTimers[key]) {
                clearTimeout(this.peakHoldTimers[key]);
            }
        });
        
        if (this.analyserNode) {
            this.analyserNode.disconnect();
            this.analyserNode = null;
        }
        
        if (this.meterContainer && this.meterContainer.parentNode) {
            this.meterContainer.parentNode.removeChild(this.meterContainer);
        }
        
        this._initialized = false;
    }
}

/**
 * Multi-channel meter bank
 */
export class MeterBank {
    constructor(audioContext, numChannels = 8) {
        this.audioContext = audioContext;
        this.numChannels = numChannels;
        this.meters = [];
        this.masterMeter = null;
        
        this.container = null;
    }
    
    async init() {
        // Create individual channel meters
        for (let i = 0; i < this.numChannels; i++) {
            const meter = new AudioMetersEnhancement(this.audioContext);
            await meter.init();
            this.meters.push(meter);
        }
        
        // Create master meter
        this.masterMeter = new AudioMetersEnhancement(this.audioContext, { mode: 'ebu' });
        await this.masterMeter.init();
    }
    
    /**
     * Get meter for specific channel
     */
    getMeter(channel) {
        return this.meters[channel] || null;
    }
    
    /**
     * Connect channel to its meter
     */
    connectChannel(channel, source) {
        const meter = this.meters[channel];
        if (meter) {
            meter.connect(source);
        }
    }
    
    /**
     * Create UI for meter bank
     */
    createUI(containerId) {
        const container = document.getElementById(containerId) || document.body;
        
        this.container = document.createElement('div');
        this.container.className = 'meter-bank';
        this.container.style.cssText = `
            display: flex;
            gap: 8px;
            padding: 12px;
            background: #1a1a2e;
            border-radius: 8px;
            overflow-x: auto;
        `;
        
        // Add individual meters
        this.meters.forEach((meter, index) => {
            const channelContainer = document.createElement('div');
            channelContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                min-width: 60px;
            `;
            
            const label = document.createElement('div');
            label.textContent = `CH ${index + 1}`;
            label.style.cssText = `
                font-size: 10px;
                color: #888;
                margin-bottom: 4px;
            `;
            channelContainer.appendChild(label);
            
            meter.createMeterUI(channelContainer);
            this.container.appendChild(channelContainer);
        });
        
        // Add master meter
        const masterContainer = document.createElement('div');
        masterContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 80px;
            border-left: 2px solid #333;
            padding-left: 8px;
        `;
        
        const masterLabel = document.createElement('div');
        masterLabel.textContent = 'MASTER';
        masterLabel.style.cssText = `
            font-size: 10px;
            color: #4f46e5;
            font-weight: 600;
            margin-bottom: 4px;
        `;
        masterContainer.appendChild(masterLabel);
        
        this.masterMeter.createMeterUI(masterContainer);
        this.container.appendChild(masterContainer);
        
        container.appendChild(this.container);
        
        return this.container;
    }
    
    /**
     * Get all meter values
     */
    getAllMeterValues() {
        return {
            channels: this.meters.map(m => m.getMeterValues()),
            master: this.masterMeter.getMeterValues()
        };
    }
    
    /**
     * Reset all meters
     */
    resetAll() {
        this.meters.forEach(m => m.reset());
        this.masterMeter.reset();
    }
    
    destroy() {
        this.meters.forEach(m => m.destroy());
        this.meters = [];
        if (this.masterMeter) {
            this.masterMeter.destroy();
            this.masterMeter = null;
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

export default AudioMetersEnhancement;