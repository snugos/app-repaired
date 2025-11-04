// js/daw/state/projectState.js

// Corrected imports for Constants and Utils
import * as Constants from '../constants.js';
import { showNotification } from '../utils.js';
import { serializeWindows, reconstructWindows as recreateWindowsFromState } from './windowState.js'; // Import window state functions

let undoStack = []; // History of states for undo operation
let redoStack = []; // History of states for redo operation
const MAX_UNDO_HISTORY = 50; // Maximum number of states to store in undo history

let isReconstructingDAW = false; // Flag to prevent capturing undo states during reconstruction

let clipboardData = { type: null, data: null, sourceTrackType: null, sequenceLength: null }; // Data held in the application's clipboard

let localAppServices = {}; // Reference to the main appServices object

/**
 * Initializes the project state module.
 * @param {object} appServices - The main app services object.
 */
export function initializeProjectState(appServices) {
    localAppServices = appServices;
}

/**
 * Gets the current reconstruction status.
 * @returns {boolean} True if the DAW is currently being reconstructed, false otherwise.
 */
export function getIsReconstructingDAW() {
    return isReconstructingDAW;
}

/**
 * Sets the reconstruction status.
 * @param {boolean} isReconstructing - True to indicate reconstruction is active, false otherwise.
 */
export function setIsReconstructingDAW(isReconstructing) {
    isReconstructingDAW = isReconstructing;
}

/**
 * Gets the undo stack.
 * @returns {Array<object>} The array of saved states for undo.
 */
export function getUndoStack() {
    return undoStack;
}

/**
 * Gets the redo stack.
 * @returns {Array<object>} The array of saved states for redo.
 */
export function getRedoStack() {
    return redoStack;
}

/**
 * Gets the current clipboard data.
 * @returns {object} The clipboard data.
 */
export function getClipboardData() {
    return clipboardData;
}

/**
 * Sets the clipboard data.
 * @param {object} data - The data to set in the clipboard.
 */
export function setClipboardData(data) {
    clipboardData = data;
}

/**
 * Captures the current state of the project for undo history.
 * @param {string} actionDescription - A description of the action being undone.
 */
export function captureStateForUndo(actionDescription) {
    if (getIsReconstructingDAW()) return; // Do not capture state during reconstruction
    const state = gatherProjectData(); // Get current project data
    undoStack.push({ state, actionDescription }); // Add state and description to undo stack
    if (undoStack.length > MAX_UNDO_HISTORY) {
        undoStack.shift(); // Remove oldest state if history exceeds limit
    }
    redoStack = []; // Clear redo stack on a new action
    // Update UI elements for undo/redo buttons if available (e.g., in top taskbar)
    localAppServices.updateUndoRedoButtons?.(); 
}

/**
 * Undoes the last action by reverting to the previous saved state.
 */
export function undoLastAction() {
    if (undoStack.length > 0) { // Check if there are states to undo
        const lastState = undoStack.pop(); // Get the last state from undo stack
        const currentState = gatherProjectData(); // Capture current state for redo
        redoStack.push({ state: currentState, actionDescription: lastState.actionDescription }); // Add to redo stack
        reconstructDAW(lastState.state); // Reconstruct DAW to the previous state
    }
    // Update UI elements for undo/redo buttons
    localAppServices.updateUndoRedoButtons?.();
}

/**
 * Redoes the last undone action by reapplying a saved state.
 */
export function redoLastAction() {
    if (redoStack.length > 0) { // Check if there are states to redo
        const nextState = redoStack.pop(); // Get the next state from redo stack
        const currentState = gatherProjectData(); // Capture current state for undo
        undoStack.push({ state: currentState, actionDescription: nextState.actionDescription }); // Add to undo stack
        reconstructDAW(nextState.state); // Reconstruct DAW to the redoes state
    }
    // Update UI elements for undo/redo buttons
    localAppServices.updateUndoRedoButtons?.();
}

/**
 * Gathers all current project data into a serializable object.
 * This includes tracks, master effects, master volume, and tempo.
 * @returns {object} A comprehensive project data object.
 */
export function gatherProjectData() {
    const tracks = localAppServices.getTracks?.() || []; // Get all tracks
    return { //
        tracks: tracks.map(t => t.serialize()), // Serialize each track
        masterEffects: localAppServices.getMasterEffects?.(), // Get master effects
        masterVolume: localAppServices.getMasterGainValue?.(), // Get master volume
        tempo: localAppServices.Tone.Transport.bpm.value, // Get current tempo
        version: Constants.APP_VERSION, // Include app version
        openWindows: serializeWindows(), // Serialize the state of all open windows
    };
}

/**
 * Reconstructs the DAW state from a given project data object.
 * This is used for loading projects and undo/redo operations.
 * @param {object} projectData - The project data to reconstruct from.
 */
export async function reconstructDAW(projectData) {
    setIsReconstructingDAW(true); // Set flag to prevent new undo captures
    
    // Clear existing state (dispose all current tracks and reset global track state)
    const currentTracks = localAppServices.getTracks?.() || [];
    for (const track of currentTracks) {
        track.dispose(); // Dispose Tone.js resources for each track
    }
    localAppServices.setTracks?.([]); // Clear tracks array
    localAppServices.setTrackIdCounter?.(0); // Reset track ID counter
    
    // Reconstruct tracks
    if (projectData.tracks) { // Check if tracks data exists
        const reconstructedTracks = [];
        // Use a traditional for loop to await promises correctly
        for (const trackData of projectData.tracks) {
            // For reconstruction, we create a new Track instance and deserialize its data.
            // This ensures Tone.js nodes are re-created correctly.
            // The Track constructor does not need `trackData` here, as deserialize is called explicitly.
            const newTrack = new localAppServices.Track(trackData.id, trackData.type, null, localAppServices); // Create new Track instance
            await newTrack.deserialize(trackData); // Deserialize its properties, including instrument and effects
            reconstructedTracks.push(newTrack); // Add to a temporary array
            // Update trackIdCounter to be higher than any existing track ID
            localAppServices.setTrackIdCounter?.(Math.max(localAppServices.getTrackIdCounter(), trackData.id + 1));
        }
        localAppServices.setTracks?.(reconstructedTracks); // Set the global tracks array with the reconstructed instances
    }
    
    // Reconstruct master state
    localAppServices.setMasterGainValue?.(projectData.masterVolume); // Restore master volume
    localAppServices.Tone.Transport.bpm.value = projectData.tempo; // Restore tempo
    localAppServices.setMasterEffects?.(projectData.masterEffects); // Restore master effects data
    localAppServices.rebuildMasterEffectChain?.(); // Rebuild master effects audio graph
    
    // Reconstruct open windows
    if (projectData.openWindows) { // Check if window state exists
        recreateWindowsFromState(projectData.openWindows); // Recreate windows based on saved state
    } else {
        // If no window state, close all existing windows
        Array.from(localAppServices.getOpenWindows().keys()).forEach(windowId => {
            localAppServices.getWindowById(windowId)?.close(true); // Close silently
        });
    }

    // Update UI elements for mixer and potentially piano roll/timeline
    localAppServices.updateMixerWindow?.();

    setIsReconstructingDAW(false); // Clear reconstruction flag
    showNotification('Project loaded successfully!', 2000);
}

/**
 * Saves the current project data to a JSON file.
 */
export function saveProject() {
    const projectData = gatherProjectData(); // Gather all project data
    const jsonString = JSON.stringify(projectData, null, 2); // Convert to pretty-printed JSON string
    const blob = new Blob([jsonString], { type: 'application/json' }); // Create a Blob
    const url = URL.createObjectURL(blob); // Create a temporary URL for the Blob
    const a = document.createElement('a'); // Create a download link
    a.href = url; // Set href to Blob URL
    a.download = 'snugos-project.snug'; // Set download file name
    document.body.appendChild(a); // Append link to body
    a.click(); // Programmatically click the link to trigger download
    document.body.removeChild(a); // Remove link from body
    URL.revokeObjectURL(url); // Revoke the Blob URL to free up memory
    showNotification('Project saved!', 2000);
}

/**
 * Loads project data from a provided file.
 * @param {File} file - The project file (typically .snug JSON).
 */
export function loadProject(file) {
    const reader = new FileReader(); // Create a FileReader
    reader.onload = async (e) => { // Set onload event handler
        try {
            const projectData = JSON.parse(e.target.result); // Parse JSON content
            await reconstructDAW(projectData); // Reconstruct DAW with loaded data
        } catch (error) {
            showNotification("Error: Could not parse project file. It might be corrupted or not a valid SnugOS project.", 4000); // Notify user of parsing error
            console.error("Project file parsing error:", error); // Log detailed error
        }
    };
    reader.onerror = (e) => { // Handle read errors
        showNotification("Error reading file.", 3000);
        console.error("File read error:", e);
    };
    reader.readAsText(file); // Read the file as text
}

/**
 * Handles the event when a project file is selected via an input element.
 * @param {Event} event - The change event from the file input.
 */
export async function handleProjectFileLoad(event) {
    const file = event.target.files[0];
    if (file) { // If a file is selected
        await loadProject(file); // Load the project
    }
}

/**
 * Exports the entire project master output to a WAV file.
 * This renders the audio for a fixed duration.
 */
export async function exportToWav() {
    try {
        await localAppServices.initAudioContextAndMasterMeter(true); // Ensure audio context is running
        const recorder = new localAppServices.Tone.Recorder(); // Create a Tone.js Recorder
        localAppServices.Tone.getDestination().connect(recorder); // Connect master output to recorder

        const exportDuration = 10; // Fixed duration for export (in seconds)
        showNotification(`Rendering ${exportDuration} seconds... Please keep the tab active.`, exportDuration * 1000 + 2000); // Notify user about rendering
        
        recorder.start(); // Start recording
        localAppServices.Tone.Transport.stop(); // Stop transport
        localAppServices.Tone.Transport.position = 0; // Reset transport position to start
        localAppServices.Tone.Transport.start(); // Start transport to render audio

        localAppServices.Tone.Transport.scheduleOnce(async () => { // Schedule a stop event
            localAppServices.Tone.Transport.stop(); // Stop transport after duration
            const recording = await recorder.stop(); // Stop recorder and get the audio blob
            
            const url = URL.createObjectURL(recording); // Create a URL for the blob
            const anchor = document.createElement("a"); // Create a download link
            anchor.download = "snugos-export.wav"; // Set download filename
            anchor.href = url; // Set href to Blob URL
            document.body.appendChild(anchor); // Append to body
            anchor.click(); // Programmatically click the link to trigger download

            URL.revokeObjectURL(url); // Clean up the blob URL
            recorder.dispose(); // Dispose the recorder
            localAppServices.Tone.getDestination().disconnect(recorder); // Disconnect recorder
            showNotification('Export finished! Your download should start shortly.', 3000); // Notify completion

        }, exportDuration); // Schedule stop after `exportDuration` seconds
    } catch (error) {
        console.error("Error exporting to WAV:", error); // Log error
        showNotification('Failed to export WAV file. Check console for details.', 3000); // Notify user
    }
}