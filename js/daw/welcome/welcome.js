// js/daw/welcome/welcome.js
// NOTE: This file is designed to run within the main index.html context.
// It sets up the desktop icons and application launching.

import { SERVER_URL } from '/app/js/daw/constants.js'; 
import { SnugWindow } from '/app/js/daw/SnugWindow.js'; 
import { showNotification, showCustomModal, createContextMenu, showConfirmationDialog } from '/app/js/daw/utils.js'; 
import { storeAsset, getAsset } from '/app/js/daw/db.js'; 
// FIX: These imports now work because they are correctly exported in auth.js
import { initializeAuth, handleBackgroundUpload, handleLogout } from '/app/js/daw/auth.js'; 

// Import necessary state accessors
import { getWindowById, addWindowToStore, removeWindowFromStore, incrementHighestZ, getHighestZ, setHighestZ, getOpenWindows, serializeWindows, reconstructWindows, initializeWindowState } from '/app/js/daw/state/windowState.js';
import { getCurrentUserThemePreference, setCurrentUserThemePreference, initializeAppState } from '/app/js/daw/state/appState.js';

let appServices = {}; // Define appServices at the top level
let loggedInUser = null;

// Centralized applyCustomBackground function
function applyCustomBackground(source) {
    const desktopEl = document.getElementById('desktop');
    if (!desktopEl) return;

    desktopEl.style.backgroundImage = '';
    const existingVideo = desktopEl.querySelector('#desktop-video-bg');
    if (existingVideo) {
        existingVideo.remove();
    }

    let url;
    let fileType;

    if (typeof source === 'string') {
        url = source;
        const extension = source.split('.').pop().toLowerCase().split('?')[0];
        if (['mp4', 'webm', 'mov'].includes(extension)) {
            fileType = `video/${extension}`;
        } else {
            fileType = 'image/jpeg';
        }
    } else { // It's a File object
        url = URL.createObjectURL(source);
        fileType = source.type;
    }

    if (fileType.startsWith('image/')) {
        desktopEl.style.backgroundImage = `url(${url})`;
        desktopEl.style.backgroundSize = 'cover';
        desktopEl.style.backgroundPosition = 'center';
    } else if (fileType.startsWith('video/')) {
        const videoEl = document.createElement('video');
        videoEl.id = 'desktop-video-bg';
        videoEl.style.position = 'absolute';
        videoEl.style.top = '0';
        videoEl.style.left = '0';
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'cover';
        videoEl.src = url;
        videoEl.autoplay = true;
        videoEl.loop = true;
        videoEl.muted = true;
        videoEl.playsInline = true;
        desktopEl.appendChild(videoEl);
    }
}


/**
 * Creates and opens a new window containing an HTML page loaded into an iframe.
 * Used for apps that *should* be embedded (Tetris, Discord).
 * @param {string} windowId Unique ID for the SnugWindow.
 * @param {string} windowTitle Title of the SnugWindow.
 * @param {string} iframeSrc URL of the HTML page to load in the iframe.
 * @param {object} options SnugWindow options.
 * @returns {SnugWindow} The newly created SnugWindow instance.
 */
function openEmbeddedAppInWindow(windowId, windowTitle, iframeSrc, options = {}) {
    // Check if the window is already open and focus it
    if (appServices.getWindowById(windowId)) {
        appServices.getWindowById(windowId).focus();
        return appServices.getWindowById(windowId);
    }

    const content = document.createElement('iframe');
    content.src = iframeSrc;
    content.style.width = '100%';
    content.style.height = '100%';
    content.style.border = 'none';
    content.style.backgroundColor = 'var(--bg-window-content)'; // Inherit theme background

    // Use appServices.createWindow to create the SnugWindow
    const windowInstance = appServices.createWindow(windowId, windowTitle, content, options);


    // Inject appServices into iframe after content loads
    content.onload = () => {
        try {
            if (content.contentWindow && content.contentWindow.document) {
                // Pass appServices to the iframe's global scope and call its initializer
                content.contentWindow.appServices = appServices;
                if (content.contentWindow.initializePage) { // This is the expected initializer in iframe HTML
                    content.contentWindow.initializePage(appServices);
                }
                console.log(`[SnugOS] appServices injected into iframe: ${iframeSrc}`);
            }
        } catch (e) {
            console.warn(`[SnugOS] Could not inject appServices into iframe ${iframeSrc}. Check same-origin policy or iframe content.`, e);
        }
    };
    return windowInstance;
}

/**
 * Sets up the main welcome page functionality.
 */
async function initializeWelcomePage() { 
    // 1. Initialize appServices placeholders.
    appServices = {
        // Core SnugWindow/Window State functions
        getWindowById: null, addWindowToStore: null, removeWindowFromStore: null,
        incrementHighestZ: null, getHighestZ: null, setHighestZ: null, getOpenWindows: null,
        serializeWindows: null, reconstructWindows: null,
        initializeWindowState: null, 

        // Theme functions
        getCurrentUserThemePreference: null, setCurrentUserThemePreference: null,
        initializeAppState: null, 

        // Background handling
        applyCustomBackground: applyCustomBackground, 
        handleBackgroundUpload: handleBackgroundUpload, // Directly imported and used

        // Utility access
        showNotification: showNotification,
        showCustomModal: showCustomModal,
        createContextMenu: createContextMenu,
        showConfirmationDialog: showConfirmationDialog,
        showLoading: () => document.getElementById('loading-overlay')?.classList.remove('hidden'), 
        hideLoading: () => document.getElementById('loading-overlay')?.classList.add('hidden'), 
        showCustomInputModal: (title, placeholder, initialValue, onConfirm) => {
            const inputDialog = document.getElementById('input-dialog');
            const inputDialogTitle = document.getElementById('input-dialog-title');
            const inputDialogField = document.getElementById('input-dialog-field');
            const inputDialogConfirmBtn = document.getElementById('input-dialog-confirm-btn');
            const inputDialogCancelBtn = document.getElementById('input-dialog-cancel-btn');

            if (!inputDialog) {
                console.error("Input dialog not found!");
                return;
            }

            inputDialogTitle.textContent = title;
            inputDialogField.placeholder = placeholder;
            inputDialogField.value = initialValue;
            inputDialog.classList.remove('hidden');
            inputDialogField.focus();

            // Clear previous event listeners to prevent multiple calls
            inputDialogConfirmBtn.onclick = null;
            inputDialogCancelBtn.onclick = null;

            inputDialogConfirmBtn.onclick = async () => {
                const value = inputDialogField.value.trim();
                const success = await onConfirm(value);
                if (success) {
                    inputDialog.classList.add('hidden');
                }
            };

            inputDialogCancelBtn.onclick = () => {
                inputDialog.classList.add('hidden');
            };
        },


        // Auth related 
        initializeAuth: initializeAuth, // Directly imported and used
        handleLogout: handleLogout, // Directly imported and used
        updateUserAuthContainer: null, // Populated by auth module
        showLoginModal: null, // Populated by auth module
        getLoggedInUser: () => loggedInUser, // Provide getter for current user state

        // DB functions
        storeAsset: storeAsset, 
        getAsset: getAsset,     
        storeAudio: null, getAudio: null, deleteAudio: null,
    };

    // 2. Dynamically import necessary modules.
    const [
        windowStateModule, appStateModule, authModuleExports, dbModuleExports
    ] = await Promise.all([
        import('/app/js/daw/state/windowState.js'), 
        import('/app/js/daw/state/appState.js'),     
        import('/app/js/daw/auth.js'),               
        import('/app/js/daw/db.js')                  
    ]);

    // 3. Populate appServices with exports from modules.
    Object.assign(appServices, windowStateModule);
    Object.assign(appServices, appStateModule);
    Object.assign(appServices, dbModuleExports);

    // 4. Define `appServices.createWindow` *after* appServices has its core window functions.
    appServices.createWindow = (id, title, content, options) => new SnugWindow(id, title, content, options, appServices);

    // 5. Initialize modules that have an `initializeXModule` function.
    appServices.initializeWindowState(appServices);
    appServices.initializeAppState(appServices);

    // Initialize AuthModule (it sets up its own event listeners and updates auth UI).
    // FIX: Call initializeAuth directly from the imported function
    const authExports = initializeAuth(appServices); 
    // Populate appServices with functions returned by initializeAuth (like showLoginModal)
    Object.assign(appServices, authExports);


    // 6. Attach top-level event listeners for the welcome page.
    attachEventListeners();
    updateClockDisplay();

    // Theme application and system preference listening
    appServices.setCurrentUserThemePreference(appServices.getCurrentUserThemePreference() || 'system');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => appServices.setCurrentUserThemePreference('system'));

    renderDesktopIcons();
    initAudioOnFirstGesture();

    // Attempt to restore window state from previous session
    const lastSessionState = localStorage.getItem('snugos_welcome_session_windows');
    if (lastSessionState) {
        try {
            const parsedState = JSON.parse(lastSessionState);
            if (parsedState && parsedState.length > 0) {
                appServices.reconstructWindows(parsedState);
            } else {
                openDefaultLayout();
            }
        } catch (e) {
            console.error("Error parsing last project data from local storage:", e);
            openDefaultLayout();
        }
    } else {
        openDefaultLayout();
    }

    console.log("Welcome Page Initialized Successfully.");
}

/**
 * Handles browser security restrictions by starting the audio context
 * only after the first user click on the page.
 */
function initAudioOnFirstGesture() {
    const startAudio = async () => {
        if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
            await Tone.start();
            console.log('AudioContext started successfully.');
        }
        // IMPORTANT: Remove the listener after the first interaction
        document.body.removeEventListener('mousedown', startAudio);
        document.body.removeEventListener('keydown', startAudio);
        document.body.removeEventListener('touchstart', startAudio);
    };
    // Use multiple events to catch various types of user interaction
    document.body.addEventListener('mousedown', startAudio);
    document.body.addEventListener('keydown', startAudio);
    document.body.addEventListener('touchstart', startAudio); // For touch devices
}


/**
 * Attaches all primary event listeners for the page.
 */
function attachEventListeners() {
    // Top taskbar buttons
    document.getElementById('loginBtnTop')?.addEventListener('click', showLoginModal);
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
    document.getElementById('startButton')?.addEventListener('click', toggleStartMenu);

    // Start Menu and Desktop Icon actions
    document.getElementById('menuLaunchDaw')?.addEventListener('click', launchDaw);
    document.getElementById('menuOpenBrowser')?.addEventListener('click', openBrowser); 
    document.getElementById('menuViewProfiles')?.addEventListener('click', viewProfiles); 
    document.getElementById('menuOpenMessages')?.addEventListener('click', openMessages); 

    document.getElementById('menuLogin')?.addEventListener('click', () => {
        toggleStartMenu();
        showLoginModal();
    });
    document.getElementById('menuLogout')?.addEventListener('click', () => {
        toggleStartMenu();
        appServices.handleLogout();
    });
    document.getElementById('menuToggleFullScreen')?.addEventListener('click', toggleFullScreen);
    document.getElementById('customBgInput')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) appServices.handleBackgroundUpload(file);
        e.target.value = null;
    });

    // Add context menu to desktop
    document.getElementById('desktop')?.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (e.target.closest('.window')) return;
        const menuItems = [
            { label: 'Change Background', action: () => document.getElementById('customBgInput').click() },
            { separator: true },
            { label: 'Open DAW', action: launchDaw },
            { label: 'Open SnugOS Browser', action: openBrowser },
            { label: 'View Profile', action: viewProfiles },
            { label: 'Open Messages', action: openMessages },
            { label: 'Play Snugtris', action: openGameWindow },
            { label: 'Discord Server', action: openDiscordWindow }
        ];
        appServices.createContextMenu(e, menuItems);
    });
}

/**
 * Renders the application icons on the desktop.
 */
function renderDesktopIcons() {
    const desktopIconsContainer = document.getElementById('desktop-icons-container');
    if (!desktopIconsContainer) return;

    desktopIconsContainer.innerHTML = '';

    const icons = [
        {
            id: 'snaw-icon',
            name: 'Snaw',
            action: launchDaw,
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-8z"/></svg>`
        },
        {
            id: 'browser-icon',
            name: 'Browser',
            action: openBrowser,
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`
        },
        {
            id: 'profile-icon',
            name: 'Profile',
            action: viewProfiles,
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
        },
        {
            id: 'messages-icon',
            name: 'Messages',
            action: openMessages,
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
        },
        {
            id: 'discord-icon',
            name: 'Discord',
            action: openDiscordWindow,
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" fill="currentColor" class="w-12 h-12"><path d="M524.531 69.832a1.87 1.87 0 0 0-.01-.01c-26.541-26.82-62.158-39.736-102.822-40.407-1.121-.023-2.253-.023-3.375-.011C354.269 28.147 301.867 36.57 252.093 50.84C180.252 71.077 124.976 112.593 84.7 172.585a1.873 1.873 0 0 0-.01.011C40.669 220.187 16 270.812 16 323.013c0 88.083 49.37 129.418 99.851 129.418 25.166 0 45.418-12.06 63.784-33.829 9.897-11.536 18.232-26.331 22.42-40.485 3.309-11.082 5.922-21.737 5.922-21.737 0 .041-36.438 16.924-81.862 10.36-11.758-1.705-19.26-6.495-19.26-6.495 0-.013 1.05-.724 3.016-1.63 7.15-3.238 12.396-6.848 14.156-8.291 16.295-13.626 27.675-29.62 34.789-48.423 9.489-25.04 14.77-50.605 14.77-75.986 0-106.82-58.41-190.155-155.67-190.155-28.053 0-51.464 8.789-70.198 25.059-3.791 3.344-3.791 8.847 0 12.191C123.637 151.787 150.117 167 180.598 167c17.51 0 31.866-5.467 43.197-16.143 6.945-6.536 12.106-14.47 14.975-23.468 4.795-15.006 7.42-30.825 7.42-46.758 0-68.539-38.35-125.132-90.87-125.132-24.717 0-45.023 8.357-61.944 24.363zm-109.846 179.814c0-3.344 2.685-6.029 6.03-6.029h12.06c3.344 0 6.03 2.685 6.03 6.029v24.119c0 3.344-2.686 6.029-6.03 6.029H410.74c-3.344 0-6.03-2.685-6.03-6.029v-24.119c0-3.344 2.686-6.029-6.03-6.029h12.06c3.344 0 6.03 2.685 6.03 6.029v24.119c0 3.344-2.686 6.029-6.03 6.029H410.74c-3.344 0-6.03-2.685-6.03-6.029v-24.119z"/></svg>`
        },
        {
            id: 'game-icon',
            name: 'Game',
            action: openGameWindow,
            svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12"><path d="M21.57,9.36,18,7.05V4a1,1,0,0,0-1-1H7A1,1,0,0,0,6,4V7.05L2.43,9.36a1,1,0,0,0-.43,1V17a1,1,0,0,0,1,1H6v3a1,1,0,0,0,1,1h1V19H16v3h1a1,1,0,0,0,1-1V18h3a1,1,0,0,0,1-1V10.36A1,1,0,0,0,21.57,9.36ZM8,5H16V7H8ZM14,14H12V16H10V14H8V12h2V10h2v2h2Z"/></svg>`
        }
    ];

    icons.forEach(icon => {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'desktop-icon';
        iconDiv.id = icon.id;

        const imgContainer = document.createElement('div');
        imgContainer.className = 'desktop-icon-image';
        imgContainer.innerHTML = icon.svgContent;

        const span = document.createElement('span');
        span.textContent = icon.name;

        iconDiv.appendChild(imgContainer);
        iconDiv.appendChild(span);

        iconDiv.addEventListener('click', icon.action);
        desktopIconsContainer.appendChild(iconDiv);
    });
}

function toggleStartMenu() {
    document.getElementById('startMenu')?.classList.toggle('hidden');
}

// MODIFIED: Launch DAW as a standalone page (direct navigation)
function launchDaw() {
    toggleStartMenu();
    // Correct absolute path for snaw.html
    window.location.href = '/app/snaw.html';
}

// NEW: Function to open SnugOS Browser (standalone)
function openBrowser() {
    toggleStartMenu();
    window.open('/app/js/daw/browser/browser.html', '_blank'); // Open in new tab for standalone app
}

// NEW: Function to open Discord Widget (embedded in SnugWindow)
function openDiscordWindow() {
    toggleStartMenu();
    const discordServerId = '1381090107079266424'; // From user's input
    const discordWidgetSrc = `https://discord.com/widget?id=${discordServerId}&theme=dark`;
    openEmbeddedAppInWindow('discordWidget', 'Discord Server', discordWidgetSrc, { width: 370, height: 550, resizable: false });
}

// NEW: Function to open Profile (standalone)
function viewProfiles() {
    toggleStartMenu();
    window.open('/app/js/daw/profiles/profile.html', '_blank'); // Open in new tab for standalone app
}

// NEW: Function to open Messages (standalone)
function openMessages() {
    toggleStartMenu();
    window.open('/app/js/daw/messages/messages.html', '_blank'); // Open in new tab for standalone app
}

// MODIFIED: Open Tetris is still embedded in a SnugWindow iframe
function openGameWindow() {
    toggleStartMenu();
    // Correct absolute path for tetris.html
    openEmbeddedAppInWindow('tetrisGame', 'Snugtris', '/app/tetris.html', { width: 600, height: 750, minWidth: 400, minHeight: 600 });
}

function updateClockDisplay() {
    const clockDisplay = document.getElementById('taskbarClockDisplay');
    if (clockDisplay) {
        const now = new Date();
        clockDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    setTimeout(updateClockDisplay, 60000);
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            appServices.showNotification(`Error: ${err.message}`, 3000);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

// Calls auth.js's showLoginModal via appServices
function showLoginModal() {
    document.getElementById('startMenu')?.classList.add('hidden');
    appServices.showLoginModal(); // Call the auth module's showLoginModal
}

function toggleTheme() {
    // This calls the setCurrentUserThemePreference from appState.js which is exposed via appServices
    const isLightTheme = document.body.classList.contains('theme-light');
    const newTheme = isLightTheme ? 'dark' : 'light';
    appServices.setCurrentUserThemePreference(newTheme);
}

// Ensure initializeWelcomePage runs when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', initializeWelcomePage);