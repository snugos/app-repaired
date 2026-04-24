// js/ProjectVersionManager.js - Manage multiple project versions/snapshots
export class ProjectVersionManager {
    constructor() {
        this.versions = [];
        this.maxVersions = 20;
        this.currentVersionIndex = -1;
    }

    createVersion(name, projectData) {
        const version = {
            id: this.generateId(),
            name: name || `Version ${this.versions.length + 1}`,
            timestamp: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(projectData)),
            description: ''
        };

        this.versions.push(version);
        
        // Trim old versions if needed
        while (this.versions.length > this.maxVersions) {
            this.versions.shift();
        }

        this.currentVersionIndex = this.versions.length - 1;
        return version;
    }

    getVersions() {
        return [...this.versions];
    }

    getVersion(id) {
        return this.versions.find(v => v.id === id);
    }

    getCurrentVersion() {
        if (this.currentVersionIndex >= 0 && 
            this.currentVersionIndex < this.versions.length) {
            return this.versions[this.currentVersionIndex];
        }
        return null;
    }

    deleteVersion(id) {
        const index = this.versions.findIndex(v => v.id === id);
        if (index !== -1) {
            this.versions.splice(index, 1);
            if (index <= this.currentVersionIndex) {
                this.currentVersionIndex = Math.max(0, this.currentVersionIndex - 1);
            }
            return true;
        }
        return false;
    }

    setDescription(id, description) {
        const version = this.getVersion(id);
        if (version) {
            version.description = description;
            return true;
        }
        return false;
    }

    generateId() {
        return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    exportToJSON() {
        return JSON.stringify(this.versions, null, 2);
    }

    importFromJSON(json) {
        try {
            const imported = JSON.parse(json);
            this.versions = imported.versions || [];
            this.currentVersionIndex = imported.currentVersionIndex || -1;
        } catch (e) {
            console.error('[ProjectVersionManager] Import failed:', e);
        }
    }
}

export function createProjectVersionManager() {
    return new ProjectVersionManager();
}