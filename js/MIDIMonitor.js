/**
 * MIDI Monitor - displays incoming MIDI messages in real-time
 */
window.MIDIMonitor = {
    isOpen: false,
    messages: [],
    maxMessages: 200,
    messageTypes: { note: 0, cc: 0, pitch: 0, clock: 0, other: 0 },

    open() {
        if (this.isOpen) return;
        this.isOpen = true;

        const existing = document.getElementById('midi-monitor-window');
        if (existing) { existing.remove(); this.isOpen = false; }

        const win = document.createElement('div');
        win.id = 'midi-monitor-window';
        win.className = 'snug-window';
        win.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);width:500px;max-height:400px;background:#1a1a2e;border:1px solid #3a3a5e;border-radius:8px;z-index:1000;display:flex;flex-direction:column;font-family:system-ui;font-size:13px;color:#e0e0e0;';

        win.innerHTML = `
            <div style="padding:12px 16px;background:#252540;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center;cursor:move;" onmousedown="event.preventDefault()">
                <span style="font-weight:600;">🎹 MIDI Monitor</span>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button onclick="MIDIMonitor.clear()" style="background:#3a3a5e;border:none;color:#e0e0e0;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;">Clear</button>
                    <button onclick="MIDIMonitor.close()" style="background:#e74c3c;border:none;color:white;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;">✕</button>
                </div>
            </div>
            <div style="padding:8px 16px;background:#1e1e32;display:flex;gap:16px;font-size:11px;border-bottom:1px solid #3a3a5e;">
                <span>Note: <b id="midi-stat-note">0</b></span>
                <span>CC: <b id="midi-stat-cc">0</b></span>
                <span>Pitch: <b id="midi-stat-pitch">0</b></span>
                <span>Clock: <b id="midi-stat-clock">0</b></span>
                <span>Other: <b id="midi-stat-other">0</b></span>
            </div>
            <div id="midi-messages" style="flex:1;overflow-y:auto;padding:8px 16px;max-height:280px;font-family:monospace;font-size:12px;"></div>
        `;
        document.body.appendChild(win);

        this.render();
    },

    close() {
        const w = document.getElementById('midi-monitor-window');
        if (w) w.remove();
        this.isOpen = false;
    },

    clear() {
        this.messages = [];
        this.messageTypes = { note: 0, cc: 0, pitch: 0, clock: 0, other: 0 };
        this.render();
    },

    log(msg) {
        const entry = { time: new Date().toISOString().substr(11, 8), msg };
        this.messages.unshift(entry);
        if (this.messages.length > this.maxMessages) this.messages.pop();

        const type = msg.toLowerCase();
        if (type.includes('note')) this.messageTypes.note++;
        else if (type.includes('cc') || type.includes('control')) this.messageTypes.cc++;
        else if (type.includes('pitch')) this.messageTypes.pitch++;
        else if (type.includes('clock') || type.includes('timing')) this.messageTypes.clock++;
        else this.messageTypes.other++;

        this.render();
    },

    render() {
        const container = document.getElementById('midi-messages');
        const statIds = ['note', 'cc', 'pitch', 'clock', 'other'];
        statIds.forEach(s => {
            const el = document.getElementById(`midi-stat-${s}`);
            if (el) el.textContent = this.messageTypes[s];
        });

        if (!container) return;
        container.innerHTML = this.messages.slice(0, 50).map(m =>
            `<div style="padding:2px 0;border-bottom:1px solid #2a2a44;"><span style="color:#888;">${m.time}</span> ${m.msg}</div>`
        ).join('');
    }
};

window.openMIDIMonitor = () => MIDIMonitor.open();
window.closeMIDIMonitor = () => MIDIMonitor.close();

// Hook into MIDI input if available
document.addEventListener('snawMIDIInput', (e) => {
    if (typeof MIDIMonitor !== 'undefined') {
        MIDIMonitor.log(e.detail.message || JSON.stringify(e.detail));
    }
});