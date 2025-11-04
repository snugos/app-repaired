// js/daw/state/windowState.js

// No direct imports to correct here as it only uses localAppServices and local variables

let openWindowsMap = new Map(); // Stores active SnugWindow instances by their ID
let highestZ = 100; // Tracks the highest z-index assigned to a window
let localAppServices = {}; // Reference to the main appServices object

/**
 * Initializes the window state module.
 * @param {object} appServices - The main app services object.
 */
export function initializeWindowState(appServices) { //
    localAppServices = appServices; //
}

/**
 * Gets the Map of currently open SnugWindow instances.
 * @returns {Map<string, SnugWindow>} A Map where keys are window IDs and values are SnugWindow instances.
 */
export function getOpenWindows() { //
    return openWindowsMap; //
}

/**
 * Gets a specific SnugWindow instance by its ID.
 * @param {string} id - The ID of the window to retrieve.
 * @returns {SnugWindow|undefined} The SnugWindow instance, or undefined if not found.
 */
export function getWindowById(id) { //
    return openWindowsMap.get(id); //
}

/**
 * Adds a SnugWindow instance to the store of open windows.
 * @param {string} id - The ID of the window.
 * @param {SnugWindow} windowInstance - The SnugWindow instance to add.
 */
export function addWindowToStore(id, windowInstance) { //
    openWindowsMap.set(id, windowInstance); //
}

/**
 * Removes a SnugWindow instance from the store of open windows.
 * @param {string} id - The ID of the window to remove.
 */
export function removeWindowFromStore(id) { //
    openWindowsMap.delete(id); //
}

/**
 * Gets the current highest z-index value.
 * @returns {number} The highest z-index.
 */
export function getHighestZ() { //
    return highestZ; //
}

/**
 * Sets the highest z-index value.
 * @param {number} z - The new highest z-index.
 */
export function setHighestZ(z) { //
    highestZ = z; //
}

/**
 * Increments the highest z-index value and returns the new value.
 * This is typically called when a window is focused to bring it to the front.
 * @returns {number} The new highest z-index.
 */
export function incrementHighestZ() { //
    return ++highestZ; //
}

/**
 * Serializes the state of all open windows.
 * @returns {Array<Object>} An array of serialized window states.
 */
export function serializeWindows() {
    const serialized = [];
    openWindowsMap.forEach((windowInstance) => {
        if (windowInstance && windowInstance.id) {
            const windowState = windowInstance.getWindowState();
            serialized.push({
                id: windowInstance.id,
                title: windowInstance.title,
                initialContentKey: windowInstance.initialContentKey, // Helps re-identify content
                savedState: windowState,
                // Add any other properties needed to reconstruct the window
            });
        }
    });
    return serialized;
}

/**
 * Reconstructs windows from a serialized state.
 * @param {Array<Object>} serializedWindows - An array of serialized window states.
 */
export function reconstructWindows(serializedWindows) {
    // Close all currently open windows first to avoid duplicates or conflicts
    // Create a copy of the map keys to iterate safely while modifying the map
    Array.from(openWindowsMap.keys()).forEach(windowId => {
        const windowInstance = openWindowsMap.get(windowId);
        if (windowInstance) {
            // Pass true to `isSilent` to avoid triggering onCloseCallback for every window
            windowInstance.close(true); 
        }
    });
    
    // Reconstruct windows based on the saved state
    serializedWindows.forEach(windowData => {
        const { id, title, initialContentKey, savedState } = windowData;
        let contentElement = null; // Content needs to be generated based on initialContentKey
        
        // This is a simplified example. In a real app, you'd have a mapping
        // from initialContentKey to a function that generates the content HTML/DOM.
        // For now, let's assume `initialContentKey` can be used to trigger
        // the correct `openXWindow` function from `appServices`.

        // Example:
        switch (initialContentKey) {
            case 'mixer':
                localAppServices.openMixerWindow(savedState);
                break;
            case 'masterEffectsRack':
                localAppServices.openMasterEffectsRackWindow(savedState);
                break;
            case 'soundBrowser':
                localAppServices.openSoundBrowserWindow(savedState);
                break;
            case 'youtubeImporter':
                localAppServices.openYouTubeImporterWindow(savedState);
                break;
            case 'libraryApp': // Added case for the Library App
                localAppServices.openEmbeddedAppInWindow(id, title, `/app/js/daw/profiles/library.html`, savedState); // CORRECTED PATH
                break;
            case `profile-${id.split('-')[1]}`: // Case for Profile App (e.g., profile-snaw)
                localAppServices.openEmbeddedAppInWindow(id, title, `/app/js/daw/profiles/profile.html?user=${id.split('-')[1]}`, savedState); // CORRECTED PATH
                break;

               case 'tetrisGame': // NEW CASE
    localAppServices.openEmbeddedAppInWindow(id, title, `/app/tetris.html`, savedState); // Correct path for tetris.html
    break;
            // Add other window types here
            default:
                // Handle track-specific windows (Inspector, Effects Rack, Piano Roll)
                if (initialContentKey.startsWith('trackInspector-')) {
                    const trackId = parseInt(initialContentKey.split('-')[1]);
                    localAppServices.openTrackInspectorWindow(trackId, savedState);
                } else if (initialContentKey.startsWith('effectsRack-')) {
                    const trackId = parseInt(initialContentKey.split('-')[1]);
                    localAppServices.openTrackEffectsRackWindow(trackId, savedState);
                } else if (initialContentKey.startsWith('pianoRollWin-')) {
                    const trackId = parseInt(initialContentKey.split('-')[1]);
                    // Piano roll might need active sequence ID to restore correctly
                    localAppServices.openPianoRollWindow(trackId, null, savedState); 
                } else if (initialContentKey.startsWith('fileViewer-')) {
                    // File viewer might need the actual fileItem to reconstruct correctly
                    // This is complex as fileItem is not saved in project data.
                    // A more robust solution would be to save just the file ID and fetch it.
                    console.warn(`Cannot reconstruct fileViewer window '${id}' automatically.`);
                } else {
                    console.warn(`Unknown window type for reconstruction: ${initialContentKey}`);
                    // Fallback: create a generic window if content is needed
                    contentElement = document.createElement('div');
                    contentElement.innerHTML = `<p class="p-4">Content for '${title}' could not be reloaded.</p>`;
                    localAppServices.createWindow(id, title, contentElement, savedState);
                }
                break;
        }

        // After window creation, ensure its Z-index and minimized/maximized state are restored
        const newWindowInstance = openWindowsMap.get(id);
        if (newWindowInstance) {
            if (savedState.isMinimized) {
                newWindowInstance.minimize(true); // Silent minimize
            }
            if (savedState.isMaximized) {
                newWindowInstance.toggleMaximize(); // This should use internal restore state
            }
            // Ensure focus brings it to front with correct Z-index
            newWindowInstance.focus(); 
        }
    });
    
    // After all windows are reconstructed, set the highest Z-index
    const maxZ = Array.from(openWindowsMap.values()).reduce((max, win) => {
        return Math.max(max, parseInt(win.element.style.zIndex || 0));
    }, 100);
    setHighestZ(maxZ);
}