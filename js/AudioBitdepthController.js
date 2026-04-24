/**
 * Audio Bitdepth Controller - Change audio bit depth with dithering options
 * Simulates lower bit depths and applies dithering to prevent quantization noise
 */

export class AudioBitdepthController {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        this.settings = {
            targetBitdepth: options.targetBitdepth || 16, // 8, 16, 24, 32
            dithering: options.dithering || true,
            ditherType: options.ditherType || 'tpdf', // 'none', 'tpdf', 'shaped', 'weighted'
            ditherAmount: options.ditherAmount || 0.5, // 0-1
            noiseShaping: options.noiseShaping || false,
            ...options
        };
        
        this.inputGain = null;
        this.outputGain = null;
        this.processor = null;
        this.initialized = false;
    }
    
    /**
     * Initialize the processor
     */
    initialize(inputChannel) {
        this.dispose();
        
        // Create gain nodes
        this.inputGain = this.audioContext.createGain();
        this.outputGain = this.audioContext.createGain();
        
        // Create ScriptProcessorNode for bitdepth simulation
        const bufferSize = 4096;
        this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        // Bitdepth settings
        const bitdepth = this.settings.targetBitdepth;
        const levels = Math.pow(2, bitdepth);
        const halfLevels = levels / 2;
        
        // Dither noise buffer
        let lastSample = 0;
        
        this.processor.onaudioprocess = (e) => {
            const input = e.inputBuffer;
            const output = e.outputBuffer;
            const inputData = input.getChannelData(0);
            const outputData = output.getChannelData(0);
            
            for (let i = 0; i < inputData.length; i++) {
                let sample = inputData[i];
                
                // Apply dithering before bitdepth reduction
                if (this.settings.dithering && this.settings.ditherType !== 'none') {
                    const ditherNoise = this.generateDither(this.settings.ditherType, this.settings.ditherAmount);
                    sample += ditherNoise * (1 / halfLevels);
                }
                
                // Apply bitdepth reduction (quantization)
                sample = Math.round(sample * halfLevels) / halfLevels;
                
                // Clip to prevent DC offset
                sample = Math.max(-1, Math.min(1, sample));
                
                // Apply noise shaping if enabled
                if (this.settings.noiseShaping && this.settings.dithering) {
                    const shaped = this.applyNoiseShaping(sample, lastSample);
                    sample = shaped;
                }
                
                lastSample = sample;
                outputData[i] = sample;
            }
        };
        
        // Connect: input -> inputGain -> processor -> outputGain -> output
        inputChannel.connect(this.inputGain);
        this.inputGain.connect(this.processor);
        this.processor.connect(this.outputGain);
        
        this.initialized = true;
        return this;
    }
    
    /**
     * Generate dither noise based on type
     */
    generateDither(type, amount) {
        switch (type) {
            case 'tpdf': // Triangular probability density function
                return (Math.random() - 0.5) + (Math.random() - 0.5);
                
            case 'shaped': // Psych acoustically shaped dither
                return (Math.random() - 0.5) * 0.5;
                
            case 'weighted': // Weighted noise
                return (Math.random() - 0.5 + (Math.random() - 0.5) + (Math.random() - 0.5)) / 3;
                
            case 'none':
            default:
                return 0;
        }
    }
    
    /**
     * Apply simple noise shaping
     */
    applyNoiseShaping(sample, lastSample) {
        // Simple first-order noise shaping
        const shapingFactor = 0.5;
        const error = sample - lastSample;
        return sample - (error * shapingFactor);
    }
    
    /**
     * Set target bitdepth
     */
    setBitdepth(bitdepth) {
        this.settings.targetBitdepth = bitdepth;
        // Reinitialize if initialized
        if (this.initialized) {
            this.initialize(this.inputGain);
        }
    }
    
    /**
     * Set dithering type
     */
    setDitherType(type) {
        this.settings.ditherType = type;
    }
    
    /**
     * Set dithering amount
     */
    setDitherAmount(amount) {
        this.settings.ditherAmount = Math.max(0, Math.min(1, amount));
    }
    
    /**
     * Toggle noise shaping
     */
    setNoiseShaping(enabled) {
        this.settings.noiseShaping = enabled;
    }
    
    /**
     * Get input node
     */
    getInput() {
        return this.inputGain;
    }
    
    /**
     * Get output node
     */
    getOutput() {
        return this.outputGain;
    }
    
    /**
     * Get settings
     */
    getSettings() {
        return { ...this.settings };
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        if (this.processor) {
            try {
                this.processor.disconnect();
            } catch (e) {}
            this.processor = null;
        }
        if (this.inputGain) {
            try {
                this.inputGain.disconnect();
            } catch (e) {}
            this.inputGain = null;
        }
        if (this.outputGain) {
            try {
                this.outputGain.disconnect();
            } catch (e) {}
            this.outputGain = null;
        }
        this.initialized = false;
    }
}

/**
 * Offline Bitdepth Converter - Convert audio files to different bit depths
 */
export class OfflineBitdepthConverter {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }
    
    /**
     * Convert an audio buffer to a different bitdepth
     */
    async convertBuffer(buffer, options = {}) {
        const {
            targetBitdepth = 16,
            dithering = true,
            ditherType = 'tpdf',
            applyDithering = true
        } = options;
        
        // Create offline context with same parameters
        const offlineCtx = new OfflineAudioContext(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        // Create the converter
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        
        const controller = new AudioBitdepthController(offlineCtx, {
            targetBitdepth,
            dithering: applyDithering,
            ditherType
        });
        
        const inputGain = offlineCtx.createGain();
        const outputGain = offlineCtx.createGain();
        
        source.connect(inputGain);
        controller.initialize(inputGain);
        controller.getOutput().connect(outputGain);
        outputGain.connect(offlineCtx.destination);
        
        source.start();
        
        const renderedBuffer = await offlineCtx.startRendering();
        return renderedBuffer;
    }
    
    /**
     * Export buffer as WAV with specific bitdepth
     */
    async exportAsWav(buffer, bitdepth = 16) {
        const wavBuffer = this.bufferToWav(buffer, bitdepth);
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }
    
    /**
     * Convert audio buffer to WAV format
     */
    bufferToWav(buffer, bitdepth = 16) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitsPerSample = bitdepth;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = buffer.length * blockAlign;
        const headerSize = 44;
        const totalSize = headerSize + dataSize;
        
        const arrayBuffer = new ArrayBuffer(totalSize);
        const view = new DataView(arrayBuffer);
        
        // RIFF header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, totalSize - 8, true);
        this.writeString(view, 8, 'WAVE');
        
        // fmt chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        
        // data chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);
        
        // Write interleaved samples
        const channels = [];
        for (let c = 0; c < numChannels; c++) {
            channels.push(buffer.getChannelData(c));
        }
        
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let c = 0; c < numChannels; c++) {
                let sample = channels[c][i];
                
                // Quantize to bitdepth
                const levels = Math.pow(2, bitdepth);
                const halfLevels = levels / 2;
                sample = Math.round(sample * halfLevels) / halfLevels;
                sample = Math.max(-1, Math.min(1, sample));
                
                // Convert to integer
                const intSample = Math.floor(sample * (halfLevels - 1));
                
                if (bitdepth === 8) {
                    view.setUint8(offset, intSample + 128);
                } else if (bitdepth === 16) {
                    view.setInt16(offset, intSample, true);
                } else if (bitdepth === 24) {
                    const val = intSample;
                    view.setUint8(offset, val & 0xff);
                    view.setUint8(offset + 1, (val >> 8) & 0xff);
                    view.setUint8(offset + 2, (val >> 16) & 0xff);
                } else if (bitdepth === 32) {
                    view.setInt32(offset, intSample, true);
                }
                
                offset += bytesPerSample;
            }
        }
        
        return arrayBuffer;
    }
    
    /**
     * Write string to DataView
     */
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}

// UI Panel for Audio Bitdepth Controller
export function openAudioBitdepthControllerPanel() {
    // Check if panel already exists
    const existing = document.getElementById('audio-bitdepth-controller-panel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'audio-bitdepth-controller-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #3a3a5e;
        border-radius: 8px;
        padding: 24px;
        z-index: 10000;
        min-width: 400px;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    
    panel.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">Audio Bitdepth Controller</h2>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Target Bitdepth</label>
            <select id="bd-bitdepth" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                <option value="8">8-bit (Crunchy)</option>
                <option value="12">12-bit (Retro)</option>
                <option value="16" selected>16-bit (CD Quality)</option>
                <option value="24">24-bit (Studio)</option>
                <option value="32">32-bit (Float)</option>
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; color: #888; margin-bottom: 8px;">Dithering Type</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="bd-dither" value="none"> None
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="bd-dither" value="tpdf" checked> TPDF
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="bd-dither" value="shaped"> Shaped
                </label>
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Dither Amount: <span id="bd-amount-val">50%</span></label>
            <input type="range" id="bd-amount" min="0" max="100" value="50" style="width: 100%;">
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="bd-noise-shaping">
                <span style="font-size: 14px;">Enable Noise Shaping</span>
            </label>
        </div>
        
        <div id="bd-preview" style="margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;">
            <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Preview Settings</div>
            <div id="bd-settings-display" style="font-size: 14px;"></div>
        </div>
        
        <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button id="bd-apply" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                Apply to Selected Track
            </button>
            <button id="bd-close" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Close
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Setup event handlers
    const amountSlider = panel.querySelector('#bd-amount');
    const amountDisplay = panel.querySelector('#bd-amount-val');
    amountSlider.addEventListener('input', () => {
        amountDisplay.textContent = amountSlider.value + '%';
        updatePreview();
    });
    
    panel.querySelectorAll('input[name="bd-dither"]').forEach(radio => {
        radio.addEventListener('change', updatePreview);
    });
    
    panel.querySelector('#bd-bitdepth').addEventListener('change', updatePreview);
    panel.querySelector('#bd-noise-shaping').addEventListener('change', updatePreview);
    
    panel.querySelector('#bd-close').addEventListener('click', () => {
        panel.remove();
    });
    
    panel.querySelector('#bd-apply').addEventListener('click', () => {
        const settings = getSettings();
        console.log('Applying bitdepth controller with settings:', settings);
        panel.remove();
    });
    
    function updatePreview() {
        const settings = getSettings();
        const display = panel.querySelector('#bd-settings-display');
        if (display) {
            display.innerHTML = `
                <div>Bitdepth: <strong>${settings.targetBitdepth}-bit</strong></div>
                <div>Dither: <strong>${settings.ditherType.toUpperCase()}</strong> @ ${Math.round(settings.ditherAmount * 100)}%</div>
                <div>Noise Shaping: <strong>${settings.noiseShaping ? 'On' : 'Off'}</strong></div>
            `;
        }
    }
    
    function getSettings() {
        const bitdepth = parseInt(panel.querySelector('#bd-bitdepth').value);
        const ditherType = panel.querySelector('input[name="bd-dither"]:checked').value;
        const ditherAmount = parseInt(panel.querySelector('#bd-amount').value) / 100;
        const noiseShaping = panel.querySelector('#bd-noise-shaping').checked;
        
        return { bitdepth, ditherType, ditherAmount, noiseShaping };
    }
    
    // Initial preview
    updatePreview();
}

// Export singleton
let audioBitdepthControllerInstance = null;

export function getAudioBitdepthController(audioContext, options = {}) {
    if (!audioBitdepthControllerInstance) {
        audioBitdepthControllerInstance = new AudioBitdepthController(audioContext, options);
    }
    return audioBitdepthControllerInstance;
}