// js/daw/Track.js - Track Class Module (Refactored)

// Removed imports for Constants, EffectChain, SequenceManager, ClipManager,
// getEffectDefaultParams, AVAILABLE_EFFECTS, and all state functions as they are now global
import { EffectChain } from './EffectChain.js'; // Same directory
import { SequenceManager } from './SequenceManager.js'; // Same directory
import { ClipManager } from './ClipManager.js'; // Same directory


class Track { // Removed export
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

        // --- Core Audio Nodes ---
        this.input = new Tone.Gain();
        this.outputNode = new Tone.Gain(this.previousVolumeBeforeMute);
        this.trackMeter = new Tone.Meter();
        
        const masterBusInput = this.appServices.getMasterBusInputNode?.(); // getMasterBusInputNode is global
        if (masterBusInput) {
            this.outputNode.fan(this.trackMeter, masterBusInput);
        } else {
            this.outputNode.fan(this.trackMeter, Tone.getDestination());
        }
        this.input.connect(this.outputNode);
        
        // --- Delegate to Managers ---
        this.effects = new EffectChain(this, this.appServices);
        this.sequences = new SequenceManager(this, this.appServices);
        this.clips = new ClipManager(this, this.appServices);

        this.instrument = null;
        this.synthEngineType = null;
        this.synthParams = {};
        this.samplerAudioData = {};
        this.audioBuffer = null;
        this.slices = [];
        this.selectedSliceForEdit = 0;
        this.drumSamplerPads = [];
        this.instrumentSamplerSettings = {};
        this.inputChannel = (this.type === 'Audio') ? new Tone.Gain().connect(this.input) : null;

        // --- Initialize from initialData ---
        this.effects.initialize(initialData?.activeEffects);
        this.sequences.initialize(initialData?.sequences, initialData?.activeSequenceId);
        this.clips.initialize(initialData?.timelineClips);

        if (this.type === 'Synth') {
            this.synthEngineType = initialData?.synthEngineType || 'MonoSynth';
            this.synthParams = initialData?.synthParams ? JSON.parse(JSON.stringify(initialData.synthParams)) : this.getDefaultSynthParams();
        } else if (this.type === 'Sampler') {
            this.samplerAudioData = { fileName: initialData?.samplerAudioData?.fileName || null, dbKey: initialData?.samplerAudioData?.dbKey || null, status: 'empty' };
            this.slices = initialData?.slices || Array(numSlices || 16).fill(null).map(() => ({ offset: 0, duration: 0, volume: 0.7, pitchShift: 0, loop: false, reverse: false, envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.2 } })); // numSlices is global
            this.selectedSliceForEdit = initialData?.selectedSliceForEdit || 0;
        } else if (this.type === 'DrumSampler') {
            this.drumSamplerPads = Array.from({ length: numDrumSamplerPads || 16 }, (_, i) => // numDrumSamplerPads is global
                initialData?.drumSamplerPads?.[i] || { originalFileName: null, dbKey: null, volume: 0.7, pitchShift: 0, audioBuffer: null }
            );
            this.selectedDrumPadForEdit = initialData?.selectedDrumPadForEdit || 0;
        } else if (this.type === 'InstrumentSampler') {
            this.instrumentSamplerSettings = initialData?.instrumentSamplerSettings || {
                originalFileName: null, dbKey: null, rootNote: 'C4', pitchShift: 0, loop: false, loopStart: 0, loopEnd: 0,
                envelope: { attack: 0.003, decay: 2.0, sustain: 1.0, release: 5.0 }, status: 'empty'
            };
        }

        if (this.type !== 'Audio' && this.sequences.sequences.length === 0) {
            this.sequences.createNewSequence("Sequence 1", 64, true);
        }
    }

    // NEW: Quantize method
    quantizeNotes(sequenceId, noteIdsToQuantize, gridSize = '16n') {
        const sequence = this.sequences.sequences.find(s => s.id === sequenceId);
        if (!sequence || noteIdsToQuantize.size === 0) return;

        this.appServices.captureStateForUndo?.(`Quantize notes in ${this.name}`); // captureStateForUndoInternal is global

        const ticksPerGrid = Tone.Time(gridSize).toTicks();

        const newData = JSON.parse(JSON.stringify(sequence.data));
        const notesToMove = [];

        noteIdsToQuantize.forEach(noteId => {
            const [pitchIndex, timeStep] = noteId.split('-').map(Number);
            const noteData = sequence.data[pitchIndex]?.[timeStep];
            if (noteData) {
                const currentTicks = Tone.Time(`${timeStep}*16n`).toTicks();
                const nearestTick = Math.round(currentTicks / ticksPerGrid) * ticksPerGrid;
                const newTimeStep = Math.round(nearestTick / (Tone.Transport.PPQ / 4));

                if (newTimeStep !== timeStep && newData[pitchIndex]?.[newTimeStep] === null) {
                    notesToMove.push({ oldPitch: pitchIndex, oldTime: timeStep, newTime: newTimeStep, data: noteData });
                }
            }
        });

        notesToMove.forEach(note => {
            newData[note.oldPitch][note.oldTime] = null;
        });
        notesToMove.forEach(note => {
            newData[note.newPitch][note.newTime] = note.data;
            newSelectedNoteIds.add(`${note.newPitch}-${note.newTime}`);
        });
        
        sequence.data = newData;
        this.sequences.recreateToneSequence();
        
        const pianoRollWindow = this.appServices.getWindowById?.(`pianoRollWin-${this.id}`); // getWindowByIdState is global
        if (pianoRollWindow && !pianoRollWindow.isMinimized) {
           if(this.appServices.openPianoRollWindow) {
               pianoRollWindow.close(true);
               this.appServices.openPianoRollWindow(this.id, sequenceId);
           }
        }
    }


    serialize() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            isMuted: this.isMuted,
            volume: this.previousVolumeBeforeMute,
            activeEffects: this.effects.serialize(),
            sequences: this.sequences.serialize().sequences,
            activeSequenceId: this.sequences.serialize().activeSequenceId,
            timelineClips: this.clips.serialize(),
            synthEngineType: this.synthEngineType,
            synthParams: this.synthParams,
            samplerAudioData: this.samplerAudioData,
            slices: this.slices,
            drumSamplerPads: this.drumSamplerPads.map(p => ({
                originalFileName: p.originalFileName,
                dbKey: p.dbKey,
                volume: p.volume,
                pitchShift: p.pitchShift,
            })),
            instrumentSamplerSettings: this.instrumentSamplerSettings,
        };
    }

    async initializeInstrument() {
        if (this.instrument) this.instrument.dispose();
        
        if (this.type === 'Synth') {
            // Tone.PolySynth and Tone.Synth are global
            this.instrument = new Tone.PolySynth(Tone.Synth, {
                polyphony: 16,
                ...this.synthParams 
            });
        } else if (this.type === 'InstrumentSampler' || this.type === 'DrumSampler' || this.type === 'Sampler') {
            // Tone.Sampler is global
             this.instrument = new Tone.Sampler({
                attack: 0.01,
                release: 0.1,
             });
        } else {
            this.instrument = null;
        }

        if (this.instrument) {
            this.instrument.connect(this.input);
        }
        
        this.sequences.recreateToneSequence();
    }
    
    // --- Methods that stay in Track.js ---
    setVolume(volume, fromInteraction = false) {
        this.previousVolumeBeforeMute = volume;
        if (!this.isMuted) this.outputNode.gain.rampTo(volume, 0.02);
        if (fromInteraction) this.appServices.captureStateForUndo?.(`Set Volume for ${this.name} to ${volume.toFixed(2)}`); // captureStateForUndoInternal is global
    }

    applyMuteState() {
        if (!this.outputNode) return;
        this.outputNode.gain.rampTo(this.isMuted ? 0 : this.previousVolumeBeforeMute, 0.02);
    }

    applySoloState(isAnotherTrackSoloed) {
        if (!this.outputNode) return;
        if (isAnotherTrackSoloed) this.outputNode.gain.rampTo(0, 0.02);
        else this.applyMuteState();
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

            let current = this.synthParams;
            const keys = paramPath.split('.');
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]] = current[keys[i]] || {};
            }
            current[keys[keys.length - 1]] = value;

        } catch (e) {
            console.error(`Could not set synth param: ${paramPath}`, e);
        }
    }
    
    getDefaultSynthParams() {
        return {
            portamento: 0,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
            filter: { type: 'lowpass', rolloff: -12, Q: 1, frequency: 10000 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7 }
        };
    }

    // --- Delegated Methods ---
    addEffect(effectType, params, isInitialLoad = false) { return this.effects.addEffect(effectType, params, isInitialLoad); }
    removeEffect(effectId) { return this.effects.removeEffect(effectId); }
    updateEffectParam(effectId, paramPath, value) { return this.effects.updateEffectParam(effectId, paramPath, value); }
    rebuildEffectChain() { return this.effects.rebuildEffectChain(); }

    getActiveSequence() { return this.sequences.getActiveSequence(); }
    createNewSequence(name, length, skipUndo) { return this.sequences.createNewSequence(name, length, skipUndo); }
    addNoteToSequence(sequenceId, pitchIndex, timeStep, noteData) { return this.sequences.addNoteToSequence(sequenceId, pitchIndex, timeStep, noteData); }
    removeNoteFromSequence(sequenceId, pitchIndex, timeStep) { return this.sequences.removeNoteFromSequence(sequenceId, pitchIndex, timeStep); }
    removeNotesFromSequence(sequenceId, notesToRemove) { return this.sequences.removeNotesFromSequence(sequenceId, notesToRemove); }
    setSequenceLength(sequenceId, newLength) { return this.sequences.setSequenceLength(sequenceId, newLength); }
    moveSelectedNotes(sequenceId, selectedNotes, pitchOffset, timeOffset) { return this.sequences.moveSelectedNotes(sequenceId, selectedNotes, pitchOffset, timeOffset); }
    setNoteDuration(sequenceId, pitchIndex, timeStep, newDuration) { return this.sequences.setNoteDuration(sequenceId, pitchIndex, timeStep, newDuration); }
    updateNoteVelocity(sequenceId, pitchIndex, timeStep, newVelocity) { return this.sequences.updateNoteVelocity(sequenceId, pitchIndex, timeStep, newVelocity); }
    clearSequence(sequenceId) { return this.sequences.clearSequence(sequenceId); }
    duplicateSequence(sequenceId) { return this.sequences.duplicateSequence(sequenceId); }
    copyNotesToClipboard(sequenceId, notesToCopy) { return this.sequences.copyNotesToClipboard(sequenceId, notesToCopy); }
    pasteNotesFromClipboard(sequenceId, pastePitchIndex, pasteTimeStep) { return this.sequences.pasteNotesFromClipboard(sequenceId, pastePitchIndex, pasteTimeStep); }
    recreateToneSequence() { return this.sequences.recreateToneSequence(); }
    startSequence() { return this.sequences.startSequence(); }
    stopSequence() { return this.sequences.stopSequence(); }

    addMidiClip(sequence, startTime) { return this.clips.addMidiClip(sequence, startTime); }
    addAudioClip(audioBlob, startTime, clipName) { return this.clips.addAudioClip(audioBlob, startTime, clipName); }
    deleteClip(clipId) { return this.clips.deleteClip(clipId); }

    dispose() {
        this.sequences.dispose();
        this.instrument?.dispose();
        this.input?.dispose();
        this.outputNode?.dispose();
        this.trackMeter?.dispose();
        this.effects.dispose();
        this.drumSamplerPads.forEach(p => p.audioBuffer?.dispose());
        this.audioBuffer?.dispose();
    }
}
