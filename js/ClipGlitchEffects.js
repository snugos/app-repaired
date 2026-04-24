/**
 * Clip Glitch Effects - Rhythmic glitch artifacts for lo-fi aesthetics
 */

export class ClipGlitchEffects {
    constructor(options = {}) {
        this.clipId = options.clipId || null;
        this.audioContext = options.audioContext || null;
        this.enabled = options.enabled ?? false;
        
        // Glitch parameters
        this.settings = {
            // Stutter
            stutterEnabled: options.stutterEnabled ?? false,
            stutterRate: options.stutterRate ?? 8, // Hz (repeats per second)
            stutterLength: options.stutterLength ?? 0.125, // seconds
            stutterProbability: options.stutterProbability ?? 0.5,
            
            // Bitcrush
            bitcrushEnabled: options.bitcrushEnabled ?? false,
            bitcrushBits: options.bitcrushBits ?? 8,
            bitcrushSampleRate: options.bitcrushSampleRate ?? 22050,
            
            // Reverse
            reverseEnabled: options.reverseEnabled ?? false,
            reverseProbability: options.reverseProbability ?? 0.2,
            
            // Tape stop
            tapeStopEnabled: options.tapeStopEnabled ?? false,
            tapeStopSpeed: options.tapeStopSpeed ?? 0.1, // How fast to slow down
            tapeStopDepth: options.tapeStopDepth ?? 0.5,
            
            // Lo-fi
            lofiEnabled: options.lofiEnabled ?? false,
            lofiNoiseAmount: options.lofiNoiseAmount ?? 0.1,
            lofiLowpassFreq: options.lofiLowpassFreq ?? 3000,
            
            // Granular
            granularEnabled: options.granularEnabled ?? false,
            granularSize: options.granularSize ?? 0.05,
            granularRate: options.granularRate ?? 10,
            granularRandomize: options.granularRandomize ?? 0.5,
            
            // Gate
            gateEnabled: options.gateEnabled ?? false,
            gateThreshold: options.gateThreshold ?? -40,
            gateAttack: options.gateAttack ?? 0.001,
            gateRelease: options.gateRelease ?? 0.05,
            
            // Random
            randomizeEnabled: options.randomizeEnabled ?? false,
            randomizeIntensity: options.randomizeIntensity ?? 0.3
        };
        
        // Audio nodes
        this.inputNode = null;
        this.outputNode = null;
        this.bitcrushNode = null;
        this.lowpassNode = null;
        this.noiseNode = null;
        this.gateNode = null;
        
        // Presets
        this.presets = [
            { name: 'Light Glitch', stutterEnabled: true, stutterProbability: 0.2, bitcrushBits: 12 },
            { name: 'Medium Glitch', stutterEnabled: true, bitcrushEnabled: true, bitcrushBits: 8, reverseProbability: 0.3 },
            { name: 'Heavy Glitch', stutterEnabled: true, bitcrushEnabled: true, bitcrushBits: 4, gateEnabled: true, tapeStopEnabled: true },
            { name: 'Lo-fi Tape', lofiEnabled: true, bitcrushEnabled: true, bitcrushBits: 10, lofiNoiseAmount: 0.15 },
            { name: 'Granular Cloud', granularEnabled: true, granularSize: 0.03, granularRate: 20 },
            { name: 'Digital Corruption', bitcrushEnabled: true, bitcrushBits: 3, stutterEnabled: true, gateEnabled: true },
            { name: 'Stutter Party', stutterEnabled: true, stutterRate: 16, stutterProbability: 0.7 },
            { name: 'Tape Destroyer', tapeStopEnabled: true, lofiEnabled: true, reverseEnabled: true },
            { name: 'Radio Static', lofiEnabled: true, bitcrushBits: 6, lofiLowpassFreq: 2000, lofiNoiseAmount: 0.2 }
        ];
        
        this.activeEffects = new Set();
    }
    
    init(audioContext) {
        this.audioContext = audioContext;
        
        // Create main chain
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        
        // Create effect nodes (not connected yet)
        this.lowpassNode = audioContext.createBiquadFilter();
        this.lowpassNode.type = 'lowpass';
        this.lowpassNode.frequency.value = this.settings.lofiLowpassFreq;
        
        console.log('[ClipGlitchEffects] Initialized');
    }
    
    /**
     * Apply glitch effects to a clip
     */
    applyToClip(clip) {
        if (!clip || !clip.audioBuffer) {
            console.warn('[ClipGlitchEffects] No valid clip provided');
            return null;
        }
        
        const buffer = clip.audioBuffer;
        const processedBuffer = this.audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        // Process each channel
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const inputData = buffer.getChannelData(ch);
            const outputData = processedBuffer.getChannelData(ch);
            
            // Copy initial data
            outputData.set(inputData);
            
            // Apply effects in order
            if (this.settings.reverseEnabled && Math.random() < this.settings.reverseProbability) {
                this.applyReverse(outputData);
            }
            
            if (this.settings.bitcrushEnabled) {
                this.applyBitcrush(outputData, buffer.sampleRate);
            }
            
            if (this.settings.stutterEnabled) {
                this.applyStutter(outputData, buffer.sampleRate);
            }
            
            if (this.settings.lofiEnabled) {
                this.applyLofi(outputData, buffer.sampleRate);
            }
            
            if (this.settings.tapeStopEnabled) {
                this.applyTapeStop(outputData, buffer.sampleRate);
            }
            
            if (this.settings.gateEnabled) {
                this.applyGate(outputData, buffer.sampleRate);
            }
            
            if (this.settings.granularEnabled) {
                this.applyGranular(outputData, buffer.sampleRate);
            }
            
            if (this.settings.randomizeEnabled) {
                this.applyRandomize(outputData);
            }
        }
        
        return processedBuffer;
    }
    
    /**
     * Apply stutter effect
     */
    applyStutter(data, sampleRate) {
        const stutterSamples = Math.floor(this.settings.stutterLength * sampleRate);
        const stutterInterval = Math.floor(sampleRate / this.settings.stutterRate);
        
        for (let i = 0; i < data.length; i += stutterInterval) {
            if (Math.random() < this.settings.stutterProbability) {
                // Grab a chunk and repeat it
                const chunkStart = i;
                const chunkEnd = Math.min(i + stutterSamples, data.length);
                const chunk = data.slice(chunkStart, chunkEnd);
                
                // Repeat the chunk
                let repeatPos = chunkEnd;
                for (let j = 0; j < 3 && repeatPos < data.length; j++) {
                    for (let k = 0; k < chunk.length && repeatPos + k < data.length; k++) {
                        data[repeatPos + k] = chunk[k];
                    }
                    repeatPos += chunk.length;
                }
            }
        }
        
        this.activeEffects.add('stutter');
    }
    
    /**
     * Apply bitcrush effect
     */
    applyBitcrush(data, sampleRate) {
        const bitDepth = this.settings.bitcrushBits;
        const stepSize = Math.pow(2, bitDepth);
        const sampleRateReduction = Math.floor(sampleRate / this.settings.bitcrushSampleRate);
        
        for (let i = 0; i < data.length; i++) {
            // Sample rate reduction
            if (i % sampleRateReduction !== 0 && i > 0) {
                data[i] = data[i - (i % sampleRateReduction)];
            }
            
            // Bit depth reduction
            const quantized = Math.round(data[i] * stepSize) / stepSize;
            data[i] = Math.max(-1, Math.min(1, quantized));
        }
        
        this.activeEffects.add('bitcrush');
    }
    
    /**
     * Apply reverse effect
     */
    applyReverse(data) {
        const start = Math.floor(data.length * 0.3);
        const end = Math.floor(data.length * 0.6);
        const segment = data.slice(start, end);
        
        for (let i = 0; i < segment.length; i++) {
            data[start + i] = segment[segment.length - 1 - i];
        }
        
        this.activeEffects.add('reverse');
    }
    
    /**
     * Apply tape stop effect
     */
    applyTapeStop(data, sampleRate) {
        const stopStart = Math.floor(data.length * (1 - this.settings.tapeStopDepth));
        const rampLength = data.length - stopStart;
        
        for (let i = stopStart; i < data.length; i++) {
            const progress = (i - stopStart) / rampLength;
            const speed = 1 - (progress * this.settings.tapeStopSpeed);
            
            // Simple pitch drop simulation by sample replication
            const sourceIndex = stopStart + Math.floor((i - stopStart) * speed);
            if (sourceIndex < data.length) {
                data[i] = data[sourceIndex] * (1 - progress * 0.5); // Also reduce volume
            }
        }
        
        this.activeEffects.add('tapeStop');
    }
    
    /**
     * Apply lo-fi effect
     */
    applyLofi(data, sampleRate) {
        // Add noise
        for (let i = 0; i < data.length; i++) {
            if (this.settings.lofiNoiseAmount > 0) {
                const noise = (Math.random() - 0.5) * 2 * this.settings.lofiNoiseAmount;
                data[i] += noise;
            }
        }
        
        this.activeEffects.add('lofi');
    }
    
    /**
     * Apply gate effect
     */
    applyGate(data, sampleRate) {
        const threshold = Math.pow(10, this.settings.gateThreshold / 20);
        const attackSamples = Math.floor(this.settings.gateAttack * sampleRate);
        const releaseSamples = Math.floor(this.settings.gateRelease * sampleRate);
        
        let gateOpen = false;
        let releaseCounter = 0;
        
        for (let i = 0; i < data.length; i++) {
            const level = Math.abs(data[i]);
            
            if (level > threshold) {
                gateOpen = true;
                releaseCounter = releaseSamples;
            } else if (releaseCounter > 0) {
                releaseCounter--;
                gateOpen = true;
            } else {
                gateOpen = false;
            }
            
            if (!gateOpen) {
                // Apply attack/release smoothing
                if (i > 0 && Math.abs(data[i-1]) > threshold) {
                    // Release
                    const releaseProgress = releaseCounter / releaseSamples;
                    data[i] *= releaseProgress;
                } else {
                    data[i] = 0;
                }
            }
        }
        
        this.activeEffects.add('gate');
    }
    
    /**
     * Apply granular effect
     */
    applyGranular(data, sampleRate) {
        const grainSize = Math.floor(this.settings.granularSize * sampleRate);
        const grainCount = Math.floor(data.length / grainSize);
        const grains = [];
        
        // Extract grains
        for (let i = 0; i < grainCount; i++) {
            const start = i * grainSize + Math.floor((Math.random() - 0.5) * grainSize * this.settings.granularRandomize);
            if (start >= 0 && start + grainSize <= data.length) {
                grains.push({
                    data: data.slice(start, start + grainSize),
                    position: i * grainSize
                });
            }
        }
        
        // Shuffle and replace
        for (let i = 0; i < grains.length; i++) {
            const grain = grains[i];
            const targetPos = grain.position;
            
            // Apply window
            for (let j = 0; j < grain.data.length && targetPos + j < data.length; j++) {
                const window = 0.5 * (1 - Math.cos(2 * Math.PI * j / grain.data.length));
                data[targetPos + j] = grain.data[j] * window;
            }
        }
        
        this.activeEffects.add('granular');
    }
    
    /**
     * Apply randomize effect
     */
    applyRandomize(data) {
        const intensity = this.settings.randomizeIntensity;
        
        for (let i = 0; i < data.length; i++) {
            // Random amplitude modulation
            if (Math.random() < intensity) {
                data[i] *= Math.random();
            }
            
            // Random bit flip
            if (Math.random() < intensity * 0.1) {
                data[i] = -data[i];
            }
        }
        
        this.activeEffects.add('randomize');
    }
    
    /**
     * Apply a preset
     */
    applyPreset(presetName) {
        const preset = this.presets.find(p => p.name === presetName);
        if (preset) {
            Object.assign(this.settings, preset);
            console.log(`[ClipGlitchEffects] Applied preset: ${presetName}`);
        }
    }
    
    /**
     * Get all presets
     */
    getPresets() {
        return this.presets.map(p => p.name);
    }
    
    /**
     * Enable/disable an effect
     */
    setEffectEnabled(effectName, enabled) {
        const key = `${effectName}Enabled`;
        if (key in this.settings) {
            this.settings[key] = enabled;
            if (enabled) {
                this.activeEffects.add(effectName);
            } else {
                this.activeEffects.delete(effectName);
            }
        }
    }
    
    /**
     * Get current state
     */
    getState() {
        return {
            clipId: this.clipId,
            enabled: this.enabled,
            settings: {...this.settings},
            activeEffects: Array.from(this.activeEffects)
        };
    }
    
    /**
     * Set state
     */
    setState(state) {
        if (state.settings) {
            Object.assign(this.settings, state.settings);
        }
        this.enabled = state.enabled ?? false;
        this.activeEffects = new Set(state.activeEffects || []);
    }
    
    /**
     * Dispose
     */
    dispose() {
        if (this.inputNode) {
            this.inputNode.disconnect();
            this.inputNode = null;
        }
        if (this.outputNode) {
            this.outputNode.disconnect();
            this.outputNode = null;
        }
        if (this.lowpassNode) {
            this.lowpassNode.disconnect();
            this.lowpassNode = null;
        }
        
        this.activeEffects.clear();
        console.log('[ClipGlitchEffects] Disposed');
    }
}

/**
 * Clip Glitch Manager - Manages glitch effects across clips
 */
export class ClipGlitchManager {
    constructor() {
        this.clips = new Map();
        this.audioContext = null;
    }
    
    init(audioContext) {
        this.audioContext = audioContext;
        console.log('[ClipGlitchManager] Initialized');
    }
    
    applyToClip(clipId, clip, settings = {}) {
        const effect = new ClipGlitchEffects({
            clipId,
            audioContext: this.audioContext,
            ...settings
        });
        
        const processedBuffer = effect.applyToClip(clip);
        this.clips.set(clipId, effect);
        
        return processedBuffer;
    }
    
    getEffect(clipId) {
        return this.clips.get(clipId);
    }
    
    removeEffect(clipId) {
        const effect = this.clips.get(clipId);
        if (effect) {
            effect.dispose();
            this.clips.delete(clipId);
        }
    }
    
    applyPresetToClip(clipId, presetName) {
        const effect = this.clips.get(clipId);
        if (effect) {
            effect.applyPreset(presetName);
        }
    }
    
    getAllPresets() {
        return new ClipGlitchEffects().getPresets();
    }
    
    clearAll() {
        this.clips.forEach(effect => effect.dispose());
        this.clips.clear();
    }
    
    dispose() {
        this.clearAll();
        this.audioContext = null;
    }
}

// Global instance
let clipGlitchManager = null;

export function getClipGlitchManager() {
    if (!clipGlitchManager) {
        clipGlitchManager = new ClipGlitchManager();
    }
    return clipGlitchManager;
}

export function openGlitchEffectsPanel(clipId, clip) {
    const manager = getClipGlitchManager();
    const effect = manager.getEffect(clipId) || new ClipGlitchEffects({clipId, audioContext: manager.audioContext});
    
    const panel = document.createElement('div');
    panel.className = 'glitch-effects-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        padding: 24px;
        border-radius: 8px;
        border: 1px solid #333;
        color: white;
        z-index: 10000;
        min-width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        font-family: system-ui, sans-serif;
    `;
    
    const s = effect.settings;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px;">Glitch Effects</h3>
            <button class="close-btn" style="background: none; border: none; color: #888; cursor: pointer; font-size: 20px;">&times;</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="font-size: 12px; color: #888; display: block; margin-bottom: 8px;">Preset</label>
            <select id="glitch-preset" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #333; color: white; border-radius: 4px;">
                <option value="">Custom</option>
                ${effect.getPresets().map(p => `<option value="${p}">${p}</option>`).join('')}
            </select>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="stutter-enabled" ${s.stutterEnabled ? 'checked' : ''}>
                <span>Stutter</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="bitcrush-enabled" ${s.bitcrushEnabled ? 'checked' : ''}>
                <span>Bitcrush</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="reverse-enabled" ${s.reverseEnabled ? 'checked' : ''}>
                <span>Reverse</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="tapestop-enabled" ${s.tapeStopEnabled ? 'checked' : ''}>
                <span>Tape Stop</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="lofi-enabled" ${s.lofiEnabled ? 'checked' : ''}>
                <span>Lo-fi</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="granular-enabled" ${s.granularEnabled ? 'checked' : ''}>
                <span>Granular</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="gate-enabled" ${s.gateEnabled ? 'checked' : ''}>
                <span>Gate</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="randomize-enabled" ${s.randomizeEnabled ? 'checked' : ''}>
                <span>Randomize</span>
            </label>
        </div>
        
        <div id="effect-params" style="margin-bottom: 16px;">
            <div class="param-group" data-effect="stutter" style="padding: 12px; background: #0a0a14; border-radius: 4px; margin-bottom: 8px; ${!s.stutterEnabled ? 'display: none;' : ''}">
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 12px; color: #888;">Stutter Rate (Hz)</label>
                    <input type="range" class="stutter-rate" min="1" max="32" value="${s.stutterRate}" style="width: 100%;">
                    <span class="stutter-rate-display">${s.stutterRate}</span>
                </div>
                <div>
                    <label style="font-size: 12px; color: #888;">Probability</label>
                    <input type="range" class="stutter-prob" min="0" max="100" value="${s.stutterProbability * 100}" style="width: 100%;">
                    <span class="stutter-prob-display">${Math.round(s.stutterProbability * 100)}%</span>
                </div>
            </div>
            
            <div class="param-group" data-effect="bitcrush" style="padding: 12px; background: #0a0a14; border-radius: 4px; margin-bottom: 8px; ${!s.bitcrushEnabled ? 'display: none;' : ''}">
                <div>
                    <label style="font-size: 12px; color: #888;">Bit Depth</label>
                    <input type="range" class="bitcrush-bits" min="1" max="16" value="${s.bitcrushBits}" style="width: 100%;">
                    <span class="bitcrush-bits-display">${s.bitcrushBits} bits</span>
                </div>
            </div>
        </div>
        
        <div style="display: flex; gap: 8px;">
            <button id="glitch-apply" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Apply Effects
            </button>
            <button id="glitch-reset" style="flex: 1; padding: 12px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                Reset
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.onclick = () => panel.remove();
    
    const presetSelect = panel.querySelector('#glitch-preset');
    presetSelect.onchange = () => {
        if (presetSelect.value) {
            effect.applyPreset(presetSelect.value);
            // Update UI
            panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const effectName = cb.id.replace('-enabled', '');
                const key = `${effectName}Enabled`;
                cb.checked = effect.settings[key] ?? false;
            });
        }
    };
    
    // Toggle effect parameter visibility
    panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.onchange = () => {
            const effectName = cb.id.replace('-enabled', '');
            effect.setEffectEnabled(effectName, cb.checked);
            const paramGroup = panel.querySelector(`.param-group[data-effect="${effectName}"]`);
            if (paramGroup) {
                paramGroup.style.display = cb.checked ? 'block' : 'none';
            }
        };
    });
    
    const applyBtn = panel.querySelector('#glitch-apply');
    applyBtn.onclick = () => {
        if (clip) {
            const processedBuffer = manager.applyToClip(clipId, clip, effect.settings);
            console.log('[ClipGlitchEffects] Effects applied to clip', clipId);
            
            // Show notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                font-family: system-ui, sans-serif;
            `;
            notification.textContent = 'Glitch effects applied!';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 2000);
        }
    };
    
    const resetBtn = panel.querySelector('#glitch-reset');
    resetBtn.onclick = () => {
        effect.settings = new ClipGlitchEffects().settings;
        panel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        panel.querySelectorAll('.param-group').forEach(pg => pg.style.display = 'none');
        manager.removeEffect(clipId);
    };
    
    return panel;
}

// Module initialized
console.log('[ClipGlitchEffects] Module loaded');