// js/TrackLaneReorder.js - Drag-and-drop track reordering in timeline
// Feature: Track Lane Reorder - Drag-and-drop to reorder tracks in the timeline lane view

let localAppServices = {};
let draggedTrackId = null;
let draggedElement = null;

export function initTrackLaneReorder(services) {
    localAppServices = services;
    console.log('[TrackLaneReorder] Initialized');
}

/**
 * Enable drag-and-drop reordering on track lane headers
 */
export function enableTrackLaneReorder() {
    // Add drag handles to track lane headers if not already present
    const trackHeaders = document.querySelectorAll('.track-lane-header, .track-header, [class*="trackHeader"]');
    
    trackHeaders.forEach(header => {
        if (header.dataset.trackReorderEnabled) return;
        header.dataset.trackReorderEnabled = 'true';
        
        header.style.cursor = 'grab';
        header.draggable = true;
        
        header.addEventListener('dragstart', handleDragStart);
        header.addEventListener('dragend', handleDragEnd);
        header.addEventListener('dragover', handleDragOver);
        header.addEventListener('dragleave', handleDragLeave);
        header.addEventListener('drop', handleDrop);
    });
    
    // Also watch for new track elements
    if (!window._trackLaneReorderObserver) {
        window._trackLaneReorderObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const headers = node.querySelectorAll?.('.track-lane-header, .track-header, [class*="trackHeader"]') || [];
                        headers.forEach(h => {
                            if (!h.dataset.trackReorderEnabled) {
                                h.style.cursor = 'grab';
                                h.draggable = true;
                                h.dataset.trackReorderEnabled = 'true';
                                h.addEventListener('dragstart', handleDragStart);
                                h.addEventListener('dragend', handleDragEnd);
                                h.addEventListener('dragover', handleDragOver);
                                h.addEventListener('dragleave', handleDragLeave);
                                h.addEventListener('drop', handleDrop);
                            }
                        });
                    }
                }
            }
        });
        
        const trackList = document.getElementById('trackList') || document.querySelector('.track-list') || document.getElementById('tracks');
        if (trackList) {
            window._trackLaneReorderObserver.observe(trackList, { childList: true, subtree: true });
        }
    }
}

/**
 * Disable drag-and-drop reordering
 */
export function disableTrackLaneReorder() {
    if (window._trackLaneReorderObserver) {
        window._trackLaneReorderObserver.disconnect();
        delete window._trackLaneReorderObserver;
    }
    
    document.querySelectorAll('[data-track-reorder-enabled="true"]').forEach(el => {
        el.removeEventListener('dragstart', handleDragStart);
        el.removeEventListener('dragend', handleDragEnd);
        el.removeEventListener('dragover', handleDragOver);
        el.removeEventListener('dragleave', handleDragLeave);
        el.removeEventListener('drop', handleDrop);
        el.dataset.trackReorderEnabled = '';
    });
}

/**
 * Handle drag start
 */
function handleDragStart(e) {
    const header = e.target.closest('.track-lane-header, .track-header, [class*="trackHeader"]');
    if (!header) return;
    
    const trackId = header.dataset.trackId || header.dataset.id;
    if (!trackId) return;
    
    draggedTrackId = parseInt(trackId, 10);
    draggedElement = header;
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', trackId);
    
    // Add visual feedback
    setTimeout(() => {
        header.classList.add('opacity-50');
    }, 0);
    
    console.log('[TrackLaneReorder] Started dragging track:', draggedTrackId);
}

/**
 * Handle drag end
 */
function handleDragEnd(e) {
    if (draggedElement) {
        draggedElement.classList.remove('opacity-50');
    }
    
    // Remove all drag-over indicators
    document.querySelectorAll('.track-drag-over').forEach(el => {
        el.classList.remove('track-drag-over');
    });
    
    draggedTrackId = null;
    draggedElement = null;
    
    console.log('[TrackLaneReorder] Drag ended');
}

/**
 * Handle drag over
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const header = e.target.closest('.track-lane-header, .track-header, [class*="trackHeader"]');
    if (!header || header === draggedElement) return;
    
    // Show drop indicator
    const rect = header.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    
    document.querySelectorAll('.track-drag-over').forEach(el => {
        el.classList.remove('track-drag-over');
    });
    
    if (e.clientX < midpoint) {
        header.classList.add('track-drag-over', 'border-l-4', 'border-blue-500');
    } else {
        header.classList.add('track-drag-over', 'border-r-4', 'border-blue-500');
    }
}

/**
 * Handle drag leave
 */
function handleDragLeave(e) {
    const header = e.target.closest('.track-lane-header, .track-header, [class*="trackHeader"]');
    if (header) {
        header.classList.remove('track-drag-over', 'border-l-4', 'border-blue-500', 'border-r-4', 'border-blue-500');
    }
}

/**
 * Handle drop
 */
function handleDrop(e) {
    e.preventDefault();
    
    const header = e.target.closest('.track-lane-header, .track-header, [class*="trackHeader"]');
    if (!header || header === draggedElement) return;
    
    const targetTrackId = parseInt(header.dataset.trackId || header.dataset.id, 10);
    if (!targetTrackId || !draggedTrackId) return;
    
    // Determine drop position (before or after target)
    const rect = header.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const insertBefore = e.clientX < midpoint;
    
    // Perform the reorder
    reorderTrack(draggedTrackId, targetTrackId, insertBefore);
    
    // Clean up
    header.classList.remove('track-drag-over', 'border-l-4', 'border-blue-500', 'border-r-4', 'border-blue-500');
}

/**
 * Reorder a track to a new position
 */
function reorderTrack(trackIdToMove, targetTrackId, insertBefore) {
    if (trackIdToMove === targetTrackId) return;
    
    // Use state function if available
    if (typeof reorderTrackInState === 'function') {
        // Get current index of target
        const tracks = typeof getTracks === 'function' ? getTracks() : [];
        const targetIndex = tracks.findIndex(t => t.id === targetTrackId);
        
        if (targetIndex >= 0) {
            const newIndex = insertBefore ? targetIndex : targetIndex + 1;
            reorderTrackInState(trackIdToMove, newIndex);
            console.log(`[TrackLaneReorder] Moved track ${trackIdToMove} to index ${newIndex}`);
            
            // Refresh UI
            if (typeof refreshTrackList === 'function') {
                refreshTrackList();
            } else if (typeof renderTrackList === 'function') {
                renderTrackList();
            }
            
            localAppServices.showNotification?.('Track reordered', 1500);
        }
    } else {
        console.warn('[TrackLaneReorder] reorderTrackInState not available');
    }
}

/**
 * Get current drag state
 */
export function isDragging() {
    return draggedTrackId !== null;
}

export function getDraggedTrackId() {
    return draggedTrackId;
}