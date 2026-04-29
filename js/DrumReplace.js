// js/DrumReplace.js - Drum Replace Feature
// Replace detected drum hits in recorded audio with samples from a library

let localAppServices = {};
let detectedHits = []; // Array of {time, duration, confidence, replacedWith}
let isAnalyzing = false;

export function initDrumReplace(services) {
    localAppServices = services;
    console.log('[DrumReplace] Initialized');
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