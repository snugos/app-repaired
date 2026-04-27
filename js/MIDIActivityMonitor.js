// MIDIActivityMonitor.js - Real-time MIDI input activity visualization
(function() {
    'use strict';

    const MAX_ENTRIES = 50;
    const activityBuffer = [];
    let monitorWindow = null;
    let updateInterval = null;

    // Channel names for display
    const CHANNEL_NAMES = ['Ch1', 'Ch2', 'Ch3', 'Ch4', 'Ch5', 'Ch6', 'Ch7', 'Ch8', 
                           'Ch9', 'Ch10', 'Ch11', 'Ch12', 'Ch13', 'Ch14', 'Ch15', 'Ch16'];

    // CC names for common controllers
    const CC_NAMES = {
        1: 'Mod', 7: 'Vol', 10: 'Pan', 11: 'Expr', 64: 'Sust', 91: 'Fx1', 93: 'Fx2',
        120: 'AllSound', 123: 'AllNotes'
    };

    function logActivity(type, channel, data1, data2, timestamp) {
        const entry = {
            type,
            channel: channel + 1,
            data1,
            data2,
            time: timestamp || Date.now(),
            formatted: formatMIDI(type, channel, data1, data2)
        };
        activityBuffer.unshift(entry);
        if (activityBuffer.length > MAX_ENTRIES) {
            activityBuffer.pop();
        }
        if (monitorWindow && !monitorWindow.closed) {
            updateMonitorDisplay();
        }
    }

    function formatMIDI(type, channel, d1, d2) {
        const ch = CHANNEL_NAMES[channel] || `Ch${channel + 1}`;
        switch (type) {
            case 'noteon':
                return `Note On ${ch}: ${d1} vel:${d2}`;
            case 'noteoff':
                return `Note Off ${ch}: ${d1}`;
            case 'cc':
                const ccName = CC_NAMES[d1] || `CC${d1}`;
                return `CC ${ch} ${ccName}: ${d2}`;
            case 'pitchbend':
                const val = (d2 * 128 + d1) - 8192;
                return `Pitch Bend ${ch}: ${val}`;
            case 'clock':
                return 'Clock Tick';
            case 'active':
                return 'Active Sensing';
            case 'reset':
                return 'MIDI Reset';
            default:
                return `${type} ${ch}: ${d1} ${d2}`;
        }
    }

    function updateMonitorDisplay() {
        if (!monitorWindow || monitorWindow.closed) return;
        const content = monitorWindow.document.getElementById('midi-activity-content');
        if (!content) return;
        
        const rows = activityBuffer.slice(0, 30).map((entry, i) => {
            const age = ((Date.now() - entry.time) / 1000).toFixed(1);
            const typeClass = entry.type.replace(/\s/g, '-').toLowerCase();
            return `<div class="midi-entry ${typeClass}" style="opacity:${Math.max(0.3, 1 - i * 0.02)}">
                <span class="midi-time">${age}s</span>
                <span class="midi-type">${entry.type}</span>
                <span class="midi-data">${entry.formatted}</span>
            </div>`;
        }).join('');
        
        content.innerHTML = rows || '<div class="midi-empty">No MIDI activity</div>';
    }

    function openMIDIActivityPanel() {
        if (monitorWindow && !monitorWindow.closed) {
            monitorWindow.focus();
            return monitorWindow;
        }

        const win = window.open('', 'MIDIActivity', 
            'width=500,height=400,resizable=yes,scrollbars=yes');
        
        if (!win) {
            alert('Please allow popups to open the MIDI Activity Monitor');
            return null;
        }

        monitorWindow = win;
        
        win.document.write(`
<!DOCTYPE html>
<html>
<head>
    <title>MIDI Activity Monitor</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'SF Mono', 'Monaco', 'Consolas', monospace; 
            background: #1a1a2e; color: #e0e0e0; padding: 12px; 
            font-size: 12px;
        }
        h2 { 
            color: #00ff88; margin-bottom: 12px; font-size: 14px;
            text-transform: uppercase; letter-spacing: 2px;
        }
        .midi-container {
            border: 1px solid #333;
            border-radius: 4px;
            background: #0d0d1a;
            max-height: 340px;
            overflow-y: auto;
        }
        .midi-entry {
            display: flex;
            padding: 6px 8px;
            border-bottom: 1px solid #222;
            font-size: 11px;
            transition: opacity 0.3s;
        }
        .midi-entry:last-child { border-bottom: none; }
        .midi-entry:hover { background: #1f1f3a; }
        .midi-time { color: #666; width: 50px; flex-shrink: 0; }
        .midi-type { 
            width: 70px; flex-shrink: 0; font-weight: bold;
            text-transform: uppercase; font-size: 10px;
        }
        .midi-data { color: #00ccff; flex: 1; }
        .midi-empty { 
            color: #444; text-align: center; padding: 40px;
            font-style: italic;
        }
        /* Type-specific colors */
        .noteon .midi-type { color: #00ff88; }
        .noteoff .midi-type { color: #ff6b6b; }
        .cc .midi-type { color: #ffd93d; }
        .pitchbend .midi-type { color: #c792ea; }
        .clock .midi-type { color: #666; }
        .active .midi-type { color: #333; }
        .reset .midi-type { color: #ff0000; }
    </style>
</head>
<body>
    <h2>MIDI Activity</h2>
    <div class="midi-container">
        <div id="midi-activity-content">
            <div class="midi-empty">No MIDI activity yet...</div>
        </div>
    </div>
    <script>
        // Auto-refresh display
        setInterval(() => {
            if (window.opener && window.opener.updateMIDIMonitorDisplay) {
                window.opener.updateMIDIMonitorDisplay();
            }
        }, 100);
    </script>
</body>
</html>`);
        
        win.document.close();
        
        // Start update interval
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(() => {
            if (monitorWindow && !monitorWindow.closed) {
                updateMonitorDisplay();
            } else {
                clearInterval(updateInterval);
                updateInterval = null;
            }
        }, 100);
        
        return win;
    }

    function updateMIDIMonitorDisplay() {
        updateMonitorDisplay();
    }

    // Hook into MIDI input if available
    function initMIDIActivityMonitor() {
        if (typeof MIDI === 'undefined' && typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess({ sysex: false }).then((midiAccess) => {
                midiAccess.inputs.forEach((input) => {
                    input.onmidimessage = (event) => {
                        const [status, d1, d2] = event.data;
                        const type = status & 0xf0;
                        const channel = status & 0x0f;
                        
                        switch (type) {
                            case 0x90: // Note On
                                logActivity(d2 > 0 ? 'noteon' : 'noteoff', channel, d1, d2);
                                break;
                            case 0x80: // Note Off
                                logActivity('noteoff', channel, d1, d2);
                                break;
                            case 0xb0: // Control Change
                                logActivity('cc', channel, d1, d2);
                                break;
                            case 0xe0: // Pitch Bend
                                logActivity('pitchbend', channel, d1, d2);
                                break;
                            case 0xf8: // Clock
                                logActivity('clock', channel, d1, d2);
                                break;
                            case 0xfe: // Active Sensing
                                logActivity('active', channel, d1, d2);
                                break;
                            case 0xff: // Reset
                                logActivity('reset', channel, d1, d2);
                                break;
                        }
                    };
                });
            }).catch((err) => {
                console.warn('MIDI Access denied:', err);
            });
        }
    }

    // Manual activity logging (for integration with other MIDI handlers)
    function logMIDIActivity(type, channel, data1, data2) {
        logActivity(type, channel, data1, data2);
    }

    // Get recent activity
    function getRecentActivity(count = 10) {
        return activityBuffer.slice(0, count);
    }

    // Clear activity buffer
    function clearActivity() {
        activityBuffer.length = 0;
        updateMonitorDisplay();
    }

    // Export
    window.MIDIActivityMonitor = {
        open: openMIDIActivityPanel,
        log: logMIDIActivity,
        getRecent: getRecentActivity,
        clear: clearActivity,
        updateDisplay: updateMIDIMonitorDisplay
    };

    // Auto-init when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMIDIActivityMonitor);
    } else {
        initMIDIActivityMonitor();
    }

})();
