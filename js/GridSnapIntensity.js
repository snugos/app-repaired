// js/GridSnapIntensity.js - Grid Snap Intensity Control
// Adjustable snap strength (0-100%) for how strongly clips snap to grid
// 0% = no snapping, 100% = full magnetic snap

let localAppServices = {};
let gridSnapIntensity = 100; // Default 100% (full snap)
let gridDivision = 0.25; // Default: 16th notes at standard tempo

/**
 * Initialize Grid Snap Intensity module
 * @param {Object} appServices - Application services from main.js
 */
export function initGridSnapIntensity(appServices) {
    localAppServices = appServices || {};
    
    // Load saved setting if available
    if (localAppServices.getGridSnapIntensity) {
        gridSnapIntensity = localAppServices.getGridSnapIntensity();
    }
    
    // Load grid division setting
    if (localAppServices.getGridDivision) {
        gridDivision = localAppServices.getGridDivision();
    }
    
    console.log(`[GridSnapIntensity] Initialized with intensity: ${gridSnapIntensity}%, division: ${gridDivision}`);
}

/**
 * Get current grid snap intensity (0-100)
 * @returns {number} Grid snap intensity percentage
 */
export function getGridSnapIntensity() {
    return gridSnapIntensity;
}

/**
 * Set grid snap intensity (0-100)
 * @param {number} intensity - Snap intensity percentage (0-100)
 */
export function setGridSnapIntensity(intensity) {
    gridSnapIntensity = Math.max(0, Math.min(100, parseInt(intensity) || 0));
    
    // Save setting if state service available
    if (localAppServices.setGridSnapIntensityState) {
        localAppServices.setGridSnapIntensityState(gridSnapIntensity);
    }
    
    console.log(`[GridSnapIntensity] Intensity set to: ${gridSnapIntensity}%`);
    
    // Update UI if available
    updateGridSnapUI();
    
    // Show notification
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Grid snap: ${gridSnapIntensity}%`, 1000);
    }
}

/**
 * Get current grid division (in beats)
 * @returns {number} Grid division in beats
 */
export function getGridDivision() {
    return gridDivision;
}

/**
 * Set grid division for snapping
 * @param {number} division - Division in beats (0.125 = 32nd, 0.25 = 16th, 0.5 = 8th, 1 = quarter, etc.)
 */
export function setGridDivision(division) {
    gridDivision = Math.max(0.0625, parseFloat(division) || 0.25);
    
    if (localAppServices.setGridDivisionState) {
        localAppServices.setGridDivisionState(gridDivision);
    }
    
    console.log(`[GridSnapIntensity] Division set to: ${gridDivision} beats`);
    updateGridSnapUI();
}

/**
 * Apply grid snap to a position
 * Returns snapped position if intensity > 0
 * @param {number} position - Original position in seconds
 * @param {number} threshold - Snap threshold in seconds (default: 50% of grid size)
 * @returns {number} Snapped position
 */
export function snapToGrid(position, threshold = null) {
    if (gridSnapIntensity === 0) return position;
    
    // Calculate threshold based on grid division
    // Threshold is the maximum distance at which snapping kicks in
    const beatDuration = 60 / (localAppServices.getTempo ? localAppServices.getTempo() : 120);
    const gridSize = gridDivision * beatDuration;
    const snapThreshold = threshold !== null ? threshold : gridSize * (gridSnapIntensity / 100);
    
    // Find nearest grid line
    const gridIndex = Math.round(position / gridSize);
    const nearestGridLine = gridIndex * gridSize;
    
    // Calculate distance to nearest grid line
    const distance = Math.abs(position - nearestGridLine);
    
    // Apply snap based on threshold and intensity
    // At 100% intensity, snap threshold is the full grid size (strongest magnetic pull)
    // At 50% intensity, snap threshold is 50% of grid size
    // At 1% intensity, snap threshold is 1% of grid size
    
    if (distance <= snapThreshold * (gridSnapIntensity / 100)) {
        // Apply linear interpolation based on intensity
        // Higher intensity = more pull toward grid line
        const pullStrength = gridSnapIntensity / 100;
        const snapped = nearestGridLine * pullStrength + position * (1 - pullStrength);
        return snapped;
    }
    
    return position;
}

/**
 * Update UI elements showing current grid snap settings
 */
function updateGridSnapUI() {
    const intensityEl = document.getElementById('gridSnapIntensityValue');
    if (intensityEl) {
        intensityEl.textContent = `${gridSnapIntensity}%`;
    }
    
    const sliderEl = document.getElementById('gridSnapIntensitySlider');
    if (sliderEl) {
        sliderEl.value = gridSnapIntensity;
    }
    
    const divisionEl = document.getElementById('gridSnapDivisionValue');
    if (divisionEl) {
        const divisionNames = {
            0.0625: '32nd',
            0.125: '16th',
            0.25: '16th',
            0.5: '8th',
            1: 'Quarter',
            2: 'Half',
            4: 'Bar'
        };
        divisionEl.textContent = divisionNames[gridDivision] || `${gridDivision}`;
    }
}

/**
 * Open Grid Snap Intensity settings panel
 */
export function openGridSnapPanel() {
    const windowId = 'gridSnapSettings';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'gridSnapContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900 select-none';
    
    contentContainer.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-white mb-1">Grid Snap Intensity</h3>
            <p class="text-sm text-gray-400">Adjust how strongly clips snap to the grid</p>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-300">Snap Intensity</span>
                <span id="gridSnapIntensityValue" class="text-sm font-bold text-blue-400">${gridSnapIntensity}%</span>
            </div>
            <input type="range" id="gridSnapIntensitySlider" 
                min="0" max="100" value="${gridSnapIntensity}" step="5"
                class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500">
            <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>0% (Off)</span>
                <span>50%</span>
                <span>100% (Full)</span>
            </div>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-300">Grid Division</span>
                <span id="gridSnapDivisionValue" class="text-sm font-bold text-green-400">16th</span>
            </div>
            <select id="gridSnapDivisionSelect" class="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                <option value="0.0625" ${gridDivision === 0.0625 ? 'selected' : ''}>32nd notes</option>
                <option value="0.125" ${gridDivision === 0.125 ? 'selected' : ''}>16th notes (triplets)</option>
                <option value="0.25" ${gridDivision === 0.25 ? 'selected' : ''}>16th notes</option>
                <option value="0.5" ${gridDivision === 0.5 ? 'selected' : ''}>8th notes</option>
                <option value="1" ${gridDivision === 1 ? 'selected' : ''}>Quarter notes</option>
                <option value="2" ${gridDivision === 2 ? 'selected' : ''}>Half notes</option>
                <option value="4" ${gridDivision === 4 ? 'selected' : ''}>Whole bars</option>
            </select>
        </div>
        
        <div class="flex-1"></div>
        
        <div class="p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-400 mb-2">Preview:</div>
            <div class="flex items-center gap-2">
                <button id="gridSnapTestBtn" class="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
                    Test Snap
                </button>
                <div id="gridSnapTestResult" class="text-xs text-gray-300">Click to test current snap</div>
            </div>
        </div>
        
        <div class="mt-3 text-xs text-gray-500">
            <strong>Tip:</strong> At 50% intensity, clips will gently ease toward grid lines when close.
        </div>
    `;
    
    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Grid Snap Settings', contentContainer, {
        width: 350,
        height: 400,
        minWidth: 300,
        minHeight: 350,
        closable: true,
        minimizable: true,
        resizable: true
    }) : null;
    
    // Add event listeners after a short delay to ensure DOM is ready
    setTimeout(() => {
        const slider = document.getElementById('gridSnapIntensitySlider');
        slider?.addEventListener('input', (e) => {
            setGridSnapIntensity(parseInt(e.target.value));
        });
        
        const divisionSelect = document.getElementById('gridSnapDivisionSelect');
        divisionSelect?.addEventListener('change', (e) => {
            setGridDivision(parseFloat(e.target.value));
        });
        
        const testBtn = document.getElementById('gridSnapTestBtn');
        testBtn?.addEventListener('click', () => {
            const testPos = 1.73; // Arbitrary test position
            const snapped = snapToGrid(testPos);
            const resultEl = document.getElementById('gridSnapTestResult');
            if (resultEl) {
                resultEl.textContent = `${testPos.toFixed(3)}s → ${snapped.toFixed(3)}s`;
            }
        });
    }, 50);
    
    return win;
}

/**
 * Get the grid snap settings summary
 * @returns {Object} Current grid snap settings
 */
export function getGridSnapSettings() {
    return {
        intensity: gridSnapIntensity,
        division: gridDivision,
        divisionName: getGridDivisionName()
    };
}

/**
 * Get human-readable name for current grid division
 * @returns {string} Division name
 */
function getGridDivisionName() {
    if (gridDivision <= 0.0625) return '32nd';
    if (gridDivision <= 0.125) return '16th (triplets)';
    if (gridDivision <= 0.25) return '16th';
    if (gridDivision <= 0.5) return '8th';
    if (gridDivision <= 1) return 'Quarter';
    if (gridDivision <= 2) return 'Half';
    return 'Bar';
}

// Export for use by other modules
export { snapToGrid };