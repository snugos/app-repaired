/**
 * js/ClipLoopStretch.js - Non-destructively loop and stretch audio clips
 * Allows previewing different loop counts and stretch factors without modifying original audio
 */

let localAppServices = {};
let activeStretchPanel = null;

/**
 * Initialize the Clip Loop Stretch module
 * @param {Object} appServices - App services from main.js
 */
export function initClipLoopStretch(appServices) {
    localAppServices = appServices || {};
    console.log('[ClipLoopStretch] Module initialized');
}

/**
 * Open the loop stretch panel for a clip
 * @param {number} trackId - Track ID
 * @param {string} clipId - Clip ID
 */
export function openLoopStretchPanel(trackId, clipId) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        console.error('[ClipLoopStretch] Track not found:', trackId);
        return;
    }

    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) {
        console.error('[ClipLoopStretch] Clip not found:', clipId);
        return;
    }

    // Remove existing panel
    closeLoopStretchPanel();

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'loopStretchPanel';
    panel.className = 'fixed bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-4 z-[10000]';
    panel.style.minWidth = '300px';
    panel.style.maxWidth = '400px';

    // Get current values
    const loopCount = clip.loopCount || 1;
    const stretchFactor = clip.stretchFactor || 1.0;
    const originalDuration = clip.duration || 1;
    const previewDuration = originalDuration * stretchFactor * loopCount;

    panel.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-white font-semibold">Loop & Stretch</h3>
            <button id="closeLoopStretchPanel" class="text-gray-400 hover:text-white">✕</button>
        </div>
        
        <div class="space-y-4">
            <!-- Loop Count -->
            <div>
                <label class="text-gray-300 text-sm mb-1 block">Loop Count: <span id="loopCountValue">${loopCount}</span>x</label>
                <input type="range" id="loopCountSlider" min="1" max="8" value="${loopCount}" class="w-full">
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1x</span>
                    <span>8x</span>
                </div>
            </div>
            
            <!-- Stretch Factor -->
            <div>
                <label class="text-gray-300 text-sm mb-1 block">Stretch: <span id="stretchValue">${stretchFactor.toFixed(2)}</span>x</label>
                <input type="range" id="stretchSlider" min="0.5" max="2.0" step="0.05" value="${stretchFactor}" class="w-full">
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0.5x</span>
                    <span>2.0x</span>
                </div>
            </div>
            
            <!-- Preview Duration -->
            <div class="bg-gray-800 rounded p-2">
                <div class="text-gray-400 text-xs">Preview Duration</div>
                <div class="text-green-400 text-lg font-mono"><span id="previewDuration">${previewDuration.toFixed(2)}</span>s</div>
            </div>
            
            <!-- Original vs Stretched -->
            <div class="flex justify-between text-xs">
                <span class="text-gray-500">Original: ${originalDuration.toFixed(2)}s</span>
                <span class="text-gray-500">Stretch: ${(stretchFactor * originalDuration).toFixed(2)}s</span>
            </div>
            
            <!-- Apply Button -->
            <button id="applyLoopStretch" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium">
                Apply
            </button>
            
            <!-- Reset Button -->
            <button id="resetLoopStretch" class="w-full bg-gray-700 hover:bg-gray-600 text-white py-1 rounded text-sm">
                Reset to Original
            </button>
        </div>
    `;

    // Position near the clip or center screen
    panel.style.left = '50%';
    panel.style.top = '50%';
    panel.style.transform = 'translate(-50%, -50%)';

    document.body.appendChild(panel);
    activeStretchPanel = panel;

    // Event handlers
    document.getElementById('closeLoopStretchPanel').onclick = closeLoopStretchPanel;
    
    document.getElementById('loopCountSlider').oninput = (e) => {
        const newCount = parseInt(e.target.value);
        document.getElementById('loopCountValue').textContent = newCount;
        updatePreviewDuration(originalDuration, stretchFactor, newCount);
    };
    
    document.getElementById('stretchSlider').oninput = (e) => {
        const newStretch = parseFloat(e.target.value);
        document.getElementById('stretchValue').textContent = newStretch.toFixed(2);
        updatePreviewDuration(originalDuration, newStretch, loopCount);
    };
    
    document.getElementById('applyLoopStretch').onclick = () => {
        const loopCountVal = parseInt(document.getElementById('loopCountSlider').value);
        const stretchVal = parseFloat(document.getElementById('stretchSlider').value);
        applyLoopStretch(trackId, clipId, loopCountVal, stretchVal);
    };
    
    document.getElementById('resetLoopStretch').onclick = () => {
        document.getElementById('loopCountSlider').value = 1;
        document.getElementById('loopCountValue').textContent = '1';
        document.getElementById('stretchSlider').value = 1.0;
        document.getElementById('stretchValue').textContent = '1.00';
        updatePreviewDuration(originalDuration, 1.0, 1);
    };

    console.log('[ClipLoopStretch] Panel opened for clip:', clipId);
}

/**
 * Update preview duration display
 */
function updatePreviewDuration(originalDuration, stretchFactor, loopCount) {
    const stretchedDuration = originalDuration * stretchFactor;
    const totalDuration = stretchedDuration * loopCount;
    document.getElementById('previewDuration').textContent = totalDuration.toFixed(2);
}

/**
 * Apply loop stretch to clip
 */
function applyLoopStretch(trackId, clipId, loopCount, stretchFactor) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return;

    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) return;

    // Store original values if not already stored
    if (clip.originalDuration === undefined) {
        clip.originalDuration = clip.duration;
    }
    if (clip.originalStretchFactor === undefined) {
        clip.originalStretchFactor = 1.0;
    }

    // Apply stretch settings
    clip.loopCount = loopCount;
    clip.stretchFactor = stretchFactor;
    clip.stretchedDuration = clip.originalDuration * stretchFactor;
    clip.duration = clip.stretchedDuration * loopCount;

    console.log('[ClipLoopStretch] Applied:', { loopCount, stretchFactor, duration: clip.duration });
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Loop: ${loopCount}x, Stretch: ${stretchFactor.toFixed(2)}x applied`, 2000);
    }

    // Update track UI
    if (localAppServices.renderTrack) {
        localAppServices.renderTrack(trackId);
    }

    closeLoopStretchPanel();
}

/**
 * Close the loop stretch panel
 */
export function closeLoopStretchPanel() {
    if (activeStretchPanel) {
        activeStretchPanel.remove();
        activeStretchPanel = null;
    }
}

/**
 * Get loop stretch info for a clip
 */
export function getLoopStretchInfo(clip) {
    if (!clip) return null;
    return {
        loopCount: clip.loopCount || 1,
        stretchFactor: clip.stretchFactor || 1.0,
        originalDuration: clip.originalDuration || clip.duration,
        stretchedDuration: clip.stretchedDuration || clip.duration,
        isModified: clip.loopCount > 1 || clip.stretchFactor !== 1.0
    };
}

/**
 * Reset a clip to its original state
 */
export function resetClipLoopStretch(trackId, clipId) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return;

    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) return;

    if (clip.originalDuration !== undefined) {
        clip.duration = clip.originalDuration;
    }
    clip.loopCount = 1;
    clip.stretchFactor = 1.0;
    clip.stretchedDuration = clip.duration;

    console.log('[ClipLoopStretch] Reset clip:', clipId);

    if (localAppServices.renderTrack) {
        localAppServices.renderTrack(trackId);
    }
}