// js/GhostTrack.js - Create a quieter copy of a track for reference without affecting mix
/**
 * Ghost Track - Create a quieter copy of a track for reference without affecting mix
 * 
 * A ghost track is a silent or very quiet duplicate of a track that:
 * 1. Can be used for A/B comparison without altering the main mix
 * 2. Allows listening to individual tracks in context
 * 3. Provides visual feedback of what the original track sounds like
 * 4. Can be soloed/muted independently from the main track
 */

import { getTracksState } from './state.js';

/**
 * Ghost track state management
 */
let ghostTracks = {}; // { ghostId: { originalTrackId, ghostTrackId, volumeDb, pan, muted, solo, color } }
let ghostTrackIdCounter = 1;

/**
 * Create a ghost track from an existing track
 * @param {number} originalTrackId - The track to create ghost from
 * @param {Object} options - Options { volumeDb: -20 default, pan: 0, muted: false, solo: false, color: '#888888' }
 * @returns {Object} Ghost track info or null if failed
 */
export function createGhostTrack(originalTrackId, options = {}) {
    const tracks = getTracksState();
    const originalTrack = tracks.find(t => t.id === originalTrackId);
    
    if (!originalTrack) {
        console.warn(`[GhostTrack] Original track ${originalTrackId} not found`);
        return null;
    }
    
    const ghostId = `ghost_${ghostTrackIdCounter++}`;
    const volumeDb = options.volumeDb !== undefined ? options.volumeDb : -20; // Default -20dB
    const pan = options.pan !== undefined ? options.pan : 0;
    const muted = options.muted !== undefined ? options.muted : false;
    const solo = options.solo !== undefined ? options.solo : false;
    const color = options.color || '#888888';
    
    ghostTracks[ghostId] = {
        id: ghostId,
        originalTrackId: originalTrackId,
        name: `Ghost: ${originalTrack.name}`,
        volumeDb: volumeDb,
        pan: pan,
        muted: muted,
        solo: solo,
        color: color,
        createdAt: new Date().toISOString()
    };
    
    console.log(`[GhostTrack] Created ghost track for "${originalTrack.name}" (${ghostId})`);
    
    return ghostTracks[ghostId];
}

/**
 * Get all ghost tracks
 * @returns {Array<Object>}
 */
export function getAllGhostTracks() {
    return Object.values(ghostTracks);
}

/**
 * Get ghost tracks for a specific original track
 * @param {number} originalTrackId - The original track ID
 * @returns {Array<Object>}
 */
export function getGhostTracksForOriginal(originalTrackId) {
    return Object.values(ghostTracks).filter(g => g.originalTrackId === originalTrackId);
}

/**
 * Get a specific ghost track
 * @param {string} ghostId - The ghost track ID
 * @returns {Object|null}
 */
export function getGhostTrack(ghostId) {
    return ghostTracks[ghostId] || null;
}

/**
 * Update ghost track properties
 * @param {string} ghostId - The ghost track ID
 * @param {Object} updates - Properties to update { volumeDb, pan, muted, solo, color }
 * @returns {boolean}
 */
export function updateGhostTrack(ghostId, updates) {
    if (!ghostTracks[ghostId]) return false;
    
    if (updates.volumeDb !== undefined) {
        ghostTracks[ghostId].volumeDb = Math.max(-60, Math.min(0, updates.volumeDb));
    }
    if (updates.pan !== undefined) {
        ghostTracks[ghostId].pan = Math.max(-1, Math.min(1, updates.pan));
    }
    if (updates.muted !== undefined) {
        ghostTracks[ghostId].muted = !!updates.muted;
    }
    if (updates.solo !== undefined) {
        ghostTracks[ghostId].solo = !!updates.solo;
    }
    if (updates.color !== undefined) {
        ghostTracks[ghostId].color = updates.color;
    }
    
    console.log(`[GhostTrack] Updated ghost track ${ghostId}`);
    return true;
}

/**
 * Set ghost track volume
 * @param {string} ghostId - The ghost track ID
 * @param {number} volumeDb - Volume in dB (-60 to 0)
 */
export function setGhostTrackVolume(ghostId, volumeDb) {
    updateGhostTrack(ghostId, { volumeDb });
}

/**
 * Set ghost track pan
 * @param {string} ghostId - The ghost track ID
 * @param {number} pan - Pan value (-1 to 1)
 */
export function setGhostTrackPan(ghostId, pan) {
    updateGhostTrack(ghostId, { pan });
}

/**
 * Toggle ghost track mute
 * @param {string} ghostId - The ghost track ID
 * @returns {boolean} New mute state
 */
export function toggleGhostTrackMute(ghostId) {
    if (!ghostTracks[ghostId]) return false;
    ghostTracks[ghostId].muted = !ghostTracks[ghostId].muted;
    return ghostTracks[ghostId].muted;
}

/**
 * Toggle ghost track solo
 * @param {string} ghostId - The ghost track ID
 * @returns {boolean} New solo state
 */
export function toggleGhostTrackSolo(ghostId) {
    if (!ghostTracks[ghostId]) return false;
    ghostTracks[ghostId].solo = !ghostTracks[ghostId].solo;
    return ghostTracks[ghostId].solo;
}

/**
 * Delete a ghost track
 * @param {string} ghostId - The ghost track ID
 * @returns {boolean}
 */
export function deleteGhostTrack(ghostId) {
    if (ghostTracks[ghostId]) {
        delete ghostTracks[ghostId];
        console.log(`[GhostTrack] Deleted ghost track ${ghostId}`);
        return true;
    }
    return false;
}

/**
 * Delete all ghost tracks for a specific original track
 * @param {number} originalTrackId - The original track ID
 * @returns {number} Number of ghost tracks deleted
 */
export function deleteGhostTracksForOriginal(originalTrackId) {
    const toDelete = Object.keys(ghostTracks).filter(
        ghostId => ghostTracks[ghostId].originalTrackId === originalTrackId
    );
    toDelete.forEach(ghostId => delete ghostTracks[ghostId]);
    return toDelete.length;
}

/**
 * Clear all ghost tracks
 */
export function clearAllGhostTracks() {
    ghostTracks = {};
    ghostTrackIdCounter = 1;
    console.log('[GhostTrack] All ghost tracks cleared');
}

/**
 * Convert dB to linear gain
 * @param {number} db - Volume in dB
 * @returns {number} Linear gain value
 */
function dbToGain(db) {
    return Math.pow(10, db / 20);
}

/**
 * Get the effective volume of a ghost track as a gain value
 * @param {string} ghostId - The ghost track ID
 * @returns {number} Linear gain (0-1)
 */
export function getGhostTrackGain(ghostId) {
    const ghost = ghostTracks[ghostId];
    if (!ghost) return 0;
    return dbToGain(ghost.volumeDb);
}

/**
 * Check if any ghost tracks are soloed
 * @returns {boolean}
 */
export function isAnyGhostTrackSoloed() {
    return Object.values(ghostTracks).some(g => g.solo);
}

/**
 * Get ghost tracks that should be heard (considering solo state)
 * @returns {Array<Object>}
 */
export function getAudibleGhostTracks() {
    const anySoloed = isAnyGhostTrackSoloed();
    
    if (!anySoloed) {
        return Object.values(ghostTracks).filter(g => !g.muted);
    }
    
    return Object.values(ghostTracks).filter(g => g.solo && !g.muted);
}

/**
 * Export ghost track state for project save
 * @returns {Object}
 */
export function exportGhostTrackState() {
    return JSON.parse(JSON.stringify({
        ghostTracks,
        ghostTrackIdCounter
    }));
}

/**
 * Import ghost track state from project load
 * @param {Object} state - Previously exported state
 */
export function importGhostTrackState(state) {
    if (state) {
        if (state.ghostTracks) {
            ghostTracks = state.ghostTracks;
        }
        if (state.ghostTrackIdCounter) {
            ghostTrackIdCounter = state.ghostTrackIdCounter;
        }
        console.log(`[GhostTrack] Imported ${Object.keys(ghostTracks).length} ghost tracks`);
    }
}

export default {
    createGhostTrack,
    getAllGhostTracks,
    getGhostTracksForOriginal,
    getGhostTrack,
    updateGhostTrack,
    setGhostTrackVolume,
    setGhostTrackPan,
    toggleGhostTrackMute,
    toggleGhostTrackSolo,
    deleteGhostTrack,
    deleteGhostTracksForOriginal,
    clearAllGhostTracks,
    getGhostTrackGain,
    isAnyGhostTrackSoloed,
    getAudibleGhostTracks,
    exportGhostTrackState,
    importGhostTrackState
};