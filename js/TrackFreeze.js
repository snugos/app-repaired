// js/TrackFreeze.js - Track Freeze Feature for SnugOS DAW
// Feature: Freeze tracks to audio to save CPU, with defrost functionality

let localAppServices = {};

export function initTrackFreeze(services) {
    localAppServices = services;
    console.log('[TrackFreeze] Initialized');
}

/**
 * Check if a track is currently frozen
 * @param {number} trackId 
 * @returns {boolean}
 */
export function isTrackFrozen(trackId) {
    const track = localAppServices.getTrack?.(trackId);
    return track?.frozenData ? true : false;
}

/**
 * Freeze a track: render its audio output to a buffer
 * @param {number} trackId - The track ID to freeze
 * @param {number} duration - Duration in seconds (optional, uses project length if not provided)
 * @returns {Promise<boolean>} Success
 */
export async function freezeTrack(trackId, duration = null) {
    const track = localAppServices.getTrack?.(trackId);
    if (!track) {
        console.warn('[TrackFreeze] Track not found:', trackId);
        return false;
    }

    if (!track.audioBuffer && track.type === 'Audio' && !track.clips?.length) {
        console.warn('[TrackFreeze] Track has no audio to freeze');
        return false;
    }

    const projectDuration = duration || localAppServices.getProjectDuration?.() || 30;
    const sampleRate = 44100;
    const numChannels = 2;
    const numSamples = Math.ceil(projectDuration * sampleRate);

    try {
        // Create offline context for rendering
        const offlineContext = new OfflineAudioContext(numChannels, numSamples, sampleRate);
        
        // Create a gain node for the track
        const trackGain = offlineContext.createGain();
        trackGain.gain.value = track.volume ?? 0.7;
        trackGain.connect(offlineContext.destination);

        if (track.type === 'Audio' && track.clips?.length) {
            // Render audio clips
            for (const clip of track.clips) {
                if (clip.audioBuffer) {
                    const source = offlineContext.createBufferSource();
                    source.buffer = clip.audioBuffer;
                    source.connect(trackGain);
                    const startTime = clip.startTime || 0;
                    const offset = clip.offset || 0;
                    source.start(Math.max(0, startTime), offset, clip.duration || projectDuration);
                }
            }
        } else if (track.sequencerPattern?.data) {
            // Render sequencer pattern (MIDI/instrument tracks)
            const pattern = track.sequencerPattern;
            const cols = pattern.data[0]?.length || 16;
            const rows = pattern.data.length;
            const secondsPerStep = 60 / (localAppServices.getTempo?.() || 120) / 4;

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const step = pattern.data[row]?.[col];
                    if (step?.active) {
                        const noteTime = col * secondsPerStep;
                        const noteDuration = (step.duration || 1) * secondsPerStep;
                        const noteGain = offlineContext.createGain();
                        noteGain.gain.value = step.velocity || 0.8;
                        noteGain.connect(trackGain);

                        // Create a simple oscillator for the note
                        const osc = offlineContext.createOscillator();
                        const noteFreq = 440 * Math.pow(2, (row - 69) / 12);
                        osc.frequency.value = noteFreq;
                        osc.connect(noteGain);
                        osc.start(noteTime);
                        osc.stop(noteTime + noteDuration);
                    }
                }
            }
        }

        // Render the audio
        const renderedBuffer = await offlineContext.startRendering();
        
        // Convert to AudioBuffer format for storage
        const audioData = {
            channelData: [],
            sampleRate: renderedBuffer.sampleRate,
            numberOfChannels: renderedBuffer.numberOfChannels,
            duration: renderedBuffer.duration
        };
        
        for (let ch = 0; ch < renderedBuffer.numberOfChannels; ch++) {
            audioData.channelData.push(Array.from(renderedBuffer.getChannelData(ch)));
        }

        // Store frozen data on the track
        track.frozenData = {
            audioData: audioData,
            originalType: track.type,
            originalMuted: track.isMuted,
            originalVolume: track.volume,
            originalClips: track.clips ? JSON.parse(JSON.stringify(track.clips)) : [],
            originalSequencerPattern: track.sequencerPattern ? JSON.parse(JSON.stringify(track.sequencerPattern)) : null,
            frozenAt: new Date().toISOString()
        };

        // Set up frozen playback - replace with buffer source
        track.isFrozen = true;
        track.frozenSource = null;

        console.log('[TrackFreeze] Track', trackId, 'frozen successfully. Duration:', projectDuration, 's');
        localAppServices.showNotification?.(`Track "${track.name}" frozen`, 2000);
        
        // Update UI
        if (localAppServices.updateTrackUI) {
            localAppServices.updateTrackUI(trackId);
        }

        return true;
    } catch (error) {
        console.error('[TrackFreeze] Error freezing track:', error);
        localAppServices.showNotification?.('Error freezing track', 2000);
        return false;
    }
}

/**
 * Defrost a track: restore original audio/instruments
 * @param {number} trackId - The track ID to defrost
 * @returns {boolean} Success
 */
export function defrostTrack(trackId) {
    const track = localAppServices.getTrack?.(trackId);
    if (!track) {
        console.warn('[TrackFreeze] Track not found:', trackId);
        return false;
    }

    if (!track.frozenData) {
        console.warn('[TrackFreeze] Track is not frozen:', trackId);
        return false;
    }

    // Restore original state
    track.type = track.frozenData.originalType;
    track.isMuted = track.frozenData.originalMuted;
    track.volume = track.frozenData.originalVolume;
    track.clips = track.frozenData.originalClips;
    track.sequencerPattern = track.frozenData.originalSequencerPattern;
    track.isFrozen = false;
    track.frozenSource = null;
    
    // Clear frozen data
    const wasFrozen = track.frozenData;
    track.frozenData = null;

    console.log('[TrackFreeze] Track', trackId, 'defrosted successfully');
    localAppServices.showNotification?.(`Track "${track.name}" defrosted`, 2000);
    
    // Update UI
    if (localAppServices.updateTrackUI) {
        localAppServices.updateTrackUI(trackId);
    }

    return true;
}

/**
 * Play frozen track audio (used during playback)
 * @param {number} trackId - The frozen track ID
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration to play
 * @returns {boolean} Success
 */
export function playFrozenTrack(trackId, startTime = 0, duration = null) {
    const track = localAppServices.getTrack?.(trackId);
    if (!track || !track.frozenData) {
        return false;
    }

    if (track.isMuted) {
        return false;
    }

    try {
        // Create audio context if not exists
        let audioContext;
        if (typeof Tone !== 'undefined' && Tone.getContext) {
            audioContext = Tone.getContext().rawContext;
        } else {
            audioContext = new AudioContext();
        }

        const frozenBuffer = track.frozenData.audioData;
        
        // Create buffer for playback
        const buffer = audioContext.createBuffer(
            frozenBuffer.numberOfChannels,
            frozenBuffer.channelData[0].length,
            frozenBuffer.sampleRate
        );
        
        for (let ch = 0; ch < frozenBuffer.numberOfChannels; ch++) {
            buffer.copyToChannel(new Float32Array(frozenBuffer.channelData[ch]), ch);
        }

        // Create and configure source
        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = track.volume ?? 0.7;

        source.connect(gainNode);
        
        // Connect to track output
        if (track.outputNode) {
            gainNode.connect(track.outputNode);
        } else if (track.gainNode) {
            gainNode.connect(track.gainNode);
        } else {
            gainNode.connect(audioContext.destination);
        }

        // Stop existing source if playing
        if (track.frozenSource) {
            try {
                track.frozenSource.stop();
            } catch (e) {}
        }

        track.frozenSource = source;
        
        const playDuration = duration || (frozenBuffer.duration - startTime);
        source.start(0, startTime, playDuration);

        console.log('[TrackFreeze] Playing frozen track', trackId, 'from', startTime, 'for', playDuration, 's');
        return true;
    } catch (error) {
        console.error('[TrackFreeze] Error playing frozen track:', error);
        return false;
    }
}

/**
 * Stop frozen track playback
 * @param {number} trackId - The frozen track ID
 */
export function stopFrozenTrack(trackId) {
    const track = localAppServices.getTrack?.(trackId);
    if (!track || !track.frozenSource) {
        return;
    }

    try {
        track.frozenSource.stop();
        track.frozenSource = null;
    } catch (error) {
        console.error('[TrackFreeze] Error stopping frozen track:', error);
    }
}

/**
 * Get frozen audio data for export
 * @param {number} trackId - The frozen track ID
 * @returns {Object|null} Frozen audio data
 */
export function getFrozenAudioData(trackId) {
    const track = localAppServices.getTrack?.(trackId);
    if (!track || !track.frozenData) {
        return null;
    }
    return track.frozenData.audioData;
}

/**
 * Freeze all tracks with audio content
 * @param {number} duration - Duration in seconds
 * @returns {Promise<number>} Number of tracks frozen
 */
export async function freezeAllTracks(duration = null) {
    const tracks = localAppServices.getTracks?.() || [];
    let frozenCount = 0;

    for (const track of tracks) {
        if (track.type === 'Audio' || track.sequencerPattern?.data) {
            if (await freezeTrack(track.id, duration)) {
                frozenCount++;
            }
        }
    }

    console.log('[TrackFreeze] Froze', frozenCount, 'tracks');
    return frozenCount;
}

/**
 * Defrost all frozen tracks
 * @returns {number} Number of tracks defrosted
 */
export function defrostAllTracks() {
    const tracks = localAppServices.getTracks?.() || [];
    let defrostedCount = 0;

    for (const track of tracks) {
        if (track.frozenData) {
            if (defrostTrack(track.id)) {
                defrostedCount++;
            }
        }
    }

    console.log('[TrackFreeze] Defrosted', defrostedCount, 'tracks');
    return defrostedCount;
}
