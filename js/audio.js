// js/audio.js - Audio Engine, Tone.js interactions, Sample Loading
import * as Constants from './constants.js';
// showNotification will be accessed via localAppServices
// import { showNotification } from './utils.js'; // Not directly imported, accessed via appServices
import { createEffectInstance } from './effectsRegistry.js';
import { storeAudio, getAudio } from './db.js';
import { getRecordingStartTimeState, getLoadedZipFilesState, getTracksState, getPlaybackModeState } from './state.js';


let masterEffectsBusInputNode = null;
let masterGainNodeActual = null; // The actual Tone.Gain node for master volume
let masterMeterNode = null;
let activeMasterEffectNodes = new Map();

let audioContextInitialized = false;
let contextSuspendedCount = 0; // Track suspension events for monitoring/recovery
let resumeAttemptScheduled = false;

let localAppServices = {};

// Variables for audio recording
let mic = null;
let recorder = null;
let recordingScheduledId = null; // For punch-in/out enforcement callback
let recordingScheduledTrackId = null; // Track ID for the scheduled recording callback


export function initializeAudioModule(appServicesFromMain) {
    localAppServices = appServicesFromMain;
    // MODIFICATION START: Debug to confirm function reference
    if (typeof getLoadedZipFilesState !== 'undefined') { // Need to import it for this check to be valid
        console.log('[Audio Init DEBUG] localAppServices.getLoadedZipFiles === getLoadedZipFilesState (from state.js import)?', localAppServices.getLoadedZipFiles === getLoadedZipFilesState);
    } else {
        // console.log('[Audio Init DEBUG] getLoadedZipFilesState not imported, cannot compare reference directly here.');
    }
    // MODIFICATION END
}

export function getMasterEffectsBusInputNode() {
    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed) {
        console.log("[Audio getMasterEffectsBusInputNode] Master bus input node not ready or disposed, attempting setup.");
        setupMasterBus();
    }
    return masterEffectsBusInputNode;
}

export function getActualMasterGainNode() {
    if (!masterGainNodeActual || masterGainNodeActual.disposed) {
        console.log("[Audio getActualMasterGainNode] Actual master gain node not ready or disposed, attempting setup.");
        setupMasterBus();
    }
    return masterGainNodeActual;
}


export async function initAudioContextAndMasterMeter(isUserInitiated = false) {
    if (audioContextInitialized && Tone.context && Tone.context.state === 'running') {
        if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed ||
            !masterGainNodeActual || masterGainNodeActual.disposed ||
            !masterMeterNode || masterMeterNode.disposed) {
            console.warn("[Audio initAudioContextAndMasterMeter] Context was running, but master bus components are not fully initialized. Re-setting up.");
            setupMasterBus();
        }
        return true;
    }

    console.log('[Audio initAudioContextAndMasterMeter] Attempting Tone.start(). Current context state:', ((Tone.context) && (Tone.context).state));
    try {
        await Tone.start();
        console.log('[Audio initAudioContextAndMasterMeter] Tone.start() completed. Context state:', ((Tone.context) && (Tone.context).state));

        if (Tone.context && Tone.context.state === 'running') {
            if (!audioContextInitialized) {
                console.log('[Audio initAudioContextAndMasterMeter] First time setup for master bus after context became running.');
                setupMasterBus();
            } else if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed ||
                       !masterGainNodeActual || masterGainNodeActual.disposed ||
                       !masterMeterNode || masterMeterNode.disposed) {
                console.warn('[Audio initAudioContextAndMasterMeter] Audio context is running, but master bus components seem to be missing or disposed. Re-initializing master bus.');
                setupMasterBus();
            }
            audioContextInitialized = true;
            console.log('[Audio initAudioContextAndMasterMeter] Audio context initialized and running.');
            return true;
        } else {
            console.warn('[Audio initAudioContextAndMasterMeter] Audio context NOT running after Tone.start(). State:', ((Tone.context) && (Tone.context).state));
            const message = "AudioContext could not be started. Please click again or refresh the page.";
            if (localAppServices.showNotification) {
                localAppServices.showNotification(message, 5000);
            } else {
                alert(message); // Fallback if showNotification is not available
            }
            audioContextInitialized = false;
            return false;
        }
    } catch (error) {
        console.error("[Audio initAudioContextAndMasterMeter] Error during Tone.start() or master bus setup:", error);
        const message = `Error initializing audio: ${error.message || 'Please check console.'}. Try interacting with the page or refreshing.`;
        if (localAppServices.showNotification) {
            localAppServices.showNotification(message, 5000);
        } else {
            alert(message);
        }
        audioContextInitialized = false;
        return false;
    }
}

function setupMasterBus() {
    console.log('[Audio setupMasterBus] Setting up master bus...');
    if (!Tone.context || Tone.context.state !== 'running') {
        console.warn('[Audio setupMasterBus] Audio context not running. Aborting master bus setup.');
        return;
    }

    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed) {
        if (masterEffectsBusInputNode && !masterEffectsBusInputNode.disposed) {
             try { masterEffectsBusInputNode.dispose(); } catch(e){ console.warn("[Audio setupMasterBus] Error disposing old master bus input:", e.message); }
        }
        masterEffectsBusInputNode = new Tone.Gain(); // Destination will be set by rebuildMasterEffectChain
        console.log('[Audio setupMasterBus] Master effects bus input node created.');
    }

    if (!masterGainNodeActual || masterGainNodeActual.disposed) {
        if (masterGainNodeActual && !masterGainNodeActual.disposed) {
            try { masterGainNodeActual.dispose(); } catch(e){ console.warn("[Audio setupMasterBus] Error disposing old master gain node actual:", e.message); }
        }
        const initialMasterVolumeValue = localAppServices.getMasterGainValue ? localAppServices.getMasterGainValue() : Tone.dbToGain(0);
        masterGainNodeActual = new Tone.Gain(initialMasterVolumeValue);
        if (localAppServices.setMasterGainValueState) localAppServices.setMasterGainValueState(masterGainNodeActual.gain.value); // Update state module
        console.log('[Audio setupMasterBus] Master gain node actual created with gain:', masterGainNodeActual.gain.value);
    }

    if (!masterMeterNode || masterMeterNode.disposed) {
        if (masterMeterNode && !masterMeterNode.disposed) {
            try { masterMeterNode.dispose(); } catch(e) { console.warn("[Audio setupMasterBus] Error disposing old master meter:", e.message); }
        }
        masterMeterNode = new Tone.Meter({ smoothing: 0.8 });
        console.log('[Audio setupMasterBus] Master meter node created.');
    }
    rebuildMasterEffectChain(); // This will handle connections
    console.log('[Audio setupMasterBus] Master bus setup process complete.');
}

export function rebuildMasterEffectChain() {
    console.log('[Audio rebuildMasterEffectChain] Rebuilding master effect chain...');
    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed ||
        !masterGainNodeActual || masterGainNodeActual.disposed ||
        !masterMeterNode || masterMeterNode.disposed) {
        console.warn('[Audio rebuildMasterEffectChain] Master bus components not fully ready, attempting setup...');
        setupMasterBus(); // Try to set them up again
        // Re-check after setup attempt
        if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed ||
            !masterGainNodeActual || masterGainNodeActual.disposed ||
            !masterMeterNode || masterMeterNode.disposed) {
            console.error('[Audio rebuildMasterEffectChain] Master bus components still not ready after setup attempt. Aborting chain rebuild.');
            return;
        }
    }

    try { masterEffectsBusInputNode.disconnect(); } catch(e) { console.warn("[Audio rebuildMasterEffectChain] Error disconnecting masterEffectsBusInputNode:", e.message); }
    activeMasterEffectNodes.forEach((node, id) => {
        if (node && !node.disposed) {
            try { node.disconnect(); } catch(e) { console.warn(`[Audio rebuildMasterEffectChain] Error disconnecting active master effect node ${id}:`, e.message); }
        }
    });
    try { masterGainNodeActual.disconnect(); } catch(e) { console.warn("[Audio rebuildMasterEffectChain] Error disconnecting masterGainNodeActual:", e.message); }
    // masterMeterNode is connected in parallel, so usually disconnect from source (masterGainNodeActual)

    let currentAudioPathEnd = masterEffectsBusInputNode;
    const masterEffectsState = localAppServices.getMasterEffects ? localAppServices.getMasterEffects() : [];
    console.log(`[Audio rebuildMasterEffectChain] Master effects in state: ${masterEffectsState.length}`);

    masterEffectsState.forEach(effectState => {
        let effectNode = activeMasterEffectNodes.get(effectState.id);
        if (!effectNode || effectNode.disposed) {
            console.warn(`[Audio rebuildMasterEffectChain] Master effect node for ${effectState.type} (ID: ${effectState.id}) not found or disposed. Attempting recreation.`);
            effectNode = createEffectInstance(effectState.type, effectState.params);
            if (effectNode) {
                activeMasterEffectNodes.set(effectState.id, effectNode);
                console.log(`[Audio rebuildMasterEffectChain] Recreated master effect node for ${effectState.type} (ID: ${effectState.id}).`);
            } else {
                console.error(`[Audio rebuildMasterEffectChain] CRITICAL: Failed to recreate master effect node for ${effectState.type} (ID: ${effectState.id}). Chain will be broken here.`);
                return; // Skip connecting this effect if it failed to create
            }
        }

        if (currentAudioPathEnd && !currentAudioPathEnd.disposed) {
            try {
                console.log(`[Audio rebuildMasterEffectChain] Connecting ${currentAudioPathEnd.toString()} to ${effectNode.toString()} (${effectState.type})`);
                currentAudioPathEnd.connect(effectNode);
                currentAudioPathEnd = effectNode;
            } catch (e) {
                console.error(`[Audio rebuildMasterEffectChain] Error connecting master effect ${effectState.type}:`, e);
            }
        } else {
            // This case means the chain started with this effect or a previous connection failed
            currentAudioPathEnd = effectNode;
             console.warn(`[Audio rebuildMasterEffectChain] currentAudioPathEnd was null or disposed before connecting ${effectState.type}. Starting new chain segment.`);
        }
    });

    // Connect the end of the effect chain to masterGainNodeActual
    if (currentAudioPathEnd && !currentAudioPathEnd.disposed && masterGainNodeActual && !masterGainNodeActual.disposed) {
        try {
            console.log(`[Audio rebuildMasterEffectChain] Connecting end of master effect chain (${currentAudioPathEnd.toString()}) to masterGainNodeActual.`);
            currentAudioPathEnd.connect(masterGainNodeActual);
        } catch (e) {
            console.error(`[Audio rebuildMasterEffectChain] Error connecting master chain output to masterGainNodeActual:`, e);
        }
    } else {
        console.warn('[Audio rebuildMasterEffectChain] Could not connect master chain output to masterGainNodeActual. Current end:', ((currentAudioPathEnd) && (currentAudioPathEnd).toString)(), 'Master Gain:', ((masterGainNodeActual) && (masterGainNodeActual).toString)());
         if (!masterEffectsBusInputNode.numberOfOutputs && masterGainNodeActual && !masterGainNodeActual.disposed) { // If no effects, connect input directly
            try {
                masterEffectsBusInputNode.connect(masterGainNodeActual);
                console.log("[Audio rebuildMasterEffectChain] Connected masterEffectsBusInputNode directly to masterGainNodeActual (no effects).");
            } catch (e) {
                console.error("[Audio rebuildMasterEffectChain] Error directly connecting masterEffectsBusInputNode to masterGainNodeActual:", e.message);
            }
        }
    }

    // Connect masterGainNodeActual to destination and meter
    if (masterGainNodeActual && !masterGainNodeActual.disposed) {
        try {
            console.log('[Audio rebuildMasterEffectChain] Connecting masterGainNodeActual to destination and meter.');
            masterGainNodeActual.toDestination(); // Connects to Tone.Destination (context.destination)
            if (masterMeterNode && !masterMeterNode.disposed) {
                masterGainNodeActual.connect(masterMeterNode);
            } else {
                 console.warn("[Audio rebuildMasterEffectChain] Master meter node not available for connection during rebuild. Should have been re-created by setupMasterBus.");
            }
        } catch (e) { console.error("[Audio rebuildMasterEffectChain] Error connecting masterGainNodeActual to destination/meter:", e); }
    } else {
         console.warn('[Audio rebuildMasterEffectChain] masterGainNodeActual not available for final connection.');
    }
    console.log('[Audio rebuildMasterEffectChain] Master effect chain rebuild complete.');
}


export async function addMasterEffectToAudio(effectIdInState, effectType, initialParams) {
    const toneNode = createEffectInstance(effectType, initialParams);
    if (toneNode) {
        activeMasterEffectNodes.set(effectIdInState, toneNode);
        rebuildMasterEffectChain();
    } else {
        if (localAppServices.showNotification) localAppServices.showNotification(`Failed to create master effect: ${effectType}`, 3000);
        console.error(`[Audio addMasterEffectToAudio] Failed to create Tone.js instance for master effect: ${effectType}`);
    }
}

export async function removeMasterEffectFromAudio(effectId) {
    const nodeToRemove = activeMasterEffectNodes.get(effectId);
    if (nodeToRemove) {
        if (!nodeToRemove.disposed) {
            try {
                nodeToRemove.dispose();
            } catch (e) {
                console.warn(`[Audio removeMasterEffectFromAudio] Error disposing master effect node for ID ${effectId}:`, e.message);
            }
        }
        activeMasterEffectNodes.delete(effectId);
        rebuildMasterEffectChain();
    } else {
        console.warn(`[Audio removeMasterEffectFromAudio] Node to remove with ID ${effectId} not found in activeMasterEffectNodes.`);
    }
}

export function updateMasterEffectParamInAudio(effectId, paramPath, value) {
    const effectNode = activeMasterEffectNodes.get(effectId);
    if (!effectNode || effectNode.disposed) {
        console.warn(`[Audio updateMasterEffectParamInAudio] Master effect node for ID ${effectId} not found or disposed for param update.`);
        return;
    }
    try {
        const keys = paramPath.split('.');
        let targetObject = effectNode;
        for (let i = 0; i < keys.length - 1; i++) {
            if (targetObject && typeof targetObject[keys[i]] !== 'undefined') {
                targetObject = targetObject[keys[i]];
            } else {
                throw new Error(`Path ${keys.slice(0,i+1).join('.')} not found on Tone node.`);
            }
        }
        const finalParamKey = keys[keys.length - 1];
        const paramInstance = targetObject[finalParamKey];

        if (paramInstance && typeof paramInstance.value !== 'undefined') { // It's a Tone.Param or Signal
            if (typeof paramInstance.rampTo === 'function') {
                paramInstance.rampTo(value, 0.02); // Smooth ramp
            } else {
                paramInstance.value = value; // Direct value assignment
            }
        } else if (typeof targetObject[finalParamKey] !== 'undefined') { // Direct property like 'type' or 'oversample'
            targetObject[finalParamKey] = value;
        } else {
            console.warn(`[Audio updateMasterEffectParamInAudio] Parameter ${finalParamKey} not found on target object for effect ID ${effectId}. Target:`, targetObject);
        }
    } catch (err) {
        console.error(`[Audio updateMasterEffectParamInAudio] Error updating param "${paramPath}" for master effect ID ${effectId}:`, err);
    }
}

export function reorderMasterEffectInAudio(effectIdIgnored, newIndexIgnored) {
    // The actual reordering happens in state; this just rebuilds the audio chain
    rebuildMasterEffectChain();
}


export function updateMeters(globalMasterMeterBar, mixerMasterMeterBar, tracks) {
    if (!Tone.context || Tone.context.state !== 'running' || !audioContextInitialized) return;

    if (masterMeterNode && typeof masterMeterNode.getValue === 'function' && !masterMeterNode.disposed) {
        const masterLevelValue = masterMeterNode.getValue();
        // Ensure masterLevelValue is a number, taking the first channel if it's an array (stereo)
        const numericMasterLevel = Array.isArray(masterLevelValue) ? masterLevelValue[0] : masterLevelValue;
        if (typeof numericMasterLevel === 'number' && isFinite(numericMasterLevel)) {
            const level = Tone.dbToGain(numericMasterLevel);
            const isClipping = numericMasterLevel > -0.1;

            if (globalMasterMeterBar) {
                globalMasterMeterBar.style.width = `${Math.min(100, Math.max(0, level * 100))}%`;
                globalMasterMeterBar.classList.toggle('clipping', isClipping);
            }
            if (mixerMasterMeterBar) {
                mixerMasterMeterBar.style.width = `${Math.min(100, Math.max(0, level * 100))}%`;
                mixerMasterMeterBar.classList.toggle('clipping', isClipping);
            }
        } else {
            // console.warn("[Audio updateMeters] Master meter returned invalid value:", masterLevelValue);
        }
    } else if (masterMeterNode && masterMeterNode.disposed) {
        console.warn("[Audio updateMeters] Master meter node is disposed. Attempting to re-initialize master bus.");
        setupMasterBus(); // Attempt to re-initialize if disposed
    }


    (tracks || []).forEach(track => {
        if (track && track.trackMeter && typeof track.trackMeter.getValue === 'function' && !track.trackMeter.disposed) {
            const meterValue = track.trackMeter.getValue();
            const numericMeterValue = Array.isArray(meterValue) ? meterValue[0] : meterValue;

            if (typeof numericMeterValue === 'number' && isFinite(numericMeterValue)) {
                const level = Tone.dbToGain(numericMeterValue);
                const isClipping = numericMeterValue > -0.1;

                if (localAppServices.updateTrackMeterUI) {
                    localAppServices.updateTrackMeterUI(track.id, level, isClipping);
                }
            } else {
                // console.warn(`[Audio updateMeters] Track ${track.id} meter returned invalid value:`, meterValue);
            }
        }
    });
}

export async function playSlicePreview(trackId, sliceIndex, velocity = 0.7, additionalPitchShiftInSemitones = 0) {
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio not ready for preview.", 2000);
        return;
    }

    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;

    if (!track || track.type !== 'Sampler' || !track.audioBuffer || !track.audioBuffer.loaded || !track.slices[sliceIndex]) {
        console.warn(`[Audio playSlicePreview] Conditions not met for playing slice preview for track ${trackId}, slice ${sliceIndex}`);
        return;
    }
    const sliceData = track.slices[sliceIndex];
    if (!sliceData || sliceData.duration <= 0) {
        console.warn(`[Audio playSlicePreview] Invalid slice data or zero duration for track ${trackId}, slice ${sliceIndex}.`);
        return;
    }

    const time = Tone.now();
    const totalPitchShift = (sliceData.pitchShift || 0) + additionalPitchShiftInSemitones;
    const playbackRate = Math.pow(2, totalPitchShift / 12);
    let playDuration = sliceData.duration / playbackRate;
    if (sliceData.loop) playDuration = Math.min(playDuration, 2); // Limit looped preview duration

    // Determine the correct destination node
    const actualDestination = (track.activeEffects.length > 0 && track.activeEffects[0].toneNode && !track.activeEffects[0].toneNode.disposed)
        ? track.activeEffects[0].toneNode
        : (track.gainNode && !track.gainNode.disposed ? track.gainNode : getMasterEffectsBusInputNode());

    if (!actualDestination || actualDestination.disposed) {
        console.error(`[Audio playSlicePreview] No valid destination node for track ${trackId}.`);
        return;
    }

    if (!track.slicerIsPolyphonic) {
        if (!track.slicerMonoPlayer || track.slicerMonoPlayer.disposed) {
            track.setupSlicerMonoNodes(); // This also assigns track.audioBuffer to player
            if (!track.slicerMonoPlayer) { // Check again after setup
                console.error(`[Audio playSlicePreview] Mono slicer player still not set up for track ${trackId} after attempt.`);
                return;
            }
        }
        const player = track.slicerMonoPlayer;
        const env = track.slicerMonoEnvelope;
        const gain = track.slicerMonoGain;

        // Ensure correct connection
        if (gain && !gain.disposed && actualDestination && !actualDestination.disposed) {
            try { gain.disconnect(); } catch(e) { /* ignore if not connected */ }
            gain.connect(actualDestination);
        }

        if (player.state === 'started') player.stop(time);
        if (env && env.getValueAtTime(time) > 0.001) env.triggerRelease(time);

        if (track.audioBuffer && track.audioBuffer.loaded) player.buffer = track.audioBuffer; else return; // No buffer
        if (env) env.set(sliceData.envelope);
        if (gain) gain.gain.value = Tone.dbToGain(-6) * sliceData.volume * velocity; // Apply slight attenuation for previews
        player.playbackRate = playbackRate;
        player.reverse = sliceData.reverse || false;
        player.loop = sliceData.loop || false;
        player.loopStart = sliceData.offset;
        player.loopEnd = sliceData.offset + sliceData.duration;

        player.start(time, sliceData.offset, sliceData.loop ? undefined : playDuration);
        if (env) env.triggerAttack(time);
        if (!sliceData.loop && env) {
            const releaseTime = time + playDuration - (sliceData.envelope.release || 0.1);
            env.triggerRelease(Math.max(time, releaseTime));
        }
    } else { // Polyphonic
        const tempPlayer = new Tone.Player(track.audioBuffer);
        const tempEnv = new Tone.AmplitudeEnvelope(sliceData.envelope);
        const tempGain = new Tone.Gain(Tone.dbToGain(-6) * sliceData.volume * velocity);

        try {
            tempPlayer.chain(tempEnv, tempGain, actualDestination);
            tempPlayer.playbackRate = playbackRate;
            tempPlayer.reverse = sliceData.reverse || false;
            tempPlayer.loop = sliceData.loop || false;
            tempPlayer.loopStart = sliceData.offset;
            tempPlayer.loopEnd = sliceData.offset + sliceData.duration;

            tempPlayer.start(time, sliceData.offset, sliceData.loop ? undefined : playDuration);
            tempEnv.triggerAttack(time);
            if (!sliceData.loop) tempEnv.triggerRelease(time + playDuration * 0.95);

            // Schedule disposal
            const disposeTime = time + playDuration + (sliceData.envelope.release || 0.1) + 0.5; // Generous buffer
            Tone.Transport.scheduleOnce(() => {
                if (tempPlayer && !tempPlayer.disposed) tempPlayer.dispose();
                if (tempEnv && !tempEnv.disposed) tempEnv.dispose();
                if (tempGain && !tempGain.disposed) tempGain.dispose();
            }, disposeTime);
        } catch (error) {
            console.error(`[Audio playSlicePreview] Error setting up polyphonic preview player for track ${trackId}:`, error);
            // Dispose if partially created
            if (tempPlayer && !tempPlayer.disposed) tempPlayer.dispose();
            if (tempEnv && !tempEnv.disposed) tempEnv.dispose();
            if (tempGain && !tempGain.disposed) tempGain.dispose();
        }
    }
}

export async function playDrumSamplerPadPreview(trackId, padIndex, velocity = 0.7, additionalPitchShiftInSemitones = 0) {
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio not ready for preview.", 2000);
        return;
    }

    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;

    if (!track || track.type !== 'DrumSampler' || !track.drumPadPlayers[padIndex] || track.drumPadPlayers[padIndex].disposed || !track.drumPadPlayers[padIndex].loaded) {
        console.warn(`[Audio playDrumSamplerPadPreview] Conditions not met for playing drum pad preview for track ${trackId}, pad ${padIndex}. Player loaded: ${((track) && (track).drumPadPlayers)[padIndex]?.loaded}`);
        if (localAppServices.showNotification && track && track.type === 'DrumSampler' && (!track.drumPadPlayers[padIndex] || !track.drumPadPlayers[padIndex].loaded) ) {
            localAppServices.showNotification(`Sample for Pad ${padIndex + 1} not loaded or player error.`, 2000);
        }
        return;
    }
    const player = track.drumPadPlayers[padIndex];
    const padData = track.drumSamplerPads[padIndex];

    if (!padData) {
        console.error(`[Audio playDrumSamplerPadPreview] No padData for track ${trackId}, pad ${padIndex}.`);
        return;
    }

    const actualDestination = (track.activeEffects.length > 0 && track.activeEffects[0].toneNode && !track.activeEffects[0].toneNode.disposed)
        ? track.activeEffects[0].toneNode
        : (track.gainNode && !track.gainNode.disposed ? track.gainNode : getMasterEffectsBusInputNode());

    if (!actualDestination || actualDestination.disposed) {
        console.error(`[Audio playDrumSamplerPadPreview] No valid destination node for track ${trackId}, pad ${padIndex}.`);
        return;
    }

    try {
        player.disconnect(); // Disconnect from any previous connections
        player.connect(actualDestination);
    } catch (e) {
        console.warn(`[Audio playDrumSamplerPadPreview] Error reconnecting drum pad player for track ${trackId}, pad ${padIndex}:`, e.message);
        return; // Don't proceed if connection fails
    }

    player.volume.value = Tone.gainToDb(padData.volume * velocity * 0.7); // Apply some headroom
    const totalPadPitchShift = (padData.pitchShift || 0) + additionalPitchShiftInSemitones;
    player.playbackRate = Math.pow(2, totalPadPitchShift / 12);
    player.start(Tone.now());
}

export function getMimeTypeFromFilename(filename) {
    if (!filename || typeof filename !== 'string') return "application/octet-stream"; // Default MIME type
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith(".wav")) return "audio/wav";
    if (lowerFilename.endsWith(".mp3")) return "audio/mpeg";
    if (lowerFilename.endsWith(".ogg")) return "audio/ogg";
    if (lowerFilename.endsWith(".flac")) return "audio/flac";
    if (lowerFilename.endsWith(".aac")) return "audio/aac";
    if (lowerFilename.endsWith(".m4a")) return "audio/mp4"; // Often audio/mp4 or audio/x-m4a
    // Add more types if needed
    return "application/octet-stream"; // Fallback
}

async function commonLoadSampleLogic(fileObject, sourceName, track, trackTypeHint, padIndex = null) {
    const isReconstructing = localAppServices.getIsReconstructingDAW ? localAppServices.getIsReconstructingDAW() : false;

    if (localAppServices.captureStateForUndo && !isReconstructinging) {
        const targetName = trackTypeHint === 'DrumSampler' && padIndex !== null ?
            `Pad ${padIndex + 1} on ${track.name}` :
            track.name;
        localAppServices.captureStateForUndo(`Load ${sourceName} to ${targetName}`);
    }

    let objectURLForTone = null;
    let base64DataURL = null; // Kept for potential future use, but direct blob->IndexedDB is better

    try {
        objectURLForTone = URL.createObjectURL(fileObject);
        // base64DataURL might not be strictly necessary if storing blob directly in IDB and loading Tone.Buffer from ObjectURL/Blob
        // However, it was in the original logic, so keeping it for now unless it proves problematic.
        // For large files, converting to base64 is memory intensive.
        // Consider removing if `samplerAudioData.audioBufferDataURL` is not critically used elsewhere for reconstruction.

        const dbKeySuffix = trackTypeHint === 'DrumSampler' && padIndex !== null ?
            `drumPad-${padIndex}-${sourceName.replace(/[^a-zA-Z0-9-_.]/g, '_')}` : // Allow dots in filenames
            `${trackTypeHint}-${sourceName.replace(/[^a-zA-Z0-9-_.]/g, '_')}`;
        const dbKey = `track-${track.id}-${dbKeySuffix}-${fileObject.size}-${fileObject.lastModified}`; // More unique key
        await storeAudio(dbKey, fileObject);
        console.log(`[Audio commonLoadSampleLogic] Stored in DB with key: ${dbKey}`);

        const newAudioBuffer = await new Tone.Buffer().load(objectURLForTone);

        if (trackTypeHint === 'Sampler') {
            if (track.audioBuffer && !track.audioBuffer.disposed) track.audioBuffer.dispose();
            track.disposeSlicerMonoNodes(); // Important to call before setting new buffer related properties
            track.audioBuffer = newAudioBuffer;
            track.samplerAudioData = { fileName: sourceName, /* audioBufferDataURL: base64DataURL, */ dbKey: dbKey, status: 'loaded' };
            if (!track.slicerIsPolyphonic && ((track.audioBuffer) && (track.audioBuffer).loaded)) track.setupSlicerMonoNodes();
            if (localAppServices.autoSliceSample && track.audioBuffer.loaded && (!track.slices || track.slices.every(s => s.duration === 0))) {
                localAppServices.autoSliceSample(track.id, Constants.numSlices);
            }
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'samplerLoaded');

        } else if (trackTypeHint === 'InstrumentSampler') {
            if (track.instrumentSamplerSettings.audioBuffer && !track.instrumentSamplerSettings.audioBuffer.disposed) {
                track.instrumentSamplerSettings.audioBuffer.dispose();
            }
            if (track.toneSampler && !track.toneSampler.disposed) track.toneSampler.dispose();

            track.instrumentSamplerSettings = {
                ...track.instrumentSamplerSettings, // Preserve existing settings like rootNote, loop
                audioBuffer: newAudioBuffer,
                /* audioBufferDataURL: base64DataURL, */ // Potentially remove if not needed
                originalFileName: sourceName,
                dbKey: dbKey,
                status: 'loaded',
                // Reset loop points if a new sample is loaded, unless specific logic dictates otherwise
                loopStart: 0,
                loopEnd: newAudioBuffer.duration
            };
            track.setupToneSampler(); // Re-initialize Tone.Sampler
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'instrumentSamplerLoaded');

        } else if (trackTypeHint === 'DrumSampler' && padIndex !== null) {
            const padData = track.drumSamplerPads[padIndex];
            if (padData) {
                if (padData.audioBuffer && !padData.audioBuffer.disposed) padData.audioBuffer.dispose();
                if (track.drumPadPlayers[padIndex] && !track.drumPadPlayers[padIndex].disposed) track.drumPadPlayers[padIndex].dispose();

                padData.audioBuffer = newAudioBuffer;
                /* padData.audioBufferDataURL = base64DataURL; */ // Potentially remove
                padData.originalFileName = sourceName;
                padData.dbKey = dbKey;
                padData.status = 'loaded';
                track.drumPadPlayers[padIndex] = new Tone.Player(newAudioBuffer); // Create new player
                // Connection will be handled by rebuildEffectChain or play preview
            } else {
                console.error(`[Audio commonLoadSampleLogic] Pad data not found for index ${padIndex} on track ${track.id}`);
                throw new Error(`Pad data not found for index ${padIndex}.`);
            }
            if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'drumPadLoaded', padIndex);
        }

        track.rebuildEffectChain(); // Rebuild chain as sources might have changed
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Sample "${sourceName}" loaded for ${track.name}${trackTypeHint === 'DrumSampler' && padIndex !== null ? ` (Pad ${padIndex+1})` : ''}.`, 2000);
        }

    } catch (error) {
        console.error(`[Audio commonLoadSampleLogic] Error loading sample "${sourceName}" for track ${track.id} (${trackTypeHint}):`, error);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Error loading sample "${sourceName.substring(0,30)}": ${error.message || 'Unknown error.'}`, 4000);
        }
        // Update status in track data to 'error'
        if (trackTypeHint === 'Sampler') if(track.samplerAudioData) track.samplerAudioData.status = 'error';
        else if (trackTypeHint === 'InstrumentSampler') if(track.instrumentSamplerSettings) track.instrumentSamplerSettings.status = 'error';
        else if (trackTypeHint === 'DrumSampler' && padIndex !== null && track.drumSamplerPads[padIndex]) track.drumSamplerPads[padIndex].status = 'error';

        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sampleLoadError', padIndex);
    } finally {
        if (objectURLForTone) URL.revokeObjectURL(objectURLForTone);
    }
}

export async function loadSampleFile(eventOrUrl, trackId, trackTypeHint, fileNameForUrl = null) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Track ID ${trackId} not found.`, 3000);
        return;
    }
    if (trackTypeHint !== 'Sampler' && trackTypeHint !== 'InstrumentSampler') {
        if (localAppServices.showNotification) localAppServices.showNotification(`Cannot load general sample into ${trackTypeHint} track. Use specific loader.`, 3000);
        return;
    }
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio system not ready. Please interact with the page.", 3000);
        return;
    }

    let providedBlob, sourceName;
    const isUrlSource = typeof eventOrUrl === 'string';
    const isDirectFile = eventOrUrl instanceof File; // For direct file objects
    const isBlobEvent = eventOrUrl instanceof Blob && !(eventOrUrl instanceof File); // For Blobs that are not Files

    if (isUrlSource) {
        sourceName = fileNameForUrl || eventOrUrl.split('/').pop().split('?')[0] || "loaded_sample_from_url";
        try {
            const response = await fetch(eventOrUrl);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status} for "${sourceName}"`);
            providedBlob = await response.blob();
        } catch (e) {
            console.error(`[Audio loadSampleFile] Error fetching sample from URL "${eventOrUrl}":`, e);
            if (localAppServices.showNotification) localAppServices.showNotification(`Error fetching sample "${sourceName.substring(0,30)}": ${e.message}`, 3000);
            return;
        }
    } else if (eventOrUrl && eventOrUrl.target && eventOrUrl.target.files && eventOrUrl.target.files.length > 0) { // From file input event
        providedBlob = eventOrUrl.target.files[0];
        sourceName = providedBlob.name;
    } else if (isDirectFile) { // Directly passed File object
        providedBlob = eventOrUrl;
        sourceName = providedBlob.name;
    } else if (isBlobEvent) { // Directly passed Blob object
        providedBlob = eventOrUrl;
        sourceName = fileNameForUrl || `loaded_blob_${Date.now()}.wav`; // Provide a default name
    } else {
        if (localAppServices.showNotification) localAppServices.showNotification("No file selected or invalid source.", 3000);
        return;
    }

    if (!providedBlob) {
        if (localAppServices.showNotification) localAppServices.showNotification("Could not obtain file data.", 3000);
        return;
    }

    const inferredType = getMimeTypeFromFilename(sourceName);
    const explicitType = providedBlob.type || inferredType || 'application/octet-stream'; // Use provided type, then inferred, then default
    const fileObject = new File([providedBlob], sourceName, { type: explicitType });

    if (!fileObject.type.startsWith('audio/') && fileObject.type !== "application/octet-stream") {
        if (localAppServices.showNotification) localAppServices.showNotification(`Invalid audio file type: "${fileObject.type}". Please use common audio formats.`, 3000);
        return;
    }
    if (fileObject.size === 0) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Audio file "${sourceName}" is empty.`, 3000);
        return;
    }
    console.log(`[Audio loadSampleFile] Attempting to load "${sourceName}" (Type: ${fileObject.type}, Size: ${fileObject.size}) for track ${trackId} (${trackTypeHint})`);
    await commonLoadSampleLogic(fileObject, sourceName, track, trackTypeHint);
}


export async function loadDrumSamplerPadFile(eventOrUrl, trackId, padIndex, fileNameForUrl = null) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track || track.type !== 'DrumSampler') {
        if (localAppServices.showNotification) localAppServices.showNotification(`Track ID ${trackId} is not a Drum Sampler.`, 3000);
        return;
    }
    if (typeof padIndex !== 'number' || isNaN(padIndex) || padIndex < 0 || padIndex >= track.drumSamplerPads.length) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Invalid pad index: ${padIndex}.`, 3000);
        return;
    }
    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio system not ready. Please interact with the page.", 3000);
        return;
    }

    let providedBlob, sourceName;
    const isUrlSource = typeof eventOrUrl === 'string';
    const isDirectFile = eventOrUrl instanceof File;
    const isBlobEvent = eventOrUrl instanceof Blob && !(eventOrUrl instanceof File);


    if (isUrlSource) {
        sourceName = fileNameForUrl || eventOrUrl.split('/').pop().split('?')[0] || `pad_${padIndex}_sample_from_url`;
        try {
            const response = await fetch(eventOrUrl);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status} for "${sourceName}"`);
            providedBlob = await response.blob();
        } catch (e) {
            console.error(`[Audio loadDrumSamplerPadFile] Error fetching drum sample from URL "${eventOrUrl}":`, e);
            if (localAppServices.showNotification) localAppServices.showNotification(`Error fetching drum sample "${sourceName.substring(0,30)}": ${e.message}`, 3000);
            return;
        }
    } else if (eventOrUrl && eventOrUrl.target && eventOrUrl.target.files && eventOrUrl.target.files.length > 0) {
        providedBlob = eventOrUrl.target.files[0];
        sourceName = providedBlob.name;
    } else if (isDirectFile) {
        providedBlob = eventOrUrl;
        sourceName = providedBlob.name;
    } else if (isBlobEvent) {
        providedBlob = eventOrUrl;
        sourceName = fileNameForUrl || `pad_${padIndex}_blob_${Date.now()}.wav`;
    } else {
        if (localAppServices.showNotification) localAppServices.showNotification("No file selected for drum pad or invalid source.", 3000);
        return;
    }

    if (!providedBlob) {
        if (localAppServices.showNotification) localAppServices.showNotification("Could not obtain drum sample data.", 3000);
        return;
    }

    const inferredType = getMimeTypeFromFilename(sourceName);
    const explicitType = providedBlob.type || inferredType || 'application/octet-stream';
    const fileObject = new File([providedBlob], sourceName, { type: explicitType });

    if (!fileObject.type.startsWith('audio/') && fileObject.type !== "application/octet-stream") {
        if (localAppServices.showNotification) localAppServices.showNotification(`Invalid audio file type for drum pad: "${fileObject.type}".`, 3000);
        return;
    }
    if (fileObject.size === 0) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Drum sample "${sourceName}" is empty.`, 3000);
        return;
    }
    console.log(`[Audio loadDrumSamplerPadFile] Attempting to load "${sourceName}" (Type: ${fileObject.type}, Size: ${fileObject.size}) for track ${trackId}, pad ${padIndex}`);
    await commonLoadSampleLogic(fileObject, sourceName, track, 'DrumSampler', padIndex);
}

export async function loadSoundFromBrowserToTarget(soundData, targetTrackId, targetTrackTypeIgnored, targetPadOrSliceIndex = null) {
    const trackIdNum = parseInt(targetTrackId);
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackIdNum) : null;

    if (!track) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Target track (ID: ${targetTrackId}) not found.`, 3000);
        return;
    }

    const { fullPath, libraryName, fileName } = soundData;
    const isTargetSamplerType = ['Sampler', 'InstrumentSampler', 'DrumSampler'].includes(track.type);

    if (!isTargetSamplerType) {
        if (localAppServices.showNotification) localAppServices.showNotification(`Cannot load sample from browser to a ${track.type} track. Target must be a sampler type.`, 3000);
        return;
    }

    const audioReady = await initAudioContextAndMasterMeter(true);
    if (!audioReady) {
        if (localAppServices.showNotification) localAppServices.showNotification("Audio system not ready. Please interact with the page.", 3000);
        return;
    }

    if (localAppServices.showNotification) localAppServices.showNotification(`Loading "${fileName}" to ${track.name}...`, 2000);
    console.log(`[Audio loadSoundFromBrowserToTarget] Attempting to load: ${fileName} from lib: ${libraryName} (Path: ${fullPath}) to Track ID: ${track.id} (${track.type}), Pad/Slice Index: ${targetPadOrSliceIndex}`);

    try {
        const loadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
        if (!loadedZips[libraryName] || loadedZips[libraryName] === "loading") {
            throw new Error(`Library "${libraryName}" not loaded or is still loading.`);
        }
        const zipFile = loadedZips[libraryName];
        const zipEntry = zipFile.file(fullPath);
        if (!zipEntry) {
            throw new Error(`File "${fullPath}" not found in library "${libraryName}". Check path case and existence.`);
        }

        const fileBlobFromZip = await zipEntry.async("blob");
        const inferredMimeType = getMimeTypeFromFilename(fileName);
        const finalMimeType = fileBlobFromZip.type && fileBlobFromZip.type !== "application/octet-stream" ? fileBlobFromZip.type : inferredMimeType;
        const blobToLoad = new File([fileBlobFromZip], fileName, { type: finalMimeType });
        console.log(`[Audio loadSoundFromBrowserToTarget] Blob created from ZIP: ${fileName}, Type: ${blobToLoad.type}, Size: ${blobToLoad.size}`);


        if (track.type === 'DrumSampler') {
            let actualPadIndex = targetPadOrSliceIndex;
            // If targetPadOrSliceIndex is not valid, try to find an empty pad or use selected
            if (typeof actualPadIndex !== 'number' || isNaN(actualPadIndex) || actualPadIndex < 0 || actualPadIndex >= Constants.numDrumSamplerPads) {
                actualPadIndex = track.drumSamplerPads.findIndex(p => !p.dbKey && !p.originalFileName); // Find first truly empty
                if (actualPadIndex === -1) actualPadIndex = track.selectedDrumPadForEdit; // Fallback to selected
                if (typeof actualPadIndex !== 'number' || actualPadIndex < 0) actualPadIndex = 0; // Final fallback
                console.log(`[Audio loadSoundFromBrowserToTarget] Adjusted pad index for DrumSampler to: ${actualPadIndex}`);
            }
            await commonLoadSampleLogic(blobToLoad, fileName, track, 'DrumSampler', actualPadIndex);
        } else { // Sampler or InstrumentSampler
            await commonLoadSampleLogic(blobToLoad, fileName, track, track.type, null); // padIndex is null for these
        }
    } catch (error) {
        console.error(`[Audio loadSoundFromBrowserToTarget] Error loading sound "${fileName}" from browser:`, error);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Error loading "${fileName.substring(0,30)}": ${error.message}`, 4000);
        }
        if (localAppServices.updateTrackUI) localAppServices.updateTrackUI(track.id, 'sampleLoadError', targetPadOrSliceIndex);
    }
}

export async function fetchSoundLibrary(libraryName, zipUrl, isAutofetch = false) {
    // MODIFICATION START: Log the retrieved loadedZips object
    const initialLoadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
    console.log(`[Audio fetchSoundLibrary DEBUG] Initial loadedZips object for ${libraryName} (Autofetch: ${isAutofetch}):`,
        Object.keys(initialLoadedZips),
        `Value for ${libraryName}:`, initialLoadedZips[libraryName],
        `Is JSZip: ${initialLoadedZips[libraryName] instanceof JSZip}`
    );
    const loadedZips = initialLoadedZips; // Use this for the check
    // MODIFICATION END

    const soundTrees = localAppServices.getSoundLibraryFileTrees ? localAppServices.getSoundLibraryFileTrees() : {};

    console.log(`[Audio fetchSoundLibrary ENTRY] Library: ${libraryName}, URL: ${zipUrl}, Autofetch: ${isAutofetch}.`);
    if (loadedZips && typeof loadedZips === 'object') { // Ensure loadedZips is an object before keying
        console.log(`[Audio fetchSoundLibrary ENTRY] Existing loadedZips keys:`, Object.keys(loadedZips), `Status for ${libraryName}:`, loadedZips[libraryName]);
    } else {
        console.warn(`[Audio fetchSoundLibrary ENTRY] loadedZips is undefined, null, or not an object.`);
    }
    if (soundTrees && typeof soundTrees === 'object') {
        console.log(`[Audio fetchSoundLibrary ENTRY] Existing soundTrees keys:`, Object.keys(soundTrees));
    } else {
        console.warn(`[Audio fetchSoundLibrary ENTRY] soundTrees is undefined, null, or not an object.`);
    }


    if (loadedZips && loadedZips[libraryName] && loadedZips[libraryName] !== "loading") {
        console.log(`[Audio fetchSoundLibrary INFO] ${libraryName} already loaded or processed. Status:`, loadedZips[libraryName] instanceof JSZip ? 'JSZip Instance' : loadedZips[libraryName]);
        if (!isAutofetch && localAppServices.updateSoundBrowserDisplayForLibrary) {
            localAppServices.updateSoundBrowserDisplayForLibrary(libraryName, false, false); // isLoading = false, hasError = false
        }
        return; // Already loaded
    }
    if (loadedZips && loadedZips[libraryName] === "loading") {
        console.log(`[Audio fetchSoundLibrary INFO] ${libraryName} is currently being loaded by another call. Skipping this call.`);
        return; // Already being loaded
    }

    // Update UI to show loading state if not autofetching
    if (!isAutofetch && localAppServices.updateSoundBrowserDisplayForLibrary) {
        localAppServices.updateSoundBrowserDisplayForLibrary(libraryName, true, false); // isLoading = true, hasError = false
    }

    try {
        console.log(`[Audio fetchSoundLibrary SET_LOADING_STATE] Setting ${libraryName} to "loading" state.`);
        const newLoadedZips = localAppServices.getLoadedZipFiles ? { ...(localAppServices.getLoadedZipFiles()) } : {}; // Ensure we start with a fresh copy if getLoadedZipFiles is available
        newLoadedZips[libraryName] = "loading";
        if (localAppServices.setLoadedZipFilesState) localAppServices.setLoadedZipFilesState(newLoadedZips);


        console.log(`[Audio fetchSoundLibrary HTTP_REQUEST] Fetching ${zipUrl} for ${libraryName}`);
        const response = await fetch(zipUrl);
        console.log(`[Audio fetchSoundLibrary HTTP_RESPONSE] Response for ${libraryName} - Status: ${response.status}, OK: ${response.ok}`);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status} fetching ZIP for ${libraryName} from ${zipUrl}`);
        }
        const zipData = await response.arrayBuffer();
        console.log(`[Audio fetchSoundLibrary ZIP_DATA_RECEIVED] Received arrayBuffer for ${libraryName}, length: ${zipData.byteLength}`);

        if (typeof JSZip === 'undefined') {
            console.error("[Audio fetchSoundLibrary JSZIP_ERROR] JSZip library not found. Cannot process library.");
            throw new Error("JSZip library not available for processing sound libraries.");
        }

        const jszip = new JSZip();
        console.log(`[Audio fetchSoundLibrary JSZIP_LOAD_ASYNC_START] Starting jszip.loadAsync for ${libraryName}`);
        const loadedZipInstance = await jszip.loadAsync(zipData);
        console.log(`[Audio fetchSoundLibrary JSZIP_LOAD_ASYNC_SUCCESS] JSZip successfully loaded ${libraryName}. Num files in zip: ${Object.keys(loadedZipInstance.files).length}`);

        // Get the latest state again before updating
        const latestLoadedZipsAfterLoad = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
        latestLoadedZipsAfterLoad[libraryName] = loadedZipInstance; // Store the JSZip instance

        console.log(`[Audio Fetch DEBUG] About to set state for ${libraryName} (loadedZips).`);
        console.log(`[Audio Fetch DEBUG] localAppServices.setLoadedZipFilesState exists:`, !!localAppServices.setLoadedZipFilesState);
        if (localAppServices.setLoadedZipFilesState) {
            console.log(`[Audio Fetch DEBUG] Calling setLoadedZipFilesState for ${libraryName} (loadedZips) with keys:`, Object.keys(latestLoadedZipsAfterLoad));
            localAppServices.setLoadedZipFilesState(latestLoadedZipsAfterLoad);
        } else {
            console.error(`[Audio Fetch ERROR] localAppServices.setLoadedZipFilesState is UNDEFINED from ${libraryName} (loadedZips)`);
        }


        const fileTree = {};
        let audioFileCount = 0;
        console.log(`[Audio fetchSoundLibrary PARSE_ZIP_START] Parsing files for ${libraryName}`);
        loadedZipInstance.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir || relativePath.startsWith("__MACOSX") || relativePath.includes("/.") || relativePath.startsWith(".")) {
                return; // Skip directories and hidden/system files
            }
            const pathParts = relativePath.split('/').filter(p => p); // Filter out empty parts
            if (pathParts.length === 0) return;

            let currentLevel = fileTree;
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                if (i === pathParts.length - 1) { // File
                    if (part.match(/\.(wav|mp3|ogg|flac|aac|m4a)$/i)) { // Check for audio extensions
                        currentLevel[part] = { type: 'file', entry: zipEntry, fullPath: relativePath };
                        audioFileCount++;
                    }
                } else { // Directory
                    if (!currentLevel[part] || currentLevel[part].type !== 'folder') {
                        currentLevel[part] = { type: 'folder', children: {} };
                    }
                    currentLevel = currentLevel[part].children;
                }
            }
        });
        console.log(`[Audio fetchSoundLibrary PARSE_ZIP_COMPLETE] Parsed ${audioFileCount} audio files for ${libraryName}. FileTree keys:`, Object.keys(fileTree));

        const latestSoundTrees = localAppServices.getSoundLibraryFileTrees ? localAppServices.getSoundLibraryFileTrees() : {};
        latestSoundTrees[libraryName] = fileTree;

        console.log(`[Audio Fetch DEBUG] About to set state for ${libraryName} (soundTrees).`);
        console.log(`[Audio Fetch DEBUG] localAppServices.setSoundLibraryFileTreesState exists:`, !!localAppServices.setSoundLibraryFileTreesState);
        if (localAppServices.setSoundLibraryFileTreesState) {
            console.log(`[Audio Fetch DEBUG] Calling setSoundLibraryFileTreesState for ${libraryName} (soundTrees) with keys:`, Object.keys(latestSoundTrees));
            localAppServices.setSoundLibraryFileTreesState(latestSoundTrees);
        } else {
             console.error(`[Audio Fetch ERROR] localAppServices.setSoundLibraryFileTreesState is UNDEFINED from ${libraryName} (soundTrees)`);
        }

        const checkZipsAfterSet = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
        console.log(`[Audio Fetch DEBUG] State for loadedZips after set for ${libraryName}. Keys:`, Object.keys(checkZipsAfterSet), `Has ${libraryName}:`, !!checkZipsAfterSet[libraryName]);
        const checkTreesAfterSet = localAppServices.getSoundLibraryFileTrees ? localAppServices.getSoundLibraryFileTrees() : {};
        console.log(`[Audio Fetch DEBUG] State for soundTrees after set for ${libraryName}. Keys:`, Object.keys(checkTreesAfterSet), `Has ${libraryName}:`, !!checkTreesAfterSet[libraryName]);
        if (checkTreesAfterSet[libraryName]) {
             console.log(`[Audio Fetch DEBUG] Verified tree for ${libraryName} in state has children count:`, Object.keys(checkTreesAfterSet[libraryName]).length);
        }


        console.log(`[Audio fetchSoundLibrary SUCCESS] Successfully loaded and processed library: ${libraryName}.`);
        if (localAppServices.updateSoundBrowserDisplayForLibrary) {
            localAppServices.updateSoundBrowserDisplayForLibrary(libraryName, false, false); // isLoading = false, hasError = false
        }

    } catch (error) {
        console.error(`[Audio fetchSoundLibrary CATCH_ERROR] Error fetching/processing library ${libraryName} from ${zipUrl}:`, error);

        const errorLoadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
        delete errorLoadedZips[libraryName];
        if (localAppServices.setLoadedZipFilesState) localAppServices.setLoadedZipFilesState(errorLoadedZips);

        const errorSoundTrees = localAppServices.getSoundLibraryFileTrees ? localAppServices.getSoundLibraryFileTrees() : {};
        delete errorSoundTrees[libraryName];
        if (localAppServices.setSoundLibraryFileTreesState) localAppServices.setSoundLibraryFileTreesState(errorSoundTrees);

        console.warn(`[Audio fetchSoundLibrary ERROR_STATE_CLEARED] State for ${libraryName} cleared due to error.`);
        if (!isAutofetch && localAppServices.showNotification) {
            localAppServices.showNotification(`Error loading library ${libraryName}: ${error.message}`, 4000);
        }
        if (localAppServices.updateSoundBrowserDisplayForLibrary) {
             localAppServices.updateSoundBrowserDisplayForLibrary(libraryName, false, true); // isLoading = false, hasError = true
        }
    }
}

export function autoSliceSample(trackId, numSlicesToCreate = Constants.numSlices) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track || track.type !== 'Sampler' || !track.audioBuffer || !track.audioBuffer.loaded) {
        if (localAppServices.showNotification) localAppServices.showNotification("Cannot auto-slice: Load sample first or ensure sample is valid.", 3000);
        return;
    }
    const duration = track.audioBuffer.duration;
    if (duration <= 0) {
        if (localAppServices.showNotification) localAppServices.showNotification("Cannot auto-slice: Sample has no duration.", 3000);
        return;
    }

    track.slices = []; // Reset slices
    const sliceDuration = duration / numSlicesToCreate;
    for (let i = 0; i < numSlicesToCreate; i++) {
        track.slices.push({
            offset: i * sliceDuration,
            duration: sliceDuration,
            userDefined: false, // Mark as auto-generated
            volume: 0.7, // Default volume
            pitchShift: 0, // Default pitch
            loop: false,
            reverse: false,
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.2 } // Default envelope
        });
    }
    track.selectedSliceForEdit = 0; // Select the first slice
    // If the track has sequences, their row count might need to be updated if tied to slice count.
    // This is complex as sequences are generic. The sequencer UI rendering should adapt.
    // The track's recreateToneSequence method should handle using the new number of slices.
    track.recreateToneSequence(true); // Recreate sequence to reflect new slice count

    if (localAppServices.updateTrackUI) {
        localAppServices.updateTrackUI(track.id, 'sampleSliced'); // Triggers UI update
    }
    if (localAppServices.showNotification) localAppServices.showNotification(`Sample auto-sliced into ${numSlicesToCreate} parts.`, 2000);
}

export function clearAllMasterEffectNodes() {
    activeMasterEffectNodes.forEach((node, id) => {
        if (node && !node.disposed) {
            try {
                node.dispose();
            } catch (e) {
                console.warn(`[Audio clearAllMasterEffectNodes] Error disposing master effect node ID ${id}:`, e.message);
            }
        }
    });
    activeMasterEffectNodes.clear();
    console.log("[Audio clearAllMasterEffectNodes] All active master effect nodes cleared and disposed.");
    rebuildMasterEffectChain(); // Rebuild with an empty chain (input -> gain -> destination)
}


// --- Audio Recording Functions ---
export function setTrackMonitoring(trackId, enabled) {
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track || track.type !== 'Audio') {
        console.warn("[Audio setTrackMonitoring] Invalid track for monitoring toggle:", trackId);
        return;
    }
    if (!mic) {
        console.warn("[Audio setTrackMonitoring] No mic instance available.");
        return;
    }
    if (mic.state !== 'started') {
        console.warn("[Audio setTrackMonitoring] Mic is not open, cannot toggle monitoring.");
        return;
    }
    if (!track.inputChannel || track.inputChannel.disposed) {
        console.warn("[Audio setTrackMonitoring] Track inputChannel is invalid.");
        return;
    }
    try {
        if (enabled) {
            mic.connect(track.inputChannel);
            console.log(`[Audio setTrackMonitoring] Monitoring ENABLED for track ${track.name}`);
        } else {
            mic.disconnect(track.inputChannel);
            console.log(`[Audio setTrackMonitoring] Monitoring DISABLED for track ${track.name}`);
        }
    } catch(e) {
        console.error("[Audio setTrackMonitoring] Error toggling monitoring:", e);
    }
}

export async function startAudioRecording(track, isMonitoringEnabled) {
    console.log("[Audio startAudioRecording] Called for track:", ((track) && (track).name), "Monitoring:", isMonitoringEnabled);

    // Ensure previous instances are robustly closed and disposed
    if (mic) {
        console.log("[Audio startAudioRecording] Existing mic instance found. State:", mic.state);
        if (mic.state === "started") {
            try { mic.close(); console.log("[Audio startAudioRecording] Existing mic closed."); }
            catch (e) { console.warn("[Audio startAudioRecording] Error closing existing mic:", e.message); }
        }
        // Tone.UserMedia objects don't have a standard dispose method in the same way other Tone nodes do
        mic = null;
        console.log("[Audio startAudioRecording] Previous mic instance nullified.");
    }

    if (recorder) {
        console.log("[Audio startAudioRecording] Existing recorder instance found. State:", recorder.state, "Disposed:", recorder.disposed);
        if (recorder.state === "started") {
            try { await recorder.stop(); console.log("[Audio startAudioRecording] Existing recorder stopped."); }
            catch (e) { console.warn("[Audio startAudioRecording] Error stopping existing recorder:", e.message); }
        }
        if (!recorder.disposed) {
            try { recorder.dispose(); console.log("[Audio startAudioRecording] Existing recorder disposed."); }
            catch (e) { console.warn("[Audio startAudioRecording] Error disposing existing recorder:", e.message); }
        }
        recorder = null;
        console.log("[Audio startAudioRecording] Previous recorder instance nullified.");
    }

    // Create new instances for a fresh start.
    mic = new Tone.UserMedia({
        audio: { // Ideal constraints
            echoCancellation: false, autoGainControl: false, noiseSuppression: false, latency: 0.01 // small latency hint
        }
    });
    console.log("[Audio startAudioRecording] New Tone.UserMedia instance created.");
    recorder = new Tone.Recorder();
    console.log("[Audio startAudioRecording] New Tone.Recorder instance created.");

    if (!track || track.type !== 'Audio' || !track.inputChannel || track.inputChannel.disposed) {
        const errorMsg = `Recording failed: Track (ID: ${((track) && (track).id)}) is not a valid audio track or its input channel is missing/disposed. Type: ${((track) && (track).type)}. Input channel valid: ${!!(((track) && (track).inputChannel) && !track.inputChannel.disposed)}`;
        console.error(`[Audio startAudioRecording] ${errorMsg}`);
        if (localAppServices.showNotification) localAppServices.showNotification(errorMsg, 4000);
        return false;
    }
    console.log(`[Audio startAudioRecording] Attempting to record on track: ${track.name} (ID: ${track.id})`);

    try {
        if (Tone.UserMedia.enumerateDevices && typeof Tone.UserMedia.enumerateDevices === 'function') {
            try {
                const devices = await Tone.UserMedia.enumerateDevices();
                const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
                console.log("[Audio startAudioRecording] Available audio input devices:", audioInputDevices.map(d => ({ label: d.label, deviceId: d.deviceId, groupId: d.groupId })));
                if (audioInputDevices.length === 0) console.warn("[Audio startAudioRecording] No audio input devices found by enumerateDevices.");
            } catch (enumError) {
                console.error("[Audio startAudioRecording] Error enumerating devices:", enumError);
            }
        } else {
            console.warn("[Audio startAudioRecording] Tone.UserMedia.enumerateDevices is not available or not a function.");
        }

        console.log("[Audio startAudioRecording] Opening microphone (mic.open())...");
        await mic.open();
        console.log("[Audio startAudioRecording] Microphone opened successfully. State:", mic.state, "Selected device label (mic.label):", mic.label || "N/A");

        // Disconnect mic from everything first to be safe
        try { mic.disconnect(); } catch (e) { /* ignore if not connected */ }

        if (isMonitoringEnabled) {
            console.log("[Audio startAudioRecording] Monitoring is ON. Connecting mic to track inputChannel.");
            mic.connect(track.inputChannel);
        } else {
            console.log("[Audio startAudioRecording] Monitoring is OFF.");
            // Ensure mic is not connected to the inputChannel if monitoring is off.
            // This might be redundant if disconnect above worked, but explicit check is safer.
        }
        mic.connect(recorder);
        console.log("[Audio startAudioRecording] Mic connected to recorder.");

        console.log("[Audio startAudioRecording] Starting recorder...");
        await recorder.start();
        console.log("[Audio startAudioRecording] Recorder started. State:", recorder.state);
        return true;

    } catch (error) {
        console.error("[Audio startAudioRecording] Error starting microphone/recorder:", error);
        let userMessage = "Could not start recording. Check microphone permissions and ensure a microphone is connected.";
        if (error.name === "NotAllowedError" || error.message.toLowerCase().includes("permission denied")) {
            userMessage = "Microphone permission denied. Please allow microphone access in browser/system settings.";
        } else if (error.name === "NotFoundError" || error.message.toLowerCase().includes("no device") || error.message.toLowerCase().includes("device not found")) {
            userMessage = "No microphone found. Please connect a microphone and ensure it's selected by the browser/OS.";
        } else if (error.name === "AbortError" || error.message.toLowerCase().includes("starting audio input failed")) {
            userMessage = "Failed to start audio input. The microphone might be in use by another application or a hardware issue.";
        }
        if (localAppServices.showNotification) localAppServices.showNotification(userMessage, 6000);

        // Cleanup on error
        if (mic && mic.state === "started") {
            try { mic.close(); } catch(e) { console.warn("Cleanup error closing mic:", e.message); }
        }
        mic = null;
        if (recorder && !recorder.disposed) {
            try { recorder.dispose(); } catch(e) { console.warn("Cleanup error disposing recorder:", e.message); }
        }
        recorder = null;
        return false;
    }
}

export async function stopAudioRecording() {
    console.log("[Audio stopAudioRecording] Called.");
    let blob = null;
    
    // FIX Bug #7: Ensure cleanup happens even on error - use try/finally pattern
    // Also fix start time: use getRecordingStartTimeState() which now correctly returns the recording start position
    const recordingStartPosition = getRecordingStartTimeState();
    const recordingDurationSeconds = Tone.Transport.seconds - recordingStartPosition;
    
    // FIX Bug #8: Add maximum recording duration warning (5 minutes max)
    const MAX_RECORDING_DURATION = 300; // 5 minutes in seconds
    if (recordingDurationSeconds > MAX_RECORDING_DURATION) {
        console.warn(`[Audio stopAudioRecording] Recording exceeded maximum duration (${MAX_RECORDING_DURATION}s). Duration: ${recordingDurationSeconds.toFixed(1)}s`);
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Recording truncated - maximum duration (${MAX_RECORDING_DURATION / 60} min) exceeded.`, 4000);
        }
    }

    try {
        if (!recorder) {
            console.warn("[Audio stopAudioRecording] Recorder not initialized. Cannot stop recording.");
            if (mic && mic.state === "started") {
                console.log("[Audio stopAudioRecording] Mic was started, closing it (recorder was null).");
                try { mic.close(); } catch(e) { console.warn("[Audio stopAudioRecording] Error closing mic (recorder null):", e.message); }
            }
            mic = null;
            return; // Nothing to process if recorder wasn't there
        }

        if (recorder.state === "started") {
            try {
                console.log("[Audio stopAudioRecording] Stopping recorder...");
                blob = await recorder.stop(); // This resolves with the Blob
                console.log("[Audio stopAudioRecording] Recorder stopped. Blob received, size:", ((blob) && (blob).size), "type:", ((blob) && (blob).type));
            } catch (e) {
                console.error("[Audio stopAudioRecording] Error stopping recorder:", e);
                if (localAppServices.showNotification) localAppServices.showNotification("Error stopping recorder. Recording may be lost.", 3000);
                // Blob will be null if stop() failed
            }
        } else {
            console.warn("[Audio stopAudioRecording] Recorder was not in 'started' state. Current state:", recorder.state);
        }
    } finally {
        // FIX Bug #7: Cleanup code moved to finally block to ensure it always runs
        // Cleanup mic
        if (mic) {
            try {
                if (mic.state === "started") {
                    console.log("[Audio stopAudioRecording] Closing microphone.");
                    try {
                        mic.disconnect(recorder); // Disconnect from recorder first
                    } catch(e) { /* ignore */ }
                    
                    if (localAppServices.getRecordingTrackId) { // Disconnect from track input if monitoring was on
                        const recTrack = localAppServices.getTrackById(localAppServices.getRecordingTrackId());
                        if (recTrack && recTrack.inputChannel && !recTrack.inputChannel.disposed) {
                           try { mic.disconnect(recTrack.inputChannel); } catch(e) { /* ignore */ }
                        }
                    }
                    mic.close();
                    console.log("[Audio stopAudioRecording] Microphone closed and disconnected.");
                }
            } catch (e) {
                console.warn("[Audio stopAudioRecording] Error closing/disconnecting mic:", e.message);
            }
            mic = null; // Nullify the global reference
            console.log("[Audio stopAudioRecording] Mic instance nullified.");
        }

        // Cleanup recorder
        if (recorder) {
            try {
                if (!recorder.disposed) {
                    console.log("[Audio stopAudioRecording] Disposing recorder instance.");
                    recorder.dispose();
                }
            } catch(e) {
                console.warn("[Audio stopAudioRecording] Error disposing recorder:", e.message);
            }
        }
        recorder = null;
        console.log("[Audio stopAudioRecording] Recorder disposed and nullified.");
    }

    // Process the recorded blob
    if (blob && blob.size > 0) {
        const recordingTrackId = localAppServices.getRecordingTrackId ? localAppServices.getRecordingTrackId() : null;
        
        // FIX Bug #1 & #2: Use the recording start position, not the end time
        // recordingStartPosition is now correctly calculated in state.js getter
        const clipStartTime = recordingStartPosition;
        
        const track = recordingTrackId !== null && localAppServices.getTrackById ? localAppServices.getTrackById(recordingTrackId) : null;

        if (track) {
            console.log(`[Audio stopAudioRecording] Processing recorded blob for track ${track.name} (ID: ${track.id}), start position: ${clipStartTime}, duration: ${recordingDurationSeconds.toFixed(2)}s`);
            if (typeof track.addAudioClip === 'function') {
                await track.addAudioClip(blob, clipStartTime);
            } else {
                console.error("[Audio stopAudioRecording] Track object does not have addAudioClip method.");
                if (localAppServices.showNotification) localAppServices.showNotification("Error: Could not process recorded audio (internal error).", 3000);
            }
        } else {
            // FIX Bug #11: Handle case where track was deleted during recording
            console.error(`[Audio stopAudioRecording] Recorded track (ID: ${recordingTrackId}) not found after stopping recorder.`);
            if (localAppServices.showNotification) localAppServices.showNotification("Error: Recorded track not found. Audio might be lost.", 3000);
            
            // FIX: Save the recording anyway to a fallback location (IndexedDB) so it's not completely lost
            try {
                const fallbackDbKey = `lost_recording_${Date.now()}.wav`;
                await storeAudio(fallbackDbKey, blob);
                console.log(`[Audio stopAudioRecording] Saved orphaned recording to ${fallbackDbKey}`);
            } catch (saveError) {
                console.error("[Audio stopAudioRecording] Failed to save orphaned recording:", saveError);
            }
        }
    } else if (blob && blob.size === 0) {
        console.warn("[Audio stopAudioRecording] Recording was empty.");
        if (localAppServices.showNotification) localAppServices.showNotification("Recording was empty. No clip created.", 2000);
    } else if (!blob) {
        console.warn("[Audio stopAudioRecording] No recording blob was captured.");
    }
}

export async function getAudioBlobFromSoundBrowserItem(soundData) {
    const { fullPath, libraryName, fileName } = soundData;
    
    if (!fullPath || !libraryName) {
        console.error("[Audio getAudioBlobFromSoundBrowserItem] Invalid sound data:", soundData);
        return null;
    }
    
    try {
        const loadedZips = localAppServices.getLoadedZipFiles ? localAppServices.getLoadedZipFiles() : {};
        if (!loadedZips[libraryName] || loadedZips[libraryName] === "loading") {
            console.warn(`[Audio getAudioBlobFromSoundBrowserItem] Library "${libraryName}" not loaded or is still loading.`);
            return null;
        }
        const zipFile = loadedZips[libraryName];
        const zipEntry = zipFile.file(fullPath);
        if (!zipEntry) {
            console.error(`[Audio getAudioBlobFromSoundBrowserItem] File "${fullPath}" not found in library "${libraryName}".`);
            return null;
        }

        const fileBlobFromZip = await zipEntry.async("blob");
        const inferredMimeType = getMimeTypeFromFilename(fileName);
        const finalMimeType = fileBlobFromZip.type && fileBlobFromZip.type !== "application/octet-stream" ? fileBlobFromZip.type : inferredMimeType;
        const blob = new File([fileBlobFromZip], fileName, { type: finalMimeType });
        
        console.log(`[Audio getAudioBlobFromSoundBrowserItem] Successfully extracted blob for "${fileName}", size: ${blob.size}`);
        return blob;
        
    } catch (error) {
        console.error(`[Audio getAudioBlobFromSoundBrowserItem] Error extracting audio blob:`, error);
        return null;
    }
}

// ============================================================
// METRONOME MODULE
// ============================================================
let metronomeEnabled = false;
let metronomeSynth = null;
let metronomeScheduledId = null;
let _metronomeVolume = 0.25; // -12dB roughly
let countInActive = false;
let countInScheduledId = null;
let countInBars = 1; // Default 1 bar count-in

export function isMetronomeEnabled() { return metronomeEnabled; }

export function getCountInBars() { return countInBars; }
export function setCountInBars(bars) { countInBars = Math.max(0, Math.min(4, Math.floor(bars))); }
export function isCountInActive() { return countInActive; }

export function setMetronomeEnabled(enabled) {
    if (enabled === metronomeEnabled) return;
    metronomeEnabled = enabled;
    if (metronomeEnabled) {
        scheduleMetronome();
    } else {
        cancelMetronome();
    }
}

export function setMetronomeVolume(vol) {
    _metronomeVolume = Math.max(0, Math.min(1, vol));
    if (metronomeSynth && !metronomeSynth.disposed) {
        metronomeSynth.volume.value = Tone.gainToDb(_metronomeVolume);
    }
}

export function getMetronomeVolume() { return _metronomeVolume; }

function ensureMetronomeSynth() {
    if (metronomeSynth && !metronomeSynth.disposed) return;
    if (!Tone.context || Tone.context.state !== 'running') return;
    if (metronomeSynth) { try { metronomeSynth.dispose(); } catch(e){} }
    metronomeSynth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }
    });
    // Connect directly to destination — bypasses master bus so it's always heard
    metronomeSynth.toDestination();
    metronomeSynth.volume.value = Tone.gainToDb(_metronomeVolume);
}

function tickMetronome(time) {
    if (!metronomeSynth || metronomeSynth.disposed) return;
    const transportPos = Tone.Transport.position;
    const [bars, beats, sixteenths] = transportPos.split(':').map(Number);
    if (isNaN(bars) || isNaN(beats) || isNaN(sixteenths)) return;

    if (beats === 0 && sixteenths === 0) {
        // Bar 1 beat 1 — accent
        metronomeSynth.triggerAttackRelease('C6', '32n', time);
    } else if (sixteenths === 0) {
        // Beat 1 — normal click
        metronomeSynth.triggerAttackRelease('C5', '32n', time);
    }
}

function scheduleMetronome() {
    if (!Tone.context || Tone.context.state !== 'running') {
        console.warn('[Metronome] Cannot schedule: audio context not running.');
        return;
    }
    cancelMetronome();
    ensureMetronomeSynth();
    if (!metronomeSynth || metronomeSynth.disposed) return;
    metronomeScheduledId = Tone.Transport.scheduleRepeat((time) => {
        tickMetronome(time);
    }, '16n', 0);
    console.log('[Metronome] Scheduled, ID:', metronomeScheduledId);
}

function cancelMetronome() {
    if (metronomeScheduledId !== null) {
        try { Tone.Transport.clear(metronomeScheduledId); } catch(e){}
        metronomeScheduledId = null;
    }
}

export function stopMetronome() {
    metronomeEnabled = false;
    cancelMetronome();
}

export function cleanupMetronome() {
    stopMetronome();
    if (metronomeSynth) {
        try { metronomeSynth.dispose(); } catch(e){}
        metronomeSynth = null;
    }
}

export function cleanupCountIn() {
    if (countInScheduledId !== null) {
        try { Tone.Transport.clear(countInScheduledId); } catch(e){}
        countInScheduledId = null;
    }
    countInActive = false;
}

export function startCountIn(onCountInComplete, startPosition = 0) {
    if (countInBars <= 0) {
        if (onCountInComplete) onCountInComplete();
        return;
    }
    if (!Tone.context || Tone.context.state !== 'running') {
        console.warn('[CountIn] Cannot start: audio context not running.');
        if (onCountInComplete) onCountInComplete();
        return;
    }

    cleanupCountIn();
    countInActive = true;
    const barsPerBeat = 4;
    const totalSixteenths = countInBars * barsPerBeat * 4;

    countInScheduledId = Tone.Transport.schedule((time) => {
        countInActive = false;
        countInScheduledId = null;
        if (onCountInComplete) {
            Tone.getTransport().schedule((t) => { onCountInComplete(); }, time);
        }
    }, `+0:${totalSixteenths}:0`);

    console.log(`[CountIn] Started ${countInBars} bar count-in, scheduled to complete at ${totalSixteenths} sixteenths. ID:`, countInScheduledId);
}

// ============================================================
// AUTOMATION SCHEDULING MODULE
// ============================================================

let automationScheduledId = null;

function tickAutomation(time) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    for (const track of tracks) {
        if (track && typeof track.applyAutomationAtTime === 'function') {
            try {
                track.applyAutomationAtTime(time);
            } catch (e) { console.warn(`[Audio tickAutomation] Error applying automation for track ${track.id}:`, e.message); }
        }
    }
    // Apply master volume automation
    try {
        applyMasterVolumeAutomationAtTime(time);
    } catch (e) { console.warn(`[Audio tickAutomation] Error applying master volume automation:`, e.message); }
}

function scheduleAutomation() {
    if (!Tone.context || Tone.context.state !== 'running') {
        console.warn('[Automation] Cannot schedule: audio context not running.');
        return;
    }
    cancelAutomation();
    automationScheduledId = Tone.Transport.scheduleRepeat((time) => {
        tickAutomation(time);
    }, '16n', 0);
    console.log('[Automation] Scheduled, ID:', automationScheduledId);
}

function cancelAutomation() {
    if (automationScheduledId !== null) {
        try { Tone.Transport.clear(automationScheduledId); } catch(e){}
        automationScheduledId = null;
    }
}

export function startAutomation() {
    scheduleAutomation();
}

export function stopAutomation() {
    cancelAutomation();
}

export function cleanupAutomation() {
    stopAutomation();
}

// Called when transport starts
export function onTransportStart() {
    scheduleAutomation();
}

// Called when transport stops
export function onTransportStop() {
    cancelAutomation();
}

// ============================================================
// MASTER VOLUME AUTOMATION MODULE
// ============================================================
let masterVolumeAutomation = []; // Array of {time, value} events

export function writeMasterVolumeAutomation(time, value) {
    const event = { time: parseFloat(time), value: Math.max(0, Math.min(parseFloat(value) || 0, 1.5)) };
    masterVolumeAutomation.push(event);
    if (masterVolumeAutomation.length > 10000) masterVolumeAutomation.splice(0, 1000);
    masterVolumeAutomation.sort((a, b) => a.time - b.time);
    return event;
}

export function applyMasterVolumeAutomationAtTime(time) {
    if (!masterVolumeAutomation || masterVolumeAutomation.length === 0) return;
    // Find the most recent event at or before this time
    let eventToApply = null;
    for (const event of masterVolumeAutomation) {
        if (event.time <= time) {
            eventToApply = event;
        } else {
            break; // events are sorted by time
        }
    }
    if (eventToApply !== null && masterGainNodeActual && !masterGainNodeActual.disposed) {
        try {
            masterGainNodeActual.gain.setValueAtTime(eventToApply.value, Tone.now());
            // Also sync the state so UI is consistent
            if (localAppServices.setMasterGainValueState) {
                localAppServices.setMasterGainValueState(eventToApply.value);
            }
        } catch (e) { console.warn('[Audio applyMasterVolumeAutomationAtTime] Error:', e.message); }
    }
}

export function getMasterVolumeAutomation() {
    return masterVolumeAutomation;
}

export function setMasterVolumeAutomation(automationData) {
    masterVolumeAutomation = Array.isArray(automationData) ? JSON.parse(JSON.stringify(automationData)) : [];
}

// ============================================================
// TAP TEMPO MODULE
// ============================================================
let tapTempoTaps = []; // Array of timestamps (ms) for each tap
const TAP_TEMPO_TIMEOUT_MS = 2000; // Reset if no tap within 2 seconds
const TAP_TEMPO_MIN_TAPS = 2; // Minimum taps needed to calculate tempo
const TAP_TEMPO_MAX_TAPS = 8; // Use last N taps for averaging

export function resetTapTempo() {
    tapTempoTaps = [];
}

export function tapTempo() {
    const now = performance.now();
    // Reset if gap is too large (user started a new phrase)
    if (tapTempoTaps.length > 0 && (now - tapTempoTaps[tapTempoTaps.length - 1]) > TAP_TEMPO_TIMEOUT_MS) {
        tapTempoTaps = [];
    }
    tapTempoTaps.push(now);
    // Keep only the last N taps
    if (tapTempoTaps.length > TAP_TEMPO_MAX_TAPS) {
        tapTempoTaps.shift();
    }
}

export function getTapTempoBpm() {
    if (tapTempoTaps.length < TAP_TEMPO_MIN_TAPS) return null;
    const intervals = [];
    for (let i = 1; i < tapTempoTaps.length; i++) {
        intervals.push(tapTempoTaps[i] - tapTempoTaps[i - 1]);
    }
    const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round((60000 / avgIntervalMs) * 10) / 10; // One decimal place
    return Math.max(Constants.MIN_TEMPO, Math.min(Constants.MAX_TEMPO, bpm));
}

export function isTapTempoReady() {
    return tapTempoTaps.length >= TAP_TEMPO_MIN_TAPS;
}

// ============================================================
// LOOP REGION MODULE
// ============================================================
let loopRegion = { start: 0, end: 16, enabled: false }; // Loop region in bars

export function getLoopRegion() {
    return { ...loopRegion };
}

export function setLoopRegion(startBars, endBars) {
    if (startBars < 0 || endBars <= startBars || endBars > Constants.MAX_BARS) {
        console.warn('[LoopRegion] Invalid region:', startBars, endBars);
        return false;
    }
    loopRegion.start = startBars;
    loopRegion.end = endBars;
    // Sync Tone.Transport.loop region if enabled
    Tone.Transport.loop = loopRegion.enabled;
    if (loopRegion.enabled) {
        Tone.Transport.loopStart = `${loopRegion.start}:0:0`;
        Tone.Transport.loopEnd = `${loopRegion.end}:0:0`;
    }
    console.log(`[LoopRegion] Set to ${loopRegion.start} - ${loopRegion.end} bars`);
    return true;
}

export function setLoopRegionEnabled(enabled) {
    loopRegion.enabled = !!enabled;
    Tone.Transport.loop = loopRegion.enabled;
    if (loopRegion.enabled) {
        Tone.Transport.loopStart = `${loopRegion.start}:0:0`;
        Tone.Transport.loopEnd = `${loopRegion.end}:0:0`;
    }
    console.log(`[LoopRegion] ${loopRegion.enabled ? 'Enabled' : 'Disabled'}`);
    return loopRegion.enabled;
}

export function isLoopRegionEnabled() {
    return loopRegion.enabled;
}

export function getLoopStartBars() { return loopRegion.start; }
export function getLoopEndBars() { return loopRegion.end; }

// ============================================================
// PUNCH IN/OUT MODULE
// ============================================================
let punchRegion = { in: 0, out: 16, enabled: false }; // Punch in/out in bars

export function getPunchRegion() {
    return { ...punchRegion };
}

export function setPunchRegion(inBars, outBars) {
    if (inBars < 0 || outBars <= inBars || outBars > Constants.MAX_BARS) {
        console.warn('[Punch] Invalid region:', inBars, outBars);
        return false;
    }
    punchRegion.in = inBars;
    punchRegion.out = outBars;
    console.log(`[Punch] Set to ${punchRegion.in} - ${punchRegion.out} bars`);
    return true;
}

export function setPunchRegionEnabled(enabled) {
    punchRegion.enabled = !!enabled;
    console.log(`[Punch] ${punchRegion.enabled ? 'Enabled' : 'Disabled'}`);
    return punchRegion.enabled;
}

export function isPunchRegionEnabled() {
    return punchRegion.enabled;
}

export function getPunchInBars() { return punchRegion.in; }
export function getPunchOutBars() { return punchRegion.out; }

export function isPositionInPunchRegion(positionString) {
    if (!punchRegion.enabled) return false;
    const posParts = positionString.split(':').map(Number);
    if (posParts.length < 3 || posParts.some(isNaN)) return false;
    const [bars, beats, sixteenths] = posParts;
    const totalSixteenths = bars * 16 + beats * 4 + sixteenths;
    const punchInSixteenths = punchRegion.in * 16;
    const punchOutSixteenths = punchRegion.out * 16;
    return totalSixteenths >= punchInSixteenths && totalSixteenths < punchOutSixteenths;
}

// ============================================================
// PUNCH-IN/OUT RECORDING ENFORCEMENT
// ============================================================
// When punch-in is enabled, we need to schedule a callback that starts/stops the
// actual Tone.Recorder at the correct transport positions (punch in/out points).
// The Tone.Recorder is an offline recorder — we need to manage its start/stop
// based on transport position to implement punch-in/out correctly.

export function scheduleRecordingForPunch(trackId, onPunchOutTriggered) {
    // Clear any previous scheduling
    if (recordingScheduledId !== null) {
        try { Tone.Transport.clear(recordingScheduledId); } catch(e) {}
        recordingScheduledId = null;
    }
    recordingScheduledTrackId = trackId;

    // Schedule the punch-out trigger
    const punchOutPosition = `+0:${punchRegion.out * 16}:0`;
    recordingScheduledId = Tone.Transport.schedule((time) => {
        console.log(`[Punch Recording] Punch-out point reached at ${punchOutPosition}. Stopping recorder.`);
        if (recorder && recorder.state === 'started') {
            recorder.stop().then(() => {
                console.log('[Punch Recording] Recorder stopped at punch-out.');
                if (onPunchOutTriggered) onPunchOutTriggered();
            }).catch(e => console.error('[Punch Recording] Error stopping at punch-out:', e));
        }
    }, punchOutPosition);
    console.log(`[Punch Recording] Scheduled punch-out at ${punchOutPosition}, ID:`, recordingScheduledId);
}

export function cancelScheduledRecording() {
    if (recordingScheduledId !== null) {
        try { Tone.Transport.clear(recordingScheduledId); } catch(e) {}
        recordingScheduledId = null;
    }
    recordingScheduledTrackId = null;
    console.log('[Punch Recording] Cancelled scheduled recording.');
}

export function getRecordingScheduledTrackId() {
    return recordingScheduledTrackId;
}

// Cleanup function to be called when recording stops
export function cleanupRecordingScheduling() {
    cancelScheduledRecording();
}

// ============================================================
// CONTEXT SUSPENSION MONITORING & RECOVERY
// ============================================================

// Monitor the Tone.context.state and attempt to recover from suspension.
// This handles the case where browsers auto-suspend AudioContext after
// a period of inactivity (especially on mobile/low-power modes).
export function startContextSuspensionMonitoring(intervalMs = 3000) {
    if (resumeAttemptScheduled) return; // Already monitoring
    resumeAttemptScheduled = true;

    const checkInterval = setInterval(() => {
        if (!Tone.context) {
            resumeAttemptScheduled = false;
            clearInterval(checkInterval);
            return;
        }

        const currentState = Tone.context.state;
        if (currentState === 'suspended') {
            contextSuspendedCount++;
            console.warn(`[Audio ContextMonitor] Context suspended (count: ${contextSuspendedCount}). Attempting auto-resume...`);
            Tone.context.resume().then(() => {
                if (Tone.context.state === 'running') {
                    console.log('[Audio ContextMonitor] Context resumed successfully after suspension.');
                    // Re-initialize master bus components if they were disposed
                    if (masterEffectsBusInputNode?.disposed || masterGainNodeActual?.disposed || masterMeterNode?.disposed) {
                        console.log('[Audio ContextMonitor] Master bus components disposed during suspension. Re-initializing...');
                        setupMasterBus();
                    }
                    // Emit a notification if this was a significant suspension
                    if (contextSuspendedCount > 0 && localAppServices.showNotification) {
                        localAppServices.showNotification('Audio context resumed.', 2000);
                    }
                } else {
                    console.warn('[Audio ContextMonitor] Resume attempted but context still not running. State:', Tone.context.state);
                    if (contextSuspendedCount >= 3 && localAppServices.showNotification) {
                        localAppServices.showNotification('Audio suspended. Tap/click to reactivate.', 4000);
                    }
                }
            }).catch(err => {
                console.error('[Audio ContextMonitor] Error during context resume:', err.message);
            });
        } else if (currentState === 'running') {
            // Context is running — reset the suspension counter if we were previously suspended
            if (contextSuspendedCount > 0) {
                console.log('[Audio ContextMonitor] Context running normally. Resetting suspension counter.');
                contextSuspendedCount = 0;
            }
        }
    }, intervalMs);

    console.log('[Audio ContextMonitor] Started context suspension monitoring, interval:', intervalMs, 'ms');
}

export function stopContextSuspensionMonitoring() {
    resumeAttemptScheduled = false;
    contextSuspendedCount = 0;
    console.log('[Audio ContextMonitor] Stopped context suspension monitoring.');
}

export function getContextSuspensionCount() {
    return contextSuspendedCount;
}

export function getContextState() {
    return Tone.context ? Tone.context.state : 'unavailable';
}

export async function exportMixdownToWav(durationSeconds) {
    console.log('[Audio exportMixdownToWav] Starting export, duration:', durationSeconds, 's');
    const maxDuration = 600; // 10 minutes max
    const safeDuration = Math.min(Math.max(durationSeconds, 1), maxDuration);

    // Pause transport if running to avoid double audio
    const wasPlaying = Tone.Transport.state === 'started';
    if (wasPlaying) {
        Tone.Transport.pause();
        console.log('[Audio exportMixdownToWav] Transport paused before export.');
    }

    try {
        // Use Tone.Recorder to capture output via live transport playback
        // This approach is more reliable than Tone.Offline which requires a
        // reconstructTransportSchedule() function that doesn't exist
        const recorder = new Tone.Recorder();
        const masterGain = getActualMasterGainNode();

        if (!masterGain || masterGain.disposed) {
            throw new Error('Master output not available.');
        }

        // Connect master gain to recorder
        masterGain.connect(recorder);
        console.log('[Audio exportMixdownToWav] Recorder connected to master gain.');

        // Reset transport state
        Tone.Transport.position = 0;
        Tone.Transport.loop = false;

        // Stop any existing playback on tracks
        const tracks = getTracksState();
        tracks.forEach(t => {
            if (t && typeof t.stopPlayback === 'function') t.stopPlayback();
        });
        await new Promise(r => setTimeout(r, 100));

        // Schedule all tracks for playback
        for (const track of tracks) {
            if (track && typeof track.schedulePlayback === 'function') {
                await track.schedulePlayback(0, safeDuration);
            }
        }

        // Start recording and transport
        await recorder.start();
        console.log('[Audio exportMixdownToWav] Recording started.');

        Tone.Transport.start();
        console.log('[Audio exportMixdownToWav] Transport started.');

        // Wait for full duration
        await new Promise(resolve => setTimeout(resolve, safeDuration * 1000 + 500));

        // Stop recording
        const recording = await recorder.stop();
        console.log('[Audio exportMixdownToWav] Recording stopped, size:', recording?.size);

        // Stop transport and cleanup
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
        tracks.forEach(t => {
            if (t && typeof t.stopPlayback === 'function') t.stopPlayback();
        });

        try { masterGain.disconnect(recorder); } catch (e) {}
        recorder.dispose();

        if (!recording || recording.size < 1000) {
            throw new Error('No audio recorded. Add some notes or audio first.');
        }

        console.log('[Audio exportMixdownToWav] Export complete, size:', recording.size);
        return recording;
    } catch (err) {
        console.error('[Audio exportMixdownToWav] Error during export:', err);
        throw err;
    } finally {
        // Restore transport state
        if (wasPlaying) {
            Tone.Transport.start();
            console.log('[Audio exportMixdownToWav] Transport resumed.');
        }
    }
}

// ============================================================
// EXPORT MIXDOWN TO WAV
// ============================================================

// export async function exportMixdownToWav(durationSeconds) {
//     console.log('[Audio exportMixdownToWav] Starting export, duration:', durationSeconds, 's');
//     const maxDuration = 600; // 10 minutes max
//     const safeDuration = Math.min(Math.max(durationSeconds, 1), maxDuration);

//     // Pause transport if running to avoid double audio
//     const wasPlaying = Tone.Transport.state === 'started';
//     if (wasPlaying) {
//         Tone.Transport.pause();
//         console.log('[Audio exportMixdownToWav] Transport paused for offline rendering.');
//     }

//     try {
//         // Tone.Offline renders all audio through the transport/scheduler
//         const buffer = await Tone.Offline(async () => {
//             // Reconstruct the transport schedule so offline context plays all scheduled events
//             if (typeof reconstructTransportSchedule === 'function') {
//                 await reconstructTransportSchedule();
//             }
//             // Schedule the transport to play for the full duration
//             Tone.Transport.start(0, 0);
//             // Let it run for the requested duration
//             await new Promise(resolve => setTimeout(resolve, (safeDuration + 0.5) * 1000));
//         }, safeDuration + 0.5);

//         console.log('[Audio exportMixdownToWav] Offline buffer created. Channels:', buffer.numberOfChannels, 'Duration:', buffer.duration, 's');

//         // Convert ToneAudioBuffer to AudioBuffer
//         const audioBuffer = buffer.get ? buffer.get() : buffer;

//         // Encode as WAV using a simple PCM encoder
//         const wavBlob = audioBufferToWav(audioBuffer);
//         console.log('[Audio exportMixdownToWav] WAV blob created. Size:', wavBlob.size, 'bytes');

//         return wavBlob;
//     } catch (err) {
//         console.error('[Audio exportMixdownToWav] Error during offline rendering:', err);
//         throw err;
//     } finally {
//         // Restore transport state
//         if (wasPlaying) {
//             Tone.Transport.start();
//             console.log('[Audio exportMixdownToWav] Transport resumed.');
//         }
//     }
// }

// function audioBufferToWav(audioBuffer) {
//     const numChannels = audioBuffer.numberOfChannels;
//     const sampleRate = audioBuffer.sampleRate;
//     const format = 1; // PCM
//     const bitDepth = 16;

//     const bytesPerSample = bitDepth / 8;
//     const blockAlign = numChannels * bytesPerSample;

//     // Interleave channels
//     const length = audioBuffer.length;
//     const samples = new Int16Array(length * numChannels);
//     for (let i = 0; i < length; i++) {
//         for (let ch = 0; ch < numChannels; ch++) {
//             const val = audioBuffer.getChannelData(ch)[i];
//             // Clamp to Int16 range and convert float [-1,1] to Int16
//             const int16 = Math.max(-32768, Math.min(32767, Math.round(val * 32768)));
//             samples[i * numChannels + ch] = int16;
//         }
//     }

//     const dataSize = samples.length * bytesPerSample;
//     const buffer = new ArrayBuffer(44 + dataSize);
//     const view = new DataView(buffer);

//     // RIFF header
//     writeString(view, 0, 'RIFF');
//     view.setUint32(4, 36 + dataSize, true);
//     writeString(view, 8, 'WAVE');

//     // fmt chunk
//     writeString(view, 12, 'fmt ');
//     view.setUint32(16, 16, true); // chunk size
//     view.setUint16(20, format, true); // PCM format
//     view.setUint16(22, numChannels, true);
//     view.setUint32(24, sampleRate, true);
//     view.setUint32(28, sampleRate * blockAlign, true); // byte rate
//     view.setUint16(32, blockAlign, true);
//     view.setUint16(34, bitDepth, true);

//     // data chunk
//     writeString(view, 36, 'data');
//     view.setUint32(40, dataSize, true);
//     new Int16Array(buffer, 44).set(samples);

//     return new Blob([buffer], { type: 'audio/wav' });
// }

// function writeString(view, offset, string) {
//     for (let i = 0; i < string.length; i++) {
//         view.setUint8(offset + i, string.charCodeAt(i));
//     }
// }