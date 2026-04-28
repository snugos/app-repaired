// js/TempoSyncHelper.js - Detect tempo from audio and suggest matching BPM
// Feature: Analyze audio to detect tempo and suggest optimal BPM

let localAppServices = {};
let tempoDetector = null;
let isAnalyzing = false;

/**
 * Initialize the Tempo Sync Helper module
 * @param {object} services - App services
 */
export function initTempoSyncHelper(services) {
    localAppServices = services;
    console.log('[TempoSyncHelper] Initialized');
}

/**
 * Open the Tempo Sync Helper panel
 */
export function openTempoSyncHelperPanel() {
    const existingPanel = document.getElementById('tempoSyncPanel');
    if (existingPanel) {
        existingPanel.remove();
    }

    const panel = document.createElement('div');
    panel.id = 'tempoSyncPanel';
    panel.className = 'fixed bg-[#2a2a2a] border border-[#4a4a4a] rounded-lg shadow-2xl z-[9999]';
    panel.style.cssText = 'width:350px;left:50%;top:50%;transform:translate(-50%,-50%);';

    panel.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] rounded-t-lg border-b border-[#3a3a3a] cursor-move" data-drag-handle>
            <span class="text-sm font-semibold text-[#e0e0e0]">🎵 Tempo Sync Helper</span>
            <button id="tempoSyncClose" class="w-5 h-5 flex items-center justify-center text-[#888] hover:text-[#fff] text-lg">&times;</button>
        </div>
        
        <div class="p-4 space-y-4">
            <div class="text-xs text-[#888] text-center">
                Analyze audio from microphone or audio input to detect tempo and suggest BPM
            </div>
            
            <!-- Mode Selection -->
            <div class="flex gap-2">
                <button id="tempoSyncMicBtn" class="flex-1 px-3 py-2 text-xs rounded border border-[#4a4a4a] bg-[#ff7700] text-white">
                    🎤 Microphone
                </button>
                <button id="tempoSyncFileBtn" class="flex-1 px-3 py-2 text-xs rounded border border-[#4a4a4a] bg-[#282828] text-[#888]">
                    📁 Audio File
                </button>
            </div>
            
            <!-- File Input (hidden by default) -->
            <div id="tempoSyncFileInput" class="hidden">
                <input type="file" id="tempoSyncAudioFile" accept="audio/*" class="hidden">
                <div id="tempoSyncDropZone" class="border-2 border-dashed border-[#4a4a4a] rounded-lg p-4 text-center cursor-pointer hover:border-[#ff7700] transition-colors">
                    <div class="text-[#888] text-xs">Drop audio file or click to browse</div>
                    <div id="tempoSyncFileName" class="mt-2 text-xs text-[#e0e0e0] truncate"></div>
                </div>
            </div>
            
            <!-- Beat Detection Settings -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <label class="text-xs text-[#a0a0a0]">Sensitivity:</label>
                    <input type="range" id="tempoSyncSensitivity" min="1" max="10" value="5" class="w-24 h-1 accent-[#ff7700]">
                </div>
                <div class="flex items-center justify-between">
                    <label class="text-xs text-[#a0a0a0]">Min BPM:</label>
                    <input type="number" id="tempoSyncMinBpm" value="60" min="40" max="200" class="w-16 p-1 bg-[#282828] border border-[#4a4a4a] rounded text-[#e0e0e0] text-xs text-center">
                </div>
                <div class="flex items-center justify-between">
                    <label class="text-xs text-[#a0a0a0]">Max BPM:</label>
                    <input type="number" id="tempoSyncMaxBpm" value="180" min="60" max="300" class="w-16 p-1 bg-[#282828] border border-[#4a4a4a] rounded text-[#e0e0e0] text-xs text-center">
                </div>
            </div>
            
            <!-- Beat Visualizer -->
            <div id="tempoSyncVisualizer" class="h-16 bg-[#1a1a1a] rounded border border-[#3a3a3a] flex items-center justify-center">
                <span id="tempoSyncStatus" class="text-xs text-[#666]">Tap to start analysis</span>
            </div>
            
            <!-- Detected Tempo Display -->
            <div id="tempoSyncResults" class="hidden space-y-3 p-3 bg-[#1a1a1a] rounded border border-[#3a3a3a]">
                <div class="text-center">
                    <div id="tempoSyncDetectedBpm" class="text-3xl font-bold text-[#ff7700]">--</div>
                    <div class="text-xs text-[#888]">Detected BPM</div>
                </div>
                
                <div class="flex items-center justify-between text-xs">
                    <span class="text-[#888]">Confidence:</span>
                    <span id="tempoSyncConfidence" class="text-[#e0e0e0]">--</span>
                </div>
                
                <div class="flex items-center justify-between text-xs">
                    <span class="text-[#888]">Time Signature:</span>
                    <span id="tempoSyncTimeSig" class="text-[#e0e0e0]">4/4</span>
                </div>
                
                <!-- Suggested BPMs -->
                <div class="pt-2 border-t border-[#3a3a3a]">
                    <div class="text-xs text-[#888] mb-2">Suggested BPM values:</div>
                    <div id="tempoSyncSuggestions" class="flex gap-2 flex-wrap">
                        <!-- Populated dynamically -->
                    </div>
                </div>
                
                <!-- Apply Buttons -->
                <div class="flex gap-2 pt-2">
                    <button id="tempoSyncApplyBtn" class="flex-1 px-3 py-2 text-sm rounded bg-[#ff7700] text-white hover:bg-[#ff8800] font-medium">
                        Apply Detected BPM
                    </button>
                    <button id="tempoSyncHalfBtn" class="px-3 py-2 text-xs rounded border border-[#4a4a4a] bg-[#282828] text-[#888] hover:bg-[#333]">
                        ÷2
                    </button>
                    <button id="tempoSyncDoubleBtn" class="px-3 py-2 text-xs rounded border border-[#4a4a4a] bg-[#282828] text-[#888] hover:bg-[#333]">
                        ×2
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);
    setupTempoSyncEvents(panel);
    makeDraggable(panel, panel.querySelector('[data-drag-handle]'));
}

/**
 * Setup event listeners for the tempo sync panel
 * @param {HTMLElement} panel - Panel element
 */
function setupTempoSyncEvents(panel) {
    const closeBtn = panel.querySelector('#tempoSyncClose');
    const micBtn = panel.querySelector('#tempoSyncMicBtn');
    const fileBtn = panel.querySelector('#tempoSyncFileBtn');
    const fileInputContainer = panel.querySelector('#tempoSyncFileInput');
    const fileInput = panel.querySelector('#tempoSyncAudioFile');
    const dropZone = panel.querySelector('#tempoSyncDropZone');
    const sensitivitySlider = panel.querySelector('#tempoSyncSensitivity');
    const minBpmInput = panel.querySelector('#tempoSyncMinBpm');
    const maxBpmInput = panel.querySelector('#tempoSyncMaxBpm');
    const applyBtn = panel.querySelector('#tempoSyncApplyBtn');
    const halfBtn = panel.querySelector('#tempoSyncHalfBtn');
    const doubleBtn = panel.querySelector('#tempoSyncDoubleBtn');
    const statusEl = panel.querySelector('#tempoSyncStatus');
    const resultsEl = panel.querySelector('#tempoSyncResults');
    const detectedBpmEl = panel.querySelector('#tempoSyncDetectedBpm');
    const confidenceEl = panel.querySelector('#tempoSyncConfidence');
    const suggestionsEl = panel.querySelector('#tempoSyncSuggestions');

    let currentDetectedBpm = null;
    let audioContext = null;
    let analyser = null;
    let dataArray = null;
    let animationFrameId = null;

    // Close button
    closeBtn.addEventListener('click', () => {
        panel.remove();
        stopAnalysis();
    });

    // Mic button click
    micBtn.addEventListener('click', () => {
        micBtn.classList.add('bg-[#ff7700]', 'text-white');
        micBtn.classList.remove('bg-[#282828]', 'text-[#888]');
        fileBtn.classList.remove('bg-[#ff7700]', 'text-white');
        fileBtn.classList.add('bg-[#282828]', 'text-[#888]');
        fileInputContainer.classList.add('hidden');
        startMicAnalysis(panel);
    });

    // File button click
    fileBtn.addEventListener('click', () => {
        fileBtn.classList.add('bg-[#ff7700]', 'text-white');
        fileBtn.classList.remove('bg-[#282828]', 'text-[#888]');
        micBtn.classList.remove('bg-[#ff7700]', 'text-white');
        micBtn.classList.add('bg-[#282828]', 'text-[#888]');
        fileInputContainer.classList.remove('hidden');
        stopAnalysis();
        statusEl.textContent = 'Select an audio file to analyze';
    });

    // File input handling
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-[#ff7700]');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-[#ff7700]');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-[#ff7700]');
        if (e.dataTransfer.files.length > 0) {
            analyzeAudioFile(e.dataTransfer.files[0], panel);
        }
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            analyzeAudioFile(fileInput.files[0], panel);
        }
    });

    // Apply button
    applyBtn.addEventListener('click', () => {
        if (currentDetectedBpm && localAppServices.setTempo) {
            localAppServices.setTempo(currentDetectedBpm);
            localAppServices.showNotification?.(`BPM set to ${currentDetectedBpm.toFixed(1)}`, 2000);
        }
    });

    // Half/Double buttons
    halfBtn.addEventListener('click', () => {
        if (currentDetectedBpm && localAppServices.setTempo) {
            const newBpm = currentDetectedBpm / 2;
            localAppServices.setTempo(newBpm);
            localAppServices.showNotification?.(`BPM set to ${newBpm.toFixed(1)}`, 2000);
        }
    });

    doubleBtn.addEventListener('click', () => {
        if (currentDetectedBpm && localAppServices.setTempo) {
            const newBpm = currentDetectedBpm * 2;
            localAppServices.setTempo(newBpm);
            localAppServices.showNotification?.(`BPM set to ${newBpm.toFixed(1)}`, 2000);
        }
    });

    function startMicAnalysis(panel) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 2048;
                
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);
                
                dataArray = new Uint8Array(analyser.frequencyBinCount);
                statusEl.textContent = 'Analyzing...';
                
                analyzeAudioStream(panel);
            })
            .catch(err => {
                console.error('[TempoSyncHelper] Mic access denied:', err);
                statusEl.textContent = 'Microphone access denied';
                localAppServices.showNotification?.('Please allow microphone access', 2000);
            });
    }

    function analyzeAudioStream(panel) {
        if (!analyser) return;

        analyser.getByteFrequencyData(dataArray);
        
        // Simple onset detection - look for energy spikes
        let energy = 0;
        for (let i = 0; i < dataArray.length; i++) {
            energy += dataArray[i];
        }
        energy /= dataArray.length;

        // Visual feedback
        const visualizer = panel.querySelector('#tempoSyncVisualizer');
        const barWidth = 100 / 16;
        let bars = '';
        for (let i = 0; i < 16; i++) {
            const idx = Math.floor(i * dataArray.length / 16);
            const value = dataArray[idx] / 255;
            const height = Math.max(4, value * 100);
            bars += `<div style="width:${barWidth}%;height:${height}%;background:#ff7700;opacity:${0.3 + value * 0.7}"></div>`;
        }
        visualizer.innerHTML = `<div class="flex items-end gap-0.5 h-full px-1">${bars}</div>`;

        // Track beats for tempo detection
        const sensitivity = parseInt(sensitivitySlider.value);
        const threshold = 100 - (sensitivity * 8);
        
        if (!tempoDetector) {
            tempoDetector = {
                beats: [],
                lastBeatTime: 0,
                lastEnergy: 0
            };
        }

        const now = performance.now();
        if (energy > threshold && tempoDetector.lastEnergy < threshold) {
            // Beat detected
            const timeSinceLastBeat = now - tempoDetector.lastBeatTime;
            
            if (timeSinceLastBeat > 150 && timeSinceLastBeat < 2000) {
                tempoDetector.beats.push(now);
                if (tempoDetector.beats.length > 20) {
                    tempoDetector.beats.shift();
                }
                
                // Calculate BPM from intervals
                if (tempoDetector.beats.length >= 4) {
                    const intervals = [];
                    for (let i = 1; i < tempoDetector.beats.length; i++) {
                        intervals.push(tempoDetector.beats[i] - tempoDetector.beats[i-1]);
                    }
                    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    const bpm = 60000 / avgInterval;
                    
                    const minBpm = parseFloat(minBpmInput.value) || 60;
                    const maxBpm = parseFloat(maxBpmInput.value) || 180;
                    
                    if (bpm >= minBpm && bpm <= maxBpm) {
                        currentDetectedBpm = bpm;
                        displayResults(panel, bpm, calculateConfidence(intervals));
                    }
                }
            }
            tempoDetector.lastBeatTime = now;
        }
        tempoDetector.lastEnergy = energy;

        if (isAnalyzing) {
            animationFrameId = requestAnimationFrame(() => analyzeAudioStream(panel));
        }
    }

    async function analyzeAudioFile(file, panel) {
        statusEl.textContent = 'Analyzing file...';
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Get raw audio data
            const channelData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;
            
            // Simple onset detection
            const onsets = detectOnsets(channelData, sampleRate);
            
            if (onsets.length >= 4) {
                const intervals = [];
                for (let i = 1; i < onsets.length; i++) {
                    intervals.push(onsets[i] - onsets[i-1]);
                }
                
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const bpm = 60000 / avgInterval;
                
                const minBpm = parseFloat(minBpmInput.value) || 60;
                const maxBpm = parseFloat(maxBpmInput.value) || 180;
                
                if (bpm >= minBpm && bpm <= maxBpm) {
                    currentDetectedBpm = bpm;
                    displayResults(panel, bpm, calculateConfidence(intervals));
                } else if (bpm < minBpm) {
                    // Try double tempo
                    const doubledBpm = bpm * 2;
                    if (doubledBpm <= maxBpm) {
                        currentDetectedBpm = doubledBpm;
                        displayResults(panel, doubledBpm, calculateConfidence(intervals));
                    } else {
                        statusEl.textContent = 'Tempo out of range';
                    }
                } else {
                    // Try halve tempo
                    const halvedBpm = bpm / 2;
                    if (halvedBpm >= minBpm) {
                        currentDetectedBpm = halvedBpm;
                        displayResults(panel, halvedBpm, calculateConfidence(intervals));
                    } else {
                        statusEl.textContent = 'Tempo out of range';
                    }
                }
            } else {
                statusEl.textContent = 'Not enough beats detected';
            }
            
            await audioContext.close();
        } catch (err) {
            console.error('[TempoSyncHelper] File analysis error:', err);
            statusEl.textContent = 'Error analyzing file';
        }
    }

    function detectOnsets(channelData, sampleRate) {
        const sensitivity = parseInt(sensitivitySlider?.value) || 5;
        const threshold = 0.3 - (sensitivity * 0.02);
        const onsets = [];
        
        const blockSize = Math.floor(sampleRate * 0.01); // 10ms blocks
        let prevEnergy = 0;
        
        for (let i = 0; i < channelData.length - blockSize; i += blockSize) {
            let energy = 0;
            for (let j = 0; j < blockSize; j++) {
                energy += channelData[i + j] * channelData[i + j];
            }
            energy = Math.sqrt(energy / blockSize);
            
            // Detect onset when energy increases suddenly
            if (energy > threshold && energy > prevEnergy * 1.5) {
                onsets.push(i / sampleRate * 1000); // Convert to ms
            }
            prevEnergy = energy;
        }
        
        // Filter out too-close onsets
        const filteredOnsets = [];
        let lastOnset = -1000;
        for (const onset of onsets) {
            if (onset - lastOnset > 150) {
                filteredOnsets.push(onset);
                lastOnset = onset;
            }
        }
        
        return filteredOnsets;
    }

    function calculateConfidence(intervals) {
        if (intervals.length < 2) return 0;
        
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        // Lower std dev = higher confidence
        const cv = stdDev / avg; // Coefficient of variation
        const confidence = Math.max(0, Math.min(100, (1 - cv) * 100));
        
        return Math.round(confidence);
    }

    function displayResults(panel, bpm, confidence) {
        const resultsEl = panel.querySelector('#tempoSyncResults');
        const detectedBpmEl = panel.querySelector('#tempoSyncDetectedBpm');
        const confidenceEl = panel.querySelector('#tempoSyncConfidence');
        const suggestionsEl = panel.querySelector('#tempoSyncSuggestions');
        const statusEl = panel.querySelector('#tempoSyncStatus');
        
        statusEl.textContent = 'Analysis complete!';
        resultsEl.classList.remove('hidden');
        detectedBpmEl.textContent = bpm.toFixed(1);
        confidenceEl.textContent = `${confidence}%`;
        
        // Generate suggestions (original, half, double, and common music BPMs)
        const suggestions = [
            bpm,
            bpm / 2,
            bpm * 2,
            findNearestCommonBpm(bpm),
            findNearestCommonBpm(bpm / 2),
            findNearestCommonBpm(bpm * 2)
        ].filter((v, i, a) => v >= 40 && v <= 300 && a.indexOf(v) === i);
        
        suggestionsEl.innerHTML = suggestions.map(b => 
            `<button class="px-2 py-1 text-xs rounded border border-[#4a4a4a] bg-[#282828] text-[#e0e0e0] hover:bg-[#ff7700] hover:text-white" data-bpm="${b.toFixed(1)}">${b.toFixed(1)}</button>`
        ).join('');
        
        // Add click handlers to suggestions
        suggestionsEl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const newBpm = parseFloat(btn.dataset.bpm);
                if (localAppServices.setTempo) {
                    localAppServices.setTempo(newBpm);
                    localAppServices.showNotification?.(`BPM set to ${newBpm.toFixed(1)}`, 2000);
                }
            });
        });
    }

    function findNearestCommonBpm(bpm) {
        const commonBpms = [60, 80, 90, 100, 110, 120, 128, 130, 140, 150, 160, 170, 180];
        let nearest = commonBpms[0];
        let minDiff = Math.abs(bpm - nearest);
        
        for (const common of commonBpms) {
            const diff = Math.abs(bpm - common);
            if (diff < minDiff) {
                minDiff = diff;
                nearest = common;
            }
        }
        
        return nearest;
    }

    function stopAnalysis() {
        isAnalyzing = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        tempoDetector = null;
        analyser = null;
    }

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
}

// Add to start menu
export function setupTempoSyncMenuItem() {
    const startMenu = document.getElementById('startMenu');
    if (startMenu && !document.getElementById('menuTempoSync')) {
        const menuItem = document.createElement('li');
        menuItem.id = 'menuTempoSync';
        menuItem.innerHTML = '<span class="mr-2">🎵</span>Tempo Sync Helper';
        menuItem.addEventListener('click', () => {
            startMenu.classList.add('hidden');
            openTempoSyncHelperPanel();
        });
        
        // Find a good insertion point (after Audio Normalizer)
        const normalizerItem = startMenu.querySelector('#menuAudioNormalizer');
        if (normalizerItem && normalizerItem.nextSibling) {
            startMenu.insertBefore(menuItem, normalizerItem.nextSibling);
        } else {
            startMenu.appendChild(menuItem);
        }
    }
}

console.log('[TempoSyncHelper] Module loaded');