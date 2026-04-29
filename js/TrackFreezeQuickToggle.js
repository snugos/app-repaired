// js/TrackFreezeQuickToggle.js - Track Freeze Quick Toggle Feature
// Press 'F' key on selected track to freeze/unfreeze it

let localAppServices = {};
let selectedTrackId = null;

/**
 * Initialize the Track Freeze Quick Toggle module
 * @param {Object} appServices - Application services from main.js
 */
export function initTrackFreezeQuickToggle(appServices) {
    localAppServices = appServices || {};
    
    // Listen for track selection clicks
    document.addEventListener('mousedown', handleTrackSelection);
    
    // Listen for keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    
    console.log('[TrackFreezeQuickToggle] Initialized - F key to freeze selected track');
}

/**
 * Handle mousedown on track elements to track selection
 * @param {MouseEvent} e
 */
function handleTrackSelection(e) {
    // Check if clicking on a track lane or header
    const trackEl = e.target.closest('.timeline-track-lane, .track-header, [data-track-id]');
    
    if (trackEl && trackEl.dataset.trackId) {
        selectedTrackId = parseInt(trackEl.dataset.trackId, 10);
        console.log(`[TrackFreezeQuickToggle] Track selected: ${selectedTrackId}`);
    }
}

/**
 * Handle keydown events for freeze toggle
 * @param {KeyboardEvent} e
 */
function handleKeyDown(e) {
    // Only handle 'F' key when not in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }
    
    // Check for 'F' key (with or without modifiers)
    if (e.key === 'F' || e.key === 'f') {
        if (!selectedTrackId) {
            // Try to find a focused/selected track from last clicked
            const focusedTrack = getFocusedTrack();
            if (!focusedTrack) {
                return;
            }
            selectedTrackId = focusedTrack;
        }
        
        e.preventDefault();
        toggleFreezeForTrack(selectedTrackId);
    }
}

/**
 * Get the currently focused track ID
 * @returns {number|null}
 */
function getFocusedTrack() {
    // Check for any element with data-track-id that was recently clicked
    const trackEls = document.querySelectorAll('[data-track-id]');
    for (const el of trackEls) {
        if (el.matches(':focus') || el.contains(document.activeElement)) {
            const trackId = parseInt(el.dataset.trackId, 10);
            if (!isNaN(trackId)) {
                return trackId;
            }
        }
    }
    
    // Fall back to first track
    const tracks = localAppServices.getTracks?.() || [];
    if (tracks.length > 0) {
        return tracks[0].id;
    }
    
    return null;
}

/**
 * Toggle freeze state for a track
 * @param {number} trackId - Track ID to freeze/unfreeze
 */
function toggleFreezeForTrack(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    
    if (!track) {
        console.warn(`[TrackFreezeQuickToggle] Track ${trackId} not found`);
        localAppServices.showNotification?.('Track not found', 2000);
        return;
    }
    
    // Check if track type supports freezing
    if (track.type === 'Audio') {
        localAppServices.showNotification?.('Audio tracks cannot be frozen', 2000);
        return;
    }
    
    if (track.frozen) {
        // Unfreeze the track
        if (typeof track.unfreeze === 'function') {
            track.unfreeze();
            localAppServices.showNotification?.(`Unfroze: ${track.name}`, 2000);
            console.log(`[TrackFreezeQuickToggle] Unfroze track ${trackId} (${track.name})`);
        }
    } else {
        // Freeze the track
        if (typeof track.freeze === 'function') {
            track.freeze();
            localAppServices.showNotification?.(`Froze: ${track.name}`, 2000);
            console.log(`[TrackFreezeQuickToggle] Froze track ${trackId} (${track.name})`);
        }
    }
}

/**
 * Get the currently selected track ID
 * @returns {number|null}
 */
export function getSelectedTrackId() {
    return selectedTrackId;
}

/**
 * Set the selected track ID externally
 * @param {number} trackId
 */
export function setSelectedTrackId(trackId) {
    selectedTrackId = trackId;
}