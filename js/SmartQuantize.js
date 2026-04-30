// js/SmartQuantize.js - Intelligent quantization with strength, scale controls, and humanization
export class SmartQuantize {
    constructor() {
        this.strength = 1.0;  // 0-1, how much to apply
        this.range = 1.0;     // Time range to search for nearest note
        this.scale = 'chromatic';
        this.customScale = [];
    }

    setStrength(value) {
        this.strength = Math.max(0, Math.min(1, value));
    }

    setRange(beats) {
        this.range = Math.max(0.25, Math.min(4, beats));
    }

    setScale(scaleName) {
        const validScales = ['chromatic', 'major', 'minor', 'pentatonic', 'blues', 'dorian', 'mixolydian', 'locrian'];
        this.scale = validScales.includes(scaleName) ? scaleName : 'chromatic';
    }
    setCustomScale(notes) {
        this.customScale = notes || [];
    }

    quantizeNote(noteTime, originalVelocity) {
        const gridSize = 0.25; // 16th notes
        const nearestGrid = Math.round(noteTime / gridSize) * gridSize;
        
        // Apply strength
        const offset = (nearestGrid - noteTime) * this.strength;
        return {
            time: noteTime + offset,
            velocity: originalVelocity
        };
    }

    quantizeNotes(notes) {
        return notes.map(note => {
            const quantized = this.quantizeNote(note.time, note.velocity);
            return {
                ...note,
                time: quantized.time,
                velocity: quantized.velocity
            };
        });
    }
    
    snapToScale(notePitch) {
        if (this.scale === 'chromatic' || this.customScale.length === 0) {
            return notePitch;
        }
        
        // Find nearest note in scale
        const noteInScale = this.customScale.find(
            n => n === notePitch || (n % 12) === (notePitch % 12)
        );
        
        return noteInScale !== undefined ? noteInScale : notePitch;
    }
}

// Scale definitions (semitone offsets from root)
const SCALE_FORMULAS = {
    chromatic:    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major:        [0, 2, 4, 5, 7, 9, 11],
    minor:        [0, 2, 3, 5, 7, 8, 10],
    pentatonic:   [0, 2, 4, 7, 9],
    blues:        [0, 3, 5, 6, 7, 10],
    dorian:       [0, 2, 3, 5, 7, 9, 10],
    mixolydian:   [0, 2, 4, 5, 7, 9, 10],
    locrian:      [0, 1, 3, 5, 6, 8, 10],
};

/**
 * Convert a scale name to array of semitone intervals
 */
function getScaleIntervals(scaleName) {
    return SCALE_FORMULAS[scaleName] || SCALE_FORMULAS.chromatic;
}

/**
 * Find nearest note in scale for a given pitch
 * @param {number} pitch - MIDI pitch (0-127)
 * @param {string} scaleName - Scale name
 * @param {number} rootPitch - Root pitch of scale (default 60 = C4)
 * @returns {number} Nearest pitch in scale
 */
function snapPitchToScale(pitch, scaleName, rootPitch = 60) {
    if (scaleName === 'chromatic') return pitch;
    
    const intervals = getScaleIntervals(scaleName);
    const rootOctave = Math.floor(rootPitch / 12);
    const rootNoteInOctave = rootPitch % 12;
    
    // Get the note's position within the octave and its octave
    const noteInOctave = pitch % 12;
    const noteOctave = Math.floor(pitch / 12);
    
    // Map scale intervals relative to root
    // Find the closest scale degree
    let closestInterval = intervals[0];
    let minDistance = 12;
    
    for (const interval of intervals) {
        // Check this interval and +/- 12 (for octave equivalence)
        for (const offset of [-12, 0, 12]) {
            const targetInterval = interval + offset;
            const distance = Math.abs(targetInterval - noteInOctave);
            if (distance < minDistance) {
                minDistance = distance;
                // Adjust for the interval value (need to account for octave difference too)
                const octaveDiff = Math.floor((interval + (noteInOctave < interval ? -12 : 0)) / 12);
                closestInterval = interval + (noteOctave - rootOctave) * 12;
            }
        }
    }
    
    // Calculate the nearest scale note
    const nearestScaleNote = noteInOctave; // Start with current
    let bestPitch = pitch;
    let bestDistance = 0;
    
    // Check all scale degrees within +/- 1 octave range
    for (const octaveAdjust of [-12, 0, 12]) {
        for (const interval of intervals) {
            const scalePitch = (noteOctave * 12) + interval + octaveAdjust;
            const distance = Math.abs(scalePitch - pitch);
            if (distance < bestDistance || bestDistance === 0) {
                bestDistance = distance;
                bestPitch = scalePitch;
            }
        }
    }
    
    return Math.max(0, Math.min(127, bestPitch));
}

/**
 * Apply humanization (random timing/velocity variation)
 */
function applyHumanize(notes, humanizeAmount, strength) {
    if (humanizeAmount <= 0 || strength <= 0) return notes;
    
    return notes.map(note => {
        const timeOffset = (Math.random() - 0.5) * humanizeAmount * strength;
        const velocityOffset = (Math.random() - 0.5) * humanizeAmount * 0.2 * strength;
        
        return {
            ...note,
            time: note.time + timeOffset,
            velocity: Math.max(0, Math.min(127, (note.velocity || 100) * (1 + velocityOffset)))
        };
    });
}

/**
 * Quantize notes to grid with optional scale snapping
 * @param {Array} notes - Array of {time, pitch, velocity, duration}
 * @param {Object} options - Quantize options
 * @returns {Array} Quantized notes
 */
export function smartQuantizeNotes(notes, options = {}) {
    const {
        resolution = 16,       // Steps per bar
        strength = 1.0,        // 0-1 quantization strength
        humanize = 0,          // 0-1 humanization amount
        swingAmount = 0,       // 0-1 swing amount
        preserveGroove = true, // Don't override groove timing
        timeSignature = '4/4', // Time signature
        scale = 'chromatic',   // Scale to snap to
        snapToScaleEnabled = false, // Enable scale snapping
        rootNote = 60          // Root pitch for scale (MIDI, default C4)
    } = options;
    
    // Calculate grid size in beats
    const [beatsPerBar, beatUnit] = timeSignature.split('/').map(Number);
    const stepsPerBeat = resolution / beatsPerBar;
    const gridSize = 1 / stepsPerBeat; // in beats
    
    // Apply humanization first if requested
    let processedNotes = humanize > 0 ? applyHumanize(notes, humanize, strength) : [...notes];
    
    // Quantize each note
    const quantized = processedNotes.map(note => {
        const originalTime = note.time;
        const nearestGrid = Math.round(originalTime / gridSize) * gridSize;
        
        // Apply strength (blend between original and quantized)
        const timeOffset = (nearestGrid - originalTime) * strength;
        let quantizedTime = originalTime + timeOffset;
        
        // Apply swing to off-beat positions
        if (swingAmount > 0) {
            const beatPosition = quantizedTime % 1;
            // Swing affects the "and" of each beat (eighth note positions)
            // In 4/4, swing delays the 2nd and 4th eighth notes
            if (beatPosition >= 0.5 && beatPosition < 0.75) {
                quantizedTime += swingAmount * 0.1;
            } else if (beatPosition >= 0.25 && beatPosition < 0.5) {
                quantizedTime += swingAmount * 0.05;
            }
        }
        
        // Apply scale snapping to pitch if enabled
        let quantizedPitch = note.pitch;
        if (snapToScaleEnabled && scale && scale !== 'chromatic') {
            quantizedPitch = snapPitchToScale(note.pitch, scale, rootNote);
        }
        
        return {
            ...note,
            time: quantizedTime,
            pitch: quantizedPitch,
            velocity: note.velocity || 100
        };
    });
    
    return quantized;
}

export function createSmartQuantize() {
    return new SmartQuantize();
}

// Export scale utilities for external use
export { snapPitchToScale, getScaleIntervals, SCALE_FORMULAS };