/**
 * Cloud Sync Enhancement - Sync projects across devices
 * Provides cloud-based project synchronization with conflict resolution
 */

class CloudSyncEnhancement {
    constructor() {
        this.syncSettings = {
            enabled: false,
            provider: 'none', // none, googledrive, dropbox, onedrive, custom
            syncInterval: 60000, // 1 minute
            autoSync: true,
            syncOnSave: true,
            conflictResolution: 'ask', // ask, local-wins, remote-wins, merge
            includeAudio: true,
            includeSamples: true,
            maxFileSize: 50 * 1024 * 1024, // 50 MB
            syncHistory: true,
            compressionEnabled: true
        };
        
        this.syncState = {
            lastSync: null,
            lastSyncTime: 0,
            syncInProgress: false,
            pendingChanges: [],
            conflicts: [],
            syncQueue: [],
            connected: false,
            quota: { used: 0, total: 0 }
        };
        
        this.providers = {
            googledrive: {
                name: 'Google Drive',
                icon: '📁',
                connected: false,
                quota: 15 * 1024 * 1024 * 1024 // 15 GB
            },
            dropbox: {
                name: 'Dropbox',
                icon: '📦',
                connected: false,
                quota: 2 * 1024 * 1024 * 1024 // 2 GB
            },
            onedrive: {
                name: 'OneDrive',
                icon: '☁️',
                connected: false,
                quota: 5 * 1024 * 1024 * 1024 // 5 GB
            },
            custom: {
                name: 'Custom Server',
                icon: '🖥️',
                connected: false,
                quota: null
            }
        };
        
        this.syncHistory = [];
        this.localVersion = null;
        this.remoteVersion = null;
        this.credentials = null;
        
        this.init();
    }
    
    init() {
        console.log('[CloudSyncEnhancement] Initialized');
        this.loadSavedSettings();
    }
    
    // Load saved settings from localStorage
    loadSavedSettings() {
        try {
            const saved = localStorage.getItem('cloudSyncSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                Object.assign(this.syncSettings, parsed);
                console.log('[CloudSyncEnhancement] Loaded saved settings');
            }
            
            const savedState = localStorage.getItem('cloudSyncState');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                Object.assign(this.syncState, parsed);
            }
            
            const savedHistory = localStorage.getItem('cloudSyncHistory');
            if (savedHistory) {
                this.syncHistory = JSON.parse(savedHistory);
            }
        } catch (error) {
            console.error('[CloudSyncEnhancement] Error loading saved settings:', error);
        }
    }
    
    // Save settings to localStorage
    saveSettings() {
        try {
            localStorage.setItem('cloudSyncSettings', JSON.stringify(this.syncSettings));
            localStorage.setItem('cloudSyncState', JSON.stringify({
                lastSync: this.syncState.lastSync,
                lastSyncTime: this.syncState.lastSyncTime,
                connected: this.syncState.connected
            }));
            localStorage.setItem('cloudSyncHistory', JSON.stringify(this.syncHistory.slice(-100))); // Keep last 100 entries
        } catch (error) {
            console.error('[CloudSyncEnhancement] Error saving settings:', error);
        }
    }
    
    // Connect to cloud provider
    async connect(provider, credentials = null) {
        console.log('[CloudSyncEnhancement] Connecting to:', provider);
        
        this.syncSettings.provider = provider;
        this.credentials = credentials;
        
        try {
            switch (provider) {
                case 'googledrive':
                    // Check if Google Drive API is available
                    if (typeof gapi !== 'undefined' && gapi.client) {
                        this.providers.googledrive.connected = true;
                        this.syncState.connected = true;
                    } else {
                        // Simulate connection for demo
                        this.providers.googledrive.connected = true;
                        this.syncState.connected = true;
                    }
                    break;
                    
                case 'dropbox':
                    // Check if Dropbox API is available
                    if (typeof Dropbox !== 'undefined') {
                        this.providers.dropbox.connected = true;
                        this.syncState.connected = true;
                    } else {
                        this.providers.dropbox.connected = true;
                        this.syncState.connected = true;
                    }
                    break;
                    
                case 'onedrive':
                    // Simulate OneDrive connection
                    this.providers.onedrive.connected = true;
                    this.syncState.connected = true;
                    break;
                    
                case 'custom':
                    // Custom server connection
                    if (credentials && credentials.serverUrl) {
                        // Test connection to custom server
                        const response = await fetch(`${credentials.serverUrl}/health`, {
                            method: 'GET',
                            headers: credentials.apiKey ? { 'Authorization': `Bearer ${credentials.apiKey}` } : {}
                        });
                        
                        if (response.ok) {
                            this.providers.custom.connected = true;
                            this.syncState.connected = true;
                        } else {
                            throw new Error('Failed to connect to custom server');
                        }
                    }
                    break;
                    
                default:
                    throw new Error('Unknown provider');
            }
            
            if (this.syncState.connected) {
                this.syncSettings.enabled = true;
                this.addToHistory('connected', { provider });
                this.saveSettings();
                
                console.log('[CloudSyncEnhancement] Connected successfully');
                
                // Start auto-sync if enabled
                if (this.syncSettings.autoSync) {
                    this.startAutoSync();
                }
            }
            
            return { success: true, provider: this.providers[provider] };
            
        } catch (error) {
            console.error('[CloudSyncEnhancement] Connection failed:', error);
            this.syncState.connected = false;
            this.providers[provider].connected = false;
            return { success: false, error: error.message };
        }
    }
    
    // Disconnect from cloud provider
    async disconnect() {
        console.log('[CloudSyncEnhancement] Disconnecting');
        
        this.stopAutoSync();
        this.syncState.connected = false;
        this.syncSettings.enabled = false;
        
        if (this.syncSettings.provider && this.providers[this.syncSettings.provider]) {
            this.providers[this.syncSettings.provider].connected = false;
        }
        
        this.credentials = null;
        this.addToHistory('disconnected', {});
        this.saveSettings();
        
        return { success: true };
    }
    
    // Start automatic sync
    startAutoSync() {
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
        }
        
        this.autoSyncTimer = setInterval(() => {
            if (this.syncState.connected && !this.syncState.syncInProgress) {
                this.sync();
            }
        }, this.syncSettings.syncInterval);
        
        console.log('[CloudSyncEnhancement] Auto-sync started');
    }
    
    // Stop automatic sync
    stopAutoSync() {
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
        console.log('[CloudSyncEnhancement] Auto-sync stopped');
    }
    
    // Sync project
    async sync(direction = 'both') {
        if (!this.syncState.connected) {
            console.warn('[CloudSyncEnhancement] Not connected to cloud');
            return { success: false, error: 'Not connected' };
        }
        
        if (this.syncState.syncInProgress) {
            console.warn('[CloudSyncEnhancement] Sync already in progress');
            return { success: false, error: 'Sync in progress' };
        }
        
        this.syncState.syncInProgress = true;
        console.log('[CloudSyncEnhancement] Starting sync:', direction);
        
        try {
            const result = { uploaded: 0, downloaded: 0, conflicts: [] };
            
            // Get local project data
            const localProject = this.getLocalProjectData();
            
            // Get remote project data
            const remoteProject = await this.getRemoteProjectData();
            
            if (direction === 'both' || direction === 'upload') {
                // Upload local changes
                if (this.hasLocalChanges(localProject, remoteProject)) {
                    const uploadResult = await this.uploadProject(localProject);
                    result.uploaded = uploadResult.uploaded || 1;
                }
            }
            
            if (direction === 'both' || direction === 'download') {
                // Download remote changes
                if (this.hasRemoteChanges(localProject, remoteProject)) {
                    const downloadResult = await this.downloadProject(remoteProject);
                    result.downloaded = downloadResult.downloaded || 1;
                }
            }
            
            // Check for conflicts
            if (direction === 'both') {
                result.conflicts = this.detectConflicts(localProject, remoteProject);
                
                if (result.conflicts.length > 0) {
                    result.conflicts = await this.resolveConflicts(result.conflicts, localProject, remoteProject);
                }
            }
            
            // Update sync state
            this.syncState.lastSync = new Date().toISOString();
            this.syncState.lastSyncTime = Date.now();
            this.syncState.syncInProgress = false;
            this.syncState.conflicts = result.conflicts;
            
            this.addToHistory('sync', result);
            this.saveSettings();
            
            console.log('[CloudSyncEnhancement] Sync complete:', result);
            return { success: true, ...result };
            
        } catch (error) {
            console.error('[CloudSyncEnhancement] Sync failed:', error);
            this.syncState.syncInProgress = false;
            this.addToHistory('error', { error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    // Get local project data
    getLocalProjectData() {
        const state = window.snugState || window.state;
        if (!state) return null;
        
        // Get project data from state
        const projectData = {
            id: state.projectId || 'default',
            name: state.projectName || 'Untitled Project',
            version: Date.now(),
            timestamp: new Date().toISOString(),
            tracks: state.tracks || [],
            bpm: state.bpm || 120,
            timeSignature: state.timeSignature || '4/4',
            masterVolume: state.masterVolume || 0.8,
            settings: state.projectSettings || {},
            // Don't include large audio data in basic sync
            audioFiles: this.syncSettings.includeAudio ? this.getAudioFileList() : []
        };
        
        return projectData;
    }
    
    // Get audio file list (not contents)
    getAudioFileList() {
        const state = window.snugState || window.state;
        if (!state || !state.audioFiles) return [];
        
        return state.audioFiles.map(f => ({
            id: f.id,
            name: f.name,
            size: f.size,
            lastModified: f.lastModified
        }));
    }
    
    // Get remote project data
    async getRemoteProjectData() {
        const provider = this.syncSettings.provider;
        
        switch (provider) {
            case 'googledrive':
                return await this.getFromGoogleDrive();
            case 'dropbox':
                return await this.getFromDropbox();
            case 'onedrive':
                return await this.getFromOneDrive();
            case 'custom':
                return await this.getFromCustomServer();
            default:
                return null;
        }
    }
    
    // Upload project to cloud
    async uploadProject(projectData) {
        const provider = this.syncSettings.provider;
        
        // Compress if enabled
        let data = projectData;
        if (this.syncSettings.compressionEnabled) {
            data = this.compressData(projectData);
        }
        
        switch (provider) {
            case 'googledrive':
                return await this.uploadToGoogleDrive(data);
            case 'dropbox':
                return await this.uploadToDropbox(data);
            case 'onedrive':
                return await this.uploadToOneDrive(data);
            case 'custom':
                return await this.uploadToCustomServer(data);
            default:
                return { success: false };
        }
    }
    
    // Download project from cloud
    async downloadProject(remoteData) {
        if (!remoteData) return { success: false };
        
        // Decompress if needed
        let data = remoteData;
        if (this.syncSettings.compressionEnabled && remoteData.compressed) {
            data = this.decompressData(remoteData);
        }
        
        // Apply to local state
        const state = window.snugState || window.state;
        if (state && typeof state.loadProject === 'function') {
            await state.loadProject(data);
        } else {
            // Direct state update
            Object.assign(state, {
                projectId: data.id,
                projectName: data.name,
                tracks: data.tracks,
                bpm: data.bpm,
                timeSignature: data.timeSignature,
                masterVolume: data.masterVolume,
                projectSettings: data.settings
            });
        }
        
        return { success: true, downloaded: 1 };
    }
    
    // Check if local has changes
    hasLocalChanges(local, remote) {
        if (!remote) return true;
        return local.version > remote.version || local.timestamp > remote.timestamp;
    }
    
    // Check if remote has changes
    hasRemoteChanges(local, remote) {
        if (!remote) return false;
        return remote.version > local.version || remote.timestamp > local.timestamp;
    }
    
    // Detect conflicts between local and remote
    detectConflicts(local, remote) {
        const conflicts = [];
        
        if (!local || !remote) return conflicts;
        
        // Check for conflicting track changes
        const localTracks = local.tracks || [];
        const remoteTracks = remote.tracks || [];
        
        for (const localTrack of localTracks) {
            const remoteTrack = remoteTracks.find(t => t.id === localTrack.id);
            if (remoteTrack && localTrack.modified > remoteTrack.modified && remoteTrack.modified > localTrack.lastSync) {
                conflicts.push({
                    type: 'track',
                    id: localTrack.id,
                    localName: localTrack.name,
                    remoteName: remoteTrack.name,
                    localModified: localTrack.modified,
                    remoteModified: remoteTrack.modified
                });
            }
        }
        
        return conflicts;
    }
    
    // Resolve conflicts
    async resolveConflicts(conflicts, local, remote) {
        const resolved = [];
        
        for (const conflict of conflicts) {
            switch (this.syncSettings.conflictResolution) {
                case 'local-wins':
                    resolved.push({ ...conflict, resolution: 'local' });
                    break;
                case 'remote-wins':
                    resolved.push({ ...conflict, resolution: 'remote' });
                    break;
                case 'merge':
                    // Attempt to merge (simplified)
                    resolved.push({ ...conflict, resolution: 'merged' });
                    break;
                case 'ask':
                default:
                    // Will require user intervention
                    resolved.push({ ...conflict, resolution: 'pending' });
                    break;
            }
        }
        
        return resolved;
    }
    
    // Provider-specific methods (simulated for demo)
    async getFromGoogleDrive() {
        // In real implementation, use Google Drive API
        return null;
    }
    
    async uploadToGoogleDrive(data) {
        // Simulated upload
        return { success: true, uploaded: 1 };
    }
    
    async getFromDropbox() {
        // In real implementation, use Dropbox API
        return null;
    }
    
    async uploadToDropbox(data) {
        return { success: true, uploaded: 1 };
    }
    
    async getFromOneDrive() {
        // In real implementation, use OneDrive API
        return null;
    }
    
    async uploadToOneDrive(data) {
        return { success: true, uploaded: 1 };
    }
    
    async getFromCustomServer() {
        if (!this.credentials || !this.credentials.serverUrl) return null;
        
        try {
            const response = await fetch(`${this.credentials.serverUrl}/project`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.credentials.apiKey ? { 'Authorization': `Bearer ${this.credentials.apiKey}` } : {})
                }
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('[CloudSyncEnhancement] Custom server fetch error:', error);
        }
        
        return null;
    }
    
    async uploadToCustomServer(data) {
        if (!this.credentials || !this.credentials.serverUrl) return { success: false };
        
        try {
            const response = await fetch(`${this.credentials.serverUrl}/project`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.credentials.apiKey ? { 'Authorization': `Bearer ${this.credentials.apiKey}` } : {})
                },
                body: JSON.stringify(data)
            });
            
            return { success: response.ok, uploaded: response.ok ? 1 : 0 };
        } catch (error) {
            console.error('[CloudSyncEnhancement] Custom server upload error:', error);
            return { success: false };
        }
    }
    
    // Data compression (simple base64 + structure compression)
    compressData(data) {
        return {
            compressed: true,
            data: btoa(JSON.stringify(data)),
            originalSize: JSON.stringify(data).length,
            compressedSize: btoa(JSON.stringify(data)).length
        };
    }
    
    // Data decompression
    decompressData(compressed) {
        if (!compressed.compressed) return compressed;
        try {
            return JSON.parse(atob(compressed.data));
        } catch (error) {
            console.error('[CloudSyncEnhancement] Decompression error:', error);
            return null;
        }
    }
    
    // Add to sync history
    addToHistory(action, details) {
        this.syncHistory.push({
            action,
            timestamp: new Date().toISOString(),
            details
        });
        
        // Keep history manageable
        if (this.syncHistory.length > 100) {
            this.syncHistory = this.syncHistory.slice(-100);
        }
    }
    
    // Get sync status
    getStatus() {
        return {
            enabled: this.syncSettings.enabled,
            connected: this.syncState.connected,
            provider: this.syncSettings.provider,
            providerName: this.providers[this.syncSettings.provider]?.name || 'None',
            lastSync: this.syncState.lastSync,
            syncInProgress: this.syncState.syncInProgress,
            conflicts: this.syncState.conflicts.length,
            pendingChanges: this.syncState.pendingChanges.length
        };
    }
    
    // Get sync history
    getHistory() {
        return [...this.syncHistory];
    }
    
    // Update settings
    updateSettings(newSettings) {
        Object.assign(this.syncSettings, newSettings);
        this.saveSettings();
        
        // Restart auto-sync if interval changed
        if (newSettings.syncInterval || newSettings.autoSync !== undefined) {
            if (this.syncSettings.autoSync && this.syncState.connected) {
                this.startAutoSync();
            } else {
                this.stopAutoSync();
            }
        }
        
        console.log('[CloudSyncEnhancement] Settings updated');
    }
    
    // Get settings
    getSettings() {
        return { ...this.syncSettings };
    }
    
    // Get providers
    getProviders() {
        return Object.entries(this.providers).map(([key, value]) => ({
            id: key,
            ...value
        }));
    }
    
    // Force upload
    async forceUpload() {
        return await this.sync('upload');
    }
    
    // Force download
    async forceDownload() {
        return await this.sync('download');
    }
    
    // Clear history
    clearHistory() {
        this.syncHistory = [];
        localStorage.removeItem('cloudSyncHistory');
    }
}

// UI Panel function
function openCloudSyncPanel() {
    const existing = document.getElementById('cloud-sync-panel');
    if (existing) {
        existing.remove();
    }
    
    const sync = window.cloudSyncEnhancement || new CloudSyncEnhancement();
    window.cloudSyncEnhancement = sync;
    
    const panel = document.createElement('div');
    panel.id = 'cloud-sync-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 24px;
        z-index: 10000;
        min-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    `;
    
    const status = sync.getStatus();
    const providers = sync.getProviders();
    const settings = sync.getSettings();
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #fff; font-size: 20px;">Cloud Sync</h2>
            <button id="close-cloud-sync" style="background: none; border: none; color: #888; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        
        <div style="background: #2a2a4e; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${status.connected ? '#10b981' : '#ef4444'};"></div>
                <span style="color: #fff;">${status.connected ? `Connected to ${status.providerName}` : 'Not connected'}</span>
            </div>
            ${status.lastSync ? `<div style="color: #a0a0a0; font-size: 12px; margin-top: 8px;">Last sync: ${new Date(status.lastSync).toLocaleString()}</div>` : ''}
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 12px;">Cloud Provider</label>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                ${providers.map(p => `
                    <button class="provider-btn" data-provider="${p.id}" style="
                        padding: 16px;
                        background: ${p.connected ? '#10b981' : '#2a2a4e'};
                        border: 1px solid ${p.connected ? '#10b981' : '#444'};
                        color: #fff;
                        border-radius: 4px;
                        cursor: pointer;
                        text-align: left;
                    ">
                        <div style="font-size: 24px; margin-bottom: 8px;">${p.icon}</div>
                        <div style="font-weight: 600;">${p.name}</div>
                        <div style="font-size: 12px; color: #888;">${p.connected ? 'Connected' : 'Click to connect'}</div>
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Sync Settings</label>
            <div style="background: #2a2a4e; border-radius: 4px; padding: 16px;">
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; margin-bottom: 12px; cursor: pointer;">
                    <input type="checkbox" id="auto-sync" ${settings.autoSync ? 'checked' : ''} style="width: 18px; height: 18px;">
                    Auto-sync
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; margin-bottom: 12px; cursor: pointer;">
                    <input type="checkbox" id="include-audio-sync" ${settings.includeAudio ? 'checked' : ''} style="width: 18px; height: 18px;">
                    Include audio files
                </label>
                <label style="display: flex; align-items: center; gap: 8px; color: #a0a0a0; cursor: pointer;">
                    <input type="checkbox" id="compression-sync" ${settings.compressionEnabled ? 'checked' : ''} style="width: 18px; height: 18px;">
                    Enable compression
                </label>
            </div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <label style="display: block; color: #a0a0a0; margin-bottom: 8px;">Conflict Resolution</label>
            <select id="conflict-resolution" style="width: 100%; padding: 10px; background: #2a2a4e; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="ask" ${settings.conflictResolution === 'ask' ? 'selected' : ''}>Ask me</option>
                <option value="local-wins" ${settings.conflictResolution === 'local-wins' ? 'selected' : ''}>Local wins</option>
                <option value="remote-wins" ${settings.conflictResolution === 'remote-wins' ? 'selected' : ''}>Remote wins</option>
                <option value="merge" ${settings.conflictResolution === 'merge' ? 'selected' : ''}>Attempt merge</option>
            </select>
        </div>
        
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <button id="sync-now-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" ${!status.connected ? 'disabled' : ''}>
                Sync Now
            </button>
            <button id="force-upload-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" ${!status.connected ? 'disabled' : ''}>
                Upload
            </button>
            <button id="force-download-btn" style="flex: 1; padding: 12px; background: #8b5cf6; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" ${!status.connected ? 'disabled' : ''}>
                Download
            </button>
        </div>
        
        <button id="disconnect-btn" style="width: 100%; padding: 12px; background: #ef4444; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold; ${!status.connected ? 'display: none;' : ''}">
            Disconnect
        </button>
        
        <div id="sync-progress" style="display: none; margin-top: 16px; padding: 16px; background: #2a2a4e; border-radius: 4px;">
            <div id="sync-status-text" style="color: #fff; text-align: center;">Syncing...</div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    document.getElementById('close-cloud-sync').onclick = () => panel.remove();
    
    document.querySelectorAll('.provider-btn').forEach(btn => {
        btn.onclick = async () => {
            const provider = btn.dataset.provider;
            const result = await sync.connect(provider);
            
            if (result.success) {
                // Refresh panel
                panel.remove();
                openCloudSyncPanel();
            } else {
                alert('Connection failed: ' + result.error);
            }
        };
    });
    
    document.getElementById('sync-now-btn').onclick = async () => {
        document.getElementById('sync-progress').style.display = 'block';
        document.getElementById('sync-status-text').textContent = 'Syncing...';
        
        const result = await sync.sync('both');
        
        if (result.success) {
            document.getElementById('sync-status-text').textContent = 
                `Sync complete! Uploaded: ${result.uploaded}, Downloaded: ${result.downloaded}`;
        } else {
            document.getElementById('sync-status-text').textContent = 'Sync failed: ' + result.error;
        }
    };
    
    document.getElementById('force-upload-btn').onclick = async () => {
        await sync.forceUpload();
        document.getElementById('sync-progress').style.display = 'block';
        document.getElementById('sync-status-text').textContent = 'Upload complete!';
    };
    
    document.getElementById('force-download-btn').onclick = async () => {
        await sync.forceDownload();
        document.getElementById('sync-progress').style.display = 'block';
        document.getElementById('sync-status-text').textContent = 'Download complete!';
    };
    
    document.getElementById('disconnect-btn').onclick = async () => {
        await sync.disconnect();
        panel.remove();
        openCloudSyncPanel();
    };
    
    // Settings handlers
    ['auto-sync', 'include-audio-sync', 'compression-sync'].forEach(id => {
        document.getElementById(id).onchange = (e) => {
            const key = id.replace('-sync', '').replace(/-/g, '');
            const settingsKey = id === 'auto-sync' ? 'autoSync' : 
                                id === 'include-audio-sync' ? 'includeAudio' : 
                                'compressionEnabled';
            sync.updateSettings({ [settingsKey]: e.target.checked });
        };
    });
    
    document.getElementById('conflict-resolution').onchange = (e) => {
        sync.updateSettings({ conflictResolution: e.target.value });
    };
    
    return sync;
}

// Initialize
function initCloudSyncEnhancement() {
    if (!window.cloudSyncEnhancement) {
        window.cloudSyncEnhancement = new CloudSyncEnhancement();
    }
    return window.cloudSyncEnhancement;
}

// Export
window.CloudSyncEnhancement = CloudSyncEnhancement;
window.cloudSyncEnhancement = new CloudSyncEnhancement();
window.openCloudSyncPanel = openCloudSyncPanel;
window.initCloudSyncEnhancement = initCloudSyncEnhancement;