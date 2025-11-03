// js/ui/soundBrowserUI.js - Sound Browser UI Management
import * as Constants from '../constants.js';
import { showNotification } from '../utils.js';

let localAppServices = {};
let selectedSoundForPreviewData = null; 

const FOLDER_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
</svg>`;

const FILE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5">
  <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
  <path d="M5.5 9.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2zM12.5 9.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-2a.5.5 0 01-.5-.5v-2z" />
  <path d="M5 10a1 1 0 00-1 1v1a1 1 0 001 1h1.5a.5.5 0 010 1H5a2 2 0 01-2-2v-1a2 2 0 012-2h1.5a.5.5 0 010 1H5zM15 10a1 1 0 011 1v1a1 1 0 01-1 1h-1.5a.5.5 0 000 1H15a2 2 0 002-2v-1a2 2 0 00-2-2h-1.5a.5.5 0 000 1H15z" />
</svg>`;


export function initializeSoundBrowserUI(appServicesFromMain) {
    localAppServices = appServicesFromMain;
}

export function renderSoundBrowser(pathToRender) {
    const browserWindow = localAppServices.getWindowById?.('soundBrowser');
    if (!browserWindow?.element || browserWindow.isMinimized) {
        return;
    }

    const currentPath = pathToRender !== undefined ? pathToRender : (localAppServices.getCurrentSoundBrowserPath?.() || []);
    
    const allFileTrees = localAppServices.getSoundLibraryFileTrees?.() || {};
    
    const virtualRoot = {};
    virtualRoot['Imports'] = { type: 'folder', children: allFileTrees['Imports'] || {} };
    Object.keys(Constants.soundLibraries).forEach(libName => {
        if (allFileTrees[libName]) {
            virtualRoot[libName] = { type: 'folder', children: allFileTrees[libName] };
        } else {
            const loadedZips = localAppServices.getLoadedZipFiles?.() || {};
            virtualRoot[`${libName} (${loadedZips[libName]?.status || 'loading...'})`] = { type: 'placeholder' };
        }
    });
    
    let currentTreeNode = virtualRoot;
    try {
        for (const part of currentPath) {
            if (currentTreeNode[part] && currentTreeNode[part].type === 'folder') {
                currentTreeNode = currentTreeNode[part].children;
            } else {
                throw new Error(`Invalid path segment: ${part}`);
            }
        }
    } catch (e) {
        localAppServices.setCurrentSoundBrowserPath?.([]);
        currentTreeNode = virtualRoot;
    }
    
    renderDirectoryView(currentPath, currentTreeNode);
}

function getLibraryNameFromPath(pathArray) {
    if (pathArray.length > 0) {
        if (pathArray[0] === 'Imports') return 'Imports';
        return Object.keys(Constants.soundLibraries).find(lib => pathArray[0] === lib) || null;
    }
    return null;
}

export function openSoundBrowserWindow(savedState = null) {
    const windowId = 'soundBrowser';
    const openWindows = localAppServices.getOpenWindows?.() || new Map();

    if (openWindows.has(windowId) && !savedState) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
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
        </div>`;

    // --- FIX: Apply savedState to options object ---
    const browserOptions = { width: 350, height: 500 };
    if (savedState) Object.assign(browserOptions, savedState);

    const browserWindow = localAppServices.createWindow(windowId, 'Sound Browser', contentHTML, browserOptions);

    if (browserWindow?.element) {
        const previewBtn = browserWindow.element.querySelector('#soundBrowserPreviewBtn');
        
        Object.entries(Constants.soundLibraries || {}).forEach(([name, url]) => {
            localAppServices.fetchSoundLibrary?.(name, url).then(() => renderSoundBrowser());
        });

        renderSoundBrowser();
        
        previewBtn?.addEventListener('click', async () => {
            if (selectedSoundForPreviewData) {
                try {
                    const blob = await localAppServices.getAudioBlobFromSoundBrowserItem(selectedSoundForPreviewData);
                    if (blob) {
                        let previewPlayer = localAppServices.getPreviewPlayer();
                        if (!previewPlayer) {
                            previewPlayer = new Tone.Player().toDestination();
                            localAppServices.setPreviewPlayer(previewPlayer);
                        }
                        const objectURL = URL.createObjectURL(blob);
                        await previewPlayer.load(objectURL);
                        previewPlayer.start();
                    }
                } catch (err) {
                    showNotification("Error playing preview.", "error");
                    console.error("Preview Error:", err);
                }
            }
        });
    }
    return browserWindow;
}

export function renderDirectoryView(pathArray, treeNode) {
    const browserWindow = localAppServices.getWindowById?.('soundBrowser');
    if (!browserWindow?.element) return;

    const dirView = browserWindow.element.querySelector('#soundBrowserDirectoryView');
    const pathDisplay = browserWindow.element.querySelector('#soundBrowserPathDisplay');
    const previewBtn = browserWindow.element.querySelector('#soundBrowserPreviewBtn');
    
    if (!dirView || !pathDisplay) return;

    dirView.innerHTML = '';
    pathDisplay.textContent = `/${pathArray.join('/')}`;
    if (previewBtn) previewBtn.disabled = true;

    if (pathArray.length > 0) {
        const parentDiv = document.createElement('div');
        parentDiv.className = 'p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer rounded flex items-center';
        parentDiv.innerHTML = `<span class="mr-2 text-lg font-bold text-black dark:text-white">↩</span> .. (Parent)`;
        parentDiv.addEventListener('click', () => {
            const newPath = pathArray.slice(0, -1);
            localAppServices.setCurrentSoundBrowserPath?.(newPath);
            renderSoundBrowser(newPath);
        });
        dirView.appendChild(parentDiv);
    }

    const entries = Object.entries(treeNode || {}).sort((a, b) => {
        const aIsDir = a[1].type === 'folder';
        const bIsDir = b[1].type === 'folder';
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a[0].localeCompare(b[0]);
    });

    entries.forEach(([name, item]) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'p-1 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer rounded flex items-center';
        itemDiv.title = name;

        const icon = document.createElement('span');
        icon.className = 'mr-2 flex-shrink-0 text-black dark:text-white';
        icon.innerHTML = item.type === 'folder' ? FOLDER_ICON_SVG : FILE_ICON_SVG;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'truncate';
        nameSpan.textContent = name;

        itemDiv.appendChild(icon);
        itemDiv.appendChild(nameSpan);

        if (item.type === 'folder') {
            itemDiv.addEventListener('click', () => {
                const newPath = [...pathArray, name];
                localAppServices.setCurrentSoundBrowserPath?.(newPath);
                renderSoundBrowser(newPath);
            });
        } else if (item.type === 'file') {
            itemDiv.draggable = true;
            itemDiv.addEventListener('dragstart', (e) => {
                const libraryName = getLibraryNameFromPath(pathArray);
                if (!libraryName) { e.preventDefault(); return; }
                const dragData = { type: 'sound-browser-item', libraryName, fullPath: item.fullPath, fileName: name };
                e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                e.dataTransfer.effectAllowed = 'copy';
            });
            itemDiv.addEventListener('click', () => {
                dirView.querySelectorAll('.bg-black.text-white, .dark\\:bg-white.dark\\:text-black').forEach(el => {
                    el.classList.remove('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
                });
                itemDiv.classList.add('bg-black', 'text-white', 'dark:bg-white', 'dark:text-black');
                const libraryName = getLibraryNameFromPath(pathArray);
                selectedSoundForPreviewData = { libraryName, fullPath: item.fullPath, fileName: name };
                if (previewBtn) previewBtn.disabled = false;
            });
            itemDiv.addEventListener('dblclick', () => {
                const armedTrackId = localAppServices.getArmedTrackId?.();
                const armedTrack = armedTrackId !== null ? localAppServices.getTrackById?.(armedTrackId) : null;

                if (armedTrack) {
                    const soundData = { libraryName: getLibraryNameFromPath(pathArray), fullPath: item.fullPath, fileName: name };
                    let targetIndex = null;
                    if (armedTrack.type === 'DrumSampler') targetIndex = armedTrack.selectedDrumPadForEdit;
                    localAppServices.loadSoundFromBrowserToTarget?.(soundData, armedTrack.id, armedTrack.type, targetIndex);
                } else {
                    showNotification(`No compatible track armed to load "${name}". Arm a sampler track first.`, 2500);
                }
            });
        }
        dirView.appendChild(itemDiv);
    });
}
