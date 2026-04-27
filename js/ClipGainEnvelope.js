// js/ClipGainEnvelope.js - Clip Gain Envelope Core Module
// Visual envelope editor for clip-level volume automation with drawable curves

let localAppServices = {};
let activeClipId = null;
let envelopePoints = []; // Array of { time: 0-1 normalized, gain: 0-2 }
const ENVELOPE_HEIGHT = 80;
const MIN_GAIN = 0;
const MAX_GAIN = 2;
const DEFAULT_GAIN = 1;

/**
 * Initialize the clip gain envelope module.
 * @param {Object} appServices - Application services from main.js
 */
export function initClipGainEnvelope(appServices) {
    localAppServices = appServices || {};
    console.log('[ClipGainEnvelope] Core module initialized');
}

/**
 * Open the clip gain envelope editor for a specific clip.
 * @param {string} clipId - The ID of the clip to edit
 * @param {number} clipDuration - Duration of the clip in seconds
 */
export function openClipGainEnvelopeEditor(clipId, clipDuration = 10) {
    activeClipId = clipId;
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    let clipData = null;
    
    // Find the clip in tracks
    for (const track of tracks) {
        if (track.timelineClips) {
            const found = track.timelineClips.find(c => c.id === clipId);
            if (found) {
                clipData = found;
                break;
            }
        }
    }
    
    // Initialize envelope points from clip data or create default
    if (clipData && clipData.gainEnvelope) {
        envelopePoints = JSON.parse(JSON.stringify(clipData.gainEnvelope));
    } else {
        envelopePoints = [
            { time: 0, gain: DEFAULT_GAIN },
            { time: 1, gain: DEFAULT_GAIN }
        ];
    }
    
    // Trigger UI in ui.js
    if (localAppServices.openClipGainEnvelopePanel) {
        localAppServices.openClipGainEnvelopePanel(clipId, clipDuration);
    }
}

/**
 * Get the gain value at a specific time for a clip.
 * Uses linear interpolation between envelope points.
 * @param {string} clipId - The clip ID
 * @param {number} normalizedTime - Time from 0 to 1
 * @returns {number} Gain value at the given time
 */
export function getGainAtTime(clipId, normalizedTime) {
    if (!envelopePoints || envelopePoints.length === 0) return DEFAULT_GAIN;
    
    const sortedPoints = [...envelopePoints].sort((a, b) => a.time - b.time);
    
    // Before first point
    if (normalizedTime <= sortedPoints[0].time) {
        return sortedPoints[0].gain;
    }
    
    // After last point
    if (normalizedTime >= sortedPoints[sortedPoints.length - 1].time) {
        return sortedPoints[sortedPoints.length - 1].gain;
    }
    
    // Find surrounding points and interpolate
    for (let i = 0; i < sortedPoints.length - 1; i++) {
        if (normalizedTime >= sortedPoints[i].time && normalizedTime <= sortedPoints[i + 1].time) {
            const t1 = sortedPoints[i].time;
            const t2 = sortedPoints[i + 1].time;
            const g1 = sortedPoints[i].gain;
            const g2 = sortedPoints[i + 1].gain;
            
            const t = (normalizedTime - t1) / (t2 - t1);
            return g1 + (g2 - g1) * t;
        }
    }
    
    return DEFAULT_GAIN;
}

/**
 * Get the envelope points for a clip.
 * @param {string} clipId - The clip ID
 * @returns {Array} Array of envelope points
 */
export function getEnvelopePoints(clipId) {
    return JSON.parse(JSON.stringify(envelopePoints));
}

/**
 * Set envelope points (used by UI).
 */
export function setEnvelopePoints(points) {
    envelopePoints = points ? JSON.parse(JSON.stringify(points)) : [];
}

/**
 * Get current envelope points.
 */
export function getCurrentEnvelopePoints() {
    return JSON.parse(JSON.stringify(envelopePoints));
}

/**
 * Save the envelope to the clip data.
 */
export function saveEnvelopeToClip(clipId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    for (const track of tracks) {
        if (track.timelineClips) {
            const clipIndex = track.timelineClips.findIndex(c => c.id === clipId);
            if (clipIndex !== -1) {
                track.timelineClips[clipIndex].gainEnvelope = JSON.parse(JSON.stringify(envelopePoints));
                
                console.log(`[ClipGainEnvelope] Saved envelope to clip ${clipId.substring(0, 12)}...`);
                return true;
            }
        }
    }
    return false;
}