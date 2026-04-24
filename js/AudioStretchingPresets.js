/**
 * Audio Stretching Presets - Quick apply time-stretch presets
 * Provides preset configurations for audio time-stretching algorithms
 */

class AudioStretchingPresets {
    constructor() {
        this.presets = new Map();
        this.initializePresets();
        this.currentPreset = 'balanced';
        this.stretchAlgorithm = 'phasevocoder'; // phasevocoder, granular, wsola
    }

    initializePresets() {
        // Voice presets
        this.presets.set('vocal-natural', {
            name: 'Vocal - Natural',
            category: 'voice',
            algorithm: 'phasevocoder',
            pitchCorrection: true,
            formantPreservation: true,
            phaseCoherence: 0.7,
            windowSize: 2048,
            description: 'Natural voice stretching with formant preservation'
        });

        this.presets.set('vocal-formant-shift', {
            name: 'Vocal - Formant Shift',
            category: 'voice',
            algorithm: 'phasevocoder',
            pitchCorrection: true,
            formantPreservation: false,
            formantShift: 1.2,
            phaseCoherence: 0.6,
            windowSize: 2048,
            description: 'Voice with shifted formants for creative effect'
        });

        // Drum presets
        this.presets.set('drums-tight', {
            name: 'Drums - Tight',
            category: 'drums',
            algorithm: 'granular',
            grainSize: 20,
            grainOverlap: 4,
            pitchCorrection: false,
            randomize: 0.05,
            description: 'Tight drum stretching with minimal artifacts'
        });

        this.presets.set('drums-glitcy', {
            name: 'Drums - Glitchy',
            category: 'drums',
            algorithm: 'granular',
            grainSize: 10,
            grainOverlap: 2,
            pitchCorrection: false,
            randomize: 0.3,
            reverseGrains: true,
            description: 'Glitchy, stuttering drum effect'
        });

        this.presets.set('drums-extended', {
            name: 'Drums - Extended',
            category: 'drums',
            algorithm: 'wsola',
            pitchCorrection: false,
            windowSize: 512,
            overlap: 0.75,
            description: 'Extended drum loops with minimal transient smearing'
        });

        // Melodic presets
        this.presets.set('melody-clear', {
            name: 'Melody - Clear',
            category: 'melodic',
            algorithm: 'phasevocoder',
            pitchCorrection: true,
            formantPreservation: true,
            phaseCoherence: 0.85,
            windowSize: 4096,
            description: 'Clear melodic stretching for pitched instruments'
        });

        this.presets.set('melody-ambient', {
            name: 'Melody - Ambient',
            category: 'melodic',
            algorithm: 'phasevocoder',
            pitchCorrection: true,
            formantPreservation: true,
            phaseCoherence: 0.3,
            windowSize: 8192,
            description: 'Smooth, ambient melodic stretching'
        });

        // Texture presets
        this.presets.set('texture-granular', {
            name: 'Texture - Granular',
            category: 'texture',
            algorithm: 'granular',
            grainSize: 50,
            grainOverlap: 8,
            pitchCorrection: false,
            randomize: 0.15,
            pitchRandomize: 0.02,
            description: 'Granular textural stretching'
        });

        this.presets.set('texture-pitched', {
            name: 'Texture - Pitched',
            category: 'texture',
            algorithm: 'phasevocoder',
            pitchCorrection: true,
            formantPreservation: false,
            phaseCoherence: 0.5,
            windowSize: 4096,
            description: 'Pitched textural stretching'
        });

        // Balanced presets
        this.presets.set('balanced', {
            name: 'Balanced',
            category: 'general',
            algorithm: 'phasevocoder',
            pitchCorrection: true,
            formantPreservation: true,
            phaseCoherence: 0.7,
            windowSize: 2048,
            description: 'Balanced stretching for most material'
        });

        this.presets.set('fast', {
            name: 'Fast / Low Quality',
            category: 'general',
            algorithm: 'wsola',
            pitchCorrection: false,
            windowSize: 512,
            overlap: 0.5,
            description: 'Fast processing, lower quality'
        });

        this.presets.set('high-quality', {
            name: 'High Quality',
            category: 'general',
            algorithm: 'phasevocoder',
            pitchCorrection: true,
            formantPreservation: true,
            phaseCoherence: 0.9,
            windowSize: 8192,
            description: 'Highest quality, slower processing'
        });

        // Creative presets
        this.presets.set('creative-chaos', {
            name: 'Creative - Chaos',
            category: 'creative',
            algorithm: 'granular',
            grainSize: 5,
            grainOverlap: 2,
            pitchCorrection: false,
            randomize: 0.5,
            pitchRandomize: 0.1,
            reverseGrains: true,
            description: 'Chaotic granular destruction'
        });

        this.presets.set('creative-crystalline', {
            name: 'Creative - Crystalline',
            category: 'creative',
            algorithm: 'phasevocoder',
            pitchCorrection: true,
            formantPreservation: true,
            phaseCoherence: 0.95,
            windowSize: 16384,
            description: 'Ultra-smooth crystalline stretching'
        });

        this.presets.set('creative-time-warp', {
            name: 'Creative - Time Warp',
            category: 'creative',
            algorithm: 'phasevocoder',
            pitchCorrection: false,
            formantPreservation: false,
            phaseCoherence: 0.2,
            windowSize: 4096,
            pitchShift: 1.5,
            description: 'Time warping with pitch shift'
        });

        // Extreme presets
        this.presets.set('extreme-stretch', {
            name: 'Extreme - 100x Stretch',
            category: 'extreme',
            algorithm: 'phasevocoder',
            pitchCorrection: true,
            formantPreservation: true,
            phaseCoherence: 0.1,
            windowSize: 32768,
            maxStretchRatio: 100,
            description: 'Extreme time stretching for drones'
        });

        this.presets.set('extreme-paulstretch', {
            name: 'Extreme - PaulStretch',
            category: 'extreme',
            algorithm: 'phasevocoder',
            pitchCorrection: false,
            formantPreservation: false,
            phaseCoherence: 0.05,
            windowSize: 65536,
            overlap: 0.9,
            description: 'PaulStretch-style infinite stretching'
        });
    }

    /**
     * Get preset by ID
     * @param {string} presetId - Preset ID
     * @returns {Object} - Preset configuration
     */
    getPreset(presetId) {
        return this.presets.get(presetId) || null;
    }

    /**
     * Get all presets
     * @returns {Array} - Array of preset configurations
     */
    getAllPresets() {
        return Array.from(this.presets.entries()).map(([id, preset]) => ({
            id,
            ...preset
        }));
    }

    /**
     * Get presets by category
     * @param {string} category - Category name
     * @returns {Array} - Filtered presets
     */
    getPresetsByCategory(category) {
        return this.getAllPresets().filter(p => p.category === category);
    }

    /**
     * Get all categories
     * @returns {Array} - Array of category names
     */
    getCategories() {
        const categories = new Set();
        this.presets.forEach(preset => categories.add(preset.category));
        return Array.from(categories);
    }

    /**
     * Set current preset
     * @param {string} presetId - Preset ID
     */
    setCurrentPreset(presetId) {
        if (this.presets.has(presetId)) {
            this.currentPreset = presetId;
            return true;
        }
        return false;
    }

    /**
     * Get current preset configuration
     * @returns {Object} - Current preset
     */
    getCurrentPresetConfig() {
        return this.getPreset(this.currentPreset);
    }

    /**
     * Add custom preset
     * @param {string} id - Preset ID
     * @param {Object} config - Preset configuration
     */
    addCustomPreset(id, config) {
        const preset = {
            name: config.name || id,
            category: config.category || 'custom',
            ...config
        };
        this.presets.set(id, preset);
        return preset;
    }

    /**
     * Apply preset to audio clip
     * @param {Object} clip - Audio clip
     * @param {number} stretchRatio - Stretch ratio (e.g., 2.0 = double length)
     * @param {string} presetId - Preset ID (optional, uses current)
     * @returns {Object} - Stretched audio buffer
     */
    async applyStretch(clip, stretchRatio, presetId = null) {
        const preset = presetId ? this.getPreset(presetId) : this.getCurrentPresetConfig();
        
        if (!preset) {
            return { error: 'No preset found' };
        }

        if (!clip || !clip.audioBuffer) {
            return { error: 'No audio buffer in clip' };
        }

        const buffer = clip.audioBuffer;
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const originalLength = buffer.length;
        const newLength = Math.floor(originalLength * stretchRatio);

        // Create output buffer
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const outputBuffer = audioContext.createBuffer(numChannels, newLength, sampleRate);

        // Apply stretching based on algorithm
        switch (preset.algorithm) {
            case 'phasevocoder':
                await this.applyPhaseVocoder(buffer, outputBuffer, stretchRatio, preset);
                break;
            case 'granular':
                await this.applyGranularStretch(buffer, outputBuffer, stretchRatio, preset);
                break;
            case 'wsola':
                await this.applyWSOLA(buffer, outputBuffer, stretchRatio, preset);
                break;
            default:
                await this.applyPhaseVocoder(buffer, outputBuffer, stretchRatio, preset);
        }

        return {
            buffer: outputBuffer,
            originalDuration: buffer.duration,
            newDuration: outputBuffer.duration,
            stretchRatio,
            preset: preset.name
        };
    }

    /**
     * Apply Phase Vocoder stretching
     */
    async applyPhaseVocoder(inputBuffer, outputBuffer, stretchRatio, preset) {
        const windowSize = preset.windowSize || 2048;
        const hopSize = windowSize / 4;
        const phaseCoherence = preset.phaseCoherence || 0.7;
        
        for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
            const input = inputBuffer.getChannelData(channel);
            const output = outputBuffer.getChannelData(channel);
            
            // Simplified phase vocoder
            const numFrames = Math.floor(input.length / hopSize);
            const outputHopSize = hopSize * stretchRatio;
            
            const phases = new Float32Array(windowSize / 2);
            let writePos = 0;

            for (let i = 0; i < numFrames && writePos < output.length; i++) {
                const readPos = i * hopSize;
                
                // Extract frame and apply window
                const frame = new Float32Array(windowSize);
                for (let j = 0; j < windowSize && readPos + j < input.length; j++) {
                    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * j / windowSize);
                    frame[j] = input[readPos + j] * window;
                }

                // FFT (simplified - would use real FFT in production)
                const spectrum = this.simplifiedFFT(frame);
                
                // Phase propagation
                for (let k = 0; k < spectrum.length; k++) {
                    const phaseIncrement = (stretchRatio - 1) * 2 * Math.PI * k / windowSize;
                    phases[k] = (phases[k] || 0) + phaseIncrement * phaseCoherence;
                }

                // IFFT with new phases
                const newFrame = this.simplifiedIFFT(spectrum, phases);
                
                // Overlap-add to output
                for (let j = 0; j < windowSize && writePos + j < output.length; j++) {
                    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * j / windowSize);
                    output[writePos + j] += newFrame[j] * window;
                }

                writePos += outputHopSize;
            }
        }
    }

    /**
     * Apply Granular stretching
     */
    async applyGranularStretch(inputBuffer, outputBuffer, stretchRatio, preset) {
        const grainSize = preset.grainSize || 50; // ms
        const overlap = preset.grainOverlap || 4;
        const randomize = preset.randomize || 0;
        const pitchRandomize = preset.pitchRandomize || 0;
        const reverseGrains = preset.reverseGrains || false;

        const sampleRate = inputBuffer.sampleRate;
        const grainSamples = Math.floor(grainSize / 1000 * sampleRate);
        const grainHop = grainSamples / overlap;

        for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
            const input = inputBuffer.getChannelData(channel);
            const output = outputBuffer.getChannelData(channel);
            
            let writePos = 0;
            let readPos = 0;

            while (writePos < output.length && readPos < input.length) {
                // Extract grain
                const grain = new Float32Array(grainSamples);
                const readOffset = readPos + (Math.random() - 0.5) * grainSamples * randomize;
                
                for (let i = 0; i < grainSamples; i++) {
                    const sourcePos = Math.floor(readOffset + i);
                    if (sourcePos >= 0 && sourcePos < input.length) {
                        grain[i] = input[sourcePos];
                    }
                }

                // Apply window
                for (let i = 0; i < grainSamples; i++) {
                    const window = Math.sin(Math.PI * i / grainSamples);
                    grain[i] *= window;
                }

                // Optionally reverse
                if (reverseGrains && Math.random() < 0.3) {
                    grain.reverse();
                }

                // Pitch variation
                const pitchMultiplier = 1 + (Math.random() - 0.5) * pitchRandomize * 2;

                // Write grain to output
                for (let i = 0; i < grainSamples && writePos + i < output.length; i++) {
                    output[writePos + i] += grain[Math.floor(i / pitchMultiplier)] || 0;
                }

                writePos += grainHop * stretchRatio;
                readPos += grainHop;
            }
        }
    }

    /**
     * Apply WSOLA (Waveform Similarity Overlap-Add) stretching
     */
    async applyWSOLA(inputBuffer, outputBuffer, stretchRatio, preset) {
        const windowSize = preset.windowSize || 512;
        const overlap = preset.overlap || 0.75;
        const hopSize = Math.floor(windowSize * (1 - overlap));

        for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
            const input = inputBuffer.getChannelData(channel);
            const output = outputBuffer.getChannelData(channel);
            
            let writePos = 0;
            let readPos = 0;

            while (writePos < output.length && readPos < input.length - windowSize) {
                // Find best matching frame
                let bestOffset = 0;
                let bestCorrelation = -Infinity;

                const searchRange = Math.floor(windowSize / 2);
                for (let offset = -searchRange; offset <= searchRange; offset++) {
                    const testPos = readPos + offset;
                    if (testPos < 0 || testPos + windowSize > input.length) continue;

                    let correlation = 0;
                    for (let i = 0; i < windowSize; i++) {
                        const ref = input[Math.floor(readPos + i)] || 0;
                        const test = input[testPos + i] || 0;
                        correlation += ref * test;
                    }

                    if (correlation > bestCorrelation) {
                        bestCorrelation = correlation;
                        bestOffset = offset;
                    }
                }

                // Extract best matching frame
                const frameStart = readPos + bestOffset;
                for (let i = 0; i < windowSize && writePos + i < output.length; i++) {
                    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / windowSize);
                    const sourcePos = frameStart + i;
                    if (sourcePos >= 0 && sourcePos < input.length) {
                        output[writePos + i] += input[Math.floor(sourcePos)] * window;
                    }
                }

                writePos += hopSize;
                readPos += hopSize / stretchRatio;
            }
        }
    }

    /**
     * Simplified FFT (for demonstration)
     */
    simplifiedFFT(frame) {
        const n = frame.length;
        const spectrum = new Float32Array(n / 2);
        
        for (let k = 0; k < n / 2; k++) {
            let real = 0, imag = 0;
            for (let t = 0; t < n; t++) {
                const angle = 2 * Math.PI * k * t / n;
                real += frame[t] * Math.cos(angle);
                imag -= frame[t] * Math.sin(angle);
            }
            spectrum[k] = Math.sqrt(real * real + imag * imag);
        }
        
        return spectrum;
    }

    /**
     * Simplified IFFT (for demonstration)
     */
    simplifiedIFFT(spectrum, phases) {
        const n = spectrum.length * 2;
        const frame = new Float32Array(n);
        
        for (let t = 0; t < n; t++) {
            let sum = 0;
            for (let k = 0; k < spectrum.length; k++) {
                const angle = 2 * Math.PI * k * t / n + (phases[k] || 0);
                sum += spectrum[k] * Math.cos(angle);
            }
            frame[t] = sum / spectrum.length;
        }
        
        return frame;
    }

    /**
     * Open stretching presets panel
     */
    openPresetsPanel(clips, onApply) {
        const existing = document.getElementById('stretch-presets-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'stretch-presets-panel';

        const categories = this.getCategories();
        const presets = this.getAllPresets();

        let presetsHTML = '';
        categories.forEach(cat => {
            const catPresets = presets.filter(p => p.category === cat);
            presetsHTML += `
                <div class="preset-category" style="margin-bottom: 16px;">
                    <div style="color: #6b7280; font-size: 11px; text-transform: uppercase; margin-bottom: 8px;">${cat}</div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px;">
                        ${catPresets.map(p => `
                            <button class="preset-btn" data-id="${p.id}" style="padding: 12px; background: ${this.currentPreset === p.id ? '#10b981' : '#2a2a4e'}; color: #fff; border: 1px solid ${this.currentPreset === p.id ? '#10b981' : '#3b3b5e'}; border-radius: 4px; cursor: pointer; text-align: left;">
                                <div style="font-size: 12px; font-weight: 500;">${p.name}</div>
                                <div style="font-size: 10px; color: #a0a0a0; margin-top: 4px;">${p.algorithm}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        panel.innerHTML = `
            <div class="stretch-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 700px; max-height: 80vh; overflow-y: auto;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">⏱️ Audio Stretching Presets</h3>
                
                <div style="margin-bottom: 16px; background: #2a2a4e; padding: 12px; border-radius: 4px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="color: #a0a0a0; font-size: 11px;">Stretch Ratio</label>
                            <input type="number" id="stretch-ratio" value="2.0" min="0.5" max="100" step="0.1"
                                style="width: 100%; margin-top: 4px; padding: 8px; background: #1a1a2e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        </div>
                        <div>
                            <label style="color: #a0a0a0; font-size: 11px;">Clips: ${clips?.length || 0}</label>
                            <div style="margin-top: 4px; padding: 8px; background: #1a1a2e; border-radius: 4px; color: #10b981; font-size: 14px;">
                                ${clips?.map(c => c.name).join(', ') || 'None selected'}
                            </div>
                        </div>
                    </div>
                </div>

                <div id="presets-container">${presetsHTML}</div>

                <div id="preset-info" style="display: none; background: #2a2a4e; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
                    <div id="preset-name" style="color: #fff; font-weight: 500;"></div>
                    <div id="preset-desc" style="color: #a0a0a0; font-size: 12px; margin-top: 4px;"></div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="stretch-preview-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Preview
                    </button>
                    <button id="stretch-apply-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Apply to ${clips?.length || 0} Clips
                    </button>
                    <button id="stretch-close-btn" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #stretch-presets-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
            .preset-btn:hover {
                filter: brightness(1.2);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Event handlers
        const presetInfo = document.getElementById('preset-info');
        const presetName = document.getElementById('preset-name');
        const presetDesc = document.getElementById('preset-desc');
        const ratioInput = document.getElementById('stretch-ratio');
        const previewBtn = document.getElementById('stretch-preview-btn');
        const applyBtn = document.getElementById('stretch-apply-btn');
        const closeBtn = document.getElementById('stretch-close-btn');

        // Preset selection
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const presetId = btn.dataset.id;
                this.setCurrentPreset(presetId);
                
                // Update UI
                document.querySelectorAll('.preset-btn').forEach(b => {
                    b.style.background = '#2a2a4e';
                    b.style.borderColor = '#3b3b5e';
                });
                btn.style.background = '#10b981';
                btn.style.borderColor = '#10b981';

                // Show info
                const preset = this.getPreset(presetId);
                presetInfo.style.display = 'block';
                presetName.textContent = preset.name;
                presetDesc.textContent = preset.description;
            });
        });

        // Preview
        previewBtn.addEventListener('click', async () => {
            if (!clips || clips.length === 0) return;
            
            const ratio = parseFloat(ratioInput.value);
            previewBtn.textContent = 'Processing...';
            previewBtn.disabled = true;

            // Preview first clip
            const result = await this.applyStretch(clips[0], ratio);
            
            previewBtn.textContent = 'Preview';
            previewBtn.disabled = false;

            if (result.buffer) {
                // Play preview
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const source = ctx.createBufferSource();
                source.buffer = result.buffer;
                source.connect(ctx.destination);
                source.start();
            }
        });

        // Apply
        applyBtn.addEventListener('click', async () => {
            if (!clips || clips.length === 0) return;
            
            const ratio = parseFloat(ratioInput.value);
            
            if (onApply) {
                onApply({
                    presetId: this.currentPreset,
                    ratio,
                    presetConfig: this.getCurrentPresetConfig()
                });
            }

            panel.remove();
            style.remove();
        });

        // Close
        closeBtn.addEventListener('click', () => {
            panel.remove();
            style.remove();
        });
    }
}

// Export singleton
const audioStretchingPresets = new AudioStretchingPresets();

export { AudioStretchingPresets, audioStretchingPresets };