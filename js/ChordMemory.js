// js/ChordMemory.js - Store and recall chord voicings across the project
import { noteNameToMidi, midiToNoteName } from './midiUtils.js';

/**
 * Chord Memory - Store and recall chord voicings across the project
 * 
 * This module allows users to:
 * 1. Capture current chord voicings from selected notes/tracks
 * 2. Store named chord voicings in a library
 * 3. Recall and apply voicings at different root notes
 */

// Chord storage: { chordName: { root: string, type: string, voicings: Array<{midi: number, velocity: number, timing: number}>, color: string, tags: Array<string> } }
let chordLibrary = {};

// Current chord being edited
let currentChordVoicing = null;
let isRecordingVoicing = false;

/**
 * Built-in chord types with intervals (semitones from root)
 */
const CHORD_TYPES = {
    'major': [0, 4, 7],
    'minor': [0, 3, 7],
    'diminished': [0, 3, 6],
    'augmented': [0, 4, 8],
    'maj7': [0, 4, 7, 11],
    'min7': [0, 3, 7, 10],
    '7': [0, 4, 7, 10],
    'min7b5': [0, 3, 6, 10],
    'maj9': [0, 4, 7, 11, 14],
    'min9': [0, 3, 7, 10, 14],
    '9': [0, 4, 7, 10, 14],
    '11': [0, 4, 7, 10, 14, 17],
    '13': [0, 4, 7, 10, 14, 17, 21],
    'sus2': [0, 2, 7],
    'sus4': [0, 5, 7],
    'add9': [0, 4, 7, 14],
    '6': [0, 4, 7, 9],
    'min6': [0, 3, 7, 9],
    'aug7': [0, 4, 8, 10],
    'dim7': [0, 3, 6, 9],
    'maj7b5': [0, 4, 6, 11],
    '7sus4': [0, 5, 7, 10],
    '7#9': [0, 4, 7, 10, 15],
    '6/9': [0, 4, 7, 9, 14],
};

/**
 * Get all chord type names
 * @returns {Array<string>}
 */
export function getChordTypes() {
    return Object.keys(CHORD_TYPES);
}

/**
 * Get intervals for a chord type
 * @param {string} type - Chord type name
 * @returns {Array<number>} Array of semitone intervals from root
 */
export function getChordIntervals(type) {
    return CHORD_TYPES[type] || CHORD_TYPES['major'];
}

/**
 * Build a chord from root note and type
 * @param {string} rootNote - Root note name (e.g., 'C4')
 * @param {string} chordType - Chord type (e.g., 'major', 'minor')
 * @returns {Array<{note: string, midi: number}>}
 */
export function buildChord(rootNote, chordType) {
    const rootMidi = noteNameToMidi(rootNote);
    if (rootMidi === null) return [];
    
    const intervals = getChordIntervals(chordType);
    return intervals.map(interval => {
        const midi = rootMidi + interval;
        return {
            note: midiToNoteName(midi),
            midi: midi
        };
    });
}

/**
 * Start recording a new chord voicing
 * @param {string} rootNote - Root note for the chord
 * @param {string} chordType - Type of chord being recorded
 */
export function startChordRecording(rootNote, chordType) {
    currentChordVoicing = {
        root: rootNote,
        type: chordType,
        notes: [], // Array of {midi, velocity, timing}
        createdAt: new Date().toISOString()
    };
    isRecordingVoicing = true;
    console.log(`[ChordMemory] Started recording: ${rootNote} ${chordType}`);
}

/**
 * Add a note to the current voicing being recorded
 * @param {number} midi - MIDI note number
 * @param {number} velocity - Note velocity (0-127)
 * @param {number} timing - Timing offset from chord start
 */
export function addNoteToChordVoicing(midi, velocity, timing) {
    if (!isRecordingVoicing || !currentChordVoicing) return;
    
    currentChordVoicing.notes.push({
        midi: midi,
        velocity: velocity || 100,
        timing: timing || 0
    });
}

/**
 * Stop recording and save the voicing
 * @param {string} name - Name for the chord voicing
 * @param {string} color - Hex color for visualization
 * @param {Array<string>} tags - Optional tags
 * @returns {boolean} Success status
 */
export function finishChordRecording(name, color = '#6366f1', tags = []) {
    if (!isRecordingVoicing || !currentChordVoicing) {
        console.warn('[ChordMemory] No active recording');
        return false;
    }
    
    if (currentChordVoicing.notes.length === 0) {
        console.warn('[ChordMemory] No notes recorded');
        isRecordingVoicing = false;
        currentChordVoicing = null;
        return false;
    }
    
    // Sort notes by MIDI number for consistent voicing
    currentChordVoicing.notes.sort((a, b) => a.midi - b.midi);
    
    // Store in library
    const chordName = name || `${currentChordVoicing.root} ${currentChordVoicing.type}`;
    chordLibrary[chordName] = {
        root: currentChordVoicing.root,
        type: currentChordVoicing.type,
        notes: currentChordVoicing.notes,
        color: color,
        tags: tags,
        createdAt: currentChordVoicing.createdAt
    };
    
    console.log(`[ChordMemory] Saved chord: ${chordName} with ${currentChordVoicing.notes.length} notes`);
    
    isRecordingVoicing = false;
    currentChordVoicing = null;
    
    return true;
}

/**
 * Cancel the current recording without saving
 */
export function cancelChordRecording() {
    isRecordingVoicing = false;
    currentChordVoicing = null;
    console.log('[ChordMemory] Recording cancelled');
}

/**
 * Get a chord from the library
 * @param {string} name - Chord name
 * @returns {Object|null}
 */
export function getChord(name) {
    return chordLibrary[name] ? JSON.parse(JSON.stringify(chordLibrary[name])) : null;
}

/**
 * Get all chord names
 * @returns {Array<string>}
 */
export function getChordNames() {
    return Object.keys(chordLibrary);
}

/**
 * Get all chords with optional filtering
 * @param {Object} filter - Optional filter { type, tags }
 * @returns {Array<Object>}
 */
export function getAllChords(filter = {}) {
    let chords = Object.entries(chordLibrary).map(([name, data]) => ({
        name,
        ...data
    }));
    
    if (filter.type) {
        chords = chords.filter(c => c.type === filter.type);
    }
    
    if (filter.tags && filter.tags.length > 0) {
        chords = chords.filter(c => 
            filter.tags.some(tag => c.tags.includes(tag))
        );
    }
    
    return chords;
}

/**
 * Transpose a chord to a new root note
 * @param {string} chordName - Name of chord in library
 * @param {string} newRoot - New root note name
 * @returns {Array<{note: string, midi: number, velocity: number, timing: number}>}
 */
export function getTransposedChord(chordName, newRoot) {
    const chord = getChord(chordName);
    if (!chord) return [];
    
    const rootMidi = noteNameToMidi(chord.root);
    const newRootMidi = noteNameToMidi(newRoot);
    
    if (rootMidi === null || newRootMidi === null) return [];
    
    const transposition = newRootMidi - rootMidi;
    
    return chord.notes.map(note => ({
        note: midiToNoteName(note.midi + transposition),
        midi: note.midi + transposition,
        velocity: note.velocity,
        timing: note.timing
    }));
}

/**
 * Delete a chord from the library
 * @param {string} name - Chord name
 * @returns {boolean}
 */
export function deleteChord(name) {
    if (chordLibrary[name]) {
        delete chordLibrary[name];
        console.log(`[ChordMemory] Deleted chord: ${name}`);
        return true;
    }
    return false;
}

/**
 * Rename a chord
 * @param {string} oldName - Current name
 * @param {string} newName - New name
 * @returns {boolean}
 */
export function renameChord(oldName, newName) {
    if (!chordLibrary[oldName]) return false;
    if (chordNames().includes(newName)) {
        console.warn('[ChordMemory] Name already exists');
        return false;
    }
    
    chordLibrary[newName] = chordLibrary[oldName];
    delete chordLibrary[oldName];
    console.log(`[ChordMemory] Renamed ${oldName} to ${newName}`);
    return true;
}

/**
 * Update chord metadata
 * @param {string} name - Chord name
 * @param {Object} updates - Fields to update { color, tags }
 * @returns {boolean}
 */
export function updateChordMetadata(name, updates) {
    if (!chordLibrary[name]) return false;
    
    if (updates.color) {
        chordLibrary[name].color = updates.color;
    }
    if (updates.tags) {
        chordLibrary[name].tags = updates.tags;
    }
    
    return true;
}

/**
 * Import chords from JSON
 * @param {Object} data - Chord library data
 */
export function importChordLibrary(data) {
    if (data && typeof data === 'object') {
        chordLibrary = { ...chordLibrary, ...data };
        console.log(`[ChordMemory] Imported chords`);
    }
}

/**
 * Export chord library
 * @returns {Object}
 */
export function exportChordLibrary() {
    return JSON.parse(JSON.stringify(chordLibrary));
}

/**
 * Clear all chords from library
 */
export function clearChordLibrary() {
    chordLibrary = {};
    console.log('[ChordMemory] Library cleared');
}

/**
 * Get chord names (alias)
 * @returns {Array<string>}
 */
function chordNames() {
    return Object.keys(chordLibrary);
}

/**
 * Auto-detect chord from notes
 * @param {Array<number>} midiNotes - Array of MIDI note numbers
 * @returns {Object} Detected chord { root, type, confidence }
 */
export function detectChord(midiNotes) {
    if (!midiNotes || midiNotes.length < 3) {
        return { root: null, type: null, confidence: 0 };
    }
    
    // Sort and find intervals
    const sorted = [...midiNotes].sort((a, b) => a - b);
    const bassNote = sorted[0];
    
    // Calculate intervals from bass
    const intervals = sorted.map(n => n - bassNote);
    
    // Normalize to 0-11 (chromatic)
    const normalizedIntervals = intervals.map(i => ((i % 12) + 12) % 12).sort((a, b) => a - b);
    
    // Match against known chord types
    let bestMatch = { type: null, confidence: 0 };
    
    for (const [typeName, typeIntervals] of Object.entries(CHORD_TYPES)) {
        const normalizedType = [...typeIntervals].sort((a, b) => a - b);
        
        // Check if intervals match (allowing octave variations)
        if (normalizedIntervals.length >= normalizedType.length) {
            let matches = 0;
            for (const ti of normalizedType) {
                if (normalizedIntervals.includes(ti)) {
                    matches++;
                }
            }
            
            const confidence = matches / normalizedType.length;
            
            if (confidence > bestMatch.confidence) {
                bestMatch = { type: typeName, confidence };
            }
        }
    }
    
    // Get root note name
    const rootNote = midiToNoteName(bassNote);
    
    return {
        root: rootNote,
        type: bestMatch.type,
        confidence: bestMatch.confidence
    };
}

/**
 * Generate chord voicings for a progression
 * @param {Array<{root: string, type: string}>} progression - Array of chord specifications
 * @returns {Array<Object>} Array of chord voicings with MIDI notes
 */
export function generateChordProgression(progression) {
    return progression.map((chord, index) => {
        const chordData = buildChord(chord.root, chord.type);
        return {
            index,
            root: chord.root,
            type: chord.type,
            notes: chordData,
            duration: 4 // Default 4 beats
        };
    });
}

export default {
    getChordTypes,
    getChordIntervals,
    buildChord,
    startChordRecording,
    addNoteToChordVoicing,
    finishChordRecording,
    cancelChordRecording,
    getChord,
    getChordNames,
    getAllChords,
    getTransposedChord,
    deleteChord,
    renameChord,
    updateChordMetadata,
    importChordLibrary,
    exportChordLibrary,
    clearChordLibrary,
    detectChord,
    generateChordProgression
};
