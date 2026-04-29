// js/ClipContextMenu.js - Right-click context menu for timeline clips
// Adds "Reverse Clip" option to clip context menu + keyboard shortcut

import { reverseAudioClip } from './ClipReverse.js';
import { getFadePresets, applyFadePresetToClip, clearFadePoints } from './ClipFadePresets.js';
import { createClipGroup, getCurrentClipSelections } from './ClipGroupManager.js';

let localAppServices = {};
let contextMenuListenersInitialized = false;
// External menu items registered by other modules (e.g., TrackFreeze)
let externalMenuItems = { clip: [], track: [] };

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
 * Add an external menu item to clip or track context menus
 * @param {object} item - { id, label, icon, action, category }
 */
export function addMenuItem(item) {
    if (!item || !item.id || !item.label) return;
    const cat = item.category === 'track' ? 'track' : 'clip';
    // Remove if already exists
    externalMenuItems[cat] = externalMenuItems[cat].filter(i => i.id !== item.id);
    externalMenuItems[cat].push(item);
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
    
    // Build menu HTML - get selected clips count for grouping
    const selectedClips = getCurrentClipSelections();
    const selectedCount = selectedClips.length;
    
    let menuHTML = `
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
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="group" data-clip-id="${clipId}" data-track-id="${trackId}">
            <span class="w-4">📦</span>
            <span>Group Clips${selectedCount > 1 ? ` (${selectedCount})` : ''}</span>
        </button>
        <div class="border-t border-gray-700 mt-1 pt-1" id="fade-presets-section">
            <div class="px-3 py-1.5 text-xs text-gray-500">Fade Presets</div>
            <div class="flex flex-wrap gap-1 px-2 py-1">
                ${getFadePresets().map(p => `
                    <button class="fade-preset-btn px-2 py-1 text-xs rounded ${clip.fadePoints?.in?.length || clip.fadePoints?.out?.length ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 hover:bg-gray-700'} text-white" 
                        data-preset-id="${p.id}" data-clip-id="${clipId}" data-track-id="${trackId}" title="${p.name}">
                        ${p.name.replace(' In', '↗').replace(' Out', '↘')}
                    </button>
                `).join('')}
                <button class="fade-preset-btn px-2 py-1 text-xs rounded bg-red-900 hover:bg-red-800 text-white" 
                    data-preset-id="__clear__" data-clip-id="${clipId}" data-track-id="${trackId}" title="Clear Fades">
                    ✕
                </button>
            </div>
        </div>
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
    
    // Add external clip menu items
    if (externalMenuItems.clip.length > 0) {
        menuHTML = menuHTML.replace('</div>\n        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="delete"', 
            externalMenuItems.clip.map(item => `
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="external_${item.id}" data-clip-id="${clipId}" data-track-id="${trackId}">
            <span class="w-4">${item.icon || '⚡'}</span>
            <span>${item.label}</span>
        </button>`).join('') + '\n        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="delete"');
    }
    
    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'clip-context-menu';
    menu.className = 'fixed bg-gray-900 border border-gray-600 rounded shadow-lg z-[10000] py-1 min-w-[220px]';
    menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
    menu.innerHTML = menuHTML;
    
    // Add event listeners for fade preset buttons (intercept before general buttons)
    menu.querySelectorAll('.fade-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const presetId = btn.dataset.presetId;
            const cId = btn.dataset.clipId;
            const tId = parseInt(btn.dataset.trackId);
            const t = localAppServices.getTrackById?.(tId);
            const c = t?.timelineClips?.find(cl => cl.id === cId);
            
            if (!c) return;
            
            if (presetId === '__clear__') {
                clearFadePoints(c);
                localAppServices.showNotification?.('Fades cleared', 1500);
            } else {
                const success = applyFadePresetToClip(c, presetId, 500);
                if (success) {
                    const preset = getFadePresets().find(p => p.id === presetId);
                    localAppServices.showNotification?.(`Applied "${preset?.name || presetId}" fade`, 1500);
                }
            }
            
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
            closeClipContextMenu();
        });
    });
    
    // Add event listeners for general buttons
    menu.querySelectorAll('button').forEach(btn => {
        if (btn.classList.contains('fade-preset-btn')) return; // Already handled
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
            
        case 'group':
            if (localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo('Group clips');
            }
            const selections = getCurrentClipSelections();
            if (selections.length >= 2) {
                createClipGroup(selections);
            } else {
                localAppServices.showNotification?.('Select at least 2 clips to group', 2000);
            }
            break;
            
        case 'properties':
            if (localAppServices.openClipOpacityPanel) {
                localAppServices.openClipOpacityPanel();
            }
            break;
            
        default:
            // Check for external actions (e.g., freezeTrack)
            if (action.startsWith('external_')) {
                const externalId = action.replace('external_', '');
                const item = externalMenuItems.clip.find(i => i.id === externalId);
                if (item && typeof window[item.action] === 'function') {
                    window[item.action](trackId, clipId);
                }
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
export { showClipContextMenu, closeClipContextMenu, addMenuItem };

// Expose on window for other modules (e.g., TrackFreeze)
if (typeof window !== 'undefined') {
    window.ClipContextMenu = { showClipContextMenu, closeClipContextMenu, addMenuItem };
}