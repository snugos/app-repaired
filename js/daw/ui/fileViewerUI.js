// js/daw/ui/fileViewerUI.js

import { base64ToBlob, showNotification, showCustomModal } from '/app/js/daw/utils.js'; // Corrected path

let localAppServices = {};

/**
 * Initializes the File Viewer UI module.
 * @param {object} appServicesFromMain - The main app services object.
 */
export function initializeFileViewerUI(appServicesFromMain) {
    localAppServices = appServicesFromMain;
}

/**
 * Opens a new SnugWindow to display a file.
 * The content displayed depends on the file's MIME type (audio, image, video, or generic).
 * @param {object} fileItem - The file object containing properties like `id`, `file_name`, `mime_type`, `s3_url`.
 */
export function openFileViewerWindow(fileItem) {
    // Check if a window for this file is already open
    const windowId = `fileViewer-${fileItem.id}`;
    if (localAppServices.getWindowById?.(windowId)) {
        localAppServices.getWindowById(windowId).restore();
        return;
    }

    let contentElement;
    let windowOptions = {
        width: 400,
        height: 300,
        minWidth: 200,
        minHeight: 150,
        initialContentKey: windowId,
        resizable: true, // Default to true, can be overridden below
    };

    // Determine content and window options based on MIME type
    if (fileItem.mime_type.startsWith('audio/')) {
        contentElement = document.createElement('audio');
        contentElement.controls = true;
        contentElement.src = fileItem.s3_url;
        contentElement.className = 'w-full h-full';
        contentElement.style.backgroundColor = 'black'; // Dark background for audio player
        windowOptions.width = 400;
        windowOptions.height = 100;
        windowOptions.minHeight = 100;
        windowOptions.resizable = false; // Audio player usually doesn't need resizing
    } else if (fileItem.mime_type.startsWith('image/')) {
        contentElement = document.createElement('img');
        contentElement.src = fileItem.s3_url;
        contentElement.className = 'w-full h-full object-contain p-2';
        windowOptions.width = 500;
        windowOptions.height = 400;
    } else if (fileItem.mime_type.startsWith('video/')) {
        contentElement = document.createElement('video');
        contentElement.controls = true;
        contentElement.src = fileItem.s3_url;
        contentElement.className = 'w-full h-full';
        contentElement.style.backgroundColor = 'black';
        windowOptions.width = 640;
        windowOptions.height = 400;
    } else {
        // Fallback for unviewable file types
        contentElement = document.createElement('div');
        contentElement.className = 'p-4 text-center';
        contentElement.innerHTML = `
            <p><strong>File:</strong> ${fileItem.file_name}</p>
            <p><strong>Type:</strong> ${fileItem.mime_type}</p>
            <p>This file type cannot be previewed directly.</p>
            <a href="${fileItem.s3_url}" target="_blank" class="text-blue-500 hover:underline mt-2 inline-block">Download/Open in New Tab</a>
        `;
        windowOptions.width = 450;
        windowOptions.height = 200;
        windowOptions.resizable = false; // Fixed size for generic viewer
    }

    // Create and open the SnugWindow
    localAppServices.createWindow(windowId, `Viewing: ${fileItem.file_name}`, contentElement, windowOptions);
}