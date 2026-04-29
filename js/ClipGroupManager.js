// js/ClipGroupManager.js - Organize and manage groups of clips with shared properties

let localAppServices = {};
let clipGroups = {}; // { groupId: { id, name, color, opacity, fadePoints, clipIds: [], createdAt } }
let groupIdCounter = 0;

/**
 * Initialize the clip group manager
 * @param {object} services - App services
 */
export function initClipGroupManager(services) {
    localAppServices = services;
    console.log('[ClipGroupManager] Initialized');
}

/**
 * Create a new clip group from selected clips
 * @param {Array} clipSelections - Array of { clipId, trackId }
 * @param {string} name - Optional group name
 * @returns {object|null} - The created group or null
 */
export function createClipGroup(clipSelections, name = null) {
    if (!clipSelections || clipSelections.length < 2) {
        localAppServices.showNotification?.('Select at least 2 clips to group', 2000);
        return null;
    }

    const groupId = `clipGroup_${++groupIdCounter}_${Date.now()}`;
    const groupName = name || `Group ${groupIdCounter}`;

    // Get shared properties from first clip
    const firstSel = clipSelections[0];
    const firstTrack = localAppServices.getTrackById?.(firstSel.trackId);
    const firstClip = firstTrack?.timelineClips?.find(c => c.id === firstSel.clipId);

    const sharedColor = firstClip?.color || '#3b82f6';
    const sharedOpacity = firstClip?.opacity !== undefined ? firstClip.opacity : 1.0;

    clipGroups[groupId] = {
        id: groupId,
        name: groupName,
        color: sharedColor,
        opacity: sharedOpacity,
        fadePoints: { in: [], out: [] },
        clipIds: clipSelections.map(s => ({ clipId: s.clipId, trackId: s.trackId })),
        createdAt: new Date().toISOString()
    };

    // Assign groupId to all clips
    clipSelections.forEach(({ clipId, trackId }) => {
        const track = localAppServices.getTrackById?.(trackId);
        const clip = track?.timelineClips?.find(c => c.id === clipId);
        if (clip) {
            clip.groupId = groupId;
        }
    });

    localAppServices.showNotification?.(`Created group "${groupName}" with ${clipSelections.length} clips`, 2000);
    localAppServices.renderTimeline?.();

    return clipGroups[groupId];
}

/**
 * Ungroup clips from a group (disband the group but keep clips)
 * @param {string} groupId
 */
export function ungroupClips(groupId) {
    const group = clipGroups[groupId];
    if (!group) return;

    // Remove groupId from all clips
    group.clipIds.forEach(({ clipId, trackId }) => {
        const track = localAppServices.getTrackById?.(trackId);
        const clip = track?.timelineClips?.find(c => c.id === clipId);
        if (clip) {
            delete clip.groupId;
        }
    });

    delete clipGroups[groupId];
    localAppServices.showNotification?.('Clips ungrouped', 1500);
    localAppServices.renderTimeline?.();
}

/**
 * Add clips to an existing group
 * @param {string} groupId
 * @param {Array} clipSelections - Array of { clipId, trackId }
 */
export function addToGroup(groupId, clipSelections) {
    const group = clipGroups[groupId];
    if (!group) return;

    clipSelections.forEach(({ clipId, trackId }) => {
        // Avoid duplicates
        if (!group.clipIds.some(c => c.clipId === clipId && c.trackId === trackId)) {
            group.clipIds.push({ clipId, trackId });
            const track = localAppServices.getTrackById?.(trackId);
            const clip = track?.timelineClips?.find(c => c.id === clipId);
            if (clip) clip.groupId = groupId;
        }
    });

    localAppServices.showNotification?.(`Added ${clipSelections.length} clips to group`, 1500);
    localAppServices.renderTimeline?.();
}

/**
 * Remove clips from a group (keep in group if 2+ remain)
 * @param {string} groupId
 * @param {Array} clipSelections - Array of { clipId, trackId }
 */
export function removeFromGroup(groupId, clipSelections) {
    const group = clipGroups[groupId];
    if (!group) return;

    clipSelections.forEach(({ clipId, trackId }) => {
        const idx = group.clipIds.findIndex(c => c.clipId === clipId && c.trackId === trackId);
        if (idx > -1) {
            group.clipIds.splice(idx, 1);
            const track = localAppServices.getTrackById?.(trackId);
            const clip = track?.timelineClips?.find(c => c.id === clipId);
            if (clip) delete clip.groupId;
        }
    });

    // If fewer than 2 clips remain, disband the group
    if (group.clipIds.length < 2) {
        ungroupClips(groupId);
        return;
    }

    localAppServices.renderTimeline?.();
}

/**
 * Get group by ID
 * @param {string} groupId
 */
export function getClipGroup(groupId) {
    return clipGroups[groupId] || null;
}

/**
 * Get all clip groups
 */
export function getAllClipGroups() {
    return Object.values(clipGroups);
}

/**
 * Rename a clip group
 * @param {string} groupId
 * @param {string} newName
 */
export function renameClipGroup(groupId, newName) {
    const group = clipGroups[groupId];
    if (group) {
        group.name = newName;
        localAppServices.renderTimeline?.();
    }
}

/**
 * Set group color
 * @param {string} groupId
 * @param {string} color
 */
export function setGroupColor(groupId, color) {
    const group = clipGroups[groupId];
    if (!group) return;

    group.color = color;
    // Apply to all clips
    group.clipIds.forEach(({ clipId, trackId }) => {
        const track = localAppServices.getTrackById?.(trackId);
        const clip = track?.timelineClips?.find(c => c.id === clipId);
        if (clip) clip.color = color;
    });

    localAppServices.renderTimeline?.();
}

/**
 * Set group opacity
 * @param {string} groupId
 * @param {number} opacity
 */
export function setGroupOpacity(groupId, opacity) {
    const group = clipGroups[groupId];
    if (!group) return;

    group.opacity = Math.max(0, Math.min(1, opacity));
    group.clipIds.forEach(({ clipId, trackId }) => {
        const track = localAppServices.getTrackById?.(trackId);
        const clip = track?.timelineClips?.find(c => c.id === clipId);
        if (clip) clip.opacity = group.opacity;
    });

    localAppServices.renderTimeline?.();
}

/**
 * Move all clips in a group by a delta (seconds)
 * @param {string} groupId
 * @param {number} deltaSeconds
 */
export function moveGroup(groupId, deltaSeconds) {
    const group = clipGroups[groupId];
    if (!group) return;

    group.clipIds.forEach(({ clipId, trackId }) => {
        const track = localAppServices.getTrackById?.(trackId);
        const clip = track?.timelineClips?.find(c => c.id === clipId);
        if (clip) {
            clip.startTime = Math.max(0, (clip.startTime || 0) + deltaSeconds);
            if (clip.endTime !== undefined) {
                clip.endTime += deltaSeconds;
            }
        }
    });

    localAppServices.renderTimeline?.();
}

/**
 * Delete all clips in a group
 * @param {string} groupId
 */
export function deleteGroupClips(groupId) {
    const group = clipGroups[groupId];
    if (!group) return;

    localAppServices.captureStateForUndo?.('Delete clip group');

    group.clipIds.forEach(({ clipId, trackId }) => {
        const track = localAppServices.getTrackById?.(trackId);
        if (track?.timelineClips) {
            const idx = track.timelineClips.findIndex(c => c.id === clipId);
            if (idx > -1) track.timelineClips.splice(idx, 1);
        }
    });

    delete clipGroups[groupId];
    localAppServices.showNotification?.('Group clips deleted', 1500);
    localAppServices.renderTimeline?.();
}

/**
 * Get clip selections from current selection state
 */
export function getCurrentClipSelections() {
    if (typeof localAppServices.getSelectedClipIds === 'function') {
        return Array.from(localAppServices.getSelectedClipIds() || []);
    }
    // Fallback: get from DOM
    const selected = document.querySelectorAll('.timeline-clip.selected');
    return Array.from(selected).map(el => ({
        clipId: el.dataset.clipId,
        trackId: parseInt(el.dataset.trackId)
    }));
}

/**
 * Apply group settings to all clips in group (color, opacity, fades)
 * @param {string} groupId
 */
export function applyGroupSettings(groupId) {
    const group = clipGroups[groupId];
    if (!group) return;

    group.clipIds.forEach(({ clipId, trackId }) => {
        const track = localAppServices.getTrackById?.(trackId);
        const clip = track?.timelineClips?.find(c => c.id === clipId);
        if (clip) {
            clip.color = group.color;
            clip.opacity = group.opacity;
            if (group.fadePoints?.in?.length) clip.fadePoints = { in: [...group.fadePoints.in], out: [...group.fadePoints.out] };
        }
    });

    localAppServices.renderTimeline?.();
}

// Export for state serialization
export function serializeClipGroups() {
    return JSON.parse(JSON.stringify(clipGroups));
}

export function deserializeClipGroups(data) {
    if (!data) return;
    clipGroups = typeof data === 'object' ? data : {};
    groupIdCounter = Object.keys(clipGroups).length;
}

// Expose on window for other modules
if (typeof window !== 'undefined') {
    window.ClipGroupManager = {
        init: initClipGroupManager,
        createGroup: createClipGroup,
        ungroup: ungroupClips,
        addToGroup,
        removeFromGroup,
        getGroup: getClipGroup,
        getAllGroups: getAllClipGroups,
        rename: renameClipGroup,
        setColor: setGroupColor,
        setOpacity: setGroupOpacity,
        move: moveGroup,
        deleteClips: deleteGroupClips,
        applySettings: applyGroupSettings,
        getSelections: getCurrentClipSelections,
        serialize: serializeClipGroups,
        deserialize: deserializeClipGroups
    };
}