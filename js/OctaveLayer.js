/**
 * Octave Layer - Add octave-up and octave-down layers to MIDI instrument tracks
 * Allows stacking multiple octave-shifted voices for richer sound
 */

class OctaveLayer {
    constructor() {
        this.layers = {
            main: { enabled: true, offset: 0, volume: 1.0 },
            octaveUp: { enabled: false, offset: 12, volume: 0.7 },
            octaveDown: { enabled: false, offset: -12, volume: 0.7 },
            octaveUp2: { enabled: false, offset: 24, volume: 0.5 },
            octaveDown2: { enabled: false, offset: -24, volume: 0.5 }
        };
        this.masterVolume = 1.0;
    }
    
    /**
     * Enable/disable a specific octave layer
     */
    setLayerEnabled(layerName, enabled) {
        if (this.layers[layerName] !== undefined) {
            this.layers[layerName].enabled = enabled;
            return true;
        }
        return false;
    }
    
    /**
     * Get whether a layer is enabled
     */
    isLayerEnabled(layerName) {
        return this.layers[layerName]?.enabled || false;
    }
    
    /**
     * Set volume for a specific layer
     */
    setLayerVolume(layerName, volume) {
        if (this.layers[layerName] !== undefined) {
            this.layers[layerName].volume = Math.max(0, Math.min(1, volume));
            return true;
        }
        return false;
    }
    
    /**
     * Get volume for a layer
     */
    getLayerVolume(layerName) {
        return this.layers[layerName]?.volume || 0;
    }
    
    /**
     * Get octave offset for a layer
     */
    getLayerOffset(layerName) {
        return this.layers[layerName]?.offset || 0;
    }
    
    /**
     * Get all active layers (enabled ones)
     */
    getActiveLayers() {
        return Object.entries(this.layers)
            .filter(([name, layer]) => layer.enabled)
            .map(([name, layer]) => ({ name, offset: layer.offset, volume: layer.volume }));
    }
    
    /**
     * Transpose a MIDI note through all active octave layers
     * Returns array of {note, velocity, layer} objects
     */
    processNote(note, velocity = 127) {
        const activeLayers = this.getActiveLayers();
        const results = [];
        
        for (const layer of activeLayers) {
            const transposedNote = Math.max(0, Math.min(127, note + layer.offset));
            const scaledVelocity = Math.round(velocity * layer.volume * this.masterVolume);
            
            if (scaledVelocity > 0) {
                results.push({
                    note: transposedNote,
                    velocity: scaledVelocity,
                    layer: layer.name
                });
            }
        }
        
        return results;
    }
    
    /**
     * Set master volume
     */
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
    
    /**
     * Get master volume
     */
    getMasterVolume() {
        return this.masterVolume;
    }
    
    /**
     * Enable all octave layers
     */
    enableAllOctaves() {
        Object.keys(this.layers).forEach(name => {
            if (name !== 'main') this.layers[name].enabled = true;
        });
    }
    
    /**
     * Disable all octave layers
     */
    disableAllOctaves() {
        Object.keys(this.layers).forEach(name => {
            if (name !== 'main') this.layers[name].enabled = false;
        });
    }
    
    /**
     * Get configuration for serialization
     */
    getConfig() {
        return {
            layers: JSON.parse(JSON.stringify(this.layers)),
            masterVolume: this.masterVolume
        };
    }
    
    /**
     * Load configuration
     */
    loadConfig(config) {
        if (config.layers) {
            this.layers = JSON.parse(JSON.stringify(config.layers));
        }
        if (config.masterVolume !== undefined) {
            this.masterVolume = config.masterVolume;
        }
    }
    
    /**
     * Get status summary
     */
    getStatus() {
        const active = this.getActiveLayers();
        return {
            totalLayers: active.length,
            activeLayers: active.map(l => l.name),
            masterVolume: this.masterVolume
        };
    }
}

/**
 * Create OctaveLayer instance
 */
function createOctaveLayer() {
    return new OctaveLayer();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OctaveLayer, createOctaveLayer };
}