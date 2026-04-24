/**
 * Clip Gain Group
 * Group clips for collective gain adjustment
 */

export class ClipGainGroup {
    constructor() {
        this.groups = new Map(); // groupId -> { name, clips: [], baseGain, enabled }
        this.clipGroups = new Map(); // clipId -> groupId
        this.activeGroupId = null;
    }

    /**
     * Create a new group
     */
    createGroup(name = 'Group') {
        const groupId = `gain-group-${Date.now()}`;
        
        this.groups.set(groupId, {
            id: groupId,
            name,
            clips: [],
            baseGain: 1,
            enabled: true
        });
        
        return groupId;
    }

    /**
     * Delete a group (clips become ungrouped)
     */
    deleteGroup(groupId) {
        const group = this.groups.get(groupId);
        
        if (group) {
            // Remove all clips from group
            group.clips.forEach(clipId => {
                this.clipGroups.delete(clipId);
            });
            
            this.groups.delete(groupId);
            
            if (this.activeGroupId === groupId) {
                this.activeGroupId = null;
            }
            
            return true;
        }
        
        return false;
    }

    /**
     * Add a clip to a group
     */
    addClipToGroup(clipId, groupId, clipGain = 1) {
        // Remove from existing group if any
        this.removeClipFromGroup(clipId);
        
        const group = this.groups.get(groupId);
        if (group) {
            group.clips.push({
                id: clipId,
                originalGain: clipGain,
                currentGain: clipGain
            });
            
            this.clipGroups.set(clipId, groupId);
            return true;
        }
        
        return false;
    }

    /**
     * Remove a clip from its group
     */
    removeClipFromGroup(clipId) {
        const groupId = this.clipGroups.get(clipId);
        
        if (groupId) {
            const group = this.groups.get(groupId);
            if (group) {
                group.clips = group.clips.filter(c => c.id !== clipId);
            }
            this.clipGroups.delete(clipId);
            return true;
        }
        
        return false;
    }

    /**
     * Get all groups
     */
    getGroups() {
        return Array.from(this.groups.values());
    }

    /**
     * Get a specific group
     */
    getGroup(groupId) {
        return this.groups.get(groupId);
    }

    /**
     * Get group for a clip
     */
    getClipGroup(clipId) {
        const groupId = this.clipGroups.get(clipId);
        return groupId ? this.groups.get(groupId) : null;
    }

    /**
     * Set group gain (affects all clips in group)
     */
    setGroupGain(groupId, gain) {
        const group = this.groups.get(groupId);
        
        if (group) {
            group.baseGain = Math.max(0, Math.min(2, gain));
            
            // Update all clips in group
            group.clips.forEach(clip => {
                clip.currentGain = clip.originalGain * group.baseGain;
            });
            
            return true;
        }
        
        return false;
    }

    /**
     * Get effective gain for a clip
     */
    getClipGain(clipId) {
        const groupId = this.clipGroups.get(clipId);
        
        if (groupId) {
            const group = this.groups.get(groupId);
            if (group && group.enabled) {
                const clip = group.clips.find(c => c.id === clipId);
                return clip ? clip.currentGain : 1;
            }
        }
        
        return 1;
    }

    /**
     * Enable/disable a group
     */
    setGroupEnabled(groupId, enabled) {
        const group = this.groups.get(groupId);
        if (group) {
            group.enabled = enabled;
            return true;
        }
        return false;
    }

    /**
     * Set active group for editing
     */
    setActiveGroup(groupId) {
        if (this.groups.has(groupId)) {
            this.activeGroupId = groupId;
            return true;
        }
        return false;
    }

    /**
     * Get active group
     */
    getActiveGroup() {
        return this.activeGroupId ? this.groups.get(this.activeGroupId) : null;
    }

    /**
     * Rename a group
     */
    renameGroup(groupId, name) {
        const group = this.groups.get(groupId);
        if (group) {
            group.name = name;
            return true;
        }
        return false;
    }

    /**
     * Normalize group (all clips to same effective gain)
     */
    normalizeGroup(groupId, targetGain = 1) {
        const group = this.groups.get(groupId);
        
        if (group && group.clips.length > 0) {
            // Find loudest clip
            let maxGain = 0;
            group.clips.forEach(clip => {
                if (clip.originalGain > maxGain) {
                    maxGain = clip.originalGain;
                }
            });
            
            // Set group gain to normalize
            if (maxGain > 0) {
                group.baseGain = targetGain / maxGain;
                
                group.clips.forEach(clip => {
                    clip.currentGain = clip.originalGain * group.baseGain;
                });
                
                return true;
            }
        }
        
        return false;
    }

    /**
     * Apply gain ramp to group
     */
    applyGainRamp(groupId, startGain, endGain) {
        const group = this.groups.get(groupId);
        
        if (group && group.clips.length > 0) {
            const step = (endGain - startGain) / (group.clips.length - 1 || 1);
            
            group.clips.forEach((clip, index) => {
                const rampGain = startGain + step * index;
                clip.currentGain = clip.originalGain * rampGain;
            });
            
            group.baseGain = (startGain + endGain) / 2;
            return true;
        }
        
        return false;
    }

    /**
     * Invert gains in group (loudest becomes quietest, etc.)
     */
    invertGains(groupId) {
        const group = this.groups.get(groupId);
        
        if (group && group.clips.length > 0) {
            // Find min and max gains
            let minGain = Infinity;
            let maxGain = 0;
            
            group.clips.forEach(clip => {
                if (clip.originalGain < minGain) minGain = clip.originalGain;
                if (clip.originalGain > maxGain) maxGain = clip.originalGain;
            });
            
            // Invert
            group.clips.forEach(clip => {
                const normalized = (clip.originalGain - minGain) / (maxGain - minGain || 1);
                clip.currentGain = minGain + (1 - normalized) * (maxGain - minGain);
            });
            
            return true;
        }
        
        return false;
    }

    /**
     * Randomize gains in group
     */
    randomizeGains(groupId, minGain = 0.5, maxGain = 1.5) {
        const group = this.groups.get(groupId);
        
        if (group) {
            group.clips.forEach(clip => {
                const randomGain = minGain + Math.random() * (maxGain - minGain);
                clip.currentGain = randomGain;
            });
            
            return true;
        }
        
        return false;
    }

    /**
     * Get group presets
     */
    static getPresets() {
        return [
            { name: 'Unity Gain', gain: 1 },
            { name: 'Boost +3dB', gain: 1.41 },
            { name: 'Boost +6dB', gain: 2 },
            { name: 'Cut -3dB', gain: 0.71 },
            { name: 'Cut -6dB', gain: 0.5 },
            { name: 'Cut -12dB', gain: 0.25 },
            { name: 'Half Volume', gain: 0.5 },
            { name: 'Quarter Volume', gain: 0.25 },
            { name: 'Double Volume', gain: 2 }
        ];
    }

    /**
     * Apply preset to group
     */
    applyPreset(groupId, presetName) {
        const presets = ClipGainGroup.getPresets();
        const preset = presets.find(p => p.name === presetName);
        
        if (preset) {
            return this.setGroupGain(groupId, preset.gain);
        }
        
        return false;
    }

    /**
     * Export group data
     */
    exportGroups() {
        return {
            groups: Array.from(this.groups.values()).map(g => ({
                id: g.id,
                name: g.name,
                clips: g.clips.map(c => ({
                    id: c.id,
                    originalGain: c.originalGain,
                    currentGain: c.currentGain
                })),
                baseGain: g.baseGain,
                enabled: g.enabled
            })),
            clipGroups: Array.from(this.clipGroups.entries())
        };
    }

    /**
     * Import group data
     */
    importGroups(data) {
        if (data.groups) {
            data.groups.forEach(g => {
                this.groups.set(g.id, {
                    id: g.id,
                    name: g.name,
                    clips: g.clips || [],
                    baseGain: g.baseGain,
                    enabled: g.enabled
                });
            });
        }
        
        if (data.clipGroups) {
            data.clipGroups.forEach(([clipId, groupId]) => {
                this.clipGroups.set(clipId, groupId);
            });
        }
    }
}

// UI Panel for clip gain groups
let clipGainGroupPanel = null;

export function openClipGainGroupPanel(services = {}) {
    if (clipGainGroupPanel) {
        clipGainGroupPanel.remove();
    }
    
    const groupManager = new ClipGainGroup();
    
    const panel = document.createElement('div');
    panel.className = 'snug-window clip-gain-group-panel';
    panel.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        width: 550px;
        max-height: 550px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div class="panel-header" style="
            padding: 12px 16px;
            background: linear-gradient(180deg, #2a2a4e 0%, #1a1a2e 100%);
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <h3 style="margin: 0; color: #fff; font-size: 16px;">Clip Gain Groups</h3>
            <button class="close-btn" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
            ">×</button>
        </div>
        
        <div class="panel-content" style="padding: 16px; max-height: 450px; overflow-y: auto;">
            <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <button id="createGroupBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 12px;
                ">+ New Group</button>
                <button id="addToGroupBtn" style="
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    cursor: pointer;
                    font-size: 12px;
                ">Add Selected Clips</button>
                <select id="groupSelect" style="
                    flex: 1;
                    background: #2a2a4e;
                    color: #fff;
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 6px;
                ">
                    <option value="">-- Select Group --</option>
                </select>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">Preset</label>
                <select id="gainPreset" style="
                    width: 100%;
                    background: #2a2a4e;
                    color: #fff;
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 6px;
                ">
                    <option value="">-- Select Preset --</option>
                </select>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 12px; margin-bottom: 4px;">
                    Group Gain: <span id="gainValue">100%</span>
                </label>
                <input type="range" id="groupGain" min="0" max="2" step="0.01" value="1" style="width: 100%;">
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
                <button id="normalizeBtn" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">Normalize</button>
                <button id="invertBtn" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">Invert</button>
                <button id="randomizeBtn" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">Randomize</button>
                <button id="rampBtn" style="background: #3a3a6e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; font-size: 11px;">Ramp</button>
            </div>
            
            <div id="groupsList" style="
                background: #0a0a1e;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 8px;
                min-height: 100px;
                max-height: 150px;
                overflow-y: auto;
                margin-bottom: 16px;
            ">
                <div style="color: #666; text-align: center; padding: 20px;">No groups created</div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="applyBtn" style="
                    background: linear-gradient(180deg, #4a9eff 0%, #2a5eff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 20px;
                    cursor: pointer;
                    font-weight: bold;
                ">Apply Gains</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    clipGainGroupPanel = panel;
    
    // Populate presets
    const presetSelect = panel.querySelector('#gainPreset');
    ClipGainGroup.getPresets().forEach(p => {
        const option = document.createElement('option');
        option.value = p.name;
        option.textContent = p.name;
        presetSelect.appendChild(option);
    });
    
    // Get elements
    const groupSelect = panel.querySelector('#groupSelect');
    const gainInput = panel.querySelector('#groupGain');
    const gainValue = panel.querySelector('#gainValue');
    const groupsList = panel.querySelector('#groupsList');
    
    // Update groups list
    const updateGroupsList = () => {
        const groups = groupManager.getGroups();
        
        // Update group select
        const currentValue = groupSelect.value;
        groupSelect.innerHTML = '<option value="">-- Select Group --</option>';
        groups.forEach(g => {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = `${g.name} (${g.clips.length} clips)`;
            groupSelect.appendChild(option);
        });
        groupSelect.value = currentValue;
        
        if (groups.length === 0) {
            groupsList.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">No groups created</div>';
            return;
        }
        
        groupsList.innerHTML = groups.map(g => `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px;
                margin-bottom: 4px;
                background: ${g.id === groupManager.activeGroupId ? '#4a4a8e' : '#2a2a4e'};
                border-radius: 4px;
                cursor: pointer;
            " data-group-id="${g.id}">
                <div>
                    <div style="color: #fff; font-size: 12px; font-weight: bold;">${g.name}</div>
                    <div style="color: #888; font-size: 11px;">${g.clips.length} clips | Gain: ${Math.round(g.baseGain * 100)}%</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button data-action="toggle" style="
                        background: ${g.enabled ? '#00ff88' : '#ff4a4a'};
                        color: #000;
                        border: none;
                        border-radius: 3px;
                        padding: 4px 8px;
                        cursor: pointer;
                        font-size: 10px;
                    ">${g.enabled ? 'ON' : 'OFF'}</button>
                    <button data-action="delete" style="
                        background: #6e3a3a;
                        color: #fff;
                        border: none;
                        border-radius: 3px;
                        padding: 4px 8px;
                        cursor: pointer;
                        font-size: 10px;
                    ">×</button>
                </div>
            </div>
        `).join('');
    };
    
    // Event handlers
    const closeBtn = panel.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        panel.remove();
        clipGainGroupPanel = null;
    });
    
    const createGroupBtn = panel.querySelector('#createGroupBtn');
    createGroupBtn.addEventListener('click', () => {
        const name = `Group ${groupManager.getGroups().length + 1}`;
        const groupId = groupManager.createGroup(name);
        groupManager.setActiveGroup(groupId);
        updateGroupsList();
        groupSelect.value = groupId;
    });
    
    const addToGroupBtn = panel.querySelector('#addToGroupBtn');
    addToGroupBtn.addEventListener('click', () => {
        const groupId = groupManager.activeGroupId || groupSelect.value;
        
        if (!groupId) {
            alert('Please select or create a group first');
            return;
        }
        
        // Get selected clips
        if (services.getSelectedClips) {
            const clips = services.getSelectedClips();
            clips.forEach(clip => {
                groupManager.addClipToGroup(clip.id, groupId, clip.gain ?? 1);
            });
        } else {
            // Demo: add dummy clips
            for (let i = 1; i <= 3; i++) {
                groupManager.addClipToGroup(`clip-${Date.now()}-${i}`, groupId, 0.5 + Math.random());
            }
        }
        
        updateGroupsList();
    });
    
    groupSelect.addEventListener('change', () => {
        if (groupSelect.value) {
            groupManager.setActiveGroup(groupSelect.value);
            const group = groupManager.getActiveGroup();
            if (group) {
                gainInput.value = group.baseGain;
                gainValue.textContent = `${Math.round(group.baseGain * 100)}%`;
            }
            updateGroupsList();
        }
    });
    
    gainInput.addEventListener('input', () => {
        const groupId = groupManager.activeGroupId;
        if (groupId) {
            const gain = parseFloat(gainInput.value);
            groupManager.setGroupGain(groupId, gain);
            gainValue.textContent = `${Math.round(gain * 100)}%`;
            updateGroupsList();
        }
    });
    
    presetSelect.addEventListener('change', () => {
        if (presetSelect.value && groupManager.activeGroupId) {
            groupManager.applyPreset(groupManager.activeGroupId, presetSelect.value);
            const group = groupManager.getActiveGroup();
            if (group) {
                gainInput.value = group.baseGain;
                gainValue.textContent = `${Math.round(group.baseGain * 100)}%`;
            }
            updateGroupsList();
        }
    });
    
    // Group list actions
    groupsList.addEventListener('click', (e) => {
        const row = e.target.closest('[data-group-id]');
        if (!row) return;
        
        const groupId = row.dataset.groupId;
        const action = e.target.dataset.action;
        
        if (action === 'toggle') {
            const group = groupManager.getGroup(groupId);
            groupManager.setGroupEnabled(groupId, !group.enabled);
        } else if (action === 'delete') {
            groupManager.deleteGroup(groupId);
        } else {
            // Select group
            groupManager.setActiveGroup(groupId);
            groupSelect.value = groupId;
            const group = groupManager.getActiveGroup();
            if (group) {
                gainInput.value = group.baseGain;
                gainValue.textContent = `${Math.round(group.baseGain * 100)}%`;
            }
        }
        
        updateGroupsList();
    });
    
    // Action buttons
    const normalizeBtn = panel.querySelector('#normalizeBtn');
    normalizeBtn.addEventListener('click', () => {
        if (groupManager.activeGroupId) {
            groupManager.normalizeGroup(groupManager.activeGroupId);
            updateGroupsList();
        }
    });
    
    const invertBtn = panel.querySelector('#invertBtn');
    invertBtn.addEventListener('click', () => {
        if (groupManager.activeGroupId) {
            groupManager.invertGains(groupManager.activeGroupId);
            updateGroupsList();
        }
    });
    
    const randomizeBtn = panel.querySelector('#randomizeBtn');
    randomizeBtn.addEventListener('click', () => {
        if (groupManager.activeGroupId) {
            groupManager.randomizeGains(groupManager.activeGroupId);
            updateGroupsList();
        }
    });
    
    const rampBtn = panel.querySelector('#rampBtn');
    rampBtn.addEventListener('click', () => {
        if (groupManager.activeGroupId) {
            groupManager.applyGainRamp(groupManager.activeGroupId, 0.5, 1.5);
            updateGroupsList();
        }
    });
    
    // Apply button
    const applyBtn = panel.querySelector('#applyBtn');
    applyBtn.addEventListener('click', () => {
        if (services.applyClipGains) {
            const groups = groupManager.getGroups();
            groups.forEach(group => {
                if (group.enabled) {
                    group.clips.forEach(clip => {
                        services.applyClipGains(clip.id, clip.currentGain);
                    });
                }
            });
        }
    });
    
    return panel;
}

export default ClipGainGroup;