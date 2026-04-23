// FrequencyMasking.js - Visual display showing frequency masking between tracks
// Detects when one track's frequencies overlap and mask another's energy

class FrequencyMasking {
    constructor() {
        this.analysers = new Map();
        this.dataArrays = new Map();
        this.smoothing = 0.8;
        this.binCount = 512;
        this.isRunning = false;
        this.updateInterval = null;
        this.callbacks = [];
    }

    createAnalyser(trackId) {
        if (this.analysers.has(trackId)) return this.analysers.get(trackId);
        
        const ctx = getAudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = this.smoothing;
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        this.analysers.set(trackId, analyser);
        this.dataArrays.set(trackId, dataArray);
        
        return analyser;
    }

    getAnalyser(trackId) {
        return this.analysers.get(trackId);
    }

    connectTrack(trackId, sourceNode) {
        const analyser = this.createAnalyser(trackId);
        sourceNode.connect(analyser);
        return analyser;
    }

    disconnectTrack(trackId) {
        const analyser = this.analysers.get(trackId);
        if (analyser) {
            analyser.disconnect();
            this.analysers.delete(trackId);
            this.dataArrays.delete(trackId);
        }
    }

    getSpectrumData(trackId) {
        const analyser = this.analysers.get(trackId);
        const dataArray = this.dataArrays.get(trackId);
        if (!analyser || !dataArray) return null;
        
        analyser.getByteFrequencyData(dataArray);
        return Array.from(dataArray);
    }

    getMaskingData(trackA, trackB) {
        const spectrumA = this.getSpectrumData(trackA);
        const spectrumB = this.getSpectrumData(trackB);
        if (!spectrumA || !spectrumB) return null;

        const masking = [];
        const nyquist = getAudioContext().sampleRate / 2;
        const binWidth = nyquist / this.binCount;

        for (let i = 0; i < this.binCount; i++) {
            const freq = i * binWidth;
            const energyA = spectrumA[i] / 255;
            const energyB = spectrumB[i] / 255;
            
            let maskingAmount = 0;
            if (energyA > 0.5 && energyB > 0.3) {
                maskingAmount = Math.min(energyA - energyB, 0.8);
            }
            
            masking.push({
                frequency: freq,
                bin: i,
                trackAAmount: energyA,
                trackBAmount: energyB,
                masking: maskingAmount
            });
        }
        
        return masking;
    }

    getCriticalBands() {
        return [
            { low: 20, high: 60, name: 'Sub bass' },
            { low: 60, high: 250, name: 'Bass' },
            { low: 250, high: 500, name: 'Low mid' },
            { low: 500, high: 2000, name: 'Mid' },
            { low: 2000, high: 4000, name: 'High mid' },
            { low: 4000, high: 6000, name: 'Presence' },
            { low: 6000, high: 12000, name: 'Brilliance' },
            { low: 12000, high: 20000, name: 'Air' }
        ];
    }

    getBandMasking(trackA, trackB, band) {
        const masking = this.getMaskingData(trackA, trackB);
        if (!masking) return null;

        const bandMasking = masking.filter(d => d.frequency >= band.low && d.frequency <= band.high);
        const avgMasking = bandMasking.reduce((sum, b) => sum + b.masking, 0) / bandMasking.length;
        const maxMasking = Math.max(...bandMasking.map(b => b.masking));
        
        return { average: avgMasking, maximum: maxMasking, band };
    }

    startUpdateLoop(intervalMs = 100) {
        this.isRunning = true;
        this.updateInterval = setInterval(() => {
            this.callbacks.forEach(cb => cb(this.getAllSpectra()));
        }, intervalMs);
    }

    stopUpdateLoop() {
        this.isRunning = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    onUpdate(callback) {
        this.callbacks.push(callback);
    }

    getAllSpectra() {
        const spectra = {};
        for (const [trackId, dataArray] of this.dataArrays) {
            const analyser = this.analysers.get(trackId);
            if (analyser) {
                analyser.getByteFrequencyData(dataArray);
                spectra[trackId] = Array.from(dataArray);
            }
        }
        return spectra;
    }

    getOverallMasking(trackIds) {
        if (trackIds.length < 2) return [];
        
        const maskingResults = [];
        for (let i = 0; i < trackIds.length; i++) {
            for (let j = i + 1; j < trackIds.length; j++) {
                const trackA = trackIds[i];
                const trackB = trackIds[j];
                const bands = this.getCriticalBands();
                
                const bandResults = bands.map(band => this.getBandMasking(trackA, trackB, band));
                
                maskingResults.push({
                    trackA,
                    trackB,
                    bands: bandResults.filter(Boolean),
                    totalMasking: bandResults.reduce((sum, r) => sum + r.average, 0) / bandResults.length
                });
            }
        }
        
        return maskingResults.sort((a, b) => b.totalMasking - a.totalMasking);
    }

    dispose() {
        this.stopUpdateLoop();
        this.callbacks = [];
        this.analysers.clear();
        this.dataArrays.clear();
    }
}

const frequencyMasking = new FrequencyMasking();