// js/ClipOpacity.js - Clip Opacity Control
// Adjust visual opacity of clips on timeline

let clipOpacities = {}; // { clipId: opacity (0-1) }
const DEFAULT_OPACITY = 1.0;

/**
 * Get clip opacity
 * @param {string} clipId
 * @returns {number} Opacity 0-1
 */
export function getClipOpacity(clipId) {
    return clipOpacities[clipId] ?? DEFAULT_OPACITY;
}

/**
 * Set clip opacity
 * @param {string} clipId
 * @param {number} opacity - 0 to 1
 */
export function setClipOpacity(clipId, opacity) {
    clipOpacities[clipId] = Math.max(0, Math.min(1, opacity));
    updateClipOpacityVisuals(clipId);
    saveClipOpacities();
}

/**
 * Reset clip to default opacity
 * @param {string} clipId
 */
export function resetClipOpacity(clipId) {
    delete clipOpacities[clipId];
    updateClipOpacityVisuals(clipId);
    saveClipOpacities();
}

/**
 * Reset all clips to default opacity
 */
export function resetAllClipOpacities() {
    clipOpacities = {};
    document.querySelectorAll('.clip-element').forEach(el => {
        el.style.opacity = DEFAULT_OPACITY;
    });
    saveClipOpacities();
}

/**
 * Update clip opacity visuals in DOM
 * @param {string} clipId
 */
function updateClipOpacityVisuals(clipId) {
    const opacity = getClipOpacity(clipId);
    document.querySelectorAll(`[data-clip-id="${clipId}"]`).forEach(el => {
        el.style.opacity = opacity;
    });
}

/**
 * Save opacities to localStorage
 */
function saveClipOpacities() {
    try {
        localStorage.setItem('snaw_clip_opacities', JSON.stringify(clipOpacities));
    } catch (e) {
        console.warn('[ClipOpacity] Could not save:', e);
    }
}

/**
 * Load opacities from localStorage
 */
export function loadClipOpacities() {
    try {
        const data = localStorage.getItem('snaw_clip_opacities');
        if (data) {
            clipOpacities = JSON.parse(data);
        }
    } catch (e) {
        console.warn('[ClipOpacity] Could not load:', e);
    }
}

// Initialize
loadClipOpacities();

/**
 * Apply opacity to a clip element
 * @param {HTMLElement} clipElement
 * @param {string} clipId
 */
export function applyClipOpacity(clipElement, clipId) {
    if (clipElement && clipId) {
        clipElement.style.opacity = getClipOpacity(clipId);
    }
}

// --- UI Panel ---

/**
 * Open clip opacity panel
 */
export function openClipOpacityPanel() {
    const windowId = 'clipOpacityPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'clipOpacityContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const win = localAppServices.createWindow(windowId, 'Clip Opacity', contentContainer, {
        width: 300,
        height: 350,
        minWidth: 250,
        minHeight: 280,
        closable: true,
        minimizable: true,
        resizable: true
    });

    if (win?.element) {
        renderClipOpacityContent();
    }
    return win;
}

/**
 * Render clip opacity panel content
 */
function renderClipOpacityContent() {
    const container = document.getElementById('clipOpacityContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const allClips = [];
    tracks.forEach(track => {
        (track.timelineClips || []).forEach(clip => {
            allClips.push({ ...clip, trackName: track.name });
        });
    });

    container.innerHTML = `
        <div class="mb-3">
            <label class="block text-sm text-gray-400 mb-2">Global Opacity</label>
            <div class="flex items-center gap-3">
                <input type="range" id="globalOpacity" min="0" max="100" value="100" 
                    class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                <span id="globalOpacityValue" class="text-sm text-white w-12 text-right">100%</span>
            </div>
        </div>
        <div class="mb-3 flex gap-2">
            <button id="applyGlobalBtn" class="flex-1 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                Apply to All
            </button>
            <button id="resetAllBtn" class="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-500">
                Reset All
            </button>
        </div>
        <div class="flex-1 overflow-y-auto" id="clipOpacityList">
            <div class="text-xs text-gray-500 mb-2">Individual Clips (click to edit)</div>
            <div id="clipListContainer" class="space-y-1">
                ${allClips.length === 0 ? '<div class="text-gray-500 text-sm">No clips available</div>' : ''}
            </div>
        </div>
    `;

    renderClipOpacityList(allClips);

    // Global opacity slider
    document.getElementById('globalOpacity')?.addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('globalOpacityValue').textContent = `${value}%`;
    });

    document.getElementById('applyGlobalBtn')?.addEventListener('click', () => {
        const value = parseInt(document.getElementById('globalOpacity').value, 10) / 100;
        allClips.forEach(clip => {
            setClipOpacity(clip.id, value);
        });
        renderClipOpacityList(allClips);
        localAppServices.showNotification?.('Global opacity applied', 1500);
    });

    document.getElementById('resetAllBtn')?.addEventListener('click', () => {
        resetAllClipOpacities();
        document.getElementById('globalOpacity').value = 100;
        document.getElementById('globalOpacityValue').textContent = '100%';
        renderClipOpacityList(allClips);
        localAppServices.showNotification?.('All opacities reset', 1500);
    });
}

function renderClipOpacityList(clips) {
    const container = document.getElementById('clipListContainer');
    if (!container) return;

    if (clips.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-sm">No clips available</div>';
        return;
    }

    container.innerHTML = clips.slice(0, 30).map(clip => {
        const opacity = getClipOpacity(clip.id);
        return `
            <div class="flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-750">
                <div class="flex-1 min-w-0">
                    <div class="text-sm text-white truncate">${escapeHtml(clip.name || 'Unnamed')}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(clip.trackName)}</div>
                </div>
                <div class="flex items-center gap-2">
                    <input type="range" min="0" max="100" value="${Math.round(opacity * 100)}" 
                        class="w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer clip-opacity-slider"
                        data-clip-id="${clip.id}">
                    <span class="text-xs text-gray-400 w-10 text-right clip-opacity-value">${Math.round(opacity * 100)}%</span>
                </div>
            </div>
        `;
    }).join('');

    if (clips.length > 30) {
        container.innerHTML += `<div class="text-gray-500 text-xs mt-2">...and ${clips.length - 30} more</div>`;
    }

    // Add slider listeners
    container.querySelectorAll('.clip-opacity-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const clipId = e.target.dataset.clipId;
            const value = parseInt(e.target.value, 10) / 100;
            setClipOpacity(clipId, value);
            e.target.nextElementSibling.textContent = `${Math.round(value * 100)}%`;
        });
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
