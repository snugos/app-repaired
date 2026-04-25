// js/SpectralFlanger.js - Flanger with frequency-dependent modulation
export class SpectralFlanger extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'SpectralFlanger';

        const defaults = {
            rate: 0.5,
            delayTime: 0.004,
            depth: 1,
            feedback: 0.5,
            lowFreq: 200,
            highFreq: 4000,
            mode: 'through', // through, spectrum, both
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };
        this._params = params;

        // Frequency splitter
        this._lowFilter = new Tone.Filter({
            type: 'lowpass',
            frequency: params.lowFreq,
            Q: 0.5
        });
        this._highFilter = new Tone.Filter({
            type: 'highpass',
            frequency: params.highFreq,
            Q: 0.5
        });

        // Low band flanger
        this._lowDelay = new Tone.FeedbackDelay({
            delayTime: params.delayTime * 2,
            feedback: params.feedback * 0.5,
            wet: 1.0
        });
        this._lowLFO = new Tone.LFO({
            frequency: params.rate * 0.5,
            min: (params.delayTime * 2) * (1 - params.depth),
            max: (params.delayTime * 2) * (1 + params.depth)
        });
        this._lowLFO.connect(this._lowDelay.delayTime);
        this._lowLFO.start();

        // High band flanger (faster modulation)
        this._highDelay = new Tone.FeedbackDelay({
            delayTime: params.delayTime,
            feedback: params.feedback,
            wet: 1.0
        });
        this._highLFO = new Tone.LFO({
            frequency: params.rate * 2,
            min: params.delayTime * (1 - params.depth),
            max: params.delayTime * (1 + params.depth)
        });
        this._highLFO.connect(this._highDelay.delayTime);
        this._highLFO.start();

        // Merger
        this._merger = new Tone.Gain(1.0);

        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        // Low band chain
        this.connect(this._lowFilter);
        this._lowFilter.connect(this._lowDelay);
        this._lowDelay.connect(this._merger);

        // High band chain
        this.connect(this._highFilter);
        this._highFilter.connect(this._highDelay);
        this._highDelay.connect(this._merger);

        this._merger.connect(this._wetGain);
        this.connect(this._dryGain);
        this._dryGain.connect(this);
        this._wetGain.connect(this);
    }

    static getMetronomeAudioLabel() { return 'Spectral Flanger'; }

    setRate(value) {
        this._params.rate = value;
        this._lowLFO.frequency.value = value * 0.5;
        this._highLFO.frequency.value = value * 2;
    }

    setDepth(value) {
        this._params.depth = value;
        const baseLow = this._params.delayTime * 2;
        const baseHigh = this._params.delayTime;
        this._lowLFO.min = baseLow * (1 - value);
        this._lowLFO.max = baseLow * (1 + value);
        this._highLFO.min = baseHigh * (1 - value);
        this._highLFO.max = baseHigh * (1 + value);
    }

    setFeedback(value) {
        this._params.feedback = value;
        this._lowDelay.feedback.value = value * 0.5;
        this._highDelay.feedback.value = value;
    }

    setWet(value) {
        this._params.wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
    }

    dispose() {
        this._lowFilter.dispose();
        this._highFilter.dispose();
        this._lowDelay.dispose();
        this._highDelay.dispose();
        this._lowLFO.dispose();
        this._highLFO.dispose();
        this._merger.dispose();
        this._wetGain.dispose();
        this._dryGain.dispose();
        super.dispose();
    }
}