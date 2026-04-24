/**
 * SmartTrackGrouping.js
 * AI-powered automatic track organization and grouping
 */

class SmartTrackGrouping {
    constructor() {
        this.groups = [];
        this.suggestions = [];
        this.isEnabled = true;
        this.autoGroup = false;
        this.groupingRules = this.initGroupingRules();
        this.groupColors = [
            '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
            '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
        ];
        
        // Group presets
        this.groupPresets = {
            drums: { name: 'Drums', tracks: ['kick', 'snare', 'hihat', 'tom', 'cymbal', 'perc', 'drum'] },
            bass: { name: 'Bass', tracks: ['bass', 'sub'] },
            vocals: { name: 'Vocals', tracks: ['vocal', 'vox', 'lead', 'choir', 'bgv', 'harmony'] },
            guitars: { name: 'Guitars', tracks: ['guitar', 'gtr', 'acoustic', 'electric'] },
            keys: { name: 'Keys', tracks: ['piano', 'key', 'synth', 'organ', 'rhodes', 'wurl'] },
            strings: { name: 'Strings', tracks: ['violin', 'viola', 'cello', 'string', 'orchestral'] },
            brass: { name: 'Brass', tracks: ['trumpet', 'trombone', 'sax', 'brass', 'horn'] },
            fx: { name: 'FX', tracks: ['fx', 'sfx', 'ambience', 'noise', 'pad'] }
        };
        
        // Analysis settings
        this.analysisDepth = 'standard';
        this.minimumGroupSize = 2;
        this.maximumGroups = 10;
        
        this.init();
    }
    
    init() {
        console.log('[SmartGrouping] Initialized');
    }
    
    initGroupingRules() {
        return [
            // Name-based grouping
            {
                id: 'name-keyword',
                name: 'Name Keyword Match',
                weight: 1.0,
                evaluate: (track, preset) => {
                    const name = track.name.toLowerCase();
                    const keywords = preset.tracks || [];
                    const matches = keywords.filter(kw => name.includes(kw));
                    return matches.length > 0 ? { score: matches.length / keywords.length, matched: matches } : null;
                }
            },
            
            // Frequency-based grouping
            {
                id: 'frequency-profile',
                name: 'Frequency Profile',
                weight: 0.7,
                evaluate: (track, preset, analysis) => {
                    if (!analysis || !analysis.frequencyBands) return null;
                    
                    const bands = analysis.frequencyBands;
                    
                    // Check if track matches frequency profile for preset
                    const profiles = {
                        drums: { low: 0.8, mid: 0.5, high: 0.7 },
                        bass: { low: 1.0, mid: 0.3, high: 0.1 },
                        vocals: { low: 0.2, mid: 0.9, high: 0.6 },
                        guitars: { low: 0.4, mid: 0.8, high: 0.5 },
                        keys: { low: 0.5, mid: 0.7, high: 0.4 },
                        strings: { low: 0.3, mid: 0.8, high: 0.4 },
                        brass: { low: 0.3, mid: 0.7, high: 0.5 },
                        fx: { low: 0.2, mid: 0.3, high: 0.8 }
                    };
                    
                    const profile = profiles[preset.name.toLowerCase()];
                    if (!profile) return null;
                    
                    // Calculate match score
                    const lowLevel = (bands.bass?.level || -60) / 60 + 1;
                    const midLevel = (bands.mid?.level || -60) / 60 + 1;
                    const highLevel = (bands.presence?.level || -60) / 60 + 1;
                    
                    const diff = Math.abs(lowLevel - profile.low) + 
                                 Math.abs(midLevel - profile.mid) + 
                                 Math.abs(highLevel - profile.high);
                    
                    const score = 1 - (diff / 3);
                    return score > 0.5 ? { score } : null;
                }
            },
            
            // Type-based grouping
            {
                id: 'track-type',
                name: 'Track Type',
                weight: 0.8,
                evaluate: (track, preset) => {
                    const type = track.type?.toLowerCase() || '';
                    
                    const typeMap = {
                        drums: ['drums', 'drumsampler'],
                        bass: ['sampler', 'synth'],
                        vocals: ['audio'],
                        guitars: ['audio', 'sampler'],
                        keys: ['synth', 'sampler'],
                        fx: ['audio', 'sampler']
                    };
                    
                    const allowedTypes = typeMap[preset.name.toLowerCase()];
                    if (allowedTypes && allowedTypes.includes(type)) {
                        return { score: 0.6 };
                    }
                    return null;
                }
            },
            
            // Effect chain similarity
            {
                id: 'effect-chain',
                name: 'Effect Chain Similarity',
                weight: 0.5,
                evaluate: (track, preset, analysis, allTracks) => {
                    if (!track.effects || track.effects.length === 0) return null;
                    
                    // Group tracks with similar effect chains
                    const effectTypes = track.effects.map(e => e.type?.toLowerCase() || '');
                    
                    // Common effects for presets
                    const presetEffects = {
                        drums: ['compressor', 'eq', 'reverb'],
                        vocals: ['compressor', 'eq', 'reverb', 'deesser'],
                        guitars: ['distortion', 'chorus', 'reverb', 'delay'],
                        keys: ['reverb', 'chorus', 'delay']
                    };
                    
                    const expected = presetEffects[preset.name.toLowerCase()];
                    if (!expected) return null;
                    
                    const matches = expected.filter(e => effectTypes.includes(e));
                    return matches.length > 0 ? { score: matches.length / expected.length } : null;
                }
            }
        ];
    }
    
    // Analyze tracks and suggest groupings
    analyzeTracks(tracks, options = {}) {
        this.suggestions = [];
        
        if (!tracks || tracks.length < this.minimumGroupSize) {
            return this.suggestions;
        }
        
        const trackAnalyses = tracks.map(track => this.analyzeTrack(track));
        
        // Apply each preset
        for (const [presetName, preset] of Object.entries(this.groupPresets)) {
            const groupTracks = [];
            
            for (let i = 0; i < tracks.length; i++) {
                const track = tracks[i];
                const analysis = trackAnalyses[i];
                
                // Evaluate all rules
                let totalScore = 0;
                let totalWeight = 0;
                const matchedRules = [];
                
                for (const rule of this.groupingRules) {
                    const result = rule.evaluate(track, preset, analysis, tracks);
                    if (result) {
                        totalScore += result.score * rule.weight;
                        totalWeight += rule.weight;
                        matchedRules.push({
                            rule: rule.name,
                            score: result.score,
                            matched: result.matched
                        });
                    }
                }
                
                // Calculate final score
                const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
                
                if (finalScore >= 0.4) {
                    groupTracks.push({
                        track,
                        score: finalScore,
                        matchedRules
                    });
                }
            }
            
            // Only create suggestion if enough tracks match
            if (groupTracks.length >= this.minimumGroupSize) {
                // Sort by score
                groupTracks.sort((a, b) => b.score - a.score);
                
                this.suggestions.push({
                    id: 'suggestion_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    groupName: preset.name,
                    presetName: presetName,
                    tracks: groupTracks,
                    confidence: groupTracks.reduce((sum, t) => sum + t.score, 0) / groupTracks.length,
                    color: this.groupColors[this.suggestions.length % this.groupColors.length]
                });
            }
        }
        
        // Sort suggestions by confidence
        this.suggestions.sort((a, b) => b.confidence - a.confidence);
        
        // Limit suggestions
        this.suggestions = this.suggestions.slice(0, this.maximumGroups);
        
        console.log(`[SmartGrouping] Generated ${this.suggestions.length} grouping suggestions`);
        return this.suggestions;
    }
    
    // Analyze individual track
    analyzeTrack(track) {
        const analysis = {
            trackId: track.id,
            name: track.name,
            type: track.type,
            frequencyBands: {},
            effects: [],
            level: 0,
            pan: 0
        };
        
        // Get track properties
        if (track.volume !== undefined) {
            analysis.level = track.volume;
        }
        if (track.pan !== undefined) {
            analysis.pan = track.pan;
        }
        
        // Get effects
        if (track.effects) {
            analysis.effects = track.effects.map(e => ({
                type: e.type,
                enabled: e.enabled
            }));
        }
        
        // Estimate frequency profile from track name/type
        analysis.frequencyBands = this.estimateFrequencyProfile(track);
        
        return analysis;
    }
    
    // Estimate frequency profile based on track characteristics
    estimateFrequencyProfile(track) {
        const name = (track.name || '').toLowerCase();
        const type = (track.type || '').toLowerCase();
        
        const profiles = {
            // Bass instruments
            bass: { bass: -10, mid: -20, presence: -30 },
            sub: { bass: -5, mid: -30, presence: -40 },
            kick: { bass: -8, mid: -15, presence: -25 },
            
            // Mid-range instruments
            snare: { bass: -20, mid: -10, presence: -15 },
            vocal: { bass: -25, mid: -8, presence: -10 },
            guitar: { bass: -20, mid: -10, presence: -18 },
            piano: { bass: -15, mid: -12, presence: -15 },
            synth: { bass: -18, mid: -12, presence: -12 },
            
            // High-frequency instruments
            hihat: { bass: -35, mid: -20, presence: -8 },
            cymbal: { bass: -30, mid: -18, presence: -5 },
            fx: { bass: -25, mid: -20, presence: -10 }
        };
        
        // Find matching profile
        for (const [keyword, profile] of Object.entries(profiles)) {
            if (name.includes(keyword) || type.includes(keyword)) {
                return profile;
            }
        }
        
        // Default balanced profile
        return { bass: -15, mid: -15, presence: -15 };
    }
    
    // Apply a grouping suggestion
    applyGrouping(suggestionId) {
        const suggestion = this.suggestions.find(s => s.id === suggestionId);
        if (!suggestion) return false;
        
        const group = {
            id: 'group_' + Date.now(),
            name: suggestion.groupName,
            tracks: suggestion.tracks.map(t => t.track.id),
            color: suggestion.color,
            volume: 0,
            pan: 0,
            muted: false,
            solo: false,
            collapsed: false,
            createdAt: new Date().toISOString()
        };
        
        this.groups.push(group);
        
        // Dispatch event for UI update
        this.dispatchEvent('group-created', group);
        
        console.log(`[SmartGrouping] Created group "${group.name}" with ${group.tracks.length} tracks`);
        return group;
    }
    
    // Apply all suggestions automatically
    applyAllSuggestions() {
        const appliedGroups = [];
        const usedTracks = new Set();
        
        for (const suggestion of this.suggestions) {
            // Filter out already used tracks
            const availableTracks = suggestion.tracks.filter(t => !usedTracks.has(t.track.id));
            
            if (availableTracks.length >= this.minimumGroupSize) {
                // Mark tracks as used
                availableTracks.forEach(t => usedTracks.add(t.track.id));
                
                const group = {
                    id: 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    name: suggestion.groupName,
                    tracks: availableTracks.map(t => t.track.id),
                    color: suggestion.color,
                    volume: 0,
                    pan: 0,
                    muted: false,
                    solo: false,
                    collapsed: false,
                    createdAt: new Date().toISOString()
                };
                
                this.groups.push(group);
                appliedGroups.push(group);
            }
        }
        
        this.dispatchEvent('groups-created', { groups: appliedGroups });
        console.log(`[SmartGrouping] Created ${appliedGroups.length} groups`);
        
        return appliedGroups;
    }
    
    // Manual group creation
    createGroup(name, trackIds, color = null) {
        const group = {
            id: 'group_' + Date.now(),
            name: name,
            tracks: trackIds,
            color: color || this.groupColors[this.groups.length % this.groupColors.length],
            volume: 0,
            pan: 0,
            muted: false,
            solo: false,
            collapsed: false,
            createdAt: new Date().toISOString()
        };
        
        this.groups.push(group);
        this.dispatchEvent('group-created', group);
        
        return group;
    }
    
    // Group management
    updateGroup(groupId, updates) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return false;
        
        Object.assign(group, updates);
        this.dispatchEvent('group-updated', group);
        return true;
    }
    
    deleteGroup(groupId) {
        const index = this.groups.findIndex(g => g.id === groupId);
        if (index === -1) return false;
        
        const group = this.groups.splice(index, 1)[0];
        this.dispatchEvent('group-deleted', group);
        return true;
    }
    
    addTrackToGroup(groupId, trackId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return false;
        
        if (!group.tracks.includes(trackId)) {
            group.tracks.push(trackId);
            this.dispatchEvent('group-updated', group);
        }
        
        return true;
    }
    
    removeTrackFromGroup(groupId, trackId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return false;
        
        const index = group.tracks.indexOf(trackId);
        if (index !== -1) {
            group.tracks.splice(index, 1);
            
            // Delete group if too small
            if (group.tracks.length < this.minimumGroupSize) {
                this.deleteGroup(groupId);
            } else {
                this.dispatchEvent('group-updated', group);
            }
        }
        
        return true;
    }
    
    // Group controls
    setGroupVolume(groupId, volume) {
        return this.updateGroup(groupId, { volume });
    }
    
    setGroupPan(groupId, pan) {
        return this.updateGroup(groupId, { pan });
    }
    
    toggleGroupMute(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return false;
        return this.updateGroup(groupId, { muted: !group.muted });
    }
    
    toggleGroupSolo(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return false;
        return this.updateGroup(groupId, { solo: !group.solo });
    }
    
    collapseGroup(groupId) {
        return this.updateGroup(groupId, { collapsed: true });
    }
    
    expandGroup(groupId) {
        return this.updateGroup(groupId, { collapsed: false });
    }
    
    // Get tracks in a group
    getGroupTracks(groupId, allTracks) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return [];
        
        return allTracks.filter(t => group.tracks.includes(t.id));
    }
    
    // Export/Import
    exportGroups() {
        return {
            groups: this.groups,
            suggestions: this.suggestions,
            settings: {
                minimumGroupSize: this.minimumGroupSize,
                maximumGroups: this.maximumGroups,
                autoGroup: this.autoGroup
            }
        };
    }
    
    importGroups(data) {
        if (data.groups) {
            this.groups = data.groups;
        }
        if (data.settings) {
            if (data.settings.minimumGroupSize !== undefined) {
                this.minimumGroupSize = data.settings.minimumGroupSize;
            }
            if (data.settings.maximumGroups !== undefined) {
                this.maximumGroups = data.settings.maximumGroups;
            }
            if (data.settings.autoGroup !== undefined) {
                this.autoGroup = data.settings.autoGroup;
            }
        }
        
        this.dispatchEvent('groups-imported', { count: this.groups.length });
    }
    
    // UI Panel
    openPanel(tracks = []) {
        const existing = document.getElementById('smart-grouping-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'smart-grouping-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 700px;
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
                    <h3 style="margin: 0; font-size: 18px;">🧠 Smart Track Grouping</h3>
                    <button id="close-grouping-panel" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
                </div>
            </div>
            
            <div style="padding: 16px; max-height: 70vh; overflow-y: auto;">
                <button id="analyze-tracks-btn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; border-radius: 6px; font-size: 14px; font-weight: bold; cursor: pointer; margin-bottom: 16px;">
                    🔍 Analyze Tracks
                </button>
                
                <div id="suggestions-section" style="display: none;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Suggested Groups</h4>
                    <div id="suggestions-list">
                        ${this.renderSuggestions()}
                    </div>
                    
                    <button id="apply-all-btn" style="width: 100%; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; margin-top: 12px;">
                        ✨ Apply All Suggestions
                    </button>
                </div>
                
                <div id="existing-groups" style="margin-top: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Current Groups (${this.groups.length})</h4>
                    <div id="groups-list">
                        ${this.renderGroups()}
                    </div>
                </div>
                
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #333;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Settings</h4>
                    
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <label style="font-size: 12px; color: #888; min-width: 120px;">Min group size:</label>
                        <input type="number" id="min-group-size" value="${this.minimumGroupSize}" min="1" max="10" style="width: 60px; padding: 6px; background: #0a0a14; border: 1px solid #333; color: white; border-radius: 4px;">
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <label style="font-size: 12px; color: #888; min-width: 120px;">Auto-group tracks:</label>
                        <input type="checkbox" id="auto-group" ${this.autoGroup ? 'checked' : ''}>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupPanelEvents(tracks);
    }
    
    renderSuggestions() {
        if (this.suggestions.length === 0) {
            return '<div style="color: #666; font-size: 12px; text-align: center; padding: 20px;">No suggestions available. Analyze tracks first.</div>';
        }
        
        return this.suggestions.map(s => `
            <div style="
                background: #0a0a14;
                border-left: 3px solid ${s.color};
                padding: 12px;
                margin-bottom: 8px;
                border-radius: 0 4px 4px 0;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-weight: bold;">${s.groupName}</span>
                        <span style="color: #888; font-size: 11px; margin-left: 8px;">
                            ${s.tracks.length} tracks • ${Math.round(s.confidence * 100)}% confidence
                        </span>
                    </div>
                    <button class="apply-suggestion-btn" data-id="${s.id}" style="
                        padding: 6px 12px;
                        background: ${s.color};
                        border: none;
                        color: white;
                        border-radius: 3px;
                        font-size: 11px;
                        cursor: pointer;
                    ">Apply</button>
                </div>
                
                <div style="margin-top: 8px; font-size: 11px; color: #888;">
                    ${s.tracks.slice(0, 3).map(t => t.track.name).join(', ')}${s.tracks.length > 3 ? ` +${s.tracks.length - 3} more` : ''}
                </div>
            </div>
        `).join('');
    }
    
    renderGroups() {
        if (this.groups.length === 0) {
            return '<div style="color: #666; font-size: 12px; text-align: center; padding: 20px;">No groups created yet</div>';
        }
        
        return this.groups.map(g => `
            <div style="
                background: #0a0a14;
                border-left: 3px solid ${g.color};
                padding: 12px;
                margin-bottom: 8px;
                border-radius: 0 4px 4px 0;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-weight: bold;">${g.name}</span>
                        <span style="color: #888; font-size: 11px; margin-left: 8px;">
                            ${g.tracks.length} tracks
                        </span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="group-mute-btn" data-id="${g.id}" style="
                            padding: 4px 8px;
                            background: ${g.muted ? '#ef4444' : '#333'};
                            border: none;
                            color: white;
                            border-radius: 3px;
                            font-size: 10px;
                            cursor: pointer;
                        ">M</button>
                        <button class="group-solo-btn" data-id="${g.id}" style="
                            padding: 4px 8px;
                            background: ${g.solo ? '#f59e0b' : '#333'};
                            border: none;
                            color: white;
                            border-radius: 3px;
                            font-size: 10px;
                            cursor: pointer;
                        ">S</button>
                        <button class="delete-group-btn" data-id="${g.id}" style="
                            padding: 4px 8px;
                            background: #ef4444;
                            border: none;
                            color: white;
                            border-radius: 3px;
                            font-size: 10px;
                            cursor: pointer;
                        ">×</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    setupPanelEvents(tracks) {
        const panel = document.getElementById('smart-grouping-panel');
        if (!panel) return;
        
        panel.querySelector('#close-grouping-panel').onclick = () => panel.remove();
        
        panel.querySelector('#analyze-tracks-btn').onclick = () => {
            this.analyzeTracks(tracks);
            panel.querySelector('#suggestions-section').style.display = 'block';
            panel.querySelector('#suggestions-list').innerHTML = this.renderSuggestions();
            this.setupSuggestionButtons();
        };
        
        panel.querySelector('#apply-all-btn').onclick = () => {
            this.applyAllSuggestions();
            panel.querySelector('#suggestions-section').style.display = 'none';
            panel.querySelector('#groups-list').innerHTML = this.renderGroups();
            this.setupGroupButtons();
        };
        
        // Settings
        panel.querySelector('#min-group-size').onchange = (e) => {
            this.minimumGroupSize = parseInt(e.target.value);
        };
        
        panel.querySelector('#auto-group').onchange = (e) => {
            this.autoGroup = e.target.checked;
        };
        
        this.setupGroupButtons();
    }
    
    setupSuggestionButtons() {
        const panel = document.getElementById('smart-grouping-panel');
        if (!panel) return;
        
        panel.querySelectorAll('.apply-suggestion-btn').forEach(btn => {
            btn.onclick = () => {
                this.applyGrouping(btn.dataset.id);
                btn.textContent = 'Applied ✓';
                btn.disabled = true;
                panel.querySelector('#groups-list').innerHTML = this.renderGroups();
                this.setupGroupButtons();
            };
        });
    }
    
    setupGroupButtons() {
        const panel = document.getElementById('smart-grouping-panel');
        if (!panel) return;
        
        panel.querySelectorAll('.group-mute-btn').forEach(btn => {
            btn.onclick = () => {
                this.toggleGroupMute(btn.dataset.id);
                panel.querySelector('#groups-list').innerHTML = this.renderGroups();
                this.setupGroupButtons();
            };
        });
        
        panel.querySelectorAll('.group-solo-btn').forEach(btn => {
            btn.onclick = () => {
                this.toggleGroupSolo(btn.dataset.id);
                panel.querySelector('#groups-list').innerHTML = this.renderGroups();
                this.setupGroupButtons();
            };
        });
        
        panel.querySelectorAll('.delete-group-btn').forEach(btn => {
            btn.onclick = () => {
                this.deleteGroup(btn.dataset.id);
                panel.querySelector('#groups-list').innerHTML = this.renderGroups();
                this.setupGroupButtons();
            };
        });
    }
    
    closePanel() {
        const panel = document.getElementById('smart-grouping-panel');
        if (panel) panel.remove();
    }
    
    // Event system
    dispatchEvent(eventName, data = {}) {
        window.dispatchEvent(new CustomEvent(`smart-grouping:${eventName}`, { detail: data }));
    }
    
    on(eventName, callback) {
        window.addEventListener(`smart-grouping:${eventName}`, (e) => callback(e.detail));
    }
    
    off(eventName, callback) {
        window.removeEventListener(`smart-grouping:${eventName}`, callback);
    }
    
    // Cleanup
    dispose() {
        this.closePanel();
        this.groups = [];
        this.suggestions = [];
    }
}

// Export singleton instance
const smartTrackGrouping = new SmartTrackGrouping();

// Initialization function
function initSmartTrackGrouping() {
    console.log('[SmartGrouping] Module initialized');
    return smartTrackGrouping;
}

// Panel open function
function openSmartTrackGroupingPanel() {
    smartTrackGrouping.openPanel();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SmartTrackGrouping, smartTrackGrouping, initSmartTrackGrouping, openSmartTrackGroupingPanel };
}

export { SmartTrackGrouping, smartTrackGrouping, initSmartTrackGrouping, openSmartTrackGroupingPanel };