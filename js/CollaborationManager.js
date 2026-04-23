// js/CollaborationManager.js - Real-time Collaboration System for SnugOS DAW
// Provides multi-user real-time editing with presence, cursors, and conflict resolution

/**
 * CollaborationRole - User roles in a collaborative session
 */
export const CollaborationRole = {
    OWNER: 'owner',         // Full control, can manage participants
    EDITOR: 'editor',       // Can edit all content
    CONTRIBUTOR: 'contributor', // Can edit assigned tracks only
    VIEWER: 'viewer'        // Read-only access
};

/**
 * CollaborationPermission - Granular permissions
 */
export const CollaborationPermission = {
    EDIT_TRACKS: 'edit_tracks',
    EDIT_EFFECTS: 'edit_effects',
    EDIT_SETTINGS: 'edit_settings',
    EDIT_AUTOMATION: 'edit_automation',
    ADD_TRACKS: 'add_tracks',
    DELETE_TRACKS: 'delete_tracks',
    MANAGE_PARTICIPANTS: 'manage_participants',
    EXPORT_PROJECT: 'export_project'
};

/**
 * EditOperation - Types of edit operations
 */
export const EditOperation = {
    TRACK_CREATE: 'track_create',
    TRACK_DELETE: 'track_delete',
    TRACK_UPDATE: 'track_update',
    CLIP_CREATE: 'clip_create',
    CLIP_DELETE: 'clip_delete',
    CLIP_MOVE: 'clip_move',
    CLIP_RESIZE: 'clip_resize',
    NOTE_ADD: 'note_add',
    NOTE_DELETE: 'note_delete',
    NOTE_UPDATE: 'note_update',
    EFFECT_ADD: 'effect_add',
    EFFECT_REMOVE: 'effect_remove',
    EFFECT_UPDATE: 'effect_update',
    AUTOMATION_ADD: 'automation_add',
    AUTOMATION_UPDATE: 'automation_update',
    SETTING_CHANGE: 'setting_change',
    CURSOR_MOVE: 'cursor_move',
    SELECTION_CHANGE: 'selection_change'
};

/**
 * CollaboratorCursor - Represents another user's cursor position
 */
export class CollaboratorCursor {
    constructor(config = {}) {
        this.userId = config.userId || '';
        this.userName = config.userName || 'Anonymous';
        this.userColor = config.userColor || this._generateColor();
        this.trackId = config.trackId || null;
        this.clipId = config.clipId || null;
        this.timelinePosition = config.timelinePosition || 0;
        this.pianoRollPosition = config.pianoRollPosition || null;
        this.lastUpdate = config.lastUpdate || Date.now();
        this.isEditing = config.isEditing || false;
    }

    _generateColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    toJSON() {
        return {
            userId: this.userId,
            userName: this.userName,
            userColor: this.userColor,
            trackId: this.trackId,
            clipId: this.clipId,
            timelinePosition: this.timelinePosition,
            pianoRollPosition: this.pianoRollPosition,
            lastUpdate: this.lastUpdate,
            isEditing: this.isEditing
        };
    }

    static fromJSON(data) {
        return new CollaboratorCursor(data);
    }
}

/**
 * CollaboratorPresence - Represents a collaborator's presence info
 */
export class CollaboratorPresence {
    constructor(config = {}) {
        this.userId = config.userId || '';
        this.userName = config.userName || 'Anonymous';
        this.userAvatar = config.userAvatar || null;
        this.userColor = config.userColor || '#FF6B6B';
        this.role = config.role || CollaborationRole.VIEWER;
        this.isOnline = config.isOnline !== undefined ? config.isOnline : true;
        this.lastSeen = config.lastSeen || Date.now();
        this.currentAction = config.currentAction || 'idle';
        this.focusedTrackId = config.focusedTrackId || null;
        this.permissions = config.permissions || this._getDefaultPermissions(config.role);
    }

    _getDefaultPermissions(role) {
        switch (role) {
            case CollaborationRole.OWNER:
                return Object.values(CollaborationPermission);
            case CollaborationRole.EDITOR:
                return [
                    CollaborationPermission.EDIT_TRACKS,
                    CollaborationPermission.EDIT_EFFECTS,
                    CollaborationPermission.EDIT_SETTINGS,
                    CollaborationPermission.EDIT_AUTOMATION,
                    CollaborationPermission.ADD_TRACKS,
                    CollaborationPermission.EXPORT_PROJECT
                ];
            case CollaborationRole.CONTRIBUTOR:
                return [
                    CollaborationPermission.EDIT_TRACKS,
                    CollaborationPermission.EDIT_AUTOMATION
                ];
            case CollaborationRole.VIEWER:
            default:
                return [];
        }
    }

    hasPermission(permission) {
        return this.permissions.includes(permission);
    }

    toJSON() {
        return {
            userId: this.userId,
            userName: this.userName,
            userAvatar: this.userAvatar,
            userColor: this.userColor,
            role: this.role,
            isOnline: this.isOnline,
            lastSeen: this.lastSeen,
            currentAction: this.currentAction,
            focusedTrackId: this.focusedTrackId,
            permissions: this.permissions
        };
    }

    static fromJSON(data) {
        return new CollaboratorPresence(data);
    }
}

/**
 * EditTransaction - Represents an atomic edit operation
 */
export class EditTransaction {
    constructor(config = {}) {
        this.id = config.id || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.operation = config.operation || EditOperation.TRACK_UPDATE;
        this.userId = config.userId || '';
        this.timestamp = config.timestamp || Date.now();
        this.targetId = config.targetId || null;
        this.path = config.path || '';
        this.oldValue = config.oldValue !== undefined ? config.oldValue : null;
        this.newValue = config.newValue !== undefined ? config.newValue : null;
        this.metadata = config.metadata || {};
        this.applied = config.applied || false;
        this.conflictResolution = config.conflictResolution || null;
    }

    toJSON() {
        return {
            id: this.id,
            operation: this.operation,
            userId: this.userId,
            timestamp: this.timestamp,
            targetId: this.targetId,
            path: this.path,
            oldValue: this.oldValue,
            newValue: this.newValue,
            metadata: this.metadata,
            applied: this.applied,
            conflictResolution: this.conflictResolution
        };
    }

    static fromJSON(data) {
        return new EditTransaction(data);
    }
}

/**
 * SessionInvite - Represents an invitation to a collaboration session
 */
export class SessionInvite {
    constructor(config = {}) {
        this.id = config.id || `invite-${Date.now()}`;
        this.sessionId = config.sessionId || '';
        this.inviterId = config.inviterId || '';
        this.inviterName = config.inviterName || '';
        this.projectName = config.projectName || 'Untitled Project';
        this.role = config.role || CollaborationRole.VIEWER;
        this.createdAt = config.createdAt || Date.now();
        this.expiresAt = config.expiresAt || (Date.now() + 24 * 60 * 60 * 1000);
        this.accepted = config.accepted || false;
        this.token = config.token || this._generateToken();
    }

    _generateToken() {
        return Math.random().toString(36).substr(2, 16) + 
               Math.random().toString(36).substr(2, 16);
    }

    isExpired() {
        return Date.now() > this.expiresAt;
    }

    toJSON() {
        return {
            id: this.id,
            sessionId: this.sessionId,
            inviterId: this.inviterId,
            inviterName: this.inviterName,
            projectName: this.projectName,
            role: this.role,
            createdAt: this.createdAt,
            expiresAt: this.expiresAt,
            accepted: this.accepted,
            token: this.token
        };
    }

    static fromJSON(data) {
        return new SessionInvite(data);
    }
}

/**
 * SignalingMessage - Messages for WebRTC signaling
 */
export class SignalingMessage {
    constructor(config = {}) {
        this.type = config.type || 'unknown';
        this.from = config.from || '';
        this.to = config.to || '';
        this.payload = config.payload || {};
        this.timestamp = config.timestamp || Date.now();
    }

    toJSON() {
        return {
            type: this.type,
            from: this.from,
            to: this.to,
            payload: this.payload,
            timestamp: this.timestamp
        };
    }

    static fromJSON(data) {
        return new SignalingMessage(data);
    }
}

/**
 * CollaborationSignaling - Handles WebRTC signaling via PeerJS or similar
 */
export class CollaborationSignaling {
    constructor(config = {}) {
        this.peerId = config.peerId || null;
        this.peer = null;
        this.connections = new Map();
        this.messageHandlers = new Map();
        this.onConnection = config.onConnection || null;
        this.onDisconnection = config.onDisconnection || null;
        this.onError = config.onError || null;
    }

    /**
     * Initialize signaling with PeerJS
     * @param {string} apiKey - PeerJS API key (optional for free tier)
     * @returns {Promise<string>} Peer ID
     */
    async initialize(apiKey = null) {
        return new Promise((resolve, reject) => {
            try {
                // Use PeerJS if available, otherwise use WebSocket fallback
                if (typeof Peer !== 'undefined') {
                    const config = apiKey ? { key: apiKey } : {};
                    this.peer = new Peer(config);
                    
                    this.peer.on('open', (id) => {
                        this.peerId = id;
                        console.log('[CollaborationSignaling] Connected with ID:', id);
                        resolve(id);
                    });
                    
                    this.peer.on('connection', (conn) => {
                        this._handleConnection(conn);
                    });
                    
                    this.peer.on('error', (err) => {
                        console.error('[CollaborationSignaling] Peer error:', err);
                        if (this.onError) this.onError(err);
                        reject(err);
                    });
                } else {
                    // Fallback to simulated local collaboration
                    this.peerId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    console.log('[CollaborationSignaling] Using local mode with ID:', this.peerId);
                    resolve(this.peerId);
                }
            } catch (e) {
                console.error('[CollaborationSignaling] Initialization failed:', e);
                reject(e);
            }
        });
    }

    /**
     * Connect to another peer
     * @param {string} peerId - Target peer ID
     * @returns {Promise<Object>} Connection object
     */
    async connect(peerId) {
        return new Promise((resolve, reject) => {
            if (!this.peer) {
                // Local mode - simulate connection
                const mockConn = {
                    peer: peerId,
                    open: true,
                    send: (data) => {
                        console.log('[CollaborationSignaling] Local send:', data);
                    },
                    close: () => {
                        this.connections.delete(peerId);
                    }
                };
                this.connections.set(peerId, mockConn);
                resolve(mockConn);
                return;
            }

            const conn = this.peer.connect(peerId);
            
            conn.on('open', () => {
                this.connections.set(peerId, conn);
                console.log('[CollaborationSignaling] Connected to:', peerId);
                resolve(conn);
            });
            
            conn.on('data', (data) => {
                this._handleMessage(peerId, data);
            });
            
            conn.on('close', () => {
                this.connections.delete(peerId);
                if (this.onDisconnection) {
                    this.onDisconnection(peerId);
                }
            });
            
            conn.on('error', (err) => {
                console.error('[CollaborationSignaling] Connection error:', err);
                reject(err);
            });
        });
    }

    /**
     * Handle incoming connection
     */
    _handleConnection(conn) {
        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
            console.log('[CollaborationSignaling] Incoming connection from:', conn.peer);
            if (this.onConnection) {
                this.onConnection(conn);
            }
        });
        
        conn.on('data', (data) => {
            this._handleMessage(conn.peer, data);
        });
        
        conn.on('close', () => {
            this.connections.delete(conn.peer);
            if (this.onDisconnection) {
                this.onDisconnection(conn.peer);
            }
        });
    }

    /**
     * Handle incoming message
     */
    _handleMessage(fromPeerId, data) {
        try {
            const message = typeof data === 'string' ? JSON.parse(data) : data;
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
                handler(fromPeerId, message);
            }
        } catch (e) {
            console.error('[CollaborationSignaling] Failed to handle message:', e);
        }
    }

    /**
     * Send message to a peer
     */
    send(peerId, message) {
        const conn = this.connections.get(peerId);
        if (conn && conn.open) {
            conn.send(typeof message === 'string' ? message : JSON.stringify(message));
            return true;
        }
        console.warn('[CollaborationSignaling] Cannot send to disconnected peer:', peerId);
        return false;
    }

    /**
     * Broadcast message to all connected peers
     */
    broadcast(message) {
        const data = typeof message === 'string' ? message : JSON.stringify(message);
        this.connections.forEach((conn, peerId) => {
            if (conn.open) {
                conn.send(data);
            }
        });
    }

    /**
     * Register message handler
     */
    on(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    /**
     * Disconnect from all peers
     */
    disconnect() {
        this.connections.forEach((conn) => {
            if (conn.close) conn.close();
        });
        this.connections.clear();
        
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.peerId = null;
    }

    /**
     * Get list of connected peers
     */
    getConnectedPeers() {
        return Array.from(this.connections.keys());
    }
}

/**
 * ConflictResolver - Handles edit conflicts between collaborators
 */
export class ConflictResolver {
    constructor(config = {}) {
        this.strategy = config.strategy || 'last-writer-wins';
        this.conflictLog = [];
        this.maxLogSize = config.maxLogSize || 100;
    }

    /**
     * Resolve conflict between two transactions
     * @param {EditTransaction} local - Local transaction
     * @param {EditTransaction} remote - Remote transaction
     * @returns {EditTransaction} Resolved transaction
     */
    resolve(local, remote) {
        const conflict = {
            id: `conflict-${Date.now()}`,
            local: local.toJSON(),
            remote: remote.toJSON(),
            resolvedAt: Date.now(),
            resolution: null
        };

        let resolved;

        switch (this.strategy) {
            case 'last-writer-wins':
                resolved = local.timestamp > remote.timestamp ? local : remote;
                conflict.resolution = 'last-writer-wins';
                break;
            
            case 'operational-transform':
                resolved = this._operationalTransform(local, remote);
                conflict.resolution = 'operational-transform';
                break;
            
            case 'merge':
                resolved = this._merge(local, remote);
                conflict.resolution = 'merge';
                break;
            
            default:
                resolved = local.timestamp > remote.timestamp ? local : remote;
                conflict.resolution = 'last-writer-wins-fallback';
        }

        this._logConflict(conflict);
        return resolved;
    }

    /**
     * Operational transform resolution
     */
    _operationalTransform(local, remote) {
        // Simplified OT - in production would need full OT implementation
        // For now, merge non-conflicting changes
        if (local.path !== remote.path) {
            // Different paths - no real conflict
            return local;
        }

        // Same path - use last writer
        return local.timestamp > remote.timestamp ? local : remote;
    }

    /**
     * Merge resolution
     */
    _merge(local, remote) {
        // Attempt to merge values
        if (Array.isArray(local.newValue) && Array.isArray(remote.newValue)) {
            // Merge arrays by unique IDs
            const localIds = new Set(local.newValue.map(item => item.id));
            const merged = [...local.newValue];
            
            for (const item of remote.newValue) {
                if (!localIds.has(item.id)) {
                    merged.push(item);
                }
            }
            
            const mergedTx = new EditTransaction(local.toJSON());
            mergedTx.newValue = merged;
            mergedTx.metadata.merged = true;
            return mergedTx;
        }

        // Cannot merge - fall back to last-writer-wins
        return local.timestamp > remote.timestamp ? local : remote;
    }

    /**
     * Log conflict for debugging
     */
    _logConflict(conflict) {
        this.conflictLog.push(conflict);
        if (this.conflictLog.length > this.maxLogSize) {
            this.conflictLog.shift();
        }
    }

    /**
     * Get conflict history
     */
    getConflictLog() {
        return [...this.conflictLog];
    }

    /**
     * Clear conflict log
     */
    clearConflictLog() {
        this.conflictLog = [];
    }
}

/**
 * CollaborationSession - Represents an active collaboration session
 */
export class CollaborationSession {
    constructor(config = {}) {
        this.id = config.id || `session-${Date.now()}`;
        this.name = config.name || 'Untitled Session';
        this.projectId = config.projectId || null;
        this.ownerId = config.ownerId || '';
        this.createdAt = config.createdAt || Date.now();
        this.participants = new Map();
        this.invites = new Map();
        this.isPublic = config.isPublic || false;
        this.maxParticipants = config.maxParticipants || 10;
        this.cursors = new Map();
        this.editHistory = [];
        this.maxHistorySize = config.maxHistorySize || 1000;
        this.stateVersion = 0;
    }

    /**
     * Add participant to session
     */
    addParticipant(presence) {
        if (this.participants.size >= this.maxParticipants) {
            console.warn('[CollaborationSession] Session is full');
            return false;
        }

        this.participants.set(presence.userId, presence);
        console.log(`[CollaborationSession] Participant added: ${presence.userName} (${presence.role})`);
        return true;
    }

    /**
     * Remove participant from session
     */
    removeParticipant(userId) {
        const presence = this.participants.get(userId);
        if (presence) {
            this.participants.delete(userId);
            this.cursors.delete(userId);
            console.log(`[CollaborationSession] Participant removed: ${presence.userName}`);
            return true;
        }
        return false;
    }

    /**
     * Get participant by ID
     */
    getParticipant(userId) {
        return this.participants.get(userId);
    }

    /**
     * Get all participants
     */
    getAllParticipants() {
        return Array.from(this.participants.values());
    }

    /**
     * Update participant cursor
     */
    updateCursor(cursor) {
        this.cursors.set(cursor.userId, cursor);
    }

    /**
     * Get cursor for a user
     */
    getCursor(userId) {
        return this.cursors.get(userId);
    }

    /**
     * Get all cursors
     */
    getAllCursors() {
        return Array.from(this.cursors.values());
    }

    /**
     * Record edit transaction
     */
    recordEdit(transaction) {
        this.editHistory.push(transaction.toJSON());
        this.stateVersion++;

        if (this.editHistory.length > this.maxHistorySize) {
            this.editHistory.shift();
        }
    }

    /**
     * Get edit history
     */
    getEditHistory(limit = 100) {
        return this.editHistory.slice(-limit);
    }

    /**
     * Create invite
     */
    createInvite(inviterId, inviterName, role = CollaborationRole.VIEWER) {
        const invite = new SessionInvite({
            sessionId: this.id,
            inviterId,
            inviterName,
            projectName: this.name,
            role
        });

        this.invites.set(invite.token, invite);
        return invite;
    }

    /**
     * Accept invite
     */
    acceptInvite(token, userId, userName) {
        const invite = this.invites.get(token);
        if (!invite || invite.isExpired()) {
            return null;
        }

        invite.accepted = true;

        const presence = new CollaboratorPresence({
            userId,
            userName,
            role: invite.role
        });

        this.addParticipant(presence);
        return presence;
    }

    /**
     * Export session state
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            projectId: this.projectId,
            ownerId: this.ownerId,
            createdAt: this.createdAt,
            participants: this.getAllParticipants().map(p => p.toJSON()),
            isPublic: this.isPublic,
            maxParticipants: this.maxParticipants,
            stateVersion: this.stateVersion
        };
    }

    /**
     * Create from JSON
     */
    static fromJSON(data) {
        const session = new CollaborationSession(data);
        if (data.participants) {
            data.participants.forEach(p => {
                session.participants.set(p.userId, CollaboratorPresence.fromJSON(p));
            });
        }
        return session;
    }
}

/**
 * CollaborationManager - Main collaboration management class
 */
export class CollaborationManager {
    constructor(config = {}) {
        this.signaling = new CollaborationSignaling({
            onConnection: (conn) => this._handlePeerConnection(conn),
            onDisconnection: (peerId) => this._handlePeerDisconnection(peerId),
            onError: (err) => this._handleError(err)
        });
        
        this.conflictResolver = new ConflictResolver(config.conflictResolver);
        this.session = null;
        this.localUser = null;
        this.isConnected = false;
        this.pendingEdits = [];
        this.ackTimeout = config.ackTimeout || 5000;
        
        // Callbacks
        this.onUserJoined = config.onUserJoined || null;
        this.onUserLeft = config.onUserLeft || null;
        this.onUserUpdated = config.onUserUpdated || null;
        this.onCursorUpdated = config.onCursorUpdated || null;
        this.onEditReceived = config.onEditReceived || null;
        this.onEditAcknowledged = config.onEditAcknowledged || null;
        this.onConflictDetected = config.onConflictDetected || null;
        this.onSessionStateChanged = config.onSessionStateChanged || null;
        
        // Register message handlers
        this._registerMessageHandlers();
    }

    /**
     * Register handlers for different message types
     */
    _registerMessageHandlers() {
        this.signaling.on('user-join', (from, msg) => this._handleUserJoin(from, msg));
        this.signaling.on('user-leave', (from, msg) => this._handleUserLeave(from, msg));
        this.signaling.on('user-update', (from, msg) => this._handleUserUpdate(from, msg));
        this.signaling.on('cursor-update', (from, msg) => this._handleCursorUpdate(from, msg));
        this.signaling.on('edit', (from, msg) => this._handleEdit(from, msg));
        this.signaling.on('edit-ack', (from, msg) => this._handleEditAck(from, msg));
        this.signaling.on('edit-reject', (from, msg) => this._handleEditReject(from, msg));
        this.signaling.on('sync-request', (from, msg) => this._handleSyncRequest(from, msg));
        this.signaling.on('sync-response', (from, msg) => this._handleSyncResponse(from, msg));
    }

    /**
     * Initialize collaboration manager
     */
    async initialize(userName = 'Anonymous', apiKey = null) {
        try {
            const peerId = await this.signaling.initialize(apiKey);
            
            this.localUser = new CollaboratorPresence({
                userId: peerId,
                userName,
                role: CollaborationRole.OWNER,
                isOnline: true
            });
            
            console.log('[CollaborationManager] Initialized with peer ID:', peerId);
            return peerId;
        } catch (e) {
            console.error('[CollaborationManager] Initialization failed:', e);
            throw e;
        }
    }

    /**
     * Create a new collaboration session
     */
    async createSession(name, projectId) {
        this.session = new CollaborationSession({
            name,
            projectId,
            ownerId: this.localUser.userId
        });
        
        this.session.addParticipant(this.localUser);
        this.isConnected = true;
        
        if (this.onSessionStateChanged) {
            this.onSessionStateChanged('created', this.session);
        }
        
        console.log('[CollaborationManager] Session created:', this.session.id);
        return this.session;
    }

    /**
     * Join an existing session
     */
    async joinSession(sessionId, hostPeerId, userName, token = null) {
        try {
            const conn = await this.signaling.connect(hostPeerId);
            
            // Send join request
            const joinMsg = {
                type: 'user-join',
                sessionId,
                userName,
                token
            };
            
            this.signaling.send(hostPeerId, joinMsg);
            
            this.isConnected = true;
            console.log('[CollaborationManager] Joining session:', sessionId);
            
            return true;
        } catch (e) {
            console.error('[CollaborationManager] Failed to join session:', e);
            throw e;
        }
    }

    /**
     * Leave current session
     */
    async leaveSession() {
        if (this.session && this.localUser) {
            const leaveMsg = {
                type: 'user-leave',
                sessionId: this.session.id,
                userId: this.localUser.userId
            };
            
            this.signaling.broadcast(leaveMsg);
        }
        
        this.signaling.disconnect();
        this.session = null;
        this.isConnected = false;
        
        if (this.onSessionStateChanged) {
            this.onSessionStateChanged('left', null);
        }
        
        console.log('[CollaborationManager] Left session');
    }

    /**
     * Generate shareable invite link
     */
    generateInviteLink(role = CollaborationRole.VIEWER) {
        if (!this.session || !this.localUser) {
            return null;
        }

        const invite = this.session.createInvite(
            this.localUser.userId,
            this.localUser.userName,
            role
        );

        // Encode invite data
        const inviteData = btoa(JSON.stringify({
            hostPeerId: this.localUser.userId,
            sessionId: this.session.id,
            token: invite.token
        }));

        return {
            inviteCode: inviteData,
            expiresAt: invite.expiresAt,
            url: `${window.location.origin}${window.location.pathname}?collab=${inviteData}`
        };
    }

    /**
     * Parse invite link
     */
    static parseInviteLink(inviteCode) {
        try {
            const data = JSON.parse(atob(inviteCode));
            return {
                hostPeerId: data.hostPeerId,
                sessionId: data.sessionId,
                token: data.token
            };
        } catch (e) {
            console.error('[CollaborationManager] Failed to parse invite:', e);
            return null;
        }
    }

    /**
     * Broadcast cursor position
     */
    broadcastCursor(cursorData) {
        if (!this.isConnected || !this.session) return;

        const cursor = new CollaboratorCursor({
            ...cursorData,
            userId: this.localUser.userId,
            userName: this.localUser.userName,
            userColor: this.localUser.userColor
        });

        const msg = {
            type: 'cursor-update',
            sessionId: this.session.id,
            cursor: cursor.toJSON()
        };

        this.signaling.broadcast(msg);
        this.session.updateCursor(cursor);
    }

    /**
     * Broadcast edit operation
     */
    broadcastEdit(operation, targetId, oldValue, newValue, metadata = {}) {
        if (!this.isConnected || !this.session) return;

        const transaction = new EditTransaction({
            operation,
            userId: this.localUser.userId,
            targetId,
            oldValue,
            newValue,
            metadata
        });

        const msg = {
            type: 'edit',
            sessionId: this.session.id,
            transaction: transaction.toJSON()
        };

        // Add to pending edits for acknowledgment tracking
        this.pendingEdits.push({
            transactionId: transaction.id,
            timestamp: Date.now(),
            acknowledged: false
        });

        this.signaling.broadcast(msg);
        this.session.recordEdit(transaction);
    }

    /**
     * Request full state sync
     */
    requestSync(peerId) {
        const msg = {
            type: 'sync-request',
            sessionId: this.session?.id,
            userId: this.localUser?.userId,
            stateVersion: this.session?.stateVersion || 0
        };

        this.signaling.send(peerId, msg);
    }

    /**
     * Get current session info
     */
    getSessionInfo() {
        if (!this.session) return null;
        return this.session.toJSON();
    }

    /**
     * Get all active cursors (excluding local user)
     */
    getActiveCursors() {
        if (!this.session) return [];
        return this.session.getAllCursors().filter(c => c.userId !== this.localUser?.userId);
    }

    /**
     * Get all participants (excluding local user)
     */
    getParticipants() {
        if (!this.session) return [];
        return this.session.getAllParticipants().filter(p => p.userId !== this.localUser?.userId);
    }

    // Message handlers

    _handlePeerConnection(conn) {
        console.log('[CollaborationManager] New peer connected:', conn.peer);
    }

    _handlePeerDisconnection(peerId) {
        if (this.session) {
            this.session.removeParticipant(peerId);
            
            if (this.onUserLeft) {
                this.onUserLeft(peerId);
            }
        }
    }

    _handleError(error) {
        console.error('[CollaborationManager] Error:', error);
    }

    _handleUserJoin(from, msg) {
        if (!this.session) return;

        const presence = new CollaboratorPresence({
            userId: from,
            userName: msg.userName,
            role: msg.role || CollaborationRole.EDITOR,
            isOnline: true
        });

        this.session.addParticipant(presence);

        // Send acknowledgment with current state
        const ackMsg = {
            type: 'user-ack',
            sessionId: this.session.id,
            stateVersion: this.session.stateVersion
        };
        this.signaling.send(from, ackMsg);

        if (this.onUserJoined) {
            this.onUserJoined(presence);
        }
    }

    _handleUserLeave(from, msg) {
        if (!this.session) return;

        this.session.removeParticipant(msg.userId);

        if (this.onUserLeft) {
            this.onUserLeft(msg.userId);
        }
    }

    _handleUserUpdate(from, msg) {
        if (!this.session) return;

        const presence = this.session.getParticipant(from);
        if (presence) {
            Object.assign(presence, msg.updates);
            
            if (this.onUserUpdated) {
                this.onUserUpdated(presence);
            }
        }
    }

    _handleCursorUpdate(from, msg) {
        if (!this.session) return;

        const cursor = CollaboratorCursor.fromJSON(msg.cursor);
        this.session.updateCursor(cursor);

        if (this.onCursorUpdated) {
            this.onCursorUpdated(cursor);
        }
    }

    _handleEdit(from, msg) {
        if (!this.session) return;

        const transaction = EditTransaction.fromJSON(msg.transaction);

        // Check for conflicts
        const recentEdits = this.session.getEditHistory(10);
        const conflict = recentEdits.find(e => 
            e.targetId === transaction.targetId &&
            e.path === transaction.path &&
            e.userId !== transaction.userId &&
            (Date.now() - e.timestamp) < 1000 // Within 1 second
        );

        if (conflict) {
            const resolved = this.conflictResolver.resolve(
                EditTransaction.fromJSON(conflict),
                transaction
            );

            if (this.onConflictDetected) {
                this.onConflictDetected(transaction, EditTransaction.fromJSON(conflict), resolved);
            }

            // Send rejection with resolution
            const rejectMsg = {
                type: 'edit-reject',
                transactionId: transaction.id,
                resolution: resolved.toJSON()
            };
            this.signaling.send(from, rejectMsg);
        } else {
            // Acknowledge the edit
            this.session.recordEdit(transaction);

            const ackMsg = {
                type: 'edit-ack',
                transactionId: transaction.id,
                stateVersion: this.session.stateVersion
            };
            this.signaling.send(from, ackMsg);

            if (this.onEditReceived) {
                this.onEditReceived(transaction);
            }
        }
    }

    _handleEditAck(from, msg) {
        const pending = this.pendingEdits.find(e => e.transactionId === msg.transactionId);
        if (pending) {
            pending.acknowledged = true;
            
            if (this.onEditAcknowledged) {
                this.onEditAcknowledged(msg.transactionId, msg.stateVersion);
            }
        }
    }

    _handleEditReject(from, msg) {
        const pending = this.pendingEdits.find(e => e.transactionId === msg.transactionId);
        if (pending) {
            pending.rejected = true;
            pending.resolution = msg.resolution;
            
            if (this.onConflictDetected) {
                this.onConflictDetected(null, null, EditTransaction.fromJSON(msg.resolution));
            }
        }
    }

    _handleSyncRequest(from, msg) {
        if (!this.session) return;

        // Send current state
        const response = {
            type: 'sync-response',
            sessionId: this.session.id,
            stateVersion: this.session.stateVersion,
            editHistory: this.session.getEditHistory(100)
        };

        this.signaling.send(from, response);
    }

    _handleSyncResponse(from, msg) {
        // Apply remote state
        if (msg.editHistory) {
            msg.editHistory.forEach(editData => {
                const transaction = EditTransaction.fromJSON(editData);
                if (this.onEditReceived) {
                    this.onEditReceived(transaction);
                }
            });
        }
    }

    /**
     * Dispose of collaboration manager
     */
    dispose() {
        this.leaveSession();
        this.signaling.disconnect();
        this.pendingEdits = [];
    }
}

// Create singleton instance
export const collaborationManager = new CollaborationManager();

// Default export
export default {
    CollaborationRole,
    CollaborationPermission,
    EditOperation,
    CollaboratorCursor,
    CollaboratorPresence,
    EditTransaction,
    SessionInvite,
    SignalingMessage,
    CollaborationSignaling,
    ConflictResolver,
    CollaborationSession,
    CollaborationManager,
    collaborationManager
};