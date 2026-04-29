// js/DrumReplace.js - Drum Replace Feature
// Replace detected drum hits in recorded audio with samples from a library

let localAppServices = {};
let detectedHits = []; // Array of {time, duration, confidence, replacedWith}
let isAnalyzing = false;
let currentDrumReplaceTrackId = null;

export function initDrumReplace(services) {
    localAppServices = services;
    console.log('[DrumReplace] Initialized');
}

/**
 * Open the Drum Replace panel for a track
 * @param {number|null} trackId - Track ID to analyze (uses selected track if null)
 */
export function openDrumReplacePanel(trackId = null) {
    const windowId = 'drumReplace';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !trackId) {
        const win = openWindows.get(windowId);
        win.restore();
        renderDrumReplaceContent();
        return win;
    }

    // Get the track to analyze
    const targetTrackId = trackId || currentDrumReplaceTrackId || localAppServices.getTracks?.()?.[0]?.id;
    if (!targetTrackId) {
        localAppServices.showNotification?.('No track available for drum replace', 2000);
        return null;
    }
    currentDrumReplaceTrackId = targetTrackId;

    const contentContainer = document.createElement('div');
    contentContainer.id = 'drumReplaceContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = { 
        width: 500, 
        height: 600, 
        minWidth: 400, 
        minHeight: 500, 
        initialContentKey: windowId, 
        closable: true, 
        minimizable: true, 
        resizable: true 
    };
    
    const win = localAppServices.createWindow(windowId, 'Drum Replace', contentContainer, options);
    if (win?.element) {
        renderDrumReplaceContent();
    }
    return win;
}

function renderDrumReplaceContent() {
    const container = document.getElementById('drumReplaceContent');
    if (!container) return;

    const track = currentDrumReplaceTrackId ? localAppServices.getTrackById?.(currentDrumReplaceTrackId) : null;
    const tracks = localAppServices.getTracks?.() || [];
    
    // Get available drum tracks (DrumSampler type) for sample source
    const drumTracks = tracks.filter(t => t.type === 'DrumSampler' || t.type === 'Sampler');
    
    let html = `
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Drum Replace</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Analyze audio clips to detect drum hits, then replace them with samples from your library.
            </p>
        </div>
        
        <!-- Track Selection -->
        <div class="mb-4">
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Track to Analyze</label>
            <select id="drumReplaceTrackSelect" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded text-gray-700 dark:text-gray-200">
                ${tracks.filter(t => t.type === 'Audio').map(t => 
                    `<option value="${t.id}" ${t.id === currentDrumReplaceTrackId ? 'selected' : ''}>${t.name}</option>`
                ).join('')}
            </select>
        </div>
        
        <!-- Analyze Section -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Detection Settings</h4>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs text-gray-500">Threshold: <span id="thresholdVal">30%</span></label>
                    <input type="range" id="drumReplaceThreshold" min="0" max="100" value="30" class="w-full">
                </div>
                <div>
                    <label class="text-xs text-gray-500">Min Gap: <span id="minGapVal">0.1s</span></label>
                    <input type="range" id="drumReplaceMinGap" min="50" max="500" value="100" class="w-full">
                </div>
            </div>
            <div class="flex gap-2 mt-3">
                <button id="analyzeDrumBtn" class="flex-1 px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
                    Analyze Audio
                </button>
                <button id="clearDrumAnalysisBtn" class="px-3 py-2 text-xs bg-gray-400 text-white rounded hover:bg-gray-500">
                    Clear
                </button>
            </div>
        </div>
        
        <!-- Detected Hits List -->
        <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300">Detected Hits (<span id="hitCount">0</span>)</h4>
                <button id="replaceAllHitsBtn" class="px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600" disabled>
                    Replace All
                </button>
            </div>
            <div id="drumHitsList" class="space-y-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 p-2">
                <div class="text-xs text-gray-400 text-center py-4">No hits detected yet</div>
            </div>
        </div>
        
        <!-- Sample Selection for Replacement -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Replace With Sample</h4>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="text-xs text-gray-500">Source Drum Track</label>
                    <select id="drumSourceTrack" class="w-full p-1 text-xs bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                        ${drumTracks.length > 0 ? 
                            drumTracks.map(t => `<option value="${t.id}">${t.name}</option>`).join('') :
                            `<option value="">No drum tracks</option>`
                        }
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-500">Pad (1-8)</label>
                    <select id="drumReplacePad" class="w-full p-1 text-xs bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                        ${[...Array(8)].map((_, i) => `<option value="${i}">Pad ${i + 1}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="text-xs text-gray-500">Gain: <span id="gainVal">100%</span></label>
                    <input type="range" id="drumReplaceGain" min="0" max="150" value="100" class="w-full">
                </div>
                <div>
                    <label class="text-xs text-gray-500">Pitch: <span id="pitchVal">0st</span></label>
                    <input type="range" id="drumReplacePitch" min="-12" max="12" value="0" class="w-full">
                </div>
            </div>
        </div>
        
        <!-- Apply Button -->
        <div class="flex gap-2">
            <button id="applyDrumReplaceBtn" class="flex-1 px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600" disabled>
                Apply Replacements
            </button>
        </div>
    `;

    container.innerHTML = html;

    // Attach event listeners
    const trackSelect = container.querySelector('#drumReplaceTrackSelect');
    trackSelect?.addEventListener('change', (e) => {
        currentDrumReplaceTrackId = parseInt(e.target.value, 10);
        resetDrumReplace();
        renderDrumReplaceContent();
    });

    const thresholdSlider = container.querySelector('#drumReplaceThreshold');
    const thresholdVal = container.querySelector('#thresholdVal');
    thresholdSlider?.addEventListener('input', (e) => {
        thresholdVal.textContent = `${e.target.value}%`;
    });

    const minGapSlider = container.querySelector('#drumReplaceMinGap');
    const minGapVal = container.querySelector('#minGapVal');
    minGapSlider?.addEventListener('input', (e) => {
        minGapVal.textContent = `${(parseInt(e.target.value) / 1000).toFixed(1)}s`;
    });

    const analyzeBtn = container.querySelector('#analyzeDrumBtn');
    analyzeBtn?.addEventListener('click', async () => {
        const threshold = parseInt(thresholdSlider.value) / 100;
        const minGap = parseInt(minGapSlider.value) / 1000;
        
        const selectedTrack = localAppServices.getTrackById?.(currentDrumReplaceTrackId);
        if (!selectedTrack) return;

        // Get audio data from track's timeline clips
        let audioData = null;
        let sampleRate = 44100;

        if (selectedTrack.timelineClips && selectedTrack.timelineClips.length > 0) {
            const clip = selectedTrack.timelineClips[0];
            if (clip.audioBuffer) {
                audioData = clip.audioBuffer.getChannelData(0);
                sampleRate = clip.audioBuffer.sampleRate;
            }
        }

        if (audioData) {
            isAnalyzing = true;
            detectDrumHits(audioData, sampleRate, { threshold, minTimeBetweenHits: minGap });
            updateHitsListUI();
            localAppServices.showNotification?.(`Detected ${detectedHits.length} drum hits`, 2000);
        } else {
            localAppServices.showNotification?.('No audio data to analyze', 2000);
        }
    });

    const clearBtn = container.querySelector('#clearDrumAnalysisBtn');
    clearBtn?.addEventListener('click', () => {
        resetDrumReplace();
        renderDrumReplaceContent();
    });

    const gainSlider = container.querySelector('#drumReplaceGain');
    const gainVal = container.querySelector('#gainVal');
    gainSlider?.addEventListener('input', (e) => {
        gainVal.textContent = `${e.target.value}%`;
    });

    const pitchSlider = container.querySelector('#drumReplacePitch');
    const pitchVal = container.querySelector('#pitchVal');
    pitchSlider?.addEventListener('input', (e) => {
        pitchVal.textContent = `${e.target.value}st`;
    });

    const replaceAllBtn = container.querySelector('#replaceAllHitsBtn');
    replaceAllBtn?.addEventListener('click', () => {
        const sourceTrackId = parseInt(container.querySelector('#drumSourceTrack').value);
        const padIndex = parseInt(container.querySelector('#drumReplacePad').value);
        const gain = parseInt(gainSlider.value) / 100;
        const pitch = parseInt(pitchSlider.value);

        if (sourceTrackId && detectedHits.length > 0) {
            replaceAllHits(
                { trackId: sourceTrackId, padIndex, sampleName: `Pad ${padIndex + 1}` },
                { gain, pitchShift: pitch }
            );
            updateHitsListUI();
            localAppServices.showNotification?.(`Replaced all ${detectedHits.length} hits`, 2000);
        }
    });

    const applyBtn = container.querySelector('#applyDrumReplaceBtn');
    applyBtn?.addEventListener('click', async () => {
        const replacedCount = detectedHits.filter(h => h.replacedWith).length;
        if (replacedCount === 0) {
            localAppServices.showNotification?.('No hits to replace', 2000);
            return;
        }
        
        localAppServices.showNotification?.(`Applied ${replacedCount} replacements`, 2000);
        // The actual playback would be triggered during transport playback
    });

    updateHitsListUI();
}

function updateHitsListUI() {
    const container = document.getElementById('drumReplaceContent');
    if (!container) return;

    const hitsList = container.querySelector('#drumHitsList');
    const hitCountEl = container.querySelector('#hitCount');
    const replaceAllBtn = container.querySelector('#replaceAllHitsBtn');
    const applyBtn = container.querySelector('#applyDrumReplaceBtn');

    if (hitCountEl) hitCountEl.textContent = detectedHits.length;

    if (!hitsList) return;

    if (detectedHits.length === 0) {
        hitsList.innerHTML = '<div class="text-xs text-gray-400 text-center py-4">No hits detected yet</div>';
        if (replaceAllBtn) replaceAllBtn.disabled = true;
        if (applyBtn) applyBtn.disabled = true;
        return;
    }

    const replacedCount = detectedHits.filter(h => h.replacedWith).length;
    if (replaceAllBtn) replaceAllBtn.disabled = replacedCount === 0;
    if (applyBtn) applyBtn.disabled = replacedCount === 0;

    hitsList.innerHTML = detectedHits.map((hit, idx) => `
        <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-600 rounded text-xs ${hit.replacedWith ? 'border border-purple-300' : 'border border-gray-200'}">
            <div class="flex items-center gap-2">
                <span class="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-full text-[10px]">${idx + 1}</span>
                <span class="text-gray-600 dark:text-gray-300">${hit.time.toFixed(3)}s</span>
                <span class="text-gray-400">${Math.round(hit.confidence * 100)}%</span>
            </div>
            <div class="flex items-center gap-2">
                ${hit.replacedWith ? 
                    `<span class="text-purple-600 dark:text-purple-300">${hit.replacedWith.sampleName}</span>` :
                    `<span class="text-gray-400">Not replaced</span>`
                }
                <button class="replace-hit-btn px-2 py-0.5 text-[10px] bg-purple-400 text-white rounded hover:bg-purple-500" data-hit-idx="${idx}">
                    ${hit.replacedWith ? 'Change' : 'Replace'}
                </button>
            </div>
        </div>
    `).join('');

    // Attach click handlers for replace buttons
    hitsList.querySelectorAll('.replace-hit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const hitIdx = parseInt(e.target.dataset.hitIdx, 10);
            const sourceTrackId = parseInt(container.querySelector('#drumSourceTrack').value);
            const padIndex = parseInt(container.querySelector('#drumReplacePad').value);
            const gain = parseInt(container.querySelector('#drumReplaceGain').value) / 100;
            const pitch = parseInt(container.querySelector('#drumReplacePitch').value);

            if (sourceTrackId) {
                replaceHit(hitIdx, { trackId: sourceTrackId, padIndex, sampleName: `Pad ${padIndex + 1}` }, { gain, pitchShift: pitch });
                updateHitsListUI();
            }
        });
    });
}

/**
 * Analyze audio buffer to detect drum hits using energy-based onset detection
 * @param {Float32Array} audioData - Audio sample data
 * @param {number} sampleRate - Sample rate
 * @param {Object} options - Detection options
 * @returns {Array<{time: number, confidence: number}>} Detected hits
 */
export function detectDrumHits(audioData, sampleRate, options = {}) {
    const {
        threshold = 0.3,        // Energy threshold (0-1)
        minTimeBetweenHits = 0.1, // Minimum seconds between hits
        windowSize = 1024,       // Analysis window size
        hopSize = 512            // Hop size for sliding window
    } = options;

    isAnalyzing = true;
    detectedHits = [];

    // Calculate energy envelope using short-time energy
    const energies = [];
    const numWindows = Math.floor((audioData.length - windowSize) / hopSize);

    for (let i = 0; i < numWindows; i++) {
        let energy = 0;
        const startIdx = i * hopSize;
        for (let j = 0; j < windowSize; j++) {
            const sample = audioData[startIdx + j] || 0;
            energy += sample * sample;
        }
        energies.push(Math.sqrt(energy / windowSize));
    }

    // Find peaks in energy that exceed threshold
    const meanEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
    const stdEnergy = Math.sqrt(energies.reduce((sum, e) => sum + (e - meanEnergy) ** 2, 0) / energies.length);
    const adaptiveThreshold = meanEnergy + stdEnergy * (1 - threshold);

    let lastHitTime = -Infinity;
    const hits = [];

    for (let i = 1; i < energies.length - 1; i++) {
        const energy = energies[i];
        const prevEnergy = energies[i - 1];
        const nextEnergy = energies[i + 1];

        // Check if this is a local maximum above threshold
        const isPeak = energy > prevEnergy && energy > nextEnergy && energy > adaptiveThreshold;
        const timeInSeconds = (i * hopSize) / sampleRate;

        if (isPeak && (timeInSeconds - lastHitTime) > minTimeBetweenHits) {
            const confidence = Math.min(1, energy / (adaptiveThreshold * 2));
            hits.push({
                time: timeInSeconds,
                confidence: confidence,
                energy: energy
            });
            lastHitTime = timeInSeconds;
        }
    }

    detectedHits = hits;
    isAnalyzing = false;
    console.log(`[DrumReplace] Detected ${hits.length} drum hits`);
    return hits;
}

/**
 * Get the detected hits
 * @returns {Array}
 */
export function getDetectedHits() {
    return detectedHits;
}

/**
 * Replace a specific detected hit with a sample from a library
 * @param {number} hitIndex - Index of the hit to replace
 * @param {Object} sampleInfo - Sample info {trackId, padIndex, sampleName}
 * @param {Object} replacementOptions - Options for replacement
 * @returns {boolean} Success
 */
export function replaceHit(hitIndex, sampleInfo, replacementOptions = {}) {
    if (hitIndex < 0 || hitIndex >= detectedHits.length) {
        console.warn('[DrumReplace] Invalid hit index:', hitIndex);
        return false;
    }

    const hit = detectedHits[hitIndex];
    const {
        gain = 1.0,
        pitchShift = 0,
        startTimeOffset = 0,
        duration = 0.5
    } = replacementOptions;

    detectedHits[hitIndex] = {
        ...hit,
        replacedWith: {
            trackId: sampleInfo.trackId,
            padIndex: sampleInfo.padIndex,
            sampleName: sampleInfo.sampleName || 'Unknown',
            gain: gain,
            pitchShift: pitchShift,
            startTimeOffset: startTimeOffset,
            duration: duration,
            replacedAt: Date.now()
        }
    };

    console.log(`[DrumReplace] Replaced hit at ${hit.time.toFixed(3)}s with ${sampleInfo.sampleName}`);
    return true;
}

/**
 * Replace all detected hits with a specific sample
 * @param {Object} sampleInfo - Sample info {trackId, padIndex, sampleName}
 * @param {Object} replacementOptions - Options for replacement
 */
export function replaceAllHits(sampleInfo, replacementOptions = {}) {
    for (let i = 0; i < detectedHits.length; i++) {
        replaceHit(i, sampleInfo, replacementOptions);
    }
    console.log(`[DrumReplace] Replaced all ${detectedHits.length} hits with ${sampleInfo.sampleName}`);
}

/**
 * Clear all replacements
 */
export function clearReplacements() {
    detectedHits.forEach(hit => {
        if (hit.replacedWith) {
            delete hit.replacedWith;
        }
    });
    console.log('[DrumReplace] Cleared all replacements');
}

/**
 * Get a summary of hits and their replacement status
 * @returns {Object}
 */
export function getDrumReplaceSummary() {
    return {
        totalHits: detectedHits.length,
        replacedHits: detectedHits.filter(h => h.replacedWith).length,
        hits: detectedHits.map((hit, idx) => ({
            index: idx,
            time: hit.time,
            confidence: hit.confidence,
            isReplaced: !!hit.replacedWith,
            replacement: hit.replacedWith || null
        }))
    };
}

/**
 * Apply drum replacements to a track's audio clips
 * @param {number} trackId - Track ID
 * @param {Function} playSampleCallback - Callback to play a sample
 * @returns {boolean} Success
 */
export async function applyDrumReplacements(trackId, playSampleCallback) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.error('[DrumReplace] Track not found:', trackId);
        return false;
    }

    let replacementsApplied = 0;
    for (const hit of detectedHits) {
        if (hit.replacedWith && playSampleCallback) {
            await playSampleCallback(
                hit.replacedWith.trackId,
                hit.replacedWith.padIndex,
                hit.time + hit.replacedWith.startTimeOffset,
                hit.replacedWith.gain,
                hit.replacedWith.pitchShift
            );
            replacementsApplied++;
        }
    }

    console.log(`[DrumReplace] Applied ${replacementsApplied} drum replacements`);
    return true;
}

/**
 * Export detection results as JSON for saving with project
 * @returns {Object}
 */
export function exportDrumReplaceData() {
    return {
        detectedHits: detectedHits,
        exportedAt: new Date().toISOString()
    };
}

/**
 * Import detection results from saved project data
 * @param {Object} data - Previously saved drum replace data
 */
export function importDrumReplaceData(data) {
    if (data && Array.isArray(data.detectedHits)) {
        detectedHits = data.detectedHits;
        console.log(`[DrumReplace] Imported ${detectedHits.length} detected hits`);
    }
}

/**
 * Reset the drum replace analysis
 */
export function resetDrumReplace() {
    detectedHits = [];
    isAnalyzing = false;
    console.log('[DrumReplace] Reset complete');
}

/**
 * Check if analysis is in progress
 * @returns {boolean}
 */
export function isAnalyzingAudio() {
    return isAnalyzing;
}