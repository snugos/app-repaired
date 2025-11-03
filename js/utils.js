// js/utils.js - Utility Functions Module

export function showNotification(message, duration = 3000) {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) {
        console.warn("Notification area not found. Message:", message);
        return;
    }
    const notification = document.createElement('div');
    notification.className = 'notification-message';
    notification.textContent = message;
    notificationArea.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentElement) {
                notificationArea.removeChild(notification);
            }
        }, 300);
    }, duration);
}

export function showCustomModal(title, contentHTML, buttonsConfig, modalClass = '') {
    const modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) {
        console.error("Modal container not found!");
        return null;
    }

    if (modalContainer.firstChild) {
        modalContainer.firstChild.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const dialog = document.createElement('div');
    dialog.className = `modal-dialog ${modalClass}`;

    const titleBar = document.createElement('div');
    titleBar.className = 'modal-title-bar';
    titleBar.textContent = title || 'Dialog';
    dialog.appendChild(titleBar);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'modal-content';
    if (typeof contentHTML === 'string') {
        contentDiv.innerHTML = contentHTML;
    } else if (contentHTML instanceof HTMLElement) {
        contentDiv.appendChild(contentHTML);
    }
    dialog.appendChild(contentDiv);

    if (buttonsConfig && buttonsConfig.length > 0) {
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'modal-buttons';
        buttonsConfig.forEach(btnConfig => {
            const button = document.createElement('button');
            button.textContent = btnConfig.text;
            button.onclick = () => {
                if (btnConfig.action) btnConfig.action();
                if (btnConfig.closesModal !== false) overlay.remove();
            };
            buttonsDiv.appendChild(button);
        });
        dialog.appendChild(buttonsDiv);
    }

    overlay.appendChild(dialog);
    modalContainer.appendChild(overlay);

    const firstButton = dialog.querySelector('.modal-buttons button');
    if (firstButton) firstButton.focus();

    return { overlay, dialog, contentDiv };
}


export function showConfirmationDialog(title, message, onConfirm, onCancel = null) {
    const buttons = [
        { text: 'OK', action: onConfirm },
        { text: 'Cancel', action: onCancel }
    ];
    showCustomModal(title, `<p>${message}</p>`, buttons);
}


export function createDropZoneHTML(trackId, inputId, trackTypeHintForLoad, padOrSliceIndex = null, existingAudioData = null) {
    const indexString = (padOrSliceIndex !== null && padOrSliceIndex !== undefined) ? `-${padOrSliceIndex}` : '';
    const dropZoneId = `dropZone-${trackId}-${trackTypeHintForLoad.toLowerCase()}${indexString}`;

    let dataAttributes = `data-track-id="${trackId}" data-track-type="${trackTypeHintForLoad}"`;
    if (padOrSliceIndex !== null && padOrSliceIndex !== undefined) {
        dataAttributes += ` data-pad-slice-index="${padOrSliceIndex}"`;
    }

    let currentFileText = 'Drag & Drop Audio File or <br>';
    let relinkButtonHTML = '';
    let statusClass = '';

    if (existingAudioData) {
        if (existingAudioData.status === 'loaded' && existingAudioData.originalFileName) {
            currentFileText = `Loaded: ${existingAudioData.originalFileName.substring(0,20)}${existingAudioData.originalFileName.length > 20 ? '...' : ''}<br>`;
        } else if (existingAudioData.status === 'missing' || existingAudioData.status === 'missing_db') {
            currentFileText = `Missing: ${existingAudioData.originalFileName || 'Unknown File'}<br>`;
            statusClass = 'drop-zone-missing';
            relinkButtonHTML = `<button class="drop-zone-relink-button text-xs bg-yellow-500 hover:bg-yellow-600 text-black py-0.5 px-1 rounded mt-1">Relink</button>`;
        } else if (existingAudioData.status === 'error') {
            currentFileText = `Error Loading: ${existingAudioData.originalFileName || 'Unknown File'}<br>`;
            statusClass = 'drop-zone-error';
            relinkButtonHTML = `<button class="drop-zone-relink-button text-xs bg-red-500 hover:bg-red-600 text-white py-0.5 px-1 rounded mt-1">Retry Load</button>`;
        } else if (existingAudioData.status === 'loading') {
             currentFileText = `Loading: ${existingAudioData.originalFileName || 'Sample'}...<br>`;
             statusClass = 'drop-zone-loading';
        }
    }

    return `
        <div class="drop-zone ${statusClass}" id="${dropZoneId}" ${dataAttributes}>
            ${currentFileText}
            <label for="${inputId}" class="text-blue-600 hover:text-blue-800 underline cursor-pointer">Click to Upload</label>
            <input type="file" id="${inputId}" accept="audio/*" class="hidden">
            ${relinkButtonHTML}
        </div>`.trim();
}

export function setupGenericDropZoneListeners(dropZoneElement, trackId, trackTypeHint, padIndexOrSliceId = null, loadSoundCallback, loadFileCallback, getTrackByIdCallback) {
    if (!dropZoneElement) {
        console.error("[Utils] setupGenericDropZoneListeners: dropZoneElement is null for trackId:", trackId, "type:", trackTypeHint, "pad/slice:", padIndexOrSliceId);
        return;
    }

    dropZoneElement.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZoneElement.classList.add('dragover');
        event.dataTransfer.dropEffect = "copy";
    });

    dropZoneElement.addEventListener('dragleave', (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZoneElement.classList.remove('dragover');
    });

    dropZoneElement.addEventListener('drop', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropZoneElement.classList.remove('dragover');

        const dzTrackId = dropZoneElement.dataset.trackId ? parseInt(dropZoneElement.dataset.trackId) : trackId;
        const dzTrackType = dropZoneElement.dataset.trackType || trackTypeHint;
        const dzPadSliceIndexStr = dropZoneElement.dataset.padSliceIndex;

        let numericIndexForCallback = null;
        if (dzPadSliceIndexStr !== undefined && dzPadSliceIndexStr !== null && dzPadSliceIndexStr !== "null" && !isNaN(parseInt(dzPadSliceIndexStr))) {
            numericIndexForCallback = parseInt(dzPadSliceIndexStr);
        } else if (typeof padIndexOrSliceId === 'number' && !isNaN(padIndexOrSliceId)) {
            numericIndexForCallback = padIndexOrSliceId;
        }

        const soundDataString = event.dataTransfer.getData("application/json");

        if (soundDataString) { // From Sound Browser
            try {
                const soundData = JSON.parse(soundDataString);
                if (loadSoundCallback) {
                    await loadSoundCallback(soundData, dzTrackId, dzTrackType, numericIndexForCallback);
                } else {
                    console.warn("[Utils] loadSoundCallback not provided for sound browser drop.");
                }
            } catch (e) {
                console.error("[Utils] Error parsing dropped sound data:", e);
                showNotification("Error processing dropped sound.", 3000);
            }
        } else if (event.dataTransfer.files && event.dataTransfer.files.length > 0) { // OS File Drop
            const file = event.dataTransfer.files[0];
            const simulatedEvent = { target: { files: [file] } };
            if (loadFileCallback) {
                if (dzTrackType === 'DrumSampler') {
                    // Use the passed getTrackByIdCallback if available
                    const trackForFallback = getTrackByIdCallback ? getTrackByIdCallback(dzTrackId) : null;
                    const finalPadIndex = (typeof numericIndexForCallback === 'number' && !isNaN(numericIndexForCallback))
                        ? numericIndexForCallback
                        : ( (trackForFallback ? trackForFallback.selectedDrumPadForEdit : 0) || 0);
                    await loadFileCallback(simulatedEvent, dzTrackId, finalPadIndex, file.name);
                } else if (dzTrackType === 'Sampler' || dzTrackType === 'InstrumentSampler') {
                    await loadFileCallback(simulatedEvent, dzTrackId, dzTrackType, file.name);
                } else {
                    console.warn(`[Utils] Unhandled trackType "${dzTrackType}" for OS file drop with loadFileCallback.`);
                }
            } else {
                 console.warn("[Utils] loadFileCallback not provided for OS file drop.");
            }
        }
    });
}


export function secondsToBBSTime(seconds) {
    if (typeof Tone === 'undefined' || seconds === null || seconds === undefined || isNaN(seconds)) {
        return "0:0:0";
    }
    try {
        return Tone.Time(seconds).toBarsBeatsSixteenths();
    } catch (e) {
        console.error("Error converting seconds to B:B:S:", e);
        return "0:0:0";
    }
}

export function bbsTimeToSeconds(bbsString) {
    if (typeof Tone === 'undefined' || !bbsString || typeof bbsString !== 'string') {
        return null;
    }
    try {
        const seconds = Tone.Time(bbsString).toSeconds();
        return isNaN(seconds) ? null : seconds;
    } catch (e) {
        console.error("Error converting B:B:S to seconds:", bbsString, e);
        return null;
    }
}

let activeContextMenu = null;

export function createContextMenu(event, menuItems, appServicesForZIndex = null) {
    event.preventDefault();
    event.stopPropagation();

    if (activeContextMenu) {
        activeContextMenu.remove();
        activeContextMenu = null;
    }

    const menu = document.createElement('div');
    menu.id = 'snug-context-menu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed'; // Keep fixed for global positioning relative to viewport
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    // Use appServices for z-index if provided, otherwise fallback
    const currentHighestZ = appServicesForZIndex?.getHighestZ ? appServicesForZIndex.getHighestZ() :
                           (typeof window !== 'undefined' && window.highestZIndex ? window.highestZIndex : 100);
    menu.style.zIndex = currentHighestZ + 100; // Ensure context menu is on top

    const ul = document.createElement('ul');
    menuItems.forEach(itemConfig => {
        if (itemConfig.separator) {
            const hr = document.createElement('hr');
            hr.className = 'context-menu-separator';
            ul.appendChild(hr);
            return;
        }

        const li = document.createElement('li');
        li.className = `context-menu-item ${itemConfig.disabled ? 'disabled' : ''}`;
        li.textContent = itemConfig.label;
        if (!itemConfig.disabled && typeof itemConfig.action === 'function') {
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                itemConfig.action();
                if (activeContextMenu) activeContextMenu.remove();
                activeContextMenu = null;
            });
        }
        ul.appendChild(li);
    });

    menu.appendChild(ul);
    document.body.appendChild(menu);
    activeContextMenu = menu;

    // Adjust position if out of viewport
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (menuRect.right > viewportWidth) {
        menu.style.left = `${Math.max(0, viewportWidth - menuRect.width)}px`;
    }
    if (menuRect.bottom > viewportHeight) {
        menu.style.top = `${Math.max(0, viewportHeight - menuRect.height)}px`;
    }

    const closeListener = (e) => {
        if (activeContextMenu && !menu.contains(e.target)) {
            activeContextMenu.remove();
            activeContextMenu = null;
            document.removeEventListener('click', closeListener, { capture: true });
            document.removeEventListener('contextmenu', closeListener, { capture: true });
        }
    };
    setTimeout(() => { // Add listeners after current event bubble phase
        document.addEventListener('click', closeListener, { capture: true });
        document.addEventListener('contextmenu', closeListener, { capture: true });
    }, 0);

    return menu;
}
