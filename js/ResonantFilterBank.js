// js/ResonantFilterBank.js - Resonant multi-band filter with per-band drive
export class ResonantFilterBank extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'ResonantFilterBank';

        const defaults = {
            lowFreq: 250,
            midFreq: 1000,
            highFreq: 4000,
            lowGain: 0,
            midGain: 0,
            highGain: 0,
            lowQ: 1,
            midQ: 2,
            highQ: 2,
            lowDrive: 0,
            midDrive: 0,
            highDrive: 0,
            filterType: 'lowpass',
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };

        // Low band: lowpass at lowFreq
        this._lowFilter = new Tone.Filter({
            type: 'lowpass',
            frequency: params.lowFreq,
            Q: params.lowQ
        });
        this._lowGainNode = new Tone.Gain(this.dbToGain(params.lowGain));
        this._lowDrive = new Tone.WaveShaper();
        this._lowDrive.curve = this.makeDistortionCurve(params.lowDrive);
        this._lowDrive.wet.value = params.lowDrive;

        // Mid band: bandpass at midFreq
        this._midFilter = new Tone.Filter({
            type: 'bandpass',
            frequency: params.midFreq,
            Q: params.midQ
        });
        this._midGainNode = new Tone.Gain(this.dbToGain(params.midGain));
        this._midDrive = new Tone.WaveShaper();
        this._midDrive.curve = this.makeDistortionCurve(params.midDrive);
        this._midDrive.wet.value = params.midDrive;

        // High band: highpass at highFreq
        this._highFilter = new Tone.Filter({
            type: 'highpass',
            frequency: params.highFreq,
            Q: params.highQ
        });
        this._highGainNode = new Tone.Gain(this.dbToGain(params.highGain));
        this._highDrive = new Tone.WaveShaper();
        this._highDrive.curve = this.makeDistortionCurve(params.highDrive);
        this._highDrive.wet.value = params.highDrive;

        // Wet/dry
        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        // Input -> Low chain
        this.connect(this._lowFilter);
        this._lowFilter.connect(this._lowDrive);
        this._lowDrive.connect(this._lowGainNode);

        // Input -> Mid chain
        this.connect(this._midFilter);
        this._midFilter.connect(this._midDrive);
        this._midDrive.connect(this._midGainNode);

        // Input -> High chain
        this.connect(this._highFilter);
        this._highFilter.connect(this._highDrive);
        this._highDrive.connect(this._highGainNode);

        // All bands -> wet/dry -> output
        this._lowGainNode.connect(this._wetGain);
        this._midGainNode.connect(this._wetGain);
        this._highGainNode.connect(this._wetGain);

        this._dryGain.connect(this);
        this._wetGain.connect(this);

        this._params = params;
    }

    makeDistortionCurve(amount) {
        if (amount === 0) return null;
        const samples = 256;
        const curve = new Float32Array(samples);
        const k = amount * 50;
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    dbToGain(db) {
        return Math.pow(10, db / 20);
    }

    static getMetronomeAudioLabel() { return 'Resonant Filter Bank'; }

    setLowFreq(value) {
        this._lowFilter.frequency.value = value;
        this._params.lowFreq = value;
    }

    setMidFreq(value) {
        this._midFilter.frequency.value = value;
        this._params.midFreq = value;
    }

    setHighFreq(value) {
        this._highFilter.frequency.value = value;
        this._params.highFreq = value;
    }

    setLowGain(value) {
        this._lowGainNode.gain.value = this.dbToGain(value);
        this._params.lowGain = value;
    }

    setMidGain(value) {
        this._midGainNode.gain.value = this.dbToGain(value);
        this._params.midGain = value;
    }

    setHighGain(value) {
        this._highGainNode.gain.value = this.dbToGain(value);
        this._params.highGain = value;
    }

    setLowQ(value) {
        this._lowFilter.Q.value = value;
        this._params.lowQ = value;
    }

    setMidQ(value) {
        this._midFilter.Q.value = value;
        this._params.midQ = value;
    }

    setHighQ(value) {
        this._highFilter.Q.value = value;
        this._params.highQ = value;
    }

    setLowDrive(value) {
        this._lowDrive.wet.value = value;
        this._lowDrive.curve = this.makeDistortionCurve(value);
        this._params.lowDrive = value;
    }

    setMidDrive(value) {
        this._midDrive.wet.value = value;
        this._midDrive.curve = this.makeDistortionCurve(value);
        this._params.midDrive = value;
    }

    setHighDrive(value) {
        this._highDrive.wet.value = value;
        this._highDrive.curve = this.makeDistortionCurve(value);
        this._params.highDrive = value;
    }

    setWet(value) {
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
        this._params.wet = value;
    }

    dispose() {
        this._lowFilter.dispose();
        this._midFilter.dispose();
        this._highFilter.dispose();
        this._lowGainNode.dispose();
        this._midGainNode.dispose();
        this._highGainNode.dispose();
        this._lowDrive.dispose();
        this._midDrive.dispose();
        this._highDrive.dispose();
        this._wetGain.dispose();
        this._dryGain.dispose();
        super.dispose();
    }
}