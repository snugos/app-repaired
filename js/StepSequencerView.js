// js/StepSequencerView.js - 16-step drum grid view separate from piano roll
// Feature: Step Sequencer View - dedicated drum machine style step sequencer

let localAppServices = {};
let activeStepSequencerTrackId = null;

export function initStepSequencerView(services) {
    localAppServices = services;
    console.log('[StepSequencerView] Initialized');
}

/**
 * Opens the Step Sequencer View panel
 * @param {number} trackId - The track ID to edit
 * @param {object} savedState - Optional saved window state
 */
export function openStepSequencerView(trackId = null, savedState = null) {
    const windowId = 'stepSequencerView';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    // If trackId not provided, use the first DrumSampler track
    if (trackId === null) {
        const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
        const drumTrack = tracks.find(t => t.type === 'DrumSampler' || t.type === 'Drum');
        if (drumTrack) {
            trackId = drumTrack.id;
        }
    }
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        if (trackId !== null) {
            renderStepSequencerContent(trackId);
        }
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'stepSequencerContent';
    contentContainer.className = 'flex flex-col h-full bg-gray-900 text-white';
    
    const options = {
        width: 650,
        height: 400,
        minWidth: 500,
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
    
    const win = localAppServices.createWindow(windowId, 'Step Sequencer', contentContainer, options);
    
    if (win?.element) {
        if (trackId !== null) {
            activeStepSequencerTrackId = trackId;
            setTimeout(() => renderStepSequencerContent(trackId), 50);
        } else {
            renderNoTrackMessage(contentContainer);
        }
    }
    
    return win;
}

/**
 * Renders message when no drum track is available
 */
function renderNoTrackMessage(container) {
    container.innerHTML = `
        <div class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
                <div class="text-4xl mb-4">🥁</div>
                <p class="text-lg">No Drum Track Found</p>
                <p class="text-sm mt-2">Create a Drum Sampler track to use the Step Sequencer</p>
            </div>
        </div>
    `;
}

/**
 * Renders the step sequencer content for a track
 * @param {number} trackId - Track ID
 */
function renderStepSequencerContent(trackId) {
    const container = document.getElementById('stepSequencerContent');
    if (!container) return;
    
    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        renderNoTrackMessage(container);
        return;
    }
    
    activeStepSequencerTrackId = trackId;
    
    // Get sequence data - 8 pads x 16 steps
    const sequence = track.getActiveSequence ? track.getActiveSequence() : null;
    const numPads = 8;
    const numSteps = 16;
    
    // Build header with track selector
    let html = `
        <div class="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
            <div class="flex items-center gap-3">
                <label class="text-sm text-gray-400">Track:</label>
                <select id="stepSeqTrackSelect" class="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm">
                    ${tracks.filter(t => t.type === 'DrumSampler' || t.type === 'Drum').map(t => 
                        `<option value="${t.id}" ${t.id === trackId ? 'selected' : ''}>${t.name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="flex items-center gap-3">
                <label class="flex items-center gap-2 text-sm text-gray-400">
                    <span>Tempo:</span>
                    <input type="number" id="stepSeqTempo" value="120" min="20" max="300" 
                           class="w-16 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-center">
                </label>
                <button id="stepSeqPlayBtn" class="px-4 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">
                    ▶ Play
                </button>
                <button id="stepSeqStopBtn" class="px-4 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">
                    ■ Stop
                </button>
                <button id="stepSeqClearBtn" class="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm">
                    Clear
                </button>
            </div>
        </div>
        
        <!-- Step indicators header -->
        <div class="flex bg-gray-800 border-b border-gray-700" style="padding-left: 80px;">
            ${Array.from({length: numSteps}, (_, i) => `
                <div class="flex-1 text-center text-xs text-gray-500 py-1 ${i % 4 === 0 ? 'border-l border-gray-600' : ''}">
                    ${i + 1}
                </div>
            `).join('')}
        </div>
        
        <!-- Pad grid -->
        <div id="stepSeqGrid" class="flex-1 overflow-y-auto p-2">
            ${renderPadRows(track, sequence, numPads, numSteps)}
        </div>
        
        <!-- Velocity/Probability panel -->
        <div class="flex items-center justify-between p-2 bg-gray-800 border-t border-gray-700">
            <div class="flex items-center gap-2 text-sm text-gray-400">
                <span>Mode:</span>
                <select id="stepSeqMode" class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm">
                    <option value="steps">Steps Only</option>
                    <option value="velocity">Velocity</option>
                    <option value="probability">Probability</option>
                </select>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-400">
                <span>Current Pad:</span>
                <span id="currentPadDisplay" class="text-white font-medium">--</span>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Setup event handlers
    setupStepSequencerEvents(trackId, track);
}

/**
 * Renders the pad rows (8 pads x 16 steps)
 */
function renderPadRows(track, sequence, numPads, numSteps) {
    let html = '';
    
    const padLabels = ['Kick', 'Snare', 'HiHat', 'Clap', 'Tom', 'Perc', 'FX1', 'FX2'];
    
    for (let pad = 0; pad < numPads; pad++) {
        html += `
            <div class="flex items-center mb-1" data-pad="${pad}">
                <div class="w-20 flex-shrink-0 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded text-center border border-gray-700">
                    ${padLabels[pad] || `Pad ${pad + 1}`}
                </div>
                <div class="flex flex-1 gap-px">
                    ${Array.from({length: numSteps}, (_, step) => {
                        const isBarLine = step % 16 === 0;
                        const isBeatLine = step % 4 === 0;
                        const borderClass = isBarLine ? 'border-l-2 border-gray-600' : (isBeatLine ? 'border-l border-gray-700' : '');
                        
                        // Get step data
                        let isActive = false;
                        let velocity = 0.7;
                        
                        if (sequence?.data && sequence.data[pad] && sequence.data[pad][step]) {
                            const stepData = sequence.data[pad][step];
                            isActive = stepData?.active || false;
                            velocity = stepData?.velocity || 0.7;
                        }
                        
                        const velocityColor = velocity > 0.8 ? 'bg-green-500' : (velocity > 0.5 ? 'bg-green-600' : 'bg-green-700');
                        const activeClass = isActive ? velocityColor : 'bg-gray-800 hover:bg-blue-600';
                        
                        return `
                            <div class="step-cell flex-1 h-8 cursor-pointer rounded-sm transition-colors ${activeClass} ${borderClass}" 
                                 data-pad="${pad}" data-step="${step}"
                                 title="Pad ${pad + 1}, Step ${step + 1}">
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

/**
 * Sets up event handlers for step sequencer
 */
function setupStepSequencerEvents(trackId, track) {
    const container = document.getElementById('stepSequencerContent');
    if (!container) return;
    
    // Track selector
    const trackSelect = container.querySelector('#stepSeqTrackSelect');
    if (trackSelect) {
        trackSelect.addEventListener('change', (e) => {
            const newTrackId = parseInt(e.target.value, 10);
            renderStepSequencerContent(newTrackId);
        });
    }
    
    // Play button
    const playBtn = container.querySelector('#stepSeqPlayBtn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            const tempo = parseInt(container.querySelector('#stepSeqTempo')?.value || '120', 10);
            if (localAppServices.showNotification) {
                localAppServices.showNotification(`Playing step sequencer at ${tempo} BPM`, 1500);
            }
            // Play would be handled by the audio system
        });
    }
    
    // Stop button
    const stopBtn = container.querySelector('#stepSeqStopBtn');
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (localAppServices.showNotification) {
                localAppServices.showNotification('Step sequencer stopped', 1500);
            }
        });
    }
    
    // Clear button
    const clearBtn = container.querySelector('#stepSeqClearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all steps?')) {
                const sequence = track.getActiveSequence?.();
                if (sequence?.data) {
                    const isReconstructing = localAppServices.getIsReconstructingDAW?.() || false;
                    if (!isReconstructing && localAppServices.captureStateForUndo) {
                        localAppServices.captureStateForUndo('Clear step sequencer');
                    }
                    
                    for (let pad = 0; pad < 8; pad++) {
                        for (let step = 0; step < 16; step++) {
                            sequence.data[pad] = sequence.data[pad] || [];
                            sequence.data[pad][step] = null;
                        }
                    }
                    
                    renderStepSequencerContent(trackId);
                    localAppServices.updateTrackUI?.(trackId, 'sequencerContentChanged');
                }
            }
        });
    }
    
    // Grid click handling (event delegation)
    const grid = container.querySelector('#stepSeqGrid');
    if (grid) {
        let isMouseDown = false;
        let paintValue = false;
        
        grid.addEventListener('mousedown', (e) => {
            const cell = e.target.closest('.step-cell');
            if (cell) {
                isMouseDown = true;
                const isActive = cell.classList.contains('bg-green-500') || 
                                 cell.classList.contains('bg-green-600') || 
                                 cell.classList.contains('bg-green-700');
                paintValue = !isActive;
                toggleStep(track, cell);
                
                // Update current pad display
                const padDisplay = container.querySelector('#currentPadDisplay');
                if (padDisplay) {
                    padDisplay.textContent = `Pad ${parseInt(cell.dataset.pad, 10) + 1}`;
                }
            }
        });
        
        grid.addEventListener('mousemove', (e) => {
            if (isMouseDown) {
                const cell = e.target.closest('.step-cell');
                if (cell) {
                    const isActive = cell.classList.contains('bg-green-500') || 
                                     cell.classList.contains('bg-green-600') || 
                                     cell.classList.contains('bg-green-700');
                    
                    if (paintValue && !isActive) {
                        toggleStep(track, cell);
                    } else if (!paintValue && isActive) {
                        toggleStep(track, cell);
                    }
                }
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isMouseDown) {
                isMouseDown = false;
                localAppServices.updateTrackUI?.(trackId, 'sequencerContentChanged');
            }
        });
        
        // Mouse leave
        grid.addEventListener('mouseleave', () => {
            if (isMouseDown) {
                isMouseDown = false;
            }
        });
    }
}

/**
 * Toggles a step in the sequencer
 */
function toggleStep(track, cell) {
    const pad = parseInt(cell.dataset.pad, 10);
    const step = parseInt(cell.dataset.step, 10);
    
    const sequence = track.getActiveSequence?.();
    if (!sequence?.data) return;
    
    // Ensure row exists
    if (!sequence.data[pad]) {
        sequence.data[pad] = [];
    }
    
    const currentData = sequence.data[pad][step];
    
    if (currentData?.active) {
        // Turn off
        sequence.data[pad][step] = null;
        cell.classList.remove('bg-green-500', 'bg-green-600', 'bg-green-700');
        cell.classList.add('bg-gray-800');
    } else {
        // Turn on
        sequence.data[pad][step] = {
            active: true,
            velocity: 0.7
        };
        cell.classList.remove('bg-gray-800');
        cell.classList.add('bg-green-500');
    }
}

/**
 * Refreshes the step sequencer UI
 */
export function refreshStepSequencerUI(trackId = null) {
    const container = document.getElementById('stepSequencerContent');
    if (!container) return;
    
    if (trackId !== null && trackId !== activeStepSequencerTrackId) {
        renderStepSequencerContent(trackId);
    } else if (activeStepSequencerTrackId !== null) {
        renderStepSequencerContent(activeStepSequencerTrackId);
    }
}

console.log('[StepSequencerView] Module loaded');