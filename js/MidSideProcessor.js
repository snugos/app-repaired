/**
 * Mid-Side Processor - Stereo manipulation using M/S encoding
 * Allows independent processing of mid (mono) and side (stereo) components
 */

export class MidSideProcessor {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            midGain: options.midGain ?? 0,      // dB
            sideGain: options.sideGain ?? 0,    // dB
            midWidth: options.midWidth ?? 1,    // Multiplier
            sideWidth: options.sideWidth ?? 1,  // Multiplier
            monoLowFreq: options.monoLowFreq ?? 0, // Hz (0 = disabled)
            soloMid: options.soloMid ?? false,
            soloSide: options.soloSide ?? false,
            ...options
        };
        
        // Create audio nodes
        this.createNodes();
        
        // State
        this.isEnabled = true;
        this.bypassed = false;
    }
    
    createNodes() {
        // Input
        this.input = this.audioContext.createGain();
        
        // Encoder (stereo -> mid/side)
        this.encoder = {
            splitter: this.audioContext.createChannelSplitter(2),
            
            // Mid = (L + R) / 2
            leftPlusRight: this.audioContext.createGain(),
            rightPlusMid: this.audioContext.createGain(),
            midGain: this.audioContext.createGain(),
            
            // Side = (L - R) / 2
            leftMinusRight: this.audioContext.createGain(),
            rightMinusSide: this.audioContext.createGain(),
            sideGain: this.audioContext.createGain(),
        };
        
        // Mid/Side processing chains
        this.midChain = {
            input: this.audioContext.createGain(),
            gain: this.audioContext.createGain(),
            width: this.audioContext.createGain(),
            solo: this.audioContext.createGain(),
            output: this.audioContext.createGain(),
            // Mono bass option
            lowPass: this.audioContext.createBiquadFilter()
        };
        
        this.sideChain = {
            input: this.audioContext.createGain(),
            gain: this.audioContext.createGain(),
            width: this.audioContext.createGain(),
            solo: this.audioContext.createGain(),
            output: this.audioContext.createGain(),
            // High-pass to avoid DC offset
            highPass: this.audioContext.createBiquadFilter()
        };
        
        // Decoder (mid/side -> stereo)
        this.decoder = {
            // Left = Mid + Side
            midToLeft: this.audioContext.createGain(),
            sideToLeft: this.audioContext.createGain(),
            leftSum: this.audioContext.createGain(),
            
            // Right = Mid - Side
            midToRight: this.audioContext.createGain(),
            sideToRight: this.audioContext.createGain(),
            rightSum: this.audioContext.createGain(),
            
            merger: this.audioContext.createChannelMerger(2)
        };
        
        // Output
        this.output = this.audioContext.createGain();
        
        // Configure filters
        this.midChain.lowPass.type = 'lowpass';
        this.midChain.lowPass.frequency.value = 20000; // Effectively off
        this.midChain.lowPass.Q.value = 0.7;
        
        this.sideChain.highPass.type = 'highpass';
        this.sideChain.highPass.frequency.value = 20; // Remove subsonic
        this.sideChain.highPass.Q.value = 0.7;
        
        // Wire encoder
        this.wireEncoder();
        
        // Wire mid chain
        this.wireMidChain();
        
        // Wire side chain
        this.wireSideChain();
        
        // Wire decoder
        this.wireDecoder();
        
        // Apply initial config
        this.applyConfig();
    }
    
    wireEncoder() {
        // Split stereo
        this.input.connect(this.encoder.splitter);
        
        // Mid encoding: L + R
        this.encoder.splitter.connect(this.encoder.leftPlusRight, 0);
        this.encoder.splitter.connect(this.encoder.rightPlusMid, 1);
        this.encoder.leftPlusRight.gain.value = 0.5;
        this.encoder.rightPlusMid.gain.value = 0.5;
        
        // Sum to mid
        this.encoder.leftPlusRight.connect(this.encoder.midGain);
        this.encoder.rightPlusMid.connect(this.encoder.midGain);
        this.encoder.midGain.gain.value = 1.0;
        
        // Side encoding: L - R
        this.encoder.splitter.connect(this.encoder.leftMinusRight, 0);
        this.encoder.splitter.connect(this.encoder.rightMinusSide, 1);
        this.encoder.leftMinusRight.gain.value = 0.5;
        this.encoder.rightMinusSide.gain.value = -0.5; // Invert for subtraction
        
        // Sum to side
        this.encoder.leftMinusRight.connect(this.encoder.sideGain);
        this.encoder.rightMinusSide.connect(this.encoder.sideGain);
        this.encoder.sideGain.gain.value = 1.0;
    }
    
    wireMidChain() {
        // Connect encoder to mid chain
        this.encoder.midGain.connect(this.midChain.input);
        
        // Wire chain: input -> gain -> width -> solo -> output
        this.midChain.input.connect(this.midChain.gain);
        this.midChain.gain.connect(this.midChain.lowPass);
        this.midChain.lowPass.connect(this.midChain.width);
        this.midChain.width.connect(this.midChain.solo);
        this.midChain.solo.connect(this.midChain.output);
        
        // Set initial values
        this.midChain.gain.gain.value = 1.0;
        this.midChain.width.gain.value = 1.0;
        this.midChain.solo.gain.value = 1.0;
    }
    
    wireSideChain() {
        // Connect encoder to side chain
        this.encoder.sideGain.connect(this.sideChain.input);
        
        // Wire chain
        this.sideChain.input.connect(this.sideChain.highPass);
        this.sideChain.highPass.connect(this.sideChain.gain);
        this.sideChain.gain.connect(this.sideChain.width);
        this.sideChain.width.connect(this.sideChain.solo);
        this.sideChain.solo.connect(this.sideChain.output);
        
        // Set initial values
        this.sideChain.gain.gain.value = 1.0;
        this.sideChain.width.gain.value = 1.0;
        this.sideChain.solo.gain.value = 1.0;
    }
    
    wireDecoder() {
        // Left = Mid + Side
        this.midChain.output.connect(this.decoder.midToLeft);
        this.sideChain.output.connect(this.decoder.sideToLeft);
        this.decoder.midToLeft.connect(this.decoder.leftSum);
        this.decoder.sideToLeft.connect(this.decoder.leftSum);
        this.decoder.midToLeft.gain.value = 1.0;
        this.decoder.sideToLeft.gain.value = 1.0;
        
        // Right = Mid - Side
        this.midChain.output.connect(this.decoder.midToRight);
        this.sideChain.output.connect(this.decoder.sideToRight);
        this.decoder.midToRight.connect(this.decoder.rightSum);
        this.decoder.sideToRight.connect(this.decoder.rightSum);
        this.decoder.midToRight.gain.value = 1.0;
        this.decoder.sideToRight.gain.value = -1.0; // Invert
        
        // Merge back to stereo
        this.decoder.leftSum.connect(this.decoder.merger, 0, 0);
        this.decoder.rightSum.connect(this.decoder.merger, 0, 1);
        
        // Connect to output
        this.decoder.merger.connect(this.output);
    }
    
    applyConfig() {
        this.setMidGain(this.config.midGain);
        this.setSideGain(this.config.sideGain);
        this.setMidWidth(this.config.midWidth);
        this.setSideWidth(this.config.sideWidth);
        this.setMonoLowFreq(this.config.monoLowFreq);
        this.setSoloMid(this.config.soloMid);
        this.setSoloSide(this.config.soloSide);
    }
    
    // Mid gain in dB
    setMidGain(db) {
        this.config.midGain = db;
        const linear = Math.pow(10, db / 20);
        this.midChain.gain.gain.setTargetAtTime(linear, this.audioContext.currentTime, 0.01);
    }
    
    // Side gain in dB
    setSideGain(db) {
        this.config.sideGain = db;
        const linear = Math.pow(10, db / 20);
        this.sideChain.gain.gain.setTargetAtTime(linear, this.audioContext.currentTime, 0.01);
    }
    
    // Mid width multiplier
    setMidWidth(width) {
        this.config.midWidth = width;
        this.midChain.width.gain.setTargetAtTime(width, this.audioContext.currentTime, 0.01);
    }
    
    // Side width multiplier
    setSideWidth(width) {
        this.config.sideWidth = width;
        this.sideChain.width.gain.setTargetAtTime(width, this.audioContext.currentTime, 0.01);
    }
    
    // Mono bass frequency (frequencies below this are mono)
    setMonoLowFreq(freq) {
        this.config.monoLowFreq = freq;
        if (freq > 0) {
            this.midChain.lowPass.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01);
            // Low frequencies go to mid only
        } else {
            this.midChain.lowPass.frequency.setTargetAtTime(20000, this.audioContext.currentTime, 0.01);
        }
    }
    
    // Solo mid (mute side)
    setSoloMid(solo) {
        this.config.soloMid = solo;
        if (solo) {
            this.midChain.solo.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
            this.sideChain.solo.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
            this.config.soloSide = false;
        } else if (!this.config.soloSide) {
            this.midChain.solo.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
            this.sideChain.solo.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
        }
    }
    
    // Solo side (mute mid)
    setSoloSide(solo) {
        this.config.soloSide = solo;
        if (solo) {
            this.midChain.solo.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
            this.sideChain.solo.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
            this.config.soloMid = false;
        } else if (!this.config.soloMid) {
            this.midChain.solo.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
            this.sideChain.solo.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
        }
    }
    
    // Swap channels (invert phase)
    swapChannels(swap) {
        if (swap) {
            this.decoder.sideToLeft.gain.setTargetAtTime(-1, this.audioContext.currentTime, 0.01);
            this.decoder.sideToRight.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
        } else {
            this.decoder.sideToLeft.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
            this.decoder.sideToRight.gain.setTargetAtTime(-1, this.audioContext.currentTime, 0.01);
        }
    }
    
    // Stereo width (combined control)
    setStereoWidth(width) {
        // Width 0 = mono, 1 = normal, 2 = double width
        const midGain = 1;
        const sideGain = width;
        
        this.config.midWidth = midGain;
        this.config.sideWidth = sideGain;
        
        this.midChain.width.gain.setTargetAtTime(midGain, this.audioContext.currentTime, 0.01);
        this.sideChain.width.gain.setTargetAtTime(sideGain, this.audioContext.currentTime, 0.01);
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
            this.input.connect(this.encoder.splitter);
        }
    }
    
    // Connect input
    connectInput(source) {
        source.connect(this.input);
    }
    
    // Get output for connection
    connect(destination) {
        this.output.connect(destination);
        return this;
    }
    
    // Get input node
    getInput() {
        return this.input;
    }
    
    // Get output node
    getOutput() {
        return this.output;
    }
    
    // Get current state
    getState() {
        return {
            midGain: this.config.midGain,
            sideGain: this.config.sideGain,
            midWidth: this.config.midWidth,
            sideWidth: this.config.sideWidth,
            monoLowFreq: this.config.monoLowFreq,
            soloMid: this.config.soloMid,
            soloSide: this.config.soloSide,
            bypassed: this.bypassed
        };
    }
    
    // Create UI panel
    createUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        
        container.innerHTML = `
            <div class="midside-processor" style="background: #1a1a2e; padding: 16px; border-radius: 8px; color: white; font-family: system-ui;">
                <h3 style="margin: 0 0 16px 0; font-size: 14px; color: #888;">Mid-Side Processor</h3>
                
                <div class="controls-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div class="mid-controls">
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #10b981;">Mid (Mono)</h4>
                        <div class="control-row" style="margin-bottom: 8px;">
                            <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Gain (dB)</label>
                            <input type="range" id="ms-mid-gain" min="-24" max="24" value="${this.config.midGain}" step="0.5" style="width: 100%;">
                            <span id="ms-mid-gain-val" style="font-size: 11px; color: #888;">${this.config.midGain}</span>
                        </div>
                        <div class="control-row">
                            <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Width</label>
                            <input type="range" id="ms-mid-width" min="0" max="2" value="${this.config.midWidth}" step="0.01" style="width: 100%;">
                            <span id="ms-mid-width-val" style="font-size: 11px; color: #888;">${this.config.midWidth}</span>
                        </div>
                    </div>
                    
                    <div class="side-controls">
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #f59e0b;">Side (Stereo)</h4>
                        <div class="control-row" style="margin-bottom: 8px;">
                            <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Gain (dB)</label>
                            <input type="range" id="ms-side-gain" min="-24" max="24" value="${this.config.sideGain}" step="0.5" style="width: 100%;">
                            <span id="ms-side-gain-val" style="font-size: 11px; color: #888;">${this.config.sideGain}</span>
                        </div>
                        <div class="control-row">
                            <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Width</label>
                            <input type="range" id="ms-side-width" min="0" max="2" value="${this.config.sideWidth}" step="0.01" style="width: 100%;">
                            <span id="ms-side-width-val" style="font-size: 11px; color: #888;">${this.config.sideWidth}</span>
                        </div>
                    </div>
                </div>
                
                <div class="additional-controls" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #333;">
                    <div class="control-row" style="margin-bottom: 8px;">
                        <label style="font-size: 11px; color: #666; display: block; margin-bottom: 4px;">Mono Bass (Hz)</label>
                        <input type="range" id="ms-mono-bass" min="0" max="500" value="${this.config.monoLowFreq}" step="10" style="width: 100%;">
                        <span id="ms-mono-bass-val" style="font-size: 11px; color: #888;">${this.config.monoLowFreq || 'Off'}</span>
                    </div>
                    
                    <div class="solo-buttons" style="display: flex; gap: 8px; margin-top: 12px;">
                        <button id="ms-solo-mid" class="${this.config.soloMid ? 'active' : ''}" style="flex: 1; padding: 8px; background: ${this.config.soloMid ? '#10b981' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            Solo Mid
                        </button>
                        <button id="ms-solo-side" class="${this.config.soloSide ? 'active' : ''}" style="flex: 1; padding: 8px; background: ${this.config.soloSide ? '#f59e0b' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            Solo Side
                        </button>
                        <button id="ms-bypass" style="flex: 1; padding: 8px; background: ${this.bypassed ? '#ef4444' : '#333'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            ${this.bypassed ? 'Bypassed' : 'Bypass'}
                        </button>
                    </div>
                </div>
                
                <div class="presets" style="margin-top: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #666;">Presets</h4>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="ms-preset" data-preset="widen" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Widen</button>
                        <button class="ms-preset" data-preset="narrow" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Narrow</button>
                        <button class="ms-preset" data-preset="mono" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Mono</button>
                        <button class="ms-preset" data-preset="vocal-enhance" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Vocal Enhance</button>
                        <button class="ms-preset" data-preset="bass-center" style="padding: 6px 12px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Bass Center</button>
                    </div>
                </div>
            </div>
        `;
        
        this.wireUIEvents();
        return container;
    }
    
    wireUIEvents() {
        // Mid gain
        const midGainSlider = document.getElementById('ms-mid-gain');
        const midGainVal = document.getElementById('ms-mid-gain-val');
        if (midGainSlider) {
            midGainSlider.addEventListener('input', (e) => {
                this.setMidGain(parseFloat(e.target.value));
                midGainVal.textContent = e.target.value;
            });
        }
        
        // Mid width
        const midWidthSlider = document.getElementById('ms-mid-width');
        const midWidthVal = document.getElementById('ms-mid-width-val');
        if (midWidthSlider) {
            midWidthSlider.addEventListener('input', (e) => {
                this.setMidWidth(parseFloat(e.target.value));
                midWidthVal.textContent = e.target.value;
            });
        }
        
        // Side gain
        const sideGainSlider = document.getElementById('ms-side-gain');
        const sideGainVal = document.getElementById('ms-side-gain-val');
        if (sideGainSlider) {
            sideGainSlider.addEventListener('input', (e) => {
                this.setSideGain(parseFloat(e.target.value));
                sideGainVal.textContent = e.target.value;
            });
        }
        
        // Side width
        const sideWidthSlider = document.getElementById('ms-side-width');
        const sideWidthVal = document.getElementById('ms-side-width-val');
        if (sideWidthSlider) {
            sideWidthSlider.addEventListener('input', (e) => {
                this.setSideWidth(parseFloat(e.target.value));
                sideWidthVal.textContent = e.target.value;
            });
        }
        
        // Mono bass
        const monoBassSlider = document.getElementById('ms-mono-bass');
        const monoBassVal = document.getElementById('ms-mono-bass-val');
        if (monoBassSlider) {
            monoBassSlider.addEventListener('input', (e) => {
                this.setMonoLowFreq(parseFloat(e.target.value));
                monoBassVal.textContent = e.target.value || 'Off';
            });
        }
        
        // Solo buttons
        const soloMidBtn = document.getElementById('ms-solo-mid');
        const soloSideBtn = document.getElementById('ms-solo-side');
        const bypassBtn = document.getElementById('ms-bypass');
        
        if (soloMidBtn) {
            soloMidBtn.addEventListener('click', () => {
                this.setSoloMid(!this.config.soloMid);
                soloMidBtn.style.background = this.config.soloMid ? '#10b981' : '#333';
                soloMidBtn.classList.toggle('active', this.config.soloMid);
                if (soloSideBtn) {
                    soloSideBtn.style.background = '#333';
                    soloSideBtn.classList.remove('active');
                }
            });
        }
        
        if (soloSideBtn) {
            soloSideBtn.addEventListener('click', () => {
                this.setSoloSide(!this.config.soloSide);
                soloSideBtn.style.background = this.config.soloSide ? '#f59e0b' : '#333';
                soloSideBtn.classList.toggle('active', this.config.soloSide);
                if (soloMidBtn) {
                    soloMidBtn.style.background = '#333';
                    soloMidBtn.classList.remove('active');
                }
            });
        }
        
        if (bypassBtn) {
            bypassBtn.addEventListener('click', () => {
                this.setBypass(!this.bypassed);
                bypassBtn.style.background = this.bypassed ? '#ef4444' : '#333';
                bypassBtn.textContent = this.bypassed ? 'Bypassed' : 'Bypass';
            });
        }
        
        // Presets
        document.querySelectorAll('.ms-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyPreset(e.target.dataset.preset);
            });
        });
    }
    
    applyPreset(preset) {
        switch (preset) {
            case 'widen':
                this.setMidGain(0);
                this.setSideGain(3);
                this.setMidWidth(1);
                this.setSideWidth(1.5);
                this.setMonoLowFreq(80);
                break;
            case 'narrow':
                this.setMidGain(0);
                this.setSideGain(-6);
                this.setMidWidth(1);
                this.setSideWidth(0.5);
                this.setMonoLowFreq(0);
                break;
            case 'mono':
                this.setMidGain(0);
                this.setSideGain(-60);
                this.setMidWidth(1);
                this.setSideWidth(0);
                this.setMonoLowFreq(0);
                break;
            case 'vocal-enhance':
                this.setMidGain(2);
                this.setSideGain(-2);
                this.setMidWidth(1);
                this.setSideWidth(0.8);
                this.setMonoLowFreq(100);
                break;
            case 'bass-center':
                this.setMidGain(0);
                this.setSideGain(0);
                this.setMidWidth(1);
                this.setSideWidth(1);
                this.setMonoLowFreq(200);
                break;
        }
        
        // Update UI
        this.updateUIFromState();
    }
    
    updateUIFromState() {
        const state = this.getState();
        
        ['mid-gain', 'mid-width', 'side-gain', 'side-width', 'mono-bass'].forEach(param => {
            const slider = document.getElementById(`ms-${param}`);
            const val = document.getElementById(`ms-${param}-val`);
            if (slider && val) {
                const key = param === 'mono-bass' ? 'monoLowFreq' : param.replace('-', '').replace('mid', 'mid').replace('side', 'side');
                slider.value = state[key === 'monobass' ? 'monoLowFreq' : key];
                val.textContent = state[key === 'monobass' ? 'monoLowFreq' : key] || 'Off';
            }
        });
    }
    
    // Dispose
    dispose() {
        // Disconnect all nodes
        this.input.disconnect();
        this.output.disconnect();
        
        Object.values(this.encoder).forEach(node => {
            if (node.disconnect) node.disconnect();
        });
        
        Object.values(this.midChain).forEach(node => {
            if (node.disconnect) node.disconnect();
        });
        
        Object.values(this.sideChain).forEach(node => {
            if (node.disconnect) node.disconnect();
        });
        
        Object.values(this.decoder).forEach(node => {
            if (node.disconnect) node.disconnect();
        });
    }
}

// Factory function
export function createMidSideProcessor(audioContext, options = {}) {
    return new MidSideProcessor(audioContext, options);
}
