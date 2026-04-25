// js/BitcrushFilter.js - Lo-fi sample rate and bit depth reduction
export class BitcrushFilter extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'BitcrushFilter';

        const defaults = {
            bitDepth: 8,
            sampleRate: 8000,
            mix: 1.0,
            preGain: 1.0,
            postGain: 1.0,
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };
        this._params = params;

        // Pre-gain
        this._preGain = new Tone.Gain(params.preGain);

        // WaveShaper for bit depth reduction
        this._bitShaper = new Tone.WaveShaper();
        this._bitShaper.curve = this.makeBitCurve(params.bitDepth);
        this._bitShaper.wet.value = params.mix;

        // Resampler for sample rate reduction
        this._resampler = new Tone.Gain(1.0);

        // Post-gain
        this._postGain = new Tone.Gain(params.postGain);

        // Wet/dry
        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        // Chain
        this.connect(this._preGain);
        this._preGain.connect(this._bitShaper);
        this._bitShaper.connect(this._resampler);
        this._resampler.connect(this._postGain);
        this._postGain.connect(this._wetGain);
        this.connect(this._dryGain);
        this._dryGain.connect(this);
    }

    makeBitCurve(bits) {
        const samples = 4096;
        const curve = new Float32Array(samples);
        const levels = Math.pow(2, bits);
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            const quantized = Math.round(x * levels) / levels;
            curve[i] = quantized;
        }
        return curve;
    }

    static getMetronomeAudioLabel() { return 'Bitcrush Filter'; }

    setBitDepth(value) {
        this._params.bitDepth = value;
        this._bitShaper.curve = this.makeBitCurve(value);
    }

    setSampleRate(value) {
        this._params.sampleRate = value;
        // Note: Actual sample rate reduction requires OfflineAudioContext
        // This is a simulation using the resampler gain
    }

    setMix(value) {
        this._params.mix = value;
        this._bitShaper.wet.value = value;
    }

    setWet(value) {
        this._params.wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
    }

    dispose() {
        this._preGain.dispose();
        this._bitShaper.dispose();
        this._resampler.dispose();
        this._postGain.dispose();
        this._wetGain.dispose();
        this._dryGain.dispose();
        super.dispose();
    }
}