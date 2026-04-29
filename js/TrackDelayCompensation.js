import { getTracksState, getTrackByIdState } from './state.js';

/**
 * Track Delay Compensation - Automatically compensate for plugin latency per track
 * Allows users to manually adjust delay offset per track to align with master
 * Or enable auto-calculation from effect chain
 */

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
        min-width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        color: #ccc;
        font-family: system-ui, sans-serif;
    `;

    const tracks = typeof getTracksState === 'function' ? getTracksState() : [];
    
    const trackRows = tracks.map(track => {
        const delayInfo = track.getDelayCompensationInfo ? track.getDelayCompensationInfo() : { manual: 0, calculated: 0, auto: true, total: 0 };
        const isAuto = delayInfo.auto;
        return `
        <div style="display:flex;flex-direction:column;gap:6px;padding:10px;background:#2a2a3a;border-radius:6px;margin-bottom:8px;" data-track-id="${track.id}">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${track.name || 'Track ' + track.id}">${track.name || 'Track ' + track.id}</span>
                <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888;">
                    <input type="checkbox" 
                        data-track-id="${track.id}" 
                        class="autoDelayCb"
                        ${isAuto ? 'checked' : ''}
                        onchange="window.updateTrackAutoDelay(${track.id}, this.checked)">
                    Auto
                </label>
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#666;">
                <span>Calculated: <span class="calcVal">${delayInfo.calculated.toFixed(1)}</span>ms</span>
                <span>|</span>
                <span>Manual offset: 
                    <input type="number" 
                        data-track-id="${track.id}" 
                        class="manualInput"
                        value="${delayInfo.manual}" 
                        min="-500" max="500" step="0.1"
                        style="width:60px;padding:3px;background:#333;border:1px solid #555;color:#fff;border-radius:3px;text-align:center;"
                        onchange="window.updateTrackManualDelay(${track.id}, this.value)">
                    ms
                </span>
            </div>
            <div style="font-size:11px;color:#4a9eff;">Total: <span class="totalVal">${delayInfo.total.toFixed(1)}</span>ms</div>
        </div>`;
    }).join('');

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
            <h3 style="margin:0;font-size:16px;">Track Delay Compensation</h3>
            <button id="closeDelayPanel" style="background:#333;border:none;color:#fff;padding:5px 10px;cursor:pointer;border-radius:4px;">×</button>
        </div>
        <p style="margin:0 0 15px;font-size:12px;color:#888;">
            Adjust offset (ms) to align track with master. Enable "Auto" to calculate from effect chain latency.
            Range: -500 to +500ms
        </p>
        <div id="trackDelayList">
            ${trackRows}
        </div>
        ${tracks.length === 0 ? '<p style="text-align:center;color:#666;padding:20px;">No tracks available</p>' : ''}
    `;

    document.body.appendChild(panel);

    // Global handler for auto toggle
    window.updateTrackAutoDelay = (trackId, enabled) => {
        const track = typeof getTrackByIdState === 'function' ? getTrackByIdState(trackId) : null;
        if (track && typeof track.setAutoDelayCompensation === 'function') {
            track.setAutoDelayCompensation(enabled);
            // Refresh panel
            openTrackDelayCompensationPanel();
        }
    };

    // Global handler for manual input
    window.updateTrackManualDelay = (trackId, value) => {
        const track = typeof getTrackByIdState === 'function' ? getTrackByIdState(trackId) : null;
        if (track && typeof track.setDelayCompensation === 'function') {
            track.setDelayCompensation(parseFloat(value) || 0);
            // If auto is on, disable it and set manual
            if (track.autoDelayCompensation) {
                track.setAutoDelayCompensation(false);
            }
            // Refresh panel
            openTrackDelayCompensationPanel();
        }
    };

    document.getElementById('closeDelayPanel').onclick = () => panel.remove();
    panel.onclick = (e) => { if (e.target === panel) panel.remove(); };
}

// Initialize: add to start menu
function initDelayCompensationMenu() {
    // Wait for DOM
    if (typeof document === 'undefined') {
        setTimeout(initDelayCompensationMenu, 500);
        return;
    }
    
    const startMenu = document.getElementById('startMenu');
    if (startMenu && !document.getElementById('menuTrackDelayCompensation')) {
        const menuItem = document.createElement('li');
        menuItem.id = 'menuTrackDelayCompensation';
        menuItem.textContent = 'Track Delay Compensation';
        menuItem.addEventListener('click', () => {
            if (startMenu) startMenu.classList.add('hidden');
            openTrackDelayCompensationPanel();
        });
        
        // Insert near the end, before any separator or at end
        const lastItem = startMenu.lastElementChild;
        if (lastItem && lastItem.id !== 'menuDividerDelay') {
            const divider = document.createElement('li');
            divider.id = 'menuDividerDelay';
            divider.style.cssText = 'border-top: 1px solid #444; margin: 4px 0;';
            startMenu.appendChild(divider);
        }
        startMenu.appendChild(menuItem);
        console.log('[TrackDelayCompensation] Added to start menu');
    }
}

// Try to init after DOM ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDelayCompensationMenu);
    } else {
        setTimeout(initDelayCompensationMenu, 300);
    }
}

console.log('[TrackDelayCompensation] Module loaded');
