// js/daw/state/masterState.js

// Corrected import path for effectsRegistry
import { getEffectDefaultParams as getEffectDefaultParamsFromRegistry } from '/app/js/daw/effectsRegistry.js'; // Corrected path

let masterEffectsChain = []; // Stores an array of effect objects (type, params, id) for the master bus
let masterGainValue = 1.0; // Stores the current master gain value (linear, not dB)

let localAppServices = {}; // Reference to the main appServices object

/**
 * Initializes the master state module.
 * @param {object} appServices - The main app services object.
 */
export function initializeMasterState(appServices) { //
    localAppServices = appServices; //
}

/**
 * Gets the current array of master effects in the chain.
 * @returns {Array<object>} An array of effect objects.
 */
export function getMasterEffects() { //
    return masterEffectsChain; //
}

/**
 * Sets the entire array of master effects (used during project loading/undo/redo).
 * @param {Array<object>} effects - The new array of effect objects.
 */
export function setMasterEffects(effects) { //
    masterEffectsChain = effects; //
}

/**
 * Adds a new effect to the master effects chain.
 * @param {string} effectType - The type of effect to add (e.g., 'Reverb', 'Compressor').
 */
export function addMasterEffect(effectType) { //
    const defaultParams = getEffectDefaultParamsFromRegistry(effectType); //
    const effect = { id: `master-effect-${Date.now()}`, type: effectType, params: defaultParams }; //
    masterEffectsChain.push(effect); //
    // Call the audio module to create and connect the Tone.js effect node
    localAppServices.addMasterEffectToAudio?.(effect.id, effect.type, effect.params); //
    localAppServices.updateMasterEffectsUI?.(); //
    localAppServices.captureStateForUndo?.(`Add ${effectType} to Master`); // Capture undo state
}

/**
 * Removes an effect from the master effects chain.
 * @param {string} effectId - The ID of the effect to remove.
 */
export function removeMasterEffect(effectId) { //
    const index = masterEffectsChain.findIndex(e => e.id === effectId); //
    if (index > -1) { //
        const removedEffectType = masterEffectsChain[index].type; // Get type for undo description
        masterEffectsChain.splice(index, 1); //
        localAppServices.removeMasterEffectFromAudio?.(effectId); //
        localAppServices.updateMasterEffectsUI?.(); //
        localAppServices.captureStateForUndo?.(`Remove ${removedEffectType} from Master`); // Capture undo state
    }
}

/**
 * Updates a parameter of an effect in the master effects chain.
 * @param {string} effectId - The ID of the effect to update.
 * @param {string} paramPath - The dot-separated path to the parameter (e.g., 'feedback', 'filter.Q').
 * @param {any} value - The new value for the parameter.
 */
export function updateMasterEffectParam(effectId, paramPath, value) { //
    const effect = masterEffectsChain.find(e => e.id === effectId); //
    if (effect) { //
        // This helper function safely sets nested properties in the effect.params object
        const keys = paramPath.split('.'); //
        let currentLevel = effect.params; //
        keys.forEach((key, index) => { //
            if (index === keys.length - 1) { //
                currentLevel[key] = value; //
            } else {
                currentLevel[key] = currentLevel[key] || {}; //
                currentLevel = currentLevel[key]; //
            }
        });
        localAppServices.updateMasterEffectParamInAudio?.(effectId, paramPath, value); //
        // No undo capture here, knobs/sliders handle it on interaction end.
    }
}

/**
 * Reorders effects in the master effects chain.
 * @param {number} oldIndex - The original index of the effect.
 * @param {number} newIndex - The new index for the effect.
 */
export function reorderMasterEffect(oldIndex, newIndex) { //
    const [moved] = masterEffectsChain.splice(oldIndex, 1); //
    masterEffectsChain.splice(newIndex, 0, moved); //
    localAppServices.reorderMasterEffectInAudio?.(); //
    localAppServices.updateMasterEffectsUI?.(); //
    localAppServices.captureStateForUndo?.(`Reorder Master Effects`); // Capture undo state
}

/**
 * Gets the current master gain value.
 * @returns {number} The current master gain (linear, 0.0-1.0+).
 */
export function getMasterGainValue() { //
    return masterGainValue; //
}

/**
 * Sets the master gain value and updates the actual audio gain node.
 * @param {number} gain - The new master gain (linear, 0.0-1.0+).
 */
export function setMasterGainValue(gain) { //
    masterGainValue = gain; //
    localAppServices.setActualMasterVolume?.(gain); //
    // No undo capture here, mixer knob handles it on interaction end.
}