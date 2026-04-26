// js/TransportTimecodeCore.js - Transport Timecode Display Core Logic
// Creates and updates the transport timecode display

/**
 * Convert seconds to bars:beats:ticks format
 * @param {number} seconds - Time in seconds
 * @param {number} bpm - Beats per minute
 * @param {number} beatsPerBar - Beats per bar (time signature numerator)
 * @param {number} ticksPerBeat - Ticks per beat (default: 480)
 * @returns {Object} Object with bars, beats, ticks, and seconds
 */
export function secondsToBarsBeatsTicks(seconds, bpm = 120, beatsPerBar = 4, ticksPerBeat = 480) {
    const secondsPerBeat = 60 / bpm;
    const totalTicks = seconds / secondsPerBeat * ticksPerBeat;
    const ticksPerBar = ticksPerBeat * beatsPerBar;
    
    const bars = Math.floor(totalTicks / ticksPerBar) + 1;
    const remainingTicks = totalTicks % ticksPerBar;
    const beats = Math.floor(remainingTicks / ticksPerBeat) + 1;
    const ticks = Math.floor(remainingTicks % ticksPerBeat);
    
    return {
        bars,
        beats,
        ticks: Math.round(ticks),
        seconds: seconds % 60,
        minutes: Math.floor(seconds / 60),
        totalSeconds: seconds
    };
}

/**
 * Create the transport timecode display element
 * @param {HTMLElement} container - Container to append the display to
 * @returns {HTMLElement} The display element
 */
export function createTransportTimecodeDisplay(container) {
    const display = document.createElement('div');
    display.id = 'transportTimecodeDisplay';
    display.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 12px;
        background: #1a1a1a;
        border: 1px solid #3a3a3a;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        user-select: none;
    `;
    
    // Bars:Beats display
    const barsBeats = document.createElement('div');
    barsBeats.id = 'timecodeBarsBeats';
    barsBeats.style.cssText = `
        font-size: 18px;
        font-weight: bold;
        color: #00ddff;
        min-width: 100px;
    `;
    barsBeats.textContent = '1:1:000';
    
    // Seconds display
    const secondsDisplay = document.createElement('div');
    secondsDisplay.id = 'timecodeSeconds';
    secondsDisplay.style.cssText = `
        font-size: 14px;
        color: #888;
        min-width: 70px;
    `;
    secondsDisplay.textContent = '0:00.000';
    
    // Timecode type indicator
    const indicator = document.createElement('span');
    indicator.id = 'timecodeIndicator';
    indicator.style.cssText = `
        font-size: 10px;
        color: #555;
        padding: 2px 4px;
        background: #222;
        border-radius: 2px;
    `;
    indicator.textContent = 'BBT';
    
    display.appendChild(barsBeats);
    display.appendChild(secondsDisplay);
    display.appendChild(indicator);
    
    if (container) {
        container.appendChild(display);
    }
    
    return display;
}

/**
 * Update the transport timecode display with current position
 * @param {Object} timeData - Object with bars, beats, ticks, seconds properties
 * @param {string} mode - Display mode: 'BBT', 'SEC', or 'SMPTE'
 */
export function updateTransportTimecodeFromTransport(timeData, mode = 'BBT') {
    const barsBeatsEl = document.getElementById('timecodeBarsBeats');
    const secondsEl = document.getElementById('timecodeSeconds');
    const indicatorEl = document.getElementById('timecodeIndicator');
    
    if (!barsBeatsEl || !secondsEl) return;
    
    if (mode === 'BBT') {
        barsBeatsEl.textContent = `${timeData.bars}:${timeData.beats}:${String(timeData.ticks).padStart(3, '0')}`;
        indicatorEl.textContent = 'BBT';
    } else if (mode === 'SEC') {
        barsBeatsEl.textContent = `${timeData.minutes}:${timeData.seconds.toFixed(3).padStart(6, '0')}`;
        indicatorEl.textContent = 'SEC';
    } else {
        // SMPTE-like display
        barsBeatsEl.textContent = `${String(timeData.minutes).padStart(2, '0')}:${String(Math.floor(timeData.seconds)).padStart(2, '0')}:${String(Math.floor((timeData.seconds % 1) * 1000)).padStart(3, '0')}`;
        indicatorEl.textContent = 'TC';
    }
    
    secondsEl.textContent = `${timeData.minutes}:${timeData.seconds.toFixed(3).padStart(6, '0')}`;
}

/**
 * Start the transport timecode update loop
 * @param {Function} getPositionCallback - Callback that returns current position in seconds
 * @param {number} bpm - Current BPM
 * @param {number} beatsPerBar - Current beats per bar
 * @param {string} mode - Display mode
 * @returns {number} Interval ID for clearing
 */
export function startTransportTimecodeLoop(getPositionCallback, bpm = 120, beatsPerBar = 4, mode = 'BBT') {
    const updateFn = () => {
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            const position = Tone.Transport.seconds;
            const timeData = secondsToBarsBeatsTicks(position, bpm, beatsPerBar);
            updateTransportTimecodeFromTransport(timeData, mode);
        }
    };
    
    // Update at 30fps
    return setInterval(updateFn, 33);
}
