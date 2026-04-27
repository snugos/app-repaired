/**
 * CPU Performance Mode - Reduces visual effects for better performance on low-end devices
 * When enabled, disables or simplifies: animations, shadows, reflections, meters animation
 */

class CpuPerformanceMode {
    constructor() {
        this.enabled = false;
        this.levels = {
            off: {
                animations: true,
                shadows: true,
                reflections: true,
                metersAnimation: true,
                waveformSmoothing: true,
                gridLines: true,
                trackGlow: true,
                hoverEffects: true,
                autoScroll: true
            },
            low: {
                animations: true,
                shadows: false,
                reflections: false,
                metersAnimation: true,
                waveformSmoothing: true,
                gridLines: true,
                trackGlow: true,
                hoverEffects: true,
                autoScroll: true
            },
            medium: {
                animations: true,
                shadows: false,
                reflections: false,
                metersAnimation: true,
                waveformSmoothing: false,
                gridLines: true,
                trackGlow: false,
                hoverEffects: true,
                autoScroll: true
            },
            high: {
                animations: false,
                shadows: false,
                reflections: false,
                metersAnimation: false,
                waveformSmoothing: false,
                gridLines: false,
                trackGlow: false,
                hoverEffects: false,
                autoScroll: false
            }
        };
        this.currentLevel = 'off';
        
        // Auto-detect based on device capabilities
        this.autoDetectEnabled = false;
        this.autoDetectThreshold = 30; // FPS threshold for auto-enabling
        
        // Store original styles for restoration
        this.originalStyles = new Map();
        
        // FPS monitoring
        this.fpsHistory = [];
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fpsCheckInterval = null;
        
        this.init();
    }
    
    init() {
        // Load saved preference
        const savedLevel = localStorage.getItem('snugosCpuPerformanceLevel');
        if (savedLevel && this.levels[savedLevel]) {
            this.currentLevel = savedLevel;
            this.enabled = savedLevel !== 'off';
            if (this.enabled) {
                this.applyLevel(this.currentLevel);
            }
        }
        
        // Check auto-detect preference
        const autoDetect = localStorage.getItem('snugosCpuAutoDetect');
        this.autoDetectEnabled = autoDetect === 'true';
        
        // Start FPS monitoring if auto-detect is enabled
        if (this.autoDetectEnabled) {
            this.startFpsMonitoring();
        }
        
        console.log('[CpuPerformanceMode] Initialized, level:', this.currentLevel, ', autoDetect:', this.autoDetectEnabled);
    }
    
    /**
     * Set performance mode level
     * @param {string} level - 'off', 'low', 'medium', 'high'
     */
    setLevel(level) {
        if (!this.levels[level]) {
            console.warn('[CpuPerformanceMode] Invalid level:', level);
            return;
        }
        
        this.currentLevel = level;
        this.enabled = level !== 'off';
        localStorage.setItem('snugosCpuPerformanceLevel', level);
        
        if (this.enabled) {
            this.applyLevel(level);
        } else {
            this.restoreAll();
        }
        
        // Update UI indicators
        this.updateUI();
        
        console.log('[CpuPerformanceMode] Level set to:', level);
        
        if (this.enabled) {
            if (typeof showNotification === 'function') {
                showNotification(`Performance mode: ${level}`, 1500);
            }
        }
    }
    
    /**
     * Get current level
     */
    getLevel() {
        return this.currentLevel;
    }
    
    /**
     * Check if performance mode is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    
    /**
     * Toggle performance mode
     */
    toggle() {
        if (this.enabled) {
            this.setLevel('off');
        } else {
            // Default to 'medium' when toggling on
            this.setLevel('medium');
        }
    }
    
    /**
     * Apply a specific level's settings
     */
    applyLevel(level) {
        const settings = this.levels[level];
        if (!settings) return;
        
        // Disable animations globally
        if (!settings.animations) {
            this.applyCSS('body', 'transition', 'none !important');
            this.applyCSS('.track', 'transition', 'none !important');
            this.applyCSS('.clip', 'transition', 'none !important');
            this.applyCSS('.window', 'transition', 'none !important');
            this.applyCSS('*', 'animation', 'none !important');
        }
        
        // Disable shadows
        if (!settings.shadows) {
            this.applyCSS('.window', 'box-shadow', 'none !important');
            this.applyCSS('.panel', 'box-shadow', 'none !important');
            this.applyCSS('.track', 'box-shadow', 'none !important');
            this.applyCSS('.clip', 'box-shadow', 'none !important');
        }
        
        // Disable reflections
        if (!settings.reflections) {
            this.applyCSS('*', 'reflection', 'none !important');
            document.querySelectorAll('[class*="reflection"]').forEach(el => {
                el.style.display = 'none';
            });
        }
        
        // Reduce meter animation frequency
        if (!settings.metersAnimation) {
            // This will be handled by the meter update loop
            window.snugosReduceMeterUpdates = true;
        } else {
            window.snugosReduceMeterUpdates = false;
        }
        
        // Disable waveform smoothing
        if (!settings.waveformSmoothing) {
            window.snugosReduceWaveformSmoothing = true;
        } else {
            window.snugosReduceWaveformSmoothing = false;
        }
        
        // Hide grid lines
        if (!settings.gridLines) {
            this.applyCSS('.timeline-grid', 'display', 'none !important');
            this.applyCSS('.sequencer-grid', 'display', 'none !important');
        }
        
        // Disable track glow
        if (!settings.trackGlow) {
            this.applyCSS('.track-armed', 'box-shadow', 'none !important');
            this.applyCSS('.track-selected', 'box-shadow', 'none !important');
            this.applyCSS('[class*="glow"]', 'filter', 'none !important');
        }
        
        // Disable hover effects
        if (!settings.hoverEffects) {
            this.applyCSS('.track', 'pointer-events', 'none !important');
            this.applyCSS('.clip', 'pointer-events', 'none !important');
        }
        
        // Disable auto-scroll
        if (!settings.autoScroll) {
            window.snugosDisableAutoScroll = true;
        } else {
            window.snugosDisableAutoScroll = false;
        }
        
        // Add body class for CSS-based rules
        document.body.classList.add(`perf-mode-${level}`);
    }
    
    /**
     * Apply CSS rule temporarily
     */
    applyCSS(selector, property, value) {
        try {
            const styleId = `perf-mode-${selector.replace(/[^a-z0-9]/gi, '-')}`;
            let styleEl = document.getElementById(styleId);
            
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }
            
            // Store original if not already stored
            if (!this.originalStyles.has(styleId)) {
                this.originalStyles.set(styleId, styleEl.textContent);
            }
            
            // Append rule
            const existingRules = styleEl.textContent;
            const newRule = `${selector} { ${property}: ${value}; }`;
            
            if (!existingRules.includes(selector)) {
                styleEl.textContent = existingRules + newRule;
            }
        } catch (e) {
            console.warn('[CpuPerformanceMode] CSS apply failed:', e);
        }
    }
    
    /**
     * Restore all original styles
     */
    restoreAll() {
        // Remove body class
        document.body.classList.remove('perf-mode-off', 'perf-mode-low', 'perf-mode-medium', 'perf-mode-high');
        
        // Restore stored original styles
        this.originalStyles.forEach((css, styleId) => {
            const styleEl = document.getElementById(styleId);
            if (styleEl) {
                styleEl.textContent = css;
            }
        });
        
        // Reset flags
        window.snugosReduceMeterUpdates = false;
        window.snugosReduceWaveformSmoothing = false;
        window.snugosDisableAutoScroll = false;
        
        console.log('[CpuPerformanceMode] All styles restored');
    }
    
    /**
     * Update UI elements to reflect current state
     */
    updateUI() {
        // Update status bar indicator
        const indicator = document.getElementById('cpuPerfModeIndicator');
        if (indicator) {
            if (this.enabled) {
                indicator.textContent = `Perf: ${this.currentLevel}`;
                indicator.classList.add('active');
            } else {
                indicator.textContent = 'Perf: Off';
                indicator.classList.remove('active');
            }
        }
        
        // Update menu button state
        const menuBtn = document.getElementById('cpuPerfModeBtn');
        if (menuBtn) {
            menuBtn.textContent = this.enabled ? `Perf: ${this.currentLevel}` : 'Perf Mode';
            if (this.enabled) {
                menuBtn.classList.add('active');
            } else {
                menuBtn.classList.remove('active');
            }
        }
    }
    
    /**
     * Start FPS monitoring for auto-detect
     */
    startFpsMonitoring() {
        if (this.fpsCheckInterval) return;
        
        this.fpsCheckInterval = setInterval(() => {
            this.calculateFps();
            
            // Auto-enable if FPS drops below threshold
            if (this.autoDetectEnabled && !this.enabled && this.fpsHistory.length > 0) {
                const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
                if (avgFps < this.autoDetectThreshold) {
                    console.log('[CpuPerformanceMode] Low FPS detected, auto-enabling medium mode');
                    this.setLevel('medium');
                }
            }
            
            // Reset history periodically
            if (this.fpsHistory.length > 60) {
                this.fpsHistory = this.fpsHistory.slice(-30);
            }
        }, 1000);
    }
    
    /**
     * Stop FPS monitoring
     */
    stopFpsMonitoring() {
        if (this.fpsCheckInterval) {
            clearInterval(this.fpsCheckInterval);
            this.fpsCheckInterval = null;
        }
    }
    
    /**
     * Calculate current FPS
     */
    calculateFps() {
        const now = performance.now();
        const delta = now - this.lastFrameTime;
        
        this.frameCount++;
        
        if (delta >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / delta);
            this.fpsHistory.push(fps);
            this.frameCount = 0;
            this.lastFrameTime = now;
            
            // Update indicator
            const fpsEl = document.getElementById('statusFpsValue');
            if (fpsEl) {
                fpsEl.textContent = fps;
                if (fps < 30) {
                    fpsEl.classList.add('text-red-500');
                    fpsEl.classList.remove('text-yellow-500', 'text-green-500');
                } else if (fps < 50) {
                    fpsEl.classList.add('text-yellow-500');
                    fpsEl.classList.remove('text-red-500', 'text-green-500');
                } else {
                    fpsEl.classList.add('text-green-500');
                    fpsEl.classList.remove('text-red-500', 'text-yellow-500');
                }
            }
        }
    }
    
    /**
     * Enable/disable auto-detect
     */
    setAutoDetect(enabled) {
        this.autoDetectEnabled = enabled;
        localStorage.setItem('snugosCpuAutoDetect', enabled ? 'true' : 'false');
        
        if (enabled) {
            this.startFpsMonitoring();
        } else {
            this.stopFpsMonitoring();
        }
        
        console.log('[CpuPerformanceMode] Auto-detect:', enabled);
    }
    
    /**
     * Get performance stats
     */
    getStats() {
        return {
            enabled: this.enabled,
            level: this.currentLevel,
            autoDetect: this.autoDetectEnabled,
            avgFps: this.fpsHistory.length > 0 
                ? Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length)
                : null,
            fpsHistory: [...this.fpsHistory]
        };
    }
}

// Export singleton instance
export const cpuPerformanceMode = new CpuPerformanceMode();

// Also expose globally for non-module access
if (typeof window !== 'undefined') {
    window.cpuPerformanceMode = cpuPerformanceMode;
}

/**
 * Open the CPU Performance Mode panel
 */
export function openCpuPerformanceModePanel() {
    const windowId = 'cpuPerformanceMode';
    const openWindows = localAppServices?.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        updateCpuPerformanceModePanel();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'cpuPerfModeContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = {
        width: 400,
        height: 350,
        minWidth: 300,
        minHeight: 280,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices?.createWindow ? localAppServices.createWindow(windowId, 'CPU Performance Mode', contentContainer, options) : null;
    if (win?.element) {
        renderCpuPerformanceModeContent();
    }
    
    return win;
}

export function updateCpuPerformanceModePanel() {
    const container = document.getElementById('cpuPerfModeContent');
    if (container) renderCpuPerformanceModeContent();
}

function renderCpuPerformanceModeContent() {
    const container = document.getElementById('cpuPerfModeContent');
    if (!container) return;
    
    const mode = window.cpuPerformanceMode;
    const stats = mode.getStats();
    const levels = ['off', 'low', 'medium', 'high'];
    const levelDescriptions = {
        off: 'All visual effects enabled',
        low: 'Shadows and reflections disabled',
        medium: 'Waveform smoothing and track glow disabled',
        high: 'Minimal UI, no animations or effects'
    };
    
    let html = `
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Current Status</span>
                <span id="perfModeStatus" class="px-2 py-1 text-xs rounded ${
                    stats.enabled 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }">
                    ${stats.enabled ? `Enabled: ${stats.level}` : 'Disabled'}
                </span>
            </div>
            ${stats.avgFps !== null ? `
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Average FPS:</span>
                    <span id="perfModeFps" class="text-sm font-bold ${
                        stats.avgFps < 30 ? 'text-red-500' : 
                        stats.avgFps < 50 ? 'text-yellow-500' : 'text-green-500'
                    }">${stats.avgFps}</span>
                </div>
            ` : ''}
        </div>
        
        <div class="mb-4">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Performance Level</h3>
            <div class="space-y-2">
    `;
    
    levels.forEach(level => {
        const isActive = stats.level === level;
        html += `
            <button class="perf-level-btn w-full p-3 text-left rounded border transition-colors ${
                isActive 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                    : 'border-gray-200 dark:border-slate-600 hover:border-blue-300'
            }" data-level="${level}">
                <div class="flex items-center justify-between">
                    <span class="font-medium ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}">
                        ${level.charAt(0).toUpperCase() + level.slice(1)}
                    </span>
                    ${isActive ? '<span class="text-blue-500 text-xs">✓ Active</span>' : ''}
                </div>
                <p class="text-xs text-gray-500 mt-1">${levelDescriptions[level]}</p>
            </button>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="flex items-center justify-between">
                <div>
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Detect</span>
                    <p class="text-xs text-gray-500">Automatically enable when FPS drops below 30</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="perfAutoDetect" class="sr-only peer" ${stats.autoDetect ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
        </div>
        
        <div class="text-xs text-gray-400 text-center">
            Performance mode reduces visual effects to improve FPS on low-end devices.
        </div>
    `;
    
    container.innerHTML = html;
    
    // Add event listeners
    container.querySelectorAll('.perf-level-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            cpuPerformanceMode.setLevel(level);
            renderCpuPerformanceModeContent();
        });
    });
    
    container.querySelector('#perfAutoDetect')?.addEventListener('change', (e) => {
        cpuPerformanceMode.setAutoDetect(e.target.checked);
    });
}

// Shortcut function
export function toggleCpuPerformanceMode() {
    if (window.cpuPerformanceMode) {
        window.cpuPerformanceMode.toggle();
    }
}