/**
 * Clip Auto-Level - Auto-adjust clip gain for consistent levels
 * Provides automatic gain staging for audio clips
 */

class ClipAutoLevel {
    constructor() {
        this.targetLevel = -14; // LUFS target (broadcast standard)
        this.maxPeak = -3; // dBFS max peak
        this.clips = new Map(); // clipId -> auto-level settings
        this.presets = {
            broadcast: { target: -23, maxPeak: -2, name: 'Broadcast (EBU R128)' },
            streaming: { target: -14, maxPeak: -1, name: 'Streaming (Spotify/Apple)' },
            cd: { target: -12, maxPeak: -0.5, name: 'CD Master' },
            youtube: { target: -14, maxPeak: -1, name: 'YouTube' },
            podcast: { target: -19, maxPeak: -3, name: 'Podcast' },
            film: { target: -24, maxPeak: -2, name: 'Film/Video' },
            custom: { target: -14, maxPeak: -3, name: 'Custom' }
        };
        this.currentPreset = 'streaming';
        this.onProgress = null;
    }

    /**
     * Analyze clip and calculate auto-level settings
     * @param {Object} clip - The clip object with audio data
     * @returns {Object} - Level analysis result
     */
    async analyzeClip(clip) {
        if (!clip || !clip.audioBuffer) {
            return { error: 'No audio buffer in clip' };
        }

        const buffer = clip.audioBuffer;
        const channelData = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;
        
        // Calculate RMS (average power)
        let sumSquares = 0;
        for (let i = 0; i < channelData.length; i++) {
            sumSquares += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sumSquares / channelData.length);
        const rmsDb = 20 * Math.log10(rms);
        
        // Calculate peak
        let peak = 0;
        for (let i = 0; i < channelData.length; i++) {
            const absVal = Math.abs(channelData[i]);
            if (absVal > peak) peak = absVal;
        }
        const peakDb = 20 * Math.log10(peak);
        
        // Calculate LUFS approximation (simplified)
        // Real LUFS requires K-weighting and gating
        const lufs = this.approximateLUFS(channelData, sampleRate);
        
        // Calculate required gain adjustment
        const preset = this.presets[this.currentPreset];
        const targetGain = preset.target - lufs;
        const peakHeadroom = preset.maxPeak - peakDb;
        const safeGain = Math.min(targetGain, peakHeadroom);
        
        return {
            rms: Math.round(rmsDb * 100) / 100,
            peak: Math.round(peakDb * 100) / 100,
            lufs: Math.round(lufs * 100) / 100,
            targetGain: Math.round(safeGain * 100) / 100,
            headroom: Math.round(peakHeadroom * 100) / 100,
            duration: buffer.duration,
            preset: this.currentPreset
        };
    }

    /**
     * Approximate LUFS calculation
     * Simplified version - real LUFS is more complex
     */
    approximateLUFS(channelData, sampleRate) {
        // Apply high-pass shelving filter (K-weighting stage 1)
        const hpCutoff = 38; // Hz
        const hpCoeff = Math.exp(-2 * Math.PI * hpCutoff / sampleRate);
        
        let hpState = 0;
        const hpFiltered = new Float32Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
            hpState = hpCoeff * hpState + channelData[i] * (1 - hpCoeff);
            hpFiltered[i] = channelData[i] - hpState;
        }
        
        // Apply high-shelf boost (K-weighting stage 2)
        const hsCutoff = 1681; // Hz
        const hsGain = 4; // dB
        const hsCoeff = Math.exp(-2 * Math.PI * hsCutoff / sampleRate);
        
        let hsState = 0;
        const weighted = new Float32Array(channelData.length);
        const gainLinear = Math.pow(10, hsGain / 20);
        for (let i = 0; i < channelData.length; i++) {
            hsState = hsCoeff * hsState + hpFiltered[i] * (1 - hsCoeff);
            weighted[i] = hpFiltered[i] + (hpFiltered[i] - hsState) * (gainLinear - 1);
        }
        
        // Calculate integrated loudness (with gating)
        const blockSize = Math.floor(sampleRate * 0.4); // 400ms blocks
        const hopSize = Math.floor(sampleRate * 0.1); // 100ms hop
        const numBlocks = Math.floor((weighted.length - blockSize) / hopSize);
        
        if (numBlocks < 1) {
            // Short signal - just return RMS
            let sumSquares = 0;
            for (let i = 0; i < weighted.length; i++) {
                sumSquares += weighted[i] * weighted[i];
            }
            return 10 * Math.log10(sumSquares / weighted.length) - 0.691;
        }
        
        const blockLoudness = [];
        for (let i = 0; i < numBlocks; i++) {
            const start = i * hopSize;
            let sumSquares = 0;
            for (let j = 0; j < blockSize; j++) {
                sumSquares += weighted[start + j] * weighted[start + j];
            }
            const rms = sumSquares / blockSize;
            if (rms > 0) {
                blockLoudness.push(10 * Math.log10(rms));
            }
        }
        
        // Absolute gate at -70 LUFS
        const gatedBlocks = blockLoudness.filter(l => l > -70);
        if (gatedBlocks.length === 0) return -70;
        
        // Calculate relative gate threshold
        const avgLoudness = gatedBlocks.reduce((a, b) => a + b, 0) / gatedBlocks.length;
        const relativeGate = avgLoudness - 10;
        
        // Apply relative gate
        const relativeGatedBlocks = blockLoudness.filter(l => l > relativeGate);
        if (relativeGatedBlocks.length === 0) return avgLoudness;
        
        const integratedLoudness = relativeGatedBlocks.reduce((a, b) => a + b, 0) / relativeGatedBlocks.length;
        
        return integratedLoudness - 0.691; // Offset for LUFS scale
    }

    /**
     * Apply auto-level to a clip
     * @param {Object} clip - The clip object
     * @param {number} gainAdjustment - Gain to apply in dB
     * @returns {Object} - Result with applied gain
     */
    applyAutoLevel(clip, gainAdjustment) {
        if (!clip) return { error: 'No clip provided' };
        
        // Store auto-level settings
        this.clips.set(clip.id, {
            appliedGain: gainAdjustment,
            timestamp: Date.now(),
            preset: this.currentPreset
        });
        
        // Apply gain to clip
        const gainLinear = Math.pow(10, gainAdjustment / 20);
        
        if (clip.gain !== undefined) {
            clip.gain = (clip.gain || 1) * gainLinear;
        }
        
        return {
            clipId: clip.id,
            appliedGain: gainAdjustment,
            newGainLinear: clip.gain,
            success: true
        };
    }

    /**
     * Auto-level multiple clips at once
     * @param {Array} clips - Array of clips to level
     * @param {boolean} normalizeTogether - Level clips relative to each other
     * @returns {Object} - Batch result
     */
    async batchAutoLevel(clips, normalizeTogether = false) {
        if (!clips || clips.length === 0) {
            return { error: 'No clips provided' };
        }

        const results = [];
        const preset = this.presets[this.currentPreset];

        // Analyze all clips first
        const analyses = [];
        for (let i = 0; i < clips.length; i++) {
            const analysis = await this.analyzeClip(clips[i]);
            analyses.push({ clip: clips[i], analysis, index: i });
            
            if (this.onProgress) {
                this.onProgress({
                    phase: 'analyzing',
                    current: i + 1,
                    total: clips.length
                });
            }
        }

        // Calculate target gain for each
        let loudestClip = null;
        let quietestClip = null;
        
        for (const { clip, analysis } of analyses) {
            if (!analysis.error) {
                if (!loudestClip || analysis.lufs > loudestClip.analysis.lufs) {
                    loudestClip = { clip, analysis };
                }
                if (!quietestClip || analysis.lufs < quietestClip.analysis.lufs) {
                    quietestClip = { clip, analysis };
                }
            }
        }

        // Apply gains
        for (let i = 0; i < analyses.length; i++) {
            const { clip, analysis } = analyses[i];
            
            if (analysis.error) {
                results.push({ clipId: clip.id, error: analysis.error });
                continue;
            }

            let gainAdjustment = analysis.targetGain;
            
            // If normalizing together, use average LUFS as reference
            if (normalizeTogether && analyses.filter(a => !a.analysis.error).length > 1) {
                const validAnalyses = analyses.filter(a => !a.analysis.error);
                const avgLufs = validAnalyses.reduce((sum, a) => sum + a.analysis.lufs, 0) / validAnalyses.length;
                gainAdjustment = preset.target - analysis.lufs;
            }

            const result = this.applyAutoLevel(clip, gainAdjustment);
            results.push(result);
            
            if (this.onProgress) {
                this.onProgress({
                    phase: 'applying',
                    current: i + 1,
                    total: clips.length
                });
            }
        }

        return {
            results,
            preset: this.currentPreset,
            clipsProcessed: results.filter(r => r.success).length,
            clipsFailed: results.filter(r => r.error).length
        };
    }

    /**
     * Set preset
     * @param {string} presetName - Name of preset
     */
    setPreset(presetName) {
        if (this.presets[presetName]) {
            this.currentPreset = presetName;
            return true;
        }
        return false;
    }

    /**
     * Set custom target levels
     * @param {number} target - Target LUFS
     * @param {number} maxPeak - Max peak in dBFS
     */
    setCustomTarget(target, maxPeak) {
        this.presets.custom.target = target;
        this.presets.custom.maxPeak = maxPeak;
        this.currentPreset = 'custom';
    }

    /**
     * Get clip auto-level settings
     * @param {string} clipId - Clip ID
     * @returns {Object} - Auto-level settings
     */
    getClipSettings(clipId) {
        return this.clips.get(clipId) || null;
    }

    /**
     * Remove auto-level from clip
     * @param {string} clipId - Clip ID
     * @returns {boolean} - Whether removal succeeded
     */
    removeAutoLevel(clipId) {
        return this.clips.delete(clipId);
    }

    /**
     * Clear all auto-level settings
     */
    clearAll() {
        this.clips.clear();
    }

    /**
     * Open auto-level panel UI
     */
    openAutoLevelPanel(clips, onApply) {
        const existing = document.getElementById('auto-level-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'auto-level-panel';
        
        const presetOptions = Object.entries(this.presets)
            .map(([key, value]) => `<option value="${key}">${value.name}</option>`)
            .join('');

        panel.innerHTML = `
            <div class="auto-level-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 600px;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">🔊 Clip Auto-Level</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Target Preset</label>
                    <select id="level-preset" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        ${presetOptions}
                    </select>
                </div>

                <div id="custom-levels" style="display: none; margin-bottom: 16px; background: #2a2a4e; padding: 12px; border-radius: 4px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <label style="color: #a0a0a0; font-size: 11px;">Target LUFS</label>
                            <input type="number" id="custom-target" value="${this.presets.custom.target}" step="0.5" min="-40" max="0" 
                                style="width: 100%; margin-top: 4px; padding: 8px; background: #1a1a2e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        </div>
                        <div>
                            <label style="color: #a0a0a0; font-size: 11px;">Max Peak (dBFS)</label>
                            <input type="number" id="custom-peak" value="${this.presets.custom.maxPeak}" step="0.1" min="-12" max="0" 
                                style="width: 100%; margin-top: 4px; padding: 8px; background: #1a1a2e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; font-size: 12px;">
                        <input type="checkbox" id="normalize-together" style="width: 16px; height: 16px;">
                        Normalize clips together (relative to each other)
                    </label>
                </div>

                <div id="level-preview" style="display: none; background: #2a2a4e; padding: 16px; border-radius: 4px; margin-bottom: 16px; max-height: 200px; overflow-y: auto;">
                    <table style="width: 100%; color: #fff; font-size: 12px;">
                        <thead>
                            <tr style="color: #a0a0a0;">
                                <th style="text-align: left; padding: 4px;">Clip</th>
                                <th style="text-align: right; padding: 4px;">Current</th>
                                <th style="text-align: right; padding: 4px;">Peak</th>
                                <th style="text-align: right; padding: 4px;">Gain</th>
                            </tr>
                        </thead>
                        <tbody id="preview-body"></tbody>
                    </table>
                </div>

                <div id="level-progress" style="display: none; background: #2a2a4e; padding: 12px; border-radius: 4px; margin-bottom: 16px;">
                    <div style="color: #a0a0a0; font-size: 12px; margin-bottom: 8px;" id="progress-text">Processing...</div>
                    <div style="background: #1a1a2e; border-radius: 4px; height: 8px; overflow: hidden;">
                        <div id="progress-bar" style="background: #10b981; height: 100%; width: 0%; transition: width 0.3s;"></div>
                    </div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="level-preview-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Preview Analysis
                    </button>
                    <button id="level-apply-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" disabled>
                        Apply to ${clips?.length || 0} Clips
                    </button>
                    <button id="level-close-btn" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #auto-level-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // State
        let previewData = [];

        // Event handlers
        const presetSelect = document.getElementById('level-preset');
        const customLevels = document.getElementById('custom-levels');
        const previewBtn = document.getElementById('level-preview-btn');
        const applyBtn = document.getElementById('level-apply-btn');
        const closeBtn = document.getElementById('level-close-btn');
        const previewDiv = document.getElementById('level-preview');
        const progressDiv = document.getElementById('level-progress');
        const normalizeTogether = document.getElementById('normalize-together');

        // Preset change
        presetSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            this.setPreset(value);
            customLevels.style.display = value === 'custom' ? 'block' : 'none';
            previewDiv.style.display = 'none';
            applyBtn.disabled = true;
        });

        // Custom values
        document.getElementById('custom-target').addEventListener('change', (e) => {
            this.setCustomTarget(parseFloat(e.target.value), this.presets.custom.maxPeak);
        });
        document.getElementById('custom-peak').addEventListener('change', (e) => {
            this.setCustomTarget(this.presets.custom.target, parseFloat(e.target.value));
        });

        // Preview
        previewBtn.addEventListener('click', async () => {
            if (!clips || clips.length === 0) return;

            previewData = [];
            const tbody = document.getElementById('preview-body');
            tbody.innerHTML = '';

            progressDiv.style.display = 'block';
            previewDiv.style.display = 'none';

            this.onProgress = (info) => {
                document.getElementById('progress-text').textContent = 
                    `${info.phase === 'analyzing' ? 'Analyzing' : 'Processing'} clip ${info.current}/${info.total}`;
                document.getElementById('progress-bar').style.width = 
                    `${(info.current / info.total) * 100}%`;
            };

            for (let i = 0; i < clips.length; i++) {
                const analysis = await this.analyzeClip(clips[i]);
                previewData.push({ clip: clips[i], analysis });

                if (!analysis.error) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="padding: 4px; border-top: 1px solid #3b3b5e;">${clips[i].name || `Clip ${i + 1}`}</td>
                        <td style="padding: 4px; border-top: 1px solid #3b3b5e; text-align: right;">${analysis.lufs} LUFS</td>
                        <td style="padding: 4px; border-top: 1px solid #3b3b5e; text-align: right;">${analysis.peak} dB</td>
                        <td style="padding: 4px; border-top: 1px solid #3b3b5e; text-align: right; color: ${analysis.targetGain > 0 ? '#10b981' : '#ef4444'};">
                            ${analysis.targetGain > 0 ? '+' : ''}${analysis.targetGain} dB
                        </td>
                    `;
                    tbody.appendChild(row);
                }
            }

            progressDiv.style.display = 'none';
            previewDiv.style.display = 'block';
            applyBtn.disabled = false;
        });

        // Apply
        applyBtn.addEventListener('click', async () => {
            if (!clips || clips.length === 0) return;

            progressDiv.style.display = 'block';
            document.getElementById('progress-text').textContent = 'Applying levels...';

            const result = await this.batchAutoLevel(clips, normalizeTogether.checked);

            progressDiv.style.display = 'none';

            if (onApply) {
                onApply(result);
            }

            panel.remove();
            style.remove();
        });

        // Close
        closeBtn.addEventListener('click', () => {
            panel.remove();
            style.remove();
        });

        // Initialize
        presetSelect.value = this.currentPreset;
    }
}

// Export singleton
const clipAutoLevel = new ClipAutoLevel();

export { ClipAutoLevel, clipAutoLevel };