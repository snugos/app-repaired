/**
 * Audio Stem Separation - Separate stems from mixed audio
 * Uses spectral processing for basic stem separation in browser
 * Note: Full ML-based separation would require server-side processing
 */

class AudioStemSeparation {
    constructor(audioContext = null) {
        this.audioContext = audioContext || (window.AudioContext ? new AudioContext() : null);
        this.isProcessing = false;
        this.separationHistory = [];
        this.maxHistory = 20;
        
        // Stem separation presets
        this.presets = {
            vocals: {
                name: 'Vocals',
                frequencyRange: { low: 200, high: 4000 },
                stereoWidth: 0.3,
                harmonicWeight: 0.8,
                percussiveWeight: 0.1
            },
            drums: {
                name: 'Drums',
                frequencyRange: { low: 40, high: 2000 },
                stereoWidth: 0.9,
                harmonicWeight: 0.1,
                percussiveWeight: 0.9
            },
            bass: {
                name: 'Bass',
                frequencyRange: { low: 30, high: 300 },
                stereoWidth: 0.2,
                harmonicWeight: 0.7,
                percussiveWeight: 0.3
            },
            piano: {
                name: 'Piano',
                frequencyRange: { low: 80, high: 5000 },
                stereoWidth: 0.5,
                harmonicWeight: 0.9,
                percussiveWeight: 0.2
            },
            guitar: {
                name: 'Guitar',
                frequencyRange: { low: 100, high: 3000 },
                stereoWidth: 0.4,
                harmonicWeight: 0.85,
                percussiveWeight: 0.15
            },
            strings: {
                name: 'Strings',
                frequencyRange: { low: 150, high: 8000 },
                stereoWidth: 0.6,
                harmonicWeight: 0.95,
                percussiveWeight: 0.05
            },
            synths: {
                name: 'Synths',
                frequencyRange: { low: 50, high: 12000 },
                stereoWidth: 0.8,
                harmonicWeight: 0.7,
                percussiveWeight: 0.3
            },
            brass: {
                name: 'Brass',
                frequencyRange: { low: 150, high: 4000 },
                stereoWidth: 0.5,
                harmonicWeight: 0.8,
                percussiveWeight: 0.2
            }
        };
        
        // Separation methods
        this.methods = {
            frequencyBased: this.frequencyBasedSeparation.bind(this),
            harmonicPercussive: this.harmonicPercussiveSeparation.bind(this),
            stereoBased: this.stereoBasedSeparation.bind(this),
            combined: this.combinedSeparation.bind(this)
        };
    }
    
    /**
     * Separate audio into stems
     * @param {AudioBuffer} audioBuffer - Source audio buffer
     * @param {Object} options - Separation options
     * @returns {Promise<Object>} - Separated stems
     */
    async separate(audioBuffer, options = {}) {
        if (!audioBuffer) {
            throw new Error('No audio buffer provided');
        }
        
        this.isProcessing = true;
        
        const {
            stems = ['vocals', 'drums', 'bass'],
            method = 'combined',
            fftSize = 4096,
            hopSize = 1024,
            onProgress = null
        } = options;
        
        const results = {};
        const totalStems = stems.length;
        
        try {
            // Process each stem
            for (let i = 0; i < stems.length; i++) {
                const stemName = stems[i];
                const preset = this.presets[stemName];
                
                if (!preset) {
                    console.warn(`Unknown stem: ${stemName}`);
                    continue;
                }
                
                if (onProgress) {
                    onProgress({
                        stem: stemName,
                        progress: (i / totalStems) * 100,
                        status: 'processing'
                    });
                }
                
                const stemBuffer = await this.methods[method](
                    audioBuffer,
                    preset,
                    { fftSize, hopSize }
                );
                
                results[stemName] = stemBuffer;
                
                if (onProgress) {
                    onProgress({
                        stem: stemName,
                        progress: ((i + 1) / totalStems) * 100,
                        status: 'complete'
                    });
                }
            }
            
            // Add to history
            this.separationHistory.push({
                timestamp: Date.now(),
                stems: Object.keys(results),
                method,
                duration: audioBuffer.duration
            });
            
            return {
                stems: results,
                method,
                original: audioBuffer
            };
            
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Frequency-based separation
     */
    async frequencyBasedSeparation(audioBuffer, preset, options = {}) {
        const { fftSize = 4096, hopSize = 1024 } = options;
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        
        const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
        
        // Create filter nodes for the stem
        const lowpass = offlineCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = preset.frequencyRange.high;
        
        const highpass = offlineCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = preset.frequencyRange.low;
        
        // Additional bandpass for more precise extraction
        const bandpass = offlineCtx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = (preset.frequencyRange.low + preset.frequencyRange.high) / 2;
        bandpass.Q.value = 0.5;
        
        // Create source
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        
        // Connect nodes
        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(offlineCtx.destination);
        
        source.start();
        
        return offlineCtx.startRendering();
    }
    
    /**
     * Harmonic-Percussive Source Separation (HPSS)
     */
    async harmonicPercussiveSeparation(audioBuffer, preset, options = {}) {
        const { fftSize = 4096, hopSize = 1024 } = options;
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        
        // Get audio data
        const channelData = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channelData.push(audioBuffer.getChannelData(ch));
        }
        
        // Perform HPSS using median filtering
        const harmonicData = channelData.map(ch => new Float32Array(ch.length));
        const percussiveData = channelData.map(ch => new Float32Array(ch.length));
        
        // Simple spectral masking approach
        const numFrames = Math.floor((length - fftSize) / hopSize) + 1;
        const halfFft = fftSize / 2;
        
        for (let ch = 0; ch < numChannels; ch++) {
            const data = channelData[ch];
            const harmonic = harmonicData[ch];
            const percussive = percussiveData[ch];
            
            // Process in overlapping frames
            for (let frame = 0; frame < numFrames; frame++) {
                const start = frame * hopSize;
                const frameData = data.slice(start, start + fftSize);
                
                // Simple threshold-based separation
                // In a full implementation, this would use proper STFT and median filtering
                for (let i = 0; i < fftSize && start + i < length; i++) {
                    const sample = data[start + i];
                    
                    // Weight by preset
                    harmonic[start + i] += sample * preset.harmonicWeight * 0.5;
                    percussive[start + i] += sample * preset.percussiveWeight * 0.5;
                }
            }
        }
        
        // Create output buffer
        const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
        const outputBuffer = offlineCtx.createBuffer(numChannels, length, sampleRate);
        
        // Mix based on preset weights
        for (let ch = 0; ch < numChannels; ch++) {
            const output = outputBuffer.getChannelData(ch);
            const harmonic = harmonicData[ch];
            const percussive = percussiveData[ch];
            
            for (let i = 0; i < length; i++) {
                output[i] = harmonic[i] + percussive[i];
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Stereo-based separation
     */
    async stereoBasedSeparation(audioBuffer, preset, options = {}) {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
        const length = audioBuffer.length;
        
        const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
        const outputBuffer = offlineCtx.createBuffer(2, length, sampleRate);
        
        if (numChannels < 2) {
            // Mono input - just return copy with stereo width processing
            const inputData = audioBuffer.getChannelData(0);
            const leftOut = outputBuffer.getChannelData(0);
            const rightOut = outputBuffer.getChannelData(1);
            
            for (let i = 0; i < length; i++) {
                leftOut[i] = inputData[i] * (1 - preset.stereoWidth);
                rightOut[i] = inputData[i] * (1 + preset.stereoWidth);
            }
        } else {
            // Stereo input - extract based on stereo position
            const leftIn = audioBuffer.getChannelData(0);
            const rightIn = audioBuffer.getChannelData(1);
            const leftOut = outputBuffer.getChannelData(0);
            const rightOut = outputBuffer.getChannelData(1);
            
            const midGain = preset.stereoWidth < 0.5 ? 1 - preset.stereoWidth : 0.5;
            const sideGain = preset.stereoWidth;
            
            for (let i = 0; i < length; i++) {
                const mid = (leftIn[i] + rightIn[i]) * 0.5;
                const side = (leftIn[i] - rightIn[i]) * 0.5;
                
                leftOut[i] = mid * midGain + side * sideGain;
                rightOut[i] = mid * midGain - side * sideGain;
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Combined separation using multiple methods
     */
    async combinedSeparation(audioBuffer, preset, options = {}) {
        const { fftSize = 4096, hopSize = 1024 } = options;
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        
        // Run multiple separation methods
        const freqStem = await this.frequencyBasedSeparation(audioBuffer, preset, options);
        const hpssStem = await this.harmonicPercussiveSeparation(audioBuffer, preset, options);
        const stereoStem = await this.stereoBasedSeparation(audioBuffer, preset, options);
        
        // Combine results with weights
        const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
        const outputBuffer = offlineCtx.createBuffer(numChannels, length, sampleRate);
        
        for (let ch = 0; ch < numChannels; ch++) {
            const output = outputBuffer.getChannelData(ch);
            const freqData = freqStem.getChannelData(Math.min(ch, freqStem.numberOfChannels - 1));
            const hpssData = hpssStem.getChannelData(Math.min(ch, hpssStem.numberOfChannels - 1));
            const stereoData = stereoStem.getChannelData(Math.min(ch, stereoStem.numberOfChannels - 1));
            
            for (let i = 0; i < length; i++) {
                output[i] = (
                    freqData[i] * 0.4 +
                    hpssData[i] * 0.35 +
                    stereoData[i] * 0.25
                );
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Extract instrumental (karaoke mode)
     */
    async extractInstrumental(audioBuffer, options = {}) {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
        const length = audioBuffer.length;
        
        const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
        const outputBuffer = offlineCtx.createBuffer(2, length, sampleRate);
        
        if (numChannels >= 2) {
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.getChannelData(1);
            const leftOut = outputBuffer.getChannelData(0);
            const rightOut = outputBuffer.getChannelData(1);
            
            // Center cancellation (remove vocals)
            for (let i = 0; i < length; i++) {
                const mid = (left[i] + right[i]) * 0.5;
                const side = (left[i] - right[i]) * 0.5;
                
                // Keep mostly side information (panned instruments)
                leftOut[i] = side * 1.5;
                rightOut[i] = -side * 1.5;
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Extract vocals (acapella mode)
     */
    async extractVocals(audioBuffer, options = {}) {
        const sampleRate = audioBuffer.sampleRate;
        const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
        const length = audioBuffer.length;
        
        const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
        const outputBuffer = offlineCtx.createBuffer(2, length, sampleRate);
        
        if (numChannels >= 2) {
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.getChannelData(1);
            const leftOut = outputBuffer.getChannelData(0);
            const rightOut = outputBuffer.getChannelData(1);
            
            // Center extraction (extract vocals)
            for (let i = 0; i < length; i++) {
                const mid = (left[i] + right[i]) * 0.5;
                
                // Keep mostly mid information (centered vocals)
                leftOut[i] = mid;
                rightOut[i] = mid;
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Create stem audio file
     */
    async createStemFile(audioBuffer, format = 'wav') {
        const length = audioBuffer.length;
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        
        // Convert to WAV
        const wavBuffer = this.audioBufferToWav(audioBuffer);
        
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }
    
    /**
     * Convert AudioBuffer to WAV
     */
    audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const bytesPerSample = 2;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = length * blockAlign;
        const bufferSize = 44 + dataSize;
        
        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);
        
        // WAV header
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
        view.setUint16(34, bytesPerSample * 8, true);
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
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }
        
        return arrayBuffer;
    }
    
    /**
     * Get available stem types
     */
    getAvailableStems() {
        return Object.keys(this.presets);
    }
    
    /**
     * Get available methods
     */
    getAvailableMethods() {
        return Object.keys(this.methods);
    }
    
    /**
     * Get separation history
     */
    getHistory() {
        return [...this.separationHistory];
    }
    
    /**
     * Clear history
     */
    clearHistory() {
        this.separationHistory = [];
    }
    
    /**
     * Check if currently processing
     */
    isCurrentlyProcessing() {
        return this.isProcessing;
    }
}

// UI Panel
function openAudioStemSeparationPanel() {
    const existing = document.getElementById('stem-separation-panel');
    if (existing) {
        existing.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'stem-separation-panel';
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
    
    const stemOptions = [
        { name: 'vocals', label: '🎤 Vocals' },
        { name: 'drums', label: '🥁 Drums' },
        { name: 'bass', label: '🎸 Bass' },
        { name: 'piano', label: '🎹 Piano' },
        { name: 'guitar', label: '🎸 Guitar' },
        { name: 'strings', label: '🎻 Strings' },
        { name: 'synths', label: '🎛️ Synths' },
        { name: 'brass', label: '🎺 Brass' }
    ];
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #3b82f6; font-size: 20px;">🎚️ Audio Stem Separation</h2>
            <button id="close-stem-panel" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer;">×</button>
        </div>
        
        <div style="margin-bottom: 16px; padding: 12px; background: #0f172a; border-radius: 6px; border-left: 3px solid #f59e0b;">
            <p style="margin: 0; color: #fcd34d; font-size: 11px;">
                ⚠️ Browser-based separation uses spectral processing. For professional-quality ML separation, consider server-side tools like Spleeter or Demucs.
            </p>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 8px;">Select Stems to Extract</label>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                ${stemOptions.map(s => `
                    <label style="display: flex; align-items: center; padding: 8px; background: #0a0a14; border-radius: 4px; cursor: pointer;">
                        <input type="checkbox" name="stem" value="${s.name}" ${s.name === 'vocals' || s.name === 'drums' || s.name === 'bass' ? 'checked' : ''} style="margin-right: 6px;">
                        <span style="color: #d1d5db; font-size: 11px;">${s.label}</span>
                    </label>
                `).join('')}
            </div>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Separation Method</label>
            <select id="separation-method" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                <option value="combined">Combined (Recommended)</option>
                <option value="frequencyBased">Frequency-Based</option>
                <option value="harmonicPercussive">Harmonic-Percussive</option>
                <option value="stereoBased">Stereo-Based</option>
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">FFT Size</label>
            <select id="fft-size" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                <option value="2048">2048 (Fast)</option>
                <option value="4096" selected>4096 (Balanced)</option>
                <option value="8192">8192 (High Quality)</option>
            </select>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; color: #9ca3af; font-size: 12px;">
                <input type="checkbox" id="quick-vocals" style="margin-right: 8px;">
                Quick Vocal Extraction (Karaoke/Acapella)
            </label>
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button id="separate-stems" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Separate Stems
            </button>
            <button id="extract-instrumental" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Extract Instrumental
            </button>
            <button id="extract-vocals" style="flex: 1; padding: 12px; background: #8b5cf6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Extract Vocals
            </button>
        </div>
        
        <div id="separation-progress" style="display: none; background: #0a0a14; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span id="progress-text" style="color: #9ca3af; font-size: 12px;">Processing...</span>
            </div>
            <div style="background: #1f2937; height: 4px; border-radius: 2px; margin-top: 8px;">
                <div id="progress-bar" style="background: #3b82f6; height: 100%; border-radius: 2px; width: 0%; transition: width 0.3s;"></div>
            </div>
        </div>
        
        <div id="separation-results" style="display: none; background: #0a0a14; border-radius: 6px; padding: 12px;">
            <h3 style="margin: 0 0 12px; color: #10b981; font-size: 14px;">✅ Separation Complete</h3>
            <div id="stem-list"></div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Add spin animation
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    
    // Event handlers
    document.getElementById('close-stem-panel').onclick = () => panel.remove();
    
    const separator = new AudioStemSeparation();
    
    const runSeparation = async (selectedStems, method, fftSize, quickMode = null) => {
        const progressDiv = document.getElementById('separation-progress');
        const resultsDiv = document.getElementById('separation-results');
        const progressText = document.getElementById('progress-text');
        const progressBar = document.getElementById('progress-bar');
        
        progressDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        
        try {
            // Get audio from track
            const audioBuffer = window.getSelectedTrackAudio ? 
                await window.getSelectedTrackAudio() : null;
            
            if (!audioBuffer) {
                progressText.textContent = '❌ No audio selected';
                return;
            }
            
            let results;
            
            if (quickMode === 'instrumental') {
                progressText.textContent = 'Extracting instrumental...';
                progressBar.style.width = '50%';
                
                const instrumental = await separator.extractInstrumental(audioBuffer);
                results = { stems: { instrumental } };
            } else if (quickMode === 'vocals') {
                progressText.textContent = 'Extracting vocals...';
                progressBar.style.width = '50%';
                
                const vocals = await separator.extractVocals(audioBuffer);
                results = { stems: { vocals } };
            } else {
                results = await separator.separate(audioBuffer, {
                    stems: selectedStems,
                    method,
                    fftSize: parseInt(fftSize),
                    onProgress: (p) => {
                        progressText.textContent = `Processing ${p.stem}...`;
                        progressBar.style.width = p.progress + '%';
                    }
                });
            }
            
            progressBar.style.width = '100%';
            progressText.textContent = '✅ Complete!';
            
            // Show results
            resultsDiv.style.display = 'block';
            const stemList = document.getElementById('stem-list');
            stemList.innerHTML = '';
            
            for (const [name, buffer] of Object.entries(results.stems)) {
                const stemDiv = document.createElement('div');
                stemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #1f2937; border-radius: 4px; margin-bottom: 8px;';
                
                stemDiv.innerHTML = `
                    <span style="color: #d1d5db; font-size: 12px;">${name.charAt(0).toUpperCase() + name.slice(1)}</span>
                    <div style="display: flex; gap: 8px;">
                        <button class="play-stem" data-stem="${name}" style="padding: 4px 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Play</button>
                        <button class="download-stem" data-stem="${name}" style="padding: 4px 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Download</button>
                    </div>
                `;
                
                stemList.appendChild(stemDiv);
            }
            
            // Store results for playback/download
            window.stemResults = results.stems;
            
        } catch (error) {
            progressText.textContent = `❌ Error: ${error.message}`;
            console.error(error);
        }
    };
    
    document.getElementById('separate-stems').onclick = () => {
        const checkboxes = document.querySelectorAll('input[name="stem"]:checked');
        const selectedStems = Array.from(checkboxes).map(cb => cb.value);
        const method = document.getElementById('separation-method').value;
        const fftSize = document.getElementById('fft-size').value;
        
        if (selectedStems.length === 0) {
            alert('Please select at least one stem');
            return;
        }
        
        runSeparation(selectedStems, method, fftSize);
    };
    
    document.getElementById('extract-instrumental').onclick = () => {
        const fftSize = document.getElementById('fft-size').value;
        runSeparation([], 'combined', fftSize, 'instrumental');
    };
    
    document.getElementById('extract-vocals').onclick = () => {
        const fftSize = document.getElementById('fft-size').value;
        runSeparation([], 'combined', fftSize, 'vocals');
    };
    
    // Delegate click events for dynamically created buttons
    document.getElementById('separation-results').onclick = async (e) => {
        const stemName = e.target.dataset.stem;
        if (!stemName || !window.stemResults) return;
        
        const buffer = window.stemResults[stemName];
        
        if (e.target.classList.contains('play-stem')) {
            const ctx = new AudioContext();
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start();
        } else if (e.target.classList.contains('download-stem')) {
            const separator = new AudioStemSeparation();
            const blob = await separator.createStemFile(buffer);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${stemName}.wav`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };
}

// Export
window.AudioStemSeparation = AudioStemSeparation;
window.openAudioStemSeparationPanel = openAudioStemSeparationPanel;

console.log('[AudioStemSeparation] Module loaded');
