// js/midiUtils.js - MIDI File Import/Export Utilities
// Parses Standard MIDI Files (SFK Format 0 and 1) and encodes sequences to MIDI

export const MIDI_EVENT = {
    NOTE_OFF: 0x80,
    NOTE_ON: 0x90,
    KEY_PRESSURE: 0xa0,
    CONTROL_CHANGE: 0xb0,
    PROGRAM_CHANGE: 0xc0,
    CHANNEL_PRESSURE: 0xd0,
    PITCH_BEND: 0xe0,
    SYSEX: 0xf0,
    SYSEX_END: 0xf7,
    METAEVENT: 0xff
};

export const MIDI_META = {
    SEQUENCE_NUMBER: 0x00,
    TEXT_EVENT: 0x01,
    COPYRIGHT: 0x02,
    TRACK_NAME: 0x03,
    INSTRUMENT_NAME: 0x04,
    LYRIC: 0x05,
    MARKER: 0x06,
    CUE_POINT: 0x07,
    CHANNEL_PREFIX: 0x20,
    END_OF_TRACK: 0x2f,
    SET_TEMPO: 0x51,
    SMPTE_OFFSET: 0x54,
    TIME_SIGNATURE: 0x58,
    KEYSIG: 0x59
};

// Convert MIDI note number to note name
export function midiToNoteName(midiNum) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNum / 12) - 1;
    const noteName = noteNames[midiNum % 12];
    return `${noteName}${octave}`;
}

// Convert note name to MIDI number
export function noteNameToMidi(noteName) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
    if (!match) return null;
    const note = match[1];
    const octave = parseInt(match[2]);
    const noteIndex = noteNames.indexOf(note);
    if (noteIndex === -1) return null;
    return (octave + 1) * 12 + noteIndex;
}

// Variable length quantity encoding/decoding
function readVarLen(dataView, offset) {
    let value = 0;
    let bytesRead = 0;
    do {
        value = (value << 7) | (dataView.getUint8(offset + bytesRead) & 0x7f);
        bytesRead++;
    } while (offset + bytesRead < dataView.byteLength && (dataView.getUint8(offset + bytesRead - 1) & 0x80) !== 0);
    return { value, bytesRead };
}

function writeVarLen(value) {
    const bytes = [];
    let v = value;
    bytes.unshift(v & 0x7f);
    while ((v >>= 7) > 0) {
        bytes.unshift((v & 0x7f) | 0x80);
    }
    return new Uint8Array(bytes);
}

// Parse a MIDI file and return note events
export function parseMidiFile(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const notes = []; // Array of { time: number (in beats), note: number (0-127), velocity: number (0-127), duration: number (in beats), channel: number }
    
    let offset = 0;
    
    // Read header chunk
    if (view.getUint32(offset) !== 0x4d546864) { // "MThd"
        throw new Error('Invalid MIDI file: missing MThd header');
    }
    offset += 4;
    
    const headerLen = view.getUint32(offset);
    offset += 4;
    
    const format = view.getUint16(offset);
    offset += 2;
    
    const numTracks = view.getUint16(offset);
    offset += 2;
    
    const division = view.getUint16(offset);
    offset += 2;
    
    // Handle SMPTE if negative division
    let ticksPerBeat = division;
    let isSMPTE = false;
    if (division & 0x8000) {
        isSMPTE = true;
        const fps = -(division >> 8);
        const ticksPerFrame = division & 0xff;
        ticksPerBeat = fps * ticksPerFrame; // This isn't actually used for SMPTE usually
        console.warn('[MIDI] SMPTE format not fully supported');
    }
    
    console.log(`[MIDI] Format: ${format}, Tracks: ${numTracks}, Division: ${division}`);
    
    // Process each track
    for (let trackNum = 0; trackNum < numTracks; trackNum++) {
        if (offset + 4 > view.byteLength) break;
        
        const chunkType = view.getUint32(offset);
        offset += 4;
        
        if (chunkType !== 0x4d54726b) { // "MTrk"
            console.warn(`[MIDI] Skipping non-track chunk`);
            const len = view.getUint32(offset);
            offset += 4 + len;
            trackNum--;
            continue;
        }
        
        offset += 4; // Skip "MTrk"
        const trackLen = view.getUint32(offset);
        offset += 4;
        
        const trackEnd = offset + trackLen;
        let currentTime = 0;
        let lastStatus = 0;
        const channelStates = new Array(16).fill(0);
        
        while (offset < trackEnd) {
            const deltaRead = readVarLen(view, offset);
            const deltaTime = deltaRead.value;
            offset += deltaRead.bytesRead;
            currentTime += deltaTime;
            
            if (offset >= trackEnd) break;
            
            let status = view.getUint8(offset);
            offset++;
            
            // Handle running status
            if ((status & 0x80) === 0) {
                status = lastStatus;
                offset--; // Put it back since it was data
            }
            
            lastStatus = status;
            const channel = status & 0x0f;
            const eventType = status & 0xf0;
            
            if (eventType === MIDI_EVENT.NOTE_ON && status !== MIDI_EVENT.NOTE_ON) {
                const note = view.getUint8(offset);
                offset++;
                const velocity = view.getUint8(offset);
                offset++;
                
                if (velocity > 0) {
                    notes.push({
                        time: currentTime,
                        note: note,
                        velocity: velocity,
                        duration: 0, // Will be set by matching NOTE_OFF
                        channel: channel
                    });
                } else {
                    // Note On with velocity 0 is treated as Note Off
                    const noteOff = note;
                    const existingNote = notes.find(n => 
                        n.note === noteOff && 
                        n.channel === channel && 
                        n.duration === 0 &&
                        n.time <= currentTime
                    );
                    if (existingNote) {
                        existingNote.duration = currentTime - existingNote.time;
                    }
                }
            } else if (eventType === 0x80 || (status === MIDI_EVENT.NOTE_ON && view.getUint8(offset + 1) === 0)) {
                // Note Off (0x80 or Note On with velocity 0)
                const noteOff = view.getUint8(offset);
                offset++;
                // velocity
                if (status === 0x80) offset++;
                
                const existingNote = notes.find(n => 
                    n.note === noteOff && 
                    n.channel === channel && 
                    n.duration === 0
                );
                if (existingNote) {
                    existingNote.duration = currentTime - existingNote.time;
                }
            } else if (eventType === MIDI_EVENT.NOTE_OFF) {
                const noteOff = view.getUint8(offset);
                offset++;
                // velocity
                offset++;
                
                const existingNote = notes.find(n => 
                    n.note === noteOff && 
                    n.channel === channel && 
                    n.duration === 0
                );
                if (existingNote) {
                    existingNote.duration = currentTime - existingNote.time;
                }
            } else if (eventType === MIDI_EVENT.PROGRAM_CHANGE) {
                offset++; // program number
            } else if (eventType === MIDI_EVENT.CONTROL_CHANGE) {
                offset += 2; // controller + value
            } else if (eventType === MIDI_EVENT.PITCH_BEND) {
                offset += 2; // LSB + MSB
            } else if (eventType === MIDI_EVENT.KEY_PRESSURE) {
                offset += 2; // note + pressure
            } else if (eventType === MIDI_EVENT.CHANNEL_PRESSURE) {
                offset++; // pressure
            } else if (status === MIDI_EVENT.SYSEX) {
                // SysEx
                let len = readVarLen(view, offset);
                offset += len.bytesRead + len.value;
            } else if (status === MIDI_EVENT.METAEVENT) {
                const metaType = view.getUint8(offset);
                offset++;
                const len = readVarLen(view, offset);
                offset += len.bytesRead + len.value;
                
                if (metaType === MIDI_META.END_OF_TRACK) {
                    break;
                }
            } else {
                // Unknown event, skip
                console.warn(`[MIDI] Unknown event status: ${status.toString(16)}`);
                break;
            }
        }
        
        offset = trackEnd;
    }
    
    // Filter out notes without valid duration
    const validNotes = notes.filter(n => n.duration > 0);
    console.log(`[MIDI] Parsed ${validNotes.length} valid notes from MIDI file`);
    
    return {
        notes: validNotes,
        ticksPerBeat: ticksPerBeat,
        format: format
    };
}

// Convert parsed MIDI notes to sequence data format
export function midiNotesToSequenceData(midiData, targetSteps, stepsPerBeat = 4) {
    const { notes, ticksPerBeat } = midiData;
    const sequenceData = [];
    const rows = 128; // All MIDI notes
    
    // Initialize empty rows
    for (let i = 0; i < rows; i++) {
        sequenceData.push(new Array(targetSteps).fill(null));
    }
    
    // Convert ticks to step index
    const ticksPerStep = ticksPerBeat / stepsPerBeat;
    
    notes.forEach(note => {
        const startStep = Math.floor(note.time / ticksPerStep);
        const endStep = Math.floor((note.time + note.duration) / ticksPerStep);
        
        if (note.note >= 0 && note.note < rows && startStep >= 0 && startStep < targetSteps) {
            const velocity = note.velocity / 127; // Normalize to 0-1
            sequenceData[note.note][startStep] = {
                active: true,
                velocity: velocity
            };
        }
    });
    
    return sequenceData;
}

// Encode sequence data to a MIDI file
export function encodeSequenceToMidi(sequenceData, sequenceLength, options = {}) {
    const {
        ticksPerBeat = 480,
        tempoBPM = 120,
        channel = 0
    } = options;
    
    const ticksPerStep = ticksPerBeat / 4; // 4 steps per beat (16th notes)
    const events = [];
    
    // Set tempo event
    const microsecondsPerBeat = Math.round(60000000 / tempoBPM);
    events.push({ time: 0, type: 'meta', subtype: MIDI_META.SET_TEMPO, data: [
        (microsecondsPerBeat >> 16) & 0xff,
        (microsecondsPerBeat >> 8) & 0xff,
        microsecondsPerBeat & 0xff
    ]});
    
    // Track name
    const trackName = options.trackName || 'SnugOS Sequence';
    events.push({ time: 0, type: 'meta', subtype: MIDI_META.TRACK_NAME, data: Array.from(trackName).map(c => c.charCodeAt(0)) });
    
    // Collect note events
    const noteEvents = [];
    for (let step = 0; step < sequenceLength; step++) {
        for (let row = 0; row < sequenceData.length; row++) {
            const cell = sequenceData[row][step];
            if (cell && cell.active) {
                const noteNum = row;
                const velocity = Math.round((cell.velocity || 0.7) * 127);
                const startTime = step * ticksPerStep;
                const durationSteps = 1; // Default 1 step
                const endTime = (step + durationSteps) * ticksPerStep;
                
                noteEvents.push({ time: startTime, note: noteNum, velocity: velocity, isOn: true });
                noteEvents.push({ time: endTime, note: noteNum, velocity: velocity, isOn: false });
            }
        }
    }
    
    // Sort by time, then note off before note on at same time
    noteEvents.sort((a, b) => {
        if (a.time !== b.time) return a.time - b.time;
        if (a.isOn !== b.isOn) return a.isOn ? 1 : -1; // Note off first
        return a.note - b.note;
    });
    
    // Add note events
    let lastTime = 0;
    noteEvents.forEach(event => {
        const deltaTime = event.time - lastTime;
        lastTime = event.time;
        
        if (event.isOn) {
            events.push({
                time: deltaTime,
                type: 'channel',
                status: MIDI_EVENT.NOTE_ON | channel,
                data: [event.note, event.velocity]
            });
        } else {
            events.push({
                time: deltaTime,
                type: 'channel',
                status: MIDI_EVENT.NOTE_OFF | channel,
                data: [event.note, 0]
            });
        }
    });
    
    // End of track
    events.push({ time: 0, type: 'meta', subtype: MIDI_META.END_OF_TRACK, data: [] });
    
    // Build MIDI file
    const trackEvents = [];
    let lastEventTime = 0;
    
    events.forEach(event => {
        // Calculate delta time
        const deltaTime = event.time;
        trackEvents.push(...writeVarLen(deltaTime));
        
        if (event.type === 'meta') {
            trackEvents.push(MIDI_EVENT.METAEVENT, event.subtype);
            trackEvents.push(...writeVarLen(event.data.length));
            trackEvents.push(...event.data);
        } else if (event.type === 'channel') {
            trackEvents.push(event.status);
            trackEvents.push(...event.data);
        }
    });
    
    // Build full MIDI file
    const midiFile = [];
    
    // Header chunk
    midiFile.push(0x4d, 0x54, 0x68, 0x64); // MThd
    midiFile.push(0, 0, 0, 6); // Header length
    midiFile.push(0, 0); // Format 0
    midiFile.push(0, 1); // 1 track
    midiFile.push((ticksPerBeat >> 8) & 0xff, ticksPerBeat & 0xff); // Ticks per beat
    
    // Track chunk
    midiFile.push(0x4d, 0x54, 0x72, 0x6b); // MTrk
    const trackData = new Uint8Array(trackEvents);
    const trackLen = trackData.length;
    midiFile.push((trackLen >> 24) & 0xff, (trackLen >> 16) & 0xff, (trackLen >> 8) & 0xff, trackLen & 0xff);
    midiFile.push(...trackEvents);
    
    return new Uint8Array(midiFile);
}

// Convert sequence data rows to specific pitches using synthPitches
export function matchSequenceToPitches(sequenceData, synthPitches) {
    // Filter out only rows that correspond to synth pitches
    const matchedData = [];
    const numSteps = sequenceData[0]?.length || 0;
    
    synthPitches.forEach((pitchName, index) => {
        if (sequenceData[index]) {
            matchedData.push(sequenceData[index].slice());
        } else {
            matchedData.push(new Array(numSteps).fill(null));
        }
    });
    
    return matchedData;
}
