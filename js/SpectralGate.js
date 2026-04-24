/**
 * Spectral Gate - Frequency-domain noise gate
 * Removes noise below a threshold in each frequency band
 */

export class SpectralGate {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            threshold: options.threshold ?? -40,     // dB
            ratio: options.ratio ?? 10,               // Compression ratio
            attack: options.attack ?? 0.005,          // seconds
            release: options.release ?? 0.1,          // seconds
            fftSize: options.fftSize ?? 2048,         // FFT size
            holdTime: options.holdTime ?? 0.05,       // seconds to hold gate open
            reduction: options.reduction ?? -60,      // dB when gated
            mode: options.mode ?? 'gate',             // 'gate' or 'expand'
            bands: options.bands ?? 8,                // Number of bands for multi-band processing
            ...options
        };
        
        // Create audio nodes
        this.createNodes();
        
        // State
        this.isEnabled = true;
        this.isProcessing = false;
    }
    
    createNodes() {
        // Input/Output
        this.input = this.audioContext.createGain();
        this.output = this.audioContext.createGain();
        
        // Analyzer for frequency data
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = this.config.fftSize;
        this.analyzer.smoothingTimeConstant = 0.3;
        
        // Frequency data buffers
        this.frequencyData = new Float32Array(this.analyzer.frequencyBinCount);
        this.timeData = new Float32Array(this.analyzer.fftSize);
        
        // Gain nodes for output control
        this.gainNode = this.audioContext.createGain();
        
        // Band processors for multi-band gating
        this.bands = [];
        this.createBandProcessors();
        
        // Connect main path
        this.input.connect(this.analyzer);
        this.input.connect(this.gainNode);
        this.gainNode.connect(this.output);
        
        // Initialize threshold levels per band
        this.bandLevels = new Array(this.config.bands).fill(0);
        this.bandStates = new Array(this.config.bands).fill(false);
        this.bandHoldTimers = new Array(this.config.bands).fill(0);
    }
    
    createBandProcessors() {
        // Create band-split processing
        const bandWidth = this.audioContext.sampleRate / (2 * this.config.bands);
        
        for (let i = 0; i < this.config.bands; i++) {
            const centerFreq = (i + 0.5) * bandWidth;
            
            const band = {
                filter: this.audioContext.createBiquadFilter(),
                gain: this.audioContext.createGain(),
                analyzer: this.audioContext.createAnalyser(),
                threshold: this.config.threshold,
                level: 0,
                isGated: false,
                holdTimer: 0
            };
            
            // Configure band filter
            band.filter.type = 'bandpass';
            band.filter.frequency.value = centerFreq;
            band.filter.Q.value = this.config.bands / 2;
            
            // Configure analyzer
            band.analyzer.fftSize = 512;
            band.analyzer.smoothingTimeConstant = 0.1;
            
            // Connect band
            this.input.connect(band.filter);
            band.filter.connect(band.analyzer);
            band.filter.connect(band.gain);
            band.gain.connect(this.output);
            
            this.bands.push(band);
        }
    }
    
    // Set threshold in dB
    setThreshold(db) {
        this.config.threshold = db;
    }
    
    // Set attack time
    setAttack(seconds) {
        this.config.attack = Math.max(0.001, seconds);
    }
    
    // Set release time
    setRelease(seconds) {
        this.config.release = Math.max(0.01, seconds);
    }
    
    // Set hold time
    setHoldTime(seconds) {
        this.config.holdTime = seconds;
    }
    
    // Set reduction amount in dB
    setReduction(db) {
        this.config.reduction = db;
    }
    
    // Set mode ('gate' or 'expand')
    setMode(mode) {
        this.config.mode = mode;
    }
    
    // Process audio
    process() {
        if (!this.isEnabled) return;
        this.isProcessing = true;
        
        const currentTime = this.audioContext.currentTime;
        
        // Process each band
        for (let i = 0; i < this.bands.length; i++) {
            const band = this.bands[i];
            const data = new Float32Array(band.analyzer.frequencyBinCount);
            band.analyzer.getFloatFrequencyData(data);
            
            // Calculate average level for this band
            let sum = 0;
            for (let j = 0; j < data.length; j++) {
                sum += data[j];
            }
            const avgLevel = sum / data.length;
            band.level = avgLevel;
            
            // Determine if signal is above threshold
            const threshold = band.threshold;
            const isAbove = avgLevel > threshold;
            
            // Update hold timer
            if (isAbove) {
                band.holdTimer = this.config.holdTime;
            } else if (band.holdTimer > 0) {
                band.holdTimer -= 0.01; // Approximate frame time
            }
            
            // Determine gate state
            const shouldOpen = isAbove || band.holdTimer > 0;
            
            if (shouldOpen !== band.isGated) {
                band.isGated = shouldOpen;
                
                // Calculate gain based on mode
                let targetGain;
                
                if (this.config.mode === 'gate') {
                    // Gate mode: open/close
                    targetGain = shouldOpen ? 1 : Math.pow(10, this.config.reduction / 20);
                } else {
                    // Expand mode: proportional gain based on level above threshold
                    const dbAboveThreshold = avgLevel - threshold;
                    const expansionRatio = this.config.ratio;
                    
                    if (dbAboveThreshold > 0) {
                        targetGain = 1;
                    } else {
                        // Apply expansion below threshold
                        const expandedDb = dbAboveThreshold * expansionRatio;
                        targetGain = Math.max(Math.pow(10, this.config.reduction / 20), 
                                             Math.pow(10, expandedDb / 20));
                    }
                }
                
                // Apply with envelope
                const timeConstant = shouldOpen ? this.config.attack : this.config.release;
                band.gain.gain.setTargetAtTime(targetGain, currentTime, timeConstant);
            }
        }
        
        // Continue processing
        if (this.isProcessing) {
            requestAnimationFrame(() => this.process());
        }
    }
    
    // Start processing
    start() {
        this.isEnabled = true;
        this.process();
    }
    
    // Stop processing
    stop() {
        this.isProcessing = false;
        this.isEnabled = false;
        
        // Open all gates
        const currentTime = this.audioContext.currentTime;
        this.bands.forEach(band => {
            band.gain.gain.setTargetAtTime(1, currentTime, 0.01);
        });
    }
    
    // Get band levels for visualization
    getBandLevels() {
        return this.bands.map(band => ({
            level: band.level,
            threshold: band.threshold,
            isGated: band.isGated,
            holdTimer: band.holdTimer
        }));
    }
    
    // Get overall statistics
    getStats() {
        const levels = this.bands.map(b => b.level);
        const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
        const gatedCount = this.bands.filter(b => b.isGated).length;
        
        return {
            averageLevel: avgLevel,
            bandsOpen: gatedCount,
            bandsClosed: this.bands.length - gatedCount,
            threshold: this.config.threshold,
            mode: this.config.mode
        };
    }
    
    // Connect input
    connectInput(source) {
        source.connect(this.input);
    }
    
    // Connect output
    connect(destination) {
        this.output.connect(destination);
        return this;
    }
    
    // Create UI
    createUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        
        container.innerHTML = `
            <div class="spectral-gate" style="background: #1a1a2e; padding: 16px; border-radius: 8px; color: white; font-family: system-ui;">
                <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #888;">Spectral Gate</h3>
                
                <div class="visualization" style="margin-bottom: 16px;">
                    <canvas id="spectral-viz" width="400" height="100" style="background: #0a0a14; border-radius: 4px; width: 100%;"></canvas>
                </div>
                
                <div class="controls-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    <div class="control-row">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Threshold (dB)</label>
                        <input type="range" id="sg-threshold" min="-80" max="0" value="${this.config.threshold}" step="1" style="width: 100%;">
                        <span id="sg-threshold-val" style="font-size: 11px; color: #888;">${this.config.threshold}</span>
                    </div>
                    
                    <div class="control-row">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Reduction (dB)</label>
                        <input type="range" id="sg-reduction" min="-80" max="0" value="${this.config.reduction}" step="1" style="width: 100%;">
                        <span id="sg-reduction-val" style="font-size: 11px; color: #888;">${this.config.reduction}</span>
                    </div>
                    
                    <div class="control-row">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Attack (ms)</label>
                        <input type="range" id="sg-attack" min="1" max="100" value="${this.config.attack * 1000}" step="1" style="width: 100%;">
                        <span id="sg-attack-val" style="font-size: 11px; color: #888;">${this.config.attack * 1000}</span>
                    </div>
                    
                    <div class="control-row">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Release (ms)</label>
                        <input type="range" id="sg-release" min="10" max="500" value="${this.config.release * 1000}" step="10" style="width: 100%;">
                        <span id="sg-release-val" style="font-size: 11px; color: #888;">${this.config.release * 1000}</span>
                    </div>
                    
                    <div class="control-row">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Hold (ms)</label>
                        <input type="range" id="sg-hold" min="0" max="200" value="${this.config.holdTime * 1000}" step="10" style="width: 100%;">
                        <span id="sg-hold-val" style="font-size: 11px; color: #888;">${this.config.holdTime * 1000}</span>
                    </div>
                    
                    <div class="control-row">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Bands</label>
                        <input type="range" id="sg-bands" min="2" max="16" value="${this.config.bands}" step="1" style="width: 100%;">
                        <span id="sg-bands-val" style="font-size: 11px; color: #888;">${this.config.bands}</span>
                    </div>
                </div>
                
                <div class="mode-selector" style="margin-top: 12px;">
                    <label style="font-size: 11px; color: #666; display: block; margin-bottom: 8px;">Mode</label>
                    <div style="display: flex; gap: 8px;">
                        <button id="sg-mode-gate" class="${this.config.mode === 'gate' ? 'active' : ''}" style="flex: 1; padding: 8px; background: ${this.config.mode === 'gate' ? '#10b981' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            Gate
                        </button>
                        <button id="sg-mode-expand" class="${this.config.mode === 'expand' ? 'active' : ''}" style="flex: 1; padding: 8px; background: ${this.config.mode === 'expand' ? '#10b981' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            Expand
                        </button>
                    </div>
                </div>
                
                <div class="actions" style="margin-top: 12px; display: flex; gap: 8px;">
                    <button id="sg-start" style="flex: 1; padding: 8px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        Start
                    </button>
                    <button id="sg-stop" style="flex: 1; padding: 8px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        Stop
                    </button>
                </div>
            </div>
        `;
        
        this.canvas = document.getElementById('spectral-viz');
        this.ctx = this.canvas.getContext('2d');
        
        this.wireUIEvents();
        this.startVisualization();
        
        return container;
    }
    
    wireUIEvents() {
        // Threshold
        const thresholdSlider = document.getElementById('sg-threshold');
        const thresholdVal = document.getElementById('sg-threshold-val');
        if (thresholdSlider) {
            thresholdSlider.addEventListener('input', (e) => {
                this.setThreshold(parseFloat(e.target.value));
                thresholdVal.textContent = e.target.value;
            });
        }
        
        // Reduction
        const reductionSlider = document.getElementById('sg-reduction');
        const reductionVal = document.getElementById('sg-reduction-val');
        if (reductionSlider) {
            reductionSlider.addEventListener('input', (e) => {
                this.setReduction(parseFloat(e.target.value));
                reductionVal.textContent = e.target.value;
            });
        }
        
        // Attack
        const attackSlider = document.getElementById('sg-attack');
        const attackVal = document.getElementById('sg-attack-val');
        if (attackSlider) {
            attackSlider.addEventListener('input', (e) => {
                this.setAttack(parseFloat(e.target.value) / 1000);
                attackVal.textContent = e.target.value;
            });
        }
        
        // Release
        const releaseSlider = document.getElementById('sg-release');
        const releaseVal = document.getElementById('sg-release-val');
        if (releaseSlider) {
            releaseSlider.addEventListener('input', (e) => {
                this.setRelease(parseFloat(e.target.value) / 1000);
                releaseVal.textContent = e.target.value;
            });
        }
        
        // Hold
        const holdSlider = document.getElementById('sg-hold');
        const holdVal = document.getElementById('sg-hold-val');
        if (holdSlider) {
            holdSlider.addEventListener('input', (e) => {
                this.setHoldTime(parseFloat(e.target.value) / 1000);
                holdVal.textContent = e.target.value;
            });
        }
        
        // Mode buttons
        const gateBtn = document.getElementById('sg-mode-gate');
        const expandBtn = document.getElementById('sg-mode-expand');
        
        if (gateBtn) {
            gateBtn.addEventListener('click', () => {
                this.setMode('gate');
                gateBtn.style.background = '#10b981';
                expandBtn.style.background = '#333';
            });
        }
        
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                this.setMode('expand');
                expandBtn.style.background = '#10b981';
                gateBtn.style.background = '#333';
            });
        }
        
        // Start/Stop
        const startBtn = document.getElementById('sg-start');
        const stopBtn = document.getElementById('sg-stop');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.start();
                startBtn.style.background = '#10b981';
                stopBtn.style.background = '#333';
            });
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stop();
                stopBtn.style.background = '#ef4444';
                startBtn.style.background = '#333';
            });
        }
    }
    
    startVisualization() {
        const vizLoop = () => {
            if (!this.canvas) return;
            
            const ctx = this.ctx;
            const width = this.canvas.width;
            const height = this.canvas.height;
            
            // Clear
            ctx.fillStyle = '#0a0a14';
            ctx.fillRect(0, 0, width, height);
            
            // Draw threshold line
            const thresholdY = height - ((this.config.threshold + 80) / 80) * height;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, thresholdY);
            ctx.lineTo(width, thresholdY);
            ctx.stroke();
            
            // Draw band levels
            const bandLevels = this.getBandLevels();
            const bandWidth = width / bandLevels.length;
            
            bandLevels.forEach((band, i) => {
                const x = i * bandWidth;
                const levelHeight = ((band.level + 80) / 80) * height;
                const y = height - levelHeight;
                
                // Draw bar
                ctx.fillStyle = band.isGated ? '#10b981' : '#ef4444';
                ctx.fillRect(x + 2, y, bandWidth - 4, levelHeight);
                
                // Draw threshold for this band
                const bandThresholdY = height - ((band.threshold + 80) / 80) * height;
                ctx.strokeStyle = '#f59e0b';
                ctx.beginPath();
                ctx.moveTo(x, bandThresholdY);
                ctx.lineTo(x + bandWidth, bandThresholdY);
                ctx.stroke();
            });
            
            requestAnimationFrame(vizLoop);
        };
        
        vizLoop();
    }
    
    // Dispose
    dispose() {
        this.stop();
        
        this.input.disconnect();
        this.output.disconnect();
        this.gainNode.disconnect();
        this.analyzer.disconnect();
        
        this.bands.forEach(band => {
            band.filter.disconnect();
            band.gain.disconnect();
            band.analyzer.disconnect();
        });
    }
}

// Factory function
export function createSpectralGate(audioContext, options = {}) {
    return new SpectralGate(audioContext, options);
}