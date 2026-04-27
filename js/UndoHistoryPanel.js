// js/UndoHistoryPanel.js - Undo/Redo Visual History Stack Panel
// Provides a visual panel showing the undo history stack with ability to restore previous states

let localAppServices = {};

/**
 * Initialize the undo history panel module
 * @param {Object} appServices - Application services from main.js
 */
export function initUndoHistoryPanel(appServices) {
    localAppServices = appServices || {};
    console.log('[UndoHistoryPanel] Module initialized');
}

/**
 * Get the undo history entries for display
 * @returns {Array} Array of undo history entries with timestamp and description
 */
function getUndoHistoryEntries() {
    try {
        if (localAppServices.getUndoStackState) {
            const undoStack = localAppServices.getUndoStackState();
            return undoStack.map((state, index) => ({
                index: index + 1,
                description: state?._undoDescription || `State ${index + 1}`,
                timestamp: state?._undoTimestamp || Date.now()
            })).reverse();
        }
    } catch (e) {
        console.warn('[UndoHistoryPanel] Error getting undo history:', e);
    }
    return [];
}

/**
 * Get the redo history entries for display
 * @returns {Array} Array of redo history entries
 */
function getRedoHistoryEntries() {
    try {
        if (localAppServices.getRedoStackState) {
            const redoStack = localAppServices.getRedoStackState();
            return redoStack.map((state, index) => ({
                index: index + 1,
                description: state?._undoDescription || `Redo ${index + 1}`,
                timestamp: state?._undoTimestamp || Date.now()
            })).reverse();
        }
    } catch (e) {
        console.warn('[UndoHistoryPanel] Error getting redo history:', e);
    }
    return [];
}

/**
 * Render the undo history panel content
 * @returns {HTMLElement} The content container element
 */
function renderUndoHistoryContent() {
    const container = document.createElement('div');
    container.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    container.id = 'undoHistoryContent';
    
    const undoEntries = getUndoHistoryEntries();
    const redoEntries = getRedoHistoryEntries();
    
    let html = `
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Undo Stack (${undoEntries.length})</h3>
            <div class="space-y-1 max-h-48 overflow-y-auto">
    `;
    
    if (undoEntries.length === 0) {
        html += `<div class="text-xs text-gray-500 dark:text-gray-400 italic">No actions to undo</div>`;
    } else {
        undoEntries.forEach(entry => {
            const date = new Date(entry.timestamp);
            const timeStr = date.toLocaleTimeString();
            html += `
                <div class="flex items-center justify-between py-1 px-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                     onclick="window.__undoHistoryJumpTo(${entry.index})">
                    <span class="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">${entry.description}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">${timeStr}</span>
                </div>
            `;
        });
    }
    
    html += `</div></div>`;
    
    html += `
        <div class="mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Redo Stack (${redoEntries.length})</h3>
            <div class="space-y-1 max-h-48 overflow-y-auto">
    `;
    
    if (redoEntries.length === 0) {
        html += `<div class="text-xs text-gray-500 dark:text-gray-400 italic">No actions to redo</div>`;
    } else {
        redoEntries.forEach(entry => {
            const date = new Date(entry.timestamp);
            const timeStr = date.toLocaleTimeString();
            html += `
                <div class="flex items-center justify-between py-1 px-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                     onclick="window.__undoHistoryRedoTo(${entry.index})">
                    <span class="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">${entry.description}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">${timeStr}</span>
                </div>
            `;
        });
    }
    
    html += `</div></div>`;
    
    html += `
        <div class="flex gap-2 mt-4">
            <button id="undoHistoryUndoBtn" class="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Undo (Ctrl+Z)
            </button>
            <button id="undoHistoryRedoBtn" class="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Redo (Ctrl+Y)
            </button>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Wire up button handlers
    setTimeout(() => {
        const undoBtn = document.getElementById('undoHistoryUndoBtn');
        const redoBtn = document.getElementById('undoHistoryRedoBtn');
        
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                if (localAppServices.undoLastAction) {
                    localAppServices.undoLastAction();
                    updateUndoHistoryPanel();
                }
            });
        }
        
        if (redoBtn) {
            redoBtn.addEventListener('click', () => {
                if (localAppServices.redoLastAction) {
                    localAppServices.redoLastAction();
                    updateUndoHistoryPanel();
                }
            });
        }
    }, 100);
    
    // Wire up global jump functions
    window.__undoHistoryJumpTo = (index) => {
        const stackSize = getUndoHistoryEntries().length;
        const stepsBack = stackSize - index;
        for (let i = 0; i < stepsBack; i++) {
            if (localAppServices.undoLastAction) {
                localAppServices.undoLastAction();
            }
        }
        updateUndoHistoryPanel();
    };
    
    window.__undoHistoryRedoTo = (index) => {
        for (let i = 0; i < index; i++) {
            if (localAppServices.redoLastAction) {
                localAppServices.redoLastAction();
            }
        }
        updateUndoHistoryPanel();
    };
    
    return container;
}

/**
 * Update the undo history panel content (re-render)
 */
function updateUndoHistoryPanel() {
    const contentEl = document.getElementById('undoHistoryContent');
    if (contentEl) {
        const newContent = renderUndoHistoryContent();
        contentEl.innerHTML = newContent.innerHTML;
    }
}

/**
 * Open the Undo History Panel
 * @param {Object} savedState - Optional saved window state
 * @returns {Object} The created window object
 */
export function openUndoHistoryPanel(savedState = null) {
    const windowId = 'undoHistory';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateUndoHistoryPanel();
        return win;
    }
    
    const contentContainer = renderUndoHistoryContent();
    
    const options = {
        width: 400,
        height: 450,
        minWidth: 300,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    if (savedState) {
        Object.assign(options, {
            x: parseInt(savedState.left, 10),
            y: parseInt(savedState.top, 10),
            width: parseInt(savedState.width, 10),
            height: parseInt(savedState.height, 10),
            zIndex: savedState.zIndex,
            isMinimized: savedState.isMinimized
        });
    }
    
    const win = localAppServices.createWindow(windowId, 'Undo History', contentContainer, options);
    if (win?.element) {
        updateUndoHistoryPanel();
    }
    return win;
}

// Export for external use
export { updateUndoHistoryPanel };