// js/constants.js - Shared constants for SnugOS

export const APP_VERSION = "0.1.0"; // Added application version

export const STEPS_PER_BAR = 16;
export const defaultStepsPerBar = 16; // Default for new tracks
export const MAX_BARS = 32; // Maximum number of bars a sequence can have

export const MIN_TEMPO = 30; // Minimum tempo in BPM
export const MAX_TEMPO = 300; // Maximum tempo in BPM

// Note: Reversed for typical top-to-bottom piano roll display in a UI
export const synthPitches = [
    'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
    'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
    'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
    'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5'
].reverse();

// --- UI & Style Constants ---
// MODIFICATION START: Changed default background to 90s teal
export const defaultDesktopBg = '#008080';
// MODIFICATION END

// --- Sound Library & Sample Loading ---
// ... (rest of the file remains unchanged)

export const soundLibraries = {
    // ... (rest of sound libraries)
};

// ... (other constants like audioContextStatus, trackTypes, midi messages)

export const MIDI_NOTE_ON = 144;
export const MIDI_NOTE_OFF = 128;
export const MIDI_CONTROL_CHANGE = 176;

// Computer Keyboard Mapping for Synth (Octave shift is handled in eventHandlers.js)
// Maps computer keys to MIDI notes in a C-major scale starting on C4 (MIDI 60) by default
// Top row for sharps/flats or extended notes.
// 'a' maps to C4 (MIDI 60)
export const computerKeySynthMap = {
    // Bottom row (white keys on piano often)
    'a': 48, // C3 (octave shift will modify this)
    's': 50, // D3
    'd': 52, // E3
    'f': 53, // F3
    'g': 55, // G3
    'h': 57, // A3
    'j': 59, // B3
    'k': 60, // C4

    // Top row (black keys on piano often)
    'w': 49, // C#3
    'e': 51, // D#3
    // 'r': // F (no black key)
    't': 54, // F#3
    'y': 56, // G#3
    'u': 58, // A#3
    // 'i': // C (no black key)

    // Alternative mapping for some DAWs (shifted QWERTY)
    // 'q': 60, // C4
    // '2': 61, // C#4
    // 'w': 62, // D4
    // '3': 63, // D#4
    // 'e': 64, // E4
    // 'r': 65, // F4
    // '5': 66, // F#4
    //...
};