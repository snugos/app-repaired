// js/AudioRecorder.js - Audio Recording Module for SnugOS DAW
// Feature: Record audio from microphone into tracks

let localAppServices = {};
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStream = null;

export function initAudioRecorder(services) {
    localAppServices = services;
    console.log('[AudioRecorder] Initialized');
}

/**
 * Request microphone access
 * @returns {Promise<MediaStream|null>}
 */
export async function requestMicAccess() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        recordingStream = stream;
        console.log('[AudioRecorder] Microphone access granted');
        return stream;
    } catch (error) {
        console.error('[AudioRecorder] Microphone access denied:', error);
        localAppServices.showNotification?.('Microphone access denied. Please allow microphone in browser settings.', 3000);
        return null;
    }
}

/**
 * Start recording audio
 * @param {number} trackId - The track ID to record into
 * @returns {boolean} Success
 */
export async function startRecording(trackId) {
    if (isRecording) {
        console.warn('[AudioRecorder] Already recording');
        return false;
    }

    const stream = recordingStream || await requestMicAccess();
    if (!stream) {
        return false;
    }

    try {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            if (audioChunks.length > 0) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await saveRecordingToTrack(trackId, audioBlob);
            }
        };

        mediaRecorder.start(100); // Collect data every 100ms
        isRecording = true;
        
        // Update UI
        localAppServices.showNotification?.('Recording started', 1500);
        if (localAppServices.setIsRecordingState) {
            localAppServices.setIsRecordingState(true);
        }
        if (localAppServices.setRecordingTrackIdState) {
            localAppServices.setRecordingTrackIdState(trackId);
        }
        if (localAppServices.setRecordingStartTimeState) {
            localAppServices.setRecordingStartTimeState(Date.now());
        }
        
        console.log('[AudioRecorder] Recording started for track', trackId);
        return true;
    } catch (error) {
        console.error('[AudioRecorder] Failed to start recording:', error);
        return false;
    }
}

/**
 * Stop recording audio
 * @returns {boolean} Success
 */
export function stopRecording() {
    if (!isRecording || !mediaRecorder) {
        console.warn('[AudioRecorder] Not currently recording');
        return false;
    }

    try {
        mediaRecorder.stop();
        isRecording = false;
        
        localAppServices.showNotification?.('Recording stopped', 1500);
        if (localAppServices.setIsRecordingState) {
            localAppServices.setIsRecordingState(false);
        }
        if (localAppServices.setRecordingTrackIdState) {
            localAppServices.setRecordingTrackIdState(null);
        }
        
        console.log('[AudioRecorder] Recording stopped');
        return true;
    } catch (error) {
        console.error('[AudioRecorder] Failed to stop recording:', error);
        return false;
    }
}

/**
 * Check if currently recording
 * @returns {boolean}
 */
export function isRecordingActive() {
    return isRecording;
}

/**
 * Save the recorded audio blob to a track
 * @param {number} trackId - Track ID
 * @param {Blob} audioBlob - Audio blob to save
 */
async function saveRecordingToTrack(trackId, audioBlob) {
    try {
        const track = localAppServices.getTrackById?.(trackId);
        if (!track) {
            console.error('[AudioRecorder] Track not found:', trackId);
            return;
        }

        // Convert blob to File
        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        
        // Load audio into Tone.js buffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await Tone.context.decodeAudioData(arrayBuffer);
        
        // Create audio clip data
        const clipData = {
            id: `clip-${Date.now()}`,
            name: `Recording ${new Date().toLocaleTimeString()}`,
            audioBuffer: audioBuffer,
            file: audioFile,
            startTime: 0,
            duration: audioBuffer.duration,
            playbackRate: 1.0,
            offset: 0
        };

        // Add to track timeline clips
        if (!track.timelineClips) {
            track.timelineClips = [];
        }
        
        // Get current playhead position for placement
        let insertPosition = 0;
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            insertPosition = Tone.Transport.seconds;
        }
        
        clipData.startTime = insertPosition;
        track.timelineClips.push(clipData);
        
        // Update track UI
        localAppServices.updateTrackUI?.(trackId, 'timelineClipsChanged');
        localAppServices.showNotification?.(`Recording saved (${audioBuffer.duration.toFixed(1)}s)`, 2000);
        
        console.log('[AudioRecorder] Recording saved to track', trackId);
    } catch (error) {
        console.error('[AudioRecorder] Failed to save recording:', error);
        localAppServices.showNotification?.('Failed to save recording', 2000);
    }
}

/**
 * Clean up recording resources
 */
export function cleanupRecording() {
    if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
        recordingStream = null;
    }
    mediaRecorder = null;
    audioChunks = [];
    isRecording = false;
    console.log('[AudioRecorder] Cleanup complete');
}

/**
 * Get recording status
 * @returns {{isRecording: boolean, duration: number}}
 */
export function getRecordingStatus() {
    let duration = 0;
    if (isRecording && localAppServices.getRecordingStartTimeState) {
        const startTime = localAppServices.getRecordingStartTimeState();
        if (startTime) {
            duration = (Date.now() - startTime) / 1000;
        }
    }
    return { isRecording, duration };
}