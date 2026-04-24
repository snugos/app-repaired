/**
 * Audio Normalization Batch
 * Normalize multiple audio clips at once with various target levels
 */

export class AudioNormalizationBatch {
    constructor() {
        this.clips = new Map(); // clipId -> { buffer, targetLevel, peakDb, rmsDb }
        this.targetLevel = -3; // Default target level in dB
        this.normalizationMode = 'peak'; // 'peak' or 'rms'
        this.preserveDynamics = true;
        this.headroom = 0.5; // dB headroom for safety
    }

    /**
     * Add an audio clip for batch normalization
     */
    addClip(clipId, audioBuffer, options = {}) {
        const clipData = {
            buffer: audioBuffer,
            targetLevel: options.targetLevel ?? this.targetLevel,
            mode: options.mode ?? this.normalizationMode,
            preserveDynamics: options.preserveDynamics ?? this.preserveDynamics,
            status: 'pending',
            originalPeakDb: null,
            originalRmsDb: null,
            normalizedBuffer: null
        };
        
        // Analyze the audio
        this._analyzeClip(clipData);
        this.clips.set(clipId, clipData);
        
        return clipData;
    }

    /**
     * Remove a clip from the batch
     */
    removeClip(clipId) {
        return this.clips.delete(clipId);
    }

    /**
     * Clear all clips from the batch
     */
    clearClips() {
        this.clips.clear();
    }

    /**
     * Get all clips in the batch
     */
    getClips() {
        return Array.from(this.clips.entries()).map(([id, data]) => ({
            id,
            ...data,
            buffer: undefined, // Don't return the full buffer
            normalizedBuffer: undefined
        }));
    }

    /**
     * Analyze an audio clip to find peak and RMS levels
     */
    _analyzeClip(clipData) {
        const buffer = clipData.buffer;
        const numChannels = buffer.numberOfChannels;
        const length = buffer.length;
        
        let maxPeak = 0;
        let sumSquares = 0;
        
        for (let ch = 0; ch < numChannels; ch++) {
            const channelData = buffer.getChannelData(ch);
            
            for (let i = 0; i < length; i++) {
                const absValue = Math.abs(channelData[i]);
                if (absValue > maxPeak) {
                    maxPeak = absValue;
                }
                sumSquares += channelData[i] * channelData[i];
            }
        }
        
        // Calculate peak in dB
        clipData.originalPeakDb = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -Infinity;
        
        // Calculate RMS in dB
        const rms = Math.sqrt(sumSquares / (length * numChannels));
        clipData.originalRmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    }

    /**
     * Normalize a single clip
     */
    normalizeClip(clipId, options = {}) {
        const clipData = this.clips.get(clipId);
        if (!clipData) {
            console.error(`Clip ${clipId} not found in batch`);
            return null;
        }
        
        const targetLevel = options.targetLevel ?? clipData.targetLevel;
        const mode = options.mode ?? clipData.mode;
        const preserveDynamics = options.preserveDynamics ?? clipData.preserveDynamics;
        
        const buffer = clipData.buffer;
        const numChannels = buffer.numberOfChannels;
        const length = buffer.length;
        const sampleRate = buffer.sampleRate;
        
        // Create new buffer for normalized audio
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const normalizedBuffer = audioContext.createBuffer(numChannels, length, sampleRate);
        
        // Calculate gain needed
        let gain = 1;
        
        if (mode === 'peak') {
            // Peak normalization: scale so peak reaches target
            const targetLinear = Math.pow(10, (targetLevel - this.headroom) / 20);
            const currentPeakLinear = Math.pow(10, clipData.originalPeakDb / 20);
            gain = targetLinear / currentPeakLinear;
        } else if (mode === 'rms') {
            // RMS normalization: scale so RMS reaches target
            const targetLinear = Math.pow(10, (targetLevel - this.headroom) / 20);
            const currentRmsLinear = Math.pow(10, clipData.originalRmsDb / 20);
            gain = targetLinear / currentRmsLinear;
        }
        
        // Apply gain with optional dynamics preservation
        if (!preserveDynamics) {
            // Simple gain adjustment
            for (let ch = 0; ch < numChannels; ch++) {
                const sourceData = buffer.getChannelData(ch);
                const destData = normalizedBuffer.getChannelData(ch);
                
                for (let i = 0; i < length; i++) {
                    destData[i] = sourceData[i] * gain;
                }
            }
        } else {
            // Soft clipping for dynamics preservation
            for (let ch = 0; ch < numChannels; ch++) {
                const sourceData = buffer.getChannelData(ch);
                const destData = normalizedBuffer.getChannelData(ch);
                
                for (let i = 0; i < length; i++) {
                    let sample = sourceData[i] * gain;
                    
                    // Soft clip if exceeding 0 dB
                    if (sample > 1) {
                        sample = 1 - Math.exp(-(sample - 1));
                    } else if (sample < -1) {
                        sample = -1 + Math.exp(-(-sample - 1));
                    }
                    
                    destData[i] = sample;
                }
            }
        }
        
        clipData.normalizedBuffer = normalizedBuffer;
        clipData.status = 'normalized';
        clipData.appliedGain = gain;
        
        return normalizedBuffer;
    }

    /**
     * Normalize all clips in the batch
     */
    normalizeAll(progressCallback = null) {
        const results = [];
        const clipIds = Array.from(this.clips.keys());
        const total = clipIds.length;
        
        clipIds.forEach((clipId, index) => {
            const normalizedBuffer = this.normalizeClip(clipId);
            
            results.push({
                clipId,
                success: normalizedBuffer !== null,
                originalPeakDb: this.clips.get(clipId).originalPeakDb,
                originalRmsDb: this.clips.get(clipId).originalRmsDb,
                appliedGain: this.clips.get(clipId).appliedGain
            });
            
            if (progressCallback) {
                progressCallback({
                    current: index + 1,
                    total,
                    clipId,
                    progress: (index + 1) / total * 100
                });
            }
        });
        
        return results;
    }

    /**
     * Set global target level for all clips
     */
    setTargetLevel(db) {
        this.targetLevel = Math.max(-30, Math.min(0, db));
    }

    /**
     * Set normalization mode for all clips
     */
    setNormalizationMode(mode) {
        if (mode === 'peak' || mode === 'rms') {
            this.normalizationMode = mode;
        }
    }

    /**
     * Get normalization presets
     */
    static getPresets() {
        return [
            { name: 'Broadcast Standard', targetLevel: -3, mode: 'peak', preserveDynamics: true },
            { name: 'CD Mastering', targetLevel: -0.3, mode: 'peak', preserveDynamics: true },
            { name: 'Streaming', targetLevel: -14, mode: 'rms', preserveDynamics: true },
            { name: 'Podcast', targetLevel: -16, mode: 'rms', preserveDynamics: false },
            { name: 'YouTube', targetLevel: -14, mode: 'rms', preserveDynamics: true },
            { name: 'Sound Design', targetLevel: -1, mode: 'peak', preserveDynamics: false }
        ];
    }

    /**
     * Apply preset to all clips
     */
    applyPreset(presetName) {
        const presets = AudioNormalizationBatch.getPresets();
        const preset = presets.find(p => p.name === presetName);
        
        if (preset) {
            this.targetLevel = preset.targetLevel;
            this.normalizationMode = preset.mode;
            this.preserveDynamics = preset.preserveDynamics;
            
            // Update all clips
            this.clips.forEach(clipData => {
                clipData.targetLevel = preset.targetLevel;
                clipData.mode = preset.mode;
                clipData.preserveDynamics = preset.preserveDynamics;
            });
            
            return true;
        }
        
        return false;
    }

    /**
     * Export normalization report
     */
    exportReport() {
        const report = {
            timestamp: new Date().toISOString(),
            settings: {
                targetLevel: this.targetLevel,
                mode: this.normalizationMode,
                preserveDynamics: this.preserveDynamics
            },
            clips: []
        };
        
        this.clips.forEach((data, id) => {
            report.clips.push({
                id,
                originalPeakDb: data.originalPeakDb,
                originalRmsDb: data.originalRmsDb,
                appliedGain: data.appliedGain,
                status: data.status
            });
        });
        
        return report;
    }
}

// UI Panel for batch normalization
let normalizationPanel = null;

export function openAudioNormalizationBatchPanel(services = {}) {
    if (normalizationPanel) {
        normalizationPanel.remove();
    }
    
    const normalizer = new AudioNormalizationBatch();
    
    const panel = document.createElement('div');
    panel.className = 'snug-window normalization-batch-panel';
    panel.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        width: 600px;
        max-height: 500px;
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
            <h3 style="margin: 0; color: #fff; font-size: 16px;">Audio Normalization Batch</h3>
            <button class="close-btn" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
            ">×</button>
        </div>
        
        <div class="panel-content" style="padding: 16px; overflow-y: auto; max-height: 400px;">
            <div class="settings-row" style="margin-bottom: 16px; display: flex; gap: 12px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 150px;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Target Level (dB)</label>
                    <input type="range" id="targetLevel" min="-30" max="0" step="0.1" value="-3" style="width: 100%;">
                    <span id="targetLevelValue" style="color: #fff; font-size: 12px;">-3 dB</span>
                </div>
                <div style="flex: 1; min-width: 150px;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Mode</label>
                    <select id="normMode" style="
                        width: 100%;
                        background: #2a2a4e;
                        color: #fff;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 6px;
                    ">
                        <option value="peak">Peak</option>
                        <option value="rms">RMS</option>
                    </select>
                </div>
            </div>
            
            <div class="preset-row" style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Preset</label>
                <select id="normPreset" style="
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
            
            <div class="clips-section" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #aaa; font-size: 12px;">Clips (<span id="clipCount">0</span>)</span>
                    <div style="display: flex; gap: 8px;">
                        <button id="addClipsBtn" style="
                            background: #3a3a6e;
                            color: #fff;
                            border: none;
                            border-radius: 4px;
                            padding: 4px 12px;
                            cursor: pointer;
                            font-size: 12px;
                        ">Add Selected Clips</button>
                        <button id="clearClipsBtn" style="
                            background: #6e3a3a;
                            color: #fff;
                            border: none;
                            border-radius: 4px;
                            padding: 4px 12px;
                            cursor: pointer;
                            font-size: 12px;
                        ">Clear</button>
                    </div>
                </div>
                <div id="clipsList" style="
                    background: #0a0a1e;
                    border: 1px solid #333;
                    border-radius: 4px;
                    padding: 8px;
                    min-height: 100px;
                    max-height: 150px;
                    overflow-y: auto;
                ">
                    <div style="color: #666; text-align: center; padding: 20px;">No clips added</div>
                </div>
            </div>
            
            <div class="progress-section" style="margin-bottom: 16px; display: none;" id="progressSection">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: #aaa; font-size: 12px;">Normalizing...</span>
                    <span id="progressText" style="color: #fff; font-size: 12px;">0%</span>
                </div>
                <div style="
                    background: #0a0a1e;
                    border-radius: 4px;
                    height: 8px;
                    overflow: hidden;
                ">
                    <div id="progressBar" style="
                        background: linear-gradient(90deg, #4a9eff, #00ff88);
                        height: 100%;
                        width: 0%;
                        transition: width 0.2s;
                    "></div>
                </div>
            </div>
            
            <div class="actions-row" style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="normalizeAllBtn" style="
                    background: linear-gradient(180deg, #4a9eff 0%, #2a5eff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                ">Normalize All</button>
                <button id="exportReportBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                ">Export Report</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    normalizationPanel = panel;
    
    // Populate presets
    const presetSelect = panel.querySelector('#normPreset');
    const presets = AudioNormalizationBatch.getPresets();
    presets.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        presetSelect.appendChild(option);
    });
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
        normalizationPanel = null;
    });
    
    const targetLevelInput = panel.querySelector('#targetLevel');
    const targetLevelValue = panel.querySelector('#targetLevelValue');
    targetLevelInput.addEventListener('input', () => {
        const value = parseFloat(targetLevelInput.value);
        targetLevelValue.textContent = `${value} dB`;
        normalizer.setTargetLevel(value);
    });
    
    const modeSelect = panel.querySelector('#normMode');
    modeSelect.addEventListener('change', () => {
        normalizer.setNormalizationMode(modeSelect.value);
    });
    
    presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
            normalizer.applyPreset(presetSelect.value);
            const preset = presets.find(p => p.name === presetSelect.value);
            if (preset) {
                targetLevelInput.value = preset.targetLevel;
                targetLevelValue.textContent = `${preset.targetLevel} dB`;
                modeSelect.value = preset.mode;
            }
        }
    });
    
    const clipsList = panel.querySelector('#clipsList');
    const clipCount = panel.querySelector('#clipCount');
    
    const updateClipsList = () => {
        const clips = normalizer.getClips();
        clipCount.textContent = clips.length;
        
        if (clips.length === 0) {
            clipsList.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No clips added</div>';
            return;
        }
        
        clipsList.innerHTML = clips.map(clip => `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 8px;
                border-bottom: 1px solid #222;
            ">
                <span style="color: #fff; font-size: 12px;">${clip.id}</span>
                <div style="display: flex; gap: 12px; font-size: 11px; color: #888;">
                    <span title="Peak">Peak: ${clip.originalPeakDb?.toFixed(1) ?? '--'} dB</span>
                    <span title="RMS">RMS: ${clip.originalRmsDb?.toFixed(1) ?? '--'} dB</span>
                </div>
            </div>
        `).join('');
    };
    
    const addClipsBtn = panel.querySelector('#addClipsBtn');
    addClipsBtn.addEventListener('click', () => {
        // Get selected clips from timeline (if available)
        if (services.getSelectedClips) {
            const selectedClips = services.getSelectedClips();
            selectedClips.forEach(clip => {
                if (clip.audioBuffer) {
                    normalizer.addClip(clip.id, clip.audioBuffer);
                }
            });
            updateClipsList();
        } else {
            // Demo: add dummy clips
            for (let i = 1; i <= 3; i++) {
                const dummyBuffer = createDummyBuffer();
                normalizer.addClip(`clip-${i}`, dummyBuffer);
            }
            updateClipsList();
        }
    });
    
    const clearClipsBtn = panel.querySelector('#clearClipsBtn');
    clearClipsBtn.addEventListener('click', () => {
        normalizer.clearClips();
        updateClipsList();
    });
    
    const progressSection = panel.querySelector('#progressSection');
    const progressBar = panel.querySelector('#progressBar');
    const progressText = panel.querySelector('#progressText');
    const normalizeAllBtn = panel.querySelector('#normalizeAllBtn');
    
    normalizeAllBtn.addEventListener('click', () => {
        const clips = normalizer.getClips();
        if (clips.length === 0) {
            alert('Please add clips to normalize');
            return;
        }
        
        progressSection.style.display = 'block';
        normalizeAllBtn.disabled = true;
        
        const results = normalizer.normalizeAll((progress) => {
            progressBar.style.width = `${progress.progress}%`;
            progressText.textContent = `${Math.round(progress.progress)}% (${progress.current}/${progress.total})`;
        });
        
        // Apply normalized buffers to clips (if service available)
        if (services.applyNormalizedBuffer) {
            results.forEach(result => {
                if (result.success) {
                    const clipData = normalizer.clips.get(result.clipId);
                    services.applyNormalizedBuffer(result.clipId, clipData.normalizedBuffer);
                }
            });
        }
        
        normalizeAllBtn.disabled = false;
        progressSection.style.display = 'none';
        updateClipsList();
        
        console.log('Normalization complete:', results);
    });
    
    const exportReportBtn = panel.querySelector('#exportReportBtn');
    exportReportBtn.addEventListener('click', () => {
        const report = normalizer.exportReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `normalization-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    return panel;
}

// Helper to create dummy buffer for testing
function createDummyBuffer() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = audioContext.createBuffer(2, audioContext.sampleRate * 2, audioContext.sampleRate);
    
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
            // Generate noise with varying levels
            data[i] = (Math.random() * 2 - 1) * (Math.sin(i / 1000) * 0.5 + 0.5);
        }
    }
    
    return buffer;
}

export default AudioNormalizationBatch;