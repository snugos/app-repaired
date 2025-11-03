// js/utils.js - Utility Functions Module

export function showNotification(message, duration = 3000) {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) {
        console.error("CRITICAL: Notification area ('notification-area') not found in DOM. Message:", message);
        // Fallback to alert if notification area is missing
        alert(`Notification: ${message}`);
        return;
    }
    try {
        const notification = document.createElement('div');
        notification.className = 'notification-message';
        notification.textContent = message;
        notificationArea.appendChild(notification);

        // Trigger fade-in
        setTimeout(() => {
            notification.classList.add('show');
        }, 10); // Short delay to allow element to be added to DOM before transition

        // Set timeout to remove the notification
        setTimeout(() => {
            notification.classList.remove('show');
            // Remove the element after the fade-out transition
            setTimeout(() => {
                if (notification.parentElement) {
                    notificationArea.removeChild(notification);
                }
            }, 300); // Duration of the fade-out transition (should match CSS)
        }, duration);
    } catch (error) {
        console.error("Error displaying notification:", error, "Message:", message);
    }
}

export function showCustomModal(title, contentHTML, buttonsConfig = [], modalId = 'customModal') {
    const existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove(); // Remove if already exists

    const modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) {
        console.error("CRITICAL: Modal container not found in DOM.");
        return;
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = modalId;
    modalOverlay.className = 'modal-overlay'; // Use this for overlay styling

    const modalDialog = document.createElement('div');
    modalDialog.className = 'modal-dialog';
    
    modalDialog.innerHTML = `
        <div class="modal-title-bar">${title}</div>
        <div class="modal-content">${contentHTML}</div>
        <div class="modal-buttons"></div>
    `;

    const modalButtons = modalDialog.querySelector('.modal-buttons');

    if (buttonsConfig.length === 0) { // Add a default close button if none provided
        buttonsConfig.push({ text: 'Close', class: 'secondary', action: () => { /* no-op */ } });
    }

    buttonsConfig.forEach(btnConfig => {
        const button = document.createElement('button');
        button.textContent = btnConfig.text;
        button.className = btnConfig.class === 'confirm' ? 'btn-confirm' : 'btn-secondary'; // Example classes
        button.addEventListener('click', () => {
            if (btnConfig.action) btnConfig.action();
            modalOverlay.remove(); // Always remove modal after action
        });
        modalButtons.appendChild(button);
    });

    modalOverlay.appendChild(modalDialog);
    modalContainer.appendChild(modalOverlay);

    // Focus on the first button for accessibility
    const firstButton = modalButtons.querySelector('button');
    if (firstButton) firstButton.focus();
    
    return { overlay: modalOverlay, contentDiv: modalDialog.querySelector('.modal-content') };
}


export function showConfirmationDialog(title, message, onConfirm, onCancel) {
    const buttons = [
        { text: 'Confirm', class: 'confirm', action: onConfirm },
        { text: 'Cancel', class: 'secondary', action: onCancel }
    ];
    showCustomModal(title, `<p>${message}</p>`, buttons, 'confirmationDialog');
}


export function createDropZoneHTML(trackId, fileInputId, targetType, index = null, existingAudioData = null) {
    let statusClass = '';
    let statusText = 'Drop audio file or click to browse.';
    let hasFile = false;

    if (existingAudioData) {
        hasFile = !!(existingAudioData.originalFileName || existingAudioData.fileName);
        switch (existingAudioData.status) {
            case 'loaded':
                statusClass = 'status-loaded text-green-400';
                statusText = `Loaded: ${existingAudioData.originalFileName || existingAudioData.fileName}`;
                break;
            case 'missing':
            case 'missing_db':
                statusClass = 'status-missing text-yellow-500';
                statusText = `Missing: ${existingAudioData.originalFileName || existingAudioData.fileName}`;
                break;
            case 'error':
                statusClass = 'status-error text-red-500';
                statusText = `Error: ${existingAudioData.originalFileName || existingAudioData.fileName}`;
                break;
            case 'loading':
                 statusClass = 'status-loading text-blue-400';
                 statusText = `Loading...`;
                 break;
            default:
                if (hasFile) {
                    statusClass = 'status-missing text-yellow-500';
                    statusText = `File: ${existingAudioData.originalFileName || existingAudioData.fileName}`;
                }
                break;
        }
    }

    const indexAttr = index !== null ? `data-index="${index}"` : '';
    const clickHandler = `document.getElementById('${fileInputId}').click(); event.stopPropagation();`;

    return `
        <div class="drop-zone p-2 border-2 border-dashed border-gray-600 dark:border-slate-500 rounded-md text-center cursor-pointer hover:bg-gray-700 dark:hover:bg-slate-600 transition-colors" 
             data-track-id="${trackId}" 
             data-target-type="${targetType}" 
             ${indexAttr}
             onclick="${clickHandler}">
            <p class="text-xs ${statusClass}">${statusText}</p>
            <input type="file" id="${fileInputId}" class="hidden" accept="audio/*">
            ${hasFile ? `<button class="text-xs text-blue-400 hover:underline mt-1 drop-zone-relink-button">Relink</button>` : ''}
        </div>
    `;
}


export function setupGenericDropZoneListeners(dropZoneElement, trackId, targetType, index, loadFromBrowserCallback, fileLoadCallback) {
    dropZoneElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneElement.classList.add('dragover', 'bg-slate-600', 'border-sky-400');
        e.dataTransfer.dropEffect = 'copy';
    });
    dropZoneElement.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneElement.classList.remove('dragover', 'bg-slate-600', 'border-sky-400');
    });
    dropZoneElement.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneElement.classList.remove('dragover', 'bg-slate-600', 'border-sky-400');
        const files = e.dataTransfer.files;
        const jsonDataString = e.dataTransfer.getData("application/json");

        if (jsonDataString) {
            try {
                const soundData = JSON.parse(jsonDataString);
                if (soundData.type === 'sound-browser-item' && typeof loadFromBrowserCallback === 'function') {
                    loadFromBrowserCallback(soundData, trackId, targetType, index);
                }
            } catch (err) { console.error("Error parsing dropped JSON for dropzone:", err); }
        } else if (files && files.length > 0) {
            if (typeof fileLoadCallback === 'function') {
                const mockEvent = { target: { files: files } };
                fileLoadCallback(mockEvent, trackId, index);
            }
        }
    });
}

/**
 * Snaps a given time to the nearest grid interval.
 * @param {number} timeInSeconds - The time to snap.
 * @param {number} snapIntervalSeconds - The duration of one grid interval in seconds.
 * @returns {number} The snapped time in seconds.
 */
export function snapTimeToGrid(timeInSeconds, snapIntervalSeconds) {
    if (snapIntervalSeconds <= 0) return timeInSeconds; // Avoid division by zero or negative interval
    return Math.round(timeInSeconds / snapIntervalSeconds) * snapIntervalSeconds;
}

// --- Context Menu (Corrected for Memory Leaks) ---
let activeContextMenu = null;
let activeCloseListener = null;
let activeBlurListener = null;

function removeActiveContextMenuListeners() {
    if (activeCloseListener) {
        document.removeEventListener('click', activeCloseListener, { capture: true });
        document.removeEventListener('contextmenu', activeCloseListener, { capture: true });
    }
    if (activeBlurListener) {
        window.removeEventListener('blur', activeBlurListener);
    }
    activeCloseListener = null;
    activeBlurListener = null;
}

export function createContextMenu(event, menuItems, appServicesForZIndex) {
    // Clean up any existing listeners and menus before creating a new one
    if (activeContextMenu) {
        activeContextMenu.remove();
    }
    removeActiveContextMenuListeners();
    
    event.preventDefault();
    event.stopPropagation();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'snug-context-menu';

    const ul = document.createElement('ul');
    menuItems.forEach(item => {
        const li = document.createElement('li');
        if (item.separator) {
            li.className = 'context-menu-separator';
            const hr = document.createElement('hr');
            li.appendChild(hr);
        } else {
            li.className = 'context-menu-item';
            li.textContent = item.label;
            if (item.disabled) {
                li.classList.add('disabled');
            } else {
                li.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    item.action();
                    // The close listener will handle removing the menu
                });
            }
        }
        ul.appendChild(li);
    });

    menu.appendChild(ul);
    document.body.appendChild(menu);
    activeContextMenu = menu;

    const zIndex = appServicesForZIndex?.incrementHighestZ ? appServicesForZIndex.incrementHighestZ() : 10003;
    menu.style.zIndex = zIndex;

    const { clientX: mouseX, clientY: mouseY } = event;
    const { offsetWidth: menuWidth, offsetHeight: menuHeight } = menu;
    const { innerWidth: viewportWidth, innerHeight: viewportHeight } = window;

    let top = mouseY;
    let left = mouseX;

    if (mouseX + menuWidth > viewportWidth) {
        left = mouseX - menuWidth;
    }
    if (mouseY + menuHeight > viewportHeight) {
        top = mouseY - menuHeight;
    }
    menu.style.top = `${Math.max(0, top)}px`;
    menu.style.left = `${Math.max(0, left)}px`;
    
    const closeListener = (e) => {
        if (activeContextMenu) {
            try {
                activeContextMenu.remove();
            } catch (removeError) { /* ignore */ }
            activeContextMenu = null;
        }
        removeActiveContextMenuListeners();
    };

    activeCloseListener = closeListener;
    activeBlurListener = closeListener; // Can use the same function for blur

    setTimeout(() => {
        document.addEventListener('click', activeCloseListener, { capture: true });
        document.addEventListener('contextmenu', activeCloseListener, { capture: true });
        window.addEventListener('blur', activeBlurListener);
    }, 0);

    return menu;
}
