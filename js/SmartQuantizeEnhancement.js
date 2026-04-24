/**
 * Smart Quantize Enhancement - Advanced intelligent quantization algorithms
 * Provides more sophisticated quantization that preserves musical feel
 */

// Smart Quantize Enhancement State
const smartQuantizeEnhanceState = {
    enabled: false,
    mode: 'adaptive', // adaptive, groove-aware, phrase-based, style-specific
    strength: 0.8,
    preserveLegato: true,
    preserveChordVoicing: true,
    preserveMelodyContour: true,
    adaptiveThreshold: 30, // ms
    grooveTemplate: null,
    phraseDetection: true,
    stylePreset: 'default',
    
    // Advanced parameters
    velocityPreservation: 0.7,
    timingHumanization: 0.1,
    microTiming: true,
    swingAmount: 0,
    syncopation: 'preserve', // preserve, reduce, enhance
    
    // Analysis results
    lastAnalysis: null,
    
    // Custom templates
    customTemplates: new Map()
};

// Built-in style presets for quantization
const QUANTIZE_STYLE_PRESETS = {
    'default': {
        name: 'Default',
        description: 'Standard quantization',
        strength: 0.8,
        velocityPreservation: 0.5,
        timingHumanization: 0,
        swingAmount: 0,
        syncopation: 'preserve'
    },
    'classical': {
        name: 'Classical',
        description: 'Precise timing for classical performance',
        strength: 0.9,
        velocityPreservation: 0.8,
        timingHumanization: 0.05,
        swingAmount: 0,
        syncopation: 'reduce'
    },
    'jazz': {
        name: 'Jazz',
        description: 'Laid-back feel with swing',
        strength: 0.7,
        velocityPreservation: 0.6,
        timingHumanization: 0.15,
        swingAmount: 0.55,
        syncopation: 'enhance'
    },
    'hip-hop': {
        name: 'Hip-Hop',
        description: 'Grid-aligned with subtle groove',
        strength: 0.85,
        velocityPreservation: 0.5,
        timingHumanization: 0.08,
        swingAmount: 0.25,
        syncopation: 'preserve'
    },
    'electronic': {
        name: 'Electronic',
        description: 'Tight grid quantization',
        strength: 0.95,
        velocityPreservation: 0.3,
        timingHumanization: 0,
        swingAmount: 0,
        syncopation: 'reduce'
    },
    'funk': {
        name: 'Funk',
        description: 'Heavy swing with laid-back feel',
        strength: 0.75,
        velocityPreservation: 0.7,
        timingHumanization: 0.12,
        swingAmount: 0.65,
        syncopation: 'enhance'
    },
    'rock': {
        name: 'Rock',
        description: 'Solid timing with human feel',
        strength: 0.8,
        velocityPreservation: 0.5,
        timingHumanization: 0.1,
        swingAmount: 0.1,
        syncopation: 'preserve'
    },
    'latin': {
        name: 'Latin',
        description: 'Clave-based groove',
        strength: 0.7,
        velocityPreservation: 0.65,
        timingHumanization: 0.15,
        swingAmount: 0.3,
        syncopation: 'enhance'
    },
    'orchestral': {
        name: 'Orchestral',
        description: 'Expressive timing with phrase awareness',
        strength: 0.6,
        velocityPreservation: 0.9,
        timingHumanization: 0.2,
        swingAmount: 0,
        syncopation: 'preserve'
    },
    'drum-and-bass': {
        name: 'Drum & Bass',
        description: 'Tight breaks with ghost notes',
        strength: 0.85,
        velocityPreservation: 0.4,
        timingHumanization: 0.05,
        swingAmount: 0.2,
        syncopation: 'enhance'
    }
};

// Quantization modes with algorithms
const QUANTIZE_ALGORITHMS = {
    // Adaptive: Context-aware quantization that adjusts based on timing deviation
    adaptive: {
        name: 'Adaptive',
        description: 'Context-aware quantization based on timing patterns',
        quantize: function(notes, gridSize, state) {
            const results = [];
            const analysis = analyzeTimingPatterns(notes);
            
            for (const note of notes) {
                const deviation = calculateDeviation(note.time, gridSize);
                const localContext = getLocalContext(notes, note, analysis);
                
                // Adjust strength based on context
                let localStrength = state.strength;
                
                // Reduce strength for expressive passages
                if (analysis.isMelodicLine && localContext.isPhrasePeak) {
                    localStrength *= 0.7;
                }
                
                // Increase strength for rhythmic parts
                if (analysis.isRhythmic && !localContext.isGhostNote) {
                    localStrength *= 1.1;
                }
                
                // Apply quantization
                const quantizedTime = applyQuantization(
                    note.time, 
                    gridSize, 
                    localStrength,
                    state.timingHumanization
                );
                
                results.push({
                    ...note,
                    time: quantizedTime,
                    velocity: preserveVelocity(note.velocity, state.velocityPreservation, analysis)
                });
            }
            
            return results;
        }
    },
    
    // Groove-aware: Preserves and enhances existing groove
    grooveAware: {
        name: 'Groove Aware',
        description: 'Preserves and enhances the natural groove of performance',
        quantize: function(notes, gridSize, state) {
            const results = [];
            const grooveAnalysis = analyzeGroove(notes, gridSize);
            
            // Build groove template from performance
            const grooveTemplate = buildGrooveTemplate(grooveAnalysis, gridSize);
            
            for (const note of notes) {
                const gridPosition = Math.round(note.time / gridSize) * gridSize;
                const grooveOffset = grooveTemplate.get(gridPosition % (gridSize * 4)) || 0;
                
                // Apply quantization with groove preservation
                const targetTime = gridPosition + grooveOffset;
                const quantizedTime = note.time + (targetTime - note.time) * state.strength;
                
                results.push({
                    ...note,
                    time: quantizedTime,
                    velocity: preserveVelocity(note.velocity, state.velocityPreservation, grooveAnalysis)
                });
            }
            
            return results;
        }
    },
    
    // Phrase-based: Detects phrases and applies context-aware quantization
    phraseBased: {
        name: 'Phrase Based',
        description: 'Detects musical phrases and quantizes accordingly',
        quantize: function(notes, gridSize, state) {
            const results = [];
            const phrases = detectPhrases(notes, gridSize);
            
            for (const phrase of phrases) {
                const phraseNotes = notes.filter(n => 
                    n.time >= phrase.start && n.time < phrase.end
                );
                
                // Apply different quantization per phrase section
                for (let i = 0; i < phraseNotes.length; i++) {
                    const note = phraseNotes[i];
                    const position = (note.time - phrase.start) / (phrase.end - phrase.start);
                    
                    // Phrase-aware strength
                    let phraseStrength = state.strength;
                    
                    // Start of phrase: more precise
                    if (position < 0.1) {
                        phraseStrength = Math.min(1.0, state.strength * 1.2);
                    }
                    // Middle of phrase: moderate
                    else if (position < 0.7) {
                        phraseStrength = state.strength * 0.9;
                    }
                    // End of phrase: preserve expression
                    else {
                        phraseStrength = state.strength * 0.7;
                    }
                    
                    const quantizedTime = applyQuantization(
                        note.time,
                        gridSize,
                        phraseStrength,
                        state.timingHumanization
                    );
                    
                    results.push({
                        ...note,
                        time: quantizedTime,
                        velocity: preserveVelocity(note.velocity, state.velocityPreservation, null)
                    });
                }
            }
            
            return results;
        }
    },
    
    // Style-specific: Applies genre-specific quantization rules
    styleSpecific: {
        name: 'Style Specific',
        description: 'Applies genre-specific quantization rules',
        quantize: function(notes, gridSize, state) {
            const preset = QUANTIZE_STYLE_PRESETS[state.stylePreset] || QUANTIZE_STYLE_PRESETS.default;
            const results = [];
            
            // Apply swing if configured
            const swingGrid = applySwingToGrid(gridSize, preset.swingAmount);
            
            for (const note of notes) {
                // Find nearest swung grid position
                let targetTime = findNearestSwungGrid(note.time, swingGrid, gridSize);
                
                // Apply strength
                const quantizedTime = note.time + (targetTime - note.time) * preset.strength;
                
                // Apply humanization
                const humanizedTime = quantizedTime + 
                    (Math.random() - 0.5) * preset.timingHumanization * gridSize;
                
                results.push({
                    ...note,
                    time: humanizedTime,
                    velocity: preserveVelocity(note.velocity, preset.velocityPreservation, null)
                });
            }
            
            // Handle syncopation
            return handleSyncopation(results, preset.syncopation, gridSize);
        }
    }
};

// Helper functions

function analyzeTimingPatterns(notes) {
    const analysis = {
        isMelodicLine: false,
        isRhythmic: false,
        avgInterval: 0,
        velocityVariance: 0,
        timingVariance: 0,
        isMonophonic: false
    };
    
    if (notes.length < 2) return analysis;
    
    // Calculate intervals
    const intervals = [];
    const velocities = [];
    const times = notes.map(n => n.time).sort((a, b) => a - b);
    
    for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
    }
    
    for (const note of notes) {
        velocities.push(note.velocity);
    }
    
    // Analyze patterns
    analysis.avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    analysis.velocityVariance = calculateVariance(velocities);
    analysis.timingVariance = calculateVariance(intervals);
    
    // Determine if melodic or rhythmic
    analysis.isMelodicLine = analysis.avgInterval > 100 && 
                             notes.some(n => n.duration > 100);
    analysis.isRhythmic = analysis.avgInterval < 200 && 
                          analysis.timingVariance < 50;
    
    // Check monophonic
    analysis.isMonophonic = !hasOverlappingNotes(notes);
    
    return analysis;
}

function calculateDeviation(time, gridSize) {
    const gridPosition = time / gridSize;
    const nearestGrid = Math.round(gridPosition);
    return (gridPosition - nearestGrid) * gridSize;
}

function getLocalContext(notes, targetNote, analysis) {
    const context = {
        isPhrasePeak: false,
        isGhostNote: false,
        neighbors: [],
        phrasePosition: 0
    };
    
    // Find nearby notes
    const window = 500; // ms
    context.neighbors = notes.filter(n => 
        n !== targetNote && 
        Math.abs(n.time - targetNote.time) < window
    );
    
    // Check if ghost note (low velocity with louder neighbors)
    if (targetNote.velocity < 40) {
        const louderNeighbors = context.neighbors.filter(n => n.velocity > targetNote.velocity + 30);
        if (louderNeighbors.length > 0) {
            context.isGhostNote = true;
        }
    }
    
    // Check if phrase peak
    if (analysis.isMelodicLine) {
        const sortedByPitch = [...context.neighbors, targetNote].sort((a, b) => 
            (a.midiNote || 60) - (b.midiNote || 60)
        );
        if (sortedByPitch[sortedByPitch.length - 1] === targetNote) {
            context.isPhrasePeak = true;
        }
    }
    
    return context;
}

function applyQuantization(time, gridSize, strength, humanization) {
    const nearestGrid = Math.round(time / gridSize) * gridSize;
    const quantized = time + (nearestGrid - time) * strength;
    
    // Add humanization
    if (humanization > 0) {
        const offset = (Math.random() - 0.5) * humanization * gridSize;
        return quantized + offset;
    }
    
    return quantized;
}

function preserveVelocity(velocity, preservation, analysis) {
    if (preservation <= 0) return velocity;
    
    // Add subtle randomization to preserved velocities
    const randomization = (Math.random() - 0.5) * 10 * (1 - preservation);
    return Math.max(1, Math.min(127, velocity + randomization));
}

function analyzeGroove(notes, gridSize) {
    const grooveAnalysis = {
        avgSwing: 0,
        laidBack: 0,
        rush: 0,
        pattern: new Map()
    };
    
    // Analyze timing offsets at each grid position
    const barLength = gridSize * 4;
    
    for (const note of notes) {
        const position = note.time % barLength;
        const nearestGrid = Math.round(position / gridSize) * gridSize;
        const offset = position - nearestGrid;
        
        // Track offset by grid position
        const key = nearestGrid;
        if (!grooveAnalysis.pattern.has(key)) {
            grooveAnalysis.pattern.set(key, []);
        }
        grooveAnalysis.pattern.get(key).push(offset);
    }
    
    // Calculate average offsets
    for (const [key, offsets] of grooveAnalysis.pattern) {
        const avg = offsets.reduce((a, b) => a + b, 0) / offsets.length;
        grooveAnalysis.pattern.set(key, avg);
        
        // Track overall laid-back/rush feel
        if (avg > 5) grooveAnalysis.laidBack++;
        else if (avg < -5) grooveAnalysis.rush++;
    }
    
    return grooveAnalysis;
}

function buildGrooveTemplate(grooveAnalysis, gridSize) {
    return grooveAnalysis.pattern;
}

function detectPhrases(notes, gridSize) {
    const phrases = [];
    
    if (notes.length === 0) return phrases;
    
    // Sort notes by time
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    
    // Detect phrase boundaries by gaps and musical features
    let phraseStart = sorted[0].time;
    let lastNoteEnd = sorted[0].time + (sorted[0].duration || 100);
    const minPhraseLength = gridSize * 4; // At least one bar
    const gapThreshold = gridSize * 2; // Gap indicates phrase boundary
    
    for (let i = 1; i < sorted.length; i++) {
        const note = sorted[i];
        const gap = note.time - lastNoteEnd;
        
        if (gap > gapThreshold) {
            // Phrase boundary detected
            if (note.time - phraseStart >= minPhraseLength) {
                phrases.push({
                    start: phraseStart,
                    end: note.time,
                    type: detectPhraseType(sorted.filter(n => 
                        n.time >= phraseStart && n.time < note.time
                    ))
                });
            }
            phraseStart = note.time;
        }
        
        lastNoteEnd = note.time + (note.duration || 100);
    }
    
    // Add final phrase
    if (lastNoteEnd - phraseStart >= minPhraseLength) {
        phrases.push({
            start: phraseStart,
            end: lastNoteEnd,
            type: detectPhraseType(sorted.filter(n => 
                n.time >= phraseStart
            ))
        });
    }
    
    return phrases;
}

function detectPhraseType(phraseNotes) {
    if (phraseNotes.length === 0) return 'unknown';
    
    const velocities = phraseNotes.map(n => n.velocity);
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    
    // Check for crescendo/decrescendo
    const velocityTrend = calculateTrend(velocities);
    
    if (velocityTrend > 0.3) return 'crescendo';
    if (velocityTrend < -0.3) return 'decrescendo';
    
    // Check for staccato/legato
    const durations = phraseNotes.map(n => n.duration || 100);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const avgInterval = phraseNotes.length > 1 ? 
        (phraseNotes[phraseNotes.length - 1].time - phraseNotes[0].time) / (phraseNotes.length - 1) : 100;
    
    if (avgDuration < avgInterval * 0.5) return 'staccato';
    if (avgDuration > avgInterval * 0.9) return 'legato';
    
    return 'neutral';
}

function calculateTrend(values) {
    if (values.length < 2) return 0;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = values.length;
    
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function calculateVariance(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}

function hasOverlappingNotes(notes) {
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    
    for (let i = 1; i < sorted.length; i++) {
        const prevEnd = sorted[i - 1].time + (sorted[i - 1].duration || 100);
        if (sorted[i].time < prevEnd) {
            return true;
        }
    }
    
    return false;
}

function applySwingToGrid(gridSize, swingAmount) {
    // Swing affects off-beats (the "and" of each beat)
    const swungGrid = [];
    const barLength = gridSize * 4;
    
    for (let t = 0; t < barLength; t += gridSize) {
        const position = t / gridSize;
        
        // Apply swing to off-beats (odd positions)
        if (position % 2 === 1) {
            const swingOffset = gridSize * swingAmount * 0.5;
            swungGrid.push({ original: t, swung: t + swingOffset });
        } else {
            swungGrid.push({ original: t, swung: t });
        }
    }
    
    return swungGrid;
}

function findNearestSwungGrid(time, swingGrid, gridSize) {
    const barLength = gridSize * 4;
    const positionInBar = time % barLength;
    
    let nearestTime = time;
    let minDiff = Infinity;
    
    for (const grid of swingGrid) {
        const diff = Math.abs(positionInBar - grid.swung);
        if (diff < minDiff) {
            minDiff = diff;
            nearestTime = Math.floor(time / barLength) * barLength + grid.swung;
        }
    }
    
    return nearestTime;
}

function handleSyncopation(notes, mode, gridSize) {
    if (mode === 'preserve') return notes;
    
    const results = [];
    
    for (const note of notes) {
        const isSyncopated = isNoteSyncopated(note, gridSize);
        
        if (mode === 'reduce' && isSyncopated) {
            // Move syncopated notes closer to grid
            const nearestGrid = Math.round(note.time / gridSize) * gridSize;
            results.push({
                ...note,
                time: note.time + (nearestGrid - note.time) * 0.5
            });
        } else if (mode === 'enhance' && !isSyncopated) {
            // Add subtle syncopation to on-beat notes
            const syncopationOffset = gridSize * 0.1 * (Math.random() > 0.5 ? 1 : -1);
            results.push({
                ...note,
                time: note.time + syncopationOffset
            });
        } else {
            results.push(note);
        }
    }
    
    return results;
}

function isNoteSyncopated(note, gridSize) {
    const position = note.time % (gridSize * 4);
    const nearestBeat = Math.round(position / gridSize) * gridSize;
    const offset = Math.abs(position - nearestBeat);
    
    return offset > gridSize * 0.25;
}

// Main quantization function
function smartQuantizeEnhance(notes, options = {}) {
    const state = {
        ...smartQuantizeEnhanceState,
        ...options
    };
    
    const gridSize = options.gridSize || 120; // Default 120ms (16th note at 125 BPM)
    const algorithm = QUANTIZE_ALGORITHMS[state.mode];
    
    if (!algorithm) {
        console.warn(`Unknown quantization mode: ${state.mode}, using adaptive`);
        return QUANTIZE_ALGORITHMS.adaptive.quantize(notes, gridSize, state);
    }
    
    // Store analysis for reference
    state.lastAnalysis = analyzeTimingPatterns(notes);
    
    return algorithm.quantize(notes, gridSize, state);
}

// Apply style preset
function applyQuantizeStylePreset(presetName) {
    const preset = QUANTIZE_STYLE_PRESETS[presetName];
    if (preset) {
        Object.assign(smartQuantizeEnhanceState, preset);
        smartQuantizeEnhanceState.stylePreset = presetName;
    }
}

// Get available presets
function getQuantizeStylePresets() {
    return Object.entries(QUANTIZE_STYLE_PRESETS).map(([key, preset]) => ({
        id: key,
        name: preset.name,
        description: preset.description
    }));
}

// Get available modes
function getQuantizeModes() {
    return Object.entries(QUANTIZE_ALGORITHMS).map(([key, algo]) => ({
        id: key,
        name: algo.name,
        description: algo.description
    }));
}

// Create custom template
function createCustomQuantizeTemplate(name, settings) {
    smartQuantizeEnhanceState.customTemplates.set(name, {
        name,
        ...settings,
        createdAt: Date.now()
    });
}

// Export functions
window.smartQuantizeEnhance = smartQuantizeEnhance;
window.applyQuantizeStylePreset = applyQuantizeStylePreset;
window.getQuantizeStylePresets = getQuantizeStylePresets;
window.getQuantizeModes = getQuantizeModes;
window.createCustomQuantizeTemplate = createCustomQuantizeTemplate;
window.smartQuantizeEnhanceState = smartQuantizeEnhanceState;

console.log('[SmartQuantizeEnhancement] Module loaded');