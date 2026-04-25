// js/ScaleLock.js - Lock MIDI input to musical scales

/**
 * Scale Lock - Constrain MIDI input to notes within a selected musical scale
 * 
 * This module provides:
 * 1. Scale definitions (major, minor, pentatonic, etc.)
 * 2. Note snapping for MIDI input
 * 3. UI panel for scale selection
 */

// Scale definitions: intervals from root note (semitones)
const SCALES = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'natural_minor': [0, 2, 3, 5, 7, 8, 10],
    'harmonic_minor': [0, 2, 3, 5, 7, 8, 11],
    'melodic_minor': [0, 2, 3, 5, 7, 9, 11],
    'pentatonic_major': [0, 2, 4, 7, 9],
    'pentatonic_minor': [0, 3, 5, 7, 10],
    'blues': [0, 3, 5, 6, 7, 10],
    'major_pentatonic': [0, 2, 4, 7, 9],
    'minor_pentatonic': [0, 3, 5, 7, 10],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'phrygian': [0, 1, 3, 5, 7, 8, 10],
    'lydian': [0, 2, 4, 6, 7, 9, 11],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'locrian': [0, 1, 3, 5, 6, 8, 10],
    'whole_tone': [0, 2, 4, 6, 8, 10],
    'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    'diminished': [0, 2, 3, 5, 6, 8, 9, 11],
    ' bebop_major': [0, 2, 4, 5, 7, 9, 10, 11],
    'bebop_dominant': [0, 2, 4, 5, 7, 9, 10, 11],
    'enigmatic_major': [0, 1, 4, 6, 8, 10, 11],
    'enigmatic_minor': [0, 1, 3, 6, 7, 9, 10],
    'hungarian_minor': [0, 2, 3, 6, 7, 8, 11],
    'mixolydian_b6': [0, 2, 4, 5, 7, 8, 10],
    'lydian_diminished': [0, 2, 3, 6, 7, 9, 11],
    'prometheus': [0, 2, 4, 6, 9, 10],
    'ritusen': [0, 2, 5, 7, 9],
    'gamelan': [0, 1, 3, 7, 8],
    'hirajoshi': [0, 2, 3, 7, 8],
    'in': [0, 1, 5, 7, 10],
};

// State
let scaleLockEnabled = false;
let selectedScale = 'major';
let selectedRootNote = 0; // MIDI note number for C (0 = C0)
let scaleOctaveShift = 0; // Shift octaves for scale

// Note names for display
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Get all available scale names
 * @returns {Array<string>}
 */
export function getScaleNames() {
    return Object.keys(SCALES);
}

/**
 * Get intervals for a scale
 * @param {string} scaleName 
 * @returns {Array<number>}
 */
export function getScaleIntervals(scaleName) {
    return SCALES[scaleName] || SCALES['major'];
}

/**
 * Get scale name from intervals
 * @param {Array<number>} intervals 
 * @returns {string|null}
 */
export function getScaleNameFromIntervals(intervals) {
    const normalized = intervals.map(i => ((i % 12) + 12) % 12).sort((a, b) => a - b);
    for (const [name, scaleIntervals] of Object.entries(SCALES)) {
        const normScale = [...scaleIntervals].sort((a, b) => a - b);
        if (normScale.length === normalized.length && normScale.every((v, i) => v === normalized[i])) {
            return name;
        }
    }
    return null;
}

/**
 * Check if a MIDI note is in the current scale
 * @param {number} midiNote 
 * @param {string} scaleName 
 * @param {number} rootNote 
 * @returns {boolean}
 */
export function isNoteInScale(midiNote, scaleName = selectedScale, rootNote = selectedRootNote) {
    const intervals = getScaleIntervals(scaleName);
    const noteInOctave = ((midiNote % 12) + 12) % 12;
    const rootInOctave = ((rootNote % 12) + 12) % 12;
    const noteRelativeToRoot = ((noteInOctave - rootInOctave) + 12) % 12;
    return intervals.includes(noteRelativeToRoot);
}

/**
 * Snap a MIDI note to the nearest note in the scale
 * @param {number} midiNote 
 * @param {string} scaleName 
 * @param {number} rootNote 
 * @returns {number}
 */
export function snapNoteToScale(midiNote, scaleName = selectedScale, rootNote = selectedRootNote) {
    if (isNoteInScale(midiNote, scaleName, rootNote)) {
        return midiNote;
    }
    
    const intervals = getScaleIntervals(scaleName);
    const rootInOctave = ((rootNote % 12) + 12) % 12;
    const noteInOctave = ((midiNote % 12) + 12) % 12;
    
    // Find nearest interval
    let bestInterval = intervals[0];
    let bestDistance = 12;
    
    for (const interval of intervals) {
        const adjustedInterval = (interval + rootInOctave) % 12;
        const distance = Math.min(
            Math.abs(noteInOctave - adjustedInterval),
            Math.abs(noteInOctave - adjustedInterval - 12),
            Math.abs(noteInOctave - adjustedInterval + 12)
        );
        if (distance < bestDistance) {
            bestDistance = distance;
            bestInterval = interval;
        }
    }
    
    // Calculate octave
    const octave = Math.floor(midiNote / 12) - Math.floor(rootInOctave / 12);
    const snappedNote = (octave * 12) + rootInOctave + bestInterval;
    
    return snappedNote;
}

/**
 * Get nearest scale degree for a note
 * @param {number} midiNote 
 * @param {string} scaleName 
 * @param {number} rootNote 
 * @returns {{degree: number, interval: number, noteName: string}}
 */
export function getScaleDegree(midiNote, scaleName = selectedScale, rootNote = selectedRootNote) {
    const intervals = getScaleIntervals(scaleName);
    const rootInOctave = ((rootNote % 12) + 12) % 12;
    const noteInOctave = ((midiNote % 12) + 12) % 12;
    const noteRelativeToRoot = ((noteInOctave - rootInOctave) + 12) % 12;
    
    let nearestInterval = intervals[0];
    let nearestDistance = 12;
    let nearestIndex = 0;
    
    for (let i = 0; i < intervals.length; i++) {
        const interval = intervals[i];
        const distance = Math.min(
            Math.abs(noteInOctave - ((interval + rootInOctave) % 12)),
            Math.abs(noteInOctave - ((interval + rootInOctave) % 12) - 12),
            Math.abs(noteInOctave - ((interval + rootInOctave) % 12) + 12)
        );
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestInterval = interval;
            nearestIndex = i;
        }
    }
    
    const octave = Math.floor(midiNote / 12) - Math.floor(rootInOctave / 12);
    const snappedNote = (octave * 12) + rootInOctave + nearestInterval;
    
    return {
        degree: nearestIndex + 1,
        interval: nearestInterval,
        noteName: NOTE_NAMES[(rootInOctave + nearestInterval) % 12] + octave
    };
}

/**
 * Get notes in scale for a range
 * @param {number} startMidi 
 * @param {number} endMidi 
 * @param {string} scaleName 
 * @param {number} rootNote 
 * @returns {Array<{midi: number, noteName: string, isRoot: boolean}>}
 */
export function getScaleNotesInRange(startMidi, endMidi, scaleName = selectedScale, rootNote = selectedRootNote) {
    const intervals = getScaleIntervals(scaleName);
    const notes = [];
    
    for (let midi = startMidi; midi <= endMidi; midi++) {
        if (isNoteInScale(midi, scaleName, rootNote)) {
            const rootInOctave = ((rootNote % 12) + 12) % 12;
            const noteInOctave = ((midi % 12) + 12) % 12;
            const noteRelativeToRoot = (noteInOctave - rootInOctave + 12) % 12;
            notes.push({
                midi,
                noteName: NOTE_NAMES[noteInOctave] + Math.floor(midi / 12),
                isRoot: noteRelativeToRoot === 0
            });
        }
    }
    
    return notes;
}

// State getters and setters
export function getScaleLockEnabled() { return scaleLockEnabled; }
export function setScaleLockEnabled(enabled) { scaleLockEnabled = !!enabled; }

export function getSelectedScale() { return selectedScale; }
export function setSelectedScale(scale) { 
    if (SCALES[scale]) {
        selectedScale = scale;
    }
}

export function getSelectedRootNote() { return selectedRootNote; }
export function setSelectedRootNote(note) { 
    if (note >= 0 && note <= 127) {
        selectedRootNote = note;
    }
}

export function getScaleOctaveShift() { return scaleOctaveShift; }
export function setScaleOctaveShift(shift) { 
    scaleOctaveShift = Math.max(-2, Math.min(2, shift)); 
}

export function getScaleLockSettings() {
    return {
        enabled: scaleLockEnabled,
        scale: selectedScale,
        rootNote: selectedRootNote,
        octaveShift: scaleOctaveShift
    };
}

export function setScaleLockSettings(settings) {
    if (settings.enabled !== undefined) scaleLockEnabled = !!settings.enabled;
    if (settings.scale && SCALES[settings.scale]) selectedScale = settings.scale;
    if (settings.rootNote !== undefined) selectedRootNote = Math.max(0, Math.min(127, settings.rootNote));
    if (settings.octaveShift !== undefined) scaleOctaveShift = Math.max(-2, Math.min(2, settings.octaveShift));
}

// Apply scale lock to incoming MIDI note
export function applyScaleLock(midiNote, velocity) {
    if (!scaleLockEnabled) {
        return { note: midiNote, velocity, snapped: false };
    }
    
    const snappedNote = snapNoteToScale(midiNote + (scaleOctaveShift * 12));
    return {
        note: snappedNote,
        velocity,
        snapped: snappedNote !== midiNote + (scaleOctaveShift * 12)
    };
}

export default {
    getScaleNames,
    getScaleIntervals,
    getScaleNameFromIntervals,
    isNoteInScale,
    snapNoteToScale,
    getScaleDegree,
    getScaleNotesInRange,
    getScaleLockEnabled,
    setScaleLockEnabled,
    getSelectedScale,
    setSelectedScale,
    getSelectedRootNote,
    setSelectedRootNote,
    getScaleOctaveShift,
    setScaleOctaveShift,
    getScaleLockSettings,
    setScaleLockSettings,
    applyScaleLock,
    NOTE_NAMES
};
