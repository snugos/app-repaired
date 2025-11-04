// js/daw/auth.js

let localAppServices = {};
let loggedInUser = null;
const SERVER_URL = 'https://snugos-server-api.onrender.com';

export function initializeAuth(appServices) { // Export initializeAuth
    localAppServices = appServices;
    // NOTE: Event listeners for buttons like loginBtnTop and menuLogin should be attached in welcome.js 
    // to prevent duplicate listeners if auth.js is imported multiple times.
    // checkInitialAuthState is called here to run the auth check logic immediately.
    checkInitialAuthState();

    // Return the functions that are intended to be called by other modules via appServices
    return {
        handleLogout: handleLogout,
        showLoginModal: showLoginModal, // Expose internal function to appServices
        updateUserAuthContainer: updateAuthUI, // Expose internal function for other modules
        getLoggedInUser: () => loggedInUser,
    };
}

// These functions MUST be exported if they are imported at the top of welcome.js
// If welcome.js imports them via the main import, they must be exported here.
export async function handleBackgroundUpload(file) {
    if (!loggedInUser) {
        localAppServices.showNotification('You must be logged in to save a custom background.', 3000);
        localAppServices.applyCustomBackground?.(file); // Still apply temporarily even if not logged in
        return;
    }

    try {
        localAppServices.showNotification('Saving background...', 1500);
        await localAppServices.storeAsset?.(`background-for-user-${loggedInUser.id}`, file);
        localAppServices.applyCustomBackground?.(file);
        localAppServices.showNotification('Background saved locally!', 2000);
    } catch (error) {
        localAppServices.showNotification(`Error saving background: ${error.message}`, 3000);
        console.error("Background Upload Error:", error);
    }
}

export function handleLogout() {
    localStorage.removeItem('snugos_token');
    loggedInUser = null;
    updateAuthUI(null);
    document.getElementById('desktop').style.backgroundImage = '';
    const existingVideo = document.getElementById('desktop-video-bg');
    if (existingVideo) existingVideo.remove();
    
    localAppServices.showNotification('You have been logged out.', 2000);
}

function updateAuthUI(user = null) {
    loggedInUser = user;
    const userAuthContainer = document.getElementById('userAuthContainer');
    const menuLogin = document.getElementById('menuLogin');
    const menuLogout = document.getElementById('menuLogout');

    if (user && userAuthContainer) {
        // NOTE: The click handler for the dynamically created loginBtnTop is now redundant
        // if welcome.js handles clicks on loginBtnTop at a higher level.
        userAuthContainer.innerHTML = `<span class="mr-2">Welcome, ${user.username}!</span>`;
        menuLogin?.classList.add('hidden');
        menuLogout?.classList.remove('hidden');
    } else {
        userAuthContainer.innerHTML = `<button id="loginBtnTop" class="px-3 py-1 border rounded">Login</button>`;
        userAuthContainer.querySelector('#loginBtnTop')?.addEventListener('click', showLoginModal); // Re-attach listener
        menuLogin?.classList.remove('hidden');
        menuLogout?.classList.add('hidden');
    }
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
            return handleLogout();
        }
        
        loggedInUser = { id: payload.id, username: payload.username };
        updateAuthUI(loggedInUser);

        const backgroundBlob = await localAppServices.getAsset?.(`background-for-user-${loggedInUser.id}`);
        if (backgroundBlob) {
            localAppServices.applyCustomBackground?.(backgroundBlob);
        }

    } catch (e) {
        console.error("Error during initial auth state check:", e);
        handleLogout();
    }
}

function showLoginModal() {
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
    
    const { overlay, contentDiv } = localAppServices.showCustomModal('Login or Register', modalContent, []);

    // ... (Styling and event listeners for login/register forms - code remains the same)
    contentDiv.querySelectorAll('input[type="text"], input[type="password"]').forEach(input => {
        input.style.backgroundColor = 'var(--bg-input)';
        input.style.color = 'var(--text-primary)';
        input.style.border = '1px solid var(--border-input)';
        input.style.padding = '8px';
        input.style.borderRadius = '3px';
    });

    contentDiv.querySelectorAll('button').forEach(button => {
        button.style.backgroundColor = 'var(--bg-button)';
        button.style.border = '1px solid var(--border-button)';
        button.style.color = 'var(--text-button)';
        button.style.padding = '8px 15px';
        button.style.cursor = 'pointer';
        button.style.borderRadius = '3px';
        button.style.transition = 'background-color 0.15s ease';
        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = 'var(--bg-button-hover)';
            button.style.color = 'var(--text-button-hover)';
        });
        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = 'var(--bg-button)';
            button.style.color = 'var(--text-button)';
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
            await checkInitialAuthState();
            localAppServices.showNotification(`Welcome back, ${data.user.username}!`, 2000);
        } else {
            localAppServices.showNotification(`Login failed: ${data.message}`, 3000);
        }
    } catch (error) {
        localAppServices.showNotification('Network error. Could not connect to server.', 3000);
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
            localAppServices.showNotification('Registration successful! Please log in.', 2500);
        } else {
            localAppServices.showNotification(`Registration failed: ${data.message}`, 3000);
        }
    } catch (error) {
        localAppServices.showNotification('Network error. Could not connect to server.', 3000);
        console.error("Register Error:", error);
    }
}