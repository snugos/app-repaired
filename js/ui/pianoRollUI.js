// js/ui/pianoRollUI.js - Piano Roll UI Management with Konva.js
import * as Constants from '../constants.js';

let localAppServices = {};
const openPianoRolls = new Map();

export function initializePianoRollUI(appServicesFromMain) {
    localAppServices = appServicesFromMain;
    console.log("[PianoRollUI] Initialized.");
    if (typeof Konva === 'undefined') {
        console.error("[PianoRollUI] CRITICAL: Konva is not loaded. Piano Roll will not function.");
    }
}

export function openPianoRollWindow(trackId, forceRedraw = false, savedState = null) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track || track.type === 'Audio') {
        console.warn(`[PianoRollUI] Cannot open Piano Roll for track type: ${track?.type}`);
        return;
    }

    const windowId = `pianoRollWin-${trackId}`;
    if (localAppServices.getOpenWindows?.().has(windowId) && !savedState) {
        localAppServices.getOpenWindows().get(windowId).restore();
        return;
    }

    const activeSequence = track.getActiveSequence();
    if (!activeSequence) {
        localAppServices.showNotification?.(`Track "${track.name}" has no active sequence.`, 3500);
        return;
    }

    const konvaContainer = document.createElement('div');
    konvaContainer.id = `pianoRollKonvaContainer-${trackId}`;
    konvaContainer.className = 'w-full h-full overflow-auto bg-white dark:bg-black';

    const pianoRollWindow = localAppServices.createWindow(
        windowId,
        `Piano Roll: ${track.name}`,
        konvaContainer,
        { 
            width: 800, height: 500, minWidth: 500, minHeight: 300, initialContentKey: windowId,
            onCloseCallback: () => {
                openPianoRolls.delete(trackId);
            }
        }
    );

    if (pianoRollWindow && pianoRollWindow.element) {
        setTimeout(() => createPianoRollStage(konvaContainer, track), 50);
    }
}

export function updatePianoRollPlayhead(transportTime) {
    if (openPianoRolls.size === 0) return;

    const pixelsPerSecond = (Tone.Transport.bpm.value / 60) * 4 * Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH;
    
    const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH;
    const newX = transportTime * pixelsPerSecond + keyWidth;

    openPianoRolls.forEach(({ playhead, layer }) => {
        if (playhead && layer) {
            playhead.x(newX);
            layer.batchDraw();
        }
    });
}


// --- FIX: This function now accepts the track to conditionally render labels ---
function drawPianoKeys(layer, stageHeight, track) {
    const keyLayer = new Konva.Layer();
    const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH;
    const noteHeight = Constants.PIANO_ROLL_NOTE_HEIGHT;
    const isSampler = track.type === 'Sampler' || track.type === 'DrumSampler';
    const samplerLabelPrefix = track.type === 'Sampler' ? 'Slice' : 'Pad';

    Constants.SYNTH_PITCHES.forEach((noteName, index) => {
        const midiNote = Constants.PIANO_ROLL_END_MIDI_NOTE - index;
        const isBlackKey = noteName.includes('#') || noteName.includes('b');
        const y = index * noteHeight;
        
        let labelText = noteName;
        let isSamplerKey = false;

        // Check if the current key falls within the 16 notes we've allocated for samplers
        if (isSampler && midiNote >= Constants.SAMPLER_PIANO_ROLL_START_NOTE && midiNote < Constants.SAMPLER_PIANO_ROLL_START_NOTE + Constants.NUM_SAMPLER_NOTES) {
            const sampleIndex = midiNote - Constants.SAMPLER_PIANO_ROLL_START_NOTE;
            labelText = `${samplerLabelPrefix} ${sampleIndex + 1}`;
            isSamplerKey = true;
        }

        const keyRect = new Konva.Rect({
            x: 0, y: y, width: keyWidth, height: noteHeight,
            fill: isBlackKey ? '#333' : '#FFF',
            stroke: '#555',
            strokeWidth: 1,
            // Dim keys that aren't part of the sampler mapping
            opacity: isSampler && !isSamplerKey ? 0.3 : 1
        });
        keyLayer.add(keyRect);

        const keyText = new Konva.Text({
            x: isBlackKey ? 15 : 5, y: y + noteHeight / 2 - 7, text: labelText,
            fontSize: isSamplerKey ? 10 : 12,
            fontFamily: "'Roboto', sans-serif",
            fill: isBlackKey ? '#FFF' : '#000',
            listening: false,
        });
        keyLayer.add(keyText);
    });
    return keyLayer;
}

function drawGrid(layer, stageWidth, stageHeight) {
    const gridLayer = new Konva.Layer();
    const noteHeight = Constants.PIANO_ROLL_NOTE_HEIGHT;
    const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH;
    const noteWidth = Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH;
    const numPitches = Constants.SYNTH_PITCHES.length;
    const numSteps = 64;
    
    gridLayer.add(new Konva.Rect({
        x: keyWidth, y: 0, width: stageWidth - keyWidth, height: stageHeight, fill: '#DDD',
    }));

    // Draw horizontal lines and black key shading
    for (let i = 0; i < numPitches; i++) {
        const isBlackKey = Constants.SYNTH_PITCHES[i]?.includes('#') || false;
        if (isBlackKey) {
            gridLayer.add(new Konva.Rect({
                x: keyWidth, y: i * noteHeight,
                width: stageWidth - keyWidth, height: noteHeight,
                fill: '#CCC',
            }));
        }
        gridLayer.add(new Konva.Line({
            points: [keyWidth, (i + 1) * noteHeight, noteWidth * numSteps + keyWidth, (i + 1) * noteHeight],
            stroke: '#BBB',
            strokeWidth: 0.5,
        }));
    }

    // Draw vertical lines
    for (let i = 0; i <= numSteps; i++) {
        const isBarLine = i % 16 === 0;
        const isBeatLine = i % 4 === 0;

        gridLayer.add(new Konva.Line({
            points: [i * noteWidth + keyWidth, 0, i * noteWidth + keyWidth, stageHeight],
            stroke: isBarLine ? '#555' : '#BBB',
            strokeWidth: isBarLine || isBeatLine ? 1 : 0.5,
        }));
    }
    
    return gridLayer;
}

function renderNotes(track) {
    const noteLayer = new Konva.Layer();
    const activeSequence = track.getActiveSequence();
    if (!activeSequence) return noteLayer;

    const sequenceData = activeSequence.data;
    const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH;
    const noteHeight = Constants.PIANO_ROLL_NOTE_HEIGHT;
    const noteWidth = Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH;
    
    const noteFillColor = 'skyblue';
    const noteStrokeColor = 'blue';
    
    sequenceData.forEach((pitchRow, pitchIndex) => {
        pitchRow.forEach((note, timeStep) => {
            if (note) {
                const noteRect = new Konva.Rect({
                    x: timeStep * noteWidth + keyWidth + 1,
                    y: pitchIndex * noteHeight + 1,
                    width: noteWidth * (note.duration || 1) - 2,
                    height: noteHeight - 2,
                    fill: noteFillColor,
                    stroke: noteStrokeColor,
                    strokeWidth: 1,
                    opacity: note.velocity ? (0.6 + note.velocity * 0.4) : 1,
                    cornerRadius: 1
                });
                noteLayer.add(noteRect);
            }
        });
    });

    return noteLayer;
}

function createPianoRollStage(containerElement, track) {
    if (typeof Konva === 'undefined') {
        containerElement.innerHTML = '<p class="p-4 text-black dark:text-white">Error: Piano Roll library failed to load.</p>';
        return null;
    }
    if (!containerElement || !containerElement.parentElement || containerElement.parentElement.offsetWidth <= 0) {
        setTimeout(() => createPianoRollStage(containerElement, track), 100);
        return;
    }
    
    const numSteps = 64;
    const totalGridWidth = Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH * numSteps;
    const totalGridHeight = Constants.PIANO_ROLL_NOTE_HEIGHT * Constants.SYNTH_PITCHES.length;
    const stageWidth = totalGridWidth + Constants.PIANO_ROLL_KEY_WIDTH;
    const stageHeight = totalGridHeight;
    
    const stage = new Konva.Stage({
        container: containerElement, width: stageWidth, height: stageHeight,
    });

    const gridLayer = drawGrid(null, stageWidth, stageHeight);
    stage.add(gridLayer);

    let noteLayer = renderNotes(track);
    stage.add(noteLayer);
    
    const playheadLayer = new Konva.Layer();
    const playhead = new Konva.Line({
        points: [0, 0, 0, stageHeight],
        stroke: '#F00', // Red
        strokeWidth: 1.5,
        listening: false,
    });
    playheadLayer.add(playhead);
    stage.add(playheadLayer);
    
    openPianoRolls.set(track.id, { stage, playhead, layer: playheadLayer });
    
    // --- FIX: Pass the track object to drawPianoKeys ---
    const keyLayer = drawPianoKeys(null, stageHeight, track);
    stage.add(keyLayer);
    
    keyLayer.moveToTop();
    playheadLayer.moveToTop();

    stage.on('click tap', function (e) {
        if (e.target.getLayer() === keyLayer) return;
        
        const pos = stage.getPointerPosition();
        const keyWidth = Constants.PIANO_ROLL_KEY_WIDTH;
        if (pos.x < keyWidth) return;

        const timeStep = Math.floor((pos.x - keyWidth) / Constants.PIANO_ROLL_SIXTEENTH_NOTE_WIDTH);
        const pitchIndex = Math.floor(pos.y / Constants.PIANO_ROLL_NOTE_HEIGHT);

        const activeSequence = track.getActiveSequence();
        if (!activeSequence || !activeSequence.data[pitchIndex]) return;

        const noteExists = activeSequence.data[pitchIndex][timeStep];

        if (noteExists) {
            track.removeNoteFromSequence(activeSequence.id, pitchIndex, timeStep);
        } else {
            track.addNoteToSequence(activeSequence.id, pitchIndex, timeStep, { velocity: 0.75, duration: 1 });
        }

        noteLayer.destroy();
        noteLayer = renderNotes(track);
        stage.add(noteLayer);
        noteLayer.moveToBottom();
        gridLayer.moveToBottom();
        stage.draw();
    });

    stage.draw();
    return stage;
}
