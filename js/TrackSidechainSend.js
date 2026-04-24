/**
 * TrackSidechainSend.js
 * Dedicated sidechain send per track
 * Provides per-track sidechain routing with dedicated controls
 */

export class TrackSidechainSend {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Settings
        this.settings = {
            preFader: options.preFader ?? true,        // Pre or post fader send
            sendLevel: options.sendLevel ?? 1.0,       // 0-1
            stereoWidth: options.stereoWidth ?? 1.0,   // Stereo width of send
            muteSource: options.muteSource ?? false,   // Mute source when sending
            listenMode: options.listenMode ?? false    // Solo the sidechain send
        };
        
        // Audio nodes
        this.inputNode = null;
        this.sendGainNode = null;
        this.stereoNode = null;
        this.outputNode = null;
        this.sidechainOutputNode = null;
        
        // Track reference
        this.trackId = options.trackId ?? null;
        this.trackName = options.trackName ?? 'Track';
        
        // State
        this.enabled = options.enabled ?? true;
        this.muted = false;
        
        // Callbacks
        this.onSendLevelChange = options.onSendLevelChange ?? null;
        this.onEnableChange = options.onEnableChange ?? null;
        
        this._initialized = false;
    }
    
    /**
     * Initialize the sidechain send
     */
    init() {
        if (this._initialized) return;
        
        // Create input node
        this.inputNode = this.audioContext.createGain();
        
        // Create send gain
        this.sendGainNode = this.audioContext.createGain();
        this.sendGainNode.gain.value = this.settings.sendLevel;
        
        // Create stereo processor (for width control)
        this.stereoNode = this._createStereoProcessor();
        
        // Create output node (pass-through)
        this.outputNode = this.audioContext.createGain();
        
        // Create sidechain output
        this.sidechainOutputNode = this.audioContext.createGain();
        
        // Connect the chain
        this.inputNode.connect(this.outputNode);
        this.inputNode.connect(this.sendGainNode);
        this.sendGainNode.connect(this.stereoNode.input);
        this.stereoNode.output.connect(this.sidechainOutputNode);
        
        this._initialized = true;
    }
    
    /**
     * Create stereo width processor
     */
    _createStereoProcessor() {
        const input = this.audioContext.createChannelSplitter(2);
        const output = this.audioContext.createChannelMerger(2);
        const midGain = this.audioContext.createGain();
        const sideGain = this.audioContext.createGain();
        
        // Simple stereo width control
        // In a full implementation, this would use proper M/S processing
        
        return {
            input: input,
            output: output,
            setWidth: (width) => {
                // Simplified width control
                midGain.gain.value = 1;
                sideGain.gain.value = width;
            }
        };
    }
    
    /**
     * Connect audio source to this sidechain send
     */
    connect(sourceNode) {
        if (!this._initialized) {
            this.init();
        }
        sourceNode.connect(this.inputNode);
    }
    
    /**
     * Connect main output to destination
     */
    connectOutput(destination) {
        if (!this._initialized) return;
        this.outputNode.connect(destination);
    }
    
    /**
     * Connect sidechain output to destination (e.g., compressor)
     */
    connectSidechainOutput(destination) {
        if (!this._initialized) return;
        this.sidechainOutputNode.connect(destination);
    }
    
    /**
     * Set send level
     */
    setSendLevel(level) {
        this.settings.sendLevel = Math.max(0, Math.min(1, level));
        if (this.sendGainNode) {
            this.sendGainNode.gain.setTargetAtTime(
                this.settings.sendLevel,
                this.audioContext.currentTime,
                0.01
            );
        }
        if (this.onSendLevelChange) {
            this.onSendLevelChange(this.settings.sendLevel);
        }
    }
    
    /**
     * Get current send level
     */
    getSendLevel() {
        return this.settings.sendLevel;
    }
    
    /**
     * Set send level in dB
     */
    setSendLevelDb(db) {
        const linear = Math.pow(10, db / 20);
        this.setSendLevel(Math.max(0, Math.min(1, linear)));
    }
    
    /**
     * Enable/disable the send
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.sendGainNode) {
            this.sendGainNode.gain.setTargetAtTime(
                enabled ? this.settings.sendLevel : 0,
                this.audioContext.currentTime,
                0.01
            );
        }
        if (this.onEnableChange) {
            this.onEnableChange(enabled);
        }
    }
    
    /**
     * Toggle send on/off
     */
    toggle() {
        this.setEnabled(!this.enabled);
    }
    
    /**
     * Mute/unmute the send
     */
    setMuted(muted) {
        this.muted = muted;
        if (this.sendGainNode) {
            this.sendGainNode.gain.setTargetAtTime(
                muted ? 0 : (this.enabled ? this.settings.sendLevel : 0),
                this.audioContext.currentTime,
                0.01
            );
        }
    }
    
    /**
     * Set pre/post fader mode
     */
    setPreFader(preFader) {
        this.settings.preFader = preFader;
        // In a full implementation, this would re-route the signal
    }
    
    /**
     * Set stereo width of send
     */
    setStereoWidth(width) {
        this.settings.stereoWidth = Math.max(0, Math.min(2, width));
        if (this.stereoNode) {
            this.stereoNode.setWidth(this.settings.stereoWidth);
        }
    }
    
    /**
     * Set listen mode (solo the sidechain)
     */
    setListenMode(enabled) {
        this.settings.listenMode = enabled;
        // In a full implementation, this would mute the main output
        // and route only the sidechain signal
    }
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            trackId: this.trackId,
            trackName: this.trackName,
            enabled: this.enabled,
            muted: this.muted,
            sendLevel: this.settings.sendLevel,
            sendLevelDb: 20 * Math.log10(this.settings.sendLevel || 0.0001),
            preFader: this.settings.preFader,
            stereoWidth: this.settings.stereoWidth,
            listenMode: this.settings.listenMode
        };
    }
    
    /**
     * Serialize for save/load
     */
    serialize() {
        return {
            trackId: this.trackId,
            enabled: this.enabled,
            settings: { ...this.settings }
        };
    }
    
    /**
     * Restore from serialized data
     */
    restore(data) {
        this.trackId = data.trackId;
        this.enabled = data.enabled ?? true;
        Object.assign(this.settings, data.settings || {});
        
        if (this._initialized) {
            this.setSendLevel(this.settings.sendLevel);
            this.setEnabled(this.enabled);
        }
    }
    
    /**
     * Disconnect all nodes
     */
    disconnect() {
        if (this.inputNode) {
            this.inputNode.disconnect();
        }
        if (this.sendGainNode) {
            this.sendGainNode.disconnect();
        }
        if (this.outputNode) {
            this.outputNode.disconnect();
        }
        if (this.sidechainOutputNode) {
            this.sidechainOutputNode.disconnect();
        }
    }
    
    /**
     * Destroy and cleanup
     */
    destroy() {
        this.disconnect();
        this.inputNode = null;
        this.sendGainNode = null;
        this.outputNode = null;
        this.sidechainOutputNode = null;
        this._initialized = false;
    }
}

/**
 * Sidechain Bus Manager
 * Manages multiple track sidechain sends and routes to destinations
 */
export class SidechainBusManager {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.sends = new Map(); // trackId -> TrackSidechainSend
        this.busses = new Map(); // busId -> { destination, sends[] }
        
        // Master sidechain bus
        this.masterBus = {
            id: 'master',
            name: 'Master Sidechain',
            input: audioContext.createGain(),
            output: audioContext.createGain(),
            sends: []
        };
        
        this.masterBus.input.connect(this.masterBus.output);
    }
    
    /**
     * Create a sidechain send for a track
     */
    createSend(trackId, options = {}) {
        if (this.sends.has(trackId)) {
            console.warn(`Sidechain send already exists for track ${trackId}`);
            return this.sends.get(trackId);
        }
        
        const send = new TrackSidechainSend(this.audioContext, {
            ...options,
            trackId
        });
        send.init();
        
        // Connect to master bus by default
        send.connectSidechainOutput(this.masterBus.input);
        
        this.sends.set(trackId, send);
        this.masterBus.sends.push(trackId);
        
        return send;
    }
    
    /**
     * Remove a sidechain send
     */
    removeSend(trackId) {
        const send = this.sends.get(trackId);
        if (send) {
            send.destroy();
            this.sends.delete(trackId);
            
            // Remove from master bus
            const index = this.masterBus.sends.indexOf(trackId);
            if (index > -1) {
                this.masterBus.sends.splice(index, 1);
            }
        }
    }
    
    /**
     * Get a sidechain send by track ID
     */
    getSend(trackId) {
        return this.sends.get(trackId);
    }
    
    /**
     * Create a custom sidechain bus
     */
    createBus(busId, name) {
        if (this.busses.has(busId)) {
            return this.busses.get(busId);
        }
        
        const bus = {
            id: busId,
            name: name || `Bus ${busId}`,
            input: this.audioContext.createGain(),
            output: this.audioContext.createGain(),
            sends: []
        };
        
        bus.input.connect(bus.output);
        this.busses.set(busId, bus);
        
        return bus;
    }
    
    /**
     * Route a track's sidechain to a specific bus
     */
    routeToBus(trackId, busId) {
        const send = this.sends.get(trackId);
        const bus = this.busses.get(busId) || this.masterBus;
        
        if (send) {
            // Disconnect from current destination
            send.disconnect();
            
            // Connect to bus
            send.connectSidechainOutput(bus.input);
            
            if (!bus.sends.includes(trackId)) {
                bus.sends.push(trackId);
            }
        }
    }
    
    /**
     * Get master bus output
     */
    getMasterBusOutput() {
        return this.masterBus.output;
    }
    
    /**
     * Connect master bus to destination (e.g., compressor sidechain input)
     */
    connectMasterBus(destination) {
        this.masterBus.output.connect(destination);
    }
    
    /**
     * Get all send statuses
     */
    getAllSendStatuses() {
        const statuses = [];
        this.sends.forEach(send => {
            statuses.push(send.getStatus());
        });
        return statuses;
    }
    
    /**
     * Set all send levels proportionally
     */
    setAllSendLevels(baseLevel) {
        this.sends.forEach(send => {
            send.setSendLevel(baseLevel);
        });
    }
    
    /**
     * Solo a specific send (mute others temporarily)
     */
    soloSend(trackId) {
        this.sends.forEach((send, id) => {
            send.setMuted(id !== trackId);
        });
    }
    
    /**
     * Clear all solos
     */
    clearSolos() {
        this.sends.forEach(send => {
            send.setMuted(false);
        });
    }
    
    /**
     * Serialize all sends
     */
    serialize() {
        const data = {
            sends: {},
            busses: {}
        };
        
        this.sends.forEach((send, trackId) => {
            data.sends[trackId] = send.serialize();
        });
        
        this.busses.forEach((bus, busId) => {
            data.busses[busId] = {
                id: bus.id,
                name: bus.name,
                sends: bus.sends
            };
        });
        
        return data;
    }
    
    /**
     * Restore all sends
     */
    restore(data) {
        if (data.sends) {
            Object.entries(data.sends).forEach(([trackId, sendData]) => {
                const send = this.sends.get(trackId);
                if (send) {
                    send.restore(sendData);
                }
            });
        }
    }
    
    /**
     * Destroy all sends and busses
     */
    destroy() {
        this.sends.forEach(send => send.destroy());
        this.sends.clear();
        
        this.busses.forEach(bus => {
            bus.input.disconnect();
            bus.output.disconnect();
        });
        this.busses.clear();
        
        this.masterBus.input.disconnect();
        this.masterBus.output.disconnect();
    }
}

/**
 * Create sidechain send UI panel
 */
export function createSidechainSendPanel(track, manager, onChange) {
    const container = document.createElement('div');
    container.className = 'sidechain-send-panel';
    container.style.cssText = `
        padding: 12px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    `;
    
    const title = document.createElement('span');
    title.textContent = 'Sidechain Send';
    title.style.cssText = 'font-weight: 600;';
    
    const enableBtn = document.createElement('button');
    enableBtn.textContent = 'ON';
    enableBtn.style.cssText = `
        padding: 4px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        background: #10b981;
        color: white;
    `;
    
    header.appendChild(title);
    header.appendChild(enableBtn);
    container.appendChild(header);
    
    // Get or create send
    let send = manager.getSend(track.id);
    if (!send) {
        send = manager.createSend(track.id, { trackName: track.name });
    }
    
    // Update button state
    const updateButton = () => {
        if (send.enabled) {
            enableBtn.textContent = 'ON';
            enableBtn.style.background = '#10b981';
        } else {
            enableBtn.textContent = 'OFF';
            enableBtn.style.background = '#2a2a4e';
        }
    };
    updateButton();
    
    // Send level slider
    const levelGroup = document.createElement('div');
    levelGroup.style.cssText = 'margin-bottom: 8px;';
    
    const levelLabel = document.createElement('label');
    levelLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 11px;';
    levelLabel.textContent = 'Send Level:';
    levelGroup.appendChild(levelLabel);
    
    const levelSlider = document.createElement('input');
    levelSlider.type = 'range';
    levelSlider.min = '0';
    levelSlider.max = '100';
    levelSlider.value = Math.round(send.settings.sendLevel * 100);
    levelSlider.style.cssText = 'width: 100%; accent-color: #3b82f6;';
    levelGroup.appendChild(levelSlider);
    
    const levelValue = document.createElement('span');
    levelValue.style.cssText = 'font-size: 11px; color: #888;';
    levelValue.textContent = `${Math.round(send.settings.sendLevel * 100)}%`;
    levelGroup.appendChild(levelValue);
    
    container.appendChild(levelGroup);
    
    // Pre/Post fader toggle
    const prePostGroup = document.createElement('div');
    prePostGroup.style.cssText = 'margin-bottom: 8px;';
    
    const prePostLabel = document.createElement('label');
    prePostLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 11px;';
    prePostLabel.innerHTML = `
        <input type="checkbox" ${send.settings.preFader ? 'checked' : ''}>
        <span>Pre-Fader</span>
    `;
    prePostGroup.appendChild(prePostLabel);
    container.appendChild(prePostGroup);
    
    // Event handlers
    enableBtn.onclick = () => {
        send.toggle();
        updateButton();
        if (onChange) onChange(send.getStatus());
    };
    
    levelSlider.oninput = () => {
        const level = parseInt(levelSlider.value) / 100;
        send.setSendLevel(level);
        levelValue.textContent = `${Math.round(level * 100)}%`;
        if (onChange) onChange(send.getStatus());
    };
    
    prePostLabel.querySelector('input').onchange = (e) => {
        send.setPreFader(e.target.checked);
        if (onChange) onChange(send.getStatus());
    };
    
    return container;
}

export default TrackSidechainSend;