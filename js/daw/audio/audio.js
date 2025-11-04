// js/daw/audio/audio.js - Core Audio Engine, Master Bus and Master Effects
// Corrected import for effectsRegistry

import { createEffectInstance, getEffectDefaultParams as getEffectDefaultParamsFromRegistry } from '/app/js/daw/effectsRegistry.js';

let masterEffectsBusInputNode = null;
let masterGainNodeActual = null;
let masterMeterNode = null;
let activeMasterEffectNodes = new Map();
let audioContextInitialized = false;
let localAppServices = {};

export function initializeAudioModule(appServices) {
    localAppServices = appServices;
}

export function getMasterBusInputNode() {
    if (!masterEffectsBusInputNode || masterEffectsBusInputNode.disposed) {
        console.log("[Audio] Master bus input node not ready, attempting setup.");
        setupMasterBus();
    }
    return masterEffectsBusInputNode;
}

export function setActualMasterVolume(gainValue, rampTime = 0.05) {
    if (masterGainNodeActual?.gain) {
        masterGainNodeActual.gain.rampTo(gainValue, rampTime);
    }
}

export async function initAudioContextAndMasterMeter(isUserInteraction = false) {
    if (audioContextInitialized && localAppServices.Tone.context.state === 'running') return true;
    if (localAppServices.Tone.context.state === 'suspended' && isUserInteraction) {
        try {
            await localAppServices.Tone.start();
            console.log('[Audio] Audio context resumed.');
            if (!audioContextInitialized) {
                 setupMasterBus();
                 audioContextInitialized = true;
            }
            return true;
        } catch(e) {
            console.error("Error resuming audio context:", e);
            return false;
        }
    }
    return audioContextInitialized;
}

function setupMasterBus() {
    if (masterEffectsBusInputNode && !masterEffectsBusInputNode.disposed) return;
    
    masterEffectsBusInputNode = new localAppServices.Tone.Gain();
    masterGainNodeActual = new localAppServices.Tone.Gain(localAppServices.Tone.dbToGain(0)).toDestination();
    masterMeterNode = new localAppServices.Tone.Meter();
    
    masterEffectsBusInputNode.connect(masterGainNodeActual);
    masterGainNodeActual.connect(masterMeterNode);
    
    console.log('[Audio] Master bus setup complete.');
    audioContextInitialized = true;
}

export function rebuildMasterEffectChain() {
    if (!masterEffectsBusInputNode || !masterGainNodeActual) return;
    
    masterEffectsBusInputNode.disconnect();
    
    let lastNodeInChain = masterEffectsBusInputNode;
    const masterEffects = localAppServices.getMasterEffects?.() || [];

    activeMasterEffectNodes.forEach(node => {
        if(node && !node.disposed) node.disconnect();
    });

    masterEffects.forEach(effectState => {
        const effectNode = activeMasterEffectNodes.get(effectState.id);
        if (effectNode && !effectNode.disposed) {
            lastNodeInChain.connect(effectNode);
            lastNodeInChain = effectNode;
        }
    });

    lastNodeInChain.connect(masterGainNodeActual);
}

export function addMasterEffectToAudio(effectId, effectType, params) {
    if (activeMasterEffectNodes.has(effectId)) return;
    const effectInstance = createEffectInstance(effectType, params);
    if (effectInstance) {
        activeMasterEffectNodes.set(effectId, effectInstance);
        rebuildMasterEffectChain();
    }
}

export function removeMasterEffectFromAudio(effectId) {
    activeMasterEffectNodes.get(effectId)?.dispose();
    activeMasterEffectNodes.delete(effectId);
    rebuildMasterEffectChain();
}

export function updateMasterEffectParamInAudio(effectId, paramPath, value) {
    const effectNode = activeMasterEffectNodes.get(effectId);
    if (!effectNode) return;

    try {
        effectNode.set({ [paramPath]: value });
    } catch (e) {
        console.warn(`Could not set param ${paramPath} on effect`, e);
    }
}

export function reorderMasterEffectInAudio() {
    rebuildMasterEffectChain();
}

export function updateMeters(globalMasterMeterBar, mixerMasterMeterBar, tracks) {
    if (masterMeterNode && !masterMeterNode.disposed) {
        const masterLevelDb = masterMeterNode.getValue();
        const masterLevelGain = isFinite(masterLevelDb) ? localAppServices.Tone.dbToGain(masterLevelDb) : 0;
        if (globalMasterMeterBar) {
            globalMasterMeterBar.style.width = `${Math.min(100, masterLevelGain * 100)}%`;
        }
        if (mixerMasterMeterBar) { // Fix for Issue 5: Use masterLevelGain here
            mixerMasterMeterBar.style.width = `${Math.min(100, masterLevelGain * 100)}%`;
        }
    }
    tracks.forEach(track => {
        if (track.trackMeter && !track.trackMeter.disposed) {
            const trackLevelDb = track.trackMeter.getValue();
            const trackLevelGain = isFinite(trackLevelDb) ? localAppServices.Tone.dbToGain(trackLevelDb) : 0;
            const mixerTrackMeterBar = document.getElementById(`mixerTrackMeterBar-${track.id}`);
            if (mixerTrackMeterBar) {
                mixerTrackMeterBar.style.width = `${Math.min(100, trackLevelGain * 100)}%`;
            }
        }
    });
}

export function forceStopAllAudio() {
    const tracks = localAppServices.getTracks?.() || [];
    tracks.forEach(track => {
        if (track.instrument && typeof track.instrument.releaseAll === 'function') {
            track.instrument.releaseAll();
        }
    });
    
    localAppServices.Tone.Transport.cancel(0);
    localAppServices.Tone.Transport.stop();
    localAppServices.Tone.Transport.position = 0;
}