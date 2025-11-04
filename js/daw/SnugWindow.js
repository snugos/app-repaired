// js/daw/SnugWindow.js - SnugWindow Class Module

// Removed import { createContextMenu } from './utils.js'; as createContextMenu is global

export class SnugWindow { // This class is exported
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

        const desktopEl = this.appServices.uiElementsCache?.desktop || document.getElementById('desktop');
        if (!desktopEl) {
            console.error(`[SnugWindow CRITICAL ${this.id}] Desktop element not found. Cannot create window \"${title}\".`);
            this.element = null; 
            return; 
        }

        const taskbarEl = this.appServices.uiElementsCache?.taskbar || document.getElementById('taskbar');
        const taskbarHeightVal = taskbarEl?.offsetHeight > 0 ? taskbarEl.offsetHeight : 32;

        this.options = {
            width: options.width || 400,
            height: options.height || 300,
            x: options.x === undefined ? (desktopEl.offsetWidth - (options.width || 400)) / 2 : options.x,
            y: options.y === undefined ? (desktopEl.offsetHeight - (options.height || 300)) / 2 : options.y,
            minWidth: options.minWidth || 150,
            minHeight: options.minHeight || 100,
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
        this.makeResizable();

        this.element.addEventListener('mousedown', () => this.focus());

        // addWindowToStore is global
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
            this._isDragging = true;
            offsetX = e.clientX - this.element.offsetLeft;
            offsetY = e.clientY - this.element.offsetTop;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }
    
    makeResizable() {
        // This function is declared but currently empty.
        // You would add the resize handle elements and their drag logic here.
        // For example, creating a corner div that changes width/height on drag.
    }

    focus() {
        // incrementHighestZ is global
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
        // removeWindowFromStore is global
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
        // Implementation for maximizing/restoring window...
    }
    
    showTaskbarContextMenu(e) {
        // createContextMenu is global
        createContextMenu(e, [], this.appServices);
    }

    // NEW: Method to get the current state of the window for serialization/restoration
    getWindowState() { // Export removed
        return {
            x: this.element.offsetLeft,
            y: this.element.offsetTop,
            width: this.element.offsetWidth,
            height: this.element.offsetHeight,
            isMinimized: this.isMinimized,
            isMaximized: this.isMaximized,
            // Add other state properties you want to persist/restore here if necessary
        };
    }
}
