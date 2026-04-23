// js/AutoSpill.js - Auto-duplicate clips to fill timeline regions

let localAppServices = {};

/**
 * Initialize AutoSpill with app services
 * @param {Object} appServices - Application services from main.js
 */
export function initAutoSpill(appServices) {
    localAppServices = appServices || {};
}

/**
 * Opens the AutoSpill panel for the selected clip
 * @param {string} trackId - Track ID
 * @param {string} clipId - Clip ID to auto-spill
 */
export function openAutoSpillPanel(trackId, clipId) {
    const windowId = 'autoSpill';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'autoSpillContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const options = { 
        width: 420, 
        height: 380, 
        minWidth: 350, 
        minHeight: 300,
        initialContentKey: windowId,
        closable: true, 
        minimizable: true, 
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Auto-Spill', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderAutoSpillContent(trackId, clipId), 50);
    }
    return win;
}

/**
 * Renders the AutoSpill panel content
 * @param {string} trackId - Track ID
 * @param {string} clipId - Clip ID
 */
function renderAutoSpillContent(trackId, clipId) {
    const container = document.getElementById('autoSpillContent');
    if (!container) return;

    // Get track and clip info
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) {
        container.innerHTML = '<div class="text-center text-gray-400 py-4">Track not found</div>';
        return;
    }

    const clip = track.timelineClips?.find(c => c.id === clipId);
    if (!clip) {
        container.innerHTML = '<div class="text-center text-gray-400 py-4">Clip not found</div>';
        return;
    }

    // Calculate max fills based on project length
    const projectLength = localAppServices.getProjectLength?.() || 60;
    const clipDuration = clip.duration || 4;
    const maxFills = Math.floor((projectLength - clip.startTime) / clipDuration);

    container.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-semibold text-white mb-1">Auto-Spill</h3>
            <p class="text-sm text-gray-400">Auto-duplicate clips to fill timeline regions</p>
        </div>
        
        <div class="bg-slate-800 rounded p-3 mb-4 border border-slate-700">
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <span class="text-gray-400">Clip:</span>
                    <span class="text-white ml-2">${clip.name || 'Unnamed'}</span>
                </div>
                <div>
                    <span class="text-gray-400">Duration:</span>
                    <span class="text-white ml-2">${clipDuration.toFixed(2)}s</span>
                </div>
                <div>
                    <span class="text-gray-400">Start:</span>
                    <span class="text-white ml-2">${clip.startTime.toFixed(2)}s</span>
                </div>
                <div>
                    <span class="text-gray-400">Track:</span>
                    <span class="text-white ml-2">${track.name}</span>
                </div>
            </div>
        </div>

        <div class="mb-4">
            <label class="block text-sm text-gray-300 mb-2">Fill Mode</label>
            <select id="autoSpillMode" class="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm">
                <option value="fill-end">Fill to End</option>
                <option value="fill-region">Fill Region</option>
                <option value="fill-count">Fixed Count</option>
            </select>
        </div>

        <div id="fillEndSection" class="mb-4">
            <p class="text-sm text-gray-400">
                Will duplicate the clip to fill from current position to 
                <span class="text-white">${projectLength.toFixed(0)}s</span> project end.
            </p>
            <p class="text-sm text-gray-500 mt-1" id="fillEndEstimate">Est. copies: --</p>
        </div>

        <div id="fillRegionSection" class="mb-4 hidden">
            <label class="block text-sm text-gray-300 mb-2">End Time (seconds)</label>
            <input type="number" id="autoSpillEndTime" value="${projectLength.toFixed(0)}" min="${clip.startTime + clipDuration}" max="${projectLength}" step="0.1"
                class="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm">
            <p class="text-sm text-gray-500 mt-1" id="fillRegionEstimate">Est. copies: --</p>
        </div>

        <div id="fillCountSection" class="mb-4 hidden">
            <label class="block text-sm text-gray-300 mb-2">Number of Copies</label>
            <input type="number" id="autoSpillCount" value="4" min="1" max="${Math.min(maxFills, 32)}" step="1"
                class="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm">
            <p class="text-sm text-gray-500 mt-1" id="fillCountEstimate">Total clips: --</p>
        </div>

        <div class="flex items-center justify-between mt-4">
            <button id="autoSpillBtn" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium transition-colors">
                🎯 Auto-Spill
            </button>
            <button id="autoSpillCloseBtn" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors">
                Close
            </button>
        </div>

        <div id="autoSpillResult" class="mt-3 text-sm"></div>
    `;

    // Add event listeners
    const modeSelect = document.getElementById('autoSpillMode');
    const endTimeInput = document.getElementById('autoSpillEndTime');
    const countInput = document.getElementById('autoSpillCount');
    const spillBtn = document.getElementById('autoSpillBtn');
    const closeBtn = document.getElementById('autoSpillCloseBtn');

    function updateEstimates() {
        const mode = modeSelect.value;
        const endTime = parseFloat(endTimeInput.value) || projectLength;
        const count = parseInt(countInput.value) || 1;

        if (mode === 'fill-end') {
            const estCopies = Math.floor((projectLength - clip.startTime) / clipDuration) - 1;
            document.getElementById('fillEndEstimate').textContent = `Est. copies: ${Math.max(0, estCopies)}`;
        } else if (mode === 'fill-region') {
            const estCopies = Math.floor((endTime - clip.startTime) / clipDuration) - 1;
            document.getElementById('fillRegionEstimate').textContent = `Est. copies: ${Math.max(0, estCopies)}`;
        } else {
            const totalClips = 1 + count;
            document.getElementById('fillCountEstimate').textContent = `Total clips: ${totalClips}`;
        }
    }

    modeSelect.addEventListener('change', () => {
        const mode = modeSelect.value;
        document.getElementById('fillEndSection').classList.toggle('hidden', mode !== 'fill-end');
        document.getElementById('fillRegionSection').classList.toggle('hidden', mode !== 'fill-region');
        document.getElementById('fillCountSection').classList.toggle('hidden', mode !== 'fill-count');
        updateEstimates();
    });

    endTimeInput.addEventListener('input', updateEstimates);
    countInput.addEventListener('input', updateEstimates);

    updateEstimates();

    spillBtn.addEventListener('click', async () => {
        const mode = modeSelect.value;
        const endTime = parseFloat(endTimeInput.value) || projectLength;
        const count = parseInt(countInput.value) || 1;

        try {
            let result;
            
            if (mode === 'fill-end') {
                result = await performAutoSpillFillEnd(track, clip, projectLength);
            } else if (mode === 'fill-region') {
                result = await performAutoSpillFillRegion(track, clip, endTime);
            } else {
                result = await performAutoSpillCount(track, clip, count);
            }

            const resultDiv = document.getElementById('autoSpillResult');
            if (result.success) {
                resultDiv.innerHTML = `<span class="text-green-400">✅ ${result.message}</span>`;
            } else {
                resultDiv.innerHTML = `<span class="text-yellow-400">⚠️ ${result.message}</span>`;
            }

            // Update timeline if available
            if (localAppServices.renderTimeline) {
                localAppServices.renderTimeline();
            }
        } catch (error) {
            console.error('[AutoSpill] Error:', error);
            document.getElementById('autoSpillResult').innerHTML = 
                `<span class="text-red-400">❌ Error: ${error.message}</span>`;
        }
    });

    closeBtn.addEventListener('click', () => {
        const win = openWindows.get(windowId);
        if (win) win.close();
    });
}

/**
 * Perform auto-spill filling to project end
 * @param {Object} track - Track object
 * @param {Object} clip - Clip to duplicate
 * @param {number} projectEnd - Project end time
 * @returns {Object} Result with success status
 */
async function performAutoSpillFillEnd(track, clip, projectEnd) {
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(`Auto-Spill clip "${clip.name}" to fill timeline`);
    }

    const clipDuration = clip.duration;
    let currentEnd = clip.startTime + clipDuration;
    let copiesMade = 0;

    while (currentEnd + clipDuration <= projectEnd + 0.1) {
        const newClipId = `audioclip_${track.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newClip = {
            id: newClipId,
            type: clip.type,
            sourceId: clip.sourceId,
            startTime: currentEnd,
            duration: clipDuration,
            name: `${clip.name} (spill)`,
            fadeIn: clip.fadeIn || 0,
            fadeOut: clip.fadeOut || 0,
            pitchShift: clip.pitchShift || 0,
            gainEnvelope: clip.gainEnvelope ? JSON.parse(JSON.stringify(clip.gainEnvelope)) : undefined,
        };
        
        track.timelineClips.push(newClip);
        copiesMade++;
        currentEnd += clipDuration;
    }

    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Auto-Spill created ${copiesMade} copies`, 2000);
    }

    return {
        success: copiesMade > 0,
        message: copiesMade > 0 ? `Created ${copiesMade} duplicate(s)` : 'No room for additional copies'
    };
}

/**
 * Perform auto-spill filling to a specific region end
 * @param {Object} track - Track object
 * @param {Object} clip - Clip to duplicate
 * @param {number} regionEnd - Region end time
 * @returns {Object} Result with success status
 */
async function performAutoSpillFillRegion(track, clip, regionEnd) {
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(`Auto-Spill clip "${clip.name}" to region end`);
    }

    const clipDuration = clip.duration;
    const startOfFirstCopy = clip.startTime + clipDuration;
    let currentEnd = startOfFirstCopy;
    let copiesMade = 0;

    while (currentEnd + clipDuration <= regionEnd + 0.1) {
        const newClipId = `audioclip_${track.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newClip = {
            id: newClipId,
            type: clip.type,
            sourceId: clip.sourceId,
            startTime: currentEnd,
            duration: clipDuration,
            name: `${clip.name} (spill)`,
            fadeIn: clip.fadeIn || 0,
            fadeOut: clip.fadeOut || 0,
            pitchShift: clip.pitchShift || 0,
            gainEnvelope: clip.gainEnvelope ? JSON.parse(JSON.stringify(clip.gainEnvelope)) : undefined,
        };
        
        track.timelineClips.push(newClip);
        copiesMade++;
        currentEnd += clipDuration;
    }

    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Auto-Spill created ${copiesMade} copies to ${regionEnd.toFixed(1)}s`, 2000);
    }

    return {
        success: copiesMade > 0,
        message: copiesMade > 0 ? `Created ${copiesMade} duplicate(s)` : 'No room for additional copies'
    };
}

/**
 * Perform auto-spill with a fixed number of copies
 * @param {Object} track - Track object
 * @param {Object} clip - Clip to duplicate
 * @param {number} count - Number of copies to create
 * @returns {Object} Result with success status
 */
async function performAutoSpillCount(track, clip, count) {
    if (localAppServices.captureStateForUndo) {
        localAppServices.captureStateForUndo(`Auto-Spill clip "${clip.name}" x${count}`);
    }

    const clipDuration = clip.duration;
    let currentEnd = clip.startTime + clipDuration;
    const copiesToMake = Math.min(count, 32);
    let copiesMade = 0;

    for (let i = 0; i < copiesToMake; i++) {
        const newClipId = `audioclip_${track.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newClip = {
            id: newClipId,
            type: clip.type,
            sourceId: clip.sourceId,
            startTime: currentEnd,
            duration: clipDuration,
            name: `${clip.name} (spill)`,
            fadeIn: clip.fadeIn || 0,
            fadeOut: clip.fadeOut || 0,
            pitchShift: clip.pitchShift || 0,
            gainEnvelope: clip.gainEnvelope ? JSON.parse(JSON.stringify(clip.gainEnvelope)) : undefined,
        };
        
        track.timelineClips.push(newClip);
        copiesMade++;
        currentEnd += clipDuration;
    }

    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Auto-Spill created ${copiesMade} copies`, 2000);
    }

    return {
        success: copiesMade > 0,
        message: copiesMade > 0 ? `Created ${copiesMade} duplicate(s)` : 'Failed to create copies'
    };
}

/**
 * Open auto-spill for a selected clip (convenience function)
 * @param {string} trackId - Track ID
 * @param {string} clipId - Clip ID
 */
export function autoSpillSelectedClip(trackId, clipId) {
    openAutoSpillPanel(trackId, clipId);
}