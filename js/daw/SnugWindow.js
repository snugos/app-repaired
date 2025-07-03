// js/daw/SnugWindow.js - SnugWindow Class Module

import { createContextMenu } from '/app/js/daw/utils.js'; // Corrected path

export class SnugWindow { //
    constructor(id, title, contentHTMLOrElement, options = {}, appServices = {}) {
        // --- DEBUGGING LOG ---
        console.log(`%c[SnugWindow.js] Constructor for window "${id}" received options:`, 'color: #9b59b6; font-weight: bold;', JSON.parse(JSON.stringify(options)));

        this.id = id;
        this.title = title;
        this.isMinimized = false;
        this.initialContentKey = options.initialContentKey || id;
        this.taskbarButton = null;
        this.onCloseCallback = options.onCloseCallback || (() => {});
        this.onRefreshCallback = options.onRefresh || null;
        this.isMaximized = false;
        this.restoreState = {};
        this.appServices = appServices; // Ensure appServices is assigned
        this._isDragging = false;
        this._isResizing = false;

        // Use cached elements if available, otherwise get from DOM
        const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
        if (!desktopEl) {
            console.error(`[SnugWindow CRITICAL ${this.id}] Desktop element not found. Cannot create window \"${title}\".`);
            this.element = null;
            return;
        }

        // Get taskbar height dynamically
        const taskbarEl = this.appServices.uiElementsCache?.taskbar || document.getElementById('taskbar');
        const taskbarHeightVal = taskbarEl?.offsetHeight > 0 ? taskbarEl.offsetHeight : 32;

        this.options = {
            width: options.width || 400,
            height: options.height || 300,
            x: options.x === undefined ? (desktopEl.offsetWidth - (options.width || 400)) / 2 : options.x,
            y: options.y === undefined ? (desktopEl.offsetHeight - (options.height || 300)) / 2 : options.y,
            minWidth: options.minWidth || 150,
            minHeight: options.minHeight || 100,
            // New option for resizable
            resizable: options.resizable !== undefined ? options.resizable : true, // Default to true
        };

        this.element = document.createElement('div');
        this.element.className = 'window';
        this.element.id = this.id;

        this.titleBar = this.createTitleBar(title);
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'window-content';

        if (typeof contentHTMLOrElement === 'string') {
            this.contentContainer.innerHTML = contentHTMLOrElement;
        } else if (contentHTMLOrElement instanceof HTMLElement) {
            this.contentContainer.appendChild(contentHTMLOrElement);
        }

        this.element.appendChild(this.titleBar);
        this.element.appendChild(this.contentContainer);

        this.applyStyles(desktopEl, taskbarHeightVal);
        this.createTaskbarButton();

        desktopEl.appendChild(this.element);

        this.makeDraggable();
        // Only make resizable if option is true
        if (this.options.resizable) {
            this.makeResizable();
        }

        this.element.addEventListener('mousedown', () => this.focus());

        this.appServices.addWindowToStore(this.id, this);
        this.focus();
    }

    refresh() {
        if (typeof this.onRefreshCallback === 'function') {
            this.onRefreshCallback(this);
        }
    }

    createTitleBar(title) {
        const titleBar = document.createElement('div');
        titleBar.className = 'window-title-bar';
        titleBar.innerHTML = `<span>${title}</span>
            <div class="window-title-buttons">
                <button class="minimize-btn" title="Minimize">_</button>
                <button class="maximize-btn" title="Maximize">□</button>
                <button class="close-btn" title="Close">X</button>
            </div>`;

        titleBar.querySelector('.close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });
        titleBar.querySelector('.minimize-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.minimize();
        });
        titleBar.querySelector('.maximize-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMaximize();
        });
        return titleBar;
    }

    applyStyles(desktopEl, taskbarHeight) {
        Object.assign(this.element.style, {
            width: `${this.options.width}px`,
            height: `${this.options.height}px`,
            left: `${Math.max(0, Math.min(this.options.x, desktopEl.offsetWidth - this.options.width))}px`,
            top: `${Math.max(0, Math.min(this.options.y, desktopEl.offsetHeight - this.options.height))}px`,
            minWidth: `${this.options.minWidth}px`,
            minHeight: `${this.options.minHeight}px`,
        });
    }

    createTaskbarButton() {
        const container = document.getElementById('taskbarButtons');
        if (!container) return;
        this.taskbarButton = document.createElement('button');
        this.taskbarButton.className = 'taskbar-button';
        this.taskbarButton.id = `taskbar-btn-${this.id}`;
        this.taskbarButton.textContent = this.title.substring(0, 20) + (this.title.length > 20 ? '...' : '');
        this.taskbarButton.title = this.title;
        this.taskbarButton.addEventListener('click', () => {
            if (this.isMinimized) {
                this.restore();
            } else {
                this.focus();
            }
        });
        this.taskbarButton.addEventListener('contextmenu', (e) => this.showTaskbarContextMenu(e));
        container.appendChild(this.taskbarButton);
    }

    makeDraggable() {
        let offsetX, offsetY;
        const onMouseMove = (e) => {
            if (!this._isDragging) return;
            // Prevent dragging if window is maximized
            if (this.isMaximized) return;

            this.element.style.left = `${e.clientX - offsetX}px`;
            this.element.style.top = `${e.clientY - offsetY}px`;
        };
        const onMouseUp = () => {
            this._isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        this.titleBar.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            // If maximized, restore on drag start
            if (this.isMaximized) {
                this.toggleMaximize();
                // Adjust offsets for restored window position
                offsetX = e.clientX - this.element.offsetLeft;
                offsetY = e.clientY - this.element.offsetTop; // This is the corrected line
            }

            this._isDragging = true;
            offsetX = e.clientX - this.element.offsetLeft;
            // FIX APPLIED HERE: Corrected offsetY calculation
            offsetY = e.clientY - this.element.offsetTop;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    makeResizable() {
        const resizer = document.createElement('div');
        resizer.className = 'window-resizer';
        this.element.appendChild(resizer);

        let startX, startY, startWidth, startHeight;

        const onMouseMove = (e) => {
            if (!this._isResizing) return;
            e.preventDefault(); // Prevent text selection during drag

            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);

            // Get desktop dimensions to clamp resizing
            const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
            const desktopRect = desktopEl.getBoundingClientRect();
            const topTaskbarHeight = (this.appServices.uiElementsCache?.topTaskbar?.offsetHeight || 40);
            const bottomTaskbarHeight = (this.appServices.uiElementsCache?.taskbar?.offsetHeight || 32);

            // Calculate max available space for content within desktop boundaries
            const maxContentWidth = desktopRect.width - this.element.offsetLeft;
            const maxContentHeight = desktopRect.height - this.element.offsetTop - topTaskbarHeight - bottomTaskbarHeight;


            // Apply new width/height, respecting min/max dimensions
            this.element.style.width = `${Math.max(this.options.minWidth, Math.min(newWidth, maxContentWidth))}px`;
            this.element.style.height = `${Math.max(this.options.minHeight, Math.min(newHeight, maxContentHeight))}px`;
        };

        const onMouseUp = () => {
            this._isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.element.classList.remove('resizing'); // Add a class for visual feedback if needed
        };

        resizer.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Prevent drag from starting simultaneously
            // If maximized, prevent resizing
            if (this.isMaximized) return;

            this._isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = this.element.offsetWidth;
            startHeight = this.element.offsetHeight;
            this.element.classList.add('resizing'); // Add a class for visual feedback if needed
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    focus() {
        this.appServices.getOpenWindows().forEach(win => {
            if (win.element) {
                win.element.style.zIndex = this.appServices.getHighestZ(); // Set others to default
            }
        });
        const newZ = this.appServices.incrementHighestZ();
        this.element.style.zIndex = newZ;
        document.querySelectorAll('.taskbar-button').forEach(btn => btn.classList.remove('active'));
        this.taskbarButton?.classList.add('active');
    }

    close(isSilent = false) {
        if (!isSilent && this.onCloseCallback) {
            this.onCloseCallback(this.id);
        }
        this.element?.remove();
        this.taskbarButton?.remove();
        this.appServices.removeWindowFromStore(this.id);
    }

    minimize(isSilent = false) {
        this.isMinimized = true;
        this.element.style.display = 'none';
        this.taskbarButton?.classList.add('minimized-on-taskbar');
        this.taskbarButton?.classList.remove('active');
    }

    restore() {
        this.isMinimized = false;
        this.element.style.display = 'flex';
        this.taskbarButton?.classList.remove('minimized-on-taskbar');
        this.focus();
    }

    toggleMaximize() {
        const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
        const topTaskbarHeight = (this.appServices.uiElementsCache?.topTaskbar?.offsetHeight || 40);
        const bottomTaskbarHeight = (this.appServices.uiElementsCache?.taskbar?.offsetHeight || 32);

        if (this.isMaximized) {
            // Restore from maximized
            Object.assign(this.element.style, {
                left: `${this.restoreState.x}px`,
                top: `${this.restoreState.y}px`,
                width: `${this.restoreState.width}px`,
                height: `${this.restoreState.height}px`,
            });
            this.isMaximized = false;
        } else {
            // Maximize
            this.restoreState = { // Save current state for restore
                x: this.element.offsetLeft,
                y: this.element.offsetTop,
                width: this.element.offsetWidth,
                height: this.element.offsetHeight,
            };
            Object.assign(this.element.style, {
                left: '0px',
                top: `${topTaskbarHeight}px`, // Below top taskbar
                width: `${desktopEl.offsetWidth}px`,
                height: `${desktopEl.offsetHeight - topTaskbarHeight - bottomTaskbarHeight}px`, // Between taskbars
            });
            this.isMaximized = true;
        }
        this.focus(); // Bring to front after state change
    }

    showTaskbarContextMenu(e) {
        e.preventDefault(); // Prevent default browser context menu
        const menuItems = [
            { label: this.isMinimized ? 'Restore' : 'Minimize', action: () => this.isMinimized ? this.restore() : this.minimize() },
            { label: this.isMaximized ? 'Restore' : 'Maximize', action: () => this.toggleMaximize() },
            { separator: true },
            { label: 'Close', action: () => this.close() }
        ];
        this.appServices.createContextMenu(e, menuItems);
    }

    // NEW: Method to get the current state of the window for serialization/restoration
    getWindowState() {
        return {
            x: this.element.offsetLeft,
            y: this.element.offsetTop,
            width: this.element.offsetWidth,
            height: this.element.offsetHeight,
            isMinimized: this.isMinimized,
            isMaximized: this.isMaximized,
            // Store restoreState if currently maximized
            restoreState: this.isMaximized ? this.restoreState : undefined,
            resizable: this.options.resizable, // Persist resizable property
        };
    }
}