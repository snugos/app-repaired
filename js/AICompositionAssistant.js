/**
 * AI Composition Assistant
 * AI-powered melody, chord, and rhythm suggestions for creative composition
 */

// Scale definitions with intervals
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    pentatonicMajor: [0, 2, 4, 7, 9],
    pentatonicMinor: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

// Chord types with intervals
const CHORD_TYPES = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
    dim7: [0, 3, 6, 9],
    halfDim: [0, 3, 6, 10],
    sus2: [0, 2, 7],
    sus4: [0, 5, 7],
    add9: [0, 4, 7, 14],
    min9: [0, 3, 7, 10, 14],
    maj9: [0, 4, 7, 11, 14]
};

// Common chord progressions by style
const CHORD_PROGRESSIONS = {
    pop: [
        { name: 'I-V-vi-IV', degrees: [1, 5, 6, 4] },
        { name: 'I-IV-V-I', degrees: [1, 4, 5, 1] },
        { name: 'I-V-I-IV', degrees: [1, 5, 1, 4] },
        { name: 'vi-IV-I-V', degrees: [6, 4, 1, 5] }
    ],
    jazz: [
        { name: 'ii-V-I', degrees: [2, 5, 1] },
        { name: 'ii-V-I-vi', degrees: [2, 5, 1, 6] },
        { name: 'I-vi-ii-V', degrees: [1, 6, 2, 5] },
        { name: 'iii-vi-ii-V', degrees: [3, 6, 2, 5] }
    ],
    blues: [
        { name: '12-bar blues', degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5] },
        { name: '8-bar blues', degrees: [1, 1, 4, 4, 1, 1, 5, 4] }
    ],
    rock: [
        { name: 'I-bVII-IV-I', degrees: [1, 7, 4, 1] },
        { name: 'I-IV-bVI-bVII', degrees: [1, 4, 6, 7] },
        { name: 'i-VI-i-VII', degrees: [1, 6, 1, 7] }
    ],
    classical: [
        { name: 'I-IV-V-I', degrees: [1, 4, 5, 1] },
        { name: 'I-ii-V-I', degrees: [1, 2, 5, 1] },
        { name: 'I-V-vi-iii-IV-I-IV-V', degrees: [1, 5, 6, 3, 4, 1, 4, 5] }
    ]
};

// Rhythm patterns (in 16th notes)
const RHYTHM_PATTERNS = {
    basic: [
        { name: 'Quarter notes', pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
        { name: 'Eighth notes', pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0] },
        { name: 'Half notes', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] }
    ],
    syncopated: [
        { name: 'Offbeat eighth', pattern: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] },
        { name: 'Syncopated sixteenth', pattern: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1] },
        { name: 'Latin clave 3-2', pattern: [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0] }
    ],
    complex: [
        { name: 'Trap hi-hat', pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
        { name: 'Drum and bass', pattern: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1] },
        { name: 'House kick', pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] }
    ]
};

// Bass line patterns
const BASS_PATTERNS = {
    basic: [
        { name: 'Root notes', pattern: 'root' },
        { name: 'Root-5th', pattern: 'root-fifth' },
        { name: 'Root-octave', pattern: 'root-octave' }
    ],
    walking: [
        { name: 'Walking bass', pattern: 'walking' },
        { name: 'Scalar walking', pattern: 'scalar-walking' }
    ],
    modern: [
        { name: 'Synth bass octaves', pattern: 'octave-jump' },
        { name: 'Electronic pulse', pattern: 'pulse' },
        { name: 'Trap 808 slide', pattern: 'slide' }
    ]
};

class AICompositionAssistant {
    constructor() {
        this.enabled = true;
        this.currentKey = 'C';
        this.currentScale = 'major';
        this.currentBPM = 120;
        this.complexityLevel = 'medium'; // simple, medium, complex
        this.style = 'pop';
        this.suggestionHistory = [];
        this.maxHistorySize = 50;
    }

    /**
     * Set the musical context
     */
    setContext(key, scale, bpm, style = 'pop', complexity = 'medium') {
        this.currentKey = key;
        this.currentScale = scale;
        this.currentBPM = bpm;
        this.style = style;
        this.complexityLevel = complexity;
    }

    /**
     * Get scale notes for a given key and scale
     */
    getScaleNotes(key = this.currentKey, scale = this.currentScale) {
        const rootNote = this.noteToMidi(key);
        const intervals = SCALES[scale] || SCALES.major;
        return intervals.map(interval => rootNote + interval);
    }

    /**
     * Convert note name to MIDI number
     */
    noteToMidi(noteName) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const match = noteName.match(/^([A-G]#?)(\d)?$/);
        if (!match) return 60; // Default to C4
        
        const noteIndex = notes.indexOf(match[1]);
        const octave = match[2] ? parseInt(match[2]) : 4;
        return noteIndex + (octave + 1) * 12;
    }

    /**
     * Convert MIDI number to note name
     */
    midiToNote(midiNumber) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNumber / 12) - 1;
        const note = notes[midiNumber % 12];
        return `${note}${octave}`;
    }

    /**
     * Generate a melody suggestion
     */
    generateMelody(options = {}) {
        const {
            length = 8, // number of notes
            octaveRange = 2,
            startOctave = 4,
            rhythm = null,
            contour = 'balanced' // ascending, descending, arch, valley, random, balanced
        } = options;

        const scaleNotes = this.getScaleNotes();
        const melody = [];
        
        // Determine rhythm pattern
        let rhythmPattern = rhythm;
        if (!rhythmPattern) {
            const patterns = [...RHYTHM_PATTERNS.basic, ...RHYTHM_PATTERNS.syncopated];
            rhythmPattern = patterns[Math.floor(Math.random() * patterns.length)].pattern;
        }

        // Generate note sequence based on contour
        let currentOctave = startOctave;
        let lastNoteIndex = Math.floor(scaleNotes.length / 2);

        for (let i = 0; i < length; i++) {
            // Determine next note based on contour
            let step = 0;
            switch (contour) {
                case 'ascending':
                    step = Math.random() > 0.3 ? 1 : 0;
                    break;
                case 'descending':
                    step = Math.random() > 0.3 ? -1 : 0;
                    break;
                case 'arch':
                    step = i < length / 2 ? 1 : -1;
                    break;
                case 'valley':
                    step = i < length / 2 ? -1 : 1;
                    break;
                case 'random':
                    step = Math.floor(Math.random() * 5) - 2;
                    break;
                case 'balanced':
                default:
                    step = Math.floor(Math.random() * 3) - 1;
            }

            // Apply step with octave adjustment
            lastNoteIndex += step;
            if (lastNoteIndex >= scaleNotes.length) {
                lastNoteIndex = 0;
                currentOctave = Math.min(currentOctave + 1, startOctave + octaveRange);
            } else if (lastNoteIndex < 0) {
                lastNoteIndex = scaleNotes.length - 1;
                currentOctave = Math.max(currentOctave - 1, startOctave - octaveRange);
            }

            // Get the actual MIDI note
            const baseNote = scaleNotes[lastNoteIndex % scaleNotes.length];
            const octaveOffset = Math.floor(lastNoteIndex / scaleNotes.length);
            const midiNote = baseNote + (octaveOffset * 12);

            // Determine duration from rhythm pattern
            const rhythmIndex = i % rhythmPattern.length;
            const duration = rhythmPattern[rhythmIndex] ? 
                (rhythmPattern.filter((v, idx) => idx >= rhythmIndex && v === 0).length + 1) * 0.25 : 1;

            melody.push({
                note: this.midiToNote(midiNote),
                midiNote: midiNote,
                duration: duration,
                velocity: 0.6 + Math.random() * 0.4,
                position: i * 0.5
            });
        }

        this.addToHistory({ type: 'melody', melody, options });
        return melody;
    }

    /**
     * Generate a chord progression suggestion
     */
    generateChordProgression(options = {}) {
        const {
            length = 4,
            style = this.style,
            variations = false
        } = options;

        const progressions = CHORD_PROGRESSIONS[style] || CHORD_PROGRESSIONS.pop;
        const selectedProgression = progressions[Math.floor(Math.random() * progressions.length)];
        
        const chords = [];
        const scaleNotes = this.getScaleNotes();

        for (let i = 0; i < Math.min(length, selectedProgression.degrees.length); i++) {
            const degree = selectedProgression.degrees[i];
            const chordRoot = scaleNotes[(degree - 1) % scaleNotes.length];
            
            // Determine chord type based on degree and style
            let chordType = 'major';
            if (style === 'jazz') {
                chordType = this.getJazzChordType(degree);
            } else {
                chordType = this.getChordTypeForDegree(degree);
            }

            // Add variations if requested
            if (variations && Math.random() > 0.7) {
                chordType = this.varyChordType(chordType);
            }

            const chordNotes = this.buildChord(chordRoot, chordType);
            
            chords.push({
                name: `${this.midiToNote(chordRoot).replace(/\d+$/, '')}${chordType === 'major' ? '' : chordType === 'minor' ? 'm' : chordType}`,
                root: this.midiToNote(chordRoot),
                type: chordType,
                notes: chordNotes.map(n => this.midiToNote(n)),
                midiNotes: chordNotes,
                degree: degree,
                duration: 4,
                position: i * 4
            });
        }

        this.addToHistory({ type: 'chords', chords, options });
        return {
            name: selectedProgression.name,
            chords: chords
        };
    }

    /**
     * Get appropriate chord type for scale degree
     */
    getChordTypeForDegree(degree) {
        const degreeChordMap = {
            1: 'major', 2: 'minor', 3: 'minor', 4: 'major',
            5: 'major', 6: 'minor', 7: 'dim'
        };
        return degreeChordMap[degree] || 'major';
    }

    /**
     * Get jazz chord type for scale degree
     */
    getJazzChordType(degree) {
        const jazzChordMap = {
            1: 'maj7', 2: 'min7', 3: 'min7', 4: 'maj7',
            5: 'dom7', 6: 'min7', 7: 'halfDim'
        };
        return jazzChordMap[degree] || 'maj7';
    }

    /**
     * Vary a chord type for interest
     */
    varyChordType(chordType) {
        const variations = {
            'major': ['maj7', 'add9', 'sus2', 'sus4'],
            'minor': ['min7', 'min9'],
            'maj7': ['major', 'add9'],
            'dom7': ['dom7', 'sus4']
        };
        const opts = variations[chordType] || [chordType];
        return opts[Math.floor(Math.random() * opts.length)];
    }

    /**
     * Build a chord from root and type
     */
    buildChord(rootMidi, chordType) {
        const intervals = CHORD_TYPES[chordType] || CHORD_TYPES.major;
        return intervals.map(interval => rootMidi + interval);
    }

    /**
     * Generate a bass line suggestion
     */
    generateBassLine(options = {}) {
        const {
            chordProgression = null,
            pattern = 'root',
            style = 'basic',
            length = 16
        } = options;

        const bassNotes = [];
        let chords = chordProgression?.chords;
        
        if (!chords) {
            const prog = this.generateChordProgression({ length: 4 });
            chords = prog.chords;
        }

        // Get bass pattern
        const patterns = BASS_PATTERNS[style] || BASS_PATTERNS.basic;
        const selectedPattern = typeof pattern === 'string' ? 
            patterns.find(p => p.pattern === pattern) || patterns[0] : pattern;

        for (let i = 0; i < length; i++) {
            const chordIndex = Math.floor(i / 4) % chords.length;
            const chord = chords[chordIndex];
            const rootMidi = chord.midiNotes[0] - 12; // Bass is an octave lower
            const beat = i % 4;

            let noteMidi = rootMidi;
            let duration = 1;

            switch (selectedPattern.pattern) {
                case 'root':
                    noteMidi = rootMidi;
                    duration = chord.duration / 4;
                    break;
                case 'root-fifth':
                    noteMidi = beat % 2 === 0 ? rootMidi : rootMidi + 7;
                    duration = 1;
                    break;
                case 'root-octave':
                    noteMidi = beat % 2 === 0 ? rootMidi : rootMidi + 12;
                    duration = 1;
                    break;
                case 'walking':
                    // Walking bass - add passing tones
                    const walkingNotes = this.generateWalkingNotes(chord, rootMidi);
                    noteMidi = walkingNotes[beat % walkingNotes.length];
                    duration = 1;
                    break;
                case 'octave-jump':
                    noteMidi = beat % 2 === 0 ? rootMidi : rootMidi + 12;
                    duration = 0.5;
                    break;
                case 'pulse':
                    noteMidi = rootMidi;
                    duration = beat === 0 ? 2 : 0.5;
                    break;
                default:
                    noteMidi = rootMidi;
                    duration = 1;
            }

            bassNotes.push({
                note: this.midiToNote(noteMidi),
                midiNote: noteMidi,
                duration: duration,
                velocity: 0.8,
                position: i
            });
        }

        this.addToHistory({ type: 'bass', bassNotes, options });
        return bassNotes;
    }

    /**
     * Generate walking bass notes for a chord
     */
    generateWalkingNotes(chord, rootMidi) {
        const chordTones = chord.midiNotes.map(n => n - 12);
        const walkingNotes = [rootMidi];
        
        // Add approach tones
        for (let i = 1; i < 4; i++) {
            if (i % 2 === 1) {
                // Approach tone (chromatic or scalar)
                const target = chordTones[Math.floor(i / 2) + 1] || rootMidi + 7;
                walkingNotes.push(target - 1);
            } else {
                // Chord tone
                walkingNotes.push(chordTones[Math.min(i / 2, chordTones.length - 1)]);
            }
        }
        
        return walkingNotes;
    }

    /**
     * Generate a rhythm pattern suggestion
     */
    generateRhythmPattern(options = {}) {
        const {
            style = 'basic',
            length = 16, // in 16th notes
            density = 0.5, // 0-1
            syncopation = 0.3
        } = options;

        const patterns = RHYTHM_PATTERNS[style] || RHYTHM_PATTERNS.basic;
        let pattern = [...(patterns[Math.floor(Math.random() * patterns.length)].pattern)];

        // Adjust length
        while (pattern.length < length) {
            pattern = [...pattern, ...pattern];
        }
        pattern = pattern.slice(0, length);

        // Apply density
        pattern = pattern.map(v => {
            if (v === 1 && Math.random() > density) return 0;
            if (v === 0 && Math.random() < density * 0.3) return 1;
            return v;
        });

        // Apply syncopation
        if (syncopation > 0) {
            for (let i = 0; i < pattern.length - 1; i++) {
                if (pattern[i] === 1 && pattern[i + 1] === 0 && Math.random() < syncopation) {
                    pattern[i] = 0;
                    pattern[i + 1] = 1;
                }
            }
        }

        this.addToHistory({ type: 'rhythm', pattern, options });
        return pattern;
    }

    /**
     * Generate a complete section (melody + chords + bass)
     */
    generateSection(options = {}) {
        const {
            bars = 4,
            style = this.style,
            includeMelody = true,
            includeChords = true,
            includeBass = true
        } = options;

        const section = {
            bars: bars,
            style: style,
            melody: null,
            chords: null,
            bass: null,
            tempo: this.currentBPM,
            key: this.currentKey,
            scale: this.currentScale
        };

        if (includeChords) {
            section.chords = this.generateChordProgression({
                length: bars,
                style: style
            });
        }

        if (includeMelody) {
            section.melody = this.generateMelody({
                length: bars * 4,
                contour: ['ascending', 'descending', 'arch', 'balanced'][Math.floor(Math.random() * 4)]
            });
        }

        if (includeBass && section.chords) {
            section.bass = this.generateBassLine({
                chordProgression: section.chords,
                style: style === 'jazz' ? 'walking' : 'basic'
            });
        }

        this.addToHistory({ type: 'section', section, options });
        return section;
    }

    /**
     * Analyze existing MIDI data and provide suggestions
     */
    analyzeAndSuggest(existingNotes, options = {}) {
        const {
            suggestVariations = true,
            suggestExtensions = true
        } = options;

        if (!existingNotes || existingNotes.length === 0) {
            return { suggestions: [], analysis: null };
        }

        // Detect key and scale from existing notes
        const detectedKey = this.detectKey(existingNotes);
        
        // Analyze melodic contour
        const contour = this.analyzeContour(existingNotes);
        
        // Analyze rhythm density
        const rhythmAnalysis = this.analyzeRhythm(existingNotes);

        const suggestions = [];

        // Suggest complementary melody
        if (suggestVariations) {
            suggestions.push({
                type: 'variation',
                description: `Generate a variation on the existing melody`,
                data: this.generateMelody({
                    length: existingNotes.length,
                    contour: contour.opposite
                })
            });
        }

        // Suggest extension
        if (suggestExtensions) {
            const lastNote = existingNotes[existingNotes.length - 1];
            suggestions.push({
                type: 'extension',
                description: `Extend the melody with ${4} more notes`,
                data: this.generateMelody({
                    length: 4,
                    startOctave: Math.floor(lastNote.midiNote / 12) - 1,
                    contour: 'balanced'
                })
            });
        }

        // Suggest chords that fit the detected key
        suggestions.push({
            type: 'harmony',
            description: `Chord progression in detected key of ${detectedKey.key} ${detectedKey.scale}`,
            data: this.generateChordProgression({ style: this.style })
        });

        return {
            suggestions: suggestions,
            analysis: {
                detectedKey: detectedKey,
                contour: contour,
                rhythm: rhythmAnalysis
            }
        };
    }

    /**
     * Detect key from MIDI notes
     */
    detectKey(notes) {
        const noteCounts = {};
        
        notes.forEach(note => {
            const pitchClass = note.midiNote % 12;
            noteCounts[pitchClass] = (noteCounts[pitchClass] || 0) + 1;
        });

        // Find most likely key by checking scale matches
        let bestKey = 'C';
        let bestScale = 'major';
        let bestScore = 0;

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        for (const keyName of noteNames) {
            for (const scaleName of Object.keys(SCALES)) {
                const scaleNotes = this.getScaleNotes(keyName, scaleName);
                const score = scaleNotes.reduce((sum, note) => {
                    return sum + (noteCounts[note % 12] || 0);
                }, 0);

                if (score > bestScore) {
                    bestScore = score;
                    bestKey = keyName;
                    bestScale = scaleName;
                }
            }
        }

        return { key: bestKey, scale: bestScale, confidence: bestScore / notes.length };
    }

    /**
     * Analyze melodic contour
     */
    analyzeContour(notes) {
        if (notes.length < 2) return { direction: 'static', opposite: 'static' };

        let ascending = 0;
        let descending = 0;

        for (let i = 1; i < notes.length; i++) {
            const diff = notes[i].midiNote - notes[i - 1].midiNote;
            if (diff > 0) ascending++;
            else if (diff < 0) descending++;
        }

        const direction = ascending > descending ? 'ascending' : 
                         descending > ascending ? 'descending' : 'balanced';
        
        const opposite = direction === 'ascending' ? 'descending' :
                        direction === 'descending' ? 'ascending' : 'balanced';

        return { direction, opposite, ascending, descending };
    }

    /**
     * Analyze rhythm density
     */
    analyzeRhythm(notes) {
        if (notes.length === 0) return { density: 0, averageDuration: 0 };

        const totalDuration = notes.reduce((sum, n) => sum + n.duration, 0);
        const averageDuration = totalDuration / notes.length;
        const density = notes.length / totalDuration;

        return {
            density: density,
            averageDuration: averageDuration,
            totalNotes: notes.length
        };
    }

    /**
     * Add to suggestion history
     */
    addToHistory(suggestion) {
        suggestion.timestamp = Date.now();
        this.suggestionHistory.push(suggestion);
        
        if (this.suggestionHistory.length > this.maxHistorySize) {
            this.suggestionHistory.shift();
        }
    }

    /**
     * Get suggestion history
     */
    getHistory() {
        return [...this.suggestionHistory];
    }

    /**
     * Clear history
     */
    clearHistory() {
        this.suggestionHistory = [];
    }

    /**
     * Export suggestion as sequence data for DAW
     */
    toSequenceData(suggestion) {
        if (suggestion.type === 'melody') {
            return {
                data: suggestion.melody.map(n => ({
                    note: n.note,
                    midiNote: n.midiNote,
                    duration: n.duration,
                    velocity: n.velocity,
                    time: n.position
                })),
                type: 'melody'
            };
        } else if (suggestion.type === 'chords') {
            return {
                data: suggestion.chords.map(c => ({
                    notes: c.midiNotes,
                    duration: c.duration,
                    time: c.position
                })),
                type: 'chords'
            };
        } else if (suggestion.type === 'bass') {
            return {
                data: suggestion.bassNotes.map(n => ({
                    note: n.note,
                    midiNote: n.midiNote,
                    duration: n.duration,
                    velocity: n.velocity,
                    time: n.position
                })),
                type: 'bass'
            };
        } else if (suggestion.type === 'section') {
            return {
                melody: suggestion.section.melody ? 
                    suggestion.section.melody.map(n => ({
                        note: n.note, midiNote: n.midiNote, duration: n.duration, velocity: n.velocity, time: n.position
                    })) : null,
                chords: suggestion.section.chords ? {
                    name: suggestion.section.chords.name,
                    chords: suggestion.section.chords.chords.map(c => ({
                        notes: c.midiNotes, duration: c.duration, time: c.position
                    }))
                } : null,
                bass: suggestion.section.bass ? 
                    suggestion.section.bass.map(n => ({
                        note: n.note, midiNote: n.midiNote, duration: n.duration, velocity: n.velocity, time: n.position
                    })) : null,
                type: 'section',
                tempo: suggestion.section.tempo,
                key: suggestion.section.key,
                scale: suggestion.section.scale
            };
        }
        return null;
    }
}

// UI Panel for AI Composition Assistant
function openAICompositionPanel() {
    const existingPanel = document.getElementById('ai-composition-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'ai-composition-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 700px;
        max-height: 80vh;
        background: #1a1a2e;
        border: 1px solid #3b82f6;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;

    panel.innerHTML = `
        <div style="background: #0f0f23; padding: 15px 20px; border-bottom: 1px solid #3b82f6; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #3b82f6;">AI Composition Assistant</h3>
            <button id="close-ai-panel" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="padding: 20px; overflow-y: auto; max-height: calc(80vh - 60px);">
            <!-- Context Settings -->
            <div style="margin-bottom: 20px; padding: 15px; background: #252542; border-radius: 6px;">
                <h4 style="margin: 0 0 15px 0; color: #60a5fa;">Musical Context</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <div>
                        <label style="display: block; color: #888; font-size: 12px; margin-bottom: 5px;">Key</label>
                        <select id="ai-key" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                            ${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => 
                                `<option value="${k}">${k}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; color: #888; font-size: 12px; margin-bottom: 5px;">Scale</label>
                        <select id="ai-scale" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                            ${Object.keys(SCALES).map(s => 
                                `<option value="${s}" ${s === 'major' ? 'selected' : ''}>${s}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="display: block; color: #888; font-size: 12px; margin-bottom: 5px;">Style</label>
                        <select id="ai-style" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                            ${Object.keys(CHORD_PROGRESSIONS).map(s => 
                                `<option value="${s}">${s}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <!-- Generation Buttons -->
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #60a5fa;">Generate</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <button id="gen-melody" style="padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        🎵 Generate Melody
                    </button>
                    <button id="gen-chords" style="padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        🎹 Generate Chords
                    </button>
                    <button id="gen-bass" style="padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        🎸 Generate Bass Line
                    </button>
                    <button id="gen-rhythm" style="padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        🥁 Generate Rhythm
                    </button>
                    <button id="gen-section" style="padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 14px; grid-column: span 2;">
                        ✨ Generate Complete Section
                    </button>
                </div>
            </div>

            <!-- Options -->
            <div style="margin-bottom: 20px; padding: 15px; background: #252542; border-radius: 6px;">
                <h4 style="margin: 0 0 15px 0; color: #60a5fa;">Options</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                    <div>
                        <label style="display: block; color: #888; font-size: 12px; margin-bottom: 5px;">Melody Contour</label>
                        <select id="ai-contour" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                            <option value="balanced">Balanced</option>
                            <option value="ascending">Ascending</option>
                            <option value="descending">Descending</option>
                            <option value="arch">Arch</option>
                            <option value="valley">Valley</option>
                            <option value="random">Random</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; color: #888; font-size: 12px; margin-bottom: 5px;">Section Length (bars)</label>
                        <input id="ai-length" type="number" value="4" min="1" max="16" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                    </div>
                </div>
            </div>

            <!-- Results -->
            <div id="ai-results" style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 15px 0; color: #60a5fa;">Results</h4>
                <div id="ai-results-content" style="padding: 15px; background: #252542; border-radius: 6px; min-height: 100px; color: #888;">
                    Click a generate button to create musical content...
                </div>
            </div>

            <!-- Actions -->
            <div style="display: flex; gap: 10px;">
                <button id="ai-apply" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;" disabled>
                    Apply to Track
                </button>
                <button id="ai-copy" style="flex: 1; padding: 12px; background: #6366f1; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 14px;" disabled>
                    Copy to Clipboard
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Initialize assistant
    const assistant = new AICompositionAssistant();
    let lastResult = null;

    // Close button
    document.getElementById('close-ai-panel').onclick = () => panel.remove();

    // Generate melody
    document.getElementById('gen-melody').onclick = () => {
        const key = document.getElementById('ai-key').value;
        const scale = document.getElementById('ai-scale').value;
        const contour = document.getElementById('ai-contour').value;
        const length = parseInt(document.getElementById('ai-length').value) * 4;
        
        assistant.setContext(key, scale, 120);
        lastResult = assistant.generateMelody({ length, contour });
        displayResult('melody', lastResult);
    };

    // Generate chords
    document.getElementById('gen-chords').onclick = () => {
        const key = document.getElementById('ai-key').value;
        const scale = document.getElementById('ai-scale').value;
        const style = document.getElementById('ai-style').value;
        const length = parseInt(document.getElementById('ai-length').value);
        
        assistant.setContext(key, scale, 120, style);
        lastResult = assistant.generateChordProgression({ length, style });
        displayResult('chords', lastResult);
    };

    // Generate bass
    document.getElementById('gen-bass').onclick = () => {
        const key = document.getElementById('ai-key').value;
        const scale = document.getElementById('ai-scale').value;
        const style = document.getElementById('ai-style').value;
        const length = parseInt(document.getElementById('ai-length').value) * 4;
        
        assistant.setContext(key, scale, 120, style);
        lastResult = assistant.generateBassLine({ 
            style: style === 'jazz' ? 'walking' : 'basic',
            length 
        });
        displayResult('bass', lastResult);
    };

    // Generate rhythm
    document.getElementById('gen-rhythm').onclick = () => {
        const style = document.getElementById('ai-style').value;
        lastResult = assistant.generateRhythmPattern({ 
            style: style === 'blues' ? 'syncopated' : 'basic' 
        });
        displayResult('rhythm', lastResult);
    };

    // Generate section
    document.getElementById('gen-section').onclick = () => {
        const key = document.getElementById('ai-key').value;
        const scale = document.getElementById('ai-scale').value;
        const style = document.getElementById('ai-style').value;
        const bars = parseInt(document.getElementById('ai-length').value);
        
        assistant.setContext(key, scale, 120, style);
        lastResult = assistant.generateSection({ bars, style });
        displayResult('section', lastResult);
    };

    function displayResult(type, data) {
        const content = document.getElementById('ai-results-content');
        document.getElementById('ai-apply').disabled = false;
        document.getElementById('ai-copy').disabled = false;

        let html = '';
        if (type === 'melody') {
            html = `<div style="color: #3b82f6; margin-bottom: 10px;">🎵 Melody (${data.length} notes)</div>`;
            html += `<div style="display: flex; flex-wrap: wrap; gap: 5px;">`;
            data.forEach(n => {
                html += `<span style="background: #3b82f6; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${n.note}</span>`;
            });
            html += `</div>`;
        } else if (type === 'chords') {
            html = `<div style="color: #3b82f6; margin-bottom: 10px;">🎹 Chords: ${data.name}</div>`;
            html += `<div style="display: flex; flex-wrap: wrap; gap: 5px;">`;
            data.chords.forEach(c => {
                html += `<span style="background: #6366f1; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${c.name}</span>`;
            });
            html += `</div>`;
        } else if (type === 'bass') {
            html = `<div style="color: #3b82f6; margin-bottom: 10px;">🎸 Bass Line (${data.length} notes)</div>`;
            html += `<div style="display: flex; flex-wrap: wrap; gap: 5px;">`;
            data.slice(0, 16).forEach(n => {
                html += `<span style="background: #10b981; padding: 4px 8px; border-radius: 3px; font-size: 12px;">${n.note}</span>`;
            });
            html += `</div>`;
        } else if (type === 'rhythm') {
            html = `<div style="color: #3b82f6; margin-bottom: 10px;">🥁 Rhythm Pattern (${data.length} steps)</div>`;
            html += `<div style="display: grid; grid-template-columns: repeat(16, 1fr); gap: 2px;">`;
            data.forEach(v => {
                const color = v ? '#f59e0b' : '#333';
                html += `<div style="background: ${color}; height: 20px; border-radius: 2px;"></div>`;
            });
            html += `</div>`;
        } else if (type === 'section') {
            html = `<div style="color: #10b981; margin-bottom: 10px;">✨ Complete Section (${data.bars} bars)</div>`;
            html += `<div style="font-size: 12px; color: #888;">Key: ${data.key} | Scale: ${data.scale} | Tempo: ${data.tempo} BPM</div>`;
            if (data.melody) {
                html += `<div style="margin-top: 10px;"><strong style="color: #3b82f6;">Melody:</strong> ${data.melody.length} notes</div>`;
            }
            if (data.chords) {
                html += `<div style="margin-top: 5px;"><strong style="color: #6366f1;">Chords:</strong> ${data.chords.name}</div>`;
            }
            if (data.bass) {
                html += `<div style="margin-top: 5px;"><strong style="color: #10b981;">Bass:</strong> ${data.bass.length} notes</div>`;
            }
        }
        
        content.innerHTML = html;
    }

    // Apply to track
    document.getElementById('ai-apply').onclick = () => {
        if (!lastResult) return;
        
        // Get current track
        const currentTrackId = window.currentTrackId;
        if (!currentTrackId) {
            alert('Please select a track first');
            return;
        }

        // Convert to sequence data and add to track
        const sequenceData = assistant.toSequenceData(
            lastResult.type ? lastResult : { type: 'melody', melody: lastResult }
        );
        
        if (sequenceData && window.addSequenceToTrack) {
            window.addSequenceToTrack(currentTrackId, sequenceData);
            panel.remove();
        }
    };

    // Copy to clipboard
    document.getElementById('ai-copy').onclick = () => {
        if (!lastResult) return;
        
        const text = JSON.stringify(lastResult, null, 2);
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('ai-copy');
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy to Clipboard', 2000);
        });
    };

    return assistant;
}

// ES Module exports
export { AICompositionAssistant, openAICompositionPanel };

// Also assign to window for global access
if (typeof window !== 'undefined') {
    window.AICompositionAssistant = AICompositionAssistant;
    window.openAICompositionPanel = openAICompositionPanel;
}