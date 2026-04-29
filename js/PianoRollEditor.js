// js/PianoRollEditor.js - Piano Roll Editor with Note Editing
// A true piano roll showing notes as bars on a timeline with full note editing capabilities

let localAppServices = {};
let pianoRollWindow = null;
let currentPianoRollTrackId = null;

// Drag state
let dragState = {
    active: false,
    type: null, // 'create', 'move', 'resize-start', 'resize-end', 'select'
    startX: 0,
    startY: 0,
    originalNotes: [],
    currentX: 0,
    currentY: 0
};

// Selection state
let selectedNotes = new Set(); // Set of "row-step" keys for step sequencer, or note IDs for piano roll

// Grid settings
const PIANO_ROLL_PPI = 100; // Pixels per note (width of one whole note at 1x zoom)
const NOTE_HEIGHT = 16; // Height of each note row in pixels
const VELOCITY_LANE_HEIGHT = 0; // No velocity lane in piano roll
const PIANO_KEY_WIDTH = 50; // Width of piano keys column

// Zoom/scroll state
let horizontalZoom = 1.0; // 1.0 = 100%, 0.5 = 50% (wider), 2.0 = 200% (compressed)
let verticalZoom = 1.0;
let scrollX = 0;
let scrollY = 0;

// Quantize grid (for snapping)
let quantizeGrid = 16; // 16 = 16th notes

export function initPianoRollEditor(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    console.log('[PianoRollEditor] Module initialized');
}

// Open the Piano Roll editor for a track
export function openPianoRollEditor(trackId = null) {
    const windowId = 'pianoRollEditor';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderPianoRollContent(trackId);
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'pianoRollContent';
    contentContainer.className = 'p-0 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';

    const options = {
        width: 1000,
        height: 600,
        minWidth: 700,
        minHeight: 400,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Piano Roll', contentContainer, options);
    if (win?.element) {
        pianoRollWindow = win;
        renderPianoRollContent(trackId);
    }

    return win;
}

// Render the piano roll content
function renderPianoRollContent(trackId = null) {
    const container = document.getElementById('pianoRollContent');
    if (!container) return;

    // Get track
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const activeTrackId = trackId || currentPianoRollTrackId || (tracks.length > 0 ? tracks[0].id : null);
    const track = tracks.find(t => t.id === activeTrackId);

    if (!track) {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-gray-500">
                <p>No track selected. Create a track first.</p>
            </div>
        `;
        return;
    }

    currentPianoRollTrackId = track.id;

    // Determine track type and get sequence data
    const isDrumTrack = track.type === 'DrumSampler';
    const isMelodicTrack = track.type === 'Synth' || track.type === 'Sampler' || track.type === 'MIDI';
    const activeSeq = track.sequences?.find(s => s.id === track.activeSequenceId) || track.sequences?.[0];

    // Build toolbar HTML
    let toolbarHtml = `
        <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 flex-shrink-0">
            <div class="flex items-center gap-3">
                <select id="pianoRollTrackSelect" class="px-2 py-1 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                    ${tracks.map(t => `<option value="${t.id}" ${t.id === track.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>
                <span class="text-xs text-gray-500 px-2 py-1 bg-gray-200 dark:bg-slate-800 rounded">${track.type}</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Snap:</span>
                <select id="pianoRollSnap" class="px-2 py-1 text-sm bg-white dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded">
                    <option value="1">1/1</option>
                    <option value="2">1/2</option>
                    <option value="4">1/4</option>
                    <option value="8" selected>1/8</option>
                    <option value="16">1/16</option>
                    <option value="32">1/32</option>
                    <option value="0">Off</option>
                </select>
                <div class="flex items-center gap-1 ml-2">
                    <button id="pianoRollZoomOut" class="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded" title="Zoom Out">−</button>
                    <span id="pianoRollZoomLabel" class="text-xs text-gray-600 dark:text-gray-400 w-12 text-center">${Math.round(horizontalZoom * 100)}%</span>
                    <button id="pianoRollZoomIn" class="px-2 py-1 text-xs bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500 rounded" title="Zoom In">+</button>
                </div>
                <button id="pianoRollDelete" class="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 rounded text-white" title="Delete Selected">Delete</button>
                <button id="pianoRollScaleLength" class="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 rounded text-white" title="Scale Selected Note Lengths">Scale Len</button>
                <button id="pianoRollClose" class="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 rounded text-white">Close</button>
            </div>
        </div>
    `;

    // Build piano roll area
    const numSteps = activeSeq?.data?.[0]?.length || 32;
    const numRows = activeSeq?.data?.length || 16;
    const totalWidth = numSteps * PIANO_ROLL_PPI * horizontalZoom;
    const totalHeight = numRows * NOTE_HEIGHT * verticalZoom;

    // Build piano keys (left side)
    let pianoKeysHtml = `<div class="flex-shrink-0" style="width: ${PIANO_KEY_WIDTH}px;">`;
    pianoKeysHtml += `<div class="h-8 border-b border-gray-300 dark:border-slate-600 bg-gray-200 dark:bg-slate-700"></div>`; // Header spacer
    for (let r = numRows - 1; r >= 0; r--) {
        let keyLabel = '';
        if (isDrumTrack) {
            const padNames = ['Kick', 'Snare', 'Clap', 'HH-C', 'HH-O', 'Tom1', 'Tom2', 'Rim', 'Cowbell', 'Crash', 'Ride', 'Shaker', 'Perc1', 'Perc2', 'FX1', 'FX2'];
            keyLabel = padNames[r] || `P${r + 1}`;
        } else {
            const noteNum = r;
            const octave = Math.floor(noteNum / 12);
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const noteName = noteNames[noteNum % 12];
            keyLabel = `${noteName}${octave}`;
        }
        const isBlackKey = keyLabel.includes('#');
        pianoKeysHtml += `
            <div class="flex items-center justify-end pr-2 border-b border-gray-300 dark:border-slate-600 ${isBlackKey ? 'bg-gray-800 text-white text-opacity-70' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'}"
                 style="height: ${NOTE_HEIGHT * verticalZoom}px; font-size: 10px;">
                ${keyLabel}
            </div>
        `;
    }
    pianoKeysHtml += '</div>';

    // Build time ruler and grid area
    let gridAreaHtml = `<div class="flex-1 overflow-auto relative" id="pianoRollGridArea">`;
    
    // Time ruler (header)
    gridAreaHtml += `
        <div class="stick top-0 z-10 bg-gray-200 dark:bg-slate-700 border-b border-gray-300 dark:border-slate-600 flex" style="height: 32px; min-width: ${totalWidth}px;">
            <div class="flex-shrink-0" style="width: ${PIANO_KEY_WIDTH}px;"></div>
    `;
    for (let s = 0; s < numSteps; s++) {
        const isDownbeat = s % 4 === 0;
        const beatNum = Math.floor(s / 4) + 1;
        const stepInBeat = s % 4;
        gridAreaHtml += `
            <div class="flex-shrink-0 text-center text-xs ${isDownbeat ? 'text-blue-600 font-bold border-l-2 border-blue-400' : 'text-gray-400 border-l border-gray-300 dark:border-slate-600'}"
                 style="width: ${PIANO_ROLL_PPI * horizontalZoom}px; line-height: 32px;">
                ${isDownbeat ? beatNum : ''}
            </div>
        `;
    }
    gridAreaHtml += '</div>';

    // Note grid (scrollable area)
    gridAreaHtml += `<div class="relative" style="min-width: ${totalWidth}px; min-height: ${totalHeight}px;">`;
    
    // Background grid lines
    for (let r = numRows - 1; r >= 0; r--) {
        const isBlackKey = !isDrumTrack && [1, 3, 6, 8, 10].includes(r % 12);
        for (let s = 0; s < numSteps; s++) {
            const isDownbeat = s % 4 === 0;
            gridAreaHtml += `
                <div class="absolute border-l border-gray-200 dark:border-slate-700 ${isDownbeat ? 'border-l-blue-300' : ''} ${isBlackKey ? 'bg-gray-900 dark:bg-slate-900' : 'bg-gray-50 dark:bg-slate-800'}"
                     data-grid-row="${r}" data-grid-step="${s}"
                     style="left: ${s * PIANO_ROLL_PPI * horizontalZoom}px; top: ${(numRows - 1 - r) * NOTE_HEIGHT * verticalZoom}px; 
                            width: ${PIANO_ROLL_PPI * horizontalZoom}px; height: ${NOTE_HEIGHT * verticalZoom}px;">
                </div>
            `;
        }
    }

    // Render notes from sequence
    if (activeSeq?.data) {
        for (let r = 0; r < activeSeq.data.length; r++) {
            for (let s = 0; s < (activeSeq.data[r]?.length || 0); s++) {
                const note = activeSeq.data[r][s];
                if (note !== null && note !== undefined) {
                    const velocity = note.velocity || 0.8;
                    const duration = note.duration || 1;
                    const yPos = (numRows - 1 - r) * NOTE_HEIGHT * verticalZoom;
                    const xPos = s * PIANO_ROLL_PPI * horizontalZoom;
                    const noteWidth = Math.max(4, PIANO_ROLL_PPI * horizontalZoom * duration * 0.9);
                    const noteHeight = Math.max(4, NOTE_HEIGHT * verticalZoom - 2);
                    const noteId = `pr-note-${r}-${s}`;
                    const isSelected = selectedNotes.has(noteId);

                    gridAreaHtml += `
                        <div class="absolute rounded cursor-move note-block ${isSelected ? 'ring-2 ring-yellow-400' : ''}"
                             data-note-row="${r}" data-note-step="${s}" data-note-id="${noteId}"
                             style="left: ${xPos + 2}px; top: ${yPos + 1}px; 
                                    width: ${noteWidth}px; height: ${noteHeight}px;
                                    background-color: rgba(59, 130, 246, ${0.4 + velocity * 0.6});
                                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                            <div class="w-full h-full flex items-center justify-center">
                                <div class="w-2 h-2 rounded-full bg-white opacity-60"></div>
                            </div>
                        </div>
                    `;
                }
            }
        }
    }

    gridAreaHtml += '</div>'; // End note grid
    gridAreaHtml += '</div>'; // End grid area

    container.innerHTML = toolbarHtml + `<div class="flex flex-1 overflow-hidden">${pianoKeysHtml}${gridAreaHtml}</div>`;

    // Attach event listeners
    setupPianoRollEvents(container, track, activeSeq);
}

// Setup event handlers for the piano roll
function setupPianoRollEvents(container, track, activeSeq) {
    // Track selection
    const trackSelect = container.querySelector('#pianoRollTrackSelect');
    if (trackSelect) {
        trackSelect.addEventListener('change', (e) => {
            const newTrackId = parseInt(e.target.value);
            selectedNotes.clear();
            renderPianoRollContent(newTrackId);
        });
    }

    // Snap selection
    const snapSelect = container.querySelector('#pianoRollSnap');
    if (snapSelect) {
        snapSelect.addEventListener('change', (e) => {
            quantizeGrid = parseInt(e.target.value) || 0;
        });
    }

    // Zoom controls
    const zoomInBtn = container.querySelector('#pianoRollZoomIn');
    const zoomOutBtn = container.querySelector('#pianoRollZoomOut');
    const zoomLabel = container.querySelector('#pianoRollZoomLabel');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            horizontalZoom = Math.min(4.0, horizontalZoom * 1.25);
            verticalZoom = Math.min(4.0, verticalZoom * 1.25);
            if (zoomLabel) zoomLabel.textContent = `${Math.round(horizontalZoom * 100)}%`;
            renderPianoRollContent(currentPianoRollTrackId);
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            horizontalZoom = Math.max(0.25, horizontalZoom / 1.25);
            verticalZoom = Math.max(0.25, verticalZoom / 1.25);
            if (zoomLabel) zoomLabel.textContent = `${Math.round(horizontalZoom * 100)}%`;
            renderPianoRollContent(currentPianoRollTrackId);
        });
    }

    // Delete button
    const deleteBtn = container.querySelector('#pianoRollDelete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            deleteSelectedNotes(track, activeSeq);
        });
    }

    // Scale Length button
    const scaleLenBtn = container.querySelector('#pianoRollScaleLength');
    if (scaleLenBtn) {
        scaleLenBtn.addEventListener('click', () => {
            // Expose selected notes globally for the scaler
            window.selectedNotes = selectedNotes;
            window.currentPianoRollTrackId = currentPianoRollTrackId;
            // Open the scale length prompt
            import('./NoteLengthScaler.js').then(m => {
                if (m.initNoteLengthScaler) m.initNoteLengthScaler(localAppServices);
                if (m.openNoteLengthScaler) m.openNoteLengthScaler();
            }).catch(err => {
                console.error('[PianoRollEditor] Failed to load NoteLengthScaler:', err);
                // Fallback: simple prompt
                const scalePercent = prompt('Scale selected notes length by percentage:\n\nEnter a percentage (e.g., 150 for 150%, 50 for 50%)', '150');
                if (scalePercent === null) return;
                const scaleFactor = parseFloat(scalePercent) / 100;
                if (isNaN(scaleFactor) || scaleFactor <= 0) {
                    localAppServices.showNotification?.('Invalid scale percentage', 2000);
                    return;
                }
                // Scale notes directly
                if (selectedNotes.size > 0 && activeSeq?.data) {
                    if (track.appServices?.captureStateForUndo) {
                        track.appServices.captureStateForUndo(`Scale note length by ${Math.round(scaleFactor * 100)}%`);
                    }
                    let scaledCount = 0;
                    selectedNotes.forEach(id => {
                        const [r, s] = id.replace('pr-note-', '').split('-').map(Number);
                        const note = activeSeq.data?.[r]?.[s];
                        if (note && typeof note.duration === 'number') {
                            note.duration = Math.max(0.0625, Math.min(16, note.duration * scaleFactor));
                            scaledCount++;
                        }
                    });
                    if (scaledCount > 0) {
                        if (track.recreateToneSequence) track.recreateToneSequence(true);
                        if (track.appServices?.updateTrackUI) track.appServices.updateTrackUI(track.id, 'sequenceChanged');
                        renderPianoRollContent(currentPianoRollTrackId);
                        localAppServices.showNotification?.(`Scaled ${scaledCount} note(s) to ${Math.round(scaleFactor * 100)}%`, 2000);
                    }
                } else {
                    localAppServices.showNotification?.('No notes selected', 2000);
                }
            });
        });
    }

    // Close button
    const closeBtn = container.querySelector('#pianoRollClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (pianoRollWindow?.close) pianoRollWindow.close();
        });
    }

    // Note click handling
    container.querySelectorAll('.note-block').forEach(noteEl => {
        noteEl.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const noteRow = parseInt(noteEl.dataset.noteRow);
            const noteStep = parseInt(noteEl.dataset.noteStep);
            const noteId = noteEl.dataset.noteId;

            // Toggle selection
            if (e.shiftKey) {
                if (selectedNotes.has(noteId)) {
                    selectedNotes.delete(noteId);
                } else {
                    selectedNotes.add(noteId);
                }
                renderPianoRollContent(currentPianoRollTrackId);
            } else {
                // Start drag to move
                if (selectedNotes.has(noteId)) {
                    // Drag all selected notes
                    dragState = {
                        active: true,
                        type: 'move',
                        startX: e.clientX,
                        startY: e.clientY,
                        originalNotes: Array.from(selectedNotes).map(id => {
                            const [r, s] = id.replace('pr-note-', '').split('-').map(Number);
                            return { id, row: r, step: s };
                        })
                    };
                } else {
                    // Select this note and start move
                    selectedNotes.clear();
                    selectedNotes.add(noteId);
                    dragState = {
                        active: true,
                        type: 'move',
                        startX: e.clientX,
                        startY: e.clientY,
                        originalNotes: [{ id: noteId, row: noteRow, step: noteStep }]
                    };
                }
                renderPianoRollContent(currentPianoRollTrackId);
            }
        });

        // Double-click to edit note properties
        noteEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const noteRow = parseInt(noteEl.dataset.noteRow);
            const noteStep = parseInt(noteEl.dataset.noteStep);
            editNoteProperties(track, activeSeq, noteRow, noteStep);
        });
    });

    // Grid click to create note
    container.querySelectorAll('[data-grid-row]').forEach(gridCell => {
        gridCell.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('note-block')) return;
            const row = parseInt(gridCell.dataset.gridRow);
            const step = parseInt(gridCell.dataset.gridStep);
            createNoteAt(track, activeSeq, row, step, e.altKey ? 0.3 : 0.8);
        });
    });

    // Mouse drag for moving notes
    document.addEventListener('mousemove', (e) => {
        if (!dragState.active) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        if (dragState.type === 'move' && activeSeq) {
            // Calculate step offset based on drag distance
            const stepOffset = Math.round(dx / (PIANO_ROLL_PPI * horizontalZoom));
            const rowOffset = -Math.round(dy / (NOTE_HEIGHT * verticalZoom));

            // Move selected notes visually (apply later)
            dragState.currentX = dx;
            dragState.currentY = dy;

            // Update note positions during drag
            document.querySelectorAll('.note-block').forEach(noteEl => {
                const noteId = noteEl.dataset.noteId;
                const original = dragState.originalNotes.find(n => n.id === noteId);
                if (original) {
                    const xPos = (original.step + stepOffset) * PIANO_ROLL_PPI * horizontalZoom + 2;
                    const yPos = (parseInt(activeSeq.data?.length || 16) - 1 - original.row - rowOffset) * NOTE_HEIGHT * verticalZoom + 1;
                    noteEl.style.opacity = '0.7';
                    noteEl.style.left = `${xPos}px`;
                    noteEl.style.top = `${yPos}px`;
                }
            });
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (!dragState.active) return;

        if (dragState.type === 'move' && activeSeq) {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            const stepOffset = Math.round(dx / (PIANO_ROLL_PPI * horizontalZoom));
            const rowOffset = -Math.round(dy / (NOTE_HEIGHT * verticalZoom));

            if (stepOffset !== 0 || rowOffset !== 0) {
                // Apply move to actual sequence
                if (track.appServices?.captureStateForUndo) {
                    track.appServices.captureStateForUndo('Move notes');
                }

                dragState.originalNotes.forEach(({ id, row, step }) => {
                    const newStep = Math.max(0, step + stepOffset);
                    const newRow = Math.max(0, Math.min((activeSeq.data?.length || 16) - 1, row + rowOffset));

                    // Get original note data
                    const note = activeSeq.data?.[row]?.[step];
                    if (note) {
                        // Remove from old position
                        if (activeSeq.data[row]) {
                            activeSeq.data[row][step] = null;
                        }
                        // Place at new position
                        if (!activeSeq.data[newRow]) activeSeq.data[newRow] = [];
                        activeSeq.data[newRow][newStep] = { ...note };
                    }
                });

                if (track.recreateToneSequence) {
                    track.recreateToneSequence(true);
                }
                if (track.appServices?.updateTrackUI) {
                    track.appServices.updateTrackUI(track.id, 'sequenceChanged');
                }
            }
        }

        dragState.active = false;
        dragState.type = null;
        selectedNotes.clear();
        renderPianoRollContent(currentPianoRollTrackId);
    });

    // Keyboard shortcuts
    container.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelectedNotes(track, activeSeq);
        } else if (e.key === 'Escape') {
            selectedNotes.clear();
            renderPianoRollContent(currentPianoRollTrackId);
        } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            // Select all notes
            if (activeSeq?.data) {
                for (let r = 0; r < activeSeq.data.length; r++) {
                    for (let s = 0; s < (activeSeq.data[r]?.length || 0); s++) {
                        if (activeSeq.data[r][s] !== null && activeSeq.data[r][s] !== undefined) {
                            selectedNotes.add(`pr-note-${r}-${s}`);
                        }
                    }
                }
            }
            renderPianoRollContent(currentPianoRollTrackId);
        }
    });
}

// Create a note at position
function createNoteAt(track, activeSeq, row, step, velocity = 0.8) {
    if (!activeSeq || !activeSeq.data) return;

    if (track.appServices?.captureStateForUndo) {
        track.appServices.captureStateForUndo('Create note');
    }

    if (!activeSeq.data[row]) activeSeq.data[row] = [];
    
    // If cell is occupied, delete instead
    if (activeSeq.data[row][step] !== null && activeSeq.data[row][step] !== undefined) {
        activeSeq.data[row][step] = null;
    } else {
        // Add new note
        activeSeq.data[row][step] = {
            velocity: velocity,
            duration: 1
        };
    }

    if (track.recreateToneSequence) {
        track.recreateToneSequence(true);
    }
    if (track.appServices?.updateTrackUI) {
        track.appServices.updateTrackUI(track.id, 'sequenceChanged');
    }

    renderPianoRollContent(currentPianoRollTrackId);
}

// Delete selected notes
function deleteSelectedNotes(track, activeSeq) {
    if (selectedNotes.size === 0) return;

    if (track.appServices?.captureStateForUndo) {
        track.appServices.captureStateForUndo(`Delete ${selectedNotes.size} note(s)`);
    }

    if (activeSeq?.data) {
        selectedNotes.forEach(id => {
            const [r, s] = id.replace('pr-note-', '').split('-').map(Number);
            if (activeSeq.data[r]) {
                activeSeq.data[r][s] = null;
            }
        });
    }

    selectedNotes.clear();

    if (track.recreateToneSequence) {
        track.recreateToneSequence(true);
    }
    if (track.appServices?.updateTrackUI) {
        track.appServices.updateTrackUI(track.id, 'sequenceChanged');
    }

    renderPianoRollContent(currentPianoRollTrackId);
}

// Edit note properties (velocity, duration)
function editNoteProperties(track, activeSeq, row, step) {
    if (!activeSeq?.data?.[row]?.[step]) return;

    const note = activeSeq.data[row][step];
    const currentVelocity = Math.round((note.velocity || 0.8) * 100);
    const currentDuration = note.duration || 1;

    const velocityInput = prompt(`Set velocity (1-100):`, currentVelocity);
    if (velocityInput !== null) {
        const newVelocity = Math.max(1, Math.min(100, parseInt(velocityInput) || 80)) / 100;
        
        if (track.appServices?.captureStateForUndo) {
            track.appServices.captureStateForUndo('Edit note');
        }

        note.velocity = newVelocity;

        if (track.recreateToneSequence) {
            track.recreateToneSequence(true);
        }
        if (track.appServices?.updateTrackUI) {
            track.appServices.updateTrackUI(track.id, 'sequenceChanged');
        }

        renderPianoRollContent(currentPianoRollTrackId);
    }
}

// Update the piano roll panel
export function updatePianoRollPanel() {
    const container = document.getElementById('pianoRollContent');
    if (container) {
        renderPianoRollContent();
    }
}

// Get the piano roll window
export function getPianoRollWindow() {
    return pianoRollWindow;
}