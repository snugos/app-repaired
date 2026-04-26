// js/PlayheadMarkerDrop.js - Playhead Marker Drop Feature
// Double-click/double-tap timeline ruler to create quick markers

let localAppServices = {};
let isEnabled = true;

/**
 * Initialize Playhead Marker Drop module
 * @param {Object} appServices - Application services from main.js
 */
export function initPlayheadMarkerDrop(appServices) {
    localAppServices = appServices || {};
    
    // Wait for timeline to be ready
    setTimeout(() => {
        setupDoubleClickHandler();
    }, 500);
    
    console.log('[PlayheadMarkerDrop] Initialized');
}

/**
 * Enable/disable the feature
 * @param {boolean} enabled
 */
export function setPlayheadMarkerDropEnabled(enabled) {
    isEnabled = !!enabled;
    console.log(`[PlayheadMarkerDrop] ${isEnabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Check if feature is enabled
 * @returns {boolean}
 */
export function isPlayheadMarkerDropEnabled() {
    return isEnabled;
}

/**
 * Setup double-click handler on timeline ruler
 */
function setupDoubleClickHandler() {
    const timelineRuler = document.getElementById('timelineRuler') || 
                          document.querySelector('.timeline-ruler') ||
                          document.getElementById('timeline');
    
    if (!timelineRuler) {
        console.warn('[PlayheadMarkerDrop] Timeline ruler not found, retrying...');
        setTimeout(setupDoubleClickHandler, 1000);
        return;
    }
    
    // Remove any existing handler to avoid duplicates
    timelineRuler.removeEventListener('dblclick', handleRulerDoubleClick);
    
    // Add double-click handler
    timelineRuler.addEventListener('dblclick', handleRulerDoubleClick);
    
    // Also handle double-tap for touch devices
    timelineRuler.addEventListener('touchend', handleRulerTouchEnd);
    
    console.log('[PlayheadMarkerDrop] Double-click handler attached to timeline ruler');
}

/**
 * Handle double-click on timeline ruler
 * @param {MouseEvent} event
 */
function handleRulerDoubleClick(event) {
    if (!isEnabled) return;
    
    const time = getTimeFromEvent(event);
    if (time === null) return;
    
    // Create marker at the clicked position
    addQuickMarker(time, event.clientX);
}

/**
 * Handle double-tap on timeline ruler (touch devices)
 * @param {TouchEvent} event
 */
function handleRulerTouchEnd(event) {
    if (!isEnabled) return;
    
    // Detect double-tap (two touches within 300ms)
    const now = Date.now();
    if (handleRulerTouchEnd.lastTap && now - handleRulerTouchEnd.lastTap < 300) {
        const touch = event.changedTouches[0];
        if (touch) {
            const syntheticEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY
            };
            const time = getTimeFromEvent(syntheticEvent);
            if (time !== null) {
                addQuickMarker(time, touch.clientX);
            }
        }
        handleRulerTouchEnd.lastTap = null;
    } else {
        handleRulerTouchEnd.lastTap = now;
    }
}

/**
 * Get time position from event
 * @param {MouseEvent} event
 * @returns {number|null} Time in seconds or null
 */
function getTimeFromEvent(event) {
    const timelineRuler = document.getElementById('timelineRuler') || 
                          document.querySelector('.timeline-ruler');
    
    if (!timelineRuler) return null;
    
    const rect = timelineRuler.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    // Get pixels per second from app services
    const pixelsPerSecond = localAppServices.getPixelsPerSecond ? 
                           localAppServices.getPixelsPerSecond() : 100;
    
    const time = x / pixelsPerSecond;
    
    // Don't allow negative times
    if (time < 0) return 0;
    
    return time;
}

/**
 * Add a quick marker at the specified time
 * @param {number} time - Time in seconds
 * @param {number} x - X position for visual feedback
 */
function addQuickMarker(time, x) {
    // Round to nearest 0.1 second for cleaner markers
    const roundedTime = Math.round(time * 10) / 10;
    
    // Check if there's a marker close to this position (within 0.5 seconds)
    const existingMarkers = localAppServices.getTimelineMarkers ? 
                           localAppServices.getTimelineMarkers() : [];
    
    const tooClose = existingMarkers.some(m => Math.abs(m.time - roundedTime) < 0.5);
    
    if (tooClose) {
        localAppServices.showNotification?.('Marker already exists nearby', 1500);
        return;
    }
    
    // Add the marker
    if (localAppServices.addTimelineMarker) {
        const marker = localAppServices.addTimelineMarker(roundedTime);
        
        // Show visual feedback
        showMarkerFeedback(x, marker);
        
        localAppServices.showNotification?.(`Marker added at ${roundedTime.toFixed(1)}s`, 1500);
        console.log(`[PlayheadMarkerDrop] Added marker at ${roundedTime}s`);
    } else {
        console.warn('[PlayheadMarkerDrop] addTimelineMarker not available');
    }
}

/**
 * Show visual feedback when marker is created
 * @param {number} x - X position
 * @param {Object} marker - The created marker object
 */
function showMarkerFeedback(x, marker) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        background: ${marker.color || '#ff6b6b'};
        color: white;
        font-size: 12px;
        font-weight: 600;
        border-radius: 4px;
        pointer-events: none;
        z-index: 10000;
        animation: markerDropFeedback 1s ease-out forwards;
    `;
    feedback.textContent = `${marker.name}`;
    
    // Add animation keyframes if not already present
    if (!document.getElementById('markerDropStyles')) {
        const style = document.createElement('style');
        style.id = 'markerDropStyles';
        style.textContent = `
            @keyframes markerDropFeedback {
                0% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-30px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => feedback.remove(), 1000);
}

/**
 * Open Playhead Marker Drop settings panel
 */
export function openPlayheadMarkerDropSettings() {
    const windowId = 'playheadMarkerDropSettings';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'playheadMarkerDropContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900';
    
    contentContainer.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-white mb-2">Playhead Marker Drop</h3>
            <p class="text-sm text-gray-400">Double-click on the timeline ruler to quickly add markers.</p>
        </div>
        
        <div class="mb-4">
            <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" id="playheadMarkerDropEnabled" ${isEnabled ? 'checked' : ''} 
                    class="w-5 h-5 rounded accent-blue-500">
                <span class="text-white">Enable Double-Click to Add Markers</span>
            </label>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-sm text-gray-300 mb-2">How to use:</div>
            <ul class="text-xs text-gray-400 space-y-1">
                <li>• Double-click on the timeline ruler to add a marker at that position</li>
                <li>• Double-tap on touch devices works the same way</li>
                <li>• Markers are automatically named (Marker 1, Marker 2, etc.)</li>
                <li>• Nearby markers (within 0.5s) are not created to avoid duplicates</li>
            </ul>
        </div>
        
        <div class="flex-1"></div>
        
        <div class="text-xs text-gray-500">
            Tip: You can also press <kbd class="px-1 py-0.5 bg-gray-700 rounded">M</kbd> while hovering over the ruler to add a marker.
        </div>
    `;
    
    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Playhead Marker Drop', contentContainer, {
        width: 350,
        height: 300,
        minWidth: 300,
        minHeight: 250,
        closable: true,
        minimizable: true,
        resizable: true
    }) : null;
    
    // Add event listeners
    setTimeout(() => {
        const checkbox = document.getElementById('playheadMarkerDropEnabled');
        checkbox?.addEventListener('change', (e) => {
            setPlayheadMarkerDropEnabled(e.target.checked);
        });
    }, 50);
    
    return win;
}