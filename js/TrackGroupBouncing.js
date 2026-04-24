/**
 * Track Group Bouncing - Render group of tracks to single audio
 * Bounces selected tracks to a single audio file with effects processing
 */

export class TrackGroupBouncing {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = this.audioContext?.sampleRate || 44100;
        
        // Bouncing settings
        this.settings = {
            format: options.format || 'wav',
            bitDepth: options.bitDepth || 16,
            sampleRate: options.sampleRate || this.sampleRate,
            includeEffects: options.includeEffects !== false,
            includeAutomation: options.includeAutomation !== false,
            normalize: options.normalize || false,
            normalizeTarget: options.normalizeTarget || -1, // LUFS
            tailDuration: options.tailDuration || 2, // seconds for reverb tails
            crossfadeBetweenRegions: options.crossfadeBetweenRegions || 0.01 // seconds
        };
        
        // Processing state
        this.isBouncing = false;
        this.currentBounce = null;
        this.bounceHistory = [];
    }
    
    /**
     * Create a track group for bouncing
     */
    createTrackGroup(tracks, name = 'Group') {
        return {
            id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            tracks: tracks.map(t => ({
                id: t.id,
                name: t.name,
                volume: t.volume || 1,
                pan: t.pan || 0,
                muted: t.muted || false,
                solo: t.solo || false,
                effects: t.effects || [],
                clips: t.clips || []
            })),
            createdAt: Date.now()
        };
    }
    
    /**
     * Bounce a group of tracks to audio
     */
    async bounceGroup(group, options = {}) {
        if (this.isBouncing) {
            throw new Error('Already bouncing a group');
        }
        
        this.isBouncing = true;
        const startTime = Date.now();
        
        const settings = { ...this.settings, ...options };
        
        this.currentBounce = {
            groupId: group.id,
            groupName: group.name,
            startTime,
            status: 'rendering',
            progress: 0
        };
        
        try {
            // Determine duration from longest track
            const duration = this.calculateGroupDuration(group.tracks);
            
            // Create offline context for rendering
            const offlineContext = new OfflineAudioContext(
                2, // Stereo output
                Math.ceil(duration * settings.sampleRate),
                settings.sampleRate
            );
            
            // Process each track
            const trackResults = [];
            for (let i = 0; i < group.tracks.length; i++) {
                const track = group.tracks[i];
                
                if (track.muted) continue;
                
                // Check solo state
                const hasSolo = group.tracks.some(t => t.solo);
                if (hasSolo && !track.solo) continue;
                
                const trackBuffer = await this.renderTrackToBuffer(
                    track, 
                    offlineContext,
                    duration,
                    settings
                );
                
                trackResults.push({
                    trackId: track.id,
                    buffer: trackBuffer
                });
                
                this.currentBounce.progress = (i + 1) / group.tracks.length;
            }
            
            // Mix all track buffers together
            const mixedBuffer = this.mixBuffers(trackResults, offlineContext, duration);
            
            // Apply master processing
            let processedBuffer = mixedBuffer;
            if (settings.normalize) {
                processedBuffer = this.normalizeBuffer(processedBuffer, settings.normalizeTarget);
            }
            
            // Convert to audio file format
            const audioFile = this.bufferToAudioFile(processedBuffer, settings);
            
            this.currentBounce.status = 'complete';
            this.currentBounce.endTime = Date.now();
            this.currentBounce.duration = duration;
            this.currentBounce.audioFile = audioFile;
            
            // Store in history
            this.bounceHistory.push({
                ...this.currentBounce,
                group: JSON.parse(JSON.stringify(group))
            });
            
            return {
                success: true,
                groupId: group.id,
                groupName: group.name,
                duration,
                audioFile,
                trackCount: trackResults.length,
                renderTime: this.currentBounce.endTime - startTime
            };
            
        } catch (error) {
            this.currentBounce.status = 'error';
            this.currentBounce.error = error.message;
            
            return {
                success: false,
                groupId: group.id,
                error: error.message
            };
        } finally {
            this.isBouncing = false;
        }
    }
    
    /**
     * Calculate total duration from tracks
     */
    calculateGroupDuration(tracks) {
        let maxDuration = 0;
        
        for (const track of tracks) {
            if (track.clips && track.clips.length > 0) {
                for (const clip of track.clips) {
                    const clipEnd = (clip.startTime || 0) + (clip.duration || 0);
                    if (clipEnd > maxDuration) {
                        maxDuration = clipEnd;
                    }
                }
            }
            
            // Add tail duration for effects
            maxDuration += this.settings.tailDuration;
        }
        
        return maxDuration;
    }
    
    /**
     * Render a single track to audio buffer
     */
    async renderTrackToBuffer(track, offlineContext, duration, settings) {
        const sampleRate = offlineContext.sampleRate;
        const totalSamples = Math.ceil(duration * sampleRate);
        
        // Create buffer for this track
        const trackBuffer = offlineContext.createBuffer(
            2, // Stereo
            totalSamples,
            sampleRate
        );
        
        const leftChannel = trackBuffer.getChannelData(0);
        const rightChannel = trackBuffer.getChannelData(1);
        
        // Apply track volume and pan
        const volume = track.volume || 1;
        const pan = track.pan || 0;
        const leftGain = volume * Math.cos((pan + 1) * Math.PI / 4);
        const rightGain = volume * Math.sin((pan + 1) * Math.PI / 4);
        
        // Render clips
        if (track.clips && track.clips.length > 0) {
            for (const clip of track.clips) {
                if (clip.audioBuffer) {
                    const clipStart = Math.floor((clip.startTime || 0) * sampleRate);
                    const clipData = clip.audioBuffer;
                    
                    // Determine clip offset (for clip internal offset)
                    const clipOffset = Math.floor((clip.offset || 0) * sampleRate);
                    const clipLength = Math.min(
                        clipData.length - clipOffset,
                        totalSamples - clipStart
                    );
                    
                    // Copy audio data
                    for (let i = 0; i < clipLength; i++) {
                        const destIndex = clipStart + i;
                        if (destIndex >= 0 && destIndex < totalSamples) {
                            const leftSample = clipData.numberOfChannels > 0 
                                ? clipData.getChannelData(0)[clipOffset + i] 
                                : 0;
                            const rightSample = clipData.numberOfChannels > 1 
                                ? clipData.getChannelData(1)[clipOffset + i] 
                                : leftSample;
                            
                            leftChannel[destIndex] += leftSample * leftGain;
                            rightChannel[destIndex] += rightSample * rightGain;
                        }
                    }
                }
            }
        }
        
        // Apply effects if enabled
        if (settings.includeEffects && track.effects && track.effects.length > 0) {
            this.applyEffectsToBuffer(trackBuffer, track.effects, offlineContext);
        }
        
        return trackBuffer;
    }
    
    /**
     * Apply effects to a buffer
     */
    applyEffectsToBuffer(buffer, effects, context) {
        // Simple effect application (would integrate with effects system)
        for (const effect of effects) {
            if (!effect.enabled) continue;
            
            switch (effect.type) {
                case 'gain':
                    this.applyGain(buffer, effect.params?.gain || 1);
                    break;
                case 'eq':
                case 'equalizer':
                    this.applyEQ(buffer, effect.params, context);
                    break;
                case 'compressor':
                    this.applyCompressor(buffer, effect.params, context);
                    break;
                case 'reverb':
                    this.applyReverb(buffer, effect.params, context);
                    break;
                case 'delay':
                    this.applyDelay(buffer, effect.params, context);
                    break;
                // Add more effects as needed
            }
        }
    }
    
    applyGain(buffer, gain) {
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                data[i] *= gain;
            }
        }
    }
    
    applyEQ(buffer, params, context) {
        // Simplified EQ - would use biquad filters in production
        const { low, mid, high } = params || {};
        
        if (low) this.applyGain(buffer, low);
        if (mid) this.applyGain(buffer, mid);
        if (high) this.applyGain(buffer, high);
    }
    
    applyCompressor(buffer, params, context) {
        const { threshold = -24, ratio = 4, attack = 0.003, release = 0.25 } = params || {};
        const thresholdLinear = Math.pow(10, threshold / 20);
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            let envelope = 0;
            
            for (let i = 0; i < data.length; i++) {
                const absSample = Math.abs(data[i]);
                
                // Envelope follower
                if (absSample > envelope) {
                    envelope += (absSample - envelope) * (1 - Math.exp(-1 / (attack * context.sampleRate)));
                } else {
                    envelope += (absSample - envelope) * (1 - Math.exp(-1 / (release * context.sampleRate)));
                }
                
                // Compression
                if (envelope > thresholdLinear) {
                    const compressedGain = thresholdLinear + (envelope - thresholdLinear) / ratio;
                    data[i] *= compressedGain / envelope;
                }
            }
        }
    }
    
    applyReverb(buffer, params, context) {
        const { decay = 2, mix = 0.3 } = params || {};
        const sampleRate = context.sampleRate;
        
        // Simple reverb using delay lines
        const delayTimes = [0.03, 0.05, 0.07, 0.11];
        const decays = [0.7, 0.6, 0.5, 0.4];
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            const original = new Float32Array(data);
            
            for (let d = 0; d < delayTimes.length; d++) {
                const delaySamples = Math.floor(delayTimes[d] * sampleRate);
                const decayGain = decays[d] * decay;
                
                for (let i = delaySamples; i < data.length; i++) {
                    data[i] += original[i - delaySamples] * decayGain * mix;
                }
            }
        }
    }
    
    applyDelay(buffer, params, context) {
        const { time = 0.25, feedback = 0.4, mix = 0.3 } = params || {};
        const sampleRate = context.sampleRate;
        const delaySamples = Math.floor(time * sampleRate);
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            const original = new Float32Array(data);
            
            for (let i = delaySamples; i < data.length; i++) {
                data[i] += original[i - delaySamples] * feedback * mix;
            }
        }
    }
    
    /**
     * Mix multiple buffers together
     */
    mixBuffers(trackResults, context, duration) {
        const totalSamples = Math.ceil(duration * context.sampleRate);
        const mixedBuffer = context.createBuffer(2, totalSamples, context.sampleRate);
        
        const leftChannel = mixedBuffer.getChannelData(0);
        const rightChannel = mixedBuffer.getChannelData(1);
        
        for (const result of trackResults) {
            const buffer = result.buffer;
            const samplesToMix = Math.min(buffer.length, totalSamples);
            
            for (let i = 0; i < samplesToMix; i++) {
                leftChannel[i] += buffer.getChannelData(0)[i];
                rightChannel[i] += buffer.getChannelData(1)[i];
            }
        }
        
        return mixedBuffer;
    }
    
    /**
     * Normalize buffer to target level
     */
    normalizeBuffer(buffer, targetLUFS = -1) {
        // Calculate current peak and RMS
        let peak = 0;
        let rmsSum = 0;
        const totalSamples = buffer.length * buffer.numberOfChannels;
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                peak = Math.max(peak, Math.abs(data[i]));
                rmsSum += data[i] * data[i];
            }
        }
        
        const rms = Math.sqrt(rmsSum / totalSamples);
        
        // Target level in linear scale
        // -1 LUFS ≈ -18 dBFS for a rough conversion
        const targetLinear = Math.pow(10, (targetLUFS + 18) / 20);
        
        // Calculate gain
        const gain = targetLinear / peak;
        
        // Apply gain
        this.applyGain(buffer, Math.min(gain, 4)); // Limit gain to 12dB
        
        return buffer;
    }
    
    /**
     * Convert buffer to audio file format
     */
    bufferToAudioFile(buffer, settings) {
        // Create WAV file structure
        const numChannels = buffer.numberOfChannels;
        const sampleRate = settings.sampleRate;
        const bitsPerSample = settings.bitDepth;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = buffer.length * blockAlign;
        
        // WAV header (44 bytes)
        const headerSize = 44;
        const fileSize = headerSize + dataSize;
        const wavBuffer = new ArrayBuffer(fileSize);
        const view = new DataView(wavBuffer);
        
        // RIFF header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, fileSize - 8, true);
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
        
        // Write audio data
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = buffer.getChannelData(channel)[i];
                const intSample = Math.max(-1, Math.min(1, sample));
                const int16 = intSample < 0 
                    ? intSample * 0x8000 
                    : intSample * 0x7FFF;
                
                view.setInt16(offset, int16, true);
                offset += 2;
            }
        }
        
        return {
            buffer: wavBuffer,
            blob: new Blob([wavBuffer], { type: 'audio/wav' }),
            url: URL.createObjectURL(new Blob([wavBuffer], { type: 'audio/wav' })),
            format: 'wav',
            sampleRate,
            bitDepth: bitsPerSample,
            duration: buffer.length / sampleRate
        };
    }
    
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    /**
     * Create UI panel for track group bouncing
     */
    createUI() {
        const panel = document.createElement('div');
        panel.id = 'track-group-bounce-panel';
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
            min-width: 500px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        panel.innerHTML = `
            <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">Track Group Bouncing</h2>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Bounce Settings</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="font-size: 11px; color: #666;">Format</label>
                        <select id="bounce-format" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                            <option value="wav">WAV</option>
                            <option value="aiff">AIFF</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Bit Depth</label>
                        <select id="bounce-bit-depth" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                            <option value="16">16-bit</option>
                            <option value="24">24-bit</option>
                            <option value="32">32-bit float</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Sample Rate</label>
                        <select id="bounce-sample-rate" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                            <option value="44100">44.1 kHz</option>
                            <option value="48000">48 kHz</option>
                            <option value="96000">96 kHz</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Effect Tail (s)</label>
                        <input type="number" id="bounce-tail" value="${this.settings.tailDuration}" step="0.5" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                    </div>
                </div>
                <div style="margin-top: 12px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                        <input type="checkbox" id="bounce-include-effects" checked style="accent-color: #10b981;">
                        Include track effects
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; margin-top: 8px;">
                        <input type="checkbox" id="bounce-normalize" style="accent-color: #10b981;">
                        Normalize output
                    </label>
                </div>
            </div>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Select Tracks to Bounce</div>
                <div id="bounce-track-list" style="max-height: 200px; overflow-y: auto; font-size: 12px;">
                    <div style="color: #666;">No tracks selected - integrate with DAW track selection</div>
                </div>
            </div>
            
            <div id="bounce-progress" style="display: none; background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 12px; color: #888;">Bouncing...</span>
                    <span id="bounce-progress-text" style="font-size: 12px; color: #10b981;">0%</span>
                </div>
                <div style="background: #1a1a2e; border-radius: 4px; height: 8px; overflow: hidden;">
                    <div id="bounce-progress-bar" style="width: 0%; height: 100%; background: #10b981;"></div>
                </div>
            </div>
            
            <div id="bounce-result" style="display: none; background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Result</div>
                <div id="bounce-result-content"></div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="select-tracks-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Select Tracks
                </button>
                <button id="start-bounce-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Start Bounce
                </button>
                <button id="download-bounce-btn" style="flex: 1; padding: 12px; background: #8b5cf6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600; display: none;">
                    Download
                </button>
                <button id="close-bounce-panel" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupUIEvents(panel);
        
        return panel;
    }
    
    setupUIEvents(panel) {
        // Select tracks button
        panel.querySelector('#select-tracks-btn').addEventListener('click', () => {
            console.log('[TrackGroupBouncing] Select tracks - integrate with DAW selection');
        });
        
        // Start bounce button
        panel.querySelector('#start-bounce-btn').addEventListener('click', () => {
            this.startBounceFromUI();
        });
        
        // Download button
        panel.querySelector('#download-bounce-btn').addEventListener('click', () => {
            this.downloadFromUI();
        });
        
        // Close button
        panel.querySelector('#close-bounce-panel').addEventListener('click', () => {
            panel.remove();
        });
    }
    
    async startBounceFromUI() {
        const panel = document.querySelector('#track-group-bounce-panel');
        if (!panel) return;
        
        // Update settings from UI
        this.settings.format = panel.querySelector('#bounce-format').value;
        this.settings.bitDepth = parseInt(panel.querySelector('#bounce-bit-depth').value);
        this.settings.sampleRate = parseInt(panel.querySelector('#bounce-sample-rate').value);
        this.settings.tailDuration = parseFloat(panel.querySelector('#bounce-tail').value);
        this.settings.includeEffects = panel.querySelector('#bounce-include-effects').checked;
        this.settings.normalize = panel.querySelector('#bounce-normalize').checked;
        
        // Show progress
        const progressDiv = panel.querySelector('#bounce-progress');
        progressDiv.style.display = 'block';
        
        // Create a test group (would use actual tracks in production)
        const group = this.createTrackGroup([], 'Test Group');
        
        // Simulate bouncing (would use actual tracks)
        const result = await this.bounceGroup(group);
        
        // Display result
        this.displayBounceResult(result);
    }
    
    displayBounceResult(result) {
        const panel = document.querySelector('#track-group-bounce-panel');
        if (!panel) return;
        
        const resultDiv = panel.querySelector('#bounce-result');
        const resultContent = panel.querySelector('#bounce-result-content');
        const downloadBtn = panel.querySelector('#download-bounce-btn');
        
        resultDiv.style.display = 'block';
        
        if (result.success) {
            resultContent.innerHTML = `
                <div style="color: #10b981;">✓ Bounce complete</div>
                <div style="margin-top: 8px; font-size: 11px; color: #888;">
                    Duration: ${result.duration?.toFixed(2) || '?'}s<br>
                    Tracks: ${result.trackCount || 0}<br>
                    Render time: ${result.renderTime || 0}ms
                </div>
            `;
            downloadBtn.style.display = 'block';
            this.lastBounceResult = result;
        } else {
            resultContent.innerHTML = `
                <div style="color: #ef4444;">✗ Bounce failed</div>
                <div style="margin-top: 8px; font-size: 11px; color: #888;">
                    ${result.error || 'Unknown error'}
                </div>
            `;
        }
    }
    
    downloadFromUI() {
        if (this.lastBounceResult?.audioFile) {
            const a = document.createElement('a');
            a.href = this.lastBounceResult.audioFile.url;
            a.download = `${this.lastBounceResult.groupName || 'bounce'}.wav`;
            a.click();
        }
    }
}

// Export singleton instance
let trackGroupBouncingInstance = null;

export function getTrackGroupBouncing(options = {}) {
    if (!trackGroupBouncingInstance) {
        trackGroupBouncingInstance = new TrackGroupBouncing(options);
    }
    return trackGroupBouncingInstance;
}

export function openTrackGroupBouncePanel() {
    const bouncer = getTrackGroupBouncing();
    return bouncer.createUI();
}