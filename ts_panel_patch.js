// --- Time Signature Changes Panel ---

export function openTimeSignaturePanel(savedState = null) {
    const windowId = 'timeSignature';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateTimeSignaturePanel();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'timeSignatureContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { width: 450, height: 400, minWidth: 350, minHeight: 250, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    const win = localAppServices.createWindow(windowId, 'Time Signature', contentContainer, options);
    if (win?.element) renderTimeSignatureContent();
    return win;
}

function renderTimeSignatureContent() {
    const container = document.getElementById('timeSignatureContent');
    if (!container) return;

    const tsChanges = localAppServices.getTimeSignatureChanges ? localAppServices.getTimeSignatureChanges() : [];
    const currentTs = localAppServices.getCurrentTimeSignature ? localAppServices.getCurrentTimeSignature() : { numerator: 4, denominator: 4 };
    
    let html = `<div class="mb-3 p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
        <div class="flex items-center gap-3 mb-2">
            <label class="text-xs text-gray-600 dark:text-gray-400">Current:</label>
            <select id="currentTsNumerator" class="p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600">
                ${[1,2,3,4,5,6,7,8,9,12,16].map(n => `<option value="${n}" ${n === currentTs.numerator ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <span class="text-gray-500">/</span>
            <select id="currentTsDenominator" class="p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600">
                ${[1,2,4,8,16,32].map(n => `<option value="${n}" ${n === currentTs.denominator ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
            <button id="applyCurrentTsBtn" class="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Apply</button>
        </div>
    </div>
    
    <div class="mb-3 flex justify-between items-center">
        <span class="text-sm text-gray-600 dark:text-gray-400">${tsChanges.length} change${tsChanges.length !== 1 ? 's' : ''}</span>
        <div class="flex gap-2">
            <button id="addTsPointBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">+ Add</button>
            <button id="clearAllTsPointsBtn" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 ${tsChanges.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${tsChanges.length === 0 ? 'disabled' : ''}>Clear</button>
        </div>
    </div>`;
    
    if (tsChanges.length === 0) {
        html += `<div class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No time signature changes yet.</div>`;
    } else {
        html += `<div class="space-y-2">`;
        tsChanges.forEach((ts, idx) => {
            html += `<div class="bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 p-2">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-purple-600 dark:text-purple-400">#${idx + 1}</span>
                    <button class="delete-ts-point-btn text-xs text-red-500 hover:text-red-700" data-id="${ts.id}">✕</button>
                </div>
                <div class="grid grid-cols-3 gap-2 items-center">
                    <div><label class="text-xs text-gray-500">Bar</label>
                        <input type="number" min="1" value="${ts.barPosition}" class="ts-bar-input w-full p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" data-id="${ts.id}"></div>
                    <div><label class="text-xs text-gray-500">Beats</label>
                        <select class="ts-numerator-input w-full p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" data-id="${ts.id}">
                            ${[1,2,3,4,5,6,7,8,9,12,16].map(n => `<option value="${n}" ${n === ts.numerator ? 'selected' : ''}>${n}</option>`).join('')}
                        </select></div>
                    <div><label class="text-xs text-gray-500">Note</label>
                        <select class="ts-denominator-input w-full p-1 text-sm border rounded dark:bg-slate-800 dark:border-slate-600" data-id="${ts.id}">
                            ${[1,2,4,8,16,32].map(n => `<option value="${n}" ${n === ts.denominator ? 'selected' : ''}>${n}</option>`).join('')}
                        </select></div>
                </div>
            </div>`;
        });
        html += `</div>`;
    }
    
    container.innerHTML = html;

    container.querySelector('#applyCurrentTsBtn')?.addEventListener('click', () => {
        const num = parseInt(container.querySelector('#currentTsNumerator')?.value || 4, 10);
        const den = parseInt(container.querySelector('#currentTsDenominator')?.value || 4, 10);
        if (localAppServices.setCurrentTimeSignature) {
            localAppServices.setCurrentTimeSignature(num, den);
            if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo(`Set time signature to ${num}/${den}`);
            showNotification(`Time signature set to ${num}/${den}`, 1500);
            renderTimeSignatureContent();
        }
    });

    container.querySelector('#addTsPointBtn')?.addEventListener('click', () => {
        if (localAppServices.addTimeSignatureChange) {
            const tsList = localAppServices.getTimeSignatureChanges ? localAppServices.getTimeSignatureChanges() : [];
            const lastBar = tsList.length > 0 ? Math.max(...tsList.map(t => t.barPosition)) : 0;
            if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Add time signature change');
            localAppServices.addTimeSignatureChange(lastBar + 4, 4, 4);
            renderTimeSignatureContent();
        }
    });

    container.querySelector('#clearAllTsPointsBtn')?.addEventListener('click', () => {
        if (localAppServices.clearTimeSignatureChanges) {
            if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Clear all time signature changes');
            localAppServices.clearTimeSignatureChanges();
            renderTimeSignatureContent();
        }
    });

    container.querySelectorAll('.ts-bar-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const newBar = parseFloat(e.target.value) || 1;
            if (localAppServices.updateTimeSignatureChange && localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Move time signature to bar ${newBar}`);
                localAppServices.updateTimeSignatureChange(id, newBar, undefined, undefined);
                renderTimeSignatureContent();
            }
        });
    });

    container.querySelectorAll('.ts-numerator-input').forEach(select => {
        select.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const num = parseInt(e.target.value || 4, 10);
            if (localAppServices.updateTimeSignatureChange && localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Change time signature to ${num}/4`);
                localAppServices.updateTimeSignatureChange(id, undefined, num, undefined);
                renderTimeSignatureContent();
            }
        });
    });

    container.querySelectorAll('.ts-denominator-input').forEach(select => {
        select.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const den = parseInt(e.target.value || 4, 10);
            if (localAppServices.updateTimeSignatureChange && localAppServices.captureStateForUndo) {
                localAppServices.captureStateForUndo(`Change denominator to ${den}`);
                localAppServices.updateTimeSignatureChange(id, undefined, undefined, den);
                renderTimeSignatureContent();
            }
        });
    });

    container.querySelectorAll('.delete-ts-point-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (localAppServices.removeTimeSignatureChange) {
                if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Remove time signature change');
                localAppServices.removeTimeSignatureChange(id);
                renderTimeSignatureContent();
                showNotification('Time signature change removed', 1500);
            }
        });
    });
}

export function updateTimeSignaturePanel() {
    const container = document.getElementById('timeSignatureContent');
    if (container) renderTimeSignatureContent();
}