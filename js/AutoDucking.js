// js/AutoDucking.js - Auto-Ducking feature for tracks
// Automatically reduces track volume when another track plays (sidechain-based)

let localAppServices = {};
let duckingConfigs = {}; // { trackId: { sourceTrackId, threshold, amount, attack, release, enabled } }
let activeDucking = new Map(); // trackId -> ducking state

/**
 * Initialize Auto-Ducking module
 * @param {Object} services - App services
 */
export function initAutoDucking(services) {
    localAppServices = services || {};
    loadDuckingConfigs();
    console.log('[AutoDucking] Initialized with', Object.keys(duckingConfigs).length, 'configs');
}

/**
 * Get all ducking configs
 */
export function getDuckingConfigs() {
    return JSON.parse(JSON.stringify(duckingConfigs));
}

/**
 * Get ducking config for a specific track
 */
export function getDuckingConfigForTrack(trackId) {
    return duckingConfigs[trackId] ? JSON.parse(JSON.stringify(duckingConfigs[trackId])) : null;
}

/**
 * Set ducking configuration for a track
 * @param {number} trackId - Track to apply ducking to
 * @param {Object} config - { sourceTrackId, threshold, amount, attack, release, enabled }
 */
export function setDuckingConfig(trackId, config) {
    duckingConfigs[trackId] = {
        sourceTrackId: config.sourceTrackId || null,
        threshold: config.threshold ?? -30, // dB
        amount: config.amount ?? 0.5, // 0-1 (how much to reduce)
        attack: config.attack ?? 0.01, // seconds
        release: config.release ?? 0.2, // seconds
        enabled: config.enabled ?? true
    };
    saveDuckingConfigs();
    console.log(`[AutoDucking] Config set for track ${trackId}`);
}

/**
 * Remove ducking config for a track
 */
export function removeDuckingConfig(trackId) {
    if (duckingConfigs[trackId]) {
        delete duckingConfigs[trackId];
        activeDucking.delete(trackId);
        saveDuckingConfigs();
        return true;
    }
    return false;
}

/**
 * Toggle ducking on/off for a track
 */
export function toggleDucking(trackId, enabled) {
    if (duckingConfigs[trackId]) {
        duckingConfigs[trackId].enabled = enabled;
        saveDuckingConfigs();
        return true;
    }
    return false;
}

/**
 * Process ducking for a track based on source track level
 * Called during audio processing
 */
export function processDucking(trackId, sourceLevelDb) {
    const config = duckingConfigs[trackId];
    if (!config || !config.enabled || !config.sourceTrackId) return;

    const threshold = config.threshold;
    const amount = config.amount;
    const attack = config.attack;
    const release = config.release;

    // Calculate target gain reduction
    let targetGain = 1.0;
    if (sourceLevelDb > threshold) {
        // Above threshold - apply ducking
        const exceedDb = sourceLevelDb - threshold;
        const reduction = Math.min(amount, 1.0) * (exceedDb / Math.abs(threshold));
        targetGain = 1.0 - reduction;
    }

    // Apply smooth transition
    const currentState = activeDucking.get(trackId) || { gain: 1.0, lastTime: performance.now() };
    const now = performance.now();
    const dt = (now - currentState.lastTime) / 1000;

    let newGain;
    if (targetGain < currentState.gain) {
        // Attack - reduce gain quickly
        newGain = currentState.gain - Math.min(currentState.gain - targetGain, dt / attack);
    } else {
        // Release - restore gain slowly
        newGain = currentState.gain + Math.min(targetGain - currentState.gain, dt / release);
    }

    activeDucking.set(trackId, { gain: newGain, lastTime: now });

    // Apply to track volume
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (track && track.setVolume) {
        const baseVolume = track.previousVolumeBeforeMute || track.volume || 0.7;
        track.setVolume(baseVolume * newGain, true);
    }
}

/**
 * Open the Auto-Ducking panel for a track
 */
export function openAutoDuckingPanel(trackId) {
    const windowId = `autoDucking_${trackId}`;
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderDuckingPanel(trackId);
        return win;
    }

    const content = document.createElement('div');
    content.id = `autoDuckingContent_${trackId}`;
    content.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';

    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, `Auto-Ducking: Track ${trackId}`, content, {
        width: 400, height: 350, minWidth: 300, minHeight: 280
    }) : null;

    if (win?.element) {
        setTimeout(() => renderDuckingPanel(trackId), 50);
    }

    return win;
}

/**
 * Render the auto-ducking panel UI
 */
function renderDuckingPanel(trackId) {
    const container = document.getElementById(`autoDuckingContent_${trackId}`);
    if (!container) return;

    const config = getDuckingConfigForTrack(trackId);
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const sourceOptions = tracks.filter(t => t.id !== trackId).map(t =>
        `<option value="${t.id}" ${config?.sourceTrackId === t.id ? 'selected' : ''}>${t.name}</option>`
    ).join('');

    container.innerHTML = `
        <div class="mb-4">
            <h3 class="text-sm font-bold mb-3 text-indigo-400">Auto-Ducking Settings</h3>
            <p class="text-xs text-gray-400 mb-3">Automatically reduce this track's volume when the source track plays.</p>
        </div>

        <div class="space-y-4">
            <div>
                <label class="block text-xs text-gray-400 mb-1">Source Track (Trigger)</label>
                <select id="duckSourceTrack" class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm">
                    <option value="">Select source track...</option>
                    ${sourceOptions}
                </select>
            </div>

            <div>
                <label class="block text-xs text-gray-400 mb-1">Threshold: <span id="thresholdVal">${config?.threshold ?? -30} dB</span></label>
                <input type="range" id="duckThreshold" min="-60" max="0" step="1" value="${config?.threshold ?? -30}"
                    class="w-full">
            </div>

            <div>
                <label class="block text-xs text-gray-400 mb-1">Reduction Amount: <span id="amountVal">${Math.round((config?.amount ?? 0.5) * 100)}%</span></label>
                <input type="range" id="duckAmount" min="0" max="100" step="1" value="${Math.round((config?.amount ?? 0.5) * 100)}"
                    class="w-full">
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs text-gray-400 mb-1">Attack: <span id="attackVal">${config?.attack ?? 0.01}s</span></label>
                    <input type="range" id="duckAttack" min="0.001" max="0.5" step="0.001" value="${config?.attack ?? 0.01}"
                        class="w-full">
                </div>
                <div>
                    <label class="block text-xs text-gray-400 mb-1">Release: <span id="releaseVal">${config?.release ?? 0.2}s</span></label>
                    <input type="range" id="duckRelease" min="0.01" max="1" step="0.01" value="${config?.release ?? 0.2}"
                        class="w-full">
                </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-gray-700">
                <span class="text-sm">Enable Ducking</span>
                <button id="duckEnabled" class="px-4 py-1 rounded text-sm ${(config?.enabled ?? true) ? 'bg-green-600' : 'bg-gray-600'}">
                    ${(config?.enabled ?? true) ? 'ON' : 'OFF'}
                </button>
            </div>
        </div>

        <div class="mt-4 flex justify-between">
            <button id="duckApplyBtn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white text-sm">
                Apply
            </button>
            <button id="duckRemoveBtn" class="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white text-sm">
                Remove
            </button>
        </div>
    `;

    // Event handlers
    const thresholdSlider = document.getElementById('duckThreshold');
    const amountSlider = document.getElementById('duckAmount');
    const attackSlider = document.getElementById('duckAttack');
    const releaseSlider = document.getElementById('duckRelease');
    const enabledBtn = document.getElementById('duckEnabled');

    thresholdSlider?.addEventListener('input', (e) => {
        document.getElementById('thresholdVal').textContent = `${e.target.value} dB`;
    });

    amountSlider?.addEventListener('input', (e) => {
        document.getElementById('amountVal').textContent = `${e.target.value}%`;
    });

    attackSlider?.addEventListener('input', (e) => {
        document.getElementById('attackVal').textContent = `${e.target.value}s`;
    });

    releaseSlider?.addEventListener('input', (e) => {
        document.getElementById('releaseVal').textContent = `${e.target.value}s`;
    });

    enabledBtn?.addEventListener('click', () => {
        const currentEnabled = duckingConfigs[trackId]?.enabled ?? true;
        setDuckingConfig(trackId, { ...duckingConfigs[trackId], enabled: !currentEnabled });
        renderDuckingPanel(trackId);
    });

    document.getElementById('duckApplyBtn')?.addEventListener('click', () => {
        const sourceTrackId = parseInt(document.getElementById('duckSourceTrack').value) || null;
        setDuckingConfig(trackId, {
            sourceTrackId,
            threshold: parseFloat(thresholdSlider?.value || -30),
            amount: parseInt(amountSlider?.value || 50) / 100,
            attack: parseFloat(attackSlider?.value || 0.01),
            release: parseFloat(releaseSlider?.value || 0.2),
            enabled: duckingConfigs[trackId]?.enabled ?? true
        });
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Auto-ducking applied', 1500);
        }
    });

    document.getElementById('duckRemoveBtn')?.addEventListener('click', () => {
        removeDuckingConfig(trackId);
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Auto-ducking removed', 1500);
        }
        const win = localAppServices.getOpenWindows?.()?.get(`autoDucking_${trackId}`);
        win?.close();
    });
}

/**
 * Save ducking configs to localStorage
 */
function saveDuckingConfigs() {
    try {
        localStorage.setItem('snugosAutoDuckingConfigs', JSON.stringify(duckingConfigs));
    } catch (e) {
        console.warn('[AutoDucking] Failed to save config:', e);
    }
}

/**
 * Load ducking configs from localStorage
 */
function loadDuckingConfigs() {
    try {
        const saved = localStorage.getItem('snugosAutoDuckingConfigs');
        if (saved) {
            duckingConfigs = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('[AutoDucking] Failed to load config:', e);
    }
}

export default {
    initAutoDucking,
    getDuckingConfigs,
    getDuckingConfigForTrack,
    setDuckingConfig,
    removeDuckingConfig,
    toggleDucking,
    processDucking,
    openAutoDuckingPanel
};