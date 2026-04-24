/**
 * Sample Slicer - Automatic slicing of samples by transients
 * Detects transients in audio and creates slices for beat-making
 */

export class SampleSlicer {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = this.audioContext?.sampleRate || 44100;
        
        // Slicing settings
        this.settings = {
            threshold: options.threshold || 0.3, // Transient threshold (0-1)
            sensitivity: options.sensitivity || 0.5, // Detection sensitivity
            minSliceLength: options.minSliceLength || 0.05, // Minimum slice duration (seconds)
            fadeLength: options.fadeLength || 0.005, // Fade in/out per slice (seconds)
            zeroCrossing: options.zeroCrossing || true, // Snap to zero crossings
            gridSize: options.gridSize || 0, // Grid size for quantization (0 = free)
            maxSlices: options.maxSlices || 128,
            autoPreview: options.autoPreview || false
        };
        
        // Analysis results
        this.transients = [];
        this.slices = [];
        this.originalBuffer = null;
        
        // Playback state
        this.isPlaying = false;
        this.currentSlice = -1;
        this.playbackSource = null;
    }
    
    /**
     * Load an audio buffer for slicing
     */
    loadBuffer(audioBuffer) {
        this.originalBuffer = audioBuffer;
        this.transients = [];
        this.slices = [];
        
        console.log(`[SampleSlicer] Loaded buffer: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz, ${audioBuffer.numberOfChannels}ch`);
    }
    
    /**
     * Analyze audio and detect transients
     */
    analyze(options = {}) {
        if (!this.originalBuffer) {
            throw new Error('No audio buffer loaded');
        }
        
        const settings = { ...this.settings, ...options };
        const audioBuffer = this.originalBuffer;
        
        // Get mono data for analysis
        const monoData = this.getMonoData(audioBuffer);
        
        // Detect transients using onset detection
        this.transients = this.detectTransients(monoData, audioBuffer.sampleRate, settings);
        
        console.log(`[SampleSlicer] Detected ${this.transients.length} transients`);
        
        return this.transients;
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
     * Detect transients using spectral flux
     */
    detectTransients(audioData, sampleRate, settings) {
        const transients = [];
        
        // Use spectral flux for onset detection
        const fftSize = 2048;
        const hopSize = 512;
        const numFrames = Math.floor((audioData.length - fftSize) / hopSize);
        
        // Calculate spectral flux
        const spectralFlux = this.calculateSpectralFlux(audioData, fftSize, hopSize, numFrames);
        
        // Find peaks in spectral flux
        const threshold = settings.threshold;
        const minPeakDistance = Math.floor(settings.minSliceLength * sampleRate / hopSize);
        
        let lastPeakFrame = -minPeakDistance;
        
        for (let i = 1; i < spectralFlux.length - 1; i++) {
            const flux = spectralFlux[i];
            
            // Check if this is a local maximum
            if (flux > spectralFlux[i - 1] && flux > spectralFlux[i + 1]) {
                // Check threshold
                const localThreshold = this.calculateLocalThreshold(spectralFlux, i, 10) * threshold;
                
                if (flux > localThreshold && i - lastPeakFrame >= minPeakDistance) {
                    const samplePosition = i * hopSize;
                    const time = samplePosition / sampleRate;
                    
                    // Find zero crossing if enabled
                    let finalPosition = samplePosition;
                    if (settings.zeroCrossing) {
                        finalPosition = this.findNearestZeroCrossing(audioData, samplePosition);
                    }
                    
                    transients.push({
                        frame: i,
                        samplePosition: finalPosition,
                        time: finalPosition / sampleRate,
                        strength: flux,
                        type: 'onset'
                    });
                    
                    lastPeakFrame = i;
                }
            }
        }
        
        // Limit max slices
        if (transients.length > settings.maxSlices) {
            // Keep strongest transients
            transients.sort((a, b) => b.strength - a.strength);
            transients.length = settings.maxSlices;
            transients.sort((a, b) => a.samplePosition - b.samplePosition);
        }
        
        // Apply grid quantization if specified
        if (settings.gridSize > 0) {
            this.quantizeToGrid(transients, settings.gridSize, sampleRate);
        }
        
        return transients;
    }
    
    /**
     * Calculate spectral flux for onset detection
     */
    calculateSpectralFlux(audioData, fftSize, hopSize, numFrames) {
        const flux = new Float32Array(numFrames);
        let prevSpectrum = null;
        
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * hopSize;
            
            // Get frame data with window
            const frameData = new Float32Array(fftSize);
            for (let i = 0; i < fftSize; i++) {
                const sampleIndex = startSample + i;
                if (sampleIndex < audioData.length) {
                    // Hanning window
                    const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize));
                    frameData[i] = audioData[sampleIndex] * window;
                }
            }
            
            // Simple FFT approximation (would use actual FFT in production)
            const spectrum = this.computeSpectrum(frameData);
            
            // Calculate flux (positive differences only)
            if (prevSpectrum) {
                let frameFlux = 0;
                for (let i = 0; i < spectrum.length; i++) {
                    const diff = spectrum[i] - prevSpectrum[i];
                    if (diff > 0) {
                        frameFlux += diff * diff;
                    }
                }
                flux[frame] = Math.sqrt(frameFlux);
            }
            
            prevSpectrum = spectrum;
        }
        
        return flux;
    }
    
    /**
     * Compute magnitude spectrum (simplified)
     */
    computeSpectrum(frameData) {
        const N = frameData.length;
        const spectrum = new Float32Array(N / 2);
        
        // Simplified DFT for magnitude (would use FFT in production)
        for (let k = 0; k < N / 2; k++) {
            let real = 0;
            let imag = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = 2 * Math.PI * k * n / N;
                real += frameData[n] * Math.cos(angle);
                imag -= frameData[n] * Math.sin(angle);
            }
            
            spectrum[k] = Math.sqrt(real * real + imag * imag);
        }
        
        return spectrum;
    }
    
    /**
     * Calculate local threshold using median
     */
    calculateLocalThreshold(flux, index, windowSize) {
        const start = Math.max(0, index - windowSize);
        const end = Math.min(flux.length, index + windowSize);
        
        const values = [];
        for (let i = start; i < end; i++) {
            values.push(flux[i]);
        }
        
        values.sort((a, b) => a - b);
        return values[Math.floor(values.length / 2)];
    }
    
    /**
     * Find nearest zero crossing
     */
    findNearestZeroCrossing(audioData, position) {
        const searchRange = 100; // samples to search
        let bestPosition = position;
        let minMagnitude = Infinity;
        
        for (let i = position - searchRange; i <= position + searchRange; i++) {
            if (i > 0 && i < audioData.length - 1) {
                // Check for sign change or low magnitude
                if (audioData[i] * audioData[i + 1] <= 0) {
                    if (Math.abs(audioData[i]) < minMagnitude) {
                        minMagnitude = Math.abs(audioData[i]);
                        bestPosition = i;
                    }
                }
            }
        }
        
        return bestPosition;
    }
    
    /**
     * Quantize transients to grid
     */
    quantizeToGrid(transients, gridSize, sampleRate) {
        const gridSamples = gridSize * sampleRate;
        
        for (const transient of transients) {
            const gridPosition = Math.round(transient.samplePosition / gridSamples) * gridSamples;
            transient.samplePosition = gridPosition;
            transient.time = gridPosition / sampleRate;
            transient.quantized = true;
        }
    }
    
    /**
     * Create slices from transients
     */
    createSlices(options = {}) {
        if (this.transients.length === 0) {
            // Auto-analyze if not done
            this.analyze(options);
        }
        
        const settings = { ...this.settings, ...options };
        const sampleRate = this.originalBuffer.sampleRate;
        const totalSamples = this.originalBuffer.length;
        
        this.slices = [];
        
        // Add slice at start if first transient isn't at beginning
        if (this.transients.length === 0 || this.transients[0].samplePosition > 0) {
            this.transients.unshift({
                samplePosition: 0,
                time: 0,
                strength: 1,
                type: 'start'
            });
        }
        
        // Create slices between transients
        for (let i = 0; i < this.transients.length; i++) {
            const startSample = this.transients[i].samplePosition;
            const endSample = i < this.transients.length - 1 
                ? this.transients[i + 1].samplePosition 
                : totalSamples;
            
            if (endSample - startSample >= settings.minSliceLength * sampleRate) {
                const sliceBuffer = this.extractSlice(
                    startSample,
                    endSample,
                    settings.fadeLength
                );
                
                this.slices.push({
                    id: i,
                    startSample,
                    endSample,
                    startTime: startSample / sampleRate,
                    endTime: endSample / sampleRate,
                    duration: (endSample - startSample) / sampleRate,
                    buffer: sliceBuffer,
                    transient: this.transients[i],
                    name: `Slice ${i + 1}`
                });
            }
        }
        
        console.log(`[SampleSlicer] Created ${this.slices.length} slices`);
        
        return this.slices;
    }
    
    /**
     * Extract a slice from the original buffer
     */
    extractSlice(startSample, endSample, fadeLength) {
        const numChannels = this.originalBuffer.numberOfChannels;
        const sampleRate = this.originalBuffer.sampleRate;
        const length = endSample - startSample;
        const fadeSamples = Math.floor(fadeLength * sampleRate);
        
        const sliceBuffer = this.audioContext.createBuffer(
            numChannels,
            length,
            sampleRate
        );
        
        for (let channel = 0; channel < numChannels; channel++) {
            const sourceData = this.originalBuffer.getChannelData(channel);
            const destData = sliceBuffer.getChannelData(channel);
            
            for (let i = 0; i < length; i++) {
                const sourceIndex = startSample + i;
                let sample = sourceData[sourceIndex];
                
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
        
        return sliceBuffer;
    }
    
    /**
     * Play a specific slice
     */
    playSlice(sliceIndex, options = {}) {
        if (sliceIndex < 0 || sliceIndex >= this.slices.length) {
            return;
        }
        
        const slice = this.slices[sliceIndex];
        const { loop = false, playbackRate = 1, detune = 0, volume = 1 } = options;
        
        // Stop current playback
        this.stopPlayback();
        
        // Create source
        const source = this.audioContext.createBufferSource();
        source.buffer = slice.buffer;
        source.playbackRate.value = playbackRate;
        source.detune.value = detune;
        source.loop = loop;
        
        // Create gain node
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume;
        
        // Connect
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Start playback
        source.start();
        
        this.playbackSource = source;
        this.currentSlice = sliceIndex;
        this.isPlaying = true;
        
        source.onended = () => {
            this.isPlaying = false;
            this.currentSlice = -1;
        };
        
        console.log(`[SampleSlicer] Playing slice ${sliceIndex + 1}`);
    }
    
    /**
     * Stop playback
     */
    stopPlayback() {
        if (this.playbackSource) {
            try {
                this.playbackSource.stop();
            } catch (e) {
                // Already stopped
            }
            this.playbackSource = null;
        }
        
        this.isPlaying = false;
        this.currentSlice = -1;
    }
    
    /**
     * Export slices as separate files
     */
    exportSlices() {
        const exports = [];
        
        for (const slice of this.slices) {
            exports.push({
                name: slice.name,
                duration: slice.duration,
                buffer: slice.buffer,
                wav: this.bufferToWav(slice.buffer)
            });
        }
        
        return exports;
    }
    
    /**
     * Convert buffer to WAV format
     */
    bufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        
        const dataLength = buffer.length * blockAlign;
        const bufferLength = 44 + dataLength;
        
        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);
        
        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, bufferLength - 8, true);
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
    
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    /**
     * Create UI panel for sample slicing
     */
    createUI() {
        const panel = document.createElement('div');
        panel.id = 'sample-slicer-panel';
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
            min-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        panel.innerHTML = `
            <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">Sample Slicer</h2>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Settings</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="font-size: 11px; color: #666;">Threshold</label>
                        <input type="range" id="slicer-threshold" min="0.1" max="1" step="0.05" value="${this.settings.threshold}" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Min Slice Length (s)</label>
                        <input type="number" id="slicer-min-length" value="${this.settings.minSliceLength}" step="0.01" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Fade Length (ms)</label>
                        <input type="number" id="slicer-fade" value="${this.settings.fadeLength * 1000}" step="1" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #666;">Grid Size (s, 0=free)</label>
                        <input type="number" id="slicer-grid" value="${this.settings.gridSize}" step="0.1" style="width: 100%; padding: 6px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                    </div>
                </div>
                <div style="margin-top: 12px;">
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                        <input type="checkbox" id="slicer-zero-crossing" ${this.settings.zeroCrossing ? 'checked' : ''} style="accent-color: #10b981;">
                        Snap to zero crossings
                    </label>
                </div>
            </div>
            
            <div style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Waveform</div>
                <canvas id="slicer-waveform" width="560" height="100" style="width: 100%; background: #1a1a2e; border-radius: 4px;"></canvas>
                <canvas id="slicer-transient-markers" width="560" height="20" style="width: 100%; margin-top: 4px;"></canvas>
            </div>
            
            <div id="slicer-slices" style="background: #0a0a14; border-radius: 4px; padding: 12px; margin-bottom: 16px; max-height: 200px; overflow-y: auto;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Slices: <span id="slice-count">0</span></div>
                <div id="slices-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 8px;"></div>
            </div>
            
            <div style="display: flex; gap: 12px;">
                <button id="load-sample-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Load Sample
                </button>
                <button id="analyze-btn" style="flex: 1; padding: 12px; background: #f59e0b; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Analyze
                </button>
                <button id="create-slices-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Create Slices
                </button>
                <button id="export-slices-btn" style="flex: 1; padding: 12px; background: #8b5cf6; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Export All
                </button>
                <button id="close-slicer-panel" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupUIEvents(panel);
        
        return panel;
    }
    
    setupUIEvents(panel) {
        // Settings
        panel.querySelector('#slicer-threshold').addEventListener('input', (e) => {
            this.settings.threshold = parseFloat(e.target.value);
        });
        
        panel.querySelector('#slicer-min-length').addEventListener('change', (e) => {
            this.settings.minSliceLength = parseFloat(e.target.value);
        });
        
        panel.querySelector('#slicer-fade').addEventListener('change', (e) => {
            this.settings.fadeLength = parseFloat(e.target.value) / 1000;
        });
        
        panel.querySelector('#slicer-grid').addEventListener('change', (e) => {
            this.settings.gridSize = parseFloat(e.target.value);
        });
        
        panel.querySelector('#slicer-zero-crossing').addEventListener('change', (e) => {
            this.settings.zeroCrossing = e.target.checked;
        });
        
        // Buttons
        panel.querySelector('#load-sample-btn').addEventListener('click', () => {
            this.loadSampleFromUI();
        });
        
        panel.querySelector('#analyze-btn').addEventListener('click', () => {
            this.analyzeFromUI();
        });
        
        panel.querySelector('#create-slices-btn').addEventListener('click', () => {
            this.createSlicesFromUI();
        });
        
        panel.querySelector('#export-slices-btn').addEventListener('click', () => {
            this.exportFromUI();
        });
        
        panel.querySelector('#close-slicer-panel').addEventListener('click', () => {
            this.stopPlayback();
            panel.remove();
        });
    }
    
    loadSampleFromUI() {
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.loadBuffer(audioBuffer);
            this.drawWaveform();
        };
        
        input.click();
    }
    
    analyzeFromUI() {
        if (!this.originalBuffer) {
            alert('Load a sample first');
            return;
        }
        
        this.analyze();
        this.drawTransientMarkers();
    }
    
    createSlicesFromUI() {
        if (!this.originalBuffer) {
            alert('Load a sample first');
            return;
        }
        
        this.createSlices();
        this.updateSlicesDisplay();
    }
    
    drawWaveform() {
        const canvas = document.querySelector('#slicer-waveform');
        if (!canvas || !this.originalBuffer) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        const monoData = this.getMonoData(this.originalBuffer);
        const samplesPerPixel = Math.floor(monoData.length / width);
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let x = 0; x < width; x++) {
            const startSample = x * samplesPerPixel;
            let min = 0;
            let max = 0;
            
            for (let i = 0; i < samplesPerPixel; i++) {
                const sample = monoData[startSample + i] || 0;
                min = Math.min(min, sample);
                max = Math.max(max, sample);
            }
            
            const yMin = (1 - max) * height / 2;
            const yMax = (1 - min) * height / 2;
            
            ctx.moveTo(x, yMin);
            ctx.lineTo(x, yMax);
        }
        
        ctx.stroke();
    }
    
    drawTransientMarkers() {
        const canvas = document.querySelector('#slicer-transient-markers');
        if (!canvas || this.transients.length === 0) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const duration = this.originalBuffer.duration;
        
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#f59e0b';
        for (const transient of this.transients) {
            const x = (transient.time / duration) * width;
            ctx.fillRect(x - 1, 0, 2, height);
        }
    }
    
    updateSlicesDisplay() {
        const countSpan = document.querySelector('#slice-count');
        const grid = document.querySelector('#slices-grid');
        
        if (countSpan) {
            countSpan.textContent = this.slices.length;
        }
        
        if (grid) {
            grid.innerHTML = this.slices.map((slice, i) => `
                <button class="slice-btn" data-index="${i}" style="
                    padding: 8px;
                    background: #2a2a4e;
                    border: 1px solid #3a3a5e;
                    border-radius: 4px;
                    color: white;
                    cursor: pointer;
                    font-size: 11px;
                ">
                    ${i + 1}<br>
                    <span style="color: #666;">${slice.duration.toFixed(2)}s</span>
                </button>
            `).join('');
            
            // Add click handlers
            grid.querySelectorAll('.slice-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.dataset.index);
                    this.playSlice(index);
                });
            });
        }
    }
    
    exportFromUI() {
        if (this.slices.length === 0) {
            alert('Create slices first');
            return;
        }
        
        const exports = this.exportSlices();
        
        // Download each slice
        exports.forEach((exp, i) => {
            const a = document.createElement('a');
            a.href = exp.wav.url;
            a.download = `slice_${i + 1}.wav`;
            a.click();
        });
    }
}

// Export singleton instance
let sampleSlicerInstance = null;

export function getSampleSlicer(options = {}) {
    if (!sampleSlicerInstance) {
        sampleSlicerInstance = new SampleSlicer(options);
    }
    return sampleSlicerInstance;
}

export function openSampleSlicerPanel() {
    const slicer = getSampleSlicer();
    return slicer.createUI();
}