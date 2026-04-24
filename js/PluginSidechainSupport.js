/**
 * Plugin Sidechain Support - Sidechain input for loaded plugins
 * Enables sidechain routing for plugin effects
 */

class PluginSidechainSupport {
    constructor(audioContext, options = {}) {
        this.name = 'PluginSidechainSupport';
        this.audioContext = audioContext;
        
        // Configuration
        this.config = {
            defaultAttack: options.defaultAttack || 0.01,
            defaultRelease: options.defaultRelease || 0.1,
            defaultThreshold: options.defaultThreshold || -24,
            defaultRatio: options.defaultRatio || 4,
            ...options
        };
        
        // Sidechain configurations
        this.sidechains = new Map();
        
        // Available sources
        this.sources = new Map();
        
        // Routing matrix
        this.routing = new Map(); // sourceId -> [destinationIds]
        
        // Active connections
        this.connections = new Map();
        
        // Callbacks
        this.onSidechainChange = null;
        this.onRoutingChange = null;
    }
    
    // Source management
    registerSource(sourceId, sourceNode, options = {}) {
        this.sources.set(sourceId, {
            id: sourceId,
            node: sourceNode,
            name: options.name || sourceId,
            type: options.type || 'track', // 'track', 'bus', 'aux', 'master'
            color: options.color || `hsl(${(this.sources.size * 60) % 360}, 70%, 50%)`,
            enabled: true
        });
        
        return this.sources.get(sourceId);
    }
    
    unregisterSource(sourceId) {
        this.sources.delete(sourceId);
        
        // Remove from routing
        for (const [destId, sources] of this.routing) {
            this.routing.set(destId, sources.filter(s => s !== sourceId));
        }
        
        // Disconnect any active connections
        for (const [connectionId, connection] of this.connections) {
            if (connection.sourceId === sourceId) {
                this.disconnectSidechain(connectionId);
            }
        }
    }
    
    // Sidechain creation
    createSidechain(pluginId, options = {}) {
        const sidechain = {
            id: `sc_${pluginId}`,
            pluginId,
            
            // Source
            sourceId: options.sourceId || null,
            
            // Detection mode
            mode: options.mode || 'compressor', // 'compressor', 'trigger', 'envelope'
            
            // Compressor settings
            threshold: options.threshold ?? this.config.defaultThreshold,
            ratio: options.ratio ?? this.config.defaultRatio,
            attack: options.attack ?? this.config.defaultAttack,
            release: options.release ?? this.config.defaultRelease,
            knee: options.knee || 0,
            range: options.range || 0, // Gain reduction range
            
            // Envelope follower settings
            followerAttack: options.followerAttack || 0.01,
            followerRelease: options.followerRelease || 0.1,
            
            // Trigger settings
            triggerThreshold: options.triggerThreshold || -20,
            triggerHold: options.triggerHold || 0.05,
            
            // Filter settings (for frequency-conscious sidechain)
            filter: {
                enabled: options.filter?.enabled ?? false,
                type: options.filter?.type || 'bandpass',
                frequency: options.filter?.frequency || 1000,
                Q: options.filter?.Q || 1
            },
            
            // Lookahead
            lookahead: options.lookahead || 0,
            
            // Mix
            mix: options.mix ?? 1,
            
            // State
            enabled: true,
            active: false,
            gainReduction: 0
        };
        
        // Create audio nodes
        sidechain.nodes = this.createSidechainNodes(sidechain);
        
        this.sidechains.set(pluginId, sidechain);
        
        return sidechain;
    }
    
    createSidechainNodes(sidechain) {
        const ctx = this.audioContext;
        const nodes = {
            // Input for sidechain signal
            input: ctx.createGain(),
            
            // Detector (envelope follower)
            detector: ctx.createAnalyser(),
            
            // Filter (optional)
            filter: ctx.createBiquadFilter(),
            
            // Compressor for detection
            compressor: ctx.createDynamicsCompressor(),
            
            // Gain for control signal output
            output: ctx.createGain(),
            
            // Gain reduction meter
            meter: ctx.createGain()
        };
        
        // Configure filter
        nodes.filter.type = sidechain.filter.type;
        nodes.filter.frequency.value = sidechain.filter.frequency;
        nodes.filter.Q.value = sidechain.filter.Q;
        
        // Configure compressor
        nodes.compressor.threshold.value = sidechain.threshold;
        nodes.compressor.ratio.value = sidechain.ratio;
        nodes.compressor.attack.value = sidechain.attack;
        nodes.compressor.release.value = sidechain.release;
        nodes.compressor.knee.value = sidechain.knee;
        
        // Connect internal routing
        nodes.input.connect(nodes.filter);
        nodes.filter.connect(nodes.compressor);
        nodes.compressor.connect(nodes.output);
        nodes.compressor.connect(nodes.meter);
        
        return nodes;
    }
    
    removeSidechain(pluginId) {
        const sidechain = this.sidechains.get(pluginId);
        if (!sidechain) return false;
        
        // Disconnect
        this.disconnectSidechain(sidechain.id);
        
        // Clean up nodes
        if (sidechain.nodes) {
            sidechain.nodes.input.disconnect();
            sidechain.nodes.filter.disconnect();
            sidechain.nodes.compressor.disconnect();
            sidechain.nodes.output.disconnect();
            sidechain.nodes.meter.disconnect();
        }
        
        this.sidechains.delete(pluginId);
        return true;
    }
    
    // Connection management
    connectSidechain(sourceId, pluginId, options = {}) {
        const source = this.sources.get(sourceId);
        const sidechain = this.sidechains.get(pluginId);
        
        if (!source || !sidechain) return false;
        
        const connectionId = `${sourceId}_${pluginId}`;
        
        // Check if already connected
        if (this.connections.has(connectionId)) {
            return false;
        }
        
        // Connect source to sidechain input
        source.node.connect(sidechain.nodes.input);
        
        // Update sidechain source
        sidechain.sourceId = sourceId;
        
        // Store connection
        this.connections.set(connectionId, {
            id: connectionId,
            sourceId,
            pluginId,
            enabled: true
        });
        
        // Update routing
        if (!this.routing.has(sourceId)) {
            this.routing.set(sourceId, []);
        }
        this.routing.get(sourceId).push(pluginId);
        
        if (this.onRoutingChange) {
            this.onRoutingChange({ type: 'connect', sourceId, pluginId });
        }
        
        return true;
    }
    
    disconnectSidechain(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) return false;
        
        const source = this.sources.get(connection.sourceId);
        const sidechain = this.sidechains.get(connection.pluginId);
        
        if (source && sidechain && sidechain.nodes) {
            try {
                source.node.disconnect(sidechain.nodes.input);
            } catch (e) {
                // Already disconnected
            }
        }
        
        // Update routing
        const sources = this.routing.get(connection.sourceId);
        if (sources) {
            const index = sources.indexOf(connection.pluginId);
            if (index !== -1) {
                sources.splice(index, 1);
            }
        }
        
        this.connections.delete(connectionId);
        
        if (this.onRoutingChange) {
            this.onRoutingChange({ type: 'disconnect', connectionId });
        }
        
        return true;
    }
    
    // Sidechain control
    updateSidechainSettings(pluginId, settings) {
        const sidechain = this.sidechains.get(pluginId);
        if (!sidechain) return false;
        
        // Update settings
        Object.assign(sidechain, settings);
        
        // Update audio nodes
        if (sidechain.nodes) {
            if (settings.threshold !== undefined) {
                sidechain.nodes.compressor.threshold.value = settings.threshold;
            }
            if (settings.ratio !== undefined) {
                sidechain.nodes.compressor.ratio.value = settings.ratio;
            }
            if (settings.attack !== undefined) {
                sidechain.nodes.compressor.attack.value = settings.attack;
            }
            if (settings.release !== undefined) {
                sidechain.nodes.compressor.release.value = settings.release;
            }
            if (settings.knee !== undefined) {
                sidechain.nodes.compressor.knee.value = settings.knee;
            }
            if (settings.filter) {
                sidechain.nodes.filter.type.value = settings.filter.type || sidechain.nodes.filter.type.value;
                sidechain.nodes.filter.frequency.value = settings.filter.frequency ?? sidechain.nodes.filter.frequency.value;
                sidechain.nodes.filter.Q.value = settings.filter.Q ?? sidechain.nodes.filter.Q.value;
            }
        }
        
        if (this.onSidechainChange) {
            this.onSidechainChange({ pluginId, settings });
        }
        
        return true;
    }
    
    enableSidechain(pluginId, enabled = true) {
        const sidechain = this.sidechains.get(pluginId);
        if (!sidechain) return false;
        
        sidechain.enabled = enabled;
        
        // Mute/unmute sidechain input
        if (sidechain.nodes) {
            sidechain.nodes.input.gain.value = enabled ? 1 : 0;
        }
        
        if (this.onSidechainChange) {
            this.onSidechainChange({ pluginId, enabled });
        }
        
        return true;
    }
    
    // Get sidechain gain reduction (for metering)
    getGainReduction(pluginId) {
        const sidechain = this.sidechains.get(pluginId);
        if (!sidechain || !sidechain.nodes) return 0;
        
        // Get reduction from compressor
        const reduction = sidechain.nodes.compressor.reduction;
        sidechain.gainReduction = reduction;
        return reduction;
    }
    
    // Get all gain reductions
    getAllGainReductions() {
        const reductions = {};
        for (const [pluginId, sidechain] of this.sidechains) {
            reductions[pluginId] = this.getGainReduction(pluginId);
        }
        return reductions;
    }
    
    // Apply sidechain to a parameter (for external use)
    applyToParameter(pluginId, parameter) {
        const sidechain = this.sidechains.get(pluginId);
        if (!sidechain || !sidechain.enabled || !sidechain.nodes) return;
        
        // Connect sidechain output to parameter
        sidechain.nodes.output.connect(parameter);
    }
    
    // Presets
    getPreset(name) {
        const presets = {
            'ducking': {
                threshold: -20,
                ratio: 10,
                attack: 0.005,
                release: 0.2,
                mode: 'compressor'
            },
            'pumping': {
                threshold: -15,
                ratio: 8,
                attack: 0.01,
                release: 0.1,
                mode: 'compressor'
            },
            'gated': {
                threshold: -30,
                ratio: 20,
                attack: 0.001,
                release: 0.05,
                mode: 'trigger'
            },
            'subtle': {
                threshold: -30,
                ratio: 3,
                attack: 0.02,
                release: 0.3,
                mode: 'compressor'
            },
            'vocal': {
                threshold: -24,
                ratio: 4,
                attack: 0.01,
                release: 0.15,
                filter: {
                    enabled: true,
                    type: 'highpass',
                    frequency: 200,
                    Q: 1
                }
            },
            'kick_duck': {
                threshold: -18,
                ratio: 12,
                attack: 0.002,
                release: 0.08,
                filter: {
                    enabled: true,
                    type: 'lowpass',
                    frequency: 100,
                    Q: 1
                }
            }
        };
        
        return presets[name] || null;
    }
    
    applyPreset(pluginId, presetName) {
        const preset = this.getPreset(presetName);
        if (!preset) return false;
        
        return this.updateSidechainSettings(pluginId, preset);
    }
    
    // Available sources for UI
    getAvailableSources() {
        return Array.from(this.sources.values()).map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            color: s.color,
            enabled: s.enabled
        }));
    }
    
    // Get sidechain routing
    getRouting() {
        const routing = {};
        for (const [sourceId, destinations] of this.routing) {
            routing[sourceId] = destinations;
        }
        return routing;
    }
    
    // Get all sidechains
    getSidechains() {
        return Array.from(this.sidechains.values());
    }
    
    // UI
    createUI(container) {
        container.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 8px;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #fff;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 14px;">Plugin Sidechain Support</h3>
                    <button id="add-sidechain-btn" style="padding: 8px 16px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer;">Add Sidechain</button>
                </div>
                
                <!-- Sources -->
                <div style="margin-bottom: 16px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">SOURCES</h4>
                    <div id="sources-list" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
                </div>
                
                <!-- Sidechains -->
                <div id="sidechains-list" style="max-height: 400px; overflow-y: auto;"></div>
                
                <!-- No sidechains message -->
                <div id="no-sidechains-message" style="text-align: center; padding: 40px; color: #888; display: ${this.sidechains.size === 0 ? 'block' : 'none'};">
                    <p>No sidechains configured</p>
                    <p style="font-size: 12px;">Click "Add Sidechain" to create a new sidechain routing</p>
                </div>
            </div>
        `;
        
        this.sourcesList = container.querySelector('#sources-list');
        this.sidechainsList = container.querySelector('#sidechains-list');
        
        this.setupEventHandlers(container);
        this.updateDisplay();
    }
    
    setupEventHandlers(container) {
        container.querySelector('#add-sidechain-btn').onclick = () => {
            const id = `plugin_${Date.now()}`;
            this.createSidechain(id);
            this.updateDisplay();
        };
    }
    
    updateDisplay() {
        // Update sources list
        this.sourcesList.innerHTML = '';
        for (const source of this.sources.values()) {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 8px 12px;
                background: #2a2a4e;
                border-radius: 4px;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            item.innerHTML = `
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${source.color};"></div>
                <span>${source.name}</span>
                <span style="color: #888; font-size: 10px;">${source.type}</span>
            `;
            this.sourcesList.appendChild(item);
        }
        
        // Update sidechains list
        this.sidechainsList.innerHTML = '';
        document.getElementById('no-sidechains-message').style.display = this.sidechains.size === 0 ? 'block' : 'none';
        
        for (const [pluginId, sidechain] of this.sidechains) {
            const card = document.createElement('div');
            card.className = 'sidechain-card';
            card.dataset.pluginId = pluginId;
            card.style.cssText = `
                background: #2a2a4e;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                border-left: 4px solid ${sidechain.enabled ? '#10b981' : '#555'};
            `;
            
            // Get source name
            const source = this.sources.get(sidechain.sourceId);
            const sourceName = source ? source.name : 'None';
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-weight: 600;">Sidechain: ${pluginId}</span>
                    <div>
                        <button class="toggle-sc-btn" style="padding: 4px 8px; background: ${sidechain.enabled ? '#10b981' : '#555'}; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 8px;">${sidechain.enabled ? 'ON' : 'OFF'}</button>
                        <button class="remove-sc-btn" style="padding: 4px 8px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">Remove</button>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    <div>
                        <label style="font-size: 11px; color: #888;">Source:</label>
                        <select class="source-select" style="
                            width: 100%;
                            padding: 6px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        ">
                            <option value="">Select source...</option>
                            ${Array.from(this.sources.values()).map(s => `
                                <option value="${s.id}" ${sidechain.sourceId === s.id ? 'selected' : ''}>${s.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div>
                        <label style="font-size: 11px; color: #888;">Preset:</label>
                        <select class="preset-select" style="
                            width: 100%;
                            padding: 6px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 4px;
                            color: white;
                        ">
                            <option value="">Select preset...</option>
                            <option value="ducking">Ducking</option>
                            <option value="pumping">Pumping</option>
                            <option value="gated">Gated</option>
                            <option value="subtle">Subtle</option>
                            <option value="vocal">Vocal</option>
                            <option value="kick_duck">Kick Duck</option>
                        </select>
                    </div>
                    
                    <div>
                        <label style="font-size: 11px; color: #888;">Threshold: ${sidechain.threshold} dB</label>
                        <input type="range" class="threshold-slider" min="-60" max="0" value="${sidechain.threshold}" style="width: 100%;">
                    </div>
                    
                    <div>
                        <label style="font-size: 11px; color: #888;">Ratio: ${sidechain.ratio}:1</label>
                        <input type="range" class="ratio-slider" min="1" max="20" value="${sidechain.ratio}" style="width: 100%;">
                    </div>
                    
                    <div>
                        <label style="font-size: 11px; color: #888;">Attack: ${sidechain.attack * 1000} ms</label>
                        <input type="range" class="attack-slider" min="0.001" max="1" step="0.001" value="${sidechain.attack}" style="width: 100%;">
                    </div>
                    
                    <div>
                        <label style="font-size: 11px; color: #888;">Release: ${sidechain.release * 1000} ms</label>
                        <input type="range" class="release-slider" min="0.01" max="2" step="0.01" value="${sidechain.release}" style="width: 100%;">
                    </div>
                </div>
                
                <!-- Gain reduction Meter -->
                <div style="margin-top: 12px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-bottom: 4px;">
                        <span>Gain Reduction</span>
                        <span class="gr-value">0 dB</span>
                    </div>
                    <div style="height: 8px; background: #1a1a2e; border-radius: 4px; overflow: hidden;">
                        <div class="gr-meter" style="height: 100%; width: 0%; background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444); transition: width 0.1s;"></div>
                    </div>
                </div>
            `;
            
            this.sidechainsList.appendChild(card);
            
            // Event handlers
            const currentPluginId = pluginId;
            
            card.querySelector('.toggle-sc-btn').onclick = (e) => {
                const enabled = this.enableSidechain(currentPluginId, !sidechain.enabled);
                e.target.textContent = sidechain.enabled ? 'ON' : 'OFF';
                e.target.style.background = sidechain.enabled ? '#10b981' : '#555';
                card.style.borderLeftColor = sidechain.enabled ? '#10b981' : '#555';
            };
            
            card.querySelector('.remove-sc-btn').onclick = () => {
                this.removeSidechain(currentPluginId);
                this.updateDisplay();
            };
            
            card.querySelector('.source-select').onchange = (e) => {
                const sourceId = e.target.value;
                if (sourceId) {
                    this.connectSidechain(sourceId, currentPluginId);
                } else {
                    // Disconnect
                    const connection = Array.from(this.connections.values()).find(c => c.pluginId === currentPluginId);
                    if (connection) {
                        this.disconnectSidechain(connection.id);
                    }
                    sidechain.sourceId = null;
                }
            };
            
            card.querySelector('.preset-select').onchange = (e) => {
                if (e.target.value) {
                    this.applyPreset(currentPluginId, e.target.value);
                    this.updateDisplay();
                }
            };
            
            card.querySelector('.threshold-slider').oninput = (e) => {
                const value = parseFloat(e.target.value);
                this.updateSidechainSettings(currentPluginId, { threshold: value });
                e.target.previousElementSibling.textContent = `Threshold: ${value} dB`;
            };
            
            card.querySelector('.ratio-slider').oninput = (e) => {
                const value = parseFloat(e.target.value);
                this.updateSidechainSettings(currentPluginId, { ratio: value });
                e.target.previousElementSibling.textContent = `Ratio: ${value}:1`;
            };
            
            card.querySelector('.attack-slider').oninput = (e) => {
                const value = parseFloat(e.target.value);
                this.updateSidechainSettings(currentPluginId, { attack: value });
                e.target.previousElementSibling.textContent = `Attack: ${Math.round(value * 1000)} ms`;
            };
            
            card.querySelector('.release-slider').oninput = (e) => {
                const value = parseFloat(e.target.value);
                this.updateSidechainSettings(currentPluginId, { release: value });
                e.target.previousElementSibling.textContent = `Release: ${Math.round(value * 1000)} ms`;
            };
            
            // Update GR meter
            const updateGR = () => {
                if (!document.body.contains(card)) return;
                
                const gr = this.getGainReduction(currentPluginId);
                const grPercent = Math.min(100, Math.max(0, Math.abs(gr)));
                
                card.querySelector('.gr-meter').style.width = `${grPercent}%`;
                card.querySelector('.gr-value').textContent = `${gr.toFixed(1)} dB`;
                
                requestAnimationFrame(updateGR);
            };
            updateGR();
        }
    }
    
    openPanel() {
        const existing = document.getElementById('sidechain-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'sidechain-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
        `;
        
        document.body.appendChild(panel);
        
        // Register some demo sources
        this.registerSource('track_drums', { connect: () => {}, disconnect: () => {} }, { name: 'Drums', type: 'track' });
        this.registerSource('track_bass', { connect: () => {}, disconnect: () => {} }, { name: 'Bass', type: 'track' });
        this.registerSource('track_synth', { connect: () => {}, disconnect: () => {} }, { name: 'Synth', type: 'track' });
        this.registerSource('master_bus', { connect: () => {}, disconnect: () => {} }, { name: 'Master', type: 'bus' });
        
        this.createUI(panel);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 6px 12px;
            background: #ef4444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        closeBtn.onclick = () => panel.remove();
        panel.appendChild(closeBtn);
    }
    
    // Export configuration
    exportConfig() {
        return {
            sidechains: Array.from(this.sidechains.entries()).map(([id, sc]) => ({
                pluginId: sc.pluginId,
                sourceId: sc.sourceId,
                threshold: sc.threshold,
                ratio: sc.ratio,
                attack: sc.attack,
                release: sc.release,
                knee: sc.knee,
                filter: sc.filter,
                enabled: sc.enabled
            })),
            routing: this.getRouting()
        };
    }
    
    importConfig(config) {
        this.sidechains.clear();
        this.connections.clear();
        this.routing.clear();
        
        for (const scConfig of config.sidechains) {
            this.createSidechain(scConfig.pluginId, scConfig);
            if (scConfig.sourceId) {
                this.connectSidechain(scConfig.sourceId, scConfig.pluginId);
            }
        }
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PluginSidechainSupport };
} else if (typeof window !== 'undefined') {
    window.PluginSidechainSupport = PluginSidechainSupport;
}