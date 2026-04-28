// js/TrackDelayCompensation.js - Track Delay Compensation Panel

let trackDelayCompensationPanel = null;

function initTrackDelayCompensation() {
    // Create panel
    trackDelayCompensationPanel = document.createElement('div');
    trackDelayCompensationPanel.id = 'trackDelayCompensationPanel';
    trackDelayCompensationPanel.className = 'snaw-panel';
    trackDelayCompensationPanel.style.cssText = `
        display: none;
        position: fixed;
        top: 80px;
        right: 20px;
        width: 320px;
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 16px;
        z-index: 1001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        color: #ddd;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;

    trackDelayCompensationPanel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <span style="font-weight:600;font-size:14px;">Track Delay Compensation</span>
            <button id="closeTrackDelayCompensationPanel" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;line-height:1;">&times;</button>
        </div>
        <div id="trackDelayCompensationContent">
            <div style="color:#888;margin-bottom:8px;">Select a track to adjust its delay compensation.</div>
        </div>
    `;

    document.body.appendChild(trackDelayCompensationPanel);

    document.getElementById('closeTrackDelayCompensationPanel').addEventListener('click', closeTrackDelayCompensationPanel);

    console.log('[TrackDelayCompensation] Initialized');
}

function openTrackDelayCompensationPanel() {
    if (!trackDelayCompensationPanel) initTrackDelayCompensation();
    trackDelayCompensationPanel.style.display = 'block';
    refreshTrackDelayCompensationContent();
}

function closeTrackDelayCompensationPanel() {
    if (trackDelayCompensationPanel) trackDelayCompensationPanel.style.display = 'none';
}

function toggleTrackDelayCompensationPanel() {
    if (!trackDelayCompensationPanel) initTrackDelayCompensation();
    if (trackDelayCompensationPanel.style.display === 'none') {
        openTrackDelayCompensationPanel();
    } else {
        closeTrackDelayCompensationPanel();
    }
}

function refreshTrackDelayCompensationContent() {
    const content = document.getElementById('trackDelayCompensationContent');
    if (!content) return;

    const tracks = getTracksState();
    if (!tracks || tracks.length === 0) {
        content.innerHTML = '<div style="color:#888;">No tracks available.</div>';
        return;
    }

    const selectedTrack = window.selectedTrackId ? tracks.find(t => t.id === window.selectedTrackId) : tracks[0];

    let html = '<div style="margin-bottom:12px;"><label style="color:#888;font-size:11px;">SELECT TRACK</label><br>';
    html += '<select id="delayCompTrackSelect" style="width:100%;margin-top:4px;padding:6px;background:#2a2a2a;border:1px solid #444;color:#ddd;border-radius:4px;">';
    tracks.forEach(t => {
        const sel = t.id === (selectedTrack?.id || tracks[0].id) ? 'selected' : '';
        html += `<option value="${t.id}" ${sel}>${t.name || 'Track ' + t.id}</option>`;
    });
    html += '</select></div>';

    const track = selectedTrack || tracks[0];
    const currentMs = track?.delayCompensationMs || 0;

    html += '<div style="margin-bottom:12px;"><label style="color:#888;font-size:11px;">DELAY (ms)</label>';
    html += `<div style="display:flex;align-items:center;gap:8px;margin-top:4px;">`;
    html += `<input type="number" id="delayCompMsInput" value="${currentMs}" min="-500" max="500" step="1" style="flex:1;padding:6px;background:#2a2a2a;border:1px solid #444;color:#ddd;border-radius:4px;">`;
    html += `<span style="color:#666;">ms</span></div>`;
    html += `<div style="display:flex;gap:4px;margin-top:6px;">`;
    html += `<button id="delayCompApplyBtn" style="flex:1;padding:6px;background:#4a9eff;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">Apply</button>`;
    html += `<button id="delayCompResetBtn" style="flex:1;padding:6px;background:#333;border:none;border-radius:4px;color:#ddd;cursor:pointer;font-size:12px;">Reset</button>`;
    html += `</div></div>`;

    html += '<div style="color:#666;font-size:11px;">Adjust per-track delay for phase alignment. Range: -500ms to +500ms.</div>';

    content.innerHTML = html;

    document.getElementById('delayCompTrackSelect').addEventListener('change', refreshTrackDelayCompensationContent);
    document.getElementById('delayCompApplyBtn').addEventListener('click', applyTrackDelayCompensation);
    document.getElementById('delayCompResetBtn').addEventListener('click', resetTrackDelayCompensation);
}

function applyTrackDelayCompensation() {
    const trackSelect = document.getElementById('delayCompTrackSelect');
    const msInput = document.getElementById('delayCompMsInput');
    if (!trackSelect || !msInput) return;

    const trackId = trackSelect.value;
    const ms = parseFloat(msInput.value) || 0;

    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    if (track && typeof track.setDelayCompensation === 'function') {
        track.setDelayCompensation(ms);
        saveState();
        showNotification(`Track "${track.name}" delay set to ${ms}ms`);
    }
}

function resetTrackDelayCompensation() {
    const trackSelect = document.getElementById('delayCompTrackSelect');
    if (!trackSelect) return;

    const trackId = trackSelect.value;
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    if (track && typeof track.setDelayCompensation === 'function') {
        track.setDelayCompensation(0);
        saveState();
        if (document.getElementById('delayCompMsInput')) {
            document.getElementById('delayCompMsInput').value = 0;
        }
        showNotification(`Track "${track.name}" delay reset to 0ms`);
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrackDelayCompensation);
} else {
    initTrackDelayCompensation();
}

window.openTrackDelayCompensationPanel = openTrackDelayCompensationPanel;
window.closeTrackDelayCompensationPanel = closeTrackDelayCompensationPanel;
window.toggleTrackDelayCompensationPanel = toggleTrackDelayCompensationPanel;
