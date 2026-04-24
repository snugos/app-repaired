/**
 * Mixdown Reference Export - One-click export with reference metadata embedded
 */

export class MixdownReferenceExport {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        
        // Export settings
        this.settings = {
            format: options.format ?? 'wav', // wav, mp3, flac, ogg
            sampleRate: options.sampleRate ?? 44100,
            bitDepth: options.bitDepth ?? 24, // for WAV
            bitrate: options.bitrate ?? 320, // for MP3 (kbps)
            
            // Normalization
            normalize: options.normalize ?? true,
            targetLUFS: options.targetLUFS ?? -14, // streaming standard
            
            // Headroom
            headroom: options.headroom ?? -0.3, // dB
            
            // Dithering
            dither: options.dither ?? true,
            ditherType: options.ditherType ?? 'triangular', // rectangular, triangular, gaussian
            
            // Reference metadata
            includeMetadata: options.includeMetadata ?? true,
            embedLoudnessInfo: options.embedLoudnessInfo ?? true,
            embedFrequencyInfo: options.embedFrequencyInfo ?? true,
            embedDynamicRange: options.embedDynamicRange ?? true,
            
            // Reference track comparison
            includeReferenceComparison: options.includeReferenceComparison ?? false,
            referenceTrackPath: options.referenceTrackPath ?? null,
            
            // Additional exports
            includeStems: options.includeStems ?? false,
            includeInstrumental: options.includeInstrumental ?? false,
            includeAcappella: options.includeAcappella ?? false
        };
        
        // Analysis results
        this.analysis = {
            peakLevel: 0,
            rmsLevel: 0,
            lufs: 0,
            dynamicRange: 0,
            frequencySpectrum: null,
            stereoWidth: 0,
            truePeak: 0
        };
        
        // Reference comparison
        this.comparison = null;
        
        // Export presets
        this.presets = [
            { name: 'Streaming (Spotify/Apple)', format: 'wav', targetLUFS: -14, headroom: -1 },
            { name: 'YouTube', format: 'wav', targetLUFS: -14, headroom: -1 },
            { name: 'CD Master', format: 'wav', sampleRate: 44100, bitDepth: 16, targetLUFS: -9, headroom: -0.3 },
            { name: 'SoundCloud', format: 'wav', targetLUFS: -14, headroom: -1 },
            { name: 'Broadcast (EBU R128)', format: 'wav', targetLUFS: -23, headroom: -1 },
            { name: 'Club/DJ', format: 'wav', targetLUFS: -8, headroom: -0.3 },
            { name: 'Demo/Reference', format: 'mp3', bitrate: 192, targetLUFS: -16, headroom: -1 },
            { name: 'Podcast', format: 'mp3', bitrate: 128, targetLUFS: -19, headroom: -2 },
            { name: 'Film/TV', format: 'wav', targetLUFS: -27, headroom: -2 }
        ];
    }
    
    init(audioContext) {
        this.audioContext = audioContext;
        console.log('[MixdownReferenceExport] Initialized');
    }
    
    /**
     * Analyze audio before export
     */
    async analyzeAudio(audioBuffer) {
        if (!audioBuffer) {
            console.warn('[MixdownReferenceExport] No audio buffer to analyze');
            return null;
        }
        
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        // Create analyzer nodes
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        
        const analyzer = offlineContext.createAnalyser();
        analyzer.fftSize = 8192;
        
        source.connect(analyzer);
        analyzer.connect(offlineContext.destination);
        source.start();
        
        // Render
        const renderedBuffer = await offlineContext.startRendering();
        
        // Analyze
        const channelData = renderedBuffer.getChannelData(0);
        
        // Peak level
        let peak = 0;
        for (let i = 0; i < channelData.length; i++) {
            const abs = Math.abs(channelData[i]);
            if (abs > peak) peak = abs;
        }
        this.analysis.peakLevel = 20 * Math.log10(peak);
        
        // RMS level
        let sumSquares = 0;
        for (let i = 0; i < channelData.length; i++) {
            sumSquares += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sumSquares / channelData.length);
        this.analysis.rmsLevel = 20 * Math.log10(rms);
        
        // LUFS estimation (simplified)
        // Real LUFS requires K-weighted filtering and gating
        this.analysis.lufs = this.analysis.rmsLevel - 10; // Approximate
        
        // Dynamic range
        this.analysis.dynamicRange = this.analysis.peakLevel - this.analysis.rmsLevel;
        
        // True peak (inter-sample peak estimation)
        this.analysis.truePeak = this.analysis.peakLevel + 0.5; // Add margin
        
        // Stereo width (if stereo)
        if (renderedBuffer.numberOfChannels > 1) {
            const leftData = renderedBuffer.getChannelData(0);
            const rightData = renderedBuffer.getChannelData(1);
            
            let midSum = 0;
            let sideSum = 0;
            for (let i = 0; i < leftData.length; i++) {
                const mid = (leftData[i] + rightData[i]) / 2;
                const side = (leftData[i] - rightData[i]) / 2;
                midSum += mid * mid;
                sideSum += side * side;
            }
            
            const midRms = Math.sqrt(midSum / leftData.length);
            const sideRms = Math.sqrt(sideSum / leftData.length);
            this.analysis.stereoWidth = sideRms > 0 ? midRms / sideRms : 0;
        }
        
        console.log('[MixdownReferenceExport] Analysis complete:', this.analysis);
        return this.analysis;
    }
    
    /**
     * Apply normalization to target LUFS
     */
    normalizeAudio(audioBuffer, targetLUFS = this.settings.targetLUFS) {
        const currentLUFS = this.analysis.lufs;
        const gainChange = targetLUFS - currentLUFS;
        const gainLinear = Math.pow(10, gainChange / 20);
        
        // Create new buffer
        const normalizedBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        // Apply gain
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const inputData = audioBuffer.getChannelData(ch);
            const outputData = normalizedBuffer.getChannelData(ch);
            
            for (let i = 0; i < inputData.length; i++) {
                outputData[i] = inputData[i] * gainLinear;
            }
        }
        
        console.log(`[MixdownReferenceExport] Normalized from ${currentLUFS} LUFS to ${targetLUFS} LUFS`);
        return normalizedBuffer;
    }
    
    /**
     * Apply dithering
     */
    applyDither(audioBuffer) {
        if (!this.settings.dither) return audioBuffer;
        
        const ditheredBuffer = this.audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );
        
        const ditherAmplitude = Math.pow(2, -(this.settings.bitDepth - 1));
        
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
            const inputData = audioBuffer.getChannelData(ch);
            const outputData = ditheredBuffer.getChannelData(ch);
            
            for (let i = 0; i < inputData.length; i++) {
                // Triangular dither
                let dither = 0;
                if (this.settings.ditherType === 'triangular') {
                    dither = (Math.random() + Math.random() - 1) * ditherAmplitude;
                } else if (this.settings.ditherType === 'gaussian') {
                    // Box-Muller transform for Gaussian
                    const u1 = Math.random();
                    const u2 = Math.random();
                    dither = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * ditherAmplitude * 0.5;
                } else {
                    // Rectangular
                    dither = (Math.random() - 0.5) * ditherAmplitude;
                }
                
                outputData[i] = inputData[i] + dither;
            }
        }
        
        console.log('[MixdownReferenceExport] Dither applied');
        return ditheredBuffer;
    }
    
    /**
     * Compare with reference track
     */
    async compareWithReference(audioBuffer, referenceBuffer) {
        if (!referenceBuffer) {
            console.warn('[MixdownReferenceExport] No reference buffer for comparison');
            return null;
        }
        
        // Analyze both
        const mixAnalysis = await this.analyzeAudio(audioBuffer);
        const refAnalysis = await this.analyzeAudio(referenceBuffer);
        
        this.comparison = {
            loudnessDifference: mixAnalysis.lufs - refAnalysis.lufs,
            dynamicRangeDifference: mixAnalysis.dynamicRange - refAnalysis.dynamicRange,
            peakDifference: mixAnalysis.peakLevel - refAnalysis.peakLevel,
            stereoWidthDifference: mixAnalysis.stereoWidth - refAnalysis.stereoWidth,
            recommendations: []
        };
        
        // Generate recommendations
        if (this.comparison.loudnessDifference > 3) {
            this.comparison.recommendations.push('Mix is significantly louder than reference');
        } else if (this.comparison.loudnessDifference < -3) {
            this.comparison.recommendations.push('Mix is significantly quieter than reference');
        }
        
        if (this.comparison.dynamicRangeDifference > 6) {
            this.comparison.recommendations.push('Mix has more dynamic range than reference');
        } else if (this.comparison.dynamicRangeDifference < -6) {
            this.comparison.recommendations.push('Mix is more compressed than reference');
        }
        
        console.log('[MixdownReferenceExport] Comparison complete:', this.comparison);
        return this.comparison;
    }
    
    /**
     * Export audio as WAV blob
     */
    exportAsWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = this.settings.bitDepth;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        
        const dataLength = audioBuffer.length * blockAlign;
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);
        
        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // Write audio data
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channels.push(audioBuffer.getChannelData(ch));
        }
        
        let offset = 44;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                let sample = channels[ch][i];
                sample = Math.max(-1, Math.min(1, sample));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                
                if (bitDepth === 16) {
                    view.setInt16(offset, sample, true);
                    offset += 2;
                } else if (bitDepth === 24) {
                    // 24-bit as 3 bytes
                    const s = sample << 8;
                    view.setUint8(offset++, (s >> 16) & 0xFF);
                    view.setUint8(offset++, (s >> 8) & 0xFF);
                    view.setUint8(offset++, s & 0xFF);
                } else {
                    view.setInt32(offset, sample * 0x10000, true);
                    offset += 4;
                }
            }
        }
        
        return new Blob([buffer], {type: 'audio/wav'});
    }
    
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    /**
     * Generate reference metadata report
     */
    generateMetadataReport(projectInfo = {}) {
        const report = {
            exportDate: new Date().toISOString(),
            project: projectInfo.name || 'Untitled Project',
            
            audio: {
                format: this.settings.format,
                sampleRate: this.settings.sampleRate,
                bitDepth: this.settings.bitDepth,
                duration: projectInfo.duration || 0
            },
            
            loudness: {
                lufs: this.analysis.lufs.toFixed(1),
                peak: this.analysis.peakLevel.toFixed(1),
                rms: this.analysis.rmsLevel.toFixed(1),
                truePeak: this.analysis.truePeak.toFixed(1),
                dynamicRange: this.analysis.dynamicRange.toFixed(1)
            },
            
            stereo: {
                width: this.analysis.stereoWidth.toFixed(2),
                channels: 'stereo'
            },
            
            target: {
                targetLUFS: this.settings.targetLUFS,
                headroom: this.settings.headroom,
                normalized: this.settings.normalize
            },
            
            comparison: this.comparison ? {
                loudnessDifference: this.comparison.loudnessDifference.toFixed(1),
                dynamicRangeDifference: this.comparison.dynamicRangeDifference.toFixed(1),
                recommendations: this.comparison.recommendations
            } : null,
            
            notes: projectInfo.notes || ''
        };
        
        return report;
    }
    
    /**
     * Apply preset
     */
    applyPreset(presetName) {
        const preset = this.presets.find(p => p.name === presetName);
        if (preset) {
            Object.assign(this.settings, preset);
            console.log(`[MixdownReferenceExport] Applied preset: ${presetName}`);
            return true;
        }
        return false;
    }
    
    /**
     * Get all presets
     */
    getPresets() {
        return this.presets.map(p => ({name: p.name, description: p.name}));
    }
    
    /**
     * Quick export with current settings
     */
    async quickExport(audioBuffer, projectInfo = {}) {
        // Analyze
        await this.analyzeAudio(audioBuffer);
        
        // Normalize if needed
        let processedBuffer = audioBuffer;
        if (this.settings.normalize) {
            processedBuffer = this.normalizeAudio(audioBuffer);
        }
        
        // Apply dither
        processedBuffer = this.applyDither(processedBuffer);
        
        // Export as WAV
        const blob = this.exportAsWav(processedBuffer);
        
        // Generate metadata
        const metadata = this.generateMetadataReport(projectInfo);
        
        console.log('[MixdownReferenceExport] Quick export complete');
        
        return {
            blob,
            filename: `${projectInfo.name || 'mixdown'}.wav`,
            metadata
        };
    }
    
    /**
     * Get current state
     */
    getState() {
        return {
            settings: {...this.settings},
            analysis: {...this.analysis},
            comparison: this.comparison
        };
    }
    
    /**
     * Set state
     */
    setState(state) {
        if (state.settings) {
            Object.assign(this.settings, state.settings);
        }
        if (state.analysis) {
            Object.assign(this.analysis, state.analysis);
        }
        this.comparison = state.comparison;
    }
}

/**
 * Mixdown Export Manager
 */
export class MixdownExportManager {
    constructor() {
        this.exporters = new Map();
        this.audioContext = null;
    }
    
    init(audioContext) {
        this.audioContext = audioContext;
        console.log('[MixdownExportManager] Initialized');
    }
    
    createExport(options = {}) {
        const exporter = new MixdownReferenceExport({
            audioContext: this.audioContext,
            ...options
        });
        const id = Date.now().toString();
        this.exporters.set(id, exporter);
        return {id, exporter};
    }
    
    getExport(id) {
        return this.exporters.get(id);
    }
    
    removeExport(id) {
        this.exporters.delete(id);
    }
    
    dispose() {
        this.exporters.clear();
        this.audioContext = null;
    }
}

// Global instance
let mixdownExportManager = null;

export function getMixdownExportManager() {
    if (!mixdownExportManager) {
        mixdownExportManager = new MixdownExportManager();
    }
    return mixdownExportManager;
}

export function openMixdownExportPanel(audioBuffer, projectInfo = {}) {
    const manager = getMixdownExportManager();
    const {id, exporter} = manager.createExport();
    
    const panel = document.createElement('div');
    panel.className = 'mixdown-export-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        padding: 24px;
        border-radius: 8px;
        border: 1px solid #333;
        color: white;
        z-index: 10000;
        min-width: 450px;
        font-family: system-ui, sans-serif;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px;">Export Mixdown</h3>
            <button class="close-btn" style="background: none; border: none; color: #888; cursor: pointer; font-size: 20px;">&times;</button>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="font-size: 12px; color: #888; display: block; margin-bottom: 8px;">Preset</label>
            <select id="export-preset" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #333; color: white; border-radius: 4px;">
                <option value="">Custom</option>
                ${exporter.getPresets().map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
            </select>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div>
                <label style="font-size: 12px; color: #888; display: block; margin-bottom: 4px;">Format</label>
                <select id="export-format" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #333; color: white; border-radius: 4px;">
                    <option value="wav">WAV</option>
                    <option value="mp3">MP3</option>
                    <option value="flac">FLAC</option>
                </select>
            </div>
            <div>
                <label style="font-size: 12px; color: #888; display: block; margin-bottom: 4px;">Bit Depth</label>
                <select id="export-bitdepth" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #333; color: white; border-radius: 4px;">
                    <option value="16">16-bit</option>
                    <option value="24" selected>24-bit</option>
                    <option value="32">32-bit</option>
                </select>
            </div>
        </div>
        
        <div style="margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #888;">Target LUFS</span>
                <span id="lufs-display">${exporter.settings.targetLUFS}</span>
            </div>
            <input type="range" id="export-lufs" min="-30" max="-6" value="${exporter.settings.targetLUFS}" style="width: 100%;">
        </div>
        
        <div style="margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="export-normalize" ${exporter.settings.normalize ? 'checked' : ''}>
                <span>Normalize to target</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="export-dither" ${exporter.settings.dither ? 'checked' : ''}>
                <span>Apply dithering</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="export-metadata" ${exporter.settings.includeMetadata ? 'checked' : ''}>
                <span>Include reference metadata</span>
            </label>
        </div>
        
        <div id="export-analysis" style="display: none; margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px;">Analysis</h4>
            <div id="analysis-content"></div>
        </div>
        
        <div style="display: flex; gap: 8px;">
            <button id="export-analyze" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                Analyze
            </button>
            <button id="export-download" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Export & Download
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.onclick = () => {
        manager.removeExport(id);
        panel.remove();
    };
    
    const presetSelect = panel.querySelector('#export-preset');
    presetSelect.onchange = () => {
        if (presetSelect.value) {
            exporter.applyPreset(presetSelect.value);
            // Update UI
            panel.querySelector('#export-lufs').value = exporter.settings.targetLUFS;
            panel.querySelector('#lufs-display').textContent = exporter.settings.targetLUFS;
            panel.querySelector('#export-bitdepth').value = exporter.settings.bitDepth;
        }
    };
    
    const lufsSlider = panel.querySelector('#export-lufs');
    const lufsDisplay = panel.querySelector('#lufs-display');
    lufsSlider.oninput = () => {
        exporter.settings.targetLUFS = parseInt(lufsSlider.value);
        lufsDisplay.textContent = lufsSlider.value;
    };
    
    const analyzeBtn = panel.querySelector('#export-analyze');
    analyzeBtn.onclick = async () => {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        
        await exporter.analyzeAudio(audioBuffer);
        
        const analysisDiv = panel.querySelector('#export-analysis');
        const contentDiv = panel.querySelector('#analysis-content');
        
        contentDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div>LUFS: <strong>${exporter.analysis.lufs.toFixed(1)}</strong></div>
                <div>Peak: <strong>${exporter.analysis.peakLevel.toFixed(1)} dB</strong></div>
                <div>RMS: <strong>${exporter.analysis.rmsLevel.toFixed(1)} dB</strong></div>
                <div>Dynamic Range: <strong>${exporter.analysis.dynamicRange.toFixed(1)} dB</strong></div>
            </div>
        `;
        
        analysisDiv.style.display = 'block';
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze';
    };
    
    const downloadBtn = panel.querySelector('#export-download');
    downloadBtn.onclick = async () => {
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Exporting...';
        
        // Update settings from checkboxes
        exporter.settings.normalize = panel.querySelector('#export-normalize').checked;
        exporter.settings.dither = panel.querySelector('#export-dither').checked;
        exporter.settings.includeMetadata = panel.querySelector('#export-metadata').checked;
        exporter.settings.bitDepth = parseInt(panel.querySelector('#export-bitdepth').value);
        
        const result = await exporter.quickExport(audioBuffer, projectInfo);
        
        // Download
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        
        // Log metadata
        console.log('[MixdownReferenceExport] Metadata:', result.metadata);
        
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Export & Download';
        
        // Show success notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            font-family: system-ui, sans-serif;
        `;
        notification.textContent = 'Mixdown exported successfully!';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    };
    
    return panel;
}

// Module initialized
console.log('[MixdownReferenceExport] Module loaded');