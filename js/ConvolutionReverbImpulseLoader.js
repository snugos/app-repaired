/**
 * Convolution Reverb Impulse Loader - Load custom impulse responses for convolution reverb
 * Provides impulse response loading, management, and convolution processing
 */

class ConvolutionReverbImpulseLoader {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        this.input = audioContext.createGain();
        this.output = audioContext.createGain();
        this.dryGain = audioContext.createGain();
        this.wetGain = audioContext.createGain();
        
        // Convolver node
        this.convolver = audioContext.createConvolver();
        this.convolver.normalize = true;
        
        // Configuration
        this.mix = options.mix || 0.3;
        this.preDelay = options.preDelay || 0;
        this.decayTime = options.decayTime || 2.0;
        
        // Pre-delay buffer
        this.preDelayNode = audioContext.createDelay(1.0);
        this.preDelayNode.delayTime.value = this.preDelay;
        
        // EQ for reverb tail
        this.lowCut = audioContext.createBiquadFilter();
        this.lowCut.type = 'highpass';
        this.lowCut.frequency.value = 80;
        
        this.highDamp = audioContext.createBiquadFilter();
        this.highDamp.type = 'lowpass';
        this.highDamp.frequency.value = 8000;
        
        // Impulse response management
        this.loadedImpulses = new Map();
        this.currentImpulse = null;
        this.impulseBuffer = null;
        
        // Built-in impulse responses (generated)
        this.builtInImpulses = {
            'Small Room': { size: 0.3, decay: 0.8, brightness: 0.7 },
            'Medium Hall': { size: 0.6, decay: 1.5, brightness: 0.5 },
            'Large Hall': { size: 1.0, decay: 2.5, brightness: 0.4 },
            'Cathedral': { size: 1.5, decay: 4.0, brightness: 0.3 },
            'Plate': { size: 0.2, decay: 1.2, brightness: 0.8 },
            'Spring': { size: 0.1, decay: 0.6, brightness: 0.9 },
            'Ambient': { size: 2.0, decay: 6.0, brightness: 0.2 },
            'Reverse': { size: 0.8, decay: 2.0, brightness: 0.6, reverse: true }
        };
        
        // IR library
        this.irLibrary = [];
        this.customImpulses = [];
        
        // Connect signal path
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);
        this.dryGain.gain.value = 1 - this.mix;
        
        this.input.connect(this.preDelayNode);
        this.preDelayNode.connect(this.convolver);
        this.convolver.connect(this.lowCut);
        this.lowCut.connect(this.highDamp);
        this.highDamp.connect(this.wetGain);
        this.wetGain.connect(this.output);
        this.wetGain.gain.value = this.mix;
        
        // Load default impulse
        this.loadBuiltInImpulse('Medium Hall');
    }
    
    /**
     * Generate an impulse response buffer
     */
    generateImpulseResponse(config = {}) {
        const sampleRate = this.audioContext.sampleRate;
        const size = config.size || 0.5;
        const decay = config.decay || 1.5;
        const brightness = config.brightness || 0.5;
        const reverse = config.reverse || false;
        const length = Math.floor(sampleRate * decay * size * 2);
        
        const buffer = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = buffer.getChannelData(channel);
            let lastSample = 0;
            
            for (let i = 0; i < length; i++) {
                // Generate reverb tail with decay envelope
                const t = i / sampleRate;
                const envelope = Math.exp(-t * (3.0 / decay));
                
                // Add early reflections
                let sample = 0;
                if (i < sampleRate * 0.05) {
                    // Early reflections
                    const earlyReflections = Math.random() * 2 - 1;
                    sample += earlyReflections * Math.exp(-t * 50) * 0.5;
                }
                
                // Diffuse reverb tail
                const noise = Math.random() * 2 - 1;
                sample += noise * envelope;
                
                // Add modulated components for richness
                const lfo = Math.sin(t * 20 * (channel + 1)) * 0.1;
                sample += noise * envelope * lfo;
                
                // Brightness adjustment (high-frequency rolloff)
                const lowpassCoeff = 1 - (brightness * 0.5);
                sample = lastSample * lowpassCoeff + sample * (1 - lowpassCoeff);
                lastSample = sample;
                
                // Apply stereo width variation
                const stereoOffset = Math.sin(i * 0.001 * (channel + 1));
                sample *= (1 + stereoOffset * 0.1);
                
                channelData[i] = sample * 0.8;
            }
            
            // Reverse if needed
            if (reverse) {
                channelData.reverse();
            }
        }
        
        return buffer;
    }
    
    /**
     * Load a built-in impulse response
     */
    async loadBuiltInImpulse(name) {
        const config = this.builtInImpulses[name];
        if (!config) {
            console.warn(`Built-in impulse "${name}" not found`);
            return false;
        }
        
        const buffer = this.generateImpulseResponse(config);
        this.convolver.buffer = buffer;
        this.currentImpulse = name;
        this.impulseBuffer = buffer;
        
        return true;
    }
    
    /**
     * Load an impulse response from a URL
     */
    async loadImpulseFromUrl(url, name) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.convolver.buffer = audioBuffer;
            this.currentImpulse = name || url.split('/').pop();
            this.impulseBuffer = audioBuffer;
            this.loadedImpulses.set(this.currentImpulse, audioBuffer);
            
            return true;
        } catch (error) {
            console.error('Failed to load impulse response:', error);
            return false;
        }
    }
    
    /**
     * Load an impulse response from a file
     */
    async loadImpulseFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                    
                    this.convolver.buffer = audioBuffer;
                    this.currentImpulse = file.name;
                    this.impulseBuffer = audioBuffer;
                    this.loadedImpulses.set(file.name, audioBuffer);
                    
                    this.customImpulses.push({
                        name: file.name,
                        buffer: audioBuffer,
                        loadedAt: new Date()
                    });
                    
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * Load impulse from AudioBuffer
     */
    loadImpulseFromBuffer(buffer, name) {
        if (buffer.numberOfChannels < 1 || buffer.length < 1) {
            console.warn('Invalid buffer for impulse response');
            return false;
        }
        
        this.convolver.buffer = buffer;
        this.currentImpulse = name;
        this.impulseBuffer = buffer;
        this.loadedImpulses.set(name, buffer);
        
        return true;
    }
    
    /**
     * Get list of available impulses
     */
    getAvailableImpulses() {
        return {
            builtIn: Object.keys(this.builtInImpulses),
            custom: this.customImpulses.map(imp => ({
                name: imp.name,
                duration: imp.buffer.duration
            })),
            loaded: Array.from(this.loadedImpulses.keys())
        };
    }
    
    /**
     * Set mix (dry/wet)
     */
    setMix(value) {
        this.mix = Math.max(0, Math.min(1, value));
        this.dryGain.gain.value = 1 - this.mix;
        this.wetGain.gain.value = this.mix;
    }
    
    /**
     * Set pre-delay
     */
    setPreDelay(value) {
        this.preDelay = Math.max(0, Math.min(1, value));
        this.preDelayNode.delayTime.value = this.preDelay;
    }
    
    /**
     * Set low cut frequency
     */
    setLowCut(value) {
        this.lowCut.frequency.value = Math.max(20, Math.min(500, value));
    }
    
    /**
     * Set high damp frequency
     */
    setHighDamp(value) {
        this.highDamp.frequency.value = Math.max(1000, Math.min(20000, value));
    }
    
    /**
     * Capture impulse response from audio buffer
     */
    async captureImpulseFromRecording(recordedBuffer, fadeOut = 0.5) {
        const sampleRate = this.audioContext.sampleRate;
        const length = recordedBuffer.length;
        const fadeLength = Math.floor(sampleRate * fadeOut);
        
        const buffer = this.audioContext.createBuffer(
            recordedBuffer.numberOfChannels,
            length,
            sampleRate
        );
        
        for (let channel = 0; channel < recordedBuffer.numberOfChannels; channel++) {
            const source = recordedBuffer.getChannelData(channel);
            const dest = buffer.getChannelData(channel);
            
            for (let i = 0; i < length; i++) {
                // Apply fade out envelope
                let envelope = 1;
                if (i > length - fadeLength) {
                    const fadePos = (i - (length - fadeLength)) / fadeLength;
                    envelope = Math.cos(fadePos * Math.PI / 2);
                }
                dest[i] = source[i] * envelope;
            }
        }
        
        return buffer;
    }
    
    /**
     * Normalize impulse response
     */
    normalizeImpulse(buffer) {
        const normalized = this.audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        let maxVal = 0;
        
        // Find peak
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                maxVal = Math.max(maxVal, Math.abs(data[i]));
            }
        }
        
        // Normalize
        if (maxVal > 0) {
            const scale = 0.9 / maxVal;
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const source = buffer.getChannelData(channel);
                const dest = normalized.getChannelData(channel);
                for (let i = 0; i < source.length; i++) {
                    dest[i] = source[i] * scale;
                }
            }
        }
        
        return normalized;
    }
    
    /**
     * Export current impulse response as WAV
     */
    async exportImpulseAsWav() {
        if (!this.impulseBuffer) {
            console.warn('No impulse response loaded');
            return null;
        }
        
        const buffer = this.impulseBuffer;
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        
        // Create WAV file
        const wavBuffer = new ArrayBuffer(44 + length * numChannels * 2);
        const view = new DataView(wavBuffer);
        
        // RIFF header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * numChannels * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numChannels * 2, true);
        
        // Write audio data
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = buffer.getChannelData(channel)[i];
                const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }
        
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }
    
    /**
     * Connect nodes
     */
    connect(destination) {
        this.output.connect(destination.input || destination);
    }
    
    /**
     * Disconnect
     */
    disconnect() {
        this.output.disconnect();
    }
    
    /**
     * Get current settings
     */
    getSettings() {
        return {
            mix: this.mix,
            preDelay: this.preDelay,
            lowCut: this.lowCut.frequency.value,
            highDamp: this.highDamp.frequency.value,
            currentImpulse: this.currentImpulse
        };
    }
    
    /**
     * Apply settings
     */
    applySettings(settings) {
        if (settings.mix !== undefined) this.setMix(settings.mix);
        if (settings.preDelay !== undefined) this.setPreDelay(settings.preDelay);
        if (settings.lowCut !== undefined) this.setLowCut(settings.lowCut);
        if (settings.highDamp !== undefined) this.setHighDamp(settings.highDamp);
        if (settings.currentImpulse !== undefined) {
            this.loadBuiltInImpulse(settings.currentImpulse);
        }
    }
}

// Factory function
function createConvolutionReverbImpulseLoader(audioContext, options = {}) {
    return new ConvolutionReverbImpulseLoader(audioContext, options);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConvolutionReverbImpulseLoader, createConvolutionReverbImpulseLoader };
}