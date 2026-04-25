// js/PresetMorphing.js
// Preset Morphing - Morph between two effect presets over a specified time duration

export class PresetMorphing {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.effect = options.effect || null;
        
        // Morph parameters
        this.enabled = false;
        this.isMorphing = false;
        this.morphDuration = options.morphDuration || 2.0; // Seconds
        this.morphProgress = 0; // 0-1
        this.morphStartTime = 0;
        
        // Source and target presets
        this.sourcePreset = null;
        this.targetPreset = null;
        
        // Interpolated result
        this.interpolatedParams = {};
        
        // Animation
        this._animationFrame = null;
        this._onMorphProgress = options.onMorphProgress || null;
        this._onMorphComplete = options.onMorphComplete || null;
    }

    setAudioContext(ctx) {
        this.audioContext = ctx;
    }

    setEffect(effect) {
        this.effect = effect;
        if (effect && this.sourcePreset) {
            this.interpolatedParams = { ...this.sourcePreset };
        }
    }

    /**
     * Start morphing from current state to target preset
     * @param {object} targetPreset - The target preset to morph to
     * @param {number} duration - Duration in seconds (optional)
     */
    startMorph(targetPreset, duration = null) {
        if (!this.effect) {
            console.warn('[PresetMorphing] No effect set');
            return false;
        }
        
        // Capture current state as source
        this.sourcePreset = this._captureCurrentPreset();
        this.targetPreset = { ...targetPreset };
        
        if (duration !== null) {
            this.morphDuration = Math.max(0.1, Math.min(30, duration));
        }
        
        this.morphProgress = 0;
        this.morphStartTime = this.audioContext?.currentTime || performance.now() / 1000;
        this.isMorphing = true;
        this.enabled = true;
        
        // Start animation loop
        this._animateMorph();
        
        console.log(`[PresetMorphing] Started morph to preset over ${this.morphDuration}s`);
        return true;
    }

    /**
     * Capture current effect parameters as a preset
     * @private
     */
    _captureCurrentPreset() {
        if (!this.effect || !this.effect.params) return {};
        
        const preset = {};
        for (const [key, value] of Object.entries(this.effect.params)) {
            if (typeof value === 'number') {
                preset[key] = value;
            } else if (value && typeof value === 'object') {
                // Deep copy nested objects
                preset[key] = JSON.parse(JSON.stringify(value));
            } else {
                preset[key] = value;
            }
        }
        return preset;
    }

    /**
     * Interpolate between two values
     * @private
     */
    _interpolate(start, end, t) {
        // Handle different types
        if (typeof start === 'number' && typeof end === 'number') {
            return start + (end - start) * t;
        }
        if (Array.isArray(start) && Array.isArray(end)) {
            return start.map((v, i) => this._interpolate(v, end[i] || v, t));
        }
        if (typeof start === 'object' && typeof end === 'object') {
            const result = {};
            for (const key of Object.keys(start)) {
                result[key] = this._interpolate(start[key], end[key] || start[key], t);
            }
            return result;
        }
        // For non-numeric types, return end value when progress > 0.5
        return t > 0.5 ? end : start;
    }

    /**
     * Animation loop for morph
     * @private
     */
    _animateMorph() {
        if (!this.isMorphing) return;
        
        const currentTime = this.audioContext?.currentTime || performance.now() / 1000;
        const elapsed = currentTime - this.morphStartTime;
        this.morphProgress = Math.min(1, elapsed / this.morphDuration);
        
        // Apply easing (ease-in-out)
        const easedProgress = this._easeInOut(this.morphProgress);
        
        // Interpolate parameters
        this.interpolatedParams = {};
        for (const key of Object.keys(this.sourcePreset)) {
            this.interpolatedParams[key] = this._interpolate(
                this.sourcePreset[key],
                this.targetPreset[key],
                easedProgress
            );
        }
        
        // Apply to effect
        if (this.effect && this.effect.params) {
            Object.assign(this.effect.params, this.interpolatedParams);
        }
        
        // Notify progress
        if (this._onMorphProgress) {
            this._onMorphProgress(easedProgress, this.interpolatedParams);
        }
        
        // Check completion
        if (this.morphProgress >= 1) {
            this._completeMorph();
        } else {
            this._animationFrame = requestAnimationFrame(() => this._animateMorph());
        }
    }

    /**
     * Ease-in-out function
     * @private
     */
    _easeInOut(t) {
        return t < 0.5 
            ? 2 * t * t 
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    /**
     * Complete the morph
     * @private
     */
    _completeMorph() {
        this.isMorphing = false;
        this.enabled = false;
        this.morphProgress = 1;
        
        // Apply final target preset exactly
        if (this.effect && this.effect.params && this.targetPreset) {
            Object.assign(this.effect.params, this.targetPreset);
        }
        
        console.log('[PresetMorphing] Morph complete');
        
        if (this._onMorphComplete) {
            this._onMorphComplete();
        }
    }

    /**
     * Cancel the current morph
     */
    cancelMorph() {
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
        }
        this.isMorphing = false;
        this.enabled = false;
        this.morphProgress = 0;
        
        // Revert to source preset
        if (this.effect && this.effect.params && this.sourcePreset) {
            Object.assign(this.effect.params, this.sourcePreset);
        }
        
        console.log('[PresetMorphing] Morph cancelled');
    }

    /**
     * Get current morph state
     */
    getState() {
        return {
            enabled: this.enabled,
            isMorphing: this.isMorphing,
            morphProgress: this.morphProgress,
            morphDuration: this.morphDuration,
            sourcePreset: this.sourcePreset,
            targetPreset: this.targetPreset,
            interpolatedParams: { ...this.interpolatedParams }
        };
    }

    /**
     * Set morph duration
     */
    setDuration(seconds) {
        this.morphDuration = Math.max(0.1, Math.min(30, seconds));
    }

    dispose() {
        this.cancelMorph();
        this.sourcePreset = null;
        this.targetPreset = null;
        this.interpolatedParams = {};
    }
}

// --- Preset Morphing Panel ---

let localAppServices = {};
let presetMorphInstances = new Map(); // effectId -> PresetMorphing instance

export function initPresetMorphing(services) {
    localAppServices = services;
    console.log('[PresetMorphing] Initialized');
}

export function getPresetMorphInstance(effectId) {
    return presetMorphInstances.get(effectId) || null;
}

export function createPresetMorphInstance(effectId, effect, options = {}) {
    if (presetMorphInstances.has(effectId)) {
        return presetMorphInstances.get(effectId);
    }
    
    const instance = new PresetMorphing({
        effect,
        ...options,
        onMorphProgress: (progress, params) => {
            // Update UI if needed
            const progressEl = document.getElementById(`pm-progress-${effectId}`);
            if (progressEl) {
                progressEl.textContent = `${Math.round(progress * 100)}%`;
                const bar = document.getElementById(`pm-progress-bar-${effectId}`);
                if (bar) {
                    bar.style.width = `${progress * 100}%`;
                }
            }
        },
        onMorphComplete: () => {
            const statusEl = document.getElementById(`pm-status-${effectId}`);
            if (statusEl) statusEl.textContent = 'Complete';
            localAppServices.showNotification?.('Morph complete!', 1500);
        }
    });
    
    presetMorphInstances.set(effectId, instance);
    return instance;
}

export function openPresetMorphingPanel(savedState = null) {
    const windowId = 'presetMorphing';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'presetMorphingContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { 
        width: 400, 
        height: 450, 
        minWidth: 350, 
        minHeight: 380, 
        initialContentKey: windowId, 
        closable: true, 
        minimizable: true, 
        resizable: true 
    };
    
    if (savedState) {
        Object.assign(options, { 
            x: parseInt(savedState.left, 10), 
            y: parseInt(savedState.top, 10), 
            width: parseInt(savedState.width, 10), 
            height: parseInt(savedState.height, 10), 
            zIndex: savedState.zIndex, 
            isMinimized: savedState.isMinimized 
        });
    }
    
    const win = localAppServices.createWindow(windowId, 'Preset Morphing', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderPresetMorphingContent(), 50);
    }
    return win;
}

function renderPresetMorphingContent() {
    const container = document.getElementById('presetMorphingContent');
    if (!container) return;

    let html = `
        <div class="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Morph between two effect presets over time. Select an effect, choose source and target presets, then start the morph.
        </div>
        
        <div class="mb-4">
            <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">Select Effect:</label>
            <select id="pm-effect-select" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                <option value="">Select an effect...</option>
            </select>
        </div>
        
        <div id="pm-morph-controls" class="space-y-4" style="display: none;">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">Source Preset:</label>
                    <select id="pm-source-preset" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                        <option value="current">Current Settings</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">Target Preset:</label>
                    <select id="pm-target-preset" class="w-full p-2 text-sm bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded text-gray-800 dark:text-gray-200">
                        <option value="">Select target...</option>
                    </select>
                </div>
            </div>
            
            <div>
                <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                    Morph Duration: <span id="pm-duration-val">2.0s</span>
                </label>
                <input type="range" id="pm-duration" min="0.5" max="10" step="0.5" value="2" 
                    class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
            </div>
            
            <div id="pm-progress-container" class="hidden">
                <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                    Progress: <span id="pm-progress">0%</span>
                </label>
                <div class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div id="pm-progress-bar" class="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all" style="width: 0%"></div>
                </div>
            </div>
            
            <div class="flex items-center justify-between">
                <span id="pm-status" class="text-sm text-gray-500 dark:text-gray-400">Ready</span>
                <div class="flex gap-2">
                    <button id="pm-start-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors">
                        Start Morph
                    </button>
                    <button id="pm-cancel-btn" class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded transition-colors hidden">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
        
        <div class="mt-4 p-3 bg-gray-100 dark:bg-slate-700 rounded text-xs text-gray-600 dark:text-gray-400">
            <b>How to use:</b><br>
            1. Select an effect from the dropdown<br>
            2. Choose source and target presets<br>
            3. Set the morph duration<br>
            4. Click "Start Morph" to begin
        </div>
    `;

    container.innerHTML = html;

    // Get elements
    const effectSelect = document.getElementById('pm-effect-select');
    const controlsDiv = document.getElementById('pm-morph-controls');
    const sourceSelect = document.getElementById('pm-source-preset');
    const targetSelect = document.getElementById('pm-target-preset');
    const durationSlider = document.getElementById('pm-duration');
    const durationVal = document.getElementById('pm-duration-val');
    const progressContainer = document.getElementById('pm-progress-container');
    const progressEl = document.getElementById('pm-progress');
    const progressBar = document.getElementById('pm-progress-bar');
    const statusEl = document.getElementById('pm-status');
    const startBtn = document.getElementById('pm-start-btn');
    const cancelBtn = document.getElementById('pm-cancel-btn');

    // Populate effects
    function populateEffects() {
        if (!localAppServices.getMasterEffects) return;
        
        const masterEffects = localAppServices.getMasterEffects();
        effectSelect.innerHTML = '<option value="">Select an effect...</option>';
        
        masterEffects.forEach(effect => {
            const opt = document.createElement('option');
            opt.value = effect.id;
            opt.textContent = `${effect.type} (${effect.id.slice(0, 12)}...)`;
            effectSelect.appendChild(opt);
        });
    }

    // Populate presets for selected effect
    function populatePresets(effectId) {
        if (!effectId) {
            controlsDiv.style.display = 'none';
            return;
        }
        
        controlsDiv.style.display = 'block';
        
        // Get presets for this effect
        const presets = localAppServices.getEffectPresets?.(effectId) || [];
        
        targetSelect.innerHTML = '<option value="">Select target...</option>';
        presets.forEach(preset => {
            const opt = document.createElement('option');
            opt.value = preset.name;
            opt.textContent = preset.name;
            targetSelect.appendChild(opt);
        });
    }

    // Update duration display
    durationSlider?.addEventListener('input', () => {
        durationVal.textContent = `${parseFloat(durationSlider.value).toFixed(1)}s`;
    });

    // Effect selection
    effectSelect?.addEventListener('change', (e) => {
        populatePresets(e.target.value);
    });

    // Start morph button
    startBtn?.addEventListener('click', () => {
        const effectId = effectSelect.value;
        const targetPresetName = targetSelect.value;
        
        if (!effectId || !targetPresetName) {
            localAppServices.showNotification?.('Please select effect and target preset', 2000);
            return;
        }
        
        // Get effect and preset
        const effect = localAppServices.getMasterEffects?.().find(e => e.id === effectId);
        const targetPreset = localAppServices.getEffectPreset?.(effectId, targetPresetName);
        
        if (!effect || !targetPreset) {
            localAppServices.showNotification?.('Could not find effect or preset', 2000);
            return;
        }
        
        // Create or get morph instance
        let morphInstance = presetMorphInstances.get(effectId);
        if (!morphInstance) {
            morphInstance = createPresetMorphInstance(effectId, effect);
        } else {
            morphInstance.setEffect(effect);
        }
        
        // Start morph
        const duration = parseFloat(durationSlider.value);
        morphInstance.setDuration(duration);
        morphInstance.startMorph(targetPreset.params || targetPreset);
        
        // Show progress UI
        progressContainer.classList.remove('hidden');
        startBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        statusEl.textContent = 'Morphing...';
    });

    // Cancel morph button
    cancelBtn?.addEventListener('click', () => {
        const effectId = effectSelect.value;
        const morphInstance = presetMorphInstances.get(effectId);
        
        if (morphInstance) {
            morphInstance.cancelMorph();
        }
        
        progressContainer.classList.add('hidden');
        startBtn.classList.remove('hidden');
        cancelBtn.classList.add('hidden');
        statusEl.textContent = 'Cancelled';
    });

    // Initialize
    populateEffects();
    
    console.log('[PresetMorphing] Panel rendered');
}

// Export for use
export function getPresetMorphState(effectId) {
    const instance = presetMorphInstances.get(effectId);
    return instance?.getState() || null;
}

export function startPresetMorph(effectId, targetPreset, duration) {
    const instance = presetMorphInstances.get(effectId);
    if (instance) {
        instance.setDuration(duration);
        return instance.startMorph(targetPreset);
    }
    return false;
}

export function cancelPresetMorph(effectId) {
    const instance = presetMorphInstances.get(effectId);
    if (instance) {
        instance.cancelMorph();
    }
}