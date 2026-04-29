// js/ClipGhostTrails.js - Clip Ghost Trails for visual comparison/reference
import { getTrackByIdState, getTracksState } from './state.js';

let ghostTrails = []; // { id, trackId, clipIndex, sourceClip, startPosition, opacity, color }
let ghostTrailsPanel = null;
let localAppServices = {};

export function initClipGhostTrails(appServices) {
    localAppServices = appServices || {};
    console.log('[ClipGhostTrails] Initialized');
}

export function getGhostTrails() {
    return [...ghostTrails];
}

export function addGhostTrail(trackId, clipData, startPosition, options = {}) {
    const id = `ghost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trail = {
        id,
        trackId,
        clipData: JSON.parse(JSON.stringify(clipData)),
        startPosition: parseFloat(startPosition) || 0,
        opacity: options.opacity || 0.25,
        color: options.color || '#ffffff',
        name: options.name || `Ghost ${ghostTrails.length + 1}`,
        locked: false
    };
    ghostTrails.push(trail);
    console.log(`[ClipGhostTrails] Added ghost trail: ${trail.name}`);
    return id;
}

export function removeGhostTrail(id) {
    const idx = ghostTrails.findIndex(t => t.id === id);
    if (idx !== -1) {
        ghostTrails.splice(idx, 1);
        console.log(`[ClipGhostTrails] Removed ghost trail ${id}`);
        return true;
    }
    return false;
}

export function clearAllGhostTrails() {
    ghostTrails = [];
    console.log('[ClipGhostTrails] Cleared all ghost trails');
}

export function updateGhostTrailOpacity(id, opacity) {
    const trail = ghostTrails.find(t => t.id === id);
    if (trail) {
        trail.opacity = Math.max(0.05, Math.min(0.8, parseFloat(opacity) || 0.25));
        return true;
    }
    return false;
}

export function moveGhostTrail(id, newStartPosition) {
    const trail = ghostTrails.find(t => t.id === id);
    if (trail) {
        trail.startPosition = Math.max(0, parseFloat(newStartPosition) || 0);
        return true;
    }
    return false;
}

export function createGhostFromClip(trackId, clipIndex, options = {}) {
    const track = getTrackByIdState(trackId);
    if (!track || !track.timelineClips || !track.timelineClips[clipIndex]) {
        console.warn('[ClipGhostTrails] Invalid track or clip index');
        return null;
    }
    const clipData = track.timelineClips[clipIndex];
    return addGhostTrail(trackId, clipData, clipData.start || 0, {
        name: options.name || `Ghost: ${track.name} Clip ${clipIndex + 1}`,
        color: options.color || track.color || '#ffffff',
        opacity: options.opacity || 0.25
    });
}

export function renderGhostTrailsOnCanvas(ctx, timelineTop, pixelsPerSecond, playheadPosition) {
    if (ghostTrails.length === 0) return;
    
    const tracks = getTracksState();
    const trackHeight = localAppServices.getTrackHeight ? localAppServices.getTrackHeight() : 80;
    
    ghostTrails.forEach(trail => {
        const track = tracks.find(t => t.id === trail.trackId);
        if (!track) return;
        
        const trackIndex = tracks.indexOf(track);
        const y = timelineTop + trackIndex * trackHeight;
        
        const duration = trail.clipData.duration || 4;
        const width = duration * pixelsPerSecond;
        const x = trail.startPosition * pixelsPerSecond;
        
        ctx.save();
        ctx.globalAlpha = trail.opacity;
        
        // Draw ghost clip background
        ctx.fillStyle = trail.color + '30';
        ctx.strokeStyle = trail.color;
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.roundRect(x, y + 2, width, trackHeight - 4, 4);
        ctx.fill();
        ctx.stroke();
        
        // Draw ghost clip name
        ctx.fillStyle = trail.color;
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(trail.name, x + 4, y + 14);
        
        // Draw "GHOST" label
        ctx.globalAlpha = trail.opacity * 0.6;
        ctx.fillStyle = '#888';
        ctx.font = '8px Inter, sans-serif';
        ctx.fillText('[GHOST]', x + 4, y + trackHeight - 6);
        
        ctx.restore();
    });
}

export function openGhostTrailsPanel(savedState = null) {
    if (ghostTrailsPanel && document.body.contains(ghostTrailsPanel)) {
        ghostTrailsPanel.remove();
        ghostTrailsPanel = null;
    }
    
    ghostTrailsPanel = document.createElement('div');
    ghostTrailsPanel.id = 'ghost-trails-window';
    ghostTrailsPanel.className = 'fixed bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-2xl z-[10000]';
    ghostTrailsPanel.style.cssText = `
        width: 380px;
        max-height: 500px;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        font-family: 'Inter', sans-serif;
    `;
    
    renderGhostTrailsContent();
    document.body.appendChild(ghostTrailsPanel);
    
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

function renderGhostTrailsContent() {
    if (!ghostTrailsPanel) return;
    
    const tracks = getTracksState();
    
    let trailsList = ghostTrails.map((trail, idx) => {
        const track = tracks.find(t => t.id === trail.trackId);
        const trackName = track ? track.name : `Track ${trail.trackId}`;
        return `
            <div class="ghost-trail-item flex items-center justify-between p-2 bg-[#252525] rounded mb-2 border border-[#3a3a3a]" data-id="${trail.id}">
                <div class="flex items-center gap-2 flex-1">
                    <div class="w-3 h-3 rounded" style="background-color: ${trail.color}; opacity: ${trail.opacity}"></div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm text-[#e0e0e0] truncate">${trail.name}</div>
                        <div class="text-xs text-[#888]">${trackName} @ ${trail.startPosition.toFixed(1)}s</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <input type="range" min="5" max="80" value="${Math.round(trail.opacity * 100)}" 
                        class="ghost-opacity-slider w-16 h-1 accent-blue-400 cursor-pointer" data-id="${trail.id}" title="Opacity">
                    <button class="ghost-move-btn w-6 h-6 flex items-center justify-center bg-[#2c2c2c] border border-[#4a4a4a] rounded text-[#a0a0a0] hover:text-[#e0e0e0] text-xs" data-id="${trail.id}" title="Move">M</button>
                    <button class="ghost-delete-btn w-6 h-6 flex items-center justify-center bg-[#8b1a1a] border border-[#6b1010] rounded text-[#ff9999] hover:bg-[#a02020] text-lg leading-none" data-id="${trail.id}" title="Remove">&times;</button>
                </div>
            </div>
        `;
    }).join('');
    
    if (ghostTrails.length === 0) {
        trailsList = `
            <div class="text-center py-6 text-[#666]">
                <div class="text-2xl mb-2">👻</div>
                <div class="text-sm">No ghost trails yet</div>
                <div class="text-xs mt-1">Select a clip and add it as a ghost for reference</div>
            </div>
        `;
    }
    
    ghostTrailsPanel.innerHTML = `
        <div class="flex items-center justify-between p-3 border-b border-[#3a3a3a] bg-[#252525] rounded-t-lg">
            <h3 class="text-sm font-semibold text-[#e0e0e0] m-0">👻 Clip Ghost Trails</h3>
            <button id="close-ghost-trails-btn" class="w-6 h-6 flex items-center justify-center bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[#a0a0a0] hover:text-[#e0e0e0] hover:bg-[#333] text-lg leading-none">&times;</button>
        </div>
        <div class="p-3 flex-1 overflow-y-auto" id="ghost-trails-list">
            ${trailsList}
        </div>
        <div class="p-3 border-t border-[#3a3a3a] bg-[#252525] rounded-b-lg">
            <div class="flex items-center gap-2">
                <span class="text-xs text-[#888]">Add current clip as ghost:</span>
                <button id="add-ghost-from-selection" class="px-3 py-1 text-xs font-medium bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded border border-[#2563eb]">+ Add Selected Clip</button>
            </div>
            ${ghostTrails.length > 0 ? '<div class="mt-2 flex justify-end"><button id="clear-all-ghosts" class="px-3 py-1 text-xs bg-[#8b1a1a] hover:bg-[#a02020] text-[#ff9999] rounded border border-[#6b1010]">Clear All Ghosts</button></div>' : ''}
        </div>
    `;
    
    // Attach event listeners
    const closeBtn = ghostTrailsPanel.querySelector('#close-ghost-trails-btn');
    closeBtn.addEventListener('click', closeGhostTrailsPanel);
    
    const clearAllBtn = ghostTrailsPanel.querySelector('#clear-all-ghosts');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            clearAllGhostTrails();
            renderGhostTrailsContent();
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        });
    }
    
    const addGhostBtn = ghostTrailsPanel.querySelector('#add-ghost-from-selection');
    if (addGhostBtn) {
        addGhostBtn.addEventListener('click', () => {
            addSelectedClipAsGhost();
        });
    }
    
    // Opacity sliders
    ghostTrailsPanel.querySelectorAll('.ghost-opacity-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const id = e.target.dataset.id;
            updateGhostTrailOpacity(id, e.target.value / 100);
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        });
    });
    
    // Delete buttons
    ghostTrailsPanel.querySelectorAll('.ghost-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.ghost-delete-btn').dataset.id;
            removeGhostTrail(id);
            renderGhostTrailsContent();
            if (localAppServices.renderTimeline) localAppServices.renderTimeline();
        });
    });
    
    // Move buttons
    ghostTrailsPanel.querySelectorAll('.ghost-move-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.closest('.ghost-move-btn').dataset.id;
            const newPos = prompt('Enter new start position (seconds):', '0');
            if (newPos !== null) {
                moveGhostTrail(id, parseFloat(newPos));
                renderGhostTrailsContent();
                if (localAppServices.renderTimeline) localAppServices.renderTimeline();
            }
        });
    });
}

function addSelectedClipAsGhost() {
    const tracks = getTracksState();
    for (const track of tracks) {
        if (track.timelineClips && track.timelineClips.length > 0) {
            for (let i = 0; i < track.timelineClips.length; i++) {
                const clip = track.timelineClips[i];
                if (clip.selected) {
                    createGhostFromClip(track.id, i, {
                        name: `Ghost: ${clip.name || track.name + ' Clip'}`
                    });
                    renderGhostTrailsContent();
                    if (localAppServices.renderTimeline) localAppServices.renderTimeline();
                    return;
                }
            }
        }
    }
    console.log('[ClipGhostTrails] No selected clip found to add as ghost');
}

function handleOutsideClick(e) {
    if (ghostTrailsPanel && !ghostTrailsPanel.contains(e.target) && 
        !e.target.id?.includes('menuAddGhostTrail')) {
        closeGhostTrailsPanel();
    }
}

export function closeGhostTrailsPanel() {
    if (ghostTrailsPanel) {
        ghostTrailsPanel.remove();
        ghostTrailsPanel = null;
        document.removeEventListener('click', handleOutsideClick);
    }
}

export function getGhostTrailCount() {
    return ghostTrails.length;
}

export function exportGhostTrailsData() {
    return ghostTrails.map(t => ({
        id: t.id,
        trackId: t.trackId,
        clipData: t.clipData,
        startPosition: t.startPosition,
        opacity: t.opacity,
        color: t.color,
        name: t.name
    }));
}

export function importGhostTrailsData(data) {
    if (!Array.isArray(data)) return false;
    ghostTrails = data.map(t => ({
        id: t.id || `ghost_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        trackId: t.trackId,
        clipData: t.clipData,
        startPosition: t.startPosition || 0,
        opacity: t.opacity || 0.25,
        color: t.color || '#ffffff',
        name: t.name || 'Imported Ghost'
    }));
    console.log(`[ClipGhostTrails] Imported ${ghostTrails.length} ghost trails`);
    return true;
}