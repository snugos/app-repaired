/**
 * DrumPatternGenerator.js
 * AI-powered drum pattern generation with style-based variations
 */

// Drum pattern styles
export const DRUM_STYLES = {
    ROCK: 'rock',
    HIP_HOP: 'hip_hop',
    HOUSE: 'house',
    DNB: 'dnb',
    JAZZ: 'jazz',
    LATIN: 'latin',
    FUNK: 'funk',
    METAL: 'metal',
    TRAP: 'trap',
    LO_FI: 'lo_fi',
    BREAKBEAT: 'breakbeat',
    AFROBEAT: 'afrobeat'
};

// Pattern complexity levels
export const COMPLEXITY_LEVELS = {
    SIMPLE: 'simple',
    MODERATE: 'moderate',
    COMPLEX: 'complex',
    VIRTUOSO: 'virtuoso'
};

// Default settings
let settings = {
    style: DRUM_STYLES.ROCK,
    complexity: COMPLEXITY_LEVELS.MODERATE,
    tempo: 120,
    timeSignature: [4, 4],
    bars: 2,
    swing: 0,
    humanization: 0.1,
    density: 0.6,
    variation: 0.3,
    ghostNotes: true,
    fills: true,
    syncopation: 0.3,
    accentPattern: 'standard',
    kickPattern: 'standard',
    snarePattern: 'standard',
    hihatPattern: 'standard',
    useToms: false,
    useCymbals: true,
    usePercussion: false
};

// Style-specific pattern templates
const STYLE_TEMPLATES = {
    [DRUM_STYLES.ROCK]: {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        swing: 0,
        ghostNotes: false
    },
    [DRUM_STYLES.HIP_HOP]: {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        swing: 15,
        ghostNotes: true
    },
    [DRUM_STYLES.HOUSE]: {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        swing: 0,
        ghostNotes: false
    },
    [DRUM_STYLES.DNB]: {
        kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        swing: 5,
        ghostNotes: true
    },
    [DRUM_STYLES.JAZZ]: {
        kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        swing: 30,
        ghostNotes: true
    },
    [DRUM_STYLES.LATIN]: {
        kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
        hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        swing: 0,
        ghostNotes: true
    },
    [DRUM_STYLES.FUNK]: {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        swing: 10,
        ghostNotes: true
    },
    [DRUM_STYLES.METAL]: {
        kick: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        swing: 0,
        ghostNotes: false
    },
    [DRUM_STYLES.TRAP]: {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        swing: 0,
        ghostNotes: true
    },
    [DRUM_STYLES.LO_FI]: {
        kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        swing: 10,
        ghostNotes: true
    },
    [DRUM_STYLES.BREAKBEAT]: {
        kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        swing: 5,
        ghostNotes: true
    },
    [DRUM_STYLES.AFROBEAT]: {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        swing: 0,
        ghostNotes: true
    }
};

// Ghost note patterns per style
const GHOST_NOTE_PATTERNS = {
    [DRUM_STYLES.HIP_HOP]: [0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0, 0],
    [DRUM_STYLES.FUNK]: [0, 0.2, 0, 0.2, 0, 0.2, 0, 0.2, 0, 0.2, 0, 0.2, 0, 0.2, 0, 0.2],
    [DRUM_STYLES.JAZZ]: [0.2, 0, 0.3, 0, 0.2, 0, 0.3, 0, 0.2, 0, 0.3, 0, 0.2, 0, 0.3, 0]
};

// Fill patterns
const FILL_PATTERNS = {
    simple: [
        { position: 15, pattern: [1, 0, 1, 0] },
        { position: 14, pattern: [1, 1, 1, 1] }
    ],
    moderate: [
        { position: 12, pattern: [1, 0, 1, 0, 1, 0, 1, 0] },
        { position: 14, pattern: [1, 1, 1, 1] }
    ],
    complex: [
        { position: 12, pattern: [1, 0, 1, 1, 0, 1, 1, 0] },
        { position: 13, pattern: [0, 1, 1, 0, 1, 1, 0, 1] },
        { position: 15, pattern: [1, 1, 1, 1, 1, 1, 1, 1] }
    ]
};

/**
 * DrumPatternGenerator class
 * Generates AI-powered drum patterns with variations
 */
export class DrumPatternGenerator {
    constructor(options = {}) {
        this.settings = { ...settings, ...options };
        this.patterns = [];
        this.variations = [];
        this.generationHistory = [];
        this.aiWeights = this.initializeAIWeights();
    }

    /**
     * Initialize AI weights for pattern generation
     */
    initializeAIWeights() {
        return {
            kickWeight: 0.3,
            snareWeight: 0.25,
            hihatWeight: 0.2,
            syncopationWeight: 0.15,
            densityWeight: 0.1
        };
    }

    /**
     * Generate a drum pattern based on style and settings
     */
    generatePattern(customSettings = {}) {
        const s = { ...this.settings, ...customSettings };
        const template = STYLE_TEMPLATES[s.style] || STYLE_TEMPLATES[DRUM_STYLES.ROCK];
        
        // Create base pattern from template
        const pattern = {
            id: `drum_${Date.now()}`,
            style: s.style,
            tempo: s.tempo,
            bars: s.bars,
            steps: s.bars * 16,
            swing: s.swing || template.swing,
            notes: {
                kick: [],
                snare: [],
                hihat: [],
                toms: [],
                cymbals: [],
                percussion: []
            },
            velocities: {
                kick: [],
                snare: [],
                hihat: []
            },
            generated: Date.now()
        };

        // Generate pattern for each bar
        for (let bar = 0; bar < s.bars; bar++) {
            const barOffset = bar * 16;
            
            // Apply template with variation
            pattern.notes.kick = pattern.notes.kick.concat(
                this.applyVariation(template.kick, s.variation, s.density)
            );
            pattern.notes.snare = pattern.notes.snare.concat(
                this.applyVariation(template.snare, s.variation, s.density)
            );
            pattern.notes.hihat = pattern.notes.hihat.concat(
                this.applyVariation(template.hihat, s.variation, s.density)
            );

            // Generate velocities
            pattern.velocities.kick = pattern.velocities.kick.concat(
                this.generateVelocities(pattern.notes.kick.slice(barOffset, barOffset + 16), 'kick', s.humanization)
            );
            pattern.velocities.snare = pattern.velocities.snare.concat(
                this.generateVelocities(pattern.notes.snare.slice(barOffset, barOffset + 16), 'snare', s.humanization)
            );
            pattern.velocities.hihat = pattern.velocities.hihat.concat(
                this.generateVelocities(pattern.notes.hihat.slice(barOffset, barOffset + 16), 'hihat', s.humanization)
            );
        }

        // Add ghost notes if enabled
        if (s.ghostNotes && GHOST_NOTE_PATTERNS[s.style]) {
            pattern.ghostNotes = this.generateGhostNotes(s.style, s.bars, s.humanization);
        }

        // Add fills if enabled
        if (s.fills) {
            this.addFills(pattern, s.complexity);
        }

        // Apply swing
        if (pattern.swing > 0) {
            this.applySwing(pattern, pattern.swing);
        }

        // Add syncopation based on complexity
        this.addSyncopation(pattern, s.syncopation, s.complexity);

        // Store in history
        this.generationHistory.push({
            settings: { ...s },
            pattern: { ...pattern },
            timestamp: Date.now()
        });

        return pattern;
    }

    /**
     * Apply variation to a base pattern
     */
    applyVariation(basePattern, variation, density) {
        const result = [...basePattern];
        
        for (let i = 0; i < result.length; i++) {
            // Random variation based on settings
            if (Math.random() < variation) {
                if (result[i] === 1 && Math.random() > density) {
                    result[i] = 0; // Remove hit
                } else if (result[i] === 0 && Math.random() < density * 0.3) {
                    result[i] = 1; // Add hit
                }
            }
        }
        
        return result;
    }

    /**
     * Generate velocities with humanization
     */
    generateVelocities(notes, drumType, humanization) {
        const velocities = [];
        const baseVelocity = {
            kick: 100,
            snare: 90,
            hihat: 70
        };
        
        for (let i = 0; i < notes.length; i++) {
            if (notes[i] === 1) {
                let vel = baseVelocity[drumType] || 80;
                
                // Apply humanization
                if (humanization > 0) {
                    vel += (Math.random() - 0.5) * humanization * 30;
                    vel = Math.max(20, Math.min(127, vel));
                }
                
                // Apply accent pattern
                if (i % 4 === 0) {
                    vel *= 1.1; // Downbeat accent
                } else if (i % 4 === 2) {
                    vel *= 0.95; // Backbeat slightly softer
                }
                
                velocities.push(Math.round(vel));
            } else {
                velocities.push(0);
            }
        }
        
        return velocities;
    }

    /**
     * Generate ghost notes
     */
    generateGhostNotes(style, bars, humanization) {
        const ghostPattern = GHOST_NOTE_PATTERNS[style];
        if (!ghostPattern) return [];
        
        const ghosts = [];
        
        for (let bar = 0; bar < bars; bar++) {
            for (let i = 0; i < 16; i++) {
                if (ghostPattern[i] > 0 && Math.random() < ghostPattern[i]) {
                    let vel = Math.round(ghostPattern[i] * 127);
                    if (humanization > 0) {
                        vel += (Math.random() - 0.5) * humanization * 20;
                        vel = Math.max(15, Math.min(60, vel));
                    }
                    ghosts.push({
                        step: bar * 16 + i,
                        velocity: vel,
                        type: 'snare'
                    });
                }
            }
        }
        
        return ghosts;
    }

    /**
     * Add fills to the pattern
     */
    addFills(pattern, complexity) {
        const fills = FILL_PATTERNS[complexity] || FILL_PATTERNS.simple;
        
        for (const fill of fills) {
            const fillStart = fill.position;
            
            for (let i = 0; i < fill.pattern.length; i++) {
                if (fill.pattern[i] === 1) {
                    // Add tom hits for fill
                    const tomStep = fillStart + i;
                    if (tomStep < pattern.steps) {
                        pattern.notes.toms.push({
                            step: tomStep,
                            tom: ['low', 'mid', 'high'][Math.floor(Math.random() * 3)],
                            velocity: 80 + Math.floor(Math.random() * 30)
                        });
                    }
                }
            }
        }
    }

    /**
     * Apply swing to the pattern
     */
    applySwing(pattern, swingAmount) {
        const swingOffset = swingAmount / 100;
        
        // Swing affects every other 16th note
        for (let i = 0; i < pattern.steps; i++) {
            if (i % 2 === 1) {
                // Apply timing offset (would be used during playback)
                pattern.swingOffset = pattern.swingOffset || [];
                pattern.swingOffset[i] = swingOffset;
            }
        }
    }

    /**
     * Add syncopation based on complexity
     */
    addSyncopation(pattern, syncopationAmount, complexity) {
        const syncopationSteps = {
            simple: [],
            moderate: [3, 11],
            complex: [1, 3, 7, 9, 11, 13],
            virtuoso: [1, 3, 5, 7, 9, 11, 13, 15]
        };
        
        const steps = syncopationSteps[complexity] || [];
        
        for (const step of steps) {
            if (Math.random() < syncopationAmount) {
                // Add kick or snare on syncopated beat
                if (pattern.notes.kick[step] === 0 && Math.random() < 0.3) {
                    pattern.notes.kick[step] = 1;
                    pattern.velocities.kick[step] = 70 + Math.floor(Math.random() * 20);
                }
            }
        }
    }

    /**
     * Generate variations of a pattern
     */
    generateVariations(basePattern, count = 4, variationAmount = 0.3) {
        const variations = [{ ...basePattern, variationNumber: 0 }];
        
        for (let v = 1; v <= count; v++) {
            const variation = JSON.parse(JSON.stringify(basePattern));
            variation.id = `${basePattern.id}_var${v}`;
            variation.variationNumber = v;
            variation.isVariation = true;
            variation.basePatternId = basePattern.id;
            
            // Apply variation
            variation.notes.kick = this.applyVariation(variation.notes.kick, variationAmount, this.settings.density);
            variation.notes.snare = this.applyVariation(variation.notes.snare, variationAmount, this.settings.density);
            variation.notes.hihat = this.applyVariation(variation.notes.hihat, variationAmount, this.settings.density);
            
            // Regenerate velocities
            variation.velocities.kick = this.generateVelocities(variation.notes.kick, 'kick', this.settings.humanization);
            variation.velocities.snare = this.generateVelocities(variation.notes.snare, 'snare', this.settings.humanization);
            variation.velocities.hihat = this.generateVelocities(variation.notes.hihat, 'hihat', this.settings.humanization);
            
            variations.push(variation);
        }
        
        this.variations = variations;
        return variations;
    }

    /**
     * Generate AI-powered pattern (simulated AI with heuristics)
     */
    generateAIPattern(inputPattern = null, evolutionSteps = 3) {
        let pattern = inputPattern || this.generatePattern();
        
        // Evolution steps - progressively mutate and improve
        for (let step = 0; step < evolutionSteps; step++) {
            pattern = this.evolvePattern(pattern, step);
        }
        
        pattern.aiGenerated = true;
        pattern.evolutionSteps = evolutionSteps;
        
        return pattern;
    }

    /**
     * Evolve a pattern using AI heuristics
     */
    evolvePattern(pattern, step) {
        const evolved = JSON.parse(JSON.stringify(pattern));
        
        // Evolution rules based on music theory heuristics
        const rules = [
            // Rule 1: Strengthen downbeats
            (p) => {
                for (let i = 0; i < p.steps; i += 4) {
                    if (p.notes.kick[i] === 1) {
                        p.velocities.kick[i] = Math.min(127, p.velocities.kick[i] + 10);
                    }
                }
            },
            // Rule 2: Add syncopation on weak beats
            (p) => {
                if (this.settings.syncopation > 0.3) {
                    for (let i = 1; i < p.steps; i += 4) {
                        if (Math.random() < 0.3 && p.notes.kick[i] === 0) {
                            p.notes.kick[i] = 1;
                            p.velocities.kick[i] = 60;
                        }
                    }
                }
            },
            // Rule 3: Create dynamic contrast
            (p) => {
                const avgKickVel = p.velocities.kick.filter(v => v > 0).reduce((a, b) => a + b, 0) / 
                                   p.velocities.kick.filter(v => v > 0).length;
                for (let i = 0; i < p.velocities.kick.length; i++) {
                    if (p.velocities.kick[i] > 0) {
                        if (p.velocities.kick[i] > avgKickVel) {
                            p.velocities.kick[i] = Math.min(127, p.velocities.kick[i] + 5);
                        } else {
                            p.velocities.kick[i] = Math.max(40, p.velocities.kick[i] - 5);
                        }
                    }
                }
            },
            // Rule 4: Balance pattern density
            (p) => {
                const kickDensity = p.notes.kick.filter(n => n === 1).length / p.steps;
                if (kickDensity > 0.4) {
                    // Too dense, remove some hits
                    for (let i = 0; i < p.steps; i++) {
                        if (p.notes.kick[i] === 1 && Math.random() < 0.2) {
                            p.notes.kick[i] = 0;
                            p.velocities.kick[i] = 0;
                        }
                    }
                } else if (kickDensity < 0.2) {
                    // Too sparse, add some hits
                    for (let i = 0; i < p.steps; i++) {
                        if (p.notes.kick[i] === 0 && Math.random() < 0.1) {
                            p.notes.kick[i] = 1;
                            p.velocities.kick[i] = 70;
                        }
                    }
                }
            }
        ];
        
        // Apply rule based on step
        rules[step % rules.length](evolved);
        
        return evolved;
    }

    /**
     * Export pattern to various formats
     */
    exportPattern(pattern, format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(pattern, null, 2);
            case 'midi':
                return this.exportToMIDI(pattern);
            case 'csv':
                return this.exportToCSV(pattern);
            default:
                return JSON.stringify(pattern);
        }
    }

    /**
     * Export to MIDI format (simplified)
     */
    exportToMIDI(pattern) {
        // Simplified MIDI export - would need full MIDI library in production
        const midiData = {
            format: 0,
            ticksPerBeat: 480,
            tempo: pattern.tempo,
            tracks: [
                {
                    name: 'Drums',
                    events: []
                }
            ]
        };
        
        // Add note events
        const addNote = (step, pitch, velocity, duration = 60) => {
            midiData.tracks[0].events.push({
                delta: step * 30,
                type: 'noteOn',
                pitch: pitch,
                velocity: velocity
            });
            midiData.tracks[0].events.push({
                delta: duration,
                type: 'noteOff',
                pitch: pitch,
                velocity: 0
            });
        };
        
        // Map drums to MIDI pitches
        const drumMap = {
            kick: 36,
            snare: 38,
            hihat: 42
        };
        
        for (let i = 0; i < pattern.steps; i++) {
            if (pattern.notes.kick[i] === 1) {
                addNote(i, drumMap.kick, pattern.velocities.kick[i]);
            }
            if (pattern.notes.snare[i] === 1) {
                addNote(i, drumMap.snare, pattern.velocities.snare[i]);
            }
            if (pattern.notes.hihat[i] === 1) {
                addNote(i, drumMap.hihat, pattern.velocities.hihat[i]);
            }
        }
        
        return midiData;
    }

    /**
     * Export to CSV format
     */
    exportToCSV(pattern) {
        const rows = ['Step,Kick,KickVel,Snare,SnareVel,Hihat,HihatVel'];
        
        for (let i = 0; i < pattern.steps; i++) {
            rows.push([
                i,
                pattern.notes.kick[i],
                pattern.velocities.kick[i],
                pattern.notes.snare[i],
                pattern.velocities.snare[i],
                pattern.notes.hihat[i],
                pattern.velocities.hihat[i]
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
        return Object.entries(DRUM_STYLES).map(([key, value]) => ({
            id: value,
            name: value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            hasGhostNotes: !!GHOST_NOTE_PATTERNS[value]
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
    }
}

// Singleton instance
let drumGeneratorInstance = null;

/**
 * Initialize drum pattern generator
 */
export function initDrumPatternGenerator(options = {}) {
    if (!drumGeneratorInstance) {
        drumGeneratorInstance = new DrumPatternGenerator(options);
    }
    return drumGeneratorInstance;
}

/**
 * Get drum generator instance
 */
export function getDrumGenerator() {
    return drumGeneratorInstance;
}

/**
 * Generate a quick pattern
 */
export function generateDrumPattern(style = DRUM_STYLES.ROCK, bars = 2) {
    const generator = initDrumPatternGenerator();
    return generator.generatePattern({ style, bars });
}

export default {
    DrumPatternGenerator,
    initDrumPatternGenerator,
    getDrumGenerator,
    generateDrumPattern,
    DRUM_STYLES,
    COMPLEXITY_LEVELS
};