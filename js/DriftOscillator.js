// js/DriftOscillator.js - Oscillator with pitch drift for analog feel
export class DriftOscillator extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'DriftOscillator';

        const defaults = {
            baseFrequency: 440,
            oscillatorType: 'sawtooth',
            driftAmount: 0.03,
            driftRate: 0.2,
            driftOctaves: 1,
            filterCutoff: 2000,
            filterResonance: 1,
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };
        this._params = params;

        this._osc = new Tone.Oscillator({
            frequency: params.baseFrequency,
            type: params.oscillatorType
        });
        this._osc.start();

        // Filter for tone shaping
        this._filter = new Tone.Filter({
            type: 'lowpass',
            frequency: params.filterCutoff,
            Q: params.filterResonance
        });

        // Pitch drift LFO (slower for analog feel)
        this._driftLFO = new Tone.LFO({
            frequency: params.driftRate,
            min: -params.driftAmount * params.baseFrequency,
            max: params.driftAmount * params.baseFrequency
        });

        // Secondary drift for more complex character
        this._driftLFO2 = new Tone.LFO({
            frequency: params.driftRate * 3.7,
            min: -params.driftAmount * 0.5 * params.baseFrequency,
            max: params.driftAmount * 0.5 * params.baseFrequency
        });

        this._driftGain = new Tone.Gain(1.0);
        this._driftGain2 = new Tone.Gain(1.0);

        this._driftLFO.connect(this._driftGain.gain);
        this._driftLFO2.connect(this._driftGain2.gain);
        this._driftLFO.start();
        this._driftLFO2.start();

        this._osc.connect(this._filter);
        this._filter.connect(this._driftGain);
        this._filter.connect(this._driftGain2);

        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        this._driftGain.connect(this._wetGain);
        this._driftGain2.connect(this._wetGain);
        this.connect(this._dryGain);
        this._dryGain.connect(this);
        this._wetGain.connect(this);
    }

    static getMetronomeAudioLabel() { return 'Drift Oscillator'; }

    setBaseFrequency(value) {
        this._params.baseFrequency = value;
        this._osc.frequency.value = value;
        this._driftLFO.min = -this._params.driftAmount * value;
        this._driftLFO.max = this._params.driftAmount * value;
        this._driftLFO2.min = -this._params.driftAmount * 0.5 * value;
        this._driftLFO2.max = this._params.driftAmount * 0.5 * value;
    }

    setDriftAmount(value) {
        this._params.driftAmount = value;
        const base = this._params.baseFrequency;
        this._driftLFO.min = -value * base;
        this._driftLFO.max = value * base;
        this._driftLFO2.min = -value * 0.5 * base;
        this._driftLFO2.max = value * 0.5 * base;
    }

    setDriftRate(value) {
        this._params.driftRate = value;
        this._driftLFO.frequency.value = value;
        this._driftLFO2.frequency.value = value * 3.7;
    }

    setWet(value) {
        this._params.wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
    }

    dispose() {
        this._osc.dispose();
        this._filter.dispose();
        this._driftLFO.dispose();
        this._driftLFO2.dispose();
        this._driftGain.dispose();
        this._driftGain2.dispose();
        this._wetGain.dispose();
        this._dryGain.dispose();
        super.dispose();
    }
}