// js/TempoSyncGrid.js - Auto-update grid lines when tempo changes
// Ensures grid lines stay aligned with beats when tempo changes

let localAppServices = {};
let currentGridDivision = '1/16'; // Current grid division setting
let gridUpdateTimeout = null;
const GRID_UPDATE_DEBOUNCE_MS = 100;

/**
 * Initialize the Tempo Sync Grid module
 * @param {Object} services - App services from main.js
 */
export function initTempoSyncGrid(services) {
    localAppServices = services || {};
    console.log('[TempoSyncGrid] Initialized');

    // Hook into tempo changes
    if (localAppServices.onTempoChange) {
        const originalTempoChange = localAppServices.onTempoChange;
        localAppServices.onTempoChange = (newTempo) => {
            const result = originalTempoChange(newTempo);
            scheduleGridUpdate();
            return result;
        };
    }

    // Hook into transport position changes for continuous grid updates during playback
    if (localAppServices.onPositionChange) {
        const originalPositionChange = localAppServices.onPositionChange;
        localAppServices.onPositionChange = (position) => {
            const result = originalPositionChange(position);
            updateGridForPosition(position);
            return result;
        };
    }

    // Hook into grid division changes
    if (localAppServices.onGridDivisionChange) {
        const originalGridChange = localAppServices.onGridDivisionChange;
        localAppServices.onGridDivisionChange = (division) => {
            currentGridDivision = division;
            scheduleGridUpdate();
            return originalGridChange(division);
        };
    }
}

/**
 * Schedule a debounced grid update after tempo changes
 */
function scheduleGridUpdate() {
    if (gridUpdateTimeout) {
        clearTimeout(gridUpdateTimeout);
    }
    gridUpdateTimeout = setTimeout(() => {
        performGridUpdate();
    }, GRID_UPDATE_DEBOUNCE_MS);
}

/**
 * Perform the actual grid update based on current tempo
 */
function performGridUpdate() {
    if (!localAppServices.getCurrentTempo) {
        console.warn('[TempoSyncGrid] Cannot get current tempo');
        return;
    }

    const tempo = localAppServices.getCurrentTempo();
    if (!tempo || tempo <= 0) return;

    // Calculate new grid interval based on tempo
    const beatsPerSecond = tempo / 60;
    const secondsPerBeat = 1 / beatsPerSecond;

    // Get current grid division
    const division = getGridDivisionSeconds(currentGridDivision);
    if (!division) return;

    // Calculate number of grid lines per beat
    const linesPerBeat = Math.round(secondsPerBeat / division);

    console.log(`[TempoSyncGrid] Tempo: ${tempo} BPM, Division: ${currentGridDivision}, Lines/beat: ${linesPerBeat}`);

    // Update the grid
    if (localAppServices.updateGridLines) {
        localAppServices.updateGridLines({
            division: currentGridDivision,
            linesPerBeat: linesPerBeat,
            secondsPerBeat: secondsPerBeat,
            tempo: tempo
        });
    }

    // Update timeline ruler
    if (localAppServices.updateTimelineRuler) {
        localAppServices.updateTimelineRuler({
            tempo: tempo,
            division: currentGridDivision
        });
    }

    // Update any visual grid overlays
    if (localAppServices.refreshGridOverlay) {
        localAppServices.refreshGridOverlay();
    }
}

/**
 * Update grid during playback based on current position
 * @param {number} position - Current playback position in seconds
 */
function updateGridForPosition(position) {
    if (!localAppServices.getCurrentTempo) return;

    const tempo = localAppServices.getCurrentTempo();
    const beatsPerSecond = tempo / 60;
    const secondsPerBeat = 1 / beatsPerSecond;

    // Calculate current beat and subdivision
    const currentBeat = position / secondsPerBeat;
    const beatFraction = currentBeat - Math.floor(currentBeat);

    // Check if we're close to a grid line (within 1% of beat)
    const nearGridLine = beatFraction < 0.01 || beatFraction > 0.99;

    // Update visual indicator if close to grid
    if (localAppServices.updatePlaybackGridIndicator) {
        localAppServices.updatePlaybackGridIndicator({
            position: position,
            currentBeat: currentBeat,
            nearGridLine: nearGridLine
        });
    }
}

/**
 * Convert grid division name to seconds
 * @param {string} division - Division name (e.g., '1/4', '1/8', '1/16')
 * @returns {number} Duration in seconds
 */
function getGridDivisionSeconds(division) {
    const tempo = localAppServices.getCurrentTempo ? localAppServices.getCurrentTempo() : 120;
    const secondsPerBeat = 60 / tempo;

    const divisionMap = {
        '1/1': secondsPerBeat * 4,      // whole bar
        '1/2': secondsPerBeat * 2,      // half bar
        '1/4': secondsPerBeat,          // quarter note = 1 beat
        '1/8': secondsPerBeat / 2,      // eighth note
        '1/16': secondsPerBeat / 4,     // sixteenth note
        '1/32': secondsPerBeat / 8,     // thirty-second note
        '1/4T': secondsPerBeat / 3,     // quarter triplet
        '1/8T': secondsPerBeat / 6,     // eighth triplet
        '1/16T': secondsPerBeat / 12,   // sixteenth triplet
    };

    return divisionMap[division] || secondsPerBeat / 4; // default to 1/16
}

/**
 * Set grid division and trigger update
 * @param {string} division - Division name
 */
export function setGridDivision(division) {
    currentGridDivision = division;
    scheduleGridUpdate();
}

/**
 * Get current grid division
 * @returns {string} Current division
 */
export function getGridDivision() {
    return currentGridDivision;
}

/**
 * Force immediate grid refresh
 */
export function refreshGrid() {
    if (gridUpdateTimeout) {
        clearTimeout(gridUpdateTimeout);
    }
    performGridUpdate();
}

/**
 * Toggle snap-to-grid mode
 */
export function toggleSnapToGrid(enabled) {
    if (localAppServices.setSnapToGrid) {
        localAppServices.setSnapToGrid(enabled);
    }
    console.log(`[TempoSyncGrid] Snap to grid: ${enabled}`);
}

// Default export
export default {
    initTempoSyncGrid,
    setGridDivision,
    getGridDivision,
    refreshGrid,
    toggleSnapToGrid
};