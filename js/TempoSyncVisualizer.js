// js/TempoSyncVisualizer.js - Displays beat-synced grid lines with phase indicators
// Visualizes tempo grid, downbeats, and phase alignment on the timeline

let localAppServices = {};
let tempoSyncWindow = null;
let animationFrameId = null;
let currentBeat = 0;
let lastBeatTime = 0;
let phaseIndicatorPosition = 0;

export function initTempoSyncVisualizer(appServices) {
    localAppServices = appServices || {};
    console.log('[TempoSyncVisualizer] Module initialized');
}

export function openTempoSyncVisualizerPanel() {
    const windowId = 'tempoSyncVisualizer';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'tempoSyncContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 text-white overflow-hidden';
    contentContainer.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-cyan-400">Tempo Sync Visualizer</h2>
            <div class="flex items-center gap-2">
                <label class="text-sm text-gray-400">Enabled:</label>
                <input type="checkbox" id="tempoSyncEnabled" checked class="accent-cyan-500">
            </div>
        </div>
        <div class="flex gap-4 mb-4">
            <div class="flex-1 p-3 bg-gray-800 rounded">
                <div class="text-xs text-gray-400 mb-1">Current BPM</div>
                <div id="tempoSyncBpm" class="text-2xl font-bold text-cyan-300">120.0</div>
            </div>
            <div class="flex-1 p-3 bg-gray-800 rounded">
                <div class="text-xs text-gray-400 mb-1">Current Beat</div>
                <div id="tempoSyncBeat" class="text-2xl font-bold text-green-400">1</div>
            </div>
            <div class="flex-1 p-3 bg-gray-800 rounded">
                <div class="text-xs text-gray-400 mb-1">Phase Position</div>
                <div id="tempoSyncPhase" class="text-2xl font-bold text-yellow-400">0%</div>
            </div>
        </div>
        <div class="flex-1 relative bg-gray-800 rounded overflow-hidden" id="tempoSyncGridContainer">
            <canvas id="tempoSyncCanvas" class="w-full h-full"></canvas>
        </div>
        <div class="mt-4 grid grid-cols-4 gap-2 text-xs">
            <div class="flex items-center gap-2 p-2 bg-gray-800 rounded">
                <div class="w-4 h-4 bg-cyan-500 rounded"></div>
                <span>Downbeat</span>
            </div>
            <div class="flex items-center gap-2 p-2 bg-gray-800 rounded">
                <div class="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Beat</span>
            </div>
            <div class="flex items-center gap-2 p-2 bg-gray-800 rounded">
                <div class="w-4 h-4 bg-gray-500 rounded"></div>
                <span>Sub-beat</span>
            </div>
            <div class="flex items-center gap-2 p-2 bg-gray-800 rounded">
                <div class="w-4 h-4 bg-yellow-400 rounded"></div>
                <span>Playhead</span>
            </div>
        </div>
    `;

    const options = {
        width: 800,
        height: 350,
        minWidth: 600,
        minHeight: 280,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow ? localAppServices.createWindow(windowId, 'Tempo Sync', contentContainer, options) : null;
    if (win?.element) {
        tempoSyncWindow = win;
        startVisualizationLoop();
        setupEventListeners();
    }

    return win;
}

function setupEventListeners() {
    const enabledCheckbox = document.getElementById('tempoSyncEnabled');
    if (enabledCheckbox) {
        enabledCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                startVisualizationLoop();
            } else {
                stopVisualizationLoop();
            }
        });
    }
}

function startVisualizationLoop() {
    if (animationFrameId) return;
    
    const loop = () => {
        updateVisualization();
        animationFrameId = requestAnimationFrame(loop);
    };
    animationFrameId = requestAnimationFrame(loop);
}

function stopVisualizationLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function updateVisualization() {
    const bpmDisplay = document.getElementById('tempoSyncBpm');
    const beatDisplay = document.getElementById('tempoSyncBeat');
    const phaseDisplay = document.getElementById('tempoSyncPhase');
    const canvas = document.getElementById('tempoSyncCanvas');
    
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const bpm = localAppServices.getBPM ? localAppServices.getBPM() : 120;
    const currentTime = localAppServices.getCurrentTime ? localAppServices.getCurrentTime() : 0;
    const isPlaying = localAppServices.getIsPlaying ? localAppServices.getIsPlaying() : false;
    
    // Calculate beat info
    const beatDuration = 60.0 / bpm;
    const currentBeatFloat = currentTime / beatDuration;
    const currentBeat = Math.floor(currentBeatFloat);
    const phaseProgress = (currentBeatFloat - currentBeat) * 100;
    
    // Update displays
    if (bpmDisplay) bpmDisplay.textContent = bpm.toFixed(1);
    if (beatDisplay) beatDisplay.textContent = (currentBeat % 4) + 1;
    if (phaseDisplay) phaseDisplay.textContent = phaseProgress.toFixed(0) + '%';
    
    // Clear canvas
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const width = canvas.width;
    const height = canvas.height;
    const pixelsPerBeat = (beatDuration * width) / 4; // Show 4 seconds of timeline
    
    // Draw grid lines
    const secondsVisible = width / pixelsPerBeat * 4;
    const startTime = currentTime - 0.5;
    const endTime = currentTime + secondsVisible;
    
    // Draw sub-beat lines (16th notes)
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 1;
    const subBeatInterval = beatDuration / 4;
    for (let t = Math.floor(startTime / subBeatInterval) * subBeatInterval; t < endTime; t += subBeatInterval) {
        const x = ((t - currentTime) + 0.5) * pixelsPerBeat / 4;
        if (x >= 0 && x <= width) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }
    
    // Draw beat lines
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    for (let t = Math.floor(startTime / beatDuration) * beatDuration; t < endTime; t += beatDuration) {
        const x = ((t - currentTime) + 0.5) * pixelsPerBeat / 4;
        if (x >= 0 && x <= width) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }
    
    // Draw downbeat lines (every 4 beats)
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    const downbeatInterval = beatDuration * 4;
    for (let t = Math.floor(startTime / downbeatInterval) * downbeatInterval; t < endTime; t += downbeatInterval) {
        const x = ((t - currentTime) + 0.5) * pixelsPerBeat / 4;
        if (x >= 0 && x <= width) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }
    
    // Draw phase indicator (playhead position within current beat)
    const phaseX = (phaseProgress / 100) * (pixelsPerBeat / 4);
    const centerX = width / 2;
    const playheadX = centerX + phaseX;
    
    // Phase arc
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, height - 30, 20, -Math.PI / 2, -Math.PI / 2 + (phaseProgress / 100) * Math.PI * 2);
    ctx.stroke();
    
    // Playhead marker
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX - 8, 15);
    ctx.lineTo(playheadX + 8, 15);
    ctx.closePath();
    ctx.fill();
    
    // Draw beat markers at bottom
    ctx.fillStyle = '#06b6d4';
    for (let i = 0; i < 4; i++) {
        const beatX = centerX + (i - 1.5) * (pixelsPerBeat / 4);
        ctx.beginPath();
        ctx.arc(beatX, height - 30, i === 0 ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Current beat indicator
    const currentBeatInBar = currentBeat % 4;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(centerX + (currentBeatInBar - 1.5) * (pixelsPerBeat / 4), height - 30, 8, 0, Math.PI * 2);
    ctx.fill();
}