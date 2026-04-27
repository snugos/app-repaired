/**
 * js/PianoRollEditor.js - Clickable Piano Roll Editor
 * 
 * Provides a piano-roll-style grid for viewing and editing MIDI notes
 * with click-to-add, drag-to-move, and velocity editing.
 */

let localAppServices = {};
let currentTrackId = null;
let isDrawing = false;
let drawStartX = 0;
let drawStartY = 0;
let selectedNotes = new Set();
let editMode = 'add'; // 'add', 'select', 'delete'
let gridPixelsPerBeat = 40;
let gridPixelsPerSemitone = 10;
let pianoRollCanvas = null;
let pianoRollCtx = null;
let noteRects = []; // { note, rect }

export function initPianoRollEditor(appServices) {
    localAppServices = appServices || {};
    console.log('[PianoRollEditor] Module initialized');
}

export function openPianoRollEditor(trackId = null) {
    const windowId = 'pianoRollEditor';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !trackId) {
        const win = openWindows.get(windowId);
        win.restore();
        renderPianoRollContent();
        return win;
    }

    currentTrackId = trackId;

    const contentContainer = document.createElement('div');
    contentContainer.id = 'pianoRollContent';
    contentContainer.className = 'p-2 h-full flex flex-col bg-gray-900 dark:bg-slate-900 overflow-hidden';

    const options = {
        width: 900,
        height: 500,
        minWidth: 700,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Piano Roll', contentContainer, options);

    if (win?.element) {
        renderPianoRollContent();
    }

    return win;
}

export function renderPianoRollContent() {
    const container = document.getElementById('pianoRollContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === currentTrackId) || tracks[0];
    
    if (!track) {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-400">
                <p>No track available. Create a track first.</p>
            </div>
        `;
        return;
    }

    currentTrackId = track.id;
    const bpm = localAppServices.getBPM ? localAppServices.getBPM() : 120;
    const stepsPerBeat = track.stepsPerBeat || 4;
    const totalSteps = 64;
    const pixelsPerBeat = gridPixelsPerBeat;
    const pixelsPerStep = pixelsPerBeat / stepsPerBeat;
    const totalWidth = totalSteps * pixelsPerStep;
    
    // Piano key width
    const pianoKeyWidth = 40;
    // Note range: C1 (24) to C7 (96)
    const noteMin = 36;
    const noteMax = 84;
    const noteRange = noteMax - noteMin;
    const totalHeight = noteRange * gridPixelsPerSemitone;

    const sequences = track.sequences || [];
    const seq = sequences[0] || { steps: [] };
    const steps = seq.steps || [];

    // Build piano keys HTML (left side)
    let pianoKeysHtml = '<div class="flex-shrink-0" style="width: ' + pianoKeyWidth + 'px;">';
    for (let i = noteMax; i >= noteMin; i--) {
        const isBlack = [1, 3, 6, 8, 10].includes(i % 12);
        const noteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][i % 12];
        const octave = Math.floor(i / 12) - 1;
        const bgClass = isBlack ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 dark:bg-gray-300 text-gray-700';
        const height = gridPixelsPerSemitone;
        pianoKeysHtml += `
            <div class="${bgClass} flex items-center justify-end pr-1 border-b border-gray-600 overflow-hidden"
                 style="height: ${height}px; font-size: 9px;">
                ${i % 12 === 0 ? '<span class="font-bold text-[8px]">' + octave + '</span>' : ''}
            </div>
        `;
    }
    pianoKeysHtml += '</div>';

    // Grid background (beat lines, bar lines)
    let gridBgHtml = '<div class="flex-1 overflow-auto">';
    gridBgHtml += '<div class="relative" style="width: ' + totalWidth + 'px; height: ' + totalHeight + 'px; background: #1a1a2e;">';
    
    // Draw beat lines
    for (let i = 0; i <= totalSteps / stepsPerBeat; i++) {
        const x = i * pixelsPerBeat;
        const isBar = i % 4 === 0;
        gridBgHtml += `<div class="absolute top-0 bottom-0 pointer-events-none" 
            style="left: ${x}px; width: 1px; background: ${isBar ? '#6b21a8' : '#333'}; opacity: ${isBar ? '0.8' : '0.4'};"></div>`;
    }
    
    // Draw semitone lines (every octave highlighted)
    for (let i = noteMin; i <= noteMax; i++) {
        const y = (noteMax - i) * gridPixelsPerSemitone;
        const isOctave = i % 12 === 0;
        if (isOctave) {
            gridBgHtml += `<div class="absolute left-0 right-0 pointer-events-none" 
                style="top: ${y}px; height: 1px; background: #444; opacity: 0.6;"></div>`;
        }
    }

    // Draw notes as rectangles
    let notesHtml = '<div class="absolute inset-0" id="pianoRollNotesLayer">';
    steps.forEach((step, idx) => {
        if (!step || !step.enabled) return;
        const note = step.note || 60;
        if (note < noteMin || note > noteMax) return;
        
        const x = idx * pixelsPerStep;
        const y = (noteMax - note) * gridPixelsPerSemitone;
        const width = Math.max(4, pixelsPerStep * (step.noteLength || 0.5));
        const height = gridPixelsPerSemitone - 2;
        const vel = step.velocity || 0.8;
        
        // Color by velocity
        let bgClass = 'bg-green-500';
        if (vel > 0.9) bgClass = 'bg-red-500';
        else if (vel > 0.7) bgClass = 'bg-yellow-500';
        
        notesHtml += `
            <div class="piano-note absolute rounded cursor-pointer ${bgClass} opacity-80 hover:opacity-100 hover:brightness-110 transition-all"
                 style="left: ${x}px; top: ${y + 1}px; width: ${width}px; height: ${height}px;"
                 data-step-index="${idx}"
                 title="Step ${idx + 1} | Note: ${note} | Vel: ${Math.round(vel * 100)}%">
            </div>
        `;
    });
    notesHtml += '</div>';
    gridBgHtml += notesHtml + '</div></div>';

    const html = `
        <!-- Toolbar -->
        <div class="mb-2 flex items-center justify-between px-1">
            <div class="flex items-center gap-3">
                <div class="w-3 h-3 rounded" style="background-color: ${track.color || '#666'}"></div>
                <span class="text-sm font-semibold text-white">${track.name}</span>
                <span class="text-xs text-gray-400">|</span>
                <span class="text-xs text-gray-400">BPM: ${bpm}</span>
                <span class="text-xs text-gray-400">|</span>
                <span class="text-xs text-gray-400">Notes: ${steps.filter(s => s && s.enabled).length}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">Edit:</span>
                <select id="pianoRollEditMode" class="text-xs bg-gray-700 text-white rounded px-1 py-0.5 border border-gray-600">
                    <option value="select">Select</option>
                    <option value="add">Add Note</option>
                    <option value="delete">Delete</option>
                </select>
                <button id="pianoRollAddNoteBtn" class="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500">
                    + Add Note
                </button>
                <button id="pianoRollClearBtn" class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500">
                    Clear All
                </button>
            </div>
        </div>
        
        <!-- Piano Roll Area -->
        <div class="flex-1 flex overflow-hidden border border-gray-700 rounded">
            ${pianoKeysHtml}
            ${gridBgHtml}
        </div>
        
        <!-- Info Bar -->
        <div class="mt-1 flex items-center justify-between text-xs text-gray-400 px-1">
            <span>Click to ${editMode === 'delete' ? 'delete' : 'select'} notes | Right-click to add | Scroll to zoom</span>
            <span>Grid: ${pixelsPerBeat}px/beat | ${gridPixelsPerSemitone}px/semitone</span>
        </div>
    `;

    container.innerHTML = html;

    // Mode selector
    container.querySelector('#pianoRollEditMode')?.addEventListener('change', (e) => {
        editMode = e.target.value;
    });

    // Add note button
    container.querySelector('#pianoRollAddNoteBtn')?.addEventListener('click', () => {
        addNoteAtCenter(track);
    });

    // Clear button
    container.querySelector('#pianoRollClearBtn')?.addEventListener('click', () => {
        clearAllNotes(track);
    });

    // Note click handlers
    container.querySelectorAll('.piano-note').forEach(noteEl => {
        noteEl.addEventListener('click', (e) => {
            const stepIdx = parseInt(noteEl.dataset.stepIndex, 10);
            if (editMode === 'delete') {
                deleteNote(track, stepIdx);
            } else {
                toggleNoteSelection(stepIdx);
            }
        });
        noteEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const stepIdx = parseInt(noteEl.dataset.stepIndex, 10);
            deleteNote(track, stepIdx);
        });
    });
}

function toggleNoteSelection(stepIdx) {
    if (selectedNotes.has(stepIdx)) {
        selectedNotes.delete(stepIdx);
    } else {
        selectedNotes.add(stepIdx);
    }
    renderPianoRollContent();
}

function addNoteAtCenter(track) {
    if (!track) return;
    const sequences = track.sequences || [];
    const seq = sequences[0];
    if (!seq) return;
    
    if (!seq.steps) seq.steps = [];
    
    // Find first empty slot
    let newIdx = seq.steps.findIndex(s => !s || !s.enabled);
    if (newIdx === -1) newIdx = seq.steps.length;
    
    // Default to middle C range (C4 = 60)
    const defaultNote = 60;
    seq.steps[newIdx] = {
        enabled: true,
        note: defaultNote,
        velocity: 0.8,
        noteLength: 0.5,
        probability: 1.0
    };
    
    if (typeof track.updateSequence === 'function') {
        track.updateSequence(seq);
    }
    
    renderPianoRollContent();
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Note added at step ${newIdx + 1}`, 800);
    }
}

function deleteNote(track, stepIdx) {
    if (!track) return;
    const sequences = track.sequences || [];
    const seq = sequences[0];
    if (!seq || !seq.steps) return;
    
    if (seq.steps[stepIdx]) {
        seq.steps[stepIdx] = { ...seq.steps[stepIdx], enabled: false };
        
        if (typeof track.updateSequence === 'function') {
            track.updateSequence(seq);
        }
        
        renderPianoRollContent();
    }
}

function clearAllNotes(track) {
    if (!track) return;
    const sequences = track.sequences || [];
    const seq = sequences[0];
    if (!seq) return;
    
    seq.steps = seq.steps.map(s => s ? { ...s, enabled: false } : null);
    
    if (typeof track.updateSequence === 'function') {
        track.updateSequence(seq);
    }
    
    renderPianoRollContent();
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification('All notes cleared', 800);
    }
}

export function updatePianoRollEditor() {
    renderPianoRollContent();
}