// js/RhythmRandomizer.js - Rhythm Randomizer Panel for SnugOS DAW
// Apply probability-based randomization to drum patterns for humanization and variation

let localAppServices = {};
let rhythmRandomizerState = {
    enabled: false,
    stepProbability: 0.5,      // 0-1 chance each step stays active
    density: 0.7,              // 0-1 overall density multiplier
    timingVariation: 0.15,      // 0-1 timing swing amount
    velocityVariation: 0.2,    // 0-1 velocity randomization
    accentProbability: 0.3,    // 0-1 chance of accenting beats
    humanize: true,             // Apply humanization
    preserveDownbeats: true,  // Keep beat 1 and 3 strong
    shuffleMode: false,        // Shuffle note order instead of random remove
    swingAmount: 0.25          // 0-1 swing amount for off-beats
};

/**
 * Initialize the Rhythm Randomizer module
 */
export function initRhythmRandomizer(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    console.log('[RhythmRandomizer] Module initialized');
}

/**
 * Get current settings
 */
export function getRhythmRandomizerSettings() {
    return { ...rhythmRandomizerState };
}

/**
 * Set a specific setting
 */
export function setRhythmRandomizerSetting(key, value) {
    if (key in rhythmRandomizerState) {
        rhythmRandomizerState[key] = value;
        console.log(`[RhythmRandomizer] Setting ${key} = ${value}`);
    }
}

/**
 * Apply rhythm randomization to a track's active sequence
 */
export function applyRhythmRandomization(trackId) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.sequences || track.sequences.length === 0) {
        console.warn('[RhythmRandomizer] No track or sequence found');
        return false;
    }

    const activeSeq = track.sequences.find(s => s.id === track.activeSequenceId) || track.sequences[0];
    if (!activeSeq.data || !activeSeq.data.length) {
        console.warn('[RhythmRandomizer] No sequence data found');
        return false;
    }

    const originalData = activeSeq.data;
    const numRows = originalData.length;
    const numSteps = originalData[0]?.length || 16;
    const stepsPerBeat = 4;

    // Deep copy the original data
    const newData = originalData.map(row => row.map(step => {
        if (!step || !step.active) return { ...step };
        
        const newStep = { ...step };
        
        // Apply density - chance to remove note entirely
        if (Math.random() > rhythmRandomizerState.density) {
            newStep.active = false;
            return newStep;
        }
        
        // Apply step probability
        if (Math.random() > rhythmRandomizerState.stepProbability) {
            newStep.active = false;
            return newStep;
        }
        
        // Preserve downbeats if enabled
        const stepInBeat = newStep.step !== undefined ? newStep.step % stepsPerBeat : 0;
        const isDownbeat = stepInBeat === 0 || stepInBeat === 2;
        if (rhythmRandomizerState.preserveDownbeats && isDownbeat) {
            // Keep but can still vary velocity
        } else {
            // Apply velocity variation
            if (rhythmRandomizerState.velocityVariation > 0) {
                const variation = (Math.random() - 0.5) * 2 * rhythmRandomizerState.velocityVariation;
                newStep.velocity = Math.max(0.1, Math.min(1, (newStep.velocity || 0.8) + variation));
            }
        }
        
        // Apply timing variation (stored as timing offset in seconds)
        if (rhythmRandomizerState.humanize && rhythmRandomizerState.timingVariation > 0) {
            const variationMs = (Math.random() - 0.5) * rhythmRandomizerState.timingVariation * 50; // +/- ms
            newStep.timingOffset = (newStep.timingOffset || 0) + variationMs / 1000; // Convert to seconds
        }
        
        // Accent probability
        if (!isDownbeat && Math.random() < rhythmRandomizerState.accentProbability) {
            newStep.accent = true;
            newStep.velocity = Math.min(1, (newStep.velocity || 0.8) * 1.2);
        }
        
        return newStep;
    }));

    activeSeq.data = newData;
    
    // Trigger UI update
    if (localAppServices.renderTrackSequencer) {
        localAppServices.renderTrackSequencer(trackId);
    }
    if (localAppServices.showNotification) {
        localAppServices.showNotification('Rhythm randomization applied', 1500);
    }
    
    console.log('[RhythmRandomizer] Applied randomization to track', trackId);
    return true;
}

/**
 * Open the Rhythm Randomizer panel
 */
export function openRhythmRandomizerPanel(savedState = null) {
    const windowId = 'rhythmRandomizer';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderRhythmRandomizerContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'rhythmRandomizerContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = { 
        width: 450, 
        height: 520, 
        minWidth: 380, 
        minHeight: 450, 
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

    const win = localAppServices.createWindow(windowId, 'Rhythm Randomizer', contentContainer, options);
    
    if (win?.element) {
        renderRhythmRandomizerContent();
    }
    
    return win;
}

/**
 * Render the rhythm randomizer panel content
 */
function renderRhythmRandomizerContent() {
    const container = document.getElementById('rhythmRandomizerContent');
    if (!container) return;

    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const drumTracks = tracks.filter(t => 
        t.type === 'DrumSampler' || 
        t.type === 'Synth' || 
        (t.sequences && t.sequences.length > 0)
    );

    const s = rhythmRandomizerState;

    let html = `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Rhythm Randomizer</h3>
                <button id="closeRhythmRandomizerBtn" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
            </div>
            
            <div class="p-3 bg-blue-50 dark:bg-slate-700 rounded text-xs text-gray-600 dark:text-gray-400">
                Apply probability-based randomization to drum patterns. Each step has a chance to be removed, varied in velocity, or timing-shifted.
            </div>
            
            <!-- Track Selection -->
            <div>
                <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Target Track:</label>
                <select id="rhythmRandomizerTrack" class="w-full p-2 text-sm bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                    <option value="">Select a track...</option>
                    ${drumTracks.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
            </div>
            
            <!-- Probability Controls -->
            <div class="border-t border-gray-200 dark:border-slate-600 pt-3">
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Probability</h4>
                
                <div class="space-y-3">
                    <div>
                        <div class="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Step Probability</span>
                            <span>${Math.round(s.stepProbability * 100)}%</span>
                        </div>
                        <input type="range" id="stepProbability" min="0" max="100" value="${Math.round(s.stepProbability * 100)}" 
                            class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                        <div class="text-xs text-gray-400 mt-1">Chance each step stays active</div>
                    </div>
                    
                    <div>
                        <div class="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Density</span>
                            <span>${Math.round(s.density * 100)}%</span>
                        </div>
                        <input type="range" id="density" min="0" max="100" value="${Math.round(s.density * 100)}" 
                            class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                        <div class="text-xs text-gray-400 mt-1">Overall note density</div>
                    </div>
                    
                    <div>
                        <div class="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Accent Probability</span>
                            <span>${Math.round(s.accentProbability * 100)}%</span>
                        </div>
                        <input type="range" id="accentProbability" min="0" max="100" value="${Math.round(s.accentProbability * 100)}" 
                            class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                        <div class="text-xs text-gray-400 mt-1">Chance of accenting off-beats</div>
                    </div>
                </div>
            </div>
            
            <!-- Variation Controls -->
            <div class="border-t border-gray-200 dark:border-slate-600 pt-3">
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Variation</h4>
                
                <div class="space-y-3">
                    <div>
                        <div class="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Timing Variation</span>
                            <span>${Math.round(s.timingVariation * 100)}%</span>
                        </div>
                        <input type="range" id="timingVariation" min="0" max="100" value="${Math.round(s.timingVariation * 100)}" 
                            class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                        <div class="text-xs text-gray-400 mt-1">Humanize timing</div>
                    </div>
                    
                    <div>
                        <div class="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Velocity Variation</span>
                            <span>${Math.round(s.velocityVariation * 100)}%</span>
                        </div>
                        <input type="range" id="velocityVariation" min="0" max="100" value="${Math.round(s.velocityVariation * 100)}" 
                            class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                        <div class="text-xs text-gray-400 mt-1">Randomize note velocities</div>
                    </div>
                    
                    <div>
                        <div class="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Swing Amount</span>
                            <span>${Math.round(s.swingAmount * 100)}%</span>
                        </div>
                        <input type="range" id="swingAmount" min="0" max="100" value="${Math.round(s.swingAmount * 100)}" 
                            class="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer">
                        <div class="text-xs text-gray-400 mt-1">Swing applied to off-beats</div>
                    </div>
                </div>
            </div>
            
            <!-- Options -->
            <div class="border-t border-gray-200 dark:border-slate-600 pt-3">
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Options</h4>
                
                <div class="space-y-2">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="humanize" ${s.humanize ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                        <span class="text-sm text-gray-700 dark:text-gray-300">Apply Humanization</span>
                    </label>
                    
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="preserveDownbeats" ${s.preserveDownbeats ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                        <span class="text-sm text-gray-700 dark:text-gray-300">Preserve Downbeats</span>
                    </label>
                    
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="shuffleMode" ${s.shuffleMode ? 'checked' : ''} class="w-4 h-4 accent-blue-500">
                        <span class="text-sm text-gray-700 dark:text-gray-300">Shuffle Mode</span>
                    </label>
                </div>
            </div>
            
            <!-- Presets -->
            <div class="border-t border-gray-200 dark:border-slate-600 pt-3">
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Presets</h4>
                <div class="flex flex-wrap gap-2">
                    <button class="preset-btn px-3 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500" data-preset="subtle">Subtle</button>
                    <button class="preset-btn px-3 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500" data-preset="medium">Medium</button>
                    <button class="preset-btn px-3 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500" data-preset="extreme">Extreme</button>
                    <button class="preset-btn px-3 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500" data-preset="funky">Funky</button>
                    <button class="preset-btn px-3 py-1 text-xs bg-gray-200 dark:bg-slate-600 rounded hover:bg-gray-300 dark:hover:bg-slate-500" data-preset="loose">Loose</button>
                </div>
            </div>
            
            <!-- Apply Button -->
            <button id="applyRhythmRandomizer" class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium">
                Apply to Sequence
            </button>
        </div>
    `;

    container.innerHTML = html;

    // Close button
    container.querySelector('#closeRhythmRandomizerBtn')?.addEventListener('click', () => {
        const win = localAppServices.getWindowByIdState?.(windowId);
        win?.close();
    });

    // Slider event listeners
    const sliders = ['stepProbability', 'density', 'accentProbability', 'timingVariation', 'velocityVariation', 'swingAmount'];
    sliders.forEach(id => {
        const slider = container.querySelector(`#${id}`);
        if (slider) {
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10) / 100;
                setRhythmRandomizerSetting(id, value);
                renderRhythmRandomizerContent();
            });
        }
    });

    // Checkbox event listeners
    const checkboxes = ['humanize', 'preserveDownbeats', 'shuffleMode'];
    checkboxes.forEach(id => {
        const checkbox = container.querySelector(`#${id}`);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                setRhythmRandomizerSetting(id, e.target.checked);
            });
        }
    });

    // Preset buttons
    const presets = {
        subtle: { stepProbability: 0.7, density: 0.8, timingVariation: 0.1, velocityVariation: 0.1, accentProbability: 0.2, swingAmount: 0.1, humanize: true, preserveDownbeats: true },
        medium: { stepProbability: 0.5, density: 0.6, timingVariation: 0.2, velocityVariation: 0.2, accentProbability: 0.3, swingAmount: 0.25, humanize: true, preserveDownbeats: true },
        extreme: { stepProbability: 0.3, density: 0.4, timingVariation: 0.4, velocityVariation: 0.4, accentProbability: 0.5, swingAmount: 0.4, humanize: true, preserveDownbeats: false },
        funky: { stepProbability: 0.6, density: 0.7, timingVariation: 0.3, velocityVariation: 0.3, accentProbability: 0.6, swingAmount: 0.5, humanize: true, preserveDownbeats: false },
        loose: { stepProbability: 0.4, density: 0.5, timingVariation: 0.35, velocityVariation: 0.25, accentProbability: 0.25, swingAmount: 0.15, humanize: true, preserveDownbeats: true }
    };

    container.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetName = btn.dataset.preset;
            const preset = presets[presetName];
            if (preset) {
                Object.entries(preset).forEach(([key, value]) => {
                    setRhythmRandomizerSetting(key, value);
                });
                localAppServices.showNotification?.(`Applied "${presetName}" preset`, 1000);
                renderRhythmRandomizerContent();
            }
        });
    });

    // Apply button
    container.querySelector('#applyRhythmRandomizer')?.addEventListener('click', () => {
        const trackSelect = container.querySelector('#rhythmRandomizerTrack');
        const trackId = parseInt(trackSelect?.value, 10);
        if (!trackId) {
            localAppServices.showNotification?.('Please select a track first', 2000);
            return;
        }
        applyRhythmRandomization(trackId);
    });
}
