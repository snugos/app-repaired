// js/daw/browser/browser.js
// NOTE: This file is now the main JavaScript for the standalone SnugOS Browser application.
// It includes its own desktop UI and manages its own global state.

// Corrected imports to be absolute paths from the project root
import { SnugWindow } from '/app/js/daw/SnugWindow.js';
import { openFileViewerWindow, initializeFileViewerUI } from '/app/js/daw/ui/fileViewerUI.js';

// We explicitly import common utilities and DB functions.
import { storeAudio, getAudio, deleteAudio, storeAsset, getAsset } from '/app/js/daw/db.js';
import * as Constants from '/app/js/daw/constants.js';
import { showNotification, showCustomModal, createContextMenu } from '/app/js/daw/utils.js';

// Import necessary state functions directly, as this is a standalone app
import { getWindowById, addWindowToStore, removeWindowFromStore, incrementHighestZ, getHighestZ, setHighestZ, getOpenWindows, serializeWindows, reconstructWindows } from '/app/js/daw/state/windowState.js';
import { getCurrentUserThemePreference, setCurrentUserThemePreference } from '/app/js/daw/state/appState.js';
// NEW: Import centralized auth functions
import { showLoginModal as centralizedShowLoginModal, handleLogin as centralizedHandleLogin, handleRegister as centralizedHandleRegister, handleLogout as centralizedHandleLogout, getLoggedInUser } from '/app/js/daw/auth.js';


const SERVER_URL = 'https://snugos-server-api.onrender.com';

let loggedInUser = null; // Will now be managed by auth.js and retrieved via getLoggedInUser()
let currentPath = ['/'];
let currentViewMode = 'my-files';
let appServices = {}; // This will now be populated locally for this standalone app.
let isAdminView = false; // Flag for 'snaw' to view all files

// --- Global UI and Utility Functions (Now mostly proxied from appServices) ---

// Authentication/Login/Logout Functions (Now use centralized functions from auth.js)
// REMOVED: checkLocalAuth, handleLogin, handleRegister, handleLogout, showLoginModal

// CENTRALIZED VERSION: handleLogout will now call the centralized one
function handleLogout() {
    centralizedHandleLogout(); // Call the function exported from auth.js
    // Any browser-specific UI resets for logout (e.g., clear file list)
    window.location.reload(); // Reload the page to reflect logout status
}

// NEW: Function to open the centralized login modal
function showLoginModalBrowser() {
    centralizedShowLoginModal(); // Call the function exported from auth.js
}


function initAudioOnFirstGesture() {
    const startAudio = async () => {
        try {
            if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
                await Tone.start();
                console.log('AudioContext started successfully.');
            }
        } catch (e) { console.error('Could not start AudioContext:', e); }
        document.body.removeEventListener('mousedown', startAudio);
    };
    document.body.addEventListener('mousedown', startAudio);
}

function updateClockDisplay() {
    const clockDisplay = document.getElementById('taskbarClockDisplay');
    if (clockDisplay) {
        clockDisplay.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    setTimeout(updateClockDisplay, 60000);
}

function toggleStartMenu() {
    document.getElementById('startMenu')?.classList.toggle('hidden');
}

function applyUserThemePreference() {
    const preference = localStorage.getItem('snugos-theme');
    const body = document.body;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const themeToApply = preference || (prefersDark ? 'dark' : 'light');
    if (themeToApply === 'light') {
        body.classList.remove('theme-dark');
        body.classList.add('theme-light');
        localStorage.setItem('snugos-theme', 'light');
    } else {
        body.classList.remove('theme-light');
        body.classList.add('theme-dark');
        localStorage.setItem('snugos-theme', 'dark');
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            showNotification(`Error: ${err.message}`, 3000);
        });
    } else {
        if(document.exitFullscreen) document.exitFullscreen();
    }
}

function setupDesktopContextMenu() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    desktop.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const menuItems = [
            { label: 'New Folder', action: () => handleCreateFolder() }, // Use the local handler
            { label: 'Upload File', action: () => document.getElementById('actualFileInput').click() },
            { separator: true },
            { label: 'Refresh Files', action: () => fetchAndRenderLibraryItems(document.body) },
            { separator: true },
            // Removed Change Background here as it is only available in welcome.js via appServices
            // { label: 'Change Background', action: () => document.getElementById('customBgInput').click() }
        ];
        createContextMenu(e, menuItems);
    });

    // Removed customBgInput listener as it implies a local customBgInput element which is not in browser.html
    // document.getElementById('customBgInput')?.addEventListener('change', async (e) => {
    //     if(!e.target.files || !e.target.files[0] || !loggedInUser) return;
    //     const file = e.target.files[0];
    //
    //     showNotification("Uploading background...", 2000);
    //     const formData = new FormData();
    //     formData.append('file', file);
    //     formData.append('path', '/backgrounds/');
    //     try {
    //         const token = localStorage.getItem('snugos_token');
    //         const uploadResponse = await fetch(`${SERVER_URL}/api/files/upload`, {
    //             method: 'POST',
    //             headers: { 'Authorization': `Bearer ${token}` },
    //             body: formData
    //         });
    //         const uploadResult = await uploadResponse.json();
    //         if (!uploadResult.success) throw new Error(uploadResult.message);
    //
    //         const newBgUrl = uploadResult.file.s3_url;
    //         await fetch(`${SERVER_URL}/api/profile/settings`, {
    //             method: 'PUT',
    //             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    //             body: JSON.stringify({ background_url: newBgUrl })
    //         });
    //
    //         showNotification("Background updated!", 2000);
    //         loadAndApplyGlobals();
    //     } catch(error) {
    //         showNotification(`Error: ${error.message}`, 4000);
    //     }
    // });
}

function attachDesktopEventListeners() {
    // Top-level elements
    document.getElementById('startButton')?.addEventListener('click', toggleStartMenu);
    document.getElementById('menuLogin')?.addEventListener('click', () => { toggleStartMenu(); showLoginModalBrowser(); }); // Call local login modal function
    document.getElementById('menuLogout')?.addEventListener('click', handleLogout);

    // Links in the start menu (will open new tabs/windows)
    document.getElementById('menuLaunchDaw')?.addEventListener('click', () => { window.open('/app/snaw.html', '_blank'); toggleStartMenu(); });
    document.getElementById('menuOpenLibrary')?.addEventListener('click', () => { window.open('/app/js/daw/browser/browser.html', '_blank'); toggleStartMenu(); }); // Browser link
    document.getElementById('menuViewProfiles')?.addEventListener('click', () => { window.open('/app/js/daw/profiles/profile.html', '_blank'); toggleStartMenu(); }); // Profile link
    document.getElementById('menuOpenMessages')?.addEventListener('click', () => { window.open('/app/js/daw/messages/messages.html', '_blank'); toggleStartMenu(); }); // Messages link

    // Generic context menu for desktop background
    setupDesktopContextMenu();

    // Standard desktop clock and full screen
    document.getElementById('menuToggleFullScreen')?.addEventListener('click', toggleFullScreen);
}

async function loadAndApplyGlobals() {
    // This function is generally for backgrounds/global settings from the *current* loggedInUser.
    // In a browser app, this might be less relevant unless you're displaying user-specific backgrounds.
    // If this app is solely a file browser, it might not need to load global user backgrounds.
    // For now, let's keep it minimal if loggedInUser exists.
    if (!loggedInUser) return;
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/profile/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        // This browser app doesn't have a direct "desktop" div like index.html/snaw.html to apply a background to.
        // If it did, you'd apply `data.profile.background_url` here.
    } catch (error) {
        console.error("Could not apply global settings for browser app:", error);
    }
}

// --- File Management Functions (Adapted for browser.js's UI) ---

async function fetchAndRenderLibraryItems(container) {
    const fileViewArea = container.querySelector('#file-view-area'); // Assuming #file-view-area exists in browser.html content
    const pathDisplay = container.querySelector('#library-path-display'); // Assuming #library-path-display exists in browser.html content
    const myFilesBtn = document.getElementById('my-files-btn');
    const publicFilesBtn = document.getElementById('public-files-btn');
    const adminFilesBtn = document.getElementById('admin-files-btn');

    if (!fileViewArea || !pathDisplay) {
        console.error("File view area or path display not found in browser.html content.");
        return;
    }

    fileViewArea.innerHTML = `<p class="w-full text-center italic" style="color: var(--text-secondary);">Loading...</p>`;
    pathDisplay.textContent = currentPath.join('');

    // Highlight current view mode button
    if (myFilesBtn) myFilesBtn.classList.toggle('active', currentViewMode === 'my-files');
    if (publicFilesBtn) publicFilesBtn.classList.toggle('active', currentViewMode === 'public-files');
    if (adminFilesBtn) adminFilesBtn.classList.toggle('active', isAdminView);

    let apiUrl;
    if (currentViewMode === 'my-files') {
        apiUrl = `${SERVER_URL}/api/files/my?path=${encodeURIComponent(currentPath.join('/'))}`;
    } else if (currentViewMode === 'public-files') {
        apiUrl = `${SERVER_URL}/api/files/public?path=${encodeURIComponent(currentPath.join('/'))}`;
    } else if (isAdminView && loggedInUser && loggedInUser.username === 'snaw') {
        apiUrl = `${SERVER_URL}/api/admin/files`; // Admin view always shows all files
    } else {
        // Fallback or unauthenticated state
        fileViewArea.innerHTML = `<p class="w-full text-center italic" style="color: var(--text-secondary);">Please log in or select a view mode.</p>`;
        return;
    }

    try {
        const token = localStorage.getItem('snugos_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch(apiUrl, { headers });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to fetch files');

        fileViewArea.innerHTML = '';
        // Add ".." for parent directory navigation if not at root
        if (currentPath.length > 1 && !isAdminView) { // Don't show ".." in admin view as it's flat
            fileViewArea.appendChild(renderFileItem({ file_name: '..', mime_type: 'folder' }, true));
        }

        if (data.items && data.items.length > 0) {
            data.items.sort((a, b) => {
                const aIsFolder = a.mime_type.includes('folder');
                const bIsFolder = b.mime_type.includes('folder');
                if (aIsFolder && !bIsFolder) return -1;
                if (!aIsFolder && bIsFolder) return 1;
                // Sort alphabetically by file_name, using owner_username for admin view
                const nameA = isAdminView ? `${a.owner_username}/${a.path}${a.file_name}` : a.file_name;
                const nameB = isAdminView ? `${b.owner_username}/${b.path}${b.file_name}` : b.file_name;
                return nameA.localeCompare(nameB);
            });
            data.items.forEach(item => fileViewArea.appendChild(renderFileItem(item)));
        } else if (currentPath.length <= 1 && !isAdminView) { // Only show "empty" message if at root in non-admin view
            fileViewArea.innerHTML = `<p class="w-full text-center italic" style="color: var(--text-secondary);">This folder is empty.</p>`;
        }
    } catch (error) {
        fileViewArea.innerHTML = `<p class="w-full text-center italic" style="color: red;">${error.message}</p>`;
        showNotification(`Error loading files: ${error.message}`, 4000);
    }
}

// Helper to check if a user is 'snaw' for admin features
function isSnawAdmin() {
    return loggedInUser && loggedInUser.username === 'snaw';
}

function renderFileItem(item, isParentFolder = false) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'flex flex-col items-center justify-start text-center cursor-pointer rounded-md p-2 w-24 h-28 file-item-container';
    itemDiv.style.color = 'var(--text-primary)';

    // Add drag-and-drop attributes if it's not the ".." folder and not in public/admin view (unless owned)
    const canDrag = !isParentFolder && loggedInUser && (item.user_id === loggedInUser.id || isSnawAdmin());
    if (canDrag) {
        itemDiv.draggable = true;
        itemDiv.dataset.itemId = item.id;
        itemDiv.dataset.itemType = item.mime_type;
        itemDiv.dataset.itemName = item.file_name;
        itemDiv.dataset.itemPath = item.path; // Store item's current path for drag validation

        itemDiv.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('application/json', JSON.stringify({
                id: item.id,
                type: item.mime_type,
                name: item.file_name,
                path: item.path
            }));
            e.dataTransfer.effectAllowed = 'move';
            itemDiv.classList.add('opacity-50');
        });

        itemDiv.addEventListener('dragend', (e) => {
            itemDiv.classList.remove('opacity-50');
        });
    }


    itemDiv.addEventListener('click', () => {
        document.querySelectorAll('.file-item-container').forEach(el => el.style.backgroundColor = 'transparent');
        itemDiv.style.backgroundColor = 'var(--accent-focus)';
    });
    itemDiv.addEventListener('dblclick', () => handleItemClick(item, isParentFolder));
    // Context menu for file items
    itemDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showItemContextMenu(e, item, isParentFolder);
    });

    let iconHtml = '';
    const mime = isParentFolder ? 'folder' : (item.mime_type || '');
    let fileNameDisplay = isParentFolder ? '..' : item.file_name;

    if (isParentFolder) {
        iconHtml = `<svg class="w-16 h-16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.172 4L15.172 6H20V18H4V4H13.172ZM14.586 2H4A2 2 0 0 0 2 4V18A2 2 0 0 0 4 20H20A2 2 0 0 0 22 18V6A2 2 0 0 0 20 4H16L14.586 2Z"></path></svg>`;
    } else if (mime.includes('folder')) {
        iconHtml = `<svg class="w-16 h-16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 5h5.586l2 2H20v10H4V5zm0-2a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-6.414l-2-2H4z"/></svg>`;
    } else if (mime.startsWith('image/')) {
        iconHtml = `<img src="${item.s3_url}" class="w-16 h-16 object-cover border" style="border-color: var(--border-secondary);"/>`;
    } else if (mime.startsWith('audio/')) {
        iconHtml = `<svg class="w-16 h-16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55a4.002 4.002 0 00-3-1.55c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-8z"/></svg>`;
    } else {
        iconHtml = `<svg class="w-16 h-16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zm7 1.5V9h5.5L13 3.5z"/></svg>`;
    }

    if (isAdminView && !isParentFolder) { // Add owner username in admin view
        fileNameDisplay = `${item.owner_username}/${item.file_name}`;
        itemDiv.title = `${item.owner_username}/${item.path}${item.file_name} (Size: ${item.file_size ? (item.file_size / 1024 / 1024).toFixed(2) + ' MB' : '-'})`;
    }

    itemDiv.innerHTML = `<div class="relative">${iconHtml}</div><p class="text-xs mt-1 w-full break-words truncate" title="${isParentFolder ? '..' : item.file_name}">${fileNameDisplay}</p>`;

    // Make folders drop targets
    const isFolder = item.mime_type.includes('folder');
    if (isFolder && canDrag) { // Only allow dropping into folders you can manage
        itemDiv.addEventListener('dragover', handleDropTargetDragOver);
        itemDiv.addEventListener('dragleave', handleDropTargetDragLeave);
        itemDiv.addEventListener('drop', handleDrop);
        itemDiv.dataset.isDropTarget = 'true';
        // Adjust dropTargetPath to be the full path *into* this folder
        itemDiv.dataset.dropTargetPath = (currentPath.join('/') === '/' ? '/' : currentPath.join('/')) + item.file_name + '/';
    }


    return itemDiv;
}

function showItemContextMenu(e, item, isParentFolder) {
    if (isParentFolder) { // No context menu for ".."
        return;
    }

    const menuItems = [];
    const isOwner = loggedInUser && item.user_id === loggedInUser.id;
    const isFolder = item.mime_type.includes('folder');

    // View / Open (always available if file)
    if (!isFolder) {
        menuItems.push({ label: 'Open', action: () => openFileViewerWindow(item) });
    }

    // Renaming (owner or Snaw admin)
    if (isOwner || isSnawAdmin()) {
        menuItems.push({ label: 'Rename', action: () => handleRename(item) });
    }

    // Delete (owner or Snaw admin)
    if (isOwner || isSnawAdmin()) {
        menuItems.push({ label: 'Delete', action: () => showDeleteModal(item) });
    }

    if (!isFolder && isOwner) { // Only owner can change public status
        menuItems.push({ label: item.is_public ? 'Make Private' : 'Make Public', action: () => showShareModal(item, true) }); // Pass true to indicate toggle privacy
    }

    if (!isFolder) { // Share link for any file (public or owned)
        menuItems.push({ label: 'Get Share Link', action: () => handleShareFile(item) });
    }

    if (menuItems.length > 0) {
        createContextMenu(e.evt, menuItems); // Use the centralized createContextMenu
    }
}

function handleItemClick(item, isParentFolder) {
    if (isParentFolder) {
        // Navigate up one level
        if (currentPath.length > 1) { // Check if not already at root
            currentPath.pop(); // Remove the last segment (which is the current folder)
        }
        if (currentPath.length === 0) { // If it becomes empty, set to root
            currentPath = ['/'];
        }
    } else if (item.mime_type && item.mime_type.includes('folder')) {
        // Navigate into a folder
        currentPath.push(item.file_name + '/');
    } else {
        // Open file (now using the viewer window)
        openFileViewerWindow(item);
        return;
    }
    // Only re-fetch files if the path actually changed
    fetchAndRenderLibraryItems(document.querySelector('.flex.h-full')); // Re-render library items
}


async function handleCreateFolder() {
    showCustomModal('Create New Folder', `<input type="text" id="folderNameInput" class="w-full p-2" style="background-color: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-input);" placeholder="Folder Name">`, [
        { label: 'Cancel' },
        { label: 'Create', action: async ()=>{
            const folderName = document.getElementById('folderNameInput').value;
            if (!folderName.trim()) {
                showNotification("Folder name cannot be empty.", 2000);
                return; // Prevent modal from closing if name is empty
            }
            try {
                const token = localStorage.getItem('snugos_token');
                const response = await fetch(`${SERVER_URL}/api/folders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ name: folderName.trim(), path: currentPath.join('/') })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                showNotification(`Folder '${folderName}' created!`, 2000);
                fetchAndRenderLibraryItems(document.querySelector('.flex.h-full'));
            } catch (error) {
                showNotification(`Error: ${error.message}`, 5000);
            }
        }}
    ]);
}

// handleFileUpload is now simplified to call uploadFiles
function handleFileUpload() {
    document.getElementById('actualFileInput').click();
}

function handleFileInputChange(event) {
    const files = event.target.files;
    uploadFiles(Array.from(files));
    event.target.value = null; // Clear file input
}

async function uploadFiles(filesToUpload) {
    if (!loggedInUser || filesToUpload.length === 0) return;

    showNotification(`Uploading ${filesToUpload.length} file(s)...`, 3000);
    let allSuccess = true;
    let messages = [];

    for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath.join('/')); // Ensure correct path format
        formData.append('is_public', false); // Default to private

        try {
            const token = localStorage.getItem('snugos_token');
            const response = await fetch(`${SERVER_URL}/api/files/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                messages.push(`"${file.name}" uploaded successfully.`);
            } else {
                allSuccess = false;
                messages.push(`Failed to upload "${file.name}": ${data.message || 'Server error'}.`);
            }
        } catch (error) {
            allSuccess = false;
            messages.push(`Network error uploading "${file.name}".`);
            console.error(`Error uploading "${file.name}":`, error);
        }
    }
    showNotification(messages.join('\n'), 5000);
    fetchAndRenderLibraryItems(document.querySelector('.flex.h-full'));
}

function handleRename(item) {
    showCustomModal('Rename Item', `<input type="text" id="renameInput" class="w-full p-2" style="background-color: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-input);" value="${item.file_name}">`, [
        { label: 'Cancel' },
        { label: 'Rename', action: async ()=>{
            const newName = document.getElementById('renameInput').value;
            if (!newName.trim()) {
                showNotification("Name cannot be empty.", 2000);
                return;
            }
            try {
                const token = localStorage.getItem('snugos_token');
                const response = await fetch(`${SERVER_URL}/api/files/${item.id}/rename`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ newName: newName.trim() })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                showNotification("Item renamed successfully!", 2000);
                fetchAndRenderLibraryItems(document.querySelector('.flex.h-full'));
            } catch (error) {
                showNotification(`Error: ${error.message}`, 4000);
            }
        }}
    ]);
}

function showDeleteModal(item) {
    const modalContent = `<p>Permanently delete '${item.file_name}'?</p><p class="text-sm mt-2" style="color:var(--accent-armed);">This cannot be undone.</p>`;
    showCustomModal('Confirm Deletion', modalContent, [
        { label: 'Cancel' },
        { label: 'Delete', action: () => handleDeleteFile(item.id) }
    ]);
}

async function handleDeleteFile(fileId) {
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showNotification('File deleted!', 2000);
        fetchAndRenderLibraryItems(document.querySelector('.flex.h-full'));
    } catch (error) {
        showNotification(`Error: ${error.message}`, 4000);
    }
}

function showShareModal(item, togglePrivacy = false) {
    let modalTitle = 'Share Link';
    let modalContent = `<input type="text" id="shareLinkInput" class="w-full p-2 bg-input text-primary border border-input rounded-md" readonly>`;
    let buttons = [{ label: 'Close' }];

    if (togglePrivacy) {
        modalTitle = 'Confirm Privacy Change';
        const newStatusText = item.is_public ? 'private' : 'public';
        modalContent = `<p>Make '${item.file_name}' ${newStatusText}?</p>`;
        buttons = [
            { label: 'Cancel' },
            { label: 'Confirm', action: () => handleToggleFilePublic(item.id, !item.is_public) }
        ];
    } else {
        // If just getting a share link, fetch it and populate the input
        const modal = showCustomModal(modalTitle, modalContent, buttons);
        const linkInput = modal.contentDiv.querySelector('#shareLinkInput');
        linkInput.value = 'Generating...';
        handleShareLink(item).then(link => {
            if (link) linkInput.value = link;
            else linkInput.value = 'Error generating link.';
        }).catch(() => {
            linkInput.value = 'Error generating link.';
        });
        return; // Exit here as modal is shown immediately
    }

    showCustomModal(modalTitle, modalContent, buttons);
}

async function handleToggleFilePublic(fileId, newStatus) {
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/files/${fileId}/toggle-public`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ is_public: newStatus })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showNotification('File status updated!', 2000);
        fetchAndRenderLibraryItems(document.querySelector('.flex.h-full'));
    } catch (error) {
        showNotification(`Error: ${error.message}`, 4000);
    }
}

async function handleShareLink(item) {
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/files/${item.id}/share-link`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        return data.shareUrl;
    } catch (error) {
        showNotification(`Error generating share link: ${error.message}`, 4000);
        console.error("Error generating share link:", error);
        return null;
    }
}

// Drag and Drop Handlers (for uploads and internal moves)

function handleDropTargetDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/json')) {
        let targetElement = e.currentTarget;
        if (targetElement.dataset.isDropTarget === 'true' || targetElement.id === 'file-list-main-area') { // Main area
            targetElement.classList.add('drop-target-hover');
        }
    }
}

function handleDropTargetDragLeave(e) {
    e.stopPropagation();
    let targetElement = e.currentTarget;
    if (targetElement.dataset.isDropTarget === 'true' || targetElement.id === 'file-list-main-area') {
        targetElement.classList.remove('drop-target-hover');
    }
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    let targetElement = e.currentTarget;
    targetElement.classList.remove('drop-target-hover');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        await uploadFiles(files);
        return;
    }

    try {
        const draggedItemData = JSON.parse(e.dataTransfer.getData('application/json'));
        const draggedItemId = draggedItemData.id;
        const draggedItemType = draggedItemData.type;
        const draggedItemName = draggedItemData.name;
        const draggedItemCurrentPath = draggedItemData.path; // Path item was dragged from

        let dropTargetPath;

        if (targetElement.id === 'file-list-main-area') { // Dropped into main file list area
            dropTargetPath = currentPath.join('/');
        } else if (targetElement.dataset.isDropTarget === 'true' && targetElement.dataset.itemType.includes('folder')) { // Dropped onto a folder
            dropTargetPath = targetElement.dataset.dropTargetPath;
        } else {
            showNotification("Invalid drop target. You can only drop items into folders or the current directory's main area.", 3000);
            return;
        }

        // Prevent dropping onto itself (already in target location)
        if (draggedItemCurrentPath.replace(/\/+$/, '') === dropTargetPath.replace(/\/+$/, '') && draggedItemData.id === item.id) { // Added item.id check
            showNotification("Item is already in this location.", 3000);
            return;
        }

        // Prevent moving a folder into its own descendant
        const draggedItemFullPath = draggedItemCurrentPath + draggedItemName + (draggedItemType.includes('folder') ? '/' : '');
        if (draggedItemType.includes('folder') && dropTargetPath.startsWith(draggedItemFullPath)) {
            showNotification("Cannot move a folder into its own subfolder.", 3000);
            return;
        }

        // Final check for name conflict at destination (server will also check)
        // This would require fetching current directory contents, more complex.
        // Rely on server-side check primarily.

        await handleMoveItem(draggedItemId, dropTargetPath);

    } catch (error) {
        console.error("Drag and drop error:", error);
        showNotification("An error occurred during drag and drop. " + error.message, 5000);
    }
}

async function handleMoveItem(draggedItemId, targetPath) {
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/files/${draggedItemId}/move`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetPath: targetPath })
        });
        const data = await response.json();
        if (data.success) {
            showNotification(data.message || "Item moved successfully.", 2000);
            fetchAndRenderLibraryItems(document.querySelector('.flex.h-full')); // Re-fetch files to update UI
        } else {
            showNotification(data.message || "Failed to move item.", 4000);
        }
    } catch (error) {
        console.error("Error moving item:", error);
        showNotification("Network error moving item.", 4000);
    }
}

// --- Main Application Initialization ---
document.addEventListener('DOMContentLoaded', async () => { // Marked async
    // Populate appServices for this standalone desktop's context
    Object.assign(appServices, {
        // Window management from windowState.js (imported above)
        getWindowById: getWindowById, addWindowToStore: addWindowToStore, removeWindowFromStore: removeWindowFromStore,
        incrementHighestZ: incrementHighestZ, getHighestZ: getHighestZ, setHighestZ: setHighestZ, getOpenWindows: getOpenWindows,
        serializeWindows: serializeWindows, reconstructWindows: reconstructWindows,

        // Utilities from utils.js (imported above)
        showNotification: showNotification, showCustomModal: showCustomModal, createContextMenu: createContextMenu,

        // AppState functions (for theme management)
        applyUserThemePreference: applyUserThemePreference, // local helper for theme
        setCurrentUserThemePreference: setCurrentUserThemePreference,
        getCurrentUserThemePreference: getCurrentUserThemePreference,

        // DB functions from db.js (for asset handling)
        storeAudio: storeAudio, getAudio: getAudio, deleteAudio: deleteAudio, storeAsset: storeAsset, getAsset: getAsset,

        // File Viewer UI
        openFileViewerWindow: openFileViewerWindow, // From fileViewerUI.js
        initializeFileViewerUI: initializeFileViewerUI, // From fileViewerUI.js

        // Core SnugWindow constructor for this browser app to open its own child windows
        createWindow: (id, title, content, options) => new SnugWindow(id, title, content, options, appServices),
    });

    // Initialize File Viewer UI module as it's used directly here
    appServices.initializeFileViewerUI(appServices);

    // Initialize auth module and get logged in user
    await import('/app/js/daw/auth.js').then(auth => {
        auth.initializeAuth(appServices); // Initialize auth.js with current appServices
        loggedInUser = auth.getLoggedInUser(); // Get the current user from auth.js
        // Add a handler for when auth state changes in auth.js (e.g., login/logout)
        appServices.onAuthChange = (user) => {
            loggedInUser = user;
            renderApp(); // Re-render desktop on auth change
        };
    });


    // Initial setup of common desktop elements and event listeners
    attachDesktopEventListeners();
    applyUserThemePreference();
    updateClockDisplay();
    initAudioOnFirstGesture();

    // Initial render of the browser app based on login status
    renderApp();
});


function renderApp() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return; // Ensure desktop exists

    let appContentHTML = `
        <div class="flex flex-col h-full bg-window-content">
            <header class="p-2 border-b border-secondary flex items-center justify-between">
                <nav class="text-sm">
                    <ol id="breadcrumbs" class="list-none p-0 inline-flex items-center text-primary">
                        <li><button class="hover:underline font-medium" id="root-folder-btn">/</button></li>
                    </ol>
                </nav>
                <div class="flex space-x-2">
                    <button id="my-files-btn" class="px-3 py-1 text-xs border rounded active" style="background-color: var(--bg-button); color: var(--text-button); border-color: var(--border-button);">My Files</button>
                    <button id="public-files-btn" class="px-3 py-1 text-xs border rounded" style="background-color: var(--bg-button); color: var(--text-button); border-color: var(--border-button);">Public</button>
                    <button id="admin-files-btn" class="px-3 py-1 text-xs border rounded ${isSnawAdmin() ? '' : 'hidden'}" style="background-color: var(--bg-button); color: var(--text-button); border-color: var(--border-button);">Admin</button>
                </div>
            </header>
            <div class="p-4 flex-grow overflow-y-auto" id="file-list-main-area">
                </div>
            <footer class="p-2 border-t border-secondary flex justify-between items-center">
                <button id="create-folder-btn" class="px-3 py-1 text-xs border rounded" style="background-color: var(--bg-button); color: var(--text-button); border-color: var(--border-button);">New Folder</button>
                <input type="file" id="actualFileInput" class="hidden" multiple>
                <button id="upload-file-btn" class="px-3 py-1 text-xs border rounded" style="background-color: var(--bg-button); color: var(--text-button); border-color: var(--border-button);">Upload File</button>
            </footer>
        </div>
    `;

    if (!loggedInUser) {
        desktop.innerHTML = `<div class="w-full h-full flex items-center justify-center"><p class="text-xl" style="color:var(--text-primary);">Please log in to use the Browser.</p></div>`;
        showLoginModalBrowser(); // Show login modal
        return;
    }

    desktop.innerHTML = appContentHTML; // Replace desktop content with browser UI

    // Attach event listeners for internal UI elements after they are added to the DOM
    document.getElementById('root-folder-btn')?.addEventListener('click', () => { currentPath = ['/']; renderApp(); });
    document.getElementById('my-files-btn')?.addEventListener('click', () => { currentViewMode = 'my-files'; isAdminView = false; currentPath = ['/']; renderApp(); });
    document.getElementById('public-files-btn')?.addEventListener('click', () => { currentViewMode = 'public-files'; isAdminView = false; currentPath = ['/']; renderApp(); });
    document.getElementById('admin-files-btn')?.addEventListener('click', () => {
        isAdminView = !isAdminView;
        currentViewMode = 'my-files'; // Admin view is always "my files" from a flat perspective
        currentPath = ['/'];
        renderApp();
    });

    document.getElementById('create-folder-btn')?.addEventListener('click', handleCreateFolder);
    document.getElementById('upload-file-btn')?.addEventListener('click', handleFileUpload);
    document.getElementById('actualFileInput')?.addEventListener('change', handleFileInputChange);

    // Apply drag and drop listeners to the main file-list-main-area
    const fileListMainArea = document.getElementById('file-list-main-area');
    if (fileListMainArea) {
        fileListMainArea.addEventListener('dragover', handleDropTargetDragOver);
        fileListMainArea.addEventListener('dragleave', handleDropTargetDragLeave);
        fileListMainArea.addEventListener('drop', handleDrop);
        fileListMainArea.id = 'file-list-main-area'; // Ensure it has the correct ID
    }

    renderBreadcrumbs();
    fetchAndRenderLibraryItems(desktop); // Pass desktop as the container for UI elements
}

function renderBreadcrumbs() {
    const breadcrumbsNav = document.getElementById('breadcrumbs');
    if (!breadcrumbsNav) return;

    breadcrumbsNav.innerHTML = '';
    const pathSegments = currentPath.filter(segment => segment !== '/'); // Filter out the initial '/' if present

    let currentPathAccumulated = '/';

    // "My Drive" or "All Files (Admin)" root button
    let rootLi = document.createElement('li');
    let rootBtn = document.createElement('button');
    rootBtn.className = 'hover:underline font-medium';
    rootBtn.style.setProperty('color', 'var(--text-primary)');

    if (isAdminView && isSnawAdmin()) {
        rootBtn.textContent = 'All Files (Admin View)';
        rootBtn.onclick = () => { currentPath = ['/']; isAdminView = true; renderApp(); };
    } else {
        rootBtn.textContent = 'My Drive';
        rootBtn.onclick = () => { currentPath = ['/']; isAdminView = false; renderApp(); };
    }
    rootLi.appendChild(rootBtn);
    breadcrumbsNav.appendChild(rootLi);


    // Add other segments for non-admin view
    if (!isAdminView) {
        pathSegments.forEach((segment, index) => {
            currentPathAccumulated += segment; // segment already includes trailing slash
            let li = document.createElement('li');
            li.className = 'flex items-center';
            li.innerHTML = '<span class="mx-2" style="color: var(--text-secondary);">/</span>';
            let btn = document.createElement('button');
            btn.className = 'hover:underline font-medium';
            btn.style.setProperty('color', 'var(--text-primary)');
            btn.textContent = segment.replace(/\/$/, ''); // Remove trailing slash for display
            const navPath = currentPathAccumulated; // Capture path for closure
            btn.onclick = () => {
                currentPath = navPath.split('/').filter(s => s !== ''); // Reconstruct array path
                currentPath = currentPath.length === 0 ? ['/'] : currentPath.map(s => s + '/'); // Add trailing slashes back
                renderApp();
            };
            li.appendChild(btn);
            breadcrumbsNav.appendChild(li);
        });
    }
}