/**
 * AIMixingSuggestions.js
 * AI-powered mixing suggestions and recommendations
 */

class AIMixingSuggestions {
    constructor() {
        this.suggestions = [];
        this.analysisResults = null;
        this.isEnabled = true;
        this.analysisDepth = 'standard'; // quick, standard, deep
        this.suggestionHistory = [];
        this.maxHistory = 50;
        
        // Mixing rules and heuristics
        this.mixingRules = this.initMixingRules();
        
        // Frequency bands for analysis
        this.frequencyBands = {
            sub: { min: 20, max: 60, name: 'Sub Bass' },
            bass: { min: 60, max: 250, name: 'Bass' },
            lowMid: { min: 250, max: 500, name: 'Low-Mid' },
            mid: { min: 500, max: 2000, name: 'Mid' },
            highMid: { min: 2000, max: 4000, name: 'High-Mid' },
            presence: { min: 4000, max: 6000, name: 'Presence' },
            brilliance: { min: 6000, max: 20000, name: 'Brilliance' }
        };
        
        // Target levels for different genres
        this.genreTargets = {
            pop: { lufs: -14, dynamicRange: 8, stereoWidth: 0.8 },
            rock: { lufs: -12, dynamicRange: 10, stereoWidth: 0.7 },
            electronic: { lufs: -10, dynamicRange: 6, stereoWidth: 0.9 },
            hipHop: { lufs: -11, dynamicRange: 7, stereoWidth: 0.75 },
            jazz: { lufs: -16, dynamicRange: 14, stereoWidth: 0.6 },
            classical: { lufs: -18, dynamicRange: 20, stereoWidth: 0.5 },
            metal: { lufs: -9, dynamicRange: 5, stereoWidth: 0.7 },
            acoustic: { lufs: -15, dynamicRange: 12, stereoWidth: 0.4 },
            ambient: { lufs: -16, dynamicRange: 15, stereoWidth: 0.9 },
            default: { lufs: -14, dynamicRange: 10, stereoWidth: 0.7 }
        };
        
        // Problem severity thresholds
        this.thresholds = {
            clipping: -0.1, // dB
            lowHeadroom: -3, // dB
            highDynamicRange: 20, // dB
            lowDynamicRange: 3, // dB
            narrowStereo: 0.3,
            wideStereo: 0.95,
            frequencyMasking: 6 // dB overlap
        };
        
        this.init();
    }
    
    init() {
        console.log('[AIMixing] Initialized');
    }
    
    initMixingRules() {
        return [
            // Gain staging rules
            {
                id: 'gain-staging-headroom',
                name: 'Maintain Headroom',
                category: 'gain',
                check: (analysis) => {
                    if (analysis.peakLevel > -1) {
                        return {
                            severity: 'critical',
                            message: 'Clipping detected! Peak level exceeds 0dB.',
                            suggestion: 'Reduce master volume or individual track levels to prevent clipping.'
                        };
                    }
                    if (analysis.peakLevel > -3) {
                        return {
                            severity: 'warning',
                            message: 'Low headroom detected.',
                            suggestion: 'Leave at least 3-6dB of headroom on the master bus for mastering flexibility.'
                        };
                    }
                    return null;
                }
            },
            
            // Dynamic range rules
            {
                id: 'dynamic-range',
                name: 'Dynamic Range Check',
                category: 'dynamics',
                check: (analysis) => {
                    const dr = analysis.dynamicRange;
                    if (dr < 3) {
                        return {
                            severity: 'warning',
                            message: 'Very low dynamic range - mix may sound over-compressed.',
                            suggestion: 'Reduce compression or limiting to restore punch and life to the mix.'
                        };
                    }
                    if (dr > 20) {
                        return {
                            severity: 'info',
                            message: 'High dynamic range detected.',
                            suggestion: 'Consider light compression to control dynamics for more consistent playback.'
                        };
                    }
                    return null;
                }
            },
            
            // Frequency balance rules
            {
                id: 'frequency-balance',
                name: 'Frequency Balance',
                category: 'eq',
                check: (analysis) => {
                    const bands = analysis.frequencyBands;
                    const issues = [];
                    
                    // Check for muddy low-mids
                    if (bands.lowMid.level > bands.mid.level + 6) {
                        issues.push('Muddy low-mids detected');
                    }
                    
                    // Check for harsh high-mids
                    if (bands.highMid.level > bands.mid.level + 6) {
                        issues.push('Harsh high-mids may need taming');
                    }
                    
                    // Check for lack of presence
                    if (bands.presence.level < bands.mid.level - 6) {
                        issues.push('Lack of presence can make mix sound dull');
                    }
                    
                    if (issues.length > 0) {
                        return {
                            severity: 'warning',
                            message: 'Frequency balance issues detected.',
                            suggestion: issues.join('. ') + '. Consider EQ adjustments to balance the frequency spectrum.'
                        };
                    }
                    return null;
                }
            },
            
            // Stereo width rules
            {
                id: 'stereo-width',
                name: 'Stereo Width',
                category: 'stereo',
                check: (analysis) => {
                    const width = analysis.stereoWidth;
                    if (width < 0.3) {
                        return {
                            severity: 'info',
                            message: 'Narrow stereo image detected.',
                            suggestion: 'Consider widening some elements with stereo imaging tools for a more immersive mix.'
                        };
                    }
                    if (width > 0.95) {
                        return {
                            severity: 'warning',
                            message: 'Very wide stereo image may cause phase issues.',
                            suggestion: 'Check mono compatibility and consider narrowing the stereo field slightly.'
                        };
                    }
                    return null;
                }
            },
            
            // Frequency masking rules
            {
                id: 'frequency-masking',
                name: 'Frequency Masking',
                category: 'eq',
                check: (analysis) => {
                    if (analysis.maskingIssues && analysis.maskingIssues.length > 0) {
                        return {
                            severity: 'warning',
                            message: `Frequency masking detected between ${analysis.maskingIssues.length} track pairs.`,
                            suggestion: 'Use EQ to carve out space for each element. Consider sidechain compression for conflicting low-end elements.'
                        };
                    }
                    return null;
                }
            },
            
            // LUFS target rules
            {
                id: 'lufs-target',
                name: 'Loudness Standards',
                category: 'loudness',
                check: (analysis, genre = 'default') => {
                    const target = this.genreTargets[genre] || this.genreTargets.default;
                    const lufsDiff = analysis.lufs - target.lufs;
                    
                    if (Math.abs(lufsDiff) > 2) {
                        return {
                            severity: lufsDiff > 0 ? 'warning' : 'info',
                            message: `LUFS (${analysis.lufs.toFixed(1)}) ${lufsDiff > 0 ? 'exceeds' : 'below'} ${genre} target (${target.lufs}).`,
                            suggestion: lufsDiff > 0 
                                ? 'Reduce overall loudness for better dynamic range and streaming platform compliance.'
                                : 'Increase loudness if needed, but maintain dynamics.'
                        };
                    }
                    return null;
                }
            }
        ];
    }
    
    // Analyze the current mix
    async analyzeMix(audioContext, tracks, masterOutput, options = {}) {
        const startTime = Date.now();
        
        const analysis = {
            timestamp: new Date().toISOString(),
            duration: 0,
            peakLevel: 0,
            rmsLevel: 0,
            lufs: 0,
            dynamicRange: 0,
            stereoWidth: 0,
            frequencyBands: {},
            maskingIssues: [],
            trackAnalysis: [],
            genreGuess: null,
            suggestions: []
        };
        
        try {
            // Analyze master output
            if (masterOutput) {
                const masterAnalysis = await this.analyzeNode(masterOutput, audioContext);
                analysis.peakLevel = masterAnalysis.peakLevel;
                analysis.rmsLevel = masterAnalysis.rmsLevel;
                analysis.lufs = masterAnalysis.lufs;
                analysis.dynamicRange = masterAnalysis.dynamicRange;
                analysis.stereoWidth = masterAnalysis.stereoWidth;
                analysis.frequencyBands = masterAnalysis.frequencyBands;
            }
            
            // Analyze individual tracks
            if (tracks && tracks.length > 0) {
                for (const track of tracks) {
                    if (track.outputNode) {
                        const trackAnalysis = await this.analyzeTrack(track, audioContext);
                        analysis.trackAnalysis.push(trackAnalysis);
                    }
                }
                
                // Detect masking issues
                analysis.maskingIssues = this.detectMasking(analysis.trackAnalysis);
            }
            
            // Guess genre based on characteristics
            analysis.genreGuess = this.guessGenre(analysis);
            
            // Generate suggestions
            analysis.suggestions = this.generateSuggestions(analysis, options.genre || analysis.genreGuess);
            
            // Store results
            this.analysisResults = analysis;
            analysis.duration = Date.now() - startTime;
            
            console.log(`[AIMixing] Analysis complete in ${analysis.duration}ms`);
            
            return analysis;
            
        } catch (error) {
            console.error('[AIMixing] Analysis failed:', error);
            return null;
        }
    }
    
    async analyzeNode(node, audioContext) {
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 8192;
        node.connect(analyser);
        
        return new Promise((resolve) => {
            setTimeout(() => {
                const dataArray = new Float32Array(analyser.fftSize);
                const frequencyData = new Float32Array(analyser.frequencyBinCount);
                
                analyser.getFloatTimeDomainData(dataArray);
                analyser.getFloatFrequencyData(frequencyData);
                
                // Calculate peak level
                let peak = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    const abs = Math.abs(dataArray[i]);
                    if (abs > peak) peak = abs;
                }
                const peakLevel = 20 * Math.log10(peak + 0.00001);
                
                // Calculate RMS
                let sumSquares = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sumSquares += dataArray[i] * dataArray[i];
                }
                const rms = Math.sqrt(sumSquares / dataArray.length);
                const rmsLevel = 20 * Math.log10(rms + 0.00001);
                
                // Estimate LUFS (simplified)
                const lufs = rmsLevel - 10; // Rough approximation
                
                // Calculate dynamic range
                const dynamicRange = peakLevel - rmsLevel;
                
                // Estimate stereo width (simplified)
                const stereoWidth = 0.7; // Would need stereo analysis
                
                // Analyze frequency bands
                const frequencyBands = this.analyzeFrequencyBands(frequencyData, audioContext.sampleRate);
                
                analyser.disconnect();
                
                resolve({
                    peakLevel,
                    rmsLevel,
                    lufs,
                    dynamicRange,
                    stereoWidth,
                    frequencyBands
                });
            }, 100);
        });
    }
    
    async analyzeTrack(track, audioContext) {
        const analysis = {
            trackId: track.id,
            trackName: track.name,
            type: track.type,
            level: track.volume || 0,
            pan: track.pan || 0,
            muted: track.muted || false,
            soloed: track.solo || false,
            frequencyBands: {},
            peakLevel: 0,
            effects: []
        };
        
        if (track.outputNode) {
            const nodeAnalysis = await this.analyzeNode(track.outputNode, audioContext);
            analysis.frequencyBands = nodeAnalysis.frequencyBands;
            analysis.peakLevel = nodeAnalysis.peakLevel;
        }
        
        // Analyze effects chain
        if (track.effects) {
            analysis.effects = track.effects.map(e => ({
                type: e.type,
                enabled: e.enabled
            }));
        }
        
        return analysis;
    }
    
    analyzeFrequencyBands(frequencyData, sampleRate) {
        const bands = {};
        const binSize = sampleRate / (frequencyData.length * 2);
        
        for (const [key, band] of Object.entries(this.frequencyBands)) {
            const startBin = Math.floor(band.min / binSize);
            const endBin = Math.min(Math.floor(band.max / binSize), frequencyData.length - 1);
            
            let sum = 0;
            let count = 0;
            for (let i = startBin; i <= endBin; i++) {
                sum += frequencyData[i];
                count++;
            }
            
            bands[key] = {
                name: band.name,
                level: count > 0 ? sum / count : -100,
                range: { min: band.min, max: band.max }
            };
        }
        
        return bands;
    }
    
    detectMasking(trackAnalyses) {
        const maskingIssues = [];
        
        for (let i = 0; i < trackAnalyses.length; i++) {
            for (let j = i + 1; j < trackAnalyses.length; j++) {
                const track1 = trackAnalyses[i];
                const track2 = trackAnalyses[j];
                
                // Check for overlapping dominant frequencies
                const bands1 = track1.frequencyBands;
                const bands2 = track2.frequencyBands;
                
                for (const [bandKey, band1] of Object.entries(bands1)) {
                    const band2 = bands2[bandKey];
                    if (band2) {
                        const levelDiff = Math.abs(band1.level - band2.level);
                        if (levelDiff < this.thresholds.frequencyMasking && band1.level > -40) {
                            maskingIssues.push({
                                track1: track1.trackName,
                                track2: track2.trackName,
                                frequencyBand: band1.name,
                                levelDiff
                            });
                        }
                    }
                }
            }
        }
        
        return maskingIssues;
    }
    
    guessGenre(analysis) {
        const scores = {};
        
        for (const [genre, target] of Object.entries(this.genreTargets)) {
            if (genre === 'default') continue;
            
            let score = 0;
            
            // LUFS similarity
            const lufsDiff = Math.abs(analysis.lufs - target.lufs);
            score -= lufsDiff;
            
            // Dynamic range similarity
            const drDiff = Math.abs(analysis.dynamicRange - target.dynamicRange);
            score -= drDiff * 0.5;
            
            // Stereo width similarity
            const widthDiff = Math.abs(analysis.stereoWidth - target.stereoWidth);
            score -= widthDiff * 10;
            
            scores[genre] = score;
        }
        
        // Find best match
        let bestGenre = 'default';
        let bestScore = -Infinity;
        
        for (const [genre, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestGenre = genre;
            }
        }
        
        return bestGenre;
    }
    
    generateSuggestions(analysis, genre = 'default') {
        const suggestions = [];
        
        // Apply all mixing rules
        for (const rule of this.mixingRules) {
            const result = rule.check(analysis, genre);
            if (result) {
                suggestions.push({
                    id: rule.id,
                    category: rule.category,
                    severity: result.severity,
                    message: result.message,
                    suggestion: result.suggestion,
                    autoFixAvailable: this.hasAutoFix(rule.id)
                });
            }
        }
        
        // Sort by severity
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
        
        this.suggestions = suggestions;
        return suggestions;
    }
    
    hasAutoFix(ruleId) {
        const autoFixable = ['gain-staging-headroom', 'frequency-balance'];
        return autoFixable.includes(ruleId);
    }
    
    // Apply automatic fixes
    applyAutoFix(suggestionId, tracks, masterOutput) {
        const suggestion = this.suggestions.find(s => s.id === suggestionId);
        if (!suggestion || !suggestion.autoFixAvailable) return false;
        
        switch (suggestionId) {
            case 'gain-staging-headroom':
                return this.autoFixHeadroom(tracks, masterOutput);
            case 'frequency-balance':
                return this.autoFixFrequencyBalance(tracks);
            default:
                return false;
        }
    }
    
    autoFixHeadroom(tracks, masterOutput) {
        // Reduce all track volumes by a calculated amount
        const reduction = Math.abs(this.analysisResults.peakLevel) < 3 
            ? -3 - this.analysisResults.peakLevel 
            : 0;
        
        if (reduction > 0) {
            tracks.forEach(track => {
                if (track.volume !== undefined) {
                    track.volume -= reduction;
                }
            });
            console.log(`[AIMixing] Applied auto-fix: reduced all tracks by ${reduction.toFixed(1)}dB`);
            return true;
        }
        return false;
    }
    
    autoFixFrequencyBalance(tracks) {
        // Apply corrective EQ based on frequency analysis
        const bands = this.analysisResults.frequencyBands;
        const corrections = [];
        
        // Identify imbalances
        const avgLevel = Object.values(bands).reduce((sum, b) => sum + b.level, 0) / Object.keys(bands).length;
        
        for (const [key, band] of Object.entries(bands)) {
            const diff = band.level - avgLevel;
            if (Math.abs(diff) > 6) {
                corrections.push({
                    band: key,
                    correction: -diff * 0.5
                });
            }
        }
        
        console.log('[AIMixing] Frequency corrections recommended:', corrections);
        return corrections;
    }
    
    // Get suggestions for a specific track
    getTrackSuggestions(trackId) {
        const trackAnalysis = this.analysisResults?.trackAnalysis?.find(t => t.trackId === trackId);
        if (!trackAnalysis) return [];
        
        const suggestions = [];
        
        // Check track level
        if (trackAnalysis.peakLevel > -6) {
            suggestions.push({
                severity: 'warning',
                message: 'Track is very hot',
                suggestion: 'Consider reducing track volume to leave room for other elements.'
            });
        }
        
        // Check if track has effects
        if (trackAnalysis.effects.length === 0 && trackAnalysis.type !== 'Audio') {
            suggestions.push({
                severity: 'info',
                message: 'No effects on this track',
                suggestion: 'Consider adding reverb, delay, or other effects to enhance the sound.'
            });
        }
        
        return suggestions;
    }
    
    // Compare with reference track
    async compareWithReference(audioContext, referenceNode) {
        if (!this.analysisResults) return null;
        
        const referenceAnalysis = await this.analyzeNode(referenceNode, audioContext);
        
        const comparison = {
            lufsDiff: this.analysisResults.lufs - referenceAnalysis.lufs,
            peakDiff: this.analysisResults.peakLevel - referenceAnalysis.peakLevel,
            dynamicRangeDiff: this.analysisResults.dynamicRange - referenceAnalysis.dynamicRange,
            stereoWidthDiff: this.analysisResults.stereoWidth - referenceAnalysis.stereoWidth,
            frequencyDiff: {}
        };
        
        // Compare frequency bands
        for (const [key, band] of Object.entries(this.analysisResults.frequencyBands)) {
            const refBand = referenceAnalysis.frequencyBands[key];
            if (refBand) {
                comparison.frequencyDiff[key] = {
                    diff: band.level - refBand.level,
                    name: band.name
                };
            }
        }
        
        return comparison;
    }
    
    // UI Panel
    openPanel() {
        const existing = document.getElementById('ai-mixing-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'ai-mixing-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 650px;
            max-height: 85vh;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            color: white;
            font-family: system-ui;
            z-index: 10000;
            overflow: hidden;
        `;
        
        panel.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 18px;">🤖 AI Mixing Suggestions</h3>
                    <button id="close-ai-mixing" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
                </div>
            </div>
            
            <div style="padding: 16px; max-height: 70vh; overflow-y: auto;">
                <button id="analyze-btn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer; margin-bottom: 16px;">
                    🔍 Analyze Mix
                </button>
                
                <div id="analysis-results" style="display: none;">
                    ${this.renderAnalysisResults()}
                </div>
                
                <div id="suggestions-list" style="margin-top: 16px;">
                    ${this.renderSuggestions()}
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupPanelEvents();
    }
    
    renderAnalysisResults() {
        if (!this.analysisResults) return '';
        
        const r = this.analysisResults;
        
        return `
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Analysis Results</h4>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 12px;">
                    <div style="padding: 8px; background: #1a1a2e; border-radius: 4px;">
                        <div style="color: #888;">Peak Level</div>
                        <div style="font-size: 16px; font-weight: bold; color: ${r.peakLevel > -3 ? '#ef4444' : '#10b981'};">${r.peakLevel.toFixed(1)} dB</div>
                    </div>
                    
                    <div style="padding: 8px; background: #1a1a2e; border-radius: 4px;">
                        <div style="color: #888;">LUFS</div>
                        <div style="font-size: 16px; font-weight: bold;">${r.lufs.toFixed(1)}</div>
                    </div>
                    
                    <div style="padding: 8px; background: #1a1a2e; border-radius: 4px;">
                        <div style="color: #888;">Dynamic Range</div>
                        <div style="font-size: 16px; font-weight: bold;">${r.dynamicRange.toFixed(1)} dB</div>
                    </div>
                    
                    <div style="padding: 8px; background: #1a1a2e; border-radius: 4px;">
                        <div style="color: #888;">Stereo Width</div>
                        <div style="font-size: 16px; font-weight: bold;">${(r.stereoWidth * 100).toFixed(0)}%</div>
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #333;">
                    <div style="color: #888; font-size: 11px;">Estimated Genre: <span style="color: #a78bfa;">${r.genreGuess || 'Unknown'}</span></div>
                </div>
            </div>
        `;
    }
    
    renderSuggestions() {
        if (!this.suggestions || this.suggestions.length === 0) {
            return '<div style="color: #666; font-size: 12px; text-align: center; padding: 20px;">Run analysis to get suggestions</div>';
        }
        
        const severityColors = {
            critical: { bg: '#fee2e2', border: '#ef4444', text: '#dc2626' },
            warning: { bg: '#fef3c7', border: '#f59e0b', text: '#d97706' },
            info: { bg: '#dbeafe', border: '#3b82f6', text: '#2563eb' }
        };
        
        return `
            <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Suggestions (${this.suggestions.length})</h4>
            ${this.suggestions.map(s => {
                const colors = severityColors[s.severity];
                return `
                    <div style="
                        background: ${colors.bg}15;
                        border-left: 3px solid ${colors.border};
                        padding: 12px;
                        margin-bottom: 8px;
                        border-radius: 0 4px 4px 0;
                    ">
                        <div style="font-size: 12px; font-weight: bold; color: ${colors.text}; margin-bottom: 4px; text-transform: uppercase;">
                            ${s.severity} • ${s.category}
                        </div>
                        <div style="font-size: 13px; margin-bottom: 4px;">${s.message}</div>
                        <div style="font-size: 11px; color: #888;">${s.suggestion}</div>
                        ${s.autoFixAvailable ? `
                            <button class="auto-fix-btn" data-id="${s.id}" style="
                                margin-top: 8px;
                                padding: 6px 12px;
                                background: #10b981;
                                border: none;
                                color: white;
                                border-radius: 3px;
                                font-size: 11px;
                                cursor: pointer;
                            ">Auto-Fix</button>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        `;
    }
    
    setupPanelEvents() {
        const panel = document.getElementById('ai-mixing-panel');
        if (!panel) return;
        
        panel.querySelector('#close-ai-mixing').onclick = () => panel.remove();
        
        panel.querySelector('#analyze-btn').onclick = async () => {
            const btn = panel.querySelector('#analyze-btn');
            btn.textContent = '⏳ Analyzing...';
            btn.disabled = true;
            
            // Dispatch event for main app to handle analysis
            this.dispatchEvent('analyze-requested');
            
            // Simulate analysis complete after a delay
            setTimeout(() => {
                btn.textContent = '🔍 Analyze Mix';
                btn.disabled = false;
                panel.querySelector('#analysis-results').style.display = 'block';
                panel.querySelector('#suggestions-list').innerHTML = this.renderSuggestions();
            }, 1500);
        };
        
        panel.querySelectorAll('.auto-fix-btn').forEach(btn => {
            btn.onclick = () => {
                const suggestionId = btn.dataset.id;
                this.dispatchEvent('auto-fix-requested', { suggestionId });
                btn.textContent = 'Applied ✓';
                btn.disabled = true;
            };
        });
    }
    
    closePanel() {
        const panel = document.getElementById('ai-mixing-panel');
        if (panel) panel.remove();
    }
    
    // Event system
    dispatchEvent(eventName, data = {}) {
        window.dispatchEvent(new CustomEvent(`ai-mixing:${eventName}`, { detail: data }));
    }
    
    on(eventName, callback) {
        window.addEventListener(`ai-mixing:${eventName}`, (e) => callback(e.detail));
    }
    
    off(eventName, callback) {
        window.removeEventListener(`ai-mixing:${eventName}`, callback);
    }
    
    // Cleanup
    dispose() {
        this.closePanel();
        this.suggestions = [];
        this.analysisResults = null;
    }
}

// Export singleton instance
const aiMixingSuggestions = new AIMixingSuggestions();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIMixingSuggestions, aiMixingSuggestions };
}