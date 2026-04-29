// js/ClipGhostTrails.js - Clip Ghost Trails Feature for SnugOS DAW
// Shows faint ghost copies of clips at other positions for comparison/remixing

let localAppServices = {};
let ghostTrailManager = null;

/**
 * ClipGhostTrailManager - Manages ghost trail positions for clips
 */
class ClipGhostTrailManager {
    constructor() {
        // Map of clipId -> Array of ghost positions { x, width, opacity, color }
        this.ghostTrails = new Map();
        // Map of trackId -> Set of clipIds that have ghosts
        this.trackGhosts = new Map();
        // Ghost appearance settings
        this.settings = {
            defaultOpacity: 0.25,
            defaultColor: '#ffffff',
            maxGhostsPerClip: 5,
            ghostBorderStyle: 'dashed',
            ghostBorderColor: '#ffffff'
        };
    }

    /**
     * Initialize the ghost trail manager with app services
     * @param {Object} services - Application services
     */
    init(services) {
        localAppServices = services || {};
        console.log('[ClipGhostTrails] Initialized');
    }

    /**
     * Add a ghost position for a clip
     * @param {string} clipId - The clip ID
     * @param {number} trackId - The track ID
     * @param {number} position - X position on timeline (in pixels)
     * @param {number} width - Width of the ghost (in pixels)
     * @param {object} options - Optional settings (opacity, color)
     * @returns {boolean} Success
     */
    addGhost(clipId, trackId, position, width, options = {}) {
        if (!clipId || trackId === undefined) return false;

        // Initialize arrays if needed
        if (!this.ghostTrails.has(clipId)) {
            this.ghostTrails.set(clipId, []);
        }

        const ghosts = this.ghostTrails.get(clipId);

        // Check max ghosts limit
        if (ghosts.length >= this.settings.maxGhostsPerClip) {
            // Remove oldest ghost
            ghosts.shift();
        }

        // Add new ghost
        ghosts.push({
            trackId: parseInt(trackId, 10),
            position: position,
            width: width,
            opacity: options.opacity || this.settings.defaultOpacity,
            color: options.color || this.settings.defaultColor,
            timestamp: Date.now()
        });

        // Update track ghosts index
        if (!this.trackGhosts.has(trackId)) {
            this.trackGhosts.set(trackId, new Set());
        }
        this.trackGhosts.get(trackId).add(clipId);

        console.log(`[ClipGhostTrails] Added ghost for clip ${clipId} at position ${position}`);
        return true;
    }

    /**
     * Remove all ghosts for a clip
     * @param {string} clipId - The clip ID
     */
    removeGhosts(clipId) {
        if (!this.ghostTrails.has(clipId)) return;

        const ghosts = this.ghostTrails.get(clipId);
        ghosts.forEach(ghost => {
            const trackGhostSet = this.trackGhosts.get(ghost.trackId);
            if (trackGhostSet) {
                trackGhostSet.delete(clipId);
            }
        });

        this.ghostTrails.delete(clipId);
        console.log(`[ClipGhostTrails] Removed ghosts for clip ${clipId}`);
    }

    /**
     * Get ghosts for a specific clip
     * @param {string} clipId - The clip ID
     * @returns {Array} Array of ghost positions
     */
    getGhosts(clipId) {
        return this.ghostTrails.get(clipId) || [];
    }

    /**
     * Get all ghosts for a track
     * @param {number} trackId - The track ID
     * @returns {Array} Array of { clipId, ghosts }
     */
    getTrackGhosts(trackId) {
        const result = [];
        const clipIds = this.trackGhosts.get(trackId);
        if (!clipIds) return result;

        clipIds.forEach(clipId => {
            const ghosts = this.ghostTrails.get(clipId);
            if (ghosts && ghosts.length > 0) {
                result.push({ clipId, ghosts });
            }
        });

        return result;
    }

    /**
     * Save ghost positions for a clip (for project save/load)
     * @param {string} clipId - The clip ID
     * @returns {Array} Serializable ghost data
     */
    serializeClipGhosts(clipId) {
        const ghosts = this.ghostTrails.get(clipId);
        if (!ghosts) return [];

        return ghosts.map(g => ({
            trackId: g.trackId,
            position: g.position,
            width: g.width,
            opacity: g.opacity,
            color: g.color
        }));
    }

    /**
     * Load ghost positions for a clip
     * @param {string} clipId - The clip ID
     * @param {Array} data - Ghost data from serialization
     */
    loadClipGhosts(clipId, data) {
        if (!Array.isArray(data)) return;

        this.ghostTrails.set(clipId, data.map(g => ({
            trackId: g.trackId,
            position: g.position,
            width: g.width,
            opacity: g.opacity || this.settings.defaultOpacity,
            color: g.color || this.settings.defaultColor,
            timestamp: Date.now()
        })));

        // Rebuild track index
        data.forEach(g => {
            if (!this.trackGhosts.has(g.trackId)) {
                this.trackGhosts.set(g.trackId, new Set());
            }
            this.trackGhosts.get(g.trackId).add(clipId);
        });
    }

    /**
     * Clear all ghosts
     */
    clearAll() {
        this.ghostTrails.clear();
        this.trackGhosts.clear();
        console.log('[ClipGhostTrails] Cleared all ghosts');
    }

    /**
     * Update ghost settings
     * @param {object} newSettings - Settings to update
     */
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
    }

    /**
     * Create a ghost canvas overlay for a track lane
     * @param {HTMLElement} trackLane - The track lane element
     * @param {number} trackId - The track ID
     * @returns {HTMLCanvasElement} Canvas element with ghost trails
     */
    createGhostCanvas(trackLane, trackId) {
        if (!trackLane) return null;

        // Remove existing canvas
        const existing = trackLane.querySelector('.ghost-trails-canvas');
        if (existing) existing.remove();

        const canvas = document.createElement('canvas');
        canvas.className = 'ghost-trails-canvas';
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 2;
        `;

        trackLane.appendChild(canvas);
        return canvas;
    }

    /**
     * Render ghost trails for a track
     * @param {HTMLCanvasElement} canvas - The canvas element
     * @param {number} trackId - The track ID
     * @param {number} scrollX - Horizontal scroll offset
     */
    renderTrackGhosts(canvas, trackId, scrollX = 0) {
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, rect.width, rect.height);

        const trackGhosts = this.getTrackGhosts(trackId);

        trackGhosts.forEach(({ clipId, ghosts }) => {
            ghosts.forEach(ghost => {
                const x = ghost.position - scrollX;
                const width = ghost.width;

                // Skip if off-screen
                if (x + width < 0 || x > rect.width) return;

                ctx.save();

                // Draw ghost background
                ctx.fillStyle = ghost.color;
                ctx.globalAlpha = ghost.opacity;
                ctx.fillRect(x, 2, width, rect.height - 4);

                // Draw dashed border
                ctx.globalAlpha = ghost.opacity + 0.1;
                ctx.strokeStyle = this.settings.ghostBorderColor;
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(x, 2, width, rect.height - 4);

                // Draw label
                ctx.globalAlpha = ghost.opacity;
                ctx.fillStyle = '#ffffff';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText('ghost', x + 4, 14);

                ctx.restore();
            });
        });
    }

    /**
     * Render all ghost trails for visible tracks
     */
    renderAllGhosts() {
        document.querySelectorAll('.ghost-trails-canvas').forEach(canvas => {
            const trackLane = canvas.parentElement;
            if (!trackLane) return;

            const trackId = parseInt(trackLane.dataset.trackId, 10);
            if (isNaN(trackId)) return;

            // Get scroll position
            const scrollContainer = document.querySelector('.timeline-scroll-container, #desktop');
            const scrollX = scrollContainer ? scrollContainer.scrollLeft : 0;

            this.renderTrackGhosts(canvas, trackId, scrollX);
        });
    }
}

/**
 * Open the Clip Ghost Trails settings panel
 */
function openClipGhostTrailsPanel() {
    const windowId = 'clipGhostTrails';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderGhostTrailsContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'ghostTrailsContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-50 dark:bg-slate-800';

    const options = {
        width: 380,
        height: 420,
        minWidth: 320,
        minHeight: 360,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Clip Ghost Trails', contentContainer, options);
    if (win?.element) {
        renderGhostTrailsContent();
    }
    return win;
}

/**
 * Render the Ghost Trails panel content
 */
function renderGhostTrailsContent() {
    const container = document.getElementById('ghostTrailsContent');
    if (!container) return;

    const settings = ghostTrailManager?.settings || {};

    container.innerHTML = `
        <div class="mb-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
            <p class="text-sm text-purple-700 dark:text-purple-300">
                <strong>Clip Ghost Trails:</strong> Save ghost positions of clips to compare arrangements or remixes.
            </p>
        </div>

        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default Opacity</label>
            <div class="flex items-center gap-3">
                <input type="range" id="ghostOpacity" min="10" max="60" value="${Math.round(settings.defaultOpacity * 100)}" class="flex-1">
                <span id="ghostOpacityVal" class="text-sm text-gray-500 w-12">${Math.round(settings.defaultOpacity * 100)}%</span>
            </div>
        </div>

        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ghost Color</label>
            <div class="flex items-center gap-2">
                <input type="color" id="ghostColor" value="${settings.defaultColor || '#ffffff'}" class="w-10 h-8 rounded cursor-pointer">
                <input type="text" id="ghostColorText" value="${settings.defaultColor || '#ffffff'}" class="flex-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded px-2 py-1 text-sm text-gray-700 dark:text-gray-200">
            </div>
        </div>

        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Ghosts Per Clip</label>
            <input type="number" id="maxGhosts" min="1" max="10" value="${settings.maxGhostsPerClip || 5}" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
        </div>

        <div class="mb-4 p-3 bg-gray-100 dark:bg-slate-700/50 rounded-lg">
            <div class="text-xs text-gray-500 dark:text-gray-400">
                <strong>Usage:</strong>
                <ul class="list-disc list-inside mt-1 space-y-1">
                    <li>Select a clip and click "Save Ghost Position" to remember its position</li>
                    <li>Ghost positions are shown as dashed outlines</li>
                    <li>Drag from a ghost to restore the clip to that position</li>
                    <li>Clear ghosts using the button below</li>
                </ul>
            </div>
        </div>

        <div id="ghostTrailsList" class="mb-4 max-h-32 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded">
            <div class="p-2 text-sm text-gray-500 dark:text-gray-400 text-center">No ghost trails saved</div>
        </div>

        <div class="flex gap-2">
            <button id="ghostRefreshBtn" class="flex-1 px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">
                Refresh Display
            </button>
            <button id="ghostClearAllBtn" class="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                Clear All Ghosts
            </button>
        </div>

        <div class="mt-4 p-2 bg-gray-800 dark:bg-slate-900 rounded text-xs text-gray-400">
            Ghost trails persist with the project and help you compare different arrangements.
        </div>
    `;

    // Event listeners
    const opacitySlider = container.querySelector('#ghostOpacity');
    const opacityVal = container.querySelector('#ghostOpacityVal');
    const colorInput = container.querySelector('#ghostColor');
    const colorText = container.querySelector('#ghostColorText');
    const maxGhostsInput = container.querySelector('#maxGhosts');
    const refreshBtn = container.querySelector('#ghostRefreshBtn');
    const clearAllBtn = container.querySelector('#ghostClearAllBtn');
    const listContainer = container.querySelector('#ghostTrailsList');

    opacitySlider?.addEventListener('input', (e) => {
        const val = Math.round(parseInt(e.target.value, 10));
        opacityVal.textContent = val + '%';
        if (ghostTrailManager) {
            ghostTrailManager.updateSettings({ defaultOpacity: val / 100 });
        }
    });

    colorInput?.addEventListener('input', (e) => {
        colorText.value = e.target.value;
        if (ghostTrailManager) {
            ghostTrailManager.updateSettings({ defaultColor: e.target.value });
        }
    });

    colorText?.addEventListener('change', (e) => {
        if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
            colorInput.value = e.target.value;
            if (ghostTrailManager) {
                ghostTrailManager.updateSettings({ defaultColor: e.target.value });
            }
        }
    });

    maxGhostsInput?.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (ghostTrailManager && val >= 1 && val <= 10) {
            ghostTrailManager.updateSettings({ maxGhostsPerClip: val });
        }
    });

    refreshBtn?.addEventListener('click', () => {
        if (ghostTrailManager) {
            ghostTrailManager.renderAllGhosts();
        }
        localAppServices.showNotification?.('Ghost trails refreshed', 1000);
    });

    clearAllBtn?.addEventListener('click', () => {
        if (ghostTrailManager && confirm('Clear all ghost trails?')) {
            ghostTrailManager.clearAll();
            renderGhostTrailsList(listContainer);
            ghostTrailManager.renderAllGhosts();
            localAppServices.showNotification?.('All ghost trails cleared', 1500);
        }
    });

    // Initial render of list
    renderGhostTrailsList(listContainer);
}

/**
 * Render the list of saved ghost trails
 * @param {HTMLElement} container - Container element for the list
 */
function renderGhostTrailsList(container) {
    if (!container || !ghostTrailManager) return;

    const allGhosts = [];
    ghostTrailManager.ghostTrails.forEach((ghosts, clipId) => {
        ghosts.forEach(ghost => {
            allGhosts.push({ clipId, ...ghost });
        });
    });

    if (allGhosts.length === 0) {
        container.innerHTML = '<div class="p-2 text-sm text-gray-500 dark:text-gray-400 text-center">No ghost trails saved</div>';
        return;
    }

    container.innerHTML = allGhosts.map((g, i) => `
        <div class="flex items-center justify-between p-2 border-b border-gray-100 dark:border-slate-700 last:border-b-0">
            <div class="flex-1">
                <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Clip ${g.clipId.slice(-6)}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">Position: ${Math.round(g.position)}px</div>
            </div>
            <button class="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-slate-500" data-action="remove" data-clip-id="${g.clipId}">Remove</button>
        </div>
    `).join('');

    // Add remove listeners
    container.querySelectorAll('[data-action="remove"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const clipId = btn.dataset.clipId;
            if (ghostTrailManager) {
                ghostTrailManager.removeGhosts(clipId);
                renderGhostTrailsList(container);
                ghostTrailManager.renderAllGhosts();
            }
        });
    });
}

/**
 * Save a ghost position for a clip at its current position
 * @param {string} clipId - The clip ID
 * @param {number} trackId - The track ID
 */
function saveClipGhostPosition(clipId, trackId) {
    if (!ghostTrailManager || !clipId) return;

    const clipEl = document.querySelector(`[data-clip-id="${clipId}"]`);
    if (!clipEl) {
        console.warn('[ClipGhostTrails] Clip element not found for', clipId);
        return;
    }

    const rect = clipEl.getBoundingClientRect();
    const parentRect = clipEl.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    const position = rect.left - parentRect.left;
    const width = rect.width;

    ghostTrailManager.addGhost(clipId, trackId, position, width);

    // Re-render ghosts
    ghostTrailManager.renderAllGhosts();

    localAppServices.showNotification?.('Ghost position saved', 1000);
}

/**
 * Initialize the Clip Ghost Trails feature
 * @param {Object} services - Application services from main.js
 */
export function initClipGhostTrails(services) {
    localAppServices = services || {};

    if (!ghostTrailManager) {
        ghostTrailManager = new ClipGhostTrailManager();
    }

    ghostTrailManager.init(services);

    console.log('[ClipGhostTrails] Feature initialized');

    // Setup event listeners for clip selection
    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', (e) => {
            // Alt+G to save ghost position of selected clip
            if (e.altKey && e.key === 'g') {
                const selectedClip = document.querySelector('.clip-element.selected, [data-clip-id].selected');
                if (selectedClip) {
                    const clipId = selectedClip.dataset.clipId;
                    const trackLane = selectedClip.closest('.timeline-track-lane');
                    const trackId = trackLane ? parseInt(trackLane.dataset.trackId, 10) : null;
                    if (clipId && trackId) {
                        saveClipGhostPosition(clipId, trackId);
                    }
                }
            }
        });
    }
}

/**
 * Get the ghost trail manager instance
 * @returns {ClipGhostTrailManager}
 */
export function getGhostTrailManager() {
    return ghostTrailManager;
}

// Window exposure
window.ClipGhostTrails = {
    init: initClipGhostTrails,
    openPanel: openClipGhostTrailsPanel,
    getManager: getGhostTrailManager,
    saveGhostPosition: saveClipGhostPosition
};

export { openClipGhostTrailsPanel, getGhostTrailManager, saveClipGhostPosition };