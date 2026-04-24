/**
 * Audio Reverse Engineering - Analyze and reconstruct audio characteristics
 * Provides tools to analyze audio and extract parameters for recreation
 */

export class AudioReverseEngineering {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // Analysis parameters
        this.fftSize = options.fftSize ?? 4096;
        this.hopSize = options.hopSize ?? 2048;
        this.windowFunction = options.windowFunction ?? 'hann';
        
        // Analysis results
        this.analysisResults = null;
        
        // UI container
        this.container = null;
        
        console.log('[AudioReverseEngineering] Module loaded');
    }
    
    // Main analysis function
    async analyzeAudio(audioBuffer) {
        const results = {
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            
            // Basic characteristics
            rmsLevel: 0,
            peakLevel: 0,
            dynamicRange: 0,
            
            // Frequency analysis
            spectralCentroid: 0,
            spectralRolloff: 0,
            spectralFlux: 0,
            spectralFlatness: 0,
            bandEnergy: {},
            
            // Temporal analysis
            attackTime: 0,
            decayTime: 0,
            sustainLevel: 0,
            releaseTime: 0,
            
            // Pitch analysis
            fundamentalFrequency: 0,
            pitchStability: 0,
            harmonics: [],
            
            // Stereo analysis
            stereoWidth: 0,
            phaseCorrelation: 0,
            
            // Reconstruction parameters
            suggestedSynthParams: null,
            suggestedEffectChain: null,
            
            // Raw data
            waveform: null,
            spectrum: null,
            spectrogram: null
        };
        
        // Get audio data
        const channelData = [];
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            channelData.push(audioBuffer.getChannelData(i));
        }
        
        // Run all analyses
        this._analyzeLevel(results, channelData);
        this._analyzeFrequency(results, channelData, audioBuffer.sampleRate);
        this._analyzeTemporal(results, channelData, audioBuffer.sampleRate);
        this._analyzePitch(results, channelData, audioBuffer.sampleRate);
        if (audioBuffer.numberOfChannels >= 2) {
            this._analyzeStereo(results, channelData);
        }
        this._generateReconstructionParams(results);
        
        // Store waveform and spectrum for visualization
        results.waveform = this._extractWaveform(channelData[0]);
        results.spectrum = this._extractSpectrum(channelData[0], audioBuffer.sampleRate);
        
        this.analysisResults = results;
        
        console.log('[AudioReverseEngineering] Analysis complete');
        
        return results;
    }
    
    _analyzeLevel(results, channelData) {
        const data = channelData[0];
        let sumSquares = 0;
        let peak = 0;
        
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            sumSquares += data[i] * data[i];
            if (abs > peak) peak = abs;
        }
        
        results.rmsLevel = 20 * Math.log10(Math.sqrt(sumSquares / data.length));
        results.peakLevel = 20 * Math.log10(peak);
        results.dynamicRange = results.peakLevel - results.rmsLevel;
    }
    
    _analyzeFrequency(results, channelData, sampleRate) {
        const data = channelData[0];
        const fftSize = this.fftSize;
        
        // Create analyzer
        const offlineCtx = new OfflineAudioContext(1, fftSize, sampleRate);
        const analyzer = offlineCtx.createAnalyser();
        analyzer.fftSize = fftSize;
        
        // Get frequency data
        const freqData = new Float32Array(analyzer.frequencyBinCount);
        
        // Spectral centroid
        let centroidSum = 0;
        let magnitudeSum = 0;
        
        const nyquist = sampleRate / 2;
        const binFreq = nyquist / analyzer.frequencyBinCount;
        
        // Band energy (low, mid, high)
        const bands = {
            sub: { range: [20, 60], energy: 0 },
            low: { range: [60, 250], energy: 0 },
            lowMid: { range: [250, 500], energy: 0 },
            mid: { range: [500, 2000], energy: 0 },
            highMid: { range: [2000, 4000], energy: 0 },
            high: { range: [4000, 20000], energy: 0 }
        };
        
        // Calculate from FFT (simplified - would use actual FFT in practice)
        for (let i = 0; i < analyzer.frequencyBinCount; i++) {
            const freq = i * binFreq;
            const magnitude = Math.abs(freqData[i]) || 0;
            
            centroidSum += freq * magnitude;
            magnitudeSum += magnitude;
            
            // Band energy
            Object.keys(bands).forEach(bandName => {
                const band = bands[bandName];
                if (freq >= band.range[0] && freq < band.range[1]) {
                    band.energy += magnitude;
                }
            });
        }
        
        results.spectralCentroid = magnitudeSum > 0 ? centroidSum / magnitudeSum : 0;
        results.bandEnergy = bands;
        
        // Spectral rolloff (95% of energy)
        let energySum = 0;
        const totalEnergy = magnitudeSum;
        let rolloffFreq = 0;
        
        for (let i = 0; i < analyzer.frequencyBinCount; i++) {
            energySum += Math.abs(freqData[i]) || 0;
            if (energySum >= totalEnergy * 0.95) {
                rolloffFreq = i * binFreq;
                break;
            }
        }
        results.spectralRolloff = rolloffFreq;
        
        // Spectral flatness (measure of noisiness vs tonality)
        let geometricMean = 1;
        let arithmeticMean = 0;
        let count = 0;
        
        for (let i = 0; i < analyzer.frequencyBinCount; i++) {
            const mag = Math.abs(freqData[i]) || 0.0001;
            geometricMean *= mag;
            arithmeticMean += mag;
            count++;
        }
        
        geometricMean = Math.pow(geometricMean, 1 / count);
        arithmeticMean /= count;
        results.spectralFlatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
    }
    
    _analyzeTemporal(results, channelData, sampleRate) {
        const data = channelData[0];
        
        // ADSR detection (simplified)
        // Find envelope using RMS in windows
        const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
        const envelope = [];
        
        for (let i = 0; i < data.length; i += windowSize) {
            let rms = 0;
            for (let j = i; j < Math.min(i + windowSize, data.length); j++) {
                rms += data[j] * data[j];
            }
            envelope.push(Math.sqrt(rms / windowSize));
        }
        
        // Find attack (time to reach 90% of peak)
        const peak = Math.max(...envelope);
        const threshold90 = peak * 0.9;
        const threshold10 = peak * 0.1;
        
        let attackStart = 0;
        let attackEnd = 0;
        let sustainStart = 0;
        let releaseStart = 0;
        
        // Find attack start (10% threshold)
        for (let i = 0; i < envelope.length; i++) {
            if (envelope[i] > threshold10) {
                attackStart = i;
                break;
            }
        }
        
        // Find attack end (90% threshold)
        for (let i = attackStart; i < envelope.length; i++) {
            if (envelope[i] > threshold90) {
                attackEnd = i;
                break;
            }
        }
        
        results.attackTime = (attackEnd - attackStart) * 0.01; // Convert to seconds
        
        // Find decay and sustain
        let sustainLevel = peak;
        let decayEnd = attackEnd;
        
        // Look for sustain level (where envelope levels off)
        for (let i = attackEnd + 1; i < envelope.length; i++) {
            const prev = envelope[i - 1];
            const curr = envelope[i];
            
            if (Math.abs(curr - prev) / prev < 0.05) { // Less than 5% change
                sustainLevel = curr;
                decayEnd = i;
                sustainStart = i;
                break;
            }
        }
        
        results.decayTime = (decayEnd - attackEnd) * 0.01;
        results.sustainLevel = 20 * Math.log10(sustainLevel / peak);
        
        // Find release (from sustain end to <10% of peak)
        for (let i = sustainStart; i < envelope.length; i++) {
            if (envelope[i] < threshold10) {
                releaseStart = i;
                break;
            }
        }
        
        results.releaseTime = (envelope.length - releaseStart) * 0.01;
    }
    
    _analyzePitch(results, channelData, sampleRate) {
        const data = channelData[0];
        
        // Autocorrelation-based pitch detection
        const minPeriod = Math.floor(sampleRate / 2000); // Max 2000 Hz
        const maxPeriod = Math.floor(sampleRate / 50); // Min 50 Hz
        const analysisLength = Math.min(data.length, sampleRate * 0.1); // 100ms window
        
        let bestCorr = 0;
        let bestPeriod = 0;
        
        for (let period = minPeriod; period < maxPeriod && period < analysisLength; period++) {
            let corr = 0;
            for (let i = 0; i < analysisLength - period; i++) {
                corr += data[i] * data[i + period];
            }
            
            if (corr > bestCorr) {
                bestCorr = corr;
                bestPeriod = period;
            }
        }
        
        if (bestPeriod > 0) {
            results.fundamentalFrequency = sampleRate / bestPeriod;
        }
        
        // Pitch stability (variation over time)
        const pitchEstimates = [];
        const segmentLength = sampleRate * 0.05; // 50ms segments
        
        for (let offset = 0; offset + segmentLength < data.length; offset += segmentLength) {
            let segBestCorr = 0;
            let segBestPeriod = 0;
            
            for (let period = minPeriod; period < maxPeriod && period < segmentLength; period++) {
                let corr = 0;
                for (let i = 0; i < segmentLength - period; i++) {
                    corr += data[offset + i] * data[offset + i + period];
                }
                
                if (corr > segBestCorr) {
                    segBestCorr = corr;
                    segBestPeriod = period;
                }
            }
            
            if (segBestPeriod > 0) {
                pitchEstimates.push(sampleRate / segBestPeriod);
            }
        }
        
        // Calculate variance
        if (pitchEstimates.length > 1) {
            const mean = pitchEstimates.reduce((a, b) => a + b, 0) / pitchEstimates.length;
            const variance = pitchEstimates.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pitchEstimates.length;
            results.pitchStability = 1 - Math.sqrt(variance) / mean;
        }
        
        // Harmonic analysis
        if (results.fundamentalFrequency > 0) {
            for (let h = 1; h <= 8; h++) {
                const harmonicFreq = results.fundamentalFrequency * h;
                if (harmonicFreq < sampleRate / 2) {
                    results.harmonics.push({
                        number: h,
                        frequency: harmonicFreq,
                        // Would calculate amplitude from FFT
                        amplitude: 0
                    });
                }
            }
        }
    }
    
    _analyzeStereo(results, channelData) {
        if (channelData.length < 2) return;
        
        const left = channelData[0];
        const right = channelData[1];
        
        // Stereo width (correlation between channels)
        let sumL = 0, sumR = 0, sumLR = 0;
        
        for (let i = 0; i < left.length; i++) {
            sumL += left[i] * left[i];
            sumR += right[i] * right[i];
            sumLR += left[i] * right[i];
        }
        
        const rmsL = Math.sqrt(sumL / left.length);
        const rmsR = Math.sqrt(sumR / right.length);
        
        // Phase correlation
        results.phaseCorrelation = sumLR / (Math.sqrt(sumL * sumR) || 1);
        
        // Stereo width
        const mid = (rmsL + rmsR) / 2;
        const side = Math.abs(rmsL - rmsR) / 2;
        results.stereoWidth = mid > 0 ? side / mid : 0;
    }
    
    _generateReconstructionParams(results) {
        // Suggest synthesizer parameters based on analysis
        results.suggestedSynthParams = {
            oscillatorType: results.spectralFlatness > 0.5 ? 'sawtooth' : 'sine',
            frequency: results.fundamentalFrequency || 440,
            attack: results.attackTime,
            decay: results.decayTime,
            sustain: Math.pow(10, results.sustainLevel / 20),
            release: results.releaseTime,
            
            // Filter suggestion
            filterType: results.spectralRolloff < 2000 ? 'lowpass' : 'highpass',
            filterFrequency: results.spectralRolloff,
            filterQ: results.spectralCentroid > 3000 ? 2 : 1
        };
        
        // Suggest effect chain
        const effects = [];
        
        // Compression based on dynamic range
        if (results.dynamicRange > 20) {
            effects.push({
                type: 'compressor',
                threshold: results.rmsLevel + 6,
                ratio: 4
            });
        }
        
        // Reverb based on sustain
        if (results.sustainLevel > -6) {
            effects.push({
                type: 'reverb',
                decay: results.releaseTime,
                wet: 0.3
            });
        }
        
        // EQ based on band energy
        if (results.bandEnergy.high?.energy > results.bandEnergy.mid?.energy * 1.5) {
            effects.push({
                type: 'eq',
                high: 3
            });
        }
        
        results.suggestedEffectChain = effects;
    }
    
    _extractWaveform(data) {
        // Downsample for display
        const samplesPerPixel = Math.floor(data.length / 1000);
        const waveform = [];
        
        for (let i = 0; i < 1000; i++) {
            const start = i * samplesPerPixel;
            let min = 0, max = 0;
            
            for (let j = 0; j < samplesPerPixel && start + j < data.length; j++) {
                const val = data[start + j];
                if (val < min) min = val;
                if (val > max) max = val;
            }
            
            waveform.push({ min, max });
        }
        
        return waveform;
    }
    
    _extractSpectrum(data, sampleRate) {
        // Simplified spectrum extraction
        // Would use actual FFT in production
        const spectrum = [];
        const numBins = 128;
        
        for (let i = 0; i < numBins; i++) {
            spectrum.push({
                frequency: i * (sampleRate / 2) / numBins,
                magnitude: Math.random() * 0.5 // Placeholder
            });
        }
        
        return spectrum;
    }
    
    // Compare two audio files
    async compare(audioBuffer1, audioBuffer2) {
        const results1 = await this.analyzeAudio(audioBuffer1);
        const results2 = await this.analyzeAudio(audioBuffer2);
        
        return {
            levelDifference: results1.rmsLevel - results2.rmsLevel,
            frequencyDifference: results1.spectralCentroid - results2.spectralCentroid,
            pitchDifference: results1.fundamentalFrequency - results2.fundamentalFrequency,
            dynamicRangeDifference: results1.dynamicRange - results2.dynamicRange,
            stereoWidthDifference: results1.stereoWidth - results2.stereoWidth,
            
            // Similarity score (0-1)
            similarity: this._calculateSimilarity(results1, results2)
        };
    }
    
    _calculateSimilarity(r1, r2) {
        // Weighted similarity calculation
        const weights = {
            level: 0.2,
            frequency: 0.2,
            pitch: 0.3,
            dynamicRange: 0.15,
            stereoWidth: 0.15
        };
        
        const levelSim = Math.max(0, 1 - Math.abs(r1.rmsLevel - r2.rmsLevel) / 30);
        const freqSim = Math.max(0, 1 - Math.abs(r1.spectralCentroid - r2.spectralCentroid) / 10000);
        const pitchSim = Math.max(0, 1 - Math.abs(r1.fundamentalFrequency - r2.fundamentalFrequency) / 1000);
        const drSim = Math.max(0, 1 - Math.abs(r1.dynamicRange - r2.dynamicRange) / 30);
        const stereoSim = Math.max(0, 1 - Math.abs(r1.stereoWidth - r2.stereoWidth));
        
        return levelSim * weights.level +
               freqSim * weights.frequency +
               pitchSim * weights.pitch +
               drSim * weights.dynamicRange +
               stereoSim * weights.stereoWidth;
    }
    
    // Get analysis results
    getResults() {
        return this.analysisResults;
    }
    
    // Generate report
    generateReport() {
        if (!this.analysisResults) return null;
        
        const r = this.analysisResults;
        
        return `
# Audio Analysis Report

## Basic Properties
- Duration: ${r.duration.toFixed(2)} seconds
- Sample Rate: ${r.sampleRate} Hz
- Channels: ${r.numberOfChannels}

## Level Analysis
- RMS Level: ${r.rmsLevel.toFixed(2)} dB
- Peak Level: ${r.peakLevel.toFixed(2)} dB
- Dynamic Range: ${r.dynamicRange.toFixed(2)} dB

## Frequency Analysis
- Spectral Centroid: ${r.spectralCentroid.toFixed(0)} Hz
- Spectral Rolloff (95%): ${r.spectralRolloff.toFixed(0)} Hz
- Spectral Flatness: ${r.spectralFlatness.toFixed(3)}

## Temporal Analysis
- Attack Time: ${(r.attackTime * 1000).toFixed(1)} ms
- Decay Time: ${(r.decayTime * 1000).toFixed(1)} ms
- Sustain Level: ${r.sustainLevel.toFixed(2)} dB
- Release Time: ${(r.releaseTime * 1000).toFixed(1)} ms

## Pitch Analysis
- Fundamental Frequency: ${r.fundamentalFrequency.toFixed(2)} Hz
- Pitch Stability: ${(r.pitchStability * 100).toFixed(1)}%

## Stereo Analysis
${r.numberOfChannels >= 2 ? `
- Stereo Width: ${(r.stereoWidth * 100).toFixed(1)}%
- Phase Correlation: ${r.phaseCorrelation.toFixed(3)}
` : 'Mono audio'}

## Reconstruction Parameters
### Synthesizer
- Oscillator: ${r.suggestedSynthParams.oscillatorType}
- Frequency: ${r.suggestedSynthParams.frequency.toFixed(2)} Hz
- ADSR: ${r.suggestedSynthParams.attack.toFixed(3)}s / ${r.suggestedSynthParams.decay.toFixed(3)}s / ${r.suggestedSynthParams.sustain.toFixed(2)} / ${r.suggestedSynthParams.release.toFixed(3)}s

### Suggested Effects
${r.suggestedEffectChain.map(e => `- ${e.type}: ${JSON.stringify(e)}`).join('\n')}
`.trim();
    }
    
    dispose() {
        this.analysisResults = null;
        console.log('[AudioReverseEngineering] Disposed');
    }
}

// Static methods
AudioReverseEngineering.getMetronomeAudioLabel = function() { return 'Audio Reverse Engineering'; };

console.log('[AudioReverseEngineering] Module loaded');