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

export const soundLibraries = {
    "Drums": "assets/drums.zip",
    "Instruments": "assets/instruments.zip",
    "Instruments 2": "assets/instruments2.zip",
    "Instruments 3": "assets/instruments3.zip"
    // Add more libraries here as needed
};

export const numSlices = 8; // Default number of slices for a new Sampler track
export const numDrumSamplerPads = 8; // Number of pads for the DrumSampler
export const samplerMIDINoteStart = 36; // C2, used for mapping MIDI notes to sampler slices/pads

export const defaultVelocity = 0.7; // Default velocity for new notes

export const defaultDesktopBg = '#101010'; // Matches style.css body background

export const MAX_HISTORY_STATES = 50; // Increased from 30 for more undo/redo capacity

// Computer Keyboard to MIDI mapping for Synthesizer-like instruments
// QWERTY layout, bottom row for C-major scale starting on C4 (MIDI 60) by default
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
    // 't': 67, // G4
    // '6': 68, // G#4
    // 'y': 69, // A4
    // '7': 70, // A#4
    // 'u': 71, // B4
    // 'i': 72  // C5
};

// Computer Keyboard to MIDI mapping for Sampler (slices/pads)
// Numbers 1-8 typically map to slices/pads
export const computerKeySamplerMap = {
    'Digit1': samplerMIDINoteStart + 0,
    'Digit2': samplerMIDINoteStart + 1,
    'Digit3': samplerMIDINoteStart + 2,
    'Digit4': samplerMIDINoteStart + 3,
    'Digit5': samplerMIDINoteStart + 4,
    'Digit6': samplerMIDINoteStart + 5,
    'Digit7': samplerMIDINoteStart + 6,
    'Digit8': samplerMIDINoteStart + 7
    // Can extend to 'Digit9', 'Digit0' or other keys if more pads/slices are common
};
