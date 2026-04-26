// js/ClipGainEnvelopeEditor.js - Visual envelope editor for clip-level volume automation
// Feature: Clip Gain Envelope Editor - Drawable curves for volume automation

let localAppServices = {};
let selectedTrackId = null;
let selectedClipId = null;
let envelopeCanvas = null;
let envelopeCtx = null;
let isDraggingPoint = false;
let dragPointIndex = -1;
let dragPointOriginalValue = 0;

/**
 * Initialize the Clip Gain Envelope Editor
 * @param {object} services - App services
 */
export function initClipGainEnvelopeEditor(services) {
    localAppServices = services;
    console.log('[ClipGainEnvelopeEditor] Initialized');
}

/**
 * Open the Clip Gain Envelope Editor panel
 */
export function openClipGainEnvelopeEditorPanel() {
    const windowId = 'clipGainEnvelopeEditor';
    
    if (localAppServices.getOpenWindows) {
        const openWindows = localAppServices.getOpenWindows();
        if (openWindows.has(windowId)) {
            const win = openWindows.get(windowId);
            win.restore();
            updateClipList();
            return win;
        }
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'clipGainEnvelopeEditorContent';
    contentContainer.className = 'p-4 bg-gray-900 text-white h-full flex flex-col';
    
    const options = {
        width: 700,
        height: 450,
        minWidth: 500,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow?.(windowId, 'Clip Gain Envelope Editor', contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderEnvelopeEditorContent(), 50);
    }
    
    return win;
}

/**
 * Render the envelope editor content
 */
function renderEnvelopeEditorContent() {
    const container = document.getElementById('clipGainEnvelopeEditorContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracks?.() || [];
    const trackOptions = tracks.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    
    let html = `
        <div class="flex gap-4 mb-4">
            <div class="flex-1">
                <label class="block text-xs text-gray-400 mb-1">Track</label>
                <select id="envelopeTrackSelect" class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm">
                    <option value="">-- Select Track --</option>
                    ${trackOptions}
                </select>
            </div>
            <div class="flex-1">
                <label class="block text-xs text-gray-400 mb-1">Clip</label>
                <select id="envelopeClipSelect" class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm" disabled>
                    <option value="">-- Select Clip --</option>
                </select>
            </div>
        </div>
        
        <div class="flex items-center gap-4 mb-3 text-sm">
            <button id="addPointBtn" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white" disabled>
                + Add Point
            </button>
            <button id="clearEnvelopeBtn" class="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white" disabled>
                Clear Envelope
            </button>
            <div class="flex items-center gap-2 ml-auto">
                <label class="text-xs text-gray-400">Gain Range:</label>
                <select id="gainRangeSelect" class="p-1 bg-gray-800 border border-gray-600 rounded text-white text-xs">
                    <option value="0,1">0 - 1 (0 dB)</option>
                    <option value="0,2">0 - 2 (+6 dB)</option>
                    <option value="-1,1">-1 - 1</option>
                </select>
            </div>
        </div>
        
        <div id="envelopeCanvasContainer" class="flex-1 bg-black rounded border border-gray-700 relative overflow-hidden" style="min-height: 200px;">
            <canvas id="envelopeCanvas" class="w-full h-full"></canvas>
            <div id="envelopeHelpText" class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm pointer-events-none">
                Select a track and clip to edit gain envelope
            </div>
        </div>
        
        <div class="flex items-center justify-between mt-3 text-xs text-gray-400">
            <span>Start</span>
            <span>Time</span>
            <span>End</span>
        </div>
        
        <div class="mt-2 p-2 bg-gray-800 rounded text-xs">
            <span class="text-gray-400">Tips: </span>
            <span class="text-gray-300">Click on the envelope line to add points. Drag points to adjust. Double-click to remove a point.</span>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Event listeners
    const trackSelect = container.querySelector('#envelopeTrackSelect');
    const clipSelect = container.querySelector('#envelopeClipSelect');
    const addPointBtn = container.querySelector('#addPointBtn');
    const clearBtn = container.querySelector('#clearEnvelopeBtn');
    
    trackSelect?.addEventListener('change', () => {
        selectedTrackId = trackSelect.value ? parseInt(trackSelect.value, 10) : null;
        updateClipList();
    });
    
    clipSelect?.addEventListener('change', () => {
        selectedClipId = clipSelect.value;
        addPointBtn.disabled = !selectedClipId;
        clearBtn.disabled = !selectedClipId;
        loadEnvelope();
    });
    
    addPointBtn?.addEventListener('click', () => {
        if (selectedTrackId && selectedClipId) {
            const track = getSelectedTrack();
            if (track) {
                // Add point at 50% of clip duration with default value
                const clip = track.timelineClips?.find(c => c.id === selectedClipId);
                if (clip) {
                    const time = (clip.duration || 4) / 2;
                    track.addClipGainEnvelopePoint(selectedClipId, time, 0.7);
                    loadEnvelope();
                }
            }
        }
    });
    
    clearBtn?.addEventListener('click', () => {
        if (selectedTrackId && selectedClipId) {
            const track = getSelectedTrack();
            if (track) {
                track.clearClipGainEnvelope(selectedClipId);
                loadEnvelope();
            }
        }
    });
    
    // Initialize canvas
    envelopeCanvas = container.querySelector('#envelopeCanvas');
    if (envelopeCanvas) {
        envelopeCtx = envelopeCanvas.getContext('2d');
        resizeEnvelopeCanvas();
        
        envelopeCanvas.addEventListener('mousedown', handleCanvasMouseDown);
        envelopeCanvas.addEventListener('mousemove', handleCanvasMouseMove);
        envelopeCanvas.addEventListener('mouseup', handleCanvasMouseUp);
        envelopeCanvas.addEventListener('dblclick', handleCanvasDoubleClick);
        
        window.addEventListener('resize', resizeEnvelopeCanvas);
    }
}

/**
 * Update the clip dropdown based on selected track
 */
function updateClipList() {
    const container = document.getElementById('clipGainEnvelopeEditorContent');
    const clipSelect = container?.querySelector('#envelopeClipSelect');
    if (!clipSelect) return;
    
    clipSelect.innerHTML = '<option value="">-- Select Clip --</option>';
    clipSelect.disabled = true;
    selectedClipId = null;
    
    if (!selectedTrackId) {
        document.getElementById('envelopeHelpText')?.classList.remove('hidden');
        clearEnvelopeDisplay();
        return;
    }
    
    const track = getSelectedTrack();
    if (track && track.timelineClips && track.timelineClips.length > 0) {
        track.timelineClips.forEach(clip => {
            const option = document.createElement('option');
            option.value = clip.id;
            option.textContent = `${clip.name || clip.id.slice(-4)} (${(clip.duration || 0).toFixed(1)}s)`;
            clipSelect.appendChild(option);
        });
        clipSelect.disabled = false;
        document.getElementById('envelopeHelpText')?.classList.remove('hidden');
    } else {
        document.getElementById('envelopeHelpText')?.textContent = 'No clips on this track';
        document.getElementById('envelopeHelpText')?.classList.remove('hidden');
        clearEnvelopeDisplay();
    }
}

/**
 * Get the currently selected track
 */
function getSelectedTrack() {
    if (!selectedTrackId) return null;
    const tracks = localAppServices.getTracks?.() || [];
    return tracks.find(t => t.id === selectedTrackId);
}

/**
 * Load envelope for selected clip and render
 */
function loadEnvelope() {
    if (!selectedTrackId || !selectedClipId) {
        clearEnvelopeDisplay();
        return;
    }
    
    const track = getSelectedTrack();
    if (!track) {
        clearEnvelopeDisplay();
        return;
    }
    
    const envelope = track.getClipGainEnvelope?.(selectedClipId) || [];
    document.getElementById('envelopeHelpText')?.classList.add('hidden');
    drawEnvelope(envelope);
}

/**
 * Clear the envelope display
 */
function clearEnvelopeDisplay() {
    if (!envelopeCtx || !envelopeCanvas) return;
    
    envelopeCtx.fillStyle = '#000';
    envelopeCtx.fillRect(0, 0, envelopeCanvas.width, envelopeCanvas.height);
    
    // Draw grid
    drawGrid();
}

/**
 * Resize the envelope canvas
 */
function resizeEnvelopeCanvas() {
    if (!envelopeCanvas) return;
    
    const container = document.getElementById('envelopeCanvasContainer');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    envelopeCanvas.width = rect.width;
    envelopeCanvas.height = rect.height;
    
    loadEnvelope();
}

/**
 * Draw the envelope on the canvas
 */
function drawEnvelope(envelope) {
    if (!envelopeCtx || !envelopeCanvas) return;
    
    const ctx = envelopeCtx;
    const width = envelopeCanvas.width;
    const height = envelopeCanvas.height;
    
    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    drawGrid();
    
    if (!envelope || envelope.length === 0) {
        // Draw flat line at unity (0.7)
        drawFlatLine(height, 0.7);
        return;
    }
    
    // Get clip duration for scaling
    const track = getSelectedTrack();
    const clip = track?.timelineClips?.find(c => c.id === selectedClipId);
    const duration = clip?.duration || 4;
    
    // Draw envelope line
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    envelope.forEach((point, i) => {
        const x = (point.time / duration) * width;
        const y = height - (point.value * height);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
    
    // Draw fill under curve
    ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, height);
    envelope.forEach((point, i) => {
        const x = (point.time / duration) * width;
        const y = height - (point.value * height);
        ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    
    // Draw points
    envelope.forEach((point, i) => {
        const x = (point.time / duration) * width;
        const y = height - (point.value * height);
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = i === dragPointIndex ? '#ff6600' : '#00ff88';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
    
    // Update point values display
    updatePointValuesDisplay(envelope);
}

/**
 * Draw a flat line when no envelope exists
 */
function drawFlatLine(height, value) {
    if (!envelopeCtx) return;
    
    const y = height - (value * height);
    
    envelopeCtx.strokeStyle = '#00ff88';
    envelopeCtx.lineWidth = 2;
    envelopeCtx.setLineDash([5, 5]);
    envelopeCtx.beginPath();
    envelopeCtx.moveTo(0, y);
    envelopeCtx.lineTo(envelopeCtx.canvas.width, y);
    envelopeCtx.stroke();
    envelopeCtx.setLineDash([]);
}

/**
 * Draw grid lines
 */
function drawGrid() {
    if (!envelopeCtx || !envelopeCanvas) return;
    
    const ctx = envelopeCtx;
    const width = envelopeCanvas.width;
    const height = envelopeCanvas.height;
    
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    
    // Vertical lines (time divisions)
    for (let i = 0; i <= 4; i++) {
        const x = (i / 4) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Horizontal lines (gain levels: 0, 0.25, 0.5, 0.75, 1.0)
    for (let i = 0; i <= 4; i++) {
        const y = (i / 4) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        // Label
        ctx.fillStyle = '#333';
        ctx.font = '10px monospace';
        ctx.fillText((1 - i / 4).toFixed(2), 3, y - 2);
    }
}

/**
 * Handle mouse down on canvas
 */
function handleCanvasMouseDown(e) {
    if (!selectedClipId) return;
    
    const rect = envelopeCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const track = getSelectedTrack();
    const clip = track?.timelineClips?.find(c => c.id === selectedClipId);
    const duration = clip?.duration || 4;
    
    const envelope = track?.getClipGainEnvelope?.(selectedClipId) || [];
    
    // Check if clicking on existing point
    envelope.forEach((point, i) => {
        const px = (point.time / duration) * envelopeCanvas.width;
        const py = envelopeCanvas.height - (point.value * envelopeCanvas.height);
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        
        if (dist < 10) {
            isDraggingPoint = true;
            dragPointIndex = i;
            dragPointOriginalValue = point.value;
        }
    });
    
    if (!isDraggingPoint) {
        // Add new point at click position
        const time = (x / envelopeCanvas.width) * duration;
        const value = 1 - (y / envelopeCanvas.height);
        
        if (track) {
            track.addClipGainEnvelopePoint(selectedClipId, time, value);
            loadEnvelope();
        }
    }
}

/**
 * Handle mouse move on canvas
 */
function handleCanvasMouseMove(e) {
    if (!isDraggingPoint || dragPointIndex < 0) return;
    
    const rect = envelopeCanvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    const value = Math.max(0, Math.min(1, 1 - (y / envelopeCanvas.height)));
    
    const track = getSelectedTrack();
    const clip = track?.timelineClips?.find(c => c.id === selectedClipId);
    const duration = clip?.duration || 4;
    
    if (track && clip) {
        const envelope = track.getClipGainEnvelope(selectedClipId) || [];
        if (envelope[dragPointIndex]) {
            // Update point value (keep same time)
            const point = envelope[dragPointIndex];
            track.removeClipGainEnvelopePoint(selectedClipId, point.time);
            track.addClipGainEnvelopePoint(selectedClipId, point.time, value);
            loadEnvelope();
        }
    }
}

/**
 * Handle mouse up on canvas
 */
function handleCanvasMouseUp() {
    if (isDraggingPoint && selectedTrackId) {
        const track = getSelectedTrack();
        if (track) {
            track._captureUndoState?.(`Adjust gain envelope point on ${track.name}`);
        }
    }
    
    isDraggingPoint = false;
    dragPointIndex = -1;
}

/**
 * Handle double click to remove point
 */
function handleCanvasDoubleClick(e) {
    if (!selectedClipId) return;
    
    const rect = envelopeCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const track = getSelectedTrack();
    const clip = track?.timelineClips?.find(c => c.id === selectedClipId);
    const duration = clip?.duration || 4;
    
    const envelope = track?.getClipGainEnvelope?.(selectedClipId) || [];
    
    envelope.forEach((point, i) => {
        if (i === 0 || i === envelope.length - 1) return; // Can't remove first/last
        
        const px = (point.time / duration) * envelopeCanvas.width;
        const py = envelopeCanvas.height - (point.value * envelopeCanvas.height);
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        
        if (dist < 10) {
            track?.removeClipGainEnvelopePoint(selectedClipId, point.time);
            loadEnvelope();
        }
    });
}

/**
 * Update the point values display
 */
function updatePointValuesDisplay(envelope) {
    const container = document.getElementById('clipGainEnvelopeEditorContent');
    if (!container) return;
    
    let display = container.querySelector('#pointValuesDisplay');
    if (!display) {
        display = document.createElement('div');
        display.id = 'pointValuesDisplay';
        display.className = 'mt-2 p-2 bg-gray-800 rounded text-xs max-h-20 overflow-y-auto';
        container.querySelector('#envelopeCanvasContainer')?.after(display);
    }
    
    if (!envelope || envelope.length === 0) {
        display.innerHTML = '<span class="text-gray-500">No envelope points. Click on the canvas to add points.</span>';
        return;
    }
    
    display.innerHTML = envelope.map((p, i) => 
        `<span class="mr-3">Point ${i + 1}: ${p.time.toFixed(2)}s, ${(p.value * 100).toFixed(0)}%</span>`
    ).join('');
}

console.log('[ClipGainEnvelopeEditor] Module loaded');