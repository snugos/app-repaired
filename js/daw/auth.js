// js/daw/auth.js

import { SERVER_URL } from '/app/js/daw/constants.js'; // Corrected path
import { showNotification, showCustomModal } from '/app/js/daw/utils.js'; // Corrected path
import { storeAsset, getAsset } from '/app/js/daw/db.js'; // Corrected path

let localAppServicesInstance = null;
let loggedInUser = null; // Central source of truth for the logged-in user

// Expose these functions as module exports
export function initializeAuth(appServices) {
    localAppServicesInstance = appServices;
    // These event listeners are part of the main DAW's top taskbar/start menu (snaw.html/index.html)
    document.getElementById('loginBtnTop')?.addEventListener('click', showLoginModal);
    document.getElementById('menuLogin')?.addEventListener('click', showLoginModal);
    document.getElementById('menuLogout')?.addEventListener('click', handleLogout);
    checkInitialAuthState();
}

/**
 * Returns the currently logged in user. This is the central source of truth.
 * @returns {object|null} The logged in user object or null if not logged in.
 */
export function getLoggedInUser() {
    return loggedInUser;
}

function updateAuthUI(user = null) {
    loggedInUser = user; // Update the central `loggedInUser` state
    const userAuthContainer = document.getElementById('userAuthContainer');
    const menuLogin = document.getElementById('menuLogin');
    const menuLogout = document.getElementById('menuLogout');

    if (user && userAuthContainer) {
        userAuthContainer.innerHTML = `<span class="mr-2">Welcome, ${user.username}!</span>`;
        menuLogin?.classList.add('hidden');
        menuLogout?.classList.remove('hidden');
    } else {
        // Re-attach listener for dynamically created button after innerHTML update
        userAuthContainer.innerHTML = `<button id="loginBtnTop" class="px-3 py-1 border rounded">Login</button>`;
        userAuthContainer.querySelector('#loginBtnTop')?.addEventListener('click', showLoginModal);
        menuLogin?.classList.remove('hidden');
        menuLogout?.classList.add('hidden');
    }

    // Call any app-specific UI update function if it exists in appServices
    // This allows standalone apps (like messages/profile/drive) to react to auth state changes
    localAppServicesInstance.onAuthChange?.(user);
}

async function checkInitialAuthState() {
    const token = localStorage.getItem('snugos_token');
    if (!token) {
        updateAuthUI(null);
        return;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
            return handleLogout(); // Token expired
        }

        // Basic validation without server call (assuming token is valid if not expired)
        loggedInUser = { id: payload.id, username: payload.username };
        updateAuthUI(loggedInUser);

        // Load and apply background if available (specific to main DAW/index page)
        if (localAppServicesInstance.applyCustomBackground) {
            const backgroundBlob = await getAsset?.(`background-for-user-${loggedInUser.id}`);
            if (backgroundBlob) {
                localAppServicesInstance.applyCustomBackground?.(backgroundBlob);
            }
        }

    } catch (e) {
        console.error("Error during initial auth state check:", e);
        handleLogout(); // Malformed token
    }
}

/**
 * Displays the login/register modal.
 * Exported to be callable from other modules.
 */
export function showLoginModal() {
    // Only attempt to hide start menu if it exists (i.e., on main desktop pages)
    document.getElementById('startMenu')?.classList.add('hidden');

    const modalContent = `
        <div class="space-y-4">
            <div>
                <h3 class="text-lg font-bold mb-2">Login</h3>
                <form id="loginForm" class="space-y-3">
                    <input type="text" id="loginUsername" placeholder="Username" required class="w-full">
                    <input type="password" id="loginPassword" placeholder="Password" required class="w-full">
                    <button type="submit" class="w-full">Login</button>
                </form>
            </div>
            <hr class="border-gray-500">
            <div>
                <h3 class="text-lg font-bold mb-2">Don't have an account? Register</h3>
                <form id="registerForm" class="space-y-3">
                    <input type="text" id="registerUsername" placeholder="Username" required class="w-full">
                    <input type="password" id="registerPassword" placeholder="Password (min. 6 characters)" required class="w-full">
                    <button type="submit" class="w-full">Register</button>
                </form>
            </div>
        </div>
    `;

    const { overlay, contentDiv } = showCustomModal('Login or Register', modalContent, []);

    // Apply styles to inputs and buttons within the modal
    contentDiv.querySelectorAll('input[type="text"], input[type="password"]').forEach(input => {
        Object.assign(input.style, {
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-input)',
            padding: '8px',
            borderRadius: '3px'
        });
    });

    contentDiv.querySelectorAll('button').forEach(button => {
        Object.assign(button.style, {
            backgroundColor: 'var(--bg-button)',
            border: '1px solid var(--border-button)',
            color: 'var(--text-button)',
            padding: '8px 15px',
            cursor: 'pointer',
            borderRadius: '3px',
            transition: 'background-color 0.15s ease'
        });
        button.addEventListener('mouseover', () => {
            Object.assign(button.style, {
                backgroundColor: 'var(--bg-button-hover)',
                color: 'var(--text-button-hover)'
            });
        });
        button.addEventListener('mouseout', () => {
            Object.assign(button.style, {
                backgroundColor: 'var(--bg-button)',
                color: 'var(--text-button)'
            });
        });
    });

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

/**
 * Handles user login.
 * Exported to be callable from other modules.
 */
export async function handleLogin(username, password) {
    try {
        const response = await fetch(`${SERVER_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (data.success) {
            localStorage.setItem('snugos_token', data.token);
            updateAuthUI(data.user); // Use central update function
            showNotification(`Welcome back, ${data.user.username}!`, 2000);
        } else {
            showNotification(`Login failed: ${data.message}`, 3000);
        }
    } catch (error) {
        showNotification('Network error. Could not connect to server.', 3000);
        console.error("Login Error:", error);
    }
}

/**
 * Handles user registration.
 * Exported to be callable from other modules.
 */
export async function handleRegister(username, password) {
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
        showNotification('Network error. Could not connect to server.', 3000);
        console.error("Register Error:", error);
    }
}

/**
 * Handles background image upload.
 * Exported to be callable from other modules.
 */
export async function handleBackgroundUpload(file) {
    if (!loggedInUser) {
        showNotification('You must be logged in to save a custom background.', 3000);
        localAppServicesInstance.applyCustomBackground?.(file); // Apply locally even if not logged in
        return;
    }

    try {
        showNotification('Saving background...', 1500);
        const token = localStorage.getItem('snugos_token'); // Ensure token is present
        if (!token) throw new Error("Authentication token not found.");

        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', '/backgrounds/'); // Store in a specific path for backgrounds
        formData.append('is_public', 'true'); // Backgrounds are generally public

        const uploadResponse = await fetch(`${SERVER_URL}/api/files/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) throw new Error(uploadResult.message || "Failed to upload background file.");

        const newBgUrl = uploadResult.file.s3_url;

        const settingsResponse = await fetch(`${SERVER_URL}/api/profile/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ background_url: newBgUrl })
        });
        const settingsResult = await settingsResponse.json();
        if (!settingsResult.success) throw new Error(settingsResult.message || "Failed to update profile background URL.");

        // Apply background locally after successful server update
        localAppServicesInstance.applyCustomBackground?.(file); // Pass the file blob directly for local display
        showNotification('Background saved successfully!', 2000);

    } catch (error) {
        showNotification(`Error saving background: ${error.message}`, 3000);
        console.error("Background Upload Error:", error);
    }
}


/**
 * Handles user logout.
 * Exported to be callable from other modules.
 */
export function handleLogout() {
    localStorage.removeItem('snugos_token');
    updateAuthUI(null); // Use central update function
    // Clear desktop background (specific to main DAW/index page)
    const desktop = document.getElementById('desktop');
    if (desktop) {
        desktop.style.backgroundImage = '';
        const existingVideo = desktop.querySelector('#desktop-video-bg');
        if (existingVideo) existingVideo.remove();
    }
    showNotification('You have been logged out.', 2000);
}