// js/audio/recording.js

import { getRecordingStartTimeState } from '../state.js';

let localAppServices = {};
let mic = null;
let recorder = null;

export function initializeRecording(appServices) {
    localAppServices = appServices;
}

export async function startAudioRecording(track, isMonitoringEnabled) {
    if (mic?.state === "started") mic.close();
    if (recorder?.state === "started") await recorder.stop();

    mic = new Tone.UserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false }
    });
    recorder = new Tone.Recorder();

    if (!track || track.type !== 'Audio' || !track.inputChannel) {
        localAppServices.showNotification?.('Invalid track for recording.', 3000);
        return false;
    }

    try {
        await mic.open();
        mic.connect(recorder);
        if (isMonitoringEnabled) {
            mic.connect(track.inputChannel);
        }
        await recorder.start();
        return true;
    } catch (error) {
        console.error("Error starting recording:", error);
        localAppServices.showNotification?.('Could not start recording. Check microphone permissions.', 4000);
        return false;
    }
}

export async function stopAudioRecording() {
    if (!recorder) return;
    
    let blob = null;
    if (recorder.state === "started") {
        blob = await recorder.stop();
    }

    if (mic) {
        mic.close();
        mic = null;
    }
    recorder = null;

    if (blob && blob.size > 0) {
        const recordingTrackId = localAppServices.getRecordingTrackId?.();
        const startTime = getRecordingStartTimeState();
        const track = localAppServices.getTrackById?.(recordingTrackId);

        if (track && typeof track.addAudioClip === 'function') {
            await track.addAudioClip(blob, startTime);
        } else {
            console.error("Could not find track to add recorded clip to.");
        }
    }
}
