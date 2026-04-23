// js/MuteGroupsPanel.js - Track Mute Groups Panel
import {
    getMuteGroups, getMuteGroupById, addMuteGroup, removeMuteGroup,
    updateMuteGroup, addTrackToMuteGroup, removeTrackFromMuteGroup,
    getMuteGroupForTrack, handleMuteGroupExclusiveUnmute, clearAllMuteGroups,
    getTracksState, getTrackByIdState
} from './state.js';

// --- Local App Services ---
let localAppServices = {};

/**
 * Initialize the Mute Groups Panel module with app services.
 * @param {Object} appServices - Services from main.js
 */
export function initializeMuteGroupsPanel(appServices) {
    localAppServices = appServices || {};
    console.log('[MuteGroupsPanel] Module initialized');
}

// --- State ---
let isPanelOpen = false;
let panelElement = null;

// --- Get Mute Groups Panel State ---
export function getMuteGroupsPanelState() {
    return { isOpen: isPanelOpen };
}

// --- Render Mute Groups List ---
function renderMuteGroupsList(container) {
    const groups = getMuteGroups();
    const tracks = getTracksState();
    
    const listContainer = container.querySelector('#muteGroupsList');
    if (!listContainer) return;
    
    if (groups.length === 0) {
        listContainer.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #888;">
                <p>No mute groups created yet.</p>
                <p style="font-size: 12px; margin-top: 8px;">Click "New Group" to create one.</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = groups.map(group => {
        const trackNames = group.trackIds.map(tid => {
            const track = tracks.find(t => t.id === tid);
            return track ? track.name : `Track ${tid}`;
        });
        
        return `
            <div class="mute-group-item" data-group-id="${group.id}" style="
                background: #1e293b;
                border: 1px solid #334155;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 8px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <input type="text" value="${group.name}" class="group-name-input" data-group-id="${group.id}" style="
                        background: #0f172a;
                        border: 1px solid #475569;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: #e2e8f0;
                        font-size: 14px;
                        width: 150px;
                    " />
                    <div style="display: flex; gap: 4px;">
                        <button class="edit-group-btn" data-group-id="${group.id}" style="
                            background: #3b82f6;
                            border: none;
                            border-radius: 4px;
                            padding: 4px 8px;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                        ">Edit</button>
                        <button class="delete-group-btn" data-group-id="${group.id}" style="
                            background: #ef4444;
                            border: none;
                            border-radius: 4px;
                            padding: 4px 8px;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                        ">Delete</button>
                    </div>
                </div>
                <div style="font-size: 12px; color: #94a3b8;">
                    <strong>Tracks (${group.trackIds.length}):</strong>
                    ${group.trackIds.length > 0 ? trackNames.join(', ') : '<em>None assigned</em>'}
                </div>
                <div style="margin-top: 8px;">
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #94a3b8; cursor: pointer;">
                        <input type="checkbox" class="exclusive-toggle" data-group-id="${group.id}" ${group.exclusive ? 'checked' : ''} style="cursor: pointer;" />
                        Exclusive mode (only one track plays at a time)
                    </label>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    attachGroupEventListeners(container, listContainer);
}

// --- Attach Event Listeners for Groups ---
function attachGroupEventListeners(container, listContainer) {
    // Group name change
    listContainer.querySelectorAll('.group-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const groupId = parseInt(e.target.dataset.groupId);
            const newName = e.target.value.trim();
            if (newName) {
                updateMuteGroup(groupId, { name: newName });
                localAppServices.showNotification?.(`Group renamed to "${newName}"`, 1500);
            }
        });
    });
    
    // Edit group button
    listContainer.querySelectorAll('.edit-group-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupId = parseInt(e.target.dataset.groupId);
            openEditGroupDialog(groupId, container);
        });
    });
    
    // Delete group button
    listContainer.querySelectorAll('.delete-group-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const groupId = parseInt(e.target.dataset.groupId);
            if (confirm('Delete this mute group?')) {
                removeMuteGroup(groupId);
                renderMuteGroupsList(container);
                localAppServices.showNotification?.('Mute group deleted', 1500);
            }
        });
    });
    
    // Exclusive mode toggle
    listContainer.querySelectorAll('.exclusive-toggle').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const groupId = parseInt(e.target.dataset.groupId);
            updateMuteGroup(groupId, { exclusive: e.target.checked });
            const mode = e.target.checked ? 'Exclusive' : 'Non-exclusive';
            localAppServices.showNotification?.(`Group set to ${mode} mode`, 1500);
        });
    });
}

// --- Open Edit Group Dialog ---
function openEditGroupDialog(groupId, container) {
    const group = getMuteGroupById(groupId);
    const tracks = getTracksState();
    
    if (!group) return;
    
    const dialogOverlay = document.createElement('div');
    dialogOverlay.className = 'mute-group-dialog-overlay';
    dialogOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const dialogContent = document.createElement('div');
    dialogContent.style.cssText = `
        background: #1e293b;
        border-radius: 8px;
        padding: 20px;
        max-width: 400px;
        max-height: 60vh;
        overflow-y: auto;
    `;
    
    dialogContent.innerHTML = `
        <h3 style="margin: 0 0 16px 0; color: #e2e8f0;">Edit "${group.name}"</h3>
        <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 13px;">
            Select tracks to include in this mute group:
        </p>
        <div class="track-selection-list" style="margin-bottom: 16px;">
            ${tracks.map(track => `
                <label style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px;
                    background: #0f172a;
                    border-radius: 4px;
                    margin-bottom: 4px;
                    cursor: pointer;
                ">
                    <input type="checkbox" class="track-checkbox" data-track-id="${track.id}" 
                        ${group.trackIds.includes(track.id) ? 'checked' : ''} style="cursor: pointer;" />
                    <span style="color: #e2e8f0; font-size: 13px;">${track.name}</span>
                    <span style="color: #64748b; font-size: 11px;">(${track.type})</span>
                </label>
            `).join('')}
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button class="cancel-btn" style="
                background: #475569;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                color: #e2e8f0;
                cursor: pointer;
            ">Cancel</button>
            <button class="save-btn" style="
                background: #22c55e;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                color: white;
                cursor: pointer;
            ">Save</button>
        </div>
    `;
    
    dialogOverlay.appendChild(dialogContent);
    document.body.appendChild(dialogOverlay);
    
    // Cancel button
    dialogContent.querySelector('.cancel-btn').addEventListener('click', () => {
        dialogOverlay.remove();
    });
    
    // Save button
    dialogContent.querySelector('.save-btn').addEventListener('click', () => {
        const selectedTrackIds = [];
        dialogContent.querySelectorAll('.track-checkbox:checked').forEach(cb => {
            selectedTrackIds.push(parseInt(cb.dataset.trackId));
        });
        
        updateMuteGroup(groupId, { trackIds: selectedTrackIds });
        renderMuteGroupsList(container);
        dialogOverlay.remove();
        localAppServices.showNotification?.('Group updated', 1500);
    });
    
    // Close on overlay click
    dialogOverlay.addEventListener('click', (e) => {
        if (e.target === dialogOverlay) {
            dialogOverlay.remove();
        }
    });
}

// --- Open Mute Groups Panel ---
export function openMuteGroupsPanel() {
    const windowId = 'muteGroupsPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'muteGroupsPanelContent';
    contentContainer.className = 'p-3 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';
    contentContainer.style.cssText = 'background: #0f172a; color: #e2e8f0;';
    
    contentContainer.innerHTML = `
        <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 12px 0; color: #94a3b8; font-size: 13px;">
                Mute groups allow you to group tracks so that only one track in the group plays at a time (exclusive mode).
                When you unmute a track in an exclusive group, all other tracks in that group are automatically muted.
            </p>
            <div style="display: flex; gap: 8px;">
                <button id="newMuteGroupBtn" style="
                    background: #22c55e;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    color: white;
                    cursor: pointer;
                    font-size: 13px;
                ">+ New Group</button>
                <button id="clearAllGroupsBtn" style="
                    background: #ef4444;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 16px;
                    color: white;
                    cursor: pointer;
                    font-size: 13px;
                ">Clear All</button>
            </div>
        </div>
        <div id="muteGroupsList"></div>
    `;
    
    const options = {
        width: 420,
        height: 400,
        minWidth: 320,
        minHeight: 250,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Mute Groups', contentContainer, options);
    
    if (win?.element) {
        isPanelOpen = true;
        panelElement = contentContainer;
        
        // Render initial content
        renderMuteGroupsList(contentContainer);
        
        // New group button
        const newGroupBtn = contentContainer.querySelector('#newMuteGroupBtn');
        if (newGroupBtn) {
            newGroupBtn.addEventListener('click', () => {
                const group = addMuteGroup(`Mute Group ${getMuteGroups().length + 1}`);
                renderMuteGroupsList(contentContainer);
                localAppServices.showNotification?.('New mute group created', 1500);
            });
        }
        
        // Clear all groups button
        const clearAllBtn = contentContainer.querySelector('#clearAllGroupsBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (confirm('Delete all mute groups?')) {
                    clearAllMuteGroups();
                    renderMuteGroupsList(contentContainer);
                    localAppServices.showNotification?.('All mute groups cleared', 1500);
                }
            });
        }
    }
    
    return win;
}

// --- Update Panel if Open ---
export function updateMuteGroupsPanel() {
    if (isPanelOpen && panelElement) {
        renderMuteGroupsList(panelElement);
    }
}