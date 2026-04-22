// js/PlaylistView.js - Playlist/Session View for Scene-Based Arrangement
// Alternative to linear timeline - allows triggering scenes of clips

/**
 * PlaylistView provides an alternative arrangement view inspired by Ableton's Session View.
 * 
 * Features:
 * - Scenes: Groups of clips that can be triggered together
 * - Clip slots: Grid of clip positions per track/scene
 * - Scene launching: Trigger all clips in a scene simultaneously
 * - Follow actions: Automatic actions after clip playback
 * - Scene color coding: Visual organization
 * - MIDI triggerable: Scenes can be triggered via MIDI
 * - Clip duplication/moving within slots
 */

// Scene launch quantization options
const LAUNCH_QUANTIZE = {
    IMMEDIATE: 'immediate',
    NEXT_BAR: 'next_bar',
    NEXT_BEAT: 'next_beat',
    NEXT_2_BARS: 'next_2_bars',
    NEXT_4_BARS: 'next_4_bars'
};

// Follow actions
const FOLLOW_ACTION = {
    NONE: 'none',
    STOP: 'stop',
    LOOP: 'loop',
    PLAY_NEXT_SCENE: 'play_next_scene',
    PLAY_RANDOM_SCENE: 'play_random_scene',
    PLAY_SPECIFIC_SCENE: 'play_specific_scene'
};

// Clip states
const CLIP_STATE = {
    EMPTY: 'empty',
    STOPPED: 'stopped',
    PLAYING: 'playing',
    TRIGGERED: 'triggered',
    RECORDING: 'recording'
};

/**
 * PlaylistClipSlot - Represents a single clip slot in the playlist grid.
 */
export class PlaylistClipSlot {
    constructor(trackId, sceneIndex) {
        this.trackId = trackId;
        this.sceneIndex = sceneIndex;
        this.clipId = null; // Reference to timeline clip or sequencer sequence
        this.clipType = null; // 'audio' | 'midi' | 'empty'
        this.state = CLIP_STATE.EMPTY;
        this.name = '';
        this.color = '#3b82f6'; // Default blue
        this.isLooping = false;
        this.loopLength = 4; // In bars
        this.followAction = FOLLOW_ACTION.NONE;
        this.followActionDelay = 0; // In beats after clip ends
        this.launchQuantize = LAUNCH_QUANTIZE.NEXT_BAR;
        this.velocityAmount = 0; // 0-1: How much launch velocity affects volume
        this.probability = 1.0; // 0-1: Probability of triggering (for variations)
        this.variationGroupId = null; // Group ID for mutually exclusive clips
    }

    /**
     * Convert to JSON-serializable object.
     */
    toJSON() {
        return {
            trackId: this.trackId,
            sceneIndex: this.sceneIndex,
            clipId: this.clipId,
            clipType: this.clipType,
            state: this.state,
            name: this.name,
            color: this.color,
            isLooping: this.isLooping,
            loopLength: this.loopLength,
            followAction: this.followAction,
            followActionDelay: this.followActionDelay,
            launchQuantize: this.launchQuantize,
            velocityAmount: this.velocityAmount,
            probability: this.probability,
            variationGroupId: this.variationGroupId
        };
    }

    /**
     * Create from JSON object.
     */
    static fromJSON(data) {
        const slot = new PlaylistClipSlot(data.trackId, data.sceneIndex);
        Object.assign(slot, data);
        return slot;
    }

    /**
     * Check if slot has content.
     */
    hasClip() {
        return this.clipId !== null && this.state !== CLIP_STATE.EMPTY;
    }

    /**
     * Clear the slot.
     */
    clear() {
        this.clipId = null;
        this.clipType = null;
        this.state = CLIP_STATE.EMPTY;
        this.name = '';
    }
}

/**
 * PlaylistScene - Represents a horizontal row of clip slots.
 * All clips in a scene can be triggered together.
 */
export class PlaylistScene {
    constructor(index, name = '') {
        this.id = `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.index = index;
        this.name = name || `Scene ${index + 1}`;
        this.color = '#6b7280'; // Default gray
        this.isTriggered = false;
        this.isPlaying = false;
        this.tempo = null; // Override project tempo (null = use project tempo)
        this.timeSignature = null; // Override time signature
        this.launchQuantize = LAUNCH_QUANTIZE.NEXT_BAR;
        this.midiNote = null; // MIDI note to trigger this scene (for MIDI mapping)
        this.midiChannel = 0;
    }

    toJSON() {
        return {
            id: this.id,
            index: this.index,
            name: this.name,
            color: this.color,
            tempo: this.tempo,
            timeSignature: this.timeSignature,
            launchQuantize: this.launchQuantize,
            midiNote: this.midiNote,
            midiChannel: this.midiChannel
        };
    }

    static fromJSON(data) {
        const scene = new PlaylistScene(data.index, data.name);
        Object.assign(scene, {
            id: data.id,
            color: data.color,
            tempo: data.tempo,
            timeSignature: data.timeSignature,
            launchQuantize: data.launchQuantize,
            midiNote: data.midiNote,
            midiChannel: data.midiChannel
        });
        return scene;
    }
}

/**
 * VariationGroup - Group of clips that are mutually exclusive.
 * Only one clip in a group can play at a time.
 */
export class VariationGroup {
    constructor(name = 'Variation Group') {
        this.id = `varGroup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
        this.mode = 'exclusive'; // 'exclusive' | 'round_robin' | 'random' | 'all'
        this.currentIndex = 0; // For round-robin mode
        this.slotKeys = []; // Array of 'trackId_sceneIndex' strings
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            mode: this.mode,
            currentIndex: this.currentIndex,
            slotKeys: this.slotKeys
        };
    }

    static fromJSON(data) {
        const group = new VariationGroup(data.name);
        Object.assign(group, data);
        return group;
    }

    addSlot(trackId, sceneIndex) {
        const key = `${trackId}_${sceneIndex}`;
        if (!this.slotKeys.includes(key)) {
            this.slotKeys.push(key);
        }
    }

    removeSlot(trackId, sceneIndex) {
        const key = `${trackId}_${sceneIndex}`;
        this.slotKeys = this.slotKeys.filter(k => k !== key);
    }

    /**
     * Get the next slot to trigger based on group mode.
     */
    getNextSlot() {
        if (this.slotKeys.length === 0) return null;

        switch (this.mode) {
            case 'exclusive':
                // Return all slots - caller handles exclusivity
                return this.slotKeys.map(k => {
                    const [trackId, sceneIndex] = k.split('_').map(Number);
                    return { trackId, sceneIndex };
                });
            case 'round_robin':
                this.currentIndex = (this.currentIndex + 1) % this.slotKeys.length;
                const key = this.slotKeys[this.currentIndex];
                const [trackId, sceneIndex] = key.split('_').map(Number);
                return { trackId, sceneIndex };
            case 'random':
                const randomKey = this.slotKeys[Math.floor(Math.random() * this.slotKeys.length)];
                const [tId, sIdx] = randomKey.split('_').map(Number);
                return { trackId: tId, sceneIndex: sIdx };
            case 'all':
                return this.slotKeys.map(k => {
                    const [tid, sidx] = k.split('_').map(Number);
                    return { trackId: tid, sceneIndex: sidx };
                });
            default:
                return null;
        }
    }
}

/**
 * PlaylistViewManager - Main manager for the playlist view.
 * Coordinates all playlist state and operations.
 */
export class PlaylistViewManager {
    constructor(appServices) {
        this.appServices = appServices;
        this.scenes = [];
        this.clipSlots = new Map(); // Key: 'trackId_sceneIndex', Value: PlaylistClipSlot
        this.variationGroups = [];
        this.numScenes = 8;
        this.currentSceneIndex = -1;
        this.isPlaying = false;
        this.scenePlaybackTimers = new Map();
        this.viewMode = 'playlist'; // 'playlist' | 'arrangement'
        
        // Scene follow actions state
        this.pendingFollowActions = [];

        // Initialize default scenes
        this.initializeScenes(this.numScenes);
    }

    /**
     * Initialize scenes with default values.
     */
    initializeScenes(count) {
        this.scenes = [];
        for (let i = 0; i < count; i++) {
            this.scenes.push(new PlaylistScene(i));
        }
    }

    /**
     * Ensure clip slots exist for all track/scene combinations.
     */
    ensureClipSlots(trackIds) {
        for (const trackId of trackIds) {
            for (let sceneIndex = 0; sceneIndex < this.scenes.length; sceneIndex++) {
                const key = `${trackId}_${sceneIndex}`;
                if (!this.clipSlots.has(key)) {
                    this.clipSlots.set(key, new PlaylistClipSlot(trackId, sceneIndex));
                }
            }
        }
    }

    /**
     * Add a new scene.
     */
    addScene(index = null) {
        const insertIndex = index !== null ? index : this.scenes.length;
        const newScene = new PlaylistScene(insertIndex);
        
        // Shift existing scenes
        if (insertIndex < this.scenes.length) {
            for (let i = this.scenes.length - 1; i >= insertIndex; i--) {
                this.scenes[i].index = i + 1;
            }
            this.scenes.splice(insertIndex, 0, newScene);
            
            // Update clip slots indices
            this.shiftClipSlotsForScene(insertIndex, 1);
        } else {
            this.scenes.push(newScene);
        }
        
        console.log(`[PlaylistView] Added scene "${newScene.name}" at index ${insertIndex}`);
        return newScene;
    }

    /**
     * Remove a scene.
     */
    removeScene(sceneId) {
        const index = this.scenes.findIndex(s => s.id === sceneId);
        if (index === -1) {
            console.warn(`[PlaylistView] Scene ${sceneId} not found`);
            return false;
        }

        // Stop any playing clips in this scene
        this.stopScene(index);

        // Shift clip slots
        this.shiftClipSlotsForScene(index, -1);

        // Remove scene
        this.scenes.splice(index, 1);
        
        // Update indices
        for (let i = index; i < this.scenes.length; i++) {
            this.scenes[i].index = i;
        }

        console.log(`[PlaylistView] Removed scene at index ${index}`);
        return true;
    }

    /**
     * Shift clip slots when scenes are added/removed.
     */
    shiftClipSlotsForScene(fromIndex, direction) {
        const newSlotMap = new Map();
        
        for (const [key, slot] of this.clipSlots) {
            if (slot.sceneIndex >= fromIndex) {
                slot.sceneIndex += direction;
                newSlotMap.set(`${slot.trackId}_${slot.sceneIndex}`, slot);
            } else {
                newSlotMap.set(key, slot);
            }
        }
        
        this.clipSlots = newSlotMap;
    }

    /**
     * Duplicate a scene.
     */
    duplicateScene(sceneId) {
        const index = this.scenes.findIndex(s => s.id === sceneId);
        if (index === -1) return null;

        // Create new scene
        const newScene = this.addScene(index + 1);
        newScene.name = `${this.scenes[index].name} (copy)`;
        newScene.color = this.scenes[index].color;
        newScene.tempo = this.scenes[index].tempo;

        // Copy clip slots
        const trackIds = this.getUniqueTrackIds();
        for (const trackId of trackIds) {
            const sourceKey = `${trackId}_${index}`;
            const destKey = `${trackId}_${index + 1}`;
            const sourceSlot = this.clipSlots.get(sourceKey);
            
            if (sourceSlot && sourceSlot.hasClip()) {
                const destSlot = new PlaylistClipSlot(trackId, index + 1);
                Object.assign(destSlot, {
                    clipId: sourceSlot.clipId,
                    clipType: sourceSlot.clipType,
                    name: sourceSlot.name,
                    color: sourceSlot.color,
                    isLooping: sourceSlot.isLooping,
                    loopLength: sourceSlot.loopLength,
                    followAction: sourceSlot.followAction,
                    launchQuantize: sourceSlot.launchQuantize
                });
                this.clipSlots.set(destKey, destSlot);
            }
        }

        console.log(`[PlaylistView] Duplicated scene "${this.scenes[index].name}"`);
        return newScene;
    }

    /**
     * Get unique track IDs from clip slots.
     */
    getUniqueTrackIds() {
        const trackIds = new Set();
        for (const [key] of this.clipSlots) {
            const trackId = parseInt(key.split('_')[0]);
            trackIds.add(trackId);
        }
        return Array.from(trackIds);
    }

    /**
     * Get a clip slot.
     */
    getClipSlot(trackId, sceneIndex) {
        const key = `${trackId}_${sceneIndex}`;
        if (!this.clipSlots.has(key)) {
            this.clipSlots.set(key, new PlaylistClipSlot(trackId, sceneIndex));
        }
        return this.clipSlots.get(key);
    }

    /**
     * Set a clip in a slot.
     */
    setClipInSlot(trackId, sceneIndex, clipId, clipType, name = '') {
        const slot = this.getClipSlot(trackId, sceneIndex);
        slot.clipId = clipId;
        slot.clipType = clipType;
        slot.state = CLIP_STATE.STOPPED;
        slot.name = name || `Clip ${sceneIndex + 1}`;
        console.log(`[PlaylistView] Set clip "${slot.name}" in track ${trackId}, scene ${sceneIndex}`);
        return slot;
    }

    /**
     * Clear a clip slot.
     */
    clearClipSlot(trackId, sceneIndex) {
        const key = `${trackId}_${sceneIndex}`;
        if (this.clipSlots.has(key)) {
            const slot = this.clipSlots.get(key);
            
            // Stop if playing
            if (slot.state === CLIP_STATE.PLAYING) {
                this.stopClip(trackId, sceneIndex);
            }
            
            slot.clear();
            console.log(`[PlaylistView] Cleared clip slot track ${trackId}, scene ${sceneIndex}`);
        }
    }

    /**
     * Move a clip between slots.
     */
    moveClipToSlot(fromTrackId, fromSceneIndex, toTrackId, toSceneIndex) {
        const fromSlot = this.getClipSlot(fromTrackId, fromSceneIndex);
        const toSlot = this.getClipSlot(toTrackId, toSceneIndex);

        if (!fromSlot.hasClip()) {
            console.warn(`[PlaylistView] No clip to move from track ${fromTrackId}, scene ${fromSceneIndex}`);
            return false;
        }

        // Swap or copy
        const tempClip = {
            clipId: toSlot.clipId,
            clipType: toSlot.clipType,
            state: toSlot.state,
            name: toSlot.name,
            color: toSlot.color,
            isLooping: toSlot.isLooping,
            loopLength: toSlot.loopLength,
            followAction: toSlot.followAction,
            launchQuantize: toSlot.launchQuantize
        };

        // Move from to to
        Object.assign(toSlot, {
            clipId: fromSlot.clipId,
            clipType: fromSlot.clipType,
            state: CLIP_STATE.STOPPED,
            name: fromSlot.name,
            color: fromSlot.color,
            isLooping: fromSlot.isLooping,
            loopLength: fromSlot.loopLength,
            followAction: fromSlot.followAction,
            launchQuantize: fromSlot.launchQuantize
        });

        // Clear or swap from
        if (tempClip.clipId) {
            Object.assign(fromSlot, tempClip);
        } else {
            fromSlot.clear();
        }

        console.log(`[PlaylistView] Moved clip from (${fromTrackId},${fromSceneIndex}) to (${toTrackId},${toSceneIndex})`);
        return true;
    }

    /**
     * Trigger a scene - launch all clips in the scene.
     */
    triggerScene(sceneIndex, velocity = 127) {
        if (sceneIndex < 0 || sceneIndex >= this.scenes.length) {
            console.warn(`[PlaylistView] Invalid scene index ${sceneIndex}`);
            return false;
        }

        const scene = this.scenes[sceneIndex];
        scene.isTriggered = true;

        // Override tempo if scene has tempo setting
        if (scene.tempo && this.appServices?.setBPM) {
            this.appServices.setBPM(scene.tempo);
        }

        // Trigger all clips in the scene
        const trackIds = this.getUniqueTrackIds();
        for (const trackId of trackIds) {
            const slot = this.getClipSlot(trackId, sceneIndex);
            
            if (slot.hasClip() && Math.random() < slot.probability) {
                this.triggerClip(trackId, sceneIndex, velocity);
            }
        }

        // Update current scene
        if (this.currentSceneIndex >= 0 && this.currentSceneIndex !== sceneIndex) {
            // Stop previous scene if not looping
            this.stopScene(this.currentSceneIndex, false);
        }
        
        this.currentSceneIndex = sceneIndex;
        this.isPlaying = true;

        console.log(`[PlaylistView] Triggered scene "${scene.name}" (index ${sceneIndex})`);
        return true;
    }

    /**
     * Stop a scene.
     */
    stopScene(sceneIndex, immediate = true) {
        const trackIds = this.getUniqueTrackIds();
        for (const trackId of trackIds) {
            const slot = this.getClipSlot(trackId, sceneIndex);
            if (slot.state === CLIP_STATE.PLAYING || slot.state === CLIP_STATE.TRIGGERED) {
                this.stopClip(trackId, sceneIndex, immediate);
            }
        }

        if (this.scenes[sceneIndex]) {
            this.scenes[sceneIndex].isTriggered = false;
            this.scenes[sceneIndex].isPlaying = false;
        }

        console.log(`[PlaylistView] Stopped scene ${sceneIndex}`);
    }

    /**
     * Stop all scenes.
     */
    stopAllScenes() {
        for (let i = 0; i < this.scenes.length; i++) {
            this.stopScene(i, true);
        }
        this.currentSceneIndex = -1;
        this.isPlaying = false;
        console.log(`[PlaylistView] Stopped all scenes`);
    }

    /**
     * Trigger a single clip.
     */
    triggerClip(trackId, sceneIndex, velocity = 127) {
        const slot = this.getClipSlot(trackId, sceneIndex);
        
        if (!slot.hasClip()) {
            console.log(`[PlaylistView] No clip in track ${trackId}, scene ${sceneIndex}`);
            return false;
        }

        slot.state = CLIP_STATE.TRIGGERED;

        // Handle variation groups
        if (slot.variationGroupId) {
            this.handleVariationGroup(slot.variationGroupId, trackId, sceneIndex);
        }

        // Schedule playback based on quantize setting
        const quantize = slot.launchQuantize;
        const delay = this.calculateLaunchDelay(quantize);

        setTimeout(() => {
            this.startClipPlayback(trackId, sceneIndex, velocity);
        }, delay * 1000);

        console.log(`[PlaylistView] Triggered clip "${slot.name}" in track ${trackId}, scene ${sceneIndex}`);
        return true;
    }

    /**
     * Calculate launch delay based on quantize setting.
     */
    calculateLaunchDelay(quantize) {
        if (!this.appServices?.getBPM) return 0;
        
        const bpm = this.appServices.getBPM();
        const beatDuration = 60 / bpm;
        
        // Get current transport position
        const currentBeat = this.appServices.getCurrentBeat ? 
            this.appServices.getCurrentBeat() : 0;
        
        switch (quantize) {
            case LAUNCH_QUANTIZE.IMMEDIATE:
                return 0;
            case LAUNCH_QUANTIZE.NEXT_BEAT: {
                const fractionalBeat = currentBeat % 1;
                return (1 - fractionalBeat) * beatDuration;
            }
            case LAUNCH_QUANTIZE.NEXT_BAR: {
                const barLength = 4; // Assuming 4/4 time
                const fractionalBar = currentBeat % barLength;
                return (barLength - fractionalBar) * beatDuration;
            }
            case LAUNCH_QUANTIZE.NEXT_2_BARS: {
                const barLength = 8;
                const fractionalBar = currentBeat % barLength;
                return (barLength - fractionalBar) * beatDuration;
            }
            case LAUNCH_QUANTIZE.NEXT_4_BARS: {
                const barLength = 16;
                const fractionalBar = currentBeat % barLength;
                return (barLength - fractionalBar) * beatDuration;
            }
            default:
                return 0;
        }
    }

    /**
     * Start actual clip playback.
     */
    startClipPlayback(trackId, sceneIndex, velocity) {
        const slot = this.getClipSlot(trackId, sceneIndex);
        
        if (!slot.hasClip() || slot.state === CLIP_STATE.STOPPED) {
            return;
        }

        slot.state = CLIP_STATE.PLAYING;

        // Apply velocity amount
        if (slot.velocityAmount > 0 && velocity < 127) {
            // Could adjust volume/gain based on velocity
        }

        // Trigger the actual playback via appServices
        if (slot.clipType === 'audio' && this.appServices?.playTimelineClip) {
            this.appServices.playTimelineClip(trackId, slot.clipId);
        } else if (slot.clipType === 'midi' && this.appServices?.playSequence) {
            this.appServices.playSequence(trackId, slot.clipId);
        }

        // Schedule follow action if loop is disabled
        if (!slot.isLooping && slot.followAction !== FOLLOW_ACTION.NONE) {
            this.scheduleFollowAction(trackId, sceneIndex);
        }
    }

    /**
     * Stop a clip.
     */
    stopClip(trackId, sceneIndex, immediate = true) {
        const slot = this.getClipSlot(trackId, sceneIndex);
        
        if (slot.state !== CLIP_STATE.PLAYING && slot.state !== CLIP_STATE.TRIGGERED) {
            return false;
        }

        if (immediate) {
            slot.state = CLIP_STATE.STOPPED;
        } else {
            // Allow to finish playing
            slot.isLooping = false;
        }

        // Stop actual playback
        if (this.appServices?.stopPlayback) {
            this.appServices.stopPlayback(trackId);
        }

        console.log(`[PlaylistView] Stopped clip in track ${trackId}, scene ${sceneIndex}`);
        return true;
    }

    /**
     * Schedule follow action for a clip.
     */
    scheduleFollowAction(trackId, sceneIndex) {
        const slot = this.getClipSlot(trackId, sceneIndex);
        
        // Calculate delay
        const clipDuration = this.getClipDuration(trackId, sceneIndex);
        const delay = clipDuration + (slot.followActionDelay * (60 / (this.appServices?.getBPM?.() || 120)));

        const timerId = setTimeout(() => {
            this.executeFollowAction(trackId, sceneIndex);
        }, delay * 1000);

        this.scenePlaybackTimers.set(`${trackId}_${sceneIndex}`, timerId);
    }

    /**
     * Get clip duration in seconds.
     */
    getClipDuration(trackId, sceneIndex) {
        const slot = this.getClipSlot(trackId, sceneIndex);
        
        if (slot.clipType === 'audio' && this.appServices?.getClipDuration) {
            return this.appServices.getClipDuration(trackId, slot.clipId);
        } else if (slot.clipType === 'midi') {
            // Calculate from sequence length and BPM
            const bpm = this.appServices?.getBPM?.() || 120;
            const beatsPerBar = 4;
            const barDuration = beatsPerBar * (60 / bpm);
            return slot.loopLength * barDuration;
        }
        
        return 4; // Default 4 bars
    }

    /**
     * Execute follow action.
     */
    executeFollowAction(trackId, sceneIndex) {
        const slot = this.getClipSlot(trackId, sceneIndex);
        
        switch (slot.followAction) {
            case FOLLOW_ACTION.STOP:
                this.stopClip(trackId, sceneIndex);
                break;
            case FOLLOW_ACTION.LOOP:
                this.startClipPlayback(trackId, sceneIndex, 127);
                break;
            case FOLLOW_ACTION.PLAY_NEXT_SCENE:
                const nextIndex = sceneIndex + 1;
                if (nextIndex < this.scenes.length) {
                    this.stopScene(sceneIndex, false);
                    this.triggerScene(nextIndex);
                }
                break;
            case FOLLOW_ACTION.PLAY_RANDOM_SCENE:
                const randomIndex = Math.floor(Math.random() * this.scenes.length);
                this.stopScene(sceneIndex, false);
                this.triggerScene(randomIndex);
                break;
            case FOLLOW_ACTION.PLAY_SPECIFIC_SCENE:
                // Would need to specify which scene
                break;
        }
    }

    /**
     * Handle variation group exclusivity.
     */
    handleVariationGroup(groupId, triggeredTrackId, triggeredSceneIndex) {
        const group = this.variationGroups.find(g => g.id === groupId);
        if (!group) return;

        // Stop all other clips in the group
        for (const key of group.slotKeys) {
            const [trackId, sceneIndex] = key.split('_').map(Number);
            if (trackId !== triggeredTrackId || sceneIndex !== triggeredSceneIndex) {
                const slot = this.getClipSlot(trackId, sceneIndex);
                if (slot.state === CLIP_STATE.PLAYING) {
                    this.stopClip(trackId, sceneIndex);
                }
            }
        }
    }

    /**
     * Create a variation group.
     */
    createVariationGroup(name = 'Variation Group') {
        const group = new VariationGroup(name);
        this.variationGroups.push(group);
        console.log(`[PlaylistView] Created variation group "${name}"`);
        return group;
    }

    /**
     * Add clip to variation group.
     */
    addClipToVariationGroup(groupId, trackId, sceneIndex) {
        const group = this.variationGroups.find(g => g.id === groupId);
        if (!group) return false;

        group.addSlot(trackId, sceneIndex);
        
        const slot = this.getClipSlot(trackId, sceneIndex);
        slot.variationGroupId = groupId;

        console.log(`[PlaylistView] Added clip to variation group "${group.name}"`);
        return true;
    }

    /**
     * Remove clip from variation group.
     */
    removeClipFromVariationGroup(groupId, trackId, sceneIndex) {
        const group = this.variationGroups.find(g => g.id === groupId);
        if (!group) return false;

        group.removeSlot(trackId, sceneIndex);
        
        const slot = this.getClipSlot(trackId, sceneIndex);
        slot.variationGroupId = null;

        // Remove empty groups
        if (group.slotKeys.length === 0) {
            this.variationGroups = this.variationGroups.filter(g => g.id !== groupId);
        }

        return true;
    }

    /**
     * Map a MIDI note to trigger a scene.
     */
    mapSceneToMIDI(sceneId, midiNote, midiChannel = 0) {
        const scene = this.scenes.find(s => s.id === sceneId);
        if (!scene) return false;

        scene.midiNote = midiNote;
        scene.midiChannel = midiChannel;

        console.log(`[PlaylistView] Mapped scene "${scene.name}" to MIDI note ${midiNote} (channel ${midiChannel})`);
        return true;
    }

    /**
     * Handle incoming MIDI for scene triggering.
     */
    handleMIDIInput(midiNote, velocity, channel = 0) {
        // Find scene mapped to this note
        for (const scene of this.scenes) {
            if (scene.midiNote === midiNote && scene.midiChannel === channel) {
                if (velocity > 0) {
                    this.triggerScene(scene.index, velocity);
                } else {
                    this.stopScene(scene.index);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Set scene properties.
     */
    setSceneProperties(sceneId, properties) {
        const scene = this.scenes.find(s => s.id === sceneId);
        if (!scene) return false;

        if (properties.name !== undefined) scene.name = properties.name;
        if (properties.color !== undefined) scene.color = properties.color;
        if (properties.tempo !== undefined) scene.tempo = properties.tempo;
        if (properties.timeSignature !== undefined) scene.timeSignature = properties.timeSignature;
        if (properties.launchQuantize !== undefined) scene.launchQuantize = properties.launchQuantize;

        return true;
    }

    /**
     * Set clip slot properties.
     */
    setClipSlotProperties(trackId, sceneIndex, properties) {
        const slot = this.getClipSlot(trackId, sceneIndex);

        if (properties.name !== undefined) slot.name = properties.name;
        if (properties.color !== undefined) slot.color = properties.color;
        if (properties.isLooping !== undefined) slot.isLooping = properties.isLooping;
        if (properties.loopLength !== undefined) slot.loopLength = properties.loopLength;
        if (properties.followAction !== undefined) slot.followAction = properties.followAction;
        if (properties.launchQuantize !== undefined) slot.launchQuantize = properties.launchQuantize;
        if (properties.probability !== undefined) slot.probability = properties.probability;
        if (properties.velocityAmount !== undefined) slot.velocityAmount = properties.velocityAmount;

        return true;
    }

    /**
     * Convert entire playlist to JSON for saving.
     */
    toJSON() {
        return {
            scenes: this.scenes.map(s => s.toJSON()),
            clipSlots: Array.from(this.clipSlots.entries()).map(([key, slot]) => ({
                key,
                ...slot.toJSON()
            })),
            variationGroups: this.variationGroups.map(g => g.toJSON()),
            numScenes: this.scenes.length,
            currentSceneIndex: this.currentSceneIndex
        };
    }

    /**
     * Load from JSON.
     */
    static fromJSON(data, appServices) {
        const manager = new PlaylistViewManager(appServices);
        
        manager.scenes = (data.scenes || []).map(s => PlaylistScene.fromJSON(s));
        manager.clipSlots = new Map();
        
        for (const slotData of data.clipSlots || []) {
            const slot = PlaylistClipSlot.fromJSON(slotData);
            manager.clipSlots.set(slotData.key, slot);
        }
        
        manager.variationGroups = (data.variationGroups || []).map(g => VariationGroup.fromJSON(g));
        manager.currentSceneIndex = data.currentSceneIndex || -1;

        return manager;
    }

    /**
     * Export playlist to linear timeline arrangement.
     * Creates a timeline version of the playlist.
     */
    exportToArrangement() {
        const arrangement = [];
        
        // Calculate timing for each scene
        let currentTime = 0;
        const bpm = this.appServices?.getBPM?.() || 120;
        const beatDuration = 60 / bpm;
        
        for (let sceneIndex = 0; sceneIndex < this.scenes.length; sceneIndex++) {
            const scene = this.scenes[sceneIndex];
            const trackIds = this.getUniqueTrackIds();
            
            // Find longest clip in scene to determine scene duration
            let maxDuration = 4 * beatDuration * 4; // Default 4 bars
            
            for (const trackId of trackIds) {
                const slot = this.getClipSlot(trackId, sceneIndex);
                if (slot.hasClip()) {
                    const duration = this.getClipDuration(trackId, sceneIndex);
                    maxDuration = Math.max(maxDuration, duration);
                }
            }
            
            // Add clips to arrangement
            for (const trackId of trackIds) {
                const slot = this.getClipSlot(trackId, sceneIndex);
                if (slot.hasClip()) {
                    arrangement.push({
                        trackId,
                        clipId: slot.clipId,
                        clipType: slot.clipType,
                        startTime: currentTime,
                        duration: maxDuration
                    });
                }
            }
            
            currentTime += maxDuration;
        }
        
        console.log(`[PlaylistView] Exported to arrangement: ${arrangement.length} clip placements`);
        return arrangement;
    }

    /**
     * Get all clip slots for a track (column).
     */
    getTrackColumn(trackId) {
        const column = [];
        for (let i = 0; i < this.scenes.length; i++) {
            column.push(this.getClipSlot(trackId, i));
        }
        return column;
    }

    /**
     * Get all clip slots for a scene (row).
     */
    getSceneRow(sceneIndex) {
        const row = [];
        const trackIds = this.getUniqueTrackIds();
        for (const trackId of trackIds) {
            row.push(this.getClipSlot(trackId, sceneIndex));
        }
        return row;
    }

    /**
     * Dispose - clean up timers.
     */
    dispose() {
        for (const timerId of this.scenePlaybackTimers.values()) {
            clearTimeout(timerId);
        }
        this.scenePlaybackTimers.clear();
        console.log(`[PlaylistView] Disposed`);
    }
}

// Export constants
export { LAUNCH_QUANTIZE, FOLLOW_ACTION, CLIP_STATE };

/**
 * Create a default playlist view manager.
 */
export function createPlaylistViewManager(appServices) {
    return new PlaylistViewManager(appServices);
}