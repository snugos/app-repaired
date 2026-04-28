/**
 * js/AudioDucker.js - Audio Ducker
 * 
 * Automatic volume reduction based on another track's audio input (sidechain).
 * When the source track plays audio above a threshold, the target track's volume
 * is reduced by a specified amount, creating a "pumping" effect common in
 * electronic music production.
 */

let localAppServices = {};
let isInitialized = false;

const STORAGE_KEY = 'snugosAudioDucker';

// Default settings
const DEFAULT_DUCKER_SETTINGS = {
    enabled: true,
    threshold: -20, // dB
    reduction: -12, // dB amount of reduction applied
    attack: 0.005, // seconds
    release: 0.15, // seconds
    holdTime: 0.05, // seconds
    inputSource: 'master', // 'master' or track ID
    targetTracks: [], // track IDs to duck
    reverse: false // if true, duck when BELOW threshold
};

let duckerSettings = { ...DEFAULT_DUCKER_SETTINGS };
let activeInstances = new Map(); // trackId -> { detector, gainNode, originalGain }
let meterElement = null;
let panelElement = null;

/**
 * Initialize the module with app services
 */
export function initAudioDucker(appServices) {
    localAppServices = appServices || {};
    loadSettings();
    isInitialized = true;
    console.log('[AudioDucker] Module initialized with settings:', duckerSettings);
}

/**
 * Load saved settings from localStorage
 */
function loadSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            duckerSettings = { ...DEFAULT_DUCKER_SETTINGS, ...data };
        }
    } catch (e) {
        console.warn('[AudioDucker] Failed to load settings:', e);
    }
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(duckerSettings));
    } catch (e) {
        console.warn('[AudioDucker] Failed to save settings:', e);
    }
}

/**
 * Get current ducker settings
 */
export function getAudioDuckerSettings() {
    return { ...duckerSettings };
}

/**
 * Update ducker settings
 */
export function updateAudioDuckerSettings(newSettings) {
    duckerSettings = { ...duckerSettings, ...newSettings };
    saveSettings();
    
    // Apply to all active instances
    activeInstances.forEach((instance, trackId) => {
        applySettingsToInstance(instance);
    });
    
    console.log('[AudioDucker] Settings updated:', duckerSettings);
    return duckerSettings;
}

/**
 * Apply settings to a ducker instance
 */
function applySettingsToInstance(instance) {
    if (instance.detector && instance.detector.threshold) {
        instance.detector.threshold.value = duckerSettings.threshold;
    }
    if (instance.detector && instance.detector.attack) {
        instance.detector.attack.value = duckerSettings.attack;
    }
    if (instance.detector && instance.detector.release) {
        instance.detector.release.value = duckerSettings.release;
    }
}

/**
 * Create a ducker instance for a track
 */
function createDuckerInstance(track) {
    if (!track || !track.audioNode) return null;
    
    // Create gain node for reduction
    const reductionGain = new Tone.Gain(1.0);
    
    // Create envelope follower for sidechain detection
    const envelopeFollower = new Tone.EnvelopeFollower({
        attack: duckerSettings.attack,
        release: duckerSettings.release
    });
    
    // Create dynamics to handle the ducking
    const dynamics = new Tone.Compressor({
        threshold: duckerSettings.threshold,
        ratio: 20, // High ratio for strong reduction
        attack: duckerSettings.attack,
        release: duckerSettings.release,
        knee: 6
    });
    
    // Create makeup gain to restore level after reduction
    const makeupGain = new Tone.Gain(Tone.dbToGain(duckerSettings.reduction * -1));
    
    // Connect: track audio -> envelope follower -> dynamics -> reductionGain
    track.audioNode.connect(envelopeFollower);
    envelopeFollower.connect(dynamics);
    dynamics.connect(reductionGain);
    reductionGain.connect(makeupGain);
    
    // Store original gain
    const originalGain = track.gainNode ? track.gainNode.gain.value : 1.0;
    
    return {
        trackId: track.id,
        detector: envelopeFollower,
        dynamics: dynamics,
        reductionGain: reductionGain,
        makeupGain: makeupGain,
        originalGain: originalGain,
        active: false
    };
}

/**
 * Enable ducking for a specific track
 */
export function enableDuckerForTrack(trackId) {
    if (activeInstances.has(trackId)) return;
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.warn(`[AudioDucker] Track ${trackId} not found`);
        return false;
    }
    
    const instance = createDuckerInstance(track);
    if (instance) {
        instance.active = true;
        activeInstances.set(trackId, instance);
        console.log(`[AudioDucker] Enabled for track: ${trackId}`);
        return true;
    }
    return false;
}

/**
 * Disable ducking for a specific track
 */
export function disableDuckerForTrack(trackId) {
    const instance = activeInstances.get(trackId);
    if (!instance) return false;
    
    // Restore original gain
    if (instance.reductionGain) {
        instance.reductionGain.gain.value = 1.0;
    }
    
    // Cleanup
    if (instance.detector) instance.detector.dispose();
    if (instance.dynamics) instance.dynamics.dispose();
    if (instance.reductionGain) instance.reductionGain.dispose();
    if (instance.makeupGain) instance.makeupGain.dispose();
    
    activeInstances.delete(trackId);
    console.log(`[AudioDucker] Disabled for track: ${trackId}`);
    return true;
}

/**
 * Enable ducking for all target tracks
 */
export function enableDuckerForAllTargets() {
    const tracks = duckerSettings.targetTracks.length > 0 
        ? duckerSettings.targetTracks 
        : getAllTrackIds();
    
    tracks.forEach(trackId => {
        enableDuckerForTrack(trackId);
    });
    
    console.log(`[AudioDucker] Enabled for ${activeInstances.size} tracks`);
}

/**
 * Disable ducking for all tracks
 */
export function disableDuckerForAllTracks() {
    const trackIds = Array.from(activeInstances.keys());
    trackIds.forEach(trackId => {
        disableDuckerForTrack(trackId);
    });
    
    console.log('[AudioDucker] All ducking disabled');
}

/**
 * Get all track IDs
 */
function getAllTrackIds() {
    try {
        if (localAppServices.getTracks) {
            const tracks = localAppServices.getTracks();
            return tracks.map(t => t.id);
        }
    } catch (e) {
        console.warn('[AudioDucker] Could not get tracks:', e);
    }
    return [];
}

/**
 * Get ducker status
 */
export function getAudioDuckerStatus() {
    return {
        enabled: duckerSettings.enabled,
        isActive: activeInstances.size > 0,
        trackCount: activeInstances.size,
        settings: { ...duckerSettings }
    };
}

/**
 * Open the Audio Ducker panel
 */
export function openAudioDuckerPanel() {
    if (panelElement) {
        panelElement.remove();
        panelElement = null;
    }
    
    panelElement = document.createElement('div');
    panelElement.id = 'audioDuckerPanel';
    panelElement.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        width: 320px;
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 16px;
        z-index: 10000;
        color: #e0e0e0;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    const status = getAudioDuckerStatus();
    
    panelElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Audio Ducker</h3>
            <button id="closeAudioDuckerPanel" style="
                background: none;
                border: none;
                color: #888;
                cursor: pointer;
                font-size: 18px;
                padding: 0;
                line-height: 1;
            ">×</button>
        </div>
        
        <div style="margin-bottom: 12px;">
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="duckerEnabled" ${status.settings.enabled ? 'checked' : ''}>
                <span>Enable Ducker</span>
            </label>
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 4px; color: #aaa;">Threshold (dB)</label>
            <input type="range" id="duckerThreshold" min="-60" max="0" value="${status.settings.threshold}" 
                style="width: 100%;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666;">
                <span>-60</span>
                <span id="thresholdValue">${status.settings.threshold} dB</span>
                <span>0</span>
            </div>
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 4px; color: #aaa;">Reduction (dB)</label>
            <input type="range" id="duckerReduction" min="-30" max="0" value="${status.settings.reduction}" 
                style="width: 100%;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666;">
                <span>-30</span>
                <span id="reductionValue">${status.settings.reduction} dB</span>
                <span>0</span>
            </div>
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 4px; color: #aaa;">Attack (ms)</label>
            <input type="range" id="duckerAttack" min="1" max="100" value="${status.settings.attack * 1000}" 
                style="width: 100%;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666;">
                <span>1ms</span>
                <span id="attackValue">${(status.settings.attack * 1000).toFixed(0)}ms</span>
                <span>100ms</span>
            </div>
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 4px; color: #aaa;">Release (ms)</label>
            <input type="range" id="duckerRelease" min="10" max="500" value="${status.settings.release * 1000}" 
                style="width: 100%;">
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666;">
                <span>10ms</span>
                <span id="releaseValue">${(status.settings.release * 1000).toFixed(0)}ms</span>
                <span>500ms</span>
            </div>
        </div>
        
        <div style="margin-bottom: 12px;">
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="duckerReverse" ${status.settings.reverse ? 'checked' : ''}>
                <span>Reverse (duck below threshold)</span>
            </label>
        </div>
        
        <div style="
            padding: 8px;
            background: #252525;
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 12px;
            color: #888;
        ">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Status:</span>
                <span>${status.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Tracks Ducking:</span>
                <span>${status.trackCount}</span>
            </div>
        </div>
        
        <div style="display: flex; gap: 8px;">
            <button id="duckerEnableAll" style="
                flex: 1;
                padding: 8px;
                background: #2a5a8a;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 12px;
            ">Enable All</button>
            <button id="duckerDisableAll" style="
                flex: 1;
                padding: 8px;
                background: #4a4a4a;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 12px;
            ">Disable All</button>
        </div>
    `;
    
    document.body.appendChild(panelElement);
    
    // Add event listeners
    document.getElementById('closeAudioDuckerPanel').addEventListener('click', closeAudioDuckerPanel);
    
    document.getElementById('duckerEnabled').addEventListener('change', (e) => {
        updateAudioDuckerSettings({ enabled: e.target.checked });
    });
    
    document.getElementById('duckerThreshold').addEventListener('input', (e) => {
        document.getElementById('thresholdValue').textContent = `${e.target.value} dB`;
        updateAudioDuckerSettings({ threshold: parseFloat(e.target.value) });
    });
    
    document.getElementById('duckerReduction').addEventListener('input', (e) => {
        document.getElementById('reductionValue').textContent = `${e.target.value} dB`;
        updateAudioDuckerSettings({ reduction: parseFloat(e.target.value) });
    });
    
    document.getElementById('duckerAttack').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 1000;
        document.getElementById('attackValue').textContent = `${parseFloat(e.target.value).toFixed(0)}ms`;
        updateAudioDuckerSettings({ attack: val });
    });
    
    document.getElementById('duckerRelease').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 1000;
        document.getElementById('releaseValue').textContent = `${parseFloat(e.target.value).toFixed(0)}ms`;
        updateAudioDuckerSettings({ release: val });
    });
    
    document.getElementById('duckerReverse').addEventListener('change', (e) => {
        updateAudioDuckerSettings({ reverse: e.target.checked });
    });
    
    document.getElementById('duckerEnableAll').addEventListener('click', enableDuckerForAllTargets);
    document.getElementById('duckerDisableAll').addEventListener('click', disableDuckerForAllTracks);
    
    console.log('[AudioDucker] Panel opened');
}

/**
 * Close the Audio Ducker panel
 */
export function closeAudioDuckerPanel() {
    if (panelElement) {
        panelElement.remove();
        panelElement = null;
    }
}

/**
 * Toggle the Audio Ducker panel
 */
export function toggleAudioDuckerPanel() {
    if (panelElement) {
        closeAudioDuckerPanel();
    } else {
        openAudioDuckerPanel();
    }
}

// Export for external access
export default {
    initAudioDucker,
    getAudioDuckerSettings,
    updateAudioDuckerSettings,
    enableDuckerForTrack,
    disableDuckerForTrack,
    enableDuckerForAllTargets,
    disableDuckerForAllTracks,
    getAudioDuckerStatus,
    openAudioDuckerPanel,
    closeAudioDuckerPanel,
    toggleAudioDuckerPanel
};