// js/SampleImportPreview.js - Preview samples before importing with tempo matching
import { getTempoState, getTimeSignatureChanges } from './state.js';

/**
 * SampleImportPreview - Preview samples before importing with tempo matching
 * 
 * This module provides:
 * 1. Sample preview with play/stop controls
 * 2. Tempo detection from imported samples
 * 3. Optional tempo matching/scaling
 */

let previewPlayer = null;
let previewAudioBuffer = null;
let previewSource = null;
let previewStartTime = 0;
let previewDuration = 0;
let isPreviewPlaying = false;

/**
 * Initialize the preview player with an audio context
 * @param {Object} audioContext - Tone.js audio context
 */
export function initSampleImportPreview(audioContext) {
    if (!previewPlayer && typeof Tone !== 'undefined') {
        previewPlayer = Tone.Player();
        previewPlayer.connect(Tone.context.destination);
    }
    return previewPlayer;
}

/**
 * Load a sample for preview
 * @param {string|ArrayBuffer} source - URL or ArrayBuffer of audio file
 * @param {Object} audioContext - Tone.js audio context (optional, uses Tone.context)
 * @returns {Promise<Object>} Preview info { duration, sampleRate, tempo, error }
 */
export async function loadSampleForPreview(source) {
    try {
        // Stop any current preview
        stopPreview();

        // Load the audio buffer
        if (typeof source === 'string') {
            const response = await fetch(source);
            if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            previewAudioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
        } else if (source instanceof ArrayBuffer) {
            previewAudioBuffer = await Tone.context.decodeAudioData(source.slice(0));
        } else {
            throw new Error('Invalid source type');
        }

        previewDuration = previewAudioBuffer.duration;
        
        // Analyze for tempo
        const detectedTempo = detectTempoFromAudio(previewAudioBuffer);
        
        return {
            duration: previewDuration,
            sampleRate: previewAudioBuffer.sampleRate,
            channels: previewAudioBuffer.numberOfChannels,
            tempo: detectedTempo,
            error: null
        };
    } catch (error) {
        console.error('[SampleImportPreview] Error loading sample:', error);
        return {
            duration: 0,
            sampleRate: 0,
            tempo: 0,
            error: error.message
        };
    }
}

/**
 * Play the loaded preview
 * @param {number} startTime - Optional start time offset
 * @param {number} loopStart - Optional loop start point
 * @param {number} loopEnd - Optional loop end point
 */
export function playPreview(startTime = 0, loopStart = null, loopEnd = null) {
    if (!previewAudioBuffer) {
        console.warn('[SampleImportPreview] No sample loaded');
        return;
    }

    stopPreview();

    previewSource = Tone.context.createBufferSource();
    previewSource.buffer = previewAudioBuffer;
    
    if (loopStart !== null && loopEnd !== null) {
        previewSource.loop = true;
        previewSource.loopStart = loopStart;
        previewSource.loopEnd = loopEnd;
    }

    const gainNode = Tone.context.createGain();
    previewSource.connect(gainNode);
    gainNode.connect(Tone.context.destination);
    
    previewSource.start(0, startTime);
    previewStartTime = Tone.context.currentTime;
    isPreviewPlaying = true;

    // Auto-stop at end (if not looping)
    if (!previewSource.loop) {
        setTimeout(() => {
            if (isPreviewPlaying) {
                stopPreview();
            }
        }, (previewDuration - startTime) * 1000);
    }
}

/**
 * Stop the preview
 */
export function stopPreview() {
    if (previewSource) {
        try {
            previewSource.stop();
            previewSource.disconnect();
        } catch (e) {
            // Ignore errors from already-stopped sources
        }
        previewSource = null;
    }
    isPreviewPlaying = false;
}

/**
 * Check if preview is playing
 * @returns {boolean}
 */
export function isPreviewPlayingState() {
    return isPreviewPlaying;
}

/**
 * Get current preview position
 * @returns {number} Current position in seconds
 */
export function getPreviewPosition() {
    if (!isPreviewPlaying) return 0;
    return Tone.context.currentTime - previewStartTime;
}

/**
 * Detect tempo from audio using onset detection
 * @param {AudioBuffer} audioBuffer - The audio to analyze
 * @returns {number} Detected BPM or 0 if detection failed
 */
function detectTempoFromAudio(audioBuffer) {
    try {
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        const duration = audioBuffer.duration;
        
        // Simple onset detection using energy differences
        const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
        const hopSize = Math.floor(windowSize / 2);
        const energies = [];
        
        for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += channelData[i + j] * channelData[i + j];
            }
            energies.push(Math.sqrt(energy / windowSize));
        }
        
        // Find peaks (onsets)
        const threshold = energies.reduce((a, b) => a + b, 0) / energies.length * 1.5;
        const onsets = [];
        for (let i = 1; i < energies.length - 1; i++) {
            if (energies[i] > threshold && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
                onsets.push(i * hopSize / sampleRate);
            }
        }
        
        if (onsets.length < 2) return 0;
        
        // Calculate average interval between onsets
        const intervals = [];
        for (let i = 1; i < onsets.length; i++) {
            const interval = onsets[i] - onsets[i - 1];
            if (interval > 0.1 && interval < 2.0) { // Reasonable beat interval range
                intervals.push(interval);
            }
        }
        
        if (intervals.length === 0) return 0;
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const bpm = 60 / avgInterval;
        
        // Normalize to reasonable BPM range (60-180)
        let normalizedBpm = bpm;
        while (normalizedBpm < 60) normalizedBpm *= 2;
        while (normalizedBpm > 180) normalizedBpm /= 2;
        
        return Math.round(normalizedBpm * 10) / 10;
    } catch (error) {
        console.warn('[SampleImportPreview] Tempo detection failed:', error);
        return 0;
    }
}

/**
 * Calculate tempo ratio for matching sample to project tempo
 * @param {number} sampleTempo - Sample's detected tempo (BPM)
 * @param {number} projectTempo - Project tempo (BPM)
 * @returns {number} Ratio to scale sample duration (1 = no change)
 */
export function calculateTempoMatchRatio(sampleTempo, projectTempo) {
    if (!sampleTempo || !projectTempo || sampleTempo <= 0 || projectTempo <= 0) {
        return 1;
    }
    return projectTempo / sampleTempo;
}

/**
 * Get duration after tempo matching
 * @param {number} originalDuration - Original sample duration in seconds
 * @param {number} tempoRatio - Tempo matching ratio
 * @returns {number} Adjusted duration in seconds
 */
export function getTempoMatchedDuration(originalDuration, tempoRatio) {
    return originalDuration / tempoRatio;
}

/**
 * Generate a preview with tempo matching applied
 * @param {Object} options - Options { originalDuration, sampleTempo, projectTempo, preservePitch }
 * @returns {Object} Adjusted preview settings
 */
export function generateTempoMatchedPreview(options) {
    const { originalDuration, sampleTempo, projectTempo, preservePitch = true } = options;
    
    const ratio = calculateTempoMatchRatio(sampleTempo, projectTempo);
    const adjustedDuration = getTempoMatchedDuration(originalDuration, ratio);
    
    return {
        originalDuration,
        sampleTempo,
        projectTempo,
        tempoRatio: ratio,
        adjustedDuration,
        preservePitch,
        warning: ratio < 0.5 || ratio > 2 
            ? 'Large tempo change may affect audio quality'
            : null
    };
}

/**
 * Detect time signature from audio characteristics
 * @param {AudioBuffer} audioBuffer - The audio to analyze
 * @returns {Object} Detected time signature { numerator, denominator }
 */
function detectTimeSignatureFromAudio(audioBuffer) {
    // Simple heuristic based on duration and detected beats
    const duration = audioBuffer.duration;
    const tempo = detectTempoFromAudio(audioBuffer);
    
    if (!tempo) {
        return { numerator: 4, denominator: 4 }; // Default
    }
    
    // Heuristic: shorter loops tend to be 4/4 or 2/4
    if (duration < 4) {
        return { numerator: 4, denominator: 4 };
    }
    
    // Common time signatures
    const measuresPerMinute = tempo / 4; // Assuming 4 beats per measure
    const totalMeasures = (duration / 60) * measuresPerMinute;
    
    if (Math.abs(totalMeasures - Math.round(totalMeasures)) < 0.1) {
        const roundedMeasures = Math.round(totalMeasures);
        if (roundedMeasures % 3 === 0) {
            return { numerator: 6, denominator: 8 }; // Compound duple
        }
    }
    
    return { numerator: 4, denominator: 4 };
}

export default {
    initSampleImportPreview,
    loadSampleForPreview,
    playPreview,
    stopPreview,
    isPreviewPlayingState,
    getPreviewPosition,
    calculateTempoMatchRatio,
    getTempoMatchedDuration,
    generateTempoMatchedPreview
};
