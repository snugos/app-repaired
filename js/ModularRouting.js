/**
 * js/ModularRouting.js - User-Configurable Signal Routing System
 * 
 * Provides a modular routing interface for creating custom signal paths
 * between tracks, effects buses, and outputs.
 */

// Routing node types
const NODE_TYPES = {
    INPUT: 'input',        // Track output
    OUTPUT: 'output',      // Master output
    BUS: 'bus',            // Custom bus (can have effects)
    SEND: 'send',          // Send point (pre/post fader)
    RETURN: 'return',      // Return from effects
    SPLITTER: 'splitter',  // Signal splitter (multiple outputs)
    MERGER: 'merger',      // Signal merger (multiple inputs)
    METER: 'meter'         // Level meter point
};

// Available routing presets
const ROUTING_PRESETS = {
    'default': {
        name: 'Default',
        description: 'Standard track-to-master routing',
        nodes: [],
        connections: []
    },
    'parallelProcessing': {
        name: 'Parallel Processing',
        description: 'Dry/wet parallel chain for any effect',
        nodes: [
            { id: 'dryBus', type: 'bus', name: 'Dry', gain: 1.0 },
            { id: 'wetBus', type: 'bus', name: 'Wet', gain: 0.5 }
        ],
        connections: [
            { from: 'input', to: 'dryBus' },
            { from: 'input', to: 'wetBus' },
            { from: 'dryBus', to: 'output' },
            { from: 'wetBus', to: 'output' }
        ]
    },
    'sidechainSetup': {
        name: 'Sidechain Setup',
        description: 'Ducking setup with trigger and target',
        nodes: [
            { id: 'sidechainBus', type: 'bus', name: 'Sidechain Trigger', gain: 1.0 },
            { id: 'duckedBus', type: 'bus', name: 'Ducked Signal', gain: 1.0 }
        ],
        connections: [
            { from: 'sidechainBus', to: 'duckedBus', sidechain: true },
            { from: 'duckedBus', to: 'output' }
        ]
    },
    'multibandSplit': {
        name: 'Multiband Split',
        description: '3-band frequency splitter',
        nodes: [
            { id: 'lowBand', type: 'bus', name: 'Low', gain: 0.33, filter: { type: 'lowpass', freq: 200 } },
            { id: 'midBand', type: 'bus', name: 'Mid', gain: 0.33, filter: { type: 'bandpass', freq: 1000 } },
            { id: 'highBand', type: 'bus', name: 'High', gain: 0.33, filter: { type: 'highpass', freq: 5000 } }
        ],
        connections: [
            { from: 'input', to: 'lowBand' },
            { from: 'input', to: 'midBand' },
            { from: 'input', to: 'highBand' },
            { from: 'lowBand', to: 'output' },
            { from: 'midBand', to: 'output' },
            { from: 'highBand', to: 'output' }
        ]
    },
    'sendReturnChain': {
        name: 'Send/Return Chain',
        description: 'Multiple send points with returns',
        nodes: [
            { id: 'send1', type: 'send', name: 'Send 1', gain: 0.5, preFader: false },
            { id: 'return1', type: 'return', name: 'Return 1', gain: 0.7 },
            { id: 'send2', type: 'send', name: 'Send 2', gain: 0.3, preFader: true },
            { id: 'return2', type: 'return', name: 'Return 2', gain: 0.5 }
        ],
        connections: [
            { from: 'send1', to: 'return1' },
            { from: 'send2', to: 'return2' },
            { from: 'return1', to: 'output' },
            { from: 'return2', to: 'output' }
        ]
    },
    'monitorChain': {
        name: 'Monitor Chain',
        description: 'Monitoring with metering points',
        nodes: [
            { id: 'preMeter', type: 'meter', name: 'Pre-Fader Meter' },
            { id: 'postMeter', type: 'meter', name: 'Post-Fader Meter' }
        ],
        connections: [
            { from: 'input', to: 'preMeter' },
            { from: 'preMeter', to: 'postMeter' },
            { from: 'postMeter', to: 'output' }
        ]
    }
};

/**
 * Represents a routing node in the signal graph
 */
class RoutingNode {
    constructor(config = {}) {
        this.id = config.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = config.type || NODE_TYPES.BUS;
        this.name = config.name || `Node ${this.id.slice(-4)}`;
        this.gain = config.gain ?? 1.0;
        this.pan = config.pan ?? 0;
        this.muted = config.muted ?? false;
        this.solo = config.solo ?? false;
        this.filter = config.filter || null;
        this.effects = config.effects || [];
        this.preFader = config.preFader ?? false;
        this.sidechain = config.sidechain || null;
        this.automation = config.automation || [];
        this.customParams = config.customParams || {};
        
        // Audio nodes (created during connection)
        this.inputNode = null;
        this.outputNode = null;
        this.gainNode = null;
        this.panNode = null;
        this.filterNode = null;
        this.meterNode = null;
        this.splitterNode = null;
        this.mergerNode = null;
        
        // Connection tracking
        this.inputs = [];
        this.outputs = [];
    }
    
    /**
     * Create audio nodes for this routing node
     */
    createAudioNodes() {
        if (typeof Tone === 'undefined') {
            console.warn('[RoutingNode] Tone.js not available');
            return false;
        }
        
        try {
            // Create gain node
            this.gainNode = new Tone.Gain(this.gain);
            
            // Create pan node
            if (this.type === NODE_TYPES.BUS || this.type === NODE_TYPES.OUTPUT) {
                this.panNode = new Tone.Panner(this.pan);
            }
            
            // Create filter if specified
            if (this.filter) {
                this.filterNode = new Tone.Filter({
                    type: this.filter.type,
                    frequency: this.filter.freq,
                    Q: this.filter.Q ?? 1
                });
            }
            
            // Create meter if this is a meter node
            if (this.type === NODE_TYPES.METER) {
                this.meterNode = new Tone.Meter();
            }
            
            // Create splitter/merger if needed
            if (this.type === NODE_TYPES.SPLITTER) {
                this.splitterNode = new Tone.Split();
            } else if (this.type === NODE_TYPES.MERGER) {
                this.mergerNode = new Tone.Merge();
            }
            
            return true;
        } catch (e) {
            console.error('[RoutingNode] Error creating audio nodes:', e);
            return false;
        }
    }
    
    /**
     * Dispose all audio nodes
     */
    dispose() {
        if (this.gainNode && !this.gainNode.disposed) {
            this.gainNode.dispose();
        }
        if (this.panNode && !this.panNode.disposed) {
            this.panNode.dispose();
        }
        if (this.filterNode && !this.filterNode.disposed) {
            this.filterNode.dispose();
        }
        if (this.meterNode && !this.meterNode.disposed) {
            this.meterNode.dispose();
        }
        if (this.splitterNode && !this.splitterNode.disposed) {
            this.splitterNode.dispose();
        }
        if (this.mergerNode && !this.mergerNode.disposed) {
            this.mergerNode.dispose();
        }
        
        this.inputNode = null;
        this.outputNode = null;
        this.gainNode = null;
        this.panNode = null;
        this.filterNode = null;
        this.meterNode = null;
        this.splitterNode = null;
        this.mergerNode = null;
    }
    
    /**
     * Get the input node for connections
     */
    getInputNode() {
        if (this.type === NODE_TYPES.MERGER) {
            return this.mergerNode;
        }
        if (this.filterNode) {
            return this.filterNode;
        }
        return this.gainNode;
    }
    
    /**
     * Get the output node for connections
     */
    getOutputNode() {
        if (this.type === NODE_TYPES.SPLITTER) {
            return this.splitterNode;
        }
        if (this.meterNode) {
            return this.meterNode;
        }
        if (this.panNode) {
            return this.panNode;
        }
        return this.gainNode;
    }
    
    /**
     * Set gain value
     */
    setGain(value) {
        this.gain = Math.max(0, Math.min(2, value));
        if (this.gainNode) {
            this.gainNode.gain.rampTo(this.gain, 0.01);
        }
    }
    
    /**
     * Set pan value
     */
    setPan(value) {
        this.pan = Math.max(-1, Math.min(1, value));
        if (this.panNode) {
            this.panNode.pan.rampTo(this.pan, 0.01);
        }
    }
    
    /**
     * Set mute state
     */
    setMuted(muted) {
        this.muted = muted;
        if (this.gainNode) {
            this.gainNode.gain.rampTo(muted ? 0 : this.gain, 0.01);
        }
    }
    
    /**
     * Get meter level (if meter node)
     */
    getMeterLevel() {
        if (this.meterNode) {
            return this.meterNode.getValue();
        }
        return 0;
    }
    
    /**
     * Serialize node for saving
     */
    serialize() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            gain: this.gain,
            pan: this.pan,
            muted: this.muted,
            solo: this.solo,
            filter: this.filter,
            effects: this.effects,
            preFader: this.preFader,
            sidechain: this.sidechain,
            automation: this.automation,
            customParams: this.customParams,
            inputs: this.inputs.map(n => n.id),
            outputs: this.outputs.map(n => n.id)
        };
    }
}

/**
 * Represents a connection between routing nodes
 */
class RoutingConnection {
    constructor(config = {}) {
        this.id = config.id || `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.fromNodeId = config.fromNodeId || config.from;
        this.toNodeId = config.toNodeId || config.to;
        this.gain = config.gain ?? 1.0;
        this.sidechain = config.sidechain ?? false;
        this.enabled = config.enabled ?? true;
        this.automation = config.automation || [];
        
        // Audio nodes
        this.gainNode = null;
    }
    
    /**
     * Create audio gain node for this connection
     */
    createAudioNode() {
        if (typeof Tone === 'undefined') return false;
        
        try {
            this.gainNode = new Tone.Gain(this.gain);
            return true;
        } catch (e) {
            console.error('[RoutingConnection] Error creating gain node:', e);
            return false;
        }
    }
    
    /**
     * Dispose audio node
     */
    dispose() {
        if (this.gainNode && !this.gainNode.disposed) {
            this.gainNode.dispose();
        }
        this.gainNode = null;
    }
    
    /**
     * Set gain value
     */
    setGain(value) {
        this.gain = Math.max(0, Math.min(2, value));
        if (this.gainNode) {
            this.gainNode.gain.rampTo(this.gain, 0.01);
        }
    }
    
    /**
     * Serialize connection
     */
    serialize() {
        return {
            id: this.id,
            from: this.fromNodeId,
            to: this.toNodeId,
            gain: this.gain,
            sidechain: this.sidechain,
            enabled: this.enabled,
            automation: this.automation
        };
    }
}

/**
 * Main Modular Routing System
 */
class ModularRoutingSystem {
    constructor(config = {}) {
        this.nodes = new Map();
        this.connections = new Map();
        this.presets = { ...ROUTING_PRESETS };
        this.customPresets = new Map();
        
        // Special nodes
        this.inputNode = null;
        this.outputNode = null;
        
        // Track routing maps
        this.trackRoutings = new Map(); // Map<trackId, routingConfig>
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Callbacks
        this.onRouteChange = config.onRouteChange || (() => {});
        this.onNodeCreate = config.onNodeCreate || (() => {});
        this.onNodeDelete = config.onNodeDelete || (() => {});
        this.onConnectionCreate = config.onConnectionCreate || (() => {});
        this.onConnectionDelete = config.onConnectionDelete || (() => {});
    }
    
    /**
     * Initialize the routing system
     */
    initialize() {
        console.log('[ModularRouting] Initializing routing system...');
        
        // Create default input/output nodes
        this.inputNode = new RoutingNode({
            id: 'input',
            type: NODE_TYPES.INPUT,
            name: 'Track Output',
            gain: 1.0
        });
        this.inputNode.createAudioNodes();
        this.nodes.set('input', this.inputNode);
        
        this.outputNode = new RoutingNode({
            id: 'output',
            type: NODE_TYPES.OUTPUT,
            name: 'Master Output',
            gain: 1.0
        });
        this.outputNode.createAudioNodes();
        this.nodes.set('output', this.outputNode);
        
        console.log('[ModularRouting] Routing system initialized');
        return true;
    }
    
    /**
     * Create a new routing node
     */
    createNode(config = {}) {
        const node = new RoutingNode(config);
        
        if (!node.createAudioNodes()) {
            console.error('[ModularRouting] Failed to create audio nodes for:', config);
            return null;
        }
        
        this.nodes.set(node.id, node);
        this.onNodeCreate(node);
        this.saveHistory();
        
        console.log(`[ModularRouting] Created node: ${node.name} (${node.id})`);
        return node;
    }
    
    /**
     * Delete a routing node
     */
    deleteNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) {
            console.warn(`[ModularRouting] Node not found: ${nodeId}`);
            return false;
        }
        
        // Don't allow deleting input/output nodes
        if (nodeId === 'input' || nodeId === 'output') {
            console.warn('[ModularRouting] Cannot delete input/output nodes');
            return false;
        }
        
        // Disconnect all connections involving this node
        for (const [connId, conn] of this.connections) {
            if (conn.fromNodeId === nodeId || conn.toNodeId === nodeId) {
                this.disconnect(connId);
            }
        }
        
        // Dispose node
        node.dispose();
        this.nodes.delete(nodeId);
        
        this.onNodeDelete(nodeId);
        this.saveHistory();
        
        console.log(`[ModularRouting] Deleted node: ${nodeId}`);
        return true;
    }
    
    /**
     * Get a node by ID
     */
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    
    /**
     * Connect two nodes
     */
    connect(fromNodeId, toNodeId, config = {}) {
        const fromNode = this.nodes.get(fromNodeId);
        const toNode = this.nodes.get(toNodeId);
        
        if (!fromNode || !toNode) {
            console.error('[ModularRouting] Cannot connect: node not found');
            return null;
        }
        
        // Check if connection already exists
        for (const [_, conn] of this.connections) {
            if (conn.fromNodeId === fromNodeId && conn.toNodeId === toNodeId) {
                console.warn('[ModularRouting] Connection already exists');
                return conn;
            }
        }
        
        // Create connection
        const connection = new RoutingConnection({
            ...config,
            fromNodeId,
            toNodeId
        });
        connection.createAudioNode();
        
        // Connect audio nodes
        try {
            const fromOutput = fromNode.getOutputNode();
            const toInput = toNode.getInputNode();
            
            if (connection.gainNode) {
                fromOutput.connect(connection.gainNode);
                connection.gainNode.connect(toInput);
            } else {
                fromOutput.connect(toInput);
            }
        } catch (e) {
            console.error('[ModularRouting] Error connecting audio nodes:', e);
            return null;
        }
        
        // Update node references
        fromNode.outputs.push(toNode);
        toNode.inputs.push(fromNode);
        
        // Store connection
        this.connections.set(connection.id, connection);
        
        this.onConnectionCreate(connection);
        this.saveHistory();
        
        console.log(`[ModularRouting] Connected: ${fromNodeId} -> ${toNodeId}`);
        return connection;
    }
    
    /**
     * Disconnect two nodes
     */
    disconnect(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            console.warn(`[ModularRouting] Connection not found: ${connectionId}`);
            return false;
        }
        
        const fromNode = this.nodes.get(connection.fromNodeId);
        const toNode = this.nodes.get(connection.toNodeId);
        
        // Disconnect audio nodes
        try {
            if (connection.gainNode && fromNode && toNode) {
                const fromOutput = fromNode.getOutputNode();
                const toInput = toNode.getInputNode();
                
                fromOutput.disconnect(connection.gainNode);
                connection.gainNode.disconnect(toInput);
            }
        } catch (e) {
            console.error('[ModularRouting] Error disconnecting audio nodes:', e);
        }
        
        // Update node references
        if (fromNode) {
            fromNode.outputs = fromNode.outputs.filter(n => n.id !== connection.toNodeId);
        }
        if (toNode) {
            toNode.inputs = toNode.inputs.filter(n => n.id !== connection.fromNodeId);
        }
        
        // Dispose and remove connection
        connection.dispose();
        this.connections.delete(connectionId);
        
        this.onConnectionDelete(connectionId);
        this.saveHistory();
        
        console.log(`[ModularRouting] Disconnected: ${connectionId}`);
        return true;
    }
    
    /**
     * Apply a routing preset
     */
    applyPreset(presetName) {
        const preset = this.presets[presetName] || this.customPresets.get(presetName);
        if (!preset) {
            console.error(`[ModularRouting] Preset not found: ${presetName}`);
            return false;
        }
        
        console.log(`[ModularRouting] Applying preset: ${preset.name}`);
        
        // Clear existing routing (except input/output)
        this.clearRouting();
        
        // Create nodes from preset
        const nodeIdMap = new Map();
        
        for (const nodeConfig of preset.nodes) {
            const node = this.createNode({
                ...nodeConfig,
                id: `${nodeConfig.id}_${Date.now()}` // Unique ID
            });
            if (node) {
                nodeIdMap.set(nodeConfig.id, node.id);
            }
        }
        
        // Create connections from preset
        for (const connConfig of preset.connections) {
            const fromId = nodeIdMap.get(connConfig.from) || connConfig.from;
            const toId = nodeIdMap.get(connConfig.to) || connConfig.to;
            
            if (this.nodes.has(fromId) && this.nodes.has(toId)) {
                this.connect(fromId, toId, connConfig);
            }
        }
        
        this.onRouteChange();
        return true;
    }
    
    /**
     * Save current routing as a preset
     */
    saveAsPreset(name, description = '') {
        const nodes = [];
        const connections = [];
        
        for (const [_, node] of this.nodes) {
            if (node.id !== 'input' && node.id !== 'output') {
                nodes.push(node.serialize());
            }
        }
        
        for (const [_, conn] of this.connections) {
            connections.push(conn.serialize());
        }
        
        const preset = {
            name,
            description,
            nodes,
            connections,
            createdAt: new Date().toISOString()
        };
        
        this.customPresets.set(name, preset);
        console.log(`[ModularRouting] Saved preset: ${name}`);
        
        return preset;
    }
    
    /**
     * Clear all routing (reset to default)
     */
    clearRouting() {
        // Disconnect all connections
        for (const [connId, _] of this.connections) {
            this.disconnect(connId);
        }
        
        // Delete all nodes except input/output
        for (const [nodeId, node] of this.nodes) {
            if (nodeId !== 'input' && nodeId !== 'output') {
                node.dispose();
                this.nodes.delete(nodeId);
            }
        }
        
        this.onRouteChange();
        console.log('[ModularRouting] Routing cleared');
    }
    
    /**
     * Set up routing for a track
     */
    setTrackRouting(trackId, routingConfig) {
        this.trackRoutings.set(trackId, {
            ...routingConfig,
            updatedAt: Date.now()
        });
        
        this.onRouteChange();
        console.log(`[ModularRouting] Set routing for track: ${trackId}`);
    }
    
    /**
     * Get routing for a track
     */
    getTrackRouting(trackId) {
        return this.trackRoutings.get(trackId) || null;
    }
    
    /**
     * Remove track routing
     */
    removeTrackRouting(trackId) {
        this.trackRoutings.delete(trackId);
        this.onRouteChange();
    }
    
    /**
     * Save history for undo
     */
    saveHistory() {
        const state = this.serialize();
        
        // Remove any future history if we're in the middle
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push(state);
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }
    
    /**
     * Undo last action
     */
    undo() {
        if (this.historyIndex <= 0) {
            console.log('[ModularRouting] Nothing to undo');
            return false;
        }
        
        this.historyIndex--;
        this.deserialize(this.history[this.historyIndex]);
        this.onRouteChange();
        
        console.log('[ModularRouting] Undo');
        return true;
    }
    
    /**
     * Redo last undone action
     */
    redo() {
        if (this.historyIndex >= this.history.length - 1) {
            console.log('[ModularRouting] Nothing to redo');
            return false;
        }
        
        this.historyIndex++;
        this.deserialize(this.history[this.historyIndex]);
        this.onRouteChange();
        
        console.log('[ModularRouting] Redo');
        return true;
    }
    
    /**
     * Serialize entire routing system
     */
    serialize() {
        const nodes = {};
        const connections = {};
        
        for (const [id, node] of this.nodes) {
            nodes[id] = node.serialize();
        }
        
        for (const [id, conn] of this.connections) {
            connections[id] = conn.serialize();
        }
        
        return {
            nodes,
            connections,
            trackRoutings: Object.fromEntries(this.trackRoutings),
            customPresets: Object.fromEntries(this.customPresets),
            timestamp: Date.now()
        };
    }
    
    /**
     * Deserialize and restore routing state
     */
    deserialize(data) {
        this.clearRouting();
        
        // Restore nodes
        for (const [id, nodeData] of Object.entries(data.nodes || {})) {
            if (id !== 'input' && id !== 'output') {
                this.createNode({
                    ...nodeData,
                    id
                });
            }
        }
        
        // Restore connections
        for (const [id, connData] of Object.entries(data.connections || {})) {
            this.connect(connData.from, connData.to, connData);
        }
        
        // Restore track routings
        if (data.trackRoutings) {
            this.trackRoutings = new Map(Object.entries(data.trackRoutings));
        }
        
        // Restore custom presets
        if (data.customPresets) {
            this.customPresets = new Map(Object.entries(data.customPresets));
        }
        
        console.log('[ModularRouting] State restored');
    }
    
    /**
     * Get routing visualization data
     */
    getVisualizationData() {
        const nodes = [];
        const edges = [];
        
        for (const [id, node] of this.nodes) {
            nodes.push({
                id,
                type: node.type,
                name: node.name,
                gain: node.gain,
                pan: node.pan,
                muted: node.muted,
                solo: node.solo
            });
        }
        
        for (const [id, conn] of this.connections) {
            edges.push({
                id,
                from: conn.fromNodeId,
                to: conn.toNodeId,
                gain: conn.gain,
                enabled: conn.enabled
            });
        }
        
        return { nodes, edges };
    }
    
    /**
     * Get all available presets
     */
    getAvailablePresets() {
        const presets = [];
        
        for (const [id, preset] of Object.entries(this.presets)) {
            presets.push({ id, ...preset, isCustom: false });
        }
        
        for (const [id, preset] of this.customPresets) {
            presets.push({ id, ...preset, isCustom: true });
        }
        
        return presets;
    }
    
    /**
     * Delete a custom preset
     */
    deleteCustomPreset(name) {
        if (this.customPresets.has(name)) {
            this.customPresets.delete(name);
            console.log(`[ModularRouting] Deleted preset: ${name}`);
            return true;
        }
        return false;
    }
    
    /**
     * Dispose entire system
     */
    dispose() {
        this.clearRouting();
        
        if (this.inputNode) {
            this.inputNode.dispose();
        }
        if (this.outputNode) {
            this.outputNode.dispose();
        }
        
        this.nodes.clear();
        this.connections.clear();
        this.trackRoutings.clear();
        this.customPresets.clear();
        this.history = [];
        
        console.log('[ModularRouting] System disposed');
    }
}

// Create singleton instance
let routingSystemInstance = null;

/**
 * Get or create the routing system instance
 */
export function getRoutingSystem(config = {}) {
    if (!routingSystemInstance) {
        routingSystemInstance = new ModularRoutingSystem(config);
    }
    return routingSystemInstance;
}

/**
 * Create a new routing system (for multiple instances)
 */
export function createRoutingSystem(config = {}) {
    return new ModularRoutingSystem(config);
}

/**
 * Open the modular routing panel UI
 */
export function openModularRoutingPanel(onRouteChange = null) {
    // Close existing panel if any
    const existing = document.getElementById('modular-routing-panel');
    if (existing) {
        existing.remove();
    }
    
    const routing = getRoutingSystem();
    if (!routing.nodes.has('input')) {
        routing.initialize();
    }
    
    const panel = document.createElement('div');
    panel.id = 'modular-routing-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 900px;
        max-width: 95vw;
        max-height: 85vh;
        background: #1a1a2e;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: #16162a;
        border-radius: 12px 12px 0 0;
        border-bottom: 1px solid #2a2a4a;
    `;
    header.innerHTML = `
        <h2 style="margin: 0; font-size: 18px; font-weight: 600;">Modular Routing</h2>
        <div style="display: flex; gap: 8px;">
            <button id="routing-undo" style="padding: 6px 12px; background: #2a2a4a; border: none; color: #e0e0e0; border-radius: 4px; cursor: pointer;">↶ Undo</button>
            <button id="routing-redo" style="padding: 6px 12px; background: #2a2a4a; border: none; color: #e0e0e0; border-radius: 4px; cursor: pointer;">↷ Redo</button>
            <button id="routing-close" style="padding: 6px 12px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer;">✕ Close</button>
        </div>
    `;
    panel.appendChild(header);
    
    // Main content area
    const content = document.createElement('div');
    content.style.cssText = `
        display: flex;
        flex: 1;
        overflow: hidden;
    `;
    panel.appendChild(content);
    
    // Left sidebar - Presets
    const sidebar = document.createElement('div');
    sidebar.style.cssText = `
        width: 200px;
        background: #16162a;
        border-right: 1px solid #2a2a4a;
        padding: 12px;
        overflow-y: auto;
    `;
    sidebar.innerHTML = `
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Presets</h3>
        <div id="preset-list"></div>
        <button id="save-preset" style="width: 100%; margin-top: 12px; padding: 8px; background: #4ade80; border: none; color: #000; border-radius: 4px; cursor: pointer; font-weight: 600;">Save Current</button>
    `;
    content.appendChild(sidebar);
    
    // Center - Routing visualization
    const visualization = document.createElement('div');
    visualization.id = 'routing-visualization';
    visualization.style.cssText = `
        flex: 1;
        padding: 16px;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
    `;
    content.appendChild(visualization);
    
    // Right sidebar - Node properties
    const properties = document.createElement('div');
    properties.id = 'node-properties';
    properties.style.cssText = `
        width: 220px;
        background: #16162a;
        border-left: 1px solid #2a2a4a;
        padding: 12px;
        overflow-y: auto;
    `;
    properties.innerHTML = `
        <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Node Properties</h3>
        <div id="properties-content">Select a node to edit</div>
    `;
    content.appendChild(properties);
    
    // Bottom toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
        display: flex;
        gap: 8px;
        padding: 12px 20px;
        background: #16162a;
        border-radius: 0 0 12px 12px;
        border-top: 1px solid #2a2a4a;
    `;
    toolbar.innerHTML = `
        <button id="add-bus" style="padding: 8px 16px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">+ Add Bus</button>
        <button id="add-send" style="padding: 8px 16px; background: #8b5cf6; border: none; color: white; border-radius: 4px; cursor: pointer;">+ Add Send</button>
        <button id="add-return" style="padding: 8px 16px; background: #ec4899; border: none; color: white; border-radius: 4px; cursor: pointer;">+ Add Return</button>
        <button id="add-meter" style="padding: 8px 16px; background: #f59e0b; border: none; color: white; border-radius: 4px; cursor: pointer;">+ Add Meter</button>
        <button id="clear-routing" style="margin-left: auto; padding: 8px 16px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer;">Clear All</button>
    `;
    panel.appendChild(toolbar);
    
    document.body.appendChild(panel);
    
    // Render preset list
    function renderPresetList() {
        const list = document.getElementById('preset-list');
        const presets = routing.getAvailablePresets();
        
        list.innerHTML = presets.map(p => `
            <div class="preset-item" data-id="${p.id}" style="
                padding: 8px 10px;
                margin-bottom: 4px;
                background: #2a2a4a;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
            ">
                <div style="font-weight: 500;">${p.name}</div>
                <div style="font-size: 11px; color: #888; margin-top: 2px;">${p.description || 'No description'}</div>
            </div>
        `).join('');
        
        // Add click handlers
        list.querySelectorAll('.preset-item').forEach(item => {
            item.addEventListener('click', () => {
                routing.applyPreset(item.dataset.id);
                renderVisualization();
            });
        });
    }
    
    // Render routing visualization
    function renderVisualization() {
        const vis = document.getElementById('routing-visualization');
        const data = routing.getVisualizationData();
        
        vis.innerHTML = `
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 12px;
            ">
                ${data.nodes.map(node => `
                    <div class="routing-node" data-id="${node.id}" style="
                        background: ${node.type === 'input' ? '#22c55e' : node.type === 'output' ? '#ef4444' : '#3b82f6'};
                        padding: 12px;
                        border-radius: 8px;
                        cursor: pointer;
                        opacity: ${node.muted ? 0.5 : 1};
                    ">
                        <div style="font-weight: 600; font-size: 13px;">${node.name}</div>
                        <div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">
                            ${node.type} | Gain: ${node.gain.toFixed(2)}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 16px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #888;">Connections</h4>
                ${data.edges.length === 0 ? '<div style="color: #666; font-size: 13px;">No connections</div>' : ''}
                ${data.edges.map(edge => `
                    <div class="routing-edge" data-id="${edge.id}" style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px;
                        background: #2a2a4a;
                        border-radius: 4px;
                        margin-bottom: 4px;
                        font-size: 13px;
                    ">
                        <span>${data.nodes.find(n => n.id === edge.from)?.name || edge.from}</span>
                        <span style="color: #888;">→</span>
                        <span>${data.nodes.find(n => n.id === edge.to)?.name || edge.to}</span>
                        <span style="margin-left: auto; color: #888;">${(edge.gain * 100).toFixed(0)}%</span>
                        <button class="remove-connection" data-id="${edge.id}" style="
                            padding: 2px 6px;
                            background: transparent;
                            border: 1px solid #ef4444;
                            color: #ef4444;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                        ">×</button>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add node click handlers
        vis.querySelectorAll('.routing-node').forEach(nodeEl => {
            nodeEl.addEventListener('click', () => {
                const nodeId = nodeEl.dataset.id;
                showNodeProperties(nodeId);
            });
        });
        
        // Add connection removal handlers
        vis.querySelectorAll('.remove-connection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                routing.disconnect(btn.dataset.id);
                renderVisualization();
            });
        });
    }
    
    // Show node properties
    function showNodeProperties(nodeId) {
        const node = routing.getNode(nodeId);
        const content = document.getElementById('properties-content');
        
        if (!node) {
            content.innerHTML = 'Node not found';
            return;
        }
        
        content.innerHTML = `
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Name</label>
                <input id="prop-name" type="text" value="${node.name}" style="
                    width: 100%;
                    padding: 8px;
                    background: #2a2a4a;
                    border: 1px solid #3a3a5a;
                    color: #e0e0e0;
                    border-radius: 4px;
                    box-sizing: border-box;
                ">
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Gain</label>
                <input id="prop-gain" type="range" min="0" max="2" step="0.01" value="${node.gain}" style="width: 100%;">
                <span id="prop-gain-value" style="font-size: 12px;">${node.gain.toFixed(2)}</span>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 12px; color: #888; margin-bottom: 4px;">Pan</label>
                <input id="prop-pan" type="range" min="-1" max="1" step="0.01" value="${node.pan}" style="width: 100%;">
                <span id="prop-pan-value" style="font-size: 12px;">${node.pan.toFixed(2)}</span>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
                    <input id="prop-muted" type="checkbox" ${node.muted ? 'checked' : ''}>
                    Muted
                </label>
            </div>
            <div style="margin-bottom: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
                    <input id="prop-solo" type="checkbox" ${node.solo ? 'checked' : ''}>
                    Solo
                </label>
            </div>
            ${node.id !== 'input' && node.id !== 'output' ? `
                <button id="delete-node" style="
                    width: 100%;
                    padding: 8px;
                    background: #ef4444;
                    border: none;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                ">Delete Node</button>
            ` : ''}
        `;
        
        // Add property change handlers
        document.getElementById('prop-name').addEventListener('change', (e) => {
            node.name = e.target.value;
            renderVisualization();
        });
        
        document.getElementById('prop-gain').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            node.setGain(value);
            document.getElementById('prop-gain-value').textContent = value.toFixed(2);
        });
        
        document.getElementById('prop-pan').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            node.setPan(value);
            document.getElementById('prop-pan-value').textContent = value.toFixed(2);
        });
        
        document.getElementById('prop-muted').addEventListener('change', (e) => {
            node.setMuted(e.target.checked);
            renderVisualization();
        });
        
        document.getElementById('prop-solo').addEventListener('change', (e) => {
            node.solo = e.target.checked;
            renderVisualization();
        });
        
        const deleteBtn = document.getElementById('delete-node');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                routing.deleteNode(nodeId);
                renderVisualization();
                content.innerHTML = 'Select a node to edit';
            });
        }
    }
    
    // Event handlers
    document.getElementById('routing-close').addEventListener('click', () => {
        panel.remove();
    });
    
    document.getElementById('routing-undo').addEventListener('click', () => {
        routing.undo();
        renderVisualization();
    });
    
    document.getElementById('routing-redo').addEventListener('click', () => {
        routing.redo();
        renderVisualization();
    });
    
    document.getElementById('add-bus').addEventListener('click', () => {
        const node = routing.createNode({
            type: NODE_TYPES.BUS,
            name: `Bus ${routing.nodes.size - 1}`
        });
        renderVisualization();
        showNodeProperties(node.id);
    });
    
    document.getElementById('add-send').addEventListener('click', () => {
        const node = routing.createNode({
            type: NODE_TYPES.SEND,
            name: `Send ${routing.nodes.size - 1}`,
            preFader: false
        });
        renderVisualization();
        showNodeProperties(node.id);
    });
    
    document.getElementById('add-return').addEventListener('click', () => {
        const node = routing.createNode({
            type: NODE_TYPES.RETURN,
            name: `Return ${routing.nodes.size - 1}`
        });
        renderVisualization();
        showNodeProperties(node.id);
    });
    
    document.getElementById('add-meter').addEventListener('click', () => {
        const node = routing.createNode({
            type: NODE_TYPES.METER,
            name: `Meter ${routing.nodes.size - 1}`
        });
        renderVisualization();
        showNodeProperties(node.id);
    });
    
    document.getElementById('clear-routing').addEventListener('click', () => {
        if (confirm('Clear all routing?')) {
            routing.clearRouting();
            renderVisualization();
        }
    });
    
    document.getElementById('save-preset').addEventListener('click', () => {
        const name = prompt('Enter preset name:');
        if (name) {
            routing.saveAsPreset(name, 'Custom preset');
            renderPresetList();
        }
    });
    
    // Initial render
    renderPresetList();
    renderVisualization();
    
    // Set up route change callback
    if (onRouteChange) {
        routing.onRouteChange = onRouteChange;
    }
    
    return panel;
}

// Export node types and presets for external use
export { NODE_TYPES, ROUTING_PRESETS, RoutingNode, RoutingConnection, ModularRoutingSystem };