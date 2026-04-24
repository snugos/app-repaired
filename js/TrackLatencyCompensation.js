// TrackLatencyCompensation.js - Per-track automatic latency offset adjustment
class TrackLatencyCompensation {
    constructor(track) {
        this.track = track;
        this.latencyMs = track.latencyOffset || 0;
        this.enabled = true;
    }

    setLatency(ms) {
        this.latencyMs = Math.max(-500, Math.min(500, ms));
        this.track.latencyOffset = this.latencyMs;
        this.applyLatency();
    }

    applyLatency() {
        if (!this.enabled || !this.track.gainNode) return;
        const ms = this.latencyMs;
        if (ms === 0) {
            this.track.gainNode.delayTime.setValueAtTime(0, Tone.now());
        } else {
            const seconds = ms / 1000;
            this.track.gainNode.delayTime.setValueAtTime(Math.abs(seconds), Tone.now());
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled) this.applyLatency();
        else this.track.gainNode?.delayTime.setValueAtTime(0, Tone.now());
        return this.enabled;
    }

    getInfo() {
        return {
            enabled: this.enabled,
            latencyMs: this.latencyMs,
            direction: this.latencyMs > 0 ? 'delayed' : this.latencyMs < 0 ? 'advanced' : 'neutral'
        };
    }
}

window.TrackLatencyCompensation = TrackLatencyCompensation;
