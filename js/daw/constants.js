// js/daw/constants.js - Shared constants for SnugOS

export const APP_VERSION = "0.1.0"; 
export const STEPS_PER_BAR = 16;
export const DEFAULT_STEPS_PER_BAR = 16; 
export const MAX_BARS = 32; 
export const MIN_TEMPO = 30; 
export const MAX_TEMPO = 300;
export const DEFAULT_TEMPO = 120;
export const MIDI_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const PIANO_ROLL_OCTAVES = 4;
export const PIANO_ROLL_START_MIDI_NOTE = 36; // C2
export const PIANO_ROLL_END_MIDI_NOTE = PIANO_ROLL_START_MIDI_NOTE + (PIANO_ROLL_OCTAVES * 12) - 1;
export const SAMPLER_PIANO_ROLL_START_NOTE = 36; // C2 is the first key for Pad 1 / Slice 1
export const NUM_SAMPLER_NOTES = 16; // 16 pads/slices

export const SYNTH_PITCHES = (() => {
    const pitches = [];
    if (Array.isArray(MIDI_NOTE_NAMES) && MIDI_NOTE_NAMES.length === 12) {
        // Iterate downwards from PIANO_ROLL_END_MIDI_NOTE to PIANO_ROLL_START_MIDI_NOTE
        // to match the visual representation in the piano roll (higher notes on top).
        for (let midiNote = PIANO_ROLL_END_MIDI_NOTE; midiNote >= PIANO_ROLL_START_MIDI_NOTE; midiNote--) {
            const octave = Math.floor(midiNote / 12) - 1;
            const noteName = MIDI_NOTE_NAMES[midiNote % 12];
            pitches.push(`${noteName}${octave}`);
        }
        console.log(`[Constants] Initialized SYNTH_PITCHES count: ${pitches.length}`);
    }
    return pitches;
})();

export const PIANO_ROLL_KEY_WIDTH = 80; 
export const PIANO_ROLL_NOTE_HEIGHT = 20; 
export const PIANO_ROLL_SIXTEENTH_NOTE_WIDTH = 25; 

export const soundLibraries = {
    "Drums": "assets/drums.zip",
    "Instruments": "assets/instruments.zip",
    "Instruments 2": "assets/instruments2.zip",
    "Instruments 3": "assets/instruments3.zip",
    "Srna's Piano": "assets/srnas_piano.zip"
};

export const defaultDesktopBg = '#1e1e1e';
export const defaultVelocity = 0.7;
export const numSlices = 16;
export const numDrumSamplerPads = 16;
export const DRUM_MIDI_START_NOTE = 36; 

export let COMPUTER_KEY_SYNTH_OCTAVE_SHIFT = 0; 
export function incrementOctaveShift() { 
    COMPUTER_KEY_SYNTH_OCTAVE_SHIFT = Math.min(3, COMPUTER_KEY_SYNTH_OCTAVE_SHIFT + 1);
}
export function decrementOctaveShift() {
    COMPUTER_KEY_SYNTH_OCTAVE_SHIFT = Math.max(-2, COMPUTER_KEY_SYNTH_OCTAVE_SHIFT - 1);
}

export const computerKeySynthMap = {
    'a': 60,  // C4
    'w': 61,  // C#4
    's': 62,  // D4
    'e': 63,  // D#4
    'd': 64,  // E4
    'f': 65,  // F4
    't': 66,  // F#4
    'g': 67,  // G4
    'y': 68,  // G#4
    'h': 69,  // A4
    'u': 70,  // A#4
    'j': 71,  // B4
    'k': 72,  // C5
    'o': 73,  // C#5
    'l': 74,  // D5
    'p': 75,  // D#5
    ';': 76,  // E5
    "'": 77,  // F5
    ']': 78,  // F#5
    '\\': 79, // G5
};

export const authConstants = {
    TOKEN_KEY: 'snugos_token',
    USER_KEY: 'snugos_user',
    REMEMBER_ME_KEY: 'snugos_remember_me',
};

export const SERVER_URL = 'https://snugos-server-api.onrender.com'; // Defined for Issue 1 in Step 1