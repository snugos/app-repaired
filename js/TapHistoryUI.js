// js/TapHistoryUI.js - Tap Tempo History Display
// Shows recent tap tempo values in a visual panel to help identify the right tempo

let localAppServices = {};
let tapHistory = []; // Array of { bpm, timestamp }
const MAX_HISTORY = 20;
let historyPanel = null;
let isVisible = false;

/**
 * Initialize Tap History UI module
 * @param {Object} services - App services from main.js
 */
export function initTapHistoryUI(services) {
    localAppServices = services || {};
    console.log('[TapHistoryUI] Initialized');
}

/**
 * Record a tap tempo value
 * @param {number} bpm - The detected BPM from tap
 */
export function recordTap(bpm) {
    const now = Date.now();
    tapHistory.push({ bpm, timestamp: now });
    
    // Keep only MAX_HISTORY entries
    if (tapHistory.length > MAX_HISTORY) {
        tapHistory.shift();
    }
    
    updatePanelDisplay();
}

/**
 * Get the tap history
 * @returns {Array} Array of { bpm, timestamp }
 */
export function getTapHistory() {
    return [...tapHistory];
}

/**
 * Get the most recent tap value
 * @returns {number|null} Most recent BPM or null
 */
export function getLastTap() {
    if (tapHistory.length === 0) return null;
    return tapHistory[tapHistory.length - 1].bpm;
}

/**
 * Get the average of recent taps (excluding outliers)
 * @param {number} count - Number of recent taps to average (default: all)
 * @returns {number|null} Average BPM or null
 */
export function getAverageTap(count = null) {
    if (tapHistory.length === 0) return null;
    
    const taps = count ? tapHistory.slice(-count) : tapHistory;
    const sum = taps.reduce((acc, t) => acc + t.bpm, 0);
    return Math.round(sum / taps.length);
}

/**
 * Get the most common BPM value (mode)
 * @returns {number|null} Most common BPM or null
 */
export function getModeTap() {
    if (tapHistory.length === 0) return null;
    
    const counts = {};
    tapHistory.forEach(t => {
        const rounded = Math.round(t.bpm / 5) * 5; // Group by 5 BPM
        counts[rounded] = (counts[rounded] || 0) + 1;
    });
    
    let maxCount = 0;
    let modeValue = null;
    for (const [bpm, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            modeValue = parseInt(bpm, 10);
        }
    }
    return modeValue;
}

/**
 * Clear the tap history
 */
export function clearHistory() {
    tapHistory = [];
    updatePanelDisplay();
}

/**
 * Toggle the history panel visibility
 */
export function toggleHistoryPanel() {
    if (isVisible) {
        hidePanel();
    } else {
        showPanel();
    }
}

/**
 * Show the history panel
 */
export function showPanel() {
    if (historyPanel) {
        historyPanel.style.display = 'block';
        isVisible = true;
        return;
    }
    
    // Create the panel
    historyPanel = document.createElement('div');
    historyPanel.id = 'tapHistoryPanel';
    historyPanel.style.cssText = `
        position: fixed;
        bottom: 40px;
        right: 20px;
        width: 200px;
        background: rgba(30, 30, 30, 0.95);
        border: 1px solid #444;
        border-radius: 8px;
        padding: 12px;
        z-index: 9990;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: #ddd;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    
    updatePanelContent();
    document.body.appendChild(historyPanel);
    isVisible = true;
}

/**
 * Hide the history panel
 */
export function hidePanel() {
    if (historyPanel) {
        historyPanel.style.display = 'none';
        isVisible = false;
    }
}

/**
 * Update the panel content
 */
function updatePanelContent() {
    if (!historyPanel) return;
    
    const stats = getStats();
    const historyItems = tapHistory.slice(-10).reverse();
    
    let historyHtml = historyItems.map(t => {
        const age = Date.now() - t.timestamp;
        const ageStr = age < 1000 ? 'just now' : `${Math.round(age / 1000)}s ago`;
        return `<div style display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #333; font-size: 11px; color: #aaa;><span>${Math.round(t.bpm)} BPM</span><span style color: #666;>${ageStr}</span></div>`;
    }).join('');
    
    if (historyItems.length === 0) {
        historyHtml = '<div style color: #666; text-align: center; padding: 8px 0; font-size: 11px;>No taps yet</div>';
    }
    
    historyPanel.innerHTML = `
        <div style display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 8px;>
            <span style font-weight: 600; color: #fff;>Tap History</span>
            <button id=\"tapHistoryCloseBtn\" style background: none; border: none; color: #888; cursor: pointer; font-size: 16px; line-height: 1; padding: 0;>&times;</button>
        </div>
        <div style display: flex; gap: 8px; margin-bottom: 10px; padding: 6px; background: #222; border-radius: 4px;>
            <div style flex: 1; text-align: center;>
                <div style font-size: 10px; color: #666; margin-bottom: 2px;>AVG</div>
                <div style font-size: 14px; font-weight: 600; color: #00d4ff;>${stats.avg !== null ? stats.avg + ' BPM' : '-'}</div>
            </div>
            <div style flex: 1; text-align: center;>
                <div style font-size: 10px; color: #666; margin-bottom: 2px;>MODE</div>
                <div style font-size: 14px; font-weight: 600; color: #ff9500;>${stats.mode !== null ? stats.mode + ' BPM' : '-'}</div>
            </div>
            <div style flex: 1; text-align: center;>
                <div style font-size: 10px; color: #666; margin-bottom: 2px;>COUNT</div>
                <div style font-size: 14px; font-weight: 600; color: #aaa;>${tapHistory.length}</div>
            </div>
        </div>
        <div style max-height: 150px; overflow-y: auto;>
            ${historyHtml}
        </div>
        <div style margin-top: 8px; display: flex; gap: 6px;>
            <button id=\"tapHistoryApplyBtn\" style flex: 1; padding: 6px 8px; background: #00d4ff; border: none; border-radius: 4px; color: #000; font-weight: 600; font-size: 11px; cursor: pointer;>Apply Avg</button>
            <button id=\"tapHistoryClearBtn\" style padding: 6px 8px; background: #444; border: none; border-radius: 4px; color: #fff; font-size: 11px; cursor: pointer;>Clear</button>
        </div>
    `;
    
    // Attach event listeners
    document.getElementById('tapHistoryCloseBtn').addEventListener('click', () => hidePanel());
    document.getElementById('tapHistoryApplyBtn').addEventListener('click', () => {
        const avg = getAverageTap(5); // Use last 5 taps
        if (avg !== null) {
            localAppServices.setTempo?.(avg);
            localAppServices.showNotification?.(`Tempo set to ${avg} BPM (avg of last 5 taps)`, 2000);
        }
    });
    document.getElementById('tapHistoryClearBtn').addEventListener('click', () => clearHistory());
}

/**
 * Update only the display values without full refresh
 */
function updatePanelDisplay() {
    if (!historyPanel || historyPanel.style.display === 'none') return;
    updatePanelContent();
}

/**
 * Get statistics from tap history
 * @returns {Object} { avg, mode, count }
 */
function getStats() {
    return {
        avg: getAverageTap(),
        mode: getModeTap(),
        count: tapHistory.length
    };
}

// Connect to the global TapTempo if available
if (typeof window.TapTempo !== 'undefined') {
    const originalAddTap = window.TapTempo.addTap.bind(window.TapTempo);
    window.TapTempo.addTap = function(bpm) {
        const result = originalAddTap(bpm);
        recordTap(result);
        return result;
    };
}

// Export for external use
window.TapHistoryUI = {
    initTapHistoryUI,
    recordTap,
    getTapHistory,
    getLastTap,
    getAverageTap,
    getModeTap,
    clearHistory,
    toggleHistoryPanel,
    showPanel,
    hidePanel
};