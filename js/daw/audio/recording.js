// js/daw/audio/recording.js

// Corrected import path for Track and added getRecordingStartTime as import
import { getRecordingStartTime } from '/app/js/daw/state/trackState.js'; // Corrected path

let localAppServices = {};

/**
 * Initializes the recording module with the main app services.
 * @param {object} appServices - The main app services object.
 */
export function initializeRecording(appServices) {
    localAppServices = appServices;
}

/**
 * Starts audio recording for a specified track.
 * @param {object} track - The track object to record to.
 * @param {boolean} isMonitoringEnabled - True if input monitoring should be enabled during recording.
 * @returns {Promise<boolean>} A promise that resolves to true if recording started successfully, false otherwise.
 */
export async function startAudioRecording(track, isMonitoringEnabled) {
    let micInstance = null;
    let recorderInstance = null;
    
    try {
        // Create a Tone.js UserMedia instance for microphone input
        micInstance = new localAppServices.Tone.UserMedia({
            audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } // Disable browser audio processing
        });
        // Create a Tone.js Recorder instance to capture audio
        recorderInstance = new localAppServices.Tone.Recorder();

        // Validate track type
        if (!track || track.type !== 'Audio' || !track.inputChannel) {
            localAppServices.showNotification?.('Invalid track for recording. Select an Audio track.', 3000);
            return false;
        }

        // Open microphone input
        await micInstance.open();
        // Connect microphone input to the recorder
        micInstance.connect(recorderInstance);
        // If monitoring is enabled, connect microphone to the track's input channel for playback
        if (isMonitoringEnabled) {
            micInstance.connect(track.inputChannel);
        }
        // Start the recorder
        await recorderInstance.start();

        // Store active instances for later stopping
        localAppServices._currentMicInstance = micInstance;
        localAppServices._currentRecorderInstance = recorderInstance;

        return true;
    } catch (error) {
        console.error("Error starting recording:", error);
        localAppServices.showNotification?.('Could not start recording. Check microphone permissions and ensure a device is connected.', 4000);
        // Dispose any created instances in case of error
        micInstance?.dispose();
        recorderInstance?.dispose();
        localAppServices._currentMicInstance = null;
        localAppServices._currentRecorderInstance = null;
        return false;
    }
}

/**
 * Stops the current audio recording, processes the recorded blob, and adds it as an audio clip to the track.
 */
export async function stopAudioRecording() {
    const recorderInstance = localAppServices._currentRecorderInstance;
    const micInstance = localAppServices._currentMicInstance;

    if (!recorderInstance) {
        console.warn("No active recorder instance to stop.");
        return;
    }
    
    let blob = null;
    // Stop the recorder only if it's in a started state
    if (recorderInstance.state === "started") {
        blob = await recorderInstance.stop(); // This returns the recorded audio Blob
    }

    // Close and dispose of microphone input
    if (micInstance) {
        micInstance.close();
        micInstance.dispose(); // Dispose the Tone.UserMedia instance
        localAppServices._currentMicInstance = null;
    }
    // Dispose of the recorder instance
    if (recorderInstance && typeof recorderInstance.dispose === 'function') {
        recorderInstance.dispose();
    }
    localAppServices._currentRecorderInstance = null;

    // Process the recorded audio blob
    if (blob && blob.size > 0) {
        const recordingTrackId = localAppServices.getRecordingTrackId?.();
        const startTime = localAppServices.getRecordingStartTime();
        const track = localAppServices.getTrackById?.(recordingTrackId);

        if (track && track.type === 'Audio') { // Ensure it's an audio track
            const clipName = `Recording-${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})}`; // Generate unique name
            // Add the recorded audio blob as a new clip to the track
            await track.clips.addAudioClip(blob, startTime, clipName); // Call on track.clips
            localAppServices.showNotification?.('Recording saved as new audio clip!', 2500);
        } else {
            console.error("Could not find a valid Audio track to add recorded clip to.");
            localAppServices.showNotification?.('Error: Could not find Audio track to place recording. Recording discarded.', 4000);
        }
    } else {
        localAppServices.showNotification?.('Recording was too short or empty. Discarded.', 2500);
    }
}