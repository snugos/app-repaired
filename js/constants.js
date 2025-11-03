// js/constants.js - Shared constants for SnugOS

export const STEPS_PER_BAR = 16;
export const defaultStepsPerBar = 16; // Default for new tracks
export const MAX_BARS = 32; // Maximum number of bars a sequence can have

export const MIN_TEMPO = 30; // Minimum tempo in BPM
export const MAX_TEMPO = 300; // Maximum tempo in BPM

export const synthPitches = [
    'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
    'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
    'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
    'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5'
].reverse(); // Reversed for typical top-to-bottom piano roll display

export const soundLibraries = {
    "Drums": "assets/drums.zip",
    "Instruments": "assets/instruments.zip",
    "Instruments 2": "assets/instruments2.zip",
    "Instruments 3": "assets/instruments3.zip"
};

export const numSlices = 8;
export const numDrumSamplerPads = 8;
export const samplerMIDINoteStart = 36; // C2

export const defaultVelocity = 0.7;

export const defaultDesktopBg = '#101010'; // Updated to match style.css for consistency

export const MAX_HISTORY_STATES = 30;

// Computer Keyboard to MIDI mapping
export const computerKeySynthMap = {
    'KeyA': 60, 'KeyW': 61, 'KeyS': 62, 'KeyE': 63, 'KeyD': 64, 'KeyF': 65, 'KeyT': 66,
    'KeyG': 67, 'KeyY': 68, 'KeyH': 69, 'KeyU': 70, 'KeyJ': 71, 'KeyK': 72,
};

export const computerKeySamplerMap = {
    'Digit1': samplerMIDINoteStart + 0, 'Digit2': samplerMIDINoteStart + 1, 'Digit3': samplerMIDINoteStart + 2, 'Digit4': samplerMIDINoteStart + 3,
    'Digit5': samplerMIDINoteStart + 4, 'Digit6': samplerMIDINoteStart + 5, 'Digit7': samplerMIDINoteStart + 6, 'Digit8': samplerMIDINoteStart + 7
};
