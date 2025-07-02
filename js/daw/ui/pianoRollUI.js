// js/daw/ui/pianoRollUI.js - Piano Roll UI Management with Konva.js

// Corrected imports for state modules
import { getTrackById } from '/app/js/daw/state/trackState.js'; 
import { getOpenWindows, getWindowById } from '/app/js/daw/state/windowState.js'; 
import { getClipboardData } from '/app/js/daw/state/projectState.js'; 
import { getPlaybackMode } from '/app/js/daw/state/appState.js'; 
// Corrected import for Constants
import * as Constants from '/app/js/daw/constants.js'; 


let localAppServices = {}; 
export const openPianoRolls = new Map(); 
export let lastActivePianoRollTrackId = null; 

function getThemeColors() { 
    const rootStyle = getComputedStyle(document.documentElement); 
    return { 
        gridBgLight: rootStyle.getPropertyValue('--bg-sequencer-step-odd').trim() || '#FFFFFF', 
        gridBgDark: rootStyle.getPropertyValue('--bg-sequencer-step-even').trim() || '#EEEEEE', 
        gridLine: rootStyle.getPropertyValue('--border-sequencer').trim() || '#BBBBBB', 
        gridLineBold: rootStyle.getPropertyValue('--border-primary').trim() || '#555555', 
        noteFill: rootStyle.getPropertyValue('--accent-sequencer-step').trim() || '#00BFFF', 
        noteStroke: rootStyle.getPropertyValue('--accent-sequencer-step-border').trim() || '#0000FF', 
        playhead: rootStyle.getPropertyValue('--accent-playhead').trim() || '#FF0000', 
        whiteKeyBg: rootStyle.getPropertyValue('--piano-key-white-bg').trim() || '#FFFFFF', 
        blackKeyBg: rootStyle.getPropertyValue('--piano-key-black-bg').trim() || '#4a4a4a', 
        whiteKeyText: rootStyle.getPropertyValue('--piano-key-white-text').trim() || '#000000', 
        blackKeyText: rootStyle.getPropertyValue('--piano-key-black-text').trim() || '#FFFFFF', 
        keyBorder: rootStyle.getPropertyValue('--border-secondary').trim(), 
    };
}


export function initializePianoRollUI(appServicesFromMain) { 
    localAppServices = appServicesFromMain; 
    localAppServices.openPianoRollForClip = openPianoRollForClip; 
}

export function openPianoRollForClip(trackId, clipId) { 
    const track = localAppServices.getTrackById?.(trackId); 
    const clip = track?.clips.timelineClips.find(c => c.id === clipId); 

    if (!track || !clip || clip.type !== 'midi') { 
        localAppServices.showNotification?.("Could not find a valid MIDI clip to edit.", 3000); 
        return; 
    }

    const tempSequenceName = `Editing: ${clip.name}`; 
    const sequenceLength = clip.sequenceData[0]?.length || 0; 
    const tempSequence = track.sequences.createNewSequence(tempSequenceName, sequenceLength, true); 
    tempSequence.data = JSON.parse(JSON.stringify(clip.sequenceData)); 

    openPianoRollWindow(track.id, tempSequence.id); 

    const pianoRollWindow = getWindowById(`pianoRollWin-${trackId}`); 
    if (pianoRollWindow) { 
        const originalOnClose = pianoRollWindow.onCloseCallback; 
        pianoRollWindow.onCloseCallback = () => { 
            const editedSequence = track.sequences.sequences.find(s => s.id === tempSequence.id); 
            if (editedSequence) { 
                clip.sequenceData = JSON.parse(JSON.stringify(editedSequence.data)); 
            }
            const seqIndex = track.sequences.sequences.findIndex(s => s.id === tempSequence.id); 
            if (seqIndex > -1) { 
                track.sequences.sequences.splice(seqIndex, 1); 
            }
            if (typeof originalOnClose === 'function') { 
                originalOnClose(); 
            }
            // Ensure the Tone.Sequence associated with the track is rebuilt after editing a clip
            track.sequences.recreateToneSequence();
        };
    }
}


export function openPianoRollWindow(trackId, sequenceIdToEdit = null, savedState = null) { 
    const track = localAppServices.getTrackById?.(trackId); 
    if (!track || track.type === 'Audio') return; 

    const windowId = `pianoRollWin-${trackId}`; 
    if (getOpenWindows().has(windowId) && !savedState) { 
        getWindowById(windowId).restore(); 
        return; 
    }

    const sequenceId = sequenceIdToEdit || track.sequences.getActiveSequence()?.id; 
    const activeSequence = track.sequences.sequences.find(s => s.id === sequenceId); 

    if (!activeSequence) { 
        localAppServices.showNotification?.(`Track "${track.name}" has no valid sequence to edit.`, 3500); 
        return; 
    }
    track.sequences.activeSequenceId = activeSequence.id; 
    
    const lengthInBars = (activeSequence.length / Constants.STEPS_PER_BAR).toFixed(2); 

    const contentContainer = document.createElement('div'); 
    contentContainer.className = 'w-full h-full flex flex-col bg-white dark:bg-black text-black dark:text-white sequencer-container'; 
    contentContainer.innerHTML = `
        <div class="flex-shrink-0 p-1 border-b border-gray-400 dark:border-gray-600 flex items-center justify-between text-xs">
            <div class="flex items-center space-x-2">
                <label for="sequenceLengthInput-${trackId}">Length (bars):</label>
                <input type="text" id="sequenceLengthInput-${trackId}" value="${lengthInBars}" class="w-20 p-0.5 border rounded bg-white dark:bg-black border-black dark:border-white text-black dark:text-white">
                <button id="quantizeBtn-${trackId}" class="ml-4 px-2 py-0.5 border rounded">Quantize 1/16</button>
            </div>
            <div id="piano-roll-drag-handle-${trackId}" class="cursor-grab" title="Drag to create a clip on the timeline" draggable="true">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </div>
        </div>
        <div id="pianoRollKonvaContainer-${trackId}" class="flex-grow w-full h-full overflow-auto"></div>
        <div id="velocityPaneContainer-${trackId}" class="flex-shrink-0 w-full h-1/5 bg-gray-200 dark:bg-gray-800 border-t-2 border-gray-400 dark:border-gray-600 overflow-x-auto overflow-y-hidden"></div>
    `; 

    const pianoRollWindow = localAppServices.createWindow(windowId, `Piano Roll: ${track.name}`, contentContainer, { 
        width: 800, height: 500, minWidth: 500, minHeight: 300, initialContentKey: windowId, 
        onCloseCallback: () => { 
            openPianoRolls.delete(trackId); 
            if (lastActivePianoRollTrackId === trackId) { 
                lastActivePianoRollTrackId = null; 
            }
        }
    }); 

    if (pianoRollWindow && pianoRollWindow.element) { 
        const konvaContainer = pianoRollWindow.element.querySelector(`#pianoRollKonvaContainer-${track.id}`); 
        const velocityPane = pianoRollWindow.element.querySelector(`#velocityPaneContainer-${track.id}`); 
        setTimeout(() => createPianoRollStage(konvaContainer, velocityPane, track), 50); 
    }
}

export function updatePianoRollPlayhead(transportTime) { 
    if (openPianoRolls.size === 0) return; 

    openPianoRolls.forEach(({ playhead, playheadLayer, track }) => { 
        // Check if the track's Tone.Sequence is active
        if (playhead && playheadLayer && track && track.sequences.toneSequence) { 
            const activeSequence = track.sequences.getActiveSequence(); 
            if (!activeSequence) return; 

            const loopEndSteps = activeSequence.length; 
            if (typeof loopEndSteps !== 'number' || loopEndSteps === 0) return; 

            const secondsPer16thNote = localAppServices.Tone.Time('16n').toSeconds(); 
            const loopDurationInSeconds = loopEndSteps * secondsPer16thNote; 

            if (loopDurationInSeconds === 0) return; 

            // Calculate current position within the loop
            const currentLoopTime = transportTime % loopDurationInSeconds;

            const pixelsPerSecond = (1 / secondsPer16thNote) * Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH; 
            const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH; 
            const newX = (currentLoopTime * pixelsPerSecond) + keyWidth; 

            playhead.x(newX); 
            playheadLayer.batchDraw(); 
        }
    });
}

function renderVelocityPane(velocityPane, track) { 
    if (!velocityPane) return; 
    velocityPane.innerHTML = ''; 
    const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH; 
    const noteWidth = Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH; 
    const activeSequence = track.sequences.getActiveSequence(); 
    if (!activeSequence) return; 
    const scrollWrapper = document.createElement('div'); 
    scrollWrapper.style.width = `${keyWidth + (noteWidth * activeSequence.length)}px`; 
    scrollWrapper.style.height = '100%'; 
    scrollWrapper.className = 'relative'; 
    const spacer = document.createElement('div'); 
    spacer.style.width = `${keyWidth}px`; 
    spacer.style.display = 'inline-block'; 
    scrollWrapper.appendChild(spacer); 
    const notesGrid = document.createElement('div'); 
    notesGrid.style.width = `${noteWidth * activeSequence.length}px`; 
    notesGrid.style.height = '100%'; 
    notesGrid.style.display = 'inline-block'; 
    notesGrid.className = 'relative'; 
    activeSequence.data.forEach((pitchRow, pitchIndex) => { 
        pitchRow.forEach((note, timeStep) => { 
            if (note) { 
                const velocityBar = document.createElement('div'); 
                velocityBar.className = 'velocity-bar absolute bottom-0 cursor-n-resize'; 
                velocityBar.style.left = `${timeStep * noteWidth}px`; 
                velocityBar.style.width = `${noteWidth - 1}px`; 
                velocityBar.style.height = `${(note.velocity || 0.75) * 100}%`; 
                
                // Add noteId for easy reference in events
                velocityBar.dataset.noteId = `${pitchIndex}-${timeStep}`;

                velocityBar.addEventListener('mousedown', (e) => { 
                    e.preventDefault(); 
                    const startY = e.clientY; 
                    const startHeight = velocityBar.offsetHeight; 
                    const paneHeight = velocityPane.offsetHeight; 

                    // Capture state before interaction begins
                    localAppServices.captureStateForUndo?.(`Change note velocity on ${track.name}`);

                    function onMouseMove(moveEvent) { 
                        const dy = startY - moveEvent.clientY; 
                        const newHeight = Math.max(0, Math.min(paneHeight, startHeight + dy)); 
                        velocityBar.style.height = `${newHeight}px`; 
                        const newVelocity = newHeight / paneHeight; 
                        track.sequences.updateNoteVelocity(activeSequence.id, pitchIndex, timeStep, newVelocity); 
                    }
                    function onMouseUp() { 
                        document.removeEventListener('mousemove', onMouseMove); 
                        document.removeEventListener('mouseup', onMouseUp); 
                    }
                    document.addEventListener('mousemove', onMouseMove); 
                    document.addEventListener('mouseup', onMouseUp); 
                });
                notesGrid.appendChild(velocityBar); 
            }
        });
    });
    scrollWrapper.appendChild(notesGrid); 
    velocityPane.appendChild(scrollWrapper); 
    const konvaContent = velocityPane.parentElement.querySelector('.konvajs-content'); 
    if (konvaContent) { 
        velocityPane.scrollLeft = konvaContent.parentElement.scrollLeft; 
        konvaContent.parentElement.addEventListener('scroll', (e) => { 
            velocityPane.scrollLeft = e.target.scrollLeft; 
        });
    }
}

function drawPianoKeys(layer, track, colors, numRows) { 
    const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH; 
    const noteHeight = Constants.PIANO_ROLL_NOTE_HEIGHT; 
    const isSampler = track.type === 'Sampler' || track.type === 'DrumSampler' || track.type === 'InstrumentSampler'; 

    for (let i = 0; i < numRows; i++) { 
        const y = i * noteHeight; 
        let labelText = '';
        let isBlackKey = false;

        if (isSampler) { 
            const padIndex = i; 
            if (track.type === 'DrumSampler') { 
                const padData = track.drumSamplerPads?.[padIndex]; 
                labelText = padData?.originalFileName ? localAppServices.Tone.Midi(Constants.DRUM_MIDI_START_NOTE + padIndex).toNote() + ' - ' + padData.originalFileName : `Pad ${padIndex + 1}`; 
                isBlackKey = Constants.MIDI_NOTE_NAMES[(Constants.DRUM_MIDI_START_NOTE + padIndex) % 12]?.includes('#');
            } else if (track.type === 'Sampler') { 
                labelText = `Slice ${padIndex + 1}`; 
            } else if (track.type === 'InstrumentSampler') {
                const midiNote = Constants.PIANO_ROLL_END_MIDI_NOTE - i; 
                labelText = localAppServices.Tone.Midi(midiNote).toNote();
                isBlackKey = Constants.MIDI_NOTE_NAMES[midiNote % 12]?.includes('#');
            }
        } else { 
            const noteName = Constants.SYNTH_PITCHES[i]; 
            isBlackKey = noteName.includes('#') || noteName.includes('b'); 
            labelText = noteName; 
        }
        
        const keyRect = new Konva.Rect({ 
            x: 0, y, width: keyWidth, height: noteHeight, 
            fill: isBlackKey ? colors.blackKeyBg : colors.whiteKeyBg, 
            stroke: colors.keyBorder, strokeWidth: 1, 
        });
        layer.add(keyRect); 

        const keyText = new Konva.Text({ 
            x: isBlackKey ? 15 : 5, y: y + noteHeight / 2 - 7, text: labelText, 
            fontSize: 9, fontFamily: "'Roboto', sans-serif", 
            fill: isBlackKey ? colors.blackKeyText : colors.whiteKeyText, listening: false, 
            width: keyWidth - 10, ellipsis: true, 
        });
        layer.add(keyText); 
    }
}

function drawGrid(layer, stageWidth, stageHeight, numSteps, colors, isSampler, numRows, track) { // ADDED 'track' parameter
    const noteHeight = Constants.PIANO_ROLL_NOTE_HEIGHT; 
    const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH; 
    const noteWidth = Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH; 
    
    // Draw background for grid area (right of keys)
    layer.add(new Konva.Rect({ 
        x: keyWidth, y: 0, width: stageWidth - keyWidth, height: stageHeight, 
        fill: colors.gridBgLight, name: 'grid-background' 
    })); 
    
    // Draw horizontal lines (note separators) and alternating background colors
    for (let i = 0; i < numRows; i++) { 
        let isBlackKeyRow = false;
        if (!isSampler) { 
            isBlackKeyRow = Constants.SYNTH_PITCHES[i]?.includes('#') || false; 
        } else if (track && track.type === 'DrumSampler') { // Check if 'track' exists before accessing its 'type'
             isBlackKeyRow = Constants.MIDI_NOTE_NAMES[(Constants.DRUM_MIDI_START_NOTE + i) % 12]?.includes('#');
        }

        if (isBlackKeyRow) { 
            layer.add(new Konva.Rect({ 
                x: keyWidth, y: i * noteHeight, 
                width: stageWidth - keyWidth, height: noteHeight, 
                fill: colors.gridBgDark, 
            }));
        }
        layer.add(new Konva.Line({ 
            points: [keyWidth, (i + 1) * noteHeight, noteWidth * numSteps + keyWidth, (i + 1) * noteHeight], 
            stroke: colors.gridLine, strokeWidth: 0.5, 
        }));
    }
    
    // Draw vertical lines (step/beat/bar lines)
    for (let i = 0; i <= numSteps; i++) { 
        const isBarLine = i % Constants.STEPS_PER_BAR === 0; 
        const isBeatLine = i % (Constants.STEPS_PER_BAR / 4) === 0; 
        layer.add(new Konva.Line({ 
            points: [i * noteWidth + keyWidth, 0, i * noteWidth + keyWidth, stageHeight], 
            stroke: isBarLine ? colors.gridLineBold : (isBeatLine ? colors.gridLine : colors.gridLine), 
            strokeWidth: isBarLine ? 1.5 : (isBeatLine ? 1 : 0.5), 
        }));
    }
}

function redrawNotes(noteLayer, track, colors, selectedNotes) { 
    noteLayer.destroyChildren(); 
    const activeSequence = track.sequences.getActiveSequence(); 
    if (!activeSequence) { 
        noteLayer.batchDraw(); 
        return; 
    }
    
    const isSamplerOrInstrument = track.type === 'Sampler' || track.type === 'DrumSampler' || track.type === 'InstrumentSampler'; 
    const sequenceData = activeSequence.data; 
    const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH; 
    const noteHeight = Constants.PIANO_ROLL_NOTE_HEIGHT; 
    const noteWidth = Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH; 

    sequenceData.forEach((pitchRow, pitchIndex) => { 
        pitchRow.forEach((note, timeStep) => { 
            if (note) { 
                let yPositionOnGrid; 
                let isVisible = true; 

                // Calculate y-position based on track type
                if (isSamplerOrInstrument) {
                    yPositionOnGrid = pitchIndex * noteHeight;

                    if (track.type === 'DrumSampler') { 
                         const midiNote = Constants.PIANO_ROLL_END_MIDI_NOTE - pitchIndex; 
                         const padIndex = midiNote - Constants.DRUM_MIDI_START_NOTE; 
                         if (padIndex < 0 || padIndex >= Constants.NUM_DRUM_SAMPLER_PADS) {
                             isVisible = false; 
                         }
                         yPositionOnGrid = padIndex * noteHeight; 
                    } else if (track.type === 'Sampler') { 
                        const midiNote = Constants.PIANO_ROLL_END_MIDI_NOTE - pitchIndex; 
                        const sliceIndex = midiNote - Constants.SAMPLER_PIANO_ROLL_START_NOTE;
                        if (sliceIndex < 0 || sliceIndex >= Constants.numSlices) {
                            isVisible = false;
                        }
                        yPositionOnGrid = sliceIndex * noteHeight; 
                    }
                } else { 
                    yPositionOnGrid = pitchIndex * noteHeight; 
                }

                if (!isVisible) return; 

                const noteId = `${pitchIndex}-${timeStep}`; 
                const isSelected = selectedNotes.has(noteId); 
                
                const noteRect = new Konva.Rect({ 
                    x: timeStep * noteWidth + keyWidth + 1, 
                    y: yPositionOnGrid + 1, 
                    width: noteWidth * (note.duration || 1) - 2, 
                    height: noteHeight - 2, 
                    fill: colors.noteFill, 
                    stroke: isSelected ? 'yellow' : colors.noteStroke, 
                    strokeWidth: isSelected ? 2.5 : 1, 
                    opacity: note.velocity ? (0.5 + note.velocity * 0.5) : 1, 
                    cornerRadius: 2, 
                    id: noteId, 
                    draggable: true, 
                });
                
                noteLayer.add(noteRect); 
            }
        });
    });
    noteLayer.batchDraw(); 
}

function createPianoRollStage(containerElement, velocityPane, track) { 
    if (typeof Konva === 'undefined' || !containerElement.parentElement) { 
        setTimeout(() => createPianoRollStage(containerElement, velocityPane, track), 100); 
        return; 
    }
    const activeSequence = track.sequences.getActiveSequence(); 
    if (!activeSequence) return; 
    const colors = localAppServices.getThemeColors(); 
    const numSteps = activeSequence.length; 
    
    const isSampler = track.type === 'Sampler' || track.type === 'DrumSampler' || track.type === 'InstrumentSampler'; 
    const numRows = isSampler && (track.type === 'Sampler' || track.type === 'DrumSampler') ? Constants.NUM_SAMPLER_NOTES : Constants.SYNTH_PITCHES.length; 
    
    const stageWidth = (Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH * numSteps) + Constants.PIANO_ROLL_KEY_WIDTH; 
    const stageHeight = Constants.PIANO_ROLL_NOTE_HEIGHT * numRows; 

    containerElement.innerHTML = ''; 
    const stage = new Konva.Stage({ container: containerElement, width: stageWidth, height: stageHeight }); 
    
    // Create layers for different elements
    const gridLayer = new Konva.Layer(); 
    stage.add(gridLayer); 
    const noteLayer = new Konva.Layer(); 
    stage.add(noteLayer); 
    const selectionLayer = new Konva.Layer(); 
    stage.add(selectionLayer); 
    const playheadLayer = new Konva.Layer(); 
    stage.add(playheadLayer); 
    const keyLayer = new Konva.Layer(); 
    stage.add(keyLayer); 

    const selectedNotes = new Set(); 
    const pianoRoll = { stage, gridLayer, noteLayer, selectionLayer, keyLayer, playheadLayer, track, selectedNotes, velocityPane, colors, isSampler, numRows }; // Store references, ADD selectionLayer
    openPianoRolls.set(track.id, pianoRoll); 

    drawGrid(gridLayer, stageWidth, stageHeight, numSteps, colors, isSampler, numRows, track); // ADDED 'track' parameter here
    drawPianoKeys(keyLayer, track, colors, numRows); 
    redrawNotes(noteLayer, track, colors, selectedNotes); 
    
    const playhead = new Konva.Line({ points: [0, 0, 0, stageHeight], stroke: colors.playhead, strokeWidth: 1.5, listening: false }); 
    playheadLayer.add(playhead); 
    pianoRoll.playhead = playhead; 
    
    keyLayer.moveToTop(); 
    playheadLayer.moveToTop(); 
    
    renderVelocityPane(velocityPane, track); 
    stage.batchDraw(); 

    attachPianoRollListeners(pianoRoll); 
}

function attachPianoRollListeners(pianoRoll) { 
    const { stage, gridLayer, noteLayer, selectionLayer, keyLayer, track, selectedNotes, velocityPane, colors, isSampler, numRows } = pianoRoll; 
    const activeSequence = track.sequences.getActiveSequence(); 
    const selectionRect = new Konva.Rect({ fill: 'rgba(0, 100, 255, 0.3)', visible: false }); 
    selectionLayer.add(selectionRect); // DIRECTLY ADD to selectionLayer 

    let x1, y1; 
    let isDraggingNote = false; 

    noteLayer.on('dragstart', (e) => {
        isDraggingNote = true;
        lastActivePianoRollTrackId = track.id;
        if (!selectedNotes.has(e.target.id())) {
            selectedNotes.clear();
            selectedNotes.add(e.target.id());
            redrawNotes(noteLayer, track, colors, selectedNotes);
        }
        localAppServices.captureStateForUndo?.(`Move note(s) on ${track.name}`);
    });

    noteLayer.on('dragmove', (e) => {
        e.target.x(Math.round(e.target.x() / Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH) * Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH);
        e.target.y(Math.round(e.target.y() / Constants.PIANO_ROLL_NOTE_HEIGHT) * Constants.PIANO_ROLL_NOTE_HEIGHT);
    });

    noteLayer.on('dragend', (e) => {
        isDraggingNote = false;
        const oldNoteId = e.target.id();
        const [oldPitchIndex, oldTimeStep] = oldNoteId.split('-').map(Number);

        const newX = e.target.x();
        const newY = e.target.y();
        const newTimeStep = Math.round((newX - Constants.PIANO_ROLL_KEY_WIDTH) / Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH);
        const newVisualRow = Math.floor(newY / Constants.PIANO_ROLL_NOTE_HEIGHT);

        let newPitchIndex;
        if (isSampler) {
            const newMidiNote = Constants.SAMPLER_PIANO_ROLL_START_NOTE + newVisualRow;
            newPitchIndex = Constants.PIANO_ROLL_END_MIDI_NOTE - newMidiNote;
        } else {
            newPitchIndex = newVisualRow;
        }

        const movedNotes = new Map();
        const finalSelectedNotes = new Set();

        selectedNotes.forEach(id => {
            const [pIdx, tStep] = id.split('-').map(Number);
            const data = activeSequence.data[pIdx]?.[tStep];
            if (data) {
                const pitchOffset = newPitchIndex - oldPitchIndex;
                const timeOffset = newTimeStep - oldTimeStep;

                const targetPitch = pIdx + pitchOffset;
                const targetTime = tStep + timeOffset;

                if (targetPitch >= 0 && targetPitch < numRows && targetTime >= 0 && targetTime < activeSequence.length) {
                    movedNotes.set(id, { targetPitch, targetTime, data: data });
                } else {
                    console.warn(`Note ${id} would move out of bounds. Skipping.`);
                }
            }
        });

        movedNotes.forEach((val, key) => {
            const [oldP, oldT] = key.split('-').map(Number);
            activeSequence.data[oldP][oldT] = null; 
        });

        movedNotes.forEach((val, key) => {
            activeSequence.data[val.targetPitch][val.targetTime] = val.data; 
            finalSelectedNotes.add(`${val.targetPitch}-${val.targetTime}`); 
        });

        selectedNotes.clear();
        finalSelectedNotes.forEach(id => selectedNotes.add(id)); 

        redrawNotes(noteLayer, track, colors, selectedNotes);
        renderVelocityPane(velocityPane, track);
        track.sequences.recreateToneSequence(); 
    });


    stage.on('mousedown.selection', (e) => { 
        if (e.target.getParent() === noteLayer || e.target.getParent() === keyLayer) return; 
        
        lastActivePianoRollTrackId = track.id; 
        if (!e.evt.shiftKey) {
            selectedNotes.clear();
            redrawNotes(noteLayer, track, colors, selectedNotes);
        }

        x1 = stage.getPointerPosition().x; 
        y1 = stage.getPointerPosition().y; 
        selectionRect.visible(true).width(0).height(0); 
    });
    stage.on('mousemove.selection', () => { 
        if (!selectionRect.visible()) return; 
        const { x: x2, y: y2 } = stage.getPointerPosition(); 
        selectionRect.setAttrs({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }); 
    });
    stage.on('mouseup.selection', (e) => { 
        if (!selectionRect.visible()) return; 
        selectionRect.visible(false); 
        
        const box = selectionRect.getClientRect(); 
        noteLayer.children.forEach(noteShape => { 
            if (Konva.Util.haveIntersection(box, noteShape.getClientRect())) { 
                const noteId = noteShape.id(); 
                if (e.evt.shiftKey) { 
                    if (selectedNotes.has(noteId)) {
                        selectedNotes.delete(noteId);
                    } else {
                        selectedNotes.add(noteId);
                    }
                } else { 
                    selectedNotes.add(noteId);
                }
            }
        });
        redrawNotes(noteLayer, track, colors, selectedNotes); 
    });

    stage.on('contextmenu', (e) => { 
        e.evt.preventDefault(); 
        lastActivePianoRollTrackId = track.id; 

        const clickedOnNote = e.target.getParent() === noteLayer; 
        const menuItems = []; 

        if (clickedOnNote) { 
            const noteId = e.target.id(); 
            if (!selectedNotes.has(noteId)) { 
                selectedNotes.clear();
                selectedNotes.add(noteId);
                redrawNotes(noteLayer, track, colors, selectedNotes);
            }
            menuItems.push({ 
                label: `Delete ${selectedNotes.size} Note(s)`,
                action: () => {
                    track.sequences.removeNotesFromSequence(activeSequence.id, selectedNotes);
                    selectedNotes.clear(); 
                    redrawNotes(noteLayer, track, colors, selectedNotes);
                    renderVelocityPane(velocityPane, track);
                }
            });
            menuItems.push({ separator: true });
        }
        
        if (selectedNotes.size > 0) { 
            menuItems.push({
                label: `Copy ${selectedNotes.size} Note(s)`,
                action: () => track.sequences.copyNotesToClipboard(activeSequence.id, selectedNotes)
            });
        }
        
        const clipboard = localAppServices.getClipboardData(); 
        if (clipboard?.type === 'piano-roll-notes') { 
            menuItems.push({
                label: `Paste ${clipboard.notes.length} Note(s)`,
                action: () => {
                    const pos = stage.getPointerPosition(); 
                    const pasteTimeStep = Math.floor((pos.x - Constants.PIANO_ROLL_KEY_WIDTH) / Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH); 
                    const visualRow = Math.floor(pos.y / Constants.PIANO_ROLL_NOTE_HEIGHT); 
                    
                    let pastePitchIndex;
                    if (isSampler) {
                        const midiNote = Constants.SAMPLER_PIANO_ROLL_START_NOTE + visualRow;
                        pastePitchIndex = Constants.PIANO_ROLL_END_MIDI_NOTE - midiNote;
                    } else {
                        pastePitchIndex = visualRow;
                    }

                    const newSelected = track.sequences.pasteNotesFromClipboard(activeSequence.id, pastePitchIndex, pasteTimeStep);
                    
                    if (newSelected) {
                        selectedNotes.clear();
                        newSelected.forEach(id => selectedNotes.add(id));
                        redrawNotes(noteLayer, track, colors, selectedNotes);
                        renderVelocityPane(velocityPane, track);
                        localAppServices.showNotification?.(`${clipboard.notes.length} note(s) pasted.`);
                    } else {
                        localAppServices.showNotification?.("Could not paste notes. Ensure target location is valid (e.g., within sequence bounds).", 3000);
                    }
                }
            });
        }
        if (menuItems.length > 0) menuItems.push({ separator: true }); 
        menuItems.push({ label: 'Duplicate Sequence', action: () => track.sequences.duplicateSequence(activeSequence.id) }); 
        menuItems.push({ label: 'Clear All Notes', action: () => track.sequences.clearSequence(activeSequence.id) }); 
        
        if (menuItems.length > 0) { 
            localAppServices.createContextMenu(e.evt, menuItems);
        }
    });

    stage.on('click tap', function (e) { 
        if (e.evt.button !== 0) return; 

        lastActivePianoRollTrackId = track.id; 

        if (isDraggingNote || e.target.draggable()) {
            return;
        }

        if (!e.evt.shiftKey && e.target.getParent() !== noteLayer) { 
            if (selectedNotes.size > 0) {
                selectedNotes.clear();
                redrawNotes(noteLayer, track, colors, selectedNotes);
                return; 
            }
        }
        
        if (e.target.getParent() === keyLayer) { 
            return;
        }

        const pos = stage.getPointerPosition(); 
        const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH; 
        if (pos.x < keyWidth) return; 

        const timeStep = Math.floor((pos.x - keyWidth) / Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH); 
        const visualRow = Math.floor(pos.y / Constants.PIANO_ROLL_NOTE_HEIGHT); 
        
        let pitchIndex; 
        if (isSampler) { 
            const midiNoteForVisualRow = Constants.SAMPLER_PIANO_ROLL_START_NOTE + visualRow;
            pitchIndex = Constants.PIANO_ROLL_END_MIDI_NOTE - midiNoteForVisualRow;
        } else { 
            pitchIndex = visualRow; 
        }

        const currentActiveSequence = track.sequences.getActiveSequence(); 
        if (!currentActiveSequence || !currentActiveSequence.data[pitchIndex] || timeStep >= currentActiveSequence.length) { 
            return;
        }
        
        const noteExists = currentActiveSequence.data[pitchIndex][timeStep]; 

        if (noteExists) { 
            track.sequences.removeNoteFromSequence(currentActiveSequence.id, pitchIndex, timeStep);
        } else { 
            track.sequences.addNoteToSequence(currentActiveSequence.id, pitchIndex, timeStep);
        }

        selectedNotes.clear(); 
        redrawNotes(noteLayer, track, colors, selectedNotes);
        renderVelocityPane(velocityPane, track);
    });
    
    const lengthInput = document.getElementById(`sequenceLengthInput-${track.id}`); 
    lengthInput?.addEventListener('change', (e) => { 
        const barValue = parseFloat(e.target.value); 
        if (isNaN(barValue) || barValue <= 0 || barValue > Constants.MAX_BARS) { 
            localAppServices.showNotification(`Sequence length must be between 0 and ${Constants.MAX_BARS} bars.`, 2000); 
            e.target.value = (activeSequence.length / Constants.STEPS_PER_BAR).toFixed(2); 
            return; 
        }
        const newLengthInSteps = Math.round(barValue * Constants.STEPS_PER_BAR); 
        track.sequences.setSequenceLength(activeSequence.id, newLengthInSteps); 
        
        const containerElement = document.getElementById(`pianoRollKonvaContainer-${track.id}`); 
        const velocityPane = document.getElementById(`velocityPaneContainer-${track.id}`); 
        createPianoRollStage(containerElement, velocityPane, track); 
    });

    const dragHandle = document.getElementById(`piano-roll-drag-handle-${track.id}`); 
    if (dragHandle) { 
        dragHandle.addEventListener('dragstart', (e) => { 
            if (!activeSequence) return; 
            const dragData = { 
                type: 'piano-roll-sequence', 
                sourceTrackId: track.id, 
                sequenceId: activeSequence.id, 
            };
            e.dataTransfer.setData('application/json', JSON.stringify(dragData)); 
            e.dataTransfer.effectAllowed = 'copy'; 
        });
    }

    const quantizeBtn = document.getElementById(`quantizeBtn-${track.id}`); 
    quantizeBtn?.addEventListener('click', () => { 
        const currentActiveSequence = track.sequences.getActiveSequence(); 
        if (!currentActiveSequence) return; 

        let notesToQuantize; 
        if (pianoRoll.selectedNotes.size > 0) { 
            notesToQuantize = pianoRoll.selectedNotes; 
        } else { 
            const allNoteIds = new Set(); 
            currentActiveSequence.data.forEach((row, pitchIndex) => { 
                row.forEach((note, timeStep) => { 
                    if (note) { 
                        allNoteIds.add(`${pitchIndex}-${timeStep}`); 
                    }
                });
            });
            notesToQuantize = allNoteIds; 
        }
        
        const newSelected = track.quantizeNotes(currentActiveSequence.id, notesToQuantize, '16n'); 
        if (newSelected) { 
            selectedNotes.clear(); 
            newSelected.forEach(id => selectedNotes.add(id)); 
            redrawNotes(noteLayer, track, colors, selectedNotes); 
            renderVelocityPane(velocityPane, track); 
            localAppServices.showNotification?.(`${newSelected.size} note(s) quantized.`);
        } else {
            localAppServices.showNotification?.("No notes quantized or an error occurred.", 2000);
        }
    });
}