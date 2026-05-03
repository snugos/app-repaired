// js/TempoRamperVisual.js - Visual Tempo Curve Editor
// Draw tempo automation curves directly on a canvas for intuitive tempo changes

let localAppServices = {};
let visualWindow = null;
let canvas = null;
let ctx = null;

// State
let ramps = [];
let dragPointIdx = -1;
let isDragging = false;
let hoverPointIdx = -1;

// Canvas settings
const CANVAS_PADDING = { top: 30, right: 40, bottom: 50, left: 60 };
const MIN_BPM = 20;
const MAX_BPM = 300;
const MIN_BAR = 0;
const MAX_BAR = 64;

// Colors
const COLORS = {
    bg: '#1e1e2e',
    grid: '#333355',
    axis: '#666688',
    curve: '#7c3aed',
    curveFill: 'rgba(124, 58, 237, 0.15)',
    point: '#a78bfa',
    pointActive: '#f472b6',
    pointHover: '#fbbf24',
    text: '#e2e8f0',
    textDim: '#94a3b8'
};

export function initTempoRamperVisual(services) {
    localAppServices = services || {};
    console.log('[TempoRamperVisual] Module initialized');
}

export function openTempoRamperVisual() {
    const windowId = 'tempoRamperVisual';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        refreshCanvas();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tempoRamperVisualContent';
    contentContainer.className = 'p-0 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';

    const options = {
        width: 800,
        height: 400,
        minWidth: 600,
        minHeight: 300,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Tempo Ramper Visual', contentContainer, options);
    if (win?.element) {
        visualWindow = win;
        renderVisualContent();
    }
    return win;
}

function renderVisualContent() {
    const container = document.getElementById('tempoRamperVisualContent');
    if (!container) return;

    ramps = localAppServices.getTempoRampsState ? localAppServices.getTempoRampsState() : [];

    const toolbarHtml = `
        <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
            <div class="flex items-center gap-3">
                <span class="text-sm text-gray-600 dark:text-gray-400">Draw tempo curve:</span>
                <button id="trvAddPoint" class="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded">+ Add Point</button>
                <button id="trvClearAll" class="px-3 py-1 text-xs bg-gray-400 hover:bg-gray-500 text-white rounded">Clear All</button>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Tip: Click canvas to add, drag points to adjust</span>
                <button id="trvClose" class="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded">Close</button>
            </div>
        </div>
    `;

    const canvasContainerHtml = `
        <div class="flex-1 relative" id="trvCanvasContainer">
            <canvas id="trvCanvas"></canvas>
        </div>
    `;

    const infoHtml = `
        <div class="px-3 py-2 bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600 flex items-center gap-4">
            <span class="text-xs text-gray-500">Points: <span id="trvPointCount" class="font-medium text-gray-700 dark:text-gray-300">${ramps.length}</span></span>
            <span class="text-xs text-gray-500">Start: <span id="trvStartBpm" class="font-medium text-gray-700 dark:text-gray-300">${getCurrentBpmAtBar(0).toFixed(1)}</span> BPM</span>
            <span class="text-xs text-gray-500">End: <span id="trvEndBpm" class="font-medium text-gray-700 dark:text-gray-300">${getCurrentBpmAtBar(MAX_BAR).toFixed(1)}</span> BPM</span>
            <span class="text-xs text-gray-500 ml-auto">Double-click canvas to add point at cursor</span>
        </div>
    `;

    container.innerHTML = toolbarHtml + canvasContainerHtml + infoHtml;

    // Setup canvas
    canvas = document.getElementById('trvCanvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse events
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('dblclick', onCanvasDoubleClick);

    // Button events
    container.querySelector('#trvAddPoint')?.addEventListener('click', addPointAtCenter);
    container.querySelector('#trvClearAll')?.addEventListener('click', clearAllPoints);
    container.querySelector('#trvClose')?.addEventListener('click', () => {
        if (visualWindow) visualWindow.close();
    });

    refreshCanvas();
}

function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    refreshCanvas();
}

function refreshCanvas() {
    if (!ctx || !canvas) return;
    ramps = localAppServices.getTempoRampsState ? localAppServices.getTempoRampsState() : [];
    drawCurve();
    updateInfo();
}

function getPlotArea() {
    const w = canvas.width;
    const h = canvas.height;
    return {
        x: CANVAS_PADDING.left,
        y: CANVAS_PADDING.top,
        width: w - CANVAS_PADDING.left - CANVAS_PADDING.right,
        height: h - CANVAS_PADDING.top - CANVAS_PADDING.bottom
    };
}

function barToX(bar) {
    const area = getPlotArea();
    return area.x + (bar / MAX_BAR) * area.width;
}

function bpmToY(bpm) {
    const area = getPlotArea();
    return area.y + ((MAX_BPM - bpm) / (MAX_BPM - MIN_BPM)) * area.height;
}

function xToBar(x) {
    const area = getPlotArea();
    return Math.max(MIN_BAR, Math.min(MAX_BAR, ((x - area.x) / area.width) * MAX_BAR));
}

function yToBpm(y) {
    const area = getPlotArea();
    return Math.max(MIN_BPM, Math.min(MAX_BPM, MAX_BPM - ((y - area.y) / area.height) * (MAX_BPM - MIN_BPM)));
}

function getCurrentBpmAtBar(bar) {
    if (ramps.length === 0) return localAppServices.getTempo ? localAppServices.getTempo() : 120;
    const sorted = [...ramps].sort((a, b) => a.barPosition - b.barPosition);
    if (bar <= sorted[0].barPosition) return sorted[0].bpm;
    if (bar >= sorted[sorted.length - 1].barPosition) return sorted[sorted.length - 1].bpm;
    for (let i = 0; i < sorted.length - 1; i++) {
        if (bar >= sorted[i].barPosition && bar <= sorted[i + 1].barPosition) {
            const t = (bar - sorted[i].barPosition) / (sorted[i + 1].barPosition - sorted[i].barPosition);
            return sorted[i].bpm + t * (sorted[i + 1].bpm - sorted[i].bpm);
        }
    }
    return 120;
}

function drawCurve() {
    const w = canvas.width;
    const h = canvas.height;
    const area = getPlotArea();

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;

    // Vertical (bars)
    for (let bar = 0; bar <= MAX_BAR; bar += 4) {
        const x = barToX(bar);
        ctx.strokeStyle = bar % 16 === 0 ? COLORS.axis : COLORS.grid;
        ctx.lineWidth = bar % 16 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, area.y);
        ctx.lineTo(x, area.y + area.height);
        ctx.stroke();

        // Label
        ctx.fillStyle = COLORS.textDim;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bar.toString(), x, area.y + area.height + 15);
    }

    // Horizontal (BPM)
    for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 20) {
        const y = bpmToY(bpm);
        ctx.strokeStyle = bpm % 60 === 0 ? COLORS.axis : COLORS.grid;
        ctx.lineWidth = bpm % 60 === 0 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(area.x, y);
        ctx.lineTo(area.x + area.width, y);
        ctx.stroke();

        if (bpm % 60 === 0) {
            ctx.fillStyle = COLORS.textDim;
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(bpm.toString(), area.x - 8, y + 4);
        }
    }

    // Axis labels
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Bars', area.x + area.width / 2, h - 8);
    ctx.save();
    ctx.translate(15, area.y + area.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('BPM', 0, 0);
    ctx.restore();

    // Tempo curve
    if (ramps.length > 0) {
        const sorted = [...ramps].sort((a, b) => a.barPosition - b.barPosition);

        // Fill under curve
        ctx.beginPath();
        let firstX = barToX(sorted[0].barPosition);
        let firstY = bpmToY(sorted[0].bpm);
        ctx.moveTo(area.x, firstY);
        ctx.lineTo(firstX, firstY);

        for (let i = 0; i < sorted.length - 1; i++) {
            const x1 = barToX(sorted[i].barPosition);
            const y1 = bpmToY(sorted[i].bpm);
            const x2 = barToX(sorted[i + 1].barPosition);
            const y2 = bpmToY(sorted[i + 1].bpm);

            // Stepped interpolation
            ctx.lineTo(x2, y1);
            ctx.lineTo(x2, y2);
        }

        let lastX = barToX(sorted[sorted.length - 1].barPosition);
        let lastY = bpmToY(sorted[sorted.length - 1].bpm);
        ctx.lineTo(lastX, lastY);
        ctx.lineTo(area.x + area.width, lastY);
        ctx.lineTo(area.x + area.width, bpmToY(getCurrentBpmAtBar(MAX_BAR)));
        ctx.lineTo(area.x, bpmToY(getCurrentBpmAtBar(0)));
        ctx.closePath();
        ctx.fillStyle = COLORS.curveFill;
        ctx.fill();

        // Draw curve line
        ctx.beginPath();
        ctx.moveTo(firstX, firstY);
        for (let i = 0; i < sorted.length - 1; i++) {
            const x2 = barToX(sorted[i + 1].barPosition);
            const y2 = bpmToY(sorted[i + 1].bpm);
            ctx.lineTo(barToX(sorted[i + 1].barPosition), bpmToY(sorted[i].bpm));
            ctx.lineTo(x2, y2);
        }
        ctx.strokeStyle = COLORS.curve;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Draw points
    ramps.forEach((ramp, idx) => {
        const x = barToX(ramp.barPosition);
        const y = bpmToY(ramp.bpm);
        const isHovered = idx === hoverPointIdx;
        const isActive = idx === dragPointIdx;

        ctx.beginPath();
        ctx.arc(x, y, isHovered ? 10 : isActive ? 9 : 7, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? COLORS.pointActive : isHovered ? COLORS.pointHover : COLORS.point;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function findPointNear(x, y, radius = 15) {
    for (let i = 0; i < ramps.length; i++) {
        const px = barToX(ramps[i].barPosition);
        const py = bpmToY(ramps[i].bpm);
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (dist < radius) return i;
    }
    return -1;
}

function onCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = findPointNear(x, y);
    if (idx !== -1) {
        dragPointIdx = idx;
        isDragging = true;
        if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Move tempo ramp point');
    }
}

function onCanvasMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging && dragPointIdx !== -1) {
        const newBar = parseFloat(xToBar(x).toFixed(2));
        const newBpm = parseFloat(yToBpm(y).toFixed(1));
        localAppServices.updateTempoRampPoint?.(ramps[dragPointIdx].id, newBar, newBpm);
        refreshCanvas();
    } else {
        const newHover = findPointNear(x, y);
        if (newHover !== hoverPointIdx) {
            hoverPointIdx = newHover;
            canvas.style.cursor = newHover !== -1 ? 'grab' : 'crosshair';
            refreshCanvas();
        }
    }
}

function onCanvasMouseUp() {
    dragPointIdx = -1;
    isDragging = false;
}

function onCanvasDoubleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const bar = parseFloat(xToBar(x).toFixed(2));
    const bpm = parseFloat(yToBpm(y).toFixed(1));

    if (localAppServices.addTempoRampPoint) {
        localAppServices.addTempoRampPoint(bar, bpm, 'linear');
        if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Add tempo ramp point');
        refreshCanvas();
    }
}

function addPointAtCenter() {
    const currentBar = ramps.length > 0 ? ramps[ramps.length - 1].barPosition + 4 : 8;
    const currentBpm = ramps.length > 0 ? ramps[ramps.length - 1].bpm : 120;
    const newBpm = Math.min(MAX_BPM, Math.max(MIN_BPM, currentBpm + 10));

    if (localAppServices.addTempoRampPoint) {
        localAppServices.addTempoRampPoint(currentBar, newBpm, 'linear');
        if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Add tempo ramp point');
        refreshCanvas();
    }
}

function clearAllPoints() {
    if (ramps.length === 0) return;
    if (localAppServices.clearTempoRamps) {
        if (localAppServices.captureStateForUndo) localAppServices.captureStateForUndo('Clear all tempo ramp points');
        localAppServices.clearTempoRamps();
        refreshCanvas();
    }
}

function updateInfo() {
    const container = document.getElementById('tempoRamperVisualContent');
    if (!container) return;
    const pointCountEl = container.querySelector('#trvPointCount');
    const startBpmEl = container.querySelector('#trvStartBpm');
    const endBpmEl = container.querySelector('#trvEndBpm');
    if (pointCountEl) pointCountEl.textContent = ramps.length;
    if (startBpmEl) startBpmEl.textContent = getCurrentBpmAtBar(0).toFixed(1);
    if (endBpmEl) endBpmEl.textContent = getCurrentBpmAtBar(MAX_BAR).toFixed(1);
}