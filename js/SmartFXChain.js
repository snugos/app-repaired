/**
 * Smart FX Chain - AI-powered effect chain recommendations
 * Analyzes audio and suggests optimal effect chains based on genre and source type
 */

class SmartFXChain {
    constructor() {
        this.recommendationHistory = [];
        this.maxHistory = 30;
        
        // Source type definitions
        this.sourceTypes = {
            vocals: {
                name: 'Vocals',
                frequencyRange: [80, 12000],
                dynamics: 'variable',
                stereo: 'centered',
                characteristics: ['formant', 'sibilance', 'breath']
            },
            drums: {
                name: 'Drums',
                frequencyRange: [40, 8000],
                dynamics: 'high',
                stereo: 'wide',
                characteristics: ['transient', 'low_end', 'attack']
            },
            bass: {
                name: 'Bass',
                frequencyRange: [30, 400],
                dynamics: 'medium',
                stereo: 'centered',
                characteristics: ['low_end', 'sustain', 'punch']
            },
            guitar: {
                name: 'Guitar',
                frequencyRange: [80, 5000],
                dynamics: 'medium',
                stereo: 'variable',
                characteristics: ['harmonics', 'distortion', 'pluck']
            },
            piano: {
                name: 'Piano',
                frequencyRange: [30, 8000],
                dynamics: 'high',
                stereo: 'wide',
                characteristics: ['attack', 'sustain', 'resonance']
            },
            synth: {
                name: 'Synthesizer',
                frequencyRange: [20, 20000],
                dynamics: 'variable',
                stereo: 'variable',
                characteristics: ['filter', 'modulation', 'envelope']
            },
            strings: {
                name: 'Strings',
                frequencyRange: [150, 10000],
                dynamics: 'medium',
                stereo: 'wide',
                characteristics: ['bow', 'vibrato', 'resonance']
            },
            brass: {
                name: 'Brass',
                frequencyRange: [100, 6000],
                dynamics: 'high',
                stereo: 'medium',
                characteristics: ['brassy', 'attack', 'breath']
            },
            percussion: {
                name: 'Percussion',
                frequencyRange: [100, 15000],
                dynamics: 'high',
                stereo: 'variable',
                characteristics: ['transient', 'resonance', 'rattle']
            },
            pad: {
                name: 'Pad',
                frequencyRange: [100, 10000],
                dynamics: 'low',
                stereo: 'wide',
                characteristics: ['sustain', 'filter', 'modulation']
            }
        };
        
        // Genre templates
        this.genreTemplates = {
            pop: {
                name: 'Pop',
                characteristics: ['polished', 'present', 'compressed', 'bright'],
                vocalChain: ['eq-highpass', 'compression', 'eq-presence', 'reverb-plate', 'deesser'],
                drumChain: ['eq-subtractive', 'compression-punchy', 'eq-additive', 'saturation'],
                bassChain: ['eq-subtractive', 'compression-heavy', 'saturation', 'limiter']
            },
            rock: {
                name: 'Rock',
                characteristics: ['aggressive', 'driven', 'dynamic', 'raw'],
                vocalChain: ['eq-highpass', 'compression-medium', 'distortion-light', 'delay-slapper', 'reverb-room'],
                drumChain: ['eq-subtractive', 'gate', 'compression-heavy', 'eq-aggressive', 'parallel'],
                bassChain: ['eq-subtractive', 'compression-heavy', 'distortion-medium', 'amp-sim']
            },
            electronic: {
                name: 'Electronic/EDM',
                characteristics: ['polished', 'wide', 'sidechain', 'punchy'],
                vocalChain: ['eq-highpass', 'compression-heavy', 'eq-presence', 'reverb-plate', 'wider'],
                drumChain: ['eq-subtractive', 'compression-punchy', 'saturation', 'multiband', 'limiter'],
                bassChain: ['eq-subtractive', 'multiband', 'saturation', 'sidechain', 'limiter']
            },
            jazz: {
                name: 'Jazz',
                characteristics: ['natural', 'dynamic', 'warm', 'spacious'],
                vocalChain: ['eq-highpass', 'compression-light', 'eq-warm', 'reverb-chamber'],
                drumChain: ['eq-natural', 'compression-light', 'reverb-room'],
                bassChain: ['eq-subtractive', 'compression-light', 'amp-warm']
            },
            classical: {
                name: 'Classical',
                characteristics: ['natural', 'dynamic', 'spacious', 'authentic'],
                vocalChain: ['eq-light', 'compression-very-light', 'reverb-hall'],
                drumChain: ['eq-natural', 'compression-none', 'reverb-hall'],
                bassChain: ['eq-natural', 'compression-none', 'reverb-hall']
            },
            hipHop: {
                name: 'Hip-Hop',
                characteristics: ['punchy', 'bassy', 'in-your-face', 'compressed'],
                vocalChain: ['eq-highpass', 'compression-heavy', 'eq-presence', 'delay-tape', 'deesser'],
                drumChain: ['eq-subtractive', 'compression-punchy', 'saturation', 'parallel'],
                bassChain: ['eq-subtractive', 'multiband', 'saturation', 'limiter']
            },
            metal: {
                name: 'Metal',
                characteristics: ['aggressive', 'tight', 'distorted', 'powerful'],
                vocalChain: ['eq-highpass', 'compression-heavy', 'distortion-heavy', 'delay', 'reverb-plate'],
                drumChain: ['eq-aggressive', 'gate', 'compression-heavy', 'triggers', 'parallel'],
                bassChain: ['eq-subtractive', 'compression-heavy', 'distortion-heavy', 'amp-sim']
            },
            ambient: {
                name: 'Ambient',
                characteristics: ['ethereal', 'spacious', 'sustained', 'dreamy'],
                vocalChain: ['eq-highpass', 'compression-light', 'reverb-large', 'delay-modulated', 'chorus'],
                drumChain: ['eq-subtractive', 'compression-light', 'reverb-plate', 'delay'],
                bassChain: ['eq-subtractive', 'compression-light', 'reverb', 'chorus']
            },
            loFi: {
                name: 'Lo-Fi',
                characteristics: ['warm', 'imperfect', 'vintage', 'character'],
                vocalChain: ['eq-highpass', 'compression-medium', 'eq-lofi', 'saturation', 'vinyl'],
                drumChain: ['eq-lofi', 'saturation', 'compression-medium', 'bitcrusher', 'vinyl'],
                bassChain: ['eq-lofi', 'saturation', 'compression-medium', 'bitcrusher']
            },
            rAndB: {
                name: 'R&B',
                characteristics: ['smooth', 'warm', 'polished', 'groovy'],
                vocalChain: ['eq-highpass', 'compression-medium', 'eq-presence', 'reverb-plate', 'delay'],
                drumChain: ['eq-subtractive', 'compression-groove', 'saturation-light', 'eq-additive'],
                bassChain: ['eq-subtractive', 'compression-medium', 'saturation', 'chorus']
            }
        };
        
        // Effect definitions
        this.effects = {
            'eq-highpass': { name: 'High-Pass EQ', category: 'eq', params: { frequency: 80, slope: 12 } },
            'eq-subtractive': { name: 'Subtractive EQ', category: 'eq', params: { lowCut: 40, highCut: 12000 } },
            'eq-additive': { name: 'Additive EQ', category: 'eq', params: { boostFreq: 3000, boostGain: 2 } },
            'eq-presence': { name: 'Presence EQ', category: 'eq', params: { frequency: 5000, gain: 3, Q: 1 } },
            'eq-warm': { name: 'Warm EQ', category: 'eq', params: { frequency: 200, gain: 2, Q: 1 } },
            'eq-aggressive': { name: 'Aggressive EQ', category: 'eq', params: { lowBoost: 3, highBoost: 4 } },
            'eq-natural': { name: 'Natural EQ', category: 'eq', params: { subtle: true } },
            'eq-light': { name: 'Light EQ', category: 'eq', params: { subtle: true } },
            'eq-lofi': { name: 'Lo-Fi EQ', category: 'eq', params: { lowpass: 6000, highpass: 100 } },
            
            'compression-light': { name: 'Light Compression', category: 'dynamics', params: { threshold: -20, ratio: 2, attack: 20, release: 100 } },
            'compression-medium': { name: 'Medium Compression', category: 'dynamics', params: { threshold: -15, ratio: 4, attack: 10, release: 80 } },
            'compression-heavy': { name: 'Heavy Compression', category: 'dynamics', params: { threshold: -10, ratio: 8, attack: 5, release: 50 } },
            'compression-punchy': { name: 'Punchy Compression', category: 'dynamics', params: { threshold: -12, ratio: 4, attack: 30, release: 60 } },
            'compression-groove': { name: 'Groove Compression', category: 'dynamics', params: { threshold: -14, ratio: 3, attack: 15, release: 100 } },
            'compression-very-light': { name: 'Very Light Compression', category: 'dynamics', params: { threshold: -24, ratio: 1.5, attack: 30, release: 150 } },
            'compression-none': { name: 'No Compression', category: 'dynamics', params: { bypass: true } },
            'parallel': { name: 'Parallel Compression', category: 'dynamics', params: { threshold: -20, ratio: 10, attack: 10, release: 100, mix: 0.3 } },
            'multiband': { name: 'Multiband Compression', category: 'dynamics', params: { lowThreshold: -10, midThreshold: -15, highThreshold: -12 } },
            'limiter': { name: 'Limiter', category: 'dynamics', params: { threshold: -1, release: 50 } },
            'gate': { name: 'Gate', category: 'dynamics', params: { threshold: -40, attack: 1, release: 50 } },
            'deesser': { name: 'De-Esser', category: 'dynamics', params: { frequency: 6000, threshold: -20, ratio: 4 } },
            
            'reverb-plate': { name: 'Plate Reverb', category: 'reverb', params: { decay: 1.5, predelay: 10, mix: 0.3 } },
            'reverb-room': { name: 'Room Reverb', category: 'reverb', params: { decay: 0.8, predelay: 5, mix: 0.25 } },
            'reverb-hall': { name: 'Hall Reverb', category: 'reverb', params: { decay: 2.5, predelay: 30, mix: 0.35 } },
            'reverb-chamber': { name: 'Chamber Reverb', category: 'reverb', params: { decay: 1.2, predelay: 15, mix: 0.3 } },
            'reverb-large': { name: 'Large Reverb', category: 'reverb', params: { decay: 4, predelay: 50, mix: 0.5 } },
            
            'delay': { name: 'Delay', category: 'delay', params: { time: 0.5, feedback: 0.3, mix: 0.3 } },
            'delay-slapper': { name: 'Slap Delay', category: 'delay', params: { time: 0.08, feedback: 0.1, mix: 0.25 } },
            'delay-tape': { name: 'Tape Delay', category: 'delay', params: { time: 0.33, feedback: 0.4, mix: 0.3, modulation: 0.1 } },
            'delay-modulated': { name: 'Modulated Delay', category: 'delay', params: { time: 0.5, feedback: 0.5, mix: 0.4, modulation: 0.3 } },
            
            'saturation': { name: 'Saturation', category: 'distortion', params: { drive: 3, mix: 0.5 } },
            'saturation-light': { name: 'Light Saturation', category: 'distortion', params: { drive: 1, mix: 0.3 } },
            'distortion-light': { name: 'Light Distortion', category: 'distortion', params: { drive: 2, mix: 0.3 } },
            'distortion-medium': { name: 'Medium Distortion', category: 'distortion', params: { drive: 5, mix: 0.5 } },
            'distortion-heavy': { name: 'Heavy Distortion', category: 'distortion', params: { drive: 10, mix: 0.7 } },
            'amp-sim': { name: 'Amp Simulator', category: 'distortion', params: { drive: 4, cabinet: true } },
            'amp-warm': { name: 'Warm Amp', category: 'distortion', params: { drive: 2, cabinet: true } },
            'bitcrusher': { name: 'Bitcrusher', category: 'distortion', params: { bits: 8, sampleRate: 22050 } },
            'vinyl': { name: 'Vinyl Effect', category: 'distortion', params: { noise: 0.1, wow: 0.1, crackle: 0.2 } },
            
            'chorus': { name: 'Chorus', category: 'modulation', params: { rate: 1.5, depth: 0.3, mix: 0.5 } },
            'wider': { name: 'Stereo Widener', category: 'modulation', params: { width: 1.5 } },
            
            'sidechain': { name: 'Sidechain Compression', category: 'dynamics', params: { threshold: -20, ratio: 4, attack: 5, release: 50 } },
            'triggers': { name: 'Drum Triggers', category: 'dynamics', params: { sampleReplace: true } }
        };
    }
    
    /**
     * Analyze audio and recommend effect chain
     * @param {AudioBuffer} audioBuffer - Audio to analyze
     * @param {Object} options - Analysis options
     * @returns {Object} - Recommendation with suggested chain
     */
    async analyze(audioBuffer, options = {}) {
        const {
            sourceType = null,
            genre = 'pop',
            targetCharacteristics = [],
            onProgress = null
        } = options;
        
        if (onProgress) onProgress({ progress: 0, status: 'analyzing audio' });
        
        // Analyze audio characteristics
        const analysis = this.analyzeAudio(audioBuffer, onProgress);
        
        // Detect source type if not provided
        const detectedType = sourceType || this.detectSourceType(analysis);
        
        if (onProgress) onProgress({ progress: 50, status: 'generating recommendations' });
        
        // Get genre template
        const genreTemplate = this.genreTemplates[genre] || this.genreTemplates.pop;
        
        // Generate recommendations
        const recommendations = this.generateRecommendations(
            analysis,
            detectedType,
            genreTemplate,
            targetCharacteristics
        );
        
        if (onProgress) onProgress({ progress: 100, status: 'complete' });
        
        // Add to history
        this.recommendationHistory.push({
            timestamp: Date.now(),
            sourceType: detectedType,
            genre,
            analysis,
            recommendations
        });
        
        return {
            sourceType: detectedType,
            genre,
            analysis,
            recommendations
        };
    }
    
    /**
     * Analyze audio characteristics
     */
    analyzeAudio(audioBuffer, onProgress = null) {
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        const numChannels = audioBuffer.numberOfChannels;
        
        const analysis = {
            duration,
            sampleRate,
            numChannels,
            stereoWidth: 0,
            dynamics: {
                peakLevel: 0,
                rmsLevel: 0,
                dynamicRange: 0,
                crestFactor: 0
            },
            frequency: {
                lowEnergy: 0,
                midEnergy: 0,
                highEnergy: 0,
                spectralCentroid: 0
            },
            characteristics: []
        };
        
        // Analyze each channel
        for (let ch = 0; ch < numChannels; ch++) {
            const data = audioBuffer.getChannelData(ch);
            let sum = 0;
            let peak = 0;
            
            for (let i = 0; i < data.length; i++) {
                const sample = Math.abs(data[i]);
                sum += sample * sample;
                if (sample > peak) peak = sample;
            }
            
            const rms = Math.sqrt(sum / data.length);
            
            if (ch === 0) {
                analysis.dynamics.peakLevel = peak;
                analysis.dynamics.rmsLevel = rms;
            } else {
                // Calculate stereo width
                // This is simplified - full implementation would use correlation
                analysis.stereoWidth = Math.abs(peak - analysis.dynamics.peakLevel);
            }
            
            analysis.dynamics.crestFactor = analysis.dynamics.peakLevel / Math.max(0.001, analysis.dynamics.rmsLevel);
        }
        
        // Determine characteristics based on analysis
        if (analysis.dynamics.crestFactor > 5) {
            analysis.characteristics.push('transient');
        }
        if (analysis.dynamics.crestFactor < 3) {
            analysis.characteristics.push('sustained');
        }
        if (analysis.stereoWidth > 0.5) {
            analysis.characteristics.push('wide_stereo');
        }
        if (analysis.stereoWidth < 0.1) {
            analysis.characteristics.push('centered');
        }
        if (analysis.dynamics.rmsLevel > 0.5) {
            analysis.characteristics.push('high_gain');
        }
        if (analysis.dynamics.rmsLevel < 0.1) {
            analysis.characteristics.push('low_gain');
        }
        
        return analysis;
    }
    
    /**
     * Detect source type from analysis
     */
    detectSourceType(analysis) {
        let bestMatch = 'synth';
        let bestScore = 0;
        
        for (const [type, definition] of Object.entries(this.sourceTypes)) {
            let score = 0;
            
            // Match dynamics
            if (definition.dynamics === 'high' && analysis.characteristics.includes('transient')) {
                score += 2;
            } else if (definition.dynamics === 'low' && analysis.characteristics.includes('sustained')) {
                score += 2;
            } else if (definition.dynamics === 'medium') {
                score += 1;
            }
            
            // Match stereo
            if (definition.stereo === 'wide' && analysis.characteristics.includes('wide_stereo')) {
                score += 2;
            } else if (definition.stereo === 'centered' && analysis.characteristics.includes('centered')) {
                score += 2;
            } else if (definition.stereo === 'variable') {
                score += 1;
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = type;
            }
        }
        
        return bestMatch;
    }
    
    /**
     * Generate effect chain recommendations
     */
    generateRecommendations(analysis, sourceType, genreTemplate, targetCharacteristics) {
        const recommendations = [];
        
        // Get base chain from genre template
        let baseChain = [];
        switch (sourceType) {
            case 'vocals':
                baseChain = [...(genreTemplate.vocalChain || [])];
                break;
            case 'drums':
            case 'percussion':
                baseChain = [...(genreTemplate.drumChain || [])];
                break;
            case 'bass':
                baseChain = [...(genreTemplate.bassChain || [])];
                break;
            default:
                baseChain = ['eq-subtractive', 'compression-medium', 'reverb-plate'];
        }
        
        // Build chain with effect details
        const chain = baseChain.map((effectId, index) => {
            const effect = this.effects[effectId];
            if (!effect) return null;
            
            return {
                position: index,
                id: effectId,
                name: effect.name,
                category: effect.category,
                params: { ...effect.params },
                reason: this.getEffectReason(effectId, sourceType, genreTemplate)
            };
        }).filter(e => e !== null);
        
        // Add suggestions based on analysis
        const suggestions = [];
        
        if (analysis.characteristics.includes('low_gain')) {
            suggestions.push({
                type: 'gain',
                action: 'Increase input gain',
                reason: 'Low signal level detected'
            });
        }
        
        if (analysis.characteristics.includes('high_gain')) {
            suggestions.push({
                type: 'gain',
                action: 'Reduce input gain or add limiter',
                reason: 'High signal level detected'
            });
        }
        
        if (sourceType === 'vocals' && !chain.find(e => e.id === 'deesser')) {
            suggestions.push({
                type: 'add',
                effect: 'deesser',
                reason: 'Vocals often benefit from de-essing'
            });
        }
        
        if (genreTemplate.characteristics.includes('sidechain') && 
            sourceType === 'bass' && 
            !chain.find(e => e.id === 'sidechain')) {
            suggestions.push({
                type: 'add',
                effect: 'sidechain',
                reason: 'Genre typically uses sidechain on bass'
            });
        }
        
        recommendations.push({
            chain,
            suggestions,
            confidence: this.calculateConfidence(chain, sourceType, genreTemplate),
            description: this.generateDescription(chain, sourceType, genreTemplate)
        });
        
        // Generate alternative chains
        const alternatives = this.generateAlternatives(baseChain, sourceType, genreTemplate);
        alternatives.forEach(alt => {
            recommendations.push({
                chain: alt.chain,
                suggestions: alt.suggestions || [],
                confidence: alt.confidence,
                description: alt.description
            });
        });
        
        return recommendations;
    }
    
    /**
     * Get reason for effect
     */
    getEffectReason(effectId, sourceType, genre) {
        const reasons = {
            'eq-highpass': 'Removes low-frequency rumble and cleans up the low end',
            'eq-subtractive': 'Shapes frequency response for better mix fit',
            'eq-presence': 'Adds clarity and presence to cut through the mix',
            'eq-warm': 'Adds warmth and body to the sound',
            'compression-light': 'Gentle dynamic control with transparency',
            'compression-medium': 'Moderate dynamic control for consistent level',
            'compression-heavy': 'Aggressive dynamic control for punch and power',
            'compression-punchy': 'Fast attack for tight, punchy sound',
            'reverb-plate': 'Adds depth and space with bright character',
            'reverb-room': 'Natural room ambience for realistic space',
            'reverb-hall': 'Large, spacious reverb for epic feel',
            'delay': 'Adds rhythmic interest and depth',
            'saturation': 'Adds harmonic richness and warmth',
            'deesser': 'Controls sibilance in vocal tracks',
            'sidechain': 'Creates pumping effect with kick drum',
            'limiter': 'Prevents clipping and maximizes loudness'
        };
        
        return reasons[effectId] || `Recommended for ${sourceType} in ${genre.name || genre}`;
    }
    
    /**
     * Calculate recommendation confidence
     */
    calculateConfidence(chain, sourceType, genre) {
        // Base confidence
        let confidence = 0.7;
        
        // Boost for matching source type
        const sourceDef = this.sourceTypes[sourceType];
        if (sourceDef) {
            confidence += 0.1;
        }
        
        // Boost for chain length (more specific recommendation)
        if (chain.length >= 3 && chain.length <= 6) {
            confidence += 0.1;
        }
        
        // Cap at 1.0
        return Math.min(1, confidence);
    }
    
    /**
     * Generate chain description
     */
    generateDescription(chain, sourceType, genre) {
        const effectNames = chain.map(e => e.name).join(' → ');
        return `${this.sourceTypes[sourceType]?.name || sourceType} chain for ${genre.name || genre}: ${effectNames}`;
    }
    
    /**
     * Generate alternative chains
     */
    generateAlternatives(baseChain, sourceType, genre) {
        const alternatives = [];
        
        // Minimal chain
        alternatives.push({
            chain: baseChain.slice(0, 3).map((id, i) => ({
                position: i,
                id,
                name: this.effects[id]?.name || id,
                category: this.effects[id]?.category || 'unknown',
                params: { ...this.effects[id]?.params },
                reason: 'Minimal chain for quick results'
            })),
            confidence: 0.6,
            description: 'Minimal chain - quick setup'
        });
        
        // Extended chain
        if (baseChain.length > 3) {
            alternatives.push({
                chain: [...baseChain, 'limiter'].map((id, i) => ({
                    position: i,
                    id,
                    name: this.effects[id]?.name || id,
                    category: this.effects[id]?.category || 'unknown',
                    params: { ...this.effects[id]?.params },
                    reason: i === baseChain.length ? 'Safety limiter at end of chain' : this.getEffectReason(id, sourceType, genre)
                })),
                confidence: 0.75,
                description: 'Extended chain with safety limiter'
            });
        }
        
        return alternatives;
    }
    
    /**
     * Get available source types
     */
    getSourceTypes() {
        return Object.keys(this.sourceTypes);
    }
    
    /**
     * Get available genres
     */
    getGenres() {
        return Object.keys(this.genreTemplates);
    }
    
    /**
     * Get effect by ID
     */
    getEffect(effectId) {
        return this.effects[effectId];
    }
    
    /**
     * Get recommendation history
     */
    getHistory() {
        return [...this.recommendationHistory];
    }
    
    /**
     * Export chain as JSON
     */
    exportChain(chain) {
        return JSON.stringify({
            chain,
            timestamp: Date.now(),
            version: '1.0'
        }, null, 2);
    }
}

// UI Panel
function openSmartFXChainPanel() {
    const existing = document.getElementById('smart-fx-chain-panel');
    if (existing) {
        existing.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'smart-fx-chain-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 1px solid #3b82f6;
        border-radius: 12px;
        padding: 24px;
        width: 650px;
        max-height: 90vh;
        overflow-y: auto;
        z-index: 10000;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;
    
    const sfx = new SmartFXChain();
    const sourceTypes = sfx.getSourceTypes();
    const genres = sfx.getGenres();
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #3b82f6; font-size: 20px;">🤖 Smart FX Chain</h2>
            <button id="close-fx-chain-panel" style="background: transparent; border: none; color: #888; font-size: 24px; cursor: pointer;">×</button>
        </div>
        
        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 16px;">
            AI-powered effect chain recommendations based on source type and genre.
        </p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div>
                <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Source Type</label>
                <select id="fx-source-type" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                    <option value="">Auto-detect</option>
                    ${sourceTypes.map(t => `<option value="${t}">${sfx.sourceTypes[t].name}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="display: block; color: #9ca3af; font-size: 12px; margin-bottom: 4px;">Genre</label>
                <select id="fx-genre" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #374151; border-radius: 4px; color: white;">
                    ${genres.map(g => `<option value="${g}">${sfx.genreTemplates[g].name}</option>`).join('')}
                </select>
            </div>
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button id="analyze-audio-fx" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Analyze & Recommend
            </button>
            <button id="apply-chain" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: bold;">
                Apply to Track
            </button>
        </div>
        
        <div id="fx-chain-results" style="display: none;">
            <div id="analysis-info" style="background: #0f172a; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 8px; color: #f59e0b; font-size: 14px;">📊 Analysis</h3>
                <div id="analysis-details" style="color: #9ca3af; font-size: 12px;"></div>
            </div>
            
            <div id="recommendations-container">
                <h3 style="margin: 0 0 12px; color: #10b981; font-size: 14px;">✨ Recommended Chains</h3>
                <div id="chain-options"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-fx-chain-panel').onclick = () => panel.remove();
    
    document.getElementById('analyze-audio-fx').onclick = async () => {
        const resultsDiv = document.getElementById('fx-chain-results');
        const analysisDetails = document.getElementById('analysis-details');
        const chainOptions = document.getElementById('chain-options');
        
        resultsDiv.style.display = 'block';
        
        // Get audio from track
        const audioBuffer = window.getSelectedTrackAudio ? 
            await window.getSelectedTrackAudio() : null;
        
        const sourceType = document.getElementById('fx-source-type').value || null;
        const genre = document.getElementById('fx-genre').value;
        
        const sfx = new SmartFXChain();
        
        let recommendation;
        
        if (audioBuffer) {
            recommendation = await sfx.analyze(audioBuffer, {
                sourceType,
                genre,
                onProgress: (p) => {
                    analysisDetails.innerHTML = `<span style="color: #fcd34d;">${p.status}...</span>`;
                }
            });
        } else {
            // Generate without analysis
            const analysis = { characteristics: [] };
            recommendation = {
                sourceType: sourceType || 'synth',
                genre,
                analysis,
                recommendations: sfx.generateRecommendations(analysis, sourceType || 'synth', sfx.genreTemplates[genre], [])
            };
        }
        
        // Display analysis
        analysisDetails.innerHTML = `
            <strong>Source:</strong> ${sfx.sourceTypes[recommendation.sourceType]?.name || recommendation.sourceType}<br>
            <strong>Genre:</strong> ${sfx.genreTemplates[recommendation.genre]?.name || recommendation.genre}<br>
            <strong>Characteristics:</strong> ${recommendation.analysis.characteristics.join(', ') || 'N/A'}
        `;
        
        // Display recommendations
        chainOptions.innerHTML = '';
        
        recommendation.recommendations.forEach((rec, index) => {
            const chainDiv = document.createElement('div');
            chainDiv.style.cssText = 'background: #0a0a14; border-radius: 6px; padding: 12px; margin-bottom: 12px; border-left: 3px solid ' + (index === 0 ? '#10b981' : '#3b82f6');
            
            chainDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="color: ${index === 0 ? '#10b981' : '#3b82f6'}; font-weight: bold;">${index === 0 ? '⭐ Best Match' : 'Alternative ' + index}</span>
                    <span style="color: #9ca3af; font-size: 11px;">Confidence: ${(rec.confidence * 100).toFixed(0)}%</span>
                </div>
                <div style="color: #d1d5db; font-size: 11px; margin-bottom: 8px;">${rec.description}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px;">
                    ${rec.chain.map(e => `<span style="background: #1f2937; padding: 4px 8px; border-radius: 4px; font-size: 10px; color: #9ca3af;">${e.name}</span>`).join(' → ')}
                </div>
                ${rec.suggestions.length > 0 ? `
                    <div style="color: #f59e0b; font-size: 10px;">
                        💡 ${rec.suggestions.map(s => s.reason).join('; ')}
                    </div>
                ` : ''}
            `;
            
            chainOptions.appendChild(chainDiv);
        });
        
        // Store for apply
        window.fxRecommendation = recommendation;
    };
    
    document.getElementById('apply-chain').onclick = () => {
        if (!window.fxRecommendation) {
            alert('Please analyze audio first');
            return;
        }
        
        const chain = window.fxRecommendation.recommendations[0].chain;
        
        // Apply to track effects (placeholder - would integrate with actual effect system)
        console.log('[SmartFXChain] Applying chain:', chain);
        
        if (window.applyEffectChainToTrack) {
            window.applyEffectChainToTrack(chain);
        } else {
            alert(`Effect chain applied: ${chain.map(e => e.name).join(' → ')}`);
        }
    };
}

// Export
window.SmartFXChain = SmartFXChain;
window.openSmartFXChainPanel = openSmartFXChainPanel;

console.log('[SmartFXChain] Module loaded');
