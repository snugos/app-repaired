// js/TempoRamperUI.js - UI panel for managing tempo ramp points
import { getTempoRampsState, addTempoRampPoint, removeTempoRampPoint, updateTempoRampPoint, clearTempoRamps } from './state.js';
import { setupTempoRampScheduling, clearTempoRampScheduling } from './audio.js';

let tempoRamperUIScheduleId = null;

export function openTempoRamperPanel(savedState = null) {
    const windowId = 'tempoRamper';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateTempoRamperPanel();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tempoRamperContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { width: 500, height: 450, minWidth: 400, minHeight: 300, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    const win = localAppServices.createWindow(windowId, 'Tempo Ramper', contentContainer, options);
    if (win?.element) renderTempoRamperContent();
    return win;
}

export function updateTempoRamperPanel() {
    const container = document.getElementById('tempoRamperContent');
    if (container) renderTempoRamperContent();
}

function renderTempoRamperContent() {
    const container = document.getElementById('tempoRamperContent');
    if (!container) return;

    const ramps = getTempoRampsState();
    const curves = ['linear', 'exponential', 'stepped'];
    const currentBpm = localAppServices.getTempo ? localAppServices.getTempo() : 120;
    
    let html = `<div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
        <div class="flex items-center gap-3 mb-2">
            <label class="text-xs text-gray-600 dark:text-gray-400">Current BPM:</label>
            <span class="text-sm font-bold text-blue-600 dark:text-blue-400">${currentBpm.toFixed(1)}</span>
            <button id="addTempoRampBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 ml-auto">+ Add Ramp Point</button>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">Tip: Add points to automate tempo changes over time</div>
    </div>
    
    <div class="mb-3 flex justify-between items-center">
        <span class="text-sm text-gray-600 dark:text-gray-400">${ramps.length} ramp point${ramps.length !== 1 ? 's' : ''}</span>
        <div class="flex gap-2">
            <button id="clearAllRampsBtn" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 ${ramps.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${ramps.length === 0 ? 'disabled' : ''}>Clear All</button>
        </div>
    </div>`;
    
    if (ramps.length === 0) {
        html += `<div class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No tempo ramp points yet.<br>Click "+ Add Ramp Point" to create one.</div>`;
    } else {
        html += `<div class="space-y-2">`;
        ramps.forEach((ramp, idx) => {
            html += `<div class="bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 p-2">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-purple-600 dark:text-purple-400">#${idx + 1} (${ramp.curve})</span>
                    <button class="delete-ramp-btn text-xs text-red-500 hover:text-red-700" data-id="${ramp.id}">✕</button>
                </div>
                <div class="grid grid-cols-4 gap-2 items-center">
                    <div><label class="text-xs text-gray-500">Bar</label>
                        <input type="number" min="0" step="0.1" value="${ramp.barPosition}" class="ramp-bar-input w-full p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" data-id="${ramp.id}"></div>
                    <div><label class="text-xs text-gray-500">BPM</label>
                        <input type="number" min="20" max="300" step="0.1" value="${ramp.bpm}" class="ramp-bpm-input w-full p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" data-id="${ramp.id}"></div>
                    <div><label class="text-xs text-gray-500">Curve</label>
                        <select class="ramp-curve-input w-full p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" data-id="${ramp.id}">
                            ${curves.map(c => `<option value="${c}" ${c === ramp.curve ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
                        </select></div>
                    <div class="pt-4">
                        <button class="apply-ramp-btn w-full px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" data-id="${ramp.id}">Apply</button>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
    }
    
    container.innerHTML = html;

    // Add button handler
    container.querySelector('#addTempoRampBtn')?.addEventListener('click', () => {
        const currentBar = localAppServices.getCurrentPlaybackPosition ? localAppServices.getCurrentPlaybackPosition() : 0;
        const newBpm = currentBpm + 10;
        addTempoRampPoint(currentBar, newBpm, 'linear');
        if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Add tempo ramp point');
        refreshTempoRamper();
        showNotification(`Added tempo ramp at bar ${currentBar.toFixed(1)}: ${newBpm} BPM`, 1500);
    });

    // Clear all button handler
    container.querySelector('#clearAllRampsBtn')?.addEventListener('click', () => {
        if (ramps.length > 0) {
            clearTempoRamps();
            clearTempoRampScheduling();
            if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Clear all tempo ramps');
            refreshTempoRamper();
            showNotification('Cleared all tempo ramp points', 1500);
        }
    });

    // Delete button handlers
    container.querySelectorAll('.delete-ramp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            removeTempoRampPoint(id);
            const rampsState = getTempoRampsState();
            setupTempoRampScheduling(rampsState);
            if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Remove tempo ramp point');
            refreshTempoRamper();
            showNotification('Removed tempo ramp point', 1500);
        });
    });

    // Apply button handlers
    container.querySelectorAll('.apply-ramp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const barInput = container.querySelector(`.ramp-bar-input[data-id="${id}"]`);
            const bpmInput = container.querySelector(`.ramp-bpm-input[data-id="${id}"]`);
            const curveInput = container.querySelector(`.ramp-curve-input[data-id="${id}"]`);
            if (barInput && bpmInput && curveInput) {
                updateTempoRampPoint(id, parseFloat(barInput.value), parseFloat(bpmInput.value), curveInput.value);
                const rampsState = getTempoRampsState();
                setupTempoRampScheduling(rampsState);
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Update tempo ramp point');
                showNotification('Updated tempo ramp point', 1500);
            }
        });
    });

    // Bar input change handlers - update immediately on change
    container.querySelectorAll('.ramp-bar-input, .ramp-bpm-input, .ramp-curve-input').forEach(input => {
        input.addEventListener('change', () => {
            const id = input.dataset.id;
            const barInput = container.querySelector(`.ramp-bar-input[data-id="${id}"]`);
            const bpmInput = container.querySelector(`.ramp-bpm-input[data-id="${id}"]`);
            const curveInput = container.querySelector(`.ramp-curve-input[data-id="${id}"]`);
            if (barInput && bpmInput && curveInput) {
                updateTempoRampPoint(id, parseFloat(barInput.value), parseFloat(bpmInput.value), curveInput.value);
                const rampsState = getTempoRampsState();
                setupTempoRampScheduling(rampsState);
            }
        });
    });
}

function refreshTempoRamper() {
    renderTempoRamperContent();
    // Re-sync audio scheduling
    const rampsState = getTempoRampsState();
    setupTempoRampScheduling(rampsState);
}

export function openTempoRamperPanelShortcut() {
    return openTempoRamperPanel();
}

// Expose for external use
if (typeof window !== 'undefined') {
    window.openTempoRamperPanel = openTempoRamperPanel;
}