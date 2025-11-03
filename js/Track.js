// js/Track.js - Track Class Module

import * as Constants from './constants.js';
import { createEffectInstance, getEffectDefaultParams as getEffectDefaultParamsFromRegistry, AVAILABLE_EFFECTS } from './effectsRegistry.js';
import { storeAudio, getAudio } from './db.js';

export class Track {
    constructor(id, type, initialData = null, appServices = {}) {
        this.id = initialData?.id || id;
        this.type = type;
        this.appServices = appServices || {}; 

        this.name = initialData?.name || `${type} Track ${this.id}`;
        if (type === 'DrumSampler') {
            this.name = initialData?.name || `Sampler (Pads) ${this.id}`;
        } else if (type === 'Synth') {
            this.name = initialData?.name || `MonoSynth ${this.id}`;
        } else if (type === 'Audio') {
            this.name = initialData?.name || `Audio ${this.id}`;
        }

        this.isMuted = initialData?.isMuted || false;
        this.isSoloed = false;
        this.isMonitoringEnabled = initialData?.isMonitoringEnabled !== undefined ? initialData.isMonitoringEnabled : (this.type === 'Audio');
        this.previousVolumeBeforeMute = initialData?.volume ?? 0.7;
        
        this.input = new Tone.Gain();
        this.outputNode = new Tone.Gain(this.previousVolumeBeforeMute);
        this.trackMeter = new Tone.Meter();
        this.outputNode.connect(this.trackMeter);
        
        this.instrument = null;
        this.activeEffects = [];
        if (initialData?.activeEffects && initialData.activeEffects.length > 0) {
            initialData.activeEffects.forEach(effectData => this.addEffect(effectData.type, effectData.params, true));
        } else if (this.type !== 'Audio') {
            this.addEffect('EQ3', null, true);
        }
        
        this.toneSequence = null;
        this.synthEngineType = null;
        this.synthParams = {};
        this.sequences = initialData?.sequences || [];
        this.activeSequenceId = initialData?.activeSequenceId || null;
        this.inspectorControls = {};
        this.timelineClips = initialData?.timelineClips || [];

        this.samplerAudioData = {};
        this.audioBuffer = null;
        this.slices = [];
        this.selectedSliceForEdit = 0;
        this.drumSamplerPads = [];
        this.drumPadPlayers = [];
        this.selectedDrumPadForEdit = 0;
        this.instrumentSamplerSettings = {};
        this.toneSampler = null;
        this.inputChannel = (this.type === 'Audio') ? new Tone.Gain().connect(this.input) : null;

        if (this.type === 'Synth') {
            this.synthEngineType = initialData?.synthEngineType || 'MonoSynth';
            this.synthParams = initialData?.synthParams ? JSON.parse(JSON.stringify(initialData.synthParams)) : this.getDefaultSynthParams();
        } else if (this.type === 'Sampler') {
            this.samplerAudioData = { fileName: initialData?.samplerAudioData?.fileName || null, dbKey: initialData?.samplerAudioData?.dbKey || null, status: 'empty' };
            this.slices = initialData?.slices || Array(Constants.numSlices || 16).fill(null).map(() => ({ offset: 0, duration: 0, volume: 0.7, pitchShift: 0, loop: false, reverse: false, envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.2 } }));
            this.selectedSliceForEdit = initialData?.selectedSliceForEdit || 0;
        } else if (this.type === 'DrumSampler') {
            this.drumSamplerPads = Array(Constants.numDrumSamplerPads || 16).fill(null).map((_, i) => initialData?.drumSamplerPads?.[i] || { originalFileName: null, dbKey: null, volume: 0.7, pitchShift: 0 });
            this.drumPadPlayers = Array(Constants.numDrumSamplerPads || 16).fill(null);
            this.selectedDrumPadForEdit = initialData?.selectedDrumPadForEdit || 0;
        } else if (this.type === 'InstrumentSampler') {
            // --- FIX: Updated the default envelope parameters as requested ---
            this.instrumentSamplerSettings = initialData?.instrumentSamplerSettings || { 
                originalFileName: null, 
                dbKey: null, 
                rootNote: 'C4', 
                pitchShift: 0, 
                loop: false, 
                loopStart: 0, 
                loopEnd: 0, 
                envelope: { attack: 0.003, decay: 2.0, sustain: 1.0, release: 5.0 }, 
                status: 'empty' 
            };
        }

        if (this.type !== 'Audio' && this.sequences.length === 0) {
            this.createNewSequence("Sequence 1", 64, true);
        }
    }

    async initializeInstrument() {
        if (this.instrument) {
            this.instrument.dispose();
        }

        if (this.type === 'Synth') {
            this.instrument = new Tone.PolySynth(Tone.Synth);
        } else if (this.type === 'InstrumentSampler') {
            const buffer = this.instrumentSamplerSettings.audioBuffer;
            const urls = {};
            if (buffer && buffer.loaded) {
                const rootNote = this.instrumentSamplerSettings.rootNote || 'C4';
                urls[rootNote] = buffer;
            }
            // --- FIX: Pass all instrument settings to the Tone.Sampler constructor ---
            this.instrument = new Tone.Sampler({ 
                urls,
                attack: this.instrumentSamplerSettings.envelope.attack,
                decay: this.instrumentSamplerSettings.envelope.decay,
                sustain: this.instrumentSamplerSettings.envelope.sustain,
                release: this.instrumentSamplerSettings.envelope.release,
                detune: (this.instrumentSamplerSettings.pitchShift || 0) * 100
            }).connect(this.input);
        } else if (this.type === 'Sampler' || this.type === 'DrumSampler') {
            this.instrument = null; 
        } else {
            this.instrument = null;
        }
        
        this.rebuildEffectChain();
        this.recreateToneSequence();
    }
    
    rebuildEffectChain() {
        this.input.disconnect();
        this.instrument?.disconnect();

        if (this.instrument) {
            this.instrument.connect(this.input);
        }

        let currentNode = this.input;
        this.activeEffects.forEach(effect => {
            if (effect.toneNode) {
                currentNode.connect(effect.toneNode);
                currentNode = effect.toneNode;
            }
        });

        currentNode.connect(this.outputNode);
        
        const masterBusInput = this.appServices.getMasterBusInputNode?.();
        if (masterBusInput) {
            this.outputNode.connect(masterBusInput);
        } else {
            this.outputNode.toDestination();
        }
    }
    
    setVolume(volume, fromInteraction = false) {
        this.previousVolumeBeforeMute = volume;
        if (!this.isMuted) {
            this.outputNode.gain.rampTo(volume, 0.02);
        }
        if (fromInteraction) {
            this.appServices.captureStateForUndo?.(`Set Volume for ${this.name} to ${volume.toFixed(2)}`);
        }
    }

    applyMuteState() {
        if (!this.outputNode) return;
        if (this.isMuted) {
            this.outputNode.gain.rampTo(0, 0.02);
        } else {
            this.outputNode.gain.rampTo(this.previousVolumeBeforeMute, 0.02);
        }
    }

    applySoloState(isAnotherTrackSoloed) {
        if (!this.outputNode) return;
        if (isAnotherTrackSoloed) {
            this.outputNode.gain.rampTo(0, 0.02);
        } else {
            this.applyMuteState();
        }
    }
    
    updateSoloMuteState(soloedTrackId) {
        this.isSoloed = this.id === soloedTrackId;
        this.applySoloState(soloedTrackId !== null && !this.isSoloed);
        this.appServices.updateTrackUI?.(this.id, 'soloChanged');
    }
    
    setSynthParam(paramPath, value) {
        if (!this.instrument || this.type !== 'Synth') return;
        try {
            this.instrument.set({ [paramPath]: value });
            this.synthParams = this.instrument.get();
        } catch (e) {
            console.error(`Could not set synth param: ${paramPath}`, e);
        }
    }
    
    setInstrumentSamplerPitch(semitones) {
        if (this.type === 'InstrumentSampler' && this.instrument) {
            this.instrumentSamplerSettings.pitchShift = semitones;
            this.instrument.set({ detune: semitones * 100 });
        }
    }

    addEffect(effectType, params, isInitialLoad = false) {
        const effectDef = this.appServices.effectsRegistryAccess?.AVAILABLE_EFFECTS[effectType];
        if (!effectDef) {
            return;
        }
        const initialParams = params || this.appServices.effectsRegistryAccess.getEffectDefaultParams(effectType);
        const toneNode = createEffectInstance(effectType, initialParams);

        if (toneNode) {
            const effectData = { 
                id: `effect-${this.id}-${Date.now()}`, 
                type: effectType, 
                toneNode: toneNode, 
                params: JSON.parse(JSON.stringify(initialParams)) 
            };
            this.activeEffects.push(effectData);
            this.rebuildEffectChain();
            if (!isInitialLoad) {
                this.appServices.updateTrackUI?.(this.id, 'effectsChanged');
                this.appServices.captureStateForUndo?.(`Add ${effectDef.displayName} to ${this.name}`);
            }
        }
    }

    removeEffect(effectId) {
        const index = this.activeEffects.findIndex(e => e.id === effectId);
        if (index > -1) {
            const removedEffect = this.activeEffects.splice(index, 1)[0];
            removedEffect.toneNode?.dispose();
            this.rebuildEffectChain();
            this.appServices.updateTrackUI?.(this.id, 'effectsChanged');
            this.appServices.captureStateForUndo?.(`Remove ${removedEffect.type} from ${this.name}`);
        }
    }

    addNoteToSequence(sequenceId, pitchIndex, timeStep, noteData = { velocity: 0.75, duration: 1 }) {
        const sequence = this.sequences.find(s => s.id === sequenceId);
        if (sequence && sequence.data[pitchIndex] !== undefined) {
            sequence.data[pitchIndex][timeStep] = noteData;
            this.appServices.captureStateForUndo?.(`Add note to ${this.name}`);
            this.recreateToneSequence();
        }
    }

    removeNoteFromSequence(sequenceId, pitchIndex, timeStep) {
        const sequence = this.sequences.find(s => s.id === sequenceId);
        if (sequence && sequence.data[pitchIndex] !== undefined) {
            sequence.data[pitchIndex][timeStep] = null;
            this.appServices.captureStateForUndo?.(`Remove note from ${this.name}`);
            this.recreateToneSequence();
        }
    }
    
    getActiveSequence() {
        if (!this.activeSequenceId && this.sequences.length > 0) {
            this.activeSequenceId = this.sequences[0].id;
        }
        return this.sequences.find(s => s.id === this.activeSequenceId);
    }

    createNewSequence(name, length, skipUndo) {
        if (this.type === 'Audio') return;
        const newSeqId = `seq_${this.id}_${Date.now()}`;
        const numRows = Constants.SYNTH_PITCHES.length;
        const newSequence = {
            id: newSeqId,
            name: name,
            data: Array(numRows).fill(null).map(() => Array(length).fill(null)),
            length: length
        };
        this.sequences.push(newSequence);
        this.activeSequenceId = newSeqId;
        if (!skipUndo) {
            this.appServices.captureStateForUndo?.(`Create Sequence "${name}" on ${this.name}`);
        }
    }
    
    async addExternalAudioFileAsClip(audioBlob, startTime, clipName) {
        if (this.type !== 'Audio') {
            console.error("Cannot add audio clip to non-audio track.");
            return;
        }
        try {
            const dbKey = `clip-${this.id}-${Date.now()}-${clipName}`;
            await this.appServices.dbStoreAudio(dbKey, audioBlob);
            
            const audioBuffer = await Tone.context.decodeAudioData(await audioBlob.arrayBuffer());

            const newClip = {
                id: `clip-${this.id}-${Date.now()}`,
                name: clipName,
                dbKey: dbKey,
                startTime: startTime,
                duration: audioBuffer.duration,
                audioBuffer: audioBuffer,
            };

            this.timelineClips.push(newClip);
            this.appServices.renderTimeline?.();
        } catch (error) {
            console.error("Error adding audio clip:", error);
            this.appServices.showNotification?.('Failed to process and add audio clip.', 3000);
        }
    }
    
    recreateToneSequence() {
        this.toneSequence?.dispose();
        this.toneSequence = null;

        const activeSequence = this.getActiveSequence();
        if (!activeSequence) return;
        
        const events = [];
        for (let step = 0; step < activeSequence.length; step++) {
            const notesInStep = [];
            for (let row = 0; row < activeSequence.data.length; row++) {
                if (activeSequence.data[row]?.[step]) {
                    const pitch = Constants.SYNTH_PITCHES[row];
                    notesInStep.push(pitch);
                }
            }
            events.push(notesInStep);
        }

        if (this.type === 'Synth' || this.type === 'InstrumentSampler') {
            if (!this.instrument) return;
            this.toneSequence = new Tone.Sequence((time, note) => {
                this.instrument.triggerAttackRelease(note, "16n", time);
            }, events, "16n").start(0);

        } else if (this.type === 'Sampler' || this.type === 'DrumSampler') {
            this.toneSequence = new Tone.Sequence((time, value) => {
                if (!value) {
                    return;
                }
                const notes = Array.isArray(value) ? value : [value];

                notes.forEach(note => {
                    const midi = Tone.Midi(note).toMidi();
                    const sampleIndex = midi - Constants.SAMPLER_PIANO_ROLL_START_NOTE;

                    if (sampleIndex >= 0 && sampleIndex < Constants.NUM_SAMPLER_NOTES) {
                        if (this.type === 'Sampler') {
                            this.appServices.playSlicePreview?.(this.id, sampleIndex, 1.0, 0, time);
                        } else {
                            this.appServices.playDrumSamplerPadPreview?.(this.id, sampleIndex, 1.0, 0, time);
                        }
                    }
                });
            }, events, "16n").start(0);
        }

        if (this.toneSequence) {
            this.toneSequence.loop = true;
        }
    }
    
    getDefaultSynthParams() {
        return {
            portamento: 0,
            oscillator: { type: 'sine' },
            envelope: { 
                attack: 0.005, 
                decay: 2.0,
                sustain: 0,
                release: 5.0
            },
            filter: { type: 'lowpass', rolloff: -12, Q: 1, frequency: 10000 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7 }
        };
    }

    dispose() {
        this.toneSequence?.dispose();
        this.instrument?.dispose();
        this.input?.dispose();
        this.outputNode?.dispose();
        this.trackMeter?.dispose();
        this.activeEffects.forEach(e => e.toneNode.dispose());
    }
}
