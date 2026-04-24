/**
 * MIDI Channel Filter - Filter MIDI by channel with pass/block lists
 * Allows selective filtering of MIDI messages by channel
 */

export class MIDIChannelFilter {
    constructor(options = {}) {
        // Filter modes: 'pass' (allow listed), 'block' (block listed)
        this.mode = options.mode ?? 'pass';
        
        // Channel lists (1-16)
        this.passChannels = options.passChannels ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        this.blockChannels = options.blockChannels ?? [];
        
        // Filter settings
        this.filterNoteOn = options.filterNoteOn ?? true;
        this.filterNoteOff = options.filterNoteOff ?? true;
        this.filterControlChange = options.filterControlChange ?? true;
        this.filterProgramChange = options.filterProgramChange ?? true;
        this.filterPitchBend = options.filterPitchBend ?? true;
        this.filterAftertouch = options.filterAftertouch ?? true;
        
        // Message types to filter
        this.messageTypes = options.messageTypes ?? {
            noteOn: true,
            noteOff: true,
            controlChange: true,
            programChange: true,
            pitchBend: true,
            channelPressure: true,
            polyPressure: true
        };
        
        // Statistics
        this.stats = {
            passed: 0,
            blocked: 0,
            totalProcessed: 0
        };
        
        // Callbacks
        this.onMessagePass = options.onMessagePass ?? null;
        this.onMessageBlock = options.onMessageBlock ?? null;
        
        this.enabled = true;
    }
    
    process(message) {
        if (!this.enabled) {
            return message;
        }
        
        this.stats.totalProcessed++;
        
        const channel = this.extractChannel(message);
        const messageType = this.getMessageType(message);
        
        // Check if this message type should be filtered
        if (!this.shouldFilterMessageType(messageType)) {
            this.stats.passed++;
            return message;
        }
        
        // Check channel
        const shouldPass = this.shouldPassChannel(channel);
        
        if (shouldPass) {
            this.stats.passed++;
            if (this.onMessagePass) {
                this.onMessagePass(message, channel, messageType);
            }
            return message;
        } else {
            this.stats.blocked++;
            if (this.onMessageBlock) {
                this.onMessageBlock(message, channel, messageType);
            }
            return null; // Block the message
        }
    }
    
    extractChannel(message) {
        // MIDI channel is in the lower 4 bits of the status byte
        if (message.data && message.data[0] !== undefined) {
            return (message.data[0] & 0x0F) + 1; // Channels are 1-16
        }
        if (message.status !== undefined) {
            return (message.status & 0x0F) + 1;
        }
        return 1; // Default to channel 1
    }
    
    getMessageType(message) {
        if (message.data && message.data[0] !== undefined) {
            const status = message.data[0] & 0xF0;
            switch (status) {
                case 0x90: return message.data[2] > 0 ? 'noteOn' : 'noteOff';
                case 0x80: return 'noteOff';
                case 0xB0: return 'controlChange';
                case 0xC0: return 'programChange';
                case 0xD0: return 'channelPressure';
                case 0xA0: return 'polyPressure';
                case 0xE0: return 'pitchBend';
                default: return 'unknown';
            }
        }
        if (message.type) {
            return message.type;
        }
        return 'unknown';
    }
    
    shouldFilterMessageType(type) {
        return this.messageTypes[type] !== false;
    }
    
    shouldPassChannel(channel) {
        if (this.mode === 'pass') {
            // Pass only channels in the pass list
            return this.passChannels.includes(channel);
        } else {
            // Block channels in the block list, pass all others
            return !this.blockChannels.includes(channel);
        }
    }
    
    setMode(mode) {
        this.mode = mode === 'block' ? 'block' : 'pass';
    }
    
    setPassChannels(channels) {
        this.passChannels = [...new Set(channels)].filter(c => c >= 1 && c <= 16);
    }
    
    setBlockChannels(channels) {
        this.blockChannels = [...new Set(channels)].filter(c => c >= 1 && c <= 16);
    }
    
    addPassChannel(channel) {
        if (channel >= 1 && channel <= 16 && !this.passChannels.includes(channel)) {
            this.passChannels.push(channel);
        }
    }
    
    removePassChannel(channel) {
        const index = this.passChannels.indexOf(channel);
        if (index !== -1) {
            this.passChannels.splice(index, 1);
        }
    }
    
    addBlockChannel(channel) {
        if (channel >= 1 && channel <= 16 && !this.blockChannels.includes(channel)) {
            this.blockChannels.push(channel);
        }
    }
    
    removeBlockChannel(channel) {
        const index = this.blockChannels.indexOf(channel);
        if (index !== -1) {
            this.blockChannels.splice(index, 1);
        }
    }
    
    setMessageTypeFilter(type, enabled) {
        if (this.messageTypes.hasOwnProperty(type)) {
            this.messageTypes[type] = enabled;
        }
    }
    
    enable() {
        this.enabled = true;
    }
    
    disable() {
        this.enabled = false;
    }
    
    resetStats() {
        this.stats = {
            passed: 0,
            blocked: 0,
            totalProcessed: 0
        };
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    getParameters() {
        return {
            mode: this.mode,
            passChannels: [...this.passChannels],
            blockChannels: [...this.blockChannels],
            messageTypes: { ...this.messageTypes },
            enabled: this.enabled
        };
    }
    
    setParameters(params) {
        if (params.mode) this.setMode(params.mode);
        if (params.passChannels) this.setPassChannels(params.passChannels);
        if (params.blockChannels) this.setBlockChannels(params.blockChannels);
        if (params.messageTypes) {
            Object.entries(params.messageTypes).forEach(([type, enabled]) => {
                this.setMessageTypeFilter(type, enabled);
            });
        }
        if (params.enabled !== undefined) {
            this.enabled = params.enabled;
        }
    }
}

// Factory function
export function createMIDIChannelFilter(options = {}) {
    return new MIDIChannelFilter(options);
}

// Presets
export const MIDI_FILTER_PRESETS = {
    allChannels: {
        mode: 'pass',
        passChannels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        blockChannels: []
    },
    channel1: {
        mode: 'pass',
        passChannels: [1],
        blockChannels: []
    },
    drumsOnly: {
        mode: 'pass',
        passChannels: [10],
        blockChannels: []
    },
    excludeDrums: {
        mode: 'block',
        passChannels: [],
        blockChannels: [10]
    },
    channels1to4: {
        mode: 'pass',
        passChannels: [1, 2, 3, 4],
        blockChannels: []
    },
    channels5to8: {
        mode: 'pass',
        passChannels: [5, 6, 7, 8],
        blockChannels: []
    }
};

// UI Panel
export function createMIDIChannelFilterPanel(filter, appServices) {
    const container = document.createElement('div');
    container.className = 'midi-channel-filter-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 300px;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'MIDI Channel Filter';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Mode toggle
    const modeContainer = document.createElement('div');
    modeContainer.style.cssText = 'margin-bottom: 16px;';
    modeContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Filter Mode</div>
        <div style="display: flex; gap: 8px;">
            <button id="passMode" style="flex: 1; padding: 8px; background: ${filter.mode === 'pass' ? '#3b82f6' : '#374151'}; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Pass List
            </button>
            <button id="blockMode" style="flex: 1; padding: 8px; background: ${filter.mode === 'block' ? '#3b82f6' : '#374151'}; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Block List
            </button>
        </div>
    `;
    container.appendChild(modeContainer);
    
    // Channel buttons
    const channelsContainer = document.createElement('div');
    channelsContainer.style.cssText = 'margin-bottom: 16px;';
    channelsContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Channels</div>
        <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px;">
            ${Array.from({ length: 16 }, (_, i) => {
                const ch = i + 1;
                const isActive = filter.mode === 'pass' 
                    ? filter.passChannels.includes(ch)
                    : filter.blockChannels.includes(ch);
                return `<button class="channel-btn" data-channel="${ch}" style="padding: 8px; background: ${isActive ? '#22c55e' : '#374151'}; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">
                    ${ch}
                </button>`;
            }).join('')}
        </div>
    `;
    container.appendChild(channelsContainer);
    
    // Message type filters
    const typesContainer = document.createElement('div');
    typesContainer.style.cssText = 'margin-bottom: 16px;';
    typesContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Message Types</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            ${Object.entries(filter.messageTypes).map(([type, enabled]) => `
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
                    <input type="checkbox" class="type-filter" data-type="${type}" ${enabled ? 'checked' : ''}>
                    ${formatMessageType(type)}
                </label>
            `).join('')}
        </div>
    `;
    container.appendChild(typesContainer);
    
    // Statistics
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    statsContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Passed</span>
            <span id="passedCount">0</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>Blocked</span>
            <span id="blockedCount">0</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
            <span>Total</span>
            <span id="totalCount">0</span>
        </div>
        <button id="resetStats" style="margin-top: 8px; padding: 6px 12px; background: #4b5563; border: none; border-radius: 4px; color: white; cursor: pointer; width: 100%;">
            Reset Stats
        </button>
    `;
    container.appendChild(statsContainer);
    
    // Presets
    const presetsContainer = document.createElement('div');
    presetsContainer.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Presets</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${Object.keys(MIDI_FILTER_PRESETS).map(name => `
                <button class="preset-btn" data-preset="${name}" style="padding: 6px 12px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 12px;">
                    ${name.replace(/([A-Z])/g, ' $1').trim()}
                </button>
            `).join('')}
        </div>
    `;
    container.appendChild(presetsContainer);
    
    // Event handlers
    document.getElementById('passMode').addEventListener('click', () => {
        filter.setMode('pass');
        updateModeButtons();
        updateChannelButtons();
    });
    
    document.getElementById('blockMode').addEventListener('click', () => {
        filter.setMode('block');
        updateModeButtons();
        updateChannelButtons();
    });
    
    // Channel button handlers
    channelsContainer.querySelectorAll('.channel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const channel = parseInt(btn.dataset.channel);
            
            if (filter.mode === 'pass') {
                if (filter.passChannels.includes(channel)) {
                    filter.removePassChannel(channel);
                } else {
                    filter.addPassChannel(channel);
                }
            } else {
                if (filter.blockChannels.includes(channel)) {
                    filter.removeBlockChannel(channel);
                } else {
                    filter.addBlockChannel(channel);
                }
            }
            
            updateChannelButtons();
        });
    });
    
    // Message type handlers
    typesContainer.querySelectorAll('.type-filter').forEach(input => {
        input.addEventListener('change', (e) => {
            filter.setMessageTypeFilter(e.target.dataset.type, e.target.checked);
        });
    });
    
    // Reset stats
    document.getElementById('resetStats').addEventListener('click', () => {
        filter.resetStats();
        updateStats();
    });
    
    // Preset handlers
    presetsContainer.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = MIDI_FILTER_PRESETS[btn.dataset.preset];
            filter.setParameters(preset);
            updateModeButtons();
            updateChannelButtons();
        });
    });
    
    function updateModeButtons() {
        document.getElementById('passMode').style.background = filter.mode === 'pass' ? '#3b82f6' : '#374151';
        document.getElementById('blockMode').style.background = filter.mode === 'block' ? '#3b82f6' : '#374151';
    }
    
    function updateChannelButtons() {
        channelsContainer.querySelectorAll('.channel-btn').forEach(btn => {
            const channel = parseInt(btn.dataset.channel);
            const isActive = filter.mode === 'pass'
                ? filter.passChannels.includes(channel)
                : filter.blockChannels.includes(channel);
            btn.style.background = isActive ? '#22c55e' : '#374151';
        });
    }
    
    function updateStats() {
        const stats = filter.getStats();
        document.getElementById('passedCount').textContent = stats.passed;
        document.getElementById('blockedCount').textContent = stats.blocked;
        document.getElementById('totalCount').textContent = stats.totalProcessed;
    }
    
    function formatMessageType(type) {
        const names = {
            noteOn: 'Note On',
            noteOff: 'Note Off',
            controlChange: 'CC',
            programChange: 'Program',
            pitchBend: 'Pitch Bend',
            channelPressure: 'Ch Pressure',
            polyPressure: 'Poly Pressure'
        };
        return names[type] || type;
    }
    
    // Start stats update interval
    const statsInterval = setInterval(updateStats, 100);
    
    // Cleanup function
    container.destroy = () => {
        clearInterval(statsInterval);
    };
    
    return container;
}

export default MIDIChannelFilter;