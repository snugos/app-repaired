// js/ChorusEnsemble.js - Thick chorus effect with multiple delay lines
export class ChorusEnsemble extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'ChorusEnsemble';

        const defaults = {
            rate: 1.5,
            delayTime: 3.5,
            depth: 1,
            feedback: 0,
            spread: 0.5,
            voiceCount: 3,
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };

        this._params = params;

        // Create multiple delay lines for thick chorus
        this._delays = [];
        this._lfos = [];
        this._lfoRates = [];

        const baseDelay = params.delayTime;
        const spread = params.spread;
        const count = Math.max(2, params.voiceCount);

        for (let i = 0; i < count; i++) {
            const delay = new Tone.FeedbackDelay({
                delayTime: baseDelay,
                feedback: params.feedback * 0.5,
                wet: 1.0
            });
            const lfo = new Tone.LFO({
                frequency: params.rate + (i * 0.1 * params.rate),
                min: baseDelay - (depth * baseDelay),
                max: baseDelay + (depth * baseDelay)
            });
            lfo.connect(delay.delayTime);

            const depth = params.depth;
            lfo.min = baseDelay * (1 - depth);
            lfo.max = baseDelay * (1 + depth);

            lfo.start();
            this._delays.push(delay);
            this._lfos.push(lfo);
            this._lfoRates.push(params.rate + (i * 0.05 * params.rate));
        }

        // Wet/dry
        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        // Connect all delays in parallel to wet
        for (const delay of this._delays) {
            delay.connect(this._wetGain);
        }

        // Dry path
        this.connect(this._dryGain);
        this._wetGain.connect(this);
    }

    static getMetronomeAudioLabel() { return 'Chorus Ensemble'; }

    setRate(value) {
        this._params.rate = value;
        this._lfos.forEach((lfo, i) => {
            lfo.frequency.value = value + (i * 0.05 * value);
        });
    }

    setDepth(value) {
        this._params.depth = value;
        const baseDelay = this._params.delayTime;
        this._delays.forEach((delay) => {
            delay.delayTime.value = baseDelay;
        });
    }

    setFeedback(value) {
        this._params.feedback = value;
        this._delays.forEach((delay) => {
            delay.feedback.value = value * 0.5;
        });
    }

    setSpread(value) {
        this._params.spread = value;
        // Adjust delay times for spread
    }

    setWet(value) {
        this._params.wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
    }

    setDelayTime(value) {
        this._params.delayTime = value;
        const depth = this._params.depth;
        this._lfos.forEach((lfo, i) => {
            lfo.min = value * (1 - depth);
            lfo.max = value * (1 + depth);
        });
    }

    dispose() {
        this._delays.forEach(d => d.dispose());
        this._lfos.forEach(l => l.dispose());
        this._wetGain.dispose();
        this._dryGain.dispose();
        super.dispose();
    }
}