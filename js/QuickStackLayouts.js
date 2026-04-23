// js/QuickStackLayouts.js - Save and recall preset window arrangements

/**
 * Quick Stack Layouts - Save and recall preset window arrangements
 * Allows saving current window positions/sizes as named layouts and restoring them
 */

// Storage for layouts: { layoutName: { windows: [...], timestamp } }
const STORAGE_KEY = 'snugosQuickStackLayouts';
const BUILT_IN_LAYOUTS = {
    'Default': {
        windows: [
            { id: 'mixer', x: 700, y: 50, width: 500, height: 400 }
        ]
    },
    'Mixing': {
        windows: [
            { id: 'mixer', x: 600, y: 30, width: 600, height: 500 },
            { id: 'masterEffects', x: 50, y: 30, width: 350, height: 400 }
        ]
    },
    'Editing': {
        windows: [
            { id: 'sequencer', x: 50, y: 30, width: 800, height: 500 }
        ]
    },
    'Live': {
        windows: [
            { id: 'mixdownVisualizer', x: 400, y: 100, width: 400, height: 350 }
        ]
    }
};

/**
 * Get all saved layouts (built-in + user saved)
 */
export function getAllLayouts() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const userLayouts = saved ? JSON.parse(saved) : {};
        return { ...BUILT_IN_LAYOUTS, ...userLayouts };
    } catch (e) {
        console.warn('[QuickStack] Error loading layouts:', e);
        return { ...BUILT_IN_LAYOUTS };
    }
}

/**
 * Save current window arrangement as a named layout
 */
export function saveCurrentLayout(name) {
    if (!name || !name.trim()) return false;
    const layoutName = name.trim();
    
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    const windows = [];
    
    openWindows.forEach((win, id) => {
        if (win.element) {
            const rect = win.element.getBoundingClientRect();
            const desktop = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
            const desktopRect = desktop ? desktop.getBoundingClientRect() : { left: 0, top: 0 };
            
            windows.push({
                id,
                x: Math.round(rect.left - desktopRect.left),
                y: Math.round(rect.top - desktopRect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                isMinimized: win.isMinimized || false
            });
        }
    });
    
    const layouts = getAllLayouts();
    layouts[layoutName] = { windows, timestamp: Date.now() };
    
    // Separate user layouts from built-in
    const userLayouts = {};
    Object.keys(layouts).forEach(key => {
        if (!BUILT_IN_LAYOUTS[key]) {
            userLayouts[key] = layouts[key];
        }
    });
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userLayouts));
        console.log(`[QuickStack] Saved layout "${layoutName}" with ${windows.length} windows`);
        return true;
    } catch (e) {
        console.error('[QuickStack] Error saving layout:', e);
        return false;
    }
}

/**
 * Delete a user-saved layout
 */
export function deleteLayout(name) {
    if (BUILT_IN_LAYOUTS[name]) {
        console.warn('[QuickStack] Cannot delete built-in layout:', name);
        return false;
    }
    
    const layouts = getAllLayouts();
    if (layouts[name]) {
        delete layouts[name];
        
        const userLayouts = {};
        Object.keys(layouts).forEach(key => {
            if (!BUILT_IN_LAYOUTS[key]) {
                userLayouts[key] = layouts[key];
            }
        });
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userLayouts));
        console.log(`[QuickStack] Deleted layout "${name}"`);
        return true;
    }
    return false;
}

/**
 * Restore a saved layout
 */
export function restoreLayout(name) {
    const layouts = getAllLayouts();
    const layout = layouts[name];
    
    if (!layout || !layout.windows || layout.windows.length === 0) {
        console.warn(`[QuickStack] Layout "${name}" not found or empty`);
        return false;
    }
    
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    layout.windows.forEach(winData => {
        // Find existing window by ID (partial match for windows like trackInspector-123)
        let targetWin = openWindows.get(winData.id);
        
        if (!targetWin) {
            // Try to find by partial ID match
            openWindows.forEach((win, id) => {
                if (id.startsWith(winData.id) || winData.id.startsWith(id)) {
                    targetWin = win;
                }
            });
        }
        
        if (targetWin && targetWin.element) {
            // Restore position and size
            if (winData.isMinimized) {
                targetWin.minimize?.();
            } else {
                targetWin.restore?.();
                targetWin.element.style.left = `${winData.x}px`;
                targetWin.element.style.top = `${winData.y}px`;
                targetWin.element.style.width = `${winData.width}px`;
                targetWin.element.style.height = `${winData.height}px`;
                targetWin.element.style.zIndex = winData.zIndex || 100;
            }
        }
    });
    
    console.log(`[QuickStack] Restored layout "${name}"`);
    return true;
}

/**
 * Open the Quick Stack Layouts panel
 */
export function openQuickStackPanel(savedState = null) {
    const windowId = 'quickStack';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateQuickStackPanel();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'quickStackContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { width: 380, height: 450, minWidth: 300, minHeight: 350, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }
    
    const win = localAppServices.createWindow(windowId, 'Quick Stack Layouts', contentContainer, options);
    if (win?.element) {
        renderQuickStackContent();
    }
    return win;
}

/**
 * Render the Quick Stack panel content
 */
function renderQuickStackContent() {
    const container = document.getElementById('quickStackContent');
    if (!container) return;
    
    const layouts = getAllLayouts();
    const layoutNames = Object.keys(layouts);
    
    let html = `
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center gap-2 mb-2">
                <input type="text" id="newLayoutName" placeholder="New layout name..." 
                    class="flex-1 px-3 py-2 text-sm border rounded dark:bg-slate-800 dark:border-slate-600">
                <button id="saveLayoutBtn" class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    Save Current
                </button>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
                Saves positions of all open windows as a preset
            </div>
        </div>
        
        <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Saved Layouts</h3>
            <button id="refreshLayoutsBtn" class="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500">
                Refresh
            </button>
        </div>
    `;
    
    if (layoutNames.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded">
                <p>No layouts saved yet.</p>
                <p class="text-xs mt-2">Save your current window arrangement with "Save Current"</p>
            </div>
        `;
    } else {
        html += `<div class="space-y-2">`;
        
        layoutNames.forEach(name => {
            const isBuiltIn = !!BUILT_IN_LAYOUTS[name];
            const layout = layouts[name];
            const windowCount = layout.windows?.length || 0;
            const timestamp = layout.timestamp ? new Date(layout.timestamp).toLocaleDateString() : 'Built-in';
            
            html += `
                <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-medium text-gray-800 dark:text-gray-200">${name}</span>
                            ${isBuiltIn ? '<span class="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">Built-in</span>' : ''}
                        </div>
                        <div class="flex items-center gap-1">
                            <button class="restore-layout-btn px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600" data-layout="${name}">
                                Restore
                            </button>
                            ${!isBuiltIn ? `<button class="delete-layout-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-layout="${name}">✕</button>` : ''}
                        </div>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                        ${windowCount} window${windowCount !== 1 ? 's' : ''} • ${timestamp}
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
    
    // Attach event handlers
    const saveBtn = container.querySelector('#saveLayoutBtn');
    const nameInput = container.querySelector('#newLayoutName');
    const refreshBtn = container.querySelector('#refreshLayoutsBtn');
    
    saveBtn?.addEventListener('click', () => {
        const name = nameInput?.value?.trim();
        if (!name) {
            localAppServices.showNotification?.('Please enter a layout name', 1500);
            return;
        }
        
        if (BUILT_IN_LAYOUTS[name]) {
            localAppServices.showNotification?.('Cannot overwrite built-in layout', 1500);
            return;
        }
        
        if (saveCurrentLayout(name)) {
            localAppServices.showNotification?.(`Layout "${name}" saved`, 1500);
            nameInput.value = '';
            renderQuickStackContent();
        }
    });
    
    refreshBtn?.addEventListener('click', () => {
        renderQuickStackContent();
    });
    
    container.querySelectorAll('.restore-layout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.dataset.layout;
            if (restoreLayout(name)) {
                localAppServices.showNotification?.(`Layout "${name}" restored`, 1500);
            }
        });
    });
    
    container.querySelectorAll('.delete-layout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.dataset.layout;
            if (deleteLayout(name)) {
                localAppServices.showNotification?.(`Layout "${name}" deleted`, 1500);
                renderQuickStackContent();
            }
        });
    });
}

/**
 * Update the Quick Stack panel if it's open
 */
export function updateQuickStackPanel() {
    const container = document.getElementById('quickStackContent');
    if (container) {
        renderQuickStackContent();
    }
}