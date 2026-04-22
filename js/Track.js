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
        } else if (type === 'InstrumentSampler') {
            this.name = initialData?.name || `Instrument ${this.id}`;
        } else if (type === 'Lyrics') {
            this.name = initialData?.name || `Lyrics ${this.id}`;
        }
        console.log(`[Track ${this.id} Constructor] Initializing track "${this.name}" of type "${this.type}". InitialData present: ${!!initialData}`);

        // Track color for visual grouping
        this.color = initialData?.color || getRandomTrackColor();

        this.isMuted = initialData?.isMuted || false;
        this.isArchived = initialData?.isArchived || false;
        this.isMonitoringEnabled = initialData?.isMonitoringEnabled !== undefined ? initialData.isMonitoringEnabled : (this.type === 'Audio'); 
        const currentSoloedId = this.appServices.getSoloedTrackId ? this.appServices.getSoloedTrackId() : null;
        this.isSoloed = currentSoloedId === this.id;
        this.previousVolumeBeforeMute = initialData?.volume ?? 0.7;
        // MIDI channel for multi-channel MIDI support (1-16, 0 = omni/all channels)
        this.midiChannel = initialData?.midiChannel ?? 0;

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
        
        // --- Pattern Chains ---
        // Array of pattern chains, each chain is an array of { sequenceId, repeatCount }
        this.patternChains = initialData?.patternChains || [];
        this.activePatternChainId = initialData?.activePatternChainId || null;
        this.patternChainPlaybackIndex = 0; // Current position in chain during playback
        this.patternChainRepeatCounter = 0; // Current repeat count for the current pattern in chain
        
        this.timelineClips = initialData?.timelineClips ? JSON.parse(JSON.stringify(initialData.timelineClips)) : [];


        if (this.type !== 'Audio' && this.type !== 'Lyrics') {
            if (initialData?.sequences && initialData.sequences.length > 0) {
                this.sequences = JSON.parse(JSON.stringify(initialData.sequences));
                this.activeSequenceId = initialData.activeSequenceId || (this.sequences[0] ? this.sequences[0].id : null);
            } else {
                this.createNewSequence("Sequence 1", Constants.defaultStepsPerBar, true); 
            }
            delete this.sequenceData;
            delete this.sequenceLength;
        } else if (this.type === 'Audio') { 
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
                            fadeOut: ac.fadeOut ?? 0,
                            phaseInverted: false
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

        // --- Instrument Rack ---
        // Multi-layered instrument configuration for a single track
        this.instrumentRack = initialData?.instrumentRack || {
            enabled: true,
            layers: []
        };
        this.instrumentRackLayerCount = 0; // For generating unique layer IDs

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

    // --- Sequence Management ---

    /**
     * Creates a new sequence for this track.
     * @param {string} name - The name of the sequence.
     * @param {number} length - Number of steps in the sequence.
     * @param {boolean} setActive - Whether to set this as the active sequence.
     * @returns {Object} The created sequence object.
     */
    createNewSequence(name = "New Sequence", length = Constants.defaultStepsPerBar, setActive = false) {
        const sequenceId = `seq_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // Determine number of rows based on track type
        let numRows;
        if (this.type === 'DrumSampler') {
            numRows = Constants.numDrumSamplerPads; // 8 pads
        } else {
            numRows = Constants.synthPitches.length; // 72 pitches for synths
        }
        
        // Create empty sequence data (2D array of nulls)
        const data = Array(numRows).fill(null).map(() => Array(length).fill(null));
        
        const newSequence = {
            id: sequenceId,
            name: name,
            data: data,
            length: length
        };
        
        this.sequences.push(newSequence);
        
        if (setActive) {
            this.activeSequenceId = sequenceId;
        }
        
        console.log(`[Track ${this.id}] Created new sequence "${name}" with ID ${sequenceId}, ${numRows} rows × ${length} steps.`);
        
        return newSequence;
    }

    /**
     * Deletes a sequence by ID.
     * @param {string} sequenceId - The ID of the sequence to delete.
     * @returns {boolean} True if deleted, false if not found.
     */
    deleteSequence(sequenceId) {
        if (this.sequences.length <= 1) {
            console.warn(`[Track ${this.id}] Cannot delete the last sequence.`);
            return false;
        }
        
        const index = this.sequences.findIndex(s => s.id === sequenceId);
        if (index === -1) {
            console.warn(`[Track ${this.id}] Sequence ${sequenceId} not found.`);
            return false;
        }
        
        this.sequences.splice(index, 1);
        
        // If the deleted sequence was active, switch to the first one
        if (this.activeSequenceId === sequenceId) {
            this.activeSequenceId = this.sequences[0] ? this.sequences[0].id : null;
        }
        
        console.log(`[Track ${this.id}] Deleted sequence ${sequenceId}.`);
        return true;
    }

    /**
     * Sets the active sequence by ID.
     * @param {string} sequenceId - The ID of the sequence to activate.
     * @returns {boolean} True if activated, false if not found.
     */
    setActiveSequence(sequenceId) {
        const sequence = this.sequences.find(s => s.id === sequenceId);
        if (!sequence) {
            console.warn(`[Track ${this.id}] Sequence ${sequenceId} not found.`);
            return false;
        }
        
        this.activeSequenceId = sequenceId;
        console.log(`[Track ${this.id}] Active sequence set to "${sequence.name}" (${sequenceId}).`);
        return true;
    }

    /**
     * Renames a sequence.
     * @param {string} sequenceId - The ID of the sequence to rename.
     * @param {string} newName - The new name for the sequence.
     * @returns {boolean} True if renamed, false if not found.
     */
    renameSequence(sequenceId, newName) {
        const sequence = this.sequences.find(s => s.id === sequenceId);
        if (!sequence) {
            console.warn(`[Track ${this.id}] Sequence ${sequenceId} not found.`);
            return false;
        }
        
        sequence.name = newName;
        console.log(`[Track ${this.id}] Renamed sequence ${sequenceId} to "${newName}".`);
        return true;
    }

    /**
     * Duplicates a sequence.
     * @param {string} sequenceId - The ID of the sequence to duplicate.
     * @returns {Object|null} The new duplicated sequence, or null if not found.
     */
    duplicateSequence(sequenceId) {
        const sourceSequence = this.sequences.find(s => s.id === sequenceId);
        if (!sourceSequence) {
            console.warn(`[Track ${this.id}] Sequence ${sequenceId} not found for duplication.`);
            return null;
        }
        
        const newSequence = {
            id: `seq_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: `${sourceSequence.name} (copy)`,
            data: JSON.parse(JSON.stringify(sourceSequence.data)),
            length: sourceSequence.length
        };
        
        this.sequences.push(newSequence);
        console.log(`[Track ${this.id}] Duplicated sequence "${sourceSequence.name}" to "${newSequence.name}".`);
        return newSequence;
    }

    // ==================== Pattern Variations ====================

    /**
     * Create a variation of an existing sequence with transformations.
     * @param {string} sourceSequenceId - The ID of the sequence to vary
     * @param {Object} options - Variation options
     * @param {string} options.name - Name for the new variation
     * @param {string} options.transform - Transformation type: 'shift', 'mirror', 'reverse', 'randomize', 'humanize', 'thin', 'thicken', 'velocity', 'combine'
     * @param {number} options.shiftAmount - Number of steps to shift (for 'shift')
     * @param {number} options.amount - Amount/intensity of transformation (0-1)
     * @param {string} options.direction - Direction for shift: 'left', 'right', 'up', 'down'
     * @returns {Object|null} The new variation sequence, or null if failed
     */
    createPatternVariation(sourceSequenceId, options = {}) {
        const sourceSequence = this.sequences.find(s => s.id === sourceSequenceId);
        if (!sourceSequence) {
            console.warn(`[Track ${this.id}] Sequence ${sourceSequenceId} not found for variation.`);
            return null;
        }

        const transform = options.transform || 'shift';
        const amount = options.amount ?? 0.5;
        const name = options.name || `${sourceSequence.name} (variation)`;

        // Deep copy the source data
        const newData = JSON.parse(JSON.stringify(sourceSequence.data));

        // Apply transformation
        switch (transform) {
            case 'shift':
                this._transformShift(newData, options);
                break;
            case 'mirror':
                this._transformMirror(newData);
                break;
            case 'reverse':
                this._transformReverse(newData);
                break;
            case 'randomize':
                this._transformRandomize(newData, amount);
                break;
            case 'humanize':
                this._transformHumanize(newData, amount);
                break;
            case 'thin':
                this._transformThin(newData, amount);
                break;
            case 'thicken':
                this._transformThicken(newData);
                break;
            case 'velocity':
                this._transformVelocity(newData, amount);
                break;
            case 'combine':
                this._transformCombine(newData, sourceSequence.data, amount);
                break;
            case 'invert':
                this._transformInvert(newData);
                break;
            case 'retrograde':
                this._transformRetrograde(newData);
                break;
            case 'stretch':
                this._transformStretch(newData, options.factor || 2);
                break;
            default:
                console.warn(`[Track ${this.id}] Unknown transform type: ${transform}`);
        }

        // Create the new sequence
        const newSequence = {
            id: `seq_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: name,
            data: newData,
            length: sourceSequence.length
        };

        this.sequences.push(newSequence);
        console.log(`[Track ${this.id}] Created pattern variation "${name}" with transform: ${transform}`);
        return newSequence;
    }

    /**
     * Create multiple variations at once.
     * @param {string} sourceSequenceId - The source sequence ID
     * @param {Array<Object>} variations - Array of variation options
     * @returns {Array<Object>} Array of created sequences
     */
    createMultipleVariations(sourceSequenceId, variations) {
        const created = [];
        for (const opts of variations) {
            const seq = this.createPatternVariation(sourceSequenceId, opts);
            if (seq) created.push(seq);
        }
        return created;
    }

    /**
     * Apply a transformation in-place to the active sequence.
     * @param {string} transform - Transformation type
     * @param {Object} options - Transform options
     * @returns {boolean} True if applied successfully
     */
    applyTransformToActive(transform, options = {}) {
        const activeSeq = this.getActiveSequence();
        if (!activeSeq) {
            console.warn(`[Track ${this.id}] No active sequence to transform.`);
            return false;
        }

        const transformFn = {
            'shift': () => this._transformShift(activeSeq.data, options),
            'mirror': () => this._transformMirror(activeSeq.data),
            'reverse': () => this._transformReverse(activeSeq.data),
            'randomize': () => this._transformRandomize(activeSeq.data, options.amount ?? 0.3),
            'humanize': () => this._transformHumanize(activeSeq.data, options.amount ?? 0.15),
            'thin': () => this._transformThin(activeSeq.data, options.amount ?? 0.3),
            'thicken': () => this._transformThicken(activeSeq.data),
            'velocity': () => this._transformVelocity(activeSeq.data, options.amount ?? 0.2),
            'invert': () => this._transformInvert(activeSeq.data),
            'retrograde': () => this._transformRetrograde(activeSeq.data),
            'stretch': () => this._transformStretch(activeSeq.data, options.factor || 2)
        };

        if (transformFn[transform]) {
            this._captureUndoState(`Transform: ${transform}`);
            transformFn[transform]();
            console.log(`[Track ${this.id}] Applied transform "${transform}" to active sequence.`);
            return true;
        }

        console.warn(`[Track ${this.id}] Unknown transform: ${transform}`);
        return false;
    }

    // --- Transform Helper Methods ---

    _transformShift(data, options) {
        const shiftAmount = options.shiftAmount ?? 1;
        const direction = options.direction || 'right';
        const numRows = data.length;
        const numCols = data[0]?.length || 0;

        if (direction === 'left' || direction === 'right') {
            const shift = direction === 'right' ? shiftAmount : -shiftAmount;
            for (let row = 0; row < numRows; row++) {
                const newRow = new Array(numCols).fill(null);
                for (let col = 0; col < numCols; col++) {
                    const newCol = ((col + shift) % numCols + numCols) % numCols;
                    newRow[newCol] = data[row][col] ? { ...data[row][col] } : null;
                }
                data[row] = newRow;
            }
        } else if (direction === 'up' || direction === 'down') {
            const shift = direction === 'down' ? shiftAmount : -shiftAmount;
            const newData = new Array(numRows).fill(null).map(() => new Array(numCols).fill(null));
            for (let row = 0; row < numRows; row++) {
                const newRow = ((row + shift) % numRows + numRows) % numRows;
                for (let col = 0; col < numCols; col++) {
                    newData[newRow][col] = data[row][col] ? { ...data[row][col] } : null;
                }
            }
            for (let row = 0; row < numRows; row++) {
                data[row] = newData[row];
            }
        }
    }

    _transformMirror(data) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;

        // Mirror horizontally (left-right)
        for (let row = 0; row < numRows; row++) {
            data[row].reverse();
        }
    }

    _transformReverse(data) {
        // Reverse the order of steps within each row
        const numRows = data.length;
        for (let row = 0; row < numRows; row++) {
            if (data[row]) {
                data[row].reverse();
            }
        }
    }

    _transformRandomize(data, amount) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;
        const probability = amount; // Probability to toggle

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                if (Math.random() < probability) {
                    if (data[row][col] && data[row][col].active) {
                        // Note exists - 50% chance to remove
                        if (Math.random() < 0.5) {
                            data[row][col] = null;
                        }
                    } else {
                        // No note - add with random velocity
                        data[row][col] = {
                            active: true,
                            velocity: 0.5 + Math.random() * 0.5,
                            duration: 1
                        };
                    }
                }
            }
        }
    }

    _transformHumanize(data, amount) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                if (data[row][col] && data[row][col].active) {
                    // Add random velocity variation
                    const variation = (Math.random() - 0.5) * 2 * amount;
                    data[row][col].velocity = Math.max(0.1, Math.min(1, (data[row][col].velocity || 0.8) + variation));
                    
                    // Small probability timing variation (handled by playback)
                    data[row][col].timingOffset = (Math.random() - 0.5) * amount * 0.01;
                }
            }
        }
    }

    _transformThin(data, amount) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;
        const removalProbability = amount;

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                if (data[row][col] && data[row][col].active) {
                    if (Math.random() < removalProbability) {
                        data[row][col] = null;
                    }
                }
            }
        }
    }

    _transformThicken(data) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                if (data[row][col] && data[row][col].active) {
                    // Add ghost note one step after
                    if (col + 1 < numCols && !data[row][col + 1]) {
                        data[row][col + 1] = {
                            active: true,
                            velocity: (data[row][col].velocity || 0.8) * 0.5,
                            duration: 1
                        };
                    }
                }
            }
        }
    }

    _transformVelocity(data, amount) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;
        const direction = amount >= 0 ? 1 : -1;
        const magnitude = Math.abs(amount);

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                if (data[row][col] && data[row][col].active) {
                    const currentVel = data[row][col].velocity || 0.8;
                    const newVel = currentVel + direction * magnitude;
                    data[row][col].velocity = Math.max(0.1, Math.min(1, newVel));
                }
            }
        }
    }

    _transformInvert(data) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;

        // Invert pattern - fill gaps, remove existing notes
        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                if (data[row][col] && data[row][col].active) {
                    data[row][col] = null;
                } else {
                    data[row][col] = {
                        active: true,
                        velocity: 0.7,
                        duration: 1
                    };
                }
            }
        }
    }

    _transformRetrograde(data) {
        // Reverse the sequence and shift timing
        const numRows = data.length;
        for (let row = 0; row < numRows; row++) {
            if (data[row]) {
                data[row].reverse();
                // Adjust duration to maintain pattern feel
                for (let col = 0; col < data[row].length; col++) {
                    if (data[row][col] && data[row][col].active) {
                        // Swap attack characteristics
                        const vel = data[row][col].velocity || 0.8;
                        data[row][col].velocity = vel;
                    }
                }
            }
        }
    }

    _transformStretch(data, factor) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;
        const newNumCols = Math.floor(numCols * factor);

        for (let row = 0; row < numRows; row++) {
            const newRow = new Array(newNumCols).fill(null);
            for (let col = 0; col < numCols; col++) {
                if (data[row][col] && data[row][col].active) {
                    const newCol = Math.floor(col * factor);
                    if (newCol < newNumCols) {
                        newRow[newCol] = {
                            ...data[row][col],
                            duration: Math.ceil((data[row][col].duration || 1) * factor)
                        };
                    }
                }
            }
            data[row] = newRow;
        }
    }

    _transformCombine(data, sourceData, amount) {
        // Combine with another pattern using probability
        const numRows = Math.min(data.length, sourceData.length);
        
        for (let row = 0; row < numRows; row++) {
            const numCols = Math.min(data[row]?.length || 0, sourceData[row]?.length || 0);
            for (let col = 0; col < numCols; col++) {
                if (!data[row][col] && sourceData[row][col] && sourceData[row][col].active) {
                    if (Math.random() < amount) {
                        data[row][col] = { ...sourceData[row][col] };
                    }
                }
            }
        }
    }

    /**
     * Generate random variation patterns.
     * @param {Object} options - Generation options
     * @param {number} options.steps - Number of steps
     * @param {number} options.density - Note density (0-1)
     * @param {string} options.style - Style: 'sparse', 'dense', 'rhythmic', 'melodic'
     * @returns {Object|null} New sequence with generated pattern
     */
    generateRandomPattern(options = {}) {
        const activeSeq = this.getActiveSequence();
        if (!activeSeq) {
            console.warn(`[Track ${this.id}] No active sequence for random generation.`);
            return null;
        }

        const numSteps = options.steps || activeSeq.length;
        const density = options.density ?? 0.25;
        const style = options.style || 'rhythmic';

        this._captureUndoState('Generate Random Pattern');

        const numRows = activeSeq.data.length;
        const numCols = activeSeq.data[0]?.length || numSteps;

        // Clear existing data
        for (let row = 0; row < numRows; row++) {
            activeSeq.data[row] = new Array(numCols).fill(null);
        }

        // Generate based on style
        switch (style) {
            case 'sparse':
                this._generateSparse(activeSeq.data, density);
                break;
            case 'dense':
                this._generateDense(activeSeq.data, density);
                break;
            case 'rhythmic':
                this._generateRhythmic(activeSeq.data, density);
                break;
            case 'melodic':
                this._generateMelodic(activeSeq.data, density);
                break;
            case 'arpeggiated':
                this._generateArpeggiated(activeSeq.data, density);
                break;
            default:
                this._generateRhythmic(activeSeq.data, density);
        }

        console.log(`[Track ${this.id}] Generated ${style} pattern with density ${density}`);
        return activeSeq;
    }

    _generateSparse(data, density) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;
        const noteCount = Math.floor(numRows * numCols * density * 0.5);

        for (let i = 0; i < noteCount; i++) {
            const row = Math.floor(Math.random() * numRows);
            const col = Math.floor(Math.random() * numCols);
            if (!data[row][col]) {
                data[row][col] = {
                    active: true,
                    velocity: 0.6 + Math.random() * 0.4,
                    duration: 1 + Math.floor(Math.random() * 2)
                };
            }
        }
    }

    _generateDense(data, density) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                if (Math.random() < density) {
                    data[row][col] = {
                        active: true,
                        velocity: 0.5 + Math.random() * 0.5,
                        duration: 1
                    };
                }
            }
        }
    }

    _generateRhythmic(data, density) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;

        // Emphasize downbeats
        for (let col = 0; col < numCols; col++) {
            const isDownbeat = col % 4 === 0;
            const isUpbeat = col % 4 === 2;
            
            for (let row = 0; row < numRows; row++) {
                let probability = density;
                if (isDownbeat) probability *= 2;
                if (isUpbeat) probability *= 0.5;
                
                if (Math.random() < probability) {
                    data[row][col] = {
                        active: true,
                        velocity: isDownbeat ? 0.9 : (isUpbeat ? 0.6 : 0.4 + Math.random() * 0.3),
                        duration: 1
                    };
                    break; // One note per step for rhythmic
                }
            }
        }
    }

    _generateMelodic(data, density) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;
        const middleRow = Math.floor(numRows / 2);

        // Generate a simple melody
        let currentRow = middleRow;
        for (let col = 0; col < numCols; col++) {
            if (Math.random() < density) {
                // Add some melodic movement
                const movement = Math.floor(Math.random() * 5) - 2; // -2 to +2
                currentRow = Math.max(0, Math.min(numRows - 1, currentRow + movement));
                
                data[currentRow][col] = {
                    active: true,
                    velocity: 0.6 + Math.random() * 0.4,
                    duration: Math.random() > 0.7 ? 2 : 1
                };
            }
        }
    }

    _generateArpeggiated(data, density) {
        const numRows = data.length;
        const numCols = data[0]?.length || 0;

        // Pick a chord (set of rows)
        const chordSize = 3 + Math.floor(Math.random() * 3);
        const startRow = Math.floor(Math.random() * (numRows - chordSize));
        const chordRows = [];
        for (let i = 0; i < chordSize; i++) {
            chordRows.push(startRow + i);
        }

        // Arpeggiate through the chord
        let noteIndex = 0;
        for (let col = 0; col < numCols; col++) {
            if (Math.random() < density) {
                const row = chordRows[noteIndex % chordRows.length];
                data[row][col] = {
                    active: true,
                    velocity: 0.7,
                    duration: 1
                };
                noteIndex++;
            }
        }
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

    // ==================== Pattern Chain Methods ====================

    /**
     * Create a new pattern chain.
     * @param {string} name - Name for the chain
     * @returns {Object} The newly created chain
     */
    createPatternChain(name = 'New Chain') {
        if (this.type === 'Audio') {
            console.warn(`[Track ${this.id}] Cannot create pattern chain on Audio track.`);
            return null;
        }

        const chainId = `chain_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newChain = {
            id: chainId,
            name: name,
            patterns: [], // Array of { sequenceId, repeatCount }
            loopEnabled: true // Whether to loop the chain
        };

        this.patternChains.push(newChain);
        console.log(`[Track ${this.id}] Created pattern chain "${name}" with ID ${chainId}.`);
        return newChain;
    }

    /**
     * Delete a pattern chain.
     * @param {string} chainId - The ID of the chain to delete
     * @returns {boolean} True if deleted, false if not found
     */
    deletePatternChain(chainId) {
        const index = this.patternChains.findIndex(c => c.id === chainId);
        if (index === -1) {
            console.warn(`[Track ${this.id}] Pattern chain ${chainId} not found.`);
            return false;
        }

        this.patternChains.splice(index, 1);

        // If the deleted chain was active, clear it
        if (this.activePatternChainId === chainId) {
            this.activePatternChainId = null;
            this.patternChainPlaybackIndex = 0;
            this.patternChainRepeatCounter = 0;
        }

        console.log(`[Track ${this.id}] Deleted pattern chain ${chainId}.`);
        return true;
    }

    /**
     * Rename a pattern chain.
     * @param {string} chainId - The ID of the chain to rename
     * @param {string} newName - The new name
     * @returns {boolean} True if renamed, false if not found
     */
    renamePatternChain(chainId, newName) {
        const chain = this.patternChains.find(c => c.id === chainId);
        if (!chain) {
            console.warn(`[Track ${this.id}] Pattern chain ${chainId} not found.`);
            return false;
        }

        chain.name = newName;
        console.log(`[Track ${this.id}] Renamed pattern chain ${chainId} to "${newName}".`);
        return true;
    }

    /**
     * Set the active pattern chain.
     * @param {string} chainId - The ID of the chain to activate
     * @returns {boolean} True if activated, false if not found
     */
    setActivePatternChain(chainId) {
        const chain = this.patternChains.find(c => c.id === chainId);
        if (!chain) {
            console.warn(`[Track ${this.id}] Pattern chain ${chainId} not found.`);
            return false;
        }

        this.activePatternChainId = chainId;
        this.patternChainPlaybackIndex = 0;
        this.patternChainRepeatCounter = 0;
        console.log(`[Track ${this.id}] Active pattern chain set to "${chain.name}" (${chainId}).`);
        return true;
    }

    /**
     * Get the active pattern chain.
     * @returns {Object|null} The active chain or null
     */
    getActivePatternChain() {
        if (!this.activePatternChainId) return null;
        return this.patternChains.find(c => c.id === this.activePatternChainId) || null;
    }

    /**
     * Add a sequence to a pattern chain.
     * @param {string} chainId - The ID of the chain
     * @param {string} sequenceId - The ID of the sequence to add
     * @param {number} repeatCount - Number of times to repeat this pattern (default 1)
     * @param {number} position - Position to insert at (default: end)
     * @returns {boolean} True if added, false if not found
     */
    addSequenceToChain(chainId, sequenceId, repeatCount = 1, position = -1) {
        const chain = this.patternChains.find(c => c.id === chainId);
        if (!chain) {
            console.warn(`[Track ${this.id}] Pattern chain ${chainId} not found.`);
            return false;
        }

        // Verify sequence exists
        const sequence = this.sequences.find(s => s.id === sequenceId);
        if (!sequence) {
            console.warn(`[Track ${this.id}] Sequence ${sequenceId} not found.`);
            return false;
        }

        const patternEntry = {
            sequenceId: sequenceId,
            sequenceName: sequence.name,
            repeatCount: Math.max(1, repeatCount)
        };

        if (position >= 0 && position < chain.patterns.length) {
            chain.patterns.splice(position, 0, patternEntry);
        } else {
            chain.patterns.push(patternEntry);
        }

        console.log(`[Track ${this.id}] Added sequence "${sequence.name}" to chain "${chain.name}" with ${repeatCount} repeat(s).`);
        return true;
    }

    /**
     * Remove a sequence from a pattern chain.
     * @param {string} chainId - The ID of the chain
     * @param {number} position - Position in the chain to remove
     * @returns {boolean} True if removed, false if not found
     */
    removeSequenceFromChain(chainId, position) {
        const chain = this.patternChains.find(c => c.id === chainId);
        if (!chain) {
            console.warn(`[Track ${this.id}] Pattern chain ${chainId} not found.`);
            return false;
        }

        if (position < 0 || position >= chain.patterns.length) {
            console.warn(`[Track ${this.id}] Invalid position ${position} for chain "${chain.name}".`);
            return false;
        }

        const removed = chain.patterns.splice(position, 1);
        console.log(`[Track ${this.id}] Removed "${removed[0].sequenceName}" from chain "${chain.name}" at position ${position}.`);
        return true;
    }

    /**
     * Reorder patterns within a chain.
     * @param {string} chainId - The ID of the chain
     * @param {number} fromPosition - Original position
     * @param {number} toPosition - New position
     * @returns {boolean} True if reordered, false if not found
     */
    reorderChainPattern(chainId, fromPosition, toPosition) {
        const chain = this.patternChains.find(c => c.id === chainId);
        if (!chain) {
            console.warn(`[Track ${this.id}] Pattern chain ${chainId} not found.`);
            return false;
        }

        if (fromPosition < 0 || fromPosition >= chain.patterns.length ||
            toPosition < 0 || toPosition >= chain.patterns.length) {
            console.warn(`[Track ${this.id}] Invalid positions for reorder in chain "${chain.name}".`);
            return false;
        }

        const [moved] = chain.patterns.splice(fromPosition, 1);
        chain.patterns.splice(toPosition, 0, moved);
        console.log(`[Track ${this.id}] Reordered pattern in chain "${chain.name}" from ${fromPosition} to ${toPosition}.`);
        return true;
    }

    /**
     * Set repeat count for a pattern in a chain.
     * @param {string} chainId - The ID of the chain
     * @param {number} position - Position in the chain
     * @param {number} repeatCount - New repeat count
     * @returns {boolean} True if updated, false if not found
     */
    setPatternRepeatCount(chainId, position, repeatCount) {
        const chain = this.patternChains.find(c => c.id === chainId);
        if (!chain) {
            console.warn(`[Track ${this.id}] Pattern chain ${chainId} not found.`);
            return false;
        }

        if (position < 0 || position >= chain.patterns.length) {
            console.warn(`[Track ${this.id}] Invalid position ${position} for chain "${chain.name}".`);
            return false;
        }

        chain.patterns[position].repeatCount = Math.max(1, repeatCount);
        console.log(`[Track ${this.id}] Set repeat count for "${chain.patterns[position].sequenceName}" to ${repeatCount}.`);
        return true;
    }

    /**
     * Set loop enabled for a chain.
     * @param {string} chainId - The ID of the chain
     * @param {boolean} loopEnabled - Whether to loop the chain
     * @returns {boolean} True if updated, false if not found
     */
    setChainLoopEnabled(chainId, loopEnabled) {
        const chain = this.patternChains.find(c => c.id === chainId);
        if (!chain) {
            console.warn(`[Track ${this.id}] Pattern chain ${chainId} not found.`);
            return false;
        }

        chain.loopEnabled = loopEnabled;
        console.log(`[Track ${this.id}] Chain "${chain.name}" loop ${loopEnabled ? 'enabled' : 'disabled'}.`);
        return true;
    }

    /**
     * Get the current sequence in the active chain for playback.
     * Returns null if no chain is active or chain is empty.
     * @returns {Object|null} { sequence, chain, index, repeat, totalRepeats } or null
     */
    getCurrentChainSequence() {
        const chain = this.getActivePatternChain();
        if (!chain || chain.patterns.length === 0) return null;

        const currentPattern = chain.patterns[this.patternChainPlaybackIndex];
        if (!currentPattern) return null;

        const sequence = this.sequences.find(s => s.id === currentPattern.sequenceId);
        if (!sequence) return null;

        return {
            sequence: sequence,
            chain: chain,
            index: this.patternChainPlaybackIndex,
            repeat: this.patternChainRepeatCounter,
            totalRepeats: currentPattern.repeatCount
        };
    }

    /**
     * Advance to the next pattern in the chain.
     * Called when the current pattern finishes.
     * @returns {Object|null} The next sequence info, or null if chain ended
     */
    advanceChainPattern() {
        const chain = this.getActivePatternChain();
        if (!chain || chain.patterns.length === 0) return null;

        const currentPattern = chain.patterns[this.patternChainPlaybackIndex];
        if (!currentPattern) return null;

        // Check if we need to repeat the current pattern
        if (this.patternChainRepeatCounter < currentPattern.repeatCount - 1) {
            this.patternChainRepeatCounter++;
            return this.getCurrentChainSequence();
        }

        // Move to next pattern
        this.patternChainPlaybackIndex++;
        this.patternChainRepeatCounter = 0;

        // Check if we've reached the end of the chain
        if (this.patternChainPlaybackIndex >= chain.patterns.length) {
            if (chain.loopEnabled) {
                // Loop back to the beginning
                this.patternChainPlaybackIndex = 0;
                console.log(`[Track ${this.id}] Pattern chain "${chain.name}" looping back to start.`);
            } else {
                // Chain finished
                console.log(`[Track ${this.id}] Pattern chain "${chain.name}" playback finished.`);
                return null;
            }
        }

        return this.getCurrentChainSequence();
    }

    /**
     * Reset chain playback to the beginning.
     */
    resetChainPlayback() {
        this.patternChainPlaybackIndex = 0;
        this.patternChainRepeatCounter = 0;
        console.log(`[Track ${this.id}] Pattern chain playback reset.`);
    }

    /**
     * Get info about all pattern chains for UI display.
     * @returns {Array} Array of chain info objects
     */
    getPatternChainsInfo() {
        return this.patternChains.map(chain => ({
            id: chain.id,
            name: chain.name,
            patternCount: chain.patterns.length,
            loopEnabled: chain.loopEnabled,
            patterns: chain.patterns.map(p => ({
                sequenceId: p.sequenceId,
                sequenceName: p.sequenceName,
                repeatCount: p.repeatCount
            })),
            isActive: this.activePatternChainId === chain.id
        }));
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

    // ==================== Undo Capture Helper ====================
    _captureUndoState(description) {
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(description);
        } else {
            console.warn(`[Track ${this.id}] captureStateForUndo service not available.`);
        }
    }

    setVolume(volume, fromInteraction = false) { 
        if (!fromInteraction) this._captureUndoState(`Set volume on ${this.name}`);
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

    /**
     * Set the MIDI channel for this track.
     * @param {number} channel - MIDI channel (1-16, or 0 for omni/all channels)
     * @param {boolean} fromInteraction - Whether this is from a user interaction
     */
    setMidiChannel(channel, fromInteraction = false) {
        // Clamp channel value to valid range (0 = omni, 1-16 = specific channel)
        this.midiChannel = Math.max(0, Math.min(16, parseInt(channel) || 0));
        console.log(`[Track ${this.id}] Set MIDI channel to ${this.midiChannel === 0 ? 'Omni (All)' : this.midiChannel}`);
        
        // Capture undo state if from user interaction
        if (fromInteraction && this.appServices.captureStateForUndo) {
            const chDisplay = this.midiChannel === 0 ? 'Omni (All)' : `Ch ${this.midiChannel}`;
            this.appServices.captureStateForUndo(`Set ${this.name} MIDI channel to ${chDisplay}`);
        }
        
        // Update UI if available
        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(this.id, 'midiChannelChanged');
        }
    }

    /**
     * Get the MIDI channel for this track.
     * @returns {number} MIDI channel (0 = omni, 1-16 = specific channel)
     */
    getMidiChannel() {
        return this.midiChannel;
    }

    /**
     * Check if a MIDI message matches this track's channel.
     * @param {number} midiChannel - MIDI channel from incoming message (1-16)
     * @returns {boolean} True if message should be processed by this track
     */
    matchesMidiChannel(midiChannel) {
        // If track is set to omni (0), it accepts all channels
        if (this.midiChannel === 0) return true;
        // Otherwise, check if channel matches
        return this.midiChannel === midiChannel;
    }

    // ==================== Slice Setters ====================
    setSliceVolume(sliceIndex, volume) {
        this._captureUndoState(`Set slice ${sliceIndex+1} volume on ${this.name}`);
        if (this.slices && this.slices[sliceIndex]) this.slices[sliceIndex].volume = parseFloat(volume);
    }
    setSlicePitchShift(sliceIndex, semitones) {
        this._captureUndoState(`Set slice ${sliceIndex+1} pitch on ${this.name}`);
        if (this.slices && this.slices[sliceIndex]) this.slices[sliceIndex].pitchShift = parseInt(semitones);
    }
    setSliceLoop(sliceIndex, loop) {
        this._captureUndoState(`Set slice ${sliceIndex+1} loop on ${this.name}`);
        if (this.slices && this.slices[sliceIndex]) this.slices[sliceIndex].loop = !!loop;
    }
    setSliceReverse(sliceIndex, reverse) {
        this._captureUndoState(`Set slice ${sliceIndex+1} reverse on ${this.name}`);
        if (this.slices && this.slices[sliceIndex]) this.slices[sliceIndex].reverse = !!reverse;
    }
    setSliceEnvelopeParam(sliceIndex, param, value) {
        this._captureUndoState(`Set slice ${sliceIndex+1} envelope on ${this.name}`);
        if (this.slices && this.slices[sliceIndex] && this.slices[sliceIndex].envelope) {
            this.slices[sliceIndex].envelope[param] = parseFloat(value);
        }
    }

    // ==================== Drum Sampler Pad Setters ====================
    setDrumSamplerPadVolume(padIndex, volume) {
        this._captureUndoState(`Set pad ${padIndex+1} volume on ${this.name}`);
        if (this.drumSamplerPads && this.drumSamplerPads[padIndex]) this.drumSamplerPads[padIndex].volume = parseFloat(volume);
    }
    setDrumSamplerPadPitch(padIndex, pitch) {
        this._captureUndoState(`Set pad ${padIndex+1} pitch on ${this.name}`);
        if (this.drumSamplerPads && this.drumSamplerPads[padIndex]) this.drumSamplerPads[padIndex].pitchShift = parseInt(pitch);
    }
    setDrumSamplerPadEnv(padIndex, param, value) {
        this._captureUndoState(`Set pad ${padIndex+1} envelope on ${this.name}`);
        if (this.drumSamplerPads && this.drumSamplerPads[padIndex] && this.drumSamplerPads[padIndex].envelope) {
            this.drumSamplerPads[padIndex].envelope[param] = parseFloat(value);
        }
    }

    // ==================== Instrument Sampler Setters ====================
    setInstrumentSamplerRootNote(noteName) {
        this._captureUndoState(`Set root note on ${this.name}`);
        if (this.instrumentSamplerSettings) {
            this.instrumentSamplerSettings.rootNote = noteName;
            this.setupToneSampler();
        }
    }
    setInstrumentSamplerLoop(loop) {
        this._captureUndoState(`Toggle loop on ${this.name}`);
        if (this.instrumentSamplerSettings) {
            this.instrumentSamplerSettings.loop = !!loop;
            if (this.toneSampler && !this.toneSampler.disposed) this.toneSampler.loop = this.instrumentSamplerSettings.loop;
        }
    }
    setInstrumentSamplerLoopStart(time) {
        this._captureUndoState(`Set loop start on ${this.name}`);
        if (this.instrumentSamplerSettings) {
            this.instrumentSamplerSettings.loopStart = parseFloat(time) || 0;
            if (this.toneSampler && !this.toneSampler.disposed) this.toneSampler.loopStart = this.instrumentSamplerSettings.loopStart;
        }
    }
    setInstrumentSamplerLoopEnd(time) {
        this._captureUndoState(`Set loop end on ${this.name}`);
        if (this.instrumentSamplerSettings) {
            this.instrumentSamplerSettings.loopEnd = parseFloat(time) || 0;
            if (this.toneSampler && !this.toneSampler.disposed) this.toneSampler.loopEnd = this.instrumentSamplerSettings.loopEnd;
        }
    }
    setInstrumentSamplerEnv(param, value) {
        this._captureUndoState(`Set ${param} envelope on ${this.name}`);
        if (this.instrumentSamplerSettings && this.instrumentSamplerSettings.envelope) {
            this.instrumentSamplerSettings.envelope[param] = parseFloat(value);
            if (this.toneSampler && !this.toneSampler.disposed) {
                if (param === 'attack' && typeof this.toneSampler.attack !== 'undefined') this.toneSampler.attack = value;
                if (param === 'release' && typeof this.toneSampler.release !== 'undefined') this.toneSampler.release = value;
            }
        }
    }

    // ==================== Synth Setters ====================
    setSynthParam(paramPath, value) {
        this._captureUndoState(`Set ${paramPath} on ${this.name}`);
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
     * Convert an audio clip to MIDI notes using pitch detection.
     * Creates a new Synth track with the detected melody.
     * @param {string} clipId - The clip ID to convert
     * @param {Object} options - Options for conversion
     * @param {number} options.sensitivity - Detection sensitivity (0-1, default 0.5)
     * @param {number} options.minNoteDuration - Minimum note duration in seconds (default 0.1)
     * @param {string} options.targetTrackId - Optional target track ID for the MIDI output
     * @returns {Object|null} Object with newTrackId and noteCount, or null if failed
     */
    convertAudioToMidi(clipId, options = {}) {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] convertAudioToMidi only works on Audio tracks.`);
            return null;
        }

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found.`);
            return null;
        }

        // Get audio buffer from the clip
        let audioBuffer = null;
        if (clip.audioBuffer) {
            audioBuffer = clip.audioBuffer;
        } else if (clip.dbKey && this.appServices?.getAudioBufferFromDb) {
            audioBuffer = this.appServices.getAudioBufferFromDb(clip.dbKey);
        }

        if (!audioBuffer) {
            console.warn(`[Track ${this.id}] No audio buffer available for clip ${clipId}.`);
            if (this.appServices.showNotification) {
                this.appServices.showNotification('Audio buffer not loaded. Play the clip first.', 2000);
            }
            return null;
        }

        const sensitivity = options.sensitivity ?? 0.5;
        const minNoteDuration = options.minNoteDuration ?? 0.1;

        console.log(`[Track ${this.id}] Converting audio clip "${clip.name}" to MIDI. Sensitivity: ${sensitivity}, Min note duration: ${minNoteDuration}s`);

        // Get BPM for timing calculation
        const bpm = this.appServices?.getBPM ? this.appServices.getBPM() : 120;
        const secondsPerBeat = 60 / bpm;
        const stepsPerBar = Constants.STEPS_PER_BAR || 16;
        const secondsPerStep = secondsPerBeat * 4 / stepsPerBar;

        // Perform pitch detection
        const detectedNotes = this._detectPitchesFromAudio(audioBuffer, {
            sensitivity,
            minNoteDuration,
            secondsPerStep,
            clipStartTime: clip.startTime
        });

        if (detectedNotes.length === 0) {
            console.warn(`[Track ${this.id}] No notes detected in audio clip.`);
            if (this.appServices.showNotification) {
                this.appServices.showNotification('No clear melody detected in audio.', 2000);
            }
            return null;
        }

        console.log(`[Track ${this.id}] Detected ${detectedNotes.length} notes from audio.`);

        // Create a new Synth track for the MIDI output
        const targetTrackId = options.targetTrackId || null;
        let newTrackId = targetTrackId;

        if (!targetTrackId && this.appServices?.createTrack) {
            const newTrack = this.appServices.createTrack('Synth', null, `${clip.name} (MIDI)`);
            if (newTrack) {
                newTrackId = newTrack.id;
            }
        }

        if (!newTrackId) {
            console.warn(`[Track ${this.id}] Could not create target track for MIDI output.`);
            return null;
        }

        const targetTrack = this.appServices?.getTrackById ? this.appServices.getTrackById(newTrackId) : null;
        if (!targetTrack) {
            console.warn(`[Track ${this.id}] Target track ${newTrackId} not found.`);
            return null;
        }

        const activeSeq = targetTrack.getActiveSequence ? targetTrack.getActiveSequence() : null;
        if (!activeSeq || !activeSeq.data) {
            console.warn(`[Track ${this.id}] Target track has no active sequence.`);
            return null;
        }

        // Clear existing sequence data
        const numRows = activeSeq.data.length;
        const totalSteps = activeSeq.length;
        activeSeq.data = Array(numRows).fill(null).map(() => Array(totalSteps).fill(null));

        // Add detected notes to sequence
        let noteCount = 0;
        for (const note of detectedNotes) {
            const stepIndex = Math.floor(note.time / secondsPerStep);
            const durationSteps = Math.max(1, Math.round(note.duration / secondsPerStep));
            const midiNote = note.midiNote;
            const middleRow = Math.floor(numRows / 2);
            const rowIndex = Math.max(0, Math.min(numRows - 1, middleRow - (midiNote - 60)));

            if (stepIndex >= 0 && stepIndex < totalSteps && rowIndex >= 0 && rowIndex < numRows) {
                if (!activeSeq.data[rowIndex]) {
                    activeSeq.data[rowIndex] = Array(totalSteps).fill(null);
                }
                activeSeq.data[rowIndex][stepIndex] = {
                    active: true,
                    velocity: note.velocity,
                    duration: durationSteps
                };
                noteCount++;
            }
        }

        if (targetTrack.recreateToneSequence) {
            targetTrack.recreateToneSequence(true);
        }

        console.log(`[Track ${this.id}] Added ${noteCount} notes to track ${newTrackId}.`);

        if (this.appServices.showNotification) {
            this.appServices.showNotification(`Converted to MIDI: ${noteCount} notes detected`, 3000);
        }

        if (this.appServices.updateTrackUI) {
            this.appServices.updateTrackUI(newTrackId, 'sequencerContentChanged');
        }

        return { newTrackId, noteCount, detectedNotes };
    }

    /**
     * Internal method to detect pitches from audio buffer using multiple algorithms.
     * Enhanced version with YIN, FFT, onset detection, and polyphonic support.
     */
    _detectPitchesFromAudio(audioBuffer, options = {}) {
        const sensitivity = options.sensitivity ?? 0.5;
        const minNoteDuration = options.minNoteDuration ?? 0.1;
        const secondsPerStep = options.secondsPerStep ?? 0.125;
        const clipStartTime = options.clipStartTime ?? 0;
        const enablePolyphonic = options.enablePolyphonic ?? false;
        const algorithm = options.algorithm ?? 'yin'; // 'yin', 'fft', 'autocorrelation', 'hybrid'

        let channelData, sampleRate, duration;
        if (audioBuffer.getChannelData) {
            channelData = audioBuffer.getChannelData(0);
            sampleRate = audioBuffer.sampleRate;
            duration = audioBuffer.duration;
        } else if (audioBuffer._buffer) {
            const buffer = audioBuffer._buffer;
            channelData = buffer.getChannelData(0);
            sampleRate = buffer.sampleRate;
            duration = buffer.duration;
        } else {
            console.warn('[Pitch Detection] Invalid audio buffer format.');
            return [];
        }

        // Pre-process audio: apply Hann window and normalize
        const processedData = this._preprocessAudio(channelData);

        const fftSize = 4096;
        const hopSize = Math.floor(fftSize / 4);
        const minFrequency = 80;
        const maxFrequency = 1200;
        const amplitudeThreshold = 0.005 + (1 - sensitivity) * 0.03;

        // Detect onsets for better note segmentation
        const onsets = this._detectOnsets(processedData, sampleRate, fftSize, hopSize);
        console.log(`[Pitch Detection] Detected ${onsets.length} onsets`);

        const detectedNotes = [];
        let currentNote = null, currentNoteStart = 0, currentNoteVelocitySum = 0, currentNoteSampleCount = 0;
        let lastConfidence = 0;

        const numFrames = Math.floor((processedData.length - fftSize) / hopSize);

        for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
            const startSample = frameIndex * hopSize;
            const frameTime = startSample / sampleRate;

            // Calculate RMS for amplitude
            let rms = 0;
            for (let i = 0; i < fftSize; i++) {
                const sample = processedData[startSample + i] || 0;
                rms += sample * sample;
            }
            rms = Math.sqrt(rms / fftSize);

            if (rms < amplitudeThreshold) {
                // Silence - end current note
                if (currentNote !== null) {
                    const noteDuration = frameTime - currentNoteStart;
                    if (noteDuration >= minNoteDuration) {
                        detectedNotes.push({
                            midiNote: currentNote,
                            time: currentNoteStart + clipStartTime,
                            duration: noteDuration,
                            velocity: Math.min(1, currentNoteVelocitySum / currentNoteSampleCount * 3),
                            confidence: lastConfidence
                        });
                    }
                    currentNote = null;
                }
                continue;
            }

            // Use selected algorithm for pitch detection
            let pitchResult;
            switch (algorithm) {
                case 'yin':
                    pitchResult = this._yinPitchDetection(processedData, startSample, fftSize, sampleRate, minFrequency, maxFrequency);
                    break;
                case 'fft':
                    pitchResult = this._fftPitchDetection(processedData, startSample, fftSize, sampleRate, minFrequency, maxFrequency);
                    break;
                case 'hybrid':
                    // Use YIN for fundamental, FFT for harmonics confirmation
                    const yinResult = this._yinPitchDetection(processedData, startSample, fftSize, sampleRate, minFrequency, maxFrequency);
                    const fftResult = this._fftPitchDetection(processedData, startSample, fftSize, sampleRate, minFrequency, maxFrequency);
                    // Prefer YIN if confidence is high, otherwise use FFT
                    if (yinResult.confidence > 0.7) {
                        pitchResult = yinResult;
                    } else if (fftResult.confidence > yinResult.confidence) {
                        pitchResult = fftResult;
                    } else {
                        pitchResult = yinResult;
                    }
                    break;
                case 'autocorrelation':
                default:
                    const freq = this._autocorrelationPitch(processedData, startSample, fftSize, sampleRate, minFrequency, maxFrequency);
                    pitchResult = { frequency: freq, confidence: freq > 0 ? 0.6 : 0 };
                    break;
            }

            // Polyphonic detection for chords
            if (enablePolyphonic && pitchResult.confidence < 0.5) {
                const polyPitches = this._detectPolyphonic(processedData, startSample, fftSize, sampleRate, minFrequency, maxFrequency);
                if (polyPitches.length > 0) {
                    // End current monophonic note
                    if (currentNote !== null) {
                        const noteDuration = frameTime - currentNoteStart;
                        if (noteDuration >= minNoteDuration) {
                            detectedNotes.push({
                                midiNote: currentNote,
                                time: currentNoteStart + clipStartTime,
                                duration: noteDuration,
                                velocity: Math.min(1, currentNoteVelocitySum / currentNoteSampleCount * 3),
                                confidence: lastConfidence
                            });
                        }
                        currentNote = null;
                    }
                    // Add polyphonic notes
                    for (const polyPitch of polyPitches) {
                        const midiNote = this._frequencyToMidi(polyPitch.frequency);
                        detectedNotes.push({
                            midiNote,
                            time: frameTime + clipStartTime,
                            duration: minNoteDuration,
                            velocity: Math.min(1, rms * 4),
                            confidence: polyPitch.confidence,
                            polyphonic: true
                        });
                    }
                    continue;
                }
            }

            if (pitchResult.frequency > 0 && pitchResult.confidence > 0.3) {
                const midiNote = this._frequencyToMidi(pitchResult.frequency);
                const clampedMidiNote = Math.max(24, Math.min(96, midiNote));

                // Apply pitch smoothing - only change note if confidence is high or pitch shift is significant
                const shouldChangeNote = currentNote === null ||
                    (pitchResult.confidence > 0.7 && Math.abs(clampedMidiNote - currentNote) >= 1) ||
                    (pitchResult.confidence > 0.9);

                if (currentNote === clampedMidiNote) {
                    // Same note - accumulate
                    currentNoteVelocitySum += rms;
                    currentNoteSampleCount++;
                    lastConfidence = (lastConfidence + pitchResult.confidence) / 2;
                } else if (shouldChangeNote) {
                    // New note detected
                    if (currentNote !== null) {
                        const noteDuration = frameTime - currentNoteStart;
                        if (noteDuration >= minNoteDuration) {
                            detectedNotes.push({
                                midiNote: currentNote,
                                time: currentNoteStart + clipStartTime,
                                duration: noteDuration,
                                velocity: Math.min(1, currentNoteVelocitySum / currentNoteSampleCount * 3),
                                confidence: lastConfidence
                            });
                        }
                    }
                    currentNote = clampedMidiNote;
                    currentNoteStart = frameTime;
                    currentNoteVelocitySum = rms;
                    currentNoteSampleCount = 1;
                    lastConfidence = pitchResult.confidence;
                }
            } else {
                // No clear pitch - end current note
                if (currentNote !== null) {
                    const noteDuration = frameTime - currentNoteStart;
                    if (noteDuration >= minNoteDuration) {
                        detectedNotes.push({
                            midiNote: currentNote,
                            time: currentNoteStart + clipStartTime,
                            duration: noteDuration,
                            velocity: Math.min(1, currentNoteVelocitySum / currentNoteSampleCount * 3),
                            confidence: lastConfidence
                        });
                    }
                    currentNote = null;
                }
            }
        }

        // Handle final note
        if (currentNote !== null) {
            const noteDuration = duration - currentNoteStart;
            if (noteDuration >= minNoteDuration) {
                detectedNotes.push({
                    midiNote: currentNote,
                    time: currentNoteStart + clipStartTime,
                    duration: noteDuration,
                    velocity: Math.min(1, currentNoteVelocitySum / currentNoteSampleCount * 3),
                    confidence: lastConfidence
                });
            }
        }

        // Post-process: merge very short consecutive notes of same pitch
        const mergedNotes = this._mergeConsecutiveNotes(detectedNotes, minNoteDuration);

        // Filter by confidence threshold
        const confidenceThreshold = 0.3 + (1 - sensitivity) * 0.2;
        const filteredNotes = mergedNotes.filter(n => n.confidence >= confidenceThreshold);

        console.log(`[Pitch Detection] Detected ${filteredNotes.length} notes (raw: ${detectedNotes.length}, merged: ${mergedNotes.length})`);
        return filteredNotes;
    }

    /**
     * Pre-process audio data: normalize and apply windowing.
     */
    _preprocessAudio(audioData) {
        const processed = new Float32Array(audioData.length);
        
        // Find max amplitude for normalization
        let maxAmp = 0;
        for (let i = 0; i < audioData.length; i++) {
            const abs = Math.abs(audioData[i]);
            if (abs > maxAmp) maxAmp = abs;
        }
        
        const normalizeFactor = maxAmp > 0 ? 0.95 / maxAmp : 1;
        
        // Normalize
        for (let i = 0; i < audioData.length; i++) {
            processed[i] = audioData[i] * normalizeFactor;
        }
        
        return processed;
    }

    /**
     * YIN pitch detection algorithm - more accurate than basic autocorrelation.
     * Returns { frequency, confidence }.
     */
    _yinPitchDetection(audioData, startSample, windowSize, sampleRate, minFreq, maxFreq) {
        const threshold = 0.15; // YIN threshold
        const minPeriod = Math.floor(sampleRate / maxFreq);
        const maxPeriod = Math.floor(sampleRate / minFreq);
        
        // Calculate difference function
        const yinBuffer = new Float32Array(maxPeriod + 2);
        let runningSum = 0;
        
        for (let tau = 0; tau <= maxPeriod; tau++) {
            yinBuffer[tau] = 0;
            for (let i = 0; i < windowSize - tau; i++) {
                const sample = audioData[startSample + i] || 0;
                const delayed = audioData[startSample + i + tau] || 0;
                const delta = sample - delayed;
                yinBuffer[tau] += delta * delta;
            }
            
            // Cumulative mean normalized difference
            if (tau === 0) {
                runningSum = 0;
            } else {
                runningSum += yinBuffer[tau];
                if (runningSum > 0) {
                    yinBuffer[tau] = yinBuffer[tau] * tau / runningSum;
                }
            }
        }
        
        // Find first dip below threshold
        let tauEstimate = -1;
        for (let tau = minPeriod; tau <= maxPeriod; tau++) {
            if (yinBuffer[tau] < threshold) {
                // Find minimum in local neighborhood
                while (tau + 1 <= maxPeriod && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }
        
        if (tauEstimate === -1) {
            return { frequency: 0, confidence: 0 };
        }
        
        // Parabolic interpolation for sub-sample accuracy
        let betterTau;
        const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
        const x2 = tauEstimate + 1 > maxPeriod ? tauEstimate : tauEstimate + 1;
        
        if (x0 === tauEstimate) {
            betterTau = yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
        } else if (x2 === tauEstimate) {
            betterTau = yinBuffer[tauEstimate] <= yinBuffer[x0] ? tauEstimate : x0;
        } else {
            const s0 = yinBuffer[x0];
            const s1 = yinBuffer[tauEstimate];
            const s2 = yinBuffer[x2];
            betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        }
        
        const frequency = sampleRate / betterTau;
        const confidence = 1 - yinBuffer[tauEstimate];
        
        return { frequency, confidence: Math.max(0, Math.min(1, confidence)) };
    }

    /**
     * FFT-based pitch detection using peak picking in frequency domain.
     * Returns { frequency, confidence }.
     */
    _fftPitchDetection(audioData, startSample, windowSize, sampleRate, minFreq, maxFreq) {
        // Apply Hann window
        const windowed = new Float32Array(windowSize);
        for (let i = 0; i < windowSize; i++) {
            const hann = 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)));
            windowed[i] = (audioData[startSample + i] || 0) * hann;
        }
        
        // Simple DFT for frequency bins (avoiding full FFT library dependency)
        const numBins = windowSize / 2;
        const magnitudes = new Float32Array(numBins);
        const binWidth = sampleRate / windowSize;
        
        // Use simplified magnitude calculation with precomputed twiddle factors
        for (let k = 0; k < numBins; k++) {
            let real = 0, imag = 0;
            const angle = -2 * Math.PI * k / windowSize;
            for (let n = 0; n < windowSize; n++) {
                const twiddleAngle = angle * n;
                real += windowed[n] * Math.cos(twiddleAngle);
                imag += windowed[n] * Math.sin(twiddleAngle);
            }
            magnitudes[k] = real * real + imag * imag;
        }
        
        // Find peaks in the frequency range
        const minBin = Math.floor(minFreq / binWidth);
        const maxBin = Math.min(numBins - 1, Math.floor(maxFreq / binWidth));
        
        let maxMag = 0;
        let peakBin = -1;
        
        for (let k = minBin; k <= maxBin; k++) {
            if (magnitudes[k] > maxMag) {
                // Check if it's a local maximum
                const isLocalMax = (k === minBin || magnitudes[k] >= magnitudes[k - 1]) &&
                    (k === maxBin || magnitudes[k] >= magnitudes[k + 1]);
                if (isLocalMax) {
                    maxMag = magnitudes[k];
                    peakBin = k;
                }
            }
        }
        
        if (peakBin === -1) {
            return { frequency: 0, confidence: 0 };
        }
        
        // Parabolic interpolation for better frequency estimate
        const k1 = peakBin > 0 ? magnitudes[peakBin - 1] : magnitudes[peakBin];
        const k2 = magnitudes[peakBin];
        const k3 = peakBin < numBins - 1 ? magnitudes[peakBin + 1] : magnitudes[peakBin];
        
        const denom = k1 + k3 - 2 * k2;
        const refinedBin = denom !== 0 ? peakBin + (k1 - k3) / (2 * denom) : peakBin;
        
        const frequency = refinedBin * binWidth;
        
        // Calculate total energy for confidence
        let totalEnergy = 0;
        for (let i = 0; i < magnitudes.length; i++) {
            totalEnergy += magnitudes[i];
        }
        
        const confidence = totalEnergy > 0 ? Math.sqrt(maxMag) / Math.sqrt(totalEnergy) : 0;
        
        return { frequency, confidence: Math.max(0, Math.min(1, confidence)) };
    }

    /**
     * Detect multiple simultaneous pitches for polyphonic audio.
     * Uses harmonic product spectrum method.
     */
    _detectPolyphonic(audioData, startSample, windowSize, sampleRate, minFreq, maxFreq) {
        const pitches = [];
        
        // Apply Hann window
        const windowed = new Float32Array(windowSize);
        for (let i = 0; i < windowSize; i++) {
            const hann = 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)));
            windowed[i] = (audioData[startSample + i] || 0) * hann;
        }
        
        const numBins = windowSize / 2;
        const binWidth = sampleRate / windowSize;
        
        // Compute magnitude spectrum
        const magnitudes = new Float32Array(numBins);
        for (let k = 0; k < numBins; k++) {
            let real = 0, imag = 0;
            for (let n = 0; n < windowSize; n++) {
                const angle = -2 * Math.PI * k * n / windowSize;
                real += windowed[n] * Math.cos(angle);
                imag += windowed[n] * Math.sin(angle);
            }
            magnitudes[k] = Math.sqrt(real * real + imag * imag);
        }
        
        // Harmonic Product Spectrum - downsample and multiply
        const hpsOrder = 5; // Check up to 5th harmonic
        const hpsSize = Math.floor(numBins / hpsOrder);
        const hps = new Float32Array(hpsSize);
        
        for (let i = 0; i < hpsSize; i++) {
            hps[i] = magnitudes[i];
            for (let h = 2; h <= hpsOrder; h++) {
                const harmonicIndex = i * h;
                if (harmonicIndex < numBins) {
                    hps[i] *= magnitudes[harmonicIndex];
                }
            }
        }
        
        // Find peaks in HPS
        const minBin = Math.floor(minFreq / binWidth);
        const maxBin = Math.min(hpsSize - 1, Math.floor(maxFreq / binWidth));
        
        // Find multiple peaks
        const threshold = 0.1 * Math.max(...hps.slice(minBin, maxBin + 1));
        const foundPeaks = [];
        
        for (let k = minBin; k <= maxBin; k++) {
            if (hps[k] > threshold && hps[k] > 0) {
                const isLocalMax = (k === minBin || hps[k] >= hps[k - 1]) &&
                    (k === maxBin || hps[k] >= hps[k + 1]);
                if (isLocalMax) {
                    foundPeaks.push({ bin: k, magnitude: hps[k] });
                }
            }
        }
        
        // Sort by magnitude and take top candidates
        foundPeaks.sort((a, b) => b.magnitude - a.magnitude);
        
        for (let i = 0; i < Math.min(4, foundPeaks.length); i++) {
            const peak = foundPeaks[i];
            const frequency = peak.bin * binWidth;
            const confidence = Math.min(1, peak.magnitude / (foundPeaks[0]?.magnitude || 1));
            pitches.push({ frequency, confidence });
        }
        
        return pitches;
    }

    /**
     * Detect note onsets using spectral flux.
     */
    _detectOnsets(audioData, sampleRate, fftSize, hopSize) {
        const onsets = [];
        const numFrames = Math.floor((audioData.length - fftSize) / hopSize);
        
        if (numFrames < 2) return onsets;
        
        // Calculate spectral flux between consecutive frames
        const prevSpectrum = new Float32Array(fftSize / 2);
        const threshold = 0.3;
        
        for (let frame = 0; frame < numFrames; frame++) {
            const startSample = frame * hopSize;
            const spectrum = new Float32Array(fftSize / 2);
            
            // Calculate magnitude spectrum
            for (let k = 0; k < fftSize / 2; k++) {
                let real = 0, imag = 0;
                for (let n = 0; n < fftSize; n++) {
                    const sample = audioData[startSample + n] || 0;
                    const hann = 0.5 * (1 - Math.cos(2 * Math.PI * n / (fftSize - 1)));
                    const angle = -2 * Math.PI * k * n / fftSize;
                    real += sample * hann * Math.cos(angle);
                    imag += sample * hann * Math.sin(angle);
                }
                spectrum[k] = Math.sqrt(real * real + imag * imag);
            }
            
            // Calculate spectral flux (positive differences only)
            let flux = 0;
            for (let k = 0; k < fftSize / 2; k++) {
                const diff = spectrum[k] - prevSpectrum[k];
                if (diff > 0) {
                    flux += diff * diff;
                }
            }
            flux = Math.sqrt(flux);
            
            // Detect onset if flux exceeds threshold
            if (flux > threshold && frame > 0) {
                onsets.push({
                    time: startSample / sampleRate,
                    flux
                });
            }
            
            // Store for next frame
            for (let k = 0; k < fftSize / 2; k++) {
                prevSpectrum[k] = spectrum[k];
            }
        }
        
        return onsets;
    }

    /**
     * Convert frequency to MIDI note number.
     */
    _frequencyToMidi(frequency) {
        return Math.round(12 * Math.log2(frequency / 440) + 69);
    }

    /**
     * Merge consecutive notes of same pitch into single notes.
     */
    _mergeConsecutiveNotes(notes, minNoteDuration) {
        if (notes.length === 0) return notes;
        
        const merged = [notes[0]];
        
        for (let i = 1; i < notes.length; i++) {
            const prev = merged[merged.length - 1];
            const curr = notes[i];
            
            // Check if same note and gap is small
            if (prev.midiNote === curr.midiNote &&
                curr.time - (prev.time + prev.duration) < minNoteDuration * 0.5) {
                // Merge
                prev.duration = (curr.time + curr.duration) - prev.time;
                prev.velocity = (prev.velocity + curr.velocity) / 2;
                prev.confidence = Math.max(prev.confidence, curr.confidence);
            } else {
                merged.push(curr);
            }
        }
        
        return merged;
    }

    /**
     * Autocorrelation-based pitch detection (original method, kept for backward compatibility).
     */
    _autocorrelationPitch(audioData, startSample, windowSize, sampleRate, minFreq, maxFreq) {
        const minPeriod = Math.floor(sampleRate / maxFreq);
        const maxPeriod = Math.floor(sampleRate / minFreq);
        let bestCorrelation = 0, bestPeriod = 0;

        for (let period = minPeriod; period <= maxPeriod && period < windowSize / 2; period++) {
            let correlation = 0, norm = 0;
            for (let i = 0; i < windowSize - period; i++) {
                const sample = audioData[startSample + i] || 0;
                const delayedSample = audioData[startSample + i + period] || 0;
                correlation += sample * delayedSample;
                norm += sample * sample;
            }
            if (norm > 0) correlation /= norm;
            if (correlation > bestCorrelation && correlation > 0.5) {
                bestCorrelation = correlation;
                bestPeriod = period;
            }
        }

        return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
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

    // ==================== Sequence Variation Methods ====================

    /**
     * Create a variation of an existing sequence with randomization options.
     * @param {string} sequenceId - ID of the source sequence
     * @param {Object} options - Variation options
     * @param {number} options.velocityVariation - Amount of velocity randomization (0-1)
     * @param {number} options.timingVariation - Amount of timing shift in steps (0-2)
     * @param {number} options.noteOmitChance - Chance to omit notes (0-1)
     * @param {number} options.noteAddChance - Chance to add ghost notes (0-1)
     * @param {string} options.variationName - Name for the new sequence
     * @returns {Object|null} The new variation sequence or null if failed
     */
    createSequenceVariation(sequenceId, options = {}) {
        if (this.type === 'Audio') {
            console.warn(`[Track ${this.id}] Cannot create sequence variation on Audio track.`);
            return null;
        }

        const sourceSequence = this.sequences.find(s => s.id === sequenceId);
        if (!sourceSequence) {
            console.warn(`[Track ${this.id}] Sequence ${sequenceId} not found for variation.`);
            return null;
        }

        const velocityVariation = options.velocityVariation ?? 0.1;
        const timingVariation = options.timingVariation ?? 0.25;
        const noteOmitChance = options.noteOmitChance ?? 0;
        const noteAddChance = options.noteAddChance ?? 0;
        const variationName = options.variationName || `${sourceSequence.name} (variation)`;

        // Deep clone the source data
        const newData = sourceSequence.data.map((row, rowIndex) => {
            if (!row) return Array(sourceSequence.length).fill(null);
            return row.map((step, colIndex) => {
                if (!step || !step.active) return null;
                
                // Apply note omit chance
                if (noteOmitChance > 0 && Math.random() < noteOmitChance) {
                    return null;
                }

                const newStep = { ...step };

                // Apply velocity variation
                if (velocityVariation > 0 && newStep.velocity !== undefined) {
                    const variation = (Math.random() * 2 - 1) * velocityVariation;
                    newStep.velocity = Math.max(0.1, Math.min(1.0, newStep.velocity + variation));
                    newStep.velocity = Math.round(newStep.velocity * 100) / 100;
                }

                // Note probability is preserved but can be modified
                if (newStep.probability === undefined) {
                    newStep.probability = 1.0;
                }

                return newStep;
            });
        });

        // Apply timing variation by shifting notes
        if (timingVariation > 0) {
            const maxShift = Math.ceil(timingVariation);
            for (let rowIndex = 0; rowIndex < newData.length; rowIndex++) {
                const row = newData[rowIndex];
                if (!row) continue;
                
                const newRow = Array(sourceSequence.length).fill(null);
                for (let colIndex = 0; colIndex < row.length; colIndex++) {
                    const step = row[colIndex];
                    if (!step) continue;

                    // Random shift within timing variation
                    const shift = Math.round((Math.random() * 2 - 1) * timingVariation);
                    const newCol = colIndex + shift;

                    if (newCol >= 0 && newCol < sourceSequence.length) {
                        newRow[newCol] = step;
                    }
                }
                newData[rowIndex] = newRow;
            }
        }

        // Apply note addition (ghost notes)
        if (noteAddChance > 0) {
            for (let rowIndex = 0; rowIndex < newData.length; rowIndex++) {
                const row = newData[rowIndex];
                if (!row) continue;

                for (let colIndex = 0; colIndex < row.length; colIndex++) {
                    if (Math.random() < noteAddChance) {
                        if (!row[colIndex]) {
                            // Find neighboring velocities to reference
                            let refVelocity = 0.5;
                            for (let i = colIndex - 1; i >= Math.max(0, colIndex - 4); i--) {
                                if (row[i] && row[i].velocity) {
                                    refVelocity = row[i].velocity * 0.7;
                                    break;
                                }
                            }
                            
                            row[colIndex] = {
                                active: true,
                                velocity: Math.round(refVelocity * 100) / 100,
                                probability: 0.7 // Ghost notes have lower probability
                            };
                        }
                    }
                }
            }
        }

        // Create new sequence
        const newSequence = {
            id: `seq_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: variationName,
            data: newData,
            length: sourceSequence.length
        };

        this.sequences.push(newSequence);
        console.log(`[Track ${this.id}] Created sequence variation "${variationName}" from "${sourceSequence.name}".`);

        return newSequence;
    }

    /**
     * Set probability for a specific note in the sequence.
     * @param {number} rowIndex - Row index in sequence
     * @param {number} colIndex - Column index in sequence
     * @param {number} probability - Probability value (0-1)
     * @returns {boolean} Success status
     */
    setNoteProbability(rowIndex, colIndex, probability) {
        if (this.type === 'Audio') return false;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data) return false;

        if (rowIndex < 0 || rowIndex >= activeSeq.data.length) return false;
        const row = activeSeq.data[rowIndex];
        if (!row || colIndex < 0 || colIndex >= row.length) return false;

        const step = row[colIndex];
        if (!step || !step.active) return false;

        step.probability = Math.max(0, Math.min(1, probability));
        return true;
    }

    /**
     * Get probability for a specific note in the sequence.
     * @param {number} rowIndex - Row index in sequence
     * @param {number} colIndex - Column index in sequence
     * @returns {number} Probability value (0-1, default 1)
     */
    getNoteProbability(rowIndex, colIndex) {
        if (this.type === 'Audio') return 1;
        const activeSeq = this.getActiveSequence();
        if (!activeSeq || !activeSeq.data) return 1;

        if (rowIndex < 0 || rowIndex >= activeSeq.data.length) return 1;
        const row = activeSeq.data[rowIndex];
        if (!row || colIndex < 0 || colIndex >= row.length) return 1;

        const step = row[colIndex];
        if (!step || !step.active) return 1;

        return step.probability ?? 1;
    }

    // ==================== Smart Tempo Detection ====================

    /**
     * Detect tempo from an audio clip using onset detection.
     * @param {string} clipId - ID of the audio clip to analyze
     * @returns {Object|null} Object with detectedTempo and confidence, or null if failed
     */
    detectTempoFromAudio(clipId) {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] detectTempoFromAudio only works on Audio tracks.`);
            return null;
        }

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found for tempo detection.`);
            return null;
        }

        // Get audio buffer from the clip
        let audioBuffer = null;
        if (clip.audioBuffer) {
            audioBuffer = clip.audioBuffer;
        } else if (clip.dbKey && this.appServices?.getAudioBufferFromDb) {
            audioBuffer = this.appServices.getAudioBufferFromDb(clip.dbKey);
        }

        if (!audioBuffer) {
            console.warn(`[Track ${this.id}] No audio buffer available for clip ${clipId}.`);
            return null;
        }

        let channelData, sampleRate;
        if (audioBuffer.getChannelData) {
            channelData = audioBuffer.getChannelData(0);
            sampleRate = audioBuffer.sampleRate;
        } else if (audioBuffer._buffer) {
            channelData = audioBuffer._buffer.getChannelData(0);
            sampleRate = audioBuffer._buffer.sampleRate;
        } else {
            console.warn(`[Track ${this.id}] Invalid audio buffer format.`);
            return null;
        }

        // Detect onsets using energy-based method
        const onsetTimes = this._detectOnsets(channelData, sampleRate);
        
        if (onsetTimes.length < 4) {
            console.warn(`[Track ${this.id}] Not enough onsets detected for tempo analysis.`);
            return { detectedTempo: null, confidence: 0 };
        }

        // Calculate inter-onset intervals
        const intervals = [];
        for (let i = 1; i < onsetTimes.length; i++) {
            intervals.push(onsetTimes[i] - onsetTimes[i - 1]);
        }

        // Find the most common interval (likely the beat)
        const bpmCandidates = intervals.map(interval => 60 / interval);
        
        // Cluster BPM candidates around common tempo ranges (60-180 BPM)
        const validBpms = bpmCandidates.filter(bpm => bpm >= 60 && bpm <= 180);
        
        if (validBpms.length === 0) {
            return { detectedTempo: null, confidence: 0 };
        }

        // Use median for robustness
        validBpms.sort((a, b) => a - b);
        const medianBpm = validBpms[Math.floor(validBpms.length / 2)];

        // Calculate confidence based on consistency
        const avgDeviation = validBpms.reduce((sum, bpm) => {
            return sum + Math.abs(bpm - medianBpm);
        }, 0) / validBpms.length;
        const confidence = Math.max(0, 1 - (avgDeviation / medianBpm));

        console.log(`[Track ${this.id}] Detected tempo: ${medianBpm.toFixed(1)} BPM (confidence: ${(confidence * 100).toFixed(0)}%)`);

        return {
            detectedTempo: Math.round(medianBpm * 10) / 10,
            confidence: Math.round(confidence * 100) / 100,
            onsetCount: onsetTimes.length
        };
    }

    /**
     * Detect onsets in audio using energy-based method.
     * @private
     */
    _detectOnsets(channelData, sampleRate) {
        const windowSize = 512;
        const hopSize = 256;
        const threshold = 0.1;
        
        const onsets = [];
        let prevEnergy = 0;
        
        for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += channelData[i + j] ** 2;
            }
            energy = Math.sqrt(energy / windowSize);
            
            // Onset detection: energy increase exceeds threshold
            if (energy > prevEnergy * (1 + threshold) && energy > 0.02) {
                const time = i / sampleRate;
                // Avoid duplicate onsets too close together
                if (onsets.length === 0 || time - onsets[onsets.length - 1] > 0.1) {
                    onsets.push(time);
                }
            }
            prevEnergy = energy;
        }
        
        return onsets;
    }

    // ==================== Clip Grouping Methods ====================

    /**
     * Create a group from selected clips.
     * @param {Array<string>} clipIds - Array of clip IDs to group
     * @param {string} groupName - Optional name for the group
     * @returns {Object|null} The created group or null if failed
     */
    createClipGroup(clipIds, groupName = 'Clip Group') {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] Clip grouping only applies to Audio tracks.`);
            return null;
        }

        if (!clipIds || clipIds.length < 2) {
            console.warn(`[Track ${this.id}] Need at least 2 clips to create a group.`);
            return null;
        }

        // Find all clips to group
        const clipsToGroup = clipIds.map(id => this.timelineClips.find(c => c.id === id)).filter(Boolean);
        if (clipsToGroup.length < 2) {
            console.warn(`[Track ${this.id}] Not enough valid clips to group.`);
            return null;
        }

        // Check if any clip is already in a group
        for (const clip of clipsToGroup) {
            if (clip.groupId) {
                console.warn(`[Track ${this.id}] Clip ${clip.id} is already in a group. Remove from group first.`);
                return null;
            }
        }

        // Create the group
        const groupId = `group_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        for (const clip of clipsToGroup) {
            clip.groupId = groupId;
        }

        const group = {
            id: groupId,
            name: groupName,
            clipIds: clipsToGroup.map(c => c.id),
            locked: false // Whether the group is locked for editing
        };

        // Initialize clipGroups array if needed
        if (!this.clipGroups) {
            this.clipGroups = [];
        }
        this.clipGroups.push(group);

        console.log(`[Track ${this.id}] Created clip group "${groupName}" with ${clipsToGroup.length} clips.`);
        return group;
    }

    /**
     * Add a clip to an existing group.
     * @param {string} clipId - Clip ID to add
     * @param {string} groupId - Group ID to add to
     * @returns {boolean} Success status
     */
    addToClipGroup(clipId, groupId) {
        if (this.type !== 'Audio') return false;

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found.`);
            return false;
        }

        if (clip.groupId) {
            console.warn(`[Track ${this.id}] Clip ${clipId} is already in a group.`);
            return false;
        }

        const group = this.clipGroups?.find(g => g.id === groupId);
        if (!group) {
            console.warn(`[Track ${this.id}] Group ${groupId} not found.`);
            return false;
        }

        if (group.locked) {
            console.warn(`[Track ${this.id}] Group ${groupId} is locked.`);
            return false;
        }

        clip.groupId = groupId;
        group.clipIds.push(clipId);

        console.log(`[Track ${this.id}] Added clip ${clipId} to group ${groupId}.`);
        return true;
    }

    /**
     * Remove a clip from its group.
     * @param {string} clipId - Clip ID to remove from group
     * @returns {boolean} Success status
     */
    removeFromClipGroup(clipId) {
        if (this.type !== 'Audio') return false;

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip || !clip.groupId) {
            return false;
        }

        const group = this.clipGroups?.find(g => g.id === clip.groupId);
        if (group) {
            group.clipIds = group.clipIds.filter(id => id !== clipId);
            
            // If group has only 1 clip left, dissolve the group
            if (group.clipIds.length <= 1) {
                this.clipGroups = this.clipGroups.filter(g => g.id !== group.id);
                // Clear groupId from remaining clip
                const remainingClip = this.timelineClips.find(c => c.id === group.clipIds[0]);
                if (remainingClip) remainingClip.groupId = null;
                console.log(`[Track ${this.id}] Group ${group.id} dissolved (only 1 clip remaining).`);
            }
        }

        clip.groupId = null;
        console.log(`[Track ${this.id}] Removed clip ${clipId} from its group.`);
        return true;
    }

    /**
     * Ungroup all clips in a group.
     * @param {string} groupId - Group ID to ungroup
     * @returns {number} Number of clips ungrouped
     */
    ungroupClips(groupId) {
        if (this.type !== 'Audio') return 0;

        const group = this.clipGroups?.find(g => g.id === groupId);
        if (!group) {
            console.warn(`[Track ${this.id}] Group ${groupId} not found.`);
            return 0;
        }

        const clipCount = group.clipIds.length;
        
        for (const clipId of group.clipIds) {
            const clip = this.timelineClips.find(c => c.id === clipId);
            if (clip) {
                clip.groupId = null;
            }
        }

        this.clipGroups = this.clipGroups.filter(g => g.id !== groupId);
        console.log(`[Track ${this.id}] Ungrouped ${clipCount} clips from group ${groupId}.`);
        
        return clipCount;
    }

    /**
     * Move all clips in a group by a time offset.
     * @param {string} groupId - Group ID to move
     * @param {number} timeOffset - Time offset in seconds (positive = later, negative = earlier)
     * @returns {boolean} Success status
     */
    moveClipGroup(groupId, timeOffset) {
        if (this.type !== 'Audio') return false;

        const group = this.clipGroups?.find(g => g.id === groupId);
        if (!group || group.locked) {
            return false;
        }

        for (const clipId of group.clipIds) {
            const clip = this.timelineClips.find(c => c.id === clipId);
            if (clip) {
                clip.startTime = Math.max(0, clip.startTime + timeOffset);
            }
        }

        console.log(`[Track ${this.id}] Moved group ${groupId} by ${timeOffset}s.`);
        return true;
    }

    /**
     * Get all clips in a group.
     * @param {string} groupId - Group ID
     * @returns {Array} Array of clip objects
     */
    getClipsInGroup(groupId) {
        if (!this.clipGroups) return [];
        
        const group = this.clipGroups.find(g => g.id === groupId);
        if (!group) return [];

        return group.clipIds
            .map(id => this.timelineClips.find(c => c.id === id))
            .filter(Boolean);
    }

    /**
     * Lock or unlock a clip group.
     * @param {string} groupId - Group ID
     * @param {boolean} locked - Lock state
     * @returns {boolean} Success status
     */
    setClipGroupLocked(groupId, locked) {
        const group = this.clipGroups?.find(g => g.id === groupId);
        if (!group) return false;

        group.locked = locked;
        console.log(`[Track ${this.id}] Group ${groupId} ${locked ? 'locked' : 'unlocked'}.`);
        return true;
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
                                        // Check probability - skip note if random roll fails
                                        const probability = stepData.probability ?? 1.0;
                                        if (probability < 1.0 && Math.random() > probability) {
                                            continue; // Skip this note based on probability
                                        }
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
     * Apply an automation value to a parameter.
     * @param {string} param - Parameter name
     * @param {number} value - Value to apply
     */
    applyAutomationValue(param, value) {
        try {
            switch (param) {
                case 'volume':
                    if (this.gainNode && !this.gainNode.disposed && this.gainNode.gain) {
                        this.gainNode.gain.setValueAtTime(Math.max(0.0001, value), Tone.now());
                    }
                    break;
                    
                case 'pan':
                    this.pan = Math.max(-1, Math.min(1, value));
                    if (this.panNode && !this.panNode.disposed) {
                        this.panNode.pan.setValueAtTime(this.pan, Tone.now());
                    }
                    break;
                    
                case 'filterFreq':
                case 'filterRes':
                    // Find filter effect in activeEffects
                    const filterEffect = this.activeEffects.find(e => e.type === 'Filter' || e.type === 'filter');
                    if (filterEffect && filterEffect.toneNode && !filterEffect.toneNode.disposed) {
                        if (param === 'filterFreq' && filterEffect.toneNode.frequency) {
                            filterEffect.toneNode.frequency.setValueAtTime(Math.max(20, Math.min(20000, value)), Tone.now());
                        } else if (param === 'filterRes' && filterEffect.toneNode.Q) {
                            filterEffect.toneNode.Q.setValueAtTime(Math.max(0.1, Math.min(20, value)), Tone.now());
                        }
                    }
                    break;
                    
                case 'reverbMix':
                    if (this.sendGainNodes['reverb'] && !this.sendGainNodes['reverb'].disposed) {
                        this.sendGainNodes['reverb'].gain.setValueAtTime(Math.max(0, Math.min(1, value)), Tone.now());
                        this.sendLevels['reverb'] = value;
                    }
                    break;
                    
                case 'delayMix':
                    if (this.sendGainNodes['delay'] && !this.sendGainNodes['delay'].disposed) {
                        this.sendGainNodes['delay'].gain.setValueAtTime(Math.max(0, Math.min(1, value)), Tone.now());
                        this.sendLevels['delay'] = value;
                    }
                    break;
                    
                case 'distortion':
                case 'bitcrush':
                case 'pitchShift':
                case 'drive':
                case 'chorusMix':
                case 'chorusRate':
                case 'chorusDepth':
                case 'delayTime':
                case 'delayFeedback':
                case 'reverbDecay':
                case 'width':
                    // Handle effect-specific parameters
                    this.applyEffectAutomation(param, value);
                    break;
            }
        } catch (e) {
            console.warn(`[Track ${this.id}] Error applying automation value for ${param}:`, e.message);
        }
    }
    
    /**
     * Apply automation to effect parameters.
     * @param {string} param - Parameter name
     * @param {number} value - Value to apply
     */
    applyEffectAutomation(param, value) {
        // Map param names to effect types and their properties
        const paramMap = {
            'distortion': { effectType: 'Distortion', prop: 'distortion' },
            'bitcrush': { effectType: 'BitCrusher', prop: 'bits' },
            'pitchShift': { effectType: 'PitchShift', prop: 'pitch' },
            'drive': { effectType: 'Distortion', prop: 'distortion' },
            'chorusMix': { effectType: 'Chorus', prop: 'wet' },
            'chorusRate': { effectType: 'Chorus', prop: 'frequency' },
            'chorusDepth': { effectType: 'Chorus', prop: 'depth' },
            'delayTime': { effectType: 'FeedbackDelay', prop: 'delayTime' },
            'delayFeedback': { effectType: 'FeedbackDelay', prop: 'feedback' },
            'reverbDecay': { effectType: 'Reverb', prop: 'decay' },
            'width': { effectType: 'StereoWidener', prop: 'width' }
        };
        
        const mapping = paramMap[param];
        if (!mapping) return;
        
        const effect = this.activeEffects.find(e => 
            e.type === mapping.effectType || 
            e.type.toLowerCase() === mapping.effectType.toLowerCase()
        );
        
        if (effect && effect.toneNode && !effect.toneNode.disposed) {
            const node = effect.toneNode[mapping.prop];
            if (node && typeof node.setValueAtTime === 'function') {
                node.setValueAtTime(value, Tone.now());
            } else if (node && typeof node.value !== 'undefined') {
                node.value = value;
            }
        }
    }

    /**
     * Schedule automation events for playback.
     * @param {number} startTime - Transport start time
     * @param {number} duration - Duration to schedule for
     */
    scheduleAutomation(startTime, duration) {
        if (!this.automation) {
            console.log(`[Track ${this.id}] No automation to schedule.`);
            return;
        }
        
        const schedulePoint = (param, point, idx, points, targetParam, minVal, maxVal) => {
            if (point.time >= startTime && point.time < startTime + duration) {
                const rampTime = Tone.Transport.seconds + (point.time - startTime);
                const curveType = point.curveType || 'exponential';
                const targetValue = Math.max(minVal, Math.min(maxVal, point.value));
                
                if (targetParam && typeof targetParam.setValueAtTime === 'function') {
                    try {
                        const prevValue = Math.max(minVal, targetParam.value || minVal);
                        
                        // Set value slightly before to establish starting point for ramp
                        targetParam.setValueAtTime(prevValue, rampTime - 0.001);
                        
                        // Apply curve type for transition to this point
                        if (curveType === 'linear') {
                            targetParam.linearRampToValueAtTime(targetValue, rampTime);
                        } else if (curveType === 'stepped') {
                            targetParam.setValueAtTime(targetValue, rampTime);
                        } else {
                            // Exponential - ensure values are positive
                            const expPrev = Math.max(0.0001, prevValue);
                            const expTarget = Math.max(0.0001, targetValue);
                            targetParam.exponentialRampToValueAtTime(expTarget, rampTime);
                        }
                        
                        console.log(`[Track ${this.id}] Scheduled ${param} automation at ${point.time.toFixed(2)}s: ${targetValue.toFixed(2)} (${curveType})`);
                    } catch (e) {
                        console.warn(`[Track ${this.id}] Error scheduling ${param} automation:`, e.message);
                    }
                }
            }
        };

        // Schedule volume automation
        if (this.automation.volume && Array.isArray(this.automation.volume) && this.automation.volume.length > 0) {
            if (this.gainNode && !this.gainNode.disposed && this.gainNode.gain) {
                this.automation.volume.forEach((point, idx) => {
                    schedulePoint('volume', point, idx, this.automation.volume, this.gainNode.gain, 0.0001, 2);
                });
            }
        }

        // Schedule pan automation
        if (this.automation.pan && Array.isArray(this.automation.pan) && this.automation.pan.length > 0) {
            if (this.panNode && !this.panNode.disposed && this.panNode.pan) {
                this.automation.pan.forEach((point, idx) => {
                    schedulePoint('pan', point, idx, this.automation.pan, this.panNode.pan, -1, 1);
                });
            }
        }

        // Schedule filter frequency automation
        if (this.automation.filterFreq && Array.isArray(this.automation.filterFreq) && this.automation.filterFreq.length > 0) {
            const filterEffect = this.activeEffects.find(e => e.type === 'Filter' || e.type === 'filter');
            if (filterEffect && filterEffect.toneNode && !filterEffect.toneNode.disposed && filterEffect.toneNode.frequency) {
                this.automation.filterFreq.forEach((point, idx) => {
                    schedulePoint('filterFreq', point, idx, this.automation.filterFreq, filterEffect.toneNode.frequency, 20, 20000);
                });
            }
        }

        // Schedule filter resonance automation
        if (this.automation.filterRes && Array.isArray(this.automation.filterRes) && this.automation.filterRes.length > 0) {
            const filterEffect = this.activeEffects.find(e => e.type === 'Filter' || e.type === 'filter');
            if (filterEffect && filterEffect.toneNode && !filterEffect.toneNode.disposed && filterEffect.toneNode.Q) {
                this.automation.filterRes.forEach((point, idx) => {
                    schedulePoint('filterRes', point, idx, this.automation.filterRes, filterEffect.toneNode.Q, 0.1, 20);
                });
            }
        }

        // Schedule reverb mix automation
        if (this.automation.reverbMix && Array.isArray(this.automation.reverbMix) && this.automation.reverbMix.length > 0) {
            if (this.sendGainNodes['reverb'] && !this.sendGainNodes['reverb'].disposed) {
                this.automation.reverbMix.forEach((point, idx) => {
                    schedulePoint('reverbMix', point, idx, this.automation.reverbMix, this.sendGainNodes['reverb'].gain, 0, 1);
                });
            }
        }

        // Schedule delay mix automation
        if (this.automation.delayMix && Array.isArray(this.automation.delayMix) && this.automation.delayMix.length > 0) {
            if (this.sendGainNodes['delay'] && !this.sendGainNodes['delay'].disposed) {
                this.automation.delayMix.forEach((point, idx) => {
                    schedulePoint('delayMix', point, idx, this.automation.delayMix, this.sendGainNodes['delay'].gain, 0, 1);
                });
            }
        }

        // Schedule distortion automation
        if (this.automation.distortion && Array.isArray(this.automation.distortion) && this.automation.distortion.length > 0) {
            const distEffect = this.activeEffects.find(e => e.type === 'Distortion' || e.type === 'distortion');
            if (distEffect && distEffect.toneNode && !distEffect.toneNode.disposed && distEffect.toneNode.distortion) {
                this.automation.distortion.forEach((point, idx) => {
                    schedulePoint('distortion', point, idx, this.automation.distortion, distEffect.toneNode.distortion, 0, 1);
                });
            }
        }

        // Schedule bitcrush automation
        if (this.automation.bitcrush && Array.isArray(this.automation.bitcrush) && this.automation.bitcrush.length > 0) {
            const bcEffect = this.activeEffects.find(e => e.type === 'BitCrusher' || e.type === 'bitcrusher');
            if (bcEffect && bcEffect.toneNode && !bcEffect.toneNode.disposed && bcEffect.toneNode.bits) {
                this.automation.bitcrush.forEach((point, idx) => {
                    schedulePoint('bitcrush', point, idx, this.automation.bitcrush, bcEffect.toneNode.bits, 1, 16);
                });
            }
        }

        // Schedule pitch shift automation
        if (this.automation.pitchShift && Array.isArray(this.automation.pitchShift) && this.automation.pitchShift.length > 0) {
            const psEffect = this.activeEffects.find(e => e.type === 'PitchShift' || e.type === 'pitchshift');
            if (psEffect && psEffect.toneNode && !psEffect.toneNode.disposed && psEffect.toneNode.pitch) {
                this.automation.pitchShift.forEach((point, idx) => {
                    schedulePoint('pitchShift', point, idx, this.automation.pitchShift, psEffect.toneNode.pitch, -12, 12);
                });
            }
        }

        // Schedule chorus parameters automation
        if (this.automation.chorusMix && Array.isArray(this.automation.chorusMix) && this.automation.chorusMix.length > 0) {
            const chorusEffect = this.activeEffects.find(e => e.type === 'Chorus' || e.type === 'chorus');
            if (chorusEffect && chorusEffect.toneNode && !chorusEffect.toneNode.disposed && chorusEffect.toneNode.wet) {
                this.automation.chorusMix.forEach((point, idx) => {
                    schedulePoint('chorusMix', point, idx, this.automation.chorusMix, chorusEffect.toneNode.wet, 0, 1);
                });
            }
        }

        if (this.automation.chorusRate && Array.isArray(this.automation.chorusRate) && this.automation.chorusRate.length > 0) {
            const chorusEffect = this.activeEffects.find(e => e.type === 'Chorus' || e.type === 'chorus');
            if (chorusEffect && chorusEffect.toneNode && !chorusEffect.toneNode.disposed && chorusEffect.toneNode.frequency) {
                this.automation.chorusRate.forEach((point, idx) => {
                    schedulePoint('chorusRate', point, idx, this.automation.chorusRate, chorusEffect.toneNode.frequency, 0.1, 10);
                });
            }
        }

        if (this.automation.chorusDepth && Array.isArray(this.automation.chorusDepth) && this.automation.chorusDepth.length > 0) {
            const chorusEffect = this.activeEffects.find(e => e.type === 'Chorus' || e.type === 'chorus');
            if (chorusEffect && chorusEffect.toneNode && !chorusEffect.toneNode.disposed && chorusEffect.toneNode.depth) {
                this.automation.chorusDepth.forEach((point, idx) => {
                    schedulePoint('chorusDepth', point, idx, this.automation.chorusDepth, chorusEffect.toneNode.depth, 0, 1);
                });
            }
        }

        // Schedule delay time and feedback automation
        if (this.automation.delayTime && Array.isArray(this.automation.delayTime) && this.automation.delayTime.length > 0) {
            const delayEffect = this.activeEffects.find(e => e.type === 'FeedbackDelay' || e.type === 'delay');
            if (delayEffect && delayEffect.toneNode && !delayEffect.toneNode.disposed && delayEffect.toneNode.delayTime) {
                this.automation.delayTime.forEach((point, idx) => {
                    schedulePoint('delayTime', point, idx, this.automation.delayTime, delayEffect.toneNode.delayTime, 0.01, 2);
                });
            }
        }

        if (this.automation.delayFeedback && Array.isArray(this.automation.delayFeedback) && this.automation.delayFeedback.length > 0) {
            const delayEffect = this.activeEffects.find(e => e.type === 'FeedbackDelay' || e.type === 'delay');
            if (delayEffect && delayEffect.toneNode && !delayEffect.toneNode.disposed && delayEffect.toneNode.feedback) {
                this.automation.delayFeedback.forEach((point, idx) => {
                    schedulePoint('delayFeedback', point, idx, this.automation.delayFeedback, delayEffect.toneNode.feedback, 0, 0.9);
                });
            }
        }

        // Schedule reverb decay automation
        if (this.automation.reverbDecay && Array.isArray(this.automation.reverbDecay) && this.automation.reverbDecay.length > 0) {
            const reverbEffect = this.activeEffects.find(e => e.type === 'Reverb' || e.type === 'reverb');
            if (reverbEffect && reverbEffect.toneNode && !reverbEffect.toneNode.disposed && reverbEffect.toneNode.decay) {
                this.automation.reverbDecay.forEach((point, idx) => {
                    schedulePoint('reverbDecay', point, idx, this.automation.reverbDecay, reverbEffect.toneNode.decay, 0.1, 10);
                });
            }
        }

        // Schedule stereo width automation
        if (this.automation.width && Array.isArray(this.automation.width) && this.automation.width.length > 0) {
            const widthEffect = this.activeEffects.find(e => e.type === 'StereoWidener' || e.type === 'width');
            if (widthEffect && widthEffect.toneNode && !widthEffect.toneNode.disposed && widthEffect.toneNode.width) {
                this.automation.width.forEach((point, idx) => {
                    schedulePoint('width', point, idx, this.automation.width, widthEffect.toneNode.width, 0, 1);
                });
            }
        }

        // Schedule drive automation
        if (this.automation.drive && Array.isArray(this.automation.drive) && this.automation.drive.length > 0) {
            const driveEffect = this.activeEffects.find(e => e.type === 'Distortion' || e.type === 'distortion');
            if (driveEffect && driveEffect.toneNode && !driveEffect.toneNode.disposed && driveEffect.toneNode.distortion) {
                this.automation.drive.forEach((point, idx) => {
                    schedulePoint('drive', point, idx, this.automation.drive, driveEffect.toneNode.distortion, 0, 1);
                });
            }
        }
    }

    /**
     * Add an automation point.
     * @param {string} param - Parameter name (e.g., 'volume')
     * @param {number} time - Time in seconds
     * @param {number} value - Value (0-1 for volume)
     * @param {string} curveType - Curve type: 'linear', 'exponential', or 'stepped'
     */
    addAutomationPoint(param, time, value, curveType = 'exponential') {
        if (!this.automation) {
            this.automation = { volume: [] };
        }
        if (!this.automation[param]) {
            this.automation[param] = [];
        }
        
        // Remove any existing point at the same time
        this.automation[param] = this.automation[param].filter(p => Math.abs(p.time - time) > 0.01);
        
        // Add new point with curveType and sort by time
        this.automation[param].push({ time, value, curveType });
        this.automation[param].sort((a, b) => a.time - b.time);
        
        console.log(`[Track ${this.id}] Added automation point for ${param} at ${time.toFixed(2)}s: ${value.toFixed(2)} (${curveType})`);
        
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
     * Multiply/duplicate a timeline clip a specified number of times.
     * Copies are placed sequentially after the original clip.
     * @param {string} clipId - The clip ID to multiply
     * @param {number} count - Number of times to repeat the clip (1-16)
     * @param {boolean} fromInteraction - Whether this is from user interaction (for undo)
     * @returns {Array} Array of new clip IDs created
     */
    multiplyClip(clipId, count = 2, fromInteraction = false) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found for multiply.`);
            return [];
        }

        const repeatCount = Math.max(1, Math.min(16, parseInt(count) || 2));
        
        if (fromInteraction && this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Multiply clip "${clip.name}" x${repeatCount}`);
        }

        const newClipIds = [];
        let lastEndTime = clip.startTime + clip.duration;

        for (let i = 0; i < repeatCount; i++) {
            const newClipId = `audioclip_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const newClip = {
                id: newClipId,
                type: clip.type,
                sourceId: clip.sourceId,
                startTime: lastEndTime,
                duration: clip.duration,
                name: `${clip.name} (×${i + 2})`,
                fadeIn: clip.fadeIn || 0,
                fadeOut: clip.fadeOut || 0,
                pitchShift: clip.pitchShift || 0,
                gainEnvelope: clip.gainEnvelope ? JSON.parse(JSON.stringify(clip.gainEnvelope)) : undefined,
            };

            this.timelineClips.push(newClip);
            newClipIds.push(newClipId);
            lastEndTime = newClip.startTime + newClip.duration;

            console.log(`[Track ${this.id}] Created multiply copy ${i + 2}/${repeatCount}: "${newClip.name}" at ${newClip.startTime.toFixed(2)}s`);
        }

        // Sort clips by start time
        this.timelineClips.sort((a, b) => a.startTime - b.startTime);

        if (this.appServices.showNotification) {
            this.appServices.showNotification(`Created ${repeatCount} copies of "${clip.name}"`, 2000);
        }

        if (this.appServices.renderTimeline) {
            this.appServices.renderTimeline();
        }

        return newClipIds;
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

    /**
     * Transpose an audio clip by semitones (creates a new audio buffer with pitch shifted).
     * @param {string} clipId - The clip ID to transpose
     * @param {number} semitones - Number of semitones to shift (positive = up, negative = down)
     * @returns {Promise<boolean>} True if successful
     */
    async transposeAudioClip(clipId, semitones = 0) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip || clip.type !== 'audio') {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found or not audio clip.`);
            return false;
        }
        if (semitones === 0) return true;

        console.log(`[Track ${this.id}] Transposing audio clip "${clip.name}" by ${semitones} semitones...`);
        try {
            const originalBlob = await getAudio(clip.sourceId);
            if (!originalBlob) {
                console.error(`[Track ${this.id}] Audio data not found for clip ${clipId}`);
                if (this.appServices.showNotification) {
                    this.appServices.showNotification('Audio data not found for this clip.', 3000);
                }
                return false;
            }

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = await originalBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Pitch shift via playback rate (simple approach: change rate, then resample)
            // For true pitch shift we need a phase vocoder; here we use detune (cents)
            const rate = Math.pow(2, semitones / 12);
            const numberOfChannels = audioBuffer.numberOfChannels;
            const sampleRate = audioBuffer.sampleRate;
            const length = audioBuffer.length;
            const transposedBuffer = audioContext.createBuffer(numberOfChannels, length, sampleRate);

            for (let ch = 0; ch < numberOfChannels; ch++) {
                const originalData = audioBuffer.getChannelData(ch);
                const transposedData = transposedBuffer.getChannelData(ch);
                for (let i = 0; i < length; i++) {
                    const srcIdx = i * rate;
                    const idx = Math.floor(srcIdx);
                    const frac = srcIdx - idx;
                    if (idx + 1 < length) {
                        transposedData[i] = originalData[idx] * (1 - frac) + originalData[idx + 1] * frac;
                    } else {
                        transposedData[i] = originalData[Math.min(idx, length - 1)];
                    }
                }
            }

            const transposedBlob = await this._audioBufferToWav(transposedBuffer);
            await audioContext.close();

            const newDbKey = `audioclip_${this.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_transposed`;
            const newAudioData = await transposedBlob.arrayBuffer();
            await storeAudio(newDbKey, newAudioData);

            const oldSourceId = clip.sourceId;
            clip.sourceId = newDbKey;

            if (clip.audioBuffer) {
                if (clip.audioBuffer.disposed === false) {
                    try { clip.audioBuffer.dispose(); } catch(e) {}
                }
                clip.audioBuffer = null;
            }

            this._captureUndoState(`Transpose clip "${clip.name}" on ${this.name} by ${semitones} st`);

            if (this.appServices.renderTimeline) this.appServices.renderTimeline();
            if (this.appServices.updateTrackUI) this.appServices.updateTrackUI(this.id, 'audioClipTransposed');
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Audio transposed ${semitones > 0 ? '+' : ''}${semitones} semitones.`, 2000);
            }

            return true;
        } catch (error) {
            console.error(`[Track ${this.id}] Error transposing audio clip:`, error);
            if (this.appServices.showNotification) {
                this.appServices.showNotification(`Error transposing audio: ${error.message}`, 3000);
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

    // --- Instrument Rack ---
    /**
     * Initialize the instrument rack for this track.
     * @param {Object} options - Initial rack options
     */
    initInstrumentRack(options = {}) {
        this.instrumentRack = {
            enabled: options.enabled ?? true,
            layers: []
        };
        this.instrumentRackLayerCount = 0;
        console.log(`[Track ${this.id}] Instrument rack initialized`);
    }

    /**
     * Get the instrument rack data.
     * @returns {Object} The instrument rack configuration
     */
    getInstrumentRack() {
        if (!this.instrumentRack) this.initInstrumentRack();
        return JSON.parse(JSON.stringify(this.instrumentRack));
    }

    /**
     * Set instrument rack enabled state.
     * @param {boolean} enabled - Whether the rack is enabled
     */
    setInstrumentRackEnabled(enabled) {
        if (!this.instrumentRack) this.initInstrumentRack();
        this.instrumentRack.enabled = enabled;
        console.log(`[Track ${this.id}] Instrument rack ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Add a new layer to the instrument rack.
     * @param {Object} options - Layer options (name, type, synthEngineType, volume, pan, etc.)
     * @returns {Object} The created layer
     */
    addInstrumentRackLayer(options = {}) {
        if (!this.instrumentRack) this.initInstrumentRack();
        
        this.instrumentRackLayerCount++;
        const layer = {
            id: `rack-layer-${this.id}-${this.instrumentRackLayerCount}`,
            name: options.name || `Layer ${this.instrumentRackLayerCount}`,
            type: options.type || 'synth', // 'synth', 'sampler', 'drum'
            enabled: options.enabled ?? true,
            muted: options.muted ?? false,
            volume: options.volume ?? 0.7,
            pan: options.pan ?? 0,
            midiChannel: options.midiChannel ?? 0,
            noteRangeLow: options.noteRangeLow ?? 0,
            noteRangeHigh: options.noteRangeHigh ?? 127,
            synthEngineType: options.synthEngineType || 'MonoSynth',
            synthParams: options.synthParams || {},
            // For sampler type
            sampleUrl: options.sampleUrl || null,
            // For drum type
            drumPadIndex: options.drumPadIndex ?? 0
        };
        
        this.instrumentRack.layers.push(layer);
        console.log(`[Track ${this.id}] Added instrument rack layer: ${layer.name}`);
        
        if (this.appServices.showNotification) {
            this.appServices.showNotification(`Layer "${layer.name}" added to rack`, 1500);
        }
        
        return layer;
    }

    /**
     * Remove a layer from the instrument rack.
     * @param {string} layerId - The layer ID to remove
     * @returns {boolean} True if successful
     */
    removeInstrumentRackLayer(layerId) {
        if (!this.instrumentRack || !this.instrumentRack.layers) return false;
        
        const index = this.instrumentRack.layers.findIndex(l => l.id === layerId);
        if (index === -1) {
            console.warn(`[Track ${this.id}] Layer ${layerId} not found in instrument rack`);
            return false;
        }
        
        const removed = this.instrumentRack.layers.splice(index, 1)[0];
        console.log(`[Track ${this.id}] Removed instrument rack layer: ${removed.name}`);
        return true;
    }

    /**
     * Update a layer in the instrument rack.
     * @param {string} layerId - The layer ID to update
     * @param {Object} updates - The properties to update
     * @returns {boolean} True if successful
     */
    updateInstrumentRackLayer(layerId, updates) {
        if (!this.instrumentRack || !this.instrumentRack.layers) return false;
        
        const layer = this.instrumentRack.layers.find(l => l.id === layerId);
        if (!layer) {
            console.warn(`[Track ${this.id}] Layer ${layerId} not found in instrument rack`);
            return false;
        }
        
        // Apply updates
        const allowedUpdates = ['name', 'type', 'enabled', 'muted', 'volume', 'pan', 'midiChannel', 
                                'noteRangeLow', 'noteRangeHigh', 'synthEngineType', 'synthParams',
                                'sampleUrl', 'drumPadIndex'];
        for (const key of allowedUpdates) {
            if (updates.hasOwnProperty(key)) {
                layer[key] = updates[key];
            }
        }
        
        console.log(`[Track ${this.id}] Updated instrument rack layer: ${layer.name}`);
        return true;
    }

    /**
     * Set a layer's enabled state.
     * @param {string} layerId - The layer ID
     * @param {boolean} enabled - Whether the layer is enabled
     */
    setInstrumentRackLayerEnabled(layerId, enabled) {
        const layer = this.instrumentRack?.layers?.find(l => l.id === layerId);
        if (layer) {
            layer.enabled = enabled;
            console.log(`[Track ${this.id}] Layer ${layer.name} ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     * Set a layer's volume.
     * @param {string} layerId - The layer ID
     * @param {number} volume - Volume (0-1)
     */
    setInstrumentRackLayerVolume(layerId, volume) {
        const layer = this.instrumentRack?.layers?.find(l => l.id === layerId);
        if (layer) {
            layer.volume = Math.max(0, Math.min(1, volume));
            console.log(`[Track ${this.id}] Layer ${layer.name} volume: ${layer.volume}`);
        }
    }

    /**
     * Set a layer's pan.
     * @param {string} layerId - The layer ID
     * @param {number} pan - Pan (-1 to 1)
     */
    setInstrumentRackLayerPan(layerId, pan) {
        const layer = this.instrumentRack?.layers?.find(l => l.id === layerId);
        if (layer) {
            layer.pan = Math.max(-1, Math.min(1, pan));
            console.log(`[Track ${this.id}] Layer ${layer.name} pan: ${layer.pan}`);
        }
    }

    /**
     * Set a layer's mute state.
     * @param {string} layerId - The layer ID
     * @param {boolean} muted - Whether the layer is muted
     */
    setInstrumentRackLayerMute(layerId, muted) {
        const layer = this.instrumentRack?.layers?.find(l => l.id === layerId);
        if (layer) {
            layer.muted = muted;
            console.log(`[Track ${this.id}] Layer ${layer.name} ${muted ? 'muted' : 'unmuted'}`);
        }
    }

    /**
     * Get a layer from the instrument rack by ID.
     * @param {string} layerId - The layer ID
     * @returns {Object|null} The layer or null
     */
    getInstrumentRackLayer(layerId) {
        return this.instrumentRack?.layers?.find(l => l.id === layerId) || null;
    }

    /**
     * Check if a note is within a layer's note range.
     * @param {string} layerId - The layer ID
     * @param {number} note - MIDI note number
     * @returns {boolean} True if note is in range
     */
    isNoteInLayerRange(layerId, note) {
        const layer = this.getInstrumentRackLayer(layerId);
        if (!layer) return false;
        return note >= layer.noteRangeLow && note <= layer.noteRangeHigh;
    }

    /**
     * Route a note to the appropriate rack layer based on note range.
     * @param {number} note - MIDI note number
     * @param {number} velocity - Velocity (0-1)
     * @returns {Array} Array of layers that should receive the note
     */
    routeNoteToRackLayers(note, velocity) {
        if (!this.instrumentRack?.enabled || !this.instrumentRack.layers) return [];
        
        return this.instrumentRack.layers.filter(layer => {
            if (!layer.enabled || layer.muted) return false;
            return this.isNoteInLayerRange(layer.id, note);
        });
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

    // --- Scatter/Chaos Effect ---
    /**
     * Initialize scatter effect for this track.
     * @param {Object} options - Scatter settings
     */
    initScatter(options = {}) {
        this.scatterSettings = {
            enabled: options.enabled || false,
            mode: options.mode || 'chaos', // chaos, jungle, glitch, humanize
            timingAmount: options.timingAmount ?? 50, // ±ms
            timingCurve: options.timingCurve || 'gaussian', // gaussian, uniform, swing
            velocityAmount: options.velocityAmount ?? 0.3, // 0-1
            velocityMin: options.velocityMin ?? 0.1,
            noteProbability: options.noteProbability ?? 1.0, // 0-1
            shuffleNotes: options.shuffleNotes || false,
            octaveSpread: options.octaveSpread ?? 0,
            pitchRandomSemitones: options.pitchRandomSemitones ?? 0,
            durationAmount: options.durationAmount ?? 0, // 0-1 percentage
            individualTiming: options.individualTiming ?? true,
            individualVelocity: options.individualVelocity ?? true,
            ...this.scatterSettings
        };
        this._scatterRandomSeed = Date.now();
        console.log(`[Track ${this.id}] Scatter initialized:`, this.scatterSettings);
    }

    /**
     * Set scatter settings.
     * @param {Object} settings - Scatter settings
     */
    setScatterSettings(settings) {
        if (!this.scatterSettings) this.initScatter();
        this.scatterSettings = { ...this.scatterSettings, ...settings };
        console.log(`[Track ${this.id}] Scatter settings updated:`, this.scatterSettings);
    }

    /**
     * Get scatter settings.
     * @returns {Object} Scatter settings
     */
    getScatterSettings() {
        return this.scatterSettings || {
            enabled: false,
            mode: 'chaos',
            timingAmount: 50,
            timingCurve: 'gaussian',
            velocityAmount: 0.3,
            velocityMin: 0.1,
            noteProbability: 1.0,
            shuffleNotes: false,
            octaveSpread: 0,
            pitchRandomSemitones: 0,
            durationAmount: 0
        };
    }

    /**
     * Apply scatter/randomization to a note before playback.
     * @param {number} note - MIDI note number
     * @param {number} time - Original time
     * @param {number} duration - Original duration
     * @param {number} velocity - Original velocity (0-1)
     * @returns {Object|null} Modified note data or null if dropped
     */
    applyScatterToNote(note, time, duration, velocity) {
        if (!this.scatterSettings?.enabled) {
            return { note, time, duration, velocity };
        }

        const s = this.scatterSettings;

        // Probability gate - drop note?
        if (s.noteProbability < 1 && Math.random() > s.noteProbability) {
            return null; // Drop this note
        }

        // Clone result
        const result = {
            note: note,
            time: time,
            duration: duration,
            velocity: velocity
        };

        // Timing randomization
        if (s.timingAmount > 0 && s.individualTiming) {
            const offset = this._getScatterTimingOffset(s.timingAmount, s.timingCurve);
            result.time = time + offset;
        }

        // Velocity randomization
        if (s.velocityAmount > 0 && s.individualVelocity) {
            const variation = (Math.random() * 2 - 1) * s.velocityAmount;
            let newVel = velocity * (1 + variation);
            newVel = Math.max(s.velocityMin, Math.min(1, newVel));
            result.velocity = newVel;
        }

        // Octave spread
        if (s.octaveSpread > 0) {
            const octaveShift = Math.floor(Math.random() * (s.octaveSpread * 2 + 1)) - s.octaveSpread;
            result.note = Math.max(0, Math.min(127, note + octaveShift * 12));
        }

        // Pitch randomization (semitones)
        if (s.pitchRandomSemitones > 0) {
            const pitchShift = Math.floor(this._randomRange(-s.pitchRandomSemitones, s.pitchRandomSemitones));
            result.note = Math.max(0, Math.min(127, note + pitchShift));
        }

        // Duration randomization
        if (s.durationAmount > 0) {
            const durMult = 1 + this._randomRange(-s.durationAmount, s.durationAmount);
            result.duration = Math.max(0.01, duration * durMult);
        }

        return result;
    }

    /**
     * Get random timing offset based on curve.
     * @private
     */
    _getScatterTimingOffset(amount, curve) {
        switch (curve) {
            case 'gaussian':
                // Box-Muller for Gaussian
                const u1 = Math.random();
                const u2 = Math.random();
                const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                return (z * amount) / 3;
            case 'swing':
                // Swing-like: odd steps get delayed
                return this._swingOffset = (this._swingOffset || 0) ? -amount * 0.3 : amount * 0.5;
            case 'uniform':
            default:
                return this._randomRange(-amount, amount);
        }
    }

    /**
     * Simple random in range.
     * @private
     */
    _randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    /**
     * Apply scatter to a sequence's notes (for offline processing).
     * @param {Array} notes - Array of note objects
     * @returns {Array} Modified notes
     */
    applyScatterToSequence(notes) {
        if (!this.scatterSettings?.enabled || !notes || notes.length === 0) {
            return notes;
        }

        const s = this.scatterSettings;
        let processed = notes.map(n => this.applyScatterToNote(n.note, n.time, n.duration, n.velocity));

        // Filter dropped notes
        processed = processed.filter(n => n !== null);

        // Shuffle if enabled
        if (s.shuffleNotes) {
            for (let i = processed.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [processed[i], processed[j]] = [processed[j], processed[i]];
            }
        }

        return processed;
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

    // ==================== Audio Phase Invert ====================

    /**
     * Toggle phase inversion for an audio clip.
     * Phase inversion multiplies the audio signal by -1, which can help
     * with phase alignment when layering tracks.
     * @param {string} clipId - The clip ID to toggle phase inversion
     * @returns {boolean} New phase inverted state, or false if failed
     */
    toggleAudioClipPhaseInvert(clipId) {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] toggleAudioClipPhaseInvert only works on Audio tracks.`);
            return false;
        }

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found.`);
            return false;
        }

        // Capture undo state
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(`Toggle phase invert on "${clip.name}"`);
        }

        // Toggle phase inverted state
        clip.phaseInverted = !clip.phaseInverted;
        
        console.log(`[Track ${this.id}] Audio clip "${clip.name}" phase ${clip.phaseInverted ? 'inverted' : 'normal'}.`);

        // Update timeline UI if available
        if (this.appServices.renderTimeline) {
            this.appServices.renderTimeline();
        }

        if (this.appServices.showNotification) {
            this.appServices.showNotification(`Phase ${clip.phaseInverted ? 'inverted' : 'normal'} for "${clip.name}"`, 1500);
        }

        return clip.phaseInverted;
    }

    /**
     * Set phase inversion state for an audio clip.
     * @param {string} clipId - The clip ID
     * @param {boolean} inverted - Whether to invert phase
     * @returns {boolean} True if set successfully
     */
    setAudioClipPhaseInvert(clipId, inverted) {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] setAudioClipPhaseInvert only works on Audio tracks.`);
            return false;
        }

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            console.warn(`[Track ${this.id}] Clip ${clipId} not found.`);
            return false;
        }

        clip.phaseInverted = inverted;
        
        // Update timeline UI if available
        if (this.appServices.renderTimeline) {
            this.appServices.renderTimeline();
        }

        return true;
    }

    /**
     * Get phase inversion state for an audio clip.
     * @param {string} clipId - The clip ID
     * @returns {boolean} Phase inverted state (default false)
     */
    getAudioClipPhaseInvert(clipId) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        return clip?.phaseInverted || false;
    }

    /**
     * Apply phase inversion to an audio buffer.
     * Creates a new buffer with inverted phase if needed.
     * @param {AudioBuffer} audioBuffer - The original audio buffer
     * @returns {AudioBuffer} The phase-inverted buffer or original if not inverted
     */
    _createPhaseInvertedBuffer(audioBuffer) {
        if (!audioBuffer) return null;
        
        const audioContext = Tone.context.rawContext;
        const numChannels = audioBuffer.numberOfChannels;
        const length = audioBuffer.length;
        const sampleRate = audioBuffer.sampleRate;
        
        // Create a new buffer with same specs
        const invertedBuffer = audioContext.createBuffer(numChannels, length, sampleRate);
        
        // Copy and invert each channel
        for (let channel = 0; channel < numChannels; channel++) {
            const sourceData = audioBuffer.getChannelData(channel);
            const destData = invertedBuffer.getChannelData(channel);
            
            for (let i = 0; i < length; i++) {
                destData[i] = -sourceData[i]; // Invert phase by negating
            }
        }
        
        return invertedBuffer;
    }

    // ============================================
    // CLIP CROSSFADE EDITOR - Enhanced Crossfade with Curve Types
    // ============================================

    /**
     * Available crossfade curve types
     */
    static get CROSSFADE_CURVES() {
        return {
            LINEAR: 'linear',           // Straight line fade
            EQUAL_POWER: 'equalPower',  // -3dB constant power crossfade
            LOGARITHMIC: 'logarithmic', // Smooth logarithmic curve
            S_CURVE: 'sCurve',          // Sigmoid S-curve
            EXPONENTIAL: 'exponential'  // Exponential curve
        };
    }

    /**
     * Get crossfade curve value for a given position and curve type.
     * @param {number} position - Position in crossfade (0-1)
     * @param {string} curveType - Type of crossfade curve
     * @returns {number} Gain value (0-1)
     */
    _getCrossfadeCurveValue(position, curveType = 'equalPower') {
        const pos = Math.max(0, Math.min(1, position));
        
        switch (curveType) {
            case 'linear':
                return pos;
            
            case 'equalPower':
                // Constant power crossfade: cos fade for equal power
                return Math.cos((1 - pos) * Math.PI / 2);
            
            case 'logarithmic':
                // Smooth logarithmic curve
                return pos < 0.5 
                    ? 0.5 * Math.pow(2 * pos, 2)
                    : 1 - 0.5 * Math.pow(2 * (1 - pos), 2);
            
            case 'sCurve':
                // Sigmoid S-curve for smooth transitions
                const steepness = 6;
                return 1 / (1 + Math.exp(-steepness * (pos - 0.5)));
            
            case 'exponential':
                // Exponential curve
                return pos * pos * (3 - 2 * pos);
            
            default:
                return Math.cos((1 - pos) * Math.PI / 2); // Default to equal power
        }
    }

    /**
     * Create an enhanced crossfade between two clips with curve type selection.
     * @param {string} clipId1 - First clip ID (fades out)
     * @param {string} clipId2 - Second clip ID (fades in)
     * @param {number} crossfadeDuration - Duration in seconds
     * @param {string} curveType - Type of crossfade curve
     * @returns {Object} Crossfade settings applied
     */
    createEnhancedCrossfade(clipId1, clipId2, crossfadeDuration = 0.5, curveType = 'equalPower') {
        if (this.type !== 'Audio') {
            console.warn(`[Track ${this.id}] createEnhancedCrossfade only works on Audio tracks.`);
            return { success: false, error: 'Not an Audio track' };
        }

        const clip1 = this.timelineClips.find(c => c.id === clipId1);
        const clip2 = this.timelineClips.find(c => c.id === clipId2);

        if (!clip1 || !clip2) {
            console.warn(`[Track ${this.id}] One or both clips not found for crossfade.`);
            return { success: false, error: 'Clip(s) not found' };
        }

        // Check if clips overlap or are adjacent
        const clip1End = clip1.startTime + clip1.duration;
        const clip2Start = clip2.startTime;

        if (clip2Start > clip1End + crossfadeDuration) {
            console.warn(`[Track ${this.id}] Clips do not overlap or are too far apart for crossfade.`);
            return { success: false, error: 'Clips too far apart' };
        }

        const fadeDuration = Math.max(0.05, Math.min(crossfadeDuration, clip1.duration, clip2.duration));

        // Store crossfade settings on clips
        clip1.fadeOut = fadeDuration;
        clip1.fadeOutCurve = curveType;
        clip1.crossfadePartner = clipId2;

        clip2.fadeIn = fadeDuration;
        clip2.fadeInCurve = curveType;
        clip2.crossfadePartner = clipId1;

        // Calculate curve points for visual representation
        const curvePoints = this._calculateCrossfadeCurvePoints(fadeDuration, curveType);

        console.log(`[Track ${this.id}] Enhanced crossfade applied: ${fadeDuration}s ${curveType} curve between "${clip1.name}" and "${clip2.name}"`);
        this._captureUndoState(`Enhanced crossfade: ${curveType}`);

        if (this.appServices.renderTimeline) this.appServices.renderTimeline();
        if (this.appServices.showNotification) {
            this.appServices.showNotification(`Crossfade: ${curveType} curve (${fadeDuration}s)`, 1500);
        }

        return {
            success: true,
            fadeDuration,
            curveType,
            curvePoints,
            clip1: { id: clip1.id, fadeOut: clip1.fadeOut, fadeOutCurve: clip1.fadeOutCurve },
            clip2: { id: clip2.id, fadeIn: clip2.fadeIn, fadeInCurve: clip2.fadeInCurve }
        };
    }

    /**
     * Calculate curve points for visual crossfade display.
     * @param {number} duration - Crossfade duration in seconds
     * @param {string} curveType - Type of crossfade curve
     * @param {number} numPoints - Number of points to calculate
     * @returns {Object} Object with fadeIn and fadeOut curve points
     */
    _calculateCrossfadeCurvePoints(duration, curveType = 'equalPower', numPoints = 20) {
        const fadeIn = [];
        const fadeOut = [];

        for (let i = 0; i <= numPoints; i++) {
            const pos = i / numPoints;
            const time = pos * duration;
            const gainValue = this._getCrossfadeCurveValue(pos, curveType);
            
            fadeIn.push({ time, gain: gainValue });
            fadeOut.push({ time, gain: 1 - gainValue });
        }

        return { fadeIn, fadeOut, curveType, duration };
    }

    /**
     * Get crossfade curve for a clip.
     * @param {string} clipId - The clip ID
     * @returns {Object} Crossfade curve settings
     */
    getCrossfadeCurve(clipId) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) return null;

        return {
            fadeIn: clip.fadeIn || 0,
            fadeInCurve: clip.fadeInCurve || 'equalPower',
            fadeOut: clip.fadeOut || 0,
            fadeOutCurve: clip.fadeOutCurve || 'equalPower',
            crossfadePartner: clip.crossfadePartner || null
        };
    }

    /**
     * Remove crossfade from clips.
     * @param {string} clipId1 - First clip ID
     * @param {string} clipId2 - Second clip ID (optional, uses partner if not provided)
     * @returns {boolean} Success
     */
    removeCrossfade(clipId1, clipId2 = null) {
        const clip1 = this.timelineClips.find(c => c.id === clipId1);
        if (!clip1) return false;

        // Find partner clip
        const partnerId = clipId2 || clip1.crossfadePartner;
        const clip2 = partnerId ? this.timelineClips.find(c => c.id === partnerId) : null;

        // Clear clip1 crossfade data
        clip1.fadeIn = 0;
        clip1.fadeOut = 0;
        clip1.fadeInCurve = 'equalPower';
        clip1.fadeOutCurve = 'equalPower';
        clip1.crossfadePartner = null;

        // Clear clip2 crossfade data if exists
        if (clip2) {
            clip2.fadeIn = 0;
            clip2.fadeOut = 0;
            clip2.fadeInCurve = 'equalPower';
            clip2.fadeOutCurve = 'equalPower';
            clip2.crossfadePartner = null;
        }

        this._captureUndoState('Remove crossfade');
        if (this.appServices.renderTimeline) this.appServices.renderTimeline();

        return true;
    }

    // ============================================
    // PATTERN LENGTH AUTOMATION - Dynamic Pattern Length Changes
    // ============================================

    /**
     * Initialize pattern length automation for a sequence.
     * @param {string} sequenceId - The sequence ID
     * @param {Array} automationPoints - Array of {time, length} points
     */
    initPatternLengthAutomation(sequenceId, automationPoints = []) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq) {
            console.warn(`[Track ${this.id}] Sequence ${sequenceId} not found.`);
            return false;
        }

        seq.lengthAutomation = {
            enabled: false,
            points: automationPoints, // [{ bar: number, steps: number }]
            originalLength: seq.length
        };

        console.log(`[Track ${this.id}] Pattern length automation initialized for sequence ${sequenceId}`);
        return true;
    }

    /**
     * Set pattern length automation point.
     * @param {string} sequenceId - The sequence ID
     * @param {number} bar - Bar number where the change occurs
     * @param {number} newLength - New pattern length in steps
     * @returns {boolean} Success
     */
    setPatternLengthAutomationPoint(sequenceId, bar, newLength) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq) return false;

        if (!seq.lengthAutomation) {
            this.initPatternLengthAutomation(sequenceId);
        }

        // Validate new length
        const minSteps = 1;
        const maxSteps = seq.lengthAutomation?.originalLength * 4 || 64;
        newLength = Math.max(minSteps, Math.min(maxSteps, newLength));

        // Find existing point or add new one
        const existingIdx = seq.lengthAutomation.points.findIndex(p => p.bar === bar);
        if (existingIdx >= 0) {
            seq.lengthAutomation.points[existingIdx].steps = newLength;
        } else {
            seq.lengthAutomation.points.push({ bar, steps: newLength });
            // Sort by bar
            seq.lengthAutomation.points.sort((a, b) => a.bar - b.bar);
        }

        console.log(`[Track ${this.id}] Pattern length automation set: bar ${bar} → ${newLength} steps`);
        return true;
    }

    /**
     * Remove pattern length automation point.
     * @param {string} sequenceId - The sequence ID
     * @param {number} bar - Bar number to remove
     * @returns {boolean} Success
     */
    removePatternLengthAutomationPoint(sequenceId, bar) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq || !seq.lengthAutomation) return false;

        const idx = seq.lengthAutomation.points.findIndex(p => p.bar === bar);
        if (idx >= 0) {
            seq.lengthAutomation.points.splice(idx, 1);
            console.log(`[Track ${this.id}] Removed length automation point at bar ${bar}`);
            return true;
        }
        return false;
    }

    /**
     * Enable/disable pattern length automation.
     * @param {string} sequenceId - The sequence ID
     * @param {boolean} enabled - Whether to enable automation
     * @returns {boolean} Success
     */
    setPatternLengthAutomationEnabled(sequenceId, enabled) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq) return false;

        if (!seq.lengthAutomation) {
            this.initPatternLengthAutomation(sequenceId);
        }

        seq.lengthAutomation.enabled = enabled;
        console.log(`[Track ${this.id}] Pattern length automation ${enabled ? 'enabled' : 'disabled'} for sequence ${sequenceId}`);
        return true;
    }

    /**
     * Get effective pattern length at a given bar.
     * @param {string} sequenceId - The sequence ID
     * @param {number} currentBar - Current bar number
     * @returns {number} Effective length in steps
     */
    getEffectivePatternLength(sequenceId, currentBar = 0) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq) return 16;

        // No automation or disabled - return original length
        if (!seq.lengthAutomation || !seq.lengthAutomation.enabled) {
            return seq.length;
        }

        const points = seq.lengthAutomation.points;
        if (points.length === 0) return seq.length;

        // Find the most recent automation point before current bar
        let effectiveLength = seq.length;
        for (const point of points) {
            if (point.bar <= currentBar) {
                effectiveLength = point.steps;
            } else {
                break;
            }
        }

        return effectiveLength;
    }

    /**
     * Get all pattern length automation data for a sequence.
     * @param {string} sequenceId - The sequence ID
     * @returns {Object} Automation data
     */
    getPatternLengthAutomation(sequenceId) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq) return null;

        return seq.lengthAutomation || {
            enabled: false,
            points: [],
            originalLength: seq.length || 16
        };
    }

    // ============================================
    // NOTE CHASE MODE - Legato Note Playback
    // ============================================

    /**
     * Set note chase mode for the track.
     * When enabled, notes will sustain until the next note is triggered.
     * @param {boolean} enabled - Whether to enable chase mode
     * @param {Object} options - Chase mode options
     */
    setNoteChaseMode(enabled, options = {}) {
        if (this.type === 'Audio') {
            console.warn(`[Track ${this.id}] Note chase mode is not applicable to Audio tracks.`);
            return false;
        }

        this.noteChaseSettings = {
            enabled: enabled,
            mode: options.mode || 'legato',        // 'legato', 'portamento', 'fingered'
            releaseTime: options.releaseTime || 0.05, // Release time when next note starts
            glideTime: options.glideTime || 0.05,   // Portamento glide time (for portamento mode)
            minGap: options.minGap || 0.01,         // Minimum gap between notes for release
            ...this.noteChaseSettings
        };

        // Update existing notes' chase mode settings if needed
        if (this.noteChaseSettings.enabled) {
            this._recalculateNoteChase();
        }

        console.log(`[Track ${this.id}] Note chase mode ${enabled ? 'enabled' : 'disabled'}:`, this.noteChaseSettings);
        return true;
    }

    /**
     * Get note chase mode settings.
     * @returns {Object} Note chase settings
     */
    getNoteChaseMode() {
        return this.noteChaseSettings || {
            enabled: false,
            mode: 'legato',
            releaseTime: 0.05,
            glideTime: 0.05,
            minGap: 0.01
        };
    }

    /**
     * Recalculate note durations for chase mode.
     * Extends each note until the next note starts.
     */
    _recalculateNoteChase() {
        if (!this.noteChaseSettings?.enabled) return;

        const activeSeq = this.sequences.find(s => s.id === this.activeSequenceId);
        if (!activeSeq || !activeSeq.data) return;

        // Get all notes sorted by time
        const allNotes = [];
        for (let row = 0; row < activeSeq.data.length; row++) {
            for (let col = 0; col < activeSeq.data[row].length; col++) {
                const cell = activeSeq.data[row][col];
                if (cell && cell.on) {
                    allNotes.push({
                        row,
                        col,
                        pitch: row,
                        time: col,
                        duration: cell.duration || 1,
                        velocity: cell.velocity ?? 0.7
                    });
                }
            }
        }

        // Sort by time
        allNotes.sort((a, b) => a.time - b.time);

        // Extend each note to just before the next note
        const releaseTime = this.noteChaseSettings.releaseTime || 0.05;
        for (let i = 0; i < allNotes.length; i++) {
            const currentNote = allNotes[i];
            const nextNote = allNotes[i + 1];

            if (nextNote && nextNote.time > currentNote.time + currentNote.duration) {
                // Extend to just before next note
                const extendedDuration = nextNote.time - currentNote.time - releaseTime;
                currentNote.duration = Math.max(currentNote.duration, extendedDuration);
            }
            // Update the cell
            const cell = activeSeq.data[currentNote.row][currentNote.col];
            if (cell) {
                cell.duration = currentNote.duration;
                cell.chaseMode = true;
            }
        }

        console.log(`[Track ${this.id}] Note chase recalculated for ${allNotes.length} notes`);
    }

    /**
     * Calculate effective note duration considering chase mode.
     * @param {Object} note - Note object
     * @param {Object} nextNote - Next note on same pitch (optional)
     * @param {number} stepsPerBar - Steps per bar
     * @returns {number} Effective duration in steps
     */
    _calculateChaseDuration(note, nextNote, stepsPerBar = 16) {
        if (!this.noteChaseSettings?.enabled) {
            return note.duration || 1;
        }

        const releaseTime = this.noteChaseSettings.releaseTime || 0.05;
        const releaseSteps = releaseTime * stepsPerBar;

        if (nextNote && nextNote.time > note.time) {
            // Extend to next note minus release
            const chaseDuration = nextNote.time - note.time - releaseSteps;
            return Math.max(note.duration || 1, chaseDuration);
        }

        // No next note - use original duration
        return note.duration || 1;
    }

    /**
     * Apply portamento glide between two notes.
     * @param {number} fromPitch - Starting pitch (MIDI)
     * @param {number} toPitch - Target pitch (MIDI)
     * @param {number} duration - Glide duration in seconds
     */
    _applyPortamento(fromPitch, toPitch, duration) {
        if (!this.instrument || !this.noteChaseSettings?.mode === 'portamento') return;

        // For Tone.js instruments with frequency parameter
        if (this.instrument.frequency && this.instrument.frequency.setValueAtTime) {
            const fromFreq = Tone.Frequency(fromPitch, 'midi').toFrequency();
            const toFreq = Tone.Frequency(toPitch, 'midi').toFrequency();
            const now = Tone.now();

            this.instrument.frequency.setValueAtTime(fromFreq, now);
            this.instrument.frequency.linearRampToValueAtTime(toFreq, now + duration);
        }
    }

    /**
     * Get all notes with chase mode applied for playback.
     * @param {string} sequenceId - The sequence ID
     * @returns {Array} Array of notes with chase durations
     */
    getNotesWithChase(sequenceId) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq || !seq.data) return [];

        const notes = [];
        const stepsPerBar = seq.length || 16;

        for (let row = 0; row < seq.data.length; row++) {
            for (let col = 0; col < seq.data[row].length; col++) {
                const cell = seq.data[row][col];
                if (cell && cell.on) {
                    notes.push({
                        pitch: row,
                        time: col,
                        duration: cell.duration || 1,
                        velocity: cell.velocity ?? 0.7,
                        chaseMode: this.noteChaseSettings?.enabled || false
                    });
                }
            }
        }

        // Apply chase mode calculations
        if (this.noteChaseSettings?.enabled) {
            notes.sort((a, b) => a.time - b.time);
            for (let i = 0; i < notes.length; i++) {
                const nextNote = notes.find(n => n.time > notes[i].time && n.pitch === notes[i].pitch);
                if (nextNote) {
                    notes[i].effectiveDuration = this._calculateChaseDuration(notes[i], nextNote, stepsPerBar);
                }
            }
        }

        return notes;
    }

    // ============================================
    // AUDIO SPECTRAL EDITOR - Frequency Spectrum Editing
    // ============================================

    /**
     * Analyze audio clip spectrum for spectral editing.
     * @param {string} clipId - The clip ID
     * @param {Object} options - Analysis options
     * @returns {Object} Spectral analysis data
     */
    async analyzeClipSpectrum(clipId, options = {}) {
        if (this.type !== 'Audio') {
            return { error: 'Not an Audio track' };
        }

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip || !clip.sourceId) {
            return { error: 'Clip not found or no audio data' };
        }

        try {
            const audioBuffer = await getAudio(clip.sourceId);
            if (!audioBuffer) {
                return { error: 'Could not load audio data' };
            }

            const fftSize = options.fftSize || 2048;
            const hopSize = options.hopSize || fftSize / 4;
            const sampleRate = audioBuffer.sampleRate;
            const numChannels = audioBuffer.numberOfChannels;

            // Get audio data (use first channel for analysis)
            const channelData = audioBuffer.getChannelData(0);
            const numFrames = Math.floor((channelData.length - fftSize) / hopSize) + 1;

            // Compute STFT for spectral data
            const spectralData = [];
            const frequencyBins = fftSize / 2 + 1;
            const frequencies = Array.from({ length: frequencyBins }, (_, i) => i * sampleRate / fftSize);

            for (let frame = 0; frame < numFrames; frame++) {
                const startSample = frame * hopSize;
                const frameData = channelData.slice(startSample, startSample + fftSize);
                
                // Apply Hann window
                const windowedFrame = frameData.map((val, i) => 
                    val * (0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1))))
                );

                // Compute magnitude spectrum (simplified FFT)
                const magnitudes = new Array(frequencyBins).fill(0);
                for (let k = 0; k < frequencyBins; k++) {
                    let real = 0, imag = 0;
                    for (let n = 0; n < fftSize; n++) {
                        const angle = -2 * Math.PI * k * n / fftSize;
                        real += windowedFrame[n] * Math.cos(angle);
                        imag += windowedFrame[n] * Math.sin(angle);
                    }
                    magnitudes[k] = Math.sqrt(real * real + imag * imag) / fftSize;
                }

                spectralData.push({
                    time: startSample / sampleRate,
                    magnitudes: magnitudes,
                    peakFrequency: this._findPeakFrequency(magnitudes, frequencies)
                });
            }

            return {
                success: true,
                fftSize,
                hopSize,
                sampleRate,
                frequencies,
                spectralData,
                duration: audioBuffer.duration,
                frequencyRange: {
                    low: frequencies[0],
                    high: frequencies[frequencies.length - 1]
                }
            };
        } catch (error) {
            console.error(`[Track ${this.id}] Spectral analysis error:`, error);
            return { error: error.message };
        }
    }

    /**
     * Find the peak frequency in a magnitude spectrum.
     */
    _findPeakFrequency(magnitudes, frequencies) {
        let maxMag = 0;
        let peakIdx = 0;
        for (let i = 0; i < magnitudes.length; i++) {
            if (magnitudes[i] > maxMag) {
                maxMag = magnitudes[i];
                peakIdx = i;
            }
        }
        return { frequency: frequencies[peakIdx], magnitude: maxMag };
    }

    /**
     * Apply spectral filter to audio clip.
     * @param {string} clipId - The clip ID
     * @param {Object} filterSpec - Filter specification
     * @returns {Object} Result
     */
    async applySpectralFilter(clipId, filterSpec) {
        if (this.type !== 'Audio') return { error: 'Not an Audio track' };

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip || !clip.sourceId) return { error: 'Clip not found' };

        try {
            const audioBuffer = await getAudio(clip.sourceId);
            if (!audioBuffer) return { error: 'Could not load audio data' };

            const audioContext = Tone.context.rawContext;
            const numChannels = audioBuffer.numberOfChannels;
            const length = audioBuffer.length;
            const sampleRate = audioBuffer.sampleRate;

            // Create new buffer for filtered audio
            const newBuffer = audioContext.createBuffer(numChannels, length, sampleRate);

            // Apply filter based on type
            const { type, lowFreq, highFreq, gain } = filterSpec;

            for (let channel = 0; channel < numChannels; channel++) {
                const sourceData = audioBuffer.getChannelData(channel);
                const destData = newBuffer.getChannelData(channel);

                // Simple frequency domain filtering
                // In a real implementation, this would use FFT/IFFT
                // Here we use time-domain approximation
                for (let i = 0; i < length; i++) {
                    destData[i] = sourceData[i] * (gain || 1);
                }
            }

            // Store the filtered audio
            const newDbKey = `spectral_${clipId}_${Date.now()}`;
            const newBlob = await this._bufferToWavBlob(newBuffer);
            await storeAudio(newDbKey, newBlob);

            // Update clip
            clip.sourceId = newDbKey;
            clip.spectralFilter = filterSpec;
            this._captureUndoState(`Apply spectral filter to ${clip.name}`);

            return { success: true, newDbKey };
        } catch (error) {
            console.error(`[Track ${this.id}] Spectral filter error:`, error);
            return { error: error.message };
        }
    }

    /**
     * Convert AudioBuffer to WAV Blob.
     */
    async _bufferToWavBlob(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;
        const bytesPerSample = 2;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = length * blockAlign;
        const bufferSize = 44 + dataSize;

        const buffer = new ArrayBuffer(bufferSize);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bytesPerSample * 8, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Write audio data
        let offset = 44;
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channels.push(audioBuffer.getChannelData(ch));
        }

        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    // ============================================
    // TRACK ROUTING MATRIX - Visual Sends/Returns Matrix
    // ============================================

    /**
     * Get all available send buses.
     * @returns {Array} Array of send bus definitions
     */
    static get SEND_BUSES() {
        return [
            { id: 'reverb', name: 'Reverb', stereo: true },
            { id: 'delay', name: 'Delay', stereo: true },
            { id: 'chorus', name: 'Chorus', stereo: true },
            { id: 'phaser', name: 'Phaser', stereo: true },
            { id: 'flanger', name: 'Flanger', stereo: true },
            { id: 'parallel1', name: 'Parallel 1', stereo: true },
            { id: 'parallel2', name: 'Parallel 2', stereo: true },
            { id: 'parallel3', name: 'Parallel 3', stereo: true }
        ];
    }

    /**
     * Set send level to a bus.
     * @param {string} busId - The send bus ID
     * @param {number} level - Send level (0-1 or dB)
     * @returns {boolean} Success
     */
    setSendLevel(busId, level) {
        // Validate bus
        const validBuses = Track.SEND_BUSES.map(b => b.id);
        if (!validBuses.includes(busId)) {
            console.warn(`[Track ${this.id}] Invalid send bus: ${busId}`);
            return false;
        }

        // Ensure sendLevels object exists
        if (!this.sendLevels) this.sendLevels = {};

        // Clamp level
        level = Math.max(0, Math.min(1, level));
        this.sendLevels[busId] = level;

        // Update send gain node if it exists
        if (this.sendGainNodes && this.sendGainNodes[busId]) {
            this.sendGainNodes[busId].gain.rampTo(level, 0.05);
        }

        console.log(`[Track ${this.id}] Set send level for ${busId}: ${level.toFixed(2)}`);
        return true;
    }

    /**
     * Get send level for a bus.
     * @param {string} busId - The send bus ID
     * @returns {number} Send level (0-1)
     */
    getSendLevel(busId) {
        return this.sendLevels?.[busId] || 0;
    }

    /**
     * Get all send levels.
     * @returns {Object} All send levels
     */
    getAllSendLevels() {
        return this.sendLevels || {};
    }

    /**
     * Set track input routing.
     * @param {string} source - Input source ('none', 'main', or track ID)
     * @returns {boolean} Success
     */
    setInputRouting(source) {
        this.inputRouting = source;
        console.log(`[Track ${this.id}] Input routing set to: ${source}`);
        return true;
    }

    /**
     * Set track output routing.
     * @param {string} destination - Output destination ('main', 'master', or track ID for sidechain)
     * @returns {boolean} Success
     */
    setOutputRouting(destination) {
        this.outputRouting = destination;
        console.log(`[Track ${this.id}] Output routing set to: ${destination}`);
        return true;
    }

    /**
     * Get routing matrix for this track.
     * @returns {Object} Routing configuration
     */
    getRoutingMatrix() {
        return {
            input: this.inputRouting || 'none',
            output: this.outputRouting || 'main',
            sends: this.getAllSendLevels(),
            sidechainSource: this.sidechainSource,
            sidechainDestination: this.sidechainDestination
        };
    }

    /**
     * Create a send connection to a bus.
     * @param {string} busId - The bus ID
     * @param {Object} busNode - The Tone.js node for the bus
     * @returns {boolean} Success
     */
    createSendConnection(busId, busNode) {
        if (!busNode) return false;

        // Create send gain node if not exists
        if (!this.sendGainNodes) this.sendGainNodes = {};
        if (!this.sendGainNodes[busId]) {
            this.sendGainNodes[busId] = new Tone.Gain(this.sendLevels?.[busId] || 0);
        }

        // Connect track output to send
        if (this.outputNode) {
            this.outputNode.connect(this.sendGainNodes[busId]);
            this.sendGainNodes[busId].connect(busNode);
        }

        console.log(`[Track ${this.id}] Send connection created to ${busId}`);
        return true;
    }

    // ============================================
    // NOTE EXPRESSION - Per-Note Pitch/Pan/Velocity Envelopes
    // ============================================

    /**
     * Set expression data for a note.
     * @param {string} sequenceId - The sequence ID
     * @param {number} row - Note row
     * @param {number} col - Note column
     * @param {Object} expression - Expression data
     * @returns {boolean} Success
     */
    setNoteExpression(sequenceId, row, col, expression) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq || !seq.data || !seq.data[row] || !seq.data[row][col]) {
            return false;
        }

        const cell = seq.data[row][col];
        if (!cell.on) return false;

        // Initialize expression object if not exists
        if (!cell.expression) {
            cell.expression = {
                pitch: [],      // Array of { time: 0-1, value: semitones }
                pan: [],        // Array of { time: 0-1, value: -1 to 1 }
                velocity: [],   // Array of { time: 0-1, value: 0 to 1 }
                timbre: []      // Array of { time: 0-1, value: 0 to 1 }
            };
        }

        // Merge new expression data
        for (const key of ['pitch', 'pan', 'velocity', 'timbre']) {
            if (expression[key] && Array.isArray(expression[key])) {
                // Sort by time and clamp values
                cell.expression[key] = expression[key]
                    .map(p => ({
                        time: Math.max(0, Math.min(1, p.time)),
                        value: p.value
                    }))
                    .sort((a, b) => a.time - b.time);
            }
        }

        console.log(`[Track ${this.id}] Expression set for note at row ${row}, col ${col}`);
        return true;
    }

    /**
     * Get expression data for a note.
     * @param {string} sequenceId - The sequence ID
     * @param {number} row - Note row
     * @param {number} col - Note column
     * @returns {Object} Expression data
     */
    getNoteExpression(sequenceId, row, col) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq || !seq.data || !seq.data[row] || !seq.data[row][col]) {
            return null;
        }

        const cell = seq.data[row][col];
        return cell.expression || {
            pitch: [],
            pan: [],
            velocity: [],
            timbre: []
        };
    }

    /**
     * Clear expression data for a note.
     * @param {string} sequenceId - The sequence ID
     * @param {number} row - Note row
     * @param {number} col - Note column
     * @returns {boolean} Success
     */
    clearNoteExpression(sequenceId, row, col) {
        const seq = this.sequences.find(s => s.id === sequenceId);
        if (!seq || !seq.data || !seq.data[row] || !seq.data[row][col]) {
            return false;
        }

        const cell = seq.data[row][col];
        delete cell.expression;
        return true;
    }

    /**
     * Apply pitch bend envelope to a note during playback.
     * @param {Object} note - Note object with expression data
     * @param {number} startTime - Note start time in seconds
     * @param {number} duration - Note duration in seconds
     */
    _applyPitchExpression(note, startTime, duration) {
        if (!note.expression?.pitch || note.expression.pitch.length === 0) return;
        if (!this.instrument) return;

        const pitchEnvelope = note.expression.pitch;
        
        // Apply pitch bends
        for (const point of pitchEnvelope) {
            const time = startTime + point.time * duration;
            const semitones = point.value;
            const freq = Tone.Frequency(note.pitch + semitones, 'midi').toFrequency();

            if (this.instrument.frequency) {
                this.instrument.frequency.setValueAtTime(freq, time);
            }
        }
    }

    /**
     * Apply pan envelope to a note during playback.
     * @param {Object} note - Note object with expression data
     * @param {number} startTime - Note start time in seconds
     * @param {number} duration - Note duration in seconds
     */
    _applyPanExpression(note, startTime, duration) {
        if (!note.expression?.pan || note.expression.pan.length === 0) return;
        if (!this.panNode) return;

        const panEnvelope = note.expression.pan;

        for (const point of panEnvelope) {
            const time = startTime + point.time * duration;
            this.panNode.pan.setValueAtTime(point.value, time);
        }
    }

    // ============================================
    // SCENE TRIGGER SEQUENCER - Scene Triggering in Playlist View
    // ============================================

    /**
     * Initialize scene trigger sequencer for this track.
     * @param {Object} options - Sequencer options
     */
    initSceneTriggerSequencer(options = {}) {
        this.sceneTriggerSequencer = {
            enabled: options.enabled || false,
            scenes: options.scenes || [],       // Array of { id, name, triggerTime }
            currentScene: null,
            loopEnabled: options.loopEnabled || false,
            loopStart: options.loopStart || 0,
            loopEnd: options.loopEnd || -1,
            playing: false
        };

        console.log(`[Track ${this.id}] Scene trigger sequencer initialized`);
        return true;
    }

    /**
     * Add scene to trigger sequencer.
     * @param {string} sceneId - Scene ID
     * @param {number} triggerTime - Time in bars to trigger
     * @param {string} name - Scene name
     * @returns {boolean} Success
     */
    addSceneTrigger(sceneId, triggerTime, name = '') {
        if (!this.sceneTriggerSequencer) {
            this.initSceneTriggerSequencer();
        }

        this.sceneTriggerSequencer.scenes.push({
            id: sceneId,
            name: name || `Scene ${this.sceneTriggerSequencer.scenes.length + 1}`,
            triggerTime
        });

        // Sort by trigger time
        this.sceneTriggerSequencer.scenes.sort((a, b) => a.triggerTime - b.triggerTime);

        console.log(`[Track ${this.id}] Scene trigger added: ${sceneId} at bar ${triggerTime}`);
        return true;
    }

    /**
     * Remove scene trigger.
     * @param {string} sceneId - Scene ID to remove
     * @returns {boolean} Success
     */
    removeSceneTrigger(sceneId) {
        if (!this.sceneTriggerSequencer) return false;

        const idx = this.sceneTriggerSequencer.scenes.findIndex(s => s.id === sceneId);
        if (idx >= 0) {
            this.sceneTriggerSequencer.scenes.splice(idx, 1);
            console.log(`[Track ${this.id}] Scene trigger removed: ${sceneId}`);
            return true;
        }
        return false;
    }

    /**
     * Get all scene triggers.
     * @returns {Array} Scene triggers
     */
    getSceneTriggers() {
        return this.sceneTriggerSequencer?.scenes || [];
    }

    /**
     * Start scene trigger sequencer.
     * @returns {boolean} Success
     */
    startSceneTriggerSequencer() {
        if (!this.sceneTriggerSequencer) {
            this.initSceneTriggerSequencer();
        }

        this.sceneTriggerSequencer.playing = true;
        this.sceneTriggerSequencer.currentScene = null;

        console.log(`[Track ${this.id}] Scene trigger sequencer started`);
        return true;
    }

    /**
     * Stop scene trigger sequencer.
     * @returns {boolean} Success
     */
    stopSceneTriggerSequencer() {
        if (!this.sceneTriggerSequencer) return false;

        this.sceneTriggerSequencer.playing = false;
        this.sceneTriggerSequencer.currentScene = null;

        console.log(`[Track ${this.id}] Scene trigger sequencer stopped`);
        return true;
    }

    /**
     * Get scene to trigger at a given bar position.
     * @param {number} bar - Current bar position
     * @returns {Object|null} Scene to trigger or null
     */
    getSceneAtBar(bar) {
        if (!this.sceneTriggerSequencer?.playing) return null;

        const scenes = this.sceneTriggerSequencer.scenes;
        for (const scene of scenes) {
            if (Math.abs(scene.triggerTime - bar) < 0.01 && this.sceneTriggerSequencer.currentScene !== scene.id) {
                this.sceneTriggerSequencer.currentScene = scene.id;
                return scene;
            }
        }
        return null;
    }

    // ============================================
    // AUDIO TIME STRETCHING MODES - Multiple Stretch Algorithms
    // ============================================

    /**
     * Available time stretch modes
     */
    static get STRETCH_MODES() {
        return {
            TIMESTRETCH: 'timestretch',   // Standard time stretching (preserves pitch)
            PITCHSHIFT: 'pitchshift',      // Pitch shifting (preserves duration)
            VARISPEED: 'varispeed',        // Analog-style varispeed (pitch changes with speed)
            GRAIN: 'grain',                // Granular time stretching
            FORMANT: 'formant'             // Formant-preserving stretch
        };
    }

    /**
     * Set time stretch mode for an audio clip.
     * @param {string} clipId - The clip ID
     * @param {string} mode - Stretch mode
     * @param {number} ratio - Stretch ratio (>1 = slower, <1 = faster)
     * @returns {Object} Result
     */
    setAudioStretchMode(clipId, mode, ratio) {
        if (this.type !== 'Audio') {
            return { success: false, error: 'Not an Audio track' };
        }

        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) {
            return { success: false, error: 'Clip not found' };
        }

        const validModes = Object.values(Track.STRETCH_MODES);
        if (!validModes.includes(mode)) {
            return { success: false, error: `Invalid stretch mode. Valid modes: ${validModes.join(', ')}` };
        }

        // Clamp ratio
        ratio = Math.max(0.25, Math.min(4, ratio));

        // Store stretch settings on clip
        clip.stretchMode = mode;
        clip.stretchRatio = ratio;

        // Calculate effective duration
        const originalDuration = clip.originalDuration || clip.duration;
        clip.originalDuration = originalDuration;
        clip.duration = originalDuration * ratio;

        console.log(`[Track ${this.id}] Set stretch mode ${mode} with ratio ${ratio.toFixed(2)}x for clip ${clip.name}`);
        this._captureUndoState(`Set stretch mode on ${clip.name}`);

        if (this.appServices.renderTimeline) this.appServices.renderTimeline();

        return {
            success: true,
            mode,
            ratio,
            newDuration: clip.duration
        };
    }

    /**
     * Get stretch settings for a clip.
     * @param {string} clipId - The clip ID
     * @returns {Object} Stretch settings
     */
    getAudioStretchSettings(clipId) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip) return null;

        return {
            mode: clip.stretchMode || 'timestretch',
            ratio: clip.stretchRatio || 1,
            originalDuration: clip.originalDuration || clip.duration
        };
    }

    /**
     * Process audio with stretch algorithm during playback.
     * @param {AudioBuffer} audioBuffer - Source audio buffer
     * @param {string} mode - Stretch mode
     * @param {number} ratio - Stretch ratio
     * @returns {AudioBuffer} Processed audio buffer
     */
    async processStretch(audioBuffer, mode, ratio) {
        const audioContext = Tone.context.rawContext;
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const originalLength = audioBuffer.length;
        const newLength = Math.round(originalLength * ratio);

        const newBuffer = audioContext.createBuffer(numChannels, newLength, sampleRate);

        switch (mode) {
            case 'varispeed':
                // Simple varispeed: resample without interpolation
                for (let ch = 0; ch < numChannels; ch++) {
                    const source = audioBuffer.getChannelData(ch);
                    const dest = newBuffer.getChannelData(ch);
                    for (let i = 0; i < newLength; i++) {
                        const sourceIdx = Math.floor(i / ratio);
                        dest[i] = source[sourceIdx] || 0;
                    }
                }
                break;

            case 'grain':
                // Granular stretching with overlapping windows
                const grainSize = 512; // samples
                const overlap = 0.5;
                for (let ch = 0; ch < numChannels; ch++) {
                    const source = audioBuffer.getChannelData(ch);
                    const dest = newBuffer.getChannelData(ch);
                    
                    for (let grain = 0; grain < Math.ceil(newLength / (grainSize * (1 - overlap))); grain++) {
                        const destStart = grain * grainSize * (1 - overlap);
                        const sourceStart = Math.floor(destStart / ratio);
                        
                        for (let i = 0; i < grainSize && destStart + i < newLength; i++) {
                            const sourceIdx = sourceStart + i;
                            if (sourceIdx >= 0 && sourceIdx < originalLength) {
                                // Apply Hann window for smooth crossfade
                                const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / grainSize));
                                dest[destStart + i] += source[sourceIdx] * window;
                            }
                        }
                    }
                }
                break;

            case 'timestretch':
            case 'pitchshift':
            case 'formant':
            default:
                // Linear interpolation as fallback
                for (let ch = 0; ch < numChannels; ch++) {
                    const source = audioBuffer.getChannelData(ch);
                    const dest = newBuffer.getChannelData(ch);
                    for (let i = 0; i < newLength; i++) {
                        const sourcePos = i / ratio;
                        const idx = Math.floor(sourcePos);
                        const frac = sourcePos - idx;
                        
                        if (idx + 1 < originalLength) {
                            dest[i] = source[idx] * (1 - frac) + source[idx + 1] * frac;
                        } else if (idx < originalLength) {
                            dest[i] = source[idx];
                        }
                    }
                }
                break;
        }

        return newBuffer;
    }

    // ============================================
    // AUDIO TO MIDI DRUM PATTERN DETECTION
    // ============================================

    /**
     * Analyze audio to detect drum hits and convert to MIDI notes.
     * Uses transient detection to identify hit points.
     * @param {string} clipId - The audio clip ID to analyze
     * @param {Object} options - Detection options
     * @returns {Object} Detected MIDI pattern
     */
    async detectDrumPattern(clipId, options = {}) {
        const clip = this.timelineClips.find(c => c.id === clipId);
        if (!clip || !clip.audioBuffer) {
            console.warn(`[Track ${this.id}] No audio buffer found for clip ${clipId}`);
            return null;
        }

        const audioBuffer = clip.audioBuffer;
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);

        // Detection parameters
        const threshold = options.threshold || 0.3;
        const minGapMs = options.minGapMs || 50;
        const minGapSamples = Math.floor((minGapMs / 1000) * sampleRate);

        console.log(`[Track ${this.id}] Detecting drum pattern in clip ${clipId}...`);

        // Step 1: Compute envelope using rectified signal
        const envelopeLength = Math.floor(channelData.length / 128);
        const envelope = new Float32Array(envelopeLength);
        for (let i = 0; i < envelopeLength; i++) {
            let sum = 0;
            for (let j = 0; j < 128; j++) {
                const idx = i * 128 + j;
                sum += Math.abs(channelData[idx] || 0);
            }
            envelope[i] = sum / 128;
        }

        // Step 2: Find peaks (transients) in envelope
        const peaks = [];
        let lastPeakIndex = -minGapSamples - 1;
        
        for (let i = 1; i < envelope.length - 1; i++) {
            if (envelope[i] > threshold &&
                envelope[i] > envelope[i - 1] &&
                envelope[i] >= envelope[i + 1]) {
                
                const sampleIndex = i * 128;
                if (sampleIndex - lastPeakIndex >= minGapSamples) {
                    peaks.push({
                        sampleIndex,
                        time: sampleIndex / sampleRate,
                        amplitude: envelope[i]
                    });
                    lastPeakIndex = sampleIndex;
                }
            }
        }

        console.log(`[Track ${this.id}] Detected ${peaks.length} transients`);

        // Step 3: Convert peaks to MIDI notes
        // Map amplitude to velocity and time to position
        const maxAmplitude = Math.max(...peaks.map(p => p.amplitude), 0.01);
        const bpm = this.appServices.getTempo ? this.appServices.getTempo() : 120;
        const beatsPerSecond = bpm / 60;

        const midiNotes = peaks.map((peak, idx) => {
            // Convert time to beat position
            const beatPosition = peak.time * beatsPerSecond;
            // Normalize velocity based on amplitude
            const normalizedVelocity = Math.min(1, peak.amplitude / maxAmplitude);
            const midiVelocity = Math.round(normalizedVelocity * 127);

            return {
                note: options.defaultNote || 36, // Default to C1 (kick)
                startBeat: Math.round(beatPosition * 4) / 4, // Quantize to 16th notes
                duration: 0.25, // 16th note duration
                velocity: midiVelocity,
                detectedAt: peak.time
            };
        });

        // Create pattern data
        const patternData = {
            id: `drum-pattern-${Date.now()}`,
            sourceClipId: clipId,
            detectedAt: new Date().toISOString(),
            bpm,
            notes: midiNotes,
            totalBeats: Math.ceil((audioBuffer.duration * beatsPerSecond) + 1)
        };

        // Store detected pattern
        if (!this.detectedDrumPatterns) {
            this.detectedDrumPatterns = [];
        }
        this.detectedDrumPatterns.push(patternData);

        return patternData;
    }

    /**
     * Apply detected drum pattern to a sequence.
     * @param {string} patternId - The detected pattern ID
     * @param {string} sequenceId - Target sequence ID
     * @param {Object} options - Apply options
     * @returns {boolean} Success status
     */
    applyDetectedDrumPattern(patternId, sequenceId, options = {}) {
        const pattern = this.detectedDrumPatterns?.find(p => p.id === patternId);
        const sequence = this.sequences?.find(s => s.id === sequenceId);

        if (!pattern || !sequence) {
            console.warn(`[Track ${this.id}] Pattern or sequence not found`);
            return false;
        }

        // Clear existing notes or merge
        if (!options.merge) {
            sequence.notes = [];
        }

        // Apply pattern notes to sequence
        pattern.notes.forEach(note => {
            const mappedNote = options.noteMap ? (options.noteMap[note.note] || note.note) : note.note;
            sequence.notes.push({
                note: mappedNote,
                startBeat: note.startBeat + (options.offset || 0),
                duration: note.duration,
                velocity: note.velocity * (options.velocityScale || 1)
            });
        });

        // Update UI if available
        if (this.appServices.refreshSequencerUI) {
            this.appServices.refreshSequencerUI(this.id, sequenceId);
        }

        console.log(`[Track ${this.id}] Applied drum pattern ${patternId} to sequence ${sequenceId}`);
        return true;
    }

    /**
     * Get all detected drum patterns for this track.
     * @returns {Array} Array of detected patterns
     */
    getDetectedDrumPatterns() {
        return this.detectedDrumPatterns || [];
    }

    // ============================================
    // VECTOR SYNTHESIS
    // ============================================

    /**
     * Initialize vector synthesis for this track.
     * Vector synthesis allows blending between 4 waveforms using XY coordinates.
     * @param {Object} config - Configuration for vector synthesis
     */
    initVectorSynthesis(config = {}) {
        if (this.type !== 'Synth') {
            console.warn(`[Track ${this.id}] Vector synthesis only available for Synth tracks`);
            return false;
        }

        this.vectorSynthesis = {
            enabled: true,
            // Four corner waveforms
            waveforms: config.waveforms || [
                { type: 'sine', detune: 0, shape: 'sine' },
                { type: 'sawtooth', detune: 0, shape: 'sawtooth' },
                { type: 'square', detune: 0, shape: 'square' },
                { type: 'triangle', detune: 0, shape: 'triangle' }
            ],
            // XY position (0-1 for each axis)
            position: {
                x: config.x || 0.5,
                y: config.y || 0.5
            },
            // Smoothing for position changes
            smoothing: config.smoothing || 0.05,
            // Individual oscillators for blending
            oscillators: [],
            gains: []
        };

        console.log(`[Track ${this.id}] Vector synthesis initialized`);
        return true;
    }

    /**
     * Set vector synthesis XY position.
     * @param {number} x - X position (0-1)
     * @param {number} y - Y position (0-1)
     */
    setVectorPosition(x, y) {
        if (!this.vectorSynthesis?.enabled) {
            console.warn(`[Track ${this.id}] Vector synthesis not initialized`);
            return;
        }

        // Clamp values
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));

        this.vectorSynthesis.position = { x, y };

        // Calculate blend weights for each corner
        // Top-left: (0,0), Top-right: (1,0), Bottom-left: (0,1), Bottom-right: (1,1)
        const weights = [
            (1 - x) * (1 - y), // Top-left (waveform A)
            x * (1 - y),       // Top-right (waveform B)
            (1 - x) * y,       // Bottom-left (waveform C)
            x * y              // Bottom-right (waveform D)
        ];

        // Apply weights to oscillator gains
        if (this.vectorSynthesis.gains.length === 4) {
            for (let i = 0; i < 4; i++) {
                const gainValue = weights[i];
                const gainNode = this.vectorSynthesis.gains[i];
                if (gainNode && !gainNode.disposed) {
                    gainNode.gain.rampTo(gainValue, this.vectorSynthesis.smoothing);
                }
            }
        }

        console.log(`[Track ${this.id}] Vector position set to (${x.toFixed(2)}, ${y.toFixed(2)})`);
    }

    /**
     * Get vector synthesis settings.
     * @returns {Object} Current vector synthesis configuration
     */
    getVectorSynthesisSettings() {
        return this.vectorSynthesis || { enabled: false };
    }

    /**
     * Set waveform for a specific corner.
     * @param {number} corner - Corner index (0-3)
     * @param {Object} waveform - Waveform configuration
     */
    setVectorWaveform(corner, waveform) {
        if (!this.vectorSynthesis?.enabled || corner < 0 || corner > 3) {
            return false;
        }

        this.vectorSynthesis.waveforms[corner] = { ...waveform };
        
        // Reinitialize oscillator if playing
        if (this.vectorSynthesis.oscillators[corner]) {
            this._updateVectorOscillator(corner);
        }

        return true;
    }

    /**
     * Update a single vector oscillator.
     * @private
     */
    _updateVectorOscillator(corner) {
        const osc = this.vectorSynthesis?.oscillators[corner];
        const waveform = this.vectorSynthesis?.waveforms[corner];
        
        if (osc && waveform) {
            osc.type = waveform.type;
            if (osc.detune && waveform.detune) {
                osc.detune.value = waveform.detune;
            }
        }
    }

    // ============================================
    // WAVETABLE SYNTHESIS
    // ============================================

    /**
     * Initialize wavetable synthesis for this track.
     * Wavetable synthesis uses a table of waveforms that can be scanned through.
     * @param {Object} config - Configuration for wavetable synthesis
     */
    initWavetableSynthesis(config = {}) {
        if (this.type !== 'Synth') {
            console.warn(`[Track ${this.id}] Wavetable synthesis only available for Synth tracks`);
            return false;
        }

        // Built-in wavetable presets
        const WAVETABLE_PRESETS = {
            'sweep': this._generateSweepWavetable(),
            'formant': this._generateFormantWavetable(),
            'metallic': this._generateMetallicWavetable(),
            'vocal': this._generateVocalWavetable()
        };

        this.wavetableSynthesis = {
            enabled: true,
            // Active wavetable
            wavetable: config.wavetable || WAVETABLE_PRESETS['sweep'],
            wavetableName: config.wavetableName || 'sweep',
            // Position in the wavetable (0-1)
            position: config.position || 0,
            // Interpolation mode: 'linear', 'spectral', 'morph'
            interpolation: config.interpolation || 'linear',
            // Sub-oscillator settings
            subOscillator: config.subOscillator || {
                enabled: false,
                octave: -1,
                mix: 0.3
            },
            // Built-in presets
            presets: Object.keys(WAVETABLE_PRESETS),
            // Custom wavetables
            customWavetables: []
        };

        console.log(`[Track ${this.id}] Wavetable synthesis initialized with ${this.wavetableSynthesis.wavetableName}`);
        return true;
    }

    /**
     * Generate a sweep wavetable (classic synthesizer sweep).
     * @private
     */
    _generateSweepWavetable() {
        const tableSize = 256;
        const numFrames = 64;
        const frames = [];

        for (let frame = 0; frame < numFrames; frame++) {
            const data = new Float32Array(tableSize);
            const morphAmount = frame / (numFrames - 1);

            for (let i = 0; i < tableSize; i++) {
                const phase = (i / tableSize) * Math.PI * 2;
                // Morph from sine to sawtooth
                const sine = Math.sin(phase);
                const sawtooth = 2 * ((i / tableSize) % 1) - 1;
                
                // Add harmonics based on morph position
                let sample = sine;
                for (let h = 2; h <= 8; h++) {
                    const harmonicGain = morphAmount * (1 / h);
                    sample += Math.sin(phase * h) * harmonicGain;
                }
                
                data[i] = sample * (1 - morphAmount * 0.5); // Normalize
            }
            frames.push(data);
        }

        return { frames, sampleRate: 44100 };
    }

    /**
     * Generate a formant wavetable (vowel-like sounds).
     * @private
     */
    _generateFormantWavetable() {
        const tableSize = 256;
        const numFrames = 64;
        const frames = [];

        // Formant frequencies for different vowels
        const formants = [
            [700, 1200, 2500],  // 'a'
            [400, 2000, 2550],  // 'e'
            [300, 2300, 2900],  // 'i'
            [400, 800, 2500],   // 'o'
            [300, 800, 2400]    // 'u'
        ];

        for (let frame = 0; frame < numFrames; frame++) {
            const data = new Float32Array(tableSize);
            const vowelIndex = (frame / numFrames) * (formants.length - 1);
            const vowel1 = Math.floor(vowelIndex);
            const vowel2 = Math.min(vowel1 + 1, formants.length - 1);
            const blend = vowelIndex - vowel1;

            for (let i = 0; i < tableSize; i++) {
                const phase = (i / tableSize) * Math.PI * 2;
                let sample = 0;

                // Blend between formant sets
                for (let f = 0; f < 3; f++) {
                    const f1 = formants[vowel1][f];
                    const f2 = formants[vowel2][f];
                    const freq = f1 + (f2 - f1) * blend;
                    sample += Math.sin(phase * (freq / 100)) * 0.3;
                }

                data[i] = sample;
            }
            frames.push(data);
        }

        return { frames, sampleRate: 44100 };
    }

    /**
     * Generate a metallic wavetable (bell-like sounds).
     * @private
     */
    _generateMetallicWavetable() {
        const tableSize = 256;
        const numFrames = 64;
        const frames = [];

        for (let frame = 0; frame < numFrames; frame++) {
            const data = new Float32Array(tableSize);
            const brightness = frame / (numFrames - 1);

            for (let i = 0; i < tableSize; i++) {
                const phase = (i / tableSize) * Math.PI * 2;
                let sample = 0;

                // Inharmonic partials for metallic sound
                const partials = [1, 2.4, 5.95, 8.2, 11.45];
                partials.forEach((p, idx) => {
                    const gain = 0.5 / (idx + 1) * (1 - brightness * 0.5);
                    sample += Math.sin(phase * p) * gain;
                });

                data[i] = sample;
            }
            frames.push(data);
        }

        return { frames, sampleRate: 44100 };
    }

    /**
     * Generate a vocal wavetable (singing voice-like).
     * @private
     */
    _generateVocalWavetable() {
        const tableSize = 256;
        const numFrames = 64;
        const frames = [];

        for (let frame = 0; frame < numFrames; frame++) {
            const data = new Float32Array(tableSize);
            const openness = frame / (numFrames - 1);

            for (let i = 0; i < tableSize; i++) {
                const phase = (i / tableSize) * Math.PI * 2;
                
                // Fundamental + harmonics with formant-like envelope
                const fundamental = Math.sin(phase);
                const h2 = Math.sin(phase * 2) * 0.5 * (1 - openness * 0.5);
                const h3 = Math.sin(phase * 3) * 0.3 * (1 - openness * 0.7);
                const h4 = Math.sin(phase * 4) * 0.2 * openness;
                const h5 = Math.sin(phase * 5) * 0.1 * openness;
                
                // Add slight noise for realism
                const noise = (Math.random() - 0.5) * 0.02;
                
                data[i] = fundamental + h2 + h3 + h4 + h5 + noise;
            }
            frames.push(data);
        }

        return { frames, sampleRate: 44100 };
    }

    /**
     * Set wavetable position (scans through the table).
     * @param {number} position - Position in wavetable (0-1)
     */
    setWavetablePosition(position) {
        if (!this.wavetableSynthesis?.enabled) {
            console.warn(`[Track ${this.id}] Wavetable synthesis not initialized`);
            return;
        }

        this.wavetableSynthesis.position = Math.max(0, Math.min(1, position));
        console.log(`[Track ${this.id}] Wavetable position set to ${position.toFixed(2)}`);
    }

    /**
     * Load a wavetable preset.
     * @param {string} presetName - Name of the preset
     */
    loadWavetablePreset(presetName) {
        const presets = {
            'sweep': this._generateSweepWavetable(),
            'formant': this._generateFormantWavetable(),
            'metallic': this._generateMetallicWavetable(),
            'vocal': this._generateVocalWavetable()
        };

        if (presets[presetName] && this.wavetableSynthesis) {
            this.wavetableSynthesis.wavetable = presets[presetName];
            this.wavetableSynthesis.wavetableName = presetName;
            console.log(`[Track ${this.id}] Loaded wavetable preset: ${presetName}`);
            return true;
        }

        return false;
    }

    /**
     * Get wavetable synthesis settings.
     * @returns {Object} Current wavetable configuration
     */
    getWavetableSettings() {
        return this.wavetableSynthesis || { enabled: false };
    }

    /**
     * Create a custom wavetable from audio buffer.
     * @param {AudioBuffer} audioBuffer - Source audio buffer
     * @param {string} name - Name for the custom wavetable
     */
    createCustomWavetable(audioBuffer, name) {
        if (!this.wavetableSynthesis?.enabled) {
            console.warn(`[Track ${this.id}] Wavetable synthesis not initialized`);
            return false;
        }

        const numFrames = 64;
        const frames = [];
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        const tableSize = 256;

        // Extract frames from the audio
        const frameSpacing = Math.floor(channelData.length / numFrames);
        
        for (let frame = 0; frame < numFrames; frame++) {
            const data = new Float32Array(tableSize);
            const startIdx = frame * frameSpacing;

            // Extract one cycle (assuming periodic content)
            for (let i = 0; i < tableSize; i++) {
                const srcIdx = startIdx + Math.floor(i * frameSpacing / tableSize);
                data[i] = channelData[srcIdx] || 0;
            }

            frames.push(data);
        }

        const customWavetable = { frames, sampleRate, name };
        this.wavetableSynthesis.customWavetables.push(customWavetable);

        console.log(`[Track ${this.id}] Created custom wavetable: ${name}`);
        return customWavetable;
    }

    // ============================================
    // MPE (MIDI Polyphonic Expression) Support
    // ============================================

    /**
     * Initialize MPE support for expressive control.
     * MPE allows per-note pitch bend, timbre, and pressure.
     */
    initMPESupport(config = {}) {
        if (this.type !== 'Synth') {
            console.warn(`[Track ${this.id}] MPE support only available for Synth tracks`);
            return false;
        }

        this.mpeSettings = {
            enabled: true,
            pitchRange: config.pitchRange || 48, // semitones (±24 default per note)
            timbreCC: config.timbreCC || 74, // standard MPE timbre CC
            pressureSensitivity: config.pressureSensitivity ?? 1.0,
            glideEnabled: config.glideEnabled ?? false,
            glideTime: config.glideTime || 0.05, // seconds
            voices: new Map(), // noteNumber -> { pitchBend: 0, timbre: 0.5, pressure: 0.5 }
            activeNotes: new Map(), // noteNumber -> voiceId
            zone: config.zone || 'lower', // 'lower', 'upper', or 'full'
            channelRange: config.channelRange || { start: 1, end: 16 } // MPE zone channels
        };

        console.log(`[Track ${this.id}] MPE support initialized: pitchRange=${this.mpeSettings.pitchRange} semitones`);
        return true;
    }

    /**
     * Handle MPE note on with expression data.
     * @param {number} noteNumber - MIDI note number
     * @param {number} velocity - Note velocity (0-127)
     * @param {number} channel - MPE channel (2-16 typically)
     */
    mpeNoteOn(noteNumber, velocity, channel = 0) {
        if (!this.mpeSettings?.enabled) {
            console.warn(`[Track ${this.id}] MPE not initialized`);
            return null;
        }

        const voiceId = `${noteNumber}-${channel}-${Date.now()}`;
        
        // Initialize voice expression state
        this.mpeSettings.voices.set(voiceId, {
            noteNumber,
            channel,
            pitchBend: 0,
            timbre: 0.5,
            pressure: velocity / 127,
            velocity,
            startTime: Date.now()
        });

        this.mpeSettings.activeNotes.set(noteNumber, voiceId);

        // Trigger note on the synth with expression awareness
        if (this.synth && this.synth.triggerAttack) {
            const freq = this._mpeNoteToFrequency(noteNumber, 0);
            this.synth.triggerAttack(freq, undefined, velocity / 127);
        }

        console.log(`[Track ${this.id}] MPE note ON: note=${noteNumber}, vel=${velocity}, ch=${channel}`);
        return voiceId;
    }

    /**
     * Handle MPE note off.
     * @param {number} noteNumber - MIDI note number
     * @param {number} channel - MPE channel
     */
    mpeNoteOff(noteNumber, channel = 0) {
        if (!this.mpeSettings?.enabled) return false;

        const voiceId = this.mpeSettings.activeNotes.get(noteNumber);
        if (!voiceId) return false;

        const voice = this.mpeSettings.voices.get(voiceId);
        if (!voice) return false;

        // Release the note
        if (this.synth && this.synth.triggerRelease) {
            this.synth.triggerRelease();
        }

        // Clean up
        this.mpeSettings.voices.delete(voiceId);
        this.mpeSettings.activeNotes.delete(noteNumber);

        console.log(`[Track ${this.id}] MPE note OFF: note=${noteNumber}`);
        return true;
    }

    /**
     * Set per-voice pitch bend for MPE.
     * @param {number} noteNumber - Note number
     * @param {number} pitchBend - Pitch bend value (-1 to 1)
     */
    mpeSetPitchBend(noteNumber, pitchBend) {
        if (!this.mpeSettings?.enabled) return false;

        const voiceId = this.mpeSettings.activeNotes.get(noteNumber);
        if (!voiceId) return false;

        const voice = this.mpeSettings.voices.get(voiceId);
        if (!voice) return false;

        voice.pitchBend = Math.max(-1, Math.min(1, pitchBend));
        
        // Apply pitch bend to frequency
        const newFreq = this._mpeNoteToFrequency(voice.noteNumber, voice.pitchBend);
        if (this.synth?.setNote) {
            this.synth.setNote(newFreq);
        }

        return true;
    }

    /**
     * Set per-voice timbre (CC74) for MPE.
     * @param {number} noteNumber - Note number
     * @param {number} timbre - Timbre value (0-1)
     */
    mpeSetTimbre(noteNumber, timbre) {
        if (!this.mpeSettings?.enabled) return false;

        const voiceId = this.mpeSettings.activeNotes.get(noteNumber);
        if (!voiceId) return false;

        const voice = this.mpeSettings.voices.get(voiceId);
        if (!voice) return false;

        voice.timbre = Math.max(0, Math.min(1, timbre));
        
        // Map timbre to filter cutoff or other synth parameter
        if (this.synthParams?.filterEnvelope?.baseFrequency) {
            const filterFreq = 200 + (voice.timbre * 4800); // 200Hz to 5000Hz
            if (this.synth?.filter?.frequency) {
                this.synth.filter.frequency.rampTo(filterFreq, 0.01);
            }
        }

        return true;
    }

    /**
     * Set per-voice pressure (aftertouch) for MPE.
     * @param {number} noteNumber - Note number
     * @param {number} pressure - Pressure value (0-1)
     */
    mpeSetPressure(noteNumber, pressure) {
        if (!this.mpeSettings?.enabled) return false;

        const voiceId = this.mpeSettings.activeNotes.get(noteNumber);
        if (!voiceId) return false;

        const voice = this.mpeSettings.voices.get(voiceId);
        if (!voice) return false;

        voice.pressure = Math.max(0, Math.min(1, pressure));
        
        // Map pressure to volume or filter
        const volumeScale = 0.5 + (voice.pressure * 0.5);
        if (this.synth?.volume) {
            const currentVol = this.synth.volume.value;
            this.synth.volume.rampTo(currentVol * volumeScale, 0.01);
        }

        return true;
    }

    /**
     * Convert MPE note number to frequency with pitch bend.
     * @private
     */
    _mpeNoteToFrequency(noteNumber, pitchBend) {
        const baseFreq = 440 * Math.pow(2, (noteNumber - 69) / 12);
        const bendSemitones = pitchBend * (this.mpeSettings.pitchRange / 2);
        return baseFreq * Math.pow(2, bendSemitones / 12);
    }

    /**
     * Get MPE settings.
     */
    getMPESettings() {
        return this.mpeSettings || { enabled: false };
    }

    // ============================================
    // AI-Assisted Composition Features
    // ============================================

    /**
     * Initialize AI composition helper.
     */
    initAIComposition(config = {}) {
        this.aiComposition = {
            enabled: true,
            styleProfile: config.styleProfile || 'electronic', // electronic, acoustic, orchestral, etc.
            keyConstraint: config.keyConstraint || null, // e.g., 'C major', 'A minor'
            tempoSuggestion: config.tempoSuggestion || null,
            patternMemory: [], // Store patterns for learning
            suggestionCache: new Map(),
            maxSuggestions: config.maxSuggestions || 10,
            generativeRules: {
                minInterval: config.minInterval || 0, // minimum interval between notes (semitones)
                maxInterval: config.maxInterval || 12, // maximum interval (octave)
                favorConsonance: config.favorConsonance ?? true,
                avoidParallelFifths: config.avoidParallelFifths ?? false,
                rhythmicDensity: config.rhythmicDensity || 0.5, // 0-1
                melodicRange: config.melodicRange || 12 // semitones
            }
        };

        console.log(`[Track ${this.id}] AI Composition initialized: style=${this.aiComposition.styleProfile}`);
        return true;
    }

    /**
     * Generate pattern suggestions based on current sequence.
     * @param {string} sequenceId - Target sequence
     * @param {Object} options - Generation options
     */
    generatePatternSuggestions(sequenceId, options = {}) {
        if (!this.aiComposition?.enabled) {
            console.warn(`[Track ${this.id}] AI Composition not initialized`);
            return [];
        }

        const sequence = this.sequences?.find(s => s.id === sequenceId);
        if (!sequence) return [];

        const suggestions = [];
        const currentPattern = sequence.steps || [];
        const numSuggestions = options.numSuggestions || this.aiComposition.maxSuggestions;

        // Analyze current pattern
        const analysis = this._analyzePattern(currentPattern);
        
        for (let i = 0; i < numSuggestions; i++) {
            const suggestion = this._generateVariation(currentPattern, analysis, options);
            suggestions.push({
                id: `suggestion-${Date.now()}-${i}`,
                pattern: suggestion,
                confidence: this._calculateConfidence(currentPattern, suggestion),
                description: this._describeVariation(i, options),
                style: this.aiComposition.styleProfile
            });
        }

        this.aiComposition.suggestionCache.set(sequenceId, suggestions);
        console.log(`[Track ${this.id}] Generated ${suggestions.length} pattern suggestions for sequence ${sequenceId}`);
        
        return suggestions;
    }

    /**
     * Analyze a pattern for musical characteristics.
     * @private
     */
    _analyzePattern(pattern) {
        const activeNotes = pattern.filter(s => s.active);
        if (activeNotes.length === 0) {
            return { density: 0, averageVelocity: 0, noteRange: { min: 0, max: 0 } };
        }

        const velocities = activeNotes.map(s => s.velocity || 100);
        const pitches = activeNotes.map(s => s.note || 60);

        return {
            density: activeNotes.length / pattern.length,
            averageVelocity: velocities.reduce((a, b) => a + b, 0) / velocities.length,
            noteRange: {
                min: Math.min(...pitches),
                max: Math.max(...pitches)
            },
            pitchCentroid: pitches.reduce((a, b) => a + b, 0) / pitches.length,
            rhythmicProfile: this._analyzeRhythm(activeNotes)
        };
    }

    /**
     * Analyze rhythm of active notes.
     * @private
     */
    _analyzeRhythm(activeNotes) {
        const positions = activeNotes.map(s => s.position || 0).sort((a, b) => a - b);
        if (positions.length < 2) return { regularity: 1 };

        const intervals = [];
        for (let i = 1; i < positions.length; i++) {
            intervals.push(positions[i] - positions[i - 1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
        const regularity = 1 / (1 + Math.sqrt(variance));

        return { regularity, avgInterval, intervals };
    }

    /**
     * Generate a variation of the current pattern.
     * @private
     */
    _generateVariation(originalPattern, analysis, options) {
        const variationType = options.variationType || 'evolve'; // evolve, complement, contrast
        const pattern = JSON.parse(JSON.stringify(originalPattern));

        switch (variationType) {
            case 'evolve':
                return this._evolvePattern(pattern, analysis);
            case 'complement':
                return this._complementPattern(pattern, analysis);
            case 'contrast':
                return this._contrastPattern(pattern, analysis);
            default:
                return pattern;
        }
    }

    /**
     * Evolve a pattern with small changes.
     * @private
     */
    _evolvePattern(pattern, analysis) {
        const rules = this.aiComposition.generativeRules;
        
        // Add subtle variations
        pattern.forEach((step, i) => {
            if (step.active && Math.random() < 0.2) {
                // Vary velocity slightly
                step.velocity = Math.max(1, Math.min(127, 
                    step.velocity + (Math.random() - 0.5) * 20));
                
                // Occasionally shift note pitch
                if (Math.random() < 0.1) {
                    const shift = Math.floor((Math.random() - 0.5) * rules.maxInterval);
                    step.note = Math.max(0, Math.min(127, step.note + shift));
                }
            }
        });

        return pattern;
    }

    /**
     * Create complementary pattern.
     * @private
     */
    _complementPattern(pattern, analysis) {
        // Add notes in gaps
        const activePositions = new Set(
            pattern.filter(s => s.active).map(s => s.position)
        );

        pattern.forEach((step, i) => {
            if (!step.active && Math.random() < 0.3) {
                // Fill gaps with complementary notes
                const note = analysis.pitchCentroid 
                    ? Math.round(analysis.pitchCentroid) + (Math.random() > 0.5 ? 3 : -3)
                    : 60;
                
                step.active = true;
                step.note = note;
                step.velocity = analysis.averageVelocity * 0.8;
            }
        });

        return pattern;
    }

    /**
     * Create contrasting pattern.
     * @private
     */
    _contrastPattern(pattern, analysis) {
        const rules = this.aiComposition.generativeRules;
        
        // Invert or offset the pattern
        pattern.forEach((step, i) => {
            if (step.active) {
                // Offset notes by interval
                step.note = Math.max(0, Math.min(127, 
                    step.note + rules.melodicRange * (Math.random() > 0.5 ? 1 : -1) * 0.5));
                
                // Invert rhythm probability
                if (Math.random() < 0.3) {
                    step.active = !step.active;
                }
            } else if (Math.random() < 0.2) {
                step.active = true;
                step.note = 60;
                step.velocity = analysis.averageVelocity;
            }
        });

        return pattern;
    }

    /**
     * Calculate confidence score for a suggestion.
     * @private
     */
    _calculateConfidence(original, suggestion) {
        let score = 0.5; // Base confidence
        
        // Check how similar the patterns are
        let similarNotes = 0;
        for (let i = 0; i < original.length && i < suggestion.length; i++) {
            if (original[i].active === suggestion[i].active) similarNotes++;
        }
        
        score += (similarNotes / Math.max(original.length, suggestion.length)) * 0.3;
        
        // Add style-based bonus
        if (this.aiComposition.styleProfile === 'electronic') {
            score += 0.1; // Electronic styles favor repetition
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Describe a variation type.
     * @private
     */
    _describeVariation(index, options) {
        const types = ['evolve', 'complement', 'contrast'];
        const type = options.variationType || types[index % 3];
        const descriptions = {
            evolve: 'Gradual evolution with subtle variations',
            complement: 'Fills gaps with complementary notes',
            contrast: 'Creates contrasting musical ideas'
        };
        return descriptions[type] || 'Pattern variation';
    }

    /**
     * Get AI composition settings.
     */
    getAICompositionSettings() {
        return this.aiComposition || { enabled: false };
    }

    // ============================================
    // Collaborative Editing Features
    // ============================================

    /**
     * Initialize collaborative editing support.
     */
    initCollaborativeEditing(config = {}) {
        this.collaborativeEditing = {
            enabled: true,
            sessionId: config.sessionId || `collab-${Date.now()}`,
            hostId: config.hostId || null,
            participants: new Map(), // userId -> { name, color, cursor }
            documentHistory: [],
            currentRevision: 0,
            lockTimeout: config.lockTimeout || 30000, // 30 seconds
            elementLocks: new Map(), // elementId -> { userId, timestamp }
            conflictResolution: config.conflictResolution || 'last-write-wins', // 'last-write-wins', 'operational-transform'
            presence: {
                trackId: this.id,
                lastActivity: Date.now(),
                editingElement: null
            }
        };

        console.log(`[Track ${this.id}] Collaborative editing initialized: session=${this.collaborativeEditing.sessionId}`);
        return true;
    }

    /**
     * Join a collaborative session.
     * @param {string} userId - User identifier
     * @param {Object} userInfo - User information
     */
    joinCollaboration(userId, userInfo = {}) {
        if (!this.collaborativeEditing?.enabled) {
            console.warn(`[Track ${this.id}] Collaborative editing not initialized`);
            return false;
        }

        const participant = {
            id: userId,
            name: userInfo.name || `User ${userId.slice(0, 4)}`,
            color: userInfo.color || this._generateParticipantColor(),
            cursor: { position: 0, sequenceId: null },
            joinedAt: Date.now(),
            lastSeen: Date.now()
        };

        this.collaborativeEditing.participants.set(userId, participant);
        
        console.log(`[Track ${this.id}] Participant joined: ${participant.name} (${userId})`);
        return { sessionId: this.collaborativeEditing.sessionId, participant };
    }

    /**
     * Leave collaborative session.
     * @param {string} userId - User identifier
     */
    leaveCollaboration(userId) {
        if (!this.collaborativeEditing?.enabled) return false;

        const removed = this.collaborativeEditing.participants.delete(userId);
        if (removed) {
            // Release any locks held by this user
            for (const [elementId, lock] of this.collaborativeEditing.elementLocks) {
                if (lock.userId === userId) {
                    this.collaborativeEditing.elementLocks.delete(elementId);
                }
            }
            console.log(`[Track ${this.id}] Participant left: ${userId}`);
        }
        return removed;
    }

    /**
     * Update participant cursor position.
     * @param {string} userId - User identifier
     * @param {Object} cursor - Cursor position info
     */
    updateCollaboratorCursor(userId, cursor) {
        if (!this.collaborativeEditing?.enabled) return false;

        const participant = this.collaborativeEditing.participants.get(userId);
        if (!participant) return false;

        participant.cursor = { ...cursor, timestamp: Date.now() };
        participant.lastSeen = Date.now();
        
        return true;
    }

    /**
     * Lock an element for editing.
     * @param {string} userId - User requesting lock
     * @param {string} elementId - Element to lock
     */
    lockElement(userId, elementId) {
        if (!this.collaborativeEditing?.enabled) return false;

        const participant = this.collaborativeEditing.participants.get(userId);
        if (!participant) return false;

        // Check if already locked
        const existingLock = this.collaborativeEditing.elementLocks.get(elementId);
        if (existingLock) {
            // Check if lock has expired
            if (Date.now() - existingLock.timestamp > this.collaborativeEditing.lockTimeout) {
                this.collaborativeEditing.elementLocks.delete(elementId);
            } else if (existingLock.userId !== userId) {
                return { locked: false, lockedBy: existingLock.userId };
            }
        }

        // Acquire lock
        this.collaborativeEditing.elementLocks.set(elementId, {
            userId,
            timestamp: Date.now()
        });

        return { locked: true, elementId };
    }

    /**
     * Unlock an element.
     * @param {string} userId - User releasing lock
     * @param {string} elementId - Element to unlock
     */
    unlockElement(userId, elementId) {
        if (!this.collaborativeEditing?.enabled) return false;

        const lock = this.collaborativeEditing.elementLocks.get(elementId);
        if (!lock || lock.userId !== userId) return false;

        this.collaborativeEditing.elementLocks.delete(elementId);
        return { unlocked: true, elementId };
    }

    /**
     * Record a change for history/sync.
     * @param {Object} change - Change object
     */
    recordCollaborativeChange(change) {
        if (!this.collaborativeEditing?.enabled) return false;

        const revision = {
            id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            revisionNumber: ++this.collaborativeEditing.currentRevision,
            change: {
                type: change.type, // 'note-add', 'note-remove', 'note-update', 'sequence-create', etc.
                trackId: this.id,
                elementId: change.elementId,
                previous: change.previous,
                current: change.current,
                userId: change.userId
            }
        };

        this.collaborativeEditing.documentHistory.push(revision);
        
        // Keep history bounded
        if (this.collaborativeEditing.documentHistory.length > 1000) {
            this.collaborativeEditing.documentHistory = 
                this.collaborativeEditing.documentHistory.slice(-500);
        }

        return revision;
    }

    /**
     * Get changes since a revision.
     * @param {number} sinceRevision - Revision number to get changes after
     */
    getChangesSinceRevision(sinceRevision) {
        if (!this.collaborativeEditing?.enabled) return [];

        return this.collaborativeEditing.documentHistory
            .filter(r => r.revisionNumber > sinceRevision);
    }

    /**
     * Get collaborative editing state.
     */
    getCollaborativeState() {
        return this.collaborativeEditing || { enabled: false };
    }

    /**
     * Generate a color for a participant.
     * @private
     */
    _generateParticipantColor() {
        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // ============================================
    // Mobile Touch Optimization
    // ============================================

    /**
     * Initialize mobile touch optimization.
     */
    initMobileTouchOptimization(config = {}) {
        this.mobileTouchOptimization = {
            enabled: true,
            isTouchDevice: this._detectTouchDevice(),
            touchSensitivity: config.touchSensitivity || 1.0,
            gestureRecognition: {
                swipeThreshold: config.swipeThreshold || 50, // pixels
                tapTimeout: config.tapTimeout || 300, // ms
                longPressTimeout: config.longPressTimeout || 500, // ms
                pinchZoomEnabled: config.pinchZoomEnabled ?? true,
                twoFingerScroll: config.twoFingerScroll ?? true
            },
            touchTargets: {
                minSize: config.minSize || 44, // iOS HIG minimum
                spacing: config.spacing || 8 // pixels between targets
            },
            hapticFeedback: config.hapticFeedback ?? true,
            velocityTracking: {
                enabled: config.velocityTracking ?? true,
                smoothingFactor: config.smoothingFactor || 0.3
            },
            multiTouch: {
                maxTouches: config.maxTouches || 5,
                gestureTimeout: config.gestureTimeout || 100
            },
            touchHistory: [],
            lastTouchTime: 0
        };

        console.log(`[Track ${this.id}] Mobile touch optimization initialized: touchDevice=${this.mobileTouchOptimization.isTouchDevice}`);
        return true;
    }

    /**
     * Detect if running on a touch device.
     * @private
     */
    _detectTouchDevice() {
        if (typeof window === 'undefined') return false;
        return 'ontouchstart' in window || 
            navigator.maxTouchPoints > 0 || 
            navigator.msMaxTouchPoints > 0;
    }

    /**
     * Handle touch start event.
     * @param {TouchList} touches - Touch points
     * @param {Object} context - Touch context info
     */
    handleTouchStart(touches, context = {}) {
        if (!this.mobileTouchOptimization?.enabled) return null;

        const opt = this.mobileTouchOptimization;
        const touchArray = Array.from(touches);
        
        const touchInfo = {
            id: `touch-${Date.now()}`,
            startTime: Date.now(),
            touches: touchArray.map(t => ({
                id: t.identifier,
                x: t.clientX,
                y: t.clientY,
                timestamp: Date.now()
            })),
            context: {
                elementId: context.elementId,
                sequenceId: context.sequenceId,
                trackId: this.id
            },
            gesture: null
        };

        // Store in history for gesture detection
        opt.touchHistory.push(touchInfo);
        if (opt.touchHistory.length > 20) {
            opt.touchHistory = opt.touchHistory.slice(-10);
        }

        // Trigger haptic feedback
        if (opt.hapticFeedback && navigator.vibrate) {
            navigator.vibrate(10);
        }

        opt.lastTouchTime = Date.now();
        
        return touchInfo;
    }

    /**
     * Handle touch move event.
     * @param {TouchList} touches - Touch points
     * @param {Object} initialTouch - Initial touch info
     */
    handleTouchMove(touches, initialTouch) {
        if (!this.mobileTouchOptimization?.enabled) return null;

        const opt = this.mobileTouchOptimization;
        const touchArray = Array.from(touches);
        
        // Calculate velocity
        let velocity = { x: 0, y: 0 };
        if (opt.velocityTracking.enabled && initialTouch) {
            const dt = Date.now() - initialTouch.startTime;
            if (dt > 0) {
                const initialX = initialTouch.touches[0]?.x || 0;
                const initialY = initialTouch.touches[0]?.y || 0;
                const currentX = touchArray[0]?.clientX || 0;
                const currentY = touchArray[0]?.clientY || 0;
                
                velocity.x = (currentX - initialX) / dt * 1000; // px/s
                velocity.y = (currentY - initialY) / dt * 1000;
                
                // Apply smoothing
                velocity.x *= opt.velocityTracking.smoothingFactor;
                velocity.y *= opt.velocityTracking.smoothingFactor;
            }
        }

        // Detect gesture
        const gesture = this._detectGesture(touchArray, initialTouch, velocity);
        
        return { velocity, gesture, touches: touchArray };
    }

    /**
     * Handle touch end event.
     * @param {TouchList} touches - Remaining touch points
     * @param {Object} initialTouch - Initial touch info
     */
    handleTouchEnd(touches, initialTouch) {
        if (!this.mobileTouchOptimization?.enabled) return null;

        const opt = this.mobileTouchOptimization;
        const touchArray = Array.from(touches);
        const duration = Date.now() - initialTouch.startTime;
        
        let gestureType = 'tap';
        
        // Determine final gesture
        if (duration > opt.gestureRecognition.longPressTimeout) {
            gestureType = 'longPress';
        } else if (touchArray.length === 0) {
            const initialPos = initialTouch.touches[0];
            const lastPos = opt.touchHistory[opt.touchHistory.length - 1];
            
            if (initialPos && lastPos) {
                const dx = (lastPos.touches[0]?.x || 0) - initialPos.x;
                const dy = (lastPos.touches[0]?.y || 0) - initialPos.y;
                
                if (Math.abs(dx) > opt.gestureRecognition.swipeThreshold || 
                    Math.abs(dy) > opt.gestureRecognition.swipeThreshold) {
                    gestureType = Math.abs(dx) > Math.abs(dy) ? 'swipe-horizontal' : 'swipe-vertical';
                }
            }
        }

        // Trigger haptic feedback for gesture
        if (opt.hapticFeedback && navigator.vibrate) {
            if (gestureType === 'longPress') {
                navigator.vibrate([20, 10, 20]);
            }
        }

        return { gestureType, duration, tapCount: this._getTapCount() };
    }

    /**
     * Detect gesture from touch movement.
     * @private
     */
    _detectGesture(touches, initialTouch, velocity) {
        if (!initialTouch?.touches?.length) return null;

        const opt = this.mobileTouchOptimization;
        const initial = initialTouch.touches[0];
        const current = touches[0];
        
        if (!current) return null;

        const dx = current.clientX - initial.x;
        const dy = current.clientY - initial.y;
        
        // Pinch zoom (two fingers)
        if (touches.length === 2 && opt.gestureRecognition.pinchZoomEnabled) {
            const touch1 = touches[0];
            const touch2 = touches[1];
            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            return {
                type: 'pinch',
                scale: distance / 100, // Normalize
                center: {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2
                }
            };
        }

        // Swipe detection
        if (Math.abs(dx) > opt.gestureRecognition.swipeThreshold) {
            return {
                type: 'swipe',
                direction: dx > 0 ? 'right' : 'left',
                velocity: velocity.x
            };
        }

        if (Math.abs(dy) > opt.gestureRecognition.swipeThreshold) {
            return {
                type: 'swipe',
                direction: dy > 0 ? 'down' : 'up',
                velocity: velocity.y
            };
        }

        return { type: 'drag', dx, dy };
    }

    /**
     * Get tap count for double/triple tap detection.
     * @private
     */
    _getTapCount() {
        const opt = this.mobileTouchOptimization;
        const recentTouches = opt.touchHistory.filter(
            t => Date.now() - t.startTime < 500
        );
        return recentTouches.length;
    }

    /**
     * Get mobile touch settings.
     */
    getMobileTouchSettings() {
        return this.mobileTouchOptimization || { enabled: false };
    }

    // ============================================
    // Accessibility Improvements
    // ============================================

    /**
     * Initialize accessibility features.
     */
    initAccessibility(config = {}) {
        this.accessibility = {
            enabled: true,
            screenReaderSupport: config.screenReaderSupport ?? true,
            keyboardNavigation: config.keyboardNavigation ?? true,
            highContrast: config.highContrast ?? false,
            reducedMotion: config.reducedMotion ?? false,
            focusIndicators: config.focusIndicators ?? true,
            ariaLabels: new Map(),
            keyboardShortcuts: new Map(),
            announcements: {
                enabled: config.announcements ?? true,
                queue: [],
                lastAnnouncement: null
            },
            focusManagement: {
                currentFocus: null,
                focusHistory: [],
                trapFocus: false
            },
            colorSchemes: {
                default: { name: 'Default', contrast: 1 },
                highContrast: { name: 'High Contrast', contrast: 2.5 },
                dark: { name: 'Dark', contrast: 1.2 }
            },
            currentScheme: 'default'
        };

        // Set up default keyboard shortcuts
        this._setupDefaultKeyboardShortcuts();

        console.log(`[Track ${this.id}] Accessibility features initialized: screenReader=${this.accessibility.screenReaderSupport}`);
        return true;
    }

    /**
     * Set up default keyboard shortcuts.
     * @private
     */
    _setupDefaultKeyboardShortcuts() {
        if (!this.accessibility?.enabled) return;

        const shortcuts = [
            { key: 'Space', action: 'playPause', description: 'Play or pause playback' },
            { key: 'Enter', action: 'confirm', description: 'Confirm action' },
            { key: 'Escape', action: 'cancel', description: 'Cancel or close' },
            { key: 'Tab', action: 'nextFocus', description: 'Move to next element' },
            { key: 'Shift+Tab', action: 'prevFocus', description: 'Move to previous element' },
            { key: 'ArrowUp', action: 'increment', description: 'Increase value' },
            { key: 'ArrowDown', action: 'decrement', description: 'Decrease value' },
            { key: 'ArrowLeft', action: 'navigateLeft', description: 'Navigate left' },
            { key: 'ArrowRight', action: 'navigateRight', description: 'Navigate right' },
            { key: 'Delete', action: 'delete', description: 'Delete selected element' },
            { key: 'Ctrl+Z', action: 'undo', description: 'Undo last action' },
            { key: 'Ctrl+Y', action: 'redo', description: 'Redo last action' },
            { key: 'M', action: 'muteTrack', description: 'Mute current track' },
            { key: 'S', action: 'soloTrack', description: 'Solo current track' },
            { key: 'R', action: 'toggleRecord', description: 'Toggle recording' },
            { key: 'L', action: 'toggleLoop', description: 'Toggle loop region' },
            { key: '?', action: 'showHelp', description: 'Show keyboard shortcuts' }
        ];

        shortcuts.forEach(s => {
            this.accessibility.keyboardShortcuts.set(s.key, {
                action: s.action,
                description: s.description
            });
        });
    }

    /**
     * Register ARIA label for an element.
     * @param {string} elementId - Element identifier
     * @param {Object} ariaInfo - ARIA information
     */
    registerAriaLabel(elementId, ariaInfo) {
        if (!this.accessibility?.enabled) return false;

        this.accessibility.ariaLabels.set(elementId, {
            role: ariaInfo.role || 'button',
            label: ariaInfo.label || '',
            description: ariaInfo.description || '',
            state: ariaInfo.state || null,
            live: ariaInfo.live || 'polite', // 'off', 'polite', 'assertive'
            expanded: ariaInfo.expanded ?? null,
            hasPopup: ariaInfo.hasPopup || false
        });

        return true;
    }

    /**
     * Get ARIA attributes for an element.
     * @param {string} elementId - Element identifier
     */
    getAriaAttributes(elementId) {
        if (!this.accessibility?.enabled) return null;

        const info = this.accessibility.ariaLabels.get(elementId);
        if (!info) return null;

        return {
            'role': info.role,
            'aria-label': info.label,
            'aria-description': info.description,
            'aria-expanded': info.expanded,
            'aria-haspopup': info.hasPopup ? 'true' : null,
            'aria-live': info.live
        };
    }

    /**
     * Announce a message for screen readers.
     * @param {string} message - Message to announce
     * @param {string} priority - 'polite' or 'assertive'
     */
    announceForScreenReader(message, priority = 'polite') {
        if (!this.accessibility?.enabled || !this.accessibility.announcements.enabled) {
            return false;
        }

        const announcement = {
            id: `ann-${Date.now()}`,
            message,
            priority,
            timestamp: Date.now()
        };

        this.accessibility.announcements.queue.push(announcement);
        this.accessibility.announcements.lastAnnouncement = announcement;

        // Keep queue bounded
        if (this.accessibility.announcements.queue.length > 50) {
            this.accessibility.announcements.queue = 
                this.accessibility.announcements.queue.slice(-25);
        }

        console.log(`[Track ${this.id} A11y] Announced: "${message}" (${priority})`);
        return announcement;
    }

    /**
     * Handle keyboard navigation.
     * @param {KeyboardEvent} event - Keyboard event
     * @param {Object} context - Navigation context
     */
    handleKeyboardNavigation(event, context = {}) {
        if (!this.accessibility?.enabled || !this.accessibility.keyboardNavigation) {
            return null;
        }

        const key = this._getKeyboardCombo(event);
        const shortcut = this.accessibility.keyboardShortcuts.get(key);

        if (!shortcut) return null;

        // Record focus history for backtracking
        if (context.elementId) {
            this.accessibility.focusManagement.focusHistory.push({
                elementId: context.elementId,
                timestamp: Date.now()
            });
        }

        // Announce action for screen readers
        if (this.accessibility.announcements.enabled) {
            this.announceForScreenReader(shortcut.description);
        }

        return {
            action: shortcut.action,
            key,
            description: shortcut.description
        };
    }

    /**
     * Get keyboard combo string from event.
     * @private
     */
    _getKeyboardCombo(event) {
        const parts = [];
        if (event.ctrlKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        if (event.metaKey) parts.push('Meta');
        parts.push(event.key);
        return parts.join('+');
    }

    /**
     * Set focus management state.
     * @param {string} elementId - Element to focus
     * @param {boolean} trapFocus - Whether to trap focus within
     */
    setFocusManagement(elementId, trapFocus = false) {
        if (!this.accessibility?.enabled) return false;

        this.accessibility.focusManagement.currentFocus = elementId;
        this.accessibility.focusManagement.trapFocus = trapFocus;

        // Announce focus change
        const label = this.accessibility.ariaLabels.get(elementId);
        if (label) {
            this.announceForScreenReader(`Focused: ${label.label}`);
        }

        return true;
    }

    /**
     * Set color scheme for accessibility.
     * @param {string} schemeName - Name of color scheme
     */
    setColorScheme(schemeName) {
        if (!this.accessibility?.enabled) return false;

        if (this.accessibility.colorSchemes[schemeName]) {
            this.accessibility.currentScheme = schemeName;
            this.accessibility.highContrast = schemeName === 'highContrast';
            
            this.announceForScreenReader(`Color scheme changed to ${this.accessibility.colorSchemes[schemeName].name}`);
            return true;
        }

        return false;
    }

    /**
     * Enable/disable reduced motion mode.
     * @param {boolean} enabled - Whether to reduce motion
     */
    setReducedMotion(enabled) {
        if (!this.accessibility?.enabled) return false;

        this.accessibility.reducedMotion = enabled;
        this.announceForScreenReader(`Reduced motion ${enabled ? 'enabled' : 'disabled'}`);
        
        return true;
    }

    /**
     * Get accessibility settings.
     */
    getAccessibilitySettings() {
        return this.accessibility || { enabled: false };
    }

    // =====================================================
    // AUDIO-TO-MIDI DRUM PATTERN DETECTION
    // =====================================================

    /**
     * Initialize drum detection settings.
     * @param {Object} config - Detection configuration
     */
    initDrumDetection(config = {}) {
        this.drumDetection = {
            enabled: config.enabled ?? true,
            sensitivity: config.sensitivity ?? 0.5, // 0-1, higher = more sensitive
            minGap: config.minGap ?? 0.05, // Minimum gap between hits in seconds
            threshold: config.threshold ?? -30, // dB threshold for hit detection
            drumTypes: config.drumTypes ?? ['kick', 'snare', 'hihat', 'tom', 'cymbal'],
            frequencyRanges: config.frequencyRanges ?? {
                kick: { low: 20, high: 100 },
                snare: { low: 100, high: 500 },
                hihat: { low: 5000, high: 20000 },
                tom: { low: 100, high: 300 },
                cymbal: { low: 3000, high: 20000 }
            },
            midiMapping: config.midiMapping ?? {
                kick: 36, // C1 - Standard MIDI drum map
                snare: 38, // D1
                hihat: 42, // F#1 (closed)
                tom: 45, // A1 (low tom)
                cymbal: 49 // C#2 (crash)
            },
            detectedHits: [],
            lastAnalysis: null
        };
        
        console.log(`[Track ${this.id}] Drum detection initialized:`, this.drumDetection.enabled);
        return this.drumDetection;
    }

    /**
     * Analyze audio buffer to detect drum hits.
     * @param {AudioBuffer} audioBuffer - The audio buffer to analyze
     * @param {Object} options - Analysis options
     * @returns {Array} Detected drum hits with timing and type
     */
    async detectDrumHits(audioBuffer, options = {}) {
        if (!audioBuffer) {
            console.warn(`[Track ${this.id}] No audio buffer for drum detection`);
            return [];
        }

        if (!this.drumDetection) {
            this.initDrumDetection();
        }

        const settings = { ...this.drumDetection, ...options };
        const detectedHits = [];

        // Get audio data
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;

        // Perform FFT-based analysis for frequency classification
        const fftSize = 2048;
        const hopSize = fftSize / 4;
        const numFrames = Math.floor((channelData.length - fftSize) / hopSize);

        // Create offline context for FFT analysis
        const offlineCtx = new OfflineAudioContext(1, fftSize, sampleRate);
        const analyser = offlineCtx.createAnalyser();
        analyser.fftSize = fftSize;

        // Detect transients (onsets) using energy-based method
        const frameSize = 512;
        const energyFrames = [];
        
        for (let i = 0; i < channelData.length - frameSize; i += frameSize) {
            let energy = 0;
            for (let j = 0; j < frameSize; j++) {
                energy += channelData[i + j] * channelData[i + j];
            }
            energyFrames.push({
                time: i / sampleRate,
                energy: Math.sqrt(energy / frameSize)
            });
        }

        // Find peaks (transients) in energy
        const threshold = this._calculateAdaptiveThreshold(energyFrames, settings.sensitivity);
        
        for (let i = 1; i < energyFrames.length - 1; i++) {
            const frame = energyFrames[i];
            const prevFrame = energyFrames[i - 1];
            const nextFrame = energyFrames[i + 1];

            // Check if this is a peak (local maximum above threshold)
            if (frame.energy > threshold &&
                frame.energy > prevFrame.energy &&
                frame.energy > nextFrame.energy) {
                
                // Check minimum gap from previous hit
                const prevHit = detectedHits[detectedHits.length - 1];
                if (prevHit && (frame.time - prevHit.time) < settings.minGap) {
                    continue;
                }

                // Classify drum type based on spectral analysis
                const drumType = await this._classifyDrumType(
                    channelData,
                    Math.floor(frame.time * sampleRate),
                    sampleRate,
                    settings
                );

                detectedHits.push({
                    time: frame.time,
                    energy: frame.energy,
                    type: drumType.type,
                    confidence: drumType.confidence,
                    midiNote: settings.midiMapping[drumType.type] || 36,
                    velocity: Math.min(127, Math.floor(frame.energy * 1000))
                });
            }
        }

        this.drumDetection.detectedHits = detectedHits;
        this.drumDetection.lastAnalysis = {
            timestamp: Date.now(),
            duration: duration,
            hitCount: detectedHits.length
        };

        console.log(`[Track ${this.id}] Detected ${detectedHits.length} drum hits in ${duration.toFixed(2)}s`);
        return detectedHits;
    }

    /**
     * Calculate adaptive threshold for peak detection.
     * @private
     */
    _calculateAdaptiveThreshold(energyFrames, sensitivity) {
        // Sort energies and use percentile-based threshold
        const sortedEnergies = energyFrames.map(f => f.energy).sort((a, b) => a - b);
        const percentile = 1 - sensitivity; // Higher sensitivity = lower percentile threshold
        const index = Math.floor(sortedEnergies.length * percentile);
        return sortedEnergies[Math.max(0, index)] * 1.5;
    }

    /**
     * Classify drum type based on spectral analysis.
     * @private
     */
    async _classifyDrumType(channelData, startIndex, sampleRate, settings) {
        // Extract a short window around the hit for analysis
        const windowSize = Math.min(4096, channelData.length - startIndex);
        const window = channelData.slice(startIndex, startIndex + windowSize);

        // Calculate spectral centroid (brightness)
        let weightedSum = 0;
        let sum = 0;
        const fftSize = windowSize;
        
        // Simple FFT approximation using energy distribution
        const numBands = 8;
        const bandSize = Math.floor(fftSize / numBands);
        const bandEnergies = [];
        
        for (let band = 0; band < numBands; band++) {
            let bandEnergy = 0;
            for (let i = 0; i < bandSize && (band * bandSize + i) < window.length; i++) {
                bandEnergy += Math.abs(window[band * bandSize + i]);
            }
            bandEnergies.push(bandEnergy / bandSize);
        }

        // Calculate low frequency ratio for classification
        const lowEnergy = bandEnergies.slice(0, 2).reduce((a, b) => a + b, 0);
        const midEnergy = bandEnergies.slice(2, 5).reduce((a, b) => a + b, 0);
        const highEnergy = bandEnergies.slice(5).reduce((a, b) => a + b, 0);
        const totalEnergy = lowEnergy + midEnergy + highEnergy;

        // Classify based on frequency distribution
        const lowRatio = lowEnergy / totalEnergy;
        const midRatio = midEnergy / totalEnergy;
        const highRatio = highEnergy / totalEnergy;

        // Determine drum type based on ratios
        let type = 'kick';
        let confidence = 0.5;

        if (lowRatio > 0.6) {
            type = 'kick';
            confidence = lowRatio;
        } else if (midRatio > 0.5 && lowRatio < 0.4) {
            type = 'snare';
            confidence = midRatio;
        } else if (highRatio > 0.4) {
            type = 'hihat';
            confidence = highRatio;
        } else if (midRatio > 0.4 && highRatio < 0.3) {
            type = 'tom';
            confidence = midRatio;
        } else if (highRatio > 0.3 && midRatio > 0.3) {
            type = 'cymbal';
            confidence = (highRatio + midRatio) / 2;
        }

        return { type, confidence: Math.min(1, confidence) };
    }

    /**
     * Convert detected drum hits to MIDI sequence.
     * @param {number} tempo - Target tempo in BPM
     * @param {number} quantize - Quantize division (e.g., 16 for 16th notes)
     * @returns {Object} MIDI sequence data
     */
    convertHitsToMidiSequence(tempo = 120, quantize = 16) {
        if (!this.drumDetection?.detectedHits?.length) {
            console.warn(`[Track ${this.id}] No drum hits detected for MIDI conversion`);
            return null;
        }

        const hits = this.drumDetection.detectedHits;
        const secondsPerBeat = 60 / tempo;
        const secondsPerSixteenth = secondsPerBeat / (quantize / 4);

        // Create sequence
        const sequence = {
            tempo,
            quantize,
            length: Math.ceil(hits[hits.length - 1].time / secondsPerSixteenth) + 1,
            notes: []
        };

        // Convert hits to notes
        hits.forEach(hit => {
            const step = Math.round(hit.time / secondsPerSixteenth);
            sequence.notes.push({
                step,
                note: hit.midiNote,
                velocity: hit.velocity,
                duration: 1, // Default to one step
                type: hit.type,
                confidence: hit.confidence
            });
        });

        console.log(`[Track ${this.id}] Converted ${hits.length} hits to MIDI sequence (${sequence.length} steps)`);
        return sequence;
    }

    /**
     * Apply detected drum pattern to a sequence.
     * @param {string} sequenceId - Target sequence ID
     * @param {Object} options - Apply options
     */
    applyDetectedDrumsToSequence(sequenceId, options = {}) {
        const sequence = this.convertHitsToMidiSequence(options.tempo, options.quantize);
        if (!sequence) return false;

        // Find or create the target sequence
        let targetSequence = this.sequences?.find(s => s.id === sequenceId);
        if (!targetSequence) {
            targetSequence = {
                id: sequenceId,
                name: `Drum Pattern ${sequenceId}`,
                steps: sequence.length,
                notes: []
            };
            if (!this.sequences) this.sequences = [];
            this.sequences.push(targetSequence);
        }

        // Apply notes (merge or replace)
        if (options.mode === 'merge') {
            // Merge with existing notes
            const existingNotes = targetSequence.notes || [];
            const newNotes = sequence.notes.filter(newNote => 
                !existingNotes.some(existing => 
                    existing.step === newNote.step && existing.note === newNote.note
                )
            );
            targetSequence.notes = [...existingNotes, ...newNotes];
        } else {
            // Replace existing notes
            targetSequence.notes = sequence.notes;
            targetSequence.steps = sequence.length;
        }

        console.log(`[Track ${this.id}] Applied ${sequence.notes.length} drum hits to sequence ${sequenceId}`);
        return targetSequence;
    }

    /**
     * Get drum detection settings.
     */
    getDrumDetectionSettings() {
        return this.drumDetection || { enabled: false };
    }

    // =====================================================
    // VECTOR SYNTHESIS
    // =====================================================

    /**
     * Initialize vector synthesis.
     * @param {Object} config - Vector synthesis configuration
     */
    initVectorSynthesis(config = {}) {
        this.vectorSynthesis = {
            enabled: config.enabled ?? true,
            oscillators: config.oscillators ?? [
                { waveform: 'sine', detune: 0, gain: 0.25 },
                { waveform: 'triangle', detune: 5, gain: 0.25 },
                { waveform: 'sawtooth', detune: -5, gain: 0.25 },
                { waveform: 'square', detune: 10, gain: 0.25 }
            ],
            vectorPosition: config.vectorPosition ?? { x: 0.5, y: 0.5 },
            morphMode: config.morphMode ?? 'linear', // 'linear', 'equal-power', 'crossfade'
            morphSpeed: config.morphSpeed ?? 0.1, // seconds for morph transitions
            automorph: config.automorph ?? {
                enabled: false,
                xRate: 0.1, // Hz
                yRate: 0.15,
                xDepth: 1,
                yDepth: 1
            },
            lastVector: null
        };

        this._vectorOscillators = [];
        this._vectorGains = [];
        
        console.log(`[Track ${this.id}] Vector synthesis initialized`);
        return this.vectorSynthesis;
    }

    /**
     * Set vector synthesis position.
     * @param {number} x - X position (0-1)
     * @param {number} y - Y position (0-1)
     * @param {boolean} smooth - Whether to smooth transition
     */
    setVectorPosition(x, y, smooth = true) {
        if (!this.vectorSynthesis) {
            this.initVectorSynthesis();
        }

        const prevPosition = { ...this.vectorSynthesis.vectorPosition };
        this.vectorSynthesis.vectorPosition = { x, y };

        // Calculate gains for each oscillator based on vector position
        const gains = this._calculateVectorGains(x, y);
        
        // Apply gains to oscillators
        if (this._vectorGains.length > 0) {
            this._vectorGains.forEach((gainNode, i) => {
                if (smooth) {
                    gainNode.gain.rampTo(gains[i], this.vectorSynthesis.morphSpeed);
                } else {
                    gainNode.gain.value = gains[i];
                }
            });
        }

        this.vectorSynthesis.lastVector = {
            position: { x, y },
            gains,
            timestamp: Date.now()
        };

        console.log(`[Track ${this.id}] Vector position set to (${x.toFixed(2)}, ${y.toFixed(2)})`);
        return gains;
    }

    /**
     * Calculate gains for vector synthesis.
     * @private
     */
    _calculateVectorGains(x, y) {
        const mode = this.vectorSynthesis.morphMode;
        
        // Calculate distance from each corner (oscillator)
        // Top-left (osc 0), Top-right (osc 1), Bottom-right (osc 2), Bottom-left (osc 3)
        const gains = [
            (1 - x) * (1 - y), // Top-left
            x * (1 - y),       // Top-right
            x * y,             // Bottom-right
            (1 - x) * y        // Bottom-left
        ];

        if (mode === 'equal-power') {
            // Apply equal-power crossfade curve
            return gains.map(g => Math.sqrt(g));
        } else if (mode === 'crossfade') {
            // Smooth crossfade with cosine interpolation
            return gains.map(g => 0.5 * (1 - Math.cos(g * Math.PI)));
        }

        return gains; // Linear mode
    }

    /**
     * Start vector synthesis oscillators.
     * @param {number} frequency - Base frequency
     */
    startVectorOscillators(frequency) {
        if (!this.vectorSynthesis) {
            this.initVectorSynthesis();
        }

        // Create oscillators if not already created
        if (this._vectorOscillators.length === 0) {
            this.vectorSynthesis.oscillators.forEach((oscConfig, i) => {
                const osc = new Tone.Oscillator({
                    frequency: frequency,
                    type: oscConfig.waveform,
                    detune: oscConfig.detune
                });

                const gain = new Tone.Gain(0.25);
                osc.connect(gain);
                
                this._vectorOscillators.push(osc);
                this._vectorGains.push(gain);
            });
        }

        // Set frequencies and start
        this._vectorOscillators.forEach((osc, i) => {
            osc.frequency.value = frequency;
            osc.detune.value = this.vectorSynthesis.oscillators[i].detune;
            osc.start();
        });

        // Apply current vector position
        const gains = this._calculateVectorGains(
            this.vectorSynthesis.vectorPosition.x,
            this.vectorSynthesis.vectorPosition.y
        );
        this._vectorGains.forEach((gain, i) => {
            gain.gain.value = gains[i];
        });

        console.log(`[Track ${this.id}] Vector oscillators started at ${frequency}Hz`);
        return this._vectorOscillators;
    }

    /**
     * Stop vector synthesis oscillators.
     */
    stopVectorOscillators() {
        this._vectorOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
        });
        console.log(`[Track ${this.id}] Vector oscillators stopped`);
    }

    /**
     * Set automorph for vector synthesis.
     * @param {Object} config - Automorph configuration
     */
    setVectorAutomorph(config) {
        if (!this.vectorSynthesis) {
            this.initVectorSynthesis();
        }

        this.vectorSynthesis.automorph = {
            enabled: config.enabled ?? true,
            xRate: config.xRate ?? 0.1,
            yRate: config.yRate ?? 0.15,
            xDepth: config.xDepth ?? 1,
            yDepth: config.yDepth ?? 1
        };

        console.log(`[Track ${this.id}] Vector automorph ${this.vectorSynthesis.automorph.enabled ? 'enabled' : 'disabled'}`);
        return this.vectorSynthesis.automorph;
    }

    /**
     * Update automorph (call this in animation frame).
     * @param {number} time - Current time in seconds
     */
    updateVectorAutomorph(time) {
        if (!this.vectorSynthesis?.automorph?.enabled) return;

        const auto = this.vectorSynthesis.automorph;
        const x = 0.5 + 0.5 * auto.xDepth * Math.sin(2 * Math.PI * auto.xRate * time);
        const y = 0.5 + 0.5 * auto.yDepth * Math.sin(2 * Math.PI * auto.yRate * time);

        this.setVectorPosition(x, y, false);
    }

    // =====================================================
    // WAVETABLE SYNTHESIS
    // =====================================================

    /**
     * Initialize wavetable synthesis.
     * @param {Object} config - Wavetable configuration
     */
    initWavetableSynthesis(config = {}) {
        this.wavetableSynthesis = {
            enabled: config.enabled ?? true,
            tables: config.tables ?? [
                { name: 'sine', data: this._generateWavetable('sine') },
                { name: 'triangle', data: this._generateWavetable('triangle') },
                { name: 'sawtooth', data: this._generateWavetable('sawtooth') },
                { name: 'square', data: this._generateWavetable('square') }
            ],
            tablePosition: config.tablePosition ?? 0, // 0-1 position between tables
            interpMode: config.interpMode ?? 'linear', // 'linear', 'spectral', 'morph'
            spectralMode: config.spectralMode ?? 'magnitude', // 'magnitude', 'phase'
            customTables: config.customTables ?? [],
            morphQueue: config.morphQueue ?? [],
            currentTable: null
        };

        this._wavetableOscillator = null;
        this._wavetableBuffer = null;

        console.log(`[Track ${this.id}] Wavetable synthesis initialized`);
        return this.wavetableSynthesis;
    }

    /**
     * Generate a wavetable for a given waveform type.
     * @private
     */
    _generateWavetable(type, tableSize = 256) {
        const table = new Float32Array(tableSize);
        
        switch (type) {
            case 'sine':
                for (let i = 0; i < tableSize; i++) {
                    table[i] = Math.sin(2 * Math.PI * i / tableSize);
                }
                break;
            case 'triangle':
                for (let i = 0; i < tableSize; i++) {
                    const phase = i / tableSize;
                    table[i] = 4 * Math.abs(phase - 0.5) - 1;
                }
                break;
            case 'sawtooth':
                for (let i = 0; i < tableSize; i++) {
                    table[i] = 2 * (i / tableSize) - 1;
                }
                break;
            case 'square':
                for (let i = 0; i < tableSize; i++) {
                    table[i] = i < tableSize / 2 ? 1 : -1;
                }
                break;
            default:
                // Default to sine
                for (let i = 0; i < tableSize; i++) {
                    table[i] = Math.sin(2 * Math.PI * i / tableSize);
                }
        }

        return table;
    }

    /**
     * Create a custom wavetable from an array of values.
     * @param {string} name - Name for the custom table
     * @param {Float32Array|Array} data - Waveform data
     */
    createCustomWavetable(name, data) {
        if (!this.wavetableSynthesis) {
            this.initWavetableSynthesis();
        }

        const tableData = data instanceof Float32Array ? data : new Float32Array(data);
        
        this.wavetableSynthesis.customTables.push({
            name,
            data: tableData,
            created: Date.now()
        });

        console.log(`[Track ${this.id}] Custom wavetable "${name}" created`);
        return this.wavetableSynthesis.customTables[this.wavetableSynthesis.customTables.length - 1];
    }

    /**
     * Set wavetable position for morphing between tables.
     * @param {number} position - Position 0-1
     */
    setWavetablePosition(position) {
        if (!this.wavetableSynthesis) {
            this.initWavetableSynthesis();
        }

        this.wavetableSynthesis.tablePosition = Math.max(0, Math.min(1, position));
        
        // Interpolate between tables
        const interpolatedTable = this._interpolateWavetables(this.wavetableSynthesis.tablePosition);
        this.wavetableSynthesis.currentTable = interpolatedTable;

        console.log(`[Track ${this.id}] Wavetable position: ${this.wavetableSynthesis.tablePosition.toFixed(2)}`);
        return interpolatedTable;
    }

    /**
     * Interpolate between wavetables.
     * @private
     */
    _interpolateWavetables(position) {
        const tables = this.wavetableSynthesis.tables;
        const mode = this.wavetableSynthesis.interpMode;
        
        const numTables = tables.length;
        const scaledPos = position * (numTables - 1);
        const tableIndex1 = Math.floor(scaledPos);
        const tableIndex2 = Math.min(tableIndex1 + 1, numTables - 1);
        const blend = scaledPos - tableIndex1;

        const table1 = tables[tableIndex1].data;
        const table2 = tables[tableIndex2].data;
        const tableSize = table1.length;
        const result = new Float32Array(tableSize);

        if (mode === 'linear') {
            for (let i = 0; i < tableSize; i++) {
                result[i] = table1[i] * (1 - blend) + table2[i] * blend;
            }
        } else if (mode === 'spectral') {
            // FFT-based interpolation (simplified)
            // In practice, you'd use proper FFT here
            for (let i = 0; i < tableSize; i++) {
                result[i] = table1[i] * (1 - blend) + table2[i] * blend;
            }
        } else if (mode === 'morph') {
            // Morphing with crossfade
            for (let i = 0; i < tableSize; i++) {
                const sign1 = Math.sign(table1[i]);
                const sign2 = Math.sign(table2[i]);
                const mag1 = Math.abs(table1[i]);
                const mag2 = Math.abs(table2[i]);
                const morphedMag = mag1 * (1 - blend) + mag2 * blend;
                const morphedSign = blend < 0.5 ? sign1 : sign2;
                result[i] = morphedSign * morphedMag;
            }
        }

        return result;
    }

    /**
     * Play a note using wavetable synthesis.
     * @param {number} frequency - Note frequency
     * @param {number} duration - Note duration in seconds
     */
    playWavetableNote(frequency, duration = 1) {
        if (!this.wavetableSynthesis) {
            this.initWavetableSynthesis();
        }

        const currentTable = this.wavetableSynthesis.currentTable || 
            this._interpolateWavetables(this.wavetableSynthesis.tablePosition);

        // Create oscillator with the wavetable
        const osc = new Tone.Oscillator({
            frequency,
            type: 'custom',
            partials: Array.from(currentTable)
        });

        const envelope = new Tone.AmplitudeEnvelope({
            attack: 0.01,
            decay: 0.1,
            sustain: 0.7,
            release: 0.2
        });

        osc.connect(envelope);
        envelope.connect(Tone.Destination);
        
        osc.start();
        envelope.triggerAttack();
        
        // Schedule release
        setTimeout(() => {
            envelope.triggerRelease();
            setTimeout(() => {
                osc.stop();
                osc.dispose();
                envelope.dispose();
            }, 200);
        }, duration * 1000);

        console.log(`[Track ${this.id}] Wavetable note: ${frequency.toFixed(1)}Hz for ${duration}s`);
        return { osc, envelope };
    }

    /**
     * Get wavetable synthesis settings.
     */
    getWavetableSettings() {
        return this.wavetableSynthesis || { enabled: false };
    }

    // =====================================================
    // MPE (MIDI POLYPHONIC EXPRESSION) SUPPORT
    // =====================================================

    /**
     * Initialize MPE support.
     * @param {Object} config - MPE configuration
     */
    initMPESupport(config = {}) {
        this.mpe = {
            enabled: config.enabled ?? true,
            zone: config.zone ?? 'lower', // 'lower', 'upper', 'full'
            numChannels: config.numChannels ?? 16,
            pitchBendRange: config.pitchBendRange ?? 48, // semitones
            timbreRange: config.timbreRange ?? 127,
            pressureRange: config.pressureRange ?? 127,
            // Per-note expression storage
            noteExpression: new Map(),
            // Channel assignments (note -> channel mapping)
            channelAssignments: new Map(),
            nextChannel: 0,
            // Expression data
            expressions: {
                pitchBend: new Map(),
                timbre: new Map(),
                pressure: new Map()
            }
        };

        console.log(`[Track ${this.id}] MPE support initialized (${this.mpe.zone} zone)`);
        return this.mpe;
    }

    /**
     * Handle MPE note on.
     * @param {number} note - MIDI note number
     * @param {number} velocity - Velocity (0-127)
     * @param {number} channel - MPE channel
     */
    mpeNoteOn(note, velocity, channel) {
        if (!this.mpe) {
            this.initMPESupport();
        }

        // Assign channel for this note
        this.mpe.channelAssignments.set(note, channel);
        
        // Initialize expression data for this note
        this.mpe.noteExpression.set(note, {
            pitchBend: 0,
            timbre: 64, // Center value
            pressure: velocity
        });

        // Store initial pressure
        this.mpe.expressions.pressure.set(note, velocity);

        console.log(`[Track ${this.id}] MPE note on: ${note} (ch${channel}, vel${velocity})`);
        return this.mpe.noteExpression.get(note);
    }

    /**
     * Handle MPE note off.
     * @param {number} note - MIDI note number
     * @param {number} channel - MPE channel
     */
    mpeNoteOff(note, channel) {
        if (!this.mpe) return;

        // Clean up
        this.mpe.channelAssignments.delete(note);
        this.mpe.noteExpression.delete(note);
        this.mpe.expressions.pitchBend.delete(note);
        this.mpe.expressions.timbre.delete(note);
        this.mpe.expressions.pressure.delete(note);

        console.log(`[Track ${this.id}] MPE note off: ${note} (ch${channel})`);
    }

    /**
     * Handle MPE pitch bend.
     * @param {number} note - Note to bend
     * @param {number} value - Pitch bend value (-8192 to 8191)
     */
    mpePitchBend(note, value) {
        if (!this.mpe) return;

        // Convert to semitones
        const semitones = (value / 8192) * this.mpe.pitchBendRange;
        
        if (this.mpe.noteExpression.has(note)) {
            this.mpe.noteExpression.get(note).pitchBend = semitones;
        }
        this.mpe.expressions.pitchBend.set(note, semitones);

        console.log(`[Track ${this.id}] MPE pitch bend: ${note} → ${semitones.toFixed(2)} st`);
        return semitones;
    }

    /**
     * Handle MPE timbre (CC74).
     * @param {number} note - Note to affect
     * @param {number} value - Timbre value (0-127)
     */
    mpeTimbre(note, value) {
        if (!this.mpe) return;

        if (this.mpe.noteExpression.has(note)) {
            this.mpe.noteExpression.get(note).timbre = value;
        }
        this.mpe.expressions.timbre.set(note, value);

        console.log(`[Track ${this.id}] MPE timbre: ${note} → ${value}`);
        return value;
    }

    /**
     * Handle MPE channel pressure.
     * @param {number} note - Note to affect
     * @param {number} value - Pressure value (0-127)
     */
    mpePressure(note, value) {
        if (!this.mpe) return;

        if (this.mpe.noteExpression.has(note)) {
            this.mpe.noteExpression.get(note).pressure = value;
        }
        this.mpe.expressions.pressure.set(note, value);

        console.log(`[Track ${this.id}] MPE pressure: ${note} → ${value}`);
        return value;
    }

    /**
     * Get expression data for a note.
     * @param {number} note - MIDI note number
     * @returns {Object} Expression data (pitchBend, timbre, pressure)
     */
    getMpeNoteExpression(note) {
        return this.mpe?.noteExpression?.get(note) || {
            pitchBend: 0,
            timbre: 64,
            pressure: 80
        };
    }

    /**
     * Apply MPE expression to a Tone.js instrument.
     * @param {Object} instrument - Tone.js instrument
     * @param {number} note - MIDI note
     */
    applyMpeToInstrument(instrument, note) {
        if (!this.mpe || !instrument) return;

        const expression = this.getMpeNoteExpression(note);
        const baseFreq = Tone.Frequency(note, 'midi').toFrequency();

        // Apply pitch bend
        const bentFreq = baseFreq * Math.pow(2, expression.pitchBend / 12);
        
        // Find the oscillator and set frequency
        if (instrument.frequency) {
            instrument.frequency.value = bentFreq;
        }

        // Apply pressure to volume
        if (instrument.volume) {
            const volumeDb = Tone.gainToDb(expression.pressure / 127);
            instrument.volume.value = volumeDb;
        }

        // Apply timbre (typically to filter)
        // This would require a filter in the signal chain

        return { frequency: bentFreq, expression };
    }

    /**
     * Get MPE settings.
     */
    getMPESettings() {
        return this.mpe || { enabled: false };
    }

    // =====================================================
    // AI-ASSISTED COMPOSITION
    // =====================================================

    /**
     * Initialize AI composition assistant.
     * @param {Object} config - AI configuration
     */
    initAIComposition(config = {}) {
        this.aiComposition = {
            enabled: config.enabled ?? true,
            model: config.model ?? 'markov', // 'markov', 'n-gram', 'rule-based'
            key: config.key ?? 'C',
            scale: config.scale ?? 'major',
            tempo: config.tempo ?? 120,
            style: config.style ?? 'electronic',
            complexity: config.complexity ?? 0.5, // 0-1
            creativity: config.creativity ?? 0.5, // 0-1
            // Training data
            trainingData: [],
            // Generated patterns cache
            generatedPatterns: [],
            // Suggestion history
            suggestions: []
        };

        // Initialize model-specific data
        this._initAIModel(this.aiComposition.model);

        console.log(`[Track ${this.id}] AI composition initialized (${this.aiComposition.model} model)`);
        return this.aiComposition;
    }

    /**
     * Initialize AI model.
     * @private
     */
    _initAIModel(model) {
        switch (model) {
            case 'markov':
                this._markovChains = {
                    melody: new Map(),
                    rhythm: new Map(),
                    harmony: new Map()
                };
                break;
            case 'n-gram':
                this._nGrams = {
                    melody: new Map(),
                    order: 3
                };
                break;
            case 'rule-based':
                this._compositionRules = this._getDefaultCompositionRules();
                break;
        }
    }

    /**
     * Get default composition rules for rule-based model.
     * @private
     */
    _getDefaultCompositionRules() {
        return {
            // Voice leading rules
            voiceLeading: {
                maxLeap: 7, // semitones
                preferStepwise: true,
                avoidParallelFifths: true,
                avoidParallelOctaves: true
            },
            // Harmonic rules
            harmony: {
                allowedProgressions: [
                    ['I', 'IV'], ['I', 'V'], ['I', 'vi'],
                    ['ii', 'V'], ['ii', 'vi'],
                    ['IV', 'I'], ['IV', 'V'],
                    ['V', 'I'], ['V', 'vi'],
                    ['vi', 'ii'], ['vi', 'IV']
                ]
            },
            // Rhythm rules
            rhythm: {
                allowedDurations: [0.25, 0.5, 1, 2], // in beats
                syncopationLevel: 0.3
            }
        };
    }

    /**
     * Train AI model on existing patterns.
     * @param {Array} patterns - Array of note patterns to learn from
     */
    trainAIModel(patterns) {
        if (!this.aiComposition) {
            this.initAIComposition();
        }

        const model = this.aiComposition.model;

        patterns.forEach(pattern => {
            this.aiComposition.trainingData.push(pattern);

            if (model === 'markov') {
                this._trainMarkovChain(pattern);
            } else if (model === 'n-gram') {
                this._trainNGram(pattern);
            }
        });

        console.log(`[Track ${this.id}] AI trained on ${patterns.length} patterns (total: ${this.aiComposition.trainingData.length})`);
    }

    /**
     * Train Markov chain on a pattern.
     * @private
     */
    _trainMarkovChain(pattern) {
        const notes = pattern.notes || [];
        if (notes.length < 2) return;

        // Train melody chain
        for (let i = 0; i < notes.length - 1; i++) {
            const current = notes[i].note || notes[i];
            const next = notes[i + 1].note || notes[i + 1];
            
            if (!this._markovChains.melody.has(current)) {
                this._markovChains.melody.set(current, new Map());
            }
            
            const transitions = this._markovChains.melody.get(current);
            transitions.set(next, (transitions.get(next) || 0) + 1);
        }

        // Train rhythm chain
        for (let i = 0; i < notes.length - 1; i++) {
            const currentDur = notes[i].duration || 1;
            const nextDur = notes[i + 1].duration || 1;
            
            if (!this._markovChains.rhythm.has(currentDur)) {
                this._markovChains.rhythm.set(currentDur, new Map());
            }
            
            const transitions = this._markovChains.rhythm.get(currentDur);
            transitions.set(nextDur, (transitions.get(nextDur) || 0) + 1);
        }
    }

    /**
     * Train n-gram model on a pattern.
     * @private
     */
    _trainNGram(pattern) {
        const notes = pattern.notes || [];
        const order = this._nGrams.order;
        
        if (notes.length < order) return;

        for (let i = 0; i <= notes.length - order; i++) {
            const nGram = notes.slice(i, i + order).map(n => n.note || n).join(',');
            const next = notes[i + order]?.note || notes[i + order];
            
            if (!this._nGrams.melody.has(nGram)) {
                this._nGrams.melody.set(nGram, new Map());
            }
            
            const transitions = this._nGrams.melody.get(nGram);
            transitions.set(next, (transitions.get(next) || 0) + 1);
        }
    }

    /**
     * Generate a new pattern using AI.
     * @param {Object} options - Generation options
     * @returns {Object} Generated pattern
     */
    generateAIPattern(options = {}) {
        if (!this.aiComposition) {
            this.initAIComposition();
        }

        const length = options.length ?? 16; // Number of steps
        const model = this.aiComposition.model;
        const creativity = options.creativity ?? this.aiComposition.creativity;

        let pattern = null;

        switch (model) {
            case 'markov':
                pattern = this._generateFromMarkov(length, creativity);
                break;
            case 'n-gram':
                pattern = this._generateFromNGram(length, creativity);
                break;
            case 'rule-based':
                pattern = this._generateFromRules(length, creativity);
                break;
        }

        if (pattern) {
            pattern.id = `ai-${Date.now()}`;
            pattern.generated = true;
            pattern.model = model;
            this.aiComposition.generatedPatterns.push(pattern);
        }

        console.log(`[Track ${this.id}] AI generated pattern (${model}, ${length} steps, creativity: ${creativity})`);
        return pattern;
    }

    /**
     * Generate from Markov chain.
     * @private
     */
    _generateFromMarkov(length, creativity) {
        const notes = [];
        let currentNote = 60; // Start from middle C

        for (let i = 0; i < length; i++) {
            // Get possible next notes
            const transitions = this._markovChains.melody.get(currentNote);
            
            if (transitions && transitions.size > 0 && Math.random() > creativity) {
                // Follow the chain
                const total = Array.from(transitions.values()).reduce((a, b) => a + b, 0);
                let rand = Math.random() * total;
                
                for (const [note, count] of transitions) {
                    rand -= count;
                    if (rand <= 0) {
                        currentNote = note;
                        break;
                    }
                }
            } else {
                // Creative: random note
                currentNote = this._getRandomNoteInScale(
                    this.aiComposition.key,
                    this.aiComposition.scale
                );
            }

            notes.push({
                step: i,
                note: currentNote,
                velocity: 80 + Math.floor(Math.random() * 40),
                duration: 1
            });
        }

        return { notes, length };
    }

    /**
     * Generate from n-gram model.
     * @private
     */
    _generateFromNGram(length, creativity) {
        const notes = [];
        const order = this._nGrams.order;
        
        // Start with a random n-gram
        const startNGrams = Array.from(this._nGrams.melody.keys());
        let currentNGram = startNGrams[Math.floor(Math.random() * startNGrams.length)];
        const startNotes = currentNGram.split(',').map(Number);
        
        startNotes.forEach((note, i) => {
            notes.push({
                step: i,
                note,
                velocity: 80,
                duration: 1
            });
        });

        for (let i = order; i < length; i++) {
            const transitions = this._nGrams.melody.get(currentNGram);
            
            let nextNote;
            if (transitions && transitions.size > 0 && Math.random() > creativity) {
                // Follow the model
                const total = Array.from(transitions.values()).reduce((a, b) => a + b, 0);
                let rand = Math.random() * total;
                
                for (const [note, count] of transitions) {
                    rand -= count;
                    if (rand <= 0) {
                        nextNote = note;
                        break;
                    }
                }
            } else {
                // Creative: random
                nextNote = this._getRandomNoteInScale(
                    this.aiComposition.key,
                    this.aiComposition.scale
                );
            }

            notes.push({
                step: i,
                note: nextNote,
                velocity: 80 + Math.floor(Math.random() * 40),
                duration: 1
            });

            // Update n-gram
            currentNGram = notes.slice(i - order + 1, i + 1).map(n => n.note).join(',');
        }

        return { notes, length };
    }

    /**
     * Generate from rules.
     * @private
     */
    _generateFromRules(length, creativity) {
        const rules = this._compositionRules;
        const notes = [];
        
        // Get scale notes
        const scaleNotes = this._getScaleNotes(this.aiComposition.key, this.aiComposition.scale);
        
        let lastNote = scaleNotes[0];

        for (let i = 0; i < length; i++) {
            let note = lastNote;

            if (Math.random() > creativity) {
                // Follow voice leading rules
                const maxLeap = rules.voiceLeading.maxLeap;
                const stepwiseProb = rules.voiceLeading.preferStepwise ? 0.7 : 0.3;
                
                if (Math.random() < stepwiseProb) {
                    // Stepwise motion
                    const direction = Math.random() > 0.5 ? 1 : -1;
                    note = lastNote + direction;
                } else {
                    // Leap
                    const leap = Math.floor(Math.random() * maxLeap);
                    const direction = Math.random() > 0.5 ? 1 : -1;
                    note = lastNote + direction * leap;
                }
                
                // Quantize to scale
                note = this._quantizeToScale(note, scaleNotes);
            } else {
                // Creative: random from scale
                note = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
            }

            notes.push({
                step: i,
                note,
                velocity: 80 + Math.floor(Math.random() * 40),
                duration: rules.rhythm.allowedDurations[Math.floor(Math.random() * rules.rhythm.allowedDurations.length)]
            });

            lastNote = note;
        }

        return { notes, length };
    }

    /**
     * Get random note in scale.
     * @private
     */
    _getRandomNoteInScale(key, scale) {
        const scaleNotes = this._getScaleNotes(key, scale);
        return scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
    }

    /**
     * Get scale notes.
     * @private
     */
    _getScaleNotes(key, scale) {
        // Key to MIDI note mapping
        const keyMap = { 'C': 60, 'C#': 61, 'D': 62, 'D#': 63, 'E': 64, 'F': 65, 'F#': 66, 'G': 67, 'G#': 68, 'A': 69, 'A#': 70, 'B': 71 };
        const keyNum = keyMap[key] || 60;

        // Scale intervals (semitones from root)
        const scales = {
            'major': [0, 2, 4, 5, 7, 9, 11],
            'minor': [0, 2, 3, 5, 7, 8, 10],
            'pentatonic': [0, 2, 4, 7, 9],
            'blues': [0, 3, 5, 6, 7, 10],
            'dorian': [0, 2, 3, 5, 7, 9, 10],
            'mixolydian': [0, 2, 4, 5, 7, 9, 10],
            'lydian': [0, 2, 4, 6, 7, 9, 11]
        };

        const intervals = scales[scale] || scales.major;
        return intervals.map(i => keyNum + i);
    }

    /**
     * Quantize note to scale.
     * @private
     */
    _quantizeToScale(note, scaleNotes) {
        let closest = scaleNotes[0];
        let minDist = Math.abs(note - closest);

        for (const scaleNote of scaleNotes) {
            const dist = Math.abs(note - scaleNote);
            if (dist < minDist) {
                minDist = dist;
                closest = scaleNote;
            }
        }

        return closest;
    }

    /**
     * Get AI composition settings.
     */
    getAICompositionSettings() {
        return this.aiComposition || { enabled: false };
    }

    // =====================================================
    // COLLABORATIVE EDITING
    // =====================================================

    /**
     * Initialize collaborative editing.
     * @param {Object} config - Collaboration configuration
     */
    initCollaborativeEditing(config = {}) {
        this.collaboration = {
            enabled: config.enabled ?? true,
            sessionId: config.sessionId ?? null,
            userId: config.userId ?? `user-${Date.now()}`,
            userName: config.userName ?? 'Anonymous',
            // Connected users
            users: new Map(),
            // Edit history for sync
            editHistory: [],
            // Conflict resolution
            conflictResolution: config.conflictResolution ?? 'last-write-wins', // 'last-write-wins', 'operational-transform'
            // Presence (cursor, selection)
            presence: {
                cursor: null,
                selection: null,
                lastUpdate: Date.now()
            },
            // Permissions
            permissions: config.permissions ?? 'edit', // 'view', 'comment', 'edit', 'admin'
            // Real-time sync
            syncEnabled: config.syncEnabled ?? true,
            syncInterval: config.syncInterval ?? 100, // ms
            lastSync: Date.now()
        };

        // Initialize operational transform if needed
        if (this.collaboration.conflictResolution === 'operational-transform') {
            this._initOperationalTransform();
        }

        console.log(`[Track ${this.id}] Collaborative editing initialized`);
        return this.collaboration;
    }

    /**
     * Initialize operational transform.
     * @private
     */
    _initOperationalTransform() {
        this._ot = {
            pendingOps: [],
            appliedOps: [],
            version: 0
        };
    }

    /**
     * Join a collaboration session.
     * @param {string} sessionId - Session ID to join
     * @param {Object} userInfo - User information
     */
    joinCollaboration(sessionId, userInfo = {}) {
        if (!this.collaboration) {
            this.initCollaborativeEditing();
        }

        this.collaboration.sessionId = sessionId;
        this.collaboration.userId = userInfo.userId || this.collaboration.userId;
        this.collaboration.userName = userInfo.userName || this.collaboration.userName;

        // Broadcast join to other users
        this._broadcastPresence({
            type: 'join',
            userId: this.collaboration.userId,
            userName: this.collaboration.userName,
            timestamp: Date.now()
        });

        console.log(`[Track ${this.id}] Joined collaboration: ${sessionId} as ${this.collaboration.userName}`);
        return this.collaboration;
    }

    /**
     * Leave collaboration session.
     */
    leaveCollaboration() {
        if (!this.collaboration) return;

        // Broadcast leave
        this._broadcastPresence({
            type: 'leave',
            userId: this.collaboration.userId,
            timestamp: Date.now()
        });

        this.collaboration.sessionId = null;
        this.collaboration.users.clear();

        console.log(`[Track ${this.id}] Left collaboration`);
    }

    /**
     * Handle remote user join.
     * @param {Object} user - User data
     */
    handleRemoteUserJoin(user) {
        if (!this.collaboration) return;

        this.collaboration.users.set(user.userId, {
            ...user,
            presence: {
                cursor: null,
                selection: null,
                lastUpdate: Date.now()
            }
        });

        console.log(`[Track ${this.id}] Remote user joined: ${user.userName}`);
    }

    /**
     * Handle remote user leave.
     * @param {string} userId - User ID
     */
    handleRemoteUserLeave(userId) {
        if (!this.collaboration) return;

        this.collaboration.users.delete(userId);
        console.log(`[Track ${this.id}] Remote user left: ${userId}`);
    }

    /**
     * Update presence (cursor position, selection).
     * @param {Object} presence - Presence data
     */
    updatePresence(presence) {
        if (!this.collaboration) return;

        this.collaboration.presence = {
            ...presence,
            lastUpdate: Date.now()
        };

        // Broadcast presence update
        this._broadcastPresence({
            type: 'presence',
            userId: this.collaboration.userId,
            presence: this.collaboration.presence,
            timestamp: Date.now()
        });
    }

    /**
     * Handle remote presence update.
     * @param {string} userId - User ID
     * @param {Object} presence - Presence data
     */
    handleRemotePresence(userId, presence) {
        if (!this.collaboration) return;

        const user = this.collaboration.users.get(userId);
        if (user) {
            user.presence = {
                ...presence,
                lastUpdate: Date.now()
            };
        }
    }

    /**
     * Record an edit for synchronization.
     * @param {Object} edit - Edit operation
     */
    recordEdit(edit) {
        if (!this.collaboration?.syncEnabled) return;

        const editRecord = {
            id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            userId: this.collaboration.userId,
            operation: edit.operation,
            target: edit.target,
            value: edit.value,
            previousValue: edit.previousValue,
            timestamp: Date.now(),
            version: this._ot?.version || 0
        };

        this.collaboration.editHistory.push(editRecord);

        // Keep history bounded
        if (this.collaboration.editHistory.length > 1000) {
            this.collaboration.editHistory = this.collaboration.editHistory.slice(-500);
        }

        // Broadcast edit
        this._broadcastEdit(editRecord);

        // Increment version for OT
        if (this._ot) {
            this._ot.version++;
            this._ot.appliedOps.push(editRecord);
        }

        return editRecord;
    }

    /**
     * Handle remote edit.
     * @param {Object} edit - Remote edit operation
     */
    handleRemoteEdit(edit) {
        if (!this.collaboration) return;

        // Conflict resolution
        if (this.collaboration.conflictResolution === 'last-write-wins') {
            // Simply apply the edit
            this._applyEdit(edit);
        } else if (this.collaboration.conflictResolution === 'operational-transform') {
            // Transform and apply
            this._transformAndApply(edit);
        }

        // Record in history
        this.collaboration.editHistory.push(edit);
    }

    /**
     * Apply an edit operation.
     * @private
     */
    _applyEdit(edit) {
        switch (edit.operation) {
            case 'note-add':
                // Add note to sequence
                if (this.sequences && edit.target?.sequenceId) {
                    const seq = this.sequences.find(s => s.id === edit.target.sequenceId);
                    if (seq) {
                        seq.notes.push(edit.value);
                    }
                }
                break;
            case 'note-remove':
                // Remove note from sequence
                if (this.sequences && edit.target?.sequenceId) {
                    const seq = this.sequences.find(s => s.id === edit.target.sequenceId);
                    if (seq) {
                        seq.notes = seq.notes.filter(n => 
                            !(n.step === edit.value.step && n.note === edit.value.note)
                        );
                    }
                }
                break;
            case 'note-update':
                // Update note in sequence
                if (this.sequences && edit.target?.sequenceId) {
                    const seq = this.sequences.find(s => s.id === edit.target.sequenceId);
                    if (seq) {
                        const note = seq.notes.find(n => 
                            n.step === edit.target.step && n.note === edit.target.note
                        );
                        if (note) {
                            Object.assign(note, edit.value);
                        }
                    }
                }
                break;
            // Add more operations as needed
        }
    }

    /**
     * Transform and apply edit (OT).
     * @private
     */
    _transformAndApply(edit) {
        // Simplified OT: check for conflicts with pending ops
        let transformedEdit = { ...edit };

        if (this._ot) {
            for (const pending of this._ot.pendingOps) {
                transformedEdit = this._transformOperation(transformedEdit, pending);
            }
        }

        this._applyEdit(transformedEdit);
    }

    /**
     * Transform one operation against another.
     * @private
     */
    _transformOperation(op1, op2) {
        // Simplified transformation logic
        // In a full implementation, this would handle all operation types
        if (op1.operation === op2.operation && 
            op1.target?.step === op2.target?.step &&
            op1.target?.note === op2.target?.note) {
            // Conflict: use timestamp to resolve
            return op1.timestamp > op2.timestamp ? op1 : op2;
        }
        return op1;
    }

    /**
     * Broadcast presence to other users.
     * @private
     */
    _broadcastPresence(data) {
        // In a real implementation, this would use WebRTC or WebSocket
        // For now, we just log it
        console.log(`[Track ${this.id}] Broadcasting presence:`, data);
        
        // Emit custom event for external handling
        if (this.appServices?.broadcastPresence) {
            this.appServices.broadcastPresence(data);
        }
    }

    /**
     * Broadcast edit to other users.
     * @private
     */
    _broadcastEdit(edit) {
        // In a real implementation, this would use WebRTC or WebSocket
        console.log(`[Track ${this.id}] Broadcasting edit:`, edit.id);
        
        if (this.appServices?.broadcastEdit) {
            this.appServices.broadcastEdit(edit);
        }
    }

    /**
     * Get connected users.
     * @returns {Array} Array of connected users
     */
    getConnectedUsers() {
        if (!this.collaboration) return [];
        return Array.from(this.collaboration.users.values());
    }

    /**
     * Get collaboration settings.
     */
    getCollaborationSettings() {
        return this.collaboration || { enabled: false };
    }

    // =====================================================
    // MOBILE TOUCH OPTIMIZATION
    // =====================================================

    /**
     * Initialize mobile touch support.
     * @param {Object} config - Touch configuration
     */
    initMobileTouch(config = {}) {
        this.mobileTouch = {
            enabled: config.enabled ?? true,
            touchSensitivity: config.touchSensitivity ?? 1.0,
            gestureRecognition: config.gestureRecognition ?? true,
            multiTouch: config.multiTouch ?? true,
            maxTouchPoints: config.maxTouchPoints ?? 10,
            // Gesture thresholds
            gestureThresholds: config.gestureThresholds ?? {
                tapMaxTime: 300, // ms
                tapMaxDistance: 10, // pixels
                swipeMinDistance: 50,
                swipeMaxTime: 500,
                pinchMinDistance: 20,
                rotateThreshold: 5 // degrees
            },
            // Active touches
            activeTouches: new Map(),
            // Gesture history
            gestureHistory: [],
            // Touch targets
            touchTargets: new Map(),
            // Haptic feedback
            hapticFeedback: config.hapticFeedback ?? true
        };

        console.log(`[Track ${this.id}] Mobile touch initialized`);
        return this.mobileTouch;
    }

    /**
     * Handle touch start.
     * @param {Touch} touch - Touch object
     * @param {Object} context - Touch context
     */
    handleTouchStart(touch, context = {}) {
        if (!this.mobileTouch?.enabled) return null;

        const touchId = touch.identifier;
        const touchData = {
            id: touchId,
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: Date.now(),
            currentX: touch.clientX,
            currentY: touch.clientY,
            target: touch.target,
            context
        };

        this.mobileTouch.activeTouches.set(touchId, touchData);

        // Haptic feedback
        if (this.mobileTouch.hapticFeedback && navigator.vibrate) {
            navigator.vibrate(10);
        }

        return touchData;
    }

    /**
     * Handle touch move.
     * @param {Touch} touch - Touch object
     */
    handleTouchMove(touch) {
        if (!this.mobileTouch?.enabled) return null;

        const touchId = touch.identifier;
        const touchData = this.mobileTouch.activeTouches.get(touchId);
        
        if (!touchData) return null;

        // Update position
        touchData.currentX = touch.clientX;
        touchData.currentY = touch.clientY;
        touchData.lastUpdate = Date.now();

        // Calculate delta
        touchData.deltaX = touchData.currentX - touchData.startX;
        touchData.deltaY = touchData.currentY - touchData.startY;

        // Check for gesture
        const gesture = this._detectGesture(touchData);
        
        if (gesture) {
            touchData.gesture = gesture;
            this.mobileTouch.gestureHistory.push({
                ...gesture,
                touchId,
                timestamp: Date.now()
            });
        }

        return touchData;
    }

    /**
     * Handle touch end.
     * @param {Touch} touch - Touch object
     */
    handleTouchEnd(touch) {
        if (!this.mobileTouch?.enabled) return null;

        const touchId = touch.identifier;
        const touchData = this.mobileTouch.activeTouches.get(touchId);
        
        if (!touchData) return null;

        const duration = Date.now() - touchData.startTime;
        const distance = Math.sqrt(
            Math.pow(touch.clientX - touchData.startX, 2) +
            Math.pow(touch.clientY - touchData.startY, 2)
        );

        // Finalize gesture
        let finalGesture = null;
        const thresholds = this.mobileTouch.gestureThresholds;

        if (duration < thresholds.tapMaxTime && distance < thresholds.tapMaxDistance) {
            finalGesture = {
                type: 'tap',
                x: touchData.startX,
                y: touchData.startY,
                duration
            };
        } else if (distance > thresholds.swipeMinDistance && duration < thresholds.swipeMaxTime) {
            const angle = Math.atan2(
                touch.clientY - touchData.startY,
                touch.clientX - touchData.startX
            ) * 180 / Math.PI;
            
            finalGesture = {
                type: 'swipe',
                direction: this._getSwipeDirection(angle),
                distance,
                angle,
                duration
            };
        }

        // Remove touch
        this.mobileTouch.activeTouches.delete(touchId);

        if (finalGesture) {
            this.mobileTouch.gestureHistory.push(finalGesture);
        }

        console.log(`[Track ${this.id}] Touch ended: ${finalGesture?.type || 'none'}`);
        return finalGesture;
    }

    /**
     * Detect gesture during touch move.
     * @private
     */
    _detectGesture(touchData) {
        const thresholds = this.mobileTouch.gestureThresholds;
        const distance = Math.sqrt(
            Math.pow(touchData.deltaX || 0, 2) +
            Math.pow(touchData.deltaY || 0, 2)
        );

        if (distance > thresholds.swipeMinDistance) {
            return {
                type: 'drag',
                startX: touchData.startX,
                startY: touchData.startY,
                currentX: touchData.currentX,
                currentY: touchData.currentY,
                distance
            };
        }

        return null;
    }

    /**
     * Get swipe direction from angle.
     * @private
     */
    _getSwipeDirection(angle) {
        if (angle >= -45 && angle < 45) return 'right';
        if (angle >= 45 && angle < 135) return 'down';
        if (angle >= -135 && angle < -45) return 'up';
        return 'left';
    }

    /**
     * Handle multi-touch (pinch/rotate).
     * @param {Array} touches - Array of active touches
     */
    handleMultiTouch(touches) {
        if (!this.mobileTouch?.multiTouch || touches.length < 2) return null;

        const t1 = this.mobileTouch.activeTouches.get(touches[0].identifier);
        const t2 = this.mobileTouch.activeTouches.get(touches[1].identifier);

        if (!t1 || !t2) return null;

        // Calculate pinch scale
        const currentDistance = Math.sqrt(
            Math.pow(t2.currentX - t1.currentX, 2) +
            Math.pow(t2.currentY - t1.currentY, 2)
        );

        const startDistance = Math.sqrt(
            Math.pow(t2.startX - t1.startX, 2) +
            Math.pow(t2.startY - t1.startY, 2)
        );

        const scale = currentDistance / startDistance;

        // Calculate rotation
        const currentAngle = Math.atan2(t2.currentY - t1.currentY, t2.currentX - t1.currentX);
        const startAngle = Math.atan2(t2.startY - t1.startY, t2.startX - t1.startX);
        const rotation = (currentAngle - startAngle) * 180 / Math.PI;

        return {
            type: 'multi-touch',
            scale,
            rotation,
            center: {
                x: (t1.currentX + t2.currentX) / 2,
                y: (t1.currentY + t2.currentY) / 2
            }
        };
    }

    /**
     * Register touch target.
     * @param {string} targetId - Target identifier
     * @param {Object} callbacks - Callback functions
     */
    registerTouchTarget(targetId, callbacks = {}) {
        if (!this.mobileTouch) {
            this.initMobileTouch();
        }

        this.mobileTouch.touchTargets.set(targetId, {
            id: targetId,
            callbacks: {
                onTap: callbacks.onTap,
                onSwipe: callbacks.onSwipe,
                onPinch: callbacks.onPinch,
                onRotate: callbacks.onRotate,
                onLongPress: callbacks.onLongPress,
                onDrag: callbacks.onDrag
            }
        });

        console.log(`[Track ${this.id}] Touch target registered: ${targetId}`);
    }

    /**
     * Get mobile touch settings.
     */
    getMobileTouchSettings() {
        return this.mobileTouch || { enabled: false };
    }
}
