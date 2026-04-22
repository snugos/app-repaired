// js/CloudSync.js - Cloud Sync System for SnugOS DAW
// This module provides project synchronization across devices

import { storeProjectState, getProjectState, deleteProjectState, getDB, getAudio, storeAudio, deleteAudio } from './db.js';

/**
 * SyncStatus - Represents the sync status of a project
 */
export const SyncStatus = {
    SYNCED: 'synced',           // Fully synchronized
    PENDING_UPLOAD: 'pending_upload',   // Local changes need upload
    PENDING_DOWNLOAD: 'pending_download', // Remote changes need download
    CONFLICT: 'conflict',       // Both local and remote have changes
    OFFLINE: 'offline',         // No network connection
    ERROR: 'error',            // Sync error
    SYNCING: 'syncing'          // Currently syncing
};

/**
 * ConflictResolution - Strategies for resolving sync conflicts
 */
export const ConflictResolution = {
    LOCAL_WINS: 'local_wins',   // Keep local version
    REMOTE_WINS: 'remote_wins', // Keep remote version
    MERGE: 'merge',             // Attempt automatic merge
    MANUAL: 'manual'            // Require manual resolution
};

/**
 * SyncMetadata - Metadata for tracking sync state
 */
export class SyncMetadata {
    constructor(config = {}) {
        this.projectId = config.projectId || `project-${Date.now()}`;
        this.version = config.version || 1;
        this.lastSyncTime = config.lastSyncTime || null;
        this.lastModifiedTime = config.lastModifiedTime || Date.now();
        this.localHash = config.localHash || null;
        this.remoteHash = config.remoteHash || null;
        this.syncStatus = config.syncStatus || SyncStatus.PENDING_UPLOAD;
        this.conflictData = config.conflictData || null;
        this.deviceId = config.deviceId || this._generateDeviceId();
        this.deviceName = config.deviceName || 'Unknown Device';
    }

    _generateDeviceId() {
        // Generate a unique device ID
        let deviceId = localStorage.getItem('snugos_device_id');
        if (!deviceId) {
            deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('snugos_device_id', deviceId);
        }
        return deviceId;
    }

    toJSON() {
        return {
            projectId: this.projectId,
            version: this.version,
            lastSyncTime: this.lastSyncTime,
            lastModifiedTime: this.lastModifiedTime,
            localHash: this.localHash,
            remoteHash: this.remoteHash,
            syncStatus: this.syncStatus,
            conflictData: this.conflictData,
            deviceId: this.deviceId,
            deviceName: this.deviceName
        };
    }

    static fromJSON(data) {
        return new SyncMetadata(data);
    }
}

/**
 * SyncConflict - Represents a sync conflict
 */
export class SyncConflict {
    constructor(config = {}) {
        this.id = config.id || `conflict-${Date.now()}`;
        this.projectId = config.projectId;
        this.localVersion = config.localVersion || null;
        this.remoteVersion = config.remoteVersion || null;
        this.conflictType = config.conflictType || 'unknown'; // 'track', 'clip', 'effect', 'settings'
        this.conflictPath = config.conflictPath || ''; // JSON path to conflict
        this.createdAt = config.createdAt || Date.now();
        this.resolution = config.resolution || null;
    }

    toJSON() {
        return {
            id: this.id,
            projectId: this.projectId,
            localVersion: this.localVersion,
            remoteVersion: this.remoteVersion,
            conflictType: this.conflictType,
            conflictPath: this.conflictPath,
            createdAt: this.createdAt,
            resolution: this.resolution
        };
    }

    static fromJSON(data) {
        return new SyncConflict(data);
    }
}

/**
 * SyncChange - Represents a single change to be synced
 */
export class SyncChange {
    constructor(config = {}) {
        this.id = config.id || `change-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        this.type = config.type || 'update'; // 'create', 'update', 'delete'
        this.path = config.path || ''; // JSON path to changed data
        this.oldValue = config.oldValue || null;
        this.newValue = config.newValue || null;
        this.timestamp = config.timestamp || Date.now();
        this.deviceId = config.deviceId || null;
        this.applied = config.applied || false;
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            path: this.path,
            oldValue: this.oldValue,
            newValue: this.newValue,
            timestamp: this.timestamp,
            deviceId: this.deviceId,
            applied: this.applied
        };
    }

    static fromJSON(data) {
        return new SyncChange(data);
    }
}

/**
 * CloudSyncProvider - Abstract base class for cloud sync providers
 * Implementations should extend this class for specific cloud services
 */
export class CloudSyncProvider {
    constructor(config = {}) {
        this.name = config.name || 'Unknown Provider';
        this.connected = false;
        this.authenticated = false;
    }

    /**
     * Connect to the cloud service
     * @returns {Promise<boolean>} True if connected
     */
    async connect() {
        throw new Error('CloudSyncProvider.connect() must be implemented by subclass');
    }

    /**
     * Disconnect from the cloud service
     */
    async disconnect() {
        throw new Error('CloudSyncProvider.disconnect() must be implemented by subclass');
    }

    /**
     * Check if connected
     * @returns {boolean} True if connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Upload project data to cloud
     * @param {string} projectId - Project ID
     * @param {Object} data - Project data
     * @returns {Promise<Object>} Upload result
     */
    async upload(projectId, data) {
        throw new Error('CloudSyncProvider.upload() must be implemented by subclass');
    }

    /**
     * Download project data from cloud
     * @param {string} projectId - Project ID
     * @returns {Promise<Object|null>} Project data or null
     */
    async download(projectId) {
        throw new Error('CloudSyncProvider.download() must be implemented by subclass');
    }

    /**
     * List all projects in cloud
     * @returns {Promise<Object[]>} Array of project metadata
     */
    async listProjects() {
        throw new Error('CloudSyncProvider.listProjects() must be implemented by subclass');
    }

    /**
     * Delete project from cloud
     * @param {string} projectId - Project ID
     * @returns {Promise<boolean>} True if deleted
     */
    async deleteProject(projectId) {
        throw new Error('CloudSyncProvider.deleteProject() must be implemented by subclass');
    }

    /**
     * Get sync status for a project
     * @param {string} projectId - Project ID
     * @returns {Promise<SyncMetadata|null>} Sync metadata or null
     */
    async getSyncMetadata(projectId) {
        throw new Error('CloudSyncProvider.getSyncMetadata() must be implemented by subclass');
    }
}

/**
 * LocalStorageSyncProvider - Simple sync provider using localStorage (for testing/demo)
 */
export class LocalStorageSyncProvider extends CloudSyncProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'LocalStorage Provider';
        this.prefix = config.prefix || 'snugos_sync_';
    }

    async connect() {
        this.connected = true;
        this.authenticated = true;
        return true;
    }

    async disconnect() {
        this.connected = false;
        this.authenticated = false;
    }

    async upload(projectId, data) {
        if (!this.connected) throw new Error('Not connected');
        
        const key = `${this.prefix}${projectId}`;
        const syncData = {
            ...data,
            _syncMetadata: {
                uploadedAt: Date.now(),
                deviceId: this._getDeviceId(),
                version: data.version || 1
            }
        };
        
        localStorage.setItem(key, JSON.stringify(syncData));
        
        return {
            success: true,
            projectId: projectId,
            timestamp: Date.now()
        };
    }

    async download(projectId) {
        if (!this.connected) throw new Error('Not connected');
        
        const key = `${this.prefix}${projectId}`;
        const data = localStorage.getItem(key);
        
        if (data) {
            return JSON.parse(data);
        }
        return null;
    }

    async listProjects() {
        if (!this.connected) throw new Error('Not connected');
        
        const projects = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                const projectId = key.slice(this.prefix.length);
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        projects.push({
                            projectId: projectId,
                            name: parsed.name || projectId,
                            lastModified: parsed._syncMetadata?.uploadedAt || Date.now(),
                            version: parsed._syncMetadata?.version || 1
                        });
                    } catch (e) {
                        // Skip invalid entries
                    }
                }
            }
        }
        
        return projects;
    }

    async deleteProject(projectId) {
        if (!this.connected) throw new Error('Not connected');
        
        const key = `${this.prefix}${projectId}`;
        localStorage.removeItem(key);
        return true;
    }

    async getSyncMetadata(projectId) {
        const data = await this.download(projectId);
        if (data && data._syncMetadata) {
            return SyncMetadata.fromJSON(data._syncMetadata);
        }
        return null;
    }

    _getDeviceId() {
        let deviceId = localStorage.getItem('snugos_device_id');
        if (!deviceId) {
            deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('snugos_device_id', deviceId);
        }
        return deviceId;
    }
}

/**
 * IndexedDBSyncProvider - Sync provider using IndexedDB (for offline-first sync)
 */
export class IndexedDBSyncProvider extends CloudSyncProvider {
    constructor(config = {}) {
        super(config);
        this.name = 'IndexedDB Provider';
        this.storeName = config.storeName || 'cloud_sync';
        this.db = null;
    }

    async connect() {
        try {
            this.db = await getDB();
            this.connected = true;
            this.authenticated = true;
            return true;
        } catch (e) {
            console.error('[IndexedDBSyncProvider] Failed to connect:', e);
            return false;
        }
    }

    async disconnect() {
        this.connected = false;
        this.authenticated = false;
        this.db = null;
    }

    async upload(projectId, data) {
        if (!this.connected) throw new Error('Not connected');

        const syncKey = `sync_${projectId}`;
        const syncData = {
            ...data,
            _syncMetadata: {
                uploadedAt: Date.now(),
                deviceId: this._getDeviceId(),
                version: (data.version || 0) + 1
            }
        };

        // Store in IndexedDB
        await storeProjectState(syncKey, syncData);

        return {
            success: true,
            projectId: projectId,
            timestamp: Date.now()
        };
    }

    async download(projectId) {
        if (!this.connected) throw new Error('Not connected');

        const syncKey = `sync_${projectId}`;
        return await getProjectState(syncKey);
    }

    async listProjects() {
        if (!this.connected) throw new Error('Not connected');

        // For IndexedDB, we'd need to iterate through all keys
        // This is a simplified implementation
        const keys = [];
        // Note: IndexedDB doesn't have a direct way to list all keys
        // In production, you'd maintain a separate index
        return keys;
    }

    async deleteProject(projectId) {
        if (!this.connected) throw new Error('Not connected');

        const syncKey = `sync_${projectId}`;
        await deleteProjectState(syncKey);
        return true;
    }

    _getDeviceId() {
        let deviceId = localStorage.getItem('snugos_device_id');
        if (!deviceId) {
            deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('snugos_device_id', deviceId);
        }
        return deviceId;
    }
}

/**
 * CloudSyncManager - Main sync management class
 */
export class CloudSyncManager {
    constructor(config = {}) {
        this.provider = config.provider || new LocalStorageSyncProvider();
        this.syncMetadata = new Map(); // projectId -> SyncMetadata
        this.pendingChanges = new Map(); // projectId -> SyncChange[]
        this.conflicts = new Map(); // projectId -> SyncConflict[]
        this.autoSync = config.autoSync !== undefined ? config.autoSync : true;
        this.syncInterval = config.syncInterval || 30000; // 30 seconds
        this.syncTimer = null;
        this.lastSyncAttempt = null;
        this.onSyncStatusChange = config.onSyncStatusChange || null;
        this.onConflictDetected = config.onConflictDetected || null;
        this.onSyncComplete = config.onSyncComplete || null;
    }

    /**
     * Initialize the sync manager
     * @returns {Promise<boolean>} True if initialized successfully
     */
    async initialize() {
        try {
            await this.provider.connect();
            
            // Load existing sync metadata
            await this._loadSyncMetadata();

            // Start auto-sync if enabled
            if (this.autoSync) {
                this.startAutoSync();
            }

            console.log('[CloudSyncManager] Initialized');
            return true;
        } catch (e) {
            console.error('[CloudSyncManager] Initialization failed:', e);
            return false;
        }
    }

    /**
     * Load existing sync metadata from storage
     */
    async _loadSyncMetadata() {
        const stored = localStorage.getItem('snugos_sync_metadata');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                Object.entries(data).forEach(([projectId, metadata]) => {
                    this.syncMetadata.set(projectId, SyncMetadata.fromJSON(metadata));
                });
            } catch (e) {
                console.warn('[CloudSyncManager] Failed to load sync metadata:', e);
            }
        }
    }

    /**
     * Save sync metadata to storage
     */
    _saveSyncMetadata() {
        const data = {};
        this.syncMetadata.forEach((metadata, projectId) => {
            data[projectId] = metadata.toJSON();
        });
        localStorage.setItem('snugos_sync_metadata', JSON.stringify(data));
    }

    /**
     * Start auto-sync timer
     */
    startAutoSync() {
        if (this.syncTimer) return;
        
        this.syncTimer = setInterval(() => {
            this.syncAll();
        }, this.syncInterval);
        
        console.log(`[CloudSyncManager] Auto-sync started (interval: ${this.syncInterval}ms)`);
    }

    /**
     * Stop auto-sync timer
     */
    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('[CloudSyncManager] Auto-sync stopped');
        }
    }

    /**
     * Set the sync provider
     * @param {CloudSyncProvider} provider - New provider
     */
    setProvider(provider) {
        this.stopAutoSync();
        this.provider = provider;
        if (this.autoSync) {
            this.startAutoSync();
        }
    }

    /**
     * Record a local change
     * @param {string} projectId - Project ID
     * @param {SyncChange} change - Change to record
     */
    recordChange(projectId, change) {
        if (!this.pendingChanges.has(projectId)) {
            this.pendingChanges.set(projectId, []);
        }
        this.pendingChanges.get(projectId).push(change);

        // Update metadata
        let metadata = this.syncMetadata.get(projectId);
        if (!metadata) {
            metadata = new SyncMetadata({ projectId });
            this.syncMetadata.set(projectId, metadata);
        }
        metadata.lastModifiedTime = Date.now();
        metadata.syncStatus = SyncStatus.PENDING_UPLOAD;

        this._saveSyncMetadata();
    }

    /**
     * Sync a single project
     * @param {string} projectId - Project ID
     * @param {Object} localData - Local project data
     * @returns {Promise<Object>} Sync result
     */
    async syncProject(projectId, localData) {
        const metadata = this.syncMetadata.get(projectId) || new SyncMetadata({ projectId });
        metadata.syncStatus = SyncStatus.SYNCING;
        this._updateStatus(projectId, metadata);

        try {
            // Calculate local hash
            const localHash = await this._calculateHash(localData);

            // Check remote version
            const remoteData = await this.provider.download(projectId);

            if (remoteData) {
                const remoteHash = await this._calculateHash(remoteData);

                // Check for conflicts
                if (metadata.localHash && metadata.localHash !== remoteHash && localHash !== remoteHash) {
                    // Conflict: both local and remote have changed since last sync
                    metadata.syncStatus = SyncStatus.CONFLICT;
                    metadata.conflictData = {
                        localVersion: localData,
                        remoteVersion: remoteData
                    };
                    this._updateStatus(projectId, metadata);
                    
                    if (this.onConflictDetected) {
                        this.onConflictDetected(projectId, metadata.conflictData);
                    }

                    return {
                        success: false,
                        status: SyncStatus.CONFLICT,
                        metadata: metadata
                    };
                }

                // No conflict - determine direction
                if (metadata.remoteHash === remoteHash) {
                    // Remote hasn't changed since last sync - upload local
                    await this.provider.upload(projectId, localData);
                    metadata.localHash = localHash;
                    metadata.remoteHash = localHash;
                    metadata.lastSyncTime = Date.now();
                    metadata.syncStatus = SyncStatus.SYNCED;
                } else {
                    // Remote has changed - download
                    await this.provider.upload(projectId, localData);
                    metadata.localHash = localHash;
                    metadata.remoteHash = localHash;
                    metadata.lastSyncTime = Date.now();
                    metadata.syncStatus = SyncStatus.SYNCED;
                }
            } else {
                // No remote version - upload
                await this.provider.upload(projectId, localData);
                metadata.localHash = localHash;
                metadata.remoteHash = localHash;
                metadata.lastSyncTime = Date.now();
                metadata.syncStatus = SyncStatus.SYNCED;
            }

            this._updateStatus(projectId, metadata);
            this._saveSyncMetadata();

            if (this.onSyncComplete) {
                this.onSyncComplete(projectId, metadata);
            }

            return {
                success: true,
                status: metadata.syncStatus,
                metadata: metadata
            };
        } catch (e) {
            console.error(`[CloudSyncManager] Sync failed for ${projectId}:`, e);
            metadata.syncStatus = SyncStatus.ERROR;
            this._updateStatus(projectId, metadata);
            this._saveSyncMetadata();

            return {
                success: false,
                status: SyncStatus.ERROR,
                error: e.message,
                metadata: metadata
            };
        }
    }

    /**
     * Sync all projects
     * @returns {Promise<Object>} Sync results
     */
    async syncAll() {
        if (!this.provider.isConnected()) {
            await this.provider.connect();
        }

        const results = {
            synced: [],
            failed: [],
            conflicts: [],
            timestamp: Date.now()
        };

        // Sync all projects with pending changes
        for (const [projectId, changes] of this.pendingChanges) {
            // Get local data from IndexedDB
            const localData = await getProjectState(projectId);
            if (localData) {
                const result = await this.syncProject(projectId, localData);
                if (result.success) {
                    results.synced.push(projectId);
                } else if (result.status === SyncStatus.CONFLICT) {
                    results.conflicts.push(projectId);
                } else {
                    results.failed.push(projectId);
                }
            }
        }

        this.lastSyncAttempt = Date.now();
        return results;
    }

    /**
     * Resolve a conflict
     * @param {string} projectId - Project ID
     * @param {ConflictResolution} resolution - Resolution strategy
     * @returns {Promise<boolean>} True if resolved
     */
    async resolveConflict(projectId, resolution) {
        const metadata = this.syncMetadata.get(projectId);
        if (!metadata || !metadata.conflictData) {
            console.warn(`[CloudSyncManager] No conflict found for ${projectId}`);
            return false;
        }

        let resolvedData = null;

        switch (resolution) {
            case ConflictResolution.LOCAL_WINS:
                resolvedData = metadata.conflictData.localVersion;
                break;
            case ConflictResolution.REMOTE_WINS:
                resolvedData = metadata.conflictData.remoteVersion;
                break;
            case ConflictResolution.MERGE:
                resolvedData = await this._mergeVersions(
                    metadata.conflictData.localVersion,
                    metadata.conflictData.remoteVersion
                );
                break;
            case ConflictResolution.MANUAL:
                // Caller should provide resolved data
                return false;
            default:
                console.warn(`[CloudSyncManager] Unknown resolution: ${resolution}`);
                return false;
        }

        if (resolvedData) {
            // Upload resolved version
            await this.provider.upload(projectId, resolvedData);
            
            // Update metadata
            const resolvedHash = await this._calculateHash(resolvedData);
            metadata.localHash = resolvedHash;
            metadata.remoteHash = resolvedHash;
            metadata.lastSyncTime = Date.now();
            metadata.syncStatus = SyncStatus.SYNCED;
            metadata.conflictData = null;
            
            this._updateStatus(projectId, metadata);
            this._saveSyncMetadata();
            
            return true;
        }

        return false;
    }

    /**
     * Get sync status for a project
     * @param {string} projectId - Project ID
     * @returns {SyncMetadata|null} Sync metadata or null
     */
    getSyncStatus(projectId) {
        return this.syncMetadata.get(projectId) || null;
    }

    /**
     * Get all sync statuses
     * @returns {Object} Map of projectId to SyncMetadata
     */
    getAllSyncStatuses() {
        const result = {};
        this.syncMetadata.forEach((metadata, projectId) => {
            result[projectId] = metadata;
        });
        return result;
    }

    /**
     * Force a full sync (download from remote)
     * @param {string} projectId - Project ID
     * @returns {Promise<Object|null>} Remote data or null
     */
    async forceDownload(projectId) {
        const remoteData = await this.provider.download(projectId);
        if (remoteData) {
            // Store locally
            await storeProjectState(projectId, remoteData);
            
            // Update metadata
            const metadata = this.syncMetadata.get(projectId) || new SyncMetadata({ projectId });
            metadata.localHash = await this._calculateHash(remoteData);
            metadata.remoteHash = metadata.localHash;
            metadata.lastSyncTime = Date.now();
            metadata.syncStatus = SyncStatus.SYNCED;
            
            this.syncMetadata.set(projectId, metadata);
            this._saveSyncMetadata();
        }
        return remoteData;
    }

    /**
     * Calculate a hash for data comparison
     * @param {Object} data - Data to hash
     * @returns {Promise<string>} Hash string
     */
    async _calculateHash(data) {
        const str = JSON.stringify(data);
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Merge two versions (basic implementation)
     * @param {Object} local - Local version
     * @param {Object} remote - Remote version
     * @returns {Object} Merged version
     */
    async _mergeVersions(local, remote) {
        // Basic merge: prefer remote for settings, local for content
        // This is a simplified implementation - production would need more sophisticated merging
        const merged = { ...remote };
        
        // Keep local track changes if they exist
        if (local.tracks && remote.tracks) {
            // Merge tracks by ID
            const localTracks = new Map(local.tracks.map(t => [t.id, t]));
            const remoteTracks = new Map(remote.tracks.map(t => [t.id, t]));
            
            // Keep all unique tracks
            for (const [id, track] of localTracks) {
                if (!remoteTracks.has(id)) {
                    merged.tracks.push(track);
                }
            }
        }
        
        return merged;
    }

    /**
     * Update sync status and notify listeners
     * @param {string} projectId - Project ID
     * @param {SyncMetadata} metadata - Updated metadata
     */
    _updateStatus(projectId, metadata) {
        this.syncMetadata.set(projectId, metadata);
        if (this.onSyncStatusChange) {
            this.onSyncStatusChange(projectId, metadata);
        }
    }

    /**
     * Dispose of sync manager
     */
    dispose() {
        this.stopAutoSync();
        this.syncMetadata.clear();
        this.pendingChanges.clear();
        this.conflicts.clear();
    }
}

// Create singleton instance
export const cloudSyncManager = new CloudSyncManager();

// Default export
export default {
    SyncStatus,
    ConflictResolution,
    SyncMetadata,
    SyncConflict,
    SyncChange,
    CloudSyncProvider,
    LocalStorageSyncProvider,
    IndexedDBSyncProvider,
    CloudSyncManager,
    cloudSyncManager
};