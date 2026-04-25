// js/NoteEchoEffect.js
// Note Echo Effect - Per-note delay with feedback for arpeggiation effects

export class NoteEchoEffect {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.noteCallbacks = options.noteCallbacks || {};
        
        // Echo parameters
        this.enabled = true;
        this.echoCount = options.echoCount || 3; // Number of echoes
        this.echoDelay = options.echoDelay || 0.25; // Delay in seconds (250ms default)
        this.echoFeedback = options.echoFeedback || 0.4; // Feedback amount (0-1)
        this.echoLevel = options.echoLevel || 0.6; // Output level of echoes
        this.filterCutoff = options.filterCutoff || 4000; // Lowpass filter for echo tails
        this.pingPong = options.pingPong || false; // Alternate L/R for echoes
        
        // Internal state
        this._activeEchoes = new Map(); // noteId -> array of scheduled functions
        this._delayLines = []; // Audio nodes for each echo tap
        
        // Track which notes are currently echoing
        this._echoingNotes = new Set();
    }

    setAudioContext(ctx) {
        this.audioContext = ctx;
        this._initDelayLines();
    }

    _initDelayLines() {
        if (!this.audioContext) return;
        
        // Create delay lines for ping-pong echo if enabled
        this._delayLines = [];
        
        for (let i = 0; i < this.echoCount; i++) {
            const delay = this.audioContext.createDelay();
            delay.delayTime.value = this.echoDelay * (i + 1);
            
            const feedback = this.audioContext.createGain();
            feedback.gain.value = this.echoFeedback;
            
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = this.filterCutoff;
            
            const level = this.audioContext.createGain();
            level.gain.value = Math.pow(this.echoLevel, i + 1); // Decreasing level per echo
            
            this._delayLines.push({ delay, feedback, filter, level });
        }
    }

    /**
     * Process a note-on event with echo
     * @param {number} noteId - Unique ID for this note instance
     * @param {number} pitch - MIDI pitch
     * @param {number} velocity - Note velocity (0-1)
     * @param {number} startTime - AudioContext time to start
     */
    triggerNote(noteId, pitch, velocity, startTime) {
        if (!this.enabled) return;
        
        this._echoingNotes.add(noteId);
        
        // Schedule echoes
        const echoSchedule = [];
        for (let i = 0; i < this.echoCount; i++) {
            const delayTime = this.echoDelay * (i + 1);
            const echVel = velocity * Math.pow(this.echoLevel, i + 1);
            
            const echoEvent = {
                noteId,
                pitch,
                velocity: echVel,
                time: startTime + delayTime,
                echoIndex: i
            };
            echoSchedule.push(echoEvent);
            
            // Call the note callback for each echo
            if (this.noteCallbacks.onNote) {
                // Schedule the callback
                const delayMs = delayTime * 1000;
                setTimeout(() => {
                    if (this._echoingNotes.has(noteId)) {
                        this.noteCallbacks.onNote(echoEvent);
                    }
                }, delayMs);
            }
        }
        
        return echoSchedule;
    }

    /**
     * Stop echoes for a specific note
     * @param {number} noteId - The note ID to stop
     * @param {number} time - AudioContext time to stop
     */
    releaseNote(noteId, time) {
        this._echoingNotes.delete(noteId);
    }

    /**
     * Stop all active echoes
     */
    stopAll() {
        this._echoingNotes.clear();
    }

    /**
     * Set echo delay time
     * @param {number} delay - Delay in seconds
     */
    setDelay(delay) {
        this.echoDelay = Math.max(0.01, Math.min(2, delay));
        this._initDelayLines();
    }

    /**
     * Set feedback amount
     * @param {number} feedback - Feedback amount (0-1)
     */
    setFeedback(feedback) {
        this.echoFeedback = Math.max(0, Math.min(0.95, feedback));
        this._initDelayLines();
    }

    /**
     * Set echo output level
     * @param {number} level - Level (0-1)
     */
    setLevel(level) {
        this.echoLevel = Math.max(0, Math.min(1, level));
        this._initDelayLines();
    }

    /**
     * Set number of echoes
     * @param {number} count - Number of echoes (1-8)
     */
    setEchoCount(count) {
        this.echoCount = Math.max(1, Math.min(8, Math.round(count)));
        this._initDelayLines();
    }

    /**
     * Enable/disable the effect
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = !!enabled;
        if (!enabled) {
            this.stopAll();
        }
    }

    /**
     * Get current parameters
     */
    getParams() {
        return {
            enabled: this.enabled,
            echoCount: this.echoCount,
            echoDelay: this.echoDelay,
            echoFeedback: this.echoFeedback,
            echoLevel: this.echoLevel,
            filterCutoff: this.filterCutoff,
            pingPong: this.pingPong
        };
    }

    /**
     * Set parameters
     * @param {object} params
     */
    setParams(params) {
        if (params.enabled !== undefined) this.enabled = params.enabled;
        if (params.echoCount !== undefined) this.setEchoCount(params.echoCount);
        if (params.echoDelay !== undefined) this.setDelay(params.echoDelay);
        if (params.echoFeedback !== undefined) this.setFeedback(params.echoFeedback);
        if (params.echoLevel !== undefined) this.setLevel(params.echoLevel);
        if (params.filterCutoff !== undefined) this.filterCutoff = params.filterCutoff;
        if (params.pingPong !== undefined) this.pingPong = params.pingPong;
    }

    dispose() {
        this.stopAll();
        this._delayLines = [];
    }
}

// --- Note Echo Effect Panel ---

let localAppServices = {};
let noteEchoInstance = null;

export function initNoteEchoEffect(services) {
    localAppServices = services;
    noteEchoInstance = new NoteEchoEffect({
        noteCallbacks: {
            onNote: (event) => {
                // Trigger the note callback through the app services
                if (localAppServices.triggerNoteEcho) {
                    localAppServices.triggerNoteEcho(event);
                }
            }
        }
    });
    console.log('[NoteEchoEffect] Initialized');
}

export function getNoteEchoInstance() {
    return noteEchoInstance;
}

export function openNoteEchoEffectPanel(savedState = null) {
    const windowId = 'noteEchoEffect';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'noteEchoContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    
    const options = { 
        width: 360, 
        height: 420, 
        minWidth: 300, 
        minHeight: 350, 
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
    
    const win = localAppServices.createWindow(windowId, 'Note Echo Effect', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderNoteEchoContent(), 50);
    }
    return win;
}

function renderNoteEchoContent() {
    const container = document.getElementById('noteEchoContent');
    if (!container || !noteEchoInstance) return;

    const params = noteEchoInstance.getParams();

    let html = `
        <div class="mb-4">
            <label class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <input type="checkbox" id="nee-enabled" ${params.enabled ? 'checked' : ''} class="w-4 h-4">
                Enable Note Echo
            </label>
        </div>
        
        <div class="space-y-4">
            <div>
                <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                    Echo Count: <span id="nee-count-val">${params.echoCount}</span>
                </label>
                <input type="range" id="nee-count" min="1" max="8" value="${params.echoCount}" 
                    class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
            </div>
            
            <div>
                <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                    Echo Delay: <span id="nee-delay-val">${(params.echoDelay * 1000).toFixed(0)}ms</span>
                </label>
                <input type="range" id="nee-delay" min="10" max="1000" value="${params.echoDelay * 1000}" 
                    class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
            </div>
            
            <div>
                <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                    Feedback: <span id="nee-fb-val">${(params.echoFeedback * 100).toFixed(0)}%</span>
                </label>
                <input type="range" id="nee-feedback" min="0" max="95" value="${params.echoFeedback * 100}" 
                    class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
            </div>
            
            <div>
                <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                    Echo Level: <span id="nee-level-val">${(params.echoLevel * 100).toFixed(0)}%</span>
                </label>
                <input type="range" id="nee-level" min="10" max="100" value="${params.echoLevel * 100}" 
                    class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
            </div>
            
            <div>
                <label class="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                    Filter Cutoff: <span id="nee-filter-val">${params.filterCutoff}Hz</span>
                </label>
                <input type="range" id="nee-filter" min="500" max="12000" value="${params.filterCutoff}" 
                    class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
            </div>
            
            <div>
                <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" id="nee-pingpong" ${params.pingPong ? 'checked' : ''} class="w-4 h-4">
                    Ping-Pong Mode
                </label>
            </div>
        </div>
        
        <div class="mt-4 p-3 bg-gray-100 dark:bg-slate-700 rounded text-xs text-gray-600 dark:text-gray-400">
            <b>Note Echo Effect</b><br>
            Adds echoing repeats to each note for arpeggiation and rhythmic effects.
            Works with MIDI instruments to create cascading echo patterns.
        </div>
    `;

    container.innerHTML = html;

    // Get elements
    const enabledCb = document.getElementById('nee-enabled');
    const countSlider = document.getElementById('nee-count');
    const delaySlider = document.getElementById('nee-delay');
    const feedbackSlider = document.getElementById('nee-feedback');
    const levelSlider = document.getElementById('nee-level');
    const filterSlider = document.getElementById('nee-filter');
    const pingPongCb = document.getElementById('nee-pingpong');

    // Update display functions
    function updateCount() {
        document.getElementById('nee-count-val').textContent = countSlider.value;
        noteEchoInstance.setEchoCount(parseInt(countSlider.value));
    }

    function updateDelay() {
        const ms = parseInt(delaySlider.value);
        document.getElementById('nee-delay-val').textContent = `${ms}ms`;
        noteEchoInstance.setDelay(ms / 1000);
    }

    function updateFeedback() {
        document.getElementById('nee-fb-val').textContent = `${feedbackSlider.value}%`;
        noteEchoInstance.setFeedback(parseInt(feedbackSlider.value) / 100);
    }

    function updateLevel() {
        document.getElementById('nee-level-val').textContent = `${levelSlider.value}%`;
        noteEchoInstance.setLevel(parseInt(levelSlider.value) / 100);
    }

    function updateFilter() {
        document.getElementById('nee-filter-val').textContent = `${filterSlider.value}Hz`;
        noteEchoInstance.filterCutoff = parseInt(filterSlider.value);
    }

    // Event listeners
    enabledCb?.addEventListener('change', (e) => {
        noteEchoInstance.setEnabled(e.target.checked);
    });

    countSlider?.addEventListener('input', updateCount);
    delaySlider?.addEventListener('input', updateDelay);
    feedbackSlider?.addEventListener('input', updateFeedback);
    levelSlider?.addEventListener('input', updateLevel);
    filterSlider?.addEventListener('input', updateFilter);

    pingPongCb?.addEventListener('change', (e) => {
        noteEchoInstance.pingPong = e.target.checked;
    });

    console.log('[NoteEchoEffect] Panel rendered');
}

// Export for use in other modules
export function getNoteEchoParams() {
    return noteEchoInstance?.getParams() || null;
}

export function setNoteEchoParams(params) {
    if (noteEchoInstance) {
        noteEchoInstance.setParams(params);
    }
}