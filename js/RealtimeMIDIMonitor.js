/**
 * Real-time MIDI Monitor - Live MIDI message display
 * Shows incoming MIDI messages in real-time with filtering and logging
 */

export class RealtimeMIDIMonitor {
    constructor(options = {}) {
        // MIDI access
        this.midiAccess = null;
        this.activeInputs = new Map(); // inputId -> { input, name }
        
        // Monitor state
        this.enabled = false;
        this.paused = false;
        
        // Message buffer
        this.messages = [];
        this.maxMessages = options.maxMessages || 500;
        
        // Filtering
        this.filters = {
            channels: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]), // All channels
            messageTypes: new Set(['noteon', 'noteoff', 'controlchange', 'programchange', 'pitchbend', 'aftertouch', 'polypressure']),
            noteRange: { min: 0, max: 127 },
            ccRange: { min: 0, max: 127 }
        };
        
        // Statistics
        this.stats = {
            total: 0,
            noteOn: 0,
            noteOff: 0,
            controlChange: 0,
            programChange: 0,
            pitchBend: 0,
            aftertouch: 0,
            polyPressure: 0,
            startTime: null,
            messagesPerSecond: 0
        };
        
        // History for rate calculation
        this.messageTimestamps = [];
        
        // Callbacks
        this.onMessage = null;
        this.onStatsUpdate = null;
        this.onInputConnected = null;
        this.onInputDisconnected = null;
        
        // Display settings
        this.displayMode = options.displayMode || 'hex'; // 'hex', 'decimal', 'named'
        this.showTimestamp = options.showTimestamp ?? true;
        this.showChannel = options.showChannel ?? true;
        
        // Note names
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    }
    
    /**
     * Initialize MIDI access
     */
    async initialize() {
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
            
            // Connect to all available inputs
            for (const input of this.midiAccess.inputs.values()) {
                this.connectInput(input);
            }
            
            // Listen for device changes
            this.midiAccess.onstatechange = (event) => {
                const port = event.port;
                
                if (port.type === 'input') {
                    if (port.state === 'connected') {
                        this.connectInput(port);
                        if (this.onInputConnected) {
                            this.onInputConnected(port.name, port.id);
                        }
                    } else if (port.state === 'disconnected') {
                        this.disconnectInput(port.id);
                        if (this.onInputDisconnected) {
                            this.onInputDisconnected(port.name, port.id);
                        }
                    }
                }
            };
            
            console.log('[RealtimeMIDIMonitor] Initialized');
            return true;
        } catch (error) {
            console.warn('[RealtimeMIDIMonitor] MIDI access not available', error);
            return false;
        }
    }
    
    /**
     * Connect to a MIDI input
     */
    connectInput(input) {
        if (this.activeInputs.has(input.id)) return;
        
        this.activeInputs.set(input.id, {
            input: input,
            name: input.name || `Input ${input.id}`
        });
        
        input.onmidimessage = (message) => this.handleMIDIMessage(message, input.id);
        
        console.log(`[RealtimeMIDIMonitor] Connected to ${input.name}`);
    }
    
    /**
     * Disconnect from a MIDI input
     */
    disconnectInput(inputId) {
        const inputData = this.activeInputs.get(inputId);
        if (!inputData) return;
        
        inputData.input.onmidimessage = null;
        this.activeInputs.delete(inputId);
        
        console.log(`[RealtimeMIDIMonitor] Disconnected from ${inputData.name}`);
    }
    
    /**
     * Handle incoming MIDI message
     */
    handleMIDIMessage(message, inputId) {
        if (!this.enabled || this.paused) return;
        
        const data = message.data;
        const timestamp = message.timeStamp;
        
        // Parse message
        const status = data[0] & 0xF0;
        const channel = (data[0] & 0x0F) + 1;
        const messageInfo = this.parseMessage(status, data);
        
        // Apply filters
        if (!this.passesFilters(channel, messageInfo)) return;
        
        // Create message record
        const record = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            timestamp: timestamp,
            inputId: inputId,
            inputName: this.activeInputs.get(inputId)?.name || 'Unknown',
            channel: channel,
            type: messageInfo.type,
            typeName: messageInfo.typeName,
            status: status,
            data: Array.from(data),
            parsed: messageInfo.parsed,
            display: this.formatMessageForDisplay(messageInfo, channel, data)
        };
        
        // Add to buffer
        this.messages.unshift(record);
        if (this.messages.length > this.maxMessages) {
            this.messages.pop();
        }
        
        // Update statistics
        this.updateStats(messageInfo.type);
        
        // Track timestamp for rate calculation
        this.messageTimestamps.push(timestamp);
        if (this.messageTimestamps.length > 100) {
            this.messageTimestamps.shift();
        }
        
        // Callback
        if (this.onMessage) {
            this.onMessage(record);
        }
    }
    
    /**
     * Parse MIDI message
     */
    parseMessage(status, data) {
        let type, typeName, parsed;
        
        switch (status) {
            case 0x80: // Note Off
                type = 'noteoff';
                typeName = 'Note Off';
                parsed = {
                    note: data[1],
                    noteName: this.noteNumberToName(data[1]),
                    velocity: data[2]
                };
                break;
                
            case 0x90: // Note On
                type = data[2] > 0 ? 'noteon' : 'noteoff'; // Velocity 0 = note off
                typeName = data[2] > 0 ? 'Note On' : 'Note Off (vel 0)';
                parsed = {
                    note: data[1],
                    noteName: this.noteNumberToName(data[1]),
                    velocity: data[2]
                };
                break;
                
            case 0xA0: // Polyphonic Aftertouch
                type = 'polypressure';
                typeName = 'Poly Pressure';
                parsed = {
                    note: data[1],
                    noteName: this.noteNumberToName(data[1]),
                    pressure: data[2]
                };
                break;
                
            case 0xB0: // Control Change
                type = 'controlchange';
                typeName = 'Control Change';
                parsed = {
                    controller: data[1],
                    controllerName: this.controllerNumberToName(data[1]),
                    value: data[2]
                };
                break;
                
            case 0xC0: // Program Change
                type = 'programchange';
                typeName = 'Program Change';
                parsed = {
                    program: data[1],
                    programName: `Program ${data[1] + 1}`
                };
                break;
                
            case 0xD0: // Channel Aftertouch
                type = 'aftertouch';
                typeName = 'Aftertouch';
                parsed = {
                    pressure: data[1]
                };
                break;
                
            case 0xE0: // Pitch Bend
                type = 'pitchbend';
                typeName = 'Pitch Bend';
                const pitchValue = (data[2] << 7) | data[1];
                parsed = {
                    raw: pitchValue,
                    normalized: (pitchValue - 8192) / 8192, // -1 to 1
                    cents: Math.round(((pitchValue - 8192) / 8192) * 200) // -200 to +200 cents
                };
                break;
                
            case 0xF0: // System messages
                type = 'system';
                typeName = 'System';
                parsed = {
                    message: data[0],
                    data: Array.from(data).slice(1)
                };
                break;
                
            default:
                type = 'unknown';
                typeName = 'Unknown';
                parsed = { raw: Array.from(data) };
        }
        
        return { type, typeName, parsed };
    }
    
    /**
     * Check if message passes filters
     */
    passesFilters(channel, messageInfo) {
        // Channel filter
        if (!this.filters.channels.has(channel)) return false;
        
        // Message type filter
        if (!this.filters.messageTypes.has(messageInfo.type)) return false;
        
        // Note range filter
        if (messageInfo.type === 'noteon' || messageInfo.type === 'noteoff') {
            const note = messageInfo.parsed.note;
            if (note < this.filters.noteRange.min || note > this.filters.noteRange.max) {
                return false;
            }
        }
        
        // CC range filter
        if (messageInfo.type === 'controlchange') {
            const cc = messageInfo.parsed.controller;
            if (cc < this.filters.ccRange.min || cc > this.filters.ccRange.max) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Update statistics
     */
    updateStats(type) {
        this.stats.total++;
        
        switch (type) {
            case 'noteon':
                this.stats.noteOn++;
                break;
            case 'noteoff':
                this.stats.noteOff++;
                break;
            case 'controlchange':
                this.stats.controlChange++;
                break;
            case 'programchange':
                this.stats.programChange++;
                break;
            case 'pitchbend':
                this.stats.pitchBend++;
                break;
            case 'aftertouch':
                this.stats.aftertouch++;
                break;
            case 'polypressure':
                this.stats.polyPressure++;
                break;
        }
        
        // Calculate messages per second
        if (this.messageTimestamps.length >= 2) {
            const first = this.messageTimestamps[0];
            const last = this.messageTimestamps[this.messageTimestamps.length - 1];
            const duration = (last - first) / 1000;
            if (duration > 0) {
                this.stats.messagesPerSecond = Math.round(this.messageTimestamps.length / duration);
            }
        }
        
        if (this.onStatsUpdate) {
            this.onStatsUpdate(this.stats);
        }
    }
    
    /**
     * Format message for display
     */
    formatMessageForDisplay(messageInfo, channel, data) {
        let display = '';
        
        switch (this.displayMode) {
            case 'hex':
                display = data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
                break;
                
            case 'decimal':
                display = Array.from(data).join(' ');
                break;
                
            case 'named':
                display = messageInfo.typeName;
                if (messageInfo.parsed.noteName) {
                    display += ` ${messageInfo.parsed.noteName}`;
                }
                if (messageInfo.parsed.velocity !== undefined) {
                    display += ` vel:${messageInfo.parsed.velocity}`;
                }
                if (messageInfo.parsed.controllerName) {
                    display += ` ${messageInfo.parsed.controllerName}`;
                }
                if (messageInfo.parsed.value !== undefined) {
                    display += ` = ${messageInfo.parsed.value}`;
                }
                break;
        }
        
        if (this.showChannel) {
            display = `Ch${channel}: ${display}`;
        }
        
        return display;
    }
    
    /**
     * Convert note number to name
     */
    noteNumberToName(noteNumber) {
        const octave = Math.floor(noteNumber / 12) - 1;
        const noteName = this.noteNames[noteNumber % 12];
        return `${noteName}${octave}`;
    }
    
    /**
     * Convert controller number to name
     */
    controllerNumberToName(cc) {
        const controllerNames = {
            0: 'Bank Select MSB',
            1: 'Modulation',
            2: 'Breath',
            4: 'Foot',
            5: 'Portamento Time',
            6: 'Data Entry MSB',
            7: 'Volume',
            8: 'Balance',
            10: 'Pan',
            11: 'Expression',
            12: 'Effect 1',
            13: 'Effect 2',
            32: 'Bank Select LSB',
            64: 'Sustain',
            65: 'Portamento',
            66: 'Sostenuto',
            67: 'Soft',
            68: 'Legato',
            69: 'Hold 2',
            70: 'Sound Variation',
            71: 'Timbre',
            72: 'Release Time',
            73: 'Attack Time',
            74: 'Brightness',
            75: 'Decay Time',
            76: 'Vibrato Rate',
            77: 'Vibrato Depth',
            78: 'Vibrato Delay',
            84: 'Portamento Control',
            91: 'Reverb',
            92: 'Tremolo',
            93: 'Chorus',
            94: 'Detune',
            95: 'Phaser',
            96: 'Data Increment',
            97: 'Data Decrement',
            98: 'Non-Reg Param LSB',
            99: 'Non-Reg Param MSB',
            100: 'Reg Param LSB',
            101: 'Reg Param MSB',
            120: 'All Sound Off',
            121: 'Reset All Controllers',
            122: 'Local Control',
            123: 'All Notes Off',
            124: 'Omni Off',
            125: 'Omni On',
            126: 'Mono Mode',
            127: 'Poly Mode'
        };
        
        return controllerNames[cc] || `CC${cc}`;
    }
    
    /**
     * Start monitoring
     */
    start() {
        this.enabled = true;
        this.paused = false;
        this.stats.startTime = Date.now();
        
        console.log('[RealtimeMIDIMonitor] Started');
    }
    
    /**
     * Stop monitoring
     */
    stop() {
        this.enabled = false;
        this.paused = false;
        
        console.log('[RealtimeMIDIMonitor] Stopped');
    }
    
    /**
     * Pause monitoring
     */
    pause() {
        this.paused = true;
    }
    
    /**
     * Resume monitoring
     */
    resume() {
        this.paused = false;
    }
    
    /**
     * Clear message history
     */
    clearMessages() {
        this.messages = [];
        this.messageTimestamps = [];
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            total: 0,
            noteOn: 0,
            noteOff: 0,
            controlChange: 0,
            programChange: 0,
            pitchBend: 0,
            aftertouch: 0,
            polyPressure: 0,
            startTime: Date.now(),
            messagesPerSecond: 0
        };
    }
    
    /**
     * Set channel filter
     */
    setChannelFilter(channels) {
        if (Array.isArray(channels)) {
            this.filters.channels = new Set(channels);
        }
    }
    
    /**
     * Set message type filter
     */
    setMessageTypeFilter(types) {
        if (Array.isArray(types)) {
            this.filters.messageTypes = new Set(types);
        }
    }
    
    /**
     * Set note range filter
     */
    setNoteRangeFilter(min, max) {
        this.filters.noteRange = { min: Math.max(0, min), max: Math.min(127, max) };
    }
    
    /**
     * Set CC range filter
     */
    setCCRangeFilter(min, max) {
        this.filters.ccRange = { min: Math.max(0, min), max: Math.min(127, max) };
    }
    
    /**
     * Export messages to JSON
     */
    exportMessages() {
        return {
            exported: Date.now(),
            stats: this.stats,
            messages: this.messages
        };
    }
    
    /**
     * Get connected inputs
     */
    getConnectedInputs() {
        return Array.from(this.activeInputs.entries()).map(([id, data]) => ({
            id: id,
            name: data.name
        }));
    }
    
    /**
     * Get recent messages
     */
    getRecentMessages(count = 50) {
        return this.messages.slice(0, count);
    }
    
    /**
     * Destroy the monitor
     */
    destroy() {
        this.stop();
        
        for (const [id, data] of this.activeInputs) {
            data.input.onmidimessage = null;
        }
        
        this.activeInputs.clear();
        this.messages = [];
    }
}

/**
 * Create the MIDI monitor panel UI
 */
export function createMIDIMonitorPanel(monitor, appServices) {
    const container = document.createElement('div');
    container.className = 'midi-monitor-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        min-width: 500px;
        max-width: 700px;
    `;
    
    // Title and status
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
    header.innerHTML = `
        <h3 style="margin: 0; font-size: 16px;">MIDI Monitor</h3>
        <span id="monitorStatus" style="color: #ef4444; font-size: 12px;">● Stopped</span>
    `;
    container.appendChild(header);
    
    // Connected inputs
    const inputsContainer = document.createElement('div');
    inputsContainer.id = 'inputsContainer';
    inputsContainer.style.cssText = 'margin-bottom: 12px; font-size: 11px; color: #9ca3af;';
    container.appendChild(inputsContainer);
    
    // Statistics
    const statsContainer = document.createElement('div');
    statsContainer.id = 'statsContainer';
    statsContainer.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 16px;
    `;
    container.appendChild(statsContainer);
    
    // Message log
    const logContainer = document.createElement('div');
    logContainer.style.cssText = `
        background: #0a0a14;
        border-radius: 4px;
        padding: 8px;
        height: 300px;
        overflow-y: auto;
        font-size: 11px;
        margin-bottom: 16px;
    `;
    
    const logList = document.createElement('div');
    logList.id = 'messageLog';
    logContainer.appendChild(logList);
    container.appendChild(logContainer);
    
    // Filters
    const filtersContainer = document.createElement('div');
    filtersContainer.style.cssText = `
        margin-bottom: 16px;
        padding: 12px;
        background: #0a0a14;
        border-radius: 4px;
    `;
    filtersContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 12px; color: #9ca3af;">Filters</div>
        <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
            <select id="displayMode" style="padding: 4px 8px; background: #374151; border: none; border-radius: 4px; color: white; font-size: 11px;">
                <option value="named">Named</option>
                <option value="hex">Hex</option>
                <option value="decimal">Decimal</option>
            </select>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 11px;">
                <input type="checkbox" id="filterNoteOn" checked> Note On
            </label>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 11px;">
                <input type="checkbox" id="filterNoteOff" checked> Note Off
            </label>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 11px;">
                <input type="checkbox" id="filterCC" checked> CC
            </label>
            <label style="display: flex; align-items: center; gap: 4px; font-size: 11px;">
                <input type="checkbox" id="filterPitchBend" checked> Pitch Bend
            </label>
        </div>
    `;
    container.appendChild(filtersContainer);
    
    // Actions
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = 'display: flex; gap: 8px;';
    actionsContainer.innerHTML = `
        <button id="startBtn" style="flex: 1; padding: 10px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600;">
            Start
        </button>
        <button id="pauseBtn" style="flex: 1; padding: 10px; background: #f59e0b; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600; display: none;">
            Pause
        </button>
        <button id="resumeBtn" style="flex: 1; padding: 10px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600; display: none;">
            Resume
        </button>
        <button id="stopBtn" style="flex: 1; padding: 10px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer; font-weight: 600; display: none;">
            Stop
        </button>
        <button id="clearBtn" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Clear Log
        </button>
        <button id="exportBtn" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Export
        </button>
    `;
    container.appendChild(actionsContainer);
    
    // Update functions
    function updateInputsList() {
        const inputs = monitor.getConnectedInputs();
        if (inputs.length === 0) {
            inputsContainer.innerHTML = '<span style="color: #6b7280;">No MIDI inputs connected</span>';
        } else {
            inputsContainer.innerHTML = `
                <span style="color: #22c55e;">●</span>
                ${inputs.map(i => i.name).join(', ')}
            `;
        }
    }
    
    function updateStats() {
        const stats = monitor.stats;
        const duration = stats.startTime ? Math.floor((Date.now() - stats.startTime) / 1000) : 0;
        
        statsContainer.innerHTML = `
            <div style="background: #0a0a14; padding: 8px; border-radius: 4px; text-align: center;">
                <div style="font-size: 18px; color: #22c55e;">${stats.total}</div>
                <div style="font-size: 10px; color: #6b7280;">Total</div>
            </div>
            <div style="background: #0a0a14; padding: 8px; border-radius: 4px; text-align: center;">
                <div style="font-size: 18px; color: #3b82f6;">${stats.noteOn + stats.noteOff}</div>
                <div style="font-size: 10px; color: #6b7280;">Notes</div>
            </div>
            <div style="background: #0a0a14; padding: 8px; border-radius: 4px; text-align: center;">
                <div style="font-size: 18px; color: #f59e0b;">${stats.controlChange}</div>
                <div style="font-size: 10px; color: #6b7280;">CC</div>
            </div>
            <div style="background: #0a0a14; padding: 8px; border-radius: 4px; text-align: center;">
                <div style="font-size: 18px; color: #ec4899;">${stats.messagesPerSecond}</div>
                <div style="font-size: 10px; color: #6b7280;">Msg/sec</div>
            </div>
        `;
    }
    
    function addMessageToLog(record) {
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            padding: 2px 0;
            border-bottom: 1px solid #1e1e2e;
            color: ${getMessageColor(record.type)};
        `;
        
        const time = new Date(record.timestamp).toLocaleTimeString();
        messageEl.innerHTML = `
            <span style="color: #6b7280;">${time}</span>
            <span style="color: ${getInputColor(record.inputId)};">[${record.inputName}]</span>
            ${record.display}
        `;
        
        logList.insertBefore(messageEl, logList.firstChild);
        
        // Limit log size
        while (logList.children.length > 100) {
            logList.removeChild(logList.lastChild);
        }
    }
    
    function getMessageColor(type) {
        const colors = {
            noteon: '#22c55e',
            noteoff: '#ef4444',
            controlchange: '#f59e0b',
            programchange: '#3b82f6',
            pitchbend: '#ec4899',
            aftertouch: '#8b5cf6',
            polypressure: '#06b6d4'
        };
        return colors[type] || '#ffffff';
    }
    
    function getInputColor(inputId) {
        const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
        const index = Math.abs(inputId.charCodeAt(0)) % colors.length;
        return colors[index];
    }
    
    function updateStatus(running, paused) {
        const status = document.getElementById('monitorStatus');
        if (!running) {
            status.innerHTML = '<span style="color: #ef4444;">● Stopped</span>';
        } else if (paused) {
            status.innerHTML = '<span style="color: #f59e0b;">● Paused</span>';
        } else {
            status.innerHTML = '<span style="color: #22c55e;">● Running</span>';
        }
    }
    
    // Event handlers
    document.getElementById('startBtn').addEventListener('click', async () => {
        if (!monitor.midiAccess) {
            const success = await monitor.initialize();
            if (!success) {
                appServices?.showNotification?.('MIDI access not available', 3000);
                return;
            }
        }
        
        monitor.start();
        updateInputsList();
        updateStatus(true, false);
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = 'block';
        document.getElementById('stopBtn').style.display = 'block';
    });
    
    document.getElementById('pauseBtn').addEventListener('click', () => {
        monitor.pause();
        updateStatus(true, true);
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('resumeBtn').style.display = 'block';
    });
    
    document.getElementById('resumeBtn').addEventListener('click', () => {
        monitor.resume();
        updateStatus(true, false);
        document.getElementById('resumeBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = 'block';
    });
    
    document.getElementById('stopBtn').addEventListener('click', () => {
        monitor.stop();
        updateStatus(false, false);
        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('resumeBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'none';
    });
    
    document.getElementById('clearBtn').addEventListener('click', () => {
        monitor.clearMessages();
        logList.innerHTML = '';
        monitor.resetStats();
        updateStats();
    });
    
    document.getElementById('exportBtn').addEventListener('click', () => {
        const data = monitor.exportMessages();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `midi-log-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        appServices?.showNotification?.('Exported MIDI log', 2000);
    });
    
    // Display mode
    document.getElementById('displayMode').addEventListener('change', (e) => {
        monitor.displayMode = e.target.value;
    });
    
    // Filter checkboxes
    const filterCheckboxes = {
        filterNoteOn: 'noteon',
        filterNoteOff: 'noteoff',
        filterCC: 'controlchange',
        filterPitchBend: 'pitchbend'
    };
    
    Object.entries(filterCheckboxes).forEach(([id, type]) => {
        document.getElementById(id).addEventListener('change', (e) => {
            if (e.target.checked) {
                monitor.filters.messageTypes.add(type);
            } else {
                monitor.filters.messageTypes.delete(type);
            }
        });
    });
    
    // Set up callbacks
    monitor.onMessage = (record) => {
        addMessageToLog(record);
        updateStats();
    };
    
    monitor.onInputConnected = (name, id) => {
        updateInputsList();
        appServices?.showNotification?.(`MIDI device connected: ${name}`, 2000);
    };
    
    monitor.onInputDisconnected = (name, id) => {
        updateInputsList();
        appServices?.showNotification?.(`MIDI device disconnected: ${name}`, 2000);
    };
    
    // Initial state
    updateStats();
    updateInputsList();
    
    return container;
}

// Factory function
export function createRealtimeMIDIMonitor(options = {}) {
    return new RealtimeMIDIMonitor(options);
}

export default RealtimeMIDIMonitor;