/**
 * Performance Mode Recording - Record performance for playback
 * Allows recording live performance actions for later playback
 */

// Performance Recording State
const perfRecordState = {
    // Recording state
    isRecording: false,
    isPlaying: false,
    recording: null,
    
    // Playback state
    playbackPosition: 0,
    playbackSpeed: 1.0,
    playbackLoop: false,
    playbackTime: 0,
    
    // Recording settings
    recordSceneTriggers: true,
    recordTrackMutes: true,
    recordTrackSolos: true,
    recordVolumeChanges: true,
    recordPanChanges: true,
    recordEffectChanges: true,
    recordTempoChanges: true,
    recordMIDI: true,
    
    // Time settings
    startTime: 0,
    duration: 0,
    
    // Recorded events
    events: [],
    
    // Session management
    sessions: new Map(),
    activeSessionId: null,
    
    // Undo/Redo
    undoStack: [],
    redoStack: [],
    
    // Callbacks
    onEventRecorded: null,
    onPlayback: null,
    onPlaybackComplete: null
};

// Event types that can be recorded
const RECORDABLE_EVENTS = {
    sceneTrigger: {
        name: 'Scene Trigger',
        category: 'scenes',
        priority: 1
    },
    trackMute: {
        name: 'Track Mute',
        category: 'tracks',
        priority: 2
    },
    trackSolo: {
        name: 'Track Solo',
        category: 'tracks',
        priority: 2
    },
    trackVolume: {
        name: 'Track Volume',
        category: 'tracks',
        priority: 3
    },
    trackPan: {
        name: 'Track Pan',
        category: 'tracks',
        priority: 3
    },
    effectParam: {
        name: 'Effect Parameter',
        category: 'effects',
        priority: 4
    },
    effectBypass: {
        name: 'Effect Bypass',
        category: 'effects',
        priority: 4
    },
    tempoChange: {
        name: 'Tempo Change',
        category: 'tempo',
        priority: 1
    },
    midiNote: {
        name: 'MIDI Note',
        category: 'midi',
        priority: 5
    },
    midiCC: {
        name: 'MIDI CC',
        category: 'midi',
        priority: 5
    },
    playPause: {
        name: 'Play/Pause',
        category: 'transport',
        priority: 0
    },
    stop: {
        name: 'Stop',
        category: 'transport',
        priority: 0
    },
    seek: {
        name: 'Seek',
        category: 'transport',
        priority: 1
    }
};

/**
 * Start recording a performance
 */
function startPerformanceRecording(options = {}) {
    if (perfRecordState.isRecording) {
        return { success: false, error: 'Already recording' };
    }
    
    perfRecordState.isRecording = true;
    perfRecordState.events = [];
    perfRecordState.startTime = Date.now();
    perfRecordState.duration = 0;
    
    // Apply options
    Object.assign(perfRecordState, {
        recordSceneTriggers: options.recordSceneTriggers !== false,
        recordTrackMutes: options.recordTrackMutes !== false,
        recordTrackSolos: options.recordTrackSolos !== false,
        recordVolumeChanges: options.recordVolumeChanges !== false,
        recordPanChanges: options.recordPanChanges !== false,
        recordEffectChanges: options.recordEffectChanges !== false,
        recordTempoChanges: options.recordTempoChanges !== false,
        recordMIDI: options.recordMIDI !== false
    });
    
    console.log('[PerformanceRecording] Recording started');
    
    return { 
        success: true, 
        startTime: perfRecordState.startTime 
    };
}

/**
 * Stop recording and save session
 */
function stopPerformanceRecording() {
    if (!perfRecordState.isRecording) {
        return { success: false, error: 'Not recording' };
    }
    
    perfRecordState.isRecording = false;
    perfRecordState.duration = Date.now() - perfRecordState.startTime;
    
    // Create recording object
    perfRecordState.recording = {
        id: `perf_${Date.now()}`,
        name: `Performance ${new Date().toLocaleString()}`,
        startTime: perfRecordState.startTime,
        duration: perfRecordState.duration,
        events: [...perfRecordState.events],
        createdAt: Date.now()
    };
    
    // Add to sessions
    perfRecordState.sessions.set(perfRecordState.recording.id, perfRecordState.recording);
    perfRecordState.activeSessionId = perfRecordState.recording.id;
    
    console.log(`[PerformanceRecording] Recording stopped. Duration: ${perfRecordState.duration}ms, Events: ${perfRecordState.events.length}`);
    
    return {
        success: true,
        recording: perfRecordState.recording
    };
}

/**
 * Record an event
 */
function recordPerformanceEvent(eventType, data) {
    if (!perfRecordState.isRecording) return;
    
    // Check if this event type should be recorded
    const eventConfig = RECORDABLE_EVENTS[eventType];
    if (!eventConfig) {
        console.warn(`[PerformanceRecording] Unknown event type: ${eventType}`);
        return;
    }
    
    // Check recording settings
    if (!shouldRecordEvent(eventType)) return;
    
    const event = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: eventType,
        timestamp: Date.now() - perfRecordState.startTime,
        data: { ...data },
        category: eventConfig.category,
        priority: eventConfig.priority
    };
    
    perfRecordState.events.push(event);
    
    if (perfRecordState.onEventRecorded) {
        perfRecordState.onEventRecorded(event);
    }
    
    return event;
}

/**
 * Check if event type should be recorded based on settings
 */
function shouldRecordEvent(eventType) {
    switch (eventType) {
        case 'sceneTrigger':
            return perfRecordState.recordSceneTriggers;
        case 'trackMute':
        case 'trackSolo':
            return perfRecordState.recordTrackMutes || perfRecordState.recordTrackSolos;
        case 'trackVolume':
            return perfRecordState.recordVolumeChanges;
        case 'trackPan':
            return perfRecordState.recordPanChanges;
        case 'effectParam':
        case 'effectBypass':
            return perfRecordState.recordEffectChanges;
        case 'tempoChange':
            return perfRecordState.recordTempoChanges;
        case 'midiNote':
        case 'midiCC':
            return perfRecordState.recordMIDI;
        default:
            return true;
    }
}

/**
 * Play back a recorded performance
 */
function playPerformanceRecording(sessionId = null) {
    const id = sessionId || perfRecordState.activeSessionId;
    if (!id) {
        return { success: false, error: 'No recording to play' };
    }
    
    const recording = perfRecordState.sessions.get(id);
    if (!recording) {
        return { success: false, error: 'Recording not found' };
    }
    
    if (perfRecordState.isPlaying) {
        stopPerformancePlayback();
    }
    
    perfRecordState.isPlaying = true;
    perfRecordState.playbackPosition = 0;
    perfRecordState.playbackTime = Date.now();
    perfRecordState.events = [...recording.events];
    
    console.log(`[PerformanceRecording] Playback started: ${recording.name}`);
    
    // Start playback loop
    playbackTick();
    
    return { success: true, recording };
}

/**
 * Internal playback tick
 */
function playbackTick() {
    if (!perfRecordState.isPlaying) return;
    
    const elapsed = (Date.now() - perfRecordState.playbackTime) * perfRecordState.playbackSpeed;
    const recording = perfRecordState.sessions.get(perfRecordState.activeSessionId);
    
    if (!recording) {
        stopPerformancePlayback();
        return;
    }
    
    // Find events to execute
    const eventsToExecute = recording.events.filter(event => {
        const eventTime = event.timestamp;
        return eventTime > perfRecordState.playbackPosition && 
               eventTime <= elapsed;
    });
    
    // Execute events in order
    eventsToExecute.sort((a, b) => {
        if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
        return a.priority - b.priority;
    });
    
    for (const event of eventsToExecute) {
        executeEvent(event);
    }
    
    perfRecordState.playbackPosition = elapsed;
    
    // Update progress callback
    if (perfRecordState.onPlayback) {
        perfRecordState.onPlayback({
            position: elapsed,
            duration: recording.duration,
            progress: elapsed / recording.duration
        });
    }
    
    // Check if playback complete
    if (elapsed >= recording.duration) {
        if (perfRecordState.playbackLoop) {
            // Loop playback
            perfRecordState.playbackPosition = 0;
            perfRecordState.playbackTime = Date.now();
        } else {
            stopPerformancePlayback();
            if (perfRecordState.onPlaybackComplete) {
                perfRecordState.onPlaybackComplete();
            }
            return;
        }
    }
    
    // Continue playback
    requestAnimationFrame(playbackTick);
}

/**
 * Execute a recorded event
 */
function executeEvent(event) {
    console.log(`[PerformanceRecording] Executing event: ${event.type}`, event.data);
    
    switch (event.type) {
        case 'sceneTrigger':
            if (window.triggerScene) {
                window.triggerScene(event.data.sceneId, event.data.mode);
            }
            break;
            
        case 'trackMute':
            if (window.setTrackMute) {
                window.setTrackMute(event.data.trackId, event.data.muted);
            }
            break;
            
        case 'trackSolo':
            if (window.setTrackSolo) {
                window.setTrackSolo(event.data.trackId, event.data.soloed);
            }
            break;
            
        case 'trackVolume':
            if (window.setTrackVolume) {
                window.setTrackVolume(event.data.trackId, event.data.volume);
            }
            break;
            
        case 'trackPan':
            if (window.setTrackPan) {
                window.setTrackPan(event.data.trackId, event.data.pan);
            }
            break;
            
        case 'effectParam':
            if (window.setEffectParameter) {
                window.setEffectParameter(
                    event.data.trackId,
                    event.data.effectId,
                    event.data.paramName,
                    event.data.value
                );
            }
            break;
            
        case 'effectBypass':
            if (window.bypassEffect) {
                window.bypassEffect(
                    event.data.trackId,
                    event.data.effectId,
                    event.data.bypassed
                );
            }
            break;
            
        case 'tempoChange':
            if (window.setBPM) {
                window.setBPM(event.data.bpm);
            }
            break;
            
        case 'midiNote':
            if (window.playMIDINote) {
                window.playMIDINote(
                    event.data.note,
                    event.data.velocity,
                    event.data.duration,
                    event.data.channel
                );
            }
            break;
            
        case 'midiCC':
            if (window.sendMIDICC) {
                window.sendMIDICC(
                    event.data.cc,
                    event.data.value,
                    event.data.channel
                );
            }
            break;
            
        case 'playPause':
            if (event.data.playing && window.startPlayback) {
                window.startPlayback();
            } else if (window.pausePlayback) {
                window.pausePlayback();
            }
            break;
            
        case 'stop':
            if (window.stopPlayback) {
                window.stopPlayback();
            }
            break;
            
        case 'seek':
            if (window.seekTo) {
                window.seekTo(event.data.position);
            }
            break;
    }
}

/**
 * Stop playback
 */
function stopPerformancePlayback() {
    perfRecordState.isPlaying = false;
    console.log('[PerformanceRecording] Playback stopped');
    
    return { success: true };
}

/**
 * Pause playback
 */
function pausePerformancePlayback() {
    if (!perfRecordState.isPlaying) return { success: false, error: 'Not playing' };
    
    perfRecordState.isPlaying = false;
    perfRecordState.pausedPosition = perfRecordState.playbackPosition;
    
    return { success: true };
}

/**
 * Resume playback
 */
function resumePerformancePlayback() {
    if (perfRecordState.isPlaying) return { success: false, error: 'Already playing' };
    
    perfRecordState.isPlaying = true;
    perfRecordState.playbackTime = Date.now() - perfRecordState.pausedPosition;
    playbackTick();
    
    return { success: true };
}

/**
 * Set playback speed
 */
function setPerformancePlaybackSpeed(speed) {
    perfRecordState.playbackSpeed = Math.max(0.25, Math.min(4.0, speed));
    return { success: true, speed: perfRecordState.playbackSpeed };
}

/**
 * Set playback loop
 */
function setPerformancePlaybackLoop(loop) {
    perfRecordState.playbackLoop = loop;
    return { success: true, loop: perfRecordState.playbackLoop };
}

/**
 * Seek to position in recording
 */
function seekPerformancePlayback(position) {
    const recording = perfRecordState.sessions.get(perfRecordState.activeSessionId);
    if (!recording) return { success: false, error: 'No active recording' };
    
    const clampedPosition = Math.max(0, Math.min(recording.duration, position));
    
    perfRecordState.playbackPosition = clampedPosition;
    perfRecordState.playbackTime = Date.now() - clampedPosition / perfRecordState.playbackSpeed;
    
    return { success: true, position: clampedPosition };
}

/**
 * Save recording to file
 */
function savePerformanceRecording(sessionId = null) {
    const id = sessionId || perfRecordState.activeSessionId;
    const recording = perfRecordState.sessions.get(id);
    
    if (!recording) {
        return { success: false, error: 'No recording to save' };
    }
    
    const json = JSON.stringify(recording, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `${recording.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
    
    return { success: true, url };
}

/**
 * Load recording from file
 */
function loadPerformanceRecording(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const recording = JSON.parse(e.target.result);
                
                // Validate recording structure
                if (!recording.id || !recording.events) {
                    reject({ success: false, error: 'Invalid recording format' });
                    return;
                }
                
                // Add to sessions
                perfRecordState.sessions.set(recording.id, recording);
                perfRecordState.activeSessionId = recording.id;
                
                resolve({ success: true, recording });
            } catch (error) {
                reject({ success: false, error: 'Failed to parse recording' });
            }
        };
        
        reader.onerror = () => {
            reject({ success: false, error: 'Failed to read file' });
        };
        
        reader.readAsText(file);
    });
}

/**
 * Delete a recording
 */
function deletePerformanceRecording(sessionId) {
    if (perfRecordState.sessions.has(sessionId)) {
        perfRecordState.sessions.delete(sessionId);
        
        if (perfRecordState.activeSessionId === sessionId) {
            perfRecordState.activeSessionId = null;
        }
        
        return { success: true };
    }
    
    return { success: false, error: 'Recording not found' };
}

/**
 * Get all recordings
 */
function getPerformanceRecordings() {
    return Array.from(perfRecordState.sessions.values()).map(rec => ({
        id: rec.id,
        name: rec.name,
        duration: rec.duration,
        eventCount: rec.events.length,
        createdAt: rec.createdAt
    }));
}

/**
 * Get recording details
 */
function getPerformanceRecordingDetails(sessionId) {
    const recording = perfRecordState.sessions.get(sessionId);
    if (!recording) return null;
    
    // Analyze events by category
    const eventCounts = {};
    for (const event of recording.events) {
        eventCounts[event.category] = (eventCounts[event.category] || 0) + 1;
    }
    
    return {
        ...recording,
        eventCounts,
        durationFormatted: formatDuration(recording.duration)
    };
}

/**
 * Format duration
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Undo last event
 */
function undoPerformanceEvent() {
    if (perfRecordState.events.length === 0) return { success: false, error: 'No events to undo' };
    
    const event = perfRecordState.events.pop();
    perfRecordState.undoStack.push(event);
    
    return { success: true, undoneEvent: event };
}

/**
 * Redo event
 */
function redoPerformanceEvent() {
    if (perfRecordState.redoStack.length === 0) return { success: false, error: 'No events to redo' };
    
    const event = perfRecordState.redoStack.pop();
    perfRecordState.events.push(event);
    
    return { success: true, redoneEvent: event };
}

/**
 * Clear all events
 */
function clearPerformanceEvents() {
    perfRecordState.events = [];
    perfRecordState.undoStack = [];
    perfRecordState.redoStack = [];
    
    return { success: true };
}

// Export functions
window.startPerformanceRecording = startPerformanceRecording;
window.stopPerformanceRecording = stopPerformanceRecording;
window.recordPerformanceEvent = recordPerformanceEvent;
window.playPerformanceRecording = playPerformanceRecording;
window.stopPerformancePlayback = stopPerformancePlayback;
window.pausePerformancePlayback = pausePerformancePlayback;
window.resumePerformancePlayback = resumePerformancePlayback;
window.setPerformancePlaybackSpeed = setPerformancePlaybackSpeed;
window.setPerformancePlaybackLoop = setPerformancePlaybackLoop;
window.seekPerformancePlayback = seekPerformancePlayback;
window.savePerformanceRecording = savePerformanceRecording;
window.loadPerformanceRecording = loadPerformanceRecording;
window.deletePerformanceRecording = deletePerformanceRecording;
window.getPerformanceRecordings = getPerformanceRecordings;
window.getPerformanceRecordingDetails = getPerformanceRecordingDetails;
window.undoPerformanceEvent = undoPerformanceEvent;
window.redoPerformanceEvent = redoPerformanceEvent;
window.clearPerformanceEvents = clearPerformanceEvents;
window.perfRecordState = perfRecordState;

console.log('[PerformanceModeRecording] Module loaded');