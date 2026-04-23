// js/CustomLFOPresets.js - Custom LFO Shapes for SnugOS DAW
// Allows users to create, save, and use custom-drawn LFO curves

/**
 * CustomLFOPresets provides user-drawable LFO curves for modulation.
 * 
 * Features:
 * - Draw custom LFO shapes by clicking/dragging
 * - Save shapes as named presets
 * - Apply custom LFOs to any parameter
 * - Export/import LFO preset libraries
 * - Built-in presets for common shapes
 */

/**
 * Built-in LFO shape presets
 */
export const LFOPresetShapes = {
    sine: {
        name: 'Sine',
        description: 'Smooth sine wave oscillation',
        points: generateSineCurve(256),
        category: 'basic'
    },
    triangle: {
        name: 'Triangle',
        description: 'Linear triangle wave',
        points: generateTriangleCurve(256),
        category: 'basic'
    },
    square: {
        name: 'Square',
        description: 'Sharp square wave',
        points: generateSquareCurve(256),
        category: 'basic'
    },
    sawtooth_up: {
        name: 'Sawtooth Up',
        description: 'Rising sawtooth wave',
        points: generateSawtoothUpCurve(256),
        category: 'basic'
    },
    sawtooth_down: {
        name: 'Sawtooth Down',
        description: 'Falling sawtooth wave',
        points: generateSawtoothDownCurve(256),
        category: 'basic'
    },
    random_s&h: {
        name: 'Sample & Hold',
        description: 'Random stepped values',
        points: generateSampleHoldCurve(256, 8),
        category: 'random'
    },
    random_smooth: {
        name: 'Smooth Random',
        description: 'Smooth random curves',
        points: generateSmoothRandomCurve(256),
        category: 'random'
    },
    exponential_up: {
        name: 'Exponential Rise',
        description: 'Exponential attack curve',
        points: generateExponentialCurve(256, 2.0),
        category: 'envelope'
    },
    exponential_down: {
        name: 'Exponential Fall',
        description: 'Exponential decay curve',
        points: generateExponentialCurve(256, 0.5),
        category: 'envelope'
    },
    bounce: {
        name: 'Bounce',
        description: 'Bouncing ball decay',
        points: generateBounceCurve(256),
        category: 'rhythmic'
    },
    heartbeat: {
        name: 'Heartbeat',
        description: 'Double-pulse pattern',
        points: generateHeartbeatCurve(256),
        category: 'rhythmic'
    },
    tremolo: {
        name: 'Tremolo',
        description: 'Fast amplitude modulation',
        points: generateTremoloCurve(256),
        category: 'musical'
    },
    vibrato: {
        name: 'Vibrato',
        description: 'Pitch modulation shape',
        points: generateVibratoCurve(256),
        category: 'musical'
    },
    breath: {
        name: 'Breath',
        description: 'Natural breathing pattern',
        points: generateBreathCurve(256),
        category: 'natural'
    },
    stepped_8: {
        name: '8-Step',
        description: '8-step sequencer pattern',
        points: generateSteppedCurve(256, 8),
        category: 'sequencer'
    },
    stepped_16: {
        name: '16-Step',
        description: '16-step sequencer pattern',
        points: generateSteppedCurve(256, 16),
        category: 'sequencer'
    }
};

/**
 * Generate sine curve points
 */
function generateSineCurve(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const t = i / numPoints;
        points.push(Math.sin(t * Math.PI * 2) * 0.5 + 0.5);
    }
    return points;
}

/**
 * Generate triangle curve points
 */
function generateTriangleCurve(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const t = i / numPoints;
        points.push(2 * Math.abs(t - 0.5));
    }
    return points;
}

/**
 * Generate square curve points
 */
function generateSquareCurve(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const t = i / numPoints;
        points.push(t < 0.5 ? 1 : 0);
    }
    return points;
}

/**
 * Generate sawtooth up curve points
 */
function generateSawtoothUpCurve(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(i / numPoints);
    }
    return points;
}

/**
 * Generate sawtooth down curve points
 */
function generateSawtoothDownCurve(numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        points.push(1 - (i / numPoints));
    }
    return points;
}

/**
 * Generate sample and hold curve
 */
function generateSampleHoldCurve(numPoints, steps) {
    const points = [];
    const stepSize = numPoints / steps;
    let currentValue = Math.random();
    
    for (let i = 0; i < numPoints; i++) {
        const stepIndex = Math.floor(i / stepSize);
        if (i % stepSize === 0 && stepIndex > 0) {
            currentValue = Math.random();
        }
        points.push(currentValue);
    }
    return points;
}

/**
 * Generate smooth random curve
 */
function generateSmoothRandomCurve(numPoints) {
    const points = [];
    const numSegments = 4;
    const segmentSize = numPoints / numSegments;
    const values = [Math.random()];
    
    for (let i = 0; i < numSegments; i++) {
        values.push(Math.random());
    }
    
    for (let i = 0; i < numPoints; i++) {
        const segment = Math.floor(i / segmentSize);
        const localT = (i % segmentSize) / segmentSize;
        const a = values[segment];
        const b = values[segment + 1];
        // Smooth interpolation using smoothstep
        const t = localT * localT * (3 - 2 * localT);
        points.push(a + (b - a) * t);
    }
    return points;
}

/**
 * Generate exponential curve
 */
function generateExponentialCurve(numPoints, exponent) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const t = i / numPoints;
        if (exponent > 1) {
            points.push(Math.pow(t, exponent));
        } else {
            points.push(1 - Math.pow(1 - t, 1 / exponent));
        }
    }
    return points;
}

/**
 * Generate bounce curve
 */
function generateBounceCurve(numPoints) {
    const points = [];
    const bounces = 4;
    const decayFactor = 0.6;
    
    for (let i = 0; i < numPoints; i++) {
        const t = i / numPoints;
        let value = 0;
        
        // Calculate bounce position
        for (let b = 0; b < bounces; b++) {
            const bounceTime = (1 - Math.pow(decayFactor, b)) / (1 - Math.pow(decayFactor, bounces));
            const bounceHeight = Math.pow(decayFactor, b);
            const halfPeriod = (1 - decayFactor) / (1 - Math.pow(decayFactor, bounces)) / 2;
            
            const localT = (t - bounceTime + halfPeriod) / halfPeriod;
            if (localT >= 0 && localT <= 1) {
                value = bounceHeight * Math.sin(localT * Math.PI);
                break;
            }
        }
        points.push(Math.max(0, Math.min(1, value)));
    }
    return points;
}

/**
 * Generate heartbeat curve
 */
function generateHeartbeatCurve(numPoints) {
    const points = [];
    const beat1Center = numPoints * 0.25;
    const beat2Center = numPoints * 0.5;
    const beatWidth = numPoints * 0.08;
    
    for (let i = 0; i < numPoints; i++) {
        let value = 0;
        
        // First beat (stronger)
        const d1 = Math.abs(i - beat1Center) / beatWidth;
        if (d1 < 1) {
            value += Math.cos(d1 * Math.PI / 2) * 0.8;
        }
        
        // Second beat (lighter)
        const d2 = Math.abs(i - beat2Center) / beatWidth;
        if (d2 < 1) {
            value += Math.cos(d2 * Math.PI / 2) * 0.5;
        }
        
        points.push(Math.max(0, Math.min(1, value)));
    }
    return points;
}

/**
 * Generate tremolo curve
 */
function generateTremoloCurve(numPoints) {
    const points = [];
    const cycles = 8;
    
    for (let i = 0; i < numPoints; i++) {
        const t = i / numPoints;
        const base = 0.5;
        const mod = Math.sin(t * Math.PI * 2 * cycles) * 0.5;
        points.push(base + mod);
    }
    return points;
}

/**
 * Generate vibrato curve
 */
function generateVibratoCurve(numPoints) {
    const points = [];
    const cycles = 6;
    
    for (let i = 0; i < numPoints; i++) {
        const t = i / numPoints;
        // Vibrato is typically centered around 0 (for pitch modulation)
        const mod = Math.sin(t * Math.PI * 2 * cycles);
        points.push((mod + 1) / 2);
    }
    return points;
}

/**
 * Generate breath curve (natural breathing pattern)
 */
function generateBreathCurve(numPoints) {
    const points = [];
    
    for (let i = 0; i < numPoints; i++) {
        const t = i / numPoints;
        const cycle = t * 2 * Math.PI;
        
        // Inhale (slower) + exhale (faster) pattern
        const inhaleTime = 0.4;
        const exhaleTime = 0.6;
        
        let value;
        if (t < inhaleTime) {
            // Smooth inhale
            const localT = t / inhaleTime;
            value = Math.sin(localT * Math.PI / 2);
        } else {
            // Exponential exhale
            const localT = (t - inhaleTime) / exhaleTime;
            value = Math.exp(-localT * 3);
        }
        
        points.push(value);
    }
    return points;
}

/**
 * Generate stepped curve
 */
function generateSteppedCurve(numPoints, steps) {
    const points = [];
    const stepSize = numPoints / steps;
    
    for (let i = 0; i < steps; i++) {
        const value = (i + 1) / steps;
        for (let j = 0; j < stepSize; j++) {
            points.push(value);
        }
    }
    
    // Fill remaining points
    while (points.length < numPoints) {
        points.push(points[points.length - 1] || 0);
    }
    
    return points;
}

/**
 * CustomLFOShape - User-created LFO shape
 */
export class CustomLFOShape {
    constructor(config = {}) {
        this.id = config.id || `lfo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = config.name || 'Custom LFO';
        this.description = config.description || '';
        this.points = config.points || new Array(256).fill(0.5);
        this.category = config.category || 'custom';
        this.createdAt = config.createdAt || Date.now();
        this.modifiedAt = config.modifiedAt || Date.now();
        this.metadata = config.metadata || {};
    }
    
    /**
     * Get interpolated value at position (0-1)
     */
    getValueAt(phase) {
        if (!this.points || this.points.length === 0) return 0.5;
        
        // Normalize phase to 0-1
        phase = phase % 1;
        if (phase < 0) phase += 1;
        
        // Find position in points array
        const position = phase * this.points.length;
        const index = Math.floor(position);
        const fraction = position - index;
        
        // Linear interpolation between adjacent points
        const a = this.points[index];
        const b = this.points[(index + 1) % this.points.length];
        
        return a + (b - a) * fraction;
    }
    
    /**
     * Set point value
     */
    setPoint(index, value) {
        if (index >= 0 && index < this.points.length) {
            this.points[index] = Math.max(0, Math.min(1, value));
            this.modifiedAt = Date.now();
        }
    }
    
    /**
     * Set all points from array
     */
    setPoints(newPoints) {
        if (Array.isArray(newPoints) && newPoints.length > 0) {
            this.points = newPoints.map(v => Math.max(0, Math.min(1, v)));
            this.modifiedAt = Date.now();
        }
    }
    
    /**
     * Resize points array (interpolating or sampling)
     */
    resize(newLength) {
        if (newLength <= 0) return;
        
        const newPoints = [];
        for (let i = 0; i < newLength; i++) {
            const t = i / newLength;
            newPoints.push(this.getValueAt(t));
        }
        
        this.points = newPoints;
        this.modifiedAt = Date.now();
    }
    
    /**
     * Smooth the curve with a simple averaging filter
     */
    smooth(iterations = 1) {
        for (let iter = 0; iter < iterations; iter++) {
            const smoothed = [];
            const len = this.points.length;
            
            for (let i = 0; i < len; i++) {
                const prev = this.points[(i - 1 + len) % len];
                const curr = this.points[i];
                const next = this.points[(i + 1) % len];
                smoothed.push((prev + curr * 2 + next) / 4);
            }
            
            this.points = smoothed;
        }
        this.modifiedAt = Date.now();
    }
    
    /**
     * Invert the curve (1 - value)
     */
    invert() {
        this.points = this.points.map(v => 1 - v);
        this.modifiedAt = Date.now();
    }
    
    /**
     * Scale curve values
     */
    scale(factor, offset = 0) {
        this.points = this.points.map(v => {
            const scaled = v * factor + offset;
            return Math.max(0, Math.min(1, scaled));
        });
        this.modifiedAt = Date.now();
    }
    
    /**
     * Export to JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            points: this.points,
            category: this.category,
            createdAt: this.createdAt,
            modifiedAt: this.modifiedAt,
            metadata: this.metadata
        };
    }
    
    /**
     * Import from JSON
     */
    static fromJSON(json) {
        return new CustomLFOShape(json);
    }
}

/**
 * LFOEngine - Real-time LFO modulation engine
 */
export class LFOEngine {
    constructor(audioContext, config = {}) {
        this.audioContext = audioContext;
        this.shape = config.shape || new CustomLFOShape();
        this.rate = config.rate || 1; // Hz
        this.phase = config.phase || 0;
        this.depth = config.depth || 1;
        this.sync = config.sync || false; // Sync to tempo
        this.syncNote = config.syncNote || '4n'; // Quarter note
        this.isPlaying = false;
        this.startTime = 0;
        this.pausedPhase = 0;
        
        // Audio nodes for modulation output
        this.outputNode = new GainNode(audioContext, { gain: 1 });
        this.depthNode = new GainNode(audioContext, { gain: this.depth });
        this.depthNode.connect(this.outputNode);
    }
    
    /**
     * Set LFO shape
     */
    setShape(shape) {
        if (shape instanceof CustomLFOShape) {
            this.shape = shape;
        } else if (typeof shape === 'string' && LFOPresetShapes[shape]) {
            this.shape = new CustomLFOShape({
                name: LFOPresetShapes[shape].name,
                points: [...LFOPresetShapes[shape].points],
                category: LFOPresetShapes[shape].category
            });
        }
    }
    
    /**
     * Set LFO rate in Hz
     */
    setRate(rate) {
        this.rate = Math.max(0.01, Math.min(50, rate));
    }
    
    /**
     * Set modulation depth
     */
    setDepth(depth) {
        this.depth = Math.max(0, Math.min(1, depth));
        if (this.depthNode) {
            this.depthNode.gain.value = this.depth;
        }
    }
    
    /**
     * Set phase offset (0-1)
     */
    setPhase(phase) {
        this.phase = phase % 1;
    }
    
    /**
     * Start LFO
     */
    start(time = null) {
        this.isPlaying = true;
        this.startTime = time || this.audioContext.currentTime;
        this._scheduleModulation();
    }
    
    /**
     * Stop LFO
     */
    stop() {
        this.isPlaying = false;
        this.pausedPhase = this.getCurrentPhase();
    }
    
    /**
     * Get current phase position (0-1)
     */
    getCurrentPhase() {
        if (!this.isPlaying) return this.pausedPhase;
        
        const elapsed = this.audioContext.currentTime - this.startTime;
        const cycles = elapsed * this.rate;
        return (cycles + this.phase) % 1;
    }
    
    /**
     * Get current output value
     */
    getCurrentValue() {
        return this.shape.getValueAt(this.getCurrentPhase()) * this.depth;
    }
    
    /**
     * Schedule modulation updates
     * @private
     */
    _scheduleModulation() {
        if (!this.isPlaying) return;
        
        const now = this.audioContext.currentTime;
        const phase = this.getCurrentPhase();
        const value = this.shape.getValueAt(phase);
        
        // This is a simplified version - a real implementation would
        // use AudioWorklet for sample-accurate modulation
        requestAnimationFrame(() => this._scheduleModulation());
    }
    
    /**
     * Connect to a parameter
     */
    connect(param) {
        this.outputNode.connect(param);
    }
    
    /**
     * Disconnect
     */
    disconnect() {
        this.outputNode.disconnect();
    }
    
    /**
     * Dispose
     */
    dispose() {
        this.stop();
        this.outputNode.disconnect();
        this.depthNode.disconnect();
    }
}

/**
 * LFOPresetManager - Manage custom LFO presets
 */
export class LFOPresetManager {
    constructor() {
        this.presets = new Map();
        this.categories = new Map();
        
        // Load built-in presets
        this._loadBuiltinPresets();
        
        // Load saved presets from localStorage
        this._loadSavedPresets();
    }
    
    /**
     * Load built-in preset shapes
     * @private
     */
    _loadBuiltinPresets() {
        for (const [key, preset] of Object.entries(LFOPresetShapes)) {
            const shape = new CustomLFOShape({
                id: `builtin_${key}`,
                name: preset.name,
                description: preset.description,
                points: [...preset.points],
                category: preset.category
            });
            
            this.presets.set(shape.id, shape);
            
            if (!this.categories.has(preset.category)) {
                this.categories.set(preset.category, []);
            }
            this.categories.get(preset.category).push(shape.id);
        }
    }
    
    /**
     * Load saved presets from localStorage
     * @private
     */
    _loadSavedPresets() {
        try {
            const saved = localStorage.getItem('snugos_lfo_presets');
            if (saved) {
                const data = JSON.parse(saved);
                for (const presetData of data) {
                    const shape = CustomLFOShape.fromJSON(presetData);
                    this.presets.set(shape.id, shape);
                    
                    if (!this.categories.has(shape.category)) {
                        this.categories.set(shape.category, []);
                    }
                    this.categories.get(shape.category).push(shape.id);
                }
            }
        } catch (e) {
            console.warn('Failed to load LFO presets:', e);
        }
    }
    
    /**
     * Save presets to localStorage
     */
    save() {
        const customPresets = [];
        for (const [id, shape] of this.presets) {
            if (!id.startsWith('builtin_')) {
                customPresets.push(shape.toJSON());
            }
        }
        
        try {
            localStorage.setItem('snugos_lfo_presets', JSON.stringify(customPresets));
        } catch (e) {
            console.warn('Failed to save LFO presets:', e);
        }
    }
    
    /**
     * Add new preset
     */
    addPreset(shape) {
        this.presets.set(shape.id, shape);
        
        if (!this.categories.has(shape.category)) {
            this.categories.set(shape.category, []);
        }
        this.categories.get(shape.category).push(shape.id);
        
        this.save();
        return shape.id;
    }
    
    /**
     * Update existing preset
     */
    updatePreset(id, updates) {
        const shape = this.presets.get(id);
        if (shape) {
            Object.assign(shape, updates);
            shape.modifiedAt = Date.now();
            this.save();
            return true;
        }
        return false;
    }
    
    /**
     * Delete preset
     */
    deletePreset(id) {
        if (id.startsWith('builtin_')) return false;
        
        const shape = this.presets.get(id);
        if (shape) {
            this.presets.delete(id);
            
            const cat = this.categories.get(shape.category);
            if (cat) {
                const idx = cat.indexOf(id);
                if (idx !== -1) cat.splice(idx, 1);
            }
            
            this.save();
            return true;
        }
        return false;
    }
    
    /**
     * Get preset by ID
     */
    getPreset(id) {
        return this.presets.get(id);
    }
    
    /**
     * Get all presets
     */
    getAllPresets() {
        return Array.from(this.presets.values());
    }
    
    /**
     * Get presets by category
     */
    getPresetsByCategory(category) {
        const ids = this.categories.get(category);
        if (!ids) return [];
        return ids.map(id => this.presets.get(id)).filter(Boolean);
    }
    
    /**
     * Get all categories
     */
    getCategories() {
        return Array.from(this.categories.keys());
    }
    
    /**
     * Export presets to file
     */
    exportPresets(ids = null) {
        const presetsToExport = ids 
            ? ids.map(id => this.presets.get(id)).filter(Boolean)
            : this.getAllPresets().filter(p => !p.id.startsWith('builtin_'));
        
        const exportData = {
            version: 1,
            exportedAt: Date.now(),
            presets: presetsToExport.map(s => s.toJSON())
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    /**
     * Import presets from file
     */
    importPresets(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.presets || !Array.isArray(data.presets)) {
                throw new Error('Invalid preset file format');
            }
            
            const imported = [];
            for (const presetData of data.presets) {
                // Generate new ID to avoid conflicts
                presetData.id = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const shape = CustomLFOShape.fromJSON(presetData);
                this.addPreset(shape);
                imported.push(shape.id);
            }
            
            this.save();
            return { success: true, imported: imported.length };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

// Global preset manager instance
let _presetManager = null;

/**
 * Get the global preset manager
 */
export function getLFOPresetManager() {
    if (!_presetManager) {
        _presetManager = new LFOPresetManager();
    }
    return _presetManager;
}

/**
 * Open LFO Preset Editor Panel
 */
export function openLFOPresetPanel() {
    const existing = document.getElementById('lfo-preset-panel');
    if (existing) {
        existing.remove();
        return;
    }
    
    const manager = getLFOPresetManager();
    
    const panel = document.createElement('div');
    panel.id = 'lfo-preset-panel';
    panel.className = 'snug-panel';
    panel.innerHTML = `
        <style>
            #lfo-preset-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1a1a2e;
                border: 1px solid #4a4a6a;
                border-radius: 8px;
                padding: 20px;
                min-width: 600px;
                max-width: 800px;
                max-height: 80vh;
                overflow-y: auto;
                z-index: 10000;
                color: #e0e0e0;
                font-family: 'Segoe UI', sans-serif;
            }
            #lfo-preset-panel h2 {
                margin: 0 0 15px 0;
                color: #00d4ff;
                border-bottom: 1px solid #4a4a6a;
                padding-bottom: 10px;
            }
            #lfo-preset-panel .close-btn {
                position: absolute;
                top: 15px;
                right: 15px;
                background: #ff4444;
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
            }
            #lfo-preset-panel .sections {
                display: flex;
                gap: 15px;
            }
            #lfo-preset-panel .section {
                flex: 1;
            }
            #lfo-preset-panel .category {
                margin-bottom: 15px;
            }
            #lfo-preset-panel .category-title {
                font-weight: bold;
                color: #888;
                font-size: 11px;
                text-transform: uppercase;
                margin-bottom: 5px;
            }
            #lfo-preset-panel .preset-item {
                padding: 8px 12px;
                background: #2a2a3e;
                border-radius: 4px;
                margin-bottom: 4px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            #lfo-preset-panel .preset-item:hover {
                background: #3a3a4e;
            }
            #lfo-preset-panel .preset-item.selected {
                border: 1px solid #00d4ff;
            }
            #lfo-preset-panel .canvas-container {
                background: #0a0a1a;
                border-radius: 4px;
                padding: 10px;
                margin-bottom: 15px;
            }
            #lfo-preset-panel #lfo-canvas {
                width: 100%;
                height: 200px;
                cursor: crosshair;
            }
            #lfo-preset-panel .controls {
                display: flex;
                gap: 10px;
                margin-bottom: 15px;
            }
            #lfo-preset-panel button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            }
            #lfo-preset-panel .btn-primary {
                background: #00d4ff;
                color: #000;
            }
            #lfo-preset-panel .btn-secondary {
                background: #4a4a6a;
                color: #fff;
            }
            #lfo-preset-panel .btn-danger {
                background: #ff4444;
                color: #fff;
            }
            #lfo-preset-panel input[type="text"] {
                background: #2a2a3e;
                border: 1px solid #4a4a6a;
                border-radius: 4px;
                padding: 8px;
                color: #e0e0e0;
                width: 100%;
                margin-bottom: 10px;
            }
            #lfo-preset-panel .preview-canvas {
                width: 60px;
                height: 30px;
                background: #0a0a1a;
                border-radius: 2px;
            }
        </style>
        
        <button class="close-btn" onclick="this.parentElement.remove()">×</button>
        <h2>LFO Presets</h2>
        
        <div class="sections">
            <div class="section" style="flex: 1;">
                <h3>Presets Library</h3>
                <div id="preset-list"></div>
            </div>
            
            <div class="section" style="flex: 1.5;">
                <h3>Shape Editor</h3>
                <div class="canvas-container">
                    <canvas id="lfo-canvas"></canvas>
                </div>
                
                <input type="text" id="lfo-name" placeholder="Preset name...">
                <input type="text" id="lfo-description" placeholder="Description...">
                
                <div class="controls">
                    <button class="btn-secondary" onclick="window.lfoPanelSmooth()">Smooth</button>
                    <button class="btn-secondary" onclick="window.lfoPanelInvert()">Invert</button>
                    <button class="btn-secondary" onclick="window.lfoPanelClear()">Clear</button>
                    <button class="btn-primary" onclick="window.lfoPanelSave()">Save Preset</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Initialize canvas
    const canvas = document.getElementById('lfo-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    let currentShape = new CustomLFOShape({ name: 'New Shape' });
    let isDrawing = false;
    
    // Draw function
    function drawShape() {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Grid
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * canvas.height / 4);
            ctx.lineTo(canvas.width, i * canvas.height / 4);
            ctx.stroke();
        }
        
        // Shape curve
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < currentShape.points.length; i++) {
            const x = (i / currentShape.points.length) * canvas.width;
            const y = canvas.height - (currentShape.points[i] * canvas.height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
    }
    
    // Mouse drawing
    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        handleDraw(e);
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDrawing) handleDraw(e);
    });
    
    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
        isDrawing = false;
    });
    
    function handleDraw(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const index = Math.floor((x / canvas.width) * currentShape.points.length);
        const value = 1 - (y / canvas.height);
        
        if (index >= 0 && index < currentShape.points.length) {
            // Also affect neighboring points for smoother drawing
            const brushSize = 3;
            for (let i = -brushSize; i <= brushSize; i++) {
                const idx = index + i;
                if (idx >= 0 && idx < currentShape.points.length) {
                    const dist = Math.abs(i);
                    const weight = 1 - (dist / (brushSize + 1));
                    const blend = 0.5;
                    currentShape.points[idx] = currentShape.points[idx] * (1 - blend * weight) + value * blend * weight;
                }
            }
            drawShape();
        }
    }
    
    // Populate preset list
    function populatePresetList() {
        const container = document.getElementById('preset-list');
        const categories = manager.getCategories();
        
        container.innerHTML = '';
        
        for (const category of categories) {
            const presets = manager.getPresetsByCategory(category);
            if (presets.length === 0) continue;
            
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category';
            categoryDiv.innerHTML = `<div class="category-title">${category}</div>`;
            
            for (const preset of presets) {
                const item = document.createElement('div');
                item.className = 'preset-item';
                item.innerHTML = `
                    <span>${preset.name}</span>
                    <canvas class="preview-canvas" data-id="${preset.id}"></canvas>
                `;
                
                item.addEventListener('click', () => {
                    currentShape = new CustomLFOShape({
                        name: preset.name,
                        description: preset.description,
                        points: [...preset.points],
                        category: preset.category
                    });
                    document.getElementById('lfo-name').value = preset.name;
                    document.getElementById('lfo-description').value = preset.description || '';
                    drawShape();
                    
                    // Highlight selected
                    container.querySelectorAll('.preset-item').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                });
                
                categoryDiv.appendChild(item);
            }
            
            container.appendChild(categoryDiv);
        }
        
        // Draw preview canvases
        setTimeout(() => {
            container.querySelectorAll('.preview-canvas').forEach(canvas => {
                const id = canvas.dataset.id;
                const preset = manager.getPreset(id);
                if (preset) {
                    const pctx = canvas.getContext('2d');
                    canvas.width = canvas.offsetWidth;
                    canvas.height = canvas.offsetHeight;
                    
                    pctx.strokeStyle = '#00d4ff';
                    pctx.lineWidth = 1;
                    pctx.beginPath();
                    
                    for (let i = 0; i < preset.points.length; i++) {
                        const x = (i / preset.points.length) * canvas.width;
                        const y = canvas.height - (preset.points[i] * canvas.height);
                        
                        if (i === 0) pctx.moveTo(x, y);
                        else pctx.lineTo(x, y);
                    }
                    
                    pctx.stroke();
                }
            });
        }, 100);
    }
    
    // Global functions for buttons
    window.lfoPanelSmooth = () => {
        currentShape.smooth(2);
        drawShape();
    };
    
    window.lfoPanelInvert = () => {
        currentShape.invert();
        drawShape();
    };
    
    window.lfoPanelClear = () => {
        currentShape.points = new Array(256).fill(0.5);
        drawShape();
    };
    
    window.lfoPanelSave = () => {
        const name = document.getElementById('lfo-name').value.trim();
        if (!name) {
            alert('Please enter a name for the preset');
            return;
        }
        
        currentShape.name = name;
        currentShape.description = document.getElementById('lfo-description').value.trim();
        
        manager.addPreset(currentShape);
        populatePresetList();
        
        // Reset for new shape
        currentShape = new CustomLFOShape({ name: 'New Shape' });
        document.getElementById('lfo-name').value = '';
        document.getElementById('lfo-description').value = '';
        drawShape();
    };
    
    // Initial draw
    drawShape();
    populatePresetList();
}

// Make available globally
if (typeof window !== 'undefined') {
    window.CustomLFOShape = CustomLFOShape;
    window.LFOEngine = LFOEngine;
    window.LFOPresetManager = LFOPresetManager;
    window.getLFOPresetManager = getLFOPresetManager;
    window.openLFOPresetPanel = openLFOPresetPanel;
    window.LFOPresetShapes = LFOPresetShapes;
}