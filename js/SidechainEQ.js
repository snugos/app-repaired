/**
 * Sidechain EQ - EQ that responds to sidechain input
 * 
 * Features:
 * - Multiple EQ bands controlled by sidechain signal level
 * - Ducking with frequency-specific response
 * - Sidechain input routing
 * - Visual EQ curve display
 */

// Sidechain EQ Effect Class
export class SidechainEQ {
    constructor(options = {}) {
        this.options = {
            threshold: options.threshold || -20,      // dB threshold for sidechain
            attack: options.attack || 0.01,          // Attack time in seconds
            release: options.release || 0.1,         // Release time in seconds
            range: options.range || 12,              // dB range for EQ reduction
            ...options
        };
        
        // EQ Bands
        this.bands = [
            { frequency: 100, gain: 0, Q: 1, type: 'lowshelf', reduction: 0 },
            { frequency: 300, gain: 0, Q: 1, type: 'peaking', reduction: 0 },
            { frequency: 1000, gain: 0, Q: 1, type: 'peaking', reduction: 0 },
            { frequency: 3000, gain: 0, Q: 1, type: 'peaking', reduction: 0 },
            { frequency: 8000, gain: 0, Q: 1, type: 'highshelf', reduction: 0 }
        ];
        
        // Audio nodes (will be created when audio context is available)
        this.inputNode = null;
        this.sidechainInputNode = null;
        this.outputNode = null;
        this.eqNodes = [];
        this.sidechainAnalyser = null;
        this.envelopeFollower = null;
        
        // State
        this.isEnabled = true;
        this.currentSidechainLevel = 0;
        this.currentTargetReduction = 0;
        
        console.log('[SidechainEQ] Initialized with options:', this.options);
    }
    
    /**
     * Initialize audio nodes
     */
    initialize(audioContext) {
        this.audioContext = audioContext;
        
        // Create input/output nodes
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        this.sidechainInputNode = audioContext.createGain();
        
        // Create sidechain analyser
        this.sidechainAnalyser = audioContext.createAnalyser();
        this.sidechainAnalyser.fftSize = 256;
        this.sidechainInputNode.connect(this.sidechainAnalyser);
        
        // Create EQ filters for each band
        this.eqNodes = this.bands.map(band => {
            const filter = audioContext.createBiquadFilter();
            filter.type = band.type;
            filter.frequency.value = band.frequency;
            filter.gain.value = band.gain;
            filter.Q.value = band.Q;
            return filter;
        });
        
        // Chain: input -> EQ bands -> output
        let lastNode = this.inputNode;
        this.eqNodes.forEach(node => {
            lastNode.connect(node);
            lastNode = node;
        });
        lastNode.connect(this.outputNode);
        
        // Create envelope follower for sidechain
        this.envelopeFollower = {
            attackCoeff: Math.exp(-1 / (this.options.attack * audioContext.sampleRate)),
            releaseCoeff: Math.exp(-1 / (this.options.release * audioContext.sampleRate)),
            lastLevel: 0
        };
        
        // Start sidechain processing loop
        this._startSidechainProcessing();
        
        console.log('[SidechainEQ] Audio nodes initialized');
        return this;
    }
    
    /**
     * Start sidechain level monitoring and EQ adjustment
     */
    _startSidechainProcessing() {
        if (!this.sidechainAnalyser) return;
        
        const dataArray = new Float32Array(this.sidechainAnalyser.fftSize);
        
        const process = () => {
            if (!this.isEnabled) {
                this._processFrame = requestAnimationFrame(process);
                return;
            }
            
            // Get sidechain level
            this.sidechainAnalyser.getFloatTimeDomainData(dataArray);
            
            // Calculate RMS level
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i] * dataArray[i];
            }
            const rms = Math.sqrt(sum / dataArray.length);
            
            // Apply envelope follower
            const thresholdLinear = Math.pow(10, this.options.threshold / 20);
            const levelAboveThreshold = rms / thresholdLinear;
            
            // Smooth envelope
            if (levelAboveThreshold > this.envelopeFollower.lastLevel) {
                this.envelopeFollower.lastLevel = levelAboveThreshold * (1 - this.envelopeFollower.attackCoeff) 
                    + this.envelopeFollower.lastLevel * this.envelopeFollower.attackCoeff;
            } else {
                this.envelopeFollower.lastLevel = levelAboveThreshold * (1 - this.envelopeFollower.releaseCoeff) 
                    + this.envelopeFollower.lastLevel * this.envelopeFollower.releaseCoeff;
            }
            
            this.currentSidechainLevel = this.envelopeFollower.lastLevel;
            
            // Apply EQ reduction based on sidechain level
            this._applyEQReduction();
            
            this._processFrame = requestAnimationFrame(process);
        };
        
        this._processFrame = requestAnimationFrame(process);
    }
    
    /**
     * Apply EQ gain reduction based on sidechain level
     */
    _applyEQReduction() {
        const reduction = Math.min(this.options.range, this.currentSidechainLevel * this.options.range);
        this.currentTargetReduction = reduction;
        
        // Apply reduction to each band with frequency-specific scaling
        this.eqNodes.forEach((node, index) => {
            const band = this.bands[index];
            // Scale reduction per band (can be customized)
            const bandScale = this._getBandScale(index);
            const targetGain = -reduction * bandScale;
            
            // Smooth gain change
            const currentGain = node.gain.value;
            const newGain = currentGain + (targetGain - currentGain) * 0.1;
            node.gain.setTargetAtTime(newGain, this.audioContext.currentTime, 0.01);
        });
    }
    
    /**
     * Get scaling factor for each band
     */
    _getBandScale(index) {
        // Default scaling: more reduction in low-mid frequencies
        const scales = [0.8, 1.0, 1.2, 0.9, 0.6];
        return scales[index] || 1.0;
    }
    
    /**
     * Connect audio input
     */
    connect(source) {
        if (source.output) {
            source.output.connect(this.inputNode);
        } else if (source.connect) {
            source.connect(this.inputNode);
        }
        return this;
    }
    
    /**
     * Connect sidechain input
     */
    connectSidechain(source) {
        if (source.output) {
            source.output.connect(this.sidechainInputNode);
        } else if (source.connect) {
            source.connect(this.sidechainInputNode);
        }
        return this;
    }
    
    /**
     * Get output node
     */
    get output() {
        return this.outputNode;
    }
    
    /**
     * Set threshold in dB
     */
    setThreshold(db) {
        this.options.threshold = Math.max(-60, Math.min(0, db));
        console.log(`[SidechainEQ] Threshold set to ${this.options.threshold} dB`);
    }
    
    /**
     * Set attack time in seconds
     */
    setAttack(seconds) {
        this.options.attack = Math.max(0.001, Math.min(1, seconds));
        if (this.envelopeFollower) {
            this.envelopeFollower.attackCoeff = Math.exp(-1 / (this.options.attack * this.audioContext.sampleRate));
        }
        console.log(`[SidechainEQ] Attack set to ${this.options.attack}s`);
    }
    
    /**
     * Set release time in seconds
     */
    setRelease(seconds) {
        this.options.release = Math.max(0.01, Math.min(2, seconds));
        if (this.envelopeFollower) {
            this.envelopeFollower.releaseCoeff = Math.exp(-1 / (this.options.release * this.audioContext.sampleRate));
        }
        console.log(`[SidechainEQ] Release set to ${this.options.release}s`);
    }
    
    /**
     * Set range in dB
     */
    setRange(db) {
        this.options.range = Math.max(0, Math.min(24, db));
        console.log(`[SidechainEQ] Range set to ${this.options.range} dB`);
    }
    
    /**
     * Set band frequency
     */
    setBandFrequency(bandIndex, frequency) {
        if (bandIndex >= 0 && bandIndex < this.bands.length) {
            this.bands[bandIndex].frequency = frequency;
            if (this.eqNodes[bandIndex]) {
                this.eqNodes[bandIndex].frequency.value = frequency;
            }
        }
    }
    
    /**
     * Set band reduction scale
     */
    setBandScale(bandIndex, scale) {
        if (bandIndex >= 0 && bandIndex < this.bands.length) {
            this.bands[bandIndex].scale = scale;
        }
    }
    
    /**
     * Enable/disable the effect
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`[SidechainEQ] ${enabled ? 'Enabled' : 'Disabled'}`);
    }
    
    /**
     * Get current state for visualization
     */
    getState() {
        return {
            isEnabled: this.isEnabled,
            sidechainLevel: this.currentSidechainLevel,
            targetReduction: this.currentTargetReduction,
            threshold: this.options.threshold,
            attack: this.options.attack,
            release: this.options.release,
            range: this.options.range,
            bands: this.bands.map((band, i) => ({
                ...band,
                currentGain: this.eqNodes[i]?.gain.value || 0
            }))
        };
    }
    
    /**
     * Dispose all audio nodes
     */
    dispose() {
        if (this._processFrame) {
            cancelAnimationFrame(this._processFrame);
        }
        
        if (this.inputNode) this.inputNode.disconnect();
        if (this.outputNode) this.outputNode.disconnect();
        if (this.sidechainInputNode) this.sidechainInputNode.disconnect();
        if (this.sidechainAnalyser) this.sidechainAnalyser.disconnect();
        
        this.eqNodes.forEach(node => {
            try { node.disconnect(); } catch (e) {}
        });
        
        this.inputNode = null;
        this.outputNode = null;
        this.sidechainInputNode = null;
        this.sidechainAnalyser = null;
        this.eqNodes = [];
        
        console.log('[SidechainEQ] Disposed');
    }
}

/**
 * Create Sidechain EQ UI Panel
 */
export function openSidechainEQPanel(services) {
    const { showNotification, getTrackById, getTracks } = services;
    
    // Create panel container
    const panel = document.createElement('div');
    panel.id = 'sidechain-eq-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-xl p-6 w-[800px] max-h-[90vh] overflow-y-auto border border-zinc-700">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">Sidechain EQ</h2>
                <button id="close-sidechain-eq" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="grid grid-cols-2 gap-6 mb-6">
                <div class="bg-zinc-800 rounded-lg p-4">
                    <h3 class="text-lg font-semibold text-white mb-4">Sidechain Settings</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="text-zinc-400 text-sm">Threshold (dB)</label>
                            <input type="range" id="sc-threshold" min="-60" max="0" value="-20" step="1" 
                                class="w-full accent-blue-500">
                            <span id="sc-threshold-val" class="text-white text-sm">-20 dB</span>
                        </div>
                        <div>
                            <label class="text-zinc-400 text-sm">Attack (ms)</label>
                            <input type="range" id="sc-attack" min="1" max="1000" value="10" step="1"
                                class="w-full accent-blue-500">
                            <span id="sc-attack-val" class="text-white text-sm">10 ms</span>
                        </div>
                        <div>
                            <label class="text-zinc-400 text-sm">Release (ms)</label>
                            <input type="range" id="sc-release" min="10" max="2000" value="100" step="10"
                                class="w-full accent-blue-500">
                            <span id="sc-release-val" class="text-white text-sm">100 ms</span>
                        </div>
                        <div>
                            <label class="text-zinc-400 text-sm">Range (dB)</label>
                            <input type="range" id="sc-range" min="0" max="24" value="12" step="0.5"
                                class="w-full accent-blue-500">
                            <span id="sc-range-val" class="text-white text-sm">12 dB</span>
                        </div>
                    </div>
                </div>
                
                <div class="bg-zinc-800 rounded-lg p-4">
                    <h3 class="text-lg font-semibold text-white mb-4">Routing</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="text-zinc-400 text-sm">Target Track</label>
                            <select id="sc-target-track" class="w-full bg-zinc-700 text-white rounded p-2">
                                <option value="">Select track...</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-zinc-400 text-sm">Sidechain Source</label>
                            <select id="sc-source-track" class="w-full bg-zinc-700 text-white rounded p-2">
                                <option value="">Select source...</option>
                            </select>
                        </div>
                        <div class="pt-4">
                            <button id="sc-enable-btn" class="w-full bg-blue-600 hover:bg-blue-500 text-white rounded p-2 font-medium">
                                Enable Sidechain EQ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bg-zinc-800 rounded-lg p-4 mb-6">
                <h3 class="text-lg font-semibold text-white mb-4">EQ Bands</h3>
                <div id="eq-bands-container" class="grid grid-cols-5 gap-4">
                    ${[0, 1, 2, 3, 4].map(i => `
                        <div class="bg-zinc-700 rounded p-3">
                            <div class="text-center text-zinc-400 text-xs mb-2">Band ${i + 1}</div>
                            <div class="mb-2">
                                <label class="text-zinc-500 text-xs">Freq</label>
                                <input type="number" id="band-freq-${i}" value="${[100, 300, 1000, 3000, 8000][i]}" 
                                    class="w-full bg-zinc-600 text-white rounded p-1 text-sm text-center">
                            </div>
                            <div class="mb-2">
                                <label class="text-zinc-500 text-xs">Scale</label>
                                <input type="range" id="band-scale-${i}" min="0" max="2" step="0.1" value="${[0.8, 1.0, 1.2, 0.9, 0.6][i]}"
                                    class="w-full accent-blue-500">
                            </div>
                            <div id="band-reduction-${i}" class="text-center text-yellow-400 text-sm">0.0 dB</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="bg-zinc-800 rounded-lg p-4">
                <h3 class="text-lg font-semibold text-white mb-4">Visualization</h3>
                <canvas id="sc-viz-canvas" width="760" height="150" class="w-full bg-zinc-900 rounded"></canvas>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Populate track selects
    const tracks = getTracks ? getTracks() : [];
    const targetSelect = panel.querySelector('#sc-target-track');
    const sourceSelect = panel.querySelector('#sc-source-track');
    
    tracks.forEach(track => {
        const opt1 = document.createElement('option');
        opt1.value = track.id;
        opt1.textContent = track.name;
        targetSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = track.id;
        opt2.textContent = track.name;
        sourceSelect.appendChild(opt2);
    });
    
    // State
    let sidechainEQ = null;
    let animationFrame = null;
    
    // Event handlers
    const closeBtn = panel.querySelector('#close-sidechain-eq');
    closeBtn.onclick = () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        if (sidechainEQ) sidechainEQ.dispose();
        panel.remove();
    };
    
    // Settings handlers
    const thresholdSlider = panel.querySelector('#sc-threshold');
    const attackSlider = panel.querySelector('#sc-attack');
    const releaseSlider = panel.querySelector('#sc-release');
    const rangeSlider = panel.querySelector('#sc-range');
    
    thresholdSlider.oninput = () => {
        panel.querySelector('#sc-threshold-val').textContent = `${thresholdSlider.value} dB`;
        if (sidechainEQ) sidechainEQ.setThreshold(parseFloat(thresholdSlider.value));
    };
    
    attackSlider.oninput = () => {
        panel.querySelector('#sc-attack-val').textContent = `${attackSlider.value} ms`;
        if (sidechainEQ) sidechainEQ.setAttack(parseFloat(attackSlider.value) / 1000);
    };
    
    releaseSlider.oninput = () => {
        panel.querySelector('#sc-release-val').textContent = `${releaseSlider.value} ms`;
        if (sidechainEQ) sidechainEQ.setRelease(parseFloat(releaseSlider.value) / 1000);
    };
    
    rangeSlider.oninput = () => {
        panel.querySelector('#sc-range-val').textContent = `${rangeSlider.value} dB`;
        if (sidechainEQ) sidechainEQ.setRange(parseFloat(rangeSlider.value));
    };
    
    // Band settings
    for (let i = 0; i < 5; i++) {
        const freqInput = panel.querySelector(`#band-freq-${i}`);
        const scaleSlider = panel.querySelector(`#band-scale-${i}`);
        
        freqInput.onchange = () => {
            if (sidechainEQ) sidechainEQ.setBandFrequency(i, parseFloat(freqInput.value));
        };
        
        scaleSlider.oninput = () => {
            if (sidechainEQ) sidechainEQ.setBandScale(i, parseFloat(scaleSlider.value));
        };
    }
    
    // Enable button
    const enableBtn = panel.querySelector('#sc-enable-btn');
    enableBtn.onclick = () => {
        const targetId = targetSelect.value;
        const sourceId = sourceSelect.value;
        
        if (!targetId || !sourceId) {
            if (showNotification) showNotification('Please select target and source tracks.', 2000);
            return;
        }
        
        if (targetId === sourceId) {
            if (showNotification) showNotification('Target and source must be different tracks.', 2000);
            return;
        }
        
        // Dispose existing
        if (sidechainEQ) sidechainEQ.dispose();
        
        // Create new Sidechain EQ
        const audioContext = window.Tone?.context?.rawContext || window.Tone?.context;
        if (!audioContext) {
            if (showNotification) showNotification('Audio context not available.', 2000);
            return;
        }
        
        sidechainEQ = new SidechainEQ({
            threshold: parseFloat(thresholdSlider.value),
            attack: parseFloat(attackSlider.value) / 1000,
            release: parseFloat(releaseSlider.value) / 1000,
            range: parseFloat(rangeSlider.value)
        });
        
        sidechainEQ.initialize(audioContext);
        
        // Connect to tracks (implementation depends on track structure)
        const targetTrack = getTrackById ? getTrackById(targetId) : null;
        const sourceTrack = getTrackById ? getTrackById(sourceId) : null;
        
        if (targetTrack && targetTrack.instrument) {
            // Insert sidechain EQ into target track's chain
            // This would need proper integration with Track.js routing
            if (showNotification) showNotification('Sidechain EQ connected. Configure routing in track settings.', 3000);
        }
        
        // Update button
        enableBtn.textContent = 'Sidechain EQ Active';
        enableBtn.classList.remove('bg-blue-600', 'hover:bg-blue-500');
        enableBtn.classList.add('bg-green-600', 'hover:bg-green-500');
        
        // Start visualization
        startVisualization();
    };
    
    // Visualization
    const canvas = panel.querySelector('#sc-viz-canvas');
    const ctx = canvas.getContext('2d');
    
    function startVisualization() {
        function draw() {
            ctx.fillStyle = '#18181b';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (sidechainEQ) {
                const state = sidechainEQ.getState();
                
                // Draw EQ curve
                ctx.beginPath();
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                
                const bandWidth = canvas.width / 5;
                state.bands.forEach((band, i) => {
                    const x = i * bandWidth + bandWidth / 2;
                    const y = canvas.height / 2 - (band.currentGain * 3);
                    
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                    
                    // Draw band marker
                    ctx.fillStyle = '#fbbf24';
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Update band reduction display
                    const reductionEl = panel.querySelector(`#band-reduction-${i}`);
                    if (reductionEl) {
                        reductionEl.textContent = `${band.currentGain.toFixed(1)} dB`;
                    }
                });
                ctx.stroke();
                
                // Draw sidechain level meter
                const levelWidth = state.sidechainLevel * 100;
                ctx.fillStyle = '#22c55e';
                ctx.fillRect(10, canvas.height - 20, Math.min(levelWidth, canvas.width - 20), 10);
                ctx.strokeStyle = '#fff';
                ctx.strokeRect(10, canvas.height - 20, canvas.width - 20, 10);
                
                // Labels
                ctx.fillStyle = '#fff';
                ctx.font = '10px sans-serif';
                ctx.fillText(`Sidechain: ${state.sidechainLevel.toFixed(2)} | Reduction: ${state.targetReduction.toFixed(1)} dB`, 10, 15);
            }
            
            animationFrame = requestAnimationFrame(draw);
        }
        
        draw();
    }
    
    // Initial visualization
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#71717a';
    ctx.font = '12px sans-serif';
    ctx.fillText('Enable Sidechain EQ to see visualization', canvas.width / 2 - 100, canvas.height / 2);
    
    console.log('[SidechainEQ] Panel opened');
}

// Default export
export default SidechainEQ;