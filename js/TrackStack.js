// js/TrackStack.js - Track Stack Feature
// Allows collapsing/expanding groups of tracks into a single stack

let localAppServices = {};
let trackStacks = {}; // { stackId: { id, name, trackIds: [], isCollapsed: bool, color } }
let stackIdCounter = 0;

/**
 * Initialize TrackStack with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initTrackStack(appServices) {
    localAppServices = appServices || {};
    console.log('[TrackStack] Initialized');
}

/**
 * Opens the Track Stack panel
 * @param {Object} savedState - Optional saved window state
 */
export function openTrackStackPanel(savedState = null) {
    const windowId = 'trackStack';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTrackStackContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackStackContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = {
        width: 400,
        height: 450,
        minWidth: 300,
        minHeight: 300,
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

    const win = localAppServices.createWindow(windowId, 'Track Stacks', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderTrackStackContent(), 50);
    }
    return win;
}

/**
 * Renders the Track Stack panel content
 */
function renderTrackStackContent() {
    const container = document.getElementById('trackStackContent');
    if (!container) return;

    const tracks = localAppServices.getTracks?.() || [];
    const stackList = Object.values(trackStacks);

    let html = `
        <div class="mb-4">
            <button id="createStackBtn" class="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600">
                + Create Stack
            </button>
        </div>
    `;

    if (stackList.length === 0) {
        html += `
            <div class="text-center text-gray-500 py-8">
                <p class="text-sm">No track stacks yet.</p>
                <p class="text-xs mt-1">Create a stack to group tracks for collapse/expand.</p>
            </div>
        `;
    } else {
        stackList.forEach(stack => {
            const stackTracks = tracks.filter(t => stack.trackIds.includes(t.id));
            html += `
                <div class="bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 p-3 mb-3" data-stack-id="${stack.id}">
                    <div class="flex items-center justify-between mb-2">
                        <input type="text" value="${stack.name}" 
                            class="stack-name-input px-2 py-1 text-sm font-medium bg-transparent border-none text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                            data-stack-id="${stack.id}">
                        <button class="delete-stack-btn text-red-500 hover:text-red-700 text-lg" data-stack-id="${stack.id}">✕</button>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                        <button class="toggle-stack-btn px-2 py-1 text-xs ${stack.isCollapsed ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'} rounded"
                            data-stack-id="${stack.id}">
                            ${stack.isCollapsed ? '▶ Expand' : '▼ Collapse'}
                        </button>
                        <span class="text-xs text-gray-500">${stackTracks.length} track${stackTracks.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-300">
                        ${stackTracks.length > 0 ? stackTracks.map(t => t.name).join(', ') : 'No tracks assigned'}
                    </div>
                </div>
            `;
        });
    }

    container.innerHTML = html;

    // Create stack button
    container.querySelector('#createStackBtn')?.addEventListener('click', () => {
        createTrackStack();
        renderTrackStackContent();
    });

    // Stack name inputs
    container.querySelectorAll('.stack-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const stackId = e.target.dataset.stackId;
            const newName = e.target.value.trim();
            if (newName && trackStacks[stackId]) {
                trackStacks[stackId].name = newName;
                if (localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo(`Rename Track Stack to "${newName}"`);
                }
            }
        });
    });

    // Delete stack buttons
    container.querySelectorAll('.delete-stack-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stackId = e.target.dataset.stackId;
            deleteTrackStack(stackId);
            renderTrackStackContent();
        });
    });

    // Toggle collapse/expand buttons
    container.querySelectorAll('.toggle-stack-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const stackId = e.target.dataset.stackId;
            toggleStackCollapse(stackId);
            renderTrackStackContent();
            updateTrackVisibility();
        });
    });
}

/**
 * Creates a new track stack
 * @param {string} name - Optional stack name
 * @returns {string} The new stack ID
 */
export function createTrackStack(name = null) {
    const id = `stack_${++stackIdCounter}`;
    const stackName = name || `Stack ${stackIdCounter}`;
    
    trackStacks[id] = {
        id,
        name: stackName,
        trackIds: [],
        isCollapsed: false,
        color: getRandomStackColor()
    };

    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(`Create Track Stack "${stackName}"`);
    }

    console.log(`[TrackStack] Created stack "${stackName}" (${id})`);
    return id;
}

/**
 * Deletes a track stack
 * @param {string} stackId - Stack ID to delete
 */
export function deleteTrackStack(stackId) {
    if (trackStacks[stackId]) {
        const stackName = trackStacks[stackId].name;
        delete trackStacks[stackId];
        
        if (localAppServices.captureStateForUndo) {
            localAppServices.captureStateForUndo(`Delete Track Stack "${stackName}"`);
        }
        
        console.log(`[TrackStack] Deleted stack "${stackName}"`);
    }
}

/**
 * Adds a track to a stack
 * @param {string} stackId - Stack ID
 * @param {number} trackId - Track ID to add
 */
export function addTrackToStack(stackId, trackId) {
    if (trackStacks[stackId] && !trackStacks[stackId].trackIds.includes(trackId)) {
        trackStacks[stackId].trackIds.push(trackId);
        
        if (localAppServices.captureStateForUndo) {
            localAppServices.captureStateForUndo(`Add track to Stack "${trackStacks[stackId].name}"`);
        }
        
        updateTrackVisibility();
    }
}

/**
 * Removes a track from a stack
 * @param {string} stackId - Stack ID
 * @param {number} trackId - Track ID to remove
 */
export function removeTrackFromStack(stackId, trackId) {
    if (trackStacks[stackId]) {
        trackStacks[stackId].trackIds = trackStacks[stackId].trackIds.filter(id => id !== trackId);
        
        if (localAppServices.captureStateForUndo) {
            localAppServices.captureStateForUndo(`Remove track from Stack "${trackStacks[stackId].name}"`);
        }
        
        updateTrackVisibility();
    }
}

/**
 * Toggles the collapsed state of a stack
 * @param {string} stackId - Stack ID
 */
export function toggleStackCollapse(stackId) {
    if (trackStacks[stackId]) {
        trackStacks[stackId].isCollapsed = !trackStacks[stackId].isCollapsed;
        
        if (localAppServices.captureStateForUndo) {
            const action = trackStacks[stackId].isCollapsed ? 'Collapse' : 'Expand';
            localAppServices.captureStateForUndo(`${action} Track Stack "${trackStacks[stackId].name}"`);
        }
        
        console.log(`[TrackStack] Stack "${trackStacks[stackId].name}" ${trackStacks[stackId].isCollapsed ? 'collapsed' : 'expanded'}`);
        updateTrackVisibility();
    }
}

/**
 * Updates track visibility based on collapsed stacks
 */
export function updateTrackVisibility() {
    const tracks = localAppServices.getTracks?.() || [];
    
    // First, show all tracks
    tracks.forEach(track => {
        const trackEl = document.querySelector(`.timeline-track-lane[data-track-id="${track.id}"]`);
        const headerEl = document.querySelector(`.track-header[data-track-id="${track.id}"]`);
        
        if (trackEl) {
            trackEl.style.display = '';
            trackEl.classList.remove('stack-collapsed');
        }
        if (headerEl) {
            headerEl.style.display = '';
            headerEl.classList.remove('stack-collapsed');
        }
    });

    // Then hide tracks that are in collapsed stacks (except the first one)
    Object.values(trackStacks).forEach(stack => {
        if (stack.isCollapsed && stack.trackIds.length > 1) {
            // Hide all but the first track in the stack
            const tracksToHide = stack.trackIds.slice(1);
            tracksToHide.forEach(trackId => {
                const trackEl = document.querySelector(`.timeline-track-lane[data-track-id="${trackId}"]`);
                const headerEl = document.querySelector(`.track-header[data-track-id="${trackId}"]`);
                
                if (trackEl) {
                    trackEl.style.display = 'none';
                    trackEl.classList.add('stack-collapsed');
                }
                if (headerEl) {
                    headerEl.style.display = 'none';
                    headerEl.classList.add('stack-collapsed');
                }
            });
        }
    });

    // Re-render timeline if available
    if (localAppServices.renderTimeline) {
        localAppServices.renderTimeline();
    }
}

/**
 * Gets all track stacks
 * @returns {Object} All track stacks
 */
export function getTrackStacks() {
    return JSON.parse(JSON.stringify(trackStacks));
}

/**
 * Sets track stacks state (for undo/redo)
 * @param {Object} stacks - Stacks object
 */
export function setTrackStacksState(stacks) {
    trackStacks = JSON.parse(JSON.stringify(stacks));
    updateTrackVisibility();
}

/**
 * Gets the stack ID for a track (if any)
 * @param {number} trackId - Track ID
 * @returns {string|null} Stack ID or null
 */
export function getTrackStackId(trackId) {
    for (const [stackId, stack] of Object.entries(trackStacks)) {
        if (stack.trackIds.includes(trackId)) {
            return stackId;
        }
    }
    return null;
}

/**
 * Gets the stack info for a track
 * @param {number} trackId - Track ID
 * @returns {Object|null} Stack info or null
 */
export function getTrackStack(trackId) {
    const stackId = getTrackStackId(trackId);
    return stackId ? JSON.parse(JSON.stringify(trackStacks[stackId])) : null;
}

// Random color palette for stacks
const STACK_COLORS = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#06b6d4', // cyan
];

function getRandomStackColor() {
    return STACK_COLORS[Math.floor(Math.random() * STACK_COLORS.length)];
}