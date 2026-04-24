/**
 * MIDI to Audio Conversion - Render MIDI tracks to audio
 * Provides offline rendering of MIDI sequences to audio buffers
 */

class MIDIToAudioConversion {
    constructor() {
        this.renderHistory = [];
        this.maxHistory = 30;
        this.isRendering = false;
        
        // Render presets
        this.presets = {
            highQuality: {
                name: 'High Quality',
                sampleRate: 48000,
                bitDepth: 24,
                dither: true,
                normalize: true,
                tailLength: 2.0
            },
            standard: {
                name: 'Standard',
                sampleRate: 44100,
                bitDepth: 16,
                dither: false,
                normalize: true,
                tailLength: 1.0
            },
            draft: {
                name: 'Draft',
                sampleRate: 44100,
                bitDepth: 16,
                dither: false,
                normalize: false,
                tailLength: 0.5
            },
            streaming: {
                name: 'Streaming Ready',
                sampleRate: 44100,
                bitDepth: 16,
                dither: true,
                normalize: true,
                tailLength: 1.5,
                limiter: true,
                targetLUFS: -14
            }
        };
        
        // Audio formats
        this.formats = {
            wav: { name: 'WAV', extension: '.wav', mimeType: 'audio/wav', lossless: true },
            mp3: { name: 'MP3', extension: '.mp3', mimeType: 'audio/mpeg', lossless: false },
            ogg: { name: 'OGG', extension: '.ogg', mimeType: 'audio/ogg', lossless: false },
            flac: { name: 'FLAC', extension: '.flac', mimeType: 'audio/flac', lossless: true },
            aiff: { name: 'AIFF', extension: '.aiff', mimeType: 'audio/aiff', lossless: true }
        };
    }
    
    /**
     * Render MIDI sequence to audio
     * @param {Object} sequence - MIDI sequence object
     * @param {Object} options - Render options
     * @returns {Promise<AudioBuffer>} - Rendered audio buffer
     */
    async renderToAudio(sequence, options = {}) {
        if (!sequence || !sequence.notes) {
            throw new Error('Invalid sequence provided');
        }
        
        this.isRendering = true;
        
        const {
            preset = 'standard',
            sampleRate = 44100,
            bpm = 120,
            instrument = null,
            effects = [],
            tailLength = 1.0,
            normalize = true,
            onProgress = null
        } = options;
        
        try {
            // Calculate duration
            const duration = this.calculateDuration(sequence, bpm, tailLength);
            const totalSamples = Math.ceil(duration * sampleRate);
            
            if (onProgress) onProgress({ progress: 0, status: 'initializing' });
            
            // Create offline context
            const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);
            
            // Add effects to context
            const effectChain = await this.setupEffectChain(offlineCtx, effects);
            
            // Render each note
            const noteCount = sequence.notes.length;
            
            for (let i = 0; i < noteCount; i++) {
                const note = sequence.notes[i];
                
                await this.renderNote(offlineCtx, note, {
                    bpm,
                    instrument,
                    destination: effectChain.input,
                    sampleRate
                });
                
                if (onProgress && i % 10 === 0) {
                    onProgress({
                        progress: (i / noteCount) * 80,
                        status: `rendering note ${i + 1}/${noteCount}`
                    });
                }
            }
            
            if (onProgress) onProgress({ progress: 80, status: 'rendering audio' });
            
            // Render
            const renderedBuffer = await offlineCtx.startRendering();
            
            if (onProgress) onProgress({ progress: 90, status: 'post-processing' });
            
            // Post-process
            let finalBuffer = renderedBuffer;
            if (normalize) {
                finalBuffer = this.normalizeBuffer(renderedBuffer);
            }
            
            // Add to history
            this.renderHistory.push({
                timestamp: Date.now(),
                duration: finalBuffer.duration,
                noteCount: noteCount,
                options
            });
            
            if (onProgress) onProgress({ progress: 100, status: 'complete' });
            
            return finalBuffer;
            
        } finally {
            this.isRendering = false;
        }
    }
    
    /**
     * Render multiple tracks
     */
    async renderTracks(tracks, options = {}) {
        const {
            sampleRate = 44100,
            bpm = 120,
            onTrackProgress = null,
            onOverallProgress = null
        } = options;
        
        const renderedTracks = [];
        const trackCount = tracks.length;
        
        for (let i = 0; i < trackCount; i++) {
            const track = tracks[i];
            
            if (onTrackProgress) {
                onTrackProgress({
                    track: i,
                    trackName: track.name,
                    progress: (i / trackCount) * 100
                });
            }
            
            const buffer = await this.renderToAudio(track.sequence, {
                ...options,
                sampleRate,
                bpm,
                instrument: track.instrument,
                effects: track.effects || [],
                onProgress: (p) => {
                    if (onOverallProgress) {
                        onOverallProgress({
                            overallProgress: ((i + p.progress / 100) / trackCount) * 100,
                            currentTrack: i,
                            trackProgress: p.progress
                        });
                    }
                }
            });
            
            renderedTracks.push({
                track: track.name,
                buffer,
                instrument: track.instrument
            });
        }
        
        return renderedTracks;
    }
    
    /**
     * Mix multiple rendered tracks to single buffer
     */
    async mixToBuffer(renderedTracks, options = {}) {
        const {
            sampleRate = 44100,
            masterEffects = [],
            normalize = true
        } = options;
        
        // Find the longest buffer
        const maxLength = Math.max(...renderedTracks.map(t => t.buffer.length));
        
        const offlineCtx = new OfflineAudioContext(2, maxLength, sampleRate);
        
        // Create master chain
        let masterDestination = offlineCtx.destination;
        if (masterEffects.length > 0) {
            const chain = await this.setupEffectChain(offlineCtx, masterEffects);
            masterDestination = chain.input;
        }
        
        // Mix all tracks
        for (const rendered of renderedTracks) {
            const source = offlineCtx.createBufferSource();
            source.buffer = rendered.buffer;
            source.connect(masterDestination);
            source.start();
        }
        
        let mixedBuffer = await offlineCtx.startRendering();
        
        if (normalize) {
            mixedBuffer = this.normalizeBuffer(mixedBuffer);
        }
        
        return mixedBuffer;
    }
    
    /**
     * Export to file
     */
    async exportToFile(audioBuffer, format = 'wav', options = {}) {
        const formatInfo = this.formats[format];
        if (!formatInfo) {
            throw new Error(`Unsupported format: ${format}`);
        }
        
        switch (format) {
            case 'wav':
                return this.exportToWav(audioBuffer, options);
            case 'mp3':
                // Note: MP3 encoding requires external library
                console.warn('MP3 encoding not natively supported, falling back to WAV');
                return this.exportToWav(audioBuffer, options);
            case 'aiff':
                return this.exportToAiff(audioBuffer, options);
            default:
                return this.exportToWav(audioBuffer, options);
        }
    }
    
    /**
     * Export to WAV
     */
    async exportToWav(audioBuffer, options = {}) {
        const { bitDepth = 16 } = options;
        const wavData = this.audioBufferToWav(audioBuffer, bitDepth);
        
        return new Blob([wavData], { type: 'audio/wav' });
    }
    
    /**
     * Export to AIFF
     */
    async exportToAiff(audioBuffer, options = {}) {
        const aiffData = this.audioBufferToAiff(audioBuffer);
        return new Blob([aiffData], { type: 'audio/aiff' });
    }
    
    /**
     * Calculate sequence duration
     */
    calculateDuration(sequence, bpm, tailLength = 1.0) {
        if (!sequence.notes || sequence.notes.length === 0) {
            return tailLength;
        }
        
        const beatDuration = 60 / bpm;
        let maxEnd = 0;
        
        for (const note of sequence.notes) {
            const noteStart = note.time * beatDuration;
            const noteDuration = note.duration * beatDuration;
            const noteEnd = noteStart + noteDuration;
            
            if (noteEnd > maxEnd) {
                maxEnd = noteEnd;
            }
        }
        
        return maxEnd + tailLength;
    }
    
    /**
     * Setup effect chain
     */
    async setupEffectChain(audioContext, effects) {
        let input = audioContext.destination;
        let lastNode = input;
        
        // Build chain in reverse order
        for (let i = effects.length - 1; i >= 0; i--) {
            const effect = effects[i];
            const node = this.createEffectNode(audioContext, effect);
            
            if (node) {
                node.connect(lastNode);
                lastNode = node;
            }
        }
        
        return {
            input: lastNode === audioContext.destination ? audioContext.destination : lastNode,
            output: audioContext.destination
        };
    }
    
    /**
     * Create effect node
     */
    createEffectNode(audioContext, effect) {
        if (!effect || !effect.type) return null;
        
        let node;
        
        switch (effect.type) {
            case 'reverb':
                node = this.createReverbNode(audioContext, effect.params);
                break;
            case 'delay':
                node = this.createDelayNode(audioContext, effect.params);
                break;
            case 'eq':
                node = this.createEQNode(audioContext, effect.params);
                break;
            case 'compressor':
                node = audioContext.createDynamicsCompressor();
                if (effect.params) {
                    node.threshold.value = effect.params.threshold || -24;
                    node.knee.value = effect.params.knee || 30;
                    node.ratio.value = effect.params.ratio || 4;
                    node.attack.value = effect.params.attack || 0.003;
                    node.release.value = effect.params.release || 0.25;
                }
                break;
            case 'gain':
                node = audioContext.createGain();
                node.gain.value = effect.params?.gain || 1;
                break;
            default:
                node = null;
        }
        
        return node;
    }
    
    /**
     * Create reverb node (convolver)
     */
    createReverbNode(audioContext, params = {}) {
        const { decay = 2.0, preDelay = 0.01 } = params;
        
        const sampleRate = audioContext.sampleRate;
        const length = sampleRate * decay;
        const impulse = audioContext.createBuffer(2, length, sampleRate);
        
        for (let ch = 0; ch < 2; ch++) {
            const channelData = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                if (t < preDelay) {
                    channelData[i] = 0;
                } else {
                    const envelope = Math.exp(-3 * (t - preDelay) / decay);
                    channelData[i] = (Math.random() * 2 - 1) * envelope;
                }
            }
        }
        
        const convolver = audioContext.createConvolver();
        convolver.buffer = impulse;
        
        // Create wet/dry mix
        const dry = audioContext.createGain();
        const wet = audioContext.createGain();
        dry.gain.value = 1 - (params.wet || 0.3);
        wet.gain.value = params.wet || 0.3;
        
        return { convolver, dry, wet };
    }
    
    /**
     * Create delay node
     */
    createDelayNode(audioContext, params = {}) {
        const { time = 0.5, feedback = 0.3, wet = 0.3 } = params;
        
        const delay = audioContext.createDelay(5.0);
        delay.delayTime.value = time;
        
        const feedbackNode = audioContext.createGain();
        feedbackNode.gain.value = feedback;
        
        const wetNode = audioContext.createGain();
        wetNode.gain.value = wet;
        
        delay.connect(feedbackNode);
        feedbackNode.connect(delay);
        delay.connect(wetNode);
        
        return { delay, feedback: feedbackNode, wet: wetNode };
    }
    
    /**
     * Create EQ node
     */
    createEQNode(audioContext, params = {}) {
        const low = audioContext.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = params.lowFreq || 200;
        low.gain.value = params.lowGain || 0;
        
        const mid = audioContext.createBiquadFilter();
        mid.type = 'peaking';
        mid.frequency.value = params.midFreq || 1000;
        mid.Q.value = 1;
        mid.gain.value = params.midGain || 0;
        
        const high = audioContext.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = params.highFreq || 4000;
        high.gain.value = params.highGain || 0;
        
        low.connect(mid);
        mid.connect(high);
        
        return { low, mid, high, input: low, output: high };
    }
    
    /**
     * Render individual note
     */
    async renderNote(audioContext, note, options) {
        const { bpm, instrument, destination, sampleRate } = options;
        const beatDuration = 60 / bpm;
        
        const startTime = note.time * beatDuration;
        const duration = note.duration * beatDuration;
        const frequency = this.midiToFrequency(note.pitch);
        const velocity = note.velocity / 127;
        
        // Create oscillator or use instrument
        if (instrument && instrument.type === 'sampler') {
            await this.renderSamplerNote(audioContext, note, options);
        } else {
            // Default synthesizer rendering
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.type = instrument?.waveform || 'sine';
            osc.frequency.value = frequency;
            
            // ADSR envelope
            const attack = instrument?.attack || 0.01;
            const decay = instrument?.decay || 0.1;
            const sustain = instrument?.sustain || 0.7;
            const release = instrument?.release || 0.3;
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(velocity, startTime + attack);
            gain.gain.linearRampToValueAtTime(velocity * sustain, startTime + attack + decay);
            gain.gain.setValueAtTime(velocity * sustain, startTime + duration - release);
            gain.gain.linearRampToValueAtTime(0, startTime + duration);
            
            osc.connect(gain);
            gain.connect(destination || audioContext.destination);
            
            osc.start(startTime);
            osc.stop(startTime + duration + release + 0.1);
        }
    }
    
    /**
     * Render sampler note
     */
    async renderSamplerNote(audioContext, note, options) {
        // Placeholder for sampler rendering
        // In a full implementation, this would load and trigger samples
        const { instrument, destination, bpm } = options;
        
        // Create basic synthesis as fallback
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.frequency.value = this.midiToFrequency(note.pitch);
        gain.gain.value = note.velocity / 127;
        
        osc.connect(gain);
        gain.connect(destination || audioContext.destination);
        
        const beatDuration = 60 / bpm;
        const startTime = note.time * beatDuration;
        const duration = note.duration * beatDuration;
        
        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
    }
    
    /**
     * Normalize audio buffer
     */
    normalizeBuffer(audioBuffer) {
        let maxSample = 0;
        
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const data = audioBuffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                const abs = Math.abs(data[i]);
                if (abs > maxSample) {
                    maxSample = abs;
                }
            }
        }
        
        if (maxSample === 0 || maxSample >= 1) {
            return audioBuffer;
        }
        
        const normalizeGain = 0.99 / maxSample;
        
        const offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        
        const gain = offlineCtx.createGain();
        gain.gain.value = normalizeGain;
        
        source.connect(gain);
        gain.connect(offlineCtx.destination);
        source.start();
        
        return offlineCtx.startRendering();
    }
    
    /**
     * Convert MIDI note to frequency
     */
    midiToFrequency(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
    
    /**
     * Convert AudioBuffer to WAV data
     */
    audioBufferToWav(buffer, bitDepth = 16) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = length * blockAlign;
        const bufferSize = 44 + dataSize;
        
        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);
        
        // Write WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, bufferSize - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);
        
        // Write audio data
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                
                if (bitDepth === 16) {
                    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    view.setInt16(offset, intSample, true);
                } else if (bitDepth === 24) {
                    const intSample = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
                    view.setUint8(offset, intSample & 0xFF);
                    view.setUint8(offset + 1, (intSample >> 8) & 0xFF);
                    view.setUint8(offset + 2, (intSample >> 16) & 0xFF);
                } else {
                    view.setFloat32(offset, sample, true);
                }
                
                offset += bytesPerSample;
            }
        }
        
        return arrayBuffer;
    }
    
    /**
     * Convert AudioBuffer to AIFF data
     */
    audioBufferToAiff(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const bitDepth = 16;
        const bytesPerSample = 2;
        const blockAlign = numChannels * bytesPerSample;
        const dataSize = length * blockAlign;
        
        const commonChunkSize = 18;
        const soundDataChunkSize = 8 + dataSize;
        const formSize = 4 + 8 + commonChunkSize + 8 + soundDataChunkSize;
        
        const arrayBuffer = new ArrayBuffer(12 + formSize);
        const view = new DataView(arrayBuffer);
        
        // AIFF header (big-endian)
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'FORM');
        view.setUint32(4, formSize, false);
        writeString(8, 'AIFF');
        
        // COMM chunk
        writeString(12, 'COMM');
        view.setUint32(16, commonChunkSize, false);
        view.setUint16(20, numChannels, false);
        view.setUint32(22, length, false);
        view.setUint16(26, bitDepth, false);
        
        // Sample rate as extended precision (80-bit)
        // Simplified: just store as integer
        const srBytes = new Uint8Array(10);
        srBytes[0] = 0x40;
        srBytes[1] = 0x0E + Math.floor(Math.log2(sampleRate));
        for (let i = 0; i < 8; i++) {
            srBytes[2 + i] = 0xAC; // Placeholder
        }
        for (let i = 0; i < 10; i++) {
            view.setUint8(28 + i, srBytes[i]);
        }
        
        // SSND chunk
        writeString(38, 'SSND');
        view.setUint32(42, soundDataChunkSize, false);
        view.setUint32(46, 0, false); // offset
        view.setUint32(50, 0, false); // block size
        
        // Write audio data
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        let offset = 54;
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, false); // Big-endian
                offset += 2;
            }
        }
        
        return arrayBuffer;
    }
    
    /**
     * Get available presets
     */
    getPresets() {
        return Object.keys(this.presets);
    }
    
    /**
     * Get available formats
     */
    getFormats() {
        return Object.keys(this.formats);
    }
    
    /**
     * Get render history
     */
    getHistory() {
        return [...this.renderHistory];
    }
    
    /**
     * Check if currently rendering
     */
    isCurrentlyRendering() {
        return this.isRendering;
    }
}

// UI Panel
function openMIDIToAudioPanel() {
    const existing = document.getElementById('midi-to-audio-panel');
    if (existing) {
        existing.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'midi-to-audio-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #3b82f6;
        border-radius: 12px;
        padding: 24px;
        width: 550px;
        max-height: 85vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #3b82f6; font-size: 20px;">🎹 MIDI to Audio Conversion</h2>
            <button id="close-midi-audio-panel" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Render Preset</label>
            <select id="render-preset" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                <option value="standard">Standard (44.1kHz, 16-bit)</option>
                <option value="highQuality">High Quality (48kHz, 24-bit)</option>
                <option value="draft">Draft (Fast render)</option>
                <option value="streaming">Streaming Ready (-14 LUFS)</option>
            </select>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div>
                <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Output Format</label>
                <select id="output-format" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                    <option value="wav">WAV</option>
                    <option value="aiff">AIFF</option>
                    <option value="flac">FLAC (requires library)</option>
                </select>
            </div>
            <div>
                <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Tail Length (seconds)</label>
                <input type="number" id="tail-length" value="1.5" min="0" max="10" step="0.5" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; color: #9ca3af; font-size: 12px; margin-bottom: 8px;">
                <input type="checkbox" id="normalize-audio" checked style="margin-right: 8px;">
                Normalize Audio
            </label>
            <label style="display: flex; align-items: center; color: #9ca3af; font-size: 12px;">
                <input type="checkbox" id="render-all-tracks" style="margin-right: 8px;">
                Render All Tracks (Mix to Stereo)
            </label>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Instrument Synthesis</label>
            <select id="synth-type" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                <option value="sine">Sine Wave</option>
                <option value="triangle">Triangle Wave</option>
                <option value="square">Square Wave</option>
                <option value="sawtooth">Sawtooth Wave</option>
                <option value="piano">Piano (Basic)</option>
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Envelope</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                <div>
                    <label style="font-size: 10px; color: #6b7280;">Attack</label>
                    <input type="number" id="attack-time" value="0.01" min="0" max="2" step="0.01" style="width: 100%; padding: 6px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white; font-size: 11px;">
                </div>
                <div>
                    <label style="font-size: 10px; color: #6b7280;">Decay</label>
                    <input type="number" id="decay-time" value="0.1" min="0" max="2" step="0.01" style="width: 100%; padding: 6px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white; font-size: 11px;">
                </div>
                <div>
                    <label style="font-size: 10px; color: #6b7280;">Sustain</label>
                    <input type="number" id="sustain-level" value="0.7" min="0" max="1" step="0.1" style="width: 100%; padding: 6px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white; font-size: 11px;">
                </div>
                <div>
                    <label style="font-size: 10px; color: #6b7280;">Release</label>
                    <input type="number" id="release-time" value="0.3" min="0" max="5" step="0.1" style="width: 100%; padding: 6px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white; font-size: 11px;">
                </div>
            </div>
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button id="render-midi" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Render MIDI
            </button>
            <button id="render-and-download" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Render & Download
            </button>
        </div>
        
        <div id="render-progress" style="display: none; background: #0a0a14; border-radius: 6px; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span id="render-progress-text" style="color: #9ca3af; font-size: 12px;">Initializing...</span>
            </div>
            <div style="background: #1f2937; height: 6px; border-radius: 3px; margin-top: 12px;">
                <div id="render-progress-bar" style="background: linear-gradient(90deg, #3b82f6, #10b981); height: 100%; border-radius: 3px; width: 0%; transition: width 0.3s;"></div>
            </div>
        </div>
        
        <div id="render-result" style="display: none; margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 6px;">
            <h3 style="margin: 0 0 8px; color: #10b981; font-size: 14px;">✅ Render Complete</h3>
            <div id="render-info" style="color: #9ca3af; font-size: 12px;"></div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-midi-audio-panel').onclick = () => panel.remove();
    
    const converter = new MIDIToAudioConversion();
    
    const doRender = async (download = false) => {
        const progressDiv = document.getElementById('render-progress');
        const progressText = document.getElementById('render-progress-text');
        const progressBar = document.getElementById('render-progress-bar');
        const resultDiv = document.getElementById('render-result');
        const resultInfo = document.getElementById('render-info');
        
        progressDiv.style.display = 'block';
        resultDiv.style.display = 'none';
        
        try {
            // Get sequence from selected track
            const sequence = window.getSelectedTrackSequence ? 
                window.getSelectedTrackSequence() : null;
            
            if (!sequence || !sequence.notes || sequence.notes.length === 0) {
                progressText.textContent = '❌ No MIDI sequence selected';
                return;
            }
            
            const preset = document.getElementById('render-preset').value;
            const format = document.getElementById('output-format').value;
            const tailLength = parseFloat(document.getElementById('tail-length').value);
            const normalize = document.getElementById('normalize-audio').checked;
            const synthType = document.getElementById('synth-type').value;
            
            const instrument = {
                type: 'synth',
                waveform: synthType === 'piano' ? 'triangle' : synthType,
                attack: parseFloat(document.getElementById('attack-time').value),
                decay: parseFloat(document.getElementById('decay-time').value),
                sustain: parseFloat(document.getElementById('sustain-level').value),
                release: parseFloat(document.getElementById('release-time').value)
            };
            
            const buffer = await converter.renderToAudio(sequence, {
                preset,
                tailLength,
                normalize,
                instrument,
                onProgress: (p) => {
                    progressText.textContent = p.status;
                    progressBar.style.width = p.progress + '%';
                }
            });
            
            progressText.textContent = '✅ Complete!';
            progressBar.style.width = '100%';
            
            resultDiv.style.display = 'block';
            resultInfo.innerHTML = `
                Duration: ${buffer.duration.toFixed(2)}s<br>
                Sample Rate: ${buffer.sampleRate}Hz<br>
                Channels: ${buffer.numberOfChannels}
            `;
            
            if (download) {
                const blob = await converter.exportToFile(buffer, format);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `rendered.${format}`;
                a.click();
                URL.revokeObjectURL(url);
            }
            
            // Store for playback
            window.renderedBuffer = buffer;
            
        } catch (error) {
            progressText.textContent = `❌ Error: ${error.message}`;
            console.error(error);
        }
    };
    
    document.getElementById('render-midi').onclick = () => doRender(false);
    document.getElementById('render-and-download').onclick = () => doRender(true);
}

// Export
window.MIDIToAudioConversion = MIDIToAudioConversion;
window.openMIDIToAudioPanel = openMIDIToAudioPanel;

console.log('[MIDIToAudioConversion] Module loaded');
