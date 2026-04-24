// js/MIDIMonitor.js - MIDI input/output monitor panel
export class MIDIMonitor {
    constructor() {
        this.messages = [];
        this.maxMessages = 100;
        this.enabled = false;
    }

    enable() {
        this.enabled = true;
        console.log('[MIDIMonitor] Enabled');
    }

    disable() {
        this.enabled = false;
        console.log('[MIDIMonitor] Disabled');
    }

    isEnabled() {
        return this.enabled;
    }

    addMessage(type, channel, data1, data2, timestamp) {
        if (!this.enabled) return;

        const message = {
            type,
            channel,
            data1,
            data2,
            timestamp: timestamp || Date.now(),
            command: this.getCommandName(type, data1)
        };

        this.messages.unshift(message);
        if (this.messages.length > this.maxMessages) {
            this.messages.pop();
        }

        return message;
    }

    getCommandName(type, data1) {
        const commands = {
            128: 'Note Off',
            144: 'Note On',
            176: 'Control Change',
            224: 'Pitch Bend',
            128: 'Aftertouch'
        };
        return commands[type] || `Unknown (${type})`;
    }

    getMessages() {
        return [...this.messages];
    }

    clear() {
        this.messages = [];
    }

    filterByChannel(channel) {
        return this.messages.filter(m => m.channel === channel);
    }

    filterByType(type) {
        return this.messages.filter(m => m.type === type);
    }

    exportToJSON() {
        return JSON.stringify(this.messages, null, 2);
    }

    importFromJSON(json) {
        try {
            this.messages = JSON.parse(json);
        } catch (e) {
            console.error('[MIDIMonitor] Import failed:', e);
        }
    }
}

export function createMIDIMonitor() {
    return new MIDIMonitor();
}