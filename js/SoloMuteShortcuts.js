// js/SoloMuteShortcuts.js - Quick solo/mute panel with keyboard shortcuts
// Provides fast access to solo/mute controls without opening the mixer

(function() {
    const SHORTCUT_PANEL_ID = 'soloMuteShortcutsPanel';
    
    function createPanelHTML() {
        const tracks = getTracksState() || [];
        let html = `<div class="snaw-panel-header">
            <span>Solo/Mute Shortcuts</span>
            <button onclick="closeSoloMuteShortcutsPanel()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">✕</button>
        </div>
        <div class="snaw-panel-content" style="max-height:400px;overflow-y:auto;">
        <div style="margin-bottom:10px;font-size:11px;color:#888;">
            S = Solo | M = Mute | Hold Shift: affect all other tracks
        </div>`;
        
        tracks.forEach((track, idx) => {
            const trackNum = idx + 1;
            const t = track.type || 'Audio';
            const isMidi = t === 'MIDI' || t === 'MIDI Synth';
            html += `<div class="track-row" style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #333;">
                <span style="width:20px;color:#888;font-size:11px;">${trackNum}</span>
                <span style="flex:1;min-width:80px;font-size:12px;" title="${track.name}">${track.name.substring(0, 12)}</span>
                <button onclick="toggleTrackSoloById('${track.id}')" 
                    class="solo-btn" id="solo-btn-${track.id}"
                    style="background:#333;color:#888;border:1px solid #444;padding:2px 8px;cursor:pointer;border-radius:3px;font-size:11px;">S</button>
                <button onclick="toggleTrackMuteById('${track.id}')" 
                    class="mute-btn" id="mute-btn-${track.id}"
                    style="background:#333;color:#888;border:1px solid #444;padding:2px 8px;cursor:pointer;border-radius:3px;font-size:11px;">M</button>
            </div>`;
        });
        
        html += `</div>`;
        return html;
    }
    
    window.openSoloMuteShortcutsPanel = function() {
        let panel = document.getElementById(SHORTCUT_PANEL_ID);
        if (panel) {
            panel.remove();
        }
        
        panel = document.createElement('div');
        panel.id = SHORTCUT_PANEL_ID;
        panel.style.cssText = `
            position: fixed; top: 80px; right: 20px; width: 280px;
            background: #1a1a1a; border: 1px solid #444; border-radius: 8px;
            z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            font-family: system-ui, sans-serif;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            #${SHORTCUT_PANEL_ID} .snaw-panel-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 12px; background: #252525; border-radius: 8px 8px 0 0;
                border-bottom: 1px solid #333; font-size: 13px; font-weight: 600; color: #fff;
            }
            #${SHORTCUT_PANEL_ID} .snaw-panel-content { padding: 10px 12px; }
            #${SHORTCUT_PANEL_ID} .track-row:hover { background: #222; }
            #${SHORTCUT_PANEL_ID} .solo-btn.soloed { background: #f59e0b !important; color: #000 !important; border-color: #f59e0b !important; }
            #${SHORTCUT_PANEL_ID} .mute-btn.muted { background: #ef4444 !important; color: #fff !important; border-color: #ef4444 !important; }
        `;
        document.head.appendChild(style);
        
        panel.innerHTML = createPanelHTML();
        document.body.appendChild(panel);
        
        // Update button states
        updateSoloMuteButtonStates();
    };
    
    window.closeSoloMuteShortcutsPanel = function() {
        const panel = document.getElementById(SHORTCUT_PANEL_ID);
        if (panel) panel.remove();
    };
    
    window.toggleTrackSoloById = function(trackId) {
        const track = findTrackById(trackId);
        if (!track) return;
        const newState = !track.solo;
        setTrackSolo(trackId, newState);
        updateSoloMuteButtonStates();
        saveState();
    };
    
    window.toggleTrackMuteById = function(trackId) {
        const track = findTrackById(trackId);
        if (!track) return;
        const newState = !track.mute;
        setTrackMute(trackId, newState);
        updateSoloMuteButtonStates();
        saveState();
    };
    
    window.updateSoloMuteButtonStates = function() {
        const tracks = getTracksState() || [];
        tracks.forEach(track => {
            const soloBtn = document.getElementById(`solo-btn-${track.id}`);
            const muteBtn = document.getElementById(`mute-btn-${track.id}`);
            if (soloBtn) soloBtn.className = 'solo-btn' + (track.solo ? ' soloed' : '');
            if (muteBtn) muteBtn.className = 'mute-btn' + (track.mute ? ' muted' : '');
        });
    };
    
    // Keyboard shortcuts for solo/mute (when panel is open)
    document.addEventListener('keydown', (e) => {
        const panel = document.getElementById(SHORTCUT_PANEL_ID);
        if (!panel) return;
        
        const focused = document.activeElement;
        if (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA') return;
        
        const tracks = getTracksState() || [];
        const selectedTrackId = getSelectedTrackId();
        
        if (e.key === 's' || e.key === 'S') {
            if (e.shiftKey) {
                // Solo all OTHER tracks
                tracks.forEach(t => {
                    if (t.id !== selectedTrackId) setTrackSolo(t.id, true);
                });
            } else if (selectedTrackId) {
                toggleTrackSoloById(selectedTrackId);
            }
            updateSoloMuteButtonStates();
        }
        
        if (e.key === 'm' || e.key === 'M') {
            if (e.shiftKey) {
                // Mute all OTHER tracks
                tracks.forEach(t => {
                    if (t.id !== selectedTrackId) setTrackMute(t.id, true);
                });
            } else if (selectedTrackId) {
                toggleTrackMuteById(selectedTrackId);
            }
            updateSoloMuteButtonStates();
        }
        
        if (e.key === 'Escape') {
            closeSoloMuteShortcutsPanel();
        }
    });
    
    // Helper functions that should exist in main.js or state.js
    function findTrackById(trackId) {
        const tracks = getTracksState();
        return tracks ? tracks.find(t => t.id === trackId) : null;
    }
    
    function getSelectedTrackId() {
        if (typeof getSelectedTrack === 'function') {
            const sel = getSelectedTrack();
            return sel ? sel.id : null;
        }
        if (typeof selectedTrackId !== 'undefined') return selectedTrackId;
        return null;
    }
    
    function setTrackSolo(trackId, solo) {
        if (typeof setTrackSoloState === 'function') {
            setTrackSoloState(trackId, solo);
        } else if (typeof audio !== 'undefined' && audio.setTrackSolo) {
            audio.setTrackSolo(trackId, solo);
        }
        const track = findTrackById(trackId);
        if (track) track.solo = solo;
    }
    
    function setTrackMute(trackId, mute) {
        if (typeof setTrackMuteState === 'function') {
            setTrackMuteState(trackId, mute);
        } else if (typeof audio !== 'undefined' && audio.setTrackMute) {
            audio.setTrackMute(trackId, mute);
        }
        const track = findTrackById(trackId);
        if (track) track.mute = mute;
    }
    
    function getTracksState() {
        if (typeof tracks !== 'undefined') return tracks;
        if (typeof state !== 'undefined' && state.tracks) return state.tracks;
        return [];
    }
    
    function saveState() {
        if (typeof saveProjectState === 'function') saveProjectState();
        else if (typeof autoSave === 'function') autoSave();
    }
    
    console.log('[SoloMuteShortcuts] Loaded - open with openSoloMuteShortcutsPanel()');
})();
