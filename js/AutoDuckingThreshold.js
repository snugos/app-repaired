// js/AutoDuckingThreshold.js - Auto threshold detection for auto-ducking
// Analyzes source track audio to suggest optimal ducking threshold

let localAppServices = {};
let analyserNodes = new Map(); // trackId -> analyser

/**
 * Initialize the auto threshold module
 * @param {Object} services - App services
 */
export function initAutoDuckingThreshold(services) {
    localAppServices = services || {};
    console.log('[AutoDuckingThreshold] Initialized');
}

/**
 * Analyze source track audio and return recommended threshold
 * @param {number} trackId - Source track ID to analyze
 * @returns {Promise<{threshold: number, peakDb: number, rmsDb: number, dynamicRange: number}>}
 */
export async function analyzeTrackForThreshold(trackId) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        console.warn('[AutoDuckingThreshold] Track not found:', trackId);
        return { threshold: -30, peakDb: -10, rmsDb: -20, dynamicRange: 10 };
    }

    try {
        // Get audio data from track
        const audioData = await getTrackAudioData(track);
        if (!audioData || audioData.length === 0) {
            console.log('[AutoDuckingThreshold] No audio data found, using defaults');
            return { threshold: -30, peakDb: -10, rmsDb: -20, dynamicRange: 10 };
        }

        // Calculate peak and RMS levels
        let peakValue = 0;
        let sumSquares = 0;
        let sampleCount = 0;

        for (const channel of audioData) {
            for (const sample of channel) {
                const abs = Math.abs(sample);
                if (abs > peakValue) peakValue = abs;
                sumSquares += sample * sample;
                sampleCount++;
            }
        }

        const peakDb = 20 * Math.log10(peakValue || 0.0001);
        const rmsDb = 20 * Math.log10(Math.sqrt(sumSquares / sampleCount) || 0.0001);
        const dynamicRange = peakDb - rmsDb;

        // Suggest threshold: typically 6-12dB below RMS for natural ducking
        // For punchier ducking, go closer to RMS; for subtle, go lower
        const suggestedThreshold = Math.round(rmsDb - 8);

        return {
            threshold: Math.max(-60, Math.min(0, suggestedThreshold)),
            peakDb: Math.round(peakDb * 10) / 10,
            rmsDb: Math.round(rmsDb * 10) / 10,
            dynamicRange: Math.round(dynamicRange * 10) / 10
        };
    } catch (error) {
        console.error('[AutoDuckingThreshold] Analysis error:', error);
        return { threshold: -30, peakDb: -10, rmsDb: -20, dynamicRange: 10 };
    }
}

/**
 * Get audio data from a track for analysis
 * @param {Object} track - Track object
 * @returns {Promise<Float32Array[]>} Array of channel data
 */
async function getTrackAudioData(track) {
    // Try to get audio buffer from track
    if (track.audioBuffer && track.audioBuffer.numberOfChannels) {
        const channels = [];
        for (let i = 0; i < track.audioBuffer.numberOfChannels; i++) {
            channels.push(track.audioBuffer.getChannelData(i));
        }
        return channels;
    }

    // Try clips
    if (track.clips && track.clips.length > 0) {
        for (const clip of track.clips) {
            if (clip.audioBuffer && clip.audioBuffer.numberOfChannels) {
                const channels = [];
                for (let i = 0; i < clip.audioBuffer.numberOfChannels; i++) {
                    channels.push(clip.audioBuffer.getChannelData(i));
                }
                return channels;
            }
            // Check for buffer in clip
            if (clip.buffer && clip.buffer.numberOfChannels) {
                const channels = [];
                for (let i = 0; i < clip.buffer.numberOfChannels; i++) {
                    channels.push(clip.buffer.getChannelData(i));
                }
                return channels;
            }
        }
    }

    return [];
}

/**
 * Calculate optimal threshold based on track content analysis
 * @param {number} trackId - Source track ID
 * @param {string} mode - 'subtle', 'natural', 'punchy'
 * @returns {Promise<number>} Recommended threshold in dB
 */
export async function getOptimalThreshold(trackId, mode = 'natural') {
    const analysis = await analyzeTrackForThreshold(trackId);

    const offset = {
        'subtle': 12,
        'natural': 8,
        'punchy': 4
    };

    const suggestedThreshold = analysis.rmsDb - (offset[mode] || 8);
    return Math.max(-60, Math.min(0, Math.round(suggestedThreshold)));
}

/**
 * Open the auto threshold panel
 * @param {number} trackId - Track to analyze
 */
export function openAutoThresholdPanel(trackId) {
    const windowId = `autoThreshold_${trackId}`;
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderThresholdPanel(trackId);
        return win;
    }

    const content = document.createElement('div');
    content.id = `autoThresholdContent_${trackId}`;
    content.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';

    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, `Auto Threshold`, content, {
        width: 350, height: 320, minWidth: 300, minHeight: 280
    }) : null;

    if (win?.element) {
        setTimeout(() => renderThresholdPanel(trackId), 50);
    }

    return win;
}

/**
 * Render the threshold analysis panel
 */
function renderThresholdPanel(trackId) {
    const container = document.getElementById(`autoThresholdContent_${trackId}`);
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const trackOptions = tracks.map(t =>
        `<option value="${t.id}" ${t.id === trackId ? 'selected' : ''}>${t.name}</option>`
    ).join('');

    container.innerHTML = `
        <div class="mb-4">
            <h3 class="text-sm font-bold mb-2 text-indigo-400">Auto Threshold Detection</h3>
            <p class="text-xs text-gray-400">Analyzes source track to find optimal ducking threshold.</p>
        </div>

        <div class="space-y-4">
            <div>
                <label class="block text-xs text-gray-400 mb-1">Source Track</label>
                <select id="thresholdTrackSelect" class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm">
                    ${trackOptions}
                </select>
            </div>

            <div>
                <label class="block text-xs text-gray-400 mb-1">Ducking Style</label>
                <select id="thresholdStyle" class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm">
                    <option value="subtle">Subtle (12dB below RMS)</option>
                    <option value="natural" selected>Natural (8dB below RMS)</option>
                    <option value="punchy">Punchy (4dB below RMS)</option>
                </select>
            </div>

            <div class="bg-gray-800 rounded p-3">
                <div class="text-xs text-gray-400 mb-2">Analysis Results</div>
                <div id="analysisResults" class="text-sm">
                    <div class="flex justify-between mb-1">
                        <span class="text-gray-400">Peak:</span>
                        <span id="peakValue" class="text-white">-- dB</span>
                    </div>
                    <div class="flex justify-between mb-1">
                        <span class="text-gray-400">RMS:</span>
                        <span id="rmsValue" class="text-white">-- dB</span>
                    </div>
                    <div class="flex justify-between mb-1">
                        <span class="text-gray-400">Dynamic Range:</span>
                        <span id="dynamicValue" class="text-white">-- dB</span>
                    </div>
                    <div class="flex justify-between pt-2 border-t border-gray-700">
                        <span class="text-indigo-400">Suggested Threshold:</span>
                        <span id="suggestedThreshold" class="text-indigo-300 font-bold">-- dB</span>
                    </div>
                </div>
            </div>

            <button id="analyzeBtn" class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white text-sm font-medium">
                Analyze Track
            </button>
        </div>
    `;

    document.getElementById('thresholdTrackSelect')?.addEventListener('change', (e) => {
        const newTrackId = parseInt(e.target.value);
        renderThresholdPanel(newTrackId);
    });

    document.getElementById('analyzeBtn')?.addEventListener('click', async () => {
        const selectedTrackId = parseInt(document.getElementById('thresholdTrackSelect').value);
        const style = document.getElementById('thresholdStyle').value;

        const btn = document.getElementById('analyzeBtn');
        btn.textContent = 'Analyzing...';
        btn.disabled = true;

        try {
            const analysis = await analyzeTrackForThreshold(selectedTrackId);
            const optimal = await getOptimalThreshold(selectedTrackId, style);

            document.getElementById('peakValue').textContent = `${analysis.peakDb} dB`;
            document.getElementById('rmsValue').textContent = `${analysis.rmsDb} dB`;
            document.getElementById('dynamicValue').textContent = `${analysis.dynamicRange} dB`;
            document.getElementById('suggestedThreshold').textContent = `${optimal} dB`;

            // Apply to auto-ducking config if available
            if (localAppServices.getDuckingConfigForTrack) {
                const currentConfig = localAppServices.getDuckingConfigForTrack(selectedTrackId);
                if (currentConfig) {
                    const { setDuckingConfig } = await import('./AutoDucking.js');
                    setDuckingConfig(selectedTrackId, { ...currentConfig, threshold: optimal });
                    if (localAppServices.showNotification) {
                        localAppServices.showNotification(`Applied optimal threshold: ${optimal}dB`, 2000);
                    }
                }
            }
        } catch (error) {
            console.error('[AutoDuckingThreshold] Analysis failed:', error);
            if (localAppServices.showNotification) {
                localAppServices.showNotification('Analysis failed', 1500);
            }
        } finally {
            btn.textContent = 'Analyze Track';
            btn.disabled = false;
        }
    });

    // Auto-run analysis on load
    document.getElementById('analyzeBtn')?.click();
}

export default {
    initAutoDuckingThreshold,
    analyzeTrackForThreshold,
    getOptimalThreshold,
    openAutoThresholdPanel
};