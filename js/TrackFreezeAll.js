/**
 * Track Freeze All - Freeze all tracks at once for CPU savings
 * Renders all instrument tracks to audio, freeing up CPU resources
 */

import { appServices } from './main.js';

export class TrackFreezeAll {
    constructor(dawState) {
        this.dawState = dawState;
        this.frozenTracks = new Map(); // trackId -> frozenData
        this.isProcessing = false;
        this.progress = 0;
        this.currentTrackIndex = 0;
        this.totalTracks = 0;
        
        // Callbacks
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }
    
    async freezeAllTracks(options = {}) {
        if (this.isProcessing) {
            console.warn('Freeze all already in progress');
            return;
        }
        
        this.isProcessing = true;
        this.progress = 0;
        
        const tracks = this.getFreezableTracks();
        this.totalTracks = tracks.length;
        this.currentTrackIndex = 0;
        
        if (this.totalTracks === 0) {
            this.isProcessing = false;
            return { frozen: 0, failed: 0 };
        }
        
        const results = {
            frozen: [],
            failed: [],
            skipped: []
        };
        
        for (const track of tracks) {
            this.currentTrackIndex++;
            this.progress = (this.currentTrackIndex / this.totalTracks) * 100;
            
            if (this.onProgress) {
                this.onProgress({
                    trackId: track.id,
                    trackName: track.name,
                    progress: this.progress,
                    current: this.currentTrackIndex,
                    total: this.totalTracks
                });
            }
            
            try {
                const frozenData = await this.freezeTrack(track, options);
                
                if (frozenData) {
                    this.frozenTracks.set(track.id, frozenData);
                    results.frozen.push({
                        trackId: track.id,
                        trackName: track.name,
                        frozenData
                    });
                    
                    // Mute original track and enable frozen playback
                    this.enableFrozenPlayback(track.id, frozenData);
                } else {
                    results.skipped.push({
                        trackId: track.id,
                        trackName: track.name,
                        reason: 'Already frozen or audio track'
                    });
                }
            } catch (error) {
                console.error(`Failed to freeze track ${track.name}:`, error);
                results.failed.push({
                    trackId: track.id,
                    trackName: track.name,
                    error: error.message
                });
                
                if (this.onError) {
                    this.onError({
                        trackId: track.id,
                        trackName: track.name,
                        error
                    });
                }
            }
        }
        
        this.isProcessing = false;
        this.progress = 100;
        
        if (this.onComplete) {
            this.onComplete(results);
        }
        
        return results;
    }
    
    getFreezableTracks() {
        const tracks = [];
        
        // Get all tracks from the DAW state
        if (this.dawState && this.dawState.tracks) {
            for (const track of this.dawState.tracks) {
                // Only freeze instrument tracks (Synth, Sampler, DrumSampler)
                // Skip Audio tracks (already audio) and frozen tracks
                if (this.canFreeze(track)) {
                    tracks.push(track);
                }
            }
        }
        
        return tracks;
    }
    
    canFreeze(track) {
        // Can freeze if:
        // 1. Track type is Synth, Sampler, or DrumSampler
        // 2. Track is not already frozen
        // 3. Track has some content to render
        
        const freezableTypes = ['Synth', 'Sampler', 'DrumSampler'];
        
        if (!freezableTypes.includes(track.type)) {
            return false;
        }
        
        if (track.frozen && track.frozen.enabled) {
            return false; // Already frozen
        }
        
        // Check if track has any sequence/pattern content
        if (track.sequences && track.sequences.length > 0) {
            return true;
        }
        
        if (track.patterns && track.patterns.length > 0) {
            return true;
        }
        
        if (track.activeSequenceId) {
            return true;
        }
        
        return false;
    }
    
    async freezeTrack(track, options = {}) {
        const audioContext = this.getAudioContext();
        if (!audioContext) {
            throw new Error('Audio context not available');
        }
        
        // Get the track's sequences
        const sequences = track.sequences || [];
        if (sequences.length === 0) {
            return null;
        }
        
        // Calculate total duration
        const duration = options.duration ?? this.calculateTotalDuration(track);
        
        // Create offline context for rendering
        const sampleRate = audioContext.sampleRate;
        const offlineContext = new OfflineAudioContext(
            2, // stereo
            Math.ceil(duration * sampleRate),
            sampleRate
        );
        
        // Render each sequence
        const renderedBuffers = [];
        
        for (const sequence of sequences) {
            if (sequence.notes && sequence.notes.length > 0) {
                const buffer = await this.renderSequence(
                    offlineContext,
                    track,
                    sequence,
                    duration
                );
                renderedBuffers.push(buffer);
            }
        }
        
        // Combine all rendered buffers
        const combinedBuffer = this.combineBuffers(offlineContext, renderedBuffers, duration);
        
        // Convert to audio blob
        const audioBlob = await this.bufferToBlob(combinedBuffer);
        
        // Create frozen data
        const frozenData = {
            audioBuffer: combinedBuffer,
            audioBlob,
            duration,
            sampleRate,
            originalTrackId: track.id,
            originalTrackType: track.type,
            frozenAt: Date.now(),
            sequences: sequences.map(s => ({
                id: s.id,
                notes: s.notes?.length || 0
            }))
        };
        
        return frozenData;
    }
    
    async renderSequence(offlineContext, track, sequence, duration) {
        // Create a simple oscillator-based rendering
        // In a real implementation, this would use the track's actual synth
        
        const buffer = offlineContext.createBuffer(
            2,
            Math.ceil(duration * offlineContext.sampleRate),
            offlineContext.sampleRate
        );
        
        const leftChannel = buffer.getChannelData(0);
        const rightChannel = buffer.getChannelData(1);
        
        // Render each note
        if (sequence.notes) {
            for (const note of sequence.notes) {
                this.renderNote(leftChannel, rightChannel, note, offlineContext.sampleRate);
            }
        }
        
        return buffer;
    }
    
    renderNote(leftChannel, rightChannel, note, sampleRate) {
        const startSample = Math.floor(note.time * sampleRate);
        const durationSamples = Math.floor(note.duration * sampleRate);
        const frequency = 440 * Math.pow(2, (note.pitch - 69) / 12);
        const velocity = note.velocity ?? 0.8;
        
        for (let i = 0; i < durationSamples; i++) {
            const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * velocity * 0.3;
            
            // Apply envelope
            const envelope = this.calculateEnvelope(i, durationSamples);
            const value = sample * envelope;
            
            const index = startSample + i;
            if (index < leftChannel.length) {
                leftChannel[index] += value;
                rightChannel[index] += value;
            }
        }
    }
    
    calculateEnvelope(sampleIndex, totalSamples) {
        const attack = Math.min(0.1, 100 / totalSamples);
        const release = Math.min(0.2, 500 / totalSamples);
        
        const attackSamples = Math.floor(attack * totalSamples);
        const releaseSamples = Math.floor(release * totalSamples);
        
        if (sampleIndex < attackSamples) {
            return sampleIndex / attackSamples;
        } else if (sampleIndex > totalSamples - releaseSamples) {
            return (totalSamples - sampleIndex) / releaseSamples;
        }
        
        return 1;
    }
    
    combineBuffers(offlineContext, buffers, duration) {
        const totalSamples = Math.ceil(duration * offlineContext.sampleRate);
        const combined = offlineContext.createBuffer(2, totalSamples, offlineContext.sampleRate);
        
        const leftChannel = combined.getChannelData(0);
        const rightChannel = combined.getChannelData(1);
        
        for (const buffer of buffers) {
            const left = buffer.getChannelData(0);
            const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
            
            for (let i = 0; i < left.length && i < leftChannel.length; i++) {
                leftChannel[i] += left[i];
                rightChannel[i] += right[i];
            }
        }
        
        return combined;
    }
    
    async bufferToBlob(buffer) {
        // Convert AudioBuffer to WAV blob
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        
        const wavBuffer = new ArrayBuffer(44 + length * numChannels * 2);
        const view = new DataView(wavBuffer);
        
        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length * numChannels * 2, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, length * numChannels * 2, true);
        
        // Audio data
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const channelData = buffer.getChannelData(ch);
                const sample = Math.max(-1, Math.min(1, channelData[i]));
                view.setInt16(offset, sample * 0x7FFF, true);
                offset += 2;
            }
        }
        
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }
    
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    calculateTotalDuration(track) {
        // Get the longest sequence duration
        let maxDuration = 4; // Default 4 seconds
        
        if (track.sequences) {
            for (const seq of track.sequences) {
                if (seq.duration && seq.duration > maxDuration) {
                    maxDuration = seq.duration;
                }
                if (seq.notes) {
                    for (const note of seq.notes) {
                        const noteEnd = note.time + note.duration;
                        if (noteEnd > maxDuration) {
                            maxDuration = noteEnd;
                        }
                    }
                }
            }
        }
        
        // Add some padding
        return maxDuration + 0.5;
    }
    
    getAudioContext() {
        // Get audio context from appServices
        if (appServices && appServices.audioContext) {
            return appServices.audioContext;
        }
        
        if (this.dawState && this.dawState.audioContext) {
            return this.dawState.audioContext;
        }
        
        return null;
    }
    
    enableFrozenPlayback(trackId, frozenData) {
        // Enable the frozen audio playback for the track
        // This would update the track state to use the frozen audio
        
        if (this.dawState && this.dawState.updateTrack) {
            this.dawState.updateTrack(trackId, {
                frozen: {
                    enabled: true,
                    audioBuffer: frozenData.audioBuffer,
                    audioBlob: frozenData.audioBlob,
                    frozenAt: frozenData.frozenAt
                }
            });
        }
    }
    
    unfreezeTrack(trackId) {
        if (this.frozenTracks.has(trackId)) {
            this.frozenTracks.delete(trackId);
            
            // Disable frozen playback
            if (this.dawState && this.dawState.updateTrack) {
                this.dawState.updateTrack(trackId, {
                    frozen: {
                        enabled: false
                    }
                });
            }
            
            return true;
        }
        return false;
    }
    
    unfreezeAllTracks() {
        const trackIds = Array.from(this.frozenTracks.keys());
        
        for (const trackId of trackIds) {
            this.unfreezeTrack(trackId);
        }
        
        return trackIds.length;
    }
    
    getFrozenTracks() {
        return Array.from(this.frozenTracks.entries()).map(([trackId, data]) => ({
            trackId,
            ...data
        }));
    }
    
    getProgress() {
        return {
            isProcessing: this.isProcessing,
            progress: this.progress,
            current: this.currentTrackIndex,
            total: this.totalTracks
        };
    }
    
    destroy() {
        this.frozenTracks.clear();
        this.isProcessing = false;
    }
}

// Factory function
export function createTrackFreezeAll(dawState) {
    return new TrackFreezeAll(dawState);
}

// UI Panel
export function createFreezeAllPanel(freezeAll, appServices) {
    const container = document.createElement('div');
    container.className = 'freeze-all-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 350px;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Freeze All Tracks';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Status
    const statusContainer = document.createElement('div');
    statusContainer.id = 'freezeStatus';
    statusContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    statusContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Status</span>
            <span id="freezeStatusText">Ready</span>
        </div>
        <div style="height: 8px; background: #333; border-radius: 2px; overflow: hidden;">
            <div id="freezeProgressBar" style="height: 100%; width: 0%; background: #3b82f6; transition: width 0.2s;"></div>
        </div>
    `;
    container.appendChild(statusContainer);
    
    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px;';
    buttonsContainer.innerHTML = `
        <button id="freezeAllBtn" style="flex: 1; padding: 12px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
            Freeze All
        </button>
        <button id="unfreezeAllBtn" style="flex: 1; padding: 12px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
            Unfreeze All
        </button>
    `;
    container.appendChild(buttonsContainer);
    
    // Frozen tracks list
    const listContainer = document.createElement('div');
    listContainer.id = 'frozenTracksList';
    listContainer.style.cssText = 'margin-bottom: 16px;';
    listContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Frozen Tracks</div>
        <div id="frozenTracks" style="max-height: 200px; overflow-y: auto;">
            <div style="color: #6b7280; font-style: italic;">No tracks frozen</div>
        </div>
    `;
    container.appendChild(listContainer);
    
    // Options
    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    optionsContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Options</div>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
            <input type="checkbox" id="muteOriginal" checked>
            Mute original tracks after freezing
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="autoSave">
            Auto-save project after freezing
        </label>
    `;
    container.appendChild(optionsContainer);
    
    // Results
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'freezeResults';
    resultsContainer.style.cssText = 'display: none; margin-top: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    container.appendChild(resultsContainer);
    
    // Event handlers
    document.getElementById('freezeAllBtn').addEventListener('click', async () => {
        const btn = document.getElementById('freezeAllBtn');
        btn.disabled = true;
        btn.textContent = 'Freezing...';
        
        const statusText = document.getElementById('freezeStatusText');
        statusText.textContent = 'Processing...';
        
        try {
            const results = await freezeAll.freezeAllTracks({
                muteOriginal: document.getElementById('muteOriginal').checked
            });
            
            // Show results
            const resultsContainer = document.getElementById('freezeResults');
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = `
                <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Results</div>
                <div style="color: #22c55e;">✓ ${results.frozen.length} tracks frozen</div>
                ${results.failed.length > 0 ? `<div style="color: #ef4444;">✗ ${results.failed.length} tracks failed</div>` : ''}
                ${results.skipped.length > 0 ? `<div style="color: #f59e0b;">⊘ ${results.skipped.length} tracks skipped</div>` : ''}
            `;
            
            updateFrozenTracksList();
            statusText.textContent = 'Complete';
            
            if (document.getElementById('autoSave').checked && appServices && appServices.saveProject) {
                await appServices.saveProject();
            }
        } catch (error) {
            statusText.textContent = 'Error: ' + error.message;
        }
        
        btn.disabled = false;
        btn.textContent = 'Freeze All';
    });
    
    document.getElementById('unfreezeAllBtn').addEventListener('click', () => {
        const count = freezeAll.unfreezeAllTracks();
        
        const resultsContainer = document.getElementById('freezeResults');
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `
            <div style="color: #ef4444;">Unfroze ${count} tracks</div>
        `;
        
        updateFrozenTracksList();
        document.getElementById('freezeStatusText').textContent = 'Ready';
    });
    
    // Progress callback
    freezeAll.onProgress = (progress) => {
        const progressBar = document.getElementById('freezeProgressBar');
        const statusText = document.getElementById('freezeStatusText');
        
        progressBar.style.width = `${progress.progress}%`;
        statusText.textContent = `Freezing: ${progress.trackName} (${progress.current}/${progress.total})`;
    };
    
    function updateFrozenTracksList() {
        const frozenTracks = freezeAll.getFrozenTracks();
        const container = document.getElementById('frozenTracks');
        
        if (frozenTracks.length === 0) {
            container.innerHTML = '<div style="color: #6b7280; font-style: italic;">No tracks frozen</div>';
            return;
        }
        
        container.innerHTML = frozenTracks.map(track => `
            <div style="display: flex; justify-content: space-between; padding: 8px; background: #1e1e2e; margin-bottom: 4px; border-radius: 4px;">
                <span>Track ${track.trackId}</span>
                <button class="unfreeze-single" data-track-id="${track.trackId}" style="padding: 4px 8px; background: #4b5563; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Unfreeze
                </button>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.unfreeze-single').forEach(btn => {
            btn.addEventListener('click', () => {
                const trackId = btn.dataset.trackId;
                freezeAll.unfreezeTrack(trackId);
                updateFrozenTracksList();
            });
        });
    }
    
    return container;
}

export default TrackFreezeAll;