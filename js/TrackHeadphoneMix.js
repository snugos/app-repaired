// js/TrackHeadphoneMix.js - Track Headphone Preview Mix Module

import * as Constants from './constants.js';

let localAppServices = {};
let headphoneMixGainNode = null;
let headphoneAnalyserNode = null;
let headphoneMeterNode = null;
let headphoneEnabled = false;

// Per-track headphone send levels: Map<trackId, { level: number, enabled: boolean }>
const trackHeadphoneSends = new Map();

/**
 * Initialize the headphone mix system.
 * @param {Object} services - App services from main.js
 */
export function initTrackHeadphoneMix(services) {
    localAppServices = services || {};
    console.log('[TrackHeadphoneMix] Initialized.');
}

/**
 * Sets up the headphone mix output chain.
 * Creates a separate gain node for headphone output distinct from master output.
 */
function setupHeadphoneMixChain() {
    if (headphoneMixGainNode && !headphoneMixGainNode.disposed) return;
    
    try {
        // Create headphone mix gain node
        headphoneMixGainNode = new Tone.Gain(0.8);
        
        // Create meter and analyser for visualization
        headphoneMeterNode = new Tone.Meter({ smoothing: 0.8 });
        headphoneAnalyserNode = new Tone.Analyser('fft', 128);
        
        // Connect chain: headphoneMixGain -> meter -> analyser -> destination
        headphoneMixGainNode.connect(headphoneMeterNode);
        headphoneMixGainNode.connect(headphoneAnalyserNode);
        headphoneMixGainNode.connect(Tone.Destination);
        
        console.log('[TrackHeadphoneMix] Headphone mix chain created.');
    } catch (e) {
        console.error('[TrackHeadphoneMix] Error setting up headphone chain:', e);
    }
}

/**
 * Enable or disable the headphone mix output.
 * @param {boolean} enabled - True to enable headphone mix
 */
export function setHeadphoneMixEnabled(enabled) {
    headphoneEnabled = !!enabled;
    
    if (headphoneEnabled) {
        setupHeadphoneMixChain();
        
        // Re-route tracks with headphone sends
        trackHeadphoneSends.forEach((sendData, trackId) => {
            if (sendData.enabled && sendData.level > 0) {
                routeTrackToHeadphoneMix(trackId, true);
            }
        });
        
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Headphone mix enabled', 1500);
        }
    } else {
        // Remove headphone routing from all tracks
        trackHeadphoneSends.forEach((sendData, trackId) => {
            routeTrackToHeadphoneMix(trackId, false);
        });
        
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Headphone mix disabled', 1500);
        }
    }
    
    console.log('[TrackHeadphoneMix] Headphone mix:', headphoneEnabled ? 'enabled' : 'disabled');
}

/**
 * Check if headphone mix is enabled.
 * @returns {boolean}
 */
export function isHeadphoneMixEnabled() {
    return headphoneEnabled;
}

/**
 * Route a track's audio to/from the headphone mix.
 * @param {number} trackId - The track ID
 * @param {boolean} connect - True to connect, false to disconnect
 */
function routeTrackToHeadphoneMix(trackId, connect) {
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.gainNode || track.gainNode.disposed) return;
    
    if (!headphoneMixGainNode || headphoneMixGainNode.disposed) {
        setupHeadphoneMixChain();
    }
    
    if (connect && headphoneMixGainNode) {
        // Connect track to headphone mix via a send gain node
        if (!track.headphoneSendNode || track.headphoneSendNode.disposed) {
            track.headphoneSendNode = new Tone.Gain(0.5);
        }
        track.gainNode.connect(track.headphoneSendNode);
        track.headphoneSendNode.connect(headphoneMixGainNode);
        console.log(`[TrackHeadphoneMix] Track ${trackId} routed to headphone mix`);
    } else if (track.headphoneSendNode && !track.headphoneSendNode.disposed) {
        track.headphoneSendNode.disconnect();
        track.headphoneSendNode.dispose();
        track.headphoneSendNode = null;
        console.log(`[TrackHeadphoneMix] Track ${trackId} removed from headphone mix`);
    }
}

/**
 * Set the headphone send level for a track.
 * @param {number} trackId - The track ID
 * @param {number} level - Send level (0-1)
 */
export function setTrackHeadphoneSendLevel(trackId, level) {
    const normalizedLevel = Math.max(0, Math.min(1, parseFloat(level) || 0));
    
    let sendData = trackHeadphoneSends.get(trackId) || { level: 0, enabled: false };
    sendData.level = normalizedLevel;
    trackHeadphoneSends.set(trackId, sendData);
    
    // Update the actual send node if it exists
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (track?.headphoneSendNode && !track.headphoneSendNode.disposed) {
        track.headphoneSendNode.gain.value = normalizedLevel;
    }
    
    console.log(`[TrackHeadphoneMix] Track ${trackId} headphone level: ${normalizedLevel}`);
}

/**
 * Get the headphone send level for a track.
 * @param {number} trackId - The track ID
 * @returns {number} Send level (0-1), default 0
 */
export function getTrackHeadphoneSendLevel(trackId) {
    const sendData = trackHeadphoneSends.get(trackId);
    return sendData?.level ?? 0;
}

/**
 * Enable or disable a track's headphone send.
 * @param {number} trackId - The track ID
 * @param {boolean} enabled - True to enable the send
 */
export function setTrackHeadphoneSendEnabled(trackId, enabled) {
    let sendData = trackHeadphoneSends.get(trackId) || { level: 0, enabled: false };
    sendData.enabled = !!enabled;
    trackHeadphoneSends.set(trackId, sendData);
    
    if (headphoneEnabled) {
        routeTrackToHeadphoneMix(trackId, enabled && sendData.level > 0);
    }
    
    console.log(`[TrackHeadphoneMix] Track ${trackId} headphone send ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Check if a track's headphone send is enabled.
 * @param {number} trackId - The track ID
 * @returns {boolean}
 */
export function isTrackHeadphoneSendEnabled(trackId) {
    const sendData = trackHeadphoneSends.get(trackId);
    return sendData?.enabled ?? false;
}

/**
 * Get the headphone mix master volume.
 * @returns {number}
 */
export function getHeadphoneMixVolume() {
    if (!headphoneMixGainNode || headphoneMixGainNode.disposed) return 0.8;
    return headphoneMixGainNode.gain.value;
}

/**
 * Set the headphone mix master volume.
 * @param {number} volume - Volume level (0-1)
 */
export function setHeadphoneMixVolume(volume) {
    const normalizedVolume = Math.max(0, Math.min(1, parseFloat(volume) || 0.8));
    
    if (headphoneMixGainNode && !headphoneMixGainNode.disposed) {
        headphoneMixGainNode.gain.value = normalizedVolume;
    }
    
    console.log(`[TrackHeadphoneMix] Headphone mix volume: ${normalizedVolume}`);
}

/**
 * Get the headphone mix meter value.
 * @returns {number} Current level in dB
 */
export function getHeadphoneMixMeter() {
    if (!headphoneMeterNode || headphoneMeterNode.disposed) return -60;
    return headphoneMeterNode.getValue();
}

/**
 * Get the headphone mix frequency data for visualization.
 * @returns {Float32Array|null}
 */
export function getHeadphoneMixFrequencyData() {
    if (!headphoneAnalyserNode || headphoneAnalyserNode.disposed) return null;
    return headphoneAnalyserNode.getValue();
}

/**
 * Get all tracks with their headphone send data.
 * @returns {Array<{trackId: number, trackName: string, level: number, enabled: boolean}>}
 */
export function getTrackHeadphoneSendsInfo() {
    const tracks = localAppServices.getTracks?.() || [];
    const result = [];
    
    tracks.forEach(track => {
        const sendData = trackHeadphoneSends.get(track.id) || { level: 0, enabled: false };
        result.push({
            trackId: track.id,
            trackName: track.name,
            level: sendData.level,
            enabled: sendData.enabled
        });
    });
    
    return result;
}

/**
 * Clear all headphone sends (reset).
 */
export function clearAllHeadphoneSends() {
    trackHeadphoneSends.forEach((sendData, trackId) => {
        routeTrackToHeadphoneMix(trackId, false);
    });
    trackHeadphoneSends.clear();
    console.log('[TrackHeadphoneMix] All headphone sends cleared');
}

/**
 * Cleanup and dispose resources.
 */
export function disposeTrackHeadphoneMix() {
    clearAllHeadphoneSends();
    
    if (headphoneMixGainNode && !headphoneMixGainNode.disposed) {
        headphoneMixGainNode.dispose();
        headphoneMixGainNode = null;
    }
    if (headphoneMeterNode && !headphoneMeterNode.disposed) {
        headphoneMeterNode.dispose();
        headphoneMeterNode = null;
    }
    if (headphoneAnalyserNode && !headphoneAnalyserNode.disposed) {
        headphoneAnalyserNode.dispose();
        headphoneAnalyserNode = null;
    }
    
    console.log('[TrackHeadphoneMix] Disposed');
}

/**
 * Open the Track Headphone Mix panel for routing individual tracks to a dedicated headphone mix.
 * @param {Object|null} savedState - Optional saved window state
 * @returns {Object} The created/restyored window
 */
export function openTrackHeadphoneMixPanel(savedState = null) {
    const windowId = 'trackHeadphoneMix';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        if (win?.restore) win.restore();
        renderHeadphoneMixContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'headphoneMixContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    const options = { width: 400, height: 500, minWidth: 350, minHeight: 400, initialContentKey: windowId, closable: true, minimizable: true, resizable: true };
    
    if (savedState) {
        Object.assign(options, { x: parseInt(savedState.left, 10), y: parseInt(savedState.top, 10), width: parseInt(savedState.width, 10), height: parseInt(savedState.height, 10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    }

    const win = localAppServices.createWindow(windowId, 'Headphone Mix', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderHeadphoneMixContent(), 50);
    }
    return win;
}

/**
 * Render the headphone mix panel content.
 */
function renderHeadphoneMixContent() {
    const container = document.getElementById('headphoneMixContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const isEnabled = isHeadphoneMixEnabled();
    const masterVolume = getHeadphoneMixVolume();
    const meterValue = getHeadphoneMixMeter();

    let html = `
        <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="headphoneMixEnabled" ${isEnabled ? 'checked' : ''} class="w-4 h-4 accent-purple-500">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Headphone Mix</span>
                </label>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Vol:</span>
                <input type="range" id="headphoneMixMasterVol" min="0" max="100" value="${Math.round(masterVolume * 100)}" class="w-20 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                <span id="headphoneMixMasterVolLabel" class="text-xs text-gray-600 dark:text-gray-400 w-8">${Math.round(masterVolume * 100)}%</span>
            </div>
        </div>
        
        <div class="mb-2 flex items-center justify-between">
            <span class="text-xs text-gray-500 dark:text-gray-400">Track</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">Send Level</span>
        </div>
        
        <div id="headphoneTracksList" class="space-y-2">
    `;

    if (tracks.length === 0) {
        html += `
            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                <p>No tracks available</p>
            </div>
        `;
    } else {
        tracks.forEach(track => {
            const sendLevel = getTrackHeadphoneSendLevel(track.id);
            const sendEnabled = isTrackHeadphoneSendEnabled(track.id);
            
            html += `
                <div class="flex items-center justify-between p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" class="headphone-send-enabled w-4 h-4 accent-purple-500" data-track-id="${track.id}" ${sendEnabled ? 'checked' : ''}>
                        <div class="w-3 h-3 rounded" style="background-color: ${track.color || '#666'}"></div>
                        <span class="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[120px]">${track.name}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="range" class="headphone-send-level w-24 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer" data-track-id="${track.id}" min="0" max="100" value="${Math.round(sendLevel * 100)}">
                        <span class="headphone-send-level-label text-xs text-gray-600 dark:text-gray-400 w-8">${Math.round(sendLevel * 100)}%</span>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;

    // Meter display
    html += `
        <div class="mt-3 p-2 bg-black rounded border border-gray-700">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-400">Headphone Meter</span>
                <span id="headphoneMeterValue" class="text-xs text-green-400">${meterValue.toFixed(1)} dB</span>
            </div>
            <div class="h-2 bg-gray-800 rounded overflow-hidden">
                <div id="headphoneMeterBar" class="h-full bg-green-500 transition-all duration-100" style="width: 0%"></div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Attach event listeners
    const enabledCheckbox = container.querySelector('#headphoneMixEnabled');
    if (enabledCheckbox) {
        enabledCheckbox.addEventListener('change', (e) => {
            setHeadphoneMixEnabled(e.target.checked);
            renderHeadphoneMixContent();
        });
    }

    const masterVolSlider = container.querySelector('#headphoneMixMasterVol');
    if (masterVolSlider) {
        masterVolSlider.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value) / 100;
            setHeadphoneMixVolume(vol);
            const label = container.querySelector('#headphoneMixMasterVolLabel');
            if (label) label.textContent = `${Math.round(vol * 100)}%`;
        });
    }

    container.querySelectorAll('.headphone-send-enabled').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const trackId = parseInt(e.target.dataset.trackId);
            setTrackHeadphoneSendEnabled(trackId, e.target.checked);
        });
    });

    container.querySelectorAll('.headphone-send-level').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const trackId = parseInt(e.target.dataset.trackId);
            const level = parseInt(e.target.value) / 100;
            setTrackHeadphoneSendLevel(trackId, level);
            const label = e.target.parentElement.querySelector('.headphone-send-level-label');
            if (label) label.textContent = `${Math.round(level * 100)}%`;
        });
    });

    // Start meter update loop
    updateHeadphoneMixMeter();
}

/**
 * Update the headphone mix meter display.
 */
function updateHeadphoneMixMeter() {
    const container = document.getElementById('headphoneMixContent');
    if (!container) return;

    const meterValueEl = container.querySelector('#headphoneMeterValue');
    const meterBarEl = container.querySelector('#headphoneMeterBar');
    
    if (meterValueEl && meterBarEl) {
        const db = getHeadphoneMixMeter();
        meterValueEl.textContent = `${db.toFixed(1)} dB`;
        
        // Convert dB to percentage (assuming -60dB to 0dB range)
        const pct = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
        meterBarEl.style.width = `${pct}%`;
        
        // Color based on level
        if (db > -6) {
            meterBarEl.className = 'h-full bg-red-500 transition-all duration-100';
        } else if (db > -12) {
            meterBarEl.className = 'h-full bg-yellow-500 transition-all duration-100';
        } else {
            meterBarEl.className = 'h-full bg-green-500 transition-all duration-100';
        }
    }

    if (document.getElementById('headphoneMixContent')) {
        requestAnimationFrame(updateHeadphoneMixMeter);
    }
}