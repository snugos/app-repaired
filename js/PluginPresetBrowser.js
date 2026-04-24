// Plugin Preset Browser - Browse and apply plugin presets
// Provides a comprehensive preset management system for effects and instruments

class PluginPresetBrowser {
    constructor() {
        this.presets = new Map();
        this.categories = new Map();
        this.favorites = new Set();
        this.recentPresets = [];
        this.searchHistory = [];
        this.maxRecent = 20;
        this.maxSearchHistory = 50;
        
        // Initialize built-in presets
        this.initBuiltInPresets();
        
        // Load user presets from localStorage
        this.loadUserPresets();
        
        console.log('[PluginPresetBrowser] Initialized with', this.presets.size, 'presets');
    }
    
    initBuiltInPresets() {
        // EQ Presets
        this.addCategory('EQ', {
            name: 'EQ',
            icon: '🎚️',
            description: 'Equalizer presets for various instruments and mixing tasks'
        });
        
        const eqPresets = [
            { id: 'eq_vocal_presence', name: 'Vocal Presence', plugin: 'EQ', settings: { lowCut: 80, highShelf: 2, midBoost: 3, midFreq: 3000 }, tags: ['vocal', 'presence', 'bright'] },
            { id: 'eq_vocal_warm', name: 'Vocal Warm', plugin: 'EQ', settings: { lowShelf: 2, lowMidBoost: 3, lowMidFreq: 200 }, tags: ['vocal', 'warm', 'body'] },
            { id: 'eq_kick_punch', name: 'Kick Punch', plugin: 'EQ', settings: { lowShelf: 3, lowCut: 30, midCut: -4, midFreq: 400, highBoost: 2, highFreq: 3000 }, tags: ['drums', 'kick', 'punch'] },
            { id: 'eq_snare_crack', name: 'Snare Crack', plugin: 'EQ', settings: { lowCut: 100, midBoost: 4, midFreq: 2000, highShelf: 3 }, tags: ['drums', 'snare', 'crack'] },
            { id: 'eq_bass_sub', name: 'Bass Sub', plugin: 'EQ', settings: { lowShelf: 4, lowCut: 20, highCut: 500 }, tags: ['bass', 'sub', 'low'] },
            { id: 'eq_bass_growl', name: 'Bass Growl', plugin: 'EQ', settings: { lowShelf: 2, midBoost: 5, midFreq: 800, highShelf: 1 }, tags: ['bass', 'growl', 'mid'] },
            { id: 'eq_guitar_clean', name: 'Guitar Clean', plugin: 'EQ', settings: { lowCut: 80, midBoost: 2, midFreq: 2500, highShelf: 2 }, tags: ['guitar', 'clean', 'sparkle'] },
            { id: 'eq_guitar_heavy', name: 'Guitar Heavy', plugin: 'EQ', settings: { lowCut: 100, lowMidCut: -3, lowMidFreq: 300, highBoost: 3, highFreq: 4000 }, tags: ['guitar', 'heavy', 'metal'] },
            { id: 'eq_piano_bright', name: 'Piano Bright', plugin: 'EQ', settings: { lowShelf: 1, highShelf: 3, highMidBoost: 2 }, tags: ['piano', 'bright', 'keys'] },
            { id: 'eq_piano_warm', name: 'Piano Warm', plugin: 'EQ', settings: { lowShelf: 2, midBoost: 2, midFreq: 400, highShelf: -1 }, tags: ['piano', 'warm', 'keys'] },
            { id: 'eq_horns_bright', name: 'Horns Bright', plugin: 'EQ', settings: { lowCut: 150, highMidBoost: 4, highMidFreq: 3000, highShelf: 2 }, tags: ['horns', 'bright', 'brass'] },
            { id: 'eq_strings_air', name: 'Strings Air', plugin: 'EQ', settings: { lowCut: 100, highShelf: 3, airBoost: 4 }, tags: ['strings', 'air', 'orchestral'] },
            { id: 'eq_master_gentle', name: 'Master Gentle', plugin: 'EQ', settings: { lowShelf: 1, highShelf: 1 }, tags: ['master', 'gentle', 'transparent'] },
            { id: 'eq_master_radio', name: 'Master Radio', plugin: 'EQ', settings: { lowShelf: 2, midBoost: 2, midFreq: 2500, highShelf: 3 }, tags: ['master', 'radio', 'bright'] }
        ];
        
        // Compressor Presets
        this.addCategory('Compressor', {
            name: 'Compressor',
            icon: '🔊',
            description: 'Compression presets for various dynamics control'
        });
        
        const compressorPresets = [
            { id: 'comp_vocal_level', name: 'Vocal Leveler', plugin: 'Compressor', settings: { threshold: -20, ratio: 3, attack: 10, release: 100, knee: 6 }, tags: ['vocal', 'leveling', 'gentle'] },
            { id: 'comp_vocal_pop', name: 'Vocal Pop', plugin: 'Compressor', settings: { threshold: -18, ratio: 4, attack: 5, release: 50, knee: 2 }, tags: ['vocal', 'pop', 'punchy'] },
            { id: 'comp_drums_glue', name: 'Drums Glue', plugin: 'Compressor', settings: { threshold: -15, ratio: 4, attack: 30, release: 150, knee: 10 }, tags: ['drums', 'glue', 'bus'] },
            { id: 'comp_drums_pump', name: 'Drums Pump', plugin: 'Compressor', settings: { threshold: -20, ratio: 6, attack: 1, release: 100, knee: 0 }, tags: ['drums', 'pump', 'electronic'] },
            { id: 'comp_bass_tight', name: 'Bass Tight', plugin: 'Compressor', settings: { threshold: -18, ratio: 4, attack: 5, release: 80, knee: 3 }, tags: ['bass', 'tight', 'controlled'] },
            { id: 'comp_bass_fat', name: 'Bass Fat', plugin: 'Compressor', settings: { threshold: -12, ratio: 3, attack: 20, release: 200, knee: 10 }, tags: ['bass', 'fat', 'warm'] },
            { id: 'comp_master_bus', name: 'Master Bus', plugin: 'Compressor', settings: { threshold: -10, ratio: 2, attack: 30, release: 300, knee: 10 }, tags: ['master', 'bus', 'glue'] },
            { id: 'comp_parallel_thick', name: 'Parallel Thick', plugin: 'Compressor', settings: { threshold: -30, ratio: 10, attack: 10, release: 100, knee: 0, mix: 0.3 }, tags: ['parallel', 'thick', 'aggressive'] }
        ];
        
        // Reverb Presets
        this.addCategory('Reverb', {
            name: 'Reverb',
            icon: '🌊',
            description: 'Reverb presets for different spaces and effects'
        });
        
        const reverbPresets = [
            { id: 'rev_small_room', name: 'Small Room', plugin: 'Reverb', settings: { decay: 0.5, preDelay: 10, dampening: 5000, mix: 0.3 }, tags: ['room', 'small', 'intimate'] },
            { id: 'rev_large_hall', name: 'Large Hall', plugin: 'Reverb', settings: { decay: 2.5, preDelay: 30, dampening: 3000, mix: 0.4 }, tags: ['hall', 'large', 'grand'] },
            { id: 'rev_plate_shimmer', name: 'Plate Shimmer', plugin: 'Reverb', settings: { decay: 1.5, preDelay: 5, dampening: 8000, mix: 0.35 }, tags: ['plate', 'shimmer', 'bright'] },
            { id: 'rev_chamber_warm', name: 'Chamber Warm', plugin: 'Reverb', settings: { decay: 1.2, preDelay: 20, dampening: 2000, mix: 0.3 }, tags: ['chamber', 'warm', 'vintage'] },
            { id: 'rev_cathedral', name: 'Cathedral', plugin: 'Reverb', settings: { decay: 4.0, preDelay: 50, dampening: 1500, mix: 0.5 }, tags: ['cathedral', 'huge', 'ambient'] },
            { id: 'rev_spring_vintage', name: 'Spring Vintage', plugin: 'Reverb', settings: { decay: 0.8, preDelay: 0, dampening: 4000, mix: 0.4, type: 'spring' }, tags: ['spring', 'vintage', 'retro'] },
            { id: 'rev_gated_drums', name: 'Gated Drums', plugin: 'Reverb', settings: { decay: 0.3, preDelay: 5, gate: true, mix: 0.25 }, tags: ['gated', 'drums', '80s'] },
            { id: 'rev_ambient_drone', name: 'Ambient Drone', plugin: 'Reverb', settings: { decay: 10.0, preDelay: 100, dampening: 500, mix: 0.7 }, tags: ['ambient', 'drone', 'infinite'] }
        ];
        
        // Delay Presets
        this.addCategory('Delay', {
            name: 'Delay',
            icon: '🔁',
            description: 'Delay presets for various rhythmic and ambient effects'
        });
        
        const delayPresets = [
            { id: 'delay_quarter_note', name: 'Quarter Note', plugin: 'Delay', settings: { time: 0.5, feedback: 0.4, mix: 0.3 }, tags: ['rhythmic', 'quarter', 'standard'] },
            { id: 'delay_eighth_note', name: 'Eighth Note', plugin: 'Delay', settings: { time: 0.25, feedback: 0.3, mix: 0.25 }, tags: ['rhythmic', 'eighth', 'fast'] },
            { id: 'delay_dotted_eighth', name: 'Dotted Eighth', plugin: 'Delay', settings: { time: 0.375, feedback: 0.5, mix: 0.35 }, tags: ['rhythmic', 'dotted', 'u2'] },
            { id: 'delay_triplet', name: 'Triplet', plugin: 'Delay', settings: { time: 0.166, feedback: 0.35, mix: 0.3 }, tags: ['rhythmic', 'triplet', 'swing'] },
            { id: 'delay_ping_pong', name: 'Ping Pong', plugin: 'Delay', settings: { time: 0.5, feedback: 0.5, mix: 0.4, pingPong: true }, tags: ['pingpong', 'wide', 'stereo'] },
            { id: 'delay_slapback', name: 'Slapback', plugin: 'Delay', settings: { time: 0.08, feedback: 0.1, mix: 0.4 }, tags: ['slapback', 'rockabilly', 'vintage'] },
            { id: 'delay_multi_tap', name: 'Multi-Tap', plugin: 'Delay', settings: { taps: [0.25, 0.375, 0.5], feedback: 0.3, mix: 0.3 }, tags: ['multitap', 'complex', 'rhythmic'] },
            { id: 'delay_lofi', name: 'Lo-Fi', plugin: 'Delay', settings: { time: 0.5, feedback: 0.6, mix: 0.4, bitcrush: true, sampleRate: 8000 }, tags: ['lofi', 'crunchy', 'vintage'] }
        ];
        
        // Distortion Presets
        this.addCategory('Distortion', {
            name: 'Distortion',
            icon: '⚡',
            description: 'Distortion and saturation presets'
        });
        
        const distortionPresets = [
            { id: 'dist_warm_sat', name: 'Warm Saturation', plugin: 'Distortion', settings: { drive: 2, tone: 0.6, mix: 0.5 }, tags: ['warm', 'subtle', 'saturation'] },
            { id: 'dist_tube_drive', name: 'Tube Drive', plugin: 'Distortion', settings: { drive: 5, tone: 0.5, mix: 0.7, type: 'tube' }, tags: ['tube', 'warm', 'classic'] },
            { id: 'dist_fuzz_face', name: 'Fuzz Face', plugin: 'Distortion', settings: { drive: 8, tone: 0.4, mix: 0.8, type: 'fuzz' }, tags: ['fuzz', 'vintage', 'hendrix'] },
            { id: 'dist_metal_zone', name: 'Metal Zone', plugin: 'Distortion', settings: { drive: 10, tone: 0.7, mid: 8, mix: 0.9, type: 'metal' }, tags: ['metal', 'aggressive', 'heavy'] },
            { id: 'dist_tape_sat', name: 'Tape Saturation', plugin: 'Distortion', settings: { drive: 3, tone: 0.6, mix: 0.4, type: 'tape' }, tags: ['tape', 'vintage', 'warm'] }
        ];
        
        // Chorus/Modulation Presets
        this.addCategory('Modulation', {
            name: 'Modulation',
            icon: '🌀',
            description: 'Chorus, flanger, phaser, and other modulation presets'
        });
        
        const modulationPresets = [
            { id: 'mod_chorus_subtle', name: 'Chorus Subtle', plugin: 'Chorus', settings: { rate: 0.5, depth: 0.002, delay: 0.005, mix: 0.3 }, tags: ['chorus', 'subtle', 'width'] },
            { id: 'mod_chorus_80s', name: 'Chorus 80s', plugin: 'Chorus', settings: { rate: 0.8, depth: 0.005, delay: 0.01, mix: 0.5 }, tags: ['chorus', '80s', 'lush'] },
            { id: 'mod_flanger_metallic', name: 'Flanger Metallic', plugin: 'Flanger', settings: { rate: 0.2, depth: 0.01, feedback: 0.7, mix: 0.6 }, tags: ['flanger', 'metallic', 'jet'] },
            { id: 'mod_phaser_slow', name: 'Phaser Slow', plugin: 'Phaser', settings: { rate: 0.1, depth: 1000, feedback: 0.5, stages: 4, mix: 0.4 }, tags: ['phaser', 'slow', 'sweep'] },
            { id: 'mod_phaser_fast', name: 'Phaser Fast', plugin: 'Phaser', settings: { rate: 1.5, depth: 500, feedback: 0.6, stages: 6, mix: 0.5 }, tags: ['phaser', 'fast', 'warble'] },
            { id: 'mod_tremolo_vintage', name: 'Tremolo Vintage', plugin: 'Tremolo', settings: { rate: 4, depth: 0.5, type: 'sine' }, tags: ['tremolo', 'vintage', 'surf'] },
            { id: 'mod_vibrato_mild', name: 'Vibrato Mild', plugin: 'Vibrato', settings: { rate: 3, depth: 0.003, mix: 0.5 }, tags: ['vibrato', 'mild', 'wobble'] }
        ];
        
        // Filter Presets
        this.addCategory('Filter', {
            name: 'Filter',
            icon: '🎚️',
            description: 'Filter presets for various tonal shaping'
        });
        
        const filterPresets = [
            { id: 'filt_lowpass_gentle', name: 'Lowpass Gentle', plugin: 'Filter', settings: { type: 'lowpass', frequency: 2000, resonance: 1 }, tags: ['lowpass', 'gentle', 'smooth'] },
            { id: 'filt_lowpass_resonant', name: 'Lowpass Resonant', plugin: 'Filter', settings: { type: 'lowpass', frequency: 1500, resonance: 10 }, tags: ['lowpass', 'resonant', 'acid'] },
            { id: 'filt_highpass_clean', name: 'Highpass Clean', plugin: 'Filter', settings: { type: 'highpass', frequency: 100, resonance: 1 }, tags: ['highpass', 'clean', 'rumble'] },
            { id: 'filt_bandpass_narrow', name: 'Bandpass Narrow', plugin: 'Filter', settings: { type: 'bandpass', frequency: 1000, resonance: 15 }, tags: ['bandpass', 'narrow', 'telephone'] },
            { id: 'filt_notch_hum', name: 'Notch Hum', plugin: 'Filter', settings: { type: 'notch', frequency: 60, resonance: 20 }, tags: ['notch', 'hum', 'utility'] }
        ];
        
        // Synth Presets
        this.addCategory('Synth', {
            name: 'Synth',
            icon: '🎹',
            description: 'Synthesizer presets for various sounds'
        });
        
        const synthPresets = [
            { id: 'synth_lead_saw', name: 'Lead Saw', plugin: 'Synth', settings: { oscillator: 'sawtooth', filter: { type: 'lowpass', frequency: 3000, resonance: 5 }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 } }, tags: ['lead', 'saw', 'bright'] },
            { id: 'synth_pad_warm', name: 'Pad Warm', plugin: 'Synth', settings: { oscillator: 'sine', filter: { type: 'lowpass', frequency: 1000, resonance: 2 }, envelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1.5 } }, tags: ['pad', 'warm', 'soft'] },
            { id: 'synth_bass_sub', name: 'Bass Sub', plugin: 'Synth', settings: { oscillator: 'sine', filter: { type: 'lowpass', frequency: 200, resonance: 1 }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.1 } }, tags: ['bass', 'sub', 'deep'] },
            { id: 'synth_pluck_fifth', name: 'Pluck Fifth', plugin: 'Synth', settings: { oscillator: 'triangle', filter: { type: 'lowpass', frequency: 5000, resonance: 3 }, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 } }, tags: ['pluck', 'percussive', 'short'] },
            { id: 'synth_strings_ensemble', name: 'Strings Ensemble', plugin: 'Synth', settings: { oscillator: 'sawtooth', filter: { type: 'lowpass', frequency: 2500, resonance: 1 }, envelope: { attack: 0.3, decay: 0.4, sustain: 0.6, release: 1.0 }, detune: 5 }, tags: ['strings', 'ensemble', 'lush'] },
            { id: 'synth_brass_stab', name: 'Brass Stab', plugin: 'Synth', settings: { oscillator: 'sawtooth', filter: { type: 'lowpass', frequency: 4000, resonance: 3 }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.8, release: 0.3 } }, tags: ['brass', 'stab', 'punchy'] }
        ];
        
        // Add all presets
        [...eqPresets, ...compressorPresets, ...reverbPresets, ...delayPresets, ...distortionPresets, ...modulationPresets, ...filterPresets, ...synthPresets].forEach(preset => {
            this.addPreset(preset);
        });
    }
    
    addCategory(id, category) {
        this.categories.set(id, {
            id,
            ...category,
            presets: []
        });
    }
    
    addPreset(preset) {
        const id = preset.id || `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullPreset = {
            id,
            name: preset.name || 'Unnamed Preset',
            plugin: preset.plugin || 'Unknown',
            settings: preset.settings || {},
            tags: preset.tags || [],
            author: preset.author || 'SnugOS',
            created: preset.created || Date.now(),
            modified: preset.modified || Date.now(),
            isUser: preset.isUser || false,
            rating: preset.rating || 0
        };
        
        this.presets.set(id, fullPreset);
        
        // Add to category
        const category = this.categories.get(preset.plugin);
        if (category) {
            category.presets.push(id);
        }
        
        return fullPreset;
    }
    
    getCategories() {
        return Array.from(this.categories.values());
    }
    
    getPresetsByCategory(categoryId) {
        const category = this.categories.get(categoryId);
        if (!category) return [];
        
        return category.presets.map(id => this.presets.get(id)).filter(Boolean);
    }
    
    getPresetsByPlugin(pluginName) {
        return Array.from(this.presets.values()).filter(p => p.plugin === pluginName);
    }
    
    getPreset(id) {
        return this.presets.get(id);
    }
    
    searchPresets(query, options = {}) {
        const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
        
        if (searchTerms.length === 0) {
            return Array.from(this.presets.values());
        }
        
        // Add to search history
        this.addToSearchHistory(query);
        
        return Array.from(this.presets.values()).filter(preset => {
            const searchableText = [
                preset.name,
                preset.plugin,
                ...preset.tags,
                preset.author
            ].join(' ').toLowerCase();
            
            return searchTerms.every(term => searchableText.includes(term));
        });
    }
    
    addToSearchHistory(query) {
        if (!this.searchHistory.includes(query)) {
            this.searchHistory.unshift(query);
            if (this.searchHistory.length > this.maxSearchHistory) {
                this.searchHistory.pop();
            }
            this.saveToStorage();
        }
    }
    
    toggleFavorite(id) {
        if (this.favorites.has(id)) {
            this.favorites.delete(id);
        } else {
            this.favorites.add(id);
        }
        this.saveToStorage();
        return this.favorites.has(id);
    }
    
    getFavorites() {
        return Array.from(this.favorites).map(id => this.presets.get(id)).filter(Boolean);
    }
    
    addToRecent(id) {
        const index = this.recentPresets.indexOf(id);
        if (index !== -1) {
            this.recentPresets.splice(index, 1);
        }
        this.recentPresets.unshift(id);
        if (this.recentPresets.length > this.maxRecent) {
            this.recentPresets.pop();
        }
        this.saveToStorage();
    }
    
    getRecent() {
        return this.recentPresets.map(id => this.presets.get(id)).filter(Boolean);
    }
    
    updatePreset(id, updates) {
        const preset = this.presets.get(id);
        if (!preset) return false;
        
        Object.assign(preset, updates, { modified: Date.now() });
        this.presets.set(id, preset);
        this.saveToStorage();
        
        return true;
    }
    
    deletePreset(id) {
        const preset = this.presets.get(id);
        if (!preset || !preset.isUser) {
            console.warn('[PluginPresetBrowser] Cannot delete built-in preset');
            return false;
        }
        
        // Remove from category
        const category = this.categories.get(preset.plugin);
        if (category) {
            const index = category.presets.indexOf(id);
            if (index !== -1) {
                category.presets.splice(index, 1);
            }
        }
        
        // Remove from favorites and recent
        this.favorites.delete(id);
        const recentIndex = this.recentPresets.indexOf(id);
        if (recentIndex !== -1) {
            this.recentPresets.splice(recentIndex, 1);
        }
        
        this.presets.delete(id);
        this.saveToStorage();
        
        return true;
    }
    
    duplicatePreset(id) {
        const original = this.presets.get(id);
        if (!original) return null;
        
        const duplicate = this.addPreset({
            ...original,
            id: undefined,
            name: `${original.name} (Copy)`,
            isUser: true,
            created: Date.now(),
            modified: Date.now()
        });
        
        this.saveToStorage();
        return duplicate;
    }
    
    exportPreset(id) {
        const preset = this.presets.get(id);
        if (!preset) return null;
        
        return JSON.stringify(preset, null, 2);
    }
    
    importPreset(jsonString) {
        try {
            const preset = JSON.parse(jsonString);
            preset.isUser = true;
            preset.id = undefined; // Generate new ID
            const added = this.addPreset(preset);
            this.saveToStorage();
            return added;
        } catch (error) {
            console.error('[PluginPresetBrowser] Failed to import preset:', error);
            return null;
        }
    }
    
    exportAllUserPresets() {
        const userPresets = Array.from(this.presets.values()).filter(p => p.isUser);
        return JSON.stringify({
            version: '1.0',
            exportDate: new Date().toISOString(),
            presets: userPresets,
            favorites: Array.from(this.favorites)
        }, null, 2);
    }
    
    importPresets(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.presets) {
                data.presets.forEach(preset => {
                    preset.isUser = true;
                    preset.id = undefined;
                    this.addPreset(preset);
                });
            }
            
            if (data.favorites) {
                data.favorites.forEach(id => {
                    if (this.presets.has(id)) {
                        this.favorites.add(id);
                    }
                });
            }
            
            this.saveToStorage();
            return true;
        } catch (error) {
            console.error('[PluginPresetBrowser] Failed to import presets:', error);
            return false;
        }
    }
    
    loadUserPresets() {
        try {
            const stored = localStorage.getItem('snugos_plugin_presets');
            if (stored) {
                const data = JSON.parse(stored);
                
                if (data.presets) {
                    data.presets.forEach(preset => {
                        preset.isUser = true;
                        this.addPreset(preset);
                    });
                }
                
                if (data.favorites) {
                    this.favorites = new Set(data.favorites);
                }
                
                if (data.recent) {
                    this.recentPresets = data.recent;
                }
                
                if (data.searchHistory) {
                    this.searchHistory = data.searchHistory;
                }
            }
        } catch (error) {
            console.warn('[PluginPresetBrowser] Failed to load user presets:', error);
        }
    }
    
    saveToStorage() {
        try {
            const userPresets = Array.from(this.presets.values()).filter(p => p.isUser);
            localStorage.setItem('snugos_plugin_presets', JSON.stringify({
                presets: userPresets,
                favorites: Array.from(this.favorites),
                recent: this.recentPresets,
                searchHistory: this.searchHistory
            }));
        } catch (error) {
            console.warn('[PluginPresetBrowser] Failed to save to storage:', error);
        }
    }
    
    ratePreset(id, rating) {
        const preset = this.presets.get(id);
        if (!preset) return false;
        
        preset.rating = Math.max(0, Math.min(5, rating));
        this.presets.set(id, preset);
        this.saveToStorage();
        
        return true;
    }
    
    getTopRated(count = 10) {
        return Array.from(this.presets.values())
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, count);
    }
    
    getTags() {
        const tags = new Map();
        this.presets.forEach(preset => {
            preset.tags.forEach(tag => {
                tags.set(tag, (tags.get(tag) || 0) + 1);
            });
        });
        return Array.from(tags.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => ({ tag, count }));
    }
}

// UI Panel
function openPluginPresetBrowserPanel(onPresetSelect) {
    const existing = document.getElementById('preset-browser-panel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const browser = window.snugDAW?.presetBrowser;
    if (!browser) {
        console.error('[PluginPresetBrowser] Browser not initialized');
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'preset-browser-panel';
    panel.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1a1a2e; border: 1px solid #444; border-radius: 8px; padding: 24px; z-index: 10000; min-width: 900px; max-height: 85vh; overflow-y: auto; color: white; font-family: system-ui;';
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 20px;">🎛️ Plugin Preset Browser</h2>
            <button id="close-preset-browser" style="background: #333; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer;">✕</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 200px 1fr; gap: 20px;">
            <!-- Categories Sidebar -->
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">CATEGORIES</h3>
                <div id="category-list">
                    ${browser.getCategories().map(cat => `
                        <button class="cat-btn" data-cat="${cat.id}" style="width: 100%; padding: 10px; background: #1a1a2e; border: 1px solid #333; color: white; border-radius: 4px; cursor: pointer; text-align: left; margin-bottom: 4px;">
                            <span style="margin-right: 8px;">${cat.icon}</span>
                            ${cat.name}
                            <span style="float: right; color: #888; font-size: 11px;">${cat.presets.length}</span>
                        </button>
                    `).join('')}
                </div>
                
                <h3 style="margin: 16px 0 12px 0; font-size: 14px; color: #888;">QUICK ACCESS</h3>
                <button id="show-favorites" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #333; color: white; border-radius: 4px; cursor: pointer; text-align: left; margin-bottom: 4px;">
                    ⭐ Favorites
                </button>
                <button id="show-recent" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #333; color: white; border-radius: 4px; cursor: pointer; text-align: left; margin-bottom: 4px;">
                    🕐 Recent
                </button>
                <button id="show-all" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #333; color: white; border-radius: 4px; cursor: pointer; text-align: left;">
                    📋 All Presets
                </button>
            </div>
            
            <!-- Main Content -->
            <div>
                <!-- Search -->
                <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-bottom: 16px;">
                    <div style="display: flex; gap: 12px;">
                        <input type="text" id="preset-search" placeholder="Search presets..." style="flex: 1; padding: 10px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px; font-size: 14px;">
                        <button id="clear-search" style="padding: 10px 16px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">Clear</button>
                    </div>
                    <div id="search-history" style="margin-top: 8px; display: none;">
                        <span style="font-size: 11px; color: #888;">Recent searches: </span>
                        <div id="history-tags" style="display: inline;"></div>
                    </div>
                </div>
                
                <!-- Preset Grid -->
                <div id="preset-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-height: 400px; overflow-y: auto;">
                    <!-- Presets will be rendered here -->
                </div>
                
                <!-- Preset Details -->
                <div id="preset-details" style="display: none; background: #0a0a14; padding: 16px; border-radius: 6px; margin-top: 16px;">
                    <!-- Details will be shown here -->
                </div>
            </div>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button id="create-preset" style="padding: 12px 20px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">+ Create Preset</button>
            <button id="import-preset" style="padding: 12px 20px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">Import</button>
            <button id="export-all-presets" style="padding: 12px 20px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">Export All</button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-preset-browser').onclick = () => panel.remove();
    
    // Category selection
    let currentCategory = null;
    
    function renderPresets(presets) {
        const grid = document.getElementById('preset-grid');
        grid.innerHTML = presets.map(preset => `
            <div class="preset-card" data-id="${preset.id}" style="background: #1a1a2e; padding: 12px; border-radius: 6px; cursor: pointer; border: 1px solid #333; transition: border-color 0.2s;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <div style="font-weight: bold; margin-bottom: 4px;">${preset.name}</div>
                        <div style="font-size: 11px; color: #888;">${preset.plugin}</div>
                    </div>
                    <button class="fav-btn" data-id="${preset.id}" style="background: none; border: none; color: ${browser.favorites.has(preset.id) ? '#f59e0b' : '#666'}; cursor: pointer; font-size: 16px;">⭐</button>
                </div>
                <div style="margin-top: 8px;">
                    ${preset.tags.slice(0, 3).map(tag => `<span style="font-size: 10px; background: #333; padding: 2px 6px; border-radius: 3px; margin-right: 4px;">${tag}</span>`).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #888;">
                    <span>${preset.isUser ? '👤 User' : '📦 Built-in'}</span>
                    <span>${'★'.repeat(Math.round(preset.rating || 0))}${'☆'.repeat(5 - Math.round(preset.rating || 0))}</span>
                </div>
            </div>
        `).join('');
        
        // Click handlers
        grid.querySelectorAll('.preset-card').forEach(card => {
            card.onclick = (e) => {
                if (!e.target.classList.contains('fav-btn')) {
                    showPresetDetails(card.dataset.id);
                }
            };
        });
        
        grid.querySelectorAll('.fav-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const isFav = browser.toggleFavorite(btn.dataset.id);
                btn.style.color = isFav ? '#f59e0b' : '#666';
            };
        });
    }
    
    function showPresetDetails(id) {
        const preset = browser.getPreset(id);
        if (!preset) return;
        
        const details = document.getElementById('preset-details');
        details.style.display = 'block';
        
        details.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h3 style="margin: 0 0 8px 0; font-size: 18px;">${preset.name}</h3>
                    <div style="font-size: 12px; color: #888;">${preset.plugin} • by ${preset.author}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 12px; color: #888;">Rating</div>
                    <div id="rating-stars" style="font-size: 18px; cursor: pointer;">
                        ${'★'.repeat(Math.round(preset.rating || 0))}${'☆'.repeat(5 - Math.round(preset.rating || 0))}
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 16px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #888;">SETTINGS</h4>
                <div style="background: #1a1a2e; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 12px; max-height: 150px; overflow-y: auto;">
                    ${JSON.stringify(preset.settings, null, 2)}
                </div>
            </div>
            
            <div style="margin-top: 16px; display: flex; gap: 8px;">
                <button id="apply-preset" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Apply Preset</button>
                <button id="duplicate-preset" style="padding: 12px 16px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">Duplicate</button>
                <button id="export-preset" style="padding: 12px 16px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">Export</button>
                ${preset.isUser ? `<button id="delete-preset" style="padding: 12px 16px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer;">Delete</button>` : ''}
            </div>
        `;
        
        // Rating
        document.getElementById('rating-stars').onclick = (e) => {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const rating = Math.ceil((x / rect.width) * 5);
            browser.ratePreset(id, rating);
            showPresetDetails(id);
            renderPresets(browser.getPresetsByCategory(currentCategory));
        };
        
        // Apply
        document.getElementById('apply-preset').onclick = () => {
            browser.addToRecent(id);
            if (onPresetSelect) {
                onPresetSelect(preset);
            }
            console.log('[PluginPresetBrowser] Applied preset:', preset.name);
        };
        
        // Duplicate
        document.getElementById('duplicate-preset').onclick = () => {
            const duplicate = browser.duplicatePreset(id);
            if (duplicate) {
                showPresetDetails(duplicate.id);
                renderPresets(browser.getPresetsByCategory(currentCategory));
            }
        };
        
        // Export
        document.getElementById('export-preset').onclick = () => {
            const json = browser.exportPreset(id);
            if (json) {
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${preset.name.replace(/\s+/g, '_')}.preset.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        };
        
        // Delete
        const deleteBtn = document.getElementById('delete-preset');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (confirm('Delete this preset?')) {
                    browser.deletePreset(id);
                    details.style.display = 'none';
                    renderPresets(browser.getPresetsByCategory(currentCategory));
                }
            };
        }
    }
    
    // Category buttons
    panel.querySelectorAll('.cat-btn').forEach(btn => {
        btn.onclick = () => {
            currentCategory = btn.dataset.cat;
            renderPresets(browser.getPresetsByCategory(currentCategory));
        };
    });
    
    // Quick access
    document.getElementById('show-favorites').onclick = () => {
        renderPresets(browser.getFavorites());
    };
    
    document.getElementById('show-recent').onclick = () => {
        renderPresets(browser.getRecent());
    };
    
    document.getElementById('show-all').onclick = () => {
        renderPresets(Array.from(browser.presets.values()));
    };
    
    // Search
    const searchInput = document.getElementById('preset-search');
    let searchTimeout;
    
    searchInput.oninput = () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = searchInput.value.trim();
            if (query) {
                renderPresets(browser.searchPresets(query));
            } else {
                if (currentCategory) {
                    renderPresets(browser.getPresetsByCategory(currentCategory));
                } else {
                    renderPresets(Array.from(browser.presets.values()));
                }
            }
        }, 300);
    };
    
    document.getElementById('clear-search').onclick = () => {
        searchInput.value = '';
        if (currentCategory) {
            renderPresets(browser.getPresetsByCategory(currentCategory));
        } else {
            renderPresets(Array.from(browser.presets.values()));
        }
    };
    
    // Show search history
    if (browser.searchHistory.length > 0) {
        const historyDiv = document.getElementById('search-history');
        const historyTags = document.getElementById('history-tags');
        historyDiv.style.display = 'block';
        historyTags.innerHTML = browser.searchHistory.slice(0, 5).map(q => 
            `<span style="font-size: 11px; background: #333; padding: 2px 8px; border-radius: 3px; margin-right: 4px; cursor: pointer;" class="history-tag">${q}</span>`
        ).join('');
        
        historyTags.querySelectorAll('.history-tag').forEach(tag => {
            tag.onclick = () => {
                searchInput.value = tag.textContent;
                renderPresets(browser.searchPresets(tag.textContent));
            };
        });
    }
    
    // Create preset
    document.getElementById('create-preset').onclick = () => {
        const name = prompt('Enter preset name:');
        if (name) {
            const plugin = prompt('Enter plugin type (EQ, Compressor, Reverb, etc.):');
            if (plugin) {
                const preset = browser.addPreset({
                    name,
                    plugin,
                    settings: {},
                    tags: [],
                    isUser: true
                });
                browser.saveToStorage();
                showPresetDetails(preset.id);
                renderPresets(browser.getPresetsByCategory(plugin));
            }
        }
    };
    
    // Import
    document.getElementById('import-preset').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const text = await file.text();
                const preset = browser.importPreset(text);
                if (preset) {
                    showPresetDetails(preset.id);
                    renderPresets(browser.getPresetsByCategory(preset.plugin));
                }
            }
        };
        input.click();
    };
    
    // Export all
    document.getElementById('export-all-presets').onclick = () => {
        const json = browser.exportAllUserPresets();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'snugos_presets_backup.json';
        a.click();
        URL.revokeObjectURL(url);
    };
    
    // Initial render
    renderPresets(Array.from(browser.presets.values()));
}

// Initialize
function initPluginPresetBrowser() {
    const browser = new PluginPresetBrowser();
    
    if (!window.snugDAW) window.snugDAW = {};
    window.snugDAW.presetBrowser = browser;
    
    return browser;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PluginPresetBrowser, initPluginPresetBrowser, openPluginPresetBrowserPanel };
}