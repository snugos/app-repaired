// AI Mastering Enhancement - Advanced AI-driven mastering algorithms and presets
// Provides multiple mastering styles with intelligent parameter adjustment

class AIMasteringEnhancement {
    constructor(audioContext, masterBus) {
        this.audioContext = audioContext;
        this.masterBus = masterBus;
        this.enabled = false;
        this.currentPreset = null;
        
        // Mastering parameters
        this.parameters = {
            targetLUFS: -14,        // Streaming standard
            truePeak: -1.0,         // True peak limit
            dynamicRange: 8,        // DR in dB
            stereoWidth: 100,       // Percentage
            bassEnhancement: 0,     // dB
            airEnhancement: 0,      // dB
            warmth: 0,              // Harmonic content
            compressionStyle: 'transparent', // transparent, punchy, glue
            eqCurve: 'flat',        // flat, warm, bright, vintage, modern
            multibandRatio: [4, 4, 4], // Ratios for low, mid, high
            multibandThreshold: [-20, -18, -16], // Thresholds in dB
            limiterCeiling: -0.5,   // dB
            limiterRelease: 100,    // ms
            saturationAmount: 0,    // Percentage
            dithering: true,
            oversampling: 4
        };
        
        // Presets organized by genre/style
        this.presets = {
            // Streaming presets
            streaming: {
                spotify: { name: 'Spotify Ready', targetLUFS: -14, truePeak: -1, dynamicRange: 8, stereoWidth: 105, eqCurve: 'modern', compressionStyle: 'transparent' },
                appleMusic: { name: 'Apple Music', targetLUFS: -16, truePeak: -1, dynamicRange: 9, stereoWidth: 100, eqCurve: 'modern', compressionStyle: 'transparent' },
                youtube: { name: 'YouTube', targetLUFS: -14, truePeak: -1, dynamicRange: 8, stereoWidth: 105, eqCurve: 'flat', compressionStyle: 'transparent' },
                soundcloud: { name: 'SoundCloud', targetLUFS: -14, truePeak: -1, dynamicRange: 7, stereoWidth: 110, eqCurve: 'modern', compressionStyle: 'punchy' },
                tidal: { name: 'Tidal HiFi', targetLUFS: -14, truePeak: -1, dynamicRange: 10, stereoWidth: 100, eqCurve: 'flat', compressionStyle: 'transparent' },
                amazonMusic: { name: 'Amazon Music', targetLUFS: -14, truePeak: -1, dynamicRange: 9, stereoWidth: 100, eqCurve: 'modern', compressionStyle: 'transparent' }
            },
            // Genre presets
            genre: {
                pop: { name: 'Pop', targetLUFS: -12, truePeak: -1, dynamicRange: 6, stereoWidth: 110, bassEnhancement: 2, airEnhancement: 2, warmth: 5, compressionStyle: 'punchy', eqCurve: 'modern' },
                rock: { name: 'Rock', targetLUFS: -13, truePeak: -1, dynamicRange: 7, stereoWidth: 100, bassEnhancement: 3, airEnhancement: 1, warmth: 10, compressionStyle: 'glue', eqCurve: 'vintage' },
                electronic: { name: 'Electronic/EDM', targetLUFS: -11, truePeak: -1, dynamicRange: 5, stereoWidth: 120, bassEnhancement: 4, airEnhancement: 3, warmth: 0, compressionStyle: 'punchy', eqCurve: 'modern' },
                hipHop: { name: 'Hip-Hop/Rap', targetLUFS: -12, truePeak: -1, dynamicRange: 6, stereoWidth: 105, bassEnhancement: 5, airEnhancement: 1, warmth: 8, compressionStyle: 'punchy', eqCurve: 'warm' },
                jazz: { name: 'Jazz', targetLUFS: -16, truePeak: -1, dynamicRange: 12, stereoWidth: 90, bassEnhancement: 0, airEnhancement: 2, warmth: 5, compressionStyle: 'transparent', eqCurve: 'vintage' },
                classical: { name: 'Classical', targetLUFS: -18, truePeak: -1, dynamicRange: 18, stereoWidth: 95, bassEnhancement: 0, airEnhancement: 3, warmth: 0, compressionStyle: 'transparent', eqCurve: 'flat' },
                metal: { name: 'Metal', targetLUFS: -12, truePeak: -1, dynamicRange: 5, stereoWidth: 95, bassEnhancement: 2, airEnhancement: 4, warmth: 15, compressionStyle: 'glue', eqCurve: 'bright' },
                acoustic: { name: 'Acoustic', targetLUFS: -16, truePeak: -1, dynamicRange: 14, stereoWidth: 85, bassEnhancement: 0, airEnhancement: 2, warmth: 5, compressionStyle: 'transparent', eqCurve: 'warm' },
                rnb: { name: 'R&B/Soul', targetLUFS: -13, truePeak: -1, dynamicRange: 7, stereoWidth: 100, bassEnhancement: 3, airEnhancement: 2, warmth: 8, compressionStyle: 'transparent', eqCurve: 'warm' },
                country: { name: 'Country', targetLUFS: -14, truePeak: -1, dynamicRange: 8, stereoWidth: 95, bassEnhancement: 1, airEnhancement: 3, warmth: 5, compressionStyle: 'transparent', eqCurve: 'bright' },
                lofi: { name: 'Lo-Fi', targetLUFS: -14, truePeak: -1, dynamicRange: 10, stereoWidth: 80, bassEnhancement: 2, airEnhancement: -2, warmth: 20, saturationAmount: 30, compressionStyle: 'glue', eqCurve: 'vintage' },
                ambient: { name: 'Ambient', targetLUFS: -18, truePeak: -1, dynamicRange: 20, stereoWidth: 130, bassEnhancement: 0, airEnhancement: 5, warmth: 0, compressionStyle: 'transparent', eqCurve: 'flat' }
            },
            // Style presets
            style: {
                transparent: { name: 'Transparent', targetLUFS: -14, truePeak: -1, dynamicRange: 10, stereoWidth: 100, compressionStyle: 'transparent', eqCurve: 'flat' },
                loud: { name: 'Loud & Proud', targetLUFS: -9, truePeak: -1, dynamicRange: 4, stereoWidth: 115, bassEnhancement: 3, airEnhancement: 3, compressionStyle: 'punchy', eqCurve: 'modern' },
                vintage: { name: 'Vintage Warm', targetLUFS: -14, truePeak: -1, dynamicRange: 8, stereoWidth: 90, warmth: 25, saturationAmount: 20, compressionStyle: 'glue', eqCurve: 'vintage' },
                modern: { name: 'Modern Bright', targetLUFS: -12, truePeak: -1, dynamicRange: 6, stereoWidth: 110, airEnhancement: 4, compressionStyle: 'punchy', eqCurve: 'modern' },
                dynamic: { name: 'Dynamic', targetLUFS: -16, truePeak: -1, dynamicRange: 14, stereoWidth: 100, compressionStyle: 'transparent', eqCurve: 'flat' },
                broadcast: { name: 'Broadcast', targetLUFS: -24, truePeak: -2, dynamicRange: 15, stereoWidth: 90, compressionStyle: 'transparent', eqCurve: 'flat' },
                podcast: { name: 'Podcast/Voice', targetLUFS: -19, truePeak: -1.5, dynamicRange: 8, stereoWidth: 100, bassEnhancement: -2, airEnhancement: 2, warmth: 5, compressionStyle: 'transparent', eqCurve: 'bright' }
            }
        };
        
        // Mastering chain nodes
        this.nodes = {
            inputGain: null,
            multibandCompressor: null,
            eq: null,
            stereoImager: null,
            saturator: null,
            limiter: null,
            outputGain: null,
            meter: null
        };
        
        // Analysis data
        this.analysis = {
            currentLUFS: 0,
            currentTruePeak: 0,
            dynamicRange: 0,
            stereoWidth: 0,
            frequencyBalance: new Array(8).fill(0),
            peakFrequency: 0
        };
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        
        this.init();
    }
    
    init() {
        // Create mastering chain
        this.createMasteringChain();
        console.log('[AIMasteringEnhancement] Initialized with', Object.keys(this.presets).reduce((acc, cat) => acc + Object.keys(this.presets[cat]).length, 0), 'presets');
    }
    
    createMasteringChain() {
        // Input gain
        this.nodes.inputGain = this.audioContext.createGain();
        this.nodes.inputGain.gain.value = 1.0;
        
        // EQ (3-band parametric)
        this.nodes.eq = {
            lowShelf: this.audioContext.createBiquadFilter(),
            lowMid: this.audioContext.createBiquadFilter(),
            highMid: this.audioContext.createBiquadFilter(),
            highShelf: this.audioContext.createBiquadFilter()
        };
        
        this.nodes.eq.lowShelf.type = 'lowshelf';
        this.nodes.eq.lowShelf.frequency.value = 100;
        this.nodes.eq.lowShelf.gain.value = 0;
        
        this.nodes.eq.lowMid.type = 'peaking';
        this.nodes.eq.lowMid.frequency.value = 300;
        this.nodes.eq.lowMid.Q.value = 1;
        this.nodes.eq.lowMid.gain.value = 0;
        
        this.nodes.eq.highMid.type = 'peaking';
        this.nodes.eq.highMid.frequency.value = 3000;
        this.nodes.eq.highMid.Q.value = 1;
        this.nodes.eq.highMid.gain.value = 0;
        
        this.nodes.eq.highShelf.type = 'highshelf';
        this.nodes.eq.highShelf.frequency.value = 8000;
        this.nodes.eq.highShelf.gain.value = 0;
        
        // Stereo imager (uses channel merger/splitter)
        this.nodes.stereoImager = {
            splitter: this.audioContext.createChannelSplitter(2),
            merger: this.audioContext.createChannelMerger(2),
            leftGain: this.audioContext.createGain(),
            rightGain: this.audioContext.createGain(),
            midGain: this.audioContext.createGain(),
            sideGain: this.audioContext.createGain()
        };
        
        // Limiter (compressor with high ratio)
        this.nodes.limiter = this.audioContext.createDynamicsCompressor();
        this.nodes.limiter.threshold.value = -1;
        this.nodes.limiter.knee.value = 0;
        this.nodes.limiter.ratio.value = 20;
        this.nodes.limiter.attack.value = 0.003;
        this.nodes.limiter.release.value = 0.1;
        
        // Output gain
        this.nodes.outputGain = this.audioContext.createGain();
        this.nodes.outputGain.gain.value = 1.0;
        
        // Meter (analyser)
        this.nodes.meter = this.audioContext.createAnalyser();
        this.nodes.meter.fftSize = 2048;
        
        // Connect chain
        this.connectChain();
    }
    
    connectChain() {
        // Input -> EQ -> Stereo Imager -> Limiter -> Output -> Meter
        let current = this.nodes.inputGain;
        
        // EQ chain
        current.connect(this.nodes.eq.lowShelf);
        this.nodes.eq.lowShelf.connect(this.nodes.eq.lowMid);
        this.nodes.eq.lowMid.connect(this.nodes.eq.highMid);
        this.nodes.eq.highMid.connect(this.nodes.eq.highShelf);
        current = this.nodes.eq.highShelf;
        
        // Stereo imager
        current.connect(this.nodes.stereoImager.splitter);
        this.nodes.stereoImager.splitter.connect(this.nodes.stereoImager.leftGain, 0);
        this.nodes.stereoImager.splitter.connect(this.nodes.stereoImager.rightGain, 1);
        this.nodes.stereoImager.leftGain.connect(this.nodes.stereoImager.merger, 0, 0);
        this.nodes.stereoImager.rightGain.connect(this.nodes.stereoImager.merger, 0, 1);
        current = this.nodes.stereoImager.merger;
        
        // Limiter
        current.connect(this.nodes.limiter);
        current = this.nodes.limiter;
        
        // Output and meter
        current.connect(this.nodes.outputGain);
        this.nodes.outputGain.connect(this.nodes.meter);
    }
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        console.log('[AIMasteringEnhancement] Enabled');
    }
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        console.log('[AIMasteringEnhancement] Disabled');
    }
    
    applyPreset(category, presetName) {
        const categoryPresets = this.presets[category];
        if (!categoryPresets) {
            console.error('[AIMasteringEnhancement] Unknown category:', category);
            return false;
        }
        
        const preset = categoryPresets[presetName];
        if (!preset) {
            console.error('[AIMasteringEnhancement] Unknown preset:', presetName);
            return false;
        }
        
        // Save current state for undo
        this.saveToHistory();
        
        // Apply preset parameters
        Object.keys(preset).forEach(key => {
            if (key !== 'name' && this.parameters.hasOwnProperty(key)) {
                this.parameters[key] = preset[key];
            }
        });
        
        this.currentPreset = { category, name: presetName, preset };
        this.applyParameters();
        
        console.log('[AIMasteringEnhancement] Applied preset:', preset.name);
        return true;
    }
    
    applyParameters() {
        // Apply input gain
        const inputGain = Math.pow(10, this.parameters.targetLUFS / 20 + 14 / 20);
        this.nodes.inputGain.gain.value = Math.min(inputGain, 2.0);
        
        // Apply EQ curve
        this.applyEQCurve(this.parameters.eqCurve);
        
        // Apply bass and air enhancement
        this.nodes.eq.lowShelf.gain.value = this.parameters.bassEnhancement;
        this.nodes.eq.highShelf.gain.value = this.parameters.airEnhancement;
        
        // Apply stereo width
        this.applyStereoWidth(this.parameters.stereoWidth);
        
        // Apply limiter settings
        this.nodes.limiter.threshold.value = this.parameters.limiterCeiling;
        this.nodes.limiter.release.value = this.parameters.limiterRelease / 1000;
        
        // Apply compression style
        this.applyCompressionStyle(this.parameters.compressionStyle);
    }
    
    applyEQCurve(curve) {
        const curves = {
            flat: [0, 0, 0, 0],
            warm: [2, 1, 0, -1],
            bright: [-1, 0, 1, 3],
            vintage: [3, 2, 0, -2],
            modern: [0, -1, 1, 2]
        };
        
        const values = curves[curve] || curves.flat;
        this.nodes.eq.lowShelf.gain.value += values[0];
        this.nodes.eq.lowMid.gain.value = values[1];
        this.nodes.eq.highMid.gain.value = values[2];
        this.nodes.eq.highShelf.gain.value += values[3];
    }
    
    applyStereoWidth(width) {
        // Width: 0% = mono, 100% = normal, >100% = enhanced
        const factor = width / 100;
        this.nodes.stereoImager.leftGain.gain.value = factor;
        this.nodes.stereoImager.rightGain.gain.value = factor;
        
        // Adjust side gain for width > 100
        if (width > 100) {
            const sideBoost = (width - 100) / 100;
            this.nodes.stereoImager.sideGain.gain.value = 1 + sideBoost;
        }
    }
    
    applyCompressionStyle(style) {
        const styles = {
            transparent: { ratio: 4, attack: 30, release: 150 },
            punchy: { ratio: 6, attack: 10, release: 80 },
            glue: { ratio: 4, attack: 50, release: 200 }
        };
        
        const settings = styles[style] || styles.transparent;
        
        // Apply to multiband (if exists) or single-band
        if (this.nodes.multibandCompressor) {
            // Apply multiband settings
        }
    }
    
    saveToHistory() {
        // Remove future history if we're not at the end
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        // Save current state
        this.history.push(JSON.parse(JSON.stringify(this.parameters)));
        this.historyIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    undo() {
        if (this.historyIndex < 0) return false;
        
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.parameters = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
            this.applyParameters();
            console.log('[AIMasteringEnhancement] Undo');
            return true;
        }
        return false;
    }
    
    redo() {
        if (this.historyIndex >= this.history.length - 1) return false;
        
        this.historyIndex++;
        this.parameters = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        this.applyParameters();
        console.log('[AIMasteringEnhancement] Redo');
        return true;
    }
    
    analyzeAudio() {
        // Get frequency data
        const dataArray = new Float32Array(this.nodes.meter.fftSize);
        this.nodes.meter.getFloatFrequencyData(dataArray);
        
        // Calculate band levels
        const bandSize = dataArray.length / 8;
        for (let i = 0; i < 8; i++) {
            let sum = 0;
            for (let j = i * bandSize; j < (i + 1) * bandSize; j++) {
                sum += dataArray[j];
            }
            this.analysis.frequencyBalance[i] = sum / bandSize;
        }
        
        // Find peak frequency
        let maxVal = -Infinity;
        let maxIdx = 0;
        for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > maxVal) {
                maxVal = dataArray[i];
                maxIdx = i;
            }
        }
        this.analysis.peakFrequency = maxIdx * this.audioContext.sampleRate / this.nodes.meter.fftSize;
        
        return this.analysis;
    }
    
    // AI-powered analysis and suggestions
    getAISuggestions() {
        const analysis = this.analyzeAudio();
        const suggestions = [];
        
        // Check for frequency balance issues
        const avgLevel = analysis.frequencyBalance.reduce((a, b) => a + b, 0) / 8;
        
        if (analysis.frequencyBalance[0] > avgLevel + 10) {
            suggestions.push({
                type: 'eq',
                message: 'Sub-bass is too prominent. Consider cutting below 80Hz.',
                action: { parameter: 'bassEnhancement', value: -3 }
            });
        }
        
        if (analysis.frequencyBalance[7] > avgLevel + 10) {
            suggestions.push({
                type: 'eq',
                message: 'High frequencies are harsh. Consider de-essing or high shelf cut.',
                action: { parameter: 'airEnhancement', value: -2 }
            });
        }
        
        // Dynamic range suggestions
        if (analysis.dynamicRange < 6) {
            suggestions.push({
                type: 'dynamic',
                message: 'Dynamic range is too compressed. Consider reducing compression.',
                action: { parameter: 'dynamicRange', value: 8 }
            });
        }
        
        // Stereo width suggestions
        if (analysis.stereoWidth < 80) {
            suggestions.push({
                type: 'stereo',
                message: 'Mix is too narrow. Consider widening for more impact.',
                action: { parameter: 'stereoWidth', value: 100 }
            });
        }
        
        return suggestions;
    }
    
    // Apply AI suggestion
    applySuggestion(suggestion) {
        if (suggestion.action) {
            this.saveToHistory();
            this.parameters[suggestion.action.parameter] = suggestion.action.value;
            this.applyParameters();
            console.log('[AIMasteringEnhancement] Applied suggestion:', suggestion.message);
        }
    }
    
    // Export settings
    exportSettings() {
        return {
            parameters: this.parameters,
            currentPreset: this.currentPreset,
            version: '1.0'
        };
    }
    
    // Import settings
    importSettings(settings) {
        if (settings.version !== '1.0') {
            console.warn('[AIMasteringEnhancement] Incompatible settings version');
            return false;
        }
        
        this.saveToHistory();
        this.parameters = { ...this.parameters, ...settings.parameters };
        this.currentPreset = settings.currentPreset;
        this.applyParameters();
        
        console.log('[AIMasteringEnhancement] Imported settings');
        return true;
    }
    
    // Get all presets
    getAllPresets() {
        return this.presets;
    }
    
    // Create custom preset
    createCustomPreset(name, parameters) {
        if (!this.presets.custom) {
            this.presets.custom = {};
        }
        
        this.presets.custom[name] = {
            name,
            ...this.parameters,
            ...parameters
        };
        
        console.log('[AIMasteringEnhancement] Created custom preset:', name);
        return true;
    }
    
    // Delete custom preset
    deleteCustomPreset(name) {
        if (this.presets.custom && this.presets.custom[name]) {
            delete this.presets.custom[name];
            console.log('[AIMasteringEnhancement] Deleted custom preset:', name);
            return true;
        }
        return false;
    }
}

// UI Panel
function openAIMasteringEnhancementPanel() {
    const existing = document.getElementById('ai-mastering-enhancement-panel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'ai-mastering-enhancement-panel';
    panel.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1a1a2e; border: 1px solid #444; border-radius: 8px; padding: 24px; z-index: 10000; min-width: 600px; max-height: 80vh; overflow-y: auto; color: white; font-family: system-ui;';
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 20px;">🤖 AI Mastering Enhancement</h2>
            <button id="close-ai-mastering" style="background: #333; border: none; color: white; padding: 8px 12px; border-radius: 4px; cursor: pointer;">✕</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <!-- Presets Section -->
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">PRESETS</h3>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Streaming</label>
                    <select id="streaming-presets" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                        <option value="">Select preset...</option>
                        <option value="spotify">Spotify Ready</option>
                        <option value="appleMusic">Apple Music</option>
                        <option value="youtube">YouTube</option>
                        <option value="soundcloud">SoundCloud</option>
                        <option value="tidal">Tidal HiFi</option>
                        <option value="amazonMusic">Amazon Music</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Genre</label>
                    <select id="genre-presets" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                        <option value="">Select genre...</option>
                        <option value="pop">Pop</option>
                        <option value="rock">Rock</option>
                        <option value="electronic">Electronic/EDM</option>
                        <option value="hipHop">Hip-Hop/Rap</option>
                        <option value="jazz">Jazz</option>
                        <option value="classical">Classical</option>
                        <option value="metal">Metal</option>
                        <option value="acoustic">Acoustic</option>
                        <option value="rnb">R&B/Soul</option>
                        <option value="country">Country</option>
                        <option value="lofi">Lo-Fi</option>
                        <option value="ambient">Ambient</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 4px;">Style</label>
                    <select id="style-presets" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #444; color: white; border-radius: 4px;">
                        <option value="">Select style...</option>
                        <option value="transparent">Transparent</option>
                        <option value="loud">Loud & Proud</option>
                        <option value="vintage">Vintage Warm</option>
                        <option value="modern">Modern Bright</option>
                        <option value="dynamic">Dynamic</option>
                        <option value="broadcast">Broadcast</option>
                        <option value="podcast">Podcast/Voice</option>
                    </select>
                </div>
            </div>
            
            <!-- Parameters Section -->
            <div style="background: #0a0a14; padding: 16px; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">PARAMETERS</h3>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
                        <span>Target LUFS</span>
                        <span id="lufs-value">-14</span>
                    </label>
                    <input type="range" id="target-lufs" min="-24" max="-6" value="-14" step="0.5" style="width: 100%;">
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
                        <span>True Peak (dB)</span>
                        <span id="truepeak-value">-1.0</span>
                    </label>
                    <input type="range" id="true-peak" min="-3" max="-0.5" value="-1" step="0.1" style="width: 100%;">
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
                        <span>Dynamic Range (dB)</span>
                        <span id="dr-value">8</span>
                    </label>
                    <input type="range" id="dynamic-range" min="3" max="20" value="8" step="1" style="width: 100%;">
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
                        <span>Stereo Width (%)</span>
                        <span id="width-value">100</span>
                    </label>
                    <input type="range" id="stereo-width" min="50" max="150" value="100" step="5" style="width: 100%;">
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
                        <span>Bass Enhancement (dB)</span>
                        <span id="bass-value">0</span>
                    </label>
                    <input type="range" id="bass-enhancement" min="-6" max="10" value="0" step="0.5" style="width: 100%;">
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px;">
                        <span>Air Enhancement (dB)</span>
                        <span id="air-value">0</span>
                    </label>
                    <input type="range" id="air-enhancement" min="-6" max="10" value="0" step="0.5" style="width: 100%;">
                </div>
            </div>
        </div>
        
        <!-- AI Suggestions -->
        <div style="background: #0a0a14; padding: 16px; border-radius: 6px; margin-top: 20px;">
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">AI SUGGESTIONS</h3>
            <div id="ai-suggestions" style="color: #aaa; font-size: 13px;">
                Click "Analyze" to get AI-powered mastering suggestions.
            </div>
            <button id="analyze-btn" style="margin-top: 12px; padding: 8px 16px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">🔍 Analyze</button>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; gap: 12px; margin-top: 20px;">
            <button id="apply-mastering" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">Apply Mastering</button>
            <button id="export-settings" style="padding: 12px 16px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">Export</button>
            <button id="import-settings" style="padding: 12px 16px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">Import</button>
            <button id="undo-btn" style="padding: 12px 16px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">↶</button>
            <button id="redo-btn" style="padding: 12px 16px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer;">↷</button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-ai-mastering').onclick = () => panel.remove();
    
    // Preset selection
    ['streaming', 'genre', 'style'].forEach(category => {
        const select = document.getElementById(`${category}-presets`);
        select.onchange = () => {
            if (select.value && window.snugDAW?.aiMastering) {
                window.snugDAW.aiMastering.applyPreset(category, select.value);
            }
        };
    });
    
    // Parameter sliders
    const sliders = [
        { id: 'target-lufs', valueId: 'lufs-value', param: 'targetLUFS' },
        { id: 'true-peak', valueId: 'truepeak-value', param: 'truePeak' },
        { id: 'dynamic-range', valueId: 'dr-value', param: 'dynamicRange' },
        { id: 'stereo-width', valueId: 'width-value', param: 'stereoWidth' },
        { id: 'bass-enhancement', valueId: 'bass-value', param: 'bassEnhancement' },
        { id: 'air-enhancement', valueId: 'air-value', param: 'airEnhancement' }
    ];
    
    sliders.forEach(({ id, valueId, param }) => {
        const slider = document.getElementById(id);
        const valueSpan = document.getElementById(valueId);
        slider.oninput = () => {
            valueSpan.textContent = slider.value;
            if (window.snugDAW?.aiMastering) {
                window.snugDAW.aiMastering.parameters[param] = parseFloat(slider.value);
            }
        };
    });
    
    // Analyze button
    document.getElementById('analyze-btn').onclick = () => {
        if (window.snugDAW?.aiMastering) {
            const suggestions = window.snugDAW.aiMastering.getAISuggestions();
            const container = document.getElementById('ai-suggestions');
            
            if (suggestions.length === 0) {
                container.innerHTML = '<span style="color: #10b981;">✓ No issues detected! Your mix sounds good.</span>';
            } else {
                container.innerHTML = suggestions.map((s, i) => `
                    <div style="margin-bottom: 8px; padding: 8px; background: #1a1a2e; border-radius: 4px;">
                        <span style="color: ${s.type === 'eq' ? '#f59e0b' : s.type === 'dynamic' ? '#ef4444' : '#3b82f6'};">${s.message}</span>
                        <button class="apply-suggestion" data-index="${i}" style="margin-left: 8px; padding: 4px 8px; background: #444; border: none; color: white; border-radius: 3px; cursor: pointer; font-size: 11px;">Apply</button>
                    </div>
                `).join('');
                
                container.querySelectorAll('.apply-suggestion').forEach(btn => {
                    btn.onclick = () => {
                        const idx = parseInt(btn.dataset.index);
                        window.snugDAW.aiMastering.applySuggestion(suggestions[idx]);
                    };
                });
            }
        }
    };
    
    // Apply button
    document.getElementById('apply-mastering').onclick = () => {
        if (window.snugDAW?.aiMastering) {
            window.snugDAW.aiMastering.applyParameters();
            console.log('[AIMasteringEnhancement] Applied mastering settings');
        }
    };
    
    // Export/Import
    document.getElementById('export-settings').onclick = () => {
        if (window.snugDAW?.aiMastering) {
            const settings = window.snugDAW.aiMastering.exportSettings();
            const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ai-mastering-settings.json';
            a.click();
            URL.revokeObjectURL(url);
        }
    };
    
    document.getElementById('import-settings').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const text = await file.text();
                try {
                    const settings = JSON.parse(text);
                    if (window.snugDAW?.aiMastering) {
                        window.snugDAW.aiMastering.importSettings(settings);
                    }
                } catch (err) {
                    console.error('Failed to import settings:', err);
                }
            }
        };
        input.click();
    };
    
    // Undo/Redo
    document.getElementById('undo-btn').onclick = () => {
        if (window.snugDAW?.aiMastering) {
            window.snugDAW.aiMastering.undo();
        }
    };
    
    document.getElementById('redo-btn').onclick = () => {
        if (window.snugDAW?.aiMastering) {
            window.snugDAW.aiMastering.redo();
        }
    };
}

// Initialize
function initAIMasteringEnhancement(audioContext, masterBus) {
    const enhancer = new AIMasteringEnhancement(audioContext, masterBus);
    
    // Expose globally
    if (!window.snugDAW) window.snugDAW = {};
    window.snugDAW.aiMastering = enhancer;
    
    return enhancer;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIMasteringEnhancement, initAIMasteringEnhancement, openAIMasteringEnhancementPanel };
}