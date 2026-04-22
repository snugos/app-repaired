// js/PluginSystem.js - Plugin System Foundation for SnugOS DAW
// This module provides the foundation for VST/AU plugin support via WebAssembly/AudioWorklet

/**
 * PluginParameter - Represents a single plugin parameter
 */
export class PluginParameter {
    constructor(config = {}) {
        this.id = config.id || `param-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.name = config.name || 'Unnamed Parameter';
        this.type = config.type || 'float'; // 'float', 'int', 'boolean', 'enum', 'string'
        this.value = config.value !== undefined ? config.value : config.defaultValue !== undefined ? config.defaultValue : 0;
        this.defaultValue = config.defaultValue !== undefined ? config.defaultValue : this.value;
        this.minValue = config.minValue !== undefined ? config.minValue : 0;
        this.maxValue = config.maxValue !== undefined ? config.maxValue : 1;
        this.enumValues = config.enumValues || []; // For 'enum' type
        this.unit = config.unit || ''; // e.g., 'Hz', 'dB', '%', 'ms'
        this.automatable = config.automatable !== undefined ? config.automatable : true;
        this.hidden = config.hidden || false;
        this.group = config.group || ''; // Parameter group for UI organization
    }

    /**
     * Set the parameter value with clamping
     * @param {number} value - New value
     */
    setValue(value) {
        if (this.type === 'boolean') {
            this.value = Boolean(value);
        } else if (this.type === 'enum') {
            const idx = Math.floor(value);
            this.value = this.enumValues[idx] !== undefined ? idx : 0;
        } else if (this.type === 'int') {
            this.value = Math.max(this.minValue, Math.min(this.maxValue, Math.round(value)));
        } else {
            this.value = Math.max(this.minValue, Math.min(this.maxValue, parseFloat(value) || 0));
        }
    }

    /**
     * Get normalized value (0-1)
     * @returns {number} Normalized value
     */
    getNormalizedValue() {
        if (this.type === 'boolean') {
            return this.value ? 1 : 0;
        } else if (this.type === 'enum') {
            return this.enumValues.length > 1 ? this.value / (this.enumValues.length - 1) : 0;
        }
        const range = this.maxValue - this.minValue;
        return range > 0 ? (this.value - this.minValue) / range : 0;
    }

    /**
     * Set value from normalized (0-1)
     * @param {number} normalized - Normalized value (0-1)
     */
    setFromNormalized(normalized) {
        if (this.type === 'boolean') {
            this.value = normalized >= 0.5;
        } else if (this.type === 'enum') {
            this.value = Math.round(normalized * (this.enumValues.length - 1));
        } else {
            const range = this.maxValue - this.minValue;
            this.value = this.minValue + normalized * range;
        }
    }

    /**
     * Serialize parameter to JSON
     * @returns {Object} Serialized data
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            value: this.value,
            defaultValue: this.defaultValue,
            minValue: this.minValue,
            maxValue: this.maxValue,
            enumValues: this.enumValues,
            unit: this.unit,
            automatable: this.automatable,
            hidden: this.hidden,
            group: this.group
        };
    }

    /**
     * Create parameter from JSON
     * @param {Object} data - Serialized data
     * @returns {PluginParameter} New parameter instance
     */
    static fromJSON(data) {
        return new PluginParameter(data);
    }
}

/**
 * PluginPreset - Represents a plugin preset
 */
export class PluginPreset {
    constructor(config = {}) {
        this.id = config.id || `preset-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.name = config.name || 'Default Preset';
        this.author = config.author || 'Unknown';
        this.category = config.category || 'User';
        this.parameters = config.parameters || {};
        this.tags = config.tags || [];
        this.createdAt = config.createdAt || Date.now();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            author: this.author,
            category: this.category,
            parameters: JSON.parse(JSON.stringify(this.parameters)),
            tags: this.tags,
            createdAt: this.createdAt
        };
    }

    static fromJSON(data) {
        return new PluginPreset(data);
    }
}

/**
 * PluginInterface - Abstract base class for all plugins
 * All plugin implementations must extend this class
 */
export class PluginInterface {
    constructor(config = {}) {
        this.id = config.id || `plugin-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.name = config.name || 'Unknown Plugin';
        this.vendor = config.vendor || 'Unknown';
        this.version = config.version || '1.0.0';
        this.category = config.category || 'effect'; // 'effect', 'instrument', 'analyzer', 'utility'
        this.audioNode = null; // The actual WebAudio node
        this.parameters = new Map(); // Map of parameter ID -> PluginParameter
        this.presets = [];
        this.currentPresetId = null;
        this.isEnabled = true;
        this.latency = 0; // Reported latency in samples
        this.state = 'uninitialized'; // 'uninitialized', 'ready', 'error'
    }

    /**
     * Initialize the plugin - must be implemented by subclasses
     * @param {AudioContext} context - The audio context
     * @returns {Promise<boolean>} True if initialization successful
     */
    async initialize(context) {
        throw new Error('PluginInterface.initialize() must be implemented by subclass');
    }

    /**
     * Get all parameters
     * @returns {PluginParameter[]} Array of parameters
     */
    getParameters() {
        return Array.from(this.parameters.values());
    }

    /**
     * Get a parameter by ID
     * @param {string} paramId - Parameter ID
     * @returns {PluginParameter|null} Parameter or null
     */
    getParameter(paramId) {
        return this.parameters.get(paramId) || null;
    }

    /**
     * Set a parameter value
     * @param {string} paramId - Parameter ID
     * @param {number} value - New value
     * @param {number} [time] - Audio context time for scheduling
     */
    setParameter(paramId, value, time) {
        const param = this.parameters.get(paramId);
        if (param) {
            param.setValue(value);
            this._applyParameterToAudioNode(paramId, param.value, time);
        }
    }

    /**
     * Apply parameter change to the underlying audio node - must be implemented by subclasses
     * @param {string} paramId - Parameter ID
     * @param {number} value - Parameter value
     * @param {number} [time] - Audio context time
     */
    _applyParameterToAudioNode(paramId, value, time) {
        // Default implementation - subclasses should override
        console.warn(`PluginInterface._applyParameterToAudioNode() not implemented for ${paramId}`);
    }

    /**
     * Get the audio node for connection
     * @returns {AudioNode|null} The audio node
     */
    getAudioNode() {
        return this.audioNode;
    }

    /**
     * Connect this plugin to another audio node
     * @param {AudioNode} destination - Destination node
     * @returns {AudioNode} The destination node
     */
    connect(destination) {
        if (this.audioNode) {
            return this.audioNode.connect(destination);
        }
        console.warn(`[Plugin ${this.id}] Cannot connect: no audio node`);
        return destination;
    }

    /**
     * Disconnect from all destinations
     */
    disconnect() {
        if (this.audioNode) {
            this.audioNode.disconnect();
        }
    }

    /**
     * Enable the plugin
     */
    enable() {
        this.isEnabled = true;
        // Subclasses should override to restore audio processing
    }

    /**
     * Disable/bypass the plugin
     */
    disable() {
        this.isEnabled = false;
        // Subclasses should override to bypass audio processing
    }

    /**
     * Get current latency in samples
     * @returns {number} Latency in samples
     */
    getLatency() {
        return this.latency;
    }

    /**
     * Get current latency in seconds
     * @param {number} sampleRate - Sample rate
     * @returns {number} Latency in seconds
     */
    getLatencySeconds(sampleRate = 44100) {
        return this.latency / sampleRate;
    }

    /**
     * Save current state as a preset
     * @param {string} name - Preset name
     * @returns {PluginPreset} The created preset
     */
    savePreset(name) {
        const parameters = {};
        this.parameters.forEach((param, id) => {
            parameters[id] = param.value;
        });

        const preset = new PluginPreset({
            name: name,
            parameters: parameters
        });

        this.presets.push(preset);
        return preset;
    }

    /**
     * Load a preset
     * @param {string} presetId - Preset ID
     */
    loadPreset(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        if (preset) {
            Object.entries(preset.parameters).forEach(([paramId, value]) => {
                this.setParameter(paramId, value);
            });
            this.currentPresetId = presetId;
        }
    }

    /**
     * Delete a preset
     * @param {string} presetId - Preset ID
     */
    deletePreset(presetId) {
        const index = this.presets.findIndex(p => p.id === presetId);
        if (index >= 0) {
            this.presets.splice(index, 1);
            if (this.currentPresetId === presetId) {
                this.currentPresetId = null;
            }
        }
    }

    /**
     * Serialize plugin state to JSON
     * @returns {Object} Serialized state
     */
    toJSON() {
        const parameters = {};
        this.parameters.forEach((param, id) => {
            parameters[id] = param.toJSON();
        });

        return {
            id: this.id,
            name: this.name,
            vendor: this.vendor,
            version: this.version,
            category: this.category,
            parameters: parameters,
            presets: this.presets.map(p => p.toJSON()),
            currentPresetId: this.currentPresetId,
            isEnabled: this.isEnabled,
            state: this.state
        };
    }

    /**
     * Restore plugin state from JSON
     * @param {Object} data - Serialized state
     */
    fromJSON(data) {
        this.id = data.id || this.id;
        this.name = data.name || this.name;
        this.vendor = data.vendor || this.vendor;
        this.version = data.version || this.version;
        this.category = data.category || this.category;
        this.isEnabled = data.isEnabled !== undefined ? data.isEnabled : true;
        this.currentPresetId = data.currentPresetId || null;

        // Restore parameters
        if (data.parameters) {
            Object.entries(data.parameters).forEach(([id, paramData]) => {
                const existingParam = this.parameters.get(id);
                if (existingParam && paramData.value !== undefined) {
                    existingParam.setValue(paramData.value);
                }
            });
        }

        // Restore presets
        if (data.presets) {
            this.presets = data.presets.map(p => PluginPreset.fromJSON(p));
        }

        this.state = data.state || 'ready';
    }

    /**
     * Dispose of the plugin and free resources
     */
    dispose() {
        if (this.audioNode) {
            this.disconnect();
            if (typeof this.audioNode.disconnect === 'function') {
                try { this.audioNode.disconnect(); } catch (e) { /* ignore */ }
            }
        }
        this.audioNode = null;
        this.parameters.clear();
        this.presets = [];
        this.state = 'disposed';
    }
}

/**
 * PluginManager - Manages all plugins in the system
 */
export class PluginManager {
    constructor() {
        this.plugins = new Map(); // Map of plugin ID -> PluginInterface
        this.pluginClasses = new Map(); // Map of plugin type -> Class
        this.audioContext = null;
        this.initialized = false;
    }

    /**
     * Initialize the plugin manager
     * @param {AudioContext} context - The audio context
     */
    async initialize(context) {
        this.audioContext = context;
        this.initialized = true;
        console.log('[PluginManager] Initialized');
    }

    /**
     * Register a plugin class
     * @param {string} type - Plugin type identifier
     * @param {class} pluginClass - Plugin class (must extend PluginInterface)
     */
    registerPluginClass(type, pluginClass) {
        this.pluginClasses.set(type, pluginClass);
        console.log(`[PluginManager] Registered plugin class: ${type}`);
    }

    /**
     * Create a new plugin instance
     * @param {string} type - Plugin type
     * @param {Object} config - Plugin configuration
     * @returns {Promise<PluginInterface|null>} Plugin instance or null
     */
    async createPlugin(type, config = {}) {
        const PluginClass = this.pluginClasses.get(type);
        if (!PluginClass) {
            console.error(`[PluginManager] Unknown plugin type: ${type}`);
            return null;
        }

        try {
            const plugin = new PluginClass(config);
            await plugin.initialize(this.audioContext);
            this.plugins.set(plugin.id, plugin);
            console.log(`[PluginManager] Created plugin: ${plugin.name} (${plugin.id})`);
            return plugin;
        } catch (e) {
            console.error(`[PluginManager] Failed to create plugin ${type}:`, e);
            return null;
        }
    }

    /**
     * Get a plugin by ID
     * @param {string} pluginId - Plugin ID
     * @returns {PluginInterface|undefined} Plugin instance
     */
    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }

    /**
     * Get all plugins
     * @returns {PluginInterface[]} Array of plugins
     */
    getAllPlugins() {
        return Array.from(this.plugins.values());
    }

    /**
     * Get plugins by category
     * @param {string} category - Plugin category
     * @returns {PluginInterface[]} Array of plugins
     */
    getPluginsByCategory(category) {
        return this.getAllPlugins().filter(p => p.category === category);
    }

    /**
     * Remove a plugin
     * @param {string} pluginId - Plugin ID
     */
    removePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            plugin.dispose();
            this.plugins.delete(pluginId);
            console.log(`[PluginManager] Removed plugin: ${pluginId}`);
        }
    }

    /**
     * Dispose of all plugins
     */
    disposeAll() {
        this.plugins.forEach(plugin => plugin.dispose());
        this.plugins.clear();
        console.log('[PluginManager] Disposed all plugins');
    }

    /**
     * Get list of available plugin types
     * @returns {string[]} Array of plugin type names
     */
    getAvailablePluginTypes() {
        return Array.from(this.pluginClasses.keys());
    }

    /**
     * Serialize all plugin states
     * @returns {Object[]} Array of serialized plugin states
     */
    serializeAll() {
        return this.getAllPlugins().map(p => p.toJSON());
    }

    /**
     * Restore plugins from serialized states
     * @param {Object[]} states - Array of serialized plugin states
     */
    async deserializeAll(states) {
        if (!Array.isArray(states)) return;

        for (const state of states) {
            const plugin = await this.createPlugin(state.type || 'unknown', state);
            if (plugin) {
                plugin.fromJSON(state);
            }
        }
    }
}

// Create singleton instance
export const pluginManager = new PluginManager();

/**
 * AudioWorkletPlugin - Base class for AudioWorklet-based plugins
 * This allows loading custom DSP code in a separate thread
 */
export class AudioWorkletPlugin extends PluginInterface {
    constructor(config = {}) {
        super(config);
        this.workletPath = config.workletPath || '';
        this.workletName = config.workletName || '';
        this.workletNode = null;
    }

    async initialize(context) {
        if (!this.workletPath || !this.workletName) {
            console.error(`[AudioWorkletPlugin] Missing workletPath or workletName`);
            this.state = 'error';
            return false;
        }

        try {
            // Register the AudioWorklet module
            await context.audioWorklet.addModule(this.workletPath);
            
            // Create the AudioWorkletNode
            this.workletNode = new AudioWorkletNode(context, this.workletName, {
                processorOptions: this._getProcessorOptions()
            });
            
            this.audioNode = this.workletNode;

            // Set up parameter ports
            this._setupParameterPorts();
            
            // Handle messages from the worklet
            this.workletNode.port.onmessage = (event) => {
                this._handleWorkletMessage(event.data);
            };

            this.state = 'ready';
            console.log(`[AudioWorkletPlugin] Initialized: ${this.name}`);
            return true;
        } catch (e) {
            console.error(`[AudioWorkletPlugin] Failed to initialize:`, e);
            this.state = 'error';
            return false;
        }
    }

    /**
     * Get processor options for AudioWorklet initialization
     * Override in subclasses to pass custom options
     * @returns {Object} Processor options
     */
    _getProcessorOptions() {
        return {};
    }

    /**
     * Set up parameter ports for automation
     * Override in subclasses
     */
    _setupParameterPorts() {
        // Subclasses should set up parameter connections here
    }

    /**
     * Handle messages from the AudioWorklet
     * @param {Object} data - Message data
     */
    _handleWorkletMessage(data) {
        if (data.type === 'latency') {
            this.latency = data.value;
        } else if (data.type === 'parameter') {
            const param = this.parameters.get(data.paramId);
            if (param) {
                param.value = data.value;
            }
        } else if (data.type === 'error') {
            console.error(`[AudioWorkletPlugin] Worklet error:`, data.message);
            this.state = 'error';
        }
    }

    /**
     * Send a message to the AudioWorklet
     * @param {Object} data - Message data
     */
    sendToWorklet(data) {
        if (this.workletNode && this.workletNode.port) {
            this.workletNode.port.postMessage(data);
        }
    }

    _applyParameterToAudioNode(paramId, value, time) {
        // AudioWorklet parameters can be automated via the parameters property
        if (this.workletNode && this.workletNode.parameters) {
            const param = this.workletNode.parameters.get(paramId);
            if (param) {
                const audioTime = time !== undefined ? time : this.audioContext?.currentTime || 0;
                param.setValueAtTime(value, audioTime);
            } else {
                // Send via port if not an automatable parameter
                this.sendToWorklet({ type: 'parameter', paramId, value });
            }
        }
    }

    dispose() {
        this.sendToWorklet({ type: 'dispose' });
        super.dispose();
        this.workletNode = null;
    }
}

// Export a factory function for creating plugin instances
export function createPlugin(type, config) {
    return pluginManager.createPlugin(type, config);
}

// Default export
export default {
    PluginParameter,
    PluginPreset,
    PluginInterface,
    PluginManager,
    AudioWorkletPlugin,
    pluginManager,
    createPlugin
};