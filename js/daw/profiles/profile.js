// js/daw/profiles/profile.js
// NOTE: This file is the main JavaScript for the standalone SnugOS Profile application (profile.html).
// It manages its own desktop UI and profile-specific logic.

// Corrected imports to be absolute paths
import { SnugWindow } from '/app/js/daw/SnugWindow.js';
// UPDATED: Import showNotification, showCustomModal, createContextMenu, showConfirmationDialog from utils.js
import { showNotification, showCustomModal, createContextMenu, showConfirmationDialog } from '/app/js/daw/utils.js';
// UPDATED: Import storeAsset, getAsset from main db.js
import { storeAsset, getAsset } from '/app/js/daw/db.js';
import * as Constants from '/app/js/daw/constants.js';
import { getWindowById, addWindowToStore, removeWindowFromStore, incrementHighestZ, getHighestZ, setHighestZ, getOpenWindows, serializeWindows, reconstructWindows } from '/app/js/daw/state/windowState.js';
import { getCurrentUserThemePreference, setCurrentUserThemePreference } from '/app/js/daw/state/appState.js';
// NEW: Import centralized auth functions
import { showLoginModal as centralizedShowLoginModal, handleLogin as centralizedHandleLogin, handleRegister as centralizedHandleRegister, handleLogout as centralizedHandleLogout, getLoggedInUser } from '/app/js/daw/auth.js';


const SERVER_URL = 'https://snugos-server-api.onrender.com';
let loggedInUser = null; // Will now be managed by auth.js and retrieved via getLoggedInUser()
let currentProfileData = null;
let isEditing = false;
const appServices = {}; // This will be populated locally for this standalone app.

// --- Global UI and Utility Functions (Now mostly proxied from appServices) ---

// Theme-related functions (can remain local or be moved to appState/utils for DAW if desired)
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
        // Use the centralized auth.js function for background upload
        // It will handle showing notifications and interacting with the server/DB
        await centralizedHandleBackgroundUpload(file);
        // After successful upload and server update, reload current profile data to reflect new background
        openProfileWindow(loggedInUser.username); // Re-render profile to update UI
    } catch (error) {
        // centralizedHandleBackgroundUpload already shows notification, just log here
        console.error("Background Upload Error:", error);
    }
}

// NEW: Import handleBackgroundUpload from auth.js for consistency
import { handleBackgroundUpload as centralizedHandleBackgroundUpload } from '/app/js/daw/auth.js';


async function loadAndApplyGlobals() {
    // This function can remain specific to how this profile.html manages its background
    // based on the logged-in user's profile settings fetched from the server.
    // It should use the `loggedInUser` state from `auth.js`.
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


// Authentication Functions (Now use centralized functions from auth.js)
// REMOVED: handleAuthSubmit, handleLogin, handleRegister, handleLogout, showLoginModal

// CENTRALIZED VERSION: handleLogout will now call the centralized one
function handleLogout() {
    centralizedHandleLogout(); // Call the function exported from auth.js
    // Any profile-specific UI resets for logout
    window.location.reload(); // Reload the page to reflect logout status
}

// NEW: Function to open the centralized login modal
function showLoginModalProfile() {
    centralizedShowLoginModal(); // Call the function exported from auth.js
}


// --- Profile Specific Functions ---

async function fetchProfileData(username, container) {
    container.innerHTML = '<p class="p-8 text-center" style="color: var(--text-secondary);">Loading Profile...</p>';

    try {
        const fetchUrl = `${SERVER_URL}/api/profiles/${username}`;

        // Only fetch friend status if current user is logged in
        // Use `getLoggedInUser()` to check current login status
        const friendStatusPromise = getLoggedInUser() ? fetch(`${SERVER_URL}/api/profiles/${username}/friend-status`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('snugos_token')}` } }) : Promise.resolve(null);

        const [profileRes, friendStatusRes] = await Promise.all([
            fetch(fetchUrl),
            friendStatusPromise
        ]);

        const profileDataJson = await profileRes.json();
        if (!profileRes.ok) {
            throw new Error(profileDataJson.message || `Failed to fetch profile for ${username}.`);
        }

        currentProfileData = profileDataJson.profile;
        currentProfileData.isFriend = friendStatusRes ? (await friendStatusRes.json()).isFriend : false;

        updateProfileUI(currentProfileData);

    } catch (error) {
        container.innerHTML = `<p class="p-8 text-center" style="color:red;">Error: ${error.message}</p>`;
        showNotification(`Failed to load profile: ${error.message}`, 4000);
    }
}

function updateProfileUI(profileData) {
    // Use `getLoggedInUser()` to check current login status
    const isOwner = getLoggedInUser() && getLoggedInUser().id === profileData.id;
    const joinDate = new Date(profileData.created_at).toLocaleDateString();

    let avatarContent = profileData.avatar_url
        ? `<img src="${profileData.avatar_url}" alt="${profileData.username}'s avatar" class="w-full h-full object-cover" onerror="this.src='/app/assets/default-avatar.png';">`
        : `<span class="text-4xl font-bold">${profileData.username.charAt(0).toUpperCase()}</span>`;

    const uploadOverlay = isOwner ? `<div id="avatarOverlay" class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer" title="Change Profile Picture"><svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 6.5 12 6.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z"/></svg></div>` : '';

    let actionButtons = '';
    if (isOwner) {
        actionButtons = `<button id="editProfileBtn" class="px-4 py-2 rounded" style="background-color: var(--bg-button); border: 1px solid var(--border-button); color: var(--text-button);">Edit Profile</button>`;
    } else if (getLoggedInUser()) { // Show friend/message buttons if logged in and not owner.
        const friendBtnText = profileData.isFriend ? 'Remove Friend' : 'Add Friend';
        const friendBtnColor = profileData.isFriend ? 'var(--accent-armed)' : 'var(--accent-active)';
        actionButtons = `
            <button id="addFriendBtn" class="px-4 py-2 rounded text-white" style="background-color: ${friendBtnColor};">${friendBtnText}</button>
            <button id="messageBtn" class="px-4 py-2 rounded text-white ml-2" style="background-color: var(--accent-soloed); color: var(--accent-active-text);">Message</button>
        `;
    }

    const newContent = document.createElement('div');
    newContent.className = "h-full w-full";
    newContent.innerHTML = `
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

    const profileBody = newContent.querySelector('#profile-body-content');
    if (isEditing && isOwner) {
        renderEditMode(profileBody, profileData);
    } else {
        renderViewMode(profileBody, profileData);
    }

    const profileContainerEl = document.getElementById('profile-container');
    profileContainerEl.innerHTML = ''; // Clear existing content
    profileContainerEl.appendChild(newContent);
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

// handleAvatarUpload will use centralized auth.js/utils.js
async function handleAvatarUpload(file) {
    // Use `getLoggedInUser()` to check current login status
    if (!getLoggedInUser()) return;
    showNotification("Uploading picture...", 2000); // Use showNotification from utils.js
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', '/avatars/'); // Specific path for avatars
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/files/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const uploadResult = await response.json();
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
        openProfileWindow(getLoggedInUser().username); // Re-open profile to refresh using central user data

    } catch (error) {
        showNotification(`Update failed: ${error.message}`, 4000);
        console.error("Avatar Upload Error:", error);
    }
}

// saveProfile will use centralized auth.js/utils.js
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

// --- Main App Renderer & Event Listeners ---

function renderProfileApp() {
    // Check auth status from centralized auth.js module
    loggedInUser = getLoggedInUser();

    // Update logged in user display in header
    if (loggedInUser) {
        const loggedInUserSpan = document.getElementById('logged-in-user');
        const logoutBtn = document.getElementById('logout-btn');
        if (loggedInUserSpan) loggedInUserSpan.innerHTML = `Logged in as: <span class="font-semibold" style="color: var(--text-primary);">${loggedInUser.username}</span>`;
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        document.getElementById('app-content')?.classList.remove('hidden'); // Show the main profile content

        // Fetch profile data based on URL or current user
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('user') || loggedInUser.username; // Default to current user's profile
        fetchProfileData(username, document.getElementById('profile-container')); // Pass profile-container reference
    } else {
        // Not logged in: Show the login page
        const loggedInUserSpan = document.getElementById('logged-in-user');
        const logoutBtn = document.getElementById('logout-btn');
        if (loggedInUserSpan) loggedInUserSpan.textContent = '';
        if (logoutBtn) logoutBtn.classList.add('hidden');
        document.getElementById('app-content')?.classList.add('hidden'); // Hide profile content
        document.getElementById('login-page')?.classList.remove('hidden'); // Show login page

        // Reset login/register form titles/buttons
        const authTitle = document.getElementById('auth-title');
        const authBtnText = document.getElementById('auth-btn-text');
        const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
        if (authTitle) authTitle.textContent = 'Login to SnugOS Profile';
        if (authBtnText) authBtnText.textContent = 'Login';
        if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = 'Need an account? Register';
    }
}

function attachProfileEventListeners() {
    const logoutBtn = document.getElementById('logout-btn');
    const authForm = document.getElementById('auth-form');
    const toggleAuthModeBtn = document.getElementById('toggle-auth-mode');
    const avatarUploadInput = document.getElementById('avatarUploadInput');
    const customBgInput = document.getElementById('customBgInput');

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    // If authForm exists (meaning login page is present)
    if (authForm) {
        authForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            const authMessage = document.getElementById('auth-message');
            if (!username || !password) {
                if (authMessage) authMessage.textContent = 'Please enter both username and password.';
                if (authMessage) authMessage.classList.remove('hidden');
                return;
            }

            if (authMessage) authMessage.classList.add('hidden');
            const authSubmitBtn = document.getElementById('auth-submit-btn');
            const authSpinner = document.getElementById('auth-spinner');
            const authBtnText = document.getElementById('auth-btn-text');

            if (authSubmitBtn) authSubmitBtn.disabled = true;
            if (authSpinner) authSpinner.classList.remove('hidden');
            if (authBtnText) authBtnText.textContent = authMode === 'register' ? 'Registering...' : 'Logging in...';

            try {
                if (authMode === 'register') {
                    await centralizedHandleRegister(username, password);
                } else {
                    await centralizedHandleLogin(username, password);
                }
                // After successful login/register, renderProfileApp will handle UI update
                renderProfileApp();
            } catch (error) {
                console.error("Authentication error:", error);
                if (authMessage) authMessage.textContent = 'Network error or server unavailable.';
                if (authMessage) authMessage.classList.remove('hidden');
            } finally {
                if (authSubmitBtn) authSubmitBtn.disabled = false;
                if (authSpinner) authSpinner.classList.add('hidden');
                if (authBtnText) authBtnText.textContent = authMode === 'register' ? 'Register' : 'Login';
            }
        });
    }

    if (toggleAuthModeBtn) {
        toggleAuthModeBtn.addEventListener('click', () => {
            authMode = authMode === 'login' ? 'register' : 'login';
            // Update auth form UI based on mode
            const authTitle = document.getElementById('auth-title');
            const authBtnText = document.getElementById('auth-btn-text');
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');

            if (authTitle) authTitle.textContent = authMode === 'register' ? 'Register to SnugOS Profile' : 'Login to SnugOS Profile';
            if (authBtnText) authBtnText.textContent = authMode === 'register' ? 'Register' : 'Login';
            if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = authMode === 'register' ? 'Already have an account? Login' : 'Need an account? Register';
            const authMessage = document.getElementById('auth-message');
            if (authMessage) authMessage.classList.add('hidden'); // Clear message on toggle
            if (usernameInput) usernameInput.value = ''; // Clear fields
            if (passwordInput) passwordInput.value = '';
        });
    }

    // Attach avatar and background upload input listeners
    if (avatarUploadInput) avatarUploadInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleAvatarUpload(e.target.files[0]);
        e.target.value = null; // Clear the input
    });
    if (customBgInput) customBgInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleBackgroundUpload(e.target.files[0]);
        e.target.value = null; // Clear the input
    });

    // Attach profile-specific action listeners
    const profileContainer = document.getElementById('profile-container');
    if (profileContainer) {
        // Event delegation for dynamically added elements (like avatarOverlay, edit/friend/message buttons)
        profileContainer.addEventListener('click', (e) => {
            if (e.target.id === 'avatarOverlay') {
                document.getElementById('avatarUploadInput')?.click();
            } else if (e.target.id === 'editProfileBtn') {
                isEditing = !isEditing;
                updateProfileUI(currentProfileData);
            } else if (e.target.id === 'addFriendBtn') {
                handleAddFriendToggle(currentProfileData.username, currentProfileData.isFriend);
            } else if (e.target.id === 'messageBtn') {
                showMessageModal(currentProfileData.username);
            } else if (e.target.closest('.username-link')) { // Handle links to other profiles
                e.preventDefault();
                const targetUsername = e.target.closest('.username-link').dataset.username;
                if (targetUsername) {
                    window.location.href = `profile.html?user=${targetUsername}`;
                }
            }
        });
        profileContainer.addEventListener('submit', (e) => {
            if (e.target.id === 'editProfileForm') {
                e.preventDefault();
                const newBio = e.target.querySelector('#editBio').value;
                saveProfile(currentProfileData.username, { bio: newBio });
            }
        });
        // Context menu for background
        const backgroundArea = profileContainer.querySelector('.relative.h-40');
        if (backgroundArea) {
            backgroundArea.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const menuItems = [
                    { label: 'Change Background', action: () => document.getElementById('customBgInput')?.click() }
                ];
                createContextMenu(e, menuItems);
            });
        }
    }
}


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Populate appServices for this standalone desktop's context
    // This is a minimal appServices needed for this specific standalone page
    Object.assign(appServices, {
        // From windowState.js (if SnugWindow is used on this page, otherwise not strictly needed)
        getWindowById: getWindowById, addWindowToStore: addWindowToStore, removeWindowFromStore: removeWindowFromStore,
        incrementHighestZ: incrementHighestZ, getHighestZ: getHighestZ, setHighestZ: setHighestZ, getOpenWindows: getOpenWindows,
        serializeWindows: serializeWindows, reconstructWindows: reconstructWindows,

        // Utilities from utils.js
        showNotification: showNotification, showCustomModal: showCustomModal, createContextMenu: createContextMenu,

        // AppState functions (for theme management)
        applyUserThemePreference: applyUserThemePreference, // local helper for theme
        setCurrentUserThemePreference: setCurrentUserThemePreference,
        getCurrentUserThemePreference: getCurrentUserThemePreference,

        // DB functions from db.js (for asset handling)
        storeAsset: storeAsset, getAsset: getAsset, // Ensure these are correctly imported at the top of this file
    });

    // Check initial auth state and render app
    renderProfileApp();
    attachProfileEventListeners(); // Call specific event listeners for profile page
    updateClockDisplay();
    applyUserThemePreference(); // Apply theme on load
    // initAudioOnFirstGesture() is not typically needed on a profile page as it doesn't involve audio output directly.
});

// Function to handle opening other standalone apps from menu (e.g., messages, browser, DAW)
// These are not part of the profile-specific logic but needed for menu functionality
function launchDaw() { window.open('/app/snaw.html', '_blank'); toggleStartMenu(); }
function openBrowser() { window.open('/app/js/daw/browser/browser.html', '_blank'); toggleStartMenu(); }
function openMessages() { window.open('/app/js/daw/messages/messages.html', '_blank'); toggleStartMenu(); }
// Add more functions for other standalone apps if needed