// js/RulerModeToggle.js - Toggle between bars/beats and timecode display on ruler
/**
 * Ruler Mode Toggle - Toggle between bars/beats and timecode display on ruler
 * 
 * This module provides switching between:
 * 1. Bars:Beats (default musical notation - 1.1, 2.3, etc.)
 * 2. Timecode (HH:MM:SS:FF - SMPTE timecode)
 * 3. Seconds (simple seconds with decimals)
 */

import * as Constants from './constants.js';

/**
 * Ruler display modes
 */
export const RULER_MODES = {
    BARS_BEATS: 'bars_beats',
    TIMECODE: 'timecode',
    SECONDS: 'seconds'
};

/**
 * Get the user-friendly name for a ruler mode
 * @param {string} mode - The ruler mode
 * @returns {string}
 */
export function getRulerModeName(mode) {
    switch (mode) {
        case RULER_MODES.BARS_BEATS: return 'Bars:Beats';
        case RULER_MODES.TIMECODE: return 'Timecode';
        case RULER_MODES.SECONDS: return 'Seconds';
        default: return 'Unknown';
    }
}

/**
 * Format time as bars:beats
 * @param {number} timeSeconds - Time in seconds
 * @param {number} tempo - BPM
 * @param {number} beatsPerBar - Beats per bar (time signature numerator)
 * @returns {string}
 */
export function formatAsBarsBeats(timeSeconds, tempo = 120, beatsPerBar = 4) {
    const totalBeats = (timeSeconds * tempo) / 60;
    const bars = Math.floor(totalBeats / beatsPerBar) + 1;
    const beats = Math.floor(totalBeats % beatsPerBar) + 1;
    const subDivisions = Math.floor((totalBeats % 1) * 4) + 1;
    
    return `${bars}.${beats}.${subDivisions}`;
}

/**
 * Format time as SMPTE timecode
 * @param {number} timeSeconds - Time in seconds
 * @param {number} frameRate - Frame rate (24, 25, 30)
 * @returns {string}
 */
export function formatAsTimecode(timeSeconds, frameRate = 30) {
    const totalFrames = Math.floor(timeSeconds * frameRate);
    const frames = totalFrames % frameRate;
    const totalSeconds = Math.floor(totalFrames / frameRate);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

/**
 * Format time as seconds with optional decimals
 * @param {number} timeSeconds - Time in seconds
 * @param {number} decimals - Number of decimal places
 * @returns {string}
 */
export function formatAsSeconds(timeSeconds, decimals = 2) {
    return timeSeconds.toFixed(decimals) + 's';
}

/**
 * Pad number with leading zeros
 */
function pad(num, size = 2) {
    return num.toString().padStart(size, '0');
}

/**
 * Convert bars:beats to seconds
 * @param {string} barsBeats - String like "1.1.1"
 * @param {number} tempo - BPM
 * @param {number} beatsPerBar - Beats per bar
 * @returns {number} Time in seconds
 */
export function barsBeatsToSeconds(barsBeats, tempo = 120, beatsPerBar = 4) {
    const parts = barsBeats.split('.');
    if (parts.length !== 3) return 0;
    
    const bars = parseInt(parts[0], 10) - 1;
    const beats = parseInt(parts[1], 10) - 1;
    const subdivisions = parseInt(parts[2], 10) - 1;
    
    const totalBeats = (bars * beatsPerBar) + beats + (subdivisions / 4);
    return (totalBeats * 60) / tempo;
}

/**
 * Convert timecode to seconds
 * @param {string} timecode - String like "01:23:45:12"
 * @param {number} frameRate - Frame rate
 * @returns {number} Time in seconds
 */
export function timecodeToSeconds(timecode, frameRate = 30) {
    const parts = timecode.split(':').map(p => parseInt(p, 10));
    if (parts.length !== 4) return 0;
    
    const [hours, minutes, seconds, frames] = parts;
    return (hours * 3600) + (minutes * 60) + seconds + (frames / frameRate);
}

/**
 * Get tick positions for ruler display
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @param {string} mode - Ruler mode
 * @param {number} tempo - BPM (for bars:beats)
 * @param {number} beatsPerBar - Beats per bar
 * @param {number} frameRate - Frame rate (for timecode)
 * @returns {Array<{position: number, label: string, major: boolean}>}
 */
export function getRulerTicks(startTime, endTime, mode, tempo = 120, beatsPerBar = 4, frameRate = 30) {
    const ticks = [];
    
    if (mode === RULER_MODES.BARS_BEATS) {
        return getBarsBeatsTicks(startTime, endTime, tempo, beatsPerBar);
    } else if (mode === RULER_MODES.TIMECODE) {
        return getTimecodeTicks(startTime, endTime, frameRate);
    } else {
        return getSecondsTicks(startTime, endTime);
    }
}

/**
 * Get ticks for bars:beats mode
 */
function getBarsBeatsTicks(startTime, endTime, tempo, beatsPerBar) {
    const ticks = [];
    const secondsPerBeat = 60 / tempo;
    const secondsPerBar = secondsPerBeat * beatsPerBar;
    
    // Determine tick granularity based on visible range
    const visibleDuration = endTime - startTime;
    let beatDivision;
    
    if (visibleDuration <= 4) {
        beatDivision = secondsPerBeat / 4; // 16th note ticks
    } else if (visibleDuration <= 16) {
        beatDivision = secondsPerBeat / 2; // 8th note ticks
    } else if (visibleDuration <= 60) {
        beatDivision = secondsPerBeat; // Quarter note ticks
    } else {
        beatDivision = secondsPerBar; // Bar ticks
    }
    
    // Generate ticks
    let time = Math.floor(startTime / beatDivision) * beatDivision;
    while (time <= endTime) {
        if (time >= startTime) {
            const isMajor = (time % secondsPerBar) < 0.001;
            ticks.push({
                position: time,
                label: formatAsBarsBeats(time, tempo, beatsPerBar),
                major: isMajor
            });
        }
        time += beatDivision;
    }
    
    return ticks;
}

/**
 * Get ticks for timecode mode
 */
function getTimecodeTicks(startTime, endTime, frameRate) {
    const ticks = [];
    
    // Determine tick granularity based on visible range
    const visibleDuration = endTime - startTime;
    let frameInterval;
    
    if (visibleDuration <= 10) {
        frameInterval = 1; // Every frame
    } else if (visibleDuration <= 60) {
        frameInterval = frameRate; // Every second
    } else if (visibleDuration <= 300) {
        frameInterval = frameRate * 5; // Every 5 seconds
    } else {
        frameInterval = frameRate * 10; // Every 10 seconds
    }
    
    const startFrame = Math.floor(startTime * frameRate);
    const endFrame = Math.floor(endTime * frameRate);
    
    for (let frame = startFrame; frame <= endFrame; frame += frameInterval) {
        const time = frame / frameRate;
        const isMajor = (frame % (frameRate * 5)) === 0; // Major tick every 5 seconds
        ticks.push({
            position: time,
            label: formatAsTimecode(time, frameRate),
            major: isMajor
        });
    }
    
    return ticks;
}

/**
 * Get ticks for seconds mode
 */
function getSecondsTicks(startTime, endTime) {
    const ticks = [];
    const visibleDuration = endTime - startTime;
    
    // Determine tick interval
    let interval;
    if (visibleDuration <= 4) {
        interval = 0.25;
    } else if (visibleDuration <= 16) {
        interval = 1;
    } else if (visibleDuration <= 60) {
        interval = 5;
    } else {
        interval = 10;
    }
    
    for (let t = Math.ceil(startTime / interval) * interval; t <= endTime; t += interval) {
        const isMajor = t % (interval * 4) < 0.001;
        ticks.push({
            position: t,
            label: formatAsSeconds(t, 1),
            major: isMajor
        });
    }
    
    return ticks;
}

/**
 * Parse ruler position string based on mode
 * @param {string} value - The string to parse
 * @param {string} mode - Ruler mode
 * @param {number} tempo - BPM (for bars:beats)
 * @param {number} frameRate - Frame rate (for timecode)
 * @returns {number|null} Time in seconds or null if invalid
 */
export function parseRulerPosition(value, mode, tempo = 120, frameRate = 30) {
    if (!value || typeof value !== 'string') return null;
    
    const trimmed = value.trim();
    
    if (mode === RULER_MODES.BARS_BEATS) {
        return barsBeatsToSeconds(trimmed, tempo, 4);
    } else if (mode === RULER_MODES.TIMECODE) {
        return timecodeToSeconds(trimmed, frameRate);
    } else {
        // Seconds mode - parse number
        const seconds = parseFloat(trimmed.replace(/s$/, ''));
        return isNaN(seconds) ? null : seconds;
    }
}

/**
 * Get ruler mode from user preference or default
 * @param {string|null} userPreference - User's saved preference
 * @returns {string}
 */
export function getEffectiveRulerMode(userPreference = null) {
    if (userPreference && Object.values(RULER_MODES).includes(userPreference)) {
        return userPreference;
    }
    return RULER_MODES.BARS_BEATS; // Default
}

export default {
    RULER_MODES,
    getRulerModeName,
    formatAsBarsBeats,
    formatAsTimecode,
    formatAsSeconds,
    barsBeatsToSeconds,
    timecodeToSeconds,
    getRulerTicks,
    parseRulerPosition,
    getEffectiveRulerMode
};