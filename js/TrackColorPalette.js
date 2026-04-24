// js/TrackColorPalette.js - Track color palette with custom colors
export const TRACK_COLOR_PALETTES = {
    default: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E2', '#F8B500', '#00CED1'
    ],
    neon: [
        '#FF00FF', '#00FFFF', '#FF0080', '#00FF00',
        '#FFFF00', '#FF4500', '#DA70D6', '#00FA9A'
    ],
    pastel: [
        '#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA',
        '#FFDFBA', '#E0BBE4', '#957DAD', '#D291BC'
    ],
    dark: [
        '#2C3E50', '#34495E', '#1ABC9C', '#16A085',
        '#2980B9', '#8E44AD', '#F39C12', '#D35400'
    ]
};

export function getColorPalette(name = 'default') {
    return TRACK_COLOR_PALETTES[name] || TRACK_COLOR_PALETTES.default;
}

export function getAllPaletteNames() {
    return Object.keys(TRACK_COLOR_PALETTES);
}

export function getRandomColorFromPalette(paletteName = 'default') {
    const palette = getColorPalette(paletteName);
    return palette[Math.floor(Math.random() * palette.length)];
}

export function getNextColorInPalette(paletteName = 'default', currentColor) {
    const palette = getColorPalette(paletteName);
    const index = palette.indexOf(currentColor);
    if (index === -1) return palette[0];
    return palette[(index + 1) % palette.length];
}