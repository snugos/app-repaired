// js/AudioNormalization.js - One-click audio normalization to peak/RMS levels

import { storeAudio, getAudio } from './db.js';

/**
 * Normalizes an audio buffer to the specified target level.
 * @param {Float32Array|ToneAudioBuffer} buffer - The audio buffer to normalize
 * @param {number} targetDb - Target level in dB (default -0.1 for just below clipping)
 * @param {string} mode - 'peak' or 'rms' normalization
 * @returns {Object} { normalizedBuffer, peakLevel, rmsLevel, gainApplied }
 */
export function normalizeAudioBuffer(buffer, targetDb = -0.1, mode = 'peak') {
    try {
        let channelData;
        let sampleRate = 44100;

        if (buffer._buffer) {
            // ToneAudioBuffer
            const internalBuffer = buffer._buffer;
            sampleRate = internalBuffer.sampleRate;
            const leftChannel = internalBuffer.getChannelData(0);
            const rightChannel = internalBuffer.numberOfChannels > 1 
                ? internalBuffer.getChannelData(1) 
                : leftChannel;
            channelData = { left: leftChannel, right: rightChannel, channels: internalBuffer.numberOfChannels };
        } else if (buffer.left && buffer.right) {
            // Already separated channel data
            channelData = buffer;
        } else if (buffer.length) {
            // Float32Array
            channelData = { left: buffer, right: buffer, channels: 1 };
        } else {
            throw new Error('Invalid buffer format');
        }

        const targetLinear = Math.pow(10, targetDb / 20);
        let peakLevel = 0;
        let sumSquares = 0;
        let sampleCount = 0;

        // Find peak and RMS for left channel
        for (let i = 0; i < channelData.left.length; i++) {
            const sample = Math.abs(channelData.left[i]);
            if (sample > peakLevel) peakLevel = sample;
            sumSquares += channelData.left[i] * channelData.left[i];
            sampleCount++;
        }

        // Right channel
        if (channelData.channels > 1) {
            for (let i = 0; i < channelData.right.length; i++) {
                const sample = Math.abs(channelData.right[i]);
                if (sample > peakLevel) peakLevel = sample;
                sumSquares += channelData.right[i] * channelData.right[i];
            }
        }

        const rmsLevel = Math.sqrt(sumSquares / sampleCount);
        const peakDb = 20 * Math.log10(peakLevel || 0.0001);
        const rmsDb = 20 * Math.log10(rmsLevel || 0.0001);

        let currentReference;
        if (mode === 'rms') {
            currentReference = rmsLevel;
        } else {
            currentReference = peakLevel;
        }

        if (currentReference === 0) {
            return { success: false, error: 'Silent audio - nothing to normalize' };
        }

        const gainFactor = targetLinear / currentReference;
        const gainDb = 20 * Math.log10(gainFactor);

        // Apply normalization
        const leftNormalized = new Float32Array(channelData.left.length);
        const rightNormalized = channelData.channels > 1 
            ? new Float32Array(channelData.right.length) 
            : leftNormalized;

        for (let i = 0; i < channelData.left.length; i++) {
            leftNormalized[i] = Math.max(-1, Math.min(1, channelData.left[i] * gainFactor));
        }

        if (channelData.channels > 1) {
            for (let i = 0; i < channelData.right.length; i++) {
                rightNormalized[i] = Math.max(-1, Math.min(1, channelData.right[i] * gainFactor));
            }
        }

        console.log(`[AudioNormalization] Applied ${gainDb.toFixed(2)} dB gain (${mode} mode). Peak: ${peakDb.toFixed(1)} dB -> ${targetDb} dB`);

        return {
            success: true,
            leftChannel: leftNormalized,
            rightChannel: rightNormalized,
            sampleRate: sampleRate,
            channels: channelData.channels,
            peakLevel,
            rmsLevel,
            gainApplied: gainDb,
            targetDb,
            mode
        };
    } catch (error) {
        console.error('[AudioNormalization] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Normalize a clip's audio data and return the normalized ArrayBuffer.
 * @param {Object} clip - Clip object with audioData
 * @param {number} targetDb - Target level in dB
 * @param {string} mode - 'peak' or 'rms'
 * @returns {Promise<ArrayBuffer>}
 */
export async function normalizeClipAudio(clip, targetDb = -0.1, mode = 'peak') {
    try {
        if (!clip || !clip.audioData) {
            return { success: false, error: 'Clip has no audio data' };
        }

        // Get the audio buffer from Tone.js buffer
        const toneBuffer = clip.audioBuffer;
        if (!toneBuffer || !toneBuffer._buffer) {
            return { success: false, error: 'Audio buffer not loaded' };
        }

        const result = normalizeAudioBuffer(toneBuffer, targetDb, mode);
        if (!result.success) {
            return result;
        }

        // Convert back to ArrayBuffer (WAV format)
        const arrayBuffer = audioChannelsToWav(result.leftChannel, result.rightChannel, result.sampleRate);
        return { success: true, arrayBuffer, result };
    } catch (error) {
        console.error('[AudioNormalization] normalizeClipAudio error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Convert stereo float32 channels to WAV ArrayBuffer.
 */
function audioChannelsToWav(leftChannel, rightChannel, sampleRate) {
    const numChannels = leftChannel === rightChannel ? 1 : 2;
    const length = leftChannel.length;
    const buffer = new ArrayBuffer(44 + length * numChannels * 2);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length * numChannels * 2, true);

    // Interleave and write samples
    let offset = 44;
    for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, leftChannel[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
        if (numChannels > 1) {
            const rSample = Math.max(-1, Math.min(1, rightChannel[i]));
            view.setInt16(offset, rSample < 0 ? rSample * 0x8000 : rSample * 0x7FFF, true);
            offset += 2;
        }
    }

    return buffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// State for normalization presets
let normalizationPresets = {
    'cd-standard': { targetDb: -0.1, mode: 'peak', name: 'CD Standard (-0.1 dB)' },
    'broadcast': { targetDb: -1.0, mode: 'peak', name: 'Broadcast (-1.0 dB)' },
    'streaming': { targetDb: -1.0, mode: 'rms', name: 'Streaming (-1.0 dB RMS)' },
    'quiet': { targetDb: -3.0, mode: 'peak', name: 'Quiet (-3.0 dB)' }
};

export function getNormalizationPresets() {
    return JSON.parse(JSON.stringify(normalizationPresets));
}

export function getNormalizationPreset(name) {
    return normalizationPresets[name] ? JSON.parse(JSON.stringify(normalizationPresets[name])) : null;
}

export function saveNormalizationPreset(name, targetDb, mode) {
    normalizationPresets[name] = {
        targetDb: parseFloat(targetDb) || -0.1,
        mode: mode || 'peak',
        name: name
    };
    console.log(`[AudioNormalization] Saved preset "${name}": ${targetDb} dB (${mode})`);
    return true;
}

export function deleteNormalizationPreset(name) {
    if (normalizationPresets[name] && !['cd-standard', 'broadcast', 'streaming', 'quiet'].includes(name)) {
        delete normalizationPresets[name];
        return true;
    }
    return false;
}