/**
 * MIDIThruMode.js
 * Pass-through incoming MIDI to output
 * Enables real-time MIDI forwarding with filtering and transformation
 */

export class MIDIThruMode {
    constructor(options = {}) {
        // Settings
        this.settings = {
            enabled: options.enabled ?? false,
            passNoteOn: options.passNoteOn ?? true,
            passNoteOff: options.passNoteOff ?? true,
            passCC: options.passCC ?? true,
            passProgramChange: options.passProgramChange ?? true,
            passPitchBend: options.passPitchBend ?? true,
            passAftertouch: options.passAftertouch ?? true,
            passSysEx: options.passSysEx ?? false,      // SysEx often needs explicit permission
            transpose: options.transpose ?? 0,          // Semitones
            velocityScale: options.velocityScale ?? 1.0, // Velocity multiplier
            channelOffset: options.channelOffset ?? 0,   // Channel remapping offset
            filterChannels: options.filterChannels ?? [], // Channels to block
            filterNotes: options.filterNotes ?? [],      // Notes to block
            velocityMin: options.velocityMin ?? 1,
            velocityMax: options.velocityMax ?? 127,
            delayMs: options.delayMs ?? 0,              // Optional delay
            duplicate: options.duplicate ?? false,      // Send to multiple outputs
            duplicateChannels: options.duplicateChannels ?? []
        };
        
        // MIDI ports
        this.inputPort = null;
        this.outputPorts = []; // Multiple output support
        
        // Access
        this.midiAccess = null;
        
        // Statistics
        this.stats = {
            messagesPassed: 0,
            messagesFiltered: 0,
            noteOnCount: 0,
            noteOffCount: 0,
            ccCount: 0,
            lastMessage: null,
            lastMessageTime: null
        };
        
        // Callbacks
        this.onMessage = options.onMessage ?? null;
        this.onFilter = options.onFilter ?? null;
        this.onError = options.onError ?? null;
        
        // Message queue for delay
        this.messageQueue = [];
        this.processQueueInterval = null;
    }
    
    /**
     * Initialize MIDI access
     */
    async init() {
        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: this.settings.passSysEx });
            
            console.log('[MIDIThru] MIDI access initialized');
            console.log(`[MIDIThru] Inputs: ${Array.from(this.midiAccess.inputs.keys()).join(', ') || 'none'}`);
            console.log(`[MIDIThru] Outputs: ${Array.from(this.midiAccess.outputs.keys()).join(', ') || 'none'}`);
            
            return true;
        } catch (error) {
            console.error('[MIDIThru] Failed to initialize MIDI access:', error);
            if (this.onError) {
                this.onError(error);
            }
            return false;
        }
    }
    
    /**
     * Set input port
     */
    setInput(portId) {
        if (!this.midiAccess) {
            console.warn('[MIDIThru] MIDI access not initialized');
            return false;
        }
        
        // Disconnect previous input
        if (this.inputPort) {
            this.inputPort.onmidimessage = null;
        }
        
        // Find and connect to new input
        const port = this.midiAccess.inputs.get(portId);
        if (!port) {
            console.warn(`[MIDIThru] Input port "${portId}" not found`);
            return false;
        }
        
        this.inputPort = port;
        this.inputPort.onmidimessage = (event) => this._handleMIDIMessage(event);
        
        console.log(`[MIDIThru] Connected to input: ${port.name}`);
        return true;
    }
    
    /**
     * Add output port
     */
    addOutput(portId) {
        if (!this.midiAccess) {
            console.warn('[MIDIThru] MIDI access not initialized');
            return false;
        }
        
        const port = this.midiAccess.outputs.get(portId);
        if (!port) {
            console.warn(`[MIDIThru] Output port "${portId}" not found`);
            return false;
        }
        
        if (!this.outputPorts.includes(port)) {
            this.outputPorts.push(port);
            console.log(`[MIDIThru] Added output: ${port.name}`);
        }
        
        return true;
    }
    
    /**
     * Remove output port
     */
    removeOutput(portId) {
        this.outputPorts = this.outputPorts.filter(port => port.id !== portId);
        console.log(`[MIDIThru] Removed output: ${portId}`);
    }
    
    /**
     * Set single output (replace all)
     */
    setOutput(portId) {
        this.outputPorts = [];
        return this.addOutput(portId);
    }
    
    /**
     * Get available input ports
     */
    getAvailableInputs() {
        if (!this.midiAccess) return [];
        
        const inputs = [];
        this.midiAccess.inputs.forEach(port => {
            inputs.push({
                id: port.id,
                name: port.name,
                manufacturer: port.manufacturer,
                state: port.state,
                connection: port.connection
            });
        });
        
        return inputs;
    }
    
    /**
     * Get available output ports
     */
    getAvailableOutputs() {
        if (!this.midiAccess) return [];
        
        const outputs = [];
        this.midiAccess.outputs.forEach(port => {
            outputs.push({
                id: port.id,
                name: port.name,
                manufacturer: port.manufacturer,
                state: port.state,
                connection: port.connection
            });
        });
        
        return outputs;
    }
    
    /**
     * Handle incoming MIDI message
     */
    _handleMIDIMessage(event) {
        if (!this.settings.enabled) return;
        
        const message = this._parseMessage(event.data);
        
        // Store for stats
        this.stats.lastMessage = message;
        this.stats.lastMessageTime = Date.now();
        
        // Apply filtering
        if (this._shouldFilter(message)) {
            this.stats.messagesFiltered++;
            if (this.onFilter) {
                this.onFilter(message);
            }
            return;
        }
        
        // Transform message
        const transformed = this._transformMessage(message);
        
        // Send to outputs
        if (this.settings.delayMs > 0) {
            // Queue for delayed sending
            this.messageQueue.push({
                message: transformed,
                sendTime: Date.now() + this.settings.delayMs
            });
            
            if (!this.processQueueInterval) {
                this._startQueueProcessor();
            }
        } else {
            this._sendMessage(transformed);
        }
        
        this.stats.messagesPassed++;
        
        if (this.onMessage) {
            this.onMessage(transformed, message);
        }
    }
    
    /**
     * Parse raw MIDI data into structured message
     */
    _parseMessage(data) {
        const status = data[0];
        const statusType = status & 0xF0;
        const channel = (status & 0x0F) + 1; // 1-16
        
        return {
            status,
            statusType,
            channel,
            data1: data[1] ?? null,
            data2: data[2] ?? null,
            raw: data,
            type: this._getMessageType(statusType)
        };
    }
    
    /**
     * Get message type string
     */
    _getMessageType(statusType) {
        const types = {
            0x80: 'noteoff',
            0x90: 'noteon',
            0xA0: 'aftertouch_poly',
            0xB0: 'cc',
            0xC0: 'program',
            0xD0: 'aftertouch_channel',
            0xE0: 'pitchbend',
            0xF0: 'sysex'
        };
        return types[statusType] || 'unknown';
    }
    
    /**
     * Check if message should be filtered
     */
    _shouldFilter(message) {
        // Filter by message type
        switch (message.type) {
            case 'noteon':
                if (!this.settings.passNoteOn) return true;
                this.stats.noteOnCount++;
                break;
            case 'noteoff':
                if (!this.settings.passNoteOff) return true;
                this.stats.noteOffCount++;
                break;
            case 'cc':
                if (!this.settings.passCC) return true;
                this.stats.ccCount++;
                break;
            case 'program':
                if (!this.settings.passProgramChange) return true;
                break;
            case 'pitchbend':
                if (!this.settings.passPitchBend) return true;
                break;
            case 'aftertouch_poly':
            case 'aftertouch_channel':
                if (!this.settings.passAftertouch) return true;
                break;
            case 'sysex':
                if (!this.settings.passSysEx) return true;
                break;
        }
        
        // Filter by channel
        if (this.settings.filterChannels.includes(message.channel)) {
            return true;
        }
        
        // Filter by note (for note messages)
        if ((message.type === 'noteon' || message.type === 'noteoff') &&
            this.settings.filterNotes.includes(message.data1)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Transform message according to settings
     */
    _transformMessage(message) {
        const transformed = { ...message };
        const newData = new Uint8Array(message.raw.length);
        
        // Copy raw data
        for (let i = 0; i < message.raw.length; i++) {
            newData[i] = message.raw[i];
        }
        
        // Apply channel offset
        if (this.settings.channelOffset !== 0) {
            let newChannel = message.channel + this.settings.channelOffset;
            newChannel = ((newChannel - 1) % 16 + 16) % 16 + 1; // Wrap to 1-16
            newData[0] = (message.statusType) | (newChannel - 1);
            transformed.channel = newChannel;
        }
        
        // Apply transpose (for note messages)
        if (this.settings.transpose !== 0 && 
            (message.type === 'noteon' || message.type === 'noteoff')) {
            let newNote = message.data1 + this.settings.transpose;
            newNote = Math.max(0, Math.min(127, newNote));
            newData[1] = newNote;
            transformed.data1 = newNote;
        }
        
        // Apply velocity scale (for note on messages)
        if (this.settings.velocityScale !== 1.0 && message.type === 'noteon') {
            let newVelocity = Math.round(message.data2 * this.settings.velocityScale);
            newVelocity = Math.max(this.settings.velocityMin, 
                                   Math.min(this.settings.velocityMax, newVelocity));
            newData[2] = newVelocity;
            transformed.data2 = newVelocity;
        }
        
        transformed.raw = newData;
        return transformed;
    }
    
    /**
     * Send message to all output ports
     */
    _sendMessage(message) {
        this.outputPorts.forEach(port => {
            try {
                port.send(message.raw);
            } catch (error) {
                console.error(`[MIDIThru] Error sending to ${port.name}:`, error);
            }
        });
        
        // Duplicate to additional channels if configured
        if (this.settings.duplicate && this.settings.duplicateChannels.length > 0) {
            this.settings.duplicateChannels.forEach(channelOffset => {
                const dupData = new Uint8Array(message.raw);
                let newChannel = message.channel + channelOffset;
                newChannel = ((newChannel - 1) % 16 + 16) % 16 + 1;
                dupData[0] = (message.statusType) | (newChannel - 1);
                
                this.outputPorts.forEach(port => {
                    try {
                        port.send(dupData);
                    } catch (error) {
                        console.error(`[MIDIThru] Error sending duplicate:`, error);
                    }
                });
            });
        }
    }
    
    /**
     * Start the message queue processor (for delay)
     */
    _startQueueProcessor() {
        this.processQueueInterval = setInterval(() => {
            const now = Date.now();
            
            while (this.messageQueue.length > 0 && this.messageQueue[0].sendTime <= now) {
                const item = this.messageQueue.shift();
                this._sendMessage(item.message);
            }
            
            if (this.messageQueue.length === 0) {
                clearInterval(this.processQueueInterval);
                this.processQueueInterval = null;
            }
        }, 1); // Check every 1ms
    }
    
    /**
     * Enable/disable thru mode
     */
    setEnabled(enabled) {
        this.settings.enabled = enabled;
        console.log(`[MIDIThru] ${enabled ? 'Enabled' : 'Disabled'}`);
    }
    
    /**
     * Toggle thru mode
     */
    toggle() {
        this.setEnabled(!this.settings.enabled);
    }
    
    /**
     * Set transpose value
     */
    setTranspose(semitones) {
        this.settings.transpose = semitones;
    }
    
    /**
     * Set velocity scale
     */
    setVelocityScale(scale) {
        this.settings.velocityScale = Math.max(0, Math.min(2, scale));
    }
    
    /**
     * Set channel offset
     */
    setChannelOffset(offset) {
        this.settings.channelOffset = offset;
    }
    
    /**
     * Add channel to filter
     */
    addFilterChannel(channel) {
        if (!this.settings.filterChannels.includes(channel)) {
            this.settings.filterChannels.push(channel);
        }
    }
    
    /**
     * Remove channel from filter
     */
    removeFilterChannel(channel) {
        this.settings.filterChannels = this.settings.filterChannels.filter(c => c !== channel);
    }
    
    /**
     * Clear all channel filters
     */
    clearFilterChannels() {
        this.settings.filterChannels = [];
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            messagesPassed: 0,
            messagesFiltered: 0,
            noteOnCount: 0,
            noteOffCount: 0,
            ccCount: 0,
            lastMessage: null,
            lastMessageTime: null
        };
    }
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            enabled: this.settings.enabled,
            inputConnected: this.inputPort !== null,
            inputName: this.inputPort?.name ?? null,
            outputCount: this.outputPorts.length,
            outputNames: this.outputPorts.map(p => p.name),
            stats: { ...this.stats },
            settings: { ...this.settings }
        };
    }
    
    /**
     * Create settings UI panel
     */
    static createPanel(midiThru, containerId) {
        const container = document.getElementById(containerId) || document.body;
        
        const panel = document.createElement('div');
        panel.className = 'midi-thru-panel';
        panel.style.cssText = `
            padding: 16px;
            background: #1a1a2e;
            border-radius: 8px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
            min-width: 300px;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        `;
        
        const title = document.createElement('h3');
        title.textContent = 'MIDI Thru';
        title.style.cssText = 'margin: 0; font-size: 16px;';
        
        const enableBtn = document.createElement('button');
        enableBtn.id = 'thru-toggle';
        enableBtn.textContent = 'OFF';
        enableBtn.style.cssText = `
            padding: 6px 16px;
            background: #2a2a4e;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-weight: 600;
        `;
        
        header.appendChild(title);
        header.appendChild(enableBtn);
        panel.appendChild(header);
        
        // Input selector
        const inputGroup = document.createElement('div');
        inputGroup.style.cssText = 'margin-bottom: 12px;';
        inputGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Input:</label>
            <select id="thru-input" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
                <option value="">Select Input...</option>
            </select>
        `;
        panel.appendChild(inputGroup);
        
        // Output selector
        const outputGroup = document.createElement('div');
        outputGroup.style.cssText = 'margin-bottom: 12px;';
        outputGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Output:</label>
            <select id="thru-output" style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
                <option value="">Select Output...</option>
            </select>
        `;
        panel.appendChild(outputGroup);
        
        // Transpose
        const transposeGroup = document.createElement('div');
        transposeGroup.style.cssText = 'margin-bottom: 12px;';
        transposeGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Transpose (semitones):</label>
            <input type="number" id="thru-transpose" value="0" min="-24" max="24"
                style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
        `;
        panel.appendChild(transposeGroup);
        
        // Velocity scale
        const velocityGroup = document.createElement('div');
        velocityGroup.style.cssText = 'margin-bottom: 12px;';
        velocityGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Velocity Scale:</label>
            <input type="range" id="thru-velocity" min="0" max="200" value="100"
                style="width: 100%; accent-color: #3b82f6;">
            <span id="thru-velocity-value" style="font-size: 11px; color: #888;">100%</span>
        `;
        panel.appendChild(velocityGroup);
        
        // Channel offset
        const channelGroup = document.createElement('div');
        channelGroup.style.cssText = 'margin-bottom: 12px;';
        channelGroup.innerHTML = `
            <label style="display: block; margin-bottom: 4px; font-size: 12px;">Channel Offset:</label>
            <input type="number" id="thru-channel" value="0" min="-15" max="15"
                style="width: 100%; padding: 8px; background: #2a2a4e; border: 1px solid #444; border-radius: 4px; color: white;">
        `;
        panel.appendChild(channelGroup);
        
        // Stats display
        const statsDisplay = document.createElement('div');
        statsDisplay.id = 'thru-stats';
        statsDisplay.style.cssText = `
            margin-top: 12px;
            padding: 8px;
            background: #0a0a14;
            border-radius: 4px;
            font-size: 11px;
            color: #888;
        `;
        statsDisplay.innerHTML = `
            <div>Messages: <span id="stat-passed">0</span> passed, <span id="stat-filtered">0</span> filtered</div>
            <div>Last: <span id="stat-last">-</span></div>
        `;
        panel.appendChild(statsDisplay);
        
        // Populate ports
        const inputSelect = panel.querySelector('#thru-input');
        const outputSelect = panel.querySelector('#thru-output');
        
        const updatePorts = () => {
            inputSelect.innerHTML = '<option value="">Select Input...</option>';
            outputSelect.innerHTML = '<option value="">Select Output...</option>';
            
            midiThru.getAvailableInputs().forEach(input => {
                const option = document.createElement('option');
                option.value = input.id;
                option.textContent = input.name || input.id;
                inputSelect.appendChild(option);
            });
            
            midiThru.getAvailableOutputs().forEach(output => {
                const option = document.createElement('option');
                option.value = output.id;
                option.textContent = output.name || output.id;
                outputSelect.appendChild(option);
            });
        };
        
        // Initial populate
        setTimeout(updatePorts, 100);
        
        // Event handlers
        const updateEnableBtn = () => {
            if (midiThru.settings.enabled) {
                enableBtn.textContent = 'ON';
                enableBtn.style.background = '#10b981';
            } else {
                enableBtn.textContent = 'OFF';
                enableBtn.style.background = '#2a2a4e';
            }
        };
        updateEnableBtn();
        
        enableBtn.onclick = () => {
            midiThru.toggle();
            updateEnableBtn();
        };
        
        inputSelect.onchange = () => {
            midiThru.setInput(inputSelect.value);
        };
        
        outputSelect.onchange = () => {
            midiThru.setOutput(outputSelect.value);
        };
        
        panel.querySelector('#thru-transpose').onchange = (e) => {
            midiThru.setTranspose(parseInt(e.target.value));
        };
        
        const velocitySlider = panel.querySelector('#thru-velocity');
        const velocityValue = panel.querySelector('#thru-velocity-value');
        velocitySlider.oninput = () => {
            const scale = parseInt(velocitySlider.value) / 100;
            velocityValue.textContent = `${velocitySlider.value}%`;
            midiThru.setVelocityScale(scale);
        };
        
        panel.querySelector('#thru-channel').onchange = (e) => {
            midiThru.setChannelOffset(parseInt(e.target.value));
        };
        
        // Update stats periodically
        setInterval(() => {
            const status = midiThru.getStatus();
            panel.querySelector('#stat-passed').textContent = status.stats.messagesPassed;
            panel.querySelector('#stat-filtered').textContent = status.stats.messagesFiltered;
            
            if (status.stats.lastMessage) {
                const msg = status.stats.lastMessage;
                panel.querySelector('#stat-last').textContent = 
                    `${msg.type} ch${msg.channel} ${msg.data1 ?? ''} ${msg.data2 ?? ''}`;
            }
        }, 100);
        
        container.appendChild(panel);
        
        return panel;
    }
    
    /**
     * Serialize settings
     */
    serialize() {
        return {
            enabled: this.settings.enabled,
            settings: { ...this.settings },
            inputId: this.inputPort?.id ?? null,
            outputIds: this.outputPorts.map(p => p.id)
        };
    }
    
    /**
     * Restore settings
     */
    async restore(data) {
        this.settings = { ...this.settings, ...data.settings };
        this.setEnabled(data.enabled ?? false);
        
        // Reconnect ports
        if (data.inputId) {
            this.setInput(data.inputId);
        }
        
        if (data.outputIds) {
            data.outputIds.forEach(id => this.addOutput(id));
        }
    }
    
    /**
     * Cleanup
     */
    destroy() {
        if (this.inputPort) {
            this.inputPort.onmidimessage = null;
        }
        
        if (this.processQueueInterval) {
            clearInterval(this.processQueueInterval);
        }
        
        this.inputPort = null;
        this.outputPorts = [];
    }
}

export default MIDIThruMode;