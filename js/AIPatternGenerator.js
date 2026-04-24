/**
 * AI Pattern Generator - AI-powered pattern and melody generation
 * Generates musical patterns using algorithmic composition techniques
 */

export class AIPatternGenerator {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.sampleRate = this.audioContext?.sampleRate || 44100;
        
        // Generation settings
        this.settings = {
            scale: options.scale || 'major',
            key: options.key || 'C',
            octaveRange: options.octaveRange || [3, 5],
            lengthInBars: options.lengthInBars || 4,
            beatsPerBar: options.beatsPerBar || 4,
            subdivisions: options.subdivisions || 4, // 16th notes
            tempo: options.tempo || 120,
            density: options.density || 0.5, // 0-1, how many notes to generate
            variability: options.variability || 0.3, // 0-1, how much variation
            genre: options.genre || 'electronic', // electronic, classical, jazz, pop, hiphop
            instrument: options.instrument || 'synth' // synth, bass, drums, melody, pad
        };
        
        // Scale definitions (intervals from root)
        this.scales = {
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
        
        // Note names for key conversion
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Pattern history for learning/variation
        this.patternHistory = [];
        this.maxHistory = 10;
        
        // Markov chain for melody generation
        this.markovChain = this.initializeMarkovChain();
        
        // Genre-specific patterns
        this.genrePatterns = this.initializeGenrePatterns();
    }
    
    /**
     * Initialize Markov chain for melody generation
     */
    initializeMarkovChain() {
        // Transition probabilities based on music theory
        return {
            I: { I: 0.1, ii: 0.2, iii: 0.1, IV: 0.2, V: 0.25, vi: 0.15 },
            ii: { I: 0.1, ii: 0.05, iii: 0.1, IV: 0.1, V: 0.5, vi: 0.15 },
            iii: { I: 0.1, ii: 0.1, iii: 0.05, IV: 0.2, V: 0.1, vi: 0.45 },
            IV: { I: 0.2, ii: 0.1, iii: 0.05, IV: 0.1, V: 0.4, vi: 0.15 },
            V: { I: 0.5, ii: 0.1, iii: 0.05, IV: 0.1, V: 0.1, vi: 0.15 },
            vi: { I: 0.2, ii: 0.3, iii: 0.1, IV: 0.2, V: 0.1, vi: 0.1 }
        };
    }
    
    /**
     * Initialize genre-specific pattern characteristics
     */
    initializeGenrePatterns() {
        return {
            electronic: {
                rhythmDensity: 0.7,
                syncopation: 0.6,
                repetition: 0.8,
                noteLengthVariety: 0.3,
                commonSubdivisions: [4, 8, 16],
                typicalBPM: [120, 140]
            },
            classical: {
                rhythmDensity: 0.4,
                syncopation: 0.2,
                repetition: 0.3,
                noteLengthVariety: 0.8,
                commonSubdivisions: [2, 3, 4],
                typicalBPM: [60, 120]
            },
            jazz: {
                rhythmDensity: 0.5,
                syncopation: 0.8,
                repetition: 0.2,
                noteLengthVariety: 0.7,
                commonSubdivisions: [3, 4, 6],
                typicalBPM: [80, 160]
            },
            pop: {
                rhythmDensity: 0.5,
                syncopation: 0.3,
                repetition: 0.7,
                noteLengthVariety: 0.4,
                commonSubdivisions: [4, 8],
                typicalBPM: [100, 130]
            },
            hiphop: {
                rhythmDensity: 0.6,
                syncopation: 0.7,
                repetition: 0.6,
                noteLengthVariety: 0.5,
                commonSubdivisions: [4, 8, 16],
                typicalBPM: [80, 100]
            }
        };
    }
    
    /**
     * Get scale degrees in the current key and scale
     */
    getScaleDegrees() {
        const scaleIntervals = this.scales[this.settings.scale] || this.scales.major;
        const rootNote = this.noteNames.indexOf(this.settings.key);
        
        if (rootNote === -1) return [60, 62, 64, 65, 67, 69, 71]; // Default C major
        
        const degrees = [];
        for (let octave = this.settings.octaveRange[0]; octave <= this.settings.octaveRange[1]; octave++) {
            for (const interval of scaleIntervals) {
                degrees.push(rootNote + interval + (octave * 12));
            }
        }
        
        return degrees;
    }
    
    /**
     * Generate a random melody pattern
     */
    generateMelodyPattern(options = {}) {
        const settings = { ...this.settings, ...options };
        const scaleDegrees = this.getScaleDegrees();
        const totalSteps = settings.lengthInBars * settings.beatsPerBar * settings.subdivisions;
        const stepDuration = (60 / settings.tempo) / settings.subdivisions;
        
        const notes = [];
        let currentDegree = Math.floor(scaleDegrees.length / 2); // Start in middle of range
        let lastNoteEnd = 0;
        
        for (let step = 0; step < totalSteps; step++) {
            // Probability of placing a note based on density
            if (Math.random() < settings.density) {
                // Determine note length (in steps)
                const possibleLengths = [1, 2, 4, 8];
                const lengthWeights = this.getNoteLengthWeights(settings.genre);
                const noteLength = this.weightedRandom(possibleLengths, lengthWeights);
                
                // Skip if this would overlap with previous note
                if (step >= lastNoteEnd) {
                    // Get next note based on melodic contour
                    const direction = this.getMelodicDirection(currentDegree, scaleDegrees.length, settings.variability);
                    currentDegree = Math.max(0, Math.min(scaleDegrees.length - 1, currentDegree + direction));
                    
                    // Add some variability
                    if (Math.random() < settings.variability * 0.5) {
                        currentDegree = Math.floor(Math.random() * scaleDegrees.length);
                    }
                    
                    const midiNote = scaleDegrees[currentDegree];
                    
                    // Generate velocity with humanization
                    const baseVelocity = 80;
                    const velocityVariation = 30 * settings.variability;
                    const velocity = Math.max(40, Math.min(127, baseVelocity + (Math.random() - 0.5) * velocityVariation));
                    
                    notes.push({
                        midiNote,
                        startTime: step * stepDuration,
                        duration: noteLength * stepDuration,
                        velocity: Math.round(velocity),
                        step: step,
                        length: noteLength
                    });
                    
                    lastNoteEnd = step + noteLength;
                }
            }
        }
        
        return {
            notes,
            settings: { ...settings },
            scaleDegrees,
            totalDuration: totalSteps * stepDuration
        };
    }
    
    /**
     * Generate a bass pattern
     */
    generateBassPattern(options = {}) {
        const settings = { 
            ...this.settings, 
            instrument: 'bass',
            octaveRange: [1, 3],
            density: 0.4,
            ...options 
        };
        
        const scaleDegrees = this.getScaleDegrees();
        const totalSteps = settings.lengthInBars * settings.beatsPerBar * settings.subdivisions;
        const stepDuration = (60 / settings.tempo) / settings.subdivisions;
        
        const notes = [];
        const genrePattern = this.genrePatterns[settings.genre] || this.genrePatterns.electronic;
        
        // Bass typically hits on strong beats with occasional syncopation
        for (let bar = 0; bar < settings.lengthInBars; bar++) {
            for (let beat = 0; beat < settings.beatsPerBar; beat++) {
                const step = (bar * settings.beatsPerBar + beat) * settings.subdivisions;
                
                // Root on downbeat
                if (beat === 0) {
                    const rootDegree = 0; // Root of scale
                    notes.push({
                        midiNote: scaleDegrees[rootDegree],
                        startTime: step * stepDuration,
                        duration: stepDuration * settings.subdivisions,
                        velocity: 100,
                        step: step,
                        length: settings.subdivisions
                    });
                }
                
                // Occasional off-beat bass notes based on syncopation
                if (Math.random() < genrePattern.syncopation * 0.5 && beat > 0) {
                    const degree = this.getChordDegree(bar, beat);
                    notes.push({
                        midiNote: scaleDegrees[Math.min(degree, scaleDegrees.length - 1)],
                        startTime: step * stepDuration,
                        duration: stepDuration * 2,
                        velocity: 70 + Math.random() * 20,
                        step: step + Math.floor(settings.subdivisions / 2),
                        length: 2
                    });
                }
            }
        }
        
        return {
            notes,
            settings: { ...settings },
            scaleDegrees,
            totalDuration: totalSteps * stepDuration
        };
    }
    
    /**
     * Generate a drum pattern
     */
    generateDrumPattern(options = {}) {
        const settings = { 
            ...this.settings, 
            instrument: 'drums',
            ...options 
        };
        
        const totalSteps = settings.lengthInBars * settings.beatsPerBar * settings.subdivisions;
        const stepDuration = (60 / settings.tempo) / settings.subdivisions;
        const genrePattern = this.genrePatterns[settings.genre] || this.genrePatterns.electronic;
        
        // Standard drum MIDI mapping (General MIDI)
        const drums = {
            kick: 36,
            snare: 38,
            hihatClosed: 42,
            hihatOpen: 46,
            tomHigh: 50,
            tomMid: 48,
            tomLow: 45,
            crash: 49,
            ride: 51,
            clap: 39
        };
        
        const notes = [];
        
        for (let step = 0; step < totalSteps; step++) {
            const bar = Math.floor(step / (settings.beatsPerBar * settings.subdivisions));
            const beat = Math.floor(step / settings.subdivisions) % settings.beatsPerBar;
            const subBeat = step % settings.subdivisions;
            
            // Kick patterns based on genre
            if (this.shouldPlaceKick(beat, subBeat, genrePattern)) {
                notes.push({
                    midiNote: drums.kick,
                    startTime: step * stepDuration,
                    duration: stepDuration,
                    velocity: this.getDrumVelocity('kick', beat, subBeat, genrePattern),
                    step: step,
                    length: 1,
                    drumType: 'kick'
                });
            }
            
            // Snare patterns
            if (this.shouldPlaceSnare(beat, subBeat, genrePattern)) {
                notes.push({
                    midiNote: drums.snare,
                    startTime: step * stepDuration,
                    duration: stepDuration,
                    velocity: this.getDrumVelocity('snare', beat, subBeat, genrePattern),
                    step: step,
                    length: 1,
                    drumType: 'snare'
                });
            }
            
            // Hi-hat patterns
            if (this.shouldPlaceHihat(beat, subBeat, genrePattern)) {
                const isOpen = subBeat === 2 && Math.random() < 0.3;
                notes.push({
                    midiNote: isOpen ? drums.hihatOpen : drums.hihatClosed,
                    startTime: step * stepDuration,
                    duration: stepDuration,
                    velocity: this.getDrumVelocity('hihat', beat, subBeat, genrePattern),
                    step: step,
                    length: 1,
                    drumType: 'hihat'
                });
            }
        }
        
        return {
            notes,
            settings: { ...settings },
            drums,
            totalDuration: totalSteps * stepDuration
        };
    }
    
    /**
     * Generate a pad/chord pattern
     */
    generatePadPattern(options = {}) {
        const settings = { 
            ...this.settings, 
            instrument: 'pad',
            density: 0.2,
            ...options 
        };
        
        const scaleDegrees = this.getScaleDegrees();
        const barDuration = (60 / settings.tempo) * settings.beatsPerBar;
        
        const notes = [];
        
        // Chord progressions
        const progression = this.getChordProgression(settings.genre);
        
        for (let bar = 0; bar < settings.lengthInBars; bar++) {
            const chordDegree = progression[bar % progression.length];
            const chordNotes = this.buildChord(chordDegree, scaleDegrees);
            
            // Add chord tones
            for (const note of chordNotes) {
                notes.push({
                    midiNote: note,
                    startTime: bar * barDuration,
                    duration: barDuration * 0.9, // Slight gap between chords
                    velocity: 60 + Math.random() * 10,
                    step: bar * settings.beatsPerBar * settings.subdivisions,
                    length: settings.beatsPerBar * settings.subdivisions,
                    chordDegree,
                    chordNotes
                });
            }
        }
        
        return {
            notes,
            settings: { ...settings },
            scaleDegrees,
            totalDuration: settings.lengthInBars * barDuration
        };
    }
    
    /**
     * Generate a complete multi-track arrangement
     */
    generateArrangement(options = {}) {
        const settings = { ...this.settings, ...options };
        
        return {
            melody: this.generateMelodyPattern(settings),
            bass: this.generateBassPattern(settings),
            drums: this.generateDrumPattern(settings),
            pad: this.generatePadPattern(settings),
            tempo: settings.tempo,
            lengthInBars: settings.lengthInBars,
            key: settings.key,
            scale: settings.scale
        };
    }
    
    /**
     * Generate a variation of an existing pattern
     */
    generateVariation(pattern, variationAmount = 0.3) {
        const variation = JSON.parse(JSON.stringify(pattern));
        
        for (const note of variation.notes) {
            // Possibly shift timing
            if (Math.random() < variationAmount) {
                const shift = Math.floor((Math.random() - 0.5) * 2);
                note.step = Math.max(0, note.step + shift);
                note.startTime = note.step * ((60 / this.settings.tempo) / this.settings.subdivisions);
            }
            
            // Possibly change velocity
            if (Math.random() < variationAmount) {
                note.velocity = Math.max(40, Math.min(127, note.velocity + (Math.random() - 0.5) * 30));
            }
            
            // Possibly add/remove notes
            if (Math.random() < variationAmount * 0.3) {
                note.midiNote = this.getScaleDegrees()[Math.floor(Math.random() * this.getScaleDegrees().length)];
            }
        }
        
        // Possibly add some new notes
        const addCount = Math.floor(variation.notes.length * variationAmount * 0.2);
        for (let i = 0; i < addCount; i++) {
            const scaleDegrees = this.getScaleDegrees();
            const totalSteps = this.settings.lengthInBars * this.settings.beatsPerBar * this.settings.subdivisions;
            const stepDuration = (60 / this.settings.tempo) / this.settings.subdivisions;
            
            variation.notes.push({
                midiNote: scaleDegrees[Math.floor(Math.random() * scaleDegrees.length)],
                startTime: Math.random() * totalSteps * stepDuration,
                duration: stepDuration * (1 + Math.floor(Math.random() * 3)),
                velocity: 60 + Math.random() * 40,
                step: Math.floor(Math.random() * totalSteps),
                length: 1 + Math.floor(Math.random() * 3)
            });
        }
        
        return variation;
    }
    
    // Helper methods
    
    getNoteLengthWeights(genre) {
        const pattern = this.genrePatterns[genre] || this.genrePatterns.electronic;
        if (pattern.noteLengthVariety > 0.6) {
            return [0.3, 0.3, 0.25, 0.15]; // More variety
        }
        return [0.2, 0.5, 0.25, 0.05]; // Less variety
    }
    
    weightedRandom(items, weights) {
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) return items[i];
        }
        
        return items[items.length - 1];
    }
    
    getMelodicDirection(currentDegree, maxDegree, variability) {
        const rand = Math.random();
        
        // Tendency to move toward center of range
        const centerPull = (maxDegree / 2 - currentDegree) / maxDegree;
        
        if (rand < 0.4 + centerPull * 0.2 + variability * 0.1) {
            return 1; // Move up
        } else if (rand < 0.8 - centerPull * 0.2 - variability * 0.1) {
            return -1; // Move down
        }
        return 0; // Stay same
    }
    
    getChordDegree(bar, beat) {
        // Simple chord progression mapping
        const progressionMap = {
            0: 0, // I
            1: 3, // IV
            2: 4, // V
            3: 5  // vi
        };
        return progressionMap[bar % 4] * 2;
    }
    
    shouldPlaceKick(beat, subBeat, genrePattern) {
        // Basic kick on 1 and 3 for most genres
        if (subBeat !== 0) return false;
        
        if (beat === 0 || beat === 2) return true;
        
        // Electronic: four-on-the-floor
        if (genrePattern.syncopation < 0.4) {
            return true;
        }
        
        return Math.random() < 0.3;
    }
    
    shouldPlaceSnare(beat, subBeat, genrePattern) {
        // Snare typically on 2 and 4
        if (subBeat !== 0) return false;
        
        if (beat === 1 || beat === 3) return true;
        
        return Math.random() < 0.1;
    }
    
    shouldPlaceHihat(beat, subBeat, genrePattern) {
        // Hi-hats on every subdivision
        return Math.random() < 0.8;
    }
    
    getDrumVelocity(drumType, beat, subBeat, genrePattern) {
        const baseVelocities = {
            kick: 100,
            snare: 90,
            hihat: 60
        };
        
        let velocity = baseVelocities[drumType] || 80;
        
        // Add variation
        velocity += (Math.random() - 0.5) * 20;
        
        // Accents on strong beats
        if (subBeat === 0) velocity += 10;
        if (beat === 0) velocity += 15;
        
        return Math.max(40, Math.min(127, Math.round(velocity)));
    }
    
    getChordProgression(genre) {
        const progressions = {
            electronic: [0, 0, 4, 4], // I - I - V - V
            classical: [0, 3, 4, 4], // I - IV - V - V
            jazz: [0, 5, 3, 4], // I - vi - IV - V
            pop: [0, 5, 3, 4], // I - vi - IV - V
            hiphop: [0, 0, 3, 4] // I - I - IV - V
        };
        
        return progressions[genre] || progressions.pop;
    }
    
    buildChord(degree, scaleDegrees) {
        // Build a chord from scale degrees
        const root = scaleDegrees[degree % scaleDegrees.length];
        const third = scaleDegrees[(degree + 2) % scaleDegrees.length];
        const fifth = scaleDegrees[(degree + 4) % scaleDegrees.length];
        
        return [root, third, fifth];
    }
    
    /**
     * Create UI panel for pattern generation
     */
    createUI() {
        const panel = document.createElement('div');
        panel.id = 'ai-pattern-generator-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1a2e;
            border: 1px solid #3a3a5e;
            border-radius: 8px;
            padding: 24px;
            z-index: 10000;
            min-width: 400px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        panel.innerHTML = `
            <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #10b981;">AI Pattern Generator</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Scale</label>
                    <select id="ai-scale" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                        <option value="major">Major</option>
                        <option value="minor">Minor</option>
                        <option value="pentatonicMajor">Pentatonic Major</option>
                        <option value="pentatonicMinor">Pentatonic Minor</option>
                        <option value="blues">Blues</option>
                        <option value="dorian">Dorian</option>
                        <option value="mixolydian">Mixolydian</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Key</label>
                    <select id="ai-key" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                        ${this.noteNames.map(n => `<option value="${n}">${n}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Genre</label>
                    <select id="ai-genre" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                        <option value="electronic">Electronic</option>
                        <option value="hiphop">Hip-Hop</option>
                        <option value="pop">Pop</option>
                        <option value="jazz">Jazz</option>
                        <option value="classical">Classical</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Pattern Type</label>
                    <select id="ai-pattern-type" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                        <option value="melody">Melody</option>
                        <option value="bass">Bass</option>
                        <option value="drums">Drums</option>
                        <option value="pad">Pad/Chords</option>
                        <option value="full">Full Arrangement</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Length (bars)</label>
                    <input type="number" id="ai-length" value="4" min="1" max="16" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                </div>
                <div>
                    <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Tempo</label>
                    <input type="number" id="ai-tempo" value="${this.settings.tempo}" min="40" max="240" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #3a3a5e; color: white; border-radius: 4px;">
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Density: <span id="density-value">50%</span></label>
                <input type="range" id="ai-density" min="0.1" max="1" step="0.1" value="0.5" style="width: 100%;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Variability: <span id="variability-value">30%</span></label>
                <input type="range" id="ai-variability" min="0" max="1" step="0.1" value="0.3" style="width: 100%;">
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button id="generate-pattern-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Generate Pattern
                </button>
                <button id="generate-variation-btn" style="flex: 1; padding: 12px; background: #6366f1; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
                    Generate Variation
                </button>
                <button id="close-ai-panel" style="padding: 12px 20px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
                    Close
                </button>
            </div>
            
            <div id="generated-pattern-preview" style="margin-top: 20px; padding: 12px; background: #0a0a14; border-radius: 4px; display: none;">
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Generated Pattern</div>
                <div id="pattern-stats" style="font-size: 14px;"></div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupUIEvents(panel);
        
        return panel;
    }
    
    setupUIEvents(panel) {
        const densitySlider = panel.querySelector('#ai-density');
        const densityValue = panel.querySelector('#density-value');
        densitySlider.addEventListener('input', () => {
            densityValue.textContent = Math.round(densitySlider.value * 100) + '%';
        });
        
        const variabilitySlider = panel.querySelector('#ai-variability');
        const variabilityValue = panel.querySelector('#variability-value');
        variabilitySlider.addEventListener('input', () => {
            variabilityValue.textContent = Math.round(variabilitySlider.value * 100) + '%';
        });
        
        panel.querySelector('#generate-pattern-btn').addEventListener('click', () => {
            this.generateFromUI();
        });
        
        panel.querySelector('#generate-variation-btn').addEventListener('click', () => {
            if (this.lastGeneratedPattern) {
                const variation = this.generateVariation(this.lastGeneratedPattern, 0.4);
                this.displayPattern(variation);
            }
        });
        
        panel.querySelector('#close-ai-panel').addEventListener('click', () => {
            panel.remove();
        });
    }
    
    generateFromUI() {
        const panel = document.querySelector('#ai-pattern-generator-panel');
        if (!panel) return;
        
        const options = {
            scale: panel.querySelector('#ai-scale').value,
            key: panel.querySelector('#ai-key').value,
            genre: panel.querySelector('#ai-genre').value,
            instrument: panel.querySelector('#ai-pattern-type').value,
            lengthInBars: parseInt(panel.querySelector('#ai-length').value),
            tempo: parseInt(panel.querySelector('#ai-tempo').value),
            density: parseFloat(panel.querySelector('#ai-density').value),
            variability: parseFloat(panel.querySelector('#ai-variability').value)
        };
        
        this.settings = { ...this.settings, ...options };
        
        let pattern;
        switch (options.instrument) {
            case 'melody':
                pattern = this.generateMelodyPattern(options);
                break;
            case 'bass':
                pattern = this.generateBassPattern(options);
                break;
            case 'drums':
                pattern = this.generateDrumPattern(options);
                break;
            case 'pad':
                pattern = this.generatePadPattern(options);
                break;
            case 'full':
                pattern = this.generateArrangement(options);
                break;
            default:
                pattern = this.generateMelodyPattern(options);
        }
        
        this.lastGeneratedPattern = pattern;
        this.displayPattern(pattern);
        
        // Store in history
        this.patternHistory.push(pattern);
        if (this.patternHistory.length > this.maxHistory) {
            this.patternHistory.shift();
        }
    }
    
    displayPattern(pattern) {
        const preview = document.querySelector('#generated-pattern-preview');
        const stats = document.querySelector('#pattern-stats');
        
        if (preview && stats) {
            preview.style.display = 'block';
            
            const noteCount = pattern.notes ? pattern.notes.length : 
                Object.values(pattern).reduce((sum, p) => sum + (p?.notes?.length || 0), 0);
            
            stats.innerHTML = `
                <div>Notes generated: <strong>${noteCount}</strong></div>
                <div>Key: <strong>${this.settings.key} ${this.settings.scale}</strong></div>
                <div>Tempo: <strong>${this.settings.tempo} BPM</strong></div>
                <div>Genre: <strong>${this.settings.genre}</strong></div>
            `;
        }
    }
}

// Export singleton instance
let aiPatternGeneratorInstance = null;

export function getAIPatternGenerator(options = {}) {
    if (!aiPatternGeneratorInstance) {
        aiPatternGeneratorInstance = new AIPatternGenerator(options);
    }
    return aiPatternGeneratorInstance;
}

export function openAIPatternGeneratorPanel() {
    const generator = getAIPatternGenerator();
    return generator.createUI();
}
