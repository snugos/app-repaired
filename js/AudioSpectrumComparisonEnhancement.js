/**
 * Audio Spectrum Comparison Enhancement - A/B comparison mode
 * Advanced A/B comparison of frequency spectra between tracks or clips
 */

// Spectrum Comparison State
const spectrumCompareState = {
    // Comparison mode
    mode: 'overlay', // overlay, split, difference, normalized
    
    // A/B Sources
    sourceA: {
        trackId: null,
        clipId: null,
        name: 'Source A',
        color: '#ff4444',
        spectrum: null,
        enabled: true
    },
    sourceB: {
        trackId: null,
        clipId: null,
        name: 'Source B',
        color: '#44ff44',
        spectrum: null,
        enabled: true
    },
    
    // Analysis settings
    fftSize: 2048,
    smoothing: 0.8,
    frequencyRange: {
        min: 20,
        max: 20000
    },
    
    // Display settings
    scale: 'logarithmic', // linear, logarithmic
    averaging: 'realtime', // realtime, averaged, peak
    averageCount: 10, // Number of frames to average
    
    // Comparison results
    difference: null,
    correlation: 0,
    rmsDifference: 0,
    
    // Frequency bands for comparison
    frequencyBands: [
        { name: 'Sub', min: 20, max: 60, color: '#ff0000' },
        { name: 'Bass', min: 60, max: 250, color: '#ff4400' },
        { name: 'Low-Mid', min: 250, max: 500, color: '#ff8800' },
        { name: 'Mid', min: 500, max: 2000, color: '#ffff00' },
        { name: 'High-Mid', min: 2000, max: 4000, color: '#88ff00' },
        { name: 'Presence', min: 4000, max: 8000, color: '#00ff88' },
        { name: 'Brilliance', min: 8000, max: 20000, color: '#0088ff' }
    ],
    
    // Band comparisons
    bandComparisons: [],
    
    // History
    historyLength: 100,
    comparisonHistory: [],
    
    // UI state
    isComparing: false,
    selectedBand: null,
    
    // Callbacks
    onComparisonUpdate: null,
    onBandSelect: null
};

/**
 * Set comparison source A
 */
function setComparisonSourceA(trackId, clipId = null) {
    spectrumCompareState.sourceA.trackId = trackId;
    spectrumCompareState.sourceA.clipId = clipId;
    spectrumCompareState.sourceA.name = trackId ? `Track ${trackId}` : 'Source A';
    
    return { success: true, source: spectrumCompareState.sourceA };
}

/**
 * Set comparison source B
 */
function setComparisonSourceB(trackId, clipId = null) {
    spectrumCompareState.sourceB.trackId = trackId;
    spectrumCompareState.sourceB.clipId = clipId;
    spectrumCompareState.sourceB.name = trackId ? `Track ${trackId}` : 'Source B';
    
    return { success: true, source: spectrumCompareState.sourceB };
}

/**
 * Analyze spectrum for a source
 */
function analyzeSourceSpectrum(source, analyzer) {
    if (!analyzer) return null;
    
    const dataArray = new Float32Array(spectrumCompareState.fftSize / 2);
    analyzer.getFloatFrequencyData(dataArray);
    
    // Convert to linear scale (dB to linear)
    const linearSpectrum = new Float32Array(dataArray.length);
    for (let i = 0; i < dataArray.length; i++) {
        linearSpectrum[i] = Math.pow(10, dataArray[i] / 20);
    }
    
    return {
        raw: dataArray,
        linear: linearSpectrum,
        timestamp: Date.now()
    };
}

/**
 * Perform spectrum comparison
 */
function performSpectrumComparison(spectrumA, spectrumB) {
    if (!spectrumA || !spectrumB) {
        return null;
    }
    
    const length = Math.min(spectrumA.linear.length, spectrumB.linear.length);
    
    // Calculate difference spectrum
    const difference = new Float32Array(length);
    const normalizedA = normalizeSpectrum(spectrumA.linear);
    const normalizedB = normalizeSpectrum(spectrumB.linear);
    
    for (let i = 0; i < length; i++) {
        difference[i] = normalizedA[i] - normalizedB[i];
    }
    
    // Calculate correlation coefficient
    const correlation = calculateCorrelation(normalizedA, normalizedB, length);
    
    // Calculate RMS difference
    const rmsDiff = calculateRMS(difference);
    
    // Calculate band comparisons
    const bandComparisons = calculateBandComparisons(spectrumA, spectrumB);
    
    const result = {
        difference,
        correlation,
        rmsDifference: rmsDiff,
        bandComparisons,
        timestamp: Date.now()
    };
    
    // Update state
    spectrumCompareState.difference = difference;
    spectrumCompareState.correlation = correlation;
    spectrumCompareState.rmsDifference = rmsDiff;
    spectrumCompareState.bandComparisons = bandComparisons;
    
    // Add to history
    spectrumCompareState.comparisonHistory.push(result);
    if (spectrumCompareState.comparisonHistory.length > spectrumCompareState.historyLength) {
        spectrumCompareState.comparisonHistory.shift();
    }
    
    if (spectrumCompareState.onComparisonUpdate) {
        spectrumCompareState.onComparisonUpdate(result);
    }
    
    return result;
}

/**
 * Normalize spectrum to 0-1 range
 */
function normalizeSpectrum(spectrum) {
    const max = Math.max(...spectrum);
    const min = Math.min(...spectrum);
    const range = max - min || 1;
    
    const normalized = new Float32Array(spectrum.length);
    for (let i = 0; i < spectrum.length; i++) {
        normalized[i] = (spectrum[i] - min) / range;
    }
    
    return normalized;
}

/**
 * Calculate correlation coefficient
 */
function calculateCorrelation(a, b, length) {
    let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
    
    for (let i = 0; i < length; i++) {
        sumA += a[i];
        sumB += b[i];
        sumAB += a[i] * b[i];
        sumA2 += a[i] * a[i];
        sumB2 += b[i] * b[i];
    }
    
    const n = length;
    const numerator = n * sumAB - sumA * sumB;
    const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
    
    return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Calculate RMS of array
 */
function calculateRMS(array) {
    let sum = 0;
    for (let i = 0; i < array.length; i++) {
        sum += array[i] * array[i];
    }
    return Math.sqrt(sum / array.length);
}

/**
 * Calculate band comparisons
 */
function calculateBandComparisons(spectrumA, spectrumB) {
    const sampleRate = 44100; // Default, should be from audio context
    const binSize = sampleRate / spectrumCompareState.fftSize;
    
    const comparisons = [];
    
    for (const band of spectrumCompareState.frequencyBands) {
        const startBin = Math.floor(band.min / binSize);
        const endBin = Math.min(
            Math.floor(band.max / binSize),
            spectrumA.linear.length - 1
        );
        
        // Average energy in band
        let energyA = 0, energyB = 0;
        let count = 0;
        
        for (let i = startBin; i <= endBin; i++) {
            energyA += spectrumA.linear[i];
            energyB += spectrumB.linear[i];
            count++;
        }
        
        const avgA = count > 0 ? energyA / count : 0;
        const avgB = count > 0 ? energyB / count : 0;
        
        // Calculate difference in dB
        const ratio = avgB > 0 ? avgA / avgB : (avgA > 0 ? Infinity : 1);
        const differenceDB = 20 * Math.log10(Math.abs(ratio));
        
        comparisons.push({
            name: band.name,
            min: band.min,
            max: band.max,
            color: band.color,
            energyA: avgA,
            energyB: avgB,
            difference: avgA - avgB,
            differenceDB: ratio > 0 ? differenceDB : -differenceDB,
            dominant: avgA > avgB ? 'A' : (avgB > avgA ? 'B' : 'equal')
        });
    }
    
    return comparisons;
}

/**
 * Set comparison mode
 */
function setComparisonMode(mode) {
    const validModes = ['overlay', 'split', 'difference', 'normalized'];
    if (!validModes.includes(mode)) {
        return { success: false, error: 'Invalid mode' };
    }
    
    spectrumCompareState.mode = mode;
    
    return { success: true, mode };
}

/**
 * Get frequency bin for a given frequency
 */
function getFrequencyBin(frequency) {
    const sampleRate = 44100;
    const binSize = sampleRate / spectrumCompareState.fftSize;
    return Math.round(frequency / binSize);
}

/**
 * Get frequency from bin
 */
function getBinFrequency(bin) {
    const sampleRate = 44100;
    const binSize = sampleRate / spectrumCompareState.fftSize;
    return bin * binSize;
}

/**
 * Generate comparison report
 */
function generateComparisonReport() {
    const report = {
        timestamp: Date.now(),
        sourceA: {
            name: spectrumCompareState.sourceA.name,
            trackId: spectrumCompareState.sourceA.trackId
        },
        sourceB: {
            name: spectrumCompareState.sourceB.name,
            trackId: spectrumCompareState.sourceB.trackId
        },
        analysis: {
            correlation: spectrumCompareState.correlation,
            rmsDifference: spectrumCompareState.rmsDifference,
            similarity: ((1 - spectrumCompareState.rmsDifference) * 100).toFixed(1) + '%'
        },
        bandAnalysis: spectrumCompareState.bandComparisons.map(band => ({
            band: band.name,
            difference: band.differenceDB.toFixed(2) + ' dB',
            dominant: band.dominant,
            recommendation: getBandRecommendation(band)
        })),
        overallRecommendation: getOverallRecommendation()
    };
    
    return report;
}

/**
 * Get recommendation for a frequency band
 */
function getBandRecommendation(band) {
    if (Math.abs(band.differenceDB) < 1) {
        return 'Balanced';
    }
    
    if (band.differenceDB > 3) {
        return `Source A is dominant (+${band.differenceDB.toFixed(1)} dB). Consider reducing.`;
    } else if (band.differenceDB < -3) {
        return `Source B is dominant (+${Math.abs(band.differenceDB).toFixed(1)} dB). Consider reducing.`;
    }
    
    return 'Minor difference';
}

/**
 * Get overall recommendation
 */
function getOverallRecommendation() {
    const correlation = spectrumCompareState.correlation;
    
    if (correlation > 0.9) {
        return 'Highly similar spectra. Sources may conflict in mix.';
    } else if (correlation > 0.7) {
        return 'Similar spectral content. Some frequency masking may occur.';
    } else if (correlation > 0.5) {
        return 'Moderate similarity. Good balance between sources.';
    } else {
        return 'Distinct spectral content. Good separation in mix.';
    }
}

/**
 * Select frequency band
 */
function selectComparisonBand(bandName) {
    const band = spectrumCompareState.frequencyBands.find(b => b.name === bandName);
    if (band) {
        spectrumCompareState.selectedBand = band;
        
        if (spectrumCompareState.onBandSelect) {
            spectrumCompareState.onBandSelect(band);
        }
        
        return { success: true, band };
    }
    return { success: false, error: 'Band not found' };
}

/**
 * Export comparison as image
 */
function exportComparisonImage(canvas) {
    if (!canvas) return { success: false, error: 'No canvas provided' };
    
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `spectrum_comparison_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    
    return { success: true, url: dataUrl };
}

/**
 * Export comparison data as JSON
 */
function exportComparisonData() {
    return JSON.stringify({
        sourceA: spectrumCompareState.sourceA,
        sourceB: spectrumCompareState.sourceB,
        currentComparison: {
            correlation: spectrumCompareState.correlation,
            rmsDifference: spectrumCompareState.rmsDifference,
            bandComparisons: spectrumCompareState.bandComparisons
        },
        history: spectrumCompareState.comparisonHistory.slice(-20)
    }, null, 2);
}

/**
 * Import comparison settings
 */
function importComparisonSettings(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        if (data.sourceA) {
            Object.assign(spectrumCompareState.sourceA, data.sourceA);
        }
        if (data.sourceB) {
            Object.assign(spectrumCompareState.sourceB, data.sourceB);
        }
        if (data.settings) {
            Object.assign(spectrumCompareState, data.settings);
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to parse settings' };
    }
}

/**
 * Reset comparison
 */
function resetComparison() {
    spectrumCompareState.sourceA.trackId = null;
    spectrumCompareState.sourceA.clipId = null;
    spectrumCompareState.sourceA.spectrum = null;
    
    spectrumCompareState.sourceB.trackId = null;
    spectrumCompareState.sourceB.clipId = null;
    spectrumCompareState.sourceB.spectrum = null;
    
    spectrumCompareState.difference = null;
    spectrumCompareState.correlation = 0;
    spectrumCompareState.rmsDifference = 0;
    spectrumCompareState.bandComparisons = [];
    spectrumCompareState.comparisonHistory = [];
    
    return { success: true };
}

/**
 * Get comparison modes
 */
function getComparisonModes() {
    return [
        { id: 'overlay', name: 'Overlay', description: 'Both spectra overlaid' },
        { id: 'split', name: 'Split', description: 'Side by side view' },
        { id: 'difference', name: 'Difference', description: 'A minus B spectrum' },
        { id: 'normalized', name: 'Normalized', description: 'Normalized comparison' }
    ];
}

/**
 * Get frequency bands
 */
function getFrequencyBands() {
    return spectrumCompareState.frequencyBands;
}

/**
 * Set FFT size
 */
function setComparisonFFTSize(size) {
    const validSizes = [512, 1024, 2048, 4096, 8192, 16384];
    if (!validSizes.includes(size)) {
        return { success: false, error: 'Invalid FFT size' };
    }
    
    spectrumCompareState.fftSize = size;
    return { success: true, fftSize: size };
}

/**
 * Start continuous comparison
 */
function startContinuousComparison() {
    spectrumCompareState.isComparing = true;
    return { success: true };
}

/**
 * Stop continuous comparison
 */
function stopContinuousComparison() {
    spectrumCompareState.isComparing = false;
    return { success: true };
}

// Export functions
window.setComparisonSourceA = setComparisonSourceA;
window.setComparisonSourceB = setComparisonSourceB;
window.analyzeSourceSpectrum = analyzeSourceSpectrum;
window.performSpectrumComparison = performSpectrumComparison;
window.setComparisonMode = setComparisonMode;
window.generateComparisonReport = generateComparisonReport;
window.selectComparisonBand = selectComparisonBand;
window.exportComparisonImage = exportComparisonImage;
window.exportComparisonData = exportComparisonData;
window.importComparisonSettings = importComparisonSettings;
window.resetComparison = resetComparison;
window.getComparisonModes = getComparisonModes;
window.getFrequencyBands = getFrequencyBands;
window.setComparisonFFTSize = setComparisonFFTSize;
window.startContinuousComparison = startContinuousComparison;
window.stopContinuousComparison = stopContinuousComparison;
window.spectrumCompareState = spectrumCompareState;

console.log('[AudioSpectrumComparisonEnhancement] Module loaded');