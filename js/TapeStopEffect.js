// js/TapeStopEffect.js - Realistic tape slowdown and stop effect
export class TapeStopEffect extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'TapeStopEffect';

        const defaults = {
            rampTime: 2.0,
            stopDepth: 0.0,
            tapeWow: 0.02,
            tapeFlutter: 0.01,
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };
        this._params = params;

        // Speed control via playbackRate
        this._tape = new Tone.Player(null);
        this._tape.loop = true;

        // LFO for wow (slow pitch modulation)
        this._wowLFO = new Tone.LFO({
            frequency: params.tapeWow * 10,
            min: 1 - params.tapeWow,
            max: 1 + params.tapeWow
        });

        // LFO for flutter (faster modulation)
        this._flutterLFO = new Tone.LFO({
            frequency: params.tapeFlutter * 100,
            min: 1 - params.tapeFlutter,
            max: 1 + params.tapeFlutter
        });

        this._wowLFO.start();
        this._flutterLFO.start();

        // Wet/dry
        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        // Dry path
        this.connect(this._dryGain);
        this._dryGain.connect(this);

        this._isStopping = false;
    }

    static getMetronomeAudioLabel() { return 'Tape Stop'; }

    triggerStop() {
        this._isStopping = true;
        const now = Tone.now();
        const ramp = this._params.rampTime;

        // Ramp down playback rate to simulate tape stopping
        const currentRate = this._tape.playbackRate || 1.0;
        this._tape.playbackRate.linearRampToValueAtTime(0.001, now + ramp);
    }

    triggerStart() {
        this._isStopping = false;
        const now = Tone.now();
        const ramp = this._params.rampTime * 0.5;

        // Ramp back up
        this._tape.playbackRate.linearRampToValueAtTime(1.0, now + ramp);
    }

    setWet(value) {
        this._params.wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
    }

    setRampTime(value) {
        this._params.rampTime = value;
    }

    dispose() {
        this._wowLFO.dispose();
        this._flutterLFO.dispose();
        this._wetGain.dispose();
        this._dryGain.dispose();
        this._tape.dispose();
        super.dispose();
    }
}