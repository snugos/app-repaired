/**
 * MidiMonitor.js - Real-time MIDI input/output event monitor
 * Displays live MIDI events with note names, velocity, channel, and timestamps
 */

class MidiMonitor {
    constructor() {
        this.events = [];
        this.maxEvents = 500;
        this.isRecording = false;
        this.filterChannel = null;
        this.filterType = null;
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        this.onEventCallback = null;
        this.init();
    }

    init() {
        this.attachMIDIListeners();
        console.log('[MidiMonitor] Initialized');
    }

    midiNoteToName(note) {
        const octave = Math.floor(note / 12) - 1;
        const noteName = this.noteNames[note % 12];
        return `${noteName}${octave}`;
    }

    getMessageTypeName(status) {
        const type = status & 0xF0;
        switch (type) {
            case 0x80: return 'Note Off';
            case 0x90: return 'Note On';
            case 0xA0: return 'Aftertouch';
            case 0xB0: return 'CC';
            case 0xC0: return 'Program';
            case 0xD0: return 'Channel Press';
            case 0xE0: return 'Pitch Bend';
            default: return `Unknown (${type})`;
        }
    }

    getCCName(cc) {
        const ccNames = {
            1: 'Mod Wheel', 2: 'Breath', 4: 'Foot', 7: 'Volume', 10: 'Pan',
            11: 'Expression', 64: 'Sustain', 65: 'Portamento', 66: 'Sostenuto',
            67: 'Soft Pedal', 68: 'Legato', 91: 'Reverb', 93: 'Chorus',
            94: 'Delay', 120: 'All Sound Off', 121: 'Reset', 123: 'All Notes Off'
        };
        return ccNames[cc] || `CC${cc}`;
    }

    formatEvent(event) {
        const channel = (event.status & 0x0F) + 1;
        const type = event.status & 0xF0;
        let displayType = this.getMessageTypeName(event.status);
        let noteInfo = '';
        let valueInfo = '';

        if (type === 0x90 && event.data2 > 0) {
            noteInfo = `${this.midiNoteToName(event.data1)} vel:${event.data2}`;
        } else if (type === 0x80 || (type === 0x90 && event.data2 === 0)) {
            noteInfo = `${this.midiNoteToName(event.data1)} vel:0`;
        } else if (type === 0xB0) {
            noteInfo = this.getCCName(event.data1);
            valueInfo = `val:${event.data2}`;
        } else if (type === 0xE0) {
            const bend = ((event.data2 << 7) | event.data1) - 8192;
            valueInfo = `bend:${bend}`;
        } else if (type === 0xC0) {
            valueInfo = `prog:${event.data1}`;
        }

        return {
            type: displayType,
            channel,
            note: noteInfo,
            value: valueInfo,
            timestamp: new Date().toISOString().substr(11, 12)
        };
    }

    attachMIDIListeners() {
        if (!navigator.requestMIDIAccess) return;
        
        navigator.requestMIDIAccess({ sysex: false }).then(midiAccess => {
            midiAccess.inputs.forEach(input => {
                input.onmidimessage = (e) => this.receiveMIDI(e);
            });
            midiAccess.onstatechange = (e) => {
                e.port.inputs.forEach(input => {
                    if (!input.onmidimessage) {
                        input.onmidimessage = (ev) => this.receiveMIDI(ev);
                    }
                });
            };
        }).catch(err => {
            console.warn('[MidiMonitor] Web MIDI not available:', err);
        });
    }

    receiveMIDI(event) {
        if (!event.data || event.data.length < 2) return;
        
        const [status, data1, data2] = event.data;
        const channel = (status & 0x0F) + 1;
        const type = status & 0xF0;

        if (this.filterChannel && channel !== this.filterChannel) return;
        if (this.filterType && type !== this.filterType) return;

        const formatted = this.formatEvent({ status, data1, data2 });
        
        this.events.unshift({
            ...formatted,
            raw: Array.from(event.data),
            inputName: event.target?.name || 'Unknown'
        });

        if (this.events.length > this.maxEvents) {
            this.events.pop();
        }

        if (this.onEventCallback) {
            this.onEventCallback(formatted);
        }
    }

    setFilter(channel, type) {
        this.filterChannel = channel;
        this.filterType = type;
    }

    clear() {
        this.events = [];
    }

    toggleRecording() {
        this.isRecording = !this.isRecording;
        return this.isRecording;
    }

    exportEvents() {
        return JSON.stringify(this.events, null, 2);
    }

    getEvents() {
        return this.events;
    }

    openMonitorPanel() {
        const existing = document.getElementById('midi-monitor-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'midi-monitor-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 420px;
            max-height: 500px;
            background: #0d0d1a;
            border: 1px solid #333;
            border-radius: 10px;
            z-index: 10000;
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            color: #e0e0e0;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        `;

        const filteredEvents = () => {
            return this.events.filter(e => {
                const type = e.raw ? (e.raw[0] & 0xF0) : 0;
                if (this.filterChannel && e.channel !== this.filterChannel) return false;
                if (this.filterType && type !== this.filterType) return false;
                return true;
            });
        };

        panel.innerHTML = `
            <div style="padding: 12px 16px; background: linear-gradient(135deg, #1a1a3e, #2a1a4e); border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 14px; font-weight: 600; color: #a78bfa;">🎹 MIDI Monitor</div>
                    <div style="font-size: 10px; color: #888; margin-top: 2px;" id="midi-monitor-count">0 events</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <select id="midi-filter-channel" style="background: #1a1a2e; border: 1px solid #444; border-radius: 4px; color: #fff; padding: 4px 8px; font-size: 11px;">
                        <option value="">All Ch</option>
                        ${Array.from({length: 16}, (_, i) => `<option value="${i+1}">Ch ${i+1}</option>`).join('')}
                    </select>
                    <select id="midi-filter-type" style="background: #1a1a2e; border: 1px solid #444; border-radius: 4px; color: #fff; padding: 4px 8px; font-size: 11px;">
                        <option value="">All Types</option>
                        <option value="144">Note On</option>
                        <option value="128">Note Off</option>
                        <option value="176">CC</option>
                        <option value="224">Pitch Bend</option>
                    </select>
                    <button id="midi-monitor-clear" style="background: #ef4444; border: none; border-radius: 4px; color: white; padding: 4px 10px; font-size: 11px; cursor: pointer;">Clear</button>
                    <button id="midi-monitor-close" style="background: #555; border: none; border-radius: 4px; color: white; padding: 4px 10px; font-size: 11px; cursor: pointer;">✕</button>
                </div>
            </div>
            <div id="midi-monitor-events" style="max-height: 400px; overflow-y: auto; font-size: 11px;">
                <div style="padding: 20px; text-align: center; color: #555; font-size: 12px;">
                    Waiting for MIDI input...
                </div>
            </div>
            <div style="padding: 8px 16px; background: #0a0a14; border-top: 1px solid #222; display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                <span id="midi-monitor-status">● Listening</span>
                <span>Max: ${this.maxEvents}</span>
            </div>
        `;

        document.body.appendChild(panel);

        const eventsDiv = panel.querySelector('#midi-monitor-events');
        const countDiv = panel.querySelector('#midi-monitor-count');
        const statusDiv = panel.querySelector('#midi-monitor-status');

        panel.querySelector('#midi-filter-channel').onchange = (e) => {
            this.filterChannel = e.target.value ? parseInt(e.target.value) : null;
            this.refreshEvents(eventsDiv, filteredEvents, countDiv);
        };

        panel.querySelector('#midi-filter-type').onchange = (e) => {
            this.filterType = e.target.value ? parseInt(e.target.value) : null;
            this.refreshEvents(eventsDiv, filteredEvents, countDiv);
        };

        panel.querySelector('#midi-monitor-clear').onclick = () => {
            this.clear();
            this.refreshEvents(eventsDiv, filteredEvents, countDiv);
        };

        panel.querySelector('#midi-monitor-close').onclick = () => panel.remove();

        this.refreshEvents = (container, getFiltered, countEl) => {
            const evts = getFiltered();
            countEl.textContent = `${evts.length} events`;

            if (evts.length === 0) {
                container.innerHTML = `<div style="padding: 20px; text-align: center; color: #555; font-size: 12px;">Waiting for MIDI input...</div>`;
                return;
            }

            container.innerHTML = evts.map((e, i) => {
                const isNoteOn = e.type === 'Note On' && e.value !== 'vel:0';
                const bgColor = isNoteOn ? (e.raw && e.raw[2] > 80 ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.08)') : 'transparent';
                const noteColor = isNoteOn ? '#a78bfa' : '#888';
                const channelColor = e.channel <= 10 ? '#10b981' : '#f59e0b';

                return `
                    <div style="padding: 6px 16px; border-bottom: 1px solid #1a1a2e; display: grid; grid-template-columns: 70px 50px 1fr auto; gap: 8px; align-items: center; ${bgColor ? `background: ${bgColor};` : ''}">
                        <span style="color: #555;">${e.timestamp}</span>
                        <span style="color: ${channelColor};">Ch ${e.channel}</span>
                        <span style="color: ${noteColor};">${e.type} ${e.note}</span>
                        <span style="color: #666;">${e.value}</span>
                    </div>
                `;
            }).join('');
        };

        this.refreshEvents(eventsDiv, filteredEvents, countDiv);
        statusDiv.textContent = this.isRecording ? '● Recording' : '● Listening';

        const interval = setInterval(() => {
            if (!document.getElementById('midi-monitor-panel')) {
                clearInterval(interval);
                return;
            }
            this.refreshEvents(eventsDiv, filteredEvents, countDiv);
        }, 200);

        panel.style.animation = 'slideIn 0.2s ease-out';
        const style = document.createElement('style');
        style.textContent = `@keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`;
        document.head.appendChild(style);
    }
}

// Auto-init
window.midiMonitor = new MidiMonitor();