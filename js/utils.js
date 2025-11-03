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

    const modalOverlay = document.createElement('div');
    modalOverlay.id = modalId;
    modalOverlay.className = 'modal-container'; // Use this for overlay styling

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const modalHeader = document.createElement('h2');
    modalHeader.textContent = title;
    modalContent.appendChild(modalHeader);

    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    modalBody.innerHTML = contentHTML;
    modalContent.appendChild(modalBody);

    const modalButtons = document.createElement('div');
    modalButtons.className = 'modal-buttons';

    if (buttonsConfig.length === 0) { // Add a default close button if none provided
        buttonsConfig.push({ text: 'Close', type: 'cancel', action: () => modalOverlay.remove() });
    }

    buttonsConfig.forEach(btnConfig => {
        const button = document.createElement('button');
        button.textContent = btnConfig.text;
        button.classList.add(btnConfig.type || 'cancel'); // 'confirm' or 'cancel' for styling
        button.addEventListener('click', () => {
            if (btnConfig.action) btnConfig.action();
            modalOverlay.remove(); // Always remove modal after action
        });
        modalButtons.appendChild(button);
    });

    modalContent.appendChild(modalButtons);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // Focus on the first button for accessibility
    const firstButton = modalButtons.querySelector('button');
    if (firstButton) firstButton.focus();
    
    return { overlay: modalOverlay, contentDiv: modalBody };
}


export function showConfirmationDialog(title, message, onConfirm, onCancel) {
    const buttons = [
        { text: 'Confirm', type: 'confirm', action: onConfirm },
        { text: 'Cancel', type: 'cancel', action: onCancel }
    ];
    showCustomModal(title, `<p>${message}</p>`, buttons, 'confirmationDialog');
}


export function createDropZoneHTML(trackId, fileInputId, targetType, index = null, existingAudioData = null) {
    let statusClass = 'status-empty';
    let statusText = 'Drop audio file here, or click to browse.';
    if (existingAudioData) {
        if (existingAudioData.status === 'loaded') { statusClass = 'status-loaded'; statusText = `Loaded: ${existingAudioData.originalFileName}`; }
        else if (existingAudioData.status === 'missing' || existingAudioData.status === 'missing_db') { statusClass = 'status-missing'; statusText = `Missing: ${existingAudioData.originalFileName || 'Unknown File'}`; }
        else if (existingAudioData.status === 'error') { statusClass = 'status-error'; statusText = `Error loading: ${existingAudioData.originalFileName || 'Unknown File'}`; }
        else if (existingAudioData.originalFileName) { statusClass = 'status-missing'; statusText = `File: ${existingAudioData.originalFileName} (Tap to load)`;}
    }

    const indexAttr = index !== null ? `data-index="${index}"` : '';
    return `
        <div class="drop-zone" data-track-id="${trackId}" data-target-type="${targetType}" ${indexAttr}>
            <p class="${statusClass}">${statusText}</p>
            <input type="file" id="${fileInputId}" class="hidden" accept="audio/*">
            <button onclick="document.getElementById('${fileInputId}').click();">Browse</button>
        </div>
    `;
}

export function setupGenericDropZoneListeners(dropZoneElement, trackId, targetType, index, loadFromBrowserCallback, fileLoadCallback) {
    dropZoneElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneElement.classList.add('dragover');
        e.dataTransfer.dropEffect = 'copy';
    });
    dropZoneElement.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneElement.classList.remove('dragover');
    });
    dropZoneElement.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneElement.classList.remove('dragover');
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
                // Create a mock event object for fileLoadCallback
                const mockEvent = { target: { files: files } };
                fileLoadCallback(mockEvent, trackId, index); // Assuming padIndex for drum samplers
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

// Context Menu
let activeContextMenu = null;
export function createContextMenu(event, menuItems, appServicesForZIndex) {
    if (activeContextMenu) activeContextMenu.remove();
    event.preventDefault();
    event.stopPropagation();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'snug-context-menu'; // Added an ID

    const ul = document.createElement('ul');
    menuItems.forEach(item => {
        if (item.separator) {
            const hr = document.createElement('hr');
            ul.appendChild(hr);
        } else {
            const li = document.createElement('li');
            li.textContent = item.label;
            if (item.disabled) {
                li.classList.add('disabled');
            } else {
                li.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent click from closing menu if action opens another menu/modal
                    item.action();
                    if (activeContextMenu) activeContextMenu.remove(); // Close after action
                    activeContextMenu = null;
                });
            }
            ul.appendChild(li);
        }
    });
    menu.appendChild(ul);
    document.body.appendChild(menu);
    activeContextMenu = menu;

    const zIndex = appServicesForZIndex && appServicesForZIndex.incrementHighestZ ? appServicesForZIndex.incrementHighestZ() : 10003;
    menu.style.zIndex = zIndex;

    // Position the menu
    const { clientX: mouseX, clientY: mouseY } = event;
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = mouseY;
    let left = mouseX;

    if (mouseX + menuWidth > viewportWidth) {
        left = mouseX - menuWidth;
    }
    if (mouseY + menuHeight > viewportHeight) {
        top = mouseY - menuHeight;
    }
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    // Close listener
    const closeListener = (e) => {
        if (activeContextMenu && (!menu.contains(e.target) || e.type === 'contextmenu' && e.target !== menu && !menu.contains(e.target))) {
            try {
                activeContextMenu.remove();
            } catch (removeError) { /* ignore if already removed */ }
            activeContextMenu = null;
            document.removeEventListener('click', closeListener, { capture: true });
            document.removeEventListener('contextmenu', closeListener, { capture: true });
            window.removeEventListener('blur', closeListenerBlur); // Also remove blur listener
        }
    };
    const closeListenerBlur = () => { // Separate for blur as it doesn't have e.target
        if (activeContextMenu) {
             try { activeContextMenu.remove(); } catch (removeError) { /* ignore */ }
            activeContextMenu = null;
            document.removeEventListener('click', closeListener, { capture: true });
            document.removeEventListener('contextmenu', closeListener, { capture: true });
            window.removeEventListener('blur', closeListenerBlur);
        }
    }

    // Add listeners after a short delay to avoid capturing the event that opened the menu
    setTimeout(() => {
        document.addEventListener('click', closeListener, { capture: true });
        document.addEventListener('contextmenu', closeListener, { capture: true });
        window.addEventListener('blur', closeListenerBlur); // Close on window blur
    }, 0);

    return menu;
}
