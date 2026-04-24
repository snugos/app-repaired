/**
 * ClipGainGroupEnhancement.js
 * Group clips for collective gain editing
 * Enables linking multiple clips for synchronized gain adjustments
 */

export class ClipGainGroup {
    constructor(options = {}) {
        // Group settings
        this.settings = {
            groupId: options.groupId ?? `group_${Date.now()}`,
            groupName: options.groupName ?? 'Gain Group',
            color: options.color ?? '#3b82f6',
            linkGain: options.linkGain ?? true,
            linkFade: options.linkFade ?? false,
            linkMute: options.linkMute ?? false,
            proportionalMode: options.proportionalMode ?? false, // Maintain relative levels
            lockRatio: options.lockRatio ?? false
        };
        
        // Clips in this group
        this.clips = new Map(); // clipId -> { clip, relativeGain, originalGain }
        
        // Group gain (master)
        this.masterGain = 1.0;
        this.masterGainDb = 0;
        
        // Callbacks
        this.onClipUpdate = options.onClipUpdate ?? null;
        this.onGroupUpdate = options.onGroupUpdate ?? null;
    }
    
    /**
     * Add a clip to the group
     */
    addClip(clip, relativeGain = null) {
        const clipId = clip.id || `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Calculate relative gain if not provided
        const clipGain = clip.gain ?? 1.0;
        const relGain = relativeGain ?? (clipGain / this.masterGain);
        
        this.clips.set(clipId, {
            clip,
            id: clipId,
            relativeGain: relGain,
            originalGain: clipGain,
            currentGain: clipGain,
            muted: clip.muted ?? false
        });
        
        console.log(`[ClipGainGroup] Added clip ${clipId} to group "${this.settings.groupName}"`);
        
        return clipId;
    }
    
    /**
     * Remove a clip from the group
     */
    removeClip(clipId) {
        const clipData = this.clips.get(clipId);
        if (clipData) {
            this.clips.delete(clipId);
            console.log(`[ClipGainGroup] Removed clip ${clipId} from group "${this.settings.groupName}"`);
            return true;
        }
        return false;
    }
    
    /**
     * Remove all clips from the group
     */
    clearClips() {
        this.clips.clear();
        console.log(`[ClipGainGroup] Cleared all clips from group "${this.settings.groupName}"`);
    }
    
    /**
     * Get all clip IDs in the group
     */
    getClipIds() {
        return Array.from(this.clips.keys());
    }
    
    /**
     * Get clip count
     */
    getClipCount() {
        return this.clips.size;
    }
    
    /**
     * Set master gain for the group
     */
    setMasterGain(gain, updateClips = true) {
        const oldGain = this.masterGain;
        this.masterGain = Math.max(0, Math.min(2, gain));
        this.masterGainDb = 20 * Math.log10(this.masterGain || 0.0001);
        
        console.log(`[ClipGainGroup] Master gain set to ${this.masterGain.toFixed(2)} (${this.masterGainDb.toFixed(1)}dB)`);
        
        if (updateClips && this.settings.linkGain) {
            this._updateAllClips();
        }
        
        if (this.onGroupUpdate) {
            this.onGroupUpdate({
                type: 'masterGain',
                oldValue: oldGain,
                newValue: this.masterGain,
                group: this
            });
        }
    }
    
    /**
     * Set master gain in dB
     */
    setMasterGainDb(db, updateClips = true) {
        const linear = Math.pow(10, db / 20);
        this.setMasterGain(linear, updateClips);
    }
    
    /**
     * Adjust master gain by delta dB
     */
    adjustMasterGainDb(deltaDb) {
        this.setMasterGainDb(this.masterGainDb + deltaDb);
    }
    
    /**
     * Set individual clip gain (and optionally update relative position)
     */
    setClipGain(clipId, gain, updateRelative = true) {
        const clipData = this.clips.get(clipId);
        if (!clipData) return false;
        
        const oldGain = clipData.currentGain;
        clipData.currentGain = Math.max(0, Math.min(2, gain));
        
        if (updateRelative && this.settings.proportionalMode) {
            // Update relative gain
            clipData.relativeGain = clipData.currentGain / this.masterGain;
        }
        
        // Update actual clip
        if (clipData.clip && clipData.clip.gain !== undefined) {
            clipData.clip.gain = clipData.currentGain;
        }
        
        if (this.onClipUpdate) {
            this.onClipUpdate({
                clipId,
                oldValue: oldGain,
                newValue: clipData.currentGain,
                group: this
            });
        }
        
        return true;
    }
    
    /**
     * Update all clips based on master gain
     */
    _updateAllClips() {
        if (!this.settings.linkGain) return;
        
        this.clips.forEach((clipData, clipId) => {
            let newGain;
            
            if (this.settings.proportionalMode) {
                // Maintain relative levels
                newGain = this.masterGain * clipData.relativeGain;
            } else {
                // All clips get master gain
                newGain = this.masterGain;
            }
            
            newGain = Math.max(0, Math.min(2, newGain));
            
            const oldGain = clipData.currentGain;
            clipData.currentGain = newGain;
            
            // Update actual clip
            if (clipData.clip && clipData.clip.gain !== undefined) {
                clipData.clip.gain = newGain;
            }
            
            if (this.onClipUpdate && oldGain !== newGain) {
                this.onClipUpdate({
                    clipId,
                    oldValue: oldGain,
                    newValue: newGain,
                    group: this
                });
            }
        });
    }
    
    /**
     * Mute all clips in the group
     */
    muteAll() {
        if (!this.settings.linkMute) return;
        
        this.clips.forEach(clipData => {
            clipData.muted = true;
            if (clipData.clip) {
                clipData.clip.muted = true;
            }
        });
        
        if (this.onGroupUpdate) {
            this.onGroupUpdate({ type: 'muteAll', group: this });
        }
    }
    
    /**
     * Unmute all clips in the group
     */
    unmuteAll() {
        if (!this.settings.linkMute) return;
        
        this.clips.forEach(clipData => {
            clipData.muted = false;
            if (clipData.clip) {
                clipData.clip.muted = false;
            }
        });
        
        if (this.onGroupUpdate) {
            this.onGroupUpdate({ type: 'unmuteAll', group: this });
        }
    }
    
    /**
     * Toggle mute for all clips
     */
    toggleMuteAll() {
        const firstClip = Array.from(this.clips.values())[0];
        if (firstClip?.muted) {
            this.unmuteAll();
        } else {
            this.muteAll();
        }
    }
    
    /**
     * Set fade in/out for all clips
     */
    setFadeForAll(fadeInDuration, fadeOutDuration) {
        if (!this.settings.linkFade) return;
        
        this.clips.forEach(clipData => {
            if (clipData.clip) {
                if (fadeInDuration !== undefined && clipData.clip.fadeIn !== undefined) {
                    clipData.clip.fadeIn = fadeInDuration;
                }
                if (fadeOutDuration !== undefined && clipData.clip.fadeOut !== undefined) {
                    clipData.clip.fadeOut = fadeOutDuration;
                }
            }
        });
        
        if (this.onGroupUpdate) {
            this.onGroupUpdate({
                type: 'fade',
                fadeIn: fadeInDuration,
                fadeOut: fadeOutDuration,
                group: this
            });
        }
    }
    
    /**
     * Normalize all clips to same peak level
     */
    normalizeAllToSamePeak(targetPeakDb = -1) {
        const targetLinear = Math.pow(10, targetPeakDb / 20);
        
        this.clips.forEach(clipData => {
            // Assuming clip has peakLevel property
            const peakDb = clipData.clip?.peakLevel ?? 0;
            const peakLinear = Math.pow(10, peakDb / 20);
            
            const scale = targetLinear / peakLinear;
            const newGain = Math.max(0, Math.min(2, scale));
            
            clipData.currentGain = newGain;
            clipData.relativeGain = newGain / this.masterGain;
            
            if (clipData.clip) {
                clipData.clip.gain = newGain;
            }
        });
        
        if (this.onGroupUpdate) {
            this.onGroupUpdate({ type: 'normalizeAll', group: this });
        }
    }
    
    /**
     * Reset all clips to original gains
     */
    resetToOriginal() {
        this.clips.forEach(clipData => {
            clipData.currentGain = clipData.originalGain;
            clipData.relativeGain = clipData.originalGain / this.masterGain;
            
            if (clipData.clip) {
                clipData.clip.gain = clipData.originalGain;
            }
        });
        
        if (this.onGroupUpdate) {
            this.onGroupUpdate({ type: 'reset', group: this });
        }
    }
    
    /**
     * Get group status
     */
    getStatus() {
        return {
            id: this.settings.groupId,
            name: this.settings.groupName,
            color: this.settings.color,
            clipCount: this.clips.size,
            masterGain: this.masterGain,
            masterGainDb: this.masterGainDb,
            linkGain: this.settings.linkGain,
            linkFade: this.settings.linkFade,
            linkMute: this.settings.linkMute,
            proportionalMode: this.settings.proportionalMode,
            clips: Array.from(this.clips.entries()).map(([id, data]) => ({
                id,
                currentGain: data.currentGain,
                relativeGain: data.relativeGain,
                muted: data.muted
            }))
        };
    }
    
    /**
     * Update group settings
     */
    updateSettings(newSettings) {
        Object.assign(this.settings, newSettings);
        
        if (this.onGroupUpdate) {
            this.onGroupUpdate({ type: 'settingsUpdate', group: this });
        }
    }
    
    /**
     * Serialize group for save/load
     */
    serialize() {
        return {
            settings: { ...this.settings },
            masterGain: this.masterGain,
            masterGainDb: this.masterGainDb,
            clips: Array.from(this.clips.entries()).map(([id, data]) => ({
                id,
                relativeGain: data.relativeGain,
                originalGain: data.originalGain,
                currentGain: data.currentGain,
                muted: data.muted
            }))
        };
    }
    
    /**
     * Restore from serialized data
     */
    restore(data) {
        Object.assign(this.settings, data.settings || {});
        this.masterGain = data.masterGain ?? 1.0;
        this.masterGainDb = data.masterGainDb ?? 0;
        
        // Note: Clips need to be re-added after restore
        // This just restores the stored data
    }
}

/**
 * Clip Gain Group Manager
 * Manages multiple gain groups
 */
export class ClipGainGroupManager {
    constructor() {
        this.groups = new Map(); // groupId -> ClipGainGroup
        this.clipToGroup = new Map(); // clipId -> groupId
        
        // Callbacks
        this.onClipUpdate = null;
        this.onGroupCreate = null;
        this.onGroupDelete = null;
    }
    
    /**
     * Create a new gain group
     */
    createGroup(options = {}) {
        const group = new ClipGainGroup({
            ...options,
            onClipUpdate: (data) => {
                if (this.onClipUpdate) {
                    this.onClipUpdate(data);
                }
            }
        });
        
        this.groups.set(group.settings.groupId, group);
        
        console.log(`[ClipGainGroupManager] Created group "${group.settings.groupName}" (${group.settings.groupId})`);
        
        if (this.onGroupCreate) {
            this.onGroupCreate(group);
        }
        
        return group;
    }
    
    /**
     * Delete a group
     */
    deleteGroup(groupId) {
        const group = this.groups.get(groupId);
        if (group) {
            // Remove clip mappings
            group.getClipIds().forEach(clipId => {
                this.clipToGroup.delete(clipId);
            });
            
            this.groups.delete(groupId);
            
            console.log(`[ClipGainGroupManager] Deleted group ${groupId}`);
            
            if (this.onGroupDelete) {
                this.onGroupDelete(groupId);
            }
            
            return true;
        }
        return false;
    }
    
    /**
     * Get a group by ID
     */
    getGroup(groupId) {
        return this.groups.get(groupId);
    }
    
    /**
     * Add clip to a group
     */
    addClipToGroup(clip, groupId, relativeGain = null) {
        const group = this.groups.get(groupId);
        if (!group) {
            console.warn(`[ClipGainGroupManager] Group ${groupId} not found`);
            return null;
        }
        
        // Remove from previous group if any
        const previousGroupId = this.clipToGroup.get(clip.id);
        if (previousGroupId && previousGroupId !== groupId) {
            this.removeClipFromGroup(clip.id, previousGroupId);
        }
        
        const clipId = group.addClip(clip, relativeGain);
        this.clipToGroup.set(clipId, groupId);
        
        return clipId;
    }
    
    /**
     * Remove clip from its group
     */
    removeClipFromGroup(clipId, groupId = null) {
        const gId = groupId || this.clipToGroup.get(clipId);
        if (!gId) return false;
        
        const group = this.groups.get(gId);
        if (group) {
            group.removeClip(clipId);
            this.clipToGroup.delete(clipId);
            return true;
        }
        return false;
    }
    
    /**
     * Get the group a clip belongs to
     */
    getClipGroup(clipId) {
        const groupId = this.clipToGroup.get(clipId);
        return groupId ? this.groups.get(groupId) : null;
    }
    
    /**
     * Get all groups
     */
    getAllGroups() {
        return Array.from(this.groups.values());
    }
    
    /**
     * Get all group IDs
     */
    getGroupIds() {
        return Array.from(this.groups.keys());
    }
    
    /**
     * Adjust gain for clip's group
     */
    adjustClipGroupGain(clipId, deltaDb) {
        const group = this.getClipGroup(clipId);
        if (group) {
            group.adjustMasterGainDb(deltaDb);
            return true;
        }
        return false;
    }
    
    /**
     * Serialize all groups
     */
    serialize() {
        const data = {
            groups: {},
            clipToGroup: Object.fromEntries(this.clipToGroup)
        };
        
        this.groups.forEach((group, id) => {
            data.groups[id] = group.serialize();
        });
        
        return data;
    }
    
    /**
     * Restore all groups
     */
    restore(data) {
        // Clear existing
        this.groups.clear();
        this.clipToGroup.clear();
        
        // Restore groups
        Object.entries(data.groups || {}).forEach(([id, groupData]) => {
            const group = this.createGroup(groupData.settings);
            group.restore(groupData);
        });
        
        // Restore clip mappings
        Object.entries(data.clipToGroup || {}).forEach(([clipId, groupId]) => {
            this.clipToGroup.set(clipId, groupId);
        });
    }
    
    /**
     * Create group management UI
     */
    static createPanel(manager, containerId) {
        const container = document.getElementById(containerId) || document.body;
        
        const panel = document.createElement('div');
        panel.className = 'gain-group-panel';
        panel.style.cssText = `
            padding: 16px;
            background: #1a1a2e;
            border-radius: 8px;
            color: white;
            font-family: system-ui, -apple-system, sans-serif;
            min-width: 350px;
        `;
        
        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        `;
        
        const title = document.createElement('h3');
        title.textContent = 'Clip Gain Groups';
        title.style.cssText = 'margin: 0; font-size: 16px;';
        
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ New Group';
        addBtn.style.cssText = `
            padding: 6px 12px;
            background: #3b82f6;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 12px;
        `;
        
        header.appendChild(title);
        header.appendChild(addBtn);
        panel.appendChild(header);
        
        // Groups list
        const groupsList = document.createElement('div');
        groupsList.id = 'gain-groups-list';
        groupsList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
        panel.appendChild(groupsList);
        
        // Update groups list
        const updateGroupsList = () => {
            groupsList.innerHTML = '';
            
            manager.getAllGroups().forEach(group => {
                const status = group.getStatus();
                
                const groupItem = document.createElement('div');
                groupItem.style.cssText = `
                    padding: 12px;
                    background: #2a2a4e;
                    border-radius: 6px;
                    border-left: 3px solid ${status.color};
                `;
                
                // Group header
                const groupHeader = document.createElement('div');
                groupHeader.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                `;
                
                const groupName = document.createElement('span');
                groupName.textContent = `${status.name} (${status.clipCount} clips)`;
                groupName.style.fontWeight = '600';
                
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '×';
                deleteBtn.style.cssText = `
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                    font-size: 16px;
                `;
                deleteBtn.onclick = () => {
                    manager.deleteGroup(status.id);
                    updateGroupsList();
                };
                
                groupHeader.appendChild(groupName);
                groupHeader.appendChild(deleteBtn);
                groupItem.appendChild(groupHeader);
                
                // Gain slider
                const gainGroup = document.createElement('div');
                gainGroup.style.cssText = 'margin-bottom: 8px;';
                
                const gainLabel = document.createElement('label');
                gainLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 11px;';
                gainLabel.textContent = `Master Gain: ${status.masterGainDb.toFixed(1)}dB`;
                gainGroup.appendChild(gainLabel);
                
                const gainSlider = document.createElement('input');
                gainSlider.type = 'range';
                gainSlider.min = '-30';
                gainSlider.max = '6';
                gainSlider.value = status.masterGainDb;
                gainSlider.step = '0.5';
                gainSlider.style.cssText = 'width: 100%; accent-color: #3b82f6;';
                
                gainSlider.oninput = () => {
                    group.setMasterGainDb(parseFloat(gainSlider.value));
                    gainLabel.textContent = `Master Gain: ${group.masterGainDb.toFixed(1)}dB`;
                };
                
                gainGroup.appendChild(gainSlider);
                groupItem.appendChild(gainGroup);
                
                // Options
                const optionsRow = document.createElement('div');
                optionsRow.style.cssText = 'display: flex; gap: 8px; font-size: 11px;';
                
                ['linkGain', 'linkMute', 'proportionalMode'].forEach(opt => {
                    const optLabel = document.createElement('label');
                    optLabel.style.cssText = 'display: flex; align-items: center; gap: 4px;';
                    optLabel.innerHTML = `
                        <input type="checkbox" ${status[opt] ? 'checked' : ''} 
                            style="accent-color: ${status.color};">
                        <span>${opt.replace(/([A-Z])/g, ' $1').trim()}</span>
                    `;
                    
                    optLabel.querySelector('input').onchange = (e) => {
                        group.updateSettings({ [opt]: e.target.checked });
                    };
                    
                    optionsRow.appendChild(optLabel);
                });
                
                groupItem.appendChild(optionsRow);
                groupsList.appendChild(groupItem);
            });
        };
        
        // Initial update
        updateGroupsList();
        
        // Add new group handler
        addBtn.onclick = () => {
            const group = manager.createGroup({
                groupName: `Group ${manager.getGroupIds().length + 1}`,
                color: `hsl(${Math.random() * 360}, 70%, 50%)`
            });
            updateGroupsList();
        };
        
        container.appendChild(panel);
        
        return { panel, updateGroupsList };
    }
}

export default ClipGainGroup;