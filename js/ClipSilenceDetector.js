// ClipSilenceDetector.js - Detects and marks silent regions in audio clips
// Part of SnugOS DAW

export class ClipSilenceDetector {
    constructor() {
        this.threshold = -60; // dB threshold for silence
        this.minSilenceDuration = 0.5; // seconds
    }

    setThreshold(db) {
        this.threshold = db;
    }

    setMinSilenceDuration(seconds) {
        this.minSilenceDuration = seconds;
    }

    analyzeClip(audioBuffer) {
        if (!audioBuffer || !audioBuffer.getChannelData) {
            return { silentRegions: [], totalSilence: 0, percentSilence: 0 };
        }

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const samples = channelData.length;
        const thresholdLinear = Math.pow(10, this.threshold / 20);

        const silentRegions = [];
        let inSilence = false;
        let silenceStart = 0;
        let silenceEnd = 0;

        const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
        let i = 0;

        while (i < samples) {
            let maxVal = 0;
            const end = Math.min(i + windowSize, samples);
            for (let j = i; j < end; j++) {
                const absVal = Math.abs(channelData[j]);
                if (absVal > maxVal) maxVal = absVal;
            }

            const rms = maxVal;
            const isSilent = rms < thresholdLinear;

            if (isSilent && !inSilence) {
                inSilence = true;
                silenceStart = i / sampleRate;
            } else if (!isSilent && inSilence) {
                inSilence = false;
                silenceEnd = i / sampleRate;
                const duration = silenceEnd - silenceStart;
                if (duration >= this.minSilenceDuration) {
                    silentRegions.push({ start: silenceStart, end: silenceEnd, duration });
                }
            }
            i += windowSize;
        }

        if (inSilence) {
            silenceEnd = samples / sampleRate;
            const duration = silenceEnd - silenceStart;
            if (duration >= this.minSilenceDuration) {
                silentRegions.push({ start: silenceStart, end: silenceEnd, duration });
            }
        }

        let totalSilence = 0;
        for (const region of silentRegions) {
            totalSilence += region.duration;
        }

        return {
            silentRegions,
            totalSilence,
            percentSilence: (totalSilence / (samples / sampleRate)) * 100
        };
    }

    getSilenceMarkers(audioBuffer) {
        const analysis = this.analyzeClip(audioBuffer);
        return analysis.silentRegions.map(r => ({
            time: r.start,
            label: 'Silence',
            type: 'silence-start'
        }));
    }
}

export const clipSilenceDetector = new ClipSilenceDetector();