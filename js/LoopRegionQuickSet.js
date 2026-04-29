// js/LoopRegionQuickSet.js - Loop Region Quick Set Feature
// Double-click timeline to quickly set loop region start/end points

let localAppServices = {};
let isEnabled = true;
let loopSetMode = null; // null | 'start' | 'end'
let pendingLoopStart = null;

const LOOP_SET_INDICATOR_ID = 'loopQuickSetIndicator';
const LOOP_SET_STYLE_ID = 'loopQuickSetStyles';

/**
 * Initialize Loop Region Quick Set module
 * @param {Object} appServices - Application services from main.js
 */
export function initLoopRegionQuickSet(appServices) {
    localAppServices = appServices || {};
    
    // Wait for timeline to be ready
    setTimeout(() => {
        setupDoubleClickHandler();
    }, 500);
    
    console.log('[LoopRegionQuickSet] Initialized');
}

/**
 * Enable/disable the feature
 * @param {boolean} enabled
 */
export function setLoopRegionQuickSetEnabled(enabled) {
    isEnabled = !!enabled;
    if (!isEnabled) {
        resetLoopSetState();
    }
    console.log(`[LoopRegionQuickSet] ${isEnabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Check if feature is enabled
 * @returns {boolean}
 */
export function isLoopRegionQuickSetEnabled() {
    return isEnabled;
}

/**
 * Reset the loop set state
 */
function resetLoopSetState() {
    loopSetMode = null;
    pendingLoopStart = null;
    removeIndicator();
}

/**
 * Setup double-click handler on timeline ruler
 */
function setupDoubleClickHandler() {
    const timelineRuler = document.getElementById('timelineRuler') || 
                          document.querySelector('.timeline-ruler') ||
                          document.getElementById('timeline');
    
    if (!timelineRuler) {
        console.warn('[LoopRegionQuickSet] Timeline ruler not found, retrying...');
        setTimeout(setupDoubleClickHandler, 1000);
        return;
    }
    
    // Remove any existing handler to avoid duplicates
    timelineRuler.removeEventListener('dblclick', handleRulerDoubleClick);
    
    // Add double-click handler
    timelineRuler.addEventListener('dblclick', handleRulerDoubleClick);
    
    // Also handle double-tap for touch devices
    timelineRuler.addEventListener('touchend', handleRulerTouchEnd);
    
    console.log('[LoopRegionQuickSet] Double-click handler attached to timeline ruler');
}

/**
 * Handle double-click on timeline ruler
 * @param {MouseEvent} event
 */
function handleRulerDoubleClick(event) {
    if (!isEnabled) return;
    
    const time = getTimeFromEvent(event);
    if (time === null) return;
    
    processLoopSetClick(time, event.clientX);
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
                processLoopSetClick(time, touch.clientX);
            }
        }
        handleRulerTouchEnd.lastTap = null;
    } else {
        handleRulerTouchEnd.lastTap = now;
    }
}

/**
 * Process a loop set click
 * @param {number} time - Time in seconds
 * @param {number} x - X position for visual feedback
 */
function processLoopSetClick(time, x) {
    if (loopSetMode === null) {
        // First click - set loop start
        pendingLoopStart = Math.max(0, time);
        loopSetMode = 'end';
        showIndicator(x, 'START', '#22c55e');
        localAppServices.showNotification?.(`Loop START set at ${pendingLoopStart.toFixed(1)}s - click again for END`, 2000);
        console.log(`[LoopRegionQuickSet] Loop start set at ${pendingLoopStart}s`);
    } else if (loopSetMode === 'end') {
        // Second click - set loop end
        const loopEnd = Math.max(pendingLoopStart + 0.1, time);
        const loopStart = pendingLoopStart;
        
        // Apply the loop region
        if (localAppServices.setLoopRegion) {
            localAppServices.setLoopRegion(true, loopStart, loopEnd);
        }
        if (localAppServices.setLoopRegionEnabled) {
            localAppServices.setLoopRegionEnabled(true);
        }
        if (localAppServices.setLoopRegionStart) {
            localAppServices.setLoopRegionStart(loopStart);
        }
        if (localAppServices.setLoopRegionEnd) {
            localAppServices.setLoopRegionEnd(loopEnd);
        }
        
        // Capture for undo if available
        if (localAppServices.captureStateForUndo) {
            localAppServices.captureStateForUndo('Set loop region (quick)');
        }
        
        showCompletionFeedback(x, loopStart, loopEnd);
        localAppServices.showNotification?.(`Loop region set: ${loopStart.toFixed(1)}s - ${loopEnd.toFixed(1)}s`, 2000);
        console.log(`[LoopRegionQuickSet] Loop region set: ${loopStart}s - ${loopEnd}s`);
        
        // Reset state
        resetLoopSetState();
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
 * Show indicator at position
 * @param {number} x - X position
 * @param {string} label - Label text
 * @param {string} color - Indicator color
 */
function showIndicator(x, label, color) {
    removeIndicator();
    
    const indicator = document.createElement('div');
    indicator.id = LOOP_SET_INDICATOR_ID;
    indicator.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: 50%;
        transform: translateX(-50%);
        padding: 6px 12px;
        background: ${color};
        color: white;
        font-size: 11px;
        font-weight: 700;
        border-radius: 4px;
        pointer-events: none;
        z-index: 10000;
        animation: loopQuickSetPulse 0.5s ease-out;
    `;
    indicator.textContent = label;
    
    // Add animation keyframes if not already present
    if (!document.getElementById(LOOP_SET_STYLE_ID)) {
        const style = document.createElement('style');
        style.id = LOOP_SET_STYLE_ID;
        style.textContent = `
            @keyframes loopQuickSetPulse {
                0% { opacity: 1; transform: translateX(-50%) scale(1.2); }
                100% { opacity: 1; transform: translateX(-50%) scale(1); }
            }
            @keyframes loopQuickSetFade {
                0% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(indicator);
}

/**
 * Show completion feedback
 * @param {number} x - X position
 * @param {number} start - Loop start time
 * @param {number} end - Loop end time
 */
function showCompletionFeedback(x, start, end) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: 50%;
        transform: translateX(-50%);
        padding: 8px 16px;
        background: #22c55e;
        color: white;
        font-size: 12px;
        font-weight: 600;
        border-radius: 4px;
        pointer-events: none;
        z-index: 10000;
        animation: loopQuickSetFade 1.5s ease-out forwards;
    `;
    feedback.textContent = `${start.toFixed(1)}s → ${end.toFixed(1)}s`;
    
    document.body.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => feedback.remove(), 1500);
}

/**
 * Remove the indicator
 */
function removeIndicator() {
    const indicator = document.getElementById(LOOP_SET_INDICATOR_ID);
    if (indicator) {
        indicator.remove();
    }
}

/**
 * Cancel the current loop set operation
 */
export function cancelLoopSetOperation() {
    if (loopSetMode !== null) {
        resetLoopSetState();
        localAppServices.showNotification?.('Loop set cancelled', 1000);
    }
}

/**
 * Open Loop Region Quick Set settings panel
 */
export function openLoopRegionQuickSetSettings() {
    const windowId = 'loopRegionQuickSetSettings';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'loopRegionQuickSetContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900';
    
    contentContainer.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-white mb-2">Loop Region Quick Set</h3>
            <p class="text-sm text-gray-400">Double-click on the timeline ruler to quickly set loop region points.</p>
        </div>
        
        <div class="mb-4">
            <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" id="loopRegionQuickSetEnabled" ${isEnabled ? 'checked' : ''} 
                    class="w-5 h-5 rounded accent-blue-500">
                <span class="text-white">Enable Loop Region Quick Set</span>
            </label>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-sm text-gray-300 mb-2">How to use:</div>
            <ul class="text-xs text-gray-400 space-y-1">
                <li>• Double-click on the timeline ruler to set the loop START point</li>
                <li>• Double-click again to set the loop END point</li>
                <li>• The loop region is automatically enabled</li>
                <li>• Press <kbd class="px-1 py-0.5 bg-gray-700 rounded">Esc</kbd> to cancel during the operation</li>
            </ul>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-sm text-gray-300 mb-2">Current Status:</div>
            <div id="loopQuickSetStatus" class="text-sm text-gray-400">
                ${loopSetMode === null ? 'Ready - double-click to start setting loop region' : 
                  loopSetMode === 'start' ? 'Waiting for START point...' : 'Waiting for END point...'}
            </div>
            ${loopSetMode !== null ? `<button id="cancelLoopSetBtn" class="mt-2 px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Cancel</button>` : ''}
        </div>
        
        <div class="flex-1"></div>
        
        <div class="text-xs text-gray-500">
            Note: This feature takes priority over other ruler double-click actions when active.
        </div>
    `;
    
    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Loop Region Quick Set', contentContainer, {
        width: 380,
        height: 320,
        minWidth: 320,
        minHeight: 280,
        closable: true,
        minimizable: true,
        resizable: true
    }) : null;
    
    // Add event listeners
    setTimeout(() => {
        const checkbox = document.getElementById('loopRegionQuickSetEnabled');
        checkbox?.addEventListener('change', (e) => {
            setLoopRegionQuickSetEnabled(e.target.checked);
            // Refresh panel
            if (win?.restore) win.restore();
        });
        
        const cancelBtn = document.getElementById('cancelLoopSetBtn');
        cancelBtn?.addEventListener('click', () => {
            cancelLoopSetOperation();
            if (win?.restore) win.restore();
        });
    }, 50);
    
    return win;
}

// Listen for Escape key to cancel operation
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelLoopSetOperation();
        }
    });
}