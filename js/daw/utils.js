// js/daw/utils.js - Utility Functions Module

import * as Constants from '/app/js/daw/constants.js'; // Corrected path

/**
 * Displays a non-intrusive notification message to the user.
 * @param {string} message - The message to display.
 * @param {number} [duration=3000] - The duration (in milliseconds) the notification should be visible.
 */
export function showNotification(message, duration = 3000) {
    const notificationArea = document.getElementById('notification-area');
    if (!notificationArea) {
        console.error("CRITICAL: Notification area ('notification-area') not found in DOM. Message:", message);
        // Fallback to alert if notification area is missing (e.g., during initial setup)
        alert(`Notification: ${message}`);
        return;
    }
    try {
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
    } catch (error) {
        console.error("Error displaying notification:", error, "Message:", message);
    }
}

/**
 * Displays a customizable modal dialog.
 * @param {string} title - The title of the modal.
 * @param {string|HTMLElement} contentHTML - The HTML content or an HTMLElement to display within the modal.
 * @param {Array<Object>} [buttonsConfig=[]] - An array of button configurations { label: string, action: Function }.
 * @returns {Object} An object containing the modal overlay and contentDiv elements.
 */
export function showCustomModal(title, contentHTML, buttonsConfig = []) {
    const modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';

    const titleBar = document.createElement('div');
    titleBar.className = 'modal-title-bar';
    titleBar.textContent = title;
    dialog.appendChild(titleBar);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'modal-content';
    if (typeof contentHTML === 'string') {
        contentDiv.innerHTML = contentHTML;
    } else {
        contentDiv.appendChild(contentHTML);
    }
    dialog.appendChild(contentDiv);

    if (buttonsConfig.length > 0) {
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'modal-buttons';
        buttonsConfig.forEach(btnConfig => {
            const button = document.createElement('button');
            button.textContent = btnConfig.label;
            button.addEventListener('click', () => {
                btnConfig.action?.();
                overlay.remove();
            });
            buttonsDiv.appendChild(button);
        });
        dialog.appendChild(buttonsDiv);
    }
    
    overlay.appendChild(dialog);
    modalContainer.appendChild(overlay);

    return { overlay, contentDiv };
}

/**
 * Displays a confirmation dialog with customizable title, message, and callbacks for confirm/cancel.
 * @param {string} title - The title of the confirmation dialog.
 * @param {string} message - The message displayed in the dialog body.
 * @param {Function} onConfirm - Callback function executed if the user confirms.
 * @param {Function} [onCancel=null] - Callback function executed if the user cancels.
 */
export function showConfirmationDialog(title, message, onConfirm, onCancel = null) {
    const buttons = [
        {
            label: 'Cancel',
            action: () => {
                if (onCancel) onCancel();
            }
        },
        {
            label: 'Confirm',
            action: () => {
                onConfirm();
            }
        }
    ];
    showCustomModal(title, `<p class="p-4">${message}</p>`, buttons);
}


/**
 * Creates and displays a contextual menu at the given event coordinates.
 * @param {MouseEvent} event - The mouse event (usually contextmenu) that triggered the menu.
 * @param {Array<Object>} menuItems - An array of menu item configurations. Each item can be { label: string, action: Function, disabled: boolean } or { separator: true }.
 * @param {Object} appServices - The main application services object.
 */
export function createContextMenu(event, menuItems, appServices) {
    // Remove any existing context menus
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    const ul = document.createElement('ul');
    menu.appendChild(ul);

    menuItems.forEach(item => {
        if (item.separator) {
            const hr = document.createElement('hr');
            hr.className = 'context-menu-separator';
            ul.appendChild(hr);
        } else {
            const li = document.createElement('li');
            li.className = 'context-menu-item';
            li.textContent = item.label;
            if (item.disabled) {
                li.classList.add('disabled');
            } else {
                li.addEventListener('click', () => {
                    item.action();
                    menu.remove(); // Close menu after action
                });
            }
            ul.appendChild(li);
        }
    });

    // Close menu when clicking outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
            document.removeEventListener('contextmenu', closeMenu); // Also remove on subsequent right-clicks
        }
    };
    document.addEventListener('click', closeMenu);
    document.addEventListener('contextmenu', closeMenu); // To close if another right-click happens outside

    document.body.appendChild(menu);
}


/**
 * Converts a Base64 encoded string to a Blob object.
 * @param {string} base64 - The Base64 string.
 * @param {string} [contentType='audio/mpeg'] - The MIME type of the content.
 * @returns {Blob}
 */
export function base64ToBlob(base64, contentType = 'audio/mpeg') {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
}

/**
 * Draws the waveform of an AudioBuffer onto a canvas.
 * @param {HTMLCanvasElement} canvas - The canvas element to draw on.
 * @param {AudioBuffer} audioBuffer - The AudioBuffer containing the audio data.
 * @param {string} [color='black'] - The color of the waveform.
 */
export function drawWaveform(canvas, audioBuffer, color = 'black') {
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);

    // Get the first channel data
    const data = audioBuffer.getChannelData(0);
    // Calculate step size to draw one line per pixel width
    const step = Math.ceil(data.length / width);
    // Half of the canvas height for amplitude scaling
    const amp = height / 2;
    
    ctx.fillStyle = color;
    
    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;

        // Find min and max values for the current step
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) {
                min = datum;
            }
            if (datum > max) {
                max = datum;
            }
        }
        
        // Draw a vertical line representing the amplitude range
        const rectHeight = Math.max(1, (max - min) * amp); // Ensure minimum height of 1px
        const y = (1 + min) * amp; // Calculate y-position based on min value
        ctx.fillRect(i, y, 1, rectHeight);
    }
}


/**
 * Sets up generic drag-and-drop and click-to-browse listeners for a drop zone element.
 * @param {HTMLElement} dropZoneElement - The DOM element to act as a drop zone.
 * @param {string|number} trackId - The ID of the associated track.
 * @param {string} trackTypeHint - The type of the track ('Sampler', 'DrumSampler', 'InstrumentSampler').
 * @param {number|null} padIndex - The index of the drum pad if applicable.
 * @param {Function} loadFromSoundBrowserCallback - Callback for loading from sound browser (soundData, trackId, trackTypeHint, padIndex).
 * @param {Function} loadFromFileCallback - Callback for loading from local file (event, trackId, trackTypeHint, padIndex).
 */
export function setupGenericDropZoneListeners(dropZoneElement, trackId, trackTypeHint, padIndex = null, loadFromSoundBrowserCallback, loadFromFileCallback) {
    dropZoneElement.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
        dropZoneElement.classList.add('dragover');
    });

    dropZoneElement.addEventListener('dragleave', () => {
        dropZoneElement.classList.remove('dragover');
    });

    dropZoneElement.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZoneElement.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('audio/')) {
                loadFromFileCallback(e, trackId, trackTypeHint, padIndex);
            } else {
                showNotification(`Unsupported file type: ${file.type}`, 3000);
            }
        } else {
            const jsonData = e.dataTransfer.getData("application/json");
            if (jsonData) {
                try {
                    const data = JSON.parse(jsonData);
                    if (data.type === 'sound-browser-item') {
                        loadFromSoundBrowserCallback(data, trackId, trackTypeHint, padIndex);
                    }
                } catch (jsonError) {
                    console.error("Error parsing dropped JSON data:", jsonError);
                    showNotification("Error processing dropped data.", 3000);
                }
            }
        }
    });

    // Attach click listener to trigger file input
    const fileInput = dropZoneElement.querySelector('input[type="file"]');
    if (fileInput) {
        dropZoneElement.addEventListener('click', (e) => {
            // Prevent click on internal elements of the dropzone from triggering file input multiple times
            if (e.target !== fileInput) {
                fileInput.click();
            }
        });
    }
}

/**
 * Generates HTML for a file drop zone with a hidden file input.
 * @param {string} inputId - The ID for the hidden file input.
 * @param {string} [labelText='Drag & Drop Audio Here'] - The visible text for the drop zone.
 * @returns {string} The HTML string for the drop zone.
 */
export function createDropZoneHTML(inputId, labelText = 'Drag & Drop Audio Here') {
    return `
        <div class="drop-zone">
            <input type="file" id="${inputId}" class="hidden" accept="audio/*">
            <p>${labelText} or <label for="${inputId}" class="cursor-pointer">click to browse</label></p>
        </div>
    `;
}

/**
 * Reads CSS custom properties to get current theme colors.
 * @returns {object} An object containing theme colors.
 */
export function getThemeColors() { 
    const rootStyle = getComputedStyle(document.documentElement);
    return {
        // Backgrounds
        bgPrimary: rootStyle.getPropertyValue('--bg-primary').trim(),
        bgWindow: rootStyle.getPropertyValue('--bg-window').trim(),
        bgWindowContent: rootStyle.getPropertyValue('--bg-window-content').trim(),
        bgButton: rootStyle.getPropertyValue('--bg-button').trim(),
        bgButtonHover: rootStyle.getPropertyValue('--bg-button-hover').trim(),
        bgInput: rootStyle.getPropertyValue('--bg-input').trim(),
        bgDropzone: rootStyle.getPropertyValue('--bg-dropzone').trim(),
        bgDropzoneDragover: rootStyle.getPropertyValue('--bg-dropzone-dragover').trim(),
        bgModalDialog: rootStyle.getPropertyValue('--bg-modal-dialog').trim(),
        bgSequencerStepEven: rootStyle.getPropertyValue('--bg-sequencer-step-even').trim(),
        bgSequencerStepOdd: rootStyle.getPropertyValue('--bg-sequencer-step-odd').trim(),

        // Text Colors
        textPrimary: rootStyle.getPropertyValue('--text-primary').trim(),
        textSecondary: rootStyle.getPropertyValue('--text-secondary').trim(),
        textButton: rootStyle.getPropertyValue('--text-button').trim(),
        textButtonHover: rootStyle.getPropertyValue('--text-button-hover').trim(),
        textDropzone: rootStyle.getPropertyValue('--text-dropzone').trim(),
        textDropzoneDragover: rootStyle.getPropertyValue('--text-dropzone-dragover').trim(),
        
        // Borders
        borderPrimary: rootStyle.getPropertyValue('--border-primary').trim(),
        borderSecondary: rootStyle.getPropertyValue('--border-secondary').trim(),
        borderButton: rootStyle.getPropertyValue('--border-button').trim(),
        borderDropzone: rootStyle.getPropertyValue('--border-dropzone').trim(),
        borderDropzoneDragover: rootStyle.getPropertyValue('--border-dropzone-dragover').trim(),
        borderSequencer: rootStyle.getPropertyValue('--border-sequencer').trim(),

        // Accents (for active states)
        accentFocus: rootStyle.getPropertyValue('--accent-focus').trim(),
        accentMuted: rootStyle.getPropertyValue('--accent-muted').trim(),
        accentMutedText: rootStyle.getPropertyValue('--accent-muted-text').trim(),
        accentSoloed: rootStyle.getPropertyValue('--accent-soloed').trim(),
        accentSoloedText: rootStyle.getPropertyValue('--accent-soloed-text').trim(),
        accentArmed: rootStyle.getPropertyValue('--accent-armed').trim(),
        accentArmedText: rootStyle.getPropertyValue('--accent-armed-text').trim(),
        accentActive: rootStyle.getPropertyValue('--accent-active').trim(),
        accentActiveText: rootStyle.getPropertyValue('--accent-active-text').trim(),
        accentSequencerStep: rootStyle.getPropertyValue('--accent-sequencer-step').trim(),
        accentSequencerStepBorder: rootStyle.getPropertyValue('--accent-sequencer-step-border').trim(),
        accentPlayhead: rootStyle.getPropertyValue('--accent-playhead').trim(),
        accentMeter: rootStyle.getPropertyValue('--accent-meter').trim(),
        
        // Piano Key Colors (directly from root if available, otherwise fallback)
        whiteKeyBg: rootStyle.getPropertyValue('--piano-key-white-bg').trim() || '#FFFFFF',
        blackKeyBg: rootStyle.getPropertyValue('--piano-key-black-bg').trim() || '#4a4a4a',
        whiteKeyText: rootStyle.getPropertyValue('--piano-key-white-text').trim() || '#000000',
        blackKeyText: rootStyle.getPropertyValue('--piano-key-black-text').trim() || '#FFFFFF',
    };
}