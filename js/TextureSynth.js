// js/TextureSynth.js - Additive synthesizer for textural pads
export class TextureSynth extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);

        this.name = 'TextureSynth';

        const defaults = {
            frequencies: [220, 330, 440, 550, 660],
            amplitudes: [0.5, 0.3, 0.2, 0.1, 0.05],
            phaseOffsets: [0, 30, 60, 90, 120],
            detune: 0,
            shimmer: 0.1,
            noiseAmount: 0.02,
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };
        this._params = params;

        this._oscillators = [];
        this._gains = [];

        // Create oscillators for each partial
        for (let i = 0; i < params.frequencies.length; i++) {
            const osc = new Tone.Oscillator({
                frequency: params.frequencies[i],
                type: 'sine'
            });
            const gain = new Tone.Gain(params.amplitudes[i]);
            osc.connect(gain);
            this._oscillators.push(osc);
            this._gains.push(gain);
            gain.connect(this);
            osc.start();
        }

        // Shimmer LFO
        this._shimmerLFO = new Tone.LFO({
            frequency: 8,
            min: 0,
            max: params.shimmer
        });
        this._shimmerGain = new Tone.Gain(0);
        this._shimmerLFO.connect(this._shimmerGain);
        this._shimmerLFO.start();

        // Noise for texture
        this._noise = new Tone.Noise('pink');
        this._noiseGain = new Tone.Gain(params.noiseAmount);
        this._noise.connect(this._noiseGain);
        this._noiseGain.connect(this);
        this._noise.start();

        this._wetGain = new Tone.Gain(params.wet);
        this._dryGain = new Tone.Gain(1.0 - params.wet);

        this.connect(this._wetGain);
        this._wetGain.connect(this);
    }

    static getMetronomeAudioLabel() { return 'Texture Synth'; }

    setDetune(value) {
        this._params.detune = value;
        this._oscillators.forEach(osc => {
            osc.detune.value = value;
        });
    }

    setShimmer(value) {
        this._params.shimmer = value;
        this._shimmerLFO.max = value;
    }

    setWet(value) {
        this._params.wet = value;
        this._wetGain.gain.value = value;
        this._dryGain.gain.value = 1.0 - value;
    }

    dispose() {
        this._oscillators.forEach(o => o.dispose());
        this._gains.forEach(g => g.dispose());
        this._shimmerLFO.dispose();
        this._shimmerGain.dispose();
        this._noise.dispose();
        this._noiseGain.dispose();
        this._wetGain.dispose();
        this._dryGain.dispose();
        super.dispose();
    }
}