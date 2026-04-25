// js/FrequencyIsolator.js - Isolate specific frequency ranges for analysis
export class FrequencyIsolator extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'FrequencyIsolator';

        const defaults = {
            lowFreq: 250,
            highFreq: 4000,
            mode: 'bandpass', // bandpass, lowpass, highpass, notch
            q: 5,
            gain: 1.0,
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };
        this._params = params;

        this._filter = new Tone.Filter({
            type: params.mode,
            frequency: (params.lowFreq + params.highFreq) / 2,
            Q: params.q
        });

        this._gainNode = new Tone.Gain(params.gain);
        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        this.connect(this._filter);
        this._filter.connect(this._gainNode);
        this._gainNode.connect(this._wetGain);
        this.connect(this._dryGain);
        this._dryGain.connect(this);
        this._wetGain.connect(this);
    }

    static getMetronomeAudioLabel() { return 'Frequency Isolator'; }

    setLowFreq(value) {
        this._params.lowFreq = value;
        this._updateFrequency();
    }

    setHighFreq(value) {
        this._params.highFreq = value;
        this._updateFrequency();
    }

    _updateFrequency() {
        const center = (this._params.lowFreq + this._params.highFreq) / 2;
        this._filter.frequency.value = center;
    }

    setMode(value) {
        this._params.mode = value;
        this._filter.type = value;
    }

    setQ(value) {
        this._params.q = value;
        this._filter.Q.value = value;
    }

    setGain(value) {
        this._params.gain = value;
        this._gainNode.gain.value = value;
    }

    setWet(value) {
        this._params.wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
    }

    dispose() {
        this._filter.dispose();
        this._gainNode.dispose();
        this._wetGain.dispose();
        this._dryGain.dispose();
        super.dispose();
    }
}