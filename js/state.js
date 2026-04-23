// js/state.js - Application State Management
import * as Constants from './constants.js';
// showNotification, showConfirmationDialog are accessed via appServices
// import { showNotification, showConfirmationDialog } from './utils.js';
import { Track } from './Track.js';
import { createEffectInstance, getEffectDefaultParams as getEffectDefaultParamsFromRegistry } from './effectsRegistry.js';
import {
    initAudioContextAndMasterMeter as audioInitAudioContextAndMasterMeter
} from './audio.js';
import { encodeSequenceToMidi } from './midiUtils.js';
// import { getAudio, storeAudio } from './db.js'; // Not directly used in this file after refactor to Track class
import { storeProjectState, getProjectState, deleteProjectState } from './db.js'; // For auto-save/crash recovery


// --- Centralized State Variables ---
let tracks = [];
let trackIdCounter = 0;

// Window Management
let openWindowsMap = new Map();
let highestZ = 100;

// Master Audio Chain
let masterEffectsChainState = []; // Array of {id, type, params, toneNode (managed by audio.js)}
// Use numeric fallback until Tone.js is available (Tone.dbToGain(0) = 1.0 linear)
let masterGainValueState = (typeof Tone !== 'undefined' && Tone.dbToGain) ? Tone.dbToGain(0) : 1.0; // Linear gain value

// Effect Presets Storage
let trackEffectsPresets = {}; // { trackId: { presetName: effectsData } }
let masterEffectPresets = {}; // { presetName: { effects: [...], masterGain: number } }

// --- Groove Template Presets ---
// Groove templates define timing offsets for even-numbered 16th notes (swing/shuffle)
const GROOVE_PRESETS = [
    { id: 'none', name: 'None (Straight)', swingAmount: 0 },
    { id: 'swing_50', name: '50% Swing', swingAmount: 0.25 },
    { id: 'swing_66', name: '66% Swing (Triplets)', swingAmount: 0.333 },
    { id: 'swing_75', name: '75% Swing', swingAmount: 0.5 },
    { id: 'swing_33', name: '33% Shuffle', swingAmount: 0.166 }
];
export function getGroovePresets() { return [...GROOVE_PRESETS]; }
export function getGroovePresetById(id) { return GROOVE_PRESETS.find(g => g.id === id) || GROOVE_PRESETS[0]; }
export function getGrooveSwingAmount(grooveId) {
    const preset = getGroovePresetById(grooveId);
    return preset ? preset.swingAmount : 0;
}

// --- Custom Groove Patterns (User-drawn) ---
// Custom groove patterns allow users to draw custom timing offsets for each 16th note position
let customGroovePatterns = {}; // { patternName: { name, divisions, points: [{division, offset, velocity}] } }

export function getCustomGroovePatterns() { return JSON.parse(JSON.stringify(customGroovePatterns)); }

export function saveCustomGroovePattern(name, divisions, points) {
    if (!name || !name.trim()) return false;
    const patternName = name.trim();
    customGroovePatterns[patternName] = {
        name: patternName,
        divisions: divisions || 16,
        points: JSON.parse(JSON.stringify(points || [])),
        createdAt: new Date().toISOString()
    };
    console.log(`[State] Saved custom groove pattern "${patternName}" with ${points?.length || 0} points`);
    return true;
}

export function deleteCustomGroovePattern(name) {
    if (customGroovePatterns[name]) {
        delete customGroovePatterns[name];
        console.log(`[State] Deleted custom groove pattern "${name}"`);
        return true;
    }
    return false;
}

export function getCustomGroovePattern(name) {
    if (customGroovePatterns[name]) {
        return JSON.parse(JSON.stringify(customGroovePatterns[name]));
    }
    return null;
}

export function getCustomGroovePatternNames() {
    return Object.keys(customGroovePatterns);
}

export function applyCustomGrooveToTrack(track, patternName) {
    const pattern = getCustomGroovePattern(patternName);
    if (!pattern) {
        console.warn(`[State] Custom groove pattern "${patternName}" not found`);
        return false;
    }
    if (track && typeof track.setCustomGroovePattern === 'function') {
        track.setCustomGroovePattern(pattern);
        return true;
    }
    return false;
}

// Project Templates Storage
let projectTemplates = {}; // { templateName: templateData }

// MIDI State
let midiAccessGlobal = null;
let activeMIDIInputGlobal = null;

// Sound Browser State
let loadedZipFilesGlobal = {};
let soundLibraryFileTreesGlobal = {};
// MODIFICATION START: Add console logs for initialization
console.log('[State Init] Initializing. loadedZipFilesGlobal created:', loadedZipFilesGlobal);
console.log('[State Init] Initializing. soundLibraryFileTreesGlobal created:', soundLibraryFileTreesGlobal);
// MODIFICATION END
let currentLibraryNameGlobal = null;
let currentSoundFileTreeGlobal = null;
let currentSoundBrowserPathGlobal = [];
let previewPlayerGlobal = null;

// Clipboard
let clipboardDataGlobal = { type: null, data: null, sourceTrackType: null, sequenceLength: null };
// Automation clipboard: { param: string, points: Array<{time, value}>, sourceTrackId: number }
let automationClipboardGlobal = { param: null, points: [], sourceTrackId: null };

// Transport/Sequencing State
let activeSequencerTrackId = null;
let soloedTrackId = null;
let armedTrackId = null;
let isRecordingGlobal = false;
let recordingTrackIdGlobal = null;
let recordingStartTime = 0;

let globalPlaybackMode = 'sequencer'; // 'sequencer' or 'timeline'

// --- Loop Region State ---
let loopRegionEnabled = false;
let loopRegionStart = 0; // in seconds
let loopRegionEnd = 16; // in seconds

// --- Loop Region Getters/Setters ---
export function getLoopRegionEnabled() { return loopRegionEnabled; }
export function setLoopRegionEnabled(enabled) { 
    loopRegionEnabled = !!enabled;
    console.log(`[State] Loop region ${loopRegionEnabled ? 'enabled' : 'disabled'}`);
}
export function getLoopRegionStart() { return loopRegionStart; }
export function setLoopRegionStart(start) { 
    loopRegionStart = Math.max(0, parseFloat(start) || 0);
    console.log(`[State] Loop region start set to: ${loopRegionStart}s`);
}
export function getLoopRegionEnd() { return loopRegionEnd; }
export function setLoopRegionEnd(end) { 
    loopRegionEnd = Math.max(0.1, parseFloat(end) || 16);
    console.log(`[State] Loop region end set to: ${loopRegionEnd}s`);
}
export function getLoopRegion() {
    return { 
        enabled: loopRegionEnabled, 
        start: loopRegionStart, 
        end: loopRegionEnd 
    };
}
export function setLoopRegion(enabled, start, end) {
    loopRegionEnabled = !!enabled;
    loopRegionStart = Math.max(0, parseFloat(start) || 0);
    loopRegionEnd = Math.max(0.1, parseFloat(end) || 16);
    console.log(`[State] Loop region updated: enabled=${loopRegionEnabled}, start=${loopRegionStart}s, end=${loopRegionEnd}s`);
}
// END MODIFICATION

// --- Metronome State ---
let metronomeEnabled = false;
let metronomeVolume = 0.5; // 0-1

let adaptiveMetronomeEnabled = false;
let noteTimingHistory = [];
const MAX_TIMING_HISTORY = 64;

export function getMetronomeEnabled() { return metronomeEnabled; }
export function setMetronomeEnabled(enabled) {
    metronomeEnabled = !!enabled;
    console.log(`[State] Metronome ${metronomeEnabled ? 'enabled' : 'disabled'}`);
}
export function getMetronomeVolume() { return metronomeVolume; }
export function setMetronomeVolume(volume) {
    metronomeVolume = Math.max(0, Math.min(1, parseFloat(volume) || 0.5));
    console.log(`[State] Metronome volume set to: ${metronomeVolume}`);
}
export function getAdaptiveMetronomeEnabled() { return adaptiveMetronomeEnabled; }
export function setAdaptiveMetronomeEnabled(enabled) {
    adaptiveMetronomeEnabled = !!enabled;
    if (!enabled) noteTimingHistory = [];
    console.log(`[State] Adaptive Metronome ${adaptiveMetronomeEnabled ? 'enabled' : 'disabled'}`);
}
export function recordNoteTiming(deviationMs) {
    if (!adaptiveMetronomeEnabled) return;
    noteTimingHistory.push({ deviation: deviationMs });
    if (noteTimingHistory.length > MAX_TIMING_HISTORY) {
        noteTimingHistory.shift();
}
export function getAdaptiveTimingOffset() {
    if (noteTimingHistory.length < 4) return 0;
    const sum = noteTimingHistory.reduce((acc, item) => acc + item.deviation, 0);
    return sum / noteTimingHistory.length;
}
export function resetAdaptiveTimingHistory() {
    noteTimingHistory = [];
}

// --- Tempo Ramps State ---
// tempoRamps: Array of { id, barPosition: number (in bars), bpm: number, curve: 'linear'|'exponential' }
let tempoRampsState = [];
let tempoRampsScheduleId = null;

export function getTempoRampsState() { return tempoRampsState; }

export function addTempoRampPoint(barPosition, bpm, curve = 'linear') {
    const id = `tempoRamp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const validCurves = ['linear', 'exponential', 'stepped'];
    const curveType = validCurves.includes(curve) ? curve : 'linear';
    tempoRampsState.push({ id, barPosition: parseFloat(barPosition) || 0, bpm: parseFloat(bpm) || 120, curve: curveType });
    tempoRampsState.sort((a, b) => a.barPosition - b.barPosition);
    console.log(`[State] Added tempo ramp point at bar ${barPosition}: ${bpm} BPM`);
    return id;
}

export function removeTempoRampPoint(id) {
    const idx = tempoRampsState.findIndex(r => r.id === id);
    if (idx !== -1) {
        tempoRampsState.splice(idx, 1);
        console.log(`[State] Removed tempo ramp point ${id}`);
    }
}

export function updateTempoRampPoint(id, barPosition, bpm, curve) {
    const ramp = tempoRampsState.find(r => r.id === id);
    if (ramp) {
        if (barPosition !== undefined) ramp.barPosition = parseFloat(barPosition) || 0;
        if (bpm !== undefined) ramp.bpm = parseFloat(bpm) || 120;
        if (curve !== undefined) ramp.curve = curve;
        tempoRampsState.sort((a, b) => a.barPosition - b.barPosition);
        console.log(`[State] Updated tempo ramp point ${id}`);
    }
}

export function clearTempoRamps() {
    tempoRampsState = [];
    console.log('[State] Cleared all tempo ramp points');
}

export function setTempoRampsState(ramps) {
    tempoRampsState = Array.isArray(ramps) ? ramps.map(r => ({
        id: r.id || `tempoRamp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        barPosition: parseFloat(r.barPosition) || 0,
        bpm: parseFloat(r.bpm) || 120,
        curve: r.curve || 'linear'
    })) : [];
    tempoRampsState.sort((a, b) => a.barPosition - b.barPosition);
}

// ==================== Time Signature Support ====================
// Time signatures: Array of { id, barPosition: number (bar where change takes effect), numerator: number, denominator: number }
// Default: 4/4 time
let timeSignatureChangesState = [];
let currentTimeSignature = { numerator: 4, denominator: 4 };

export function getTimeSignatureChanges() { return [...timeSignatureChangesState]; }

export function getCurrentTimeSignature() { return { ...currentTimeSignature }; }

export function setCurrentTimeSignature(numerator, denominator) {
    currentTimeSignature = {
        numerator: Math.max(1, Math.min(32, parseInt(numerator) || 4)),
        denominator: Math.max(1, Math.min(32, parseInt(denominator) || 4))
    };
    console.log(`[State] Time signature set to ${currentTimeSignature.numerator}/${currentTimeSignature.denominator}`);
}

export function addTimeSignatureChange(barPosition, numerator, denominator) {
    const id = `ts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const change = {
        id,
        barPosition: Math.max(0, parseFloat(barPosition) || 0),
        numerator: Math.max(1, Math.min(32, parseInt(numerator) || 4)),
        denominator: Math.max(1, Math.min(32, parseInt(denominator) || 4))
    };
    
    // Remove existing change at same position
    timeSignatureChangesState = timeSignatureChangesState.filter(ts => ts.barPosition !== change.barPosition);
    timeSignatureChangesState.push(change);
    timeSignatureChangesState.sort((a, b) => a.barPosition - b.barPosition);
    
    console.log(`[State] Added time signature change at bar ${barPosition}: ${numerator}/${denominator}`);
    return id;
}

export function removeTimeSignatureChange(id) {
    const idx = timeSignatureChangesState.findIndex(ts => ts.id === id);
    if (idx !== -1) {
        timeSignatureChangesState.splice(idx, 1);
        console.log(`[State] Removed time signature change ${id}`);
    }
}

export function updateTimeSignatureChange(id, barPosition, numerator, denominator) {
    const ts = timeSignatureChangesState.find(t => t.id === id);
    if (ts) {
        if (barPosition !== undefined) ts.barPosition = Math.max(0, parseFloat(barPosition) || 0);
        if (numerator !== undefined) ts.numerator = Math.max(1, Math.min(32, parseInt(numerator) || 4));
        if (denominator !== undefined) ts.denominator = Math.max(1, Math.min(32, parseInt(denominator) || 4));
        timeSignatureChangesState.sort((a, b) => a.barPosition - b.barPosition);
        console.log(`[State] Updated time signature change ${id}`);
    }
}

export function clearTimeSignatureChanges() {
    timeSignatureChangesState = [];
    console.log('[State] Cleared all time signature changes');
}

export function setTimeSignatureChanges(changes) {
    timeSignatureChangesState = Array.isArray(changes) ? changes.map(c => ({
        id: c.id || `ts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        barPosition: Math.max(0, parseFloat(c.barPosition) || 0),
        numerator: Math.max(1, Math.min(32, parseInt(c.numerator) || 4)),
        denominator: Math.max(1, Math.min(32, parseInt(c.denominator) || 4))
    })) : [];
    timeSignatureChangesState.sort((a, b) => a.barPosition - b.barPosition);
}

/**
 * Get the time signature at a specific bar position.
 * Returns the active time signature (including any changes) at that bar.
 * @param {number} barPosition - Bar position (0-indexed)
 * @returns {Object} { numerator, denominator }
 */
export function getTimeSignatureAtBar(barPosition) {
    // Find the most recent time signature change before or at this bar
    let activeTs = { ...currentTimeSignature };
    
    for (const ts of timeSignatureChangesState) {
        if (ts.barPosition <= barPosition) {
            activeTs = { numerator: ts.numerator, denominator: ts.denominator };
        } else {
            break;
        }
    }
    
    return activeTs;
}

/**
 * Calculate the duration of one bar in seconds at a given time signature and tempo.
 * @param {number} numerator - Time signature numerator (beats per bar)
 * @param {number} denominator - Time signature denominator (note value)
 * @param {number} bpm - Tempo in beats per minute
 * @returns {number} Duration in seconds
 */
export function calculateBarDuration(numerator, denominator, bpm) {
    const beatDuration = 60 / bpm; // Duration of one beat (quarter note) in seconds
    const denominatorRatio = 4 / denominator; // How many beats the denominator note gets
    return beatDuration * numerator * denominatorRatio;
}

/**
 * Convert a bar position to time in seconds, accounting for time signature changes.
 * @param {number} barPosition - Bar position (can be fractional)
 * @param {number} bpm - Current tempo
 * @returns {number} Time in seconds
 */
export function barPositionToTime(barPosition, bpm) {
    let totalTime = 0;
    let currentBar = 0;
    let lastTs = getTimeSignatureAtBar(0);
    let lastBarDuration = calculateBarDuration(lastTs.numerator, lastTs.denominator, bpm);
    
    // Sort time signature changes by position
    const sortedChanges = [...timeSignatureChangesState].sort((a, b) => a.barPosition - b.barPosition);
    
    for (const tsChange of sortedChanges) {
        if (tsChange.barPosition > barPosition) break;
        
        // Add time for bars before this change
        const barsBeforeTs = tsChange.barPosition - currentBar;
        totalTime += barsBeforeTs * lastBarDuration;
        currentBar = tsChange.barPosition;
        
        // Update time signature
        lastTs = { numerator: tsChange.numerator, denominator: tsChange.denominator };
        lastBarDuration = calculateBarDuration(lastTs.numerator, lastTs.denominator, bpm);
    }
    
    // Add remaining bars
    const remainingBars = barPosition - currentBar;
    totalTime += remainingBars * lastBarDuration;
    
    return totalTime;
}



// --- Scale Hint Overlay State ---
let scaleHintEnabled = false;
let scaleHintRoot = 'C';
let scaleHintType = 'major';
const SCALE_TYPES = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'pentatonic_major', 'pentatonic_minor', 'blues', 'chromatic'];

// Scale intervals (semitones from root)
const SCALE_INTERVALS = {
    'major': [0, 2, 4, 5, 7, 9, 11],
    'minor': [0, 2, 3, 5, 7, 8, 10],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'phrygian': [0, 1, 3, 5, 7, 8, 10],
    'lydian': [0, 2, 4, 6, 7, 9, 11],
    'mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'locrian': [0, 1, 3, 5, 6, 8, 10],
    'pentatonic_major': [0, 2, 4, 7, 9],
    'pentatonic_minor': [0, 3, 5, 7, 10],
    'blues': [0, 3, 5, 6, 7, 10],
    'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getScaleHintEnabled() { return scaleHintEnabled; }
export function setScaleHintEnabled(enabled) { scaleHintEnabled = !!enabled; }
export function getScaleHintRoot() { return scaleHintRoot; }
export function setScaleHintRoot(root) { scaleHintRoot = root || 'C'; }
export function getScaleHintType() { return scaleHintType; }
export function setScaleHintType(type) { scaleHintType = type || 'major'; }
export function getScaleTypes() { return [...SCALE_TYPES]; }

export function getScaleNotes(root, type) {
    const rootNote = root || scaleHintRoot;
    const scaleType = type || scaleHintType;
    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.major;
    return intervals.map(i => NOTE_NAMES[(rootIndex + i) % 12]);
}

export function isNoteInScale(midiNote, root, type) {
    const noteIndex = midiNote % 12;
    const scaleNotes = getScaleNotes(root, type);
    const noteName = NOTE_NAMES[noteIndex];
    return scaleNotes.includes(noteName);
}

export function isNoteNameInScale(pitchName, root, type) {
    if (!pitchName) return false;
    const scaleNotes = getScaleNotes(root, type);
    // pitchName could be like "C4", "C#4", "D4" - we just need the note letter part
    const noteLetter = pitchName.replace(/[0-9]/g, '');
    return scaleNotes.some(note => note === noteLetter || note === pitchName);
}

// --- Scale Lock State ---
// Scale Lock forces all notes to stay within a musical scale
let scaleLockEnabled = false;
let scaleLockRoot = 'C';
let scaleLockType = 'major';
let scaleLockMode = 'snap'; // 'snap' (nearest in-scale note) or 'block' (prevent out-of-scale notes)

export function getScaleLockEnabled() { return scaleLockEnabled; }
export function setScaleLockEnabled(enabled) { 
    scaleLockEnabled = !!enabled; 
    console.log(`[State] Scale Lock ${scaleLockEnabled ? 'enabled' : 'disabled'}`);
}
export function getScaleLockRoot() { return scaleLockRoot; }
export function setScaleLockRoot(root) { scaleLockRoot = root || 'C'; }
export function getScaleLockType() { return scaleLockType; }
export function setScaleLockType(type) { scaleLockType = type || 'major'; }
export function getScaleLockMode() { return scaleLockMode; }
export function setScaleLockMode(mode) { scaleLockMode = mode === 'block' ? 'block' : 'snap'; }

// --- Scale Highlight Mode State ---
// Scale Highlight Mode visually highlights notes that belong to the current scale
let scaleHighlightEnabled = false;

export function getScaleHighlightEnabled() { return scaleHighlightEnabled; }
export function setScaleHighlightEnabled(enabled) {
    scaleHighlightEnabled = !!enabled;
    console.log(`[State] Scale Highlight Mode ${scaleHighlightEnabled ? 'enabled' : 'disabled'}`);
    // Trigger UI update if appServices is available
    if (typeof window !== 'undefined' && window.updateScaleHighlight) {
        window.updateScaleHighlight();
    }
}

/**
 * Get all MIDI note numbers for the current scale across all octaves.
 * Returns an array of MIDI note numbers that are in the current scale lock scale.
 */
export function getScaleHighlightNotes() {
    if (!scaleHighlightEnabled && !scaleLockEnabled) return [];
    
    const root = scaleLockRoot;
    const type = scaleLockType;
    const intervals = SCALE_INTERVALS[type] || SCALE_INTERVALS.major;
    const rootIndex = NOTE_NAMES.indexOf(root);
    
    // Generate all notes in the scale across MIDI range (0-127)
    const scaleNotes = [];
    for (let octave = 0; octave <= 10; octave++) {
        const baseNote = octave * 12;
        intervals.forEach(interval => {
            const note = baseNote + ((rootIndex + interval) % 12);
            if (note >= 0 && note <= 127) {
                scaleNotes.push(note);
            }
        });
    }
    return [...new Set(scaleNotes)].sort((a, b) => a - b);
}

/**
 * Check if a note name (e.g., "C", "C#") is in the current scale.
 */
export function isNoteNameInScale(noteName) {
    const root = scaleLockRoot;
    const type = scaleLockType;
    const scaleNotes = getScaleNotes(root, type);
    return scaleNotes.includes(noteName);
}

/**
 * Quantize a MIDI note to the nearest in-scale note.
 * Returns the quantized MIDI note number, or the original if it's already in scale.
 */
export function quantizeNoteToScale(midiNote, root, type) {
    const rootNote = root || scaleLockRoot;
    const scaleType = type || scaleLockType;
    const intervals = SCALE_INTERVALS[scaleType] || SCALE_INTERVALS.major;
    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    
    // Get the note's position within the octave
    const noteInOctave = midiNote % 12;
    const octave = Math.floor(midiNote / 12);
    
    // Calculate absolute positions of scale notes (0-11)
    const scalePositions = intervals.map(i => (rootIndex + i) % 12);
    
    // If the note is already in the scale, return it
    if (scalePositions.includes(noteInOctave)) {
        return midiNote;
    }
    
    // Find the nearest in-scale note
    let nearestNote = noteInOctave;
    let minDistance = 12;
    
    for (const scaleNote of scalePositions) {
        // Calculate distance (considering wraparound)
        let distance = Math.abs(scaleNote - noteInOctave);
        distance = Math.min(distance, 12 - distance); // Wraparound distance
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestNote = scaleNote;
        }
    }
    
    // Return the quantized note (preserving octave)
    return (octave * 12) + nearestNote;
}

/**
 * Check if a note is in the current scale lock scale.
 * Used for 'block' mode to prevent out-of-scale notes.
 */
export function isNoteInScaleLock(midiNote) {
    if (!scaleLockEnabled) return true; // If scale lock is off, all notes are allowed
    return isNoteInScale(midiNote, scaleLockRoot, scaleLockType);
}

/**
 * Apply scale lock to a note (quantize if enabled).
 * Returns the quantized note, or the original if scale lock is disabled.
 */
export function applyScaleLockToNote(midiNote) {
    if (!scaleLockEnabled) return midiNote;
    if (scaleLockMode === 'block') {
        // In block mode, return the note only if it's in scale
        return isNoteInScaleLock(midiNote) ? midiNote : null;
    }
    // In snap mode, quantize to nearest in-scale note
    return quantizeNoteToScale(midiNote, scaleLockRoot, scaleLockType);
}

// --- Micro Tuning State ---
// Micro tuning allows custom tuning tables for non-standard scales
// Each tuning is defined as cents deviation from equal temperament per semitone (12 values)
const MICRO_TUNING_PRESETS = {
    'equal': {
        name: 'Equal Temperament',
        description: 'Standard 12-tone equal temperament',
        cents: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // All zeros = equal temperament
    },
    'just': {
        name: 'Just Intonation (C)',
        description: 'Pure intervals based on harmonic series, rooted at C',
        cents: [0, 11.73, 3.91, 15.64, -13.69, -1.95, 5.87, 3.91, 17.60, -11.73, 9.78, -7.82]
    },
    'pythagorean': {
        name: 'Pythagorean',
        description: 'Tuning based on perfect fifths (3:2 ratio)',
        cents: [0, 23.46, 3.91, 21.51, -19.55, -1.96, 21.51, 3.91, 25.42, -3.91, 21.51, -19.55]
    },
    'meantone': {
        name: 'Quarter-Comma Meantone',
        description: 'Tempered fifths for pure major thirds',
        cents: [0, -5.37, -10.75, -5.37, -10.75, -5.37, -10.75, 0, -5.37, -10.75, -5.37, -10.75]
    },
    'werckmeister': {
        name: 'Werckmeister III',
        description: 'Baroque well-temperament',
        cents: [0, 0, 3.91, 0, 6.83, 0, 0, 3.91, 0, 0, 0, 0]
    },
    'kirnberger': {
        name: 'Kirnberger III',
        description: 'Another well-temperament for keyboard',
        cents: [0, 0, 10.26, -0.22, -0.22, 0, 0, 10.26, 0, 0, -0.22, 0]
    },
    'arabic': {
        name: 'Arabic (Quarter Tone)',
        description: '24-tone equal division approximation',
        cents: [0, 0, 50, 0, 0, 0, 50, 0, 0, 50, 0, 0] // Quarter tone deviations
    },
    'slendro': {
        name: 'Slendro (Javanese)',
        description: '5-tone equidistant gamelan tuning',
        cents: [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220] // Approximate
    },
    'pelog': {
        name: 'Pelog (Javanese)',
        description: '7-tone gamelan tuning',
        cents: [0, 20, -20, 60, 100, -40, 40, 80, 120, -60, 140, -80] // Approximate
    },
    'custom': {
        name: 'Custom',
        description: 'User-defined custom tuning',
        cents: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Default to equal temperament
    }
};

let microTuningEnabled = false;
let microTuningPreset = 'equal';
let microTuningCents = [...MICRO_TUNING_PRESETS.equal.cents]; // Current tuning table in cents deviation
let microTuningRootNote = 60; // MIDI note that corresponds to the root (default C4)

export function getMicroTuningEnabled() { return microTuningEnabled; }
export function setMicroTuningEnabled(enabled) {
    microTuningEnabled = !!enabled;
    console.log(`[State] Micro Tuning ${microTuningEnabled ? 'enabled' : 'disabled'}`);
}

export function getMicroTuningPreset() { return microTuningPreset; }
export function setMicroTuningPreset(presetId) {
    if (MICRO_TUNING_PRESETS[presetId]) {
        microTuningPreset = presetId;
        if (presetId !== 'custom') {
            microTuningCents = [...MICRO_TUNING_PRESETS[presetId].cents];
        }
        console.log(`[State] Micro Tuning preset set to: ${MICRO_TUNING_PRESETS[presetId].name}`);
    }
}

export function getMicroTuningCents() { return [...microTuningCents]; }
export function setMicroTuningCents(centsArray) {
    if (Array.isArray(centsArray) && centsArray.length === 12) {
        microTuningCents = centsArray.map(c => parseFloat(c) || 0);
        microTuningPreset = 'custom';
        console.log(`[State] Custom micro tuning table updated`);
    }
}

export function getMicroTuningRootNote() { return microTuningRootNote; }
export function setMicroTuningRootNote(midiNote) {
    microTuningRootNote = Math.max(0, Math.min(127, parseInt(midiNote) || 60));
    console.log(`[State] Micro Tuning root note set to: ${microTuningRootNote}`);
}

export function getMicroTuningPresets() {
    return Object.entries(MICRO_TUNING_PRESETS).map(([id, preset]) => ({
        id,
        name: preset.name,
        description: preset.description,
        cents: preset.cents
    }));
}

export function getMicroTuningPresetById(id) {
    return MICRO_TUNING_PRESETS[id] ? {
        id,
        ...MICRO_TUNING_PRESETS[id]
    } : null;
}

/**
 * Apply micro tuning to convert a MIDI note to frequency.
 * Returns the frequency in Hz with micro tuning applied.
 * @param {number} midiNote - The MIDI note number (0-127)
 * @param {number} baseFrequency - Optional base frequency for A4 (default 440Hz)
 * @returns {number} Frequency in Hz
 */
export function midiNoteToFrequencyWithMicroTuning(midiNote, baseFrequency = 440) {
    if (!microTuningEnabled) {
        // Standard equal temperament calculation
        return baseFrequency * Math.pow(2, (midiNote - 69) / 12);
    }
    
    // Apply micro tuning
    // Calculate the deviation from the root note
    const semitonesFromRoot = midiNote - microTuningRootNote;
    const octave = Math.floor(semitonesFromRoot / 12);
    const semitoneInOctave = ((semitonesFromRoot % 12) + 12) % 12;
    
    // Get the cents deviation for this semitone
    const centsDeviation = microTuningCents[semitoneInOctave] || 0;
    
    // Calculate frequency with micro tuning
    // Frequency = rootFrequency * 2^(octave) * 2^(semitoneInOctave/12) * 2^(centsDeviation/1200)
    const rootFrequency = baseFrequency * Math.pow(2, (microTuningRootNote - 69) / 12);
    const equalTemperamentRatio = Math.pow(2, (octave * 12 + semitoneInOctave) / 12);
    const microTuningRatio = Math.pow(2, centsDeviation / 1200);
    
    return rootFrequency * equalTemperamentRatio * microTuningRatio;
}

/**
 * Get the frequency ratio for a given interval with micro tuning applied.
 * Useful for synthesizers that use frequency ratios.
 */
export function getMicroTuningFrequencyRatio(interval, rootNote = microTuningRootNote) {
    if (!microTuningEnabled) {
        return Math.pow(2, interval / 12);
    }
    
    const semitonesFromRoot = rootNote + interval - microTuningRootNote;
    const octave = Math.floor(semitonesFromRoot / 12);
    const semitoneInOctave = ((semitonesFromRoot % 12) + 12) % 12;
    const centsDeviation = microTuningCents[semitoneInOctave] || 0;
    
    const equalRatio = Math.pow(2, (octave * 12 + semitoneInOctave) / 12);
    const microRatio = Math.pow(2, centsDeviation / 1200);
    
    return equalRatio * microRatio;
}

// Undo/Redo
let undoStack = [];
let redoStack = [];

// --- MIDI Learn / Mapping ---
let midiLearnMode = false; // Whether we're currently in learn mode
let midiLearnTarget = null; // { type: 'track'|'master', targetId: number|null, paramPath: string }
let midiMappings = {}; // { 'ccX_channelY': { type: 'track'|'master', targetId: number|null, paramPath: string, min: number, max: number } }

export function getMidiLearnMode() { return midiLearnMode; }
export function setMidiLearnMode(enabled) { 
    midiLearnMode = !!enabled; 
    if (!midiLearnMode) midiLearnTarget = null;
    console.log(`[State] MIDI Learn mode ${midiLearnMode ? 'enabled' : 'disabled'}`);
}
export function getMidiLearnTarget() { return midiLearnTarget; }
export function setMidiLearnTarget(target) { midiLearnTarget = target; }
export function getMidiMappings() { return { ...midiMappings }; }
export function addMidiMapping(ccNumber, channel, target) {
    const key = `cc${ccNumber}_channel${channel}`;
    midiMappings[key] = { ...target, min: 0, max: 1 };
    console.log(`[State] Added MIDI mapping: ${key} -> ${target.type}:${target.targetId}:${target.paramPath}`);
}
export function removeMidiMapping(ccNumber, channel) {
    const key = `cc${ccNumber}_channel${channel}`;
    if (midiMappings[key]) {
        delete midiMappings[key];
        console.log(`[State] Removed MIDI mapping: ${key}`);
    }
}
export function getMidiMappingForCC(ccNumber, channel) {
    const key = `cc${ccNumber}_channel${channel}`;
    return midiMappings[key] || null;
}
export function clearAllMidiMappings() {
    midiMappings = {};
    console.log('[State] Cleared all MIDI mappings');
}

// --- MIDI CC Visualizer ---
let ccVisualizerValues = {}; // { 'ccX_channelY': number (0-1) }
let ccVisualizerMaxBars = 16; // Number of bars to show in history

export function getCcVisualizerValues() { return { ...ccVisualizerValues }; }
export function updateCcVisualizerValue(ccNumber, channel, value) {
    const key = `cc${ccNumber}_channel${channel}`;
    ccVisualizerValues[key] = Math.max(0, Math.min(1, value));
// --- MIDI Output ---
let activeMidiOutputGlobal = null; // Currently selected MIDI output device

export function setActiveMidiOutputState(output) { activeMidiOutputGlobal = output; }
export function getActiveMidiOutputState() { return activeMidiOutputGlobal; }

export function getMidiOutputDevices() {
    if (!midiAccessGlobal || !midiAccessGlobal.outputs) return [];
    const outputs = [];
    midiAccessGlobal.outputs.forEach((output) => {
        outputs.push({ id: output.id, name: output.name || `MIDI Device ${output.id.slice(-4)}` });
    });
    return outputs;
}

// Send MIDI note on message
export function sendMidiNoteOn(note, velocity = 127, channel = 0) {
    if (!activeMidiOutputGlobal) {
        console.warn('[MIDI Output] No active MIDI output device selected');
        return false;
    }
    try {
        const noteOnMessage = [0x90 | (channel & 0x0F), note & 0x7F, velocity & 0x7F];
        activeMidiOutputGlobal.send(noteOnMessage);
        return true;
    } catch (e) {
        console.error('[MIDI Output] Error sending Note On:', e);
        return false;
    }
}

// Send MIDI note off message
export function sendMidiNoteOff(note, channel = 0) {
    if (!activeMidiOutputGlobal) {
        console.warn('[MIDI Output] No active MIDI output device selected');
        return false;
    }
    try {
        const noteOffMessage = [0x80 | (channel & 0x0F), note & 0x7F, 0];
        activeMidiOutputGlobal.send(noteOffMessage);
        return true;
    } catch (e) {
        console.error('[MIDI Output] Error sending Note Off:', e);
        return false;
    }
}

// Send MIDI CC message
export function sendMidiCC(cc, value, channel = 0) {
    if (!activeMidiOutputGlobal) {
        console.warn('[MIDI Output] No active MIDI output device selected');
        return false;
    }
    try {
        const ccMessage = [0xB0 | (channel & 0x0F), cc & 0x7F, value & 0x7F];
        activeMidiOutputGlobal.send(ccMessage);
        return true;
    } catch (e) {
        console.error('[MIDI Output] Error sending CC:', e);
        return false;
    }
}

// Select MIDI output device
export function selectMidiOutput(deviceId) {
    if (!midiAccessGlobal || !midiAccessGlobal.outputs) {
        console.warn('[MIDI Output] MIDI not available');
        return;
    }
    
    if (activeMidiOutputGlobal && typeof activeMidiOutputGlobal.close === 'function') {
        try { activeMidiOutputGlobal.close(); } catch (e) {}
    }
    
    if (deviceId) {
        const output = midiAccessGlobal.outputs.get(deviceId);
        if (output) {
            output.open().then((port) => {
                setActiveMidiOutputState(port);
                console.log(`[MIDI Output] Output selected: ${port.name}`);
            }).catch(err => {
                console.error(`[MIDI Output] Error opening output:`, err);
                setActiveMidiOutputState(null);
            });
        } else {
            setActiveMidiOutputState(null);
        }
    } else {
        setActiveMidiOutputState(null);
    }
}

}

// --- Project Export Presets ---
// Stored as { presetName: { tempo, format, sampleRate, bitDepth, includeStems, stemTrackIds, bounceTracks, bounceStartBar, bounceEndBar, ... } }
let exportPresets = {};

export function getExportPresetsState() { return exportPresets; }

export function saveExportPreset(presetName, presetData) {
    exportPresets[presetName] = JSON.parse(JSON.stringify(presetData));
    console.log(`[State] Saved export preset "${presetName}"`);
}

export function deleteExportPreset(presetName) {
    if (exportPresets[presetName]) {
        delete exportPresets[presetName];
        console.log(`[State] Deleted export preset "${presetName}"`);
    }
}

export function getExportPreset(presetName) {
    if (exportPresets[presetName]) {
        return JSON.parse(JSON.stringify(exportPresets[presetName]));
    }
    return null;
}

export function getExportPresetNames() {
    return Object.keys(exportPresets);
}

// --- Chord Memory ---
// chordMemorySlots: Array of { id, name, notes: [{pitch, velocity}], timestamp }
// Stores chord voicings that can be triggered with a single key
let chordMemorySlots = [];

export function getChordMemorySlots() { return chordMemorySlots; }

/**
 * Store a chord in memory.
 * @param {string} name - Name for the chord (e.g., "C Major", "G7")
 * @param {Array} notes - Array of {pitch: number (MIDI note), velocity: number (0-1)}
 * @returns {string} The ID of the stored chord
 */
export function storeChord(name, notes) {
    const id = `chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const chord = {
        id,
        name: name || `Chord ${chordMemorySlots.length + 1}`,
        notes: notes.map(n => ({
            pitch: Math.round(n.pitch),
            velocity: Math.max(0, Math.min(1, n.velocity || 0.8))
        })),
        timestamp: Date.now()
    };
    chordMemorySlots.push(chord);
    console.log(`[State] Stored chord "${chord.name}" with ${chord.notes.length} notes`);
    return id;
}

/**
 * Delete a chord from memory.
 * @param {string} chordId - The ID of the chord to delete
 */
export function deleteChord(chordId) {
    const idx = chordMemorySlots.findIndex(c => c.id === chordId);
    if (idx !== -1) {
        const deleted = chordMemorySlots.splice(idx, 1)[0];
        console.log(`[State] Deleted chord "${deleted.name}"`);
    }
}

/**
 * Get a chord by ID.
 * @param {string} chordId - The ID of the chord
 * @returns {Object|null} The chord object or null if not found
 */
export function getChordById(chordId) {
    return chordMemorySlots.find(c => c.id === chordId) || null;
}

/**
 * Trigger a stored chord - plays all notes simultaneously.
 * @param {string} chordId - The ID of the chord to trigger
 * @param {number} trackId - Optional track ID to play on (uses armed track if null)
 * @param {number} duration - Duration in seconds (0 = indefinite/legato)
 * @returns {boolean} True if chord was triggered successfully
 */
export function triggerChord(chordId, trackId = null, duration = 0) {
    const chord = getChordById(chordId);
    if (!chord) {
        console.warn(`[State triggerChord] Chord ${chordId} not found`);
        return false;
    }
    
    const targetTrackId = trackId || armedTrackId || activeSequencerTrackId;
    if (targetTrackId === null) {
        console.warn('[State triggerChord] No target track specified');
        return false;
    }
    
    const track = tracks.find(t => t.id === targetTrackId);
    if (!track) {
        console.warn(`[State triggerChord] Track ${targetTrackId} not found`);
        return false;
    }
    
    // Play all notes in the chord
    const now = Tone.now();
    chord.notes.forEach(note => {
        if (track.playNote) {
            track.playNote(note.pitch, now, duration > 0 ? duration : undefined, note.velocity);
        } else if (track.instrument && track.instrument.triggerAttack) {
            const freq = Tone.Frequency(note.pitch, 'midi').toFrequency();
            track.instrument.triggerAttack(freq, now, note.velocity);
            if (duration > 0) {
                track.instrument.triggerRelease(freq, now + duration);
            }
        }
    });
    
    console.log(`[State triggerChord] Triggered chord "${chord.name}" on track ${targetTrackId}`);
    return true;
}

/**
 * Clear all stored chords.
 */
export function clearAllChords() {
    chordMemorySlots = [];
    console.log('[State] Cleared all chord memory slots');
}

/**
 * Rename a stored chord.
 * @param {string} chordId - The ID of the chord
 * @param {string} newName - New name for the chord
 */
export function renameChord(chordId, newName) {
    const chord = chordMemorySlots.find(c => c.id === chordId);
    if (chord) {
        chord.name = newName;
        console.log(`[State] Renamed chord to "${newName}"`);
    }
}

/**
 * Import chords from project data.
 * @param {Array} chords - Array of chord objects to import
 */
export function setChordMemoryState(chords) {
    chordMemorySlots = Array.isArray(chords) ? chords.map(c => ({
        id: c.id || `chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: c.name || 'Unnamed Chord',
        notes: Array.isArray(c.notes) ? c.notes.map(n => ({
            pitch: Math.round(n.pitch),
            velocity: Math.max(0, Math.min(1, n.velocity || 0.8))
        })) : [],
        timestamp: c.timestamp || Date.now()
    })) : [];
    console.log(`[State] Imported ${chordMemorySlots.length} chord memory slots`);
}

// --- AppServices Placeholder (will be populated by main.js) ---
let appServices = {}; // Populated by initializeStateModule

export function initializeStateModule(services) {
    appServices = services || {}; // Ensure appServices is an object
    if (!Array.isArray(masterEffectsChainState)) {
        masterEffectsChainState = [];
    }
    // Ensure playback mode services are set up if not already provided
    if (appServices && typeof appServices.getPlaybackMode !== 'function') {
        appServices.getPlaybackMode = getPlaybackModeState;
    }
    if (appServices && typeof appServices.setPlaybackMode !== 'function') {
        appServices.setPlaybackMode = setPlaybackModeStateInternal;
    }
    console.log("[State] State module initialized. AppServices keys:", Object.keys(appServices));
}

// --- Audio Stretching Quality Presets ---
let audioStretchingQuality = 'balanced'; // 'fast' | 'balanced' | 'high'

export function getAudioStretchingQuality() { return audioStretchingQuality; }

export function setAudioStretchingQuality(quality) {
    const validQualities = ['fast', 'balanced', 'high'];
    if (validQualities.includes(quality)) {
        audioStretchingQuality = quality;
        console.log(`[State] Audio stretching quality set to: ${quality}`);
    } else {
        console.warn(`[State] Invalid audio stretching quality: ${quality}. Valid options: ${validQualities.join(', ')}`);
    }
}

// --- Getters for Centralized State ---
export function getTracksState() { return tracks; }
export function getTrackByIdState(id) { return tracks.find(t => t.id === id); }

export function getOpenWindowsState() { return openWindowsMap; }
export function getWindowByIdState(id) { return openWindowsMap.get(id); }
export function getHighestZState() { return highestZ; }
export function getMasterEffectsState() { return masterEffectsChainState; }
export function getMasterGainValueState() { return masterGainValueState; }

export function getMidiAccessState() { return midiAccessGlobal; }
export function getActiveMIDIInputState() { return activeMIDIInputGlobal; }

// MODIFICATION START: Add console logs to getters
export function getLoadedZipFilesState() {
    console.log('[State GET] getLoadedZipFilesState. Keys:', loadedZipFilesGlobal ? Object.keys(loadedZipFilesGlobal) : 'null/undefined');
    return loadedZipFilesGlobal;
}
export function getSoundLibraryFileTreesState() {
    console.log('[State GET] getSoundLibraryFileTreesState. Keys:', soundLibraryFileTreesGlobal ? Object.keys(soundLibraryFileTreesGlobal) : 'null/undefined');
    if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"] && Object.keys(soundLibraryFileTreesGlobal["Drums"]).length > 0) {
        console.log('[State GET] "Drums" tree exists and is NOT empty.');
    } else if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"]) {
        console.warn('[State GET] "Drums" tree exists but IS EMPTY!');
    }
    return soundLibraryFileTreesGlobal;
}
// MODIFICATION END
export function getCurrentLibraryNameState() { return currentLibraryNameGlobal; }
export function getCurrentSoundFileTreeState() { return currentSoundFileTreeGlobal; }
export function getCurrentSoundBrowserPathState() { return currentSoundBrowserPathGlobal; }
export function getPreviewPlayerState() { return previewPlayerGlobal; }

export function getClipboardDataState() { return clipboardDataGlobal; }
export function getAutomationClipboardState() { return automationClipboardGlobal; }
export function setAutomationClipboardState(data) { 
    automationClipboardGlobal = typeof data === 'object' && data !== null ? data : { param: null, points: [], sourceTrackId: null }; 
}
export function getArmedTrackIdState() { return armedTrackId; }
export function getSoloedTrackIdState() { return soloedTrackId; }
export function setSoloedTrackIdState(id) { soloedTrackId = id; }
export function isTrackRecordingState() { return isRecordingGlobal; }
export function getRecordingTrackIdState() { return recordingTrackIdGlobal; }
export function getRecordingStartTimeState() { return recordingStartTime; }
export function getActiveSequencerTrackIdState() { return activeSequencerTrackId; }
export function getUndoStackState() { return undoStack; }
export function getRedoStackState() { return redoStack; }
export function getPlaybackModeState() { return globalPlaybackMode; }

// --- Track Effects Presets ---
export function getTrackEffectsPresetsState() { return trackEffectsPresets; }

export function saveTrackEffectPreset(trackId, presetName, effectsData) {
    if (!trackEffectsPresets[trackId]) {
        trackEffectsPresets[trackId] = {};
    }
    trackEffectsPresets[trackId][presetName] = JSON.parse(JSON.stringify(effectsData));
    console.log(`[State] Saved effect preset "${presetName}" for track ${trackId}`);
}

export function deleteTrackEffectPreset(trackId, presetName) {
    if (trackEffectsPresets[trackId] && trackEffectsPresets[trackId][presetName]) {
        delete trackEffectsPresets[trackId][presetName];
        console.log(`[State] Deleted effect preset "${presetName}" for track ${trackId}`);
    }
}

export function getTrackEffectPreset(trackId, presetName) {
    if (trackEffectsPresets[trackId] && trackEffectsPresets[trackId][presetName]) {
        return JSON.parse(JSON.stringify(trackEffectsPresets[trackId][presetName]));
    }
    return null;
}

export function getTrackEffectPresetNames(trackId) {
    if (trackEffectsPresets[trackId]) {
        return Object.keys(trackEffectsPresets[trackId]);
    }
    return [];
}

// --- Track Templates ---
// Stores templates for individual track configurations
let trackTemplates = {}; // { templateName: { type, name, volume, pan, color, synthEngineType?, synthParams?, activeEffects, drumSamplerPads?, instrumentSamplerSettings?, slices? } }
export function getTrackTemplatesState() { return trackTemplates; }

export function saveTrackTemplate(templateName, trackData) {
    try {
        const template = {
            name: templateName,
            createdAt: new Date().toISOString(),
            type: trackData.type,
            name: trackData.name || templateName,
            volume: trackData.volume !== undefined ? trackData.volume : 0.7,
            pan: trackData.pan !== undefined ? trackData.pan : 0,
            color: trackData.color || '#3b82f6',
            activeEffects: (trackData.activeEffects || []).map(e => ({
                id: e.id,
                type: e.type,
                params: e.params ? JSON.parse(JSON.stringify(e.params)) : {}
            }))
        };
        
        if (trackData.type === 'Synth') {
            template.synthEngineType = trackData.synthEngineType || 'MonoSynth';
            template.synthParams = trackData.synthParams ? JSON.parse(JSON.stringify(trackData.synthParams)) : {};
        } else if (trackData.type === 'Sampler') {
            template.slices = trackData.slices ? JSON.parse(JSON.stringify(trackData.slices)) : [];
        } else if (trackData.type === 'DrumSampler') {
            template.drumSamplerPads = (trackData.drumSamplerPads || []).map(p => ({
                volume: p.volume,
                pitchShift: p.pitchShift,
                envelope: p.envelope ? JSON.parse(JSON.stringify(p.envelope)) : {}
            }));
        } else if (trackData.type === 'InstrumentSampler') {
            template.instrumentSamplerSettings = trackData.instrumentSamplerSettings ? JSON.parse(JSON.stringify(trackData.instrumentSamplerSettings)) : {};
        } else if (trackData.type === 'Lyrics') {
            // Lyrics track has no special settings to save
        }
        
        trackTemplates[templateName] = template;
        console.log(`[State] Saved track template "${templateName}" for type "${template.type}"`);
        return true;
    } catch (error) {
        console.error(`[State] Error saving track template "${templateName}":`, error);
        return false;
    }
}

export function deleteTrackTemplate(templateName) {
    if (trackTemplates[templateName]) {
        delete trackTemplates[templateName];
        console.log(`[State] Deleted track template "${templateName}"`);
        return true;
    }
    return false;
}

export function renameTrackTemplate(oldName, newName) {
    if (!trackTemplates[oldName]) {
        console.warn(`[State] Track template "${oldName}" not found`);
        return false;
    }
    if (trackTemplates[newName]) {
        console.warn(`[State] Track template "${newName}" already exists`);
        return false;
    }
    if (!newName || newName.trim() === '') {
        console.warn(`[State] Invalid template name`);
        return false;
    }
    
    trackTemplates[newName] = trackTemplates[oldName];
    trackTemplates[newName].name = newName;
    delete trackTemplates[oldName];
    console.log(`[State] Renamed track template "${oldName}" to "${newName}"`);
    return true;
}

export function getTrackTemplate(templateName) {
    if (trackTemplates[templateName]) {
        return JSON.parse(JSON.stringify(trackTemplates[templateName]));
    }
    return null;
}

export function getTrackTemplateNames() {
    return Object.keys(trackTemplates);
}

export function applyTrackTemplate(templateName, targetTrack) {
    const template = getTrackTemplate(templateName);
    if (!template) {
        console.warn(`[State] Track template "${templateName}" not found`);
        return false;
    }
    
    try {
        targetTrack.name = template.name;
        targetTrack.volume = template.volume;
        targetTrack.pan = template.pan;
        targetTrack.color = template.color;
        
        if (template.synthParams && targetTrack.synthParams) {
            Object.assign(targetTrack.synthParams, template.synthParams);
        }
        
        console.log(`[State] Applied track template "${templateName}" to track ${targetTrack.id}`);
        return true;
    } catch (error) {
        console.error(`[State] Error applying track template "${templateName}":`, error);
        return false;
    }
}

// --- Project Templates ---
export function getProjectTemplatesState() { return projectTemplates; }

export function saveProjectTemplate(templateName, includeTracks = true, includeMasterEffects = true) {
    try {
        const templateData = {
            name: templateName,
            createdAt: new Date().toISOString(),
            globalSettings: {
                tempo: Tone.Transport.bpm.value,
                masterVolume: getMasterGainValueState()
            },
            tracks: [],
            masterEffects: []
        };
        
        if (includeMasterEffects) {
            templateData.masterEffects = getMasterEffectsState().map(effect => ({
                id: effect.id,
                type: effect.type,
                params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {}
            }));
        }
        
        if (includeTracks) {
            templateData.tracks = getTracksState().map(track => {
                if (!track || typeof track.id === 'undefined') return null;
                const trackData = {
                    type: track.type,
                    name: track.name,
                    volume: track.previousVolumeBeforeMute || track.volume,
                    activeEffects: (track.activeEffects || []).map(effect => ({
                        id: effect.id,
                        type: effect.type,
                        params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {}
                    }))
                };
                if (track.type === 'Synth') {
                    trackData.synthEngineType = track.synthEngineType || 'MonoSynth';
                    trackData.synthParams = track.synthParams ? JSON.parse(JSON.stringify(track.synthParams)) : {};
                } else if (track.type === 'Sampler') {
                    trackData.slices = track.slices ? JSON.parse(JSON.stringify(track.slices)) : [];
                    trackData.selectedSliceForEdit = track.selectedSliceForEdit;
                } else if (track.type === 'DrumSampler') {
                    trackData.drumSamplerPads = (track.drumSamplerPads || []).map(p => ({
                        volume: p.volume,
                        pitchShift: p.pitchShift,
                        envelope: p.envelope ? JSON.parse(JSON.stringify(p.envelope)) : {}
                    }));
                }
                return trackData;
            }).filter(td => td !== null);
        }
        
        projectTemplates[templateName] = templateData;
        console.log(`[State] Saved project template "${templateName}" with ${templateData.tracks.length} tracks`);
        return true;
    } catch (error) {
        console.error(`[State] Error saving project template "${templateName}":`, error);
        return false;
    }
}

export function deleteProjectTemplate(templateName) {
    if (projectTemplates[templateName]) {
        delete projectTemplates[templateName];
        console.log(`[State] Deleted project template "${templateName}"`);
        return true;
    }
    return false;
}

export function getProjectTemplate(templateName) {
    if (projectTemplates[templateName]) {
        return JSON.parse(JSON.stringify(projectTemplates[templateName]));
    }
    return null;
}

export function getProjectTemplateNames() {
    return Object.keys(projectTemplates);
}

export function loadProjectTemplate(templateName, clearExisting = true) {
    const template = getProjectTemplate(templateName);
    if (!template) {
        console.warn(`[State] Project template "${templateName}" not found`);
        return false;
    }
    
    try {
        if (clearExisting) {
            const existingTracks = getTracksState();
            for (const track of existingTracks) {
                if (track?.dispose) track.dispose();
            }
            tracks = [];
            trackIdCounter = 0;
        }
        
        if (template.globalSettings) {
            if (template.globalSettings.tempo) {
                Tone.Transport.bpm.value = template.globalSettings.tempo;
            }
        }
        
        if (template.masterEffects && appServices.addMasterEffectToAudio) {
            for (const effectData of template.masterEffects) {
                appServices.addMasterEffectToAudio(effectData.type, effectData.params);
            }
        }
        
        for (const trackData of template.tracks) {
            const newTrack = appServices.createTrackInternal(trackData.type, trackData.name);
            if (newTrack) {
                if (trackData.volume !== undefined) {
                    newTrack.volume = trackData.volume;
                    if (newTrack.gainNode) newTrack.gainNode.gain.value = newTrack.volume;
                }
                
                if (trackData.type === 'Synth' && trackData.synthParams && newTrack.synthParams) {
                    Object.assign(newTrack.synthParams, trackData.synthParams);
                    if (newTrack.synth) {
                        newTrack.synth.set(trackData.synthParams);
                    }
                }
                
                if (trackData.type === 'Sampler' && trackData.slices) {
                    newTrack.slices = trackData.slices;
                }
                
                if (trackData.type === 'DrumSampler' && trackData.drumSamplerPads) {
                    newTrack.drumSamplerPads = trackData.drumSamplerPads;
                }
                
                if (trackData.activeEffects && appServices.addEffectToTrack) {
                    for (const effectData of trackData.activeEffects) {
                        appServices.addEffectToTrack(newTrack.id, effectData.type, effectData.params);
                    }
                }
            }
        }
        
        console.log(`[State] Loaded project template "${templateName}"`);
        return true;
    } catch (error) {
        console.error(`[State] Error loading project template "${templateName}":`, error);
        return false;
    }
}


// --- Setters for Centralized State (called internally or via appServices) ---
export function addWindowToStoreState(id, instance) { openWindowsMap.set(id, instance); }
export function removeWindowFromStoreState(id) { openWindowsMap.delete(id); }
export function setHighestZState(value) { highestZ = Number.isFinite(value) ? value : 100; }
export function incrementHighestZState() { return ++highestZ; }

export function setMasterEffectsState(newChain) { masterEffectsChainState = Array.isArray(newChain) ? newChain : []; }
export function setMasterGainValueState(value) { masterGainValueState = Number.isFinite(value) ? value : (typeof Tone !== 'undefined' && Tone.dbToGain) ? Tone.dbToGain(0) : 1.0; }

export function setMidiAccessState(access) { midiAccessGlobal = access; }
export function setActiveMIDIInputState(input) { activeMIDIInputGlobal = input; }

// MODIFICATION START: Add console logs to setters
export function setLoadedZipFilesState(files) {
    console.log('[State SET] setLoadedZipFilesState. Incoming keys:', files ? Object.keys(files) : 'null/undefined');
    loadedZipFilesGlobal = typeof files === 'object' && files !== null ? files : {};
    console.log('[State SET] setLoadedZipFilesState. loadedZipFilesGlobal NOW has keys:', Object.keys(loadedZipFilesGlobal));
    if (loadedZipFilesGlobal && loadedZipFilesGlobal["Drums"]) {
         console.log('[State SET] "Drums" JSZip instance IS in loadedZipFilesGlobal.');
    } else {
         console.log('[State SET] "Drums" JSZip instance IS NOT in loadedZipFilesGlobal after set.');
    }
}
export function setSoundLibraryFileTreesState(trees) {
    console.log('[State SET] setSoundLibraryFileTreesState. Incoming keys:', trees ? Object.keys(trees) : 'null/undefined');
    if (trees && trees["Drums"]) {
        console.log('[State SET] setSoundLibraryFileTreesState: Incoming "Drums" tree has keys count:', Object.keys(trees["Drums"]).length);
    } else if (trees) {
         console.log('[State SET] setSoundLibraryFileTreesState: Incoming trees object does not have "Drums" key.');
    }

    soundLibraryFileTreesGlobal = typeof trees === 'object' && trees !== null ? trees : {};
    console.log('[State SET] setSoundLibraryFileTreesState. soundLibraryFileTreesGlobal NOW has keys:', Object.keys(soundLibraryFileTreesGlobal));

    if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"]) {
        console.log('[State SET] "Drums" tree IS in soundLibraryFileTreesGlobal. Num children:', Object.keys(soundLibraryFileTreesGlobal["Drums"]).length);
        if (Object.keys(soundLibraryFileTreesGlobal["Drums"]).length === 0) {
            console.warn('[State SET] "Drums" tree in global state IS EMPTY!');
        }
    } else {
         console.log('[State SET] "Drums" tree IS NOT in soundLibraryFileTreesGlobal after set.');
    }
}
// MODIFICATION END

export function setCurrentLibraryNameState(name) { currentLibraryNameGlobal = name; }
export function setCurrentSoundFileTreeState(tree) { currentSoundFileTreeGlobal = tree; }
export function setCurrentSoundBrowserPathState(path) { currentSoundBrowserPathGlobal = Array.isArray(path) ? path : []; }
export function setPreviewPlayerState(player) { previewPlayerGlobal = player; }

export function setClipboardDataState(data) { clipboardDataGlobal = typeof data === 'object' && data !== null ? data : { type: null, data: null }; }

export function setArmedTrackIdState(id) { armedTrackId = id; }
export function setPlaybackModeStateInternal(mode) {
    const displayMode = typeof mode === 'string' ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Unknown';
    console.log(`[State setPlaybackModeStateInternal] Attempting to set mode to: ${mode} (Display: ${displayMode}). Current mode: ${globalPlaybackMode}`);

    if (mode === 'sequencer' || mode === 'timeline') {
        if (globalPlaybackMode !== mode) {
            if (appServices.captureStateForUndo) {
                appServices.captureStateForUndo(`Set Playback Mode to ${displayMode}`);
            } else {
                captureStateForUndoInternal(`Set Playback Mode to ${displayMode}`); // Fallback
            }
            globalPlaybackMode = mode;
            console.log(`[State setPlaybackModeStateInternal] Playback mode changed to: ${globalPlaybackMode}`);

            if (Tone.Transport.state === 'started') {
                console.log("[State setPlaybackModeStateInternal] Transport was started, stopping it.");
                Tone.Transport.stop();
            }
            Tone.Transport.cancel(0); // Cancel all scheduled events
            console.log("[State setPlaybackModeStateInternal] Tone.Transport events cancelled.");

            if (appServices.uiElementsCache?.playBtnGlobal) {
                appServices.uiElementsCache.playBtnGlobal.textContent = 'Play';
                console.log("[State setPlaybackModeStateInternal] Play button text reset.");
            } else {
                console.warn("[State setPlaybackModeStateInternal] Play button UI element not found in cache.");
            }
            document.querySelectorAll('.sequencer-step-cell.playing').forEach(cell => cell.classList.remove('playing'));

            const currentTracks = getTracksState();
            console.log(`[State setPlaybackModeStateInternal] Re-initializing sequences/playback for ${currentTracks.length} tracks for new mode: ${globalPlaybackMode}.`);
            try {
                currentTracks.forEach(track => {
                    if (track && track.type !== 'Audio' && typeof track.recreateToneSequence === 'function') {
                        track.recreateToneSequence(true); // true to force restart
                    }
                    // If switching to sequencer mode, stop any timeline-based audio clip playback
                    if (globalPlaybackMode === 'sequencer' && track && track.type === 'Audio' && typeof track.stopPlayback === 'function') {
                        track.stopPlayback();
                    }
                });
            } catch (error) {
                console.error("[State setPlaybackModeStateInternal] Error during track sequence/playback re-initialization:", error);
                if(appServices.showNotification) appServices.showNotification("Error updating track playback for new mode.", 3000);
            }


            if (appServices.onPlaybackModeChange && typeof appServices.onPlaybackModeChange === 'function') {
                appServices.onPlaybackModeChange(globalPlaybackMode);
            }
             if (appServices.renderTimeline && typeof appServices.renderTimeline === 'function') {
                appServices.renderTimeline();
            }
        } else {
            console.log(`[State setPlaybackModeStateInternal] Mode is already ${mode}. No change.`);
        }
    } else {
        console.warn(`[State setPlaybackModeStateInternal] Invalid playback mode attempted: ${mode}. Expected 'sequencer' or 'timeline'.`);
    }
}
export { setPlaybackModeStateInternal as setPlaybackModeState }; // Export with the name expected by other modules

// --- Track Management ---
export async function addTrackToStateInternal(type, initialData = null, isUserAction = true) {
    // _isUserActionPlaceholder is used by UI event handlers to signify a brand new track from user action,
    // vs. a track being added during project load/undo/redo.
    const isBrandNewUserTrack = isUserAction && (!initialData || initialData._isUserActionPlaceholder);
    console.log(`[State addTrackToStateInternal] Adding ${type} track. User Action: ${isUserAction}, Brand New: ${isBrandNewUserTrack}`);

    if (isBrandNewUserTrack) {
        captureStateForUndoInternal(`Add ${type} Track`);
        if (initialData && initialData._isUserActionPlaceholder) initialData = null; // Clear placeholder
    }

    let newTrack;
    try {
        let newTrackId;
        if (initialData && initialData.id != null && Number.isFinite(initialData.id)) {
            newTrackId = initialData.id;
            if (newTrackId >= trackIdCounter) trackIdCounter = newTrackId + 1;
        } else {
            newTrackId = trackIdCounter++;
        }

        const trackAppServices = { // Pass necessary services to the Track instance
            getSoloedTrackId: getSoloedTrackIdState,
            captureStateForUndo: captureStateForUndoInternal,
            updateTrackUI: appServices.updateTrackUI, // These come from main.js
            highlightPlayingStep: appServices.highlightPlayingStep,
            autoSliceSample: appServices.autoSliceSample,
            closeAllTrackWindows: appServices.closeAllTrackWindows,
            getMasterEffectsBusInputNode: appServices.getMasterEffectsBusInputNode,
            showNotification: appServices.showNotification,
            effectsRegistryAccess: appServices.effectsRegistryAccess,
            renderTimeline: appServices.renderTimeline,
            getPlaybackMode: getPlaybackModeState,
            getTrackById: getTrackByIdState, // Track might need to interact with other tracks (e.g. sidechaining in future)
            getTracks: getTracksState
        };

        newTrack = new Track(newTrackId, type, initialData, trackAppServices);
        tracks.push(newTrack);

        if (typeof newTrack.initializeAudioNodes === 'function') {
            await newTrack.initializeAudioNodes();
        }
        // fullyInitializeAudioResources handles loading samples from DB/URL etc.
        await newTrack.fullyInitializeAudioResources();

        if (isBrandNewUserTrack && appServices.showNotification) {
            appServices.showNotification(`${newTrack.name} added successfully.`, 2000);
        }
        if (isBrandNewUserTrack && appServices.openTrackInspectorWindow) {
             // Delay opening inspector slightly to ensure track is fully set up
            setTimeout(() => appServices.openTrackInspectorWindow(newTrack.id), 50);
            
            // Also open sequencer for applicable track types
            if (newTrack.type !== 'Audio' && appServices.openTrackSequencerWindow) {
                setTimeout(() => appServices.openTrackSequencerWindow(newTrack.id, true), 150);
            }
        }

        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.renderTimeline) appServices.renderTimeline();

    } catch (error) {
        console.error(`[State addTrackToStateInternal] Error adding ${type} track:`, error);
        if (appServices.showNotification) {
            appServices.showNotification(`Failed to add ${type} track: ${error.message}`, 4000);
        }
        // If track creation failed, ensure it's not in the tracks array if partially added
        if (newTrack && tracks.includes(newTrack)) {
            tracks = tracks.filter(t => t.id !== newTrack.id);
        }
        return null; // Indicate failure
    }
    return newTrack;
}

export function removeTrackFromStateInternal(trackId) {
    try {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex === -1) {
            console.warn(`[State removeTrackFromStateInternal] Track ID ${trackId} not found for removal.`);
            return;
        }

        const track = tracks[trackIndex];
        captureStateForUndoInternal(`Remove Track "${track.name}"`);

        if (typeof track.dispose === 'function') {
            track.dispose();
        }
        tracks.splice(trackIndex, 1);

        if (armedTrackId === trackId) setArmedTrackIdState(null);
        if (soloedTrackId === trackId) {
            setSoloedTrackIdState(null);
            // Re-evaluate solo states for all other tracks
            tracks.forEach(t => {
                if (t) {
                    t.isSoloed = false; // Explicitly set, then applySoloState will use global state
                    if (typeof t.applySoloState === 'function') t.applySoloState();
                    if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged');
                }
            });
        }
        if (activeSequencerTrackId === trackId) setActiveSequencerTrackIdState(null);

        if (appServices.showNotification) appServices.showNotification(`Track "${track.name}" removed.`, 2000);
        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI();
        if (appServices.renderTimeline) appServices.renderTimeline();

    } catch (error) {
        console.error(`[State removeTrackFromStateInternal] Error removing track ${trackId}:`, error);
        if (appServices.showNotification) appServices.showNotification(`Error removing track: ${error.message}`, 3000);
    }
}

export function reorderTrackInState(trackId, newIndex) {
    const oldIndex = tracks.findIndex(t => t.id === trackId);
    if (oldIndex === -1) {
        console.warn(`[State reorderTrackInState] Track ID ${trackId} not found.`);
        return;
    }
    if (oldIndex === newIndex || newIndex < 0 || newIndex >= tracks.length) {
        return;
    }
    captureStateForUndoInternal(`Reorder Track`);
    const [trackToMove] = tracks.splice(oldIndex, 1);
    tracks.splice(newIndex, 0, trackToMove);
    console.log(`[State reorderTrackInState] Moved track "${trackToMove.name}" from index ${oldIndex} to ${newIndex}`);
    if (appServices.updateMixerWindow) appServices.updateMixerWindow();
    if (appServices.renderTimeline) appServices.renderTimeline();
}


/**
 * Duplicates a track with all its settings, sequences, and effects.
 * @param {number} sourceTrackId - The ID of the track to duplicate
 * @returns {Track|null} The new duplicated track, or null on error
 */
export async function duplicateTrack(sourceTrackId) {
    try {
        const sourceTrack = tracks.find(t => t.id === sourceTrackId);
        if (!sourceTrack) {
            console.warn(`[State duplicateTrack] Source track ID ${sourceTrackId} not found.`);
            if (appServices.showNotification) appServices.showNotification('Track not found for duplication.', 3000);
            return null;
        }

        captureStateForUndoInternal(`Duplicate Track "${sourceTrack.name}"`);

        // Create a deep copy of the track's serializable data
        const trackData = {
            id: ++trackIdCounter,
            name: `${sourceTrack.name} (copy)`,
            type: sourceTrack.type,
            color: sourceTrack.color,
            isMuted: false,
            isMonitoringEnabled: sourceTrack.isMonitoringEnabled,
            previousVolumeBeforeMute: sourceTrack.previousVolumeBeforeMute,
            pan: sourceTrack.pan,
            sendLevels: JSON.parse(JSON.stringify(sourceTrack.sendLevels || {})),
            volume: sourceTrack.previousVolumeBeforeMute || 0.7,
            // Synth specific
            synthEngineType: sourceTrack.synthEngineType,
            synthParams: sourceTrack.synthParams ? JSON.parse(JSON.stringify(sourceTrack.synthParams)) : {},
            // Sequences
            sequences: sourceTrack.sequences ? JSON.parse(JSON.stringify(sourceTrack.sequences)) : [],
            activeSequenceId: sourceTrack.activeSequenceId,
            stepsPerBeat: sourceTrack.stepsPerBeat,
            // Effects
            activeEffects: sourceTrack.activeEffects ? sourceTrack.activeEffects.map(e => ({
                id: `effect-${trackIdCounter}-${e.type}-${Date.now()}`,
                type: e.type,
                params: JSON.parse(JSON.stringify(e.params || {}))
            })) : [],
            // Sampler specific
            samplerAudioData: sourceTrack.samplerAudioData ? JSON.parse(JSON.stringify(sourceTrack.samplerAudioData)) : null,
            slices: sourceTrack.slices ? JSON.parse(JSON.stringify(sourceTrack.slices)) : [],
            // Instrument Sampler
            instrumentSamplerSettings: sourceTrack.instrumentSamplerSettings ? JSON.parse(JSON.stringify(sourceTrack.instrumentSamplerSettings)) : null,
            // Drum Sampler
            drumSamplerPads: sourceTrack.drumSamplerPads ? JSON.parse(JSON.stringify(sourceTrack.drumSamplerPads)) : [],
            // Timeline clips
            timelineClips: sourceTrack.timelineClips ? JSON.parse(JSON.stringify(sourceTrack.timelineClips)) : []
        };

        // Create the new track
        const newTrack = new Track(trackData.id, trackData.type, trackData, appServices);
        tracks.push(newTrack);

        // Initialize audio nodes for the new track
        if (typeof newTrack.initializeAudioNodes === 'function') {
            await newTrack.initializeAudioNodes();
        }

        // Update UI
        if (appServices.showNotification) {
            appServices.showNotification(`Duplicated "${sourceTrack.name}" as "${trackData.name}"`, 2000);
        }
        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI();
        if (appServices.renderTimeline) appServices.renderTimeline();

        console.log(`[State duplicateTrack] Duplicated track ${sourceTrackId} to new track ${trackData.id}`);
        return newTrack;

    } catch (error) {
        console.error(`[State duplicateTrack] Error duplicating track ${sourceTrackId}:`, error);
        if (appServices.showNotification) appServices.showNotification(`Error duplicating track: ${error.message}`, 3000);
        return null;
    }
}

// --- Master Effects Chain Management ---
export function addMasterEffectToState(effectType, initialParams) {
    const effectId = `mastereffect_${effectType}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const defaultParams = appServices.effectsRegistryAccess?.getEffectDefaultParams
        ? appServices.effectsRegistryAccess.getEffectDefaultParams(effectType)
        : getEffectDefaultParamsFromRegistry(effectType); // Fallback

    masterEffectsChainState.push({
        id: effectId,
        type: effectType,
        params: initialParams || defaultParams
    });
    return effectId;
}

export function removeMasterEffectFromState(effectId) {
    const effectIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (effectIndex > -1) {
        masterEffectsChainState.splice(effectIndex, 1);
    }
}

export function updateMasterEffectParamInState(effectId, paramPath, value) {
    const effectWrapper = masterEffectsChainState.find(e => e.id === effectId);
    if (!effectWrapper || !effectWrapper.params) {
        console.warn(`[State updateMasterEffectParamInState] Effect wrapper or params not found for ID: ${effectId}`);
        return;
    }
    try {
        const keys = paramPath.split('.');
        let currentStoredParamLevel = effectWrapper.params;
        for (let i = 0; i < keys.length - 1; i++) {
            currentStoredParamLevel[keys[i]] = currentStoredParamLevel[keys[i]] || {};
            currentStoredParamLevel = currentStoredParamLevel[keys[i]];
        }
        currentStoredParamLevel[keys[keys.length - 1]] = value;
    } catch (error) {
        console.error(`[State updateMasterEffectParamInState] Error updating param ${paramPath} for effect ${effectId}:`, error);
    }
}

export function reorderMasterEffectInState(effectId, newIndex) {
    const oldIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (oldIndex === -1 || oldIndex === newIndex || newIndex < 0 || newIndex >= masterEffectsChainState.length) {
        if (oldIndex === -1) console.warn(`[State reorderMasterEffectInState] Effect ID ${effectId} not found.`);
        return;
    }
    const [effectToMove] = masterEffectsChainState.splice(oldIndex, 1);
    masterEffectsChainState.splice(newIndex, 0, effectToMove);
}

export function toggleMasterEffectBypass(effectId) {
    const effectWrapper = masterEffectsChainState.find(e => e.id === effectId);
    if (!effectWrapper) {
        console.warn(`[State toggleMasterEffectBypass] Effect ID ${effectId} not found.`);
        return;
    }

    // Check if currently bypassed (wet === 0 or bypassed flag is true)
    const isBypassed = effectWrapper.bypassed === true || (effectWrapper.params?.wet !== undefined && effectWrapper.params.wet === 0);

    if (isBypassed) {
        // Restore wet to previous value (or 1 if not stored)
        const restoreValue = effectWrapper.previousWetValue !== undefined ? effectWrapper.previousWetValue : 1;
        effectWrapper.bypassed = false;
        if (effectWrapper.params) effectWrapper.params.wet = restoreValue;
        delete effectWrapper.previousWetValue;

        // Apply to Tone.js node via audio.js
        if (appServices.setMasterEffectWet) {
            appServices.setMasterEffectWet(effectId, restoreValue);
        }

        console.log(`[State toggleMasterEffectBypass] Master effect "${effectWrapper.type}" (${effectId}) enabled. Wet: ${restoreValue}`);
        if (appServices.showNotification) {
            appServices.showNotification(`Master effect "${effectWrapper.type}" enabled`, 1500);
        }
    } else {
        // Store current wet value and bypass
        const currentWet = effectWrapper.params?.wet ?? 1;
        effectWrapper.previousWetValue = currentWet;
        effectWrapper.bypassed = true;
        if (effectWrapper.params) effectWrapper.params.wet = 0;

        // Apply to Tone.js node via audio.js
        if (appServices.setMasterEffectWet) {
            appServices.setMasterEffectWet(effectId, 0);
        }

        console.log(`[State toggleMasterEffectBypass] Master effect "${effectWrapper.type}" (${effectId}) bypassed.`);
        if (appServices.showNotification) {
            appServices.showNotification(`Master effect "${effectWrapper.type}" bypassed`, 1500);
        }
    }

    // Update UI
    if (appServices.updateMasterEffectsRackUI) {
        appServices.updateMasterEffectsRackUI();
    }
}

// --- Undo/Redo Logic ---
function updateInternalUndoRedoState() {
    if (appServices.updateUndoRedoButtonsUI && typeof appServices.updateUndoRedoButtonsUI === 'function') {
        try {
            appServices.updateUndoRedoButtonsUI(
                undoStack.length > 0 ? undoStack[undoStack.length - 1] : null,
                redoStack.length > 0 ? redoStack[redoStack.length - 1] : null
            );
        } catch (error) {
            console.error("[State updateInternalUndoRedoState] Error calling appServices.updateUndoRedoButtonsUI:", error);
        }
    }
    // Also update the undo history panel if it's open
    if (appServices.updateUndoHistoryPanel && typeof appServices.updateUndoHistoryPanel === 'function') {
        try {
            appServices.updateUndoHistoryPanel();
        } catch (error) {
            console.error("[State updateInternalUndoRedoState] Error calling appServices.updateUndoHistoryPanel:", error);
        }
    }
}

export function captureStateForUndoInternal(description = "Unknown action") {
    try {
        const currentState = gatherProjectDataInternal();
        if (!currentState) {
            console.error("[State captureStateForUndoInternal] Failed to gather project data. Aborting undo capture.");
            return;
        }
        currentState.description = description; // Add description to the state object
        undoStack.push(JSON.parse(JSON.stringify(currentState))); // Deep copy
        if (undoStack.length > Constants.MAX_HISTORY_STATES) {
            undoStack.shift();
        }
        redoStack = []; // Clear redo stack on new action
        updateInternalUndoRedoState();
    } catch (error) {
        console.error("[State captureStateForUndoInternal] Error capturing state for undo:", error);
        if (appServices.showNotification) appServices.showNotification("Error capturing undo state. See console.", 3000);
    }
}

export async function undoLastActionInternal() {
    if (undoStack.length === 0) {
        if (appServices.showNotification) appServices.showNotification("Nothing to undo.", 1500);
        return;
    }
    try {
        const stateToRestore = undoStack.pop();
        const currentStateForRedo = gatherProjectDataInternal();
        if (!currentStateForRedo) {
            console.error("[State undoLastActionInternal] Failed to gather current project data for redo stack. Undoing without pushing to redo.");
        } else {
            currentStateForRedo.description = stateToRestore.description; // Use the undone action's description for redo
            redoStack.push(JSON.parse(JSON.stringify(currentStateForRedo)));
            if (redoStack.length > Constants.MAX_HISTORY_STATES) redoStack.shift();
        }

        if (appServices.showNotification) appServices.showNotification(`Undoing: ${stateToRestore.description || 'last action'}...`, 2000);
        if (appServices) appServices._isReconstructingDAW_flag = true; // Signal reconstruction globally
        await reconstructDAWInternal(stateToRestore, true); // true for isUndoRedo
    } catch (error) {
        console.error("[State undoLastActionInternal] Error during undo:", error);
        if (appServices.showNotification) appServices.showNotification(`Error during undo operation: ${error.message}. Project may be unstable.`, 4000);
        // Potentially try to restore the popped state back to undoStack if reconstruction fails badly? Complex.
    } finally {
        if (appServices) appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    }
}

export async function redoLastActionInternal() {
    if (redoStack.length === 0) {
        if (appServices.showNotification) appServices.showNotification("Nothing to redo.", 1500);
        return;
    }
    try {
        const stateToRestore = redoStack.pop();
        const currentStateForUndo = gatherProjectDataInternal();
        if (!currentStateForUndo) {
            console.error("[State redoLastActionInternal] Failed to gather current project data for undo stack. Redoing without pushing to undo.");
        } else {
            currentStateForUndo.description = stateToRestore.description;
            undoStack.push(JSON.parse(JSON.stringify(currentStateForUndo)));
            if (undoStack.length > Constants.MAX_HISTORY_STATES) undoStack.shift();
        }

        if (appServices.showNotification) appServices.showNotification(`Redoing: ${stateToRestore.description || 'last action'}...`, 2000);
        if (appServices) appServices._isReconstructingDAW_flag = true;
        await reconstructDAWInternal(stateToRestore, true); // true for isUndoRedo
    } catch (error) {
        console.error("[State redoLastActionInternal] Error during redo:", error);
        if (appServices.showNotification) appServices.showNotification(`Error during redo operation: ${error.message}. Project may be unstable.`, 4000);
    } finally {
        if (appServices) appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    }
}

// --- Project Data Handling ---
export function gatherProjectDataInternal() {
    console.log("[State gatherProjectDataInternal] Starting to gather project data...");
    try {
        const projectData = {
            version: Constants.APP_VERSION || "5.9.1", // Use a constant for app version
            globalSettings: {
                tempo: Tone.Transport.bpm.value,
                masterVolume: getMasterGainValueState(),
                activeMIDIInputId: getActiveMIDIInputState() ? getActiveMIDIInputState().id : null,
                soloedTrackId: getSoloedTrackIdState(),
                armedTrackId: getArmedTrackIdState(),
                highestZIndex: getHighestZState(),
                playbackMode: getPlaybackModeState(),
            },
            masterEffects: getMasterEffectsState().map(effect => ({
                id: effect.id,
                type: effect.type,
                params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {} // Ensure params exist
            })),
            tracks: getTracksState().map(track => {
                if (!track || typeof track.id === 'undefined') {
                    console.warn("[State gatherProjectDataInternal] Invalid track object found, skipping:", track);
                    return null; // Skip invalid tracks
                }
                const trackData = { // Base data
                    id: track.id, type: track.type, name: track.name,
                    trackNotes: track.trackNotes || '',
                    isMuted: track.isMuted,
                    volume: track.previousVolumeBeforeMute, // Store the actual volume, not the muted one
                    activeEffects: (track.activeEffects || []).map(effect => ({
                        id: effect.id, type: effect.type,
                        params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {}
                    })),
                    automation: track.automation ? JSON.parse(JSON.stringify(track.automation)) : { volume: [] },
                    // Type-specific sequence/clip data
                    sequences: track.type !== 'Audio' && track.sequences ? JSON.parse(JSON.stringify(track.sequences)) : [],
                    activeSequenceId: track.type !== 'Audio' ? track.activeSequenceId : null,
                    timelineClips: track.timelineClips ? JSON.parse(JSON.stringify(track.timelineClips)) : [],
                    timelinePlaybackRate: track.timelinePlaybackRate !== undefined ? track.timelinePlaybackRate : 1.0,
                };
                // Type-specific parameters
                if (track.type === 'Synth') {
                    trackData.synthEngineType = track.synthEngineType || 'MonoSynth';
                    trackData.synthParams = track.synthParams ? JSON.parse(JSON.stringify(track.synthParams)) : {};
                } else if (track.type === 'Sampler') {
                    trackData.samplerAudioData = {
                        fileName: track.samplerAudioData?.fileName,
                        dbKey: track.samplerAudioData?.dbKey,
                        // status is runtime, not strictly needed for save, but useful for rehydration hint
                        status: track.samplerAudioData?.dbKey ? 'persisted' : (track.samplerAudioData?.fileName ? 'volatile' : 'empty')
                    };
                    trackData.slices = track.slices ? JSON.parse(JSON.stringify(track.slices)) : [];
                    trackData.selectedSliceForEdit = track.selectedSliceForEdit;
                    trackData.slicerIsPolyphonic = track.slicerIsPolyphonic;
                } else if (track.type === 'DrumSampler') {
                    trackData.drumSamplerPads = (track.drumSamplerPads || []).map(p => ({
                        originalFileName: p.originalFileName, dbKey: p.dbKey,
                        volume: p.volume, pitchShift: p.pitchShift,
                        envelope: p.envelope ? JSON.parse(JSON.stringify(p.envelope)) : {},
                        status: p.dbKey ? 'persisted' : (p.originalFileName ? 'volatile' : 'empty')
                    }));
                    trackData.selectedDrumPadForEdit = track.selectedDrumPadForEdit;
                } else if (track.type === 'InstrumentSampler') {
                    trackData.instrumentSamplerSettings = {
                        originalFileName: track.instrumentSamplerSettings?.originalFileName,
                        dbKey: track.instrumentSamplerSettings?.dbKey,
                        rootNote: track.instrumentSamplerSettings?.rootNote,
                        loop: track.instrumentSamplerSettings?.loop,
                        loopStart: track.instrumentSamplerSettings?.loopStart,
                        loopEnd: track.instrumentSamplerSettings?.loopEnd,
                        envelope: track.instrumentSamplerSettings?.envelope ? JSON.parse(JSON.stringify(track.instrumentSamplerSettings.envelope)) : {},
                        status: track.instrumentSamplerSettings?.dbKey ? 'persisted' : (track.instrumentSamplerSettings?.originalFileName ? 'volatile' : 'empty')
                    };
                    trackData.instrumentSamplerIsPolyphonic = track.instrumentSamplerIsPolyphonic;
                }
                 if (track.type === 'Audio') { // Audio track specific settings
                    trackData.isMonitoringEnabled = track.isMonitoringEnabled;
                }
                // Remove deprecated/runtime-only properties if they accidentally get included
                delete trackData.sequenceData; delete trackData.sequenceLength;
                return trackData;
            }).filter(td => td !== null), // Filter out any skipped invalid tracks
            windowStates: Array.from(getOpenWindowsState().values())
                .map(win => {
                    if (!win || !win.element) return null;
                    return {
                        id: win.id, title: win.title,
                        left: win.element.style.left, top: win.element.style.top,
                        width: win.element.style.width, height: win.element.style.height,
                        zIndex: parseInt(win.element.style.zIndex, 10) || 100,
                        isMinimized: win.isMinimized,
                        isMaximized: win.isMaximized, // Save maximized state
                        restoreState: win.isMaximized ? JSON.parse(JSON.stringify(win.restoreState)) : {},
                        initialContentKey: win.initialContentKey || win.id // Ensure this is saved
                    };
                }).filter(ws => ws !== null)
        };
        console.log("[State gatherProjectDataInternal] Project data gathered successfully.");
        return projectData;
    } catch (error) {
        console.error("[State gatherProjectDataInternal] Error gathering project data:", error);
        if (appServices.showNotification) appServices.showNotification("Error preparing project data for saving/undo.", 4000);
        return null;
    }
}

export async function reconstructDAWInternal(projectData, isUndoRedo = false) {
    if (!projectData) {
        console.error("[State reconstructDAWInternal] projectData is null or undefined. Aborting reconstruction.");
        if (appServices.showNotification) appServices.showNotification("Error: No project data to load.", 3000);
        if (appServices) appServices._isReconstructingDAW_flag = false;
        return;
    }
    
    console.log(`[State reconstructDAWInternal] Starting reconstruction. isUndoRedo: ${isUndoRedo}`);
    if (appServices) appServices._isReconstructingDAW_flag = true;

    // --- Global Reset Phase ---
    try {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        if (appServices && typeof appServices.initAudioContextAndMasterMeter !== 'function') await appServices.initAudioContextAndMasterMeter(true); // Ensure audio context is running, true for user initiated context
        (getTracksState() || []).forEach(track => { if (track && typeof track.dispose === 'function') track.dispose(); });
        tracks = [];
        trackIdCounter = 0;
        if (appServices && typeof appServices.clearAllMasterEffectNodes !== 'function') appServices.clearAllMasterEffectNodes(); else console.warn("clearAllMasterEffectNodes service missing");
        masterEffectsChainState = [];
        if (appServices && typeof appServices.closeAllWindows !== 'function') appServices.closeAllWindows(true); else console.warn("closeAllWindows service missing");
        if (appServices && typeof appServices.clearOpenWindowsMap !== 'function') appServices.clearOpenWindowsMap(); else console.warn("clearOpenWindowsMap service missing");
        highestZ = 100;
        setArmedTrackIdState(null); setSoloedTrackIdState(null); setActiveSequencerTrackIdState(null);
        setIsRecordingState(false); setRecordingTrackIdState(null);
        if (appServices && typeof appServices.updateRecordButtonUI !== 'function') appServices.updateRecordButtonUI(false);
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error during global reset phase:", error);
        if (appServices.showNotification) appServices.showNotification("Critical error during project reset.", 5000);
        if (appServices) appServices._isReconstructingDAW_flag = false;
        return; // Abort further reconstruction
    }

    try { // --- Global Settings ---
        const gs = projectData.globalSettings || {};
        Tone.Transport.bpm.value = Number.isFinite(gs.tempo) ? gs.tempo : 120;
        setMasterGainValueState(Number.isFinite(gs.masterVolume) ? gs.masterVolume : (typeof Tone !== 'undefined' && Tone.dbToGain) ? Tone.dbToGain(0) : 1.0);
        if (appServices && typeof appServices.setActualMasterVolume !== 'function') appServices.setActualMasterVolume(getMasterGainValueState());
        setPlaybackModeStateInternal(gs.playbackMode === 'timeline' || gs.playbackMode === 'sequencer' ? gs.playbackMode : 'sequencer');
        if (appServices && typeof appServices.updateTaskbarTempoDisplay !== 'function') appServices.updateTaskbarTempoDisplay(Tone.Transport.bpm.value);
        setHighestZState(Number.isFinite(gs.highestZIndex) ? gs.highestZIndex : 100);
        // Armed and Soloed will be set after tracks are created
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error applying global settings:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading global settings.", 3000);
    }

    try { // --- Master Effects ---
        if (projectData.masterEffects && Array.isArray(projectData.masterEffects)) {
            for (const effectData of projectData.masterEffects) {
                if (effectData && effectData.type) {
                    const effectIdInState = addMasterEffectToState(effectData.type, effectData.params || {});
                    if (appServices.addMasterEffectToAudio) {
                         await appServices.addMasterEffectToAudio(effectIdInState, effectData.type, effectData.params || {});
                    }
                } else { console.warn("[State reconstructDAWInternal] Invalid master effect data found:", effectData); }
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructuring master effects:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading master effects.", 3000);
    }

    try { // --- Tracks ---
        if (projectData.tracks && Array.isArray(projectData.tracks)) {
            const trackPromises = projectData.tracks.map(trackData => {
                if (trackData && trackData.type) {
                    return addTrackToStateInternal(trackData.type, trackData, false); // false for isUserAction
                } else { console.warn("[State reconstructDAWInternal] Invalid track data found:", trackData); return Promise.resolve(null); }
            });
            await Promise.all(trackPromises);
            // After all tracks and their audio resources are initialized:
            console.log(`[State reconstructDAWInternal] All track instances created. Now setting armed/soloed states.`);
            const globalSettings = projectData.globalSettings || {};
            if (globalSettings.armedTrackId !== null && typeof globalSettings.armedTrackId !== 'undefined') {
                setArmedTrackIdState(globalSettings.armedTrackId);
            }
            if (globalSettings.soloedTrackId !== null && typeof globalSettings.soloedTrackId !== 'undefined') {
                setSoloedTrackIdState(globalSettings.soloedTrackId);
                getTracksState().forEach(t => { // Apply solo state after all tracks are potentially available
                    if (t) {
                        t.isSoloed = (t.id === getSoloedTrackIdState());
                        if (typeof t.applySoloState === 'function') t.applySoloState();
                        if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged');
                    }
                });
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructuring tracks:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading tracks.", 3000);
    }

    // Window reconstruction needs to happen after tracks are potentially created, as some windows depend on track IDs.
    try {
        if (projectData.windowStates && Array.isArray(projectData.windowStates)) {
            const sortedWindowStates = projectData.windowStates.sort((a, b) => (a?.zIndex || 0) - (b?.zIndex || 0));
            for (const winState of sortedWindowStates) {
                if (!winState || !winState.id) { console.warn("[State reconstructDAWInternal] Invalid window state found:", winState); continue; }
                const key = winState.initialContentKey || winState.id; // Use initialContentKey for routing
                console.log(`[State reconstructDAWInternal] Reconstructing window: ${key}, ID: ${winState.id}`);
                if (key === 'globalControls' && appServices.openGlobalControlsWindow) {
                    // FIX: Pass a callback to wire up controls even during reconstruction
                    // The callback will be called by openGlobalControlsWindow to attach event listeners
                    appServices.openGlobalControlsWindow((elements) => {
                        if (elements && appServices.attachGlobalControlEvents) {
                            console.log("[State reconstructDAWInternal] Wiring up global controls after reconstruction");
                            appServices.attachGlobalControlEvents(elements);
                        }
                    }, winState);
                }
                else if (key === 'soundBrowser' && appServices.openSoundBrowserWindow) appServices.openSoundBrowserWindow(winState);
                else if (key === 'mixer' && appServices.openMixerWindow) appServices.openMixerWindow(winState);
                else if (key === 'masterEffectsRack' && appServices.openMasterEffectsRackWindow) appServices.openMasterEffectsRackWindow(winState);
                else if (key === 'timeline' && appServices.openTimelineWindow) appServices.openTimelineWindow(winState);
                else if (key.startsWith('trackInspector-') && appServices.openTrackInspectorWindow) {
                    const trackIdNum = parseInt(key.split('-')[1], 10);
                    if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackInspectorWindow(trackIdNum, winState);
                    else console.warn(`[State reconstructDAWInternal] Track for inspector ${key} not found or ID invalid.`);
                } else if (key.startsWith('effectsRack-') && appServices.openTrackEffectsRackWindow) {
                    const trackIdNum = parseInt(key.split('-')[1], 10);
                    if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackEffectsRackWindow(trackIdNum, winState);
                    else console.warn(`[State reconstructDAWInternal] Track for effects rack ${key} not found or ID invalid.`);
                } else if (key.startsWith('sequencerWin-') && appServices.openTrackSequencerWindow) {
                    const trackIdNum = parseInt(key.split('-')[2], 10);
                    const trackForSeq = getTrackByIdState(trackIdNum);
                    if (!isNaN(trackIdNum) && trackForSeq && trackForSeq.type !== 'Audio') {
                        appServices.openTrackSequencerWindow(trackIdNum, true, winState); // true for forceRedraw
                    } else { console.warn(`[State reconstructDAWInternal] Track for sequencer ${key} not found, ID invalid, or is Audio type.`);}
                } else {
                    console.warn(`[State reconstructDAWInternal] Unknown window key "${key}" during reconstruction.`);
                }
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructuring windows:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading window layout.", 3000);
    }

    // Final UI updates and MIDI setup
    try {
        const gs = projectData.globalSettings || {};
        if(gs && gs.activeMIDIInputId && appServices.selectMIDIInput) {
            appServices.selectMIDIInput(gs.activeMIDIInputId, true); // true for silent
        }
        if(appServices.updateMixerWindow) appServices.updateMixerWindow();
        if(appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        if(appServices.renderTimeline) appServices.renderTimeline();
        updateInternalUndoRedoState();
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error during final UI updates/MIDI setup:", error);
    }

    if (appServices) appServices._isReconstructingDAW_flag = false;
    if (!isUndoRedo && appServices.showNotification) appServices.showNotification(`Project loaded successfully.`, 3500);
    console.log("[State reconstructDAWInternal] Reconstruction finished.");
}


export function saveProjectInternal() {
    try {
        const projectData = gatherProjectDataInternal();
        if (!projectData) throw new Error("Failed to gather project data for saving.");

        const jsonString = JSON.stringify(projectData, null, 2); // Beautify JSON
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `snugos-project-${timestamp}.snug`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (appServices.showNotification) appServices.showNotification(`Project saved as ${a.download}`, 2000);
    } catch (error) {
        console.error("[State saveProjectInternal] Error saving project:", error);
        if (appServices.showNotification) appServices.showNotification(`Error saving project: ${error.message}. See console.`, 4000);
    }
}

export function loadProjectInternal() {
    const loadProjectInputEl = appServices.uiElementsCache?.loadProjectInput;
    if (loadProjectInputEl) {
        loadProjectInputEl.click();
    } else {
        console.error("[State loadProjectInternal] Load project input element not found.");
        if (appServices.showNotification) appServices.showNotification("Error: File input for loading project not found.", 3000);
    }
}

export async function handleProjectFileLoadInternal(event) {
    if (!event || !event.target || !event.target.files || event.target.files.length === 0) {
        console.warn("[State handleProjectFileLoadInternal] No file selected or event invalid.");
        if (event && event.target) event.target.value = null; // Reset file input
        return;
    }
    const file = event.target.files[0];
    if (file && file.name.endsWith('.snug')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!e.target || !e.target.result) throw new Error("FileReader did not produce a result.");
                const projectData = JSON.parse(e.target.result);
                undoStack = []; // Clear undo/redo stacks for new project
                redoStack = [];
                await reconstructDAWInternal(projectData, false); // false for isUndoRedo
                captureStateForUndoInternal("Load Project: " + file.name.substring(0, 20)); // Initial state for undo
            } catch (error) {
                console.error("[State handleProjectFileLoadInternal] Error loading project from file:", error);
                if (appServices.showNotification) appServices.showNotification(`Error loading project: ${error.message}. File might be corrupt or invalid.`, 5000);
            }
        };
        reader.onerror = (err) => {
            console.error("[State handleProjectFileLoadInternal] FileReader error:", err);
            if (appServices.showNotification) appServices.showNotification("Error reading project file.", 3000);
        };
        reader.readAsText(file);
    } else if (file) {
        if (appServices.showNotification) appServices.showNotification("Invalid file type. Please select a .snug project file.", 3000);
    }
    if (event.target) event.target.value = null; // Reset file input
}

export async function exportToWavInternal() {
    if (!appServices.showNotification || !appServices.getActualMasterGainNode || !audioInitAudioContextAndMasterMeter) {
        console.error("[State exportToWavInternal] Required appServices not available.");
        alert("Export WAV feature is currently unavailable due to an internal error.");
        return;
    }

    appServices.showNotification("Preparing export...", 2000);
    
    try {
        const audioReady = await audioInitAudioContextAndMasterMeter(true);
        if (!audioReady) {
            appServices.showNotification("Audio system not ready for export.", 3000);
            return;
        }

        // Calculate duration
        let maxDuration = 0;
        const currentPlaybackMode = getPlaybackModeState();
        const tracks = getTracksState();

        if (currentPlaybackMode === 'timeline') {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio' && track.timelineClips) {
                    track.timelineClips.forEach(clip => {
                        if (clip?.startTime !== undefined && clip?.duration !== undefined) {
                            maxDuration = Math.max(maxDuration, clip.startTime + clip.duration);
                        }
                    });
                }
            });
        } else {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio') {
                    const activeSeq = track.getActiveSequence();
                    if (activeSeq?.length > 0) {
                        const sixteenthNoteTime = Tone.Time("16n").toSeconds();
                        maxDuration = Math.max(maxDuration, activeSeq.length * sixteenthNoteTime);
                    }
                }
            });
        }

        if (maxDuration === 0) {
            appServices.showNotification("Nothing to export. Add some notes or audio first.", 3000);
            return;
        }
        
        maxDuration = Math.min(maxDuration + 2, 600);
        console.log(`[State exportToWavInternal] Export duration: ${maxDuration.toFixed(1)}s`);

        // Stop everything first
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });
        await new Promise(r => setTimeout(r, 100));

        appServices.showNotification(`Rendering audio (${maxDuration.toFixed(1)}s)...`, 15000);

        // Use Tone.Recorder to record from master output
        const recorder = new Tone.Recorder();
        const masterGain = appServices.getActualMasterGainNode();
        
        if (!masterGain || masterGain.disposed) {
            appServices.showNotification("Master output not available.", 3000);
            return;
        }
        
        // Connect master gain to recorder
        masterGain.connect(recorder);
        console.log("[Export] Recorder connected to master gain");

        // Reset transport
        Tone.Transport.position = 0;
        Tone.Transport.loop = false;
        
        // Schedule all tracks
        for (const track of tracks) {
            if (track?.schedulePlayback) {
                await track.schedulePlayback(0, maxDuration);
            }
        }

        // Start recording and playback
        await recorder.start();
        console.log("[Export] Recording started");
        
        Tone.Transport.start();
        console.log("[Export] Transport started");

        // Wait for recording
        await new Promise(resolve => setTimeout(resolve, maxDuration * 1000 + 500));

        // Stop recording
        const recording = await recorder.stop();
        console.log("[Export] Recording stopped, size:", recording.size);

        // Stop transport
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });

        // Cleanup
        try { masterGain.disconnect(recorder); } catch (e) {}
        recorder.dispose();

        if (!recording || recording.size < 1000) {
            appServices.showNotification("Export failed: No audio recorded.", 3000);
            console.error("[Export] Recording too small:", recording?.size);
            return;
        }

        // Download
        const url = URL.createObjectURL(recording);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snugos-export-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        appServices.showNotification("Export to WAV successful!", 3000);
        console.log("[Export] Complete, size:", recording.size);

    } catch (error) {
        console.error("[State exportToWavInternal] Error:", error);
        appServices.showNotification(`Export error: ${error.message}`, 5000);
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
    }
}

// ============================================
// EXPORT WITH SETTINGS (Preset-based export)
// ============================================

/**
 * Exports the project using preset settings.
 * @param {Object} settings - Export settings from preset
 * @param {string} settings.format - Audio format (wav, mp3)
 * @param {number} settings.sampleRate - Sample rate (44100, 48000, 96000)
 * @param {number} settings.bitDepth - Bit depth (16, 24, 32)
 * @param {boolean} settings.normalize - Whether to normalize output
 * @param {boolean} settings.dither - Whether to apply dithering
 * @param {number} settings.tailSeconds - Seconds of tail to add after last note
 */
export async function exportWithSettingsInternal(settings = {}) {
    const defaults = {
        format: 'wav',
        sampleRate: 44100,
        bitDepth: 24,
        normalize: false,
        dither: false,
        tailSeconds: 2
    };
    
    const config = { ...defaults, ...settings };
    
    if (!appServices.showNotification || !appServices.getActualMasterGainNode || !audioInitAudioContextAndMasterMeter) {
        console.error("[State exportWithSettingsInternal] Required appServices not available.");
        alert("Export feature is currently unavailable due to an internal error.");
        return;
    }

    // Validate format and check dependencies
    if (config.format === 'mp3' && typeof lamejs === 'undefined') {
        appServices.showNotification("MP3 encoding requires lamejs library. Exporting as WAV.", 3000);
        config.format = 'wav';
    }

    appServices.showNotification("Preparing export...", 2000);
    
    try {
        const audioReady = await audioInitAudioContextAndMasterMeter(true);
        if (!audioReady) {
            appServices.showNotification("Audio system not ready for export.", 3000);
            return;
        }

        // Calculate duration
        let maxDuration = 0;
        const currentPlaybackMode = getPlaybackModeState();
        const tracks = getTracksState();

        if (currentPlaybackMode === 'timeline') {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio' && track.timelineClips) {
                    track.timelineClips.forEach(clip => {
                        if (clip?.startTime !== undefined && clip?.duration !== undefined) {
                            maxDuration = Math.max(maxDuration, clip.startTime + clip.duration);
                        }
                    });
                }
            });
        } else {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio') {
                    const activeSeq = track.getActiveSequence();
                    if (activeSeq?.length > 0) {
                        const sixteenthNoteTime = Tone.Time("16n").toSeconds();
                        maxDuration = Math.max(maxDuration, activeSeq.length * sixteenthNoteTime);
                    }
                }
            });
        }

        if (maxDuration === 0) {
            appServices.showNotification("Nothing to export. Add some notes or audio first.", 3000);
            return;
        }
        
        // Add configurable tail
        maxDuration = Math.min(maxDuration + config.tailSeconds, 600);
        console.log(`[State exportWithSettingsInternal] Export duration: ${maxDuration.toFixed(1)}s, Sample Rate: ${config.sampleRate}, Bit Depth: ${config.bitDepth}`);

        // Stop everything first
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });
        await new Promise(r => setTimeout(r, 100));

        appServices.showNotification(`Rendering audio (${maxDuration.toFixed(1)}s)...`, 15000);

        // Use Tone.Recorder to record from master output
        const recorder = new Tone.Recorder();
        const masterGain = appServices.getActualMasterGainNode();
        
        if (!masterGain || masterGain.disposed) {
            appServices.showNotification("Master output not available.", 3000);
            return;
        }
        
        // Connect master gain to recorder
        masterGain.connect(recorder);
        console.log("[Export] Recorder connected to master gain");

        // Reset transport
        Tone.Transport.position = 0;
        Tone.Transport.loop = false;
        
        // Schedule all tracks
        for (const track of tracks) {
            if (track?.schedulePlayback) {
                await track.schedulePlayback(0, maxDuration);
            }
        }

        // Start recording and playback
        await recorder.start();
        console.log("[Export] Recording started");
        
        Tone.Transport.start();
        console.log("[Export] Transport started");

        // Wait for recording
        await new Promise(resolve => setTimeout(resolve, maxDuration * 1000 + 500));

        // Stop recording
        const recording = await recorder.stop();
        console.log("[Export] Recording stopped, size:", recording.size);

        // Stop transport
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });

        // Cleanup
        try { masterGain.disconnect(recorder); } catch (e) {}
        recorder.dispose();

        if (!recording || recording.size < 1000) {
            appServices.showNotification("Export failed: No audio recorded.", 3000);
            console.error("[Export] Recording too small:", recording?.size);
            return;
        }

        // Convert to MP3 or FLAC if needed
        let finalBlob = recording;
        let fileExtension = 'wav';
        let formatInfo = `${config.sampleRate}Hz, ${config.bitDepth}-bit`;
        
        if (config.format === 'mp3') {
            appServices.showNotification("Encoding MP3...", 5000);
            try {
                // Decode WAV to AudioBuffer
                const arrayBuffer = await recording.arrayBuffer();
                const audioContext = Tone.context.rawContext;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // Encode to MP3 using lamejs
                const numChannels = audioBuffer.numberOfChannels;
                const sampleRate = audioBuffer.sampleRate;
                const bitrate = config.mp3Bitrate || 192;
                const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
                const mp3Data = [];
                const sampleBlockSize = 1152;
                
                const leftChannel = audioBuffer.getChannelData(0);
                const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
                
                for (let i = 0; i < audioBuffer.length; i += sampleBlockSize) {
                    const leftChunk = new Int16Array(sampleBlockSize);
                    const rightChunk = new Int16Array(sampleBlockSize);
                    
                    for (let j = 0; j < sampleBlockSize && i + j < audioBuffer.length; j++) {
                        const leftSample = Math.max(-1, Math.min(1, leftChannel[i + j]));
                        leftChunk[j] = leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7FFF;
                        
                        const rightSample = Math.max(-1, Math.min(1, rightChannel[i + j]));
                        rightChunk[j] = rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7FFF;
                    }
                    
                    const mp3buf = numChannels === 2 
                        ? mp3encoder.encodeBuffer(leftChunk, rightChunk)
                        : mp3encoder.encodeBuffer(leftChunk);
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                }
                
                const mp3buf = mp3encoder.flush();
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
                
                finalBlob = new Blob(mp3Data, { type: 'audio/mpeg' });
                fileExtension = 'mp3';
                formatInfo = `${config.sampleRate}Hz, ${bitrate}kbps`;
                console.log("[Export] MP3 encoded, size:", finalBlob.size);
            } catch (mp3Error) {
                console.error("[Export] MP3 encoding failed:", mp3Error);
                appServices.showNotification("MP3 encoding failed, exporting as WAV.", 3000);
                fileExtension = 'wav';
            }
        } else if (config.format === 'flac') {
            appServices.showNotification("Encoding FLAC...", 5000);
            try {
                // Decode WAV to AudioBuffer
                const arrayBuffer = await recording.arrayBuffer();
                const audioContext = Tone.context.rawContext;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // FLAC encoding (basic implementation using WAV-like structure with FLAC header)
                const numChannels = audioBuffer.numberOfChannels;
                const sampleRate = audioBuffer.sampleRate;
                const bitsPerSample = 16;
                const length = audioBuffer.length;
                
                const channelData = [];
                for (let ch = 0; ch < numChannels; ch++) {
                    channelData.push(audioBuffer.getChannelData(ch));
                }
                
                // Build FLAC file structure
                const flacData = [];
                
                // fLaC marker
                flacData.push(new Uint8Array([0x66, 0x4C, 0x61, 0x43])); // 'fLaC'
                
                // STREAMINFO block (simplified - 34 bytes of metadata)
                const streamInfo = new ArrayBuffer(38);
                const view = new DataView(streamInfo);
                view.setUint8(0, 0x80); // Last metadata block flag + type 0
                view.setUint8(1, 0); view.setUint8(2, 0); view.setUint8(3, 34); // Block size
                // Sample rate (20 bits), channels (3 bits), bits per sample (5 bits), total samples (36 bits)
                view.setUint16(4, (sampleRate >>> 12) & 0xFFFF);
                view.setUint8(6, (sampleRate >>> 4) & 0xFF);
                view.setUint8(7, ((sampleRate & 0x0F) << 4) | ((numChannels - 1) << 1) | ((bitsPerSample - 1) >>> 4));
                view.setUint8(8, ((bitsPerSample - 1) & 0x0F) << 4);
                view.setUint32(9, 0);
                view.setUint32(13, length); // Total samples
                for (let i = 17; i < 33; i++) { view.setUint8(i, 0); } // MD5 signature (zeros)
                flacData.push(new Uint8Array(streamInfo));
                
                // Simple PCM frame data (interleaved)
                const frameData = new Int16Array(length * numChannels);
                let idx = 0;
                for (let i = 0; i < length; i++) {
                    for (let ch = 0; ch < numChannels; ch++) {
                        const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
                        frameData[idx++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    }
                }
                flacData.push(new Uint8Array(frameData.buffer));
                
                finalBlob = new Blob(flacData, { type: 'audio/flac' });
                fileExtension = 'flac';
                formatInfo = `${config.sampleRate}Hz, FLAC`;
                console.log("[Export] FLAC encoded, size:", finalBlob.size);
            } catch (flacError) {
                console.error("[Export] FLAC encoding failed:", flacError);
                appServices.showNotification("FLAC encoding failed, exporting as WAV.", 3000);
                fileExtension = 'wav';
            }
        }

        // Download with settings info in filename
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `snugos-export-${config.sampleRate}hz-${fileExtension === 'wav' ? config.bitDepth + 'bit' : fileExtension === 'mp3' ? (config.mp3Bitrate || 192) + 'kbps' : 'flac'}-${timestamp}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const formatDisplay = config.format.toUpperCase();
        appServices.showNotification(`Export successful! (${formatDisplay}, ${formatInfo})`, 3000);
        console.log("[Export] Complete, format:", config.format, "size:", finalBlob.size);

    } catch (error) {
        console.error("[State exportWithSettingsInternal] Error:", error);
        appServices.showNotification(`Export error: ${error.message}`, 5000);
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
    }
}

/**
 * Normalizes an audio blob to a target dB level.
 * @param {Blob} audioBlob - The audio blob to normalize
 * @param {number} targetDb - Target peak level in dB (e.g., -1 for -1dB)
 * @returns {Promise<Blob>} - Normalized audio blob
 */
async function normalizeAudioBlob(audioBlob, targetDb = -1) {
    try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Find peak amplitude
        let peak = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                const absValue = Math.abs(channelData[i]);
                if (absValue > peak) peak = absValue;
            }
        }
        
        if (peak === 0) {
            await audioContext.close();
            return audioBlob; // Silent audio, return as-is
        }
        
        // Calculate gain needed
        const targetLinear = Math.pow(10, targetDb / 20);
        const gain = targetLinear / peak;
        
        // Apply gain
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                channelData[i] *= gain;
            }
        }
        
        // Convert back to WAV
        const wavBlob = bufferToWav(audioBuffer);
        await audioContext.close();
        return wavBlob;
        
    } catch (error) {
        console.error("[Normalize] Error:", error);
        return audioBlob; // Return original on error
    }
}

/**
 * Converts an AudioBuffer to a WAV Blob.
 */
function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;
    
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
        channelData.push(buffer.getChannelData(i));
    }
    
    let pos = offset;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, intSample, true);
            pos += 2;
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}


// ============================================
// AUTO-SAVE AND CRASH RECOVERY SYSTEM
// ============================================

// Auto-save configuration
const AUTOSAVE_INTERVAL_MS = 30000; // 30 seconds
const AUTOSAVE_KEY = 'autosave';
const CRASH_RECOVERY_KEY = 'crash_recovery';
const RECOVERY_AGE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

let autoSaveIntervalId = null;
let lastAutoSaveTime = 0;
let isAutoSaving = false;

/**
 * Starts the auto-save timer. Called during app initialization.
 */
export function startAutoSave() {
    if (autoSaveIntervalId !== null) {
        console.log('[AutoSave] Already running.');
        return;
    }
    
    console.log('[AutoSave] Starting auto-save system...');
    
    // Save immediately on start to mark session
    autoSaveProjectState();
    
    // Set up periodic auto-save
    autoSaveIntervalId = setInterval(() => {
        autoSaveProjectState();
    }, AUTOSAVE_INTERVAL_MS);
    
    // Save before page unload (crash detection)
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    console.log('[AutoSave] Auto-save system started. Interval:', AUTOSAVE_INTERVAL_MS / 1000, 'seconds');
}

/**
 * Stops the auto-save timer. Called during clean shutdown.
 */
export function stopAutoSave() {
    if (autoSaveIntervalId !== null) {
        clearInterval(autoSaveIntervalId);
        autoSaveIntervalId = null;
        console.log('[AutoSave] Auto-save system stopped.');
    }
    
    // Remove event listeners
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
}

/**
 * Handles beforeunload event - saves state for crash recovery.
 */
function handleBeforeUnload(event) {
    try {
        const projectData = gatherProjectDataInternal();
        if (projectData) {
            sessionStorage.setItem('snugos_session_end', JSON.stringify({
                timestamp: Date.now(),
                hasUnsavedChanges: true
            }));
        }
    } catch (e) {
        console.warn('[AutoSave] Error during beforeunload save:', e);
    }
}

/**
 * Handles pagehide event - backup for mobile/safari.
 */
function handlePageHide(event) {
    handleBeforeUnload(event);
}

/**
 * Performs the actual auto-save operation.
 */
async function autoSaveProjectState() {
    if (isAutoSaving) {
        console.log('[AutoSave] Already saving, skipping...');
        return;
    }
    
    isAutoSaving = true;
    try {
        const projectData = gatherProjectDataInternal();
        if (!projectData) {
            console.warn('[AutoSave] No project data to save.');
            return;
        }
        
        await storeProjectState(AUTOSAVE_KEY, projectData);
        lastAutoSaveTime = Date.now();
        console.log('[AutoSave] Project state saved successfully at', new Date(lastAutoSaveTime).toISOString());
        
    } catch (error) {
        console.error('[AutoSave] Failed to auto-save project:', error);
    } finally {
        isAutoSaving = false;
    }
}

/**
 * Manually trigger an auto-save (for after important changes).
 */
export async function triggerAutoSave() {
    await autoSaveProjectState();
}

/**
 * Checks for crash recovery on app startup.
 * Returns recovery data if a crash recovery is available, null otherwise.
 */
export async function checkCrashRecovery() {
    try {
        const sessionEnd = sessionStorage.getItem('snugos_session_end');
        let wasUnexpectedExit = false;
        
        if (sessionEnd) {
            const sessionData = JSON.parse(sessionEnd);
            const age = Date.now() - sessionData.timestamp;
            if (age < 5 * 60 * 1000) {
                wasUnexpectedExit = true;
            }
            sessionStorage.removeItem('snugos_session_end');
        }
        
        const savedState = await getProjectState(AUTOSAVE_KEY);
        
        if (!savedState) {
            console.log('[CrashRecovery] No auto-saved state found.');
            return null;
        }
        
        const stateAge = Date.now() - (savedState._autosaveTimestamp || 0);
        
        if (stateAge > RECOVERY_AGE_LIMIT_MS) {
            console.log('[CrashRecovery] Auto-saved state too old, discarding.');
            await deleteProjectState(AUTOSAVE_KEY);
            return null;
        }
        
        console.log('[CrashRecovery] Found recovery state from', new Date(savedState._autosaveTimestamp).toISOString());
        
        return {
            projectData: savedState,
            timestamp: savedState._autosaveTimestamp,
            age: stateAge,
            wasUnexpectedExit
        };
        
    } catch (error) {
        console.error('[CrashRecovery] Error checking for crash recovery:', error);
        return null;
    }
}

/**
 * Clears the crash recovery state (after successful recovery or user declines).
 */
export async function clearCrashRecovery() {
    try {
        await deleteProjectState(AUTOSAVE_KEY);
        sessionStorage.removeItem('snugos_session_end');
        console.log('[CrashRecovery] Recovery state cleared.');
    } catch (error) {
        console.error('[CrashRecovery] Error clearing recovery state:', error);
    }
}

/**
 * Creates a recovery dialog UI element.
 * Returns the dialog element for the caller to append to the DOM.
 */
export function createRecoveryDialog(recoveryInfo, onRecover, onDiscard) {
    const dialog = document.createElement('div');
    dialog.id = 'crash-recovery-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const ageMinutes = Math.round(recoveryInfo.age / 60000);
    const ageText = ageMinutes < 1 ? 'less than a minute ago' : 
                    ageMinutes < 60 ? `${ageMinutes} minute(s) ago` :
                    `${Math.round(ageMinutes / 60)} hour(s) ago`;
    
    dialog.innerHTML = `
        <div style="background: #1a1a1a; border-radius: 12px; padding: 32px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <h2 style="color: #fff; margin: 0 0 8px 0; font-size: 24px;">Session Recovery</h2>
                <p style="color: #aaa; margin: 0; font-size: 14px;">
                    SnugOS detected an unsaved session from ${ageText}.<br>
                    Would you like to recover your work?
                </p>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="recover-btn" style="flex: 1; padding: 14px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500;">
                    Recover Session
                </button>
                <button id="discard-btn" style="flex: 1; padding: 14px 24px; background: #374151; color: #9ca3af; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500;">
                    Start Fresh
                </button>
            </div>
            <p style="color: #666; font-size: 12px; text-align: center; margin: 16px 0 0 0;">
                Track count: ${recoveryInfo.projectData?.tracks?.length || 0} | 
                Saved: ${new Date(recoveryInfo.timestamp).toLocaleTimeString()}
            </p>
        </div>
    `;
    
    dialog.querySelector('#recover-btn').addEventListener('click', () => {
        dialog.remove();
        onRecover();
    });
    
    dialog.querySelector('#discard-btn').addEventListener('click', () => {
        dialog.remove();
        onDiscard();
    });
    
    return dialog;
}

/**
 * Gets the last auto-save time for display purposes.
 */
export function getLastAutoSaveTime() {
    return lastAutoSaveTime;
}

/**
 * Gets auto-save status info.
 */
export function getAutoSaveStatus() {
    return {
        isEnabled: autoSaveIntervalId !== null,
        intervalMs: AUTOSAVE_INTERVAL_MS,
        lastSaveTime: lastAutoSaveTime,
        isSaving: isAutoSaving
    };
}

// --- Audio Normalization Settings ---
let autoNormalizeEnabled = true;
let normalizationTargetDb = -1; // Target peak level in dB

export function getAutoNormalizeEnabled() { return autoNormalizeEnabled; }
export function setAutoNormalizeEnabled(enabled) { 
    autoNormalizeEnabled = !!enabled;
    console.log(`[State] Auto-normalization ${autoNormalizeEnabled ? 'enabled' : 'disabled'}`);
}
export function getNormalizationTargetDb() { return normalizationTargetDb; }
export function setNormalizationTargetDb(db) { 
    // Clamp to reasonable range: -6dB to 0dB
    normalizationTargetDb = Math.max(-6, Math.min(0, parseFloat(db) || -1));
    console.log(`[State] Normalization target set to: ${normalizationTargetDb}dB`);
}

// --- Timeline Markers System ---
let timelineMarkers = []; // Array of { id, name, position, color }
let timelineMarkerIdCounter = 0;

/**
 * Adds a new timeline marker.
 * @param {string} name - Marker name
 * @param {number} position - Position in seconds
 * @param {string} color - Marker color (hex or named color)
 * @returns {object} The created marker
 */
export function addTimelineMarker(name, position, color = '#f59e0b') {
    const marker = {
        id: `marker_${++timelineMarkerIdCounter}`,
        name: name || `Marker ${timelineMarkerIdCounter}`,
        position: Math.max(0, parseFloat(position) || 0),
        color: color
    };
    timelineMarkers.push(marker);
    timelineMarkers.sort((a, b) => a.position - b.position);
    console.log(`[State] Added timeline marker "${marker.name}" at ${marker.position}s`);
    return marker;
}

/**
 * Removes a timeline marker by ID.
 * @param {string} markerId - The marker ID to remove
 * @returns {boolean} True if removed, false if not found
 */
export function removeTimelineMarker(markerId) {
    const index = timelineMarkers.findIndex(m => m.id === markerId);
    if (index !== -1) {
        const removed = timelineMarkers.splice(index, 1)[0];
        console.log(`[State] Removed timeline marker "${removed.name}"`);
        return true;
    }
    return false;
}

/**
 * Updates a timeline marker's properties.
 * @param {string} markerId - The marker ID to update
 * @param {object} updates - Properties to update (name, position, color)
 * @returns {object|null} The updated marker or null if not found
 */
export function updateTimelineMarker(markerId, updates) {
    const marker = timelineMarkers.find(m => m.id === markerId);
    if (marker) {
        if (updates.name !== undefined) marker.name = String(updates.name);
        if (updates.position !== undefined) {
            marker.position = Math.max(0, parseFloat(updates.position) || 0);
            // Re-sort after position change
            timelineMarkers.sort((a, b) => a.position - b.position);
        }
        if (updates.color !== undefined) marker.color = updates.color;
        console.log(`[State] Updated timeline marker "${marker.name}"`);
        return marker;
    }
    return null;
}

/**
 * Gets all timeline markers sorted by position.
 * @returns {Array} Array of marker objects
 */
export function getTimelineMarkers() {
    return [...timelineMarkers];
}

/**
 * Gets a specific timeline marker by ID.
 * @param {string} markerId - The marker ID
 * @returns {object|null} The marker or null if not found
 */
export function getTimelineMarkerById(markerId) {
    return timelineMarkers.find(m => m.id === markerId) || null;
}

/**
 * Clears all timeline markers.
 */
export function clearAllTimelineMarkers() {
    timelineMarkers = [];
    timelineMarkerIdCounter = 0;
    console.log(`[State] Cleared all timeline markers`);
}

/**
 * Gets the next marker after a given position (for navigation).
 * @param {number} position - Current position in seconds
 * @returns {object|null} The next marker or null if none exists
 */
export function getNextTimelineMarker(position) {
    const sortedMarkers = timelineMarkers.filter(m => m.position > position);
    return sortedMarkers.length > 0 ? sortedMarkers[0] : null;
}

/**
 * Gets the previous marker before a given position (for navigation).
 * @param {number} position - Current position in seconds
 * @returns {object|null} The previous marker or null if none exists
 */
export function getPrevTimelineMarker(position) {
    const sortedMarkers = timelineMarkers.filter(m => m.position < position);
    return sortedMarkers.length > 0 ? sortedMarkers[sortedMarkers.length - 1] : null;
}

/**
 * Imports markers from an array (used during project load).
 * @param {Array} markersData - Array of marker objects
 */
export function importTimelineMarkers(markersData) {
    if (Array.isArray(markersData)) {
        timelineMarkers = markersData.map(m => ({
            id: m.id || `marker_${++timelineMarkerIdCounter}`,
            name: m.name || 'Unnamed',
            position: Math.max(0, parseFloat(m.position) || 0),
            color: m.color || '#f59e0b'
        }));
        timelineMarkers.sort((a, b) => a.position - b.position);
        // Update counter to avoid ID collisions
        const maxId = timelineMarkers.reduce((max, m) => {
            const match = m.id.match(/marker_(\d+)/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        timelineMarkerIdCounter = maxId;
        console.log(`[State] Imported ${timelineMarkers.length} timeline markers`);
    }
}

/**
 * Exports markers for project save.
 * @returns {Array} Array of marker objects
 */
export function exportTimelineMarkers() {
    return JSON.parse(JSON.stringify(timelineMarkers));
}

// --- Track Freeze State Management ---
/**
 * Freeze a track - render to audio and disable real-time processing.
 * @param {number} trackId - The track ID to freeze
 * @param {Object} options - Freeze options
 * @returns {Promise<boolean>} True if successful
 */
export async function freezeTrack(trackId, options = {}) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.error(`[State freezeTrack] Track ${trackId} not found.`);
        return false;
    }

    if (track.frozen) {
        console.log(`[State freezeTrack] Track ${trackId} already frozen.`);
        return true;
    }

    try {
        const result = await track.freeze(options.startBar, options.endBar);
        
        if (result && appServices.captureStateForUndo) {
            appServices.captureStateForUndo(`Froze track ${track.name}`);
        }
        
        return result;
    } catch (error) {
        console.error(`[State freezeTrack] Error:`, error);
        return false;
    }
}

/**
 * Unfreeze a track - restore real-time processing.
 * @param {number} trackId - The track ID to unfreeze
 * @returns {Promise<boolean>} True if successful
 */
export async function unfreezeTrack(trackId) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.error(`[State unfreezeTrack] Track ${trackId} not found.`);
        return false;
    }

    if (!track.frozen) {
        console.log(`[State unfreezeTrack] Track ${trackId} not frozen.`);
        return true;
    }

    try {
        const result = await track.unfreeze();
        
        if (result && appServices.captureStateForUndo) {
            appServices.captureStateForUndo(`Unfroze track ${track.name}`);
        }
        
        return result;
    } catch (error) {
        console.error(`[State unfreezeTrack] Error:`, error);
        return false;
    }
}

/**
 * Get frozen state for a track.
 * @param {number} trackId - The track ID
 * @returns {Object|null} Frozen state info or null
 */
export function getTrackFrozenState(trackId) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        return null;
    }

    return track.getFrozenInfo ? track.getFrozenInfo() : { frozen: track.frozen || false };
}

/**
 * Check if a track is frozen.
 * @param {number} trackId - The track ID
 * @returns {boolean} True if frozen
 */
export function isTrackFrozen(trackId) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    return track ? (track.frozen || false) : false;
}

/**
 * Get all frozen tracks.
 * @returns {Array} Array of frozen track IDs
 */
export function getFrozenTracks() {
    const tracks = getTracksState();
    return tracks.filter(t => t.frozen).map(t => t.id);
}

// ==========================================
// TRACK GROUPS
// ==========================================

/**
 * Track groups state - groups of tracks that can be controlled together.
 * Each group has: id, name, trackIds, color, volume, muted, solo
 */
let trackGroups = [];
let trackGroupIdCounter = 1;

/**
 * Get all track groups.
 * @returns {Array} Array of track group objects
 */
export function getTrackGroups() {
    return trackGroups;
}

/**
 * Get a track group by ID.
 * @param {number} groupId - The group ID
 * @returns {Object|null} Group object or null
 */
export function getTrackGroupById(groupId) {
    return trackGroups.find(g => g.id === groupId) || null;
}

/**
 * Add a new track group.
 * @param {string} name - Group name
 * @param {Array} trackIds - Array of track IDs to include
 * @param {string} color - Group color (hex)
 * @returns {Object} The created group
 */
export function addTrackGroup(name = 'New Group', trackIds = [], color = '#6366f1') {
    const group = {
        id: trackGroupIdCounter++,
        name: name,
        trackIds: [...trackIds],
        color: color,
        volume: 1.0,
        muted: false,
        solo: false
    };
    
    trackGroups.push(group);
    console.log(`[State] Added track group: ${name} with ${trackIds.length} tracks`);
    
    return group;
}

/**
 * Remove a track group.
 * @param {number} groupId - The group ID to remove
 * @returns {boolean} True if removed
 */
export function removeTrackGroup(groupId) {
    const index = trackGroups.findIndex(g => g.id === groupId);
    if (index === -1) return false;
    
    const removed = trackGroups.splice(index, 1)[0];
    console.log(`[State] Removed track group: ${removed.name}`);
    
    return true;
}

/**
 * Update a track group's properties.
 * @param {number} groupId - The group ID
 * @param {Object} updates - Properties to update
 * @returns {boolean} True if updated
 */
export function updateTrackGroup(groupId, updates) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    Object.assign(group, updates);
    console.log(`[State] Updated track group ${groupId}:`, updates);
    
    return true;
}

/**
 * Add a track to a group.
 * @param {number} groupId - The group ID
 * @param {number} trackId - The track ID to add
 * @returns {boolean} True if added
 */
export function addTrackToGroup(groupId, trackId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    if (!group.trackIds.includes(trackId)) {
        group.trackIds.push(trackId);
        console.log(`[State] Added track ${trackId} to group ${groupId}`);
    }
    
    return true;
}

/**
 * Remove a track from a group.
 * @param {number} groupId - The group ID
 * @param {number} trackId - The track ID to remove
 * @returns {boolean} True if removed
 */
export function removeTrackFromGroup(groupId, trackId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    const index = group.trackIds.indexOf(trackId);
    if (index !== -1) {
        group.trackIds.splice(index, 1);
        console.log(`[State] Removed track ${trackId} from group ${groupId}`);
    }
    
    return true;
}

/**
 * Set group volume (applies to all tracks in group).
 * @param {number} groupId - The group ID
 * @param {number} volume - Volume (0-1)
 * @returns {boolean} True if set
 */
export function setTrackGroupVolume(groupId, volume) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.volume = Math.max(0, Math.min(1, volume));
    
    // Apply volume to all tracks in group
    const tracks = getTracksState();
    group.trackIds.forEach(trackId => {
        const track = tracks.find(t => t.id === trackId);
        if (track && track.setVolume) {
            track.setVolume(group.volume);
        }
    });
    
    console.log(`[State] Set group ${groupId} volume to ${volume}`);
    
    return true;
}

/**
 * Set group mute state (applies to all tracks in group).
 * @param {number} groupId - The group ID
 * @param {boolean} muted - Mute state
 * @returns {boolean} True if set
 */
export function setTrackGroupMute(groupId, muted) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.muted = muted;
    
    // Apply mute to all tracks in group
    const tracks = getTracksState();
    group.trackIds.forEach(trackId => {
        const track = tracks.find(t => t.id === trackId);
        if (track && track.setMuted) {
            track.setMuted(muted);
        }
    });
    
    console.log(`[State] Set group ${groupId} muted to ${muted}`);
    
    return true;
}

/**
 * Set group solo state.
 * @param {number} groupId - The group ID
 * @param {boolean} solo - Solo state
 * @returns {boolean} True if set
 */
export function setTrackGroupSolo(groupId, solo) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.solo = solo;
    
    // Handle solo logic: mute all non-solo groups
    const allTracks = getTracksState();
    
    if (solo) {
        // Check if any group is soloed
        const anySoloed = trackGroups.some(g => g.solo);
        
        if (anySoloed) {
            // Mute tracks not in soloed groups
            const soloedTrackIds = new Set();
            trackGroups.filter(g => g.solo).forEach(g => {
                g.trackIds.forEach(id => soloedTrackIds.add(id));
            });
            
            allTracks.forEach(track => {
                if (track.setMuted) {
                    track.setMuted(!soloedTrackIds.has(track.id));
                }
            });
        }
    } else {
        // Check if any group is still soloed
        const anySoloed = trackGroups.some(g => g.solo);
        
        if (!anySoloed) {
            // Unmute all tracks
            allTracks.forEach(track => {
                if (track.setMuted) {
                    track.setMuted(false);
                }
            });
        }
    }
    
    console.log(`[State] Set group ${groupId} solo to ${solo}`);
    
    return true;
}

/**
 * Toggle group mute state.
 * @param {number} groupId - The group ID
 * @returns {boolean} New mute state
 */
export function toggleTrackGroupMute(groupId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    setTrackGroupMute(groupId, !group.muted);
    return !group.muted;
}

/**
 * Toggle group solo state.
 * @param {number} groupId - The group ID
 * @returns {boolean} New solo state
 */
export function toggleTrackGroupSolo(groupId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    setTrackGroupSolo(groupId, !group.solo);
    return !group.solo;
}

/**
 * Clear all track groups.
 */
export function clearAllTrackGroups() {
    trackGroups = [];
    trackGroupIdCounter = 1;
    console.log('[State] Cleared all track groups');
}

// --- Project Export Presets ---
// Stored as { presetName: { tempo, format, sampleRate, bitDepth, includeStems, stemTrackIds, bounceTracks, bounceStartBar, bounceEndBar, ... } }
let exportPresets = {};

export function getExportPresetsState() { return exportPresets; }

export function saveExportPreset(presetName, presetData) {
    exportPresets[presetName] = JSON.parse(JSON.stringify(presetData));
    console.log(`[State] Saved export preset "${presetName}"`);
}

export function deleteExportPreset(presetName) {
    if (exportPresets[presetName]) {
        delete exportPresets[presetName];
        console.log(`[State] Deleted export preset "${presetName}"`);
    }
}

export function getExportPreset(presetName) {
    if (exportPresets[presetName]) {
        return JSON.parse(JSON.stringify(exportPresets[presetName]));
    }
    return null;
}

export function getExportPresetNames() {
    return Object.keys(exportPresets);
}

// --- Chord Memory ---
// chordMemorySlots: Array of { id, name, notes: [{pitch, velocity}], timestamp }
// Stores chord voicings that can be triggered with a single key
let chordMemorySlots = [];

export function getChordMemorySlots() { return chordMemorySlots; }

/**
 * Store a chord in memory.
 * @param {string} name - Name for the chord (e.g., "C Major", "G7")
 * @param {Array} notes - Array of {pitch: number (MIDI note), velocity: number (0-1)}
 * @returns {string} The ID of the stored chord
 */
export function storeChord(name, notes) {
    const id = `chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const chord = {
        id,
        name: name || `Chord ${chordMemorySlots.length + 1}`,
        notes: notes.map(n => ({
            pitch: Math.round(n.pitch),
            velocity: Math.max(0, Math.min(1, n.velocity || 0.8))
        })),
        timestamp: Date.now()
    };
    chordMemorySlots.push(chord);
    console.log(`[State] Stored chord "${chord.name}" with ${chord.notes.length} notes`);
    return id;
}

/**
 * Delete a chord from memory.
 * @param {string} chordId - The ID of the chord to delete
 */
export function deleteChord(chordId) {
    const idx = chordMemorySlots.findIndex(c => c.id === chordId);
    if (idx !== -1) {
        const deleted = chordMemorySlots.splice(idx, 1)[0];
        console.log(`[State] Deleted chord "${deleted.name}"`);
    }
}

/**
 * Get a chord by ID.
 * @param {string} chordId - The ID of the chord
 * @returns {Object|null} The chord object or null if not found
 */
export function getChordById(chordId) {
    return chordMemorySlots.find(c => c.id === chordId) || null;
}

/**
 * Trigger a stored chord - plays all notes simultaneously.
 * @param {string} chordId - The ID of the chord to trigger
 * @param {number} trackId - Optional track ID to play on (uses armed track if null)
 * @param {number} duration - Duration in seconds (0 = indefinite/legato)
 * @returns {boolean} True if chord was triggered successfully
 */
export function triggerChord(chordId, trackId = null, duration = 0) {
    const chord = getChordById(chordId);
    if (!chord) {
        console.warn(`[State triggerChord] Chord ${chordId} not found`);
        return false;
    }
    
    const targetTrackId = trackId || armedTrackId || activeSequencerTrackId;
    if (targetTrackId === null) {
        console.warn('[State triggerChord] No target track specified');
        return false;
    }
    
    const track = tracks.find(t => t.id === targetTrackId);
    if (!track) {
        console.warn(`[State triggerChord] Track ${targetTrackId} not found`);
        return false;
    }
    
    // Play all notes in the chord
    const now = Tone.now();
    chord.notes.forEach(note => {
        if (track.playNote) {
            track.playNote(note.pitch, now, duration > 0 ? duration : undefined, note.velocity);
        } else if (track.instrument && track.instrument.triggerAttack) {
            const freq = Tone.Frequency(note.pitch, 'midi').toFrequency();
            track.instrument.triggerAttack(freq, now, note.velocity);
            if (duration > 0) {
                track.instrument.triggerRelease(freq, now + duration);
            }
        }
    });
    
    console.log(`[State triggerChord] Triggered chord "${chord.name}" on track ${targetTrackId}`);
    return true;
}

/**
 * Clear all stored chords.
 */
export function clearAllChords() {
    chordMemorySlots = [];
    console.log('[State] Cleared all chord memory slots');
}

/**
 * Rename a stored chord.
 * @param {string} chordId - The ID of the chord
 * @param {string} newName - New name for the chord
 */
export function renameChord(chordId, newName) {
    const chord = chordMemorySlots.find(c => c.id === chordId);
    if (chord) {
        chord.name = newName;
        console.log(`[State] Renamed chord to "${newName}"`);
    }
}

/**
 * Import chords from project data.
 * @param {Array} chords - Array of chord objects to import
 */
export function setChordMemoryState(chords) {
    chordMemorySlots = Array.isArray(chords) ? chords.map(c => ({
        id: c.id || `chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: c.name || 'Unnamed Chord',
        notes: Array.isArray(c.notes) ? c.notes.map(n => ({
            pitch: Math.round(n.pitch),
            velocity: Math.max(0, Math.min(1, n.velocity || 0.8))
        })) : [],
        timestamp: c.timestamp || Date.now()
    })) : [];
    console.log(`[State] Imported ${chordMemorySlots.length} chord memory slots`);
}

// --- AppServices Placeholder (will be populated by main.js) ---
let appServices = {}; // Populated by initializeStateModule

export function initializeStateModule(services) {
    appServices = services || {}; // Ensure appServices is an object
    if (!Array.isArray(masterEffectsChainState)) {
        masterEffectsChainState = [];
    }
    // Ensure playback mode services are set up if not already provided
    if (appServices && typeof appServices.getPlaybackMode !== 'function') {
        appServices.getPlaybackMode = getPlaybackModeState;
    }
    if (appServices && typeof appServices.setPlaybackMode !== 'function') {
        appServices.setPlaybackMode = setPlaybackModeStateInternal;
    }
    console.log("[State] State module initialized. AppServices keys:", Object.keys(appServices));
}

// --- Getters for Centralized State ---
export function getTracksState() { return tracks; }
export function getTrackByIdState(id) { return tracks.find(t => t.id === id); }

export function getOpenWindowsState() { return openWindowsMap; }
export function getWindowByIdState(id) { return openWindowsMap.get(id); }
export function getHighestZState() { return highestZ; }
export function getMasterEffectsState() { return masterEffectsChainState; }
export function getMasterGainValueState() { return masterGainValueState; }

export function getMidiAccessState() { return midiAccessGlobal; }
export function getActiveMIDIInputState() { return activeMIDIInputGlobal; }

// MODIFICATION START: Add console logs to getters
export function getLoadedZipFilesState() {
    console.log('[State GET] getLoadedZipFilesState. Keys:', loadedZipFilesGlobal ? Object.keys(loadedZipFilesGlobal) : 'null/undefined');
    return loadedZipFilesGlobal;
}
export function getSoundLibraryFileTreesState() {
    console.log('[State GET] getSoundLibraryFileTreesState. Keys:', soundLibraryFileTreesGlobal ? Object.keys(soundLibraryFileTreesGlobal) : 'null/undefined');
    if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"] && Object.keys(soundLibraryFileTreesGlobal["Drums"]).length > 0) {
        console.log('[State GET] "Drums" tree exists and is NOT empty.');
    } else if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"]) {
        console.warn('[State GET] "Drums" tree exists but IS EMPTY!');
    }
    return soundLibraryFileTreesGlobal;
}
// MODIFICATION END
export function getCurrentLibraryNameState() { return currentLibraryNameGlobal; }
export function getCurrentSoundFileTreeState() { return currentSoundFileTreeGlobal; }
export function getCurrentSoundBrowserPathState() { return currentSoundBrowserPathGlobal; }
export function getPreviewPlayerState() { return previewPlayerGlobal; }

export function getClipboardDataState() { return clipboardDataGlobal; }
export function getAutomationClipboardState() { return automationClipboardGlobal; }
export function setAutomationClipboardState(data) { 
    automationClipboardGlobal = typeof data === 'object' && data !== null ? data : { param: null, points: [], sourceTrackId: null }; 
}
export function getArmedTrackIdState() { return armedTrackId; }
export function getSoloedTrackIdState() { return soloedTrackId; }
export function setSoloedTrackIdState(id) { soloedTrackId = id; }
export function isTrackRecordingState() { return isRecordingGlobal; }
export function getRecordingTrackIdState() { return recordingTrackIdGlobal; }
export function getRecordingStartTimeState() { return recordingStartTime; }
export function getActiveSequencerTrackIdState() { return activeSequencerTrackId; }
export function getUndoStackState() { return undoStack; }
export function getRedoStackState() { return redoStack; }
export function getPlaybackModeState() { return globalPlaybackMode; }

// --- Track Effects Presets ---
export function getTrackEffectsPresetsState() { return trackEffectsPresets; }

export function saveTrackEffectPreset(trackId, presetName, effectsData) {
    if (!trackEffectsPresets[trackId]) {
        trackEffectsPresets[trackId] = {};
    }
    trackEffectsPresets[trackId][presetName] = JSON.parse(JSON.stringify(effectsData));
    console.log(`[State] Saved effect preset "${presetName}" for track ${trackId}`);
}

export function deleteTrackEffectPreset(trackId, presetName) {
    if (trackEffectsPresets[trackId] && trackEffectsPresets[trackId][presetName]) {
        delete trackEffectsPresets[trackId][presetName];
        console.log(`[State] Deleted effect preset "${presetName}" for track ${trackId}`);
    }
}

export function getTrackEffectPreset(trackId, presetName) {
    if (trackEffectsPresets[trackId] && trackEffectsPresets[trackId][presetName]) {
        return JSON.parse(JSON.stringify(trackEffectsPresets[trackId][presetName]));
    }
    return null;
}

export function getTrackEffectPresetNames(trackId) {
    if (trackEffectsPresets[trackId]) {
        return Object.keys(trackEffectsPresets[trackId]);
    }
    return [];
}

// --- Setters for Centralized State (called internally or via appServices) ---
export function addWindowToStoreState(id, instance) { openWindowsMap.set(id, instance); }
export function removeWindowFromStoreState(id) { openWindowsMap.delete(id); }
export function setHighestZState(value) { highestZ = Number.isFinite(value) ? value : 100; }
export function incrementHighestZState() { return ++highestZ; }

export function setMasterEffectsState(newChain) { masterEffectsChainState = Array.isArray(newChain) ? newChain : []; }
export function setMasterGainValueState(value) { masterGainValueState = Number.isFinite(value) ? value : (typeof Tone !== 'undefined' && Tone.dbToGain) ? Tone.dbToGain(0) : 1.0; }

export function setMidiAccessState(access) { midiAccessGlobal = access; }
export function setActiveMIDIInputState(input) { activeMIDIInputGlobal = input; }

// MODIFICATION START: Add console logs to setters
export function setLoadedZipFilesState(files) {
    console.log('[State SET] setLoadedZipFilesState. Incoming keys:', files ? Object.keys(files) : 'null/undefined');
    loadedZipFilesGlobal = typeof files === 'object' && files !== null ? files : {};
    console.log('[State SET] setLoadedZipFilesState. loadedZipFilesGlobal NOW has keys:', Object.keys(loadedZipFilesGlobal));
    if (loadedZipFilesGlobal && loadedZipFilesGlobal["Drums"]) {
         console.log('[State SET] "Drums" JSZip instance IS in loadedZipFilesGlobal.');
    } else {
         console.log('[State SET] "Drums" JSZip instance IS NOT in loadedZipFilesGlobal after set.');
    }
}
export function setSoundLibraryFileTreesState(trees) {
    console.log('[State SET] setSoundLibraryFileTreesState. Incoming keys:', trees ? Object.keys(trees) : 'null/undefined');
    if (trees && trees["Drums"]) {
        console.log('[State SET] setSoundLibraryFileTreesState: Incoming "Drums" tree has keys count:', Object.keys(trees["Drums"]).length);
    } else if (trees) {
         console.log('[State SET] setSoundLibraryFileTreesState: Incoming trees object does not have "Drums" key.');
    }

    soundLibraryFileTreesGlobal = typeof trees === 'object' && trees !== null ? trees : {};
    console.log('[State SET] setSoundLibraryFileTreesState. soundLibraryFileTreesGlobal NOW has keys:', Object.keys(soundLibraryFileTreesGlobal));

    if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"]) {
        console.log('[State SET] "Drums" tree IS in soundLibraryFileTreesGlobal. Num children:', Object.keys(soundLibraryFileTreesGlobal["Drums"]).length);
        if (Object.keys(soundLibraryFileTreesGlobal["Drums"]).length === 0) {
            console.warn('[State SET] "Drums" tree in global state IS EMPTY!');
        }
    } else {
         console.log('[State SET] "Drums" tree IS NOT in soundLibraryFileTreesGlobal after set.');
    }
}
// MODIFICATION END

export function setCurrentLibraryNameState(name) { currentLibraryNameGlobal = name; }
export function setCurrentSoundFileTreeState(tree) { currentSoundFileTreeGlobal = tree; }
export function setCurrentSoundBrowserPathState(path) { currentSoundBrowserPathGlobal = Array.isArray(path) ? path : []; }
export function setPreviewPlayerState(player) { previewPlayerGlobal = player; }

export function setClipboardDataState(data) { clipboardDataGlobal = typeof data === 'object' && data !== null ? data : { type: null, data: null }; }

export function setArmedTrackIdState(id) { armedTrackId = id; }
export function setPlaybackModeStateInternal(mode) {
    const displayMode = typeof mode === 'string' ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Unknown';
    console.log(`[State setPlaybackModeStateInternal] Attempting to set mode to: ${mode} (Display: ${displayMode}). Current mode: ${globalPlaybackMode}`);

    if (mode === 'sequencer' || mode === 'timeline') {
        if (globalPlaybackMode !== mode) {
            if (appServices.captureStateForUndo) {
                appServices.captureStateForUndo(`Set Playback Mode to ${displayMode}`);
            } else {
                captureStateForUndoInternal(`Set Playback Mode to ${displayMode}`); // Fallback
            }
            globalPlaybackMode = mode;
            console.log(`[State setPlaybackModeStateInternal] Playback mode changed to: ${globalPlaybackMode}`);

            if (Tone.Transport.state === 'started') {
                console.log("[State setPlaybackModeStateInternal] Transport was started, stopping it.");
                Tone.Transport.stop();
            }
            Tone.Transport.cancel(0); // Cancel all scheduled events
            console.log("[State setPlaybackModeStateInternal] Tone.Transport events cancelled.");

            if (appServices.uiElementsCache?.playBtnGlobal) {
                appServices.uiElementsCache.playBtnGlobal.textContent = 'Play';
                console.log("[State setPlaybackModeStateInternal] Play button text reset.");
            } else {
                console.warn("[State setPlaybackModeStateInternal] Play button UI element not found in cache.");
            }
            document.querySelectorAll('.sequencer-step-cell.playing').forEach(cell => cell.classList.remove('playing'));

            const currentTracks = getTracksState();
            console.log(`[State setPlaybackModeStateInternal] Re-initializing sequences/playback for ${currentTracks.length} tracks for new mode: ${globalPlaybackMode}.`);
            try {
                currentTracks.forEach(track => {
                    if (track && track.type !== 'Audio' && typeof track.recreateToneSequence === 'function') {
                        track.recreateToneSequence(true); // true to force restart
                    }
                    // If switching to sequencer mode, stop any timeline-based audio clip playback
                    if (globalPlaybackMode === 'sequencer' && track && track.type === 'Audio' && typeof track.stopPlayback === 'function') {
                        track.stopPlayback();
                    }
                });
            } catch (error) {
                console.error("[State setPlaybackModeStateInternal] Error during track sequence/playback re-initialization:", error);
                if(appServices.showNotification) appServices.showNotification("Error updating track playback for new mode.", 3000);
            }


            if (appServices.onPlaybackModeChange && typeof appServices.onPlaybackModeChange === 'function') {
                appServices.onPlaybackModeChange(globalPlaybackMode);
            }
             if (appServices.renderTimeline && typeof appServices.renderTimeline === 'function') {
                appServices.renderTimeline();
            }
        } else {
            console.log(`[State setPlaybackModeStateInternal] Mode is already ${mode}. No change.`);
        }
    } else {
        console.warn(`[State setPlaybackModeStateInternal] Invalid playback mode attempted: ${mode}. Expected 'sequencer' or 'timeline'.`);
    }
}
export { setPlaybackModeStateInternal as setPlaybackModeState }; // Export with the name expected by other modules

// --- Track Management ---
export async function addTrackToStateInternal(type, initialData = null, isUserAction = true) {
    // _isUserActionPlaceholder is used by UI event handlers to signify a brand new track from user action,
    // vs. a track being added during project load/undo/redo.
    const isBrandNewUserTrack = isUserAction && (!initialData || initialData._isUserActionPlaceholder);
    console.log(`[State addTrackToStateInternal] Adding ${type} track. User Action: ${isUserAction}, Brand New: ${isBrandNewUserTrack}`);

    if (isBrandNewUserTrack) {
        captureStateForUndoInternal(`Add ${type} Track`);
        if (initialData && initialData._isUserActionPlaceholder) initialData = null; // Clear placeholder
    }

    let newTrack;
    try {
        let newTrackId;
        if (initialData && initialData.id != null && Number.isFinite(initialData.id)) {
            newTrackId = initialData.id;
            if (newTrackId >= trackIdCounter) trackIdCounter = newTrackId + 1;
        } else {
            newTrackId = trackIdCounter++;
        }

        const trackAppServices = { // Pass necessary services to the Track instance
            getSoloedTrackId: getSoloedTrackIdState,
            captureStateForUndo: captureStateForUndoInternal,
            updateTrackUI: appServices.updateTrackUI, // These come from main.js
            highlightPlayingStep: appServices.highlightPlayingStep,
            autoSliceSample: appServices.autoSliceSample,
            closeAllTrackWindows: appServices.closeAllTrackWindows,
            getMasterEffectsBusInputNode: appServices.getMasterEffectsBusInputNode,
            showNotification: appServices.showNotification,
            effectsRegistryAccess: appServices.effectsRegistryAccess,
            renderTimeline: appServices.renderTimeline,
            getPlaybackMode: getPlaybackModeState,
            getTrackById: getTrackByIdState, // Track might need to interact with other tracks (e.g. sidechaining in future)
            getTracks: getTracksState
        };

        newTrack = new Track(newTrackId, type, initialData, trackAppServices);
        tracks.push(newTrack);

        if (typeof newTrack.initializeAudioNodes === 'function') {
            await newTrack.initializeAudioNodes();
        }
        // fullyInitializeAudioResources handles loading samples from DB/URL etc.
        await newTrack.fullyInitializeAudioResources();

        if (isBrandNewUserTrack && appServices.showNotification) {
            appServices.showNotification(`${newTrack.name} added successfully.`, 2000);
        }
        if (isBrandNewUserTrack && appServices.openTrackInspectorWindow) {
             // Delay opening inspector slightly to ensure track is fully set up
            setTimeout(() => appServices.openTrackInspectorWindow(newTrack.id), 50);
            
            // Also open sequencer for applicable track types
            if (newTrack.type !== 'Audio' && appServices.openTrackSequencerWindow) {
                setTimeout(() => appServices.openTrackSequencerWindow(newTrack.id, true), 150);
            }
        }

        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.renderTimeline) appServices.renderTimeline();

    } catch (error) {
        console.error(`[State addTrackToStateInternal] Error adding ${type} track:`, error);
        if (appServices.showNotification) {
            appServices.showNotification(`Failed to add ${type} track: ${error.message}`, 4000);
        }
        // If track creation failed, ensure it's not in the tracks array if partially added
        if (newTrack && tracks.includes(newTrack)) {
            tracks = tracks.filter(t => t.id !== newTrack.id);
        }
        return null; // Indicate failure
    }
    return newTrack;
}

export function removeTrackFromStateInternal(trackId) {
    try {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex === -1) {
            console.warn(`[State removeTrackFromStateInternal] Track ID ${trackId} not found for removal.`);
            return;
        }

        const track = tracks[trackIndex];
        captureStateForUndoInternal(`Remove Track "${track.name}"`);

        if (typeof track.dispose === 'function') {
            track.dispose();
        }
        tracks.splice(trackIndex, 1);

        if (armedTrackId === trackId) setArmedTrackIdState(null);
        if (soloedTrackId === trackId) {
            setSoloedTrackIdState(null);
            // Re-evaluate solo states for all other tracks
            tracks.forEach(t => {
                if (t) {
                    t.isSoloed = false; // Explicitly set, then applySoloState will use global state
                    if (typeof t.applySoloState === 'function') t.applySoloState();
                    if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged');
                }
            });
        }
        if (activeSequencerTrackId === trackId) setActiveSequencerTrackIdState(null);

        if (appServices.showNotification) appServices.showNotification(`Track "${track.name}" removed.`, 2000);
        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI();
        if (appServices.renderTimeline) appServices.renderTimeline();

    } catch (error) {
        console.error(`[State removeTrackFromStateInternal] Error removing track ${trackId}:`, error);
        if (appServices.showNotification) appServices.showNotification(`Error removing track: ${error.message}`, 3000);
    }
}

export function reorderTrackInState(trackId, newIndex) {
    const oldIndex = tracks.findIndex(t => t.id === trackId);
    if (oldIndex === -1) {
        console.warn(`[State reorderTrackInState] Track ID ${trackId} not found.`);
        return;
    }
    if (oldIndex === newIndex || newIndex < 0 || newIndex >= tracks.length) {
        return;
    }
    captureStateForUndoInternal(`Reorder Track`);
    const [trackToMove] = tracks.splice(oldIndex, 1);
    tracks.splice(newIndex, 0, trackToMove);
    console.log(`[State reorderTrackInState] Moved track "${trackToMove.name}" from index ${oldIndex} to ${newIndex}`);
    if (appServices.updateMixerWindow) appServices.updateMixerWindow();
    if (appServices.renderTimeline) appServices.renderTimeline();
}


/**
 * Duplicates a track with all its settings, sequences, and effects.
 * @param {number} sourceTrackId - The ID of the track to duplicate
 * @returns {Track|null} The new duplicated track, or null on error
 */
export async function duplicateTrack(sourceTrackId) {
    try {
        const sourceTrack = tracks.find(t => t.id === sourceTrackId);
        if (!sourceTrack) {
            console.warn(`[State duplicateTrack] Source track ID ${sourceTrackId} not found.`);
            if (appServices.showNotification) appServices.showNotification('Track not found for duplication.', 3000);
            return null;
        }

        captureStateForUndoInternal(`Duplicate Track "${sourceTrack.name}"`);

        // Create a deep copy of the track's serializable data
        const trackData = {
            id: ++trackIdCounter,
            name: `${sourceTrack.name} (copy)`,
            type: sourceTrack.type,
            color: sourceTrack.color,
            isMuted: false,
            isMonitoringEnabled: sourceTrack.isMonitoringEnabled,
            previousVolumeBeforeMute: sourceTrack.previousVolumeBeforeMute,
            pan: sourceTrack.pan,
            sendLevels: JSON.parse(JSON.stringify(sourceTrack.sendLevels || {})),
            volume: sourceTrack.previousVolumeBeforeMute || 0.7,
            // Synth specific
            synthEngineType: sourceTrack.synthEngineType,
            synthParams: sourceTrack.synthParams ? JSON.parse(JSON.stringify(sourceTrack.synthParams)) : {},
            // Sequences
            sequences: sourceTrack.sequences ? JSON.parse(JSON.stringify(sourceTrack.sequences)) : [],
            activeSequenceId: sourceTrack.activeSequenceId,
            stepsPerBeat: sourceTrack.stepsPerBeat,
            // Effects
            activeEffects: sourceTrack.activeEffects ? sourceTrack.activeEffects.map(e => ({
                id: `effect-${trackIdCounter}-${e.type}-${Date.now()}`,
                type: e.type,
                params: JSON.parse(JSON.stringify(e.params || {}))
            })) : [],
            // Sampler specific
            samplerAudioData: sourceTrack.samplerAudioData ? JSON.parse(JSON.stringify(sourceTrack.samplerAudioData)) : null,
            slices: sourceTrack.slices ? JSON.parse(JSON.stringify(sourceTrack.slices)) : [],
            // Instrument Sampler
            instrumentSamplerSettings: sourceTrack.instrumentSamplerSettings ? JSON.parse(JSON.stringify(sourceTrack.instrumentSamplerSettings)) : null,
            // Drum Sampler
            drumSamplerPads: sourceTrack.drumSamplerPads ? JSON.parse(JSON.stringify(sourceTrack.drumSamplerPads)) : [],
            // Timeline clips
            timelineClips: sourceTrack.timelineClips ? JSON.parse(JSON.stringify(sourceTrack.timelineClips)) : []
        };

        // Create the new track
        const newTrack = new Track(trackData.id, trackData.type, trackData, appServices);
        tracks.push(newTrack);

        // Initialize audio nodes for the new track
        if (typeof newTrack.initializeAudioNodes === 'function') {
            await newTrack.initializeAudioNodes();
        }

        // Update UI
        if (appServices.showNotification) {
            appServices.showNotification(`Duplicated "${sourceTrack.name}" as "${trackData.name}"`, 2000);
        }
        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI();
        if (appServices.renderTimeline) appServices.renderTimeline();

        console.log(`[State duplicateTrack] Duplicated track ${sourceTrackId} to new track ${trackData.id}`);
        return newTrack;

    } catch (error) {
        console.error(`[State duplicateTrack] Error duplicating track ${sourceTrackId}:`, error);
        if (appServices.showNotification) appServices.showNotification(`Error duplicating track: ${error.message}`, 3000);
        return null;
    }
}

// --- Master Effects Chain Management ---
export function addMasterEffectToState(effectType, initialParams) {
    const effectId = `mastereffect_${effectType}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const defaultParams = appServices.effectsRegistryAccess?.getEffectDefaultParams
        ? appServices.effectsRegistryAccess.getEffectDefaultParams(effectType)
        : getEffectDefaultParamsFromRegistry(effectType); // Fallback

    masterEffectsChainState.push({
        id: effectId,
        type: effectType,
        params: initialParams || defaultParams
    });
    return effectId;
}

export function removeMasterEffectFromState(effectId) {
    const effectIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (effectIndex > -1) {
        masterEffectsChainState.splice(effectIndex, 1);
    }
}

export function updateMasterEffectParamInState(effectId, paramPath, value) {
    const effectWrapper = masterEffectsChainState.find(e => e.id === effectId);
    if (!effectWrapper || !effectWrapper.params) {
        console.warn(`[State updateMasterEffectParamInState] Effect wrapper or params not found for ID: ${effectId}`);
        return;
    }
    try {
        const keys = paramPath.split('.');
        let currentStoredParamLevel = effectWrapper.params;
        for (let i = 0; i < keys.length - 1; i++) {
            currentStoredParamLevel[keys[i]] = currentStoredParamLevel[keys[i]] || {};
            currentStoredParamLevel = currentStoredParamLevel[keys[i]];
        }
        currentStoredParamLevel[keys[keys.length - 1]] = value;
    } catch (error) {
        console.error(`[State updateMasterEffectParamInState] Error updating param ${paramPath} for effect ${effectId}:`, error);
    }
}

export function reorderMasterEffectInState(effectId, newIndex) {
    const oldIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (oldIndex === -1 || oldIndex === newIndex || newIndex < 0 || newIndex >= masterEffectsChainState.length) {
        if (oldIndex === -1) console.warn(`[State reorderMasterEffectInState] Effect ID ${effectId} not found.`);
        return;
    }
    const [effectToMove] = masterEffectsChainState.splice(oldIndex, 1);
    masterEffectsChainState.splice(newIndex, 0, effectToMove);
}

export function toggleMasterEffectBypass(effectId) {
    const effectWrapper = masterEffectsChainState.find(e => e.id === effectId);
    if (!effectWrapper) {
        console.warn(`[State toggleMasterEffectBypass] Effect ID ${effectId} not found.`);
        return;
    }

    // Check if currently bypassed (wet === 0 or bypassed flag is true)
    const isBypassed = effectWrapper.bypassed === true || (effectWrapper.params?.wet !== undefined && effectWrapper.params.wet === 0);

    if (isBypassed) {
        // Restore wet to previous value (or 1 if not stored)
        const restoreValue = effectWrapper.previousWetValue !== undefined ? effectWrapper.previousWetValue : 1;
        effectWrapper.bypassed = false;
        if (effectWrapper.params) effectWrapper.params.wet = restoreValue;
        delete effectWrapper.previousWetValue;

        // Apply to Tone.js node via audio.js
        if (appServices.setMasterEffectWet) {
            appServices.setMasterEffectWet(effectId, restoreValue);
        }

        console.log(`[State toggleMasterEffectBypass] Master effect "${effectWrapper.type}" (${effectId}) enabled. Wet: ${restoreValue}`);
        if (appServices.showNotification) {
            appServices.showNotification(`Master effect "${effectWrapper.type}" enabled`, 1500);
        }
    } else {
        // Store current wet value and bypass
        const currentWet = effectWrapper.params?.wet ?? 1;
        effectWrapper.previousWetValue = currentWet;
        effectWrapper.bypassed = true;
        if (effectWrapper.params) effectWrapper.params.wet = 0;

        // Apply to Tone.js node via audio.js
        if (appServices.setMasterEffectWet) {
            appServices.setMasterEffectWet(effectId, 0);
        }

        console.log(`[State toggleMasterEffectBypass] Master effect "${effectWrapper.type}" (${effectId}) bypassed.`);
        if (appServices.showNotification) {
            appServices.showNotification(`Master effect "${effectWrapper.type}" bypassed`, 1500);
        }
    }

    // Update UI
    if (appServices.updateMasterEffectsRackUI) {
        appServices.updateMasterEffectsRackUI();
    }
}

// --- Undo/Redo Logic ---
function updateInternalUndoRedoState() {
    if (appServices.updateUndoRedoButtonsUI && typeof appServices.updateUndoRedoButtonsUI === 'function') {
        try {
            appServices.updateUndoRedoButtonsUI(
                undoStack.length > 0 ? undoStack[undoStack.length - 1] : null,
                redoStack.length > 0 ? redoStack[redoStack.length - 1] : null
            );
        } catch (error) {
            console.error("[State updateInternalUndoRedoState] Error calling appServices.updateUndoRedoButtonsUI:", error);
        }
    }
    // Also update the undo history panel if it's open
    if (appServices.updateUndoHistoryPanel && typeof appServices.updateUndoHistoryPanel === 'function') {
        try {
            appServices.updateUndoHistoryPanel();
        } catch (error) {
            console.error("[State updateInternalUndoRedoState] Error calling appServices.updateUndoHistoryPanel:", error);
        }
    }
}

export function captureStateForUndoInternal(description = "Unknown action") {
    try {
        const currentState = gatherProjectDataInternal();
        if (!currentState) {
            console.error("[State captureStateForUndoInternal] Failed to gather project data. Aborting undo capture.");
            return;
        }
        currentState.description = description; // Add description to the state object
        undoStack.push(JSON.parse(JSON.stringify(currentState))); // Deep copy
        if (undoStack.length > Constants.MAX_HISTORY_STATES) {
            undoStack.shift();
        }
        redoStack = []; // Clear redo stack on new action
        updateInternalUndoRedoState();
    } catch (error) {
        console.error("[State captureStateForUndoInternal] Error capturing state for undo:", error);
        if (appServices.showNotification) appServices.showNotification("Error capturing undo state. See console.", 3000);
    }
}

export async function undoLastActionInternal() {
    if (undoStack.length === 0) {
        if (appServices.showNotification) appServices.showNotification("Nothing to undo.", 1500);
        return;
    }
    try {
        const stateToRestore = undoStack.pop();
        const currentStateForRedo = gatherProjectDataInternal();
        if (!currentStateForRedo) {
            console.error("[State undoLastActionInternal] Failed to gather current project data for redo stack. Undoing without pushing to redo.");
        } else {
            currentStateForRedo.description = stateToRestore.description; // Use the undone action's description for redo
            redoStack.push(JSON.parse(JSON.stringify(currentStateForRedo)));
            if (redoStack.length > Constants.MAX_HISTORY_STATES) redoStack.shift();
        }

        if (appServices.showNotification) appServices.showNotification(`Undoing: ${stateToRestore.description || 'last action'}...`, 2000);
        if (appServices) appServices._isReconstructingDAW_flag = true; // Signal reconstruction globally
        await reconstructDAWInternal(stateToRestore, true); // true for isUndoRedo
    } catch (error) {
        console.error("[State undoLastActionInternal] Error during undo:", error);
        if (appServices.showNotification) appServices.showNotification(`Error during undo operation: ${error.message}. Project may be unstable.`, 4000);
        // Potentially try to restore the popped state back to undoStack if reconstruction fails badly? Complex.
    } finally {
        if (appServices) appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    }
}

export async function redoLastActionInternal() {
    if (redoStack.length === 0) {
        if (appServices.showNotification) appServices.showNotification("Nothing to redo.", 1500);
        return;
    }
    try {
        const stateToRestore = redoStack.pop();
        const currentStateForUndo = gatherProjectDataInternal();
        if (!currentStateForUndo) {
            console.error("[State redoLastActionInternal] Failed to gather current project data for undo stack. Redoing without pushing to undo.");
        } else {
            currentStateForUndo.description = stateToRestore.description;
            undoStack.push(JSON.parse(JSON.stringify(currentStateForUndo)));
            if (undoStack.length > Constants.MAX_HISTORY_STATES) undoStack.shift();
        }

        if (appServices.showNotification) appServices.showNotification(`Redoing: ${stateToRestore.description || 'last action'}...`, 2000);
        if (appServices) appServices._isReconstructingDAW_flag = true;
        await reconstructDAWInternal(stateToRestore, true); // true for isUndoRedo
    } catch (error) {
        console.error("[State redoLastActionInternal] Error during redo:", error);
        if (appServices.showNotification) appServices.showNotification(`Error during redo operation: ${error.message}. Project may be unstable.`, 4000);
    } finally {
        if (appServices) appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    }
}

// --- Project Data Handling ---
export function gatherProjectDataInternal() {
    console.log("[State gatherProjectDataInternal] Starting to gather project data...");
    try {
        const projectData = {
            version: Constants.APP_VERSION || "5.9.1", // Use a constant for app version
            globalSettings: {
                tempo: Tone.Transport.bpm.value,
                masterVolume: getMasterGainValueState(),
                activeMIDIInputId: getActiveMIDIInputState() ? getActiveMIDIInputState().id : null,
                soloedTrackId: getSoloedTrackIdState(),
                armedTrackId: getArmedTrackIdState(),
                highestZIndex: getHighestZState(),
                playbackMode: getPlaybackModeState(),
            },
            masterEffects: getMasterEffectsState().map(effect => ({
                id: effect.id,
                type: effect.type,
                params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {} // Ensure params exist
            })),
            tracks: getTracksState().map(track => {
                if (!track || typeof track.id === 'undefined') {
                    console.warn("[State gatherProjectDataInternal] Invalid track object found, skipping:", track);
                    return null; // Skip invalid tracks
                }
                const trackData = { // Base data
                    id: track.id, type: track.type, name: track.name,
                    trackNotes: track.trackNotes || '',
                    isMuted: track.isMuted,
                    volume: track.previousVolumeBeforeMute, // Store the actual volume, not the muted one
                    activeEffects: (track.activeEffects || []).map(effect => ({
                        id: effect.id, type: effect.type,
                        params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {}
                    })),
                    automation: track.automation ? JSON.parse(JSON.stringify(track.automation)) : { volume: [] },
                    // Type-specific sequence/clip data
                    sequences: track.type !== 'Audio' && track.sequences ? JSON.parse(JSON.stringify(track.sequences)) : [],
                    activeSequenceId: track.type !== 'Audio' ? track.activeSequenceId : null,
                    timelineClips: track.timelineClips ? JSON.parse(JSON.stringify(track.timelineClips)) : [],
                    timelinePlaybackRate: track.timelinePlaybackRate !== undefined ? track.timelinePlaybackRate : 1.0,
                };
                // Type-specific parameters
                if (track.type === 'Synth') {
                    trackData.synthEngineType = track.synthEngineType || 'MonoSynth';
                    trackData.synthParams = track.synthParams ? JSON.parse(JSON.stringify(track.synthParams)) : {};
                } else if (track.type === 'Sampler') {
                    trackData.samplerAudioData = {
                        fileName: track.samplerAudioData?.fileName,
                        dbKey: track.samplerAudioData?.dbKey,
                        // status is runtime, not strictly needed for save, but useful for rehydration hint
                        status: track.samplerAudioData?.dbKey ? 'persisted' : (track.samplerAudioData?.fileName ? 'volatile' : 'empty')
                    };
                    trackData.slices = track.slices ? JSON.parse(JSON.stringify(track.slices)) : [];
                    trackData.selectedSliceForEdit = track.selectedSliceForEdit;
                    trackData.slicerIsPolyphonic = track.slicerIsPolyphonic;
                } else if (track.type === 'DrumSampler') {
                    trackData.drumSamplerPads = (track.drumSamplerPads || []).map(p => ({
                        originalFileName: p.originalFileName, dbKey: p.dbKey,
                        volume: p.volume, pitchShift: p.pitchShift,
                        envelope: p.envelope ? JSON.parse(JSON.stringify(p.envelope)) : {},
                        status: p.dbKey ? 'persisted' : (p.originalFileName ? 'volatile' : 'empty')
                    }));
                    trackData.selectedDrumPadForEdit = track.selectedDrumPadForEdit;
                } else if (track.type === 'InstrumentSampler') {
                    trackData.instrumentSamplerSettings = {
                        originalFileName: track.instrumentSamplerSettings?.originalFileName,
                        dbKey: track.instrumentSamplerSettings?.dbKey,
                        rootNote: track.instrumentSamplerSettings?.rootNote,
                        loop: track.instrumentSamplerSettings?.loop,
                        loopStart: track.instrumentSamplerSettings?.loopStart,
                        loopEnd: track.instrumentSamplerSettings?.loopEnd,
                        envelope: track.instrumentSamplerSettings?.envelope ? JSON.parse(JSON.stringify(track.instrumentSamplerSettings.envelope)) : {},
                        status: track.instrumentSamplerSettings?.dbKey ? 'persisted' : (track.instrumentSamplerSettings?.originalFileName ? 'volatile' : 'empty')
                    };
                    trackData.instrumentSamplerIsPolyphonic = track.instrumentSamplerIsPolyphonic;
                }
                 if (track.type === 'Audio') { // Audio track specific settings
                    trackData.isMonitoringEnabled = track.isMonitoringEnabled;
                }
                // Remove deprecated/runtime-only properties if they accidentally get included
                delete trackData.sequenceData; delete trackData.sequenceLength;
                return trackData;
            }).filter(td => td !== null), // Filter out any skipped invalid tracks
            windowStates: Array.from(getOpenWindowsState().values())
                .map(win => {
                    if (!win || !win.element) return null;
                    return {
                        id: win.id, title: win.title,
                        left: win.element.style.left, top: win.element.style.top,
                        width: win.element.style.width, height: win.element.style.height,
                        zIndex: parseInt(win.element.style.zIndex, 10) || 100,
                        isMinimized: win.isMinimized,
                        isMaximized: win.isMaximized, // Save maximized state
                        restoreState: win.isMaximized ? JSON.parse(JSON.stringify(win.restoreState)) : {},
                        initialContentKey: win.initialContentKey || win.id // Ensure this is saved
                    };
                }).filter(ws => ws !== null)
        };
        console.log("[State gatherProjectDataInternal] Project data gathered successfully.");
        return projectData;
    } catch (error) {
        console.error("[State gatherProjectDataInternal] Error gathering project data:", error);
        if (appServices.showNotification) appServices.showNotification("Error preparing project data for saving/undo.", 4000);
        return null;
    }
}

export async function reconstructDAWInternal(projectData, isUndoRedo = false) {
    if (!projectData) {
        console.error("[State reconstructDAWInternal] projectData is null or undefined. Aborting reconstruction.");
        if (appServices.showNotification) appServices.showNotification("Error: No project data to load.", 3000);
        if (appServices) appServices._isReconstructingDAW_flag = false;
        return;
    }
    
    console.log(`[State reconstructDAWInternal] Starting reconstruction. isUndoRedo: ${isUndoRedo}`);
    if (appServices) appServices._isReconstructingDAW_flag = true;

    // --- Global Reset Phase ---
    try {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        if (appServices && typeof appServices.initAudioContextAndMasterMeter !== 'function') await appServices.initAudioContextAndMasterMeter(true); // Ensure audio context is running, true for user initiated context
        (getTracksState() || []).forEach(track => { if (track && typeof track.dispose === 'function') track.dispose(); });
        tracks = [];
        trackIdCounter = 0;
        if (appServices && typeof appServices.clearAllMasterEffectNodes !== 'function') appServices.clearAllMasterEffectNodes(); else console.warn("clearAllMasterEffectNodes service missing");
        masterEffectsChainState = [];
        if (appServices && typeof appServices.closeAllWindows !== 'function') appServices.closeAllWindows(true); else console.warn("closeAllWindows service missing");
        if (appServices && typeof appServices.clearOpenWindowsMap !== 'function') appServices.clearOpenWindowsMap(); else console.warn("clearOpenWindowsMap service missing");
        highestZ = 100;
        setArmedTrackIdState(null); setSoloedTrackIdState(null); setActiveSequencerTrackIdState(null);
        setIsRecordingState(false); setRecordingTrackIdState(null);
        if (appServices && typeof appServices.updateRecordButtonUI !== 'function') appServices.updateRecordButtonUI(false);
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error during global reset phase:", error);
        if (appServices.showNotification) appServices.showNotification("Critical error during project reset.", 5000);
        if (appServices) appServices._isReconstructingDAW_flag = false;
        return; // Abort further reconstruction
    }

    try { // --- Global Settings ---
        const gs = projectData.globalSettings || {};
        Tone.Transport.bpm.value = Number.isFinite(gs.tempo) ? gs.tempo : 120;
        setMasterGainValueState(Number.isFinite(gs.masterVolume) ? gs.masterVolume : (typeof Tone !== 'undefined' && Tone.dbToGain) ? Tone.dbToGain(0) : 1.0);
        if (appServices && typeof appServices.setActualMasterVolume !== 'function') appServices.setActualMasterVolume(getMasterGainValueState());
        setPlaybackModeStateInternal(gs.playbackMode === 'timeline' || gs.playbackMode === 'sequencer' ? gs.playbackMode : 'sequencer');
        if (appServices && typeof appServices.updateTaskbarTempoDisplay !== 'function') appServices.updateTaskbarTempoDisplay(Tone.Transport.bpm.value);
        setHighestZState(Number.isFinite(gs.highestZIndex) ? gs.highestZIndex : 100);
        // Armed and Soloed will be set after tracks are created
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error applying global settings:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading global settings.", 3000);
    }

    try { // --- Master Effects ---
        if (projectData.masterEffects && Array.isArray(projectData.masterEffects)) {
            for (const effectData of projectData.masterEffects) {
                if (effectData && effectData.type) {
                    const effectIdInState = addMasterEffectToState(effectData.type, effectData.params || {});
                    if (appServices.addMasterEffectToAudio) {
                         await appServices.addMasterEffectToAudio(effectIdInState, effectData.type, effectData.params || {});
                    }
                } else { console.warn("[State reconstructDAWInternal] Invalid master effect data found:", effectData); }
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructuring master effects:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading master effects.", 3000);
    }

    try { // --- Tracks ---
        if (projectData.tracks && Array.isArray(projectData.tracks)) {
            const trackPromises = projectData.tracks.map(trackData => {
                if (trackData && trackData.type) {
                    return addTrackToStateInternal(trackData.type, trackData, false); // false for isUserAction
                } else { console.warn("[State reconstructDAWInternal] Invalid track data found:", trackData); return Promise.resolve(null); }
            });
            await Promise.all(trackPromises);
            // After all tracks and their audio resources are initialized:
            console.log(`[State reconstructDAWInternal] All track instances created. Now setting armed/soloed states.`);
            const globalSettings = projectData.globalSettings || {};
            if (globalSettings.armedTrackId !== null && typeof globalSettings.armedTrackId !== 'undefined') {
                setArmedTrackIdState(globalSettings.armedTrackId);
            }
            if (globalSettings.soloedTrackId !== null && typeof globalSettings.soloedTrackId !== 'undefined') {
                setSoloedTrackIdState(globalSettings.soloedTrackId);
                getTracksState().forEach(t => { // Apply solo state after all tracks are potentially available
                    if (t) {
                        t.isSoloed = (t.id === getSoloedTrackIdState());
                        if (typeof t.applySoloState === 'function') t.applySoloState();
                        if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged');
                    }
                });
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructuring tracks:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading tracks.", 3000);
    }

    // Window reconstruction needs to happen after tracks are potentially created, as some windows depend on track IDs.
    try {
        if (projectData.windowStates && Array.isArray(projectData.windowStates)) {
            const sortedWindowStates = projectData.windowStates.sort((a, b) => (a?.zIndex || 0) - (b?.zIndex || 0));
            for (const winState of sortedWindowStates) {
                if (!winState || !winState.id) { console.warn("[State reconstructDAWInternal] Invalid window state found:", winState); continue; }
                const key = winState.initialContentKey || winState.id; // Use initialContentKey for routing
                console.log(`[State reconstructDAWInternal] Reconstructing window: ${key}, ID: ${winState.id}`);
                if (key === 'globalControls' && appServices.openGlobalControlsWindow) {
                    // FIX: Pass a callback to wire up controls even during reconstruction
                    // The callback will be called by openGlobalControlsWindow to attach event listeners
                    appServices.openGlobalControlsWindow((elements) => {
                        if (elements && appServices.attachGlobalControlEvents) {
                            console.log("[State reconstructDAWInternal] Wiring up global controls after reconstruction");
                            appServices.attachGlobalControlEvents(elements);
                        }
                    }, winState);
                }
                else if (key === 'soundBrowser' && appServices.openSoundBrowserWindow) appServices.openSoundBrowserWindow(winState);
                else if (key === 'mixer' && appServices.openMixerWindow) appServices.openMixerWindow(winState);
                else if (key === 'masterEffectsRack' && appServices.openMasterEffectsRackWindow) appServices.openMasterEffectsRackWindow(winState);
                else if (key === 'timeline' && appServices.openTimelineWindow) appServices.openTimelineWindow(winState);
                else if (key.startsWith('trackInspector-') && appServices.openTrackInspectorWindow) {
                    const trackIdNum = parseInt(key.split('-')[1], 10);
                    if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackInspectorWindow(trackIdNum, winState);
                    else console.warn(`[State reconstructDAWInternal] Track for inspector ${key} not found or ID invalid.`);
                } else if (key.startsWith('effectsRack-') && appServices.openTrackEffectsRackWindow) {
                    const trackIdNum = parseInt(key.split('-')[1], 10);
                    if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackEffectsRackWindow(trackIdNum, winState);
                    else console.warn(`[State reconstructDAWInternal] Track for effects rack ${key} not found or ID invalid.`);
                } else if (key.startsWith('sequencerWin-') && appServices.openTrackSequencerWindow) {
                    const trackIdNum = parseInt(key.split('-')[2], 10);
                    const trackForSeq = getTrackByIdState(trackIdNum);
                    if (!isNaN(trackIdNum) && trackForSeq && trackForSeq.type !== 'Audio') {
                        appServices.openTrackSequencerWindow(trackIdNum, true, winState); // true for forceRedraw
                    } else { console.warn(`[State reconstructDAWInternal] Track for sequencer ${key} not found, ID invalid, or is Audio type.`);}
                } else {
                    console.warn(`[State reconstructDAWInternal] Unknown window key "${key}" during reconstruction.`);
                }
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructuring windows:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading window layout.", 3000);
    }

    // Final UI updates and MIDI setup
    try {
        const gs = projectData.globalSettings || {};
        if(gs && gs.activeMIDIInputId && appServices.selectMIDIInput) {
            appServices.selectMIDIInput(gs.activeMIDIInputId, true); // true for silent
        }
        if(appServices.updateMixerWindow) appServices.updateMixerWindow();
        if(appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        if(appServices.renderTimeline) appServices.renderTimeline();
        updateInternalUndoRedoState();
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error during final UI updates/MIDI setup:", error);
    }

    if (appServices) appServices._isReconstructingDAW_flag = false;
    if (!isUndoRedo && appServices.showNotification) appServices.showNotification(`Project loaded successfully.`, 3500);
    console.log("[State reconstructDAWInternal] Reconstruction finished.");
}


export function saveProjectInternal() {
    try {
        const projectData = gatherProjectDataInternal();
        if (!projectData) throw new Error("Failed to gather project data for saving.");

        const jsonString = JSON.stringify(projectData, null, 2); // Beautify JSON
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `snugos-project-${timestamp}.snug`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (appServices.showNotification) appServices.showNotification(`Project saved as ${a.download}`, 2000);
    } catch (error) {
        console.error("[State saveProjectInternal] Error saving project:", error);
        if (appServices.showNotification) appServices.showNotification(`Error saving project: ${error.message}. See console.`, 4000);
    }
}

export function loadProjectInternal() {
    const loadProjectInputEl = appServices.uiElementsCache?.loadProjectInput;
    if (loadProjectInputEl) {
        loadProjectInputEl.click();
    } else {
        console.error("[State loadProjectInternal] Load project input element not found.");
        if (appServices.showNotification) appServices.showNotification("Error: File input for loading project not found.", 3000);
    }
}

export async function handleProjectFileLoadInternal(event) {
    if (!event || !event.target || !event.target.files || event.target.files.length === 0) {
        console.warn("[State handleProjectFileLoadInternal] No file selected or event invalid.");
        if (event && event.target) event.target.value = null; // Reset file input
        return;
    }
    const file = event.target.files[0];
    if (file && file.name.endsWith('.snug')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!e.target || !e.target.result) throw new Error("FileReader did not produce a result.");
                const projectData = JSON.parse(e.target.result);
                undoStack = []; // Clear undo/redo stacks for new project
                redoStack = [];
                await reconstructDAWInternal(projectData, false); // false for isUndoRedo
                captureStateForUndoInternal("Load Project: " + file.name.substring(0, 20)); // Initial state for undo
            } catch (error) {
                console.error("[State handleProjectFileLoadInternal] Error loading project from file:", error);
                if (appServices.showNotification) appServices.showNotification(`Error loading project: ${error.message}. File might be corrupt or invalid.`, 5000);
            }
        };
        reader.onerror = (err) => {
            console.error("[State handleProjectFileLoadInternal] FileReader error:", err);
            if (appServices.showNotification) appServices.showNotification("Error reading project file.", 3000);
        };
        reader.readAsText(file);
    } else if (file) {
        if (appServices.showNotification) appServices.showNotification("Invalid file type. Please select a .snug project file.", 3000);
    }
    if (event.target) event.target.value = null; // Reset file input
}

export async function exportToWavInternal() {
    if (!appServices.showNotification || !appServices.getActualMasterGainNode || !audioInitAudioContextAndMasterMeter) {
        console.error("[State exportToWavInternal] Required appServices not available.");
        alert("Export WAV feature is currently unavailable due to an internal error.");
        return;
    }

    appServices.showNotification("Preparing export...", 2000);
    
    try {
        const audioReady = await audioInitAudioContextAndMasterMeter(true);
        if (!audioReady) {
            appServices.showNotification("Audio system not ready for export.", 3000);
            return;
        }

        // Calculate duration
        let maxDuration = 0;
        const currentPlaybackMode = getPlaybackModeState();
        const tracks = getTracksState();

        if (currentPlaybackMode === 'timeline') {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio' && track.timelineClips) {
                    track.timelineClips.forEach(clip => {
                        if (clip?.startTime !== undefined && clip?.duration !== undefined) {
                            maxDuration = Math.max(maxDuration, clip.startTime + clip.duration);
                        }
                    });
                }
            });
        } else {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio') {
                    const activeSeq = track.getActiveSequence();
                    if (activeSeq?.length > 0) {
                        const sixteenthNoteTime = Tone.Time("16n").toSeconds();
                        maxDuration = Math.max(maxDuration, activeSeq.length * sixteenthNoteTime);
                    }
                }
            });
        }

        if (maxDuration === 0) {
            appServices.showNotification("Nothing to export. Add some notes or audio first.", 3000);
            return;
        }
        
        maxDuration = Math.min(maxDuration + 2, 600);
        console.log(`[State exportToWavInternal] Export duration: ${maxDuration.toFixed(1)}s`);

        // Stop everything first
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });
        await new Promise(r => setTimeout(r, 100));

        appServices.showNotification(`Rendering audio (${maxDuration.toFixed(1)}s)...`, 15000);

        // Use Tone.Recorder to record from master output
        const recorder = new Tone.Recorder();
        const masterGain = appServices.getActualMasterGainNode();
        
        if (!masterGain || masterGain.disposed) {
            appServices.showNotification("Master output not available.", 3000);
            return;
        }
        
        // Connect master gain to recorder
        masterGain.connect(recorder);
        console.log("[Export] Recorder connected to master gain");

        // Reset transport
        Tone.Transport.position = 0;
        Tone.Transport.loop = false;
        
        // Schedule all tracks
        for (const track of tracks) {
            if (track?.schedulePlayback) {
                await track.schedulePlayback(0, maxDuration);
            }
        }

        // Start recording and playback
        await recorder.start();
        console.log("[Export] Recording started");
        
        Tone.Transport.start();
        console.log("[Export] Transport started");

        // Wait for recording
        await new Promise(resolve => setTimeout(resolve, maxDuration * 1000 + 500));

        // Stop recording
        const recording = await recorder.stop();
        console.log("[Export] Recording stopped, size:", recording.size);

        // Stop transport
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });

        // Cleanup
        try { masterGain.disconnect(recorder); } catch (e) {}
        recorder.dispose();

        if (!recording || recording.size < 1000) {
            appServices.showNotification("Export failed: No audio recorded.", 3000);
            console.error("[Export] Recording too small:", recording?.size);
            return;
        }

        // Download
        const url = URL.createObjectURL(recording);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snugos-export-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        appServices.showNotification("Export to WAV successful!", 3000);
        console.log("[Export] Complete, size:", recording.size);

    } catch (error) {
        console.error("[State exportToWavInternal] Error:", error);
        appServices.showNotification(`Export error: ${error.message}`, 5000);
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
    }
}

// ============================================
// EXPORT WITH SETTINGS (Preset-based export)
// ============================================

/**
 * Exports the project using preset settings.
 * @param {Object} settings - Export settings from preset
 * @param {string} settings.format - Audio format (wav, mp3)
 * @param {number} settings.sampleRate - Sample rate (44100, 48000, 96000)
 * @param {number} settings.bitDepth - Bit depth (16, 24, 32)
 * @param {boolean} settings.normalize - Whether to normalize output
 * @param {boolean} settings.dither - Whether to apply dithering
 * @param {number} settings.tailSeconds - Seconds of tail to add after last note
 */
export async function exportWithSettingsInternal(settings = {}) {
    const defaults = {
        format: 'wav',
        sampleRate: 44100,
        bitDepth: 24,
        normalize: false,
        dither: false,
        tailSeconds: 2
    };
    
    const config = { ...defaults, ...settings };
    
    if (!appServices.showNotification || !appServices.getActualMasterGainNode || !audioInitAudioContextAndMasterMeter) {
        console.error("[State exportWithSettingsInternal] Required appServices not available.");
        alert("Export feature is currently unavailable due to an internal error.");
        return;
    }

    // Validate format and check dependencies
    if (config.format === 'mp3' && typeof lamejs === 'undefined') {
        appServices.showNotification("MP3 encoding requires lamejs library. Exporting as WAV.", 3000);
    }

    appServices.showNotification("Preparing export...", 2000);
    
    try {
        const audioReady = await audioInitAudioContextAndMasterMeter(true);
        if (!audioReady) {
            appServices.showNotification("Audio system not ready for export.", 3000);
            return;
        }

        // Calculate duration
        let maxDuration = 0;
        const currentPlaybackMode = getPlaybackModeState();
        const tracks = getTracksState();

        if (currentPlaybackMode === 'timeline') {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio' && track.timelineClips) {
                    track.timelineClips.forEach(clip => {
                        if (clip?.startTime !== undefined && clip?.duration !== undefined) {
                            maxDuration = Math.max(maxDuration, clip.startTime + clip.duration);
                        }
                    });
                }
            });
        } else {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio') {
                    const activeSeq = track.getActiveSequence();
                    if (activeSeq?.length > 0) {
                        const sixteenthNoteTime = Tone.Time("16n").toSeconds();
                        maxDuration = Math.max(maxDuration, activeSeq.length * sixteenthNoteTime);
                    }
                }
            });
        }

        if (maxDuration === 0) {
            appServices.showNotification("Nothing to export. Add some notes or audio first.", 3000);
            return;
        }
        
        // Add configurable tail
        maxDuration = Math.min(maxDuration + config.tailSeconds, 600);
        console.log(`[State exportWithSettingsInternal] Export duration: ${maxDuration.toFixed(1)}s, Sample Rate: ${config.sampleRate}, Bit Depth: ${config.bitDepth}`);

        // Stop everything first
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });
        await new Promise(r => setTimeout(r, 100));

        appServices.showNotification(`Rendering audio (${maxDuration.toFixed(1)}s)...`, 15000);

        // Use Tone.Recorder to record from master output
        const recorder = new Tone.Recorder();
        const masterGain = appServices.getActualMasterGainNode();
        
        if (!masterGain || masterGain.disposed) {
            appServices.showNotification("Master output not available.", 3000);
            return;
        }
        
        // Connect master gain to recorder
        masterGain.connect(recorder);
        console.log("[Export] Recorder connected to master gain");

        // Reset transport
        Tone.Transport.position = 0;
        Tone.Transport.loop = false;
        
        // Schedule all tracks
        for (const track of tracks) {
            if (track?.schedulePlayback) {
                await track.schedulePlayback(0, maxDuration);
            }
        }

        // Start recording and playback
        await recorder.start();
        console.log("[Export] Recording started");
        
        Tone.Transport.start();
        console.log("[Export] Transport started");

        // Wait for recording
        await new Promise(resolve => setTimeout(resolve, maxDuration * 1000 + 500));

        // Stop recording
        const recording = await recorder.stop();
        console.log("[Export] Recording stopped, size:", recording.size);

        // Stop transport
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });

        // Cleanup
        try { masterGain.disconnect(recorder); } catch (e) {}
        recorder.dispose();

        if (!recording || recording.size < 1000) {
            appServices.showNotification("Export failed: No audio recorded.", 3000);
            console.error("[Export] Recording too small:", recording?.size);
            return;
        }

        // Convert to MP3 or FLAC if needed
        let finalBlob = recording;
        let fileExtension = 'wav';
        let formatInfo = `${config.sampleRate}Hz, ${config.bitDepth}-bit`;
        
        if (config.format === 'mp3') {
            appServices.showNotification("Encoding MP3...", 5000);
            try {
                // Decode WAV to AudioBuffer
                const arrayBuffer = await recording.arrayBuffer();
                const audioContext = Tone.context.rawContext;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // Encode to MP3 using lamejs
                const numChannels = audioBuffer.numberOfChannels;
                const sampleRate = audioBuffer.sampleRate;
                const bitrate = config.mp3Bitrate || 192;
                const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
                const mp3Data = [];
                const sampleBlockSize = 1152;
                
                const leftChannel = audioBuffer.getChannelData(0);
                const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
                
                for (let i = 0; i < audioBuffer.length; i += sampleBlockSize) {
                    const leftChunk = new Int16Array(sampleBlockSize);
                    const rightChunk = new Int16Array(sampleBlockSize);
                    
                    for (let j = 0; j < sampleBlockSize && i + j < audioBuffer.length; j++) {
                        const leftSample = Math.max(-1, Math.min(1, leftChannel[i + j]));
                        leftChunk[j] = leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7FFF;
                        
                        const rightSample = Math.max(-1, Math.min(1, rightChannel[i + j]));
                        rightChunk[j] = rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7FFF;
                    }
                    
                    const mp3buf = numChannels === 2 
                        ? mp3encoder.encodeBuffer(leftChunk, rightChunk)
                        : mp3encoder.encodeBuffer(leftChunk);
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                }
                
                const mp3buf = mp3encoder.flush();
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
                
                finalBlob = new Blob(mp3Data, { type: 'audio/mpeg' });
                fileExtension = 'mp3';
                formatInfo = `${config.sampleRate}Hz, ${bitrate}kbps`;
                console.log("[Export] MP3 encoded, size:", finalBlob.size);
            } catch (mp3Error) {
                console.error("[Export] MP3 encoding failed:", mp3Error);
                appServices.showNotification("MP3 encoding failed, exporting as WAV.", 3000);
                fileExtension = 'wav';
            }
        } else if (config.format === 'flac') {
            appServices.showNotification("Encoding FLAC...", 5000);
            try {
                // Decode WAV to AudioBuffer
                const arrayBuffer = await recording.arrayBuffer();
                const audioContext = Tone.context.rawContext;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // FLAC encoding (basic implementation using WAV-like structure with FLAC header)
                const numChannels = audioBuffer.numberOfChannels;
                const sampleRate = audioBuffer.sampleRate;
                const bitsPerSample = 16;
                const length = audioBuffer.length;
                
                const channelData = [];
                for (let ch = 0; ch < numChannels; ch++) {
                    channelData.push(audioBuffer.getChannelData(ch));
                }
                
                // Build FLAC file structure
                const flacData = [];
                
                // fLaC marker
                flacData.push(new Uint8Array([0x66, 0x4C, 0x61, 0x43])); // 'fLaC'
                
                // STREAMINFO block (simplified - 34 bytes of metadata)
                const streamInfo = new ArrayBuffer(38);
                const view = new DataView(streamInfo);
                view.setUint8(0, 0x80); // Last metadata block flag + type 0
                view.setUint8(1, 0); view.setUint8(2, 0); view.setUint8(3, 34); // Block size
                // Sample rate (20 bits), channels (3 bits), bits per sample (5 bits), total samples (36 bits)
                view.setUint16(4, (sampleRate >>> 12) & 0xFFFF);
                view.setUint8(6, (sampleRate >>> 4) & 0xFF);
                view.setUint8(7, ((sampleRate & 0x0F) << 4) | ((numChannels - 1) << 1) | ((bitsPerSample - 1) >>> 4));
                view.setUint8(8, ((bitsPerSample - 1) & 0x0F) << 4);
                view.setUint32(9, 0);
                view.setUint32(13, length); // Total samples
                for (let i = 17; i < 33; i++) { view.setUint8(i, 0); } // MD5 signature (zeros)
                flacData.push(new Uint8Array(streamInfo));
                
                // Simple PCM frame data (interleaved)
                const frameData = new Int16Array(length * numChannels);
                let idx = 0;
                for (let i = 0; i < length; i++) {
                    for (let ch = 0; ch < numChannels; ch++) {
                        const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
                        frameData[idx++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    }
                }
                flacData.push(new Uint8Array(frameData.buffer));
                
                finalBlob = new Blob(flacData, { type: 'audio/flac' });
                fileExtension = 'flac';
                formatInfo = `${config.sampleRate}Hz, FLAC`;
                console.log("[Export] FLAC encoded, size:", finalBlob.size);
            } catch (flacError) {
                console.error("[Export] FLAC encoding failed:", flacError);
                appServices.showNotification("FLAC encoding failed, exporting as WAV.", 3000);
                fileExtension = 'wav';
            }
        }

        // Download with settings info in filename
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `snugos-export-${config.sampleRate}hz-${fileExtension === 'wav' ? config.bitDepth + 'bit' : fileExtension === 'mp3' ? (config.mp3Bitrate || 192) + 'kbps' : 'flac'}-${timestamp}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const formatDisplay = config.format.toUpperCase();
        appServices.showNotification(`Export successful! (${formatDisplay}, ${formatInfo})`, 3000);
        console.log("[Export] Complete, format:", config.format, "size:", finalBlob.size);

    } catch (error) {
        console.error("[State exportWithSettingsInternal] Error:", error);
        appServices.showNotification(`Export error: ${error.message}`, 5000);
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
    }
}

/**
 * Normalizes an audio blob to a target dB level.
 * @param {Blob} audioBlob - The audio blob to normalize
 * @param {number} targetDb - Target peak level in dB (e.g., -1 for -1dB)
 * @returns {Promise<Blob>} - Normalized audio blob
 */
async function normalizeAudioBlob(audioBlob, targetDb = -1) {
    try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Find peak amplitude
        let peak = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                const absValue = Math.abs(channelData[i]);
                if (absValue > peak) peak = absValue;
            }
        }
        
        if (peak === 0) {
            await audioContext.close();
            return audioBlob; // Silent audio, return as-is
        }
        
        // Calculate gain needed
        const targetLinear = Math.pow(10, targetDb / 20);
        const gain = targetLinear / peak;
        
        // Apply gain
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                channelData[i] *= gain;
            }
        }
        
        // Convert back to WAV
        const wavBlob = bufferToWav(audioBuffer);
        await audioContext.close();
        return wavBlob;
        
    } catch (error) {
        console.error("[Normalize] Error:", error);
        return audioBlob; // Return original on error
    }
}

/**
 * Converts an AudioBuffer to a WAV Blob.
 */
function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;
    
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
        channelData.push(buffer.getChannelData(i));
    }
    
    let pos = offset;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, intSample, true);
            pos += 2;
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}


// ============================================
// AUTO-SAVE AND CRASH RECOVERY SYSTEM
// ============================================

// Auto-save configuration
const AUTOSAVE_INTERVAL_MS = 30000; // 30 seconds
const AUTOSAVE_KEY = 'autosave';
const CRASH_RECOVERY_KEY = 'crash_recovery';
const RECOVERY_AGE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

let autoSaveIntervalId = null;
let lastAutoSaveTime = 0;
let isAutoSaving = false;

/**
 * Starts the auto-save timer. Called during app initialization.
 */
export function startAutoSave() {
    if (autoSaveIntervalId !== null) {
        console.log('[AutoSave] Already running.');
        return;
    }
    
    console.log('[AutoSave] Starting auto-save system...');
    
    // Save immediately on start to mark session
    autoSaveProjectState();
    
    // Set up periodic auto-save
    autoSaveIntervalId = setInterval(() => {
        autoSaveProjectState();
    }, AUTOSAVE_INTERVAL_MS);
    
    // Save before page unload (crash detection)
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    console.log('[AutoSave] Auto-save system started. Interval:', AUTOSAVE_INTERVAL_MS / 1000, 'seconds');
}

/**
 * Stops the auto-save timer. Called during clean shutdown.
 */
export function stopAutoSave() {
    if (autoSaveIntervalId !== null) {
        clearInterval(autoSaveIntervalId);
        autoSaveIntervalId = null;
        console.log('[AutoSave] Auto-save system stopped.');
    }
    
    // Remove event listeners
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
}

/**
 * Handles beforeunload event - saves state for crash recovery.
 */
function handleBeforeUnload(event) {
    try {
        const projectData = gatherProjectDataInternal();
        if (projectData) {
            sessionStorage.setItem('snugos_session_end', JSON.stringify({
                timestamp: Date.now(),
                hasUnsavedChanges: true
            }));
        }
    } catch (e) {
        console.warn('[AutoSave] Error during beforeunload save:', e);
    }
}

/**
 * Handles pagehide event - backup for mobile/safari.
 */
function handlePageHide(event) {
    handleBeforeUnload(event);
}

/**
 * Performs the actual auto-save operation.
 */
async function autoSaveProjectState() {
    if (isAutoSaving) {
        console.log('[AutoSave] Already saving, skipping...');
        return;
    }
    
    isAutoSaving = true;
    try {
        const projectData = gatherProjectDataInternal();
        if (!projectData) {
            console.warn('[AutoSave] No project data to save.');
            return;
        }
        
        await storeProjectState(AUTOSAVE_KEY, projectData);
        lastAutoSaveTime = Date.now();
        console.log('[AutoSave] Project state saved successfully at', new Date(lastAutoSaveTime).toISOString());
        
    } catch (error) {
        console.error('[AutoSave] Failed to auto-save project:', error);
    } finally {
        isAutoSaving = false;
    }
}

/**
 * Manually trigger an auto-save (for after important changes).
 */
export async function triggerAutoSave() {
    await autoSaveProjectState();
}

/**
 * Checks for crash recovery on app startup.
 * Returns recovery data if a crash recovery is available, null otherwise.
 */
export async function checkCrashRecovery() {
    try {
        const sessionEnd = sessionStorage.getItem('snugos_session_end');
        let wasUnexpectedExit = false;
        
        if (sessionEnd) {
            const sessionData = JSON.parse(sessionEnd);
            const age = Date.now() - sessionData.timestamp;
            if (age < 5 * 60 * 1000) {
                wasUnexpectedExit = true;
            }
            sessionStorage.removeItem('snugos_session_end');
        }
        
        const savedState = await getProjectState(AUTOSAVE_KEY);
        
        if (!savedState) {
            console.log('[CrashRecovery] No auto-saved state found.');
            return null;
        }
        
        const stateAge = Date.now() - (savedState._autosaveTimestamp || 0);
        
        if (stateAge > RECOVERY_AGE_LIMIT_MS) {
            console.log('[CrashRecovery] Auto-saved state too old, discarding.');
            await deleteProjectState(AUTOSAVE_KEY);
            return null;
        }
        
        console.log('[CrashRecovery] Found recovery state from', new Date(savedState._autosaveTimestamp).toISOString());
        
        return {
            projectData: savedState,
            timestamp: savedState._autosaveTimestamp,
            age: stateAge,
            wasUnexpectedExit
        };
        
    } catch (error) {
        console.error('[CrashRecovery] Error checking for crash recovery:', error);
        return null;
    }
}

/**
 * Clears the crash recovery state (after successful recovery or user declines).
 */
export async function clearCrashRecovery() {
    try {
        await deleteProjectState(AUTOSAVE_KEY);
        sessionStorage.removeItem('snugos_session_end');
        console.log('[CrashRecovery] Recovery state cleared.');
    } catch (error) {
        console.error('[CrashRecovery] Error clearing recovery state:', error);
    }
}

/**
 * Creates a recovery dialog UI element.
 * Returns the dialog element for the caller to append to the DOM.
 */
export function createRecoveryDialog(recoveryInfo, onRecover, onDiscard) {
    const dialog = document.createElement('div');
    dialog.id = 'crash-recovery-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const ageMinutes = Math.round(recoveryInfo.age / 60000);
    const ageText = ageMinutes < 1 ? 'less than a minute ago' : 
                    ageMinutes < 60 ? `${ageMinutes} minute(s) ago` :
                    `${Math.round(ageMinutes / 60)} hour(s) ago`;
    
    dialog.innerHTML = `
        <div style="background: #1a1a1a; border-radius: 12px; padding: 32px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <h2 style="color: #fff; margin: 0 0 8px 0; font-size: 24px;">Session Recovery</h2>
                <p style="color: #aaa; margin: 0; font-size: 14px;">
                    SnugOS detected an unsaved session from ${ageText}.<br>
                    Would you like to recover your work?
                </p>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="recover-btn" style="flex: 1; padding: 14px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500;">
                    Recover Session
                </button>
                <button id="discard-btn" style="flex: 1; padding: 14px 24px; background: #374151; color: #9ca3af; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500;">
                    Start Fresh
                </button>
            </div>
            <p style="color: #666; font-size: 12px; text-align: center; margin: 16px 0 0 0;">
                Track count: ${recoveryInfo.projectData?.tracks?.length || 0} | 
                Saved: ${new Date(recoveryInfo.timestamp).toLocaleTimeString()}
            </p>
        </div>
    `;
    
    dialog.querySelector('#recover-btn').addEventListener('click', () => {
        dialog.remove();
        onRecover();
    });
    
    dialog.querySelector('#discard-btn').addEventListener('click', () => {
        dialog.remove();
        onDiscard();
    });
    
    return dialog;
}

/**
 * Gets the last auto-save time for display purposes.
 */
export function getLastAutoSaveTime() {
    return lastAutoSaveTime;
}

/**
 * Gets auto-save status info.
 */
export function getAutoSaveStatus() {
    return {
        isEnabled: autoSaveIntervalId !== null,
        intervalMs: AUTOSAVE_INTERVAL_MS,
        lastSaveTime: lastAutoSaveTime,
        isSaving: isAutoSaving
    };
}

// --- Audio Normalization Settings ---
let autoNormalizeEnabled = true;
let normalizationTargetDb = -1; // Target peak level in dB

export function getAutoNormalizeEnabled() { return autoNormalizeEnabled; }
export function setAutoNormalizeEnabled(enabled) { 
    autoNormalizeEnabled = !!enabled;
    console.log(`[State] Auto-normalization ${autoNormalizeEnabled ? 'enabled' : 'disabled'}`);
}
export function getNormalizationTargetDb() { return normalizationTargetDb; }
export function setNormalizationTargetDb(db) { 
    // Clamp to reasonable range: -6dB to 0dB
    normalizationTargetDb = Math.max(-6, Math.min(0, parseFloat(db) || -1));
    console.log(`[State] Normalization target set to: ${normalizationTargetDb}dB`);
}

// --- Timeline Markers System ---
let timelineMarkers = []; // Array of { id, name, position, color }
let timelineMarkerIdCounter = 0;

/**
 * Adds a new timeline marker.
 * @param {string} name - Marker name
 * @param {number} position - Position in seconds
 * @param {string} color - Marker color (hex or named color)
 * @returns {object} The created marker
 */
export function addTimelineMarker(name, position, color = '#f59e0b') {
    const marker = {
        id: `marker_${++timelineMarkerIdCounter}`,
        name: name || `Marker ${timelineMarkerIdCounter}`,
        position: Math.max(0, parseFloat(position) || 0),
        color: color
    };
    timelineMarkers.push(marker);
    timelineMarkers.sort((a, b) => a.position - b.position);
    console.log(`[State] Added timeline marker "${marker.name}" at ${marker.position}s`);
    return marker;
}

/**
 * Removes a timeline marker by ID.
 * @param {string} markerId - The marker ID to remove
 * @returns {boolean} True if removed, false if not found
 */
export function removeTimelineMarker(markerId) {
    const index = timelineMarkers.findIndex(m => m.id === markerId);
    if (index !== -1) {
        const removed = timelineMarkers.splice(index, 1)[0];
        console.log(`[State] Removed timeline marker "${removed.name}"`);
        return true;
    }
    return false;
}

/**
 * Updates a timeline marker's properties.
 * @param {string} markerId - The marker ID to update
 * @param {object} updates - Properties to update (name, position, color)
 * @returns {object|null} The updated marker or null if not found
 */
export function updateTimelineMarker(markerId, updates) {
    const marker = timelineMarkers.find(m => m.id === markerId);
    if (marker) {
        if (updates.name !== undefined) marker.name = String(updates.name);
        if (updates.position !== undefined) {
            marker.position = Math.max(0, parseFloat(updates.position) || 0);
            // Re-sort after position change
            timelineMarkers.sort((a, b) => a.position - b.position);
        }
        if (updates.color !== undefined) marker.color = updates.color;
        console.log(`[State] Updated timeline marker "${marker.name}"`);
        return marker;
    }
    return null;
}

/**
 * Gets all timeline markers sorted by position.
 * @returns {Array} Array of marker objects
 */
export function getTimelineMarkers() {
    return [...timelineMarkers];
}

/**
 * Gets a specific timeline marker by ID.
 * @param {string} markerId - The marker ID
 * @returns {object|null} The marker or null if not found
 */
export function getTimelineMarkerById(markerId) {
    return timelineMarkers.find(m => m.id === markerId) || null;
}

/**
 * Clears all timeline markers.
 */
export function clearAllTimelineMarkers() {
    timelineMarkers = [];
    timelineMarkerIdCounter = 0;
    console.log(`[State] Cleared all timeline markers`);
}

/**
 * Gets the next marker after a given position (for navigation).
 * @param {number} position - Current position in seconds
 * @returns {object|null} The next marker or null if none exists
 */
export function getNextTimelineMarker(position) {
    const sortedMarkers = timelineMarkers.filter(m => m.position > position);
    return sortedMarkers.length > 0 ? sortedMarkers[0] : null;
}

/**
 * Gets the previous marker before a given position (for navigation).
 * @param {number} position - Current position in seconds
 * @returns {object|null} The previous marker or null if none exists
 */
export function getPrevTimelineMarker(position) {
    const sortedMarkers = timelineMarkers.filter(m => m.position < position);
    return sortedMarkers.length > 0 ? sortedMarkers[sortedMarkers.length - 1] : null;
}

/**
 * Imports markers from an array (used during project load).
 * @param {Array} markersData - Array of marker objects
 */
export function importTimelineMarkers(markersData) {
    if (Array.isArray(markersData)) {
        timelineMarkers = markersData.map(m => ({
            id: m.id || `marker_${++timelineMarkerIdCounter}`,
            name: m.name || 'Unnamed',
            position: Math.max(0, parseFloat(m.position) || 0),
            color: m.color || '#f59e0b'
        }));
        timelineMarkers.sort((a, b) => a.position - b.position);
        // Update counter to avoid ID collisions
        const maxId = timelineMarkers.reduce((max, m) => {
            const match = m.id.match(/marker_(\d+)/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        timelineMarkerIdCounter = maxId;
        console.log(`[State] Imported ${timelineMarkers.length} timeline markers`);
    }
}

/**
 * Exports markers for project save.
 * @returns {Array} Array of marker objects
 */
export function exportTimelineMarkers() {
    return JSON.parse(JSON.stringify(timelineMarkers));
}

// --- Track Freeze State Management ---
/**
 * Freeze a track - render to audio and disable real-time processing.
 * @param {number} trackId - The track ID to freeze
 * @param {Object} options - Freeze options
 * @returns {Promise<boolean>} True if successful
 */
export async function freezeTrack(trackId, options = {}) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.error(`[State freezeTrack] Track ${trackId} not found.`);
        return false;
    }

    if (track.frozen) {
        console.log(`[State freezeTrack] Track ${trackId} already frozen.`);
        return true;
    }

    try {
        const result = await track.freeze(options.startBar, options.endBar);
        
        if (result && appServices.captureStateForUndo) {
            appServices.captureStateForUndo(`Froze track ${track.name}`);
        }
        
        return result;
    } catch (error) {
        console.error(`[State freezeTrack] Error:`, error);
        return false;
    }
}

/**
 * Unfreeze a track - restore real-time processing.
 * @param {number} trackId - The track ID to unfreeze
 * @returns {Promise<boolean>} True if successful
 */
export async function unfreezeTrack(trackId) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.error(`[State unfreezeTrack] Track ${trackId} not found.`);
        return false;
    }

    if (!track.frozen) {
        console.log(`[State unfreezeTrack] Track ${trackId} not frozen.`);
        return true;
    }

    try {
        const result = await track.unfreeze();
        
        if (result && appServices.captureStateForUndo) {
            appServices.captureStateForUndo(`Unfroze track ${track.name}`);
        }
        
        return result;
    } catch (error) {
        console.error(`[State unfreezeTrack] Error:`, error);
        return false;
    }
}

/**
 * Get frozen state for a track.
 * @param {number} trackId - The track ID
 * @returns {Object|null} Frozen state info or null
 */
export function getTrackFrozenState(trackId) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        return null;
    }

    return track.getFrozenInfo ? track.getFrozenInfo() : { frozen: track.frozen || false };
}

/**
 * Check if a track is frozen.
 * @param {number} trackId - The track ID
 * @returns {boolean} True if frozen
 */
export function isTrackFrozen(trackId) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    return track ? (track.frozen || false) : false;
}

/**
 * Get all frozen tracks.
 * @returns {Array} Array of frozen track IDs
 */
export function getFrozenTracks() {
    const tracks = getTracksState();
    return tracks.filter(t => t.frozen).map(t => t.id);
}

// ==========================================
// TRACK GROUPS
// ==========================================

/**
 * Track groups state - groups of tracks that can be controlled together.
 * Each group has: id, name, trackIds, color, volume, muted, solo
 */
let trackGroups = [];
let trackGroupIdCounter = 1;

/**
 * Get all track groups.
 * @returns {Array} Array of track group objects
 */
export function getTrackGroups() {
    return trackGroups;
}

/**
 * Get a track group by ID.
 * @param {number} groupId - The group ID
 * @returns {Object|null} Group object or null
 */
export function getTrackGroupById(groupId) {
    return trackGroups.find(g => g.id === groupId) || null;
}

/**
 * Add a new track group.
 * @param {string} name - Group name
 * @param {Array} trackIds - Array of track IDs to include
 * @param {string} color - Group color (hex)
 * @returns {Object} The created group
 */
export function addTrackGroup(name = 'New Group', trackIds = [], color = '#6366f1') {
    const group = {
        id: trackGroupIdCounter++,
        name: name,
        trackIds: [...trackIds],
        color: color,
        volume: 1.0,
        muted: false,
        solo: false
    };
    
    trackGroups.push(group);
    console.log(`[State] Added track group: ${name} with ${trackIds.length} tracks`);
    
    return group;
}

/**
 * Remove a track group.
 * @param {number} groupId - The group ID to remove
 * @returns {boolean} True if removed
 */
export function removeTrackGroup(groupId) {
    const index = trackGroups.findIndex(g => g.id === groupId);
    if (index === -1) return false;
    
    const removed = trackGroups.splice(index, 1)[0];
    console.log(`[State] Removed track group: ${removed.name}`);
    
    return true;
}

/**
 * Update a track group's properties.
 * @param {number} groupId - The group ID
 * @param {Object} updates - Properties to update
 * @returns {boolean} True if updated
 */
export function updateTrackGroup(groupId, updates) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    Object.assign(group, updates);
    console.log(`[State] Updated track group ${groupId}:`, updates);
    
    return true;
}

/**
 * Add a track to a group.
 * @param {number} groupId - The group ID
 * @param {number} trackId - The track ID to add
 * @returns {boolean} True if added
 */
export function addTrackToGroup(groupId, trackId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    if (!group.trackIds.includes(trackId)) {
        group.trackIds.push(trackId);
        console.log(`[State] Added track ${trackId} to group ${groupId}`);
    }
    
    return true;
}

/**
 * Remove a track from a group.
 * @param {number} groupId - The group ID
 * @param {number} trackId - The track ID to remove
 * @returns {boolean} True if removed
 */
export function removeTrackFromGroup(groupId, trackId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    const index = group.trackIds.indexOf(trackId);
    if (index !== -1) {
        group.trackIds.splice(index, 1);
        console.log(`[State] Removed track ${trackId} from group ${groupId}`);
    }
    
    return true;
}

/**
 * Set group volume (applies to all tracks in group).
 * @param {number} groupId - The group ID
 * @param {number} volume - Volume (0-1)
 * @returns {boolean} True if set
 */
export function setTrackGroupVolume(groupId, volume) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.volume = Math.max(0, Math.min(1, volume));
    
    // Apply volume to all tracks in group
    const tracks = getTracksState();
    group.trackIds.forEach(trackId => {
        const track = tracks.find(t => t.id === trackId);
        if (track && track.setVolume) {
            track.setVolume(group.volume);
        }
    });
    
    console.log(`[State] Set group ${groupId} volume to ${volume}`);
    
    return true;
}

/**
 * Set group mute state (applies to all tracks in group).
 * @param {number} groupId - The group ID
 * @param {boolean} muted - Mute state
 * @returns {boolean} True if set
 */
export function setTrackGroupMute(groupId, muted) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.muted = muted;
    
    // Apply mute to all tracks in group
    const tracks = getTracksState();
    group.trackIds.forEach(trackId => {
        const track = tracks.find(t => t.id === trackId);
        if (track && track.setMuted) {
            track.setMuted(muted);
        }
    });
    
    console.log(`[State] Set group ${groupId} muted to ${muted}`);
    
    return true;
}

/**
 * Set group solo state.
 * @param {number} groupId - The group ID
 * @param {boolean} solo - Solo state
 * @returns {boolean} True if set
 */
export function setTrackGroupSolo(groupId, solo) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.solo = solo;
    
    // Handle solo logic: mute all non-solo groups
    const allTracks = getTracksState();
    
    if (solo) {
        // Check if any group is soloed
        const anySoloed = trackGroups.some(g => g.solo);
        
        if (anySoloed) {
            // Mute tracks not in soloed groups
            const soloedTrackIds = new Set();
            trackGroups.filter(g => g.solo).forEach(g => {
                g.trackIds.forEach(id => soloedTrackIds.add(id));
            });
            
            allTracks.forEach(track => {
                if (track.setMuted) {
                    track.setMuted(!soloedTrackIds.has(track.id));
                }
            });
        }
    } else {
        // Check if any group is still soloed
        const anySoloed = trackGroups.some(g => g.solo);
        
        if (!anySoloed) {
            // Unmute all tracks
            allTracks.forEach(track => {
                if (track.setMuted) {
                    track.setMuted(false);
                }
            });
        }
    }
    
    console.log(`[State] Set group ${groupId} solo to ${solo}`);
    
    return true;
}

/**
 * Toggle group mute state.
 * @param {number} groupId - The group ID
 * @returns {boolean} New mute state
 */
export function toggleTrackGroupMute(groupId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    setTrackGroupMute(groupId, !group.muted);
    return !group.muted;
}

/**
 * Toggle group solo state.
 * @param {number} groupId - The group ID
 * @returns {boolean} New solo state
 */
export function toggleTrackGroupSolo(groupId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    setTrackGroupSolo(groupId, !group.solo);
    return !group.solo;
}

/**
 * Clear all track groups.
 */
export function clearAllTrackGroups() {
    trackGroups = [];
    trackGroupIdCounter = 1;
    console.log('[State] Cleared all track groups');
}

// --- Project Export Presets ---
// Stored as { presetName: { tempo, format, sampleRate, bitDepth, includeStems, stemTrackIds, bounceTracks, bounceStartBar, bounceEndBar, ... } }
let exportPresets = {};

export function getExportPresetsState() { return exportPresets; }

export function saveExportPreset(presetName, presetData) {
    exportPresets[presetName] = JSON.parse(JSON.stringify(presetData));
    console.log(`[State] Saved export preset "${presetName}"`);
}

export function deleteExportPreset(presetName) {
    if (exportPresets[presetName]) {
        delete exportPresets[presetName];
        console.log(`[State] Deleted export preset "${presetName}"`);
    }
}

export function getExportPreset(presetName) {
    if (exportPresets[presetName]) {
        return JSON.parse(JSON.stringify(exportPresets[presetName]));
    }
    return null;
}

export function getExportPresetNames() {
    return Object.keys(exportPresets);
}

// --- Chord Memory ---
// chordMemorySlots: Array of { id, name, notes: [{pitch, velocity}], timestamp }
// Stores chord voicings that can be triggered with a single key
let chordMemorySlots = [];

export function getChordMemorySlots() { return chordMemorySlots; }

/**
 * Store a chord in memory.
 * @param {string} name - Name for the chord (e.g., "C Major", "G7")
 * @param {Array} notes - Array of {pitch: number (MIDI note), velocity: number (0-1)}
 * @returns {string} The ID of the stored chord
 */
export function storeChord(name, notes) {
    const id = `chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const chord = {
        id,
        name: name || `Chord ${chordMemorySlots.length + 1}`,
        notes: notes.map(n => ({
            pitch: Math.round(n.pitch),
            velocity: Math.max(0, Math.min(1, n.velocity || 0.8))
        })),
        timestamp: Date.now()
    };
    chordMemorySlots.push(chord);
    console.log(`[State] Stored chord "${chord.name}" with ${chord.notes.length} notes`);
    return id;
}

/**
 * Delete a chord from memory.
 * @param {string} chordId - The ID of the chord to delete
 */
export function deleteChord(chordId) {
    const idx = chordMemorySlots.findIndex(c => c.id === chordId);
    if (idx !== -1) {
        const deleted = chordMemorySlots.splice(idx, 1)[0];
        console.log(`[State] Deleted chord "${deleted.name}"`);
    }
}

/**
 * Get a chord by ID.
 * @param {string} chordId - The ID of the chord
 * @returns {Object|null} The chord object or null if not found
 */
export function getChordById(chordId) {
    return chordMemorySlots.find(c => c.id === chordId) || null;
}

/**
 * Trigger a stored chord - plays all notes simultaneously.
 * @param {string} chordId - The ID of the chord to trigger
 * @param {number} trackId - Optional track ID to play on (uses armed track if null)
 * @param {number} duration - Duration in seconds (0 = indefinite/legato)
 * @returns {boolean} True if chord was triggered successfully
 */
export function triggerChord(chordId, trackId = null, duration = 0) {
    const chord = getChordById(chordId);
    if (!chord) {
        console.warn(`[State triggerChord] Chord ${chordId} not found`);
        return false;
    }
    
    const targetTrackId = trackId || armedTrackId || activeSequencerTrackId;
    if (targetTrackId === null) {
        console.warn('[State triggerChord] No target track specified');
        return false;
    }
    
    const track = tracks.find(t => t.id === targetTrackId);
    if (!track) {
        console.warn(`[State triggerChord] Track ${targetTrackId} not found`);
        return false;
    }
    
    // Play all notes in the chord
    const now = Tone.now();
    chord.notes.forEach(note => {
        if (track.playNote) {
            track.playNote(note.pitch, now, duration > 0 ? duration : undefined, note.velocity);
        } else if (track.instrument && track.instrument.triggerAttack) {
            const freq = Tone.Frequency(note.pitch, 'midi').toFrequency();
            track.instrument.triggerAttack(freq, now, note.velocity);
            if (duration > 0) {
                track.instrument.triggerRelease(freq, now + duration);
            }
        }
    });
    
    console.log(`[State triggerChord] Triggered chord "${chord.name}" on track ${targetTrackId}`);
    return true;
}

/**
 * Clear all stored chords.
 */
export function clearAllChords() {
    chordMemorySlots = [];
    console.log('[State] Cleared all chord memory slots');
}

/**
 * Rename a stored chord.
 * @param {string} chordId - The ID of the chord
 * @param {string} newName - New name for the chord
 */
export function renameChord(chordId, newName) {
    const chord = chordMemorySlots.find(c => c.id === chordId);
    if (chord) {
        chord.name = newName;
        console.log(`[State] Renamed chord to "${newName}"`);
    }
}

/**
 * Import chords from project data.
 * @param {Array} chords - Array of chord objects to import
 */
export function setChordMemoryState(chords) {
    chordMemorySlots = Array.isArray(chords) ? chords.map(c => ({
        id: c.id || `chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: c.name || 'Unnamed Chord',
        notes: Array.isArray(c.notes) ? c.notes.map(n => ({
            pitch: Math.round(n.pitch),
            velocity: Math.max(0, Math.min(1, n.velocity || 0.8))
        })) : [],
        timestamp: c.timestamp || Date.now()
    })) : [];
    console.log(`[State] Imported ${chordMemorySlots.length} chord memory slots`);
}

// --- AppServices Placeholder (will be populated by main.js) ---
let appServices = {}; // Populated by initializeStateModule

export function initializeStateModule(services) {
    appServices = services || {}; // Ensure appServices is an object
    if (!Array.isArray(masterEffectsChainState)) {
        masterEffectsChainState = [];
    }
    // Ensure playback mode services are set up if not already provided
    if (appServices && typeof appServices.getPlaybackMode !== 'function') {
        appServices.getPlaybackMode = getPlaybackModeState;
    }
    if (appServices && typeof appServices.setPlaybackMode !== 'function') {
        appServices.setPlaybackMode = setPlaybackModeStateInternal;
    }
    console.log("[State] State module initialized. AppServices keys:", Object.keys(appServices));
}

// --- Getters for Centralized State ---
export function getTracksState() { return tracks; }
export function getTrackByIdState(id) { return tracks.find(t => t.id === id); }

export function getOpenWindowsState() { return openWindowsMap; }
export function getWindowByIdState(id) { return openWindowsMap.get(id); }
export function getHighestZState() { return highestZ; }
export function getMasterEffectsState() { return masterEffectsChainState; }
export function getMasterGainValueState() { return masterGainValueState; }

export function getMidiAccessState() { return midiAccessGlobal; }
export function getActiveMIDIInputState() { return activeMIDIInputGlobal; }

// MODIFICATION START: Add console logs to getters
export function getLoadedZipFilesState() {
    console.log('[State GET] getLoadedZipFilesState. Keys:', loadedZipFilesGlobal ? Object.keys(loadedZipFilesGlobal) : 'null/undefined');
    return loadedZipFilesGlobal;
}
export function getSoundLibraryFileTreesState() {
    console.log('[State GET] getSoundLibraryFileTreesState. Keys:', soundLibraryFileTreesGlobal ? Object.keys(soundLibraryFileTreesGlobal) : 'null/undefined');
    if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"] && Object.keys(soundLibraryFileTreesGlobal["Drums"]).length > 0) {
        console.log('[State GET] "Drums" tree exists and is NOT empty.');
    } else if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"]) {
        console.warn('[State GET] "Drums" tree exists but IS EMPTY!');
    }
    return soundLibraryFileTreesGlobal;
}
// MODIFICATION END
export function getCurrentLibraryNameState() { return currentLibraryNameGlobal; }
export function getCurrentSoundFileTreeState() { return currentSoundFileTreeGlobal; }
export function getCurrentSoundBrowserPathState() { return currentSoundBrowserPathGlobal; }
export function getPreviewPlayerState() { return previewPlayerGlobal; }

export function getClipboardDataState() { return clipboardDataGlobal; }
export function getAutomationClipboardState() { return automationClipboardGlobal; }
export function setAutomationClipboardState(data) { 
    automationClipboardGlobal = typeof data === 'object' && data !== null ? data : { param: null, points: [], sourceTrackId: null }; 
}
export function getArmedTrackIdState() { return armedTrackId; }
export function getSoloedTrackIdState() { return soloedTrackId; }
export function setSoloedTrackIdState(id) { soloedTrackId = id; }
export function isTrackRecordingState() { return isRecordingGlobal; }
export function getRecordingTrackIdState() { return recordingTrackIdGlobal; }
export function getRecordingStartTimeState() { return recordingStartTime; }
export function getActiveSequencerTrackIdState() { return activeSequencerTrackId; }
export function getUndoStackState() { return undoStack; }
export function getRedoStackState() { return redoStack; }
export function getPlaybackModeState() { return globalPlaybackMode; }

// --- Track Effects Presets ---
export function getTrackEffectsPresetsState() { return trackEffectsPresets; }

export function saveTrackEffectPreset(trackId, presetName, effectsData) {
    if (!trackEffectsPresets[trackId]) {
        trackEffectsPresets[trackId] = {};
    }
    trackEffectsPresets[trackId][presetName] = JSON.parse(JSON.stringify(effectsData));
    console.log(`[State] Saved effect preset "${presetName}" for track ${trackId}`);
}

export function deleteTrackEffectPreset(trackId, presetName) {
    if (trackEffectsPresets[trackId] && trackEffectsPresets[trackId][presetName]) {
        delete trackEffectsPresets[trackId][presetName];
        console.log(`[State] Deleted effect preset "${presetName}" for track ${trackId}`);
    }
}

export function getTrackEffectPreset(trackId, presetName) {
    if (trackEffectsPresets[trackId] && trackEffectsPresets[trackId][presetName]) {
        return JSON.parse(JSON.stringify(trackEffectsPresets[trackId][presetName]));
    }
    return null;
}

export function getTrackEffectPresetNames(trackId) {
    if (trackEffectsPresets[trackId]) {
        return Object.keys(trackEffectsPresets[trackId]);
    }
    return [];
}

// --- Setters for Centralized State (called internally or via appServices) ---
export function addWindowToStoreState(id, instance) { openWindowsMap.set(id, instance); }
export function removeWindowFromStoreState(id) { openWindowsMap.delete(id); }
export function setHighestZState(value) { highestZ = Number.isFinite(value) ? value : 100; }
export function incrementHighestZState() { return ++highestZ; }

export function setMasterEffectsState(newChain) { masterEffectsChainState = Array.isArray(newChain) ? newChain : []; }
export function setMasterGainValueState(value) { masterGainValueState = Number.isFinite(value) ? value : (typeof Tone !== 'undefined' && Tone.dbToGain) ? Tone.dbToGain(0) : 1.0; }

export function setMidiAccessState(access) { midiAccessGlobal = access; }
export function setActiveMIDIInputState(input) { activeMIDIInputGlobal = input; }

// MODIFICATION START: Add console logs to setters
export function setLoadedZipFilesState(files) {
    console.log('[State SET] setLoadedZipFilesState. Incoming keys:', files ? Object.keys(files) : 'null/undefined');
    loadedZipFilesGlobal = typeof files === 'object' && files !== null ? files : {};
    console.log('[State SET] setLoadedZipFilesState. loadedZipFilesGlobal NOW has keys:', Object.keys(loadedZipFilesGlobal));
    if (loadedZipFilesGlobal && loadedZipFilesGlobal["Drums"]) {
         console.log('[State SET] "Drums" JSZip instance IS in loadedZipFilesGlobal.');
    } else {
         console.log('[State SET] "Drums" JSZip instance IS NOT in loadedZipFilesGlobal after set.');
    }
}
export function setSoundLibraryFileTreesState(trees) {
    console.log('[State SET] setSoundLibraryFileTreesState. Incoming keys:', trees ? Object.keys(trees) : 'null/undefined');
    if (trees && trees["Drums"]) {
        console.log('[State SET] setSoundLibraryFileTreesState: Incoming "Drums" tree has keys count:', Object.keys(trees["Drums"]).length);
    } else if (trees) {
         console.log('[State SET] setSoundLibraryFileTreesState: Incoming trees object does not have "Drums" key.');
    }

    soundLibraryFileTreesGlobal = typeof trees === 'object' && trees !== null ? trees : {};
    console.log('[State SET] setSoundLibraryFileTreesState. soundLibraryFileTreesGlobal NOW has keys:', Object.keys(soundLibraryFileTreesGlobal));

    if (soundLibraryFileTreesGlobal && soundLibraryFileTreesGlobal["Drums"]) {
        console.log('[State SET] "Drums" tree IS in soundLibraryFileTreesGlobal. Num children:', Object.keys(soundLibraryFileTreesGlobal["Drums"]).length);
        if (Object.keys(soundLibraryFileTreesGlobal["Drums"]).length === 0) {
            console.warn('[State SET] "Drums" tree in global state IS EMPTY!');
        }
    } else {
         console.log('[State SET] "Drums" tree IS NOT in soundLibraryFileTreesGlobal after set.');
    }
}
// MODIFICATION END

export function setCurrentLibraryNameState(name) { currentLibraryNameGlobal = name; }
export function setCurrentSoundFileTreeState(tree) { currentSoundFileTreeGlobal = tree; }
export function setCurrentSoundBrowserPathState(path) { currentSoundBrowserPathGlobal = Array.isArray(path) ? path : []; }
export function setPreviewPlayerState(player) { previewPlayerGlobal = player; }

export function setClipboardDataState(data) { clipboardDataGlobal = typeof data === 'object' && data !== null ? data : { type: null, data: null }; }

export function setArmedTrackIdState(id) { armedTrackId = id; }
export function setPlaybackModeStateInternal(mode) {
    const displayMode = typeof mode === 'string' ? mode.charAt(0).toUpperCase() + mode.slice(1) : 'Unknown';
    console.log(`[State setPlaybackModeStateInternal] Attempting to set mode to: ${mode} (Display: ${displayMode}). Current mode: ${globalPlaybackMode}`);

    if (mode === 'sequencer' || mode === 'timeline') {
        if (globalPlaybackMode !== mode) {
            if (appServices.captureStateForUndo) {
                appServices.captureStateForUndo(`Set Playback Mode to ${displayMode}`);
            } else {
                captureStateForUndoInternal(`Set Playback Mode to ${displayMode}`); // Fallback
            }
            globalPlaybackMode = mode;
            console.log(`[State setPlaybackModeStateInternal] Playback mode changed to: ${globalPlaybackMode}`);

            if (Tone.Transport.state === 'started') {
                console.log("[State setPlaybackModeStateInternal] Transport was started, stopping it.");
                Tone.Transport.stop();
            }
            Tone.Transport.cancel(0); // Cancel all scheduled events
            console.log("[State setPlaybackModeStateInternal] Tone.Transport events cancelled.");

            if (appServices.uiElementsCache?.playBtnGlobal) {
                appServices.uiElementsCache.playBtnGlobal.textContent = 'Play';
                console.log("[State setPlaybackModeStateInternal] Play button text reset.");
            } else {
                console.warn("[State setPlaybackModeStateInternal] Play button UI element not found in cache.");
            }
            document.querySelectorAll('.sequencer-step-cell.playing').forEach(cell => cell.classList.remove('playing'));

            const currentTracks = getTracksState();
            console.log(`[State setPlaybackModeStateInternal] Re-initializing sequences/playback for ${currentTracks.length} tracks for new mode: ${globalPlaybackMode}.`);
            try {
                currentTracks.forEach(track => {
                    if (track && track.type !== 'Audio' && typeof track.recreateToneSequence === 'function') {
                        track.recreateToneSequence(true); // true to force restart
                    }
                    // If switching to sequencer mode, stop any timeline-based audio clip playback
                    if (globalPlaybackMode === 'sequencer' && track && track.type === 'Audio' && typeof track.stopPlayback === 'function') {
                        track.stopPlayback();
                    }
                });
            } catch (error) {
                console.error("[State setPlaybackModeStateInternal] Error during track sequence/playback re-initialization:", error);
                if(appServices.showNotification) appServices.showNotification("Error updating track playback for new mode.", 3000);
            }


            if (appServices.onPlaybackModeChange && typeof appServices.onPlaybackModeChange === 'function') {
                appServices.onPlaybackModeChange(globalPlaybackMode);
            }
             if (appServices.renderTimeline && typeof appServices.renderTimeline === 'function') {
                appServices.renderTimeline();
            }
        } else {
            console.log(`[State setPlaybackModeStateInternal] Mode is already ${mode}. No change.`);
        }
    } else {
        console.warn(`[State setPlaybackModeStateInternal] Invalid playback mode attempted: ${mode}. Expected 'sequencer' or 'timeline'.`);
    }
}
export { setPlaybackModeStateInternal as setPlaybackModeState }; // Export with the name expected by other modules

// --- Track Management ---
export async function addTrackToStateInternal(type, initialData = null, isUserAction = true) {
    // _isUserActionPlaceholder is used by UI event handlers to signify a brand new track from user action,
    // vs. a track being added during project load/undo/redo.
    const isBrandNewUserTrack = isUserAction && (!initialData || initialData._isUserActionPlaceholder);
    console.log(`[State addTrackToStateInternal] Adding ${type} track. User Action: ${isUserAction}, Brand New: ${isBrandNewUserTrack}`);

    if (isBrandNewUserTrack) {
        captureStateForUndoInternal(`Add ${type} Track`);
        if (initialData && initialData._isUserActionPlaceholder) initialData = null; // Clear placeholder
    }

    let newTrack;
    try {
        let newTrackId;
        if (initialData && initialData.id != null && Number.isFinite(initialData.id)) {
            newTrackId = initialData.id;
            if (newTrackId >= trackIdCounter) trackIdCounter = newTrackId + 1;
        } else {
            newTrackId = trackIdCounter++;
        }

        const trackAppServices = { // Pass necessary services to the Track instance
            getSoloedTrackId: getSoloedTrackIdState,
            captureStateForUndo: captureStateForUndoInternal,
            updateTrackUI: appServices.updateTrackUI, // These come from main.js
            highlightPlayingStep: appServices.highlightPlayingStep,
            autoSliceSample: appServices.autoSliceSample,
            closeAllTrackWindows: appServices.closeAllTrackWindows,
            getMasterEffectsBusInputNode: appServices.getMasterEffectsBusInputNode,
            showNotification: appServices.showNotification,
            effectsRegistryAccess: appServices.effectsRegistryAccess,
            renderTimeline: appServices.renderTimeline,
            getPlaybackMode: getPlaybackModeState,
            getTrackById: getTrackByIdState, // Track might need to interact with other tracks (e.g. sidechaining in future)
            getTracks: getTracksState
        };

        newTrack = new Track(newTrackId, type, initialData, trackAppServices);
        tracks.push(newTrack);

        if (typeof newTrack.initializeAudioNodes === 'function') {
            await newTrack.initializeAudioNodes();
        }
        // fullyInitializeAudioResources handles loading samples from DB/URL etc.
        await newTrack.fullyInitializeAudioResources();

        if (isBrandNewUserTrack && appServices.showNotification) {
            appServices.showNotification(`${newTrack.name} added successfully.`, 2000);
        }
        if (isBrandNewUserTrack && appServices.openTrackInspectorWindow) {
             // Delay opening inspector slightly to ensure track is fully set up
            setTimeout(() => appServices.openTrackInspectorWindow(newTrack.id), 50);
            
            // Also open sequencer for applicable track types
            if (newTrack.type !== 'Audio' && appServices.openTrackSequencerWindow) {
                setTimeout(() => appServices.openTrackSequencerWindow(newTrack.id, true), 150);
            }
        }

        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.renderTimeline) appServices.renderTimeline();

    } catch (error) {
        console.error(`[State addTrackToStateInternal] Error adding ${type} track:`, error);
        if (appServices.showNotification) {
            appServices.showNotification(`Failed to add ${type} track: ${error.message}`, 4000);
        }
        // If track creation failed, ensure it's not in the tracks array if partially added
        if (newTrack && tracks.includes(newTrack)) {
            tracks = tracks.filter(t => t.id !== newTrack.id);
        }
        return null; // Indicate failure
    }
    return newTrack;
}

export function removeTrackFromStateInternal(trackId) {
    try {
        const trackIndex = tracks.findIndex(t => t.id === trackId);
        if (trackIndex === -1) {
            console.warn(`[State removeTrackFromStateInternal] Track ID ${trackId} not found for removal.`);
            return;
        }

        const track = tracks[trackIndex];
        captureStateForUndoInternal(`Remove Track "${track.name}"`);

        if (typeof track.dispose === 'function') {
            track.dispose();
        }
        tracks.splice(trackIndex, 1);

        if (armedTrackId === trackId) setArmedTrackIdState(null);
        if (soloedTrackId === trackId) {
            setSoloedTrackIdState(null);
            // Re-evaluate solo states for all other tracks
            tracks.forEach(t => {
                if (t) {
                    t.isSoloed = false; // Explicitly set, then applySoloState will use global state
                    if (typeof t.applySoloState === 'function') t.applySoloState();
                    if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged');
                }
            });
        }
        if (activeSequencerTrackId === trackId) setActiveSequencerTrackIdState(null);

        if (appServices.showNotification) appServices.showNotification(`Track "${track.name}" removed.`, 2000);
        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI();
        if (appServices.renderTimeline) appServices.renderTimeline();

    } catch (error) {
        console.error(`[State removeTrackFromStateInternal] Error removing track ${trackId}:`, error);
        if (appServices.showNotification) appServices.showNotification(`Error removing track: ${error.message}`, 3000);
    }
}

export function reorderTrackInState(trackId, newIndex) {
    const oldIndex = tracks.findIndex(t => t.id === trackId);
    if (oldIndex === -1) {
        console.warn(`[State reorderTrackInState] Track ID ${trackId} not found.`);
        return;
    }
    if (oldIndex === newIndex || newIndex < 0 || newIndex >= tracks.length) {
        return;
    }
    captureStateForUndoInternal(`Reorder Track`);
    const [trackToMove] = tracks.splice(oldIndex, 1);
    tracks.splice(newIndex, 0, trackToMove);
    console.log(`[State reorderTrackInState] Moved track "${trackToMove.name}" from index ${oldIndex} to ${newIndex}`);
    if (appServices.updateMixerWindow) appServices.updateMixerWindow();
    if (appServices.renderTimeline) appServices.renderTimeline();
}


/**
 * Duplicates a track with all its settings, sequences, and effects.
 * @param {number} sourceTrackId - The ID of the track to duplicate
 * @returns {Track|null} The new duplicated track, or null on error
 */
export async function duplicateTrack(sourceTrackId) {
    try {
        const sourceTrack = tracks.find(t => t.id === sourceTrackId);
        if (!sourceTrack) {
            console.warn(`[State duplicateTrack] Source track ID ${sourceTrackId} not found.`);
            if (appServices.showNotification) appServices.showNotification('Track not found for duplication.', 3000);
            return null;
        }

        captureStateForUndoInternal(`Duplicate Track "${sourceTrack.name}"`);

        // Create a deep copy of the track's serializable data
        const trackData = {
            id: ++trackIdCounter,
            name: `${sourceTrack.name} (copy)`,
            type: sourceTrack.type,
            color: sourceTrack.color,
            isMuted: false,
            isMonitoringEnabled: sourceTrack.isMonitoringEnabled,
            previousVolumeBeforeMute: sourceTrack.previousVolumeBeforeMute,
            pan: sourceTrack.pan,
            sendLevels: JSON.parse(JSON.stringify(sourceTrack.sendLevels || {})),
            volume: sourceTrack.previousVolumeBeforeMute || 0.7,
            // Synth specific
            synthEngineType: sourceTrack.synthEngineType,
            synthParams: sourceTrack.synthParams ? JSON.parse(JSON.stringify(sourceTrack.synthParams)) : {},
            // Sequences
            sequences: sourceTrack.sequences ? JSON.parse(JSON.stringify(sourceTrack.sequences)) : [],
            activeSequenceId: sourceTrack.activeSequenceId,
            stepsPerBeat: sourceTrack.stepsPerBeat,
            // Effects
            activeEffects: sourceTrack.activeEffects ? sourceTrack.activeEffects.map(e => ({
                id: `effect-${trackIdCounter}-${e.type}-${Date.now()}`,
                type: e.type,
                params: JSON.parse(JSON.stringify(e.params || {}))
            })) : [],
            // Sampler specific
            samplerAudioData: sourceTrack.samplerAudioData ? JSON.parse(JSON.stringify(sourceTrack.samplerAudioData)) : null,
            slices: sourceTrack.slices ? JSON.parse(JSON.stringify(sourceTrack.slices)) : [],
            // Instrument Sampler
            instrumentSamplerSettings: sourceTrack.instrumentSamplerSettings ? JSON.parse(JSON.stringify(sourceTrack.instrumentSamplerSettings)) : null,
            // Drum Sampler
            drumSamplerPads: sourceTrack.drumSamplerPads ? JSON.parse(JSON.stringify(sourceTrack.drumSamplerPads)) : [],
            // Timeline clips
            timelineClips: sourceTrack.timelineClips ? JSON.parse(JSON.stringify(sourceTrack.timelineClips)) : []
        };

        // Create the new track
        const newTrack = new Track(trackData.id, trackData.type, trackData, appServices);
        tracks.push(newTrack);

        // Initialize audio nodes for the new track
        if (typeof newTrack.initializeAudioNodes === 'function') {
            await newTrack.initializeAudioNodes();
        }

        // Update UI
        if (appServices.showNotification) {
            appServices.showNotification(`Duplicated "${sourceTrack.name}" as "${trackData.name}"`, 2000);
        }
        if (appServices.updateMixerWindow) appServices.updateMixerWindow();
        if (appServices.updateUndoRedoButtonsUI) appServices.updateUndoRedoButtonsUI();
        if (appServices.renderTimeline) appServices.renderTimeline();

        console.log(`[State duplicateTrack] Duplicated track ${sourceTrackId} to new track ${trackData.id}`);
        return newTrack;

    } catch (error) {
        console.error(`[State duplicateTrack] Error duplicating track ${sourceTrackId}:`, error);
        if (appServices.showNotification) appServices.showNotification(`Error duplicating track: ${error.message}`, 3000);
        return null;
    }
}

// --- Master Effects Chain Management ---
export function addMasterEffectToState(effectType, initialParams) {
    const effectId = `mastereffect_${effectType}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
    const defaultParams = appServices.effectsRegistryAccess?.getEffectDefaultParams
        ? appServices.effectsRegistryAccess.getEffectDefaultParams(effectType)
        : getEffectDefaultParamsFromRegistry(effectType); // Fallback

    masterEffectsChainState.push({
        id: effectId,
        type: effectType,
        params: initialParams || defaultParams
    });
    return effectId;
}

export function removeMasterEffectFromState(effectId) {
    const effectIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (effectIndex > -1) {
        masterEffectsChainState.splice(effectIndex, 1);
    }
}

export function updateMasterEffectParamInState(effectId, paramPath, value) {
    const effectWrapper = masterEffectsChainState.find(e => e.id === effectId);
    if (!effectWrapper || !effectWrapper.params) {
        console.warn(`[State updateMasterEffectParamInState] Effect wrapper or params not found for ID: ${effectId}`);
        return;
    }
    try {
        const keys = paramPath.split('.');
        let currentStoredParamLevel = effectWrapper.params;
        for (let i = 0; i < keys.length - 1; i++) {
            currentStoredParamLevel[keys[i]] = currentStoredParamLevel[keys[i]] || {};
            currentStoredParamLevel = currentStoredParamLevel[keys[i]];
        }
        currentStoredParamLevel[keys[keys.length - 1]] = value;
    } catch (error) {
        console.error(`[State updateMasterEffectParamInState] Error updating param ${paramPath} for effect ${effectId}:`, error);
    }
}

export function reorderMasterEffectInState(effectId, newIndex) {
    const oldIndex = masterEffectsChainState.findIndex(e => e.id === effectId);
    if (oldIndex === -1 || oldIndex === newIndex || newIndex < 0 || newIndex >= masterEffectsChainState.length) {
        if (oldIndex === -1) console.warn(`[State reorderMasterEffectInState] Effect ID ${effectId} not found.`);
        return;
    }
    const [effectToMove] = masterEffectsChainState.splice(oldIndex, 1);
    masterEffectsChainState.splice(newIndex, 0, effectToMove);
}

export function toggleMasterEffectBypass(effectId) {
    const effectWrapper = masterEffectsChainState.find(e => e.id === effectId);
    if (!effectWrapper) {
        console.warn(`[State toggleMasterEffectBypass] Effect ID ${effectId} not found.`);
        return;
    }

    // Check if currently bypassed (wet === 0 or bypassed flag is true)
    const isBypassed = effectWrapper.bypassed === true || (effectWrapper.params?.wet !== undefined && effectWrapper.params.wet === 0);

    if (isBypassed) {
        // Restore wet to previous value (or 1 if not stored)
        const restoreValue = effectWrapper.previousWetValue !== undefined ? effectWrapper.previousWetValue : 1;
        effectWrapper.bypassed = false;
        if (effectWrapper.params) effectWrapper.params.wet = restoreValue;
        delete effectWrapper.previousWetValue;

        // Apply to Tone.js node via audio.js
        if (appServices.setMasterEffectWet) {
            appServices.setMasterEffectWet(effectId, restoreValue);
        }

        console.log(`[State toggleMasterEffectBypass] Master effect "${effectWrapper.type}" (${effectId}) enabled. Wet: ${restoreValue}`);
        if (appServices.showNotification) {
            appServices.showNotification(`Master effect "${effectWrapper.type}" enabled`, 1500);
        }
    } else {
        // Store current wet value and bypass
        const currentWet = effectWrapper.params?.wet ?? 1;
        effectWrapper.previousWetValue = currentWet;
        effectWrapper.bypassed = true;
        if (effectWrapper.params) effectWrapper.params.wet = 0;

        // Apply to Tone.js node via audio.js
        if (appServices.setMasterEffectWet) {
            appServices.setMasterEffectWet(effectId, 0);
        }

        console.log(`[State toggleMasterEffectBypass] Master effect "${effectWrapper.type}" (${effectId}) bypassed.`);
        if (appServices.showNotification) {
            appServices.showNotification(`Master effect "${effectWrapper.type}" bypassed`, 1500);
        }
    }

    // Update UI
    if (appServices.updateMasterEffectsRackUI) {
        appServices.updateMasterEffectsRackUI();
    }
}

// --- Undo/Redo Logic ---
function updateInternalUndoRedoState() {
    if (appServices.updateUndoRedoButtonsUI && typeof appServices.updateUndoRedoButtonsUI === 'function') {
        try {
            appServices.updateUndoRedoButtonsUI(
                undoStack.length > 0 ? undoStack[undoStack.length - 1] : null,
                redoStack.length > 0 ? redoStack[redoStack.length - 1] : null
            );
        } catch (error) {
            console.error("[State updateInternalUndoRedoState] Error calling appServices.updateUndoRedoButtonsUI:", error);
        }
    }
    // Also update the undo history panel if it's open
    if (appServices.updateUndoHistoryPanel && typeof appServices.updateUndoHistoryPanel === 'function') {
        try {
            appServices.updateUndoHistoryPanel();
        } catch (error) {
            console.error("[State updateInternalUndoRedoState] Error calling appServices.updateUndoHistoryPanel:", error);
        }
    }
}

export function captureStateForUndoInternal(description = "Unknown action") {
    try {
        const currentState = gatherProjectDataInternal();
        if (!currentState) {
            console.error("[State captureStateForUndoInternal] Failed to gather project data. Aborting undo capture.");
            return;
        }
        currentState.description = description; // Add description to the state object
        undoStack.push(JSON.parse(JSON.stringify(currentState))); // Deep copy
        if (undoStack.length > Constants.MAX_HISTORY_STATES) {
            undoStack.shift();
        }
        redoStack = []; // Clear redo stack on new action
        updateInternalUndoRedoState();
    } catch (error) {
        console.error("[State captureStateForUndoInternal] Error capturing state for undo:", error);
        if (appServices.showNotification) appServices.showNotification("Error capturing undo state. See console.", 3000);
    }
}

export async function undoLastActionInternal() {
    if (undoStack.length === 0) {
        if (appServices.showNotification) appServices.showNotification("Nothing to undo.", 1500);
        return;
    }
    try {
        const stateToRestore = undoStack.pop();
        const currentStateForRedo = gatherProjectDataInternal();
        if (!currentStateForRedo) {
            console.error("[State undoLastActionInternal] Failed to gather current project data for redo stack. Undoing without pushing to redo.");
        } else {
            currentStateForRedo.description = stateToRestore.description; // Use the undone action's description for redo
            redoStack.push(JSON.parse(JSON.stringify(currentStateForRedo)));
            if (redoStack.length > Constants.MAX_HISTORY_STATES) redoStack.shift();
        }

        if (appServices.showNotification) appServices.showNotification(`Undoing: ${stateToRestore.description || 'last action'}...`, 2000);
        if (appServices) appServices._isReconstructingDAW_flag = true; // Signal reconstruction globally
        await reconstructDAWInternal(stateToRestore, true); // true for isUndoRedo
    } catch (error) {
        console.error("[State undoLastActionInternal] Error during undo:", error);
        if (appServices.showNotification) appServices.showNotification(`Error during undo operation: ${error.message}. Project may be unstable.`, 4000);
        // Potentially try to restore the popped state back to undoStack if reconstruction fails badly? Complex.
    } finally {
        if (appServices) appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    }
}

export async function redoLastActionInternal() {
    if (redoStack.length === 0) {
        if (appServices.showNotification) appServices.showNotification("Nothing to redo.", 1500);
        return;
    }
    try {
        const stateToRestore = redoStack.pop();
        const currentStateForUndo = gatherProjectDataInternal();
        if (!currentStateForUndo) {
            console.error("[State redoLastActionInternal] Failed to gather current project data for undo stack. Redoing without pushing to undo.");
        } else {
            currentStateForUndo.description = stateToRestore.description;
            undoStack.push(JSON.parse(JSON.stringify(currentStateForUndo)));
            if (undoStack.length > Constants.MAX_HISTORY_STATES) undoStack.shift();
        }

        if (appServices.showNotification) appServices.showNotification(`Redoing: ${stateToRestore.description || 'last action'}...`, 2000);
        if (appServices) appServices._isReconstructingDAW_flag = true;
        await reconstructDAWInternal(stateToRestore, true); // true for isUndoRedo
    } catch (error) {
        console.error("[State redoLastActionInternal] Error during redo:", error);
        if (appServices.showNotification) appServices.showNotification(`Error during redo operation: ${error.message}. Project may be unstable.`, 4000);
    } finally {
        if (appServices) appServices._isReconstructingDAW_flag = false;
        updateInternalUndoRedoState();
    }
}

// --- Project Data Handling ---
export function gatherProjectDataInternal() {
    console.log("[State gatherProjectDataInternal] Starting to gather project data...");
    try {
        const projectData = {
            version: Constants.APP_VERSION || "5.9.1", // Use a constant for app version
            globalSettings: {
                tempo: Tone.Transport.bpm.value,
                masterVolume: getMasterGainValueState(),
                activeMIDIInputId: getActiveMIDIInputState() ? getActiveMIDIInputState().id : null,
                soloedTrackId: getSoloedTrackIdState(),
                armedTrackId: getArmedTrackIdState(),
                highestZIndex: getHighestZState(),
                playbackMode: getPlaybackModeState(),
            },
            masterEffects: getMasterEffectsState().map(effect => ({
                id: effect.id,
                type: effect.type,
                params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {} // Ensure params exist
            })),
            tracks: getTracksState().map(track => {
                if (!track || typeof track.id === 'undefined') {
                    console.warn("[State gatherProjectDataInternal] Invalid track object found, skipping:", track);
                    return null; // Skip invalid tracks
                }
                const trackData = { // Base data
                    id: track.id, type: track.type, name: track.name,
                    trackNotes: track.trackNotes || '',
                    isMuted: track.isMuted,
                    volume: track.previousVolumeBeforeMute, // Store the actual volume, not the muted one
                    activeEffects: (track.activeEffects || []).map(effect => ({
                        id: effect.id, type: effect.type,
                        params: effect.params ? JSON.parse(JSON.stringify(effect.params)) : {}
                    })),
                    automation: track.automation ? JSON.parse(JSON.stringify(track.automation)) : { volume: [] },
                    // Type-specific sequence/clip data
                    sequences: track.type !== 'Audio' && track.sequences ? JSON.parse(JSON.stringify(track.sequences)) : [],
                    activeSequenceId: track.type !== 'Audio' ? track.activeSequenceId : null,
                    timelineClips: track.timelineClips ? JSON.parse(JSON.stringify(track.timelineClips)) : [],
                    timelinePlaybackRate: track.timelinePlaybackRate !== undefined ? track.timelinePlaybackRate : 1.0,
                };
                // Type-specific parameters
                if (track.type === 'Synth') {
                    trackData.synthEngineType = track.synthEngineType || 'MonoSynth';
                    trackData.synthParams = track.synthParams ? JSON.parse(JSON.stringify(track.synthParams)) : {};
                } else if (track.type === 'Sampler') {
                    trackData.samplerAudioData = {
                        fileName: track.samplerAudioData?.fileName,
                        dbKey: track.samplerAudioData?.dbKey,
                        // status is runtime, not strictly needed for save, but useful for rehydration hint
                        status: track.samplerAudioData?.dbKey ? 'persisted' : (track.samplerAudioData?.fileName ? 'volatile' : 'empty')
                    };
                    trackData.slices = track.slices ? JSON.parse(JSON.stringify(track.slices)) : [];
                    trackData.selectedSliceForEdit = track.selectedSliceForEdit;
                    trackData.slicerIsPolyphonic = track.slicerIsPolyphonic;
                } else if (track.type === 'DrumSampler') {
                    trackData.drumSamplerPads = (track.drumSamplerPads || []).map(p => ({
                        originalFileName: p.originalFileName, dbKey: p.dbKey,
                        volume: p.volume, pitchShift: p.pitchShift,
                        envelope: p.envelope ? JSON.parse(JSON.stringify(p.envelope)) : {},
                        status: p.dbKey ? 'persisted' : (p.originalFileName ? 'volatile' : 'empty')
                    }));
                    trackData.selectedDrumPadForEdit = track.selectedDrumPadForEdit;
                } else if (track.type === 'InstrumentSampler') {
                    trackData.instrumentSamplerSettings = {
                        originalFileName: track.instrumentSamplerSettings?.originalFileName,
                        dbKey: track.instrumentSamplerSettings?.dbKey,
                        rootNote: track.instrumentSamplerSettings?.rootNote,
                        loop: track.instrumentSamplerSettings?.loop,
                        loopStart: track.instrumentSamplerSettings?.loopStart,
                        loopEnd: track.instrumentSamplerSettings?.loopEnd,
                        envelope: track.instrumentSamplerSettings?.envelope ? JSON.parse(JSON.stringify(track.instrumentSamplerSettings.envelope)) : {},
                        status: track.instrumentSamplerSettings?.dbKey ? 'persisted' : (track.instrumentSamplerSettings?.originalFileName ? 'volatile' : 'empty')
                    };
                    trackData.instrumentSamplerIsPolyphonic = track.instrumentSamplerIsPolyphonic;
                }
                 if (track.type === 'Audio') { // Audio track specific settings
                    trackData.isMonitoringEnabled = track.isMonitoringEnabled;
                }
                // Remove deprecated/runtime-only properties if they accidentally get included
                delete trackData.sequenceData; delete trackData.sequenceLength;
                return trackData;
            }).filter(td => td !== null), // Filter out any skipped invalid tracks
            windowStates: Array.from(getOpenWindowsState().values())
                .map(win => {
                    if (!win || !win.element) return null;
                    return {
                        id: win.id, title: win.title,
                        left: win.element.style.left, top: win.element.style.top,
                        width: win.element.style.width, height: win.element.style.height,
                        zIndex: parseInt(win.element.style.zIndex, 10) || 100,
                        isMinimized: win.isMinimized,
                        isMaximized: win.isMaximized, // Save maximized state
                        restoreState: win.isMaximized ? JSON.parse(JSON.stringify(win.restoreState)) : {},
                        initialContentKey: win.initialContentKey || win.id // Ensure this is saved
                    };
                }).filter(ws => ws !== null)
        };
        console.log("[State gatherProjectDataInternal] Project data gathered successfully.");
        return projectData;
    } catch (error) {
        console.error("[State gatherProjectDataInternal] Error gathering project data:", error);
        if (appServices.showNotification) appServices.showNotification("Error preparing project data for saving/undo.", 4000);
        return null;
    }
}

export async function reconstructDAWInternal(projectData, isUndoRedo = false) {
    if (!projectData) {
        console.error("[State reconstructDAWInternal] projectData is null or undefined. Aborting reconstruction.");
        if (appServices.showNotification) appServices.showNotification("Error: No project data to load.", 3000);
        if (appServices) appServices._isReconstructingDAW_flag = false;
        return;
    }
    
    console.log(`[State reconstructDAWInternal] Starting reconstruction. isUndoRedo: ${isUndoRedo}`);
    if (appServices) appServices._isReconstructingDAW_flag = true;

    // --- Global Reset Phase ---
    try {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        if (appServices && typeof appServices.initAudioContextAndMasterMeter !== 'function') await appServices.initAudioContextAndMasterMeter(true); // Ensure audio context is running, true for user initiated context
        (getTracksState() || []).forEach(track => { if (track && typeof track.dispose === 'function') track.dispose(); });
        tracks = [];
        trackIdCounter = 0;
        if (appServices && typeof appServices.clearAllMasterEffectNodes !== 'function') appServices.clearAllMasterEffectNodes(); else console.warn("clearAllMasterEffectNodes service missing");
        masterEffectsChainState = [];
        if (appServices && typeof appServices.closeAllWindows !== 'function') appServices.closeAllWindows(true); else console.warn("closeAllWindows service missing");
        if (appServices && typeof appServices.clearOpenWindowsMap !== 'function') appServices.clearOpenWindowsMap(); else console.warn("clearOpenWindowsMap service missing");
        highestZ = 100;
        setArmedTrackIdState(null); setSoloedTrackIdState(null); setActiveSequencerTrackIdState(null);
        setIsRecordingState(false); setRecordingTrackIdState(null);
        if (appServices && typeof appServices.updateRecordButtonUI !== 'function') appServices.updateRecordButtonUI(false);
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error during global reset phase:", error);
        if (appServices.showNotification) appServices.showNotification("Critical error during project reset.", 5000);
        if (appServices) appServices._isReconstructingDAW_flag = false;
        return; // Abort further reconstruction
    }

    try { // --- Global Settings ---
        const gs = projectData.globalSettings || {};
        Tone.Transport.bpm.value = Number.isFinite(gs.tempo) ? gs.tempo : 120;
        setMasterGainValueState(Number.isFinite(gs.masterVolume) ? gs.masterVolume : (typeof Tone !== 'undefined' && Tone.dbToGain) ? Tone.dbToGain(0) : 1.0);
        if (appServices && typeof appServices.setActualMasterVolume !== 'function') appServices.setActualMasterVolume(getMasterGainValueState());
        setPlaybackModeStateInternal(gs.playbackMode === 'timeline' || gs.playbackMode === 'sequencer' ? gs.playbackMode : 'sequencer');
        if (appServices && typeof appServices.updateTaskbarTempoDisplay !== 'function') appServices.updateTaskbarTempoDisplay(Tone.Transport.bpm.value);
        setHighestZState(Number.isFinite(gs.highestZIndex) ? gs.highestZIndex : 100);
        // Armed and Soloed will be set after tracks are created
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error applying global settings:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading global settings.", 3000);
    }

    try { // --- Master Effects ---
        if (projectData.masterEffects && Array.isArray(projectData.masterEffects)) {
            for (const effectData of projectData.masterEffects) {
                if (effectData && effectData.type) {
                    const effectIdInState = addMasterEffectToState(effectData.type, effectData.params || {});
                    if (appServices.addMasterEffectToAudio) {
                         await appServices.addMasterEffectToAudio(effectIdInState, effectData.type, effectData.params || {});
                    }
                } else { console.warn("[State reconstructDAWInternal] Invalid master effect data found:", effectData); }
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructuring master effects:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading master effects.", 3000);
    }

    try { // --- Tracks ---
        if (projectData.tracks && Array.isArray(projectData.tracks)) {
            const trackPromises = projectData.tracks.map(trackData => {
                if (trackData && trackData.type) {
                    return addTrackToStateInternal(trackData.type, trackData, false); // false for isUserAction
                } else { console.warn("[State reconstructDAWInternal] Invalid track data found:", trackData); return Promise.resolve(null); }
            });
            await Promise.all(trackPromises);
            // After all tracks and their audio resources are initialized:
            console.log(`[State reconstructDAWInternal] All track instances created. Now setting armed/soloed states.`);
            const globalSettings = projectData.globalSettings || {};
            if (globalSettings.armedTrackId !== null && typeof globalSettings.armedTrackId !== 'undefined') {
                setArmedTrackIdState(globalSettings.armedTrackId);
            }
            if (globalSettings.soloedTrackId !== null && typeof globalSettings.soloedTrackId !== 'undefined') {
                setSoloedTrackIdState(globalSettings.soloedTrackId);
                getTracksState().forEach(t => { // Apply solo state after all tracks are potentially available
                    if (t) {
                        t.isSoloed = (t.id === getSoloedTrackIdState());
                        if (typeof t.applySoloState === 'function') t.applySoloState();
                        if (appServices.updateTrackUI) appServices.updateTrackUI(t.id, 'soloChanged');
                    }
                });
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructuring tracks:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading tracks.", 3000);
    }

    // Window reconstruction needs to happen after tracks are potentially created, as some windows depend on track IDs.
    try {
        if (projectData.windowStates && Array.isArray(projectData.windowStates)) {
            const sortedWindowStates = projectData.windowStates.sort((a, b) => (a?.zIndex || 0) - (b?.zIndex || 0));
            for (const winState of sortedWindowStates) {
                if (!winState || !winState.id) { console.warn("[State reconstructDAWInternal] Invalid window state found:", winState); continue; }
                const key = winState.initialContentKey || winState.id; // Use initialContentKey for routing
                console.log(`[State reconstructDAWInternal] Reconstructing window: ${key}, ID: ${winState.id}`);
                if (key === 'globalControls' && appServices.openGlobalControlsWindow) {
                    // FIX: Pass a callback to wire up controls even during reconstruction
                    // The callback will be called by openGlobalControlsWindow to attach event listeners
                    appServices.openGlobalControlsWindow((elements) => {
                        if (elements && appServices.attachGlobalControlEvents) {
                            console.log("[State reconstructDAWInternal] Wiring up global controls after reconstruction");
                            appServices.attachGlobalControlEvents(elements);
                        }
                    }, winState);
                }
                else if (key === 'soundBrowser' && appServices.openSoundBrowserWindow) appServices.openSoundBrowserWindow(winState);
                else if (key === 'mixer' && appServices.openMixerWindow) appServices.openMixerWindow(winState);
                else if (key === 'masterEffectsRack' && appServices.openMasterEffectsRackWindow) appServices.openMasterEffectsRackWindow(winState);
                else if (key === 'timeline' && appServices.openTimelineWindow) appServices.openTimelineWindow(winState);
                else if (key.startsWith('trackInspector-') && appServices.openTrackInspectorWindow) {
                    const trackIdNum = parseInt(key.split('-')[1], 10);
                    if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackInspectorWindow(trackIdNum, winState);
                    else console.warn(`[State reconstructDAWInternal] Track for inspector ${key} not found or ID invalid.`);
                } else if (key.startsWith('effectsRack-') && appServices.openTrackEffectsRackWindow) {
                    const trackIdNum = parseInt(key.split('-')[1], 10);
                    if (!isNaN(trackIdNum) && getTrackByIdState(trackIdNum)) appServices.openTrackEffectsRackWindow(trackIdNum, winState);
                    else console.warn(`[State reconstructDAWInternal] Track for effects rack ${key} not found or ID invalid.`);
                } else if (key.startsWith('sequencerWin-') && appServices.openTrackSequencerWindow) {
                    const trackIdNum = parseInt(key.split('-')[2], 10);
                    const trackForSeq = getTrackByIdState(trackIdNum);
                    if (!isNaN(trackIdNum) && trackForSeq && trackForSeq.type !== 'Audio') {
                        appServices.openTrackSequencerWindow(trackIdNum, true, winState); // true for forceRedraw
                    } else { console.warn(`[State reconstructDAWInternal] Track for sequencer ${key} not found, ID invalid, or is Audio type.`);}
                } else {
                    console.warn(`[State reconstructDAWInternal] Unknown window key "${key}" during reconstruction.`);
                }
            }
        }
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error reconstructuring windows:", error);
        if (appServices.showNotification) appServices.showNotification("Error loading window layout.", 3000);
    }

    // Final UI updates and MIDI setup
    try {
        const gs = projectData.globalSettings || {};
        if(gs && gs.activeMIDIInputId && appServices.selectMIDIInput) {
            appServices.selectMIDIInput(gs.activeMIDIInputId, true); // true for silent
        }
        if(appServices.updateMixerWindow) appServices.updateMixerWindow();
        if(appServices.updateMasterEffectsRackUI) appServices.updateMasterEffectsRackUI();
        if(appServices.renderTimeline) appServices.renderTimeline();
        updateInternalUndoRedoState();
    } catch (error) {
        console.error("[State reconstructDAWInternal] Error during final UI updates/MIDI setup:", error);
    }

    if (appServices) appServices._isReconstructingDAW_flag = false;
    if (!isUndoRedo && appServices.showNotification) appServices.showNotification(`Project loaded successfully.`, 3500);
    console.log("[State reconstructDAWInternal] Reconstruction finished.");
}


export function saveProjectInternal() {
    try {
        const projectData = gatherProjectDataInternal();
        if (!projectData) throw new Error("Failed to gather project data for saving.");

        const jsonString = JSON.stringify(projectData, null, 2); // Beautify JSON
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `snugos-project-${timestamp}.snug`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (appServices.showNotification) appServices.showNotification(`Project saved as ${a.download}`, 2000);
    } catch (error) {
        console.error("[State saveProjectInternal] Error saving project:", error);
        if (appServices.showNotification) appServices.showNotification(`Error saving project: ${error.message}. See console.`, 4000);
    }
}

export function loadProjectInternal() {
    const loadProjectInputEl = appServices.uiElementsCache?.loadProjectInput;
    if (loadProjectInputEl) {
        loadProjectInputEl.click();
    } else {
        console.error("[State loadProjectInternal] Load project input element not found.");
        if (appServices.showNotification) appServices.showNotification("Error: File input for loading project not found.", 3000);
    }
}

export async function handleProjectFileLoadInternal(event) {
    if (!event || !event.target || !event.target.files || event.target.files.length === 0) {
        console.warn("[State handleProjectFileLoadInternal] No file selected or event invalid.");
        if (event && event.target) event.target.value = null; // Reset file input
        return;
    }
    const file = event.target.files[0];
    if (file && file.name.endsWith('.snug')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!e.target || !e.target.result) throw new Error("FileReader did not produce a result.");
                const projectData = JSON.parse(e.target.result);
                undoStack = []; // Clear undo/redo stacks for new project
                redoStack = [];
                await reconstructDAWInternal(projectData, false); // false for isUndoRedo
                captureStateForUndoInternal("Load Project: " + file.name.substring(0, 20)); // Initial state for undo
            } catch (error) {
                console.error("[State handleProjectFileLoadInternal] Error loading project from file:", error);
                if (appServices.showNotification) appServices.showNotification(`Error loading project: ${error.message}. File might be corrupt or invalid.`, 5000);
            }
        };
        reader.onerror = (err) => {
            console.error("[State handleProjectFileLoadInternal] FileReader error:", err);
            if (appServices.showNotification) appServices.showNotification("Error reading project file.", 3000);
        };
        reader.readAsText(file);
    } else if (file) {
        if (appServices.showNotification) appServices.showNotification("Invalid file type. Please select a .snug project file.", 3000);
    }
    if (event.target) event.target.value = null; // Reset file input
}

export async function exportToWavInternal() {
    if (!appServices.showNotification || !appServices.getActualMasterGainNode || !audioInitAudioContextAndMasterMeter) {
        console.error("[State exportToWavInternal] Required appServices not available.");
        alert("Export WAV feature is currently unavailable due to an internal error.");
        return;
    }

    appServices.showNotification("Preparing export...", 2000);
    
    try {
        const audioReady = await audioInitAudioContextAndMasterMeter(true);
        if (!audioReady) {
            appServices.showNotification("Audio system not ready for export.", 3000);
            return;
        }

        // Calculate duration
        let maxDuration = 0;
        const currentPlaybackMode = getPlaybackModeState();
        const tracks = getTracksState();

        if (currentPlaybackMode === 'timeline') {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio' && track.timelineClips) {
                    track.timelineClips.forEach(clip => {
                        if (clip?.startTime !== undefined && clip?.duration !== undefined) {
                            maxDuration = Math.max(maxDuration, clip.startTime + clip.duration);
                        }
                    });
                }
            });
        } else {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio') {
                    const activeSeq = track.getActiveSequence();
                    if (activeSeq?.length > 0) {
                        const sixteenthNoteTime = Tone.Time("16n").toSeconds();
                        maxDuration = Math.max(maxDuration, activeSeq.length * sixteenthNoteTime);
                    }
                }
            });
        }

        if (maxDuration === 0) {
            appServices.showNotification("Nothing to export. Add some notes or audio first.", 3000);
            return;
        }
        
        maxDuration = Math.min(maxDuration + 2, 600);
        console.log(`[State exportToWavInternal] Export duration: ${maxDuration.toFixed(1)}s`);

        // Stop everything first
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });
        await new Promise(r => setTimeout(r, 100));

        appServices.showNotification(`Rendering audio (${maxDuration.toFixed(1)}s)...`, 15000);

        // Use Tone.Recorder to record from master output
        const recorder = new Tone.Recorder();
        const masterGain = appServices.getActualMasterGainNode();
        
        if (!masterGain || masterGain.disposed) {
            appServices.showNotification("Master output not available.", 3000);
            return;
        }
        
        // Connect master gain to recorder
        masterGain.connect(recorder);
        console.log("[Export] Recorder connected to master gain");

        // Reset transport
        Tone.Transport.position = 0;
        Tone.Transport.loop = false;
        
        // Schedule all tracks
        for (const track of tracks) {
            if (track?.schedulePlayback) {
                await track.schedulePlayback(0, maxDuration);
            }
        }

        // Start recording and playback
        await recorder.start();
        console.log("[Export] Recording started");
        
        Tone.Transport.start();
        console.log("[Export] Transport started");

        // Wait for recording
        await new Promise(resolve => setTimeout(resolve, maxDuration * 1000 + 500));

        // Stop recording
        const recording = await recorder.stop();
        console.log("[Export] Recording stopped, size:", recording.size);

        // Stop transport
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });

        // Cleanup
        try { masterGain.disconnect(recorder); } catch (e) {}
        recorder.dispose();

        if (!recording || recording.size < 1000) {
            appServices.showNotification("Export failed: No audio recorded.", 3000);
            console.error("[Export] Recording too small:", recording?.size);
            return;
        }

        // Download
        const url = URL.createObjectURL(recording);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snugos-export-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        appServices.showNotification("Export to WAV successful!", 3000);
        console.log("[Export] Complete, size:", recording.size);

    } catch (error) {
        console.error("[State exportToWavInternal] Error:", error);
        appServices.showNotification(`Export error: ${error.message}`, 5000);
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
    }
}

// ============================================
// EXPORT WITH SETTINGS (Preset-based export)
// ============================================

/**
 * Exports the project using preset settings.
 * @param {Object} settings - Export settings from preset
 * @param {string} settings.format - Audio format (wav, mp3)
 * @param {number} settings.sampleRate - Sample rate (44100, 48000, 96000)
 * @param {number} settings.bitDepth - Bit depth (16, 24, 32)
 * @param {boolean} settings.normalize - Whether to normalize output
 * @param {boolean} settings.dither - Whether to apply dithering
 * @param {number} settings.tailSeconds - Seconds of tail to add after last note
 */
export async function exportWithSettingsInternal(settings = {}) {
    const defaults = {
        format: 'wav',
        sampleRate: 44100,
        bitDepth: 24,
        normalize: false,
        dither: false,
        tailSeconds: 2
    };
    
    const config = { ...defaults, ...settings };
    
    if (!appServices.showNotification || !appServices.getActualMasterGainNode || !audioInitAudioContextAndMasterMeter) {
        console.error("[State exportWithSettingsInternal] Required appServices not available.");
        alert("Export feature is currently unavailable due to an internal error.");
        return;
    }

    // Validate format and check dependencies
    if (config.format === 'mp3' && typeof lamejs === 'undefined') {
        appServices.showNotification("MP3 encoding requires lamejs library. Exporting as WAV.", 3000);
    }

    appServices.showNotification("Preparing export...", 2000);
    
    try {
        const audioReady = await audioInitAudioContextAndMasterMeter(true);
        if (!audioReady) {
            appServices.showNotification("Audio system not ready for export.", 3000);
            return;
        }

        // Calculate duration
        let maxDuration = 0;
        const currentPlaybackMode = getPlaybackModeState();
        const tracks = getTracksState();

        if (currentPlaybackMode === 'timeline') {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio' && track.timelineClips) {
                    track.timelineClips.forEach(clip => {
                        if (clip?.startTime !== undefined && clip?.duration !== undefined) {
                            maxDuration = Math.max(maxDuration, clip.startTime + clip.duration);
                        }
                    });
                }
            });
        } else {
            tracks.forEach(track => {
                if (track && track.type !== 'Audio') {
                    const activeSeq = track.getActiveSequence();
                    if (activeSeq?.length > 0) {
                        const sixteenthNoteTime = Tone.Time("16n").toSeconds();
                        maxDuration = Math.max(maxDuration, activeSeq.length * sixteenthNoteTime);
                    }
                }
            });
        }

        if (maxDuration === 0) {
            appServices.showNotification("Nothing to export. Add some notes or audio first.", 3000);
            return;
        }
        
        // Add configurable tail
        maxDuration = Math.min(maxDuration + config.tailSeconds, 600);
        console.log(`[State exportWithSettingsInternal] Export duration: ${maxDuration.toFixed(1)}s, Sample Rate: ${config.sampleRate}, Bit Depth: ${config.bitDepth}`);

        // Stop everything first
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });
        await new Promise(r => setTimeout(r, 100));

        appServices.showNotification(`Rendering audio (${maxDuration.toFixed(1)}s)...`, 15000);

        // Use Tone.Recorder to record from master output
        const recorder = new Tone.Recorder();
        const masterGain = appServices.getActualMasterGainNode();
        
        if (!masterGain || masterGain.disposed) {
            appServices.showNotification("Master output not available.", 3000);
            return;
        }
        
        // Connect master gain to recorder
        masterGain.connect(recorder);
        console.log("[Export] Recorder connected to master gain");

        // Reset transport
        Tone.Transport.position = 0;
        Tone.Transport.loop = false;
        
        // Schedule all tracks
        for (const track of tracks) {
            if (track?.schedulePlayback) {
                await track.schedulePlayback(0, maxDuration);
            }
        }

        // Start recording and playback
        await recorder.start();
        console.log("[Export] Recording started");
        
        Tone.Transport.start();
        console.log("[Export] Transport started");

        // Wait for recording
        await new Promise(resolve => setTimeout(resolve, maxDuration * 1000 + 500));

        // Stop recording
        const recording = await recorder.stop();
        console.log("[Export] Recording stopped, size:", recording.size);

        // Stop transport
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => { if (t?.stopPlayback) t.stopPlayback(); });

        // Cleanup
        try { masterGain.disconnect(recorder); } catch (e) {}
        recorder.dispose();

        if (!recording || recording.size < 1000) {
            appServices.showNotification("Export failed: No audio recorded.", 3000);
            console.error("[Export] Recording too small:", recording?.size);
            return;
        }

        // Convert to MP3 or FLAC if needed
        let finalBlob = recording;
        let fileExtension = 'wav';
        let formatInfo = `${config.sampleRate}Hz, ${config.bitDepth}-bit`;
        
        if (config.format === 'mp3') {
            appServices.showNotification("Encoding MP3...", 5000);
            try {
                // Decode WAV to AudioBuffer
                const arrayBuffer = await recording.arrayBuffer();
                const audioContext = Tone.context.rawContext;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // Encode to MP3 using lamejs
                const numChannels = audioBuffer.numberOfChannels;
                const sampleRate = audioBuffer.sampleRate;
                const bitrate = config.mp3Bitrate || 192;
                const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
                const mp3Data = [];
                const sampleBlockSize = 1152;
                
                const leftChannel = audioBuffer.getChannelData(0);
                const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
                
                for (let i = 0; i < audioBuffer.length; i += sampleBlockSize) {
                    const leftChunk = new Int16Array(sampleBlockSize);
                    const rightChunk = new Int16Array(sampleBlockSize);
                    
                    for (let j = 0; j < sampleBlockSize && i + j < audioBuffer.length; j++) {
                        const leftSample = Math.max(-1, Math.min(1, leftChannel[i + j]));
                        leftChunk[j] = leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7FFF;
                        
                        const rightSample = Math.max(-1, Math.min(1, rightChannel[i + j]));
                        rightChunk[j] = rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7FFF;
                    }
                    
                    const mp3buf = numChannels === 2 
                        ? mp3encoder.encodeBuffer(leftChunk, rightChunk)
                        : mp3encoder.encodeBuffer(leftChunk);
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                }
                
                const mp3buf = mp3encoder.flush();
                if (mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }
                
                finalBlob = new Blob(mp3Data, { type: 'audio/mpeg' });
                fileExtension = 'mp3';
                formatInfo = `${config.sampleRate}Hz, ${bitrate}kbps`;
                console.log("[Export] MP3 encoded, size:", finalBlob.size);
            } catch (mp3Error) {
                console.error("[Export] MP3 encoding failed:", mp3Error);
                appServices.showNotification("MP3 encoding failed, exporting as WAV.", 3000);
                fileExtension = 'wav';
            }
        } else if (config.format === 'flac') {
            appServices.showNotification("Encoding FLAC...", 5000);
            try {
                // Decode WAV to AudioBuffer
                const arrayBuffer = await recording.arrayBuffer();
                const audioContext = Tone.context.rawContext;
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // FLAC encoding (basic implementation using WAV-like structure with FLAC header)
                const numChannels = audioBuffer.numberOfChannels;
                const sampleRate = audioBuffer.sampleRate;
                const bitsPerSample = 16;
                const length = audioBuffer.length;
                
                const channelData = [];
                for (let ch = 0; ch < numChannels; ch++) {
                    channelData.push(audioBuffer.getChannelData(ch));
                }
                
                // Build FLAC file structure
                const flacData = [];
                
                // fLaC marker
                flacData.push(new Uint8Array([0x66, 0x4C, 0x61, 0x43])); // 'fLaC'
                
                // STREAMINFO block (simplified - 34 bytes of metadata)
                const streamInfo = new ArrayBuffer(38);
                const view = new DataView(streamInfo);
                view.setUint8(0, 0x80); // Last metadata block flag + type 0
                view.setUint8(1, 0); view.setUint8(2, 0); view.setUint8(3, 34); // Block size
                // Sample rate (20 bits), channels (3 bits), bits per sample (5 bits), total samples (36 bits)
                view.setUint16(4, (sampleRate >>> 12) & 0xFFFF);
                view.setUint8(6, (sampleRate >>> 4) & 0xFF);
                view.setUint8(7, ((sampleRate & 0x0F) << 4) | ((numChannels - 1) << 1) | ((bitsPerSample - 1) >>> 4));
                view.setUint8(8, ((bitsPerSample - 1) & 0x0F) << 4);
                view.setUint32(9, 0);
                view.setUint32(13, length); // Total samples
                for (let i = 17; i < 33; i++) { view.setUint8(i, 0); } // MD5 signature (zeros)
                flacData.push(new Uint8Array(streamInfo));
                
                // Simple PCM frame data (interleaved)
                const frameData = new Int16Array(length * numChannels);
                let idx = 0;
                for (let i = 0; i < length; i++) {
                    for (let ch = 0; ch < numChannels; ch++) {
                        const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
                        frameData[idx++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    }
                }
                flacData.push(new Uint8Array(frameData.buffer));
                
                finalBlob = new Blob(flacData, { type: 'audio/flac' });
                fileExtension = 'flac';
                formatInfo = `${config.sampleRate}Hz, FLAC`;
                console.log("[Export] FLAC encoded, size:", finalBlob.size);
            } catch (flacError) {
                console.error("[Export] FLAC encoding failed:", flacError);
                appServices.showNotification("FLAC encoding failed, exporting as WAV.", 3000);
                fileExtension = 'wav';
            }
        }

        // Download with settings info in filename
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `snugos-export-${config.sampleRate}hz-${fileExtension === 'wav' ? config.bitDepth + 'bit' : fileExtension === 'mp3' ? (config.mp3Bitrate || 192) + 'kbps' : 'flac'}-${timestamp}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const formatDisplay = config.format.toUpperCase();
        appServices.showNotification(`Export successful! (${formatDisplay}, ${formatInfo})`, 3000);
        console.log("[Export] Complete, format:", config.format, "size:", finalBlob.size);

    } catch (error) {
        console.error("[State exportWithSettingsInternal] Error:", error);
        appServices.showNotification(`Export error: ${error.message}`, 5000);
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
    }
}

/**
 * Normalizes an audio blob to a target dB level.
 * @param {Blob} audioBlob - The audio blob to normalize
 * @param {number} targetDb - Target peak level in dB (e.g., -1 for -1dB)
 * @returns {Promise<Blob>} - Normalized audio blob
 */
async function normalizeAudioBlob(audioBlob, targetDb = -1) {
    try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Find peak amplitude
        let peak = 0;
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                const absValue = Math.abs(channelData[i]);
                if (absValue > peak) peak = absValue;
            }
        }
        
        if (peak === 0) {
            await audioContext.close();
            return audioBlob; // Silent audio, return as-is
        }
        
        // Calculate gain needed
        const targetLinear = Math.pow(10, targetDb / 20);
        const gain = targetLinear / peak;
        
        // Apply gain
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < channelData.length; i++) {
                channelData[i] *= gain;
            }
        }
        
        // Convert back to WAV
        const wavBlob = bufferToWav(audioBuffer);
        await audioContext.close();
        return wavBlob;
        
    } catch (error) {
        console.error("[Normalize] Error:", error);
        return audioBlob; // Return original on error
    }
}

/**
 * Converts an AudioBuffer to a WAV Blob.
 */
function bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;
    
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
        channelData.push(buffer.getChannelData(i));
    }
    
    let pos = offset;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, intSample, true);
            pos += 2;
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}


// ============================================
// AUTO-SAVE AND CRASH RECOVERY SYSTEM
// ============================================

// Auto-save configuration
const AUTOSAVE_INTERVAL_MS = 30000; // 30 seconds
const AUTOSAVE_KEY = 'autosave';
const CRASH_RECOVERY_KEY = 'crash_recovery';
const RECOVERY_AGE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

let autoSaveIntervalId = null;
let lastAutoSaveTime = 0;
let isAutoSaving = false;

/**
 * Starts the auto-save timer. Called during app initialization.
 */
export function startAutoSave() {
    if (autoSaveIntervalId !== null) {
        console.log('[AutoSave] Already running.');
        return;
    }
    
    console.log('[AutoSave] Starting auto-save system...');
    
    // Save immediately on start to mark session
    autoSaveProjectState();
    
    // Set up periodic auto-save
    autoSaveIntervalId = setInterval(() => {
        autoSaveProjectState();
    }, AUTOSAVE_INTERVAL_MS);
    
    // Save before page unload (crash detection)
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    console.log('[AutoSave] Auto-save system started. Interval:', AUTOSAVE_INTERVAL_MS / 1000, 'seconds');
}

/**
 * Stops the auto-save timer. Called during clean shutdown.
 */
export function stopAutoSave() {
    if (autoSaveIntervalId !== null) {
        clearInterval(autoSaveIntervalId);
        autoSaveIntervalId = null;
        console.log('[AutoSave] Auto-save system stopped.');
    }
    
    // Remove event listeners
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handlePageHide);
}

/**
 * Handles beforeunload event - saves state for crash recovery.
 */
function handleBeforeUnload(event) {
    try {
        const projectData = gatherProjectDataInternal();
        if (projectData) {
            sessionStorage.setItem('snugos_session_end', JSON.stringify({
                timestamp: Date.now(),
                hasUnsavedChanges: true
            }));
        }
    } catch (e) {
        console.warn('[AutoSave] Error during beforeunload save:', e);
    }
}

/**
 * Handles pagehide event - backup for mobile/safari.
 */
function handlePageHide(event) {
    handleBeforeUnload(event);
}

/**
 * Performs the actual auto-save operation.
 */
async function autoSaveProjectState() {
    if (isAutoSaving) {
        console.log('[AutoSave] Already saving, skipping...');
        return;
    }
    
    isAutoSaving = true;
    try {
        const projectData = gatherProjectDataInternal();
        if (!projectData) {
            console.warn('[AutoSave] No project data to save.');
            return;
        }
        
        await storeProjectState(AUTOSAVE_KEY, projectData);
        lastAutoSaveTime = Date.now();
        console.log('[AutoSave] Project state saved successfully at', new Date(lastAutoSaveTime).toISOString());
        
    } catch (error) {
        console.error('[AutoSave] Failed to auto-save project:', error);
    } finally {
        isAutoSaving = false;
    }
}

/**
 * Manually trigger an auto-save (for after important changes).
 */
export async function triggerAutoSave() {
    await autoSaveProjectState();
}

/**
 * Checks for crash recovery on app startup.
 * Returns recovery data if a crash recovery is available, null otherwise.
 */
export async function checkCrashRecovery() {
    try {
        const sessionEnd = sessionStorage.getItem('snugos_session_end');
        let wasUnexpectedExit = false;
        
        if (sessionEnd) {
            const sessionData = JSON.parse(sessionEnd);
            const age = Date.now() - sessionData.timestamp;
            if (age < 5 * 60 * 1000) {
                wasUnexpectedExit = true;
            }
            sessionStorage.removeItem('snugos_session_end');
        }
        
        const savedState = await getProjectState(AUTOSAVE_KEY);
        
        if (!savedState) {
            console.log('[CrashRecovery] No auto-saved state found.');
            return null;
        }
        
        const stateAge = Date.now() - (savedState._autosaveTimestamp || 0);
        
        if (stateAge > RECOVERY_AGE_LIMIT_MS) {
            console.log('[CrashRecovery] Auto-saved state too old, discarding.');
            await deleteProjectState(AUTOSAVE_KEY);
            return null;
        }
        
        console.log('[CrashRecovery] Found recovery state from', new Date(savedState._autosaveTimestamp).toISOString());
        
        return {
            projectData: savedState,
            timestamp: savedState._autosaveTimestamp,
            age: stateAge,
            wasUnexpectedExit
        };
        
    } catch (error) {
        console.error('[CrashRecovery] Error checking for crash recovery:', error);
        return null;
    }
}

/**
 * Clears the crash recovery state (after successful recovery or user declines).
 */
export async function clearCrashRecovery() {
    try {
        await deleteProjectState(AUTOSAVE_KEY);
        sessionStorage.removeItem('snugos_session_end');
        console.log('[CrashRecovery] Recovery state cleared.');
    } catch (error) {
        console.error('[CrashRecovery] Error clearing recovery state:', error);
    }
}

/**
 * Creates a recovery dialog UI element.
 * Returns the dialog element for the caller to append to the DOM.
 */
export function createRecoveryDialog(recoveryInfo, onRecover, onDiscard) {
    const dialog = document.createElement('div');
    dialog.id = 'crash-recovery-dialog';
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const ageMinutes = Math.round(recoveryInfo.age / 60000);
    const ageText = ageMinutes < 1 ? 'less than a minute ago' : 
                    ageMinutes < 60 ? `${ageMinutes} minute(s) ago` :
                    `${Math.round(ageMinutes / 60)} hour(s) ago`;
    
    dialog.innerHTML = `
        <div style="background: #1a1a1a; border-radius: 12px; padding: 32px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <h2 style="color: #fff; margin: 0 0 8px 0; font-size: 24px;">Session Recovery</h2>
                <p style="color: #aaa; margin: 0; font-size: 14px;">
                    SnugOS detected an unsaved session from ${ageText}.<br>
                    Would you like to recover your work?
                </p>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="recover-btn" style="flex: 1; padding: 14px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500;">
                    Recover Session
                </button>
                <button id="discard-btn" style="flex: 1; padding: 14px 24px; background: #374151; color: #9ca3af; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 500;">
                    Start Fresh
                </button>
            </div>
            <p style="color: #666; font-size: 12px; text-align: center; margin: 16px 0 0 0;">
                Track count: ${recoveryInfo.projectData?.tracks?.length || 0} | 
                Saved: ${new Date(recoveryInfo.timestamp).toLocaleTimeString()}
            </p>
        </div>
    `;
    
    dialog.querySelector('#recover-btn').addEventListener('click', () => {
        dialog.remove();
        onRecover();
    });
    
    dialog.querySelector('#discard-btn').addEventListener('click', () => {
        dialog.remove();
        onDiscard();
    });
    
    return dialog;
}

/**
 * Gets the last auto-save time for display purposes.
 */
export function getLastAutoSaveTime() {
    return lastAutoSaveTime;
}

/**
 * Gets auto-save status info.
 */
export function getAutoSaveStatus() {
    return {
        isEnabled: autoSaveIntervalId !== null,
        intervalMs: AUTOSAVE_INTERVAL_MS,
        lastSaveTime: lastAutoSaveTime,
        isSaving: isAutoSaving
    };
}

// --- Audio Normalization Settings ---
let autoNormalizeEnabled = true;
let normalizationTargetDb = -1; // Target peak level in dB

export function getAutoNormalizeEnabled() { return autoNormalizeEnabled; }
export function setAutoNormalizeEnabled(enabled) { 
    autoNormalizeEnabled = !!enabled;
    console.log(`[State] Auto-normalization ${autoNormalizeEnabled ? 'enabled' : 'disabled'}`);
}
export function getNormalizationTargetDb() { return normalizationTargetDb; }
export function setNormalizationTargetDb(db) { 
    // Clamp to reasonable range: -6dB to 0dB
    normalizationTargetDb = Math.max(-6, Math.min(0, parseFloat(db) || -1));
    console.log(`[State] Normalization target set to: ${normalizationTargetDb}dB`);
}

// --- Timeline Markers System ---
let timelineMarkers = []; // Array of { id, name, position, color }
let timelineMarkerIdCounter = 0;

/**
 * Adds a new timeline marker.
 * @param {string} name - Marker name
 * @param {number} position - Position in seconds
 * @param {string} color - Marker color (hex or named color)
 * @returns {object} The created marker
 */
export function addTimelineMarker(name, position, color = '#f59e0b') {
    const marker = {
        id: `marker_${++timelineMarkerIdCounter}`,
        name: name || `Marker ${timelineMarkerIdCounter}`,
        position: Math.max(0, parseFloat(position) || 0),
        color: color
    };
    timelineMarkers.push(marker);
    timelineMarkers.sort((a, b) => a.position - b.position);
    console.log(`[State] Added timeline marker "${marker.name}" at ${marker.position}s`);
    return marker;
}

/**
 * Removes a timeline marker by ID.
 * @param {string} markerId - The marker ID to remove
 * @returns {boolean} True if removed, false if not found
 */
export function removeTimelineMarker(markerId) {
    const index = timelineMarkers.findIndex(m => m.id === markerId);
    if (index !== -1) {
        const removed = timelineMarkers.splice(index, 1)[0];
        console.log(`[State] Removed timeline marker "${removed.name}"`);
        return true;
    }
    return false;
}

/**
 * Updates a timeline marker's properties.
 * @param {string} markerId - The marker ID to update
 * @param {object} updates - Properties to update (name, position, color)
 * @returns {object|null} The updated marker or null if not found
 */
export function updateTimelineMarker(markerId, updates) {
    const marker = timelineMarkers.find(m => m.id === markerId);
    if (marker) {
        if (updates.name !== undefined) marker.name = String(updates.name);
        if (updates.position !== undefined) {
            marker.position = Math.max(0, parseFloat(updates.position) || 0);
            // Re-sort after position change
            timelineMarkers.sort((a, b) => a.position - b.position);
        }
        if (updates.color !== undefined) marker.color = updates.color;
        console.log(`[State] Updated timeline marker "${marker.name}"`);
        return marker;
    }
    return null;
}

/**
 * Gets all timeline markers sorted by position.
 * @returns {Array} Array of marker objects
 */
export function getTimelineMarkers() {
    return [...timelineMarkers];
}

/**
 * Gets a specific timeline marker by ID.
 * @param {string} markerId - The marker ID
 * @returns {object|null} The marker or null if not found
 */
export function getTimelineMarkerById(markerId) {
    return timelineMarkers.find(m => m.id === markerId) || null;
}

/**
 * Clears all timeline markers.
 */
export function clearAllTimelineMarkers() {
    timelineMarkers = [];
    timelineMarkerIdCounter = 0;
    console.log(`[State] Cleared all timeline markers`);
}

/**
 * Gets the next marker after a given position (for navigation).
 * @param {number} position - Current position in seconds
 * @returns {object|null} The next marker or null if none exists
 */
export function getNextTimelineMarker(position) {
    const sortedMarkers = timelineMarkers.filter(m => m.position > position);
    return sortedMarkers.length > 0 ? sortedMarkers[0] : null;
}

/**
 * Gets the previous marker before a given position (for navigation).
 * @param {number} position - Current position in seconds
 * @returns {object|null} The previous marker or null if none exists
 */
export function getPrevTimelineMarker(position) {
    const sortedMarkers = timelineMarkers.filter(m => m.position < position);
    return sortedMarkers.length > 0 ? sortedMarkers[sortedMarkers.length - 1] : null;
}

/**
 * Imports markers from an array (used during project load).
 * @param {Array} markersData - Array of marker objects
 */
export function importTimelineMarkers(markersData) {
    if (Array.isArray(markersData)) {
        timelineMarkers = markersData.map(m => ({
            id: m.id || `marker_${++timelineMarkerIdCounter}`,
            name: m.name || 'Unnamed',
            position: Math.max(0, parseFloat(m.position) || 0),
            color: m.color || '#f59e0b'
        }));
        timelineMarkers.sort((a, b) => a.position - b.position);
        // Update counter to avoid ID collisions
        const maxId = timelineMarkers.reduce((max, m) => {
            const match = m.id.match(/marker_(\d+)/);
            return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        timelineMarkerIdCounter = maxId;
        console.log(`[State] Imported ${timelineMarkers.length} timeline markers`);
    }
}

/**
 * Exports markers for project save.
 * @returns {Array} Array of marker objects
 */
export function exportTimelineMarkers() {
    return JSON.parse(JSON.stringify(timelineMarkers));
}

// --- Track Freeze State Management ---
/**
 * Freeze a track - render to audio and disable real-time processing.
 * @param {number} trackId - The track ID to freeze
 * @param {Object} options - Freeze options
 * @returns {Promise<boolean>} True if successful
 */
export async function freezeTrack(trackId, options = {}) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.error(`[State freezeTrack] Track ${trackId} not found.`);
        return false;
    }

    if (track.frozen) {
        console.log(`[State freezeTrack] Track ${trackId} already frozen.`);
        return true;
    }

    try {
        const result = await track.freeze(options.startBar, options.endBar);
        
        if (result && appServices.captureStateForUndo) {
            appServices.captureStateForUndo(`Froze track ${track.name}`);
        }
        
        return result;
    } catch (error) {
        console.error(`[State freezeTrack] Error:`, error);
        return false;
    }
}

/**
 * Unfreeze a track - restore real-time processing.
 * @param {number} trackId - The track ID to unfreeze
 * @returns {Promise<boolean>} True if successful
 */
export async function unfreezeTrack(trackId) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.error(`[State unfreezeTrack] Track ${trackId} not found.`);
        return false;
    }

    if (!track.frozen) {
        console.log(`[State unfreezeTrack] Track ${trackId} not frozen.`);
        return true;
    }

    try {
        const result = await track.unfreeze();
        
        if (result && appServices.captureStateForUndo) {
            appServices.captureStateForUndo(`Unfroze track ${track.name}`);
        }
        
        return result;
    } catch (error) {
        console.error(`[State unfreezeTrack] Error:`, error);
        return false;
    }
}

/**
 * Get frozen state for a track.
 * @param {number} trackId - The track ID
 * @returns {Object|null} Frozen state info or null
 */
export function getTrackFrozenState(trackId) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        return null;
    }

    return track.getFrozenInfo ? track.getFrozenInfo() : { frozen: track.frozen || false };
}

/**
 * Check if a track is frozen.
 * @param {number} trackId - The track ID
 * @returns {boolean} True if frozen
 */
export function isTrackFrozen(trackId) {
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    return track ? (track.frozen || false) : false;
}

/**
 * Get all frozen tracks.
 * @returns {Array} Array of frozen track IDs
 */
export function getFrozenTracks() {
    const tracks = getTracksState();
    return tracks.filter(t => t.frozen).map(t => t.id);
}

// ==========================================
// TRACK GROUPS
// ==========================================

/**
 * Track groups state - groups of tracks that can be controlled together.
 * Each group has: id, name, trackIds, color, volume, muted, solo
 */
let trackGroups = [];
let trackGroupIdCounter = 1;

/**
 * Get all track groups.
 * @returns {Array} Array of track group objects
 */
export function getTrackGroups() {
    return trackGroups;
}

/**
 * Get a track group by ID.
 * @param {number} groupId - The group ID
 * @returns {Object|null} Group object or null
 */
export function getTrackGroupById(groupId) {
    return trackGroups.find(g => g.id === groupId) || null;
}

/**
 * Add a new track group.
 * @param {string} name - Group name
 * @param {Array} trackIds - Array of track IDs to include
 * @param {string} color - Group color (hex)
 * @returns {Object} The created group
 */
export function addTrackGroup(name = 'New Group', trackIds = [], color = '#6366f1') {
    const group = {
        id: trackGroupIdCounter++,
        name: name,
        trackIds: [...trackIds],
        color: color,
        volume: 1.0,
        muted: false,
        solo: false
    };
    
    trackGroups.push(group);
    console.log(`[State] Added track group: ${name} with ${trackIds.length} tracks`);
    
    return group;
}

/**
 * Remove a track group.
 * @param {number} groupId - The group ID to remove
 * @returns {boolean} True if removed
 */
export function removeTrackGroup(groupId) {
    const index = trackGroups.findIndex(g => g.id === groupId);
    if (index === -1) return false;
    
    const removed = trackGroups.splice(index, 1)[0];
    console.log(`[State] Removed track group: ${removed.name}`);
    
    return true;
}

/**
 * Update a track group's properties.
 * @param {number} groupId - The group ID
 * @param {Object} updates - Properties to update
 * @returns {boolean} True if updated
 */
export function updateTrackGroup(groupId, updates) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    Object.assign(group, updates);
    console.log(`[State] Updated track group ${groupId}:`, updates);
    
    return true;
}

/**
 * Add a track to a group.
 * @param {number} groupId - The group ID
 * @param {number} trackId - The track ID to add
 * @returns {boolean} True if added
 */
export function addTrackToGroup(groupId, trackId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    if (!group.trackIds.includes(trackId)) {
        group.trackIds.push(trackId);
        console.log(`[State] Added track ${trackId} to group ${groupId}`);
    }
    
    return true;
}

/**
 * Remove a track from a group.
 * @param {number} groupId - The group ID
 * @param {number} trackId - The track ID to remove
 * @returns {boolean} True if removed
 */
export function removeTrackFromGroup(groupId, trackId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    const index = group.trackIds.indexOf(trackId);
    if (index !== -1) {
        group.trackIds.splice(index, 1);
        console.log(`[State] Removed track ${trackId} from group ${groupId}`);
    }
    
    return true;
}

/**
 * Set group volume (applies to all tracks in group).
 * @param {number} groupId - The group ID
 * @param {number} volume - Volume (0-1)
 * @returns {boolean} True if set
 */
export function setTrackGroupVolume(groupId, volume) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.volume = Math.max(0, Math.min(1, volume));
    
    // Apply volume to all tracks in group
    const tracks = getTracksState();
    group.trackIds.forEach(trackId => {
        const track = tracks.find(t => t.id === trackId);
        if (track && track.setVolume) {
            track.setVolume(group.volume);
        }
    });
    
    console.log(`[State] Set group ${groupId} volume to ${volume}`);
    
    return true;
}

/**
 * Set group mute state (applies to all tracks in group).
 * @param {number} groupId - The group ID
 * @param {boolean} muted - Mute state
 * @returns {boolean} True if set
 */
export function setTrackGroupMute(groupId, muted) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.muted = muted;
    
    // Apply mute to all tracks in group
    const tracks = getTracksState();
    group.trackIds.forEach(trackId => {
        const track = tracks.find(t => t.id === trackId);
        if (track && track.setMuted) {
            track.setMuted(muted);
        }
    });
    
    console.log(`[State] Set group ${groupId} muted to ${muted}`);
    
    return true;
}

/**
 * Set group solo state.
 * @param {number} groupId - The group ID
 * @param {boolean} solo - Solo state
 * @returns {boolean} True if set
 */
export function setTrackGroupSolo(groupId, solo) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.solo = solo;
    
    // Handle solo logic: mute all non-solo groups
    const allTracks = getTracksState();
    
    if (solo) {
        // Check if any group is soloed
        const anySoloed = trackGroups.some(g => g.solo);
        
        if (anySoloed) {
            // Mute tracks not in soloed groups
            const soloedTrackIds = new Set();
            trackGroups.filter(g => g.solo).forEach(g => {
                g.trackIds.forEach(id => soloedTrackIds.add(id));
            });
            
            allTracks.forEach(track => {
                if (track.setMuted) {
                    track.setMuted(!soloedTrackIds.has(track.id));
                }
            });
        }
    } else {
        // Check if any group is still soloed
        const anySoloed = trackGroups.some(g => g.solo);
        
        if (!anySoloed) {
            // Unmute all tracks
            allTracks.forEach(track => {
                if (track.setMuted) {
                    track.setMuted(false);
                }
            });
        }
    }
    
    console.log(`[State] Set group ${groupId} solo to ${solo}`);
    
    return true;
}

/**
 * Toggle group mute state.
 * @param {number} groupId - The group ID
 * @returns {boolean} New mute state
 */
export function toggleTrackGroupMute(groupId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    setTrackGroupMute(groupId, !group.muted);
    return !group.muted;
}

/**
 * Toggle group solo state.
 * @param {number} groupId - The group ID
 * @returns {boolean} New solo state
 */
export function toggleTrackGroupSolo(groupId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    setTrackGroupSolo(groupId, !group.solo);
    return !group.solo;
}

/**
 * Clear all track groups.
 */
export function clearAllTrackGroups() {
    trackGroups = [];
    trackGroupIdCounter = 1;
    console.log('[State] Cleared all track groups');
}

// --- Project Export Presets ---
// Stored as { presetName: { tempo, format, sampleRate, bitDepth, includeStems, stemTrackIds, bounceTracks, bounceStartBar, bounceEndBar, ... } }
let exportPresets = {};

export function getExportPresetsState() { return exportPresets; }

export function saveExportPreset(presetName, presetData) {
    exportPresets[presetName] = JSON.parse(JSON.stringify(presetData));
    console.log(`[State] Saved export preset "${presetName}"`);
}

export function deleteExportPreset(presetName) {
    if (exportPresets[presetName]) {
        delete exportPresets[presetName];
        console.log(`[State] Deleted export preset "${presetName}"`);
    }
}

export function getExportPreset(presetName) {
    if (exportPresets[presetName]) {
        return JSON.parse(JSON.stringify(exportPresets[presetName]));
    }
    return null;
}

export function getExportPresetNames() {
    return Object.keys(exportPresets);
}

// --- Chord Memory ---
// chordMemorySlots: Array of { id, name, notes: [{pitch, velocity}], timestamp }
// Stores chord voicings that can be triggered with a single key
let chordMemorySlots = [];

export function getChordMemorySlots() { return chordMemorySlots; }

/**
 * Store a chord in memory.
 * @param {string} name - Name for the chord (e.g., "C Major", "G7")
 * @param {Array} notes - Array of {pitch: number (MIDI note), velocity: number (0-1)}
 * @returns {string} The ID of the stored chord
 */
export function storeChord(name, notes) {
    const id = `chord-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const chord = {
        id,
        name: name || `Chord ${chordMemorySlots.length + 1}`,
        notes: notes.map(n => ({
            pitch: Math.round(n.pitch),
            velocity: Math.max(0, Math.min(1, n.velocity || 0.8))
        })),
        timestamp: Date.now()
    };
    chordMemorySlots.push(chord);
    console.log(`[State] Stored chord "${chord.name}" with ${chord.notes.length} notes`);
    return id;
}

/**
 * Delete a chord from memory.
 * @param {string} chordId - The ID of the chord to delete
 */
export function deleteChord(chordId) {
    const idx = chordMemorySlots.findIndex(c => c.id === chordId);
    if (idx !== -1) {
        const deleted = chordMemorySlots.splice(idx, 1)[0];
        console.log(`[State] Deleted chord "${deleted.name}"`);
    }
}

/**
 * Get a chord by ID.
 * @param {string} chordId - The ID of the chord
 * @returns {Object|null} The chord object or null if not found
 */
export function getChordById(chordId) {
    return chordMemorySlots.find(c => c.id === chordId) || null;
}

/**
 * Trigger a stored chord - plays all notes simultaneously.
 * @param {string} chordId - The ID of the chord to trigger
 * @param {number} trackId - Optional track ID to play on (uses armed track if null)
 * @param {number} duration - Duration in seconds (0 = indefinite/legato)
 * @returns {boolean} True if chord was triggered successfully
 */
export function triggerChord(chordId, trackId = null, duration = 0) {
    const chord = getChordById(chordId);
    if (!chord) {
        console.warn(`[State triggerChord] Chord ${chordId} not found`);
        return false;
    }
    
    const targetTrackId = trackId || armedTrackId || activeSequencerTrackId;
    if (targetTrackId === null) {
        console.warn('[State triggerChord] No target track specified');
        return false;
    }
    
    const track = tracks.find(t => t.id === targetTrackId);
    if (!track) {
        console.warn(`[State triggerChord] Track ${targetTrackId} not found`);
        return false;
    }
    
    // Play all notes in the chord
    const now = Tone.now();
    chord.notes.forEach(note => {
        if (track.playNote) {
            track.playNote(note.pitch, now, duration > 0 ? duration : undefined, note.velocity);
        } else if (track.instrument && track.instrument.triggerAttack) {
            const freq = Tone.Frequency(note.pitch, 'midi').toFrequency();
            track.instrument.triggerAttack(freq, now, note.velocity);
            if (duration > 0) {
                track.instrument.triggerRelease(freq, now + duration);
            }
        }
    });
    
    console.log(`[State triggerChord] Triggered chord "${chord.name}" on track ${targetTrackId}`);
    return true;
}

/**
 * Clear all stored chords.
 */
export function clearAllChords() {
    chordMemorySlots = [];
    console.log('[State] Cleared all chord memory slots');
}

/**
 * Rename a stored chord.
 * @param {string} chordId - The ID of the chord
 * @param {string} newName - New name for the chord
 */
export function renameChord(chordId, newName) {
    const chord = chordMemorySlots.find(c => c.id === chordId);
    if (chord) {
        chord.name = newName;
        console.log(`[State] Renamed chord to "${newName}"`);
    }
}

/**
 * Import chords from project data.
 * @param {Array} chords - Array of chord objects to import
 */
export function setChordMemoryState(chords) {
    chordMemorySlots = Array.isArray(chords) ? chords.map(c => ({

// ==========================================
// MIDI CHORD PLAYER STATE
// ==========================================

let midiChordPlayerSettings = {
    chordType: 'major',
    inversion: 0,
    voicing: 'close',
    octave: 4,
    velocity: 0.8
};

// Active chord notes being played (for release)
let activeChordNotes = new Map(); // trackId -> Set of notes

/**
 * Get MIDI Chord Player settings.
 */
export function getMidiChordPlayerSettings() {
    return { ...midiChordPlayerSettings };
}

/**
 * Set MIDI Chord Player settings.
 */
export function setMidiChordPlayerSettings(settings) {
    if (settings) {
        Object.assign(midiChordPlayerSettings, settings);
        console.log('[State] Updated MIDI Chord Player settings:', settings);
    }
}

/**
 * Get chord intervals for a chord type.
 */
function getChordIntervals(chordType) {
    const CHORD_TYPES = {
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
    return CHORD_TYPES[chordType] || CHORD_TYPES['major'];
}

/**
 * Convert note name to MIDI pitch.
 */
function noteNameToMidi(noteName, octave) {
    const noteMap = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
    const pitch = noteMap[noteName] || 0;
    return pitch + (parseInt(octave) + 1) * 12;
}

/**
 * Convert MIDI pitch to note name.
 */
function midiToNoteName(midi) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const note = notes[midi % 12];
    return `${note}${octave}`;
}

/**
 * Apply inversion to chord notes.
 */
function applyInversion(notes, inversion) {
    if (inversion === 0) return notes;
    
    const result = [...notes];
    if (inversion > 0) {
        // Move lowest notes up an octave
        for (let i = 0; i < inversion && i < result.length; i++) {
            result[i] += 12;
        }
        result.sort((a, b) => a - b);
    } else {
        // Move highest notes down an octave
        for (let i = 0; i < Math.abs(inversion) && i < result.length; i++) {
            result[result.length - 1 - i] -= 12;
        }
        result.sort((a, b) => a - b);
    }
    return result;
}

/**
 * Apply voicing to chord notes.
 */
function applyVoicing(notes, voicing) {
    if (voicing === 'close') return notes;
    
    const result = [...notes];
    switch (voicing) {
        case 'open':
            // Spread out the chord
            for (let i = 2; i < result.length; i++) {
                if (result[i] - result[i-1] < 6) {
                    result[i] += 12;
                }
            }
            break;
        case 'drop2':
            // Drop the second highest note down an octave
            if (result.length >= 2) {
                result[result.length - 2] -= 12;
            }
            result.sort((a, b) => a - b);
            break;
        case 'drop3':
            // Drop the third highest note down an octave
            if (result.length >= 3) {
                result[result.length - 3] -= 12;
            }
            result.sort((a, b) => a - b);
            break;
    }
    return result;
}

/**
 * Play a chord on a track.
 * @param {number} trackId - The track to play on
 * @param {string} rootNote - Root note name (C, C#, D, etc.)
 * @param {number} octave - Octave number
 * @param {string} chordType - Type of chord (major, minor, etc.)
 * @param {Object} options - Additional options (inversion, voicing, velocity)
 * @returns {Object} Result with chord name and notes played
 */
export function playMidiChord(trackId, rootNote, octave, chordType, options = {}) {
    const { inversion = 0, voicing = 'close', velocity = 0.8 } = options;
    
    // Get track
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.warn(`[State playMidiChord] Track ${trackId} not found`);
        return null;
    }
    
    if (track.type === 'Audio') {
        console.warn(`[State playMidiChord] Cannot play chord on Audio track`);
        return null;
    }
    
    // Build chord notes
    const rootMidi = noteNameToMidi(rootNote, octave);
    const intervals = getChordIntervals(chordType);
    let chordNotes = intervals.map(interval => rootMidi + interval);
    
    // Apply inversion and voicing
    chordNotes = applyInversion(chordNotes, inversion);
    chordNotes = applyVoicing(chordNotes, voicing);
    
    // Convert to note names
    const noteNames = chordNotes.map(midi => midiToNoteName(midi));
    
    // Store active notes for this track
    if (!activeChordNotes.has(trackId)) {
        activeChordNotes.set(trackId, new Set());
    }
    const activeNotes = activeChordNotes.get(trackId);
    
    // Play each note
    chordNotes.forEach(midi => {
        const noteName = midiToNoteName(midi);
        activeNotes.add(noteName);
        
        // Use track's instrument to play the note
        if (track.instrument && typeof track.instrument.triggerAttack === 'function') {
            try {
                track.instrument.triggerAttack(noteName, Tone.now(), velocity);
            } catch (e) {
                console.warn(`[State playMidiChord] Error playing note ${noteName}:`, e);
            }
        } else if (typeof track.noteOn === 'function') {
            track.noteOn(midi, velocity);
        }
    });
    
    console.log(`[State playMidiChord] Playing ${rootNote}${octave} ${chordType} on track ${trackId}: ${noteNames.join(', ')}`);
    
    return {
        name: `${rootNote} ${chordType}`,
        notes: noteNames,
        midiNotes: chordNotes
    };
}

/**
 * Stop the current chord on a track.
 * @param {number} trackId - The track to stop chord on
 */
export function stopMidiChord(trackId) {
    const activeNotes = activeChordNotes.get(trackId);
    if (!activeNotes || activeNotes.size === 0) return;
    
    // Get track
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) return;
    
    // Release all active notes
    activeNotes.forEach(noteName => {
        if (track.instrument && typeof track.instrument.triggerRelease === 'function') {
            try {
                track.instrument.triggerRelease(noteName, Tone.now());
            } catch (e) {
                console.warn(`[State stopMidiChord] Error releasing note ${noteName}:`, e);
            }
        } else if (typeof track.noteOff === 'function') {
            const midi = noteNameToMidi(noteName.split(/[0-9]/)[0], parseInt(noteName.match(/[0-9]/)[0]));
            track.noteOff(midi);
        }
    });
    
    activeNotes.clear();
    console.log(`[State stopMidiChord] Stopped chord on track ${trackId}`);
}

// ==========================================
// TRACK MUTE GROUPS
// ==========================================
let muteGroups = [];
let muteGroupIdCounter = 1;

export function getMuteGroups() { return [...muteGroups]; }
export function getMuteGroupById(groupId) { return muteGroups.find(g => g.id === groupId) || null; }
export function addMuteGroup(name = 'Mute Group', trackIds = []) {
    const group = { id: muteGroupIdCounter++, name, trackIds: [...trackIds], exclusive: true };
    muteGroups.push(group);
    return group;
}
export function removeMuteGroup(groupId) {
    const idx = muteGroups.findIndex(g => g.id === groupId);
    if (idx !== -1) muteGroups.splice(idx, 1);
    return idx !== -1;
}
export function updateMuteGroup(groupId, updates) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group) return false;
    if (updates.name !== undefined) group.name = updates.name;
    if (updates.trackIds !== undefined) group.trackIds = [...updates.trackIds];
    if (updates.exclusive !== undefined) group.exclusive = updates.exclusive;
    return true;
}
export function addTrackToMuteGroup(groupId, trackId) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group || group.trackIds.includes(trackId)) return false;
    group.trackIds.push(trackId);
    return true;
}
export function removeTrackFromMuteGroup(groupId, trackId) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group) return false;
    const idx = group.trackIds.indexOf(trackId);
    if (idx !== -1) group.trackIds.splice(idx, 1);
    return idx !== -1;
}
export function getMuteGroupForTrack(trackId) { return muteGroups.find(g => g.trackIds.includes(trackId)) || null; }
export function handleMuteGroupExclusiveUnmute(trackId) {
    const group = getMuteGroupForTrack(trackId);
    if (!group || !group.exclusive) return;
    const tracks = getTracksState();
    group.trackIds.forEach(tid => {
        if (tid !== trackId) {
            const track = tracks.find(t => t.id === tid);
            if (track && !track.isMuted) {
                track.isMuted = true;
                track.applyMuteState();
                if (appServices.updateTrackUI) appServices.updateTrackUI(tid, 'muteChanged');
            }
        }
    });
}
export function clearAllMuteGroups() { muteGroups = []; muteGroupIdCounter = 1; }

export function setActiveTrackInMuteGroup(groupId, trackId) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group) return false;
    group.activeTrackId = trackId;
    return true;
}

export function toggleNextInMuteGroup(groupId) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group || group.trackIds.length === 0) return;
    
    const currentIndex = group.activeTrackId ? group.trackIds.indexOf(group.activeTrackId) : -1;
    const nextIndex = (currentIndex + 1) % group.trackIds.length;
    const nextTrackId = group.trackIds[nextIndex];
    
    // Unmute next track
    const tracks = getTracksState();
    const nextTrack = tracks.find(t => t.id === nextTrackId);
    if (nextTrack && nextTrack.isMuted) {
        nextTrack.isMuted = false;
        nextTrack.applyMuteState();
        if (appServices.updateTrackUI) appServices.updateTrackUI(nextTrackId, 'muteChanged');
    }
    
    // Mute all others in group
    group.trackIds.forEach(tid => {
        if (tid !== nextTrackId) {
            const track = tracks.find(t => t.id === tid);
            if (track && !track.isMuted) {
                track.isMuted = true;
                track.applyMuteState();
                if (appServices.updateTrackUI) appServices.updateTrackUI(tid, 'muteChanged');
            }
        }
    });
    
    group.activeTrackId = nextTrackId;
    return true;
}

export function getActiveTrackInMuteGroup(groupId) {
    const group = muteGroups.find(g => g.id === groupId);
    return group ? group.activeTrackId : null;
}

export function createMuteGroup(name, trackIds, color) {
    return addMuteGroup(name, trackIds);
}
