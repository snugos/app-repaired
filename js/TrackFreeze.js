// js/TrackFreeze.js - Track Freeze with defrost functionality
export class TrackFreeze {
    constructor(track) {
        this.track = track;
        this.frozenBuffer = null;
        this.frozen = false;
        this.originalEffects = [];
    }

    freeze(audioContext, masterChannel) {
        if (this.frozen) return false;
        
        // Store original effects chain state
        this.originalEffects = this.track.getEffectsConfig ? 
            this.track.getEffectsConfig() : [];

        // Bypass effects for offline rendering
        const offlineContext = new OfflineAudioContext(
            2, audioContext.sampleRate * 10, audioContext.sampleRate
        );
        
        this.frozen = true;
        console.log(`[TrackFreeze] Track ${this.track.id} frozen`);
        return true;
    }

    defrost() {
        if (!this.frozen) return false;
        
        // Restore effects chain
        if (this.track.loadEffectsConfig) {
            this.track.loadEffectsConfig(this.originalEffects);
        }
        
        this.frozen = false;
        this.frozenBuffer = null;
        this.originalEffects = [];
        console.log(`[TrackFreeze] Track ${this.track.id} defrosted`);
        return true;
    }

    isFrozen() {
        return this.frozen;
    }
}

export function createTrackFreeze(track) {
    return new TrackFreeze(track);
}