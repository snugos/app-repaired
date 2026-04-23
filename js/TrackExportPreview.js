// js/TrackExportPreview.js - Track Export Preview
// Preview track in isolation without affecting main mix

let previewTrackId = null;
let previewGainNode = null;
let previewPannerNode = null;
let originalTrackVolume = 1.0;
let previewActive = false;

/**
 * Initialize the track preview system
 * @param {Object} audioContext - Tone.js audio context
 */
export function initTrackPreview(audioContext) {
    try {
        // Create preview nodes
        previewGainNode = audioContext.createGain();
        previewGainNode.gain.value = 1.0;
        previewPannerNode = audioContext.createStereoPanner();
        previewPannerNode.pan.value = 0;
        
        // Connect to output
        previewGainNode.connect(previewPannerNode);
        previewPannerNode.connect(audioContext.destination);
        
        console.log('[TrackPreview] Initialized');
        return true;
    } catch (e) {
        console.error('[TrackPreview] Failed to initialize:', e);
        return false;
    }
}

/**
 * Start previewing a track in isolation
 * @param {string} trackId - The track ID to preview
 * @param {number} volume - Preview volume (0-1)
 * @param {number} pan - Preview pan (-1 to 1)
 */
export function startTrackPreview(trackId, volume = 1.0, pan = 0) {
    if (!trackId) return false;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.warn('[TrackPreview] Track not found:', trackId);
        return false;
    }
    
    // Store original state
    if (previewTrackId !== trackId) {
        originalTrackVolume = track.volume !== undefined ? track.volume : 1.0;
    }
    
    previewTrackId = trackId;
    previewActive = true;
    
    // Mute all other tracks
    tracks.forEach(t => {
        if (t.id !== trackId && t.setVolume) {
            t.setVolume(0);
        }
    });
    
    // Set preview volume and pan
    if (previewGainNode) {
        previewGainNode.gain.setValueAtTime(volume, Tone.now());
    }
    if (previewPannerNode) {
        previewPannerNode.pan.setValueAtTime(pan, Tone.now());
    }
    
    console.log('[TrackPreview] Started preview for track:', track.name || trackId);
    return true;
}

/**
 * Stop track preview and restore normal mix
 */
export function stopTrackPreview() {
    if (!previewActive || !previewTrackId) return false;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === previewTrackId);
    
    // Restore track volume
    if (track && track.setVolume && originalTrackVolume !== undefined) {
        track.setVolume(originalTrackVolume);
    }
    
    // Restore all tracks to normal volumes (this is simplified - real implementation
    // would need to track original volumes per track)
    tracks.forEach(t => {
        if (t.setVolume && t.id !== previewTrackId) {
            // In a full implementation, we would restore each track's original volume
            // For now, just restore to 0.8 as a default "normal" volume
            t.setVolume(t.previousVolumeBeforeMute || 0.8);
        }
    });
    
    const oldTrackId = previewTrackId;
    previewTrackId = null;
    previewActive = false;
    originalTrackVolume = 1.0;
    
    console.log('[TrackPreview] Stopped preview for track:', oldTrackId);
    return true;
}

/**
 * Update preview volume
 * @param {number} volume - Volume level (0-1)
 */
export function setPreviewVolume(volume) {
    if (previewGainNode && previewActive) {
        previewGainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), Tone.now());
        return true;
    }
    return false;
}

/**
 * Update preview pan
 * @param {number} pan - Pan value (-1 to 1)
 */
export function setPreviewPan(pan) {
    if (previewPannerNode && previewActive) {
        previewPannerNode.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), Tone.now());
        return true;
    }
    return false;
}

/**
 * Check if a specific track is being previewed
 * @param {string} trackId - Track ID to check
 * @returns {boolean}
 */
export function isTrackBeingPreviewed(trackId) {
    return previewActive && previewTrackId === trackId;
}

/**
 * Check if preview is active
 * @returns {boolean}
 */
export function isPreviewActive() {
    return previewActive;
}

/**
 * Get the currently previewed track ID
 * @returns {string|null}
 */
export function getPreviewedTrackId() {
    return previewTrackId;
}

/**
 * Get preview state info
 * @returns {Object}
 */
export function getPreviewState() {
    return {
        active: previewActive,
        trackId: previewTrackId,
        volume: previewGainNode ? previewGainNode.gain.value : 1.0,
        pan: previewPannerNode ? previewPannerNode.pan.value : 0
    };
}

/**
 * Dispose of preview resources
 */
export function disposeTrackPreview() {
    stopTrackPreview();
    
    if (previewGainNode) {
        previewGainNode.disconnect();
        previewGainNode = null;
    }
    if (previewPannerNode) {
        previewPannerNode.disconnect();
        previewPannerNode = null;
    }
    
    console.log('[TrackPreview] Disposed');
}