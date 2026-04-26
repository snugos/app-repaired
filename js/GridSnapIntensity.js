// js/GridSnapIntensity.js - Grid Snap Intensity Control
// Adjustable snap strength (0-100%) for how strongly clips snap to grid

let localAppServices = {};
let snapIntensity = 100; // 0-100, default 100%
const STORAGE_KEY = 'snaw_grid_snap_intensity';

/**
 * Initialize Grid Snap Intensity module
 * @param {Object} appServices - Application services from main.js
 */
export function initGridSnapIntensity(appServices) {
    localAppServices = appServices || {};
    loadSnapIntensity();
    console.log('[GridSnapIntensity] Initialized with intensity:', snapIntensity, '%');
}

// Load saved intensity
function loadSnapIntensity() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
            snapIntensity = Math.max(0, Math.min(100, parseInt(saved, 10) || 100));
        }
    } catch (e) {
        console.warn('[GridSnapIntensity] Could not load:', e);
    }
}

// Save intensity
function saveSnapIntensity() {
    try {
        localStorage.setItem(STORAGE_KEY, String(snapIntensity));
    } catch (e) {
        console.warn('[GridSnapIntensity] Could not save:', e);
    }
}

/**
 * Get current snap intensity
 * @returns {number} 0-100
 */
export function getSnapIntensity() {
    return snapIntensity;
}

/**
 * Set snap intensity
 * @param {number} value - 0 to 100
 */
export function setSnapIntensity(value) {
    snapIntensity = Math.max(0, Math.min(100, parseInt(value, 10) || 100));
    saveSnapIntensity();
    console.log(`[GridSnapIntensity] Set to: ${snapIntensity}%`);
    notifyChange();
}

/**
 * Calculate actual snap offset based on intensity
 * @param {number} targetPosition - The ideal snap position
 * @param {number} currentPosition - Current drag position
 * @returns {number} Adjusted position
 */
export function calculateSnapPosition(targetPosition, currentPosition) {
    if (snapIntensity === 0) return currentPosition;
    if (snapIntensity === 100) return targetPosition;
    
    // Linear interpolation between current and target based on intensity
    const diff = targetPosition - currentPosition;
    const snapAmount = diff * (snapIntensity / 100);
    return currentPosition + snapAmount;
}

/**
 * Check if snap is active (intensity > 0)
 * @returns {boolean}
 */
export function isSnapActive() {
    return snapIntensity > 0;
}

// Callbacks for UI updates
let changeCallbacks = [];

export function onSnapIntensityChange(callback) {
    if (typeof callback === 'function') {
        changeCallbacks.push(callback);
    }
}

function notifyChange() {
    changeCallbacks.forEach(cb => {
        try { cb(snapIntensity); } catch (e) { console.warn(e); }
    });
}

// --- UI Panel ---

/**
 * Open Grid Snap Intensity panel
 */
export function openGridSnapIntensityPanel() {
    const windowId = 'gridSnapIntensityPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'gridSnapIntensityContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Grid Snap Intensity', contentContainer, {
        width: 320,
        height: 200,
        minWidth: 280,
        minHeight: 160,
        closable: true,
        minimizable: true,
        resizable: true
    }) : null;

    if (win?.element) {
        renderGridSnapIntensityContent();
    }
    return win;
}

/**
 * Render the panel content
 */
function renderGridSnapIntensityContent() {
    const container = document.getElementById('gridSnapIntensityContent');
    if (!container) return;

    container.innerHTML = `
        <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
                <label class="text-sm text-gray-300">Snap Strength</label>
                <span id="snapIntensityValue" class="text-lg font-mono text-white">${snapIntensity}%</span>
            </div>
            <input type="range" id="snapIntensitySlider" min="0" max="100" value="${snapIntensity}" 
                class="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500">
            <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>0% (Free)</span>
                <span>50% (Partial)</span>
                <span>100% (Full)</span>
            </div>
        </div>
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-400 mb-2">Presets:</div>
            <div class="flex gap-2">
                <button class="snap-preset px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600" data-value="0">Off</button>
                <button class="snap-preset px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600" data-value="25">25%</button>
                <button class="snap-preset px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600" data-value="50">50%</button>
                <button class="snap-preset px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500" data-value="75">75%</button>
                <button class="snap-preset px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500" data-value="100">Full</button>
            </div>
        </div>
        <div class="text-xs text-gray-500">
            Adjust how strongly clips snap to the grid when dragging. Lower values allow more free positioning.
        </div>
    `;

    // Slider handler
    const slider = container.querySelector('#snapIntensitySlider');
    const valueDisplay = container.querySelector('#snapIntensityValue');
    
    slider?.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        valueDisplay.textContent = `${value}%`;
        setSnapIntensity(value);
    });

    // Preset buttons
    container.querySelectorAll('.snap-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const value = parseInt(e.target.dataset.value, 10);
            slider.value = value;
            valueDisplay.textContent = `${value}%`;
            setSnapIntensity(value);
        });
    });
}

/**
 * Update panel if open
 */
export function updateGridSnapIntensityPanel() {
    const container = document.getElementById('gridSnapIntensityContent');
    if (container) {
        const slider = container.querySelector('#snapIntensitySlider');
        const valueDisplay = container.querySelector('#snapIntensityValue');
        if (slider) slider.value = snapIntensity;
        if (valueDisplay) valueDisplay.textContent = `${snapIntensity}%`;
    }
}