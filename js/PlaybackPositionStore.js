// PlaybackPositionStore.js - Remember playback position across page reloads
(function() {
    const STORAGE_KEY = 'snaw_playback_position';
    
    window.PlaybackPositionStore = {
        save: function(position, trackId) {
            try {
                const data = { position, trackId, timestamp: Date.now() };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            } catch(e) {}
        },
        
        get: function() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return null;
                const data = JSON.parse(raw);
                // Expire after 1 hour
                if (Date.now() - data.timestamp > 3600000) {
                    localStorage.removeItem(STORAGE_KEY);
                    return null;
                }
                return data;
            } catch(e) { return null; }
        },
        
        clear: function() {
            try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
        },
        
        restore: function() {
            const data = this.get();
            if (data && typeof data.position === 'number') {
                // Restore position if not playing
                if (!window.TONE_IS_PLAYING) {
                    Tone.Transport.seconds = data.position;
                    updateTimeDisplay();
                    return true;
                }
            }
            return false;
        }
    };
    
    // Auto-save position on stop
    const origStop = window.stopPlayback;
    window.stopPlayback = function() {
        if (typeof Tone !== 'undefined') {
            const pos = Tone.Transport.seconds;
            const trackId = window.currentTrackId || null;
            PlaybackPositionStore.save(pos, trackId);
        }
        if (origStop) return origStop.apply(this, arguments);
    };
})();
