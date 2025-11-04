// js/daw/EffectChain.js

import { createEffectInstance } from '/app/js/daw/effectsRegistry.js'; // Corrected path

export class EffectChain {
    constructor(track, appServices) {
        this.track = track;
        this.appServices = appServices;
        this.activeEffects = [];
    }

    initialize(effects = []) {
        // Ensure effects is an array before iterating
        if (Array.isArray(effects)) {
            effects.forEach(effectData => this.addEffect(effectData.type, effectData.params, true));
        } else {
            console.warn(`[EffectChain.js] initialize received non-array effects data for track ${this.track.id}:`, effects);
        }
        // After initializing all effects, rebuild the chain to ensure connections are correct.
        this.rebuildEffectChain();
    }

    addEffect(effectType, params, isInitialLoad = false) {
        const effectDef = this.appServices.effectsRegistryAccess?.AVAILABLE_EFFECTS[effectType];
        if (!effectDef) {
            console.warn(`[EffectChain.js] Effect definition for type "${effectType}" not found.`);
            return;
        }
        const initialParams = params || this.appServices.effectsRegistryAccess.getEffectDefaultParams(effectType);
        const toneNode = createEffectInstance(effectType, initialParams);
        if (toneNode) {
            const effectData = { id: `effect-${this.track.id}-${Date.now()}`, type: effectType, toneNode, params: JSON.parse(JSON.stringify(initialParams)) };
            this.activeEffects.push(effectData);
            this.rebuildEffectChain();
            if (!isInitialLoad) {
                this.appServices.updateTrackUI?.(this.track.id, 'effectsChanged');
                this.appServices.captureStateForUndo?.(`Add ${effectDef.displayName} to ${this.track.name}`);
            }
        } else {
            console.error(`[EffectChain.js] Failed to create Tone.js instance for effect type "${effectType}".`);
        }
    }

    removeEffect(effectId) {
        const index = this.activeEffects.findIndex(e => e.id === effectId);
        if (index > -1) {
            const removedEffect = this.activeEffects.splice(index, 1)[0];
            removedEffect.toneNode?.dispose();
            this.rebuildEffectChain();
            this.appServices.updateTrackUI?.(this.track.id, 'effectsChanged');
            this.appServices.captureStateForUndo?.(`Remove ${removedEffect.type} from ${this.track.name}`);
        } else {
            console.warn(`[EffectChain.js] Effect with ID ${effectId} not found in activeEffects for track ${this.track.id}.`);
        }
    }

    updateEffectParam(effectId, paramPath, value) {
        const effect = this.activeEffects.find(e => e.id === effectId);
        if (effect?.toneNode) {
            let paramState = effect.params;
            const keys = paramPath.split('.');
            const finalKey = keys.pop();
            for (const key of keys) {
               paramState = paramState[key] = paramState[key] || {};
            }
            paramState[finalKey] = value;
            try {
                effect.toneNode.set({ [paramPath]: value });
            } catch (e) {
                console.warn(`[EffectChain.js] Could not set param ${paramPath} on effect ${effect.type}`, e);
            }
        } else {
            console.warn(`[EffectChain.js] Effect with ID ${effectId} or its ToneNode not found for track ${this.track.id}.`);
        }
    }

    rebuildEffectChain() {
    // First, ensure all current connections from the track's input are cleared.
    // This is safe even if nothing is connected.
    if (this.track.input && typeof this.track.input.disconnect === 'function') {
        this.track.input.disconnect();
    }
    let currentNode = this.track.input; // Start the chain from the track's input

    this.activeEffects.forEach(effect => {
        if (effect.toneNode) {
            // Disconnect the effect node from any previous connections it might have had.
            // This is crucial if effects are reordered or the chain is rebuilt multiple times.
            if (typeof effect.toneNode.disconnect === 'function') {
                effect.toneNode.disconnect();
            }
            // Connect the current source in the chain to the current effect node.
            currentNode.connect(effect.toneNode);
            // The current effect node becomes the new source for the next connection.
            currentNode = effect.toneNode;
        }
    });

    // Finally, connect the last node in the chain to the track's main output node.
    if (currentNode && this.track.outputNode) {
        currentNode.connect(this.track.outputNode);
    }
}

    serialize() {
        return this.activeEffects.map(e => ({ type: e.type, params: e.params }));
    }

    dispose() {
        this.activeEffects.forEach(e => e.toneNode.dispose());
        this.activeEffects = [];
        // Ensure the chain is re-established to bypass disposed effects
        this.track.input.disconnect();
        this.track.input.connect(this.track.outputNode);
    }
}