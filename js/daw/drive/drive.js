// js/daw/drive/drive.js
// NOTE: This file is designed to run within an iframe (drive.html), hosted by the main index.html.
// It receives `appServices` from its parent window.

// All utilities and constants are now expected to come via appServices,
// or are defined locally if they are truly unique to this module.

// NEW: Import centralized auth functions
import { showLoginModal as centralizedShowLoginModal, handleLogin as centralizedHandleLogin, handleRegister as centralizedHandleRegister, handleLogout as centralizedHandleLogout, getLoggedInUser } from '/app/js/daw/auth.js';
// NEW: Import showNotification and showCustomModal from utils.js (assuming appServices will pass it)
import { showNotification, showCustomModal, createContextMenu } from '/app/js/daw/utils.js';


let appServices = {}; // This will be assigned the actual appServices object from the parent.
let loggedInUser = null; // Will be set from appServices
let currentPath = '/';
let isAdminView = false; // Flag for 'snaw' to view all files

// --- Entry Point ---
/**
 * Entry point function for the Drive page when loaded within an iframe.
 * This function is called by the parent window's `initializePage` function.
 * @param {object} injectedAppServices - The appServices object passed from the parent window.
 */
function initDrivePageInIframe(injectedAppServices) {
    appServices = injectedAppServices; // Assign the injected appServices

    // Check auth state immediately via appServices
    loggedInUser = appServices.getLoggedInUser?.();

    // Attach event listeners for Drive-specific UI
    attachDriveEventListeners();

    // Initial render of the Drive
    renderApp();

    // Update auth UI to reflect parent's state
    // The parent's updateAuthUI is complex, simplified for iframe context
    updateAuthUI(loggedInUser); // Call a local updateAuthUI for this iframe
}

// Make the initialization function globally accessible for the parent window.
window.initDrivePageInIframe = initDrivePageInIframe;

// --- Utility Functions (Adapted to use appServices for shared features) ---

// Assuming appServices will provide showLoading/hideLoading as it does in main.js
function showLoading() { appServices.showLoading?.(); }
function hideLoading() { appServices.hideLoading?.(); }
// Updated to use centralized showCustomModal
function showMessage(msg, onConfirm = null, showCancel = false, onCancel = null) {
    appServices.showCustomModal?.('Message', `<p class="p-4">${msg}</p>`, [ // Basic content wrapper
        { label: 'OK', action: onConfirm || (() => {}) },
        ...(showCancel ? [{ label: 'Cancel', action: onCancel || (() => {}) }] : [])
    ]);
}
// showInputDialog uses appServices.showCustomInputModal, defined in welcome.js/main.js
function showInputDialog(title, placeholder, initialValue, onConfirmCallback) {
    appServices.showCustomInputModal?.(title, placeholder, initialValue, onConfirmCallback);
}


// --- Icon SVGs (Inline - these are unique to Drive's UI) ---
const getFolderIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-folder mr-3 flex-shrink-0" style="color: currentColor;"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
const getFileIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-file-text mr-3 flex-shrink-0" style="color: currentColor;"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v6h6"/><path d="M10 12H8"/><path d="M16 16H8"/><path d="M16 20H8"/></svg>`;
const getEditIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-edit"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const getTrashIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
const getEyeIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const getEyeOffIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.06 18.06 0 0 1 5.34-4.34M7.52 3.13A9.01 9.01 0 0 1 12 4c7 0 10 7 10 7a18.06 18.06 0 0 1-2.5 3.06"/><circle cx="12" cy="12" r="3"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`;
const getShareIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-share-2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>`;


// --- Authentication & UI Update Functions (use appServices for communication with parent) ---

function updateAuthUI(user = null) {
    loggedInUser = user; // Update local state for this iframe
    const loggedInUserSpan = document.getElementById('logged-in-user');
    const logoutBtn = document.getElementById('logout-btn');

    if (user && loggedInUserSpan) {
        loggedInUserSpan.innerHTML = `Logged in as: <span class="font-semibold" style="color: var(--text-primary);">${user.username}</span>`;
        logoutBtn?.classList.remove('hidden');
    } else {
        loggedInUserSpan.textContent = ''; // Clear user display
        logoutBtn?.classList.add('hidden');
    }
    // Re-fetch files to update visibility/interactivity based on login status
    fetchFiles();
}

// --- File Management Functions ---

async function fetchFiles() {
    // Rely on appServices to provide login status
    if (!loggedInUser) {
        // If not logged in, show appropriate message and clear file list
        document.getElementById('file-list').innerHTML = `
            <p class="col-span-full text-center text-gray-500 py-8" style="color: var(--text-secondary);">
                Please log in to view your files.
            </p>
        `;
        document.getElementById('breadcrumbs').classList.add('hidden'); // Hide breadcrumbs if not logged in
        document.getElementById('snaw-admin-section').classList.add('hidden'); // Hide admin section
        return;
    }

    showLoading(); // Use local loading indicator
    try {
        const token = localStorage.getItem('snugos_token'); // Get token from local storage
        if (!token) {
            // If token is missing even if loggedInUser is set, means desynced.
            // Trigger parent logout for full reset.
            centralizedHandleLogout(); // Use centralized logout
            return;
        }

        let apiUrl = `${SERVER_URL}/api/files/my?path=${encodeURIComponent(currentPath)}`;
        // If 'snaw' and in admin view, fetch all files
        if (loggedInUser.username === 'snaw' && isAdminView) {
            apiUrl = `${SERVER_URL}/api/admin/files`;
        }

        const response = await fetch(apiUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            if (loggedInUser.username === 'snaw' && isAdminView) {
                renderFileListAdmin(data.items);
            } else {
                const sortedItems = data.items.sort((a, b) => {
                    const isAFolder = a.mime_type === 'application/vnd.snugos.folder';
                    const isBFolder = b.mime_type === 'application/vnd.snugos.folder';

                    if (isAFolder && !isBFolder) return -1;
                    if (!isAFolder && isBFolder) return 1;
                    return a.file_name.localeCompare(b.file_name);
                });
                renderFileList(sortedItems);
            }
        } else {
            // Show error message via centralized notification
            showNotification(data.message || "Failed to load files.", 4000);
            renderFileList([]); // Render empty list on error
        }
    } catch (error) {
        console.error("Error fetching files:", error);
        showNotification("Network error while fetching files. Please try again.", 4000);
        renderFileList([]);
    } finally {
        hideLoading(); // Use local loading indicator
    }
}

async function handleCreateFolder() {
    // Use centralized input dialog and notification
    showInputDialog('Create New Folder', 'Folder Name', '', async (name) => {
        if (!name.trim()) {
            showNotification("Folder name cannot be empty.", 2000);
            return false;
        }
        showLoading();
        try {
            const token = localStorage.getItem('snugos_token');
            const response = await fetch(`${SERVER_URL}/api/folders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: name.trim(), path: currentPath })
            });
            const data = await response.json();
            if (data.success) {
                showNotification("Folder created successfully!", 2000);
                fetchFiles();
                return true;
            } else {
                showNotification(data.message || "Failed to create folder.", 4000);
                return false;
            }
        } catch (error) {
            console.error("Error creating folder:", error);
            showNotification("Network error creating folder.", 4000);
            return false;
        } finally {
            hideLoading();
        }
    });
}

// Centralized file upload logic
async function uploadFiles(filesToUpload) {
    if (!loggedInUser || filesToUpload.length === 0) return;

    showLoading();
    let allSuccess = true;
    let messages = [];

    for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);
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
    showNotification(messages.join('\n'), 5000); // Consolidated notification
    fetchFiles();
    hideLoading();
}

function handleUploadClick() {
    document.getElementById('file-upload-input').click();
}

function handleFileInputChange(event) {
    const files = event.target.files;
    uploadFiles(Array.from(files));
    event.target.value = null; // Reset file input
}

function handleRename(item) {
    // Use centralized input dialog and notification
    showInputDialog(`Rename ${item.file_name}`, 'New Name', item.file_name, async (newName) => {
        if (!newName.trim()) {
            showNotification("Name cannot be empty.", 2000);
            return false;
        }
        showLoading();
        try {
            const token = localStorage.getItem('snugos_token');
            const response = await fetch(`${SERVER_URL}/api/files/${item.id}/rename`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newName: newName.trim() })
            });
            const data = await response.json();
            if (data.success) {
                showNotification("Item renamed successfully.", 2000);
                fetchFiles();
                return true;
            } else {
                showNotification(data.message || "Failed to rename item.", 4000);
                return false;
            }
        } catch (error) {
            console.error("Error renaming item:", error);
            showNotification("Network error renaming item.", 4000);
            return false;
        } finally {
            hideLoading();
        }
    });
}

function handleDeleteItem(item) {
    // Use centralized confirmation dialog and notification
    appServices.showConfirmationDialog?.(`Are you sure you want to delete "${item.file_name}"?`, 'This action cannot be undone.', async () => {
        showLoading();
        try {
            const token = localStorage.getItem('snugos_token');
            const response = await fetch(`${SERVER_URL}/api/files/${item.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                showNotification(`"${item.file_name}" deleted successfully.`, 2000);
                fetchFiles();
            } else {
                showNotification(data.message || "Failed to delete item.", 4000);
            }
        } catch (error) {
            console.error("Error deleting item:", error);
            showNotification("Network error deleting item.", 4000);
        } finally {
            hideLoading();
        }
    });
}

async function handleTogglePublic(item) {
    showLoading();
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/files/${item.id}/toggle-public`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ is_public: !item.is_public })
        });
        const data = await response.json();
        if (data.success) {
            showNotification(`"${item.file_name}" is now ${data.file.is_public ? 'public' : 'private'}.`, 2000);
            fetchFiles();
        } else {
            showNotification(data.message || "Failed to change public status.", 4000);
        }
    } catch (error) {
        console.error("Error toggling public status:", error);
        showNotification("Network error changing public status.", 4000);
    } finally {
        hideLoading();
    }
}

async function handleShareLink(item) {
    showLoading();
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/files/${item.id}/share-link`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            navigator.clipboard.writeText(data.shareUrl).then(() => {
                showNotification("Share link copied to clipboard!", 2000);
            }).catch(err => {
                // Fallback for older browsers or if clipboard API fails (e.g., iframe restrictions)
                const textarea = document.createElement('textarea');
                textarea.value = data.shareUrl;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showNotification("Share link copied to clipboard! (Fallback method)", 3000);
                console.warn("Clipboard API not available, falling back to execCommand.");
            });
        } else {
            showNotification(data.message || "Failed to generate share link.", 4000);
        }
    } catch (error) {
        console.error("Error generating share link:", error);
        showNotification("Network error generating share link.", 4000);
    } finally {
        hideLoading();
    }
}

async function handleMoveItem(draggedItemId, targetPath) {
    showLoading();
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
            fetchFiles(); // Re-fetch files to update UI
        } else {
            showNotification(data.message || "Failed to move item.", 4000);
        }
    } catch (error) {
        console.error("Error moving item:", error);
        showNotification("Network error moving item.", 4000);
    } finally {
        hideLoading();
    }
}

// --- UI Rendering Functions ---

function renderBreadcrumbs() {
    const breadcrumbsNav = document.getElementById('breadcrumbs'); // Get reference from provided HTML
    if (!breadcrumbsNav) return;

    breadcrumbsNav.innerHTML = '';
    const pathSegments = currentPath.split('/').filter(segment => segment !== '');

    let myDriveLi = document.createElement('li');
    myDriveLi.className = 'flex items-center';
    let myDriveBtn = document.createElement('button');
    myDriveBtn.className = 'hover:underline font-medium';
    myDriveBtn.style.setProperty('color', 'var(--text-primary)');
    myDriveBtn.textContent = 'My Drive';
    myDriveBtn.onclick = () => {
        currentPath = '/';
        isAdminView = false; // Exit admin view if navigating from breadcrumbs
        renderApp();
    };
    myDriveLi.appendChild(myDriveBtn);
    breadcrumbsNav.appendChild(myDriveLi);

    // Hide breadcrumbs if in admin view
    if (isAdminView && loggedInUser.username === 'snaw') {
        breadcrumbsNav.classList.add('hidden');
        // Display a clear indicator for admin view
        const adminIndicator = document.createElement('li');
        adminIndicator.className = 'flex items-center';
        adminIndicator.innerHTML = '<span class="mx-2" style="color: var(--text-secondary);">/</span><span class="font-bold" style="color: var(--text-primary);">All Files (Admin View)</span>';
        breadcrumbsNav.appendChild(adminIndicator);
        breadcrumbsNav.classList.remove('hidden'); // Show it
        return;
    } else {
        breadcrumbsNav.classList.remove('hidden'); // Ensure breadcrumbs are visible for normal view
    }

    let accumulatedPath = '/';
    pathSegments.forEach((segment, index) => {
        accumulatedPath += segment + '/';
        let li = document.createElement('li');
        li.className = 'flex items-center';
        li.innerHTML = '<span class="mx-2" style="color: var(--text-secondary);">/</span>';
        let btn = document.createElement('button');
        btn.className = 'hover:underline font-medium';
        btn.style.setProperty('color', 'var(--text-primary)');
        btn.textContent = segment;
        // Capture the path for this segment in a closure
        const navPath = accumulatedPath;
        btn.onclick = () => {
            currentPath = navPath;
            renderApp();
        };
        li.appendChild(btn);
        breadcrumbsNav.appendChild(li);
    });
}


function renderFileList(items) {
    const fileListDiv = document.getElementById('file-list'); // Get reference from provided HTML
    if (!fileListDiv) return;

    fileListDiv.innerHTML = ''; // Clear previous items

    if (items.length === 0) {
        fileListDiv.innerHTML = `
            <p class="col-span-full text-center py-8" style="color: var(--text-secondary);">
                This folder is empty. Create a new folder or upload a file!
            </p>
        `;
    }

    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'shadow-lg hover:shadow-xl transition-shadow duration-200 p-4 flex flex-col items-start space-y-3 relative';
        itemDiv.style.setProperty('background-color', 'var(--bg-window)');
        itemDiv.style.setProperty('border', '1px solid var(--border-primary)');
        itemDiv.style.setProperty('color', 'var(--text-primary)');
        itemDiv.style.setProperty('border-radius', '3px');

        itemDiv.draggable = true; // Make items draggable
        itemDiv.dataset.itemId = item.id;
        itemDiv.dataset.itemType = item.mime_type;
        itemDiv.dataset.itemName = item.file_name;
        itemDiv.dataset.itemPath = item.path; // Store item's current path for drag validation

        // Drag start event
        itemDiv.addEventListener('dragstart', (e) => {
            // Store item details as JSON in dataTransfer
            e.dataTransfer.setData('application/json', JSON.stringify({
                id: item.id,
                type: item.mime_type,
                name: item.file_name,
                path: item.path // Include current path to validate self-move later
            }));
            e.dataTransfer.effectAllowed = 'move';
            itemDiv.classList.add('opacity-50');
        });

        itemDiv.addEventListener('dragend', (e) => {
            itemDiv.classList.remove('opacity-50');
        });


        const isFolder = item.mime_type === 'application/vnd.snugos.folder';
        const nameElement = document.createElement(isFolder ? 'button' : 'a');
        nameElement.className = 'flex items-center text-left group w-full';
        nameElement.style.setProperty('color', 'var(--text-primary)');
        nameElement.innerHTML = (isFolder ? getFolderIcon() : getFileIcon()) + `<span class="font-${isFolder ? 'semibold' : 'medium'} text-lg truncate flex-grow">${item.file_name}</span>`;

        if (isFolder) {
            nameElement.onclick = () => {
                currentPath = currentPath === '/' ? `/${item.file_name}/` : `${currentPath}${item.file_name}/`;
                isAdminView = false; // Exit admin view if navigating into folder
                renderApp();
            };

            // Make folders drop targets
            itemDiv.addEventListener('dragover', handleDropTargetDragOver);
            itemDiv.addEventListener('dragleave', handleDropTargetDragLeave);
            itemDiv.addEventListener('drop', handleDrop);

            // Add a data attribute to indicate it's a folder drop target
            itemDiv.dataset.isDropTarget = 'true';
            itemDiv.dataset.dropTargetPath = currentPath + item.file_name + '/'; // Path where dropped item will reside
        } else {
            // For files, open in File Viewer window instead of direct link
            nameElement.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default link behavior
                appServices.openFileViewerWindow?.(item);
            });
            // Original href for right-click open in new tab still works
            nameElement.href = item.s3_url;
            nameElement.target = '_blank';
            nameElement.rel = 'noopener noreferrer';
        }
        itemDiv.appendChild(nameElement);

        // Actions div
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex flex-wrap gap-2 pt-2 border-t w-full justify-start mt-auto';
        actionsDiv.style.setProperty('border-color', 'var(--border-secondary)');

        // Rename Button
        const renameBtn = document.createElement('button');
        renameBtn.className = 'item-action-btn';
        renameBtn.title = 'Rename';
        renameBtn.innerHTML = getEditIcon();
        renameBtn.onclick = () => handleRename(item);
        actionsDiv.appendChild(renameBtn);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'item-action-btn';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = getTrashIcon();
        deleteBtn.onclick = () => handleDeleteItem(item);
        actionsDiv.appendChild(deleteBtn);

        if (!isFolder) {
            // Toggle Public Button
            const togglePublicBtn = document.createElement('button');
            togglePublicBtn.className = 'item-action-btn';
            togglePublicBtn.title = item.is_public ? "Make Private" : "Make Public";
            togglePublicBtn.innerHTML = item.is_public ? getEyeOffIcon() : getEyeIcon();
            togglePublicBtn.onclick = () => showShareModal(item, true); // Pass true to indicate toggle privacy
            actionsDiv.appendChild(togglePublicBtn);

            // Share Link Button
            const shareLinkBtn = document.createElement('button');
            shareLinkBtn.className = 'item-action-btn';
            shareLinkBtn.title = 'Get Share Link';
            shareLinkBtn.innerHTML = getShareIcon();
            shareLinkBtn.onclick = () => showShareModal(item, false); // Pass false for just share link
            actionsDiv.appendChild(shareLinkBtn);
        }

        itemDiv.appendChild(actionsDiv);
        fileListDiv.appendChild(itemDiv);
    });
}

// Renders file list for 'snaw' admin view (shows paths)
function renderFileListAdmin(items) {
    const fileListDiv = document.getElementById('file-list'); // Get reference
    if (!fileListDiv) return;

    fileListDiv.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'w-full text-sm text-left';
    table.style.setProperty('color', 'var(--text-primary)');
    table.style.setProperty('border', '1px solid var(--border-primary)');
    table.style.setProperty('background-color', 'var(--bg-window)');
    table.style.setProperty('border-radius', '3px');

    table.innerHTML = `
        <thead style="background-color: var(--bg-title-bar); color: var(--text-title-bar);">
            <tr>
                <th class="p-3">Type</th>
                <th class="p-3">Name</th>
                <th class="p-3">Owner</th>
                <th class="p-3">Path</th>
                <th class="p-3">Size</th>
                <th class="p-3">Public</th>
                <th class="p-3">Actions</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-3 text-center" style="color: var(--text-secondary);">No files found across all users.</td></tr>`;
    }

    items.forEach(item => {
        const isFolder = item.mime_type === 'application/vnd.snugos.folder';
        const row = document.createElement('tr');
        row.className = 'border-b';
        row.style.setProperty('border-color', 'var(--border-secondary)');
        row.style.setProperty('background-color', 'var(--bg-window-content)');

        let fileNameDisplay = item.file_name;
        if (!isFolder) {
            // For files in admin view, open in file viewer
            fileNameDisplay = `<button class="hover:underline" onclick="appServices.openFileViewerWindow?.(${JSON.stringify(item).replace(/"/g, '&quot;')})">${item.file_name}</button>`;
        }

        row.innerHTML = `
            <td class="p-3">${isFolder ? 'Folder' : 'File'}</td>
            <td class="p-3">${fileNameDisplay}</td>
            <td class="p-3">${item.owner_username || item.user_id}</td>
            <td class="p-3 truncate max-w-[200px]">${item.path}</td>
            <td class="p-3">${item.file_size ? (item.file_size / 1024 / 1024).toFixed(2) + ' MB' : '-'}</td>
            <td class="p-3">${item.is_public ? 'Yes' : 'No'}</td>
            <td class="p-3">
                <div class="flex flex-wrap gap-1">
                    <button class="item-action-btn" title="Rename" onclick="handleRename(${JSON.stringify(item).replace(/"/g, '&quot;')})">${getEditIcon()}</button>
                    <button class="item-action-btn" title="Delete" onclick="handleDeleteItem(${JSON.stringify(item).replace(/"/g, '&quot;')})" style="color: #EF4444;">${getTrashIcon()}</button>
                    ${!isFolder ? `<button class="item-action-btn" title="${item.is_public ? 'Make Private' : 'Make Public'}" onclick="showShareModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, true)">${item.is_public ? getEyeOffIcon() : getEyeIcon()}</button>` : ''}
                    ${!isFolder ? `<button class="item-action-btn" title="Get Share Link" onclick="showShareModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, false)">${getShareIcon()}</button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    fileListDiv.appendChild(table);
}

// --- Drag and Drop Handlers (for uploads and internal moves) ---

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
            dropTargetPath = currentPath.join(''); // Use join('') as currentPath is an array of segments
        } else if (targetElement.dataset.isDropTarget === 'true' && targetElement.dataset.itemType.includes('folder')) { // Dropped onto a folder
            dropTargetPath = targetElement.dataset.dropTargetPath;
        } else {
            showNotification("Invalid drop target. You can only drop items into folders or the current directory's main area.", 3000);
            return;
        }

        // Prevent dropping onto itself (already in target location)
        // Adjust this check for folders vs files and correct path formats
        const draggedItemNormalizedPath = draggedItemCurrentPath.endsWith('/') ? draggedItemCurrentPath : draggedItemCurrentPath + '/';
        const dropTargetNormalizedPath = dropTargetPath.endsWith('/') ? dropTargetPath : dropTargetPath + '/';

        if (draggedItemNormalizedPath === dropTargetNormalizedPath) {
            showNotification("Item is already in this location.", 3000);
            return;
        }
        // Prevent moving a folder into its own descendant
        const draggedItemFullPath = draggedItemCurrentPath + draggedItemName + (draggedItemType.includes('folder') ? '/' : '');
        if (draggedItemType.includes('folder') && dropTargetNormalizedPath.startsWith(draggedItemFullPath)) {
            showNotification("Cannot move a folder into its own subfolder.", 3000);
            return;
        }

        await handleMoveItem(draggedItemId, dropTargetPath);

    } catch (error) {
        console.error("Drag and drop error:", error);
        showNotification("An error occurred during drag and drop. " + error.message, 5000);
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