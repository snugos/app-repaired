// js/ScoreEditor.js - Score Editor Window for SnugOS DAW
// Feature: Visual staff notation display showing notes as musical notation

const STAFF_LINES = 5;
const LINE_SPACING = 12;
const NOTE_WIDTH = 14;
const CLEF_WIDTH = 40;
const TIME_SIG_WIDTH = 30;
const TRACK_HEADER_WIDTH = 140;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TREBLE_CLEF_NOTES = ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'];
const BASS_CLEF_NOTES = ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4'];

let localAppServices = {};

export function initScoreEditor(services) {
    localAppServices = services;
    console.log('[ScoreEditor] Initialized');
}

/**
 * Get note position on staff (0 = middle line, negative = below, positive = above)
 */
function getNoteStaffPosition(notePitch) {
    const noteMap = {
        'C': 0, 'C#': 0, 'D': 1, 'D#': 1, 'E': 2, 'F': 3, 'F#': 3,
        'G': 4, 'G#': 4, 'A': 5, 'A#': 5, 'B': 6
    };
    const octave = parseInt(notePitch.slice(-1));
    const noteName = notePitch.slice(0, -1);
    const noteIdx = noteMap[noteName] || 0;
    return (octave - 4) * 7 + noteIdx;
}

/**
 * Render a single note on SVG
 */
function renderNote(x, y, duration, isRest = false, color = '#4ade80') {
    if (isRest) {
        return `<rect x="${x}" y="${y - 4}" width="8" height="8" fill="#888" rx="2" />`;
    }
    
    // Note head (ellipse)
    const headRy = duration >= 4 ? 5 : 4;
    const headRx = duration >= 4 ? 4 : 3;
    let noteSvg = `<ellipse cx="${x}" cy="${y}" rx="${headRx}" ry="${headRy}" fill="${color}" />`;
    
    // Stem for quarter notes and shorter
    if (duration < 4) {
        noteSvg += `<line x1="${x + headRx}" y1="${y}" x2="${x + headRx}" y2="${y - 28}" stroke="${color}" stroke-width="1.5" />`;
    }
    
    // Flag for eighth notes and shorter
    if (duration === 2 || duration === 1) {
        noteSvg += `<path d="M${x + headRx},${y - 28} q 6,8 8,0" fill="none" stroke="${color}" stroke-width="1.5" />`;
    }
    
    // Beam for sixteenth
    if (duration === 1) {
        noteSvg += `<line x1="${x + headRx}" y1="${y - 28}" x2="${x + headRx + 12}" y2="${y - 24}" stroke="${color}" stroke-width="2" />`;
    }
    
    // Ledger lines
    if (y < 42) {
        noteSvg += `<line x1="${x - 6}" y1="${y + 10}" x2="${x + 6}" y2="${y + 10}" stroke="#666" stroke-width="1" />`;
    }
    if (y < 30) {
        noteSvg += `<line x1="${x - 6}" y1="${y + 22}" x2="${x + 6}" y2="${y + 22}" stroke="#666" stroke-width="1" />`;
    }
    if (y > 66) {
        noteSvg += `<line x1="${x - 6}" y1="${y - 10}" x2="${x + 6}" y2="${y - 10}" stroke="#666" stroke-width="1" />`;
    }
    if (y > 78) {
        noteSvg += `<line x1="${x - 6}" y1="${y - 22}" x2="${x + 6}" y2="${y - 22}" stroke="#666" stroke-width="1" />`;
    }
    
    return noteSvg;
}

/**
 * Opens the Score Editor window for a track
 */
export function openScoreEditorWindow(trackId, forceRedraw = false, savedState = null) {
    const windowId = `scoreEditor-${trackId}`;
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !forceRedraw && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) {
        console.error(`[ScoreEditor] Track ${trackId} not found`);
        localAppServices.showNotification?.('Track not found', 2000);
        return;
    }
    
    if (track.type === 'Audio') {
        localAppServices.showNotification?.('Audio tracks do not have score', 2000);
        return;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = `scoreEditorContent-${trackId}`;
    contentContainer.className = 'flex flex-col h-full bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white';
    
    const options = {
        width: 900,
        height: 500,
        minWidth: 600,
        minHeight: 350,
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
    
    const win = localAppServices.createWindow(windowId, `Score - ${track.name}`, contentContainer, options);
    
    if (win?.element) {
        setTimeout(() => renderScoreContent(trackId), 50);
    }
    
    return win;
}

/**
 * Renders the score content for a track
 */
function renderScoreContent(trackId) {
    const container = document.getElementById(`scoreEditorContent-${trackId}`);
    if (!container) return;
    
    const track = localAppServices.getTrackById ? localAppServices.getTrackById(trackId) : null;
    if (!track) return;
    
    const sequence = track.getActiveSequence ? track.getActiveSequence() : null;
    const sequenceData = sequence?.data || [];
    const sequenceLength = sequence?.length || 64;
    const barCount = Math.ceil(sequenceLength / 16);
    
    // Control bar
    let html = `
        <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
            <div class="flex items-center gap-3">
                <span class="text-sm text-gray-600 dark:text-gray-300">Track: <span class="font-medium">${track.name}</span></span>
                <select id="clefSelect-${trackId}" class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm">
                    <option value="treble">Treble Clef</option>
                    <option value="bass">Bass Clef</option>
                    <option value="both">Grand Staff</option>
                </select>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <label class="flex items-center gap-1">
                    <span>Transpose:</span>
                    <input type="number" id="transposeVal-${trackId}" value="0" min="-12" max="12" 
                        class="w-14 px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700">
                    <span>st</span>
                </label>
                <button id="zoomInBtn-${trackId}" class="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">+</button>
                <button id="zoomOutBtn-${trackId}" class="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">-</button>
            </div>
        </div>
        <div id="scoreScroll-${trackId}" class="flex-1 overflow-auto p-4 bg-gray-200 dark:bg-gray-800">
            <div id="scoreContainer-${trackId}" class="bg-white dark:bg-gray-900 rounded shadow-lg" style="min-height: 300px;">
                <svg id="scoreSvg-${trackId}" width="100%" height="300" viewBox="0 0 ${TIME_SIG_WIDTH + CLEF_WIDTH + TRACK_HEADER_WIDTH + sequenceLength * 8 + 40} 300">
                    <defs>
                        <pattern id="staffPattern-${trackId}" patternUnits="userSpaceOnUse" width="20" height="60">
                            <line x1="0" y1="0" x2="0" y2="60" stroke="#e5e7eb" stroke-width="0.5" stroke-dasharray="2,4"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#staffPattern-${trackId})" />
                    ${renderStaffLines(trackId, 'treble', 60, 120)}
                    ${renderBarLines(trackId, sequenceLength, 60, 120)}
                </svg>
            </div>
        </div>
        <div class="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 text-xs text-gray-500">
            <span>Notes displayed as notation. ${sequenceData.length} notes in sequence.</span>
            <span>Bar: 1/${barCount}</span>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Render actual notes
    renderScoreNotes(trackId, track, sequenceData);
    
    // Setup controls
    setupScoreEditorControls(trackId, track);
}

function renderStaffLines(trackId, clef, yOffset, staffHeight) {
    let svg = '';
    const lineSpacing = staffHeight / (STAFF_LINES - 1);
    
    // Staff lines
    for (let i = 0; i < STAFF_LINES; i++) {
        const y = yOffset + i * lineSpacing;
        svg += `<line x1="0" y1="${y}" x2="2000" y2="${y}" stroke="#999" stroke-width="${i === 2 ? 1.5 : 1}" />`;
    }
    
    // Clef
    if (clef === 'treble') {
        svg += `<text x="5" y="${yOffset + lineSpacing * 3}" font-size="48" fill="#333" font-family="serif">𝄞</text>`;
    } else if (clef === 'bass') {
        svg += `<text x="5" y="${yOffset + lineSpacing * 2 + 8}" font-size="36" fill="#333" font-family="serif">𝄢</text>`;
    }
    
    // Time signature
    svg += `<text x="45" y="${yOffset + lineSpacing * 1 + 5}" font-size="18" fill="#333" font-family="serif" font-weight="bold">4</text>`;
    svg += `<text x="45" y="${yOffset + lineSpacing * 3 + 5}" font-size="18" fill="#333" font-family="serif" font-weight="bold">4</text>`;
    
    return svg;
}

function renderBarLines(trackId, sequenceLength, yOffset, staffHeight) {
    let svg = '';
    const lineSpacing = staffHeight / (STAFF_LINES - 1);
    const startX = TIME_SIG_WIDTH + CLEF_WIDTH + TRACK_HEADER_WIDTH;
    
    // Bar lines every 16 steps (1 bar)
    for (let i = 0; i <= sequenceLength; i += 16) {
        const x = startX + i * 8;
        svg += `<line x1="${x}" y1="${yOffset}" x2="${x}" y2="${yOffset + lineSpacing * 4}" stroke="#666" stroke-width="${i % 64 === 0 ? 1.5 : 0.75}" />`;
    }
    
    return svg;
}

function renderScoreNotes(trackId, track, sequenceData) {
    const svg = document.getElementById(`scoreSvg-${trackId}`);
    if (!svg) return;
    
    const transpose = 0;
    const startX = TIME_SIG_WIDTH + CLEF_WIDTH + TRACK_HEADER_WIDTH;
    const yOffset = 60;
    const lineSpacing = 60 / (STAFF_LINES - 1);
    const middleY = yOffset + lineSpacing * 2; // B4 on treble
    
    let noteSvg = '';
    const noteColors = ['#4ade80', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa'];
    
    sequenceData.forEach((step, idx) => {
        if (!step || step.pitch == null) return;
        
        const pitch = Tone.Frequency(step.pitch, 'midi').toNote();
        const pos = getNoteStaffPosition(pitch);
        const y = middleY - pos * (lineSpacing / 2);
        const x = startX + idx * 8;
        const duration = step.duration || 2;
        const color = noteColors[idx % noteColors.length];
        
        noteSvg += renderNote(x, y, duration, false, color);
    });
    
    // Append notes to SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${noteSvg}</svg>`, 'image/svg+xml');
    const notesGroup = svgDoc.documentElement;
    
    while (notesGroup.firstChild) {
        svg.appendChild(notesGroup.firstChild);
    }
}

function setupScoreEditorControls(trackId, track) {
    const container = document.getElementById(`scoreEditorContent-${trackId}`);
    if (!container) return;
    
    // Zoom controls
    container.querySelector(`#zoomInBtn-${trackId}`)?.addEventListener('click', () => {
        const svg = document.getElementById(`scoreSvg-${trackId}`);
        if (svg) {
            const currentWidth = parseInt(svg.getAttribute('width')) || 1000;
            svg.setAttribute('width', currentWidth * 1.2);
        }
    });
    
    container.querySelector(`#zoomOutBtn-${trackId}`)?.addEventListener('click', () => {
        const svg = document.getElementById(`scoreSvg-${trackId}`);
        if (svg) {
            const currentWidth = parseInt(svg.getAttribute('width')) || 1000;
            svg.setAttribute('width', currentWidth / 1.2);
        }
    });
    
    // Transpose control
    container.querySelector(`#transposeVal-${trackId}`)?.addEventListener('change', (e) => {
        const transpose = parseInt(e.target.value) || 0;
        // Re-render with transpose
        renderScoreContent(trackId);
        localAppServices.showNotification?.(`Transpose: ${transpose} semitones`, 1500);
    });
    
    // Clef selection
    container.querySelector(`#clefSelect-${trackId}`)?.addEventListener('change', () => {
        renderScoreContent(trackId);
    });
}

/**
 * Updates the score editor if open (call after sequence changes)
 */
export function updateScoreEditor(trackId) {
    const container = document.getElementById(`scoreEditorContent-${trackId}`);
    if (container) {
        renderScoreContent(trackId);
    }
}