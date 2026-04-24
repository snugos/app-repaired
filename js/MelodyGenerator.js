/**
 * MelodyGenerator.js
 * AI-powered melody generation with style-based composition
 */

// Melody styles
export const MELODY_STYLES = {
    CLASSICAL: 'classical',
    JAZZ: 'jazz',
    POP: 'pop',
    ROCK: 'rock',
    ELECTRONIC: 'electronic',
    FOLK: 'folk',
    BLUES: 'blues',
    RNB: 'rnb',
    HIP_HOP: 'hip_hop',
    AMBIENT: 'ambient',
    FILM_SCORE: 'film_score',
    VIDEO_GAME: 'video_game'
};

// Melody moods
export const MELODY_MOODS = {
    HAPPY: 'happy',
    SAD: 'sad',
    MYSTERIOUS: 'mysterious',
    ENERGETIC: 'energetic',
    PEACEFUL: 'peaceful',
    DRAMATIC: 'dramatic',
    ROMANTIC: 'romantic',
    MELANCHOLIC: 'melancholic'
};

// Complexity levels
export const COMPLEXITY = {
    SIMPLE: 'simple',
    MODERATE: 'moderate',
    COMPLEX: 'complex',
    VIRTUOSO: 'virtuoso'
};

// Default settings
let settings = {
    style: MELODY_STYLES.POP,
    mood: MELODY_MOODS.HAPPY,
    complexity: COMPLEXITY.MODERATE,
    key: 'C',
    scale: 'major',
    tempo: 120,
    timeSignature: [4, 4],
    bars: 4,
    octaveRange: [3, 5],
    noteLengths: ['4n', '8n', '16n'],
    density: 0.5,
    syncopation: 0.3,
    repetition: 0.4,
    leaps: 0.2,
    contour: 'arch',
    phrasing: 4,
    rests: 0.15,
    articulation: 'legato',
    dynamics: 'medium',
    motifDevelopment: true,
    callAndResponse: false,
    variation: 0.3
};

// Scale definitions
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

// Style-specific patterns
const STYLE_PATTERNS = {
    [MELODY_STYLES.CLASSICAL]: {
        contours: ['arch', 'wave', 'ascending'],
        leaps: 0.15,
        syncopation: 0.1,
        repetition: 0.5,
        noteLengths: ['2n', '4n', '8n'],
        articulation: 'legato'
    },
    [MELODY_STYLES.JAZZ]: {
        contours: ['wave', 'irregular', 'descending'],
        leaps: 0.35,
        syncopation: 0.5,
        repetition: 0.3,
        noteLengths: ['8n', '16n', '8n.'],
        articulation: 'swing'
    },
    [MELODY_STYLES.POP]: {
        contours: ['arch', 'wave', 'repetitive'],
        leaps: 0.2,
        syncopation: 0.2,
        repetition: 0.6,
        noteLengths: ['4n', '8n', '2n'],
        articulation: 'legato'
    },
    [MELODY_STYLES.ROCK]: {
        contours: ['ascending', 'wave', 'static'],
        leaps: 0.25,
        syncopation: 0.3,
        repetition: 0.5,
        noteLengths: ['4n', '8n', '8n.'],
        articulation: 'staccato'
    },
    [MELODY_STYLES.ELECTRONIC]: {
        contours: ['static', 'ascending', 'repetitive'],
        leaps: 0.1,
        syncopation: 0.4,
        repetition: 0.7,
        noteLengths: ['8n', '16n', '16n.'],
        articulation: 'staccato'
    },
    [MELODY_STYLES.FOLK]: {
        contours: ['wave', 'arch', 'descending'],
        leaps: 0.2,
        syncopation: 0.15,
        repetition: 0.4,
        noteLengths: ['2n', '4n', '8n'],
        articulation: 'legato'
    },
    [MELODY_STYLES.BLUES]: {
        contours: ['descending', 'wave', 'call_response'],
        leaps: 0.3,
        syncopation: 0.35,
        repetition: 0.5,
        noteLengths: ['4n', '8n', '8n.'],
        articulation: 'swing'
    },
    [MELODY_STYLES.RNB]: {
        contours: ['wave', 'arch', 'melismatic'],
        leaps: 0.2,
        syncopation: 0.4,
        repetition: 0.3,
        noteLengths: ['4n', '8n', '16n'],
        articulation: 'legato'
    },
    [MELODY_STYLES.HIP_HOP]: {
        contours: ['repetitive', 'static', 'descending'],
        leaps: 0.15,
        syncopation: 0.5,
        repetition: 0.7,
        noteLengths: ['8n', '16n', '16n.'],
        articulation: 'staccato'
    },
    [MELODY_STYLES.AMBIENT]: {
        contours: ['static', 'ascending', 'wave'],
        leaps: 0.05,
        syncopation: 0.05,
        repetition: 0.6,
        noteLengths: ['1n', '2n', '4n'],
        articulation: 'legato'
    },
    [MELODY_STYLES.FILM_SCORE]: {
        contours: ['ascending', 'arch', 'wave'],
        leaps: 0.25,
        syncopation: 0.2,
        repetition: 0.4,
        noteLengths: ['2n', '4n', '8n'],
        articulation: 'legato'
    },
    [MELODY_STYLES.VIDEO_GAME]: {
        contours: ['arch', 'ascending', 'repetitive'],
        leaps: 0.2,
        syncopation: 0.25,
        repetition: 0.5,
        noteLengths: ['4n', '8n', '16n'],
        articulation: 'staccato'
    }
};

// Mood-specific adjustments
const MOOD_ADJUSTMENTS = {
    [MELODY_MOODS.HAPPY]: {
        preferredScales: ['major', 'pentatonic'],
        preferredIntervals: [2, 3, 4, 5],
        velocityRange: [70, 110],
        tempoRange: [100, 140]
    },
    [MELODY_MOODS.SAD]: {
        preferredScales: ['minor', 'harmonicMinor'],
        preferredIntervals: [2, 3, 6],
        velocityRange: [40, 80],
        tempoRange: [60, 90]
    },
    [MELODY_MOODS.MYSTERIOUS]: {
        preferredScales: ['dorian', 'phrygian', 'locrian'],
        preferredIntervals: [1, 2, 6, 7],
        velocityRange: [50, 90],
        tempoRange: [70, 110]
    },
    [MELODY_MOODS.ENERGETIC]: {
        preferredScales: ['major', 'mixolydian'],
        preferredIntervals: [2, 4, 5, 7],
        velocityRange: [80, 127],
        tempoRange: [120, 160]
    },
    [MELODY_MOODS.PEACEFUL]: {
        preferredScales: ['major', 'lydian', 'pentatonic'],
        preferredIntervals: [2, 3, 4, 5],
        velocityRange: [50, 80],
        tempoRange: [60, 90]
    },
    [MELODY_MOODS.DRAMATIC]: {
        preferredScales: ['harmonicMinor', 'minor'],
        preferredIntervals: [1, 3, 6, 7],
        velocityRange: [60, 110],
        tempoRange: [80, 120]
    },
    [MELODY_MOODS.ROMANTIC]: {
        preferredScales: ['major', 'harmonicMinor'],
        preferredIntervals: [3, 4, 5, 6],
        velocityRange: [60, 100],
        tempoRange: [70, 100]
    },
    [MELODY_MOODS.MELANCHOLIC]: {
        preferredScales: ['minor', 'dorian'],
        preferredIntervals: [2, 3, 6],
        velocityRange: [40, 70],
        tempoRange: [60, 80]
    }
};

/**
 * MelodyGenerator class
 * Generates AI-powered melodies with style variations
 */
export class MelodyGenerator {
    constructor(options = {}) {
        this.settings = { ...settings, ...options };
        this.melodies = [];
        this.motifs = [];
        this.generationHistory = [];
        this.aiModel = this.initializeAIModel();
    }

    /**
     * Initialize AI model (heuristic-based for now)
     */
    initializeAIModel() {
        return {
            weights: {
                consonance: 0.7,
                stepwiseMotion: 0.6,
                leapResolution: 0.8,
                phraseShape: 0.5,
                repetitionWeight: 0.4
            },
            learnedPatterns: [],
            contextMemory: []
        };
    }

    /**
     * Generate a melody based on style and settings
     */
    generateMelody(customSettings = {}) {
        const s = { ...this.settings, ...customSettings };
        const stylePattern = STYLE_PATTERNS[s.style] || STYLE_PATTERNS[MELODY_STYLES.POP];
        const moodAdjust = MOOD_ADJUSTMENTS[s.mood] || MOOD_ADJUSTMENTS[MELODY_MOODS.HAPPY];
        
        // Create melody structure
        const melody = {
            id: `melody_${Date.now()}`,
            style: s.style,
            mood: s.mood,
            key: s.key,
            scale: s.scale,
            tempo: s.tempo,
            bars: s.bars,
            notes: [],
            velocities: [],
            durations: [],
            rests: [],
            articulation: stylePattern.articulation,
            generated: Date.now()
        };

        // Get scale notes
        const scaleNotes = this.getScaleNotes(s.key, s.scale, s.octaveRange);
        
        // Generate motifs for development
        if (s.motifDevelopment) {
            this.motifs = this.generateMotifs(scaleNotes, stylePattern, s);
        }

        // Generate melody by bar
        for (let bar = 0; bar < s.bars; bar++) {
            const barNotes = this.generateBar(
                scaleNotes,
                stylePattern,
                moodAdjust,
                s,
                bar,
                melody.notes.length
            );
            
            melody.notes = melody.notes.concat(barNotes.notes);
            melody.velocities = melody.velocities.concat(barNotes.velocities);
            melody.durations = melody.durations.concat(barNotes.durations);
            melody.rests = melody.rests.concat(barNotes.rests);
        }

        // Apply contour shaping
        this.applyContour(melody, stylePattern.contour);

        // Apply articulation
        this.applyArticulation(melody, s.articulation);

        // Store in history
        this.generationHistory.push({
            settings: { ...s },
            melody: { ...melody },
            timestamp: Date.now()
        });

        return melody;
    }

    /**
     * Get scale notes across octave range
     */
    getScaleNotes(key, scaleName, octaveRange) {
        const scalePattern = SCALES[scaleName] || SCALES.major;
        const rootNote = this.noteToMidi(key);
        const notes = [];

        for (let octave = octaveRange[0]; octave <= octaveRange[1]; octave++) {
            for (const interval of scalePattern) {
                notes.push(rootNote + interval + (octave * 12));
            }
        }

        // Sort and dedupe
        return [...new Set(notes)].sort((a, b) => a - b);
    }

    /**
     * Convert note name to MIDI number
     */
    noteToMidi(noteName) {
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };
        return noteMap[noteName] || 0;
    }

    /**
     * Generate motifs for development
     */
    generateMotifs(scaleNotes, stylePattern, s) {
        const motifs = [];
        const motifLength = 4 + Math.floor(Math.random() * 4);

        // Generate 2-4 motifs
        for (let m = 0; m < 2 + Math.floor(Math.random() * 2); m++) {
            const motif = {
                notes: [],
                intervals: [],
                rhythm: []
            };

            let lastNote = scaleNotes[Math.floor(scaleNotes.length / 2)];

            for (let i = 0; i < motifLength; i++) {
                const note = this.chooseNextNote(lastNote, scaleNotes, stylePattern);
                motif.notes.push(note);
                motif.intervals.push(note - lastNote);
                motif.rhythm.push(this.chooseNoteLength(stylePattern.noteLengths));
                lastNote = note;
            }

            motifs.push(motif);
        }

        return motifs;
    }

    /**
     * Generate a bar of melody
     */
    generateBar(scaleNotes, stylePattern, moodAdjust, s, barIndex, startIndex) {
        const barNotes = {
            notes: [],
            velocities: [],
            durations: [],
            rests: []
        };

        const ticksPerBar = 480 * s.timeSignature[0];
        let currentTick = 0;

        // Decide to use motif or generate new
        const useMotif = this.motifs.length > 0 && 
                        Math.random() < s.repetition && 
                        barIndex % s.phrasing === 0;

        if (useMotif && this.motifs.length > 0) {
            // Use a motif
            const motif = this.motifs[Math.floor(Math.random() * this.motifs.length)];
            
            for (let i = 0; i < motif.notes.length && currentTick < ticksPerBar; i++) {
                // Add variation to motif
                const note = this.applyMotifVariation(motif.notes[i], scaleNotes, s.variation);
                const duration = motif.rhythm[i];
                const velocity = this.chooseVelocity(moodAdjust.velocityRange, s.dynamics);

                barNotes.notes.push(note);
                barNotes.velocities.push(velocity);
                barNotes.durations.push(duration);
                barNotes.rests.push(false);

                currentTick += this.durationToTicks(duration);
            }
        } else {
            // Generate new material
            let lastNote = scaleNotes[Math.floor(scaleNotes.length / 2)];
            
            while (currentTick < ticksPerBar) {
                // Possibly rest
                if (Math.random() < s.rests && currentTick > 0) {
                    const restDuration = this.chooseNoteLength(stylePattern.noteLengths);
                    barNotes.notes.push(null);
                    barNotes.velocities.push(0);
                    barNotes.durations.push(restDuration);
                    barNotes.rests.push(true);
                    currentTick += this.durationToTicks(restDuration);
                } else {
                    const note = this.chooseNextNote(lastNote, scaleNotes, stylePattern);
                    const duration = this.chooseNoteLength(stylePattern.noteLengths);
                    const velocity = this.chooseVelocity(moodAdjust.velocityRange, s.dynamics);

                    barNotes.notes.push(note);
                    barNotes.velocities.push(velocity);
                    barNotes.durations.push(duration);
                    barNotes.rests.push(false);

                    lastNote = note;
                    currentTick += this.durationToTicks(duration);
                }
            }
        }

        return barNotes;
    }

    /**
     * Choose next note based on style and AI weights
     */
    chooseNextNote(currentNote, scaleNotes, stylePattern) {
        const intervals = this.calculatePossibleIntervals(currentNote, scaleNotes);
        
        // Weight intervals based on style
        const weightedIntervals = intervals.map(interval => {
            let weight = 1.0;
            
            // Prefer stepwise motion
            if (Math.abs(interval) <= 2) {
                weight *= this.aiModel.weights.stepwiseMotion;
            }
            
            // Leaps should resolve
            if (Math.abs(interval) >= 3) {
                weight *= stylePattern.leaps;
            }
            
            // Consonance preference
            const consonantIntervals = [2, 3, 4, 5, 7];
            if (consonantIntervals.includes(Math.abs(interval))) {
                weight *= this.aiModel.weights.consonance;
            }
            
            // Add randomness
            weight *= 0.5 + Math.random();
            
            return { interval, weight, note: currentNote + interval };
        });

        // Choose weighted random
        const totalWeight = weightedIntervals.reduce((sum, i) => sum + i.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const wi of weightedIntervals) {
            random -= wi.weight;
            if (random <= 0) {
                return wi.note;
            }
        }

        return scaleNotes[Math.floor(scaleNotes.length / 2)];
    }

    /**
     * Calculate possible intervals to scale notes
     */
    calculatePossibleIntervals(currentNote, scaleNotes) {
        const intervals = [];
        
        for (const note of scaleNotes) {
            intervals.push(note - currentNote);
        }
        
        // Limit to reasonable range
        return intervals.filter(i => Math.abs(i) <= 12);
    }

    /**
     * Choose note length
     */
    chooseNoteLength(availableLengths) {
        const weights = {
            '1n': 0.05,
            '2n': 0.15,
            '4n': 0.3,
            '8n': 0.3,
            '16n': 0.15,
            '8n.': 0.03,
            '16n.': 0.02
        };

        const weighted = availableLengths.map(l => ({
            length: l,
            weight: weights[l] || 0.1
        }));

        const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
        let random = Math.random() * totalWeight;

        for (const w of weighted) {
            random -= w.weight;
            if (random <= 0) {
                return w.length;
            }
        }

        return '4n';
    }

    /**
     * Convert duration to ticks
     */
    durationToTicks(duration) {
        const ticks = {
            '1n': 1920,
            '2n': 960,
            '4n': 480,
            '8n': 240,
            '16n': 120,
            '32n': 60,
            '8n.': 360,
            '16n.': 180
        };
        return ticks[duration] || 480;
    }

    /**
     * Choose velocity based on mood and dynamics
     */
    chooseVelocity(range, dynamics) {
        const baseVel = range[0] + Math.random() * (range[1] - range[0]);
        
        const dynamicModifiers = {
            'pp': -30,
            'p': -20,
            'mp': -10,
            'medium': 0,
            'mf': 10,
            'f': 20,
            'ff': 30
        };

        const vel = baseVel + (dynamicModifiers[dynamics] || 0);
        return Math.max(20, Math.min(127, Math.round(vel)));
    }

    /**
     * Apply motif variation
     */
    applyMotifVariation(note, scaleNotes, variation) {
        if (Math.random() > variation) {
            return note;
        }

        // Small interval change
        const change = (Math.random() - 0.5) * 4;
        const nearestScaleNote = this.findNearestScaleNote(note + change, scaleNotes);
        return nearestScaleNote;
    }

    /**
     * Find nearest scale note
     */
    findNearestScaleNote(targetNote, scaleNotes) {
        let nearest = scaleNotes[0];
        let minDistance = Infinity;

        for (const note of scaleNotes) {
            const distance = Math.abs(note - targetNote);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = note;
            }
        }

        return nearest;
    }

    /**
     * Apply contour shaping to melody
     */
    applyContour(melody, contours) {
        const contour = Array.isArray(contours) ? 
            contours[Math.floor(Math.random() * contours.length)] : 
            contours;

        const noteCount = melody.notes.filter(n => n !== null).length;
        
        switch (contour) {
            case 'arch':
                this.shapeArch(melody, noteCount);
                break;
            case 'ascending':
                this.shapeAscending(melody, noteCount);
                break;
            case 'descending':
                this.shapeDescending(melody, noteCount);
                break;
            case 'wave':
                this.shapeWave(melody, noteCount);
                break;
            default:
                // No shaping for static, repetitive, etc.
                break;
        }
    }

    /**
     * Shape melody as an arch (up then down)
     */
    shapeArch(melody, noteCount) {
        const notes = melody.notes.filter(n => n !== null);
        const midPoint = Math.floor(notes.length / 2);
        
        // Adjust velocities
        for (let i = 0; i < notes.length; i++) {
            const pos = i / notes.length;
            const shape = pos < 0.5 ? pos * 2 : 2 - pos * 2;
            const velIndex = melody.notes.indexOf(notes[i]);
            if (velIndex !== -1) {
                melody.velocities[velIndex] = Math.round(
                    melody.velocities[velIndex] * (0.7 + shape * 0.3)
                );
            }
        }
    }

    /**
     * Shape ascending melody
     */
    shapeAscending(melody, noteCount) {
        const notes = melody.notes.filter(n => n !== null);
        
        for (let i = 0; i < notes.length; i++) {
            const pos = i / notes.length;
            const velIndex = melody.notes.indexOf(notes[i]);
            if (velIndex !== -1) {
                melody.velocities[velIndex] = Math.round(
                    melody.velocities[velIndex] * (0.8 + pos * 0.2)
                );
            }
        }
    }

    /**
     * Shape descending melody
     */
    shapeDescending(melody, noteCount) {
        const notes = melody.notes.filter(n => n !== null);
        
        for (let i = 0; i < notes.length; i++) {
            const pos = i / notes.length;
            const velIndex = melody.notes.indexOf(notes[i]);
            if (velIndex !== -1) {
                melody.velocities[velIndex] = Math.round(
                    melody.velocities[velIndex] * (1 - pos * 0.2)
                );
            }
        }
    }

    /**
     * Shape wave melody (up down up down)
     */
    shapeWave(melody, noteCount) {
        const notes = melody.notes.filter(n => n !== null);
        const waveCount = 2;
        const waveLength = notes.length / waveCount;
        
        for (let i = 0; i < notes.length; i++) {
            const wavePos = (i % waveLength) / waveLength;
            const shape = wavePos < 0.5 ? wavePos * 2 : 2 - wavePos * 2;
            const velIndex = melody.notes.indexOf(notes[i]);
            if (velIndex !== -1) {
                melody.velocities[velIndex] = Math.round(
                    melody.velocities[velIndex] * (0.7 + shape * 0.3)
                );
            }
        }
    }

    /**
     * Apply articulation to melody
     */
    applyArticulation(melody, articulation) {
        // Articulation affects the effective duration of notes
        const articulationRatios = {
            'legato': 1.0,
            'staccato': 0.5,
            'portato': 0.75,
            'tenuto': 0.9,
            'accented': 0.85,
            'swing': 0.67 // Triplet feel
        };

        const ratio = articulationRatios[articulation] || 1.0;
        melody.articulationRatio = ratio;
    }

    /**
     * Generate variations of a melody
     */
    generateVariations(baseMelody, count = 4, variationAmount = 0.3) {
        const variations = [{ ...baseMelody, variationNumber: 0 }];
        
        for (let v = 1; v <= count; v++) {
            const variation = JSON.parse(JSON.stringify(baseMelody));
            variation.id = `${baseMelody.id}_var${v}`;
            variation.variationNumber = v;
            variation.isVariation = true;
            variation.baseMelodyId = baseMelody.id;
            
            // Apply rhythmic variation
            for (let i = 0; i < variation.durations.length; i++) {
                if (Math.random() < variationAmount) {
                    variation.durations[i] = this.varyDuration(variation.durations[i]);
                }
            }
            
            // Apply melodic variation
            const scaleNotes = this.getScaleNotes(
                variation.key,
                variation.scale,
                this.settings.octaveRange
            );
            
            for (let i = 0; i < variation.notes.length; i++) {
                if (variation.notes[i] !== null && Math.random() < variationAmount) {
                    variation.notes[i] = this.applyMotifVariation(
                        variation.notes[i],
                        scaleNotes,
                        0.5
                    );
                }
            }
            
            variations.push(variation);
        }
        
        return variations;
    }

    /**
     * Vary a duration
     */
    varyDuration(duration) {
        const variations = {
            '4n': ['8n', '8n.', '4n'],
            '8n': ['16n', '8n.', '4n'],
            '16n': ['8n', '16n.', '32n'],
            '2n': ['4n', '2n'],
            '1n': ['2n', '1n']
        };

        const options = variations[duration] || [duration];
        return options[Math.floor(Math.random() * options.length)];
    }

    /**
     * Generate AI melody using learned patterns
     */
    generateAIMelody(context = {}, evolutionSteps = 3) {
        // Start with basic melody
        let melody = this.generateMelody(context);
        
        // Apply evolution steps
        for (let step = 0; step < evolutionSteps; step++) {
            melody = this.evolveMelody(melody, step);
        }
        
        melody.aiGenerated = true;
        melody.evolutionSteps = evolutionSteps;
        
        return melody;
    }

    /**
     * Evolve melody using AI heuristics
     */
    evolveMelody(melody, step) {
        const evolved = JSON.parse(JSON.stringify(melody));
        
        // Evolution rules
        const rules = [
            // Rule 1: Balance stepwise motion and leaps
            (m) => {
                const intervals = [];
                for (let i = 1; i < m.notes.length; i++) {
                    if (m.notes[i] !== null && m.notes[i-1] !== null) {
                        intervals.push(Math.abs(m.notes[i] - m.notes[i-1]));
                    }
                }
                
                const leaps = intervals.filter(i => i > 2).length;
                const steps = intervals.filter(i => i <= 2).length;
                
                // If too many leaps, convert some to steps
                if (leaps > steps) {
                    for (let i = 1; i < m.notes.length; i++) {
                        if (m.notes[i] !== null && m.notes[i-1] !== null) {
                            const interval = Math.abs(m.notes[i] - m.notes[i-1]);
                            if (interval > 2 && Math.random() < 0.3) {
                                // Replace with stepwise note
                                const direction = m.notes[i] > m.notes[i-1] ? 1 : -1;
                                m.notes[i] = m.notes[i-1] + direction * 2;
                            }
                        }
                    }
                }
            },
            // Rule 2: Resolve large leaps
            (m) => {
                for (let i = 1; i < m.notes.length; i++) {
                    if (m.notes[i] !== null && m.notes[i-1] !== null) {
                        const interval = Math.abs(m.notes[i] - m.notes[i-1]);
                        if (interval > 7) {
                            // Add a passing note
                            const passingNote = (m.notes[i-1] + m.notes[i]) / 2;
                            m.notes.splice(i, 0, Math.round(passingNote));
                            m.velocities.splice(i, 0, 70);
                            m.durations.splice(i, 0, '16n');
                            m.rests.splice(i, 0, false);
                            break;
                        }
                    }
                }
            },
            // Rule 3: Improve phrase shape
            (m) => {
                // Add breath/rest at phrase end
                const phraseLength = Math.floor(m.notes.length / 4);
                const restIndex = phraseLength * 4 - 1;
                if (restIndex > 0 && restIndex < m.notes.length) {
                    if (m.notes[restIndex] !== null && Math.random() < 0.4) {
                        m.notes[restIndex] = null;
                        m.velocities[restIndex] = 0;
                        m.rests[restIndex] = true;
                    }
                }
            },
            // Rule 4: Enhance climax
            (m) => {
                // Find highest note and boost its velocity
                let maxNote = 0;
                let maxIndex = 0;
                
                for (let i = 0; i < m.notes.length; i++) {
                    if (m.notes[i] !== null && m.notes[i] > maxNote) {
                        maxNote = m.notes[i];
                        maxIndex = i;
                    }
                }
                
                if (maxIndex > 0) {
                    m.velocities[maxIndex] = Math.min(127, m.velocities[maxIndex] + 15);
                }
            }
        ];
        
        // Apply rule based on step
        rules[step % rules.length](evolved);
        
        return evolved;
    }

    /**
     * Export melody to various formats
     */
    exportMelody(melody, format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(melody, null, 2);
            case 'midi':
                return this.exportToMIDI(melody);
            case 'musicxml':
                return this.exportToMusicXML(melody);
            case 'csv':
                return this.exportToCSV(melody);
            default:
                return JSON.stringify(melody);
        }
    }

    /**
     * Export to MIDI format
     */
    exportToMIDI(melody) {
        const midiData = {
            format: 0,
            ticksPerBeat: 480,
            tempo: melody.tempo,
            tracks: [
                {
                    name: 'Melody',
                    events: []
                }
            ]
        };

        let absoluteTime = 0;

        for (let i = 0; i < melody.notes.length; i++) {
            if (melody.notes[i] !== null) {
                const duration = this.durationToTicks(melody.durations[i]);
                
                midiData.tracks[0].events.push({
                    absoluteTime: absoluteTime,
                    type: 'noteOn',
                    pitch: melody.notes[i],
                    velocity: melody.velocities[i]
                });
                
                midiData.tracks[0].events.push({
                    absoluteTime: absoluteTime + duration * (melody.articulationRatio || 1),
                    type: 'noteOff',
                    pitch: melody.notes[i],
                    velocity: 0
                });
            }
            
            absoluteTime += this.durationToTicks(melody.durations[i]);
        }

        return midiData;
    }

    /**
     * Export to MusicXML format (simplified)
     */
    exportToMusicXML(melody) {
        const pitchToName = (midi) => {
            const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const name = names[midi % 12];
            const octave = Math.floor(midi / 12) - 1;
            return { name, octave };
        };

        const durationToType = (dur) => {
            const types = {
                '1n': 'whole',
                '2n': 'half',
                '4n': 'quarter',
                '8n': 'eighth',
                '16n': '16th',
                '32n': '32nd'
            };
            return types[dur] || 'quarter';
        };

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">`;

        let measure = 1;
        let measureContent = '';

        for (let i = 0; i < melody.notes.length; i++) {
            if (melody.notes[i] !== null) {
                const pitch = pitchToName(melody.notes[i]);
                const type = durationToType(melody.durations[i]);

                measureContent += `
      <note>
        <pitch>
          <step>${pitch.name.replace('#', '')}</step>
          ${pitch.name.includes('#') ? '<alter>1</alter>' : ''}
          <octave>${pitch.octave}</octave>
        </pitch>
        <duration>${this.durationToTicks(melody.durations[i])}</duration>
        <type>${type}</type>
        <velocity>${melody.velocities[i]}</velocity>
      </note>`;
            } else {
                measureContent += `
      <note>
        <rest/>
        <duration>${this.durationToTicks(melody.durations[i])}</duration>
      </note>`;
            }

            // New measure every 4 beats
            if ((i + 1) % 16 === 0 && i < melody.notes.length - 1) {
                xml += `
    <measure number="${measure}">
      <attributes>
        <divisions>480</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>${measureContent}
    </measure>`;
                measure++;
                measureContent = '';
            }
        }

        if (measureContent) {
            xml += `
    <measure number="${measure}">
      <attributes>
        <divisions>480</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>${measureContent}
    </measure>`;
        }

        xml += `
  </part>
</score-partwise>`;

        return xml;
    }

    /**
     * Export to CSV format
     */
    exportToCSV(melody) {
        const rows = ['Index,Note,Velocity,Duration,IsRest'];
        
        for (let i = 0; i < melody.notes.length; i++) {
            rows.push([
                i,
                melody.notes[i] !== null ? melody.notes[i] : '',
                melody.velocities[i],
                melody.durations[i],
                melody.rests[i]
            ].join(','));
        }
        
        return rows.join('\n');
    }

    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        return this.settings;
    }

    /**
     * Get available styles
     */
    getStyles() {
        return Object.entries(MELODY_STYLES).map(([key, value]) => ({
            id: value,
            name: value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
        }));
    }

    /**
     * Get available moods
     */
    getMoods() {
        return Object.entries(MELODY_MOODS).map(([key, value]) => ({
            id: value,
            name: value.replace(/\b\w/g, l => l.toUpperCase())
        }));
    }

    /**
     * Get available scales
     */
    getScales() {
        return Object.entries(SCALES).map(([name, intervals]) => ({
            name,
            intervals
        }));
    }

    /**
     * Get generation history
     */
    getHistory() {
        return [...this.generationHistory];
    }

    /**
     * Clear history
     */
    clearHistory() {
        this.generationHistory = [];
        this.motifs = [];
    }
}

// Singleton instance
let melodyGeneratorInstance = null;

/**
 * Initialize melody generator
 */
export function initMelodyGenerator(options = {}) {
    if (!melodyGeneratorInstance) {
        melodyGeneratorInstance = new MelodyGenerator(options);
    }
    return melodyGeneratorInstance;
}

/**
 * Get melody generator instance
 */
export function getMelodyGenerator() {
    return melodyGeneratorInstance;
}

/**
 * Generate a quick melody
 */
export function generateMelodyQuick(style = MELODY_STYLES.POP, bars = 4) {
    const generator = initMelodyGenerator();
    return generator.generateMelody({ style, bars });
}

export default {
    MelodyGenerator,
    initMelodyGenerator,
    getMelodyGenerator,
    generateMelodyQuick,
    MELODY_STYLES,
    MELODY_MOODS,
    COMPLEXITY,
    SCALES
};