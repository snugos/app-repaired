// js/MIDIMonitor.js - MIDI Monitor Panel for SnugOS DAW
// Displays MIDI input/output activity in real-time

let midiMonitorPanel = null;
let midiMonitorLogs = [];
const MAX_LOG_ENTRIES = 100;

// MIDI event type names
const MIDI_EVENT_NAMES = {
    0x80: 'Note Off',
    0x90: 'Note On',
    0xa0: 'Key Pressure',
    0xb0: 'Control Change',
    0xc0: 'Program Change',
    0xd0: 'Channel Pressure',
    0xe0: 'Pitch Bend',
    0xf0: 'SysEx',
    0xf7: 'SysEx End',
    0xff: 'Meta Event'
};

// CC names for common controllers
const CC_NAMES = {
    1: 'Modulation',
    7: 'Volume',
    10: 'Pan',
    11: 'Expression',
    64: 'Sustain',
    91: 'Reverb',
    93: 'Chorus',
    94: 'Delay',
    120: 'All Sound Off',
    123: 'All Notes Off'
};

/**
 * Format a MIDI message for display
 */
function formatMIDIMessage(data) {
    const status = data.status & 0xf0;
    const channel = (data.status & 0x0f) + 1;
    let desc = '';
    let detail = '';

    switch (status) {
        case 0x80:
            desc = 'Note Off';
            detail = `Ch ${channel}, Note ${data.data1}, Vel ${data.data2}`;
            break;
        case 0x90:
            desc = 'Note On';
            detail = `Ch ${channel}, Note ${data.data1}, Vel ${data.data2}`;
            break;
        case 0xa0:
            desc = 'Key Pressure';
            detail = `Ch ${channel}, Note ${data.data1}, Value ${data.data2}`;
            break;
        case 0xb0:
            desc = 'CC';
            const ccName = CC_NAMES[data.data1] || `CC${data.data1}`;
            detail = `Ch ${channel}, ${ccName} = ${data.data2}`;
            break;
        case 0xc0:
            desc = 'Program';
            detail = `Ch ${channel}, Program ${data.data1}`;
            break;
        case 0xd0:
            desc = 'Channel Pressure';
            detail = `Ch ${channel}, Value ${data.data1}`;
            break;
        case 0xe0:
            desc = 'Pitch Bend';
            const bendVal = (data.data2 << 7) | data.data1;
            detail = `Ch ${channel}, Value ${bendVal}`;
            break;
        case 0xf0:
            desc = 'SysEx';
            detail = `Length: ${data.data?.length || 0} bytes`;
            break;
        default:
            desc = `Status 0x${status.toString(16)}`;
            detail = `Ch ${channel}`;
    }

    return { desc, detail };
}

/**
 * Get icon for event type
 */
function getEventIcon(status) {
    const type = status & 0xf0;
    switch (type) {
        case 0x80: return '🔇';
        case 0x90: return '🎹';
        case 0xa0: return '🔘';
        case 0xb0: return '🎛️';
        case 0xc0: return '🎹';
        case 0xd0: return '💨';
        case 0xe0: return '↕️';
        case 0xf0: return '📦';
        default: return '🎵';
    }
}

/**
 * Open the MIDI Monitor panel
 */
export function openMIDIMonitorPanel() {
    if (midiMonitorPanel) {
        midiMonitorPanel.remove();
        midiMonitorPanel = null;
    }

    const panel = document.createElement('div');
    panel.id = 'midiMonitorPanel';
    panel.className = 'panel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        right: 20px;
        width: 480px;
        height: 500px;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
        padding: 12px 16px;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #16213e;
        flex-shrink: 0;
    `;
    header.innerHTML = `
        <div class="flex items-center gap-2">
            <span style="font-size: 18px;">🎹</span>
            <span style="color: #eee; font-size: 14px; font-weight: 600;">MIDI Monitor</span>
        </div>
        <div class="flex items-center gap-2">
            <button id="midi-mon-clear" style="padding: 4px 10px; background: #333; border: none; border-radius: 4px; color: #aaa; cursor: pointer; font-size: 11px;">Clear</button>
            <button id="midi-mon-pin" style="padding: 4px 10px; background: #4a90d9; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">Pin</button>
            <button id="midi-mon-close" style="padding: 4px 10px; background: #333; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 16px;">×</button>
        </div>
    `;

    const filterBar = document.createElement('div');
    filterBar.style.cssText = `
        padding: 8px 12px;
        border-bottom: 1px solid #222;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        flex-shrink: 0;
        background: #141424;
    `;
    filterBar.innerHTML = `
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" id="midi-filter-note" checked style="accent-color: #4a90d9;"> 
            <span style="color: #aaa; font-size: 11px;">Notes</span>
        </label>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" id="midi-filter-cc" checked style="accent-color: #4a90d9;"> 
            <span style="color: #aaa; font-size: 11px;">CC</span>
        </label>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" id="midi-filter-pc" checked style="accent-color: #4a90d9;"> 
            <span style="color: #aaa; font-size: 11px;">PC</span>
        </label>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" id="midi-filter-pb" checked style="accent-color: #4a90d9;"> 
            <span style="color: #aaa; font-size: 11px;">Pitch</span>
        </label>
        <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" id="midi-filter-sysex" checked style="accent-color: #4a90d9;"> 
            <span style="color: #aaa; font-size: 11px;">SysEx</span>
        </label>
    `;

    const logContainer = document.createElement('div');
    logContainer.id = 'midi-log-container';
    logContainer.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 8px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        background: #0d0d1a;
    `;

    const statusBar = document.createElement('div');
    statusBar.id = 'midi-status-bar';
    statusBar.style.cssText = `
        padding: 6px 12px;
        border-top: 1px solid #222;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #141424;
        flex-shrink: 0;
    `;
    statusBar.innerHTML = `
        <span id="midi-mon-count" style="color: #666; font-size: 11px;">0 messages</span>
        <div class="flex items-center gap-2">
            <span id="midi-mon-input-status" style="color: #4a90d9; font-size: 11px;">● Input</span>
            <span style="color: #333;">|</span>
            <span id="midi-mon-output-status" style="color: #666; font-size: 11px;">○ Output</span>
        </div>
    `;

    panel.appendChild(header);
    panel.appendChild(filterBar);
    panel.appendChild(logContainer);
    panel.appendChild(statusBar);
    document.body.appendChild(panel);
    midiMonitorPanel = panel;

    // Event listeners
    document.getElementById('midi-mon-close').onclick = closeMIDIMonitorPanel;
    document.getElementById('midi-mon-clear').onclick = clearMIDIMonitorLogs;

    const pinBtn = document.getElementById('midi-mon-pin');
    let isPinned = false;
    pinBtn.onclick = () => {
        isPinned = !isPinned;
        pinBtn.style.background = isPinned ? '#10b981' : '#4a90d9';
        pinBtn.textContent = isPinned ? 'Pinned' : 'Pin';
        if (isPinned) {
            panel.style.zIndex = '100000';
        } else {
            panel.style.zIndex = '10000';
        }
    };

    // Close on outside click (unless pinned)
    setTimeout(() => {
        const clickHandler = (e) => {
            if (!panel.contains(e.target) && !isPinned) {
                closeMIDIMonitorPanel();
                document.removeEventListener('click', clickHandler);
            }
        };
        document.addEventListener('click', clickHandler);
    }, 100);

    // Start MIDI monitoring if not already
    initMIDIMonitor();

    return panel;
}

/**
 * Initialize MIDI monitoring
 */
function initMIDIMonitor() {
    if (window.midiMonitorActive) return;
    window.midiMonitorActive = true;

    // Monitor Web MIDI API
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure).catch(err => {
            console.warn('[MIDIMonitor] MIDI access denied:', err);
        });
    }

    // Intercept MIDI messages via appServices if available
    if (window.localAppServices?.onMIDIMessage) {
        const originalHandler = window.localAppServices.onMIDIMessage;
        window.localAppServices.onMIDIMessage = (msg) => {
            logMIDIMessage('input', msg);
            return originalHandler(msg);
        };
    }
}

function onMIDISuccess(midiAccess) {
    // Listen to all MIDI inputs
    midiAccess.inputs.forEach(input => {
        input.onmidimessage = (event) => {
            if (event.data) {
                logMIDIMessage('input', {
                    status: event.data[0],
                    data1: event.data[1],
                    data2: event.data[2],
                    timestamp: event.timeStamp,
                    data: Array.from(event.data)
                });
            }
        };
    });
}

function onMIDIFailure(err) {
    console.warn('[MIDIMonitor] MIDI not available:', err);
}

/**
 * Log a MIDI message
 */
export function logMIDIMessage(direction, data) {
    if (!midiMonitorPanel) return;

    const status = data.status & 0xf0;
    const formatted = formatMIDIMessage(data);
    const icon = getEventIcon(data.status);
    const time = data.timestamp ? new Date(data.timestamp).toISOString().substr(11, 12) : new Date().toISOString().substr(11, 12);

    const logEntry = {
        id: Date.now() + Math.random(),
        direction,
        status,
        data,
        formatted,
        icon,
        time,
        filtered: false
    };

    // Apply filters
    const filterNote = document.getElementById('midi-filter-note')?.checked ?? true;
    const filterCC = document.getElementById('midi-filter-cc')?.checked ?? true;
    const filterPC = document.getElementById('midi-filter-pc')?.checked ?? true;
    const filterPB = document.getElementById('midi-filter-pb')?.checked ?? true;
    const filterSysex = document.getElementById('midi-filter-sysex')?.checked ?? true;

    switch (status) {
        case 0x80:
        case 0x90:
            logEntry.filtered = !filterNote;
            break;
        case 0xa0:
            logEntry.filtered = !filterNote;
            break;
        case 0xb0:
            logEntry.filtered = !filterCC;
            break;
        case 0xc0:
        case 0xd0:
            logEntry.filtered = !filterPC;
            break;
        case 0xe0:
            logEntry.filtered = !filterPB;
            break;
        case 0xf0:
        case 0xf7:
            logEntry.filtered = !filterSysex;
            break;
    }

    midiMonitorLogs.unshift(logEntry);
    if (midiMonitorLogs.length > MAX_LOG_ENTRIES) {
        midiMonitorLogs.pop();
    }

    updateMIDIMonitorLog();
}

/**
 * Update the log display
 */
function updateMIDIMonitorLog() {
    const container = document.getElementById('midi-log-container');
    if (!container) return;

    const visibleLogs = midiMonitorLogs.filter(log => !log.filtered);
    const count = visibleLogs.length;

    // Update count
    const countEl = document.getElementById('midi-mon-count');
    if (countEl) {
        countEl.textContent = `${count} messages`;
    }

    // Render logs
    container.innerHTML = visibleLogs.map(log => {
        const dirColor = log.direction === 'input' ? '#4a90d9' : '#10b981';
        const dirArrow = log.direction === 'input' ? '←' : '→';
        return `
            <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 8px;
                border-bottom: 1px solid #1a1a2e;
                background: #12121f;
                margin-bottom: 2px;
                border-radius: 4px;
            ">
                <span style="
                    color: ${dirColor};
                    font-weight: bold;
                    min-width: 16px;
                    text-align: center;
                ">${dirArrow}</span>
                <span style="font-size: 14px;">${log.icon}</span>
                <span style="color: #888; min-width: 80px;">${log.time}</span>
                <span style="color: ${dirColor}; min-width: 60px;">${log.formatted.desc}</span>
                <span style="color: #ccc; flex: 1;">${log.formatted.detail}</span>
            </div>
        `;
    }).join('');

    if (visibleLogs.length === 0) {
        container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #444;
                font-size: 13px;
            ">
                <span style="font-size: 32px; margin-bottom: 8px;">🎹</span>
                <span>Waiting for MIDI data...</span>
                <span style="font-size: 11px; margin-top: 4px;">Connect a MIDI device or play notes</span>
            </div>
        `;
    }
}

/**
 * Clear all logs
 */
function clearMIDIMonitorLogs() {
    midiMonitorLogs = [];
    updateMIDIMonitorLog();
}

/**
 * Close the MIDI monitor panel
 */
export function closeMIDIMonitorPanel() {
    if (midiMonitorPanel) {
        midiMonitorPanel.remove();
        midiMonitorPanel = null;
    }
}

/**
 * Get current logs
 */
export function getMIDIMonitorLogs() {
    return midiMonitorLogs;
}

// Auto-open for debugging (can be called from console)
// window.openMIDIMonitorPanel = openMIDIMonitorPanel;