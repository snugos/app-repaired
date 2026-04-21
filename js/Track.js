// js/Track.js - Track Class Module

import * as Constants from './constants.js';
import { createEffectInstance, getEffectDefaultParams as getEffectDefaultParamsFromRegistry, AVAILABLE_EFFECTS } from './effectsRegistry.js';
import { storeAudio, getAudio } from './db.js';

// Predefined color palette for tracks
const TRACK_COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#6366f1', // indigo
    '#84cc16', // lime
    '#06b6d4', // cyan
    '#a855f7', // purple
];

function getRandomTrackColor() {
    return TRACK_COLORS[Math.floor(Math.random() * TRACK_COLORS.length)];
}

export class Track {
    constructor(id, type, initialData = null, appServices = {}) {
        this.id = initialData?.id || id;
        this.type = type;
        this.appServices = appServices || {}; // Ensure appServices is at least an empty object

        this.name = initialData?.name || `${type} Track ${this.id}`;
        if (type === 'DrumSampler') {
            this.name = initialData?.name || `Sampler (Pads) ${this.id}`;
        } else if (type === 'Synth') {
            this.name = initialData?.name || `MonoSynth ${this.id}`;
        } else if (type === 'Audio') {
            this.name = initialData?.name || `Audio ${this.id}`;
        }
        console.log(`[Track ${this.id} Constructor] Initializing track "${this.name}" of type "${this.type}". InitialData present: ${!!initialData}`);

        // Track color for visual grouping
        this.color = initialData?.color || getRandomTrackColor();

        this.isMuted = initialData?.isMuted || false;
        this.isMonitoringEnabled = initialData?.isMonitoringEnabled !== undefined ? initialData.isMonitoringEnabled : (this.type === 'Audio'); 

        const currentSoloedId = this.appServices.getSoloedTrackId ? this.appServices.getSoloedTrackId() : null;
        this.isSoloed = currentSoloedId === this.id;
        this.previousVolumeBeforeMute = initialData?.volume ?? 0.7;

        // Synth specific
        if (this.type === 'Synth') {
            this.synthEngineType = initialData?.synthEngineType || 'MonoSynth';
            this.synthParams = initialData?.synthParams ? JSON.parse(JSON.stringify(initialData.synthParams)) : this.getDefaultSynthParams();
        } else {
            this.synthEngineType = null;
            this.synthParams = {};
        }

        // Sampler (Slicer) specific
        this.samplerAudioData = {
            fileName: initialData?.samplerAudioData?.fileName || null,
            audioBufferDataURL: initialData?.samplerAudioData?.audioBufferDataURL || null, 
            dbKey: initialData?.samplerAudioData?.dbKey || null,
            status: initialData?.samplerAudioData?.status || (initialData?.samplerAudioData?.dbKey || initialData?.samplerAudioData?.audioBufferDataURL ? 'missing' : 'empty')
        };
        this.audioBuffer = null; 
        this.slices = initialData?.slices && initialData.slices.length > 0 ?
            JSON.parse(JSON.stringify(initialData.slices)) :
            Array(Constants.numSlices).fill(null).map(() => ({
                offset: 0, duration: 0, userDefined: false, volume: 0.7, pitchShift: 0,
                loop: false, reverse: false,
                envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.2 }
            }));
        this.selectedSliceForEdit = initialData?.selectedSliceForEdit || 0;
        this.waveformZoom = initialData?.waveformZoom || 1;
        this.waveformScrollOffset = initialData?.waveformScrollOffset || 0;
        this.slicerIsPolyphonic = initialData?.slicerIsPolyphonic !== undefined ? initialData.slicerIsPolyphonic : true;
        this.slicerMonoPlayer = null;
        this.slicerMonoEnvelope = null;
        this.slicerMonoGain = null;

        // Instrument Sampler specific
        this.instrumentSamplerSettings = {
            sampleUrl: initialData?.instrumentSamplerSettings?.sampleUrl || null, 
            audioBuffer: null,
            audioBufferDataURL: initialData?.instrumentSamplerSettings?.audioBufferDataURL || null,
            originalFileName: initialData?.instrumentSamplerSettings?.originalFileName || null,
            dbKey: initialData?.instrumentSamplerSettings?.dbKey || null,
            rootNote: initialData?.instrumentSamplerSettings?.rootNote || 'C4',
            loop: initialData?.instrumentSamplerSettings?.loop || false,
            loopStart: initialData?.instrumentSamplerSettings?.loopStart || 0,
            loopEnd: initialData?.instrumentSamplerSettings?.loopEnd || 0,
            envelope: initialData?.instrumentSamplerSettings?.envelope ? JSON.parse(JSON.stringify(initialData.instrumentSamplerSettings.envelope)) : { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 },
            status: initialData?.instrumentSamplerSettings?.status || (initialData?.instrumentSamplerSettings?.dbKey || initialData?.instrumentSamplerSettings?.audioBufferDataURL ? 'missing' : 'empty')
        };
        this.instrumentSamplerIsPolyphonic = initialData?.instrumentSamplerIsPolyphonic !== undefined ? initialData.instrumentSamplerIsPolyphonic : true;
        this.toneSampler = null;

        // Drum Sampler specific
        this.drumSamplerPads = Array(Constants.numDrumSamplerPads).fill(null).map((_, padIdx) => {
            const initialPadData = initialData?.drumSamplerPads?.[padIdx];
            return {
                sampleUrl: initialPadData?.sampleUrl || null, 
                audioBuffer: null,
                audioBufferDataURL: initialPadData?.audioBufferDataURL || null,
                originalFileName: initialPadData?.originalFileName || null,
                dbKey: initialPadData?.dbKey || null,
                volume: initialPadData?.volume ?? 0.7,
                pitchShift: initialPadData?.pitchShift ?? 0,
                envelope: initialPadData?.envelope ? JSON.parse(JSON.stringify(initialPadData.envelope)) : { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 },
                status: initialPadData?.status || (initialPadData?.dbKey || initialPadData?.audioBufferDataURL ? 'missing' : 'empty')
            };
        });
        this.selectedDrumPadForEdit = initialData?.selectedDrumPadForEdit || 0;
        this.drumPadPlayers = Array(Constants.numDrumSamplerPads).fill(null);

        // Effects
        this.activeEffects = [];
        if (initialData && initialData.activeEffects && Array.isArray(initialData.activeEffects)) {
            initialData.activeEffects.forEach(effectData => {
                if (!effectData || !effectData.type) {
                    console.warn(`[Track ${this.id} Constructor] Skipping invalid effectData:`, effectData);
                    return;
                }
                const getDefaults = this.appServices.effectsRegistryAccess?.getEffectDefaultParams || getEffectDefaultParamsFromRegistry;
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
        this.panNode = null; // Stereo panner
        this.pan = initialData?.pan !== undefined ? initialData.pan : 0; // -1 (left) to 1 (right)
        
        // --- Send Levels ---
        // Stores send levels for each bus: { 'reverb': 0, 'delay': 0 }
        this.sendLevels = initialData?.sendLevels || { reverb: 0, delay: 0 };
        this.sendGainNodes = {}; // Tone.Gain nodes for each send bus
        
        // --- Delay Compensation ---
        // Manual delay compensation for latency-inducing effects
        this.delayCompensationMs = initialData?.delayCompensationMs || 0; // Manual offset in ms
        this.delayCompensationNode = null; // Tone.Delay node for compensation
        this.autoDelayCompensation = initialData?.autoDelayCompensation !== undefined ? initialData.autoDelayCompensation : true; // Auto-calculate from effects

        // --- Sidechain ---
        this.sidechainSource = initialData?.sidechainSource || null; // Track ID that this track triggers
        this.sidechainDestination = initialData?.sidechainDestination || null; // Track ID that ducks this track
        
        this.instrument = null; 

        this.sequences = [];
        this.activeSequenceId = null;
        this.groovePreset = initialData?.groovePreset || 'none';
        this.timelineClips = initialData?.timelineClips ? JSON.parse(JSON.stringify(initialData.timelineClips)) : [];


        if (this.type !== 'Audio') {
            if (initialData?.sequences && initialData.sequences.length > 0) {
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

            if (initialData?.audioClips && Array.isArray(initialData.audioClips)) {
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
                            name: ac.name || `Rec Clip ${this.timelineClips.filter(c => c.type === 'audio').length + 1}`,
                            fadeIn: ac.fadeIn ?? 0,
                            fadeOut: ac.fadeOut ?? 0
                        });
                    }
                });
           }
        }
        this.patternPlayerSequence = null; 

        // UI related
        this.waveformCanvasCtx = null;
        this.instrumentWaveformCanvasCtx = null;
        this.automation = initialData?.automation ? JSON.parse(JSON.stringify(initialData.automation)) : { volume: [] };
        this.inspectorControls = {};

        // Audio Track specific
        this.inputChannel = null;
        this.clipPlayers = new Map(); 
        
        // --- Freeze State ---
        this.frozen = initialData?.frozen || false;
        this.frozenAudioBlob = null; // Stores the frozen audio
        this.frozenAudioDbKey = initialData?.frozenAudioDbKey || null; // DB key for frozen audio
        this.frozenPlayer = null; // Tone.Player for playing frozen audio
        this.frozenDuration = initialData?.frozenDuration || 0; // Duration of frozen audio
        this.timelinePlaybackRate = initialData?.timelinePlaybackRate || 1.0; // Playback rate for timeline clips (1.0 = normal)
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
                if (this.appServices.loadAudioBufferSource) {
                    audioData = await this.appServices.loadAudioBufferSource(sampleSource);
                }
            }

            if (audioData) {
                // 2. Save to IndexedDB so the sample persists on reload
                const dbKey = `track_${this.id}_pad_${padIndex}`;
                await storeAudio(dbKey, audioData);

                // 3. Create a Tone.js Buffer for immediate playback
                const buffer = new Tone.ToneAudioBuffer();
                await buffer.fromArrayBuffer(audioData);

                // 4. Update the specific pad in this track
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

    // --- Groove Template ---
    setGroovePreset(grooveId) {
        this.groovePreset = grooveId || 'none';
        console.log(`[Track ${this.id}] Groove preset set to: ${this.groovePreset}`);
    }

    getGroovePreset() {
        return this.groovePreset || 'none';
    }
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
            if (this.panNode && !this.panNode.disposed) try { this.panNode.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old panNode:`, e.message)}
            if (this.delayCompensationNode && !this.delayCompensationNode.disposed) try { this.delayCompensationNode.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old delayCompensationNode:`, e.message)}
            if (this.trackMeter && !this.trackMeter.disposed) try { this.trackMeter.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old trackMeter:`, e.message)}
            if (this.inputChannel && !this.inputChannel.disposed && this.type === 'Audio') {
                try { this.inputChannel.dispose(); } catch(e) {console.warn(`[Track ${this.id}] Error disposing old inputChannel:`, e.message)}
            }

            if (!this.appServices.getMasterEffectsBusInputNode) {
                 console.error(`[Track ${this.id} initializeAudioNodes] CRITICAL: getMasterEffectsBusInputNode service not available.`);
                 return;
            }

            this.gainNode = new Tone.Gain(this.isMuted ? 0 : this.previousVolumeBeforeMute);
            this.panNode = new Tone.Panner(this.pan); // Stereo panner
            this.delayCompensationNode = new Tone.Delay(this.delayCompensationMs / 1000); // Delay node for compensation
            this.trackMeter = new Tone.Meter({ smoothing: 0.8 });
            this.outputNode = this.panNode; // Output is now through panNode

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
            try { node.disconnect(); } catch(e) { console.warn(`[Track ${this.id} rebuildEffectChain] Error during disconnect of node:`, node?.toString(), e.message); }
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

        // Signal chain: gainNode -> panNode -> delayCompensationNode -> trackMeter
        if (this.gainNode && !this.gainNode.disposed) {
            if (this.panNode && !this.panNode.disposed) {
                try { 
                    this.gainNode.connect(this.panNode); 
                    // Connect panNode to delayCompensationNode, then to trackMeter
                    if (this.delayCompensationNode && !this.delayCompensationNode.disposed) {
                        this.panNode.connect(this.delayCompensationNode);
                        this.delayCompensationNode.connect(this.trackMeter);
                        console.log(`[Track ${this.id} rebuildEffectChain] Connected gainNode -> panNode -> delayCompensationNode -> trackMeter.`); 
                    } else {
                        // Fallback if delay node not available
                        this.panNode.connect(this.trackMeter);
                        console.log(`[Track ${this.id} rebuildEffectChain] Connected gainNode -> panNode -> trackMeter (no delay node).`); 
                    }
                } catch (e) { console.error(`[Track ${this.id}] Error connecting gainNode->panNode->delayCompensationNode->trackMeter:`, e); }
            } else {
                // Fallback without panNode
                if (this.delayCompensationNode && !this.delayCompensationNode.disposed) {
                    try { 
                        this.gainNode.connect(this.delayCompensationNode); 
                        this.delayCompensationNode.connect(this.trackMeter);
                        console.log(`[Track ${this.id} rebuildEffectChain] Connected gainNode -> delayCompensationNode -> trackMeter.`); 
                    } catch (e) { console.error(`[Track ${this.id}] Error connecting gainNode->delayCompensationNode->trackMeter:`, e); }
                } else {
                    try { this.gainNode.connect(this.trackMeter); console.log(`[Track ${this.id} rebuildEffectChain] Connected gainNode to trackMeter.`); }
                    catch (e) { console.error(`[Track ${this.id}] Error connecting gainNode to trackMeter:`, e); }
                }
            }
        }

        const masterBusInput = this.appServices.getMasterEffectsBusInputNode ? this.appServices.getMasterEffectsBusInputNode() : null;
        const finalTrackOutput = (this.trackMeter && !this.trackMeter.disposed) ? this.trackMeter : (this.delayCompensationNode && !this.delayCompensationNode.disposed ? this.delayCompensationNode : (this.panNode && !this.panNode.disposed ? this.panNode : this.gainNode));

        if (finalTrackOutput && !finalTrackOutput.disposed && masterBusInput && !masterBusInput.disposed) {
            try { finalTrackOutput.connect(masterBusInput); console.log(`[Track ${this.id} rebuildEffectChain] Connected final track output to masterBusInput.`); }
            catch (e) { console.error(`[Track ${this.id}] Error connecting final output to masterBusInput:`, e); }
        } else if (finalTrackOutput && !finalTrackOutput.disposed) {
            console.warn(`[Track ${this.id} rebuildEffectChain] Master effects bus input not available. Connecting directly to destination as fallback.`);
            try { finalTrackOutput.toDestination(); } catch (e) { console.error(`[Track ${this.id}] Error connecting final output to destination:`, e); }
        } else {
            console.error(`[Track ${this.id} rebuildEffectChain] CRITICAL: Final track output node is invalid or master bus is unavailable. No output connection made.`);
        }

        // Connect send buses
        const sendBusIds = this.appServices.getAvailableSendBuses ? this.appServices.getAvailableSendBuses() : ['reverb', 'delay'];
        sendBusIds.forEach(busId => {
            if (this.sendLevels[busId] && this.sendLevels[busId] > 0) {
                this.connectToSendBus(busId);
            }
        });

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

    toggleEffectBypass(effectId) {
        const effectWrapper = this.activeEffects.find(e => e.id === effectId);
        if (!effectWrapper) {
            console.warn(`[Track ${this.id}] Effect ID ${effectId} not found for bypass toggle.`);
            return;
        }

        if (!effectWrapper.toneNode || effectWrapper.toneNode.disposed) {
            console.warn(`[Track ${this.id}] ToneNode for effect ${effectId} is invalid or disposed.`);
            return;
        }

        // Check if currently bypassed (wet === 0 or bypassed flag is true)
        const isBypassed = effectWrapper.bypassed === true || (effectWrapper.params?.wet !== undefined && effectWrapper.params.wet === 0);

        if (isBypassed) {
            // Restore wet to previous value (or 1 if not stored)
            const restoreValue = effectWrapper.previousWetValue !== undefined ? effectWrapper.previousWetValue : 1;
            effectWrapper.bypassed = false;
            if (effectWrapper.params) effectWrapper.params.wet = restoreValue;
            delete effectWrapper.previousWetValue;

            // Apply to Tone.js node
            if (effectWrapper.toneNode.wet && typeof effectWrapper.toneNode.wet.rampTo === 'function') {
                effectWrapper.toneNode.wet.rampTo(restoreValue, 0.02);
            } else if (effectWrapper.toneNode.wet && typeof effectWrapper.toneNode.wet.value !== 'undefined') {
                effectWrapper.toneNode.wet.value = restoreValue;
            }

            console.log(`[Track ${this.id}] Effect "${effectWrapper.type}" (${effectId}) enabled. Wet: ${restoreValue}`);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Effect "${effectWrapper.type}" enabled`, 1500);
            }
        } else {
            // Store current wet value and bypass
            const currentWet = effectWrapper.params?.wet ?? 1;
            effectWrapper.previousWetValue = currentWet;
            effectWrapper.bypassed = true;
            if (effectWrapper.params) effectWrapper.params.wet = 0;

            // Apply to Tone.js node
            if (effectWrapper.toneNode.wet && typeof effectWrapper.toneNode.wet.rampTo === 'function') {
                effectWrapper.toneNode.wet.rampTo(0, 0.02);
            } else if (effectWrapper.toneNode.wet && typeof effectWrapper.toneNode.wet.value !== 'undefined') {
                effectWrapper.toneNode.wet.value = 0;
            }

            console.log(`[Track ${this.id}] Effect "${effectWrapper.type}" (${effectId}) bypassed.`);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Effect "${effectWrapper.type}" bypassed`, 1500);
            }
        }

        // Update UI
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
                                 console.warn(`[Track ${this.id} Audio] Audio data for clip ${clip.id} (source ${clip.sourceId}) not found in DB.`);
                                 if (this.appServices.showNotification) this.appServices.showNotification(`Audio for clip "${clip.name}" is missing.`, 3000);
                             }
                         } catch (err) {
                             console.error(`[Track ${this.id} Audio] Error loading/scheduling audio clip ${clip.id}:`, err);
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

    /**
     * Set the stereo pan position for this track.
     * @param {number} pan - Pan value from -1 (full left) to 1 (full right), 0 = center
     * @param {boolean} fromInteraction - Whether this is from a user interaction
     */
    setPan(pan, fromInteraction = false) {
        // Clamp pan value to valid range
        this.pan = Math.max(-1, Math.min(1, parseFloat(pan) || 0));
        
        if (this.panNode && !this.panNode.disposed) {
            try {
                this.panNode.pan.setValueAtTime(this.pan, Tone.now());
                console.log(`[Track ${this.id}] Set pan to ${this.pan.toFixed(2)}`);
            } catch (e) { 
                console.error(`[Track ${this.id}] Error setting panNode:`, e); 
            }
        }
        
        // Capture undo state if from user interaction
        if (fromInteraction && this.appServices.captureStateForUndo) {
            const panDisplay = this.pan === 0 ? 'Center' : (this.pan < 0 ? `Left ${Math.abs(this.pan * 100).toFixed(0)}%` : `Right ${(this.pan * 100).toFixed(0)}%`);
            this.appServices.captureStateForUndo(`Set ${this.name} pan to ${panDisplay}`);
        }
    }

    /**
     * Set the track color for visual grouping.
     * @param {string} color - Hex color string (e.g., '#ef4444')
     * @param {boolean} fromInteraction - Whether this is from a user interaction
     */
    setColor(color, fromInteraction = false) {
        // Validate color format
        const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(color);
        if (!isValidHex) {
            console.warn(`[Track ${this.id}] Invalid color format: ${color}. Using default.`);
            color = '#3b82f6'; // Default blue
        }
        
        this.color = color;
        console.log(`[Track ${this.id}] Set color to ${color}`);
        
        // Capture undo state if from user interaction
        if (fromInteraction && this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Set ${this.name} color`);
        }
        
        // Update UI if available
        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'colorChanged');
        }
    }

    // --- Send Level Methods ---
    /**
     * Set the send level for a specific bus.
     * @param {string} busId - The bus ID ('reverb' or 'delay')
     * @param {number} level - Send level (0-1)
     * @param {boolean} fromInteraction - Whether this is from a user interaction
     */
    setSendLevel(busId, level, fromInteraction = false) {
        // Clamp level
        level = Math.max(0, Math.min(1, parseFloat(level) || 0));
        
        // Store the level
        this.sendLevels[busId] = level;
        
        // Update the gain node if it exists
        if (this.sendGainNodes[busId] && !this.sendGainNodes[busId].disposed) {
            this.sendGainNodes[busId].gain.value = level;
        }
        
        // Also update in audio module
        if (this.appServices.setTrackSendLevel) {
            this.appServices.setTrackSendLevel(this.id, busId, level);
        }
        
        console.log(`[Track ${this.id}] Set ${busId} send level to ${level.toFixed(2)}`);
        
        // Capture undo state if from user interaction
        if (fromInteraction && this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Set ${this.name} ${busId} send to ${(level * 100).toFixed(0)}%`);
        }
    }

    /**
     * Get the send level for a specific bus.
     * @param {string} busId - The bus ID
     * @returns {number} Send level (0-1)
     */
    getSendLevel(busId) {
        return this.sendLevels[busId] || 0;
    }

    /**
     * Connect track output to a send bus.
     * @param {string} busId - The bus ID
     */
    connectToSendBus(busId) {
        if (!this.trackMeter || this.trackMeter.disposed) return;
        
        const busInput = this.appServices.getSendBusInputNode ? this.appServices.getSendBusInputNode(busId) : null;
        if (!busInput) {
            console.warn(`[Track ${this.id}] Send bus ${busId} input not available.`);
            return;
        }
        
        // Create gain node for this send if not exists
        if (!this.sendGainNodes[busId] || this.sendGainNodes[busId].disposed) {
            this.sendGainNodes[busId] = new Tone.Gain(this.sendLevels[busId] || 0);
        }
        
        // Connect: trackMeter -> sendGainNode -> busInput
        try {
            this.trackMeter.connect(this.sendGainNodes[busId]);
            this.sendGainNodes[busId].connect(busInput);
            console.log(`[Track ${this.id}] Connected to send bus ${busId}`);
        } catch (e) {
            console.error(`[Track ${this.id}] Error connecting to send bus ${busId}:`, e);
        }
    }

    /**
     * Disconnect from a send bus.
     * @param {string} busId - The bus ID
     */
    disconnectFromSendBus(busId) {
        if (this.sendGainNodes[busId] && !this.sendGainNodes[busId].disposed) {
            try {
                this.sendGainNodes[busId].disconnect();
                if (this.trackMeter && !this.trackMeter.disposed) {
                    this.trackMeter.disconnect(this.sendGainNodes[busId]);
                }
                console.log(`[Track ${this.id}] Disconnected from send bus ${busId}`);
            } catch (e) {
                console.error(`[Track ${this.id}] Error disconnecting from send bus ${busId}:`, e);
            }
        }
    }

    // --- Sidechain Methods ---
    /**
     * Set this track as a sidechain source.
     * @param {number} destinationTrackId - The track ID that will be ducked
     * @param {boolean} fromInteraction - Whether this is from a user interaction
     */
    setSidechainDestination(destinationTrackId, fromInteraction = false) {
        // Clear existing destination if different
        if (this.sidechainSource && this.sidechainSource !== destinationTrackId) {
            this.clearSidechainRouting();
        }
        
        this.sidechainSource = destinationTrackId;
        
        // Setup routing in audio module
        if (this.appServices.setupSidechainRouting) {
            this.appServices.setupSidechainRouting(this.id, destinationTrackId);
        }
        
        console.log(`[Track ${this.id}] Set sidechain destination to track ${destinationTrackId}`);
        
        if (fromInteraction && this.appServices.captureStateForUndo) {
            const destTrack = this.appServices.getTrackById ? this.appServices.getTrackById(destinationTrackId) : null;
            this.appServices.captureStateForUndo(`Route ${this.name} sidechain to ${destTrack?.name || 'Track ' + destinationTrackId}`);
        }
    }

    /**
     * Set this track to be ducked by a source track.
     * @param {number} sourceTrackId - The track ID that will trigger ducking
     * @param {boolean} fromInteraction - Whether this is from a user interaction
     */
    setSidechainSource(sourceTrackId, fromInteraction = false) {
        this.sidechainDestination = sourceTrackId;
        
        // Setup routing in audio module
        if (this.appServices.setupSidechainRouting) {
            this.appServices.setupSidechainRouting(sourceTrackId, this.id);
        }
        
        console.log(`[Track ${this.id}] Set sidechain source to track ${sourceTrackId}`);
        
        if (fromInteraction && this.appServices.captureStateForUndo) {
            const srcTrack = this.appServices.getTrackById ? this.appServices.getTrackById(sourceTrackId) : null;
            this.appServices.captureStateForUndo(`Set ${srcTrack?.name || 'Track ' + sourceTrackId} to duck ${this.name}`);
        }
    }

    /**
     * Clear all sidechain routing for this track.
     */
    clearSidechainRouting() {
        // Clear as source
        if (this.sidechainSource) {
            if (this.appServices.removeSidechainRouting) {
                this.appServices.removeSidechainRouting(this.id, this.sidechainSource);
            }
            this.sidechainSource = null;
        }
        
        // Clear as destination
        if (this.sidechainDestination) {
            if (this.appServices.removeSidechainRouting) {
                this.appServices.removeSidechainRouting(this.sidechainDestination, this.id);
            }
            this.sidechainDestination = null;
        }
        
        console.log(`[Track ${this.id}] Cleared sidechain routing`);
    }

    /**
     * Get sidechain info for this track.
     * @returns {Object} { isSource, isDestination, sources, destinations }
     */
    getSidechainInfo() {
        if (this.appServices.getTrackSidechainInfo) {
            return this.appServices.getTrackSidechainInfo(this.id);
        }
        return {
            isSource: !!this.sidechainSource,
            isDestination: !!this.sidechainDestination,
            sources: this.sidechainDestination ? [this.sidechainDestination] : [],
            destinations: this.sidechainSource ? [this.sidechainSource] : []
        };
    }

    // --- Effect Presets ---
    /**
     * Save the current effect chain as a preset.
     * @param {string} presetName - Name for the preset
     * @returns {Object} The saved preset object
     */
    saveEffectPreset(presetName) {
        if (!presetName || typeof presetName !== 'string') {
            console.warn(`[Track ${this.id}] Invalid preset name.`);
            return null;
        }
        
        const preset = {
            name: presetName,
            trackId: this.id,
            trackType: this.type,
            effects: this.activeEffects.map(e => ({
                type: e.type,
                params: JSON.parse(JSON.stringify(e.params || {}))
            })),
            createdAt: Date.now()
        };
        
        // Store in localStorage under a unique key
        const presetKey = `snugos_effect_preset_${this.id}_${presetName.replace(/\s+/g, '_')}`;
        try {
            localStorage.setItem(presetKey, JSON.stringify(preset));
            console.log(`[Track ${this.id}] Saved effect preset "${presetName}"`);
            
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Saved effect preset "${presetName}"`, 2000);
            }
            
            return preset;
        } catch (e) {
            console.error(`[Track ${this.id}] Error saving effect preset:`, e);
            return null;
        }
    }

    /**
     * Load an effect preset by name.
     * @param {string} presetName - Name of the preset to load
     * @returns {boolean} Success status
     */
    loadEffectPreset(presetName) {
        if (!presetName || typeof presetName !== 'string') {
            console.warn(`[Track ${this.id}] Invalid preset name.`);
            return false;
        }
        
        const presetKey = `snugos_effect_preset_${this.id}_${presetName.replace(/\s+/g, '_')}`;
        try {
            const presetJson = localStorage.getItem(presetKey);
            if (!presetJson) {
                console.warn(`[Track ${this.id}] Preset "${presetName}" not found.`);
                return false;
            }
            
            const preset = JSON.parse(presetJson);
            
            // Capture undo state before modifying
            if (this.appServices.captureStateForUndo) {
                this.appServices.captureStateForUndo(`Load effect preset "${presetName}"`);
            }
            
            // Remove existing effects
            this.activeEffects.forEach(effect => {
                if (effect.toneNode && !effect.toneNode.disposed) {
                    try { effect.toneNode.dispose(); } catch(e) {}
                }
            });
            this.activeEffects = [];
            
            // Add effects from preset
            preset.effects.forEach(effectData => {
                const toneNode = createEffectInstance(effectData.type, effectData.params);
                if (toneNode) {
                    this.activeEffects.push({
                        id: `effect-${this.id}-${effectData.type}-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                        type: effectData.type,
                        toneNode: toneNode,
                        params: JSON.parse(JSON.stringify(effectData.params))
                    });
                }
            });
            
            // Rebuild the effect chain
            this.rebuildEffectChain();
            
            console.log(`[Track ${this.id}] Loaded effect preset "${presetName}"`);
            
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Loaded effect preset "${presetName}"`, 2000);
            }
            
            // Update UI
            if (this.appServices.updateTrackUI) {
                this.appServices.updateTrackUI(this.id, 'effectsChanged');
            }
            
            return true;
        } catch (e) {
            console.error(`[Track ${this.id}] Error loading effect preset:`, e);
            return false;
        }
    }

    /**
     * Get all available effect presets for this track.
     * @returns {Array} Array of preset objects with name and createdAt
     */
    getAvailableEffectPresets() {
        const presets = [];
        const prefix = `snugos_effect_preset_${this.id}_`;
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    try {
                        const presetJson = localStorage.getItem(key);
                        if (presetJson) {
                            const preset = JSON.parse(presetJson);
                            presets.push({
                                name: preset.name,
                                createdAt: preset.createdAt,
                                effectsCount: preset.effects ? preset.effects.length : 0
                            });
                        }
                    } catch (e) {
                        console.warn(`[Track ${this.id}] Error parsing preset ${key}:`, e);
                    }
                }
            }
        } catch (e) {
            console.error(`[Track ${this.id}] Error getting presets:`, e);
        }
        
        // Sort by creation date, newest first
        presets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        return presets;
    }

    /**
     * Delete an effect preset by name.
     * @param {string} presetName - Name of the preset to delete
     * @returns {boolean} Success status
     */
    deleteEffectPreset(presetName) {
        if (!presetName || typeof presetName !== 'string') {
            return false;
        }
        
        const presetKey = `snugos_effect_preset_${this.id}_${presetName.replace(/\s+/g, '_')}`;
        try {
            localStorage.removeItem(presetKey);
            console.log(`[Track ${this.id}] Deleted effect preset "${presetName}"`);
            return true;
        } catch (e) {
            console.error(`[Track ${this.id}] Error deleting effect preset:`, e);
            return false;
        }
    }

    // --- Quantize Functions ---
    /**
     * Quantize the active sequence to a grid resolution.
     * @param {string} resolution - Grid resolution ('1/4', '1/8', '1/16', '1/32')
     * @param {number} strength - Quantization strength 0-1 (1 = full snap)
     * @returns {number} Number of notes quantized
     */
    quantizeSequence(resolution = '1/16', strength = 1) {
        if (this.type === 'Audio') {
            console.warn(`[Track ${this.id}] Cannot quantize audio track.`);
            return 0;
        }

        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data || activeSeq.length === 0) {
            console.log(`[Track ${this.id}] No active sequence to quantize.`);
            return 0;
        }

        // Calculate grid size based on resolution
        const resolutionMap = {
            '1/4': 4,
            '1/8': 8,
            '1/16': 16,
            '1/32': 32
        };
        
        const gridSize = resolutionMap[resolution] || 16;
        const stepsPerBeat = gridSize;
        const stepSize = 1; // Each step in the grid

        let quantizedCount = 0;
        const originalData = JSON.parse(JSON.stringify(activeSeq.data));

        // Capture undo state before modifying
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Quantize ${this.name} to ${resolution}`);
        }

        // Quantize each note
        for (let row = 0; row < activeSeq.data.length; row++) {
            for (let col = 0; col < activeSeq.data[row].length; col++) {
                const note = activeSeq.data[row][col];
                if (note !== null && note !== undefined) {
                    // Find nearest grid position
                    const originalPosition = col;
                    const gridPosition = Math.round(originalPosition / stepSize) * stepSize;
                    const clampedPosition = Math.max(0, Math.min(gridPosition, activeSeq.data[row].length - 1));

                    if (strength < 1) {
                        // Partial quantization
                        const interpolatedPosition = Math.round(originalPosition + (clampedPosition - originalPosition) * strength);
                        const finalPosition = Math.max(0, Math.min(interpolatedPosition, activeSeq.data[row].length - 1));
                        
                        if (finalPosition !== col) {
                            activeSeq.data[row][finalPosition] = note;
                            activeSeq.data[row][col] = null;
                            quantizedCount++;
                        }
                    } else {
                        // Full quantization
                        if (clampedPosition !== col) {
                            // Check if target position is free
                            if (activeSeq.data[row][clampedPosition] === null) {
                                activeSeq.data[row][clampedPosition] = note;
                                activeSeq.data[row][col] = null;
                                quantizedCount++;
                            }
                        }
                    }
                }
            }
        }

        console.log(`[Track ${this.id}] Quantized ${quantizedCount} notes to ${resolution} grid.`);
        
        // Recreate Tone sequence for playback
        this.recreateToneSequence(true);

        // Update UI
        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'sequenceChanged');
        }

        if (this.appServices.showNotification && quantizedCount > 0) {
            this.appServices.showNotification(`Quantized ${quantizedCount} notes to ${resolution}`, 2000);
        }

        return quantizedCount;
    }

    /**
     * Quantize selected notes in the active sequence.
     * @param {Array} selectedPositions - Array of {row, col} positions to quantize
     * @param {string} resolution - Grid resolution
     * @param {number} strength - Quantization strength 0-1
     * @returns {number} Number of notes quantized
     */
    quantizeSelectedNotes(selectedPositions, resolution = '1/16', strength = 1) {
        if (this.type === 'Audio' || !selectedPositions || selectedPositions.length === 0) {
            return 0;
        }

        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data) return 0;

        // Calculate grid size based on resolution
        const resolutionMap = {
            '1/4': 4,
            '1/8': 8,
            '1/16': 16,
            '1/32': 32
        };
        
        const gridSize = resolutionMap[resolution] || 16;
        const stepSize = 1;

        let quantizedCount = 0;

        // Capture undo state
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Quantize ${selectedPositions.length} selected notes`);
        }

        selectedPositions.forEach(pos => {
            const { row, col } = pos;
            if (row < 0 || row >= activeSeq.data.length || col < 0 || col >= activeSeq.data[row].length) return;
            
            const note = activeSeq.data[row][col];
            if (note === null || note === undefined) return;

            const originalPosition = col;
            const gridPosition = Math.round(originalPosition / stepSize) * stepSize;
            const clampedPosition = Math.max(0, Math.min(gridPosition, activeSeq.data[row].length - 1));

            if (clampedPosition !== col) {
                if (activeSeq.data[row][clampedPosition] === null) {
                    activeSeq.data[row][clampedPosition] = note;
                    activeSeq.data[row][col] = null;
                    quantizedCount++;
                }
            }
        });

        console.log(`[Track ${this.id}] Quantized ${quantizedCount} selected notes.`);

        this.recreateToneSequence(true);

        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'sequenceChanged');
        }

        return quantizedCount;
    }

    /**
     * Quantize an audio clip's position to the nearest grid division.
     * Snaps both start and end times to the grid.
     * @param {string} clipId - The clip ID to quantize
     * @param {string} resolution - Grid resolution ('1/4', '1/8', '1/16', '1/32')
     * @returns {Object|null} Object with newStartTime and newDuration, or null if not found
     */
    quantizeAudioClip(clipId, resolution = '1/16') {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] quantizeAudioClip only works on Audio tracks.`);
            return null;
        }

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found.`);
            return null;
        }

        // Get BPM for grid calculation
        const bpm = this.appServices?.getBPM ? this.appServices.getBPM() : 120;
        const secondsPerBeat = 60 / bpm;

        // Calculate grid size in seconds based on resolution
        const resolutionMap = {
            '1/4': 4,    // quarter note = 1 beat
            '1/8': 8,    // eighth note = 0.5 beat
            '1/16': 16,  // sixteenth note = 0.25 beat
            '1/32': 32   // thirty-second note = 0.125 beat
        };
        
        const gridDivisions = resolutionMap[resolution] || 16;
        const gridSeconds = secondsPerBeat * (4 / gridDivisions); // seconds per grid division

        const originalStartTime = clip.startTime;
        const originalDuration = clip.duration;
        const originalEndTime = originalStartTime + originalDuration;

        // Snap start time to nearest grid
        const snappedStartTime = Math.round(originalStartTime / gridSeconds) * gridSeconds;
        
        // Snap end time to nearest grid
        const snappedEndTime = Math.round(originalEndTime / gridSeconds) * gridSeconds;
        
        // Calculate new duration (ensure minimum of one grid division)
        const newDuration = Math.max(gridSeconds, snappedEndTime - snappedStartTime);

        // Check if anything changed
        if (snappedStartTime === originalStartTime && newDuration === originalDuration) {
            console.log(`[Track ${this.id}] Clip "${clip.name}" already on ${resolution} grid.`);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Clip already aligned to ${resolution} grid`, 1500);
            }
            return { startTime: snappedStartTime, duration: newDuration };
        }

        // Capture undo state before modifying
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Quantize clip "${clip.name}" to ${resolution}`);
        }

        // Apply quantization
        clip.startTime = snappedStartTime;
        clip.duration = newDuration;

        console.log(`[Track ${this.id}] Quantized clip "${clip.name}" to ${resolution} grid. Start: ${originalStartTime.toFixed(2)}s → ${snappedStartTime.toFixed(3)}s, Duration: ${originalDuration.toFixed(3)}s → ${newDuration.toFixed(3)}s`);

        // Update timeline UI
        if (this.appServices.renderTimeline) {
            this.appServices.renderTimeline();
        }

        if (this.appServices.showNotification) {
            this.appServices.showNotification(`Quantized clip to ${resolution} grid`, 1500);
        }

        return { startTime: snappedStartTime, duration: newDuration };
    }

    /**
     * Snap an audio clip's start time only to the nearest grid division (keeps duration intact).
     * @param {string} clipId - The clip ID to snap
     * @param {string} resolution - Grid resolution ('1/4', '1/8', '1/16', '1/32')
     * @returns {number|null} New start time, or null if not found
     */
    snapAudioClipStart(clipId, resolution = '1/16') {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] snapAudioClipStart only works on Audio tracks.`);
            return null;
        }

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found.`);
            return null;
        }

        // Get BPM for grid calculation
        const bpm = this.appServices?.getBPM ? this.appServices.getBPM() : 120;
        const secondsPerBeat = 60 / bpm;

        // Calculate grid size in seconds based on resolution
        const resolutionMap = {
            '1/4': 4,
            '1/8': 8,
            '1/16': 16,
            '1/32': 32
        };
        
        const gridDivisions = resolutionMap[resolution] || 16;
        const gridSeconds = secondsPerBeat * (4 / gridDivisions);

        const originalStartTime = clip.startTime;
        const snappedStartTime = Math.round(originalStartTime / gridSeconds) * gridSeconds;

        if (snappedStartTime === originalStartTime) {
            console.log(`[Track ${this.id}] Clip "${clip.name}" start already on ${resolution} grid.`);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Clip start already aligned`, 1500);
            }
            return snappedStartTime;
        }

        // Capture undo state before modifying
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Snap clip "${clip.name}" start to ${resolution}`);
        }

        clip.startTime = snappedStartTime;

        console.log(`[Track ${this.id}] Snapped clip "${clip.name}" start to ${resolution} grid. ${originalStartTime.toFixed(3)}s → ${snappedStartTime.toFixed(3)}s`);

        // Update timeline UI
        if (this.appServices.renderTimeline) {
            this.appServices.renderTimeline();
        }

        if (this.appServices.showNotification) {
            this.appServices.showNotification(`Snapped clip start to ${resolution}`, 1500);
        }

        return snappedStartTime;
    }

    /**
     * Shift all notes in the active sequence up or down by semitones.
     * @param {number} semitones - Number of semitones to shift (positive = up, negative = down)
     * @returns {number} Number of notes shifted
     */
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
            const newRow = [];
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
        this._captureUndoState(`Shift Notes ${semitones > 0 ? 'Down' : 'Up'} on ${activeSeq.name}`);
        return shiftedCount;
    }

    /**
     * Humanize the velocity of notes in the active sequence by adding random variation.
     * @param {number} amount - Amount of randomization (0 to 1)
     * @returns {number} Number of notes humanized
     */
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

    /**
     * Copy a section of the sequence for later pasting.
     * @param {number} startCol - Start column (step)
     * @param {number} endCol - End column (step)
     * @returns {Array|null} Section data or null if invalid
     */
    copySequenceSection(startCol, endCol) {
        if (this.type === 'Audio') return null;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data) {
            console.warn(`[Track ${this.id} copySequenceSection] No active sequence found.`);
            return null;
        }

        let sectionData = [];
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

    /**
     * Paste a previously copied section into the sequence.
     * @param {Array} sectionData - Section data from copySequenceSection
     * @param {number} targetCol - Target column to paste at
     * @param {boolean} skipUndo - Skip undo capture (default false)
     * @returns {number} Number of notes pasted
     */
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

        if (!skipUndo) {
            this._captureUndoState(`Paste section at col ${targetCol} on ${this.name}`);
        }

        return pastedCount;
    }

    async renderTrackToBuffer(transportStartTime, transportStopTime) {
        const duration = transportStopTime - transportStartTime;
        if (duration <= 0) return null;

        console.log(`[Track ${this.id} "${this.name}"] renderTrackToBuffer. Duration: ${duration.toFixed(2)}s`);

        try {
            const offlineContext = await Tone.Offline(async () => {
                this.stopPlayback();

                if (this.type === 'timeline') {
                    for (const clip of this.timelineClips) {
                        if (!clip || typeof clip.startTime !== 'number' || typeof clip.duration !== 'number') continue;
                        const clipActualStart = clip.startTime;
                        const clipActualEnd = clip.startTime + clip.duration;
                        const effectivePlayStart = Math.max(clipActualStart, transportStartTime);
                        const effectivePlayEnd = Math.min(clipActualEnd, transportStopTime);
                        let playDurationInWindow = effectivePlayEnd - effectivePlayStart;
                        if (playDurationInWindow <= 1e-3) continue;
                        const offsetIntoSource = Math.max(0, effectivePlayStart - clipActualStart);

                        if (clip.type === 'audio') {
                            if (!clip.sourceId) continue;
                            const audioBlob = await getAudio(clip.sourceId);
                            if (!audioBlob) continue;
                            const url = URL.createObjectURL(audioBlob);
                            const player = new Tone.Player(url);
                            this.clipPlayers.set(clip.id, player);
                            player.onload = () => {
                                URL.revokeObjectURL(url);
                                const destNode = (this.activeEffects.length > 0 && this.activeEffects[0].toneNode && !this.activeEffects[0].toneNode.disposed)
                                    ? this.activeEffects[0].toneNode
                                    : (this.gainNode || null);
                                if (destNode) player.connect(destNode); else player.toDestination();
                                player.start(effectivePlayStart, offsetIntoSource, playDurationInWindow);
                            };
                            await player.load(url);
                        }
                    }
                } else if (this.patternPlayerSequence && !this.patternPlayerSequence.disposed) {
                    this.patternPlayerSequence.start(transportStartTime);
                }
            }, duration);

            console.log(`[Track ${this.id} "${this.name}"] renderTrackToBuffer complete. Buffer duration: ${offlineContext.duration}s`);
            return offlineContext;
        } catch (error) {
            console.error(`[Track ${this.id} "${this.name}"] renderTrackToBuffer error:`, error);
            return null;
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
                    
                    // Calculate effective playback rate: track rate × pitch shift rate
                    const pitchShiftRate = clip.pitchShift ? Math.pow(2, clip.pitchShift / 12) : 1.0;
                    const effectiveRate = this.timelinePlaybackRate * pitchShiftRate;
                    if (effectiveRate !== 1.0) {
                        player.playbackRate = effectiveRate;
                        console.log(`[Track ${this.id}] Set playback rate ${effectiveRate}x for clip ${clip.id} (track: ${this.timelinePlaybackRate}x, pitch: ${clip.pitchShift || 0} st)`);
                    }
                    this.clipPlayers.set(clip.id, player);
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
                            console.warn(`[Track ${this.id} Audio] Audio data for clip ${clip.id} (source ${clip.sourceId}) not found in DB.`);
                            if (this.appServices.showNotification) this.appServices.showNotification(`Audio for clip "${clip.name}" is missing.`, 3000);
                        }
                    } catch (err) { console.error(`[Track ${this.id} Audio] Error loading/scheduling audio clip ${clip.id}:`, err); if(this.clipPlayers.has(clip.id)){const p = this.clipPlayers.get(clip.id); if(p && !p.disposed) try{p.dispose()}catch(e){} this.clipPlayers.delete(clip.id);}}
                    
                    // Apply gain envelope if present
                    const envelope = clip.gainEnvelope;
                    const hasFadeIn = clip.fadeIn && clip.fadeIn > 0;
                    const hasFadeOut = clip.fadeOut && clip.fadeOut > 0;
                    if (envelope && envelope.length > 0) {
                        // Create gain node for envelope
                        const envGain = new Tone.Gain(1);
                        // Schedule envelope points
                        envelope.forEach((point, idx) => {
                            if (point.time >= offsetIntoSource && point.time < offsetIntoSource + playDurationInWindow) {
                                const absTime = effectivePlayStart + (point.time - offsetIntoSource);
                                envGain.gain.setValueAtTime(point.value, absTime);
                            }
                        });
                        // Connect player through envelope gain to destination
                        player.connect(envGain);
                        envGain.connect(this.gainNode || Tone.Destination);
                        // Store reference for cleanup
                        this.clipPlayers.set(`${clip.id}_envGain`, envGain);
                    } else {
                        // No envelope - apply fades if present or just connect directly
                        if (hasFadeIn || hasFadeOut) {
                            const fadeGain = new Tone.Gain(0);
                            // Fade in
                            if (hasFadeIn) {
                                fadeGain.gain.setValueAtTime(0, effectivePlayStart);
                                fadeGain.gain.linearRampToValueAtTime(1, effectivePlayStart + clip.fadeIn);
                            } else {
                                fadeGain.gain.setValueAtTime(1, effectivePlayStart);
                            }
                            // Fade out
                            if (hasFadeOut) {
                                const fadeOutStart = effectivePlayStart + playDurationInWindow - clip.fadeOut;
                                fadeGain.gain.setValueAtTime(1, fadeOutStart);
                                fadeGain.gain.linearRampToValueAtTime(0, effectivePlayStart + playDurationInWindow);
                            }
                            player.connect(fadeGain);
                            fadeGain.connect(this.gainNode || Tone.Destination);
                            this.clipPlayers.set(`${clip.id}_fadeGain`, fadeGain);
                        } else {
                            player.connect(this.gainNode || Tone.Destination);
                        }
                    }
                } else if (clip.type === 'sequence') {
                    const sourceSequence = this.sequences ? this.sequences.find(s => s.id === clip.sourceSequenceId) : null;
                    if (sourceSequence?.data?.length > 0 && sourceSequence.length > 0) {
                        console.log(`[Track ${this.id}] Timeline: Scheduling SEQUENCE clip "${clip.name}" (Source: "${sourceSequence.name}") from ${effectivePlayStart.toFixed(2)}s for ${playDurationInWindow.toFixed(2)}s using Tone.Part`);

                        const events = [];
                        const sixteenthTime = Tone.Time("16n").toSeconds();

                        for (let stepIdx = 0; stepIdx < sourceSequence.length; stepIdx++) {
                            const timeWithinSeq = stepIdx * sixteenthTime;
                            if (clipActualStart + timeWithinSeq >= effectivePlayStart && clipActualStart + timeWithinSeq < effectivePlayEnd) {
                                const eventTimeInPart = (clipActualStart + timeWithinSeq) - effectivePlayStart;
                                for (let rowIdx = 0; rowIdx < sourceSequence.data.length; rowIdx++) {
                                    const stepData = sourceSequence.data[rowIdx]?.[stepIdx];
                                    if (stepData?.active) {
                                        let noteValue;
                                        let noteDuration = "16n"; 
                                        if (this.type === 'Synth' || this.type === 'InstrumentSampler') {
                                            noteValue = Constants.synthPitches[rowIdx];
                                        } else if (this.type === 'Sampler') {
                                            const sliceData = this.slices[rowIdx];
                                            if (sliceData && sliceData.duration > 0 && this.audioBuffer?.loaded) {
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
                                } else if (this.type === 'Sampler' && value.note.type === 'slice' && this.audioBuffer?.loaded) {
                                    const sliceData = value.note.data;
                                    const targetVolumeLinear = sliceData.volume * value.velocity;
                                    const playbackRate = Math.pow(2, (sliceData.pitchShift || 0) / 12);
                                    let playDurationPart = sliceData.duration / playbackRate;
                                    if (sliceData.loop) playDurationPart = Tone.Time(value.duration).toSeconds();

                                    if (this.slicerIsPolyphonic) {
                                        const tempPlayer = new Tone.Player(this.audioBuffer);
                                        const tempEnv = new Tone.AmplitudeEnvelope(sliceData.envelope);
                                        const tempGain = new Tone.Gain(targetVolumeLinear);
                                        tempPlayer.chain(tempEnv, tempGain);
                                        tempPlayer.playbackRate = playbackRate; tempPlayer.reverse = sliceData.reverse || false; tempPlayer.loop = sliceData.loop || false;
                                        tempPlayer.loopStart = sliceData.offset; tempPlayer.loopEnd = sliceData.offset + sliceData.duration;

                                        tempPlayer.start(time, sliceData.offset, sliceData.loop ? undefined : playDurationPart);
                                        tempEnv.triggerAttack(time);
                                        if (!sliceData.loop) {
                                            const releaseTime = time + playDurationPart - (sliceData.envelope.release * 0.05); 
                                            tempEnv.triggerRelease(Math.max(time, releaseTime));
                                        }
                                        Tone.Transport.scheduleOnce(() => {
                                            try { if(tempPlayer && !tempPlayer.disposed) tempPlayer.dispose(); } catch(e){}
                                            try { if(tempEnv && !tempEnv.disposed) tempEnv.dispose(); } catch(e){}
                                            try { if(tempGain && !tempGain.disposed) tempGain.dispose(); } catch(e){}
                                        }, time + playDurationPart + (sliceData.envelope?.release || 0.3));
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
                                } else if (this.type === 'DrumSampler' && value.note.type === 'drum') {
                                    const padData = value.note.data;
                                    const player = this.drumPadPlayers[value.note.index];
                                    if (player && !player.disposed && player.loaded) {
                                        player.volume.value = Tone.gainToDb(padData.volume * value.velocity * 0.7);
                                        player.playbackRate = Math.pow(2, (padData.pitchShift || 0) / 12);
                                        player.start(time);
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
                    try {this.patternPlayerSequence.stop(Tone.Transport.now());} catch(e){console.warn("Err stopping seq player during schedule", e.message)}
                }
                console.log(`[Track ${this.id}] Sequencer mode: Starting patternPlayerSequence at transport offset: ${transportStartTime.toFixed(2)}s. Loop: ${this.patternPlayerSequence.loop}`);
                try {
                    this.patternPlayerSequence.start(transportStartTime); 
                } catch(e) {
                    console.error(`[Track ${this.id}] Error starting patternPlayerSequence:`, e.message, e); 
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

    // --- Automation Functions ---
    /**
     * Schedule automation events for playback.
     * @param {number} startTime - Transport start time
     * @param {number} duration - Duration to schedule for
     */
    scheduleAutomation(startTime, duration) {
        if (!this.automation || !this.gainNode || this.gainNode.disposed) {
            console.log(`[Track ${this.id}] No automation or gainNode not available for scheduling.`);
            return;
        }

        // Schedule volume automation
        if (this.automation.volume && Array.isArray(this.automation.volume) && this.automation.volume.length > 0) {
            this.automation.volume.forEach(point => {
                if (point.time >= startTime && point.time < startTime + duration) {
                    const rampTime = Tone.Transport.seconds + (point.time - startTime);
                    if (this.gainNode && !this.gainNode.disposed && this.gainNode.gain) {
                        try {
                            // Use exponential ramp for smoother transitions
                            this.gainNode.gain.setValueAtTime(
                                Math.max(0.0001, this.gainNode.gain.value),
                                rampTime - 0.001
                            );
                            this.gainNode.gain.exponentialRampToValueAtTime(
                                Math.max(0.0001, point.value),
                                rampTime
                            );
                            console.log(`[Track ${this.id}] Scheduled volume automation at ${point.time.toFixed(2)}s: ${(point.value * 100).toFixed(0)}%`);
                        } catch (e) {
                            console.warn(`[Track ${this.id}] Error scheduling volume automation:`, e.message);
                        }
                    }
                }
            });
        }
    }

    /**
     * Add an automation point.
     * @param {string} param - Parameter name (e.g., 'volume')
     * @param {number} time - Time in seconds
     * @param {number} value - Value (0-1 for volume)
     */
    addAutomationPoint(param, time, value) {
        if (!this.automation) {
            this.automation = { volume: [] };
        }
        if (!this.automation[param]) {
            this.automation[param] = [];
        }
        
        // Remove any existing point at the same time
        this.automation[param] = this.automation[param].filter(p => Math.abs(p.time - time) > 0.01);
        
        // Add new point and sort by time
        this.automation[param].push({ time, value });
        this.automation[param].sort((a, b) => a.time - b.time);
        
        console.log(`[Track ${this.id}] Added automation point for ${param} at ${time.toFixed(2)}s: ${value.toFixed(2)}`);
        
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Add automation point on ${this.name}`);
        }
    }

    /**
     * Remove an automation point.
     * @param {string} param - Parameter name
     * @param {number} time - Time of the point to remove
     */
    removeAutomationPoint(param, time) {
        if (!this.automation || !this.automation[param]) return;
        
        const initialLength = this.automation[param].length;
        this.automation[param] = this.automation[param].filter(p => Math.abs(p.time - time) > 0.01);
        
        if (this.automation[param].length < initialLength) {
            console.log(`[Track ${this.id}] Removed automation point for ${param} at ${time.toFixed(2)}s`);
            if (this.appServices.captureStateForUndo) {
                this.appServices.captureStateForUndo(`Remove automation point on ${this.name}`);
            }
        }
    }

    /**
     * Clear all automation for a parameter.
     * @param {string} param - Parameter name
     */
    clearAutomation(param) {
        if (!this.automation) return;
        
        this.automation[param] = [];
        console.log(`[Track ${this.id}] Cleared automation for ${param}`);
        
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Clear ${param} automation on ${this.name}`);
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

    /**
     * Set fade in/out for an audio clip.
     * @param {string} clipId - The clip ID
     * @param {number} fadeIn - Fade in duration in seconds
     * @param {number} fadeOut - Fade out duration in seconds
     */
    setClipFade(clipId, fadeIn, fadeOut) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (clip) {
            clip.fadeIn = Math.max(0, parseFloat(fadeIn) || 0);
            clip.fadeOut = Math.max(0, parseFloat(fadeOut) || 0);
            console.log(`[Track ${this.id}] Set clip "${clip.name}" fade: in=${clip.fadeIn}s, out=${clip.fadeOut}s`);
            this._captureUndoState(`Set fade for clip "${clip.name || clipId.slice(-4)}" on ${this.name}`);
            return true;
        }
        return false;
    }

    /**
     * Get fade values for a clip.
     * @param {string} clipId - The clip ID
     * @returns {Object} Fade settings {fadeIn, fadeOut}
     */
    getClipFade(clipId) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (clip) {
            return { fadeIn: clip.fadeIn || 0, fadeOut: clip.fadeOut || 0 };
        }
        return null;
    }

    // --- Clip Gain Envelope Methods ---
    /**
     * Set gain envelope for an audio clip.
     * @param {string} clipId - The clip ID
     * @param {Array<{time:number, value:number}>} envelope - Array of {time (seconds), value (0-1)} points
     */
    setClipGainEnvelope(clipId, envelope) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (clip) {
            if (!Array.isArray(envelope)) {
                console.warn(`[Track ${this.id}] Invalid envelope data for clip ${clipId}`);
                return false;
            }
            // Validate and sort points
            const validPoints = envelope
                .filter(p => typeof p.time === 'number' && typeof p.value === 'number')
                .map(p => ({ time: Math.max(0, p.time), value: Math.max(0, Math.min(1, p.value)) }))
                .sort((a, b) => a.time - b.time);
            
            clip.gainEnvelope = validPoints;
            console.log(`[Track ${this.id}] Set gain envelope for clip \"${clip.name}\" with ${validPoints.length} points`);
            this._captureUndoState(`Set gain envelope for clip \"${clip.name || clipId.slice(-4)}\" on ${this.name}`);
            if (this.appServices.renderTimeline) this.appServices.renderTimeline();
            return true;
        }
        return false;
    }

    /**
     * Get gain envelope for a clip.
     * @param {string} clipId - The clip ID
     * @returns {Array<{time:number, value:number}>|null}
     */
    getClipGainEnvelope(clipId) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (clip) {
            return clip.gainEnvelope || [];
        }
        return null;
    }

    /**
     * Add a gain envelope point to a clip.
     * @param {string} clipId - The clip ID
     * @param {number} time - Time in seconds (relative to clip start)
     * @param {number} value - Gain value (0-1)
     */
    addClipGainEnvelopePoint(clipId, time, value) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (clip) {
            if (!clip.gainEnvelope) clip.gainEnvelope = [];
            const pointTime = Math.max(0, Math.min(clip.duration || 100, parseFloat(time) || 0));
            const pointValue = Math.max(0, Math.min(1, parseFloat(value) || 0.7));
            
            // Remove existing point at same time (within 0.01s tolerance)
            clip.gainEnvelope = clip.gainEnvelope.filter(p => Math.abs(p.time - pointTime) > 0.01);
            clip.gainEnvelope.push({ time: pointTime, value: pointValue });
            clip.gainEnvelope.sort((a, b) => a.time - b.time);
            
            console.log(`[Track ${this.id}] Added gain envelope point at ${pointTime.toFixed(2)}s: ${pointValue.toFixed(2)}`);
            this._captureUndoState(`Add gain envelope point on ${this.name}`);
            if (this.appServices.renderTimeline) this.appServices.renderTimeline();
            return true;
        }
        return false;
    }

    /**
     * Remove a gain envelope point from a clip.
     * @param {string} clipId - The clip ID
     * @param {number} time - Time of the point to remove
     */
    removeClipGainEnvelopePoint(clipId, time) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (clip && clip.gainEnvelope) {
            const initialLength = clip.gainEnvelope.length;
            clip.gainEnvelope = clip.gainEnvelope.filter(p => Math.abs(p.time - time) > 0.01);
            if (clip.gainEnvelope.length < initialLength) {
                console.log(`[Track ${this.id}] Removed gain envelope point at ${time.toFixed(2)}s`);
                this._captureUndoState(`Remove gain envelope point on ${this.name}`);
                if (this.appServices.renderTimeline) this.appServices.renderTimeline();
                return true;
            }
        }
        return false;
    }

    /**
     * Clear gain envelope for a clip.
     * @param {string} clipId - The clip ID
     */
    clearClipGainEnvelope(clipId) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (clip) {
            const hadEnvelope = clip.gainEnvelope && clip.gainEnvelope.length > 0;
            clip.gainEnvelope = [];
            if (hadEnvelope) {
                console.log(`[Track ${this.id}] Cleared gain envelope for clip \"${clip.name}\"`);
                this._captureUndoState(`Clear gain envelope on ${this.name}`);
                if (this.appServices.renderTimeline) this.appServices.renderTimeline();
            }
            return true;
        }
        return false;
    }

    /**
     * Set pitch shift for an audio clip in semitones.
     * @param {string} clipId - The clip ID
     * @param {number} semitones - Pitch shift in semitones (positive = up, negative = down)
     */
    setClipPitchShift(clipId, semitones) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found for pitch shift.`);
            return false;
        }
        
        const oldShift = clip.pitchShift || 0;
        const newShift = Math.max(-24, Math.min(24, parseFloat(semitones) || 0));
        
        if (oldShift === newShift) return true;
        
        clip.pitchShift = newShift;
        console.log(`[Track ${this.id}] Set clip \"${clip.name}\" pitch shift: ${oldShift} → ${newShift} semitones`);
        this._captureUndoState(`Set clip pitch shift for ${clip.name} to ${newShift} semitones`);
        if (this.appServices.renderTimeline) this.appServices.renderTimeline();
        return true;
    }

    /**
     * Get pitch shift for an audio clip.
     * @param {string} clipId - The clip ID
     * @returns {number} Pitch shift in semitones
     */
    getClipPitchShift(clipId) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        return clip?.pitchShift || 0;
    }

    /**
     * Split an audio clip at a given time.
     * Creates two clips from one, with the second starting at the split point.
     * @param {string} clipId - The clip ID to split
     * @param {number} splitTime - Time in seconds (absolute, not relative to clip)
     * @returns {Object|null} The new clip object, or null if split failed
     */
    splitClipAtPlayhead(clipId, splitTime) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found for split.`);
            return null;
        }

        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;
        const splitPoint = Math.max(clipStart, Math.min(clipEnd, parseFloat(splitTime) || clipStart));

        // Need at least 0.05s on each side to create a valid split
        if (splitPoint - clipStart < 0.05 || clipEnd - splitPoint < 0.05) {
            console.warn(`[Track ${this.id}] Split point too close to clip edge.`);
            if (this.appServices.showNotification) {
                this.appServices.showNotification('Cannot split: resulting clips would be too short.', 2000);
            }
            return null;
        }

        const clip1Duration = splitPoint - clipStart;
        const clip2Duration = clipEnd - splitPoint;
        const clip2StartTime = splitPoint;

        // Create second clip (right portion)
        const newClipId = `audioclip_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newClip = {
            id: newClipId,
            type: clip.type,
            sourceId: clip.sourceId, // Same audio source
            startTime: clip2StartTime,
            duration: clip2Duration,
            name: `${clip.name} (2)`,
            fadeIn: clip.fadeIn || 0,
            fadeOut: clip.fadeOut || 0,
            pitchShift: clip.pitchShift || 0,
            gainEnvelope: clip.gainEnvelope ? JSON.parse(JSON.stringify(clip.gainEnvelope)) : undefined,
            // Copy over any other clip properties as needed
        };

        // Modify first clip (left portion)
        clip.duration = clip1Duration;
        clip.name = `${clip.name} (1)`;
        // Transfer fade out to the first clip's end
        if (clip.fadeOut && clip.fadeOut > 0) {
            // The original fade out now applies to the first clip's end
        }

        // Add new clip to timeline
        this.timelineClips.push(newClip);
        this.timelineClips.sort((a, b) => a.startTime - b.startTime);

        console.log(`[Track ${this.id}] Split clip \"${clip.name}\" at ${splitPoint.toFixed(2)}s → \"${clip.name}\" (${clip1Duration.toFixed(2)}s) + \"${newClip.name}\" (${clip2Duration.toFixed(2)}s)`);
        this._captureUndoState(`Split clip \"${clip.name}\" at playhead`);

        return newClip;
    }

    /**
     * Get interpolated gain value at a specific time within a clip.
     * @param {string} clipId - The clip ID
     * @param {number} time - Time in seconds (relative to clip start)
     * @returns {number} Interpolated gain value (0-1)
     */
    getInterpolatedGainAtTime(clipId, time) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) return 1.0;
        
        const envelope = clip.gainEnvelope;
        if (!envelope || envelope.length === 0) return 1.0;
        
        const clipDuration = clip.duration || 100;
        const t = Math.max(0, Math.min(clipDuration, time));
        
        // If before first point, return first point's value
        if (t <= envelope[0].time) return envelope[0].value;
        
        // If after last point, return last point's value
        if (t >= envelope[envelope.length - 1].time) return envelope[envelope.length - 1].value;
        
        // Find surrounding points and interpolate
        for (let i = 0; i < envelope.length - 1; i++) {
            if (t >= envelope[i].time && t <= envelope[i + 1].time) {
                const t0 = envelope[i].time;
                const t1 = envelope[i + 1].time;
                const v0 = envelope[i].value;
                const v1 = envelope[i + 1].value;
                const alpha = (t - t0) / (t1 - t0);
                return v0 + (v1 - v0) * alpha;
            }
        }
        
        return 1.0;
    }

    /**
     * Set playback rate for timeline audio clips on this track.
     * @param {number} rate - Playback rate (0.25 = 1/4 speed, 2.0 = 2x speed)
     * @param {boolean} fromInteraction - Whether this is from a user interaction
     */
    setPlaybackRate(rate, fromInteraction = false) {
        this.timelinePlaybackRate = Math.max(0.25, Math.min(4.0, parseFloat(rate) || 1.0));
        console.log(`[Track ${this.id}] Set playback rate to ${this.timelinePlaybackRate}x`);
        if (fromInteraction && this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Set playback rate for ${this.name} to ${this.timelinePlaybackRate}x`);
        }
        if (this.appServices.renderTimeline) this.appServices.renderTimeline();
    }

    /**
     * Get current playback rate.
     * @returns {number} Playback rate
     */
    getPlaybackRate() {
        return this.timelinePlaybackRate;
    }

    /**
     * Add an audio clip to this track from a recorded blob.
     * @param {Blob} audioBlob - The recorded audio blob
     * @param {number} startTime - Start time in seconds on the timeline
     * @param {Object} options - Optional settings
     * @param {boolean} options.normalize - Whether to normalize audio (default true)
     * @param {number} options.targetDb - Target peak level in dB for normalization (default -1)
     * @returns {Promise<Object|null>} The created clip object or null on failure
     */
    async addAudioClip(audioBlob, startTime, options = {}) {
        const { normalize = true, targetDb = -1 } = options;
        
        if (this.type !== 'Audio') {
            console.error(`[Track ${this.id} addAudioClip] Cannot add audio clip to non-Audio track.`);
            if (this.appServices.showNotification) {
                this.appServices.showNotification('Cannot add audio to non-Audio track.', 3000);
            }
            return null;
        }

        if (!audioBlob || audioBlob.size === 0) {
            console.error(`[Track ${this.id} addAudioClip] Invalid or empty audio blob.`);
            return null;
        }

        try {
            console.log(`[Track ${this.id} addAudioClip] Processing audio blob, size: ${audioBlob.size}, normalize: ${normalize}, targetDb: ${targetDb}dB`);
            
            let processedBlob = audioBlob;
            
            // Normalize audio if requested
            if (normalize) {
                processedBlob = await this._normalizeAudioBlob(audioBlob, targetDb);
            }

            // Store in IndexedDB
            const dbKey = `audioclip_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const audioData = await processedBlob.arrayBuffer();
            await storeAudio(dbKey, audioData);
            console.log(`[Track ${this.id} addAudioClip] Audio stored with key: ${dbKey}`);

            // Get duration from the audio buffer
            const duration = await this.getBlobDuration(processedBlob);
            
            // Create clip entry
            const clipId = `audioclip_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const clipNumber = this.timelineClips.filter(c => c.type === 'audio').length + 1;
            const clip = {
                id: clipId,
                type: 'audio',
                sourceId: dbKey,
                startTime: startTime || 0,
                duration: duration,
                name: `Recording ${clipNumber}`,
                fadeIn: 0,
                fadeOut: 0,
                normalized: normalize,
                targetDb: normalize ? targetDb : null
            };

            this.timelineClips.push(clip);
            console.log(`[Track ${this.id} addAudioClip] Created clip:`, clip.name, 'at', clip.startTime, 'duration:', clip.duration);

            // Capture undo state
            this._captureUndoState(`Added audio clip "${clip.name}" on ${this.name}`);

            // Update UI if available
            if (this.appServices.updateTrackUI) {
                this.appServices.updateTrackUI(this.id, 'audioClipAdded');
            }

            return clip;
        } catch (error) {
            console.error(`[Track ${this.id} addAudioClip] Error:`, error);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Error adding audio clip: ${error.message}`, 3000);
            }
            return null;
        }
    }

    /**
     * Normalize an audio blob to a target peak level.
     * @param {Blob} audioBlob - The audio blob to normalize
     * @param {number} targetDb - Target peak level in dB (default -1)
     * @returns {Promise<Blob>} Normalized audio blob
     */
    async _normalizeAudioBlob(audioBlob, targetDb = -1) {
        try {
            // Decode the audio data
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Find the peak amplitude
            let peakAmplitude = 0;
            for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                for (let i = 0; i < channelData.length; i++) {
                    const absValue = Math.abs(channelData[i]);
                    if (absValue > peakAmplitude) {
                        peakAmplitude = absValue;
                    }
                }
            }
            
            if (peakAmplitude === 0) {
                console.warn('[Audio Normalization] Audio is silent, skipping normalization.');
                await audioContext.close();
                return audioBlob;
            }
            
            // Calculate gain needed to reach target dB
            // Target linear amplitude from dB: 10^(targetDb/20)
            const targetLinear = Math.pow(10, targetDb / 20);
            const gainFactor = targetLinear / peakAmplitude;
            
            console.log(`[Audio Normalization] Peak: ${peakAmplitude.toFixed(4)} (${(20 * Math.log10(peakAmplitude)).toFixed(2)}dB), Target: ${targetDb}dB, Gain: ${gainFactor.toFixed(4)}`);
            
            // If gain is very close to 1, no normalization needed
            if (Math.abs(gainFactor - 1) < 0.001) {
                console.log('[Audio Normalization] Audio already at target level, skipping.');
                await audioContext.close();
                return audioBlob;
            }
            
            // Apply gain to all channels
            const offlineContext = new OfflineAudioContext(
                audioBuffer.numberOfChannels,
                audioBuffer.length,
                audioBuffer.sampleRate
            );
            
            const source = offlineContext.createBufferSource();
            source.buffer = audioBuffer;
            
            const gainNode = offlineContext.createGain();
            gainNode.gain.value = gainFactor;
            
            source.connect(gainNode);
            gainNode.connect(offlineContext.destination);
            
            source.start();
            const normalizedBuffer = await offlineContext.startRendering();
            
            // Convert back to WAV blob
            const normalizedBlob = await this._audioBufferToWav(normalizedBuffer);
            
            await audioContext.close();
            console.log(`[Audio Normalization] Complete, new blob size: ${normalizedBlob.size}`);
            
            return normalizedBlob;
        } catch (error) {
            console.error('[Audio Normalization] Error:', error);
            // Return original blob on error
            return audioBlob;
        }
    }

    /**
     * Convert an AudioBuffer to a WAV blob.
     * @param {AudioBuffer} audioBuffer - The audio buffer to convert
     * @returns {Blob} WAV blob
     */
    _audioBufferToWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        
        const dataLength = audioBuffer.length * blockAlign;
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);
        
        // WAV header
        this._writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this._writeString(view, 8, 'WAVE');
        this._writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        this._writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // Write interleaved audio data
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(audioBuffer.getChannelData(i));
        }
        
        let offset = 44;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Helper to write a string to a DataView.
     */
    _writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * Reverse an audio clip in place.
     * @param {string} clipId - The clip ID to reverse
     * @returns {Promise<boolean>} True if successful
     */
    async reverseAudioClip(clipId) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip || clip.type !== 'audio') {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found or not audio clip.`);
            return false;
        }

        console.log(`[Track ${this.id}] Reversing audio clip "${clip.name}"...`);

        try {
            // Get the original audio blob from IndexedDB
            const originalBlob = await getAudio(clip.sourceId);
            if (!originalBlob) {
                console.error(`[Track ${this.id}] Audio data not found for clip ${clipId}`);
                if (this.appServices.showNotification) {
                    this.appServices.showNotification('Audio data not found for this clip.', 3000);
                }
                return false;
            }

            // Decode the audio
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = await originalBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Reverse the audio data for each channel
            const numberOfChannels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const length = audioBuffer.length;
            const reversedBuffer = audioContext.createBuffer(numberOfChannels, length, sampleRate);

            for (let channel = 0; channel < numberOfChannels; channel++) {
                const originalData = audioBuffer.getChannelData(channel);
                const reversedData = reversedBuffer.getChannelData(channel);
                for (let i = 0; i < length; i++) {
                    reversedData[i] = originalData[length - 1 - i];
                }
            }

            // Convert back to WAV blob
            const reversedBlob = await this._audioBufferToWav(reversedBuffer);
            await audioContext.close();

            // Store the reversed audio with a new key
            const newDbKey = `audioclip_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_reversed`;
            const newAudioData = await reversedBlob.arrayBuffer();
            await storeAudio(newDbKey, newAudioData);

            // Update the clip's sourceId
            const oldSourceId = clip.sourceId;
            clip.sourceId = newDbKey;

            // Clear any audio buffer cache for this clip
            if (clip.audioBuffer) {
                if (clip.audioBuffer.disposed === false) {
                    try { clip.audioBuffer.dispose(); } catch(e) {}
                }
                clip.audioBuffer = null;
            }

            console.log(`[Track ${this.id}] Reversed audio clip "${clip.name}" (old key: ${oldSourceId}, new key: ${newDbKey})`);

            // Capture undo state
            this._captureUndoState(`Reverse clip "${clip.name}" on ${this.name}`);

            // Update UI
            if (this.appServices.renderTimeline) {
                this.appServices.renderTimeline();
            }
            if (this.appServices.updateTrackUI) {
                this.appServices.updateTrackUI(this.id, 'audioClipReversed');
            }

            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Audio clip reversed.`, 2000);
            }

            return true;
        } catch (error) {
            console.error(`[Track ${this.id}] Error reversing audio clip:`, error);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Error reversing audio: ${error.message}`, 3000);
            }
            return false;
        }
    }

    // --- Track Freeze Methods ---
    /**
     * Freeze the track - render to audio and disable real-time processing.
     * @param {number} startBar - Start bar for freeze (default 0)
     * @param {number} endBar - End bar for freeze (default: project length)
     * @returns {Promise<boolean>} True if freeze was successful
     */
    async freeze(startBar = 0, endBar = null) {
        if (this.frozen) {
            console.log(`[Track ${this.id}] Already frozen.`);
            return true;
        }

        console.log(`[Track ${this.id}] Starting freeze process...`);
        
        try {
            // Use bounce functionality to render track to audio
            if (!this.appServices.bounceTrackToAudio) {
                console.error(`[Track ${this.id}] bounceTrackToAudio not available for freeze.`);
                if (this.appServices.showNotification) {
                    this.appServices.showNotification('Cannot freeze: audio system not ready.', 3000);
                }
                return false;
            }

            // Bounce without downloading or creating new track
            const result = await this.appServices.bounceTrackToAudio(this.id, {
                download: false,
                createNewTrack: false,
                startBar: startBar,
                endBar: endBar,
                returnBlob: true // Request blob to be returned
            });

            if (!result || !result.blob) {
                console.error(`[Track ${this.id}] Freeze failed: no audio rendered.`);
                if (this.appServices.showNotification) {
                    this.appServices.showNotification('Freeze failed: no audio rendered.', 3000);
                }
                return false;
            }

            // Store the frozen audio
            this.frozenAudioBlob = result.blob;
            this.frozenDuration = result.duration || 0;

            // Store in IndexedDB
            const dbKey = `frozen_${this.id}_${Date.now()}`;
            const audioData = await this.frozenAudioBlob.arrayBuffer();
            await storeAudio(dbKey, audioData);
            this.frozenAudioDbKey = dbKey;
            console.log(`[Track ${this.id}] Frozen audio stored with key: ${dbKey}`);

            // Create frozen player
            await this._initFrozenPlayer();

            // Set frozen state
            this.frozen = true;

            // Capture undo state
            if (this.appServices.captureStateForUndo) {
                this.appServices.captureStateForUndo(`Froze track ${this.name}`);
            }

            // Update UI
            if (this.appServices.updateTrackUI) {
                this.appServices.updateTrackUI(this.id, 'frozen');
            }

            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Track "${this.name}" frozen.`, 2000);
            }

            console.log(`[Track ${this.id}] Freeze complete.`);
            return true;
        } catch (error) {
            console.error(`[Track ${this.id}] Freeze error:`, error);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Freeze failed: ${error.message}`, 3000);
            }
            return false;
        }
    }

    /**
     * Unfreeze the track - restore real-time processing.
     * @returns {Promise<boolean>} True if unfreeze was successful
     */
    async unfreeze() {
        if (!this.frozen) {
            console.log(`[Track ${this.id}] Not frozen, nothing to unfreeze.`);
            return true;
        }

        console.log(`[Track ${this.id}] Unfreezing...`);

        try {
            // Dispose frozen player
            if (this.frozenPlayer && !this.frozenPlayer.disposed) {
                this.frozenPlayer.dispose();
            }
            this.frozenPlayer = null;

            // Clear frozen state
            this.frozen = false;
            this.frozenAudioBlob = null;
            // Keep dbKey for potential re-freeze

            // Capture undo state
            if (this.appServices.captureStateForUndo) {
                this.appServices.captureStateForUndo(`Unfroze track ${this.name}`);
            }

            // Update UI
            if (this.appServices.updateTrackUI) {
                this.appServices.updateTrackUI(this.id, 'unfrozen');
            }

            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Track "${this.name}" unfrozen.`, 2000);
            }

            console.log(`[Track ${this.id}] Unfreeze complete.`);
            return true;
        } catch (error) {
            console.error(`[Track ${this.id}] Unfreeze error:`, error);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Unfreeze failed: ${error.message}`, 3000);
            }
            return false;
        }
    }

    /**
     * Initialize the frozen audio player.
     * @returns {Promise<boolean>} True if successful
     */
    async _initFrozenPlayer() {
        try {
            if (!this.frozenAudioBlob && !this.frozenAudioDbKey) {
                console.error(`[Track ${this.id}] No frozen audio to initialize player.`);
                return false;
            }

            // Load audio from blob or DB
            let audioUrl;
            if (this.frozenAudioBlob) {
                audioUrl = URL.createObjectURL(this.frozenAudioBlob);
            } else if (this.frozenAudioDbKey) {
                const audioData = await getAudio(this.frozenAudioDbKey);
                if (!audioData) {
                    console.error(`[Track ${this.id}] Failed to load frozen audio from DB.`);
                    return false;
                }
                const blob = new Blob([audioData], { type: 'audio/wav' });
                audioUrl = URL.createObjectURL(blob);
            }

            // Create Tone.Player
            this.frozenPlayer = new Tone.Player({
                url: audioUrl,
                loop: false,
                onload: () => {
                    console.log(`[Track ${this.id}] Frozen player loaded.`);
                }
            });

            // Connect to output
            if (this.gainNode && !this.gainNode.disposed) {
                this.frozenPlayer.connect(this.gainNode);
            }

            return true;
        } catch (error) {
            console.error(`[Track ${this.id}] Error initializing frozen player:`, error);
            return false;
        }
    }

    /**
     * Check if the track is frozen.
     * @returns {boolean} True if frozen
     */
    isFrozen() {
        return this.frozen;
    }

    /**
     * Get frozen state info.
     * @returns {Object} Frozen state info
     */
    getFrozenInfo() {
        return {
            frozen: this.frozen,
            frozenAudioDbKey: this.frozenAudioDbKey,
            frozenDuration: this.frozenDuration
        };
    }

    // --- Clip Loop Mode ---
    /**
     * Set loop mode for an audio clip.
     * @param {string} clipId - The clip ID
     * @param {boolean} enabled - Whether looping is enabled
     * @param {number} loopStart - Loop start point relative to clip start (seconds)
     * @param {number} loopEnd - Loop end point relative to clip start (seconds)
     * @returns {boolean} True if successful
     */
    setClipLoopMode(clipId, enabled, loopStart = 0, loopEnd = 0) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found for loop mode.`);
            return false;
        }

        clip.loopEnabled = Boolean(enabled);
        clip.loopStart = Math.max(0, parseFloat(loopStart) || 0);
        clip.loopEnd = Math.min(clip.duration, parseFloat(loopEnd) || clip.duration);

        console.log(`[Track ${this.id}] Set clip "${clip.name}" loop mode: ${clip.loopEnabled}, ${clip.loopStart}s - ${clip.loopEnd}s`);
        this._captureUndoState(`Set loop mode for ${clip.name}`);
        if (this.appServices.renderTimeline) this.appServices.renderTimeline();
        return true;
    }

    /**
     * Get loop mode settings for an audio clip.
     * @param {string} clipId - The clip ID
     * @returns {Object} Loop settings {enabled, loopStart, loopEnd}
     */
    getClipLoopMode(clipId) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) return { enabled: false, loopStart: 0, loopEnd: 0 };
        return {
            enabled: clip.loopEnabled || false,
            loopStart: clip.loopStart || 0,
            loopEnd: clip.loopEnd || clip.duration || 0
        };
    }

    // --- Crossfade Between Clips ---
    /**
     * Create a crossfade between two overlapping audio clips.
     * @param {string} clipId1 - First clip ID (fades out)
     * @param {string} clipId2 - Second clip ID (fades in)
     * @param {number} crossfadeDuration - Duration of crossfade in seconds
     * @returns {boolean} True if successful
     */
    crossfadeClips(clipId1, clipId2, crossfadeDuration = 0.5) {
        const clip1 = this.timelineClips.find(c => c.id === clipId1);
        const clip2 = this.timelineClips.find(c => c.id === clipId2);

        if (!clip1 || !clip2) {
            console.warn(`[Track ${this.id}] One or both clips not found for crossfade.`);
            return false;
        }

        // Check if clips overlap or are adjacent
        const clip1End = clip1.startTime + clip1.duration;
        const clip2Start = clip2.startTime;

        if (clip2Start > clip1End + crossfadeDuration) {
            console.warn(`[Track ${this.id}] Clips do not overlap or are too far apart for crossfade.`);
            if (this.appServices.showNotification) {
                this.appServices.showNotification('Clips must overlap or be adjacent for crossfade.', 2000);
            }
            return false;
        }

        const fadeDuration = Math.max(0.05, Math.min(crossfadeDuration, clip1.duration, clip2.duration));

        // Set fade out on clip 1 (fade out from end)
        clip1.fadeOut = fadeDuration;

        // Set fade in on clip 2 (fade in from start)
        clip2.fadeIn = fadeDuration;

        console.log(`[Track ${this.id}] Crossfade applied: ${fadeDuration}s between "${clip1.name}" and "${clip2.name}"`);
        this._captureUndoState(`Crossfade clips ${clip1.name} and ${clip2.name}`);
        if (this.appServices.renderTimeline) this.appServices.renderTimeline();
        if (this.appServices.showNotification) {
            this.appServices.showNotification(`Crossfade applied (${fadeDuration}s)`, 1500);
        }
        return true;
    }

    // --- Arpeggiator ---
    /**
     * Initialize arpeggiator for this track.
     * @param {Object} options - Arpeggiator settings
     */
    initArpeggiator(options = {}) {
        this.arpeggiatorSettings = {
            enabled: options.enabled || false,
            mode: options.mode || 'up', // up, down, updown, random, chord
            octaves: options.octaves || 1,
            rate: options.rate || '16n', // 4n, 8n, 16n, 32n
            gate: options.gate || 0.8, // 0-1, how much of each step is sounded
            hold: options.hold || false, // whether held notes continue
            ...this.arpeggiatorSettings
        };
        this.arpeggiatorHeldNotes = new Map(); // pitch -> velocity
        this.arpeggiatorCurrentIndex = 0;
        this.arpeggiatorDirection = 1; // 1 for up, -1 for down
        this.arpeggiatorInterval = null;
        console.log(`[Track ${this.id}] Arpeggiator initialized:`, this.arpeggiatorSettings);
    }

    /**
     * Set arpeggiator settings.
     * @param {Object} settings - Arpeggiator settings
     */
    setArpeggiatorSettings(settings) {
        if (!this.arpeggiatorSettings) this.initArpeggiator();
        this.arpeggiatorSettings = { ...this.arpeggiatorSettings, ...settings };
        console.log(`[Track ${this.id}] Arpeggiator settings updated:`, this.arpeggiatorSettings);
    }

    /**
     * Get arpeggiator settings.
     * @returns {Object} Arpeggiator settings
     */
    getArpeggiatorSettings() {
        return this.arpeggiatorSettings || { enabled: false, mode: 'up', octaves: 1, rate: '16n', gate: 0.8 };
    }

    /**
     * Start arpeggiating held notes.
     */
    startArpeggiator() {
        if (!this.arpeggiatorSettings?.enabled) return;
        if (this.arpeggiatorInterval) return; // Already running

        const rateToMs = (rate) => {
            const bpm = this.appServices.getBPM ? this.appServices.getBPM() : 120;
            const quarterNoteMs = 60000 / bpm;
            const rateMap = { '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125 };
            return quarterNoteMs * (rateMap[rate] || 0.25);
        };

        const intervalMs = rateToMs(this.arpeggiatorSettings.rate);

        this.arpeggiatorInterval = setInterval(() => {
            this._arpeggiateStep();
        }, intervalMs);

        console.log(`[Track ${this.id}] Arpeggiator started at ${this.arpeggiatorSettings.rate}`);
    }

    /**
     * Stop arpeggiator.
     */
    stopArpeggiator() {
        if (this.arpeggiatorInterval) {
            clearInterval(this.arpeggiatorInterval);
            this.arpeggiatorInterval = null;
        }
        this.arpeggiatorCurrentIndex = 0;
        this.arpeggiatorDirection = 1;
        console.log(`[Track ${this.id}] Arpeggiator stopped`);
    }

    /**
     * Add a note to the arpeggiator's held notes.
     * @param {number} pitch - MIDI pitch
     * @param {number} velocity - Velocity (0-1)
     */
    arpeggiatorNoteOn(pitch, velocity = 0.8) {
        if (!this.arpeggiatorSettings?.enabled) return;
        if (!this.arpeggiatorHeldNotes) this.arpeggiatorHeldNotes = new Map();
        this.arpeggiatorHeldNotes.set(pitch, velocity);
        if (!this.arpeggiatorInterval) this.startArpeggiator();
    }

    /**
     * Remove a note from the arpeggiator's held notes.
     * @param {number} pitch - MIDI pitch
     */
    arpeggiatorNoteOff(pitch) {
        if (!this.arpeggiatorHeldNotes) return;
        this.arpeggiatorHeldNotes.delete(pitch);
        if (this.arpeggiatorHeldNotes.size === 0 && !this.arpeggiatorSettings?.hold) {
            this.stopArpeggiator();
        }
    }

    /**
     * Internal: Execute one step of the arpeggiator.
     */
    _arpeggiateStep() {
        if (!this.arpeggiatorHeldNotes || this.arpeggiatorHeldNotes.size === 0) return;

        const notes = Array.from(this.arpeggiatorHeldNotes.entries()).sort((a, b) => a[0] - b[0]);
        if (notes.length === 0) return;

        // Expand for octaves
        const expandedNotes = [];
        const octaves = this.arpeggiatorSettings?.octaves || 1;
        for (let oct = 0; oct < octaves; oct++) {
            for (const [pitch, velocity] of notes) {
                expandedNotes.push([pitch + (oct * 12), velocity]);
            }
        }

        let targetNote;
        const mode = this.arpeggiatorSettings?.mode || 'up';

        if (mode === 'up') {
            targetNote = expandedNotes[this.arpeggiatorCurrentIndex % expandedNotes.length];
            this.arpeggiatorCurrentIndex = (this.arpeggiatorCurrentIndex + 1) % expandedNotes.length;
        } else if (mode === 'down') {
            targetNote = expandedNotes[expandedNotes.length - 1 - (this.arpeggiatorCurrentIndex % expandedNotes.length)];
            this.arpeggiatorCurrentIndex = (this.arpeggiatorCurrentIndex + 1) % expandedNotes.length;
        } else if (mode === 'updown') {
            targetNote = expandedNotes[this.arpeggiatorCurrentIndex];
            this.arpeggiatorCurrentIndex += this.arpeggiatorDirection;
            if (this.arpeggiatorCurrentIndex >= expandedNotes.length - 1) {
                this.arpeggiatorDirection = -1;
            } else if (this.arpeggiatorCurrentIndex <= 0) {
                this.arpeggiatorDirection = 1;
            }
        } else if (mode === 'random') {
            targetNote = expandedNotes[Math.floor(Math.random() * expandedNotes.length)];
        } else if (mode === 'chord') {
            // Play all held notes simultaneously
            const now = Tone.now();
            const gate = this.arpeggiatorSettings?.gate || 0.8;
            const rateToSec = (rate) => {
                const bpm = this.appServices.getBPM ? this.appServices.getBPM() : 120;
                const quarterNoteSec = 60 / bpm;
                const rateMap = { '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125 };
                return quarterNoteSec * (rateMap[rate] || 0.25);
            };
            const duration = rateToSec(this.arpeggiatorSettings?.rate) * gate;
            expandedNotes.forEach(([pitch, velocity]) => {
                this.playNote(pitch, now, duration, velocity);
            });
            return;
        }

        if (targetNote) {
            const [pitch, velocity] = targetNote;
            const now = Tone.now();
            const gate = this.arpeggiatorSettings?.gate || 0.8;
            const rateToSec = (rate) => {
                const bpm = this.appServices.getBPM ? this.appServices.getBPM() : 120;
                const quarterNoteSec = 60 / bpm;
                const rateMap = { '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125 };
                return quarterNoteSec * (rateMap[rate] || 0.25);
            };
            const duration = rateToSec(this.arpeggiatorSettings?.rate) * gate;
            this.playNote(pitch, now, duration, velocity);
        }
    }

    // --- Chord Detection ---
    /**
     * Detect chord name from a set of pitches.
     * @param {Array<number>} pitches - Array of MIDI pitch numbers
     * @returns {Object} {name, type, root, notes}
     */
    static detectChord(pitches) {
        if (!pitches || pitches.length === 0) return { name: 'N/A', type: 'unknown', root: null, notes: [] };

        // Sort and normalize pitches to pitch classes (0-11)
        const pitchClasses = [...new Set(pitches.map(p => Math.round(p) % 12))].sort((a, b) => a - b);

        if (pitchClasses.length === 1) {
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            return { name: noteNames[pitchClasses[0]], type: 'note', root: pitchClasses[0], notes: [pitches[0]] };
        }

        // Chord intervals (relative to root)
        const chordTypes = {
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            'dim': [0, 3, 6],
            'aug': [0, 4, 8],
            'maj7': [0, 4, 7, 11],
            'min7': [0, 3, 7, 10],
            'dom7': [0, 4, 7, 10],
            'dim7': [0, 3, 6, 9],
            'sus2': [0, 2, 7],
            'sus4': [0, 5, 7],
            'add9': [0, 4, 7, 14],
            'min9': [0, 3, 7, 10, 14],
            'maj9': [0, 4, 7, 11, 14]
        };

        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Try each pitch class as root
        for (const root of pitchClasses) {
            const intervals = pitchClasses.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b);

            for (const [type, pattern] of Object.entries(chordTypes)) {
                const normalizedPattern = pattern.map(i => i % 12).sort((a, b) => a - b);
                if (JSON.stringify(intervals) === JSON.stringify(normalizedPattern)) {
                    return {
                        name: `${noteNames[root]} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                        type: type,
                        root: root,
                        notes: pitches
                    };
                }
            }
        }

        // No match found - return generic name
        const lowest = pitchClasses[0];
        return {
            name: `${noteNames[lowest]} (unknown)`,
            type: 'unknown',
            root: lowest,
            notes: pitches
        };
    }

    /**
     * Set frozen state from saved data (for project recovery).
     * @param {Object} frozenData - Frozen state data
     */
    async setFrozenState(frozenData) {
        if (!frozenData) return;

        this.frozen = frozenData.frozen || false;
        this.frozenAudioDbKey = frozenData.frozenAudioDbKey || null;
        this.frozenDuration = frozenData.frozenDuration || 0;

        if (this.frozen && this.frozenAudioDbKey) {
            await this._initFrozenPlayer();
        }
    }

    // ==================== Delay Compensation Methods ====================

    /**
     * Set delay compensation for this track.
     * @param {number} delayMs - Delay in milliseconds (positive = delay the track to compensate for other tracks' latency)
     */
    setDelayCompensation(delayMs) {
        if (typeof delayMs !== 'number' || delayMs < 0) {
            console.warn(`[Track ${this.id}] Invalid delay compensation value: ${delayMs}. Must be a non-negative number.`);
            return;
        }
        
        this.delayCompensationMs = delayMs;
        
        if (this.delayCompensationNode && !this.delayCompensationNode.disposed) {
            try {
                this.delayCompensationNode.delayTime.value = delayMs / 1000;
                console.log(`[Track ${this.id}] Set delay compensation to ${delayMs}ms`);
            } catch (e) {
                console.error(`[Track ${this.id}] Error setting delay compensation:`, e);
            }
        }
    }

    /**
     * Get current delay compensation value.
     * @returns {number} Delay in milliseconds
     */
    getDelayCompensation() {
        return this.delayCompensationMs;
    }

    /**
     * Calculate latency from effects on this track.
     * Returns estimated latency in milliseconds based on known effect types.
     * @returns {number} Estimated latency in ms
     */
    calculateEffectLatency() {
        let totalLatencyMs = 0;
        
        const effectLatencyMap = {
            'Compressor': 0,       // Usually no latency
            'Limiter': 0,          // No lookahead latency in Tone.js implementation
            'MultibandCompressor': 0,
            'Reverb': 0,           // Pre-delay is intentional, not latency
            'Delay': 0,            // Intentional delay
            'PingPongDelay': 0,
            'FeedbackDelay': 0,
            'Chorus': 0,           // Usually minimal
            'Phaser': 0,
            'Flanger': 0,
            'Tremolo': 0,
            'Vibrato': 0,
            'AutoFilter': 0,
            'AutoPanner': 0,
            'AutoWah': 0,
            'Distortion': 0,
            'Chebyshev': 0,
            'BitCrusher': 0,
            'PitchShift': 5.8,    // ~5.8ms typical window-based pitch shift latency
            'FrequencyShifter': 5.8,
            'StereoWidener': 0,
            'EQ3': 0,
            'Filter': 0,
            'Convolver': 0,        // Depends on impulse, usually intentional
            'JCReverb': 0,
            'Freeverb': 0
        };
        
        for (const effect of this.activeEffects) {
            if (effect && effect.type) {
                const latency = effectLatencyMap[effect.type] || 0;
                totalLatencyMs += latency;
            }
        }
        
        return totalLatencyMs;
    }

    /**
     * Set auto delay compensation mode.
     * When enabled, delay compensation is automatically calculated from effects.
     * @param {boolean} enabled - Whether to enable auto compensation
     */
    setAutoDelayCompensation(enabled) {
        this.autoDelayCompensation = enabled;
        if (enabled) {
            const calculatedLatency = this.calculateEffectLatency();
            this.setDelayCompensation(calculatedLatency);
        }
        console.log(`[Track ${this.id}] Auto delay compensation ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get delay compensation info for UI display.
     * @returns {Object} { manual: number, calculated: number, auto: boolean, total: number }
     */
    getDelayCompensationInfo() {
        const calculated = this.calculateEffectLatency();
        const total = this.autoDelayCompensation ? calculated : this.delayCompensationMs;
        return {
            manual: this.delayCompensationMs,
            calculated: calculated,
            auto: this.autoDelayCompensation,
            total: total
        };
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

        if (this.instrumentSamplerSettings?.audioBuffer && !this.instrumentSamplerSettings.audioBuffer.disposed) { 
            try { this.instrumentSamplerSettings.audioBuffer.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing audioBuffer (InstrumentSampler):`, e.message); }
        }
        if (this.instrumentSamplerSettings) this.instrumentSamplerSettings.audioBuffer = null;

        this.sequences = [];
        this.timelineClips = [];
        this.appServices = {};
        this.inspectorControls = {};
        this.waveformCanvasCtx = null;
        this.instrumentWaveformCanvasCtx = null;

        // Dispose delay compensation node
        if (this.delayCompensationNode && !this.delayCompensationNode.disposed) {
            try { this.delayCompensationNode.dispose(); } catch(e){ console.warn(`[Track Dispose ${this.id}] Error disposing delayCompensationNode:`, e.message); }
        }
        this.delayCompensationNode = null;

        console.log(`[Track Dispose END ${this.id}] Finished disposal for track: "${trackNameForLog}"`);
    }
}
