/**
 * Track Grouping - Group tracks for collective editing
 * Allows creating track groups for collective volume, mute, solo, effects, and editing operations
 */

import { getTracksState } from './state.js';

// Track Groups state
let trackGroups = []; // Array of { id, name, trackIds, color, collapsed, settings }
let trackGroupIdCounter = 1;

// Reference to app services
let appServices = null;

/**
 * Initialize the Track Groups module
 */
export function initializeTrackGroups(services) {
    appServices = services || {};
    console.log('[TrackGroups] Module initialized');
}

/**
 * Get all track groups
 */
export function getTrackGroups() {
    return trackGroups;
}

/**
 * Get a track group by ID
 */
export function getTrackGroupById(groupId) {
    return trackGroups.find(g => g.id === groupId) || null;
}

/**
 * Get the group a track belongs to
 */
export function getTrackGroupForTrack(trackId) {
    return trackGroups.find(g => g.trackIds.includes(trackId)) || null;
}

/**
 * Create a new track group
 */
export function createTrackGroup(name = 'Track Group', trackIds = [], options = {}) {
    const group = {
        id: trackGroupIdCounter++,
        name: name,
        trackIds: [...trackIds],
        color: options.color || getRandomGroupColor(),
        collapsed: options.collapsed ?? false,
        
        // Group settings
        settings: {
            // Volume control
            groupVolume: 1.0,
            volumeLinked: options.volumeLinked ?? true,
            
            // Mute/Solo
            groupMute: false,
            groupSolo: false,
            muteLinked: options.muteLinked ?? true,
            soloLinked: options.soloLinked ?? true,
            
            // Pan
            groupPan: 0,
            panLinked: options.panLinked ?? false,
            
            // Effects
            effectsLinked: options.effectsLinked ?? false,
            
            // Edit modes
            editLocked: options.editLocked ?? false,
            selectionLinked: options.selectionLinked ?? true,
            
            // Visual
            showInMixer: options.showInMixer ?? true,
            showInTimeline: options.showInTimeline ?? true
        },
        
        // Pre-group states (for restoring individual settings)
        savedStates: new Map(), // trackId -> saved state
        
        // Created timestamp
        createdAt: Date.now()
    };
    
    // Save initial states of member tracks
    trackIds.forEach(trackId => {
        const track = findTrack(trackId);
        if (track) {
            group.savedStates.set(trackId, {
                volume: track.volume ?? 1.0,
                muted: track.muted ?? false,
                solo: track.solo ?? false,
                pan: track.pan ?? 0
            });
        }
    });
    
    trackGroups.push(group);
    
    console.log(`[TrackGroups] Created group "${name}" with ${trackIds.length} tracks`);
    
    if (appServices.showNotification) {
        appServices.showNotification(`Created track group "${name}"`, 2000);
    }
    
    if (appServices.updateTrackGroupsUI) {
        appServices.updateTrackGroupsUI();
    }
    
    return group;
}

/**
 * Remove a track group
 */
export function removeTrackGroup(groupId) {
    const index = trackGroups.findIndex(g => g.id === groupId);
    if (index === -1) return false;
    
    const group = trackGroups[index];
    
    // Optionally restore individual track states
    if (appServices.restoreIndividualStates !== false) {
        group.trackIds.forEach(trackId => {
            const savedState = group.savedStates.get(trackId);
            if (savedState) {
                const track = findTrack(trackId);
                if (track) {
                    if (track.setVolume) track.setVolume(savedState.volume);
                    if (track.setMuted) track.setMuted(savedState.muted);
                    if (track.setSolo) track.setSolo(savedState.solo);
                    if (track.setPan) track.setPan(savedState.pan);
                }
            }
        });
    }
    
    trackGroups.splice(index, 1);
    
    console.log(`[TrackGroups] Removed group "${group.name}"`);
    
    if (appServices.showNotification) {
        appServices.showNotification(`Removed track group "${group.name}"`, 2000);
    }
    
    if (appServices.updateTrackGroupsUI) {
        appServices.updateTrackGroupsUI();
    }
    
    return true;
}

/**
 * Rename a track group
 */
export function renameTrackGroup(groupId, newName) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.name = newName;
    
    if (appServices.updateTrackGroupsUI) {
        appServices.updateTrackGroupsUI();
    }
    
    return true;
}

/**
 * Add a track to a group
 */
export function addTrackToGroup(groupId, trackId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    // Check if track is already in another group
    const existingGroup = getTrackGroupForTrack(trackId);
    if (existingGroup) {
        removeTrackFromGroup(existingGroup.id, trackId);
    }
    
    if (!group.trackIds.includes(trackId)) {
        const track = findTrack(trackId);
        
        // Save track's current state
        if (track) {
            group.savedStates.set(trackId, {
                volume: track.volume ?? 1.0,
                muted: track.muted ?? false,
                solo: track.solo ?? false,
                pan: track.pan ?? 0
            });
        }
        
        group.trackIds.push(trackId);
        
        // Apply group settings to new track
        applyGroupSettingsToTrack(group, trackId);
        
        console.log(`[TrackGroups] Added track ${trackId} to group "${group.name}"`);
        
        if (appServices.updateTrackGroupsUI) {
            appServices.updateTrackGroupsUI();
        }
    }
    
    return true;
}

/**
 * Remove a track from a group
 */
export function removeTrackFromGroup(groupId, trackId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    const index = group.trackIds.indexOf(trackId);
    if (index === -1) return false;
    
    group.trackIds.splice(index, 1);
    
    // Restore track's individual state
    const savedState = group.savedStates.get(trackId);
    if (savedState) {
        const track = findTrack(trackId);
        if (track) {
            if (track.setVolume) track.setVolume(savedState.volume);
            if (track.setMuted) track.setMuted(savedState.muted);
            if (track.setSolo) track.setSolo(savedState.solo);
            if (track.setPan) track.setPan(savedState.pan);
        }
        group.savedStates.delete(trackId);
    }
    
    console.log(`[TrackGroups] Removed track ${trackId} from group "${group.name}"`);
    
    if (appServices.updateTrackGroupsUI) {
        appServices.updateTrackGroupsUI();
    }
    
    return true;
}

/**
 * Set group volume (applies to all tracks if volume linked)
 */
export function setGroupVolume(groupId, volume) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.settings.groupVolume = volume;
    
    if (group.settings.volumeLinked) {
        group.trackIds.forEach(trackId => {
            const track = findTrack(trackId);
            if (track && track.setVolume) {
                track.setVolume(volume);
            }
        });
        
        if (appServices.updateTrackUI) {
            group.trackIds.forEach(trackId => {
                appServices.updateTrackUI(trackId, 'volume');
            });
        }
    }
    
    return true;
}

/**
 * Set group mute (applies to all tracks if mute linked)
 */
export function setGroupMute(groupId, muted) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.settings.groupMute = muted;
    
    if (group.settings.muteLinked) {
        group.trackIds.forEach(trackId => {
            const track = findTrack(trackId);
            if (track && track.setMuted) {
                track.setMuted(muted);
            }
        });
        
        if (appServices.updateTrackUI) {
            group.trackIds.forEach(trackId => {
                appServices.updateTrackUI(trackId, 'mute');
            });
        }
    }
    
    return true;
}

/**
 * Set group solo (applies to all tracks if solo linked)
 */
export function setGroupSolo(groupId, solo) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.settings.groupSolo = solo;
    
    if (group.settings.soloLinked) {
        group.trackIds.forEach(trackId => {
            const track = findTrack(trackId);
            if (track && track.setSolo) {
                track.setSolo(solo);
            }
        });
        
        if (appServices.updateTrackUI) {
            group.trackIds.forEach(trackId => {
                appServices.updateTrackUI(trackId, 'solo');
            });
        }
    }
    
    return true;
}

/**
 * Set group pan (applies to all tracks if pan linked)
 */
export function setGroupPan(groupId, pan) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.settings.groupPan = pan;
    
    if (group.settings.panLinked) {
        group.trackIds.forEach(trackId => {
            const track = findTrack(trackId);
            if (track && track.setPan) {
                track.setPan(pan);
            }
        });
        
        if (appServices.updateTrackUI) {
            group.trackIds.forEach(trackId => {
                appServices.updateTrackUI(trackId, 'pan');
            });
        }
    }
    
    return true;
}

/**
 * Toggle group collapse
 */
export function toggleGroupCollapse(groupId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.collapsed = !group.collapsed;
    
    if (appServices.updateTrackGroupsUI) {
        appServices.updateTrackGroupsUI();
    }
    
    return true;
}

/**
 * Duplicate group (creates new group with duplicated tracks)
 */
export function duplicateGroup(groupId, options = {}) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return null;
    
    // Duplicate each track
    const newTrackIds = [];
    
    if (appServices.duplicateTrack) {
        for (const trackId of group.trackIds) {
            const newTrackId = appServices.duplicateTrack(trackId);
            if (newTrackId) {
                newTrackIds.push(newTrackId);
            }
        }
    }
    
    // Create new group with duplicated tracks
    const newGroup = createTrackGroup(
        options.name || `${group.name} (Copy)`,
        newTrackIds,
        {
            color: options.color || group.color,
            collapsed: group.collapsed,
            volumeLinked: group.settings.volumeLinked,
            muteLinked: group.settings.muteLinked,
            soloLinked: group.settings.soloLinked,
            panLinked: group.settings.panLinked
        }
    );
    
    // Copy group settings
    newGroup.settings.groupVolume = group.settings.groupVolume;
    newGroup.settings.groupMute = group.settings.groupMute;
    newGroup.settings.groupSolo = group.settings.groupSolo;
    newGroup.settings.groupPan = group.settings.groupPan;
    
    return newGroup;
}

/**
 * Move group up/down in order
 */
export function moveGroup(groupId, direction) {
    const index = trackGroups.findIndex(g => g.id === groupId);
    if (index === -1) return false;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= trackGroups.length) return false;
    
    // Swap
    [trackGroups[index], trackGroups[newIndex]] = [trackGroups[newIndex], trackGroups[index]];
    
    if (appServices.updateTrackGroupsUI) {
        appServices.updateTrackGroupsUI();
    }
    
    return true;
}

/**
 * Select all tracks in a group
 */
export function selectGroupTracks(groupId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    if (appServices.selectTracks) {
        appServices.selectTracks(group.trackIds);
    }
    
    return true;
}

/**
 * Ungroup - remove group but keep tracks
 */
export function ungroup(groupId) {
    const group = trackGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    // Restore individual states
    group.trackIds.forEach(trackId => {
        const savedState = group.savedStates.get(trackId);
        if (savedState) {
            const track = findTrack(trackId);
            if (track) {
                if (track.setVolume) track.setVolume(savedState.volume);
                if (track.setMuted) track.setMuted(savedState.muted);
                if (track.setSolo) track.setSolo(savedState.solo);
                if (track.setPan) track.setPan(savedState.pan);
            }
        }
    });
    
    // Remove group
    trackGroups = trackGroups.filter(g => g.id !== groupId);
    
    console.log(`[TrackGroups] Ungrouped "${group.name}"`);
    
    if (appServices.showNotification) {
        appServices.showNotification(`Ungrouped "${group.name}"`, 2000);
    }
    
    if (appServices.updateTrackGroupsUI) {
        appServices.updateTrackGroupsUI();
    }
    
    return true;
}

/**
 * Apply group settings to a track
 */
function applyGroupSettingsToTrack(group, trackId) {
    const track = findTrack(trackId);
    if (!track) return;
    
    if (group.settings.volumeLinked && track.setVolume) {
        track.setVolume(group.settings.groupVolume);
    }
    
    if (group.settings.muteLinked && track.setMuted) {
        track.setMuted(group.settings.groupMute);
    }
    
    if (group.settings.soloLinked && track.setSolo) {
        track.setSolo(group.settings.groupSolo);
    }
    
    if (group.settings.panLinked && track.setPan) {
        track.setPan(group.settings.groupPan);
    }
}

/**
 * Find a track by ID
 */
function findTrack(trackId) {
    const tracks = getTracksState();
    return tracks.find(t => t.id === trackId) || null;
}

/**
 * Get a random group color
 */
function getRandomGroupColor() {
    const colors = [
        '#22c55e', // Green
        '#3b82f6', // Blue
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#8b5cf6', // Purple
        '#06b6d4', // Cyan
        '#ef4444', // Red
        '#84cc16'  // Lime
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Handle track deletion
 */
export function handleTrackDeletedFromGroups(trackId) {
    trackGroups.forEach(group => {
        const index = group.trackIds.indexOf(trackId);
        if (index !== -1) {
            group.trackIds.splice(index, 1);
            group.savedStates.delete(trackId);
            
            // Remove empty groups
            if (group.trackIds.length === 0) {
                removeTrackGroup(group.id);
            }
        }
    });
}

/**
 * Clear all track groups
 */
export function clearAllTrackGroups() {
    trackGroups = [];
    trackGroupIdCounter = 1;
    
    if (appServices.updateTrackGroupsUI) {
        appServices.updateTrackGroupsUI();
    }
}

/**
 * Get data for project save
 */
export function getTrackGroupsForSave() {
    return trackGroups.map(g => ({
        id: g.id,
        name: g.name,
        trackIds: [...g.trackIds],
        color: g.color,
        collapsed: g.collapsed,
        settings: { ...g.settings },
        createdAt: g.createdAt
    }));
}

/**
 * Restore from saved data
 */
export function restoreTrackGroups(data) {
    if (!Array.isArray(data)) return;
    
    trackGroups = data.map(g => ({
        id: g.id,
        name: g.name,
        trackIds: [...g.trackIds],
        color: g.color,
        collapsed: g.collapsed,
        settings: { ...g.settings },
        savedStates: new Map(),
        createdAt: g.createdAt
    }));
    
    // Update counter
    if (trackGroups.length > 0) {
        trackGroupIdCounter = Math.max(...trackGroups.map(g => g.id)) + 1;
    }
    
    console.log(`[TrackGroups] Restored ${trackGroups.length} groups`);
}

/**
 * Create the track groups panel UI
 */
export function createTrackGroupsPanel(appServices) {
    const container = document.createElement('div');
    container.className = 'track-groups-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 450px;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Track Groups';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Create group section
    const createSection = document.createElement('div');
    createSection.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    createSection.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 12px; color: #9ca3af;">Create New Group</div>
        <div style="display: flex; gap: 8px;">
            <input type="text" id="groupNameInput" placeholder="Group name" style="
                flex: 1;
                padding: 8px;
                background: #374151;
                border: none;
                border-radius: 4px;
                color: white;
            ">
            <button id="createGroupBtn" style="
                padding: 8px 16px;
                background: #22c55e;
                border: none;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-weight: 600;
            ">Create</button>
        </div>
    `;
    container.appendChild(createSection);
    
    // Groups list
    const groupsList = document.createElement('div');
    groupsList.id = 'groupsList';
    groupsList.style.cssText = 'margin-bottom: 16px;';
    container.appendChild(groupsList);
    
    // Actions
    const actionsContainer = document.createElement('div');
    actionsContainer.style.cssText = 'display: flex; gap: 8px;';
    actionsContainer.innerHTML = `
        <button id="clearAllBtn" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Clear All Groups
        </button>
    `;
    container.appendChild(actionsContainer);
    
    // Update groups list
    function updateGroupsList() {
        const groups = getTrackGroups();
        
        if (groups.length === 0) {
            groupsList.innerHTML = `
                <div style="color: #6b7280; font-style: italic; text-align: center; padding: 16px;">
                    No track groups created
                </div>
            `;
            return;
        }
        
        const tracks = getTracksState();
        
        groupsList.innerHTML = groups.map(group => `
            <div class="group-item" data-group-id="${group.id}" style="
                margin-bottom: 8px;
                padding: 12px;
                background: #0a0a14;
                border-radius: 4px;
                border-left: 3px solid ${group.color};
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600;">${group.name}</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="group-action" data-action="select" data-group="${group.id}" title="Select tracks" style="
                            padding: 4px 8px;
                            background: #374151;
                            border: none;
                            border-radius: 4px;
                            color: white;
                            cursor: pointer;
                            font-size: 10px;
                        ">Select</button>
                        <button class="group-action" data-action="duplicate" data-group="${group.id}" title="Duplicate group" style="
                            padding: 4px 8px;
                            background: #374151;
                            border: none;
                            border-radius: 4px;
                            color: white;
                            cursor: pointer;
                            font-size: 10px;
                        ">Copy</button>
                        <button class="group-action" data-action="ungroup" data-group="${group.id}" title="Ungroup" style="
                            padding: 4px 8px;
                            background: #374151;
                            border: none;
                            border-radius: 4px;
                            color: white;
                            cursor: pointer;
                            font-size: 10px;
                        ">Ungroup</button>
                        <button class="group-action" data-action="delete" data-group="${group.id}" title="Delete group" style="
                            padding: 4px 8px;
                            background: #ef4444;
                            border: none;
                            border-radius: 4px;
                            color: white;
                            cursor: pointer;
                            font-size: 10px;
                        ">✕</button>
                    </div>
                </div>
                <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">
                    ${group.trackIds.length} tracks: ${group.trackIds.map(id => {
                        const track = tracks.find(t => t.id === id);
                        return track?.name || `Track ${id}`;
                    }).join(', ')}
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <input type="range" class="group-volume" data-group="${group.id}" min="0" max="1" step="0.01" value="${group.settings.groupVolume}" style="flex: 1;">
                    <button class="group-mute" data-group="${group.id}" style="
                        padding: 4px 8px;
                        background: ${group.settings.groupMute ? '#ef4444' : '#374151'};
                        border: none;
                        border-radius: 4px;
                        color: white;
                        cursor: pointer;
                        font-size: 10px;
                    ">M</button>
                    <button class="group-solo" data-group="${group.id}" style="
                        padding: 4px 8px;
                        background: ${group.settings.groupSolo ? '#f59e0b' : '#374151'};
                        border: none;
                        border-radius: 4px;
                        color: white;
                        cursor: pointer;
                        font-size: 10px;
                    ">S</button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        groupsList.querySelectorAll('.group-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const groupId = parseInt(btn.dataset.group);
                
                switch (action) {
                    case 'select':
                        selectGroupTracks(groupId);
                        break;
                    case 'duplicate':
                        duplicateGroup(groupId);
                        break;
                    case 'ungroup':
                        ungroup(groupId);
                        break;
                    case 'delete':
                        removeTrackGroup(groupId);
                        break;
                }
                
                updateGroupsList();
            });
        });
        
        // Volume sliders
        groupsList.querySelectorAll('.group-volume').forEach(slider => {
            slider.addEventListener('input', () => {
                const groupId = parseInt(slider.dataset.group);
                setGroupVolume(groupId, parseFloat(slider.value));
            });
        });
        
        // Mute buttons
        groupsList.querySelectorAll('.group-mute').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupId = parseInt(btn.dataset.group);
                const group = getTrackGroupById(groupId);
                setGroupMute(groupId, !group.settings.groupMute);
                updateGroupsList();
            });
        });
        
        // Solo buttons
        groupsList.querySelectorAll('.group-solo').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupId = parseInt(btn.dataset.group);
                const group = getTrackGroupById(groupId);
                setGroupSolo(groupId, !group.settings.groupSolo);
                updateGroupsList();
            });
        });
    }
    
    // Event handlers
    document.getElementById('createGroupBtn').addEventListener('click', () => {
        const nameInput = document.getElementById('groupNameInput');
        const name = nameInput.value.trim() || 'Track Group';
        
        // Get selected tracks
        const selectedTracks = appServices?.getSelectedTracks?.() || [];
        
        if (selectedTracks.length === 0) {
            appServices?.showNotification?.('Select tracks to group first', 2000);
            return;
        }
        
        createTrackGroup(name, selectedTracks);
        nameInput.value = '';
        updateGroupsList();
    });
    
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        if (confirm('Clear all track groups?')) {
            clearAllTrackGroups();
            updateGroupsList();
        }
    });
    
    // Initialize
    updateGroupsList();
    
    return container;
}

export default {
    initializeTrackGroups,
    getTrackGroups,
    getTrackGroupById,
    getTrackGroupForTrack,
    createTrackGroup,
    removeTrackGroup,
    renameTrackGroup,
    addTrackToGroup,
    removeTrackFromGroup,
    setGroupVolume,
    setGroupMute,
    setGroupSolo,
    setGroupPan,
    toggleGroupCollapse,
    duplicateGroup,
    moveGroup,
    selectGroupTracks,
    ungroup,
    handleTrackDeletedFromGroups,
    clearAllTrackGroups,
    getTrackGroupsForSave,
    restoreTrackGroups,
    createTrackGroupsPanel
};