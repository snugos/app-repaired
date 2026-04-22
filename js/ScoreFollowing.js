// js/ScoreFollowing.js - Score Following and Automatic Page Turning
// This module provides score following functionality for live performance

/**
 * ScoreFollowingMode - Different following modes
 */
export const ScoreFollowingMode = {
    MANUAL: 'manual',         // Manual page turning
    AUTOMATIC: 'automatic',   // Automatic following based on time
    AUDIO_SYNC: 'audio_sync', // Follow along with audio playback
    MIDI_SYNC: 'midi_sync',   // Follow along with MIDI input
    NETWORK_SYNC: 'network'   // Follow network sync (for ensembles)
};

/**
 * PageTurnDirection - Direction for page turning
 */
export const PageTurnDirection = {
    NEXT: 'next',
    PREVIOUS: 'previous',
    FIRST: 'first',
    LAST: 'last'
};

/**
 * CursorPosition - Represents the current cursor position
 */
export class CursorPosition {
    constructor(config = {}) {
        this.page = config.page || 1;
        this.system = config.system || 1;
        this.measure = config.measure || 1;
        this.beat = config.beat || 1;
        this.time = config.time || 0; // Seconds from start
        this.timestamp = config.timestamp || Date.now();
    }

    toJSON() {
        return { ...this };
    }

    static fromJSON(data) {
        return new CursorPosition(data);
    }

    /**
     * Compare positions
     */
    compare(other) {
        if (this.page !== other.page) return this.page - other.page;
        if (this.system !== other.system) return this.system - other.system;
        if (this.measure !== other.measure) return this.measure - other.measure;
        return this.beat - other.beat;
    }

    /**
     * Clone position
     */
    clone() {
        return new CursorPosition(this);
    }
}

/**
 * ScoreBookmark - Bookmark in a score
 */
export class ScoreBookmark {
    constructor(config = {}) {
        this.id = config.id || `bookmark-${Date.now()}`;
        this.name = config.name || 'Bookmark';
        this.position = config.position || new CursorPosition();
        this.color = config.color || '#ff0000';
        this.note = config.note || '';
        this.createdAt = config.createdAt || Date.now();
    }

    toJSON() {
        return {
            ...this,
            position: this.position.toJSON()
        };
    }

    static fromJSON(data) {
        return new ScoreBookmark({
            ...data,
            position: CursorPosition.fromJSON(data.position)
        });
    }
}

/**
 * PageLayout - Represents a page layout in the score
 */
export class PageLayout {
    constructor(config = {}) {
        this.pageNumber = config.pageNumber || 1;
        this.systems = config.systems || [];
        this.measures = config.measures || [];
        this.startTime = config.startTime || 0;
        this.endTime = config.endTime || 0;
    }

    toJSON() {
        return { ...this };
    }

    static fromJSON(data) {
        return new PageLayout(data);
    }
}

/**
 * ScoreFollower - Main score following engine
 */
export class ScoreFollower {
    constructor(config = {}) {
        this.mode = config.mode || ScoreFollowingMode.AUTOMATIC;
        this.currentPage = 1;
        this.totalPages = config.totalPages || 1;
        this.currentPosition = new CursorPosition();
        this.positionHistory = [];
        this.maxHistoryLength = config.maxHistoryLength || 100;
        this.pageLayouts = config.pageLayouts || [];
        this.bookmarks = config.bookmarks || [];
        this.isAutoScrollEnabled = config.isAutoScrollEnabled !== false;
        this.isRehearsalMode = config.isRehearsalMode || false;
        this.pageTurnAdvanceTime = config.pageTurnAdvanceTime || 3; // Seconds before page turn
        this.onPageChange = config.onPageChange || null;
        this.onPositionChange = config.onPositionChange || null;
        this.onPageTurnWarning = config.onPageTurnWarning || null;
        this.isPlaying = false;
        this.playbackStartTime = 0;
        this.playbackOffset = 0;
        this.animationFrameId = null;
        this.tempo = config.tempo || 120;
        this.timeSignature = config.timeSignature || [4, 4];
        this.lastPageTurnTime = 0;
        this.vibrateOnPageTurn = config.vibrateOnPageTurn || false;
        this.audioWarningEnabled = config.audioWarningEnabled || false;
        this.audioWarningTime = config.audioWarningTime || 5; // Seconds before turn
        this.audioWarningSound = null;
    }

    /**
     * Initialize the score follower
     * @param {Object} scoreData - Score data with pages and measures
     */
    initialize(scoreData) {
        this.totalPages = scoreData.totalPages || 1;
        this.tempo = scoreData.tempo || 120;
        this.timeSignature = scoreData.timeSignature || [4, 4];
        
        // Build page layouts from score data
        if (scoreData.pages) {
            this.pageLayouts = scoreData.pages.map((page, idx) => new PageLayout({
                pageNumber: idx + 1,
                systems: page.systems || [],
                measures: page.measures || [],
                startTime: page.startTime || 0,
                endTime: page.endTime || 0
            }));
        }
        
        // Calculate measure timings if not provided
        if (this.pageLayouts.length > 0 && this.pageLayouts[0].startTime === 0) {
            this._calculateMeasureTimings();
        }

        this.currentPage = 1;
        this.currentPosition = new CursorPosition({ page: 1 });
        this.positionHistory = [];

        console.log('[ScoreFollower] Initialized:', {
            totalPages: this.totalPages,
            tempo: this.tempo,
            mode: this.mode
        });
    }

    /**
     * Calculate measure timings based on tempo
     * @private
     */
    _calculateMeasureTimings() {
        const secondsPerBeat = 60 / this.tempo;
        const beatsPerMeasure = this.timeSignature[0];
        const secondsPerMeasure = secondsPerBeat * beatsPerMeasure;
        
        let currentTime = 0;
        let measureNumber = 1;
        
        for (const page of this.pageLayouts) {
            page.startTime = currentTime;
            const measuresOnPage = page.measures.length || this._estimateMeasuresPerPage(page);
            page.endTime = currentTime + (measuresOnPage * secondsPerMeasure);
            
            for (let m = 0; m < measuresOnPage; m++) {
                page.measures.push({
                    number: measureNumber,
                    startTime: currentTime,
                    endTime: currentTime + secondsPerMeasure
                });
                currentTime += secondsPerMeasure;
                measureNumber++;
            }
        }
    }

    /**
     * Estimate measures per page
     * @private
     */
    _estimateMeasuresPerPage(page) {
        return page.systems?.length ? page.systems.length * 4 : 8;
    }

    /**
     * Set the following mode
     * @param {string} mode - Following mode
     */
    setMode(mode) {
        this.mode = mode;
        console.log(`[ScoreFollower] Mode set to: ${mode}`);
    }

    /**
     * Get current mode
     * @returns {string} Current mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Start score following (begin playback)
     * @param {number} startTime - Start time in seconds
     */
    start(startTime = 0) {
        this.isPlaying = true;
        this.playbackStartTime = Date.now();
        this.playbackOffset = startTime * 1000; // Convert to ms
        
        // Find position at start time
        this._updatePositionFromTime(startTime);
        
        // Start animation frame loop for automatic following
        if (this.mode === ScoreFollowingMode.AUTOMATIC || this.mode === ScoreFollowingMode.AUDIO_SYNC) {
            this._startFollowingLoop();
        }

        console.log(`[ScoreFollower] Started at: ${startTime}s`);
    }

    /**
     * Stop score following
     */
    stop() {
        this.isPlaying = false;
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        console.log('[ScoreFollower] Stopped');
    }

    /**
     * Resume from current position
     */
    resume() {
        if (!this.isPlaying) {
            const currentTime = this.currentPosition.time;
            this.start(currentTime);
        }
    }

    /**
     * Update position from current playback time
     * @private
     */
    _startFollowingLoop() {
        const loop = () => {
            if (!this.isPlaying) return;
            
            const elapsed = (Date.now() - this.playbackStartTime + this.playbackOffset) / 1000;
            this._updatePositionFromTime(elapsed);
            
            // Check for page turn warning
            this._checkPageTurnWarning(elapsed);
            
            this.animationFrameId = requestAnimationFrame(loop);
        };
        
        this.animationFrameId = requestAnimationFrame(loop);
    }

    /**
     * Update position from elapsed time
     * @private
     */
    _updatePositionFromTime(elapsed) {
        // Find current page based on time
        const newPage = this._findPageForTime(elapsed);
        
        if (newPage !== this.currentPage) {
            this._turnToPage(newPage, PageTurnDirection.NEXT);
        }
        
        // Update position
        const newPosition = new CursorPosition({
            page: newPage,
            time: elapsed,
            timestamp: Date.now()
        });
        
        // Find measure and beat
        const pageInfo = this.pageLayouts[newPage - 1];
        if (pageInfo) {
            const measure = pageInfo.measures.find(m => 
                elapsed >= m.startTime && elapsed < m.endTime
            );
            if (measure) {
                newPosition.measure = measure.number;
                const measureElapsed = elapsed - measure.startTime;
                const secondsPerBeat = 60 / this.tempo;
                newPosition.beat = Math.floor(measureElapsed / secondsPerBeat) + 1;
            }
        }
        
        this.currentPosition = newPosition;
        this._recordHistory(newPosition);
        
        if (this.onPositionChange) {
            this.onPositionChange(newPosition);
        }
    }

    /**
     * Find page for a given time
     * @private
     */
    _findPageForTime(time) {
        for (let i = 0; i < this.pageLayouts.length; i++) {
            const page = this.pageLayouts[i];
            if (time >= page.startTime && time < page.endTime) {
                return i + 1;
            }
        }
        return this.totalPages;
    }

    /**
     * Check if we should warn about upcoming page turn
     * @private
     */
    _checkPageTurnWarning(currentTime) {
        const currentPageLayout = this.pageLayouts[this.currentPage - 1];
        if (!currentPageLayout) return;
        
        const timeUntilEnd = currentPageLayout.endTime - currentTime;
        
        // Page turn warning
        if (timeUntilEnd <= this.pageTurnAdvanceTime && timeUntilEnd > 0) {
            if (this.onPageTurnWarning) {
                this.onPageTurnWarning({
                    timeUntilTurn: timeUntilEnd,
                    nextPage: this.currentPage + 1
                });
            }
            
            // Audio warning
            if (this.audioWarningEnabled && timeUntilEnd <= this.audioWarningTime) {
                this._playWarningSound();
            }
        }
    }

    /**
     * Play warning sound
     * @private
     */
    _playWarningSound() {
        if (!this.audioWarningSound) {
            // Create a simple beep using Web Audio
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.1;
                
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
                
                this.audioWarningSound = { audioContext, oscillator, gainNode };
            } catch (e) {
                console.warn('[ScoreFollower] Could not create warning sound');
            }
        }
    }

    /**
     * Turn to a specific page
     * @param {number} pageNumber - Page number to turn to
     * @param {string} direction - Turn direction
     */
    _turnToPage(pageNumber, direction = PageTurnDirection.NEXT) {
        const oldPage = this.currentPage;
        this.currentPage = pageNumber;
        
        // Vibrate on page turn (for tablets)
        if (this.vibrateOnPageTurn && navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        // Record history
        this._recordHistory(this.currentPosition.clone());
        
        // Callback
        if (this.onPageChange) {
            this.onPageChange({
                oldPage,
                newPage: pageNumber,
                direction,
                timestamp: Date.now()
            });
        }

        console.log(`[ScoreFollower] Turned to page ${pageNumber}`);
    }

    /**
     * Go to next page
     */
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this._turnToPage(this.currentPage + 1, PageTurnDirection.NEXT);
        }
    }

    /**
     * Go to previous page
     */
    previousPage() {
        if (this.currentPage > 1) {
            this._turnToPage(this.currentPage - 1, PageTurnDirection.PREVIOUS);
        }
    }

    /**
     * Go to first page
     */
    firstPage() {
        this._turnToPage(1, PageTurnDirection.FIRST);
    }

    /**
     * Go to last page
     */
    lastPage() {
        this._turnToPage(this.totalPages, PageTurnDirection.LAST);
    }

    /**
     * Go to specific page
     * @param {number} pageNumber - Page number
     */
    goToPage(pageNumber) {
        if (pageNumber >= 1 && pageNumber <= this.totalPages) {
            this._turnToPage(pageNumber);
        }
    }

    /**
     * Go to specific measure
     * @param {number} measureNumber - Measure number
     */
    goToMeasure(measureNumber) {
        // Find page containing measure
        for (let i = 0; i < this.pageLayouts.length; i++) {
            const page = this.pageLayouts[i];
            const measure = page.measures.find(m => m.number === measureNumber);
            if (measure) {
                this.goToPage(i + 1);
                this._updatePositionFromTime(measure.startTime);
                return;
            }
        }
    }

    /**
     * Go to bookmark
     * @param {string} bookmarkId - Bookmark ID
     */
    goToBookmark(bookmarkId) {
        const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
        if (bookmark) {
            this.goToPage(bookmark.position.page);
            this.currentPosition = bookmark.position.clone();
            if (this.onPositionChange) {
                this.onPositionChange(this.currentPosition);
            }
        }
    }

    /**
     * Add bookmark at current position
     * @param {string} name - Bookmark name
     * @param {string} note - Optional note
     * @returns {ScoreBookmark} Created bookmark
     */
    addBookmark(name, note = '') {
        const bookmark = new ScoreBookmark({
            name,
            note,
            position: this.currentPosition.clone()
        });
        this.bookmarks.push(bookmark);
        return bookmark;
    }

    /**
     * Remove bookmark
     * @param {string} bookmarkId - Bookmark ID
     */
    removeBookmark(bookmarkId) {
        const index = this.bookmarks.findIndex(b => b.id === bookmarkId);
        if (index !== -1) {
            this.bookmarks.splice(index, 1);
        }
    }

    /**
     * Get all bookmarks
     * @returns {ScoreBookmark[]} Array of bookmarks
     */
    getBookmarks() {
        return [...this.bookmarks];
    }

    /**
     * Record position in history
     * @private
     */
    _recordHistory(position) {
        this.positionHistory.push(position);
        if (this.positionHistory.length > this.maxHistoryLength) {
            this.positionHistory.shift();
        }
    }

    /**
     * Go back in history
     * @param {number} steps - Number of steps to go back
     */
    goBack(steps = 1) {
        if (this.positionHistory.length > steps) {
            this.positionHistory.splice(-steps);
            const lastPosition = this.positionHistory[this.positionHistory.length - 1];
            if (lastPosition) {
                this.goToPage(lastPosition.page);
                this.currentPosition = lastPosition.clone();
            }
        }
    }

    /**
     * Get current page
     * @returns {number} Current page number
     */
    getCurrentPage() {
        return this.currentPage;
    }

    /**
     * Get current position
     * @returns {CursorPosition} Current position
     */
    getCurrentPosition() {
        return this.currentPosition.clone();
    }

    /**
     * Get total pages
     * @returns {number} Total pages
     */
    getTotalPages() {
        return this.totalPages;
    }

    /**
     * Set tempo
     * @param {number} tempo - New tempo in BPM
     */
    setTempo(tempo) {
        this.tempo = tempo;
        // Recalculate timings if needed
        this._calculateMeasureTimings();
    }

    /**
     * Sync with external time source
     * @param {number} time - Current time in seconds
     */
    syncTime(time) {
        if (this.mode === ScoreFollowingMode.AUDIO_SYNC || 
            this.mode === ScoreFollowingMode.NETWORK_SYNC) {
            this.playbackOffset = time * 1000;
            this.playbackStartTime = Date.now();
            this._updatePositionFromTime(time);
        }
    }

    /**
     * Handle MIDI input for MIDI sync mode
     * @param {Object} midiEvent - MIDI event
     */
    handleMidiInput(midiEvent) {
        if (this.mode === ScoreFollowingMode.MIDI_SYNC) {
            // Use MIDI clock or note events to determine position
            if (midiEvent.type === 'clock') {
                // MIDI clock tick - advance position
                this._advanceByMidiClock();
            } else if (midiEvent.type === 'start') {
                this.start(0);
            } else if (midiEvent.type === 'stop') {
                this.stop();
            } else if (midiEvent.type === 'position') {
                // MIDI position pointer
                this._setPositionFromMidi(midiEvent.position);
            }
        }
    }

    /**
     * Advance position by MIDI clock
     * @private
     */
    _advanceByMidiClock() {
        // 24 MIDI clocks per quarter note
        const clocksPerBeat = 24;
        const secondsPerBeat = 60 / this.tempo;
        const secondsPerClock = secondsPerBeat / clocksPerBeat;
        
        const newTime = this.currentPosition.time + secondsPerClock;
        this._updatePositionFromTime(newTime);
    }

    /**
     * Set position from MIDI position
     * @private
     */
    _setPositionFromMidi(position) {
        // MIDI position is in beats
        const secondsPerBeat = 60 / this.tempo;
        const time = position * secondsPerBeat;
        this._updatePositionFromTime(time);
    }

    /**
     * Serialize state
     * @returns {Object} Serialized state
     */
    toJSON() {
        return {
            mode: this.mode,
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            currentPosition: this.currentPosition.toJSON(),
            bookmarks: this.bookmarks.map(b => b.toJSON()),
            tempo: this.tempo,
            timeSignature: this.timeSignature,
            pageTurnAdvanceTime: this.pageTurnAdvanceTime,
            isAutoScrollEnabled: this.isAutoScrollEnabled,
            vibrateOnPageTurn: this.vibrateOnPageTurn,
            audioWarningEnabled: this.audioWarningEnabled
        };
    }

    /**
     * Restore from serialized state
     * @param {Object} data - Serialized state
     */
    fromJSON(data) {
        this.mode = data.mode || this.mode;
        this.currentPage = data.currentPage || 1;
        this.totalPages = data.totalPages || this.totalPages;
        this.currentPosition = CursorPosition.fromJSON(data.currentPosition || {});
        this.bookmarks = (data.bookmarks || []).map(b => ScoreBookmark.fromJSON(b));
        this.tempo = data.tempo || 120;
        this.timeSignature = data.timeSignature || [4, 4];
        this.pageTurnAdvanceTime = data.pageTurnAdvanceTime || 3;
        this.isAutoScrollEnabled = data.isAutoScrollEnabled !== false;
        this.vibrateOnPageTurn = data.vibrateOnPageTurn || false;
        this.audioWarningEnabled = data.audioWarningEnabled || false;
    }

    /**
     * Create UI panel for score following
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement} Panel element
     */
    createUI(container) {
        const panel = document.createElement('div');
        panel.className = 'score-following-panel';
        panel.innerHTML = `
            <div class="sf-header">
                <h3>Score Following</h3>
            </div>
            <div class="sf-content">
                <div class="sf-controls">
                    <button class="sf-btn" id="sf-first" title="First Page">⏮</button>
                    <button class="sf-btn" id="sf-prev" title="Previous Page">◀</button>
                    <span class="sf-page-display">Page <span id="sf-current">1</span> / <span id="sf-total">${this.totalPages}</span></span>
                    <button class="sf-btn" id="sf-next" title="Next Page">▶</button>
                    <button class="sf-btn" id="sf-last" title="Last Page">⏭</button>
                </div>
                
                <div class="sf-position">
                    <label>Position:</label>
                    <input type="number" id="sf-position" min="1" max="${this.totalPages}" value="${this.currentPage}">
                </div>
                
                <div class="sf-mode">
                    <label>Mode:</label>
                    <select id="sf-mode-select">
                        <option value="manual">Manual</option>
                        <option value="automatic" selected>Automatic</option>
                        <option value="audio_sync">Audio Sync</option>
                        <option value="midi_sync">MIDI Sync</option>
                    </select>
                </div>
                
                <div class="sf-settings">
                    <div class="sf-setting">
                        <label>Page Turn Warning (sec):</label>
                        <input type="number" id="sf-warning-time" value="${this.pageTurnAdvanceTime}" min="1" max="10">
                    </div>
                    
                    <div class="sf-setting checkbox">
                        <input type="checkbox" id="sf-vibrate" ${this.vibrateOnPageTurn ? 'checked' : ''}>
                        <label>Vibrate on Page Turn</label>
                    </div>
                    
                    <div class="sf-setting checkbox">
                        <input type="checkbox" id="sf-audio-warning" ${this.audioWarningEnabled ? 'checked' : ''}>
                        <label>Audio Warning</label>
                    </div>
                </div>
                
                <div class="sf-bookmarks">
                    <h4>Bookmarks</h4>
                    <div id="sf-bookmark-list" class="sf-bookmark-list"></div>
                    <button class="sf-btn sf-add-bookmark" id="sf-add-bookmark">+ Add Bookmark</button>
                </div>
            </div>
        `;

        // Add event listeners
        panel.querySelector('#sf-first').addEventListener('click', () => this.firstPage());
        panel.querySelector('#sf-prev').addEventListener('click', () => this.previousPage());
        panel.querySelector('#sf-next').addEventListener('click', () => this.nextPage());
        panel.querySelector('#sf-last').addEventListener('click', () => this.lastPage());
        
        panel.querySelector('#sf-position').addEventListener('change', (e) => {
            this.goToPage(parseInt(e.target.value, 10));
        });
        
        panel.querySelector('#sf-mode-select').addEventListener('change', (e) => {
            this.setMode(e.target.value);
        });
        
        panel.querySelector('#sf-warning-time').addEventListener('change', (e) => {
            this.pageTurnAdvanceTime = parseInt(e.target.value, 10);
        });
        
        panel.querySelector('#sf-vibrate').addEventListener('change', (e) => {
            this.vibrateOnPageTurn = e.target.checked;
        });
        
        panel.querySelector('#sf-audio-warning').addEventListener('change', (e) => {
            this.audioWarningEnabled = e.target.checked;
        });
        
        panel.querySelector('#sf-add-bookmark').addEventListener('click', () => {
            const name = prompt('Bookmark name:');
            if (name) {
                this.addBookmark(name);
                this._updateBookmarkList(panel);
            }
        });

        // Set up page change callback to update UI
        this.onPageChange = (data) => {
            panel.querySelector('#sf-current').textContent = data.newPage;
            panel.querySelector('#sf-position').value = data.newPage;
        };

        if (container) {
            container.appendChild(panel);
        }

        return panel;
    }

    /**
     * Update bookmark list in UI
     * @private
     */
    _updateBookmarkList(panel) {
        const list = panel.querySelector('#sf-bookmark-list');
        list.innerHTML = this.bookmarks.map(b => `
            <div class="sf-bookmark-item" data-id="${b.id}">
                <span class="sf-bookmark-name">${b.name}</span>
                <span class="sf-bookmark-page">Page ${b.position.page}</span>
                <button class="sf-bookmark-goto">Go</button>
                <button class="sf-bookmark-delete">×</button>
            </div>
        `).join('');
        
        // Add click handlers
        list.querySelectorAll('.sf-bookmark-goto').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.sf-bookmark-item').dataset.id;
                this.goToBookmark(id);
            });
        });
        
        list.querySelectorAll('.sf-bookmark-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.sf-bookmark-item').dataset.id;
                this.removeBookmark(id);
                this._updateBookmarkList(panel);
            });
        });
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.stop();
        this.onPageChange = null;
        this.onPositionChange = null;
        this.onPageTurnWarning = null;
        
        if (this.audioWarningSound) {
            this.audioWarningSound = null;
        }
    }
}

// Create singleton instance
export const scoreFollower = new ScoreFollower();

// Default export
export default {
    ScoreFollowingMode,
    PageTurnDirection,
    CursorPosition,
    ScoreBookmark,
    PageLayout,
    ScoreFollower,
    scoreFollower
};