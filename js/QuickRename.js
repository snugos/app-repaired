// js/QuickRename.js - Quick Rename Feature
// Double-click track/clip name to instantly edit without properties panel

let localAppServices = {};

/**
 * Initialize Quick Rename module
 * @param {Object} appServices - Application services object
 */
export function initQuickRename(appServices) {
    localAppServices = appServices || {};
    setupTrackNameEditing();
    setupClipNameEditing();
    console.log('[QuickRename] Initialized');
}

/**
 * Setup inline editing for track names via double-click on track header name elements
 */
function setupTrackNameEditing() {
    // Use event delegation on document for track name spans in track headers
    document.addEventListener('dblclick', (e) => {
        // Check if double-clicked on a track name in a track header
        const target = e.target;
        
        // Match track name spans - these are typically in track header areas
        if (target.classList.contains('track-name') || 
            target.classList.contains('track-name-span') ||
            target.closest?.('.track-header-name')) {
            
            const trackHeader = target.closest?.('.track-header') || target.closest?.('.track-lane-header');
            if (trackHeader) {
                const trackId = trackHeader.dataset?.trackId || trackHeader.dataset?.id;
                if (trackId) {
                    startTrackNameEdit(trackId, target);
                }
            }
        }
        
        // Also check for data attributes directly
        if (target.dataset?.trackName && target.dataset?.trackId) {
            startTrackNameEdit(target.dataset.trackId, target);
        }
    });
}

/**
 * Setup inline editing for clip names via double-click
 */
function setupClipNameEditing() {
    document.addEventListener('dblclick', (e) => {
        const target = e.target;
        
        // Check if clicked on clip name
        if (target.classList.contains('clip-name') ||
            target.classList.contains('clip-title') ||
            target.closest?.('.clip-header-name')) {
            
            const clipElement = target.closest('[data-clip-id]');
            if (clipElement) {
                const clipId = clipElement.dataset.clipId;
                if (clipId) {
                    startClipNameEdit(clipId, target);
                }
            }
        }
    });
}

/**
 * Start inline editing for a track name
 * @param {string} trackId - Track ID
 * @param {HTMLElement} targetElement - The element that was double-clicked
 */
function startTrackNameEdit(trackId, targetElement) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;

    const currentName = track.name;
    const input = createInlineEditInput(currentName, (newName) => {
        if (newName && newName.trim() && newName !== currentName) {
            if (localAppServices.updateTrackName) {
                localAppServices.updateTrackName(trackId, newName.trim());
                localAppServices.showNotification?.(`Track renamed to "${newName.trim()}"`, 1500);
            }
        }
    });

    replaceElementWithInput(targetElement, input);
}

/**
 * Start inline editing for a clip name
 * @param {string} clipId - Clip ID
 * @param {HTMLElement} targetElement - The element that was double-clicked
 */
function startClipNameEdit(clipId, targetElement) {
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    // Find the clip
    let clip = null;
    let track = null;
    
    for (const t of tracks) {
        const found = (t.timelineClips || []).find(c => c.id === clipId);
        if (found) {
            clip = found;
            track = t;
            break;
        }
    }
    
    if (!clip) return;

    const currentName = clip.name || 'Unnamed Clip';
    const input = createInlineEditInput(currentName, (newName) => {
        if (newName && newName.trim() && newName !== currentName) {
            if (localAppServices.updateClipName) {
                localAppServices.updateClipName(clipId, newName.trim());
                localAppServices.showNotification?.(`Clip renamed to "${newName.trim()}"`, 1500);
            }
        }
    });

    replaceElementWithInput(targetElement, input);
}

/**
 * Create an inline edit input element
 * @param {string} initialValue - Initial value for the input
 * @param {Function} onComplete - Callback when editing is complete (newValue)
 */
function createInlineEditInput(initialValue, onComplete) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialValue;
    input.className = 'inline-edit-input px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-black dark:text-white outline-none';
    input.style.minWidth = '80px';

    input.addEventListener('blur', () => {
        onComplete(input.value);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            input.value = initialValue;
            input.blur();
        }
    });

    // Select all text on focus
    input.addEventListener('focus', () => {
        input.select();
    });

    return input;
}

/**
 * Replace an element with an input field
 * @param {HTMLElement} element - Element to replace
 * @param {HTMLInputElement} input - Input element to replace with
 */
function replaceElementWithInput(element, input) {
    const parent = element.parentNode;
    if (!parent) return;

    // Get current text to use as initial value
    const currentText = element.textContent || element.value || '';

    // Create the input
    const editInput = createInlineEditInput(currentText, (newValue) => {
        if (newValue && newValue.trim()) {
            // Update via callback
            editInput.dataset.pendingValue = newValue.trim();
        }
        // Restore original element
        restoreElement(editInput, originalElement);
    });

    // Store original element for restoration
    const originalElement = element.cloneNode(true);
    originalElement.style.display = '';

    // Replace
    element.style.display = 'none';
    parent.insertBefore(editInput, element.nextSibling);
    editInput.focus();
    editInput.select();

    // Handle blur (which triggers the callback)
    editInput.addEventListener('blur', () => {
        const newValue = editInput.value;
        if (newValue && newValue.trim() && newValue !== currentText) {
            // Call parent callback if available
            if (typeof onComplete === 'function') {
                onComplete(newValue.trim());
            }
        }
        restoreElement(editInput, originalElement);
    });

    // Handle key events
    editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            editInput.blur();
        } else if (e.key === 'Escape') {
            editInput.value = currentText;
            editInput.blur();
        }
    });
}

/**
 * Restore original element after editing
 */
function restoreElement(input, originalElement) {
    const parent = input.parentNode;
    if (!parent) return;

    // Get the value before removing input
    const finalValue = input.value;

    // Remove input
    parent.removeChild(input);

    // Show original element
    originalElement.style.display = '';

    // Update text if changed
    if (finalValue && finalValue.trim()) {
        originalElement.textContent = finalValue;
    }
}

/**
 * Open Quick Rename help/info panel
 */
export function openQuickRenamePanel() {
    const windowId = 'quickRenamePanel';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId)) {
        openWindows.get(windowId).restore();
        return openWindows.get(windowId);
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'quickRenameContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900 text-white';

    const win = localAppServices.createWindow(windowId, 'Quick Rename', contentContainer, {
        width: 320,
        height: 200,
        minWidth: 250,
        minHeight: 150,
        closable: true,
        minimizable: true,
        resizable: true
    });

    if (win?.element) {
        renderQuickRenameContent();
    }

    return win;
}

/**
 * Render quick rename info content
 */
function renderQuickRenameContent() {
    const container = document.getElementById('quickRenameContent');
    if (!container) return;

    container.innerHTML = `
        <div class="text-sm text-gray-300 space-y-2">
            <p><strong>Quick Rename</strong></p>
            <p>Double-click on a track name or clip name to instantly edit it.</p>
            <ul class="list-disc list-inside text-gray-400 text-xs space-y-1">
                <li>Press <kbd class="px-1 py-0.5 bg-gray-700 rounded text-xs">Enter</kbd> to confirm</li>
                <li>Press <kbd class="px-1 py-0.5 bg-gray-700 rounded text-xs">Escape</kbd> to cancel</li>
            </ul>
            <p class="text-gray-500 text-xs mt-2">No need to open properties panels for simple renames.</p>
        </div>
    `;
}