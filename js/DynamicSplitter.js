/**
 * Dynamic Splitter - Split audio based on silence/transients
 * Automatically splits audio into regions based on silence detection or transients
 */

export class DynamicSplitter {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = this.audioContext?.sampleRate || 44100;
        
        // Detection settings
        this.settings = {
            mode: options.mode || 'silence', // silence, transient, or both
            silenceThreshold: options.silenceThreshold || -50, // dB
            minSilenceDuration: options.minSilenceDuration || 0.2, // seconds
            minRegionDuration: options.minRegionDuration || 0.1, // seconds
            transientThreshold: options.transientThreshold || 0.3,
            fadeLength: options.fadeLength || 0.01, // seconds
            zeroCrossing: options.zeroCrossing || true,
            mergeAdjacent: options.mergeAdjacent || true,
            maxRegions: options.maxRegions || 100
        };
        
        // Results
        this.regions = [];
        this.originalBuffer = null;
    }
    
    /**
     * Load audio buffer for splitting
     */
    loadBuffer(audioBuffer) {
        this.originalBuffer = audioBuffer;
        this.regions = [];
        
        console.log(`[DynamicSplitter] Loaded buffer: ${audioBuffer.duration.toFixed(2)}s`);
    }
    
    /**
     * Split audio into regions
     */
    split(options = {}) {
        if (!this.originalBuffer) {
            throw new Error('No audio buffer loaded');
        }
        
        const settings = { ...this.settings, ...options };
        const audioBuffer = this.originalBuffer;
        
        // Get mono data for analysis
        const monoData = this.getMonoData(audioBuffer);
        
        // Detect regions based on mode
        let regions = [];
        
        if (settings.mode === 'silence' || settings.mode === 'both') {
            const silenceRegions = this.detectSilenceRegions(monoData, audioBuffer.sampleRate, settings);
            regions = regions.concat(silenceRegions);
        }
        
        if (settings.mode === 'transient' || settings.mode === 'both') {
            const transientRegions = this.detectTransientRegions(monoData, audioBuffer.sampleRate, settings);
            regions = regions.concat(transientRegions);
        }
        
        // Merge and clean regions
        regions = this.mergeRegions(regions, settings);
        
        // Apply zero-crossing if enabled
        if (settings.zeroCrossing) {
            regions = this.snapToZeroCrossings(regions, monoData, settings);
        }
        
        // Limit max regions
        if (regions.length > settings.maxRegions) {
            regions = regions.slice(0, settings.maxRegions);
        }
        
        // Create region buffers
        this.regions = regions.map((region, i) => ({
            ...region,
            id: i,
            buffer: this.extractRegion(audioBuffer, region, settings)
        }));
        
        console.log(`[DynamicSplitter] Split into ${this.regions.length} regions`);
        
        return this.regions;
    }
    
    /**
     * Get mono data from audio buffer
     */
    getMonoData(audioBuffer) {
        if (audioBuffer.numberOfChannels === 1) {
            return audioBuffer.getChannelData(0);
        }
        
        const mono = new Float32Array(audioBuffer.length);
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                mono[i] += channelData[i] / audioBuffer.numberOfChannels;
            }
        }
        
        return mono;
    }
    
    /**
     * Detect regions based on silence
     */
    detectSilenceRegions(audioData, sampleRate, settings) {
        const regions = [];
        const thresholdLinear = Math.pow(10, settings.silenceThreshold / 20);
        const minSilenceSamples = Math.floor(settings.minSilenceDuration * sampleRate);
        const minRegionSamples = Math.floor(settings.minRegionDuration * sampleRate);
        
        let inSilence = false;
        let silenceStart = 0;
        let lastRegionEnd = 0;
        
        for (let i = 0; i < audioData.length; i++) {
            const sample = Math.abs(audioData[i]);
            
            if (sample < thresholdLinear) {
                if (!inSilence) {
                    silenceStart = i;
                    inSilence = true;
                }
            } else {
                if (inSilence && (i - silenceStart) >= minSilenceSamples) {
                    // End of silence region - split here
                    if (silenceStart - lastRegionEnd >= minRegionSamples) {
                        regions.push({
                            startSample: lastRegionEnd,
                            endSample: silenceStart,
                            startTime: lastRegionEnd / sampleRate,
                            endTime: silenceStart / sampleRate,
                            duration: (silenceStart - lastRegionEnd) / sampleRate,
                            type: 'audio',
                            splitReason: 'silence'
                        });
                    }
                    
                    lastRegionEnd = i;
                }
                inSilence = false;
            }
        }
        
        // Add final region if any
        if (audioData.length - lastRegionEnd >= minRegionSamples) {
            regions.push({
                startSample: lastRegionEnd,
                endSample: audioData.length,
                startTime: lastRegionEnd / sampleRate,
                endTime: audioData.length / sampleRate,
                duration: (audioData.length - lastRegionEnd) / sampleRate,
                type: 'audio',
                splitReason: 'end'
            });
        }
        
        return regions;
    }
    
    /**
     * Detect regions based on transients
     */
    detectTransientRegions(audioData, sampleRate, settings) {
        const regions = [];
        const minRegionSamples = Math.floor(settings.minRegionDuration * sampleRate);
        
        // Detect transients using onset detection
        const transients = this.detectTransients(audioData, sampleRate, settings.transientThreshold);
        
        if (transients.length === 0) {
            // No transients found, return entire audio as one region
            return [{
                startSample: 0,
                endSample: audioData.length,
                startTime: 0,
                endTime: audioData.length / sampleRate,
                duration: audioData.length / sampleRate,
                type: 'audio',
                splitReason: 'no-transients'
            }];
        }
        
        // Create regions between transients
        let lastEnd = 0;
        
        for (let i = 0; i < transients.length; i++) {
            const transient = transients[i];
            
            if (transient.samplePosition - lastEnd >= minRegionSamples) {
                regions.push({
                    startSample: lastEnd,
                    endSample: transient.samplePosition,
                    startTime: lastEnd / sampleRate,
                    endTime: transient.samplePosition / sampleRate,
                    duration: (transient.samplePosition - lastEnd) / sampleRate,
                    type: 'audio',
                    splitReason: 'transient',
                    transientStrength: transient.strength
                });
            }
            
            lastEnd = transient.samplePosition;
        }
        
        // Add final region
        if (audioData.length - lastEnd >= minRegionSamples) {
            regions.push({
                startSample: lastEnd,
                endSample: audioData.length,
                startTime: lastEnd / sampleRate,
                endTime: audioData.length / sampleRate,
                duration: (audioData.length - lastEnd) / sampleRate,
                type: 'audio',
                splitReason: 'end'
            });
        }
        
        return regions;
    }
    
    /**
     * Detect transients in audio
     */
    detectTransients(audioData, sampleRate, threshold) {
        const transients = [];
        const fftSize = 2048;
        const hopSize = 512;
        
        // Calculate onset envelope
        const envelope = this.calculateOnsetEnvelope(audioData, fftSize, hopSize);
        
        // Find peaks
        const maxValue = Math.max(...envelope);
        const normalizedThreshold = threshold * maxValue;
        
        for (let i = 1; i < envelope.length - 1; i++) {
            if (envelope[i] > envelope[i - 1] && 
                envelope[i] > envelope[i + 1] &&
                envelope[i] > normalizedThreshold) {
                
                const samplePosition = i * hopSize;
                
                transients.push({
                    frame: i,
                    samplePosition,
                    time: samplePosition / sampleRate,
                    strength: envelope[i]
                });
            }
        }
        
        return transients;
    }
    
    /**
     * Calculate onset envelope
     */
    calculateOnsetEnvelope(audioData, fftSize, hopSize) {
        const numFrames = Math.floor((audioData.length - fftSize) / hopSize);
        const envelope = new Float32Array(numFrames);
        let prevSpectrum = null;
        
        for (let frame = 0; frame < numFrames; frame++) {
            const start = frame * hopSize;
            let flux = 0;
            
            // Simple spectrum calculation
            const spectrum = new Float32Array(fftSize / 2);
            for (let k = 0; k < fftSize / 2; k++) {
                let real = 0;
                let imag = 0;
                
                for (let n = 0; n < fftSize; n++) {
                    const idx = start + n;
                    if (idx < audioData.length) {
                        const window = 0.5 * (1 - Math.cos(2 * Math.PI * n / fftSize));
                        const sample = audioData[idx] * window;
                        real += sample * Math.cos(2 * Math.PI * k * n / fftSize);
                        imag -= sample * Math.sin(2 * Math.PI * k * n / fftSize);
                    }
                }
                
                spectrum[k] = Math.sqrt(real * real + imag * imag);
            }
            
            // Spectral flux
            if (prevSpectrum) {
                for (let k = 0; k < spectrum.length; k++) {
                    const diff = spectrum[k] - prevSpectrum[k];
                    if (diff > 0) {
                        flux += diff;
                    }
                }
            }
            
            envelope[frame] = flux;
            prevSpectrum = spectrum;
        }
        
        return envelope;
    }
    
    /**
     * Merge overlapping or adjacent regions
     */
    mergeRegions(regions, settings) {
        if (regions.length === 0) return [];
        
        // Sort by start time
        regions.sort((a, b) => a.startSample - b.startSample);
        
        if (!settings.mergeAdjacent) {
            return regions;
        }
        
        const merged = [regions[0]];
        
        for (let i = 1; i < regions.length; i++) {
            const last = merged[merged.length - 1];
            const current = regions[i];
            
            // Check if adjacent or overlapping
            if (current.startSample <= last.endSample + 100) { // Allow small gaps
                // Merge
                last.endSample = Math.max(last.endSample, current.endSample);
                last.endTime = last.endSample / this.originalBuffer.sampleRate;
                last.duration = (last.endSample - last.startSample) / this.originalBuffer.sampleRate;
            } else {
                merged.push(current);
            }
        }
        
        return merged;
    }
    
    /**
     * Snap region boundaries to zero crossings
     */
    snapToZeroCrossings(regions, audioData, settings) {
        for (const region of regions) {
            // Find nearest zero crossing for start
            region.startSample = this.findNearestZeroCrossing(audioData, region.startSample);
            region.startTime = region.startSample / this.originalBuffer.sampleRate;
            
            // Find nearest zero crossing for end
            region.endSample = this.findNearestZeroCrossing(audioData, region.endSample);
            region.endTime = region.endSample / this.originalBuffer.sampleRate;
            
            // Update duration
            region.duration = (region.endSample - region.startSample) / this.originalBuffer.sampleRate;
        }
        
        return regions;
    }
    
    /**
     * Find nearest zero crossing
     */
    findNearestZeroCrossing(audioData, position) {
        const searchRange = 100;
        let bestPosition = position;
        let minMagnitude = Infinity;
        
        for (let i = Math.max(0, position - searchRange); i <= Math.min(audioData.length - 1, position + searchRange); i++) {
            if (i > 0 && audioData[i] * audioData[i - 1] <= 0) {
                const mag = Math.abs(audioData[i]);
                if (mag < minMagnitude) {
                    minMagnitude = mag;
                    bestPosition = i;
                }
            }
        }
        
        return bestPosition;
    }
    
    /**
     * Extract a region as a separate audio buffer
     */
    extractRegion(audioBuffer, region, settings) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = region.endSample - region.startSample;
        const fadeSamples = Math.floor(settings.fadeLength * sampleRate);
        
        const regionBuffer = this.audioContext.createBuffer(numChannels, length, sampleRate);
        
        for (let channel = 0; channel < numChannels; channel++) {
            const sourceData = audioBuffer.getChannelData(channel);
            const destData = regionBuffer.getChannelData(channel);
            
            for (let i = 0; i < length; i++) {
                let sample = sourceData[region.startSample + i];
                
                // Apply fade in
                if (i < fadeSamples) {
                    sample *= i / fadeSamples;
                }
                
                // Apply fade out
                if (i >= length - fadeSamples) {
                    sample *= (length - i) / fadeSamples;
                }
                
                destData[i] = sample;
            }
        }
        
        return regionBuffer;
    }
    
    /**
     * Export regions as files
     */
    exportRegions() {
        return this.regions.map((region, i) => ({
            name: `region_${i + 1}`,
            duration: region.duration,
            buffer: region.buffer,
            wav: this.bufferToWav(region.buffer)
        }));
    }
    
    /**
     * Convert buffer to WAV
     */
    bufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataLength = buffer.length * blockAlign;
        const bufferLength = 44 + dataLength;
        
        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, bufferLength - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);
        
        // Write audio data
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }
        
        return {
            buffer: arrayBuffer,
            blob: new Blob([arrayBuffer], { type: 'audio/wav' }),
            url: URL.createObjectURL(new Blob([arrayBuffer], { type: 'audio/wav' }))
        };
    }
    
    /**
     * Create UI panel
     */
    createUI() {
        const panel = document.createElement('div');
        panel.id = 'dynamic-splitter-panel';
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
            <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">Dynamic Splitter</h2>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Split Mode</div>
                <div style="display: flex; gap: 12px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                        <input type="radio" name="split-mode" value="silence" ${this.settings.mode === 'silence' ? 'checked' : ''} style="accent-color: #10b981;">
                        Silence
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                        <input type="radio" name="split-mode" value="transient" ${this.settings.mode === 'transient' ? 'checked' : ''} style="accent-color: #10b981;">
                        Transient
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                        <input type="radio" name="split-mode" value="both" ${this.settings.mode === 'both' ? 'checked' : ''} style="accent-color: #10b981;">
                        Both
                    </label>
                </div>
            </div>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Settings</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="font-size: 11px; color: #666;">Silence Threshold (dB)</label>
                        <input type="number" id="ds-silence-threshold" value="${this.settings.silenceThreshold}" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Min Silence (s)</label>
                        <input type="number" id="ds-min-silence" value="${this.settings.minSilenceDuration}" step="0.1" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Min Region (s)</label>
                        <input type="number" id="ds-min-region" value="${this.settings.minRegionDuration}" step="0.05" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Fade Length (ms)</label>
                        <input type="number" id="ds-fade" value="${this.settings.fadeLength * 1000}" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px; margin-top: 4px;">
                    </div>
                </div>
            </div>
            
            <div id="ds-regions" style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px; max-height: 200px; overflow-y: auto;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Regions: <span id="region-count">0</span></div>
                <div id="regions-list"></div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="ds-load-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Load Audio
                </button>
                <button id="ds-split-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Split
                </button>
                <button id="ds-export-btn" style="flex: 1; padding: 12px; background: #8b5cf6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Export All
                </button>
                <button id="ds-close-btn" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupUIEvents(panel);
        
        return panel;
    }
    
    setupUIEvents(panel) {
        // Mode selection
        panel.querySelectorAll('input[name="split-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.settings.mode = e.target.value;
            });
        });
        
        // Settings
        panel.querySelector('#ds-silence-threshold').addEventListener('change', (e) => {
            this.settings.silenceThreshold = parseFloat(e.target.value);
        });
        
        panel.querySelector('#ds-min-silence').addEventListener('change', (e) => {
            this.settings.minSilenceDuration = parseFloat(e.target.value);
        });
        
        panel.querySelector('#ds-min-region').addEventListener('change', (e) => {
            this.settings.minRegionDuration = parseFloat(e.target.value);
        });
        
        panel.querySelector('#ds-fade').addEventListener('change', (e) => {
            this.settings.fadeLength = parseFloat(e.target.value) / 1000;
        });
        
        // Buttons
        panel.querySelector('#ds-load-btn').addEventListener('click', () => {
            this.loadFromUI();
        });
        
        panel.querySelector('#ds-split-btn').addEventListener('click', () => {
            this.splitFromUI();
        });
        
        panel.querySelector('#ds-export-btn').addEventListener('click', () => {
            this.exportFromUI();
        });
        
        panel.querySelector('#ds-close-btn').addEventListener('click', () => {
            panel.remove();
        });
    }
    
    async loadFromUI() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.loadBuffer(audioBuffer);
            alert(`Loaded: ${file.name}`);
        };
        
        input.click();
    }
    
    splitFromUI() {
        if (!this.originalBuffer) {
            alert('Load audio first');
            return;
        }
        
        this.split();
        this.updateRegionsDisplay();
    }
    
    updateRegionsDisplay() {
        const countSpan = document.querySelector('#region-count');
        const listDiv = document.querySelector('#regions-list');
        
        if (countSpan) countSpan.textContent = this.regions.length;
        
        if (listDiv) {
            listDiv.innerHTML = this.regions.map((r, i) => `
                <div style="padding: 8px; background: #1a1a2e; border-radius: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <span>Region ${i + 1}</span>
                    <span style="color: #666;">${r.duration.toFixed(2)}s</span>
                    <span style="color: #888; font-size: 11px;">${r.splitReason}</span>
                </div>
            `).join('');
        }
    }
    
    exportFromUI() {
        if (this.regions.length === 0) {
            alert('Split audio first');
            return;
        }
        
        const exports = this.exportRegions();
        exports.forEach(exp => {
            const a = document.createElement('a');
            a.href = exp.wav.url;
            a.download = `${exp.name}.wav`;
            a.click();
        });
    }
}

// Export singleton
let dynamicSplitterInstance = null;

export function getDynamicSplitter(options = {}) {
    if (!dynamicSplitterInstance) {
        dynamicSplitterInstance = new DynamicSplitter(options);
    }
    return dynamicSplitterInstance;
}

export function openDynamicSplitterPanel() {
    const splitter = getDynamicSplitter();
    return splitter.createUI();
}