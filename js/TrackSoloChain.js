// js/TrackSoloChain.js - Track Solo Chain Feature
// Mute all tracks except selected chain of tracks for focused listening

let localAppServices = {};
let soloChainTracks = [];
let soloChainHistory = [];
const MAX_HISTORY = 50;

/**
 * Initialize TrackSoloChain module with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initTrackSoloChain(appServices) {
    localAppServices = appServices || {};
    soloChainTracks = [];
    soloChainHistory = [];
    console.log('[TrackSoloChain] Module initialized');
}

/**
 * Get the current solo chain tracks
 * @returns {Array<number>} Array of track IDs in the solo chain
 */
export function getSoloChainTracks() {
    return [...soloChainTracks];
}

/**
 * Set the solo chain tracks (replaces current chain)
 * @param {Array<number>} trackIds - Array of track IDs to include in chain
 */
export function setSoloChainTracks(trackIds) {
    soloChainTracks = [...(trackIds || [])];
    applySoloChain();
}

/**
 * Add a track to the solo chain
 * @param {number} trackId - Track ID to add
 */
export function addTrackToSoloChain(trackId) {
    if (!soloChainTracks.includes(trackId)) {
        soloChainTracks.push(trackId);
        applySoloChain();
    }
}

/**
 * Remove a track from the solo chain
 * @param {number} trackId - Track ID to remove
 */
export function removeTrackFromSoloChain(trackId) {
    const idx = soloChainTracks.indexOf(trackId);
    if (idx > -1) {
        soloChainTracks.splice(idx, 1);
        applySoloChain();
    }
}

/**
 * Toggle a track in the solo chain
 * @param {number} trackId - Track ID to toggle
 */
export function toggleTrackInSoloChain(trackId) {
    if (soloChainTracks.includes(trackId)) {
        removeTrackFromSoloChain(trackId);
    } else {
        addTrackToSoloChain(trackId);
    }
}

/**
 * Clear the solo chain (unmute all tracks)
 */
export function clearSoloChain() {
    const prev = [...soloChainTracks];
    if (prev.length > 0) {
        recordSoloChainChange(prev, 'clear');
    }
    soloChainTracks = [];
    restoreOriginalMuteStates();
}

/**
 * Apply the solo chain - mutes all tracks not in the chain
 */
function applySoloChain() {
    if (soloChainTracks.length === 0) {
        restoreOriginalMuteStates();
        return;
    }

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    tracks.forEach(track => {
        if (track && track.id !== undefined) {
            const shouldMute = !soloChainTracks.includes(track.id);
            if (track.muted !== shouldMute) {
                track.muted = shouldMute;
                updateTrackMuteUI(track.id, shouldMute);
            }
        }
    });
}

/**
 * Restore original mute states before solo chain was applied
 */
function restoreOriginalMuteStates() {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    tracks.forEach(track => {
        if (track && track.originalMuteState !== undefined) {
            track.muted = track.originalMuteState;
            updateTrackMuteUI(track.id, track.originalMuteState);
            delete track.originalMuteState;
        } else if (track && track.muted) {
            track.muted = false;
            updateTrackMuteUI(track.id, false);
        }
    });
}

/**
 * Update track mute UI
 * @param {number} trackId - Track ID
 * @param {boolean} muted - Muted state
 */
function updateTrackMuteUI(trackId, muted) {
    const muteBtn = document.querySelector(`[data-track-id="${trackId}"] .mute-btn, #mute-${trackId}, .track-${trackId} .mute`);
    if (muteBtn) {
        muteBtn.classList.toggle('muted', muted);
    }
}

/**
 * Record a solo chain change for undo
 * @param {Array<number>} prevTracks - Previous chain
 * @param {string} action - Action taken
 */
function recordSoloChainChange(prevTracks, action) {
    soloChainHistory.push({ tracks: prevTracks, action, timestamp: Date.now() });
    if (soloChainHistory.length > MAX_HISTORY) {
        soloChainHistory.shift();
    }
}

/**
 * Undo the last solo chain change
 */
export function undoLastSoloChainChange() {
    if (soloChainHistory.length === 0) return;
    const last = soloChainHistory.pop();
    soloChainTracks = [...last.tracks];
    applySoloChain();
}

/**
 * Get solo chain history
 * @returns {Array} History entries
 */
export function getSoloChainHistory() {
    return [...soloChainHistory];
}

/**
 * Save current mute states before applying solo chain
 */
export function saveMuteStatesForSoloChain() {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    tracks.forEach(track => {
        if (track && track.id !== undefined) {
            track.originalMuteState = track.muted || false;
        }
    });
}

/**
 * Check if a track is in the solo chain
 * @param {number} trackId - Track ID to check
 * @returns {boolean}
 */
export function isTrackInSoloChain(trackId) {
    return soloChainTracks.includes(trackId);
}

/**
 * Get the count of tracks in the solo chain
 * @returns {number}
 */
export function getSoloChainCount() {
    return soloChainTracks.length;
}

// Window exposure for external access
window.trackSoloChain = {
    getSoloChainTracks,
    setSoloChainTracks,
    addTrackToSoloChain,
    removeTrackFromSoloChain,
    toggleTrackInSoloChain,
    clearSoloChain,
    undoLastSoloChainChange,
    getSoloChainHistory,
    saveMuteStatesForSoloChain,
    isTrackInSoloChain,
    getSoloChainCount
};