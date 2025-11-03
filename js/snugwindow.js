// js/SnugWindow.js - SnugWindow Class Module

import { createContextMenu } from './utils.js';

export class SnugWindow {
    constructor(id, title, contentHTMLOrElement, options = {}, appServices = {}) {
        this.id = id;
        this.title = title;
        this.isMinimized = false;
        this.initialContentKey = options.initialContentKey || id;
        this.taskbarButton = null;
        this.onCloseCallback = options.onCloseCallback || (() => {});
        this.isMaximized = false;
        this.restoreState = {};
        this.appServices = appServices || {}; // Ensure appServices is at least an empty object
        this._isDragging = false; // Instance flag for dragging
        this._isResizing = false; // Instance flag for resizing

        console.log(`[SnugWindow ${this.id} Constructor] Initializing window "${title}". Options:`, JSON.parse(JSON.stringify(options)));

        const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
        if (!desktopEl) {
            console.error(`[SnugWindow CRITICAL ${this.id}] Desktop element not found. Cannot create window "${title}".`);
            this.element = null; // Mark as invalid
            return; // Halt construction if desktop isn't found
        }

        // Robust dimension/position calculation
        const taskbarEl = this.appServices.uiElementsCache?.taskbar || document.getElementById('taskbar');
        const taskbarHeightVal = taskbarEl?.offsetHeight > 0 ? taskbarEl.offsetHeight : 30; // Default if taskbar not found or no height

        const safeDesktopWidth = (desktopEl.offsetWidth > 0) ? desktopEl.offsetWidth : 1024; // Robust fallback
        const safeDesktopHeight = (desktopEl.offsetHeight > 0) ? desktopEl.offsetHeight : 768; // Robust fallback
        console.log(`[SnugWindow ${this.id} Constructor] Desktop Dims: ${safeDesktopWidth}x${safeDesktopHeight}, Taskbar Height: ${taskbarHeightVal}`);


        const optMinWidth = parseFloat(options.minWidth);
        const optMinHeight = parseFloat(options.minHeight);
        const minW = Number.isFinite(optMinWidth) && optMinWidth > 50 ? optMinWidth : 150; // Ensure a reasonable minimum
        const minH = Number.isFinite(optMinHeight) && optMinHeight > 50 ? optMinHeight : 100; // Ensure a reasonable minimum

        let optWidth = parseFloat(options.width);
        let optHeight = parseFloat(options.height);
        let optX = parseFloat(options.x);
        let optY = parseFloat(options.y);

        let w, h, x, y;

        // Calculate width
        if (Number.isFinite(optWidth) && optWidth >= minW) {
            w = Math.min(optWidth, safeDesktopWidth - 10); // Clamp to desktop width with a small margin
        } else {
            w = Math.max(minW, Math.min(350, safeDesktopWidth - 20)); // Default/cascade size
        }
        w = Math.max(minW, w); // Ensure minWidth is respected

        // Calculate height
        if (Number.isFinite(optHeight) && optHeight >= minH) {
            h = Math.min(optHeight, safeDesktopHeight - taskbarHeightVal - 10); // Clamp to desktop height
        } else {
            h = Math.max(minH, Math.min(250, safeDesktopHeight - taskbarHeightVal - 20)); // Default/cascade size
        }
        h = Math.max(minH, h); // Ensure minHeight is respected

        // Calculate position, ensuring window is not placed completely off-screen
        const maxX = Math.max(5, safeDesktopWidth - w - 5); // Max X, ensuring some part is visible
        const maxY = Math.max(5, safeDesktopHeight - h - taskbarHeightVal - 5); // Max Y, considering taskbar

        const openWindowCount = this.appServices.getOpenWindows ? this.appServices.getOpenWindows().size : 0;
        const cascadeOffsetBase = 20;
        const cascadeIncrement = 25;
        const cascadeOffset = cascadeOffsetBase + (openWindowCount % 10) * cascadeIncrement;

        if (Number.isFinite(optX)) {
            x = Math.max(5, Math.min(optX, maxX));
        } else {
            x = Math.max(5, Math.min(cascadeOffset, maxX));
        }

        if (Number.isFinite(optY)) {
            y = Math.max(5, Math.min(optY, maxY));
        } else {
            y = Math.max(5, Math.min(cascadeOffset, maxY));
        }

        // Final validation for calculated values
        const finalX = Number.isFinite(x) ? x : 50;
        const finalY = Number.isFinite(y) ? y : 50;
        const finalWidth = (Number.isFinite(w) && w > 0) ? w : minW;
        const finalHeight = (Number.isFinite(h) && h > 0) ? h : minH;

        this.options = {
            ...options, // Spread original options first
            x: finalX, y: finalY, width: finalWidth, height: finalHeight,
            minWidth: minW, minHeight: minH,
            closable: options.closable !== undefined ? options.closable : true,
            minimizable: options.minimizable !== undefined ? options.minimizable : true,
            resizable: options.resizable !== undefined ? options.resizable : true,
        };

        console.log(`[SnugWindow ${this.id} Constructor] Calculated final this.options:`, JSON.parse(JSON.stringify(this.options)));

        this.element = document.createElement('div');
        this.element.id = `window-${this.id}`;
        this.element.className = 'window';

        // Apply styles with checks
        if (Number.isFinite(this.options.x)) this.element.style.left = `${this.options.x}px`;
        else { console.warn(`[SnugWindow ${this.id}] Invalid X position (${this.options.x}), defaulting to 50px.`); this.element.style.left = '50px'; }

        if (Number.isFinite(this.options.y)) this.element.style.top = `${this.options.y}px`;
        else { console.warn(`[SnugWindow ${this.id}] Invalid Y position (${this.options.y}), defaulting to 50px.`); this.element.style.top = '50px'; }

        if (Number.isFinite(this.options.width) && this.options.width > 0) this.element.style.width = `${this.options.width}px`;
        else { console.warn(`[SnugWindow ${this.id}] Invalid width (${this.options.width}), defaulting to minWidth ${this.options.minWidth}px.`); this.element.style.width = `${this.options.minWidth}px`; }

        if (Number.isFinite(this.options.height) && this.options.height > 0) this.element.style.height = `${this.options.height}px`;
        else { console.warn(`[SnugWindow ${this.id}] Invalid height (${this.options.height}), defaulting to minHeight ${this.options.minHeight}px.`); this.element.style.height = `${this.options.minHeight}px`; }


        const initialZIndex = Number.isFinite(parseFloat(options.zIndex)) ? parseFloat(options.zIndex) :
            (this.appServices.incrementHighestZ ? this.appServices.incrementHighestZ() : 101);

        if (Number.isFinite(initialZIndex)) this.element.style.zIndex = initialZIndex;
        else { console.warn(`[SnugWindow ${this.id}] Invalid zIndex (${options.zIndex}), defaulting to 101.`); this.element.style.zIndex = 101; }

        if (this.appServices.setHighestZ && this.appServices.getHighestZ && initialZIndex > this.appServices.getHighestZ()) {
            this.appServices.setHighestZ(initialZIndex);
        }

        this.titleBar = document.createElement('div');
        this.titleBar.className = 'window-title-bar';
        let buttonsHTML = '';
        if (this.options.minimizable) { buttonsHTML += `<button class="window-minimize-btn" title="Minimize">_</button>`; }
        if (this.options.resizable) { buttonsHTML += `<button class="window-maximize-btn" title="Maximize">□</button>`; } // Maximize button often comes before close
        if (this.options.closable) { buttonsHTML += `<button class="window-close-btn" title="Close">X</button>`; }
        this.titleBar.innerHTML = `<span>${this.title}</span><div class="window-title-buttons">${buttonsHTML}</div>`;

        this.contentArea = document.createElement('div');
        this.contentArea.className = 'window-content';

        if (typeof contentHTMLOrElement === 'string') {
            this.contentArea.innerHTML = contentHTMLOrElement;
        } else if (contentHTMLOrElement instanceof HTMLElement) {
            this.contentArea.appendChild(contentHTMLOrElement);
        } else {
            console.warn(`[SnugWindow ${this.id}] Invalid content provided for window "${this.title}". Expected string or HTMLElement.`);
        }

        this.element.appendChild(this.titleBar);
        this.element.appendChild(this.contentArea);
        desktopEl.appendChild(this.element);

        if (this.appServices.addWindowToStore) {
            this.appServices.addWindowToStore(this.id, this);
        } else {
            console.warn(`[SnugWindow ${this.id}] addWindowToStore service not available via appServices.`);
        }

        this.makeDraggable();
        if (this.options.resizable) {
            this.makeResizable();
        }

        const closeBtn = this.element.querySelector('.window-close-btn');
        if (closeBtn && this.options.closable) {
            closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
        }
        const minimizeBtn = this.element.querySelector('.window-minimize-btn');
        if (minimizeBtn && this.options.minimizable) {
            minimizeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.minimize(); });
        }
        const maximizeBtn = this.element.querySelector('.window-maximize-btn');
        if (maximizeBtn && this.options.resizable) {
            maximizeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMaximize(); });
        }

        this.element.addEventListener('mousedown', () => this.focus(), true); // Capture phase to focus before other actions
        this.createTaskbarButton();

        if (this.options.isMinimized) {
            this.minimize(true); // true to skip undo capture on initial load
        }
         // Ensure the window is focused if it's not meant to be minimized on start,
        // unless a specific z-index was given that might imply it's not the top.
        if (!this.options.isMinimized && !options.zIndex) {
            this.focus();
        }
    }

    _captureUndo(description) {
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(description);
        } else {
            // console.warn(`[SnugWindow ${this.id}] captureStateForUndo service not available.`); // Can be noisy
        }
    }

    makeDraggable() {
        if (!this.titleBar) return;
        let offsetX, offsetY;
        let initialX, initialY;

        const onMouseDown = (e) => {
            if (e.target.tagName === 'BUTTON' || this.isMaximized) return; // Don't drag if clicking a button or maximized
            if (!this.element) return; // Element might have been removed

            this._isDragging = true;
            this.focus();
            initialX = this.element.offsetLeft;
            initialY = this.element.offsetTop;
            offsetX = e.clientX - initialX;
            offsetY = e.clientY - initialY;
            this.titleBar.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none'; // Prevent text selection during drag

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
            if (!this._isDragging || !this.element) return;

            const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
            if (!desktopEl) {
                console.warn(`[SnugWindow ${this.id} Drag] Desktop element not found during drag.`);
                this._isDragging = false; return;
            }

            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;

            const desktopRect = desktopEl.getBoundingClientRect();
            const taskbarEl = this.appServices.uiElementsCache?.taskbar || document.getElementById('taskbar');
            const taskbarHeightVal = taskbarEl?.offsetHeight > 0 ? taskbarEl.offsetHeight : 30;


            // Clamp position within desktop bounds
            newX = Math.max(0, Math.min(newX, desktopRect.width - this.element.offsetWidth));
            // Ensure window title bar is always visible and not under taskbar
            const titleBarHeight = this.titleBar?.offsetHeight || 28;
            newY = Math.max(0, Math.min(newY, desktopRect.height - titleBarHeight - taskbarHeightVal)); // Prevent title bar from going under taskbar
            newY = Math.max(0, Math.min(newY, desktopRect.height - this.element.offsetHeight)); // Prevent bottom from going off-screen

            this.element.style.left = `${newX}px`;
            this.element.style.top = `${newY}px`;
        };

        const onMouseUp = () => {
            if (!this._isDragging) return;
            this._isDragging = false;
            if (this.titleBar) this.titleBar.style.cursor = 'grab';
            document.body.style.userSelect = ''; // Re-enable text selection

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (this.element && (this.element.offsetLeft !== initialX || this.element.offsetTop !== initialY)) {
               this._captureUndo(`Move window "${this.title}"`);
            }
        };

        this.titleBar.addEventListener('mousedown', onMouseDown);
    }

    makeResizable() {
        const resizer = document.createElement('div');
        resizer.className = 'window-resizer';
        if (this.element) {
            this.element.appendChild(resizer);
            this.element.style.overflow = 'hidden'; // Important for resizer to work correctly
        } else { return; }


        let initialWidth, initialHeight, initialMouseX, initialMouseY;
        let originalStyleWidth, originalStyleHeight; // To compare for undo

        const onMouseDownResizer = (e) => {
            e.preventDefault(); e.stopPropagation(); // Prevent drag and other actions
            if (!this.element) return;

            this._isResizing = true;
            this.focus();
            initialWidth = this.element.offsetWidth;
            initialHeight = this.element.offsetHeight;
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            originalStyleWidth = this.element.style.width; // Store original style
            originalStyleHeight = this.element.style.height;
            document.body.style.cursor = 'nwse-resize';
            document.body.style.userSelect = 'none';

            document.addEventListener('mousemove', onMouseMoveResizer);
            document.addEventListener('mouseup', onMouseUpResizer);
        };

        const onMouseMoveResizer = (e) => {
            if (!this._isResizing || !this.element) return;
            const dx = e.clientX - initialMouseX;
            const dy = e.clientY - initialMouseY;
            const newWidth = Math.max(this.options.minWidth, initialWidth + dx);
            const newHeight = Math.max(this.options.minHeight, initialHeight + dy);
            this.element.style.width = `${newWidth}px`;
            this.element.style.height = `${newHeight}px`;
        };

        const onMouseUpResizer = () => {
            if (!this._isResizing) return;
            this._isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            document.removeEventListener('mousemove', onMouseMoveResizer);
            document.removeEventListener('mouseup', onMouseUpResizer);

            if (this.element && (this.element.style.width !== originalStyleWidth || this.element.style.height !== originalStyleHeight)) {
               this._captureUndo(`Resize window "${this.title}"`);
            }
        };
        resizer.addEventListener('mousedown', onMouseDownResizer);
    }

    toggleMaximize() {
        if (!this.element) return;
        const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
        const taskbarEl = this.appServices.uiElementsCache?.taskbar || document.getElementById('taskbar');
        if (!desktopEl || !taskbarEl) {
            console.warn(`[SnugWindow ${this.id}] Cannot toggle maximize: desktop or taskbar element not found.`);
            return;
        }

        const maximizeButton = this.titleBar?.querySelector('.window-maximize-btn');
        const wasMaximized = this.isMaximized;

        if (this.isMaximized) {
            // Restore
            this.element.style.left = this.restoreState.left || `${this.options.x}px`;
            this.element.style.top = this.restoreState.top || `${this.options.y}px`;
            this.element.style.width = this.restoreState.width || `${this.options.width}px`;
            this.element.style.height = this.restoreState.height || `${this.options.height}px`;
            this.isMaximized = false;
            if (maximizeButton) maximizeButton.innerHTML = '□'; // Restore icon
        } else {
            // Maximize
            this.restoreState = {
                left: this.element.style.left, top: this.element.style.top,
                width: this.element.style.width, height: this.element.style.height,
            };
            const taskbarHeight = taskbarEl.offsetHeight > 0 ? taskbarEl.offsetHeight : 30;
            this.element.style.left = '0px';
            this.element.style.top = '0px';
            this.element.style.width = `${desktopEl.clientWidth}px`;
            this.element.style.height = `${desktopEl.clientHeight - taskbarHeight}px`;
            this.isMaximized = true;
            if (maximizeButton) maximizeButton.innerHTML = '❐'; // Maximize icon (restore down)
        }
        this._captureUndo(`${wasMaximized ? "Restore" : "Maximize"} window "${this.title}"`);
        this.focus(); // Bring to front
    }

    createTaskbarButton() {
        const taskbarButtonsContainer = this.appServices.uiElementsCache?.taskbarButtonsContainer || document.getElementById('taskbarButtons');
        if (!taskbarButtonsContainer) {
            console.warn(`[SnugWindow ${this.id}] Taskbar buttons container not found.`);
            return;
        }
        this.taskbarButton = document.createElement('button');
        this.taskbarButton.className = 'taskbar-button';
        this.taskbarButton.textContent = this.title.substring(0, 20) + (this.title.length > 20 ? '...' : ''); // Increased length
        this.taskbarButton.title = this.title;
        this.taskbarButton.dataset.windowId = this.id;
        taskbarButtonsContainer.appendChild(this.taskbarButton);

        this.taskbarButton.addEventListener('click', () => {
            if (!this.element) return; // Window might have been closed
            if (this.isMinimized) {
                this.restore();
            } else {
                // If it's already the active window (topmost z-index) and not maximized, minimize it.
                // Otherwise, focus it (which also restores if it was minimized but not active).
                const currentHighestZ = this.appServices.getHighestZ ? this.appServices.getHighestZ() : 100;
                if (parseInt(this.element.style.zIndex) === currentHighestZ && !this.isMaximized) { // If active and not maximized, minimize
                    this.minimize();
                } else { // Otherwise, focus (which also restores if minimized)
                    this.focus();
                }
            }
        });

        this.taskbarButton.addEventListener('contextmenu', (event) => {
            event.preventDefault(); event.stopPropagation();
            const menuItems = [];
            if (this.isMinimized) menuItems.push({ label: "Restore", action: () => this.restore() });
            else menuItems.push({ label: "Minimize", action: () => this.minimize() });

            if (this.options.resizable) {
                menuItems.push({ label: this.isMaximized ? "Restore Down" : "Maximize", action: () => this.toggleMaximize() });
            }
            if (this.options.closable) menuItems.push({ label: "Close", action: () => this.close() });

            // Track-specific context menu items
            if (this.appServices.getTrackById) {
                let trackId = null;
                const parts = this.id.split('-');
                if (parts.length > 1 && (this.id.startsWith('trackInspector-') || this.id.startsWith('effectsRack-') || this.id.startsWith('sequencerWin-'))) {
                    const idPart = parts[parts.length - 1];
                    if (!isNaN(parseInt(idPart))) trackId = parseInt(idPart);
                }
                const currentTrack = trackId !== null ? this.appServices.getTrackById(trackId) : null;
                if (currentTrack) {
                    menuItems.push({ separator: true });
                    if (!this.id.startsWith('trackInspector-') && this.appServices.handleOpenTrackInspector) {
                        menuItems.push({ label: `Open Inspector: ${currentTrack.name}`, action: () => this.appServices.handleOpenTrackInspector(trackId) });
                    }
                    if (!this.id.startsWith('effectsRack-') && this.appServices.handleOpenEffectsRack) {
                        menuItems.push({ label: `Open Effects: ${currentTrack.name}`, action: () => this.appServices.handleOpenEffectsRack(trackId) });
                    }
                    if (!this.id.startsWith('sequencerWin-') && currentTrack.type !== 'Audio' && this.appServices.handleOpenSequencer) {
                        menuItems.push({ label: `Open Sequencer: ${currentTrack.name}`, action: () => this.appServices.handleOpenSequencer(trackId) });
                    }
                }
            }
            createContextMenu(event, menuItems, this.appServices);
        });
        this.updateTaskbarButtonActiveState();
    }

    updateTaskbarButtonActiveState() {
        if (!this.taskbarButton || !this.element) return;
        const currentHighestZ = this.appServices.getHighestZ ? this.appServices.getHighestZ() : 100;
        const isActive = !this.isMinimized && parseInt(this.element.style.zIndex) === currentHighestZ;
        this.taskbarButton.classList.toggle('active', isActive);
        this.taskbarButton.classList.toggle('minimized-on-taskbar', this.isMinimized); // Simplified: just show minimized style if it is minimized
    }

    minimize(skipUndo = false) {
        if (!this.element || this.isMinimized) return;
        this.isMinimized = true;
        this.element.classList.add('minimized');
        this.isMaximized = false; // Cannot be maximized and minimized
        const maximizeButton = this.titleBar?.querySelector('.window-maximize-btn');
        if (maximizeButton) maximizeButton.innerHTML = '□'; // Reset maximize icon

        if (!skipUndo) this._captureUndo(`Minimize window "${this.title}"`);

        // Focus the next highest, non-minimized window
        if (this.appServices.getOpenWindows) {
            let nextHighestZ = -1; let windowToFocus = null;
            this.appServices.getOpenWindows().forEach(win => {
                if (win && win.element && !win.isMinimized && win.id !== this.id) {
                    const z = parseInt(win.element.style.zIndex);
                    if (z > nextHighestZ) { nextHighestZ = z; windowToFocus = win; }
                }
            });
            if (windowToFocus) windowToFocus.focus(true); // true to skip undo for this focus action
            else if (this.appServices.getOpenWindows) { // If no other window, just update all taskbar buttons
                 this.appServices.getOpenWindows().forEach(win => win?.updateTaskbarButtonActiveState?.());
            }
        }
        this.updateTaskbarButtonActiveState(); // Update own button state
    }

    restore(skipUndo = false) {
        if (!this.element) return;
        const wasMinimized = this.isMinimized;
        if (this.isMinimized) {
            this.isMinimized = false;
            this.element.classList.remove('minimized');
        }
        // Always focus when restoring, even if it wasn't technically minimized but focus was lost
        this.focus(true); // Focus it, true to skip undo for this focus action itself
        if (wasMinimized && !skipUndo) this._captureUndo(`Restore window "${this.title}"`);
        this.updateTaskbarButtonActiveState();
    }

    close(isReconstruction = false) {
        console.log(`[SnugWindow ${this.id}] close() called for "${this.title}". IsReconstruction: ${isReconstruction}`);
        this._isDragging = false; // Ensure drag/resize flags are cleared
        this._isResizing = false;

        if (this.onCloseCallback && typeof this.onCloseCallback === 'function') {
            try { this.onCloseCallback(); }
            catch (e) { console.error(`[SnugWindow ${this.id}] Error in onCloseCallback:`, e); }
        }

        if (this.taskbarButton) {
            try { this.taskbarButton.remove(); }
            catch(e) { console.warn(`[SnugWindow ${this.id}] Error removing taskbar button:`, e.message); }
            this.taskbarButton = null;
        }
        if (this.element) {
            try { this.element.remove(); }
            catch(e) { console.warn(`[SnugWindow ${this.id}] Error removing window element:`, e.message); }
            this.element = null; // CRITICAL: Set element to null after removing from DOM
        }

        const oldWindowTitle = this.title; // Store title before clearing instance from map
        if (this.appServices.removeWindowFromStore) {
            this.appServices.removeWindowFromStore(this.id);
        } else {
            console.warn(`[SnugWindow ${this.id}] appServices.removeWindowFromStore service NOT available.`);
        }

        // Only capture undo if it's a user action, not part of reconstruction
        const isCurrentlyReconstructing = this.appServices.getIsReconstructingDAW ? this.appServices.getIsReconstructingDAW() : false;
        if (!isCurrentlyReconstructing && !isReconstruction) {
            this._captureUndo(`Close window "${oldWindowTitle}"`);
        }
        console.log(`[SnugWindow ${this.id}] close() finished for "${oldWindowTitle}".`);
    }

    focus(skipUndoForFocusItself = false) { // skipUndo flag relates to undoing the focus action, not subsequent actions
        if (!this.element) return; // Do nothing if element is gone
        if (this.isMinimized) { this.restore(skipUndoForFocusItself); return; } // Restore if minimized

        const currentHighestZGlobal = this.appServices.getHighestZ ? this.appServices.getHighestZ() : 100;
        const currentZ = parseInt(this.element.style.zIndex);

        if (currentZ < currentHighestZGlobal || (this.appServices.getOpenWindows && this.appServices.getOpenWindows().size === 1)) {
            if (this.appServices.incrementHighestZ) {
                const newZ = this.appServices.incrementHighestZ();
                this.element.style.zIndex = newZ;
                console.log(`[SnugWindow ${this.id}] Focused. New z-index: ${newZ}`);
            }
        } else if (currentZ > currentHighestZGlobal) { // This window was saved with a higher z-index
             if (this.appServices.setHighestZ) {
                this.appServices.setHighestZ(currentZ);
                console.log(`[SnugWindow ${this.id}] Focused. Current z-index ${currentZ} is now highest.`);
            }
        }
        // No undo capture for focus action itself as it's a transient UI state change.

        // Update active state for all taskbar buttons
        if (this.appServices.getOpenWindows) {
            this.appServices.getOpenWindows().forEach(win => {
                if (win && win.updateTaskbarButtonActiveState && typeof win.updateTaskbarButtonActiveState === 'function') {
                    win.updateTaskbarButtonActiveState();
                }
            });
        }
    }

    applyState(state) {
        if (!this.element) {
            console.error(`[SnugWindow ${this.id} applyState] Window element does not exist. Cannot apply state for "${state?.title}".`);
            return;
        }
        if (!state) {
            console.error(`[SnugWindow ${this.id} applyState] Invalid or null state object provided.`);
            return;
        }

        console.log(`[SnugWindow ${this.id} applyState] Applying state:`, JSON.parse(JSON.stringify(state)));

        if (state.left) this.element.style.left = state.left;
        if (state.top) this.element.style.top = state.top;
        if (state.width) this.element.style.width = state.width;
        if (state.height) this.element.style.height = state.height;
        if (Number.isFinite(state.zIndex)) this.element.style.zIndex = state.zIndex;

        if (this.titleBar) {
            const titleSpan = this.titleBar.querySelector('span');
            if (titleSpan && state.title) titleSpan.textContent = state.title;
        }
        if (state.title) this.title = state.title; // Update internal title property

        if (this.taskbarButton && state.title) {
            this.taskbarButton.textContent = state.title.substring(0, 20) + (state.title.length > 20 ? '...' : '');
            this.taskbarButton.title = state.title;
        }

        if (state.isMinimized && !this.isMinimized) {
            this.minimize(true); // true for silent (no undo capture)
        } else if (!state.isMinimized && this.isMinimized) {
            this.restore(true); // true for silent
        }
        this.updateTaskbarButtonActiveState();
    }
}
