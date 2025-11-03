// js/constants.js - Shared constants for SnugOS

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
        for (let midiNote = PIANO_ROLL_END_MIDI_NOTE; midiNote >= PIANO_ROLL_START_MIDI_NOTE; midiNote--) {
            const noteIndexInOctave = midiNote % 12;
            const octave = Math.floor(midiNote / 12) -1; 
            pitches.push(`${MIDI_NOTE_NAMES[noteIndexInOctave]}${octave}`);
        }
    } else {
        console.error("[Constants] MIDI_NOTE_NAMES is not correctly defined. SYNTH_PITCHES will be empty. Using fallback.");
        for (let i = 83; i >= 36; i--) { pitches.push(`N${i}`);} 
    }
    if (pitches.length === 0) {
        console.error("[Constants] SYNTH_PITCHES generation failed, using hardcoded fallback.");
        return ['B5', 'A#5', 'A5', 'G#5', 'G5', 'F#5', 'F5', 'E5', 'D#5', 'D5', 'C#5', 'C5', 'B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4', 'B3', 'A#3', 'A3', 'G#3', 'G3', 'F#3', 'F3', 'E3', 'D#3', 'D3', 'C#3', 'C3', 'B2', 'A#2', 'A2', 'G#2', 'G2', 'F#2', 'F2', 'E2', 'D#2', 'D2', 'C#2', 'C2'];
    }
    return pitches; 
})();


// --- FIX: Removed hardcoded color constants. The new colors will be read from CSS variables. ---
export const PIANO_ROLL_KEY_WIDTH = 60; 
export const PIANO_ROLL_HEADER_HEIGHT = 25; 
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
    COMPUTER_KEY_SYNTH_OCTAVE_SHIFT = Math.max(-3, COMPUTER_KEY_SYNTH_OCTAVE_SHIFT - 1);
}

export const computerKeySynthMap = {
    'a': 48, 
    's': 50,
    'd': 52,
    'f': 53,
    'g': 55,
    'h': 57,
    'j': 59,
    'k': 60,
    'w': 49,
    'e': 51,
    't': 54,
    'y': 56,
    'u': 58,
};

console.log('[Constants] Initialized SYNTH_PITCHES count:', SYNTH_PITCHES.length);
if (SYNTH_PITCHES.length === 0) {
    console.error("[Constants] CRITICAL FAILURE: SYNTH_PITCHES is empty after all fallbacks. Piano roll will likely fail for synth tracks.");
}
if (typeof numDrumSamplerPads !== 'number' || numDrumSamplerPads <= 0) {
    console.error("[Constants] CRITICAL: numDrumSamplerPads is not a valid positive number:", numDrumSamplerPads);
}
