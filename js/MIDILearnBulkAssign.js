/**
 * MIDI Learn Bulk Assign - Assign multiple CCs to the same parameter at once
 * 
 * Allows controlling a single parameter with multiple MIDI CCs.
 * Useful for:
 * - Redundant control (e.g., control same param from multiple knobs)
 * - Layered control (e.g., coarse + fine adjustment on same param)
 * - Group control (e.g., multiple CCs affecting master volume)
 */

// Bulk assign state
let bulkAssignActive = false;
let bulkAssignTarget = null;
let bulkAssignCCs = []; // CCs assigned to the same parameter
const MAX_BULK_CCS = 8; // Maximum CCs per parameter

// Initialize Bulk Assign module
export function initBulkAssign() {
    // Listen for MIDI CC events
    document.addEventListener('midi-cc-received', handleBulkAssignCC);
    
    console.log('[MIDI Bulk Assign] Initialized');
}

// Start bulk assign for a parameter
export function startBulkAssign(parameterInfo) {
    bulkAssignActive = true;
    bulkAssignTarget = parameterInfo;
    bulkAssignCCs = [];
    
    // Show visual indicator
    showBulkAssignUI(true);
    
    if (window.appServices?.showNotification) {
        window.appServices.showNotification('Bulk Assign: Turn CC knobs to assign. Click Finish when done.', 4000);
    }
    
    console.log('[MIDI Bulk Assign] Started for:', parameterInfo);
}

// Stop bulk assign
export function stopBulkAssign() {
    if (!bulkAssignActive) return;
    
    bulkAssignActive = false;
    
    // Save bulk mappings
    if (bulkAssignTarget && bulkAssignCCs.length > 0) {
        saveBulkMappings(bulkAssignTarget, bulkAssignCCs);
    }
    
    bulkAssignTarget = null;
    bulkAssignCCs = [];
    
    showBulkAssignUI(false);
    
    console.log('[MIDI Bulk Assign] Stopped');
}

// Handle incoming MIDI CC during bulk assign mode
function handleBulkAssignCC(event) {
    if (!bulkAssignActive || !bulkAssignTarget) return;
    
    const { cc, channel, value } = event.detail;
    const key = `${cc}_channel${channel}`;
    
    // Avoid duplicates
    if (bulkAssignCCs.includes(key)) return;
    
    // Check limit
    if (bulkAssignCCs.length >= MAX_BULK_CCS) {
        if (window.appServices?.showNotification) {
            window.appServices.showNotification(`Max ${MAX_BULK_CCS} CCs per parameter reached`, 2000);
        }
        return;
    }
    
    // Add to list
    bulkAssignCCs.push(key);
    
    // Visual feedback
    flashBulkAssignIndicator(cc, channel);
    
    // Show updated list
    updateBulkAssignList();
    
    console.log(`[MIDI Bulk Assign] Added CC ${cc} ch${channel} -> ${bulkAssignTarget.label}`);
}

// Save bulk mappings to appServices
function saveBulkMappings(targetInfo, ccKeys) {
    // Get existing mappings
    const existingMappings = window.appServices?.getMidiMappings?.() || {};
    
    // Create bulk mapping entry
    const bulkKey = `bulk_${targetInfo.type}_${targetInfo.paramPath}_${Date.now()}`;
    
    existingMappings[bulkKey] = {
        type: targetInfo.type,
        targetId: targetInfo.targetId,
        paramPath: targetInfo.paramPath,
        label: targetInfo.label,
        isBulk: true,
        ccList: ccKeys
    };
    
    // Also register each CC individually for normal MIDI processing
    ccKeys.forEach(key => {
        const [ccPart, channelPart] = key.split('_channel');
        const singleKey = `${ccPart}_channel${channelPart || 1}`;
        existingMappings[singleKey] = {
            type: targetInfo.type,
            targetId: targetInfo.targetId,
            paramPath: targetInfo.paramPath,
            label: targetInfo.label,
            isBulkMember: true,
            bulkKey: bulkKey
        };
    });
    
    // Store in appServices
    if (window.appServices?.setMidiMappings) {
        window.appServices.setMidiMappings(existingMappings);
    }
    
    if (window.appServices?.showNotification) {
        window.appServices.showNotification(`Assigned ${ccKeys.length} CCs to ${targetInfo.label}`, 2000);
    }
}

// Show/hide bulk assign UI
function showBulkAssignUI(active) {
    // Remove existing UI
    const existing = document.getElementById('bulk-assign-panel');
    if (existing) existing.remove();
    
    if (!active) return;
    
    // Create panel
    const panel = document.createElement('div');
    panel.id = 'bulk-assign-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 2px solid #ff6b6b;
        border-radius: 12px;
        padding: 20px;
        z-index: 20000;
        min-width: 300px;
        box-shadow: 0 0 30px rgba(255,107,107,0.3);
        font-family: system-ui, sans-serif;
        color: white;
    `;
    
    panel.innerHTML = `
        <div style="text-align:center; margin-bottom:16px;">
            <div style="font-size:20px; font-weight:bold;">🎛️ Bulk CC Assign</div>
            <div style="color:#888; font-size:13px; margin-top:4px;">${bulkAssignTarget?.label || 'Parameter'}</div>
        </div>
        <div id="bulk-cc-list" style="background:#0a0a15; border-radius:8px; padding:12px; min-height:60px; margin-bottom:12px;">
            <div style="color:#666; text-align:center; font-size:12px;">Turn CC knobs to add them...</div>
        </div>
        <div style="display:flex; gap:8px; justify-content:center;">
            <button id="bulk-assign-finish" style="background:#4ade80; color:#000; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-weight:600;">Finish</button>
            <button id="bulk-assign-cancel" style="background:#444; color:#fff; border:none; padding:8px 20px; border-radius:6px; cursor:pointer;">Cancel</button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Button handlers
    panel.querySelector('#bulk-assign-finish').onclick = () => stopBulkAssign();
    panel.querySelector('#bulk-assign-cancel').onclick = () => {
        bulkAssignCCs = [];
        stopBulkAssign();
    };
}

// Update the CC list display
function updateBulkAssignList() {
    const list = document.getElementById('bulk-cc-list');
    if (!list) return;
    
    if (bulkAssignCCs.length === 0) {
        list.innerHTML = '<div style="color:#666; text-align:center; font-size:12px;">Turn CC knobs to add them...</div>';
    } else {
        list.innerHTML = bulkAssignCCs.map(key => {
            const parts = key.match(/(\d+)_channel(\d+)/);
            const cc = parts ? parts[1] : key;
            const channel = parts ? parts[2] : '1';
            return `<div style="padding:6px 10px; background:#1a1a3a; border-radius:4px; margin:4px 0; display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#4ade80;">●</span>
                <span>CC ${cc}</span>
                <span style="color:#888; font-size:12px;">Ch ${channel}</span>
            </div>`;
        }).join('');
    }
}

// Flash visual indicator when CC is added
function flashBulkAssignIndicator(cc, channel) {
    const panel = document.getElementById('bulk-assign-panel');
    if (!panel) return;
    
    // Flash effect
    panel.style.borderColor = '#4ade80';
    panel.style.boxShadow = '0 0 30px rgba(74,222,128,0.5)';
    
    setTimeout(() => {
        panel.style.borderColor = '#ff6b6b';
        panel.style.boxShadow = '0 0 30px rgba(255,107,107,0.3)';
    }, 300);
}

// Check if bulk assign is currently active
export function isBulkAssignActive() {
    return bulkAssignActive;
}

// Get the list of CCs currently assigned in bulk mode
export function getBulkAssignCCs() {
    return [...bulkAssignCCs];
}

// Clear all bulk mappings for a parameter
export function clearBulkMappings(targetInfo) {
    const existingMappings = window.appServices?.getMidiMappings?.() || {};
    const keysToRemove = [];
    
    for (const [key, mapping] of Object.entries(existingMappings)) {
        if (mapping.type === targetInfo.type && 
            mapping.targetId === targetInfo.targetId && 
            mapping.paramPath === targetInfo.paramPath &&
            mapping.isBulk) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => delete existingMappings[key]);
    
    if (window.appServices?.setMidiMappings) {
        window.appServices.setMidiMappings(existingMappings);
    }
    
    console.log(`[MIDI Bulk Assign] Cleared mappings for ${targetInfo.label}`);
}
