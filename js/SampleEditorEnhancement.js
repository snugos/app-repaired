/**
 * Sample Editor Enhancement - Full sample editing capabilities
 * Provides comprehensive sample editing tools
 */

class SampleEditorEnhancement {
    constructor(audioContext, options = {}) {
        this.name = 'SampleEditorEnhancement';
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            undoLimit: options.undoLimit || 50,
            defaultFadeLength: options.defaultFadeLength || 0.01,
            snapToZeroCrossing: options.snapToZeroCrossing ?? true,
            ...options
        };
        
        // Current sample
        this.sample = null;
        this.sampleBuffer = null;
        this.sampleRate = audioContext.sampleRate;
        
        // Selection
        this.selection = {
            start: 0,
            end: 0
        };
        
        // Edit history
        this.undoStack = [];
        this.redoStack = [];
        
        // Markers
        this.markers = [];
        this.loopPoints = { start: 0, end: 0, enabled: false };
        
        // Playback
        this.isPlaying = false;
        this.playbackSource = null;
        this.playbackPosition = 0;
        
        // UI
        this.canvas = null;
        this.ctx = null;
        this.container = null;
        this.zoom = 1;
        this.scrollOffset = 0;
        
        // Callbacks
        this.onSampleChange = null;
        this.onSelectionChange = null;
        this.onPlaybackPosition = null;
    }
    
    // Sample loading
    async loadSample(url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.sampleBuffer = audioBuffer;
            this.sample = {
                url,
                duration: audioBuffer.duration,
                numberOfChannels: audioBuffer.numberOfChannels,
                sampleRate: audioBuffer.sampleRate,
                name: url.split('/').pop()
            };
            
            this.selection = { start: 0, end: audioBuffer.length };
            this.loopPoints = { start: 0, end: audioBuffer.length, enabled: false };
            this.markers = [];
            this.undoStack = [];
            this.redoStack = [];
            
            this.draw();
            
            if (this.onSampleChange) {
                this.onSampleChange(this.sample);
            }
            
            return audioBuffer;
        } catch (err) {
            console.error('[SampleEditorEnhancement] Failed to load sample:', err);
            throw err;
        }
    }
    
    async loadFromArrayBuffer(arrayBuffer, name = 'Untitled') {
        try {
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.sampleBuffer = audioBuffer;
            this.sample = {
                url: null,
                duration: audioBuffer.duration,
                numberOfChannels: audioBuffer.numberOfChannels,
                sampleRate: audioBuffer.sampleRate,
                name
            };
            
            this.selection = { start: 0, end: audioBuffer.length };
            this.loopPoints = { start: 0, end: audioBuffer.length, enabled: false };
            this.markers = [];
            this.undoStack = [];
            this.redoStack = [];
            
            this.draw();
            
            if (this.onSampleChange) {
                this.onSampleChange(this.sample);
            }
            
            return audioBuffer;
        } catch (err) {
            console.error('[SampleEditorEnhancement] Failed to load sample:', err);
            throw err;
        }
    }
    
    // Selection
    setSelection(start, end) {
        if (!this.sampleBuffer) return;
        
        start = Math.max(0, Math.min(this.sampleBuffer.length, start));
        end = Math.max(0, Math.min(this.sampleBuffer.length, end));
        
        if (start > end) {
            [start, end] = [end, start];
        }
        
        this.selection = { start, end };
        
        if (this.onSelectionChange) {
            this.onSelectionChange(this.selection);
        }
        
        this.draw();
    }
    
    selectAll() {
        if (!this.sampleBuffer) return;
        this.setSelection(0, this.sampleBuffer.length);
    }
    
    selectNone() {
        if (!this.sampleBuffer) return;
        const mid = Math.floor(this.sampleBuffer.length / 2);
        this.setSelection(mid, mid);
    }
    
    // Editing operations
    saveState() {
        if (!this.sampleBuffer) return;
        
        // Copy buffer data
        const bufferData = [];
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            bufferData.push(new Float32Array(this.sampleBuffer.getChannelData(ch)));
        }
        
        this.undoStack.push({
            bufferData,
            selection: { ...this.selection },
            markers: [...this.markers],
            loopPoints: { ...this.loopPoints }
        });
        
        if (this.undoStack.length > this.config.undoLimit) {
            this.undoStack.shift();
        }
        
        this.redoStack = [];
    }
    
    undo() {
        if (this.undoStack.length === 0) return false;
        
        // Save current state to redo stack
        this.redoStack.push({
            bufferData: this.getCurrentBufferData(),
            selection: { ...this.selection },
            markers: [...this.markers],
            loopPoints: { ...this.loopPoints }
        });
        
        // Restore previous state
        const state = this.undoStack.pop();
        this.restoreState(state);
        
        return true;
    }
    
    redo() {
        if (this.redoStack.length === 0) return false;
        
        // Save current state to undo stack
        this.undoStack.push({
            bufferData: this.getCurrentBufferData(),
            selection: { ...this.selection },
            markers: [...this.markers],
            loopPoints: { ...this.loopPoints }
        });
        
        // Restore next state
        const state = this.redoStack.pop();
        this.restoreState(state);
        
        return true;
    }
    
    getCurrentBufferData() {
        if (!this.sampleBuffer) return [];
        
        const data = [];
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            data.push(new Float32Array(this.sampleBuffer.getChannelData(ch)));
        }
        return data;
    }
    
    restoreState(state) {
        // Create new buffer with saved data
        const newBuffer = this.audioContext.createBuffer(
            this.sampleBuffer.numberOfChannels,
            state.bufferData[0].length,
            this.sampleBuffer.sampleRate
        );
        
        for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
            newBuffer.copyToChannel(state.bufferData[ch], ch);
        }
        
        this.sampleBuffer = newBuffer;
        this.selection = state.selection;
        this.markers = state.markers;
        this.loopPoints = state.loopPoints;
        
        this.draw();
        
        if (this.onSampleChange) {
            this.onSampleChange(this.sample);
        }
    }
    
    // Cut/Copy/Paste/Delete
    cut() {
        const copied = this.copy();
        this.delete();
        return copied;
    }
    
    copy() {
        if (!this.sampleBuffer) return null;
        
        const { start, end } = this.selection;
        if (start === end) return null;
        
        const length = end - start;
        const copiedData = [];
        
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            const channelData = this.sampleBuffer.getChannelData(ch);
            copiedData.push(channelData.slice(start, end));
        }
        
        return {
            data: copiedData,
            sampleRate: this.sampleBuffer.sampleRate,
            numberOfChannels: this.sampleBuffer.numberOfChannels
        };
    }
    
    paste(clipboardData) {
        if (!this.sampleBuffer || !clipboardData) return false;
        
        this.saveState();
        
        const { start } = this.selection;
        const pasteLength = clipboardData.data[0].length;
        const newLength = this.sampleBuffer.length + pasteLength;
        
        const newBuffer = this.audioContext.createBuffer(
            this.sampleBuffer.numberOfChannels,
            newLength,
            this.sampleBuffer.sampleRate
        );
        
        for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
            const newChannel = newBuffer.getChannelData(ch);
            const oldChannel = this.sampleBuffer.getChannelData(ch);
            const pasteChannel = clipboardData.data[ch];
            
            // Copy before
            newChannel.set(oldChannel.slice(0, start), 0);
            // Paste
            newChannel.set(pasteChannel, start);
            // Copy after
            newChannel.set(oldChannel.slice(start), start + pasteLength);
        }
        
        this.sampleBuffer = newBuffer;
        this.selection = { start, end: start + pasteLength };
        
        this.draw();
        
        if (this.onSampleChange) {
            this.onSampleChange(this.sample);
        }
        
        return true;
    }
    
    delete() {
        if (!this.sampleBuffer) return false;
        
        const { start, end } = this.selection;
        if (start === end) return false;
        
        this.saveState();
        
        const deleteLength = end - start;
        const newLength = this.sampleBuffer.length - deleteLength;
        
        const newBuffer = this.audioContext.createBuffer(
            this.sampleBuffer.numberOfChannels,
            newLength,
            this.sampleBuffer.sampleRate
        );
        
        for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
            const newChannel = newBuffer.getChannelData(ch);
            const oldChannel = this.sampleBuffer.getChannelData(ch);
            
            // Copy before selection
            newChannel.set(oldChannel.slice(0, start), 0);
            // Copy after selection
            newChannel.set(oldChannel.slice(end), start);
        }
        
        this.sampleBuffer = newBuffer;
        this.selection = { start, end: start };
        
        // Adjust markers
        this.markers = this.markers.map(m => {
            if (m.position > end) {
                return { ...m, position: m.position - deleteLength };
            } else if (m.position > start) {
                return { ...m, position: start };
            }
            return m;
        }).filter(m => m.position >= 0 && m.position < newLength);
        
        // Adjust loop points
        if (this.loopPoints.start > end) {
            this.loopPoints.start -= deleteLength;
            this.loopPoints.end -= deleteLength;
        } else if (this.loopPoints.start > start) {
            this.loopPoints.start = start;
            this.loopPoints.end = Math.max(start, this.loopPoints.end - deleteLength);
        }
        
        this.draw();
        
        if (this.onSampleChange) {
            this.onSampleChange(this.sample);
        }
        
        return true;
    }
    
    // Silence
    insertSilence(duration) {
        if (!this.sampleBuffer) return false;
        
        this.saveState();
        
        const silenceSamples = Math.round(duration * this.sampleBuffer.sampleRate);
        const insertPos = this.selection.start;
        const newLength = this.sampleBuffer.length + silenceSamples;
        
        const newBuffer = this.audioContext.createBuffer(
            this.sampleBuffer.numberOfChannels,
            newLength,
            this.sampleBuffer.sampleRate
        );
        
        for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
            const newChannel = newBuffer.getChannelData(ch);
            const oldChannel = this.sampleBuffer.getChannelData(ch);
            
            newChannel.set(oldChannel.slice(0, insertPos), 0);
            // Silence is already zero
            newChannel.set(oldChannel.slice(insertPos), insertPos + silenceSamples);
        }
        
        this.sampleBuffer = newBuffer;
        
        this.draw();
        
        if (this.onSampleChange) {
            this.onSampleChange(this.sample);
        }
        
        return true;
    }
    
    muteSelection() {
        if (!this.sampleBuffer) return false;
        
        const { start, end } = this.selection;
        if (start === end) return false;
        
        this.saveState();
        
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            const channelData = this.sampleBuffer.getChannelData(ch);
            for (let i = start; i < end; i++) {
                channelData[i] = 0;
            }
        }
        
        this.draw();
        
        if (this.onSampleChange) {
            this.onSampleChange(this.sample);
        }
        
        return true;
    }
    
    // Fade operations
    fadeInSelection(duration = null) {
        if (!this.sampleBuffer) return false;
        
        const { start, end } = this.selection;
        if (start === end) return false;
        
        this.saveState();
        
        const fadeLength = duration ? Math.round(duration * this.sampleBuffer.sampleRate) : end - start;
        const fadeStart = duration ? start : start;
        const fadeEnd = duration ? Math.min(start + fadeLength, end) : end;
        
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            const channelData = this.sampleBuffer.getChannelData(ch);
            for (let i = fadeStart; i < fadeEnd; i++) {
                const t = (i - fadeStart) / (fadeEnd - fadeStart);
                channelData[i] *= t;
            }
        }
        
        this.draw();
        return true;
    }
    
    fadeOutSelection(duration = null) {
        if (!this.sampleBuffer) return false;
        
        const { start, end } = this.selection;
        if (start === end) return false;
        
        this.saveState();
        
        const fadeLength = duration ? Math.round(duration * this.sampleBuffer.sampleRate) : end - start;
        const fadeStart = duration ? Math.max(end - fadeLength, start) : start;
        const fadeEnd = duration ? end : end;
        
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            const channelData = this.sampleBuffer.getChannelData(ch);
            for (let i = fadeStart; i < fadeEnd; i++) {
                const t = 1 - (i - fadeStart) / (fadeEnd - fadeStart);
                channelData[i] *= t;
            }
        }
        
        this.draw();
        return true;
    }
    
    crossfade(fadeLength = 0.01) {
        // Apply crossfade at selection boundaries
        this.fadeInSelection(fadeLength);
        this.fadeOutSelection(fadeLength);
    }
    
    // Normalize
    normalizeSelection(targetDb = -1) {
        if (!this.sampleBuffer) return false;
        
        const { start, end } = this.selection;
        if (start === end) return false;
        
        this.saveState();
        
        // Find peak
        let peak = 0;
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            const channelData = this.sampleBuffer.getChannelData(ch);
            for (let i = start; i < end; i++) {
                peak = Math.max(peak, Math.abs(channelData[i]));
            }
        }
        
        if (peak === 0) return false;
        
        const targetLinear = Math.pow(10, targetDb / 20);
        const gain = targetLinear / peak;
        
        // Apply gain
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            const channelData = this.sampleBuffer.getChannelData(ch);
            for (let i = start; i < end; i++) {
                channelData[i] *= gain;
            }
        }
        
        this.draw();
        return true;
    }
    
    // Reverse
    reverseSelection() {
        if (!this.sampleBuffer) return false;
        
        const { start, end } = this.selection;
        if (start === end) return false;
        
        this.saveState();
        
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            const channelData = this.sampleBuffer.getChannelData(ch);
            const selection = channelData.slice(start, end);
            selection.reverse();
            
            for (let i = start; i < end; i++) {
                channelData[i] = selection[i - start];
            }
        }
        
        this.draw();
        return true;
    }
    
    // Pitch shift (simple resampling)
    pitchShiftSelection(semitones) {
        if (!this.sampleBuffer) return false;
        
        const { start, end } = this.selection;
        if (start === end) return false;
        
        this.saveState();
        
        const ratio = Math.pow(2, semitones / 12);
        const selectionLength = end - start;
        const newLength = Math.round(selectionLength / ratio);
        
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            const channelData = this.sampleBuffer.getChannelData(ch);
            const selection = channelData.slice(start, end);
            
            // Simple linear interpolation resampling
            for (let i = 0; i < newLength; i++) {
                const srcIndex = i * ratio;
                const srcIndexFloor = Math.floor(srcIndex);
                const srcIndexCeil = Math.min(srcIndexFloor + 1, selectionLength - 1);
                const frac = srcIndex - srcIndexFloor;
                
                const value = selection[srcIndexFloor] * (1 - frac) + selection[srcIndexCeil] * frac;
                channelData[start + i] = value;
            }
            
            // Clear remaining
            for (let i = start + newLength; i < end; i++) {
                channelData[i] = 0;
            }
        }
        
        this.draw();
        return true;
    }
    
    // Time stretch (simple)
    timeStretchSelection(ratio) {
        if (!this.sampleBuffer) return false;
        
        const { start, end } = this.selection;
        if (start === end) return false;
        
        this.saveState();
        
        const selectionLength = end - start;
        const newLength = Math.round(selectionLength * ratio);
        const newTotalLength = this.sampleBuffer.length - selectionLength + newLength;
        
        const newBuffer = this.audioContext.createBuffer(
            this.sampleBuffer.numberOfChannels,
            newTotalLength,
            this.sampleBuffer.sampleRate
        );
        
        for (let ch = 0; ch < newBuffer.numberOfChannels; ch++) {
            const newChannel = newBuffer.getChannelData(ch);
            const oldChannel = this.sampleBuffer.getChannelData(ch);
            
            // Copy before
            newChannel.set(oldChannel.slice(0, start), 0);
            
            // Stretch selection
            const selection = oldChannel.slice(start, end);
            for (let i = 0; i < newLength; i++) {
                const srcIndex = i / ratio;
                const srcIndexFloor = Math.floor(srcIndex);
                const srcIndexCeil = Math.min(srcIndexFloor + 1, selectionLength - 1);
                const frac = srcIndex - srcIndexFloor;
                
                newChannel[start + i] = selection[srcIndexFloor] * (1 - frac) + selection[srcIndexCeil] * frac;
            }
            
            // Copy after
            newChannel.set(oldChannel.slice(end), start + newLength);
        }
        
        this.sampleBuffer = newBuffer;
        
        this.draw();
        
        if (this.onSampleChange) {
            this.onSampleChange(this.sample);
        }
        
        return true;
    }
    
    // Markers
    addMarker(position, name = '') {
        if (!this.sampleBuffer) return null;
        
        position = Math.max(0, Math.min(this.sampleBuffer.length, position));
        
        const marker = {
            id: `marker_${Date.now()}`,
            position,
            name: name || `Marker ${this.markers.length + 1}`,
            color: `hsl(${(this.markers.length * 60) % 360}, 70%, 50%)`
        };
        
        this.markers.push(marker);
        this.draw();
        
        return marker;
    }
    
    removeMarker(markerId) {
        this.markers = this.markers.filter(m => m.id !== markerId);
        this.draw();
    }
    
    // Loop points
    setLoopPoints(start, end, enabled = true) {
        if (!this.sampleBuffer) return;
        
        this.loopPoints = {
            start: Math.max(0, Math.min(this.sampleBuffer.length, start)),
            end: Math.max(0, Math.min(this.sampleBuffer.length, end)),
            enabled
        };
        
        this.draw();
    }
    
    enableLoop(enabled = true) {
        this.loopPoints.enabled = enabled;
        this.draw();
    }
    
    // Zero crossing
    findZeroCrossing(position, direction = 1) {
        if (!this.sampleBuffer) return position;
        
        const channelData = this.sampleBuffer.getChannelData(0);
        const maxPos = channelData.length - 1;
        
        position = Math.max(1, Math.min(maxPos - 1, Math.round(position)));
        
        while (position > 0 && position < maxPos) {
            if ((channelData[position - 1] < 0 && channelData[position] >= 0) ||
                (channelData[position - 1] >= 0 && channelData[position] < 0)) {
                return position;
            }
            position += direction;
        }
        
        return position;
    }
    
    snapSelectionToZeroCrossing() {
        if (!this.config.snapToZeroCrossing || !this.sampleBuffer) return;
        
        this.selection.start = this.findZeroCrossing(this.selection.start, -1);
        this.selection.end = this.findZeroCrossing(this.selection.end, 1);
        
        this.draw();
    }
    
    // Playback
    play(fromSelection = false) {
        if (!this.sampleBuffer) return;
        
        this.stop();
        
        this.playbackSource = this.audioContext.createBufferSource();
        this.playbackSource.buffer = this.sampleBuffer;
        
        if (this.loopPoints.enabled) {
            this.playbackSource.loop = true;
            this.playbackSource.loopStart = this.loopPoints.start / this.sampleBuffer.sampleRate;
            this.playbackSource.loopEnd = this.loopPoints.end / this.sampleBuffer.sampleRate;
        }
        
        this.playbackSource.connect(this.audioContext.destination);
        
        this.isPlaying = true;
        this.playbackPosition = fromSelection ? this.selection.start : 0;
        this.playbackStartTime = this.audioContext.currentTime;
        
        const offset = this.playbackPosition / this.sampleBuffer.sampleRate;
        this.playbackSource.start(0, offset);
        
        this.playbackSource.onended = () => {
            this.isPlaying = false;
            this.draw();
        };
        
        this.updatePlaybackPosition();
    }
    
    playSelection() {
        this.play(true);
    }
    
    stop() {
        if (this.playbackSource) {
            this.playbackSource.stop();
            this.playbackSource.disconnect();
            this.playbackSource = null;
        }
        this.isPlaying = false;
        this.playbackPosition = 0;
        this.draw();
    }
    
    updatePlaybackPosition() {
        if (!this.isPlaying) return;
        
        const elapsed = this.audioContext.currentTime - this.playbackStartTime;
        this.playbackPosition = Math.round(elapsed * this.sampleBuffer.sampleRate);
        
        if (this.playbackPosition >= this.sampleBuffer.length && !this.loopPoints.enabled) {
            this.stop();
            return;
        }
        
        this.draw();
        
        if (this.onPlaybackPosition) {
            this.onPlaybackPosition(this.playbackPosition);
        }
        
        requestAnimationFrame(() => this.updatePlaybackPosition());
    }
    
    // Export
    exportAsWav() {
        if (!this.sampleBuffer) return null;
        
        const numChannels = this.sampleBuffer.numberOfChannels;
        const sampleRate = this.sampleBuffer.sampleRate;
        const length = this.sampleBuffer.length;
        
        const buffer = new ArrayBuffer(44 + length * numChannels * 2);
        const view = new DataView(buffer);
        
        // WAV header
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
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numChannels * 2, true);
        
        // Interleave channels and write samples
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channels.push(this.sampleBuffer.getChannelData(ch));
        }
        
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }
    
    downloadAsWav(filename = 'sample.wav') {
        const blob = this.exportAsWav();
        if (!blob) return;
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // UI
    createUI(container) {
        this.container = container;
        
        container.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 8px;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #fff;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 14px;">Sample Editor</h3>
                    <div id="sample-info" style="font-size: 12px; color: #888;"></div>
                </div>
                
                <!-- Toolbar -->
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; padding: 8px; background: #2a2a4e; border-radius: 4px;">
                    <input type="file" id="sample-file-input" accept="audio/*" style="display: none;">
                    <button id="load-sample-btn" style="padding: 6px 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">Load</button>
                    
                    <div style="width: 1px; background: #444;"></div>
                    
                    <button id="undo-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Undo</button>
                    <button id="redo-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Redo</button>
                    
                    <div style="width: 1px; background: #444;"></div>
                    
                    <button id="play-btn" style="padding: 6px 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer;">▶ Play</button>
                    <button id="stop-btn" style="padding: 6px 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">■ Stop</button>
                    
                    <div style="width: 1px; background: #444;"></div>
                    
                    <button id="cut-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Cut</button>
                    <button id="copy-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Copy</button>
                    <button id="paste-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Paste</button>
                    <button id="delete-btn" style="padding: 6px 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">Delete</button>
                </div>
                
                <!-- Canvas -->
                <canvas id="sample-editor-canvas" width="800" height="200" style="width: 100%; background: #2a2a4e; border-radius: 4px; cursor: crosshair;"></canvas>
                
                <!-- Selection info -->
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #888;">
                    <span id="selection-info">No selection</span>
                    <span id="zoom-info">Zoom: 1x</span>
                </div>
                
                <!-- Zoom slider -->
                <div style="margin-top: 8px;">
                    <input type="range" id="zoom-slider" min="1" max="20" step="0.5" value="1" style="width: 200px;">
                    <input type="range" id="scroll-slider" min="0" max="100" step="1" value="0" style="width: 200px; margin-left: 16px;">
                </div>
                
                <!-- Edit tools -->
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding: 8px; background: #2a2a4e; border-radius: 4px;">
                    <button id="select-all-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Select All</button>
                    <button id="fade-in-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Fade In</button>
                    <button id="fade-out-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Fade Out</button>
                    <button id="normalize-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Normalize</button>
                    <button id="reverse-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Reverse</button>
                    <button id="mute-btn" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Mute</button>
                    
                    <div style="width: 1px; background: #444;"></div>
                    
                    <select id="pitch-shift-select" style="padding: 6px; background: #1a1a2e; border: 1px solid #444; border-radius: 4px; color: white;">
                        <option value="">Pitch Shift</option>
                        <option value="1">+1 semitone</option>
                        <option value="2">+2 semitones</option>
                        <option value="5">+5 semitones</option>
                        <option value="12">+1 octave</option>
                        <option value="-1">-1 semitone</option>
                        <option value="-2">-2 semitones</option>
                        <option value="-12">-1 octave</option>
                    </select>
                    
                    <select id="time-stretch-select" style="padding: 6px; background: #1a1a2e; border: 1px solid #444; border-radius: 4px; color: white;">
                        <option value="">Time Stretch</option>
                        <option value="0.5">50% (faster)</option>
                        <option value="0.75">75%</option>
                        <option value="1.5">150%</option>
                        <option value="2">200% (slower)</option>
                    </select>
                </div>
                
                <!-- Markers and loops -->
                <div style="display: flex; gap: 16px; margin-top: 12px;">
                    <div style="flex: 1; padding: 8px; background: #2a2a4e; border-radius: 4px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">MARKERS</h4>
                        <div id="markers-list" style="max-height: 100px; overflow-y: auto; font-size: 12px;"></div>
                        <button id="add-marker-btn" style="margin-top: 8px; padding: 4px 8px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">Add Marker</button>
                    </div>
                    
                    <div style="flex: 1; padding: 8px; background: #2a2a4e; border-radius: 4px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">LOOP</h4>
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
                            <input type="checkbox" id="loop-enabled-checkbox">
                            Enable Loop
                        </label>
                        <div style="margin-top: 8px; font-size: 11px; color: #888;" id="loop-info">Not set</div>
                    </div>
                </div>
                
                <!-- Export -->
                <div style="margin-top: 12px;">
                    <button id="export-wav-btn" style="padding: 8px 16px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer;">Export as WAV</button>
                </div>
            </div>
        `;
        
        this.canvas = container.querySelector('#sample-editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.setupEventHandlers();
        this.draw();
    }
    
    setupEventHandlers() {
        // File input
        const fileInput = this.container.querySelector('#sample-file-input');
        this.container.querySelector('#load-sample-btn').onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const buffer = await file.arrayBuffer();
                await this.loadFromArrayBuffer(buffer, file.name);
            }
        };
        
        // Undo/Redo
        this.container.querySelector('#undo-btn').onclick = () => this.undo();
        this.container.querySelector('#redo-btn').onclick = () => this.redo();
        
        // Playback
        this.container.querySelector('#play-btn').onclick = () => this.playSelection();
        this.container.querySelector('#stop-btn').onclick = () => this.stop();
        
        // Edit operations
        this.container.querySelector('#cut-btn').onclick = () => {
            window.sampleEditorClipboard = this.cut();
        };
        this.container.querySelector('#copy-btn').onclick = () => {
            window.sampleEditorClipboard = this.copy();
        };
        this.container.querySelector('#paste-btn').onclick = () => {
            if (window.sampleEditorClipboard) {
                this.paste(window.sampleEditorClipboard);
            }
        };
        this.container.querySelector('#delete-btn').onclick = () => this.delete();
        
        // Selection
        this.container.querySelector('#select-all-btn').onclick = () => this.selectAll();
        
        // Processing
        this.container.querySelector('#fade-in-btn').onclick = () => this.fadeInSelection();
        this.container.querySelector('#fade-out-btn').onclick = () => this.fadeOutSelection();
        this.container.querySelector('#normalize-btn').onclick = () => this.normalizeSelection();
        this.container.querySelector('#reverse-btn').onclick = () => this.reverseSelection();
        this.container.querySelector('#mute-btn').onclick = () => this.muteSelection();
        
        // Pitch shift
        this.container.querySelector('#pitch-shift-select').onchange = (e) => {
            if (e.target.value) {
                this.pitchShiftSelection(parseInt(e.target.value));
                e.target.value = '';
            }
        };
        
        // Time stretch
        this.container.querySelector('#time-stretch-select').onchange = (e) => {
            if (e.target.value) {
                this.timeStretchSelection(parseFloat(e.target.value));
                e.target.value = '';
            }
        };
        
        // Zoom and scroll
        const zoomSlider = this.container.querySelector('#zoom-slider');
        zoomSlider.oninput = () => {
            this.zoom = parseFloat(zoomSlider.value);
            this.container.querySelector('#zoom-info').textContent = `Zoom: ${this.zoom}x`;
            this.draw();
        };
        
        const scrollSlider = this.container.querySelector('#scroll-slider');
        scrollSlider.oninput = () => {
            this.scrollOffset = parseInt(scrollSlider.value) / 100;
            this.draw();
        };
        
        // Markers
        this.container.querySelector('#add-marker-btn').onclick = () => {
            this.addMarker(this.selection.start);
            this.updateMarkersList();
        };
        
        // Loop
        this.container.querySelector('#loop-enabled-checkbox').onchange = (e) => {
            this.loopPoints.enabled = e.target.checked;
            this.draw();
        };
        
        // Export
        this.container.querySelector('#export-wav-btn').onclick = () => {
            this.downloadAsWav(this.sample?.name || 'sample.wav');
        };
        
        // Canvas mouse events
        let isDragging = false;
        let dragStart = null;
        
        this.canvas.onmousedown = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const samplePos = this.xToSamplePosition(x);
            
            if (e.shiftKey) {
                // Extend selection
                this.setSelection(this.selection.start, samplePos);
            } else {
                dragStart = samplePos;
                isDragging = true;
            }
        };
        
        this.canvas.onmousemove = (e) => {
            if (!isDragging) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const samplePos = this.xToSamplePosition(x);
            
            this.setSelection(dragStart, samplePos);
        };
        
        this.canvas.onmouseup = () => {
            isDragging = false;
        };
        
        // Double click to add marker
        this.canvas.ondblclick = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const samplePos = this.xToSamplePosition(x);
            this.addMarker(samplePos);
            this.updateMarkersList();
        };
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case 'x':
                        e.preventDefault();
                        window.sampleEditorClipboard = this.cut();
                        break;
                    case 'c':
                        e.preventDefault();
                        window.sampleEditorClipboard = this.copy();
                        break;
                    case 'v':
                        e.preventDefault();
                        if (window.sampleEditorClipboard) {
                            this.paste(window.sampleEditorClipboard);
                        }
                        break;
                }
            }
        });
    }
    
    xToSamplePosition(x) {
        if (!this.sampleBuffer) return 0;
        
        const padding = 20;
        const width = this.canvas.width - padding * 2;
        const visibleSamples = this.sampleBuffer.length / this.zoom;
        const startOffset = this.scrollOffset * (this.sampleBuffer.length - visibleSamples);
        
        const normalizedX = (x - padding) / width;
        return Math.round(startOffset + normalizedX * visibleSamples);
    }
    
    samplePositionToX(pos) {
        const padding = 20;
        const width = this.canvas.width - padding * 2;
        const visibleSamples = this.sampleBuffer ? this.sampleBuffer.length / this.zoom : 1;
        const startOffset = this.sampleBuffer ? this.scrollOffset * (this.sampleBuffer.length - visibleSamples) : 0;
        
        const normalizedPos = (pos - startOffset) / visibleSamples;
        return padding + normalizedPos * width;
    }
    
    draw() {
        if (!this.ctx) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear
        this.ctx.fillStyle = '#2a2a4e';
        this.ctx.fillRect(0, 0, width, height);
        
        if (!this.sampleBuffer) {
            this.ctx.fillStyle = '#666';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Load a sample to begin editing', width / 2, height / 2);
            return;
        }
        
        const padding = 20;
        const drawWidth = width - padding * 2;
        const drawHeight = height - padding * 2;
        
        const visibleSamples = this.sampleBuffer.length / this.zoom;
        const startOffset = this.scrollOffset * (this.sampleBuffer.length - visibleSamples);
        const endOffset = startOffset + visibleSamples;
        
        // Draw loop region
        if (this.loopPoints.enabled) {
            const loopStartX = this.samplePositionToX(this.loopPoints.start);
            const loopEndX = this.samplePositionToX(this.loopPoints.end);
            
            this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
            this.ctx.fillRect(loopStartX, padding, loopEndX - loopStartX, drawHeight);
        }
        
        // Draw selection
        if (this.selection.start !== this.selection.end) {
            const selStartX = this.samplePositionToX(this.selection.start);
            const selEndX = this.samplePositionToX(this.selection.end);
            
            this.ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
            this.ctx.fillRect(selStartX, padding, selEndX - selStartX, drawHeight);
        }
        
        // Draw waveform
        for (let ch = 0; ch < this.sampleBuffer.numberOfChannels; ch++) {
            const channelData = this.sampleBuffer.getChannelData(ch);
            const channelHeight = drawHeight / this.sampleBuffer.numberOfChannels;
            const channelY = padding + ch * channelHeight;
            const centerY = channelY + channelHeight / 2;
            
            this.ctx.strokeStyle = ch === 0 ? '#10b981' : '#3b82f6';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            
            for (let x = padding; x < width - padding; x++) {
                const sampleIndex = startOffset + ((x - padding) / drawWidth) * visibleSamples;
                const clampedIndex = Math.max(0, Math.min(channelData.length - 1, Math.round(sampleIndex)));
                
                const sample = channelData[clampedIndex];
                const y = centerY - sample * (channelHeight / 2);
                
                if (x === padding) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            
            this.ctx.stroke();
        }
        
        // Draw markers
        for (const marker of this.markers) {
            const x = this.samplePositionToX(marker.position);
            if (x >= padding && x <= width - padding) {
                this.ctx.strokeStyle = marker.color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(x, padding);
                this.ctx.lineTo(x, height - padding);
                this.ctx.stroke();
            }
        }
        
        // Draw playback position
        if (this.isPlaying || this.playbackPosition > 0) {
            const x = this.samplePositionToX(this.playbackPosition);
            this.ctx.strokeStyle = '#ef4444';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, padding);
            this.ctx.lineTo(x, height - padding);
            this.ctx.stroke();
        }
        
        // Update info
        this.updateInfo();
    }
    
    updateInfo() {
        if (!this.sampleBuffer) return;
        
        const info = this.container.querySelector('#sample-info');
        info.textContent = `${this.sample.name} | ${this.sample.duration.toFixed(2)}s | ${this.sampleBuffer.length} samples | ${this.sample.numberOfChannels}ch | ${this.sample.sampleRate}Hz`;
        
        const selInfo = this.container.querySelector('#selection-info');
        if (this.selection.start !== this.selection.end) {
            const start = this.selection.start / this.sampleBuffer.sampleRate;
            const end = this.selection.end / this.sampleBuffer.sampleRate;
            const duration = end - start;
            selInfo.textContent = `Selection: ${start.toFixed(3)}s - ${end.toFixed(3)}s (${duration.toFixed(3)}s)`;
        } else {
            selInfo.textContent = 'No selection';
        }
        
        // Loop info
        const loopInfo = this.container.querySelector('#loop-info');
        if (this.loopPoints.enabled) {
            const loopStart = this.loopPoints.start / this.sampleBuffer.sampleRate;
            const loopEnd = this.loopPoints.end / this.sampleBuffer.sampleRate;
            loopInfo.textContent = `Loop: ${loopStart.toFixed(3)}s - ${loopEnd.toFixed(3)}s`;
        } else {
            loopInfo.textContent = 'Not set';
        }
        
        this.container.querySelector('#loop-enabled-checkbox').checked = this.loopPoints.enabled;
    }
    
    updateMarkersList() {
        const list = this.container.querySelector('#markers-list');
        list.innerHTML = this.markers.map(m => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #444;">
                <span style="color: ${m.color};">${m.name}</span>
                <span style="color: #888;">${(m.position / this.sampleBuffer.sampleRate).toFixed(3)}s</span>
                <button onclick="document.dispatchEvent(new CustomEvent('removeMarker', { detail: '${m.id}' }))" style="padding: 2px 6px; background: #ef4444; border: none; border-radius: 2px; color: white; cursor: pointer; font-size: 10px;">×</button>
            </div>
        `).join('');
        
        document.onremoveMarker = (e) => {
            this.removeMarker(e.detail);
            this.updateMarkersList();
        };
    }
    
    openPanel() {
        const existing = document.getElementById('sample-editor-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'sample-editor-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 900px;
            max-height: 90vh;
            overflow-y: auto;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
        `;
        
        document.body.appendChild(panel);
        this.createUI(panel);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 6px 12px;
            background: #ef4444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        closeBtn.onclick = () => {
            this.stop();
            panel.remove();
        };
        panel.appendChild(closeBtn);
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SampleEditorEnhancement };
} else if (typeof window !== 'undefined') {
    window.SampleEditorEnhancement = SampleEditorEnhancement;
}