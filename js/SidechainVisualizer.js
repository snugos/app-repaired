// js/SidechainVisualizer.js - Visual indicator for sidechain routing and ducking status
// Shows which tracks are being affected by sidechain compression in real-time

let localAppServices = {};
let visualizerUpdateLoop = null;
let duckingIndicators = new Map(); // trackId -> { level, timestamp }

export function initSidechainVisualizer(appServices) {
    localAppServices = appServices || {};
    console.log('[SidechainVisualizer] Initialized');
}

/**
 * Opens the Sidechain Visualizer panel showing real-time sidechain activity
 */
export function openSidechainVisualizerPanel(savedState = null) {
    const windowId = 'sidechainVisualizer';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderSidechainVisualizerContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'sidechainVisualizerContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900 overflow-y-auto';

    const options = { 
        width: 500, 
        height: 400, 
        minWidth: 400, 
        minHeight: 300, 
        initialContentKey: windowId, 
        closable: true, 
        minimizable: true, 
        resizable: true 
    };
    
    if (savedState) {
        Object.assign(options, { 
            x: parseInt(savedState.left, 10), 
            y: parseInt(savedState.top, 10), 
            width: parseInt(savedState.width, 10), 
            height: parseInt(savedState.height, 10), 
            zIndex: savedState.zIndex, 
            isMinimized: savedState.isMinimized 
        });
    }

    const win = localAppServices.createWindow(windowId, 'Sidechain Visualizer', contentContainer, options);
    if (win?.element) {
        renderSidechainVisualizerContent();
        startVisualizerUpdateLoop();
    }
    return win;
}

/**
 * Stops the visualizer update loop
 */
function stopVisualizerUpdateLoop() {
    if (visualizerUpdateLoop) {
        cancelAnimationFrame(visualizerUpdateLoop);
        visualizerUpdateLoop = null;
    }
}

/**
 * Starts the real-time visualizer update loop
 */
function startVisualizerUpdateLoop() {
    stopVisualizerUpdateLoop();
    
    function update() {
        renderSidechainMetering();
        visualizerUpdateLoop = requestAnimationFrame(update);
    }
    visualizerUpdateLoop = requestAnimationFrame(update);
}

/**
 * Renders the main sidechain visualizer content
 */
function renderSidechainVisualizerContent() {
    const container = document.getElementById('sidechainVisualizerContent');
    if (!container) {
        stopVisualizerUpdateLoop();
        return;
    }

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    // Get tracks with sidechain routing
    const sidechainTracks = tracks.filter(t => t.sidechainSource || t.sidechainDestination);
    
    let html = `
        <div class="mb-3 p-2 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-400 mb-1">Sidechain routing status</div>
            <div class="flex items-center gap-4 text-xs">
                <div class="flex items-center gap-1">
                    <div class="w-3 h-3 rounded-full bg-green-500"></div>
                    <span class="text-gray-400">Source Track</span>
                </div>
                <div class="flex items-center gap-1">
                    <div class="w-3 h-3 rounded-full bg-orange-500"></div>
                    <span class="text-gray-400">Ducking Track</span>
                </div>
            </div>
        </div>
        
        <div id="sidechainTracksList" class="flex-1 space-y-2 overflow-y-auto">
    `;

    if (sidechainTracks.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500">
                <div class="text-4xl mb-2">🔗</div>
                <p class="text-sm">No sidechain routing configured</p>
                <p class="text-xs text-gray-600 mt-1">Set a track as sidechain source in the Mixer panel</p>
            </div>
        `;
    } else {
        sidechainTracks.forEach(track => {
            const isSource = !!track.sidechainSource;
            const isDestination = !!track.sidechainDestination;
            const sourceTrack = isSource ? tracks.find(t => t.id === track.sidechainSource) : null;
            const destTrack = isDestination ? tracks.find(t => t.id === track.sidechainDestination) : null;
            
            // Get current ducking level (0-1)
            const duckingLevel = duckingIndicators.get(track.id)?.level || 0;
            
            html += `
                <div class="p-3 bg-gray-800 rounded border border-gray-700" data-track-id="${track.id}">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <div class="w-4 h-4 rounded" style="background-color: ${track.color || '#666'}"></div>
                            <span class="text-sm font-medium text-white">${track.name}</span>
                            <span class="text-xs px-2 py-0.5 rounded ${isSource ? 'bg-green-900 text-green-300' : 'bg-orange-900 text-orange-300'}">
                                ${isSource ? 'SOURCE' : 'DEST'}
                            </span>
                        </div>
                        <div class="text-xs text-gray-500">ID: ${track.id}</div>
                    </div>
                    
                    <div class="text-xs text-gray-400 mb-2">
                        ${isSource 
                            ? `Triggers ducking → ${destTrack?.name || 'Unknown'}` 
                            : `Ducks when ← ${sourceTrack?.name || 'Unknown'}`}
                    </div>
                    
                    <div class="ducking-meter-container">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-xs text-gray-500">Ducking Level</span>
                            <span class="ducking-percent text-xs text-gray-400">${Math.round(duckingLevel * 100)}%</span>
                        </div>
                        <div class="h-3 bg-gray-700 rounded overflow-hidden">
                            <div class="ducking-bar h-full transition-all duration-100" 
                                style="width: ${duckingLevel * 100}%; 
                                background: linear-gradient(90deg, #22c55e 0%, #f59e0b 50%, #ef4444 100%);"></div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += `
        </div>
        
        <div class="mt-3 p-2 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-500">
                Sidechain metering updates at ~60fps. Ducking level shows how much the track's volume is being reduced.
            </div>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Renders real-time sidechain metering (called from update loop)
 */
function renderSidechainMetering() {
    const container = document.getElementById('sidechainVisualizerContent');
    if (!container) {
        stopVisualizerUpdateLoop();
        return;
    }

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    tracks.forEach(track => {
        if (!track.sidechainDestination && !track.sidechainSource) return;
        
        const trackEl = container.querySelector(`[data-track-id="${track.id}"]`);
        if (!trackEl) return;
        
        // Simulate ducking level based on track activity
        // In a real implementation, this would read from actual sidechain processing data
        let duckingLevel = duckingIndicators.get(track.id)?.level || 0;
        
        if (track.sidechainSource) {
            // This is a source track - check if it's currently active
            duckingLevel = Math.max(0, duckingLevel - 0.02); // Decay
        } else if (track.sidechainDestination) {
            // This is a destination track being ducked
            // Simulate ducking based on any playing notes
            duckingLevel = Math.max(0, duckingLevel - 0.01); // Decay
        }
        
        duckingIndicators.set(track.id, { level: duckingLevel, timestamp: Date.now() });
        
        const duckingBar = trackEl.querySelector('.ducking-bar');
        const duckingPercent = trackEl.querySelector('.ducking-percent');
        
        if (duckingBar) {
            duckingBar.style.width = `${duckingLevel * 100}%`;
        }
        if (duckingPercent) {
            duckingPercent.textContent = `${Math.round(duckingLevel * 100)}%`;
        }
    });
}

/**
 * Trigger sidechain activity for a track (called when source track plays)
 * @param {number} sourceTrackId - The source track that triggered sidechain
 * @param {number} duration - Duration of ducking in seconds
 */
export function triggerSidechainVisualizer(sourceTrackId, duration = 0.25) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const sourceTrack = tracks.find(t => t.id === sourceTrackId);
    
    if (!sourceTrack) return;
    
    // Find all destination tracks that this source triggers
    tracks.forEach(track => {
        if (track.sidechainDestination === sourceTrackId) {
            // Simulate ducking level increase
            const currentLevel = duckingIndicators.get(track.id)?.level || 0;
            duckingIndicators.set(track.id, { level: 0.7, timestamp: Date.now() });
            
            // Schedule decay
            setTimeout(() => {
                const level = duckingIndicators.get(track.id)?.level || 0;
                duckingIndicators.set(track.id, { level: Math.max(0, level - 0.3), timestamp: Date.now() });
            }, 50);
            
            setTimeout(() => {
                const level = duckingIndicators.get(track.id)?.level || 0;
                duckingIndicators.set(track.id, { level: Math.max(0, level - 0.3), timestamp: Date.now() });
            }, 150);
        }
    });
}

/**
 * Get current ducking level for a track
 * @param {number} trackId 
 * @returns {number} Ducking level 0-1
 */
export function getDuckingLevel(trackId) {
    return duckingIndicators.get(trackId)?.level || 0;
}

/**
 * Reset all ducking indicators
 */
export function resetDuckingIndicators() {
    duckingIndicators.clear();
}

/**
 * Update the visualizer when track sidechain configuration changes
 */
export function updateSidechainVisualizer() {
    renderSidechainVisualizerContent();
}

export function closeSidechainVisualizerPanel() {
    stopVisualizerUpdateLoop();
    const container = document.getElementById('sidechainVisualizerContent');
    if (container) {
        container.innerHTML = '';
    }
}