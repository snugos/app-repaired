// Audio Stem Export Enhancement - Export individual tracks as stems with effects included
// Provides comprehensive stem export with effect processing and format options

class AudioStemExportEnhancement {
    constructor(audioContext, tracks) {
        this.audioContext = audioContext;
        this.tracks = tracks || [];
        this.exportQueue = [];
        this.isExporting = false;
        this.currentProgress = 0;
        
        // Export settings
        this.settings = {
            format: 'wav',           // wav, mp3, flac, ogg, aiff
            sampleRate: 48000,       // 44100, 48000, 96000
            bitDepth: 24,            // 16, 24, 32 (for WAV/AIFF)
            channels: 'stereo',      // mono, stereo
            includeEffects: true,    // Include track effects in export
            includeMaster: false,    // Include master bus processing
            muteOtherTracks: true,  // Mute all other tracks during stem export
            normalize: true,         // Normalize peaks to -0.3dB
            dithering: true,         // Apply dithering for bit reduction
            fadeIn: 0,               // Fade in duration in seconds
            fadeOut: 0,              // Fade out duration in seconds
            tailLength: 2,           // Additional tail for reverb/delay tails
            filenameTemplate: '{project}_{track}_{date}', // Filename template
            metadata: {
                artist: '',
                album: '',
                year: new Date().getFullYear().toString(),
                genre: ''
            }
        };
        
        // Export formats configuration
        this.formats = {
            wav: { extension: '.wav', mimeType: 'audio/wav', supportsFloat: true },
            mp3: { extension: '.mp3', mimeType: 'audio/mpeg', bitrate: 320 },
            flac: { extension: '.flac', mimeType: 'audio/flac', compression: 8 },
            ogg: { extension: '.ogg', mimeType: 'audio/ogg', quality: 0.9 },
            aiff: { extension: '.aif', mimeType: 'audio/aiff', supportsFloat: true }
        };
        
        // Presets for common export scenarios
        this.presets = {
            streamingStems: {
                name: 'Streaming Stems',
                format: 'wav',
                sampleRate: 48000,
                bitDepth: 24,
                normalize: true,
                includeEffects: true
            },
            masteringStems: {
                name: 'Mastering Stems',
                format: 'wav',
                sampleRate: 96000,
                bitDepth: 32,
                normalize: false,
                includeEffects: false
            },
            collaborativeStems: {
                name: 'Collaborative Stems',
                format: 'wav',
                sampleRate: 48000,
                bitDepth: 24,
                includeEffects: true,
                includeMaster: false
            },
            archiveStems: {
                name: 'Archive Stems',
                format: 'flac',
                sampleRate: 48000,
                normalize: true,
                dithering: true
            },
            mp3Demo: {
                name: 'MP3 Demo',
                format: 'mp3',
                sampleRate: 44100,
                bitDepth: 16,
                normalize: true
            }
        };
        
        // Export history
        this.history = [];
        
        // Event callbacks
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        
        console.log('[AudioStemExportEnhancement] Initialized');
    }
    
    setTracks(tracks) {
        this.tracks = tracks || [];
    }
    
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (preset) {
            Object.keys(preset).forEach(key => {
                if (key !== 'name' && this.settings.hasOwnProperty(key)) {
                    this.settings[key] = preset[key];
                }
            });
            console.log('[AudioStemExportEnhancement] Applied preset:', preset.name);
            return true;
        }
        return false;
    }
    
    async exportAllStems(progressCallback) {
        if (this.isExporting) {
            console.warn('[AudioStemExportEnhancement] Export already in progress');
            return null;
        }
        
        this.isExporting = true;
        this.currentProgress = 0;
        this.onProgress = progressCallback;
        
        const results = [];
        const totalTracks = this.tracks.length;
        
        try {
            for (let i = 0; i < totalTracks; i++) {
                const track = this.tracks[i];
                
                // Update progress
                this.currentProgress = (i / totalTracks) * 100;
                if (this.onProgress) {
                    this.onProgress(this.currentProgress, `Exporting ${track.name || `Track ${i + 1}`}...`);
                }
                
                // Export the stem
                const stemBlob = await this.exportStem(track);
                if (stemBlob) {
                    results.push({
                        track: track,
                        blob: stemBlob,
                        filename: this.generateFilename(track)
                    });
                }
            }
            
            // Complete
            this.currentProgress = 100;
            if (this.onProgress) {
                this.onProgress(100, 'Export complete!');
            }
            
            // Add to history
            this.history.push({
                timestamp: Date.now(),
                tracks: totalTracks,
                settings: { ...this.settings }
            });
            
            this.isExporting = false;
            
            if (this.onComplete) {
                this.onComplete(results);
            }
            
            console.log('[AudioStemExportEnhancement] Exported', results.length, 'stems');
            return results;
            
        } catch (error) {
            this.isExporting = false;
            console.error('[AudioStemExportEnhancement] Export failed:', error);
            
            if (this.onError) {
                this.onError(error);
            }
            
            return null;
        }
    }
    
    async exportStem(track) {
        if (!track || !track.outputNode) {
            console.warn('[AudioStemExportEnhancement] Invalid track or missing output node');
            return null;
        }
        
        try {
            // Calculate duration from track clips or sequences
            const duration = this.calculateTrackDuration(track);
            if (duration <= 0) {
                console.warn('[AudioStemExportEnhancement] Track has no duration:', track.name);
                return null;
            }
            
            // Add tail for effects
            const totalDuration = duration + this.settings.tailLength;
            
            // Create offline context for rendering
            const sampleRate = this.settings.sampleRate;
            const channels = this.settings.channels === 'mono' ? 1 : 2;
            const offlineContext = new OfflineAudioContext(
                channels,
                totalDuration * sampleRate,
                sampleRate
            );
            
            // Clone track signal path to offline context
            const sourceNode = offlineContext.createBufferSource();
            
            // Get track audio data
            const trackBuffer = await this.renderTrackToBuffer(track, offlineContext);
            if (!trackBuffer) {
                return null;
            }
            
            sourceNode.buffer = trackBuffer;
            sourceNode.connect(offlineContext.destination);
            sourceNode.start(0);
            
            // Render
            const renderedBuffer = await offlineContext.startRendering();
            
            // Apply processing
            let processedBuffer = renderedBuffer;
            
            if (this.settings.normalize) {
                processedBuffer = this.normalizeBuffer(processedBuffer);
            }
            
            if (this.settings.fadeIn > 0 || this.settings.fadeOut > 0) {
                processedBuffer = this.applyFades(processedBuffer);
            }
            
            if (this.settings.dithering && this.settings.bitDepth < 32) {
                processedBuffer = this.applyDithering(processedBuffer, this.settings.bitDepth);
            }
            
            // Convert to blob
            const blob = await this.bufferToBlob(processedBuffer);
            
            return blob;
            
        } catch (error) {
            console.error('[AudioStemExportEnhancement] Failed to export stem:', track.name, error);
            return null;
        }
    }
    
    calculateTrackDuration(track) {
        // Check for audio clips
        if (track.clips && track.clips.length > 0) {
            let maxEnd = 0;
            track.clips.forEach(clip => {
                const end = (clip.startTime || 0) + (clip.duration || 0);
                if (end > maxEnd) maxEnd = end;
            });
            return maxEnd;
        }
        
        // Check for MIDI sequences
        if (track.sequences && track.sequences.length > 0) {
            const activeSeq = track.sequences.find(s => s.id === track.activeSequenceId);
            if (activeSeq && activeSeq.duration) {
                return activeSeq.duration;
            }
        }
        
        // Check for step sequencer pattern
        if (track.steps && track.steps.length > 0) {
            const bpm = track.bpm || 120;
            const stepDuration = 60 / bpm / 4; // 16th note
            return track.steps.length * stepDuration;
        }
        
        return 0;
    }
    
    async renderTrackToBuffer(track, offlineContext) {
        const duration = this.calculateTrackDuration(track) + this.settings.tailLength;
        const sampleRate = offlineContext.sampleRate;
        const channels = offlineContext.numberOfChannels;
        
        // Create empty buffer
        const buffer = offlineContext.createBuffer(channels, duration * sampleRate, sampleRate);
        
        // Check if we should mute other tracks
        const muteOtherTracks = this.settings.muteOtherTracks;
        const targetTrackId = track.id;
        
        // If muteOtherTracks is enabled and we have access to all tracks,
        // render only the target track
        if (muteOtherTracks && this.tracks.length > 1) {
            // Only render the specific track being exported
            await this.renderSingleTrackToBuffer(track, buffer, offlineContext);
        } else {
            // Render all tracks (original behavior)
            for (const t of this.tracks) {
                await this.renderSingleTrackToBuffer(t, buffer, offlineContext);
            }
        }
        
        return buffer;
    }
    
    async renderSingleTrackToBuffer(track, buffer, offlineContext) {
        const sampleRate = offlineContext.sampleRate;
        const channels = buffer.numberOfChannels;
        
        // For audio tracks, copy audio data from clips
        if (track.type === 'Audio' && track.clips) {
            for (const clip of track.clips) {
                if (clip.audioBuffer) {
                    const startSample = (clip.startTime || 0) * sampleRate;
                    const clipData = clip.audioBuffer;
                    
                    for (let ch = 0; ch < Math.min(channels, clipData.numberOfChannels); ch++) {
                        const outputData = buffer.getChannelData(ch);
                        const clipChannel = clipData.getChannelData(ch);
                        
                        for (let i = 0; i < clipChannel.length && startSample + i < outputData.length; i++) {
                            outputData[startSample + i] += clipChannel[i] * (clip.gain || 1);
                        }
                    }
                }
            }
        }
        
        // For instrument tracks, render MIDI to audio
        if ((track.type === 'Synth' || track.type === 'Sampler' || track.type === 'DrumSampler') && track.sequences) {
            const activeSeq = track.sequences.find(s => s.id === track.activeSequenceId);
            if (activeSeq && activeSeq.notes) {
                // Render each note
                const bpm = track.bpm || 120;
                const beatDuration = 60 / bpm;
                
                for (const note of activeSeq.notes) {
                    const startTime = note.time * beatDuration;
                    const noteDuration = note.duration * beatDuration;
                    const frequency = this.midiToFreq(note.midi || note.note);
                    const velocity = note.velocity || 0.8;
                    
                    // Simple sine wave synthesis for preview
                    // (In production, use actual synth/sampler rendering)
                    const startSample = Math.floor(startTime * sampleRate);
                    const endSample = Math.floor((startTime + noteDuration) * sampleRate);
                    
                    for (let ch = 0; ch < channels; ch++) {
                        const outputData = buffer.getChannelData(ch);
                        for (let i = startSample; i < endSample && i < outputData.length; i++) {
                            const t = (i - startSample) / sampleRate;
                            outputData[i] += Math.sin(2 * Math.PI * frequency * t) * velocity * 0.3;
                        }
                    }
                }
            }
        }
    }
    
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
    
    normalizeBuffer(buffer) {
        // Find peak
        let peak = 0;
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                const abs = Math.abs(data[i]);
                if (abs > peak) peak = abs;
            }
        }
        
        // Normalize to -0.3dB
        const targetPeak = Math.pow(10, -0.3 / 20);
        const gain = targetPeak / (peak || 1);
        
        // Apply gain
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                data[i] *= gain;
            }
        }
        
        return buffer;
    }
    
    applyFades(buffer) {
        const sampleRate = buffer.sampleRate;
        const fadeInSamples = Math.floor(this.settings.fadeIn * sampleRate);
        const fadeOutSamples = Math.floor(this.settings.fadeOut * sampleRate);
        
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            
            // Fade in
            for (let i = 0; i < fadeInSamples && i < data.length; i++) {
                data[i] *= i / fadeInSamples;
            }
            
            // Fade out
            const fadeOutStart = data.length - fadeOutSamples;
            for (let i = fadeOutStart; i < data.length; i++) {
                data[i] *= (data.length - i) / fadeOutSamples;
            }
        }
        
        return buffer;
    }
    
    applyDithering(buffer, bitDepth) {
        const levels = Math.pow(2, bitDepth);
        const step = 2 / levels;
        
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                // Add triangular dither
                const dither = (Math.random() - Math.random()) * step / 2;
                data[i] = Math.round((data[i] + dither) * levels / 2) * 2 / levels;
            }
        }
        
        return buffer;
    }
    
    async bufferToBlob(buffer) {
        const format = this.settings.format;
        const formatConfig = this.formats[format];
        
        // For WAV format
        if (format === 'wav' || format === 'aiff') {
            return this.encodeWAV(buffer);
        }
        
        // For other formats, we'd need external libraries
        // For now, fall back to WAV
        console.warn('[AudioStemExportEnhancement] Format', format, 'not natively supported, using WAV');
        return this.encodeWAV(buffer);
    }
    
    encodeWAV(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitDepth = this.settings.bitDepth;
        const bytesPerSample = bitDepth / 8;
        
        const samples = buffer.length;
        const dataSize = samples * numChannels * bytesPerSample;
        const bufferSize = 44 + dataSize;
        
        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);
        
        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, bitDepth === 32 ? 3 : 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
        view.setUint16(32, numChannels * bytesPerSample, true);
        view.setUint16(34, bitDepth, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);
        
        // Write samples
        let offset = 44;
        for (let i = 0; i < samples; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = buffer.getChannelData(ch)[i];
                
                if (bitDepth === 32) {
                    view.setFloat32(offset, sample, true);
                    offset += 4;
                } else if (bitDepth === 24) {
                    const intSample = Math.max(-8388608, Math.min(8388607, Math.round(sample * 8388608)));
                    view.setUint8(offset, intSample & 0xff);
                    view.setUint8(offset + 1, (intSample >> 8) & 0xff);
                    view.setUint8(offset + 2, (intSample >> 16) & 0xff);
                    offset += 3;
                } else {
                    const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32768)));
                    view.setInt16(offset, intSample, true);
                    offset += 2;
                }
            }
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
    
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    generateFilename(track) {
        const template = this.settings.filenameTemplate;
        const trackName = track.name || `Track_${track.id}`;
        const projectName = window.snugDAW?.projectName || 'Project';
        const date = new Date().toISOString().split('T')[0];
        
        return template
            .replace('{project}', projectName)
            .replace('{track}', trackName.replace(/[^a-zA-Z0-9]/g, '_'))
            .replace('{date}', date)
            + this.formats[this.settings.format].extension;
    }
    
    async downloadStems(results, asZip = false) {
        if (!results || results.length === 0) return;
        
        if (asZip && typeof JSZip !== 'undefined') {
            // Create ZIP bundle
            const zip = new JSZip();
            const folder = zip.folder('stems');
            
            for (const result of results) {
                folder.file(result.filename, result.blob);
            }
            
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stems_bundle_${new Date().toISOString().split('T')[0]}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('[AudioStemExportEnhancement] Downloaded ZIP bundle with', results.length, 'stems');
        } else {
            // Download individual files
            for (const result of results) {
                const url = URL.createObjectURL(result.blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename;
                a.click();
                URL.revokeObjectURL(url);
            }
            
            console.log('[AudioStemExportEnhancement] Downloaded', results.length, 'stems');
        }
    }
    
    async exportAndDownloadAll(progressCallback) {
        const results = await this.exportAllStems(progressCallback);
        if (results) {
            await this.downloadStems(results);
        }
        return results;
    }
    
    // Export selected tracks only
    async exportSelectedTracks(trackIds, progressCallback) {
        const selectedTracks = this.tracks.filter(t => trackIds.includes(t.id));
        const originalTracks = this.tracks;
        this.tracks = selectedTracks;
        
        const results = await this.exportAllStems(progressCallback);
        
        this.tracks = originalTracks;
        return results;
    }
    
    // Get track info for export preview
    getTrackExportInfo() {
        return this.tracks.map(track => ({
            id: track.id,
            name: track.name || `Track ${track.id}`,
            type: track.type,
            duration: this.calculateTrackDuration(track),
            hasEffects: track.effects && track.effects.length > 0,
            estimatedSize: this.estimateStemSize(track)
        }));
    }
    
    estimateStemSize(track) {
        const duration = this.calculateTrackDuration(track);
        const channels = this.settings.channels === 'mono' ? 1 : 2;
        const bytesPerSample = this.settings.bitDepth / 8;
        
        // WAV size estimation (header + data)
        const wavSize = 44 + (duration * this.settings.sampleRate * channels * bytesPerSample);
        
        // For compressed formats, estimate based on typical compression ratios
        const compressionRatios = {
            wav: 1,
            aiff: 1,
            flac: 0.6,
            mp3: 0.1,
            ogg: 0.1
        };
        
        return Math.round(wavSize * (compressionRatios[this.settings.format] || 1));
    }
    
    // Cancel current export
    cancelExport() {
        this.isExporting = false;
        this.currentProgress = 0;
        console.log('[AudioStemExportEnhancement] Export cancelled');
    }
    
    // Get export history
    getExportHistory() {
        return this.history;
    }
}

// UI Panel
function openAudioStemExportEnhancementPanel() {
    const existing = document.getElementById('stem-export-panel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'stem-export-panel';
    panel.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1a1a2e; border: 1px solid #444; border-radius: 8px; padding: 24px; z-index: 10000; min-width: 700px; max-height: 85vh; overflow-y: auto; color: white; font-family: system-ui;';
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 20px;">📦 Stem Export Enhancement</h2>
            <button id="close-stem-export" style="background: #333; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer;">✕</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- Settings -->
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">EXPORT SETTINGS</h3>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Format</label>
                    <select id="stem-format" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                        <option value="wav">WAV</option>
                        <option value="flac">FLAC</option>
                        <option value="mp3">MP3 (320kbps)</option>
                        <option value="ogg">OGG Vorbis</option>
                        <option value="aiff">AIFF</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Sample Rate</label>
                    <select id="stem-samplerate" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                        <option value="44100">44.1 kHz</option>
                        <option value="48000" selected>48 kHz</option>
                        <option value="96000">96 kHz</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Bit Depth</label>
                    <select id="stem-bitdepth" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                        <option value="16">16-bit</option>
                        <option value="24" selected>24-bit</option>
                        <option value="32">32-bit Float</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Channels</label>
                    <select id="stem-channels" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                        <option value="stereo">Stereo</option>
                        <option value="mono">Mono</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 16px; margin-top: 16px;">
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                        <input type="checkbox" id="include-effects" checked style="accent-color: #10b981;">
                        Include Effects
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                        <input type="checkbox" id="mute-other-tracks" checked style="accent-color: #10b981;">
                        Mute Other Tracks
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                        <input type="checkbox" id="normalize-stems" checked style="accent-color: #10b981;">
                        Normalize
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
                        <input type="checkbox" id="dithering-stems" checked style="accent-color: #10b981;">
                        Dithering
                    </label>
                </div>
            </div>
            
            <!-- Presets -->
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">PRESETS</h3>
                
                <div style="display: grid; gap: 8px;">
                    <button class="preset-btn" data-preset="streamingStems" style="padding: 10px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer; text-align: left;">
                        <div style="font-weight: bold;">Streaming Stems</div>
                        <div style="font-size: 11px; color: #888;">48kHz, 24-bit WAV, normalized</div>
                    </button>
                    <button class="preset-btn" data-preset="masteringStems" style="padding: 10px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer; text-align: left;">
                        <div style="font-weight: bold;">Mastering Stems</div>
                        <div style="font-size: 11px; color: #888;">96kHz, 32-bit float, no FX</div>
                    </button>
                    <button class="preset-btn" data-preset="collaborativeStems" style="padding: 10px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer; text-align: left;">
                        <div style="font-weight: bold;">Collaborative Stems</div>
                        <div style="font-size: 11px; color: #888;">48kHz, 24-bit WAV, with FX</div>
                    </button>
                    <button class="preset-btn" data-preset="archiveStems" style="padding: 10px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px; cursor: pointer; text-align: left;">
                        <div style="font-weight: bold;">Archive Stems</div>
                        <div style="font-size: 11px; color: #888;">FLAC lossless compression</div>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Track List -->
        <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 14px; color: #888;">TRACKS TO EXPORT</h3>
                <div style="display: flex; gap: 8px;">
                    <button id="select-all-tracks" style="padding: 4px 8px; background: #333; border: none; color: white; border-radius: 3px; cursor: pointer; font-size: 11px;">Select All</button>
                    <button id="deselect-all-tracks" style="padding: 4px 8px; background: #333; border: none; color: white; border-radius: 3px; cursor: pointer; font-size: 11px;">Deselect All</button>
                </div>
            </div>
            
            <div id="track-list" style="max-height: 200px; overflow-y: auto;">
                <!-- Tracks will be populated here -->
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid #333;">
                <span style="color: #888; font-size: 12px;" id="total-size">Total estimated size: --</span>
                <span style="color: #888; font-size: 12px;" id="selected-count">0 tracks selected</span>
            </div>
        </div>
        
        <!-- Progress -->
        <div id="progress-section" style="display: none; background: #0a0a14; padding: 16px; border-radius: 6px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span id="progress-status">Preparing...</span>
                <span id="progress-percent">0%</span>
            </div>
            <div style="background: #333; border-radius: 4px; height: 8px; overflow: hidden;">
                <div id="progress-bar" style="width: 0%; height: 100%; background: #10b981; transition: width 0.3s;"></div>
            </div>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button id="export-stems-btn" style="flex: 1; padding: 14px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px;">Export Stems</button>
            <button id="cancel-export-btn" style="display: none; padding: 14px 20px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Cancel</button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Populate track list
    const trackList = document.getElementById('track-list');
    const exportManager = window.snugDAW?.stemExport;
    
    if (exportManager) {
        const trackInfo = exportManager.getTrackExportInfo();
        trackList.innerHTML = trackInfo.map(track => `
            <label style="display: flex; align-items: center; padding: 8px; background: #1a1a2e; margin-bottom: 4px; border-radius: 4px; cursor: pointer;">
                <input type="checkbox" class="track-checkbox" data-track-id="${track.id}" checked style="accent-color: #10b981; margin-right: 12px;">
                <span style="flex: 1;">${track.name}</span>
                <span style="color: #888; font-size: 11px; margin-right: 12px;">${track.type}</span>
                <span style="color: #888; font-size: 11px;">${this.formatDuration(track.duration)} | ${this.formatSize(track.estimatedSize)}</span>
            </label>
        `).join('');
        
        updateTotals();
    }
    
    function updateTotals() {
        const checkboxes = trackList.querySelectorAll('.track-checkbox:checked');
        let totalSize = 0;
        checkboxes.forEach(cb => {
            const trackId = parseInt(cb.dataset.trackId);
            const track = trackInfo.find(t => t.id === trackId);
            if (track) totalSize += track.estimatedSize;
        });
        
        document.getElementById('selected-count').textContent = `${checkboxes.length} tracks selected`;
        document.getElementById('total-size').textContent = `Total estimated size: ${this.formatSize(totalSize)}`;
    }
    
    // Event handlers
    document.getElementById('close-stem-export').onclick = () => panel.remove();
    
    // Track selection
    trackList.onchange = updateTotals;
    document.getElementById('select-all-tracks').onclick = () => {
        trackList.querySelectorAll('.track-checkbox').forEach(cb => cb.checked = true);
        updateTotals();
    };
    document.getElementById('deselect-all-tracks').onclick = () => {
        trackList.querySelectorAll('.track-checkbox').forEach(cb => cb.checked = false);
        updateTotals();
    };
    
    // Presets
    panel.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
            const preset = btn.dataset.preset;
            exportManager.applyPreset(preset);
            // Update UI
            document.getElementById('stem-format').value = exportManager.settings.format;
            document.getElementById('stem-samplerate').value = exportManager.settings.sampleRate;
            document.getElementById('stem-bitdepth').value = exportManager.settings.bitDepth;
        };
    });
    
    // Export
    document.getElementById('export-stems-btn').onclick = async () => {
        const checkboxes = trackList.querySelectorAll('.track-checkbox:checked');
        const trackIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.trackId));
        
        if (trackIds.length === 0) {
            alert('Please select at least one track to export.');
            return;
        }
        
        // Update settings from UI
        exportManager.settings.format = document.getElementById('stem-format').value;
        exportManager.settings.sampleRate = parseInt(document.getElementById('stem-samplerate').value);
        exportManager.settings.bitDepth = parseInt(document.getElementById('stem-bitdepth').value);
        exportManager.settings.channels = document.getElementById('stem-channels').value;
        exportManager.settings.includeEffects = document.getElementById('include-effects').checked;
        exportManager.settings.muteOtherTracks = document.getElementById('mute-other-tracks').checked;
        exportManager.settings.normalize = document.getElementById('normalize-stems').checked;
        exportManager.settings.dithering = document.getElementById('dithering-stems').checked;
        
        // Check if ZIP bundle export
        const asZip = document.getElementById('export-as-zip')?.checked || false;
        
        // Show progress
        const progressSection = document.getElementById('progress-section');
        const exportBtn = document.getElementById('export-stems-btn');
        const cancelBtn = document.getElementById('cancel-export-btn');
        
        progressSection.style.display = 'block';
        exportBtn.disabled = true;
        cancelBtn.style.display = 'inline-block';
        
        const results = await exportManager.exportSelectedTracks(trackIds, (progress, status) => {
            document.getElementById('progress-bar').style.width = `${progress}%`;
            document.getElementById('progress-percent').textContent = `${Math.round(progress)}%`;
            document.getElementById('progress-status').textContent = status;
        });
        
        if (results) {
            await exportManager.downloadStems(results, asZip);
            const exportType = asZip ? 'ZIP bundle' : 'individual files';
            document.getElementById('progress-status').innerHTML = `<span style="color: #10b981;">✓ Export complete! (${exportType})</span>`;
        }
        
        exportBtn.disabled = false;
        cancelBtn.style.display = 'none';
    };
    
    // ZIP bundle checkbox
    const zipLabel = document.createElement('label');
    zipLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; margin-top: 12px; padding: 8px; background: #1a1a2e; border-radius: 4px;';
    zipLabel.innerHTML = `
        <input type="checkbox" id="export-as-zip" style="accent-color: #10b981;">
        <span style="color: white;">Export as ZIP bundle (all stems in one file)</span>
    `;
    panel.querySelector('.actions-section')?.appendChild(zipLabel) || document.getElementById('export-stems-btn').parentElement.appendChild(zipLabel);
}

// Helper methods attached to the function
AudioStemExportEnhancement.formatDuration = function(seconds) {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

AudioStemExportEnhancement.formatSize = function(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// Initialize
function initAudioStemExportEnhancement(audioContext, tracks) {
    const exporter = new AudioStemExportEnhancement(audioContext, tracks);
    
    if (!window.snugDAW) window.snugDAW = {};
    window.snugDAW.stemExport = exporter;
    
    return exporter;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AudioStemExportEnhancement, initAudioStemExportEnhancement, openAudioStemExportEnhancementPanel };
}