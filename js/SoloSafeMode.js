/**
 * Track Solo Safe Mode
 * Prevents a track's solo state from being accidentally toggled off
 * When a track's solo is "locked", clicking solo on other tracks won't affect it
 */

let localAppServices = {};

/**
 * Initialize Solo Safe Mode module
 * @param {object} services - App services
 */
export function initSoloSafeMode(services) {
    localAppServices = services;
    console.log('[SoloSafeMode] Initialized');
}

/**
 * Toggle solo lock on a track
 * @param {number} trackId - Track ID
 * @returns {boolean} New lock state
 */
export function toggleSoloLock(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.error('[SoloSafeMode] Track not found:', trackId);
        return false;
    }

    if (track.soloLocked === undefined) {
        track.soloLocked = false;
    }

    track.soloLocked = !track.soloLocked;
    
    console.log(`[SoloSafeMode] Track "${track.name}" solo lock: ${track.soloLocked ? 'LOCKED' : 'UNLOCKED'}`);
    
    // Update UI
    localAppServices.updateTrackUI?.(trackId, 'soloLockChanged');
    
    return track.soloLocked;
}

/**
 * Set solo lock state on a track
 * @param {number} trackId - Track ID
 * @param {boolean} locked - Lock state
 */
export function setSoloLock(trackId, locked) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.error('[SoloSafeMode] Track not found:', trackId);
        return false;
    }

    track.soloLocked = !!locked;
    localAppServices.updateTrackUI?.(trackId, 'soloLockChanged');
    
    return track.soloLocked;
}

/**
 * Check if a track's solo is locked
 * @param {number} trackId - Track ID
 * @returns {boolean} Is solo locked
 */
export function isSoloLocked(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    return track?.soloLocked || false;
}

/**
 * Check if a track can be unsoloed (considering lock state)
 * Called from solo handlers to determine if a track's solo can be toggled
 * @param {number} trackId - Track ID
 * @param {boolean} attemptingUnsolo - True if trying to turn solo OFF
 * @returns {boolean} True if the solo state change is allowed
 */
export function canToggleSolo(trackId, attemptingUnsolo = true) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return false;

    // If trying to unsolo and track is locked, deny
    if (attemptingUnsolo && track.soloLocked && track.isSoloed) {
        console.log(`[SoloSafeMode] Solo for track "${track.name}" is locked`);
        return false;
    }

    return true;
}

/**
 * Lock all soloed tracks (prevents any track from being unsoloed)
 */
export function lockAllSolos() {
    const tracks = localAppServices.getTracks?.() || [];
    tracks.forEach(track => {
        if (track.isSoloed) {
            track.soloLocked = true;
            localAppServices.updateTrackUI?.(track.id, 'soloLockChanged');
        }
    });
    console.log('[SoloSafeMode] All soloed tracks locked');
}

/**
 * Unlock all soloed tracks
 */
export function unlockAllSolos() {
    const tracks = localAppServices.getTracks?.() || [];
    tracks.forEach(track => {
        track.soloLocked = false;
        localAppServices.updateTrackUI?.(track.id, 'soloLockChanged');
    });
    console.log('[SoloSafeMode] All soloed tracks unlocked');
}

/**
 * Create the solo lock button for track header
 * @param {object} track - Track object
 * @returns {HTMLElement} Button element
 */
export function createSoloLockButton(track) {
    const btn = document.createElement('button');
    btn.className = 'solo-lock-btn';
    btn.title = track.soloLocked ? 'Solo Locked - Click to Unlock' : 'Click to Lock Solo';
    
    updateSoloLockButtonAppearance(btn, track.soloLocked);
    
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSoloLock(track.id);
    });

    return btn;
}

/**
 * Update solo lock button appearance
 * @param {HTMLElement} btn - Button element
 * @param {boolean} locked - Lock state
 */
export function updateSoloLockButtonAppearance(btn, locked) {
    if (locked) {
        btn.textContent = '🔒';
        btn.classList.add('locked');
        btn.style.color = '#f59e0b'; // amber
    } else {
        btn.textContent = '🔓';
        btn.classList.remove('locked');
        btn.style.color = '#6b7280'; // gray
    }
}

/**
 * Open Solo Safe Mode settings panel
 */
export function openSoloSafeModePanel() {
    const windowId = 'soloSafeModePanel';
    const openWindows = localAppServices.getOpenWindows?.() || new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'soloSafeModeContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white';

    const win = localAppServices.createWindow?.(windowId, 'Track Solo Safe Mode', contentContainer, {
        width: 400,
        height: 350,
        minWidth: 300,
        minHeight: 250,
        closable: true,
        minimizable: true,
        resizable: true
    });

    if (win?.element) {
        setTimeout(() => renderSoloSafeModeContent(), 50);
    }

    return win;
}

/**
 * Render solo safe mode panel content
 */
function renderSoloSafeModeContent() {
    const container = document.getElementById('soloSafeModeContent');
    if (!container) return;

    const tracks = localAppServices.getTracks?.() || [];
    const soloedTracks = tracks.filter(t => t.isSoloed);

    container.innerHTML = `
        <div class="mb-4 text-sm text-gray-400">
            Solo Safe Mode prevents tracks from being accidentally unsoloed. 
            Lock a track's solo to keep it playing while you check other tracks.
        </div>
        
        <div class="mb-4 flex gap-2">
            <button id="lockAllBtn" class="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded">
                🔒 Lock All Soloed
            </button>
            <button id="unlockAllBtn" class="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded">
                🔓 Unlock All
            </button>
        </div>
        
        <div class="text-xs text-gray-500 mb-2">Tracks with Solo Active:</div>
        <div id="soloedTracksList" class="flex-1 overflow-y-auto space-y-1">
            ${soloedTracks.length === 0 ? '<div class="text-gray-500 text-sm">No tracks soloed</div>' : ''}
        </div>
    `;

    // Render soloed tracks
    const listContainer = container.querySelector('#soloedTracksList');
    if (soloedTracks.length > 0) {
        listContainer.innerHTML = soloedTracks.map(track => `
            <div class="flex items-center justify-between p-2 bg-gray-800 rounded border border-gray-700">
                <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded" style="background: ${track.color || '#666'}"></span>
                    <span class="text-sm text-white">${track.name}</span>
                </div>
                <button class="solo-lock-toggle px-3 py-1 text-xs ${track.soloLocked ? 'bg-amber-600' : 'bg-gray-600'} text-white rounded" 
                    data-track-id="${track.id}">
                    ${track.soloLocked ? '🔒 Locked' : '🔓 Unlocked'}
                </button>
            </div>
        `).join('');

        // Add click handlers
        listContainer.querySelectorAll('.solo-lock-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const tid = parseInt(btn.dataset.trackId, 10);
                toggleSoloLock(tid);
                renderSoloSafeModeContent();
                localAppServices.showNotification?.(
                    isSoloLocked(tid) ? 'Solo locked' : 'Solo unlocked', 
                    1500
                );
            });
        });
    }

    // Button handlers
    container.querySelector('#lockAllBtn')?.addEventListener('click', () => {
        lockAllSolos();
        renderSoloSafeModeContent();
        localAppServices.showNotification?.('All soloed tracks locked', 1500);
    });

    container.querySelector('#unlockAllBtn')?.addEventListener('click', () => {
        unlockAllSolos();
        renderSoloSafeModeContent();
        localAppServices.showNotification?.('All solo locks released', 1500);
    });
}

// Auto-initialize
console.log('[SoloSafeMode] Module loaded');