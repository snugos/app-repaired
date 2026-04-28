// js/AutoCompression.js - Auto-compression analyzer
// Analyzes audio dynamics and suggests/applies compression settings

let localAppServices = {};

/**
 * Initialize the AutoCompression module with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initAutoCompression(appServices) {
    localAppServices = appServices || {};
    console.log('[AutoCompression] Module initialized');
}

/**
 * Analyze audio from a track and suggest compression settings
 * @param {number} trackId - Track ID to analyze
 * @returns {Promise<Object>} Suggested compression settings
 */
export async function analyzeTrackDynamics(trackId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.warn('[AutoCompression] Track not found:', trackId);
        return getDefaultCompressionSettings();
    }
    
    const clips = track.getClips ? track.getClips() : [];
    if (clips.length === 0) {
        console.warn('[AutoCompression] No clips found in track:', trackId);
        return getDefaultCompressionSettings();
    }
    
    let audioBuffer = null;
    for (const clip of clips) {
        if (clip.audioBuffer) {
            audioBuffer = clip.audioBuffer;
            break;
        }
        if (clip.audioData && clip.audioData.buffer) {
            audioBuffer = clip.audioData.buffer;
            break;
        }
    }
    
    if (!audioBuffer) {
        console.warn('[AutoCompression] No audio buffer found');
        return getDefaultCompressionSettings();
    }
    
    try {
        const channelData = audioBuffer.getChannelData(0);
        return analyzeDynamicsFromData(channelData, audioBuffer.sampleRate);
    } catch (error) {
        console.error('[AutoCompression] Error analyzing audio:', error);
        return getDefaultCompressionSettings();
    }
}

/**
 * Get default compression settings
 */
function getDefaultCompressionSettings() {
    return {
        threshold: -18,
        ratio: 4,
        attack: 0.003,
        release: 0.25,
        knee: 30,
        makeupGain: 0,
        reduction: 0,
        dynamicRange: 'unknown',
        confidence: 0
    };
}

/**
 * Analyze dynamics from raw audio data
 */
function analyzeDynamicsFromData(channelData, sampleRate) {
    // Calculate RMS in windows to find average and peak levels
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
    const hopSize = Math.floor(windowSize / 2);
    const numWindows = Math.floor((channelData.length - windowSize) / hopSize);
    
    const rmsValues = new Float32Array(numWindows);
    const peakValues = new Float32Array(numWindows);
    
    let sumRMS = 0;
    let maxPeak = 0;
    
    for (let i = 0; i < numWindows; i++) {
        const start = i * hopSize;
        let sumSquares = 0;
        let windowPeak = 0;
        
        for (let j = 0; j < windowSize; j++) {
            const sample = channelData[start + j] || 0;
            sumSquares += sample * sample;
            const absSample = Math.abs(sample);
            if (absSample > windowPeak) windowPeak = absSample;
        }
        
        const rms = Math.sqrt(sumSquares / windowSize);
        rmsValues[i] = rms;
        peakValues[i] = windowPeak;
        sumRMS += rms;
        
        if (windowPeak > maxPeak) maxPeak = windowPeak;
    }
    
    const avgRMS = sumRMS / numWindows;
    const avgRMSdB = 20 * Math.log10(avgRMS || 0.0001);
    const peakdB = 20 * Math.log10(maxPeak || 0.0001);
    const dynamicRange = peakdB - avgRMSdB;
    
    // Sort RMS values for percentile calculations
    const sortedRMS = rmsValues.slice().sort((a, b) => a - b);
    const loudnessPct = sortedRMS[Math.floor(sortedRMS.length * 0.95)]; // 95th percentile
    const quietnessPct = sortedRMS[Math.floor(sortedRMS.length * 0.1)]; // 10th percentile
    const loudnessRMSdB = 20 * Math.log10(loudnessPct || 0.0001);
    
    // Determine threshold: set ~5-10dB above average RMS
    const threshold = Math.round(loudnessRMSdB - 6);
    
    // Calculate compression ratio based on dynamic range
    let ratio = 4; // Default
    if (dynamicRange > 18) ratio = 6;
    else if (dynamicRange > 12) ratio = 4;
    else if (dynamicRange > 6) ratio = 2.5;
    else ratio = 1.5;
    
    // Calculate makeup gain to bring average up to -6dB
    const targetRMSdB = -6;
    const makeupGain = Math.max(0, targetRMSdB - avgRMSdB);
    
    // Estimate gain reduction based on how much signal exceeds threshold
    const thresholdLinear = Math.pow(10, threshold / 20);
    let peaksAboveThreshold = 0;
    for (let i = 0; i < peakValues.length; i++) {
        if (peakValues[i] > thresholdLinear) peaksAboveThreshold++;
    }
    const pctAboveThreshold = peaksAboveThreshold / peakValues.length;
    
    // Expected reduction: rough estimate based on ratio and amount above threshold
    const expectedReduction = Math.round((ratio - 1) * pctAboveThreshold * 10);
    
    // Attack: faster for punchy transients, slower for sustained
    const attack = dynamicRange > 12 ? 0.001 : 0.005;
    
    // Release: set to roughly 1/4 of avg RMS window duration
    const release = 0.2 + (dynamicRange > 12 ? 0.1 : 0);
    
    // Confidence based on how consistent the dynamics are
    const rmsVariance = sortedRMS.reduce((sum, val) => sum + Math.pow(val - avgRMS, 2), 0) / sortedRMS.length;
    const rmsStdDev = Math.sqrt(rmsVariance);
    const normalizedStdDev = rmsStdDev / avgRMS;
    const confidence = Math.max(0.2, Math.min(0.95, 1 - normalizedStdDev));
    
    return {
        threshold: threshold,
        ratio: ratio,
        attack: attack,
        release: release,
        knee: 30,
        makeupGain: Math.round(makeupGain * 10) / 10,
        reduction: expectedReduction,
        dynamicRange: Math.round(dynamicRange * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
        avgRMSdB: Math.round(avgRMSdB * 10) / 10,
        peakdB: Math.round(peakdB * 10) / 10
    };
}

/**
 * Open the Auto-Compression panel
 */
export function openAutoCompressionPanel() {
    const windowId = 'autoCompression';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderAutoCompressionContent();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'autoCompressionContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-50 dark:bg-slate-800';
    
    const options = {
        width: 460,
        height: 560,
        minWidth: 420,
        minHeight: 480,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Auto-Compression', contentContainer, options);
    if (win?.element) {
        renderAutoCompressionContent();
    }
    return win;
}

/**
 * Render the Auto-Compression panel content
 */
function renderAutoCompressionContent() {
    const container = document.getElementById('autoCompressionContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const audioTracks = tracks.filter(t => t.type === 'audio');
    
    let html = `
        <div class="mb-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
            <p class="text-sm text-purple-700 dark:text-purple-300">
                <strong>Auto-Compression:</strong> Analyze audio dynamics and get optimal compressor settings.
            </p>
        </div>
        
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Audio Track</label>
            <select id="autoCompTrackSelect" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                <option value="">-- Select a track --</option>
                ${audioTracks.map(t => `<option value="${t.id}">${t.name || 'Track ' + t.id}</option>`).join('')}
            </select>
        </div>
        
        <div class="mb-4 flex gap-2">
            <button id="autoCompAnalyzeBtn" class="flex-1 px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Analyze Dynamics
            </button>
            <button id="autoCompApplyBtn" class="flex-1 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                Apply to Track
            </button>
        </div>
        
        <div id="autoCompLoading" class="hidden text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">Analyzing dynamics...</div>
        </div>
        
        <div id="autoCompResults" class="hidden">
            <div class="p-4 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                <div class="flex items-center justify-between mb-4">
                    <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Suggested Settings</span>
                    <span id="autoCompConfidence" class="px-2 py-1 text-xs rounded"></span>
                </div>
                
                <div class="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Threshold</div>
                        <div id="autoCompThreshold" class="font-bold text-lg">-- dB</div>
                    </div>
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Ratio</div>
                        <div id="autoCompRatio" class="font-bold text-lg">-- :1</div>
                    </div>
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Attack</div>
                        <div id="autoCompAttack" class="font-bold text-lg">-- ms</div>
                    </div>
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Release</div>
                        <div id="autoCompRelease" class="font-bold text-lg">-- ms</div>
                    </div>
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Makeup Gain</div>
                        <div id="autoCompMakeup" class="font-bold text-lg">-- dB</div>
                    </div>
                    <div class="p-2 bg-gray-50 dark:bg-slate-600 rounded">
                        <div class="text-gray-500 dark:text-gray-400">Dyn Range</div>
                        <div id="autoCompDynRange" class="font-bold text-lg">-- dB</div>
                    </div>
                </div>
                
                <div class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div class="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Analysis:</strong> Estimated GR: <span id="autoCompGR">--</span> dB
                    </div>
                </div>
            </div>
            
            <div class="mt-4 p-4 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                <div class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Audio Statistics</div>
                <div class="grid grid-cols-2 gap-3 text-xs">
                    <div>
                        <span class="text-gray-500 dark:text-gray-400">Avg RMS:</span>
                        <span id="autoCompAvgRMS" class="ml-1">--</span>
                    </div>
                    <div>
                        <span class="text-gray-500 dark:text-gray-400">Peak:</span>
                        <span id="autoCompPeak" class="ml-1">--</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="autoCompError" class="hidden p-3 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700">
            <p class="text-sm text-red-600 dark:text-red-400" id="autoCompErrorMsg"></p>
        </div>
        
        <div class="mt-4 p-3 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
            <div class="text-xs text-gray-500 dark:text-gray-400">
                <strong>Tips:</strong>
                <ul class="list-disc list-inside mt-1 space-y-1">
                    <li>Higher dynamic range = more compression may be needed</li>
                    <li>Vocals typically work well with 3:1-4:1 ratio</li>
                    <li>Drums often need fast attack and higher ratio</li>
                </ul>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    const trackSelect = container.querySelector('#autoCompTrackSelect');
    const analyzeBtn = container.querySelector('#autoCompAnalyzeBtn');
    const applyBtn = container.querySelector('#autoCompApplyBtn');
    const resultsDiv = container.querySelector('#autoCompResults');
    const loadingDiv = container.querySelector('#autoCompLoading');
    const errorDiv = container.querySelector('#autoCompError');
    
    let currentAnalysis = null;
    let currentTrackId = null;
    
    analyzeBtn?.addEventListener('click', async () => {
        const trackId = parseInt(trackSelect.value, 10);
        if (!trackId) {
            localAppServices.showNotification?.('Please select a track first', 2000);
            return;
        }
        
        currentTrackId = trackId;
        resultsDiv?.classList.add('hidden');
        errorDiv?.classList.add('hidden');
        loadingDiv?.classList.remove('hidden');
        analyzeBtn.disabled = true;
        applyBtn.disabled = true;
        
        try {
            currentAnalysis = await analyzeTrackDynamics(trackId);
            
            loadingDiv?.classList.add('hidden');
            resultsDiv?.classList.remove('hidden');
            applyBtn.disabled = false;
            
            // Update display
            container.querySelector('#autoCompThreshold').textContent = `${currentAnalysis.threshold} dB`;
            container.querySelector('#autoCompRatio').textContent = `${currentAnalysis.ratio} :1`;
            container.querySelector('#autoCompAttack').textContent = `${Math.round(currentAnalysis.attack * 1000)} ms`;
            container.querySelector('#autoCompRelease').textContent = `${Math.round(currentAnalysis.release * 1000)} ms`;
            container.querySelector('#autoCompMakeup').textContent = `${currentAnalysis.makeupGain} dB`;
            container.querySelector('#autoCompDynRange').textContent = `${currentAnalysis.dynamicRange} dB`;
            container.querySelector('#autoCompGR').textContent = currentAnalysis.reduction;
            
            container.querySelector('#autoCompAvgRMS').textContent = `${currentAnalysis.avgRMSdB} dB`;
            container.querySelector('#autoCompPeak').textContent = `${currentAnalysis.peakdB} dB`;
            
            // Update confidence badge
            const confidence = currentAnalysis.confidence;
            let colorClass = 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
            if (confidence > 0.7) colorClass = 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400';
            else if (confidence > 0.4) colorClass = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400';
            
            container.querySelector('#autoCompConfidence').className = `px-2 py-1 text-xs rounded ${colorClass}`;
            container.querySelector('#autoCompConfidence').textContent = `${Math.round(confidence * 100)}% confidence`;
            
        } catch (error) {
            loadingDiv?.classList.add('hidden');
            errorDiv?.classList.remove('hidden');
            container.querySelector('#autoCompErrorMsg').textContent = error.message || 'Analysis failed';
        } finally {
            analyzeBtn.disabled = false;
        }
    });
    
    applyBtn?.addEventListener('click', () => {
        if (!currentAnalysis || !currentTrackId) return;
        
        applyCompressionToTrack(currentTrackId, currentAnalysis);
        localAppServices.showNotification?.('Compression settings applied', 2000);
    });
}

/**
 * Apply compression settings to a track
 */
function applyCompressionToTrack(trackId, settings) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.warn('[AutoCompression] Track not found:', trackId);
        return false;
    }
    
    // Check if track already has a compressor
    let compressor = null;
    const effects = track.effects || [];
    const existingComp = effects.find(e => e.type === 'Compressor');
    
    if (existingComp && existingComp.instance) {
        compressor = existingComp.instance;
    } else {
        // Create a new compressor effect
        if (localAppServices.addEffectToTrack) {
            const result = localAppServices.addEffectToTrack(trackId, 'Compressor', {
                threshold: settings.threshold,
                ratio: settings.ratio,
                attack: settings.attack,
                release: settings.release,
                knee: settings.knee,
                wet: 1
            });
            
            if (result && result.success) {
                // Update makeup gain if available
                const effects = track.effects || [];
                const newComp = effects[effects.length - 1];
                if (newComp && newComp.instance && settings.makeupGain > 0) {
                    // Makeup gain would need a separate gain node after compressor
                    // For now, just show a notification that it was added
                }
            }
            
            localAppServices.showNotification?.('Compressor added to track', 2000);
            return true;
        }
    }
    
    if (compressor) {
        // Update existing compressor settings
        compressor.threshold.value = settings.threshold;
        compressor.ratio.value = settings.ratio;
        compressor.attack.value = settings.attack;
        compressor.release.value = settings.release;
        compressor.knee.value = settings.knee;
        
        localAppServices.showNotification?.('Compressor settings updated', 2000);
        return true;
    }
    
    return false;
}

/**
 * Quick analyze - returns settings without UI
 */
export async function quickAnalyze(trackId) {
    return await analyzeTrackDynamics(trackId);
}

// Window exposure
window.AutoCompression = {
    openPanel: openAutoCompressionPanel,
    analyze: analyzeTrackDynamics,
    quickAnalyze: quickAnalyze,
    init: initAutoCompression
};