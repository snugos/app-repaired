// js/Track.js - Track Class Module

import * as Constants from './constants.js';
import { createEffectInstance, getEffectDefaultParams as getEffectDefaultParamsFromRegistry, AVAILABLE_EFFECTS } from './effectsRegistry.js';
import { storeAudio, getAudio } from './db.js';


export class Track {
    constructor(id, type, initialData = null, appServices = {}) {
        this.id = ((initialData) && (initialData).id) || id;
        this.type = type;
        this.appServices = appServices || {}; // Ensure appServices is at least an empty object

        this.name = ((initialData) && (initialData).name) || `${type} Track ${this.id}`;
        if (type === 'DrumSampler') {
            this.name = ((initialData) && (initialData).name) || `Sampler (Pads) ${this.id}`;
        } else if (type === 'Synth') {
            this.name = ((initialData) && (initialData).name) || `MonoSynth ${this.id}`;
        } else if (type === 'Audio') {
            this.name = ((initialData) && (initialData).name) || `Audio ${this.id}`;
        }
        console.log(`[Track ${this.id} Constructor] Initializing track "${this.name}" of type "${this.type}". InitialData present: ${!!initialData}`);

        this.isMuted = ((initialData) && (initialData).isMuted) || false;
        this.isMonitoringEnabled = ((initialData) && (initialData).isMonitoringEnabled) !== undefined ? initialData.isMonitoringEnabled : (this.type === 'Audio'); 

        const currentSoloedId = this.appServices.getSoloedTrackId ? this.appServices.getSoloedTrackId() : null;
        this.isSoloed = currentSoloedId === this.id;
        this.previousVolumeBeforeMute = ((initialData) && (initialData).volume) ?? 0.7;
        // Track color for visual identification
        this.trackColor = ((initialData) && (initialData).trackColor) || Constants.TRACK_COLORS[(id - 1) % Constants.TRACK_COLORS.length];

        // Synth specific
        if (this.type === 'Synth') {
            this.synthEngineType = ((initialData) && (initialData).synthEngineType) || 'MonoSynth';
            this.synthParams = ((initialData) && (initialData).synthParams) ? JSON.parse(JSON.stringify(initialData.synthParams)) : this.getDefaultSynthParams();
        } else {
            this.synthEngineType = null;
            this.synthParams = {};
        }

        // Sampler (Slicer) specific
        this.samplerAudioData = {
            fileName: ((initialData) && (initialData).samplerAudioData)?.fileName || null,
            audioBufferDataURL: ((initialData) && (initialData).samplerAudioData)?.audioBufferDataURL || null, 
            dbKey: ((initialData) && (initialData).samplerAudioData)?.dbKey || null,
            status: ((initialData) && (initialData).samplerAudioData)?.status || (((initialData) && (initialData).samplerAudioData)?.dbKey || ((initialData) && (initialData).samplerAudioData)?.audioBufferDataURL ? 'missing' : 'empty')
        };
        this.audioBuffer = null; 
        this.slices = ((initialData) && (initialData).slices) && initialData.slices.length > 0 ?
            JSON.parse(JSON.stringify(initialData.slices)) :
            Array(Constants.numSlices).fill(null).map(() => ({
                offset: 0, duration: 0, userDefined: false, volume: 0.7, pitchShift: 0,
                loop: false, reverse: false,
                envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.2 }
            }));
        this.selectedSliceForEdit = ((initialData) && (initialData).selectedSliceForEdit) || 0;
        this.waveformZoom = ((initialData) && (initialData).waveformZoom) || 1;
        this.waveformScrollOffset = ((initialData) && (initialData).waveformScrollOffset) || 0;
        this.slicerIsPolyphonic = ((initialData) && (initialData).slicerIsPolyphonic) !== undefined ? initialData.slicerIsPolyphonic : true;
        this.slicerMonoPlayer = null;
        this.slicerMonoEnvelope = null;
        this.slicerMonoGain = null;

        // Instrument Sampler specific
        this.instrumentSamplerSettings = {
            sampleUrl: ((initialData) && (initialData).instrumentSamplerSettings)?.sampleUrl || null, 
            audioBuffer: null,
            audioBufferDataURL: ((initialData) && (initialData).instrumentSamplerSettings)?.audioBufferDataURL || null,
            originalFileName: ((initialData) && (initialData).instrumentSamplerSettings)?.originalFileName || null,
            dbKey: ((initialData) && (initialData).instrumentSamplerSettings)?.dbKey || null,
            rootNote: ((initialData) && (initialData).instrumentSamplerSettings)?.rootNote || 'C4',
            loop: ((initialData) && (initialData).instrumentSamplerSettings)?.loop || false,
            loopStart: ((initialData) && (initialData).instrumentSamplerSettings)?.loopStart || 0,
            loopEnd: ((initialData) && (initialData).instrumentSamplerSettings)?.loopEnd || 0,
            envelope: ((initialData) && (initialData).instrumentSamplerSettings)?.envelope ? JSON.parse(JSON.stringify(initialData.instrumentSamplerSettings.envelope)) : { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 },
            status: ((initialData) && (initialData).instrumentSamplerSettings)?.status || (((initialData) && (initialData).instrumentSamplerSettings)?.dbKey || ((initialData) && (initialData).instrumentSamplerSettings)?.audioBufferDataURL ? 'missing' : 'empty')
        };
        this.instrumentSamplerIsPolyphonic = ((initialData) && (initialData).instrumentSamplerIsPolyphonic) !== undefined ? initialData.instrumentSamplerIsPolyphonic : true;
        this.toneSampler = null;

        // Drum Sampler specific
        this.drumSamplerPads = Array(Constants.numDrumSamplerPads).fill(null).map((_, padIdx) => {
            const initialPadData = ((initialData) && (initialData).drumSamplerPads)?.[padIdx];
            return {
                sampleUrl: ((initialPadData) && (initialPadData).sampleUrl) || null, 
                audioBuffer: null,
                audioBufferDataURL: ((initialPadData) && (initialPadData).audioBufferDataURL) || null,
                originalFileName: ((initialPadData) && (initialPadData).originalFileName) || null,
                dbKey: ((initialPadData) && (initialPadData).dbKey) || null,
                volume: ((initialPadData) && (initialPadData).volume) ?? 0.7,
                pitchShift: ((initialPadData) && (initialPadData).pitchShift) ?? 0,
                envelope: ((initialPadData) && (initialPadData).envelope) ? JSON.parse(JSON.stringify(initialPadData.envelope)) : { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 },
                status: ((initialPadData) && (initialPadData).status) || (((initialPadData) && (initialPadData).dbKey) || ((initialPadData) && (initialPadData).audioBufferDataURL) ? 'missing' : 'empty')
            };
        });
        this.selectedDrumPadForEdit = ((initialData) && (initialData).selectedDrumPadForEdit) || 0;
        this.drumPadPlayers = Array(Constants.numDrumSamplerPads).fill(null);

        // Effects
        this.activeEffects = [];
        if (initialData && initialData.activeEffects && Array.isArray(initialData.activeEffects)) {
            initialData.activeEffects.forEach(effectData => {
                if (!effectData || !effectData.type) {
                    console.warn(`[Track ${this.id} Constructor] Skipping invalid effectData:`, effectData);
                    return;
                }
                const getDefaults = ((this.appServices.effectsRegistryAccess) && (this.appServices.effectsRegistryAccess).getEffectDefaultParams) || getEffectDefaultParamsFromRegistry;
                const paramsForInstance = effectData.params ? JSON.parse(JSON.stringify(effectData.params)) : (getDefaults ? getDefaults(effectData.type) : {});
                const toneNode = createEffectInstance(effectData.type, paramsForInstance);
                if (toneNode) {
                    this.activeEffects.push({
                        id: effectData.id || `effect-${this.id}-${effectData.type}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                        type: effectData.type, toneNode: toneNode, params: paramsForInstance
                    });
                } else {
                    console.warn(`[Track ${this.id} Constructor] Failed to create Tone.js instance for effect type "${effectData.type}".`);
                }
            });
        }

        // Audio Nodes
        this.gainNode = null; this.trackMeter = null; this.outputNode = null;
        this.instrument = null; 

        this.sequences = [];
        this.activeSequenceId = null;
        this.timelineClips = ((initialData) && (initialData).timelineClips) ? JSON.parse(JSON.stringify(initialData.timelineClips)) : [];


        if (this.type !== 'Audio') {
            if (((initialData) && (initialData).sequences) && initialData.sequences.length > 0) {
                this.sequences = JSON.parse(JSON.stringify(initialData.sequences));
                this.activeSequenceId = initialData.activeSequenceId || (this.sequences[0] ? this.sequences[0].id : null);
            } else {
                this.createNewSequence("Sequence 1", Constants.defaultStepsPerBar, true); 
            }
            delete this.sequenceData;
            delete this.sequenceLength;
        } else { 
            delete this.sequenceData;
            delete this.sequenceLength;
            delete this.sequences;
            delete this.activeSequenceId;

            if (((initialData) && (initialData).audioClips) && Array.isArray(initialData.audioClips)) {
                 initialData.audioClips.forEach(ac => {
                    if (!ac || !ac.dbKey) return; 
                    const existingClip = this.timelineClips.find(tc => tc.sourceId === ac.dbKey && tc.type === 'audio');
                    if (!existingClip) {
                        this.timelineClips.push({
                            id: ac.id || `audioclip_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
                            type: 'audio',
                            sourceId: ac.dbKey,
                            startTime: ac.startTime || 0,
                            duration: ac.duration || 0, 
                            name: ac.name || `Rec Clip ${this.timelineClips.filter(c => c.type === 'audio').length + 1}`
                        });
                    }
                });
           }
        }
        this.patternPlayerSequence = null; 

        // UI related
        this.waveformCanvasCtx = null;
        this.instrumentWaveformCanvasCtx = null;
        this.automation = ((initialData) && (initialData).automation) ? JSON.parse(JSON.stringify(initialData.automation)) : { volume: [], mute: [], solo: [] };
        this.automationArmed = ((initialData) && (initialData).automationArmed) || false;
        this.inspectorControls = {};

        // Audio Track specific
        this.inputChannel = null;
        this.clipPlayers = new Map(); 
    }
/**
     * Loads a sample to a specific drum pad and saves it to IndexedDB.
     * @param {number} padIndex The index of the pad (0-15).
     * @param {Object} sampleSource Data source (file object or sound browser metadata).
     */
    async loadSampleToPad(padIndex, sampleSource) {
        try {
            let audioData;
            let fileName = sampleSource.fileName;

            // 1. Convert the source into an ArrayBuffer
            if (sampleSource.file) {
                // User dragged a file from their computer
                audioData = await sampleSource.file.arrayBuffer();
            } else if (sampleSource.filePath) {
                // User dragged a sound from the internal Sound Browser
                if (this.appServices.loadSoundFromBrowserToTarget) {
                    audioData = await this.appServices.loadSoundFromBrowserToTarget(sampleSource, this.id, 'DrumSampler', padIndex);
                }
            }

            if (audioData) {
                // 2. Save to IndexedDB so the sample persists on reload
                const dbKey = `track_${this.id}_pad_${padIndex}`;
                await storeAudio(dbKey, audioData);

                // 3. Create a Tone.js Buffer for immediate playback
                const buffer = new Tone.ToneAudioBuffer();
                await buffer.fromArrayBuffer(audioData);

                // 4. Update the specific pad in this track - AudioBuffer
                if (this.drumSamplerPads[padIndex]) {
                    // Dispose of the old buffer if it exists to save memory
                    if (this.drumSamplerPads[padIndex].audioBuffer && !this.drumSamplerPads[padIndex].audioBuffer.disposed) {
                        this.drumSamplerPads[padIndex].audioBuffer.dispose();
                    }

                    this.drumSamplerPads[padIndex].audioBuffer = buffer;
                    this.drumSamplerPads[padIndex].sampleName = fileName;
                    this.drumSamplerPads[padIndex].dbKey = dbKey;
                    this.drumSamplerPads[padIndex].status = 'loaded';
                }

                // 5. Create Tone.Player for playback (required by playDrumSamplerPadPreview)
                if (this.drumPadPlayers[padIndex] && !this.drumPadPlayers[padIndex].disposed) {
                    this.drumPadPlayers[padIndex].dispose();
                }
                this.drumPadPlayers[padIndex] = new Tone.Player(buffer);
                
                // 6. Connect player to effects chain or gain node
                this.rebuildEffectChain();

                console.log(`[Track ${this.id}] Successfully loaded "${fileName}" to pad ${padIndex}`);
                return true;
            }
        } catch (e) {
            console.error("[Track loadSampleToPad] Error:", e);
            if (this.appServices.showNotification) {
                this.appServices.showNotification("Error loading sample to pad.");
            }
        }
        return false;
    }
    // --- Sequence Management ---
    getActiveSequence() {
        if (this.type === 'Audio' || !this.activeSequenceId || !this.sequences || this.sequences.length === 0) return null;
        return this.sequences.find(s => s.id === this.activeSequenceId);
    }

    getActiveSequenceData() {
        const activeSeq = this.getActiveSequence();
        return activeSeq ? activeSeq.data : [];
    }

    getActiveSequenceLength() {
        const activeSeq = this.getActiveSequence();
        return activeSeq ? activeSeq.length : Constants.defaultStepsPerBar;
    }

    // --- Synth Specific ---
    getDefaultSynthParams() {
        // MODIFICATION: Change default oscillator type, decay, and sustain
        return {
            portamento: 0.01,
            oscillator: { type: 'sine' }, 
            envelope: { 
                attack: 0.005, 
                decay: 2, // Decay "all the way up"
                sustain: 0, // Sustain "all the way down"
                release: 1 
            },
            filter: { type: 'lowpass', rolloff: -12, Q: 1, frequency: 1000 }, 
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7, exponent: 2 }
        };
        // END MODIFICATION
    }

    // --- Audio Node Initialization and Chaining ---
    async initializeAudioNodes() {
        console.log(`[Track ${this.id} initializeAudioNodes] Initializing audio nodes for "${this.name}".`);
        try {
            if (this.gainNode && !this.gainNode.disposed) try { this.gainNode.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old gainNode:`, e.message)}
            if (this.trackMeter && !this.trackMeter.disposed) try { this.trackMeter.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old trackMeter:`, e.message)}
            if (this.inputChannel && !this.inputChannel.disposed && this.type === 'Audio') {
                try { this.inputChannel.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old inputChannel:`, e.message)}
            }

            if (!this.appServices.getMasterEffectsBusInputNode) {
                 console.error(`[Track ${this.id} initializeAudioNodes] CRITICAL: getMasterEffectsBusInputNode service not available.`);
                 return;
            }

            this.gainNode = new Tone.Gain(this.isMuted ? 0 : this.previousVolumeBeforeMute);
            this.trackMeter = new Tone.Meter({ smoothing: 0.8 });
            this.outputNode = this.gainNode; 

            if (this.type === 'Audio') {
                this.inputChannel = new Tone.Channel(); 
                console.log(`[Track ${this.id} initializeAudioNodes] Created inputChannel for Audio track.`);
            }

            this.rebuildEffectChain();
            console.log(`[Track ${this.id} initializeAudioNodes] Audio nodes initialized and effect chain rebuilt.`);
        } catch (error) {
            console.error(`[Track ${this.id} initializeAudioNodes] Error during initialization:`, error);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Error initializing audio for track ${this.name}: ${error.message}`, 4000);
            }
        }
    }

    rebuildEffectChain() {
        console.log(`[Track ${this.id} rebuildEffectChain] Rebuilding effect chain for "${this.name}". Effects: ${this.activeEffects.length}`);
        if (!this.gainNode || this.gainNode.disposed) {
            console.error(`[Track ${this.id} rebuildEffectChain] CRITICAL: GainNode is not valid. Aborting chain rebuild.`);
            return;
        }
        if (!this.trackMeter || this.trackMeter.disposed) {
            console.warn(`[Track ${this.id} rebuildEffectChain] TrackMeter is not valid, re-creating.`);
            this.trackMeter = new Tone.Meter({ smoothing: 0.8 });
        }

        let sourceNodes = [];
        if (this.type === 'Synth' && this.instrument && !this.instrument.disposed) sourceNodes.push(this.instrument);
        else if (this.type === 'InstrumentSampler' && this.toneSampler && !this.toneSampler.disposed) sourceNodes.push(this.toneSampler);
        else if (this.type === 'DrumSampler') {
            this.drumPadPlayers.forEach(player => { if (player && !player.disposed) sourceNodes.push(player); });
        } else if (this.type === 'Sampler' && !this.slicerIsPolyphonic && this.slicerMonoGain && !this.slicerMonoGain.disposed) {
            sourceNodes.push(this.slicerMonoGain);
        } else if (this.type === 'Audio' && this.inputChannel && !this.inputChannel.disposed) {
            sourceNodes.push(this.inputChannel);
        }
        console.log(`[Track ${this.id} rebuildEffectChain] Identified ${sourceNodes.length} primary source nodes.`);

        const allManagedNodes = [
            ...sourceNodes,
            ...this.activeEffects.map(e => e.toneNode),
            this.gainNode,
            this.trackMeter
        ].filter(node => node && !node.disposed);

        allManagedNodes.forEach(node => {
            try { node.disconnect(); } catch(e) { console.warn(`[Track ${this.id} rebuildEffectChain] Error during disconnect of node:`, ((node) && (node).toString)(), e.message); }
        });
        console.log(`[Track ${this.id} rebuildEffectChain] All managed nodes disconnected.`);

        if (this.type === 'Sampler' && !this.slicerIsPolyphonic && this.slicerMonoPlayer && !this.slicerMonoPlayer.disposed &&
            this.slicerMonoEnvelope && !this.slicerMonoEnvelope.disposed &&
            this.slicerMonoGain && !this.slicerMonoGain.disposed) {
            try {
                this.slicerMonoPlayer.disconnect();
                this.slicerMonoPlayer.chain(this.slicerMonoEnvelope, this.slicerMonoGain);
                console.log(`[Track ${this.id} rebuildEffectChain] Chained mono slicer player -> envelope -> gain.`);
            } catch (e) { console.error(`[Track ${this.id} rebuildEffectChain] Error chaining mono slicer components:`, e); }
        }

        let currentOutputTarget = sourceNodes.length > 0 ? (sourceNodes.length === 1 ? sourceNodes[0] : sourceNodes) : null;

        if ((this.type === 'Sampler' && this.slicerIsPolyphonic) || (this.type === 'Audio' && sourceNodes.length === 0 && this.timelineClips.length > 0)) {
            currentOutputTarget = null;
            console.log(`[Track ${this.id} rebuildEffectChain] Set currentOutputTarget to null (poly sampler/audio clips).`);
        }


        this.activeEffects.forEach((effectWrapper, index) => {
            if (effectWrapper.toneNode && !effectWrapper.toneNode.disposed) {
                console.log(`[Track ${this.id} rebuildEffectChain] Processing effect ${index}: ${effectWrapper.type}`);
                if (currentOutputTarget) {
                    if (Array.isArray(currentOutputTarget)) {
                        currentOutputTarget.forEach(outNode => {
                            if (outNode && !outNode.disposed) try { outNode.connect(effectWrapper.toneNode); } catch(e){ console.error(`[Track ${this.id}] Error connecting array source to effect ${effectWrapper.type}:`, e); }
                        });
                    } else { 
                        try { currentOutputTarget.connect(effectWrapper.toneNode); } catch(e){ console.error(`[Track ${this.id}] Error connecting single source to effect ${effectWrapper.type}:`, e); }
                    }
                } else {
                    console.log(`[Track ${this.id} rebuildEffectChain] Effect ${effectWrapper.type} is the new start of a chain segment.`);
                }
                currentOutputTarget = effectWrapper.toneNode;
            } else {
                console.warn(`[Track ${this.id} rebuildEffectChain] Effect ${effectWrapper.type} (ID: ${effectWrapper.id}) node is invalid or disposed.`);
            }
        });

        if (currentOutputTarget) {
            if (Array.isArray(currentOutputTarget)) {
                currentOutputTarget.forEach(outNode => {
                    if (outNode && !outNode.disposed) try { outNode.connect(this.gainNode); } catch (e) { console.error(`[Track ${this.id}] Error connecting array effect output to gainNode:`, e); }
                });
            } else {
                try { currentOutputTarget.connect(this.gainNode); } catch (e) { console.error(`[Track ${this.id}] Error connecting single effect output to gainNode:`, e); }
            }
            console.log(`[Track ${this.id} rebuildEffectChain] Connected effect chain output to gainNode.`);
        } else {
            if (this.type === 'Audio' && this.inputChannel && !this.inputChannel.disposed) {
                try { this.inputChannel.connect(this.gainNode); console.log(`[Track ${this.id} rebuildEffectChain] Audio inputChannel connected directly to gainNode.`); }
                catch(e) { console.error(`[Track ${this.id}] Error connecting inputChannel to gainNode:`, e); }
            } else {
                console.log(`[Track ${this.id} rebuildEffectChain] No persistent currentOutputTarget for gainNode (e.g., poly sampler without effects, or empty audio track).`);
            }
        }

        if (this.gainNode && !this.gainNode.disposed && this.trackMeter && !this.trackMeter.disposed) {
            try { this.gainNode.connect(this.trackMeter); console.log(`[Track ${this.id} rebuildEffectChain] Connected gainNode to trackMeter.`); }
            catch (e) { console.error(`[Track ${this.id}] Error connecting gainNode to trackMeter:`, e); }
        }

        const masterBusInput = this.appServices.getMasterEffectsBusInputNode ? this.appServices.getMasterEffectsBusInputNode() : null;
        const finalTrackOutput = (this.trackMeter && !this.trackMeter.disposed) ? this.trackMeter : this.gainNode;

        if (finalTrackOutput && !finalTrackOutput.disposed && masterBusInput && !masterBusInput.disposed) {
            try { finalTrackOutput.connect(masterBusInput); console.log(`[Track ${this.id} rebuildEffectChain] Connected final track output to masterBusInput.`); }
            catch (e) { console.error(`[Track ${this.id}] Error connecting final output to masterBusInput:`, e); }
        } else if (finalTrackOutput && !finalTrackOutput.disposed) {
            console.warn(`[Track ${this.id} rebuildEffectChain] Master effects bus input not available. Connecting directly to destination as fallback.`);
            try { finalTrackOutput.toDestination(); } catch (e) { console.error(`[Track ${this.id}] Error connecting final output to destination:`, e); }
        } else {
            console.error(`[Track ${this.id} rebuildEffectChain] CRITICAL: Final track output node is invalid or master bus is unavailable. No output connection made.`);
        }

        this.applyMuteState();
        this.applySoloState();
        console.log(`[Track ${this.id} rebuildEffectChain] Mute/Solo states applied. Chain rebuild finished for "${this.name}".`);
    }


    addEffect(effectType) {
        if (!this.appServices.effectsRegistryAccess) {
            console.error(`[Track ${this.id}] effectsRegistryAccess not available via appServices.`);
            if (this.appServices.showNotification) this.appServices.showNotification("Cannot add effect: Effects registry missing.", 3000);
            return;
        }
        const AVAILABLE_EFFECTS_LOCAL = this.appServices.effectsRegistryAccess.AVAILABLE_EFFECTS;
        const getEffectDefaultParamsLocal = this.appServices.effectsRegistryAccess.getEffectDefaultParams;

        if (!AVAILABLE_EFFECTS_LOCAL || !AVAILABLE_EFFECTS_LOCAL[effectType]) {
            console.warn(`[Track ${this.id}] Effect type "${effectType}" not found in registry.`);
            if (this.appServices.showNotification) this.appServices.showNotification(`Effect type "${effectType}" not found.`, 3000);
            return;
        }
        const defaultParams = getEffectDefaultParamsLocal ? getEffectDefaultParamsLocal(effectType) : getEffectDefaultParamsFromRegistry(effectType); 
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
            console.log(`[Track ${this.id}] Added effect "${effectType}".`);
        } else {
            console.warn(`[Track ${this.id}] Could not create Tone.js instance for effect ${effectType}`);
            if (this.appServices.showNotification) this.appServices.showNotification(`Could not create effect: ${effectType}`, 3000);
        }
    }

    removeEffect(effectId) {
        const effectIndex = this.activeEffects.findIndex(e => e.id === effectId);
        if (effectIndex > -1) {
            const effectToRemove = this.activeEffects[effectIndex];
            console.log(`[Track ${this.id}] Removing effect "${effectToRemove.type}" (ID: ${effectId})`);
            if (effectToRemove.toneNode && !effectToRemove.toneNode.disposed) {
                try {
                    effectToRemove.toneNode.dispose();
                } catch (e) {
                    console.warn(`[Track ${this.id}] Error disposing effect node during removal:`, e.message);
                }
            }
            this.activeEffects.splice(effectIndex, 1);
            this.rebuildEffectChain();
            if (this.appServices.updateTrackUI) {
                this.appServices.updateTrackUI(this.id, 'effectsListChanged');
            }
        } else {
            console.warn(`[Track ${this.id}] Effect with ID ${effectId} not found for removal.`);
        }
    }

    updateEffectParam(effectId, paramPath, value) {
        const effectWrapper = this.activeEffects.find(e => e.id === effectId);
        if (!effectWrapper) {
            console.warn(`[Track ${this.id}] Effect ${effectId} not found for param update.`);
            return;
        }
        if (!effectWrapper.toneNode || effectWrapper.toneNode.disposed) {
            console.warn(`[Track ${this.id}] ToneNode for effect ${effectId} ("${effectWrapper.type}") is invalid or disposed.`);
            return;
        }

        try {
            const keys = paramPath.split('.');
            let currentStoredParamLevel = effectWrapper.params;
            for (let i = 0; i < keys.length - 1; i++) {
                currentStoredParamLevel[keys[i]] = currentStoredParamLevel[keys[i]] || {};
                currentStoredParamLevel = currentStoredParamLevel[keys[i]];
            }
            currentStoredParamLevel[keys[keys.length - 1]] = value;
        } catch (e) {
            console.error(`[Track ${this.id}] Error updating stored param "${paramPath}" for effect "${effectWrapper.type}":`, e);
        }

        try {
            const keys = paramPath.split('.');
            let targetObject = effectWrapper.toneNode;
            for (let i = 0; i < keys.length - 1; i++) {
                if (targetObject && typeof targetObject[keys[i]] !== 'undefined') {
                    targetObject = targetObject[keys[i]];
                } else {
                    throw new Error(`Nested object for path "${keys.slice(0, i + 1).join('.')}" not found on Tone node for effect "${effectWrapper.type}".`);
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
            } else if (typeof targetObject.set === 'function' && keys.length > 0) {
                const setObj = {};
                let currentLevelForSet = setObj;
                keys.forEach((k, idx) => {
                    if (idx === keys.length -1) currentLevelForSet[k] = value;
                    else { currentLevelForSet[k] = {}; currentLevelForSet = currentLevelForSet[k];}
                });
                targetObject.set(setObj);
            } else {
                 console.warn(`[Track ${this.id}] Could not set parameter "${paramPath}" on effect "${effectWrapper.type}". Parameter instance or .set() method not found on target:`, targetObject);
            }
        } catch (err) {
            console.error(`[Track ${this.id}] Error updating Tone param "${paramPath}" for effect "${effectWrapper.type}":`, err, "Value:", value);
        }
    }

    reorderEffect(effectId, newIndex) {
        const oldIndex = this.activeEffects.findIndex(e => e.id === effectId);
        if (oldIndex === -1) {
            console.warn(`[Track ${this.id}] Effect ID ${effectId} not found for reordering.`);
            return;
        }

        newIndex = Math.max(0, Math.min(newIndex, this.activeEffects.length - 1));
        if (oldIndex === newIndex) return;

        console.log(`[Track ${this.id}] Reordering effect ${effectId} from index ${oldIndex} to ${newIndex}.`);
        const [effectToMove] = this.activeEffects.splice(oldIndex, 1);
        this.activeEffects.splice(newIndex, 0, effectToMove);
        this.rebuildEffectChain();

        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'effectsListChanged');
        }
    }

    async fullyInitializeAudioResources() {
        console.log(`[Track ${this.id} fullyInitializeAudioResources] Initializing audio resources for "${this.name}" (type: ${this.type})`);
        if (!this.gainNode || this.gainNode.disposed) {
            console.warn(`[Track ${this.id} fullyInitializeAudioResources] GainNode missing or disposed. Attempting to re-initialize audio nodes first.`);
            await this.initializeAudioNodes();
            if (!this.gainNode || this.gainNode.disposed) { 
                console.error(`[Track ${this.id} fullyInitializeAudioResources] CRITICAL: GainNode still invalid after re-initialization. Aborting resource load.`);
                return;
            }
        }

        try {
            if (this.type === 'Synth') {
                await this.initializeInstrument();
            } else if (this.type === 'Sampler') {
                if (this.samplerAudioData && (this.samplerAudioData.dbKey || this.samplerAudioData.audioBufferDataURL)) {
                    console.log(`[Track ${this.id} Sampler] Attempting to load sample: ${this.samplerAudioData.fileName || this.samplerAudioData.dbKey}`);
                    let audioFileBlob;
                    if (this.samplerAudioData.dbKey) {
                        try {
                            audioFileBlob = await getAudio(this.samplerAudioData.dbKey);
                            if (!audioFileBlob) {
                                console.warn(`[Track ${this.id} Sampler] Sample not found in DB for key: ${this.samplerAudioData.dbKey}. Filename: ${this.samplerAudioData.fileName}`);
                                this.samplerAudioData.status = 'missing_db';
                            }
                        } catch (err) {
                            console.error(`[Track ${this.id} Sampler] Error getting audio from DB for key ${this.samplerAudioData.dbKey}:`, err);
                            this.samplerAudioData.status = 'error';
                            if (this.appServices.showNotification) this.appServices.showNotification(`Error loading sample ${this.samplerAudioData.fileName || 'from database'}.`, 3000);
                        }
                    } else if (this.samplerAudioData.audioBufferDataURL) { 
                        try {
                            const response = await fetch(this.samplerAudioData.audioBufferDataURL);
                            if (!response.ok) throw new Error(`Failed to fetch data URL for ${this.samplerAudioData.fileName}`);
                            audioFileBlob = await response.blob();
                        } catch (fetchErr) {
                            console.error(`[Track ${this.id} Sampler] Error fetching audio from data URL for ${this.samplerAudioData.fileName}:`, fetchErr);
                            this.samplerAudioData.status = 'error';
                            if (this.appServices.showNotification) this.appServices.showNotification(`Error loading sample ${this.samplerAudioData.fileName || 'from data URL'}.`, 3000);
                        }
                    }

                    if (audioFileBlob) {
                        const objectURL = URL.createObjectURL(audioFileBlob);
                        try {
                            if (this.audioBuffer && !this.audioBuffer.disposed) try {this.audioBuffer.dispose();} catch(e){console.warn("Err disposing old audioBuffer",e)}
                            this.disposeSlicerMonoNodes();
                            this.audioBuffer = await new Tone.Buffer().load(objectURL);
                            this.samplerAudioData.status = 'loaded';
                            console.log(`[Track ${this.id} Sampler] Sample "${this.samplerAudioData.fileName}" loaded into Tone.Buffer. Duration: ${this.audioBuffer.duration}`);
                            if (!this.slicerIsPolyphonic) this.setupSlicerMonoNodes();
                            if (this.appServices.autoSliceSample && this.audioBuffer.loaded && this.slices.every(s => s.duration === 0)) {
                                this.appServices.autoSliceSample(this.id);
                            }
                        } catch (toneLoadErr) {
                            console.error(`[Track ${this.id} Sampler] Tone.Buffer load error for ${this.samplerAudioData.fileName}:`, toneLoadErr);
                            this.samplerAudioData.status = 'error';
                            if (this.appServices.showNotification) this.appServices.showNotification(`Error processing sample ${this.samplerAudioData.fileName}. It might be corrupted or an unsupported format.`, 4000);
                        } finally {
                            URL.revokeObjectURL(objectURL);
                        }
                    } else if (this.samplerAudioData.status !== 'error' && this.samplerAudioData.status !== 'missing_db') {
                        this.samplerAudioData.status = (this.samplerAudioData.dbKey || this.samplerAudioData.audioBufferDataURL) ? 'missing' : 'empty';
                        console.warn(`[Track ${this.id} Sampler] Audio file blob was null for ${this.samplerAudioData.fileName}, status set to ${this.samplerAudioData.status}`);
                    }
                }
            } else if (this.type === 'DrumSampler') {
                for (let i = 0; i < this.drumSamplerPads.length; i++) {
                    const pad = this.drumSamplerPads[i];
                    if (!pad) continue; 
                    if (pad.dbKey || pad.audioBufferDataURL) {
                        console.log(`[Track ${this.id} DrumSampler] Pad ${i}: Attempting to load sample: ${pad.originalFileName || pad.dbKey}`);
                        let audioFileBlob;
                        try {
                            if (pad.dbKey) {
                                audioFileBlob = await getAudio(pad.dbKey).catch(err => {
                                    console.error(`[Track ${this.id} DrumSampler] Pad ${i}: Error getting from DB (key ${pad.dbKey}):`, err);
                                    pad.status = 'error'; return null;
                                });
                                if (!audioFileBlob) pad.status = 'missing_db';
                            } else if (pad.audioBufferDataURL) {
                                const response = await fetch(pad.audioBufferDataURL).catch(err => {pad.status = 'error'; throw err;});
                                if (!response.ok) throw new Error(`Fetch failed for pad ${i}`);
                                audioFileBlob = await response.blob();
                            }

                            if (audioFileBlob) {
                                const objectURL = URL.createObjectURL(audioFileBlob);
                                try {
                                    if (pad.audioBuffer && !pad.audioBuffer.disposed) try {pad.audioBuffer.dispose();} catch(e){console.warn("Err disposing old pad audioBuffer",e)}
                                    pad.audioBuffer = await new Tone.Buffer().load(objectURL);
                                    if (this.drumPadPlayers[i] && !this.drumPadPlayers[i].disposed) try {this.drumPadPlayers[i].dispose();}catch(e){console.warn("Err disposing old player",e)}
                                    this.drumPadPlayers[i] = new Tone.Player(pad.audioBuffer);
                                    pad.status = 'loaded';
                                    console.log(`[Track ${this.id} DrumSampler] Pad ${i}: Sample "${pad.originalFileName}" loaded. Duration: ${pad.audioBuffer.duration}`);
                                } catch (toneLoadErr) {
                                    console.error(`[Track ${this.id} DrumSampler] Pad ${i}: Tone.Buffer error (${pad.originalFileName}):`, toneLoadErr);
                                    pad.status = 'error';
                                } finally {
                                    URL.revokeObjectURL(objectURL);
                                }
                            } else if (pad.status !== 'error' && pad.status !== 'missing_db') {
                                pad.status = (pad.dbKey || pad.audioBufferDataURL) ? 'missing' : 'empty';
                            }
                        } catch (loadErr) {
                             console.error(`[Track ${this.id} DrumSampler] Pad ${i}: General load error (${pad.originalFileName}):`, loadErr);
                             pad.status = 'error';
                        }
                    }
                }
            } else if (this.type === 'InstrumentSampler') {
                if (this.instrumentSamplerSettings.dbKey || this.instrumentSamplerSettings.audioBufferDataURL) {
                    console.log(`[Track ${this.id} InstrumentSampler] Attempting to load sample: ${this.instrumentSamplerSettings.originalFileName || this.instrumentSamplerSettings.dbKey}`);
                    let audioFileBlob;
                    try {
                        if (this.instrumentSamplerSettings.dbKey) {
                           audioFileBlob = await getAudio(this.instrumentSamplerSettings.dbKey).catch(err => {
                                console.error(`[Track ${this.id} InstrumentSampler] Error getting from DB (key ${this.instrumentSamplerSettings.dbKey}):`, err);
                                this.instrumentSamplerSettings.status = 'error'; return null;
                           });
                           if (!audioFileBlob) this.instrumentSamplerSettings.status = 'missing_db';
                        } else if (this.instrumentSamplerSettings.audioBufferDataURL) {
                            const response = await fetch(this.instrumentSamplerSettings.audioBufferDataURL).catch(err => {this.instrumentSamplerSettings.status = 'error'; throw err;});
                            if (!response.ok) throw new Error(`Fetch failed for instrument sampler`);
                            audioFileBlob = await response.blob();
                        }
                        if (audioFileBlob) {
                            const objectURL = URL.createObjectURL(audioFileBlob);
                            try {
                                if (this.instrumentSamplerSettings.audioBuffer && !this.instrumentSamplerSettings.audioBuffer.disposed) try {this.instrumentSamplerSettings.audioBuffer.dispose();}catch(e){console.warn("Err disposing old IS audioBuffer",e)}
                                this.instrumentSamplerSettings.audioBuffer = await new Tone.Buffer().load(objectURL);
                                this.instrumentSamplerSettings.status = 'loaded';
                                console.log(`[Track ${this.id} InstrumentSampler] Sample loaded. Duration: ${this.instrumentSamplerSettings.audioBuffer.duration}`);
                            } catch (toneLoadErr) {
                                console.error(`[Track ${this.id} InstrumentSampler] Tone.Buffer load error:`, toneLoadErr);
                                this.instrumentSamplerSettings.status = 'error';
                            } finally {
                                URL.revokeObjectURL(objectURL);
                            }
                        } else if(this.instrumentSamplerSettings.status !== 'error' && this.instrumentSamplerSettings.status !== 'missing_db') {
                            this.instrumentSamplerSettings.status = (this.instrumentSamplerSettings.dbKey || this.instrumentSamplerSettings.audioBufferDataURL) ? 'missing' : 'empty';
                        }
                    } catch (loadErr) {
                        console.error(`[Track ${this.id} InstrumentSampler] General load error:`, loadErr);
                        this.instrumentSamplerSettings.status = 'error';
                    }
                }
                this.setupToneSampler();
            }

            if (this.type === 'Audio') {
                 if ((!this.inputChannel || this.inputChannel.disposed)) {
                    console.log(`[Track ${this.id} fullyInitializeAudioResources] Re-initializing audio nodes for Audio track as inputChannel was invalid.`);
                    await this.initializeAudioNodes();
                 }
                 for (const clip of this.timelineClips) {
                     if (clip.type === 'audio' && clip.sourceId && (!clip.audioBuffer || clip.audioBuffer.disposed)) {
                         try {
                             const audioBlob = await getAudio(clip.sourceId);
                             if (audioBlob) {
                                 const url = URL.createObjectURL(audioBlob);
                                 console.log(`[Track ${this.id} Audio] Verified audio clip source ${clip.sourceId} (${clip.name}) from DB.`);
                                 URL.revokeObjectURL(url); 
                                 if (clip.duration === 0) { 
                                     clip.duration = await this.getBlobDuration(audioBlob);
                                 }
                             } else {
                                 console.warn(`[Track ${this.id} Audio] Audio data for clip ${clip.id} (source: ${clip.sourceId}) not found in DB.`);
                                 if (this.appServices.showNotification) this.appServices.showNotification(`Audio for clip "${clip.name}" is missing.`, 3000);
                             }
                         } catch (err) {
                             console.error(`[Track ${this.id} Audio] Error loading audio for clip ${clip.id} (source: ${clip.sourceId}):`, err);
                         }
                     }
                 }
            }

        } catch (error) {
            console.error(`[Track ${this.id} fullyInitializeAudioResources] Overall error for "${this.name}" (type ${this.type}):`, error);
            if (this.appServices.showNotification) this.appServices.showNotification(`Major error loading audio resources for ${this.name}. Check console.`, 4000);
            if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sampleLoadError');
        }

        if (this.type !== 'Audio') {
            this.recreateToneSequence(true);
        }
        this.rebuildEffectChain();
        console.log(`[Track ${this.id} fullyInitializeAudioResources] Finished for "${this.name}".`);
    }


    async initializeInstrument() { 
        if (this.type === 'Synth') {
            console.log(`[Track ${this.id} initializeInstrument] Initializing synth instrument (type: ${this.synthEngineType}).`);
            if (this.instrument && !this.instrument.disposed) {
                try { this.instrument.dispose(); } catch(e) { console.warn(`[Track ${this.id}] Error disposing old synth instrument:`, e.message); }
            }
            try {
                this.instrument = new Tone.MonoSynth(this.synthParams);
                console.log(`[Track ${this.id} initializeInstrument] MonoSynth initialized with params:`, JSON.parse(JSON.stringify(this.synthParams)));
            } catch (error) {
                console.error(`[Track ${this.id} initializeInstrument] Error creating MonoSynth:`, error);
                if (this.appServices.showNotification) this.appServices.showNotification(`Error creating synth for track ${this.name}.`, 3000);
                this.instrument = null; 
            }
        }
    }

    setupSlicerMonoNodes() {
        this.disposeSlicerMonoNodes();
        if (this.type === 'Sampler' && !this.slicerIsPolyphonic) {
            try {
                this.slicerMonoPlayer = new Tone.Player();
                this.slicerMonoEnvelope = new Tone.AmplitudeEnvelope();
                this.slicerMonoGain = new Tone.Gain();
                this.slicerMonoPlayer.chain(this.slicerMonoEnvelope, this.slicerMonoGain);
                if (this.audioBuffer && this.audioBuffer.loaded) {
                    this.slicerMonoPlayer.buffer = this.audioBuffer;
                }
                console.log(`[Track ${this.id} setupSlicerMonoNodes] Mono slicer nodes created.`);
            } catch (error) {
                console.error(`[Track ${this.id} setupSlicerMonoNodes] Error creating mono slicer nodes:`, error);
            }
        }
    }
    disposeSlicerMonoNodes() {
        if (this.slicerMonoPlayer && !this.slicerMonoPlayer.disposed) { try { this.slicerMonoPlayer.dispose(); } catch(e){console.warn("Err disposing slicerMonoPlayer", e)} }
        if (this.slicerMonoEnvelope && !this.slicerMonoEnvelope.disposed) { try { this.slicerMonoEnvelope.dispose(); } catch(e){console.warn("Err disposing slicerMonoEnvelope", e)} }
        if (this.slicerMonoGain && !this.slicerMonoGain.disposed) { try { this.slicerMonoGain.dispose(); } catch(e){console.warn("Err disposing slicerMonoGain", e)} }
        this.slicerMonoPlayer = null; this.slicerMonoEnvelope = null; this.slicerMonoGain = null;
    }

    setupToneSampler() { 
        if (this.type === 'InstrumentSampler') {
            console.log(`[Track ${this.id} setupToneSampler] Setting up Tone.Sampler.`);
            if (this.toneSampler && !this.toneSampler.disposed) {
                try { this.toneSampler.dispose(); } catch(e){ console.warn(`[Track ${this.id}] Error disposing old Tone.Sampler:`, e.message); }
            }
            this.toneSampler = null; 

            if (this.instrumentSamplerSettings.audioBuffer && this.instrumentSamplerSettings.audioBuffer.loaded) {
                const urls = {};
                const rootNote = this.instrumentSamplerSettings.rootNote || 'C4';
                urls[rootNote] = this.instrumentSamplerSettings.audioBuffer;
                try {
                    this.toneSampler = new Tone.Sampler({
                        urls: urls,
                        attack: this.instrumentSamplerSettings.envelope.attack,
                        release: this.instrumentSamplerSettings.envelope.release,
                        baseUrl: '', 
                        onload: () => {
                            if (this.toneSampler && !this.toneSampler.disposed) {
                                this.toneSampler.loop = this.instrumentSamplerSettings.loop;
                                this.toneSampler.loopStart = this.instrumentSamplerSettings.loopStart;
                                this.toneSampler.loopEnd = this.instrumentSamplerSettings.loopEnd;
                                console.log(`[Track ${this.id} setupToneSampler] Tone.Sampler loaded and configured. Root: ${rootNote}, Loop: ${this.toneSampler.loop}`);
                            }
                        },
                        onerror: (err) => {
                             console.error(`[Track ${this.id} setupToneSampler] Tone.Sampler onerror:`, err);
                             if (this.appServices.showNotification) this.appServices.showNotification(`Error in instrument sampler for ${this.name}.`, 3000);
                        }
                    });
                } catch (e) {
                    console.error(`[Track ${this.id} setupToneSampler] Error creating Tone.Sampler:`, e);
                    if (this.appServices.showNotification) this.appServices.showNotification(`Error creating instrument sampler for ${this.name}.`, 3000);
                }
            } else {
                 console.warn(`[Track ${this.id} setupToneSampler] AudioBuffer for instrument sampler not loaded. Tone.Sampler not created.`);
            }
        }
    }

    setVolume(volume, fromInteraction = false) { 
        this.previousVolumeBeforeMute = Math.max(0, Math.min(parseFloat(volume) || 0, 1.5)); 
        if (this.gainNode && !this.gainNode.disposed && !this.isMuted) {
            try {
                this.gainNode.gain.setValueAtTime(this.previousVolumeBeforeMute, Tone.now());
            } catch (e) { console.error(`[Track ${this.id}] Error setting gainNode volume:`, e); }
        }
    }

    applyMuteState() {
        if (this.gainNode && !this.gainNode.disposed) {
            const currentSoloedId = this.appServices.getSoloedTrackId ? this.appServices.getSoloedTrackId() : null;
            const isEffectivelyMuted = this.isMuted || (currentSoloedId !== null && currentSoloedId !== this.id);
            const targetVolume = isEffectivelyMuted ? 0 : this.previousVolumeBeforeMute;
            try {
                this.gainNode.gain.cancelScheduledValues(Tone.now());
                this.gainNode.gain.rampTo(targetVolume, 0.01); 
            } catch (e) { console.error(`[Track ${this.id}] Error applying mute state to gainNode:`, e); }
        } else {
            console.warn(`[Track ${this.id} applyMuteState] GainNode not available or disposed.`);
        }
    }

    applySoloState() {
        this.applyMuteState(); 
    }

    // --- Automation Write Methods ---
    writeVolumeAutomation(time, value) {
        if (!this.automation) this.automation = { volume: [], mute: [], solo: [] };
        if (!this.automation.volume) this.automation.volume = [];
        const event = { time: parseFloat(time), value: Math.max(0, Math.min(parseFloat(value) || 0, 1.5)) };
        this.automation.volume.push(event);
        if (this.automation.volume.length > 10000) this.automation.volume.splice(0, 1000);
        this.automation.volume.sort((a, b) => a.time - b.time);
        return event;
    }

    writeMuteAutomation(time, value) {
        if (!this.automation) this.automation = { volume: [], mute: [], solo: [] };
        if (!this.automation.mute) this.automation.mute = [];
        const event = { time: parseFloat(time), value: !!value };
        this.automation.mute.push(event);
        if (this.automation.mute.length > 10000) this.automation.mute.splice(0, 1000);
        this.automation.mute.sort((a, b) => a.time - b.time);
        return event;
    }

    writeSoloAutomation(time, value) {
        if (!this.automation) this.automation = { volume: [], mute: [], solo: [] };
        if (!this.automation.solo) this.automation.solo = [];
        const event = { time: parseFloat(time), value: !!value };
        this.automation.solo.push(event);
        if (this.automation.solo.length > 10000) this.automation.solo.splice(0, 1000);
        this.automation.solo.sort((a, b) => a.time - b.time);
        return event;
    }

    removeAutomationEventsInRange(type, startTime, endTime) {
        if (!this.automation || !this.automation[type]) return;
        const before = this.automation[type].length;
        this.automation[type] = this.automation[type].filter(e => e.time < startTime || e.time > endTime);
        const removed = before - this.automation[type].length;
        if (removed > 0) console.log(`[Track ${this.id}] Removed ${removed} ${type} automation events in range ${startTime.toFixed(2)}-${endTime.toFixed(2)}`);
    }

    /**
     * Schedules automation events for playback. Call this during Tone.Transport.scheduleRepeat.
     * @param {number} time - The Tone.Transport time in seconds
     */
    applyAutomationAtTime(time) {
        if (!this.automation || this.gainNode && !this.gainNode.disposed) {
            // Apply volume automation
            if (this.automation && this.automation.volume && this.automation.volume.length > 0) {
                for (const event of this.automation.volume) {
                    if (event && typeof event.time === 'number') {
                        const eventTime = event.time;
                        const lookAhead = Tone.Transport.seconds - Tone.now();
                        if (eventTime >= time - lookAhead && eventTime <= time + lookAhead) {
                            try {
                                this.gainNode.gain.setValueAtTime(event.value, eventTime);
                            } catch (e) { console.warn(`[Track ${this.id}] applyAutomationAtTime volume error:`, e.message); }
                        }
                    }
                }
            }
            // Apply mute automation
            if (this.automation && this.automation.mute && this.automation.mute.length > 0) {
                for (const event of this.automation.mute) {
                    if (event && typeof event.time === 'number') {
                        const eventTime = event.time;
                        const lookAhead = Tone.Transport.seconds - Tone.now();
                        if (eventTime >= time - lookAhead && eventTime <= time + lookAhead) {
                            try {
                                this.isMuted = event.value;
                                this.applyMuteState();
                            } catch (e) { console.warn(`[Track ${this.id}] applyAutomationAtTime mute error:`, e.message); }
                        }
                    }
                }
            }
            // Apply solo automation
            if (this.automation && this.automation.solo && this.automation.solo.length > 0) {
                for (const event of this.automation.solo) {
                    if (event && typeof event.time === 'number') {
                        const eventTime = event.time;
                        const lookAhead = Tone.Transport.seconds - Tone.now();
                        if (eventTime >= time - lookAhead && eventTime <= time + lookAhead) {
                            try {
                                if (event.value && this.appServices.setSoloedTrackId) {
                                    this.appServices.setSoloedTrackId(this.id);
                                } else if (!event.value && this.appServices.setSoloedTrackId) {
                                    this.appServices.setSoloedTrackId(null);
                                }
                            } catch (e) { console.warn(`[Track ${this.id}] applyAutomationAtTime solo error:`, e.message); }
                        }
                    }
                }
            }
        }
    }

    setSynthParam(paramPath, value) {
        if (this.type !== 'Synth') return;
        if (!this.instrument || this.instrument.disposed) {
            console.warn(`[Track ${this.id} setSynthParam] Synth instrument not available or disposed for param "${paramPath}".`);
            return;
        }
        try {
            const keys = paramPath.split('.');
            let target = this.instrument;
            let paramsTarget = this.synthParams;

            for (let i = 0; i < keys.length - 1; i++) {
                if (target && typeof target[keys[i]] !== 'undefined') {
                    target = target[keys[i]];
                } else {
                    console.warn(`[Track ${this.id} setSynthParam] Path part "${keys[i]}" not found on Tone instrument for "${paramPath}".`);
                    return; 
                }
                paramsTarget[keys[i]] = paramsTarget[keys[i]] || {};
                paramsTarget = paramsTarget[keys[i]];
            }
            const finalKey = keys[keys.length - 1];

            paramsTarget[finalKey] = value; 

            if (target && typeof target[finalKey] !== 'undefined') {
                if (target[finalKey] && typeof target[finalKey].setValueAtTime === 'function') {
                    target[finalKey].setValueAtTime(value, Tone.now());
                } else if (target[finalKey] && typeof target[finalKey].value !== 'undefined') {
                     target[finalKey].value = value;
                } else {
                    target[finalKey] = value;
                }
            } else if (target && typeof target.set === 'function') {
                const setObj = {};
                let currentLevel = setObj;
                keys.forEach((k, idx) => {
                    if (idx === keys.length -1) currentLevel[k] = value;
                    else { currentLevel[k] = {}; currentLevel = currentLevel[k];}
                });
                target.set(setObj);
            } else {
                 console.warn(`[Track ${this.id} setSynthParam] Could not set param "${finalKey}" on Tone instrument target for path "${paramPath}". Target:`, target);
            }
        } catch (e) {
            console.error(`[Track ${this.id} setSynthParam] Error setting synth param "${paramPath}" to ${value}:`, e);
        }
    }

    async applySynthPreset(presetData) {
        if (this.type !== 'Synth') return;
        try {
            if (presetData.synthEngineType) {
                this.synthEngineType = presetData.synthEngineType;
            }
            if (presetData.synthParams) {
                this.synthParams = JSON.parse(JSON.stringify(presetData.synthParams));
            }
            await this.initializeInstrument();
            console.log(`[Track ${this.id} applySynthPreset] Applied preset.`);
        } catch (e) {
            console.error(`[Track ${this.id} applySynthPreset] Error applying preset:`, e);
        }
    }

    setSliceVolume(sliceIndex, volume) {
        if (this.slices && this.slices[sliceIndex]) this.slices[sliceIndex].volume = parseFloat(volume);
    }
    setSlicePitchShift(sliceIndex, semitones) {
        if (this.slices && this.slices[sliceIndex]) this.slices[sliceIndex].pitchShift = parseInt(semitones);
    }
    setSliceLoop(sliceIndex, loop) {
        if (this.slices && this.slices[sliceIndex]) this.slices[sliceIndex].loop = !!loop;
    }
    setSliceReverse(sliceIndex, reverse) {
        if (this.slices && this.slices[sliceIndex]) this.slices[sliceIndex].reverse = !!reverse;
    }
    setSliceEnvelopeParam(sliceIndex, param, value) {
        if (this.slices && this.slices[sliceIndex] && this.slices[sliceIndex].envelope) {
            this.slices[sliceIndex].envelope[param] = parseFloat(value);
        }
    }

    setDrumSamplerPadVolume(padIndex, volume) {
        if (this.drumSamplerPads && this.drumSamplerPads[padIndex]) this.drumSamplerPads[padIndex].volume = parseFloat(volume);
    }
    setDrumSamplerPadPitch(padIndex, pitch) {
        if (this.drumSamplerPads && this.drumSamplerPads[padIndex]) this.drumSamplerPads[padIndex].pitchShift = parseInt(pitch);
    }
    setDrumSamplerPadEnv(padIndex, param, value) {
        if (this.drumSamplerPads && this.drumSamplerPads[padIndex] && this.drumSamplerPads[padIndex].envelope) {
            this.drumSamplerPads[padIndex].envelope[param] = parseFloat(value);
        }
    }

    setTrackColor(color) {
        this.trackColor = color;
        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'trackColorChanged');
        }
    }

    setInstrumentSamplerRootNote(noteName) {
        if (this.instrumentSamplerSettings) {
            this.instrumentSamplerSettings.rootNote = noteName;
            this.setupToneSampler();
        }
    }
    setInstrumentSamplerLoop(loop) {
        if (this.instrumentSamplerSettings) {
            this.instrumentSamplerSettings.loop = !!loop;
            if (this.toneSampler && !this.toneSampler.disposed) this.toneSampler.loop = this.instrumentSamplerSettings.loop;
        }
    }
    setInstrumentSamplerLoopStart(time) {
        if (this.instrumentSamplerSettings) {
            this.instrumentSamplerSettings.loopStart = parseFloat(time) || 0;
            if (this.toneSampler && !this.toneSampler.disposed) this.toneSampler.loopStart = this.instrumentSamplerSettings.loopStart;
        }
    }
    setInstrumentSamplerLoopEnd(time) {
        if (this.instrumentSamplerSettings) {
            this.instrumentSamplerSettings.loopEnd = parseFloat(time) || 0;
            if (this.toneSampler && !this.toneSampler.disposed) this.toneSampler.loopEnd = this.instrumentSamplerSettings.loopEnd;
        }
    }
    setInstrumentSamplerEnv(param, value) {
        if (this.instrumentSamplerSettings && this.instrumentSamplerSettings.envelope) {
            this.instrumentSamplerSettings.envelope[param] = parseFloat(value);
            if (this.toneSampler && !this.toneSampler.disposed) {
                if (param === 'attack' && typeof this.toneSampler.attack !== 'undefined') this.toneSampler.attack = value;
                if (param === 'release' && typeof this.toneSampler.release !== 'undefined') this.toneSampler.release = value;
            }
        }
    }

    _captureUndoState(description) {
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(description);
        } else {
            console.warn(`[Track ${this.id}] captureStateForUndo service not available.`);
        }
    }

    createNewSequence(name = `Sequence ${this.sequences.length + 1}`, initialLengthSteps = Constants.defaultStepsPerBar, skipUndo = false) {
        if (this.type === 'Audio') return null;
        const newSeqId = `seq_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        let numRowsForGrid;

        if (this.type === 'Synth' || this.type === 'InstrumentSampler') numRowsForGrid = Constants.synthPitches.length;
        else if (this.type === 'Sampler') numRowsForGrid = (this.slices && this.slices.length > 0) ? this.slices.length : Constants.numSlices;
        else if (this.type === 'DrumSampler') numRowsForGrid = Constants.numDrumSamplerPads;
        else numRowsForGrid = 1;

        if (numRowsForGrid <= 0) {
             console.warn(`[Track ${this.id} createNewSequence] numRowsForGrid was <= 0 for type ${this.type} (calculated ${numRowsForGrid}), defaulting to 1.`);
             numRowsForGrid = 1;
        }
        const actualLength = Math.max(Constants.STEPS_PER_BAR, initialLengthSteps);

        const newSequence = {
            id: newSeqId,
            name: name,
            data: Array(numRowsForGrid).fill(null).map(() => Array(actualLength).fill(null)),
            length: actualLength
        };
        this.sequences.push(newSequence);
        this.activeSequenceId = newSeqId;
        this.recreateToneSequence(true);
        if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
        if (!skipUndo) this._captureUndoState(`Create Sequence "${name}" on ${this.name}`);
        console.log(`[Track ${this.id}] Created new sequence: "${name}" (ID: ${newSeqId}), Rows: ${numRowsForGrid}, Length: ${actualLength}`);
        return newSequence;
    }

    deleteSequence(sequenceId) {
        if (this.type === 'Audio') return;
        if (!this.sequences || this.sequences.length <= 1) {
            if(this.appServices.showNotification) this.appServices.showNotification("Cannot delete the last sequence.", 2000);
            return;
        }
        const index = this.sequences.findIndex(s => s.id === sequenceId);
        if (index > -1) {
            const deletedSeqName = this.sequences[index].name;
            this._captureUndoState(`Delete sequence "${deletedSeqName}" from ${this.name}`);
            this.sequences.splice(index, 1);
            if (this.activeSequenceId === sequenceId) {
                this.activeSequenceId = this.sequences[0]?.id || null;
            }
            this.recreateToneSequence(true);
            this.timelineClips = this.timelineClips.filter(clip => clip.type !== 'sequence' || clip.sourceSequenceId !== sequenceId);
            if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
            if (this.appServices.renderTimeline) this.appServices.renderTimeline();
            console.log(`[Track ${this.id}] Deleted sequence: ${deletedSeqName} (ID: ${sequenceId})`);
        } else {
            console.warn(`[Track ${this.id}] Sequence ID ${sequenceId} not found for deletion.`);
        }
    }

    renameSequence(sequenceId, newName) {
        if (this.type === 'Audio') return;
        const sequence = this.sequences ? this.sequences.find(s => s.id === sequenceId) : null;
        if (sequence && typeof newName === 'string' && newName.trim() !== "") {
            const oldName = sequence.name;
            if (oldName === newName.trim()) return; 
            this._captureUndoState(`Rename sequence "${oldName}" to "${newName.trim()}" on ${this.name}`);
            sequence.name = newName.trim();
            if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
            if (this.appServices.renderTimeline) this.appServices.renderTimeline();
            console.log(`[Track ${this.id}] Renamed sequence ID ${sequenceId} from "${oldName}" to: "${newName.trim()}"`);
        } else if (!sequence) {
            console.warn(`[Track ${this.id}] Sequence ID ${sequenceId} not found for renaming.`);
        }
    }

    duplicateSequence(sequenceId) {
        if (this.type === 'Audio') return null;
        const originalSequence = this.sequences ? this.sequences.find(s => s.id === sequenceId) : null;
        if (!originalSequence) {
            console.warn(`[Track ${this.id}] Original sequence ID ${sequenceId} not found for duplication.`);
            return null;
        }

        const newSeqId = `seq_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        const newSequence = {
            id: newSeqId,
            name: `${originalSequence.name} Copy`,
            data: JSON.parse(JSON.stringify(originalSequence.data || [])),
            length: originalSequence.length
        };
        this.sequences.push(newSequence);
        this._captureUndoState(`Duplicate sequence "${originalSequence.name}" on ${this.name}`);
        if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
        console.log(`[Track ${this.id}] Duplicated sequence: "${originalSequence.name}" to "${newSequence.name}" (ID: ${newSeqId})`);
        return newSequence;
    }


    setActiveSequence(sequenceId) {
        if (this.type === 'Audio') return;
        const seq = this.sequences ? this.sequences.find(s => s.id === sequenceId) : null;
        if (seq && this.activeSequenceId !== sequenceId) {
            console.log(`[Track ${this.id}] Setting active sequence to: "${seq.name}" (ID: ${sequenceId})`);
            this.activeSequenceId = sequenceId;
            this.recreateToneSequence(true);
            if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
        } else if (!seq) {
            console.warn(`[Track ${this.id}] Sequence ID ${sequenceId} not found to set as active.`);
        }
    }

    doubleSequence() {
        if (this.type === 'Audio') return;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq) {
            console.warn(`[Track ${this.id} doubleSequence] No active sequence found.`);
            return;
        }

        const oldLength = activeSeq.length;
        const newLength = oldLength * 2;
        if (newLength > (Constants.MAX_BARS * Constants.STEPS_PER_BAR)) {
            if(this.appServices.showNotification) this.appServices.showNotification(`Cannot double length, exceeds maximum of ${Constants.MAX_BARS} bars.`, 3000);
            return;
        }
        this._captureUndoState(`Double Sequence Length for "${activeSeq.name}" on ${this.name}`);

        activeSeq.data = activeSeq.data || []; 
        activeSeq.data.forEach(row => {
            if (row && Array.isArray(row)) {
               const copyOfOriginal = row.slice(0, oldLength);
               row.length = newLength;
               for(let i = oldLength; i < newLength; i++) row[i] = null; 
               for(let i = 0; i < oldLength; i++) { 
                   if (copyOfOriginal[i]) row[oldLength + i] = JSON.parse(JSON.stringify(copyOfOriginal[i]));
               }
            }
        });
        activeSeq.length = newLength;
        this.recreateToneSequence(true);
        if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
        console.log(`[Track ${this.id}] Doubled length of sequence "${activeSeq.name}" to ${newLength} steps.`);
    }

    shiftSequenceNotes(semitones) {
        if (this.type === 'Audio') return 0;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data) {
            console.warn(`[Track ${this.id} shiftSequenceNotes] No active sequence found.`);
            return 0;
        }

        let shiftedCount = 0;
        const numRows = activeSeq.data.length;
        const totalSteps = activeSeq.length;

        // Determine row shift based on track type
        let rowShift = 0;
        if (this.type === 'Synth' || this.type === 'InstrumentSampler') {
            rowShift = -semitones; // Higher pitch = lower row index
        } else {
            // For Sampler/DrumSampler, just return 0 (can't meaningfully shift pads)
            return 0;
        }

        if (rowShift === 0) return 0;

        const newData = activeSeq.data.map((row, rowIndex) => {
            const newRow = Array(totalSteps).fill(null);
            for (let col = 0; col < totalSteps; col++) {
                const stepData = row && row[col];
                if (stepData && stepData.active) {
                    const sourceRow = rowIndex + rowShift;
                    if (sourceRow >= 0 && sourceRow < numRows) {
                        newRow[col] = { ...stepData };
                        shiftedCount++;
                    }
                }
            }
            return newRow;
        });

        activeSeq.data = newData;
        return shiftedCount;
    }

    humanizeVelocity(amount = 0.15) {
        if (this.type === 'Audio') return 0;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data) {
            console.warn(`[Track ${this.id} humanizeVelocity] No active sequence found.`);
            return 0;
        }

        let humanizedCount = 0;
        const totalSteps = activeSeq.length;

        activeSeq.data.forEach(row => {
            if (!row) return;
            for (let col = 0; col < totalSteps; col++) {
                const stepData = row[col];
                if (stepData && stepData.active && stepData.velocity !== undefined) {
                    const variation = (Math.random() * 2 - 1) * amount; // -amount to +amount
                    const newVelocity = Math.max(0.05, Math.min(1.0, stepData.velocity + variation));
                    row[col].velocity = Math.round(newVelocity * 100) / 100; // Round to 2 decimal places
                    humanizedCount++;
                }
            }
        });

        return humanizedCount;
    }

    quantizeSequence(quantizeTo = 16) {
        if (this.type === 'Audio') return 0;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data) {
            console.warn(`[Track ${this.id} quantizeSequence] No active sequence found.`);
            return 0;
        }

        let quantizedCount = 0;
        const totalSteps = activeSeq.length;

        // For each step, find the nearest quantizeTo grid point and move the note there
        // If a note is at column C and quantizeTo=N, the snapped column is Math.round(C/N)*N
        activeSeq.data.forEach(row => {
            if (!row) return;
            const newRow = Array(totalSteps).fill(null);
            for (let col = 0; col < totalSteps; col++) {
                const stepData = row[col];
                if (stepData && stepData.active) {
                    const snappedCol = Math.round(col / quantizeTo) * quantizeTo;
                    if (snappedCol !== col) {
                        newRow[snappedCol] = { ...stepData };
                        quantizedCount++;
                    }
                }
            }
            // Copy over any notes that fell through (couldn't be placed at any nearby slot)
            for (let col = 0; col < totalSteps; col++) {
                const stepData = row[col];
                if (stepData && stepData.active && !newRow.some(n => n && n.active && n !== stepData)) {
                    // Still active but couldn't be placed — leave it at original position
                    // (would overwrite, which is fine since same step data)
                }
            }
            // Actually, simpler: just use the newRow as-is for placed notes
            // Copy any notes that got placed back into the original row structure
            row.forEach((cell, col) => {
                if (cell && cell.active) {
                    const snappedCol = Math.round(col / quantizeTo) * quantizeTo;
                    const existing = newRow.find(n => n && n.active && n !== cell);
                    if (snappedCol >= 0 && snappedCol < totalSteps) {
                        const newCell = newRow[snappedCol];
                        if (newCell && newCell !== cell) {
                            // There was already a note placed there — keep both? No, overwrite
                            row[snappedCol] = { ...cell };
                        }
                    }
                }
            });
        });

        // Simpler approach: for each note, snap its column in place
        let snappedCount = 0;
        const notesToMove = []; // Collect {row, oldCol, data} to move after iteration
        activeSeq.data.forEach((row, rowIndex) => {
            if (!row) return;
            for (let col = 0; col < totalSteps; col++) {
                const stepData = row[col];
                if (stepData && stepData.active) {
                    const snappedCol = Math.round(col / quantizeTo) * quantizeTo;
                    if (snappedCol !== col) {
                        notesToMove.push({ rowIndex, fromCol: col, toCol: snappedCol, data: { ...stepData } });
                    }
                }
            }
        });

        // Clear original positions
        notesToMove.forEach(({ rowIndex, fromCol }) => {
            if (activeSeq.data[rowIndex]) {
                activeSeq.data[rowIndex][fromCol] = null;
            }
        });

        // Place at snapped positions (if collisions, first note wins)
        notesToMove.forEach(({ toCol, data, rowIndex }) => {
            if (activeSeq.data[rowIndex] && !activeSeq.data[rowIndex][toCol]) {
                activeSeq.data[rowIndex][toCol] = data;
                snappedCount++;
            } else {
                // Find nearest free slot
                let placed = false;
                for (let delta = 1; delta < quantizeTo; delta++) {
                    const down = toCol - delta;
                    const up = toCol + delta;
                    if (down >= 0 && activeSeq.data[rowIndex] && !activeSeq.data[rowIndex][down]) {
                        activeSeq.data[rowIndex][down] = data;
                        placed = true;
                        snappedCount++;
                        break;
                    }
                    if (up < totalSteps && activeSeq.data[rowIndex] && !activeSeq.data[rowIndex][up]) {
                        activeSeq.data[rowIndex][up] = data;
                        placed = true;
                        snappedCount++;
                        break;
                    }
                }
            }
        });

        return snappedCount;
    }

    copySequenceSection(startCol, endCol) {
        if (this.type === 'Audio') return null;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data) {
            console.warn(`[Track ${this.id} copySequenceSection] No active sequence found.`);
            return null;
        }

        const sectionData = [];
        for (let rowIndex = 0; rowIndex < activeSeq.data.length; rowIndex++) {
            const row = activeSeq.data[rowIndex];
            if (!row) continue;
            const newRow = [];
            for (let col = startCol; col <= endCol; col++) {
                if (col >= 0 && col < row.length) {
                    newRow.push(row[col]);
                } else {
                    newRow.push(null);
                }
            }
            sectionData.push(newRow);
        }

        return sectionData;
    }

    pasteSequenceSection(sectionData, targetCol, skipUndo = false) {
        if (this.type === 'Audio') return 0;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data || !sectionData) {
            console.warn(`[Track ${this.id} pasteSequenceSection] No active sequence or no section data.`);
            return 0;
        }

        let pastedCount = 0;
        const sectionNumRows = sectionData.length;
        const sectionLength = sectionData[0]?.length || 0;

        for (let rowIndex = 0; rowIndex < activeSeq.data.length; rowIndex++) {
            const targetRow = activeSeq.data[rowIndex];
            if (!targetRow) continue;

            const sourceRowIndex = rowIndex < sectionNumRows ? rowIndex : (sectionNumRows > 1 ? sectionNumRows - 1 : 0);
            const sourceRow = sectionData[sourceRowIndex];
            if (!sourceRow) continue;

            for (let colIndex = 0; colIndex < sectionLength; colIndex++) {
                const targetColIndex = targetCol + colIndex;
                if (targetColIndex < 0 || targetColIndex >= targetRow.length) continue;
                const noteData = sourceRow[colIndex];
                if (noteData && noteData.active) {
                    if (!targetRow[targetColIndex] || !targetRow[targetColIndex].active) {
                        pastedCount++;
                    }
                    targetRow[targetColIndex] = JSON.parse(JSON.stringify(noteData));
                } else {
                    if (targetColIndex >= 0 && targetColIndex < targetRow.length) {
                        targetRow[targetColIndex] = null;
                    }
                }
            }
        }

        return pastedCount;
    }

    setSequenceLength(newLengthInSteps, skipUndoCapture = false) {
        if (this.type === 'Audio') return;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq) {
            console.warn(`[Track ${this.id} setSequenceLength] No active sequence to set length for.`);
            return;
        }

        const oldActualLength = activeSeq.length || 0;
        let validatedNewLength = Math.max(Constants.STEPS_PER_BAR, parseInt(newLengthInSteps) || Constants.defaultStepsPerBar);
        validatedNewLength = Math.ceil(validatedNewLength / Constants.STEPS_PER_BAR) * Constants.STEPS_PER_BAR;
        validatedNewLength = Math.min(validatedNewLength, Constants.MAX_BARS * Constants.STEPS_PER_BAR);

        if (oldActualLength === validatedNewLength && activeSeq.length === validatedNewLength) return; 

        if (!skipUndoCapture) {
            this._captureUndoState(`Set Seq Length for "${activeSeq.name}" on ${this.name} to ${validatedNewLength / Constants.STEPS_PER_BAR} bars`);
        }
        activeSeq.length = validatedNewLength;

        let numRows;
        if (this.type === 'Synth' || this.type === 'InstrumentSampler') numRows = Constants.synthPitches.length;
        else if (this.type === 'Sampler') numRows = (this.slices && this.slices.length > 0) ? this.slices.length : Constants.numSlices;
        else if (this.type === 'DrumSampler') numRows = Constants.numDrumSamplerPads;
        else numRows = (activeSeq.data && activeSeq.data.length > 0) ? activeSeq.data.length : 1;

        if (numRows <= 0) numRows = 1; 

        const currentSequenceData = activeSeq.data || [];
        activeSeq.data = Array(numRows).fill(null).map((_, rIndex) => {
            const currentRow = currentSequenceData[rIndex] || [];
            const newRow = Array(activeSeq.length).fill(null);
            for (let c = 0; c < Math.min(currentRow.length, activeSeq.length); c++) newRow[c] = currentRow[c];
            return newRow;
        });

        this.recreateToneSequence(true);
        if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
        console.log(`[Track ${this.id}] Set sequence "${activeSeq.name}" length to ${activeSeq.length} steps, ${numRows} rows.`);
    }


    recreateToneSequence(forceRestart = false, startTimeOffset = 0) {
        if (this.type === 'Audio') return;
        const currentPlaybackMode = this.appServices.getPlaybackMode ? this.appServices.getPlaybackMode() : 'sequencer';
        console.log(`[Track ${this.id} recreateToneSequence] For "${this.name}". ActiveSeqID: ${this.activeSequenceId}. Mode: ${currentPlaybackMode}`);

        if (this.patternPlayerSequence && !this.patternPlayerSequence.disposed) {
            try {
                this.patternPlayerSequence.stop();
                this.patternPlayerSequence.clear();
                this.patternPlayerSequence.dispose();
            } catch(e) { console.warn(`[Track ${this.id}] Error disposing old Tone.Sequence:`, e.message); }
        }
        this.patternPlayerSequence = null; 

        if (currentPlaybackMode !== 'sequencer') {
            console.log(`[Track ${this.id} recreateToneSequence] Not in 'sequencer' mode. Sequence player not created.`);
            return;
        }

        const activeSeq = this.getActiveSequence();
        if (!activeSeq) {
            console.warn(`[Track ${this.id} recreateToneSequence] No active sequence (ID: ${this.activeSequenceId}). Aborting.`);
            return;
        }
        if (!activeSeq.data || !Array.isArray(activeSeq.data) || activeSeq.data.length === 0) {
            let numRowsForInit;
            if (this.type === 'Synth' || this.type === 'InstrumentSampler') numRowsForInit = Constants.synthPitches.length;
            else if (this.type === 'Sampler') numRowsForInit = (this.slices && this.slices.length > 0) ? this.slices.length : Constants.numSlices;
            else if (this.type === 'DrumSampler') numRowsForInit = Constants.numDrumSamplerPads;
            else numRowsForInit = 1;
            if (numRowsForInit <= 0) numRowsForInit = 1;
            activeSeq.data = Array(numRowsForInit).fill(null).map(() => Array(activeSeq.length || Constants.defaultStepsPerBar).fill(null));
            console.warn(`[Track ${this.id} recreateToneSequence] Active sequence "${activeSeq.name}" had invalid/empty data. Initialized with ${numRowsForInit} rows.`);
        }
        if (!activeSeq.length || !Number.isFinite(activeSeq.length) || activeSeq.length < Constants.STEPS_PER_BAR) {
            activeSeq.length = Constants.defaultStepsPerBar;
            console.warn(`[Track ${this.id} recreateToneSequence] Active sequence "${activeSeq.name}" had invalid length. Reset to ${activeSeq.length}.`);
            activeSeq.data.forEach(row => { if(row) row.length = activeSeq.length; });
        }

        const sequenceDataForTone = activeSeq.data;
        const sequenceLengthForTone = activeSeq.length;
        console.log(`[Track ${this.id} recreateToneSequence] Creating Tone.Sequence for "${activeSeq.name}" (${sequenceLengthForTone} steps, ${sequenceDataForTone.length} rows).`);

        try {
            this.patternPlayerSequence = new Tone.Sequence((time, col) => {
                const playbackModeCheck = this.appServices.getPlaybackMode ? this.appServices.getPlaybackMode() : 'sequencer';
                if (playbackModeCheck !== 'sequencer') {
                    if (this.patternPlayerSequence && this.patternPlayerSequence.state === 'started') this.patternPlayerSequence.stop();
                    return;
                }

                const currentGlobalSoloId = this.appServices.getSoloedTrackId ? this.appServices.getSoloedTrackId() : null;
                const isEffectivelyMuted = this.isMuted || (currentGlobalSoloId !== null && currentGlobalSoloId !== this.id);

                if (this.appServices.highlightPlayingStep) this.appServices.highlightPlayingStep(this.id, col);
                if (!this.gainNode || this.gainNode.disposed || isEffectivelyMuted) return;

                const effectsChainStartPoint = (this.activeEffects.length > 0 && this.activeEffects[0].toneNode && !this.activeEffects[0].toneNode.disposed)
                    ? this.activeEffects[0].toneNode
                    : (this.gainNode && !this.gainNode.disposed ? this.gainNode : null);
                if (!effectsChainStartPoint) return;

                if (this.type === 'Synth' && this.instrument && !this.instrument.disposed) {
                    let notePlayedThisStep = false;
                    for (let rowIndex = 0; rowIndex < Constants.synthPitches.length; rowIndex++) {
                        const pitchName = Constants.synthPitches[rowIndex];
                        const step = sequenceDataForTone[rowIndex]?.[col];
                        if (((step) && (step).active) && !notePlayedThisStep) {
                            this.instrument.triggerAttackRelease(pitchName, "16n", time, step.velocity * Constants.defaultVelocity); 
                            notePlayedThisStep = true;
                        }
                    }
                } else if (this.type === 'Sampler') {
                     (this.slices || []).forEach((sliceData, sliceIndex) => {
                        const step = sequenceDataForTone[sliceIndex]?.[col];
                        if (((step) && (step).active) && ((sliceData) && (sliceData).duration) > 0 && ((this.audioBuffer) && (this.audioBuffer).loaded)) {
                            const targetVolumeLinear = sliceData.volume * step.velocity;
                            const playbackRate = Math.pow(2, (sliceData.pitchShift || 0) / 12);
                            let playDuration = sliceData.duration / playbackRate;
                            if (sliceData.loop) playDuration = Tone.Time("16n").toSeconds();

                            if (this.slicerIsPolyphonic) {
                                const tempPlayer = new Tone.Player(this.audioBuffer);
                                const tempEnv = new Tone.AmplitudeEnvelope(sliceData.envelope);
                                const tempGain = new Tone.Gain(targetVolumeLinear);
                                tempPlayer.chain(tempEnv, tempGain);
                                tempPlayer.playbackRate = playbackRate; tempPlayer.reverse = sliceData.reverse || false; tempPlayer.loop = sliceData.loop || false;
                                tempPlayer.loopStart = sliceData.offset; tempPlayer.loopEnd = sliceData.offset + sliceData.duration;
                                tempPlayer.start(time, sliceData.offset, sliceData.loop ? undefined : playDuration);
                                tempEnv.triggerAttack(time);
                                if (!sliceData.loop) tempEnv.triggerRelease(time + playDuration * 0.95);
                                Tone.Transport.scheduleOnce(() => {
                                    try { if(tempPlayer && !tempPlayer.disposed) tempPlayer.dispose(); } catch(e){}
                                    try { if(tempEnv && !tempEnv.disposed) tempEnv.dispose(); } catch(e){}
                                }, time + playDuration + (((sliceData.envelope) && (sliceData.envelope).release) || 0.1) + 0.3);
                            } else if (this.slicerMonoPlayer && !this.slicerMonoPlayer.disposed && this.slicerMonoEnvelope && !this.slicerMonoEnvelope.disposed && this.slicerMonoGain && !this.slicerMonoGain.disposed) {
                                if (this.slicerMonoPlayer.state === 'started') this.slicerMonoPlayer.stop(time);
                                this.slicerMonoEnvelope.triggerRelease(time);
                                this.slicerMonoPlayer.buffer = this.audioBuffer;
                                this.slicerMonoEnvelope.set(sliceData.envelope);
                                this.slicerMonoGain.gain.value = targetVolumeLinear;
                                this.slicerMonoPlayer.playbackRate = playbackRate; this.slicerMonoPlayer.reverse = sliceData.reverse || false;
                                this.slicerMonoPlayer.loop = sliceData.loop || false; this.slicerMonoPlayer.loopStart = sliceData.offset; this.slicerMonoPlayer.loopEnd = sliceData.offset + sliceData.duration;
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
                        const step = sequenceDataForTone[padIndex]?.[col];
                        const padData = this.drumSamplerPads[padIndex];
                        if (((step) && (step).active) && padData && this.drumPadPlayers[padIndex] && !this.drumPadPlayers[padIndex].disposed && this.drumPadPlayers[padIndex].loaded) {
                            const player = this.drumPadPlayers[padIndex];
                            player.volume.value = Tone.gainToDb(padData.volume * step.velocity * 0.7);
                            player.playbackRate = Math.pow(2, (padData.pitchShift || 0) / 12);
                            player.start(time);
                        }
                    });
                } else if (this.type === 'InstrumentSampler' && this.toneSampler && !this.toneSampler.disposed && this.toneSampler.loaded) {
                    let notePlayedThisStep = false;
                    Constants.synthPitches.forEach((pitchName, rowIndex) => {
                        const step = sequenceDataForTone[rowIndex]?.[col];
                        if (((step) && (step).active)) {
                            if (!this.instrumentSamplerIsPolyphonic && !notePlayedThisStep) {
                                this.toneSampler.releaseAll(time); notePlayedThisStep = true;
                            }
                            this.toneSampler.triggerAttackRelease(Tone.Frequency(pitchName).toNote(), "16n", time, step.velocity * Constants.defaultVelocity);
                        }
                    });
                }
            }, Array.from(Array(sequenceLengthForTone).keys()), "16n");

            this.patternPlayerSequence.loop = true;
            console.log(`[Track ${this.id} recreateToneSequence] Tone.Sequence for "${activeSeq.name}" prepared. Loop: true.`);
        } catch (error) {
            console.error(`[Track ${this.id} recreateToneSequence] Error creating Tone.Sequence for "${activeSeq.name}":`, error);
            this.patternPlayerSequence = null;
        }

        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
        }
    }

    async addAudioClip(blob, startTime) {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] addAudioClip called on non-Audio track type: ${this.type}`);
            return;
        }
        const clipId = `audioclip_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        const dbKey = `clip_${this.id}_${Date.now()}_${blob.size}.wav`; 

        try {
            await storeAudio(dbKey, blob);
            let duration = 0;
            
            // FIX Bug #10: Ensure AudioContext is running before getting duration
            // Initialize audio context if needed
            if (this.appServices.initAudioContextAndMasterMeter) {
                await this.appServices.initAudioContextAndMasterMeter(true);
            }
            
            try {
                duration = await this.getBlobDuration(blob);
            } catch(durationError) {
                console.warn(`[Track ${this.id}] Could not determine duration for new audio clip ${clipId}, defaulting to 0. Error:`, durationError);
            }

            // FIX Bug #2: Use the correct start time
            // The caller should pass the actual recording start position, not the end time
            // If startTime is 0 or negative, default to 0
            const clipStartTime = Math.max(0, startTime);

            const newClip = {
                id: clipId, type: 'audio', sourceId: dbKey,
                startTime: clipStartTime, 
                duration: duration,
                name: `Rec ${new Date().toLocaleTimeString().substring(0,8)}`
            };

            this.timelineClips.push(newClip);
            console.log(`[Track ${this.id}] Added audio clip to timeline:`, newClip, "Start:", clipStartTime, "Duration:", duration);
            this._captureUndoState(`Add Recorded Clip to ${this.name}`);

            if (this.appServices.renderTimeline) this.appServices.renderTimeline();
        } catch (error) {
            console.error(`[Track ${this.id} addAudioClip] Error:`, error);
            if (this.appServices.showNotification) this.appServices.showNotification("Failed to save recorded audio clip.", 3000);
        }
    }

    async addExternalAudioFileAsClip(audioFileBlob, startTime, clipName = null) {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] addExternalAudioFileAsClip called on non-Audio track type: ${this.type}`);
            if (this.appServices.showNotification) this.appServices.showNotification("Audio files can only be added to Audio Tracks.", 3000);
            return null;
        }
        const clipId = `audioclip_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
        const dbKey = `clip_${this.id}_${audioFileBlob.name.replace(/[^a-zA-Z0-9-_.]/g, '_')}_${audioFileBlob.size}_${Date.now()}`;

        try {
            await storeAudio(dbKey, audioFileBlob);
            let duration = 0;
            try {
                duration = await this.getBlobDuration(audioFileBlob);
            } catch (durationError) {
                console.warn(`[Track ${this.id}] Could not determine duration for external audio clip ${clipId}, defaulting to 0. Error:`, durationError);
            }

            const newClip = {
                id: clipId,
                type: 'audio',
                sourceId: dbKey,
                startTime: Math.max(0, startTime),
                duration: duration,
                name: clipName || audioFileBlob.name || `Audio Clip ${this.timelineClips.filter(c => c.type === 'audio').length + 1}`
            };

            this.timelineClips.push(newClip);
            console.log(`[Track ${this.id}] Added external audio file as clip to timeline:`, newClip);
            this._captureUndoState(`Add Audio File Clip "${newClip.name}" to ${this.name}`);

            if (this.appServices.renderTimeline) this.appServices.renderTimeline();
            return newClip;
        } catch (error) {
            console.error(`[Track ${this.id} addExternalAudioFileAsClip] Error:`, error);
            if (this.appServices.showNotification) this.appServices.showNotification("Failed to save and add audio file clip.", 3000);
            return null;
        }
    }

    addSequenceClipToTimeline(sourceSequenceId, startTime, clipName = null) {
        if (this.type === 'Audio') {
            console.warn(`[Track ${this.id}] addSequenceClipToTimeline called on Audio track. Sequences are not applicable.`);
            if (this.appServices.showNotification) this.appServices.showNotification("Cannot add sequence clips to Audio Tracks.", 3000);
            return null;
        }

        const sourceSequence = this.sequences ? this.sequences.find(s => s.id === sourceSequenceId) : null;
        if (!sourceSequence) {
            console.warn(`[Track ${this.id}] Source sequence with ID ${sourceSequenceId} not found.`);
            if (this.appServices.showNotification) this.appServices.showNotification("Source sequence not found.", 3000);
            return null;
        }

        const clipId = `seqclip_${this.id}_${sourceSequenceId}_${Date.now()}_${Math.random().toString(36).substr(2,7)}`;
        const sixteenthNoteTime = Tone.Time("16n").toSeconds(); 
        const duration = sourceSequence.length * sixteenthNoteTime;

        const newClip = {
            id: clipId,
            type: 'sequence',
            sourceSequenceId: sourceSequenceId,
            startTime: Math.max(0, startTime),
            duration: duration,
            name: clipName || sourceSequence.name || `Seq Clip ${this.timelineClips.filter(c => c.type === 'sequence').length + 1}`
        };

        this.timelineClips.push(newClip);
        console.log(`[Track ${this.id}] Added sequence clip to timeline:`, newClip);
        this._captureUndoState(`Add Sequence Clip "${newClip.name}" to ${this.name}`);

        if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'sequencerContentChanged');
        if (this.appServices.renderTimeline) this.appServices.renderTimeline();
        return newClip;
    }


    async getBlobDuration(blob) {
        if (!blob || blob.size === 0) return 0;
        const tempUrl = URL.createObjectURL(blob);
        const audioContext = ((Tone.context) && (Tone.context).rawContext);
        if (!audioContext) {
            console.warn(`[Track ${this.id} getBlobDuration] No raw AudioContext available from Tone.`);
            URL.revokeObjectURL(tempUrl);
            return 0;
        }
        try {
            const arrayBuffer = await fetch(tempUrl).then(res => res.arrayBuffer());
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            return audioBuffer.duration;
        } catch (e) {
            console.error(`[Track ${this.id} getBlobDuration] Error decoding audio data:`, e);
            return 0;
        } finally {
            URL.revokeObjectURL(tempUrl);
        }
    }

    async schedulePlayback(transportStartTime, transportStopTime) {
        const playbackMode = this.appServices.getPlaybackMode ? this.appServices.getPlaybackMode() : 'sequencer';
        console.log(`[Track ${this.id} "${this.name}"] schedulePlayback. Mode: ${playbackMode}. Transport Range: ${transportStartTime.toFixed(2)}s to ${transportStopTime.toFixed(2)}s`);

        this.stopPlayback(); 

        if (playbackMode === 'timeline') {
            for (const clip of this.timelineClips) {
                if (!clip || typeof clip.startTime !== 'number' || typeof clip.duration !== 'number') {
                    console.warn(`[Track ${this.id}] Skipping invalid clip:`, clip);
                    continue;
                }
                const clipActualStart = clip.startTime;
                const clipActualEnd = clip.startTime + clip.duration;

                const effectivePlayStart = Math.max(clipActualStart, transportStartTime);
                const effectivePlayEnd = Math.min(clipActualEnd, transportStopTime);
                let playDurationInWindow = effectivePlayEnd - effectivePlayStart;

                if (playDurationInWindow <= 1e-3) continue; 

                const offsetIntoSource = Math.max(0, effectivePlayStart - clipActualStart);

                if (clip.type === 'audio') {
                    if (!clip.sourceId) { console.warn(`[Track ${this.id}] Audio clip ${clip.id} has no sourceId.`); continue; }
                    console.log(`[Track ${this.id}] Timeline: Scheduling AUDIO clip "${clip.name}" (ID: ${clip.id}) at ${effectivePlayStart.toFixed(2)}s for ${playDurationInWindow.toFixed(2)}s (offset ${offsetIntoSource.toFixed(2)}s)`);
                    const player = new Tone.Player();
                    this.clipPlayers.set(clip.id, player);
                    try {
                        const audioBlob = await getAudio(clip.sourceId);
                        if (audioBlob) {
                            const url = URL.createObjectURL(audioBlob);
                            player.onload = () => {
                                URL.revokeObjectURL(url);
                                const destNode = (this.activeEffects.length > 0 && this.activeEffects[0].toneNode && !this.activeEffects[0].toneNode.disposed)
                                    ? this.activeEffects[0].toneNode
                                    : (this.gainNode || null);
                                if (destNode) player.connect(destNode); else player.toDestination();
                                player.start(effectivePlayStart, offsetIntoSource, playDurationInWindow);
                            };
                            player.onerror = (err) => { console.error(`[Track ${this.id}] Player error for clip ${clip.id}:`, err); URL.revokeObjectURL(url); if(this.clipPlayers.has(clip.id)){try{if(!player.disposed)player.dispose()}catch(e){}this.clipPlayers.delete(clip.id);}};
                            await player.load(url);
                        } else {
                            console.warn(`[Track ${this.id}] Blob not found for audio clip ${clip.id} (source ${clip.sourceId})`);
                            if(!player.disposed) player.dispose(); this.clipPlayers.delete(clip.id);
                        }
                    } catch (err) { console.error(`[Track ${this.id}] Error loading/scheduling audio clip ${clip.id}:`, err); if(this.clipPlayers.has(clip.id)){const p = this.clipPlayers.get(clip.id); if(p && !p.disposed) try{p.dispose()}catch(e){}this.clipPlayers.delete(clip.id);}}
                } else if (clip.type === 'sequence') {
                    const sourceSequence = this.sequences ? this.sequences.find(s => s.id === clip.sourceSequenceId) : null;
                    if (((sourceSequence) && (sourceSequence).data)?.length > 0 && sourceSequence.length > 0) {
                        console.log(`[Track ${this.id}] Timeline: Scheduling SEQUENCE clip "${clip.name}" (Source: "${sourceSequence.name}") from ${effectivePlayStart.toFixed(2)}s for ${playDurationInWindow.toFixed(2)}s using Tone.Part`);

                        const events = [];
                        const sixteenthTime = Tone.Time("16n").toSeconds();

                        for (let stepIdx = 0; stepIdx < sourceSequence.length; stepIdx++) {
                            const timeWithinSeq = stepIdx * sixteenthTime;
                            if (clipActualStart + timeWithinSeq >= effectivePlayStart && clipActualStart + timeWithinSeq < effectivePlayEnd) {
                                const eventTimeInPart = (clipActualStart + timeWithinSeq) - effectivePlayStart;
                                for (let rowIdx = 0; rowIdx < sourceSequence.data.length; rowIdx++) {
                                    const stepData = sourceSequence.data[rowIdx]?.[stepIdx];
                                    if (((stepData) && (stepData).active)) {
                                        let noteValue;
                                        let noteDuration = "16n"; 
                                        if (this.type === 'Synth' || this.type === 'InstrumentSampler') {
                                            noteValue = Constants.synthPitches[rowIdx];
                                        } else if (this.type === 'Sampler') {
                                            const sliceData = this.slices[rowIdx];
                                            if (sliceData && sliceData.duration > 0 && ((this.audioBuffer) && (this.audioBuffer).loaded)) {
                                               noteValue = { type: 'slice', index: rowIdx, data: sliceData };
                                            }
                                        } else if (this.type === 'DrumSampler') {
                                            const padData = this.drumSamplerPads[rowIdx];
                                            if (padData && this.drumPadPlayers[rowIdx]?.loaded) {
                                                noteValue = { type: 'drum', index: rowIdx, data: padData };
                                            }
                                        }
                                        if (noteValue) {
                                            events.push([eventTimeInPart, {
                                                note: noteValue,
                                                velocity: stepData.velocity * Constants.defaultVelocity,
                                                duration: noteDuration
                                            }]);
                                        }
                                    }
                                }
                            }
                        }

                        if (events.length > 0) {
                            const part = new Tone.Part((time, value) => { 
                                const soloId = this.appServices.getSoloedTrackId ? this.appServices.getSoloedTrackId() : null;
                                const muted = this.isMuted || (soloId !== null && soloId !== this.id);
                                if (!this.gainNode || this.gainNode.disposed || muted) return;

                                const dest = (this.activeEffects.length > 0 && this.activeEffects[0].toneNode && !this.activeEffects[0].toneNode.disposed)
                                    ? this.activeEffects[0].toneNode
                                    : (this.gainNode || null);
                                if (!dest) return;

                                if (this.type === 'Synth' && this.instrument && !this.instrument.disposed && typeof value.note === 'string') {
                                    this.instrument.triggerAttackRelease(value.note, value.duration, time, value.velocity);
                                } else if (this.type === 'InstrumentSampler' && this.toneSampler && !this.toneSampler.disposed && this.toneSampler.loaded && typeof value.note === 'string') {
                                    let notePlayed = false; 
                                    if (!this.instrumentSamplerIsPolyphonic && !notePlayed) {
                                        this.toneSampler.releaseAll(time);
                                        notePlayed = true;
                                    }
                                    this.toneSampler.triggerAttackRelease(Tone.Frequency(value.note).toNote(), value.duration, time, value.velocity);
                                } else if (this.type === 'Sampler' && value.note.type === 'slice' && ((this.audioBuffer) && (this.audioBuffer).loaded)) {
                                    const sliceData = value.note.data;
                                    const targetVolumeLinear = sliceData.volume * value.velocity;
                                    const playbackRate = Math.pow(2, (sliceData.pitchShift || 0) / 12);
                                    let playDurationPart = sliceData.duration / playbackRate;
                                    if (sliceData.loop) playDurationPart = Tone.Time(value.duration).toSeconds();

                                    if (this.slicerIsPolyphonic) {
                                        const tempPlayer = new Tone.Player(this.audioBuffer);
                                        const tempEnv = new Tone.AmplitudeEnvelope(sliceData.envelope);
                                        const tempGain = new Tone.Gain(targetVolumeLinear);
                                        tempPlayer.chain(tempEnv, tempGain, dest);
                                        tempPlayer.playbackRate = playbackRate; tempPlayer.reverse = sliceData.reverse || false; tempPlayer.loop = sliceData.loop || false;
                                        tempPlayer.loopStart = sliceData.offset; tempPlayer.loopEnd = sliceData.offset + sliceData.duration;

                                        tempPlayer.start(time, sliceData.offset, sliceData.loop ? undefined : playDurationPart);
                                        tempEnv.triggerAttack(time);
                                        if (!sliceData.loop) tempEnv.triggerRelease(time + playDurationPart * 0.95);
                                        Tone.Transport.scheduleOnce(() => {
                                            try { if(tempPlayer && !tempPlayer.disposed) tempPlayer.dispose(); } catch(e){}
                                            try { if(tempEnv && !tempEnv.disposed) tempEnv.dispose(); } catch(e){}
                                            try { if(tempGain && !tempGain.disposed) tempGain.dispose(); } catch(e){}
                                        }, time + playDurationPart + (((sliceData.envelope) && (sliceData.envelope).release) || 0.1) + 0.3);
                                    } else if (this.slicerMonoPlayer && !this.slicerMonoPlayer.disposed && this.slicerMonoEnvelope && !this.slicerMonoEnvelope.disposed && this.slicerMonoGain && !this.slicerMonoGain.disposed) {
                                        if (this.slicerMonoPlayer.state === 'started') this.slicerMonoPlayer.stop(time);
                                        this.slicerMonoEnvelope.triggerRelease(time); 
                                        this.slicerMonoPlayer.buffer = this.audioBuffer;
                                        this.slicerMonoEnvelope.set(sliceData.envelope);
                                        this.slicerMonoGain.gain.value = targetVolumeLinear;
                                        this.slicerMonoPlayer.playbackRate = playbackRate; this.slicerMonoPlayer.reverse = sliceData.reverse || false;
                                        this.slicerMonoPlayer.loop = sliceData.loop || false; this.slicerMonoPlayer.loopStart = sliceData.offset; this.slicerMonoPlayer.loopEnd = sliceData.offset + sliceData.duration;
                                        this.slicerMonoPlayer.start(time, sliceData.offset, sliceData.loop ? undefined : playDurationPart);
                                        this.slicerMonoEnvelope.triggerAttack(time);
                                        if (!sliceData.loop) {
                                            const releaseTime = time + playDurationPart - (sliceData.envelope.release * 0.05); 
                                            this.slicerMonoEnvelope.triggerRelease(Math.max(time, releaseTime));
                                        }
                                    }
                                }
                            }, events);
                            part.loop = false; 
                            part.start(effectivePlayStart); 
                            if (playDurationInWindow > 0 && playDurationInWindow !== Infinity) {
                                part.stop(effectivePlayStart + playDurationInWindow);
                            }
                            this.clipPlayers.set(`${clip.id}_part`, part);
                        }
                    }
                }
            }
        } else { // Sequencer Mode
            if (!this.patternPlayerSequence || this.patternPlayerSequence.disposed) {
                console.log(`[Track ${this.id} schedulePlayback] Sequencer mode: patternPlayerSequence is invalid, calling recreateToneSequence.`);
                this.recreateToneSequence(true, transportStartTime);
            }
            if (this.patternPlayerSequence && !this.patternPlayerSequence.disposed) {
                if (this.patternPlayerSequence.state === 'started') {
                    try {this.patternPlayerSequence.stop(Tone.Transport.now());} catch(e){console.warn("Err stopping seq player during schedule", e)}
                }
                console.log(`[Track ${this.id}] Sequencer mode: Starting patternPlayerSequence at transport offset: ${transportStartTime.toFixed(2)}s. Loop: ${this.patternPlayerSequence.loop}`);
                try {
                    this.patternPlayerSequence.start(transportStartTime); 
                } catch(e) { console.error(`[Track ${this.id}] Error starting patternPlayerSequence:`, e.message, e); 
                    try { if(!this.patternPlayerSequence.disposed) this.patternPlayerSequence.dispose(); } catch (disposeErr) {}
                    this.patternPlayerSequence = null;
                }
            } else {
                 console.warn(`[Track ${this.id} schedulePlayback] Sequencer mode: patternPlayerSequence still not valid after recreation for "${this.name}".`);
            }
        }
    }


    stopPlayback() {
        console.log(`[Track ${this.id} "${this.name}"] stopPlayback called. Timeline clip players/parts: ${this.clipPlayers.size}`);
        const playersAndPartsToStop = Array.from(this.clipPlayers.values());
        playersAndPartsToStop.forEach(item => { 
            if (item && !item.disposed) {
                try {
                    if (typeof item.unsync === 'function') item.unsync(); 
                    item.stop(Tone.Transport.now()); 
                    item.dispose();
                }
                catch (e) { console.warn(`[Track ${this.id}] Error stopping/disposing a timeline clip player/part:`, e.message); }
            }
        });
        this.clipPlayers.clear();

        if (this.patternPlayerSequence && !this.patternPlayerSequence.disposed) {
            try {
                this.patternPlayerSequence.stop(); 
                this.patternPlayerSequence.clear(); 
                this.patternPlayerSequence.dispose(); 
                console.log(`[Track ${this.id}] Stopped, cleared, and disposed patternPlayerSequence.`);
            }
            catch (e) { console.warn(`[Track ${this.id}] Error stopping/disposing patternPlayerSequence:`, e.message); }
        }
        this.patternPlayerSequence = null; 
        
        // FIX: Release all notes from instruments (synth, sampler, etc.)
        // This ensures audio stops even when notes were triggered via MIDI/keyboard
        if (this.type === 'Synth' && this.instrument && !this.instrument.disposed) {
            try {
                if (typeof this.instrument.releaseAll === 'function') {
                    this.instrument.releaseAll(Tone.now());
                    console.log(`[Track ${this.id}] Released all notes on MonoSynth.`);
                }
            } catch (e) { 
                console.warn(`[Track ${this.id}] Error releasing MonoSynth notes:`, e.message); 
            }
        }
        
        if (this.type === 'InstrumentSampler' && this.toneSampler && !this.toneSampler.disposed) {
            try {
                if (typeof this.toneSampler.releaseAll === 'function') {
                    this.toneSampler.releaseAll(Tone.now());
                    console.log(`[Track ${this.id}] Released all notes on InstrumentSampler.`);
                }
            } catch (e) { 
                console.warn(`[Track ${this.id}] Error releasing InstrumentSampler notes:`, e.message); 
            }
        }
        
        // Stop any drum pad players that might be playing
        if (this.type === 'DrumSampler') {
            this.drumPadPlayers.forEach((player, index) => {
                if (player && !player.disposed && player.state === 'started') {
                    try {
                        player.stop(Tone.now());
                        console.log(`[Track ${this.id}] Stopped drum pad player ${index}.`);
                    } catch (e) {
                        console.warn(`[Track ${this.id}] Error stopping drum pad player ${index}:`, e.message);
                    }
                }
            });
        }
        
        // Stop slicer mono player if active
        if (this.type === 'Sampler' && this.slicerMonoPlayer && !this.slicerMonoPlayer.disposed) {
            try {
                if (this.slicerMonoPlayer.state === 'started') {
                    this.slicerMonoPlayer.stop(Tone.now());
                }
                if (this.slicerMonoEnvelope && !this.slicerMonoEnvelope.disposed) {
                    this.slicerMonoEnvelope.triggerRelease(Tone.now());
                }
                console.log(`[Track ${this.id}] Stopped slicer mono player.`);
            } catch (e) {
                console.warn(`[Track ${this.id}] Error stopping slicer mono player:`, e.message);
            }
        }
    }

    async updateAudioClipPosition(clipId, newStartTime) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (clip) {
            const oldStartTime = clip.startTime;
            clip.startTime = Math.max(0, parseFloat(newStartTime) || 0);
            console.log(`[Track ${this.id}] Updated ${clip.type} clip ${clipId} startTime from ${oldStartTime.toFixed(2)} to ${clip.startTime.toFixed(2)}`);
            this._captureUndoState(`Move Clip "${clip.name || clip.id.slice(-4)}" on ${this.name}`);

            if (this.appServices.renderTimeline) this.appServices.renderTimeline();

            const playbackMode = this.appServices.getPlaybackMode ? this.appServices.getPlaybackMode() : 'sequencer';
            if (Tone.Transport.state === 'started' && playbackMode === 'timeline') {
                console.log(`[Track ${this.id} updateAudioClipPosition] Transport running in timeline. Rescheduling all tracks.`);
                Tone.Transport.pause();
                const allTracks = this.appServices.getTracks ? this.appServices.getTracks() : [];
                allTracks.forEach(t => { if (typeof t.stopPlayback === 'function') t.stopPlayback(); });
                Tone.Transport.cancel(0);
                const currentPlayheadPosition = Tone.Transport.seconds; 
                const scheduleEndTime = currentPlayheadPosition + 300; 
                for (const t of allTracks) {
                    if (typeof t.schedulePlayback === 'function') await t.schedulePlayback(currentPlayheadPosition, scheduleEndTime);
                }
                Tone.Transport.start(Tone.Transport.now() + 0.05, currentPlayheadPosition); 
            }
        } else {
            console.warn(`[Track ${this.id}] Could not find clip ${clipId} to update its position.`);
        }
    }

    async updateAudioClipDuration(clipId, newDuration) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (clip) {
            const oldDuration = clip.duration;
            clip.duration = Math.max(0.1, parseFloat(newDuration) || 0.1);
            console.log(`[Track ${this.id}] Updated ${clip.type} clip ${clipId} duration from ${oldDuration.toFixed(2)} to ${clip.duration.toFixed(2)}`);
            this._captureUndoState(`Resize Clip "${clip.name || clip.id.slice(-4)}" on ${this.name}`);

            if (this.appServices.renderTimeline) this.appServices.renderTimeline();

            const playbackMode = this.appServices.getPlaybackMode ? this.appServices.getPlaybackMode() : 'sequencer';
            if (Tone.Transport.state === 'started' && playbackMode === 'timeline') {
                console.log(`[Track ${this.id} updateAudioClipDuration] Transport running in timeline. Rescheduling all tracks.`);
                Tone.Transport.pause();
                const allTracks = this.appServices.getTracks ? this.appServices.getTracks() : [];
                allTracks.forEach(t => { if (typeof t.stopPlayback === 'function') t.stopPlayback(); });
                Tone.Transport.cancel(0);
                const currentPlayheadPosition = Tone.Transport.seconds; 
                const scheduleEndTime = currentPlayheadPosition + 300; 
                for (const t of allTracks) {
                    if (typeof t.schedulePlayback === 'function') await t.schedulePlayback(currentPlayheadPosition, scheduleEndTime);
                }
                Tone.Transport.start(Tone.Transport.now() + 0.05, currentPlayheadPosition); 
            }
        } else {
            console.warn(`[Track ${this.id}] Could not find clip ${clipId} to update its duration.`);
        }
    }

    dispose() {
        const trackNameForLog = this.name || `Track ${this.id}`; 
        console.log(`[Track Dispose START ${this.id}] Starting disposal for track: "${trackNameForLog}"`);

        try { this.stopPlayback(); } catch (e) { console.warn(`[Track Dispose ${this.id}] Error in stopPlayback during dispose:`, e.message); }

        if (this.patternPlayerSequence && !this.patternPlayerSequence.disposed) {
            try { this.patternPlayerSequence.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing patternPlayerSequence:`, e.message); }
        }
        this.patternPlayerSequence = null;

        if (this.instrument && !this.instrument.disposed) { 
            try { this.instrument.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing instrument:`, e.message); }
        }
        this.instrument = null;

        if (this.toneSampler && !this.toneSampler.disposed) { 
            try { this.toneSampler.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing toneSampler:`, e.message); }
        }
        this.toneSampler = null;

        this.disposeSlicerMonoNodes(); 

        this.drumPadPlayers.forEach((player, index) => { 
            if (player && !player.disposed) {
                try { player.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing drumPadPlayer ${index}:`, e.message); }
            }
            this.drumPadPlayers[index] = null;
        });

        this.activeEffects.forEach(effect => { 
            if (effect.toneNode && !effect.toneNode.disposed) {
                try { effect.toneNode.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing effect "${effect.type}":`, e.message); }
            }
        });
        this.activeEffects = [];

        if (this.gainNode && !this.gainNode.disposed) {
            try { this.gainNode.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing gainNode:`, e.message); }
        }
        this.gainNode = null;

        if (this.trackMeter && !this.trackMeter.disposed) {
            try { this.trackMeter.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing trackMeter:`, e.message); }
        }
        this.trackMeter = null;

        if (this.inputChannel && !this.inputChannel.disposed) { 
            try { this.inputChannel.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing inputChannel:`, e.message); }
        }
        this.inputChannel = null;

        if (this.appServices.closeAllTrackWindows) {
            this.appServices.closeAllTrackWindows(this.id);
        }

        if (this.audioBuffer && !this.audioBuffer.disposed) { 
            try { this.audioBuffer.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing audioBuffer (Sampler):`, e.message); }
        }
        this.audioBuffer = null;

        (this.drumSamplerPads || []).forEach(p => { 
            if (p.audioBuffer && !p.audioBuffer.disposed) {
                try { p.audioBuffer.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing pad audioBuffer:`, e.message); }
            }
            p.audioBuffer = null;
        });

        if (((this.instrumentSamplerSettings) && (this.instrumentSamplerSettings).audioBuffer) && !this.instrumentSamplerSettings.audioBuffer.disposed) { 
            try { this.instrumentSamplerSettings.audioBuffer.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing audioBuffer (InstrumentSampler):`, e.message); }
        }
        if (this.instrumentSamplerSettings) this.instrumentSamplerSettings.audioBuffer = null;

        this.sequences = [];
        this.timelineClips = [];
        this.appServices = {};
        this.inspectorControls = {};
        this.waveformCanvasCtx = null;
        this.instrumentWaveformCanvasCtx = null;

        console.log(`[Track Dispose END ${this.id}] Finished disposal for track: "${trackNameForLog}"`);
    }
}
