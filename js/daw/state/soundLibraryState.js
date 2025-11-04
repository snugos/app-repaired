// js/daw/state/soundLibraryState.js

// Corrected import path for DB
import { storeAudio as dbStoreAudio, getAudio as dbGetAudio } from '/app/js/daw/db.js'; // Corrected path

let loadedZipFiles = {}; // Stores loaded JSZip instances and their status
let soundLibraryFileTrees = {}; // Stores the hierarchical view of files within each library (excluding actual audio data)
let currentLibraryName = null; // The name of the currently active library in the browser UI
let currentSoundBrowserPath = []; // The current path within the selected library
let previewPlayer = null; // Tone.js Player instance used for previewing sounds

let localAppServices = {}; // Reference to the main appServices object

/**
 * Initializes the sound library state module.
 * @param {object} appServices - The main app services object.
 */
export function initializeSoundLibraryState(appServices) { //
    localAppServices = appServices; //
}

/**
 * Gets the status and JSZip instances of loaded libraries.
 * @returns {object} An object mapping library names to their loaded status and zip instance.
 */
export function getLoadedZipFiles() { //
    return loadedZipFiles; //
}

/**
 * Sets the loaded status and/or JSZip instance for a given library.
 * @param {string} name - The name of the library.
 * @param {JSZip|null} zip - The JSZip instance for the library, or null if not yet loaded.
 * @param {string} status - The loading status ('pending', 'loading', 'loaded', 'error').
 */
export function setLoadedZipFiles(name, zip, status) { //
    if (!loadedZipFiles[name]) { //
        loadedZipFiles[name] = {}; //
    }
    if (zip !== undefined) { // Only update if zip is explicitly provided
        loadedZipFiles[name].zip = zip; //
    }
    if (status !== undefined) { // Only update if status is explicitly provided
        loadedZipFiles[name].status = status; //
    }
}

/**
 * Gets the hierarchical file trees for all loaded sound libraries.
 * @returns {object} An object mapping library names to their file trees.
 */
export function getSoundLibraryFileTrees() { //
    return soundLibraryFileTrees; //
}

/**
 * Sets the file tree for a given sound library.
 * @param {string} libraryName - The name of the library.
 * @param {object} tree - The hierarchical file tree object.
 */
export function setSoundLibraryFileTrees(libraryName, tree) { //
    soundLibraryFileTrees[libraryName] = tree; //
}

/**
 * Gets the name of the currently selected library in the sound browser.
 * @returns {string|null} The current library name.
 */
export function getCurrentLibraryName() { //
    return currentLibraryName; //
}

/**
 * Sets the name of the currently selected library in the sound browser.
 * @param {string} name - The new current library name.
 */
export function setCurrentLibraryName(name) { //
    currentLibraryName = name; //
}

/**
 * Gets the current path being viewed in the sound browser.
 * @returns {string[]} An array of path segments.
 */
export function getCurrentSoundBrowserPath() { //
    return currentSoundBrowserPath; //
}

/**
 * Sets the current path being viewed in the sound browser.
 * @param {string[]} path - An array of path segments.
 */
export function setCurrentSoundBrowserPath(path) { //
    currentSoundBrowserPath = path; //
}

/**
 * Gets the Tone.js Player instance used for sound previews.
 * @returns {Tone.Player|null} The preview player instance.
 */
export function getPreviewPlayer() { //
    return previewPlayer; //
}

/**
 * Sets the Tone.js Player instance used for sound previews, disposing of any existing one.
 * @param {Tone.Player} player - The new preview player instance.
 */
export function setPreviewPlayer(player) { //
    if (previewPlayer && typeof previewPlayer.dispose === 'function') { //
        previewPlayer.dispose(); //
    }
    previewPlayer = player; //
}

/**
 * Adds a new file to the 'Imports' sound library, storing its blob in IndexedDB.
 * Note: This currently just stores the audio. A more complete implementation would
 * also update the `soundLibraryFileTrees['Imports']` structure dynamically.
 * @param {string} fileName - The name of the file.
 * @param {Blob} fileBlob - The Blob object of the file.
 * @returns {Promise<void>} A promise that resolves when the file is stored.
 */
export async function addFileToSoundLibrary(fileName, fileBlob) { //
    console.log(`Adding ${fileName} to sound library.`); //
    // Generate a unique key for IndexedDB
    const dbKey = `imports/${fileName}-${fileBlob.size}-${Date.now()}`; //
    await dbStoreAudio(dbKey, fileBlob); //
    // After storing, update the in-memory file tree for 'Imports'
    let importsTree = soundLibraryFileTrees['Imports'] || {}; //
    let currentLevel = importsTree; //
    const pathParts = ['/']; // Assuming imports are always at the root of 'Imports' library
    const fullPath = `/${fileName}`; // Construct a fullPath for the file in the virtual tree

    // Ensure the path structure exists
    pathParts.forEach(part => { //
        if (!currentLevel[part]) { //
            currentLevel[part] = { type: 'folder', children: {} }; //
        }
        currentLevel = currentLevel[part].children; //
    });

    // Add the file itself
    currentLevel[fileName] = { type: 'file', fullPath: fullPath, fileName: fileName }; //
    soundLibraryFileTrees['Imports'] = importsTree; // Update the global state

    localAppServices.renderSoundBrowser?.(); // Re-render the browser to show the new file
}