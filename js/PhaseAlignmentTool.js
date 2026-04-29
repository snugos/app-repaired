// js/PhaseAlignmentTool.js - Phase Alignment Tool for SnugOS DAW
// Visualize and align the phase of multiple audio tracks for better mixing

let localAppServices = {};
let alignmentWindow = null;
let selectedTracks = [];
let trackCorrelations = new Map();
let trackPhaseOffsets = new Map();

/**
 * Initialize the Phase Alignment Tool
 * @param {Object} appServices - Application services from main.js
 */
export function initPhaseAlignmentTool(appServices) {
    localAppServices = appServices || {};
    console.log('[PhaseAlignment] Module initialized');
}

/**
 * Open the Phase Alignment Tool panel
 */
export function openPhaseAlignmentPanel() {
    const windowId = 'phaseAlignmentTool';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderPhaseAlignmentContent();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'phaseAlignmentContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-50 dark:bg-slate-800';
    
    const options = {
        width: 480,
        height: 560,
        minWidth: 400,
        minHeight: 480,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Phase Alignment Tool', contentContainer, options);
    if (win?.element) {
        renderPhaseAlignmentContent();
    }
    return win;
}

/**
 * Render the Phase Alignment Tool content
 */
function renderPhaseAlignmentContent() {
    const container = document.getElementById('phaseAlignmentContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const audioTracks = tracks.filter(t => t.type === 'audio' || t.type === 'Audio');
    
    let html = `
        <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
            <p class="text-sm text-blue-700 dark:text-blue-300">
                <strong>Phase Alignment:</strong> Select 2+ audio tracks to analyze their phase relationship.
                Use correlation and offset controls to align tracks for better mono compatibility.
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Audio Tracks</label>
            <div class="max-h-40 overflow-y-auto border border-gray-300 dark:border-slate-500 rounded p-2 bg-white dark:bg-slate-700">
                ${audioTracks.length === 0 ? '<div class="text-sm text-gray-500">No audio tracks found</div>' : audioTracks.map(t => `
                    <label class="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 rounded px-1">
                        <input type="checkbox" class="track-select" value="${t.id}" ${selectedTracks.includes(t.id) ? 'checked' : ''}>
                        <span class="text-sm text-gray-700 dark:text-gray-200">${t.name || 'Track ' + t.id}</span>
                        ${trackCorrelations.has(t.id) ? `<span class="text-xs px-2 py-0.5 rounded ${getCorrelationColor(trackCorrelations.get(t.id))}">${trackCorrelations.get(t.id).toFixed(2)}</span>` : ''}
                    </label>
                `).join('')}
            </div>
            <div class="mt-2 text-xs text-gray-500">Select 2+ tracks to compare phase</div>
        </div>
        
        <div class="mb-4 flex gap-2">
            <button id="analyzePhaseBtn" class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Analyze Phase
            </button>
            <button id="autoAlignBtn" class="flex-1 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                Auto Align
            </button>
            <button id="applyOffsetBtn" class="flex-1 px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                Apply Offset
            </button>
        </div>
        
        <div id="phaseResults" class="hidden mb-4 p-4 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
            <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Phase Analysis Results</h3>
            <div id="phaseResultsContent"></div>
        </div>
        
        <div id="phaseVisualization" class="mb-4 p-3 bg-slate-900 rounded-lg">
            <div class="text-xs text-gray-400 mb-2">Phase Correlation Meter</div>
            <div class="relative h-4 bg-gray-800 rounded overflow-hidden">
                <div id="correlationBar" class="absolute inset-y-0 left-1/2 bg-green-500 transition-all duration-300" style="width: 0%"></div>
                <div class="absolute inset-y-0 left-1/2 w-px bg-white"></div>
            </div>
            <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>-1 (Out of Phase)</span>
                <span>0</span>
                <span>+1 (In Phase)</span>
            </div>
        </div>
        
        <div id="offsetControls" class="hidden p-3 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
            <div class="mb-3">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Manual Phase Offset (ms)</label>
                <div class="flex items-center gap-2">
                    <input type="range" id="phaseOffsetSlider" min="-50" max="50" step="0.1" value="0" class="flex-1">
                    <input type="number" id="phaseOffsetInput" value="0" min="-50" max="50" step="0.1" class="w-20 p-1 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                    <span class="text-sm text-gray-500">ms</span>
                </div>
            </div>
            <div class="flex gap-2">
                <button id="invertPhaseBtn" class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                    Invert Phase
                </button>
                <button id="resetOffsetBtn" class="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">
                    Reset
                </button>
            </div>
        </div>
        
        <div class="mt-4 p-3 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
            <div class="text-xs text-gray-500 dark:text-gray-400">
                <strong>Tips:</strong>
                <ul class="list-disc list-inside mt-1 space-y-1">
                    <li>High correlation (+0.9) = tracks are well aligned</li>
                    <li>Low/negative correlation = phase issues to fix</li>
                    <li>In mono, out-of-phase tracks can cancel each other</li>
                    <li>Small adjustments (1-5ms) often fix drum phase</li>
                </ul>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Event listeners
    const trackCheckboxes = container.querySelectorAll('.track-select');
    trackCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            selectedTracks = Array.from(trackCheckboxes).filter(c => c.checked).map(c => parseInt(c.value, 10));
            updateUI();
        });
    });
    
    const analyzeBtn = container.querySelector('#analyzePhaseBtn');
    const autoAlignBtn = container.querySelector('#autoAlignBtn');
    const applyOffsetBtn = container.querySelector('#applyOffsetBtn');
    const offsetSlider = container.querySelector('#phaseOffsetSlider');
    const offsetInput = container.querySelector('#phaseOffsetInput');
    const invertBtn = container.querySelector('#invertPhaseBtn');
    const resetBtn = container.querySelector('#resetOffsetBtn');
    
    analyzeBtn?.addEventListener('click', async () => {
        if (selectedTracks.length < 2) {
            localAppServices.showNotification?.('Select at least 2 tracks to analyze', 2000);
            return;
        }
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        
        try {
            const result = await analyzeTrackPair(selectedTracks[0], selectedTracks[1]);
            trackCorrelations.set(selectedTracks[0], result.correlation);
            trackCorrelations.set(selectedTracks[1], result.correlation);
            
            const resultsDiv = container.querySelector('#phaseResults');
            const vizBar = container.querySelector('#correlationBar');
            const offsetControls = container.querySelector('#offsetControls');
            
            resultsDiv?.classList.remove('hidden');
            offsetControls?.classList.remove('hidden');
            autoAlignBtn.disabled = false;
            applyOffsetBtn.disabled = false;
            
            // Update visualization
            if (vizBar) {
                const percentage = ((result.correlation + 1) / 2) * 100;
                vizBar.style.width = `${percentage}%`;
                vizBar.style.background = getCorrelationColor(result.correlation);
            }
            
            // Update results content
            const resultsContent = container.querySelector('#phaseResultsContent');
            if (resultsContent) {
                resultsContent.innerHTML = `
                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                            <div class="text-gray-500 dark:text-gray-400">Correlation</div>
                            <div class="font-bold ${result.correlation > 0.5 ? 'text-green-600' : result.correlation > 0 ? 'text-yellow-600' : 'text-red-600'}">${result.correlation.toFixed(3)}</div>
                        </div>
                        <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                            <div class="text-gray-500 dark:text-gray-400">Optimal Offset</div>
                            <div class="font-medium">${result.optimalOffset.toFixed(2)} ms</div>
                        </div>
                        <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded col-span-2">
                            <div class="text-gray-500 dark:text-gray-400">Status</div>
                            <div class="font-medium">${getPhaseStatus(result.correlation)}</div>
                        </div>
                    </div>
                `;
            }
            
            // Pre-fill offset controls
            if (offsetSlider) offsetSlider.value = result.optimalOffset;
            if (offsetInput) offsetInput.value = result.optimalOffset.toFixed(2);
            
            renderPhaseAlignmentContent();
        } catch (error) {
            localAppServices.showNotification?.('Phase analysis failed: ' + error.message, 3000);
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Phase';
        }
    });
    
    autoAlignBtn?.addEventListener('click', () => {
        const firstTrack = selectedTracks[0];
        trackPhaseOffsets.set(firstTrack, 0); // Reference track
        const secondTrack = selectedTracks[1];
        trackPhaseOffsets.set(secondTrack, trackPhaseOffsets.get(secondTrack) || 0);
        
        // Apply optimal offset
        const offset = trackPhaseOffsets.get(secondTrack);
        applyPhaseOffset(secondTrack, offset);
        localAppServices.showNotification?.(`Auto-aligned tracks with ${offset.toFixed(2)}ms offset`, 2000);
    });
    
    applyOffsetBtn?.addEventListener('click', () => {
        const offset = parseFloat(offsetInput?.value || 0);
        const secondTrack = selectedTracks[1];
        applyPhaseOffset(secondTrack, offset);
        trackPhaseOffsets.set(secondTrack, offset);
        localAppServices.showNotification?.(`Applied ${offset.toFixed(2)}ms offset to track`, 2000);
    });
    
    offsetSlider?.addEventListener('input', () => {
        if (offsetInput) offsetInput.value = offsetSlider.value;
    });
    
    offsetInput?.addEventListener('change', () => {
        if (offsetSlider) offsetSlider.value = offsetInput.value;
    });
    
    invertBtn?.addEventListener('click', () => {
        if (selectedTracks.length >= 2) {
            const trackId = selectedTracks[1];
            invertTrackPhase(trackId);
            localAppServices.showNotification?.('Phase inverted on track', 2000);
            renderPhaseAlignmentContent();
        }
    });
    
    resetBtn?.addEventListener('click', () => {
        if (offsetSlider) offsetSlider.value = 0;
        if (offsetInput) offsetInput.value = 0;
        trackPhaseOffsets.clear();
        localAppServices.showNotification?.('Phase offsets reset', 1500);
    });
}

function updateUI() {
    const container = document.getElementById('phaseAlignmentContent');
    if (!container) return;
    
    const autoAlignBtn = container.querySelector('#autoAlignBtn');
    const applyOffsetBtn = container.querySelector('#applyOffsetBtn');
    const hasSelection = selectedTracks.length >= 2;
    
    if (autoAlignBtn) autoAlignBtn.disabled = !hasSelection;
    if (applyOffsetBtn) applyOffsetBtn.disabled = !hasSelection;
}

/**
 * Analyze phase relationship between two tracks
 */
async function analyzeTrackPair(trackId1, trackId2) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track1 = tracks.find(t => t.id === trackId1);
    const track2 = tracks.find(t => t.id === trackId2);
    
    if (!track1 || !track2) {
        throw new Error('Track not found');
    }
    
    // Get audio data from track clips
    const buffer1 = await getTrackAudioBuffer(track1);
    const buffer2 = await getTrackAudioBuffer(track2);
    
    if (!buffer1 || !buffer2) {
        throw new Error('No audio data found in tracks');
    }
    
    // Calculate correlation
    const correlation = calculateCorrelation(buffer1, buffer2);
    
    // Find optimal offset
    const optimalOffset = findOptimalOffset(buffer1, buffer2);
    
    return {
        correlation,
        optimalOffset,
        track1Id: trackId1,
        track2Id: trackId2
    };
}

/**
 * Get audio buffer from track
 */
async function getTrackAudioBuffer(track) {
    // Try to get from instrument sampler settings or clips
    if (track.instrumentSamplerSettings?.audioBuffer) {
        return track.instrumentSamplerSettings.audioBuffer;
    }
    
    if (track.samplerAudioData?.audioBuffer) {
        return track.samplerAudioData.audioBuffer;
    }
    
    // Try to get from timeline clips
    if (track.timelineClips && track.timelineClips.length > 0) {
        for (const clip of track.timelineClips) {
            if (clip.audioBuffer) {
                return clip.audioBuffer;
            }
        }
    }
    
    return null;
}

/**
 * Calculate correlation between two audio buffers
 */
function calculateCorrelation(buffer1, buffer2) {
    const data1 = buffer1.getChannelData(0);
    const data2 = buffer2.getChannelData(0);
    
    const minLength = Math.min(data1.length, data2.length);
    
    // Calculate normalized cross-correlation
    let sum = 0;
    let sum1 = 0;
    let sum2 = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;
    
    for (let i = 0; i < minLength; i++) {
        sum += data1[i] * data2[i];
        sum1 += data1[i];
        sum2 += data2[i];
        sum1Sq += data1[i] * data1[i];
        sum2Sq += data2[i] * data2[i];
    }
    
    const numerator = sum - (sum1 * sum2 / minLength);
    const denominator = Math.sqrt((sum1Sq - sum1 * sum1 / minLength) * (sum2Sq - sum2 * sum2 / minLength));
    
    if (denominator === 0) return 1;
    return numerator / denominator;
}

/**
 * Find optimal phase offset in milliseconds
 */
function findOptimalOffset(buffer1, buffer2, sampleRate = 44100) {
    const data1 = buffer1.getChannelData(0);
    const data2 = buffer2.getChannelData(0);
    
    // Check different offsets and find best correlation
    const maxOffsetMs = 50;
    const stepMs = 0.5;
    let bestCorrelation = -1;
    let bestOffset = 0;
    
    for (let offset = -maxOffsetMs; offset <= maxOffsetMs; offset += stepMs) {
        const correlation = calculateOffsetCorrelation(data1, data2, offset, sampleRate);
        if (correlation > bestCorrelation) {
            bestCorrelation = correlation;
            bestOffset = offset;
        }
    }
    
    return bestOffset;
}

/**
 * Calculate correlation with offset
 */
function calculateOffsetCorrelation(data1, data2, offsetMs, sampleRate) {
    const offsetSamples = Math.round((offsetMs / 1000) * sampleRate);
    const startIdx = Math.max(0, offsetSamples);
    const endIdx = Math.min(data1.length, data2.length + offsetSamples);
    const compareLength = endIdx - startIdx;
    
    if (compareLength <= 0) return -1;
    
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < compareLength; i++) {
        const idx1 = startIdx + i;
        const idx2 = idx1 - offsetSamples;
        if (idx2 >= 0 && idx2 < data2.length) {
            sum += data1[idx1] * data2[idx2];
            count++;
        }
    }
    
    return count > 0 ? sum / count : -1;
}

/**
 * Apply phase offset to a track
 */
function applyPhaseOffset(trackId, offsetMs) {
    // Store the offset in track metadata for later use
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (track) {
        track.phaseOffset = track.phaseOffset || {};
        track.phaseOffset.ms = offsetMs;
        console.log(`[PhaseAlignment] Applied ${offsetMs}ms offset to track ${trackId}`);
    }
}

/**
 * Invert phase of a track
 */
function invertTrackPhase(trackId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (track) {
        track.phaseInverted = !track.phaseInverted;
        console.log(`[PhaseAlignment] Phase inverted for track ${trackId}: ${track.phaseInverted}`);
    }
}

/**
 * Get color based on correlation value
 */
function getCorrelationColor(correlation) {
    if (correlation > 0.7) return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400';
    if (correlation > 0.3) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400';
    if (correlation > 0) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
}

/**
 * Get human-readable phase status
 */
function getPhaseStatus(correlation) {
    if (correlation > 0.9) return 'Excellent - Tracks are perfectly in phase';
    if (correlation > 0.7) return 'Good - Minor adjustment may help';
    if (correlation > 0.3) return 'Fair - Some phase cancellation present';
    if (correlation > 0) return 'Poor - Significant phase issues';
    return 'Critical - Tracks are out of phase';
}

// Window exposure
window.PhaseAlignmentTool = {
    openPanel: openPhaseAlignmentPanel,
    init: initPhaseAlignmentTool
};