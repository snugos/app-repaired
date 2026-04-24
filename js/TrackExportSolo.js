/**
 * Track Export Solo
 * Export individual tracks with their solo/mute states preserved
 */

export class TrackExportSolo {
    constructor() {
        this.tracks = new Map(); // trackId -> { solo, mute, volume, pan, effects }
        this.exportFormat = 'wav';
        this.sampleRate = 44100;
        this.bitDepth = 16;
        this.includeMasterEffects = false;
        this.normalizeOutput = true;
    }

    /**
     * Add a track for export
     */
    addTrack(trackId, trackData = {}) {
        this.tracks.set(trackId, {
            name: trackData.name ?? trackId,
            solo: trackData.solo ?? false,
            mute: trackData.mute ?? false,
            volume: trackData.volume ?? 1,
            pan: trackData.pan ?? 0,
            effects: trackData.effects ?? [],
            clips: trackData.clips ?? [],
            type: trackData.type ?? 'audio', // 'audio' or 'midi'
            instrument: trackData.instrument ?? null
        });
        return this.tracks.get(trackId);
    }

    /**
     * Remove a track from export
     */
    removeTrack(trackId) {
        return this.tracks.delete(trackId);
    }

    /**
     * Clear all tracks
     */
    clearTracks() {
        this.tracks.clear();
    }

    /**
     * Get all tracks
     */
    getTracks() {
        return Array.from(this.tracks.entries()).map(([id, data]) => ({ id, ...data }));
    }

    /**
     * Get solo tracks (tracks that should be audible)
     */
    getSoloTracks() {
        const hasSolo = Array.from(this.tracks.values()).some(t => t.solo);
        
        if (hasSolo) {
            // Only solo tracks are audible
            return Array.from(this.tracks.entries())
                .filter(([id, t]) => t.solo && !t.mute)
                .map(([id, t]) => ({ id, ...t }));
        } else {
            // No solo - all non-muted tracks are audible
            return Array.from(this.tracks.entries())
                .filter(([id, t]) => !t.mute)
                .map(([id, t]) => ({ id, ...t }));
        }
    }

    /**
     * Check if a track is audible
     */
    isTrackAudible(trackId) {
        const track = this.tracks.get(trackId);
        if (!track) return false;
        
        const hasSolo = Array.from(this.tracks.values()).some(t => t.solo);
        
        if (hasSolo) {
            return track.solo && !track.mute;
        } else {
            return !track.mute;
        }
    }

    /**
     * Set export format
     */
    setExportFormat(format) {
        if (['wav', 'mp3', 'ogg', 'flac'].includes(format)) {
            this.exportFormat = format;
        }
    }

    /**
     * Set sample rate
     */
    setSampleRate(rate) {
        if ([22050, 44100, 48000, 88200, 96000].includes(rate)) {
            this.sampleRate = rate;
        }
    }

    /**
     * Set bit depth
     */
    setBitDepth(depth) {
        if ([16, 24, 32].includes(depth)) {
            this.bitDepth = depth;
        }
    }

    /**
     * Export a single track
     */
    async exportTrack(trackId, audioContext = null) {
        const track = this.tracks.get(trackId);
        if (!track) {
            console.error(`Track ${trackId} not found`);
            return null;
        }
        
        if (!this.isTrackAudible(trackId)) {
            console.warn(`Track ${trackId} is not audible (solo/mute state)`);
            return null;
        }
        
        const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });
        
        // Calculate total duration from clips
        let totalDuration = 0;
        track.clips.forEach(clip => {
            if (clip.endTime > totalDuration) {
                totalDuration = clip.endTime;
            }
        });
        
        if (totalDuration === 0) {
            console.warn(`Track ${trackId} has no clips`);
            return null;
        }
        
        const totalSamples = Math.ceil(totalDuration * ctx.sampleRate);
        
        // Create offline context for rendering
        const offlineCtx = new OfflineAudioContext(
            2, // Stereo
            totalSamples,
            ctx.sampleRate
        );
        
        // Render track to buffer
        // (This would integrate with the actual audio engine)
        const renderedBuffer = await offlineCtx.startRendering();
        
        // Apply normalization if enabled
        if (this.normalizeOutput) {
            this._normalizeBuffer(renderedBuffer);
        }
        
        return {
            trackId,
            name: track.name,
            buffer: renderedBuffer,
            format: this.exportFormat,
            sampleRate: ctx.sampleRate,
            duration: totalDuration
        };
    }

    /**
     * Export all audible tracks
     */
    async exportAllTracks(progressCallback = null) {
        const audibleTracks = this.getSoloTracks();
        const results = [];
        const total = audibleTracks.length;
        
        for (let i = 0; i < audibleTracks.length; i++) {
            const track = audibleTracks[i];
            const result = await this.exportTrack(track.id);
            
            results.push(result);
            
            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total,
                    trackId: track.id,
                    progress: (i + 1) / total * 100
                });
            }
        }
        
        return results;
    }

    /**
     * Export master mix (solo/mute aware)
     */
    async exportMasterMix(audioContext = null) {
        const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });
        
        const audibleTracks = this.getSoloTracks();
        
        // Calculate total duration
        let totalDuration = 0;
        audibleTracks.forEach(track => {
            track.clips.forEach(clip => {
                if (clip.endTime > totalDuration) {
                    totalDuration = clip.endTime;
                }
            });
        });
        
        if (totalDuration === 0) {
            return null;
        }
        
        const totalSamples = Math.ceil(totalDuration * ctx.sampleRate);
        
        const offlineCtx = new OfflineAudioContext(2, totalSamples, ctx.sampleRate);
        
        // Mix all audible tracks
        // (This would integrate with the actual audio engine)
        const renderedBuffer = await offlineCtx.startRendering();
        
        if (this.normalizeOutput) {
            this._normalizeBuffer(renderedBuffer);
        }
        
        return {
            name: 'Master Mix',
            buffer: renderedBuffer,
            format: this.exportFormat,
            sampleRate: ctx.sampleRate,
            duration: totalDuration,
            tracksIncluded: audibleTracks.length
        };
    }

    /**
     * Normalize buffer
     */
    _normalizeBuffer(buffer) {
        let maxPeak = 0;
        
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < data.length; i++) {
                const absVal = Math.abs(data[i]);
                if (absVal > maxPeak) {
                    maxPeak = absVal;
                }
            }
        }
        
        if (maxPeak > 0) {
            const targetPeak = 0.99; // -0.1 dB
            const gain = targetPeak / maxPeak;
            
            for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
                const data = buffer.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    data[i] *= gain;
                }
            }
        }
    }

    /**
     * Convert buffer to WAV blob
     */
    bufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        
        const wavBuffer = new ArrayBuffer(44 + length * numChannels * 2);
        const view = new DataView(wavBuffer);
        
        // Write WAV header
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
        view.setUint16(34, 16, true); // 16-bit
        writeString(36, 'data');
        view.setUint32(40, length * numChannels * 2, true);
        
        // Write audio data
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channels.push(buffer.getChannelData(ch));
        }
        
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }
        
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    /**
     * Get export presets
     */
    static getPresets() {
        return [
            { name: 'WAV 16-bit 44.1kHz', format: 'wav', sampleRate: 44100, bitDepth: 16 },
            { name: 'WAV 24-bit 48kHz', format: 'wav', sampleRate: 48000, bitDepth: 24 },
            { name: 'WAV 16-bit 96kHz', format: 'wav', sampleRate: 96000, bitDepth: 16 },
            { name: 'CD Quality', format: 'wav', sampleRate: 44100, bitDepth: 16 },
            { name: 'High Quality', format: 'wav', sampleRate: 96000, bitDepth: 24 }
        ];
    }

    /**
     * Apply preset
     */
    applyPreset(presetName) {
        const presets = TrackExportSolo.getPresets();
        const preset = presets.find(p => p.name === presetName);
        
        if (preset) {
            this.exportFormat = preset.format;
            this.sampleRate = preset.sampleRate;
            this.bitDepth = preset.bitDepth;
            return true;
        }
        
        return false;
    }

    /**
     * Export session summary
     */
    getExportSummary() {
        const tracks = this.getTracks();
        const soloTracks = this.getSoloTracks();
        
        return {
            totalTracks: tracks.length,
            audibleTracks: soloTracks.length,
            mutedTracks: tracks.filter(t => t.mute).length,
            soloedTracks: tracks.filter(t => t.solo).length,
            format: this.exportFormat,
            sampleRate: this.sampleRate,
            bitDepth: this.bitDepth
        };
    }
}

// UI Panel for track export with solo/mute awareness
let trackExportSoloPanel = null;

export function openTrackExportSoloPanel(services = {}) {
    if (trackExportSoloPanel) {
        trackExportSoloPanel.remove();
    }
    
    const exporter = new TrackExportSolo();
    
    const panel = document.createElement('div');
    panel.className = 'snug-window track-export-solo-panel';
    panel.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        width: 600px;
        max-height: 550px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div class="panel-header" style="
            padding: 12px 16px;
            background: linear-gradient(180deg, #2a2a4e 0%, #1a1a2e 100%);
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <h3 style="margin: 0; color: #fff; font-size: 16px;">Track Export (Solo/Mute Aware)</h3>
            <button class="close-btn" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
            ">×</button>
        </div>
        
        <div class="panel-content" style="padding: 16px; max-height: 450px; overflow-y: auto;">
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Export Preset</label>
                <select id="exportPreset" style="
                    width: 100%;
                    background: #2a2a4e;
                    color: #fff;
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 6px;
                ">
                    <option value="">-- Select Preset --</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Format</label>
                    <select id="exportFormat" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="wav">WAV</option>
                        <option value="mp3">MP3</option>
                        <option value="ogg">OGG</option>
                        <option value="flac">FLAC</option>
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Sample Rate</label>
                    <select id="sampleRate" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="44100">44.1 kHz</option>
                        <option value="48000">48 kHz</option>
                        <option value="88200">88.2 kHz</option>
                        <option value="96000">96 kHz</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: flex; align-items: center; gap: 8px; color: #fff; font-size: 12px;">
                    <input type="checkbox" id="normalizeOutput" checked style="accent-color: #4a9eff;">
                    Normalize Output
                </label>
            </div>
            
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #aaa; font-size: 12px;">Tracks</span>
                    <button id="refreshTracksBtn" style="
                        background: #3a3a6e;
                        color: #fff;
                        border: none;
                        border-radius: 4px;
                        padding: 4px 12px;
                        cursor: pointer;
                        font-size: 12px;
                    ">Refresh</button>
                </div>
                <div id="tracksList" style="
                    background: #0a0a1e;
                    border: 1px solid #333;
                    border-radius: 4px;
                    padding: 8px;
                    min-height: 100px;
                    max-height: 150px;
                    overflow-y: auto;
                ">
                    <div style="color: #666; text-align: center; padding: 20px;">No tracks</div>
                </div>
            </div>
            
            <div id="summarySection" style="
                background: #0a0a1e;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 12px;
                margin-bottom: 16px;
            ">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
                    <div>
                        <div style="color: #aaa; font-size: 11px;">Total</div>
                        <div id="totalTracks" style="color: #fff; font-size: 18px; font-weight: bold;">0</div>
                    </div>
                    <div>
                        <div style="color: #aaa; font-size: 11px;">Audible</div>
                        <div id="audibleTracks" style="color: #00ff88; font-size: 18px; font-weight: bold;">0</div>
                    </div>
                    <div>
                        <div style="color: #aaa; font-size: 11px;">Muted</div>
                        <div id="mutedTracks" style="color: #ff4a4a; font-size: 18px; font-weight: bold;">0</div>
                    </div>
                </div>
            </div>
            
            <div id="progressSection" style="display: none; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: #aaa; font-size: 12px;">Exporting...</span>
                    <span id="progressText" style="color: #fff; font-size: 12px;">0%</span>
                </div>
                <div style="background: #0a0a1e; border-radius: 4px; height: 8px; overflow: hidden;">
                    <div id="progressBar" style="background: linear-gradient(90deg, #4a9eff, #00ff88); height: 100%; width: 0%; transition: width 0.2s;"></div>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="exportMasterBtn" style="
                    background: linear-gradient(180deg, #4a9eff 0%, #2a5eff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                ">Export Master</button>
                <button id="exportStemsBtn" style="
                    background: linear-gradient(180deg, #00ff88 0%, #00aa55 100%);
                    color: #000;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                ">Export Stems</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    trackExportSoloPanel = panel;
    
    // Populate presets
    const presetSelect = panel.querySelector('#exportPreset');
    const presets = TrackExportSolo.getPresets();
    presets.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        presetSelect.appendChild(option);
    });
    
    // Get elements
    const formatSelect = panel.querySelector('#exportFormat');
    const sampleRateSelect = panel.querySelector('#sampleRate');
    const normalizeCheckbox = panel.querySelector('#normalizeOutput');
    const tracksList = panel.querySelector('#tracksList');
    const totalTracksSpan = panel.querySelector('#totalTracks');
    const audibleTracksSpan = panel.querySelector('#audibleTracks');
    const mutedTracksSpan = panel.querySelector('#mutedTracks');
    
    // Update summary
    const updateSummary = () => {
        const summary = exporter.getExportSummary();
        totalTracksSpan.textContent = summary.totalTracks;
        audibleTracksSpan.textContent = summary.audibleTracks;
        mutedTracksSpan.textContent = summary.mutedTracks;
    };
    
    // Update tracks list
    const updateTracksList = () => {
        const tracks = exporter.getTracks();
        
        if (tracks.length === 0) {
            tracksList.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No tracks</div>';
            updateSummary();
            return;
        }
        
        tracksList.innerHTML = tracks.map(track => {
            const isAudible = exporter.isTrackAudible(track.id);
            const bgColor = track.solo ? '#4a4a8e' : (track.mute ? '#3a2a2a' : '#2a2a4e');
            
            return `
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 8px;
                    margin-bottom: 4px;
                    background: ${bgColor};
                    border-radius: 4px;
                ">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="
                            width: 10px;
                            height: 10px;
                            border-radius: 50%;
                            background: ${isAudible ? '#00ff88' : '#666'};
                        "></span>
                        <span style="color: #fff; font-size: 12px;">${track.name}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button data-track-id="${track.id}" data-action="solo" style="
                            background: ${track.solo ? '#4a9eff' : '#222'};
                            color: ${track.solo ? '#fff' : '#888'};
                            border: none;
                            border-radius: 3px;
                            padding: 2px 8px;
                            cursor: pointer;
                            font-size: 10px;
                        ">S</button>
                        <button data-track-id="${track.id}" data-action="mute" style="
                            background: ${track.mute ? '#ff4a4a' : '#222'};
                            color: ${track.mute ? '#fff' : '#888'};
                            border: none;
                            border-radius: 3px;
                            padding: 2px 8px;
                            cursor: pointer;
                            font-size: 10px;
                        ">M</button>
                    </div>
                </div>
            `;
        }).join('');
        
        updateSummary();
    };
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
        trackExportSoloPanel = null;
    });
    
    presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
            exporter.applyPreset(presetSelect.value);
            formatSelect.value = exporter.exportFormat;
            sampleRateSelect.value = exporter.sampleRate.toString();
        }
    });
    
    formatSelect.addEventListener('change', () => {
        exporter.setExportFormat(formatSelect.value);
    });
    
    sampleRateSelect.addEventListener('change', () => {
        exporter.setSampleRate(parseInt(sampleRateSelect.value));
    });
    
    normalizeCheckbox.addEventListener('change', () => {
        exporter.normalizeOutput = normalizeCheckbox.checked;
    });
    
    // Track solo/mute buttons
    tracksList.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        
        const trackId = btn.dataset.trackId;
        const action = btn.dataset.action;
        const track = exporter.tracks.get(trackId);
        
        if (track) {
            if (action === 'solo') {
                track.solo = !track.solo;
            } else if (action === 'mute') {
                track.mute = !track.mute;
            }
            updateTracksList();
        }
    });
    
    // Refresh tracks button
    const refreshTracksBtn = panel.querySelector('#refreshTracksBtn');
    refreshTracksBtn.addEventListener('click', () => {
        if (services.getTracks) {
            const tracks = services.getTracks();
            tracks.forEach(t => {
                exporter.addTrack(t.id, {
                    name: t.name,
                    solo: t.solo ?? false,
                    mute: t.mute ?? false,
                    volume: t.volume ?? 1,
                    pan: t.pan ?? 0,
                    type: t.type,
                    clips: t.clips ?? []
                });
            });
        } else {
            // Demo tracks
            exporter.addTrack('track-1', { name: 'Drums', solo: false, mute: false, type: 'audio' });
            exporter.addTrack('track-2', { name: 'Bass', solo: true, mute: false, type: 'audio' });
            exporter.addTrack('track-3', { name: 'Synth', solo: false, mute: true, type: 'midi' });
            exporter.addTrack('track-4', { name: 'Vocals', solo: false, mute: false, type: 'audio' });
        }
        updateTracksList();
    });
    
    // Progress elements
    const progressSection = panel.querySelector('#progressSection');
    const progressBar = panel.querySelector('#progressBar');
    const progressText = panel.querySelector('#progressText');
    
    // Export master button
    const exportMasterBtn = panel.querySelector('#exportMasterBtn');
    exportMasterBtn.addEventListener('click', async () => {
        const audibleTracks = exporter.getSoloTracks();
        if (audibleTracks.length === 0) {
            alert('No audible tracks to export');
            return;
        }
        
        progressSection.style.display = 'block';
        exportMasterBtn.disabled = true;
        
        try {
            const result = await exporter.exportMasterMix();
            
            if (result && result.buffer) {
                const wavBlob = exporter.bufferToWav(result.buffer);
                const url = URL.createObjectURL(wavBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `master-mix-${Date.now()}.wav`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Export failed:', err);
        }
        
        progressSection.style.display = 'none';
        exportMasterBtn.disabled = false;
    });
    
    // Export stems button
    const exportStemsBtn = panel.querySelector('#exportStemsBtn');
    exportStemsBtn.addEventListener('click', async () => {
        const audibleTracks = exporter.getSoloTracks();
        if (audibleTracks.length === 0) {
            alert('No audible tracks to export');
            return;
        }
        
        progressSection.style.display = 'block';
        exportStemsBtn.disabled = true;
        
        const results = await exporter.exportAllTracks((progress) => {
            progressBar.style.width = `${progress.progress}%`;
            progressText.textContent = `${Math.round(progress.progress)}% (${progress.current}/${progress.total})`;
        });
        
        // Download each stem
        results.forEach(result => {
            if (result && result.buffer) {
                const wavBlob = exporter.bufferToWav(result.buffer);
                const url = URL.createObjectURL(wavBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${result.name}-${Date.now()}.wav`;
                a.click();
                URL.revokeObjectURL(url);
            }
        });
        
        progressSection.style.display = 'none';
        exportStemsBtn.disabled = false;
    });
    
    // Initial refresh
    refreshTracksBtn.click();
    
    return panel;
}

export default TrackExportSolo;