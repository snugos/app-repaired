// js/MidiOutput.js - Enhanced MIDI Output Module
// Comprehensive external MIDI device support

/**
 * MidiOutputManager - Manages MIDI output to external devices.
 * 
 * Features:
 * - Multiple output device support (multi-port)
 * - MIDI clock sync (master clock output)
 * - MIDI file export (SMF format)
 * - Pitch bend, aftertouch, program change
 * - Per-track channel routing
 * - Thru mode (forward input to output)
 * - SysEx support
 */

// MIDI Status bytes
const MIDI_STATUS = {
    NOTE_OFF: 0x80,
    NOTE_ON: 0x90,
    POLY_PRESSURE: 0xA0,      // Polyphonic Aftertouch
    CONTROL_CHANGE: 0xB0,     // CC
    PROGRAM_CHANGE: 0xC0,
    CHANNEL_PRESSURE: 0xD0,   // Channel Aftertouch
    PITCH_BEND: 0xE0,
    SYS_EX: 0xF0,
    MIDI_CLOCK: 0xF8,
    MIDI_START: 0xFA,
    MIDI_CONTINUE: 0xFB,
    MIDI_STOP: 0xFC,
    ACTIVE_SENSING: 0xFE,
    RESET: 0xFF
};

// Standard MIDI CC numbers
const MIDI_CC = {
    BANK_SELECT_MSB: 0,
    MODULATION: 1,
    BREATH_CONTROLLER: 2,
    FOOT_CONTROLLER: 4,
    PORTAMENTO_TIME: 5,
    DATA_ENTRY_MSB: 6,
    VOLUME: 7,
    BALANCE: 8,
    PAN: 10,
    EXPRESSION: 11,
    EFFECT1: 12,
    EFFECT2: 13,
    BANK_SELECT_LSB: 32,
    DAMPER_PEDAL: 64,        // Sustain
    PORTAMENTO: 65,
    SOSTENUTO: 66,
    SOFT_PEDAL: 67,
    LEGATO: 68,
    HOLD2: 69,
    PORTAMENTO_SWITCH: 84,
    REVERB_DEPTH: 91,
    CHORUS_DEPTH: 93,
    ALL_SOUND_OFF: 120,
    RESET_ALL_CONTROLLERS: 121,
    ALL_NOTES_OFF: 123
};

/**
 * MidiClock - Generates MIDI clock pulses synchronized to DAW tempo.
 */
export class MidiClock {
    constructor() {
        this.isRunning = false;
        this.bpm = 120;
        this.pulseInterval = null;
        this.pulseCount = 0; // 24 PPQN (pulses per quarter note)
        this.outputs = []; // Connected MIDI outputs
        this.lastPulseTime = 0;
        this.startTime = 0;
    }

    /**
     * Set tempo for MIDI clock.
     * @param {number} bpm - Beats per minute
     */
    setTempo(bpm) {
        this.bpm = bpm;
        if (this.isRunning) {
            this._restartClock();
        }
    }

    /**
     * Add an output to receive clock messages.
     * @param {MIDIOutput} output - Web MIDI output port
     */
    addOutput(output) {
        if (!this.outputs.includes(output)) {
            this.outputs.push(output);
        }
    }

    /**
     * Remove an output from clock distribution.
     * @param {MIDIOutput} output - Web MIDI output port
     */
    removeOutput(output) {
        const index = this.outputs.indexOf(output);
        if (index > -1) {
            this.outputs.splice(index, 1);
        }
    }

    /**
     * Start MIDI clock output.
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.pulseCount = 0;
        this.startTime = performance.now();
        this._sendClockStart();
        this._startPulse();
    }

    /**
     * Stop MIDI clock output.
     */
    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        this._stopPulse();
        this._sendClockStop();
    }

    /**
     * Continue MIDI clock from current position.
     */
    continue() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._sendClockContinue();
        this._startPulse();
    }

    /**
     * Get current song position in beats.
     * @returns {number} Position in beats
     */
    getSongPosition() {
        return this.pulseCount / 24;
    }

    /**
     * Set song position pointer (SPP).
     * @param {number} beats - Position in beats
     */
    setSongPosition(beats) {
        this.pulseCount = Math.floor(beats * 24);
    }

    _startPulse() {
        const pulseIntervalMs = (60000 / this.bpm) / 24; // 24 PPQN
        this.pulseInterval = setInterval(() => {
            this._sendClockPulse();
            this.pulseCount++;
        }, pulseIntervalMs);
    }

    _stopPulse() {
        if (this.pulseInterval) {
            clearInterval(this.pulseInterval);
            this.pulseInterval = null;
        }
    }

    _restartClock() {
        this._stopPulse();
        if (this.isRunning) {
            this._startPulse();
        }
    }

    _sendClockPulse() {
        for (const output of this.outputs) {
            try {
                output.send([MIDI_STATUS.MIDI_CLOCK]);
            } catch (e) {
                console.warn('[MidiClock] Error sending clock pulse:', e);
            }
        }
    }

    _sendClockStart() {
        for (const output of this.outputs) {
            try {
                output.send([MIDI_STATUS.MIDI_START]);
            } catch (e) {
                console.warn('[MidiClock] Error sending start:', e);
            }
        }
    }

    _sendClockStop() {
        for (const output of this.outputs) {
            try {
                output.send([MIDI_STATUS.MIDI_STOP]);
            } catch (e) {
                console.warn('[MidiClock] Error sending stop:', e);
            }
        }
    }

    _sendClockContinue() {
        for (const output of this.outputs) {
            try {
                output.send([MIDI_STATUS.MIDI_CONTINUE]);
            } catch (e) {
                console.warn('[MidiClock] Error sending continue:', e);
            }
        }
    }

    /**
     * Send song position pointer.
     * @param {number} beats - Position in beats
     */
    sendSongPositionPointer(beats) {
        const spp = Math.floor(beats * 2); // SPP is in 16th notes
        const lsb = spp & 0x7F;
        const msb = (spp >> 7) & 0x7F;
        
        for (const output of this.outputs) {
            try {
                output.send([0xF2, lsb, msb]); // Song Position Pointer
            } catch (e) {
                console.warn('[MidiClock] Error sending SPP:', e);
            }
        }
    }
}

/**
 * MidiOutputPort - Represents a single MIDI output device.
 */
export class MidiOutputPort {
    constructor(port, manager) {
        this.port = port;
        this.manager = manager;
        this.id = port.id;
        this.name = port.name || `MIDI Output ${port.id.slice(-4)}`;
        this.manufacturer = port.manufacturer || 'Unknown';
        this.version = port.version || '';
        this.state = port.state;
        this.connection = port.connection;
        this.enabledForClock = false;
        this.enabledForOutput = true;
        this.channelMap = new Map(); // Track ID -> MIDI channel
        this.defaultChannel = 0; // 0-15 (displayed as 1-16)
        
        // Listen for port state changes
        port.onstatechange = () => {
            this.state = port.state;
            this.connection = port.connection;
            this.manager._onPortStateChange(this);
        };
    }

    /**
     * Open the port for output.
     */
    async open() {
        if (this.connection === 'open') return true;
        
        try {
            await this.port.open();
            this.connection = 'open';
            console.log(`[MidiOutputPort] Opened: ${this.name}`);
            return true;
        } catch (e) {
            console.error(`[MidiOutputPort] Error opening ${this.name}:`, e);
            return false;
        }
    }

    /**
     * Close the port.
     */
    async close() {
        if (this.connection === 'closed') return;
        
        try {
            await this.port.close();
            this.connection = 'closed';
            console.log(`[MidiOutputPort] Closed: ${this.name}`);
        } catch (e) {
            console.error(`[MidiOutputPort] Error closing ${this.name}:`, e);
        }
    }

    /**
     * Send raw MIDI bytes.
     * @param {number[]} message - Array of MIDI bytes
     */
    send(message) {
        if (!this.enabledForOutput || this.connection !== 'open') {
            return false;
        }
        
        try {
            this.port.send(message);
            return true;
        } catch (e) {
            console.error(`[MidiOutputPort] Error sending to ${this.name}:`, e);
            return false;
        }
    }

    /**
     * Send note on message.
     */
    noteOn(note, velocity = 127, channel = null) {
        const ch = channel !== null ? channel : this.defaultChannel;
        return this.send([MIDI_STATUS.NOTE_ON | (ch & 0x0F), note & 0x7F, velocity & 0x7F]);
    }

    /**
     * Send note off message.
     */
    noteOff(note, channel = null) {
        const ch = channel !== null ? channel : this.defaultChannel;
        return this.send([MIDI_STATUS.NOTE_OFF | (ch & 0x0F), note & 0x7F, 0]);
    }

    /**
     * Send control change message.
     */
    controlChange(cc, value, channel = null) {
        const ch = channel !== null ? channel : this.defaultChannel;
        return this.send([MIDI_STATUS.CONTROL_CHANGE | (ch & 0x0F), cc & 0x7F, value & 0x7F]);
    }

    /**
     * Send program change message.
     */
    programChange(program, channel = null) {
        const ch = channel !== null ? channel : this.defaultChannel;
        return this.send([MIDI_STATUS.PROGRAM_CHANGE | (ch & 0x0F), program & 0x7F]);
    }

    /**
     * Send pitch bend message.
     * @param {number} value - Pitch bend value (-8192 to 8191, 0 = center)
     */
    pitchBend(value, channel = null) {
        const ch = channel !== null ? channel : this.defaultChannel;
        const normalized = value + 8192; // Convert to 0-16383 range
        const lsb = normalized & 0x7F;
        const msb = (normalized >> 7) & 0x7F;
        return this.send([MIDI_STATUS.PITCH_BEND | (ch & 0x0F), lsb, msb]);
    }

    /**
     * Send channel aftertouch (pressure) message.
     */
    channelAftertouch(pressure, channel = null) {
        const ch = channel !== null ? channel : this.defaultChannel;
        return this.send([MIDI_STATUS.CHANNEL_PRESSURE | (ch & 0x0F), pressure & 0x7F]);
    }

    /**
     * Send polyphonic aftertouch message.
     */
    polyAftertouch(note, pressure, channel = null) {
        const ch = channel !== null ? channel : this.defaultChannel;
        return this.send([MIDI_STATUS.POLY_PRESSURE | (ch & 0x0F), note & 0x7F, pressure & 0x7F]);
    }

    /**
     * Send all notes off for a channel.
     */
    allNotesOff(channel = null) {
        return this.controlChange(MIDI_CC.ALL_NOTES_OFF, 0, channel);
    }

    /**
     * Send all sound off for a channel.
     */
    allSoundOff(channel = null) {
        return this.controlChange(MIDI_CC.ALL_SOUND_OFF, 0, channel);
    }

    /**
     * Reset all controllers for a channel.
     */
    resetAllControllers(channel = null) {
        return this.controlChange(MIDI_CC.RESET_ALL_CONTROLLERS, 0, channel);
    }

    /**
     * Send SysEx message.
     * @param {number[]} data - SysEx data (excluding F0 and F7)
     */
    sysex(data) {
        const message = [MIDI_STATUS.SYS_EX, ...data, 0xF7];
        return this.send(message);
    }

    /**
     * Set channel mapping for a track.
     */
    setTrackChannel(trackId, channel) {
        this.channelMap.set(trackId, channel);
    }

    /**
     * Get channel for a track.
     */
    getTrackChannel(trackId) {
        return this.channelMap.get(trackId) ?? this.defaultChannel;
    }

    /**
     * Serialize to JSON.
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            manufacturer: this.manufacturer,
            version: this.version,
            enabledForClock: this.enabledForClock,
            enabledForOutput: this.enabledForOutput,
            defaultChannel: this.defaultChannel,
            channelMap: Object.fromEntries(this.channelMap)
        };
    }
}

/**
 * MidiFileWriter - Writes Standard MIDI Files (SMF).
 */
export class MidiFileWriter {
    constructor() {
        this.format = 1; // Type 1: Multiple tracks
        this.ticksPerBeat = 480; // Default resolution
        this.tracks = [];
        this.bpm = 120;
    }

    /**
     * Set time division (ticks per beat).
     */
    setTicksPerBeat(ticks) {
        this.ticksPerBeat = ticks;
    }

    /**
     * Set tempo.
     */
    setTempo(bpm) {
        this.bpm = bpm;
    }

    /**
     * Create a new track.
     * @param {string} name - Track name
     * @returns {MidiTrack} The created track
     */
    createTrack(name = 'Track') {
        const track = new MidiTrack(this.ticksPerBeat, name);
        this.tracks.push(track);
        return track;
    }

    /**
     * Generate the MIDI file as a Uint8Array.
     * @returns {Uint8Array} MIDI file data
     */
    generate() {
        const bytes = [];
        
        // Header chunk
        bytes.push(...this._stringToBytes('MThd')); // Chunk ID
        bytes.push(0, 0, 0, 6); // Chunk length (always 6)
        bytes.push(...this._shortToBytes(this.format)); // Format type
        bytes.push(...this._shortToBytes(this.tracks.length)); // Number of tracks
        bytes.push(...this._shortToBytes(this.ticksPerBeat)); // Ticks per beat
        
        // Track chunks
        for (const track of this.tracks) {
            const trackBytes = track.generate();
            bytes.push(...trackBytes);
        }
        
        return new Uint8Array(bytes);
    }

    /**
     * Generate MIDI file and create a download URL.
     * @returns {string} Object URL for download
     */
    generateURL() {
        const data = this.generate();
        const blob = new Blob([data], { type: 'audio/midi' });
        return URL.createObjectURL(blob);
    }

    /**
     * Download the MIDI file.
     * @param {string} filename - File name for download
     */
    download(filename = 'output.mid') {
        const url = this.generateURL();
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    _stringToBytes(str) {
        return str.split('').map(c => c.charCodeAt(0));
    }

    _shortToBytes(value) {
        return [(value >> 8) & 0xFF, value & 0xFF];
    }

    _intToBytes(value) {
        return [(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
    }
}

/**
 * MidiTrack - Represents a single track in a MIDI file.
 */
export class MidiTrack {
    constructor(ticksPerBeat, name = 'Track') {
        this.ticksPerBeat = ticksPerBeat;
        this.name = name;
        this.channel = 0;
        this.events = [];
        this.lastTick = 0;
    }

    /**
     * Set channel for this track.
     */
    setChannel(channel) {
        this.channel = channel;
    }

    /**
     * Add a MIDI event.
     * @param {number} tick - Absolute tick position
     * @param {string} type - Event type
     * @param {Object} data - Event data
     */
    addEvent(tick, type, data) {
        this.events.push({ tick, type, data });
        this.events.sort((a, b) => a.tick - b.tick);
        if (tick > this.lastTick) {
            this.lastTick = tick;
        }
    }

    /**
     * Add note on event.
     */
    noteOn(tick, note, velocity = 100, channel = null) {
        this.addEvent(tick, 'noteOn', { note, velocity, channel: channel ?? this.channel });
    }

    /**
     * Add note off event.
     */
    noteOff(tick, note, channel = null) {
        this.addEvent(tick, 'noteOff', { note, velocity: 0, channel: channel ?? this.channel });
    }

    /**
     * Add a note with duration.
     */
    addNote(startTick, note, duration, velocity = 100, channel = null) {
        const ch = channel ?? this.channel;
        this.noteOn(startTick, note, velocity, ch);
        this.noteOff(startTick + duration, note, ch);
    }

    /**
     * Add control change event.
     */
    controlChange(tick, cc, value, channel = null) {
        this.addEvent(tick, 'controlChange', { cc, value, channel: channel ?? this.channel });
    }

    /**
     * Add program change event.
     */
    programChange(tick, program, channel = null) {
        this.addEvent(tick, 'programChange', { program, channel: channel ?? this.channel });
    }

    /**
     * Add pitch bend event.
     */
    pitchBend(tick, value, channel = null) {
        this.addEvent(tick, 'pitchBend', { value, channel: channel ?? this.channel });
    }

    /**
     * Add tempo change event (tempo track only).
     */
    tempo(tick, bpm) {
        this.addEvent(tick, 'tempo', { bpm });
    }

    /**
     * Add time signature event (tempo track only).
     */
    timeSignature(tick, numerator, denominator) {
        this.addEvent(tick, 'timeSignature', { numerator, denominator });
    }

    /**
     * Add track name meta event.
     */
    trackName(name) {
        this.addEvent(0, 'trackName', { name });
    }

    /**
     * Generate track bytes.
     * @returns {number[]} Track bytes
     */
    generate() {
        const bytes = [];
        const eventData = [];
        let lastTick = 0;
        let runningStatus = 0;

        // Convert events to bytes with delta times
        for (const event of this.events) {
            const delta = event.tick - lastTick;
            lastTick = event.tick;

            const deltaBytes = this._variableLengthEncode(delta);
            const eventBytes = this._eventToBytes(event, runningStatus);
            
            if (eventBytes.length > 0) {
                if (eventBytes[0] === runningStatus && eventBytes.length > 1) {
                    // Use running status - omit status byte
                    eventData.push(...deltaBytes, ...eventBytes.slice(1));
                } else {
                    eventData.push(...deltaBytes, ...eventBytes);
                    runningStatus = eventBytes[0];
                }
            }
        }

        // End of track
        eventData.push(0, 0xFF, 0x2F, 0x00);

        // Track chunk
        bytes.push(...this._stringToBytes('MTrk')); // Chunk ID
        bytes.push(...this._intToBytes(eventData.length)); // Chunk length
        bytes.push(...eventData);

        return bytes;
    }

    _eventToBytes(event, runningStatus) {
        const bytes = [];
        const channel = event.data.channel ?? 0;

        switch (event.type) {
            case 'noteOn':
                bytes.push(MIDI_STATUS.NOTE_ON | (channel & 0x0F));
                bytes.push(event.data.note & 0x7F);
                bytes.push(event.data.velocity & 0x7F);
                break;
            case 'noteOff':
                bytes.push(MIDI_STATUS.NOTE_OFF | (channel & 0x0F));
                bytes.push(event.data.note & 0x7F);
                bytes.push(0);
                break;
            case 'controlChange':
                bytes.push(MIDI_STATUS.CONTROL_CHANGE | (channel & 0x0F));
                bytes.push(event.data.cc & 0x7F);
                bytes.push(event.data.value & 0x7F);
                break;
            case 'programChange':
                bytes.push(MIDI_STATUS.PROGRAM_CHANGE | (channel & 0x0F));
                bytes.push(event.data.program & 0x7F);
                break;
            case 'pitchBend':
                const normalized = event.data.value + 8192;
                bytes.push(MIDI_STATUS.PITCH_BEND | (channel & 0x0F));
                bytes.push(normalized & 0x7F);
                bytes.push((normalized >> 7) & 0x7F);
                break;
            case 'tempo':
                bytes.push(0xFF, 0x51, 0x03);
                const microsecondsPerBeat = Math.round(60000000 / event.data.bpm);
                bytes.push((microsecondsPerBeat >> 16) & 0xFF);
                bytes.push((microsecondsPerBeat >> 8) & 0xFF);
                bytes.push(microsecondsPerBeat & 0xFF);
                break;
            case 'timeSignature':
                bytes.push(0xFF, 0x58, 0x04);
                bytes.push(event.data.numerator);
                bytes.push(Math.log2(event.data.denominator));
                bytes.push(24); // MIDI clocks per metronome click
                bytes.push(8); // 32nd notes per beat
                break;
            case 'trackName':
                const nameBytes = this._stringToBytes(event.data.name);
                bytes.push(0xFF, 0x03, nameBytes.length, ...nameBytes);
                break;
            default:
                console.warn('[MidiTrack] Unknown event type:', event.type);
        }

        return bytes;
    }

    _variableLengthEncode(value) {
        const bytes = [];
        bytes.push(value & 0x7F);
        value >>= 7;
        while (value > 0) {
            bytes.unshift((value & 0x7F) | 0x80);
            value >>= 7;
        }
        return bytes;
    }

    _stringToBytes(str) {
        return str.split('').map(c => c.charCodeAt(0));
    }

    _intToBytes(value) {
        return [(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];
    }
}

/**
 * MidiOutputManager - Main manager for MIDI output functionality.
 */
export class MidiOutputManager {
    constructor() {
        this.midiAccess = null;
        this.ports = new Map(); // id -> MidiOutputPort
        this.clock = new MidiClock();
        this.thruEnabled = false;
        this.thruPorts = new Set(); // Ports to forward thru to
        this.initialized = false;
        
        // Callbacks
        this.onPortsChanged = null;
        this.onError = null;
    }

    /**
     * Initialize MIDI output system.
     * @returns {Promise<boolean>} Success
     */
    async initialize() {
        if (this.initialized) return true;

        if (!navigator.requestMIDIAccess) {
            console.warn('[MidiOutputManager] Web MIDI API not available');
            return false;
        }

        try {
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
            this.initialized = true;
            
            // Scan existing outputs
            this._scanOutputs();
            
            // Listen for port changes
            this.midiAccess.onstatechange = (event) => {
                this._handleStateChange(event);
            };
            
            console.log('[MidiOutputManager] Initialized');
            return true;
        } catch (e) {
            console.error('[MidiOutputManager] Error initializing:', e);
            if (this.onError) this.onError(e);
            return false;
        }
    }

    /**
     * Get list of available output ports.
     * @returns {Array<MidiOutputPort>} Available ports
     */
    getPorts() {
        return Array.from(this.ports.values());
    }

    /**
     * Get port by ID.
     * @param {string} portId - Port ID
     * @returns {MidiOutputPort|null} Port or null
     */
    getPort(portId) {
        return this.ports.get(portId) || null;
    }

    /**
     * Enable a port for clock output.
     * @param {string} portId - Port ID
     * @param {boolean} enabled - Enable state
     */
    setClockPort(portId, enabled) {
        const port = this.ports.get(portId);
        if (!port) return;
        
        port.enabledForClock = enabled;
        if (enabled) {
            this.clock.addOutput(port.port);
        } else {
            this.clock.removeOutput(port.port);
        }
    }

    /**
     * Enable thru mode for a port.
     * @param {string} portId - Port ID
     * @param {boolean} enabled - Enable state
     */
    setThruPort(portId, enabled) {
        const port = this.ports.get(portId);
        if (!port) return;
        
        if (enabled) {
            this.thruPorts.add(portId);
        } else {
            this.thruPorts.delete(portId);
        }
    }

    /**
     * Handle incoming MIDI message for thru forwarding.
     * @param {MIDIMessageEvent} event - MIDI input event
     */
    handleThru(event) {
        if (!this.thruEnabled) return;
        
        for (const portId of this.thruPorts) {
            const port = this.ports.get(portId);
            if (port && port.enabledForOutput) {
                try {
                    port.send(Array.from(event.data));
                } catch (e) {
                    console.warn('[MidiOutputManager] Thru error:', e);
                }
            }
        }
    }

    /**
     * Send note to all enabled ports.
     */
    broadcastNoteOn(note, velocity = 127, channel = 0) {
        for (const port of this.ports.values()) {
            if (port.enabledForOutput) {
                port.noteOn(note, velocity, channel);
            }
        }
    }

    /**
     * Send note off to all enabled ports.
     */
    broadcastNoteOff(note, channel = 0) {
        for (const port of this.ports.values()) {
            if (port.enabledForOutput) {
                port.noteOff(note, channel);
            }
        }
    }

    /**
     * Create MIDI file from sequence data.
     * @param {Object} project - Project data with tracks and sequences
     * @param {Object} options - Export options
     * @returns {MidiFileWriter} MidiFileWriter instance
     */
    createMidiFile(project, options = {}) {
        const writer = new MidiFileWriter();
        writer.setTicksPerBeat(options.ticksPerBeat || 480);
        writer.setTempo(project.tempo || 120);

        // Create tempo track
        const tempoTrack = writer.createTrack('Tempo');
        tempoTrack.tempo(0, project.tempo || 120);
        tempoTrack.timeSignature(0, project.timeSignatureNumerator || 4, project.timeSignatureDenominator || 4);

        // Create tracks from project data
        if (project.tracks) {
            for (const track of project.tracks) {
                if (track.type === 'Audio') continue;
                
                const midiTrack = writer.createTrack(track.name);
                midiTrack.setChannel(track.midiChannel || 0);
                midiTrack.trackName(track.name);

                const sequence = track.activeSequence || track.sequences?.[0];
                if (sequence && sequence.data) {
                    const ticksPerStep = writer.ticksPerBeat / 4; // 16th notes
                    
                    for (let rowIndex = 0; rowIndex < sequence.data.length; rowIndex++) {
                        for (let stepIndex = 0; stepIndex < sequence.data[rowIndex].length; stepIndex++) {
                            const step = sequence.data[rowIndex][stepIndex];
                            if (step && step.active) {
                                // Calculate note number based on row (assuming middle C = 60)
                                const note = 60 + (Math.floor(sequence.data.length / 2) - rowIndex);
                                const startTick = stepIndex * ticksPerStep;
                                const duration = (step.duration || 1) * ticksPerStep;
                                const velocity = Math.round((step.velocity || 0.8) * 127);
                                
                                midiTrack.addNote(startTick, note, duration, velocity);
                            }
                        }
                    }
                }
            }
        }

        return writer;
    }

    /**
     * Export project to MIDI file.
     * @param {Object} project - Project data
     * @param {string} filename - File name
     */
    exportToMidi(project, filename = 'project.mid') {
        const writer = this.createMidiFile(project);
        writer.download(filename);
    }

    _scanOutputs() {
        if (!this.midiAccess) return;
        
        for (const [id, output] of this.midiAccess.outputs) {
            if (!this.ports.has(id)) {
                const port = new MidiOutputPort(output, this);
                this.ports.set(id, port);
            }
        }
    }

    _handleStateChange(event) {
        const port = event.port;
        
        if (port.type === 'output') {
            if (port.state === 'connected') {
                if (!this.ports.has(port.id)) {
                    const newPort = new MidiOutputPort(port, this);
                    this.ports.set(port.id, newPort);
                    console.log(`[MidiOutputManager] Port connected: ${newPort.name}`);
                }
            } else if (port.state === 'disconnected') {
                const existingPort = this.ports.get(port.id);
                if (existingPort) {
                    this.clock.removeOutput(existingPort.port);
                    this.thruPorts.delete(port.id);
                    this.ports.delete(port.id);
                    console.log(`[MidiOutputManager] Port disconnected: ${existingPort.name}`);
                }
            }
            
            if (this.onPortsChanged) {
                this.onPortsChanged(this.getPorts());
            }
        }
    }

    _onPortStateChange(port) {
        if (this.onPortsChanged) {
            this.onPortsChanged(this.getPorts());
        }
    }

    /**
     * Serialize state for persistence.
     */
    toJSON() {
        return {
            ports: this.getPorts().map(p => p.toJSON()),
            thruEnabled: this.thruEnabled,
            thruPorts: Array.from(this.thruPorts)
        };
    }

    /**
     * Restore state from saved data.
     */
    fromJSON(data) {
        if (data.thruEnabled !== undefined) {
            this.thruEnabled = data.thruEnabled;
        }
        if (data.thruPorts) {
            this.thruPorts = new Set(data.thruPorts);
        }
        // Port settings are restored when ports are connected
    }
}

// Singleton instance
let managerInstance = null;

/**
 * Get the singleton MidiOutputManager instance.
 */
export function getMidiOutputManager() {
    if (!managerInstance) {
        managerInstance = new MidiOutputManager();
    }
    return managerInstance;
}

// Export constants
export { MIDI_STATUS, MIDI_CC };