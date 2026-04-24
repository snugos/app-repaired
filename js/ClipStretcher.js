// js/ClipStretcher.js - Time-stretch audio clips without changing pitch
export class ClipStretcher {
    constructor(clip) {
        this.clip = clip;
        this.stretchRatio = 1.0;
        this.mode = 'elastique'; // elastique, peak, resample
        this.preservesPitch = true;
    }

    setStretchRatio(ratio) {
        this.stretchRatio = Math.max(0.25, Math.min(4.0, ratio));
    }

    getStretchRatio() {
        return this.stretchRatio;
    }

    setMode(mode) {
        const validModes = ['elastique', 'peak', 'resample'];
        this.mode = validModes.includes(mode) ? mode : 'elastique';
    }

    getMode() {
        return this.mode;
    }

    setPreservesPitch(preserve) {
        this.preservesPitch = preserve;
    }

    getPreservesPitch() {
        return this.preservesPitch;
    }

    getDurationMultiplier() {
        return 1 / this.stretchRatio;
    }

    previewStretch() {
        const originalDuration = this.clip.getDuration ? 
            this.clip.getDuration() : 1.0;
        return {
            original: originalDuration,
            stretched: originalDuration / this.stretchRatio,
            ratio: this.stretchRatio
        };
    }

    toJSON() {
        return {
            stretchRatio: this.stretchRatio,
            mode: this.mode,
            preservesPitch: this.preservesPitch
        };
    }

    fromJSON(data) {
        if (data) {
            this.stretchRatio = data.stretchRatio || 1.0;
            this.mode = data.mode || 'elastique';
            this.preservesPitch = data.preservesPitch !== false;
        }
    }
}

export function createClipStretcher(clip) {
    return new ClipStretcher(clip);
}