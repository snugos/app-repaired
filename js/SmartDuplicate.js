// js/SmartDuplicate.js - Smart duplicate that increments note values or avoids conflicts
/**
 * Smart Duplicate - Smart duplicate that increments note values or avoids conflicts
 * 
 * Smart duplicate handles:
 * 1. Incremental note values (velocity, pitch, etc.)
 * 2. Conflict avoidance for overlapping clips/notes
 * 3. Pattern-aware duplication
 * 4. Chord voicing preservation
 */

import { noteNameToMidi, midiToNoteName } from './midiUtils.js';

/**
 * Duplicate options
 */
const DEFAULT_OPTIONS = {
    incrementPitch: 0,       // Semitones to shift pitch (0 = no change)
    incrementVelocity: 5,    // Velocity delta (-127 to 127)
    avoidConflicts: true,    // Automatically adjust timing to avoid overlaps
    shiftTiming: 0,          // Timing offset in beats
    duplicateChain: false,   // Create a chain of duplicates with increasing values
    chainCount: 3,           // Number of duplicates in chain
    scaleChordVoicings: true, // When duplicating chords, transpose to avoid doubling
};

/**
 * Smart duplicate notes/elements
 * @param {Array<Object>} elements - Array of elements to duplicate
 * @param {Object} options - Duplicate options
 * @returns {Array<Object>} Array of duplicated elements
 */
export function smartDuplicate(elements, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    if (!Array.isArray(elements) || elements.length === 0) {
        return [];
    }
    
    const duplicates = elements.map((el, index) => {
        return createDuplicate(el, opts, index);
    });
    
    if (opts.duplicateChain && opts.chainCount > 1) {
        const chain = [];
        for (let i = 1; i < opts.chainCount; i++) {
            const chainDuplicates = elements.map((el, index) => {
                return createChainDuplicate(el, opts, index, i);
            });
            chain.push(...chainDuplicates);
        }
        duplicates.push(...chain);
    }
    
    return duplicates;
}

/**
 * Create a single duplicate with specified options
 */
function createDuplicate(element, options, index) {
    const duplicate = JSON.parse(JSON.stringify(element));
    
    // Apply timing shift
    if (duplicate.time !== undefined && options.shiftTiming !== 0) {
        duplicate.time += options.shiftTiming;
    }
    if (duplicate.startTime !== undefined && options.shiftTiming !== 0) {
        duplicate.startTime += options.shiftTiming;
    }
    if (duplicate.barPosition !== undefined && options.shiftTiming !== 0) {
        duplicate.barPosition += options.shiftTiming;
    }
    
    // Apply pitch increment
    if (duplicate.note !== undefined && options.incrementPitch !== 0) {
        const originalMidi = noteNameToMidi(duplicate.note);
        if (originalMidi !== null) {
            duplicate.note = midiToNoteName(originalMidi + options.incrementPitch);
        }
    }
    if (duplicate.midi !== undefined && options.incrementPitch !== 0) {
        duplicate.midi += options.incrementPitch;
    }
    
    // Apply velocity increment
    if (duplicate.velocity !== undefined && options.incrementVelocity !== 0) {
        duplicate.velocity = Math.max(1, Math.min(127, 
            duplicate.velocity + (options.incrementVelocity * (index + 1))
        ));
    }
    
    // Add identifier that this is a duplicate
    duplicate.isDuplicate = true;
    duplicate.duplicateIndex = index;
    
    return duplicate;
}

/**
 * Create a chain duplicate with cumulative increments
 */
function createChainDuplicate(element, options, index, chainLevel) {
    const duplicate = JSON.parse(JSON.stringify(element));
    
    // Apply timing shift (cumulative)
    const timingOffset = options.shiftTiming * chainLevel;
    if (duplicate.time !== undefined) {
        duplicate.time += timingOffset;
    }
    if (duplicate.startTime !== undefined) {
        duplicate.startTime += timingOffset;
    }
    if (duplicate.barPosition !== undefined) {
        duplicate.barPosition += timingOffset;
    }
    
    // Apply pitch increment (cumulative)
    const pitchDelta = options.incrementPitch * chainLevel;
    if (duplicate.note !== undefined) {
        const originalMidi = noteNameToMidi(duplicate.note);
        if (originalMidi !== null) {
            duplicate.note = midiToNoteName(originalMidi + pitchDelta);
        }
    }
    if (duplicate.midi !== undefined) {
        duplicate.midi += pitchDelta;
    }
    
    // Apply velocity increment (cumulative)
    if (duplicate.velocity !== undefined) {
        duplicate.velocity = Math.max(1, Math.min(127, 
            duplicate.velocity + (options.incrementVelocity * chainLevel)
        ));
    }
    
    // Add chain identifier
    duplicate.isDuplicate = true;
    duplicate.duplicateIndex = index;
    duplicate.chainLevel = chainLevel;
    
    return duplicate;
}

/**
 * Duplicate clips with conflict avoidance
 * @param {Array<Object>} clips - Array of clip objects
 * @param {number} gridSize - Grid size in beats for snapping
 * @param {Object} existingClips - Array of existing clips to check against
 * @returns {Array<Object>} Duplicated clips with adjusted positions
 */
export function smartDuplicateClips(clips, gridSize = 0.25, existingClips = []) {
    const duplicates = [];
    
    clips.forEach(clip => {
        const duplicate = JSON.parse(JSON.stringify(clip));
        
        // Calculate duration
        const duration = clip.endTime - clip.startTime;
        
        // Find next available slot
        let newStartTime = clip.startTime + duration;
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
            const conflict = existingClips.some(existing => {
                const existingEnd = existing.startTime + (existing.endTime - existing.startTime);
                return (newStartTime < existingEnd && newStartTime + duration > existing.startTime);
            });
            
            if (!conflict) break;
            
            // Snap to grid
            newStartTime = Math.ceil(newStartTime / gridSize) * gridSize;
            newStartTime += gridSize;
            attempts++;
        }
        
        duplicate.startTime = newStartTime;
        duplicate.endTime = newStartTime + duration;
        duplicate.isDuplicate = true;
        
        duplicates.push(duplicate);
    });
    
    return duplicates;
}

/**
 * Duplicate chord voicing with scale-aware transposition
 * @param {Array<{note: string, midi: number, velocity: number}>} notes - Chord notes
 * @param {number} semitones - Semitones to transpose
 * @param {Array<number>} scaleNotes - Allowed scale notes (e.g., [0,2,4,5,7,9,11] for major)
 * @returns {Array<Object>} Transposed chord notes
 */
export function duplicateChordVoicing(notes, semitones = 0, scaleNotes = null) {
    return notes.map(note => {
        let newMidi = note.midi + semitones;
        
        // Snap to scale if provided
        if (scaleNotes && Array.isArray(scaleNotes)) {
            const noteInOctave = newMidi % 12;
            const closestScaleNote = scaleNotes.reduce((closest, scaleNote) => {
                const diff = Math.abs(noteInOctave - scaleNote);
                return diff < Math.abs(noteInOctave - closest) ? scaleNote : closest;
            });
            
            const octaveShift = Math.floor(newMidi / 12) - 1;
            newMidi = octaveShift * 12 + closestScaleNote;
        }
        
        return {
            note: midiToNoteName(newMidi),
            midi: newMidi,
            velocity: note.velocity || 100
        };
    });
}

/**
 * Detect conflicts between elements
 * @param {Array<Object>} elements - Elements to check
 * @returns {Array<{a: number, b: number, type: string}>} Array of conflicts
 */
export function detectConflicts(elements) {
    const conflicts = [];
    
    for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
            const a = elements[i];
            const b = elements[j];
            
            // Check time overlap
            const aStart = a.startTime !== undefined ? a.startTime : a.time || 0;
            const aEnd = a.endTime !== undefined ? a.endTime : aStart + (a.duration || 1);
            const bStart = b.startTime !== undefined ? b.startTime : b.time || 0;
            const bEnd = b.endTime !== undefined ? b.endTime : bStart + (b.duration || 1);
            
            if (aStart < bEnd && aEnd > bStart) {
                conflicts.push({ a: i, b: j, type: 'time_overlap' });
            }
            
            // Check pitch conflict for notes
            if (a.midi !== undefined && b.midi !== undefined) {
                if (a.midi === b.midi && Math.abs(aStart - bStart) < 0.1) {
                    conflicts.push({ a: i, b: j, type: 'pitch_conflict' });
                }
            }
        }
    }
    
    return conflicts;
}

/**
 * Resolve conflicts by adjusting element positions
 * @param {Array<Object>} elements - Elements with conflicts
 * @param {number} gridSize - Grid snap size
 * @returns {Array<Object>} Elements with resolved positions
 */
export function resolveConflicts(elements, gridSize = 0.25) {
    const resolved = JSON.parse(JSON.stringify(elements));
    const conflicts = detectConflicts(resolved);
    
    conflicts.forEach(conflict => {
        const elementA = resolved[conflict.a];
        const elementB = resolved[conflict.b];
        
        if (conflict.type === 'time_overlap') {
            // Move later element forward
            const aEnd = elementA.endTime || elementA.startTime + 1;
            elementB.startTime = Math.ceil(aEnd / gridSize) * gridSize;
            if (elementB.endTime !== undefined) {
                elementB.endTime = elementB.startTime + (elementB.endTime - elementB.startTime);
            }
        }
    });
    
    return resolved;
}

/**
 * Create mirrored duplicate (for creating complementary parts)
 * @param {Array<Object>} elements - Elements to duplicate
 * @param {number} pivotTime - Time to mirror around
 * @returns {Array<Object>} Mirrored duplicates
 */
export function mirroredDuplicate(elements, pivotTime = 0) {
    return elements.map(el => {
        const duplicate = JSON.parse(JSON.stringify(el));
        
        // Mirror time around pivot
        if (el.startTime !== undefined) {
            duplicate.startTime = pivotTime * 2 - el.startTime;
            if (el.endTime !== undefined) {
                const duration = el.endTime - el.startTime;
                duplicate.endTime = duplicate.startTime + duration;
            }
        }
        
        // Mirror pitch (e.g., turn ascending pattern into descending)
        if (el.midi !== undefined) {
            // Example: mirror around C4 (MIDI 60)
            const pivotMidi = 60;
            duplicate.midi = pivotMidi - (el.midi - pivotMidi);
            duplicate.note = midiToNoteName(duplicate.midi);
        }
        
        duplicate.isMirrored = true;
        
        return duplicate;
    });
}

export default {
    smartDuplicate,
    smartDuplicateClips,
    duplicateChordVoicing,
    detectConflicts,
    resolveConflicts,
    mirroredDuplicate
};