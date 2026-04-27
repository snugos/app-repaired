/**
 * TransportMemory.js - Remember and restore transport position, loop region, and tempo
 * Saves state to localStorage on page unload, restores on load
 */

const TransportMemory = {
    STORAGE_KEY: 'snaw_transport_memory',
    isEnabled: true,

    init() {
        if (typeof Tone === 'undefined' || !Tone.Transport) {
            console.warn('[TransportMemory] Tone.Transport not available');
            return;
        }

        // Restore on load
        this.restore();

        // Save on page unload
        window.addEventListener('beforeunload', () => {
            if (this.isEnabled) {
                this.save();
            }
        });

        // Auto-save every 5 seconds during playback
        setInterval(() => {
            if (this.isEnabled && Tone.Transport.state === 'started') {
                this.save();
            }
        }, 5000);

        console.log('[TransportMemory] Initialized - transport state will be remembered');
    },

    save() {
        try {
            const data = {
                tempo: Tone.Transport.bpm.value,
                position: Tone.Transport.position,
                seconds: Tone.Transport.seconds,
                loopStart: Tone.Transport.loop ? Tone.Transport.loopStart : 0,
                loopEnd: Tone.Transport.loop ? Tone.Transport.loopEnd : 16,
                loopEnabled: Tone.Transport.loop || false,
                timeSignature: {
                    ticksPerBeat: Tone.Transport.ticksPerBeat,
                    timeSignature: Tone.Transport.timeSignature
                },
                timestamp: Date.now()
            };

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('[TransportMemory] Save failed:', e);
        }
    },

    restore() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return false;

            const data = JSON.parse(stored);
            if (!data || typeof data !== 'object') return false;

            const wasPlaying = Tone.Transport.state === 'started';
            if (wasPlaying) {
                Tone.Transport.pause();
            }

            // Restore tempo
            if (typeof data.tempo === 'number' && data.tempo > 0) {
                Tone.Transport.bpm.value = data.tempo;
                // Update UI if available
                const tempoInput = document.getElementById('tempoGlobalInput');
                if (tempoInput) tempoInput.value = data.tempo;
            }

            // Restore position
            if (typeof data.seconds === 'number' && data.seconds >= 0) {
                Tone.Transport.seconds = data.seconds;
            }

            // Restore loop region
            if (data.loopEnabled) {
                Tone.Transport.loop = true;
                Tone.Transport.loopStart = data.loopStart || 0;
                Tone.Transport.loopEnd = data.loopEnd || 16;

                // Update UI
                const loopToggle = document.getElementById('loopToggleBtnGlobal');
                if (loopToggle) loopToggle.textContent = 'Loop: On';

                const loopStartInput = document.getElementById('loopStartInput');
                if (loopStartInput) loopStartInput.value = data.loopStart || 0;

                const loopEndInput = document.getElementById('loopEndInput');
                if (loopEndInput) loopEndInput.value = data.loopEnd || 16;
            }

            // Clear stale data older than 24 hours
            if (data.timestamp && Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(this.STORAGE_KEY);
                console.log('[TransportMemory] Cleared stale transport memory');
                return false;
            }

            console.log('[TransportMemory] Restored:', {
                tempo: data.tempo,
                seconds: data.seconds,
                loop: data.loopEnabled,
                loopStart: data.loopStart,
                loopEnd: data.loopEnd
            });

            return true;
        } catch (e) {
            console.warn('[TransportMemory] Restore failed:', e);
            return false;
        }
    },

    clear() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            console.log('[TransportMemory] Cleared saved state');
        } catch (e) {
            console.warn('[TransportMemory] Clear failed:', e);
        }
    },

    enable() {
        this.isEnabled = true;
    },

    disable() {
        this.isEnabled = false;
    },

    getLastSavedInfo() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) return null;
            const data = JSON.parse(stored);
            return {
                tempo: data.tempo,
                seconds: data.seconds,
                loopEnabled: data.loopEnabled,
                loopStart: data.loopStart,
                loopEnd: data.loopEnd,
                savedAt: data.timestamp ? new Date(data.timestamp) : null,
                msAgo: data.timestamp ? Date.now() - data.timestamp : null
            };
        } catch {
            return null;
        }
    }
};

window.TransportMemory = TransportMemory;
