/**
 * Real-time Collaboration Chat - Built-in chat for collaborators
 * Chat system for real-time collaboration sessions
 */

class RealtimeCollaborationChat {
    constructor(options = {}) {
        this.name = 'RealtimeCollaborationChat';
        
        // Configuration
        this.config = {
            maxMessages: options.maxMessages || 100,
            pingInterval: options.pingInterval || 30000,
            reconnectDelay: options.reconnectDelay || 3000,
            ...options
        };
        
        // Connection state
        this.isConnected = false;
        this.socket = null;
        this.sessionId = null;
        this.userId = null;
        this.userName = null;
        
        // Users
        this.users = new Map();
        
        // Messages
        this.messages = [];
        
        // Typing indicators
        this.typingUsers = new Set();
        this.typingTimeout = null;
        
        // Presence
        this.presence = new Map();
        
        // Callbacks
        this.onMessage = null;
        this.onUserJoin = null;
        this.onUserLeave = null;
        this.onTyping = null;
        this.onConnectionChange = null;
        
        // UI
        this.container = null;
    }
    
    // Connection
    connect(sessionId, userId, userName, serverUrl) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.userName = userName;
        
        try {
            // In a real implementation, this would use WebSocket
            // For now, we'll simulate with local events
            this.isConnected = true;
            
            // Add self to users
            this.users.set(userId, {
                id: userId,
                name: userName,
                status: 'online',
                color: this.getUserColor(userId),
                lastSeen: Date.now()
            });
            
            // Start heartbeat
            this.startHeartbeat();
            
            if (this.onConnectionChange) {
                this.onConnectionChange({ connected: true });
            }
            
            // System message
            this.addSystemMessage(`${userName} joined the session`);
            
            console.log(`[CollaborationChat] Connected as ${userName}`);
        } catch (err) {
            console.error('[CollaborationChat] Connection failed:', err);
            this.scheduleReconnect();
        }
    }
    
    disconnect() {
        this.isConnected = false;
        
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        
        if (this.onConnectionChange) {
            this.onConnectionChange({ connected: false });
        }
        
        // System message
        this.addSystemMessage(`${this.userName} left the session`);
    }
    
    scheduleReconnect() {
        setTimeout(() => {
            if (!this.isConnected && this.sessionId) {
                this.connect(this.sessionId, this.userId, this.userName);
            }
        }, this.config.reconnectDelay);
    }
    
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendPresence('active');
            }
        }, this.config.pingInterval);
    }
    
    // Messaging
    sendMessage(content, type = 'text') {
        if (!this.isConnected || !content.trim()) return;
        
        const message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: this.userId,
            userName: this.userName,
            content: content.trim(),
            type, // 'text', 'system', 'file', 'action'
            timestamp: Date.now(),
            edited: false,
            reactions: []
        };
        
        this.messages.push(message);
        this.trimMessages();
        
        if (this.onMessage) {
            this.onMessage(message);
        }
        
        // In real implementation, would send to server
        this.broadcast('message', message);
        
        return message;
    }
    
    addSystemMessage(content) {
        const message = {
            id: `sys_${Date.now()}`,
            userId: 'system',
            userName: 'System',
            content,
            type: 'system',
            timestamp: Date.now(),
            edited: false,
            reactions: []
        };
        
        this.messages.push(message);
        this.trimMessages();
        
        if (this.onMessage) {
            this.onMessage(message);
        }
        
        return message;
    }
    
    editMessage(messageId, newContent) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message || message.userId !== this.userId) return false;
        
        message.content = newContent;
        message.edited = true;
        message.editedAt = Date.now();
        
        this.broadcast('message_edit', { messageId, newContent });
        
        return true;
    }
    
    deleteMessage(messageId) {
        const index = this.messages.findIndex(m => m.id === messageId);
        if (index === -1) return false;
        
        const message = this.messages[index];
        if (message.userId !== this.userId && message.type !== 'system') return false;
        
        this.messages.splice(index, 1);
        
        this.broadcast('message_delete', { messageId });
        
        return true;
    }
    
    // Reactions
    addReaction(messageId, emoji) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return false;
        
        const existingReaction = message.reactions.find(r => 
            r.emoji === emoji && r.users.includes(this.userId)
        );
        
        if (existingReaction) {
            // Toggle off
            existingReaction.users = existingReaction.users.filter(u => u !== this.userId);
            if (existingReaction.users.length === 0) {
                message.reactions = message.reactions.filter(r => r.emoji !== emoji);
            }
        } else {
            // Toggle on
            let reaction = message.reactions.find(r => r.emoji === emoji);
            if (reaction) {
                reaction.users.push(this.userId);
            } else {
                message.reactions.push({
                    emoji,
                    users: [this.userId]
                });
            }
        }
        
        this.broadcast('reaction', { messageId, emoji, userId: this.userId });
        
        return true;
    }
    
    // Typing indicator
    sendTyping(isTyping) {
        if (!this.isConnected) return;
        
        this.broadcast('typing', { userId: this.userId, isTyping });
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        if (isTyping) {
            this.typingTimeout = setTimeout(() => {
                this.sendTyping(false);
            }, 5000);
        }
    }
    
    // Presence
    sendPresence(status) {
        if (!this.isConnected) return;
        
        const user = this.users.get(this.userId);
        if (user) {
            user.status = status;
            user.lastSeen = Date.now();
        }
        
        this.broadcast('presence', { userId: this.userId, status });
    }
    
    // Broadcast (simulated)
    broadcast(type, data) {
        // In real implementation, would send via WebSocket
        const event = new CustomEvent(`collab_${type}`, { detail: data });
        window.dispatchEvent(event);
    }
    
    // Message handling
    handleIncomingMessage(data) {
        switch (data.type) {
            case 'message':
                this.messages.push(data.message);
                this.trimMessages();
                if (this.onMessage) {
                    this.onMessage(data.message);
                }
                break;
                
            case 'user_join':
                this.users.set(data.user.id, data.user);
                if (this.onUserJoin) {
                    this.onUserJoin(data.user);
                }
                this.addSystemMessage(`${data.user.name} joined the session`);
                break;
                
            case 'user_leave':
                this.users.delete(data.userId);
                const user = data.userName;
                if (this.onUserLeave) {
                    this.onUserLeave(data.userId);
                }
                this.addSystemMessage(`${user} left the session`);
                break;
                
            case 'typing':
                if (data.isTyping) {
                    this.typingUsers.add(data.userId);
                } else {
                    this.typingUsers.delete(data.userId);
                }
                if (this.onTyping) {
                    this.onTyping(Array.from(this.typingUsers));
                }
                break;
                
            case 'presence':
                const existingUser = this.users.get(data.userId);
                if (existingUser) {
                    existingUser.status = data.status;
                    existingUser.lastSeen = Date.now();
                }
                break;
        }
    }
    
    trimMessages() {
        if (this.messages.length > this.config.maxMessages) {
            this.messages = this.messages.slice(-this.config.maxMessages);
        }
    }
    
    // User management
    getUserColor(userId) {
        // Generate consistent color from user ID
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }
    
    getUsers() {
        return Array.from(this.users.values());
    }
    
    getOnlineUsers() {
        return this.getUsers().filter(u => u.status === 'online' || u.status === 'active');
    }
    
    // File sharing (simplified)
    shareFile(file) {
        // In real implementation, would upload to server and share link
        this.sendMessage(`📎 Shared file: ${file.name}`, 'file');
    }
    
    // Action messages
    sendAction(action) {
        this.sendMessage(action, 'action');
    }
    
    // History
    getMessages() {
        return [...this.messages];
    }
    
    getMessagesSince(timestamp) {
        return this.messages.filter(m => m.timestamp > timestamp);
    }
    
    searchMessages(query) {
        const lowerQuery = query.toLowerCase();
        return this.messages.filter(m => 
            m.content.toLowerCase().includes(lowerQuery) ||
            m.userName.toLowerCase().includes(lowerQuery)
        );
    }
    
    // UI
    createUI(container) {
        this.container = container;
        
        container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                height: 500px;
                background: #1a1a2e;
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #fff;
                overflow: hidden;
            ">
                <!-- Header -->
                <div style="
                    padding: 12px 16px;
                    background: #2a2a4e;
                    border-bottom: 1px solid #444;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <h3 style="margin: 0; font-size: 14px;">Collaboration Chat</h3>
                        <div id="connection-status" style="font-size: 11px; color: #888;">Disconnected</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div id="online-users" style="font-size: 12px; color: #888;"></div>
                        <button id="toggle-user-list-btn" style="padding: 4px 8px; background: #555; border: none; border-radius: 4px; color: white; cursor: pointer; font-size: 11px;">Users</button>
                    </div>
                </div>
                
                <!-- Messages -->
                <div id="messages-container" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                "></div>
                
                <!-- Typing indicator -->
                <div id="typing-indicator" style="
                    padding: 4px 16px;
                    font-size: 11px;
                    color: #888;
                    height: 20px;
                "></div>
                
                <!-- Input -->
                <div style="
                    padding: 12px 16px;
                    background: #2a2a4e;
                    border-top: 1px solid #444;
                ">
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="message-input" placeholder="Type a message..." style="
                            flex: 1;
                            padding: 10px 16px;
                            background: #1a1a2e;
                            border: 1px solid #444;
                            border-radius: 20px;
                            color: white;
                            font-size: 14px;
                            outline: none;
                        " onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#444'">
                        <button id="send-btn" style="
                            padding: 10px 20px;
                            background: #3b82f6;
                            border: none;
                            border-radius: 20px;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                        ">Send</button>
                    </div>
                </div>
            </div>
            
            <!-- User list panel (hidden by default) -->
            <div id="user-list-panel" style="
                display: none;
                position: absolute;
                top: 60px;
                right: 16px;
                width: 200px;
                background: #2a2a4e;
                border: 1px solid #444;
                border-radius: 8px;
                padding: 12px;
                z-index: 100;
            "></div>
        `;
        
        this.setupEventHandlers();
        this.updateMessagesDisplay();
    }
    
    setupEventHandlers() {
        const input = this.container.querySelector('#message-input');
        const sendBtn = this.container.querySelector('#send-btn');
        const toggleUserListBtn = this.container.querySelector('#toggle-user-list-btn');
        
        // Send message
        const sendMessage = () => {
            const content = input.value.trim();
            if (content) {
                this.sendMessage(content);
                input.value = '';
                this.sendTyping(false);
                this.updateMessagesDisplay();
            }
        };
        
        sendBtn.onclick = sendMessage;
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        };
        
        // Typing indicator
        input.oninput = () => {
            this.sendTyping(true);
        };
        
        // User list toggle
        toggleUserListBtn.onclick = () => {
            const panel = this.container.querySelector('#user-list-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            this.updateUserListDisplay();
        };
        
        // Close user list when clicking outside
        document.onclick = (e) => {
            if (!e.target.closest('#toggle-user-list-btn') && !e.target.closest('#user-list-panel')) {
                this.container.querySelector('#user-list-panel').style.display = 'none';
            }
        };
    }
    
    updateMessagesDisplay() {
        const container = this.container.querySelector('#messages-container');
        
        container.innerHTML = this.messages.map(msg => {
            if (msg.type === 'system') {
                return `
                    <div style="
                        text-align: center;
                        padding: 8px;
                        font-size: 12px;
                        color: #888;
                    ">${this.escapeHtml(msg.content)}</div>
                `;
            }
            
            const user = this.users.get(msg.userId) || { name: msg.userName, color: '#888' };
            const time = new Date(msg.timestamp).toLocaleTimeString();
            
            return `
                <div class="message" data-message-id="${msg.id}" style="
                    display: flex;
                    gap: 8px;
                    padding: 8px;
                    border-radius: 8px;
                    ${msg.userId === this.userId ? 'background: rgba(59, 130, 246, 0.1); margin-left: 40px;' : ''}
                ">
                    <div style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: ${user.color};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 12px;
                        flex-shrink: 0;
                    ">${user.name.charAt(0).toUpperCase()}</div>
                    <div style="flex: 1;">
                        <div style="display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px;">
                            <span style="font-weight: 600; font-size: 13px; color: ${user.color};">${this.escapeHtml(msg.userName)}</span>
                            <span style="font-size: 10px; color: #666;">${time}${msg.edited ? ' (edited)' : ''}</span>
                        </div>
                        <div style="font-size: 13px; color: #ddd; word-wrap: break-word;">${this.escapeHtml(msg.content)}</div>
                        ${msg.reactions.length > 0 ? `
                            <div style="margin-top: 4px; display: flex; gap: 4px;">
                                ${msg.reactions.map(r => `
                                    <span style="
                                        background: #444;
                                        padding: 2px 6px;
                                        border-radius: 10px;
                                        font-size: 11px;
                                    ">${r.emoji} ${r.users.length}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        // Update connection status
        const status = this.container.querySelector('#connection-status');
        status.textContent = this.isConnected ? 'Connected' : 'Disconnected';
        status.style.color = this.isConnected ? '#10b981' : '#ef4444';
        
        // Update online users
        this.container.querySelector('#online-users').textContent = `${this.getOnlineUsers().length} online`;
    }
    
    updateUserListDisplay() {
        const panel = this.container.querySelector('#user-list-panel');
        
        panel.innerHTML = `
            <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #888;">Users</h4>
            ${this.getUsers().map(user => `
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 0;
                    border-bottom: 1px solid #444;
                ">
                    <div style="
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        background: ${user.color};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 10px;
                    ">${user.name.charAt(0).toUpperCase()}</div>
                    <div style="flex: 1;">
                        <div style="font-size: 12px;">${this.escapeHtml(user.name)}</div>
                        <div style="font-size: 10px; color: ${user.status === 'online' || user.status === 'active' ? '#10b981' : '#888'};">
                            ${user.status}
                        </div>
                    </div>
                </div>
            `).join('')}
        `;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    openPanel() {
        const existing = document.getElementById('collab-chat-panel');
        if (existing) {
            existing.remove();
        }
        
        const panel = document.createElement('div');
        panel.id = 'collab-chat-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            background: #1a1a2e;
            border: 1px solid #444;
            border-radius: 8px;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #fff;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        
        document.body.appendChild(panel);
        this.createUI(panel);
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 12px;
            right: 12px;
            width: 24px;
            height: 24px;
            background: transparent;
            border: none;
            color: #888;
            cursor: pointer;
            font-size: 18px;
        `;
        closeBtn.onclick = () => {
            this.disconnect();
            panel.remove();
        };
        panel.appendChild(closeBtn);
    }
    
    // Demo mode (for testing without server)
    startDemoMode() {
        this.connect('demo-session', 'user-' + Date.now(), 'Demo User', null);
        
        // Add some demo messages
        setTimeout(() => {
            this.addSystemMessage('Welcome to the collaboration chat!');
        }, 500);
        
        setTimeout(() => {
            this.messages.push({
                id: 'demo1',
                userId: 'demo-user-1',
                userName: 'Alice',
                content: 'Hey, I just added a new synth track!',
                type: 'text',
                timestamp: Date.now(),
                reactions: [{ emoji: '👍', users: ['user-' + Date.now()] }]
            });
            this.updateMessagesDisplay();
        }, 1500);
        
        setTimeout(() => {
            this.messages.push({
                id: 'demo2',
                userId: 'demo-user-2',
                userName: 'Bob',
                content: 'Sounds great! I\'ll add some drums.',
                type: 'text',
                timestamp: Date.now(),
                reactions: []
            });
            this.updateMessagesDisplay();
        }, 3000);
    }
}

// Export for use in main DAW
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RealtimeCollaborationChat };
} else if (typeof window !== 'undefined') {
    window.RealtimeCollaborationChat = RealtimeCollaborationChat;
}