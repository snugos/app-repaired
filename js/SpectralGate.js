// js/SpectralGate.js - Frequency-based gate that only allows sounds within a certain range to pass
export class SpectralGate extends Tone.Gain {
    constructor(initialParams = {}) {
        super(1.0);
        this.name = 'SpectralGate';

        const defaults = {
            lowFreq: 250,
            highFreq: 4000,
            threshold: -40,
            attack: 0.001,
            release: 0.1,
            hold: 0.05,
            ratio: 100,
            wet: 1.0
        };
        const params = { ...defaults, ...initialParams };
        this._params = params;

        this._analyser = new Tone.Analyser('fft', 2048);
        this._fftSize = 2048;
        this._sampleRate = Tone.context.sampleRate;

        this._splitter = new Tone.Splitter(2);
        this._dryGain = new Tone.Gain(1.0 - params.wet);
        this._wetGain = new Tone.Gain(params.wet);

        this._gate = new Tone.Compressor({
            threshold: params.threshold,
            ratio: params.ratio,
            attack: params.attack,
            release: params.release
        });

        this.connect(this._splitter);
        this._splitter.connect(this._gate, 0, 0);
        this._splitter.connect(this._analyser);
        this._gate.connect(this._wetGain);
        this._splitter.connect(this._dryGain, 0, 1);
        this._dryGain.connect(this);
        this._wetGain.connect(this);

        this._isOpen = false;
        this._holdTimer = 0;
        this._lastFreqInRange = false;
        this._envelope = 0;
    }

    static getMetronomeAudioLabel() { return 'Spectral Gate'; }

    _frequencyInRange(freq) {
        return freq >= this._params.lowFreq && freq <= this._params.highFreq;
    }

    _analyzeFrequencyContent() {
        const fftData = this._analyser.getValue();
        const binCount = fftData.length;
        let dominantFreq = 0;
        let maxMagnitude = -Infinity;

        for (let i = 0; i < binCount; i++) {
            const magnitude = fftData[i];
            if (magnitude > maxMagnitude) {
                maxMagnitude = magnitude;
                dominantFreq = (i / binCount) * (this._sampleRate / 2);
            }
        }

        let inRangeEnergy = 0;
        let totalEnergy = 0;
        const lowBin = Math.floor((this._params.lowFreq / (this._sampleRate / 2)) * binCount);
        const highBin = Math.floor((this._params.highFreq / (this._sampleRate / 2)) * binCount);

        for (let i = 0; i < binCount; i++) {
            const magnitude = Math.max(0, fftData[i]);
            totalEnergy += magnitude;
            if (i >= lowBin && i <= highBin) {
                inRangeEnergy += magnitude;
            }
        }

        const ratio = totalEnergy > 0 ? inRangeEnergy / totalEnergy : 0;
        return {
            dominantFreq,
            inRangeRatio: ratio,
            isInRange: this._frequencyInRange(dominantFreq) && ratio > 0.3
        };
    }

    setLowFreq(value) {
        this._params.lowFreq = value;
    }

    setHighFreq(value) {
        this._params.highFreq = value;
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
        this._analyser.dispose();
        this._splitter.dispose();
        this._dryGain.dispose();
        this._wetGain.dispose();
        this._gate.dispose();
        super.dispose();
    }
}