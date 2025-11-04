// js/daw/audio/playback.js

// Corrected imports for Constants and Utils
import * as Constants from '../constants.js';
import { showNotification } from '../utils.js';

let localAppServices = {};

/**
 * Initializes the playback module with the main app services.
 * @param {object} appServices - The main app services object.
 */
export function initializePlayback(appServices) {
    localAppServices = appServices;
}

/**
 * Schedules all active clips and sequences on the Tone.js Transport for timeline-based playback.
 * This clears any previously scheduled events and reconstructs the entire playback schedule.
 */
export function scheduleTimelinePlayback() {
    // First, clear any existing scheduled events from the transport
    localAppServices.Tone.Transport.cancel(0);

    const tracks = localAppServices.getTracks?.() || [];

    tracks.forEach(track => {
        // Schedule all clips for this track
        track.clips?.timelineClips.forEach(clip => {
            if (clip.type === 'audio' && clip.audioBuffer) {
                // --- Audio Clip Scheduling ---
                // For audio clips, create a Tone.Player and schedule its start and dispose.
                localAppServices.Tone.Transport.scheduleOnce((time) => {
                    // Create a new player for each clip playback
                    const player = new localAppServices.Tone.Player(clip.audioBuffer).connect(track.input);
                    // Start the player at the clip's scheduled time, with specified offset and duration.
                    player.start(time, clip.offset || 0, clip.duration);
                    // Schedule disposal of the player after its duration plus a small buffer.
                    localAppServices.Tone.Transport.scheduleOnce(() => player.dispose(), time + clip.duration + 0.5);
                }, clip.startTime); // Schedule the clip at its defined start time

            } else if (clip.type === 'midi' && clip.sequenceData && track.instrument) {
                // --- MIDI Clip Scheduling ---
                // For MIDI clips, reconstruct a Tone.Part from its sequence data.
                const events = [];
                // Assuming sequence data always has at least one pitch row to determine length.
                const sequenceLength = clip.sequenceData[0]?.length || 0; 
                const ticksPer16thNote = localAppServices.Tone.Transport.PPQ / 4;

                // Iterate through the sequence data to gather all note events
                for (let pitchIndex = 0; pitchIndex < clip.sequenceData.length; pitchIndex++) {
                    for (let step = 0; step < sequenceLength; step++) {
                        const note = clip.sequenceData[pitchIndex][step];
                        if (note) {
                            events.push({
                                // Convert step to Tone.js time format (bars:beats:sixteenths)
                                time: new localAppServices.Tone.Ticks(step * ticksPer16thNote).toBarsBeatsSixteenths(),
                                note: Constants.SYNTH_PITCHES[pitchIndex], // Get note name from constants
                                duration: `${note.duration || 1}*16n`, // Note duration, default to 1 16th note
                                velocity: note.velocity || 0.75 // Note velocity, default to 0.75
                            });
                        }
                    }
                }
                
                // Create a Tone.Part that triggers the instrument for each note event
                const part = new localAppServices.Tone.Part((time, value) => {
                    // Trigger the track's instrument attack/release for the scheduled note.
                    if (track.instrument) { // Ensure instrument exists when callback fires
                        track.instrument.triggerAttackRelease(value.note, value.duration, time, value.velocity);
                    }
                }, events);

                // Start the part at the clip's start time.
                part.start(clip.startTime);
                
                // Schedule disposal of the Tone.Part after the clip ends plus a small buffer.
                localAppServices.Tone.Transport.scheduleOnce(() => {
                    part.dispose();
                }, clip.startTime + clip.duration + 0.1);
            }
        });
    });
}

/**
 * Plays a preview of a specific slice from a Sampler track.
 * @param {number} trackId - The ID of the Sampler track.
 * @param {number} sliceIndex - The index of the slice to preview.
 * @param {number} [velocity=0.7] - The playback velocity (0.0-1.0).
 * @param {number} [additionalPitchShiftInSemitones=0] - Additional pitch shift to apply in semitones.
 * @param {number} [time] - Optional Tone.js time to schedule playback. Defaults to Tone.now().
 */
export async function playSlicePreview(trackId, sliceIndex, velocity = 0.7, additionalPitchShiftInSemitones = 0, time = undefined) {
    // Ensure audio context is running before playing sound.
    const audioReady = await localAppServices.initAudioContextAndMasterMeter?.(true);
    if (!audioReady) {
        showNotification?.("Audio not ready for preview.", 2000);
        return;
    }

    const track = localAppServices.getTrackById?.(trackId);

    // Validate track and slice data.
    if (!track || track.type !== 'Sampler' || !track.audioBuffer || !track.audioBuffer.loaded || !track.slices[sliceIndex]) {
        return;
    }
    const sliceData = track.slices[sliceIndex];
    if (!sliceData || sliceData.duration <= 0) {
        return;
    }
    
    const scheduledTime = time !== undefined ? time : localAppServices.Tone.now();
    
    // Calculate total pitch shift and playback rate.
    const totalPitchShift = (sliceData.pitchShift || 0) + additionalPitchShiftInSemitones;
    const playbackRate = Math.pow(2, totalPitchShift / 12);
    let playDuration = sliceData.duration / playbackRate;
    if (sliceData.loop) playDuration = Math.min(playDuration, 2); // Limit loop preview duration

    // Get the master bus input node to connect the preview player.
    const masterBusInput = localAppServices.getMasterBusInputNode?.();
    if (!masterBusInput) {
        console.error("Master Bus not available for preview.");
        return;
    }
    
    // For previews, we connect directly to the master output to bypass track effects and track volume.
    // Use the `slice.offset` and `playDuration` to play only the specified portion of the buffer.
    const tempPlayer = new localAppServices.Tone.Player(track.audioBuffer).connect(masterBusInput);
    tempPlayer.playbackRate = playbackRate;
    tempPlayer.volume.value = localAppServices.Tone.gainToDb(sliceData.volume * velocity); // Apply slice and preview velocity
    tempPlayer.loop = sliceData.loop; // Apply loop setting from slice data
    // Start the player at the calculated offset and duration
    tempPlayer.start(scheduledTime, sliceData.offset, playDuration);

    // Schedule disposal of the temporary player after playback.
    localAppServices.Tone.Transport.scheduleOnce(() => {
        tempPlayer.dispose();
    }, scheduledTime + playDuration + 0.5);
}

/**
 * Plays a preview of a specific drum pad from a DrumSampler track.
 * @param {number} trackId - The ID of the DrumSampler track.
 * @param {number} padIndex - The index of the drum pad to preview.
 * @param {number} [velocity=0.7] - The playback velocity (0.0-1.0).
 * @param {number} [additionalPitchShiftInSemitones=0] - Additional pitch shift to apply in semitones.
 * @param {number} [time] - Optional Tone.js time to schedule playback. Defaults to Tone.now().
 */
export async function playDrumSamplerPadPreview(trackId, padIndex, velocity = 0.7, additionalPitchShiftInSemitones = 0, time = undefined) {
    // Ensure audio context is running before playing sound.
    const audioReady = await localAppServices.initAudioContextAndMasterMeter?.(true);
    if (!audioReady) {
        showNotification?.("Audio not ready for preview.", 2000);
        return;
    }

    const track = localAppServices.getTrackById?.(trackId);
    if (!track || track.type !== 'DrumSampler') {
        return;
    }

    const padData = track.drumSamplerPads?.[padIndex];

    // Validate pad data and audio buffer.
    if (!padData || !padData.audioBuffer || !padData.audioBuffer.loaded) {
        return;
    }
    
    // Get the master bus input node to connect the preview player.
    const masterBusInput = localAppServices.getMasterBusInputNode?.();
    if (!masterBusInput) {
        console.error("Master Bus not available for preview.");
        return;
    }
    
    const scheduledTime = time !== undefined ? time : localAppServices.Tone.now();

    // Create a temporary player connected directly to the master bus.
    const tempPlayer = new localAppServices.Tone.Player(padData.audioBuffer).connect(masterBusInput);
    
    // Apply pad volume and preview velocity, converting to decibels.
    tempPlayer.volume.value = localAppServices.Tone.gainToDb(padData.volume * velocity * 0.8); // 0.8 to give some headroom
    // Calculate total pitch shift and apply to playback rate.
    const totalPadPitchShift = (padData.pitchShift || 0) + additionalPitchShiftInSemitones;
    tempPlayer.playbackRate = Math.pow(2, totalPadPitchShift / 12);
    
    // Start playback immediately.
    tempPlayer.start(scheduledTime);

    // Schedule disposal of the temporary player after its duration plus a small buffer.
    localAppServices.Tone.Transport.scheduleOnce(() => {
        tempPlayer.dispose();
    }, scheduledTime + padData.audioBuffer.duration + 0.5);
}