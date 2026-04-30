// js/TrackColorPanel.js - Track Color Panel for assigning colors to tracks

let localAppServices = {};
let currentTrackId = null;

/**
 * Initialize the track color panel module
 * @param {object} services - App services
 */
export function initTrackColorPanel(services) {
    localAppServices = services;
    console.log('[TrackColorPanel] Initialized');
}

/**
 * Opens the Track Color Panel for a specific track
 * @param {number} trackId - Track ID to assign color to
 */
export function openTrackColorPanel(trackId) {
    currentTrackId = trackId;
    const windowId = 'trackColor';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTrackColorContent(trackId);
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackColorContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = { 
        width: 380, 
        height: 480, 
        minWidth: 300, 
        minHeight: 400,
        initialContentKey: windowId,
        closable: true, 
        minimizable: true, 
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Track Color', contentContainer, options);
    
    if (win?.element) {
        renderTrackColorContent(trackId);
    }
    
    return win;
}

/**
 * Renders the track color panel content
 * @param {number} trackId - Track ID
 */
function renderTrackColorContent(trackId) {
    const container = document.getElementById('trackColorContent');
    if (!container) return;
    
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        container.innerHTML = '<div class="p-4 text-red-500">Track not found</div>';
        return;
    }
    
    const currentColor = track.color || '#3b82f6';
    
    // Predefined color palettes
    const palettes = {
        standard: [
            '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
            '#64748b', '#78716c', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb',
            '#9333ea', '#db2777', '#475569', '#57534e', '#b91c1c', '#c2410c', '#a16207', '#15803d'
        ],
        pastel: [
            '#fca5a5', '#fdba74', '#fde047', '#86efac', '#67e8f9', '#93c5fd', '#c4b5fd', '#f9a8d4',
            '#cbd5e1', '#d6d3d1', '#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee', '#60a5fa',
            '#a78bfa', '#f472b6', '#94a3b8', '#a8a29e'
        ],
        neon: [
            '#ff0000', '#ff6600', '#ffff00', '#00ff00', '#00ffff', '#0066ff', '#6600ff', '#ff00ff',
            '#ff3333', '#ff9933', '#ffff33', '#33ff33', '#33ffff', '#3366ff', '#9933ff', '#ff33ff',
            '#ff6699', '#99ff66', '#66ffff', '#6666ff'
        ],
        earth: [
            '#8b4513', '#a0522d', '#cd853f', '#deb887', '#f5deb3', '#556b2f', '#6b8e23', '#9acd32',
            '#8b7355', '#d2b48c', '#bc8f8f', '#c9a0dc', '#778899', '#708090', '#696969', '#808080'
        ],
        ocean: [
            '#001f3f', '#0074D9', '#7FDBFF', '#39CCCC', '#3D9970', '#2ECC40', '#01FF70', '#FFDC00',
            '#FF851B', '#FF4136', '#85144b', '#B10DC9', '#111133', '#224466', '#336688', '#4488aa'
        ]
    };
    
    const paletteNames = Object.keys(palettes);
    
    let html = `
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded" style="background-color: ${currentColor}"></div>
                <div>
                    <div class="font-medium text-gray-800 dark:text-gray-200">${escapeHtml(track.name || 'Unnamed Track')}</div>
                    <div class="text-xs text-gray-500">Current: <span class="font-mono">${currentColor}</span></div>
                </div>
            </div>
            
            <div class="flex gap-2">
                <label class="text-xs text-gray-600 dark:text-gray-400 pt-1">Pick:</label>
                <input type="color" id="trackColorPicker" value="${currentColor}" 
                    class="w-10 h-8 cursor-pointer rounded border border-gray-300 dark:border-slate-500">
                <input type="text" id="trackColorHexInput" value="${currentColor}" 
                    class="flex-1 p-1 text-sm font-mono bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded uppercase">
                <button id="applyColorBtn" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    Apply
                </button>
            </div>
        </div>
        
        <div class="mb-3">
            <div class="flex gap-1 mb-2">
                ${paletteNames.map((name, i) => `
                    <button class="palette-tab px-2 py-1 text-xs rounded ${i === 0 ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-500'}" 
                        data-palette="${name}">
                        ${name.charAt(0).toUpperCase() + name.slice(1)}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div id="colorPaletteGrid" class="grid grid-cols-8 gap-1 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
    `;
    
    // Render first palette
    const firstPalette = palettes[paletteNames[0]];
    firstPalette.forEach(color => {
        const isSelected = color === currentColor;
        html += `
            <button class="color-swatch w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110 ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}" 
                style="background-color: ${color}" 
                data-color="${color}"
                title="${color}">
            </button>
        `;
    });
    
    html += `</div>`;
    
    html += `
        <div class="mt-4 p-3 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick Actions</div>
            <div class="flex flex-wrap gap-2">
                <button id="randomColorBtn" class="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600">
                    🎲 Random
                </button>
                <button id="resetColorBtn" class="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500">
                    Reset to Default
                </button>
                <button id="copyColorBtn" class="px-3 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500">
                    📋 Copy Color
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    wireTrackColorEvents(trackId, palettes, paletteNames);
}

/**
 * Wire up event handlers for the track color panel
 */
function wireTrackColorEvents(trackId, palettes, paletteNames) {
    const container = document.getElementById('trackColorContent');
    if (!container) return;
    
    const showNotification = localAppServices.showNotification || ((msg, dur) => console.log(msg));
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    const currentColor = track.color || '#3b82f6';
    
    // Palette tabs
    container.querySelectorAll('.palette-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const paletteName = tab.dataset.palette;
            container.querySelectorAll('.palette-tab').forEach(t => {
                t.className = t.className.replace('bg-blue-500 text-white', 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-500');
            });
            tab.className = tab.className.replace('bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-500', 'bg-blue-500 text-white');
            
            const grid = container.querySelector('#colorPaletteGrid');
            if (grid && palettes[paletteName]) {
                const palette = palettes[paletteName];
                grid.innerHTML = palette.map(color => `
                    <button class="color-swatch w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110 ${color === currentColor ? 'ring-2 ring-offset-2 ring-blue-500' : ''}" 
                        style="background-color: ${color}" 
                        data-color="${color}"
                        title="${color}">
                    </button>
                `).join('');
                wireColorSwatchEvents(trackId, showNotification);
            }
        });
    });
    
    // Color picker and hex input
    const colorPicker = container.querySelector('#trackColorPicker');
    const hexInput = container.querySelector('#trackColorHexInput');
    const applyBtn = container.querySelector('#applyColorBtn');
    
    if (colorPicker && hexInput && applyBtn) {
        colorPicker.addEventListener('input', () => {
            hexInput.value = colorPicker.value;
        });
        
        hexInput.addEventListener('input', () => {
            let val = hexInput.value.trim();
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                colorPicker.value = val;
            }
        });
        
        applyBtn.addEventListener('click', () => {
            const newColor = hexInput.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
                applyColorToTrack(trackId, newColor, showNotification);
                renderTrackColorContent(trackId);
            } else {
                showNotification('Invalid hex color format', 2000);
            }
        });
    }
    
    // Color swatches
    wireColorSwatchEvents(trackId, showNotification);
    
    // Quick action buttons
    container.querySelector('#randomColorBtn')?.addEventListener('click', () => {
        const colors = palettes.standard;
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        applyColorToTrack(trackId, randomColor, showNotification);
        renderTrackColorContent(trackId);
    });
    
    container.querySelector('#resetColorBtn')?.addEventListener('click', () => {
        applyColorToTrack(trackId, '#3b82f6', showNotification);
        renderTrackColorContent(trackId);
    });
    
    container.querySelector('#copyColorBtn')?.addEventListener('click', () => {
        navigator.clipboard?.writeText(currentColor).then(() => {
            showNotification(`Copied ${currentColor} to clipboard`, 1500);
        }).catch(() => {
            showNotification(`Color: ${currentColor}`, 2000);
        });
    });
}

/**
 * Wire up events for color swatches
 */
function wireColorSwatchEvents(trackId, showNotification) {
    const container = document.getElementById('trackColorContent');
    if (!container) return;
    
    container.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const color = swatch.dataset.color;
            applyColorToTrack(trackId, color, showNotification);
            renderTrackColorContent(trackId);
        });
    });
}

/**
 * Apply color to track
 */
function applyColorToTrack(trackId, color, showNotification) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    
    // Capture state for undo
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(`Change track color`);
    }
    
    // Apply color using track method
    if (typeof track.setColor === 'function') {
        track.setColor(color, true);
    } else {
        track.color = color;
    }
    
    // Update UI
    if (localAppServices.updateTrackUI) {
        localAppServices.updateTrackUI(trackId, 'colorChanged');
    }
    if (localAppServices.renderTracks) {
        localAppServices.renderTracks();
    }
    
    showNotification(`Track color set to ${color}`, 1500);
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// Export for external use
export { openTrackColorPanel };