// js/StepSequencerView.js - Step Sequencer View for Track Editing
// Alternative to piano roll showing steps/rows with velocity lanes
import { initStepSequencerProbability, setStepProbability, getStepProbability, getProbabilityColor, shouldTriggerStep } from './StepSequencerProbability.js';

let localAppServices = {};
let stepSequencerWindow = null;
let currentStepSequencerTrackId = null;
let selectedCells = new Set(); // Track selected cells for batch editing

// Initialize the step sequencer module
export function initStepSequencerView(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    console.log('[StepSequencerView] Module initialized');
}

// Open the Step Sequencer panel for a track
export function openStepSequencerView(trackId = null) {
    const windowId = 'stepSequencerView';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderStepSequencerContent(trackId);
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'stepSequencerContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';

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
    
    const win = localAppServices.createWindow(windowId, 'Step Sequencer', contentContainer, options);
    if (win?.element) {
        renderStepSequencerContent(trackId);
    }
    
    return win;
}

// Render the step sequencer content
function renderStepSequencerContent(trackId = null) {
    const container = document.getElementById('stepSequencerContent');
    if (!container) return;

    // Get track
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const activeTrackId = trackId || currentStepSequencerTrackId || (tracks.length > 0 ? tracks[0].id : null);
    const track = tracks.find(t => t.id === activeTrackId);
    
    if (!track) {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-500">
                <p>No track selected. Create a track first.</p>
            </div>
        `;
        return;
    }
    
    currentStepSequencerTrackId = track.id;

    // Get active sequence
    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];
    if (!activeSeq) {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-500">
                <p>No sequence found for this track.</p>
            </div>
        `;
        return;
    }

    const numSteps = activeSeq.data?.[0]?.length || 16;
    const numRows = activeSeq.data?.length || 16;
    
    // Get track name for display
    const isDrumTrack = track.type === 'DrumSampler';
    const isMelodicTrack = track.type === 'Synth' || track.type === 'Sampler';
    
    // Build header HTML
    let headerHtml = `
        <div class="mb-3 flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-3">
                <select id="stepSeqTrackSelect" class="px-2 py-1 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                    ${tracks.map(t => `<option value="${t.id}" ${t.id === track.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>
                <span class="text-xs text-gray-500">${track.type}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Resolution:</span>
                <select id="stepSeqResolution" class="px-2 py-1 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded">
                    <option value="8">1/8</option>
                    <option value="16" selected>1/16</option>
                    <option value="32">1/32</option>
                </select>
                <button id="stepSeqClear" class="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 rounded text-white">Clear All</button>
            </div>
        </div>
    `;

    // Build step numbers header
    let stepNumbersHtml = '<div class="flex mb-1 pl-[60px]">';
    for (let s = 0; s < numSteps; s++) {
        const isDownbeat = s % 4 === 0;
        stepNumbersHtml += `
            <div class="step-number flex-shrink-0 text-center text-xs ${isDownbeat ? 'text-blue-500 font-bold' : 'text-gray-400'}" 
                 style="width: ${100/numSteps}%;">${s + 1}</div>
        `;
    }
    stepNumbersHtml += '</div>';

    // Build velocity header
    let velocityHeaderHtml = '<div class="flex mb-1 pl-[60px]">';
    for (let s = 0; s < numSteps; s++) {
        velocityHeaderHtml += `
            <div class="velocity-header flex-shrink-0 text-center text-xs text-gray-500 border-l border-gray-300 dark:border-slate-600" 
                 style="width: ${100/numSteps}%;">
                <div class="h-2 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800" data-step="${s}" data-type="velocity"></div>
            </div>
        `;
    }
    velocityHeaderHtml += '</div>';

    // Build grid rows
    let gridHtml = '<div class="flex-1 overflow-y-auto overflow-x-hidden">';
    
    for (let r = 0; r < numRows; r++) {
        // Row label (note name or drum pad)
        let rowLabel = '';
        if (isDrumTrack) {
            const padNames = ['Kick', 'Snare', 'Clap', 'HH-C', 'HH-O', 'Tom1', 'Tom2', 'Rim', 'Cowbell', 'Crash', 'Ride', 'Shaker', 'Perc1', 'Perc2', 'FX1', 'FX2'];
            rowLabel = padNames[r] || `Pad ${r + 1}`;
        } else {
            // Calculate MIDI note name
            const noteNum = numRows - 1 - r; // Invert so high notes are at top
            const octave = Math.floor(noteNum / 12);
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const noteName = noteNames[((noteNum % 12) + 12) % 12];
            rowLabel = `${noteName}${octave}`;
        }

        gridHtml += `<div class="flex step-row" data-row="${r}">`;
        
        // Row label cell
        gridHtml += `
            <div class="flex-shrink-0 w-[60px] flex items-center justify-end pr-2 text-xs text-gray-600 dark:text-gray-400 border-r border-gray-300 dark:border-slate-600">
                ${rowLabel}
            </div>
        `;

        // Step cells
        for (let s = 0; s < numSteps; s++) {
            const note = activeSeq.data?.[r]?.[s];
            const hasNote = note !== null && note !== undefined;
            const velocity = hasNote ? (note.velocity || 0.8) : 0;
            const isDownbeat = s % 4 === 0;
            const isSelected = selectedCells.has(`${r}-${s}`);
            
            // Calculate color intensity based on velocity
            const bgColor = hasNote ? `rgba(59, 130, 246, ${0.3 + velocity * 0.7})` : '';
            const borderClass = isDownbeat ? 'border-l-2 border-blue-400' : 'border-l border-gray-200 dark:border-slate-700';
            const selectedClass = isSelected ? 'ring-2 ring-yellow-400' : '';
            
            gridHtml += `
                <div class="step-cell flex-shrink-0 border-r border-gray-200 dark:border-slate-700 ${borderClass} ${selectedClass} cursor-pointer transition-colors hover:bg-blue-100 dark:hover:bg-blue-900"
                     data-row="${r}" data-step="${s}"
                     style="width: ${100/numSteps}%; min-height: 32px; background-color: ${bgColor};">
                    ${hasNote ? `<div class="w-full h-full flex items-center justify-center"><div class="w-3 h-3 rounded-full bg-blue-500 opacity-80"></div></div>` : ''}
                </div>
            `;
        }
        
        gridHtml += '</div>';
    }
    gridHtml += '</div>';

    // Velocity scale legend
    let velocityLegendHtml = `
        <div class="mt-2 pt-2 border-t border-gray-300 dark:border-slate-600 flex items-center gap-4 flex-shrink-0">
            <span class="text-xs text-gray-500">Velocity:</span>
            <div class="flex items-center gap-1">
                <div class="w-4 h-4 rounded" style="background-color: rgba(59, 130, 246, 0.3)"></div>
                <span class="text-xs text-gray-500">Low</span>
            </div>
            <div class="flex items-center gap-1">
                <div class="w-4 h-4 rounded" style="background-color: rgba(59, 130, 246, 0.7)"></div>
                <span class="text-xs text-gray-500">Med</span>
            </div>
            <div class="flex items-center gap-1">
                <div class="w-4 h-4 rounded" style="background-color: rgba(59, 130, 246, 1)"></div>
                <span class="text-xs text-gray-500">High</span>
            </div>
            <div class="ml-auto text-xs text-gray-500">
                Click to add/toggle • Drag to set velocity • Shift+Click to select range
            </div>
        </div>
    `;

    container.innerHTML = headerHtml + stepNumbersHtml + velocityHeaderHtml + gridHtml + velocityLegendHtml;

    // Attach event listeners
    setupStepSequencerEvents(container, track);
}

// Setup event handlers for the step sequencer
function setupStepSequencerEvents(container, track) {
    // Track selection
    const trackSelect = container.querySelector('#stepSeqTrackSelect');
    if (trackSelect) {
        trackSelect.addEventListener('change', (e) => {
            const newTrackId = parseInt(e.target.value);
            selectedCells.clear();
            renderStepSequencerContent(newTrackId);
        });
    }

    // Clear all button
    const clearBtn = container.querySelector('#stepSeqClear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all notes in this sequence?')) {
                clearAllNotes(track);
            }
        });
    }

    // Step cell click - toggle note
    let isDragging = false;
    let isSettingVelocity = false;
    let dragStartRow = null;
    let dragStartStep = null;

    container.querySelectorAll('.step-cell').forEach(cell => {
        cell.addEventListener('mousedown', (e) => {
            const row = parseInt(cell.dataset.row);
            const step = parseInt(cell.dataset.step);
            
            if (e.shiftKey) {
                // Shift+click for range selection
                if (dragStartRow !== null) {
                    selectRange(dragStartRow, dragStartStep, row, step);
                }
            } else {
                // Normal click - toggle or add note
                isDragging = true;
                dragStartRow = row;
                dragStartStep = step;
                toggleNote(track, row, step, e.altKey);
            }
            
            e.preventDefault();
        });

        cell.addEventListener('mouseenter', (e) => {
            if (isDragging && !isSettingVelocity) {
                const row = parseInt(cell.dataset.row);
                const step = parseInt(cell.dataset.step);
                // Paint mode - add notes while dragging
                addNoteAt(track, row, step, e.altKey);
            }
        });

        cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const row = parseInt(cell.dataset.row);
            const step = parseInt(cell.dataset.step);
            // Right click - delete note
            deleteNoteAt(track, row, step);
        });
    });

    // Velocity header click - show velocity slider for step
    container.querySelectorAll('.velocity-header [data-step]').forEach(header => {
        header.addEventListener('click', (e) => {
            const step = parseInt(e.target.dataset.step);
            showVelocityEditor(track, step);
        });
    });

    // Probability header click - show probability editor for step
    container.querySelectorAll('.probability-header [data-step]').forEach(header => {
        header.addEventListener('click', (e) => {
            const step = parseInt(e.target.dataset.step);
            showProbabilityEditor(track, step);
        });
    });

    // Mouse up to end dragging
    document.addEventListener('mouseup', () => {
        isDragging = false;
        isSettingVelocity = false;
        dragStartRow = null;
        dragStartStep = null;
    });

    // Keyboard shortcuts
    container.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Delete selected notes
            deleteSelectedNotes(track);
        } else if (e.key === 'Escape') {
            // Clear selection
            selectedCells.clear();
            renderStepSequencerContent(track.id);
        } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            // Select all
            e.preventDefault();
            selectAll(track);
        }
    });
}

// Toggle a note at position
function toggleNote(track, row, step, altKey = false) {
    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];
    if (!activeSeq || !activeSeq.data) return;

    const currentNote = activeSeq.data[row]?.[step];
    
    // Capture undo state
    if (track.appServices?.captureStateForUndo) {
        track.appServices.captureStateForUndo('Toggle note');
    }

    if (currentNote !== null && currentNote !== undefined) {
        // Note exists - delete it
        if (!activeSeq.data[row]) activeSeq.data[row] = [];
        activeSeq.data[row][step] = null;
    } else {
        // Add new note
        if (!activeSeq.data[row]) activeSeq.data[row] = [];
        activeSeq.data[row][step] = {
            velocity: 0.8,
            duration: 1
        };
    }

    // Update track
    if (track.recreateToneSequence) {
        track.recreateToneSequence(true);
    }
    if (track.appServices?.updateTrackUI) {
        track.appServices.updateTrackUI(track.id, 'sequenceChanged');
    }

    renderStepSequencerContent(track.id);
}

// Add note at position (for drag painting)
function addNoteAt(track, row, step, altKey = false) {
    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];
    if (!activeSeq || !activeSeq.data) return;

    if (!activeSeq.data[row]) activeSeq.data[row] = [];
    
    // Only add if cell is empty
    if (activeSeq.data[row][step] === null || activeSeq.data[row][step] === undefined) {
        activeSeq.data[row][step] = {
            velocity: altKey ? 0.3 : 0.8,
            duration: 1
        };

        if (track.recreateToneSequence) {
            track.recreateToneSequence(true);
        }
        if (track.appServices?.updateTrackUI) {
            track.appServices.updateTrackUI(track.id, 'sequenceChanged');
        }
    }
}

// Delete note at position
function deleteNoteAt(track, row, step) {
    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];
    if (!activeSeq || !activeSeq.data) return;

    if (activeSeq.data[row]?.[step] !== null && activeSeq.data[row]?.[step] !== undefined) {
        if (track.appServices?.captureStateForUndo) {
            track.appServices.captureStateForUndo('Delete note');
        }

        activeSeq.data[row][step] = null;

        if (track.recreateToneSequence) {
            track.recreateToneSequence(true);
        }
        if (track.appServices?.updateTrackUI) {
            track.appServices.updateTrackUI(track.id, 'sequenceChanged');
        }

        renderStepSequencerContent(track.id);
    }
}

// Clear all notes
function clearAllNotes(track) {
    if (track.appServices?.captureStateForUndo) {
        track.appServices.captureStateForUndo('Clear all notes');
    }

    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];
    if (!activeSeq || !activeSeq.data) return;

    // Clear all notes but preserve structure
    for (let r = 0; r < activeSeq.data.length; r++) {
        for (let s = 0; s < (activeSeq.data[r]?.length || 0); s++) {
            activeSeq.data[r][s] = null;
        }
    }

    if (track.recreateToneSequence) {
        track.recreateToneSequence(true);
    }
    if (track.appServices?.updateTrackUI) {
        track.appServices.updateTrackUI(track.id, 'sequenceChanged');
    }

    renderStepSequencerContent(track.id);
}

// Select a range of cells
function selectRange(startRow, startStep, endRow, endStep) {
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minStep = Math.min(startStep, endStep);
    const maxStep = Math.max(startStep, endStep);

    for (let r = minRow; r <= maxRow; r++) {
        for (let s = minStep; s <= maxStep; s++) {
            selectedCells.add(`${r}-${s}`);
        }
    }

    renderStepSequencerContent(currentStepSequencerTrackId);
}

// Select all notes
function selectAll(track) {
    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];
    if (!activeSeq || !activeSeq.data) return;

    for (let r = 0; r < activeSeq.data.length; r++) {
        for (let s = 0; s < (activeSeq.data[r]?.length || 0); s++) {
            if (activeSeq.data[r][s] !== null && activeSeq.data[r][s] !== undefined) {
                selectedCells.add(`${r}-${s}`);
            }
        }
    }

    renderStepSequencerContent(track.id);
}

// Delete selected notes
function deleteSelectedNotes(track) {
    if (selectedCells.size === 0) return;

    if (track.appServices?.captureStateForUndo) {
        track.appServices.captureStateForUndo(`Delete ${selectedCells.size} notes`);
    }

    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];
    if (!activeSeq || !activeSeq.data) return;

    selectedCells.forEach(key => {
        const [r, s] = key.split('-').map(Number);
        if (activeSeq.data[r]) {
            activeSeq.data[r][s] = null;
        }
    });

    selectedCells.clear();

    if (track.recreateToneSequence) {
        track.recreateToneSequence(true);
    }
    if (track.appServices?.updateTrackUI) {
        track.appServices.updateTrackUI(track.id, 'sequenceChanged');
    }

    renderStepSequencerContent(track.id);
}

// Show velocity editor for a step
function showVelocityEditor(track, step) {
    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];
    if (!activeSeq || !activeSeq.data) return;

    // Find all notes at this step and let user adjust velocity
    const notesAtStep = [];
    for (let r = 0; r < activeSeq.data.length; r++) {
        if (activeSeq.data[r]?.[step] !== null && activeSeq.data[r]?.[step] !== undefined) {
            notesAtStep.push({ row: r, note: activeSeq.data[r][step] });
        }
    }

    if (notesAtStep.length === 0) {
        if (track.appServices?.showNotification) {
            track.appServices.showNotification('No notes at this step', 1500);
        }
        return;
    }

    // Simple velocity adjustment - set all notes at this step to same velocity
    const avgVelocity = notesAtStep.reduce((sum, n) => sum + (n.note.velocity || 0.8), 0) / notesAtStep.length;
    const newVelocity = prompt(`Set velocity for ${notesAtStep.length} note(s) at step ${step + 1} (current: ${Math.round(avgVelocity * 100)}%):`, Math.round(avgVelocity * 100));

    if (newVelocity !== null) {
        const velocity = Math.max(0, Math.min(100, parseInt(newVelocity) || 80)) / 100;
        
        if (track.appServices?.captureStateForUndo) {
            track.appServices.captureStateForUndo('Adjust velocity');
        }

        notesAtStep.forEach(({ row }) => {
            if (activeSeq.data[row]) {
                activeSeq.data[row][step].velocity = velocity;
            }
        });

        if (track.recreateToneSequence) {
            track.recreateToneSequence(true);
        }
        if (track.appServices?.updateTrackUI) {
            track.appServices.updateTrackUI(track.id, 'sequenceChanged');
        }

        renderStepSequencerContent(track.id);
    }
}

// Update the step sequencer panel
export function updateStepSequencerPanel() {
    const container = document.getElementById('stepSequencerContent');
    if (container) {
        renderStepSequencerContent();
    }
}

// Get the step sequencer window
export function getStepSequencerWindow() {
    return stepSequencerWindow;
}
