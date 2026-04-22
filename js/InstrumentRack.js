// js/InstrumentRack.js - Instrument Rack System for SnugOS DAW
// Allows layering multiple instruments into a single track with unified control

import * as Constants from './constants.js';

/**
 * InstrumentLayer - Represents a single layer within an instrument rack
 */
export class InstrumentLayer {
    constructor(config = {}) {
        this.id = config.id || `layer-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.name = config.name || 'Layer';
        this.type = config.type || 'synth'; // 'synth', 'sampler', 'drum'
        this.enabled = config.enabled !== undefined ? config.enabled : true;
        this.volume = config.volume !== undefined ? config.volume : 1.0; // 0-1 layer volume
        this.pan = config.pan !== undefined ? config.pan : 0; // -1 to 1
        this.muted = config.muted || false;
        
        // Synth settings
        this.synthEngineType = config.synthEngineType || 'MonoSynth';
        this.synthParams = config.synthParams ? JSON.parse(JSON.stringify(config.synthParams)) : this.getDefaultSynthParams();
        
        // Sampler settings
        this.sampleUrl = config.sampleUrl || null;
        this.audioBufferDataURL = config.audioBufferDataURL || null;
        this.originalFileName = config.originalFileName || null;
        this.rootNote = config.rootNote || 'C4';
        this.envelope = config.envelope ? JSON.parse(JSON.stringify(config.envelope)) : 
            { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 };
        
        // Drum pad settings
        this.drumPads = config.drumPads || Array(8).fill(null).map(() => ({
            sampleUrl: null,
            audioBufferDataURL: null,
            originalFileName: null,
            volume: 0.7,
            pitchShift: 0
        }));
        
        // MIDI settings
        this.midiChannel = config.midiChannel ?? 0; // 0 = omni
        
        // Note range for layer
        this.noteRangeLow = config.noteRangeLow ?? 0;   // MIDI note number
        this.noteRangeHigh = config.noteRangeHigh ?? 127; // MIDI note number
        
        // Tone.js objects (runtime only, not serialized)
        this.toneNode = null;
        this.gainNode = null;
        this.panNode = null;
    }
    
    getDefaultSynthParams() {
        return {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.3 },
            filter: { type: 'lowpass', frequency: 2000, rolloff: -24 },
            filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3, baseFrequency: 200, octaves: 2 }
        };
    }
    
    dispose() {
        if (this.toneNode && !this.toneNode.disposed) {
            try { this.toneNode.dispose(); } catch(e) {}
        }
        if (this.gainNode && !this.gainNode.disposed) {
            try { this.gainNode.dispose(); } catch(e) {}
        }
        if (this.panNode && !this.panNode.disposed) {
            try { this.panNode.dispose(); } catch(e) {}
        }
    }
}

/**
 * InstrumentRack - Manages layered instruments for a track
 */
export class InstrumentRack {
    constructor(config = {}) {
        this.layers = [];
        this.masterGain = null; // Tone.Gain for mixing layers
        this.outputNode = null;
        
        // Serialized properties
        this.enabled = config.enabled !== undefined ? config.enabled : true;
        
        // Initialize with one default layer if empty
        if (!config.layers || config.layers.length === 0) {
            this.layers = [new InstrumentLayer({ name: 'Layer 1' })];
        } else {
            this.layers = config.layers.map(l => new InstrumentLayer(l));
        }
    }
    
    /**
     * Get the master output node for connecting to track effects chain
     */
    getOutputNode() {
        return this.masterGain;
    }
    
    /**
     * Initialize Tone.js nodes for all layers
     */
    initializeAudio(trackId) {
        if (typeof Tone === 'undefined') {
            console.warn(`[InstrumentRack] Tone.js not available, skipping audio init for track ${trackId}`);
            return;
        }
        
        // Create master gain
        this.masterGain = new Tone.Gain(1.0);
        
        // Initialize each layer
        this.layers.forEach((layer, index) => {
            this._initializeLayerAudio(layer, trackId, index);
        });
        
        console.log(`[InstrumentRack] Initialized ${this.layers.length} layers for track ${trackId}`);
    }
    
    _initializeLayerAudio(layer, trackId, layerIndex) {
        // Create layer gain and pan nodes
        layer.gainNode = new Tone.Gain(layer.muted ? 0 : layer.volume);
        layer.panNode = new Tone.Panner(layer.pan);
        
        // Create the instrument based on type
        if (layer.type === 'synth') {
            layer.toneNode = this._createSynth(layer);
        } else if (layer.type === 'sampler') {
            layer.toneNode = this._createSampler(layer);
        } else if (layer.type === 'drum') {
            layer.toneNode = this._createDrumSampler(layer);
        }
        
        // Chain: instrument -> gain -> pan -> master gain
        if (layer.toneNode) {
            layer.toneNode.chain(layer.gainNode, layer.panNode, this.masterGain);
        }
    }
    
    _createSynth(layer) {
        const params = layer.synthParams || {};
        
        switch(layer.synthEngineType) {
            case 'MonoSynth':
                return new Tone.MonoSynth({
                    oscillator: { type: params.oscillator?.type || 'sawtooth' },
                    envelope: params.envelope || { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.3 },
                    filter: params.filter || { type: 'lowpass', frequency: 2000, rolloff: -24 },
                    filterEnvelope: params.filterEnvelope || { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3, baseFrequency: 200, octaves: 2 }
                });
            case 'PolySynth':
                return new Tone.PolySynth(Tone.MonoSynth, {
                    oscillator: { type: params.oscillator?.type || 'sawtooth' },
                    envelope: params.envelope || { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.3 }
                });
            case 'FMSynth':
                return new Tone.FMSynth({
                    harmonicity: params.harmonicity || 3,
                    modulationIndex: params.modulationIndex || 10,
                    envelope: params.envelope || { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5 }
                });
            case 'AMSynth':
                return new Tone.AMSynth({
                    harmonicity: params.harmonicity || 3,
                    envelope: params.envelope || { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5 }
                });
            default:
                return new Tone.MonoSynth({
                    oscillator: { type: params.oscillator?.type || 'sawtooth' },
                    envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.3 }
                });
        }
    }
    
    _createSampler(layer) {
        const sampler = new Tone.Sampler({
            urls: { C4: layer.sampleUrl || layer.audioBufferDataURL || '' },
            rootNote: layer.rootNote || 'C4',
            envelope: layer.envelope || { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 }
        });
        
        // If we have a sample, load it
        if (layer.audioBufferDataURL) {
            sampler.toDestination();
            const buffer = new Tone.Buffer(layer.audioBufferDataURL);
            // Note: In actual use, you'd need to handle sample loading properly
        }
        
        return sampler;
    }
    
    _createDrumSampler(layer) {
        // Create a simple drum kit with multiple samples
        const drumKit = {};
        const drumNames = ['kick', 'snare', 'hihat', 'tom1', 'tom2', 'clap', 'crash', 'ride'];
        
        drumNames.forEach((name, idx) => {
            const pad = layer.drumPads[idx];
            if (pad && pad.audioBufferDataURL) {
                drumKit[name] = pad.audioBufferDataURL;
            }
        });
        
        return new Tone.Sampler({ urls: drumKit }).toDestination();
    }
    
    /**
     * Trigger a note on a specific layer
     */
    triggerAttack(layerId, note, velocity = 1, time = null) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || !layer.toneNode || !layer.enabled || layer.muted) return;
        
        const noteInRange = this._isNoteInRange(note, layer);
        if (!noteInRange) return;
        
        if (layer.toneNode.triggerAttack) {
            const t = time !== null ? time : Tone.now();
            if (typeof note === 'string') {
                layer.toneNode.triggerAttack(note, t, velocity);
            } else {
                layer.toneNode.triggerAttack(Tone.Frequency(note, 'midi').toNote(), t, velocity);
            }
        }
    }
    
    /**
     * Release a note on a specific layer
     */
    triggerRelease(layerId, note, time = null) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer || !layer.toneNode) return;
        
        if (layer.toneNode.triggerRelease) {
            const t = time !== null ? time : Tone.now();
            if (typeof note === 'string') {
                layer.toneNode.triggerRelease(note, t);
            } else {
                layer.toneNode.triggerRelease(Tone.Frequency(note, 'midi').toNote(), t);
            }
        }
    }
    
    /**
     * Trigger attack/release on all layers simultaneously (for chords)
     */
    triggerAttackRelease(note, duration, time = null) {
        this.layers.forEach(layer => {
            if (!layer.enabled || layer.muted) return;
            
            const noteInRange = this._isNoteInRange(note, layer);
            if (!noteInRange) return;
            
            if (layer.toneNode && layer.toneNode.triggerAttackRelease) {
                const t = time !== null ? time : Tone.now();
                const noteStr = typeof note === 'string' ? note : Tone.Frequency(note, 'midi').toNote();
                layer.toneNode.triggerAttackRelease(noteStr, duration, t);
            }
        });
    }
    
    /**
     * Release all notes on all layers
     */
    releaseAll(time = null) {
        const t = time !== null ? time : Tone.now();
        this.layers.forEach(layer => {
            if (layer.toneNode && layer.toneNode.releaseAll) {
                layer.toneNode.releaseAll(t);
            }
        });
    }
    
    /**
     * Check if a MIDI note is within a layer's note range
     */
    _isNoteInRange(note, layer) {
        if (typeof note === 'string') {
            note = Tone.Frequency(note).toMidi();
        }
        return note >= layer.noteRangeLow && note <= layer.noteRangeHigh;
    }
    
    /**
     * Set the volume of a specific layer
     */
    setLayerVolume(layerId, volume) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;
        
        layer.volume = Math.max(0, Math.min(1, volume));
        if (layer.gainNode && !layer.gainNode.disposed) {
            layer.gainNode.gain.setValueAtTime(layer.volume, Tone.now());
        }
    }
    
    /**
     * Mute/unmute a specific layer
     */
    setLayerMute(layerId, muted) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;
        
        layer.muted = muted;
        if (layer.gainNode && !layer.gainNode.disposed) {
            layer.gainNode.gain.setValueAtTime(muted ? 0 : layer.volume, Tone.now());
        }
    }
    
    /**
     * Set the pan of a specific layer
     */
    setLayerPan(layerId, pan) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return;
        
        layer.pan = Math.max(-1, Math.min(1, pan));
        if (layer.panNode && !layer.panNode.disposed) {
            layer.panNode.pan.setValueAtTime(layer.pan, Tone.now());
        }
    }
    
    /**
     * Add a new layer to the rack
     */
    addLayer(config = {}) {
        const layer = new InstrumentLayer({
            name: `Layer ${this.layers.length + 1}`,
            ...config
        });
        this.layers.push(layer);
        
        // Initialize audio for this layer if master gain exists
        if (this.masterGain && !this.masterGain.disposed) {
            this._initializeLayerAudio(layer, 0, this.layers.length - 1);
        }
        
        return layer;
    }
    
    /**
     * Remove a layer from the rack
     */
    removeLayer(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index === -1) return false;
        
        const layer = this.layers[index];
        layer.dispose();
        this.layers.splice(index, 1);
        
        return true;
    }
    
    /**
     * Update layer settings
     */
    updateLayer(layerId, updates) {
        const layer = this.layers.find(l => l.id === layerId);
        if (!layer) return null;
        
        Object.assign(layer, updates);
        return layer;
    }
    
    /**
     * Get all layer data for serialization
     */
    toJSON() {
        return {
            enabled: this.enabled,
            layers: this.layers.map(l => ({
                id: l.id,
                name: l.name,
                type: l.type,
                enabled: l.enabled,
                volume: l.volume,
                pan: l.pan,
                muted: l.muted,
                synthEngineType: l.synthEngineType,
                synthParams: l.synthParams,
                sampleUrl: l.sampleUrl,
                audioBufferDataURL: l.audioBufferDataURL,
                originalFileName: l.originalFileName,
                rootNote: l.rootNote,
                envelope: l.envelope,
                drumPads: l.drumPads,
                midiChannel: l.midiChannel,
                noteRangeLow: l.noteRangeLow,
                noteRangeHigh: l.noteRangeHigh
            }))
        };
    }
    
    /**
     * Dispose all audio nodes
     */
    dispose() {
        this.layers.forEach(layer => layer.dispose());
        if (this.masterGain && !this.masterGain.disposed) {
            this.masterGain.dispose();
        }
    }
}

// Export for use in other modules
export function createInstrumentRack(config = {}) {
    return new InstrumentRack(config);
}