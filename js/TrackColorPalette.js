// js/TrackColorPalette.js - Track Color Palette Panel for visual grouping
import { getTracksState, getTrackByIdState } from './state.js';
import { TRACK_COLORS, TRACK_COLOR_PALETTES, getRandomTrackColor } from './Track.js';

let colorPalettePanel = null;
let selectedTrackIdForColor = null;

export function openTrackColorPalettePanel(savedState = null) {
    if (colorPalettePanel && !colorPalettePanel.classList.contains('hidden')) {
        closeTrackColorPalettePanel();
        return;
    }

    closeAllWindows();

    const tracks = getTracksState();
    const tracksWithColors = tracks.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color || '#3b82f6'
    }));

    const colorOptions = TRACK_COLORS.map(c => 
        `<div class="color-swatch" data-color="${c}" style="background-color: ${c};" title="${c}"></div>`
    ).join('');

    const trackOptions = tracksWithColors.map(t => 
        `<option value="${t.id}" data-color="${t.color}">${t.name}</option>`
    ).join('');

    colorPalettePanel = document.createElement('div');
    colorPalettePanel.id = 'track-color-palette-window';
    colorPalettePanel.className = 'fixed bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg shadow-2xl z-[10000]';
    colorPalettePanel.style.cssText = `
        width: 320px;
        max-height: 480px;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        font-family: 'Inter', sans-serif;
    `;
    colorPalettePanel.innerHTML = `
        <div class="flex items-center justify-between p-3 border-b border-[#3a3a3a] bg-[#252525] rounded-t-lg">
            <h3 class="text-sm font-semibold text-[#e0e0e0] m-0">Track Color Palette</h3>
            <button id="close-color-palette-btn" class="w-6 h-6 flex items-center justify-center bg-[#2c2c2c] border border-[#3c3c3c] rounded text-[#a0a0a0] hover:text-[#e0e0e0] hover:bg-[#333] text-lg leading-none">&times;</button>
        </div>
        <div class="p-3 flex-1 overflow-y-auto">
            <div class="mb-3">
                <label class="block text-xs text-[#a0a0a0] mb-1">Select Track:</label>
                <select id="track-color-select" class="w-full p-2 bg-[#282828] border border-[#4a4a4a] rounded text-[#e0e0e0] text-sm">
                    <option value="">-- Choose a track --</option>
                    ${trackOptions}
                </select>
            </div>
            <div class="mb-3">
                <label class="block text-xs text-[#a0a0a0] mb-2">Track Color:</label>
                <div id="color-swatches-grid" class="grid grid-cols-6 gap-2 p-2 bg-[#202020] rounded border border-[#3a3a3a]">
                    ${colorOptions}
                </div>
            </div>
            <div class="mb-3">
                <label class="block text-xs text-[#a0a0a0] mb-2">Palettes:</label>
                <div class="flex flex-wrap gap-2">
                    <button class="palette-btn px-3 py-1 text-xs bg-[#2c2c2c] border border-[#4a4a4a] rounded text-[#e0e0e0] hover:bg-[#333]" data-palette="vibrant">Vibrant</button>
                    <button class="palette-btn px-3 py-1 text-xs bg-[#2c2c2c] border border-[#4a4a4a] rounded text-[#e0e0e0] hover:bg-[#333]" data-palette="pastel">Pastel</button>
                    <button class="palette-btn px-3 py-1 text-xs bg-[#2c2c2c] border border-[#4a4a4a] rounded text-[#e0e0e0] hover:bg-[#333]" data-palette="dark">Dark</button>
                    <button class="palette-btn px-3 py-1 text-xs bg-[#2c2c2c] border border-[#4a4a4a] rounded text-[#e0e0e0] hover:bg-[#333]" data-palette="neon">Neon</button>
                    <button class="palette-btn px-3 py-1 text-xs bg-[#2c2c2c] border border-[#4a4a4a] rounded text-[#e0e0e0] hover:bg-[#333]" data-palette="earth">Earth</button>
                </div>
            </div>
            <div class="p-2 bg-[#202020] rounded border border-[#3a3a3a]">
                <div class="flex items-center justify-between mb-2">
                    <label class="text-xs text-[#a0a0a0]">Current:</label>
                    <div id="current-color-preview" class="w-6 h-6 rounded border border-[#555]" style="background-color: #3b82f6;"></div>
                </div>
                <div class="flex gap-2">
                    <input type="text" id="color-hex-input" value="#3b82f6" class="flex-1 p-1 bg-[#282828] border border-[#4a4a4a] rounded text-[#e0e0e0] text-xs text-center uppercase" maxlength="7" placeholder="#3b82f6">
                    <input type="color" id="color-picker-input" value="#3b82f6" class="w-8 h-8 p-0 border-0 cursor-pointer bg-transparent">
                </div>
            </div>
        </div>
        <div class="p-3 border-t border-[#3a3a3a] flex justify-end gap-2 bg-[#252525] rounded-b-lg">
            <button id="apply-color-btn" class="px-4 py-2 text-sm font-semibold bg-[#10b981] hover:bg-[#0d9669] text-white rounded border border-[#0d9669] disabled:opacity-50 disabled:cursor-not-allowed" disabled>Apply Color</button>
            <button id="randomize-colors-btn" class="px-4 py-2 text-sm font-semibold bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded border border-[#4f46e5]">Randomize All</button>
        </div>
    `;

    document.body.appendChild(colorPalettePanel);

    // Event handlers
    const closeBtn = colorPalettePanel.querySelector('#close-color-palette-btn');
    closeBtn.addEventListener('click', closeTrackColorPalettePanel);

    const trackSelect = colorPalettePanel.querySelector('#track-color-select');
    trackSelect.addEventListener('change', (e) => {
        const trackId = parseInt(e.target.value);
        if (trackId) {
            const track = getTrackByIdState(trackId);
            if (track) {
                selectedTrackIdForColor = trackId;
                const color = track.color || '#3b82f6';
                updateColorPreview(color);
                colorPalettePanel.querySelector('#apply-color-btn').disabled = false;
            }
        } else {
            selectedTrackIdForColor = null;
            colorPalettePanel.querySelector('#apply-color-btn').disabled = true;
        }
    });

    const colorSwatches = colorPalettePanel.querySelectorAll('.color-swatch');
    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            const color = swatch.dataset.color;
            updateColorPreview(color);
        });
    });

    const paletteBtns = colorPalettePanel.querySelectorAll('.palette-btn');
    paletteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const paletteName = btn.dataset.palette;
            const palette = TRACK_COLOR_PALETTES[paletteName] || TRACK_COLORS;
            const swatchesContainer = colorPalettePanel.querySelector('#color-swatches-grid');
            swatchesContainer.innerHTML = palette.map(c => 
                `<div class="color-swatch" data-color="${c}" style="background-color: ${c};" title="${c}"></div>`
            ).join('');
            
            // Re-attach click handlers
            swatchesContainer.querySelectorAll('.color-swatch').forEach(swatch => {
                swatch.addEventListener('click', () => {
                    const color = swatch.dataset.color;
                    updateColorPreview(color);
                });
            });
        });
    });

    const hexInput = colorPalettePanel.querySelector('#color-hex-input');
    const colorPicker = colorPalettePanel.querySelector('#color-picker-input');
    
    hexInput.addEventListener('input', (e) => {
        let val = e.target.value;
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            updateColorPreview(val);
        }
    });

    colorPicker.addEventListener('input', (e) => {
        updateColorPreview(e.target.value);
    });

    const applyBtn = colorPalettePanel.querySelector('#apply-color-btn');
    applyBtn.addEventListener('click', () => {
        if (selectedTrackIdForColor) {
            const track = getTrackByIdState(selectedTrackIdForColor);
            if (track) {
                const color = hexInput.value;
                track.setColor(color, true);
                updateTrackSelectColor(selectedTrackIdForColor, color);
            }
        }
    });

    const randomizeBtn = colorPalettePanel.querySelector('#randomize-colors-btn');
    randomizeBtn.addEventListener('click', () => {
        const tracks = getTracksState();
        tracks.forEach((track, index) => {
            const color = getRandomTrackColor('vibrant');
            track.setColor(color, index === 0);
        });
        refreshTrackSelect();
    });

    function updateColorPreview(color) {
        hexInput.value = color.toUpperCase();
        colorPicker.value = color;
        colorPalettePanel.querySelector('#current-color-preview').style.backgroundColor = color;
    }

    function updateTrackSelectColor(trackId, color) {
        const option = trackSelect.querySelector(`option[value="${trackId}"]`);
        if (option) {
            option.dataset.color = color;
        }
    }

    function refreshTrackSelect() {
        const tracks = getTracksState();
        trackSelect.innerHTML = '<option value="">-- Choose a track --</option>' + 
            tracks.map(t => `<option value="${t.id}" data-color="${t.color}">${t.name}</option>`).join('');
    }

    // Click outside to close
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

function handleOutsideClick(e) {
    if (colorPalettePanel && !colorPalettePanel.contains(e.target) && 
        !e.target.id?.includes('menuTrackColorPalette')) {
        closeTrackColorPalettePanel();
    }
}

export function closeTrackColorPalettePanel() {
    if (colorPalettePanel) {
        colorPalettePanel.remove();
        colorPalettePanel = null;
        selectedTrackIdForColor = null;
        document.removeEventListener('click', handleOutsideClick);
    }
}

function closeAllWindows() {
    document.querySelectorAll('.snug-window, #track-color-palette-window, .context-menu').forEach(w => {
        if (w.id !== 'track-color-palette-window') {
            w.remove();
        }
    });
}