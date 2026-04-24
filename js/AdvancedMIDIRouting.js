/**
 * Advanced MIDI Routing - Complex MIDI routing matrix
 * Allows flexible MIDI routing between inputs, tracks, and outputs
 */

class AdvancedMIDIRouting {
    constructor() {
        this.name = 'AdvancedMIDIRouting';
        
        // Routing matrix: source -> destinations
        this.routingMatrix = new Map();
        
        // Available MIDI inputs (from Web MIDI API)
        this.midiInputs = [];
        this.midiOutputs = [];
        
        // Track routing configuration
        this.trackRouting = new Map();
        
        // Channel filters per route
        this.channelFilters = new Map();
        
        // Note remapping tables
        this.noteRemapping = new Map();
        
        // Velocity transformations
        this.velocityTransforms = new Map();
        
        // Transpose settings per route
        this.transposeSettings = new Map();
        
        // Arpeggiator settings per route
        this.arpeggiatorSettings = new Map();
        
        // MIDI thru status
        this.midiThruEnabled = new Map();
        
        // Event listeners
        this.onRouteChange = null;
        this.onMIDIEvent = null;
        
        // Statistics
        this.stats = {
            eventsProcessed: 0,
            eventsRouted: 0,
            eventsDropped: 0
        };
        
        // Initialize
        this.init();
    }
    
    async init() {
        try {
            const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            
            // Store inputs
            midiAccess.inputs.forEach((input, id) => {
                this.midiInputs.push({
                    id,
                    name: input.name,
                    manufacturer: input.manufacturer,
                    connection: input.connection,
                    input
                });
                
                // Set up listener for each input
                input.onmidimessage = (event) => this.handleMIDIInput(id, event);
            });
            
            // Store outputs
            midiAccess.outputs.forEach((output, id) => {
                this.midiOutputs.push({
                    id,
                    name: output.name,
                    manufacturer: output.manufacturer,
                    connection: output.connection,
                    output
                });
            });
            
            // Listen for device changes
            midiAccess.onstatechange = (event) => this.handleDeviceStateChange(event);
            
            console.log(`[AdvancedMIDIRouting] Initialized with ${this.midiInputs.length} inputs, ${this.midiOutputs.length} outputs`);
        } catch (err) {
            console.warn('[AdvancedMIDIRouting] Web MIDI API not available:', err);
        }
    }
    
    handleDeviceStateChange(event) {
        const port = event.port;
        
        if (port.type === 'input') {
            if (port.state === 'connected') {
                // Add new input
                const existing = this.midiInputs.find(i => i.id === port.id);
                if (!existing) {
                    this.midiInputs.push({
                        id: port.id,
                        name: port.name,
                        manufacturer: port.manufacturer,
                        connection: port.connection,
                        input: port
                    });
                    port.onmidimessage = (event) => this.handleMIDIInput(port.id, event);
                }
            } else {
                // Remove disconnected input
                this.midiInputs = this.midiInputs.filter(i => i.id !== port.id);
            }
        } else if (port.type === 'output') {
            if (port.state === 'connected') {
                const existing = this.midiOutputs.find(o => o.id === port.id);
                if (!existing) {
                    this.midiOutputs.push({
                        id: port.id,
                        name: port.name,
                        manufacturer: port.manufacturer,
                        connection: port.connection,
                        output: port
                    });
                }
            } else {
                this.midiOutputs = this.midiOutputs.filter(o => o.id !== port.id);
            }
        }
        
        if (this.onRouteChange) {
            this.onRouteChange({ type: 'device_state_change', port });
        }
    }
    
    handleMIDIInput(inputId, event) {
        this.stats.eventsProcessed++;
        
        const [status, data1, data2] = event.data;
        const channel = (status & 0x0F) + 1;
        const messageType = status & 0xF0;
        
        const midiEvent = {
            inputId,
            channel,
            messageType,
            data1,
            data2,
            timestamp: event.timeStamp,
            note: data1,
            velocity: data2
        };
        
        // Get routes for this input
        const routes = this.routingMatrix.get(inputId) || [];
        
        if (routes.length === 0) {
            this.stats.eventsDropped++;
            return;
        }
        
        // Process each route
        for (const route of routes) {
            const transformedEvent = this.transformEvent(midiEvent, route);
            
            if (transformedEvent) {
                this.routeEvent(transformedEvent, route);
                this.stats.eventsRouted++;
            }
        }
        
        if (this.onMIDIEvent) {
            this.onMIDIEvent(midiEvent);
        }
    }
    
    transformEvent(event, route) {
        let transformed = { ...event };
        
        // Channel filter
        const channelFilter = this.channelFilters.get(route.id);
        if (channelFilter) {
            if (channelFilter.mode === 'allow' && !channelFilter.channels.includes(event.channel)) {
                return null;
            }
            if (channelFilter.mode === 'block' && channelFilter.channels.includes(event.channel)) {
                return null;
            }
            
            // Channel remap
            if (channelFilter.remapTo) {
                transformed.channel = channelFilter.remapTo;
                transformed.status = (event.messageType) | (channelFilter.remapTo - 1);
            }
        }
        
        // Note remapping
        const noteMap = this.noteRemapping.get(route.id);
        if (noteMap && noteMap.has(event.note)) {
            transformed.note = noteMap.get(event.note);
            transformed.data1 = transformed.note;
        }
        
        // Transpose
        const transpose = this.transposeSettings.get(route.id) || 0;
        if (transpose !== 0 && event.messageType === 0x90) {
            transformed.note = Math.max(0, Math.min(127, event.note + transpose));
            transformed.data1 = transformed.note;
        }
        
        // Velocity transform
        const velTransform = this.velocityTransforms.get(route.id);
        if (velTransform && event.messageType === 0x90 && event.velocity > 0) {
            let newVelocity = event.velocity;
            
            // Apply scale
            if (velTransform.scale) {
                newVelocity = Math.round(newVelocity * velTransform.scale);
            }
            
            // Apply offset
            if (velTransform.offset) {
                newVelocity = Math.round(newVelocity + velTransform.offset);
            }
            
            // Apply curve
            if (velTransform.curve) {
                const normalized = newVelocity / 127;
                let curved;
                switch (velTransform.curve) {
                    case 'exp':
                        curved = Math.pow(normalized, 2);
                        break;
                    case 'log':
                        curved = Math.sqrt(normalized);
                        break;
                    case 'linear':
                    default:
                        curved = normalized;
                }
                newVelocity = Math.round(curved * 127);
            }
            
            // Clamp
            newVelocity = Math.max(1, Math.min(127, newVelocity));
            transformed.velocity = newVelocity;
            transformed.data2 = newVelocity;
        }
        
        // Arpeggiator
        const arpSettings = this.arpeggiatorSettings.get(route.id);
        if (arpSettings && arpSettings.enabled && event.messageType === 0x90) {
            // This would integrate with a separate arpeggiator module
            // For now, just pass through
        }
        
        return transformed;
    }
    
    routeEvent(event, route) {
        switch (route.destination.type) {
            case 'track':
                this.routeToTrack(event, route.destination);
                break;
            case 'output':
                this.routeToOutput(event, route.destination);
                break;
            case 'virtual':
                this.routeToVirtual(event, route.destination);
                break;
        }
    }
    
    routeToTrack(event, destination) {
        // This would integrate with the DAW's track system
        // Emit event for track processing
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('midi-to-track', {
                detail: {
                    trackId: destination.trackId,
                    event
                }
            }));
        }
    }
    
    routeToOutput(event, destination) {
        const output = this.midiOutputs.find(o => o.id === destination.outputId);
        if (output && output.output) {
            const status = event.messageType | ((event.channel - 1) & 0x0F);
            output.output.send([status, event.data1, event.data2], event.timestamp);
        }
    }
    
    routeToVirtual(event, destination) {
        // Route to virtual destinations (internal instruments)
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('midi-to-virtual', {
                detail: {
                    virtualId: destination.virtualId,
                    event
                }
            }));
        }
    }
    
    // Route management
    createRoute(sourceId, destination, options = {}) {
        const routeId = `route_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const route = {
            id: routeId,
            sourceId,
            destination,
            enabled: true,
            ...options
        };
        
        if (!this.routingMatrix.has(sourceId)) {
            this.routingMatrix.set(sourceId, []);
        }
        
        this.routingMatrix.get(sourceId).push(route);
        
        // Apply optional settings
        if (options.channelFilter) {
            this.setChannelFilter(routeId, options.channelFilter);
        }
        if (options.transpose) {
            this.setTranspose(routeId, options.transpose);
        }
        if (options.velocityTransform) {
            this.setVelocityTransform(routeId, options.velocityTransform);
        }
        if (options.noteMap) {
            this.setNoteRemapping(routeId, options.noteMap);
        }
        
        if (this.onRouteChange) {
            this.onRouteChange({ type: 'route_created', route });
        }
        
        return routeId;
    }
    
    removeRoute(routeId) {
        for (const [sourceId, routes] of this.routingMatrix) {
            const index = routes.findIndex(r => r.id === routeId);
            if (index !== -1) {
                routes.splice(index, 1);
                
                // Clean up associated settings
                this.channelFilters.delete(routeId);
                this.noteRemapping.delete(routeId);
                this.velocityTransforms.delete(routeId);
                this.transposeSettings.delete(routeId);
                this.arpeggiatorSettings.delete(routeId);
                
                if (this.onRouteChange) {
                    this.onRouteChange({ type: 'route_removed', routeId });
                }
                return true;
            }
        }
        return false;
    }
    
    enableRoute(routeId, enabled = true) {
        for (const routes of this.routingMatrix.values()) {
            const route = routes.find(r => r.id === routeId);
            if (route) {
                route.enabled = enabled;
                if (this.onRouteChange) {
                    this.onRouteChange({ type: 'route_updated', route });
                }
                return true;
            }
        }
        return false;
    }
    
    // Channel filter
    setChannelFilter(routeId, filter) {
        this.channelFilters.set(routeId, {
            mode: filter.mode || 'allow', // 'allow' or 'block'
            channels: filter.channels || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
            remapTo: filter.remapTo || null
        });
    }
    
    // Note remapping
    setNoteRemapping(routeId, mapping) {
        if (!this.noteRemapping.has(routeId)) {
            this.noteRemapping.set(routeId, new Map());
        }
        const noteMap = this.noteRemapping.get(routeId);
        
        for (const [from, to] of Object.entries(mapping)) {
            noteMap.set(parseInt(from), parseInt(to));
        }
    }
    
    // Velocity transform
    setVelocityTransform(routeId, transform) {
        this.velocityTransforms.set(routeId, {
            scale: transform.scale ?? 1.0,
            offset: transform.offset ?? 0,
            curve: transform.curve || 'linear'
        });
    }
    
    // Transpose
    setTranspose(routeId, semitones) {
        this.transposeSettings.set(routeId, semitones);
    }
    
    // Arpeggiator
    setArpeggiator(routeId, settings) {
        this.arpeggiatorSettings.set(routeId, {
            enabled: settings.enabled ?? false,
            style: settings.style || 'up', // up, down, updown, random, order
            rate: settings.rate || 100, // ms
            gate: settings.gate || 0.8, // 0-1
            octaves: settings.octaves || 1
        });
    }
    
    // Get all routes
    getAllRoutes() {
        const routes = [];
        for (const [sourceId, sourceRoutes] of this.routingMatrix) {
            for (const route of sourceRoutes) {
                routes.push({
                    ...route,
                    channelFilter: this.channelFilters.get(route.id),
                    noteRemapping: this.noteRemapping.has(route.id) 
                        ? Object.fromEntries(this.noteRemapping.get(route.id)) 
                        : null,
                    velocityTransform: this.velocityTransforms.get(route.id),
                    transpose: this.transposeSettings.get(route.id),
                    arpeggiator: this.arpeggiatorSettings.get(route.id)
                });
            }
        }
        return routes;
    }
    
    // Get available sources
    getAvailableSources() {
        return [
            // MIDI input devices
            ...this.midiInputs.map(i => ({
                id: i.id,
                name: i.name,
                type: 'midi_input'
            })),
            // Virtual sources (for internal routing)
            { id: 'virtual_keyboard', name: 'Virtual Keyboard', type: 'virtual' },
            { id: 'piano_roll', name: 'Piano Roll', type: 'virtual' },
            { id: 'sequencer', name: 'Sequencer', type: 'virtual' }
        ];
    }
    
    // Get available destinations
    getAvailableDestinations() {
        return [
            // Tracks (would be populated from DAW state)
            { type: 'track', name: 'Track routing', dynamic: true },
            // MIDI output devices
            ...this.midiOutputs.map(o => ({
                type: 'output',
                id: o.id,
                name: o.name
            })),
            // Virtual destinations
            { type: 'virtual', id: 'synth_1', name: 'Synth 1' },
            { type: 'virtual', id: 'sampler', name: 'Sampler' },
            { type: 'virtual', id: 'drum_machine', name: 'Drum Machine' }
        ];
    }
    
    // Statistics
    getStats() {
        return { ...this.stats };
    }
    
    resetStats() {
        this.stats = {
            eventsProcessed: 0,
            eventsRouted: 0,
            eventsDropped: 0
        };
    }
    
    // Preset management
    saveRoutingPreset() {
        return {
            routes: this.getAllRoutes(),
            timestamp: Date.now()
        };
    }
    
    loadRoutingPreset(preset) {
        // Clear existing routing
        this.routingMatrix.clear();
        this.channelFilters.clear();
        this.noteRemapping.clear();
        this.velocityTransforms.clear();
        this.transposeSettings.clear();
        this.arpeggiatorSettings.clear();
        
        // Load routes from preset
        for (const route of preset.routes) {
            const routeId = this.createRoute(route.sourceId, route.destination, {
                enabled: route.enabled
            });
            
            if (route.channelFilter) {
                this.setChannelFilter(routeId, route.channelFilter);
            }
            if (route.noteRemapping) {
                this.setNoteRemapping(routeId, route.noteRemapping);
            }
            if (route.velocityTransform) {
                this.setVelocityTransform(routeId, route.velocityTransform);
            }
            if (route.transpose) {
                this.setTranspose(routeId, route.transpose);
            }
            if (route.arpeggiator) {
                this.setArpeggiator(routeId, route.arpeggiator);
            }
        }
    }
    
    // UI Panel
    openRoutingPanel() {
        const existing = document.getElementById('midi-routing-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'midi-routing-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 900px;
            max-height: 80vh;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
            overflow: hidden;
        `;
        
        panel.innerHTML = `
            <div style="padding: 20px; border-bottom: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 20px;">Advanced MIDI Routing</h2>
                    <div>
                        <button id="save-preset-btn" style="padding: 8px 16px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">Save Preset</button>
                        <button id="load-preset-btn" style="padding: 8px 16px; background: #6366f1; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">Load Preset</button>
                        <button id="close-routing-panel" style="padding: 8px 16px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">Close</button>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; height: calc(80vh - 120px);">
                <!-- Sources Panel -->
                <div style="width: 250px; border-right: 1px solid #333; overflow-y: auto;">
                    <div style="padding: 12px; background: #252547; position: sticky; top: 0;">
                        <h3 style="margin: 0; font-size: 14px; color: #888;">SOURCES</h3>
                    </div>
                    <div id="sources-list" style="padding: 12px;"></div>
                </div>
                
                <!-- Routing Matrix -->
                <div style="flex: 1; overflow-y: auto;">
                    <div style="padding: 12px; background: #252547; position: sticky; top: 0;">
                        <h3 style="margin: 0; font-size: 14px; color: #888;">ROUTING MATRIX</h3>
                    </div>
                    <div id="routing-matrix" style="padding: 12px;"></div>
                </div>
                
                <!-- Destinations Panel -->
                <div style="width: 250px; border-left: 1px solid #333; overflow-y: auto;">
                    <div style="padding: 12px; background: #252547; position: sticky; top: 0;">
                        <h3 style="margin: 0; font-size: 14px; color: #888;">DESTINATIONS</h3>
                    </div>
                    <div id="destinations-list" style="padding: 12px;"></div>
                </div>
            </div>
            
            <div style="padding: 12px 20px; border-top: 1px solid #333; background: #252547; display: flex; justify-content: space-between; align-items: center;">
                <div id="routing-stats" style="font-size: 12px; color: #888;"></div>
                <div>
                    <button id="clear-all-routes" style="padding: 6px 12px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer;">Clear All Routes</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Populate sources
        const sourcesList = panel.querySelector('#sources-list');
        const sources = this.getAvailableSources();
        sourcesList.innerHTML = sources.map(s => `
            <div class="source-item" data-source-id="${s.id}" style="
                padding: 10px;
                background: #2a2a4e;
                border-radius: 4px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: background 0.2s;
            " onmouseover="this.style.background='#3a3a5e'" onmouseout="this.style.background='#2a2a4e'">
                <div style="font-weight: 600;">${s.name}</div>
                <div style="font-size: 11px; color: #888;">${s.type}</div>
            </div>
        `).join('');
        
        // Populate destinations
        const destsList = panel.querySelector('#destinations-list');
        const dests = this.getAvailableDestinations();
        destsList.innerHTML = dests.map(d => `
            <div class="dest-item" data-dest-type="${d.type}" data-dest-id="${d.id || ''}" style="
                padding: 10px;
                background: #2a2a4e;
                border-radius: 4px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: background 0.2s;
            " onmouseover="this.style.background='#3a3a5e'" onmouseout="this.style.background='#2a2a4e'">
                <div style="font-weight: 600;">${d.name}</div>
                <div style="font-size: 11px; color: #888;">${d.type}${d.id ? `: ${d.id}` : ''}</div>
            </div>
        `).join('');
        
        // Populate routing matrix
        this.updateRoutingMatrix(panel);
        
        // Event handlers
        panel.querySelector('#close-routing-panel').onclick = () => panel.remove();
        
        panel.querySelector('#clear-all-routes').onclick = () => {
            this.routingMatrix.clear();
            this.channelFilters.clear();
            this.noteRemapping.clear();
            this.velocityTransforms.clear();
            this.transposeSettings.clear();
            this.arpeggiatorSettings.clear();
            this.updateRoutingMatrix(panel);
        };
        
        panel.querySelector('#save-preset-btn').onclick = () => {
            const preset = this.saveRoutingPreset();
            const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'midi_routing_preset.json';
            a.click();
            URL.revokeObjectURL(url);
        };
        
        panel.querySelector('#load-preset-btn').onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const text = await file.text();
                    try {
                        const preset = JSON.parse(text);
                        this.loadRoutingPreset(preset);
                        this.updateRoutingMatrix(panel);
                    } catch (err) {
                        console.error('Failed to load preset:', err);
                    }
                }
            };
            input.click();
        };
        
        // Stats update
        const statsEl = panel.querySelector('#routing-stats');
        const updateStats = () => {
            const stats = this.getStats();
            statsEl.textContent = `Processed: ${stats.eventsProcessed} | Routed: ${stats.eventsRouted} | Dropped: ${stats.eventsDropped}`;
        };
        updateStats();
        setInterval(updateStats, 1000);
        
        // Drag and drop for routing
        let selectedSource = null;
        
        sourcesList.querySelectorAll('.source-item').forEach(item => {
            item.onclick = () => {
                if (selectedSource) {
                    selectedSource.style.outline = 'none';
                }
                selectedSource = item;
                item.style.outline = '2px solid #3b82f6';
            };
        });
        
        destsList.querySelectorAll('.dest-item').forEach(item => {
            item.onclick = () => {
                if (selectedSource) {
                    const sourceId = selectedSource.dataset.sourceId;
                    const destType = item.dataset.destType;
                    const destId = item.dataset.destId;
                    
                    this.createRoute(sourceId, {
                        type: destType,
                        outputId: destType === 'output' ? destId : null,
                        trackId: destType === 'track' ? destId : null,
                        virtualId: destType === 'virtual' ? destId : null
                    });
                    
                    selectedSource.style.outline = 'none';
                    selectedSource = null;
                    this.updateRoutingMatrix(panel);
                }
            };
        });
    }
    
    updateRoutingMatrix(panel) {
        const matrix = panel.querySelector('#routing-matrix');
        const routes = this.getAllRoutes();
        
        if (routes.length === 0) {
            matrix.innerHTML = `
                <div style="text-align: center; color: #888; padding: 40px;">
                    <p>No routes configured</p>
                    <p style="font-size: 12px;">Click a source, then a destination to create a route</p>
                </div>
            `;
            return;
        }
        
        matrix.innerHTML = routes.map(route => `
            <div class="route-card" data-route-id="${route.id}" style="
                background: #2a2a4e;
                border-radius: 6px;
                padding: 16px;
                margin-bottom: 12px;
                border-left: 4px solid ${route.enabled ? '#10b981' : '#555'};
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <span style="font-weight: 600;">${route.sourceId}</span>
                        <span style="color: #888;">→</span>
                        <span style="font-weight: 600;">${route.destination.type}: ${route.destination.outputId || route.destination.trackId || route.destination.virtualId || 'unknown'}</span>
                    </div>
                    <div>
                        <button class="toggle-route-btn" data-route-id="${route.id}" style="
                            padding: 4px 8px;
                            background: ${route.enabled ? '#10b981' : '#555'};
                            border: none;
                            border-radius: 4px;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                            margin-right: 8px;
                        ">${route.enabled ? 'ON' : 'OFF'}</button>
                        <button class="delete-route-btn" data-route-id="${route.id}" style="
                            padding: 4px 8px;
                            background: #ef4444;
                            border: none;
                            border-radius: 4px;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                        ">Delete</button>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 12px;">
                    <div>
                        <label style="color: #888;">Transpose:</label>
                        <input type="number" class="transpose-input" data-route-id="${route.id}" value="${route.transpose || 0}" min="-24" max="24" style="
                            width: 100%;
                            padding: 4px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        ">
                    </div>
                    <div>
                        <label style="color: #888;">Vel Scale:</label>
                        <input type="number" class="vel-scale-input" data-route-id="${route.id}" value="${route.velocityTransform?.scale ?? 1}" min="0" max="2" step="0.1" style="
                            width: 100%;
                            padding: 4px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        ">
                    </div>
                    <div>
                        <label style="color: #888;">Vel Offset:</label>
                        <input type="number" class="vel-offset-input" data-route-id="${route.id}" value="${route.velocityTransform?.offset ?? 0}" min="-50" max="50" style="
                            width: 100%;
                            padding: 4px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        ">
                    </div>
                    <div>
                        <label style="color: #888;">Vel Curve:</label>
                        <select class="vel-curve-input" data-route-id="${route.id}" style="
                            width: 100%;
                            padding: 4px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        ">
                            <option value="linear" ${route.velocityTransform?.curve === 'linear' ? 'selected' : ''}>Linear</option>
                            <option value="exp" ${route.velocityTransform?.curve === 'exp' ? 'selected' : ''}>Exp</option>
                            <option value="log" ${route.velocityTransform?.curve === 'log' ? 'selected' : ''}>Log</option>
                        </select>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners for route controls
        matrix.querySelectorAll('.toggle-route-btn').forEach(btn => {
            btn.onclick = () => {
                const routeId = btn.dataset.routeId;
                const isCurrentlyEnabled = btn.textContent === 'ON';
                this.enableRoute(routeId, !isCurrentlyEnabled);
                this.updateRoutingMatrix(panel);
            };
        });
        
        matrix.querySelectorAll('.delete-route-btn').forEach(btn => {
            btn.onclick = () => {
                const routeId = btn.dataset.routeId;
                this.removeRoute(routeId);
                this.updateRoutingMatrix(panel);
            };
        });
        
        matrix.querySelectorAll('.transpose-input').forEach(input => {
            input.onchange = () => {
                const routeId = input.dataset.routeId;
                this.setTranspose(routeId, parseInt(input.value) || 0);
            };
        });
        
        matrix.querySelectorAll('.vel-scale-input').forEach(input => {
            input.onchange = () => {
                const routeId = input.dataset.routeId;
                const current = this.velocityTransforms.get(routeId) || {};
                this.setVelocityTransform(routeId, { ...current, scale: parseFloat(input.value) || 1 });
            };
        });
        
        matrix.querySelectorAll('.vel-offset-input').forEach(input => {
            input.onchange = () => {
                const routeId = input.dataset.routeId;
                const current = this.velocityTransforms.get(routeId) || {};
                this.setVelocityTransform(routeId, { ...current, offset: parseInt(input.value) || 0 });
            };
        });
        
        matrix.querySelectorAll('.vel-curve-input').forEach(input => {
            input.onchange = () => {
                const routeId = input.dataset.routeId;
                const current = this.velocityTransforms.get(routeId) || {};
                this.setVelocityTransform(routeId, { ...current, curve: input.value });
            };
        });
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdvancedMIDIRouting };
} else if (typeof window !== 'undefined') {
    window.AdvancedMIDIRouting = AdvancedMIDIRouting;
}