// js/TimelineMarkers.js - Timeline Markers Feature
// Add color-coded markers on timeline for navigation

let localAppServices = {};
let markers = new Map();
let markerIdCounter = 0;

export function initTimelineMarkers(appServices) {
    localAppServices = appServices || {};
    loadMarkersFromStorage();
    console.log('[TimelineMarkers] Initialized with', markers.size, 'markers');
}

export function getTimelineMarkers() {
    return Array.from(markers.values());
}

export function addTimelineMarker(time, name = '', color = '#ff6b6b') {
    const id = `marker_${++markerIdCounter}`;
    const marker = {
        id,
        time: Math.max(0, time),
        name: name || `Marker ${markerIdCounter}`,
        color,
        createdAt: Date.now()
    };
    markers.set(id, marker);
    saveMarkersToStorage();
    renderTimelineMarkers();
    return marker;
}

export function removeTimelineMarker(id) {
    if (markers.has(id)) {
        markers.delete(id);
        saveMarkersToStorage();
        renderTimelineMarkers();
        return true;
    }
    return false;
}

export function updateTimelineMarker(id, updates) {
    const marker = markers.get(id);
    if (marker) {
        Object.assign(marker, updates);
        saveMarkersToStorage();
        renderTimelineMarkers();
        return marker;
    }
    return null;
}

function saveMarkersToStorage() {
    try {
        localStorage.setItem('snugosTimelineMarkers', JSON.stringify(Array.from(markers.values())));
    } catch (e) {
        console.warn('[TimelineMarkers] Failed to save:', e);
    }
}

function loadMarkersFromStorage() {
    try {
        const saved = localStorage.getItem('snugosTimelineMarkers');
        if (saved) {
            const arr = JSON.parse(saved);
            markers.clear();
            arr.forEach(m => {
                markers.set(m.id, m);
                const num = parseInt(m.id.split('_')[1], 10);
                if (num > markerIdCounter) markerIdCounter = num;
            });
        }
    } catch (e) {
        console.warn('[TimelineMarkers] Failed to load:', e);
    }
}

function renderTimelineMarkers() {
    const existing = document.getElementById('timelineMarkersContainer');
    if (existing) existing.remove();

    const timeline = document.getElementById('timeline');
    if (!timeline) return;

    const container = document.createElement('div');
    container.id = 'timelineMarkersContainer';
    container.style.cssText = 'position:absolute;top:0;left:0;right:0;height:24px;pointer-events:none;';

    const pixelsPerSecond = localAppServices.getPixelsPerSecond ? localAppServices.getPixelsPerSecond() : 100;
    
    markers.forEach(marker => {
        const el = document.createElement('div');
        el.style.cssText = `
            position: absolute;
            left: ${marker.time * pixelsPerSecond}px;
            top: 0;
            height: 100%;
            width: 2px;
            background: ${marker.color};
            pointer-events: auto;
            cursor: pointer;
        `;
        el.title = `${marker.name} (${marker.time.toFixed(2)}s)`;
        el.onclick = () => jumpToMarker(marker.id);
        container.appendChild(el);
    });

    timeline.style.position = 'relative';
    timeline.appendChild(container);
}

function jumpToMarker(id) {
    const marker = markers.get(id);
    if (marker && localAppServices.jumpToTime) {
        localAppServices.jumpToTime(marker.time);
    }
}

export function openTimelineMarkersPanel() {
    const windowId = 'timelineMarkers';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const content = document.createElement('div');
    content.id = 'timelineMarkersContent';
    content.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';
    content.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold">Timeline Markers</h3>
            <button id="addTimelineMarkerBtn" class="px-3 py-1 bg-blue-600 rounded text-sm hover:bg-blue-500">+ Add at Playhead</button>
        </div>
        <div id="markersList" class="flex-1 overflow-y-auto space-y-2"></div>
    `;

    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Timeline Markers', content, {
        width: 300, height: 400, minWidth: 250, minHeight: 300
    }) : null;

    setTimeout(() => {
        document.getElementById('addTimelineMarkerBtn').onclick = () => {
            const time = localAppServices.getCurrentTime ? localAppServices.getCurrentTime() : 0;
            addTimelineMarker(time);
            refreshMarkersPanel();
        };
        refreshMarkersPanel();
    }, 50);

    return win;
}

function refreshMarkersPanel() {
    const list = document.getElementById('markersList');
    if (!list) return;
    
    const arr = getTimelineMarkers().sort((a, b) => a.time - b.time);
    if (arr.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-sm">No markers yet. Click "Add at Playhead" to create one.</p>';
        return;
    }

    list.innerHTML = arr.map(m => `
        <div class="flex items-center gap-2 p-2 bg-gray-800 rounded" data-id="${m.id}">
            <div class="w-4 h-4 rounded" style="background:${m.color}"></div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">${m.name}</div>
                <div class="text-xs text-gray-400">${m.time.toFixed(2)}s</div>
            </div>
            <button class="go-btn px-2 py-1 bg-blue-600 rounded text-xs hover:bg-blue-500">Go</button>
            <button class="del-btn px-2 py-1 bg-red-600 rounded text-xs hover:bg-red-500">×</button>
        </div>
    `).join('');

    list.querySelectorAll('.go-btn').forEach(btn => {
        btn.onclick = () => {
            const id = btn.closest('[data-id]').dataset.id;
            jumpToMarker(id);
        };
    });

    list.querySelectorAll('.del-btn').forEach(btn => {
        btn.onclick = () => {
            const id = btn.closest('[data-id]').dataset.id;
            removeTimelineMarker(id);
            refreshMarkersPanel();
        };
    });
}
