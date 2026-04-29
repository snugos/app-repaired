// js/TempoForecastOverlay.js - Tempo Forecast Overlay for SnugOS DAW
// Shows upcoming tempo ramp points as translucent markers on the timeline

let localAppServices = {};
let overlayCanvas = null;
let overlayCtx = null;
let animationFrameId = null;

export function initTempoForecastOverlay(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    console.log('[TempoForecastOverlay] Module initialized');
}

export function openTempoForecastOverlay() {
    const windowId = 'tempoForecastOverlay';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const options = {
        width: 400,
        height: 300,
        minWidth: 300,
        minHeight: 200,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tempoForecastContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    contentContainer.innerHTML = getOverlayPanelHTML();

    const win = localAppServices.createWindow(windowId, 'Tempo Forecast', contentContainer, options);
    if (win?.element) {
        attachOverlayPanelHandlers();
    }
    return win;
}

function getOverlayPanelHTML() {
    return `
        <div class="mb-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Tempo Forecast Overlay</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="tempoForecastToggle" class="sr-only peer" checked>
                    <div class="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Shows upcoming tempo ramp points as markers on the timeline.</p>
        </div>
        
        <div id="tempoForecastList" class="space-y-2">
            <!-- Ramp points will be listed here -->
        </div>
        
        <div id="tempoForecastEmpty" class="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
            No tempo ramp points scheduled.
        </div>
        
        <div class="mt-4 pt-3 border-t border-gray-200 dark:border-slate-600">
            <button id="openTempoRamperBtn" class="w-full px-3 py-2 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors">
                Open Tempo Ramper
            </button>
        </div>
    `;
}

function attachOverlayPanelHandlers() {
    const container = document.getElementById('tempoForecastContent');
    if (!container) return;

    const toggle = container.querySelector('#tempoForecastToggle');
    toggle?.addEventListener('change', (e) => {
        if (e.target.checked) {
            startOverlayDrawing();
        } else {
            stopOverlayDrawing();
        }
    });

    const openRamperBtn = container.querySelector('#openTempoRamperBtn');
    openRamperBtn?.addEventListener('click', () => {
        if (localAppServices.openTempoRamperPanel) {
            localAppServices.openTempoRamperPanel();
        } else if (window.openTempoRamperPanel) {
            window.openTempoRamperPanel();
        }
    });

    updateRampPointList();
}

function updateRampPointList() {
    const container = document.getElementById('tempoForecastContent');
    if (!container) return;

    const ramps = localAppServices.getTempoRampsState ? localAppServices.getTempoRampsState() : [];
    const listEl = container.querySelector('#tempoForecastList');
    const emptyEl = container.querySelector('#tempoForecastEmpty');

    if (!listEl || !emptyEl) return;

    if (ramps.length === 0) {
        listEl.innerHTML = '';
        emptyEl.style.display = 'block';
    } else {
        emptyEl.style.display = 'none';
        listEl.innerHTML = ramps.map((ramp, idx) => `
            <div class="p-2 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-medium text-purple-600 dark:text-purple-400">Point #${idx + 1}</span>
                    <span class="text-xs text-gray-500">${ramp.curve}</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div><span class="text-gray-500">Bar:</span> <span class="font-medium">${ramp.barPosition.toFixed(1)}</span></div>
                    <div><span class="text-gray-500">BPM:</span> <span class="font-medium text-blue-600 dark:text-blue-400">${ramp.bpm.toFixed(1)}</span></div>
                </div>
            </div>
        `).join('');
    }
}

export function startOverlayDrawing() {
    if (animationFrameId) return;
    
    // Find the timeline content area
    const timelineBg = document.getElementById('timelineBackground') || 
                       document.querySelector('.timeline-bg') ||
                       document.querySelector('#timelineContent')?.parentElement;
    
    if (!timelineBg) {
        console.warn('[TempoForecastOverlay] Timeline background not found');
        return;
    }

    // Remove existing overlay if any
    removeOverlayCanvas();

    // Create canvas for overlay
    overlayCanvas = document.createElement('canvas');
    overlayCanvas.id = 'tempoForecastCanvas';
    overlayCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10;
    `;
    
    // Match timeline background size
    overlayCanvas.width = timelineBg.offsetWidth;
    overlayCanvas.height = timelineBg.offsetHeight;
    overlayCanvas.style.width = timelineBg.offsetWidth + 'px';
    overlayCanvas.style.height = timelineBg.offsetHeight + 'px';
    
    timelineBg.style.position = 'relative';
    timelineBg.appendChild(overlayCanvas);

    overlayCtx = overlayCanvas.getContext('2d');
    
    // Start draw loop
    drawOverlay();
}

function drawOverlay() {
    if (!overlayCtx || !overlayCanvas) return;

    const ramps = localAppServices.getTempoRampsState ? localAppServices.getTempoRampsState() : [];
    if (ramps.length === 0) {
        animationFrameId = null;
        return;
    }

    const ctx = overlayCtx;
    const width = overlayCanvas.width;
    const height = overlayCanvas.height;

    // Clear previous frame
    ctx.clearRect(0, 0, width, height);

    const bpm = localAppServices.getTempo ? localAppServices.getTempo() : 120;
    const pixelsPerSecond = width / 60; // Assuming 60 second visible timeline

    ramps.forEach(ramp => {
        // Calculate x position based on bar position (assuming 4 beats per bar)
        const beatsPerBar = 4;
        const secondsPerBeat = 60 / bpm;
        const secondsPerBar = secondsPerBeat * beatsPerBar;
        const x = (ramp.barPosition * secondsPerBar) * pixelsPerSecond;
        
        if (x >= 0 && x <= width) {
            // Draw translucent vertical bar at ramp point
            const gradient = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
            gradient.addColorStop(0, 'rgba(168, 85, 247, 0)');
            gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.3)');
            gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x - 20, 0, 40, height);

            // Draw triangle marker at top
            ctx.fillStyle = 'rgba(168, 85, 247, 0.7)';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x - 8, 12);
            ctx.lineTo(x + 8, 12);
            ctx.closePath();
            ctx.fill();

            // Draw BPM label
            ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${ramp.bpm.toFixed(0)}`, x, 22);
        }
    });

    // Continue animation loop
    animationFrameId = requestAnimationFrame(drawOverlay);
}

export function stopOverlayDrawing() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    removeOverlayCanvas();
}

function removeOverlayCanvas() {
    if (overlayCanvas && overlayCanvas.parentElement) {
        overlayCanvas.parentElement.removeChild(overlayCanvas);
    }
    overlayCanvas = null;
    overlayCtx = null;
}

export function isOverlayActive() {
    return animationFrameId !== null;
}

export function refreshOverlay() {
    if (animationFrameId) {
        updateRampPointList();
    }
}

// Refresh when tempo ramps change
export function setupOverlayRefreshCallback() {
    // This can be called from TempoRamperUI to refresh the overlay
    const originalAddRamp = window.addTempoRampPoint;
    // Refresh when panel is opened
    setTimeout(refreshOverlay, 100);
}

// Expose for external use
if (typeof window !== 'undefined') {
    window.openTempoForecastOverlay = openTempoForecastOverlay;
    window.startTempoForecastOverlay = startOverlayDrawing;
    window.stopTempoForecastOverlay = stopOverlayDrawing;
}