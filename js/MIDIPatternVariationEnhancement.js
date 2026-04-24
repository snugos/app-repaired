// MIDI Pattern Variation Enhancement - Advanced variation algorithms for MIDI patterns
// Provides intelligent pattern transformation with musical constraints

class MIDIPatternVariationEnhancement {
    constructor() {
        this.enabled = false;
        this.currentPattern = null;
        this.variations = [];
        this.maxVariations = 50;
        
        // Variation algorithms
        this.algorithms = {
            // Rhythmic variations
            rhythmicDisplacement: {
                name: 'Rhythmic Displacement',
                description: 'Shift notes forward or backward in time',
                params: { amount: 0.5, direction: 'forward' }
            },
            rhythmicAugmentation: {
                name: 'Rhythmic Augmentation',
                description: 'Stretch or compress note durations',
                params: { factor: 1.5 }
            },
            rhythmicDiminution: {
                name: 'Rhythmic Diminution',
                description: 'Halve note durations',
                params: {}
            },
            syncopation: {
                name: 'Syncopation',
                description: 'Add syncopation by displacing off-beat',
                params: { strength: 0.5 }
            },
            
            // Melodic variations
            inversion: {
                name: 'Inversion',
                description: 'Invert the melody around a pivot note',
                params: { pivotNote: 60, direction: 'up' }
            },
            retrograde: {
                name: 'Retrograde',
                description: 'Reverse the order of notes',
                params: {}
            },
            retrogradeInversion: {
                name: 'Retrograde Inversion',
                description: 'Reverse and invert the melody',
                params: { pivotNote: 60 }
            },
            transposition: {
                name: 'Transposition',
                description: 'Shift all notes by a constant interval',
                params: { semitones: 5 }
            },
            sequence: {
                name: 'Sequence',
                description: 'Repeat the pattern at a different pitch level',
                params: { semitones: 5, times: 2 }
            },
            
            // Ornamental variations
            graceNotes: {
                name: 'Grace Notes',
                description: 'Add grace notes before selected notes',
                params: { interval: -2, probability: 0.5 }
            },
            mordent: {
                name: 'Mordent',
                description: 'Add quick alternation above/below note',
                params: { type: 'upper', speed: 64 }
            },
            trill: {
                name: 'Trill',
                description: 'Rapid alternation between note and interval above',
                params: { interval: 2, speed: 32 }
            },
            turn: {
                name: 'Turn',
                description: 'Add ornamental turn around note',
                params: { speed: 64 }
            },
            
            // Density variations
            thinning: {
                name: 'Thinning',
                description: 'Remove random notes to reduce density',
                params: { probability: 0.3 }
            },
            doubling: {
                name: 'Doubling',
                description: 'Add octave doubles to notes',
                params: { interval: 12, probability: 0.5 }
            },
            harmonization: {
                name: 'Harmonization',
                description: 'Add harmony notes following a chord progression',
                params: { style: 'thirds', key: 'C', scale: 'major' }
            },
            
            // Expressive variations
            velocityRamp: {
                name: 'Velocity Ramp',
                description: 'Gradually change velocity across pattern',
                params: { start: 127, end: 64, curve: 'linear' }
            },
            velocityRandomization: {
                name: 'Velocity Randomization',
                description: 'Add random variation to velocities',
                params: { amount: 20, mode: 'gaussian' }
            },
            articulationVariation: {
                name: 'Articulation Variation',
                description: 'Vary note lengths for articulation',
                params: { style: 'staccato', probability: 0.3 }
            },
            
            // Advanced variations
            euclidean: {
                name: 'Euclidean Rhythm',
                description: 'Distribute notes using Euclidean algorithm',
                params: { pulses: 5, steps: 16, rotation: 0 }
            },
            markovChain: {
                name: 'Markov Chain',
                description: 'Generate variation using Markov transition probabilities',
                params: { order: 1, preserveRhythm: true }
            },
            cellular: {
                name: 'Cellular Automata',
                description: 'Generate pattern using 1D cellular automata',
                params: { rule: 90, steps: 16 }
            },
            fractal: {
                name: 'Fractal Pattern',
                description: 'Self-similar pattern generation',
                params: { depth: 2, scalingFactor: 0.5 }
            }
        };
        
        // Variation presets
        this.presets = {
            jazzVariation: {
                name: 'Jazz Variation',
                algorithms: ['inversion', 'syncopation', 'graceNotes'],
                weights: [0.3, 0.4, 0.3]
            },
            classicalVariation: {
                name: 'Classical Variation',
                algorithms: ['inversion', 'retrograde', 'sequence'],
                weights: [0.4, 0.3, 0.3]
            },
            minimalVariation: {
                name: 'Minimal Variation',
                algorithms: ['thinning', 'rhythmicAugmentation'],
                weights: [0.5, 0.5]
            },
            electronicVariation: {
                name: 'Electronic Variation',
                algorithms: ['euclidean', 'velocityRamp', 'transposition'],
                weights: [0.3, 0.4, 0.3]
            },
            ambientVariation: {
                name: 'Ambient Variation',
                algorithms: ['rhythmicAugmentation', 'harmonization', 'velocityRandomization'],
                weights: [0.3, 0.4, 0.3]
            }
        };
        
        // Musical constraints
        this.constraints = {
            scale: null,           // Lock to scale
            key: null,             // Key signature
            noteRange: [21, 108],  // MIDI note range (A0 to C8)
            velocityRange: [20, 127],
            durationRange: [0.1, 4], // In beats
            preserveRhythm: false,
            preserveMelody: false,
            preserveHarmony: false
        };
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        
        console.log('[MIDIPatternVariationEnhancement] Initialized with', Object.keys(this.algorithms).length, 'algorithms');
    }
    
    setPattern(notes, bpm = 120) {
        this.currentPattern = {
            notes: JSON.parse(JSON.stringify(notes)),
            bpm: bpm,
            created: Date.now()
        };
        this.variations = [];
        return this;
    }
    
    applyAlgorithm(algorithmName, params = {}) {
        const algorithm = this.algorithms[algorithmName];
        if (!algorithm) {
            console.error('[MIDIPatternVariationEnhancement] Unknown algorithm:', algorithmName);
            return null;
        }
        
        if (!this.currentPattern) {
            console.error('[MIDIPatternVariationEnhancement] No pattern set');
            return null;
        }
        
        // Merge default params with provided params
        const mergedParams = { ...algorithm.params, ...params };
        
        // Apply the algorithm
        let result = null;
        switch (algorithmName) {
            case 'rhythmicDisplacement':
                result = this.applyRhythmicDisplacement(mergedParams);
                break;
            case 'rhythmicAugmentation':
                result = this.applyRhythmicAugmentation(mergedParams);
                break;
            case 'rhythmicDiminution':
                result = this.applyRhythmicDiminution(mergedParams);
                break;
            case 'syncopation':
                result = this.applySyncopation(mergedParams);
                break;
            case 'inversion':
                result = this.applyInversion(mergedParams);
                break;
            case 'retrograde':
                result = this.applyRetrograde(mergedParams);
                break;
            case 'retrogradeInversion':
                result = this.applyRetrogradeInversion(mergedParams);
                break;
            case 'transposition':
                result = this.applyTransposition(mergedParams);
                break;
            case 'sequence':
                result = this.applySequence(mergedParams);
                break;
            case 'graceNotes':
                result = this.applyGraceNotes(mergedParams);
                break;
            case 'mordent':
                result = this.applyMordent(mergedParams);
                break;
            case 'trill':
                result = this.applyTrill(mergedParams);
                break;
            case 'turn':
                result = this.applyTurn(mergedParams);
                break;
            case 'thinning':
                result = this.applyThinning(mergedParams);
                break;
            case 'doubling':
                result = this.applyDoubling(mergedParams);
                break;
            case 'harmonization':
                result = this.applyHarmonization(mergedParams);
                break;
            case 'velocityRamp':
                result = this.applyVelocityRamp(mergedParams);
                break;
            case 'velocityRandomization':
                result = this.applyVelocityRandomization(mergedParams);
                break;
            case 'articulationVariation':
                result = this.applyArticulationVariation(mergedParams);
                break;
            case 'euclidean':
                result = this.applyEuclidean(mergedParams);
                break;
            case 'markovChain':
                result = this.applyMarkovChain(mergedParams);
                break;
            case 'cellular':
                result = this.applyCellular(mergedParams);
                break;
            case 'fractal':
                result = this.applyFractal(mergedParams);
                break;
            default:
                console.warn('[MIDIPatternVariationEnhancement] Algorithm not implemented:', algorithmName);
                return null;
        }
        
        // Apply constraints
        if (result) {
            result = this.applyConstraints(result);
        }
        
        return result;
    }
    
    // Rhythmic Displacement
    applyRhythmicDisplacement(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const beatDuration = 60 / this.currentPattern.bpm;
        const displacement = params.amount * beatDuration * (params.direction === 'forward' ? 1 : -1);
        
        notes.forEach(note => {
            note.time = Math.max(0, note.time + displacement);
        });
        
        return this.sortNotes(notes);
    }
    
    // Rhythmic Augmentation
    applyRhythmicAugmentation(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const factor = params.factor;
        
        notes.forEach(note => {
            note.duration = note.duration * factor;
        });
        
        return notes;
    }
    
    // Rhythmic Diminution
    applyRhythmicDiminution(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        
        notes.forEach(note => {
            note.duration = note.duration / 2;
        });
        
        return notes;
    }
    
    // Syncopation
    applySyncopation(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const strength = params.strength;
        const beatDuration = 60 / this.currentPattern.bpm;
        
        notes.forEach(note => {
            // Randomly displace notes by fraction of a beat
            if (Math.random() < strength) {
                const displacement = (Math.random() * 0.5 + 0.25) * beatDuration;
                note.time = note.time + displacement;
            }
        });
        
        return this.sortNotes(notes);
    }
    
    // Inversion
    applyInversion(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const pivot = params.pivotNote;
        const direction = params.direction;
        
        notes.forEach(note => {
            const interval = note.midi - pivot;
            note.midi = pivot + (direction === 'up' ? -interval : interval);
            // Clamp to valid range
            note.midi = Math.max(this.constraints.noteRange[0], Math.min(this.constraints.noteRange[1], note.midi));
        });
        
        return notes;
    }
    
    // Retrograde
    applyRetrograde(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const totalDuration = Math.max(...notes.map(n => n.time + n.duration));
        
        // Reverse the order
        return notes.reverse().map(note => ({
            ...note,
            time: totalDuration - note.time - note.duration
        })).sort((a, b) => a.time - b.time);
    }
    
    // Retrograde Inversion
    applyRetrogradeInversion(params) {
        // First invert, then retrograde
        const inverted = this.applyInversion({ pivotNote: params.pivotNote, direction: 'up' });
        const originalNotes = this.currentPattern.notes;
        this.currentPattern.notes = inverted;
        const result = this.applyRetrograde({});
        this.currentPattern.notes = originalNotes;
        return result;
    }
    
    // Transposition
    applyTransposition(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const semitones = params.semitones;
        
        notes.forEach(note => {
            note.midi = note.midi + semitones;
            // Clamp to valid range
            note.midi = Math.max(this.constraints.noteRange[0], Math.min(this.constraints.noteRange[1], note.midi));
        });
        
        return notes;
    }
    
    // Sequence
    applySequence(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const semitones = params.semitones;
        const times = params.times;
        const result = [...notes];
        
        let maxTime = Math.max(...notes.map(n => n.time + n.duration));
        
        for (let i = 1; i <= times; i++) {
            const sequenceCopy = notes.map(note => ({
                ...note,
                midi: note.midi + (semitones * i),
                time: note.time + maxTime * i
            }));
            result.push(...sequenceCopy);
        }
        
        return result;
    }
    
    // Grace Notes
    applyGraceNotes(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const interval = params.interval;
        const probability = params.probability;
        const result = [];
        
        notes.forEach(note => {
            result.push(note);
            
            if (Math.random() < probability) {
                const graceNote = {
                    midi: note.midi + interval,
                    time: note.time - 0.05, // Slightly before main note
                    duration: 0.05,
                    velocity: note.velocity * 0.7
                };
                result.push(graceNote);
            }
        });
        
        return this.sortNotes(result);
    }
    
    // Mordent
    applyMordent(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const type = params.type;
        const speed = params.speed;
        const beatDuration = 60 / this.currentPattern.bpm;
        const mordentLength = beatDuration / speed;
        const result = [];
        
        notes.forEach(note => {
            if (note.duration > mordentLength * 2) {
                result.push(note);
                
                const interval = type === 'upper' ? 1 : -1;
                const mordentNote = {
                    midi: note.midi + interval,
                    time: note.time + mordentLength,
                    duration: mordentLength,
                    velocity: note.velocity * 0.8
                };
                result.push(mordentNote);
            } else {
                result.push(note);
            }
        });
        
        return this.sortNotes(result);
    }
    
    // Trill
    applyTrill(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const interval = params.interval;
        const speed = params.speed;
        const beatDuration = 60 / this.currentPattern.bpm;
        const trillLength = beatDuration / speed;
        const result = [];
        
        notes.forEach(note => {
            let time = note.time;
            const endTime = note.time + note.duration;
            
            while (time < endTime) {
                result.push({
                    midi: note.midi,
                    time: time,
                    duration: Math.min(trillLength, endTime - time),
                    velocity: note.velocity
                });
                
                time += trillLength;
                if (time < endTime) {
                    result.push({
                        midi: note.midi + interval,
                        time: time,
                        duration: Math.min(trillLength, endTime - time),
                        velocity: note.velocity * 0.9
                    });
                }
                time += trillLength;
            }
        });
        
        return this.sortNotes(result);
    }
    
    // Turn
    applyTurn(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const speed = params.speed;
        const beatDuration = 60 / this.currentPattern.bpm;
        const turnLength = beatDuration / speed;
        const result = [];
        
        notes.forEach(note => {
            if (note.duration > turnLength * 4) {
                result.push(note);
                
                // Upper, main, lower, main
                const turnNotes = [
                    { midi: note.midi + 1, time: note.time, velocity: note.velocity * 0.7 },
                    { midi: note.midi, time: note.time + turnLength, velocity: note.velocity * 0.8 },
                    { midi: note.midi - 1, time: note.time + turnLength * 2, velocity: note.velocity * 0.7 },
                    { midi: note.midi, time: note.time + turnLength * 3, velocity: note.velocity * 0.8 }
                ];
                
                turnNotes.forEach(tn => {
                    result.push({
                        ...tn,
                        duration: turnLength
                    });
                });
            } else {
                result.push(note);
            }
        });
        
        return this.sortNotes(result);
    }
    
    // Thinning
    applyThinning(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const probability = params.probability;
        
        return notes.filter(note => Math.random() > probability);
    }
    
    // Doubling
    applyDoubling(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const interval = params.interval;
        const probability = params.probability;
        const result = [...notes];
        
        notes.forEach(note => {
            if (Math.random() < probability) {
                result.push({
                    ...note,
                    midi: note.midi + interval,
                    velocity: note.velocity * 0.6
                });
            }
        });
        
        return this.sortNotes(result);
    }
    
    // Harmonization
    applyHarmonization(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const style = params.style;
        const result = [...notes];
        
        // Define harmony intervals
        const harmonies = {
            thirds: [3, 4], // Major/minor third
            sixths: [8, 9], // Major/minor sixth
            octaves: [12],
            fifths: [7],
            fourths: [5]
        };
        
        const intervals = harmonities[style] || harmonies.thirds;
        
        notes.forEach(note => {
            const harmonyInterval = intervals[Math.floor(Math.random() * intervals.length)];
            result.push({
                ...note,
                midi: note.midi + harmonyInterval,
                velocity: note.velocity * 0.7
            });
        });
        
        return this.sortNotes(result);
    }
    
    // Velocity Ramp
    applyVelocityRamp(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const start = params.start;
        const end = params.end;
        const curve = params.curve;
        
        const sortedNotes = this.sortNotes(notes);
        const totalDuration = Math.max(...sortedNotes.map(n => n.time));
        
        sortedNotes.forEach((note, index) => {
            const position = note.time / totalDuration;
            let velocity;
            
            switch (curve) {
                case 'linear':
                    velocity = start + (end - start) * position;
                    break;
                case 'exponential':
                    velocity = start * Math.pow(end / start, position);
                    break;
                case 'sine':
                    velocity = start + (end - start) * (0.5 + 0.5 * Math.sin(Math.PI * position - Math.PI / 2));
                    break;
                default:
                    velocity = start + (end - start) * position;
            }
            
            note.velocity = Math.round(Math.max(this.constraints.velocityRange[0], 
                                                Math.min(this.constraints.velocityRange[1], velocity)));
        });
        
        return sortedNotes;
    }
    
    // Velocity Randomization
    applyVelocityRandomization(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const amount = params.amount;
        const mode = params.mode;
        
        notes.forEach(note => {
            let delta;
            switch (mode) {
                case 'uniform':
                    delta = (Math.random() - 0.5) * 2 * amount;
                    break;
                case 'gaussian':
                    // Box-Muller transform for Gaussian
                    const u1 = Math.random();
                    const u2 = Math.random();
                    delta = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * amount / 2;
                    break;
                default:
                    delta = (Math.random() - 0.5) * 2 * amount;
            }
            
            note.velocity = Math.round(Math.max(this.constraints.velocityRange[0], 
                                               Math.min(this.constraints.velocityRange[1], 
                                                       note.velocity + delta)));
        });
        
        return notes;
    }
    
    // Articulation Variation
    applyArticulationVariation(params) {
        const notes = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const style = params.style;
        const probability = params.probability;
        
        const articulations = {
            staccato: 0.25,
            legato: 1.0,
            portato: 0.75,
            accent: 1.0,
            tenuto: 1.1
        };
        
        const multiplier = articulations[style] || 1.0;
        
        notes.forEach(note => {
            if (Math.random() < probability) {
                if (style === 'accent') {
                    note.velocity = Math.min(127, Math.round(note.velocity * 1.2));
                } else {
                    note.duration = note.duration * multiplier;
                }
            }
        });
        
        return notes;
    }
    
    // Euclidean Rhythm
    applyEuclidean(params) {
        const pulses = params.pulses;
        const steps = params.steps;
        const rotation = params.rotation;
        
        // Generate Euclidean rhythm pattern
        const pattern = this.generateEuclideanPattern(pulses, steps);
        
        // Rotate if needed
        const rotated = rotation > 0 
            ? [...pattern.slice(rotation), ...pattern.slice(0, rotation)]
            : pattern;
        
        // Convert to notes
        const beatDuration = 60 / this.currentPattern.bpm;
        const stepDuration = beatDuration;
        
        return rotated.map((active, index) => ({
            midi: this.currentPattern.notes[0]?.midi || 60,
            time: index * stepDuration,
            duration: stepDuration * 0.9,
            velocity: active ? 100 : 0
        })).filter(n => n.velocity > 0);
    }
    
    generateEuclideanPattern(pulses, steps) {
        // Bjorklund's algorithm
        const pattern = new Array(steps).fill(0);
        
        if (pulses === 0) return pattern;
        if (pulses >= steps) return pattern.fill(1);
        
        let remainder = pulses;
        let divisor = steps - pulses;
        let level = 0;
        const counts = [];
        const remainders = [];
        
        remainders.push(remainder);
        
        while (remainder > 1) {
            counts.push(Math.floor(divisor / remainder));
            remainders.push(divisor % remainder);
            const newDivisor = remainder;
            remainder = divisor % remainder;
            divisor = newDivisor;
        }
        
        counts.push(divisor);
        
        // Build pattern
        let index = 0;
        const buildPattern = (level) => {
            if (level === counts.length - 1) {
                pattern[index++] = 1;
                return;
            }
            for (let i = 0; i < counts[level]; i++) {
                buildPattern(level + 1);
            }
            if (remainders[level + 1] > 0 && index < steps) {
                pattern[index++] = 1;
            }
        };
        
        buildPattern(0);
        return pattern;
    }
    
    // Markov Chain
    applyMarkovChain(params) {
        const order = params.order;
        const preserveRhythm = params.preserveRhythm;
        
        const originalNotes = this.currentPattern.notes;
        
        // Build transition table
        const transitions = {};
        
        for (let i = 0; i < originalNotes.length - order; i++) {
            const state = originalNotes.slice(i, i + order).map(n => n.midi).join(',');
            const nextState = originalNotes[i + order]?.midi;
            
            if (!transitions[state]) {
                transitions[state] = [];
            }
            transitions[state].push(nextState);
        }
        
        // Generate new sequence
        const result = [];
        let currentState = originalNotes.slice(0, order).map(n => n.midi).join(',');
        
        for (let i = 0; i < originalNotes.length; i++) {
            const note = { ...originalNotes[i] };
            
            if (transitions[currentState] && transitions[currentState].length > 0) {
                const nextMidi = transitions[currentState][Math.floor(Math.random() * transitions[currentState].length)];
                note.midi = nextMidi;
            }
            
            result.push(note);
            
            // Update state
            const stateNotes = currentState.split(',').slice(1);
            stateNotes.push(note.midi);
            currentState = stateNotes.join(',');
        }
        
        return result;
    }
    
    // Cellular Automata
    applyCellular(params) {
        const rule = params.rule;
        const steps = params.steps;
        
        // Generate pattern using 1D cellular automata
        const pattern = [];
        let current = new Array(steps).fill(0);
        current[Math.floor(steps / 2)] = 1; // Single seed
        
        for (let gen = 0; gen < steps; gen++) {
            const next = new Array(steps).fill(0);
            for (let i = 0; i < steps; i++) {
                const left = current[(i - 1 + steps) % steps];
                const center = current[i];
                const right = current[(i + 1) % steps];
                const index = (left << 2) | (center << 1) | right;
                next[i] = (rule >> index) & 1;
                
                if (next[i]) {
                    pattern.push({
                        midi: 60 + (gen % 12),
                        time: i * 0.5,
                        duration: 0.4,
                        velocity: 80 + gen % 40
                    });
                }
            }
            current = next;
        }
        
        return this.sortNotes(pattern);
    }
    
    // Fractal Pattern
    applyFractal(params) {
        const depth = params.depth;
        const scalingFactor = params.scalingFactor;
        
        const originalNotes = this.currentPattern.notes;
        const result = [];
        
        const generateFractal = (notes, currentDepth, timeOffset, pitchOffset, velocityMultiplier) => {
            if (currentDepth > depth) return;
            
            notes.forEach(note => {
                result.push({
                    midi: note.midi + pitchOffset,
                    time: note.time * scalingFactor + timeOffset,
                    duration: note.duration * scalingFactor,
                    velocity: Math.round(note.velocity * velocityMultiplier)
                });
            });
            
            // Recursive calls
            generateFractal(notes, currentDepth + 1, timeOffset, pitchOffset + 12, velocityMultiplier * 0.7);
            generateFractal(notes, currentDepth + 1, timeOffset + notes.length * scalingFactor, pitchOffset - 12, velocityMultiplier * 0.7);
        };
        
        generateFractal(originalNotes, 0, 0, 0, 1);
        
        return this.sortNotes(result);
    }
    
    // Apply constraints to the result
    applyConstraints(notes) {
        let result = notes;
        
        // Note range constraints
        result = result.map(note => ({
            ...note,
            midi: Math.max(this.constraints.noteRange[0], 
                          Math.min(this.constraints.noteRange[1], note.midi))
        }));
        
        // Velocity constraints
        result = result.map(note => ({
            ...note,
            velocity: Math.max(this.constraints.velocityRange[0],
                              Math.min(this.constraints.velocityRange[1], note.velocity))
        }));
        
        // Scale constraint
        if (this.constraints.scale) {
            result = result.map(note => ({
                ...note,
                midi: this.snapToScale(note.midi, this.constraints.scale, this.constraints.key)
            }));
        }
        
        return result;
    }
    
    snapToScale(midi, scale, key) {
        const scaleNotes = this.getScaleNotes(scale, key);
        const octave = Math.floor(midi / 12);
        const noteInOctave = midi % 12;
        
        // Find closest scale note
        let closest = scaleNotes[0];
        let minDistance = Math.abs(noteInOctave - closest);
        
        scaleNotes.forEach(note => {
            const distance = Math.abs(noteInOctave - note);
            if (distance < minDistance) {
                minDistance = distance;
                closest = note;
            }
        });
        
        return octave * 12 + closest;
    }
    
    getScaleNotes(scale, key) {
        const scales = {
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            pentatonic: [0, 2, 4, 7, 9],
            blues: [0, 3, 5, 6, 7, 10],
            dorian: [0, 2, 3, 5, 7, 9, 10],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            lydian: [0, 2, 4, 6, 7, 9, 11],
            mixolydian: [0, 2, 4, 5, 7, 9, 10],
            locrian: [0, 1, 3, 5, 6, 8, 10],
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        };
        
        const keyOffset = key ? this.noteNameToMidi(key) % 12 : 0;
        const scaleIntervals = scales[scale] || scales.major;
        
        return scaleIntervals.map(i => (i + keyOffset) % 12);
    }
    
    noteNameToMidi(noteName) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return notes.indexOf(noteName);
    }
    
    sortNotes(notes) {
        return notes.sort((a, b) => a.time - b.time);
    }
    
    // Generate multiple variations
    generateVariations(count = 5, algorithmNames = null) {
        const variations = [];
        const algorithms = algorithmNames || Object.keys(this.algorithms);
        
        for (let i = 0; i < count; i++) {
            const algo = algorithms[Math.floor(Math.random() * algorithms.length)];
            const variation = this.applyAlgorithm(algo);
            
            if (variation) {
                variations.push({
                    id: `var_${Date.now()}_${i}`,
                    algorithm: algo,
                    notes: variation,
                    created: Date.now()
                });
            }
        }
        
        this.variations = variations.slice(0, this.maxVariations);
        return this.variations;
    }
    
    // Apply preset (combination of algorithms)
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) {
            console.error('[MIDIPatternVariationEnhancement] Unknown preset:', presetName);
            return null;
        }
        
        let result = JSON.parse(JSON.stringify(this.currentPattern.notes));
        const originalNotes = this.currentPattern.notes;
        
        preset.algorithms.forEach((algo, index) => {
            const weight = preset.weights[index];
            if (Math.random() < weight) {
                this.currentPattern.notes = result;
                result = this.applyAlgorithm(algo) || result;
            }
        });
        
        this.currentPattern.notes = originalNotes;
        return result;
    }
    
    // Save variation to history
    saveVariation(notes, algorithm) {
        this.history.push({
            notes: JSON.parse(JSON.stringify(notes)),
            algorithm: algorithm,
            timestamp: Date.now()
        });
        
        if (this.history.length > 50) {
            this.history.shift();
        }
        
        return this.history.length - 1;
    }
    
    // Undo
    undo() {
        if (this.history.length > 1) {
            this.history.pop();
            const last = this.history[this.history.length - 1];
            this.currentPattern.notes = JSON.parse(JSON.stringify(last.notes));
            return true;
        }
        return false;
    }
    
    // Export variations
    exportVariations() {
        return {
            original: this.currentPattern,
            variations: this.variations,
            history: this.history
        };
    }
    
    // Import variations
    importVariations(data) {
        if (data.original) {
            this.currentPattern = data.original;
        }
        if (data.variations) {
            this.variations = data.variations;
        }
        if (data.history) {
            this.history = data.history;
        }
    }
}

// UI Panel
function openMIDIPatternVariationEnhancementPanel() {
    const existing = document.getElementById('midi-variation-panel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'midi-variation-panel';
    panel.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1a1a2e; border: 1px solid #444; border-radius: 8px; padding: 24px; z-index: 10000; min-width: 800px; max-height: 85vh; overflow-y: auto; color: white; font-family: system-ui;';
    
    const variationManager = window.snugDAW?.patternVariation;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 20px;">🎵 MIDI Pattern Variation Enhancement</h2>
            <button id="close-variation-panel" style="background: #333; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer;">✕</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 250px 1fr; gap: 20px;">
            <!-- Algorithm List -->
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px; max-height: 400px; overflow-y: auto;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">ALGORITHMS</h3>
                <div id="algorithm-list">
                    ${Object.entries(variationManager?.algorithms || {}).map(([key, algo]) => `
                        <button class="algo-btn" data-algo="${key}" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #333; color: white; border-radius: 4px; cursor: pointer; text-align: left; margin-bottom: 4px;">
                            <div style="font-weight: bold; font-size: 12px;">${algo.name}</div>
                            <div style="font-size: 10px; color: #888;">${algo.description}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <!-- Parameters & Results -->
            <div>
                <!-- Presets -->
                <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">PRESETS</h3>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${Object.entries(variationManager?.presets || {}).map(([key, preset]) => `
                            <button class="preset-btn" data-preset="${key}" style="padding: 8px 16px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">${preset.name}</button>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Algorithm Parameters -->
                <div id="algo-params" style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-bottom: 16px; display: none;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">PARAMETERS</h3>
                    <div id="param-inputs"></div>
                    <button id="apply-algo-btn" style="margin-top: 12px; padding: 10px 20px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Apply Algorithm</button>
                </div>
                
                <!-- Generated Variations -->
                <div style="background: #0a0a14; padding: 16px; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin: 0; font-size: 14px; color: #888;">GENERATED VARIATIONS</h3>
                        <button id="generate-multiple" style="padding: 6px 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">Generate 5 Random</button>
                    </div>
                    <div id="variations-list" style="max-height: 200px; overflow-y: auto;">
                        <div style="color: #888; font-size: 13px;">Select an algorithm or preset to generate variations.</div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button id="export-variations" style="padding: 12px 20px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">Export</button>
            <button id="import-variations" style="padding: 12px 20px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">Import</button>
            <button id="undo-variation" style="padding: 12px 20px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">↶ Undo</button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-variation-panel').onclick = () => panel.remove();
    
    // Algorithm selection
    let selectedAlgo = null;
    
    panel.querySelectorAll('.algo-btn').forEach(btn => {
        btn.onclick = () => {
            selectedAlgo = btn.dataset.algo;
            const algo = variationManager?.algorithms[selectedAlgo];
            
            if (algo) {
                const paramsDiv = document.getElementById('algo-params');
                const inputsDiv = document.getElementById('param-inputs');
                paramsDiv.style.display = 'block';
                
                inputsDiv.innerHTML = Object.entries(algo.params).map(([key, value]) => {
                    if (typeof value === 'number') {
                        return `
                            <div style="margin-bottom: 8px;">
                                <label style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
                                    <span>${key}</span>
                                    <span id="param-val-${key}">${value}</span>
                                </label>
                                <input type="range" id="param-${key}" value="${value}" min="0" max="2" step="0.1" style="width: 100%;">
                            </div>
                        `;
                    } else if (typeof value === 'string') {
                        return `
                            <div style="margin-bottom: 8px;">
                                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">${key}</label>
                                <input type="text" id="param-${key}" value="${value}" style="width: 100%; padding: 6px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                            </div>
                        `;
                    }
                    return '';
                }).join('');
            }
        };
    });
    
    // Apply algorithm
    document.getElementById('apply-algo-btn').onclick = () => {
        if (selectedAlgo && variationManager?.currentPattern) {
            const params = {};
            const inputs = document.getElementById('param-inputs').querySelectorAll('input');
            inputs.forEach(input => {
                const key = input.id.replace('param-', '');
                params[key] = parseFloat(input.value) || input.value;
            });
            
            const result = variationManager.applyAlgorithm(selectedAlgo, params);
            if (result) {
                variationManager.saveVariation(result, selectedAlgo);
                updateVariationsList();
            }
        }
    };
    
    // Presets
    panel.querySelectorAll('.preset-btn').forEach(btn => {
        btn.onclick = () => {
            const preset = btn.dataset.preset;
            if (variationManager?.currentPattern) {
                const result = variationManager.applyPreset(preset);
                if (result) {
                    variationManager.saveVariation(result, `preset:${preset}`);
                    updateVariationsList();
                }
            }
        };
    });
    
    // Generate multiple
    document.getElementById('generate-multiple').onclick = () => {
        if (variationManager?.currentPattern) {
            variationManager.generateVariations(5);
            updateVariationsList();
        }
    };
    
    // Update variations list
    function updateVariationsList() {
        const list = document.getElementById('variations-list');
        if (variationManager?.variations.length > 0) {
            list.innerHTML = variationManager.variations.map((v, i) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #1a1a2e; margin-bottom: 4px; border-radius: 4px;">
                    <span>${v.algorithm} (${v.notes.length} notes)</span>
                    <button class="use-variation" data-index="${i}" style="padding: 4px 8px; background: #10b981; border: none; color: white; border-radius: 3px; cursor: pointer; font-size: 11px;">Use</button>
                </div>
            `).join('');
            
            list.querySelectorAll('.use-variation').forEach(btn => {
                btn.onclick = () => {
                    const idx = parseInt(btn.dataset.index);
                    const variation = variationManager.variations[idx];
                    // Emit event or callback to use this variation
                    console.log('[MIDIPatternVariationEnhancement] Using variation:', variation.algorithm);
                };
            });
        }
    }
    
    // Export/Import
    document.getElementById('export-variations').onclick = () => {
        if (variationManager) {
            const data = variationManager.exportVariations();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pattern-variations.json';
            a.click();
            URL.revokeObjectURL(url);
        }
    };
    
    document.getElementById('import-variations').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const text = await file.text();
                try {
                    const data = JSON.parse(text);
                    variationManager?.importVariations(data);
                    updateVariationsList();
                } catch (err) {
                    console.error('Failed to import variations:', err);
                }
            }
        };
        input.click();
    };
    
    // Undo
    document.getElementById('undo-variation').onclick = () => {
        variationManager?.undo();
        updateVariationsList();
    };
}

// Initialize
function initMIDIPatternVariationEnhancement() {
    const enhancer = new MIDIPatternVariationEnhancement();
    
    if (!window.snugDAW) window.snugDAW = {};
    window.snugDAW.patternVariation = enhancer;
    
    return enhancer;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MIDIPatternVariationEnhancement, initMIDIPatternVariationEnhancement, openMIDIPatternVariationEnhancementPanel };
}