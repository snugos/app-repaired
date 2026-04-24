/**
 * Clip Transpose Batch
 * Transpose multiple clips at once with semitone and octave adjustment
 */

export class ClipTransposeBatch {
    constructor() {
        this.clips = new Map(); // clipId -> { originalPitch, transpose, enabled }
        this.globalTranspose = 0; // Semitones
        this.globalOctave = 0;
        this.preserveFormants = false;
        this.useHighQuality = true;
    }

    /**
     * Add a clip to the batch
     */
    addClip(clipId, clipData = {}) {
        this.clips.set(clipId, {
            originalPitch: clipData.originalPitch ?? 0,
            transpose: clipData.transpose ?? 0,
            octave: clipData.octave ?? 0,
            enabled: true,
            type: clipData.type ?? 'audio', // 'audio' or 'midi'
            notes: clipData.notes ?? null, // For MIDI clips
            audioBuffer: clipData.audioBuffer ?? null // For audio clips
        });
        return this.clips.get(clipId);
    }

    /**
     * Remove a clip from the batch
     */
    removeClip(clipId) {
        return this.clips.delete(clipId);
    }

    /**
     * Clear all clips
     */
    clearClips() {
        this.clips.clear();
    }

    /**
     * Get all clips
     */
    getClips() {
        return Array.from(this.clips.entries()).map(([id, data]) => ({
            id,
            ...data
        }));
    }

    /**
     * Set global transpose value (semitones)
     */
    setGlobalTranspose(semitones) {
        this.globalTranspose = Math.max(-24, Math.min(24, semitones));
    }

    /**
     * Set global octave shift
     */
    setGlobalOctave(octaves) {
        this.globalOctave = Math.max(-3, Math.min(3, octaves));
    }

    /**
     * Set per-clip transpose
     */
    setClipTranspose(clipId, semitones) {
        const clip = this.clips.get(clipId);
        if (clip) {
            clip.transpose = Math.max(-24, Math.min(24, semitones));
        }
    }

    /**
     * Set per-clip octave
     */
    setClipOctave(clipId, octaves) {
        const clip = this.clips.get(clipId);
        if (clip) {
            clip.octave = Math.max(-3, Math.min(3, octaves));
        }
    }

    /**
     * Get total transpose for a clip (global + local)
     */
    getTotalTranspose(clipId) {
        const clip = this.clips.get(clipId);
        if (!clip) return 0;
        
        return this.globalTranspose + (this.globalOctave * 12) + clip.transpose + (clip.octave * 12);
    }

    /**
     * Transpose a MIDI clip
     */
    transposeMIDIClip(clipId) {
        const clip = this.clips.get(clipId);
        if (!clip || !clip.notes) return null;
        
        const totalTranspose = this.getTotalTranspose(clipId);
        if (totalTranspose === 0) return clip.notes;
        
        // Create transposed copy of notes
        return clip.notes.map(note => ({
            ...note,
            noteNumber: Math.max(0, Math.min(127, note.noteNumber + totalTranspose))
        }));
    }

    /**
     * Transpose an audio clip using pitch shifting
     */
    transposeAudioClip(clipId, audioContext = null) {
        const clip = this.clips.get(clipId);
        if (!clip || !clip.audioBuffer) return null;
        
        const totalTranspose = this.getTotalTranspose(clipId);
        if (totalTranspose === 0) return clip.audioBuffer;
        
        // Create pitch-shifted version using simple resampling
        const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        const buffer = clip.audioBuffer;
        
        // Calculate pitch shift ratio
        const pitchRatio = Math.pow(2, totalTranspose / 12);
        
        // Create new buffer with adjusted length
        const newLength = Math.round(buffer.length / pitchRatio);
        const newBuffer = ctx.createBuffer(
            buffer.numberOfChannels,
            newLength,
            buffer.sampleRate
        );
        
        // Resample each channel
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const sourceData = buffer.getChannelData(ch);
            const destData = newBuffer.getChannelData(ch);
            
            for (let i = 0; i < newLength; i++) {
                const sourceIndex = i * pitchRatio;
                const index = Math.floor(sourceIndex);
                const fraction = sourceIndex - index;
                
                // Linear interpolation
                if (index + 1 < sourceData.length) {
                    destData[i] = sourceData[index] * (1 - fraction) + 
                                  sourceData[index + 1] * fraction;
                } else {
                    destData[i] = sourceData[Math.min(index, sourceData.length - 1)];
                }
            }
        }
        
        return newBuffer;
    }

    /**
     * Transpose all clips
     */
    transposeAll(progressCallback = null) {
        const results = [];
        const clipIds = Array.from(this.clips.keys());
        const total = clipIds.length;
        
        clipIds.forEach((clipId, index) => {
            const clip = this.clips.get(clipId);
            let success = false;
            let transposedData = null;
            
            if (clip.enabled) {
                if (clip.type === 'midi') {
                    transposedData = this.transposeMIDIClip(clipId);
                    success = transposedData !== null;
                } else if (clip.type === 'audio') {
                    transposedData = this.transposeAudioClip(clipId);
                    success = transposedData !== null;
                }
            }
            
            results.push({
                clipId,
                success,
                totalTranspose: this.getTotalTranspose(clipId),
                transposedData
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
     * Get transpose presets
     */
    static getPresets() {
        return [
            { name: 'Octave Up', transpose: 0, octave: 1 },
            { name: 'Octave Down', transpose: 0, octave: -1 },
            { name: 'Fifth Up', transpose: 7, octave: 0 },
            { name: 'Fourth Up', transpose: 5, octave: 0 },
            { name: 'Major Third Up', transpose: 4, octave: 0 },
            { name: 'Minor Third Up', transpose: 3, octave: 0 },
            { name: 'Whole Step Up', transpose: 2, octave: 0 },
            { name: 'Half Step Up', transpose: 1, octave: 0 },
            { name: 'Half Step Down', transpose: -1, octave: 0 },
            { name: 'Whole Step Down', transpose: -2, octave: 0 },
            { name: 'Tritone Up', transpose: 6, octave: 0 },
            { name: 'Double Octave Up', transpose: 0, octave: 2 },
            { name: 'Double Octave Down', transpose: 0, octave: -2 }
        ];
    }

    /**
     * Apply a preset
     */
    applyPreset(presetName) {
        const presets = ClipTransposeBatch.getPresets();
        const preset = presets.find(p => p.name === presetName);
        
        if (preset) {
            this.globalTranspose = preset.transpose;
            this.globalOctave = preset.octave;
            return true;
        }
        
        return false;
    }

    /**
     * Reset all transpose values
     */
    reset() {
        this.globalTranspose = 0;
        this.globalOctave = 0;
        this.clips.forEach(clip => {
            clip.transpose = 0;
            clip.octave = 0;
        });
    }

    /**
     * Export batch settings
     */
    exportSettings() {
        return {
            globalTranspose: this.globalTranspose,
            globalOctave: this.globalOctave,
            preserveFormants: this.preserveFormants,
            useHighQuality: this.useHighQuality,
            clips: Array.from(this.clips.entries()).map(([id, data]) => ({
                id,
                transpose: data.transpose,
                octave: data.octave,
                enabled: data.enabled
            }))
        };
    }

    /**
     * Import batch settings
     */
    importSettings(settings) {
        if (settings.globalTranspose !== undefined) {
            this.globalTranspose = settings.globalTranspose;
        }
        if (settings.globalOctave !== undefined) {
            this.globalOctave = settings.globalOctave;
        }
        if (settings.preserveFormants !== undefined) {
            this.preserveFormants = settings.preserveFormants;
        }
        if (settings.useHighQuality !== undefined) {
            this.useHighQuality = settings.useHighQuality;
        }
        if (settings.clips) {
            settings.clips.forEach(clip => {
                const existing = this.clips.get(clip.id);
                if (existing) {
                    existing.transpose = clip.transpose;
                    existing.octave = clip.octave;
                    existing.enabled = clip.enabled;
                }
            });
        }
    }
}

// UI Panel for batch transpose
let transposeBatchPanel = null;

export function openClipTransposeBatchPanel(services = {}) {
    if (transposeBatchPanel) {
        transposeBatchPanel.remove();
    }
    
    const batch = new ClipTransposeBatch();
    
    const panel = document.createElement('div');
    panel.className = 'snug-window transpose-batch-panel';
    panel.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        width: 550px;
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
            <h3 style="margin: 0; color: #fff; font-size: 16px;">Clip Transpose Batch</h3>
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
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Preset</label>
                <select id="transposePreset" style="
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
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Semitones</label>
                    <input type="range" id="globalTranspose" min="-24" max="24" value="0" style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; color: #fff; font-size: 12px;">
                        <span>-24</span>
                        <span id="transposeValue">0</span>
                        <span>+24</span>
                    </div>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Octaves</label>
                    <input type="range" id="globalOctave" min="-3" max="3" value="0" style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; color: #fff; font-size: 12px;">
                        <span>-3</span>
                        <span id="octaveValue">0</span>
                        <span>+3</span>
                    </div>
                </div>
            </div>
            
            <div id="quickButtons" style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
                <button data-transpose="-12" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">-Oct</button>
                <button data-transpose="-7" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">-5th</button>
                <button data-transpose="-1" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">-½</button>
                <button data-transpose="0" style="background: #4a4a8e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">Reset</button>
                <button data-transpose="1" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">+½</button>
                <button data-transpose="7" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">+5th</button>
                <button data-transpose="12" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">+Oct</button>
            </div>
            
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: #aaa; font-size: 12px;">Clips (<span id="clipCount">0</span>)</span>
                    <div style="display: flex; gap: 8px;">
                        <button id="addClipsBtn" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 12px;">Add Selected</button>
                        <button id="clearClipsBtn" style="background: #6e3a3a; color: #fff; border: none; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 12px;">Clear</button>
                    </div>
                </div>
                <div id="clipsList" style="
                    background: #0a0a1e;
                    border: 1px solid #333;
                    border-radius: 4px;
                    padding: 8px;
                    min-height: 80px;
                    max-height: 150px;
                    overflow-y: auto;
                ">
                    <div style="color: #666; text-align: center; padding: 20px;">No clips added</div>
                </div>
            </div>
            
            <div style="background: #0a0a1e; border: 1px solid #333; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; color: #fff; font-size: 14px;">
                    <span>Total Transpose:</span>
                    <span id="totalTranspose" style="color: #4a9eff; font-weight: bold;">0 semitones</span>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="transposeAllBtn" style="
                    background: linear-gradient(180deg, #4a9eff 0%, #2a5eff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                ">Transpose All</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    transposeBatchPanel = panel;
    
    // Populate presets
    const presetSelect = panel.querySelector('#transposePreset');
    const presets = ClipTransposeBatch.getPresets();
    presets.forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        presetSelect.appendChild(option);
    });
    
    // Get elements
    const globalTransposeInput = panel.querySelector('#globalTranspose');
    const globalOctaveInput = panel.querySelector('#globalOctave');
    const transposeValueSpan = panel.querySelector('#transposeValue');
    const octaveValueSpan = panel.querySelector('#octaveValue');
    const totalTransposeSpan = panel.querySelector('#totalTranspose');
    const clipsList = panel.querySelector('#clipsList');
    const clipCount = panel.querySelector('#clipCount');
    
    // Update total transpose display
    const updateTotalDisplay = () => {
        const total = batch.globalTranspose + (batch.globalOctave * 12);
        const sign = total >= 0 ? '+' : '';
        const octaveText = batch.globalOctave !== 0 ? ` (${batch.globalOctave > 0 ? '+' : ''}${batch.globalOctave} octave${Math.abs(batch.globalOctave) > 1 ? 's' : ''})` : '';
        totalTransposeSpan.textContent = `${sign}${total} semitones${octaveText}`;
    };
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
        transposeBatchPanel = null;
    });
    
    presetSelect.addEventListener('change', () => {
        if (presetSelect.value) {
            batch.applyPreset(presetSelect.value);
            globalTransposeInput.value = batch.globalTranspose;
            globalOctaveInput.value = batch.globalOctave;
            transposeValueSpan.textContent = batch.globalTranspose;
            octaveValueSpan.textContent = batch.globalOctave;
            updateTotalDisplay();
        }
    });
    
    globalTransposeInput.addEventListener('input', () => {
        const value = parseInt(globalTransposeInput.value);
        batch.setGlobalTranspose(value);
        transposeValueSpan.textContent = value;
        updateTotalDisplay();
    });
    
    globalOctaveInput.addEventListener('input', () => {
        const value = parseInt(globalOctaveInput.value);
        batch.setGlobalOctave(value);
        octaveValueSpan.textContent = value;
        updateTotalDisplay();
    });
    
    // Quick buttons
    const quickButtons = panel.querySelectorAll('#quickButtons button');
    quickButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const transpose = parseInt(btn.dataset.transpose);
            if (transpose === 0) {
                batch.reset();
            } else {
                batch.setGlobalTranspose(transpose);
            }
            globalTransposeInput.value = batch.globalTranspose;
            globalOctaveInput.value = batch.globalOctave;
            transposeValueSpan.textContent = batch.globalTranspose;
            octaveValueSpan.textContent = batch.globalOctave;
            updateTotalDisplay();
        });
    });
    
    // Update clips list
    const updateClipsList = () => {
        const clips = batch.getClips();
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
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" ${clip.enabled ? 'checked' : ''} data-clip-id="${clip.id}" style="accent-color: #4a9eff;">
                    <span style="color: #fff; font-size: 12px;">${clip.id}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 11px;">
                    <span style="color: #888;">${clip.type}</span>
                    <span style="color: #4a9eff;">${batch.getTotalTranspose(clip.id)} st</span>
                </div>
            </div>
        `).join('');
    };
    
    const addClipsBtn = panel.querySelector('#addClipsBtn');
    addClipsBtn.addEventListener('click', () => {
        // Get selected clips from timeline
        if (services.getSelectedClips) {
            const selectedClips = services.getSelectedClips();
            selectedClips.forEach(clip => {
                batch.addClip(clip.id, {
                    type: clip.type,
                    notes: clip.notes,
                    audioBuffer: clip.audioBuffer
                });
            });
        } else {
            // Demo: add dummy clips
            batch.addClip('audio-1', { type: 'audio' });
            batch.addClip('midi-1', { type: 'midi' });
            batch.addClip('audio-2', { type: 'audio' });
        }
        updateClipsList();
    });
    
    const clearClipsBtn = panel.querySelector('#clearClipsBtn');
    clearClipsBtn.addEventListener('click', () => {
        batch.clearClips();
        updateClipsList();
    });
    
    // Transpose all button
    const transposeAllBtn = panel.querySelector('#transposeAllBtn');
    transposeAllBtn.addEventListener('click', () => {
        const results = batch.transposeAll();
        
        // Apply transposed data
        if (services.applyTransposedClip) {
            results.forEach(result => {
                if (result.success && result.transposedData) {
                    services.applyTransposedClip(result.clipId, result.transposedData);
                }
            });
        }
        
        console.log('Transpose complete:', results);
    });
    
    return panel;
}

export default ClipTransposeBatch;