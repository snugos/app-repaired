// js/globalControlsUI.js -> NOW HANDLES DESKTOP SETTINGS UI

import { SnugWindow } from './SnugWindow.js';
import * as Constants from './constants.js';
import { createDropZoneHTML } from './utils.js'; // Need to import utils for Drop Zone

let localAppServices = {};

export function initializeGlobalControlsUIModule(appServicesFromMain) {
    localAppServices = appServicesFromMain;
}

/**
 * Creates and opens the Desktop Settings Window.
 * This window replaces the old Global Controls window and handles background settings.
 */
export function openDesktopSettingsWindow(onReadyCallback, savedState = null) {
    const windowId = 'desktopSettings';
    const getOpenWindows = localAppServices.getOpenWindows || (() => new Map());
    const createWindow = localAppServices.createWindow;

    const openWindows = getOpenWindows();

    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win?.focusWindow();
        if (win?.isMinimized) win.minimize(); // Unminimize it
        return win;
    }

    // New content for Desktop Settings
    const contentHTML = `
        <div class="window-content p-2 space-y-2">
            
            <div class="group-box">
                <div class="group-box-legend">Desktop Background</div>
                <div id="desktopBgDropZone">
                    </div>
                <p class="text-xs mt-2">Drop an image (.png, .jpg) or video (.mp4, .webm) file to set the desktop background.</p>
                <div class="flex items-center gap-2 mt-2">
                    <button id="clearDesktopBgBtn" class="w-full">Clear Background</button>
                    <input type="file" id="desktopBgFileInput" class="hidden" accept="image/*,video/*">
                    <button id="openBgFileInputBtn" class="w-full">Browse...</button>
                </div>
                <div class="flex items-center gap-2 mt-2">
                    <label class="flex items-center">
                        <input type="checkbox" id="videoBgLoopToggle" checked>
                        Loop Video
                    </label>
                </div>
            </div>

            <div class="group-box">
                <div class="group-box-legend">Desktop Color</div>
                <div class="flex items-center gap-2">
                    <label for="desktopColorInput">Hex:</label>
                    <input type="color" id="desktopColorInput" value="${Constants.defaultDesktopBg || '#008080'}" class="h-8 w-12 outset-border">
                    <button id="applyDesktopColorBtn" class="w-full">Apply Color</button>
                </div>
            </div>

            <div class="group-box">
                <div class="group-box-legend">SnugOS Settings</div>
                <div class="flex items-center gap-2">
                    <label class="flex-grow">Theme:</label>
                    <select id="themeSelect" class="w-full inset-border">
                        <option value="pathB" selected>Path B (90s Retro)</option>
                    </select>
                </div>
            </div>

        </div>
    `;

    const options = { title: 'Desktop Settings', width: 320, height: 320, minWidth: 300, minHeight: 250, closable: true, minimizable: true, resizable: true, initialContentKey: windowId };
    if (savedState) Object.assign(options, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    
    const newWindow = createWindow(windowId, options.title, contentHTML, options);
    
    if (newWindow?.element && typeof onReadyCallback === 'function') {
        const dropZoneEl = newWindow.element.querySelector('#desktopBgDropZone');
        if (dropZoneEl) {
            dropZoneEl.innerHTML = createDropZoneHTML("Drop Image/Video Here", "dropBgZone");
        }
        
        onReadyCallback({
            windowElement: newWindow.element,
            clearDesktopBgBtn: newWindow.element.querySelector('#clearDesktopBgBtn'),
            openBgFileInputBtn: newWindow.element.querySelector('#openBgFileInputBtn'),
            desktopBgFileInput: document.getElementById('customBgInput'), // Reusing the main.js input
            desktopColorInput: newWindow.element.querySelector('#desktopColorInput'),
            applyDesktopColorBtn: newWindow.element.querySelector('#applyDesktopColorBtn'),
            videoBgLoopToggle: newWindow.element.querySelector('#videoBgLoopToggle'),
            dropZoneId: 'dropBgZone'
        });
    }
    return newWindow;
}

// Export a placeholder for the old function to avoid errors in other files' imports, 
// though it should be removed in main.js and eventHandlers.js.
// Since the file name is 'globalControlsUI.js', we need to export the original function name as well for backward compatibility
// in case other files still try to import it, but it should not be used.
export function openGlobalControlsWindow() {
    console.warn("[globalControlsUI.js] openGlobalControlsWindow is deprecated. Use openDesktopSettingsWindow instead.");
    return null;
}