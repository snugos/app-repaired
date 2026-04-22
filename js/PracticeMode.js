// js/PracticeMode.js - Practice Mode for SnugOS DAW
// Features: Loop sections, slow down, speed up, count-in, metronome accent

/**
 * Practice Mode Manager
 * Provides tools for practicing sections of music
 */
export class PracticeMode {
    constructor(options = {}) {
        this.audioContext = options.audioContext || null;
        this.state = {
            active: false,
            loopStart: 0,
            loopEnd: 0,
            loopEnabled: false,
            playSpeed: 1.0,
            countInEnabled: false,
            countInBeats: 4,
            practiceTempo: null, // Separate from project tempo
            gradualSpeedUp: {
                enabled: false,
                startSpeed: 0.5,
                targetSpeed: 1.0,
                increment: 0.05,
                incrementAfter: 4, // loops before incrementing
                currentSpeed: 0.5,
                loopCount: 0
            },
            autoStop: {
                enabled: false,
                afterLoops: 0,
                currentLoop: 0
            },
            handsSeparation: {
                enabled: false,
                mode: 'both', // 'left', 'right', 'both'
                leftTrackId: null,
                rightTrackId: null
            },
            metronome: {
                accentFirstBeat: true,
                volume: 0.8
            }
        };
        
        this.listeners = new Map();
        this.countInTimeout = null;
        this.metronomeInterval = null;
    }

    /**
     * Initialize practice mode
     * @param {Object} audioContext - Web Audio API context
     */
    setAudioContext(audioContext) {
        this.audioContext = audioContext;
    }

    /**
     * Enable/disable practice mode
     * @param {boolean} enabled
     */
    setActive(enabled) {
        this.state.active = enabled;
        this._emit('activeChange', enabled);
        
        if (!enabled) {
            this.stopAll();
        }
    }

    /**
     * Set loop region for practice
     * @param {number} start - Start time in seconds
     * @param {number} end - End time in seconds
     */
    setLoopRegion(start, end) {
        this.state.loopStart = Math.max(0, start);
        this.state.loopEnd = Math.max(start + 0.1, end);
        this._emit('loopRegionChange', { start: this.state.loopStart, end: this.state.loopEnd });
    }

    /**
     * Enable/disable looping
     * @param {boolean} enabled
     */
    setLoopEnabled(enabled) {
        this.state.loopEnabled = enabled;
        this._emit('loopEnabledChange', enabled);
    }

    /**
     * Set playback speed (0.25 to 2.0)
     * @param {number} speed - Speed multiplier
     */
    setPlaySpeed(speed) {
        this.state.playSpeed = Math.max(0.25, Math.min(2.0, speed));
        this.state.gradualSpeedUp.currentSpeed = this.state.playSpeed;
        this._emit('speedChange', this.state.playSpeed);
    }

    /**
     * Enable count-in before playback
     * @param {boolean} enabled
     * @param {number} beats - Number of count-in beats
     */
    setCountIn(enabled, beats = 4) {
        this.state.countInEnabled = enabled;
        this.state.countInBeats = beats;
        this._emit('countInChange', { enabled, beats });
    }

    /**
     * Set practice tempo (overrides project tempo)
     * @param {number|null} bpm - Tempo in BPM, null to use project tempo
     */
    setPracticeTempo(bpm) {
        this.state.practiceTempo = bpm;
        this._emit('tempoChange', bpm);
    }

    /**
     * Configure gradual speed-up feature
     * @param {Object} config - Configuration object
     */
    setGradualSpeedUp(config) {
        Object.assign(this.state.gradualSpeedUp, config);
        this._emit('gradualSpeedUpChange', this.state.gradualSpeedUp);
    }

    /**
     * Enable/disable gradual speed-up
     * @param {boolean} enabled
     */
    enableGradualSpeedUp(enabled) {
        this.state.gradualSpeedUp.enabled = enabled;
        if (enabled) {
            this.state.gradualSpeedUp.currentSpeed = this.state.gradualSpeedUp.startSpeed;
            this.state.gradualSpeedUp.loopCount = 0;
        }
        this._emit('gradualSpeedUpChange', this.state.gradualSpeedUp);
    }

    /**
     * Configure auto-stop feature
     * @param {boolean} enabled
     * @param {number} afterLoops - Stop after this many loops
     */
    setAutoStop(enabled, afterLoops = 0) {
        this.state.autoStop.enabled = enabled;
        this.state.autoStop.afterLoops = afterLoops;
        this.state.autoStop.currentLoop = 0;
        this._emit('autoStopChange', this.state.autoStop);
    }

    /**
     * Configure hands separation for piano practice
     * @param {Object} config - Configuration
     */
    setHandsSeparation(config) {
        Object.assign(this.state.handsSeparation, config);
        this._emit('handsSeparationChange', this.state.handsSeparation);
    }

    /**
     * Set which hand(s) to play
     * @param {string} mode - 'left', 'right', or 'both'
     */
    setHandMode(mode) {
        if (['left', 'right', 'both'].includes(mode)) {
            this.state.handsSeparation.mode = mode;
            this._emit('handModeChange', mode);
        }
    }

    /**
     * Set metronome options
     * @param {Object} options - Metronome options
     */
    setMetronomeOptions(options) {
        Object.assign(this.state.metronome, options);
        this._emit('metronomeChange', this.state.metronome);
    }

    /**
     * Get effective tempo (practice tempo or provided project tempo)
     * @param {number} projectTempo - Current project tempo
     * @returns {number} Effective tempo
     */
    getEffectiveTempo(projectTempo) {
        return this.state.practiceTempo || projectTempo;
    }

    /**
     * Get effective speed multiplier
     * @returns {number} Speed multiplier
     */
    getEffectiveSpeed() {
        if (this.state.gradualSpeedUp.enabled) {
            return this.state.gradualSpeedUp.currentSpeed;
        }
        return this.state.playSpeed;
    }

    /**
     * Handle loop completion for gradual speed-up
     * @returns {Object} Updated state
     */
    handleLoopComplete() {
        this.state.autoStop.currentLoop++;
        
        if (this.state.gradualSpeedUp.enabled) {
            this.state.gradualSpeedUp.loopCount++;
            
            if (this.state.gradualSpeedUp.loopCount >= this.state.gradualSpeedUp.incrementAfter) {
                this.state.gradualSpeedUp.loopCount = 0;
                
                if (this.state.gradualSpeedUp.currentSpeed < this.state.gradualSpeedUp.targetSpeed) {
                    this.state.gradualSpeedUp.currentSpeed = Math.min(
                        this.state.gradualSpeedUp.currentSpeed + this.state.gradualSpeedUp.increment,
                        this.state.gradualSpeedUp.targetSpeed
                    );
                    this._emit('speedIncrement', this.state.gradualSpeedUp.currentSpeed);
                }
            }
        }

        // Check auto-stop
        if (this.state.autoStop.enabled && this.state.autoStop.afterLoops > 0) {
            if (this.state.autoStop.currentLoop >= this.state.autoStop.afterLoops) {
                this._emit('autoStop', this.state.autoStop.currentLoop);
                return { shouldStop: true, speed: this.getEffectiveSpeed() };
            }
        }

        return { shouldStop: false, speed: this.getEffectiveSpeed() };
    }

    /**
     * Play count-in clicks
     * @param {number} tempo - Tempo in BPM
     * @returns {Promise} Resolves when count-in complete
     */
    async playCountIn(tempo) {
        return new Promise((resolve) => {
            if (!this.state.countInEnabled || !this.audioContext) {
                resolve();
                return;
            }

            const beatDuration = 60 / tempo;
            let beat = 0;

            const playClick = () => {
                if (beat >= this.state.countInBeats) {
                    this._emit('countInComplete');
                    resolve();
                    return;
                }

                this._playMetronomeClick(beat === 0, this.state.metronome.volume);
                beat++;
                this.countInTimeout = setTimeout(playClick, beatDuration * 1000);
            };

            this._emit('countInStart', this.state.countInBeats);
            playClick();
        });
    }

    /**
     * Play a metronome click
     * @private
     */
    _playMetronomeClick(isAccent = false, volume = 0.8) {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Higher pitch for accent beat
        oscillator.frequency.value = isAccent ? 1200 : 800;
        oscillator.type = 'sine';

        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(volume * 0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        oscillator.start(now);
        oscillator.stop(now + 0.1);
    }

    /**
     * Start metronome for practice
     * @param {number} tempo - Tempo in BPM
     */
    startMetronome(tempo) {
        if (this.metronomeInterval) {
            clearInterval(this.metronomeInterval);
        }

        const beatDuration = (60 / tempo) * 1000;
        let beat = 0;

        this.metronomeInterval = setInterval(() => {
            const isAccent = this.state.metronome.accentFirstBeat && beat === 0;
            this._playMetronomeClick(isAccent, this.state.metronome.volume);
            this._emit('metronomeClick', { beat, isAccent });
            beat = (beat + 1) % 4;
        }, beatDuration);
    }

    /**
     * Stop metronome
     */
    stopMetronome() {
        if (this.metronomeInterval) {
            clearInterval(this.metronomeInterval);
            this.metronomeInterval = null;
        }
    }

    /**
     * Stop all practice activities
     */
    stopAll() {
        this.stopMetronome();
        if (this.countInTimeout) {
            clearTimeout(this.countInTimeout);
            this.countInTimeout = null;
        }
        this.state.autoStop.currentLoop = 0;
        this.state.gradualSpeedUp.loopCount = 0;
    }

    /**
     * Reset practice mode to defaults
     */
    reset() {
        this.state = {
            active: false,
            loopStart: 0,
            loopEnd: 0,
            loopEnabled: false,
            playSpeed: 1.0,
            countInEnabled: false,
            countInBeats: 4,
            practiceTempo: null,
            gradualSpeedUp: {
                enabled: false,
                startSpeed: 0.5,
                targetSpeed: 1.0,
                increment: 0.05,
                incrementAfter: 4,
                currentSpeed: 0.5,
                loopCount: 0
            },
            autoStop: {
                enabled: false,
                afterLoops: 0,
                currentLoop: 0
            },
            handsSeparation: {
                enabled: false,
                mode: 'both',
                leftTrackId: null,
                rightTrackId: null
            },
            metronome: {
                accentFirstBeat: true,
                volume: 0.8
            }
        };
        this._emit('reset');
    }

    /**
     * Get state snapshot
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Get tracks filtered by hand mode
     * @param {Array} tracks - All tracks
     * @returns {Array} Filtered tracks
     */
    getFilteredTracks(tracks) {
        if (!this.state.handsSeparation.enabled) {
            return tracks;
        }

        const mode = this.state.handsSeparation.mode;
        const leftId = this.state.handsSeparation.leftTrackId;
        const rightId = this.state.handsSeparation.rightTrackId;

        if (mode === 'left') {
            return tracks.filter(t => t.id === leftId);
        } else if (mode === 'right') {
            return tracks.filter(t => t.id === rightId);
        }
        
        return tracks;
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     * @private
     */
    _emit(event, data) {
        if (this.listeners.has(event)) {
            for (const callback of this.listeners.get(event)) {
                callback(data);
            }
        }
    }
}

/**
 * Practice Session Manager
 * Tracks practice progress over time
 */
export class PracticeSession {
    constructor() {
        this.sessions = [];
        this.currentSession = null;
    }

    /**
     * Start a new practice session
     * @param {string} projectId - Project ID
     * @param {string} sectionName - Section being practiced
     */
    startSession(projectId, sectionName = '') {
        this.currentSession = {
            id: Date.now().toString(),
            projectId,
            sectionName,
            startTime: Date.now(),
            endTime: null,
            duration: 0,
            loopsCompleted: 0,
            startSpeed: 1.0,
            endSpeed: 1.0,
            notes: ''
        };
    }

    /**
     * Record loop completion
     */
    recordLoop() {
        if (this.currentSession) {
            this.currentSession.loopsCompleted++;
        }
    }

    /**
     * Update current speed
     * @param {number} speed - Current speed
     */
    updateSpeed(speed) {
        if (this.currentSession) {
            if (this.currentSession.loopsCompleted === 0) {
                this.currentSession.startSpeed = speed;
            }
            this.currentSession.endSpeed = speed;
        }
    }

    /**
     * End current practice session
     * @param {string} notes - Practice notes
     */
    endSession(notes = '') {
        if (this.currentSession) {
            this.currentSession.endTime = Date.now();
            this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;
            this.currentSession.notes = notes;
            this.sessions.push(this.currentSession);
            
            // Save to localStorage
            this._saveSessions();
            
            const session = this.currentSession;
            this.currentSession = null;
            return session;
        }
        return null;
    }

    /**
     * Get total practice time for a project
     * @param {string} projectId - Project ID
     * @returns {number} Total time in milliseconds
     */
    getTotalPracticeTime(projectId) {
        return this.sessions
            .filter(s => s.projectId === projectId)
            .reduce((total, s) => total + s.duration, 0);
    }

    /**
     * Get practice history for a project
     * @param {string} projectId - Project ID
     * @returns {Array} Practice sessions
     */
    getProjectHistory(projectId) {
        return this.sessions.filter(s => s.projectId === projectId);
    }

    /**
     * Save sessions to localStorage
     * @private
     */
    _saveSessions() {
        try {
            localStorage.setItem('snaw_practice_sessions', JSON.stringify(this.sessions));
        } catch (e) {
            console.warn('Failed to save practice sessions:', e);
        }
    }

    /**
     * Load sessions from localStorage
     */
    loadSessions() {
        try {
            const saved = localStorage.getItem('snaw_practice_sessions');
            if (saved) {
                this.sessions = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Failed to load practice sessions:', e);
        }
    }

    /**
     * Clear all practice history
     */
    clearHistory() {
        this.sessions = [];
        localStorage.removeItem('snaw_practice_sessions');
    }
}

/**
 * Practice Statistics Calculator
 */
export class PracticeStats {
    /**
     * Calculate practice statistics
     * @param {Array} sessions - Practice sessions
     * @returns {Object} Statistics
     */
    static calculateStats(sessions) {
        if (sessions.length === 0) {
            return {
                totalSessions: 0,
                totalTime: 0,
                averageSessionTime: 0,
                totalLoops: 0,
                averageLoopsPerSession: 0,
                speedImprovement: 0
            };
        }

        const totalTime = sessions.reduce((sum, s) => sum + s.duration, 0);
        const totalLoops = sessions.reduce((sum, s) => sum + s.loopsCompleted, 0);

        // Calculate speed improvement
        const firstSession = sessions[0];
        const lastSession = sessions[sessions.length - 1];
        const speedImprovement = lastSession.endSpeed - firstSession.startSpeed;

        return {
            totalSessions: sessions.length,
            totalTime,
            averageSessionTime: totalTime / sessions.length,
            totalLoops,
            averageLoopsPerSession: totalLoops / sessions.length,
            speedImprovement
        };
    }

    /**
     * Get practice streak (consecutive days)
     * @param {Array} sessions - Practice sessions
     * @returns {number} Streak in days
     */
    static getPracticeStreak(sessions) {
        if (sessions.length === 0) return 0;

        const days = new Set();
        sessions.forEach(s => {
            const date = new Date(s.startTime).toDateString();
            days.add(date);
        });

        const sortedDays = Array.from(days).sort((a, b) => new Date(b) - new Date(a));
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (const day of sortedDays) {
            const sessionDate = new Date(day);
            sessionDate.setHours(0, 0, 0, 0);
            
            const diffDays = Math.floor((currentDate - sessionDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays === streak) {
                streak++;
            } else if (diffDays > streak) {
                break;
            }
        }

        return streak;
    }
}

// Create singleton instance
export const practiceMode = new PracticeMode();
export const practiceSession = new PracticeSession();

// Load saved sessions
practiceSession.loadSessions();

// Default export
export default {
    PracticeMode,
    PracticeSession,
    PracticeStats,
    practiceMode,
    practiceSession
};