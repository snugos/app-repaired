// js/BatchClipRename.js - Batch Clip Renaming
// Bulk rename clips using pattern templates

/**
 * BatchClipRename - Rename multiple clips at once using patterns
 */
export class BatchClipRename {
    constructor() {
        this.patterns = [
            { id: 'counter', name: 'Counter', template: 'Clip {n}', example: 'Clip 1, Clip 2...' },
            { id: 'track_clip', name: 'Track + Clip', template: '{track} Clip {n}', example: 'Drums Clip 1...' },
            { id: 'date_counter', name: 'Date + Counter', template: '{date}_{n}', example: '2026-04-23_1...' },
            { id: 'prefix', name: 'Custom Prefix', template: '{prefix}_{n}', example: 'MyClip_1...' },
            { id: 'numbered', name: 'Numbered', template: '{n03}', example: '001, 002, 003...' }
        ];
        this.selectedClips = [];
    }

    /**
     * Get available patterns
     * @returns {Array}
     */
    getPatterns() {
        return this.patterns;
    }

    /**
     * Preview rename results without applying
     * @param {Array} clips - Clips to rename
     * @param {string} pattern - Pattern template
     * @param {Object} options - Additional options
     * @returns {Array} Preview of new names
     */
    previewRename(clips, pattern, options = {}) {
        const results = [];
        const trackName = options.trackName || 'Track';
        const prefix = options.prefix || 'Clip';
        const date = new Date().toISOString().split('T')[0];
        
        clips.forEach((clip, index) => {
            const n = index + 1;
            const n02 = n.toString().padStart(2, '0');
            const n03 = n.toString().padStart(3, '0');
            
            let newName = pattern
                .replace('{n}', n.toString())
                .replace('{n02}', n02)
                .replace('{n03}', n03)
                .replace('{track}', trackName)
                .replace('{prefix}', prefix)
                .replace('{date}', date)
                .replace('{old}', clip.name || '');
            
            results.push({
                clipId: clip.id,
                oldName: clip.name || '',
                newName: newName
            });
        });
        
        return results;
    }

    /**
     * Apply rename to clips
     * @param {Array} clips - Clips to rename
     * @param {string} pattern - Pattern template
     * @param {Object} options - Additional options
     * @returns {Array} List of renamed clips
     */
    applyRename(clips, pattern, options = {}) {
        const preview = this.previewRename(clips, pattern, options);
        const renamed = [];
        
        preview.forEach(result => {
            const clip = clips.find(c => c.id === result.clipId);
            if (clip) {
                clip.name = result.newName;
                renamed.push(clip);
            }
        });
        
        return renamed;
    }
}

// Export singleton
export const batchClipRename = new BatchClipRename();

// --- UI Panel ---

/**
 * Open the Batch Clip Rename panel
 */
export function openBatchRenamePanel() {
    const windowId = 'batchRenamePanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'batchRenameContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const win = localAppServices.createWindow(windowId, 'Batch Rename', contentContainer, {
        width: 450,
        height: 500,
        minWidth: 350,
        minHeight: 400,
        closable: true,
        minimizable: true,
        resizable: true
    });

    if (win?.element) {
        renderBatchRenameContent();
    }
    return win;
}

/**
 * Render batch rename panel content
 */
function renderBatchRenameContent() {
    const container = document.getElementById('batchRenameContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const allClips = [];
    tracks.forEach(track => {
        (track.timelineClips || []).forEach(clip => {
            allClips.push({ ...clip, trackName: track.name, trackId: track.id });
        });
    });

    container.innerHTML = `
        <div class="mb-3">
            <label class="block text-sm text-gray-400 mb-1">Rename Pattern</label>
            <select id="renamePattern" class="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white">
                <option value="Clip {n}">Clip {n} (Clip 1, Clip 2...)</option>
                <option value="{track} Clip {n}">{track} Clip {n} (Drums Clip 1...)</option>
                <option value="{date}_{n}">{date}_{n} (2026-04-23_1...)</option>
                <option value="custom">Custom...</option>
            </select>
        </div>
        <div class="mb-3 hidden" id="customPatternContainer">
            <label class="block text-sm text-gray-400 mb-1">Custom Pattern</label>
            <input type="text" id="customPattern" placeholder="{track} {n03}" 
                class="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white">
            <div class="text-xs text-gray-500 mt-1">
                Use: {n}, {n02}, {n03}, {track}, {prefix}, {date}, {old}
            </div>
        </div>
        <div class="mb-3">
            <label class="block text-sm text-gray-400 mb-1">Clips to Rename</label>
            <div class="text-xs text-gray-500 mb-2" id="selectedCount">0 clips selected</div>
            <div id="clipSelectList" class="max-h-40 overflow-y-auto bg-gray-800 rounded p-2 space-y-1">
                ${allClips.length === 0 ? '<div class="text-gray-500 text-sm">No clips available</div>' : ''}
            </div>
        </div>
        <div class="mb-3">
            <label class="flex items-center gap-2 text-sm text-gray-400">
                <input type="checkbox" id="selectAllClips" class="w-4 h-4">
                Select All Clips
            </label>
        </div>
        <div class="flex-1 overflow-y-auto mb-3" id="previewArea">
            <div class="text-sm text-gray-400 mb-2">Preview:</div>
            <div id="previewList" class="space-y-1 text-xs font-mono"></div>
        </div>
        <div class="flex gap-2">
            <button id="applyRenameBtn" class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50" disabled>
                Apply Rename
            </button>
            <button id="cancelRenameBtn" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">
                Cancel
            </button>
        </div>
    `;

    // Store clips reference
    container._allClips = allClips;
    
    // Event listeners
    document.getElementById('renamePattern')?.addEventListener('change', (e) => {
        const customContainer = document.getElementById('customPatternContainer');
        if (e.target.value === 'custom') {
            customContainer?.classList.remove('hidden');
        } else {
            customContainer?.classList.add('hidden');
        }
        updatePreview();
    });

    document.getElementById('selectAllClips')?.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.clip-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateSelectedCount();
        updatePreview();
    });

    document.getElementById('applyRenameBtn')?.addEventListener('click', applyRename);
    document.getElementById('cancelRenameBtn')?.addEventListener('click', () => {
        const win = localAppServices.getOpenWindows?.()?.get('batchRenamePanel');
        win?.close();
    });

    // Render clip list
    renderClipSelectList(allClips);
}

function renderClipSelectList(clips) {
    const list = document.getElementById('clipSelectList');
    if (!list) return;

    if (clips.length === 0) {
        list.innerHTML = '<div class="text-gray-500 text-sm">No clips available</div>';
        return;
    }

    list.innerHTML = clips.slice(0, 50).map((clip, i) => `
        <label class="flex items-center gap-2 p-1 hover:bg-gray-700 rounded cursor-pointer">
            <input type="checkbox" class="clip-checkbox w-4 h-4" data-id="${clip.id}" data-track="${clip.trackName}">
            <span class="text-white text-sm truncate">${escapeHtml(clip.name || `Clip ${i + 1}`)}</span>
            <span class="text-gray-500 text-xs">(${escapeHtml(clip.trackName)})</span>
        </label>
    `).join('');

    if (clips.length > 50) {
        list.innerHTML += `<div class="text-gray-500 text-xs mt-2">...and ${clips.length - 50} more</div>`;
    }

    // Add checkbox listeners
    list.querySelectorAll('.clip-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            updateSelectedCount();
            updatePreview();
        });
    });

    updateSelectedCount();
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.clip-checkbox:checked');
    const countEl = document.getElementById('selectedCount');
    if (countEl) {
        countEl.textContent = `${checkboxes.length} clip${checkboxes.length !== 1 ? 's' : ''} selected`;
    }
    const applyBtn = document.getElementById('applyRenameBtn');
    if (applyBtn) {
        applyBtn.disabled = checkboxes.length === 0;
    }
}

function updatePreview() {
    const container = document.getElementById('batchRenameContent');
    if (!container) return;

    const patternSelect = document.getElementById('renamePattern');
    const customPattern = document.getElementById('customPattern');
    const pattern = patternSelect?.value === 'custom' ? (customPattern?.value || 'Clip {n}') : patternSelect?.value || 'Clip {n}';
    
    const selectedClips = [];
    document.querySelectorAll('.clip-checkbox:checked').forEach(cb => {
        const clip = container._allClips?.find(c => c.id == cb.dataset.id);
        if (clip) selectedClips.push(clip);
    });

    const previewList = document.getElementById('previewList');
    if (!previewList) return;

    if (selectedClips.length === 0) {
        previewList.innerHTML = '<div class="text-gray-500">Select clips to preview</div>';
        return;
    }

    const preview = batchClipRename.previewRename(selectedClips, pattern, {
        trackName: 'Track'
    });

    previewList.innerHTML = preview.map(p => `
        <div class="flex items-center gap-2">
            <span class="text-gray-500">${escapeHtml(p.oldName)}</span>
            <span class="text-gray-600">→</span>
            <span class="text-green-400">${escapeHtml(p.newName)}</span>
        </div>
    `).join('');
}

function applyRename() {
    const container = document.getElementById('batchRenameContent');
    if (!container) return;

    const patternSelect = document.getElementById('renamePattern');
    const customPattern = document.getElementById('customPattern');
    const pattern = patternSelect?.value === 'custom' ? (customPattern?.value || 'Clip {n}') : patternSelect?.value || 'Clip {n}';

    const selectedClips = [];
    document.querySelectorAll('.clip-checkbox:checked').forEach(cb => {
        const clip = container._allClips?.find(c => c.id == cb.dataset.id);
        if (clip) selectedClips.push(clip);
    });

    if (selectedClips.length === 0) return;

    // Apply rename
    const renamed = batchClipRename.applyRename(selectedClips, pattern, {});
    
    // Update track clips
    renamed.forEach(renamedClip => {
        const track = localAppServices.getTracks?.().find(t => t.id === renamedClip.trackId);
        if (track) {
            const clip = track.timelineClips?.find(c => c.id === renamedClip.id);
            if (clip) {
                clip.name = renamedClip.name;
            }
        }
    });

    localAppServices.showNotification?.(`${renamed.length} clip(s) renamed`, 2000);
    
    // Refresh timeline
    if (localAppServices.renderTimeline) {
        localAppServices.renderTimeline();
    }

    // Close panel
    const win = localAppServices.getOpenWindows?.()?.get('batchRenamePanel');
    win?.close();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
