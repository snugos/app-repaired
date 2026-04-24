// js/AIMixingAssistant.js - AI-Powered Mixing Assistant
// Provides AI-powered mixing suggestions, auto-balance, and intelligent analysis

/**
 * TrackAnalysis - Analysis data for a single track
 */
class TrackAnalysis {
    constructor(trackId) {
        this.trackId = trackId;
        
        // Level metrics
        this.peakLevel = 0;
        this.rmsLevel = 0;
        this.lufsLevel = -100;
        this.dynamicRange = 0;
        this.crestFactor = 0;
        
        // Frequency metrics
        this.spectralCentroid = 0;
        this.spectralRolloff = 0;
        this.spectralFlatness = 0;
        this.spectralContrast = 0;
        this.lowEnergy = 0;
        this.midEnergy = 0;
        this.highEnergy = 0;
        
        // Stereo metrics
        this.stereoWidth = 0;
        this.correlation = 0;
        this.panPosition = 0;
        
        // Transient metrics
        this.transientCount = 0;
        this.transientIntensity = 0;
        
        // Content detection
        this.hasVocals = false;
        this.hasDrums = false;
        this.hasBass = false;
        this.hasSynth = false;
        this.instrumentType = 'unknown';
        
        // Issues
        this.issues = [];
    }
}

/**
 * MixSuggestion - A specific mixing suggestion
 */
class MixSuggestion {
    constructor(config) {
        this.id = config.id || `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.type = config.type || 'general';      // level, eq, dynamics, stereo, spatial, general
        this.priority = config.priority || 'medium'; // high, medium, low
        this.trackId = config.trackId || null;
        this.title = config.title || 'Suggestion';
        this.description = config.description || '';
        this.action = config.action || null;        // Action to apply
        this.params = config.params || {};          // Parameters for action
        this.autoApplicable = config.autoApplicable || false;
        this.applied = false;
    }
}

/**
 * AIMixingAssistant - Main AI mixing assistant
 */
export class AIMixingAssistant {
    constructor(audioContext, options = {}) {
        this.audioContext = audioContext;
        
        // References to DAW systems
        this.tracks = new Map();
        this.masterBus = null;
        
        // Analysis state
        this.analyses = new Map();
        this.analyserNodes = new Map();
        this.isAnalyzing = false;
        this.analysisInterval = null;
        
        // Suggestions
        this.suggestions = [];
        
        // Reference targets
        this.targetLUFS = options.targetLUFS || -14;
        this.targetPeakDB = options.targetPeakDB || -1;
        this.targetStereoWidth = options.targetStereoWidth || 0.8;
        
        // Learning data
        this.genreProfile = options.genreProfile || 'pop';
        this.userPreferences = options.userPreferences || {};
        
        // Analysis nodes
        this.masterAnalyser = audioContext.createAnalyser();
        this.masterAnalyser.fftSize = 4096;
    }

    /**
     * Register a track for analysis
     */
    registerTrack(trackId, trackNode, trackData = {}) {
        // Create analyser for this track
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 2048;
        
        // Connect track output to analyser
        if (trackNode) {
            trackNode.connect(analyser);
        }
        
        this.analyserNodes.set(trackId, analyser);
        this.tracks.set(trackId, {
            node: trackNode,
            data: trackData,
            analyser
        });
        
        // Initialize analysis
        this.analyses.set(trackId, new TrackAnalysis(trackId));
    }

    /**
     * Unregister a track
     */
    unregisterTrack(trackId) {
        const analyser = this.analyserNodes.get(trackId);
        if (analyser) {
            analyser.disconnect();
        }
        this.analyserNodes.delete(trackId);
        this.tracks.delete(trackId);
        this.analyses.delete(trackId);
    }

    /**
     * Register master bus
     */
    registerMasterBus(masterNode) {
        this.masterBus = masterNode;
        if (masterNode) {
            masterNode.connect(this.masterAnalyser);
        }
    }

    /**
     * Start continuous analysis
     */
    startAnalysis(interval = 100) {
        if (this.isAnalyzing) return;
        
        this.isAnalyzing = true;
        this.analysisInterval = setInterval(() => this.analyzeAll(), interval);
    }

    /**
     * Stop analysis
     */
    stopAnalysis() {
        this.isAnalyzing = false;
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }

    /**
     * Analyze all tracks
     */
    analyzeAll() {
        for (const [trackId, track] of this.tracks) {
            const analyser = track.analyser;
            if (analyser) {
                this.analyzeTrack(trackId, analyser);
            }
        }
        
        // Also analyze master
        this.analyzeMaster();
    }

    /**
     * Analyze a single track
     */
    analyzeTrack(trackId, analyser) {
        const analysis = this.analyses.get(trackId);
        if (!analysis) return;
        
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        const timeData = new Float32Array(analyser.fftSize);
        
        analyser.getByteFrequencyData(frequencyData);
        analyser.getFloatTimeDomainData(timeData);
        
        // Calculate peak level
        let peak = 0;
        for (let i = 0; i < timeData.length; i++) {
            const abs = Math.abs(timeData[i]);
            if (abs > peak) peak = abs;
        }
        analysis.peakLevel = 20 * Math.log10(peak + 0.00001);
        
        // Calculate RMS level
        let sumSquares = 0;
        for (let i = 0; i < timeData.length; i++) {
            sumSquares += timeData[i] * timeData[i];
        }
        analysis.rmsLevel = 20 * Math.log10(Math.sqrt(sumSquares / timeData.length) + 0.00001);
        
        // Calculate LUFS approximation
        analysis.lufsLevel = analysis.rmsLevel - 3; // Simplified
        
        // Calculate dynamic range
        analysis.dynamicRange = analysis.peakLevel - analysis.rmsLevel;
        analysis.crestFactor = analysis.dynamicRange;
        
        // Frequency analysis
        const numBins = frequencyData.length;
        const sampleRate = this.audioContext.sampleRate;
        
        // Spectral centroid
        let weightedSum = 0;
        let totalEnergy = 0;
        for (let i = 0; i < numBins; i++) {
            const freq = (i / numBins) * sampleRate / 2;
            weightedSum += freq * frequencyData[i];
            totalEnergy += frequencyData[i];
        }
        analysis.spectralCentroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;
        
        // Energy per band
        const lowBin = Math.floor(200 / (sampleRate / 2) * numBins);
        const midBin = Math.floor(2000 / (sampleRate / 2) * numBins);
        const highBin = Math.floor(8000 / (sampleRate / 2) * numBins);
        
        let lowEnergy = 0, midEnergy = 0, highEnergy = 0;
        for (let i = 0; i < lowBin; i++) lowEnergy += frequencyData[i];
        for (let i = lowBin; i < midBin; i++) midEnergy += frequencyData[i];
        for (let i = midBin; i < numBins; i++) highEnergy += frequencyData[i];
        
        const total = lowEnergy + midEnergy + highEnergy + 0.00001;
        analysis.lowEnergy = lowEnergy / total;
        analysis.midEnergy = midEnergy / total;
        analysis.highEnergy = highEnergy / total;
        
        // Detect instrument type based on spectral characteristics
        this.detectInstrumentType(analysis);
    }

    /**
     * Analyze master bus
     */
    analyzeMaster() {
        if (!this.masterAnalyser) return;
        
        const frequencyData = new Uint8Array(this.masterAnalyser.frequencyBinCount);
        const timeData = new Float32Array(this.masterAnalyser.fftSize);
        
        this.masterAnalyser.getByteFrequencyData(frequencyData);
        this.masterAnalyser.getFloatTimeDomainData(timeData);
        
        // Master level analysis
        let peak = 0;
        for (let i = 0; i < timeData.length; i++) {
            const abs = Math.abs(timeData[i]);
            if (abs > peak) peak = abs;
        }
        this.masterPeak = 20 * Math.log10(peak + 0.00001);
        
        // Store for suggestions
        this.masterFrequencyData = frequencyData;
    }

    /**
     * Detect instrument type from analysis
     */
    detectInstrumentType(analysis) {
        const { lowEnergy, midEnergy, highEnergy, spectralCentroid, transientCount, dynamicRange } = analysis;
        
        // Simple heuristics for instrument detection
        if (lowEnergy > 0.5 && spectralCentroid < 500) {
            analysis.instrumentType = 'bass';
            analysis.hasBass = true;
        } else if (spectralCentroid > 4000 && highEnergy > 0.4) {
            analysis.instrumentType = 'high-perc';
            analysis.hasDrums = true;
        } else if (spectralCentroid > 2000 && highEnergy > 0.3 && lowEnergy < 0.3) {
            analysis.instrumentType = 'synth';
            analysis.hasSynth = true;
        } else if (midEnergy > 0.4 && lowEnergy > 0.2 && lowEnergy < 0.5) {
            analysis.instrumentType = 'vocal';
            analysis.hasVocals = true;
        } else if (dynamicRange > 15 && lowEnergy > 0.3) {
            analysis.instrumentType = 'drums';
            analysis.hasDrums = true;
        } else {
            analysis.instrumentType = 'other';
        }
    }

    /**
     * Generate mixing suggestions
     */
    generateSuggestions() {
        this.suggestions = [];
        
        // Analyze each track for issues
        for (const [trackId, analysis] of this.analyses) {
            this.checkLevelIssues(trackId, analysis);
            this.checkFrequencyIssues(trackId, analysis);
            this.checkDynamicIssues(trackId, analysis);
        }
        
        // Check mix-level issues
        this.checkMixBalance();
        this.checkMasterBusIssues();
        
        // Sort by priority
        this.suggestions.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        
        return this.suggestions;
    }

    /**
     * Check level issues for a track
     */
    checkLevelIssues(trackId, analysis) {
        // Check for clipping
        if (analysis.peakLevel > -0.5) {
            this.suggestions.push(new MixSuggestion({
                type: 'level',
                priority: 'high',
                trackId,
                title: 'Potential Clipping',
                description: `Track is near or at clipping level (${analysis.peakLevel.toFixed(1)} dB). Reduce gain.`,
                action: 'setGain',
                params: { reduction: -3 },
                autoApplicable: true
            }));
        }
        
        // Check for very low level
        if (analysis.rmsLevel < -40) {
            this.suggestions.push(new MixSuggestion({
                type: 'level',
                priority: 'medium',
                trackId,
                title: 'Low Signal Level',
                description: `Track level is very low (${analysis.rmsLevel.toFixed(1)} dB RMS). Consider increasing gain.`,
                action: 'setGain',
                params: { increase: 6 },
                autoApplicable: true
            }));
        }
        
        // Check for low dynamic range
        if (analysis.dynamicRange < 3) {
            this.suggestions.push(new MixSuggestion({
                type: 'dynamics',
                priority: 'medium',
                trackId,
                title: 'Low Dynamic Range',
                description: `Track has very low dynamic range (${analysis.dynamicRange.toFixed(1)} dB). May be over-compressed.`,
                action: 'reduceCompression',
                params: {},
                autoApplicable: false
            }));
        }
    }

    /**
     * Check frequency issues
     */
    checkFrequencyIssues(trackId, analysis) {
        const track = this.tracks.get(trackId);
        const trackName = track?.data?.name || trackId;
        
        // Muddy low-mids
        if (analysis.lowEnergy > 0.6 && analysis.instrumentType !== 'bass') {
            this.suggestions.push(new MixSuggestion({
                type: 'eq',
                priority: 'medium',
                trackId,
                title: 'Muddy Low Frequencies',
                description: `${trackName} has excess low frequency content. Consider high-pass filter around 80-150 Hz.`,
                action: 'highPass',
                params: { frequency: 100 },
                autoApplicable: true
            }));
        }
        
        // Harsh high frequencies
        if (analysis.highEnergy > 0.5 && analysis.spectralCentroid > 5000) {
            this.suggestions.push(new MixSuggestion({
                type: 'eq',
                priority: 'medium',
                trackId,
                title: 'Harsh High Frequencies',
                description: `${trackName} may have harsh high frequencies. Consider gentle de-essing or high shelf cut.`,
                action: 'highShelf',
                params: { frequency: 8000, gain: -3 },
                autoApplicable: true
            }));
        }
        
        // Lack of presence
        if (analysis.midEnergy < 0.3 && analysis.instrumentType === 'vocal') {
            this.suggestions.push(new MixSuggestion({
                type: 'eq',
                priority: 'medium',
                trackId,
                title: 'Vocal Presence',
                description: `Vocal track lacks presence. Consider boosting 2-5 kHz range.`,
                action: 'bell',
                params: { frequency: 3000, gain: 2, Q: 1 },
                autoApplicable: true
            }));
        }
    }

    /**
     * Check dynamic issues
     */
    checkDynamicIssues(trackId, analysis) {
        // Very high dynamic range (may need compression)
        if (analysis.dynamicRange > 25 && analysis.instrumentType !== 'drums') {
            this.suggestions.push(new MixSuggestion({
                type: 'dynamics',
                priority: 'low',
                trackId,
                title: 'High Dynamic Range',
                description: `Track has high dynamic range. Consider gentle compression for consistency.`,
                action: 'addCompression',
                params: { threshold: -18, ratio: 3, attack: 0.01, release: 0.2 },
                autoApplicable: true
            }));
        }
    }

    /**
     * Check overall mix balance
     */
    checkMixBalance() {
        // Get average levels by instrument type
        const levelsByType = new Map();
        
        for (const [trackId, analysis] of this.analyses) {
            const type = analysis.instrumentType;
            if (!levelsByType.has(type)) {
                levelsByType.set(type, []);
            }
            levelsByType.get(type).push(analysis.rmsLevel);
        }
        
        // Check for imbalanced drums
        const drumLevels = levelsByType.get('drums') || [];
        const bassLevels = levelsByType.get('bass') || [];
        const vocalLevels = levelsByType.get('vocal') || [];
        
        if (drumLevels.length > 0 && vocalLevels.length > 0) {
            const avgDrums = drumLevels.reduce((a, b) => a + b, 0) / drumLevels.length;
            const avgVocals = vocalLevels.reduce((a, b) => a + b, 0) / vocalLevels.length;
            
            if (avgDrums > avgVocals + 6) {
                this.suggestions.push(new MixSuggestion({
                    type: 'balance',
                    priority: 'high',
                    title: 'Drums Overpowering Vocals',
                    description: 'Drums are significantly louder than vocals. Reduce drums or boost vocals.',
                    action: 'balanceTracks',
                    params: { type1: 'drums', type2: 'vocal', target: 'vocals louder by 3dB' },
                    autoApplicable: true
                }));
            }
        }
        
        // Check bass vs kick relationship
        if (bassLevels.length > 0 && drumLevels.length > 0) {
            const avgBass = bassLevels.reduce((a, b) => a + b, 0) / bassLevels.length;
            const avgDrums = drumLevels.reduce((a, b) => a + b, 0) / drumLevels.length;
            
            if (Math.abs(avgBass - avgDrums) > 3) {
                this.suggestions.push(new MixSuggestion({
                    type: 'balance',
                    priority: 'medium',
                    title: 'Kick/Bass Balance',
                    description: 'Kick and bass levels are imbalanced. They should be similar for solid low end.',
                    action: 'balanceLowEnd',
                    params: {},
                    autoApplicable: true
                }));
            }
        }
    }

    /**
     * Check master bus issues
     */
    checkMasterBusIssues() {
        if (this.masterPeak === undefined) return;
        
        // Check for master clipping
        if (this.masterPeak > -0.5) {
            this.suggestions.push(new MixSuggestion({
                type: 'master',
                priority: 'high',
                title: 'Master Clipping',
                description: 'Master output is clipping. Reduce individual track levels or add limiter.',
                action: 'addLimiter',
                params: { ceiling: -0.5 },
                autoApplicable: true
            }));
        }
        
        // Check for quiet master
        if (this.masterPeak < -18) {
            this.suggestions.push(new MixSuggestion({
                type: 'master',
                priority: 'medium',
                title: 'Low Master Level',
                description: 'Master output is very quiet. Consider normalizing or increasing overall level.',
                action: 'increaseMaster',
                params: { gain: 6 },
                autoApplicable: true
            }));
        }
    }

    /**
     * Auto-balance all tracks
     */
    autoBalance() {
        const actions = [];
        
        // Target average level
        const targetRMS = -18;
        
        for (const [trackId, analysis] of this.analyses) {
            const adjustment = targetRMS - analysis.rmsLevel;
            
            // Only adjust if difference is significant
            if (Math.abs(adjustment) > 2) {
                actions.push({
                    trackId,
                    action: 'setGain',
                    params: { adjustment }
                });
            }
        }
        
        return actions;
    }

    /**
     * Apply a suggestion
     */
    applySuggestion(suggestionId, trackSystem) {
        const suggestion = this.suggestions.find(s => s.id === suggestionId);
        if (!suggestion || suggestion.applied) return false;
        
        const { action, params, trackId } = suggestion;
        
        switch (action) {
            case 'setGain':
                if (trackSystem && trackId) {
                    const track = trackSystem.getTrack(trackId);
                    if (track && params.reduction) {
                        track.setVolume(track.volume + params.reduction);
                    } else if (track && params.increase) {
                        track.setVolume(track.volume + params.increase);
                    } else if (track && params.adjustment) {
                        track.setVolume(track.volume + params.adjustment);
                    }
                }
                break;
                
            case 'highPass':
                if (trackSystem && trackId) {
                    const track = trackSystem.getTrack(trackId);
                    if (track && track.addEffect) {
                        // Add high-pass filter
                        // Implementation depends on effect system
                    }
                }
                break;
                
            case 'addCompression':
                // Add compressor to track
                break;
                
            case 'addLimiter':
                // Add limiter to master
                break;
        }
        
        suggestion.applied = true;
        return true;
    }

    /**
     * Get analysis for a track
     */
    getTrackAnalysis(trackId) {
        return this.analyses.get(trackId);
    }

    /**
     * Get all suggestions
     */
    getSuggestions() {
        return this.suggestions.filter(s => !s.applied);
    }

    /**
     * Get mix summary
     */
    getMixSummary() {
        const summary = {
            totalTracks: this.tracks.size,
            instrumentCounts: {},
            averageLevels: {},
            issues: 0,
            suggestions: this.suggestions.length
        };
        
        for (const [_, analysis] of this.analyses) {
            const type = analysis.instrumentType;
            summary.instrumentCounts[type] = (summary.instrumentCounts[type] || 0) + 1;
            summary.averageLevels[type] = (summary.averageLevels[type] || 0) + analysis.rmsLevel;
        }
        
        for (const type in summary.averageLevels) {
            summary.averageLevels[type] /= summary.instrumentCounts[type] || 1;
        }
        
        summary.issues = this.suggestions.filter(s => s.priority === 'high').length;
        
        return summary;
    }

    /**
     * Export analysis data
     */
    exportAnalysis() {
        const data = {
            timestamp: Date.now(),
            targetLUFS: this.targetLUFS,
            trackAnalyses: [],
            masterAnalysis: {
                peak: this.masterPeak
            }
        };
        
        for (const [trackId, analysis] of this.analyses) {
            data.trackAnalyses.push({
                trackId,
                ...analysis
            });
        }
        
        return data;
    }
}

/**
 * GenreProfiles - Predefined genre-specific target profiles
 */
export const GenreProfiles = {
    pop: {
        name: 'Pop',
        targetLUFS: -14,
        targetPeakDB: -1,
        bassLevel: -12,
        vocalLevel: -10,
        drumsLevel: -14,
        stereoWidth: 0.8
    },
    rock: {
        name: 'Rock',
        targetLUFS: -13,
        targetPeakDB: -1,
        bassLevel: -10,
        vocalLevel: -8,
        drumsLevel: -12,
        stereoWidth: 0.85
    },
    electronic: {
        name: 'Electronic',
        targetLUFS: -12,
        targetPeakDB: -0.5,
        bassLevel: -8,
        vocalLevel: -10,
        drumsLevel: -10,
        stereoWidth: 0.95
    },
    hiphop: {
        name: 'Hip-Hop',
        targetLUFS: -12,
        targetPeakDB: -1,
        bassLevel: -7,
        vocalLevel: -6,
        drumsLevel: -10,
        stereoWidth: 0.8
    },
    jazz: {
        name: 'Jazz',
        targetLUFS: -16,
        targetPeakDB: -2,
        bassLevel: -14,
        vocalLevel: -12,
        drumsLevel: -16,
        stereoWidth: 0.7
    },
    classical: {
        name: 'Classical',
        targetLUFS: -18,
        targetPeakDB: -3,
        bassLevel: -18,
        vocalLevel: -15,
        drumsLevel: -20,
        stereoWidth: 0.6
    }
};

/**
 * Open AI Mixing Assistant panel
 */
export function openAIMixingAssistantPanel(services = {}) {
    const { audioContext, trackSystem, showNotification, onApplyAction } = services;
    
    if (!audioContext) {
        console.error('AIMixingAssistant: audioContext required');
        return null;
    }
    
    // Remove existing panel
    const existing = document.getElementById('ai-mix-panel');
    if (existing) existing.remove();
    
    const panel = document.createElement('div');
    panel.id = 'ai-mix-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #4a4a6a;
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 800px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const assistant = new AIMixingAssistant(audioContext);
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="color: #fff; margin: 0;">🤖 AI Mixing Assistant</h2>
            <button id="close-ai-mix" style="background: #ef4444; border: none; color: white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
        
        <!-- Genre Selection -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Target Profile</h3>
            <div style="display: flex; gap: 10px; align-items: center;">
                <select id="genre-select" style="flex: 1; padding: 10px; background: #1a1a2e; color: #fff; border: 1px solid #4a4a6a; border-radius: 4px;">
                    ${Object.entries(GenreProfiles).map(([id, profile]) => 
                        `<option value="${id}">${profile.name}</option>`
                    ).join('')}
                </select>
                <div style="flex: 2; color: #666; font-size: 12px;">
                    Target LUFS: <span id="target-lufs" style="color: #10b981;">-14</span> dB | 
                    Peak: <span id="target-peak" style="color: #f59e0b;">-1</span> dB
                </div>
            </div>
        </div>
        
        <!-- Mix Summary -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px;">
            <div style="background: #0f0f1f; padding: 16px; border-radius: 6px; text-align: center;">
                <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Tracks</div>
                <div id="track-count" style="color: #10b981; font-size: 24px; font-weight: bold;">0</div>
            </div>
            <div style="background: #0f0f1f; padding: 16px; border-radius: 6px; text-align: center;">
                <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Issues</div>
                <div id="issue-count" style="color: #ef4444; font-size: 24px; font-weight: bold;">0</div>
            </div>
            <div style="background: #0f0f1f; padding: 16px; border-radius: 6px; text-align: center;">
                <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Suggestions</div>
                <div id="suggestion-count" style="color: #f59e0b; font-size: 24px; font-weight: bold;">0</div>
            </div>
            <div style="background: #0f0f1f; padding: 16px; border-radius: 6px; text-align: center;">
                <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Master Peak</div>
                <div id="master-peak" style="color: #8b5cf6; font-size: 24px; font-weight: bold;">-∞</div>
            </div>
        </div>
        
        <!-- Track Levels -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <h3 style="color: #888; margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase;">Track Analysis</h3>
            <div id="track-levels" style="max-height: 200px; overflow-y: auto;">
                <div style="color: #666; text-align: center; padding: 20px;">No tracks registered. Start playback to analyze.</div>
            </div>
        </div>
        
        <!-- Suggestions -->
        <div style="margin-bottom: 20px; background: #0f0f1f; padding: 16px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="color: #888; margin: 0; font-size: 12px; text-transform: uppercase;">Suggestions</h3>
                <button id="refresh-suggestions" style="padding: 6px 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">🔄 Refresh</button>
            </div>
            <div id="suggestions-list" style="max-height: 300px; overflow-y: auto;">
                <div style="color: #666; text-align: center; padding: 20px;">Click "Refresh" to generate suggestions.</div>
            </div>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; gap: 10px;">
            <button id="analyze-mix" style="flex: 1; padding: 14px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                🔍 Analyze Mix
            </button>
            <button id="auto-balance" style="flex: 1; padding: 14px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                ⚖️ Auto Balance
            </button>
            <button id="auto-fix" style="flex: 1; padding: 14px; background: #f59e0b; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                🔧 Auto Fix Issues
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Update functions
    function updateTrackLevels() {
        const container = panel.querySelector('#track-levels');
        const analyses = Array.from(assistant.analyses.values());
        
        if (analyses.length === 0) {
            container.innerHTML = `<div style="color: #666; text-align: center; padding: 20px;">No tracks registered.</div>`;
            return;
        }
        
        container.innerHTML = analyses.map(a => {
            const track = assistant.tracks.get(a.trackId);
            const name = track?.data?.name || a.trackId;
            const levelColor = a.peakLevel > -3 ? '#ef4444' : a.rmsLevel < -30 ? '#666' : '#10b981';
            
            return `
                <div style="display: flex; align-items: center; padding: 8px; background: #1a1a2e; border-radius: 4px; margin-bottom: 6px;">
                    <div style="flex: 1;">
                        <div style="color: #fff; font-size: 12px;">${name}</div>
                        <div style="color: #666; font-size: 10px;">${a.instrumentType}</div>
                    </div>
                    <div style="width: 150px; text-align: right;">
                        <span style="color: ${levelColor}; font-size: 12px;">${a.rmsLevel.toFixed(1)} dB RMS</span>
                    </div>
                    <div style="width: 80px; text-align: right;">
                        <span style="color: #888; font-size: 11px;">Peak: ${a.peakLevel.toFixed(1)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    function updateSuggestions() {
        const container = panel.querySelector('#suggestions-list');
        const suggestions = assistant.getSuggestions();
        
        if (suggestions.length === 0) {
            container.innerHTML = `<div style="color: #666; text-align: center; padding: 20px;">No suggestions available. Analyze mix first.</div>`;
            return;
        }
        
        container.innerHTML = suggestions.map(s => {
            const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
            const track = s.trackId ? assistant.tracks.get(s.trackId) : null;
            const trackName = track?.data?.name || 'Master';
            
            return `
                <div class="suggestion-item" data-id="${s.id}" style="display: flex; align-items: flex-start; padding: 12px; background: #1a1a2e; border-radius: 4px; margin-bottom: 8px; border-left: 3px solid ${priorityColors[s.priority]};">
                    <div style="flex: 1;">
                        <div style="color: #fff; font-size: 13px; margin-bottom: 4px;">${s.title}</div>
                        <div style="color: #888; font-size: 11px;">${s.description}</div>
                        <div style="color: #666; font-size: 10px; margin-top: 4px;">Track: ${trackName} | Type: ${s.type}</div>
                    </div>
                    ${s.autoApplicable ? `
                        <button class="apply-suggestion" data-id="${s.id}" style="padding: 6px 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 11px;">
                            Apply
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        // Attach apply handlers
        container.querySelectorAll('.apply-suggestion').forEach(btn => {
            btn.onclick = () => {
                assistant.applySuggestion(btn.dataset.id, trackSystem);
                if (onApplyAction) onApplyAction(btn.dataset.id);
                updateSuggestions();
                if (showNotification) showNotification('Suggestion applied', 1500);
            };
        });
    }
    
    function updateSummary() {
        const summary = assistant.getMixSummary();
        panel.querySelector('#track-count').textContent = summary.totalTracks;
        panel.querySelector('#issue-count').textContent = summary.issues;
        panel.querySelector('#suggestion-count').textContent = summary.suggestions;
        panel.querySelector('#master-peak').textContent = assistant.masterPeak?.toFixed(1) || '-∞';
    }
    
    // Event handlers
    panel.querySelector('#close-ai-mix').onclick = () => {
        assistant.stopAnalysis();
        panel.remove();
    };
    
    panel.querySelector('#genre-select').onchange = (e) => {
        const profile = GenreProfiles[e.target.value];
        if (profile) {
            assistant.targetLUFS = profile.targetLUFS;
            assistant.targetPeakDB = profile.targetPeakDB;
            panel.querySelector('#target-lufs').textContent = profile.targetLUFS;
            panel.querySelector('#target-peak').textContent = profile.targetPeakDB;
        }
    };
    
    panel.querySelector('#analyze-mix').onclick = () => {
        assistant.startAnalysis();
        setTimeout(() => {
            assistant.generateSuggestions();
            updateTrackLevels();
            updateSuggestions();
            updateSummary();
            if (showNotification) showNotification('Analysis complete', 2000);
        }, 500);
    };
    
    panel.querySelector('#refresh-suggestions').onclick = () => {
        assistant.generateSuggestions();
        updateSuggestions();
        updateSummary();
        if (showNotification) showNotification('Suggestions refreshed', 1500);
    };
    
    panel.querySelector('#auto-balance').onclick = () => {
        const actions = assistant.autoBalance();
        if (onApplyAction) {
            actions.forEach(a => onApplyAction(a));
        }
        if (showNotification) showNotification(`Auto-balanced ${actions.length} tracks`, 2000);
    };
    
    panel.querySelector('#auto-fix').onclick = () => {
        const autoSuggestions = assistant.suggestions.filter(s => s.autoApplicable && !s.applied);
        let applied = 0;
        
        autoSuggestions.forEach(s => {
            if (assistant.applySuggestion(s.id, trackSystem)) {
                applied++;
            }
        });
        
        updateSuggestions();
        updateSummary();
        if (showNotification) showNotification(`Applied ${applied} fixes`, 2000);
    };
    
    return assistant;
}

export default AIMixingAssistant;