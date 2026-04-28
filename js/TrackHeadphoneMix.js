// Track Headphone Mix - per-track headphone volume separate from main mix

const trackHeadphoneMix = {
    enabled: false,
    trackVolumes: new Map(),

    init() {
        this.restoreState();
    },

    saveState() {
        const state = {};
        this.trackVolumes.forEach((vol, trackId) => {
            state[trackId] = vol;
        });
        localStorage.setItem('snaw_headphone_mix', JSON.stringify(state));
    },

    restoreState() {
        try {
            const saved = localStorage.getItem('snaw_headphone_mix');
            if (saved) {
                const state = JSON.parse(saved);
                Object.keys(state).forEach(trackId => {
                    this.trackVolumes.set(trackId, state[trackId]);
                });
            }
        } catch (e) {
            // ignore
        }
    },

    getVolume(trackId) {
        return this.trackVolumes.get(trackId) ?? 1.0;
    },

    setVolume(trackId, vol) {
        this.trackVolumes.set(trackId, Math.max(0, Math.min(2, vol)));
        this.applyToTrack(trackId);
        this.saveState();
    },

    applyToTrack(trackId) {
        const track = state.tracks.find(t => t.id === trackId);
        if (!track) return;
        const vol = this.getVolume(trackId);
        if (track.instrument && track.instrument.volume) {
            track.instrument.volume.value = vol > 1 ? (vol - 1) * 12 : (vol - 0.5) * -12;
        }
    },

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    },

    isEnabled() {
        return this.enabled;
    },

    resetTrack(trackId) {
        this.trackVolumes.delete(trackId);
        this.applyToTrack(trackId);
        this.saveState();
    },

    resetAll() {
        this.trackVolumes.clear();
        state.tracks.forEach(t => this.applyToTrack(t.id));
        this.saveState();
    },

    openPanel() {
        let panel = document.getElementById('headphone-mix-panel');
        if (panel) {
            panel.remove();
            return;
        }

        panel = document.createElement('div');
        panel.id = 'headphone-mix-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 60px;
            right: 20px;
            width: 280px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 16px;
            z-index: 1000;
            color: #eee;
            font-family: 'Inter', sans-serif;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        const tracksHtml = state.tracks.map(t => {
            const vol = this.getVolume(t.id);
            return `<div style="display:flex;align-items:center;margin-bottom:8px;">
                <span style="width:80px;font-size:12px;overflow:hidden;text-overflow:ellipsis;">${t.name || t.id}</span>
                <input type="range" min="0" max="200" value="${vol*100}" 
                    onchange="trackHeadphoneMix.setVolume('${t.id}', this.value/100)"
                    style="flex:1;margin:0 8px;">
                <span style="width:40px;font-size:11px;text-align:right;">${(vol*100).toFixed(0)}%</span>
            </div>`;
        }).join('');

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <span style="font-weight:600;font-size:14px;">🎧 Headphone Mix</span>
                <button onclick="document.getElementById('headphone-mix-panel').remove()" 
                    style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;">×</button>
            </div>
            <div style="margin-bottom:12px;font-size:11px;color:#888;">Per-track headphone volume (0-200%)</div>
            <div style="max-height:300px;overflow-y:auto;">${tracksHtml}</div>
            <div style="display:flex;gap:8px;margin-top:12px;">
                <button onclick="trackHeadphoneMix.resetAll()" 
                    style="flex:1;padding:6px;background:#333;border:none;color:#aaa;border-radius:4px;cursor:pointer;font-size:11px;">Reset All</button>
                <button onclick="trackHeadphoneMix.toggle();document.getElementById('headphone-mix-panel').remove()" 
                    style="flex:1;padding:6px;background:#4a4a6a;border:none;color:#fff;border-radius:4px;cursor:pointer;font-size:11px;">
                    ${this.enabled ? 'Disable' : 'Enable'}
                </button>
            </div>
        `;

        document.body.appendChild(panel);
    }
};

window.trackHeadphoneMix = trackHeadphoneMix;
window.openHeadphoneMixPanel = () => trackHeadphoneMix.openPanel();