/**
 * Smart Duplicate - Intelligent duplication that increments values or avoids conflicts
 */

export class SmartDuplicate {
    constructor(options = {}) {
        this.mode = options.mode ?? 'increment'; // increment, avoid-conflicts, mirror, extend
        
        // Duplicate settings
        this.settings = {
            // Note duplication
            noteOffset: options.noteOffset ?? 12, // semitones to offset (for increment mode)
            noteOffsetMode: options.noteOffsetMode ?? 'octave', // octave, fifth, third, custom
            
            // Clip duplication
            clipOffset: options.clipOffset ?? 0, // seconds to offset
            clipOffsetMode: options.clipOffsetMode ?? 'after', // after, before, overlap
            
            // Track duplication
            trackOffset: options.trackOffset ?? 1, // track position offset
            copyEffects: options.copyEffects ?? true,
            copyAutomation: options.copyAutomation ?? true,
            
            // Conflict avoidance
            avoidOverlap: options.avoidOverlap ?? true,
            snapToGrid: options.snapToGrid ?? true,
            gridSize: options.gridSize ?? '1/4', // 1/16, 1/8, 1/4, 1/2, 1
            
            // Pattern duplication
            transposePattern: options.transposePattern ?? false,
            invertPattern: options.invertPattern ?? false,
            retrogradePattern: options.retrogradePattern ?? false,
            
            // Velocity handling
            velocityOffset: options.velocityOffset ?? 0, // -127 to 127
            velocityScale: options.velocityScale ?? 1.0, // 0.0 to 2.0
            
            // Naming
            namingMode: options.namingMode ?? 'increment', // increment, copy, suffix
            suffixTemplate: options.suffixTemplate ?? ' (copy {n})',
            
            // Selection behavior
            selectAfterDuplicate: options.selectAfterDuplicate ?? true,
            deselectOriginal: options.deselectOriginal ?? false
        };
        
        // History for undo
        this.history = [];
        this.maxHistory = 50;
    }
    
    /**
     * Duplicate a single note with smart offset
     */
    duplicateNote(note, options = {}) {
        const settings = {...this.settings, ...options};
        
        const newNote = {
            ...note,
            id: this.generateId()
        };
        
        switch (this.mode) {
            case 'increment':
                // Transpose note
                let offset = settings.noteOffset;
                
                if (settings.noteOffsetMode === 'octave') {
                    offset = 12;
                } else if (settings.noteOffsetMode === 'fifth') {
                    offset = 7;
                } else if (settings.noteOffsetMode === 'third') {
                    offset = 4; // major third
                }
                
                newNote.pitch = Math.min(127, Math.max(0, note.pitch + offset));
                
                // Velocity adjustment
                newNote.velocity = Math.min(127, Math.max(0, Math.round(
                    note.velocity * settings.velocityScale + settings.velocityOffset
                )));
                break;
                
            case 'avoid-conflicts':
                // Find non-overlapping position
                newNote.time = note.time + this.findNextFreeSlot(note.time, note.duration);
                break;
                
            case 'mirror':
                // Mirror around center pitch (60 = C4)
                const centerPitch = 60;
                newNote.pitch = centerPitch - (note.pitch - centerPitch);
                break;
                
            case 'extend':
                // Place directly after original
                newNote.time = note.time + note.duration;
                break;
        }
        
        // Apply pattern transformations
        if (settings.invertPattern) {
            newNote.pitch = 127 - newNote.pitch;
        }
        
        // Record for undo
        this.history.push({
            type: 'note',
            action: 'duplicate',
            original: note,
            duplicate: newNote
        });
        
        return newNote;
    }
    
    /**
     * Duplicate multiple notes
     */
    duplicateNotes(notes, options = {}) {
        const settings = {...this.settings, ...options};
        
        const newNotes = notes.map(note => this.duplicateNote(note, settings));
        
        // Retrograde if enabled
        if (settings.retrogradePattern) {
            // Reverse the order while keeping positions
            const startTime = Math.min(...notes.map(n => n.time));
            const endTime = Math.max(...notes.map(n => n.time + n.duration));
            const duration = endTime - startTime;
            
            newNotes.forEach((newNote, i) => {
                const originalTime = notes[i].time;
                const relativeTime = originalTime - startTime;
                newNote.time = endTime - relativeTime - notes[i].duration;
            });
        }
        
        return newNotes;
    }
    
    /**
     * Duplicate a clip with smart positioning
     */
    duplicateClip(clip, options = {}) {
        const settings = {...this.settings, ...options};
        
        const newClip = {
            ...clip,
            id: this.generateId()
        };
        
        switch (this.mode) {
            case 'increment':
            case 'extend':
                // Place after original
                newClip.startTime = clip.startTime + clip.duration + settings.clipOffset;
                newClip.endTime = newClip.startTime + clip.duration;
                break;
                
            case 'avoid-conflicts':
                // Find non-overlapping position
                newClip.startTime = this.findNextFreeSlot(clip.startTime, clip.duration);
                newClip.endTime = newClip.startTime + clip.duration;
                break;
                
            case 'mirror':
                // Mirror position within project bounds
                // (would need project duration context)
                break;
        }
        
        // Snap to grid if enabled
        if (settings.snapToGrid) {
            const gridSeconds = this.gridSizeToSeconds(settings.gridSize, 120); // BPM would come from context
            newClip.startTime = Math.round(newClip.startTime / gridSeconds) * gridSeconds;
            newClip.endTime = newClip.startTime + clip.duration;
        }
        
        // Update name
        if (settings.namingMode === 'increment') {
            newClip.name = this.incrementName(clip.name);
        } else if (settings.namingMode === 'suffix') {
            newClip.name = clip.name + settings.suffixTemplate.replace('{n}', '1');
        }
        
        // Record for undo
        this.history.push({
            type: 'clip',
            action: 'duplicate',
            original: clip,
            duplicate: newClip
        });
        
        return newClip;
    }
    
    /**
     * Duplicate multiple clips
     */
    duplicateClips(clips, options = {}) {
        const settings = {...this.settings, ...options};
        
        // Sort by start time
        const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
        
        const newClips = [];
        let cumulativeOffset = 0;
        
        sortedClips.forEach(clip => {
            const newClip = this.duplicateClip(clip, {
                ...settings,
                clipOffset: cumulativeOffset
            });
            
            // Track cumulative offset for sequential placement
            if (settings.clipOffsetMode === 'after') {
                cumulativeOffset = newClip.startTime + newClip.duration - clips[0].startTime;
            }
            
            newClips.push(newClip);
        });
        
        return newClips;
    }
    
    /**
     * Duplicate a track with all contents
     */
    duplicateTrack(track, options = {}) {
        const settings = {...this.settings, ...options};
        
        const newTrack = {
            ...track,
            id: this.generateId()
        };
        
        // Update track position
        newTrack.index = track.index + settings.trackOffset;
        
        // Copy effects if enabled
        if (settings.copyEffects && track.effects) {
            newTrack.effects = track.effects.map(effect => ({
                ...effect,
                id: this.generateId()
            }));
        }
        
        // Copy automation if enabled
        if (settings.copyAutomation && track.automation) {
            newTrack.automation = Object.entries(track.automation).reduce((acc, [param, points]) => {
                acc[param] = points.map(point => ({...point}));
                return acc;
            }, {});
        }
        
        // Copy clips
        if (track.clips) {
            newTrack.clips = track.clips.map(clip => ({
                ...clip,
                id: this.generateId(),
                trackId: newTrack.id
            }));
        }
        
        // Update name
        if (settings.namingMode === 'increment') {
            newTrack.name = this.incrementName(track.name);
        } else if (settings.namingMode === 'suffix') {
            newTrack.name = track.name + settings.suffixTemplate.replace('{n}', '1');
        }
        
        // Record for undo
        this.history.push({
            type: 'track',
            action: 'duplicate',
            original: track,
            duplicate: newTrack
        });
        
        return newTrack;
    }
    
    /**
     * Duplicate a pattern with variations
     */
    duplicatePattern(pattern, options = {}) {
        const settings = {...this.settings, ...options};
        
        const newPattern = {
            ...pattern,
            id: this.generateId(),
            notes: []
        };
        
        // Transform notes based on settings
        if (settings.transposePattern) {
            const transposeAmount = settings.noteOffsetMode === 'octave' ? 12 :
                                    settings.noteOffsetMode === 'fifth' ? 7 : 4;
            newPattern.notes = pattern.notes.map(note => ({
                ...note,
                id: this.generateId(),
                pitch: Math.min(127, Math.max(0, note.pitch + transposeAmount))
            }));
        } else if (settings.invertPattern) {
            // Invert around center pitch
            const centerPitch = pattern.notes.reduce((sum, n) => sum + n.pitch, 0) / pattern.notes.length;
            newPattern.notes = pattern.notes.map(note => ({
                ...note,
                id: this.generateId(),
                pitch: Math.round(centerPitch - (note.pitch - centerPitch))
            }));
        } else if (settings.retrogradePattern) {
            // Reverse note order and timing
            const totalDuration = pattern.duration || 
                Math.max(...pattern.notes.map(n => n.time + n.duration));
            
            newPattern.notes = pattern.notes.map(note => ({
                ...note,
                id: this.generateId(),
                time: totalDuration - note.time - note.duration
            })).reverse();
        } else {
            // Simple copy
            newPattern.notes = pattern.notes.map(note => ({
                ...note,
                id: this.generateId()
            }));
        }
        
        // Update name
        if (settings.namingMode === 'increment') {
            newPattern.name = this.incrementName(pattern.name);
        }
        
        return newPattern;
    }
    
    /**
     * Find next free time slot
     */
    findNextFreeSlot(startTime, duration, existingItems = []) {
        if (existingItems.length === 0) {
            return duration; // Place right after original
        }
        
        // Sort by start time
        const sorted = [...existingItems].sort((a, b) => a.startTime - b.startTime);
        
        // Find gap
        for (let i = 0; i < sorted.length; i++) {
            const item = sorted[i];
            const prevEnd = i > 0 ? sorted[i-1].startTime + sorted[i-1].duration : 0;
            
            if (item.startTime > prevEnd + duration) {
                return prevEnd + duration;
            }
        }
        
        // No gap found, place at end
        const lastItem = sorted[sorted.length - 1];
        return lastItem.startTime + lastItem.duration;
    }
    
    /**
     * Increment a name with number
     */
    incrementName(name) {
        // Check for existing number suffix
        const match = name.match(/^(.+?)(\s+(\d+))?$/);
        
        if (match[3]) {
            // Has number, increment it
            const base = match[1];
            const num = parseInt(match[3]) + 1;
            return `${base} ${num}`;
        } else {
            // No number, add one
            return `${name} 2`;
        }
    }
    
    /**
     * Convert grid size to seconds
     */
    gridSizeToSeconds(gridSize, bpm) {
        const beatsPerSecond = bpm / 60;
        
        switch (gridSize) {
            case '1/16': return (1/16) / beatsPerSecond;
            case '1/8': return (1/8) / beatsPerSecond;
            case '1/4': return (1/4) / beatsPerSecond;
            case '1/2': return (1/2) / beatsPerSecond;
            case '1': return 1 / beatsPerSecond;
            default: return (1/4) / beatsPerSecond;
        }
    }
    
    /**
     * Generate unique ID
     */
    generateId() {
        return 'sd_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Set duplicate mode
     */
    setMode(mode) {
        this.mode = mode;
    }
    
    /**
     * Update settings
     */
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
    }
    
    /**
     * Undo last duplication
     */
    undo() {
        if (this.history.length === 0) return null;
        
        const lastAction = this.history.pop();
        return {
            action: lastAction,
            undoAction: 'delete',
            item: lastAction.duplicate
        };
    }
    
    /**
     * Get history
     */
    getHistory() {
        return [...this.history];
    }
    
    /**
     * Clear history
     */
    clearHistory() {
        this.history = [];
    }
    
    /**
     * Get state for save
     */
    getState() {
        return {
            mode: this.mode,
            settings: {...this.settings}
        };
    }
    
    /**
     * Set state from load
     */
    setState(state) {
        this.mode = state.mode || this.mode;
        Object.assign(this.settings, state.settings || {});
    }
}

/**
 * Smart Duplicate Manager - Manages smart duplication across the project
 */
export class SmartDuplicateManager {
    constructor() {
        this.duplicators = new Map();
    }
    
    createDuplicator(id, options = {}) {
        const duplicator = new SmartDuplicate(options);
        this.duplicators.set(id, duplicator);
        return duplicator;
    }
    
    getDuplicator(id) {
        return this.duplicators.get(id);
    }
    
    duplicateSelection(selection, options = {}) {
        const duplicator = new SmartDuplicate(options);
        const results = {};
        
        if (selection.notes && selection.notes.length > 0) {
            results.notes = duplicator.duplicateNotes(selection.notes, options);
        }
        
        if (selection.clips && selection.clips.length > 0) {
            results.clips = duplicator.duplicateClips(selection.clips, options);
        }
        
        if (selection.tracks && selection.tracks.length > 0) {
            results.tracks = selection.tracks.map(track => 
                duplicator.duplicateTrack(track, options)
            );
        }
        
        if (selection.patterns && selection.patterns.length > 0) {
            results.patterns = selection.patterns.map(pattern =>
                duplicator.duplicatePattern(pattern, options)
            );
        }
        
        return results;
    }
    
    undo(id) {
        const duplicator = this.duplicators.get(id);
        if (duplicator) {
            return duplicator.undo();
        }
        return null;
    }
    
    dispose() {
        this.duplicators.clear();
    }
}

// Global instance
let smartDuplicateManager = null;

export function getSmartDuplicateManager() {
    if (!smartDuplicateManager) {
        smartDuplicateManager = new SmartDuplicateManager();
    }
    return smartDuplicateManager;
}

export function openSmartDuplicatePanel(selection, callback) {
    const duplicator = new SmartDuplicate();
    
    const panel = document.createElement('div');
    panel.className = 'smart-duplicate-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        padding: 24px;
        border-radius: 8px;
        border: 1px solid #333;
        color: white;
        z-index: 10000;
        min-width: 400px;
        font-family: system-ui, sans-serif;
    `;
    
    const s = duplicator.settings;
    const selectionInfo = {
        notes: selection.notes?.length || 0,
        clips: selection.clips?.length || 0,
        tracks: selection.tracks?.length || 0
    };
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px;">Smart Duplicate</h3>
            <button class="close-btn" style="background: none; border: none; color: #888; cursor: pointer; font-size: 20px;">&times;</button>
        </div>
        
        <div style="margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;">
            <span style="color: #888;">Selection:</span>
            ${selectionInfo.notes > 0 ? `<span style="margin-left: 8px;">${selectionInfo.notes} notes</span>` : ''}
            ${selectionInfo.clips > 0 ? `<span style="margin-left: 8px;">${selectionInfo.clips} clips</span>` : ''}
            ${selectionInfo.tracks > 0 ? `<span style="margin-left: 8px;">${selectionInfo.tracks} tracks</span>` : ''}
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="font-size: 12px; color: #888; display: block; margin-bottom: 8px;">Mode</label>
            <select id="dup-mode" style="width: 100%; padding: 8px; background: #0a0a14; border: 1px solid #333; color: white; border-radius: 4px;">
                <option value="increment">Increment (transpose)</option>
                <option value="extend">Extend (place after)</option>
                <option value="avoid-conflicts">Avoid Conflicts</option>
                <option value="mirror">Mirror</option>
            </select>
        </div>
        
        <div id="mode-options" style="margin-bottom: 16px;">
            <div id="increment-options" style="padding: 12px; background: #0a0a14; border-radius: 4px;">
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; color: #888; display: block; margin-bottom: 4px;">Transpose Amount</label>
                    <select id="note-offset-mode" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #333; color: white; border-radius: 4px;">
                        <option value="octave">Octave (+12)</option>
                        <option value="fifth">Fifth (+7)</option>
                        <option value="third">Third (+4)</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
                <div id="custom-offset" style="display: none;">
                    <label style="font-size: 12px; color: #888; display: block; margin-bottom: 4px;">Semitones</label>
                    <input type="number" id="note-offset" min="-48" max="48" value="${s.noteOffset}" style="width: 100%; padding: 8px; background: #1a1a2e; border: 1px solid #333; color: white; border-radius: 4px;">
                </div>
            </div>
            
            <div id="extend-options" style="display: none; padding: 12px; background: #0a0a14; border-radius: 4px;">
                <label style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="snap-grid" ${s.snapToGrid ? 'checked' : ''}>
                    <span>Snap to grid</span>
                </label>
            </div>
        </div>
        
        <div style="margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;">
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <input type="checkbox" id="transpose-pattern" ${s.transposePattern ? 'checked' : ''}>
                <span>Transpose pattern</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <input type="checkbox" id="invert-pattern" ${s.invertPattern ? 'checked' : ''}>
                <span>Invert pattern</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="retrograde-pattern" ${s.retrogradePattern ? 'checked' : ''}>
                <span>Retrograde (reverse)</span>
            </label>
        </div>
        
        <div style="display: flex; gap: 8px;">
            <button id="dup-cancel" style="flex: 1; padding: 12px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                Cancel
            </button>
            <button id="dup-apply" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">
                Duplicate
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.onclick = () => panel.remove();
    
    const modeSelect = panel.querySelector('#dup-mode');
    const incrementOptions = panel.querySelector('#increment-options');
    const extendOptions = panel.querySelector('#extend-options');
    
    modeSelect.onchange = () => {
        duplicator.setMode(modeSelect.value);
        incrementOptions.style.display = modeSelect.value === 'increment' ? 'block' : 'none';
        extendOptions.style.display = modeSelect.value === 'extend' ? 'block' : 'none';
    };
    
    const offsetModeSelect = panel.querySelector('#note-offset-mode');
    const customOffsetDiv = panel.querySelector('#custom-offset');
    
    offsetModeSelect.onchange = () => {
        customOffsetDiv.style.display = offsetModeSelect.value === 'custom' ? 'block' : 'none';
        duplicator.settings.noteOffsetMode = offsetModeSelect.value;
    };
    
    const cancelBtn = panel.querySelector('#dup-cancel');
    cancelBtn.onclick = () => panel.remove();
    
    const applyBtn = panel.querySelector('#dup-apply');
    applyBtn.onclick = () => {
        // Gather settings
        duplicator.settings.transposePattern = panel.querySelector('#transpose-pattern').checked;
        duplicator.settings.invertPattern = panel.querySelector('#invert-pattern').checked;
        duplicator.settings.retrogradePattern = panel.querySelector('#retrograde-pattern').checked;
        duplicator.settings.snapToGrid = panel.querySelector('#snap-grid').checked;
        
        // Duplicate
        const results = getSmartDuplicateManager().duplicateSelection(selection, {
            mode: duplicator.mode,
            ...duplicator.settings
        });
        
        // Callback with results
        if (callback) {
            callback(results);
        }
        
        // Show notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            font-family: system-ui, sans-serif;
        `;
        
        let itemCount = 0;
        if (results.notes) itemCount += results.notes.length;
        if (results.clips) itemCount += results.clips.length;
        if (results.tracks) itemCount += results.tracks.length;
        
        notification.textContent = `${itemCount} items duplicated`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
        
        panel.remove();
    };
    
    return panel;
}

// Module initialized
console.log('[SmartDuplicate] Module loaded');