// js/FingerPositionDisplay.js - Finger Position Display for SnugOS DAW
// Features: Show suggested fingerings for instruments (piano, guitar, violin, etc.)

/**
 * Instrument Types for Fingering Display
 */
export const InstrumentType = {
    PIANO: 'piano',
    GUITAR: 'guitar',
    VIOLIN: 'violin',
    VIOLA: 'viola',
    CELLO: 'cello',
    FLUTE: 'flute',
    CLARINET: 'clarinet',
    SAXOPHONE: 'saxophone',
    TRUMPET: 'trumpet',
    RECORDER: 'recorder'
};

/**
 * Standard Piano Fingerings
 * Finger numbers: 1=thumb, 2=index, 3=middle, 4=ring, 5=pinky
 */
export const PianoFingerings = {
    // Major scales
    'C_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5],
            desc: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1],
            desc: [1, 2, 3, 1, 2, 3, 4, 5, 1, 2, 3, 1, 2, 3, 4]
        }
    },
    'G_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    },
    'D_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    },
    'A_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    },
    'E_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    },
    'B_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    },
    'F_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 4, 1, 2, 3, 4],
            twoOctaves: [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 4, 3, 2],
            twoOctaves: [5, 4, 3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 4, 3, 2]
        }
    },
    'Bb_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    },
    'Eb_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    },
    'Ab_major': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    },
    // Minor scales
    'A_minor': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    },
    'E_minor': {
        rightHand: {
            oneOctave: [1, 2, 3, 1, 2, 3, 4, 5],
            twoOctaves: [1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 5]
        },
        leftHand: {
            oneOctave: [5, 4, 3, 2, 1, 3, 2, 1],
            twoOctaves: [5, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1]
        }
    }
};

/**
 * Guitar Fretboard Positions
 * String numbers: 1=high E, 6=low E
 */
export const GuitarFingerings = {
    // Common chord fingerings: {fret, string, finger}
    'C': [
        { fret: 1, string: 2, finger: 1 },
        { fret: 2, string: 4, finger: 2 },
        { fret: 3, string: 5, finger: 3 }
    ],
    'D': [
        { fret: 1, string: 3, finger: 1 },
        { fret: 2, string: 1, finger: 2 },
        { fret: 3, string: 2, finger: 3 }
    ],
    'E': [
        { fret: 1, string: 3, finger: 1 },
        { fret: 2, string: 5, finger: 2 },
        { fret: 2, string: 4, finger: 3 }
    ],
    'Em': [
        { fret: 2, string: 5, finger: 2 },
        { fret: 2, string: 4, finger: 3 }
    ],
    'G': [
        { fret: 2, string: 5, finger: 2 },
        { fret: 1, string: 6, finger: 1 },
        { fret: 3, string: 1, finger: 3 },
        { fret: 3, string: 6, finger: 4 }
    ],
    'Am': [
        { fret: 1, string: 2, finger: 1 },
        { fret: 2, string: 4, finger: 2 },
        { fret: 2, string: 3, finger: 3 }
    ],
    'A': [
        { fret: 2, string: 4, finger: 1 },
        { fret: 2, string: 3, finger: 2 },
        { fret: 2, string: 2, finger: 3 }
    ],
    'F': [
        { fret: 1, string: 6, finger: 1, barre: true },
        { fret: 3, string: 5, finger: 3 },
        { fret: 3, string: 4, finger: 4 }
    ],
    'Dm': [
        { fret: 1, string: 1, finger: 1 },
        { fret: 2, string: 3, finger: 2 },
        { fret: 3, string: 2, finger: 3 }
    ]
};

/**
 * Violin Finger Positions
 * String numbers: 1=E, 2=A, 3=D, 4=G
 * Positions are relative to first position
 */
export const ViolinFingerings = {
    // First position finger numbers for each string
    firstPosition: {
        G: { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4 }, // Open, index, middle, ring, pinky
        D: { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4 },
        A: { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4 },
        E: { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4 }
    },
    // Common scales with fingerings
    'G_major': {
        strings: ['G', 'D', 'A', 'E'],
        fingerPattern: [
            // G string: 0, 1, 2, 3
            { string: 'G', fingers: [0, 1, 2, 3] },
            // D string: 0, 1, 2, 3
            { string: 'D', fingers: [0, 1, 2, 3] },
            // A string: 0, 1, 2, 3
            { string: 'A', fingers: [0, 1, 2, 3] },
            // E string: 0, 1, 2, 3
            { string: 'E', fingers: [0, 1, 2, 3] }
        ]
    },
    'D_major': {
        strings: ['D', 'A', 'E'],
        fingerPattern: [
            { string: 'D', fingers: [0, 1, 2, 3] },
            { string: 'A', fingers: [0, 1, 2, 3] },
            { string: 'E', fingers: [0, 1, 2, 3] }
        ]
    },
    'A_major': {
        strings: ['A', 'E'],
        fingerPattern: [
            { string: 'A', fingers: [0, 1, 2, 3] },
            { string: 'E', fingers: [0, 1, 2, 3] }
        ]
    }
};

/**
 * Finger Position Display Manager
 */
export class FingerPositionDisplay {
    constructor(options = {}) {
        this.instrument = options.instrument || InstrumentType.PIANO;
        this.displaySettings = {
            showNumbers: true,
            showColors: true,
            colorLeftHand: '#3b82f6', // Blue
            colorRightHand: '#ef4444', // Red
            fontSize: 12,
            position: 'above', // 'above', 'below', 'left', 'right'
            offset: { x: 0, y: -15 }
        };
        
        this.listeners = new Map();
        this.currentFingerings = [];
    }

    /**
     * Set instrument type
     * @param {string} instrument - Instrument type
     */
    setInstrument(instrument) {
        this.instrument = instrument;
        this._emit('instrumentChange', instrument);
    }

    /**
     * Get fingering for a scale
     * @param {string} scaleName - Scale name (e.g., 'C_major', 'A_minor')
     * @param {string} hand - 'left' or 'right'
     * @param {string} octave - 'oneOctave' or 'twoOctaves'
     * @returns {number[]} Fingering array
     */
    getScaleFingering(scaleName, hand, octave = 'oneOctave') {
        if (this.instrument === InstrumentType.PIANO) {
            const scale = PianoFingerings[scaleName];
            if (!scale) return null;
            
            const handData = hand === 'left' ? scale.leftHand : scale.rightHand;
            return handData ? handData[octave] || handData.oneOctave : null;
        }
        return null;
    }

    /**
     * Get fingering for a chord
     * @param {string} chordName - Chord name (e.g., 'C', 'Am', 'G')
     * @returns {Object[]} Array of finger positions
     */
    getChordFingering(chordName) {
        if (this.instrument === InstrumentType.GUITAR) {
            return GuitarFingerings[chordName] || null;
        }
        return null;
    }

    /**
     * Get suggested fingering for a note sequence
     * @param {Object[]} notes - Array of note objects {midi, duration}
     * @returns {Object[]} Notes with suggested finger numbers
     */
    suggestFingerings(notes) {
        if (!notes || notes.length === 0) return [];
        
        const result = notes.map((note, index) => {
            const suggested = this._calculateFingering(note, index, notes);
            return {
                ...note,
                fingerLeft: suggested.fingerLeft,
                fingerRight: suggested.fingerRight,
                alternate: suggested.alternate
            };
        });
        
        this.currentFingerings = result;
        return result;
    }

    /**
     * Calculate fingering for a single note
     * @private
     */
    _calculateFingering(note, index, allNotes) {
        const midi = note.midi || note.pitch;
        
        if (this.instrument === InstrumentType.PIANO) {
            return this._calculatePianoFingering(midi, index, allNotes);
        } else if (this.instrument === InstrumentType.GUITAR) {
            return this._calculateGuitarFingering(midi, index, allNotes);
        } else if (this.instrument === InstrumentType.VIOLIN) {
            return this._calculateViolinFingering(midi, index, allNotes);
        }
        
        return { fingerLeft: null, fingerRight: null, alternate: null };
    }

    /**
     * Calculate piano fingering
     * @private
     */
    _calculatePianoFingering(midi, index, allNotes) {
        // Determine if in right or left hand range
        const middleC = 60;
        const isRightHand = midi >= middleC;
        
        // Basic algorithm: prefer natural finger positions
        // 1=thumb, 2=index, 3=middle, 4=ring, 5=pinky
        const noteInOctave = midi % 12;
        const finger = this._getPianoFingerForNote(noteInOctave, isRightHand);
        
        return {
            fingerLeft: isRightHand ? null : finger,
            fingerRight: isRightHand ? finger : null,
            alternate: null
        };
    }

    /**
     * Get piano finger for a note
     * @private
     */
    _getPianoFingerForNote(noteInOctave, isRightHand) {
        // Simplified finger assignment based on position in scale
        const fingerMap = {
            right: { 0: 1, 2: 2, 4: 3, 5: 1, 7: 2, 9: 3, 11: 4 },
            left: { 0: 5, 2: 4, 4: 3, 5: 2, 7: 1, 9: 2, 11: 3 }
        };
        
        const map = isRightHand ? fingerMap.right : fingerMap.left;
        return map[noteInOctave] || 1;
    }

    /**
     * Calculate guitar fingering
     * @private
     */
    _calculateGuitarFingering(midi, index, allNotes) {
        // Convert MIDI to string/fret position
        // Standard tuning: E2(6)=40, A2(5)=45, D3(4)=50, G3(3)=55, B3(2)=59, E4(1)=64
        const openStrings = [64, 59, 55, 50, 45, 40]; // E4, B3, G3, D3, A2, E2
        
        for (let stringNum = 0; stringNum < 6; stringNum++) {
            const openNote = openStrings[stringNum];
            if (midi >= openNote && midi <= openNote + 24) { // Within 2 octaves
                const fret = midi - openNote;
                const finger = this._getGuitarFingerForFret(fret);
                return {
                    fingerLeft: finger,
                    fingerRight: null,
                    alternate: { string: 6 - stringNum, fret, finger }
                };
            }
        }
        
        return { fingerLeft: 1, fingerRight: null, alternate: null };
    }

    /**
     * Get guitar finger for fret position
     * @private
     */
    _getGuitarFingerForFret(fret) {
        if (fret === 0) return 0; // Open string
        if (fret <= 4) return fret; // First position: finger = fret
        // Higher positions: estimate based on position
        return Math.min(4, Math.max(1, fret % 4 + 1));
    }

    /**
     * Calculate violin fingering
     * @private
     */
    _calculateViolinFingering(midi, index, allNotes) {
        // Violin range: G3(55) to E6(88) approximately
        const openStrings = { 'G': 55, 'D': 62, 'A': 69, 'E': 76 };
        
        for (const [stringName, openNote] of Object.entries(openStrings)) {
            if (midi >= openNote && midi <= openNote + 12) { // Within one octave on string
                const semitoneOffset = midi - openNote;
                const finger = this._getViolinFingerForSemitone(semitoneOffset);
                return {
                    fingerLeft: finger,
                    fingerRight: null,
                    alternate: { string: stringName, position: semitoneOffset, finger }
                };
            }
        }
        
        return { fingerLeft: 1, fingerRight: null, alternate: null };
    }

    /**
     * Get violin finger for semitone offset
     * @private
     */
    _getViolinFingerForSemitone(offset) {
        // First position: 0=open, 1=index (low), 2=index (high) or middle (low)
        // 3=middle (high) or ring (low), 4=ring (high) or pinky
        if (offset === 0) return 0;
        if (offset <= 2) return 1; // Index finger covers 1-2 semitones
        if (offset <= 4) return 2; // Middle finger
        if (offset <= 6) return 3; // Ring finger
        return 4; // Pinky
    }

    /**
     * Create SVG display element for fingering
     * @param {Object} note - Note with fingering
     * @param {number} x - X position
     * @param {number} y - Y position
     * @returns {string} SVG element string
     */
    createFingeringElement(note, x, y) {
        const finger = note.fingerRight || note.fingerLeft;
        if (finger === null || finger === undefined) return '';
        
        const color = note.fingerRight ? this.displaySettings.colorRightHand : this.displaySettings.colorLeftHand;
        const fontSize = this.displaySettings.fontSize;
        const offsetY = this.displaySettings.offset.y;
        
        return `<text x="${x}" y="${y + offsetY}" 
            font-size="${fontSize}" 
            fill="${color}" 
            text-anchor="middle"
            class="finger-number">
            ${finger}
        </text>`;
    }

    /**
     * Create guitar fretboard diagram
     * @param {string} chordName - Chord name
     * @param {Object} options - Display options
     * @returns {string} HTML/SVG string
     */
    createGuitarChordDiagram(chordName, options = {}) {
        const fingering = this.getChordFingering(chordName);
        if (!fingering) return '';
        
        const width = options.width || 100;
        const height = options.height || 120;
        const fretWidth = width / 6;
        const fretHeight = (height - 20) / 5;
        
        let svg = `<svg width="${width}" height="${height}" class="guitar-chord-diagram">`;
        
        // Draw strings
        for (let i = 0; i < 6; i++) {
            const x = i * fretWidth + fretWidth / 2;
            svg += `<line x1="${x}" y1="20" x2="${x}" y2="${height}" stroke="#333" stroke-width="1"/>`;
        }
        
        // Draw frets
        for (let i = 0; i < 5; i++) {
            const y = 20 + i * fretHeight;
            svg += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#333" stroke-width="1"/>`;
        }
        
        // Draw finger positions
        fingering.forEach(pos => {
            const x = (6 - pos.string) * fretWidth + fretWidth / 2;
            const y = 20 + pos.fret * fretHeight - fretHeight / 2;
            
            // Draw circle
            svg += `<circle cx="${x}" cy="${y}" r="8" fill="${this.displaySettings.colorLeftHand}"/>`;
            
            // Draw finger number
            if (this.displaySettings.showNumbers) {
                svg += `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="white" font-size="10">${pos.finger}</text>`;
            }
        });
        
        svg += '</svg>';
        return svg;
    }

    /**
     * Create violin fingerboard diagram
     * @param {string} scaleName - Scale name
     * @param {Object} options - Display options
     * @returns {string} HTML/SVG string
     */
    createViolinFingerboardDiagram(scaleName, options = {}) {
        const scale = ViolinFingerings[scaleName];
        if (!scale) return '';
        
        const width = options.width || 80;
        const height = options.height || 200;
        const stringSpacing = width / 4;
        
        let svg = `<svg width="${width}" height="${height}" class="violin-fingerboard-diagram">`;
        
        // Draw strings
        const strings = ['G', 'D', 'A', 'E'];
        for (let i = 0; i < 4; i++) {
            const x = i * stringSpacing + stringSpacing / 2;
            svg += `<line x1="${x}" y1="20" x2="${x}" y2="${height - 10}" stroke="#333" stroke-width="2"/>`;
            svg += `<text x="${x}" y="15" text-anchor="middle" font-size="10">${strings[i]}</text>`;
        }
        
        // Draw finger positions for the scale
        if (scale.fingerPattern) {
            scale.fingerPattern.forEach((stringData, stringIndex) => {
                const stringNum = strings.indexOf(stringData.string);
                if (stringNum === -1) return;
                
                const x = stringNum * stringSpacing + stringSpacing / 2;
                stringData.fingers.forEach((finger, posIndex) => {
                    const y = 30 + posIndex * 20;
                    svg += `<circle cx="${x}" cy="${y}" r="6" fill="${this.displaySettings.colorLeftHand}"/>`;
                    svg += `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="white" font-size="8">${finger}</text>`;
                });
            });
        }
        
        svg += '</svg>';
        return svg;
    }

    /**
     * Create piano keyboard fingering display
     * @param {string} scaleName - Scale name
     * @param {string} hand - 'left' or 'right'
     * @returns {Object} Fingering data with visual positions
     */
    createPianoScaleFingering(scaleName, hand) {
        const fingering = this.getScaleFingering(scaleName, hand, 'oneOctave');
        if (!fingering) return null;
        
        return {
            scaleName,
            hand,
            fingering,
            color: hand === 'left' ? this.displaySettings.colorLeftHand : this.displaySettings.colorRightHand,
            // Visual representation for each finger
            fingerLabels: fingering.map((f, i) => ({
                finger: f,
                position: i,
                label: this._getPianoFingerLabel(f)
            }))
        };
    }

    /**
     * Get label for piano finger number
     * @private
     */
    _getPianoFingerLabel(finger) {
        const labels = {
            0: 'Open',
            1: 'Thumb',
            2: 'Index',
            3: 'Middle',
            4: 'Ring',
            5: 'Pinky'
        };
        return labels[finger] || '';
    }

    /**
     * Update display settings
     * @param {Object} settings - New settings
     */
    updateDisplaySettings(settings) {
        Object.assign(this.displaySettings, settings);
        this._emit('settingsChange', this.displaySettings);
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        }
    }

    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }

    /**
     * Export fingering data
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            instrument: this.instrument,
            displaySettings: this.displaySettings,
            currentFingerings: this.currentFingerings
        };
    }

    /**
     * Import fingering data
     * @param {Object} json - JSON data
     */
    fromJSON(json) {
        this.instrument = json.instrument || InstrumentType.PIANO;
        if (json.displaySettings) {
            Object.assign(this.displaySettings, json.displaySettings);
        }
        this.currentFingerings = json.currentFingerings || [];
    }
}

/**
 * Create a default instance
 */
export function createFingerPositionDisplay(options = {}) {
    return new FingerPositionDisplay(options);
}

/**
 * Quick function to get fingering for a scale
 */
export function getScaleFingering(instrument, scaleName, hand, octave = 'oneOctave') {
    const display = new FingerPositionDisplay({ instrument });
    return display.getScaleFingering(scaleName, hand, octave);
}

/**
 * Quick function to get fingering for a chord
 */
export function getChordFingering(instrument, chordName) {
    const display = new FingerPositionDisplay({ instrument });
    return display.getChordFingering(chordName);
}