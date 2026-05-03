// js/LoopRegionMarkers.js - Loop Region Markers Feature
// Add named markers at loop boundaries for section referencing

let localAppServices = {};
let markers = {}; // { markerId: { id, name, position, type: 'start'|'end', color, createdAt } }
let isEnabled = true;
const MARKER_PANEL_ID = 'loopRegionMarkersContent';
const MARKER_STYLE_ID = 'loopRegionMarkersStyles';

/**
 * Initialize Loop Region Markers module
 * @param {Object} appServices - Application services from main.js
 */
export function initLoopRegionMarkers(appServices) {
    localAppServices = appServices || {};
    
    // Wait for timeline to be ready
    setTimeout(() => {
        setupMarkerDisplay();
        setupRulerClickHandler();
    }, 500);
    
    console.log('[LoopRegionMarkers] Initialized');
}

/**
 * Get all markers
 * @returns {Object} Markers object
 */
export function getLoopRegionMarkers() {
    return JSON.parse(JSON.stringify(markers));
}

/**
 * Get marker by ID
 * @param {string} markerId
 * @returns {Object|null}
 */
export function getLoopRegionMarker(markerId) {
    if (markers[markerId]) {
        return JSON.parse(JSON.stringify(markers[markerId]));
    }
    return null;
}

/**
 * Get markers for a specific position
 * @param {number} position - Time position in seconds
 * @param {number} tolerance - Tolerance in seconds (default 0.5)
 * @returns {Array}
 */
export function getMarkersAtPosition(position, tolerance = 0.5) {
    return Object.values(markers).filter(m => 
        Math.abs(m.position - position) <= tolerance
    );
}

/**
 * Add a new loop region marker
 * @param {string} name - Marker name
 * @param {number} position - Position in seconds
 * @param {string} type - 'start' or 'end'
 * @param {string} color - Optional color hex
 * @returns {string|null} Marker ID or null
 */
export function addLoopRegionMarker(name, position, type = 'start', color = null) {
    if (!name || typeof name !== 'string') {
        console.warn('[LoopRegionMarkers] Invalid marker name');
        return null;
    }
    
    const id = `lrMarker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const markerColors = {
        start: color || '#22c55e', // green for start
        end: color || '#ef4444',   // red for end
        marker: color || '#3b82f6' // blue for generic
    };
    
    markers[id] = {
        id,
        name: name.trim(),
        position: Math.max(0, parseFloat(position) || 0),
        type: (type === 'start' || type === 'end') ? type : 'marker',
        color: markerColors[type] || markerColors.marker,
        createdAt: new Date().toISOString()
    };
    
    console.log(`[LoopRegionMarkers] Added marker "${name}" at ${position}s (${type})`);
    
    // Update display
    updateMarkerDisplay();
    
    // Capture for undo
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Add loop region marker');
    }
    
    return id;
}

/**
 * Update a marker
 * @param {string} markerId
 * @param {Object} updates - Fields to update
 * @returns {boolean}
 */
export function updateLoopRegionMarker(markerId, updates) {
    if (!markers[markerId]) {
        console.warn(`[LoopRegionMarkers] Marker ${markerId} not found`);
        return false;
    }
    
    if (updates.name !== undefined) markers[markerId].name = updates.name.trim();
    if (updates.position !== undefined) markers[markerId].position = Math.max(0, parseFloat(updates.position) || 0);
    if (updates.color !== undefined) markers[markerId].color = updates.color;
    if (updates.type !== undefined) markers[markerId].type = updates.type;
    
    console.log(`[LoopRegionMarkers] Updated marker ${markerId}`);
    updateMarkerDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Update loop region marker');
    }
    
    return true;
}

/**
 * Remove a marker
 * @param {string} markerId
 * @returns {boolean}
 */
export function removeLoopRegionMarker(markerId) {
    if (!markers[markerId]) {
        console.warn(`[LoopRegionMarkers] Marker ${markerId} not found`);
        return false;
    }
    
    const name = markers[markerId].name;
    delete markers[markerId];
    
    console.log(`[LoopRegionMarkers] Removed marker "${name}"`);
    updateMarkerDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Remove loop region marker');
    }
    
    return true;
}

/**
 * Clear all markers
 */
export function clearAllLoopRegionMarkers() {
    const count = Object.keys(markers).length;
    markers = {};
    
    console.log(`[LoopRegionMarkers] Cleared ${count} markers`);
    updateMarkerDisplay();
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo('Clear all loop region markers');
    }
}

/**
 * Sync markers with current loop region boundaries
 */
export function syncMarkersWithLoopRegion() {
    const loopState = localAppServices.stateModule || {};
    const getLoopRegion = loopState.getLoopRegion || (() => ({ enabled: false, start: 0, end: 16 }));
    
    const loopRegion = getLoopRegion();
    if (!loopRegion.enabled) return;
    
    // Find existing start/end markers
    const startMarkers = Object.values(markers).filter(m => m.type === 'start');
    const endMarkers = Object.values(markers).filter(m => m.type === 'end');
    
    // Auto-create markers for loop boundaries if none exist
    if (startMarkers.length === 0) {
        addLoopRegionMarker('Loop Start', loopRegion.start, 'start');
    }
    if (endMarkers.length === 0) {
        addLoopRegionMarker('Loop End', loopRegion.end, 'end');
    }
    
    console.log('[LoopRegionMarkers] Synced with loop region');
}

/**
 * Setup marker display on timeline ruler
 */
function setupMarkerDisplay() {
    // Create marker container if it doesn't exist
    let markerContainer = document.getElementById('loopRegionMarkerContainer');
    if (!markerContainer) {
        markerContainer = document.createElement('div');
        markerContainer.id = 'loopRegionMarkerContainer';
        markerContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 24px;
            pointer-events: none;
            z-index: 10;
        `;
        
        const timelineRuler = document.getElementById('timelineRuler') || 
                              document.querySelector('.timeline-ruler');
        if (timelineRuler) {
            timelineRuler.style.position = 'relative';
            timelineRuler.appendChild(markerContainer);
        }
    }
    
    updateMarkerDisplay();
}

/**
 * Update marker display on timeline
 */
function updateMarkerDisplay() {
    const markerContainer = document.getElementById('loopRegionMarkerContainer');
    if (!markerContainer) return;
    
    const pixelsPerSecond = localAppServices.getPixelsPerSecond ? 
                           localAppServices.getPixelsPerSecond() : 100;
    
    // Clear existing markers
    markerContainer.innerHTML = '';
    
    // Add each marker
    Object.values(markers).forEach(marker => {
        const markerEl = document.createElement('div');
        markerEl.className = 'loop-region-marker';
        markerEl.style.cssText = `
            position: absolute;
            left: ${marker.position * pixelsPerSecond}px;
            top: 2px;
            transform: translateX(-50%);
            padding: 2px 6px;
            background: ${marker.color};
            color: white;
            font-size: 9px;
            font-weight: 600;
            border-radius: 3px;
            white-space: nowrap;
            pointer-events: auto;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;
        markerEl.textContent = marker.name;
        markerEl.title = `${marker.name} (${marker.position.toFixed(1)}s)`;
        
        // Click to edit
        markerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            openMarkerEditPanel(marker.id);
        });
        
        // Drag to move
        makeMarkerDraggable(markerEl, marker);
        
        markerContainer.appendChild(markerEl);
    });
}

/**
 * Make a marker draggable
 * @param {HTMLElement} element
 * @param {Object} marker
 */
function makeMarkerDraggable(element, marker) {
    let isDragging = false;
    let startX = 0;
    let startLeft = 0;
    
    element.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX;
        startLeft = marker.position;
        element.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const pixelsPerSecond = localAppServices.getPixelsPerSecond ? 
                               localAppServices.getPixelsPerSecond() : 100;
        const deltaX = e.clientX - startX;
        const deltaTime = deltaX / pixelsPerSecond;
        const newPosition = Math.max(0, startLeft + deltaTime);
        
        // Update marker position
        marker.position = newPosition;
        element.style.left = `${newPosition * pixelsPerSecond}px`;
        element.title = `${marker.name} (${newPosition.toFixed(1)}s)`;
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'pointer';
            
            // Save the new position
            updateLoopRegionMarker(marker.id, { position: marker.position });
        }
    });
}

/**
 * Setup click handler on ruler to add markers
 */
function setupRulerClickHandler() {
    const timelineRuler = document.getElementById('timelineRuler') || 
                          document.querySelector('.timeline-ruler');
    
    if (!timelineRuler) {
        setTimeout(setupRulerClickHandler, 1000);
        return;
    }
    
    // Right-click to add marker
    timelineRuler.addEventListener('contextmenu', handleRulerRightClick);
    
    console.log('[LoopRegionMarkers] Ruler click handler attached');
}

/**
 * Handle right-click on ruler to add marker
 * @param {MouseEvent} event
 */
function handleRulerRightClick(event) {
    event.preventDefault();
    
    if (!isEnabled) return;
    
    const time = getTimeFromEvent(event);
    if (time === null) return;
    
    // Show quick add dialog
    showQuickAddMarkerDialog(event.clientX, event.clientY, time);
}

/**
 * Get time from event
 * @param {MouseEvent} event
 * @returns {number|null}
 */
function getTimeFromEvent(event) {
    const timelineRuler = document.getElementById('timelineRuler') || 
                          document.querySelector('.timeline-ruler');
    
    if (!timelineRuler) return null;
    
    const rect = timelineRuler.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const pixelsPerSecond = localAppServices.getPixelsPerSecond ? 
                           localAppServices.getPixelsPerSecond() : 100;
    
    return Math.max(0, x / pixelsPerSecond);
}

/**
 * Show quick add marker dialog
 * @param {number} x - Screen X
 * @param {number} y - Screen Y
 * @param {number} time - Time position
 */
function showQuickAddMarkerDialog(x, y, time) {
    const dialog = document.createElement('div');
    dialog.id = 'loopMarkerQuickAdd';
    dialog.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 12px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        min-width: 200px;
    `;
    
    dialog.innerHTML = `
        <div class="text-white text-sm font-medium mb-2">Add Loop Marker</div>
        <div class="text-gray-400 text-xs mb-3">Position: ${time.toFixed(1)}s</div>
        <input type="text" id="loopMarkerNameInput" placeholder="Marker name" 
            class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mb-2"
            style="outline: none;">
        <div class="flex gap-2 mb-2">
            <button id="loopMarkerTypeStart" class="flex-1 px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-500">Start</button>
            <button id="loopMarkerTypeEnd" class="flex-1 px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-500">End</button>
            <button id="loopMarkerTypeMarker" class="flex-1 px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-500">Marker</button>
        </div>
        <div class="flex justify-end gap-2">
            <button id="loopMarkerCancel" class="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Cancel</button>
            <button id="loopMarkerAdd" class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">Add</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    let selectedType = 'marker';
    
    // Type button handlers
    dialog.querySelector('#loopMarkerTypeStart').addEventListener('click', () => {
        selectedType = 'start';
        updateTypeButtons(dialog, 'start');
    });
    dialog.querySelector('#loopMarkerTypeEnd').addEventListener('click', () => {
        selectedType = 'end';
        updateTypeButtons(dialog, 'end');
    });
    dialog.querySelector('#loopMarkerTypeMarker').addEventListener('click', () => {
        selectedType = 'marker';
        updateTypeButtons(dialog, 'marker');
    });
    
    function updateTypeButtons(d, type) {
        d.querySelector('#loopMarkerTypeStart').className = `flex-1 px-2 py-1 text-xs rounded ${type === 'start' ? 'bg-green-600' : 'bg-gray-600'} text-white hover:bg-green-500`;
        d.querySelector('#loopMarkerTypeEnd').className = `flex-1 px-2 py-1 text-xs rounded ${type === 'end' ? 'bg-red-600' : 'bg-gray-600'} text-white hover:bg-red-500`;
        d.querySelector('#loopMarkerTypeMarker').className = `flex-1 px-2 py-1 text-xs rounded ${type === 'marker' ? 'bg-blue-600' : 'bg-gray-600'} text-white hover:bg-blue-500`;
    }
    
    dialog.querySelector('#loopMarkerCancel').addEventListener('click', () => dialog.remove());
    dialog.querySelector('#loopMarkerAdd').addEventListener('click', () => {
        const name = dialog.querySelector('#loopMarkerNameInput').value.trim() || `Marker ${time.toFixed(1)}s`;
        addLoopRegionMarker(name, time, selectedType);
        dialog.remove();
    });
    
    // Enter key to add
    dialog.querySelector('#loopMarkerNameInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const name = dialog.querySelector('#loopMarkerNameInput').value.trim() || `Marker ${time.toFixed(1)}s`;
            addLoopRegionMarker(name, time, selectedType);
            dialog.remove();
        } else if (e.key === 'Escape') {
            dialog.remove();
        }
    });
    
    // Focus input
    setTimeout(() => dialog.querySelector('#loopMarkerNameInput').focus(), 50);
    
    // Click outside to close
    setTimeout(() => {
        document.addEventListener('click', function closeDialog(e) {
            if (!dialog.contains(e.target)) {
                dialog.remove();
                document.removeEventListener('click', closeDialog);
            }
        });
    }, 50);
}

/**
 * Open marker edit panel
 * @param {string} markerId
 */
function openMarkerEditPanel(markerId) {
    const marker = markers[markerId];
    if (!marker) return;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        background: #1f2937;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 16px;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        min-width: 280px;
    `;
    
    dialog.innerHTML = `
        <div class="text-white text-sm font-medium mb-3">Edit Marker</div>
        <div class="mb-3">
            <label class="text-gray-400 text-xs">Name</label>
            <input type="text" id="loopMarkerEditName" value="${marker.name}" 
                class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1"
                style="outline: none;">
        </div>
        <div class="mb-3">
            <label class="text-gray-400 text-xs">Position (seconds)</label>
            <input type="number" id="loopMarkerEditPosition" value="${marker.position.toFixed(1)}" step="0.1"
                class="w-full px-2 py-1.5 bg-gray-700 text-white text-sm rounded border border-gray-600 mt-1"
                style="outline: none;">
        </div>
        <div class="mb-3">
            <label class="text-gray-400 text-xs">Color</label>
            <input type="color" id="loopMarkerEditColor" value="${marker.color}" 
                class="w-full h-8 rounded cursor-pointer mt-1">
        </div>
        <div class="flex justify-between">
            <button id="loopMarkerDelete" class="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-500">Delete</button>
            <div class="flex gap-2">
                <button id="loopMarkerEditCancel" class="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Cancel</button>
                <button id="loopMarkerEditSave" class="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelector('#loopMarkerEditCancel').addEventListener('click', () => dialog.remove());
    dialog.querySelector('#loopMarkerDelete').addEventListener('click', () => {
        removeLoopRegionMarker(markerId);
        dialog.remove();
    });
    dialog.querySelector('#loopMarkerEditSave').addEventListener('click', () => {
        const name = dialog.querySelector('#loopMarkerEditName').value.trim();
        const position = parseFloat(dialog.querySelector('#loopMarkerEditPosition').value);
        const color = dialog.querySelector('#loopMarkerEditColor').value;
        
        if (name) {
            updateLoopRegionMarker(markerId, { name, position, color });
        }
        dialog.remove();
    });
    
    // Escape to close
    document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
            dialog.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    });
}

/**
 * Open the Loop Region Markers management panel
 */
export function openLoopRegionMarkersPanel() {
    const windowId = 'loopRegionMarkers';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderMarkersPanel();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = MARKER_PANEL_ID;
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-100 dark:bg-slate-800';
    
    const options = {
        width: 400,
        height: 500,
        minWidth: 350,
        minHeight: 400,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow ? 
                localAppServices.createWindow(windowId, 'Loop Region Markers', contentContainer, options) : null;
    
    if (win?.element) {
        renderMarkersPanel();
    }
    
    return win;
}

/**
 * Render the markers panel content
 */
function renderMarkersPanel() {
    const container = document.getElementById(MARKER_PANEL_ID);
    if (!container) return;
    
    const markerList = Object.values(markers).sort((a, b) => a.position - b.position);
    
    let html = `
        <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${markerList.length} Marker${markerList.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="flex gap-2">
                <button id="lrMarkerSyncBtn" class="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600">Sync Loop</button>
                <button id="lrMarkerClearBtn" class="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Clear All</button>
            </div>
        </div>
        
        <div class="mb-3 p-2 bg-slate-700 rounded text-xs text-slate-300">
            <strong>Tip:</strong> Right-click on timeline ruler to add markers. Drag markers to move them.
        </div>
        
        <div id="lrMarkerList" class="flex-1 overflow-y-auto space-y-2">
    `;
    
    if (markerList.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No markers yet</p>
                <p class="text-xs mt-1">Right-click on timeline ruler to add</p>
            </div>
        `;
    } else {
        markerList.forEach(marker => {
            html += `
                <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 marker-item" data-id="${marker.id}">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded" style="background: ${marker.color}"></div>
                            <span class="text-sm font-medium text-gray-700 dark:text-gray-300 marker-name">${marker.name}</span>
                        </div>
                        <div class="flex gap-1">
                            <button class="lrMarkerEditBtn px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Edit</button>
                            <button class="lrMarkerDeleteBtn px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600">×</button>
                        </div>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        <span class="marker-position">${marker.position.toFixed(1)}s</span> • 
                        <span class="marker-type">${marker.type}</span>
                    </div>
                </div>
            `;
        });
    }
    
    html += `</div>`;
    
    container.innerHTML = html;
    
    // Attach event listeners
    const syncBtn = container.querySelector('#lrMarkerSyncBtn');
    syncBtn?.addEventListener('click', () => {
        syncMarkersWithLoopRegion();
        renderMarkersPanel();
    });
    
    const clearBtn = container.querySelector('#lrMarkerClearBtn');
    clearBtn?.addEventListener('click', () => {
        if (Object.keys(markers).length > 0) {
            clearAllLoopRegionMarkers();
            renderMarkersPanel();
        }
    });
    
    container.querySelectorAll('.lrMarkerEditBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.marker-item');
            const markerId = item.dataset.id;
            openMarkerEditPanel(markerId);
        });
    });
    
    container.querySelectorAll('.lrMarkerDeleteBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.marker-item');
            const markerId = item.dataset.id;
            removeLoopRegionMarker(markerId);
            renderMarkersPanel();
        });
    });
}

/**
 * Enable/disable the feature
 * @param {boolean} enabled
 */
export function setLoopRegionMarkersEnabled(enabled) {
    isEnabled = !!enabled;
    console.log(`[LoopRegionMarkers] ${isEnabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Check if feature is enabled
 * @returns {boolean}
 */
export function isLoopRegionMarkersEnabled() {
    return isEnabled;
}