// js/TrackHeightMemory.js - Track Height Memory Feature
// Remember custom track heights across sessions

let localAppServices = {};
let trackHeights = {}; // { trackId: heightInPixels }
const DEFAULT_TRACK_HEIGHT = 80;
const MIN_TRACK_HEIGHT = 40;
const MAX_TRACK_HEIGHT = 300;

export function initTrackHeightMemory(appServices) {
    localAppServices = appServices || {};
    loadTrackHeightsFromStorage();
    console.log('[TrackHeightMemory] Initialized with', Object.keys(trackHeights).length, 'saved track heights');
}

export function getTrackHeight(trackId) {
    return trackHeights[trackId] || DEFAULT_TRACK_HEIGHT;
}

export function setTrackHeight(trackId, height) {
    const clampedHeight = Math.max(MIN_TRACK_HEIGHT, Math.min(MAX_TRACK_HEIGHT, parseInt(height) || DEFAULT_TRACK_HEIGHT));
    trackHeights[trackId] = clampedHeight;
    saveTrackHeightsToStorage();
    console.log(`[TrackHeightMemory] Track ${trackId} height set to ${clampedHeight}px`);
    return clampedHeight;
}

export function resetTrackHeight(trackId) {
    if (trackHeights[trackId]) {
        delete trackHeights[trackId];
        saveTrackHeightsToStorage();
        console.log(`[TrackHeightMemory] Track ${trackId} height reset to default`);
        return true;
    }
    return false;
}

export function getAllSavedHeights() {
    return { ...trackHeights };
}

export function applySavedHeightsToTracks() {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    let appliedCount = 0;
    tracks.forEach(track => {
        if (trackHeights[track.id] !== undefined) {
            if (localAppServices.setTrackHeightById) {
                localAppServices.setTrackHeightById(track.id, trackHeights[track.id]);
                appliedCount++;
            }
        }
    });
    console.log(`[TrackHeightMemory] Applied saved heights to ${appliedCount} tracks`);
    return appliedCount;
}

function saveTrackHeightsToStorage() {
    try {
        localStorage.setItem('snugosTrackHeights', JSON.stringify(trackHeights));
    } catch (e) {
        console.warn('[TrackHeightMemory] Failed to save:', e);
    }
}

function loadTrackHeightsFromStorage() {
    try {
        const saved = localStorage.getItem('snugosTrackHeights');
        if (saved) {
            trackHeights = JSON.parse(saved) || {};
        }
    } catch (e) {
        console.warn('[TrackHeightMemory] Failed to load:', e);
        trackHeights = {};
    }
}

export function openTrackHeightPanel() {
    const windowId = 'trackHeightSettings';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        updatePanelContent();
        return openWindows.get(windowId);
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackHeightContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 select-none';
    
    contentContainer.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-bold text-white mb-1">Track Height Memory</h3>
            <p class="text-sm text-gray-400">Remembers your custom track heights</p>
        </div>
        <div class="flex-1 overflow-y-auto">
            <div id="trackHeightsList" class="space-y-2"></div>
        </div>
        <div class="mt-4 p-3 bg-gray-800 rounded border border-gray-700">
            <button id="resetAllHeightsBtn" class="w-full px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600">
                Reset All to Default
            </button>
        </div>
    `;
    
    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Track Heights', contentContainer, {
        width: 350,
        height: 450,
        minWidth: 300,
        minHeight: 350,
        closable: true,
        minimizable: true,
        resizable: true
    }) : null;
    
    setTimeout(() => {
        updatePanelContent();
        const resetBtn = document.getElementById('resetAllHeightsBtn');
        resetBtn?.addEventListener('click', () => {
            trackHeights = {};
            saveTrackHeightsToStorage();
            updatePanelContent();
            localAppServices.showNotification?.('All track heights reset to default', 1500);
        });
    }, 50);
    
    return win;
}

function updatePanelContent() {
    const listEl = document.getElementById('trackHeightsList');
    if (!listEl) return;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    if (tracks.length === 0) {
        listEl.innerHTML = '<div class="text-center py-4 text-gray-500">No tracks in project</div>';
        return;
    }
    
    listEl.innerHTML = tracks.map(track => {
        const savedHeight = trackHeights[track.id] || DEFAULT_TRACK_HEIGHT;
        return `
            <div class="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                <span class="text-sm text-gray-300 truncate flex-1 mr-2">${track.name || 'Track ' + track.id}</span>
                <div class="flex items-center gap-2">
                    <input type="number" min="${MIN_TRACK_HEIGHT}" max="${MAX_TRACK_HEIGHT}" 
                        value="${savedHeight}" 
                        class="w-16 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white text-center"
                        data-track-id="${track.id}">
                    <span class="text-xs text-gray-500">px</span>
                    <button class="reset-height-btn px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500" data-track-id="${track.id}">
                        Reset
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    listEl.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
            const trackId = e.target.dataset.trackId;
            const newHeight = parseInt(e.target.value) || DEFAULT_TRACK_HEIGHT;
            setTrackHeight(trackId, newHeight);
        });
    });
    
    listEl.querySelectorAll('.reset-height-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const trackId = e.target.dataset.trackId;
            resetTrackHeight(trackId);
            updatePanelContent();
            localAppServices.showNotification?.('Track height reset', 1500);
        });
    });
}