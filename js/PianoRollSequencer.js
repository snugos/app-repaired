// js/PianoRollSequencer.js - Piano Roll Sequencer Window for SnugOS DAW
// Feature: Clickable piano roll with note editing

import { synthPitches, STEPS_PER_BAR } from './constants.js';

let localAppServices = {};

export function initPianoRollSequencer(services) {
    localAppServices = services;
    console.log('[PianoRollSequencer] Initialized');
}

/**
 * Opens the Piano Roll Sequencer window for a track
 * @param {number} trackId - The track ID
 * @param {boolean} forceRedraw - Force redraw even if already open
 * @param {object} savedState - Saved window state for restoration
 */
export function openTrackSequencerWindow(trackId, forceRedraw = false, savedState = null) {
    const windowId = `sequencerWin-${trackId}`;
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    // Check if already open
    if (openWindows.has(windowId) && !forceRedraw && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    // Get track
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        console.error(`[PianoRollSequencer] Track ${trackId} not found`);
        localAppServices.showNotification?.('Track not found', 2000);
        return;
    }
    
    // Don't open for Audio tracks
    if (track.type === 'Audio') {
        localAppServices.showNotification?.('Audio tracks do not have a piano roll', 2000);
        return;
    }
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.id = `pianoRollContent-${trackId}`;
    contentContainer.className = 'flex flex-col h-full bg-gray-900 text-white';
    
    const options = { 
        width: 800, 
        height: 500, 
        minWidth: 600, 
        minHeight: 350, 
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
    
    const win = localAppServices.createWindow(windowId, `Piano Roll - ${track.name}`, contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderPianoRollContent(trackId), 50);
    }
    
    return win;
}

/**
 * Renders the piano roll content for a track
 * @param {number} trackId - The track ID
 */
function renderPianoRollContent(trackId) {
    const container = document.getElementById(`pianoRollContent-${trackId}`);
    if (!container) return;
    
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return;
    
    // Get sequence data
    const sequence = track.getActiveSequence ? track.getActiveSequence() : null;
    const sequenceData = sequence?.data || [];
    const sequenceLength = sequence?.length || STEPS_PER_BAR;
    
    // Build HTML
    let html = `
        <div class="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
            <div class="flex items-center gap-3">
                <span class="text-sm text-gray-400">Track: <span class="text-white font-medium">${track.name}</span></span>
                <select id="sequenceSelect-${trackId}" class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm">
                    ${track.sequences?.map(seq => 
                        `<option value="${seq.id}" ${seq.id === track.activeSequenceId ? 'selected' : ''}>${seq.name}</option>`
                    ).join('') || '<option>No Sequences</option>'}
                </select>
            </div>
            <div class="flex items-center gap-2">
                <label class="flex items-center gap-1 text-sm text-gray-400">
                    <span>Snap:</span>
                    <select id="snapSelect-${trackId}" class="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm">
                        <option value="1">1/16</option>
                        <option value="2">1/8</option>
                        <option value="4" selected>1/4</option>
                        <option value="8">1/2</option>
                    </select>
                </label>
                <button id="clearSequenceBtn-${trackId}" class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded">Clear</button>
                <button id="randomFillBtn-${trackId}" class="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded">Random</button>
            </div>
        </div>
        <div class="flex flex-1 overflow-hidden">
            <!-- Piano keys sidebar -->
            <div id="pianoKeys-${trackId}" class="w-16 flex-shrink-0 bg-gray-800 border-r border-gray-700 overflow-y-auto">
                <!-- Keys rendered by JS -->
            </div>
            <!-- Sequencer grid -->
            <div id="sequencerGrid-${trackId}" class="flex-1 overflow-auto bg-gray-900">
                <div id="sequencerGridInner-${trackId}" class="relative" style="min-width: ${sequenceLength * 20}px;">
                    <!-- Grid rendered by JS -->
                </div>
            </div>
        </div>
        <div class="flex items-center justify-between p-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
            <span>Click to toggle steps. Drag to paint.</span>
            <span>Steps: ${sequenceLength}</span>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Render piano keys
    renderPianoKeys(trackId, track, sequenceData);
    
    // Render sequencer grid
    renderSequencerGrid(trackId, track, sequenceData, sequenceLength);
    
    // Setup event handlers
    setupPianoRollEvents(trackId, track);
}

/**
 * Renders the piano keys sidebar
 * @param {number} trackId - Track ID
 * @param {object} track - Track object
 * @param {Array} sequenceData - 2D array of step data
 */
function renderPianoKeys(trackId, track, sequenceData) {
    const container = document.getElementById(`pianoKeys-${trackId}`);
    if (!container) return;
    
    const pitches = synthPitches;
    const numRows = track.type === 'DrumSampler' ? 8 : pitches.length;
    
    let html = '';
    for (let row = 0; row < numRows; row++) {
        const isBlackKey = track.type !== 'DrumSampler' && pitches[row].includes('#');
        const bgClass = isBlackKey ? 'bg-gray-700' : 'bg-gray-100';
        const textClass = isBlackKey ? 'text-gray-200' : 'text-gray-800';
        const label = track.type === 'DrumSampler' ? `Pad ${row + 1}` : pitches[row];
        
        html += `
            <div class="piano-key h-5 ${bgClass} ${textClass} border-b border-gray-600 flex items-center justify-end pr-1 text-xs font-mono" 
                 data-row="${row}" style="height: 20px;">
                ${label}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

/**
 * Renders the sequencer grid
 * @param {number} trackId - Track ID
 * @param {object} track - Track object
 * @param {Array} sequenceData - 2D array of step data
 * @param {number} sequenceLength - Number of steps
 */
function renderSequencerGrid(trackId, track, sequenceData, sequenceLength) {
    const container = document.getElementById(`sequencerGridInner-${trackId}`);
    if (!container) return;
    
    const pitches = synthPitches;
    const numRows = track.type === 'DrumSampler' ? 8 : pitches.length;
    
    let html = '';
    for (let row = 0; row < numRows; row++) {
        html += `<div class="flex" style="height: 20px;">`;
        
        for (let step = 0; step < sequenceLength; step++) {
            const isBarLine = step % 16 === 0;
            const isBeatLine = step % 4 === 0;
            const stepData = sequenceData[row]?.[step];
            const isActive = stepData?.active;
            
            // Determine color based on velocity
            let bgClass = 'bg-gray-800';
            if (isActive) {
                const velocity = stepData.velocity || 0.7;
                if (velocity > 0.8) bgClass = 'bg-green-500';
                else if (velocity > 0.5) bgClass = 'bg-green-600';
                else bgClass = 'bg-green-700';
            }
            
            const borderClass = isBarLine ? 'border-l-2 border-gray-500' : (isBeatLine ? 'border-l border-gray-700' : 'border-l border-gray-800');
            
            html += `
                <div class="step-cell w-5 ${bgClass} ${borderClass} border-gray-900 cursor-pointer hover:bg-blue-600 transition-colors" 
                     data-row="${row}" data-step="${step}"
                     title="Row ${row}, Step ${step}${isActive ? ` (Vel: ${(stepData.velocity * 100).toFixed(0)}%)` : ''}">
                </div>
            `;
        }
        
        html += `</div>`;
    }
    
    container.innerHTML = html;
}

/**
 * Sets up event handlers for the piano roll
 * @param {number} trackId - Track ID
 * @param {object} track - Track object
 */
function setupPianoRollEvents(trackId, track) {
    const container = document.getElementById(`pianoRollContent-${trackId}`);
    if (!container) return;
    
    // Sequence select
    const seqSelect = container.querySelector(`#sequenceSelect-${trackId}`);
    if (seqSelect) {
        seqSelect.addEventListener('change', (e) => {
            const sequenceId = e.target.value;
            if (track.setActiveSequence) {
                track.setActiveSequence(sequenceId);
                renderPianoRollContent(trackId);
            }
        });
    }
    
    // Clear button
    const clearBtn = container.querySelector(`#clearSequenceBtn-${trackId}`);
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all notes in this sequence?')) {
                const sequence = track.getActiveSequence?.();
                if (sequence?.data) {
                    const isReconstructing = localAppServices.getIsReconstructingDAW?.() || false;
                    if (!isReconstructing && localAppServices.captureStateForUndo) {
                        localAppServices.captureStateForUndo(`Clear sequence ${sequence.name}`);
                    }
                    
                    for (let row = 0; row < sequence.data.length; row++) {
                        for (let step = 0; step < sequence.data[row].length; step++) {
                            sequence.data[row][step] = null;
                        }
                    }
                    
                    renderSequencerGrid(trackId, track, sequence.data, sequence.length);
                    localAppServices.updateTrackUI?.(trackId, 'sequencerContentChanged');
                }
            }
        });
    }
    
    // Random fill button
    const randomBtn = container.querySelector(`#randomFillBtn-${trackId}`);
    if (randomBtn) {
        randomBtn.addEventListener('click', () => {
            const sequence = track.getActiveSequence?.();
            if (sequence?.data) {
                const isReconstructing = localAppServices.getIsReconstructingDAW?.() || false;
                if (!isReconstructing && localAppServices.captureStateForUndo) {
                    localAppServices.captureStateForUndo(`Random fill sequence`);
                }
                
                for (let row = 0; row < sequence.data.length; row++) {
                    for (let step = 0; step < sequence.data[row].length; step++) {
                        if (Math.random() > 0.7) {
                            sequence.data[row][step] = {
                                active: true,
                                velocity: 0.5 + Math.random() * 0.5
                            };
                        } else {
                            sequence.data[row][step] = null;
                        }
                    }
                }
                
                renderSequencerGrid(trackId, track, sequence.data, sequence.length);
                localAppServices.updateTrackUI?.(trackId, 'sequencerContentChanged');
            }
        });
    }
    
    // Grid click handling (event delegation)
    const grid = container.querySelector(`#sequencerGridInner-${trackId}`);
    if (grid) {
        let isMouseDown = false;
        let paintValue = false;
        
        grid.addEventListener('mousedown', (e) => {
            const cell = e.target.closest('.step-cell');
            if (cell) {
                isMouseDown = true;
                paintValue = !cell.classList.contains('bg-green-500') && !cell.classList.contains('bg-green-600') && !cell.classList.contains('bg-green-700');
                toggleStep(trackId, track, cell);
            }
        });
        
        grid.addEventListener('mousemove', (e) => {
            if (isMouseDown) {
                const cell = e.target.closest('.step-cell');
                if (cell) {
                    const currentActive = cell.classList.contains('bg-green-500') || cell.classList.contains('bg-green-600') || cell.classList.contains('bg-green-700');
                    if (paintValue && !currentActive) {
                        toggleStep(trackId, track, cell);
                    } else if (!paintValue && currentActive) {
                        toggleStep(trackId, track, cell);
                    }
                }
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isMouseDown) {
                isMouseDown = false;
                // Notify track changed
                localAppServices.updateTrackUI?.(trackId, 'sequencerContentChanged');
            }
        });
    }
}

/**
 * Toggles a step in the sequencer
 * @param {number} trackId - Track ID
 * @param {object} track - Track object
 * @param {HTMLElement} cell - The grid cell element
 */
function toggleStep(trackId, track, cell) {
    const row = parseInt(cell.dataset.row, 10);
    const step = parseInt(cell.dataset.step, 10);
    
    const sequence = track.getActiveSequence?.();
    if (!sequence?.data) return;
    
    // Ensure row exists
    if (!sequence.data[row]) {
        sequence.data[row] = [];
    }
    
    const currentData = sequence.data[row][step];
    
    if (currentData?.active) {
        // Turn off
        sequence.data[row][step] = null;
        cell.classList.remove('bg-green-500', 'bg-green-600', 'bg-green-700');
        cell.classList.add('bg-gray-800');
    } else {
        // Turn on
        sequence.data[row][step] = {
            active: true,
            velocity: 0.7
        };
        cell.classList.remove('bg-gray-800');
        cell.classList.add('bg-green-500');
    }
}

/**
 * Refreshes the piano roll UI for a track
 * @param {number} trackId - Track ID
 * @param {string} sequenceId - Optional sequence ID
 */
export function refreshSequencerUI(trackId, sequenceId = null) {
    const container = document.getElementById(`pianoRollContent-${trackId}`);
    if (!container) return;
    
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return;
    
    const sequence = track.getActiveSequence?.() || sequenceId && track.sequences?.find(s => s.id === sequenceId);
    if (!sequence) return;
    
    renderSequencerGrid(trackId, track, sequence.data, sequence.length);
}

console.log('[PianoRollSequencer] Module loaded');
