// AudioLimiter.js - Brick-wall limiter for master bus protection
class AudioLimiter extends Tone.Limiter {
    constructor() {
        super(Tone.context.sampleRate);
        this.channelCount = 1;
    }
    static getEffectDescription() {
        return {
            type: 'Limiter',
            description: 'Brick-wall limiter for master bus protection',
            parameters: [
                { name: 'threshold', label: 'Threshold', type: 'float', defaultValue: -0.1, minValue: -24, maxValue: 0, unit: 'dB', automatable: true },
                { name: 'release', label: 'Release', type: 'float', defaultValue: 0.3, minValue: 0.01, maxValue: 1, unit: 's', automatable: true }
            ]
        };
    }
    getParameter(valueName) {
        switch (valueName) {
            case 'threshold': return this.threshold;
            case 'release': return this.release;
            default: return null;
        }
    }
    setParameter(valueName, value) {
        switch (valueName) {
            case 'threshold': this.threshold.value = value; break;
            case 'release': this.release.value = value; break;
        }
    }
}
if (typeof window !== 'undefined') window.AudioLimiter = AudioLimiter;
export default AudioLimiter;
