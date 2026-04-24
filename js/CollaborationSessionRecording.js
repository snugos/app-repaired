/**
 * CollaborationSessionRecording.js
 * Record multi-user collaboration sessions for playback and sharing
 */

class CollaborationSessionRecording {
    constructor() {
        this.isRecording = false;
        this.isPlaying = false;
        this.sessions = [];
        this.currentSession = null;
        this.eventLog = [];
        this.startTime = 0;
        this.playbackTime = 0;
        this.playbackSpeed = 1.0;
        this.loopPlayback = false;
        this.maxEvents = 10000;
        this.eventCallbacks = new Map();
        
        // Event types we record
        this.recordableEvents = [
            'user-join', 'user-leave',
            'track-add', 'track-remove', 'track-modify',
            'clip-add', 'clip-remove', 'clip-move', 'clip-modify',
            'note-add', 'note-remove', 'note-modify',
            'effect-add', 'effect-remove', 'effect-modify',
            'volume-change', 'pan-change', 'mute-toggle', 'solo-toggle',
            'playback-start', 'playback-stop', 'playback-seek',
            'tempo-change', 'time-signature-change',
            'marker-add', 'marker-remove',
            'comment-add', 'comment-remove',
            'cursor-move', 'selection-change'
        ];
        
        // Session metadata
        this.metadata = {
            name: '',
            description: '',
            participants: [],
            duration: 0,
            createdAt: null,
            updatedAt: null
        };
        
        // Playback state
        this.playbackIndex = 0;
        this.playbackTimer = null;
        
        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoLevels = 50;
        
        // Auto-save settings
        this.autoSave = true;
        this.autoSaveInterval = 60000; // 1 minute
        this.autoSaveTimer = null;
        
        this.init();
    }
    
    init() {
        this.loadSessionsFromStorage();
        if (this.autoSave) {
            this.startAutoSave();
        }
    }
    
    // Session Management
    createSession(name, description = '') {
        const session = {
            id: 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: name,
            description: description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            participants: [],
            events: [],
            metadata: {
                totalEvents: 0,
                duration: 0,
                version: '1.0'
            }
        };
        
        this.sessions.push(session);
        this.currentSession = session;
        this.eventLog = [];
        this.saveToStorage();
        
        return session;
    }
    
    loadSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (session) {
            this.currentSession = session;
            this.eventLog = [...session.events];
            return true;
        }
        return false;
    }
    
    deleteSession(sessionId) {
        const index = this.sessions.findIndex(s => s.id === sessionId);
        if (index !== -1) {
            this.sessions.splice(index, 1);
            if (this.currentSession && this.currentSession.id === sessionId) {
                this.currentSession = null;
                this.eventLog = [];
            }
            this.saveToStorage();
            return true;
        }
        return false;
    }
    
    // Recording
    startRecording() {
        if (this.isRecording) return false;
        
        if (!this.currentSession) {
            this.createSession('New Session', 'Recorded collaboration session');
        }
        
        this.isRecording = true;
        this.startTime = Date.now();
        this.eventLog = [];
        
        console.log('[CollabRecording] Recording started');
        this.dispatchEvent('recording-started', { sessionId: this.currentSession.id });
        
        return true;
    }
    
    stopRecording() {
        if (!this.isRecording) return false;
        
        this.isRecording = false;
        const duration = Date.now() - this.startTime;
        
        // Save events to session
        if (this.currentSession) {
            this.currentSession.events = [...this.eventLog];
            this.currentSession.metadata.totalEvents = this.eventLog.length;
            this.currentSession.metadata.duration = duration;
            this.currentSession.updatedAt = new Date().toISOString();
            this.saveToStorage();
        }
        
        console.log(`[CollabRecording] Recording stopped. Duration: ${duration}ms, Events: ${this.eventLog.length}`);
        this.dispatchEvent('recording-stopped', { 
            sessionId: this.currentSession?.id, 
            duration, 
            eventCount: this.eventLog.length 
        });
        
        return true;
    }
    
    // Event Recording
    recordEvent(eventType, data, userId = 'local') {
        if (!this.isRecording) return false;
        if (!this.recordableEvents.includes(eventType)) return false;
        
        const event = {
            id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            type: eventType,
            timestamp: Date.now() - this.startTime,
            wallTime: Date.now(),
            userId: userId,
            data: this.sanitizeData(data),
            undone: false
        };
        
        // Add to event log
        this.eventLog.push(event);
        
        // Limit event log size
        if (this.eventLog.length > this.maxEvents) {
            this.eventLog.shift();
        }
        
        // Add to undo stack
        this.pushToUndoStack(event);
        
        // Dispatch for real-time listeners
        this.dispatchEvent('event-recorded', event);
        
        return true;
    }
    
    sanitizeData(data) {
        // Deep clone and remove sensitive/large data
        const sanitized = JSON.parse(JSON.stringify(data));
        
        // Remove audio buffer data if present
        if (sanitized.buffer) delete sanitized.buffer;
        if (sanitized.audioData) delete sanitized.audioData;
        
        return sanitized;
    }
    
    // Playback
    startPlayback(fromTime = 0) {
        if (this.isPlaying) return false;
        if (!this.currentSession || this.currentSession.events.length === 0) return false;
        
        this.isPlaying = true;
        this.playbackTime = fromTime;
        this.playbackIndex = this.findEventIndexAtTime(fromTime);
        
        console.log(`[CollabRecording] Playback started from ${fromTime}ms`);
        this.dispatchEvent('playback-started', { sessionId: this.currentSession.id, fromTime });
        
        this.playbackLoop();
        return true;
    }
    
    playbackLoop() {
        if (!this.isPlaying || !this.currentSession) return;
        
        const events = this.currentSession.events;
        const speed = this.playbackSpeed;
        
        while (this.playbackIndex < events.length) {
            const event = events[this.playbackIndex];
            const eventTime = event.timestamp / speed;
            
            if (eventTime > this.playbackTime) {
                // Schedule next event
                const waitTime = eventTime - this.playbackTime;
                this.playbackTimer = setTimeout(() => {
                    this.playbackTime += waitTime;
                    this.executeEvent(event);
                    this.playbackIndex++;
                    this.playbackLoop();
                }, waitTime);
                return;
            }
            
            // Execute immediately if behind
            this.executeEvent(event);
            this.playbackIndex++;
        }
        
        // Playback complete
        if (this.loopPlayback) {
            this.stopPlayback();
            this.startPlayback(0);
        } else {
            this.stopPlayback();
        }
    }
    
    executeEvent(event) {
        if (event.undone) return;
        
        // Dispatch event for UI to handle
        this.dispatchEvent('playback-event', event);
        
        // Execute based on event type
        switch (event.type) {
            case 'track-add':
                this.executeTrackAdd(event);
                break;
            case 'track-remove':
                this.executeTrackRemove(event);
                break;
            case 'note-add':
                this.executeNoteAdd(event);
                break;
            case 'volume-change':
                this.executeVolumeChange(event);
                break;
            // ... more handlers
        }
    }
    
    executeTrackAdd(event) {
        // Emit event for track system to handle
        this.dispatchEvent('track-add-playback', event.data);
    }
    
    executeTrackRemove(event) {
        this.dispatchEvent('track-remove-playback', event.data);
    }
    
    executeNoteAdd(event) {
        this.dispatchEvent('note-add-playback', event.data);
    }
    
    executeVolumeChange(event) {
        this.dispatchEvent('volume-change-playback', event.data);
    }
    
    stopPlayback() {
        this.isPlaying = false;
        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }
        
        console.log('[CollabRecording] Playback stopped');
        this.dispatchEvent('playback-stopped', { 
            sessionId: this.currentSession?.id,
            position: this.playbackTime 
        });
    }
    
    pausePlayback() {
        if (!this.isPlaying) return false;
        
        this.isPlaying = false;
        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }
        
        this.dispatchEvent('playback-paused', { position: this.playbackTime });
        return true;
    }
    
    resumePlayback() {
        if (this.isPlaying || !this.currentSession) return false;
        
        return this.startPlayback(this.playbackTime);
    }
    
    seekPlayback(timeMs) {
        this.playbackTime = timeMs;
        this.playbackIndex = this.findEventIndexAtTime(timeMs);
        
        this.dispatchEvent('playback-seeked', { position: timeMs });
    }
    
    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.25, Math.min(4.0, speed));
        this.dispatchEvent('playback-speed-changed', { speed: this.playbackSpeed });
    }
    
    setLoopPlayback(loop) {
        this.loopPlayback = loop;
    }
    
    findEventIndexAtTime(timeMs) {
        const events = this.currentSession?.events || [];
        for (let i = 0; i < events.length; i++) {
            if (events[i].timestamp >= timeMs) {
                return i;
            }
        }
        return events.length;
    }
    
    // Undo/Redo
    pushToUndoStack(event) {
        this.undoStack.push(event);
        if (this.undoStack.length > this.maxUndoLevels) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }
    
    undo() {
        if (this.undoStack.length === 0) return null;
        
        const event = this.undoStack.pop();
        event.undone = true;
        this.redoStack.push(event);
        
        // Find and mark in event log
        const logEvent = this.eventLog.find(e => e.id === event.id);
        if (logEvent) logEvent.undone = true;
        
        this.dispatchEvent('event-undone', event);
        return event;
    }
    
    redo() {
        if (this.redoStack.length === 0) return null;
        
        const event = this.redoStack.pop();
        event.undone = false;
        this.undoStack.push(event);
        
        // Find and unmark in event log
        const logEvent = this.eventLog.find(e => e.id === event.id);
        if (logEvent) logEvent.undone = false;
        
        this.dispatchEvent('event-redone', event);
        return event;
    }
    
    // Participant Management
    addParticipant(userId, name) {
        if (!this.currentSession) return false;
        
        const participant = {
            id: userId,
            name: name,
            joinedAt: Date.now() - this.startTime,
            color: this.generateParticipantColor(userId)
        };
        
        this.currentSession.participants.push(participant);
        this.recordEvent('user-join', { participant });
        
        return true;
    }
    
    removeParticipant(userId) {
        if (!this.currentSession) return false;
        
        const index = this.currentSession.participants.findIndex(p => p.id === userId);
        if (index !== -1) {
            const participant = this.currentSession.participants[index];
            this.currentSession.participants.splice(index, 1);
            this.recordEvent('user-leave', { participant });
            return true;
        }
        return false;
    }
    
    generateParticipantColor(userId) {
        // Generate consistent color from user ID
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 60%)`;
    }
    
    // Event System
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }
    
    off(event, callback) {
        if (this.eventCallbacks.has(event)) {
            const callbacks = this.eventCallbacks.get(event);
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    dispatchEvent(event, data) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`[CollabRecording] Error in callback for ${event}:`, e);
                }
            });
        }
    }
    
    // Storage
    saveToStorage() {
        try {
            const data = {
                sessions: this.sessions,
                currentSessionId: this.currentSession?.id
            };
            localStorage.setItem('collab_sessions', JSON.stringify(data));
        } catch (e) {
            console.error('[CollabRecording] Failed to save to storage:', e);
        }
    }
    
    loadSessionsFromStorage() {
        try {
            const data = localStorage.getItem('collab_sessions');
            if (data) {
                const parsed = JSON.parse(data);
                this.sessions = parsed.sessions || [];
                if (parsed.currentSessionId) {
                    this.loadSession(parsed.currentSessionId);
                }
            }
        } catch (e) {
            console.error('[CollabRecording] Failed to load from storage:', e);
        }
    }
    
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.currentSession) {
                this.saveToStorage();
            }
        }, this.autoSaveInterval);
    }
    
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
    
    // Export/Import
    exportSession(sessionId = null) {
        const session = sessionId 
            ? this.sessions.find(s => s.id === sessionId)
            : this.currentSession;
        
        if (!session) return null;
        
        return JSON.stringify(session, null, 2);
    }
    
    importSession(jsonData) {
        try {
            const session = JSON.parse(jsonData);
            
            // Validate session structure
            if (!session.id || !session.events) {
                throw new Error('Invalid session format');
            }
            
            // Generate new ID to avoid conflicts
            session.id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            session.importedAt = new Date().toISOString();
            
            this.sessions.push(session);
            this.saveToStorage();
            
            return session;
        } catch (e) {
            console.error('[CollabRecording] Failed to import session:', e);
            return null;
        }
    }
    
    // Session Statistics
    getSessionStats(sessionId = null) {
        const session = sessionId 
            ? this.sessions.find(s => s.id === sessionId)
            : this.currentSession;
        
        if (!session) return null;
        
        const events = session.events;
        const stats = {
            totalEvents: events.length,
            duration: session.metadata.duration,
            participantCount: session.participants.length,
            eventTypeCounts: {},
            eventsPerMinute: 0,
            eventsPerParticipant: {}
        };
        
        // Count event types
        events.forEach(event => {
            stats.eventTypeCounts[event.type] = (stats.eventTypeCounts[event.type] || 0) + 1;
            stats.eventsPerParticipant[event.userId] = (stats.eventsPerParticipant[event.userId] || 0) + 1;
        });
        
        // Calculate events per minute
        const durationMinutes = stats.duration / 60000;
        stats.eventsPerMinute = durationMinutes > 0 ? stats.totalEvents / durationMinutes : 0;
        
        return stats;
    }
    
    // UI Panel
    openPanel() {
        // Remove existing panel
        const existing = document.getElementById('collab-recording-panel');
        if (existing) existing.remove();
        
        const panel = document.createElement('div');
        panel.id = 'collab-recording-panel';
        panel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            max-height: 80vh;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            color: white;
            font-family: system-ui;
            z-index: 10000;
            overflow: hidden;
        `;
        
        panel.innerHTML = `
            <div style="padding: 16px; border-bottom: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 18px;">Collaboration Session Recording</h3>
                    <button id="close-collab-panel" style="background: transparent; border: none; color: #888; font-size: 20px; cursor: pointer;">×</button>
                </div>
            </div>
            
            <div style="padding: 16px; max-height: 60vh; overflow-y: auto;">
                <!-- Recording Controls -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Recording</h4>
                    <div style="display: flex; gap: 8px;">
                        <button id="start-recording-btn" class="collab-btn" style="flex: 1; padding: 12px; background: ${this.isRecording ? '#666' : '#10b981'}; border: none; color: white; border-radius: 4px; cursor: pointer;" ${this.isRecording ? 'disabled' : ''}>
                            ${this.isRecording ? '● Recording...' : '● Start Recording'}
                        </button>
                        <button id="stop-recording-btn" class="collab-btn" style="flex: 1; padding: 12px; background: ${this.isRecording ? '#ef4444' : '#666'}; border: none; color: white; border-radius: 4px; cursor: pointer;" ${!this.isRecording ? 'disabled' : ''}>
                            Stop Recording
                        </button>
                    </div>
                </div>
                
                <!-- Playback Controls -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Playback</h4>
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <button id="play-btn" class="collab-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                            ▶ Play
                        </button>
                        <button id="pause-btn" class="collab-btn" style="flex: 1; padding: 12px; background: #f59e0b; border: none; color: white; border-radius: 4px; cursor: pointer;">
                            ⏸ Pause
                        </button>
                        <button id="stop-btn" class="collab-btn" style="flex: 1; padding: 12px; background: #6b7280; border: none; color: white; border-radius: 4px; cursor: pointer;">
                            ⏹ Stop
                        </button>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <label style="font-size: 12px; color: #888;">Speed:</label>
                        <input type="range" id="playback-speed" min="0.25" max="4" step="0.25" value="${this.playbackSpeed}" style="flex: 1;">
                        <span id="speed-value" style="font-size: 12px;">${this.playbackSpeed}x</span>
                    </div>
                    
                    <div style="margin-top: 8px;">
                        <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                            <input type="checkbox" id="loop-playback" ${this.loopPlayback ? 'checked' : ''}>
                            Loop playback
                        </label>
                    </div>
                </div>
                
                <!-- Sessions List -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #888;">Sessions (${this.sessions.length})</h4>
                    <div id="sessions-list" style="max-height: 200px; overflow-y: auto;">
                        ${this.renderSessionsList()}
                    </div>
                </div>
                
                <!-- Current Session Info -->
                <div id="session-info" style="background: #0a0a14; padding: 12px; border-radius: 4px;">
                    ${this.renderSessionInfo()}
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupPanelEvents();
    }
    
    renderSessionsList() {
        if (this.sessions.length === 0) {
            return '<div style="color: #666; font-size: 12px;">No sessions recorded yet</div>';
        }
        
        return this.sessions.map(session => `
            <div class="session-item" data-id="${session.id}" style="
                padding: 8px;
                margin-bottom: 4px;
                background: ${this.currentSession?.id === session.id ? '#2a2a4e' : '#0a0a14'};
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div>
                    <div style="font-size: 13px;">${session.name}</div>
                    <div style="font-size: 10px; color: #888;">
                        ${session.events.length} events • ${Math.round(session.metadata.duration / 1000)}s
                    </div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="load-session-btn" data-id="${session.id}" style="padding: 4px 8px; background: #3b82f6; border: none; color: white; border-radius: 2px; font-size: 10px; cursor: pointer;">Load</button>
                    <button class="export-session-btn" data-id="${session.id}" style="padding: 4px 8px; background: #10b981; border: none; color: white; border-radius: 2px; font-size: 10px; cursor: pointer;">Export</button>
                    <button class="delete-session-btn" data-id="${session.id}" style="padding: 4px 8px; background: #ef4444; border: none; color: white; border-radius: 2px; font-size: 10px; cursor: pointer;">Delete</button>
                </div>
            </div>
        `).join('');
    }
    
    renderSessionInfo() {
        if (!this.currentSession) {
            return '<div style="color: #666; font-size: 12px;">No session selected</div>';
        }
        
        const stats = this.getSessionStats();
        
        return `
            <div style="font-size: 12px;">
                <div style="font-weight: bold; margin-bottom: 8px;">${this.currentSession.name}</div>
                <div style="color: #888; margin-bottom: 4px;">${this.currentSession.description || 'No description'}</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
                    <div><span style="color: #888;">Events:</span> ${stats.totalEvents}</div>
                    <div><span style="color: #888;">Duration:</span> ${Math.round(stats.duration / 1000)}s</div>
                    <div><span style="color: #888;">Participants:</span> ${stats.participantCount}</div>
                    <div><span style="color: #888;">Events/min:</span> ${stats.eventsPerMinute.toFixed(1)}</div>
                </div>
            </div>
        `;
    }
    
    setupPanelEvents() {
        const panel = document.getElementById('collab-recording-panel');
        if (!panel) return;
        
        // Close button
        panel.querySelector('#close-collab-panel').onclick = () => panel.remove();
        
        // Recording buttons
        panel.querySelector('#start-recording-btn').onclick = () => {
            this.startRecording();
            this.openPanel(); // Refresh
        };
        
        panel.querySelector('#stop-recording-btn').onclick = () => {
            this.stopRecording();
            this.openPanel(); // Refresh
        };
        
        // Playback buttons
        panel.querySelector('#play-btn').onclick = () => this.startPlayback();
        panel.querySelector('#pause-btn').onclick = () => this.pausePlayback();
        panel.querySelector('#stop-btn').onclick = () => this.stopPlayback();
        
        // Speed control
        const speedSlider = panel.querySelector('#playback-speed');
        const speedValue = panel.querySelector('#speed-value');
        speedSlider.oninput = () => {
            const speed = parseFloat(speedSlider.value);
            this.setPlaybackSpeed(speed);
            speedValue.textContent = speed + 'x';
        };
        
        // Loop checkbox
        panel.querySelector('#loop-playback').onchange = (e) => {
            this.setLoopPlayback(e.target.checked);
        };
        
        // Session list buttons
        panel.querySelectorAll('.load-session-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.loadSession(btn.dataset.id);
                this.openPanel(); // Refresh
            };
        });
        
        panel.querySelectorAll('.export-session-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const json = this.exportSession(btn.dataset.id);
                if (json) {
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `collab-session-${btn.dataset.id}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            };
        });
        
        panel.querySelectorAll('.delete-session-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                if (confirm('Delete this session?')) {
                    this.deleteSession(btn.dataset.id);
                    this.openPanel(); // Refresh
                }
            };
        });
    }
    
    closePanel() {
        const panel = document.getElementById('collab-recording-panel');
        if (panel) panel.remove();
    }
    
    // Cleanup
    dispose() {
        this.stopRecording();
        this.stopPlayback();
        this.stopAutoSave();
        this.closePanel();
        this.eventCallbacks.clear();
    }
}

// Export singleton instance
const collaborationSessionRecording = new CollaborationSessionRecording();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CollaborationSessionRecording, collaborationSessionRecording };
}