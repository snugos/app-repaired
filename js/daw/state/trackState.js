// js/daw/state/trackState.js

// Track class will be provided by main.js via initializeTrackState
let TrackClassReference = null; // Store the Track class passed by main.js

let tracks = []; // Array to hold all track objects
let trackIdCounter = 0; // Counter for generating unique track IDs
let soloedTrackId = null; // ID of the currently soloed track, or null if none
let armedTrackId = null; // ID of the currently armed track for recording, or null if none
let isRecordingGlobal = false; // Global flag indicating if recording is active
let recordingTrackIdGlobal = null; // ID of the track currently being recorded
let recordingStartTimeGlobal = 0; // The Tone.js Transport time when recording started

let localAppServices = {}; // Reference to the main appServices object

/**
 * Initializes the track state module.
 * @param {object} appServices - The main app services object.
 * @param {class} Track - The Track class constructor from the main app context.
 */
export function initializeTrackState(appServices, Track) {
    localAppServices = appServices;
    TrackClassReference = Track; // Store the authoritative Track class
}

/**
 * Gets all track objects.
 * @returns {Array<Track>} An array of all track objects.
 */
export function getTracks() { return tracks; }

/**
 * Gets a track object by its ID.
 * @param {number} id - The ID of the track.
 * @returns {Track|undefined} The track object, or undefined if not found.
 */
export function getTrackById(id) { return tracks.find(t => t.id === id); }

/**
 * Gets the ID of the currently soloed track.
 * @returns {number|null} The ID of the soloed track, or null.
 */
export function getSoloedTrackId() { return soloedTrackId; }

/**
 * Sets the ID of the currently soloed track.
 * @param {number|null} id - The ID of the track to solo, or null to unsolo all.
 */
export function setSoloedTrackId(id) { soloedTrackId = id; }

/**
 * Gets the ID of the currently armed track.
 * @returns {number|null} The ID of the armed track, or null.
 */
export function getArmedTrackId() { return armedTrackId; }

/**
 * Sets the ID of the currently armed track.
 * @param {number|null} id - The ID of the track to arm, or null to disarm all.
 */
export function setArmedTrackId(id) { armedTrackId = id; }

/**
 * Checks if global recording is currently active.
 * @returns {boolean} True if recording, false otherwise.
 */
export function isRecording() { return isRecordingGlobal; }

/**
 * Sets the global recording status.
 * @param {boolean} isRecording - True to set recording active, false to set inactive.
 */
export function setIsRecording(isRecording) { isRecordingGlobal = isRecording; }

/**
 * Gets the ID of the track that is currently being recorded.
 * @returns {number|null} The ID of the recording track, or null.
 */
export function getRecordingTrackId() { return recordingTrackIdGlobal; }

/**
 * Sets the ID of the track that is currently being recorded.
 * @param {number|null} id - The ID of the track.
 */
export function setRecordingTrackId(id) { recordingTrackIdGlobal = id; }

/**
 * Gets the start time of the current recording.
 * @returns {number} The Tone.js Transport time when recording started.
 */
export function getRecordingStartTime() { return recordingStartTimeGlobal; }

/**
 * Sets the start time of the current recording.
 * @param {number} time - The Tone.js Transport time.
 */
export function setRecordingStartTime(time) { recordingStartTimeGlobal = time; }

/**
 * Adds a new track to the project.
 * @param {string} type - The type of track ('Synth', 'Sampler', 'DrumSampler', 'InstrumentSampler', 'Audio').
 * @returns {Promise<Track>} A promise that resolves with the newly created track.
 */
export async function addTrack(type) {
    if (!TrackClassReference) {
        console.error("Track class not initialized in trackState.js. Cannot add track.");
        return null;
    }
    const newTrackId = trackIdCounter++; // Increment counter for unique ID
    // Instantiate Track using the locally stored TrackClassReference.
    const track = new TrackClassReference(newTrackId, type, null, localAppServices);
    tracks.push(track); // Add to global tracks array
    await track.initializeInstrument(); // Initialize the Tone.js instrument for the track
    
    localAppServices.updateMixerWindow?.(); // Refresh mixer UI
    localAppServices.captureStateForUndo?.(`Add ${type} Track`); // Capture state for undo
    return track;
}

/**
 * Removes a track from the project.
 * @param {number} trackId - The ID of the track to remove.
 */
export function removeTrack(trackId) {
    const index = tracks.findIndex(t => t.id === trackId); // Find track index
    if (index > -1) { // If track found
        const trackName = tracks[index].name; // Get track name for undo description
        localAppServices.captureStateForUndo?.(`Remove Track: ${trackName}`); // Capture state for undo
        tracks[index].dispose(); // Dispose of the track's Tone.js resources
        tracks.splice(index, 1); // Remove track from array

        // If the removed track was soloed or armed, clear that state
        if (soloedTrackId === trackId) {
            setSoloedTrackId(null);
            tracks.forEach(t => t.updateSoloMuteState(null)); // Update all tracks' solo state
        }
        if (armedTrackId === trackId) {
            setArmedTrackId(null);
        }

        localAppServices.updateMixerWindow?.(); // Refresh mixer UI
    }
}

/**
 * Sets the entire array of tracks (used during project loading/undo/redo).
 * @param {Array<Track>} newTracks - The new array of track objects.
 */
export function setTracks(newTracks) {
    tracks = newTracks;
}

/**
 * Sets the track ID counter (used during project loading).
 * @param {number} count - The new value for the track ID counter.
 */
export function setTrackIdCounter(count) {
    trackIdCounter = count;
}