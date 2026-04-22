// js/RemoteControl.js - Remote Control for SnugOS DAW
// Features: Control DAW from another device via WebSocket/WebRTC

/**
 * Remote Control Command Types
 */
export const CommandType = {
    // Transport commands
    PLAY: 'play',
    PAUSE: 'pause',
    STOP: 'stop',
    SEEK: 'seek',
    SET_TEMPO: 'set_tempo',
    
    // Track commands
    MUTE_TRACK: 'mute_track',
    SOLO_TRACK: 'solo_track',
    SET_TRACK_VOLUME: 'set_track_volume',
    SET_TRACK_PAN: 'set_track_pan',
    SELECT_TRACK: 'select_track',
    
    // Recording commands
    START_RECORDING: 'start_recording',
    STOP_RECORDING: 'stop_recording',
    ARM_TRACK: 'arm_track',
    
    // Loop commands
    SET_LOOP_REGION: 'set_loop_region',
    TOGGLE_LOOP: 'toggle_loop',
    
    // Project commands
    NEW_PROJECT: 'new_project',
    SAVE_PROJECT: 'save_project',
    LOAD_PROJECT: 'load_project',
    
    // UI commands
    ZOOM_IN: 'zoom_in',
    ZOOM_OUT: 'zoom_out',
    SCROLL_TO_TIME: 'scroll_to_time',
    
    // Custom commands
    CUSTOM: 'custom'
};

/**
 * Remote Device Types
 */
export const DeviceType = {
    PHONE: 'phone',
    TABLET: 'tablet',
    ANOTHER_COMPUTER: 'another_computer',
    HARDWARE_CONTROLLER: 'hardware_controller',
    WEB_CLIENT: 'web_client'
};

/**
 * Remote Command
 */
export class RemoteCommand {
    constructor(options = {}) {
        this.id = options.id || `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = options.type || CommandType.CUSTOM;
        this.payload = options.payload || {};
        this.timestamp = options.timestamp || Date.now();
        this.deviceId = options.deviceId || 'unknown';
        this.requiresResponse = options.requiresResponse ?? false;
        this.response = null;
    }

    /**
     * Convert to JSON for transmission
     * @returns {Object} JSON object
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            payload: this.payload,
            timestamp: this.timestamp,
            deviceId: this.deviceId,
            requiresResponse: this.requiresResponse
        };
    }

    /**
     * Create from JSON
     * @param {Object} json - JSON data
     * @returns {RemoteCommand} Command instance
     */
    static fromJSON(json) {
        return new RemoteCommand(json);
    }
}

/**
 * Remote Device
 */
export class RemoteDevice {
    constructor(options = {}) {
        this.id = options.id || `device_${Date.now()}`;
        this.name = options.name || 'Unknown Device';
        this.type = options.type || DeviceType.WEB_CLIENT;
        this.connected = options.connected || false;
        this.lastSeen = options.lastSeen || Date.now();
        this.permissions = options.permissions || {
            canPlay: true,
            canRecord: true,
            canEdit: true,
            canSave: true
        };
        this.metadata = options.metadata || {};
    }

    /**
     * Update last seen timestamp
     */
    touch() {
        this.lastSeen = Date.now();
    }

    /**
     * Check if device has permission
     * @param {string} permission - Permission name
     * @returns {boolean} Has permission
     */
    hasPermission(permission) {
        return this.permissions[permission] === true;
    }
}

/**
 * Remote Control Server
 * Handles incoming connections from remote devices
 */
export class RemoteControlServer {
    constructor(options = {}) {
        this.port = options.port || 8080;
        this.password = options.password || null;
        this.maxConnections = options.maxConnections || 5;
        
        this.devices = new Map();
        this.commandHandlers = new Map();
        this.listeners = new Map();
        
        this.isRunning = false;
        this.wss = null;
        
        // Register default command handlers
        this._registerDefaultHandlers();
    }

    /**
     * Start the remote control server
     * @returns {Promise<boolean>} Success status
     */
    async start() {
        if (this.isRunning) return true;
        
        try {
            // In browser context, we'd use WebRTC for peer-to-peer
            // In Node.js context, we'd use WebSocket server
            // For now, simulate with events
            
            this.isRunning = true;
            this._emit('serverStarted', { port: this.port });
            
            console.log(`[RemoteControlServer] Server started on port ${this.port}`);
            return true;
        } catch (error) {
            console.error('[RemoteControlServer] Failed to start:', error);
            return false;
        }
    }

    /**
     * Stop the remote control server
     */
    stop() {
        if (!this.isRunning) return;
        
        // Disconnect all devices
        this.devices.forEach((device, id) => {
            this._disconnectDevice(id);
        });
        
        this.isRunning = false;
        this._emit('serverStopped', {});
        
        console.log('[RemoteControlServer] Server stopped');
    }

    /**
     * Handle incoming connection
     * @param {string} deviceId - Device ID
     * @param {Object} connectionData - Connection data
     */
    handleConnection(deviceId, connectionData) {
        if (this.devices.size >= this.maxConnections) {
            this._emit('connectionRejected', { deviceId, reason: 'max_connections' });
            return;
        }
        
        // Verify password if set
        if (this.password && connectionData.password !== this.password) {
            this._emit('connectionRejected', { deviceId, reason: 'invalid_password' });
            return;
        }
        
        const device = new RemoteDevice({
            id: deviceId,
            name: connectionData.name || `Device ${this.devices.size + 1}`,
            type: connectionData.type || DeviceType.WEB_CLIENT,
            connected: true,
            permissions: connectionData.permissions || {
                canPlay: true,
                canRecord: true,
                canEdit: false,
                canSave: false
            }
        });
        
        this.devices.set(deviceId, device);
        this._emit('deviceConnected', device);
        
        console.log(`[RemoteControlServer] Device connected: ${device.name} (${deviceId})`);
    }

    /**
     * Handle incoming command
     * @param {string} deviceId - Device ID
     * @param {Object} commandData - Command data
     */
    handleCommand(deviceId, commandData) {
        const device = this.devices.get(deviceId);
        if (!device) {
            console.warn(`[RemoteControlServer] Command from unknown device: ${deviceId}`);
            return;
        }
        
        device.touch();
        
        const command = RemoteCommand.fromJSON({
            ...commandData,
            deviceId
        });
        
        // Check permission
        const permissionMap = {
            [CommandType.PLAY]: 'canPlay',
            [CommandType.PAUSE]: 'canPlay',
            [CommandType.STOP]: 'canPlay',
            [CommandType.START_RECORDING]: 'canRecord',
            [CommandType.STOP_RECORDING]: 'canRecord',
            [CommandType.SAVE_PROJECT]: 'canSave',
            [CommandType.SET_TRACK_VOLUME]: 'canEdit',
            [CommandType.MUTE_TRACK]: 'canEdit'
        };
        
        const requiredPermission = permissionMap[command.type];
        if (requiredPermission && !device.hasPermission(requiredPermission)) {
            this._sendResponse(deviceId, command.id, {
                success: false,
                error: 'Permission denied'
            });
            return;
        }
        
        // Execute command
        const handler = this.commandHandlers.get(command.type);
        if (handler) {
            try {
                const result = handler(command, device);
                
                if (command.requiresResponse) {
                    this._sendResponse(deviceId, command.id, {
                        success: true,
                        result
                    });
                }
                
                this._emit('commandExecuted', { command, result });
            } catch (error) {
                console.error(`[RemoteControlServer] Command execution error:`, error);
                
                if (command.requiresResponse) {
                    this._sendResponse(deviceId, command.id, {
                        success: false,
                        error: error.message
                    });
                }
            }
        } else {
            console.warn(`[RemoteControlServer] No handler for command type: ${command.type}`);
        }
    }

    /**
     * Register command handler
     * @param {string} commandType - Command type
     * @param {Function} handler - Handler function
     */
    registerHandler(commandType, handler) {
        this.commandHandlers.set(commandType, handler);
    }

    /**
     * Register default command handlers
     * @private
     */
    _registerDefaultHandlers() {
        // Transport handlers - these would connect to actual DAW functions
        this.registerHandler(CommandType.PLAY, (cmd) => {
            this._emit('transportCommand', { action: 'play', payload: cmd.payload });
            return { playing: true };
        });
        
        this.registerHandler(CommandType.PAUSE, (cmd) => {
            this._emit('transportCommand', { action: 'pause', payload: cmd.payload });
            return { playing: false };
        });
        
        this.registerHandler(CommandType.STOP, (cmd) => {
            this._emit('transportCommand', { action: 'stop', payload: cmd.payload });
            return { playing: false, position: 0 };
        });
        
        this.registerHandler(CommandType.SEEK, (cmd) => {
            this._emit('transportCommand', { action: 'seek', time: cmd.payload.time });
            return { position: cmd.payload.time };
        });
        
        this.registerHandler(CommandType.SET_TEMPO, (cmd) => {
            this._emit('transportCommand', { action: 'setTempo', bpm: cmd.payload.bpm });
            return { tempo: cmd.payload.bpm };
        });
        
        // Track handlers
        this.registerHandler(CommandType.MUTE_TRACK, (cmd) => {
            this._emit('trackCommand', { 
                action: 'mute', 
                trackId: cmd.payload.trackId,
                muted: cmd.payload.muted 
            });
            return { trackId: cmd.payload.trackId, muted: cmd.payload.muted };
        });
        
        this.registerHandler(CommandType.SOLO_TRACK, (cmd) => {
            this._emit('trackCommand', { 
                action: 'solo', 
                trackId: cmd.payload.trackId,
                soloed: cmd.payload.soloed 
            });
            return { trackId: cmd.payload.trackId, soloed: cmd.payload.soloed };
        });
        
        this.registerHandler(CommandType.SET_TRACK_VOLUME, (cmd) => {
            this._emit('trackCommand', { 
                action: 'setVolume', 
                trackId: cmd.payload.trackId,
                volume: cmd.payload.volume 
            });
            return { trackId: cmd.payload.trackId, volume: cmd.payload.volume };
        });
        
        // Recording handlers
        this.registerHandler(CommandType.START_RECORDING, (cmd) => {
            this._emit('recordingCommand', { action: 'start', trackId: cmd.payload.trackId });
            return { recording: true };
        });
        
        this.registerHandler(CommandType.STOP_RECORDING, (cmd) => {
            this._emit('recordingCommand', { action: 'stop' });
            return { recording: false };
        });
        
        // Loop handlers
        this.registerHandler(CommandType.SET_LOOP_REGION, (cmd) => {
            this._emit('loopCommand', { 
                action: 'setRegion',
                start: cmd.payload.start,
                end: cmd.payload.end 
            });
            return { loopRegion: cmd.payload };
        });
        
        this.registerHandler(CommandType.TOGGLE_LOOP, (cmd) => {
            this._emit('loopCommand', { action: 'toggle', enabled: cmd.payload.enabled });
            return { loopEnabled: cmd.payload.enabled };
        });
        
        // Custom command handler
        this.registerHandler(CommandType.CUSTOM, (cmd) => {
            this._emit('customCommand', cmd.payload);
            return { processed: true };
        });
    }

    /**
     * Send response to device
     * @private
     */
    _sendResponse(deviceId, commandId, response) {
        const device = this.devices.get(deviceId);
        if (!device) return;
        
        this._emit('response', { deviceId, commandId, response });
    }

    /**
     * Disconnect a device
     * @param {string} deviceId - Device ID
     */
    _disconnectDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (device) {
            device.connected = false;
            this.devices.delete(deviceId);
            this._emit('deviceDisconnected', device);
        }
    }

    /**
     * Get connected devices
     * @returns {RemoteDevice[]} Array of devices
     */
    getConnectedDevices() {
        return Array.from(this.devices.values()).filter(d => d.connected);
    }

    /**
     * Broadcast state to all devices
     * @param {Object} state - State to broadcast
     */
    broadcastState(state) {
        this.devices.forEach((device, id) => {
            if (device.connected) {
                this._emit('stateUpdate', { deviceId: id, state });
            }
        });
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        }
    }

    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }
}

/**
 * Remote Control Client
 * Connects to a remote DAW instance
 */
export class RemoteControlClient {
    constructor(options = {}) {
        this.serverUrl = options.serverUrl || '';
        this.password = options.password || null;
        this.deviceName = options.deviceName || 'Remote Controller';
        this.deviceType = options.deviceType || DeviceType.WEB_CLIENT;
        
        this.connected = false;
        this.deviceId = null;
        this.listeners = new Map();
        this.pendingCommands = new Map();
        
        this.permissions = {
            canPlay: true,
            canRecord: true,
            canEdit: false,
            canSave: false
        };
    }

    /**
     * Connect to server
     * @returns {Promise<boolean>} Success status
     */
    async connect() {
        try {
            // In real implementation, this would establish WebSocket/WebRTC connection
            this.deviceId = `client_${Date.now()}`;
            this.connected = true;
            
            this._emit('connected', { 
                deviceId: this.deviceId,
                permissions: this.permissions 
            });
            
            console.log(`[RemoteControlClient] Connected to ${this.serverUrl}`);
            return true;
        } catch (error) {
            console.error('[RemoteControlClient] Connection failed:', error);
            return false;
        }
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (!this.connected) return;
        
        this.connected = false;
        this._emit('disconnected', {});
        
        console.log('[RemoteControlClient] Disconnected');
    }

    /**
     * Send command to server
     * @param {string} type - Command type
     * @param {Object} payload - Command payload
     * @param {boolean} waitForResponse - Wait for response
     * @returns {Promise<Object>} Response (if waitForResponse is true)
     */
    async sendCommand(type, payload = {}, waitForResponse = false) {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }
        
        const command = new RemoteCommand({
            type,
            payload,
            deviceId: this.deviceId,
            requiresResponse: waitForResponse
        });
        
        this._emit('commandSent', command.toJSON());
        
        if (waitForResponse) {
            return new Promise((resolve, reject) => {
                // Set timeout for response
                const timeout = setTimeout(() => {
                    this.pendingCommands.delete(command.id);
                    reject(new Error('Command timeout'));
                }, 5000);
                
                // Store pending command
                this.pendingCommands.set(command.id, { resolve, reject, timeout });
            });
        }
        
        return { sent: true };
    }

    /**
     * Handle response from server
     * @param {Object} response - Response data
     */
    handleResponse(response) {
        const pending = this.pendingCommands.get(response.commandId);
        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingCommands.delete(response.commandId);
            
            if (response.success) {
                pending.resolve(response.result);
            } else {
                pending.reject(new Error(response.error));
            }
        }
    }

    /**
     * Handle state update from server
     * @param {Object} state - State data
     */
    handleStateUpdate(state) {
        this._emit('stateUpdate', state);
    }

    // Convenience methods for common commands
    
    play() { return this.sendCommand(CommandType.PLAY); }
    pause() { return this.sendCommand(CommandType.PAUSE); }
    stop() { return this.sendCommand(CommandType.STOP); }
    seek(time) { return this.sendCommand(CommandType.SEEK, { time }); }
    setTempo(bpm) { return this.sendCommand(CommandType.SET_TEMPO, { bpm }); }
    
    muteTrack(trackId, muted) { 
        return this.sendCommand(CommandType.MUTE_TRACK, { trackId, muted }); 
    }
    
    soloTrack(trackId, soloed) { 
        return this.sendCommand(CommandType.SOLO_TRACK, { trackId, soloed }); 
    }
    
    setTrackVolume(trackId, volume) { 
        return this.sendCommand(CommandType.SET_TRACK_VOLUME, { trackId, volume }); 
    }
    
    startRecording(trackId) { 
        return this.sendCommand(CommandType.START_RECORDING, { trackId }); 
    }
    
    stopRecording() { 
        return this.sendCommand(CommandType.STOP_RECORDING); 
    }
    
    setLoopRegion(start, end) { 
        return this.sendCommand(CommandType.SET_LOOP_REGION, { start, end }); 
    }
    
    toggleLoop(enabled) { 
        return this.sendCommand(CommandType.TOGGLE_LOOP, { enabled }); 
    }

    /**
     * Event handling
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) callbacks.splice(index, 1);
        }
    }

    _emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }
}

/**
 * Create a remote control server
 */
export function createRemoteControlServer(options = {}) {
    return new RemoteControlServer(options);
}

/**
 * Create a remote control client
 */
export function createRemoteControlClient(options = {}) {
    return new RemoteControlClient(options);
}