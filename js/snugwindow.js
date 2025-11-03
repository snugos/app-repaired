// js/SnugWindow.js - SnugWindow Class Module

import { createContextMenu } from './utils.js';

const defaultWindowBg = '#282828';
const defaultWindowContentBg = '#1e1e1e'; // Matching window content from style.css

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
        this.appServices = appServices; // Store appServices for accessing global state and functions

        const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
        if (!desktopEl) {
            console.error(`[SnugWindow CRITICAL ${id}] Desktop element not found.`);
            this.element = null;
            return;
        }

        const defaultWidth = options.width || Math.min(350, desktopEl.offsetWidth - 40);
        const defaultHeight = options.height || Math.min(250, desktopEl.offsetHeight - 80);
        const taskbarHeightVal = (this.appServices.uiElementsCache?.taskbar || document.getElementById('taskbar'))?.offsetHeight || 30;

        const maxX = Math.max(5, desktopEl.offsetWidth - defaultWidth - 10);
        const maxY = Math.max(5, desktopEl.offsetHeight - defaultHeight - 10 - taskbarHeightVal);

        let initialX = options.x;
        let initialY = options.y;

        // Use appServices to get open window count for cascading
        const openWindowCount = this.appServices.getOpenWindows ? this.appServices.getOpenWindows().size : 0;
        if (initialX === undefined || initialY === undefined) {
            const cascadeOffset = 20 + (openWindowCount % 10) * 25;
            initialX = Math.max(5, Math.min(cascadeOffset, maxX));
            initialY = Math.max(5, Math.min(cascadeOffset, maxY));
        } else {
            initialX = Math.max(5, Math.min(initialX, maxX));
            initialY = Math.max(5, Math.min(initialY, maxY));
        }

        this.options = {
            x: initialX,
            y: initialY,
            width: defaultWidth,
            height: defaultHeight,
            minWidth: options.minWidth || 150,
            minHeight: options.minHeight || 100,
            closable: options.closable !== undefined ? options.closable : true,
            minimizable: options.minimizable !== undefined ? options.minimizable : true,
            resizable: options.resizable !== undefined ? options.resizable : true,
            ...options
        };

        this.element = document.createElement('div');
        this.element.id = `window-${this.id}`;
        this.element.className = 'window';
        this.element.style.left = `${this.options.x}px`;
        this.element.style.top = `${this.options.y}px`;
        this.element.style.width = `${this.options.width}px`;
        this.element.style.height = `${this.options.height}px`;

        // Use appServices for z-index management
        const initialZIndex = options.zIndex !== undefined ? options.zIndex : (this.appServices.incrementHighestZ ? this.appServices.incrementHighestZ() : 101);
        this.element.style.zIndex = initialZIndex;
        if (this.appServices.setHighestZ && initialZIndex > (this.appServices.getHighestZ ? this.appServices.getHighestZ() : 100)) {
            this.appServices.setHighestZ(initialZIndex);
        }


        this.element.style.backgroundColor = defaultWindowBg; // Use CSS variables or consistent dark theme color

        let buttonsHTML = '';
        if (this.options.minimizable) { buttonsHTML += `<button class="window-minimize-btn" title="Minimize">_</button>`; }
        if (this.options.resizable) { buttonsHTML += `<button class="window-maximize-btn" title="Maximize">□</button>`; }
        if (this.options.closable) { buttonsHTML += `<button class="window-close-btn" title="Close">X</button>`; }

        this.titleBar = document.createElement('div');
        this.titleBar.className = 'window-title-bar';
        this.titleBar.innerHTML = `<span>${this.title}</span><div class="window-title-buttons">${buttonsHTML}</div>`;

        this.contentArea = document.createElement('div');
        this.contentArea.className = 'window-content';
        this.contentArea.style.backgroundColor = defaultWindowContentBg;

        if (typeof contentHTMLOrElement === 'string') {
            this.contentArea.innerHTML = contentHTMLOrElement;
        } else if (contentHTMLOrElement instanceof HTMLElement) {
            this.contentArea.appendChild(contentHTMLOrElement);
        }

        this.element.appendChild(this.titleBar);
        this.element.appendChild(this.contentArea);
        desktopEl.appendChild(this.element);

        if (this.appServices.addWindowToStore) {
            this.appServices.addWindowToStore(this.id, this);
        } else {
            console.warn("[SnugWindow] addWindowToStore service not available via appServices.");
        }


        this.makeDraggable();
        if (this.options.resizable) {
            this.makeResizable();
        }

        if (this.options.closable) {
            this.element.querySelector('.window-close-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
        }
        if (this.options.minimizable) {
            this.element.querySelector('.window-minimize-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this.minimize(); });
        }
        if (this.options.resizable) {
            this.element.querySelector('.window-maximize-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMaximize(); });
        }

        this.element.addEventListener('mousedown', () => this.focus(), true);
        this.createTaskbarButton();

        if (options.isMinimized) {
            this.minimize(true); // true to skip undo for initial state
        }
    }

    _captureUndo(description) {
        if (this.appServices.captureStateForUndo) {
            this.appServices.captureStateForUndo(description);
        } else {
            console.warn(`[SnugWindow ${this.id}] captureStateForUndo service not available.`);
        }
    }


    makeDraggable() {
        if (!this.titleBar) return;
        let offsetX, offsetY, isDragging = false;
        const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
        let initialX, initialY;

        this.titleBar.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || !desktopEl || this.isMaximized) return;
            isDragging = true; this.focus();
            initialX = this.element.offsetLeft;
            initialY = this.element.offsetTop;
            offsetX = e.clientX - initialX;
            offsetY = e.clientY - initialY;
            this.titleBar.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !desktopEl) return;
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            const desktopRect = desktopEl.getBoundingClientRect();
            const taskbarHeightVal = (this.appServices.uiElementsCache?.taskbar || document.getElementById('taskbar'))?.offsetHeight || 30;
            newX = Math.max(0, Math.min(newX, desktopRect.width - this.element.offsetWidth));
            newY = Math.max(0, Math.min(newY, desktopRect.height - this.element.offsetHeight - taskbarHeightVal));
            newY = Math.max(0, Math.min(newY, desktopRect.height - taskbarHeightVal - this.titleBar.offsetHeight));
            this.element.style.left = `${newX}px`;
            this.element.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                if (this.titleBar) this.titleBar.style.cursor = 'grab';
                document.body.style.userSelect = '';
                if (this.element.offsetLeft !== initialX || this.element.offsetTop !== initialY) {
                   this._captureUndo(`Move window "${this.title}"`);
                }
            }
        });
    }

    makeResizable() {
        const resizer = document.createElement('div');
        resizer.className = 'window-resizer';
        this.element.appendChild(resizer);
        this.element.style.overflow = 'hidden'; // Keep this to contain the resizer

        let initialWidth, initialHeight, initialMouseX, initialMouseY, isResizing = false;
        let originalStyleWidth, originalStyleHeight;

        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            isResizing = true; this.focus();
            initialWidth = this.element.offsetWidth;
            initialHeight = this.element.offsetHeight;
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            originalStyleWidth = this.element.style.width;
            originalStyleHeight = this.element.style.height;
            document.body.style.cursor = 'nwse-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const dx = e.clientX - initialMouseX;
            const dy = e.clientY - initialMouseY;
            const newWidth = Math.max(this.options.minWidth, initialWidth + dx);
            const newHeight = Math.max(this.options.minHeight, initialHeight + dy);
            this.element.style.width = `${newWidth}px`;
            this.element.style.height = `${newHeight}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                if (this.element.style.width !== originalStyleWidth || this.element.style.height !== originalStyleHeight) {
                   this._captureUndo(`Resize window "${this.title}"`);
                }
            }
        });
    }

    toggleMaximize() {
        const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
        const taskbarEl = this.appServices.uiElementsCache?.taskbar || document.getElementById('taskbar');
        if (!desktopEl || !taskbarEl) return;

        const maximizeButton = this.titleBar.querySelector('.window-maximize-btn');
        const wasMaximized = this.isMaximized;

        if (this.isMaximized) {
            this.element.style.left = this.restoreState.left;
            this.element.style.top = this.restoreState.top;
            this.element.style.width = this.restoreState.width;
            this.element.style.height = this.restoreState.height;
            this.isMaximized = false;
            if (maximizeButton) maximizeButton.innerHTML = '□'; // Restore icon
        } else {
            this.restoreState = {
                left: this.element.style.left,
                top: this.element.style.top,
                width: this.element.style.width,
                height: this.element.style.height,
            };
            const taskbarHeight = taskbarEl.offsetHeight;
            this.element.style.left = '0px';
            this.element.style.top = '0px';
            this.element.style.width = `${desktopEl.clientWidth}px`;
            this.element.style.height = `${desktopEl.clientHeight - taskbarHeight}px`;
            this.isMaximized = true;
            if (maximizeButton) maximizeButton.innerHTML = '❐'; // Maximize icon (could be a different one)
        }
        this._captureUndo(`${wasMaximized ? "Restore" : "Maximize"} window "${this.title}"`);
        this.focus();
    }

    createTaskbarButton() {
        const taskbarButtonsContainer = this.appServices.uiElementsCache?.taskbarButtonsContainer || document.getElementById('taskbarButtons');
        if (!taskbarButtonsContainer) return;
        this.taskbarButton = document.createElement('button');
        this.taskbarButton.className = 'taskbar-button';
        this.taskbarButton.textContent = this.title.substring(0, 15) + (this.title.length > 15 ? '...' : '');
        this.taskbarButton.title = this.title;
        this.taskbarButton.dataset.windowId = this.id;
        taskbarButtonsContainer.appendChild(this.taskbarButton);

        this.taskbarButton.addEventListener('click', () => {
            if (this.isMinimized) { this.restore(); }
            else {
                const currentHighestZ = this.appServices.getHighestZ ? this.appServices.getHighestZ() : 100;
                if (this.element && parseInt(this.element.style.zIndex) === currentHighestZ) {
                    this.minimize();
                } else {
                    this.focus();
                }
            }
        });

        this.taskbarButton.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            event.stopPropagation();

            const menuItems = [];
            if (this.isMinimized) {
                menuItems.push({ label: "Restore", action: () => this.restore() });
            } else {
                menuItems.push({ label: "Minimize", action: () => this.minimize() });
            }

            if (this.options.resizable) {
                menuItems.push({
                    label: this.isMaximized ? "Restore Down" : "Maximize",
                    action: () => this.toggleMaximize()
                });
            }

            if (this.options.closable) {
                menuItems.push({ label: "Close", action: () => this.close() });
            }

            let trackId = null;
            const parts = this.id.split('-');
            if (parts.length > 1 && (this.id.startsWith('trackInspector-') || this.id.startsWith('effectsRack-') || this.id.startsWith('sequencerWin-'))) {
                const idPart = parts[parts.length - 1];
                if (!isNaN(parseInt(idPart))) trackId = parseInt(idPart);
            }

            let currentTrack = null;
            if (trackId !== null && this.appServices.getTrackById) {
                 currentTrack = this.appServices.getTrackById(trackId);
            }

            if (currentTrack) {
                menuItems.push({ separator: true });
                if (!this.id.startsWith('trackInspector-') && this.appServices.handleOpenTrackInspector) {
                    menuItems.push({ label: "Open Inspector", action: () => this.appServices.handleOpenTrackInspector(trackId) });
                }
                if (!this.id.startsWith('effectsRack-') && this.appServices.handleOpenEffectsRack) {
                    menuItems.push({ label: "Open Effects Rack", action: () => this.appServices.handleOpenEffectsRack(trackId) });
                }
                if (!this.id.startsWith('sequencerWin-') && this.appServices.handleOpenSequencer) {
                    menuItems.push({ label: "Open Sequencer", action: () => this.appServices.handleOpenSequencer(trackId) });
                }
            }
            createContextMenu(event, menuItems); // createContextMenu is imported from utils.js
        });
        this.updateTaskbarButtonActiveState();
    }

    updateTaskbarButtonActiveState() {
        if (this.taskbarButton && this.element) {
            const currentHighestZ = this.appServices.getHighestZ ? this.appServices.getHighestZ() : 100;
            const isActive = !this.isMinimized && parseInt(this.element.style.zIndex) === currentHighestZ;
            this.taskbarButton.classList.toggle('active', isActive);
            this.taskbarButton.classList.toggle('minimized-on-taskbar', this.isMinimized && !isActive);
        }
    }

    minimize(skipUndo = false) {
        if (!this.isMinimized && this.element) {
            this.isMinimized = true;
            this.element.classList.add('minimized');
            if (this.taskbarButton) {
                this.taskbarButton.classList.add('minimized-on-taskbar');
                this.taskbarButton.classList.remove('active');
            }
            if (!skipUndo) this._captureUndo(`Minimize window "${this.title}"`);

            let nextHighestZ = -1;
            let windowToFocus = null;

            if (this.appServices.getOpenWindows) {
                this.appServices.getOpenWindows().forEach(win => {
                    if (win && win.element && !win.isMinimized && win.id !== this.id) {
                        const z = parseInt(win.element.style.zIndex);
                        if (z > nextHighestZ) {
                            nextHighestZ = z;
                            windowToFocus = win;
                        }
                    }
                });
            }

            if (windowToFocus) {
                windowToFocus.focus(true); // true to skip undo for programmatic focus
            } else {
                // If no other window to focus, just update all taskbar buttons
                 if (this.appServices.getOpenWindows) {
                    this.appServices.getOpenWindows().forEach(win => win?.updateTaskbarButtonActiveState?.());
                }
            }
        }
    }

    restore(skipUndo = false) {
        if (this.isMinimized && this.element) {
            this.isMinimized = false;
            this.element.classList.remove('minimized');
            this.focus(true); // true to skip undo for programmatic focus/restore
            if (!skipUndo) this._captureUndo(`Restore window "${this.title}"`);
        } else if (this.element) {
            this.focus(skipUndo);
        }
    }

    close(isReconstruction = false) {
        if (this.onCloseCallback && typeof this.onCloseCallback === 'function') {
            try { this.onCloseCallback(); }
            catch (e) { console.error(`[SnugWindow ${this.id}] Error in onCloseCallback:`, e); }
        }

        if (this.taskbarButton) try { this.taskbarButton.remove(); } catch(e) { /* ignore */ }
        if (this.element) try { this.element.remove(); } catch(e) { /* ignore */ }

        const oldWindowTitle = this.title;
        if (this.appServices.removeWindowFromStore) {
            this.appServices.removeWindowFromStore(this.id);
        } else {
            console.warn("[SnugWindow] removeWindowFromStore service not available.");
        }


        // Use appServices to notify main.js or state.js to clear track window references
        // This specific service might not exist, but the general idea is to decouple
        // if (this.appServices.clearTrackWindowReference) {
        // this.appServices.clearTrackWindowReference(this.id);
        // }

        const isCurrentlyReconstructing = this.appServices.getIsReconstructingDAW ? this.appServices.getIsReconstructingDAW() : false;
        if (!isCurrentlyReconstructing && !isReconstruction) {
            this._captureUndo(`Close window "${oldWindowTitle}"`);
        }
    }

    focus(skipUndo = false) {
        if (this.isMinimized) { this.restore(skipUndo); return; }
        if (!this.element) return;

        const currentHighestZGlobal = this.appServices.getHighestZ ? this.appServices.getHighestZ() : 100;
        const currentZ = parseInt(this.element.style.zIndex);

        if (currentZ < currentHighestZGlobal || (this.appServices.getOpenWindows && this.appServices.getOpenWindows().size === 1)) {
            if (this.appServices.incrementHighestZ) {
                this.element.style.zIndex = this.appServices.incrementHighestZ();
            }
        } else if (currentZ > currentHighestZGlobal) {
            if (this.appServices.setHighestZ) {
                this.appServices.setHighestZ(currentZ);
            }
        }

        if (this.appServices.getOpenWindows) {
            this.appServices.getOpenWindows().forEach(win => {
                if (win && win.taskbarButton && typeof win.updateTaskbarButtonActiveState === 'function') {
                    win.updateTaskbarButtonActiveState();
                }
            });
        }
    }

    applyState(state) { // Used during project load/undo/redo
        if (!this.element) return;
        this.element.style.left = state.left;
        this.element.style.top = state.top;
        this.element.style.width = state.width;
        this.element.style.height = state.height;
        this.element.style.zIndex = state.zIndex;
        if (this.titleBar) this.titleBar.querySelector('span').textContent = state.title;
        this.title = state.title;
        if (this.taskbarButton) {
            this.taskbarButton.textContent = state.title.substring(0, 15) + (state.title.length > 15 ? '...' : '');
            this.taskbarButton.title = state.title;
        }

        if (state.isMinimized && !this.isMinimized) {
            this.minimize(true); // true for silent
        } else if (!state.isMinimized && this.isMinimized) {
            this.restore(true); // true for silent
        }
        this.updateTaskbarButtonActiveState();
    }
}
