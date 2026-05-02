/**
 * SnawQuickLaunch - Quick launcher for frequently used actions
 * Provides keyboard-driven access to common DAW functions
 */

class SnawQuickLaunch {
    constructor() {
        this.actions = new Map();
        this.categories = new Map();
        this.maxResults = 8;
        this.init();
    }

    init() {
        this.registerDefaultActions();
        window.snawQuickLaunch = this;
    }

    registerDefaultActions() {
        const defaultActions = [
            // File operations
            { id: 'newProject', label: 'New Project', category: 'File', shortcut: 'Ctrl+N', action: () => this.executeNewProject() },
            { id: 'saveProject', label: 'Save Project', category: 'File', shortcut: 'Ctrl+S', action: () => this.executeSaveProject() },
            { id: 'exportAudio', label: 'Export Audio', category: 'File', shortcut: 'Ctrl+Shift+E', action: () => this.executeExportAudio() },

            // Transport
            { id: 'playPause', label: 'Play / Pause', category: 'Transport', shortcut: 'Space', action: () => this.executePlayPause() },
            { id: 'stop', label: 'Stop', category: 'Transport', shortcut: 'Enter', action: () => this.executeStop() },
            { id: 'rewind', label: 'Rewind to Start', category: 'Transport', shortcut: 'Home', action: () => this.executeRewind() },
            { id: 'record', label: 'Record', category: 'Transport', shortcut: 'R', action: () => this.executeRecord() },

            // Track operations
            { id: 'addTrack', label: 'Add Track', category: 'Track', shortcut: 'Ctrl+T', action: () => this.executeAddTrack() },
            { id: 'duplicateTrack', label: 'Duplicate Track', category: 'Track', shortcut: 'Ctrl+D', action: () => this.executeDuplicateTrack() },
            { id: 'deleteTrack', label: 'Delete Track', category: 'Track', shortcut: 'Delete', action: () => this.executeDeleteTrack() },
            { id: 'muteTrack', label: 'Mute Track', category: 'Track', shortcut: 'M', action: () => this.executeMuteTrack() },
            { id: 'soloTrack', label: 'Solo Track', category: 'Track', shortcut: 'S', action: () => this.executeSoloTrack() },

            // Windows
            { id: 'openMixer', label: 'Open Mixer', category: 'Window', shortcut: 'Ctrl+M', action: () => this.executeOpenMixer() },
            { id: 'openEffects', label: 'Open Effects Rack', category: 'Window', shortcut: 'Ctrl+E', action: () => this.executeOpenEffects() },
            { id: 'openBrowser', label: 'Open Browser', category: 'Window', shortcut: 'Ctrl+B', action: () => this.executeOpenBrowser() },
            { id: 'openPianoRoll', label: 'Open Piano Roll', category: 'Window', shortcut: 'Ctrl+P', action: () => this.executeOpenPianoRoll() },
            { id: 'openCCSequencer', label: 'Open CC Step Sequencer', category: 'Window', shortcut: 'Ctrl+Shift+C', action: () => this.executeOpenCCSequencer() },
            { id: 'openMetronome', label: 'Open Metronome', category: 'Window', shortcut: 'Ctrl+Shift+M', action: () => this.executeOpenMetronome() },

            // Edit operations
            { id: 'undo', label: 'Undo', category: 'Edit', shortcut: 'Ctrl+Z', action: () => this.executeUndo() },
            { id: 'redo', label: 'Redo', category: 'Edit', shortcut: 'Ctrl+Y', action: () => this.executeRedo() },
            { id: 'quantize', label: 'Quantize', category: 'Edit', shortcut: 'Q', action: () => this.executeQuantize() },
            { id: 'copy', label: 'Copy', category: 'Edit', shortcut: 'Ctrl+C', action: () => this.executeCopy() },
            { id: 'paste', label: 'Paste', category: 'Edit', shortcut: 'Ctrl+V', action: () => this.executePaste() },

            // View operations
            { id: 'toggleGrid', label: 'Toggle Grid', category: 'View', shortcut: 'G', action: () => this.executeToggleGrid() },
            { id: 'zoomIn', label: 'Zoom In', category: 'View', shortcut: '=', action: () => this.executeZoomIn() },
            { id: 'zoomOut', label: 'Zoom Out', category: 'View', shortcut: '-', action: () => this.executeZoomOut() },
            { id: 'fitToWindow', label: 'Fit to Window', category: 'View', shortcut: 'F', action: () => this.executeFitToWindow() },
        ];

        defaultActions.forEach(action => this.register(action));
    }

    register(action) {
        if (!action.id || !action.label || !action.action) {
            console.warn('SnawQuickLaunch: Invalid action registration', action);
            return;
        }
        this.actions.set(action.id, action);
        
        if (!this.categories.has(action.category)) {
            this.categories.set(action.category, []);
        }
        this.categories.get(action.category).push(action);
    }

    search(query) {
        if (!query || query.trim() === '') {
            return this.getRecentActions();
        }

        const q = query.toLowerCase().trim();
        const results = [];

        this.actions.forEach((action, id) => {
            const labelMatch = action.label.toLowerCase().includes(q);
            const categoryMatch = action.category.toLowerCase().includes(q);
            const shortcutMatch = action.shortcut?.toLowerCase().includes(q);
            const idMatch = id.toLowerCase().includes(q);

            if (labelMatch || categoryMatch || shortcutMatch || idMatch) {
                let score = 0;
                if (labelMatch) score += 10;
                if (action.label.toLowerCase().startsWith(q)) score += 5;
                if (idMatch) score += 3;
                if (shortcutMatch) score += 2;
                if (categoryMatch) score += 1;

                results.push({ ...action, score });
            }
        });

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, this.maxResults);
    }

    getRecentActions() {
        const recent = [];
        this.actions.forEach((action, id) => {
            if (action.recent) {
                recent.push({ ...action, recent: true });
            }
        });
        return recent.slice(0, this.maxResults);
    }

    execute(actionId) {
        const action = this.actions.get(actionId);
        if (action) {
            action.recent = true;
            try {
                action.action();
                return { success: true, label: action.label };
            } catch (e) {
                console.error('SnawQuickLaunch: Error executing action', actionId, e);
                return { success: false, error: e.message };
            }
        }
        return { success: false, error: 'Action not found' };
    }

    getAllActions() {
        const all = [];
        this.actions.forEach((action, id) => {
            all.push(action);
        });
        return all;
    }

    getByCategory(category) {
        return this.categories.get(category) || [];
    }

    getCategories() {
        return Array.from(this.categories.keys());
    }

    // Execute methods
    executeNewProject() { if (typeof newProject === 'function') newProject(); }
    executeSaveProject() { if (typeof saveProject === 'function') saveProject(); }
    executeExportAudio() { if (typeof exportAudio === 'function') exportAudio(); }
    executePlayPause() { if (typeof togglePlayback === 'function') togglePlayback(); else if (typeof playPause === 'function') playPause(); }
    executeStop() { if (typeof stopPlayback === 'function') stopPlayback(); }
    executeRewind() { if (typeof rewindToStart === 'function') rewindToStart(); }
    executeRecord() { if (typeof toggleRecording === 'function') toggleRecording(); }
    executeAddTrack() { if (typeof addTrack === 'function') addTrack(); }
    executeDuplicateTrack() { if (typeof duplicateCurrentTrack === 'function') duplicateCurrentTrack(); else if (window.snawTrackDuplicate?.duplicateCurrentTrack) window.snawTrackDuplicate.duplicateCurrentTrack(); }
    executeDeleteTrack() { if (typeof deleteSelectedTrack === 'function') deleteSelectedTrack(); }
    executeMuteTrack() { if (typeof toggleMuteSelected === 'function') toggleMuteSelected(); }
    executeSoloTrack() { if (typeof toggleSoloSelected === 'function') toggleSoloSelected(); }
    executeOpenMixer() { if (typeof openMixerPanel === 'function') openMixerPanel(); else if (window.SnugWindow?.getById) { const mw = window.SnugWindow.getById('mixer'); if (mw) mw.show(); } }
    executeOpenEffects() { if (typeof openEffectsRack === 'function') openEffectsRack(); }
    executeOpenBrowser() { if (typeof openBrowser === 'function') openBrowser(); }
    executeOpenPianoRoll() { if (typeof openPianoRoll === 'function') openPianoRoll(); else if (window.SnugWindow?.getById) { const pr = window.SnugWindow.getById('pianoroll'); if (pr) pr.show(); } }
    executeOpenCCSequencer() { if (typeof openCCStepSequencer === 'function') openCCStepSequencer(); }
    executeOpenMetronome() { if (typeof openMetronomePanel === 'function') openMetronomePanel(); }
    executeUndo() { if (typeof undo === 'function') undo(); }
    executeRedo() { if (typeof redo === 'function') redo(); }
    executeQuantize() { if (typeof quantizeSelection === 'function') quantizeSelection(); }
    executeCopy() { document.execCommand('copy'); }
    executePaste() { document.execCommand('paste'); }
    executeToggleGrid() { if (typeof toggleGrid === 'function') toggleGrid(); }
    executeZoomIn() { if (typeof zoomIn === 'function') zoomIn(); }
    executeZoomOut() { if (typeof zoomOut === 'function') zoomOut(); }
    executeFitToWindow() { if (typeof fitTimelineToWindow === 'function') fitTimelineToWindow(); }
}

const snawQuickLaunch = new SnawQuickLaunch();