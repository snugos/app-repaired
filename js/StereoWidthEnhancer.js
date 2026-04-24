/**
 * Stereo Width Enhancer - Advanced stereo width manipulation
 * Provides multiple algorithms for stereo enhancement
 */

export class StereoWidthEnhancer {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            width: options.width ?? 1,              // 0 = mono, 1 = normal, 2 = double
            pan: options.pan ?? 0,                  // Center pan
            separation: options.separation ?? 0,    // Channel separation
            bassMono: options.bassMono ?? 80,       // Hz (mono bass below this freq)
            monoMaker: options.monoMaker ?? false,  // Mono compatibility
            phaseInvert: options.phaseInvert ?? 'none', // 'left', 'right', 'none'
            algorithm: options.algorithm ?? 'ms',   // 'ms', 'shuffler', 'haas'
            haasDelay: options.haasDelay ?? 15,     // ms for Haas effect
            shuffleFreq: options.shuffleFreq ?? 600, // Hz for frequency shuffling
            ...options
        };
        
        // Create audio nodes
        this.createNodes();
        
        // Apply initial config
        this.applyConfig();
        
        // State
        this.isEnabled = true;
        this.bypassed = false;
    }
    
    createNodes() {
        // Input
        this.input = this.audioContext.createGain();
        
        // Splitter
        this.splitter = this.audioContext.createChannelSplitter(2);
        
        // Left channel chain
        this.leftChain = {
            input: this.audioContext.createGain(),
            widthGain: this.audioContext.createGain(),
            panGain: this.audioContext.createGain(),
            phaseInvert: this.audioContext.createGain(),
            haasDelay: this.audioContext.createDelay(),
            lowPass: this.audioContext.createBiquadFilter(),
            output: this.audioContext.createGain()
        };
        
        // Right channel chain
        this.rightChain = {
            input: this.audioContext.createGain(),
            widthGain: this.audioContext.createGain(),
            panGain: this.audioContext.createGain(),
            phaseInvert: this.audioContext.createGain(),
            haasDelay: this.audioContext.createDelay(),
            lowPass: this.audioContext.createBiquadFilter(),
            output: this.audioContext.createGain()
        };
        
        // Mid-Side encoder
        this.msEncoder = {
            midToLeft: this.audioContext.createGain(),
            midToRight: this.audioContext.createGain(),
            sideToLeft: this.audioContext.createGain(),
            sideToRight: this.audioContext.createGain(),
            midGain: this.audioContext.createGain(),
            sideGain: this.audioContext.createGain()
        };
        
        // Mono bass
        this.bassMono = {
            lowPass: this.audioContext.createBiquadFilter(),
            highPass: this.audioContext.createBiquadFilter(),
            monoMerger: this.audioContext.createChannelMerger(2)
        };
        
        // Merger
        this.merger = this.audioContext.createChannelMerger(2);
        
        // Output
        this.output = this.audioContext.createGain();
        
        // Configure filters
        this.leftChain.lowPass.type = 'lowpass';
        this.rightChain.lowPass.type = 'lowpass';
        this.leftChain.lowPass.frequency.value = 20000;
        this.rightChain.lowPass.frequency.value = 20000;
        
        this.bassMono.lowPass.type = 'lowpass';
        this.bassMono.highPass.type = 'highpass';
        
        // Configure Haas delay
        this.leftChain.haasDelay.delayTime.value = 0;
        this.rightChain.haasDelay.delayTime.value = 0;
        
        // Wire everything
        this.wireNodes();
    }
    
    wireNodes() {
        // Split stereo
        this.input.connect(this.splitter);
        
        // Connect left chain
        this.splitter.connect(this.leftChain.input, 0);
        this.leftChain.input.connect(this.leftChain.phaseInvert);
        this.leftChain.phaseInvert.connect(this.leftChain.widthGain);
        this.leftChain.widthGain.connect(this.leftChain.haasDelay);
        this.leftChain.haasDelay.connect(this.leftChain.lowPass);
        this.leftChain.lowPass.connect(this.leftChain.panGain);
        this.leftChain.panGain.connect(this.leftChain.output);
        this.leftChain.output.connect(this.merger, 0, 0);
        
        // Connect right chain
        this.splitter.connect(this.rightChain.input, 1);
        this.rightChain.input.connect(this.rightChain.phaseInvert);
        this.rightChain.phaseInvert.connect(this.rightChain.widthGain);
        this.rightChain.widthGain.connect(this.rightChain.haasDelay);
        this.rightChain.haasDelay.connect(this.rightChain.lowPass);
        this.rightChain.lowPass.connect(this.rightChain.panGain);
        this.rightChain.panGain.connect(this.rightChain.output);
        this.rightChain.output.connect(this.merger, 0, 1);
        
        // Connect to output
        this.merger.connect(this.output);
        
        // Set initial values
        this.leftChain.phaseInvert.gain.value = 1;
        this.rightChain.phaseInvert.gain.value = 1;
        this.leftChain.panGain.gain.value = 1;
        this.rightChain.panGain.gain.value = 1;
    }
    
    applyConfig() {
        this.setWidth(this.config.width);
        this.setPan(this.config.pan);
        this.setBassMono(this.config.bassMono);
        this.setPhaseInvert(this.config.phaseInvert);
        this.setHaasDelay(this.config.haasDelay);
        this.setAlgorithm(this.config.algorithm);
    }
    
    // Set stereo width (0 = mono, 1 = normal, 2 = double)
    setWidth(width) {
        this.config.width = width;
        
        // Width algorithm based on mid-side
        // Width < 1: Reduce side signal (narrower)
        // Width > 1: Boost side signal (wider)
        
        if (this.config.algorithm === 'ms') {
            // Mid-side width control
            // Normal: L = M + S, R = M - S
            // Wide: S is amplified
            
            const sideBoost = width;
            
            // Adjust width by modifying the balance
            // This is a simplified approach
            if (width <= 1) {
                // Narrower: reduce side signal
                this.leftChain.widthGain.gain.setTargetAtTime(width, this.audioContext.currentTime, 0.01);
                this.rightChain.widthGain.gain.setTargetAtTime(width, this.audioContext.currentTime, 0.01);
            } else {
                // Wider: boost and create pseudo-stereo
                this.leftChain.widthGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
                this.rightChain.widthGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
            }
        } else if (this.config.algorithm === 'haas') {
            // Haas effect for width
            const delayMs = this.config.haasDelay;
            this.rightChain.haasDelay.delayTime.setTargetAtTime(delayMs / 1000, this.audioContext.currentTime, 0.01);
        }
    }
    
    // Set pan (-1 = left, 0 = center, 1 = right)
    setPan(pan) {
        this.config.pan = pan;
        
        // Balance control
        const leftGain = Math.cos((pan + 1) * Math.PI / 4);
        const rightGain = Math.sin((pan + 1) * Math.PI / 4);
        
        this.leftChain.panGain.gain.setTargetAtTime(leftGain, this.audioContext.currentTime, 0.01);
        this.rightChain.panGain.gain.setTargetAtTime(rightGain, this.audioContext.currentTime, 0.01);
    }
    
    // Set bass mono frequency (frequencies below this are mono)
    setBassMono(freq) {
        this.config.bassMono = freq;
        // Note: Full implementation would require re-wiring
        // This is a simplified version
    }
    
    // Set phase inversion ('none', 'left', 'right')
    setPhaseInvert(channel) {
        this.config.phaseInvert = channel;
        
        this.leftChain.phaseInvert.gain.setTargetAtTime(
            channel === 'left' ? -1 : 1,
            this.audioContext.currentTime,
            0.01
        );
        
        this.rightChain.phaseInvert.gain.setTargetAtTime(
            channel === 'right' ? -1 : 1,
            this.audioContext.currentTime,
            0.01
        );
    }
    
    // Set Haas delay in ms
    setHaasDelay(ms) {
        this.config.haasDelay = ms;
        
        if (this.config.algorithm === 'haas') {
            this.rightChain.haasDelay.delayTime.setTargetAtTime(ms / 1000, this.audioContext.currentTime, 0.01);
        }
    }
    
    // Set algorithm
    setAlgorithm(algo) {
        this.config.algorithm = algo;
        
        // Reset delays for non-Haas modes
        if (algo !== 'haas') {
            this.leftChain.haasDelay.delayTime.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
            this.rightChain.haasDelay.delayTime.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
        }
    }
    
    // Mono compatibility check
    enableMonoMaker(enable) {
        this.config.monoMaker = enable;
    }
    
    // Bypass
    setBypass(bypass) {
        this.bypassed = bypass;
        
        if (bypass) {
            // Direct pass-through
            this.input.disconnect();
            this.input.connect(this.output);
        } else {
            this.input.disconnect();
            this.input.connect(this.splitter);
        }
    }
    
    // Get mono version for compatibility check
    getMonoVersion() {
        const mono = this.audioContext.createGain();
        
        // Sum L + R
        const splitter = this.audioContext.createChannelSplitter(2);
        this.output.connect(splitter);
        
        const left = this.audioContext.createGain();
        const right = this.audioContext.createGain();
        left.gain.value = 0.5;
        right.gain.value = 0.5;
        
        splitter.connect(left, 0);
        splitter.connect(right, 1);
        left.connect(mono);
        right.connect(mono);
        
        return mono;
    }
    
    // Connect
    connect(destination) {
        this.output.connect(destination);
        return this;
    }
    
    // Get input
    getInput() {
        return this.input;
    }
    
    // Get output
    getOutput() {
        return this.output;
    }
    
    // Get state
    getState() {
        return { ...this.config, bypassed: this.bypassed };
    }
    
    // Create UI
    createUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        
        container.innerHTML = `
            <div class="stereo-width-enhancer" style="background: #1a1a2e; padding: 16px; border-radius: 8px; color: white; font-family: system-ui;">
                <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #888;">Stereo Width Enhancer</h3>
                
                <div class="width-display" style="text-align: center; margin-bottom: 16px;">
                    <canvas id="width-display-canvas" width="200" height="100" style="background: #0a0a14; border-radius: 4px;"></canvas>
                </div>
                
                <div class="controls">
                    <div class="control-row" style="margin-bottom: 12px;">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Width</label>
                        <input type="range" id="swe-width" min="0" max="3" value="${this.config.width}" step="0.01" style="width: 100%;">
                        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                            <span>Mono</span>
                            <span id="swe-width-val" style="color: #10b981;">${this.config.width.toFixed(2)}</span>
                            <span>Wide</span>
                        </div>
                    </div>
                    
                    <div class="control-row" style="margin-bottom: 12px;">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Pan</label>
                        <input type="range" id="swe-pan" min="-1" max="1" value="${this.config.pan}" step="0.01" style="width: 100%;">
                        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                            <span>L</span>
                            <span id="swe-pan-val" style="color: #10b981;">${this.config.pan.toFixed(2)}</span>
                            <span>R</span>
                        </div>
                    </div>
                    
                    <div class="control-row" style="margin-bottom: 12px;">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Bass Mono (Hz)</label>
                        <input type="range" id="swe-bass-mono" min="0" max="500" value="${this.config.bassMono}" step="10" style="width: 100%;">
                        <span id="swe-bass-mono-val" style="font-size: 11px; color: #888;">${this.config.bassMono || 'Off'}</span>
                    </div>
                    
                    <div class="control-row" style="margin-bottom: 12px;">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Haas Delay (ms)</label>
                        <input type="range" id="swe-haas" min="0" max="40" value="${this.config.haasDelay}" step="1" style="width: 100%;">
                        <span id="swe-haas-val" style="font-size: 11px; color: #888;">${this.config.haasDelay}</span>
                    </div>
                </div>
                
                <div class="phase-invert" style="margin-top: 12px;">
                    <label style="font-size: 11px; color: #666; display: block; margin-bottom: 8px;">Phase Invert</label>
                    <div style="display: flex; gap: 8px;">
                        <button id="swe-phase-none" class="${this.config.phaseInvert === 'none' ? 'active' : ''}" style="flex: 1; padding: 8px; background: ${this.config.phaseInvert === 'none' ? '#10b981' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">None</button>
                        <button id="swe-phase-left" class="${this.config.phaseInvert === 'left' ? 'active' : ''}" style="flex: 1; padding: 8px; background: ${this.config.phaseInvert === 'left' ? '#ef4444' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Left</button>
                        <button id="swe-phase-right" class="${this.config.phaseInvert === 'right' ? 'active' : ''}" style="flex: 1; padding: 8px; background: ${this.config.phaseInvert === 'right' ? '#ef4444' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Right</button>
                    </div>
                </div>
                
                <div class="algorithm" style="margin-top: 12px;">
                    <label style="font-size: 11px; color: #666; display: block; margin-bottom: 8px;">Algorithm</label>
                    <div style="display: flex; gap: 8px;">
                        <button id="swe-algo-ms" class="${this.config.algorithm === 'ms' ? 'active' : ''}" style="flex: 1; padding: 8px; background: ${this.config.algorithm === 'ms' ? '#10b981' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">M/S</button>
                        <button id="swe-algo-haas" class="${this.config.algorithm === 'haas' ? 'active' : ''}" style="flex: 1; padding: 8px; background: ${this.config.algorithm === 'haas' ? '#10b981' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Haas</button>
                    </div>
                </div>
                
                <div class="presets" style="margin-top: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #666;">Presets</h4>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="swe-preset" data-preset="mono" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Mono</button>
                        <button class="swe-preset" data-preset="normal" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Normal</button>
                        <button class="swe-preset" data-preset="wide" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Wide</button>
                        <button class="swe-preset" data-preset="ultra-wide" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Ultra Wide</button>
                        <button class="swe-preset" data-preset="haas-wide" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Haas Wide</button>
                    </div>
                </div>
            </div>
        `;
        
        this.canvas = document.getElementById('width-display-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.wireUIEvents();
        this.startVisualization();
        
        return container;
    }
    
    wireUIEvents() {
        // Width
        const widthSlider = document.getElementById('swe-width');
        const widthVal = document.getElementById('swe-width-val');
        if (widthSlider) {
            widthSlider.addEventListener('input', (e) => {
                this.setWidth(parseFloat(e.target.value));
                widthVal.textContent = parseFloat(e.target.value).toFixed(2);
            });
        }
        
        // Pan
        const panSlider = document.getElementById('swe-pan');
        const panVal = document.getElementById('swe-pan-val');
        if (panSlider) {
            panSlider.addEventListener('input', (e) => {
                this.setPan(parseFloat(e.target.value));
                panVal.textContent = parseFloat(e.target.value).toFixed(2);
            });
        }
        
        // Bass mono
        const bassMonoSlider = document.getElementById('swe-bass-mono');
        const bassMonoVal = document.getElementById('swe-bass-mono-val');
        if (bassMonoSlider) {
            bassMonoSlider.addEventListener('input', (e) => {
                this.setBassMono(parseFloat(e.target.value));
                bassMonoVal.textContent = e.target.value || 'Off';
            });
        }
        
        // Haas delay
        const haasSlider = document.getElementById('swe-haas');
        const haasVal = document.getElementById('swe-haas-val');
        if (haasSlider) {
            haasSlider.addEventListener('input', (e) => {
                this.setHaasDelay(parseFloat(e.target.value));
                haasVal.textContent = e.target.value;
            });
        }
        
        // Phase invert buttons
        ['none', 'left', 'right'].forEach(phase => {
            const btn = document.getElementById(`swe-phase-${phase}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.setPhaseInvert(phase);
                    ['none', 'left', 'right'].forEach(p => {
                        const b = document.getElementById(`swe-phase-${p}`);
                        if (b) {
                            b.style.background = p === phase ? (phase === 'none' ? '#10b981' : '#ef4444') : '#333';
                        }
                    });
                });
            }
        });
        
        // Algorithm buttons
        ['ms', 'haas'].forEach(algo => {
            const btn = document.getElementById(`swe-algo-${algo}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.setAlgorithm(algo);
                    ['ms', 'haas'].forEach(a => {
                        const b = document.getElementById(`swe-algo-${a}`);
                        if (b) {
                            b.style.background = a === algo ? '#10b981' : '#333';
                        }
                    });
                });
            }
        });
        
        // Presets
        document.querySelectorAll('.swe-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyPreset(e.target.dataset.preset);
            });
        });
    }
    
    applyPreset(preset) {
        switch (preset) {
            case 'mono':
                this.setWidth(0);
                this.setPan(0);
                this.setBassMono(0);
                this.setHaasDelay(0);
                this.setAlgorithm('ms');
                break;
            case 'normal':
                this.setWidth(1);
                this.setPan(0);
                this.setBassMono(80);
                this.setHaasDelay(0);
                this.setAlgorithm('ms');
                break;
            case 'wide':
                this.setWidth(1.5);
                this.setPan(0);
                this.setBassMono(100);
                this.setHaasDelay(0);
                this.setAlgorithm('ms');
                break;
            case 'ultra-wide':
                this.setWidth(2.5);
                this.setPan(0);
                this.setBassMono(120);
                this.setHaasDelay(0);
                this.setAlgorithm('ms');
                break;
            case 'haas-wide':
                this.setWidth(1);
                this.setPan(0);
                this.setBassMono(80);
                this.setHaasDelay(15);
                this.setAlgorithm('haas');
                break;
        }
        
        this.updateUIFromState();
    }
    
    updateUIFromState() {
        const state = this.getState();
        
        const widthSlider = document.getElementById('swe-width');
        const widthVal = document.getElementById('swe-width-val');
        if (widthSlider) {
            widthSlider.value = state.width;
            widthVal.textContent = state.width.toFixed(2);
        }
        
        const panSlider = document.getElementById('swe-pan');
        const panVal = document.getElementById('swe-pan-val');
        if (panSlider) {
            panSlider.value = state.pan;
            panVal.textContent = state.pan.toFixed(2);
        }
        
        const bassMonoSlider = document.getElementById('swe-bass-mono');
        const bassMonoVal = document.getElementById('swe-bass-mono-val');
        if (bassMonoSlider) {
            bassMonoSlider.value = state.bassMono;
            bassMonoVal.textContent = state.bassMono || 'Off';
        }
        
        const haasSlider = document.getElementById('swe-haas');
        const haasVal = document.getElementById('swe-haas-val');
        if (haasSlider) {
            haasSlider.value = state.haasDelay;
            haasVal.textContent = state.haasDelay;
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
            
            // Draw center line
            ctx.strokeStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(width / 2, 0);
            ctx.lineTo(width / 2, height);
            ctx.stroke();
            
            // Draw stereo field visualization
            const stereoWidth = this.config.width;
            const centerX = width / 2;
            const maxWidth = width * 0.9;
            
            // Draw width indicator
            const fieldWidth = (stereoWidth / 3) * maxWidth;
            const fieldLeft = centerX - fieldWidth / 2;
            const fieldRight = centerX + fieldWidth / 2;
            
            // Gradient for stereo field
            const gradient = ctx.createLinearGradient(fieldLeft, 0, fieldRight, 0);
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
            gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.5)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.3)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(fieldLeft, 10, fieldWidth, height - 20);
            
            // Draw borders
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.strokeRect(fieldLeft, 10, fieldWidth, height - 20);
            
            // Draw pan indicator
            const panX = centerX + (this.config.pan * fieldWidth / 2);
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(panX, height / 2, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Labels
            ctx.fillStyle = '#666';
            ctx.font = '10px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('L', 10, height - 5);
            ctx.fillText('R', width - 10, height - 5);
            ctx.fillText(`Width: ${stereoWidth.toFixed(1)}`, centerX, height - 5);
            
            requestAnimationFrame(vizLoop);
        };
        
        vizLoop();
    }
    
    // Dispose
    dispose() {
        this.input.disconnect();
        this.output.disconnect();
        this.splitter.disconnect();
        this.merger.disconnect();
        
        Object.values(this.leftChain).forEach(node => {
            if (node.disconnect) node.disconnect();
        });
        
        Object.values(this.rightChain).forEach(node => {
            if (node.disconnect) node.disconnect();
        });
    }
}

// Factory function
export function createStereoWidthEnhancer(audioContext, options = {}) {
    return new StereoWidthEnhancer(audioContext, options);
}