// js/MidiChordPlayer.js - MIDI Chord Player (On-screen piano that plays chords from single key press)

export class MidiChordPlayer {
    constructor(synth = null) {
        this.synth = synth;
        this.chordType = 'major';
        this.chordIntervals = this.getChordIntervals('major');
        this.activeKeys = new Set();
        
        // Chord definitions (semitones from root)
        this.CHORD_TYPES = {
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            'diminished': [0, 3, 6],
            'augmented': [0, 4, 8],
            'major7': [0, 4, 7, 11],
            'minor7': [0, 3, 7, 10],
            'dominant7': [0, 4, 7, 10],
            'diminished7': [0, 3, 6, 9],
            'halfDiminished7': [0, 3, 6, 10],
            'sus2': [0, 2, 7],
            'sus4': [0, 5, 7],
            'power': [0, 7, 12]
        };
    }
    
    getChordIntervals(chordType) {
        return this.CHORD_TYPES[chordType] || this.CHORD_TYPES['major'];
    }
    
    setChordType(chordType) {
        if (this.CHORD_TYPES[chordType]) {
            this.chordType = chordType;
            this.chordIntervals = this.CHORD_TYPES[chordType];
        }
    }
    
    noteToMidi(note) {
        const noteMap = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
        const match = note.match(/^([A-G]#?|b)([0-9])$/);
        if (!match) return 60; // Default to middle C
        const pitch = noteMap[match[1]] || 0;
        const octave = parseInt(match[2]);
        return pitch + (octave * 12);
    }
    
    midiToNote(midi) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const note = notes[midi % 12];
        return `${note}${octave}`;
    }
    
    playChord(rootNote, velocity = 0.8) {
        if (!this.synth) return;
        
        const rootMidi = this.noteToMidi(rootNote);
        const chordNotes = this.chordIntervals.map(interval => this.midiToNote(rootMidi + interval));
        
        // Stop any currently playing notes in this chord
        this.stopChord();
        
        // Play all chord notes
        chordNotes.forEach(note => {
            this.synth.triggerAttack(note, Tone.now(), velocity);
            this.activeKeys.add(note);
        });
        
        return chordNotes;
    }
    
    stopChord() {
        if (!this.synth) return;
        this.activeKeys.forEach(note => {
            this.synth.triggerRelease(note, Tone.now());
        });
        this.activeKeys.clear();
    }
    
    playNote(note, velocity = 0.8) {
        if (!this.synth) return;
        this.synth.triggerAttackRelease(note, '4n', Tone.now(), velocity);
    }
}

// Create global chord player instance
let chordPlayerInstance = null;

export function getChordPlayer() {
    if (!chordPlayerInstance) {
        chordPlayerInstance = new MidiChordPlayer();
    }
    return chordPlayerInstance;
}

export function initChordPlayer(synth) {
    const player = getChordPlayer();
    player.synth = synth;
    return player;
}