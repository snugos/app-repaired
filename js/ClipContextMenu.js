// js/ClipContextMenu.js - Right-click context menu for timeline clips
// Adds "Reverse Clip" option to clip context menu + keyboard shortcut

import { reverseAudioClip } from './ClipReverse.js';

let localAppServices = {};
let contextMenuListenersInitialized = false;

/**
 * Initialize the clip context menu module
 * @param {object} services - App services
 */
export function initClipContextMenu(services) {
    localAppServices = services;
    
    if (contextMenuListenersInitialized) return;
    
    // Use delegated events on desktop to catch clip right-clicks
    document.addEventListener('contextmenu', handleClipContextMenu);
    
    // Keyboard shortcut for reverse (R key)
    document.addEventListener('keydown', handleClipKeyboardShortcut);
    
    contextMenuListenersInitialized = true;
    console.log('[ClipContextMenu] Initialized - right-click and keyboard shortcuts enabled');
}

/**
 * Handle right-click context menu on clips
 * @param {MouseEvent} e
 */
function handleClipContextMenu(e) {
    // Check if we clicked on a clip element or inside a track lane
    const clipEl = e.target.closest('[data-clip-id]');
    const trackLane = e.target.closest('.timeline-track-lane');
    
    if (!clipEl && !trackLane) return;
    
    // If we clicked on a clip, show clip-specific context menu
    if (clipEl && clipEl.dataset.clipId) {
        e.preventDefault();
        showClipContextMenu(e.clientX, e.clientY, clipEl.dataset.clipId, clipEl.dataset.trackId);
        return;
    }
    
    // If we clicked on a track lane but not a clip, check if there's a selected clip nearby
    if (trackLane && !clipEl) {
        const trackId = trackLane.dataset.trackId;
        if (!trackId) return;
        
        // Check for selected clips in this track
        const selectedClip = findSelectedClipInTrack(parseInt(trackId));
        if (selectedClip) {
            e.preventDefault();
            showClipContextMenu(e.clientX, e.clientY, selectedClip.id, trackId);
        }
    }
}

/**
 * Find a selected clip in a track
 * @param {number} trackId
 * @returns {object|null}
 */
function findSelectedClipInTrack(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track || !track.timelineClips) return null;
    
    // Look for clip element with selected state
    const selectedEl = document.querySelector(`.timeline-clip.selected[data-track-id="${trackId}"]`);
    if (selectedEl && selectedEl.dataset.clipId) {
        return track.timelineClips.find(c => c.id === selectedEl.dataset.clipId);
    }
    
    return null;
}

/**
 * Show context menu for a clip
 * @param {number} x - Mouse X position
 * @param {number} y - Mouse Y position
 * @param {string} clipId - Clip ID
 * @param {string} trackId - Track ID
 */
function showClipContextMenu(x, y, clipId, trackId) {
    // Remove any existing context menu
    closeClipContextMenu();
    
    // Get clip info
    const track = localAppServices.getTrackById?.(parseInt(trackId));
    if (!track) return;
    
    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) return;
    
    const isReversed = clip.reversed || false;
    
    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'clip-context-menu';
    menu.className = 'fixed bg-gray-900 border border-gray-600 rounded shadow-lg z-[10000] py-1 min-w-[180px]';
    menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 150)}px`;
    
    menu.innerHTML = `
        <div class="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700">
            ${escapeHtml(clip.name || 'Unnamed Clip')}
        </div>
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="reverse" data-clip-id="${clipId}" data-track-id="${trackId}">
            <span class="w-4">🔄</span>
            <span>${isReversed ? 'Unreverse' : 'Reverse'}</span>
            <span class="ml-auto text-xs text-gray-500">R</span>
        </button>
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="duplicate" data-clip-id="${clipId}" data-track-id="${trackId}">
            <span class="w-4">📋</span>
            <span>Duplicate</span>
        </button>
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="delete" data-clip-id="${clipId}" data-track-id="${trackId}">
            <span class="w-4">🗑️</span>
            <span>Delete</span>
        </button>
        <div class="border-t border-gray-700 mt-1 pt-1">
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="properties" data-clip-id="${clipId}" data-track-id="${trackId}">
                <span class="w-4">⚙️</span>
                <span>Properties</span>
            </button>
        </div>
    `;
    
    // Add event listeners
    menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            const cId = e.currentTarget.dataset.clipId;
            const tId = parseInt(e.currentTarget.dataset.trackId);
            
            handleClipAction(action, cId, tId);
            closeClipContextMenu();
        });
    });
    
    document.body.appendChild(menu);
    
    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', closeClipContextMenu, { once: true });
    }, 10);
}

/**
 * Close the clip context menu
 */
function closeClipContextMenu() {
    const menu = document.getElementById('clip-context-menu');
    if (menu) menu.remove();
}

/**
 * Handle clip action from context menu
 * @param {string} action - Action to perform
 * @param {string} clipId - Clip ID
 * @param {number} trackId - Track ID
 */
function handleClipAction(action, clipId, trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    switch (action) {
        case 'reverse':
            reverseAudioClip(trackId, clipId);
            localAppServices.showNotification?.('Clip reversed', 1500);
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
            break;
            
        case 'duplicate':
            if (typeof track.multiplyClip === 'function') {
                track.multiplyClip(clipId, 1, true);
                localAppServices.showNotification?.('Clip duplicated', 1500);
            }
            break;
            
        case 'delete':
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo('Delete clip');
            }
            // Remove clip from track
            const idx = track.timelineClips?.findIndex(c => c.id === clipId);
            if (idx > -1) {
                track.timelineClips.splice(idx, 1);
                if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                localAppServices.showNotification?.('Clip deleted', 1500);
            }
            break;
            
        case 'properties':
            if (localAppServices.openClipOpacityPanel) {
                localAppServices.openClipOpacityPanel();
            }
            break;
    }
}

/**
 * Handle keyboard shortcuts for clips
 * @param {KeyboardEvent} e
 */
function handleClipKeyboardShortcut(e) {
    // Ignore if typing in an input
    if (e.target.matches('input, textarea, select')) return;
    
    // R key for reverse (when a clip is selected)
    if (e.key === 'r' || e.key === 'R') {
        const selectedClip = document.querySelector('.timeline-clip.selected');
        if (selectedClip && selectedClip.dataset.clipId) {
            e.preventDefault();
            const clipId = selectedClip.dataset.clipId;
            const trackId = parseInt(selectedClip.dataset.trackId);
            
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo('Reverse clip');
            }
            
            reverseAudioClip(trackId, clipId);
            localAppServices.showNotification?.('Clip reversed', 1500);
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        }
    }
    
    // Delete/Backspace to delete selected clip
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedClip = document.querySelector('.timeline-clip.selected');
        if (selectedClip && selectedClip.dataset.clipId) {
            e.preventDefault();
            const clipId = selectedClip.dataset.clipId;
            const trackId = parseInt(selectedClip.dataset.trackId);
            const track = localAppServices.getTrackById?.(trackId);
            
            if (track && track.timelineClips) {
                if (localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo('Delete clip');
                }
                
                const idx = track.timelineClips.findIndex(c => c.id === clipId);
                if (idx > -1) {
                    track.timelineClips.splice(idx, 1);
                    if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                    localAppServices.showNotification?.('Clip deleted', 1500);
                }
            }
        }
    }
}

/**
 * Escape HTML for safe display
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// Export for manual initialization
export { showClipContextMenu, closeClipContextMenu };