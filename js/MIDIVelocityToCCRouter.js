/**
 * MIDI Velocity to CC Router
 * Routes MIDI velocity values to any MIDI CC parameter for modulation
 * Useful for expression, brightness, or any velocity-sensitive modulation
 */

class MIDIVelocityToCCRouter {
    constructor() {
        this.name = 'MIDIVelocityToCCRouter';
        
        // Routes: each maps velocity -> CC output
        this.routes = new Map();
        
        // MIDI access
        this.midiAccess = null;
        this.midiInput = null;
        this.midiOutput = null;
        
        // Event forwarding
        this.onCCOutput = null;
        
        this.init();
    }
    
    async init() {
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            
            // Auto-connect first input/output
            for (const input of this.midiAccess.inputs.values()) {
                this.midiInput = input;
                input.onmidimessage = (e) => this.handleMIDI(e);
                break;
            }
            
            for (const output of this.midiAccess.outputs.values()) {
                this.midiOutput = output;
                break;
            }
            
            console.log('[MIDIVelocityToCCRouter] Initialized');
        } catch (err) {
            console.warn('[MIDIVelocityToCCRouter] Web MIDI API not available:', err);
        }
    }
    
    handleMIDI(event) {
        const [status, data1, data2] = event.data;
        const messageType = status & 0xF0;
        
        // Only process Note On messages to extract velocity
        if (messageType === 0x90 && data2 > 0) {
            const velocity = data2;
            const note = data1;
            
            // Process each active route
            for (const [routeId, route] of this.routes) {
                if (!route.enabled) continue;
                
                // Transform velocity to CC value
                const normalizedVelocity = velocity / 127;
                let ccValue;
                
                switch (route.curve) {
                    case 'linear':
                        ccValue = normalizedVelocity;
                        break;
                    case 'exp':
                        ccValue = Math.pow(normalizedVelocity, 2);
                        break;
                    case 'log':
                        ccValue = Math.sqrt(normalizedVelocity);
                        break;
                    case 'fixed':
                        // Use fixed CC value from route
                        ccValue = route.fixedValue ?? 0.5;
                        break;
                    default:
                        ccValue = normalizedVelocity;
                }
                
                // Apply range mapping
                const rangeMin = route.rangeMin ?? 0;
                const rangeMax = route.rangeMax ?? 127;
                const finalValue = Math.round(rangeMin + ccValue * (rangeMax - rangeMin));
                
                // Send CC message
                this.sendCC(route.targetCC, finalValue, route.targetChannel ?? 1);
                
                if (this.onCCOutput) {
                    this.onCCOutput({
                        routeId,
                        velocity,
                        cc: route.targetCC,
                        value: finalValue
                    });
                }
            }
        }
    }
    
    sendCC(ccNumber, value, channel = 1) {
        if (this.midiOutput) {
            const status = 0xB0 | ((channel - 1) & 0x0F);
            this.midiOutput.send([status, ccNumber, value]);
        }
    }
    
    // Route management
    createRoute(options = {}) {
        const id = `vel2cc_${Date.now()}`;
        
        const route = {
            id,
            name: options.name || `Route ${this.routes.size + 1}`,
            enabled: true,
            
            // Target CC
            targetCC: options.targetCC ?? 1, // Default to CC1 (Mod Wheel)
            targetChannel: options.targetChannel ?? 1,
            
            // Velocity mapping
            curve: options.curve || 'linear', // 'linear', 'exp', 'log', 'fixed'
            fixedValue: options.fixedValue ?? null, // For 'fixed' curve
            
            // Output range
            rangeMin: options.rangeMin ?? 0,
            rangeMax: options.rangeMax ?? 127,
            
            // Optional note filter (only process specific notes)
            noteFilter: options.noteFilter ?? null, // null = all notes, or array of note numbers
            noteFilterMode: options.noteFilterMode ?? 'include' // 'include' or 'exclude'
        };
        
        this.routes.set(id, route);
        return id;
    }
    
    updateRoute(routeId, updates) {
        const route = this.routes.get(routeId);
        if (!route) return false;
        
        Object.assign(route, updates);
        return true;
    }
    
    removeRoute(routeId) {
        return this.routes.delete(routeId);
    }
    
    enableRoute(routeId, enabled = true) {
        const route = this.routes.get(routeId);
        if (!route) return false;
        route.enabled = enabled;
        return true;
    }
    
    getRoutes() {
        return Array.from(this.routes.values()).map(r => ({ ...r }));
    }
    
    getRoute(routeId) {
        const route = this.routes.get(routeId);
        return route ? { ...route } : null;
    }
    
    // Preset management
    savePreset() {
        return {
            routes: this.getRoutes(),
            timestamp: Date.now()
        };
    }
    
    loadPreset(preset) {
        this.routes.clear();
        
        for (const routeData of preset.routes) {
            const { id, ...options } = routeData;
            this.createRoute(options);
        }
    }
    
    // UI Panel
    openPanel() {
        const existing = document.getElementById('vel2cc-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'vel2cc-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 700px;
            max-height: 80vh;
            overflow-y: auto;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
        `;
        
        panel.innerHTML = `
            <div style="padding: 20px; border-bottom: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 18px;">MIDI Velocity → CC Router</h2>
                    <button id="close-btn" style="padding: 8px 16px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">Close</button>
                </div>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #888;">Route MIDI note velocity to any CC parameter</p>
            </div>
            
            <div style="padding: 20px;">
                <button id="add-route-btn" style="padding: 10px 20px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 14px; margin-bottom: 16px;">+ Add Route</button>
                
                <div id="routes-list" style="display: grid; gap: 12px;"></div>
                
                <div id="no-routes-message" style="text-align: center; padding: 40px; color: #666;">
                    No velocity-to-CC routes defined
                </div>
            </div>
            
            <div style="padding: 16px 20px; border-top: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <button id="save-preset-btn" style="padding: 8px 16px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">Save Preset</button>
                    <button id="load-preset-btn" style="padding: 8px 16px; background: #6366f1; border: none; border-radius: 4px; color: white; cursor: pointer;">Load Preset</button>
                </div>
                <div id="stats" style="font-size: 12px; color: #888;"></div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Event handlers
        panel.querySelector('#close-btn').onclick = () => panel.remove();
        panel.querySelector('#add-route-btn').onclick = () => this.addRoute();
        
        panel.querySelector('#save-preset-btn').onclick = () => this.savePresetFile();
        panel.querySelector('#load-preset-btn').onclick = () => this.loadPresetFile();
        
        this.panel = panel;
        this.updateDisplay();
    }
    
    updateDisplay() {
        if (!this.panel) return;
        
        const routesList = this.panel.querySelector('#routes-list');
        const noRoutesMsg = this.panel.querySelector('#no-routes-message');
        
        const routes = this.getRoutes();
        
        if (routes.length === 0) {
            routesList.innerHTML = '';
            noRoutesMsg.style.display = 'block';
            return;
        }
        
        noRoutesMsg.style.display = 'none';
        routesList.innerHTML = routes.map(route => this.renderRouteCard(route)).join('');
        
        // Attach event handlers
        routes.forEach(route => {
            const card = routesList.querySelector(`[data-route-id="${route.id}"]`);
            
            card.querySelector('.enable-toggle').checked = route.enabled;
            card.querySelector('.enable-toggle').onchange = (e) => {
                this.enableRoute(route.id, e.target.checked);
                this.updateDisplay();
            };
            
            card.querySelector('.name-input').value = route.name;
            card.querySelector('.name-input').onchange = (e) => {
                this.updateRoute(route.id, { name: e.target.value });
            };
            
            card.querySelector('.cc-input').value = route.targetCC;
            card.querySelector('.cc-input').onchange = (e) => {
                this.updateRoute(route.id, { targetCC: parseInt(e.target.value) || 1 });
            };
            
            card.querySelector('.channel-input').value = route.targetChannel;
            card.querySelector('.channel-input').onchange = (e) => {
                this.updateRoute(route.id, { targetChannel: parseInt(e.target.value) || 1 });
            };
            
            card.querySelector('.curve-select').value = route.curve;
            card.querySelector('.curve-select').onchange = (e) => {
                this.updateRoute(route.id, { curve: e.target.value });
                this.updateDisplay();
            };
            
            card.querySelector('.range-min-input').value = route.rangeMin;
            card.querySelector('.range-min-input').onchange = (e) => {
                this.updateRoute(route.id, { rangeMin: parseInt(e.target.value) || 0 });
            };
            
            card.querySelector('.range-max-input').value = route.rangeMax;
            card.querySelector('.range-max-input').onchange = (e) => {
                this.updateRoute(route.id, { rangeMax: parseInt(e.target.value) || 127 });
            };
            
            card.querySelector('.delete-btn').onclick = () => {
                this.removeRoute(route.id);
                this.updateDisplay();
            };
        });
    }
    
    renderRouteCard(route) {
        const curveOptions = `
            <select class="curve-select" style="padding: 4px 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
                <option value="linear" ${route.curve === 'linear' ? 'selected' : ''}>Linear</option>
                <option value="exp" ${route.curve === 'exp' ? 'selected' : ''}>Exponential</option>
                <option value="log" ${route.curve === 'log' ? 'selected' : ''}>Logarithmic</option>
            </select>
        `;
        
        return `
            <div data-route-id="${route.id}" style="background: #2a2a4e; border-radius: 8px; padding: 16px; border-left: 4px solid #10b981;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <input type="text" class="name-input" value="${route.name}" style="
                        background: transparent;
                        border: none;
                        color: white;
                        font-size: 14px;
                        font-weight: 600;
                        width: 150px;
                    ">
                    <button class="delete-btn" style="padding: 4px 8px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">Delete</button>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                    <div>
                        <label style="font-size: 11px; color: #888; display: block; margin-bottom: 4px;">CC Number</label>
                        <input type="number" class="cc-input" value="${route.targetCC}" min="0" max="127" style="
                            width: 100%;
                            padding: 6px 8px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        ">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #888; display: block; margin-bottom: 4px;">Channel</label>
                        <input type="number" class="channel-input" value="${route.targetChannel}" min="1" max="16" style="
                            width: 100%;
                            padding: 6px 8px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        ">
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #888; display: block; margin-bottom: 4px;">Curve</label>
                        ${curveOptions}
                    </div>
                    <div>
                        <label style="font-size: 11px; color: #888; display: block; margin-bottom: 4px;">Range</label>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <input type="number" class="range-min-input" value="${route.rangeMin}" min="0" max="127" style="
                                width: 50px;
                                padding: 6px 4px;
                                background: #1a1a2e;
                                border: 1px solid #444;
                                border-radius: 4px;
                                color: white;
                                font-size: 12px;
                            ">
                            <span style="color: #666;">-</span>
                            <input type="number" class="range-max-input" value="${route.rangeMax}" min="0" max="127" style="
                                width: 50px;
                                padding: 6px 4px;
                                background: #1a1a2e;
                                border: 1px solid #444;
                                border-radius: 4px;
                                color: white;
                                font-size: 12px;
                            ">
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 12px; display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" class="enable-toggle" ${route.enabled ? 'checked' : ''} style="accent-color: #10b981;">
                    <span style="font-size: 12px; color: ${route.enabled ? '#10b981' : '#666'};">${route.enabled ? 'Active' : 'Disabled'}</span>
                </div>
            </div>
        `;
    }
    
    addRoute() {
        this.createRoute({
            name: `Route ${this.routes.size + 1}`,
            targetCC: 1,
            targetChannel: 1,
            curve: 'linear',
            rangeMin: 0,
            rangeMax: 127
        });
        this.updateDisplay();
    }
    
    savePresetFile() {
        const preset = this.savePreset();
        const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'velocity_to_cc_preset.json';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    loadPresetFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const text = await file.text();
                try {
                    const preset = JSON.parse(text);
                    this.loadPreset(preset);
                    this.updateDisplay();
                } catch (err) {
                    console.error('Failed to load preset:', err);
                }
            }
        };
        input.click();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MIDIVelocityToCCRouter };
} else if (typeof window !== 'undefined') {
    window.MIDIVelocityToCCRouter = MIDIVelocityToCCRouter;
}