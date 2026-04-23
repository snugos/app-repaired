// js/SmartRecord.js - Smart Record with Take Management and Comping for SnugOS DAW
// Provides automatic take management, best take detection, and composite track creation

/**
 * SmartRecord provides intelligent recording features:
 * - Automatic take management (multiple recordings)
 * - Best take detection based on timing and dynamics
 * - Comping (composite track creation from best sections)
 * - Punch-in/punch-out recording
 * - Loop recording with take stacking
 */

/**
 * Take status
 */
export const TakeStatus = {
    RECORDING: 'recording',
    COMPLETE: 'complete',
    SELECTED: 'selected',     // Selected for comping
    MUTED: 'muted',
    DELETED: 'deleted'
};

/**
 * Comping mode
 */
export const CompingMode = {
    MANUAL: 'manual',         // User manually selects sections
    AUTO_BEST: 'auto_best',   // Automatically use best take sections
    LAYERED: 'layered'        // Layer multiple takes
};

/**
 * SmartTake - Represents a single recording take
 */
export class SmartTake {
    constructor(options = {}) {
        this.id = options.id || `take-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.trackId = options.trackId;
        this.name = options.name || `Take ${options.takeNumber || 1}`;
        this.status = TakeStatus.RECORDING;
        
        // Timing
        this.startTime = options.startTime || 0;
        this.endTime = options.endTime || 0;
        this.duration = 0;
        
        // Audio data
        this.audioBuffer = null;
        this.audioUrl = null;
        this.audioBlob = null;
        
        // Analysis data
        this.analysis = {
            averageLevel: 0,
            peakLevel: 0,
            dynamicRange: 0,
            timingScore: 0,      // How well timed (0-100)
            consistencyScore: 0, // Consistency of dynamics (0-100)
            overallScore: 0      // Combined score (0-100)
        };
        
        // Sections for comping
        this.sections = [];
        
        // Metadata
        this.createdAt = Date.now();
        this.tags = options.tags || [];
        this.notes = options.notes || '';
    }
    
    /**
     * Complete the take with audio buffer
     */
    complete(audioBuffer, analysis = {}) {
        this.status = TakeStatus.COMPLETE;
        this.audioBuffer = audioBuffer;
        this.endTime = audioBuffer ? audioBuffer.duration : 0;
        this.duration = this.endTime - this.startTime;
        
        // Merge analysis
        if (analysis) {
            Object.assign(this.analysis, analysis);
        }
        
        // Calculate overall score
        this.analysis.overallScore = this.calculateOverallScore();
        
        // Auto-detect sections for comping
        this.detectSections();
    }
    
    /**
     * Calculate overall score based on analysis
     */
    calculateOverallScore() {
        const { timingScore, consistencyScore, dynamicRange } = this.analysis;
        
        // Weighted combination
        const timingWeight = 0.4;
        const consistencyWeight = 0.4;
        const dynamicsWeight = 0.2;
        
        // Good dynamic range is around 20-40 dB
        const dynamicScore = Math.max(0, 100 - Math.abs(dynamicRange - 30) * 2);
        
        return Math.round(
            timingScore * timingWeight +
            consistencyScore * consistencyWeight +
            dynamicScore * dynamicsWeight
        );
    }
    
    /**
     * Detect sections (silent, active, peak) for comping
     */
    detectSections() {
        if (!this.audioBuffer) return;
        
        const channelData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;
        const analysisWindowSize = Math.floor(sampleRate * 0.05); // 50ms windows
        const threshold = 0.01; // Silence threshold
        
        this.sections = [];
        let currentSection = null;
        
        for (let i = 0; i < channelData.length; i += analysisWindowSize) {
            let sum = 0;
            const endSample = Math.min(i + analysisWindowSize, channelData.length);
            
            for (let j = i; j < endSample; j++) {
                sum += Math.abs(channelData[j]);
            }
            
            const avgLevel = sum / (endSample - i);
            const time = i / sampleRate;
            const isActive = avgLevel > threshold;
            
            if (!currentSection) {
                currentSection = {
                    startTime: time,
                    endTime: time + analysisWindowSize / sampleRate,
                    type: isActive ? 'active' : 'silent',
                    avgLevel: avgLevel,
                    peakLevel: avgLevel
                };
            } else {
                const sectionType = isActive ? 'active' : 'silent';
                
                if (currentSection.type === sectionType) {
                    // Extend current section
                    currentSection.endTime = time + analysisWindowSize / sampleRate;
                    currentSection.avgLevel = (currentSection.avgLevel + avgLevel) / 2;
                    currentSection.peakLevel = Math.max(currentSection.peakLevel, avgLevel);
                } else {
                    // Save current section and start new one
                    this.sections.push(currentSection);
                    currentSection = {
                        startTime: time,
                        endTime: time + analysisWindowSize / sampleRate,
                        type: sectionType,
                        avgLevel: avgLevel,
                        peakLevel: avgLevel
                    };
                }
            }
        }
        
        // Add final section
        if (currentSection) {
            this.sections.push(currentSection);
        }
        
        // Merge short silent sections
        this.mergeShortSections();
    }
    
    /**
     * Merge very short sections to simplify comping
     */
    mergeShortSections() {
        const minDuration = 0.1; // 100ms minimum
        const merged = [];
        
        for (const section of this.sections) {
            const duration = section.endTime - section.startTime;
            
            if (duration < minDuration && merged.length > 0) {
                // Merge with previous section
                const prev = merged[merged.length - 1];
                prev.endTime = section.endTime;
                prev.type = prev.type === 'active' ? prev.type : section.type;
            } else {
                merged.push(section);
            }
        }
        
        this.sections = merged;
    }
    
    /**
     * Get section at time
     */
    getSectionAt(time) {
        return this.sections.find(s => time >= s.startTime && time < s.endTime);
    }
    
    /**
     * Mark take as selected for comping
     */
    select() {
        this.status = TakeStatus.SELECTED;
    }
    
    /**
     * Mark take as muted
     */
    mute() {
        this.status = TakeStatus.MUTED;
    }
    
    /**
     * Mark take as deleted
     */
    delete() {
        this.status = TakeStatus.DELETED;
    }
    
    /**
     * Export take as JSON
     */
    toJSON() {
        return {
            id: this.id,
            trackId: this.trackId,
            name: this.name,
            status: this.status,
            startTime: this.startTime,
            endTime: this.endTime,
            duration: this.duration,
            analysis: this.analysis,
            sections: this.sections,
            createdAt: this.createdAt,
            tags: this.tags,
            notes: this.notes
        };
    }
}

/**
 * CompingRegion - A region in the composite track
 */
export class CompingRegion {
    constructor(options = {}) {
        this.id = options.id || `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.startTime = options.startTime || 0;
        this.endTime = options.endTime || 0;
        this.takeId = options.takeId || null;
        this.fadeIn = options.fadeIn || 0.01;  // 10ms fade
        this.fadeOut = options.fadeOut || 0.01;
        this.crossfade = options.crossfade || 0.05; // 50ms crossfade
    }
    
    /**
     * Get region duration
     */
    get duration() {
        return this.endTime - this.startTime;
    }
    
    /**
     * Check if time is in this region
     */
    contains(time) {
        return time >= this.startTime && time < this.endTime;
    }
}

/**
 * SmartRecordManager - Manages smart recording and comping
 */
export class SmartRecordManager {
    constructor(appServices) {
        this.appServices = appServices;
        
        // All takes per track
        this.takes = new Map(); // trackId -> SmartTake[]
        
        // Comping regions per track
        this.compingRegions = new Map(); // trackId -> CompingRegion[]
        
        // Current recording state
        this.recordingState = {
            isRecording: false,
            currentTake: null,
            trackId: null,
            startTime: 0,
            loopMode: false,
            loopStart: 0,
            loopEnd: 0,
            maxTakes: 8
        };
        
        // Comping settings
        this.compingSettings = {
            mode: CompingMode.MANUAL,
            autoSelectBest: true,
            crossfadeDuration: 0.05,
            fadeInDuration: 0.01,
            fadeOutDuration: 0.01
        };
        
        // Audio context for recording
        this.audioContext = null;
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.analyserNode = null;
        
        // Analysis buffers
        this.analysisBuffer = [];
        this.peakHistory = [];
    }
    
    /**
     * Initialize with audio context
     */
    init(audioContext) {
        this.audioContext = audioContext;
    }
    
    /**
     * Get takes for a track
     */
    getTakes(trackId) {
        if (!this.takes.has(trackId)) {
            this.takes.set(trackId, []);
        }
        return this.takes.get(trackId);
    }
    
    /**
     * Get take by ID
     */
    getTake(takeId) {
        for (const takes of this.takes.values()) {
            const take = takes.find(t => t.id === takeId);
            if (take) return take;
        }
        return null;
    }
    
    /**
     * Start recording a take
     */
    async startRecording(trackId, options = {}) {
        if (this.recordingState.isRecording) {
            console.warn('[SmartRecord] Already recording');
            return null;
        }
        
        const takes = this.getTakes(trackId);
        const takeNumber = takes.length + 1;
        
        // Create new take
        const take = new SmartTake({
            trackId,
            takeNumber,
            name: options.name || `Take ${takeNumber}`,
            startTime: options.startTime || 0,
            tags: options.tags || []
        });
        
        // Setup recording
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            
            this.mediaStream = stream;
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            // Setup analyser for real-time analysis
            if (this.audioContext) {
                const source = this.audioContext.createMediaStreamSource(stream);
                this.analyserNode = this.audioContext.createAnalyser();
                this.analyserNode.fftSize = 2048;
                source.connect(this.analyserNode);
            }
            
            // Collect recorded chunks
            const chunks = [];
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            // Handle recording stop
            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                take.audioBlob = blob;
                take.audioUrl = URL.createObjectURL(blob);
                
                // Decode audio for analysis
                if (this.audioContext) {
                    try {
                        const arrayBuffer = await blob.arrayBuffer();
                        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                        
                        // Analyze and complete take
                        const analysis = this.analyzeTake(audioBuffer);
                        take.complete(audioBuffer, analysis);
                        
                        console.log(`[SmartRecord] Take ${take.name} completed. Score: ${take.analysis.overallScore}`);
                    } catch (err) {
                        console.error('[SmartRecord] Failed to decode audio:', err);
                    }
                }
                
                // Auto-select best if enabled
                if (this.compingSettings.autoSelectBest) {
                    this.autoSelectBestTake(trackId);
                }
                
                // Trigger callback
                if (options.onComplete) {
                    options.onComplete(take);
                }
            };
            
            // Start recording
            this.mediaRecorder.start();
            this.recordingState.isRecording = true;
            this.recordingState.currentTake = take;
            this.recordingState.trackId = trackId;
            this.recordingState.startTime = Date.now();
            
            // Add take to list
            takes.push(take);
            
            // Start real-time analysis
            this.startRealtimeAnalysis();
            
            console.log(`[SmartRecord] Started recording ${take.name} on track ${trackId}`);
            
            return take;
            
        } catch (err) {
            console.error('[SmartRecord] Failed to start recording:', err);
            return null;
        }
    }
    
    /**
     * Stop current recording
     */
    stopRecording() {
        if (!this.recordingState.isRecording || !this.mediaRecorder) {
            return;
        }
        
        this.mediaRecorder.stop();
        this.recordingState.isRecording = false;
        
        // Stop stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        // Stop analysis
        this.stopRealtimeAnalysis();
        
        const take = this.recordingState.currentTake;
        this.recordingState.currentTake = null;
        
        console.log(`[SmartRecord] Stopped recording ${take?.name || 'unknown'}`);
        
        return take;
    }
    
    /**
     * Start loop recording
     */
    async startLoopRecording(trackId, loopStart, loopEnd, maxTakes = 8) {
        this.recordingState.loopMode = true;
        this.recordingState.loopStart = loopStart;
        this.recordingState.loopEnd = loopEnd;
        this.recordingState.maxTakes = maxTakes;
        
        return this.startRecording(trackId, {
            startTime: loopStart
        });
    }
    
    /**
     * Start real-time analysis during recording
     */
    startRealtimeAnalysis() {
        if (!this.analyserNode) return;
        
        const dataArray = new Float32Array(this.analyserNode.fftSize);
        
        this.analysisInterval = setInterval(() => {
            this.analyserNode.getFloatTimeDomainData(dataArray);
            
            // Calculate levels
            let sum = 0;
            let peak = 0;
            
            for (let i = 0; i < dataArray.length; i++) {
                const abs = Math.abs(dataArray[i]);
                sum += abs;
                peak = Math.max(peak, abs);
            }
            
            const avg = sum / dataArray.length;
            this.analysisBuffer.push({ avg, peak, time: Date.now() });
            this.peakHistory.push(peak);
            
            // Keep limited history
            if (this.analysisBuffer.length > 100) {
                this.analysisBuffer.shift();
            }
            if (this.peakHistory.length > 1000) {
                this.peakHistory.shift();
            }
        }, 50);
    }
    
    /**
     * Stop real-time analysis
     */
    stopRealtimeAnalysis() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }
    
    /**
     * Analyze take audio buffer
     */
    analyzeTake(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        let sum = 0;
        let peak = 0;
        let sumSquares = 0;
        
        // Calculate levels
        for (let i = 0; i < channelData.length; i++) {
            const abs = Math.abs(channelData[i]);
            sum += abs;
            sumSquares += channelData[i] * channelData[i];
            peak = Math.max(peak, abs);
        }
        
        const avg = sum / channelData.length;
        const rms = Math.sqrt(sumSquares / channelData.length);
        
        // Calculate dynamic range (approximation using peak to average ratio)
        const dynamicRange = peak > 0 ? 20 * Math.log10(peak / (avg + 0.0001)) : 0;
        
        // Calculate timing score based on transients
        const timingScore = this.calculateTimingScore(channelData, sampleRate);
        
        // Calculate consistency score
        const consistencyScore = this.calculateConsistencyScore(channelData, sampleRate);
        
        return {
            averageLevel: avg,
            peakLevel: peak,
            rmsLevel: rms,
            dynamicRange: dynamicRange,
            timingScore: timingScore,
            consistencyScore: consistencyScore
        };
    }
    
    /**
     * Calculate timing score based on transient alignment
     */
    calculateTimingScore(channelData, sampleRate) {
        // Detect transients
        const windowSize = Math.floor(sampleRate * 0.01); // 10ms
        const transients = [];
        let prevLevel = 0;
        
        for (let i = 0; i < channelData.length; i += windowSize) {
            let sum = 0;
            const end = Math.min(i + windowSize, channelData.length);
            
            for (let j = i; j < end; j++) {
                sum += Math.abs(channelData[j]);
            }
            
            const level = sum / (end - i);
            
            // Detect significant increase (transient)
            if (level > prevLevel * 2 && level > 0.01) {
                transients.push({
                    time: i / sampleRate,
                    strength: level / prevLevel
                });
            }
            
            prevLevel = level;
        }
        
        // Score based on number and clarity of transients
        // More transients with clearer attacks = better timing
        if (transients.length === 0) return 50; // Neutral for ambient sounds
        
        const avgStrength = transients.reduce((a, t) => a + t.strength, 0) / transients.length;
        const clarityScore = Math.min(100, avgStrength * 20);
        const countScore = Math.min(100, transients.length * 5);
        
        return Math.round((clarityScore + countScore) / 2);
    }
    
    /**
     * Calculate consistency score based on level stability
     */
    calculateConsistencyScore(channelData, sampleRate) {
        const windowSize = Math.floor(sampleRate * 0.1); // 100ms
        const levels = [];
        
        for (let i = 0; i < channelData.length; i += windowSize) {
            let sum = 0;
            const end = Math.min(i + windowSize, channelData.length);
            
            for (let j = i; j < end; j++) {
                sum += Math.abs(channelData[j]);
            }
            
            levels.push(sum / (end - i));
        }
        
        if (levels.length < 2) return 100;
        
        // Calculate variance
        const mean = levels.reduce((a, l) => a + l, 0) / levels.length;
        const variance = levels.reduce((a, l) => a + Math.pow(l - mean, 2), 0) / levels.length;
        const stdDev = Math.sqrt(variance);
        
        // Lower variance = higher consistency
        const consistency = Math.max(0, 100 - stdDev * 1000);
        
        return Math.round(consistency);
    }
    
    /**
     * Auto-select best take for a track
     */
    autoSelectBestTake(trackId) {
        const takes = this.getTakes(trackId).filter(t => t.status === TakeStatus.COMPLETE);
        
        if (takes.length === 0) return null;
        
        // Find best take by score
        const bestTake = takes.reduce((best, take) => {
            if (!best || take.analysis.overallScore > best.analysis.overallScore) {
                return take;
            }
            return best;
        }, null);
        
        if (bestTake) {
            // Deselect all others
            takes.forEach(t => {
                if (t.id !== bestTake.id) {
                    t.status = TakeStatus.COMPLETE;
                }
            });
            
            bestTake.select();
            console.log(`[SmartRecord] Auto-selected best take: ${bestTake.name} (score: ${bestTake.analysis.overallScore})`);
        }
        
        return bestTake;
    }
    
    /**
     * Create comping region
     */
    createCompingRegion(trackId, startTime, endTime, takeId) {
        if (!this.compingRegions.has(trackId)) {
            this.compingRegions.set(trackId, []);
        }
        
        const regions = this.compingRegions.get(trackId);
        
        const region = new CompingRegion({
            startTime,
            endTime,
            takeId,
            crossfade: this.compingSettings.crossfadeDuration,
            fadeIn: this.compingSettings.fadeInDuration,
            fadeOut: this.compingSettings.fadeOutDuration
        });
        
        regions.push(region);
        
        // Sort by start time
        regions.sort((a, b) => a.startTime - b.startTime);
        
        return region;
    }
    
    /**
     * Get comping regions for a track
     */
    getCompingRegions(trackId) {
        return this.compingRegions.get(trackId) || [];
    }
    
    /**
     * Auto-create comping from best takes
     */
    autoComp(trackId) {
        const takes = this.getTakes(trackId).filter(t => t.status === TakeStatus.COMPLETE);
        
        if (takes.length === 0) return [];
        
        // Find overall time range
        let minStart = Infinity;
        let maxEnd = 0;
        
        takes.forEach(t => {
            if (t.startTime < minStart) minStart = t.startTime;
            if (t.endTime > maxEnd) maxEnd = t.endTime;
        });
        
        // Divide into sections
        const sectionSize = 2; // 2 seconds per section
        const regions = [];
        
        for (let time = minStart; time < maxEnd; time += sectionSize) {
            const sectionEnd = Math.min(time + sectionSize, maxEnd);
            
            // Find best take for this section
            let bestTake = null;
            let bestScore = -1;
            
            takes.forEach(take => {
                const section = take.getSectionAt(time + sectionSize / 2);
                if (section && section.type === 'active') {
                    if (take.analysis.overallScore > bestScore) {
                        bestScore = take.analysis.overallScore;
                        bestTake = take;
                    }
                }
            });
            
            if (bestTake) {
                const region = this.createCompingRegion(trackId, time, sectionEnd, bestTake.id);
                regions.push(region);
            }
        }
        
        return regions;
    }
    
    /**
     * Build composite audio buffer from comping regions
     */
    async buildCompositeTrack(trackId) {
        const regions = this.getCompingRegions(trackId);
        
        if (regions.length === 0) return null;
        
        if (!this.audioContext) {
            console.error('[SmartRecord] No audio context');
            return null;
        }
        
        // Find total duration
        const totalDuration = Math.max(...regions.map(r => r.endTime));
        
        // Create output buffer
        const sampleRate = this.audioContext.sampleRate;
        const outputBuffer = this.audioContext.createBuffer(2, Math.ceil(totalDuration * sampleRate), sampleRate);
        const leftChannel = outputBuffer.getChannelData(0);
        const rightChannel = outputBuffer.getChannelData(1);
        
        // Fill with each region
        for (const region of regions) {
            const take = this.getTake(region.takeId);
            if (!take || !take.audioBuffer) continue;
            
            const takeData = take.audioBuffer;
            const startSample = Math.floor(region.startTime * sampleRate);
            const regionSamples = Math.floor(region.duration * sampleRate);
            
            // Copy audio with crossfade
            for (let i = 0; i < regionSamples; i++) {
                const outIndex = startSample + i;
                if (outIndex >= outputBuffer.length) break;
                
                // Calculate time within region for fade
                const timeInRegion = i / sampleRate;
                let gain = 1;
                
                // Fade in
                if (timeInRegion < region.fadeIn) {
                    gain *= timeInRegion / region.fadeIn;
                }
                
                // Fade out
                if (timeInRegion > region.duration - region.fadeOut) {
                    gain *= (region.duration - timeInRegion) / region.fadeOut;
                }
                
                // Crossfade at boundaries
                // (simplified - full implementation would blend with adjacent regions)
                
                // Copy from take
                const takeIndex = Math.floor(timeInRegion * sampleRate);
                if (takeIndex < takeData.length) {
                    // Mono or stereo take?
                    if (takeData.numberOfChannels >= 2) {
                        leftChannel[outIndex] = takeData.getChannelData(0)[takeIndex] * gain;
                        rightChannel[outIndex] = takeData.getChannelData(1)[takeIndex] * gain;
                    } else {
                        const sample = takeData.getChannelData(0)[takeIndex] * gain;
                        leftChannel[outIndex] = sample;
                        rightChannel[outIndex] = sample;
                    }
                }
            }
        }
        
        return outputBuffer;
    }
    
    /**
     * Delete a take
     */
    deleteTake(takeId) {
        for (const [trackId, takes] of this.takes) {
            const index = takes.findIndex(t => t.id === takeId);
            if (index !== -1) {
                takes[index].delete();
                takes.splice(index, 1);
                console.log(`[SmartRecord] Deleted take ${takeId}`);
                return true;
            }
        }
        return false;
    }
    
    /**
     * Clear all takes for a track
     */
    clearTakes(trackId) {
        if (this.takes.has(trackId)) {
            this.takes.set(trackId, []);
            this.compingRegions.set(trackId, []);
            console.log(`[SmartRecord] Cleared all takes for track ${trackId}`);
        }
    }
    
    /**
     * Export takes data
     */
    exportTakesData(trackId) {
        const takes = this.getTakes(trackId);
        const regions = this.getCompingRegions(trackId);
        
        return {
            trackId,
            takes: takes.map(t => t.toJSON()),
            compingRegions: regions.map(r => ({
                id: r.id,
                startTime: r.startTime,
                endTime: r.endTime,
                takeId: r.takeId,
                fadeIn: r.fadeIn,
                fadeOut: r.fadeOut,
                crossfade: r.crossfade
            }))
        };
    }
    
    /**
     * Import takes data
     */
    importTakesData(data) {
        if (!data.trackId) return;
        
        // Clear existing
        this.clearTakes(data.trackId);
        
        // Import takes
        const takes = this.getTakes(data.trackId);
        
        for (const takeData of data.takes || []) {
            const take = new SmartTake({
                id: takeData.id,
                trackId: data.trackId,
                name: takeData.name,
                startTime: takeData.startTime,
                tags: takeData.tags
            });
            
            take.status = takeData.status;
            take.endTime = takeData.endTime;
            take.duration = takeData.duration;
            take.analysis = takeData.analysis;
            take.sections = takeData.sections;
            take.notes = takeData.notes;
            
            takes.push(take);
        }
        
        // Import regions
        for (const regionData of data.compingRegions || []) {
            this.createCompingRegion(
                data.trackId,
                regionData.startTime,
                regionData.endTime,
                regionData.takeId
            );
        }
    }
}

/**
 * Create a SmartRecordManager instance
 */
export function createSmartRecordManager(appServices) {
    return new SmartRecordManager(appServices);
}

// Default export
export default {
    TakeStatus,
    CompingMode,
    SmartTake,
    CompingRegion,
    SmartRecordManager,
    createSmartRecordManager
};