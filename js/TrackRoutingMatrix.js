// js/TrackRoutingMatrix.js - Track Routing Matrix for SnugOS DAW
// This module provides visual routing control for track sends/returns and audio bus routing

/**
 * TrackRoutingMatrix provides a visual matrix for managing audio routing in the DAW.
 * 
 * Features:
 * - Track to bus routing (sends)
 * - Track to track routing (sidechain, etc.)
 * - Visual matrix display
 * - Real-time routing updates
 * - Preset routing configurations
 */

/**
 * Routing types
 */
export const RoutingType = {
    SEND: 'send',           // Track to bus send
    SIDECHAIN: 'sidechain', // Track to track sidechain
    DIRECT: 'direct',       // Direct output routing
    RETURN: 'return'        // Return from bus
};

/**
 * Bus types
 */
export const BusType = {
    REVERB: 'reverb',
    DELAY: 'delay',
    CHORUS: 'chorus',
    COMPRESSOR: 'compressor',
    CUSTOM: 'custom'
};

/**
 * RoutingMatrixManager - Manages all routing connections
 */
export class RoutingMatrixManager {
    constructor(appServices) {
        this.appServices = appServices;
        
        // Available buses
        this.buses = new Map(); // busId -> {id, name, type, gainNode, effects, inputGain, outputGain}
        
        // Routing connections: sourceId -> {destId: {type, amount, enabled}}
        this.routingMap = new Map();
        
        // Bus configuration
        this.busConfigs = new Map(); // busId -> config
        
        // Default buses
        this.initializeDefaultBuses();
        
        // Routing presets
        this.routingPresets = new Map();
        
        this.busIdCounter = 1;
    }
    
    /**
     * Initialize default send buses.
     */
    initializeDefaultBuses() {
        this.createBus('Reverb', BusType.REVERB);
        this.createBus('Delay', BusType.DELAY);
        console.log('[RoutingMatrix] Initialized default buses');
    }
    
    /**
     * Create a new bus.
     * @param {string} name - Bus name
     * @param {string} type - Bus type from BusType
     * @param {Object} config - Optional configuration
     * @returns {Object} Created bus
     */
    createBus(name, type = BusType.CUSTOM, config = {}) {
        const busId = `bus_${this.busIdCounter++}`;
        
        const bus = {
            id: busId,
            name: name,
            type: type,
            enabled: true,
            inputGain: config.inputGain || 1.0,
            outputGain: config.outputGain || 1.0,
            effects: config.effects || [],
            muted: false,
            solo: false,
            color: config.color || this.getBusColor(type)
        };
        
        this.buses.set(busId, bus);
        this.busConfigs.set(busId, config);
        
        console.log(`[RoutingMatrix] Created bus "${name}" (${type}) with ID: ${busId}`);
        return bus;
    }
    
    /**
     * Get default color for bus type.
     * @param {string} type - Bus type
     * @returns {string} Hex color
     */
    getBusColor(type) {
        const colors = {
            [BusType.REVERB]: '#8b5cf6',    // Purple
            [BusType.DELAY]: '#06b6d4',     // Cyan
            [BusType.CHORUS]: '#10b981',    // Green
            [BusType.COMPRESSOR]: '#f59e0b', // Amber
            [BusType.CUSTOM]: '#6b7280'     // Gray
        };
        return colors[type] || colors[BusType.CUSTOM];
    }
    
    /**
     * Get all buses.
     * @returns {Array} Array of bus objects
     */
    getBuses() {
        return Array.from(this.buses.values());
    }
    
    /**
     * Get a bus by ID.
     * @param {string} busId - Bus ID
     * @returns {Object|null} Bus object or null
     */
    getBus(busId) {
        return this.buses.get(busId) || null;
    }
    
    /**
     * Update bus configuration.
     * @param {string} busId - Bus ID
     * @param {Object} updates - Properties to update
     * @returns {boolean} True if updated
     */
    updateBus(busId, updates) {
        const bus = this.buses.get(busId);
        if (!bus) return false;
        
        Object.assign(bus, updates);
        console.log(`[RoutingMatrix] Updated bus ${busId}:`, updates);
        return true;
    }
    
    /**
     * Delete a bus.
     * @param {string} busId - Bus ID to delete
     * @returns {boolean} True if deleted
     */
    deleteBus(busId) {
        if (!this.buses.has(busId)) return false;
        
        // Remove all routing to/from this bus
        for (const [sourceId, destinations] of this.routingMap) {
            if (destinations.has(busId)) {
                destinations.delete(busId);
            }
        }
        
        this.buses.delete(busId);
        this.busConfigs.delete(busId);
        
        console.log(`[RoutingMatrix] Deleted bus ${busId}`);
        return true;
    }
    
    /**
     * Create a routing connection.
     * @param {string} sourceId - Source track or bus ID
     * @param {string} destId - Destination track or bus ID
     * @param {Object} options - Routing options
     * @returns {boolean} True if created
     */
    createRouting(sourceId, destId, options = {}) {
        if (!this.routingMap.has(sourceId)) {
            this.routingMap.set(sourceId, new Map());
        }
        
        const routing = {
            type: options.type || RoutingType.SEND,
            amount: options.amount || 0, // 0-1 for send level
            enabled: options.enabled !== false,
            preFader: options.preFader || false,
            mute: options.mute || false
        };
        
        this.routingMap.get(sourceId).set(destId, routing);
        
        console.log(`[RoutingMatrix] Created routing: ${sourceId} -> ${destId} (${routing.type})`);
        return true;
    }
    
    /**
     * Remove a routing connection.
     * @param {string} sourceId - Source ID
     * @param {string} destId - Destination ID
     * @returns {boolean} True if removed
     */
    removeRouting(sourceId, destId) {
        const sourceRouting = this.routingMap.get(sourceId);
        if (!sourceRouting) return false;
        
        const removed = sourceRouting.delete(destId);
        if (removed) {
            console.log(`[RoutingMatrix] Removed routing: ${sourceId} -> ${destId}`);
        }
        return removed;
    }
    
    /**
     * Get all routings from a source.
     * @param {string} sourceId - Source ID
     * @returns {Map} Map of destId -> routing
     */
    getRoutingsFromSource(sourceId) {
        return this.routingMap.get(sourceId) || new Map();
    }
    
    /**
     * Get all routings to a destination.
     * @param {string} destId - Destination ID
     * @returns {Array} Array of {sourceId, routing}
     */
    getRoutingsToDestination(destId) {
        const routings = [];
        
        for (const [sourceId, destinations] of this.routingMap) {
            const routing = destinations.get(destId);
            if (routing) {
                routings.push({ sourceId, routing });
            }
        }
        
        return routings;
    }
    
    /**
     * Update routing amount.
     * @param {string} sourceId - Source ID
     * @param {string} destId - Destination ID
     * @param {number} amount - Amount (0-1)
     * @returns {boolean} True if updated
     */
    setRoutingAmount(sourceId, destId, amount) {
        const sourceRouting = this.routingMap.get(sourceId);
        if (!sourceRouting) return false;
        
        const routing = sourceRouting.get(destId);
        if (!routing) return false;
        
        routing.amount = Math.max(0, Math.min(1, amount));
        console.log(`[RoutingMatrix] Set routing ${sourceId} -> ${destId} amount: ${routing.amount}`);
        return true;
    }
    
    /**
     * Toggle routing enabled.
     * @param {string} sourceId - Source ID
     * @param {string} destId - Destination ID
     * @returns {boolean} New enabled state
     */
    toggleRouting(sourceId, destId) {
        const sourceRouting = this.routingMap.get(sourceId);
        if (!sourceRouting) return false;
        
        const routing = sourceRouting.get(destId);
        if (!routing) return false;
        
        routing.enabled = !routing.enabled;
        console.log(`[RoutingMatrix] Toggled routing ${sourceId} -> ${destId}: ${routing.enabled}`);
        return routing.enabled;
    }
    
    /**
     * Set routing pre/post fader.
     * @param {string} sourceId - Source ID
     * @param {string} destId - Destination ID
     * @param {boolean} preFader - True for pre-fader
     * @returns {boolean} True if set
     */
    setRoutingPreFader(sourceId, destId, preFader) {
        const sourceRouting = this.routingMap.get(sourceId);
        if (!sourceRouting) return false;
        
        const routing = sourceRouting.get(destId);
        if (!routing) return false;
        
        routing.preFader = preFader;
        console.log(`[RoutingMatrix] Set routing ${sourceId} -> ${destId} preFader: ${preFader}`);
        return true;
    }
    
    /**
     * Get complete routing matrix.
     * @returns {Object} Matrix data
     */
    getRoutingMatrix() {
        const matrix = {
            buses: this.getBuses(),
            routings: {}
        };
        
        for (const [sourceId, destinations] of this.routingMap) {
            matrix.routings[sourceId] = {};
            for (const [destId, routing] of destinations) {
                matrix.routings[sourceId][destId] = { ...routing };
            }
        }
        
        return matrix;
    }
    
    /**
     * Load routing matrix from saved data.
     * @param {Object} data - Saved matrix data
     */
    loadRoutingMatrix(data) {
        // Clear existing
        this.buses.clear();
        this.routingMap.clear();
        
        // Load buses
        if (data.buses) {
            data.buses.forEach(bus => {
                this.buses.set(bus.id, bus);
            });
        }
        
        // Load routings
        if (data.routings) {
            for (const [sourceId, destinations] of Object.entries(data.routings)) {
                const destMap = new Map();
                for (const [destId, routing] of Object.entries(destinations)) {
                    destMap.set(destId, routing);
                }
                this.routingMap.set(sourceId, destMap);
            }
        }
        
        console.log('[RoutingMatrix] Loaded routing matrix');
    }
    
    /**
     * Create a routing preset.
     * @param {string} name - Preset name
     * @param {string} description - Preset description
     * @returns {string} Preset ID
     */
    createRoutingPreset(name, description = '') {
        const presetId = `preset_${Date.now()}`;
        
        this.routingPresets.set(presetId, {
            id: presetId,
            name: name,
            description: description,
            matrix: this.getRoutingMatrix(),
            createdAt: Date.now()
        });
        
        console.log(`[RoutingMatrix] Created routing preset "${name}"`);
        return presetId;
    }
    
    /**
     * Apply a routing preset.
     * @param {string} presetId - Preset ID
     * @returns {boolean} True if applied
     */
    applyRoutingPreset(presetId) {
        const preset = this.routingPresets.get(presetId);
        if (!preset) return false;
        
        this.loadRoutingMatrix(preset.matrix);
        console.log(`[RoutingMatrix] Applied routing preset "${preset.name}"`);
        return true;
    }
    
    /**
     * Delete a routing preset.
     * @param {string} presetId - Preset ID
     * @returns {boolean} True if deleted
     */
    deleteRoutingPreset(presetId) {
        const deleted = this.routingPresets.delete(presetId);
        if (deleted) {
            console.log(`[RoutingMatrix] Deleted routing preset ${presetId}`);
        }
        return deleted;
    }
    
    /**
     * Get all routing presets.
     * @returns {Array} Array of presets
     */
    getRoutingPresets() {
        return Array.from(this.routingPresets.values());
    }
    
    /**
     * Generate HTML for routing matrix visualization.
     * @param {Array} trackIds - Array of track IDs
     * @returns {string} HTML string
     */
    generateMatrixHTML(trackIds) {
        const buses = this.getBuses();
        
        let html = '<div class="routing-matrix">';
        
        // Header row with bus names
        html += '<div class="matrix-header"><div class="matrix-corner">Tracks ↓ / Buses →</div>';
        buses.forEach(bus => {
            html += `<div class="matrix-bus-header" style="border-color: ${bus.color}">${escapeHtml(bus.name)}</div>`;
        });
        html += '</div>';
        
        // Track rows
        trackIds.forEach(trackId => {
            const trackName = this.appServices?.getTrackName?.(trackId) || `Track ${trackId}`;
            html += `<div class="matrix-row"><div class="matrix-track-name">${escapeHtml(trackName)}</div>`;
            
            buses.forEach(bus => {
                const routing = this.getRoutingsFromSource(String(trackId)).get(bus.id);
                const amount = routing ? routing.amount : 0;
                const enabled = routing ? routing.enabled : false;
                const opacity = enabled ? amount : 0;
                
                html += `<div class="matrix-cell" data-track="${trackId}" data-bus="${bus.id}">
                    <input type="range" min="0" max="1" step="0.01" value="${amount}" 
                           class="routing-slider" ${!enabled ? 'disabled' : ''}>
                    <div class="routing-indicator" style="opacity: ${opacity}; background: ${bus.color}"></div>
                </div>`;
            });
            
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    }
    
    /**
     * Export routing matrix to JSON.
     * @returns {string} JSON string
     */
    toJSON() {
        return JSON.stringify({
            version: 1,
            buses: this.getBuses(),
            routings: Object.fromEntries(
                Array.from(this.routingMap.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
            ),
            presets: Object.fromEntries(this.routingPresets)
        }, null, 2);
    }
    
    /**
     * Import routing matrix from JSON.
     * @param {string} jsonString - JSON string
     * @returns {boolean} True if imported
     */
    fromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // Load buses
            this.buses.clear();
            data.buses?.forEach(bus => {
                this.buses.set(bus.id, bus);
            });
            
            // Load routings
            this.routingMap.clear();
            if (data.routings) {
                for (const [sourceId, destinations] of Object.entries(data.routings)) {
                    const destMap = new Map();
                    for (const [destId, routing] of Object.entries(destinations)) {
                        destMap.set(destId, routing);
                    }
                    this.routingMap.set(sourceId, destMap);
                }
            }
            
            // Load presets
            if (data.presets) {
                this.routingPresets = new Map(Object.entries(data.presets));
            }
            
            console.log('[RoutingMatrix] Imported routing matrix');
            return true;
        } catch (e) {
            console.error('[RoutingMatrix] Import failed:', e);
            return false;
        }
    }
    
    /**
     * Clear all routings and buses.
     */
    clearAll() {
        this.buses.clear();
        this.routingMap.clear();
        this.routingPresets.clear();
        this.initializeDefaultBuses();
        console.log('[RoutingMatrix] Cleared all routings');
    }
}

/**
 * Helper function to escape HTML.
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Create a routing matrix manager.
 */
export function createRoutingMatrixManager(appServices) {
    return new RoutingMatrixManager(appServices);
}

// Default export
export default {
    RoutingType,
    BusType,
    RoutingMatrixManager,
    createRoutingMatrixManager
};