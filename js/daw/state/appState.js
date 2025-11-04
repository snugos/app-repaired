// js/daw/state/appState.js

// No direct imports to correct here as it only uses localAppServices and Tone

let midiAccess = null; // Stores the Web MIDI API MIDIAccess object
let activeMIDIInput = null; // Stores the currently selected active MIDI input device
let playbackMode = 'piano-roll'; // Current playback mode: 'piano-roll' or 'timeline'
let currentUserThemePreference = 'system'; // User's theme preference: 'system', 'light', or 'dark'
let midiRecordMode = 'overdub'; // MIDI recording mode: 'overdub' or 'replace'
let selectedTimelineClipInfo = { // Stores information about the currently selected timeline clip for manipulation
    clipId: null, // ID of the selected clip
    trackId: null, // ID of the track the clip belongs to
    originalLeft: 0, // Original left position in pixels
    originalStart: 0, // Original start time in seconds
    pixelsPerSecond: 0, // Conversion factor for timeline rendering
};

let localAppServices = {}; // Reference to the main appServices object

/**
 * Initializes the application state module.
 * @param {object} appServices - The main app services object.
 */
export function initializeAppState(appServices) { //
    localAppServices = appServices; //
}

/**
 * Gets the Web MIDI API MIDIAccess object.
 * @returns {MIDIAccess|null} The MIDIAccess object.
 */
export function getMidiAccess() { //
    return midiAccess; //
}

/**
 * Sets the Web MIDI API MIDIAccess object.
 * @param {MIDIAccess} access - The MIDIAccess object.
 */
export function setMidiAccess(access) { //
    midiAccess = access; //
}

/**
 * Gets the currently active MIDI input device.
 * @returns {MIDIInput|null} The active MIDI input device.
 */
export function getActiveMIDIInput() { //
    return activeMIDIInput; //
}

/**
 * Sets the currently active MIDI input device.
 * @param {MIDIInput|null} input - The MIDI input device to set as active.
 */
export function setActiveMIDIInput(input) { //
    activeMIDIInput = input; //
}

/**
 * Gets the current playback mode.
 * @returns {'piano-roll'|'timeline'} The current playback mode.
 */
export function getPlaybackMode() { //
    return playbackMode; //
}

/**
 * Sets the playback mode.
 * @param {'piano-roll'|'timeline'} mode - The new playback mode.
 */
export function setPlaybackMode(mode) { //
    if (mode === 'piano-roll' || mode === 'timeline') { //
        const oldMode = playbackMode; //
        playbackMode = mode; //
        localAppServices.onPlaybackModeChange?.(mode, oldMode); //
    }
}

/**
 * Gets the user's current theme preference.
 * @returns {'system'|'light'|'dark'} The current theme preference.
 */
export function getCurrentUserThemePreference() { //
    return currentUserThemePreference; //
}

/**
 * Sets the user's theme preference and applies it to the UI.
 * @param {'system'|'light'|'dark'} theme - The new theme preference.
 */
export function setCurrentUserThemePreference(theme) { //
    currentUserThemePreference = theme; //
    localStorage.setItem('snugos-theme', theme); // Store preference in local storage
    localAppServices.applyUserThemePreference?.(); // Apply the theme to the UI
}

/**
 * Gets information about the currently selected timeline clip.
 * @returns {object} The selected timeline clip information.
 */
export function getSelectedTimelineClipInfo() { //
    return selectedTimelineClipInfo; //
}

/**
 * Sets information about the currently selected timeline clip.
 * This allows updating specific properties without replacing the entire object.
 * @param {object} info - An object containing properties to update in `selectedTimelineClipInfo`.
 */
export function setSelectedTimelineClipInfo(info) { //
    selectedTimelineClipInfo = { ...selectedTimelineClipInfo, ...info }; //
}

/**
 * Gets the current MIDI recording mode.
 * @returns {'overdub'|'replace'} The current MIDI recording mode.
 */
export function getMidiRecordModeState() { //
    return midiRecordMode; //
}

/**
 * Sets the MIDI recording mode.
 * @param {'overdub'|'replace'} mode - The new MIDI recording mode.
 */
export function setMidiRecordModeState(mode) { //
    if (mode === 'overdub' || mode === 'replace') { //
        midiRecordMode = mode; //
    }
}