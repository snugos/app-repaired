// js/MarkerNavigation.js - Marker Navigation with Number Keys
// Jump to timeline markers using number keys (1-9, 0)

let localAppServices = {};
let markerKeyBindings = {}; // { keyIndex: markerId }

export function initMarkerNavigation(appServices) {
    localAppServices = appServices || {};
    console.log('[MarkerNavigation] Initialized');
}

export function bindMarkerToKey(markerId, keyIndex) {
    markerKeyBindings[keyIndex] = markerId;
}

export function unbindMarkerKey(keyIndex) {
    if (markerKeyBindings[keyIndex] !== undefined) {
        delete markerKeyBindings[keyIndex];
    }
}

export function getMarkerKeyBindings() {
    return { ...markerKeyBindings };
}

export function jumpToMarkerByKey(keyIndex) {
    const markerId = markerKeyBindings[keyIndex];
    if (markerId) {
        const markers = localAppServices.getTimelineMarkers ? localAppServices.getTimelineMarkers() : [];
        const marker = markers.find(m => m.id === markerId);
        if (marker && localAppServices.jumpToTime) {
            localAppServices.jumpToTime(marker.time);
            localAppServices.showNotification?.(`Jumped to: ${marker.name}`, 1000);
            return true;
        }
    }
    return false;
}

export function openMarkerNavigationPanel() {
    const windowId = 'markerNavigation';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        updatePanelContent();
        return openWindows.get(windowId);
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'markerNavContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 select-none';
    
    contentContainer.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-white mb-1">Marker Navigation</h3>
            <p class="text-sm text-gray-400">Press number keys to jump to markers</p>
        </div>
        
        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <h4 class="text-sm font-medium text-gray-300 mb-2">Current Bindings</h4>
            <div id="markerKeyBindingsList" class="space-y-1 text-xs"></div>
            <div id="noBindingsMsg" class="text-gray-500 text-xs">No markers assigned to keys yet</div>
        </div>
        
        <div class="flex-1 overflow-y-auto">
            <div id="markersAssignList" class="space-y-2"></div>
        </div>
        
        <div class="mt-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-400 mb-2">Quick Reference:</div>
            <div class="grid grid-cols-5 gap-1 text-center">
                ${[1,2,3,4,5,6,7,8,9,0].map(k => `<div class="px-2 py-1 bg-gray-700 rounded text-white text-xs">${k}</div>`).join('')}
            </div>
        </div>
    `;
    
    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Marker Navigation', contentContainer, {
        width: 350,
        height: 450,
        minWidth: 300,
        minHeight: 350,
        closable: true,
        minimizable: true,
        resizable: true
    }) : null;
    
    setTimeout(updatePanelContent, 50);
    
    return win;
}

function updatePanelContent() {
    const bindingsList = document.getElementById('markerKeyBindingsList');
    const noBindingsMsg = document.getElementById('noBindingsMsg');
    const assignList = document.getElementById('markersAssignList');
    
    if (!bindingsList || !assignList) return;
    
    const markers = localAppServices.getTimelineMarkers ? localAppServices.getTimelineMarkers() : [];
    
    const bindings = Object.entries(markerKeyBindings).map(([key, id]) => {
        const marker = markers.find(m => m.id === id);
        return { key: parseInt(key), marker };
    }).filter(b => b.marker).sort((a, b) => a.key - b.key);
    
    if (bindings.length > 0) {
        bindingsList.innerHTML = bindings.map(b => `
            <div class="flex items-center gap-2">
                <span class="w-6 text-center bg-blue-600 text-white rounded">${b.key === 0 ? '0' : b.key}</span>
                <span class="flex-1 truncate text-gray-300">${b.marker.name}</span>
                <span class="text-gray-500">${b.marker.time.toFixed(2)}s</span>
            </div>
        `).join('');
        noBindingsMsg.style.display = 'none';
    } else {
        bindingsList.innerHTML = '';
        noBindingsMsg.style.display = 'block';
    }
    
    assignList.innerHTML = markers.length === 0 
        ? '<div class="text-center py-4 text-gray-500 text-sm">No markers available. Create markers first.</div>'
        : markers.map(marker => {
            const boundKey = Object.entries(markerKeyBindings).find(([, id]) => id === marker.id)?.[0];
            return `
                <div class="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <div class="w-3 h-3 rounded" style="background:${marker.color}"></div>
                        <span class="text-sm text-gray-300 truncate">${marker.name}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <select class="key-bind-select px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white" data-marker-id="${marker.id}">
                            <option value="">--</option>
                            ${[1,2,3,4,5,6,7,8,9,0].map(k => `<option value="${k}" ${boundKey === String(k) ? 'selected' : ''}>${k}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;
        }).join('');
    
    assignList.querySelectorAll('.key-bind-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const markerId = e.target.dataset.markerId;
            const keyValue = e.target.value;
            
            if (keyValue === '') {
                Object.entries(markerKeyBindings).forEach(([k, id]) => {
                    if (id === markerId) delete markerKeyBindings[k];
                });
            } else {
                Object.entries(markerKeyBindings).forEach(([k, id]) => {
                    if (id === markerId) delete markerKeyBindings[k];
                });
                markerKeyBindings[keyValue] = markerId;
            }
            updatePanelContent();
        });
    });
}