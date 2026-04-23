// js/MuteGroups.js - Track Mute Groups Module
// Mute groups are "exclusive" - only one track in the group can be unmuted at a time.
// Useful for: drum variations, bass variations, synth layers, A/B testing.

import { getTracksState } from './state.js';

// Mute groups state
let muteGroups = []; // Array of { id, name, trackIds, activeTrackId, color }
let muteGroupIdCounter = 1;

// Reference to app services (set during initialization)
let appServices = null;

/**
 * Initialize the MuteGroups module with app services.
 * @param {Object} services - App services object
 */
export function initializeMuteGroups(services) {
    appServices = services || {};
    console.log('[MuteGroups] Module initialized');
}

/**
 * Get all mute groups.
 * @returns {Array} Array of mute group objects
 */
export function getMuteGroups() {
    return muteGroups;
}

/**
 * Get a mute group by ID.
 * @param {number} groupId - The group ID
 * @returns {Object|null} Mute group object or null
 */
export function getMuteGroupById(groupId) {
    return muteGroups.find(g => g.id === groupId) || null;
}

/**
 * Create a new mute group.
 * @param {string} name - Group name
 * @param {Array} trackIds - Array of track IDs to include
 * @param {string} color - Group color (hex)
 * @returns {Object} The created mute group
 */
export function createMuteGroup(name = 'Mute Group', trackIds = [], color = '#ec4899') {
    const group = {
        id: muteGroupIdCounter++,
        name: name,
        trackIds: [...trackIds],
        activeTrackId: trackIds.length > 0 ? trackIds[0] : null,
        color: color
    };
    
    muteGroups.push(group);
    console.log(`[MuteGroups] Created mute group: ${name} with ${trackIds.length} tracks`);
    
    // Apply exclusive muting - only active track is unmuted
    if (group.activeTrackId !== null) {
        applyExclusiveMute(group.id);
    }
    
    if (appServices.showNotification) {
        appServices.showNotification(`Created mute group "${name}"`, 2000);
    }
    
    return group;
}

/**
 * Remove a mute group.
 * @param {number} groupId - The group ID to remove
 * @returns {boolean} True if removed
 */
export function removeMuteGroup(groupId) {
    const index = muteGroups.findIndex(g => g.id === groupId);
    if (index === -1) return false;
    
    const removed = muteGroups.splice(index, 1)[0];
    console.log(`[MuteGroups] Removed mute group: ${removed.name}`);
    
    if (appServices.showNotification) {
        appServices.showNotification(`Removed mute group "${removed.name}"`, 2000);
    }
    
    return true;
}

/**
 * Rename a mute group.
 * @param {number} groupId - The group ID
 * @param {string} newName - New name
 * @returns {boolean} True if renamed
 */
export function renameMuteGroup(groupId, newName) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    group.name = newName;
    console.log(`[MuteGroups] Renamed mute group ${groupId} to "${newName}"`);
    return true;
}

/**
 * Add a track to a mute group.
 * @param {number} groupId - The group ID
 * @param {number} trackId - The track ID to add
 * @returns {boolean} True if added
 */
export function addTrackToMuteGroup(groupId, trackId) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    // Check if track is already in another mute group
    const existingGroup = getMuteGroupForTrack(trackId);
    if (existingGroup && existingGroup.id !== groupId) {
        // Remove from existing group first
        removeTrackFromMuteGroup(existingGroup.id, trackId);
    }
    
    if (!group.trackIds.includes(trackId)) {
        group.trackIds.push(trackId);
        
        // If this is the first track, make it active
        if (group.trackIds.length === 1) {
            group.activeTrackId = trackId;
            applyExclusiveMute(groupId);
        }
        
        console.log(`[MuteGroups] Added track ${trackId} to mute group ${groupId}`);
        
        if (appServices.updateMuteGroupsUI) {
            appServices.updateMuteGroupsUI();
        }
    }
    
    return true;
}

/**
 * Remove a track from a mute group.
 * @param {number} groupId - The group ID
 * @param {number} trackId - The track ID to remove
 * @returns {boolean} True if removed
 */
export function removeTrackFromMuteGroup(groupId, trackId) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    const index = group.trackIds.indexOf(trackId);
    if (index !== -1) {
        group.trackIds.splice(index, 1);
        
        // If the removed track was active, set another track as active
        if (group.activeTrackId === trackId) {
            group.activeTrackId = group.trackIds.length > 0 ? group.trackIds[0] : null;
            applyExclusiveMute(groupId);
        }
        
        console.log(`[MuteGroups] Removed track ${trackId} from mute group ${groupId}`);
        
        if (appServices.updateMuteGroupsUI) {
            appServices.updateMuteGroupsUI();
        }
    }
    
    return true;
}

/**
 * Set the active track in a mute group (exclusively unmutes this track).
 * @param {number} groupId - The group ID
 * @param {number} trackId - The track ID to make active (unmuted)
 * @returns {boolean} True if set
 */
export function setActiveTrackInMuteGroup(groupId, trackId) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group) return false;
    
    if (!group.trackIds.includes(trackId)) {
        console.warn(`[MuteGroups] Track ${trackId} is not in mute group ${groupId}`);
        return false;
    }
    
    group.activeTrackId = trackId;
    applyExclusiveMute(groupId);
    
    console.log(`[MuteGroups] Set active track in mute group ${groupId} to track ${trackId}`);
    
    // Find the track name for notification
    const tracks = getTracksState();
    const track = tracks.find(t => t.id === trackId);
    if (appServices.showNotification && track) {
        appServices.showNotification(`Activated "${track.name}" in group "${group.name}"`, 1500);
    }
    
    return true;
}

/**
 * Apply exclusive muting - mute all tracks except the active one.
 * @param {number} groupId - The group ID
 */
function applyExclusiveMute(groupId) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group || group.trackIds.length === 0) return;
    
    const tracks = getTracksState();
    
    group.trackIds.forEach(trackId => {
        const track = tracks.find(t => t.id === trackId);
        if (track && track.setMuted) {
            const shouldBeMuted = trackId !== group.activeTrackId;
            track.setMuted(shouldBeMuted);
            
            if (appServices.updateTrackUI) {
                appServices.updateTrackUI(trackId, 'muteState');
            }
        }
    });
    
    console.log(`[MuteGroups] Applied exclusive mute for group ${groupId}. Active track: ${group.activeTrackId}`);
}

/**
 * Toggle active track in a mute group (cycles to next track).
 * @param {number} groupId - The group ID
 * @returns {number|null} New active track ID
 */
export function toggleNextInMuteGroup(groupId) {
    const group = muteGroups.find(g => g.id === groupId);
    if (!group || group.trackIds.length === 0) return null;
    
    const currentIndex = group.trackIds.indexOf(group.activeTrackId);
    const nextIndex = (currentIndex + 1) % group.trackIds.length;
    const newActiveTrackId = group.trackIds[nextIndex];
    
    setActiveTrackInMuteGroup(groupId, newActiveTrackId);
    return newActiveTrackId;
}

/**
 * Get which mute group a track belongs to.
 * @param {number} trackId - The track ID
 * @returns {Object|null} Mute group or null
 */
export function getMuteGroupForTrack(trackId) {
    return muteGroups.find(g => g.trackIds.includes(trackId)) || null;
}

/**
 * Clear all mute groups.
 */
export function clearAllMuteGroups() {
    muteGroups = [];
    muteGroupIdCounter = 1;
    console.log('[MuteGroups] Cleared all mute groups');
}

/**
 * Get mute groups data for project save.
 * @returns {Array} Serializable mute groups data
 */
export function getMuteGroupsForSave() {
    return muteGroups.map(g => ({
        id: g.id,
        name: g.name,
        trackIds: [...g.trackIds],
        activeTrackId: g.activeTrackId,
        color: g.color
    }));
}

/**
 * Restore mute groups from saved data.
 * @param {Array} data - Saved mute groups data
 */
export function restoreMuteGroups(data) {
    if (!Array.isArray(data)) return;
    
    muteGroups = data.map(g => ({
        id: g.id,
        name: g.name,
        trackIds: [...g.trackIds],
        activeTrackId: g.activeTrackId,
        color: g.color
    }));
    
    // Update counter to avoid ID conflicts
    if (muteGroups.length > 0) {
        muteGroupIdCounter = Math.max(...muteGroups.map(g => g.id)) + 1;
    }
    
    console.log(`[MuteGroups] Restored ${muteGroups.length} mute groups`);
}

/**
 * Handle track deletion - remove from mute groups if present.
 * @param {number} trackId - The deleted track ID
 */
export function handleTrackDeleted(trackId) {
    muteGroups.forEach(group => {
        const index = group.trackIds.indexOf(trackId);
        if (index !== -1) {
            group.trackIds.splice(index, 1);
            
            if (group.activeTrackId === trackId) {
                group.activeTrackId = group.trackIds.length > 0 ? group.trackIds[0] : null;
                if (group.activeTrackId !== null) {
                    applyExclusiveMute(group.id);
                }
            }
            
            console.log(`[MuteGroups] Removed deleted track ${trackId} from group ${group.id}`);
        }
    });
}

/**
 * Get the active track ID for a mute group.
 * @param {number} groupId - The group ID
 * @returns {number|null} Active track ID or null
 */
export function getActiveTrackInMuteGroup(groupId) {
    const group = muteGroups.find(g => g.id === groupId);
    return group ? group.activeTrackId : null;
}