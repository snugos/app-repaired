// js/SidechainGate.js - Gate that responds to sidechain input
export class SidechainGate extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'SidechainGate';

        const defaults = {
            threshold: -24, // dB
            attack: 0.001, // seconds
            release: 0.1, // seconds
            hold: 0.05, // seconds
            ratio: 100, // high ratio for gate-like behavior
            lookahead: 0.005, // seconds
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };
        this._params = params;

        this._sidechainInput = new Tone.Gain(1.0);

        this._keyFilter = new Tone.Filter({
            type: 'lowpass',
            frequency: 1000,
            Q: 0.5
        });

        this._keyGain = new Tone.Gain(1.0);

        // Gate using compressor-like behavior
        this._gate = new Tone.Compressor({
            threshold: params.threshold,
            ratio: params.ratio,
            attack: params.attack,
            release: params.release
        });

        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        // Sidechain chain
        this._sidechainInput.connect(this._keyFilter);
        this._keyFilter.connect(this._keyGain);
        this._keyGain.connect(this._gate, 0, 1);

        // Audio path
        this.connect(this._gate);
        this._gate.connect(this._wetGain);
        this.connect(this._dryGain);
        this._dryGain.connect(this);
        this._wetGain.connect(this);
    }

    static getMetronomeAudioLabel() { return 'Sidechain Gate'; }

    connectSidechain(source) {
        source.connect(this._sidechainInput);
    }

    setThreshold(value) {
        this._params.threshold = value;
        this._gate.threshold.value = value;
    }

    setAttack(value) {
        this._params.attack = value;
        this._gate.attack.value = value;
    }

    setRelease(value) {
        this._params.release = value;
        this._gate.release.value = value;
    }

    setWet(value) {
        this._params.wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
    }

    dispose() {
        this._sidechainInput.dispose();
        this._keyFilter.dispose();
        this._keyGain.dispose();
        this._gate.dispose();
        this._wetGain.dispose();
        this._dryGain.dispose();
        super.dispose();
    }
}