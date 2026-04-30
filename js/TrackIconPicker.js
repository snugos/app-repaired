// js/TrackIconPicker.js - Track Icon Picker for assigning emoji icons to tracks
let localAppServices = {};
let currentTrackId = null;

/**
 * Initialize the Track Icon Picker module
 * @param {object} services - App services
 */
export function initTrackIconPicker(services) {
    localAppServices = services;
    console.log('[TrackIconPicker] Initialized');
}

/**
 * Predefined track icons organized by category
 */
export const TRACK_ICONS = {
    instruments: {
        name: 'Instruments',
        icons: ['🎸', '🎹', '🎺', '🎻', '🪕', '🎷', '🎵', '🎶', '🎼', '🥁', '🪘', '🪇', '🪈', '🎙️', '🎚️', '🎛️']
    },
    vocals: {
        name: 'Vocals',
        icons: ['🎤', '🗣️', '👤', '👥', '🧑‍🎤', '👩‍🎤', '🧑‍💻', '👨‍🎤', '💫', '⭐', '🌟', '✨', '💥', '🔊', '🔉', '🔈']
    },
    nature: {
        name: 'Nature',
        icons: ['🌊', '🌲', '🌳', '🌸', '🌺', '🌻', '🌼', '🍃', '🍂', '🍁', '❄️', '☀️', '🌙', '⭐', '🔥', '💨']
    },
    tech: {
        name: 'Tech',
        icons: ['💻', '🖥️', '📱', '💾', '💿', '📀', '🎮', '🕹️', '🎯', '🎲', '♟️', '🎳', '🏆', '🥇', '🥈', '🥉']
    },
    mood: {
        name: 'Mood',
        icons: ['❤️', '💜', '💙', '💚', '🧡', '💛', '🖤', '🤍', '💖', '💗', '💘', '💝', '💞', '🌈', '⚡', '🔥']
    },
    general: {
        name: 'General',
        icons: ['📁', '📂', '🗂️', '📌', '📍', '🔖', '🏷️', '📝', '✏️', '📊', '📈', '📉', '🔍', '🔎', '💡', '🔔']
    }
};

/**
 * Default icons assigned by track type
 */
export const DEFAULT_TRACK_ICONS = {
    'Synth': '🎹',
    'DrumSampler': '🥁',
    'Sampler': '🎵',
    'InstrumentSampler': '🎸',
    'Audio': '🎤',
    'Lyrics': '🎶',
    'MIDI': '🎹'
};

/**
 * Get default icon for track type
 * @param {string} type - Track type
 * @returns {string} Default icon emoji
 */
export function getDefaultTrackIcon(type) {
    return DEFAULT_TRACK_ICONS[type] || '📁';
}

/**
 * Open the Track Icon Picker panel for a specific track
 * @param {number} trackId - Track ID to assign icon to
 */
export function openTrackIconPicker(trackId) {
    currentTrackId = trackId;
    const windowId = 'trackIcon';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTrackIconContent(trackId);
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackIconContent';
    contentContainer.className = 'p-4 h-full overflow-y-auto bg-gray-100 dark:bg-slate-800';

    const options = { 
        width: 400, 
        height: 500, 
        minWidth: 320, 
        minHeight: 400,
        initialContentKey: windowId,
        closable: true, 
        minimizable: true, 
        resizable: true
    };

    const win = localAppServices.createWindow(windowId, 'Track Icon', contentContainer, options);
    
    if (win?.element) {
        renderTrackIconContent(trackId);
    }
    
    return win;
}

/**
 * Render the track icon picker content
 * @param {number} trackId - Track ID
 */
function renderTrackIconContent(trackId) {
    const container = document.getElementById('trackIconContent');
    if (!container) return;
    
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        container.innerHTML = '<div class="p-4 text-red-500">Track not found</div>';
        return;
    }
    
    const currentIcon = track.icon || getDefaultTrackIcon(track.type);
    
    let html = `
        <div class="mb-4">
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">Select an icon for "${track.name}"</div>
            <div class="flex items-center gap-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
                <span class="text-3xl" id="currentTrackIcon">${currentIcon}</span>
                <div>
                    <div class="text-sm font-medium text-gray-800 dark:text-gray-200">Current Icon</div>
                    <div class="text-xs text-gray-500">Click any icon below to apply</div>
                </div>
            </div>
        </div>
        
        <div class="mb-4 flex gap-2">
            <button id="clearIconBtn" class="px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 rounded text-gray-700 dark:text-gray-200">
                Clear Icon
            </button>
            <button id="autoIconBtn" class="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 rounded text-white">
                Auto (by Type)
            </button>
        </div>
    `;
    
    // Render icon categories
    for (const [catKey, category] of Object.entries(TRACK_ICONS)) {
        html += `
            <div class="mb-4">
                <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">${category.name}</h3>
                <div class="grid grid-cols-8 gap-1">
        `;
        
        for (const icon of category.icons) {
            const isSelected = icon === currentIcon;
            html += `
                <button class="icon-btn w-9 h-9 flex items-center justify-center text-xl rounded hover:bg-gray-200 dark:hover:bg-slate-600 ${isSelected ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' : 'bg-white dark:bg-slate-700'}" 
                        data-icon="${icon}" title="${icon}">
                    ${icon}
                </button>
            `;
        }
        
        html += `</div></div>`;
    }
    
    // Quick select row with common icons
    html += `
        <div class="mt-4 pt-4 border-t border-gray-300 dark:border-slate-600">
            <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Quick Select</h3>
            <div class="flex flex-wrap gap-1">
    `;
    
    const quickIcons = ['📁', '🎵', '🎶', '🎤', '🎹', '🎸', '🥁', '🎺', '🎻', '🪕', '🎷', '🎚️', '💜', '🔊', '📊', '⚡'];
    for (const icon of quickIcons) {
        const isSelected = icon === currentIcon;
        html += `
            <button class="icon-btn w-8 h-8 flex items-center justify-center text-lg rounded hover:bg-gray-200 dark:hover:bg-slate-600 ${isSelected ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' : 'bg-white dark:bg-slate-700'}" 
                    data-icon="${icon}" title="${icon}">
                ${icon}
            </button>
        `;
    }
    
    html += `</div></div>`;
    
    container.innerHTML = html;
    
    // Attach event listeners
    container.querySelectorAll('.icon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const icon = btn.dataset.icon;
            setTrackIcon(trackId, icon);
            localAppServices.showNotification?.(`Icon set to ${icon}`, 1000);
            renderTrackIconContent(trackId);
        });
    });
    
    const clearBtn = container.querySelector('#clearIconBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            setTrackIcon(trackId, null);
            localAppServices.showNotification?.('Icon cleared', 1000);
            renderTrackIconContent(trackId);
        });
    }
    
    const autoBtn = container.querySelector('#autoIconBtn');
    if (autoBtn) {
        autoBtn.addEventListener('click', () => {
            const defaultIcon = getDefaultTrackIcon(track.type);
            setTrackIcon(trackId, defaultIcon);
            localAppServices.showNotification?.(`Icon set to ${defaultIcon}`, 1000);
            renderTrackIconContent(trackId);
        });
    }
}

/**
 * Set the icon for a track
 * @param {number} trackId - Track ID
 * @param {string|null} icon - Emoji icon or null to clear
 */
export function setTrackIcon(trackId, icon) {
    const track = localAppServices.getTrackById?.(trackId);
    if (!track) {
        console.error('[TrackIconPicker] Track not found:', trackId);
        return false;
    }
    
    track.icon = icon;
    console.log(`[TrackIconPicker] Set track ${trackId} icon to: ${icon || '(none)'}`);
    
    // Update any open inspector panels
    if (localAppServices.updateTrackUI) {
        localAppServices.updateTrackUI(trackId, 'trackIconChanged');
    }
    
    return true;
}

/**
 * Get the icon for a track
 * @param {number} trackId - Track ID
 * @returns {string|null} Icon emoji or null
 */
export function getTrackIcon(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    return track?.icon || null;
}

/**
 * Get icon display HTML for a track (for use in headers)
 * @param {number} trackId - Track ID
 * @returns {string} HTML string with icon
 */
export function getTrackIconDisplay(trackId) {
    const track = localAppServices.getTrackById?.(trackId);
    const icon = track?.icon;
    if (!icon) return '';
    return `<span class="track-icon text-base mr-1">${icon}</span>`;
}

console.log('[TrackIconPicker] Module loaded');