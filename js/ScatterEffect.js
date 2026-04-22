// js/ScatterEffect.js - Scatter/Chaos Effect for SnugOS DAW
// Randomizes note timing, velocity, and presence for experimental patterns

import * as Constants from './constants.js';

/**
 * ScatterEffect - Applies chaos/randomization to MIDI note events
 * Can randomize timing, velocity, add probability gates, and shuffle note order
 */
export class ScatterEffect {
    constructor(config = {}) {
        // Enable/disable
        this.enabled = config.enabled !== undefined ? config.enabled : true;
        
        // Timing randomization (in ms)
        this.timingAmount = config.timingAmount ?? 50; // ±50ms default
        this.timingCurve = config.timingCurve || 'gaussian'; // 'gaussian', 'uniform', 'swing'
        
        // Velocity randomization (0-1 multiplier)
        this.velocityAmount = config.velocityAmount ?? 0.3; // ±30% default
        this.velocityMin = config.velocityMin ?? 0.1; // Minimum velocity cap
        
        // Note probability (0-1, chance each note plays)
        this.noteProbability = config.noteProbability ?? 1.0; // 100% default (disabled)
        
        // Note shuffling
        this.shuffleNotes = config.shuffleNotes ?? false;
        
        // Octave spread (random octave shifting)
        this.octaveSpread = config.octaveSpread ?? 0; // 0 = off, 1-3 = range
        
        // Pitch randomization
        this.pitchRandomSemitones = config.pitchRandomSemitones ?? 0;
        
        // Duration randomization
        this.durationAmount = config.durationAmount ?? 0; // 0-1 (percentage of original)
        
        // Pattern mode - applies chaos in different ways
        this.mode = config.mode || 'chaos'; // 'chaos', 'jungle', 'glitch', 'humanize'
        
        // Per-note randomization settings
        this.individualTiming = config.individualTiming ?? true;
        this.individualVelocity = config.individualVelocity ?? true;
        
        // Internal state
        this._lastSeed = null;
        this._seedCounter = 0;
    }
    
    /**
     * Set the effect mode
     * 'chaos' - full randomization
     * 'jungle' - swing-like timing with velocity variation
     * 'glitch' - aggressive timing with note dropping
     * 'humanize' - subtle humanization
     */
    setMode(mode) {
        const presets = {
            chaos: { timingAmount: 100, velocityAmount: 0.5, noteProbability: 0.8, shuffleNotes: true, pitchRandomSemitones: 5 },
            jungle: { timingAmount: 80, velocityAmount: 0.4, noteProbability: 0.95, shuffleNotes: false, pitchRandomSemitones: 0 },
            glitch: { timingAmount: 200, velocityAmount: 0.7, noteProbability: 0.6, shuffleNotes: true, pitchRandomSemitones: 12 },
            humanize: { timingAmount: 15, velocityAmount: 0.15, noteProbability: 0.98, shuffleNotes: false, pitchRandomSemitones: 0 }
        };
        
        if (presets[mode]) {
            Object.assign(this, presets[mode]);
            this.mode = mode;
            console.log(`[ScatterEffect] Mode set to: ${mode}`);
        }
    }
    
    /**
     * Process a single note event
     * Returns modified note data or null if note should be dropped
     */
    processNote(noteData, time = null) {
        if (!this.enabled) return noteData;
        
        // Clone the note data
        const result = { ...noteData };
        
        // Probability gate
        if (this.noteProbability < 1 && Math.random() > this.noteProbability) {
            return null; // Drop the note
        }
        
        // Timing randomization
        if (this.timingAmount > 0 && this.individualTiming) {
            result.timeOffset = this._getRandomTiming();
        }
        
        // Velocity randomization
        if (this.velocityAmount > 0 && this.individualVelocity && result.velocity !== undefined) {
            result.velocity = this._randomizeVelocity(result.velocity);
        }
        
        // Octave spread
        if (this.octaveSpread > 0) {
            const octaveShift = Math.floor(Math.random() * (this.octaveSpread * 2 + 1)) - this.octaveSpread;
            if (result.note !== undefined) {
                result.originalNote = result.note;
                result.note += octaveShift * 12;
                result.note = Math.max(0, Math.min(127, result.note));
            }
        }
        
        // Pitch randomization
        if (this.pitchRandomSemitones > 0) {
            const pitchShift = Math.floor(this._randomRange(-this.pitchRandomSemitones, this.pitchRandomSemitones));
            if (result.note !== undefined) {
                result.note += pitchShift;
                result.note = Math.max(0, Math.min(127, result.note));
            }
        }
        
        // Duration randomization
        if (this.durationAmount > 0 && result.duration !== undefined) {
            const durMult = 1 + this._randomRange(-this.durationAmount, this.durationAmount);
            result.duration *= durMult;
            result.duration = Math.max(0.01, result.duration);
        }
        
        return result;
    }
    
    /**
     * Process a batch of notes (for sequences)
     * Returns new array with randomization applied
     */
    processNotes(notes) {
        if (!this.enabled) return notes;
        
        let processed = notes.map(note => this.processNote(note));
        
        // Remove dropped notes (null)
        processed = processed.filter(n => n !== null);
        
        // Shuffle notes if enabled
        if (this.shuffleNotes) {
            processed = this._shuffleArray(processed);
        }
        
        return processed;
    }
    
    /**
     * Get timing offset based on mode
     */
    _getRandomTiming() {
        const amount = this.timingAmount;
        
        switch (this.timingCurve) {
            case 'gaussian':
                // Box-Muller transform for Gaussian distribution
                const u1 = Math.random();
                const u2 = Math.random();
                const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                return z * (amount / 3); // 3 std devs ≈ amount
                
            case 'swing':
                // Swing-like: delays even notes more
                const swing = Math.random() * amount;
                return this._seedCounter % 2 === 0 ? -swing * 0.5 : swing;
                
            case 'uniform':
            default:
                return this._randomRange(-amount, amount);
        }
    }
    
    /**
     * Randomize velocity
     */
    _randomizeVelocity(originalVelocity) {
        const amount = this.velocityAmount;
        const variation = this._randomRange(-amount, amount);
        let newVelocity = originalVelocity * (1 + variation);
        
        // Apply minimum cap
        newVelocity = Math.max(this.velocityMin, Math.min(1, newVelocity));
        
        return Math.round(newVelocity * 127) / 127;
    }
    
    /**
     * Random range helper
     */
    _randomRange(min, max) {
        return min + Math.random() * (max - min);
    }
    
    /**
     * Fisher-Yates shuffle
     */
    _shuffleArray(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    
    /**
     * Apply scatter effect to a track's sequence
     */
    applyToSequence(sequence) {
        if (!sequence || !sequence.notes) return sequence;
        
        const newNotes = this.processNotes(sequence.notes.map(n => ({
            note: n.note,
            time: n.time,
            duration: n.duration,
            velocity: n.velocity || 1,
            probability: n.probability
        })));
        
        return {
            ...sequence,
            notes: newNotes
        };
    }
    
    /**
     * Create a visual representation of the scatter effect
     */
    getScatterVisualization(width = 200, height = 100) {
        const points = [];
        const samples = 100;
        
        for (let i = 0; i < samples; i++) {
            const x = (i / samples) * width;
            let y;
            
            switch (this.timingCurve) {
                case 'gaussian':
                    // Gaussian distribution visualization
                    const z = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
                    y = height / 2 + z * (height / 3);
                    break;
                case 'swing':
                    y = i % 2 === 0 ? height * 0.7 : height * 0.3;
                    y += this._randomRange(-height * 0.1, height * 0.1);
                    break;
                default:
                    y = this._randomRange(height * 0.2, height * 0.8);
            }
            
            points.push({ x, y: Math.max(5, Math.min(height - 5, y)) });
        }
        
        return points;
    }
    
    /**
     * Export settings for serialization
     */
    toJSON() {
        return {
            enabled: this.enabled,
            timingAmount: this.timingAmount,
            timingCurve: this.timingCurve,
            velocityAmount: this.velocityAmount,
            velocityMin: this.velocityMin,
            noteProbability: this.noteProbability,
            shuffleNotes: this.shuffleNotes,
            octaveSpread: this.octaveSpread,
            pitchRandomSemitones: this.pitchRandomSemitones,
            durationAmount: this.durationAmount,
            mode: this.mode,
            individualTiming: this.individualTiming,
            individualVelocity: this.individualVelocity
        };
    }
    
    /**
     * Import settings from JSON
     */
    static fromJSON(json) {
        return new ScatterEffect(json);
    }
}

/**
 * ScatterEffectProcessor - AudioWorklet processor for real-time scatter
 * This can be used in the audio chain for immediate effect
 */
export class ScatterEffectProcessor {
    constructor() {
        this.enabled = true;
        this.notesInFlight = [];
        this.lastProcessTime = 0;
    }
    
    /**
     * Process scatter on incoming MIDI-like events
     */
    processEvents(events) {
        if (!this.enabled) return events;
        
        return events.map(event => {
            if (event.type === 'noteOn' || event.type === 'noteOff') {
                return this._processMidiEvent(event);
            }
            return event;
        });
    }
    
    _processMidiEvent(event) {
        const result = { ...event };
        
        if (event.type === 'noteOn' && Math.random() > this.noteProbability) {
            return null; // Drop
        }
        
        // Timing offset
        if (this.timingAmount > 0) {
            result.timeOffset = this._randomRange(-this.timingAmount, this.timingAmount);
        }
        
        return result;
    }
}

/**
 * Helper function to add scatter effect to a track
 */
export function createScatterEffect(config = {}) {
    return new ScatterEffect(config);
}

/**
 * Apply scatter preset
 */
export function applyScatterPreset(effect, presetName) {
    const presets = {
        subtle: { timingAmount: 10, velocityAmount: 0.1, noteProbability: 1.0 },
        medium: { timingAmount: 40, velocityAmount: 0.3, noteProbability: 0.95 },
        extreme: { timingAmount: 150, velocityAmount: 0.6, noteProbability: 0.7 },
        glitch: { timingAmount: 200, velocityAmount: 0.8, noteProbability: 0.5, shuffleNotes: true },
        jungle: { timingAmount: 80, velocityAmount: 0.4, noteProbability: 0.9, timingCurve: 'swing' }
    };
    
    const preset = presets[presetName];
    if (preset) {
        Object.assign(effect, preset);
        console.log(`[ScatterEffect] Applied preset: ${presetName}`);
        return true;
    }
    return false;
}