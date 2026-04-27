// js/AITempoSuggestion.js - AI-powered tempo analysis from audio
// Analyzes the rhythm of recorded audio and suggests optimal BPM

let localAppServices = {};

/**
 * Initialize the AITempoSuggestion module with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initAITempoSuggestion(appServices) {
    localAppServices = appServices || {};
    console.log('[AITempo] Module initialized');
}

/**
 * Analyze audio from a track and estimate the BPM
 * Uses onset detection and peak analysis
 * @param {number} trackId - Track ID to analyze
 * @returns {Promise<{bpm: number, confidence: number, method: string}>}
 */
export async function analyzeTrackTempo(trackId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.warn('[AITempo] Track not found:', trackId);
        return { bpm: 120, confidence: 0, method: 'none' };
    }
    
    // Get audio clips from the track
    const clips = track.getClips ? track.getClips() : [];
    if (clips.length === 0) {
        console.warn('[AITempo] No clips found in track:', trackId);
        return { bpm: 120, confidence: 0, method: 'none' };
    }
    
    // Find first audio clip with buffer data
    let audioBuffer = null;
    for (const clip of clips) {
        if (clip.audioBuffer) {
            audioBuffer = clip.audioBuffer;
            break;
        }
        // Check for audio data in other formats
        if (clip.audioData && clip.audioData.buffer) {
            audioBuffer = clip.audioData.buffer;
            break;
        }
    }
    
    if (!audioBuffer) {
        console.warn('[AITempo] No audio buffer found in track clips');
        return { bpm: 120, confidence: 0, method: 'none' };
    }
    
    try {
        // Get the raw audio data
        const channelData = audioBuffer.getChannelData(0);
        return detectBPMFromAudioData(channelData, audioBuffer.sampleRate);
    } catch (error) {
        console.error('[AITempo] Error analyzing audio:', error);
        return { bpm: 120, confidence: 0, method: 'error' };
    }
}

/**
 * Detect BPM from raw audio data
 * @param {Float32Array} channelData - Raw audio samples
 * @param {number} sampleRate - Sample rate of the audio
 * @returns {Promise<{bpm: number, confidence: number, method: string}>}
 */
export async function detectBPMFromAudioData(channelData, sampleRate) {
    // Step 1: Calculate energy envelope using onset detection
    const energyEnvelope = calculateEnergyEnvelope(channelData, sampleRate);
    
    // Step 2: Find peaks in the energy envelope
    const peaks = findPeaks(energyEnvelope);
    
    // Step 3: Calculate intervals between peaks
    const intervals = calculateIntervals(peaks, sampleRate);
    
    // Step 4: Find the most common interval (tempo period)
    const histogram = buildIntervalHistogram(intervals);
    const dominantInterval = findDominantInterval(histogram);
    
    // Step 5: Convert interval to BPM
    const beatsPerSecond = 1 / dominantInterval;
    const rawBPM = beatsPerSecond * 60;
    
    // Step 6: Normalize BPM to reasonable range (60-200)
    const normalizedBPM = normalizeBPM(rawBPM);
    const confidence = calculateConfidence(histogram, dominantInterval, peaks.length);
    
    return {
        bpm: Math.round(normalizedBPM * 10) / 10,
        confidence: confidence,
        method: 'onset_detection',
        rawBPM: Math.round(rawBPM * 10) / 10,
        interval: Math.round(dominantInterval * 1000) / 1000
    };
}

/**
 * Calculate energy envelope using a window-based approach
 */
function calculateEnergyEnvelope(channelData, sampleRate) {
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
    const hopSize = Math.floor(windowSize / 2);
    const numWindows = Math.floor((channelData.length - windowSize) / hopSize);
    const envelope = new Float32Array(numWindows);
    
    for (let i = 0; i < numWindows; i++) {
        let energy = 0;
        const start = i * hopSize;
        for (let j = 0; j < windowSize; j++) {
            const sample = channelData[start + j] || 0;
            energy += sample * sample;
        }
        envelope[i] = Math.sqrt(energy / windowSize);
    }
    
    return envelope;
}

/**
 * Find peaks in the energy envelope
 */
function findPeaks(envelope) {
    const peaks = [];
    const threshold = calculateAdaptiveThreshold(envelope);
    
    for (let i = 1; i < envelope.length - 1; i++) {
        if (envelope[i] > threshold && 
            envelope[i] > envelope[i - 1] && 
            envelope[i] > envelope[i + 1]) {
            peaks.push(i);
        }
    }
    
    return peaks;
}

/**
 * Calculate adaptive threshold for peak detection
 */
function calculateAdaptiveThreshold(envelope) {
    const mean = envelope.reduce((a, b) => a + b, 0) / envelope.length;
    const variance = envelope.reduce((a, b) => a + (b - mean) ** 2, 0) / envelope.length;
    const stdDev = Math.sqrt(variance);
    return mean + stdDev * 0.5;
}

/**
 * Calculate time intervals between consecutive peaks
 */
function calculateIntervals(peaks, sampleRate) {
    const intervals = [];
    const msPerSample = 1000 / sampleRate;
    
    for (let i = 1; i < peaks.length; i++) {
        const sampleDiff = peaks[i] - peaks[i - 1];
        const timeMs = sampleDiff * msPerSample * 2; // Account for hop size
        
        // Only consider intervals in a reasonable tempo range (30-300 BPM)
        const minInterval = 60 / 300 * 1000; // 200ms for 300 BPM
        const maxInterval = 60 / 30 * 1000;  // 2000ms for 30 BPM
        
        if (timeMs >= minInterval && timeMs <= maxInterval) {
            intervals.push(timeMs);
        }
    }
    
    return intervals;
}

/**
 * Build histogram of intervals to find dominant tempo
 */
function buildIntervalHistogram(intervals) {
    const histogram = {};
    const tolerance = 20; // ms tolerance for grouping
    
    for (const interval of intervals) {
        const bucket = Math.round(interval / tolerance) * tolerance;
        histogram[bucket] = (histogram[bucket] || 0) + 1;
    }
    
    return histogram;
}

/**
 * Find the dominant interval (most common period)
 */
function findDominantInterval(histogram) {
    let maxCount = 0;
    let dominantInterval = 500; // Default fallback
    
    for (const [interval, count] of Object.entries(histogram)) {
        if (count > maxCount) {
            maxCount = count;
            dominantInterval = parseFloat(interval);
        }
    }
    
    return dominantInterval;
}

/**
 * Normalize BPM to reasonable range
 */
function normalizeBPM(bpm) {
    // First, find the closest multiple/division by 2 that fits in 60-200 range
    let normalized = bpm;
    
    // If too fast, halve until in range
    while (normalized < 60 && normalized > 0) {
        normalized *= 2;
    }
    
    // If too slow, double until in range
    while (normalized > 200) {
        normalized /= 2;
    }
    
    // Clamp to hard limits
    normalized = Math.max(40, Math.min(240, normalized));
    
    return normalized;
}

/**
 * Calculate confidence based on histogram consistency
 */
function calculateConfidence(histogram, dominantInterval, numPeaks) {
    // Calculate how concentrated the histogram is
    const totalVotes = Object.values(histogram).reduce((a, b) => a + b, 0);
    const dominantVotes = histogram[dominantInterval] || 0;
    const concentration = dominantVotes / totalVotes;
    
    // Factor in number of peaks detected
    const peakFactor = Math.min(numPeaks / 20, 1);
    
    // Combine factors
    const confidence = concentration * 0.7 + peakFactor * 0.3;
    
    return Math.round(confidence * 100) / 100;
}

/**
 * Open the AI Tempo Suggestion panel
 */
export function openAITempoPanel() {
    const windowId = 'aiTempoSuggestion';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderAITempoContent();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'aiTempoContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-50 dark:bg-slate-800';
    
    const options = { 
        width: 420, 
        height: 480, 
        minWidth: 380, 
        minHeight: 400, 
        initialContentKey: windowId, 
        closable: true, 
        minimizable: true, 
        resizable: true 
    };
    
    const win = localAppServices.createWindow(windowId, 'AI Tempo Suggestion', contentContainer, options);
    if (win?.element) {
        renderAITempoContent();
    }
    return win;
}

/**
 * Render the AI Tempo Suggestion panel content
 */
function renderAITempoContent() {
    const container = document.getElementById('aiTempoContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const audioTracks = tracks.filter(t => t.type === 'audio');
    
    let html = `
        <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
            <p class="text-sm text-blue-700 dark:text-blue-300">
                <strong>AI Tempo Analysis:</strong> Select an audio track to analyze its rhythm and suggest the optimal BPM.
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Audio Track</label>
            <select id="aiTempoTrackSelect" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                <option value="">-- Select a track --</option>
                ${audioTracks.map(t => `<option value="${t.id}">${t.name || 'Track ' + t.id}</option>`).join('')}
            </select>
        </div>
        
        <div class="mb-4 flex gap-2">
            <button id="aiTempoAnalyzeBtn" class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Analyze Tempo
            </button>
            <button id="aiTempoApplyBtn" class="flex-1 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                Apply Suggested BPM
            </button>
        </div>
        
        <div id="aiTempoResults" class="hidden">
            <div class="p-4 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Analysis Results</span>
                    <span id="aiTempoConfidence" class="px-2 py-1 text-xs rounded"></span>
                </div>
                
                <div class="text-center mb-4">
                    <div id="aiTempoSuggestedBPM" class="text-5xl font-bold text-blue-600 dark:text-blue-400">--</div>
                    <div class="text-sm text-gray-500 dark:text-gray-400">Suggested BPM</div>
                </div>
                
                <div class="grid grid-cols-2 gap-3 text-sm">
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Raw Detection</div>
                        <div id="aiTempoRaw" class="font-medium">--</div>
                    </div>
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Beat Interval</div>
                        <div id="aiTempoInterval" class="font-medium">--</div>
                    </div>
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Method</div>
                        <div id="aiTempoMethod" class="font-medium">--</div>
                    </div>
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Peaks Found</div>
                        <div id="aiTempoPeaks" class="font-medium">--</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="aiTempoLoading" class="hidden text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">Analyzing audio...</div>
        </div>
        
        <div id="aiTempoError" class="hidden p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
            <p class="text-sm text-red-600 dark:text-red-400" id="aiTempoErrorMsg"></p>
        </div>
        
        <div class="mt-4 p-3 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
            <div class="text-xs text-gray-500 dark:text-gray-400">
                <strong>Tips:</strong>
                <ul class="list-disc list-inside mt-1 space-y-1">
                    <li>Tracks with clear beats work best</li>
                    <li>Longer recordings = more accurate analysis</li>
                    <li>Low confidence suggests complexpolyrhythmic content</li>
                </ul>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Add event listeners
    const trackSelect = container.querySelector('#aiTempoTrackSelect');
    const analyzeBtn = container.querySelector('#aiTempoAnalyzeBtn');
    const applyBtn = container.querySelector('#aiTempoApplyBtn');
    const resultsDiv = container.querySelector('#aiTempoResults');
    const loadingDiv = container.querySelector('#aiTempoLoading');
    const errorDiv = container.querySelector('#aiTempoError');
    const confidenceBadge = container.querySelector('#aiTempoConfidence');
    
    let currentAnalysis = null;
    
    analyzeBtn?.addEventListener('click', async () => {
        const trackId = parseInt(trackSelect.value, 10);
        if (!trackId) {
            localAppServices.showNotification?.('Please select a track first', 2000);
            return;
        }
        
        resultsDiv?.classList.add('hidden');
        errorDiv?.classList.add('hidden');
        loadingDiv?.classList.remove('hidden');
        analyzeBtn.disabled = true;
        applyBtn.disabled = true;
        
        try {
            currentAnalysis = await analyzeTrackTempo(trackId);
            
            loadingDiv?.classList.add('hidden');
            resultsDiv?.classList.remove('hidden');
            applyBtn.disabled = false;
            
            // Update display
            container.querySelector('#aiTempoSuggestedBPM').textContent = currentAnalysis.bpm;
            container.querySelector('#aiTempoRaw').textContent = `${currentAnalysis.rawBPM} BPM`;
            container.querySelector('#aiTempoInterval').textContent = `${currentAnalysis.interval} ms`;
            container.querySelector('#aiTempoMethod').textContent = currentAnalysis.method;
            container.querySelector('#aiTempoPeaks').textContent = 'Multiple';
            
            // Update confidence badge
            const confidence = currentAnalysis.confidence;
            let colorClass = 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
            if (confidence > 0.6) colorClass = 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400';
            else if (confidence > 0.3) colorClass = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400';
            
            confidenceBadge.className = `px-2 py-1 text-xs rounded ${colorClass}`;
            confidenceBadge.textContent = `${Math.round(confidence * 100)}% confidence`;
            
        } catch (error) {
            loadingDiv?.classList.add('hidden');
            errorDiv?.classList.remove('hidden');
            container.querySelector('#aiTempoErrorMsg').textContent = error.message || 'Analysis failed';
        } finally {
            analyzeBtn.disabled = false;
        }
    });
    
    applyBtn?.addEventListener('click', () => {
        if (!currentAnalysis) return;
        
        const currentBPM = localAppServices.getBPM ? localAppServices.getBPM() : 120;
        localAppServices.setBPM?.(currentAnalysis.bpm);
        localAppServices.showNotification?.(`BPM changed from ${currentBPM} to ${currentAnalysis.bpm}`, 2000);
        
        // Update UI
        if (localAppServices.updateTransportDisplay) {
            localAppServices.updateTransportDisplay();
        }
    });
}

/**
 * Quick analyze - returns suggested BPM without UI
 * @param {number} trackId - Track ID to analyze
 * @returns {Promise<number>} Suggested BPM
 */
export async function quickAnalyze(trackId) {
    const result = await analyzeTrackTempo(trackId);
    return result.bpm;
}

// Window exposure
window.AITempoSuggestion = {
    openPanel: openAITempoPanel,
    analyze: analyzeTrackTempo,
    quickAnalyze: quickAnalyze,
    init: initAITempoSuggestion
};