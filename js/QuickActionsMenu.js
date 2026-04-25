/**
 * Quick Actions Menu - Context menu for common actions
 * Provides quick access to frequently used actions with keyboard shortcuts
 */

class QuickActionsMenu {
    constructor() {
        this.isVisible = false;
        this.menuElement = null;
        this.context = null; // 'track', 'clip', 'note', 'global'
        this.contextData = null;
        this.searchQuery = '';
        this.selectedIndex = 0;
        this.actions = this.defineActions();
        this.filteredActions = [];
        this.onActionCallback = null;
    }

    defineActions() {
        return {
            global: [
                { id: 'newProject', label: 'New Project', shortcut: 'Ctrl+N', action: () => this.trigger('newProject') },
                { id: 'openProject', label: 'Open Project', shortcut: 'Ctrl+O', action: () => this.trigger('openProject') },
                { id: 'saveProject', label: 'Save Project', shortcut: 'Ctrl+S', action: () => this.trigger('saveProject') },
                { id: 'saveAs', label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: () => this.trigger('saveAs') },
                { id: 'separator1', label: '---', action: null },
                { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', action: () => this.trigger('undo') },
                { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', action: () => this.trigger('redo') },
                { id: 'separator2', label: '---', action: null },
                { id: 'playPause', label: 'Play/Pause', shortcut: 'Space', action: () => this.trigger('playPause') },
                { id: 'stop', label: 'Stop', shortcut: 'Shift+Space', action: () => this.trigger('stop') },
                { id: 'record', label: 'Record', shortcut: 'R', action: () => this.trigger('record') },
                { id: 'separator3', label: '---', action: null },
                { id: 'addTrack', label: 'Add Track', shortcut: 'Ctrl+T', action: () => this.trigger('addTrack') },
                { id: 'addAudioTrack', label: 'Add Audio Track', shortcut: 'Ctrl+Shift+A', action: () => this.trigger('addAudioTrack') },
                { id: 'addMIDITrack', label: 'Add MIDI Track', shortcut: 'Ctrl+Shift+M', action: () => this.trigger('addMIDITrack') },
                { id: 'separator5', label: '---', action: null },
                { id: 'exportProject', label: 'Export Project', shortcut: 'Ctrl+E', action: () => this.trigger('exportProject') },
                { id: 'exportStems', label: 'Export Stems', shortcut: 'Ctrl+Shift+E', action: () => this.trigger('exportStems') },
                { id: 'separator6', label: '---', action: null },
                { id: 'openMIDIMonitor', label: 'MIDI Monitor', shortcut: 'Ctrl+Shift+M', action: () => this.trigger('openMIDIMonitor') },
                { id: 'separator5', label: '---', action: null },
                { id: 'openSettings', label: 'Settings', shortcut: 'Ctrl+,', action: () => this.trigger('openSettings') },
                { id: 'showShortcuts', label: 'Keyboard Shortcuts', shortcut: '?', action: () => this.trigger('showShortcuts') },
                { id: 'openQuickActions', label: 'Quick Actions', shortcut: 'Ctrl+K', action: () => this.trigger('openQuickActions') }
            ],
            track: [
                { id: 'trackMute', label: 'Mute Track', shortcut: 'M', action: () => this.trigger('trackMute') },
                { id: 'trackSolo', label: 'Solo Track', shortcut: 'S', action: () => this.trigger('trackSolo') },
                { id: 'trackArm', label: 'Arm for Recording', shortcut: 'A', action: () => this.trigger('trackArm') },
                { id: 'separator1', label: '---', action: null },
                { id: 'duplicateTrack', label: 'Duplicate Track', shortcut: 'Ctrl+D', action: () => this.trigger('duplicateTrack') },
                { id: 'deleteTrack', label: 'Delete Track', shortcut: 'Delete', action: () => this.trigger('deleteTrack') },
                { id: 'separator2', label: '---', action: null },
                { id: 'addEffect', label: 'Add Effect', shortcut: 'E', action: () => this.trigger('addEffect') },
                { id: 'clearEffects', label: 'Clear Effects', action: () => this.trigger('clearEffects') },
                { id: 'separator3', label: '---', action: null },
                { id: 'freezeTrack', label: 'Freeze Track', action: () => this.trigger('freezeTrack') },
                { id: 'unfreezeTrack', label: 'Unfreeze Track', action: () => this.trigger('unfreezeTrack') },
                { id: 'separator4', label: '---', action: null },
                { id: 'exportTrack', label: 'Export Track Audio', action: () => this.trigger('exportTrack') },
                { id: 'importAudio', label: 'Import Audio', shortcut: 'Ctrl+I', action: () => this.trigger('importAudio') }
            ],
            clip: [
                { id: 'cutClip', label: 'Cut Clip', shortcut: 'Ctrl+X', action: () => this.trigger('cutClip') },
                { id: 'copyClip', label: 'Copy Clip', shortcut: 'Ctrl+C', action: () => this.trigger('copyClip') },
                { id: 'pasteClip', label: 'Paste Clip', shortcut: 'Ctrl+V', action: () => this.trigger('pasteClip') },
                { id: 'deleteClip', label: 'Delete Clip', shortcut: 'Delete', action: () => this.trigger('deleteClip') },
                { id: 'separator1', label: '---', action: null },
                { id: 'splitClip', label: 'Split at Playhead', shortcut: 'Ctrl+B', action: () => this.trigger('splitClip') },
                { id: 'mergeClips', label: 'Merge Selected Clips', action: () => this.trigger('mergeClips') },
                { id: 'separator2', label: '---', action: null },
                { id: 'duplicateClip', label: 'Duplicate Clip', shortcut: 'Ctrl+D', action: () => this.trigger('duplicateClip') },
                { id: 'reverseClip', label: 'Reverse Clip', action: () => this.trigger('reverseClip') },
                { id: 'normalizeClip', label: 'Normalize Clip', action: () => this.trigger('normalizeClip') },
                { id: 'separator3', label: '---', action: null },
                { id: 'fadeIn', label: 'Fade In', action: () => this.trigger('fadeIn') },
                { id: 'fadeOut', label: 'Fade Out', action: () => this.trigger('fadeOut') },
                { id: 'crossfade', label: 'Crossfade', action: () => this.trigger('crossfade') },
                { id: 'separator4', label: '---', action: null },
                { id: 'quantizeClip', label: 'Quantize Clip', shortcut: 'Q', action: () => this.trigger('quantizeClip') },
                { id: 'transposeClip', label: 'Transpose Clip', shortcut: 'T', action: () => this.trigger('transposeClip') },
                { id: 'stretchClip', label: 'Time Stretch...', action: () => this.trigger('stretchClip') },
                { id: 'separator5', label: '---', action: null },
                { id: 'clipColor', label: 'Set Clip Color', action: () => this.trigger('clipColor') },
                { id: 'clipProperties', label: 'Clip Properties', action: () => this.trigger('clipProperties') }
            ],
            note: [
                { id: 'deleteNote', label: 'Delete Note(s)', shortcut: 'Delete', action: () => this.trigger('deleteNote') },
                { id: 'separator1', label: '---', action: null },
                { id: 'transposeUp', label: 'Transpose Up', shortcut: 'Arrow Up', action: () => this.trigger('transposeUp') },
                { id: 'transposeDown', label: 'Transpose Down', shortcut: 'Arrow Down', action: () => this.trigger('transposeDown') },
                { id: 'octaveUp', label: 'Octave Up', shortcut: 'Shift+Arrow Up', action: () => this.trigger('octaveUp') },
                { id: 'octaveDown', label: 'Octave Down', shortcut: 'Shift+Arrow Down', action: () => this.trigger('octaveDown') },
                { id: 'separator2', label: '---', action: null },
                { id: 'quantizeNotes', label: 'Quantize Notes', shortcut: 'Q', action: () => this.trigger('quantizeNotes') },
                { id: 'humanizeNotes', label: 'Humanize Notes', action: () => this.trigger('humanizeNotes') },
                { id: 'separator3', label: '---', action: null },
                { id: 'velocityUp', label: 'Velocity +10', action: () => this.trigger('velocityUp') },
                { id: 'velocityDown', label: 'Velocity -10', action: () => this.trigger('velocityDown') },
                { id: 'velocityMax', label: 'Velocity to Max (127)', action: () => this.trigger('velocityMax') },
                { id: 'separator4', label: '---', action: null },
                { id: 'lengthHalf', label: 'Length ÷2', action: () => this.trigger('lengthHalf') },
                { id: 'lengthDouble', label: 'Length ×2', action: () => this.trigger('lengthDouble') },
                { id: 'legato', label: 'Legato', action: () => this.trigger('legato') },
                { id: 'staccato', label: 'Staccato', action: () => this.trigger('staccato') },
                { id: 'separator5', label: '---', action: null },
                { id: 'copyNotes', label: 'Copy Notes', shortcut: 'Ctrl+C', action: () => this.trigger('copyNotes') },
                { id: 'cutNotes', label: 'Cut Notes', shortcut: 'Ctrl+X', action: () => this.trigger('cutNotes') },
                { id: 'pasteNotes', label: 'Paste Notes', shortcut: 'Ctrl+V', action: () => this.trigger('pasteNotes') }
            ]
        };
    }

    trigger(actionId) {
        if (this.onActionCallback) {
            this.onActionCallback(actionId, this.context, this.contextData);
        }
        this.hide();
    }

    show(context = 'global', data = null, x = null, y = null) {
        this.context = context;
        this.contextData = data;
        this.searchQuery = '';
        this.selectedIndex = 0;

        if (!this.menuElement) {
            this.createMenuElement();
        }

        this.filterActions();
        this.render();
        this.positionMenu(x, y);
        this.menuElement.style.display = 'block';
        this.isVisible = true;

        // Focus the search input
        const searchInput = this.menuElement.querySelector('.quick-actions-search');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 10);
        }
    }

    hide() {
        if (this.menuElement) {
            this.menuElement.style.display = 'none';
        }
        this.isVisible = false;
        this.context = null;
        this.contextData = null;
    }

    createMenuElement() {
        this.menuElement = document.createElement('div');
        this.menuElement.className = 'quick-actions-menu';
        this.menuElement.innerHTML = `
            <div class="quick-actions-header">
                <input type="text" class="quick-actions-search" placeholder="Search actions...">
                <span class="quick-actions-context"></span>
            </div>
            <div class="quick-actions-list"></div>
            <div class="quick-actions-footer">
                <span class="quick-actions-hint">Type to filter • Arrow keys to navigate • Enter to select • Esc to close</span>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .quick-actions-menu {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1e1e2e;
                border: 1px solid #3a3a5a;
                border-radius: 8px;
                min-width: 400px;
                max-width: 500px;
                max-height: 500px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #e0e0e0;
                display: none;
            }
            .quick-actions-header {
                padding: 12px 16px;
                border-bottom: 1px solid #3a3a5a;
            }
            .quick-actions-search {
                width: 100%;
                padding: 10px 14px;
                background: #2a2a3e;
                border: 1px solid #4a4a6a;
                border-radius: 6px;
                color: #e0e0e0;
                font-size: 14px;
                outline: none;
            }
            .quick-actions-search:focus {
                border-color: #6a6aff;
            }
            .quick-actions-search::placeholder {
                color: #888;
            }
            .quick-actions-context {
                display: block;
                margin-top: 8px;
                font-size: 12px;
                color: #888;
            }
            .quick-actions-list {
                max-height: 350px;
                overflow-y: auto;
                padding: 8px 0;
            }
            .quick-actions-item {
                padding: 10px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                transition: background 0.15s;
            }
            .quick-actions-item:hover,
            .quick-actions-item.selected {
                background: #3a3a5e;
            }
            .quick-actions-item.selected {
                background: #4a4a7e;
            }
            .quick-actions-item.disabled {
                opacity: 0.5;
                cursor: default;
            }
            .quick-actions-separator {
                height: 1px;
                background: #3a3a5a;
                margin: 8px 16px;
            }
            .quick-actions-label {
                font-size: 14px;
            }
            .quick-actions-shortcut {
                font-size: 12px;
                color: #888;
                background: #2a2a3e;
                padding: 2px 8px;
                border-radius: 4px;
            }
            .quick-actions-footer {
                padding: 10px 16px;
                border-top: 1px solid #3a3a5a;
                text-align: center;
            }
            .quick-actions-hint {
                font-size: 11px;
                color: #666;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(this.menuElement);

        // Event listeners
        const searchInput = this.menuElement.querySelector('.quick-actions-search');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.selectedIndex = 0;
            this.filterActions();
            this.render();
        });

        searchInput.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Close on click outside
        this.menuElement.addEventListener('click', (e) => {
            if (e.target === this.menuElement) {
                this.hide();
            }
        });
    }

    positionMenu(x, y) {
        if (x !== null && y !== null) {
            // Position at specific coordinates
            this.menuElement.style.left = x + 'px';
            this.menuElement.style.top = y + 'px';
            this.menuElement.style.transform = 'none';
        } else {
            // Center on screen
            this.menuElement.style.left = '50%';
            this.menuElement.style.top = '50%';
            this.menuElement.style.transform = 'translate(-50%, -50%)';
        }
    }

    filterActions() {
        const contextActions = this.actions[this.context] || this.actions.global;
        
        if (!this.searchQuery) {
            this.filteredActions = [...contextActions];
        } else {
            this.filteredActions = contextActions.filter(action => 
                action.label !== '---' && action.label.toLowerCase().includes(this.searchQuery)
            );
        }
    }

    render() {
        if (!this.menuElement) return;

        // Update context label
        const contextSpan = this.menuElement.querySelector('.quick-actions-context');
        const contextLabels = {
            global: 'Global Actions',
            track: 'Track Actions',
            clip: 'Clip Actions',
            note: 'Note Actions'
        };
        contextSpan.textContent = contextLabels[this.context] || 'Actions';

        // Render action list
        const listEl = this.menuElement.querySelector('.quick-actions-list');
        listEl.innerHTML = '';

        let visibleIndex = 0;
        this.filteredActions.forEach((action, index) => {
            if (action.label === '---') {
                const separator = document.createElement('div');
                separator.className = 'quick-actions-separator';
                listEl.appendChild(separator);
            } else {
                const item = document.createElement('div');
                item.className = 'quick-actions-item';
                if (visibleIndex === this.selectedIndex) {
                    item.classList.add('selected');
                }

                item.innerHTML = `
                    <span class="quick-actions-label">${action.label}</span>
                    ${action.shortcut ? `<span class="quick-actions-shortcut">${action.shortcut}</span>` : ''}
                `;

                item.addEventListener('click', () => {
                    if (action.action) {
                        action.action();
                    }
                });

                item.addEventListener('mouseenter', () => {
                    this.selectedIndex = visibleIndex;
                    this.render();
                });

                listEl.appendChild(item);
                visibleIndex++;
            }
        });
    }

    handleKeydown(e) {
        const nonSeparatorCount = this.filteredActions.filter(a => a.label !== '---').length;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % nonSeparatorCount;
                this.render();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + nonSeparatorCount) % nonSeparatorCount;
                this.render();
                break;
            case 'Enter':
                e.preventDefault();
                const selectedAction = this.filteredActions.filter(a => a.label !== '---')[this.selectedIndex];
                if (selectedAction && selectedAction.action) {
                    selectedAction.action();
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.hide();
                break;
        }
    }

    setOnActionCallback(callback) {
        this.onActionCallback = callback;
    }

    isOpen() {
        return this.isVisible;
    }

    // Static method to get global instance
    static getInstance() {
        if (!QuickActionsMenu.instance) {
            QuickActionsMenu.instance = new QuickActionsMenu();
        }
        return QuickActionsMenu.instance;
    }
}

// Initialize and export
let quickActionsMenuInstance = null;

function initQuickActionsMenu() {
    if (!quickActionsMenuInstance) {
        quickActionsMenuInstance = QuickActionsMenu.getInstance();
    }
    return quickActionsMenuInstance;
}

function openQuickActionsMenu(context = 'global', data = null, x = null, y = null) {
    const menu = initQuickActionsMenu();
    menu.show(context, data, x, y);
    return menu;
}

function closeQuickActionsMenu() {
    if (quickActionsMenuInstance) {
        quickActionsMenuInstance.hide();
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        QuickActionsMenu,
        initQuickActionsMenu,
        openQuickActionsMenu,
        closeQuickActionsMenu
    };
}