/**
 * Track Delay Compensation - Automatically compensate for plugin latency per track
 * Allows users to manually adjust delay offset per track to align with master
 */

let trackDelayCompensation = {}; // { trackId: compensationMs }

export function getTrackDelayCompensation(trackId) {
    return trackDelayCompensation[trackId] || 0;
}

export function setTrackDelayCompensation(trackId, compensationMs) {
    const value = parseFloat(compensationMs) || 0;
    trackDelayCompensation[trackId] = Math.max(-500, Math.min(500, value));
    console.log(`[TrackDelayCompensation] Track ${trackId} compensation set to ${value}ms`);
}

export function getAllTrackDelayCompensations() {
    return JSON.parse(JSON.stringify(trackDelayCompensation));
}

export function setAllTrackDelayCompensations(compensations) {
    trackDelayCompensation = JSON.parse(JSON.stringify(compensations || {}));
}

export function clearTrackDelayCompensation(trackId) {
    if (trackId !== undefined) {
        delete trackDelayCompensation[trackId];
    }
}

export function openTrackDelayCompensationPanel() {
    const existingPanel = document.getElementById('trackDelayCompensationPanel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'trackDelayCompensationPanel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1e1e2e;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 20px;
        min-width: 350px;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        color: #ccc;
        font-family: system-ui, sans-serif;
    `;

    const tracks = typeof getTracksState === 'function' ? getTracksState() : [];
    
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
            <h3 style="margin:0;font-size:16px;">Track Delay Compensation</h3>
            <button id="closeDelayPanel" style="background:#333;border:none;color:#fff;padding:5px 10px;cursor:pointer;border-radius:4px;">×</button>
        </div>
        <p style="margin:0 0 15px;font-size:12px;color:#888;">Adjust offset (ms) to align track with master. Range: -500 to +500ms</p>
        <div id="trackDelayList" style="display:flex;flex-direction:column;gap:8px;">
            ${tracks.map(track => {
                const compensation = getTrackDelayCompensation(track.id);
                return `
                <div style="display:flex;align-items:center;gap:10px;padding:8px;background:#2a2a3a;border-radius:4px;">
                    <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${track.name || 'Track ' + track.id}">${track.name || 'Track ' + track.id}</span>
                    <input type="number" 
                        data-track-id="${track.id}" 
                        value="${compensation}" 
                        min="-500" max="500" step="0.1"
                        style="width:80px;padding:5px;background:#333;border:1px solid #555;color:#fff;border-radius:4px;text-align:center;"
                        onchange="if(window.updateTrackDelayCompensation)window.updateTrackDelayCompensation(${track.id},this.value)">
                    <span style="color:#888;font-size:12px;">ms</span>
                </div>`;
            }).join('')}
        </div>
        ${tracks.length === 0 ? '<p style="text-align:center;color:#666;padding:20px;">No tracks available</p>' : ''}
    `;

    document.body.appendChild(panel);

    // Global handler for input changes
    window.updateTrackDelayCompensation = (trackId, value) => {
        setTrackDelayCompensation(trackId, parseFloat(value));
    };

    document.getElementById('closeDelayPanel').onclick = () => panel.remove();
    panel.onclick = (e) => { if (e.target === panel) panel.remove(); };
}

console.log('[TrackDelayCompensation] Module loaded');