// js/BookmarkSystem.js - Bookmark System for Timeline Navigation
// Add named bookmarks on timeline for quick navigation

let bookmarks = []; // { id, name, time, color, createdAt }
let nextBookmarkId = 1;
const BOOKMARK_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

/**
 * Get all bookmarks
 * @returns {Array} Array of bookmark objects
 */
export function getBookmarks() {
    return JSON.parse(JSON.stringify(bookmarks));
}

/**
 * Get a bookmark by ID
 * @param {number} id - Bookmark ID
 * @returns {Object|null}
 */
export function getBookmarkById(id) {
    const bookmark = bookmarks.find(b => b.id === id);
    return bookmark ? JSON.parse(JSON.stringify(bookmark)) : null;
}

/**
 * Add a new bookmark at the current playhead position
 * @param {string} name - Bookmark name
 * @param {number} time - Time position in seconds (optional, uses current playhead)
 * @param {string} color - Bookmark color (optional, auto-assigned)
 * @returns {Object} The created bookmark
 */
export function addBookmark(name, time = null, color = null) {
    const bookmark = {
        id: nextBookmarkId++,
        name: name || `Bookmark ${nextBookmarkId - 1}`,
        time: time !== null ? time : (typeof Tone !== 'undefined' ? Tone.Transport.seconds : 0),
        color: color || BOOKMARK_COLORS[(nextBookmarkId - 2) % BOOKMARK_COLORS.length],
        createdAt: new Date().toISOString()
    };
    bookmarks.push(bookmark);
    console.log(`[BookmarkSystem] Added bookmark: ${bookmark.name} at ${bookmark.time.toFixed(2)}s`);
    saveBookmarksToStorage();
    return JSON.parse(JSON.stringify(bookmark));
}

/**
 * Update a bookmark
 * @param {number} id - Bookmark ID
 * @param {Object} updates - Properties to update
 * @returns {Object|null}
 */
export function updateBookmark(id, updates) {
    const index = bookmarks.findIndex(b => b.id === id);
    if (index === -1) return null;
    
    if (updates.name !== undefined) bookmarks[index].name = updates.name;
    if (updates.time !== undefined) bookmarks[index].time = updates.time;
    if (updates.color !== undefined) bookmarks[index].color = updates.color;
    
    saveBookmarksToStorage();
    return JSON.parse(JSON.stringify(bookmarks[index]));
}

/**
 * Remove a bookmark
 * @param {number} id - Bookmark ID
 * @returns {boolean} Success
 */
export function removeBookmark(id) {
    const index = bookmarks.findIndex(b => b.id === id);
    if (index === -1) return false;
    
    const removed = bookmarks.splice(index, 1)[0];
    console.log(`[BookmarkSystem] Removed bookmark: ${removed.name}`);
    saveBookmarksToStorage();
    return true;
}

/**
 * Clear all bookmarks
 */
export function clearAllBookmarks() {
    bookmarks = [];
    saveBookmarksToStorage();
    console.log('[BookmarkSystem] Cleared all bookmarks');
}

/**
 * Jump to a bookmark (move playhead)
 * @param {number} id - Bookmark ID
 */
export function jumpToBookmark(id) {
    const bookmark = getBookmarkById(id);
    if (!bookmark) return false;
    
    if (typeof Tone !== 'undefined' && Tone.Transport) {
        Tone.Transport.seconds = bookmark.time;
        if (typeof updatePlayheadPosition === 'function') {
            updatePlayheadPosition(bookmark.time);
        }
    }
    return true;
}

/**
 * Save bookmarks to localStorage
 */
function saveBookmarksToStorage() {
    try {
        localStorage.setItem('snaw_bookmarks', JSON.stringify({
            bookmarks,
            nextId: nextBookmarkId
        }));
    } catch (e) {
        console.warn('[BookmarkSystem] Could not save to localStorage:', e);
    }
}

/**
 * Load bookmarks from localStorage
 */
export function loadBookmarksFromStorage() {
    try {
        const data = localStorage.getItem('snaw_bookmarks');
        if (data) {
            const parsed = JSON.parse(data);
            bookmarks = parsed.bookmarks || [];
            nextBookmarkId = parsed.nextId || 1;
        }
    } catch (e) {
        console.warn('[BookmarkSystem] Could not load from localStorage:', e);
    }
}

/**
 * Get bookmark colors
 * @returns {Array}
 */
export function getBookmarkColors() {
    return [...BOOKMARK_COLORS];
}

// Initialize on load
loadBookmarksFromStorage();

// --- UI Panel ---

/**
 * Open the Bookmark System panel
 * @param {Object} savedState - Window state to restore
 */
export function openBookmarkPanel(savedState = null) {
    const windowId = 'bookmarkPanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'bookmarkPanelContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const options = { 
        width: 350, 
        height: 400, 
        minWidth: 280, 
        minHeight: 300, 
        initialContentKey: windowId, 
        closable: true, 
        minimizable: true, 
        resizable: true 
    };
    
    if (savedState) {
        Object.assign(options, { 
            x: parseInt(savedState.left, 10), 
            y: parseInt(savedState.top, 10), 
            width: parseInt(savedState.width, 10), 
            height: parseInt(savedState.height, 10), 
            zIndex: savedState.zIndex, 
            isMinimized: savedState.isMinimized 
        });
    }

    const win = localAppServices.createWindow(windowId, 'Bookmarks', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderBookmarkPanelContent(), 50);
    }
    return win;
}

/**
 * Render the bookmark panel content
 */
function renderBookmarkPanelContent() {
    const container = document.getElementById('bookmarkPanelContent');
    if (!container) return;

    const currentTime = typeof Tone !== 'undefined' ? Tone.Transport.seconds : 0;
    
    container.innerHTML = `
        <div class="flex items-center gap-2 mb-3">
            <input type="text" id="bookmarkName" placeholder="Bookmark name" 
                class="flex-1 px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded text-white">
            <button id="addBookmarkBtn" class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                Add
            </button>
        </div>
        <div class="text-xs text-gray-500 mb-3">
            Current: ${currentTime.toFixed(2)}s
        </div>
        <div id="bookmarkList" class="flex-1 overflow-y-auto space-y-2">
            ${renderBookmarkList()}
        </div>
        <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-700">
            <span class="text-xs text-gray-500">${bookmarks.length} bookmark(s)</span>
            <button id="clearBookmarksBtn" class="text-xs text-red-400 hover:text-red-300">
                Clear All
            </button>
        </div>
    `;

    // Event listeners
    document.getElementById('addBookmarkBtn')?.addEventListener('click', () => {
        const nameInput = document.getElementById('bookmarkName');
        const name = nameInput?.value?.trim() || `Bookmark ${bookmarks.length + 1}`;
        addBookmark(name);
        nameInput.value = '';
        refreshBookmarkList();
    });

    document.getElementById('bookmarkName')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addBookmarkBtn')?.click();
        }
    });

    document.getElementById('clearBookmarksBtn')?.addEventListener('click', () => {
        if (bookmarks.length > 0) {
            clearAllBookmarks();
            refreshBookmarkList();
        }
    });
}

/**
 * Render the bookmark list HTML
 * @returns {string}
 */
function renderBookmarkList() {
    if (bookmarks.length === 0) {
        return `
            <div class="text-center py-8 text-gray-500">
                <div class="text-2xl mb-2">🔖</div>
                <div>No bookmarks yet</div>
                <div class="text-xs mt-1">Add bookmarks to mark important positions</div>
            </div>
        `;
    }

    // Sort by time
    const sorted = [...bookmarks].sort((a, b) => a.time - b.time);
    
    return sorted.map(b => `
        <div class="flex items-center gap-2 p-2 bg-gray-800 rounded hover:bg-gray-750 cursor-pointer bookmark-item" 
             data-id="${b.id}">
            <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${b.color}"></div>
            <div class="flex-1 min-w-0">
                <div class="text-sm text-white truncate">${escapeHtml(b.name)}</div>
                <div class="text-xs text-gray-500">${b.time.toFixed(2)}s</div>
            </div>
            <div class="flex items-center gap-1">
                <button class="jump-to-bookmark px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600" data-id="${b.id}">
                    ▶
                </button>
                <button class="delete-bookmark px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-id="${b.id}">
                    ✕
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Refresh the bookmark list without re-rendering the whole panel
 */
function refreshBookmarkList() {
    const listContainer = document.getElementById('bookmarkList');
    if (listContainer) {
        listContainer.innerHTML = renderBookmarkList();
        attachBookmarkListEvents();
    }
}

/**
 * Attach event listeners to bookmark list items
 */
function attachBookmarkListEvents() {
    document.querySelectorAll('.jump-to-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id, 10);
            jumpToBookmark(id);
        });
    });

    document.querySelectorAll('.delete-bookmark').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id, 10);
            removeBookmark(id);
            refreshBookmarkList();
        });
    });

    document.querySelectorAll('.bookmark-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.id, 10);
            jumpToBookmark(id);
        });
    });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Initial render
setTimeout(() => {
    const container = document.getElementById('bookmarkPanelContent');
    if (container) {
        attachBookmarkListEvents();
    }
}, 100);
