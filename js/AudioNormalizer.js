// js/AudioNormalizer.js - Batch Audio Normalization with True Peak Limiting

/**
 * Audio Normalizer - Normalize audio samples to target dB with true peak limiting
 */

let normalizerPanel = null;

/**
 * Analyze audio buffer to get peak and RMS levels
 * @param {AudioBuffer} buffer - Audio buffer to analyze
 * @returns {Object} { peak: number, peakDb: number, rms: number, rmsDb: number }
 */
export function analyzeAudioBuffer(buffer) {
    if (!buffer || !buffer.getChannelData) {
        return { peak: 0, peakDb: -Infinity, rms: 0, rmsDb: -Infinity };
    }
    
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    let maxPeak = 0;
    let sumSquares = 0;
    
    for (let c = 0; c < channels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
            const sample = Math.abs(data[i]);
            if (sample > maxPeak) maxPeak = sample;
            sumSquares += sample * sample;
        }
    }
    
    const rms = Math.sqrt(sumSquares / (channels * length));
    const peakDb = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    
    return {
        peak: maxPeak,
        peakDb: peakDb,
        rms: rms,
        rmsDb: rmsDb
    };
}

/**
 * Normalize audio buffer to target dB with optional true peak limiting
 * @param {AudioBuffer} buffer - Audio buffer to normalize
 * @param {number} targetDb - Target dB (e.g., -1 for -1dB)
 * @param {boolean} useTruePeak - Apply true peak limiting
 * @param {number} ceilingDb - Ceiling dB for limiter (e.g., -0.1)
 * @returns {Float32Array[]} Array of normalized channel data
 */
export function normalizeAudioBuffer(buffer, targetDb, useTruePeak, ceilingDb) {
    if (!buffer || !buffer.getChannelData) return [];
    
    const targetLinear = Math.pow(10, targetDb / 20);
    const ceilingLinear = Math.pow(10, ceilingDb / 20);
    const channels = buffer.numberOfChannels;
    const result = [];
    
    for (let c = 0; c < channels; c++) {
        const data = buffer.getChannelData(c);
        const normalized = new Float32Array(data.length);
        
        // Find current peak
        let maxPeak = 0;
        for (let i = 0; i < data.length; i++) {
            if (Math.abs(data[i]) > maxPeak) maxPeak = Math.abs(data[i]);
        }
        
        // Calculate gain
        const gain = maxPeak > 0 ? targetLinear / maxPeak : 1;
        
        // Apply gain with true peak limiting
        for (let i = 0; i < data.length; i++) {
            let sample = data[i] * gain;
            
            if (useTruePeak && Math.abs(sample) > ceilingLinear) {
                // Soft clip true peak limiter
                sample = Math.sign(sample) * (
                    ceilingLinear + (1 - ceilingLinear) * Math.tanh((Math.abs(sample) - ceilingLinear) / (1 - ceilingLinear))
                );
            }
            
            normalized[i] = sample;
        }
        
        result.push(normalized);
    }
    
    return result;
}

/**
 * Process an audio file blob for normalization
 * @param {File|Blob} audioFile - Audio file to process
 * @param {number} targetDb - Target dB level
 * @param {boolean} useTruePeak - Enable true peak limiting
 * @param {number} ceilingDb - Ceiling dB for limiter
 * @returns {Promise<{analyzed: Object, normalized: Blob}>} Analysis and normalized audio
 */
export async function processAudioFile(audioFile, targetDb, useTruePeak, ceilingDb) {
    return new Promise(async (resolve, reject) => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = await audioFile.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Analyze original
            const analyzed = analyzeAudioBuffer(audioBuffer);
            
            // Normalize
            const normalizedData = normalizeAudioBuffer(audioBuffer, targetDb, useTruePeak, ceilingDb);
            
            // Create new buffer with normalized data
            const normalizedBuffer = audioContext.createBuffer(
                audioBuffer.numberOfChannels,
                audioBuffer.length,
                audioBuffer.sampleRate
            );
            
            for (let c = 0; c < normalizedData.length; c++) {
                normalizedBuffer.copyToChannel(normalizedData[c], c);
            }
            
            // Encode to WAV
            const wavBlob = audioBufferToWav(normalizedBuffer);
            
            await audioContext.close();
            
            resolve({
                analyzed,
                normalized: wavBlob
            });
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Convert AudioBuffer to WAV blob
 * @param {AudioBuffer} buffer - Audio buffer
 * @returns {Blob} WAV file blob
 */
function audioBufferToWav(buffer) {
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
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write interleaved samples
    const channels = [];
    for (let c = 0; c < numChannels; c++) {
        channels.push(buffer.getChannelData(c));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let c = 0; c < numChannels; c++) {
            const sample = Math.max(-1, Math.min(1, channels[c][i]));
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

/**
 * Open the Audio Normalizer panel
 */
export function openAudioNormalizerPanel() {
    if (normalizerPanel) {
        normalizerPanel.focus();
        return;
    }
    
    normalizerPanel = createNormalizerPanel();
    document.body.appendChild(normalizerPanel);
}

/**
 * Create the Audio Normalizer panel element
 * @returns {HTMLElement} Panel element
 */
function createNormalizerPanel() {
    const panel = document.createElement('div');
    panel.className = 'fixed bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg shadow-2xl z-[9999]';
    panel.style.cssText = 'width:380px;left:50%;top:50%;transform:translate(-50%,-50%);';
    
    panel.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] rounded-t-lg border-b border-[#3a3a3a] cursor-move" data-drag-handle>
            <span class="text-sm font-semibold text-[#e0e0e0]">Audio Normalizer</span>
            <button id="normalizerCloseBtn" class="w-5 h-5 flex items-center justify-center text-[#888] hover:text-[#fff] text-lg">&times;</button>
        </div>
        
        <div class="p-4 space-y-4">
            <!-- Target dB -->
            <div class="flex items-center justify-between">
                <label class="text-xs text-[#a0a0a0]">Target Level:</label>
                <div class="flex items-center gap-2">
                    <input type="range" id="normalizerTargetDb" min="-20" max="0" step="0.1" value="-1" class="w-28 h-1 accent-[#ff7700]">
                    <span id="normalizerTargetDbValue" class="text-xs text-[#e0e0e0] w-12 text-right">-1.0 dB</span>
                </div>
            </div>
            
            <!-- True Peak Limiter Toggle -->
            <div class="flex items-center justify-between">
                <label class="text-xs text-[#a0a0a0]">True Peak Limiter:</label>
                <button id="normalizerLimiterToggle" class="px-3 py-1 text-xs rounded border border-[#4a4a4a] bg-[#282828] text-[#888]">OFF</button>
            </div>
            
            <!-- Ceiling dB (only shown when limiter is on) -->
            <div id="normalizerCeilingRow" class="flex items-center justify-between hidden">
                <label class="text-xs text-[#a0a0a0]">Ceiling:</label>
                <div class="flex items-center gap-2">
                    <input type="range" id="normalizerCeilingDb" min="-3" max="-0.1" step="0.1" value="-0.1" class="w-28 h-1 accent-[#ff7700]">
                    <span id="normalizerCeilingDbValue" class="text-xs text-[#e0e0e0] w-12 text-right">-0.1 dB</span>
                </div>
            </div>
            
            <!-- File Drop Zone -->
            <div id="normalizerDropZone" class="border-2 border-dashed border-[#4a4a4a] rounded-lg p-6 text-center cursor-pointer hover:border-[#ff7700] transition-colors">
                <div class="text-[#888] text-xs">Drop audio files here or click to browse</div>
                <div id="normalizerFileList" class="mt-2 space-y-1 text-left max-h-32 overflow-y-auto"></div>
            </div>
            <input type="file" id="normalizerFileInput" accept="audio/*" multiple class="hidden">
            
            <!-- Analyze Results -->
            <div id="normalizerResults" class="hidden space-y-2 p-3 bg-[#1a1a1a] rounded border border-[#3a3a3a]">
                <div class="text-xs font-semibold text-[#e0e0e0] mb-2">Analysis Results</div>
                <div class="flex justify-between text-xs"><span class="text-[#888]">Peak:</span><span id="normalizerPeakDb" class="text-[#e0e0e0]">--</span></div>
                <div class="flex justify-between text-xs"><span class="text-[#888]">RMS:</span><span id="normalizerRmsDb" class="text-[#e0e0e0]">--</span></div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex gap-2">
                <button id="normalizerAnalyzeBtn" class="flex-1 px-3 py-2 text-xs rounded border border-[#4a4a4a] bg-[#282828] text-[#e0e0e0] hover:bg-[#333] disabled:opacity-50" disabled>Analyze</button>
                <button id="normalizerProcessBtn" class="flex-1 px-3 py-2 text-xs rounded border border-[#4a4a4a] bg-[#ff7700] text-[#fff] hover:bg-[#ff8800] disabled:opacity-50" disabled>Normalize & Export</button>
            </div>
            
            <!-- Progress -->
            <div id="normalizerProgress" class="hidden">
                <div class="h-1 bg-[#1a1a1a] rounded overflow-hidden">
                    <div id="normalizerProgressBar" class="h-full bg-[#ff7700] transition-all" style="width:0%"></div>
                </div>
                <div id="normalizerProgressText" class="text-xs text-[#888] mt-1 text-center">Processing...</div>
            </div>
        </div>
    `;
    
    // Store state
    panel._state = {
        limiterEnabled: false,
        targetDb: -1,
        ceilingDb: -0.1,
        selectedFiles: [],
        analyzedData: null
    };
    
    // Setup event listeners
    setupNormalizerEvents(panel);
    
    return panel;
}

/**
 * Setup event listeners for the normalizer panel
 * @param {HTMLElement} panel - Panel element
 */
function setupNormalizerEvents(panel) {
    const targetDbSlider = panel.querySelector('#normalizerTargetDb');
    const targetDbValue = panel.querySelector('#normalizerTargetDbValue');
    const limiterToggle = panel.querySelector('#normalizerLimiterToggle');
    const ceilingRow = panel.querySelector('#normalizerCeilingRow');
    const ceilingDbSlider = panel.querySelector('#normalizerCeilingDb');
    const ceilingDbValue = panel.querySelector('#normalizerCeilingDbValue');
    const dropZone = panel.querySelector('#normalizerDropZone');
    const fileInput = panel.querySelector('#normalizerFileInput');
    const fileList = panel.querySelector('#normalizerFileList');
    const results = panel.querySelector('#normalizerResults');
    const analyzeBtn = panel.querySelector('#normalizerAnalyzeBtn');
    const processBtn = panel.querySelector('#normalizerProcessBtn');
    const closeBtn = panel.querySelector('#normalizerCloseBtn');
    const progress = panel.querySelector('#normalizerProgress');
    const progressBar = panel.querySelector('#normalizerProgressBar');
    const progressText = panel.querySelector('#normalizerProgressText');
    
    // Target dB slider
    targetDbSlider.addEventListener('input', () => {
        panel._state.targetDb = parseFloat(targetDbSlider.value);
        targetDbValue.textContent = `${panel._state.targetDb.toFixed(1)} dB`;
    });
    
    // Limiter toggle
    limiterToggle.addEventListener('click', () => {
        panel._state.limiterEnabled = !panel._state.limiterEnabled;
        limiterToggle.textContent = panel._state.limiterEnabled ? 'ON' : 'OFF';
        limiterToggle.classList.toggle('bg-[#ff7700]', panel._state.limiterEnabled);
        limiterToggle.classList.toggle('text-[#fff]', panel._state.limiterEnabled);
        limiterToggle.classList.toggle('bg-[#282828]', !panel._state.limiterEnabled);
        limiterToggle.classList.toggle('text-[#888]', !panel._state.limiterEnabled);
        ceilingRow.classList.toggle('hidden', !panel._state.limiterEnabled);
    });
    
    // Ceiling dB slider
    ceilingDbSlider.addEventListener('input', () => {
        panel._state.ceilingDb = parseFloat(ceilingDbSlider.value);
        ceilingDbValue.textContent = `${panel._state.ceilingDb.toFixed(1)} dB`;
    });
    
    // File drop zone
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-[#ff7700]', 'bg-[#2a2a2a]');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-[#ff7700]', 'bg-[#2a2a2a]');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-[#ff7700]', 'bg-[#2a2a2a]');
        handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', () => handleFiles(fileInput.files));
    
    function handleFiles(files) {
        panel._state.selectedFiles = Array.from(files).filter(f => f.type.startsWith('audio/'));
        fileList.innerHTML = '';
        panel._state.selectedFiles.forEach((file, idx) => {
            const item = document.createElement('div');
            item.className = 'text-xs text-[#a0a0a0] truncate';
            item.textContent = file.name;
            fileList.appendChild(item);
        });
        analyzeBtn.disabled = panel._state.selectedFiles.length === 0;
        processBtn.disabled = panel._state.selectedFiles.length === 0;
        results.classList.add('hidden');
    }
    
    // Analyze button
    analyzeBtn.addEventListener('click', async () => {
        if (panel._state.selectedFiles.length === 0) return;
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const file = panel._state.selectedFiles[0];
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const analyzed = analyzeAudioBuffer(audioBuffer);
            panel._state.analyzedData = analyzed;
            
            panel.querySelector('#normalizerPeakDb').textContent = `${analyzed.peakDb.toFixed(2)} dB`;
            panel.querySelector('#normalizerRmsDb').textContent = `${analyzed.rmsDb.toFixed(2)} dB`;
            results.classList.remove('hidden');
            
            await audioContext.close();
        } catch (err) {
            console.error('[AudioNormalizer] Analyze error:', err);
        }
    });
    
    // Process button
    processBtn.addEventListener('click', async () => {
        if (panel._state.selectedFiles.length === 0) return;
        
        progress.classList.remove('hidden');
        processBtn.disabled = true;
        
        try {
            for (let i = 0; i < panel._state.selectedFiles.length; i++) {
                const file = panel._state.selectedFiles[i];
                progressBar.style.width = `${((i + 0.5) / panel._state.selectedFiles.length) * 100}%`;
                progressText.textContent = `Processing ${file.name}...`;
                
                const result = await processAudioFile(
                    file,
                    panel._state.targetDb,
                    panel._state.limiterEnabled,
                    panel._state.ceilingDb
                );
                
                // Download normalized file
                const url = URL.createObjectURL(result.normalized);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name.replace(/\.[^.]+$/, '_normalized.wav');
                a.click();
                URL.revokeObjectURL(url);
                
                progressBar.style.width = `${((i + 1) / panel._state.selectedFiles.length) * 100}%`;
            }
            
            progressText.textContent = 'Done!';
            setTimeout(() => progress.classList.add('hidden'), 2000);
        } catch (err) {
            console.error('[AudioNormalizer] Process error:', err);
            progressText.textContent = 'Error processing files';
        }
        
        processBtn.disabled = false;
    });
    
    // Close button
    closeBtn.addEventListener('click', () => closeNormalizerPanel());
    
    // Make draggable
    makeDraggable(panel, panel.querySelector('[data-drag-handle]'));
}

/**
 * Make an element draggable
 * @param {HTMLElement} element - Element to make draggable
 * @param {HTMLElement} handle - Drag handle element
 */
function makeDraggable(element, handle) {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = element.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        element.style.left = initialX + 'px';
        element.style.top = initialY + 'px';
        element.style.transform = 'none';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        element.style.left = (initialX + dx) + 'px';
        element.style.top = (initialY + dy) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

/**
 * Close the normalizer panel
 */
function closeNormalizerPanel() {
    if (normalizerPanel) {
        normalizerPanel.remove();
        normalizerPanel = null;
    }
}

/**
 * Initialize the Audio Normalizer
 */
export function initAudioNormalizer() {
    // Add menu item listener
    const menuItem = document.getElementById('menuAudioNormalizer');
    if (menuItem) {
        menuItem.addEventListener('click', openAudioNormalizerPanel);
    }
    
    // Add to start menu
    const startMenu = document.getElementById('startMenu');
    if (startMenu && !document.getElementById('menuAudioNormalizer')) {
        const menuItem = document.createElement('li');
        menuItem.id = 'menuAudioNormalizer';
        menuItem.textContent = 'Audio Normalizer';
        menuItem.addEventListener('click', () => {
            startMenu.classList.add('hidden');
            openAudioNormalizerPanel();
        });
        
        // Insert after video export
        const videoExportItem = startMenu.querySelector('#menuVideoExport');
        if (videoExportItem && videoExportItem.nextSibling) {
            startMenu.insertBefore(menuItem, videoExportItem.nextSibling);
        }
    }
    
    console.log('[AudioNormalizer] Initialized');
}