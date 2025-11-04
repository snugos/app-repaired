// js/daw/audio/sampleManager.js

// Corrected imports for DB and Constants
import { storeAudio, getAudio } from '/app/js/daw/db.js'; // Corrected path
import * as Constants from '/app/js/daw/constants.js'; // Corrected path

let localAppServices = {};

/**
 * Initializes the sample manager module with the main app services.
 * @param {object} appServices - The main app services object.
 */
export function initializeSampleManager(appServices) {
    localAppServices = appServices;
}

/**
 * Determines the MIME type of an audio file based on its filename extension.
 * @param {string} filename - The name of the file.
 * @returns {string} The detected MIME type, or "application/octet-stream" if unknown.
 */
function getMimeTypeFromFilename(filename) {
    if (!filename || typeof filename !== 'string') return "application/octet-stream";
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith(".wav")) return "audio/wav";
    if (lowerFilename.endsWith(".mp3")) return "audio/mpeg";
    if (lowerFilename.endsWith(".ogg")) return "audio/ogg";
    if (lowerFilename.endsWith(".flac")) return "audio/flac";
    if (lowerFilename.endsWith(".aac")) return "audio/aac";
    if (lowerFilename.endsWith(".m4a")) return "audio/mp4";
    return "application/octet-stream";
}

/**
 * Common logic for loading an audio sample from a File object to a track,
 * storing it in IndexedDB, and initializing the track's instrument/data structures.
 * @param {File} fileObject - The File object representing the audio.
 * @param {string} sourceName - The display name of the sample.
 * @param {object} track - The track object to load the sample into.
 * @param {string} trackTypeHint - The specific type of the track ('Sampler', 'DrumSampler', 'InstrumentSampler').
 * @param {number|null} [padIndex=null] - The index of the drum pad if loading for a DrumSampler.
 */
async function commonLoadSampleLogic(fileObject, sourceName, track, trackTypeHint, padIndex = null) {
    const isReconstructing = localAppServices.getIsReconstructingDAW?.();
    if (!isReconstructing) {
        const targetName = trackTypeHint === 'DrumSampler' && padIndex !== null ? `Pad ${padIndex + 1} on ${track.name}` : track.name;
        localAppServices.captureStateForUndo?.(`Load ${sourceName} to ${targetName}`);
    }

    let objectURLForTone = null;
    try {
        // Create an Object URL for Tone.js to load the audio buffer
        objectURLForTone = URL.createObjectURL(fileObject);
        // Generate a unique key for IndexedDB storage
        const dbKey = `track-${track.id}-${trackTypeHint}-${padIndex ?? ''}-${sourceName}-${fileObject.size}-${fileObject.lastModified}`;
        // Store the file blob in IndexedDB
        await storeAudio(dbKey, fileObject);
        
        // Load the audio buffer using Tone.js
        const newAudioBuffer = await new localAppServices.Tone.Buffer().load(objectURLForTone);

        // Update track-specific data structures and Tone.js instrument
        if (track.instrument && typeof track.instrument.add === 'function') {
            if (trackTypeHint === 'Sampler') {
                // For Slicer Sampler: replace main audio buffer and auto-slice
                track.audioBuffer?.dispose(); // Dispose old buffer if exists
                track.audioBuffer = newAudioBuffer;
                track.samplerAudioData = { fileName: sourceName, dbKey: dbKey, status: 'loaded' };
                
                autoSliceSample(track.id, Constants.numSlices); // Auto-slice the new sample
                // Populate the Tone.Sampler with slices (as separate buffers)
                track.slices.forEach((slice, index) => {
                    const midiNote = Constants.SAMPLER_PIANO_ROLL_START_NOTE + index;
                    const noteName = localAppServices.Tone.Midi(midiNote).toNote();
                    // Create a new buffer for each slice from the main audio buffer
                    const sliceBuffer = new localAppServices.Tone.Buffer().fromArray(track.audioBuffer.getChannelData(0).slice(
                        slice.offset * track.audioBuffer.sampleRate,
                        (slice.offset + slice.duration) * track.audioBuffer.sampleRate
                    ));
                    track.instrument.add(noteName, sliceBuffer); // Add slice buffer to Tone.Sampler
                });
                localAppServices.updateTrackUI?.(track.id, 'samplerLoaded'); // Update UI
            } else if (trackTypeHint === 'DrumSampler' && padIndex !== null) {
                // For Drum Sampler: update specific pad data
                const padData = track.drumSamplerPads[padIndex];
                if (padData) {
                    padData.audioBuffer?.dispose(); // Dispose old buffer if exists
                    padData.audioBuffer = newAudioBuffer;
                    padData.originalFileName = sourceName;
                    padData.dbKey = dbKey;
                    padData.status = 'loaded'; // Add status to padData
                    
                    const midiNote = Constants.DRUM_MIDI_START_NOTE + padIndex;
                    const noteName = localAppServices.Tone.Midi(midiNote).toNote();
                    track.instrument.add(noteName, newAudioBuffer); // Add new buffer to Tone.Sampler
                    localAppServices.updateTrackUI?.(track.id, 'drumPadLoaded', padIndex); // Update UI
                }
            } else if (trackTypeHint === 'InstrumentSampler') {
                // For Instrument Sampler: update main instrument sample
                track.instrumentSamplerSettings.audioBuffer?.dispose(); // Dispose old buffer
                track.instrumentSamplerSettings.audioBuffer = newAudioBuffer;
                track.instrumentSamplerSettings.originalFileName = sourceName;
                track.instrumentSamplerSettings.dbKey = dbKey;
                track.instrumentSamplerSettings.status = 'loaded';
                
                const rootNote = track.instrumentSamplerSettings.rootNote || 'C4';
                track.instrument.add(rootNote, newAudioBuffer); // Add buffer to Tone.Sampler
                localAppServices.updateTrackUI?.(track.id, 'instrumentSamplerLoaded'); // Update UI
            }
        }
        
    } catch (error) {
        console.error(`Error loading sample "${sourceName}":`, error);
        localAppServices.showNotification?.(`Error loading sample: ${error.message}`, 4000);
        // Set status to error if loading failed for the respective sampler type
        if (trackTypeHint === 'Sampler') {
            track.samplerAudioData.status = 'error';
        } else if (trackTypeHint === 'DrumSampler' && padIndex !== null) {
            track.drumSamplerPads[padIndex].status = 'error';
        } else if (trackTypeHint === 'InstrumentSampler') {
            track.instrumentSamplerSettings.status = 'error';
        }
    } finally {
        // Revoke the Object URL once the buffer is loaded by Tone.js to prevent memory leaks
        if (objectURLForTone) URL.revokeObjectURL(objectURLForTone);
    }
}

/**
 * Handles loading an audio file selected by the user for Sampler or InstrumentSampler tracks.
 * @param {Event} event - The change event from the file input.
 * @param {number} trackId - The ID of the target track.
 * @param {string} trackTypeHint - The type of the track ('Sampler' or 'InstrumentSampler').
 */
export async function loadSampleFile(event, trackId, trackTypeHint) {
    const file = event.target.files[0];
    if (!file) return;
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    await commonLoadSampleLogic(file, file.name, track, trackTypeHint);
}

/**
 * Handles loading an audio file selected by the user for a specific DrumSampler pad.
 * @param {Event} event - The change event from the file input.
 * @param {number} trackId - The ID of the target DrumSampler track.
 * @param {number} padIndex - The index of the drum pad to load the file into.
 */
export async function loadDrumSamplerPadFile(event, trackId, padIndex) {
    const file = event.target.files[0];
    if (!file) return;
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) return;
    await commonLoadSampleLogic(file, file.name, track, 'DrumSampler', padIndex);
}

/**
 * Loads a sound from the Sound Browser into a target track (Sampler/DrumSampler/InstrumentSampler).
 * @param {object} soundData - Data describing the sound from the Sound Browser (libraryName, fullPath, fileName).
 * @param {number} targetTrackId - The ID of the track to load the sound into.
 * @param {string} targetType - The type of the target track ('Sampler', 'DrumSampler', 'InstrumentSampler').
 * @param {number|null} targetIndex - The index of the specific pad/slice if applicable (for DrumSampler).
 */
export async function loadSoundFromBrowserToTarget(soundData, targetTrackId, targetType, targetIndex) {
    const track = localAppServices.getTrackById?.(targetTrackId);
    if (!track) return;

    try {
        const fileBlob = await getAudioBlobFromSoundBrowserItem(soundData); // Get the audio blob from sound browser data
        if (!fileBlob) throw new Error("Could not retrieve sample from library.");

        // Construct a File-like object with correct MIME type
        const finalMimeType = getMimeTypeFromFilename(soundData.fileName);
        const blobToLoad = new File([fileBlob], soundData.fileName, { type: finalMimeType });
        // Use common logic to load the sample
        await commonLoadSampleLogic(blobToLoad, soundData.fileName, track, targetType, targetIndex);
    } catch (error) {
        console.error("Error loading from sound browser:", error);
        localAppServices.showNotification?.(`Error loading ${soundData.fileName}: ${error.message}`, 4000);
        // Update UI to reflect load error for the target (e.g., pad, slicer)
        localAppServices.updateTrackUI?.(track.id, 'sampleLoadError', targetIndex);
    }
}

/**
 * Retrieves an audio Blob from a sound browser item, either from IndexedDB (for 'Imports')
 * or from a loaded JSZip instance (for .zip libraries).
 * @param {object} soundData - Data describing the sound (libraryName, fullPath, fileName).
 * @returns {Promise<Blob|null>} A promise that resolves with the audio Blob, or null if not found/error.
 */
export async function getAudioBlobFromSoundBrowserItem(soundData) {
    if (!soundData || !soundData.libraryName || !soundData.fullPath) {
        console.error("[getAudioBlobFromSoundBrowserItem] Invalid soundData provided.", soundData);
        return null;
    }

    try {
        if (soundData.libraryName === 'Imports') {
            // For 'Imports', directly retrieve from IndexedDB
            // Ensure Tone.context is started if it's needed for IndexedDB operations or decoding (which it is)
            await localAppServices.initAudioContextAndMasterMeter(false); 
            return await getAudio(soundData.fullPath); // Use getAudio from db.js
        } else {
            // For .zip libraries, retrieve from the loaded JSZip instance
            const loadedZips = localAppServices.getLoadedZipFiles?.();
            const zipInstance = loadedZips?.[soundData.libraryName]?.zip;
            if (!zipInstance) {
                throw new Error(`Library "${soundData.libraryName}" is not loaded.`);
            }
            
            const zipEntry = zipInstance.file(soundData.fullPath);
            if (!zipEntry) {
                throw new Error(`File "${soundData.fullPath}" not found in library.`);
            }

            return await zipEntry.async("blob"); // Extract blob from zip entry
        }
    } catch (error) {
        console.error(`[getAudioBlob] Error getting blob for ${soundData.fileName}:`, error);
        localAppServices.showNotification?.(`Error loading data for ${soundData.fileName}.`, 3000);
        return null;
    }
}

/**
 * Fetches and processes a sound library (ZIP file), storing its file tree.
 * @param {string} libraryName - The display name of the library.
 * @param {string} zipUrl - The URL of the ZIP file.
 */
export async function fetchSoundLibrary(libraryName, zipUrl) {
    const loadedZips = localAppServices.getLoadedZipFiles?.();
    if (loadedZips[libraryName]?.status === 'loaded' || loadedZips[libraryName]?.status === 'loading') {
        console.log(`[sampleManager.js] Library "${libraryName}" already loaded or loading.`);
        return;
    }

    try {
        localAppServices.setLoadedZipFiles(libraryName, undefined, "loading"); // Set status to loading
        console.log(`[sampleManager.js] Attempting to fetch library: "${zipUrl}"`);

        const response = await fetch(zipUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${zipUrl}`);
        }
        const zipData = await response.arrayBuffer();
        
        console.log(`[sampleManager.js] Downloaded zip data for "${libraryName}". Loading with JSZip...`);
        // JSZip is assumed to be globally available from library.html or main.js
        const jszip = new JSZip(); 
        const loadedZipInstance = await jszip.loadAsync(zipData);
        
        localAppServices.setLoadedZipFiles(libraryName, loadedZipInstance, 'loaded'); // Set status to loaded
        console.log(`[sampleManager.js] Library "${libraryName}" loaded successfully.`);

        const fileTree = {};
        let filesCount = 0;
        // Iterate through zip entries to build a hierarchical file tree
        loadedZipInstance.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return; // Skip directories
            // Only include common audio file extensions
            if (!relativePath.match(/\.(wav|mp3|ogg|flac|aac|m4a)$/i)) return; 

            filesCount++;

            let currentLevel = fileTree;
            const pathParts = relativePath.split('/');
            pathParts.forEach((part, index, arr) => {
                if (index === arr.length - 1) { // It's the file name
                    currentLevel[part] = { type: 'file', fullPath: relativePath, fileName: part };
                } else { // It's a folder
                    currentLevel[part] = currentLevel[part] || { type: 'folder', children: {} };
                    currentLevel = currentLevel[part].children;
                }
            });
        });
        localAppServices.setSoundLibraryFileTrees(libraryName, fileTree); // Store the generated file tree
        console.log(`[sampleManager.js] File tree for "${libraryName}" constructed. Found ${filesCount} audio files.`);

        // After loading, trigger a re-render of the sound browser if it's open
        localAppServices.renderSoundBrowser?.(); 

    } catch (error) {
        console.error(`[sampleManager.js] Error loading library "${libraryName}" from "${zipUrl}":`, error);
        localAppServices.setLoadedZipFiles(libraryName, null, 'error'); // Set status to error
        localAppServices.showNotification?.(`Failed to load library "${libraryName}". Check console for details.`, 5000);
    }
}

/**
 * Automatically slices a loaded sample for a Sampler track into `numSlices` equal parts.
 * @param {number} trackId - The ID of the Sampler track.
 * @param {number} numSlices - The desired number of slices.
 */
export function autoSliceSample(trackId, numSlices) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track || track.type !== 'Sampler' || !track.audioBuffer?.loaded) return;
    const duration = track.audioBuffer.duration;
    if (duration <= 0) return;

    track.slices = []; // Clear existing slices
    const sliceDuration = duration / numSlices;
    for (let i = 0; i < numSlices; i++) {
        track.slices.push({
            offset: i * sliceDuration,
            duration: sliceDuration,
            volume: 0.7,
            pitchShift: 0,
            loop: false,
            reverse: false,
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.2 } // Default envelope for slices
        });
    }
    track.selectedSliceForEdit = 0; // Select the first slice for editing by default
    localAppServices.updateTrackUI?.(track.id, 'sampleSliced'); // Update UI
}