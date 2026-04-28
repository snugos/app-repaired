// js/ProjectBackupManager.js - Project Version Backup Manager
// Feature: Create and manage project version snapshots for safe experimentation

let localAppServices = {};
let backups = new Map(); // backupId -> { id, name, timestamp, data, thumbnail }
const MAX_BACKUPS = 20;

export function initProjectBackupManager(services) {
    localAppServices = services || {};
    console.log('[ProjectBackupManager] Module initialized');
    
    // Load existing backups from localStorage
    loadBackupsFromStorage();
}

function loadBackupsFromStorage() {
    try {
        const stored = localStorage.getItem('snaw_project_backups');
        if (stored) {
            const data = JSON.parse(stored);
            Object.entries(data).forEach(([id, backup]) => {
                backups.set(id, backup);
            });
            console.log(`[ProjectBackupManager] Loaded ${backups.size} backups from storage`);
        }
    } catch (e) {
        console.warn('[ProjectBackupManager] Failed to load backups:', e);
    }
}

function saveBackupsToStorage() {
    try {
        const data = Object.fromEntries(backups);
        localStorage.setItem('snaw_project_backups', JSON.stringify(data));
    } catch (e) {
        console.warn('[ProjectBackupManager] Failed to save backups:', e);
    }
}

/**
 * Create a new project backup
 * @param {string} name - Name for the backup
 * @param {string} description - Optional description
 * @returns {object} The created backup
 */
export function createBackup(name, description = '') {
    const id = `backup-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    // Gather current project state
    const projectData = localAppServices.gatherProjectData 
        ? localAppServices.gatherProjectData() 
        : {};
    
    const backup = {
        id,
        name: name || `Backup ${new Date().toLocaleString()}`,
        description,
        timestamp: Date.now(),
        data: projectData,
        size: JSON.stringify(projectData).length
    };
    
    backups.set(id, backup);
    
    // Enforce max backups limit
    if (backups.size > MAX_BACKUPS) {
        const oldest = Array.from(backups.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        if (oldest) {
            backups.delete(oldest[0]);
            console.log('[ProjectBackupManager] Removed oldest backup:', oldest[0]);
        }
    }
    
    saveBackupsToStorage();
    console.log(`[ProjectBackupManager] Created backup: ${backup.name}`);
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Backup "${backup.name}" created`, 2000);
    }
    
    return backup;
}

/**
 * Restore a project from backup
 * @param {string} backupId - The backup ID to restore
 * @returns {boolean} Success
 */
export async function restoreBackup(backupId) {
    const backup = backups.get(backupId);
    if (!backup) {
        console.error('[ProjectBackupManager] Backup not found:', backupId);
        return false;
    }
    
    if (!backup.data) {
        console.error('[ProjectBackupManager] Backup has no data:', backupId);
        return false;
    }
    
    // Confirm with user first
    if (localAppServices.showConfirmationDialog) {
        const confirmed = await localAppServices.showConfirmationDialog(
            `Restore "${backup.name}"?`,
            'Current project will be replaced with the backup.'
        );
        if (!confirmed) return false;
    }
    
    // Reconstruct project from backup
    if (localAppServices.reconstructDAW) {
        await localAppServices.reconstructDAW(backup.data, false);
        console.log(`[ProjectBackupManager] Restored backup: ${backup.name}`);
        
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Restored "${backup.name}"`, 2000);
        }
        return true;
    }
    
    return false;
}

/**
 * Delete a backup
 * @param {string} backupId - The backup ID to delete
 */
export function deleteBackup(backupId) {
    if (backups.has(backupId)) {
        const backup = backups.get(backupId);
        backups.delete(backupId);
        saveBackupsToStorage();
        console.log(`[ProjectBackupManager] Deleted backup: ${backup.name}`);
        return true;
    }
    return false;
}

/**
 * Get all backups sorted by timestamp (newest first)
 * @returns {Array} Array of backup objects
 */
export function getBackups() {
    return Array.from(backups.values())
        .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Rename a backup
 * @param {string} backupId - The backup ID
 * @param {string} newName - New name
 */
export function renameBackup(backupId, newName) {
    const backup = backups.get(backupId);
    if (backup) {
        backup.name = newName;
        saveBackupsToStorage();
        return true;
    }
    return false;
}

/**
 * Open the backup manager panel
 */
export function openBackupManagerPanel() {
    const windowId = 'projectBackupManager';
    const openWindows = localAppServices.getOpenWindows 
        ? localAppServices.getOpenWindows() 
        : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderBackupPanel();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'backupManagerContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-hidden';
    
    const options = {
        width: 600,
        height: 500,
        minWidth: 450,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(
        windowId,
        'Project Backup Manager',
        contentContainer,
        options
    );
    
    if (win?.element) {
        renderBackupPanel();
    }
    
    return win;
}

function renderBackupPanel() {
    const container = document.getElementById('backupManagerContent');
    if (!container) return;
    
    const backupList = getBackups();
    
    let html = `
        <div class="mb-4 flex items-center justify-between">
            <div>
                <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">Project Backups</h3>
                <p class="text-xs text-gray-500">${backupList.length}/${MAX_BACKUPS} backups</p>
            </div>
            <button id="createBackupBtn" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
                Create Backup
            </button>
        </div>
        
        <div class="mb-4">
            <input type="text" id="backupNameInput" placeholder="Backup name..." 
                class="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-200 text-sm">
        </div>
        
        <div id="backupList" class="flex-1 overflow-y-auto space-y-2">
    `;
    
    if (backupList.length === 0) {
        html += `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No backups yet</p>
                <p class="text-xs mt-2">Click "Create Backup" to save your first version</p>
            </div>
        `;
    } else {
        backupList.forEach(backup => {
            const date = new Date(backup.timestamp);
            const dateStr = date.toLocaleString();
            const sizeKB = Math.round(backup.size / 1024);
            
            html += `
                <div class="p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <h4 class="font-medium text-gray-800 dark:text-gray-200">${backup.name}</h4>
                            <p class="text-xs text-gray-500 mt-1">${dateStr} • ${sizeKB} KB</p>
                            ${backup.description ? `<p class="text-xs text-gray-600 dark:text-gray-400 mt-1">${backup.description}</p>` : ''}
                        </div>
                        <div class="flex items-center gap-2 ml-4">
                            <button class="restore-backup-btn px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600" data-id="${backup.id}">
                                Restore
                            </button>
                            <button class="delete-backup-btn px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600" data-id="${backup.id}">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    html += `</div>`;
    container.innerHTML = html;
    
    // Event listeners
    const createBtn = container.querySelector('#createBackupBtn');
    createBtn?.addEventListener('click', () => {
        const nameInput = container.querySelector('#backupNameInput');
        const name = nameInput?.value?.trim() || `Backup ${new Date().toLocaleString()}`;
        createBackup(name);
        renderBackupPanel();
    });
    
    container.querySelectorAll('.restore-backup-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await restoreBackup(id);
        });
    });
    
    container.querySelectorAll('.delete-backup-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            deleteBackup(id);
            renderBackupPanel();
        });
    });
}

// Export for window reference
window.ProjectBackupManager = {
    createBackup,
    restoreBackup,
    deleteBackup,
    getBackups,
    renameBackup,
    openBackupManagerPanel
};