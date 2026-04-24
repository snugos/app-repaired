// js/MIDIEffectRack.js - Chainable MIDI Effects
// Provides a rack for chaining MIDI effects like arpeggiator, chord, etc.

/**
 * MIDIEffect - Base class for MIDI effects
 */
class MIDIEffect {
    constructor(config = {}) {
        this.id = config.id || `effect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.name = config.name || 'Effect';
        this.enabled = true;
        this.bypass = false;
        this.params = {};
    }

    /**
     * Process incoming MIDI message
     */
    process(message) {
        return [message];
    }

    /**
     * Set parameter value
     */
    setParam(name, value) {
        this.params[name] = value;
    }

    /**
     * Get parameter value
     */
    getParam(name) {
        return this.params[name];
    }

    /**
     * Reset effect state
     */
    reset() {}
}

/**
 * Arpeggiator - MIDI arpeggiator effect
 */
export class Arpeggiator extends MIDIEffect {
    constructor(config = {}) {
        super({ name: 'Arpeggiator', ...config });
        
        this.mode = config.mode || 'up';              // up, down, updown, random, order
        this.octaves = config.octaves || 1;
        this.rate = config.rate || '1/8';             // Note division
        this.gate = config.gate || 0.9;               // Note length as ratio
        this.swing = config.swing || 0;
        this.velocity = config.velocity || 'original'; // original, fixed, random
        this.fixedVelocity = config.fixedVelocity || 100;
        
        this.heldNotes = new Map();
        this.currentNotes = [];
        this.currentIndex = 0;
        this.direction = 1;
        this.isPlaying = false;
        this.scheduleId = null;
        this.lastTickTime = 0;
        
        this.params = {
            mode: this.mode,
            octaves: this.octaves,
            rate: this.rate,
            gate: this.gate,
            swing: this.swing,
            velocity: this.velocity
        };
    }

    /**
     * Process note on/off
     */
    process(message) {
        const [status, note, velocity] = message;
        const command = status & 0xf0;
        
        if (command === 0x90 && velocity > 0) {
            // Note on - add to held notes
            this.heldNotes.set(note, velocity);
            this.updateCurrentNotes();
            return [];
        } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
            // Note off - remove from held notes
            this.heldNotes.delete(note);
            this.updateCurrentNotes();
            return [];
        }
        
        return [message];
    }

    /**
     * Update current notes array based on mode
     */
    updateCurrentNotes() {
        const notes = Array.from(this.heldNotes.keys()).sort((a, b) => a - b);
        this.currentNotes = [];
        
        for (let octave = 0; octave < this.octaves; octave++) {
            notes.forEach(note => {
                this.currentNotes.push(note + octave * 12);
            });
        }
        
        if (this.mode === 'down' || this.mode === 'updown') {
            this.currentNotes = [...this.currentNotes, ...this.currentNotes.slice().reverse()];
        }
    }

    /**
     * Get next note in sequence
     */
    getNextNote() {
        if (this.currentNotes.length === 0) return null;
        
        let note;
        
        switch (this.mode) {
            case 'up':
            case 'down':
            case 'updown':
                note = this.currentNotes[this.currentIndex];
                this.currentIndex += this.direction;
                if (this.currentIndex >= this.currentNotes.length) {
                    this.currentIndex = 0;
                }
                if (this.currentIndex < 0) {
                    this.currentIndex = this.currentNotes.length - 1;
                }
                break;
            case 'random':
                note = this.currentNotes[Math.floor(Math.random() * this.currentNotes.length)];
                break;
            case 'order':
                note = this.currentNotes[this.currentIndex];
                this.currentIndex = (this.currentIndex + 1) % this.currentNotes.length;
                break;
            default:
                note = this.currentNotes[0];
        }
        
        // Apply swing
        const swingAmount = this.currentIndex % 2 === 1 ? this.swing : 0;
        
        // Get velocity
        let velocity;
        switch (this.velocity) {
            case 'fixed':
                velocity = this.fixedVelocity;
                break;
            case 'random':
                velocity = 60 + Math.floor(Math.random() * 67);
                break;
            default:
                const originalNote = note % 12 + (Math.floor(note / 12) - (this.octaves - 1)) * 12;
                velocity = this.heldNotes.get(originalNote) || 100;
        }
        
        return { note, velocity, swing: swingAmount };
    }

    /**
     * Get rate in milliseconds
     */
    getRateMs(bpm) {
        const divisions = {
            '1/1': 240000,
            '1/2': 120000,
            '1/4': 60000,
            '1/8': 30000,
            '1/16': 15000,
            '1/32': 7500,
            '1/64': 3750,
            '1/4t': 20000,
            '1/8t': 10000,
            '1/16t': 5000
        };
        return (divisions[this.rate] || 30000) / bpm;
    }

    /**
     * Reset
     */
    reset() {
        this.heldNotes.clear();
        this.currentNotes = [];
        this.currentIndex = 0;
        this.direction = 1;
    }
}

/**
 * ChordGenerator - MIDI chord effect
 */
export class ChordGenerator extends MIDIEffect {
    constructor(config = {}) {
        super({ name: 'Chord', ...config });
        
        this.chordType = config.chordType || 'major';     // major, minor, dim, aug, 7, maj7, min7, etc.
        this.inversion = config.inversion || 0;
        this.voicing = config.voicing || 'close';          // close, open, drop2
        this.transpose = config.transpose || 0;
        
        this.chordIntervals = {
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            'dim': [0, 3, 6],
            'aug': [0, 4, 8],
            'sus2': [0, 2, 7],
            'sus4': [0, 5, 7],
            '7': [0, 4, 7, 10],
            'maj7': [0, 4, 7, 11],
            'min7': [0, 3, 7, 10],
            'dim7': [0, 3, 6, 9],
            'aug7': [0, 4, 8, 10],
            'add9': [0, 4, 7, 14],
            'min9': [0, 3, 7, 14],
            '9': [0, 4, 7, 10, 14],
            '11': [0, 4, 7, 10, 14, 17],
            '13': [0, 4, 7, 10, 14, 17, 21]
        };
        
        this.params = {
            chordType: this.chordType,
            inversion: this.inversion,
            voicing: this.voicing,
            transpose: this.transpose
        };
    }

    /**
     * Process note on/off to generate chords
     */
    process(message) {
        const [status, note, velocity] = message;
        const command = status & 0xf0;
        const channel = status & 0x0f;
        
        if (command === 0x90 && velocity > 0) {
            // Note on - generate chord
            return this.generateChord(note, velocity, channel, false);
        } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
            // Note off - generate chord off
            return this.generateChord(note, velocity, channel, true);
        }
        
        return [message];
    }

    /**
     * Generate chord from root note
     */
    generateChord(rootNote, velocity, channel, isOff) {
        let intervals = this.chordIntervals[this.chordType] || [0, 4, 7];
        
        // Apply transpose
        intervals = intervals.map(i => i + this.transpose);
        
        // Apply inversion
        for (let i = 0; i < this.inversion; i++) {
            intervals.push(intervals.shift() + 12);
        }
        
        // Apply voicing
        if (this.voicing === 'open') {
            intervals = intervals.map((i, idx) => idx % 2 === 1 ? i + 12 : i);
        } else if (this.voicing === 'drop2') {
            if (intervals.length >= 2) {
                intervals[1] += 12;
            }
        }
        
        // Generate messages
        const command = isOff ? 0x80 : 0x90;
        return intervals.map(interval => {
            return [command | channel, rootNote + interval, velocity];
        });
    }
}

/**
 * NoteRepeater - MIDI note repeater (echo) effect
 */
export class NoteRepeater extends MIDIEffect {
    constructor(config = {}) {
        super({ name: 'Repeater', ...config });
        
        this.repeats = config.repeats || 4;
        this.delay = config.delay || '1/8';          // Note division
        this.decay = config.decay || 0.5;            // Velocity decay per repeat
        this.transpose = config.transpose || 0;      // Semitones per repeat
        this.feedback = config.feedback || 0;        // Additional feedback
        
        this.pendingNotes = [];
        this.params = {
            repeats: this.repeats,
            delay: this.delay,
            decay: this.decay,
            transpose: this.transpose,
            feedback: this.feedback
        };
    }

    /**
     * Process note and schedule repeats
     */
    process(message) {
        const [status, note, velocity] = message;
        const command = status & 0xf0;
        const channel = status & 0x0f;
        
        if (command === 0x90 && velocity > 0) {
            const messages = [message];
            let currentVelocity = velocity;
            let currentNote = note;
            
            for (let i = 0; i < this.repeats; i++) {
                currentVelocity *= (1 - this.decay);
                currentNote += this.transpose;
                
                if (currentVelocity < 1) break;
                if (currentNote < 0 || currentNote > 127) break;
                
                messages.push({
                    delay: (i + 1) * this.getDelayMs(120),  // Will be adjusted by tempo
                    message: [status, currentNote, Math.floor(currentVelocity)]
                });
            }
            
            return messages;
        }
        
        return [message];
    }

    /**
     * Get delay in milliseconds
     */
    getDelayMs(bpm) {
        const divisions = {
            '1/1': 240000, '1/2': 120000, '1/4': 60000,
            '1/8': 30000, '1/16': 15000, '1/32': 7500
        };
        return (divisions[this.delay] || 30000) / bpm;
    }
}

/**
 * ScaleFilter - Filter notes to a specific scale
 */
export class ScaleFilter extends MIDIEffect {
    constructor(config = {}) {
        super({ name: 'Scale', ...config });
        
        this.scale = config.scale || 'major';
        this.root = config.root || 0;    // 0 = C, 1 = C#, etc.
        this.mode = config.mode || 'filter';  // filter, snap
        
        this.scaleIntervals = {
            'major': [0, 2, 4, 5, 7, 9, 11],
            'minor': [0, 2, 3, 5, 7, 8, 10],
            'pentatonic': [0, 2, 4, 7, 9],
            'blues': [0, 3, 5, 6, 7, 10],
            'dorian': [0, 2, 3, 5, 7, 9, 10],
            'phrygian': [0, 1, 3, 5, 7, 8, 10],
            'lydian': [0, 2, 4, 6, 7, 9, 11],
            'mixolydian': [0, 2, 4, 5, 7, 9, 10],
            'locrian': [0, 1, 3, 5, 6, 8, 10],
            'chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        };
        
        this.params = {
            scale: this.scale,
            root: this.root,
            mode: this.mode
        };
    }

    /**
     * Check if note is in scale
     */
    isInScale(note) {
        const intervals = this.scaleIntervals[this.scale] || this.scaleIntervals.major;
        const pitchClass = (note - this.root + 12) % 12;
        return intervals.includes(pitchClass);
    }

    /**
     * Snap note to nearest scale note
     */
    snapToScale(note) {
        if (this.isInScale(note)) return note;
        
        // Find nearest scale note
        const intervals = this.scaleIntervals[this.scale] || this.scaleIntervals.major;
        const pitchClass = (note - this.root + 12) % 12;
        
        let nearest = intervals[0];
        let minDist = 12;
        
        for (const interval of intervals) {
            const dist = Math.min(
                Math.abs(pitchClass - interval),
                12 - Math.abs(pitchClass - interval)
            );
            if (dist < minDist) {
                minDist = dist;
                nearest = interval;
            }
        }
        
        return note - pitchClass + ((nearest - pitchClass + 12) % 12);
    }

    /**
     * Process note
     */
    process(message) {
        const [status, note, velocity] = message;
        const command = status & 0xf0;
        
        if (command === 0x90 || command === 0x80) {
            if (this.mode === 'filter') {
                if (!this.isInScale(note)) {
                    return [];  // Filter out non-scale notes
                }
                return [message];
            } else {
                // Snap mode
                const newNote = this.snapToScale(note);
                return [[status, newNote, velocity]];
            }
        }
        
        return [message];
    }
}

/**
 * VelocityMapper - Remap velocity values
 */
export class VelocityMapper extends MIDIEffect {
    constructor(config = {}) {
        super({ name: 'Velocity', ...config });
        
        this.mode = config.mode || 'passthrough';  // passthrough, fixed, range, curve
        this.fixedValue = config.fixedValue || 100;
        this.minVel = config.minVel || 0;
        this.maxVel = config.maxVel || 127;
        this.curve = config.curve || 1;            // 1 = linear, < 1 softer, > 1 harder
        this.randomize = config.randomize || 0;     // Random variation amount
        
        this.params = {
            mode: this.mode,
            fixedValue: this.fixedValue,
            minVel: this.minVel,
            maxVel: this.maxVel,
            curve: this.curve,
            randomize: this.randomize
        };
    }

    /**
     * Map velocity
     */
    mapVelocity(velocity) {
        let newVel;
        
        switch (this.mode) {
            case 'fixed':
                newVel = this.fixedValue;
                break;
            case 'range':
                newVel = this.minVel + (velocity / 127) * (this.maxVel - this.minVel);
                break;
            case 'curve':
                const normalized = velocity / 127;
                const curved = Math.pow(normalized, this.curve);
                newVel = curved * 127;
                break;
            default:
                newVel = velocity;
        }
        
        // Apply randomization
        if (this.randomize > 0) {
            const variation = (Math.random() - 0.5) * this.randomize * 127;
            newVel += variation;
        }
        
        return Math.max(0, Math.min(127, Math.floor(newVel)));
    }

    /**
     * Process note
     */
    process(message) {
        const [status, note, velocity] = message;
        const command = status & 0xf0;
        
        if (command === 0x90 && velocity > 0) {
            return [[status, note, this.mapVelocity(velocity)]];
        }
        
        return [message];
    }
}

/**
 * TransposeEffect - Transpose all notes
 */
export class TransposeEffect extends MIDIEffect {
    constructor(config = {}) {
        super({ name: 'Transpose', ...config });
        
        this.semitones = config.semitones || 0;
        this.octaves = config.octaves || 0;
        
        this.params = {
            semitones: this.semitones,
            octaves: this.octaves
        };
    }

    /**
     * Transpose note
     */
    process(message) {
        const [status, note, velocity] = message;
        const command = status & 0xf0;
        
        if (command === 0x90 || command === 0x80) {
            const newNote = note + this.semitones + this.octaves * 12;
            if (newNote >= 0 && newNote <= 127) {
                return [[status, newNote, velocity]];
            }
            return [];  // Note out of range
        }
        
        return [message];
    }
}

/**
 * MIDIEffectRack - Rack for chaining MIDI effects
 */
export class MIDIEffectRack {
    constructor(config = {}) {
        this.effects = [];
        this.isEnabled = true;
        this.onOutput = null;
    }

    /**
     * Add effect to rack
     */
    addEffect(effect) {
        this.effects.push(effect);
        return effect;
    }

    /**
     * Remove effect from rack
     */
    removeEffect(effectId) {
        const index = this.effects.findIndex(e => e.id === effectId);
        if (index !== -1) {
            this.effects.splice(index, 1);
        }
    }

    /**
     * Create effect by type
     */
    createEffect(type, config = {}) {
        switch (type) {
            case 'arpeggiator':
                return new Arpeggiator(config);
            case 'chord':
                return new ChordGenerator(config);
            case 'repeater':
                return new NoteRepeater(config);
            case 'scale':
                return new ScaleFilter(config);
            case 'velocity':
                return new VelocityMapper(config);
            case 'transpose':
                return new TransposeEffect(config);
            default:
                return new MIDIEffect(config);
        }
    }

    /**
     * Process MIDI message through chain
     */
    process(message) {
        if (!this.isEnabled) {
            return [message];
        }
        
        let messages = [message];
        
        for (const effect of this.effects) {
            if (!effect.enabled || effect.bypass) continue;
            
            const newMessages = [];
            for (const msg of messages) {
                const processed = effect.process(msg);
                if (Array.isArray(processed)) {
                    newMessages.push(...processed);
                }
            }
            messages = newMessages;
        }
        
        return messages;
    }

    /**
     * Handle incoming MIDI message
     */
    handleMIDI(message) {
        const output = this.process(message);
        if (this.onOutput) {
            output.forEach(msg => this.onOutput(msg));
        }
        return output;
    }

    /**
     * Set output callback
     */
    setOutput(callback) {
        this.onOutput = callback;
    }

    /**
     * Get effect by ID
     */
    getEffect(effectId) {
        return this.effects.find(e => e.id === effectId);
    }

    /**
     * Reorder effects
     */
    reorderEffects(fromIndex, toIndex) {
        const [effect] = this.effects.splice(fromIndex, 1);
        this.effects.splice(toIndex, 0, effect);
    }

    /**
     * Clear all effects
     */
    clearEffects() {
        this.effects = [];
    }

    /**
     * Get state for save/load
     */
    getState() {
        return {
            effects: this.effects.map(e => ({
                type: e.constructor.name.toLowerCase().replace('effect', ''),
                params: { ...e.params },
                enabled: e.enabled
            }))
        };
    }

    /**
     * Restore state
     */
    restoreState(state) {
        this.clearEffects();
        if (state.effects) {
            state.effects.forEach(e => {
                const effect = this.createEffect(e.type, e.params);
                effect.enabled = e.enabled;
                this.addEffect(effect);
            });
        }
    }
}

/**
 * AvailableMIDIEffects - List of available MIDI effects
 */
export const AvailableMIDIEffects = [
    { type: 'arpeggiator', name: 'Arpeggiator', description: 'Create patterns from held notes' },
    { type: 'chord', name: 'Chord Generator', description: 'Generate chords from single notes' },
    { type: 'repeater', name: 'Note Repeater', description: 'Echo repeats with decay' },
    { type: 'scale', name: 'Scale Filter', description: 'Filter or snap notes to scale' },
    { type: 'velocity', name: 'Velocity Mapper', description: 'Remap velocity values' },
    { type: 'transpose', name: 'Transpose', description: 'Shift all notes by semitones' }
];

/**
 * Open MIDI effect rack panel
 */
export function openMIDIEffectRackPanel(services = {}) {
    const { showNotification, onMIDIOutput } = services;
    
    // Remove existing panel
    const existing = document.getElementById('midi-rack-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'midi-rack-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #4a4a6a;
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 600px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const rack = new MIDIEffectRack();
    
    if (onMIDIOutput) {
        rack.setOutput(onMIDIOutput);
    }
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #fff; margin: 0;">🎹 MIDI Effect Rack</h2>
            <button id="close-midi-rack" style="background: #ef4444; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
        
        <!-- Add Effect -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Add Effect</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${AvailableMIDIEffects.map(e => `
                    <button class="add-effect-btn" data-type="${e.type}" title="${e.description}" style="padding: 8px 16px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        ${e.name}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <!-- Effect Chain -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="color: #888; margin: 0; font-size: 12px; text-transform: uppercase;">Effect Chain</h3>
                <button id="clear-chain" style="padding: 4px 12px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">Clear All</button>
            </div>
            <div id="effect-chain" style="min-height: 100px;">
                <div style="color: #666; text-align: center; padding: 20px;">No effects in chain. Add an effect above.</div>
            </div>
        </div>
        
        <!-- Effect Parameters -->
        <div id="effect-params" style="display: none; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Parameters</h3>
            <div id="params-container"></div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    let selectedEffect = null;
    
    // Update effect chain display
    function updateChainDisplay() {
        const container = panel.querySelector('#effect-chain');
        
        if (rack.effects.length === 0) {
            container.innerHTML = `<div style="color: #666; text-align: center; padding: 20px;">No effects in chain.</div>`;
            return;
        }
        
        container.innerHTML = rack.effects.map((effect, index) => `
            <div class="chain-effect" data-id="${effect.id}" data-index="${index}" style="display: flex; align-items: center; padding: 10px; background: #1a1a2e; border-radius: 4px; margin-bottom: 6px; cursor: pointer; border: 2px solid ${selectedEffect?.id === effect.id ? '#10b981' : 'transparent'};">
                <div style="flex: 1;">
                    <div style="color: #fff; font-size: 13px;">${effect.name}</div>
                    <div style="color: #666; font-size: 11px;">Slot ${index + 1}</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <label style="color: #888; font-size: 11px; display: flex; align-items: center; gap: 4px;">
                        <input type="checkbox" class="effect-bypass" data-id="${effect.id}" ${effect.bypass ? '' : 'checked'}>
                        On
                    </label>
                    <button class="remove-effect" data-id="${effect.id}" style="padding: 4px 8px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">×</button>
                </div>
            </div>
        `).join('');
        
        // Attach event handlers
        container.querySelectorAll('.chain-effect').forEach(el => {
            el.onclick = (e) => {
                if (e.target.closest('.remove-effect') || e.target.closest('.effect-bypass')) return;
                const effect = rack.getEffect(el.dataset.id);
                selectedEffect = effect;
                updateChainDisplay();
                showEffectParams(effect);
            };
        });
        
        container.querySelectorAll('.effect-bypass').forEach(checkbox => {
            checkbox.onchange = () => {
                const effect = rack.getEffect(checkbox.dataset.id);
                if (effect) {
                    effect.bypass = !checkbox.checked;
                }
            };
        });
        
        container.querySelectorAll('.remove-effect').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                rack.removeEffect(btn.dataset.id);
                if (selectedEffect?.id === btn.dataset.id) {
                    selectedEffect = null;
                    panel.querySelector('#effect-params').style.display = 'none';
                }
                updateChainDisplay();
            };
        });
    }
    
    // Show effect parameters
    function showEffectParams(effect) {
        const container = panel.querySelector('#effect-params');
        const paramsDiv = panel.querySelector('#params-container');
        
        if (!effect || Object.keys(effect.params).length === 0) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        
        paramsDiv.innerHTML = Object.entries(effect.params).map(([name, value]) => {
            const isBool = typeof value === 'boolean';
            const isSelect = name === 'mode' || name === 'chordType' || name === 'scale' || name === 'rate' || name === 'velocity';
            
            if (isSelect) {
                let options = [];
                switch (name) {
                    case 'mode':
                        options = ['up', 'down', 'updown', 'random', 'order'];
                        break;
                    case 'chordType':
                        options = ['major', 'minor', 'dim', 'aug', '7', 'maj7', 'min7', 'sus2', 'sus4', 'add9'];
                        break;
                    case 'scale':
                        options = ['major', 'minor', 'pentatonic', 'blues', 'dorian', 'phrygian', 'lydian', 'mixolydian'];
                        break;
                    case 'rate':
                        options = ['1/4', '1/8', '1/16', '1/32', '1/4t', '1/8t', '1/16t'];
                        break;
                    case 'velocity':
                        options = ['original', 'fixed', 'random'];
                        break;
                }
                
                return `
                    <label style="display: block; color: #888; margin-bottom: 10px;">
                        ${name}:
                        <select class="effect-param-select" data-param="${name}" style="margin-left: 8px; padding: 4px; background: #1a1a2e; color: #fff; border: 1px solid #4a4a6a; border-radius: 4px;">
                            ${options.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('')}
                        </select>
                    </label>
                `;
            } else if (isBool) {
                return `
                    <label style="display: block; color: #888; margin-bottom: 10px;">
                        <input type="checkbox" class="effect-param-check" data-param="${name}" ${value ? 'checked' : ''}>
                        ${name}
                    </label>
                `;
            } else {
                const isInteger = Number.isInteger(value);
                const step = isInteger ? 1 : 0.01;
                const max = name.includes('Velocity') || name === 'fixedValue' ? 127 : name.includes('repeats') ? 16 : name.includes('octaves') ? 4 : 1;
                
                return `
                    <label style="display: block; color: #888; margin-bottom: 10px;">
                        ${name}: <input type="range" class="effect-param" data-param="${name}" min="0" max="${max}" step="${step}" value="${value}" style="width: 200px;">
                        <span style="color: #fff;">${value}</span>
                    </label>
                `;
            }
        }).join('');
        
        // Attach handlers
        paramsDiv.querySelectorAll('.effect-param').forEach(slider => {
            slider.oninput = () => {
                const paramName = slider.dataset.param;
                const value = parseFloat(slider.value);
                effect.setParam(paramName, value);
                slider.nextElementSibling.textContent = value;
            };
        });
        
        paramsDiv.querySelectorAll('.effect-param-select').forEach(select => {
            select.onchange = () => {
                effect.setParam(select.dataset.param, select.value);
            };
        });
        
        paramsDiv.querySelectorAll('.effect-param-check').forEach(checkbox => {
            checkbox.onchange = () => {
                effect.setParam(checkbox.dataset.param, checkbox.checked);
            };
        });
    }
    
    // Close panel
    panel.querySelector('#close-midi-rack').onclick = () => {
        panel.remove();
    };
    
    // Add effect buttons
    panel.querySelectorAll('.add-effect-btn').forEach(btn => {
        btn.onclick = () => {
            const type = btn.dataset.type;
            const effect = rack.createEffect(type);
            rack.addEffect(effect);
            selectedEffect = effect;
            updateChainDisplay();
            showEffectParams(effect);
            if (showNotification) showNotification(`Added ${effect.name}`, 1500);
        };
    });
    
    // Clear chain
    panel.querySelector('#clear-chain').onclick = () => {
        rack.clearEffects();
        selectedEffect = null;
        updateChainDisplay();
        panel.querySelector('#effect-params').style.display = 'none';
        if (showNotification) showNotification('Effect chain cleared', 1500);
    };
    
    return rack;
}

export default MIDIEffectRack;