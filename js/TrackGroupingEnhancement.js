/**
 * Track Grouping Enhancement - Nested track groups
 * Allows creating hierarchical track groups for complex organization
 */

// Nested Track Group State
const nestedGroupState = {
    // Root groups
    rootGroups: [],
    
    // All groups by ID
    groups: new Map(),
    
    // Track to group mapping
    trackGroups: new Map(), // trackId -> groupId
    
    // Active group
    activeGroupId: null,
    
    // Group settings
    defaultGroupColor: '#3b82f6',
    
    // Collapse state
    collapsedGroups: new Set(),
    
    // Undo/Redo
    undoStack: [],
    redoStack: [],
    
    // Callbacks
    onGroupCreate: null,
    onGroupDelete: null,
    onGroupUpdate: null,
    onTrackAdd: null,
    onTrackRemove: null
};

/**
 * Create a new track group
 */
function createTrackGroup(name, parentGroupId = null, options = {}) {
    const group = {
        id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name || `Group ${nestedGroupState.groups.size + 1}`,
        parentId: parentGroupId,
        children: [], // Child group IDs
        tracks: [], // Track IDs in this group
        color: options.color || nestedGroupState.defaultGroupColor,
        solo: false,
        mute: false,
        volume: 1.0,
        pan: 0,
        linked: true, // Whether group controls affect children
        collapsed: false,
        createdAt: Date.now(),
        
        // Group-specific settings
        routing: {
            output: 'master', // master, parent, custom
            customOutputId: null
        },
        
        // Visual settings
        order: nestedGroupState.groups.size,
        height: 'auto', // 'auto' or pixel height
        showMeters: true
    };
    
    // Add to groups map
    nestedGroupState.groups.set(group.id, group);
    
    // Add to parent's children if nested
    if (parentGroupId) {
        const parent = nestedGroupState.groups.get(parentGroupId);
        if (parent) {
            parent.children.push(group.id);
        }
    } else {
        // Add to root groups
        nestedGroupState.rootGroups.push(group.id);
    }
    
    if (nestedGroupState.onGroupCreate) {
        nestedGroupState.onGroupCreate(group);
    }
    
    return { success: true, group };
}

/**
 * Delete a track group
 */
function deleteTrackGroup(groupId, deleteChildren = false) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    // Handle children
    if (group.children.length > 0) {
        if (deleteChildren) {
            // Recursively delete children
            for (const childId of [...group.children]) {
                deleteTrackGroup(childId, true);
            }
        } else {
            // Move children to parent or root
            for (const childId of [...group.children]) {
                const child = nestedGroupState.groups.get(childId);
                if (child) {
                    child.parentId = group.parentId;
                    if (group.parentId) {
                        const parent = nestedGroupState.groups.get(group.parentId);
                        if (parent) {
                            parent.children.push(childId);
                        }
                    } else {
                        nestedGroupState.rootGroups.push(childId);
                    }
                }
            }
        }
    }
    
    // Clear track references
    for (const trackId of group.tracks) {
        nestedGroupState.trackGroups.delete(trackId);
    }
    
    // Remove from parent
    if (group.parentId) {
        const parent = nestedGroupState.groups.get(group.parentId);
        if (parent) {
            parent.children = parent.children.filter(id => id !== groupId);
        }
    } else {
        // Remove from root groups
        nestedGroupState.rootGroups = nestedGroupState.rootGroups.filter(id => id !== groupId);
    }
    
    // Delete group
    nestedGroupState.groups.delete(groupId);
    
    // Remove from collapsed set
    nestedGroupState.collapsedGroups.delete(groupId);
    
    if (nestedGroupState.onGroupDelete) {
        nestedGroupState.onGroupDelete(groupId);
    }
    
    return { success: true };
}

/**
 * Add track to group
 */
function addTrackToGroup(groupId, trackId) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    // Remove from current group if any
    const currentGroupId = nestedGroupState.trackGroups.get(trackId);
    if (currentGroupId) {
        removeTrackFromGroup(currentGroupId, trackId);
    }
    
    // Add to group
    group.tracks.push(trackId);
    nestedGroupState.trackGroups.set(trackId, groupId);
    
    if (nestedGroupState.onTrackAdd) {
        nestedGroupState.onTrackAdd({ groupId, trackId });
    }
    
    return { success: true };
}

/**
 * Remove track from group
 */
function removeTrackFromGroup(groupId, trackId) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    // Remove from group
    group.tracks = group.tracks.filter(id => id !== trackId);
    nestedGroupState.trackGroups.delete(trackId);
    
    if (nestedGroupState.onTrackRemove) {
        nestedGroupState.onTrackRemove({ groupId, trackId });
    }
    
    return { success: true };
}

/**
 * Get track's group
 */
function getTrackGroup(trackId) {
    const groupId = nestedGroupState.trackGroups.get(trackId);
    if (groupId) {
        return nestedGroupState.groups.get(groupId);
    }
    return null;
}

/**
 * Get group's parent chain
 */
function getGroupAncestry(groupId) {
    const ancestry = [];
    let currentId = groupId;
    
    while (currentId) {
        const group = nestedGroupState.groups.get(currentId);
        if (group) {
            ancestry.push(group);
            currentId = group.parentId;
        } else {
            break;
        }
    }
    
    return ancestry;
}

/**
 * Get group's descendants (all nested groups)
 */
function getGroupDescendants(groupId) {
    const descendants = [];
    const queue = [groupId];
    
    while (queue.length > 0) {
        const currentId = queue.shift();
        const group = nestedGroupState.groups.get(currentId);
        
        if (group) {
            for (const childId of group.children) {
                const child = nestedGroupState.groups.get(childId);
                if (child) {
                    descendants.push(child);
                    queue.push(childId);
                }
            }
        }
    }
    
    return descendants;
}

/**
 * Get all tracks in group (including nested groups)
 */
function getAllGroupTracks(groupId) {
    const tracks = [];
    const group = nestedGroupState.groups.get(groupId);
    
    if (!group) return tracks;
    
    // Add direct tracks
    tracks.push(...group.tracks);
    
    // Add tracks from child groups
    for (const childId of group.children) {
        tracks.push(...getAllGroupTracks(childId));
    }
    
    return tracks;
}

/**
 * Set group mute
 */
function setGroupMute(groupId, muted) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    group.mute = muted;
    
    // Apply to child groups and tracks if linked
    if (group.linked) {
        const allTracks = getAllGroupTracks(groupId);
        for (const trackId of allTracks) {
            if (window.setTrackMute) {
                window.setTrackMute(trackId, muted);
            }
        }
        
        // Apply to child groups
        for (const childId of group.children) {
            const child = nestedGroupState.groups.get(childId);
            if (child && child.linked) {
                child.mute = muted;
            }
        }
    }
    
    if (nestedGroupState.onGroupUpdate) {
        nestedGroupState.onGroupUpdate({ groupId, property: 'mute', value: muted });
    }
    
    return { success: true };
}

/**
 * Set group solo
 */
function setGroupSolo(groupId, soloed) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    group.solo = soloed;
    
    // Handle solo logic - mute all other groups when one is soloed
    if (soloed) {
        // Mute all groups not in ancestry
        for (const [id, g] of nestedGroupState.groups) {
            if (id !== groupId && !isGroupAncestorOf(id, groupId)) {
                // Don't actually mute, just mark as "solo-muted"
                // This allows quick unsolo
            }
        }
    }
    
    // Apply to tracks if linked
    if (group.linked) {
        const allTracks = getAllGroupTracks(groupId);
        for (const trackId of allTracks) {
            if (window.setTrackSolo) {
                window.setTrackSolo(trackId, soloed);
            }
        }
    }
    
    if (nestedGroupState.onGroupUpdate) {
        nestedGroupState.onGroupUpdate({ groupId, property: 'solo', value: soloed });
    }
    
    return { success: true };
}

/**
 * Check if group is ancestor of another
 */
function isGroupAncestorOf(ancestorId, descendantId) {
    const ancestry = getGroupAncestry(descendantId);
    return ancestry.some(g => g.id === ancestorId);
}

/**
 * Set group volume
 */
function setGroupVolume(groupId, volume) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    group.volume = Math.max(0, Math.min(2, volume));
    
    // Apply to tracks if linked
    if (group.linked) {
        const allTracks = getAllGroupTracks(groupId);
        for (const trackId of allTracks) {
            if (window.setTrackVolume) {
                window.setTrackVolume(trackId, group.volume);
            }
        }
    }
    
    if (nestedGroupState.onGroupUpdate) {
        nestedGroupState.onGroupUpdate({ groupId, property: 'volume', value: group.volume });
    }
    
    return { success: true };
}

/**
 * Set group pan
 */
function setGroupPan(groupId, pan) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    group.pan = Math.max(-1, Math.min(1, pan));
    
    // Apply to tracks if linked
    if (group.linked) {
        const allTracks = getAllGroupTracks(groupId);
        for (const trackId of allTracks) {
            if (window.setTrackPan) {
                window.setTrackPan(trackId, group.pan);
            }
        }
    }
    
    if (nestedGroupState.onGroupUpdate) {
        nestedGroupState.onGroupUpdate({ groupId, property: 'pan', value: group.pan });
    }
    
    return { success: true };
}

/**
 * Toggle group collapse
 */
function toggleGroupCollapse(groupId) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    group.collapsed = !group.collapsed;
    
    if (group.collapsed) {
        nestedGroupState.collapsedGroups.add(groupId);
    } else {
        nestedGroupState.collapsedGroups.delete(groupId);
    }
    
    return { success: true, collapsed: group.collapsed };
}

/**
 * Set group linked state
 */
function setGroupLinked(groupId, linked) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    group.linked = linked;
    
    return { success: true };
}

/**
 * Set group color
 */
function setGroupColor(groupId, color) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    group.color = color;
    
    return { success: true };
}

/**
 * Rename group
 */
function renameGroup(groupId, name) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    group.name = name;
    
    return { success: true };
}

/**
 * Move group to new parent
 */
function moveGroup(groupId, newParentId = null) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    // Prevent moving to descendant (would create cycle)
    if (newParentId && isGroupAncestorOf(groupId, newParentId)) {
        return { success: false, error: 'Cannot move group to its descendant' };
    }
    
    // Remove from current parent
    if (group.parentId) {
        const oldParent = nestedGroupState.groups.get(group.parentId);
        if (oldParent) {
            oldParent.children = oldParent.children.filter(id => id !== groupId);
        }
    } else {
        nestedGroupState.rootGroups = nestedGroupState.rootGroups.filter(id => id !== groupId);
    }
    
    // Add to new parent
    if (newParentId) {
        const newParent = nestedGroupState.groups.get(newParentId);
        if (newParent) {
            newParent.children.push(groupId);
        }
    } else {
        nestedGroupState.rootGroups.push(groupId);
    }
    
    group.parentId = newParentId;
    
    return { success: true };
}

/**
 * Duplicate group (with all tracks and settings)
 */
function duplicateGroup(groupId) {
    const group = nestedGroupState.groups.get(groupId);
    if (!group) {
        return { success: false, error: 'Group not found' };
    }
    
    // Create new group
    const result = createTrackGroup(`${group.name} (Copy)`, group.parentId, {
        color: group.color,
        linked: group.linked
    });
    
    const newGroup = result.group;
    
    // Copy settings
    newGroup.volume = group.volume;
    newGroup.pan = group.pan;
    newGroup.mute = group.mute;
    newGroup.solo = group.solo;
    
    // Duplicate tracks (if track duplication function exists)
    if (window.duplicateTrack) {
        for (const trackId of group.tracks) {
            const newTrackId = window.duplicateTrack(trackId);
            if (newTrackId) {
                addTrackToGroup(newGroup.id, newTrackId);
            }
        }
    } else {
        // Just add track references
        newGroup.tracks = [...group.tracks];
        for (const trackId of group.tracks) {
            nestedGroupState.trackGroups.set(trackId, newGroup.id);
        }
    }
    
    // Duplicate child groups
    for (const childId of group.children) {
        const childCopy = duplicateGroup(childId);
        if (childCopy.success) {
            moveGroup(childCopy.group.id, newGroup.id);
        }
    }
    
    return { success: true, group: newGroup };
}

/**
 * Get group hierarchy (for rendering)
 */
function getGroupHierarchy() {
    function buildHierarchy(groupId) {
        const group = nestedGroupState.groups.get(groupId);
        if (!group) return null;
        
        return {
            ...group,
            children: group.children.map(childId => buildHierarchy(childId)).filter(Boolean)
        };
    }
    
    return nestedGroupState.rootGroups
        .map(groupId => buildHierarchy(groupId))
        .filter(Boolean);
}

/**
 * Get all groups (flat list)
 */
function getAllGroups() {
    return Array.from(nestedGroupState.groups.values());
}

/**
 * Get group by ID
 */
function getGroupById(groupId) {
    return nestedGroupState.groups.get(groupId);
}

/**
 * Get group depth (nesting level)
 */
function getGroupDepth(groupId) {
    return getGroupAncestry(groupId).length;
}

/**
 * Export groups as JSON
 */
function exportGroups() {
    return JSON.stringify({
        rootGroups: nestedGroupState.rootGroups,
        groups: Array.from(nestedGroupState.groups.entries()).map(([id, group]) => ({
            ...group,
            children: group.children,
            tracks: group.tracks
        })),
        trackGroups: Array.from(nestedGroupState.trackGroups.entries())
    }, null, 2);
}

/**
 * Import groups from JSON
 */
function importGroups(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        // Clear existing
        nestedGroupState.groups.clear();
        nestedGroupState.trackGroups.clear();
        nestedGroupState.rootGroups = [];
        
        // Import groups
        for (const groupData of data.groups) {
            nestedGroupState.groups.set(groupData.id, groupData);
        }
        
        // Import root groups
        nestedGroupState.rootGroups = data.rootGroups || [];
        
        // Import track mappings
        for (const [trackId, groupId] of data.trackGroups || []) {
            nestedGroupState.trackGroups.set(trackId, groupId);
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to parse groups' };
    }
}

/**
 * Undo last group action
 */
function undoGroupAction() {
    if (nestedGroupState.undoStack.length === 0) {
        return { success: false, error: 'Nothing to undo' };
    }
    
    const action = nestedGroupState.undoStack.pop();
    nestedGroupState.redoStack.push(action);
    
    // Reverse action
    switch (action.type) {
        case 'create':
            deleteTrackGroup(action.groupId);
            break;
        case 'delete':
            // Recreate group
            nestedGroupState.groups.set(action.group.id, action.group);
            if (action.group.parentId) {
                const parent = nestedGroupState.groups.get(action.group.parentId);
                if (parent) parent.children.push(action.group.id);
            } else {
                nestedGroupState.rootGroups.push(action.group.id);
            }
            break;
        case 'update':
            const group = nestedGroupState.groups.get(action.groupId);
            if (group) {
                group[action.property] = action.oldValue;
            }
            break;
    }
    
    return { success: true };
}

/**
 * Redo last undone action
 */
function redoGroupAction() {
    if (nestedGroupState.redoStack.length === 0) {
        return { success: false, error: 'Nothing to redo' };
    }
    
    const action = nestedGroupState.redoStack.pop();
    nestedGroupState.undoStack.push(action);
    
    // Re-apply action
    switch (action.type) {
        case 'create':
            nestedGroupState.groups.set(action.group.id, action.group);
            if (!action.group.parentId) {
                nestedGroupState.rootGroups.push(action.group.id);
            }
            break;
        case 'delete':
            deleteTrackGroup(action.groupId);
            break;
        case 'update':
            const group = nestedGroupState.groups.get(action.groupId);
            if (group) {
                group[action.property] = action.newValue;
            }
            break;
    }
    
    return { success: true };
}

// Export functions
window.createTrackGroup = createTrackGroup;
window.deleteTrackGroup = deleteTrackGroup;
window.addTrackToGroup = addTrackToGroup;
window.removeTrackFromGroup = removeTrackFromGroup;
window.getTrackGroup = getTrackGroup;
window.getGroupAncestry = getGroupAncestry;
window.getGroupDescendants = getGroupDescendants;
window.getAllGroupTracks = getAllGroupTracks;
window.setGroupMute = setGroupMute;
window.setGroupSolo = setGroupSolo;
window.setGroupVolume = setGroupVolume;
window.setGroupPan = setGroupPan;
window.toggleGroupCollapse = toggleGroupCollapse;
window.setGroupLinked = setGroupLinked;
window.setGroupColor = setGroupColor;
window.renameGroup = renameGroup;
window.moveGroup = moveGroup;
window.duplicateGroup = duplicateGroup;
window.getGroupHierarchy = getGroupHierarchy;
window.getAllGroups = getAllGroups;
window.getGroupById = getGroupById;
window.getGroupDepth = getGroupDepth;
window.exportGroups = exportGroups;
window.importGroups = importGroups;
window.undoGroupAction = undoGroupAction;
window.redoGroupAction = redoGroupAction;
window.nestedGroupState = nestedGroupState;

console.log('[TrackGroupingEnhancement] Module loaded');