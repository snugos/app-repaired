// js/audio.js - Audio Engine, Tone.js interactions, Sample Loading
import * as Constants from './constants.js';
import { showNotification } from './utils.js';
// getEffectDefaultParams will now be accessed via appServices.effectsRegistryAccess
import { createEffectInstance } from './effectsRegistry.js';
import { storeAudio, getAudio } from './db.js';
import { getRecordingTrackIdState, getRecordingStartTimeState } from './state.js'; // Import state getters


let masterEffectsBusInputNode = null;
let masterGainNodeActual = null; // The actual Tone.Gain node for master volume
let masterMeterNode = null;
let activeMasterEffectNodes = new Map();

let audioContextInitialized = false;

let localAppServices = {};

// Variables for audio recording
let mic = null;
let recorder = null;


export function initializeAudioModule(appServicesFromMain) {
    localAppServices = appServicesFromMain;
}

export function getMasterEffectsBusInputNode() {
    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed) {
        setupMasterBus();
    }
    return masterEffectsBusInputNode;
}

// New getter for the actual Tone.js master gain node
export function getActualMasterGainNode() {
    if (!masterGainNodeActual || masterGainNodeActual.disposed) {
        setupMasterBus(); // Ensure it's created if needed
    }
    return masterGainNodeActual;
}


export async function initAudioContextAndMasterMeter(isUserInitiated = false) {
    if (audioContextInitialized && Tone.context.state === 'running') {
        if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed || !masterGainNodeActual || masterGainNodeActual.disposed) {
            setupMasterBus();
        }
        return true;
    }
    try {
        await Tone.start();
        if (Tone.context.state === 'running') {
            if(!audioContextInitialized) {
                setupMasterBus();
            } else if (!masterMeterNode || masterMeterNode.disposed) {
                setupMasterBus();
            }
            audioContextInitialized = true;
            return true;
        } else {
            console.warn('[Audio] Audio context NOT running after Tone.start(). State:', Tone.context.state);
            if (isUserInitiated) {
                showNotification("AudioContext could not be started. Please click again or refresh.", 5000);
            } else {
                showNotification("Audio system needs a user interaction (like clicking Play) to start.", 4000);
            }
            audioContextInitialized = false;
            return false;
        }
    } catch (error) {
        console.error("[Audio] Error during Tone.start() or master bus setup:", error);
        showNotification(`Error initializing audio: ${error.message || 'Please check console.'}`, 4000);
        audioContextInitialized = false;
        return false;
    }
}

function setupMasterBus() {
    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed) {
        if (masterEffectsBusInputNode && !masterEffectsBusInputNode.disposed) {
             try {masterEffectsBusInputNode.dispose();} catch(e){console.warn("[Audio] Error disposing old master bus input", e.message)}
        }
        masterEffectsBusInputNode = new Tone.Gain().toDestination(); // Temp connect
    }

    if (!masterGainNodeActual || masterGainNodeActual.disposed) {
        if (masterGainNodeActual && !masterGainNodeActual.disposed) {
            try {masterGainNodeActual.dispose();} catch(e){console.warn("[Audio] Error disposing old master gain node", e.message)}
        }
        const initialMasterVolumeValue = localAppServices.getMasterGainValue ? localAppServices.getMasterGainValue() : Tone.dbToGain(0);
        masterGainNodeActual = new Tone.Gain(initialMasterVolumeValue);
        if (localAppServices.setMasterGainValue) localAppServices.setMasterGainValue(masterGainNodeActual.gain.value);
    }

    if (!masterMeterNode || masterMeterNode.disposed) {
        if (masterMeterNode && !masterMeterNode.disposed) {
            try { masterMeterNode.dispose(); } catch(e) { console.warn("[Audio] Error disposing old master meter", e.message); }
        }
        masterMeterNode = new Tone.Meter({ smoothing: 0.8 });
    }
    rebuildMasterEffectChain();
}

export function rebuildMasterEffectChain() {
    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed || !masterGainNodeActual || masterGainNodeActual.disposed) {
        setupMasterBus();
        if (!masterEffectsBusInputNode || !masterGainNodeActual) {
            console.error('[Audio] Master bus components still not ready after setup attempt. Aborting chain rebuild.');
            return;
        }
    }

    try { masterEffectsBusInputNode.disconnect(); } catch(e) { /* ignore */ }
    activeMasterEffectNodes.forEach(node => {
        if (node && !node.disposed) try { node.disconnect(); } catch(e) { /*ignore*/ }
    });
    try { masterGainNodeActual.disconnect(); } catch(e) { /* ignore */ }
    if (masterMeterNode && !masterMeterNode.disposed) {
        try { masterGainNodeActual.disconnect(masterMeterNode); } catch(e) { /* ignore */ }
    }

    let currentAudioPathEnd = masterEffectsBusInputNode;
    const masterEffectsState = localAppServices.getMasterEffects ? localAppServices.getMasterEffects() : [];

    masterEffectsState.forEach(effectState => {
        const effectNode = activeMasterEffectNodes.get(effectState.id);
        if (effectNode && !effectNode.disposed) {
            if (currentAudioPathEnd && !currentAudioPathEnd.disposed) {
                try {
                    currentAudioPathEnd.connect(effectNode);
                    currentAudioPathEnd = effectNode;
                } catch (e) {
                    console.error(`[Audio] Error connecting master effect ${effectState.type}:`, e);
                }
            } else {
                currentAudioPathEnd = effectNode;
            }
        } else {
            // Attempt to recreate if missing (e.g., after project load before full init)
            const recreatedNode = createEffectInstance(effectState.type, effectState.params);
            if (recreatedNode) {
                activeMasterEffectNodes.set(effectState.id, recreatedNode);
                if (currentAudioPathEnd && !currentAudioPathEnd.disposed) {
                    currentAudioPathEnd.connect(recreatedNode);
                }
                currentAudioPathEnd = recreatedNode;
                console.warn(`[Audio] Recreated missing master effect node for ${effectState.type} (ID: ${effectState.id}) during rebuild.`);
            } else {
                console.warn(`[Audio] Master effect node for ${effectState.type} (ID: ${effectState.id}) not found and could not be recreated.`);
            }
        }
    });

    if (currentAudioPathEnd && !currentAudioPathEnd.disposed && masterGainNodeActual && !masterGainNodeActual.disposed) {
        try {
            currentAudioPathEnd.connect(masterGainNodeActual);
        } catch (e) {
            console.error(`[Audio] Error connecting master chain output to masterGainNode:`, e);
        }
    }

    if (masterGainNodeActual && !masterGainNodeActual.disposed) {
        try {
            masterGainNodeActual.toDestination();
            if (masterMeterNode && !masterMeterNode.disposed) {
                masterGainNodeActual.connect(masterMeterNode);
            } else {
                 console.warn("[Audio] Master meter node not available for connection during rebuild.");
                 // Attempt to re-create meter if necessary
                masterMeterNode = new Tone.Meter({ smoothing: 0.8 });
                masterGainNodeActual.connect(masterMeterNode);
            }
        } catch (e) { console.error("[Audio] Error connecting masterGainNode to destination/meter:", e); }
    }
}


export async function addMasterEffectToAudio(effectIdInState, effectType, initialParams) {
    const toneNode = createEffectInstance(effectType, initialParams);
    if (toneNode) {
        activeMasterEffectNodes.set(effectIdInState, toneNode);
        rebuildMasterEffectChain();
    } else {
        showNotification(`Failed to create master effect: ${effectType}`, 3000);
    }
}

export async function removeMasterEffectFromAudio(effectId) {
    const nodeToRemove = activeMasterEffectNodes.get(effectId);
    if (nodeToRemove && !nodeToRemove.disposed) {
        try {
            nodeToRemove.dispose();
        } catch (e) {
            console.warn(`[Audio] Error disposing master effect node for ID ${effectId}:`, e);
        }
    }
    activeMasterEffectNodes.delete(effectId);
    rebuildMasterEffectChain();
}

export function updateMasterEffectParamInAudio(effectId, paramPath, value) {
    const effectNode = activeMasterEffectNodes.get(effectId);
    if (!effectNode || effectNode.disposed) {
        console.warn(`[Audio] Master effect node for ID ${effectId} not found for param update.`);
        return;
    }
    try {
        const keys = paramPath.split('.');
        let targetObject = effectNode;
        for (let i = 0; i < keys.length - 1; i++) {
            targetObject = targetObject[keys[i]];
            if (typeof targetObject === 'undefined') throw new Error(`Path ${keys.slice(0,i+1).join('.')} not found.`);
        }
        const finalParamKey = keys[keys.length - 1];
        const paramInstance = targetObject[finalParamKey];

        if (paramInstance && typeof paramInstance.value !== 'undefined') {
            if (typeof paramInstance.rampTo === 'function') paramInstance.rampTo(value, 0.02);
            else paramInstance.value = value;
        } else {
            targetObject[finalParamKey] = value;
        }
    } catch (err) {
        console.error(`[Audio] Error updating param ${paramPath} for master effect ID ${effectId}:`, err);
    }
}

export function reorderMasterEffectInAudio(effectIdIgnored, newIndexIgnored) {
    rebuildMasterEffectChain();
}


export function updateMeters(globalMasterMeterBar, mixerMasterMeterBar, tracks) {
    if (Tone.context.state !== 'running' || !audioContextInitialized) return;

    if (masterMeterNode && typeof masterMeterNode.getValue === 'function' && !masterMeterNode.disposed) {
        const masterLevelValue = masterMeterNode.getValue();
        const level = Tone.dbToGain(Array.isArray(masterLevelValue) ? masterLevelValue[0] : masterLevelValue);
        const isClipping = (Array.isArray(masterLevelValue) ? masterLevelValue[0] : masterLevelValue) > -0.1;


        if (globalMasterMeterBar) {
            globalMasterMeterBar.style.width = `${Math.min(100, level * 100)}%`;
            globalMasterMeterBar.classList.toggle('clipping', isClipping);
        }
        if (mixerMasterMeterBar) {
            mixerMasterMeterBar.style.width = `${Math.min(100, level * 100)}%`;
            mixerMasterMeterBar.classList.toggle('clipping', isClipping);
        }
    }

    (tracks || []).forEach(track => {
        if (track && track.trackMeter && typeof track.trackMeter.getValue === 'function' && !track.trackMeter.disposed) {
            const meterValue = track.trackMeter.getValue();
            const level = Tone.dbToGain(Array.isArray(meterValue) ? meterValue[0] : meterValue);
            const isClipping = (Array.isArray(meterValue) ? meterValue[0] : meterValue) > -0.1;


            if (localAppServices.updateTrackMeterUI) {
                localAppServices.updateTrackMeterUI(track.id, level, isClipping);
            }
        }
    });
}

export async function playSlicePreview(trackId, sliceIndex, velocity = 0.7, additionalPitchShiftInSemitones = 0) {
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) { showNotification("Audio not ready for preview.", 2000); return; }

    const track = localAppServices.getTrackById(trackId);

    if (!track || track.type !== 'Sampler' || !track.audioBuffer || !track.audioBuffer.loaded || !track.slices[sliceIndex]) {
        console.warn(`[Audio] Conditions not met for playing slice preview for track ${trackId}, slice ${sliceIndex}`);
        return;
    }
    const sliceData = track.slices[sliceIndex];
    if (sliceData.duration <= 0) return;
    const time = Tone.now();
    const totalPitchShift = (sliceData.pitchShift || 0) + additionalPitchShiftInSemitones;
    const playbackRate = Math.pow(2, totalPitchShift / 12);
    let playDuration = sliceData.duration / playbackRate;
    if (sliceData.loop) playDuration = Math.min(playDuration, 2);

    const actualDestination = (track.activeEffects.length > 0 && track.activeEffects[0].toneNode && !track.activeEffects[0].toneNode.disposed)
        ? track.activeEffects[0].toneNode
        : (track.gainNode && !track.gainNode.disposed ? track.gainNode : getMasterEffectsBusInputNode());


    if (!track.slicerIsPolyphonic) {
        if (!track.slicerMonoPlayer || track.slicerMonoPlayer.disposed) {
            track.setupSlicerMonoNodes();
            if(!track.slicerMonoPlayer) {
                console.warn(`[Audio] Mono slicer player not set up for track ${trackId}`);
                return;
            }
             if(track.audioBuffer && track.audioBuffer.loaded) track.slicerMonoPlayer.buffer = track.audioBuffer;
        }
        const player = track.slicerMonoPlayer; const env = track.slicerMonoEnvelope; const gain = track.slicerMonoGain;

        if (gain && !gain.disposed && actualDestination && !actualDestination.disposed) {
            try { gain.disconnect(); } catch(e) {/*ignore*/}
            gain.connect(actualDestination);
        }


        if (player.state === 'started') player.stop(time);
        if (env.getValueAtTime(time) > 0.001) env.triggerRelease(time);
        player.buffer = track.audioBuffer; env.set(sliceData.envelope);
        gain.gain.value = Tone.dbToGain(-6) * sliceData.volume * velocity;
        player.playbackRate = playbackRate; player.reverse = sliceData.reverse;
        player.loop = sliceData.loop; player.loopStart = sliceData.offset; player.loopEnd = sliceData.offset + sliceData.duration;

        player.start(time, sliceData.offset, sliceData.loop ? undefined : playDuration);
        env.triggerAttack(time);
        if (!sliceData.loop) {
            const releaseTime = time + playDuration - (sliceData.envelope.release || 0.1);
            env.triggerRelease(Math.max(time, releaseTime));
        }
    } else {
        const tempPlayer = new Tone.Player(track.audioBuffer);
        const tempEnv = new Tone.AmplitudeEnvelope(sliceData.envelope);
        const tempGain = new Tone.Gain(Tone.dbToGain(-6) * sliceData.volume * velocity);
        tempPlayer.chain(tempEnv, tempGain, actualDestination);
        tempPlayer.playbackRate = playbackRate; tempPlayer.reverse = sliceData.reverse;
        tempPlayer.loop = sliceData.loop; tempPlayer.loopStart = sliceData.offset; tempPlayer.loopEnd = sliceData.offset + sliceData.duration;
        tempPlayer.start(time, sliceData.offset, sliceData.loop ? undefined : playDuration);
        tempEnv.triggerAttack(time);
        if (!sliceData.loop) tempEnv.triggerRelease(time + playDuration * 0.95);
        Tone.Transport.scheduleOnce(() => { if(tempPlayer && !tempPlayer.disposed) tempPlayer.dispose(); if(tempEnv && !tempEnv.disposed) tempEnv.dispose(); if(tempGain && !tempGain.disposed) tempGain.dispose(); }, time + playDuration + (sliceData.envelope.release || 0.1) + 0.2);
    }
}

export async function playDrumSamplerPadPreview(trackId, padIndex, velocity = 0.7, additionalPitchShiftInSemitones = 0) {
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) { showNotification("Audio not ready for preview.", 2000); return; }

    const track = localAppServices.getTrackById(trackId);

    if (!track || track.type !== 'DrumSampler' || !track.drumPadPlayers[padIndex] || !track.drumPadPlayers[padIndex].loaded) {
        console.warn(`[Audio] Conditions not met for playing drum pad preview for track ${trackId}, pad ${padIndex}`);
        return;
    }
    const player = track.drumPadPlayers[padIndex];
    const padData = track.drumSamplerPads[padIndex];
    const actualDestination = (track.activeEffects.length > 0 && track.activeEffects[0].toneNode && !track.activeEffects[0].toneNode.disposed)
        ? track.activeEffects[0].toneNode
        : (track.gainNode && !track.gainNode.disposed ? track.gainNode : getMasterEffectsBusInputNode());


    if (player && !player.disposed && actualDestination && !actualDestination.disposed) {
        try { player.disconnect(); } catch(e) {/*ignore*/}
        player.connect(actualDestination);
    } else {
        console.warn(`[Audio] Cannot connect drum pad player for track ${trackId}, pad ${padIndex} to destination.`);
        return;
    }


    player.volume.value = Tone.dbToGain(padData.volume * velocity * 0.5);
    const totalPadPitchShift = (padData.pitchShift || 0) + additionalPitchShiftInSemitones;
    player.playbackRate = Math.pow(2, totalPadPitchShift / 12);
    player.start(Tone.now());
}

export function getMimeTypeFromFilename(filename) {
    if (!filename || typeof filename !== 'string') return "application/octet-stream";
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith(".wav")) return "audio/wav";
    if (lowerFilename.endsWith(".mp3")) return "audio/mpeg";
    if (lowerFilename.endsWith(".ogg")) return "audio/ogg";
    if (lowerFilename.endsWith(".flac")) return "audio/flac";
    if (lowerFilename.endsWith(".aac")) return "audio/aac";
    if (lowerFilename.endsWith(".m4a")) return "audio/mp4";
    return "application/octet-stream";
}

async function commonLoadSampleLogic(fileObject, sourceName, track, trackTypeHint, padIndex = null) {
    const isReconstructing = localAppServices.getIsReconstructingDAW ? localAppServices.getIsReconstructingDAW() : false;

    if (localAppServices.captureStateForUndo && !isReconstructing) {
        const targetName = trackTypeHint === 'DrumSampler' ? `Pad ${padIndex + 1} on ${track.name}` : track.name;
        localAppServices.captureStateForUndo(`Load ${sourceName} to ${targetName}`);
    }

    let objectURLForTone = null;
    let base64DataURL = null;

    try {
        objectURLForTone = URL.createObjectURL(fileObject);
        base64DataURL = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = (err) => reject(new Error("FileReader error: " + err.message));
            reader.readAsDataURL(fileObject);
        });

        const dbKeySuffix = trackTypeHint === 'DrumSampler' ? `drumPad-${padIndex}-${sourceName.replace(/[^a-zA-Z0-9-_]/g, '_')}` : `${trackTypeHint}-${sourceName.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
        const dbKey = `track-${track.id}-${dbKeySuffix}`;
        await storeAudio(dbKey, fileObject);

        const newAudioBuffer = await new Tone.Buffer().load(objectURLForTone);

        if (trackTypeHint === 'Sampler') {
            if (track.audioBuffer && !track.audioBuffer.disposed) track.audioBuffer.dispose();
            track.disposeSlicerMonoNodes();
            track.audioBuffer = newAudioBuffer;
            track.samplerAudioData = { fileName: sourceName, audioBufferDataURL: base64DataURL, dbKey: dbKey, status: 'loaded' };
            if (!track.slicerIsPolyphonic && track.audioBuffer?.loaded) track.setupSlicerMonoNodes();
            if (localAppServices.autoSliceSample) localAppServices.autoSliceSample(track.id, Constants.numSlices);
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'samplerLoaded');

        } else if (trackTypeHint === 'InstrumentSampler') {
            if (track.instrumentSamplerSettings.audioBuffer && !track.instrumentSamplerSettings.audioBuffer.disposed) track.instrumentSamplerSettings.audioBuffer.dispose();
            if (track.toneSampler && !track.toneSampler.disposed) track.toneSampler.dispose();
            track.instrumentSamplerSettings = {
                ...track.instrumentSamplerSettings,
                audioBuffer: newAudioBuffer, audioBufferDataURL: base64DataURL, originalFileName: sourceName, dbKey: dbKey, status: 'loaded',
                loopStart: 0, loopEnd: newAudioBuffer.duration
            };
            track.setupToneSampler();
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'instrumentSamplerLoaded');

        } else if (trackTypeHint === 'DrumSampler' && padIndex !== null) {
            const padData = track.drumSamplerPads[padIndex];
            if (padData.audioBuffer && !padData.audioBuffer.disposed) padData.audioBuffer.dispose();
            if (track.drumPadPlayers[padIndex] && !track.drumPadPlayers[padIndex].disposed) track.drumPadPlayers[padIndex].dispose();
            padData.audioBuffer = newAudioBuffer; padData.audioBufferDataURL = base64DataURL;
            padData.originalFileName = sourceName; padData.dbKey = dbKey; padData.status = 'loaded';
            track.drumPadPlayers[padIndex] = new Tone.Player(newAudioBuffer);
            if (track.drumPadPlayers[padIndex] && track.gainNode && !track.gainNode.disposed) {
                 track.drumPadPlayers[padIndex].connect(track.gainNode);
            }
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'drumPadLoaded', padIndex);
        }

        track.rebuildEffectChain();
        showNotification(`Sample "${sourceName}" loaded for ${track.name}${trackTypeHint === 'DrumSampler' ? ` (Pad ${padIndex+1})` : ''}.`, 2000);

    } catch (error) {
        console.error(`[Audio] Error in commonLoadSampleLogic for "${sourceName}":`, error);
        showNotification(`Error loading sample "${sourceName}": ${error.message || 'Unknown error.'}`, 4000);
        if (trackTypeHint === 'Sampler') track.samplerAudioData.status = 'error';
        else if (trackTypeHint === 'InstrumentSampler') track.instrumentSamplerSettings.status = 'error';
        else if (trackTypeHint === 'DrumSampler' && padIndex !== null) track.drumSamplerPads[padIndex].status = 'error';
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sampleLoadError', padIndex);
    } finally {
        if (objectURLForTone) URL.revokeObjectURL(objectURLForTone);
    }
}


export async function loadSampleFile(eventOrUrl, trackId, trackTypeHint, fileNameForUrl = null) {
    const track = localAppServices.getTrackById(trackId);
    if (!track) { showNotification(`Track ID ${trackId} not found.`, 3000); return; }
    if (trackTypeHint !== 'Sampler' && trackTypeHint !== 'InstrumentSampler') {
        showNotification(`Cannot load sample into ${trackTypeHint} track.`, 3000); return;
    }
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) { showNotification("Audio system not ready.", 3000); return; }

    let providedBlob, sourceName;
    const isUrlSource = typeof eventOrUrl === 'string';
    const isDirectFile = eventOrUrl instanceof File;
    const isBlobEvent = eventOrUrl instanceof Blob;

    if (isUrlSource) {
        sourceName = fileNameForUrl || eventOrUrl.split('/').pop().split('?')[0] || "loaded_sample";
        try {
            const response = await fetch(eventOrUrl);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status} for ${sourceName}`);
            providedBlob = await response.blob();
        } catch (e) {
            console.error(`[Audio] Error fetching sample from URL ${eventOrUrl}:`, e);
            showNotification(`Error fetching sample "${sourceName}": ${e.message}`, 3000); return;
        }
    } else if (eventOrUrl && eventOrUrl.target && eventOrUrl.target.files && eventOrUrl.target.files.length > 0) {
        providedBlob = eventOrUrl.target.files[0]; sourceName = providedBlob.name;
    } else if (isDirectFile) {
        providedBlob = eventOrUrl; sourceName = providedBlob.name;
    } else if (isBlobEvent) {
        providedBlob = eventOrUrl; sourceName = fileNameForUrl || "loaded_blob_sample";
    }
     else { showNotification("No file selected or invalid source.", 3000); return; }

    if (!providedBlob) { showNotification("Could not obtain file data.", 3000); return; }

    const inferredType = getMimeTypeFromFilename(sourceName);
    const explicitType = providedBlob.type || inferredType || 'application/octet-stream';
    const fileObject = new File([providedBlob], sourceName, { type: explicitType });

    if (!fileObject.type.startsWith('audio/') && fileObject.type !== "application/octet-stream") {
        showNotification(`Invalid audio file type: "${fileObject.type}". Please use WAV, MP3, etc.`, 3000); return;
    }
    if (fileObject.size === 0) { showNotification(`Audio file "${sourceName}" is empty.`, 3000); return; }

    await commonLoadSampleLogic(fileObject, sourceName, track, trackTypeHint);
}

export async function loadDrumSamplerPadFile(eventOrUrl, trackId, padIndex, fileNameForUrl = null) {
    const track = localAppServices.getTrackById(trackId);
    if (!track || track.type !== 'DrumSampler') {
        showNotification(`Track ID ${trackId} is not a Drum Sampler.`, 3000); return;
    }
    if (typeof padIndex !== 'number' || isNaN(padIndex) || padIndex < 0 || padIndex >= track.drumSamplerPads.length) {
        showNotification(`Invalid pad index ${padIndex}.`, 3000); return;
    }
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) { showNotification("Audio system not ready.", 3000); return; }

    let providedBlob, sourceName;
    const isUrlSource = typeof eventOrUrl === 'string';
    const isDirectFile = eventOrUrl instanceof File;
    const isBlobEvent = eventOrUrl instanceof Blob;

    if (isUrlSource) {
        sourceName = fileNameForUrl || "pad_sample_from_url";
        try {
            const response = await fetch(eventOrUrl); if (!response.ok) throw new Error(`Fetch failed: ${response.status} for ${sourceName}`);
            providedBlob = await response.blob();
        } catch (e) {
            console.error(`[Audio] Error fetching drum sample from URL ${eventOrUrl}:`, e);
            showNotification(`Error fetching drum sample "${sourceName}": ${e.message}`, 3000); return;
        }
    } else if (eventOrUrl && eventOrUrl.target && eventOrUrl.target.files && eventOrUrl.target.files.length > 0) {
        providedBlob = eventOrUrl.target.files[0]; sourceName = providedBlob.name;
    } else if (isDirectFile) {
        providedBlob = eventOrUrl; sourceName = providedBlob.name;
    } else if (isBlobEvent) {
        providedBlob = eventOrUrl; sourceName = fileNameForUrl || "pad_blob_sample";
    }
     else { showNotification("No file for drum pad.", 3000); return; }

    if (!providedBlob) { showNotification("Could not get drum sample data.", 3000); return; }

    const inferredType = getMimeTypeFromFilename(sourceName);
    const explicitType = providedBlob.type || inferredType || 'application/octet-stream';
    const fileObject = new File([providedBlob], sourceName, { type: explicitType });

    if (!fileObject.type.startsWith('audio/') && fileObject.type !== "application/octet-stream") {
        showNotification(`Invalid audio file type for drum pad: "${fileObject.type}".`, 3000); return;
    }
    if (fileObject.size === 0) { showNotification(`Drum sample "${sourceName}" is empty.`, 3000); return; }

    await commonLoadSampleLogic(fileObject, sourceName, track, 'DrumSampler', padIndex);
}


export async function loadSoundFromBrowserToTarget(soundData, targetTrackId, targetTrackTypeIgnored, targetPadOrSliceIndex = null) {
    const track = localAppServices.getTrackById(parseInt(targetTrackId));
    if (!track) { showNotification("Target track not found.", 3000); return; }

    const { fullPath, libraryName, fileName } = soundData;
    const isTargetSamplerType = ['Sampler', 'InstrumentSampler', 'DrumSampler'].includes(track.type);
    if (!isTargetSamplerType) { showNotification(`Cannot load to ${track.type} track.`, 3000); return; }

    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) { showNotification("Audio system not ready.", 3000); return; }

    showNotification(`Loading "${fileName}" to ${track.name}...`, 2000);
    try {
        const loadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
        if (!loadedZips[libraryName] || loadedZips[libraryName] === "loading") {
            throw new Error(`Library "${libraryName}" not loaded or still loading.`);
        }
        const zipEntry = loadedZips[libraryName].file(fullPath);
        if (!zipEntry) throw new Error(`File "${fullPath}" not found in library "${libraryName}".`);

        const fileBlobFromZip = await zipEntry.async("blob");
        const inferredMimeType = getMimeTypeFromFilename(fileName);
        const finalMimeType = fileBlobFromZip.type || inferredMimeType || 'application/octet-stream';
        const blobToLoad = new File([fileBlobFromZip], fileName, {type: finalMimeType});

        if (track.type === 'DrumSampler') {
            let actualPadIndex = targetPadOrSliceIndex;
            if (typeof actualPadIndex !== 'number' || isNaN(actualPadIndex) || actualPadIndex < 0 || actualPadIndex >= Constants.numDrumSamplerPads) {
                actualPadIndex = track.drumSamplerPads.findIndex(p => !p.audioBufferDataURL && !p.dbKey);
                if (actualPadIndex === -1) actualPadIndex = track.selectedDrumPadForEdit;
                if (actualPadIndex === -1 || typeof actualPadIndex !== 'number') actualPadIndex = 0;
            }
            await commonLoadSampleLogic(blobToLoad, fileName, track, 'DrumSampler', actualPadIndex);
        } else {
            await commonLoadSampleLogic(blobToLoad, fileName, track, track.type);
        }
    } catch (error) {
        console.error(`[Audio] Error loading sound from browser:`, error);
        showNotification(`Error loading "${fileName}": ${error.message}`, 4000);
         if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sampleLoadError', targetPadOrSliceIndex);
    }
}

export async function fetchSoundLibrary(libraryName, zipUrl, isAutofetch = false) {
    const loadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
    const soundTrees = localAppServices.getSoundLibraryFileTrees ? localAppServices.getSoundLibraryFileTrees() : {};

    if (loadedZips[libraryName] && loadedZips[libraryName] !== "loading") {
        if (!isAutofetch && localAppServices.updateSoundBrowserDisplayForLibrary) {
            localAppServices.updateSoundBrowserDisplayForLibrary(libraryName);
        }
        return;
    }
    if (loadedZips[libraryName] === "loading") return;

    if (!isAutofetch && localAppServices.updateSoundBrowserDisplayForLibrary) {
        localAppServices.updateSoundBrowserDisplayForLibrary(libraryName, true);
    }

    try {
        loadedZips[libraryName] = "loading";
        if (localAppServices.setLoadedZipFiles) localAppServices.setLoadedZipFiles({...loadedZips});

        const response = await fetch(zipUrl);
        if (!response.ok) throw new Error(`HTTP error ${response.status} fetching ${zipUrl}`);
        const zipData = await response.arrayBuffer();

        if (typeof JSZip === 'undefined') throw new Error("JSZip library not found.");

        const jszip = new JSZip();
        const loadedZip = await jszip.loadAsync(zipData);
        loadedZips[libraryName] = loadedZip;
        if (localAppServices.setLoadedZipFiles) localAppServices.setLoadedZipFiles({...loadedZips});


        const fileTree = {};
        loadedZip.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return;
            const pathParts = relativePath.split('/').filter(p => p && p !== '__MACOSX' && !p.startsWith('.'));
            if (pathParts.length === 0) return;

            let currentLevel = fileTree;
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                if (i === pathParts.length - 1) {
                    if (part.match(/\.(wav|mp3|ogg|flac|aac|m4a)$/i)) {
                        currentLevel[part] = { type: 'file', entry: zipEntry, fullPath: relativePath };
                    }
                } else {
                    if (!currentLevel[part] || currentLevel[part].type !== 'folder') {
                        currentLevel[part] = { type: 'folder', children: {} };
                    }
                    currentLevel = currentLevel[part].children;
                }
            }
        });
        soundTrees[libraryName] = fileTree;
        if (localAppServices.setSoundLibraryFileTrees) localAppServices.setSoundLibraryFileTrees({...soundTrees});


        if (localAppServices.updateSoundBrowserDisplayForLibrary) {
            localAppServices.updateSoundBrowserDisplayForLibrary(libraryName);
        }
    } catch (error) {
        console.error(`[Audio] Error fetching/processing ${libraryName} from ${zipUrl}:`, error);
        delete loadedZips[libraryName];
        if (localAppServices.setLoadedZipFiles) localAppServices.setLoadedZipFiles({...loadedZips});
        delete soundTrees[libraryName];
        if (localAppServices.setSoundLibraryFileTrees) localAppServices.setSoundLibraryFileTrees({...soundTrees});

        if (!isAutofetch) showNotification(`Error loading library ${libraryName}: ${error.message}`, 4000);
        if (localAppServices.updateSoundBrowserDisplayForLibrary) {
             localAppServices.updateSoundBrowserDisplayForLibrary(libraryName, false, true);
        }
    }
}

export function autoSliceSample(trackId, numSlicesToCreate = Constants.numSlices) {
    const track = localAppServices.getTrackById(trackId);
    if (!track || track.type !== 'Sampler' || !track.audioBuffer || !track.audioBuffer.loaded) {
        showNotification("Cannot auto-slice: Load sample first or ensure sample is valid.", 3000);
        return;
    }
    const duration = track.audioBuffer.duration;
    if (duration <=0) {
        showNotification("Cannot auto-slice: Sample has no duration.", 3000);
        return;
    }

    track.slices = [];
    const sliceDuration = duration / numSlicesToCreate;
    for (let i = 0; i < numSlicesToCreate; i++) {
        track.slices.push({
            offset: i * sliceDuration, duration: sliceDuration, userDefined: false,
            volume: 1.0, pitchShift: 0, loop: false, reverse: false,
            envelope: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.1 }
        });
    }
    track.selectedSliceForEdit = 0;
    track.setSequenceLength(track.sequenceLength, true);

    if (localAppServices.updateTrackUI) {
        localAppServices.updateTrackUI(track.id, 'sampleSliced');
    }
    showNotification(`Sample auto-sliced into ${numSlicesToCreate} parts.`, 2000);
}

// Function to clear all master effect Tone.js nodes (used during project reconstruction)
export function clearAllMasterEffectNodes() {
    activeMasterEffectNodes.forEach(node => {
        if (node && !node.disposed) {
            try {
                node.dispose();
            } catch (e) {
                console.warn("[Audio] Error disposing a master effect node during clearAll:", e);
            }
        }
    });
    activeMasterEffectNodes.clear();
    // After clearing, the chain needs to be rebuilt to connect bus input to master gain directly
    rebuildMasterEffectChain();
}

// --- Audio Recording Functions ---
export async function startAudioRecording() {
    if (!mic) {
        mic = new Tone.UserMedia();
    }
    if (!recorder) {
        recorder = new Tone.Recorder();
    }

    const trackId = getRecordingTrackIdState(); // From state.js via import
    const track = localAppServices.getTrackById(trackId); // From appServices (main.js)

    if (!track || track.type !== 'Audio' || !track.inputChannel || track.inputChannel.disposed) {
        showNotification("Recording failed: Armed track is not a valid audio track or input channel is missing.", 3000);
        if(localAppServices.setIsRecording) localAppServices.setIsRecording(false);
        if(localAppServices.setRecordingTrackId) localAppServices.setRecordingTrackId(null);
        if(localAppServices.updateRecordButtonUI) localAppServices.updateRecordButtonUI(false);
        return;
    }

    try {
        await mic.open();
        mic.connect(track.inputChannel); // For monitoring (goes through track's effects and gain)
        mic.connect(recorder); // Also send raw mic input to recorder
        await recorder.start();
    } catch (error) {
        console.error("Error starting microphone/recorder:", error);
        showNotification("Could not start recording. Microphone access denied or other error.", 4000);
        if(localAppServices.setIsRecording) localAppServices.setIsRecording(false);
        if(localAppServices.setRecordingTrackId) localAppServices.setRecordingTrackId(null);
        if(localAppServices.updateRecordButtonUI) localAppServices.updateRecordButtonUI(false);
    }
}

export async function stopAudioRecording() {
    if (!recorder || !mic || recorder.state !== "started") {
        if (mic && mic.state === "started") mic.close(); // Close mic if it was opened but recorder didn't start
        return;
    }

    try {
        const blob = await recorder.stop();
        mic.close();

        const trackId = getRecordingTrackIdState(); // From state.js via import
        const startTime = getRecordingStartTimeState(); // From state.js via import
        const track = localAppServices.getTrackById(trackId); // From appServices (main.js)

        if (track && blob.size > 0) {
            if (typeof track.addAudioClip === 'function') {
                await track.addAudioClip(blob, startTime);
            } else {
                console.error("Track object does not have addAudioClip method.");
                 showNotification("Error: Could not process recorded audio.", 3000);
            }
        } else if (blob.size === 0) {
            showNotification("Recording was empty.", 2000);
        }
    } catch (error) {
        console.error("Error stopping recording or processing audio:", error);
        showNotification("Error finalizing recording.", 3000);
    }
}
