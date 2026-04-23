// js/PluginChainPresets.js - Plugin Chain Presets for SnugOS DAW
// Provides save/load of effect chain configurations with parameter snapshots

/**
 * PluginChainPresets provides:
 * - Save effect chain configurations
 * - Load presets onto tracks
 * - Parameter snapshots
 * - Preset library with built-in options
 * - Import/export preset files
 * - A/B comparison of chains
 */

/**
 * Preset categories
 */
export const PresetCategory = {
    VOCAL: 'vocal',
    DRUMS: 'drums',
    BASS: 'bass',
    GUITAR: 'guitar',
    KEYS: 'keys',
    SYNTH: 'synth',
    MASTER: 'master',
    CREATIVE: 'creative',
    UTILITY: 'utility',
    CUSTOM: 'custom'
};

/**
 * PresetTag - Tags for organizing presets
 */
export const PresetTag = {
    WARM: 'warm',
    BRIGHT: 'bright',
    VINTAGE: 'vintage',
    MODERN: 'modern',
    CLEAN: 'clean',
    HEAVY: 'heavy',
    SUBTLE: 'subtle',
    AGGRESSIVE: 'aggressive',
    SPACIOUS: 'spacious',
    TIGHT: 'tight',
    LOFI: 'lofi',
    EXPERIMENTAL: 'experimental'
};

/**
 * EffectChainPreset - A saved effect chain configuration
 */
export class EffectChainPreset {
    constructor(options = {}) {
        this.id = options.id || `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || 'Untitled Preset';
        this.category = options.category || PresetCategory.CUSTOM;
        this.description = options.description || '';
        this.tags = options.tags || [];
        
        // Effect chain data
        this.effects = options.effects || []; // Array of effect configurations
        
        // Metadata
        this.author = options.author || 'SnugOS';
        this.createdAt = options.createdAt || Date.now();
        this.modifiedAt = options.modifiedAt || Date.now();
        this.version = options.version || '1.0';
        
        // Rating and usage
        this.rating = options.rating || 0; // 0-5 stars
        this.usageCount = options.usageCount || 0;
        
        // Thumbnail (optional base64 image)
        this.thumbnail = options.thumbnail || null;
    }
    
    /**
     * Add effect to chain
     */
    addEffect(effectConfig) {
        this.effects.push({
            type: effectConfig.type,
            enabled: effectConfig.enabled !== false,
            parameters: { ...effectConfig.parameters },
            order: this.effects.length
        });
        this.modifiedAt = Date.now();
    }
    
    /**
     * Remove effect from chain
     */
    removeEffect(index) {
        if (index >= 0 && index < this.effects.length) {
            this.effects.splice(index, 1);
            // Re-order
            this.effects.forEach((e, i) => e.order = i);
            this.modifiedAt = Date.now();
        }
    }
    
    /**
     * Reorder effects
     */
    reorderEffect(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.effects.length) return;
        if (toIndex < 0 || toIndex >= this.effects.length) return;
        
        const [effect] = this.effects.splice(fromIndex, 1);
        this.effects.splice(toIndex, 0, effect);
        
        // Update order
        this.effects.forEach((e, i) => e.order = i);
        this.modifiedAt = Date.now();
    }
    
    /**
     * Get effect by type
     */
    getEffectByType(type) {
        return this.effects.find(e => e.type === type);
    }
    
    /**
     * Update effect parameters
     */
    updateEffectParameters(index, parameters) {
        if (index >= 0 && index < this.effects.length) {
            Object.assign(this.effects[index].parameters, parameters);
            this.modifiedAt = Date.now();
        }
    }
    
    /**
     * Toggle effect enabled
     */
    toggleEffect(index) {
        if (index >= 0 && index < this.effects.length) {
            this.effects[index].enabled = !this.effects[index].enabled;
            this.modifiedAt = Date.now();
        }
    }
    
    /**
     * Clone preset
     */
    clone(newName = null) {
        return new EffectChainPreset({
            name: newName || `${this.name} (Copy)`,
            category: this.category,
            description: this.description,
            tags: [...this.tags],
            effects: this.effects.map(e => ({
                type: e.type,
                enabled: e.enabled,
                parameters: { ...e.parameters },
                order: e.order
            })),
            author: this.author,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            version: this.version
        });
    }
    
    /**
     * Export as JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            category: this.category,
            description: this.description,
            tags: this.tags,
            effects: this.effects,
            author: this.author,
            createdAt: this.createdAt,
            modifiedAt: this.modifiedAt,
            version: this.version,
            rating: this.rating,
            usageCount: this.usageCount,
            thumbnail: this.thumbnail
        };
    }
    
    /**
     * Import from JSON
     */
    static fromJSON(json) {
        return new EffectChainPreset(json);
    }
}

/**
 * ChainComparison - A/B comparison of effect chains
 */
export class ChainComparison {
    constructor() {
        this.chainA = null;
        this.chainB = null;
        this.currentChain = 'A';
        this.onSwitch = null;
    }
    
    /**
     * Set chain A
     */
    setChainA(preset) {
        this.chainA = preset;
    }
    
    /**
     * Set chain B
     */
    setChainB(preset) {
        this.chainB = preset;
    }
    
    /**
     * Switch to chain A
     */
    switchToA() {
        this.currentChain = 'A';
        if (this.onSwitch) this.onSwitch(this.chainA, 'A');
    }
    
    /**
     * Switch to chain B
     */
    switchToB() {
        this.currentChain = 'B';
        if (this.onSwitch) this.onSwitch(this.chainB, 'B');
    }
    
    /**
     * Toggle between chains
     */
    toggle() {
        if (this.currentChain === 'A') {
            this.switchToB();
        } else {
            this.switchToA();
        }
    }
    
    /**
     * Get current chain
     */
    getCurrentChain() {
        return this.currentChain === 'A' ? this.chainA : this.chainB;
    }
    
    /**
     * Get current chain name
     */
    getCurrentChainName() {
        const chain = this.getCurrentChain();
        return chain ? chain.name : 'None';
    }
}

/**
 * PluginChainPresetManager - Main manager for presets
 */
export class PluginChainPresetManager {
    constructor(appServices) {
        this.appServices = appServices;
        
        // Preset storage
        this.presets = new Map(); // id -> EffectChainPreset
        this.userPresets = new Map();
        
        // Comparison
        this.comparison = new ChainComparison();
        
        // Built-in presets
        this.builtInPresets = [];
        
        // Recent presets
        this.recentPresets = [];
        this.maxRecent = 10;
        
        // Initialize built-in presets
        this.initializeBuiltInPresets();
    }
    
    /**
     * Initialize built-in presets
     */
    initializeBuiltInPresets() {
        // Vocal presets
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Vocal Warm',
            category: PresetCategory.VOCAL,
            description: 'Warm, intimate vocal sound with gentle compression',
            tags: [PresetTag.WARM, PresetTag.CLEAN],
            effects: [
                { type: 'EQ', enabled: true, parameters: { lowCut: 80, highShelf: 0, midGain: -2, midFreq: 300, highGain: 2 } },
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -20, ratio: 3, attack: 10, release: 100, makeup: 2 } },
                { type: 'REVERB', enabled: true, parameters: { decay: 1.5, wet: 0.2, dry: 1, preDelay: 20 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Vocal Bright',
            category: PresetCategory.VOCAL,
            description: 'Bright, present vocal with air and sparkle',
            tags: [PresetTag.BRIGHT, PresetTag.MODERN],
            effects: [
                { type: 'EQ', enabled: true, parameters: { lowCut: 100, highShelf: 3, highGain: 4 } },
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -18, ratio: 4, attack: 5, release: 80, makeup: 3 } },
                { type: 'DELAY', enabled: true, parameters: { time: 0.25, feedback: 0.2, wet: 0.15, dry: 1 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Vocal Radio',
            category: PresetCategory.VOCAL,
            description: 'Classic radio-ready vocal chain',
            tags: [PresetTag.CLEAN, PresetTag.MODERN],
            effects: [
                { type: 'EQ', enabled: true, parameters: { lowCut: 150, highCut: 12000, midGain: 3, midFreq: 2000 } },
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -15, ratio: 6, attack: 3, release: 50, makeup: 4 } },
                { type: 'LIMITER', enabled: true, parameters: { threshold: -1, ceiling: -0.5 } }
            ],
            author: 'SnugOS'
        }));
        
        // Drum presets
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Drums Punchy',
            category: PresetCategory.DRUMS,
            description: 'Tight, punchy drum bus processing',
            tags: [PresetTag.TIGHT, PresetTag.AGGRESSIVE],
            effects: [
                { type: 'EQ', enabled: true, parameters: { lowCut: 30, highShelf: 2, lowGain: 2 } },
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -12, ratio: 4, attack: 15, release: 50, makeup: 3 } },
                { type: 'TRANSIENT_SHAPER', enabled: true, parameters: { attack: 1.3, sustain: 0.8 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Drums Glue',
            category: PresetCategory.DRUMS,
            description: 'Glued, cohesive drum sound',
            tags: [PresetTag.WARM, PresetTag.SUBTLE],
            effects: [
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -8, ratio: 2, attack: 30, release: 200, makeup: 2 } },
                { type: 'EQ', enabled: true, parameters: { lowGain: 1, highShelf: 1 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Drums Lo-Fi',
            category: PresetCategory.DRUMS,
            description: 'Vintage lo-fi drum character',
            tags: [PresetTag.LOFI, PresetTag.VINTAGE],
            effects: [
                { type: 'EQ', enabled: true, parameters: { lowCut: 200, highCut: 6000, midGain: 4, midFreq: 1000 } },
                { type: 'BITCRUSHER', enabled: true, parameters: { bits: 8, downsample: 2 } },
                { type: 'DISTORTION', enabled: true, parameters: { drive: 0.3, mix: 0.3 } }
            ],
            author: 'SnugOS'
        }));
        
        // Bass presets
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Bass Solid',
            category: PresetCategory.BASS,
            description: 'Solid, controlled bass foundation',
            tags: [PresetTag.TIGHT, PresetTag.CLEAN],
            effects: [
                { type: 'EQ', enabled: true, parameters: { lowCut: 20, lowGain: 2, highCut: 8000 } },
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -10, ratio: 4, attack: 20, release: 100, makeup: 2 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Bass Saturation',
            category: PresetCategory.BASS,
            description: 'Warm, saturated bass tone',
            tags: [PresetTag.WARM, PresetTag.HEAVY],
            effects: [
                { type: 'EQ', enabled: true, parameters: { lowGain: 3, midGain: 2, midFreq: 200 } },
                { type: 'SATURATION', enabled: true, parameters: { drive: 0.5, mix: 0.4 } },
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -8, ratio: 3, attack: 15, release: 80 } }
            ],
            author: 'SnugOS'
        }));
        
        // Guitar presets
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Guitar Clean',
            category: PresetCategory.GUITAR,
            description: 'Clean, sparkling guitar tone',
            tags: [PresetTag.CLEAN, PresetTag.BRIGHT],
            effects: [
                { type: 'EQ', enabled: true, parameters: { lowCut: 80, highShelf: 2 } },
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -15, ratio: 2.5, attack: 10, release: 150 } },
                { type: 'CHORUS', enabled: true, parameters: { rate: 0.5, depth: 0.3, mix: 0.2 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Guitar Crunch',
            category: PresetCategory.GUITAR,
            description: 'Crunchy overdriven guitar',
            tags: [PresetTag.AGGRESSIVE, PresetTag.HEAVY],
            effects: [
                { type: 'DISTORTION', enabled: true, parameters: { drive: 0.6, mix: 0.7 } },
                { type: 'EQ', enabled: true, parameters: { lowCut: 100, midGain: -3, midFreq: 800, highGain: 2 } },
                { type: 'DELAY', enabled: true, parameters: { time: 0.3, feedback: 0.3, wet: 0.2 } }
            ],
            author: 'SnugOS'
        }));
        
        // Synth presets
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Synth Wide',
            category: PresetCategory.SYNTH,
            description: 'Wide, spacious synth sound',
            tags: [PresetTag.SPACIOUS, PresetTag.MODERN],
            effects: [
                { type: 'CHORUS', enabled: true, parameters: { rate: 0.3, depth: 0.5, mix: 0.4 } },
                { type: 'REVERB', enabled: true, parameters: { decay: 2.5, wet: 0.35, preDelay: 30 } },
                { type: 'DELAY', enabled: true, parameters: { time: 0.5, feedback: 0.4, wet: 0.2 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Synth Aggressive',
            category: PresetCategory.SYNTH,
            description: 'Aggressive, distorted synth',
            tags: [PresetTag.AGGRESSIVE, PresetTag.HEAVY],
            effects: [
                { type: 'DISTORTION', enabled: true, parameters: { drive: 0.7, mix: 0.5 } },
                { type: 'EQ', enabled: true, parameters: { lowGain: 4, midGain: -2, midFreq: 1000, highGain: 3 } },
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -10, ratio: 8, attack: 1, release: 50, makeup: 4 } }
            ],
            author: 'SnugOS'
        }));
        
        // Master presets
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Master Gentle',
            category: PresetCategory.MASTER,
            description: 'Gentle master bus processing',
            tags: [PresetTag.SUBTLE, PresetTag.CLEAN],
            effects: [
                { type: 'EQ', enabled: true, parameters: { lowShelf: 1, highShelf: 1 } },
                { type: 'COMPRESSOR', enabled: true, parameters: { threshold: -3, ratio: 1.5, attack: 30, release: 300 } },
                { type: 'LIMITER', enabled: true, parameters: { threshold: -1, ceiling: -0.3 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Master Loud',
            category: PresetCategory.MASTER,
            description: 'Loud, competitive master',
            tags: [PresetTag.MODERN, PresetTag.HEAVY],
            effects: [
                { type: 'MULTIBAND_COMPRESSOR', enabled: true, parameters: { lowThreshold: -6, midThreshold: -8, highThreshold: -10 } },
                { type: 'LIMITER', enabled: true, parameters: { threshold: -3, ceiling: -0.1, release: 100 } }
            ],
            author: 'SnugOS'
        }));
        
        // Creative presets
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Creative Reverse',
            category: PresetCategory.CREATIVE,
            description: 'Reverse reverb effect',
            tags: [PresetTag.EXPERIMENTAL, PresetTag.SPACIOUS],
            effects: [
                { type: 'REVERB', enabled: true, parameters: { decay: 3, wet: 1, dry: 0, reverse: true } },
                { type: 'EQ', enabled: true, parameters: { highCut: 8000, lowGain: -6 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Creative Lo-Fi',
            category: PresetCategory.CREATIVE,
            description: 'Extreme lo-fi character',
            tags: [PresetTag.LOFI, PresetTag.VINTAGE],
            effects: [
                { type: 'BITCRUSHER', enabled: true, parameters: { bits: 6, downsample: 4 } },
                { type: 'EQ', enabled: true, parameters: { lowCut: 300, highCut: 4000, midGain: 6, midFreq: 2000 } },
                { type: 'DISTORTION', enabled: true, parameters: { drive: 0.4, mix: 0.5 } },
                { type: 'FLANGER', enabled: true, parameters: { rate: 0.1, depth: 0.8, mix: 0.3 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Creative Space',
            category: PresetCategory.CREATIVE,
            description: 'Vast, ambient space',
            tags: [PresetTag.SPACIOUS, PresetTag.EXPERIMENTAL],
            effects: [
                { type: 'REVERB', enabled: true, parameters: { decay: 5, wet: 0.7, preDelay: 100, size: 100 } },
                { type: 'DELAY', enabled: true, parameters: { time: 0.75, feedback: 0.6, wet: 0.4 } },
                { type: 'CHORUS', enabled: true, parameters: { rate: 0.1, depth: 0.6, mix: 0.3 } }
            ],
            author: 'SnugOS'
        }));
        
        // Utility presets
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Utility De-Ess',
            category: PresetCategory.UTILITY,
            description: 'De-esser for sibilant control',
            tags: [PresetTag.CLEAN, PresetTag.SUBTLE],
            effects: [
                { type: 'DEESSER', enabled: true, parameters: { threshold: -30, frequency: 6000, ratio: 4 } }
            ],
            author: 'SnugOS'
        }));
        
        this.builtInPresets.push(new EffectChainPreset({
            name: 'Utility Gate',
            category: PresetCategory.UTILITY,
            description: 'Noise gate for clean recordings',
            tags: [PresetTag.CLEAN, PresetTag.TIGHT],
            effects: [
                { type: 'GATE', enabled: true, parameters: { threshold: -40, attack: 0.5, release: 50, range: -60 } }
            ],
            author: 'SnugOS'
        }));
        
        // Add all built-in presets to map
        for (const preset of this.builtInPresets) {
            this.presets.set(preset.id, preset);
        }
    }
    
    /**
     * Get all presets
     */
    getAllPresets() {
        return Array.from(this.presets.values());
    }
    
    /**
     * Get presets by category
     */
    getPresetsByCategory(category) {
        return this.getAllPresets().filter(p => p.category === category);
    }
    
    /**
     * Get presets by tag
     */
    getPresetsByTag(tag) {
        return this.getAllPresets().filter(p => p.tags.includes(tag));
    }
    
    /**
     * Get preset by ID
     */
    getPreset(id) {
        return this.presets.get(id);
    }
    
    /**
     * Search presets
     */
    searchPresets(query) {
        const lowerQuery = query.toLowerCase();
        
        return this.getAllPresets().filter(p => 
            p.name.toLowerCase().includes(lowerQuery) ||
            p.description.toLowerCase().includes(lowerQuery) ||
            p.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
            p.category.toLowerCase().includes(lowerQuery)
        );
    }
    
    /**
     * Save preset
     */
    savePreset(preset) {
        preset.modifiedAt = Date.now();
        this.presets.set(preset.id, preset);
        this.userPresets.set(preset.id, preset);
        
        // Add to recent
        this.addToRecent(preset.id);
        
        console.log(`[PluginChainPresets] Saved preset: ${preset.name}`);
        
        return preset;
    }
    
    /**
     * Create new preset from track effects
     */
    createPresetFromTrack(track, name, category = PresetCategory.CUSTOM) {
        const preset = new EffectChainPreset({
            name,
            category,
            author: 'User',
            effects: []
        });
        
        // Extract effects from track
        if (track.effects) {
            for (const effect of track.effects) {
                preset.addEffect({
                    type: effect.type,
                    enabled: effect.enabled !== false,
                    parameters: { ...effect.parameters }
                });
            }
        }
        
        return this.savePreset(preset);
    }
    
    /**
     * Delete preset
     */
    deletePreset(id) {
        // Don't delete built-in presets
        const preset = this.presets.get(id);
        
        if (!preset) return false;
        
        if (this.builtInPresets.some(p => p.id === id)) {
            console.warn('[PluginChainPresets] Cannot delete built-in preset');
            return false;
        }
        
        this.presets.delete(id);
        this.userPresets.delete(id);
        
        console.log(`[PluginChainPresets] Deleted preset: ${preset.name}`);
        
        return true;
    }
    
    /**
     * Apply preset to track
     */
    applyPresetToTrack(presetId, track) {
        const preset = this.getPreset(presetId);
        
        if (!preset) {
            console.error('[PluginChainPresets] Preset not found');
            return false;
        }
        
        // Clear existing effects
        if (track.clearEffects) {
            track.clearEffects();
        }
        
        // Apply each effect from preset
        for (const effect of preset.effects) {
            if (track.addEffect) {
                track.addEffect(effect.type, effect.parameters);
            }
        }
        
        // Update usage count
        preset.usageCount++;
        
        // Add to recent
        this.addToRecent(presetId);
        
        console.log(`[PluginChainPresets] Applied preset "${preset.name}" to track`);
        
        return true;
    }
    
    /**
     * Add to recent presets
     */
    addToRecent(presetId) {
        // Remove if already exists
        const index = this.recentPresets.indexOf(presetId);
        if (index !== -1) {
            this.recentPresets.splice(index, 1);
        }
        
        // Add to front
        this.recentPresets.unshift(presetId);
        
        // Limit size
        if (this.recentPresets.length > this.maxRecent) {
            this.recentPresets.pop();
        }
    }
    
    /**
     * Get recent presets
     */
    getRecentPresets() {
        return this.recentPresets
            .map(id => this.presets.get(id))
            .filter(p => p !== undefined);
    }
    
    /**
     * Export preset as JSON
     */
    exportPreset(id) {
        const preset = this.getPreset(id);
        
        if (!preset) return null;
        
        return JSON.stringify(preset.toJSON(), null, 2);
    }
    
    /**
     * Export all user presets
     */
    exportAllUserPresets() {
        const presets = Array.from(this.userPresets.values()).map(p => p.toJSON());
        
        return JSON.stringify({
            version: '1.0',
            exportedAt: Date.now(),
            presets
        }, null, 2);
    }
    
    /**
     * Import preset from JSON
     */
    importPreset(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const preset = EffectChainPreset.fromJSON(data);
            
            // Generate new ID to avoid conflicts
            preset.id = `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            return this.savePreset(preset);
        } catch (err) {
            console.error('[PluginChainPresets] Failed to import preset:', err);
            return null;
        }
    }
    
    /**
     * Import multiple presets
     */
    importPresets(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            const imported = [];
            
            for (const presetData of data.presets || []) {
                const preset = EffectChainPreset.fromJSON(presetData);
                preset.id = `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                
                this.savePreset(preset);
                imported.push(preset);
            }
            
            console.log(`[PluginChainPresets] Imported ${imported.length} presets`);
            
            return imported;
        } catch (err) {
            console.error('[PluginChainPresets] Failed to import presets:', err);
            return [];
        }
    }
    
    /**
     * Get comparison object
     */
    getComparison() {
        return this.comparison;
    }
    
    /**
     * Start A/B comparison
     */
    startComparison(presetIdA, presetIdB) {
        const presetA = this.getPreset(presetIdA);
        const presetB = this.getPreset(presetIdB);
        
        if (!presetA || !presetB) {
            console.error('[PluginChainPresets] Presets not found for comparison');
            return false;
        }
        
        this.comparison.setChainA(presetA);
        this.comparison.setChainB(presetB);
        this.comparison.switchToA();
        
        return true;
    }
    
    /**
     * Get categories list
     */
    getCategories() {
        return Object.values(PresetCategory);
    }
    
    /**
     * Get tags list
     */
    getTags() {
        return Object.values(PresetTag);
    }
    
    /**
     * Rate a preset
     */
    ratePreset(id, rating) {
        const preset = this.getPreset(id);
        
        if (!preset) return false;
        
        preset.rating = Math.max(0, Math.min(5, rating));
        preset.modifiedAt = Date.now();
        
        return true;
    }
    
    /**
     * Get top-rated presets
     */
    getTopRated(limit = 10) {
        return this.getAllPresets()
            .filter(p => p.rating > 0)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, limit);
    }
    
    /**
     * Get most used presets
     */
    getMostUsed(limit = 10) {
        return this.getAllPresets()
            .filter(p => p.usageCount > 0)
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, limit);
    }
}

/**
 * Create a PluginChainPresetManager instance
 */
export function createPluginChainPresetManager(appServices) {
    return new PluginChainPresetManager(appServices);
}

// Default export
export default {
    PresetCategory,
    PresetTag,
    EffectChainPreset,
    ChainComparison,
    PluginChainPresetManager,
    createPluginChainPresetManager
};