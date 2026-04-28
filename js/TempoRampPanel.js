// js/TempoRampPanel.js - Tempo Ramp Editor with Curve Visualization
// Allows smooth tempo automation over time with visual curve editing

let localAppServices = {};
let rampPoints = []; // { id, barPosition, bpm, curve }
let canvas = null;
let ctx = null;
let isDragging = false;
let dragPointIndex = -1;

export function initTempoRampPanel(appServices) {
    localAppServices = appServices || {};
    console.log('[TempoRampPanel] Module initialized');
}

export function openTempoRampPanel() {
    const windowId = 'tempoRamp';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTempoRampContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tempoRampContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-100 dark:bg-slate-800';

    const options = { 
        width: 600, 
        height: 450, 
        minWidth: 500, 
        minHeight: 380, 
        initialContentKey: windowId, 
        closable: true, 
        minimizable: true, 
        resizable: true 
    };

    const win = localAppServices.createWindow(windowId, 'Tempo Ramps', contentContainer, options);
    if (win?.element) {
        renderTempoRampContent();
    }
    return win;
}

function renderTempoRampContent() {
    const container = document.getElementById('tempoRampContent');
    if (!container) return;

    // Load current ramp points from state
    if (localAppServices.getTempoRampsState) {
        rampPoints = localAppServices.getTempoRampsState() || [];
    }

    const minBpm = 20, maxBpm = 300;
    const currentBpm = localAppServices.getTransportBPM ? localAppServices.getTransportBPM() : 120;

    let html = `
        <div class="flex-1 flex flex-col gap-3 min-h-0">
            <div class="flex items-center justify-between p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <div class="flex items-center gap-3">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Current BPM:</span>
                    <span id="currentBpmDisplay" class="text-lg font-bold text-blue-600 dark:text-blue-400">${currentBpm}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button id="addRampBtn" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">+ Add Point</button>
                    <button id="clearRampsBtn" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Clear All</button>
                </div>
            </div>
            
            <div class="flex-1 flex flex-col bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 min-h-0">
                <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-slate-600">
                    <span class="text-xs text-gray-600 dark:text-gray-400">Click to add points. Drag to move. Double-click to delete.</span>
                    <div class="flex items-center gap-2">
                        <label class="text-xs text-gray-600 dark:text-gray-400">BPM:</label>
                        <input type="number" id="newPointBpm" min="${minBpm}" max="${maxBpm}" value="${currentBpm}" 
                            class="w-16 px-1 py-0.5 text-xs bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                        <label class="text-xs text-gray-600 dark:text-gray-400">Bar:</label>
                        <input type="number" id="newPointBar" min="0" max="999" value="0" step="0.1"
                            class="w-16 px-1 py-0.5 text-xs bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                    </div>
                </div>
                <div id="rampCanvasContainer" class="flex-1 relative min-h-0" style="height: 200px;">
                    <canvas id="rampCanvas"></canvas>
                </div>
                <div class="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-slate-600">
                    <span class="text-xs text-gray-500 dark:text-gray-400">Y-axis: BPM (${minBpm}-${maxBpm})</span>
                    <span id="rampInfo" class="text-xs text-gray-500 dark:text-gray-400">${rampPoints.length} point(s)</span>
                </div>
            </div>
            
            <div class="p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <div id="rampPointsList" class="space-y-1 max-h-24 overflow-y-auto">
                    ${renderRampPointsList()}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    // Initialize canvas after HTML is inserted
    setTimeout(initCanvas, 10);
    
    // Event listeners
    container.querySelector('#addRampBtn')?.addEventListener('click', () => {
        const bar = parseFloat(document.getElementById('newPointBar').value) || 0;
        const bpm = parseInt(document.getElementById('newPointBpm').value) || 120;
        addRampPoint(bar, bpm);
    });
    
    container.querySelector('#clearRampsBtn')?.addEventListener('click', () => {
        if (confirm('Clear all tempo ramp points?')) {
            clearAllRamps();
        }
    });
}

function renderRampPointsList() {
    if (rampPoints.length === 0) {
        return '<div class="text-xs text-gray-400 dark:text-gray-500 text-center py-2">No ramp points. Click "Add Point" or click on the graph.</div>';
    }
    return rampPoints.map((point, idx) => `
        <div class="flex items-center justify-between p-1 bg-gray-50 dark:bg-slate-600 rounded text-xs">
            <span class="text-gray-700 dark:text-gray-300">Point ${idx + 1}: Bar ${point.barPosition.toFixed(1)} → ${point.bpm} BPM</span>
            <div class="flex items-center gap-1">
                <select class="ramp-curve-select px-1 py-0.5 text-xs bg-white dark:bg-slate-500 border border-gray-300 dark:border-slate-400 rounded text-gray-700 dark:text-gray-200" data-index="${idx}">
                    <option value="linear" ${point.curve === 'linear' ? 'selected' : ''}>Linear</option>
                    <option value="exponential" ${point.curve === 'exponential' ? 'selected' : ''}>Exponential</option>
                    <option value="stepped" ${point.curve === 'stepped' ? 'selected' : ''}>Stepped</option>
                </select>
                <button class="delete-ramp-btn px-1 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800" data-index="${idx}">×</button>
            </div>
        </div>
    `).join('');
}

function initCanvas() {
    canvas = document.getElementById('rampCanvas');
    if (!canvas) return;
    
    const container = document.getElementById('rampCanvasContainer');
    if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
    
    ctx = canvas.getContext('2d');
    drawRampCurve();
    
    // Mouse events
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('dblclick', onCanvasDoubleClick);
}

function drawRampCurve() {
    if (!ctx || !canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const minBpm = 20, maxBpm = 300;
    const maxBars = 64;
    
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Horizontal BPM lines
    for (let bpm = minBpm; bpm <= maxBpm; bpm += 20) {
        const y = height - ((bpm - minBpm) / (maxBpm - minBpm)) * height;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${bpm}`, 5, y - 2);
    }
    
    // Vertical bar lines
    for (let bar = 0; bar <= maxBars; bar += 4) {
        const x = (bar / maxBars) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Draw base line at current BPM
    const currentBpm = localAppServices.getTransportBPM ? localAppServices.getTransportBPM() : 120;
    const currentY = height - ((currentBpm - minBpm) / (maxBpm - minBpm)) * height;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(width, currentY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    if (rampPoints.length === 0) {
        // Draw hint
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Click to add tempo ramp points', width / 2, height / 2);
        ctx.textAlign = 'left';
        return;
    }
    
    // Sort points by bar position
    const sortedPoints = [...rampPoints].sort((a, b) => a.barPosition - b.barPosition);
    
    // Draw curve
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Start from bottom-left at current BPM
    const startX = 0;
    const startY = currentY;
    ctx.moveTo(startX, startY);
    
    // Draw to first point
    if (sortedPoints.length > 0) {
        const firstPoint = sortedPoints[0];
        const x1 = (firstPoint.barPosition / maxBars) * width;
        const y1 = height - ((firstPoint.bpm - minBpm) / (maxBpm - minBpm)) * height;
        ctx.lineTo(x1, y1);
    }
    
    // Draw between points based on curve type
    for (let i = 0; i < sortedPoints.length - 1; i++) {
        const p1 = sortedPoints[i];
        const p2 = sortedPoints[i + 1];
        const x1 = (p1.barPosition / maxBars) * width;
        const y1 = height - ((p1.bpm - minBpm) / (maxBpm - minBpm)) * height;
        const x2 = (p2.barPosition / maxBars) * width;
        const y2 = height - ((p2.bpm - minBpm) / (maxBpm - minBpm)) * height;
        
        if (p1.curve === 'linear' || !p1.curve) {
            ctx.lineTo(x2, y2);
        } else if (p1.curve === 'exponential') {
            // Smooth curve using quadratic
            const cpX = (x1 + x2) / 2;
            ctx.quadraticCurveTo(cpX, y1, x2, y2);
        } else if (p1.curve === 'stepped') {
            // Horizontal then vertical
            ctx.lineTo(x2, y1);
            ctx.lineTo(x2, y2);
        }
    }
    
    ctx.stroke();
    
    // Draw points
    sortedPoints.forEach((point, idx) => {
        const x = (point.barPosition / maxBars) * width;
        const y = height - ((point.bpm - minBpm) / (maxBpm - minBpm)) * height;
        
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${point.bpm}`, x, y - 10);
    });
    ctx.textAlign = 'left';
}

function onCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = canvas.width;
    const height = canvas.height;
    const minBpm = 20, maxBpm = 300;
    const maxBars = 64;
    
    // Check if clicking on existing point
    for (let i = 0; i < rampPoints.length; i++) {
        const point = rampPoints[i];
        const px = (point.barPosition / maxBars) * width;
        const py = height - ((point.bpm - minBpm) / (maxBpm - minBpm)) * height;
        
        if (Math.abs(x - px) < 10 && Math.abs(y - py) < 10) {
            isDragging = true;
            dragPointIndex = i;
            return;
        }
    }
    
    // Click to add new point
    const bar = (x / width) * maxBars;
    const bpm = maxBpm - (y / height) * (maxBpm - minBpm);
    addRampPoint(bar, Math.round(bpm));
}

function onCanvasMouseMove(e) {
    if (!isDragging || dragPointIndex < 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = canvas.width;
    const height = canvas.height;
    const minBpm = 20, maxBpm = 300;
    const maxBars = 64;
    
    const bar = Math.max(0, Math.min(maxBars, (x / width) * maxBars));
    const bpm = Math.max(minBpm, Math.min(maxBpm, Math.round(maxBpm - (y / height) * (maxBpm - minBpm))));
    
    rampPoints[dragPointIndex].barPosition = bar;
    rampPoints[dragPointIndex].bpm = bpm;
    
    drawRampCurve();
    updateRampPointsList();
}

function onCanvasMouseUp() {
    if (isDragging && dragPointIndex >= 0) {
        saveRampPoints();
    }
    isDragging = false;
    dragPointIndex = -1;
}

function onCanvasDoubleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = canvas.width;
    const height = canvas.height;
    const maxBars = 64;
    
    // Find point to delete
    const minBpm = 20, maxBpm = 300;
    for (let i = 0; i < rampPoints.length; i++) {
        const point = rampPoints[i];
        const px = (point.barPosition / maxBars) * width;
        const py = height - ((point.bpm - minBpm) / (maxBpm - minBpm)) * height;
        
        if (Math.abs(x - px) < 10 && Math.abs(y - py) < 10) {
            removeRampPoint(i);
            return;
        }
    }
}

function addRampPoint(barPosition, bpm) {
    const id = `ramp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const point = {
        id,
        barPosition: Math.max(0, parseFloat(barPosition) || 0),
        bpm: Math.max(20, Math.min(300, parseInt(bpm) || 120)),
        curve: 'linear'
    };
    
    rampPoints.push(point);
    rampPoints.sort((a, b) => a.barPosition - b.barPosition);
    
    drawRampCurve();
    updateRampPointsList();
    saveRampPoints();
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Added ramp point: Bar ${point.barPosition.toFixed(1)}, ${point.bpm} BPM`, 1500);
    }
}

function removeRampPoint(index) {
    if (index < 0 || index >= rampPoints.length) return;
    
    const removed = rampPoints.splice(index, 1)[0];
    drawRampCurve();
    updateRampPointsList();
    saveRampPoints();
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Removed ramp point at Bar ${removed.barPosition.toFixed(1)}`, 1500);
    }
}

function clearAllRamps() {
    rampPoints = [];
    drawRampCurve();
    updateRampPointsList();
    saveRampPoints();
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification('All tempo ramp points cleared', 1500);
    }
}

function updateRampPointsList() {
    const container = document.getElementById('rampPointsList');
    const infoEl = document.getElementById('rampInfo');
    if (container) {
        container.innerHTML = renderRampPointsList();
        attachListEventListeners();
    }
    if (infoEl) {
        infoEl.textContent = `${rampPoints.length} point(s)`;
    }
}

function attachListEventListeners() {
    document.querySelectorAll('.ramp-curve-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            if (idx >= 0 && idx < rampPoints.length) {
                rampPoints[idx].curve = e.target.value;
                drawRampCurve();
                saveRampPoints();
            }
        });
    });
    
    document.querySelectorAll('.delete-ramp-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            removeRampPoint(idx);
        });
    });
}

function saveRampPoints() {
    if (localAppServices.setTempoRampsState) {
        localAppServices.setTempoRampsState(rampPoints);
    }
    
    // Apply immediately to transport
    if (localAppServices.setTransportBPM && rampPoints.length > 0) {
        const currentBpm = localAppServices.getTransportBPM ? localAppServices.getTransportBPM() : 120;
        // Apply first point's BPM to transport
        const sortedPoints = [...rampPoints].sort((a, b) => a.barPosition - b.barPosition);
        // Don't auto-change BPM here - wait for playback to reach the point
    }
}

// Export for external access
export function getTempoRampPoints() {
    return [...rampPoints];
}

export function setTempoRampPoints(points) {
    rampPoints = points || [];
    if (ctx) drawRampCurve();
    if (document.getElementById('rampPointsList')) {
        updateRampPointsList();
    }
}