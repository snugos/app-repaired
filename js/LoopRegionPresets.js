// js/LoopRegionPresets.js - Loop Region Presets Panel
// Save and load named loop region presets for quick recall

let localAppServices = {};
let isPanelOpen = false;
let presetsPanelElement = null;

/**
 * Initialize the Loop Region Presets panel module
 * @param {Object} services - App services from main.js
 */
export function initLoopRegionPresets(services) {
    localAppServices = services || {};
    console.log('[LoopRegionPresets] Module initialized');
}

/**
 * Get loop region state functions
 */
function getLoopState() {
    const state = localAppServices.stateModule || {};
    return {
        getLoopRegion: state.getLoopRegion || (() => ({ enabled: false, start: 0, end: 16 })),
        setLoopRegion: state.setLoopRegion || (() => {}),
        getLoopRegionEnabled: state.getLoopRegionEnabled || (() => false),
        setLoopRegionEnabled: state.setLoopRegionEnabled || (() => {}),
        getLoopRegionStart: state.getLoopRegionStart || (() => 0),
        setLoopRegionStart: state.setLoopRegionStart || (() => {}),
        getLoopRegionEnd: state.getLoopRegionEnd || (() => 16),
        setLoopRegionEnd: state.setLoopRegionEnd || (() => {}),
        saveLoopRegionPreset: state.saveLoopRegionPreset || ((n) => false),
        loadLoopRegionPreset: state.loadLoopRegionPreset || ((n) => false),
        deleteLoopRegionPreset: state.deleteLoopRegionPreset || ((n) => false),
        getLoopRegionPresetNames: state.getLoopRegionPresetNames || (() => []),
        getLoopRegionPreset: state.getLoopRegionPreset || ((n) => null)
    };
}

/**
 * Open the Loop Region Presets panel
 */
export function openLoopRegionPresetsPanel() {
    if (isPanelOpen) {
        const existing = document.getElementById('loopRegionPresetsContent');
        if (existing) {
            renderPanelContent();
            return;
        }
    }

    const windowId = 'loopRegionPresets';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderPanelContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'loopRegionPresetsContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    const options = {
        width: 360,
        height: 480,
        minWidth: 300,
        minHeight: 400,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Loop Region Presets', contentContainer, options);
    if (win?.element) {
        isPanelOpen = true;
        renderPanelContent();
    }
    return win;
}

/**
 * Render the presets panel content
 */
function renderPanelContent() {
    const container = document.getElementById('loopRegionPresetsContent');
    if (!container) return;

    const loopState = getLoopState();
    const currentRegion = loopState.getLoopRegion();
    const presetNames = loopState.getLoopRegionPresetNames();

    container.innerHTML = `
        <div class="mb-4 p-3 bg-slate-700 rounded text-white">
            <div class="text-xs text-slate-400 mb-1">Current Loop Region</div>
            <div class="flex items-center gap-3">
                <label class="flex items-center gap-1 cursor-pointer text-xs">
                    <input type="checkbox" id="lrpEnabled" ${currentRegion.enabled ? 'checked' : ''} class="w-3 h-3 accent-green-500">
                    <span>Enabled</span>
                </label>
                <div class="flex items-center gap-1 text-xs">
                    <span class="text-slate-400">Start:</span>
                    <input type="number" id="lrpStart" value="${currentRegion.start}" min="0" step="0.1" class="w-16 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded text-white text-xs text-center">
                    <span class="text-slate-400">End:</span>
                    <input type="number" id="lrpEnd" value="${currentRegion.end}" min="0.1" step="0.1" class="w-16 px-1 py-0.5 bg-slate-800 border border-slate-600 rounded text-white text-xs text-center">
                </div>
            </div>
        </div>

        <div class="mb-3 flex items-center gap-2">
            <input type="text" id="lrpPresetName" placeholder="Preset name..." class="flex-1 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-400 dark:border-slate-600 rounded text-sm text-gray-800 dark:text-white">
            <button id="lrpSaveBtn" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded">Save</button>
        </div>

        <div id="lrpPresetsList" class="space-y-1">
            ${presetNames.length === 0 ? '<div class="text-xs text-slate-500 text-center py-4">No presets saved</div>' : ''}
        </div>
    `;

    // Render preset items
    const listEl = document.getElementById('lrpPresetsList');
    presetNames.forEach(name => {
        const preset = loopState.getLoopRegionPreset(name);
        if (!preset) return;
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded hover:border-blue-400 cursor-pointer text-xs';
        item.dataset.presetName = name;
        item.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-800 dark:text-white truncate">${name}</div>
                <div class="text-slate-500">Start: ${preset.start}s &nbsp; End: ${preset.end}s</div>
            </div>
            <button class="lrpLoadBtn ml-2 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded">Load</button>
            <button class="lrpDeleteBtn ml-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded">Del</button>
        `;
        listEl.appendChild(item);
    });

    setupPanelEvents(container, loopState);
}

/**
 * Set up event listeners for the panel
 */
function setupPanelEvents(container, loopState) {
    const enabledCb = container.querySelector('#lrpEnabled');
    const startInput = container.querySelector('#lrpStart');
    const endInput = container.querySelector('#lrpEnd');
    const nameInput = container.querySelector('#lrpPresetName');
    const saveBtn = container.querySelector('#lrpSaveBtn');

    enabledCb?.addEventListener('change', () => {
        loopState.setLoopRegionEnabled(enabledCb.checked);
    });

    startInput?.addEventListener('change', () => {
        loopState.setLoopRegionStart(parseFloat(startInput.value) || 0);
    });

    endInput?.addEventListener('change', () => {
        loopState.setLoopRegionEnd(parseFloat(endInput.value) || 16);
    });

    saveBtn?.addEventListener('click', () => {
        const name = nameInput?.value?.trim();
        if (!name) {
            localAppServices.showNotification?.('Please enter a preset name', 2000);
            return;
        }
        // First update state with current UI values
        loopState.setLoopRegionStart(parseFloat(startInput?.value) || 0);
        loopState.setLoopRegionEnd(parseFloat(endInput?.value) || 16);
        loopState.setLoopRegionEnabled(enabledCb?.checked || false);

        const success = loopState.saveLoopRegionPreset(name);
        if (success) {
            localAppServices.showNotification?.(`Preset "${name}" saved`, 2000);
            renderPanelContent();
        } else {
            localAppServices.showNotification?.('Failed to save preset', 2000);
        }
    });

    // Load buttons
    container.querySelectorAll('.lrpLoadBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('[data-preset-name]');
            const name = item?.dataset.presetName;
            if (!name) return;
            const success = loopState.loadLoopRegionPreset(name);
            if (success) {
                localAppServices.showNotification?.(`Preset "${name}" loaded`, 2000);
                renderPanelContent();
                // Update transport UI if needed
                updateTransportLoopUI?.();
            } else {
                localAppServices.showNotification?.('Failed to load preset', 2000);
            }
        });
    });

    // Delete buttons
    container.querySelectorAll('.lrpDeleteBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('[data-preset-name]');
            const name = item?.dataset.presetName;
            if (!name) return;
            if (confirm(`Delete preset "${name}"?`)) {
                const success = loopState.deleteLoopRegionPreset(name);
                if (success) {
                    localAppServices.showNotification?.(`Preset "${name}" deleted`, 2000);
                    renderPanelContent();
                }
            }
        });
    });

    // Click on preset item to load
    container.querySelectorAll('[data-preset-name]').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            const name = item.dataset.presetName;
            const success = loopState.loadLoopRegionPreset(name);
            if (success) {
                localAppServices.showNotification?.(`Preset "${name}" loaded`, 2000);
                renderPanelContent();
            }
        });
    });
}

/**
 * Update transport loop region UI elements
 */
function updateTransportLoopUI() {
    const loopToggleBtn = document.getElementById('loopToggleBtnGlobal');
    const loopStartInput = document.getElementById('loopStartInput');
    const loopEndInput = document.getElementById('loopEndInput');
    const loopState = getLoopRegion();
    const enabled = loopState.enabled;

    if (loopToggleBtn) {
        loopToggleBtn.textContent = `Loop: ${enabled ? 'On' : 'Off'}`;
        loopToggleBtn.classList.toggle('playing', enabled);
    }
    if (loopStartInput) loopStartInput.value = loopState.start;
    if (loopEndInput) loopEndInput.value = loopState.end;
}

function getLoopRegion() {
    const state = localAppServices.stateModule || {};
    return state.getLoopRegion ? state.getLoopRegion() : { enabled: false, start: 0, end: 16 };
}

// Window exposure
window.openLoopRegionPresetsPanel = openLoopRegionPresetsPanel;
window.getLoopRegionPresets = () => {
    const state = localAppServices.stateModule || {};
    return state.getLoopRegionPresetNames ? state.getLoopRegionPresetNames() : [];
};