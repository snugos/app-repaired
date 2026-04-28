// Auto-Compression - Analyze audio and suggest/apply compression settings
const AutoCompression = (function() {
    'use strict';

    // Compressor parameters presets
    const presets = {
        subtle: { threshold: -20, knee: 10, ratio: 2, attack: 0.01, release: 0.1, makeup: 1.5 },
        moderate: { threshold: -15, knee: 8, ratio: 4, attack: 0.005, release: 0.08, makeup: 3 },
        aggressive: { threshold: -10, knee: 5, ratio: 8, attack: 0.003, release: 0.05, makeup: 5 },
        vocals: { threshold: -18, knee: 12, ratio: 3, attack: 0.008, release: 0.12, makeup: 2.5 },
        drums: { threshold: -12, knee: 6, ratio: 6, attack: 0.002, release: 0.06, makeup: 4 },
        bass: { threshold: -14, knee: 8, ratio: 5, attack: 0.004, release: 0.09, makeup: 3.5 },
        master: { threshold: -8, knee: 4, ratio: 10, attack: 0.001, release: 0.04, makeup: 6 }
    };

    // Analyze audio buffer and estimate optimal compression parameters
    function analyzeAudioBuffer(audioBuffer) {
        if (!audioBuffer || !audioBuffer.getChannelData) return presets.subtle;
        
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        
        // Calculate RMS and peak values
        let rms = 0;
        let peak = 0;
        let maxAbs = 0;
        
        const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
        const windows = [];
        
        for (let i = 0; i < channelData.length; i++) {
            const sample = Math.abs(channelData[i]);
            rms += channelData[i] * channelData[i];
            if (sample > peak) peak = sample;
            if (sample > maxAbs) maxAbs = sample;
        }
        
        rms = Math.sqrt(rms / channelData.length);
        const dynamicRange = 20 * Math.log10(maxAbs / (rms + 0.0001));
        
        // Determine preset based on dynamic range
        if (dynamicRange < 6) return presets.subtle;
        if (dynamicRange < 12) return presets.moderate;
        return presets.aggressive;
    }

    // Get waveform data for visualization (simplified)
    function getWaveformData(audioBuffer, points = 100) {
        if (!audioBuffer || !audioBuffer.getChannelData) return [];
        
        const channelData = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channelData.length / points);
        const waveform = [];
        
        for (let i = 0; i < points; i++) {
            let max = 0;
            for (let j = 0; j < blockSize; j++) {
                const sample = Math.abs(channelData[i * blockSize + j] || 0);
                if (sample > max) max = sample;
            }
            waveform.push(max);
        }
        
        return waveform;
    }

    // Create compressor node with specified parameters
    function createCompressorNode(context, params) {
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = params.threshold;
        compressor.knee.value = params.knee;
        compressor.ratio.value = params.ratio;
        compressor.attack.value = params.attack;
        compressor.release.value = params.release;
        return compressor;
    }

    // Apply compression to a track
    function applyCompressionToTrack(trackId, presetName = 'moderate', intensity = 1) {
        const track = getTrackById(trackId);
        if (!track) return { success: false, error: 'Track not found' };
        
        const preset = presets[presetName] || presets.subtle;
        
        // Scale parameters by intensity (0.5 to 1.5)
        const scale = 0.5 + (intensity * 0.5);
        const params = {
            threshold: preset.threshold,
            knee: preset.knee,
            ratio: preset.ratio * scale,
            attack: preset.attack,
            release: preset.release,
            makeup: preset.makeup
        };
        
        // Create compressor node
        const context = Tone.getContext().rawContext;
        const compressor = createCompressorNode(context, params);
        
        // Connect: track output -> compressor -> destination
        const trackOutput = track.gainNode || track.output;
        if (trackOutput) {
            trackOutput.disconnect();
            trackOutput.connect(compressor);
            compressor.connect(Tone.getDestination());
            
            // Store compressor on track for later removal
            if (!track.effects) track.effects = [];
            track.effects.push({ type: 'compressor', node: compressor, params });
            
            return { success: true, preset: presetName, params };
        }
        
        return { success: false, error: 'Could not connect compressor' };
    }

    // Remove compression from a track
    function removeCompressionFromTrack(trackId) {
        const track = getTrackById(trackId);
        if (!track || !track.effects) return { success: false };
        
        const compIndex = track.effects.findIndex(e => e.type === 'compressor');
        if (compIndex === -1) return { success: false };
        
        const comp = track.effects[compIndex];
        if (comp.node) {
            comp.node.disconnect();
        }
        track.effects.splice(compIndex, 1);
        
        return { success: true };
    }

    // Get compression info for a track
    function getCompressionInfo(trackId) {
        const track = getTrackById(trackId);
        if (!track || !track.effects) return null;
        
        const comp = track.effects.find(e => e.type === 'compressor');
        if (!comp) return null;
        
        return {
            active: true,
            preset: detectPreset(comp.params),
            params: comp.params
        };
    }

    // Detect which preset best matches the given parameters
    function detectPreset(params) {
        let bestMatch = 'subtle';
        let bestScore = Infinity;
        
        for (const [name, preset] of Object.entries(presets)) {
            let score = 0;
            score += Math.abs(preset.threshold - params.threshold);
            score += Math.abs(preset.ratio - params.ratio);
            score += Math.abs(preset.makeup - params.makeup);
            
            if (score < bestScore) {
                bestScore = score;
                bestMatch = name;
            }
        }
        
        return bestMatch;
    }

    // Open compression panel UI
    function openCompressionPanel() {
        const panelId = 'autoCompressionPanel';
        let panel = document.getElementById(panelId);
        
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            return;
        }
        
        panel = document.createElement('div');
        panel.id = panelId;
        panel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 320px;
            background: rgba(20, 20, 25, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 16px;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            z-index: 1000;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 600; font-size: 14px;">Auto-Compression</span>
                <button id="closeCompressionPanel" style="background: none; border: none; color: #888; cursor: pointer; font-size: 18px;">&times;</button>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; color: #aaa;">Select Track</label>
                <select id="compTrackSelect" style="width: 100%; padding: 6px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    ${getTrackIds().map(id => {
                        const t = getTrackById(id);
                        return `<option value="${id}">${t ? t.name : id}</option>`;
                    }).join('')}
                </select>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; color: #aaa;">Preset</label>
                <select id="compPresetSelect" style="width: 100%; padding: 6px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
                    <option value="subtle">Subtle</option>
                    <option value="moderate" selected>Moderate</option>
                    <option value="aggressive">Aggressive</option>
                    <option value="vocals">Vocals</option>
                    <option value="drums">Drums</option>
                    <option value="bass">Bass</option>
                    <option value="master">Master</option>
                </select>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; color: #aaa;">Intensity: <span id="compIntensityVal">1.0</span></label>
                <input type="range" id="compIntensity" min="0.5" max="1.5" step="0.1" value="1" 
                    style="width: 100%;" oninput="document.getElementById('compIntensityVal').textContent = this.value">
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="applyCompBtn" style="flex: 1; padding: 8px; background: #3a7bd5; border: none; color: #fff; border-radius: 4px; cursor: pointer;">Apply</button>
                <button id="removeCompBtn" style="flex: 1; padding: 8px; background: #444; border: none; color: #fff; border-radius: 4px; cursor: pointer;">Remove</button>
            </div>
            <div id="compStatus" style="margin-top: 10px; font-size: 12px; color: #888;"></div>
        `;
        
        document.body.appendChild(panel);
        
        document.getElementById('closeCompressionPanel').onclick = () => {
            panel.style.display = 'none';
        };
        
        document.getElementById('applyCompBtn').onclick = () => {
            const trackId = document.getElementById('compTrackSelect').value;
            const preset = document.getElementById('compPresetSelect').value;
            const intensity = parseFloat(document.getElementById('compIntensity').value);
            
            const result = applyCompressionToTrack(trackId, preset, intensity);
            const statusEl = document.getElementById('compStatus');
            
            if (result.success) {
                statusEl.innerHTML = `<span style="color: #4a4;">Applied ${preset} compression to track</span>`;
            } else {
                statusEl.innerHTML = `<span style="color: #a44;">${result.error}</span>`;
            }
        };
        
        document.getElementById('removeCompBtn').onclick = () => {
            const trackId = document.getElementById('compTrackSelect').value;
            const result = removeCompressionFromTrack(trackId);
            const statusEl = document.getElementById('compStatus');
            
            statusEl.innerHTML = result.success 
                ? `<span style="color: #4a4;">Compression removed</span>`
                : `<span style="color: #a44;">No compression found</span>`;
        };
    }

    // Helper: get all track IDs
    function getTrackIds() {
        const tracks = getTracksState();
        return tracks ? tracks.map(t => t.id) : [];
    }

    // Helper: get track by ID
    function getTrackById(trackId) {
        const tracks = getTracksState();
        return tracks ? tracks.find(t => t.id === trackId) : null;
    }

    // Public API
    return {
        analyzeAudioBuffer,
        getWaveformData,
        presets,
        applyCompressionToTrack,
        removeCompressionFromTrack,
        getCompressionInfo,
        openCompressionPanel
    };
})();

// Make available globally
window.AutoCompression = AutoCompression;