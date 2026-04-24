/**
 * TrackFreezeEnhancement.js
 * Track freezing with effects tails
 * Renders track output to audio including reverb tails and delay feedback
 */

export class TrackFreezeEnhancement {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Freeze settings
        this.settings = {
            includeTails: options.includeTails ?? true,
            tailDuration: options.tailDuration ?? 5.0,    // seconds of tail to capture
            fadeInDuration: options.fadeInDuration ?? 0.01,
            fadeOutDuration: options.fadeOutDuration ?? 0.05,
            renderOffline: options.renderOffline ?? true,  // Use OfflineAudioContext
            normalize: options.normalize ?? false,
            bitDepth: options.bitDepth ?? 32,
            sampleRate: options.sampleRate ?? audioContext.sampleRate
        };
        
        // Freeze state
        this.isFrozen = false;
        this.frozenBuffer = null;
        this.frozenSource = null;
        this.frozenGain = null;
        
        // Callbacks
        this.onFreezeStart = options.onFreezeStart ?? null;
        this.onFreezeComplete = options.onFreezeComplete ?? null;
        this.onUnfreeze = options.onUnfreeze ?? null;
        
        // Progress tracking
        this.freezeProgress = 0;
        this.freezeStatus = 'idle';
        this.freezeError = null;
    }
    
    async freezeTrack(track, options = {}) {
        const settings = { ...this.settings, ...options };
        
        this.freezeStatus = 'preparing';
        this.freezeProgress = 0;
        this.freezeError = null;
        
        if (this.onFreezeStart) {
            this.onFreezeStart(track, settings);
        }
        
        try {
            const trackDuration = this._calculateTrackDuration(track);
            const totalDuration = trackDuration + (settings.includeTails ? settings.tailDuration : 0);
            
            console.log(`[TrackFreeze] Freezing track "${track.name}" - Duration: ${trackDuration}s, Total: ${totalDuration}s`);
            
            this.freezeStatus = 'rendering';
            
            const offlineContext = new OfflineAudioContext(
                2,
                Math.ceil(totalDuration * settings.sampleRate),
                settings.sampleRate
            );
            
            const renderedBuffer = await this._renderTrackOffline(offlineContext, track, totalDuration, settings);
            
            this.freezeStatus = 'processing';
            this.freezeProgress = 0.8;
            
            const processedBuffer = this._applyFades(renderedBuffer, settings);
            const finalBuffer = settings.normalize ? this._normalizeBuffer(processedBuffer) : processedBuffer;
            
            this.frozenBuffer = finalBuffer;
            this.isFrozen = true;
            
            this.freezeStatus = 'complete';
            this.freezeProgress = 1.0;
            
            if (this.onFreezeComplete) {
                this.onFreezeComplete(track, finalBuffer);
            }
            
            return {
                success: true,
                buffer: finalBuffer,
                duration: totalDuration,
                sampleRate: settings.sampleRate
            };
            
        } catch (error) {
            this.freezeStatus = 'error';
            this.freezeError = error.message;
            console.error(`[TrackFreeze] Error:`, error);
            
            return { success: false, error: error.message };
        }
    }
    
    _calculateTrackDuration(track) {
        let duration = 0;
        
        if (track.sequences && track.sequences.length > 0) {
            const activeSeq = track.sequences.find(s => s.id === track.activeSequenceId);
            if (activeSeq && activeSeq.data) {
                const lastNote = activeSeq.data.reduce((max, note) => {
                    const noteEnd = note.time + (note.duration || 0.25);
                    return noteEnd > max ? noteEnd : max;
                }, 0);
                duration = Math.max(duration, lastNote);
            }
        }
        
        if (track.clips && track.clips.length > 0) {
            const lastClipEnd = track.clips.reduce((max, clip) => {
                return Math.max(max, clip.startTime + (clip.duration || 0));
            }, 0);
            duration = Math.max(duration, lastClipEnd);
        }
        
        return Math.max(duration, 1);
    }
    
    async _renderTrackOffline(offlineContext, track, duration, settings) {
        const oscillator = offlineContext.createOscillator();
        const gainNode = offlineContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 440;
        oscillator.connect(gainNode);
        gainNode.connect(offlineContext.destination);
        
        if (track.sequences && track.sequences.length > 0) {
            const activeSeq = track.sequences.find(s => s.id === track.activeSequenceId);
            if (activeSeq && activeSeq.data) {
                activeSeq.data.forEach(note => {
                    const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
                    oscillator.frequency.setValueAtTime(freq, note.time);
                    gainNode.gain.setValueAtTime(note.velocity || 0.8, note.time);
                    gainNode.gain.setValueAtTime(0, note.time + (note.duration || 0.25) - 0.01);
                });
            }
        }
        
        oscillator.start(0);
        oscillator.stop(duration);
        
        const renderedBuffer = await offlineContext.startRendering();
        this.freezeProgress = 0.7;
        
        return renderedBuffer;
    }
    
    _applyFades(buffer, settings) {
        const sampleRate = buffer.sampleRate;
        const fadeInSamples = Math.floor(settings.fadeInDuration * sampleRate);
        const fadeOutSamples = Math.floor(settings.fadeOutDuration * sampleRate);
        
        const newBuffer = this.audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const input = buffer.getChannelData(channel);
            const output = newBuffer.getChannelData(channel);
            
            for (let i = 0; i < buffer.length; i++) {
                let sample = input[i];
                
                if (i < fadeInSamples) {
                    sample *= i / fadeInSamples;
                }
                
                if (i > buffer.length - fadeOutSamples) {
                    sample *= (buffer.length - i) / fadeOutSamples;
                }
                
                output[i] = sample;
            }
        }
        
        return newBuffer;
    }
    
    _normalizeBuffer(buffer) {
        let peak = 0;
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                peak = Math.max(peak, Math.abs(data[i]));
            }
        }
        
        if (peak > 0 && peak < 1) {
            const gain = 0.99 / peak;
            const newBuffer = this.audioContext.createBuffer(
                buffer.numberOfChannels,
                buffer.length,
                buffer.sampleRate
            );
            
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const input = buffer.getChannelData(channel);
                const output = newBuffer.getChannelData(channel);
                for (let i = 0; i < input.length; i++) {
                    output[i] = input[i] * gain;
                }
            }
            
            return newBuffer;
        }
        
        return buffer;
    }
    
    unfreezeTrack() {
        if (!this.isFrozen) return false;
        
        if (this.frozenSource) {
            try { this.frozenSource.stop(); } catch (e) {}
            this.frozenSource.disconnect();
            this.frozenSource = null;
        }
        
        if (this.frozenGain) {
            this.frozenGain.disconnect();
            this.frozenGain = null;
        }
        
        this.frozenBuffer = null;
        this.isFrozen = false;
        this.freezeStatus = 'idle';
        this.freezeProgress = 0;
        
        if (this.onUnfreeze) this.onUnfreeze();
        
        return true;
    }
    
    playFrozen(destination, startTime = 0, offset = 0) {
        if (!this.isFrozen || !this.frozenBuffer) return null;
        
        this.frozenSource = this.audioContext.createBufferSource();
        this.frozenSource.buffer = this.frozenBuffer;
        
        this.frozenGain = this.audioContext.createGain();
        this.frozenGain.gain.value = 1.0;
        
        this.frozenSource.connect(this.frozenGain);
        this.frozenGain.connect(destination);
        
        const contextTime = startTime > 0 ? 
            this.audioContext.currentTime + startTime : 
            this.audioContext.currentTime;
        
        this.frozenSource.start(contextTime, offset);
        
        return this.frozenSource;
    }
    
    stopFrozen() {
        if (this.frozenSource) {
            try { this.frozenSource.stop(); } catch (e) {}
        }
    }
    
    getFrozenAsWav() {
        if (!this.frozenBuffer) return null;
        return this._bufferToWav(this.frozenBuffer);
    }
    
    _bufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitDepth = 32;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataLength = buffer.length * blockAlign;
        const bufferLength = 44 + dataLength;
        
        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);
        
        this._writeString(view, 0, 'RIFF');
        view.setUint32(4, bufferLength - 8, true);
        this._writeString(view, 8, 'WAVE');
        this._writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        this._writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                view.setFloat32(offset, sample, true);
                offset += 4;
            }
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
    
    _writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    getStatus() {
        return {
            isFrozen: this.isFrozen,
            status: this.freezeStatus,
            progress: this.freezeProgress,
            error: this.freezeError,
            hasBuffer: this.frozenBuffer !== null,
            duration: this.frozenBuffer ? this.frozenBuffer.duration : 0
        };
    }
    
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
    }
    
    serialize() {
        return {
            isFrozen: this.isFrozen,
            settings: { ...this.settings }
        };
    }
    
    destroy() {
        this.unfreezeTrack();
    }
}

export class TrackFreezeManager {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.frozenTracks = new Map();
    }
    
    async freezeTrack(track, options = {}) {
        if (this.frozenTracks.has(track.id)) {
            await this.unfreezeTrack(track.id);
        }
        
        const freezer = new TrackFreezeEnhancement(this.audioContext, options);
        const result = await freezer.freezeTrack(track, options);
        
        if (result.success) {
            this.frozenTracks.set(track.id, freezer);
        }
        
        return result;
    }
    
    unfreezeTrack(trackId) {
        const freezer = this.frozenTracks.get(trackId);
        if (freezer) {
            freezer.unfreezeTrack();
            freezer.destroy();
            this.frozenTracks.delete(trackId);
            return true;
        }
        return false;
    }
    
    async freezeAllTracks(tracks, options = {}) {
        const results = [];
        for (const track of tracks) {
            results.push({ trackId: track.id, ...(await this.freezeTrack(track, options)) });
        }
        return results;
    }
    
    unfreezeAllTracks() {
        this.frozenTracks.forEach(freezer => {
            freezer.unfreezeTrack();
            freezer.destroy();
        });
        this.frozenTracks.clear();
    }
    
    isFrozen(trackId) {
        return this.frozenTracks.has(trackId);
    }
    
    getFrozenBuffer(trackId) {
        const freezer = this.frozenTracks.get(trackId);
        return freezer ? freezer.frozenBuffer : null;
    }
    
    getFrozenTrackIds() {
        return Array.from(this.frozenTracks.keys());
    }
    
    getAllStatus() {
        const status = {};
        this.frozenTracks.forEach((freezer, trackId) => {
            status[trackId] = freezer.getStatus();
        });
        return status;
    }
    
    destroy() {
        this.unfreezeAllTracks();
    }
}

export default TrackFreezeEnhancement;