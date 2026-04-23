// js/AIComposition.js - AI-Assisted Composition Engine
// Provides AI-powered melody and chord suggestions

/**
 * AIComposition - AI-assisted composition engine
 * Provides melody generation, chord progressions, and harmonic suggestions
 */
class AICompositionEngine {
    constructor() {
        // Scale definitions (intervals from root)
        this.SCALES = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
            melodicMinor: [0, 2, 3, 5, 7, 9, 11],
            dorian: [0, 2, 3, 5, 7, 9, 10],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            lydian: [0, 2, 4, 6, 7, 9, 11],
            mixolydian: [0, 2, 4, 5, 7, 9, 10],
            locrian: [0, 1, 3, 5, 6, 8, 10],
            pentatonicMajor: [0, 2, 4, 7, 9],
            pentatonicMinor: [0, 3, 5, 7, 10],
            blues: [0, 3, 5, 6, 7, 10],
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        };

        // Note names
        this.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Chord types (intervals from root)
        this.CHORD_TYPES = {
            major: [0, 4, 7],
            minor: [0, 3, 7],
            dim: [0, 3, 6],
            aug: [0, 4, 8],
            maj7: [0, 4, 7, 11],
            min7: [0, 3, 7, 10],
            dom7: [0, 4, 7, 10],
            dim7: [0, 3, 6, 9],
            sus2: [0, 2, 7],
            sus4: [0, 5, 7],
            add9: [0, 4, 7, 14],
            min9: [0, 3, 7, 10, 14],
            maj9: [0, 4, 7, 11, 14]
        };

        // Common chord progressions by style
        this.PROGRESSIONS = {
            pop: [
                { name: 'I-V-vi-IV', degrees: [1, 5, 6, 4] },
                { name: 'I-IV-V-I', degrees: [1, 4, 5, 1] },
                { name: 'I-V-IV-V', degrees: [1, 5, 4, 5] },
                { name: 'vi-IV-I-V', degrees: [6, 4, 1, 5] }
            ],
            jazz: [
                { name: 'ii-V-I', degrees: [2, 5, 1] },
                { name: 'I-vi-ii-V', degrees: [1, 6, 2, 5] },
                { name: 'iii-vi-ii-V', degrees: [3, 6, 2, 5] },
                { name: 'I-IV-vii-iii-vi-ii-V-I', degrees: [1, 4, 7, 3, 6, 2, 5, 1] }
            ],
            blues: [
                { name: '12-bar blues', degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5] },
                { name: '8-bar blues', degrees: [1, 1, 4, 4, 1, 1, 5, 4] }
            ],
            classical: [
                { name: 'I-IV-V-I', degrees: [1, 4, 5, 1] },
                { name: 'I-vi-IV-V', degrees: [1, 6, 4, 5] },
                { name: 'I-ii-V-I', degrees: [1, 2, 5, 1] }
            ]
        };

        // Melody generation settings
        this.settings = {
            rootNote: 60, // Middle C (MIDI)
            scale: 'major',
            octaveRange: 2,
            rhythmDensity: 0.5, // 0-1, higher = more notes
            melodicContour: 'balanced', // 'ascending', 'descending', 'balanced', 'random'
            useApproachNotes: true,
            usePassingTones: true,
            maxIntervalJump: 7 // semitones
        };

        // Current chord progression
        this.currentProgression = [];
        this.currentChordIndex = 0;

        // Generation history for continuity
        this.lastGeneratedNotes = [];
        this.generationContext = {
            previousMelodyDirection: 0, // -1 down, 0 neutral, 1 up
            phrasePosition: 0,
            barPosition: 0
        };
    }

    /**
     * Get all available scales
     */
    getAvailableScales() {
        return Object.keys(this.SCALES);
    }

    /**
     * Get all available chord types
     */
    getAvailableChordTypes() {
        return Object.keys(this.CHORD_TYPES);
    }

    /**
     * Get all progression styles
     */
    getProgressionStyles() {
        return Object.keys(this.PROGRESSIONS);
    }

    /**
     * Get scale notes for a given root and scale type
     */
    getScaleNotes(rootNote, scaleType) {
        const scale = this.SCALES[scaleType] || this.SCALES.major;
        const root = rootNote % 12;
        return scale.map(interval => (root + interval) % 12);
    }

    /**
     * Check if a note is in the current scale
     */
    isInScale(note, rootNote, scaleType) {
        const scaleNotes = this.getScaleNotes(rootNote, scaleType);
        const notePitch = note % 12;
        return scaleNotes.includes(notePitch);
    }

    /**
     * Get chord notes for a given root and chord type
     */
    getChordNotes(rootNote, chordType) {
        const chord = this.CHORD_TYPES[chordType] || this.CHORD_TYPES.major;
        return chord.map(interval => rootNote + interval);
    }

    /**
     * Get scale degree for a chord (1-7)
     */
    getChordForDegree(rootNote, scaleType, degree) {
        const scale = this.SCALES[scaleType] || this.SCALES.major;
        const scaleIndex = (degree - 1) % 7;
        const chordRoot = rootNote + scale[scaleIndex];
        
        // Determine chord quality based on scale degree
        const isMajor = [1, 4, 5].includes(degree);
        const isMinor = [2, 3, 6].includes(degree);
        const isDim = degree === 7;
        
        let chordType = 'major';
        if (isMinor) chordType = 'minor';
        if (isDim) chordType = 'dim';
        
        return {
            root: chordRoot,
            type: chordType,
            degree: degree,
            notes: this.getChordNotes(chordRoot, chordType)
        };
    }

    /**
     * Generate a chord progression
     */
    generateChordProgression(rootNote, scaleType, style, length = 4) {
        const progressions = this.PROGRESSIONS[style] || this.PROGRESSIONS.pop;
        const selectedProg = progressions[Math.floor(Math.random() * progressions.length)];
        
        // Build the progression
        const progression = [];
        const degrees = [...selectedProg.degrees];
        
        // Extend or shorten to desired length
        while (degrees.length < length) {
            degrees.push(...selectedProg.degrees);
        }
        
        for (let i = 0; i < length; i++) {
            const degree = degrees[i % degrees.length];
            progression.push(this.getChordForDegree(rootNote, scaleType, degree));
        }
        
        this.currentProgression = progression;
        this.currentChordIndex = 0;
        
        return progression;
    }

    /**
     * Get next chord in progression
     */
    getNextChord() {
        if (this.currentProgression.length === 0) return null;
        
        const chord = this.currentProgression[this.currentChordIndex];
        this.currentChordIndex = (this.currentChordIndex + 1) % this.currentProgression.length;
        return chord;
    }

    /**
     * Generate a melody sequence
     */
    generateMelody(options = {}) {
        const {
            rootNote = this.settings.rootNote,
            scaleType = this.settings.scale,
            length = 16, // number of notes
            octaveRange = this.settings.octaveRange,
            rhythmDensity = this.settings.rhythmDensity,
            contour = this.settings.melodicContour,
            chordProgression = this.currentProgression,
            startFromLast = true
        } = options;

        const scale = this.SCALES[scaleType] || this.SCALES.major;
        const melody = [];
        
        // Starting note
        let currentNote = startFromLast && this.lastGeneratedNotes.length > 0
            ? this.lastGeneratedNotes[this.lastGeneratedNotes.length - 1]
            : rootNote;
        
        // Contour direction tracking
        let direction = 0;
        
        for (let i = 0; i < length; i++) {
            // Determine if this beat should have a note (rhythm density)
            const hasNote = Math.random() < rhythmDensity || i === 0;
            
            if (!hasNote) {
                melody.push({ note: null, duration: 1, velocity: 0 });
                continue;
            }
            
            // Get current chord context
            const chordIndex = Math.floor(i / 4) % (chordProgression.length || 1);
            const currentChord = chordProgression[chordIndex] || null;
            
            // Calculate next note
            currentNote = this._generateNextNote(
                currentNote,
                scale,
                rootNote,
                octaveRange,
                contour,
                direction,
                currentChord
            );
            
            // Update direction
            const lastNote = melody.length > 0 ? melody[melody.length - 1].note : currentNote;
            if (lastNote !== null) {
                direction = currentNote > lastNote ? 1 : (currentNote < lastNote ? -1 : 0);
            }
            
            // Velocity based on position and accent
            const velocity = this._calculateVelocity(i, length);
            
            // Duration (simplified - could be enhanced with rhythmic patterns)
            const duration = this._calculateDuration(i, length, rhythmDensity);
            
            melody.push({
                note: currentNote,
                duration: duration,
                velocity: velocity,
                scaleDegree: this._getScaleDegree(currentNote, rootNote, scale)
            });
        }
        
        // Store for continuity
        this.lastGeneratedNotes = melody.filter(n => n.note !== null).map(n => n.note);
        this.generationContext.previousMelodyDirection = direction;
        
        return melody;
    }

    /**
     * Generate the next note in sequence
     */
    _generateNextNote(currentNote, scale, rootNote, octaveRange, contour, direction, currentChord) {
        const minNote = rootNote - (octaveRange * 12);
        const maxNote = rootNote + (octaveRange * 12);
        
        // Prefer chord tones if chord is available
        let targetNotes = [];
        if (currentChord && currentChord.notes) {
            // 60% chance to target chord tone
            if (Math.random() < 0.6) {
                targetNotes = currentChord.notes.filter(n => n >= minNote && n <= maxNote);
            }
        }
        
        // Otherwise use scale tones
        if (targetNotes.length === 0) {
            for (let octave = -octaveRange; octave <= octaveRange; octave++) {
                scale.forEach(interval => {
                    const note = rootNote + (octave * 12) + interval;
                    if (note >= minNote && note <= maxNote) {
                        targetNotes.push(note);
                    }
                });
            }
        }
        
        // Apply contour bias
        let filteredNotes = targetNotes;
        if (contour === 'ascending') {
            filteredNotes = targetNotes.filter(n => n >= currentNote);
        } else if (contour === 'descending') {
            filteredNotes = targetNotes.filter(n => n <= currentNote);
        }
        
        if (filteredNotes.length === 0) filteredNotes = targetNotes;
        
        // Prefer stepwise motion (1-2 semitone intervals)
        const stepwiseNotes = filteredNotes.filter(n => 
            Math.abs(n - currentNote) <= 3
        );
        
        // Prefer motion in current direction
        const directionalNotes = stepwiseNotes.filter(n => {
            if (direction > 0) return n > currentNote;
            if (direction < 0) return n < currentNote;
            return true;
        });
        
        // Final selection with weighted random
        const candidates = directionalNotes.length > 0 ? directionalNotes :
                          (stepwiseNotes.length > 0 ? stepwiseNotes : filteredNotes);
        
        // Weight by proximity
        const weights = candidates.map(n => 1 / (Math.abs(n - currentNote) + 1));
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < candidates.length; i++) {
            random -= weights[i];
            if (random <= 0) return candidates[i];
        }
        
        return candidates[0];
    }

    /**
     * Calculate velocity for a note position
     */
    _calculateVelocity(position, length) {
        // Accent first beat
        const beatPosition = position % 4;
        let velocity = 0.7;
        
        if (beatPosition === 0) velocity = 0.9;
        else if (beatPosition === 2) velocity = 0.75;
        else velocity = 0.6 + Math.random() * 0.2;
        
        // Slight accent at phrase start/end
        if (position === 0 || position === length - 1) {
            velocity = Math.min(1, velocity + 0.1);
        }
        
        return velocity;
    }

    /**
     * Calculate note duration
     */
    _calculateDuration(position, length, density) {
        // Simple duration calculation - could be enhanced
        const beatPosition = position % 4;
        
        // Longer notes on strong beats
        if (beatPosition === 0 && Math.random() > 0.3) return 2;
        if (beatPosition === 2 && Math.random() > 0.5) return 2;
        
        // Occasional longer notes
        if (Math.random() < 0.2) return 2;
        if (Math.random() < 0.1) return 3;
        
        return 1;
    }

    /**
     * Get scale degree (1-7) for a note
     */
    _getScaleDegree(note, rootNote, scale) {
        const interval = (note - rootNote) % 12;
        const degree = scale.indexOf(interval);
        return degree >= 0 ? degree + 1 : null;
    }

    /**
     * Generate a bass line for a chord progression
     */
    generateBassLine(progression, options = {}) {
        const {
            style = 'root', // 'root', 'walking', 'pattern'
            length = progression.length * 4
        } = options;

        const bassLine = [];
        
        for (let i = 0; i < length; i++) {
            const chordIndex = Math.floor(i / 4) % progression.length;
            const chord = progression[chordIndex];
            
            if (!chord) continue;
            
            const beatInChord = i % 4;
            let note;
            let velocity = beatInChord === 0 ? 0.9 : 0.7;
            
            switch (style) {
                case 'root':
                    // Just root notes
                    note = chord.root - 12; // Octave down
                    break;
                    
                case 'walking':
                    // Walking bass pattern
                    if (beatInChord === 0) {
                        note = chord.root - 12;
                    } else if (beatInChord === 1) {
                        note = chord.notes[1] - 12 || chord.root - 12;
                    } else if (beatInChord === 2) {
                        // Approach note
                        const nextChord = progression[(chordIndex + 1) % progression.length];
                        note = nextChord ? nextChord.root - 13 : chord.root - 12;
                    } else {
                        // Fifth or approach
                        note = (chord.root + 7) - 12;
                    }
                    break;
                    
                case 'pattern':
                    // Common bass pattern
                    if (beatInChord === 0) note = chord.root - 12;
                    else if (beatInChord === 1) note = (chord.root + 7) - 12;
                    else if (beatInChord === 2) note = chord.root - 12;
                    else note = (chord.root + 5) - 12;
                    break;
            }
            
            bassLine.push({
                note: note,
                duration: 1,
                velocity: velocity
            });
        }
        
        return bassLine;
    }

    /**
     * Generate a counter-melody (arpeggio pattern)
     */
    generateCounterMelody(progression, options = {}) {
        const {
            pattern = 'ascending', // 'ascending', 'descending', 'random', 'broken'
            noteLength = 1
        } = options;

        const counterMelody = [];
        
        progression.forEach(chord => {
            const notes = [...chord.notes];
            
            // Sort based on pattern
            if (pattern === 'ascending') {
                notes.sort((a, b) => a - b);
            } else if (pattern === 'descending') {
                notes.sort((a, b) => b - a);
            } else if (pattern === 'random') {
                notes.sort(() => Math.random() - 0.5);
            }
            
            // Broken chord pattern
            if (pattern === 'broken') {
                notes.sort((a, b) => a - b);
                notes.push(notes[1], notes[0], notes[2]);
            }
            
            notes.forEach(note => {
                counterMelody.push({
                    note: note,
                    duration: noteLength,
                    velocity: 0.6 + Math.random() * 0.2,
                    chordTone: true
                });
            });
        });
        
        return counterMelody;
    }

    /**
     * Suggest next note based on context
     */
    suggestNextNote(currentNote, options = {}) {
        const {
            rootNote = this.settings.rootNote,
            scaleType = this.settings.scale,
            chord = null,
            direction = null
        } = options;

        const scale = this.SCALES[scaleType];
        const scaleNotes = this.getScaleNotes(rootNote, scaleType);
        const currentPitch = currentNote % 12;
        
        // Find position in scale
        const scalePosition = scale.indexOf(scaleNotes.indexOf(currentPitch) >= 0 ? 
            scaleNotes.indexOf(currentPitch) : -1);
        
        // Generate suggestions
        const suggestions = [];
        
        // Stepwise motion (up and down)
        const stepUp = currentNote + (scale[(scalePosition + 1) % scale.length] - scale[scalePosition]);
        const stepDown = currentNote - (scale[scalePosition] - scale[(scalePosition - 1 + scale.length) % scale.length]);
        
        suggestions.push({
            note: stepUp,
            reason: 'Step up',
            priority: 1
        });
        suggestions.push({
            note: stepDown,
            reason: 'Step down',
            priority: 1
        });
        
        // Chord tones if chord available
        if (chord && chord.notes) {
            chord.notes.forEach(n => {
                if (n !== currentNote) {
                    suggestions.push({
                        note: n,
                        reason: 'Chord tone',
                        priority: 2
                    });
                }
            });
        }
        
        // Leap to strong beats (root, third, fifth)
        const strongDegrees = [1, 3, 5];
        strongDegrees.forEach(degree => {
            const targetNote = rootNote + scale[degree - 1];
            if (Math.abs(targetNote - currentNote) <= 7 && targetNote !== currentNote) {
                suggestions.push({
                    note: targetNote,
                    reason: `Scale degree ${degree}`,
                    priority: degree === 1 ? 3 : 2
                });
            }
        });
        
        // Sort by priority and remove duplicates
        const unique = new Map();
        suggestions.forEach(s => {
            const existing = unique.get(s.note);
            if (!existing || existing.priority > s.priority) {
                unique.set(s.note, s);
            }
        });
        
        return Array.from(unique.values()).sort((a, b) => a.priority - b.priority);
    }

    /**
     * Analyze a sequence of notes for harmonic content
     */
    analyzeHarmony(notes, rootNote, scaleType) {
        const scale = this.SCALES[scaleType];
        const analysis = {
            key: this.NOTE_NAMES[rootNote % 12],
            scale: scaleType,
            notesUsed: [],
            nonScaleNotes: [],
            impliedChords: [],
            contour: 'balanced'
        };
        
        // Find unique notes used
        const uniquePitches = [...new Set(notes.filter(n => n !== null).map(n => n % 12))];
        analysis.notesUsed = uniquePitches.map(p => ({
            pitch: p,
            name: this.NOTE_NAMES[p],
            isScaleTone: this.isInScale(p, rootNote, scaleType)
        }));
        
        // Find non-scale notes
        analysis.nonScaleNotes = analysis.notesUsed.filter(n => !n.isScaleTone);
        
        // Detect implied chords from consecutive notes
        for (let i = 0; i < notes.length - 2; i++) {
            const triplet = [notes[i], notes[i + 1], notes[i + 2]].filter(n => n !== null);
            if (triplet.length >= 3) {
                const chordType = this._detectChordType(triplet);
                if (chordType) {
                    analysis.impliedChords.push({
                        position: i,
                        root: triplet[0],
                        type: chordType
                    });
                }
            }
        }
        
        // Calculate contour
        let up = 0, down = 0;
        for (let i = 1; i < notes.length; i++) {
            if (notes[i] !== null && notes[i - 1] !== null) {
                if (notes[i] > notes[i - 1]) up++;
                else if (notes[i] < notes[i - 1]) down++;
            }
        }
        
        if (up > down * 1.5) analysis.contour = 'ascending';
        else if (down > up * 1.5) analysis.contour = 'descending';
        else analysis.contour = 'balanced';
        
        return analysis;
    }

    /**
     * Detect chord type from notes
     */
    _detectChordType(notes) {
        if (notes.length < 3) return null;
        
        const root = notes[0];
        const intervals = notes.map(n => n - root).sort((a, b) => a - b);
        
        // Match against known chord types
        for (const [type, chordIntervals] of Object.entries(this.CHORD_TYPES)) {
            if (intervals.length === chordIntervals.length &&
                intervals.every((v, i) => v === chordIntervals[i])) {
                return type;
            }
        }
        
        return null;
    }

    /**
     * Apply variations to a melody
     */
    applyVariations(melody, options = {}) {
        const {
            transpose = 0,
            invert = false,
            retrograde = false,
            augment = false,
            diminute = false,
            addOrnaments = false
        } = options;

        let varied = JSON.parse(JSON.stringify(melody));
        
        // Transpose
        if (transpose !== 0) {
            varied.forEach(n => {
                if (n.note !== null) n.note += transpose;
            });
        }
        
        // Inversion (flip intervals)
        if (invert) {
            const center = varied[0]?.note || 60;
            varied.forEach(n => {
                if (n.note !== null) {
                    n.note = center + (center - n.note);
                }
            });
        }
        
        // Retrograde (reverse order)
        if (retrograde) {
            varied = varied.reverse();
        }
        
        // Augmentation (double durations)
        if (augment) {
            varied.forEach(n => n.duration *= 2);
        }
        
        // Diminution (halve durations)
        if (diminute) {
            varied.forEach(n => n.duration = Math.max(0.5, n.duration / 2));
        }
        
        // Add ornaments (grace notes, trills, mordents)
        if (addOrnaments) {
            const ornamented = [];
            varied.forEach(n => {
                if (n.note !== null && Math.random() < 0.3) {
                    // Add grace note
                    ornamented.push({
                        note: n.note + (Math.random() < 0.5 ? 1 : -1),
                        duration: 0.25,
                        velocity: n.velocity * 0.8,
                        ornament: 'grace'
                    });
                }
                ornamented.push(n);
            });
            varied = ornamented;
        }
        
        return varied;
    }

    /**
     * Get settings panel HTML
     */
    getSettingsPanelHTML() {
        return `
            <div class="ai-composition-settings">
                <h3>AI Composition Engine</h3>
                
                <div class="setting-group">
                    <label>Root Note</label>
                    <select id="aiRootNote">
                        ${this.NOTE_NAMES.map((name, i) => 
                            `<option value="${i}" ${i === 0 ? 'selected' : ''}>${name}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="setting-group">
                    <label>Scale</label>
                    <select id="aiScale">
                        ${this.getAvailableScales().map(scale => 
                            `<option value="${scale}" ${scale === 'major' ? 'selected' : ''}>${scale}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="setting-group">
                    <label>Progression Style</label>
                    <select id="aiProgressionStyle">
                        ${this.getProgressionStyles().map(style => 
                            `<option value="${style}">${style}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="setting-group">
                    <label>Octave Range</label>
                    <input type="range" id="aiOctaveRange" min="1" max="4" value="2">
                </div>
                
                <div class="setting-group">
                    <label>Rhythm Density</label>
                    <input type="range" id="aiRhythmDensity" min="0" max="100" value="50">
                </div>
                
                <div class="setting-group">
                    <label>Melodic Contour</label>
                    <select id="aiContour">
                        <option value="balanced">Balanced</option>
                        <option value="ascending">Ascending</option>
                        <option value="descending">Descending</option>
                        <option value="random">Random</option>
                    </select>
                </div>
                
                <div class="button-group">
                    <button id="generateMelody">Generate Melody</button>
                    <button id="generateBass">Generate Bass Line</button>
                    <button id="generateChords">Generate Chords</button>
                </div>
                
                <div class="button-group">
                    <button id="generateVariation">Create Variation</button>
                    <button id="analyzeHarmony">Analyze Harmony</button>
                </div>
            </div>
        `;
    }
}

// Export singleton instance
export const aiComposition = new AICompositionEngine();
export default AICompositionEngine;