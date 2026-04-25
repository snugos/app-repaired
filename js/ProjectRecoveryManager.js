// js/ProjectRecoveryManager.js - Project Crash Recovery & Backup Manager
// Monitors project state and provides automatic recovery from crashes

import { getProjectState, storeProjectState } from './db.js';

let recoveryManager = {
    autoSaveInterval: null,
    lastAutoSaveTime: null,
    backupVersions: [],
    maxBackups: 10,
    isEnabled: true,
    autoSaveDelayMs: 30000, // 30 seconds
    crashRecoveryEnabled: true
};

export function initProjectRecoveryManager(appServices) {
    console.log('[RecoveryManager] Initializing project recovery manager...');
    
    // Start auto-save loop
    startAutoSave(appServices);
    
    // Check for crash recovery on startup
    checkForCrashRecovery(appServices);
    
    // Listen for beforeunload to attempt final save
    window.addEventListener('beforeunload', () => {
        if (appServices?.gatherProjectData) {
            attemptFinalSave(appServices);
        }
    });
    
    console.log('[RecoveryManager] Recovery manager initialized');
}

function startAutoSave(appServices) {
    if (recoveryManager.autoSaveInterval) {
        clearInterval(recoveryManager.autoSaveInterval);
    }
    
    recoveryManager.autoSaveInterval = setInterval(() => {
        if (!recoveryManager.isEnabled) return;
        
        try {
            if (appServices?.gatherProjectData) {
                const projectData = appServices.gatherProjectData();
                if (projectData) {
                    const timestamp = Date.now();
                    storeProjectState('autosave', projectData).then(() => {
                        recoveryManager.lastAutoSaveTime = timestamp;
                        console.log(`[RecoveryManager] Auto-save completed at ${new Date(timestamp).toLocaleTimeString()}`);
                    }).catch(err => {
                        console.warn('[RecoveryManager] Auto-save failed:', err);
                    });
                }
            }
        } catch (error) {
            console.warn('[RecoveryManager] Auto-save error:', error);
        }
    }, recoveryManager.autoSaveDelayMs);
}

async function checkForCrashRecovery(appServices) {
    if (!recoveryManager.crashRecoveryEnabled) return;
    
    try {
        const lastSession = localStorage.getItem('snugosLastSession');
        const lastSessionTime = lastSession ? parseInt(lastSession, 10) : 0;
        const now = Date.now();
        
        // If last session was less than 5 minutes ago, consider crash recovery
        const sessionGap = now - lastSessionTime;
        const CRASH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        
        if (sessionGap < CRASH_THRESHOLD && sessionGap > 0) {
            console.log('[RecoveryManager] Possible crash detected - checking for recovery data...');
            
            // Try to load auto-saved state
            const savedState = await getProjectState('autosave');
            if (savedState) {
                // Show recovery dialog
                if (appServices?.showConfirmationDialog) {
                    const confirmed = await appServices.showConfirmationDialog(
                        'Crash Recovery Available',
                        'A project auto-save was found from your last session. Would you like to recover it?',
                        'Recover Project',
                        'Start Fresh'
                    );
                    
                    if (confirmed) {
                        if (appServices?.reconstructDAW) {
                            await appServices.reconstructDAW(savedState, false);
                            appServices.showNotification?.('Project recovered from auto-save', 3000);
                            console.log('[RecoveryManager] Project recovered successfully');
                        }
                    } else {
                        // Clear the auto-save
                        localStorage.removeItem('snugosProject_autosave');
                        console.log('[RecoveryManager] Auto-save cleared, starting fresh');
                    }
                }
            }
        }
        
        // Update last session time
        localStorage.setItem('snugosLastSession', now.toString());
    } catch (error) {
        console.warn('[RecoveryManager] Crash recovery check failed:', error);
    }
}

async function attemptFinalSave(appServices) {
    try {
        if (appServices?.gatherProjectData) {
            const projectData = appServices.gatherProjectData();
            if (projectData) {
                await storeProjectState('emergency_backup', projectData);
                console.log('[RecoveryManager] Emergency backup saved');
            }
        }
    } catch (error) {
        console.warn('[RecoveryManager] Final save attempt failed:', error);
    }
}

export function createManualBackup(appServices, name) {
    try {
        const projectData = appServices?.gatherProjectData?.();
        if (!projectData) {
            console.warn('[RecoveryManager] No project data to backup');
            return false;
        }
        
        const backupName = name || `backup_${Date.now()}`;
        const backupData = {
            ...projectData,
            backupName: backupName,
            backupTimestamp: Date.now()
        };
        
        // Store as named backup
        storeProjectState(`backup_${backupName}`, backupData);
        
        // Add to backup list
        recoveryManager.backupVersions.push({
            name: backupName,
            timestamp: Date.now()
        });
        
        // Trim old backups
        while (recoveryManager.backupVersions.length > recoveryManager.maxBackups) {
            const oldest = recoveryManager.backupVersions.shift();
            localStorage.removeItem(`snugosProject_backup_${oldest.name}`);
        }
        
        console.log(`[RecoveryManager] Manual backup created: ${backupName}`);
        return true;
    } catch (error) {
        console.error('[RecoveryManager] Manual backup failed:', error);
        return false;
    }
}

export function listBackups() {
    return [...recoveryManager.backupVersions];
}

export async function restoreBackup(backupName, appServices) {
    try {
        const backupData = await getProjectState(`backup_${backupName}`);
        if (!backupData) {
            console.warn(`[RecoveryManager] Backup not found: ${backupName}`);
            return false;
        }
        
        if (appServices?.reconstructDAW) {
            await appServices.reconstructDAW(backupData, false);
            console.log(`[RecoveryManager] Restored backup: ${backupName}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('[RecoveryManager] Backup restoration failed:', error);
        return false;
    }
}

export function setRecoveryEnabled(enabled) {
    recoveryManager.isEnabled = !!enabled;
    console.log(`[RecoveryManager] ${recoveryManager.isEnabled ? 'Enabled' : 'Disabled'}`);
}

export function setAutoSaveDelay(ms) {
    recoveryManager.autoSaveDelayMs = Math.max(5000, ms);
    console.log(`[RecoveryManager] Auto-save delay set to ${recoveryManager.autoSaveDelayMs}ms`);
}

export function getRecoveryStatus() {
    return {
        isEnabled: recoveryManager.isEnabled,
        lastAutoSaveTime: recoveryManager.lastAutoSaveTime,
        backupCount: recoveryManager.backupVersions.length,
        autoSaveDelayMs: recoveryManager.autoSaveDelayMs
    };
}