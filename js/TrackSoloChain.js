// TrackSoloChain.js - Mute all tracks except selected chain of tracks for focused listening
const TrackSoloChain = (function() {
    let soloedTrackIds = new Set();
    let isActive = false;
    let originalMuteStates = new Map();

    function getTracksState() {
        if (typeof tracks !== 'undefined') return tracks;
        return [];
    }

    function saveOriginalMuteStates() {
        originalMuteStates.clear();
        const tracks = getTracksState();
        tracks.forEach(track => {
            if (track && track.id) {
                originalMuteStates.set(track.id, track.muted || false);
            }
        });
    }

    function restoreOriginalMuteStates() {
        const tracks = getTracksState();
        tracks.forEach(track => {
            if (track && track.id && originalMuteStates.has(track.id)) {
                track.muted = originalMuteStates.get(track.id);
                if (track.audioTrack && track.audioTrack.mute !== undefined) {
                    track.audioTrack.mute = track.muted;
                }
            }
        });
        originalMuteStates.clear();
    }

    function enableSoloChain(trackIds) {
        saveOriginalMuteStates();
        soloedTrackIds = new Set(trackIds);
        isActive = true;
        applySoloChain();
    }

    function applySoloChain() {
        const tracks = getTracksState();
        tracks.forEach(track => {
            if (!track || !track.id) return;
            const shouldMute = !soloedTrackIds.has(track.id);
            track.muted = shouldMute;
            if (track.audioTrack && track.audioTrack.mute !== undefined) {
                track.audioTrack.mute = shouldMute;
            }
        });
        updateUI();
    }

    function disableSoloChain() {
        isActive = false;
        restoreOriginalMuteStates();
        soloedTrackIds.clear();
        updateUI();
    }

    function toggleTrackInChain(trackId) {
        if (soloedTrackIds.has(trackId)) {
            soloedTrackIds.delete(trackId);
        } else {
            soloedTrackIds.add(trackId);
        }
        if (isActive) {
            applySoloChain();
        }
    }

    function getSoloedTrackIds() {
        return Array.from(soloedTrackIds);
    }

    function getIsActive() {
        return isActive;
    }

    function clearChain() {
        soloedTrackIds.clear();
        if (isActive) {
            applySoloChain();
        }
        updateUI();
    }

    function updateUI() {
        const statusEl = document.getElementById('soloChainStatus');
        if (statusEl) {
            if (isActive) {
                const count = soloedTrackIds.size;
                statusEl.textContent = `Solo Chain: ${count} track${count !== 1 ? 's' : ''}`;
                statusEl.classList.add('active');
            } else {
                statusEl.textContent = 'Solo Chain: Off';
                statusEl.classList.remove('active');
            }
        }
    }

    function openSoloChainPanel() {
        const existingPanel = document.getElementById('soloChainPanel');
        if (existingPanel) {
            existingPanel.remove();
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'soloChainPanel';
        panel.className = 'floating-panel';
        panel.style.cssText = 'position:fixed;top:80px;right:20px;width:280px;background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:16px;z-index:1000;color:#e0e0e0;font-family:system-ui;font-size:13px;';

        const title = document.createElement('div');
        title.style.cssText = 'font-weight:600;font-size:14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;';
        title.innerHTML = '<span>🎧 Track Solo Chain</span><button id="soloChainClose" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;line-height:1;">×</button>';
        panel.appendChild(title);

        const status = document.createElement('div');
        status.id = 'soloChainStatus';
        status.style.cssText = 'font-size:12px;color:#888;margin-bottom:12px;';
        panel.appendChild(status);

        const trackList = document.createElement('div');
        trackList.style.cssText = 'max-height:300px;overflow-y:auto;';
        const tracks = getTracksState();
        tracks.forEach(track => {
            if (!track || !track.id) return;
            const isSoloed = soloedTrackIds.has(track.id);
            const trackItem = document.createElement('div');
            trackItem.style.cssText = 'display:flex;align-items:center;padding:6px 0;border-bottom:1px solid #2a2a3e;cursor:pointer;';
            trackItem.innerHTML = `
                <input type="checkbox" ${isSoloed ? 'checked' : ''} data-track-id="${track.id}" 
                    style="margin-right:8px;cursor:pointer;">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${track.name || 'Track ' + track.id}</span>
                <span style="color:#666;font-size:11px;">${track.type || 'audio'}</span>
            `;
            trackItem.querySelector('input').addEventListener('change', (e) => {
                e.stopPropagation();
                toggleTrackInChain(track.id);
            });
            trackList.appendChild(trackItem);
        });
        panel.appendChild(trackList);

        const buttonRow = document.createElement('div');
        buttonRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;';
        buttonRow.innerHTML = `
            <button id="soloChainEnable" style="flex:1;padding:8px;background:#4a4a6a;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">
                ${isActive ? 'Update Chain' : 'Enable Chain'}
            </button>
            <button id="soloChainDisable" style="flex:1;padding:8px;background:#3a3a5a;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:12px;">
                Disable
            </button>
            <button id="soloChainClear" style="flex:1;padding:8px;background:#2a2a4a;border:none;border-radius:4px;color:#888;cursor:pointer;font-size:12px;">
                Clear
            </button>
        `;
        panel.appendChild(buttonRow);

        document.body.appendChild(panel);

        document.getElementById('soloChainClose').onclick = () => panel.remove();
        document.getElementById('soloChainEnable').onclick = () => {
            if (soloedTrackIds.size > 0) {
                enableSoloChain(Array.from(soloedTrackIds));
            }
        };
        document.getElementById('soloChainDisable').onclick = disableSoloChain;
        document.getElementById('soloChainClear').onclick = clearChain;

        updateUI();
    }

    if (typeof window !== 'undefined') {
        window.openSoloChainPanel = openSoloChainPanel;
        window.trackSoloChain = {
            enableSoloChain,
            disableSoloChain,
            toggleTrackInChain,
            getSoloedTrackIds,
            getIsActive,
            clearChain
        };
    }

    return {
        openSoloChainPanel,
        enableSoloChain,
        disableSoloChain,
        toggleTrackInChain,
        getSoloedTrackIds,
        getIsActive,
        clearChain
    };
})();
