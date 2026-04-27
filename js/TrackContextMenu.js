// js/TrackContextMenu.js - Right-click context menu for track lanes
// Adds "Duplicate Track" and other track actions to the timeline

let localAppServices = {};
let contextMenuListenersInitialized = false;

/**
 * Initialize the track context menu module
 * @param {object} services - App services
 */
export function initTrackContextMenu(services) {
    localAppServices = services;
    
    if (contextMenuListenersInitialized) return;
    
    // Use delegated events on desktop to catch track lane right-clicks
    document.addEventListener('contextmenu', handleTrackContextMenu);
    
    contextMenuListenersInitialized = true;
    console.log('[TrackContextMenu] Initialized - track lane right-click menu enabled');
}

/**
 * Handle right-click context menu on track lanes
 * @param {MouseEvent} e
 */
function handleTrackContextMenu(e) {
    const trackLane = e.target.closest('.timeline-track-lane');
    
    if (!trackLane) return;
    
    const trackId = trackLane.dataset.trackId;
    if (!trackId) return;
    
    // Don't show menu if clicking on a clip (let ClipContextMenu handle that)
    if (e.target.closest('[data-clip-id]')) return;
    
    e.preventDefault();
    showTrackContextMenu(e.clientX, e.clientY, parseInt(trackId));
}

/**
 * Show context menu for a track
 * @param {number} x - Mouse X position
 * @param {number} y - Mouse Y position
 * @param {number} trackId - Track ID
 */
function showTrackContextMenu(x, y, trackId) {
    // Remove any existing context menu
    closeTrackContextMenu();
    
    // Get track info
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    const trackName = track.name || 'Unnamed Track';
    const trackType = track.type || 'Unknown';
    
    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'track-context-menu';
    menu.className = 'fixed bg-gray-900 border border-gray-600 rounded shadow-lg z-[10000] py-1 min-w-[200px]';
    menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 250)}px`;
    
    menu.innerHTML = `
        <div class="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700">
            ${escapeHtml(trackName)} <span class="text-gray-500">(${trackType})</span>
        </div>
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="duplicate" data-track-id="${trackId}">
            <span class="w-4">📋</span>
            <span>Duplicate Track</span>
            <span class="ml-auto text-xs text-gray-500">Ctrl+D</span>
        </button>
        <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="rename" data-track-id="${trackId}">
            <span class="w-4">✏️</span>
            <span>Rename Track</span>
        </button>
        <div class="border-t border-gray-700 mt-1 pt-1">
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="color" data-track-id="${trackId}">
                <span class="w-4">🎨</span>
                <span>Change Color</span>
            </button>
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="height" data-track-id="${trackId}">
                <span class="w-4">📏</span>
                <span>Adjust Height</span>
            </button>
        </div>
        <div class="border-t border-gray-700 mt-1 pt-1">
            <button class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 flex items-center gap-2" data-action="delete" data-track-id="${trackId}">
                <span class="w-4">🗑️</span>
                <span>Delete Track</span>
                <span class="ml-auto text-xs text-gray-500">Del</span>
            </button>
        </div>
    `;
    
    // Add event listeners
    menu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            const tId = parseInt(e.currentTarget.dataset.trackId);
            
            handleTrackAction(action, tId);
            closeTrackContextMenu();
        });
    });
    
    document.body.appendChild(menu);
    
    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', closeTrackContextMenu, { once: true });
    }, 10);
}

/**
 * Close the track context menu
 */
function closeTrackContextMenu() {
    const menu = document.getElementById('track-context-menu');
    if (menu) menu.remove();
}

/**
 * Handle track action from context menu
 * @param {string} action - Action to perform
 * @param {number} trackId - Track ID
 */
function handleTrackAction(action, trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    switch (action) {
        case 'duplicate':
            if (localAppServices.duplicateTrack) {
                localAppServices.duplicateTrack(trackId);
                localAppServices.showNotification?.('Track duplicated', 1500);
            } else if (localAppServices.createTrack) {
                // Fallback: create a new track with same settings
                const newTrack = localAppServices.createTrack(track.type, {
                    name: `${track.name || 'Track'} (Copy)`,
                    volume: track.volume,
                    pan: track.pan,
                    muted: track.muted,
                    soloed: false,
                    armed: false
                });
                if (newTrack) {
                    localAppServices.showNotification?.('Track duplicated', 1500);
                    if (localAppServices.renderTracks) localAppServices.renderTracks();
                }
            }
            break;
            
        case 'rename':
            const newName = prompt('Enter new track name:', track.name || '');
            if (newName !== null && newName.trim()) {
                if (localAppServices.updateTrackUI) {
                    localAppServices.updateTrackUI(trackId, 'name', newName.trim());
                }
                track.name = newName.trim();
                localAppServices.showNotification?.('Track renamed', 1500);
                if (localAppServices.renderTracks) localAppServices.renderTracks();
            }
            break;
            
        case 'color':
            if (localAppServices.openTrackColorPanel) {
                localAppServices.openTrackColorPanel(trackId);
            } else {
                // Built-in color picker
                const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
                const colorName = prompt(`Choose color for "${track.name}":\n\n${colors.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nEnter number (1-8):`, '');
                const colorIndex = parseInt(colorName) - 1;
                if (colorIndex >= 0 && colorIndex < colors.length) {
                    track.color = colors[colorIndex];
                    if (localAppServices.renderTracks) localAppServices.renderTracks();
                    localAppServices.showNotification?.('Track color changed', 1500);
                }
            }
            break;
            
        case 'height':
            const heights = { Small: 60, Medium: 100, Large: 150, XL: 200 };
            const heightName = prompt(`Choose height for "${track.name}":\n\n${Object.keys(heights).map((k, i) => `${i + 1}. ${k}`).join('\n')}\n\nEnter number (1-4):`, '');
            const heightIndex = parseInt(heightName) - 1;
            const heightKeys = Object.keys(heights);
            if (heightIndex >= 0 && heightIndex < heightKeys.length) {
                const newHeight = heights[heightKeys[heightIndex]];
                if (localAppServices.setTrackHeight) {
                    localAppServices.setTrackHeight(trackId, newHeight);
                }
                localAppServices.showNotification?.(`Track height set to ${heightKeys[heightIndex]}`, 1500);
                if (localAppServices.renderTracks) localAppServices.renderTracks();
            }
            break;
            
        case 'delete':
            if (confirm(`Delete track "${track.name || 'Unnamed Track'}"?`)) {
                if (localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo('Delete track');
                }
                if (localAppServices.removeTrack) {
                    localAppServices.removeTrack(trackId);
                    localAppServices.showNotification?.('Track deleted', 1500);
                }
            }
            break;
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
export { showTrackContextMenu, closeTrackContextMenu };