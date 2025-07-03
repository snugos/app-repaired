// js/daw/messages/messages.js
// NOTE: This file is the main JavaScript for the standalone SnugOS Messages application (messages.html).
// It manages its own desktop UI and launches individual chat windows as SnugWindows.

// Corrected imports to be absolute paths
import { SnugWindow } from '/app/js/daw/SnugWindow.js';
// UPDATED: Import showNotification, showCustomModal, createContextMenu from utils.js
import { showNotification, showCustomModal, createContextMenu } from '/app/js/daw/utils.js';
import * as Constants from '/app/js/daw/constants.js'; // Ensure constants are imported
import { getWindowById, addWindowToStore, removeWindowFromStore, incrementHighestZ, getHighestZ, setHighestZ, getOpenWindows, serializeWindows, reconstructWindows } from '/app/js/daw/state/windowState.js'; // Corrected paths
import { getCurrentUserThemePreference, setCurrentUserThemePreference } from '/app/js/daw/state/appState.js'; // Corrected paths
// NEW: Import centralized auth functions
import { showLoginModal as centralizedShowLoginModal, handleLogin as centralizedHandleLogin, handleRegister as centralizedHandleRegister, handleLogout as centralizedHandleLogout, getLoggedInUser } from '/app/js/daw/auth.js';


const SERVER_URL = 'https://snugos-server-api.onrender.com';
let loggedInUser = null; // Will now be managed by auth.js and retrieved via getLoggedInUser()
let appServices = {}; // This will be populated locally for this standalone app.
let messagePollingIntervals = new Map(); // Store intervals per conversation window

// --- Global UI and Utility Functions (Now mostly proxied from appServices) ---

// Authentication/Login/Logout Functions (Now use centralized functions from auth.js)
// REMOVED: checkLocalAuth, handleLogin, handleRegister, handleLogout, showLoginModal

// CENTRALIZED VERSION: handleLogout will now call the centralized one
function handleLogout() {
    centralizedHandleLogout(); // Call the function exported from auth.js
    // Any messages-specific UI resets for logout
    window.location.reload(); // Reload the page to reflect logout status
}

// NEW: Function to open the centralized login modal
function showLoginModalMessages() {
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

function attachDesktopEventListeners() {
    // Top-level elements
    document.getElementById('startButton')?.addEventListener('click', toggleStartMenu);
    document.getElementById('menuLogin')?.addEventListener('click', () => { toggleStartMenu(); showLoginModalMessages(); }); // Call local login modal function
    document.getElementById('menuLogout')?.addEventListener('click', handleLogout);

    // Links in the start menu (will open new tabs/windows)
    document.getElementById('menuLaunchDaw')?.addEventListener('click', () => { window.open('/app/snaw.html', '_blank'); toggleStartMenu(); });
    document.getElementById('menuOpenLibrary')?.addEventListener('click', () => { window.open('/app/js/daw/browser/browser.html', '_blank'); toggleStartMenu(); }); // Browser link
    document.getElementById('menuViewProfiles')?.addEventListener('click', () => { window.open('/app/js/daw/profiles/profile.html', '_blank'); toggleStartMenu(); }); // Profile link
    document.getElementById('menuOpenMessages')?.addEventListener('click', () => { window.open('/app/js/daw/messages/messages.html', '_blank'); toggleStartMenu(); }); // Messages link

    // Example of adding a generic desktop context menu (similar to welcome.js)
    const desktop = document.getElementById('desktop');
    if (desktop) {
        desktop.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const menuItems = [
                { label: 'Open Browser', action: () => { window.open('/app/js/daw/browser/browser.html', '_blank'); toggleStartMenu(); } },
                { label: 'Open Profile', action: () => { window.open('/app/js/daw/profiles/profile.html', '_blank'); toggleStartMenu(); } },
                { separator: true },
                { label: 'Login / Register', action: showLoginModalMessages }, // Call local login modal function
                { label: 'Logout', action: handleLogout },
            ];
            createContextMenu(e, menuItems);
        });
    }
}


// --- Main App Initialization (on DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', async () => { // Marked async
    // Populate appServices for this standalone desktop's context
    Object.assign(appServices, {
        // SnugWindow management from windowState.js (imported above)
        addWindowToStore: addWindowToStore,
        removeWindowFromStore: removeWindowFromStore,
        incrementHighestZ: incrementHighestZ,
        getHighestZ: getHighestZ,
        setHighestZ: setHighestZ,
        getOpenWindows: getOpenWindows,
        getWindowById: getWindowById,
        serializeWindows: serializeWindows,
        reconstructWindows: reconstructWindows,

        // Utilities from utils.js (imported above)
        createContextMenu: createContextMenu,
        showNotification: showNotification,
        showCustomModal: showCustomModal,

        // AppState functions (imported above)
        applyUserThemePreference: applyUserThemePreference, // Local function defined above
        setCurrentUserThemePreference: setCurrentUserThemePreference,
        getCurrentUserThemePreference: getCurrentUserThemePreference,

        // Core SnugWindow constructor for this messenger app to open its own child windows
        createWindow: (id, title, content, options) => new SnugWindow(id, title, content, options, appServices),
    });

    // Initialize auth module and get logged in user
    await import('/app/js/daw/auth.js').then(auth => {
        auth.initializeAuth(appServices);
        loggedInUser = auth.getLoggedInUser();
        // Add a handler for when auth state changes in auth.js (e.g., login/logout)
        appServices.onAuthChange = (user) => {
            loggedInUser = user;
            renderMessengerDesktop(); // Re-render desktop on auth change
        };
    });


    attachDesktopEventListeners();
    applyUserThemePreference();
    updateClockDisplay();
    initAudioOnFirstGesture();

    // Initial render based on login status
    if (loggedInUser) {
        renderMessengerDesktop();
    } else {
        const desktop = document.getElementById('desktop');
        if(desktop) {
            desktop.innerHTML = `<div class="w-full h-full flex items-center justify-center"><p class="text-xl" style="color:var(--text-primary);">Please log in to use Messages.</p></div>`;
        }
        showLoginModalMessages(); // Show login modal if not logged in
    }
});


// --- Core Messenger UI Rendering & Logic ---

function renderMessengerDesktop() {
    const desktop = document.getElementById('desktop');
    if (!desktop) return;

    // Only render if logged in
    if (!loggedInUser) {
        desktop.innerHTML = `<div class="w-full h-full flex items-center justify-center"><p class="text-xl" style="color:var(--text-primary);">Please log in to use Messages.</p></div>`;
        return;
    }

    desktop.innerHTML = `
        <div class="flex h-full text-sm" style="background-color: var(--bg-window-content);">
            <div id="friend-list" class="w-1/3 h-full border-r overflow-y-auto" style="border-color: var(--border-secondary);">
                <p class="p-2 text-center italic" style="color:var(--text-secondary);">Loading friends...</p>
            </div>
            <div id="conversation-area-placeholder" class="w-2/3 h-full flex flex-col bg-window">
                 <p class="p-2 text-center italic" style="color:var(--text-secondary);">Select a friend to start chatting</p>
            </div>
        </div>
    `;

    populateFriendList(desktop);
}

// --- Window Management for Conversations ---

async function openConversationWindow(friend) {
    const windowId = `chatWin-${friend.username}`;
    if (appServices.getWindowById(windowId)) {
        appServices.getWindowById(windowId).focus();
        return;
    }

    const contentHTML = `
        <div class="h-full flex flex-col bg-window-content">
            <div id="message-list-${friend.username}" class="flex-grow p-4 overflow-y-auto flex flex-col space-y-4"></div>
            <div class="p-2 border-t border-secondary flex" style="border-color: var(--border-secondary);">
                <input type="text" id="message-input-${friend.username}" class="w-full p-2 bg-input text-primary border border-input rounded-l-md" placeholder="Type a message...">
                <button id="send-btn-${friend.username}" class="px-4 py-2 bg-button text-button border border-button rounded-r-md">Send</button>
            </div>
        </div>
    `;

    const desktopEl = document.getElementById('desktop');
    const options = {
        width: 450,
        height: 400,
        x: (desktopEl.offsetWidth / 2) - 225 + (Math.random() * 50),
        y: (desktopEl.offsetHeight / 2) - 200 + (Math.random() * 50),
    };
    const chatWindow = appServices.createWindow(windowId, `Chat: ${friend.username}`, contentHTML, options);

    const messageInput = chatWindow.element.querySelector(`#message-input-${friend.username}`);
    const sendBtn = chatWindow.element.querySelector(`#send-btn-${friend.username}`);

    const sendMessageAction = async () => {
        const content = messageInput.value.trim();
        if(!content) return;
        await sendMessage(friend.username, content);
        messageInput.value = '';
        await fetchAndRenderConversation(friend.username, chatWindow.element.querySelector(`#message-list-${friend.username}`));
    };

    if (sendBtn) sendBtn.onclick = sendMessageAction;
    if (messageInput) {
        messageInput.onkeydown = (e) => {
            if(e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessageAction();
            }
        };
    }

    // Clear existing interval if window is re-opened
    if (messagePollingIntervals.has(friend.username)) {
        clearInterval(messagePollingIntervals.get(friend.username));
    }
    const intervalId = setInterval(async () => {
        await fetchAndRenderConversation(friend.username, chatWindow.element.querySelector(`#message-list-${friend.username}`));
    }, 5000);
    messagePollingIntervals.set(friend.username, intervalId);

    const originalOnClose = chatWindow.onCloseCallback;
    chatWindow.onCloseCallback = () => {
        clearInterval(messagePollingIntervals.get(friend.username));
        messagePollingIntervals.delete(friend.username);
        if (typeof originalOnClose === 'function') originalOnClose();
    };

    await fetchAndRenderConversation(friend.username, chatWindow.element.querySelector(`#message-list-${friend.username}`));
}


async function populateFriendList(container) {
    const friendListEl = container.querySelector('#friend-list');
    if (!friendListEl) return;

    friendListEl.innerHTML = `<p class="p-2 text-center italic" style="color:var(--text-secondary);">Loading friends...</p>`;

    try {
        const token = localStorage.getItem('snugos_token');
        if (!token) { // Ensure token is present before fetching friends
            friendListEl.innerHTML = `<p class="p-2 text-center italic" style="color:var(--text-secondary);">Please log in to see friends.</p>`;
            return;
        }
        const response = await fetch(`${SERVER_URL}/api/friends`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        friendListEl.innerHTML = '';
        if (data.friends.length === 0) {
            friendListEl.innerHTML = `<p class="p-2 text-center italic" style="color:var(--text-secondary);">No friends yet. Add friends via the Profile page!</p>`;
            return;
        }

        data.friends.forEach(friend => {
            const friendDiv = document.createElement('div');
            friendDiv.className = 'p-2 flex items-center cursor-pointer hover:bg-button-hover friend-item';
            friendDiv.dataset.username = friend.username;
            friendDiv.innerHTML = `
                <img src="${friend.avatar_url || '/app/assets/default-avatar.png'}" class="w-8 h-8 rounded-full mr-2 flex-shrink-0" onerror="this.src='/app/assets/default-avatar.png';">
                <span class="truncate" style="color:var(--text-primary);">${friend.username}</span>
            `;
            friendDiv.addEventListener('click', () => {
                container.querySelectorAll('.friend-item').forEach(el => {
                    el.style.backgroundColor = 'transparent';
                    el.style.color = 'var(--text-primary)';
                    el.querySelector('span').style.color = 'var(--text-primary)';
                });
                friendDiv.style.backgroundColor = 'var(--accent-active)';
                friendDiv.style.color = 'var(--accent-active-text)';
                friendDiv.querySelector('span').style.color = 'var(--accent-active-text)';

                openConversationWindow(friend);
            });
            friendListEl.appendChild(friendDiv);
        });
    } catch(error) {
        friendListEl.innerHTML = `<p class="p-2 text-center italic" style="color:red;">Failed to load friends: ${error.message}</p>`;
        showNotification(`Error loading friends: ${error.message}`, 4000);
    }
}

async function fetchAndRenderConversation(friendUsername, messageListContainer) {
    if (!loggedInUser) {
        messageListContainer.innerHTML = '<p class="p-8 text-center" style="color:red;">Please log in to view messages.</p>';
        return;
    }
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/messages/conversation/${friendUsername}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        messageListContainer.innerHTML = '';
        if (data.conversation && data.conversation.length > 0) {
             data.conversation.forEach(msg => {
                const msgDiv = document.createElement('div');
                const isMine = msg.sender_id === loggedInUser.id;

                msgDiv.className = `max-w-[80%] p-3 rounded-lg shadow-md ${isMine ? 'self-end ml-auto' : 'self-start mr-auto'}`;
                msgDiv.style.backgroundColor = isMine ? 'var(--accent-active)' : 'var(--bg-window)';
                msgDiv.style.color = isMine ? 'var(--accent-active-text)' : 'var(--text-primary)';

                const usernameLink = `<a href="/app/js/daw/profiles/profile.html?user=${isMine ? msg.recipient_username : msg.sender_username}" target="_blank" class="font-bold cursor-pointer hover:underline" style="color:inherit;" data-username="${isMine ? msg.recipient_username : msg.sender_username}">${isMine ? msg.recipient_username : msg.sender_username}</a>`;

                msgDiv.innerHTML = `
                    <div class="text-xs mb-1" style="color: ${isMine ? 'inherit' : 'var(--text-secondary)'};">
                        ${isMine ? `To: ${usernameLink}` : `From: ${usernameLink}`}
                    </div>
                    <p class="text-base break-words">${msg.content}</p>
                    <div class="text-xs opacity-75 mt-1" style="text-align: ${isMine ? 'right' : 'left'};">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                `;
                messageListContainer.appendChild(msgDiv);
             });
             messageListContainer.scrollTop = messageListContainer.scrollHeight; // Scroll to bottom
        } else {
             messageListContainer.innerHTML = `<p class="p-2 text-center italic" style="color:var(--text-secondary);">Start a conversation!</p>`;
        }
    } catch (error) {
        messageListContainer.innerHTML = `<p class="p-2 text-center italic" style="color:red;">Failed to load conversation: ${error.message}</p>`;
        showNotification(`Error loading conversation: ${error.message}`, 4000);
        console.error("Error loading conversation:", error);
    }
}

async function sendMessage(recipientUsername, content) {
    if (!loggedInUser) {
        showNotification('You must be logged in to send messages.', 3000);
        return;
    }
    if (!recipientUsername || !content) {
        showNotification('Recipient and content are required.', 3000);
        return;
    }
    try {
        const token = localStorage.getItem('snugos_token');
        const response = await fetch(`${SERVER_URL}/api/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ recipientUsername, content })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        showNotification("Message sent!", 2000);
    } catch (error) {
        showNotification(`Error sending message: ${error.message}`, 4000);
        console.error("Send Message Error:", error);
    }
}