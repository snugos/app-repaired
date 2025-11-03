// js/audio.js - Core Audio Engine, Master Bus and Master Effects
import { createEffectInstance } from './effectsRegistry.js';

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

export async function initAudioContextAndMasterMeter() {
    if (audioContextInitialized && Tone.context.state === 'running') return true;
    try {
        await Tone.start();
        if (Tone.context.state === 'running') {
            if (!audioContextInitialized) {
                console.log('[Audio] Audio context initialized.');
                setupMasterBus();
            }
            audioContextInitialized = true;
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error initializing audio:", error);
        return false;
    }
}

function setupMasterBus() {
    if (!Tone.context || Tone.context.state !== 'running') return;

    masterEffectsBusInputNode?.dispose();
    masterGainNodeActual?.dispose();
    masterMeterNode?.dispose();

    masterEffectsBusInputNode = new Tone.Gain();
    masterGainNodeActual = new Tone.Gain(localAppServices.getMasterGainValue?.() ?? 1);
    masterMeterNode = new Tone.Meter({ smoothing: 0.8 });
    
    rebuildMasterEffectChain();
    console.log('[Audio] Master bus setup complete.');
}

export function rebuildMasterEffectChain() {
    if (!masterEffectsBusInputNode || !masterGainNodeActual || !masterMeterNode) {
        console.warn("Master bus components not ready, aborting rebuild.");
        return;
    }

    // --- Start of Corrected Code ---
    // Disconnect everything to ensure a clean slate
    masterEffectsBusInputNode.disconnect();
    activeMasterEffectNodes.forEach(node => node.disconnect());
    masterGainNodeActual.disconnect();

    let lastNodeInChain = masterEffectsBusInputNode;
    
    const masterEffects = localAppServices.getMasterEffects?.() || [];
    masterEffects.forEach(effectState => {
        let effectNode = activeMasterEffectNodes.get(effectState.id);
        if (!effectNode || effectNode.disposed) {
            effectNode = createEffectInstance(effectState.type, effectState.params);
            activeMasterEffectNodes.set(effectState.id, effectNode);
        }
        // Connect the last node to the current effect, then update the last node
        lastNodeInChain.connect(effectNode);
        lastNodeInChain = effectNode;
    });

    // Connect the end of the effects chain to the master gain
    lastNodeInChain.connect(masterGainNodeActual);
    
    // Connect the master gain to the final destination and the meter
    masterGainNodeActual.fan(Tone.Destination, masterMeterNode);
    // --- End of Corrected Code ---
}


export function addMasterEffectToAudio(effectId, effectType, params) {
    const toneNode = createEffectInstance(effectType, params);
    if (toneNode) {
        activeMasterEffectNodes.set(effectId, toneNode);
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

    // Use Tone.js's 'set' method for robust parameter setting
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
        const masterLevelGain = isFinite(masterLevelDb) ? Tone.dbToGain(masterLevelDb) : 0;
        if (globalMasterMeterBar) {
            globalMasterMeterBar.style.width = `${Math.min(100, masterLevelGain * 100)}%`;
        }
    }
    tracks.forEach(track => {
        if (track.trackMeter && !track.trackMeter.disposed) {
            const trackLevelDb = track.trackMeter.getValue();
            const trackLevelGain = isFinite(trackLevelDb) ? Tone.dbToGain(trackLevelDb) : 0;
            // Assuming you'll want to update track meters in the UI eventually
            // localAppServices.updateTrackUI?.(track.id, 'meterUpdate', trackLevelGain);
        }
    });
}
