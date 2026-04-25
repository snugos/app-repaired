// js/AutoPanSync.js - Pan automation synced to tempo
export class AutoPanSync extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'AutoPanSync';

        const defaults = {
            rate: 4, // beats per cycle
            waveform: 'sine', // sine, triangle, square, saw
            depth: 0.5, // 0-1 pan depth
            offset: 0, // phase offset in degrees
            syncToTempo: true,
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };
        this._params = params;

        this._panner = new Tone.Panner(0);
        this._lfo = new Tone.LFO({
            frequency: params.rate,
            min: -params.depth,
            max: params.depth,
            type: params.waveform
        });

        this._lfo.start();
        this._lfo.connect(this._panner.pan);

        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        this.connect(this._panner);
        this._panner.connect(this._wetGain);
        this.connect(this._dryGain);
        this._dryGain.connect(this);
        this._wetGain.connect(this);
    }

    static getMetronomeAudioLabel() { return 'Auto Pan Sync'; }

    setRate(value) {
        this._params.rate = value;
        this._lfo.frequency.value = value;
    }

    setDepth(value) {
        this._params.depth = value;
        this._lfo.min = -value;
        this._lfo.max = value;
    }

    setWaveform(value) {
        this._params.waveform = value;
        this._lfo.type = value;
    }

    setOffset(value) {
        this._params.offset = value;
        // Phase offset adjustment
    }

    setWet(value) {
        this._params.wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
    }

    dispose() {
        this._panner.dispose();
        this._lfo.dispose();
        this._wetGain.dispose();
        this._dryGain.dispose();
        super.dispose();
    }
}