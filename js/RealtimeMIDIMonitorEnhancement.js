/**
 * Real-time MIDI Monitor Enhancement - MIDI message filtering
 * Enhanced MIDI monitor with advanced filtering and analysis
 */

// Enhanced MIDI Monitor State
const midiMonitorEnhanceState = {
    // Connection state
    isConnected: false,
    midiAccess: null,
    activeInput: null,
    activeOutput: null,
    
    // Monitoring state
    isMonitoring: false,
    isPaused: false,
    
    // Message log
    messageLog: [],
    maxLogSize: 500,
    
    // Filter settings
    filters: {
        // Message type filters
        noteOn: { enabled: true, pass: true },
        noteOff: { enabled: true, pass: true },
        polyPressure: { enabled: true, pass: true },
        controlChange: { enabled: true, pass: true },
        programChange: { enabled: true, pass: true },
        channelPressure: { enabled: true, pass: true },
        pitchBend: { enabled: true, pass: true },
        systemMessage: { enabled: true, pass: true },
        sysEx: { enabled: false, pass: true },
        
        // Channel filters (1-16)
        channels: Array(16).fill(true), // true = pass
        
        // Note filters
        noteRange: { min: 0, max: 127, enabled: false },
        noteList: { include: [], exclude: [], mode: 'all' },
        
        // Velocity filters
        velocityRange: { min: 1, max: 127, enabled: false },
        
        // CC filters
        ccRange: { min: 0, max: 127, enabled: false },
        ccList: { include: [], exclude: [], mode: 'all' },
        
        // Value filters
        valueRange: { min: 0, max: 127, enabled: false }
    },
    
    // Transform settings
    transforms: {
        // Channel remapping
        channelMap: {}, // originalChannel -> newChannel
        
        // Note transposition
        transpose: 0,
        
        // Velocity scaling
        velocityScale: 1.0,
        velocityOffset: 0,
        
        // CC remapping
        ccMap: {}, // originalCC -> newCC
        
        // Value scaling
        valueScale: 1.0,
        valueOffset: 0,
        
        // Pass-through or transform
        transformEnabled: false
    },
    
    // Statistics
    statistics: {
        totalMessages: 0,
        passedMessages: 0,
        blockedMessages: 0,
        messagesPerSecond: 0,
        averageLatency: 0,
        
        // Per-type counts
        noteOnCount: 0,
        noteOffCount: 0,
        ccCount: 0,
        pitchBendCount: 0,
        
        // Per-channel counts
        channelCounts: Array(16).fill(0),
        
        // Note distribution
        noteDistribution: Array(128).fill(0),
        
        // Velocity distribution
        velocityDistribution: Array(128).fill(0),
        
        // CC distribution
        ccDistribution: Array(128).fill(0),
        
        // Session timing
        startTime: null,
        lastMessageTime: null
    },
    
    // Display settings
    displayMode: 'named', // named, hex, decimal, binary
    showTimestamps: true,
    showChannel: true,
    showVelocity: true,
    showValue: true,
    compactMode: false,
    
    // Analysis settings
    chordDetection: true,
    chordHistory: [],
    lastChord: null,
    
    // Throttle settings
    throttleEnabled: false,
    throttleMs: 5,
    lastProcessTime: 0,
    
    // Callbacks
    onMessage: null,
    onFilter: null,
    onTransform: null,
    onChordDetected: null
};

/**
 * Initialize MIDI access
 */
async function initEnhancedMIDIMonitor() {
    try {
        midiMonitorEnhanceState.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
        midiMonitorEnhanceState.isConnected = true;
        
        console.log('[MIDIMonitorEnhancement] MIDI access initialized');
        
        return { success: true, inputs: getAvailableInputs(), outputs: getAvailableOutputs() };
    } catch (error) {
        console.error('[MIDIMonitorEnhancement] Failed to get MIDI access:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get available MIDI inputs
 */
function getAvailableInputs() {
    if (!midiMonitorEnhanceState.midiAccess) return [];
    
    const inputs = [];
    for (const input of midiMonitorEnhanceState.midiAccess.inputs.values()) {
        inputs.push({
            id: input.id,
            name: input.name || input.id,
            manufacturer: input.manufacturer || 'Unknown',
            state: input.state,
            connection: input.connection
        });
    }
    return inputs;
}

/**
 * Get available MIDI outputs
 */
function getAvailableOutputs() {
    if (!midiMonitorEnhanceState.midiAccess) return [];
    
    const outputs = [];
    for (const output of midiMonitorEnhanceState.midiAccess.outputs.values()) {
        outputs.push({
            id: output.id,
            name: output.name || output.id,
            manufacturer: output.manufacturer || 'Unknown',
            state: output.state,
            connection: output.connection
        });
    }
    return outputs;
}

/**
 * Connect to MIDI input
 */
function connectMIDIInput(inputId) {
    if (!midiMonitorEnhanceState.midiAccess) {
        return { success: false, error: 'MIDI not initialized' };
    }
    
    const input = midiMonitorEnhanceState.midiAccess.inputs.get(inputId);
    if (!input) {
        return { success: false, error: 'Input not found' };
    }
    
    // Disconnect previous input
    if (midiMonitorEnhanceState.activeInput) {
        midiMonitorEnhanceState.activeInput.onmidimessage = null;
    }
    
    // Connect new input
    input.onmidimessage = handleMIDIMessage;
    midiMonitorEnhanceState.activeInput = input;
    
    console.log(`[MIDIMonitorEnhancement] Connected to input: ${input.name}`);
    
    return { success: true, input: { id: input.id, name: input.name } };
}

/**
 * Connect to MIDI output
 */
function connectMIDIOutput(outputId) {
    if (!midiMonitorEnhanceState.midiAccess) {
        return { success: false, error: 'MIDI not initialized' };
    }
    
    const output = midiMonitorEnhanceState.midiAccess.outputs.get(outputId);
    if (!output) {
        return { success: false, error: 'Output not found' };
    }
    
    midiMonitorEnhanceState.activeOutput = output;
    
    console.log(`[MIDIMonitorEnhancement] Connected to output: ${output.name}`);
    
    return { success: true, output: { id: output.id, name: output.name } };
}

/**
 * Handle incoming MIDI message
 */
function handleMIDIMessage(event) {
    if (!midiMonitorEnhanceState.isMonitoring || midiMonitorEnhanceState.isPaused) {
        return;
    }
    
    // Throttle if enabled
    if (midiMonitorEnhanceState.throttleEnabled) {
        const now = Date.now();
        if (now - midiMonitorEnhanceState.lastProcessTime < midiMonitorEnhanceState.throttleMs) {
            return;
        }
        midiMonitorEnhanceState.lastProcessTime = now;
    }
    
    const message = parseMIDIMessage(event.data, event.timeStamp);
    
    // Apply filters
    if (!shouldPassMessage(message)) {
        midiMonitorEnhanceState.statistics.blockedMessages++;
        if (midiMonitorEnhanceState.onFilter) {
            midiMonitorEnhanceState.onFilter(message, false);
        }
        return;
    }
    
    // Apply transforms if enabled
    let processedMessage = message;
    if (midiMonitorEnhanceState.transforms.transformEnabled) {
        processedMessage = transformMIDIMessage(message);
        if (midiMonitorEnhanceState.onTransform) {
            midiMonitorEnhanceState.onTransform(message, processedMessage);
        }
    }
    
    // Update statistics
    updateMessageStatistics(processedMessage);
    
    // Add to log
    addToMessageLog(processedMessage);
    
    // Detect chords
    if (midiMonitorEnhanceState.chordDetection && processedMessage.type === 'noteOn') {
        detectChord(processedMessage);
    }
    
    // Forward to output if connected
    if (midiMonitorEnhanceState.activeOutput) {
        sendMIDIOutput(processedMessage);
    }
    
    // Callback
    if (midiMonitorEnhanceState.onMessage) {
        midiMonitorEnhanceState.onMessage(processedMessage);
    }
    
    midiMonitorEnhanceState.statistics.passedMessages++;
}

/**
 * Parse MIDI message bytes
 */
function parseMIDIMessage(data, timestamp) {
    const status = data[0];
    const channel = (status & 0x0F) + 1;
    const messageType = (status & 0xF0);
    
    let type, note, velocity, cc, value, program, pressure;
    
    switch (messageType) {
        case 0x80: // Note Off
            type = 'noteOff';
            note = data[1];
            velocity = data[2];
            break;
        case 0x90: // Note On
            type = velocity = data[2] > 0 ? 'noteOn' : 'noteOff';
            note = data[1];
            velocity = data[2];
            break;
        case 0xA0: // Polyphonic Pressure
            type = 'polyPressure';
            note = data[1];
            pressure = data[2];
            break;
        case 0xB0: // Control Change
            type = 'controlChange';
            cc = data[1];
            value = data[2];
            break;
        case 0xC0: // Program Change
            type = 'programChange';
            program = data[1];
            break;
        case 0xD0: // Channel Pressure
            type = 'channelPressure';
            pressure = data[1];
            break;
        case 0xE0: // Pitch Bend
            type = 'pitchBend';
            value = (data[2] << 7) | data[1];
            break;
        case 0xF0: // System Message
            type = 'systemMessage';
            break;
        default:
            type = 'unknown';
    }
    
    return {
        raw: Array.from(data),
        status,
        channel,
        type,
        note,
        velocity,
        cc,
        value,
        program,
        pressure,
        noteName: note !== undefined ? getNoteName(note) : undefined,
        ccName: cc !== undefined ? getCCName(cc) : undefined,
        timestamp,
        receivedAt: Date.now()
    };
}

/**
 * Get note name from MIDI note number
 */
function getNoteName(note) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(note / 12) - 1;
    const name = names[note % 12];
    return `${name}${octave}`;
}

/**
 * Get CC name from CC number
 */
function getCCName(cc) {
    const ccNames = {
        0: 'Bank Select MSB',
        1: 'Modulation',
        2: 'Breath Controller',
        4: 'Foot Controller',
        5: 'Portamento Time',
        6: 'Data Entry MSB',
        7: 'Volume',
        8: 'Balance',
        10: 'Pan',
        11: 'Expression',
        12: 'Effect Controller 1',
        13: 'Effect Controller 2',
        32: 'Bank Select LSB',
        64: 'Sustain Pedal',
        65: 'Portamento',
        66: 'Sostenuto',
        67: 'Soft Pedal',
        68: 'Legato',
        69: 'Hold 2',
        74: 'Filter Cutoff',
        75: 'Filter Resonance',
        76: 'Filter Envelope Amount',
        77: 'Filter Release',
        78: 'Vibrato Depth',
        84: 'Portamento Control',
        91: 'Reverb Depth',
        92: 'Tremolo Depth',
        93: 'Chorus Depth',
        94: 'Detune Depth',
        95: 'Phaser Depth',
        96: 'Data Increment',
        97: 'Data Decrement',
        98: 'NRPN LSB',
        99: 'NRPN MSB',
        100: 'RPN LSB',
        101: 'RPN MSB',
        120: 'All Sound Off',
        121: 'Reset Controllers',
        122: 'Local Control',
        123: 'All Notes Off',
        124: 'Omni Off',
        125: 'Omni On',
        126: 'Mono Mode',
        127: 'Poly Mode'
    };
    
    return ccNames[cc] || `CC ${cc}`;
}

/**
 * Check if message should pass filters
 */
function shouldPassMessage(message) {
    const filters = midiMonitorEnhanceState.filters;
    
    // Check message type filter
    const typeFilter = filters[message.type];
    if (typeFilter && typeFilter.enabled && !typeFilter.pass) {
        return false;
    }
    
    // Check channel filter
    if (message.channel >= 1 && message.channel <= 16) {
        if (!filters.channels[message.channel - 1]) {
            return false;
        }
    }
    
    // Check note range filter
    if (message.note !== undefined && filters.noteRange.enabled) {
        if (message.note < filters.noteRange.min || message.note > filters.noteRange.max) {
            return false;
        }
    }
    
    // Check note list filter
    if (message.note !== undefined && filters.noteList.mode !== 'all') {
        const inInclude = filters.noteList.include.includes(message.note);
        const inExclude = filters.noteList.exclude.includes(message.note);
        
        if (filters.noteList.mode === 'include' && !inInclude) return false;
        if (filters.noteList.mode === 'exclude' && inExclude) return false;
    }
    
    // Check velocity range filter
    if (message.velocity !== undefined && filters.velocityRange.enabled) {
        if (message.velocity < filters.velocityRange.min || 
            message.velocity > filters.velocityRange.max) {
            return false;
        }
    }
    
    // Check CC range filter
    if (message.cc !== undefined && filters.ccRange.enabled) {
        if (message.cc < filters.ccRange.min || 
            message.cc > filters.ccRange.max) {
            return false;
        }
    }
    
    // Check CC list filter
    if (message.cc !== undefined && filters.ccList.mode !== 'all') {
        const inInclude = filters.ccList.include.includes(message.cc);
        const inExclude = filters.ccList.exclude.includes(message.cc);
        
        if (filters.ccList.mode === 'include' && !inInclude) return false;
        if (filters.ccList.mode === 'exclude' && inExclude) return false;
    }
    
    // Check value range filter
    if (message.value !== undefined && filters.valueRange.enabled) {
        if (message.value < filters.valueRange.min || 
            message.value > filters.valueRange.max) {
            return false;
        }
    }
    
    return true;
}

/**
 * Transform MIDI message
 */
function transformMIDIMessage(message) {
    const transforms = midiMonitorEnhanceState.transforms;
    const transformed = { ...message };
    
    // Channel remapping
    if (transforms.channelMap[message.channel]) {
        transformed.channel = transforms.channelMap[message.channel];
        transformed.status = (message.status & 0xF0) | (transformed.channel - 1);
    }
    
    // Note transposition
    if (message.note !== undefined && transforms.transpose !== 0) {
        transformed.note = Math.max(0, Math.min(127, message.note + transforms.transpose));
        transformed.noteName = getNoteName(transformed.note);
    }
    
    // Velocity scaling
    if (message.velocity !== undefined) {
        transformed.velocity = Math.max(1, Math.min(127, 
            Math.round(message.velocity * transforms.velocityScale + transforms.velocityOffset)
        ));
    }
    
    // CC remapping
    if (message.cc !== undefined && transforms.ccMap[message.cc]) {
        transformed.cc = transforms.ccMap[message.cc];
        transformed.ccName = getCCName(transformed.cc);
    }
    
    // Value scaling
    if (message.value !== undefined) {
        transformed.value = Math.max(0, Math.min(127,
            Math.round(message.value * transforms.valueScale + transforms.valueOffset)
        ));
    }
    
    // Rebuild raw data
    transformed.raw = rebuildRawData(transformed);
    
    return transformed;
}

/**
 * Rebuild raw MIDI data from parsed message
 */
function rebuildRawData(message) {
    const data = [message.status];
    
    switch (message.type) {
        case 'noteOn':
        case 'noteOff':
            data.push(message.note, message.velocity);
            break;
        case 'controlChange':
            data.push(message.cc, message.value);
            break;
        case 'programChange':
            data.push(message.program);
            break;
        case 'channelPressure':
            data.push(message.pressure);
            break;
        case 'pitchBend':
            data.push(message.value & 0x7F, (message.value >> 7) & 0x7F);
            break;
        case 'polyPressure':
            data.push(message.note, message.pressure);
            break;
    }
    
    return data;
}

/**
 * Update message statistics
 */
function updateMessageStatistics(message) {
    const stats = midiMonitorEnhanceState.statistics;
    
    stats.totalMessages++;
    
    // Per-type counts
    if (message.type === 'noteOn') stats.noteOnCount++;
    if (message.type === 'noteOff') stats.noteOffCount++;
    if (message.type === 'controlChange') stats.ccCount++;
    if (message.type === 'pitchBend') stats.pitchBendCount++;
    
    // Per-channel counts
    if (message.channel >= 1 && message.channel <= 16) {
        stats.channelCounts[message.channel - 1]++;
    }
    
    // Note distribution
    if (message.note !== undefined) {
        stats.noteDistribution[message.note]++;
    }
    
    // Velocity distribution
    if (message.velocity !== undefined) {
        stats.velocityDistribution[message.velocity]++;
    }
    
    // CC distribution
    if (message.cc !== undefined) {
        stats.ccDistribution[message.cc]++;
    }
    
    // Messages per second
    if (stats.startTime) {
        const elapsed = (Date.now() - stats.startTime) / 1000;
        stats.messagesPerSecond = stats.passedMessages / elapsed;
    }
}

/**
 * Add message to log
 */
function addToMessageLog(message) {
    midiMonitorEnhanceState.messageLog.push(message);
    
    // Trim log if needed
    if (midiMonitorEnhanceState.messageLog.length > midiMonitorEnhanceState.maxLogSize) {
        midiMonitorEnhanceState.messageLog.shift();
    }
}

/**
 * Detect chord from note
 */
function detectChord(message) {
    // Get recent notes
    const recentNotes = midiMonitorEnhanceState.messageLog
        .filter(m => m.type === 'noteOn' && 
                     m.receivedAt > Date.now() - 100) // Within 100ms
        .map(m => m.note);
    
    if (recentNotes.length >= 3) {
        const chord = identifyChord(recentNotes);
        if (chord && chord !== midiMonitorEnhanceState.lastChord) {
            midiMonitorEnhanceState.lastChord = chord;
            midiMonitorEnhanceState.chordHistory.push({
                chord,
                notes: recentNotes,
                timestamp: Date.now()
            });
            
            if (midiMonitorEnhanceState.onChordDetected) {
                midiMonitorEnhanceState.onChordDetected(chord, recentNotes);
            }
        }
    }
}

/**
 * Identify chord from notes
 */
function identifyChord(notes) {
    if (notes.length < 3) return null;
    
    const sorted = [...new Set(notes)].sort((a, b) => a - b);
    const root = sorted[0];
    
    // Calculate intervals from root
    const intervals = sorted.map(n => (n - root) % 12);
    
    // Common chord patterns
    const chordPatterns = {
        'Major': [0, 4, 7],
        'Minor': [0, 3, 7],
        'Dim': [0, 3, 6],
        'Aug': [0, 4, 8],
        'Maj7': [0, 4, 7, 11],
        'Min7': [0, 3, 7, 10],
        'Dom7': [0, 4, 7, 10],
        'Dim7': [0, 3, 6, 9],
        'Sus4': [0, 5, 7],
        'Sus2': [0, 2, 7]
    };
    
    for (const [name, pattern] of Object.entries(chordPatterns)) {
        if (arraysEqual(intervals.sort(), pattern.sort())) {
            return `${getNoteName(root)} ${name}`;
        }
    }
    
    return null;
}

/**
 * Check arrays equal
 */
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
}

/**
 * Send message to output
 */
function sendMIDIOutput(message) {
    if (!midiMonitorEnhanceState.activeOutput) return;
    
    midiMonitorEnhanceState.activeOutput.send(message.raw);
}

/**
 * Start monitoring
 */
function startMIDIMonitoring() {
    if (!midiMonitorEnhanceState.isConnected) {
        return { success: false, error: 'MIDI not initialized' };
    }
    
    midiMonitorEnhanceState.isMonitoring = true;
    midiMonitorEnhanceState.isPaused = false;
    midiMonitorEnhanceState.statistics.startTime = Date.now();
    
    return { success: true };
}

/**
 * Stop monitoring
 */
function stopMIDIMonitoring() {
    midiMonitorEnhanceState.isMonitoring = false;
    return { success: true };
}

/**
 * Pause monitoring
 */
function pauseMIDIMonitoring() {
    midiMonitorEnhanceState.isPaused = true;
    return { success: true };
}

/**
 * Resume monitoring
 */
function resumeMIDIMonitoring() {
    midiMonitorEnhanceState.isPaused = false;
    return { success: true };
}

/**
 * Clear message log
 */
function clearMIDIMessageLog() {
    midiMonitorEnhanceState.messageLog = [];
    return { success: true };
}

/**
 * Reset statistics
 */
function resetMIDIStatistics() {
    midiMonitorEnhanceState.statistics = {
        totalMessages: 0,
        passedMessages: 0,
        blockedMessages: 0,
        messagesPerSecond: 0,
        averageLatency: 0,
        noteOnCount: 0,
        noteOffCount: 0,
        ccCount: 0,
        pitchBendCount: 0,
        channelCounts: Array(16).fill(0),
        noteDistribution: Array(128).fill(0),
        velocityDistribution: Array(128).fill(0),
        ccDistribution: Array(128).fill(0),
        startTime: null,
        lastMessageTime: null
    };
    
    return { success: true };
}

/**
 * Export message log
 */
function exportMIDIMessageLog() {
    return JSON.stringify({
        log: midiMonitorEnhanceState.messageLog,
        statistics: midiMonitorEnhanceState.statistics,
        exportedAt: Date.now()
    }, null, 2);
}

/**
 * Set message type filter
 */
function setMessageTypeFilter(type, enabled, pass = true) {
    if (midiMonitorEnhanceState.filters[type]) {
        midiMonitorEnhanceState.filters[type].enabled = enabled;
        midiMonitorEnhanceState.filters[type].pass = pass;
        return { success: true };
    }
    return { success: false, error: 'Unknown message type' };
}

/**
 * Set channel filter
 */
function setChannelFilter(channel, pass) {
    if (channel >= 1 && channel <= 16) {
        midiMonitorEnhanceState.filters.channels[channel - 1] = pass;
        return { success: true };
    }
    return { success: false, error: 'Invalid channel' };
}

/**
 * Get message log
 */
function getMIDIMessageLog() {
    return midiMonitorEnhanceState.messageLog;
}

/**
 * Get statistics
 */
function getMIDIStatistics() {
    return midiMonitorEnhanceState.statistics;
}

/**
 * Get filter settings
 */
function getMIDIFilters() {
    return midiMonitorEnhanceState.filters;
}

/**
 * Get transform settings
 */
function getMIDITransforms() {
    return midiMonitorEnhanceState.transforms;
}

/**
 * Set transform setting
 */
function setMIDITransform(key, value) {
    if (key in midiMonitorEnhanceState.transforms) {
        midiMonitorEnhanceState.transforms[key] = value;
        return { success: true };
    }
    return { success: false, error: 'Unknown transform' };
}

// Export functions
window.initEnhancedMIDIMonitor = initEnhancedMIDIMonitor;
window.getAvailableInputs = getAvailableInputs;
window.getAvailableOutputs = getAvailableOutputs;
window.connectMIDIInput = connectMIDIInput;
window.connectMIDIOutput = connectMIDIOutput;
window.startMIDIMonitoring = startMIDIMonitoring;
window.stopMIDIMonitoring = stopMIDIMonitoring;
window.pauseMIDIMonitoring = pauseMIDIMonitoring;
window.resumeMIDIMonitoring = resumeMIDIMonitoring;
window.clearMIDIMessageLog = clearMIDIMessageLog;
window.resetMIDIStatistics = resetMIDIStatistics;
window.exportMIDIMessageLog = exportMIDIMessageLog;
window.setMessageTypeFilter = setMessageTypeFilter;
window.setChannelFilter = setChannelFilter;
window.getMIDIMessageLog = getMIDIMessageLog;
window.getMIDIStatistics = getMIDIStatistics;
window.getMIDIFilters = getMIDIFilters;
window.getMIDITransforms = getMIDITransforms;
window.setMIDITransform = setMIDITransform;
window.midiMonitorEnhanceState = midiMonitorEnhanceState;

console.log('[RealtimeMIDIMonitorEnhancement] Module loaded');