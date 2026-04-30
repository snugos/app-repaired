/**
 * js/AITempoSuggestion.js - AI-powered tempo suggestion from audio analysis
 * Analyzes the rhythm of recorded audio to suggest the optimal BPM
 */

let localAppServices = {};

/**
 * Initialize the AI Tempo Suggestion module
 * @param {Object} appServices - App services from main.js
 */
export function initAITempoSuggestion(appServices) {
    localAppServices = appServices || {};
    console.log('[AITempoSuggestion] Module initialized');
}

/**
 * Analyze audio buffer and detect tempo
 * @param {AudioBuffer} audioBuffer - The audio to analyze
 * @returns {Object} Tempo analysis result
 */
export function analyzeAudioForTempo(audioBuffer) {
    if (!audioBuffer) {
        return { bpm: 120, confidence: 0, method: 'none', error: 'No audio buffer provided' };
    }

    try {
        // Get raw samples from first channel
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        // Detect onset events using energy-based onset detection
        const onsets = detectOnsets(channelData, sampleRate);

        if (onsets.length < 2) {
            return { bpm: 120, confidence: 0, method: 'onset', error: 'Not enough onsets detected' };
        }

        // Calculate intervals between onsets
        const intervals = calculateIntervals(onsets, sampleRate);

        // Cluster intervals to find predominant rhythm
        const clusters = clusterIntervals(intervals);

        // Find best BPM candidate
        const bestCluster = findBestCluster(clusters);

        // Convert interval to BPM
        let bpm = 60 / bestCluster.interval;
        
        // Normalize BPM to reasonable range (60-200)
        bpm = normalizeBPM(bpm);

        // Calculate confidence based on cluster consistency
        const confidence = calculateConfidence(bestCluster, intervals);

        return {
            bpm: Math.round(bpm * 10) / 10,
            confidence: confidence,
            method: 'onset-detection',
            onsetsDetected: onsets.length,
            intervalMs: Math.round(bestCluster.interval * 1000 * 10) / 10,
            beatPattern: bestCluster.count > 1 ? 'consistent' : 'variable'
        };
    } catch (error) {
        console.error('[AITempoSuggestion] Analysis error:', error);
        return { bpm: 120, confidence: 0, method: 'error', error: error.message };
    }
}

/**
 * Detect onset events in audio using energy-based approach
 */
function detectOnsets(samples, sampleRate) {
    const onsets = [];
    const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
    const hopSize = Math.floor(windowSize / 2);
    const energyHistory = [];

    // Calculate energy for each window
    for (let i = 0; i < samples.length - windowSize; i += hopSize) {
        let energy = 0;
        for (let j = 0; j < windowSize; j++) {
            energy += samples[i + j] * samples[i + j];
        }
        energy = Math.sqrt(energy / windowSize);
        energyHistory.push({ time: i / sampleRate, energy });
    }

    // Find peaks in energy (onsets)
    const threshold = calculateThreshold(energyHistory);
    
    for (let i = 1; i < energyHistory.length - 1; i++) {
        const prev = energyHistory[i - 1].energy;
        const curr = energyHistory[i].energy;
        const next = energyHistory[i + 1].energy;

        // Peak detection: local maximum above threshold and significant increase
        if (curr > prev && curr > next && curr > threshold) {
            const delta = curr - Math.max(prev, next);
            if (delta > threshold * 0.5) {
                onsets.push(energyHistory[i].time);
            }
        }
    }

    return onsets;
}

/**
 * Calculate adaptive threshold for onset detection
 */
function calculateThreshold(energyHistory) {
    if (energyHistory.length === 0) return 0;
    
    const energies = energyHistory.map(e => e.energy).sort((a, b) => a - b);
    const median = energies[Math.floor(energies.length / 2)];
    const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
    
    return (median + mean) / 2;
}

/**
 * Calculate time intervals between consecutive onsets
 */
function calculateIntervals(onsets, sampleRate) {
    const intervals = [];
    for (let i = 1; i < onsets.length; i++) {
        intervals.push(onsets[i] - onsets[i - 1]);
    }
    return intervals;
}

/**
 * Cluster similar intervals (tolerating rhythmic variations)
 */
function clusterIntervals(intervals) {
    if (intervals.length === 0) return [];

    // Sort intervals
    const sorted = [...intervals].sort((a, b) => a - b);
    
    // Use agglomerative clustering
    const clusters = [];
    let currentCluster = { intervals: [sorted[0]], sum: sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
        const interval = sorted[i];
        const avgInterval = currentCluster.sum / currentCluster.intervals.length;
        
        // If interval is within 30% of current average, add to cluster
        if (Math.abs(interval - avgInterval) / avgInterval < 0.3) {
            currentCluster.intervals.push(interval);
            currentCluster.sum += interval;
        } else {
            // Start new cluster
            clusters.push(currentCluster);
            currentCluster = { intervals: [interval], sum: interval };
        }
    }
    clusters.push(currentCluster);

    return clusters.map(c => ({
        interval: c.sum / c.intervals.length,
        count: c.intervals.length,
        stdDev: calculateStdDev(c.intervals)
    }));
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values) {
    if (values.length <= 1) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Find the best cluster (most consistent and frequent)
 */
function findBestCluster(clusters) {
    if (clusters.length === 0) {
        return { interval: 0.5, count: 0, stdDev: 0 };
    }

    // Score each cluster: prefer high count and low stdDev
    let bestCluster = clusters[0];
    let bestScore = -1;

    for (const cluster of clusters) {
        // Penalize high stdDev, reward high count
        const score = cluster.count / (1 + cluster.stdDev * 10);
        if (score > bestScore) {
            bestScore = score;
            bestCluster = cluster;
        }
    }

    return bestCluster;
}

/**
 * Normalize BPM to reasonable musical range
 */
function normalizeBPM(bpm) {
    // If BPM is too low, try doubling
    while (bpm < 50) bpm *= 2;
    // If BPM is too high, try halving
    while (bpm > 200) bpm /= 2;
    
    // Round to nearest common musical BPM values
    const commonBPMSteps = [60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190];
    
    // Find nearest common BPM
    let nearest = commonBPMSteps[0];
    let minDiff = Math.abs(bpm - nearest);
    
    for (const common of commonBPMSteps) {
        const diff = Math.abs(bpm - common);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = common;
        }
    }
    
    // Only use common BPM if within 10%
    if (minDiff / bpm < 0.1) {
        return nearest;
    }
    
    return Math.round(bpm);
}

/**
 * Calculate confidence based on interval consistency
 */
function calculateConfidence(bestCluster, allIntervals) {
    if (bestCluster.count < 2) return 0.2;
    
    // Calculate coefficient of variation (lower = more consistent)
    const cv = bestCluster.stdDev / bestCluster.interval;
    
    // Convert to 0-1 confidence (lower CV = higher confidence)
    let confidence = Math.max(0, 1 - cv * 5);
    
    // Boost confidence if we detected many onsets
    const countBoost = Math.min(0.2, bestCluster.count / 50);
    confidence = Math.min(1, confidence + countBoost);
    
    return Math.round(confidence * 100) / 100;
}

/**
 * Open the AI Tempo Suggestion panel
 */
export function openAITempoSuggestionPanel() {
    const existingPanel = document.getElementById('aiTempoSuggestionPanel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'aiTempoSuggestionPanel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(180deg, #1e1e2e 0%, #16162a 100%);
        border: 1px solid #444;
        border-radius: 12px;
        padding: 20px;
        min-width: 450px;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        color: #eee;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">🎵</span>
                <h3 style="margin:0;font-size:18px;font-weight:600;">AI Tempo Suggestion</h3>
            </div>
            <button id="closeTempoPanel" style="background:#333;border:none;color:#fff;padding:5px 12px;cursor:pointer;border-radius:4px;font-size:14px;">×</button>
        </div>
        
        <p style="margin:0 0 16px;font-size:13px;color:#888;line-height:1.5;">
            Analyze recorded audio to detect the rhythm and suggest the optimal BPM.
            Works best with clear rhythmic content like drums or percussion.
        </p>
        
        <div id="trackSelectionSection" style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;color:#888;margin-bottom:6px;">Select Track to Analyze</label>
            <select id="tempoAnalysisTrack" style="
                width: 100%;
                padding: 10px 12px;
                background: #2a2a3e;
                border: 1px solid #444;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="">-- Select a track --</option>
            </select>
        </div>
        
        <div id="audioClipSelection" style="margin-bottom:16px;display:none;">
            <label style="display:block;font-size:12px;color:#888;margin-bottom:6px;">Select Clip</label>
            <select id="tempoAnalysisClip" style="
                width: 100%;
                padding: 10px 12px;
                background: #2a2a3e;
                border: 1px solid #444;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
                cursor: pointer;
            ">
                <option value="">-- Select a clip --</option>
            </select>
        </div>
        
        <button id="analyzeBtn" style="
            width: 100%;
            padding: 12px;
            background: linear-gradient(180deg, #4a9eff 0%, #2a6eff 100%);
            border: none;
            border-radius: 6px;
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 16px;
        ">Analyze Audio</button>
        
        <div id="analysisResults" style="display:none;">
            <div style="
                background: #0a0a1e;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
            ">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span style="color:#888;font-size:12px;">Detected BPM</span>
                    <span id="detectedBpm" style="font-size:32px;font-weight:700;color:#4a9eff;">--</span>
                </div>
                
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="color:#888;font-size:12px;">Confidence</span>
                    <span id="confidenceScore" style="font-size:16px;color:#4ade80;">--</span>
                </div>
                
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="color:#888;font-size:12px;">Method</span>
                    <span id="analysisMethod" style="font-size:12px;color:#888;">--</span>
                </div>
                
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="color:#888;font-size:12px;">Beat Pattern</span>
                    <span id="beatPattern" style="font-size:12px;color:#888;">--</span>
                </div>
            </div>
            
            <div style="display:flex;gap:8px;">
                <button id="applyBpmBtn" style="
                    flex: 1;
                    padding: 10px;
                    background: #22c55e;
                    border: none;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                ">Apply BPM</button>
                <button id="discardBpmBtn" style="
                    flex: 1;
                    padding: 10px;
                    background: #444;
                    border: none;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 13px;
                    cursor: pointer;
                ">Discard</button>
            </div>
        </div>
        
        <div id="errorMessage" style="display:none;color:#ef4444;font-size:13px;text-align:center;padding:12px;background:#2a1a1a;border-radius:6px;margin-bottom:16px;">
        </div>
    `;

    document.body.appendChild(panel);

    // Populate track dropdown
    const trackSelect = panel.querySelector('#tempoAnalysisTrack');
    const clipSelect = panel.querySelector('#audioClipSelection');
    const analyzeBtn = panel.querySelector('#analyzeBtn');
    const resultsDiv = panel.querySelector('#analysisResults');
    const errorDiv = panel.querySelector('#errorMessage');

    // Load tracks
    const loadTracks = () => {
        const tracks = localAppServices.getTracks?.() || [];
        trackSelect.innerHTML = '<option value="">-- Select a track --</option>';
        
        tracks.filter(t => t.type === 'Audio' || t.timelineClips?.length > 0).forEach(track => {
            const option = document.createElement('option');
            option.value = track.id;
            option.textContent = `${track.name || 'Track ' + track.id} (${track.type})`;
            trackSelect.appendChild(option);
        });
    };

    // Load clips for selected track
    const loadClips = (trackId) => {
        const tracks = localAppServices.getTracks?.() || [];
        const track = tracks.find(t => t.id === trackId);
        
        if (track?.timelineClips?.length > 0) {
            clipSelect.style.display = 'block';
            clipSelect.innerHTML = '<option value="">-- Select a clip --</option>';
            
            track.timelineClips.forEach(clip => {
                const option = document.createElement('option');
                option.value = clip.id;
                option.textContent = clip.name || `Clip ${clip.id.slice(-4)}`;
                clipSelect.appendChild(option);
            });
        } else {
            clipSelect.style.display = 'none';
        }
    };

    // Analyze audio
    let analysisResult = null;

    const performAnalysis = async () => {
        const trackId = parseInt(trackSelect.value, 10);
        const clipId = clipSelect.value;

        if (!trackId) {
            errorDiv.textContent = 'Please select a track first';
            errorDiv.style.display = 'block';
            return;
        }

        const tracks = localAppServices.getTracks?.() || [];
        const track = tracks.find(t => t.id === trackId);

        if (!track) {
            errorDiv.textContent = 'Track not found';
            errorDiv.style.display = 'block';
            return;
        }

        // Find audio buffer from clip or track
        let audioBuffer = null;

        if (clipId) {
            const clip = track.timelineClips?.find(c => c.id === clipId);
            audioBuffer = clip?.audioBuffer;
        }

        if (!audioBuffer && track.audioBuffer) {
            audioBuffer = track.audioBuffer;
        }

        if (!audioBuffer && track.samplerAudioData) {
            // Try to get audio from sampler
            audioBuffer = track.samplerAudioData;
        }

        if (!audioBuffer) {
            errorDiv.textContent = 'No audio data found in this track. Please record audio first.';
            errorDiv.style.display = 'block';
            resultsDiv.style.display = 'none';
            return;
        }

        errorDiv.style.display = 'none';
        analyzeBtn.textContent = 'Analyzing...';
        analyzeBtn.disabled = true;

        // Perform analysis (could be async for more complex analysis)
        setTimeout(() => {
            analysisResult = analyzeAudioForTempo(audioBuffer);

            // Update UI
            panel.querySelector('#detectedBpm').textContent = analysisResult.bpm;
            panel.querySelector('#confidenceScore').textContent = `${(analysisResult.confidence * 100).toFixed(0)}%`;
            panel.querySelector('#analysisMethod').textContent = analysisResult.method;
            panel.querySelector('#beatPattern').textContent = analysisResult.beatPattern || 'N/A';

            resultsDiv.style.display = 'block';
            analyzeBtn.textContent = 'Analyze Again';
            analyzeBtn.disabled = false;
        }, 500);
    };

    // Apply BPM to project
    const applyBPM = () => {
        if (analysisResult && localAppServices.setTempo) {
            localAppServices.setTempo(analysisResult.bpm);
            localAppServices.showNotification?.(`BPM set to ${analysisResult.bpm}`, 2000);
            panel.remove();
        }
    };

    // Event listeners
    trackSelect.addEventListener('change', (e) => {
        loadClips(parseInt(e.target.value, 10));
        resultsDiv.style.display = 'none';
        errorDiv.style.display = 'none';
    });

    analyzeBtn.addEventListener('click', performAnalysis);

    panel.querySelector('#applyBpmBtn').addEventListener('click', applyBPM);
    panel.querySelector('#discardBpmBtn').addEventListener('click', () => panel.remove());
    panel.querySelector('#closeTempoPanel').addEventListener('click', () => panel.remove());

    // Initial load
    loadTracks();
}

// Export for use in other modules
export default {
    initAITempoSuggestion,
    analyzeAudioForTempo,
    openAITempoSuggestionPanel
};