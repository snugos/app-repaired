/**
 * Ruler Mode Toggle - Toggle between bars/beats and timecode display
 */

export class RulerModeToggle {
    constructor(options = {}) {
        this.mode = options.mode ?? 'bars-beats'; // bars-beats, timecode, samples
        
        // Time settings
        this.timeSettings = {
            bpm: options.bpm ?? 120,
            timeSignature: options.timeSignature ?? {numerator: 4, denominator: 4},
            sampleRate: options.sampleRate ?? 44100,
            framesPerSecond: options.framesPerSecond ?? 30, // for SMPTE
            
            // Display options
            showSubdivisions: options.showSubdivisions ?? true,
            subdivisions: options.subdivisions ?? 4, // 1, 2, 4, 8, 16
            showBars: options.showBars ?? true,
            showBeats: options.showBeats ?? true,
            showTicks: options.showTicks ?? false,
            
            // Timecode format
            timecodeFormat: options.timecodeFormat ?? 'HH:MM:SS:FF', // HH:MM:SS:FF, HH:MM:SS.mmm, HH:MM:SS
            dropFrame: options.dropFrame ?? false // For NTSC video
        };
        
        // UI elements
        this.rulerElement = null;
        this.toggleButton = null;
        
        // Callbacks
        this.onModeChange = options.onModeChange || null;
        this.onRulerUpdate = options.onRulerUpdate || null;
        
        // Cached values
        this.cache = {
            lastPosition: 0,
            lastDuration: 0,
            markers: []
        };
    }
    
    /**
     * Initialize with ruler element
     */
    init(rulerElement, toggleButton = null) {
        this.rulerElement = rulerElement;
        this.toggleButton = toggleButton;
        
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', () => this.cycleMode());
        }
        
        this.updateRuler();
        console.log('[RulerModeToggle] Initialized with mode:', this.mode);
    }
    
    /**
     * Set display mode
     */
    setMode(mode) {
        const previousMode = this.mode;
        this.mode = mode;
        
        this.updateRuler();
        
        if (this.onModeChange) {
            this.onModeChange(mode, previousMode);
        }
        
        console.log(`[RulerModeToggle] Mode changed: ${previousMode} -> ${mode}`);
    }
    
    /**
     * Cycle through modes
     */
    cycleMode() {
        const modes = ['bars-beats', 'timecode', 'samples'];
        const currentIndex = modes.indexOf(this.mode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setMode(modes[nextIndex]);
    }
    
    /**
     * Update time settings
     */
    setTimeSettings(settings) {
        Object.assign(this.timeSettings, settings);
        this.updateRuler();
    }
    
    /**
     * Set BPM
     */
    setBPM(bpm) {
        this.timeSettings.bpm = bpm;
        this.updateRuler();
    }
    
    /**
     * Set time signature
     */
    setTimeSignature(numerator, denominator) {
        this.timeSettings.timeSignature = {numerator, denominator};
        this.updateRuler();
    }
    
    /**
     * Convert seconds to bars-beats display
     */
    secondsToBarsBeats(seconds) {
        const {bpm, timeSignature} = this.timeSettings;
        const beatsPerSecond = bpm / 60;
        const beatsPerBar = timeSignature.numerator;
        
        const totalBeats = seconds * beatsPerSecond;
        const bar = Math.floor(totalBeats / beatsPerBar) + 1;
        const beat = Math.floor(totalBeats % beatsPerBar) + 1;
        const tick = Math.floor((totalBeats % 1) * 480); // 480 ticks per beat (MIDI standard)
        
        return {bar, beat, tick, totalBeats};
    }
    
    /**
     * Convert seconds to timecode display
     */
    secondsToTimecode(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const frames = Math.floor((seconds % 1) * this.timeSettings.framesPerSecond);
        
        if (this.timeSettings.timecodeFormat === 'HH:MM:SS.mmm') {
            const ms = Math.floor((seconds % 1) * 1000);
            return {
                hours,
                minutes,
                seconds: secs,
                milliseconds: ms,
                string: `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)}.${this.pad(ms, 3)}`
            };
        } else if (this.timeSettings.timecodeFormat === 'HH:MM:SS') {
            return {
                hours,
                minutes,
                seconds: secs,
                string: `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)}`
            };
        } else {
            // HH:MM:SS:FF (SMPTE)
            return {
                hours,
                minutes,
                seconds: secs,
                frames,
                string: `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(secs)}:${this.pad(frames)}`
            };
        }
    }
    
    /**
     * Convert seconds to samples
     */
    secondsToSamples(seconds) {
        const samples = Math.floor(seconds * this.timeSettings.sampleRate);
        return {
            samples,
            string: samples.toLocaleString()
        };
    }
    
    /**
     * Convert from bars-beats to seconds
     */
    barsBeatsToSeconds(bar, beat = 1, tick = 0) {
        const {bpm, timeSignature} = this.timeSettings;
        const beatsPerSecond = bpm / 60;
        const beatsPerBar = timeSignature.numerator;
        
        const barBeats = (bar - 1) * beatsPerBar;
        const beatFraction = (beat - 1) + (tick / 480);
        
        return (barBeats + beatFraction) / beatsPerSecond;
    }
    
    /**
     * Convert from timecode to seconds
     */
    timecodeToSeconds(hours, minutes, seconds, frames = 0) {
        let total = hours * 3600 + minutes * 60 + seconds;
        
        if (this.timeSettings.timecodeFormat === 'HH:MM:SS:FF') {
            total += frames / this.timeSettings.framesPerSecond;
        } else if (this.timeSettings.timecodeFormat === 'HH:MM:SS.mmm') {
            // frames param would be milliseconds
            total += frames / 1000;
        }
        
        return total;
    }
    
    /**
     * Format current position for display
     */
    formatPosition(seconds) {
        switch (this.mode) {
            case 'bars-beats':
                const bb = this.secondsToBarsBeats(seconds);
                if (this.timeSettings.showTicks) {
                    return `${bb.bar}.${bb.beat}.${bb.tick}`;
                }
                return `${bb.bar}.${bb.beat}`;
                
            case 'timecode':
                const tc = this.secondsToTimecode(seconds);
                return tc.string;
                
            case 'samples':
                const s = this.secondsToSamples(seconds);
                return s.string + ' samples';
                
            default:
                return this.formatPosition(seconds);
        }
    }
    
    /**
     * Format duration
     */
    formatDuration(seconds) {
        switch (this.mode) {
            case 'bars-beats':
                const bb = this.secondsToBarsBeats(seconds);
                return `${bb.bar} bars ${bb.beat} beats`;
                
            case 'timecode':
                const tc = this.secondsToTimecode(seconds);
                return tc.string;
                
            case 'samples':
                const s = this.secondsToSamples(seconds);
                return s.string + ' samples';
        }
    }
    
    /**
     * Get ruler markers for current mode
     */
    getRulerMarkers(duration, pixelsPerSecond = 100) {
        const markers = [];
        const totalPixels = duration * pixelsPerSecond;
        
        switch (this.mode) {
            case 'bars-beats':
                return this.getBarsBeatsMarkers(duration, pixelsPerSecond);
                
            case 'timecode':
                return this.getTimecodeMarkers(duration, pixelsPerSecond);
                
            case 'samples':
                return this.getSampleMarkers(duration, pixelsPerSecond);
        }
        
        return markers;
    }
    
    /**
     * Generate bars-beats markers
     */
    getBarsBeatsMarkers(duration, pixelsPerSecond) {
        const markers = [];
        const {bpm, timeSignature, subdivisions, showSubdivisions} = this.timeSettings;
        const beatsPerSecond = bpm / 60;
        const beatsPerBar = timeSignature.numerator;
        const totalBeats = duration * beatsPerSecond;
        const totalBars = Math.ceil(totalBeats / beatsPerBar);
        
        // Bar markers
        for (let bar = 1; bar <= totalBars; bar++) {
            const seconds = this.barsBeatsToSeconds(bar, 1, 0);
            markers.push({
                position: seconds,
                pixelPosition: seconds * pixelsPerSecond,
                label: `${bar}`,
                type: 'bar',
                major: true
            });
            
            // Beat markers within bar
            if (bar <= totalBars) {
                for (let beat = 2; beat <= beatsPerBar; beat++) {
                    const beatSeconds = this.barsBeatsToSeconds(bar, beat, 0);
                    if (beatSeconds <= duration) {
                        markers.push({
                            position: beatSeconds,
                            pixelPosition: beatSeconds * pixelsPerSecond,
                            label: `${bar}.${beat}`,
                            type: 'beat',
                            major: false
                        });
                    }
                }
                
                // Subdivisions
                if (showSubdivisions && subdivisions > 1) {
                    for (let beat = 1; beat <= beatsPerBar; beat++) {
                        for (let sub = 1; sub < subdivisions; sub++) {
                            const tick = (sub / subdivisions) * 480;
                            const subSeconds = this.barsBeatsToSeconds(bar, beat, tick);
                            if (subSeconds <= duration) {
                                markers.push({
                                    position: subSeconds,
                                    pixelPosition: subSeconds * pixelsPerSecond,
                                    label: '',
                                    type: 'subdivision',
                                    major: false
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return markers;
    }
    
    /**
     * Generate timecode markers
     */
    getTimecodeMarkers(duration, pixelsPerSecond) {
        const markers = [];
        
        // Determine appropriate interval based on duration and zoom
        let interval;
        if (duration > 3600) { // > 1 hour
            interval = 600; // 10 minutes
        } else if (duration > 600) { // > 10 minutes
            interval = 60; // 1 minute
        } else if (duration > 60) { // > 1 minute
            interval = 10; // 10 seconds
        } else if (duration > 10) { // > 10 seconds
            interval = 1; // 1 second
        } else {
            interval = 0.1; // 100ms
        }
        
        for (let seconds = 0; seconds <= duration; seconds += interval) {
            const tc = this.secondsToTimecode(seconds);
            markers.push({
                position: seconds,
                pixelPosition: seconds * pixelsPerSecond,
                label: tc.string,
                type: 'timecode',
                major: seconds % (interval * 10) === 0
            });
        }
        
        return markers;
    }
    
    /**
     * Generate sample markers
     */
    getSampleMarkers(duration, pixelsPerSecond) {
        const markers = [];
        const {sampleRate} = this.timeSettings;
        const totalSamples = duration * sampleRate;
        
        // Determine appropriate interval
        let sampleInterval;
        if (totalSamples > 10000000) { // > 10M samples
            sampleInterval = 1000000; // 1M
        } else if (totalSamples > 1000000) { // > 1M samples
            sampleInterval = 100000; // 100K
        } else if (totalSamples > 100000) { // > 100K samples
            sampleInterval = 10000; // 10K
        } else {
            sampleInterval = 1000; // 1K
        }
        
        for (let sample = 0; sample <= totalSamples; sample += sampleInterval) {
            const seconds = sample / sampleRate;
            markers.push({
                position: seconds,
                pixelPosition: seconds * pixelsPerSecond,
                label: `${(sample / 1000).toFixed(0)}K`,
                type: 'sample',
                major: sample % (sampleInterval * 10) === 0
            });
        }
        
        return markers;
    }
    
    /**
     * Update ruler display
     */
    updateRuler(duration = 60, pixelsPerSecond = 100) {
        if (!this.rulerElement) return;
        
        const markers = this.getRulerMarkers(duration, pixelsPerSecond);
        
        // Clear existing
        this.rulerElement.innerHTML = '';
        
        // Create marker elements
        markers.forEach(marker => {
            const element = document.createElement('div');
            element.className = `ruler-marker ruler-${marker.type}`;
            element.style.cssText = `
                position: absolute;
                left: ${marker.pixelPosition}px;
                height: ${marker.major ? '100%' : '50%'};
                width: 1px;
                background: ${marker.major ? '#666' : '#333'};
            `;
            
            if (marker.label) {
                const label = document.createElement('span');
                label.className = 'ruler-label';
                label.textContent = marker.label;
                label.style.cssText = `
                    position: absolute;
                    top: 2px;
                    left: ${marker.pixelPosition + 2}px;
                    font-size: 10px;
                    color: #888;
                    white-space: nowrap;
                `;
                this.rulerElement.appendChild(label);
            }
            
            this.rulerElement.appendChild(element);
        });
        
        // Update toggle button text
        if (this.toggleButton) {
            this.toggleButton.textContent = this.getModeLabel();
            this.toggleButton.title = `Current mode: ${this.getModeLabel()} (click to change)`;
        }
        
        if (this.onRulerUpdate) {
            this.onRulerUpdate(markers);
        }
    }
    
    /**
     * Get mode label for display
     */
    getModeLabel() {
        switch (this.mode) {
            case 'bars-beats': return 'Bars.Beats';
            case 'timecode': return 'Timecode';
            case 'samples': return 'Samples';
            default: return this.mode;
        }
    }
    
    /**
     * Pad number with zeros
     */
    pad(num, digits = 2) {
        return num.toString().padStart(digits, '0');
    }
    
    /**
     * Get state
     */
    getState() {
        return {
            mode: this.mode,
            timeSettings: {...this.timeSettings}
        };
    }
    
    /**
     * Set state
     */
    setState(state) {
        this.mode = state.mode || this.mode;
        if (state.timeSettings) {
            Object.assign(this.timeSettings, state.timeSettings);
        }
        this.updateRuler();
    }
    
    /**
     * Create UI toggle button
     */
    createToggleButton(container) {
        const button = document.createElement('button');
        button.className = 'ruler-mode-toggle';
        button.textContent = this.getModeLabel();
        button.style.cssText = `
            padding: 6px 12px;
            background: #374151;
            border: 1px solid #4b5563;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-family: monospace;
        `;
        
        button.addEventListener('click', () => this.cycleMode());
        
        if (container) {
            container.appendChild(button);
        }
        
        this.toggleButton = button;
        return button;
    }
    
    /**
     * Create ruler element
     */
    createRulerElement(container, height = 24) {
        const ruler = document.createElement('div');
        ruler.className = 'ruler-container';
        ruler.style.cssText = `
            position: relative;
            width: 100%;
            height: ${height}px;
            background: #1a1a2e;
            border-bottom: 1px solid #333;
            overflow: hidden;
        `;
        
        if (container) {
            container.appendChild(ruler);
        }
        
        this.rulerElement = ruler;
        return ruler;
    }
    
    /**
     * Dispose
     */
    dispose() {
        if (this.toggleButton) {
            this.toggleButton.removeEventListener('click', this.cycleMode);
        }
        this.rulerElement = null;
        this.toggleButton = null;
    }
}

/**
 * Ruler Mode Manager - Manages multiple rulers
 */
export class RulerModeManager {
    constructor() {
        this.rulers = new Map();
        this.globalMode = 'bars-beats';
        this.globalSettings = {
            bpm: 120,
            timeSignature: {numerator: 4, denominator: 4},
            sampleRate: 44100
        };
    }
    
    createRuler(id, options = {}) {
        const ruler = new RulerModeToggle({
            mode: this.globalMode,
            ...this.globalSettings,
            ...options
        });
        
        this.rulers.set(id, ruler);
        return ruler;
    }
    
    getRuler(id) {
        return this.rulers.get(id);
    }
    
    removeRuler(id) {
        const ruler = this.rulers.get(id);
        if (ruler) {
            ruler.dispose();
            this.rulers.delete(id);
        }
    }
    
    /**
     * Set global mode for all rulers
     */
    setGlobalMode(mode) {
        this.globalMode = mode;
        this.rulers.forEach(ruler => ruler.setMode(mode));
    }
    
    /**
     * Update global settings
     */
    updateGlobalSettings(settings) {
        Object.assign(this.globalSettings, settings);
        this.rulers.forEach(ruler => ruler.setTimeSettings(settings));
    }
    
    /**
     * Set BPM for all rulers
     */
    setBPM(bpm) {
        this.globalSettings.bpm = bpm;
        this.rulers.forEach(ruler => ruler.setBPM(bpm));
    }
    
    /**
     * Set time signature for all rulers
     */
    setTimeSignature(numerator, denominator) {
        this.globalSettings.timeSignature = {numerator, denominator};
        this.rulers.forEach(ruler => ruler.setTimeSignature(numerator, denominator));
    }
    
    /**
     * Get state
     */
    getState() {
        return {
            globalMode: this.globalMode,
            globalSettings: {...this.globalSettings}
        };
    }
    
    /**
     * Set state
     */
    setState(state) {
        this.globalMode = state.globalMode || this.globalMode;
        Object.assign(this.globalSettings, state.globalSettings || {});
        
        this.rulers.forEach(ruler => {
            ruler.setMode(this.globalMode);
            ruler.setTimeSettings(this.globalSettings);
        });
    }
    
    dispose() {
        this.rulers.forEach(ruler => ruler.dispose());
        this.rulers.clear();
    }
}

// Global instance
let rulerModeManager = null;

export function getRulerModeManager() {
    if (!rulerModeManager) {
        rulerModeManager = new RulerModeManager();
    }
    return rulerModeManager;
}

export function createRulerModeUI(container, options = {}) {
    const manager = getRulerModeManager();
    const ruler = manager.createRuler('main', options);
    
    // Create container for ruler and toggle
    const wrapper = document.createElement('div');
    wrapper.className = 'ruler-wrapper';
    wrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        width: 100%;
    `;
    
    // Create header with toggle
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        background: #0a0a14;
    `;
    
    const label = document.createElement('span');
    label.textContent = 'Timeline';
    label.style.cssText = `color: #888; font-size: 12px;`;
    
    const toggle = ruler.createToggleButton(header);
    
    header.appendChild(label);
    header.appendChild(toggle);
    
    // Create ruler element
    const rulerElement = ruler.createRulerElement(wrapper);
    
    // Assemble
    wrapper.appendChild(header);
    wrapper.appendChild(rulerElement);
    
    if (container) {
        container.appendChild(wrapper);
    }
    
    // Initial update
    ruler.updateRuler();
    
    return {wrapper, ruler, toggle};
}

// Module initialized
console.log('[RulerModeToggle] Module loaded');