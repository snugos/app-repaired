// js/TransportTimecodeUI.js - Transport Timecode UI Panel
// Creates and manages the transport timecode panel window

import { createTransportTimecodeDisplay, secondsToBarsBeatsTicks, startTransportTimecodeLoop, updateTransportTimecodeFromTransport } from './TransportTimecodeCore.js';

/**
 * Open the transport timecode panel
 */
export function openTransportTimecodePanel() {
    if (typeof localAppServices !== 'undefined' && localAppServices.createWindow) {
        const win = localAppServices.createWindow(
            'transportTimecode',
            'Transport Timecode',
            '<div id="transportTimecodeContent" style="padding: 16px; color: #e5e5e5;"></div>',
            { width: 380, height: 180, x: 400, y: 150 }
        );
        
        if (win) {
            setTimeout(renderTransportTimecodeContent, 50);
        }
    }
}

/**
 * Render the transport timecode panel content
 */
export function renderTransportTimecodeContent() {
    const container = document.getElementById('transportTimecodeContent');
    if (!container) return;
    
    // Get current state
    const bpm = (typeof getTempoState === 'function') ? getTempoState() : 
                (typeof state !== 'undefined' && state.tempo) ? state.tempo : 120;
    const timeSignature = (typeof getTimeSignatureState === 'function') ? getTimeSignatureState() : 
                          (typeof state !== 'undefined' && state.timeSignature) ? state.timeSignature : { numerator: 4, denominator: 4 };
    const beatsPerBar = timeSignature.numerator || 4;
    
    // Create mode selector
    const modeSelector = document.createElement('div');
    modeSelector.style.cssText = 'margin-bottom: 12px; display: flex; gap: 8px; align-items: center;';
    modeSelector.innerHTML = `
        <label style="font-size: 12px; color: #888;">Mode:</label>
        <select id="timecodeModeSelect" style="background: #282828; border: 1px solid #3a3a3a; color: #e5e5e5; padding: 4px 8px; border-radius: 4px;">
            <option value="BBT">Bars:Beats:Ticks</option>
            <option value="SEC">Seconds</option>
            <option value="SMPTE">Timecode</option>
        </select>
        <label style="font-size: 12px; color: #888; margin-left: 8px;">BPM:</label>
        <input type="number" id="timecodeBpmInput" value="${bpm}" min="20" max="999" step="1"
               style="width: 60px; background: #282828; border: 1px solid #3a3a3a; color: #e5e5e5; padding: 4px; border-radius: 4px; text-align: center;">
    `;
    
    // Create display area
    const displayArea = document.createElement('div');
    displayArea.id = 'timecodeDisplayArea';
    displayArea.style.cssText = `
        background: #111;
        border: 1px solid #333;
        border-radius: 6px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    
    // Create the timecode display
    createTransportTimecodeDisplay(displayArea);
    
    // Info row
    const infoRow = document.createElement('div');
    infoRow.style.cssText = 'font-size: 11px; color: #666; display: flex; justify-content: space-between;';
    infoRow.innerHTML = `
        <span id="timecodeBpmDisplay">${bpm} BPM</span>
        <span id="timecodeSigDisplay">${beatsPerBar}/4</span>
        <span id="timecodePositionDisplay">--:--</span>
    `;
    
    container.appendChild(modeSelector);
    container.appendChild(displayArea);
    container.appendChild(infoRow);
    
    // Setup event listeners
    const modeSelect = document.getElementById('timecodeModeSelect');
    const bpmInput = document.getElementById('timecodeBpmInput');
    
    let currentMode = 'BBT';
    let loopInterval = null;
    
    modeSelect.addEventListener('change', (e) => {
        currentMode = e.target.value;
    });
    
    bpmInput.addEventListener('change', (e) => {
        const newBpm = parseFloat(e.target.value) || 120;
        const bpmDisplay = document.getElementById('timecodeBpmDisplay');
        if (bpmDisplay) bpmDisplay.textContent = `${newBpm} BPM`;
        // Restart loop with new BPM
        if (loopInterval) clearInterval(loopInterval);
        loopInterval = startTransportTimecodeLoop(
            () => typeof Tone !== 'undefined' ? Tone.Transport.seconds : 0,
            newBpm,
            beatsPerBar,
            currentMode
        );
    });
    
    // Start the update loop
    loopInterval = startTransportTimecodeLoop(
        () => typeof Tone !== 'undefined' ? Tone.Transport.seconds : 0,
        bpm,
        beatsPerBar,
        currentMode
    );
    
    // Update position display
    const updatePosition = () => {
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            const pos = Tone.Transport.position;
            const posDisplay = document.getElementById('timecodePositionDisplay');
            if (posDisplay) {
                posDisplay.textContent = typeof pos === 'string' ? pos : `${Tone.Transport.seconds.toFixed(2)}s`;
            }
        }
    };
    setInterval(updatePosition, 100);
}

/**
 * Update the transport timecode display from external source
 * @param {number} seconds - Current position in seconds
 */
export function updateTransportTimecodeDisplay(seconds) {
    const timeData = secondsToBarsBeatsTicks(seconds);
    updateTransportTimecodeFromTransport(timeData, 'BBT');
}
