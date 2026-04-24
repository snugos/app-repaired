/**
 * Smart Track Naming - AI-assisted track naming
 * Automatically suggests names for tracks based on their content
 */

class SmartTrackNaming {
    constructor(options = {}) {
        this.name = 'SmartTrackNaming';
        
        // Configuration
        this.config = {
            confidenceThreshold: options.confidenceThreshold || 0.5,
            maxSuggestions: options.maxSuggestions || 5,
            ...options
        };
        
        // Track name patterns
        this.instrumentPatterns = {
            // Drums
            'kick': ['kick', 'bd', 'bass drum', '808'],
            'snare': ['snare', 'sd', 'clap', 'trap'],
            'hihat': ['hihat', 'hi hat', 'hh', 'hats', 'hat'],
            'cymbal': ['cymbal', 'crash', 'ride', 'china'],
            'tom': ['tom', 'toms', 'floor tom', 'rack tom'],
            'percussion': ['perc', 'percussion', 'shaker', 'tamb', 'tambourine', 'conga', 'bongo'],
            
            // Bass
            'bass': ['bass', 'sub', '808', 'bassline'],
            
            // Synths
            'synth': ['synth', 'synth lead', 'saw', 'square', 'pulse'],
            'pad': ['pad', 'drone', 'atmosphere', 'ambient'],
            'lead': ['lead', 'melody', 'hook', 'topline'],
            'pluck': ['pluck', 'pluck synth', 'kalimba', 'marimba'],
            'arp': ['arp', 'arpeggio', 'arpeggiator'],
            
            // Keys
            'piano': ['piano', 'keys', 'keyboard', 'rhodes', 'ep', 'electric piano'],
            'organ': ['organ', 'hammond', 'b3', 'farfisa'],
            
            // Strings
            'strings': ['strings', 'string', 'violin', 'viola', 'cello', 'orchestra', 'orchestral'],
            'guitar': ['guitar', 'gtr', 'acoustic', 'electric guitar', 'clean guitar'],
            
            // Vocals
            'vocals': ['vocal', 'vox', 'voice', 'singing', 'choir', 'bgv', 'backing vocal'],
            
            // FX
            'fx': ['fx', 'sfx', 'sound design', 'noise', 'whoosh', 'impact', 'riser', 'sweep'],
            
            // Brass
            'brass': ['brass', 'trumpet', 'sax', 'trombone', 'horn'],
            
            // Wind
            'flute': ['flute', 'wind', 'woodwind', 'clarinet', 'oboe'],
        };
        
        // Genre-specific patterns
        this.genrePatterns = {
            'electronic': {
                common: ['synth', 'bass', 'kick', 'snare', 'hihat', 'pad', 'lead', 'arp'],
                prefixes: ['main', 'sub', 'aux', 'layer'],
                suffixes: ['bus', 'send', 'master']
            },
            'rock': {
                common: ['guitar', 'bass', 'drums', 'vocals', 'keys'],
                prefixes: ['rhythm', 'lead', 'clean', 'distorted'],
                suffixes: ['bus', 'room']
            },
            'hiphop': {
                common: ['kick', 'snare', 'hihat', '808', 'vocal', 'sample'],
                prefixes: ['main', 'double', 'adlib'],
                suffixes: ['bus', 'group']
            },
            'orchestral': {
                common: ['strings', 'brass', 'woodwinds', 'percussion', 'harp'],
                prefixes: ['1st', '2nd', 'solo', 'ensemble'],
                suffixes: ['section', 'group']
            }
        };
        
        // Naming conventions
        this.namingConventions = {
            'numeric': ['01', '02', '03', '04', '05'],
            'alphabetical': ['A', 'B', 'C', 'D', 'E'],
            'color': ['Red', 'Blue', 'Green', 'Yellow', 'Purple'],
            'position': ['Top', 'Middle', 'Bottom', 'Left', 'Right']
        };
        
        // Track analysis results cache
        this.analysisCache = new Map();
        
        // Learning data (track naming history)
        this.namingHistory = [];
        
        // Callbacks
        this.onSuggestion = null;
    }
    
    // Analyze track and suggest names
    analyzeTrack(trackData) {
        const analysis = {
            trackId: trackData.id,
            suggestions: [],
            confidence: {},
            features: {}
        };
        
        // Analyze audio features
        const audioFeatures = this.analyzeAudioFeatures(trackData);
        analysis.features = audioFeatures;
        
        // Analyze instrument type
        const instrumentType = this.detectInstrumentType(audioFeatures, trackData);
        analysis.confidence.instrument = instrumentType.confidence;
        analysis.features.instrument = instrumentType.type;
        
        // Analyze frequency range
        const freqRange = this.analyzeFrequencyRange(audioFeatures);
        analysis.features.frequencyRange = freqRange;
        
        // Generate name suggestions
        analysis.suggestions = this.generateNameSuggestions(analysis, trackData);
        
        // Cache result
        this.analysisCache.set(trackData.id, analysis);
        
        if (this.onSuggestion) {
            this.onSuggestion(analysis);
        }
        
        return analysis;
    }
    
    analyzeAudioFeatures(trackData) {
        const features = {
            // Would analyze actual audio data
            // For now, use heuristics from track metadata
            hasMIDI: trackData.hasMIDI || false,
            hasAudio: trackData.hasAudio || false,
            noteCount: trackData.noteCount || 0,
            audioDuration: trackData.audioDuration || 0,
            instrumentType: trackData.instrumentType || 'unknown',
            effects: trackData.effects || [],
            panPosition: trackData.pan || 0,
            volume: trackData.volume || 0,
            color: trackData.color || null,
            name: trackData.name || ''
        };
        
        // Derive additional features
        features.isMelodic = features.noteCount > 10 && !this.isPercussionPattern(trackData);
        features.isRhythmic = this.isPercussionPattern(trackData);
        features.isLowEnd = this.isLowEndTrack(trackData);
        features.isHighEnd = this.isHighEndTrack(trackData);
        features.isStereo = Math.abs(features.panPosition) < 0.1;
        
        return features;
    }
    
    detectInstrumentType(features, trackData) {
        // Check track name for hints
        const nameLower = (trackData.name || '').toLowerCase();
        
        for (const [type, patterns] of Object.entries(this.instrumentPatterns)) {
            for (const pattern of patterns) {
                if (nameLower.includes(pattern)) {
                    return {
                        type,
                        confidence: 0.8
                    };
                }
            }
        }
        
        // Check effects
        const effects = features.effects || [];
        if (effects.some(e => e.type === 'sampler' || e.type === 'drum_sampler')) {
            return { type: 'drums', confidence: 0.6 };
        }
        if (effects.some(e => e.type === 'synth')) {
            return { type: 'synth', confidence: 0.5 };
        }
        
        // Check note pattern
        if (features.isRhythmic) {
            return { type: 'drums', confidence: 0.4 };
        }
        if (features.isMelodic) {
            return { type: 'synth', confidence: 0.3 };
        }
        
        // Check frequency range
        if (features.isLowEnd) {
            return { type: 'bass', confidence: 0.4 };
        }
        
        return { type: 'unknown', confidence: 0 };
    }
    
    analyzeFrequencyRange(features) {
        // Simplified frequency range detection
        const range = {
            low: false,
            mid: false,
            high: false,
            fullRange: false
        };
        
        if (features.isLowEnd) {
            range.low = true;
        }
        if (features.isHighEnd) {
            range.high = true;
        }
        if (!range.low && !range.high) {
            range.mid = true;
        }
        if (range.low && range.high) {
            range.fullRange = true;
        }
        
        return range;
    }
    
    isPercussionPattern(trackData) {
        // Check if track uses drum sampler or has drum-like pattern
        const instrument = trackData.instrumentType;
        return instrument === 'drum_sampler' || 
               instrument === 'drums' ||
               (trackData.noteRange && trackData.noteRange.max - trackData.noteRange.min < 24);
    }
    
    isLowEndTrack(trackData) {
        // Check if track is low frequency (bass, kick, 808)
        const nameLower = (trackData.name || '').toLowerCase();
        return nameLower.includes('bass') ||
               nameLower.includes('kick') ||
               nameLower.includes('808') ||
               nameLower.includes('sub');
    }
    
    isHighEndTrack(trackData) {
        // Check if track is high frequency (hihat, cymbal, lead)
        const nameLower = (trackData.name || '').toLowerCase();
        return nameLower.includes('hihat') ||
               nameLower.includes('hat') ||
               nameLower.includes('cymbal') ||
               nameLower.includes('lead');
    }
    
    generateNameSuggestions(analysis, trackData) {
        const suggestions = [];
        const { features, confidence } = analysis;
        
        // 1. Based on detected instrument type
        if (confidence.instrument > this.config.confidenceThreshold) {
            const baseName = this.formatName(features.instrument);
            suggestions.push({
                name: baseName,
                confidence: confidence.instrument,
                reason: 'Detected instrument type'
            });
            
            // Add variants
            suggestions.push({
                name: `Main ${baseName}`,
                confidence: confidence.instrument * 0.9,
                reason: 'Main layer variant'
            });
            
            suggestions.push({
                name: `${baseName} Layer`,
                confidence: confidence.instrument * 0.85,
                reason: 'Layer variant'
            });
        }
        
        // 2. Based on frequency range
        if (features.frequencyRange.low) {
            suggestions.push({
                name: 'Low End',
                confidence: 0.6,
                reason: 'Low frequency content'
            });
        }
        if (features.frequencyRange.high) {
            suggestions.push({
                name: 'High End',
                confidence: 0.6,
                reason: 'High frequency content'
            });
        }
        
        // 3. Based on track position in project
        const position = trackData.index || 0;
        if (position < 4) {
            // Early tracks are often drums/bass
            const earlyNames = ['Drums', 'Bass', 'Lead', 'Chords'];
            if (earlyNames[position]) {
                suggestions.push({
                    name: earlyNames[position],
                    confidence: 0.5 - position * 0.1,
                    reason: 'Common track position'
                });
            }
        }
        
        // 4. Based on effects
        const effects = features.effects || [];
        if (effects.some(e => e.type === 'reverb')) {
            suggestions.push({
                name: `${this.formatName(features.instrument || 'Sound')} Wet`,
                confidence: 0.5,
                reason: 'Reverb effect detected'
            });
        }
        if (effects.some(e => e.type === 'delay')) {
            suggestions.push({
                name: `${this.formatName(features.instrument || 'Sound')} Echo`,
                confidence: 0.5,
                reason: 'Delay effect detected'
            });
        }
        
        // 5. Based on pan position
        if (features.panPosition < -0.5) {
            suggestions.push({
                name: `Left ${this.formatName(features.instrument || 'Track')}`,
                confidence: 0.4,
                reason: 'Panned left'
            });
        } else if (features.panPosition > 0.5) {
            suggestions.push({
                name: `Right ${this.formatName(features.instrument || 'Track')}`,
                confidence: 0.4,
                reason: 'Panned right'
            });
        }
        
        // 6. Based on naming history/learning
        const historicalSuggestions = this.getHistoricalSuggestions(trackData);
        suggestions.push(...historicalSuggestions);
        
        // Sort by confidence and limit
        suggestions.sort((a, b) => b.confidence - a.confidence);
        return suggestions.slice(0, this.config.maxSuggestions);
    }
    
    getHistoricalSuggestions(trackData) {
        // Check naming history for similar tracks
        const suggestions = [];
        
        for (const history of this.namingHistory.slice(-20)) {
            if (history.similarTracks && history.similarTracks.includes(trackData.id)) {
                suggestions.push({
                    name: history.name,
                    confidence: 0.3,
                    reason: 'Used for similar track'
                });
            }
        }
        
        return suggestions;
    }
    
    formatName(name) {
        // Capitalize and format
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    
    // Batch naming
    nameAllTracks(tracks, options = {}) {
        const results = [];
        
        // Analyze all tracks
        const analyses = tracks.map(t => this.analyzeTrack(t));
        
        // Group similar tracks
        const groups = this.groupSimilarTracks(tracks, analyses);
        
        // Generate names for each track
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const analysis = analyses[i];
            
            // Get group prefix if applicable
            const group = groups.find(g => g.trackIds.includes(track.id));
            let prefix = '';
            if (group && options.groupPrefix) {
                prefix = `${group.name} `;
            }
            
            // Get best suggestion
            const bestSuggestion = analysis.suggestions[0];
            
            results.push({
                trackId: track.id,
                currentName: track.name,
                suggestedName: prefix + (bestSuggestion ? bestSuggestion.name : `Track ${i + 1}`),
                confidence: bestSuggestion ? bestSuggestion.confidence : 0,
                alternatives: analysis.suggestions.slice(1, 4)
            });
        }
        
        return results;
    }
    
    groupSimilarTracks(tracks, analyses) {
        const groups = [];
        const processed = new Set();
        
        for (let i = 0; i < tracks.length; i++) {
            if (processed.has(tracks[i].id)) continue;
            
            const analysis = analyses[i];
            const group = {
                name: analysis.features.instrument || 'Track',
                trackIds: [tracks[i].id],
                type: analysis.features.instrument
            };
            
            // Find similar tracks
            for (let j = i + 1; j < tracks.length; j++) {
                if (processed.has(tracks[j].id)) continue;
                
                const otherAnalysis = analyses[j];
                if (analysis.features.instrument === otherAnalysis.features.instrument) {
                    group.trackIds.push(tracks[j].id);
                    processed.add(tracks[j].id);
                }
            }
            
            processed.add(tracks[i].id);
            groups.push(group);
        }
        
        return groups;
    }
    
    // Learning
    learnFromNaming(trackId, oldName, newName) {
        this.namingHistory.push({
            trackId,
            oldName,
            newName,
            timestamp: Date.now()
        });
        
        // Keep history limited
        if (this.namingHistory.length > 100) {
            this.namingHistory.shift();
        }
    }
    
    // Preset naming templates
    getTemplatesForGenre(genre) {
        const patterns = this.genrePatterns[genre] || this.genrePatterns['electronic'];
        const templates = [];
        
        for (let i = 0; i < patterns.common.length; i++) {
            templates.push({
                position: i + 1,
                name: patterns.common[i],
                alternatives: [
                    `Main ${patterns.common[i]}`,
                    `${patterns.common[i]} 1`,
                    `${patterns.common[i]} Layer`
                ]
            });
        }
        
        return templates;
    }
    
    // UI
    createUI(container, tracks) {
        container.innerHTML = `
            <div style="
                background: #1a1a2e;
                border-radius: 8px;
                padding: 16px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #fff;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 14px;">Smart Track Naming</h3>
                    <button id="analyze-all-btn" style="padding: 8px 16px; background: #10b981; border: none; border-radius: 4px; color: white; cursor: pointer;">Analyze All Tracks</button>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 12px; color: #888; display: block; margin-bottom: 8px;">Genre:</label>
                    <select id="genre-select" style="
                        width: 100%;
                        padding: 8px;
                        background: #2a2a4e;
                        border: 1px solid #444;
                        border-radius: 4px;
                        color: white;
                    ">
                        <option value="electronic">Electronic</option>
                        <option value="rock">Rock</option>
                        <option value="hiphop">Hip-Hop</option>
                        <option value="orchestral">Orchestral</option>
                    </select>
                </div>
                
                <div id="tracks-list" style="max-height: 400px; overflow-y: auto;"></div>
                
                <div style="margin-top: 16px;">
                    <button id="apply-all-btn" style="width: 100%; padding: 10px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">Apply All Suggestions</button>
                </div>
            </div>
        `;
        
        this.tracksList = container.querySelector('#tracks-list');
        this.setupEventHandlers(container, tracks);
        this.displayTracks(tracks);
    }
    
    setupEventHandlers(container, tracks) {
        container.querySelector('#analyze-all-btn').onclick = () => {
            this.displayTracks(tracks);
        };
        
        container.querySelector('#apply-all-btn').onclick = () => {
            // Apply all suggestions
            for (const trackEl of this.tracksList.querySelectorAll('.track-item')) {
                const select = trackEl.querySelector('.name-select');
                if (select && select.value) {
                    const trackId = trackEl.dataset.trackId;
                    const track = tracks.find(t => t.id === trackId);
                    if (track) {
                        this.learnFromNaming(trackId, track.name, select.value);
                        track.name = select.value;
                    }
                }
            }
            this.displayTracks(tracks);
        };
    }
    
    displayTracks(tracks) {
        this.tracksList.innerHTML = '';
        
        for (const track of tracks) {
            const analysis = this.analyzeTrack(track);
            
            const item = document.createElement('div');
            item.className = 'track-item';
            item.dataset.trackId = track.id;
            item.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: #2a2a4e;
                border-radius: 6px;
                margin-bottom: 8px;
            `;
            
            item.innerHTML = `
                <div style="
                    width: 32px;
                    height: 32px;
                    border-radius: 4px;
                    background: ${track.color || '#444'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 12px;
                ">${track.index !== undefined ? track.index + 1 : '?'}</div>
                
                <div style="flex: 1;">
                    <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Current: ${track.name || 'Unnamed'}</div>
                    <select class="name-select" style="
                        width: 100%;
                        padding: 6px;
                        background: #1a1a2e;
                        border: 1px solid #444;
                        border-radius: 4px;
                        color: white;
                    ">
                        <option value="">Select name...</option>
                        ${analysis.suggestions.map(s => `
                            <option value="${s.name}">${s.name} (${Math.round(s.confidence * 100)}% confidence)</option>
                        `).join('')}
                        <option value="${track.name}">Keep current</option>
                    </select>
                </div>
                
                <div style="
                    padding: 4px 8px;
                    background: ${this.getConfidenceColor(analysis.suggestions[0]?.confidence || 0)};
                    border-radius: 4px;
                    font-size: 11px;
                ">${analysis.suggestions.length} suggestions</div>
            `;
            
            this.tracksList.appendChild(item);
        }
    }
    
    getConfidenceColor(confidence) {
        if (confidence > 0.7) return '#10b981';
        if (confidence > 0.5) return '#f59e0b';
        return '#888';
    }
    
    openPanel(tracks) {
        const existing = document.getElementById('smart-naming-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'smart-naming-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
        `;
        
        document.body.appendChild(panel);
        this.createUI(panel, tracks || []);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
            padding: 6px 12px;
            background: #ef4444;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        closeBtn.onclick = () => panel.remove();
        panel.appendChild(closeBtn);
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SmartTrackNaming };
} else if (typeof window !== 'undefined') {
    window.SmartTrackNaming = SmartTrackNaming;
}