// js/TrackGroupManager.js - Track Group Management for SnugOS DAW
// Allows grouping tracks together for collective solo/mute/visibility operations

class TrackGroupManager {
    constructor() {
        this.groups = new Map(); // groupId -> { name, trackIds: [], collapsed: false }
        this.nextGroupId = 1;
        this.listeners = [];
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem('snugosTrackGroups');
            if (saved) {
                const data = JSON.parse(saved);
                this.groups = new Map(data.groups || []);
                this.nextGroupId = data.nextGroupId || 1;
            }
        } catch (e) {
            console.warn('Failed to load track groups:', e);
        }
    }

    save() {
        try {
            const data = {
                groups: Array.from(this.groups.entries()),
                nextGroupId: this.nextGroupId
            };
            localStorage.setItem('snugosTrackGroups', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save track groups:', e);
        }
    }

    createGroup(name = null) {
        const id = `group_${this.nextGroupId++}`;
        const group = {
            name: name || `Group ${id}`,
            trackIds: [],
            collapsed: false
        };
        this.groups.set(id, group);
        this.save();
        this.notify();
        return id;
    }

    deleteGroup(groupId) {
        if (this.groups.delete(groupId)) {
            this.save();
            this.notify();
            return true;
        }
        return false;
    }

    addTrackToGroup(groupId, trackId) {
        const group = this.groups.get(groupId);
        if (group && !group.trackIds.includes(trackId)) {
            group.trackIds.push(trackId);
            this.save();
            this.notify();
            return true;
        }
        return false;
    }

    removeTrackFromGroup(groupId, trackId) {
        const group = this.groups.get(groupId);
        if (group) {
            const idx = group.trackIds.indexOf(trackId);
            if (idx !== -1) {
                group.trackIds.splice(idx, 1);
                this.save();
                this.notify();
                return true;
            }
        }
        return false;
    }

    getGroupContainingTrack(trackId) {
        for (const [id, group] of this.groups) {
            if (group.trackIds.includes(trackId)) return id;
        }
        return null;
    }

    getGroupTracks(groupId) {
        const group = this.groups.get(groupId);
        return group ? [...group.trackIds] : [];
    }

    getAllGroups() {
        const result = [];
        for (const [id, group] of this.groups) {
            result.push({ id, ...group, trackIds: [...group.trackIds] });
        }
        return result;
    }

    toggleGroupCollapsed(groupId) {
        const group = this.groups.get(groupId);
        if (group) {
            group.collapsed = !group.collapsed;
            this.save();
            this.notify();
            return group.collapsed;
        }
        return null;
    }

    renameGroup(groupId, newName) {
        const group = this.groups.get(groupId);
        if (group) {
            group.name = newName;
            this.save();
            this.notify();
            return true;
        }
        return false;
    }

    onchange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    notify() {
        this.listeners.forEach(l => l(this.getAllGroups()));
    }
}

// Global instance
const trackGroupManager = new TrackGroupManager();

// Export for window access
window.trackGroupManager = trackGroupManager;
window.TrackGroupManager = TrackGroupManager;