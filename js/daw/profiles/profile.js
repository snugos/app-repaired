// js/daw/profiles/profile.js
// NOTE: This file is the main JavaScript for the standalone SnugOS Profile application (profile.html).
// It manages its own desktop UI and profile-specific logic.

// Corrected imports to be absolute paths
import { SnugWindow } from '/app/js/daw/SnugWindow.js';
import { showNotification, showCustomModal, createContextMenu } from '/app/js/daw/utils.js';
import { storeAsset, getAsset } from '/app/js/daw/db.js';
import * as Constants from '/app/js/daw/constants.js';
import { getWindowById, addWindowToStore, removeWindowFromStore, incrementHighestZ, getHighestZ, setHighestZ, getOpenWindows, serializeWindows, reconstructWindows } from '/app/js/daw/state/windowState.js';
import { getCurrentUserThemePreference, setCurrentUserThemePreference } from '/app/js/daw/state/appState.js';

const SERVER_URL = 'https://snugos-server-api.onrender.com';
let loggedInUser = null;
let currentProfileData = null;
let isEditing = false;
const appServices = {}; // This will be populated locally for this standalone app.

// --- Global UI and Utility Functions (Defined first to ensure availability) ---

// Theme-related functions
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

async function handleBackgroundUpload(file) {
    if (!loggedInUser) {
        showNotification('You must be logged in to save a background.', 3000);
        return;
    }
    try {
        await storeAsset(`background-for-user-${loggedInUser.id}`, file);
        loadAndApplyGlobals(); // Re-apply global background
        showNotification('Background saved locally!', 2000);
    } catch (error) {
        showNotification(`Error saving background: ${error.message}`, 3000);
    }
}

async function loadAndApplyGlobals() {
    if (!loggedInUser) return;
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/profile/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        if (data.success && data.profile.background_url) {
            const desktop = document.getElementById('desktop');
            if(desktop) {
                desktop.style.backgroundImage = `url(${data.profile.background_url})`;
                desktop.style.backgroundSize = 'cover';
                desktop.style.backgroundPosition = 'center';
            }
        }
    } catch (error) {
        console.error("Could not apply global settings:", error);
    }
}


// Authentication/Login/Logout Functions
function checkLocalAuth() {
    try {
        const token = localStorage.getItem('snugos_token');
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('snugos_token');
            return null;
        }
        return { id: payload.id, username: payload.username };
    } catch (e) {
        localStorage.removeItem('snugos_token');
        return null;
    }
}

async function handleLogin(username, password) {
    try {
        const response = await fetch(`${SERVER_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('snugos_token', data.token);
            loggedInUser = data.user;
            showNotification(`Welcome, ${data.user.username}!`, 2000);
            window.location.reload(); // Reload the page to fully initialize with logged-in user
        } else {
            showNotification(`Login failed: ${data.message}`, 3000);
        }
    } catch (error) {
        showNotification('Network error.', 3000);
        console.error("Login Error:", error);
    }
}

async function handleRegister(username, password) {
    try {
        const response = await fetch(`${SERVER_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success) {
            showNotification('Registration successful! Please log in.', 2500);
        } else {
            showNotification(`Registration failed: ${data.message}`, 3000);
        }
    } catch (error) {
        showNotification('Network error.', 3000);
        console.error("Register Error:", error);
    }
}

function handleLogout() {
    localStorage.removeItem('snugos_token');
    loggedInUser = null;
    showNotification('You have been logged out.', 2000);
    window.location.reload(); // Reload the page to reflect logout status
}

function showLoginModal() {
    const modalContent = `
        <div class="space-y-4">
            <div>
                <h3 class="font-bold mb-2">Login</h3>
                <form id="loginForm" class="space-y-3">
                    <input type="text" id="loginUsername" placeholder="Username" required class="w-full p-2 border rounded" style="background-color: var(--bg-input); color: var(--text-primary);">
                    <input type="password" id="loginPassword" placeholder="Password" required class="w-full p-2 border rounded" style="background-color: var(--bg-input); color: var(--text-primary);">
                    <button type="submit" class="w-full p-2 rounded" style="background-color: var(--bg-button); color: var(--text-button); border: 1px solid var(--border-button);">Login</button>
                </form>
            </div>
            <hr style="border-color: var(--border-secondary);">
            <div>
                <h3 class="font-bold mb-2">Register</h3>
                <form id="registerForm" class="space-y-3">
                    <input type="text" id="registerUsername" placeholder="Username" required class="w-full p-2 border rounded" style="background-color: var(--bg-input); color: var(--text-primary);">
                    <input type="password" id="registerPassword" placeholder="Password (min. 6)" required class="w-full p-2 border rounded" style="background-color: var(--bg-input); color: var(--text-primary);">
                    <button type="submit" class="w-full p-2 rounded" style="background-color: var(--bg-button); color: var(--text-button); border: 1px solid var(--border-button);">Register</button>
                </form>
            </div>
        </div>
    `;
    const { overlay } = showCustomModal('Login or Register', modalContent, []);
    overlay.querySelector('#loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = overlay.querySelector('#loginUsername').value;
        const password = overlay.querySelector('#loginPassword').value;
        await handleLogin(username, password);
        overlay.remove();
    });
    overlay.querySelector('#registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = overlay.querySelector('#registerUsername').value;
        const password = overlay.querySelector('#registerPassword').value;
        await handleRegister(username, password);
        overlay.remove();
    });
}

// Global UI functions (clock, start menu, full screen, desktop event listeners)
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

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            showNotification(`Error: ${err.message}`, 3000);
        });
    } else {
        if(document.exitFullscreen) document.exitFullscreen();
    }
}

function attachDesktopEventListeners() {
    // Top-level elements
    document.getElementById('startButton')?.addEventListener('click', toggleStartMenu);
    document.getElementById('menuLogin')?.addEventListener('click', () => { toggleStartMenu(); showLoginModal(); });
    document.getElementById('menuLogout')?.addEventListener('click', handleLogout);

    // Links in the start menu (will open new tabs/windows)
    document.getElementById('menuLaunchDaw')?.addEventListener('click', () => { window.open('/app/snaw.html', '_blank'); toggleStartMenu(); });
    document.getElementById('menuOpenLibrary')?.addEventListener('click', () => { window.open('/app/js/daw/browser/browser.html', '_blank'); toggleStartMenu(); }); // Browser link
    document.getElementById('menuViewProfiles')?.addEventListener('click', () => { window.open('/app/js/daw/profiles/profile.html', '_blank'); toggleStartMenu(); }); // Profile link
    document.getElementById('menuOpenMessages')?.addEventListener('click', () => { window.open('/app/js/daw/messages/messages.html', '_blank'); toggleStartMenu(); }); // Messages link

    // Generic context menu for desktop background
    const desktop = document.getElementById('desktop');
    if (desktop) {
        desktop.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const menuItems = [
                { label: 'Change Background', action: () => document.getElementById('customBgInput').click() }
            ];
            createContextMenu(e, menuItems);
        });

        document.getElementById('customBgInput')?.addEventListener('change', async (e) => {
            if(!e.target.files || !e.target.files[0] || !loggedInUser) return;
            const file = e.target.files[0];
            await handleBackgroundUpload(file);
            e.target.value = null;
        });
    }

    document.getElementById('menuToggleFullScreen')?.addEventListener('click', toggleFullScreen);
}


// --- Main Window and UI Functions ---

// Main entry point for the Profile application when loaded
document.addEventListener('DOMContentLoaded', () => {
    // Populate appServices for this standalone desktop's context
    appServices.addWindowToStore = addWindowToStore;
    appServices.removeWindowFromStore = removeWindowFromStore;
    appServices.incrementHighestZ = incrementHighestZ;
    appServices.getHighestZ = getHighestZ;
    appServices.setHighestZ = setHighestZ;
    appServices.getOpenWindows = getOpenWindows;
    appServices.getWindowById = getWindowById;
    appServices.createContextMenu = createContextMenu; // From utils.js
    appServices.showNotification = showNotification;   // From utils.js
    appServices.showCustomModal = showCustomModal;     // From utils.js

    // Global state imports for appServices
    appServices.applyUserThemePreference = applyUserThemePreference;
    appServices.setCurrentUserThemePreference = setCurrentUserThemePreference;
    appServices.getCurrentUserThemePreference = getCurrentUserThemePreference;

    loggedInUser = checkLocalAuth();
    loadAndApplyGlobals(); // Call local function loadAndApplyGlobals
    attachDesktopEventListeners(); // Call local function attachDesktopEventListeners
    updateClockDisplay(); // Call local function updateClockDisplay
    
    // Get username from URL parameters or default to logged-in user
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('user') || (loggedInUser ? loggedInUser.username : null);

    if (username) {
        openProfileWindow(username); // Open profile for specified user
    } else {
        // If no username in URL and not logged in, show login modal
        const desktop = document.getElementById('desktop');
        if(desktop) {
            desktop.innerHTML = `<div class="w-full h-full flex items-center justify-center"><p class="text-xl" style="color:var(--text-primary);">Please log in or specify a user in the URL to view a profile.</p></div>`;
        }
        showLoginModal();
    }
});

async function openProfileWindow(username) {
    // For a standalone app, this function *is* the main window logic.
    // We update its content directly.
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return; // Ensure profile container exists

    profileContainer.innerHTML = '<p class="p-8 text-center" style="color: var(--text-secondary);">Loading Profile...</p>';
    
    try {
        const token = localStorage.getItem('snugos_token');
        const [profileRes, friendStatusRes] = await Promise.all([
            fetch(`${SERVER_URL}/api/profiles/${username}`),
            token ? fetch(`${SERVER_URL}/api/profiles/${username}/friend-status`, { headers: { 'Authorization': `Bearer ${token}` } }) : Promise.resolve(null)
        ]);

        const profileData = await profileRes.json();
        if (!profileRes.ok) throw new Error(profileData.message);
        
        const friendStatusData = friendStatusRes ? await friendStatusRes.json() : null;
        
        currentProfileData = profileData.profile;
        currentProfileData.isFriend = friendStatusData?.isFriend || false;

        updateProfileUI(profileData); // Pass profileData directly
        
        // Attach profile-specific event listeners after UI is updated
        attachProfileSpecificEventListeners(profileData);

    } catch (error) {
        profileContainer.innerHTML = `<p class="p-8 text-center" style="color:red;">Error: ${error.message}</p>`;
        showNotification(`Failed to load profile: ${error.message}`, 4000);
        console.error("Error loading profile:", error);
    }
}

function updateProfileUI(profileData) {
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

    const isOwner = loggedInUser && loggedInUser.id === profileData.id;
    const joinDate = new Date(profileData.created_at).toLocaleDateString();

    let avatarContent = profileData.avatar_url
        ? `<img src="${profileData.avatar_url}" alt="${profileData.username}'s avatar" class="w-full h-full object-cover" onerror="this.src='/app/assets/default-avatar.png';">`
        : `<span class="text-4xl font-bold">${profileData.username.charAt(0).toUpperCase()}</span>`;

    const uploadOverlay = isOwner ? `<div id="avatarOverlay" class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer" title="Change Profile Picture"><svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 6.5 12 6.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z"/></svg></div>` : '';
        
    let actionButtons = '';
    if (isOwner) {
        actionButtons = `<button id="editProfileBtn" class="px-4 py-2 rounded" style="background-color: var(--bg-button); border: 1px solid var(--border-button); color: var(--text-button);">Edit Profile</button>`;
    } else if (loggedInUser) {
        const friendBtnText = profileData.isFriend ? 'Remove Friend' : 'Add Friend';
        const friendBtnColor = profileData.isFriend ? 'var(--accent-armed)' : 'var(--accent-active)';
        actionButtons = `
            <button id="addFriendBtn" class="px-4 py-2 rounded text-white" style="background-color: ${friendBtnColor};">${friendBtnText}</button>
            <button id="messageBtn" class="px-4 py-2 rounded text-white ml-2" style="background-color: var(--accent-soloed); color: var(--accent-active-text);">Message</button>
        `;
    }

    // Main profile content structure
    profileContainer.innerHTML = `
        <div class="bg-window text-primary h-full flex flex-col">
            <div class="relative h-40 bg-gray-700 bg-cover bg-center flex-shrink-0" style="background-image: url(${profileData.background_url || ''})">
                <div id="avatarContainer" class="absolute bottom-0 left-6 transform translate-y-1/2 w-28 h-28 rounded-full border-4 border-window bg-gray-500 flex items-center justify-center text-white overflow-hidden">
                    ${avatarContent}${uploadOverlay}
                </div>
            </div>
            <div class="pt-20 px-6 pb-4 border-b border-secondary flex justify-between items-end flex-shrink-0">
                <div><h2 class="text-2xl font-bold">${profileData.username}</h2><p class="text-sm text-secondary">Member since ${joinDate}</p></div>
                <div class="flex space-x-2">${actionButtons}</div>
            </div>
            <div id="profile-body-content" class="p-6 overflow-y-auto flex-grow"></div>
        </div>
    `;

    const profileBody = profileContainer.querySelector('#profile-body-content');
    if (isEditing && isOwner) {
        renderEditMode(profileBody, profileData);
    } else {
        renderViewMode(profileBody, profileData);
    }
}

function attachProfileSpecificEventListeners(profileData) {
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

    const isOwner = loggedInUser && loggedInUser.id === profileData.id;

    if (isOwner) {
        profileContainer.querySelector('#avatarOverlay')?.addEventListener('click', () => document.getElementById('avatarUploadInput').click());
        document.getElementById('avatarUploadInput')?.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleAvatarUpload(e.target.files[0]);
            e.target.value = null;
        });

        profileContainer.querySelector('#editProfileBtn')?.addEventListener('click', () => {
            isEditing = !isEditing;
            updateProfileUI(profileData);
        });
        document.getElementById('customBgInput')?.addEventListener('change', async (e) => {
            if(!e.target.files || !e.target.files[0] || !loggedInUser) return;
            const file = e.target.files[0];
            await handleBackgroundUpload(file);
            e.target.value = null;
        });
        // Context menu for background
        const backgroundArea = profileContainer.querySelector('.relative.h-40');
        if (backgroundArea) {
            backgroundArea.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const menuItems = [
                    { label: 'Change Background', action: () => document.getElementById('customBgInput').click() }
                ];
                createContextMenu(e, menuItems);
            });
        }
    } else if (loggedInUser) {
        profileContainer.querySelector('#addFriendBtn')?.addEventListener('click', () => handleAddFriendToggle(profileData.username, profileData.isFriend));
        profileContainer.querySelector('#messageBtn')?.addEventListener('click', () => showMessageModal(profileData.username));
    }
}


function renderViewMode(container, profileData) {
    container.innerHTML = `
        <h3 class="font-semibold mb-2">Bio</h3>
        <p class="text-primary whitespace-pre-wrap">${profileData.bio || 'This user has not written a bio yet.'}</p>
    `;
}

function renderEditMode(container, profileData) {
    container.innerHTML = `
        <form id="editProfileForm" class="space-y-4">
            <div>
                <label for="editBio" class="block font-medium mb-1">Edit Bio</label>
                <textarea id="editBio" class="w-full p-2 border rounded-md" style="background-color: var(--bg-input); color: var(--text-primary); border-color: var(--border-input);" rows="5">${profileData.bio || ''}</textarea>
            </div>
            <div class="flex justify-end space-x-2">
                <button type="button" id="cancelEditBtn" class="px-4 py-2 rounded" style="background-color: var(--bg-button); border: 1px solid var(--border-button); color: var(--text-button);">Cancel</button>
                <button type="submit" id="saveProfileBtn" class="px-4 py-2 rounded text-white" style="background-color: var(--accent-active);">Save Changes</button>
            </div>
        </form>
    `;
    container.querySelector('#cancelEditBtn').addEventListener('click', () => {
        isEditing = false;
        updateProfileUI(profileData);
    });
    container.querySelector('#editProfileForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const newBio = container.querySelector('#editBio').value;
        saveProfile(profileData.username, { bio: newBio });
    });
}

async function handleAvatarUpload(file) {
    if (!loggedInUser) return;
    showNotification("Uploading picture...", 2000);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', '/avatars/');
    try {
        const token = localStorage.getItem('snugos_token');
        const uploadResponse = await fetch(`${SERVER_URL}/api/files/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) throw new Error(uploadResult.message);
        
        const newAvatarUrl = uploadResult.file.s3_url;
        
        const settingsResponse = await fetch(`${SERVER_URL}/api/profile/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ avatar_url: newAvatarUrl })
        });
        const settingsResult = await settingsResponse.json();
        if (!settingsResult.success) throw new Error(settingsResult.message);

        showNotification("Profile picture updated!", 2000);
        openProfileWindow(loggedInUser.username); // Re-open profile to refresh
    } catch (error) {
        showNotification(`Update failed: ${error.message}`, 4000);
        console.error("Avatar Upload Error:", error);
    }
}

async function saveProfile(username, dataToSave) {
    const token = localStorage.getItem('snugos_token');
    if (!token) return;
    showNotification("Saving...", 1500);
    try {
        const response = await fetch(`${SERVER_URL}/api/profiles/${username}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(dataToSave)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showNotification("Profile saved!", 2000);
        isEditing = false;
        openProfileWindow(username); // Re-open profile to refresh
    } catch (error) {
        showNotification(`Error: ${error.message}`, 4000);
        console.error("Save Profile Error:", error);
    }
}

async function handleAddFriendToggle(username, isFriend) {
    const token = localStorage.getItem('snugos_token');
    if (!token) return;
    const method = isFriend ? 'DELETE' : 'POST';
    showNotification(isFriend ? 'Removing friend...' : 'Adding friend...', 1500);
    try {
        const response = await fetch(`${SERVER_URL}/api/profiles/${username}/friend`, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showNotification(result.message, 2000);
        openProfileWindow(username); // Re-open profile to refresh friend status
    } catch (error) {
        showNotification(`Error: ${error.message}`, 4000);
        console.error("Friend Action Error:", error);
    }
}

function showMessageModal(recipientUsername) {
    const modalContent = `<textarea id="messageTextarea" class="w-full p-2" rows="5" style="background-color: var(--bg-input); color: var(--text-primary); border: 1px solid var(--border-input);"></textarea>`;
    showCustomModal(`Message ${recipientUsername}`, modalContent, [
        { label: 'Cancel' },
        { label: 'Send', action: async () => {
            const content = document.getElementById('messageTextarea').value;
            if (content) {
                await sendMessage(recipientUsername, content);
            }
        }}
    ]);
}

async function sendMessage(recipientUsername, content) {
    const token = localStorage.getItem('snugos_token');
    if (!token) return;
    showNotification("Sending...", 1500);
    try {
        const response = await fetch(`${SERVER_URL}/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ recipientUsername, content })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showNotification("Message sent!", 2000);
    } catch (error) {
        showNotification(`Error: ${error.message}`, 4000);
        console.error("Send Message Error:", error);
    }
}