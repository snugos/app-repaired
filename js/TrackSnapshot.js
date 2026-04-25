// js/TrackSnapshot.js - Track State Snapshot System
// Save and restore complete track states including volume, pan, mute, solo, effects, and clip arrangement

import { getTrack } from './state.js';

export class TrackSnapshot {
    constructor(trackId) {
        this.trackId = trackId;
        this.timestamp = Date.now();
        this.trackState = null;
    }

    capture() {
        const track = getTrack(this.trackId);
        if (!track) return null;

        this.trackState = {
            id: track.id,
            name: track.name,
            type: track.type,
            volume: track.volume ?? 0,
            pan: track.pan ?? 0,
            mute: track.mute ?? false,
            solo: track.solo ?? false,
            armed: track.armed ?? false,
            color: track.color ?? '#888888',
            effects: this.captureEffectChain(track),
            clips: this.captureClips(track),
            automation: this.captureAutomation(track),
            properties: { ...track }
        };

        return this;
    }

    captureEffectChain(track) {
        const effects = [];
        if (track.effects && Array.isArray(track.effects)) {
            track.effects.forEach(effect => {
                effects.push({
                    type: effect.type,
                    enabled: effect.enabled ?? true,
                    params: effect.params ? { ...effect.params } : {}
                });
            });
        }
        return effects;
    }

    captureClips(track) {
        const clips = [];
        if (track.clips && Array.isArray(track.clips)) {
            track.clips.forEach(clip => {
                clips.push({
                    id: clip.id,
                    name: clip.name,
                    startTime: clip.startTime ?? 0,
                    duration: clip.duration ?? 0,
                    offset: clip.offset ?? 0,
                    gain: clip.gain ?? 1,
                    fadeIn: clip.fadeIn ?? 0,
                    fadeOut: clip.fadeOut ?? 0
                });
            });
        }
        return clips;
    }

    captureAutomation(track) {
        const automation = {};
        if (track.automation) {
            Object.keys(track.automation).forEach(param => {
                automation[param] = track.automation[param] ? [...track.automation[param]] : [];
            });
        }
        return automation;
    }

    restore(targetTrackId = this.trackId) {
        const track = getTrack(targetTrackId);
        if (!track || !this.trackState) return false;

        track.volume = this.trackState.volume;
        track.pan = this.trackState.pan;
        track.mute = this.trackState.mute;
        track.solo = this.trackState.solo;
        track.armed = this.trackState.armed;
        track.color = this.trackState.color;

        this.restoreEffectChain(track);
        this.restoreClips(track);
        this.restoreAutomation(track);

        return true;
    }

    restoreEffectChain(track) {
        track.effects = [];
        if (this.trackState.effects) {
            this.trackState.effects.forEach(effectData => {
                if (window.APP_SERVICES?.addEffectToTrack) {
                    window.APP_SERVICES.addEffectToTrack(track.id, effectData.type, effectData.params);
                }
            });
        }
    }

    restoreClips(track) {
        track.clips = (this.trackState.clips || []).map(clipData => ({
            ...clipData
        }));
    }

    restoreAutomation(track) {
        track.automation = {};
        if (this.trackState.automation) {
            Object.keys(this.trackState.automation).forEach(param => {
                track.automation[param] = [...this.trackState.automation[param]];
            });
        }
    }

    toJSON() {
        return {
            trackId: this.trackId,
            timestamp: this.timestamp,
            trackState: this.trackState
        };
    }

    static fromJSON(data) {
        const snapshot = new TrackSnapshot(data.trackId);
        snapshot.timestamp = data.timestamp;
        snapshot.trackState = data.trackState;
        return snapshot;
    }
}

// Snapshot Manager - handles storing and retrieving multiple snapshots
class SnapshotManager {
    constructor() {
        this.snapshots = new Map();
        this.maxSnapshotsPerTrack = 10;
    }

    capture(trackId) {
        const snapshot = new TrackSnapshot(trackId).capture();
        if (!snapshot) return null;

        if (!this.snapshots.has(trackId)) {
            this.snapshots.set(trackId, []);
        }

        const trackSnapshots = this.snapshots.get(trackId);
        trackSnapshots.unshift(snapshot);

        if (trackSnapshots.length > this.maxSnapshotsPerTrack) {
            trackSnapshots.pop();
        }

        return snapshot;
    }

    restore(trackId, index = 0) {
        const trackSnapshots = this.snapshots.get(trackId);
        if (!trackSnapshots || trackSnapshots.length <= index) return false;

        return trackSnapshots[index].restore();
    }

    getSnapshots(trackId) {
        return this.snapshots.get(trackId) || [];
    }

    clear(trackId) {
        if (trackId) {
            this.snapshots.delete(trackId);
        } else {
            this.snapshots.clear();
        }
    }
}

export const snapshotManager = new SnapshotManager();

export function captureTrackSnapshot(trackId) {
    return snapshotManager.capture(trackId);
}

export function restoreTrackSnapshot(trackId, index = 0) {
    return snapshotManager.restore(trackId, index);
}

export function getTrackSnapshots(trackId) {
    return snapshotManager.getSnapshots(trackId);
}