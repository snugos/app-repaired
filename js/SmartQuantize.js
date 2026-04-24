// js/SmartQuantize.js - Intelligent quantization with strength and range controls
export class SmartQuantize {
    constructor() {
        this.strength = 1.0;  // 0-1, how much to apply
        this.range = 1.0;     // Time range to search for nearest note
        this.scale = 'chromatic';
        this.customScale = [];
    }

    setStrength(value) {
        this.strength = Math.max(0, Math.min(1, value));
    }

    setRange(beats) {
        this.range = Math.max(0.25, Math.min(4, beats));
    }

    setScale(scaleName) {
        const validScales = ['chromatic', 'major', 'minor', 'pentatonic', 'blues'];
        this.scale = validScales.includes(scaleName) ? scaleName : 'chromatic';
    }

    setCustomScale(notes) {
        this.customScale = notes || [];
    }

    quantizeNote(noteTime, originalVelocity) {
        const gridSize = 0.25; // 16th notes
        const nearestGrid = Math.round(noteTime / gridSize) * gridSize;
        
        // Apply strength
        const offset = (nearestGrid - noteTime) * this.strength;
        return {
            time: noteTime + offset,
            velocity: originalVelocity
        };
    }

    quantizeNotes(notes) {
        return notes.map(note => {
            const quantized = this.quantizeNote(note.time, note.velocity);
            return {
                ...note,
                time: quantized.time,
                velocity: quantized.velocity
            };
        });
    }

    snapToScale(notePitch) {
        if (this.scale === 'chromatic' || this.customScale.length === 0) {
            return notePitch;
        }
        
        // Find nearest note in scale
        const noteInScale = this.customScale.find(
            n => n === notePitch || (n % 12) === (notePitch % 12)
        );
        
        return noteInScale !== undefined ? noteInScale : notePitch;
    }
}

export function createSmartQuantize() {
    return new SmartQuantize();
}