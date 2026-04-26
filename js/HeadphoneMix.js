// js/HeadphoneMix.js - Track Headphone Preview
// Feature: Route individual tracks to a dedicated headphone mix with separate volume control

let localAppServices = {};
let headphoneBusNode = null;
let headphoneGainNode = null;
let headphoneMeterNode = null;
let headphoneAnalyserNode = null;
let trackHeadphoneSends = new Map(); // trackId -> sendGainNode

const HEADPHONE_MIX_DEFAULT_VOLUME = 0.8;

/**
 * Initialize the Headphone Mix module
 * @param {object} services - App services
 */
export function initHeadphoneMix(services) {
    localAppServices = services;
    setupHeadphoneBus();
    console.log('[HeadphoneMix] Initialized');
}

/**
 * Setup the headphone bus with gain and metering
 */
function setupHeadphoneBus() {
    if (headphoneGainNode && !headphoneGainNode.disposed) {
        return; // Already setup
    }
    
    try {
        headphoneGainNode = new Tone.Gain(HEADPHONE_MIX_DEFAULT_VOLUME);
        headphoneMeterNode = new Tone.Meter();
        headphoneAnalyserNode = new Tone.Analyser('fft', 256);
        
        headphoneGainNode.connect(headphoneMeterNode);
        headphoneGainNode.connect(headphoneAnalyserNode);
        headphoneGainNode.connect(Tone.Destination);
        
        console.log('[HeadphoneMix] Headphone bus created');
    } catch (e) {
        console.error('[HeadphoneMix] Error creating headphone bus:', e);
    }
}

/**
 * Add a track to the headphone mix
 * @param {string} trackId - Track ID
 */
export function addTrackToHeadphoneMix(trackId) {
    if (trackHeadphoneSends.has(trackId)) {
        console.log(`[HeadphoneMix] Track ${trackId} already in headphone mix`);
        return;
    }
    
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.error('[HeadphoneMix] Track not found:', trackId);
        return;
    }
    
    if (!headphoneGainNode || headphoneGainNode.disposed) {
        setupHeadphoneBus();
    }
    
    // Create send gain node for this track
    const sendGain = new Tone.Gain(0.7); // Default 70% send level
    
    // Connect track output to headphone send
    if (track.outputNode) {
        sendGain.connect(track.outputNode);
    }
    sendGain.connect(headphoneGainNode);
    
    trackHeadphoneSends.set(trackId, sendGain);
    console.log(`[HeadphoneMix] Track ${trackId} added to headphone mix`);
}

/**
 * Remove a track from the headphone mix
 * @param {string} trackId - Track ID
 */
export function removeTrackFromHeadphoneMix(trackId) {
    const sendGain = trackHeadphoneSends.get(trackId);
    if (sendGain) {
        if (!sendGain.disposed) {
            sendGain.disconnect();
        }
        trackHeadphoneSends.delete(trackId);
        console.log(`[HeadphoneMix] Track ${trackId} removed from headphone mix`);
    }
}

/**
 * Set headphone mix volume
 * @param {number} volume - Volume level (0-1)
 */
export function setHeadphoneMixVolume(volume) {
    if (headphoneGainNode && !headphoneGainNode.disposed) {
        headphoneGainNode.gain.value = Math.max(0, Math.min(1, volume));
        console.log(`[HeadphoneMix] Volume set to ${volume}`);
    }
}

/**
 * Get headphone mix volume
 * @returns {number} Current volume
 */
export function getHeadphoneMixVolume() {
    if (headphoneGainNode && !headphoneGainNode.disposed) {
        return headphoneGainNode.gain.value;
    }
    return HEADPHONE_MIX_DEFAULT_VOLUME;
}

/**
 * Set volume for a specific track in the headphone mix
 * @param {string} trackId - Track ID
 * @param {number} volume - Send level (0-1)
 */
export function setTrackHeadphoneSendLevel(trackId, volume) {
    const sendGain = trackHeadphoneSends.get(trackId);
    if (sendGain && !sendGain.disposed) {
        sendGain.gain.value = Math.max(0, Math.min(1, volume));
        console.log(`[HeadphoneMix] Track ${trackId} send level: ${volume}`);
    }
}

/**
 * Get volume for a specific track in the headphone mix
 * @param {string} trackId - Track ID
 * @returns {number} Send level (0-1)
 */
export function getTrackHeadphoneSendLevel(trackId) {
    const sendGain = trackHeadphoneSends.get(trackId);
    if (sendGain && !sendGain.disposed) {
        return sendGain.gain.value;
    }
    return 0.7; // Default
}

/**
 * Get list of tracks in headphone mix
 * @returns {Array} Array of track IDs
 */
export function getTracksInHeadphoneMix() {
    return Array.from(trackHeadphoneSends.keys());
}

/**
 * Open the headphone mix panel
 */
export function openHeadphoneMixPanel() {
    const windowId = 'headphoneMix';
    
    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        if (openWindows.has(windowId)) {
            const win = openWindows.get(windowId);
            win.restore();
            return win;
        }
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'headphoneMixContent';
    contentContainer.className = 'p-4 bg-gray-900 text-white h-full flex flex-col';
    
    const options = {
        width: 400,
        height: 500,
        minWidth: 300,
        minHeight: 400,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow?.(windowId, 'Headphone Mix', contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderHeadphoneMixContent(), 50);
    }
    
    return win;
}

/**
 * Render headphone mix panel content
 */
function renderHeadphoneMixContent() {
    const container = document.getElementById('headphoneMixContent');
    if (!container) return;
    
    const tracksInMix = getTracksInHeadphoneMix();
    const currentVolume = getHeadphoneMixVolume();
    
    let html = `
        <div class="mb-4">
            <h2 class="text-lg font-bold mb-2">Headphone Mix</h2>
            <p class="text-sm text-gray-400 mb-4">Route tracks to a dedicated headphone mix with separate volume control.</p>
            
            <div class="flex items-center gap-4 mb-6 bg-gray-800 p-3 rounded">
                <label class="text-sm font-semibold">Master Volume:</label>
                <input type="range" id="headphoneVolume" min="0" max="1" step="0.01" value="${currentVolume}" 
                    class="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer">
                <span id="headphoneVolumeValue" class="text-sm w-12 text-right">${Math.round(currentVolume * 100)}%</span>
            </div>
        </div>
        
        <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
                <h3 class="text-sm font-semibold">Tracks in Headphone Mix</h3>
                <button id="addAllTracksBtn" class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white">
                    Add All
                </button>
            </div>
            
            <div id="headphoneTracksList" class="space-y-2 max-h-64 overflow-y-auto">
    `;
    
    if (tracksInMix.length === 0) {
        html += `
            <div class="text-center py-4 text-gray-500 text-sm">
                No tracks in headphone mix.<br>
                Click "Add Track" below or use "Add All" to add all tracks.
            </div>
        `;
    } else {
        tracksInMix.forEach(trackId => {
            const track = localAppServices.getTrackById?.(trackId);
            const sendLevel = getTrackHeadphoneSendLevel(trackId);
            const trackName = track?.name || trackId;
            
            html += `
                <div class="flex items-center gap-2 bg-gray-800 p-2 rounded" data-track-id="${trackId}">
                    <span class="flex-1 text-sm truncate">${trackName}</span>
                    <input type="range" class="track-send-level w-20 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" 
                        min="0" max="1" step="0.01" value="${sendLevel}">
                    <span class="send-level-val text-xs w-10 text-right">${Math.round(sendLevel * 100)}%</span>
                    <button class="remove-track-btn px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded text-white">×</button>
                </div>
            `;
        });
    }
    
    html += `
            </div>
        </div>
        
        <div class="flex gap-2">
            <button id="addTrackBtn" class="flex-1 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 rounded text-white">
                + Add Track
            </button>
            <button id="removeAllBtn" class="flex-1 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 rounded text-white">
                Remove All
            </button>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Event handlers
    const volumeSlider = container.querySelector('#headphoneVolume');
    volumeSlider?.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value);
        setHeadphoneMixVolume(vol);
        container.querySelector('#headphoneVolumeValue').textContent = `${Math.round(vol * 100)}%`;
    });
    
    container.querySelectorAll('.track-send-level').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const trackId = e.target.closest('[data-track-id]')?.dataset.trackId;
            const level = parseFloat(e.target.value);
            if (trackId) {
                setTrackHeadphoneSendLevel(trackId, level);
                e.target.closest('.bg-gray-800').querySelector('.send-level-val').textContent = `${Math.round(level * 100)}%`;
            }
        });
    });
    
    container.querySelectorAll('.remove-track-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const trackId = btn.closest('[data-track-id]')?.dataset.trackId;
            if (trackId) {
                removeTrackFromHeadphoneMix(trackId);
                renderHeadphoneMixContent();
            }
        });
    });
    
    container.querySelector('#addTrackBtn')?.addEventListener('click', () => {
        showTrackSelectorDialog();
    });
    
    container.querySelector('#removeAllBtn')?.addEventListener('click', () => {
        getTracksInHeadphoneMix().forEach(trackId => {
            removeTrackFromHeadphoneMix(trackId);
        });
        renderHeadphoneMixContent();
    });
    
    container.querySelector('#addAllTracksBtn')?.addEventListener('click', () => {
        if (localAppServices.getAllTracks) {
            const allTracks = localAppServices.getAllTracks();
            allTracks.forEach(track => {
                addTrackToHeadphoneMix(track.id);
            });
        }
        renderHeadphoneMixContent();
    });
}

/**
 * Show track selector dialog
 */
function showTrackSelectorDialog() {
    const existing = document.getElementById('headphoneTrackSelector');
    if (existing) existing.remove();
    
    const dialog = document.createElement('div');
    dialog.id = 'headphoneTrackSelector';
    dialog.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    
    const tracks = localAppServices.getAllTracks?.() || [];
    const tracksInMix = getTracksInHeadphoneMix();
    const availableTracks = tracks.filter(t => !tracksInMix.includes(t.id));
    
    let html = `
        <div class="bg-gray-800 rounded-lg p-4 w-80 max-h-96 overflow-y-auto">
            <h3 class="text-lg font-semibold mb-3">Add Track to Headphone Mix</h3>
            <div class="space-y-2">
    `;
    
    if (availableTracks.length === 0) {
        html += `<div class="text-gray-400 text-sm py-4 text-center">All tracks already in headphone mix.</div>`;
    } else {
        availableTracks.forEach(track => {
            html += `
                <button class="add-track-option w-full text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                    data-track-id="${track.id}">
                    ${track.name}
                </button>
            `;
        });
    }
    
    html += `
            </div>
            <button id="closeSelector" class="mt-3 w-full px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm">
                Cancel
            </button>
        </div>
    `;
    
    dialog.innerHTML = html;
    document.body.appendChild(dialog);
    
    dialog.querySelectorAll('.add-track-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const trackId = btn.dataset.trackId;
            addTrackToHeadphoneMix(trackId);
            dialog.remove();
            renderHeadphoneMixContent();
        });
    });
    
    dialog.querySelector('#closeSelector')?.addEventListener('click', () => {
        dialog.remove();
    });
    
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.remove();
    });
}

console.log('[HeadphoneMix] Module loaded');