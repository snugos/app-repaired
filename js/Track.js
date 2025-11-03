// js/Track.js - Track Class Module

import * as Constants from './constants.js';
import { createEffectInstance, getEffectDefaultParams as getEffectDefaultParamsFromRegistry, AVAILABLE_EFFECTS } from './effectsRegistry.js';
import { storeAudio, getAudio } from './db.js';


export class Track {
    constructor(id, type, initialData = null, appServices = {}) {
        this.id = initialData?.id || id;
        this.type = type;
        this.appServices = appServices;

        this.name = initialData?.name || `${type} Track ${this.id}`;
        if (type === 'DrumSampler') {
            this.name = initialData?.name || `Sampler (Pads) ${this.id}`;
        } else if (type === 'Synth') {
            this.name = initialData?.name || `MonoSynth ${this.id}`;
        } else if (type === 'Audio') {
            this.name = initialData?.name || `Audio ${this.id}`;
        }

        this.isMuted = initialData?.isMuted || false;
        const currentSoloedId = this.appServices.getSoloedTrackId ? this.appServices.getSoloedTrackId() : null;
        this.isSoloed = currentSoloedId === this.id;
        this.previousVolumeBeforeMute = initialData?.volume ?? 0.7;


        if (this.type === 'Synth') {
            this.synthEngineType = initialData?.synthEngineType || 'MonoSynth';
            this.synthParams = initialData?.synthParams ? JSON.parse(JSON.stringify(initialData.synthParams)) : this.getDefaultSynthParams();
        } else {
            this.synthEngineType = null;
            this.synthParams = {};
        }

        this.samplerAudioData = initialData?.samplerAudioData || {
            fileName: null, audioBufferDataURL: null, dbKey: null, status: 'empty'
        };
        this.audioBuffer = null;
        this.slices = initialData?.slices || Array(Constants.numSlices).fill(null).map(() => ({
            offset: 0, duration: 0, userDefined: false, volume: 1.0, pitchShift: 0,
            loop: false, reverse: false,
            envelope: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.1 }
        }));
        this.selectedSliceForEdit = initialData?.selectedSliceForEdit || 0;
        this.waveformZoom = initialData?.waveformZoom || 1;
        this.waveformScrollOffset = initialData?.waveformScrollOffset || 0;
        this.slicerIsPolyphonic = initialData?.slicerIsPolyphonic !== undefined ? initialData.slicerIsPolyphonic : true;
        this.slicerMonoPlayer = null;
        this.slicerMonoEnvelope = null;
        this.slicerMonoGain = null;

        this.instrumentSamplerSettings = initialData?.instrumentSamplerSettings || {
            sampleUrl: null, audioBuffer: null, audioBufferDataURL: null, originalFileName: null, dbKey: null,
            rootNote: 'C4', loop: false, loopStart: 0, loopEnd: 0,
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 }, status: 'empty'
        };
        this.instrumentSamplerIsPolyphonic = initialData?.instrumentSamplerIsPolyphonic !== undefined ? initialData.instrumentSamplerIsPolyphonic : true;
        this.toneSampler = null;

        this.drumSamplerPads = initialData?.drumSamplerPads || Array(Constants.numDrumSamplerPads).fill(null).map(() => ({
            sampleUrl: null, audioBuffer: null, audioBufferDataURL: null, originalFileName: null, dbKey: null,
            volume: 0.7, pitchShift: 0,
            envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }, status: 'empty'
        }));
        if (initialData?.drumSamplerPads) {
            initialData.drumSamplerPads.forEach((padData, index) => {
                if (this.drumSamplerPads[index]) {
                    this.drumSamplerPads[index].audioBufferDataURL = padData.audioBufferDataURL || null;
                    this.drumSamplerPads[index].originalFileName = padData.originalFileName || null;
                    this.drumSamplerPads[index].dbKey = padData.dbKey || null;
                    this.drumSamplerPads[index].volume = padData.volume ?? 0.7;
                    this.drumSamplerPads[index].pitchShift = padData.pitchShift ?? 0;
                    this.drumSamplerPads[index].envelope = padData.envelope ? JSON.parse(JSON.stringify(padData.envelope)) : { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 };
                    this.drumSamplerPads[index].status = padData.status || (padData.audioBufferDataURL || padData.dbKey ? 'missing' : 'empty');
                }
            });
        }
        this.selectedDrumPadForEdit = initialData?.selectedDrumPadForEdit || 0;
        this.drumPadPlayers = Array(Constants.numDrumSamplerPads).fill(null);

        this.activeEffects = [];
        if (initialData && initialData.activeEffects && Array.isArray(initialData.activeEffects)) {
            initialData.activeEffects.forEach(effectData => {
                const getDefaults = this.appServices.effectsRegistryAccess?.getEffectDefaultParams || getEffectDefaultParamsFromRegistry;
                const paramsForInstance = effectData.params ? JSON.parse(JSON.stringify(effectData.params)) : getDefaults(effectData.type);
                const toneNode = createEffectInstance(effectData.type, paramsForInstance);
                if (toneNode) {
                    this.activeEffects.push({
                        id: effectData.id || `effect-${this.id}-${effectData.type}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                        type: effectData.type, toneNode: toneNode, params: paramsForInstance
                    });
                }
            });
        }

        this.gainNode = null; this.trackMeter = null; this.outputNode = null;
        this.instrument = null;
        this.sequenceLength = initialData?.sequenceLength || Constants.defaultStepsPerBar;
        let numRowsForGrid;
        if (type === 'Synth' || type === 'InstrumentSampler') numRowsForGrid = Constants.synthPitches.length;
        else if (type === 'Sampler') numRowsForGrid = this.slices.length > 0 ? this.slices.length : Constants.numSlices;
        else if (type === 'DrumSampler') numRowsForGrid = Constants.numDrumSamplerPads;
        else if (type === 'Audio') numRowsForGrid = 0; // Audio tracks don't use grid sequencer
        else numRowsForGrid = 0;

        const loadedSequenceData = initialData?.sequenceData;
        if (type !== 'Audio') { // Audio tracks don't have sequenceData in the same way
            this.sequenceData = Array(numRowsForGrid).fill(null).map((_, rIndex) => {
                const row = Array(this.sequenceLength).fill(null);
                if (loadedSequenceData && loadedSequenceData[rIndex]) {
                    for (let c = 0; c < Math.min(this.sequenceLength, loadedSequenceData[rIndex].length); c++) {
                        row[c] = loadedSequenceData[rIndex][c];
                    }
                }
                return row;
            });
        } else {
            this.sequenceData = []; // No sequence data for audio tracks
        }
        this.sequence = null;

        this.waveformCanvasCtx = null;
        this.instrumentWaveformCanvasCtx = null;

        this.automation = initialData?.automation || { volume: [] };
        this.inspectorControls = {};

        // Properties for Audio Track Type
        this.audioClips = []; // Array to store audio clip metadata
        this.inputChannel = null; // Tone.Channel for receiving audio from microphone
        this.clipPlayers = new Map(); // To manage playback instances of audio clips

        if (initialData?.audioClips && Array.isArray(initialData.audioClips)) {
            this.audioClips = JSON.parse(JSON.stringify(initialData.audioClips));
        }
    }

    getDefaultSynthParams() {
        return {
            portamento: 0.01,
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 1 },
            filter: { type: 'lowpass', rolloff: -12, Q: 1 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7, exponent: 2 }
        };
    }

    async initializeAudioNodes() {
        // Dispose existing nodes if they exist
        if (this.gainNode && !this.gainNode.disposed) { try { this.gainNode.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old gainNode:`, e.message)} }
        if (this.trackMeter && !this.trackMeter.disposed) { try { this.trackMeter.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old trackMeter:`, e.message)} }
        if (this.inputChannel && !this.inputChannel.disposed && this.type === 'Audio') { // Only dispose if it's an audio track's input channel
            try { this.inputChannel.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old inputChannel:`, e.message)}
        }


        // Create new nodes
        this.gainNode = new Tone.Gain(this.isMuted ? 0 : this.previousVolumeBeforeMute);
        this.trackMeter = new Tone.Meter({ smoothing: 0.8 });
        this.outputNode = this.gainNode; // Default output is the gainNode

        // For Audio tracks, create an input channel that connects to the gainNode
        // This channel will receive audio from the microphone during recording
        if (this.type === 'Audio') {
            this.inputChannel = new Tone.Channel(); // Don't connect yet, rebuildEffectChain will handle it
        }

        this.rebuildEffectChain();
    }
    
    rebuildEffectChain() {
        if (!this.gainNode || this.gainNode.disposed) {
            console.error(`Track ${this.id} has no valid gainNode. Aborting chain rebuild.`);
            return;
        }
        if (!this.trackMeter || this.trackMeter.disposed) {
            this.trackMeter = new Tone.Meter({ smoothing: 0.8 });
        }

        let sourceNodes = [];
        if (this.type === 'Synth' && this.instrument && !this.instrument.disposed) sourceNodes.push(this.instrument);
        else if (this.type === 'InstrumentSampler' && this.toneSampler && !this.toneSampler.disposed) sourceNodes.push(this.toneSampler);
        else if (this.type === 'DrumSampler') sourceNodes = this.drumPadPlayers.filter(p => p && !p.disposed);
        else if (this.type === 'Sampler') {
            if (!this.slicerIsPolyphonic && this.slicerMonoGain && !this.slicerMonoGain.disposed) {
                sourceNodes.push(this.slicerMonoGain);
            }
            // Polyphonic sampler players are created on demand and connect directly to effects/gain
        } else if (this.type === 'Audio') {
            // For Audio tracks, the source is the inputChannel, which is then routed through effects.
            // Playback of clips will also route through effects.
            if (this.inputChannel && !this.inputChannel.disposed) {
                 sourceNodes.push(this.inputChannel);
            }
        }


        const allManagedNodes = [
            ...sourceNodes, // This now includes inputChannel for Audio tracks
            ...this.activeEffects.map(e => e.toneNode),
            this.gainNode,
            this.trackMeter
        ].filter(node => node && !node.disposed);

        allManagedNodes.forEach(node => {
            try { node.disconnect(); } catch(e) { /* ignore */ }
        });

        if (this.type === 'Sampler' && !this.slicerIsPolyphonic && this.slicerMonoPlayer && !this.slicerMonoPlayer.disposed &&
            this.slicerMonoEnvelope && !this.slicerMonoEnvelope.disposed &&
            this.slicerMonoGain && !this.slicerMonoGain.disposed) {
            try { this.slicerMonoPlayer.disconnect(); } catch(e) {/*ignore*/}
            this.slicerMonoPlayer.chain(this.slicerMonoEnvelope, this.slicerMonoGain);
        }

        let currentOutput = sourceNodes.length > 0 ? (sourceNodes.length === 1 ? sourceNodes[0] : sourceNodes) : null;
        
        // Special handling for sampler types where source might be null initially for polyphonic playback
        if (this.type === 'Sampler' && this.slicerIsPolyphonic) {
            currentOutput = null; // Polyphonic players connect directly later
        }
        // For Audio tracks, if inputChannel is the source, it's handled. Clip players connect directly.
        if (this.type === 'Audio' && !this.inputChannel) { // If inputChannel isn't ready, use null
            currentOutput = null;
        }


        this.activeEffects.forEach(effectWrapper => {
            if (effectWrapper.toneNode && !effectWrapper.toneNode.disposed) {
                if (currentOutput) { // If there's a source (like inputChannel or instrument)
                    if (Array.isArray(currentOutput)) {
                        currentOutput.forEach(outNode => {
                            if (outNode && !outNode.disposed) outNode.connect(effectWrapper.toneNode);
                        });
                    } else if (currentOutput && !currentOutput.disposed) {
                        currentOutput.connect(effectWrapper.toneNode);
                    }
                }
                currentOutput = effectWrapper.toneNode; // The output of this effect becomes the input for the next
            }
        });

        // Connect the end of the source/effects chain to the main gainNode
        if (currentOutput) {
            if (Array.isArray(currentOutput)) {
                currentOutput.forEach(outNode => {
                    if (outNode && !outNode.disposed) outNode.connect(this.gainNode);
                });
            } else if (currentOutput && !currentOutput.disposed) {
                currentOutput.connect(this.gainNode);
            }
        } else if (this.type === 'Audio' && this.inputChannel && !this.inputChannel.disposed && this.activeEffects.length === 0) {
            // If it's an audio track with no effects, connect inputChannel directly to gainNode
            this.inputChannel.connect(this.gainNode);
        }


        if (this.gainNode && !this.gainNode.disposed && this.trackMeter && !this.trackMeter.disposed) {
            this.gainNode.connect(this.trackMeter);
        }

        const masterBusInput = this.appServices.getMasterEffectsBusInputNode ? this.appServices.getMasterEffectsBusInputNode() : null;
        const finalTrackOutput = (this.trackMeter && !this.trackMeter.disposed) ? this.trackMeter : this.gainNode;

        if (finalTrackOutput && !finalTrackOutput.disposed && masterBusInput && !masterBusInput.disposed) {
            finalTrackOutput.connect(masterBusInput);
        } else if (finalTrackOutput && !finalTrackOutput.disposed) {
            console.warn(`[Track ${this.id}] Master effects bus input not available. Connecting directly to destination.`);
            finalTrackOutput.toDestination();
        }

        this.applyMuteState();
        this.applySoloState();
    }


    addEffect(effectType) {
        const AVAILABLE_EFFECTS_LOCAL = this.appServices.effectsRegistryAccess?.AVAILABLE_EFFECTS || {};
        const getEffectDefaultParamsLocal = this.appServices.effectsRegistryAccess?.getEffectDefaultParams || getEffectDefaultParamsFromRegistry;

        if (!AVAILABLE_EFFECTS_LOCAL[effectType]) {
            console.warn(`[Track ${this.id}] Effect type "${effectType}" not found in registry.`);
            if (this.appServices.showNotification) this.appServices.showNotification(`Effect type "${effectType}" not found.`, 3000);
            return;
        }
        const defaultParams = getEffectDefaultParamsLocal(effectType);
        const toneNode = createEffectInstance(effectType, defaultParams);

        if (toneNode) {
            const effectId = `effect-${this.id}-${effectType}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
            this.activeEffects.push({
                id: effectId, type: effectType, toneNode: toneNode, params: JSON.parse(JSON.stringify(defaultParams))
            });
            this.rebuildEffectChain();
            if (this.appServices.updateTrackUI) {
                this.appServices.updateTrackUI(this.id, 'effectsListChanged');
            }
        } else {
            console.warn(`[Track ${this.id}] Could not create Tone.js instance for effect ${effectType}`);
            if (this.appServices.showNotification) this.appServices.showNotification(`Could not create effect: ${effectType}`, 3000);
        }
    }

    removeEffect(effectId) {
        const effectIndex = this.activeEffects.findIndex(e => e.id === effectId);
        if (effectIndex > -1) {
            const effectToRemove = this.activeEffects[effectIndex];
            if (effectToRemove.toneNode && !effectToRemove.toneNode.disposed) {
                try {
                    effectToRemove.toneNode.dispose();
                } catch (e) {
                    console.warn(`[Track ${this.id}] Error disposing effect node:`, e);
                }
            }
            this.activeEffects.splice(effectIndex, 1);
            this.rebuildEffectChain();
            if (this.appServices.updateTrackUI) {
                this.appServices.updateTrackUI(this.id, 'effectsListChanged');
            }
        }
    }

    updateEffectParam(effectId, paramPath, value) {
        const effectWrapper = this.activeEffects.find(e => e.id === effectId);
        if (!effectWrapper || !effectWrapper.toneNode || effectWrapper.toneNode.disposed) {
            console.warn(`[Track ${this.id}] Effect ${effectId} not found or disposed for param update.`);
            return;
        }

        const keys = paramPath.split('.');
        let currentStoredParamLevel = effectWrapper.params;
        for (let i = 0; i < keys.length - 1; i++) {
            currentStoredParamLevel[keys[i]] = currentStoredParamLevel[keys[i]] || {};
            currentStoredParamLevel = currentStoredParamLevel[keys[i]];
        }
        currentStoredParamLevel[keys[keys.length - 1]] = value;

        try {
            let targetObject = effectWrapper.toneNode;
            for (let i = 0; i < keys.length - 1; i++) {
                targetObject = targetObject[keys[i]];
                if (typeof targetObject === 'undefined') {
                    throw new Error(`Nested object for path "${keys.slice(0, i + 1).join('.')}" not found on Tone node.`);
                }
            }
            const finalParamKey = keys[keys.length - 1];
            const paramInstance = targetObject[finalParamKey];

            if (typeof paramInstance !== 'undefined') {
                if (paramInstance && typeof paramInstance.value !== 'undefined' && typeof paramInstance.rampTo === 'function') {
                    paramInstance.rampTo(value, 0.02);
                } else if (paramInstance && typeof paramInstance.value !== 'undefined') {
                    paramInstance.value = value;
                } else {
                    targetObject[finalParamKey] = value;
                }
            } else if (typeof effectWrapper.toneNode.set === 'function' && keys.length > 0) {
                const setObj = {};
                let currentLevelForSet = setObj;
                for(let i = 0; i < keys.length - 1; i++){
                    currentLevelForSet[keys[i]] = {};
                    currentLevelForSet = currentLevelForSet[keys[i]];
                }
                currentLevelForSet[finalParamKey] = value;
                effectWrapper.toneNode.set(setObj);
            } else {
                console.warn(`[Track ${this.id}] Could not set parameter ${paramPath} on effect ${effectWrapper.type}.`);
            }
        } catch (err) {
            console.error(`[Track ${this.id}] Error updating param ${paramPath} for effect ${effectWrapper.type}:`, err, "Value:", value);
        }
    }

    reorderEffect(effectId, newIndex) {
        const oldIndex = this.activeEffects.findIndex(e => e.id === effectId);
        if (oldIndex === -1) return;

        newIndex = Math.max(0, Math.min(newIndex, this.activeEffects.length - 1));
        if (oldIndex === newIndex) return;

        const [effectToMove] = this.activeEffects.splice(oldIndex, 1);
        this.activeEffects.splice(newIndex, 0, effectToMove);
        this.rebuildEffectChain();

        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'effectsListChanged');
        }
    }

    async fullyInitializeAudioResources() {
        if (!this.gainNode || this.gainNode.disposed) {
            await this.initializeAudioNodes(); // This will also call rebuildEffectChain
        }

        try {
            if (this.type === 'Synth') {
                await this.initializeInstrument();
            } else if (this.type === 'Sampler') {
                if (this.samplerAudioData && (this.samplerAudioData.dbKey || this.samplerAudioData.audioBufferDataURL)) {
                    let audioFile;
                    if (this.samplerAudioData.dbKey) {
                        audioFile = await getAudio(this.samplerAudioData.dbKey).catch(err => {
                            console.error(`[Track ${this.id}] Error getting audio from DB for key ${this.samplerAudioData.dbKey}:`, err);
                            this.samplerAudioData.status = 'error';
                            if (this.appServices.showNotification) this.appServices.showNotification(`Error loading sample ${this.samplerAudioData.fileName || 'from database'}.`, 3000);
                            return null;
                        });
                    } else if (this.samplerAudioData.audioBufferDataURL) {
                        try {
                            const response = await fetch(this.samplerAudioData.audioBufferDataURL);
                            if (!response.ok) throw new Error(`Failed to fetch data URL for ${this.samplerAudioData.fileName}`);
                            audioFile = await response.blob();
                        } catch (fetchErr) {
                            console.error(`[Track ${this.id}] Error fetching audio from data URL for ${this.samplerAudioData.fileName}:`, fetchErr);
                            this.samplerAudioData.status = 'error';
                            if (this.appServices.showNotification) this.appServices.showNotification(`Error loading sample ${this.samplerAudioData.fileName || 'from data URL'}.`, 3000);
                            audioFile = null;
                        }
                    }

                    if (audioFile) {
                        const objectURL = URL.createObjectURL(audioFile);
                        try {
                            this.audioBuffer = await new Tone.Buffer().load(objectURL);
                            this.samplerAudioData.status = 'loaded';
                            if (!this.slicerIsPolyphonic) this.setupSlicerMonoNodes();
                            if (this.appServices.autoSliceSample && this.audioBuffer.loaded && this.slices.every(s => s.duration === 0)) {
                                this.appServices.autoSliceSample(this.id);
                            }
                        } catch (toneLoadErr) {
                            console.error(`[Track ${this.id}] Tone.Buffer load error for ${this.samplerAudioData.fileName}:`, toneLoadErr);
                            this.samplerAudioData.status = 'error';
                            if (this.appServices.showNotification) this.appServices.showNotification(`Error processing sample ${this.samplerAudioData.fileName}.`, 3000);
                        } finally {
                            URL.revokeObjectURL(objectURL);
                        }
                    } else if (this.samplerAudioData.status !== 'error') {
                        this.samplerAudioData.status = this.samplerAudioData.dbKey ? 'missing_db' : 'error';
                    }
                }
            } else if (this.type === 'DrumSampler') {
                for (let i = 0; i < this.drumSamplerPads.length; i++) {
                    const pad = this.drumSamplerPads[i];
                    if (pad.dbKey || pad.audioBufferDataURL) {
                        let audioFile;
                        try {
                            if (pad.dbKey) {
                                audioFile = await getAudio(pad.dbKey).catch(err => {
                                    console.error(`[Track ${this.id}] Error getting audio for drum pad ${i} from DB (key ${pad.dbKey}):`, err);
                                    pad.status = 'error'; return null;
                                });
                            } else if (pad.audioBufferDataURL) {
                                const response = await fetch(pad.audioBufferDataURL);
                                if (!response.ok) throw new Error(`Failed to fetch data URL for drum pad ${i}`);
                                audioFile = await response.blob();
                            }

                            if (audioFile) {
                                const objectURL = URL.createObjectURL(audioFile);
                                try {
                                    pad.audioBuffer = await new Tone.Buffer().load(objectURL);
                                    if (this.drumPadPlayers[i] && !this.drumPadPlayers[i].disposed) this.drumPadPlayers[i].dispose();
                                    this.drumPadPlayers[i] = new Tone.Player(pad.audioBuffer);
                                    pad.status = 'loaded';
                                } catch (toneLoadErr) {
                                    console.error(`[Track ${this.id}] Tone.Buffer load error for drum pad ${i} (${pad.originalFileName}):`, toneLoadErr);
                                    pad.status = 'error';
                                } finally {
                                    URL.revokeObjectURL(objectURL);
                                }
                            } else if (pad.status !== 'error') {
                                pad.status = pad.dbKey ? 'missing_db' : 'error';
                            }
                        } catch (loadErr) {
                             console.error(`[Track ${this.id}] Error loading resource for drum pad ${i} (${pad.originalFileName}):`, loadErr);
                             pad.status = 'error';
                        }
                    }
                }
            } else if (this.type === 'InstrumentSampler') {
                 if (this.instrumentSamplerSettings.dbKey || this.instrumentSamplerSettings.audioBufferDataURL) {
                    let audioFile;
                    try {
                        if (this.instrumentSamplerSettings.dbKey) {
                           audioFile = await getAudio(this.instrumentSamplerSettings.dbKey).catch(err => {
                                console.error(`[Track ${this.id}] Error getting audio for instrument sampler from DB (key ${this.instrumentSamplerSettings.dbKey}):`, err);
                                this.instrumentSamplerSettings.status = 'error'; return null;
                           });
                        } else if (this.instrumentSamplerSettings.audioBufferDataURL) {
                            const response = await fetch(this.instrumentSamplerSettings.audioBufferDataURL);
                            if (!response.ok) throw new Error(`Failed to fetch data URL for instrument sampler`);
                            audioFile = await response.blob();
                        }
                        if (audioFile) {
                            const objectURL = URL.createObjectURL(audioFile);
                            try {
                                this.instrumentSamplerSettings.audioBuffer = await new Tone.Buffer().load(objectURL);
                                this.instrumentSamplerSettings.status = 'loaded';
                            } catch (toneLoadErr) {
                                console.error(`[Track ${this.id}] Tone.Buffer load error for instrument sampler:`, toneLoadErr);
                                this.instrumentSamplerSettings.status = 'error';
                            } finally {
                                URL.revokeObjectURL(objectURL);
                            }
                        } else if(this.instrumentSamplerSettings.status !== 'error') {
                            this.instrumentSamplerSettings.status = this.instrumentSamplerSettings.dbKey ? 'missing_db' : 'error';
                        }
                    } catch (loadErr) {
                        console.error(`[Track ${this.id}] Error loading resource for instrument sampler:`, loadErr);
                        this.instrumentSamplerSettings.status = 'error';
                    }
                }
                this.setupToneSampler();
            }
            // For Audio tracks, clips are loaded on demand during playback scheduling or when displayed on timeline.
            // No bulk loading here for audio clips, but ensure inputChannel is set up.
            if (this.type === 'Audio' && (!this.inputChannel || this.inputChannel.disposed)) {
                await this.initializeAudioNodes(); // Ensures inputChannel is created
            }

        } catch (error) {
            console.error(`[Track ${this.id}] Overall error in fullyInitializeAudioResources for ${this.type}:`, error);
            if (this.appServices.showNotification) this.appServices.showNotification(`Major error loading audio for ${this.name}.`, 4000);
            if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sampleLoadError');
        }

        if (this.type !== 'Audio') { // Audio tracks don't use Tone.Sequence
            this.setSequenceLength(this.sequenceLength, true);
        }
        this.rebuildEffectChain(); // Ensure chain is correct after all resources are potentially loaded
    }

    async initializeInstrument() {
        if (this.type === 'Synth') {
            if (this.instrument && !this.instrument.disposed) {
                this.instrument.dispose();
            }
            this.instrument = new Tone.MonoSynth(this.synthParams);
            // No need to call rebuildEffectChain here, as fullyInitializeAudioResources will do it
        }
    }

    setupSlicerMonoNodes() {
        this.disposeSlicerMonoNodes();
        if (!this.slicerIsPolyphonic) {
            this.slicerMonoPlayer = new Tone.Player();
            this.slicerMonoEnvelope = new Tone.AmplitudeEnvelope();
            this.slicerMonoGain = new Tone.Gain();
            this.slicerMonoPlayer.chain(this.slicerMonoEnvelope, this.slicerMonoGain);

            if (this.audioBuffer && this.audioBuffer.loaded) {
                this.slicerMonoPlayer.buffer = this.audioBuffer;
            }
        }
    }
    disposeSlicerMonoNodes() {
        if (this.slicerMonoPlayer && !this.slicerMonoPlayer.disposed) { this.slicerMonoPlayer.dispose(); }
        if (this.slicerMonoEnvelope && !this.slicerMonoEnvelope.disposed) { this.slicerMonoEnvelope.dispose(); }
        if (this.slicerMonoGain && !this.slicerMonoGain.disposed) { this.slicerMonoGain.dispose(); }
        this.slicerMonoPlayer = null; this.slicerMonoEnvelope = null; this.slicerMonoGain = null;
    }

    setupToneSampler() {
        if (this.type === 'InstrumentSampler') {
            if (this.toneSampler && !this.toneSampler.disposed) {
                this.toneSampler.dispose();
            }
            if (this.instrumentSamplerSettings.audioBuffer && this.instrumentSamplerSettings.audioBuffer.loaded) {
                const urls = {};
                urls[this.instrumentSamplerSettings.rootNote || 'C4'] = this.instrumentSamplerSettings.audioBuffer;
                try {
                    this.toneSampler = new Tone.Sampler({
                        urls: urls,
                        attack: this.instrumentSamplerSettings.envelope.attack,
                        release: this.instrumentSamplerSettings.envelope.release,
                        onload: () => {
                            if (this.toneSampler && !this.toneSampler.disposed) {
                                this.toneSampler.loop = this.instrumentSamplerSettings.loop;
                                this.toneSampler.loopStart = this.instrumentSamplerSettings.loopStart;
                                this.toneSampler.loopEnd = this.instrumentSamplerSettings.loopEnd;
                            }
                        }
                    });
                    // No rebuildEffectChain here, fullyInitializeAudioResources handles it
                } catch (e) {
                    console.error(`[Track ${this.id}] Error creating Tone.Sampler:`, e);
                    if (this.appServices.showNotification) this.appServices.showNotification(`Error creating instrument sampler for ${this.name}.`, 3000);
                    this.toneSampler = null;
                }
            } else {
                 this.toneSampler = null;
            }
        }
    }

    setVolume(volume, fromInteraction = false) {
        this.previousVolumeBeforeMute = volume;
        if (this.gainNode && !this.gainNode.disposed && !this.isMuted) {
            this.gainNode.gain.setValueAtTime(volume, Tone.now());
        }
    }

    applyMuteState() {
        if (this.gainNode && !this.gainNode.disposed) {
            const currentSoloedId = this.appServices.getSoloedTrackId ? this.appServices.getSoloedTrackId() : null;
            const isEffectivelyMuted = this.isMuted || (currentSoloedId !== null && currentSoloedId !== this.id);
            this.gainNode.gain.cancelScheduledValues(Tone.now());
            this.gainNode.gain.rampTo(isEffectivelyMuted ? 0 : this.previousVolumeBeforeMute, 0.01);
        }
    }

    applySoloState() {
        this.applyMuteState();
    }

    setSynthParam(paramPath, value) {
        if (this.type !== 'Synth' || !this.instrument || this.instrument.disposed) return;
        try {
            const keys = paramPath.split('.');
            let target = this.instrument;
            let paramsTarget = this.synthParams;

            for (let i = 0; i < keys.length - 1; i++) {
                target = target[keys[i]];
                paramsTarget[keys[i]] = paramsTarget[keys[i]] || {};
                paramsTarget = paramsTarget[keys[i]];
            }
            const finalKey = keys[keys.length - 1];
            paramsTarget[finalKey] = value;

            if (target && target[finalKey] && typeof target[finalKey].setValueAtTime === 'function') {
                target[finalKey].setValueAtTime(value, Tone.now());
            } else if (target && typeof target[finalKey] !== 'undefined' && typeof target[finalKey].value !== 'undefined') {
                 target[finalKey].value = value;
            }
            else if (target && typeof target[finalKey] !== 'undefined') {
                target[finalKey] = value;
            } else if (typeof target.set === 'function') {
                const setObj = {};
                let currentLevel = setObj;
                keys.forEach((k, idx) => {
                    if (idx === keys.length -1) currentLevel[k] = value;
                    else { currentLevel[k] = {}; currentLevel = currentLevel[k];}
                });
                target.set(setObj);
            }

        } catch (e) {
            console.error(`[Track ${this.id}] Error setting synth param ${paramPath} to ${value}:`, e);
        }
    }

    setSliceVolume(sliceIndex, volume) {
        if (this.slices[sliceIndex]) this.slices[sliceIndex].volume = parseFloat(volume);
    }
    setSlicePitchShift(sliceIndex, semitones) {
        if (this.slices[sliceIndex]) this.slices[sliceIndex].pitchShift = parseInt(semitones);
    }
    setSliceLoop(sliceIndex, loop) {
        if (this.slices[sliceIndex]) this.slices[sliceIndex].loop = !!loop;
    }
    setSliceReverse(sliceIndex, reverse) {
        if (this.slices[sliceIndex]) this.slices[sliceIndex].reverse = !!reverse;
    }
    setSliceEnvelopeParam(sliceIndex, param, value) {
        if (this.slices[sliceIndex] && this.slices[sliceIndex].envelope) {
            this.slices[sliceIndex].envelope[param] = parseFloat(value);
        }
    }

    setDrumSamplerPadVolume(padIndex, volume) {
        if (this.drumSamplerPads[padIndex]) this.drumSamplerPads[padIndex].volume = parseFloat(volume);
    }
    setDrumSamplerPadPitch(padIndex, pitch) {
        if (this.drumSamplerPads[padIndex]) this.drumSamplerPads[padIndex].pitchShift = parseInt(pitch);
    }
    setDrumSamplerPadEnv(padIndex, param, value) {
        if (this.drumSamplerPads[padIndex] && this.drumSamplerPads[padIndex].envelope) {
            this.drumSamplerPads[padIndex].envelope[param] = parseFloat(value);
        }
    }

    setInstrumentSamplerRootNote(noteName) {
        this.instrumentSamplerSettings.rootNote = noteName;
        this.setupToneSampler();
    }
    setInstrumentSamplerLoop(loop) {
        this.instrumentSamplerSettings.loop = !!loop;
        if (this.toneSampler && !this.toneSampler.disposed) this.toneSampler.loop = this.instrumentSamplerSettings.loop;
    }
    setInstrumentSamplerLoopStart(time) {
        this.instrumentSamplerSettings.loopStart = parseFloat(time);
        if (this.toneSampler && !this.toneSampler.disposed) this.toneSampler.loopStart = this.instrumentSamplerSettings.loopStart;
    }
    setInstrumentSamplerLoopEnd(time) {
        this.instrumentSamplerSettings.loopEnd = parseFloat(time);
        if (this.toneSampler && !this.toneSampler.disposed) this.toneSampler.loopEnd = this.instrumentSamplerSettings.loopEnd;
    }
    setInstrumentSamplerEnv(param, value) {
        this.instrumentSamplerSettings.envelope[param] = parseFloat(value);
        if (this.toneSampler && !this.toneSampler.disposed) {
            if (param === 'attack' && typeof this.toneSampler.attack !== 'undefined') this.toneSampler.attack = value;
            if (param === 'release' && typeof this.toneSampler.release !== 'undefined') this.toneSampler.release = value;
        }
    }

    _captureUndoState(description) {
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(description);
        }
    }

    doubleSequence() {
        if (this.type === 'Audio') return; // Audio tracks don't use this
        this._captureUndoState(`Double Sequence Length for ${this.name}`);

        const oldLength = this.sequenceLength;
        const newLength = oldLength * 2;
        if (newLength > (Constants.MAX_BARS * Constants.STEPS_PER_BAR) ) {
            if(this.appServices.showNotification) this.appServices.showNotification(`Cannot double length, exceeds maximum of ${Constants.MAX_BARS} bars.`, 3000);
            return;
        }

        this.sequenceData.forEach(row => {
            if(row) {
               const copyOfOriginal = row.slice(0, oldLength);
               row.length = newLength;
               for(let i = oldLength; i < newLength; i++) {
                   row[i] = null;
               }
               for(let i = 0; i < oldLength; i++) {
                   if (copyOfOriginal[i]) {
                       row[oldLength + i] = JSON.parse(JSON.stringify(copyOfOriginal[i]));
                   }
               }
            }
        });

        this.setSequenceLength(newLength, true);
         if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
        }
    }

    setSequenceLength(newLengthInSteps, skipUndoCapture = false) {
        if (this.type === 'Audio') return; // Audio tracks don't use Tone.Sequence

        const oldActualLength = this.sequenceLength;
        newLengthInSteps = Math.max(Constants.STEPS_PER_BAR, parseInt(newLengthInSteps) || Constants.defaultStepsPerBar);
        newLengthInSteps = Math.ceil(newLengthInSteps / Constants.STEPS_PER_BAR) * Constants.STEPS_PER_BAR;
        newLengthInSteps = Math.min(newLengthInSteps, Constants.MAX_BARS * Constants.STEPS_PER_BAR);


        if (!skipUndoCapture && oldActualLength !== newLengthInSteps) {
            this._captureUndoState(`Set Seq Length for ${this.name} to ${newLengthInSteps / Constants.STEPS_PER_BAR} bars`);
        }
        this.sequenceLength = newLengthInSteps;
        let numRows;
        if (this.type === 'Synth' || this.type === 'InstrumentSampler') numRows = Constants.synthPitches.length;
        else if (this.type === 'Sampler') numRows = this.slices.length > 0 ? this.slices.length : Constants.numSlices;
        else if (this.type === 'DrumSampler') numRows = Constants.numDrumSamplerPads;
        else numRows = (this.sequenceData && this.sequenceData.length > 0) ? this.sequenceData.length : 0;

        const currentSequenceData = this.sequenceData || [];
        this.sequenceData = Array(numRows).fill(null).map((_, rIndex) => {
            const currentRow = currentSequenceData[rIndex] || [];
            const newRow = Array(this.sequenceLength).fill(null);
            for (let c = 0; c < Math.min(currentRow.length, this.sequenceLength); c++) newRow[c] = currentRow[c];
            return newRow;
        });

        if (this.sequence && !this.sequence.disposed) { this.sequence.stop(); this.sequence.clear(); this.sequence.dispose(); this.sequence = null; }

        this.sequence = new Tone.Sequence((time, col) => {
            const currentGlobalSoloId = this.appServices.getSoloedTrackId ? this.appServices.getSoloedTrackId() : null;
            const isEffectivelyMuted = this.isMuted || (currentGlobalSoloId !== null && currentGlobalSoloId !== this.id);

            if (this.appServices.highlightPlayingStep) {
                 this.appServices.highlightPlayingStep(this.id, col);
            }

            if (!this.gainNode || this.gainNode.disposed || isEffectivelyMuted) {
                return;
            }

            const effectsChainStartPoint = (this.activeEffects.length > 0 && this.activeEffects[0].toneNode && !this.activeEffects[0].toneNode.disposed)
                ? this.activeEffects[0].toneNode
                : this.gainNode;


            if (this.type === 'Synth' && this.instrument && !this.instrument.disposed) {
                 let notePlayedThisStep = false;
                 for (let rowIndex = 0; rowIndex < Constants.synthPitches.length; rowIndex++) {
                    const pitchName = Constants.synthPitches[rowIndex];
                    const step = this.sequenceData[rowIndex]?.[col];
                    if (step?.active && !notePlayedThisStep) {
                        this.instrument.triggerAttackRelease(pitchName, "8n", time, step.velocity * Constants.defaultVelocity);
                        notePlayedThisStep = true;
                    }
                }
            } else if (this.type === 'Sampler') {
                this.slices.forEach((sliceData, sliceIndex) => {
                    const step = this.sequenceData[sliceIndex]?.[col];
                    if (step?.active && sliceData?.duration > 0 && this.audioBuffer?.loaded) {
                        const playbackRate = Math.pow(2, (sliceData.pitchShift || 0) / 12);
                        let playDuration = sliceData.duration / playbackRate;
                        if (sliceData.loop) playDuration = Tone.Time("8n").toSeconds();

                        if (this.slicerIsPolyphonic) {
                            const tempPlayer = new Tone.Player(this.audioBuffer);
                            const tempEnv = new Tone.AmplitudeEnvelope(sliceData.envelope);
                            const tempGain = new Tone.Gain(step.velocity * sliceData.volume);
                            tempPlayer.chain(tempEnv, tempGain, effectsChainStartPoint);
                            tempPlayer.playbackRate = playbackRate; tempPlayer.reverse = sliceData.reverse; tempPlayer.loop = sliceData.loop;
                            tempPlayer.loopStart = sliceData.offset; tempPlayer.loopEnd = sliceData.offset + sliceData.duration;
                            tempPlayer.start(time, sliceData.offset, sliceData.loop ? undefined : playDuration);
                            tempEnv.triggerAttack(time);
                            if (!sliceData.loop) tempEnv.triggerRelease(time + playDuration * 0.95);
                            Tone.Transport.scheduleOnce(() => { if(tempPlayer && !tempPlayer.disposed) tempPlayer.dispose(); if(tempEnv && !tempEnv.disposed) tempEnv.dispose(); if(tempGain && !tempGain.disposed) tempGain.dispose(); }, time + playDuration + (sliceData.envelope.release || 0.1) + 0.2);
                        } else if (this.slicerMonoPlayer && !this.slicerMonoPlayer.disposed && this.slicerMonoEnvelope && !this.slicerMonoEnvelope.disposed && this.slicerMonoGain && !this.slicerMonoGain.disposed) {
                            if (this.slicerMonoGain.numberOfOutputs === 0 || !this.slicerMonoGain.connectedTo(effectsChainStartPoint)) {
                                try { this.slicerMonoGain.disconnect(); } catch(e) {/*ignore*/}
                                this.slicerMonoGain.connect(effectsChainStartPoint);
                            }
                            if (this.slicerMonoPlayer.state === 'started') this.slicerMonoPlayer.stop(time);
                            this.slicerMonoEnvelope.triggerRelease(time);

                            this.slicerMonoPlayer.buffer = this.audioBuffer;
                            this.slicerMonoEnvelope.set(sliceData.envelope);
                            this.slicerMonoGain.gain.value = step.velocity * sliceData.volume;
                            this.slicerMonoPlayer.playbackRate = playbackRate;
                            this.slicerMonoPlayer.reverse = sliceData.reverse;
                            this.slicerMonoPlayer.loop = sliceData.loop;
                            this.slicerMonoPlayer.loopStart = sliceData.offset;
                            this.slicerMonoPlayer.loopEnd = sliceData.offset + sliceData.duration;

                            this.slicerMonoPlayer.start(time, sliceData.offset, sliceData.loop ? undefined : playDuration);
                            this.slicerMonoEnvelope.triggerAttack(time);
                            if (!sliceData.loop) {
                                const releaseTime = time + playDuration - (sliceData.envelope.release * 0.05);
                                this.slicerMonoEnvelope.triggerRelease(Math.max(time, releaseTime));
                            }
                        }
                    }
                });
            } else if (this.type === 'DrumSampler') {
                Array.from({ length: Constants.numDrumSamplerPads }).forEach((_, padIndex) => {
                    const step = this.sequenceData[padIndex]?.[col];
                    const padData = this.drumSamplerPads[padIndex];
                    if (step?.active && padData && this.drumPadPlayers[padIndex]?.loaded) {
                        const player = this.drumPadPlayers[padIndex];
                        player.volume.value = Tone.dbToGain(padData.volume * step.velocity);
                        player.playbackRate = Math.pow(2, (padData.pitchShift || 0) / 12);
                        player.start(time);
                    }
                });
            } else if (this.type === 'InstrumentSampler' && this.toneSampler?.loaded) {
                 let notePlayedThisStepInColumn = false;
                 Constants.synthPitches.forEach((pitchName, rowIndex) => {
                    const step = this.sequenceData[rowIndex]?.[col];
                    if (step?.active) {
                        if (!this.instrumentSamplerIsPolyphonic && !notePlayedThisStepInColumn) {
                            this.toneSampler.releaseAll(time);
                            notePlayedThisStepInColumn = true;
                        }
                        this.toneSampler.triggerAttackRelease(Tone.Frequency(pitchName).toNote(), "8n", time, step.velocity * Constants.defaultVelocity);
                    }
                });
            }
        }, Array.from(Array(this.sequenceLength).keys()), "16n").start(0);

        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
        }
    }

    async addAudioClip(blob, startTime) {
        if (this.type !== 'Audio') return;
        const clipId = `clip_${this.id}_${Date.now()}`;
        const dbKey = `clip_${this.id}_${Date.now()}.wav`; // Store as WAV

        try {
            await storeAudio(dbKey, blob); // Assumes blob is already in WAV format
            const duration = await this.getBlobDuration(blob);

            const newClip = {
                id: clipId,
                dbKey: dbKey,
                startTime: startTime,
                duration: duration,
                name: `Rec ${new Date().toLocaleTimeString()}`
            };

            this.audioClips.push(newClip);

            if (this.appServices.renderTimeline) {
                this.appServices.renderTimeline();
            }

        } catch (error) {
            console.error("Error adding audio clip:", error);
            if (this.appServices.showNotification) {
                this.appServices.showNotification("Failed to save recorded clip.", 3000);
            }
        }
    }
    
    async getBlobDuration(blob) {
        const tempUrl = URL.createObjectURL(blob);
        const audioContext = Tone.context.rawContext; // Get the underlying AudioContext
        try {
            const arrayBuffer = await fetch(tempUrl).then(res => res.arrayBuffer());
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            return audioBuffer.duration;
        } catch (e) {
            console.error("Error getting blob duration:", e);
            return 0; // Fallback duration
        } finally {
            URL.revokeObjectURL(tempUrl);
        }
    }

    schedulePlayback(transportStartTime, transportStopTime) {
        if (this.type !== 'Audio') return;

        // Clear any previously scheduled players for this track
        this.stopPlayback();

        this.audioClips.forEach(async clip => {
            // Check if the clip overlaps with the current transport's playback segment
            // For simplicity, we'll assume playback starts from transportStartTime
            if (clip.startTime + clip.duration < transportStartTime || clip.startTime > transportStopTime) {
                return; // Clip is not in the playback range
            }

            const player = new Tone.Player();
            this.clipPlayers.set(clip.id, player); // Store player to manage it

            try {
                const audioBlob = await getAudio(clip.dbKey);
                if (audioBlob) {
                    const url = URL.createObjectURL(audioBlob);
                    await player.load(url);
                    
                    // Connect player to the track's effect chain or gain node
                    const destinationNode = (this.activeEffects.length > 0 && this.activeEffects[0].toneNode && !this.activeEffects[0].toneNode.disposed)
                        ? this.activeEffects[0].toneNode
                        : (this.gainNode && !this.gainNode.disposed ? this.gainNode : null);

                    if (destinationNode) {
                        player.connect(destinationNode);
                    } else {
                        console.warn(`[Track ${this.id}] No valid destination for audio clip player.`);
                        player.toDestination(); // Fallback to master directly if no track destination
                    }
                    
                    // Schedule the player to start at its stored startTime relative to transport
                    player.start(clip.startTime);
                    // Player will stop automatically when its audio finishes
                    // If you need to stop it at a specific transport time, use Tone.Transport.scheduleOnce
                }
            } catch (error) {
                console.error(`Error loading or scheduling clip ${clip.id}:`, error);
                if (this.clipPlayers.has(clip.id)) {
                    this.clipPlayers.get(clip.id).dispose();
                    this.clipPlayers.delete(clip.id);
                }
            }
        });
    }

    stopPlayback() {
        this.clipPlayers.forEach((player, id) => {
            if (player && !player.disposed) {
                try {
                    player.stop();
                    player.dispose();
                } catch(e) {
                    console.warn(`Error stopping/disposing player for clip ${id}:`, e);
                }
            }
        });
        this.clipPlayers.clear();
    }

    dispose() {
        if (this.sequence && !this.sequence.disposed) { this.sequence.stop(); this.sequence.clear(); this.sequence.dispose(); }
        if (this.instrument && !this.instrument.disposed) { this.instrument.dispose(); }
        if (this.toneSampler && !this.toneSampler.disposed) { this.toneSampler.dispose(); }
        this.disposeSlicerMonoNodes();
        this.drumPadPlayers.forEach(player => { if (player && !player.disposed) player.dispose(); });
        this.activeEffects.forEach(effect => { if (effect.toneNode && !effect.toneNode.disposed) effect.toneNode.dispose(); });
        if (this.gainNode && !this.gainNode.disposed) { this.gainNode.dispose(); }
        if (this.trackMeter && !this.trackMeter.disposed) { this.trackMeter.dispose(); }
        if (this.inputChannel && !this.inputChannel.disposed) { this.inputChannel.dispose(); } // Dispose inputChannel
        this.stopPlayback(); // Stop and dispose any active clip players

        if (this.appServices.closeAllTrackWindows) {
            this.appServices.closeAllTrackWindows(this.id);
        }

        this.audioBuffer = null;
        this.drumSamplerPads.forEach(p => p.audioBuffer = null);
        if (this.instrumentSamplerSettings) this.instrumentSamplerSettings.audioBuffer = null;
    }
}
