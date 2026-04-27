/**
 * MIDILearnWizard.js - Step-by-step guided MIDI mapping for any knob/slider
 * Allows users to map MIDI CC messages to DAW parameters
 */

let localAppServices = {};
let isLearnModeActive = false;
let learnTargetParam = null;
let learnTargetTrackId = null;
let learnTimeout = null;
const LEARN_TIMEOUT_MS = 10000; // 10 seconds to map a CC

// Store MIDI mappings: { paramId: { cc, channel, min, max, trackId } }
let midiMappings = {};

// MIDI state access
let midiAccess = null;
let activeMIDIInput = null;

export function initMIDILearnWizard(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    loadMidiMappings();
    console.log('[MIDILearnWizard] Initialized with', Object.keys(midiMappings).length, 'saved mappings');
}

function loadMidiMappings() {
    try {
        const saved = localStorage.getItem('snawMidiMappings');
        if (saved) {
            midiMappings = JSON.parse(saved);
        }
    } catch (e) {
        console.warn('[MIDILearnWizard] Failed to load MIDI mappings:', e);
        midiMappings = {};
    }
}

function saveMidiMappings() {
    try {
        localStorage.setItem('snawMidiMappings', JSON.stringify(midiMappings));
    } catch (e) {
        console.warn('[MIDILearnWizard] Failed to save MIDI mappings:', e);
    }
}

function getMidiAccess() {
    if (!midiAccess && navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({ sysex: false }).then(access => {
            midiAccess = access;
            setupMIDIInputListener();
        }).catch(err => {
            console.warn('[MIDILearnWizard] MIDI access denied:', err);
        });
    }
    return midiAccess;
}

function setupMIDIInputListener() {
    if (!midiAccess) return;
    
    midiAccess.inputs.forEach(input => {
        input.onmidimessage = handleMIDIMessage;
    });
    
    midiAccess.onstatechange = () => {
        midiAccess.inputs.forEach(input => {
            input.onmidimessage = handleMIDIMessage;
        });
    };
}

function handleMIDIMessage(event) {
    if (!event.data || event.data.length < 3) return;
    
    const [status, data1, data2] = event.data;
    const channel = (status & 0x0F) + 1;
    const type = status & 0xF0;
    
    // Only handle CC messages
    if (type !== 0xB0) return;
    
    const cc = data1;
    const value = data2 / 127; // Normalize 0-127 to 0-1
    
    // Check if we're in learn mode
    if (isLearnModeActive && learnTargetParam) {
        // Capture this CC for the learn target
        captureCCMapping(cc, channel, value);
    }
    
    // Apply any mappings for this CC
    applyMidiMapping(cc, channel, value);
}

function captureCCMapping(cc, channel, value) {
    const mappingKey = `${learnTargetTrackId || 'global'}:${learnTargetParam}`;
    
    midiMappings[mappingKey] = {
        cc: cc,
        channel: channel,
        min: 0,
        max: 1,
        trackId: learnTargetTrackId,
        param: learnTargetParam,
        value: value
    };
    
    saveMidiMappings();
    cancelLearnMode();
    
    const targetName = learnTargetParam.replace(/([A-Z])/g, ' $1').trim();
    localAppServices.showNotification?.(`Mapped ${learnTargetParam} to CC${cc} Ch${channel}`, 2000);
    
    // Update UI if open
    updateWizardUI?.();
}

function applyMidiMapping(cc, channel, value) {
    // Find any mappings that match this CC
    for (const [key, mapping] of Object.entries(midiMappings)) {
        if (mapping.cc === cc) {
            applyMappedValue(mapping, value);
        }
    }
}

function applyMappedValue(mapping, normalizedValue) {
    // Apply the mapped value to the appropriate parameter
    const { param, trackId } = mapping;
    
    if (trackId) {
        const track = localAppServices.getTrackById?.(trackId);
        if (track) {
            // Volume
            if (param === 'volume') {
                const vol = normalizedValue;
                if (track.setVolume) track.setVolume(vol);
                if (localAppServices.updateTrackVolumeUI) localAppServices.updateTrackVolumeUI(trackId, vol);
            }
            // Pan
            else if (param === 'pan') {
                const pan = (normalizedValue * 2) - 1; // Convert 0-1 to -1 to 1
                if (track.setPan) track.setPan(pan);
                if (localAppServices.updateTrackPanUI) localAppServices.updateTrackPanUI(trackId, pan);
            }
            // Send levels
            else if (param.startsWith('send_')) {
                const sendIndex = parseInt(param.split('_')[1]);
                if (track.setSendLevel) track.setSendLevel(sendIndex, normalizedValue);
            }
        }
    } else {
        // Global parameters
        if (param === 'masterVolume') {
            if (localAppServices.setMasterVolume) localAppServices.setMasterVolume(normalizedValue);
        }
        else if (param === 'tempo') {
            const tempo = 60 + (normalizedValue * 180); // 60-240 BPM
            if (localAppServices.setTempo) localAppServices.setTempo(tempo);
        }
    }
}

// --- Learn Mode Control ---

export function startLearnMode(paramName, trackId = null) {
    isLearnModeActive = true;
    learnTargetParam = paramName;
    learnTargetTrackId = trackId;
    
    // Ensure MIDI access is initialized
    getMidiAccess();
    
    // Set timeout
    if (learnTimeout) clearTimeout(learnTimeout);
    learnTimeout = setTimeout(() => {
        cancelLearnMode();
        localAppServices.showNotification?.('MIDI Learn timed out. Move a knob on your controller.', 2000);
    }, LEARN_TIMEOUT_MS);
    
    // Flash the learn indicator
    flashLearnIndicator(true);
    
    console.log('[MIDILearnWizard] Started learn mode for:', paramName, 'track:', trackId);
}

export function cancelLearnMode() {
    isLearnModeActive = false;
    learnTargetParam = null;
    learnTargetTrackId = null;
    if (learnTimeout) {
        clearTimeout(learnTimeout);
        learnTimeout = null;
    }
    flashLearnIndicator(false);
}

function flashLearnIndicator(active) {
    const indicator = document.getElementById('midi-learn-indicator');
    if (indicator) {
        indicator.style.opacity = active ? '1' : '0';
        if (active) {
            indicator.classList.add('animate-pulse');
        } else {
            indicator.classList.remove('animate-pulse');
        }
    }
}

// --- UI Panel ---

let wizardWindow = null;
let updateWizardUI = null;

export function openMIDILearnWizard() {
    // Check if already open
    const existing = document.getElementById('midi-learn-wizard-panel');
    if (existing) {
        existing.remove();
        return;
    }
    
    createWizardPanel();
}

function createWizardPanel() {
    const panel = document.createElement('div');
    panel.id = 'midi-learn-wizard-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 480px;
        max-height: 80vh;
        background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
        border: 1px solid #4a4a6a;
        border-radius: 12px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #e0e0e0;
        overflow: hidden;
        box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    `;
    
    panel.innerHTML = `
        <div style="padding: 20px 24px; background: linear-gradient(135deg, #2a2a4e, #3a2a5e); border-bottom: 1px solid #4a4a6a; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-size: 16px; font-weight: 600; color: #a78bfa;">🎹 MIDI Learn Wizard</div>
                <div style="font-size: 11px; color: #888; margin-top: 4px;">Map any knob to a parameter</div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span id="midi-learn-indicator" style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444; opacity: 0; transition: opacity 0.2s;"></span>
                <button id="wizard-close" style="background: #555; border: none; border-radius: 4px; color: white; padding: 6px 12px; font-size: 12px; cursor: pointer;">✕</button>
            </div>
        </div>
        
        <div id="wizard-content" style="padding: 20px 24px; max-height: 60vh; overflow-y: auto;">
            <!-- Learn Status -->
            <div id="learn-status" style="display: none; padding: 16px; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 8px; margin-bottom: 16px; text-align: center;">
                <div style="font-size: 14px; color: #ef4444; font-weight: 600;">👆 MOVE A KNOB NOW</div>
                <div style="font-size: 12px; color: #aaa; margin-top: 6px;">Waiting for MIDI CC input... <span id="learn-countdown">10</span>s</div>
            </div>
            
            <!-- Step 1: Select Target -->
            <div style="margin-bottom: 20px;">
                <div style="font-size: 13px; font-weight: 600; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Step 1: Select Parameter</div>
                
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 6px;">Track</label>
                    <select id="wizard-track-select" style="width: 100%; padding: 10px; background: #1a1a2e; border: 1px solid #444; border-radius: 6px; color: #e0e0e0; font-size: 13px;">
                        <option value="">-- Select Track --</option>
                    </select>
                </div>
                
                <div>
                    <label style="font-size: 12px; color: #aaa; display: block; margin-bottom: 6px;">Parameter</label>
                    <select id="wizard-param-select" style="width: 100%; padding: 10px; background: #1a1a2e; border: 1px solid #444; border-radius: 6px; color: #e0e0e0; font-size: 13px;">
                        <option value="">-- Select Parameter --</option>
                    </select>
                </div>
                
                <div id="global-params" style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">
                    <button class="param-btn" data-param="masterVolume" style="padding: 8px 14px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #ccc; font-size: 12px; cursor: pointer;">Master Volume</button>
                    <button class="param-btn" data-param="tempo" style="padding: 8px 14px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #ccc; font-size: 12px; cursor: pointer;">Tempo</button>
                    <button class="param-btn" data-param="loopStart" style="padding: 8px 14px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #ccc; font-size: 12px; cursor: pointer;">Loop Start</button>
                    <button class="param-btn" data-param="loopEnd" style="padding: 8px 14px; background: #2a2a4e; border: 1px solid #4a4a6a; border-radius: 6px; color: #ccc; font-size: 12px; cursor: pointer;">Loop End</button>
                </div>
            </div>
            
            <!-- Step 2: Learn -->
            <div style="margin-bottom: 20px;">
                <div style="font-size: 13px; font-weight: 600; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Step 2: Assign MIDI</div>
                <button id="btn-start-learn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #7c3aed, #5b21b6); border: none; border-radius: 8px; color: white; font-size: 14px; font-weight: 600; cursor: pointer;">🎯 Start Learning</button>
            </div>
            
            <!-- Current Mappings -->
            <div>
                <div style="font-size: 13px; font-weight: 600; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Active Mappings (${Object.keys(midiMappings).length})</div>
                <div id="mappings-list" style="max-height: 200px; overflow-y: auto;">
                    ${renderMappingsList()}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Close button
    panel.querySelector('#wizard-close').onclick = () => panel.remove();
    
    // Populate track select
    const trackSelect = panel.querySelector('#wizard-track-select');
    const tracks = localAppServices.getTracks?.() || [];
    tracks.forEach(track => {
        const opt = document.createElement('option');
        opt.value = track.id;
        opt.textContent = track.name;
        trackSelect.appendChild(opt);
    });
    
    // Track select change -> update param select
    trackSelect.onchange = () => {
        const trackId = parseInt(trackSelect.value);
        const track = tracks.find(t => t.id === trackId);
        const paramSelect = panel.querySelector('#wizard-param-select');
        paramSelect.innerHTML = '<option value="">-- Select Parameter --</option>';
        
        if (track) {
            const params = [
                { value: 'volume', label: 'Volume' },
                { value: 'pan', label: 'Pan' }
            ];
            // Add sends if track has them
            if (track.sends && track.sends.length > 0) {
                track.sends.forEach((send, i) => {
                    params.push({ value: `send_${i}`, label: `Send ${i + 1} (${send.name || 'Send'})` });
                });
            }
            params.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.value;
                opt.textContent = p.label;
                paramSelect.appendChild(opt);
            });
        }
    };
    
    // Global param buttons
    panel.querySelectorAll('.param-btn').forEach(btn => {
        btn.onclick = () => {
            const param = btn.dataset.param;
            startLearnMode(param, null);
            showLearnStatus(panel);
        };
    });
    
    // Start learn button
    panel.querySelector('#btn-start-learn').onclick = () => {
        const trackId = trackSelect.value ? parseInt(trackSelect.value) : null;
        const param = panel.querySelector('#wizard-param-select').value;
        
        if (!param && !trackId) {
            localAppServices.showNotification?.('Please select a track and parameter first', 2000);
            return;
        }
        
        startLearnMode(param, trackId);
        showLearnStatus(panel);
    };
    
    updateWizardUI = () => {
        const list = document.getElementById('mappings-list');
        if (list) {
            list.innerHTML = renderMappingsList();
        }
    };
}

function showLearnStatus(panel) {
    const status = panel.querySelector('#learn-status');
    if (status) {
        status.style.display = 'block';
        
        // Countdown timer
        let seconds = 10;
        const countdown = panel.querySelector('#learn-countdown');
        const interval = setInterval(() => {
            seconds--;
            if (countdown) countdown.textContent = seconds;
            if (seconds <= 0) {
                clearInterval(interval);
                cancelLearnMode();
                status.style.display = 'none';
            }
        }, 1000);
    }
}

function renderMappingsList() {
    if (Object.keys(midiMappings).length === 0) {
        return '<div style="text-align: center; color: #666; padding: 20px;">No MIDI mappings yet</div>';
    }
    
    return Object.entries(midiMappings).map(([key, mapping]) => {
        const trackName = mapping.trackId ? `Track ${mapping.trackId}` : 'Global';
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #1a1a2e; border-radius: 6px; margin-bottom: 6px;">
                <div>
                    <div style="font-size: 13px; color: #e0e0e0; font-weight: 500;">${mapping.param}</div>
                    <div style="font-size: 11px; color: #888;">${trackName}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 12px; color: #a78bfa;">CC${mapping.cc} Ch${mapping.channel}</span>
                    <button class="remove-mapping-btn" data-key="${key}" style="background: #ef4444; border: none; border-radius: 4px; color: white; padding: 4px 8px; font-size: 11px; cursor: pointer;">✕</button>
                </div>
            </div>
        `;
    }).join('');
}

// --- Public API ---

export function getMidiMappings() {
    return { ...midiMappings };
}

export function clearAllMidiMappings() {
    midiMappings = {};
    saveMidiMappings();
    localAppServices.showNotification?.('All MIDI mappings cleared', 1500);
    updateWizardUI?.();
}

export function removeMidiMapping(key) {
    if (midiMappings[key]) {
        delete midiMappings[key];
        saveMidiMappings();
        updateWizardUI?.();
    }
}

export function isInLearnMode() {
    return isLearnModeActive;
}

export function getLearnTarget() {
    return isLearnModeActive ? learnTargetParam : null;
}

// Make globally accessible for MIDI event handling
window.MIDILearnWizard = {
    startLearnMode,
    cancelLearnMode,
    isInLearnMode,
    getLearnTarget,
    openMIDILearnWizard,
    getMidiMappings,
    clearAllMidiMappings,
    removeMidiMapping
};