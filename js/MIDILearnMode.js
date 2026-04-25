/**
 * MIDI Learn Mode - Right-click any control to assign MIDI CC
 * 
 * Features:
 * - Right-click on volume sliders, pan knobs, effect parameters to assign MIDI CC
 * - Visual indicator when in learn mode
 * - Mappings saved and restored with project
 * - Real-time MIDI CC feedback
 */

let midiLearnModeActive = false;
let midiLearnTargetElement = null;
let midiLearnTargetInfo = null;

// Elements that support MIDI learn
const learnableElements = new Map();

// Initialize MIDI Learn Mode
export function initMIDILearnMode() {
    // Find all learnable elements (sliders, knobs, range inputs)
    scanForLearnableElements();
    
    // Listen for right-click on learnable elements
    document.addEventListener('contextmenu', handleMidiLearnContextMenu);
    
    console.log('[MIDI Learn] Initialized');
}

// Scan page for learnable elements (volume sliders, pan knobs, etc.)
function scanForLearnableElements() {
    learnableElements.clear();
    
    // Find all range inputs (sliders)
    document.querySelectorAll('input[type="range"]').forEach(el => {
        const info = getElementLearnInfo(el);
        if (info) {
            learnableElements.set(el, info);
            el.style.cursor = 'crosshair';
        }
    });
    
    // Find knobs (elements with class containing 'knob')
    document.querySelectorAll('.knob, [class*="knob"]').forEach(el => {
        const info = getElementLearnInfo(el);
        if (info) {
            learnableElements.set(el, info);
            el.style.cursor = 'crosshair';
        }
    });
}

// Get information about what a slider/knob controls
function getElementLearnInfo(element) {
    // Try to determine what this element controls
    const classes = element.className || '';
    const id = element.id || '';
    const parent = element.closest('[data-track-id], [data-effect-id], .track, .effect');
    
    // Check if it's a volume slider
    if (classes.includes('volume') || classes.includes('Volume') || id.includes('volume')) {
        if (parent && parent.dataset.trackId) {
            return {
                type: 'track',
                targetId: parseInt(parent.dataset.trackId),
                paramPath: 'volume',
                label: `Track ${parent.dataset.trackId} Volume`
            };
        }
        if (parent && parent.dataset.effectId) {
            return {
                type: 'effect',
                targetId: parseInt(parent.dataset.effectId),
                paramPath: 'volume',
                label: `Effect Volume`
            };
        }
        return {
            type: 'master',
            targetId: null,
            paramPath: 'volume',
            label: 'Master Volume'
        };
    }
    
    // Check if it's a pan slider
    if (classes.includes('pan') || classes.includes('Pan') || id.includes('pan')) {
        if (parent && parent.dataset.trackId) {
            return {
                type: 'track',
                targetId: parseInt(parent.dataset.trackId),
                paramPath: 'pan',
                label: `Track ${parent.dataset.trackId} Pan`
            };
        }
        return {
            type: 'master',
            targetId: null,
            paramPath: 'pan',
            label: 'Master Pan'
        };
    }
    
    // Check if it's a send level
    if (classes.includes('send') || id.includes('send')) {
        return {
            type: 'send',
            targetId: null,
            paramPath: 'level',
            label: 'Send Level'
        };
    }
    
    // Check if it's an effect parameter
    if (parent && parent.dataset.effectId) {
        // Get the parameter name from the element
        const paramName = getParamNameFromElement(element);
        return {
            type: 'effect',
            targetId: parseInt(parent.dataset.effectId),
            paramPath: paramName,
            label: `Effect ${paramName}`
        };
    }
    
    // Generic slider - make it learnable
    if (element.tagName === 'INPUT' && element.type === 'range') {
        // Check parent for context
        if (parent && parent.dataset.trackId) {
            return {
                type: 'track',
                targetId: parseInt(parent.dataset.trackId),
                paramPath: 'generic',
                label: `Track ${parent.dataset.trackId} Parameter`
            };
        }
        return {
            type: 'generic',
            targetId: null,
            paramPath: 'value',
            label: 'Generic Parameter'
        };
    }
    
    return null;
}

// Get parameter name from surrounding elements
function getParamNameFromElement(element) {
    // Look for label
    const label = element.closest('.control, .param, .slider-group')?.querySelector('label, .label, .param-name');
    if (label) {
        return label.textContent?.trim() || 'unknown';
    }
    
    // Try title attribute
    if (element.title) {
        return element.title;
    }
    
    // Use ID or class as fallback
    const id = element.id || '';
    const className = element.className || '';
    
    if (id) return id;
    if (className) return className.split(' ')[0];
    
    return 'unknown';
}

// Handle right-click context menu for MIDI learn
function handleMidiLearnContextMenu(e) {
    // Find if clicked on a learnable element
    const target = e.target.closest('input[type="range"], .knob, [class*="knob"]');
    
    if (!target) return;
    
    const info = learnableElements.get(target) || getElementLearnInfo(target);
    if (!info) return;
    
    e.preventDefault();
    
    // Show MIDI learn context menu
    showMidiLearnMenu(e.clientX, e.clientY, target, info);
}

// Show context menu for MIDI learn options
function showMidiLearnMenu(x, y, element, info) {
    // Remove existing menu
    const existingMenu = document.getElementById('midi-learn-context-menu');
    if (existingMenu) existingMenu.remove();
    
    // Check if this element already has a mapping
    const existingMapping = getExistingMapping(info);
    
    const menu = document.createElement('div');
    menu.id = 'midi-learn-context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 6px;
        padding: 8px 0;
        z-index: 20000;
        min-width: 200px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 8px 12px;
        border-bottom: 1px solid #333;
        color: #888;
        font-size: 11px;
    `;
    header.textContent = info.label || 'MIDI Learn';
    menu.appendChild(header);
    
    // Learn option
    const learnItem = document.createElement('div');
    learnItem.className = 'midi-learn-menu-item';
    learnItem.innerHTML = midiLearnModeActive 
        ? '<span style="color: #ff6b6b;">● Cancel Learn Mode</span>'
        : '<span>🎓 Assign MIDI CC...</span>';
    learnItem.style.cssText = `
        padding: 10px 16px;
        cursor: pointer;
        color: #ddd;
        font-size: 13px;
    `;
    learnItem.addEventListener('mouseenter', () => learnItem.style.background = '#2a2a4a');
    learnItem.addEventListener('mouseleave', () => learnItem.style.background = 'transparent');
    learnItem.addEventListener('click', () => {
        if (midiLearnModeActive) {
            cancelMidiLearn();
        } else {
            startMidiLearn(element, info);
        }
        menu.remove();
    });
    menu.appendChild(learnItem);
    
    // Existing mapping option
    if (existingMapping) {
        const removeItem = document.createElement('div');
        removeItem.innerHTML = `<span style="color: #888;">✕ Remove: CC ${existingMapping.cc}</span>`;
        removeItem.style.cssText = `
            padding: 10px 16px;
            cursor: pointer;
            color: #ddd;
            font-size: 13px;
        `;
        removeItem.addEventListener('mouseenter', () => removeItem.style.background = '#2a2a4a');
        removeItem.addEventListener('mouseleave', () => removeItem.style.background = 'transparent');
        removeItem.addEventListener('click', () => {
            removeMapping(info);
            menu.remove();
        });
        menu.appendChild(removeItem);
    }
    
    // Show all mappings for this type
    const mappings = getMappingsForType(info.type, info.targetId);
    if (mappings.length > 0) {
        const divider = document.createElement('div');
        divider.style.cssText = 'border-top: 1px solid #333; margin: 8px 0;';
        menu.appendChild(divider);
        
        const title = document.createElement('div');
        title.style.cssText = 'padding: 6px 16px; color: #666; font-size: 11px;';
        title.textContent = 'Assigned CCs:';
        menu.appendChild(title);
        
        mappings.forEach(m => {
            const item = document.createElement('div');
            item.style.cssText = 'padding: 6px 16px; color: #888; font-size: 12px;';
            item.textContent = `CC ${m.cc} → ${m.paramPath}`;
            menu.appendChild(item);
        });
    }
    
    document.body.appendChild(menu);
    
    // Close on outside click
    setTimeout(() => {
        const handler = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', handler);
            }
        };
        document.addEventListener('click', handler);
    }, 10);
}

// Get existing mapping for an element
function getExistingMapping(info) {
    const mappings = window.appServices?.getMidiMappings?.() || {};
    for (const [key, mapping] of Object.entries(mappings)) {
        if (mapping.type === info.type && 
            mapping.targetId === info.targetId && 
            mapping.paramPath === info.paramPath) {
            return { key, ...mapping };
        }
    }
    return null;
}

// Get all mappings for a specific type/target
function getMappingsForType(type, targetId) {
    const mappings = window.appServices?.getMidiMappings?.() || {};
    const result = [];
    for (const [key, mapping] of Object.entries(mappings)) {
        if (mapping.type === type && mapping.targetId === targetId) {
            const [cc] = key.split('_channel');
            result.push({ cc, ...mapping });
        }
    }
    return result;
}

// Start MIDI learn mode for an element
function startMidiLearn(element, info) {
    midiLearnModeActive = true;
    midiLearnTargetElement = element;
    midiLearnTargetInfo = info;
    
    // Visual feedback on the element
    element.style.boxShadow = '0 0 0 2px #ff6b6b';
    element.style.transition = 'box-shadow 0.2s';
    
    // Show notification
    if (window.appServices?.showNotification) {
        window.appServices.showNotification('MIDI Learn: Move a CC knob on your controller', 3000);
    }
    
    // Update UI
    updateLearnModeUI(true);
    
    console.log('[MIDI Learn] Started for:', info);
}

// Cancel MIDI learn mode
function cancelMidiLearn() {
    if (midiLearnTargetElement) {
        midiLearnTargetElement.style.boxShadow = '';
    }
    
    midiLearnModeActive = false;
    midiLearnTargetElement = null;
    midiLearnTargetInfo = null;
    
    updateLearnModeUI(false);
    
    console.log('[MIDI Learn] Cancelled');
}

// Complete MIDI learn with a CC value
export function completeMidiLearn(ccNumber, channel) {
    if (!midiLearnModeActive || !midiLearnTargetInfo) {
        return false;
    }
    
    const info = midiLearnTargetInfo;
    
    // Add the mapping via appServices
    if (window.appServices?.addMidiMapping) {
        window.appServices.addMidiMapping(ccNumber, channel, info);
    }
    
    // Visual feedback
    if (midiLearnTargetElement) {
        midiLearnTargetElement.style.boxShadow = '0 0 0 2px #4ade80';
        setTimeout(() => {
            if (midiLearnTargetElement) {
                midiLearnTargetElement.style.boxShadow = '';
            }
        }, 1000);
    }
    
    // Clean up
    midiLearnModeActive = false;
    midiLearnTargetElement = null;
    const completedInfo = info;
    midiLearnTargetInfo = null;
    
    // Show success notification
    if (window.appServices?.showNotification) {
        window.appServices.showNotification(`MIDI Learn: CC ${ccNumber} → ${completedInfo.label}`, 2000);
    }
    
    console.log('[MIDI Learn] Completed: CC', ccNumber, '->', completedInfo);
    
    return true;
}

// Remove mapping for an element
function removeMapping(info) {
    const mapping = getExistingMapping(info);
    if (mapping && window.appServices?.removeMidiMapping) {
        window.appServices.removeMidiMapping(mapping.key);
        if (window.appServices?.showNotification) {
            window.appServices.showNotification(`Removed MIDI mapping for ${info.label}`, 2000);
        }
    }
}

// Update UI to reflect learn mode state
function updateLearnModeUI(active) {
    // Update the Learn button in header
    const learnBtn = document.getElementById('midiLearnBtnGlobal');
    if (learnBtn) {
        if (active) {
            learnBtn.classList.add('playing');
            learnBtn.textContent = 'Learning...';
        } else {
            learnBtn.classList.remove('playing');
            learnBtn.textContent = 'Learn';
        }
    }
    
    // Update visual state on all learnable elements
    learnableElements.forEach((info, el) => {
        if (active && midiLearnTargetElement !== el) {
            el.style.opacity = '0.7';
        } else {
            el.style.opacity = '1';
        }
    });
}

// Handle incoming MIDI CC messages
export function handleMidiCCMessage(ccNumber, channel, value) {
    if (!midiLearnModeActive) {
        return false;
    }
    
    // In learn mode, capture the first CC message
    completeMidiLearn(ccNumber, channel);
    return true;
}

// Export functions for external use
export function isMidiLearnActive() {
    return midiLearnModeActive;
}

export function getMidiLearnTarget() {
    return midiLearnTargetInfo;
}

export function refreshLearnableElements() {
    scanForLearnableElements();
}