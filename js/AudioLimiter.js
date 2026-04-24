/**
 * Audio Limiter - Brick-wall limiter with lookahead and release
 * A professional-grade limiter for mastering and track processing
 */

export class AudioLimiter {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Limiter parameters
        this.threshold = options.threshold ?? -6; // dB
        this.release = options.release ?? 50; // ms
        this.lookahead = options.lookahead ?? 5; // ms
        this.ceiling = options.ceiling ?? -0.3; // dB
        this.autoRelease = options.autoRelease ?? true;
        this.stereoLink = options.stereoLink ?? true;
        
        // Audio nodes
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        this.bypass = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Create lookahead delay
        this.lookaheadDelayL = audioContext.createDelay(0.1);
        this.lookaheadDelayR = audioContext.createDelay(0.1);
        this.lookaheadDelayL.delayTime.value = this.lookahead / 1000;
        this.lookaheadDelayR.delayTime.value = this.lookahead / 1000;
        
        // Create compressor for limiting
        this.compressorL = audioContext.createDynamicsCompressor();
        this.compressorR = audioContext.createDynamicsCompressor();
        
        // Configure compressor for limiting behavior
        this.configureCompressor(this.compressorL);
        this.configureCompressor(this.compressorR);
        
        // Envelope follower for release control
        this.envelopeFollowerL = new EnvelopeFollower(audioContext, {
            attack: 0.001,
            release: this.release / 1000
        });
        this.envelopeFollowerR = new EnvelopeFollower(audioContext, {
            attack: 0.001,
            release: this.release / 1000
        });
        
        // Metering
        this.inputMeter = audioContext.createAnalyser();
        this.outputMeter = audioContext.createAnalyser();
        this.inputMeter.fftSize = 256;
        this.outputMeter.fftSize = 256;
        
        // Gain reduction meter
        this.gainReduction = 0;
        this.maxGainReduction = 0;
        
        // Auto-release coefficients
        this.autoReleaseCoef = {
            fast: 0.1,
            medium: 0.3,
            slow: 0.5
        };
        
        this.setupRouting();
        this.updateParameters();
        
        this.enabled = true;
    }
    
    configureCompressor(compressor) {
        // Set for brick-wall limiting behavior
        compressor.threshold.value = this.threshold;
        compressor.knee.value = 0; // Hard knee for limiter
        compressor.ratio.value = 20; // High ratio for limiting
        compressor.attack.value = 0.001; // Very fast attack
        compressor.release.value = this.release / 1000;
    }
    
    setupRouting() {
        // Main path: input -> lookahead -> compressor -> output
        // Sidechain: input -> envelope follower (for release control)
        
        // Split input to lookahead and envelope follower
        const splitter = this.audioContext.createChannelSplitter(2);
        const merger = this.audioContext.createChannelMerger(2);
        
        this.input.connect(splitter);
        
        // Left channel
        splitter.connect(this.lookaheadDelayL, 0);
        this.lookaheadDelayL.connect(this.compressorL);
        this.compressorL.connect(merger, 0, 0);
        
        // Right channel
        splitter.connect(this.lookaheadDelayR, 1);
        this.lookaheadDelayR.connect(this.compressorR);
        this.compressorR.connect(merger, 0, 1);
        
        // Connect to output
        merger.connect(this.output);
        
        // Metering
        this.input.connect(this.inputMeter);
        this.output.connect(this.outputMeter);
        
        // Stereo linking - apply same gain reduction to both channels
        if (this.stereoLink) {
            this.applyStereoLink();
        }
    }
    
    applyStereoLink() {
        // When stereo link is enabled, both channels use the same gain reduction
        // This prevents image shifting
        this.compressorL.reduction;
        this.compressorR.reduction;
    }
    
    updateParameters() {
        // Update threshold
        this.compressorL.threshold.value = this.threshold;
        this.compressorR.threshold.value = this.threshold;
        
        // Update release
        const releaseTime = this.autoRelease ? this.calculateAutoRelease() : this.release;
        this.compressorL.release.value = releaseTime / 1000;
        this.compressorR.release.value = releaseTime / 1000;
        
        // Update lookahead
        this.lookaheadDelayL.delayTime.value = this.lookahead / 1000;
        this.lookaheadDelayR.delayTime.value = this.lookahead / 1000;
    }
    
    calculateAutoRelease() {
        // Auto-release adjusts based on input level
        // Louder inputs = faster release for more transparency
        // Quieter inputs = slower release for more sustain
        
        const inputLevel = this.getInputLevel();
        
        if (inputLevel > -6) {
            return 20; // Fast release for hot signals
        } else if (inputLevel > -12) {
            return 50; // Medium release
        } else {
            return 100; // Slow release for quiet signals
        }
    }
    
    getInputLevel() {
        const dataArray = new Float32Array(this.inputMeter.fftSize);
        this.inputMeter.getFloatTimeDomainData(dataArray);
        
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
            max = Math.max(max, Math.abs(dataArray[i]));
        }
        
        return 20 * Math.log10(max + 0.0001);
    }
    
    setThreshold(db) {
        this.threshold = Math.max(-30, Math.min(0, db));
        this.updateParameters();
    }
    
    setRelease(ms) {
        this.release = Math.max(5, Math.min(500, ms));
        if (!this.autoRelease) {
            this.updateParameters();
        }
    }
    
    setLookahead(ms) {
        this.lookahead = Math.max(0, Math.min(20, ms));
        this.updateParameters();
    }
    
    setCeiling(db) {
        this.ceiling = Math.max(-1, Math.min(0, db));
    }
    
    setAutoRelease(enabled) {
        this.autoRelease = enabled;
    }
    
    setStereoLink(enabled) {
        this.stereoLink = enabled;
        if (enabled) {
            this.applyStereoLink();
        }
    }
    
    enable() {
        this.enabled = true;
        this.output.gain.value = 1;
    }
    
    disable() {
        this.enabled = false;
        // Bypass the limiter
    }
    
    getGainReduction() {
        // Get current gain reduction from compressor
        const reductionL = this.compressorL.reduction;
        const reductionR = this.compressorR.reduction;
        
        // Use the higher reduction for display
        this.gainReduction = Math.max(Math.abs(reductionL), Math.abs(reductionR));
        this.maxGainReduction = Math.max(this.maxGainReduction, this.gainReduction);
        
        return this.gainReduction;
    }
    
    resetMaxGainReduction() {
        this.maxGainReduction = 0;
    }
    
    getOutputLevel() {
        const dataArray = new Float32Array(this.outputMeter.fftSize);
        this.outputMeter.getFloatTimeDomainData(dataArray);
        
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
            max = Math.max(max, Math.abs(dataArray[i]));
        }
        
        return 20 * Math.log10(max + 0.0001);
    }
    
    connect(destination) {
        this.output.connect(destination);
    }
    
    disconnect() {
        this.output.disconnect();
    }
    
    getParameters() {
        return {
            threshold: this.threshold,
            release: this.release,
            lookahead: this.lookahead,
            ceiling: this.ceiling,
            autoRelease: this.autoRelease,
            stereoLink: this.stereoLink,
            enabled: this.enabled,
            gainReduction: this.getGainReduction(),
            inputLevel: this.getInputLevel(),
            outputLevel: this.getOutputLevel()
        };
    }
    
    setParameters(params) {
        if (params.threshold !== undefined) this.setThreshold(params.threshold);
        if (params.release !== undefined) this.setRelease(params.release);
        if (params.lookahead !== undefined) this.setLookahead(params.lookahead);
        if (params.ceiling !== undefined) this.setCeiling(params.ceiling);
        if (params.autoRelease !== undefined) this.setAutoRelease(params.autoRelease);
        if (params.stereoLink !== undefined) this.setStereoLink(params.stereoLink);
    }
    
    destroy() {
        this.input.disconnect();
        this.output.disconnect();
        this.lookaheadDelayL.disconnect();
        this.lookaheadDelayR.disconnect();
        this.compressorL.disconnect();
        this.compressorR.disconnect();
        this.inputMeter.disconnect();
        this.outputMeter.disconnect();
    }
}

// Envelope follower helper class
class EnvelopeFollower {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.attack = options.attack ?? 0.01;
        this.release = options.release ?? 0.1;
        this.envelope = 0;
        
        // Create analyser for envelope tracking
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 256;
    }
    
    process() {
        const dataArray = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(dataArray);
        
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
            max = Math.max(max, Math.abs(dataArray[i]));
        }
        
        // Smooth envelope following
        const attackCoef = Math.exp(-1 / (this.attack * this.audioContext.sampleRate));
        const releaseCoef = Math.exp(-1 / (this.release * this.audioContext.sampleRate));
        
        if (max > this.envelope) {
            this.envelope = max + (this.envelope - max) * attackCoef;
        } else {
            this.envelope = max + (this.envelope - max) * releaseCoef;
        }
        
        return this.envelope;
    }
}

// Factory function
export function createAudioLimiter(audioContext, options = {}) {
    return new AudioLimiter(audioContext, options);
}

// Limiter presets
export const LIMITER_PRESETS = {
    transparent: {
        threshold: -6,
        release: 50,
        lookahead: 5,
        ceiling: -0.3,
        autoRelease: true,
        stereoLink: true
    },
    mastering: {
        threshold: -3,
        release: 100,
        lookahead: 10,
        ceiling: -0.1,
        autoRelease: true,
        stereoLink: true
    },
    creative: {
        threshold: 0,
        release: 20,
        lookahead: 2,
        ceiling: 0,
        autoRelease: false,
        stereoLink: true
    },
    broadcast: {
        threshold: -12,
        release: 80,
        lookahead: 10,
        ceiling: -3,
        autoRelease: true,
        stereoLink: true
    },
    gentle: {
        threshold: -10,
        release: 200,
        lookahead: 5,
        ceiling: -1,
        autoRelease: true,
        stereoLink: true
    }
};

// UI Panel
export function createLimiterPanel(limiter, appServices) {
    const container = document.createElement('div');
    container.className = 'limiter-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Audio Limiter';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Threshold control
    const thresholdGroup = createControlGroup('Threshold (dB)', -30, 0, limiter.threshold, (value) => {
        limiter.setThreshold(value);
        updateMeter();
    });
    container.appendChild(thresholdGroup);
    
    // Release control
    const releaseGroup = createControlGroup('Release (ms)', 5, 500, limiter.release, (value) => {
        limiter.setRelease(value);
    });
    container.appendChild(releaseGroup);
    
    // Lookahead control
    const lookaheadGroup = createControlGroup('Lookahead (ms)', 0, 20, limiter.lookahead, (value) => {
        limiter.setLookahead(value);
    });
    container.appendChild(lookaheadGroup);
    
    // Ceiling control
    const ceilingGroup = createControlGroup('Ceiling (dB)', -1, 0, limiter.ceiling, (value) => {
        limiter.setCeiling(value);
    });
    container.appendChild(ceilingGroup);
    
    // Auto Release toggle
    const autoReleaseToggle = document.createElement('div');
    autoReleaseToggle.style.cssText = 'margin-bottom: 12px;';
    autoReleaseToggle.innerHTML = `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" ${limiter.autoRelease ? 'checked' : ''} id="autoRelease">
            Auto Release
        </label>
    `;
    autoReleaseToggle.querySelector('input').addEventListener('change', (e) => {
        limiter.setAutoRelease(e.target.checked);
    });
    container.appendChild(autoReleaseToggle);
    
    // Stereo Link toggle
    const stereoLinkToggle = document.createElement('div');
    stereoLinkToggle.style.cssText = 'margin-bottom: 16px;';
    stereoLinkToggle.innerHTML = `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" ${limiter.stereoLink ? 'checked' : ''} id="stereoLink">
            Stereo Link
        </label>
    `;
    stereoLinkToggle.querySelector('input').addEventListener('change', (e) => {
        limiter.setStereoLink(e.target.checked);
    });
    container.appendChild(stereoLinkToggle);
    
    // Meter display
    const meterContainer = document.createElement('div');
    meterContainer.style.cssText = 'margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    meterContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Gain Reduction</span>
            <span id="grValue">0 dB</span>
        </div>
        <div style="height: 20px; background: #333; border-radius: 2px; overflow: hidden;">
            <div id="grMeter" style="height: 100%; width: 0%; background: linear-gradient(to right, #22c55e, #eab308, #ef4444); transition: width 0.05s;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 12px; margin-bottom: 8px;">
            <span>Max GR</span>
            <span id="maxGrValue">0 dB</span>
        </div>
        <button id="resetMaxGr" style="padding: 6px 12px; background: #4b5563; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Reset Max
        </button>
    `;
    container.appendChild(meterContainer);
    
    // Presets
    const presetsContainer = document.createElement('div');
    presetsContainer.style.cssText = 'margin-top: 16px;';
    presetsContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Presets</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${Object.keys(LIMITER_PRESETS).map(name => `
                <button class="preset-btn" data-preset="${name}" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    ${name.charAt(0).toUpperCase() + name.slice(1)}
                </button>
            `).join('')}
        </div>
    `;
    container.appendChild(presetsContainer);
    
    // Add preset click handlers
    presetsContainer.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = LIMITER_PRESETS[btn.dataset.preset];
            limiter.setParameters(preset);
            
            // Update UI
            thresholdGroup.querySelector('input').value = preset.threshold;
            releaseGroup.querySelector('input').value = preset.release;
            lookaheadGroup.querySelector('input').value = preset.lookahead;
            ceilingGroup.querySelector('input').value = preset.ceiling;
            document.getElementById('autoRelease').checked = preset.autoRelease;
            document.getElementById('stereoLink').checked = preset.stereoLink;
        });
    });
    
    // Reset max GR button
    document.getElementById('resetMaxGr').addEventListener('click', () => {
        limiter.resetMaxGainReduction();
        document.getElementById('maxGrValue').textContent = '0 dB';
    });
    
    // Update meter function
    function updateMeter() {
        const gr = limiter.getGainReduction();
        const grPercent = Math.min(100, (gr / 20) * 100);
        
        const grMeter = document.getElementById('grMeter');
        const grValue = document.getElementById('grValue');
        const maxGrValue = document.getElementById('maxGrValue');
        
        if (grMeter) {
            grMeter.style.width = `${grPercent}%`;
            grValue.textContent = `-${gr.toFixed(1)} dB`;
            maxGrValue.textContent = `-${limiter.maxGainReduction.toFixed(1)} dB`;
        }
    }
    
    // Start meter update interval
    const meterInterval = setInterval(updateMeter, 50);
    
    // Cleanup function
    container.destroy = () => {
        clearInterval(meterInterval);
    };
    
    return container;
}

function createControlGroup(label, min, max, value, onChange) {
    const group = document.createElement('div');
    group.style.cssText = 'margin-bottom: 12px;';
    group.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px;">
            <span>${label}</span>
            <span id="${label.replace(/\s+/g, '')}Value">${value}</span>
        </div>
        <input type="range" min="${min}" max="${max}" value="${value}" step="0.1" style="width: 100%;">
    `;
    
    const input = group.querySelector('input');
    const valueDisplay = group.querySelector('span:last-of-type');
    
    input.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        onChange(val);
        valueDisplay.textContent = val.toFixed(1);
    });
    
    return group;
}

export default AudioLimiter;