// js/MixdownGhost.js - Real-time dry/wet comparison toggle for effects
// Allows comparing processed vs unprocessed audio on any track

let localAppServices = {};
let ghostTrackStates = {}; // { trackId: { isGhostEnabled: bool, ghostGain: number } }
let ghostAnalysers = {}; // For visualization

/**
 * Initialize MixdownGhost with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initMixdownGhost(appServices) {
    localAppServices = appServices || {};
    console.log('[MixdownGhost] Initialized');
}

/**
 * Opens the Mixdown Ghost panel
 * @param {Object} savedState - Optional saved window state
 */
export function openMixdownGhostPanel(savedState = null) {
    const windowId = 'mixdownGhost';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderMixdownGhostContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'mixdownGhostContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 420,
        height: 500,
        minWidth: 350,
        minHeight: 400,
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

    const win = localAppServices.createWindow(windowId, 'Mixdown Ghost', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderMixdownGhostContent(), 50);
    }
    return win;
}

/**
 * Renders the Mixdown Ghost panel content
 */
function renderMixdownGhostContent() {
    const container = document.getElementById('mixdownGhostContent');
    if (!container) return;

    const tracks = localAppServices.getTracks?.() || [];

    let html = `
        <div class="mb-3">
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">
                Toggle ghost mode on tracks to compare dry vs wet signal in real-time.
            </p>
        </div>
        
        <div class="flex items-center justify-between mb-3 px-1">
            <span class="text-xs text-gray-500">Track</span>
            <div class="flex items-center gap-4 text-xs text-gray-500">
                <span>Ghost</span>
                <span>Dry Level</span>
                <span>Wet Level</span>
            </div>
        </div>
        
        <div id="ghostTracksList" class="space-y-2">
    `;

    // Only show tracks that have effects (non-trivial to compare)
    const tracksWithEffects = tracks.filter(t => 
        t.effects && t.effects.length > 0 && t.trackType !== 'audio'
    );

    if (tracksWithEffects.length === 0) {
        html += `
            <div class="text-center text-gray-500 py-6">
                <p class="text-sm">No tracks with effects.</p>
                <p class="text-xs mt-1">Add effects to tracks to use Mixdown Ghost comparison.</p>
            </div>
        `;
    } else {
        tracksWithEffects.forEach(track => {
            const ghostState = ghostTrackStates[track.id] || { isGhostEnabled: false, ghostGain: 0.5 };
            
            html += `
                <div class="bg-white dark:bg-slate-700 rounded-lg p-3 border border-gray-200 dark:border-slate-600" data-track-id="${track.id}">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-medium text-gray-800 dark:text-white truncate max-w-[120px]" title="${track.name}">
                                ${track.name}
                            </span>
                            <span class="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300">
                                ${track.trackType}
                            </span>
                        </div>
                        
                        <div class="flex items-center gap-3">
                            <button class="ghost-toggle-btn px-3 py-1 text-xs rounded font-medium transition-colors ${
                                ghostState.isGhostEnabled 
                                    ? 'bg-purple-500 text-white' 
                                    : 'bg-gray-300 dark:bg-slate-500 text-gray-700 dark:text-gray-200'
                            }" data-track-id="${track.id}">
                                ${ghostState.isGhostEnabled ? '🔊 ON' : '🔇 OFF'}
                            </button>
                            
                            <div class="flex items-center gap-1">
                                <label class="text-xs text-gray-500">D</label>
                                <input type="range" min="0" max="100" value="${ghostState.ghostGain * 100}" 
                                    class="ghost-dry-slider w-16 h-4 text-xs" data-track-id="${track.id}">
                            </div>
                            
                            <div class="flex items-center gap-1">
                                <label class="text-xs text-gray-500">W</label>
                                <input type="range" min="0" max="100" value="${(1 - ghostState.ghostGain) * 100}" 
                                    class="ghost-wet-slider w-16 h-4 text-xs" data-track-id="${track.id}">
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-2 flex items-center gap-2">
                        <span class="text-xs text-gray-500">Effects:</span>
                        <span class="text-xs text-gray-600 dark:text-gray-400">
                            ${track.effects.map(e => e.effectType).join(' → ')}
                        </span>
                    </div>
                </div>
            `;
        });
    }

    html += `
        </div>
        
        <div class="mt-4 pt-3 border-t border-gray-200 dark:border-slate-600">
            <div class="flex items-center justify-between">
                <button id="ghostAllBtn" class="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors">
                    Enable All Ghosts
                </button>
                <button id="ghostNoneBtn" class="px-3 py-1.5 text-sm bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-slate-500 transition-colors">
                    Disable All
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Ghost toggle buttons
    container.querySelectorAll('.ghost-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trackId = e.target.dataset.trackId;
            toggleGhostMode(trackId);
            renderMixdownGhostContent();
            
            // Also update track header if visible
            updateTrackHeaderGhostButton(trackId);
        });
    });

    // Dry sliders
    container.querySelectorAll('.ghost-dry-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const trackId = e.target.dataset.trackId;
            const dryValue = parseInt(e.target.value) / 100;
            setGhostDryWet(trackId, dryValue);
        });
    });

    // Wet sliders
    container.querySelectorAll('.ghost-wet-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const trackId = e.target.dataset.trackId;
            const wetValue = parseInt(e.target.value) / 100;
            setGhostDryWet(trackId, 1 - wetValue);
        });
    });

    // Enable all button
    container.querySelector('#ghostAllBtn')?.addEventListener('click', () => {
        tracksWithEffects.forEach(track => {
            enableGhostMode(track.id);
        });
        renderMixdownGhostContent();
        updateAllTrackHeaderGhostButtons();
    });

    // Disable all button
    container.querySelector('#ghostNoneBtn')?.addEventListener('click', () => {
        tracksWithEffects.forEach(track => {
            disableGhostMode(track.id);
        });
        renderMixdownGhostContent();
        updateAllTrackHeaderGhostButtons();
    });
}

/**
 * Toggle ghost mode for a track
 * @param {string} trackId - Track ID
 */
export function toggleGhostMode(trackId) {
    if (!ghostTrackStates[trackId]) {
        ghostTrackStates[trackId] = { isGhostEnabled: false, ghostGain: 0.5 };
    }
    
    ghostTrackStates[trackId].isGhostEnabled = !ghostTrackStates[trackId].isGhostEnabled;
    
    console.log(`[MixdownGhost] Track ${trackId} ghost mode: ${ghostTrackStates[trackId].isGhostEnabled ? 'ON' : 'OFF'}`);
    
    applyGhostModeToTrack(trackId);
    
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(`Toggle Mixdown Ghost for track`);
    }
}

/**
 * Enable ghost mode for a track
 * @param {string} trackId - Track ID
 */
function enableGhostMode(trackId) {
    if (!ghostTrackStates[trackId]) {
        ghostTrackStates[trackId] = { isGhostEnabled: false, ghostGain: 0.5 };
    }
    ghostTrackStates[trackId].isGhostEnabled = true;
    applyGhostModeToTrack(trackId);
}

/**
 * Disable ghost mode for a track
 * @param {string} trackId - Track ID
 */
function disableGhostMode(trackId) {
    if (ghostTrackStates[trackId]) {
        ghostTrackStates[trackId].isGhostEnabled = false;
        applyGhostModeToTrack(trackId);
    }
}

/**
 * Set dry/wet balance for a track
 * @param {string} trackId - Track ID
 * @param {number} dryAmount - Dry signal amount (0-1)
 */
function setGhostDryWet(trackId, dryAmount) {
    if (!ghostTrackStates[trackId]) {
        ghostTrackStates[trackId] = { isGhostEnabled: true, ghostGain: 0.5 };
    }
    ghostTrackStates[trackId].ghostGain = Math.max(0, Math.min(1, dryAmount));
    applyGhostModeToTrack(trackId);
}

/**
 * Apply ghost mode settings to a track's audio chain
 * @param {string} trackId - Track ID
 */
function applyGhostModeToTrack(trackId) {
    const state = ghostTrackStates[trackId];
    if (!state) return;
    
    // Get track from state
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    // Find the track's gain node in audio context
    if (localAppServices.getTrackAudioNode) {
        const audioNode = localAppServices.getTrackAudioNode(trackId);
        if (audioNode) {
            // If ghost is enabled and gain is not 1.0, we need to mix dry signal
            if (state.isGhostEnabled && state.ghostGain !== 1.0) {
                // Create a dry path if not exists
                setupGhostDryPath(trackId, audioNode, state.ghostGain);
            } else {
                // Remove dry path
                removeGhostDryPath(trackId);
            }
        }
    }
    
    console.log(`[MixdownGhost] Applied to track ${trackId}: enabled=${state.isGhostEnabled}, dry=${state.ghostGain}`);
}

/**
 * Set up a dry signal bypass path for ghost comparison
 * @param {string} trackId - Track ID
 * @param {Object} wetNode - The wet signal node
 * @param {number} dryAmount - Amount of dry signal to mix
 */
function setupGhostDryPath(trackId, wetNode, dryAmount) {
    // This is a simplified version - real implementation would need 
    // to insert a parallel dry/wet mixer in the track's audio chain
    // For now, we'll use a GainNode on the master output to simulate the effect
    
    if (localAppServices.setTrackGhostMode) {
        localAppServices.setTrackGhostMode(trackId, dryAmount);
    }
}

/**
 * Remove the dry signal bypass path
 * @param {string} trackId - Track ID
 */
function removeGhostDryPath(trackId) {
    if (localAppServices.setTrackGhostMode) {
        localAppServices.setTrackGhostMode(trackId, null); // null = disabled
    }
}

/**
 * Update a single track header with ghost button state
 * @param {string} trackId - Track ID
 */
function updateTrackHeaderGhostButton(trackId) {
    const state = ghostTrackStates[trackId];
    if (!state) return;
    
    // Find the track header button if it exists
    const btn = document.querySelector(`.ghost-mode-btn[data-track-id="${trackId}"]`);
    if (btn) {
        btn.className = `ghost-mode-btn px-2 py-1 text-xs rounded font-medium transition-colors ${
            state.isGhostEnabled 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-600 text-gray-300'
        }`;
        btn.textContent = state.isGhostEnabled ? '👻 ON' : '👻';
    }
}

/**
 * Update all track header ghost buttons
 */
function updateAllTrackHeaderGhostButtons() {
    Object.keys(ghostTrackStates).forEach(trackId => {
        updateTrackHeaderGhostButton(trackId);
    });
}

/**
 * Get ghost state for a track
 * @param {string} trackId - Track ID
 * @returns {Object} Ghost state
 */
export function getGhostState(trackId) {
    return ghostTrackStates[trackId] || { isGhostEnabled: false, ghostGain: 0.5 };
}

/**
 * Get all ghost states
 * @returns {Object} All ghost states
 */
export function getAllGhostStates() {
    return { ...ghostTrackStates };
}

/**
 * Set all ghost states (for project loading)
 * @param {Object} states - Ghost states
 */
export function setAllGhostStates(states) {
    ghostTrackStates = { ...states } || {};
}