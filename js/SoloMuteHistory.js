// SnugOS DAW - Track Solo/Mute History
// Allows undoing solo/mute actions

const soloMuteHistory = {
    undoStack: [],
    maxSize: 50,
    
    record(action) {
        this.undoStack.push({
            ...action,
            timestamp: Date.now()
        });
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
    },
    
    undo() {
        if (this.undoStack.length === 0) return null;
        return this.undoStack.pop();
    },
    
    clear() {
        this.undoStack = [];
    },
    
    getLast() {
        return this.undoStack[this.undoStack.length - 1] || null;
    }
};

function recordSoloMute(trackId, type, previousState) {
    soloMuteHistory.record({
        trackId,
        type, // 'solo' | 'mute'
        previousState,
        action: 'change'
    });
}

function undoLastSoloMute() {
    const last = soloMuteHistory.undo();
    if (!last) return false;
    
    const track = getTrackById(last.trackId);
    if (!track) return false;
    
    if (last.type === 'solo') {
        track.solo = last.previousState;
    } else if (last.type === 'mute') {
        track.muted = last.previousState;
    }
    
    updateAllTrackVisuals();
    renderMixer();
    return true;
}

window.undoLastSoloMute = undoLastSoloMute;
window.soloMuteHistory = soloMuteHistory;