// js/TrackLaneResize.js - Track Lane Resize Feature
// Allows users to drag track lane dividers to resize track heights

import { getTrackByIdState, captureStateForUndoInternal } from './state.js';

// Track lane resize state
let trackLaneHeights = {}; // { trackId: height in pixels }
let defaultLaneHeight = 50;
let minLaneHeight = 30;
let maxLaneHeight = 200;
let isResizing = false;
let resizeTargetTrackId = null;
let resizeStartY = 0;
let resizeStartHeight = 0;

// Initialize resize listeners on timeline track lanes
export function initTrackLaneResize(appServices) {
    if (!appServices?.uiElementsCache?.desktop) return;
    
    const desktop = appServices.uiElementsCache.desktop;
    
    // Use event delegation to handle resize handle interactions
    desktop.addEventListener('mousedown', handleResizeHandleMouseDown);
    document.addEventListener('mousemove', handleResizeHandleMouseMove);
    document.addEventListener('mouseup', handleResizeHandleMouseUp);
    
    console.log('[TrackLaneResize] Initialized resize listeners');
}

// Handle mousedown on resize handle
function handleResizeHandleMouseDown(e) {
    const handle = e.target.closest('.track-lane-resize-handle');
    if (!handle) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const trackId = parseInt(handle.dataset.trackId);
    if (isNaN(trackId)) return;
    
    isResizing = true;
    resizeTargetTrackId = trackId;
    resizeStartY = e.clientY;
    
    const track = getTrackByIdState(trackId);
    resizeStartHeight = trackLaneHeights[trackId] || defaultLaneHeight;
    
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    
    handle.classList.add('active');
}

// Handle mousemove during resize
function handleResizeHandleMouseMove(e) {
    if (!isResizing || resizeTargetTrackId === null) return;
    
    const deltaY = e.clientY - resizeStartY;
    let newHeight = Math.max(minLaneHeight, Math.min(maxLaneHeight, resizeStartHeight + deltaY));
    
    trackLaneHeights[resizeTargetTrackId] = newHeight;
    applyLaneHeight(resizeTargetTrackId, newHeight);
}

// Handle mouseup to end resize
function handleResizeHandleMouseUp(e) {
    if (!isResizing) return;
    
    if (resizeTargetTrackId !== null) {
        // Capture state for undo if height changed
        const track = getTrackByIdState(resizeTargetTrackId);
        if (track) {
            const oldHeight = track.laneHeight || defaultLaneHeight;
            const newHeight = trackLaneHeights[resizeTargetTrackId];
            
            if (oldHeight !== newHeight) {
                captureStateForUndoInternal(`Resize Track "${track.name}" Lane Height`);
                track.laneHeight = newHeight;
            }
        }
        
        // Remove active class from handle
        const handle = document.querySelector(`.track-lane-resize-handle[data-track-id="${resizeTargetTrackId}"]`);
        if (handle) handle.classList.remove('active');
    }
    
    // Reset state
    isResizing = false;
    resizeTargetTrackId = null;
    resizeStartY = 0;
    resizeStartHeight = 0;
    
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
}

// Apply lane height to track lane element
function applyLaneHeight(trackId, height) {
    const laneEl = document.querySelector(`.timeline-track-lane[data-track-id="${trackId}"]`);
    if (laneEl) {
        laneEl.style.height = `${height}px`;
        
        // Update resize handle position
        const handle = laneEl.querySelector('.track-lane-resize-handle');
        if (handle) {
            handle.style.top = `${height - 8}px`;
        }
    }
}

// Create resize handle HTML for a track lane
export function createResizeHandleHTML(trackId) {
    return `
        <div class="track-lane-resize-handle" data-track-id="${trackId}" title="Drag to resize track height">
            <div class="track-lane-resize-bar"></div>
        </div>
    `;
}

// Get current lane height for a track
export function getLaneHeight(trackId) {
    return trackLaneHeights[trackId] || defaultLaneHeight;
}

// Set lane height for a track
export function setLaneHeight(trackId, height) {
    const clampedHeight = Math.max(minLaneHeight, Math.min(maxLaneHeight, height));
    trackLaneHeights[trackId] = clampedHeight;
    return clampedHeight;
}

// Reset lane height to default
export function resetLaneHeight(trackId) {
    if (trackLaneHeights[trackId]) {
        delete trackLaneHeights[trackId];
    }
    applyLaneHeight(trackId, defaultLaneHeight);
}

// Reset all lane heights to default
export function resetAllLaneHeights() {
    Object.keys(trackLaneHeights).forEach(trackId => {
        delete trackLaneHeights[trackId];
    });
}

// Get all lane heights for saving
export function getAllLaneHeights() {
    return { ...trackLaneHeights };
}

// Set all lane heights from saved state
export function setAllLaneHeights(heights) {
    if (heights && typeof heights === 'object') {
        trackLaneHeights = { ...heights };
    }
}

// Export constants for external use
export function getLaneHeightConstants() {
    return {
        default: defaultLaneHeight,
        min: minLaneHeight,
        max: maxLaneHeight
    };
}