/**
 * SmartQuantize.js
 * Intelligent quantization that preserves musical feel
 */

// Quantization modes
export const QUANTIZE_MODES = {
    GRID: 'grid',           // Hard quantize to grid
    GROOVE: 'groove',       // Apply groove template
    HUMANIZE: 'humanize',   // Add human feel
    SMART: 'smart',         // Intelligent quantization
    LEGATO: 'legato',       // Connect notes smoothly
    STACCATO: 'staccato',   // Short detached notes
    SWING: 'swing',         // Apply swing feel
    ADAPTIVE: 'adaptive'    // Adapt to existing timing
};

// Groove templates
export const GROOVE_TEMPLATES = {
    straight: {
        name: 'Straight',
        offsets: [0, 0, 0, 0, 0, 0, 0, 0],
        velocityOffsets: [0, 0, 0, 0, 0, 0, 0, 0]
    },
    lightSwing: {
        name: 'Light Swing',
        offsets: [0, 10, 0, 10, 0, 10, 0, 10], // in ticks (PPQN)
        velocityOffsets: [0, -5, 0, -5, 0, -5, 0, -5]
    },
    mediumSwing: {
        name: 'Medium Swing',
        offsets: [0, 20, 0, 20, 0, 20, 0, 20],
        velocityOffsets: [0, -10, 0, -10, 0, -10, 0, -10]
    },
    heavySwing: {
        name: 'Heavy Swing',
        offsets: [0, 30, 0, 30, 0, 30, 0, 30],
        velocityOffsets: [0, -15, 0, -15, 0, -15, 0, -15]
    },
    jazz: {
        name: 'Jazz Feel',
        offsets: [0, 25, -5, 20, 0, 25, -5, 20],
        velocityOffsets: [5, -10, 10, -5, 5, -10, 10, -5]
    },
    funk: {
        name: 'Funk',
        offsets: [0, 15, -5, 10, 0, 15, -5, 10],
        velocityOffsets: [10, -5, 15, 0, 10, -5, 15, 0]
    },
    latin: {
        name: 'Latin',
        offsets: [0, 5, 15, 5, 0, 5, 15, 5],
        velocityOffsets: [0, 10, 5, 10, 0, 10, 5, 10]
    },
    hipHop: {
        name: 'Hip Hop',
        offsets: [0, 10, -3, 15, 0, 10, -3, 15],
        velocityOffsets: [15, -10, 5, 0, 15, -10, 5, 0]
    },
    house: {
        name: 'House',
        offsets: [0, 0, 5, 0, 0, 0, 5, 0],
        velocityOffsets: [5, 0, 5, 0, 5, 0, 5, 0]
    },
    dnb: {
        name: 'Drum & Bass',
        offsets: [0, -5, 10, 5, 0, -5, 10, 5],
        velocityOffsets: [20, -15, 10, -5, 20, -15, 10, -5]
    }
};

// Smart quantization settings
let settings = {
    mode: QUANTIZE_MODES.SMART,
    strength: 1.0,          // 0-1, how much quantization to apply
    sensitivity: 0.5,       // 0-1, how sensitive to timing deviations
    preserveLegato: true,   // Keep connected notes together
    preserveOverlaps: true, // Keep overlapping notes
    preserveExpression: true, // Keep velocity variations
    minNoteLength: 0.05,    // Minimum note length in beats
    maxCorrection: 0.25,    // Maximum correction in beats
    grooveTemplate: 'straight',
    snapToGrid: '1/16',     // Grid size
    adaptThreshold: 0.1,    // Threshold for adaptive mode
    preserveChords: true,   // Keep chord notes together
    chordTolerance: 0.02,   // Tolerance for detecting chord notes
    velocityHumanize: 0,    // Humanize amount for velocity
    timingHumanize: 0,      // Humanize amount for timing
    scaleConstrained: false, // Stay within scale
    scale: null             // Scale object if constrained
};

// Analysis results
let analysisResults = {
    averageDeviation: 0,
    averageVelocity: 64,
    timingVariance: 0,
    velocityVariance: 0,
    chordDetected: false,
    grooviness: 0
};

/**
 * SmartQuantize class
 */
export class SmartQuantize {
    constructor(options = {}) {
        this.settings = { ...settings, ...options };
        this.analysisResults = { ...analysisResults };
        this.customGrooves = new Map();
        this.history = [];
        this.historyIndex = -1;
        
        console.log('[SmartQuantize] Initialized');
    }
    
    /**
     * Quantize a sequence of notes
     * @param {Array} notes - Array of note objects {time, duration, velocity, pitch}
     * @param {Object} options - Quantization options
     * @returns {Array} - Quantized notes
     */
    quantize(notes, options = {}) {
        if (!notes || notes.length === 0) return notes;
        
        const settings = { ...this.settings, ...options };
        
        // Analyze the sequence first
        this.analyze(notes);
        
        // Save to history
        this.saveToHistory(notes);
        
        // Apply quantization based on mode
        let quantizedNotes;
        switch (settings.mode) {
            case QUANTIZE_MODES.GRID:
                quantizedNotes = this.quantizeToGrid(notes, settings);
                break;
            case QUANTIZE_MODES.GROOVE:
                quantizedNotes = this.applyGroove(notes, settings);
                break;
            case QUANTIZE_MODES.HUMANIZE:
                quantizedNotes = this.humanize(notes, settings);
                break;
            case QUANTIZE_MODES.SMART:
                quantizedNotes = this.smartQuantize(notes, settings);
                break;
            case QUANTIZE_MODES.LEGATO:
                quantizedNotes = this.legatoQuantize(notes, settings);
                break;
            case QUANTIZE_MODES.STACCATO:
                quantizedNotes = this.staccatoQuantize(notes, settings);
                break;
            case QUANTIZE_MODES.SWING:
                quantizedNotes = this.swingQuantize(notes, settings);
                break;
            case QUANTIZE_MODES.ADAPTIVE:
                quantizedNotes = this.adaptiveQuantize(notes, settings);
                break;
            default:
                quantizedNotes = this.smartQuantize(notes, settings);
        }
        
        // Apply strength (blend between original and quantized)
        quantizedNotes = this.blendNotes(notes, quantizedNotes, settings.strength);
        
        console.log(`[SmartQuantize] Quantized ${notes.length} notes using ${settings.mode} mode`);
        return quantizedNotes;
    }
    
    /**
     * Analyze a sequence of notes
     */
    analyze(notes) {
        if (!notes || notes.length === 0) return;
        
        // Calculate average timing deviation from grid
        let totalDeviation = 0;
        let totalVelocity = 0;
        let timingDeviations = [];
        let velocities = [];
        
        const gridSize = this.getGridSize(this.settings.snapToGrid);
        
        notes.forEach(note => {
            const gridTime = Math.round(note.time / gridSize) * gridSize;
            const deviation = note.time - gridTime;
            timingDeviations.push(deviation);
            totalDeviation += Math.abs(deviation);
            totalVelocity += note.velocity || 64;
            velocities.push(note.velocity || 64);
        });
        
        this.analysisResults.averageDeviation = totalDeviation / notes.length;
        this.analysisResults.averageVelocity = totalVelocity / notes.length;
        
        // Calculate variance
        this.analysisResults.timingVariance = this.calculateVariance(timingDeviations);
        this.analysisResults.velocityVariance = this.calculateVariance(velocities);
        
        // Detect chords
        this.analysisResults.chordDetected = this.detectChords(notes);
        
        // Calculate grooviness (consistent timing offset pattern)
        this.analysisResults.grooviness = this.calculateGrooviness(timingDeviations);
        
        console.log('[SmartQuantize] Analysis:', this.analysisResults);
    }
    
    /**
     * Quantize to grid
     */
    quantizeToGrid(notes, settings) {
        const gridSize = this.getGridSize(settings.snapToGrid);
        
        return notes.map(note => ({
            ...note,
            time: Math.round(note.time / gridSize) * gridSize,
            duration: Math.max(settings.minNoteLength, 
                Math.round(note.duration / gridSize) * gridSize)
        }));
    }
    
    /**
     * Apply groove template
     */
    applyGroove(notes, settings) {
        const groove = GROOVE_TEMPLATES[settings.grooveTemplate] || GROOVE_TEMPLATES.straight;
        const gridSize = this.getGridSize(settings.snapToGrid);
        const ppqn = 480; // Parts per quarter note
        const tickSize = gridSize * ppqn;
        
        return notes.map(note => {
            // First quantize to grid
            const gridTime = Math.round(note.time / gridSize) * gridSize;
            
            // Calculate position within measure
            const beatPosition = (note.time % (gridSize * 4)) / gridSize;
            const gridIndex = Math.floor(beatPosition * 2) % 8; // 8 positions per measure
            
            // Apply groove offset
            const grooveOffset = (groove.offsets[gridIndex] / ppqn) * gridSize;
            
            // Apply velocity offset
            const velocityOffset = groove.velocityOffsets[gridIndex];
            
            return {
                ...note,
                time: gridTime + grooveOffset,
                velocity: Math.max(1, Math.min(127, (note.velocity || 64) + velocityOffset))
            };
        });
    }
    
    /**
     * Add human feel
     */
    humanize(notes, settings) {
        const timingRange = settings.timingHumanize / 100 * 0.1; // Max 10% of beat
        const velocityRange = settings.velocityHumanize;
        
        return notes.map(note => ({
            ...note,
            time: note.time + (Math.random() - 0.5) * 2 * timingRange,
            velocity: Math.max(1, Math.min(127, 
                (note.velocity || 64) + (Math.random() - 0.5) * 2 * velocityRange))
        }));
    }
    
    /**
     * Smart quantization
     */
    smartQuantize(notes, settings) {
        // Step 1: Identify chord groups
        const chordGroups = settings.preserveChords ? 
            this.identifyChordGroups(notes, settings.chordTolerance) : 
            notes.map((n, i) => [i]);
        
        // Step 2: Analyze timing patterns
        const timingPatterns = this.analyzeTimingPatterns(notes);
        
        // Step 3: Apply intelligent quantization
        let quantizedNotes = notes.map((note, index) => ({
            ...note,
            originalIndex: index
        }));
        
        chordGroups.forEach(group => {
            if (group.length > 1) {
                // Chord - quantize together
                const avgTime = group.reduce((sum, i) => sum + notes[i].time, 0) / group.length;
                const gridSize = this.getGridSize(settings.snapToGrid);
                const quantizedTime = Math.round(avgTime / gridSize) * gridSize;
                
                // Check if within max correction
                const correction = Math.abs(avgTime - quantizedTime);
                const applyCorrection = correction <= settings.maxCorrection;
                
                group.forEach(i => {
                    const note = quantizedNotes[i];
                    if (applyCorrection) {
                        // Move chord to grid but preserve internal timing
                        note.time = quantizedTime + (notes[i].time - avgTime);
                    }
                });
            } else {
                // Single note
                const note = quantizedNotes[group[0]];
                const gridSize = this.getGridSize(settings.snapToGrid);
                const gridTime = Math.round(note.time / gridSize) * gridSize;
                
                // Smart strength based on timing context
                const contextStrength = this.getContextStrength(notes, group[0], timingPatterns);
                const effectiveStrength = settings.strength * contextStrength;
                
                note.time = note.time + (gridTime - note.time) * effectiveStrength;
            }
        });
        
        // Step 4: Handle legato connections
        if (settings.preserveLegato) {
            quantizedNotes = this.preserveLegatoConnections(quantizedNotes);
        }
        
        // Step 5: Apply velocity preservation
        if (settings.preserveExpression) {
            quantizedNotes = this.preserveVelocityExpression(quantizedNotes, notes);
        }
        
        return quantizedNotes.map(({ originalIndex, ...note }) => note);
    }
    
    /**
     * Legato quantization
     */
    legatoQuantize(notes, settings) {
        const gridSize = this.getGridSize(settings.snapToGrid);
        let quantizedNotes = [];
        
        // Sort notes by time
        const sortedNotes = [...notes].sort((a, b) => a.time - b.time);
        
        sortedNotes.forEach((note, i) => {
            const gridTime = Math.round(note.time / gridSize) * gridSize;
            
            if (i === 0) {
                quantizedNotes.push({
                    ...note,
                    time: gridTime,
                    duration: note.duration
                });
            } else {
                const prevNote = quantizedNotes[i - 1];
                
                // Check if should connect to previous note
                if (settings.preserveLegato && 
                    note.pitch === prevNote.pitch &&
                    Math.abs(note.time - (prevNote.time + prevNote.duration)) < gridSize * 0.5) {
                    // Connect smoothly
                    quantizedNotes.push({
                        ...note,
                        time: prevNote.time + prevNote.duration,
                        duration: note.duration
                    });
                } else {
                    quantizedNotes.push({
                        ...note,
                        time: gridTime,
                        duration: note.duration
                    });
                }
            }
        });
        
        return quantizedNotes;
    }
    
    /**
     * Staccato quantization
     */
    staccatoQuantize(notes, settings) {
        const gridSize = this.getGridSize(settings.snapToGrid);
        const staccatoRatio = 0.5; // Notes are 50% of grid
        
        return notes.map(note => {
            const gridTime = Math.round(note.time / gridSize) * gridSize;
            const newDuration = gridSize * staccatoRatio;
            
            return {
                ...note,
                time: gridTime,
                duration: newDuration
            };
        });
    }
    
    /**
     * Swing quantization
     */
    swingQuantize(notes, settings) {
        const gridSize = this.getGridSize(settings.snapToGrid);
        const swingAmount = settings.swing || 0.5; // 0-1
        
        return notes.map(note => {
            const beatPosition = note.time % (gridSize * 2);
            const isOffBeat = beatPosition >= gridSize;
            
            let offset = 0;
            if (isOffBeat) {
                // Delay off-beat notes
                offset = gridSize * swingAmount * 0.5;
            }
            
            const gridTime = Math.round(note.time / gridSize) * gridSize;
            
            return {
                ...note,
                time: gridTime + offset
            };
        });
    }
    
    /**
     * Adaptive quantization
     */
    adaptiveQuantize(notes, settings) {
        const gridSize = this.getGridSize(settings.snapToGrid);
        const threshold = settings.adaptThreshold;
        
        return notes.map(note => {
            const gridTime = Math.round(note.time / gridSize) * gridSize;
            const deviation = Math.abs(note.time - gridTime);
            
            // Only quantize if deviation is significant
            if (deviation > threshold) {
                const strength = Math.min(1, deviation / (gridSize * 0.5));
                return {
                    ...note,
                    time: note.time + (gridTime - note.time) * strength
                };
            } else {
                return note;
            }
        });
    }
    
    /**
     * Helper: Get grid size in beats
     */
    getGridSize(gridString) {
        const gridMap = {
            '1/1': 4,
            '1/2': 2,
            '1/4': 1,
            '1/8': 0.5,
            '1/16': 0.25,
            '1/32': 0.125,
            '1/64': 0.0625,
            '1/128': 0.03125,
            '1/4T': 1/3,
            '1/8T': 1/6,
            '1/16T': 1/12
        };
        
        return gridMap[gridString] || 0.25;
    }
    
    /**
     * Helper: Calculate variance
     */
    calculateVariance(values) {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }
    
    /**
     * Helper: Detect chords
     */
    detectChords(notes) {
        const tolerance = this.settings.chordTolerance;
        
        for (let i = 0; i < notes.length - 1; i++) {
            for (let j = i + 1; j < notes.length; j++) {
                if (Math.abs(notes[i].time - notes[j].time) <= tolerance) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Helper: Calculate grooviness
     */
    calculateGrooviness(timingDeviations) {
        if (timingDeviations.length < 4) return 0;
        
        // Check for consistent pattern
        const mean = timingDeviations.reduce((a, b) => a + b, 0) / timingDeviations.length;
        const variance = this.calculateVariance(timingDeviations);
        
        // Low variance with non-zero mean indicates groove
        if (variance < 0.01 && Math.abs(mean) > 0.01) {
            return 1 - Math.min(1, variance * 100);
        }
        
        return 0;
    }
    
    /**
     * Helper: Identify chord groups
     */
    identifyChordGroups(notes, tolerance) {
        const groups = [];
        const used = new Set();
        
        notes.forEach((note, i) => {
            if (used.has(i)) return;
            
            const group = [i];
            used.add(i);
            
            notes.forEach((otherNote, j) => {
                if (i !== j && !used.has(j)) {
                    if (Math.abs(note.time - otherNote.time) <= tolerance) {
                        group.push(j);
                        used.add(j);
                    }
                }
            });
            
            groups.push(group);
        });
        
        return groups;
    }
    
    /**
     * Helper: Analyze timing patterns
     */
    analyzeTimingPatterns(notes) {
        const patterns = {
            consistent: false,
            averageDeviation: 0,
            maxDeviation: 0,
            rushOrDrag: 'neutral' // 'rush', 'drag', 'neutral'
        };
        
        const gridSize = this.getGridSize(this.settings.snapToGrid);
        const deviations = notes.map(note => {
            const gridTime = Math.round(note.time / gridSize) * gridSize;
            return note.time - gridTime;
        });
        
        const avgDev = deviations.reduce((a, b) => a + b, 0) / deviations.length;
        const maxDev = Math.max(...deviations.map(Math.abs));
        
        patterns.averageDeviation = avgDev;
        patterns.maxDeviation = maxDev;
        patterns.rushOrDrag = avgDev < -0.01 ? 'rush' : avgDev > 0.01 ? 'drag' : 'neutral';
        patterns.consistent = this.calculateVariance(deviations) < 0.01;
        
        return patterns;
    }
    
    /**
     * Helper: Get context strength for quantization
     */
    getContextStrength(notes, index, patterns) {
        let strength = 1.0;
        
        // Reduce strength if player has consistent timing (preserve feel)
        if (patterns.consistent) {
            strength *= 0.5;
        }
        
        // Reduce strength for rushing/dragging (preserve expression)
        if (patterns.rushOrDrag !== 'neutral') {
            strength *= 0.7;
        }
        
        // Check neighboring notes
        if (index > 0 && index < notes.length - 1) {
            const prevTime = notes[index - 1].time;
            const nextTime = notes[index + 1].time;
            const currentTime = notes[index].time;
            
            // If note is evenly spaced, reduce quantization
            const expectedTime = (prevTime + nextTime) / 2;
            if (Math.abs(currentTime - expectedTime) < 0.05) {
                strength *= 0.6;
            }
        }
        
        return strength;
    }
    
    /**
     * Helper: Preserve legato connections
     */
    preserveLegatoConnections(notes) {
        const gridSize = this.getGridSize(this.settings.snapToGrid);
        
        for (let i = 0; i < notes.length - 1; i++) {
            const current = notes[i];
            const next = notes[i + 1];
            
            // Check if connected
            if (current.pitch === next.pitch &&
                Math.abs((current.time + current.duration) - next.time) < gridSize * 0.25) {
                // Adjust next note start to current note end
                next.time = current.time + current.duration;
            }
        }
        
        return notes;
    }
    
    /**
     * Helper: Preserve velocity expression
     */
    preserveVelocityExpression(quantizedNotes, originalNotes) {
        // Preserve relative velocity relationships
        const originalVelocities = originalNotes.map(n => n.velocity || 64);
        const avgOriginal = originalVelocities.reduce((a, b) => a + b, 0) / originalVelocities.length;
        
        return quantizedNotes.map((note, i) => {
            const originalRel = (originalVelocities[i] - avgOriginal) / 64; // Relative to average
            const currentAvg = quantizedNotes.reduce((sum, n) => sum + (n.velocity || 64), 0) / quantizedNotes.length;
            
            return {
                ...note,
                velocity: Math.max(1, Math.min(127, 
                    Math.round(currentAvg + originalRel * 32)))
            };
        });
    }
    
    /**
     * Helper: Blend original and quantized notes
     */
    blendNotes(original, quantized, strength) {
        return original.map((orig, i) => {
            const quant = quantized[i];
            
            return {
                ...orig,
                time: orig.time + (quant.time - orig.time) * strength,
                duration: orig.duration + (quant.duration - orig.duration) * strength,
                velocity: Math.round(
                    orig.velocity + (quant.velocity - orig.velocity) * strength
                ) || orig.velocity
            };
        });
    }
    
    /**
     * Save to history
     */
    saveToHistory(notes) {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(JSON.parse(JSON.stringify(notes)));
        this.historyIndex = this.history.length - 1;
    }
    
    /**
     * Undo last quantization
     */
    undo() {
        if (this.historyIndex <= 0) return null;
        
        this.historyIndex--;
        return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    }
    
    /**
     * Redo quantization
     */
    redo() {
        if (this.historyIndex >= this.history.length - 1) return null;
        
        this.historyIndex++;
        return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    }
    
    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }
    
    /**
     * Get settings
     */
    getSettings() {
        return { ...this.settings };
    }
    
    /**
     * Get analysis results
     */
    getAnalysisResults() {
        return { ...this.analysisResults };
    }
    
    /**
     * Add custom groove template
     */
    addCustomGroove(name, offsets, velocityOffsets) {
        this.customGrooves.set(name, {
            name,
            offsets,
            velocityOffsets
        });
    }
    
    /**
     * Get available groove templates
     */
    getGrooveTemplates() {
        return {
            ...GROOVE_TEMPLATES,
            ...Object.fromEntries(this.customGrooves)
        };
    }
}

// Standalone functions

/**
 * Quick quantize function
 */
export function quantizeNotes(notes, mode = QUANTIZE_MODES.SMART, options = {}) {
    const quantizer = new SmartQuantize({ mode, ...options });
    return quantizer.quantize(notes);
}

/**
 * Quick analyze function
 */
export function analyzeNotes(notes) {
    const quantizer = new SmartQuantize();
    quantizer.analyze(notes);
    return quantizer.getAnalysisResults();
}

/**
 * Get groove templates
 */
export function getGrooveTemplates() {
    return { ...GROOVE_TEMPLATES };
}

/**
 * Get quantize modes
 */
export function getQuantizeModes() {
    return { ...QUANTIZE_MODES };
}

/**
 * Create quantization UI panel
 */
export function openSmartQuantizePanel(appServices = {}) {
    // Remove existing panel
    const existing = document.getElementById('smart-quantize-panel');
    if (existing) {
        existing.remove();
        return null;
    }
    
    const panel = document.createElement('div');
    panel.id = 'smart-quantize-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(26, 26, 46, 0.95);
        border: 1px solid rgba(0, 255, 136, 0.4);
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 400px;
        color: #fff;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
    header.innerHTML = `
        <h3 style="color: #00ff88; margin: 0;">Smart Quantize</h3>
        <button id="close-quantize-panel" style="background: transparent; border: 1px solid #ff4444; color: #ff4444; padding: 4px 8px; border-radius: 4px; cursor: pointer;">Close</button>
    `;
    panel.appendChild(header);
    
    // Mode selector
    const modeSection = document.createElement('div');
    modeSection.style.cssText = 'margin-bottom: 16px;';
    modeSection.innerHTML = `
        <label style="display: block; color: #888; margin-bottom: 4px;">Quantization Mode</label>
        <select id="quantize-mode" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 8px; border-radius: 4px;">
            ${Object.values(QUANTIZE_MODES).map(mode => 
                `<option value="${mode}">${mode.charAt(0).toUpperCase() + mode.slice(1)}</option>`
            ).join('')}
        </select>
    `;
    panel.appendChild(modeSection);
    
    // Grid size
    const gridSection = document.createElement('div');
    gridSection.style.cssText = 'margin-bottom: 16px;';
    gridSection.innerHTML = `
        <label style="display: block; color: #888; margin-bottom: 4px;">Grid Size</label>
        <select id="quantize-grid" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 8px; border-radius: 4px;">
            <option value="1/64">1/64</option>
            <option value="1/32">1/32</option>
            <option value="1/16" selected>1/16</option>
            <option value="1/8">1/8</option>
            <option value="1/4">1/4</option>
            <option value="1/2">1/2</option>
            <option value="1/1">1/1</option>
            <option value="1/16T">1/16 Triplet</option>
            <option value="1/8T">1/8 Triplet</option>
        </select>
    `;
    panel.appendChild(gridSection);
    
    // Strength slider
    const strengthSection = document.createElement('div');
    strengthSection.style.cssText = 'margin-bottom: 16px;';
    strengthSection.innerHTML = `
        <label style="display: block; color: #888; margin-bottom: 4px;">Strength: <span id="strength-value">100%</span></label>
        <input type="range" id="quantize-strength" min="0" max="1" step="0.01" value="1" style="width: 100%;">
    `;
    panel.appendChild(strengthSection);
    
    // Groove template
    const grooveSection = document.createElement('div');
    grooveSection.style.cssText = 'margin-bottom: 16px;';
    grooveSection.innerHTML = `
        <label style="display: block; color: #888; margin-bottom: 4px;">Groove Template</label>
        <select id="quantize-groove" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 8px; border-radius: 4px;">
            ${Object.keys(GROOVE_TEMPLATES).map(key => 
                `<option value="${key}">${GROOVE_TEMPLATES[key].name}</option>`
            ).join('')}
        </select>
    `;
    panel.appendChild(grooveSection);
    
    // Options
    const optionsSection = document.createElement('div');
    optionsSection.style.cssText = 'margin-bottom: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;';
    optionsSection.innerHTML = `
        <label style="display: flex; align-items: center; gap: 8px; color: #fff;">
            <input type="checkbox" id="quantize-preserve-legato" checked>
            Preserve Legato
        </label>
        <label style="display: flex; align-items: center; gap: 8px; color: #fff;">
            <input type="checkbox" id="quantize-preserve-chords" checked>
            Preserve Chords
        </label>
        <label style="display: flex; align-items: center; gap: 8px; color: #fff;">
            <input type="checkbox" id="quantize-preserve-expression" checked>
            Preserve Expression
        </label>
        <label style="display: flex; align-items: center; gap: 8px; color: #fff;">
            <input type="checkbox" id="quantize-preserve-overlaps" checked>
            Preserve Overlaps
        </label>
    `;
    panel.appendChild(optionsSection);
    
    // Humanize
    const humanizeSection = document.createElement('div');
    humanizeSection.style.cssText = 'margin-bottom: 16px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;';
    humanizeSection.innerHTML = `
        <div>
            <label style="display: block; color: #888; margin-bottom: 4px;">Timing Humanize</label>
            <input type="range" id="quantize-timing-humanize" min="0" max="20" value="0" style="width: 100%;">
        </div>
        <div>
            <label style="display: block; color: #888; margin-bottom: 4px;">Velocity Humanize</label>
            <input type="range" id="quantize-velocity-humanize" min="0" max="20" value="0" style="width: 100%;">
        </div>
    `;
    panel.appendChild(humanizeSection);
    
    // Apply button
    const applySection = document.createElement('div');
    applySection.style.cssText = 'display: flex; gap: 8px;';
    applySection.innerHTML = `
        <button id="quantize-apply" style="flex: 1; background: #00aa66; border: none; color: #fff; padding: 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">
            Apply Quantize
        </button>
        <button id="quantize-preview" style="flex: 1; background: #333; border: 1px solid #444; color: #fff; padding: 12px; border-radius: 4px; cursor: pointer;">
            Preview
        </button>
    `;
    panel.appendChild(applySection);
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-quantize-panel').addEventListener('click', () => {
        panel.remove();
    });
    
    document.getElementById('quantize-strength').addEventListener('input', (e) => {
        document.getElementById('strength-value').textContent = `${Math.round(e.target.value * 100)}%`;
    });
    
    document.getElementById('quantize-apply').addEventListener('click', () => {
        const options = getPanelOptions();
        if (appServices.getSelectedNotes) {
            const notes = appServices.getSelectedNotes();
            const quantized = quantizeNotes(notes, options.mode, options);
            if (appServices.updateNotes) {
                appServices.updateNotes(quantized);
            }
        }
    });
    
    document.getElementById('quantize-preview').addEventListener('click', () => {
        const options = getPanelOptions();
        if (appServices.getSelectedNotes && appServices.previewNotes) {
            const notes = appServices.getSelectedNotes();
            const quantized = quantizeNotes(notes, options.mode, options);
            appServices.previewNotes(quantized);
        }
    });
    
    function getPanelOptions() {
        return {
            mode: document.getElementById('quantize-mode').value,
            snapToGrid: document.getElementById('quantize-grid').value,
            strength: parseFloat(document.getElementById('quantize-strength').value),
            grooveTemplate: document.getElementById('quantize-groove').value,
            preserveLegato: document.getElementById('quantize-preserve-legato').checked,
            preserveChords: document.getElementById('quantize-preserve-chords').checked,
            preserveExpression: document.getElementById('quantize-preserve-expression').checked,
            preserveOverlaps: document.getElementById('quantize-preserve-overlaps').checked,
            timingHumanize: parseInt(document.getElementById('quantize-timing-humanize').value),
            velocityHumanize: parseInt(document.getElementById('quantize-velocity-humanize').value)
        };
    }
    
    return panel;
}

console.log('[SmartQuantize] Module loaded');