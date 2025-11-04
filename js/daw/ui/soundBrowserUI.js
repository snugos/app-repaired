// js/daw/ui/soundBrowserUI.js - Sound Browser UI Management

// Corrected imports for state modules
import { getLoadedZipFiles, setLoadedZipFiles, getSoundLibraryFileTrees, setSoundLibraryFileTrees, getCurrentLibraryName, setCurrentLibraryName, getCurrentSoundBrowserPath, setCurrentSoundBrowserPath, getPreviewPlayer, setPreviewPlayer, addFileToSoundLibrary } from '/app/js/daw/state/soundLibraryState.js'; // Corrected path
import { getWindowById } from '/app/js/daw/state/windowState.js'; // Corrected path
import { getArmedTrackId } from '/app/js/daw/state/trackState.js'; // Corrected path
// Corrected import for Constants and DB
import * as Constants from '/app/js/daw/constants.js'; // Corrected path
import { storeAudio, getAudio } from '/app/js/daw/db.js'; // Corrected path

let localAppServices = {}; //
let selectedSoundForPreviewData = null; //

const FOLDER_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
</svg>`; //

const FILE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
  <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
  <path d="M5.5 9.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2zM12.5 9.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2z" />
  <path d="M5 10a1 1 0 00-1 1v1a1 1 0 001 1h1.5a.5.5 0 010 1H5a2 2 0 01-2-2v-1a2 2 0 012-2h1.5a.5.5 0 010 1H5zM15 10a1 1 0 011 1v1a1 1 0 01-1 1h-1.5a.5.5 0 000 1H15a2 2 0 002-2v-1a2 2 0 00-2-2h-1.5a.5.5 0 000 1H15z" />
</svg>`; //


export function initializeSoundBrowserUI(appServicesFromMain) { //
    localAppServices = appServicesFromMain; //
}

export function renderSoundBrowser(pathToRender) { //
    const browserWindow = localAppServices.getWindowById?.('soundBrowser'); //
    if (!browserWindow?.element || browserWindow.isMinimized) { //
        return; //
    }

    const currentPath = pathToRender !== undefined ? pathToRender : (getCurrentSoundBrowserPath() || []); //
    
    // Reset selected sound when rendering, unless specifically instructed otherwise for a targeted re-render
    selectedSoundForPreviewData = null; 

    const allFileTrees = getSoundLibraryFileTrees() || {}; //
    
    const virtualRoot = {}; //
    virtualRoot['Imports'] = { type: 'folder', children: allFileTrees['Imports'] || {} }; //
    Object.keys(Constants.soundLibraries).forEach(libName => { //
        if (allFileTrees[libName]) { //
            virtualRoot[libName] = { type: 'folder', children: allFileTrees[libName] }; //
        } else {
            const loadedZips = getLoadedZipFiles() || {}; //
            virtualRoot[libName] = {
                type: 'placeholder', //
                status: loadedZips[libName]?.status || 'pending', //
                displayName: `${libName} (${loadedZips[libName]?.status || 'loading...'})` //
            };
        }
    });
    
    let currentTreeNode = virtualRoot; //
    try { //
        for (const part of currentPath) { //
            if (currentTreeNode[part] && currentTreeNode[part].type === 'folder') { //
                currentTreeNode = currentTreeNode[part].children; //
            } else {
                throw new Error(`Invalid path segment: ${part}`); //
            }
        }
    } catch (e) { //
        setCurrentSoundBrowserPath([]); //
        currentTreeNode = virtualRoot; //
        console.warn(`[SoundBrowserUI] Resetting path due to invalid segment: ${e.message}`);
    }
    
    renderDirectoryView(currentPath, currentTreeNode); //
    // After rendering, ensure preview button state is updated based on `selectedSoundForPreviewData`
    const previewBtn = browserWindow.element.querySelector('#soundBrowserPreviewBtn');
    if (previewBtn) {
        previewBtn.disabled = !selectedSoundForPreviewData;
    }
}

function getLibraryNameFromPath(pathArray) { //
    if (pathArray.length > 0) { //
        if (pathArray[0] === 'Imports') return 'Imports'; //
        return Object.keys(Constants.soundLibraries).find(lib => pathArray[0] === lib) || null; //
    }
    return null; //
}

export function openSoundBrowserWindow(savedState = null) { //
    const windowId = 'soundBrowser'; //
    const openWindows = localAppServices.getOpenWindows?.() || new Map(); //

    if (openWindows.has(windowId) && !savedState) { //
        localAppServices.getWindowById(windowId).restore(); //
        return localAppServices.getWindowById(windowId); //
    }
    
    const contentHTML = `
        <div class="flex flex-col h-full text-sm bg-white dark:bg-black text-black dark:text-white">
            <div class="p-1 border-b border-black dark:border-white flex items-center space-x-2">
                <h3 class="font-bold px-2 flex-grow">Sound Library</h3>
                <button id="soundBrowserPreviewBtn" class="px-2 py-1 text-xs border rounded bg-black text-white border-black hover:bg-white hover:text-black dark:bg-white dark:text-black dark:border-white dark:hover:bg-black dark:hover:text-white disabled:opacity-50" disabled>Preview</button>
            </div>
            <div id="soundBrowserPathDisplay" class="p-1 text-xs bg-white dark:bg-black border-b border-black dark:border-white truncate">/</div>
            <div id="soundBrowserDirectoryView" class="flex-grow overflow-auto p-1">
                <p class="text-black dark:text-white italic">Initializing libraries...</p>
            </div>
        </div>`; //

    const browserOptions = { width: 350, height: 500 }; //
    if (savedState) Object.assign(browserOptions, savedState); //

    const browserWindow = localAppServices.createWindow(windowId, 'Sound Browser', contentHTML, browserOptions); //

    if (browserWindow?.element) { //
        const previewBtn = browserWindow.element.querySelector('#soundBrowserPreviewBtn'); //
        
        Object.entries(Constants.soundLibraries || {}).forEach(([name, url]) => { //
            localAppServices.fetchSoundLibrary?.(name, url) //
                .then(() => renderSoundBrowser()) //
                .catch(error => console.error(`Failed to load library ${name}:`, error)); //
        });

        renderSoundBrowser(); //
        
        previewBtn?.addEventListener('click', async () => { //
            if (selectedSoundForPreviewData) { //
                try {
                    const blob = await localAppServices.getAudioBlobFromSoundBrowserItem(selectedSoundForPreviewData); //
                    if (blob) { // Check if blob is valid
                        let previewPlayer = getPreviewPlayer(); //
                        if (!previewPlayer) { //
                            previewPlayer = new localAppServices.Tone.Player().toDestination(); //
                            setPreviewPlayer(previewPlayer); //
                        }
                        // Stop any currently playing preview and load new one
                        if (previewPlayer.state === 'started') {
                            previewPlayer.stop();
                        }
                        // Use URL.createObjectURL for blob directly
                        const objectURL = URL.createObjectURL(blob);
                        await previewPlayer.load(objectURL);
                        previewPlayer.start();
                        // Revoke the Object URL after the buffer is loaded and started
                        // This might be tricky if the player instance is reused. 
                        // For simplicity, we'll revoke after a short delay, assuming Tone.js handles buffer internally.
                        setTimeout(() => URL.revokeObjectURL(objectURL), 1000); 
                    } else { // New: Handle invalid blob
                        localAppServices.showNotification?.("Could not retrieve preview audio.", "error"); //
                    }
                } catch (err) { //
                    localAppServices.showNotification("Error playing preview.", "error"); //
                    console.error("Preview Error:", err); //
                }
            }
        });
    }
    return browserWindow; //
}

export function renderDirectoryView(pathArray, treeNode) { //
    const browserWindow = localAppServices.getWindowById?.('soundBrowser'); //
    if (!browserWindow?.element || browserWindow.isMinimized) { //
        return; //
    }

    const dirView = browserWindow.element.querySelector('#soundBrowserDirectoryView'); //
    const pathDisplay = browserWindow.element.querySelector('#soundBrowserPathDisplay'); //
    const previewBtn = browserWindow.element.querySelector('#soundBrowserPreviewBtn'); //
    
    if (!dirView || !pathDisplay) return; //

    dirView.innerHTML = ''; //
    pathDisplay.textContent = `/${pathArray.join('/')}`; //
    // Disable preview button by default until a new sound is selected
    if (previewBtn) previewBtn.disabled = true; //

    if (pathArray.length > 0) { //
        const parentDiv = document.createElement('div'); //
        parentDiv.className = 'p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer rounded flex items-center'; //
        parentDiv.innerHTML = `<span class="mr-2 text-lg font-bold text-black dark:text-white">↩</span> .. (Parent)`; //
        parentDiv.addEventListener('click', () => { //
            const newPath = pathArray.slice(0, -1); //
            setCurrentSoundBrowserPath(newPath); //
            renderSoundBrowser(newPath); //
        });
        dirView.appendChild(parentDiv); //
    }

    // Sort entries: folders first, then files, both alphabetically
    const entries = Object.entries(treeNode || {}).sort((a, b) => { //
        const aIsFolder = a[1].type === 'folder' || a[1].type === 'placeholder'; //
        const bIsFolder = b[1].type === 'folder' || b[1].type === 'placeholder'; //

        if (aIsFolder && !bIsFolder) return -1; //
        if (!aIsFolder && bIsFolder) return 1; //
        
        // For placeholders, use displayName for sorting, otherwise use name
        const nameA = a[1].displayName || a[0]; //
        const nameB = b[1].displayName || b[0]; //

        return nameA.localeCompare(nameB); //
    });

    entries.forEach(([name, item]) => { //
        const itemDiv = document.createElement('div'); //
        itemDiv.className = 'p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer rounded flex items-center'; //
        itemDiv.title = item.displayName || name; //

        const icon = document.createElement('span'); //
        icon.className = 'mr-2 flex-shrink-0 text-black dark:text-white'; //
        icon.innerHTML = item.type === 'folder' || item.type === 'placeholder' ? FOLDER_ICON_SVG : FILE_ICON_SVG; //

        const nameSpan = document.createElement('span'); //
        nameSpan.className = 'truncate'; //
        nameSpan.textContent = item.displayName || name; //

        itemDiv.appendChild(icon); //
        itemDiv.appendChild(nameSpan); //

        if (item.type === 'folder') { //
            itemDiv.addEventListener('click', () => { //
                const newPath = [...pathArray, name]; //
                setCurrentSoundBrowserPath(newPath); //
                renderSoundBrowser(newPath); //
            });
        } else if (item.type === 'file') { //
            itemDiv.draggable = true; //
            itemDiv.addEventListener('dragstart', (e) => { //
                const libraryName = getLibraryNameFromPath(pathArray); //
                if (!libraryName) { e.preventDefault(); return; } //
                const dragData = { type: 'sound-browser-item', libraryName, fullPath: item.fullPath, fileName: name }; //
                e.dataTransfer.setData('application/json', JSON.stringify(dragData)); //
                e.dataTransfer.effectAllowed = 'copy'; //
            });
            itemDiv.addEventListener('click', () => { //
                // Remove selection from all items
                dirView.querySelectorAll('.bg-black.text-white, .dark\\:bg-white.dark\\:text-black').forEach(el => { //
                    el.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black'); //
                });
                // Add selection to clicked item
                itemDiv.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black'); //
                const libraryName = getLibraryNameFromPath(pathArray); //
                selectedSoundForPreviewData = { libraryName, fullPath: item.fullPath, fileName: name }; //
                if (previewBtn) previewBtn.disabled = false; // Enable preview button
            });
            itemDiv.addEventListener('dblclick', () => { //
                const armedTrackId = getArmedTrackId(); //
                const armedTrack = armedTrackId !== null ? localAppServices.getTrackById?.(armedTrackId) : null; //

                if (armedTrack) { //
                    const soundData = { libraryName: getLibraryNameFromPath(pathArray), fullPath: item.fullPath, fileName: name }; //
                    let targetIndex = null; //
                    if (armedTrack.type === 'DrumSampler') targetIndex = armedTrack.selectedDrumPadForEdit; //
                    localAppServices.loadSoundFromBrowserToTarget?.(soundData, armedTrack.id, armedTrack.type, targetIndex); //
                } else {
                    localAppServices.showNotification(`No compatible track armed to load "${name}". Arm a sampler track first.`, 2500); //
                }
            });
        } else if (item.type === 'placeholder') { //
            itemDiv.classList.add('opacity-50', 'cursor-not-allowed'); //
            itemDiv.title = item.status === 'error' ? `Error loading ${name}` : `Loading ${name}...`; //
        }
        dirView.appendChild(itemDiv); //
    });
}