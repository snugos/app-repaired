// js/ChordDiagramDisplay.js - Chord Diagram Display for SnugOS DAW
// Features: Show chord diagrams for guitar, ukulele, banjo, mandolin

/**
 * Instrument Types for Chord Diagrams
 */
export const ChordInstrumentType = {
    GUITAR: 'guitar',
    UKULELE: 'ukulele',
    BANJO: 'banjo',
    MANDOLIN: 'mandolin',
    BASS: 'bass'
};

/**
 * Standard Guitar Chord Diagrams
 * Format: { fret, string, finger }
 * String: 1=high E, 6=low E
 * Finger: 1=index, 2=middle, 3=ring, 4=pinky, 0=open, x=muted
 */
export const GuitarChordDiagrams = {
    // Major chords
    'C': {
        name: 'C Major',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 4, finger: 2 },
            { fret: 3, string: 5, finger: 3 }
        ],
        mutedStrings: [6],
        openStrings: [1, 3, 6]
    },
    'D': {
        name: 'D Major',
        positions: [
            { fret: 1, string: 3, finger: 1 },
            { fret: 2, string: 1, finger: 2 },
            { fret: 3, string: 2, finger: 3 }
        ],
        mutedStrings: [5, 6],
        openStrings: [4]
    },
    'E': {
        name: 'E Major',
        positions: [
            { fret: 1, string: 3, finger: 1 },
            { fret: 2, string: 5, finger: 2 },
            { fret: 2, string: 4, finger: 3 }
        ],
        mutedStrings: [],
        openStrings: [1, 2, 6]
    },
    'F': {
        name: 'F Major',
        positions: [
            { fret: 1, string: 1, finger: 1 },
            { fret: 1, string: 2, finger: 1, barre: true },
            { fret: 1, string: 3, finger: 1, barre: true },
            { fret: 1, string: 4, finger: 1, barre: true },
            { fret: 1, string: 5, finger: 1, barre: true },
            { fret: 1, string: 6, finger: 1, barre: true },
            { fret: 2, string: 4, finger: 2 },
            { fret: 3, string: 5, finger: 3 }
        ],
        mutedStrings: [],
        openStrings: [],
        barre: { fret: 1, startString: 1, endString: 6, finger: 1 }
    },
    'G': {
        name: 'G Major',
        positions: [
            { fret: 2, string: 5, finger: 2 },
            { fret: 1, string: 6, finger: 1 },
            { fret: 3, string: 1, finger: 3 },
            { fret: 3, string: 6, finger: 4 }
        ],
        mutedStrings: [],
        openStrings: [2, 3, 4]
    },
    'A': {
        name: 'A Major',
        positions: [
            { fret: 1, string: 4, finger: 1 },
            { fret: 2, string: 3, finger: 2 },
            { fret: 2, string: 2, finger: 3 }
        ],
        mutedStrings: [6],
        openStrings: [1, 5]
    },
    'B': {
        name: 'B Major',
        positions: [
            { fret: 2, string: 1, finger: 1, barre: true },
            { fret: 2, string: 2, finger: 1, barre: true },
            { fret: 2, string: 3, finger: 1, barre: true },
            { fret: 2, string: 4, finger: 1, barre: true },
            { fret: 2, string: 5, finger: 1, barre: true },
            { fret: 4, string: 4, finger: 3 },
            { fret: 4, string: 3, finger: 4 },
            { fret: 4, string: 2, finger: 2 }
        ],
        mutedStrings: [6],
        openStrings: [],
        barre: { fret: 2, startString: 1, endString: 5, finger: 1 }
    },
    
    // Minor chords
    'Am': {
        name: 'A Minor',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 4, finger: 2 },
            { fret: 2, string: 3, finger: 3 }
        ],
        mutedStrings: [6],
        openStrings: [1, 5]
    },
    'Bm': {
        name: 'B Minor',
        positions: [
            { fret: 2, string: 1, finger: 1, barre: true },
            { fret: 2, string: 2, finger: 1, barre: true },
            { fret: 2, string: 3, finger: 1, barre: true },
            { fret: 2, string: 4, finger: 1, barre: true },
            { fret: 2, string: 5, finger: 1, barre: true },
            { fret: 4, string: 4, finger: 3 },
            { fret: 3, string: 3, finger: 2 }
        ],
        mutedStrings: [6],
        openStrings: [],
        barre: { fret: 2, startString: 1, endString: 5, finger: 1 }
    },
    'Cm': {
        name: 'C Minor',
        positions: [
            { fret: 3, string: 1, finger: 1, barre: true },
            { fret: 3, string: 2, finger: 1, barre: true },
            { fret: 3, string: 3, finger: 1, barre: true },
            { fret: 3, string: 4, finger: 1, barre: true },
            { fret: 3, string: 5, finger: 1, barre: true },
            { fret: 5, string: 4, finger: 3 },
            { fret: 4, string: 3, finger: 2 }
        ],
        mutedStrings: [6],
        openStrings: [],
        barre: { fret: 3, startString: 1, endString: 5, finger: 1 }
    },
    'Dm': {
        name: 'D Minor',
        positions: [
            { fret: 1, string: 1, finger: 1 },
            { fret: 2, string: 3, finger: 2 },
            { fret: 3, string: 2, finger: 3 }
        ],
        mutedStrings: [5, 6],
        openStrings: [4]
    },
    'Em': {
        name: 'E Minor',
        positions: [
            { fret: 2, string: 5, finger: 2 },
            { fret: 2, string: 4, finger: 3 }
        ],
        mutedStrings: [],
        openStrings: [1, 2, 3, 6]
    },
    'Fm': {
        name: 'F Minor',
        positions: [
            { fret: 1, string: 1, finger: 1, barre: true },
            { fret: 1, string: 2, finger: 1, barre: true },
            { fret: 1, string: 3, finger: 1, barre: true },
            { fret: 1, string: 4, finger: 1, barre: true },
            { fret: 1, string: 5, finger: 1, barre: true },
            { fret: 1, string: 6, finger: 1, barre: true },
            { fret: 3, string: 4, finger: 3 }
        ],
        mutedStrings: [],
        openStrings: [],
        barre: { fret: 1, startString: 1, endString: 6, finger: 1 }
    },
    'Gm': {
        name: 'G Minor',
        positions: [
            { fret: 3, string: 1, finger: 1, barre: true },
            { fret: 3, string: 2, finger: 1, barre: true },
            { fret: 3, string: 3, finger: 1, barre: true },
            { fret: 3, string: 4, finger: 1, barre: true },
            { fret: 3, string: 5, finger: 1, barre: true },
            { fret: 3, string: 6, finger: 1, barre: true },
            { fret: 5, string: 4, finger: 3 }
        ],
        mutedStrings: [],
        openStrings: [],
        barre: { fret: 3, startString: 1, endString: 6, finger: 1 }
    },
    
    // Seventh chords
    'C7': {
        name: 'C Dominant 7th',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 4, finger: 2 },
            { fret: 3, string: 5, finger: 3 },
            { fret: 3, string: 3, finger: 4 }
        ],
        mutedStrings: [6],
        openStrings: [1]
    },
    'D7': {
        name: 'D Dominant 7th',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 1, finger: 2 },
            { fret: 2, string: 3, finger: 3 }
        ],
        mutedStrings: [5, 6],
        openStrings: [4]
    },
    'E7': {
        name: 'E Dominant 7th',
        positions: [
            { fret: 1, string: 3, finger: 1 },
            { fret: 2, string: 5, finger: 2 }
        ],
        mutedStrings: [],
        openStrings: [1, 2, 4, 6]
    },
    'G7': {
        name: 'G Dominant 7th',
        positions: [
            { fret: 1, string: 1, finger: 1 },
            { fret: 2, string: 5, finger: 2 },
            { fret: 3, string: 6, finger: 3 }
        ],
        mutedStrings: [],
        openStrings: [2, 3, 4]
    },
    'A7': {
        name: 'A Dominant 7th',
        positions: [
            { fret: 2, string: 4, finger: 2 },
            { fret: 2, string: 3, finger: 3 }
        ],
        mutedStrings: [6],
        openStrings: [1, 2, 5]
    },
    'B7': {
        name: 'B Dominant 7th',
        positions: [
            { fret: 1, string: 4, finger: 1 },
            { fret: 2, string: 5, finger: 2 },
            { fret: 2, string: 3, finger: 3 },
            { fret: 2, string: 1, finger: 4 }
        ],
        mutedStrings: [6],
        openStrings: [2]
    },
    
    // Major 7th chords
    'Cmaj7': {
        name: 'C Major 7th',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 4, finger: 2 },
            { fret: 3, string: 5, finger: 3 }
        ],
        mutedStrings: [6],
        openStrings: [1, 3]
    },
    'Dmaj7': {
        name: 'D Major 7th',
        positions: [
            { fret: 2, string: 1, finger: 2 },
            { fret: 2, string: 3, finger: 1 },
            { fret: 2, string: 2, finger: 3 }
        ],
        mutedStrings: [5, 6],
        openStrings: [4]
    },
    'Emaj7': {
        name: 'E Major 7th',
        positions: [
            { fret: 1, string: 3, finger: 1 },
            { fret: 2, string: 5, finger: 2 },
            { fret: 2, string: 4, finger: 3 },
            { fret: 4, string: 2, finger: 4 }
        ],
        mutedStrings: [],
        openStrings: [1, 6]
    },
    'Fmaj7': {
        name: 'F Major 7th',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 4, finger: 2 },
            { fret: 3, string: 5, finger: 3 }
        ],
        mutedStrings: [6],
        openStrings: [1, 3]
    },
    'Gmaj7': {
        name: 'G Major 7th',
        positions: [
            { fret: 2, string: 5, finger: 2 },
            { fret: 1, string: 6, finger: 1 },
            { fret: 3, string: 1, finger: 3 },
            { fret: 2, string: 3, finger: 4 }
        ],
        mutedStrings: [],
        openStrings: [2, 4]
    },
    'Amaj7': {
        name: 'A Major 7th',
        positions: [
            { fret: 1, string: 4, finger: 1 },
            { fret: 2, string: 3, finger: 2 },
            { fret: 2, string: 2, finger: 3 }
        ],
        mutedStrings: [6],
        openStrings: [1, 5]
    },
    
    // Minor 7th chords
    'Am7': {
        name: 'A Minor 7th',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 4, finger: 2 }
        ],
        mutedStrings: [6],
        openStrings: [1, 3, 5]
    },
    'Bm7': {
        name: 'B Minor 7th',
        positions: [
            { fret: 2, string: 1, finger: 1, barre: true },
            { fret: 2, string: 2, finger: 1, barre: true },
            { fret: 2, string: 3, finger: 1, barre: true },
            { fret: 2, string: 4, finger: 1, barre: true },
            { fret: 2, string: 5, finger: 1, barre: true },
            { fret: 4, string: 4, finger: 3 }
        ],
        mutedStrings: [6],
        openStrings: [],
        barre: { fret: 2, startString: 1, endString: 5, finger: 1 }
    },
    'Dm7': {
        name: 'D Minor 7th',
        positions: [
            { fret: 1, string: 1, finger: 1 },
            { fret: 2, string: 3, finger: 2 }
        ],
        mutedStrings: [5, 6],
        openStrings: [2, 4]
    },
    'Em7': {
        name: 'E Minor 7th',
        positions: [
            { fret: 2, string: 5, finger: 2 }
        ],
        mutedStrings: [],
        openStrings: [1, 2, 3, 4, 6]
    },
    
    // Suspended chords
    'Dsus2': {
        name: 'D Suspended 2',
        positions: [
            { fret: 2, string: 3, finger: 1 },
            { fret: 3, string: 2, finger: 2 }
        ],
        mutedStrings: [5, 6],
        openStrings: [1, 4]
    },
    'Dsus4': {
        name: 'D Suspended 4',
        positions: [
            { fret: 2, string: 3, finger: 1 },
            { fret: 3, string: 2, finger: 2 },
            { fret: 3, string: 1, finger: 3 }
        ],
        mutedStrings: [5, 6],
        openStrings: [4]
    },
    'Asus2': {
        name: 'A Suspended 2',
        positions: [
            { fret: 2, string: 4, finger: 1 },
            { fret: 2, string: 3, finger: 2 }
        ],
        mutedStrings: [6],
        openStrings: [1, 2, 5]
    },
    'Asus4': {
        name: 'A Suspended 4',
        positions: [
            { fret: 2, string: 4, finger: 1 },
            { fret: 2, string: 3, finger: 2 },
            { fret: 3, string: 2, finger: 3 }
        ],
        mutedStrings: [6],
        openStrings: [1, 5]
    }
};

/**
 * Ukulele Chord Diagrams
 * Standard tuning: G4-C4-E4-A4 (low G to high A)
 * String: 1=A, 2=E, 3=C, 4=G
 */
export const UkuleleChordDiagrams = {
    'C': {
        name: 'C Major',
        positions: [
            { fret: 3, string: 1, finger: 3 }
        ],
        mutedStrings: [],
        openStrings: [2, 3, 4]
    },
    'D': {
        name: 'D Major',
        positions: [
            { fret: 2, string: 1, finger: 1 },
            { fret: 2, string: 2, finger: 2 },
            { fret: 2, string: 3, finger: 1, barre: true }
        ],
        mutedStrings: [],
        openStrings: [4]
    },
    'E': {
        name: 'E Major',
        positions: [
            { fret: 2, string: 1, finger: 1, barre: true },
            { fret: 2, string: 2, finger: 1, barre: true },
            { fret: 3, string: 3, finger: 2 },
            { fret: 4, string: 4, finger: 3 }
        ],
        mutedStrings: [],
        openStrings: []
    },
    'F': {
        name: 'F Major',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 4, finger: 2 }
        ],
        mutedStrings: [],
        openStrings: [1, 3]
    },
    'G': {
        name: 'G Major',
        positions: [
            { fret: 2, string: 3, finger: 1 },
            { fret: 3, string: 2, finger: 2 }
        ],
        mutedStrings: [],
        openStrings: [1, 4]
    },
    'A': {
        name: 'A Major',
        positions: [
            { fret: 1, string: 3, finger: 1 }
        ],
        mutedStrings: [],
        openStrings: [1, 2, 4]
    },
    'Am': {
        name: 'A Minor',
        positions: [
            { fret: 2, string: 4, finger: 1 }
        ],
        mutedStrings: [],
        openStrings: [1, 2, 3]
    },
    'Dm': {
        name: 'D Minor',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 4, finger: 2 }
        ],
        mutedStrings: [],
        openStrings: [1, 3]
    },
    'Em': {
        name: 'E Minor',
        positions: [
            { fret: 2, string: 3, finger: 1 },
            { fret: 3, string: 2, finger: 2 }
        ],
        mutedStrings: [],
        openStrings: [1, 4]
    },
    'G7': {
        name: 'G Dominant 7th',
        positions: [
            { fret: 1, string: 2, finger: 1 },
            { fret: 2, string: 3, finger: 2 },
            { fret: 2, string: 4, finger: 3 }
        ],
        mutedStrings: [],
        openStrings: [1]
    },
    'C7': {
        name: 'C Dominant 7th',
        positions: [
            { fret: 1, string: 3, finger: 1 }
        ],
        mutedStrings: [],
        openStrings: [1, 2, 4]
    }
};

/**
 * Chord Diagram Display Manager
 */
export class ChordDiagramDisplay {
    constructor(options = {}) {
        this.instrument = options.instrument || ChordInstrumentType.GUITAR;
        this.displaySettings = {
            width: 120,
            height: 160,
            showFingerNumbers: true,
            showNut: true,
            showMutedStrings: true,
            startFret: 1,
            numFrets: 5,
            dotColor: '#3b82f6',
            mutedColor: '#666',
            openColor: '#22c55e',
            stringColor: '#333',
            fretColor: '#333',
            nutColor: '#333',
            labelColor: '#000',
            fontSize: 11,
            orientation: 'vertical'
        };
        
        this.listeners = new Map();
        this.customChords = new Map();
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
     * Get chord diagram data
     * @param {string} chordName - Chord name
     * @returns {Object|null} Chord diagram data
     */
    getChordDiagram(chordName) {
        // Check custom chords first
        if (this.customChords.has(chordName)) {
            return this.customChords.get(chordName);
        }
        
        // Get from predefined diagrams
        if (this.instrument === ChordInstrumentType.GUITAR) {
            return GuitarChordDiagrams[chordName] || null;
        } else if (this.instrument === ChordInstrumentType.UKULELE) {
            return UkuleleChordDiagrams[chordName] || null;
        }
        
        return null;
    }

    /**
     * Add custom chord diagram
     * @param {string} chordName - Chord name
     * @param {Object} diagram - Chord diagram data
     */
    addCustomChord(chordName, diagram) {
        this.customChords.set(chordName, {
            name: diagram.name || chordName,
            positions: diagram.positions || [],
            mutedStrings: diagram.mutedStrings || [],
            openStrings: diagram.openStrings || [],
            barre: diagram.barre || null
        });
        this._emit('chordAdded', chordName);
    }

    /**
     * Remove custom chord
     * @param {string} chordName - Chord name
     */
    removeCustomChord(chordName) {
        if (this.customChords.has(chordName)) {
            this.customChords.delete(chordName);
            this._emit('chordRemoved', chordName);
        }
    }

    /**
     * Get all available chords
     * @returns {string[]} Array of chord names
     */
    getAvailableChords() {
        let chords = [];
        
        if (this.instrument === ChordInstrumentType.GUITAR) {
            chords = Object.keys(GuitarChordDiagrams);
        } else if (this.instrument === ChordInstrumentType.UKULELE) {
            chords = Object.keys(UkuleleChordDiagrams);
        }
        
        // Add custom chords
        this.customChords.forEach((_, name) => {
            if (!chords.includes(name)) {
                chords.push(name);
            }
        });
        
        return chords.sort();
    }

    /**
     * Create SVG diagram
     * @param {string} chordName - Chord name
     * @param {Object} options - Display options
     * @returns {string} SVG string
     */
    createSVGDiagram(chordName, options = {}) {
        const diagram = this.getChordDiagram(chordName);
        if (!diagram) return '';
        
        const settings = { ...this.displaySettings, ...options };
        const numStrings = this.instrument === ChordInstrumentType.GUITAR ? 6 : 4;
        
        const width = settings.width;
        const height = settings.height;
        const padding = { top: 35, right: 20, bottom: 15, left: 25 };
        const fretboardWidth = width - padding.left - padding.right;
        const fretboardHeight = height - padding.top - padding.bottom;
        const stringSpacing = fretboardWidth / (numStrings - 1);
        const fretSpacing = fretboardHeight / settings.numFrets;
        
        let svg = `<svg width="${width}" height="${height}" class="chord-diagram" xmlns="http://www.w3.org/2000/svg">`;
        
        // Add title
        svg += `<text x="${width / 2}" y="15" text-anchor="middle" font-size="14" font-weight="bold" fill="${settings.labelColor}">${diagram.name || chordName}</text>`;
        
        // Draw nut (top bar)
        if (settings.showNut && settings.startFret === 1) {
            svg += `<rect x="${padding.left - 3}" y="${padding.top - 3}" width="${fretboardWidth + 6}" height="6" fill="${settings.nutColor}" rx="1"/>`;
        } else {
            // Show starting fret number
            svg += `<text x="${padding.left - 15}" y="${padding.top + 10}" font-size="10" fill="${settings.labelColor}">${settings.startFret}</text>`;
        }
        
        // Draw strings
        for (let i = 0; i < numStrings; i++) {
            const x = padding.left + (numStrings - 1 - i) * stringSpacing;
            svg += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="${settings.stringColor}" stroke-width="1.5"/>`;
        }
        
        // Draw frets
        for (let i = 0; i <= settings.numFrets; i++) {
            const y = padding.top + i * fretSpacing;
            const strokeWidth = i === 0 && settings.startFret === 1 ? 0 : 1;
            if (strokeWidth > 0) {
                svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${settings.fretColor}" stroke-width="1"/>`;
            }
        }
        
        // Draw barre if present
        if (diagram.barre) {
            const barreY = padding.top + (diagram.barre.fret - settings.startFret + 0.5) * fretSpacing;
            const startX = padding.left + (numStrings - diagram.barre.startString) * stringSpacing;
            const endX = padding.left + (numStrings - diagram.barre.endString) * stringSpacing;
            
            svg += `<rect x="${startX}" y="${barreY - 6}" width="${endX - startX}" height="12" fill="${settings.dotColor}" rx="6"/>`;
            
            if (settings.showFingerNumbers) {
                const centerX = (startX + endX) / 2;
                svg += `<text x="${centerX}" y="${barreY + 4}" text-anchor="middle" font-size="${settings.fontSize}" fill="white">${diagram.barre.finger}</text>`;
            }
        }
        
        // Draw finger positions
        diagram.positions.forEach(pos => {
            // Skip if this is part of a barre
            if (diagram.barre && pos.barre) return;
            
            const adjustedFret = pos.fret - settings.startFret + 1;
            if (adjustedFret < 1 || adjustedFret > settings.numFrets) return;
            
            const x = padding.left + (numStrings - pos.string) * stringSpacing;
            const y = padding.top + (adjustedFret - 0.5) * fretSpacing;
            
            svg += `<circle cx="${x}" cy="${y}" r="9" fill="${settings.dotColor}"/>`;
            
            if (settings.showFingerNumbers) {
                svg += `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="${settings.fontSize}" fill="white">${pos.finger}</text>`;
            }
        });
        
        // Draw open string markers
        if (settings.showMutedStrings && diagram.openStrings) {
            diagram.openStrings.forEach(stringNum => {
                const x = padding.left + (numStrings - stringNum) * stringSpacing;
                svg += `<circle cx="${x}" cy="${padding.top - 15}" r="5" fill="none" stroke="${settings.openColor}" stroke-width="2"/>`;
            });
        }
        
        // Draw muted string markers
        if (settings.showMutedStrings && diagram.mutedStrings) {
            diagram.mutedStrings.forEach(stringNum => {
                const x = padding.left + (numStrings - stringNum) * stringSpacing;
                svg += `<text x="${x}" y="${padding.top - 12}" text-anchor="middle" font-size="12" fill="${settings.mutedColor}">×</text>`;
            });
        }
        
        svg += '</svg>';
        return svg;
    }

    /**
     * Create HTML diagram container
     * @param {string} chordName - Chord name
     * @param {Object} options - Display options
     * @returns {string} HTML string
     */
    createHTMLDiagram(chordName, options = {}) {
        const svg = this.createSVGDiagram(chordName, options);
        const settings = { ...this.displaySettings, ...options };
        
        return `<div class="chord-diagram-container" style="display: inline-block; margin: 5px;">
            ${svg}
        </div>`;
    }

    /**
     * Create chord diagram grid
     * @param {string[]} chordNames - Array of chord names
     * @param {Object} options - Display options
     * @returns {string} HTML string
     */
    createChordGrid(chordNames, options = {}) {
        const diagrams = chordNames
            .map(name => this.createHTMLDiagram(name, { ...options, width: 100, height: 130 }))
            .join('');
        
        return `<div class="chord-grid" style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${diagrams}
        </div>`;
    }

    /**
     * Create interactive chord diagram
     * @param {string} chordName - Chord name
     * @param {HTMLElement} container - Container element
     * @param {Function} onClick - Click callback
     * @returns {HTMLElement} Interactive element
     */
    createInteractiveDiagram(chordName, container, onClick) {
        const diagram = this.getChordDiagram(chordName);
        if (!diagram) return null;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'interactive-chord-diagram';
        wrapper.innerHTML = this.createHTMLDiagram(chordName);
        wrapper.style.cursor = 'pointer';
        
        if (onClick) {
            wrapper.addEventListener('click', () => onClick(chordName, diagram));
        }
        
        if (container) {
            container.appendChild(wrapper);
        }
        
        return wrapper;
    }

    /**
     * Create chord progression display
     * @param {string[]} progression - Array of chord names
     * @param {Object} options - Display options
     * @returns {string} HTML string
     */
    createProgressionDisplay(progression, options = {}) {
        const settings = { ...this.displaySettings, ...options };
        
        const chords = progression.map((chord, index) => {
            const svg = this.createSVGDiagram(chord, { ...settings, width: 80, height: 110 });
            return `<div class="progression-chord" style="text-align: center;">
                ${svg}
                <div style="font-size: 10px; margin-top: 2px;">${index + 1}</div>
            </div>`;
        }).join('');
        
        return `<div class="chord-progression" style="display: flex; gap: 15px; overflow-x: auto; padding: 10px;">
            ${chords}
        </div>`;
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
     * Export chord library
     * @returns {Object} JSON representation
     */
    exportChordLibrary() {
        const library = {
            instrument: this.instrument,
            displaySettings: this.displaySettings,
            customChords: {}
        };
        
        this.customChords.forEach((diagram, name) => {
            library.customChords[name] = diagram;
        });
        
        return library;
    }

    /**
     * Import chord library
     * @param {Object} json - JSON data
     */
    importChordLibrary(json) {
        if (json.instrument) {
            this.instrument = json.instrument;
        }
        if (json.displaySettings) {
            Object.assign(this.displaySettings, json.displaySettings);
        }
        if (json.customChords) {
            Object.entries(json.customChords).forEach(([name, diagram]) => {
                this.addCustomChord(name, diagram);
            });
        }
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
}

/**
 * Create a default instance
 */
export function createChordDiagramDisplay(options = {}) {
    return new ChordDiagramDisplay(options);
}

/**
 * Quick function to get a chord diagram
 */
export function getChordDiagram(instrument, chordName) {
    const display = new ChordDiagramDisplay({ instrument });
    return display.getChordDiagram(chordName);
}

/**
 * Quick function to create SVG diagram
 */
export function createSVGChordDiagram(chordName, instrument = ChordInstrumentType.GUITAR) {
    const display = new ChordDiagramDisplay({ instrument });
    return display.createSVGDiagram(chordName);
}