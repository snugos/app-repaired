// js/Transposition.js - Score Transposition for SnugOS DAW
// Features: Transpose for different instruments, interval transposition, key changes

/**
 * Standard Instrument Transpositions
 * Maps instrument names to their transposition intervals in semitones
 */
export const InstrumentTranspositions = {
    // Concert pitch instruments (no transposition)
    'piano': 0,
    'keyboard': 0,
    'organ': 0,
    'harp': 0,
    'guitar': 0,
    'bass_guitar': 0,
    'flute': 0,
    'oboe': 0,
    'bassoon': 0,
    'trombone': 0,
    'tuba': 0,
    'violin': 0,
    'viola': 0,
    'cello': 0,
    'double_bass': 0, // Sounds an octave lower
    'contrabass': 0,
    'recorder_soprano': 0,
    'recorder_alto': 0,
    
    // B-flat instruments
    'clarinet_bb': 2, // Sounds major 2nd lower
    'clarinet_bass': 2,
    'trumpet_bb': 2,
    'cornet_bb': 2,
    'flugelhorn': 2,
    'sax_soprano': 2,
    'sax_tenor': 2,
    'clarinet_bass': 2,
    
    // E-flat instruments
    'clarinet_eb': -3, // Sounds minor 3rd higher
    'sax_alto': -3,
    'sax_baritone': -3,
    'trumpet_eb': -3,
    
    // F instruments
    'horn_f': -7, // Sounds perfect 5th lower
    'french_horn': -7,
    'english_horn': -7,
    'cor_anglais': -7,
    
    // Other transpositions
    'clarinet_a': 3, // Sounds minor 3rd higher
    'clarinet_c': 0,
    'piccolo': -12, // Sounds octave higher
    'celesta': -12,
    'glockenspiel': -24, // Sounds 2 octaves higher
    'xylophone': -12,
    'marimba': 0,
    'vibraphone': 0,
    'tubular_bells': -12,
    
    // Low instruments
    'bass_flute': 12, // Sounds octave lower
    'bass_clarinet': 14, // Sounds major 9th lower
    'contrabassoon': 12, // Sounds octave lower
    'bass_tuba': 12, // Sounds octave lower
    
    // Double bass convention
    'double_bass_sounding': 12 // For writing at sounding pitch
};

/**
 * Instrument Families
 */
export const InstrumentFamilies = {
    STRINGS: ['violin', 'viola', 'cello', 'double_bass', 'guitar', 'bass_guitar', 'harp'],
    WOODWINDS: ['flute', 'piccolo', 'oboe', 'english_horn', 'clarinet_bb', 'clarinet_eb', 'clarinet_a', 'bass_clarinet', 'bassoon', 'contrabassoon', 'sax_soprano', 'sax_alto', 'sax_tenor', 'sax_baritone'],
    BRASS: ['trumpet_bb', 'trumpet_eb', 'horn_f', 'trombone', 'tuba', 'flugelhorn', 'cornet_bb'],
    PERCUSSION: ['timpani', 'glockenspiel', 'xylophone', 'marimba', 'vibraphone', 'tubular_bells', 'celesta'],
    KEYBOARDS: ['piano', 'organ', 'harpsichord', 'accordion']
};

/**
 * Interval definitions in semitones
 */
export const Intervals = {
    UNISON: 0,
    MINOR_SECOND: 1,
    MAJOR_SECOND: 2,
    MINOR_THIRD: 3,
    MAJOR_THIRD: 4,
    PERFECT_FOURTH: 5,
    AUGMENTED_FOURTH: 6, // Tritone
    DIMINISHED_FIFTH: 6, // Tritone
    PERFECT_FIFTH: 7,
    MINOR_SIXTH: 8,
    MAJOR_SIXTH: 9,
    MINOR_SEVENTH: 10,
    MAJOR_SEVENTH: 11,
    OCTAVE: 12,
    MINOR_NINTH: 13,
    MAJOR_NINTH: 14,
    MINOR_TENTH: 15,
    MAJOR_TENTH: 16
};

/**
 * Key signatures with their number of sharps/flats
 * Positive = sharps, Negative = flats
 */
export const KeySignatures = {
    'C': 0, 'Am': 0,
    'G': 1, 'Em': 1,
    'D': 2, 'Bm': 2,
    'A': 3, 'F#m': 3,
    'E': 4, 'C#m': 4,
    'B': 5, 'G#m': 5,
    'F#': 6, 'D#m': 6,
    'C#': 7, 'A#m': 7,
    'F': -1, 'Dm': -1,
    'Bb': -2, 'Gm': -2,
    'Eb': -3, 'Cm': -3,
    'Ab': -4, 'Fm': -4,
    'Db': -5, 'Bbm': -5,
    'Gb': -6, 'Ebm': -6,
    'Cb': -7, 'Abm': -7
};

/**
 * Reverse mapping: sharps/flats to key
 */
export const SignatureToKey = {};
for (const [key, sig] of Object.entries(KeySignatures)) {
    const isMinor = key.includes('m') && key !== 'Am';
    const type = isMinor ? 'minor' : 'major';
    if (!SignatureToKey[sig]) {
        SignatureToKey[sig] = {};
    }
    SignatureToKey[sig][type] = key;
}

/**
 * Transposition Manager
 */
export class TranspositionManager {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Transpose notes by interval
     * @param {Array} notes - Array of note objects with pitch property
     * @param {number} semitones - Number of semitones to transpose
     * @param {Object} options - Options
     * @returns {Array} Transposed notes
     */
    transposeNotes(notes, semitones, options = {}) {
        const { 
            preserveKeySignature = false,
            fixEnharmonic = true,
            clampRange = null // { min: number, max: number } MIDI range
        } = options;

        return notes.map(note => {
            let newPitch = note.pitch + semitones;

            // Clamp to range if specified
            if (clampRange) {
                newPitch = Math.max(clampRange.min, Math.min(clampRange.max, newPitch));
            }

            return {
                ...note,
                pitch: newPitch,
                transposedBy: semitones
            };
        });
    }

    /**
     * Transpose for specific instrument
     * @param {Array} notes - Notes in concert pitch
     * @param {string} instrument - Instrument name
     * @param {Object} options - Options
     * @returns {Array} Transposed notes
     */
    transposeForInstrument(notes, instrument, options = {}) {
        const transposition = InstrumentTranspositions[instrument];
        if (transposition === undefined) {
            console.warn(`Unknown instrument: ${instrument}, returning untransposed notes`);
            return notes;
        }

        return this.transposeNotes(notes, transposition, options);
    }

    /**
     * Convert from instrument pitch to concert pitch
     * @param {Array} notes - Notes in instrument pitch
     * @param {string} instrument - Instrument name
     * @returns {Array} Notes in concert pitch
     */
    toConcertPitch(notes, instrument) {
        const transposition = InstrumentTranspositions[instrument] || 0;
        return this.transposeNotes(notes, -transposition);
    }

    /**
     * Transpose key signature
     * @param {string} key - Original key (e.g., 'C', 'Am', 'F#')
     * @param {number} semitones - Semitones to transpose
     * @returns {string} New key signature
     */
    transposeKeySignature(key, semitones) {
        const signature = KeySignatures[key];
        if (signature === undefined) {
            console.warn(`Unknown key: ${key}`);
            return key;
        }

        // Calculate new key based on circle of fifths
        const isMinor = key.includes('m') && key !== 'Am';
        
        // Calculate new tonic position in circle of fifths
        const newKeyPosition = this._getKeyPosition(key) + semitones;
        
        // Find closest matching key
        return this._findKeyAtPosition(newKeyPosition, isMinor);
    }

    /**
     * Get key position in circle of fifths (C = 0)
     * @private
     */
    _getKeyPosition(key) {
        const positions = {
            'C': 0, 'Am': 0,
            'G': 1, 'Em': 1,
            'D': 2, 'Bm': 2,
            'A': 3, 'F#m': 3,
            'E': 4, 'C#m': 4,
            'B': 5, 'G#m': 5,
            'F#': 6, 'D#m': 6,
            'C#': 7, 'A#m': 7,
            'F': -1, 'Dm': -1,
            'Bb': -2, 'Gm': -2,
            'Eb': -3, 'Cm': -3,
            'Ab': -4, 'Fm': -4,
            'Db': -5, 'Bbm': -5,
            'Gb': -6, 'Ebm': -6,
            'Cb': -7, 'Abm': -7
        };
        return positions[key] || 0;
    }

    /**
     * Find key at position
     * @private
     */
    _findKeyAtPosition(position, isMinor) {
        // Normalize position to -7 to 7 range
        let normalizedPos = ((position % 12) + 12) % 12;
        if (normalizedPos > 7) normalizedPos -= 12;
        if (normalizedPos < -7) normalizedPos += 12;

        const type = isMinor ? 'minor' : 'major';
        return SignatureToKey[normalizedPos]?.[type] || (isMinor ? 'Am' : 'C');
    }

    /**
     * Get transposition between two instruments
     * @param {string} fromInstrument - Source instrument
     * @param {string} toInstrument - Target instrument
     * @returns {number} Semitones to transpose
     */
    getTranspositionBetween(fromInstrument, toInstrument) {
        const fromTrans = InstrumentTranspositions[fromInstrument] || 0;
        const toTrans = InstrumentTranspositions[toInstrument] || 0;
        return fromTrans - toTrans;
    }

    /**
     * Calculate interval between two pitches
     * @param {number} pitch1 - First MIDI pitch
     * @param {number} pitch2 - Second MIDI pitch
     * @returns {Object} Interval information
     */
    calculateInterval(pitch1, pitch2) {
        const semitones = pitch2 - pitch1;
        const octaves = Math.floor(Math.abs(semitones) / 12);
        const remainderSemitones = Math.abs(semitones) % 12;

        // Find interval name
        let intervalName = '';
        const intervalNames = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 
                              'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th',
                              'Minor 7th', 'Major 7th'];
        
        if (remainderSemitones < intervalNames.length) {
            intervalName = intervalNames[remainderSemitones];
        }

        if (octaves > 0) {
            intervalName = `${octaves} octave${octaves > 1 ? 's' : ''} + ${intervalName}`;
        }

        return {
            semitones,
            octaves,
            remainderSemitones,
            name: intervalName,
            direction: semitones >= 0 ? 'up' : 'down'
        };
    }

    /**
     * Get all instruments that can play this music
     * @param {number} minPitch - Minimum MIDI pitch
     * @param {number} maxPitch - Maximum MIDI pitch
     * @returns {Array} Compatible instruments with range info
     */
    getCompatibleInstruments(minPitch, maxPitch) {
        const instrumentRanges = this._getInstrumentRanges();
        const compatible = [];

        for (const [instrument, range] of Object.entries(instrumentRanges)) {
            // Adjust for instrument transposition
            const transposition = InstrumentTranspositions[instrument] || 0;
            const adjustedMin = minPitch - transposition;
            const adjustedMax = maxPitch - transposition;

            if (adjustedMin >= range.min && adjustedMax <= range.max) {
                compatible.push({
                    instrument,
                    transposition,
                    range,
                    fitsComfortably: true
                });
            } else if (adjustedMin >= range.min - 3 && adjustedMax <= range.max + 3) {
                compatible.push({
                    instrument,
                    transposition,
                    range,
                    fitsComfortably: false,
                    outOfRangeNotes: Math.max(0, range.min - adjustedMin) + Math.max(0, adjustedMax - range.max)
                });
            }
        }

        return compatible.sort((a, b) => {
            if (a.fitsComfortably && !b.fitsComfortably) return -1;
            if (!a.fitsComfortably && b.fitsComfortably) return 1;
            return (b.outOfRangeNotes || 0) - (a.outOfRangeNotes || 0);
        });
    }

    /**
     * Get standard instrument ranges
     * @private
     */
    _getInstrumentRanges() {
        return {
            'piano': { min: 21, max: 108 },
            'guitar': { min: 40, max: 88 },
            'bass_guitar': { min: 28, max: 67 },
            'violin': { min: 55, max: 103 },
            'viola': { min: 48, max: 91 },
            'cello': { min: 36, max: 79 },
            'double_bass': { min: 28, max: 67 },
            'flute': { min: 60, max: 96 },
            'piccolo': { min: 72, max: 108 },
            'oboe': { min: 58, max: 91 },
            'english_horn': { min: 52, max: 82 },
            'clarinet_bb': { min: 50, max: 94 },
            'bass_clarinet': { min: 37, max: 82 },
            'bassoon': { min: 34, max: 75 },
            'contrabassoon': { min: 22, max: 63 },
            'sax_alto': { min: 49, max: 89 },
            'sax_tenor': { min: 44, max: 84 },
            'sax_baritone': { min: 37, max: 77 },
            'trumpet_bb': { min: 52, max: 82 },
            'horn_f': { min: 41, max: 77 },
            'trombone': { min: 34, max: 82 },
            'tuba': { min: 24, max: 65 }
        };
    }

    /**
     * Get recommended clef for pitch range
     * @param {number} minPitch - Minimum MIDI pitch
     * @param {number} maxPitch - Maximum MIDI pitch
     * @returns {string} Recommended clef ('treble', 'bass', 'alto', 'tenor')
     */
    getRecommendedClef(minPitch, maxPitch) {
        const center = (minPitch + maxPitch) / 2;

        if (center >= 60) return 'treble';  // Middle C and above
        if (center >= 48) return 'alto';     // Around viola range
        if (center >= 42) return 'tenor';    // Tenor/cello range
        return 'bass';                       // Below tenor range
    }

    /**
     * Get transposition description
     * @param {number} semitones - Semitones to transpose
     * @returns {string} Human-readable description
     */
    getTranspositionDescription(semitones) {
        if (semitones === 0) return 'No transposition (concert pitch)';

        const direction = semitones > 0 ? 'up' : 'down';
        const abs = Math.abs(semitones);
        const octaves = Math.floor(abs / 12);
        const remainder = abs % 12;

        let description = '';
        
        if (octaves > 0) {
            description += `${octaves} octave${octaves > 1 ? 's' : ''}`;
            if (remainder > 0) {
                description += ' and ';
            }
        }

        if (remainder > 0) {
            const intervalNames = ['', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd',
                                   'perfect 4th', 'tritone', 'perfect 5th', 'minor 6th',
                                   'major 6th', 'minor 7th', 'major 7th'];
            description += intervalNames[remainder];
        }

        return `Transpose ${direction} ${description}`;
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     * @private
     */
    _emit(event, data) {
        if (this.listeners.has(event)) {
            for (const callback of this.listeners.get(event)) {
                callback(data);
            }
        }
    }
}

/**
 * Transposition Preset
 */
export class TranspositionPreset {
    constructor(name, semitones, description = '') {
        this.name = name;
        this.semitones = semitones;
        this.description = description;
    }
}

/**
 * Common transposition presets
 */
export const TranspositionPresets = [
    new TranspositionPreset('Concert Pitch', 0, 'No transposition'),
    new TranspositionPreset('Up Minor 2nd', 1, 'Transpose up by a semitone'),
    new TranspositionPreset('Up Major 2nd', 2, 'Transpose up by a whole tone'),
    new TranspositionPreset('Up Minor 3rd', 3, 'Transpose up by a minor third'),
    new TranspositionPreset('Up Major 3rd', 4, 'Transpose up by a major third'),
    new TranspositionPreset('Up Perfect 4th', 5, 'Transpose up by a perfect fourth'),
    new TranspositionPreset('Up Perfect 5th', 7, 'Transpose up by a perfect fifth'),
    new TranspositionPreset('Up Octave', 12, 'Transpose up by an octave'),
    new TranspositionPreset('Down Minor 2nd', -1, 'Transpose down by a semitone'),
    new TranspositionPreset('Down Major 2nd', -2, 'Transpose down by a whole tone'),
    new TranspositionPreset('Down Minor 3rd', -3, 'Transpose down by a minor third'),
    new TranspositionPreset('Down Major 3rd', -4, 'Transpose down by a major third'),
    new TranspositionPreset('Down Perfect 4th', -5, 'Transpose down by a perfect fourth'),
    new TranspositionPreset('Down Perfect 5th', -7, 'Transpose down by a perfect fifth'),
    new TranspositionPreset('Down Octave', -12, 'Transpose down by an octave')
];

// Create singleton instance
export const transpositionManager = new TranspositionManager();

// Default export
export default {
    InstrumentTranspositions,
    InstrumentFamilies,
    Intervals,
    KeySignatures,
    SignatureToKey,
    TranspositionManager,
    TranspositionPreset,
    TranspositionPresets,
    transpositionManager
};