/**
 * Sample Rate Converter - Convert sample rates on import
 * 
 * Features:
 * - Automatic sample rate detection
 * - High-quality resampling algorithms
 * - Batch conversion
 * - Preview before/after
 */

export class SampleRateConverter {
    constructor(options = {}) {
        this.options = {
            targetSampleRate: options.targetSampleRate || 44100,
            quality: options.quality || 'high', // 'low', 'medium', 'high'
            ...options
        };
        
        // Resampling kernel
        this.kernel = null;
        this.kernelSize = 64;
        
        console.log('[SampleRateConverter] Initialized');
    }
    
    /**
     * Convert audio buffer to target sample rate
     */
    convert(audioBuffer, targetSampleRate = null) {
        const sourceRate = audioBuffer.sampleRate;
        const targetRate = targetSampleRate || this.options.targetSampleRate;
        
        if (sourceRate === targetRate) {
            console.log('[SampleRateConverter] Already at target rate');
            return audioBuffer;
        }
        
        const ratio = sourceRate / targetRate;
        const numChannels = audioBuffer.numberOfChannels;
        const sourceLength = audioBuffer.length;
        const targetLength = Math.floor(sourceLength / ratio);
        
        console.log(`[SampleRateConverter] Converting ${sourceRate}Hz -> ${targetRate}Hz (${sourceLength} -> ${targetLength} samples)`);
        
        // Create offline context for output
        const offlineCtx = new OfflineAudioContext(
            numChannels,
            targetLength,
            targetRate
        );
        
        // Resample each channel
        const outputBuffer = offlineCtx.createBuffer(numChannels, targetLength, targetRate);
        
        for (let channel = 0; channel < numChannels; channel++) {
            const sourceData = audioBuffer.getChannelData(channel);
            const targetData = outputBuffer.getChannelData(channel);
            
            this._resampleChannel(sourceData, targetData, ratio);
        }
        
        return outputBuffer;
    }
    
    /**
     * Resample a single channel using sinc interpolation
     */
    _resampleChannel(source, target, ratio) {
        const sourceLength = source.length;
        const targetLength = target.length;
        const kernelSize = this.kernelSize;
        
        for (let i = 0; i < targetLength; i++) {
            const sourcePos = i * ratio;
            const sourceIndex = Math.floor(sourcePos);
            const frac = sourcePos - sourceIndex;
            
            // Sinc interpolation
            let sum = 0;
            let weightSum = 0;
            
            for (let j = -kernelSize; j <= kernelSize; j++) {
                const srcIdx = sourceIndex + j;
                if (srcIdx >= 0 && srcIdx < sourceLength) {
                    const x = j - frac;
                    const weight = this._sincKernel(x);
                    sum += source[srcIdx] * weight;
                    weightSum += weight;
                }
            }
            
            target[i] = weightSum > 0 ? sum / weightSum : 0;
        }
    }
    
    /**
     * Sinc kernel for high-quality interpolation
     */
    _sincKernel(x) {
        const piX = Math.PI * x;
        
        if (Math.abs(x) < 0.0001) {
            return 1;
        }
        
        // Lanczos window
        const a = this.kernelSize / 4;
        const sinc = Math.sin(piX) / piX;
        const window = (Math.abs(x) < a) ? 
            Math.sin(Math.PI * x / a) / (Math.PI * x / a) : 0;
        
        return sinc * window;
    }
    
    /**
     * Convert file to target sample rate
     */
    async convertFile(file, audioContext, targetSampleRate = null) {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        return this.convert(audioBuffer, targetSampleRate);
    }
    
    /**
     * Get sample rate info for a file
     */
    async getSampleRateInfo(file, audioContext) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            return {
                sampleRate: audioBuffer.sampleRate,
                duration: audioBuffer.duration,
                channels: audioBuffer.numberOfChannels,
                samples: audioBuffer.length,
                needsConversion: audioBuffer.sampleRate !== this.options.targetSampleRate
            };
        } catch (error) {
            console.error('[SampleRateConverter] Error reading file:', error);
            return null;
        }
    }
    
    /**
     * Set target sample rate
     */
    setTargetSampleRate(rate) {
        this.options.targetSampleRate = rate;
        console.log(`[SampleRateConverter] Target sample rate set to ${rate}Hz`);
    }
    
    /**
     * Set quality level
     */
    setQuality(quality) {
        this.options.quality = quality;
        
        switch (quality) {
            case 'low':
                this.kernelSize = 16;
                break;
            case 'medium':
                this.kernelSize = 32;
                break;
            case 'high':
            default:
                this.kernelSize = 64;
                break;
        }
        
        console.log(`[SampleRateConverter] Quality set to ${quality} (kernel: ${this.kernelSize})`);
    }
}

/**
 * Open Sample Rate Converter Panel
 */
export function openSampleRateConverterPanel(services) {
    const { showNotification } = services;
    
    const panel = document.createElement('div');
    panel.id = 'sample-rate-converter-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-xl p-6 w-[600px] max-h-[90vh] overflow-y-auto border border-zinc-700">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">Sample Rate Converter</h2>
                <button id="close-src" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="bg-zinc-800 rounded-lg p-4 mb-6">
                <h3 class="text-lg font-semibold text-white mb-4">Settings</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="text-zinc-400 text-sm">Target Sample Rate</label>
                        <select id="target-sr-select" class="w-full bg-zinc-700 text-white rounded p-2 mt-1">
                            <option value="44100">44100 Hz (CD)</option>
                            <option value="48000">48000 Hz (Video)</option>
                            <option value="88200">88200 Hz</option>
                            <option value="96000">96000 Hz</option>
                            <option value="176400">176400 Hz</option>
                            <option value="192000">192000 Hz</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-zinc-400 text-sm">Quality</label>
                        <select id="quality-select" class="w-full bg-zinc-700 text-white rounded p-2 mt-1">
                            <option value="low">Low (Fast)</option>
                            <option value="medium">Medium</option>
                            <option value="high" selected>High (Best)</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="bg-zinc-800 rounded-lg p-4 mb-6">
                <h3 class="text-lg font-semibold text-white mb-4">Convert Audio</h3>
                <div id="drop-zone" class="border-2 border-dashed border-zinc-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors">
                    <div class="text-zinc-400">
                        <div class="text-4xl mb-2">📁</div>
                        <div>Drop audio files here or click to browse</div>
                    </div>
                    <input type="file" id="file-input" accept="audio/*" class="hidden" multiple>
                </div>
                
                <div id="file-info" class="hidden mt-4 bg-zinc-700 rounded p-3">
                    <div class="flex justify-between items-center">
                        <div>
                            <div id="file-name" class="text-white font-medium"></div>
                            <div id="file-details" class="text-zinc-400 text-sm"></div>
                        </div>
                        <button id="convert-btn" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded">
                            Convert
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="conversion-progress" class="hidden bg-zinc-800 rounded-lg p-4 mb-6">
                <div class="flex items-center gap-4">
                    <div class="flex-1 bg-zinc-700 rounded-full h-2 overflow-hidden">
                        <div id="progress-bar" class="bg-blue-500 h-full transition-all" style="width: 0%"></div>
                    </div>
                    <span id="progress-text" class="text-white text-sm">0%</span>
                </div>
            </div>
            
            <div id="batch-files" class="bg-zinc-800 rounded-lg p-4 mb-6 hidden">
                <h3 class="text-lg font-semibold text-white mb-4">Files to Convert</h3>
                <div id="files-list" class="space-y-2 max-h-[200px] overflow-y-auto"></div>
                <button id="convert-all-btn" class="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded">
                    Convert All
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Initialize converter
    const converter = new SampleRateConverter();
    const audioContext = window.Tone?.context?.rawContext || window.Tone?.context || new (window.AudioContext || window.webkitAudioContext)();
    const filesToConvert = [];
    
    // Get elements
    const dropZone = panel.querySelector('#drop-zone');
    const fileInput = panel.querySelector('#file-input');
    const fileInfo = panel.querySelector('#file-info');
    const batchFiles = panel.querySelector('#batch-files');
    const filesList = panel.querySelector('#files-list');
    
    // Event handlers
    panel.querySelector('#close-src').onclick = () => panel.remove();
    
    panel.querySelector('#target-sr-select').onchange = (e) => {
        converter.setTargetSampleRate(parseInt(e.target.value));
    };
    
    panel.querySelector('#quality-select').onchange = (e) => {
        converter.setQuality(e.target.value);
    };
    
    // File handling
    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('border-blue-500');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('border-blue-500');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-blue-500');
        handleFiles(e.dataTransfer.files);
    };
    fileInput.onchange = (e) => handleFiles(e.target.files);
    
    async function handleFiles(fileList) {
        const files = Array.from(fileList);
        
        if (files.length === 0) return;
        
        filesToConvert.length = 0;
        
        for (const file of files) {
            const info = await converter.getSampleRateInfo(file, audioContext);
            filesToConvert.push({
                file,
                info
            });
        }
        
        if (filesToConvert.length === 1) {
            // Single file mode
            const f = filesToConvert[0];
            fileInfo.classList.remove('hidden');
            batchFiles.classList.add('hidden');
            
            panel.querySelector('#file-name').textContent = f.file.name;
            panel.querySelector('#file-details').textContent = f.info ? 
                `${f.info.sampleRate} Hz, ${f.info.channels} ch, ${f.info.duration.toFixed(2)}s ${f.info.needsConversion ? ' - Needs conversion' : ' - Already at target rate'}` :
                'Could not read file';
        } else {
            // Batch mode
            fileInfo.classList.add('hidden');
            batchFiles.classList.remove('hidden');
            
            filesList.innerHTML = filesToConvert.map((f, i) => `
                <div class="flex items-center justify-between bg-zinc-700 rounded p-2">
                    <div>
                        <span class="text-white text-sm">${f.file.name}</span>
                        <span class="text-zinc-400 text-xs ml-2">${f.info?.sampleRate || '?'} Hz</span>
                    </div>
                    ${f.info?.needsConversion ? '<span class="text-yellow-400 text-xs">Convert</span>' : '<span class="text-green-400 text-xs">OK</span>'}
                </div>
            `).join('');
        }
    }
    
    // Convert handlers
    panel.querySelector('#convert-btn').onclick = async () => {
        if (filesToConvert.length === 0) return;
        
        const f = filesToConvert[0];
        const progress = panel.querySelector('#conversion-progress');
        const progressBar = panel.querySelector('#progress-bar');
        const progressText = panel.querySelector('#progress-text');
        
        progress.classList.remove('hidden');
        
        try {
            progressBar.style.width = '30%';
            progressText.textContent = 'Reading...';
            
            const converted = await converter.convertFile(f.file, audioContext);
            
            progressBar.style.width = '70%';
            progressText.textContent = 'Rendering...';
            
            // Download
            await downloadBuffer(converted, f.file.name.replace(/\.[^.]+$/, '_converted.wav'));
            
            progressBar.style.width = '100%';
            progressText.textContent = 'Done!';
            
            if (showNotification) showNotification('Conversion complete!', 2000);
        } catch (error) {
            console.error('[SampleRateConverter] Conversion failed:', error);
            progressText.textContent = 'Error: ' + error.message;
            if (showNotification) showNotification('Conversion failed', 2000);
        }
    };
    
    panel.querySelector('#convert-all-btn').onclick = async () => {
        const progress = panel.querySelector('#conversion-progress');
        const progressBar = panel.querySelector('#progress-bar');
        const progressText = panel.querySelector('#progress-text');
        
        progress.classList.remove('hidden');
        
        for (let i = 0; i < filesToConvert.length; i++) {
            const f = filesToConvert[i];
            
            if (!f.info?.needsConversion) continue;
            
            progressBar.style.width = `${(i / filesToConvert.length) * 100}%`;
            progressText.textContent = `Converting ${i + 1}/${filesToConvert.length}...`;
            
            try {
                const converted = await converter.convertFile(f.file, audioContext);
                await downloadBuffer(converted, f.file.name.replace(/\.[^.]+$/, '_converted.wav'));
            } catch (error) {
                console.error(`[SampleRateConverter] Failed to convert ${f.file.name}:`, error);
            }
        }
        
        progressBar.style.width = '100%';
        progressText.textContent = 'All done!';
        
        if (showNotification) showNotification(`Converted ${filesToConvert.filter(f => f.info?.needsConversion).length} files`, 2000);
    };
    
    // Helper to download audio buffer
    async function downloadBuffer(buffer, filename) {
        const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineCtx.destination);
        source.start();
        
        const renderedBuffer = await offlineCtx.startRendering();
        
        // Convert to WAV
        const wavBlob = bufferToWav(renderedBuffer);
        const url = URL.createObjectURL(wavBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    function bufferToWav(buffer) {
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
        writeString(view, 0, 'RIFF');
        view.setUint32(4, bufferLength - 8, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // Interleave channels
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
    
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    console.log('[SampleRateConverter] Panel opened');
}

export default SampleRateConverter;