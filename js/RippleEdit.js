// js/RippleEdit.js - Ripple Edit System for SnugOS DAW
// When clips are deleted or moved, automatically close gaps in the timeline

import { getTracksState, setTracksState, captureStateForUndo, getSequencerTrackState, getSequenceData } from './state.js';

// Ripple Edit Modes
export const RIPPLE_EDIT_MODES = {
    OFF: 'off',           // No ripple edit
    ALL: 'all',           // Ripple edit all tracks
    SELECTED: 'selected',  // Ripple edit only selected track
    MARKERS: 'markers'     // Ripple edit but preserve markers
};

let rippleEditMode = RIPPLE_EDIT_MODES.OFF;
let rippleEditAffectedTrackIds = new Set();

export function getRippleEditMode() {
    return rippleEditMode;
}

export function setRippleEditMode(mode) {
    if (Object.values(RIPPLE_EDIT_MODES).includes(mode)) {
        rippleEditMode = mode;
        console.log(`[RippleEdit] Mode set to: ${mode}`);
        return true;
    }
    return false;
}

export function getRippleEditAffectedTracks() {
    return [...rippleEditAffectedTrackIds];
}

/**
 * Delete a clip and close the gap using ripple edit.
 * @param {number} trackId - Track containing the clip
 * @param {string|number} clipId - Clip ID to delete
 * @param {boolean} captureUndo - Whether to capture state for undo (default true)
 * @returns {boolean} True if ripple edit was performed
 */
export function rippleDeleteClip(trackId, clipId, captureUndo = true) {
    if (rippleEditMode === RIPPLE_EDIT_MODES.OFF) {
        return false;
    }

    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    if (!track) return false;

    const clip = track.clips?.find(c => c.id === clipId);
    if (!clip) return false;

    const deletedStart = clip.startTime;
    const deletedDuration = clip.duration || 4;

    if (captureUndo) {
        captureStateForUndo(`Ripple delete clip`);
    }

    // Remove the clip
    track.clips = track.clips.filter(c => c.id !== clipId);

    // Determine which tracks to ripple
    let tracksToRipple = [];
    
    switch (rippleEditMode) {
        case RIPPLE_EDIT_MODES.ALL:
            tracksToRipple = tracks;
            break;
        case RIPPLE_EDIT_MODES.SELECTED:
            tracksToRipple = tracks.filter(t => t.id === trackId);
            break;
        case RIPPLE_EDIT_MODES.MARKERS:
            tracksToRipple = tracks.filter(t => t.id === trackId);
            break;
        default:
            return false;
    }

    // Apply ripple to affected tracks
    tracksToRipple.forEach(t => {
        if (!t.clips) return;
        
        t.clips.forEach(clip => {
            if (clip.startTime > deletedStart) {
                clip.startTime -= deletedDuration;
            }
        });
    });

    setTracksState(tracks);
    
    console.log(`[RippleEdit] Deleted clip at ${deletedStart}s, shifted ${deletedDuration}s worth of clips`);
    return true;
}

/**
 * Move a clip and close the gap using ripple edit.
 * @param {number} trackId - Track containing the clip
 * @param {string|number} clipId - Clip ID to move
 * @param {number} newStartTime - New start time for the clip
 * @param {boolean} captureUndo - Whether to capture state for undo (default true)
 * @returns {boolean} True if ripple edit was performed
 */
export function rippleMoveClip(trackId, clipId, newStartTime, captureUndo = true) {
    if (rippleEditMode === RIPPLE_EDIT_MODES.OFF) {
        return false;
    }

    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.clips) return false;

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return false;

    const oldStart = clip.startTime;
    const duration = clip.duration || 4;
    const delta = newStartTime - oldStart;

    if (Math.abs(delta) < 0.001) return false; // No significant movement

    if (captureUndo) {
        captureStateForUndo(`Ripple move clip`);
    }

    // Move the clip
    clip.startTime = newStartTime;

    // Determine which tracks to ripple
    let tracksToRipple = [];
    
    switch (rippleEditMode) {
        case RIPPLE_EDIT_MODES.ALL:
            tracksToRipple = tracks;
            break;
        case RIPPLE_EDIT_MODES.SELECTED:
            tracksToRipple = tracks.filter(t => t.id === trackId);
            break;
        case RIPPLE_EDIT_MODES.MARKERS:
            tracksToRipple = tracks.filter(t => t.id === trackId);
            break;
        default:
            return false;
    }

    // Apply ripple to clips that come after the moved clip
    tracksToRipple.forEach(t => {
        if (!t.clips) return;
        
        t.clips.forEach(c => {
            if (c.id === clipId) return; // Skip the moved clip
            if (delta > 0 && c.startTime >= newStartTime && c.startTime < newStartTime + duration) {
                c.startTime += delta;
            } else if (delta < 0 && c.startTime >= newStartTime) {
                c.startTime += delta;
            }
        });
    });

    setTracksState(tracks);
    
    console.log(`[RippleEdit] Moved clip from ${oldStart}s to ${newStartTime}s, delta: ${delta}s`);
    return true;
}

/**
 * Insert space at a position and ripple subsequent clips.
 * @param {number} trackId - Track to insert space (or null for all tracks)
 * @param {number} insertPosition - Position in seconds to insert at
 * @param {number} insertDuration - Duration of space to insert
 * @param {boolean} captureUndo - Whether to capture state for undo (default true)
 * @returns {boolean} True if ripple insert was performed
 */
export function rippleInsertSpace(trackId, insertPosition, insertDuration, captureUndo = true) {
    if (rippleEditMode === RIPPLE_EDIT_MODES.OFF || insertDuration <= 0) {
        return false;
    }

    const tracks = getTracksState();
    
    if (captureUndo) {
        captureStateForUndo(`Ripple insert space`);
    }

    // Determine which tracks to affect
    let tracksToRipple = [];
    
    if (trackId !== null) {
        const track = tracks.find(t => t.id === trackId);
        if (track) {
            switch (rippleEditMode) {
                case RIPPLE_EDIT_MODES.ALL:
                    tracksToRipple = tracks;
                    break;
                case RIPPLE_EDIT_MODES.SELECTED:
                case RIPPLE_EDIT_MODES.MARKERS:
                    tracksToRipple = [track];
                    break;
                default:
                    tracksToRipple = [track];
            }
        }
    } else {
        tracksToRipple = tracks;
    }

    // Apply ripple to clips after insert position
    tracksToRipple.forEach(t => {
        if (!t.clips) return;
        
        t.clips.forEach(clip => {
            if (clip.startTime >= insertPosition) {
                clip.startTime += insertDuration;
            }
        });
    });

    setTracksState(tracks);
    
    console.log(`[RippleEdit] Inserted ${insertDuration}s at position ${insertPosition}s`);
    return true;
}

/**
 * Split a clip at a position and optionally delete the after portion (ripple delete).
 * @param {number} trackId - Track containing the clip
 * @param {string|number} clipId - Clip ID to split
 * @param {number} splitPosition - Position in seconds to split at
 * @param {boolean} deleteAfter - If true, delete the portion after split and close gap
 * @param {boolean} captureUndo - Whether to capture state for undo (default true)
 * @returns {Object|null} Object with beforeClip and afterClip, or null
 */
export function rippleSplitClip(trackId, clipId, splitPosition, deleteAfter = false, captureUndo = true) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.clips) return null;

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return null;

    const clipStart = clip.startTime;
    const clipEnd = clipStart + (clip.duration || 4);

    // Check if split position is within clip
    if (splitPosition <= clipStart || splitPosition >= clipEnd) {
        console.warn(`[RippleEdit] Split position ${splitPosition} is outside clip range [${clipStart}, ${clipEnd}]`);
        return null;
    }

    if (captureUndo) {
        captureStateForUndo(deleteAfter ? `Ripple split & delete` : `Ripple split clip`);
    }

    const beforeDuration = splitPosition - clipStart;
    const afterDuration = clipEnd - splitPosition;
    const afterClipId = `clip_${Date.now()}_ripple`;

    // Create before clip
    const beforeClip = {
        ...clip,
        duration: beforeDuration
    };

    // Create after clip
    const afterClip = {
        ...clip,
        id: afterClipId,
        startTime: splitPosition,
        duration: afterDuration
    };

    if (deleteAfter) {
        // Replace original clip with before clip only
        track.clips = track.clips.filter(c => c.id !== clipId);
        track.clips.push(beforeClip);

        // Ripple delete: shift everything after split position
        const tracksToRipple = rippleEditMode !== RIPPLE_EDIT_MODES.OFF ? tracks : [];
        
        tracksToRipple.forEach(t => {
            if (!t.clips) return;
            
            t.clips.forEach(c => {
                if (c.startTime > splitPosition) {
                    c.startTime -= afterDuration;
                }
            });
        });

        console.log(`[RippleEdit] Split at ${splitPosition}s and deleted after portion (${afterDuration}s)`);
    } else {
        // Keep both clips
        track.clips = track.clips.filter(c => c.id !== clipId);
        track.clips.push(beforeClip);
        track.clips.push(afterClip);

        console.log(`[RippleEdit] Split clip at ${splitPosition}s (before: ${beforeDuration}s, after: ${afterDuration}s)`);
    }

    setTracksState(tracks);
    
    return {
        beforeClip,
        afterClip,
        splitPosition
    };
}

/**
 * Toggle ripple edit mode through its options.
 * @returns {string} The new ripple edit mode
 */
export function toggleRippleEditMode() {
    const modes = Object.values(RIPPLE_EDIT_MODES);
    const currentIndex = modes.indexOf(rippleEditMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    rippleEditMode = modes[nextIndex];
    
    console.log(`[RippleEdit] Toggled to mode: ${rippleEditMode}`);
    return rippleEditMode;
}

/**
 * Get the status text for the current ripple edit mode.
 * @returns {string} Human-readable status
 */
export function getRippleEditStatus() {
    switch (rippleEditMode) {
        case RIPPLE_EDIT_MODES.OFF:
            return 'Ripple Edit: OFF';
        case RIPPLE_EDIT_MODES.ALL:
            return 'Ripple Edit: ALL TRACKS';
        case RIPPLE_EDIT_MODES.SELECTED:
            return 'Ripple Edit: SELECTED TRACK';
        case RIPPLE_EDIT_MODES.MARKERS:
            return 'Ripple Edit: PRESERVE MARKERS';
        default:
            return 'Ripple Edit: UNKNOWN';
    }
}

export { RIPPLE_EDIT_MODES };
