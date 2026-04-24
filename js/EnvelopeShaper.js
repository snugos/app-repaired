// js/EnvelopeShaper.js - Volume and pan envelope automation for clips
export class EnvelopeShaper {
    constructor(clip) {
        this.clip = clip;
        this.points = [];
        this.defaultPoint = { time: 0, value: 1.0, curve: 'linear' };
    }

    addPoint(time, value, curve = 'linear') {
        this.points.push({ time, value, curve });
        this.points.sort((a, b) => a.time - b.time);
        return this;
    }

    removePoint(index) {
        if (index >= 0 && index < this.points.length) {
            this.points.splice(index, 1);
        }
    }

    getValueAt(time) {
        if (this.points.length === 0) return 1.0;
        if (this.points.length === 1) return this.points[0].value;

        for (let i = 0; i < this.points.length - 1; i++) {
            if (time >= this.points[i].time && time <= this.points[i + 1].time) {
                const t = (time - this.points[i].time) / 
                         (this.points[i + 1].time - this.points[i].time);
                return this.points[i].value + 
                       t * (this.points[i + 1].value - this.points[i].value);
            }
        }
        return this.points[this.points.length - 1].value;
    }

    clear() {
        this.points = [];
    }

    toJSON() {
        return JSON.parse(JSON.stringify(this.points));
    }

    fromJSON(data) {
        this.points = data || [];
    }
}

export function createEnvelopeShaper(clip) {
    return new EnvelopeShaper(clip);
}