// js/TempoCurveEditor.js - Edit tempo automation curve
export class TempoCurveEditor {
    constructor() {
        this.points = [];
        this.minTempo = 20;
        this.maxTempo = 300;
    }

    addPoint(beatPosition, tempo) {
        const clampedTempo = Math.max(this.minTempo, Math.min(this.maxTempo, tempo));
        this.points.push({
            beat: beatPosition,
            tempo: clampedTempo,
            curve: 'linear'
        });
        this.points.sort((a, b) => a.beat - b.beat);
        return this;
    }

    removePoint(index) {
        if (index >= 0 && index < this.points.length) {
            this.points.splice(index, 1);
        }
    }

    getTempoAt(beatPosition) {
        if (this.points.length === 0) return 120; // default tempo
        if (this.points.length === 1) return this.points[0].tempo;

        for (let i = 0; i < this.points.length - 1; i++) {
            if (beatPosition >= this.points[i].beat && 
                beatPosition <= this.points[i + 1].beat) {
                const t = (beatPosition - this.points[i].beat) / 
                         (this.points[i + 1].beat - this.points[i].beat);
                return this.points[i].tempo + 
                       t * (this.points[i + 1].tempo - this.points[i].tempo);
            }
        }
        return this.points[this.points.length - 1].tempo;
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

export function createTempoCurveEditor() {
    return new TempoCurveEditor();
}