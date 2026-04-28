// js/ClipLoopPreview.js - Clip Loop Preview Feature
// Double-click clip header to loop only that clip during playback

let localAppServices = {};
let activeLoopClipId = null;
let activeLoopTrackId = null;
let originalLoopRegion = null;
let isLoopPreviewActive = false;
let visualIndicators = [];

/**
 * Initialize the Clip Loop Preview module
 * @param {Object} appServices - Application services from main.js
 */
export function initClipLoopPreview(appServices) {
    localAppServices = appServices || {};
    
    // Listen for double-click on clip elements
    document.addEventListener('dblclick', handleClipDoubleClick);
    
    // ESC key to deactivate loop preview
    document.addEventListener('keydown', handleEscapeKey);
    
    console.log('[ClipLoopPreview] Initialized - double-click to loop clip enabled');
}

/**
 * Handle double-click on clip elements
 * @param {MouseEvent} e
 */
function handleClipDoubleClick(e) {
    // Check if we clicked on a clip element or inside a clip
    const clipEl = e.target.closest('[data-clip-id]');
    
    if (!clipEl || !clipEl.dataset.clipId) return;
    
    const clipId = clipEl.dataset.clipId;
    const trackId = parseInt(clipEl.dataset.trackId);
    
    e.preventDefault();
    e.stopPropagation();
    
    toggleClipLoopPreview(trackId, clipId);
}

/**
 * Toggle clip loop preview on/off
 * @param {number} trackId - Track ID
 * @param {string} clipId - Clip ID
 */
export function toggleClipLoopPreview(trackId, clipId) {
    // If same clip is already looping, deactivate
    if (isLoopPreviewActive && activeLoopClipId === clipId) {
        deactivateLoopPreview();
        return;
    }
    
    // Deactivate any existing loop preview first
    if (isLoopPreviewActive) {
        deactivateLoopPreview(false);
    }
    
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.warn('[ClipLoopPreview] Track not found:', trackId);
        return;
    }
    
    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) {
        console.warn('[ClipLoopPreview] Clip not found:', clipId);
        return;
    }
    
    // Get clip start and end times
    const clipStart = clip.start || 0;
    const clipDuration = clip.duration || 4; // Default 4 beats if no duration
    const clipEnd = clipStart + clipDuration;
    
    // Save original loop region state
    if (localAppServices.getLoopRegionEnabled && localAppServices.getLoopRegionStart && localAppServices.getLoopRegionEnd) {
        originalLoopRegion = {
            enabled: localAppServices.getLoopRegionEnabled(),
            start: localAppServices.getLoopRegionStart(),
            end: localAppServices.getLoopRegionEnd()
        };
    }
    
    // Activate loop preview
    activeLoopClipId = clipId;
    activeLoopTrackId = trackId;
    isLoopPreviewActive = true;
    
    // Set loop region to clip bounds
    if (localAppServices.setLoopRegionEnabled) localAppServices.setLoopRegionEnabled(true);
    if (localAppServices.setLoopRegionStart) localAppServices.setLoopRegionStart(clipStart);
    if (localAppServices.setLoopRegionEnd) localAppServices.setLoopRegionEnd(clipEnd);
    
    // Add visual indicator
    addVisualIndicator(trackId, clipId, clipStart, clipEnd);
    
    // Show notification
    localAppServices.showNotification?.(`Looping clip: ${clip.name || clipId}`, 2000);
    
    // Dispatch event for other modules
    document.dispatchEvent(new CustomEvent('clipLoopPreviewActivated', {
        detail: { clipId, trackId, clipStart, clipEnd }
    }));
    
    console.log(`[ClipLoopPreview] Activated for clip ${clipId} (${clipStart}s - ${clipEnd}s)`);
}

/**
 * Deactivate clip loop preview
 * @param {boolean} restoreOriginal - Whether to restore original loop region
 */
export function deactivateLoopPreview(restoreOriginal = true) {
    if (!isLoopPreviewActive) return;
    
    const deactivatedClipId = activeLoopClipId;
    
    // Remove visual indicators
    removeVisualIndicators();
    
    // Restore original loop region if requested
    if (restoreOriginal && originalLoopRegion) {
        if (localAppServices.setLoopRegionEnabled) localAppServices.setLoopRegionEnabled(originalLoopRegion.enabled);
        if (localAppServices.setLoopRegionStart) localAppServices.setLoopRegionStart(originalLoopRegion.start);
        if (localAppServices.setLoopRegionEnd) localAppServices.setLoopRegionEnd(originalLoopRegion.end);
    }
    
    // Clear state
    activeLoopClipId = null;
    activeLoopTrackId = null;
    isLoopPreviewActive = false;
    originalLoopRegion = null;
    
    // Show notification
    localAppServices.showNotification?.('Clip loop preview ended', 1500);
    
    // Dispatch event
    document.dispatchEvent(new CustomEvent('clipLoopPreviewDeactivated', {
        detail: { clipId: deactivatedClipId }
    }));
    
    console.log('[ClipLoopPreview] Deactivated');
}

/**
 * Handle escape key to deactivate loop preview
 * @param {KeyboardEvent} e
 */
function handleEscapeKey(e) {
    if (e.key === 'Escape' && isLoopPreviewActive) {
        e.preventDefault();
        deactivateLoopPreview();
    }
}

/**
 * Add visual loop region indicators around the clip
 * @param {number} trackId - Track ID
 * @param {string} clipId - Clip ID
 * @param {number} clipStart - Clip start time
 * @param {number} clipEnd - Clip end time
 */
function addVisualIndicator(trackId, clipId, clipStart, clipEnd) {
    removeVisualIndicators();
    
    // Create top marker
    const topMarker = document.createElement('div');
    topMarker.className = 'clip-loop-marker clip-loop-start';
    topMarker.innerHTML = '⟲';
    topMarker.title = 'Loop Start - Double-click clip to exit loop';
    topMarker.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #9333ea, #ec4899);
        z-index: 100;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: white;
    `;
    
    // Create bottom marker
    const bottomMarker = document.createElement('div');
    bottomMarker.className = 'clip-loop-marker clip-loop-end';
    bottomMarker.innerHTML = '⟲';
    bottomMarker.title = 'Loop End';
    bottomMarker.style.cssText = topMarker.style.cssText;
    
    // Try to position markers relative to the clip element
    const clipEl = document.querySelector(`.timeline-clip[data-clip-id="${clipId}"]`);
    if (clipEl) {
        // Position markers at the clip's vertical position
        const clipRect = clipEl.getBoundingClientRect();
        const parent = clipEl.parentElement;
        const parentRect = parent?.getBoundingClientRect();
        
        if (parent) {
            topMarker.style.left = '0';
            topMarker.style.right = '0';
            topMarker.style.top = '0';
            
            bottomMarker.style.left = '0';
            bottomMarker.style.right = '0';
            bottomMarker.style.bottom = '0';
            
            parent.style.position = 'relative';
            parent.appendChild(topMarker);
            parent.appendChild(bottomMarker);
            
            visualIndicators.push(topMarker, bottomMarker);
        }
    }
    
    // Also add a global indicator in the transport bar
    addTransportIndicator(clipId);
}

/**
 * Add indicator in transport bar showing loop is active
 * @param {string} clipId - Clip ID
 */
function addTransportIndicator(clipId) {
    const indicator = document.createElement('div');
    indicator.id = 'clip-loop-indicator';
    indicator.className = 'flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs rounded';
    indicator.innerHTML = `
        <span>⟲</span>
        <span class="font-medium">Loop Preview</span>
        <button onclick="window.deactivateClipLoopPreview?.()" class="ml-1 hover:bg-purple-500 rounded px-1">✕</button>
    `;
    
    // Try to add to transport bar
    const transport = document.querySelector('.transport-bar, .transport, #transport');
    if (transport) {
        transport.appendChild(indicator);
        visualIndicators.push(indicator);
    }
    
    // Store reference for cleanup
    window.deactivateClipLoopPreview = deactivateLoopPreview;
}

/**
 * Remove all visual indicators
 */
function removeVisualIndicators() {
    visualIndicators.forEach(el => {
        if (el.parentElement) {
            el.remove();
        }
    });
    visualIndicators = [];
    
    // Remove global indicator
    const transportIndicator = document.getElementById('clip-loop-indicator');
    if (transportIndicator) transportIndicator.remove();
}

/**
 * Check if a specific clip is currently in loop preview mode
 * @param {string} clipId - Clip ID to check
 * @returns {boolean}
 */
export function isClipInLoopPreview(clipId) {
    return isLoopPreviewActive && activeLoopClipId === clipId;
}

/**
 * Get the currently active loop preview clip info
 * @returns {Object|null} { clipId, trackId, clipStart, clipEnd }
 */
export function getActiveLoopPreviewInfo() {
    if (!isLoopPreviewActive) return null;
    
    const track = localAppServices.getTrackById?.(activeLoopTrackId);
    const clip = track?.timelineClips?.find(c => c.id === activeLoopClipId);
    
    if (!clip) return null;
    
    return {
        clipId: activeLoopClipId,
        trackId: activeLoopTrackId,
        clipStart: clip.start || 0,
        clipEnd: (clip.start || 0) + (clip.duration || 4)
    };
}

// Export for external access
export { isLoopPreviewActive, activeLoopClipId, activeLoopTrackId };