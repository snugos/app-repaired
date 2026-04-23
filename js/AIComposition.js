// js/AIComposition.js - AI-Assisted Composition for SnugOS DAW
// Provides AI-powered melody, chord, and rhythm suggestions

// ===========================================
// MUSICAL CONSTANTS
// ===========================================

const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    pentatonic_major: [0, 2, 4, 7, 9],
    pentatonic_minor: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10],
    harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
    melodic_minor: [0, 2, 3, 5, 7, 9, 11]
};

const CHORD_PROGRESSIONS = {
    pop: [
        { name: 'I-V-vi-IV', degrees: [1, 5, 6, 4] },
        { name: 'I-IV-V-I', degrees: [1, 4, 5, 1] },
        { name: 'I-vi-IV-V', degrees: [1, 6, 4, 5] },
        { name: 'vi-IV-I-V', degrees: [6, 4, 1, 5] }
    ],
    jazz: [
        { name: 'ii-V-I', degrees: [2, 5, 1] },
        { name: 'I-vi-ii-V', degrees: [1, 6, 2, 5] },
        { name: 'iii-vi-ii-V', degrees: [3, 6, 2, 5] },
        { name: 'I-iii-vi-ii-V-I', degrees: [1, 3, 6, 2, 5, 1] }
    ],
    blues: [
        { name: '12-bar Blues', degrees: [1, 1, 1, 1, 4, 4, 1, 1, 5, 4, 1, 5] },
        { name: '8-bar Blues', degrees: [1, 4, 1, 5, 4, 1, 5, 1] }
    ],
    classical: [
        { name: 'Pachelbel Canon', degrees: [1, 5, 6, 3, 4, 1, 4, 5] },
        { name: 'Andalusian Cadence', degrees: [6, 5, 4, 3] }
    ]
};

const RHYTHM_PATTERNS = {
    basic_4: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    basic_8: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    syncopated: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0],
    offbeat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    house: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    trap: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
    jazz_swing: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    latin: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
    reggaeton: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]
};

// ===========================================
// AI COMPOSITION STATE
// ===========================================

let aiCompositionSettings = {
    enabled: true,
    key: 'C',
    scale: 'major',
    tempo: 120,
    complexity: 0.5, // 0-1, affects variation and density
    mood: 'neutral', // 'happy', 'sad', 'energetic', 'calm', 'neutral'
    style: 'pop', // 'pop', 'jazz', 'classical', 'electronic', 'hiphop'
    density: 0.3, // Note density 0-1
    variation: 0.2 // Variation amount 0-1
};

let suggestionHistory = [];
const MAX_HISTORY = 50;

// ===========================================
// SETTINGS MANAGEMENT
// ===========================================

export function getAICompositionSettings() {
    return JSON.parse(JSON.stringify(aiCompositionSettings));
}

export function setAICompositionSettings(settings) {
    aiCompositionSettings = { ...aiCompositionSettings, ...settings };
    console.log('[AIComposition] Settings updated');
}

export function setAIKey(key) {
    const validKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    if (validKeys.includes(key)) {
        aiCompositionSettings.key = key;
        console.log(`[AIComposition] Key set to ${key}`);
        return true;
    }
    return false;
}

export function setAIScale(scale) {
    if (SCALES[scale]) {
        aiCompositionSettings.scale = scale;
        console.log(`[AIComposition] Scale set to ${scale}`);
        return true;
    }
    return false;
}

export function setAIMood(mood) {
    const validMoods = ['happy', 'sad', 'energetic', 'calm', 'neutral', 'dark', 'bright'];
    if (validMoods.includes(mood)) {
        aiCompositionSettings.mood = mood;
        console.log(`[AIComposition] Mood set to ${mood}`);
        return true;
    }
    return false;
}

export function setAIStyle(style) {
    const validStyles = ['pop', 'jazz', 'classical', 'electronic', 'hiphop', 'rock', 'ambient'];
    if (validStyles.includes(style)) {
        aiCompositionSettings.style = style;
        console.log(`[AIComposition] Style set to ${style}`);
        return true;
    }
    return false;
}

// ===========================================
// MELODY GENERATION
// ===========================================

export function generateMelodySuggestion(options = {}) {
    const settings = { ...aiCompositionSettings, ...options };
    const bars = options.bars || 4;
    const stepsPerBar = options.stepsPerBar || 16;
    const totalSteps = bars * stepsPerBar;
    
    const scale = SCALES[settings.scale] || SCALES.major;
    const rootNote = getRootNoteNumber(settings.key);
    
    const melody = {
        notes: [],
        settings: { ...settings },
        metadata: {
            type: 'melody',
            bars,
            stepsPerBar,
            generatedAt: new Date().toISOString()
        }
    };
    
    // Generate melody based on mood and style
    const melodicContour = generateMelodicContour(bars, settings);
    const rhythmPattern = generateMelodyRhythm(bars, settings);
    
    let currentNoteIndex = Math.floor(scale.length / 2); // Start in middle of scale
    let lastNote = null;
    
    for (let step = 0; step < totalSteps; step++) {
        if (rhythmPattern[step % rhythmPattern.length]) {
            // Determine note based on contour and variation
            const contourDirection = melodicContour[Math.floor(step / stepsPerBar)];
            const variation = (Math.random() - 0.5) * settings.variation * 4;
            
            // Move up or down the scale based on contour
            if (contourDirection > 0.5) {
                currentNoteIndex = Math.min(scale.length - 1, currentNoteIndex + Math.floor(Math.random() * 2));
            } else if (contourDirection < 0.5) {
                currentNoteIndex = Math.max(0, currentNoteIndex - Math.floor(Math.random() * 2));
            }
            
            // Add some random variation
            currentNoteIndex = Math.max(0, Math.min(scale.length - 1, 
                currentNoteIndex + Math.round(variation)));
            
            const scaleDegree = scale[currentNoteIndex];
            const midiNote = rootNote + scaleDegree + 60; // Start at middle C octave
            
            // Generate velocity based on position and mood
            const velocity = generateVelocity(step, totalSteps, settings);
            
            // Generate duration
            const duration = generateNoteDuration(step, rhythmPattern, settings);
            
            melody.notes.push({
                step,
                midiNote,
                velocity,
                duration,
                scaleDegree: currentNoteIndex + 1
            });
            
            lastNote = { midiNote, step };
        }
    }
    
    addToHistory('melody', melody);
    console.log(`[AIComposition] Generated melody with ${melody.notes.length} notes`);
    return melody;
}

function generateMelodicContour(bars, settings) {
    const contour = [];
    
    for (let bar = 0; bar < bars; bar++) {
        // Mood affects contour
        let direction = 0.5;
        
        switch (settings.mood) {
            case 'happy':
            case 'bright':
                direction = 0.6 + Math.random() * 0.3; // More upward
                break;
            case 'sad':
            case 'dark':
                direction = 0.1 + Math.random() * 0.3; // More downward
                break;
            case 'energetic':
                direction = Math.random() > 0.5 ? 0.8 : 0.2; // More dramatic
                break;
            case 'calm':
                direction = 0.4 + Math.random() * 0.2; // More stable
                break;
        }
        
        contour.push(direction);
    }
    
    return contour;
}

function generateMelodyRhythm(bars, settings) {
    const rhythm = [];
    const basePattern = RHYTHM_PATTERNS.basic_8;
    
    for (let bar = 0; bar < bars; bar++) {
        for (let step = 0; step < 16; step++) {
            let hasNote = basePattern[step % basePattern.length];
            
            // Apply density
            if (hasNote && Math.random() > settings.density) {
                hasNote = false;
            } else if (!hasNote && Math.random() < settings.density * 0.3) {
                hasNote = true;
            }
            
            // Style modifications
            if (settings.style === 'jazz') {
                // Add syncopation
                if (step % 4 === 2 && Math.random() < 0.4) hasNote = true;
                if (step % 4 === 0 && Math.random() < 0.2) hasNote = false;
            } else if (settings.style === 'electronic') {
                // More regular
                if (step % 8 === 0) hasNote = true;
            }
            
            rhythm.push(hasNote ? 1 : 0);
        }
    }
    
    return rhythm;
}

function generateVelocity(step, totalSteps, settings) {
    let baseVelocity = 0.7;
    
    // Stronger on downbeats
    if (step % 16 === 0) baseVelocity = 0.9;
    else if (step % 8 === 0) baseVelocity = 0.8;
    else if (step % 4 === 0) baseVelocity = 0.75;
    
    // Mood adjustment
    if (settings.mood === 'energetic') baseVelocity += 0.1;
    if (settings.mood === 'calm') baseVelocity -= 0.1;
    
    // Add variation
    baseVelocity += (Math.random() - 0.5) * settings.variation * 0.4;
    
    return Math.max(0.3, Math.min(1, baseVelocity));
}

function generateNoteDuration(step, rhythmPattern, settings) {
    // Default to one step
    let duration = 1;
    
    // Longer notes for certain moods
    if (settings.mood === 'calm' || settings.mood === 'sad') {
        if (Math.random() < 0.4) duration = 2 + Math.floor(Math.random() * 2);
    }
    
    // Staccato for energetic
    if (settings.mood === 'energetic' && Math.random() < 0.3) {
        duration = 0.5;
    }
    
    return duration;
}

// ===========================================
// CHORD SUGGESTIONS
// ===========================================

export function generateChordProgression(options = {}) {
    const settings = { ...aiCompositionSettings, ...options };
    const bars = options.bars || 4;
    const chordsPerBar = options.chordsPerBar || 1;
    
    const scale = SCALES[settings.scale] || SCALES.major;
    const rootNote = getRootNoteNumber(settings.key);
    
    // Select progression based on style
    let progressionPool = CHORD_PROGRESSIONS.pop;
    if (settings.style === 'jazz') progressionPool = CHORD_PROGRESSIONS.jazz;
    else if (settings.style === 'blues') progressionPool = CHORD_PROGRESSIONS.blues;
    else if (settings.style === 'classical') progressionPool = CHORD_PROGRESSIONS.classical;
    
    const selectedProgression = progressionPool[Math.floor(Math.random() * progressionPool.length)];
    
    const progression = {
        chords: [],
        settings: { ...settings },
        metadata: {
            type: 'chord_progression',
            progressionName: selectedProgression.name,
            bars,
            chordsPerBar,
            generatedAt: new Date().toISOString()
        }
    };
    
    // Build chords from progression degrees
    selectedProgression.degrees.forEach((degree, index) => {
        const chord = buildChordFromDegree(degree, scale, rootNote, settings);
        chord.position = index * (16 / chordsPerBar); // Position in steps
        chord.bar = Math.floor(index / chordsPerBar);
        progression.chords.push(chord);
    });
    
    addToHistory('chord_progression', progression);
    console.log(`[AIComposition] Generated chord progression: ${selectedProgression.name}`);
    return progression;
}

function buildChordFromDegree(degree, scale, rootNote, settings) {
    // Convert degree (1-7) to scale index (0-6)
    const scaleIndex = ((degree - 1) + scale.length) % scale.length;
    const chordRoot = scale[scaleIndex];
    
    // Determine chord quality based on degree and scale
    let quality = 'major';
    const isMinorScale = settings.scale.includes('minor');
    
    // Major scale chord qualities
    if (!isMinorScale) {
        if ([1, 4, 5].includes(degree)) quality = 'major';
        else if ([2, 3, 6].includes(degree)) quality = 'minor';
        else if (degree === 7) quality = 'diminished';
    } else {
        // Minor scale chord qualities (natural minor)
        if ([1, 4, 5].includes(degree)) quality = 'minor';
        else if ([3, 6, 7].includes(degree)) quality = 'major';
        else if (degree === 2) quality = 'diminished';
    }
    
    // Mood can affect chord choices
    if (settings.mood === 'sad' || settings.mood === 'dark') {
        if (Math.random() < 0.3) quality = 'minor';
    }
    if (settings.mood === 'happy' || settings.mood === 'bright') {
        if (Math.random() < 0.3 && quality === 'minor') quality = 'major';
    }
    
    // Build the chord notes
    const notes = buildChordNotes(rootNote + chordRoot, quality);
    
    return {
        degree,
        root: degree,
        quality,
        notes,
        bassNote: notes[0]
    };
}

function buildChordNotes(root, quality) {
    const notes = [root];
    
    switch (quality) {
        case 'major':
            notes.push(root + 4, root + 7);
            break;
        case 'minor':
            notes.push(root + 3, root + 7);
            break;
        case 'diminished':
            notes.push(root + 3, root + 6);
            break;
        case 'augmented':
            notes.push(root + 4, root + 8);
            break;
        case 'sus2':
            notes.push(root + 2, root + 7);
            break;
        case 'sus4':
            notes.push(root + 5, root + 7);
            break;
        default:
            notes.push(root + 4, root + 7);
    }
    
    // Add octave (for fuller sound)
    notes.push(root + 12);
    
    return notes.map(n => n + 48); // Start in lower register
}

export function suggestNextChord(currentChord, options = {}) {
    const settings = { ...aiCompositionSettings, ...options };
    const scale = SCALES[settings.scale] || SCALES.major;
    
    // Common chord movements
    const movements = {
        1: [4, 5, 6, 2], // I typically goes to IV, V, vi, or ii
        2: [5, 3], // ii typically goes to V or iii
        3: [6, 4], // iii typically goes to vi or IV
        4: [5, 1], // IV typically goes to V or I
        5: [1, 6, 4], // V typically goes to I, vi, or IV
        6: [2, 4, 5], // vi typically goes to ii, IV, or V
        7: [1] // viidim typically goes to I
    };
    
    const currentDegree = currentChord?.degree || 1;
    const possibleNexts = movements[currentDegree] || [1];
    
    // Weight by mood
    let weights = possibleNexts.map(d => 1);
    
    if (settings.mood === 'sad' || settings.mood === 'dark') {
        // Prefer minor chords (2, 3, 6 in major)
        weights = possibleNexts.map(d => [2, 3, 6].includes(d) ? 2 : 1);
    }
    
    if (settings.mood === 'happy' || settings.mood === 'bright') {
        // Prefer major chords (1, 4, 5 in major)
        weights = possibleNexts.map(d => [1, 4, 5].includes(d) ? 2 : 1);
    }
    
    // Select weighted random
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    let selectedDegree = possibleNexts[0];
    for (let i = 0; i < possibleNexts.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            selectedDegree = possibleNexts[i];
            break;
        }
    }
    
    const rootNote = getRootNoteNumber(settings.key);
    return buildChordFromDegree(selectedDegree, scale, rootNote, settings);
}

// ===========================================
// RHYTHM SUGGESTIONS
// ===========================================

export function generateRhythmPattern(options = {}) {
    const settings = { ...aiCompositionSettings, ...options };
    const bars = options.bars || 1;
    const stepsPerBar = options.stepsPerBar || 16;
    
    // Select base pattern based on style
    let basePatternName = 'basic_8';
    
    switch (settings.style) {
        case 'electronic':
        case 'hiphop':
            basePatternName = Math.random() > 0.5 ? 'house' : 'trap';
            break;
        case 'jazz':
            basePatternName = 'jazz_swing';
            break;
        case 'pop':
            basePatternName = Math.random() > 0.5 ? 'syncopated' : 'basic_8';
            break;
        case 'rock':
            basePatternName = 'basic_4';
            break;
        case 'ambient':
            basePatternName = 'offbeat';
            break;
    }
    
    const basePattern = [...(RHYTHM_PATTERNS[basePatternName] || RHYTHM_PATTERNS.basic_8)];
    
    // Apply variation
    const variedPattern = basePattern.map((value, index) => {
        if (Math.random() < settings.variation) {
            return value === 1 ? 0 : 1;
        }
        return value;
    });
    
    // Extend to multiple bars
    const fullPattern = [];
    for (let bar = 0; bar < bars; bar++) {
        fullPattern.push(...variedPattern);
    }
    
    const rhythm = {
        pattern: fullPattern,
        basePattern: basePatternName,
        settings: { ...settings },
        metadata: {
            type: 'rhythm_pattern',
            bars,
            stepsPerBar,
            generatedAt: new Date().toISOString()
        }
    };
    
    addToHistory('rhythm', rhythm);
    console.log(`[AIComposition] Generated rhythm pattern based on ${basePatternName}`);
    return rhythm;
}

export function generateDrumPattern(options = {}) {
    const settings = { ...aiCompositionSettings, ...options };
    const bars = options.bars || 1;
    const stepsPerBar = 16;
    const totalSteps = bars * stepsPerBar;
    
    const drumPattern = {
        kick: [],
        snare: [],
        hihat: [],
        settings: { ...settings },
        metadata: {
            type: 'drum_pattern',
            bars,
            generatedAt: new Date().toISOString()
        }
    };
    
    // Generate kick pattern
    const kickBase = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
    if (settings.style === 'electronic' || settings.style === 'hiphop') {
        // Four-on-the-floor or trap-style
        if (settings.style === 'electronic') {
            drumPattern.kick = Array(bars).fill([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]).flat();
        } else {
            drumPattern.kick = Array(bars).fill([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0]).flat();
        }
    } else {
        drumPattern.kick = Array(bars).fill(kickBase).flat();
    }
    
    // Generate snare pattern
    const snareBase = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
    drumPattern.snare = Array(bars).fill(snareBase).flat();
    
    // Add ghost snares for jazz/funk
    if (settings.style === 'jazz' && Math.random() < 0.5) {
        for (let i = 0; i < totalSteps; i++) {
            if (i % 8 !== 4 && i % 8 !== 12 && Math.random() < 0.2) {
                drumPattern.snare[i] = 1;
            }
        }
    }
    
    // Generate hi-hat pattern
    const hihatBase = settings.style === 'jazz' 
        ? [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]
        : [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
    drumPattern.hihat = Array(bars).fill(hihatBase).flat();
    
    // Apply density variation
    const applyDensity = (pattern) => pattern.map(v => {
        if (v === 1 && Math.random() > settings.density) return 0;
        if (v === 0 && Math.random() < settings.density * 0.1) return 1;
        return v;
    });
    
    drumPattern.kick = applyDensity(drumPattern.kick);
    drumPattern.snare = applyDensity(drumPattern.snare);
    drumPattern.hihat = applyDensity(drumPattern.hihat);
    
    addToHistory('drum_pattern', drumPattern);
    console.log(`[AIComposition] Generated drum pattern for ${settings.style} style`);
    return drumPattern;
}

// ===========================================
// BASS LINE GENERATION
// ===========================================

export function generateBassLine(chordProgression, options = {}) {
    const settings = { ...aiCompositionSettings, ...options };
    
    if (!chordProgression || !chordProgression.chords) {
        console.warn('[AIComposition] No chord progression provided for bass line');
        return null;
    }
    
    const bassLine = {
        notes: [],
        settings: { ...settings },
        metadata: {
            type: 'bass_line',
            generatedAt: new Date().toISOString()
        }
    };
    
    const stepsPerChord = 16; // 1 bar per chord by default
    
    chordProgression.chords.forEach((chord, chordIndex) => {
        const chordStart = chordIndex * stepsPerChord;
        
        // Style-specific bass patterns
        if (settings.style === 'electronic' || settings.style === 'hiphop') {
            // Eighth note pattern
            for (let step = 0; step < stepsPerChord; step += 2) {
                const note = chord.notes[0] - 12; // Lower octave
                bassLine.notes.push({
                    step: chordStart + step,
                    midiNote: note,
                    velocity: step % 8 === 0 ? 0.9 : 0.7,
                    duration: 1
                });
            }
        } else if (settings.style === 'jazz') {
            // Walking bass
            const chordTones = chord.notes.slice(0, 3).map(n => n - 12);
            for (let step = 0; step < stepsPerChord; step += 4) {
                const noteIndex = Math.floor(step / 4) % chordTones.length;
                const note = chordTones[noteIndex];
                // Add some passing tones
                const isPassing = Math.random() < 0.2;
                const finalNote = isPassing ? note + (Math.random() > 0.5 ? 1 : -1) : note;
                
                bassLine.notes.push({
                    step: chordStart + step,
                    midiNote: Math.max(24, Math.min(60, finalNote)),
                    velocity: 0.75,
                    duration: 1
                });
            }
        } else {
            // Simple root on downbeats
            for (let step = 0; step < stepsPerChord; step += 4) {
                bassLine.notes.push({
                    step: chordStart + step,
                    midiNote: chord.notes[0] - 12,
                    velocity: 0.85,
                    duration: step % 8 === 0 ? 3 : 2
                });
            }
        }
    });
    
    addToHistory('bass_line', bassLine);
    console.log(`[AIComposition] Generated bass line with ${bassLine.notes.length} notes`);
    return bassLine;
}

// ===========================================
// COMPLETE ARRANGEMENT SUGGESTION
// ===========================================

export function generateArrangementSuggestion(options = {}) {
    const settings = { ...aiCompositionSettings, ...options };
    const bars = options.bars || 8;
    
    const arrangement = {
        melody: null,
        chords: null,
        bass: null,
        drums: null,
        settings: { ...settings },
        metadata: {
            type: 'arrangement',
            bars,
            generatedAt: new Date().toISOString()
        }
    };
    
    // Generate components in order
    arrangement.chords = generateChordProgression({ bars, ...settings });
    arrangement.melody = generateMelodySuggestion({ bars, ...settings });
    arrangement.bass = generateBassLine(arrangement.chords, settings);
    arrangement.drums = generateDrumPattern({ bars, ...settings });
    
    addToHistory('arrangement', arrangement);
    console.log(`[AIComposition] Generated complete arrangement for ${bars} bars`);
    return arrangement;
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function getRootNoteNumber(key) {
    const keyMap = {
        'C': 0, 'C#': 1, 'Db': 1,
        'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4,
        'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8,
        'A': 9, 'A#': 10, 'Bb': 10,
        'B': 11
    };
    return keyMap[key] || 0;
}

function addToHistory(type, suggestion) {
    suggestionHistory.push({
        type,
        suggestion,
        timestamp: Date.now()
    });
    
    if (suggestionHistory.length > MAX_HISTORY) {
        suggestionHistory.shift();
    }
}

export function getSuggestionHistory(limit = 20) {
    return suggestionHistory.slice(-limit);
}

export function clearSuggestionHistory() {
    suggestionHistory = [];
    console.log('[AIComposition] Cleared suggestion history');
}

// ===========================================
// SCALE AND KEY UTILITIES
// ===========================================

export function getAvailableScales() {
    return Object.keys(SCALES);
}

export function getAvailableKeys() {
    return ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
}

export function getScaleNotes(key, scale) {
    const rootNote = getRootNoteNumber(key);
    const scaleIntervals = SCALES[scale] || SCALES.major;
    return scaleIntervals.map(interval => rootNote + interval);
}

export function quantizeNoteToScale(midiNote, key, scale) {
    const scaleNotes = getScaleNotes(key, scale);
    const noteInOctave = midiNote % 12;
    
    // Find closest note in scale
    let closestNote = scaleNotes[0];
    let minDistance = Math.abs(noteInOctave - closestNote);
    
    scaleNotes.forEach(scaleNote => {
        const distance = Math.min(
            Math.abs(noteInOctave - scaleNote),
            Math.abs(noteInOctave - scaleNote + 12),
            Math.abs(noteInOctave - scaleNote - 12)
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestNote = scaleNote;
        }
    });
    
    // Return note in original octave
    const octave = Math.floor(midiNote / 12);
    return closestNote + octave * 12;
}

console.log('[AIComposition] AI-Assisted Composition module loaded');