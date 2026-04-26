// js/SpectrogramVisualizer.js - Real-time spectrogram visualization for tracks
import * as Constants from './constants.js';

let localAppServices = {};
let spectrogramWindow = null;
let animationId = null;
let currentSourceTrackId = null;

const TRACK_SPECTROGRAM_COLORS = [
    '#00ff88', // Neon green
    '#ff00ff', // Magenta
    '#00ffff', // Cyan
    '#ffff00', // Yellow
    '#ff8800', // Orange
    '#8800ff', // Purple
    '#ff0088', // Pink
    '#00ff00', // Lime
];

export function initSpectrogramVisualizer(appServices) {
    localAppServices = appServices || {};
    console.log('[Spectrogram] Initialized');
}

export function openSpectrogramVisualizerPanel(savedState = null) {
    const windowId = 'spectrogramVisualizer';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        updateSpectrogramPanel();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'spectrogramContent';
    contentContainer.className = 'p-3 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const options = { 
        width: 600, 
        height: 400, 
        minWidth: 400, 
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

    spectrogramWindow = localAppServices.createWindow(windowId, 'Spectrogram', contentContainer, options);
    if (spectrogramWindow?.element) {
        setTimeout(() => renderSpectrogramContent(), 50);
    }
    return spectrogramWindow;
}

function renderSpectrogramContent() {
    const container = document.getElementById('spectrogramContent');
    if (!container) return;

    const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
    const audioTracks = tracks.filter(t => t.type === 'Audio' || t.type === 'Sampler' || t.type === 'DrumSampler');
    
    let trackOptionsHtml = audioTracks.map(t => 
        `<option value="${t.id}">${t.name}</option>`
    ).join('');
    
    if (!trackOptionsHtml) {
        trackOptionsHtml = '<option value="">No audio tracks</option>';
    }

    container.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
                <select id="spectrogramTrackSelect" class="p-2 text-sm bg-gray-800 border border-gray-600 rounded text-white">
                    <option value="master">Master Output</option>
                    ${trackOptionsHtml}
                </select>
                <label class="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input type="checkbox" id="spectrogramLogFreq" checked class="w-4 h-4 accent-blue-500">
                    Log Frequency
                </label>
            </div>
            <div class="flex items-center gap-2">
                <label class="text-xs text-gray-400">Color:</label>
                <select id="spectrogramColorSelect" class="p-1 text-xs bg-gray-800 border border-gray-600 rounded text-white">
                    <option value="neon">Neon</option>
                    <option value="thermal">Thermal</option>
                    <option value="mono">Monochrome</option>
                </select>
            </div>
        </div>
        <div id="spectrogramCanvasContainer" class="flex-1 bg-black rounded border border-gray-700 relative overflow-hidden">
            <canvas id="spectrogramCanvas" class="w-full h-full"></canvas>
        </div>
        <div class="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>20Hz</span>
            <span>200Hz</span>
            <span>2kHz</span>
            <span>20kHz</span>
        </div>
        <div class="flex items-center justify-between mt-1 text-xs text-gray-600">
            <span>Low</span>
            <span id="spectrogramDbRange">0 - -60 dB</span>
            <span>High</span>
        </div>
    `;

    setupSpectrogramVisualization();

    // Track select change handler
    const trackSelect = container.querySelector('#spectrogramTrackSelect');
    if (trackSelect) {
        trackSelect.addEventListener('change', (e) => {
            currentSourceTrackId = e.target.value === 'master' ? null : parseInt(e.target.value, 10);
            console.log('[Spectrogram] Source changed:', currentSourceTrackId === null ? 'master' : `track ${currentSourceTrackId}`);
        });
    }

    // Log frequency toggle
    const logFreqCheck = container.querySelector('#spectrogramLogFreq');
    if (logFreqCheck) {
        logFreqCheck.addEventListener('change', () => {
            console.log('[Spectrogram] Log frequency:', logFreqCheck.checked);
        });
    }

    // Color scheme change
    const colorSelect = container.querySelector('#spectrogramColorSelect');
    if (colorSelect) {
        colorSelect.addEventListener('change', () => {
            console.log('[Spectrogram] Color scheme:', colorSelect.value);
        });
    }
}

function setupSpectrogramVisualization() {
    const canvas = document.getElementById('spectrogramCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = document.getElementById('spectrogramCanvasContainer');
    if (!container) return;

    // Set canvas size
    function resizeCanvas() {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    resizeCanvas();

    let spectrogramData = []; // Ring buffer of frequency columns
    const HISTORY_LENGTH = 200; // Number of columns to keep
    let colorScheme = 'neon';

    function getColorForValue(normalizedValue, scheme = 'neon') {
        normalizedValue = Math.max(0, Math.min(1, normalizedValue));
        
        if (scheme === 'thermal') {
            // Thermal: black -> red -> yellow -> white
            if (normalizedValue < 0.33) {
                const t = normalizedValue * 3;
                return `rgb(${Math.round(t * 255)}, 0, 0)`;
            } else if (normalizedValue < 0.66) {
                const t = (normalizedValue - 0.33) * 3;
                return `rgb(255, ${Math.round(t * 255)}, 0)`;
            } else {
                const t = (normalizedValue - 0.66) * 3;
                return `rgb(255, 255, ${Math.round(t * 255)})`;
            }
        } else if (scheme === 'mono') {
            const v = Math.round(normalizedValue * 255);
            return `rgb(${v}, ${v}, ${v})`;
        } else {
            // Neon: dark -> cyan -> blue -> purple -> magenta
            if (normalizedValue < 0.25) {
                const t = normalizedValue * 4;
                return `rgb(0, ${Math.round(t * 255)}, ${Math.round(t * 255)})`;
            } else if (normalizedValue < 0.5) {
                const t = (normalizedValue - 0.25) * 4;
                return `rgb(0, ${Math.round((1-t) * 255)}, 255)`;
            } else if (normalizedValue < 0.75) {
                const t = (normalizedValue - 0.5) * 4;
                return `rgb(${Math.round(t * 128)}, 0, ${Math.round((1-t*0.5) * 255)})`;
            } else {
                const t = (normalizedValue - 0.75) * 4;
                return `rgb(${Math.round(128 + t * 127)}, 0, 255)`;
            }
        }
    }

    function draw() {
        // Get frequency data
        let frequencyData = null;
        
        if (currentSourceTrackId !== null) {
            // Get track-specific frequency data
            if (localAppServices.getTrackFrequencyData) {
                frequencyData = localAppServices.getTrackFrequencyData(currentSourceTrackId);
            }
        } else {
            // Master output
            if (localAppServices.getMasterFrequencyData) {
                frequencyData = localAppServices.getMasterFrequencyData();
            }
        }

        // Add new column to history
        if (frequencyData && frequencyData.length > 0) {
            spectrogramData.push(Array.from(frequencyData));
        } else {
            // Generate placeholder data if no real data
            spectrogramData.push(new Array(128).fill(0).map(() => Math.random() * 0.1));
        }

        // Trim history
        while (spectrogramData.length > HISTORY_LENGTH) {
            spectrogramData.shift();
        }

        // Clear canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (spectrogramData.length < 2) {
            animationId = requestAnimationFrame(draw);
            return;
        }

        const logFreq = document.getElementById('spectrogramLogFreq')?.checked ?? true;
        colorScheme = document.getElementById('spectrogramColorSelect')?.value ?? 'neon';

        const colWidth = canvas.width / HISTORY_LENGTH;
        const rowCount = Math.min(128, spectrogramData[0]?.length || 128);

        for (let col = 0; col < spectrogramData.length; col++) {
            const x = Math.round(col * colWidth);
            
            for (let row = 0; row < rowCount; row++) {
                let value = spectrogramData[col][row] || 0;
                
                // Convert linear amplitude to dB
                const dbValue = value > 0 ? (20 * Math.log10(value)) : -100;
                const normalizedValue = Math.max(0, Math.min(1, (dbValue + 90) / 90)); // -90dB to 0dB range
                
                // Calculate y position
                let y;
                if (logFreq) {
                    // Logarithmic frequency scaling
                    const minFreq = Math.log10(20);
                    const maxFreq = Math.log10(20000);
                    const freqRatio = row / rowCount;
                    const logFreqValue = minFreq + freqRatio * (maxFreq - minFreq);
                    const freqPos = Math.pow(10, logFreqValue);
                    const normalizedFreq = (logFreqValue - minFreq) / (maxFreq - minFreq);
                    y = canvas.height - Math.round(normalizedFreq * canvas.height);
                } else {
                    y = Math.round((1 - row / rowCount) * canvas.height);
                }
                
                const color = getColorForValue(normalizedValue, colorScheme);
                ctx.fillStyle = color;
                ctx.fillRect(x, y, Math.ceil(colWidth) + 1, 2);
            }
        }

        // Draw time markers
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px monospace';
        const seconds = spectrogramData.length / 20; // Approximate
        ctx.fillText(`~${seconds.toFixed(1)}s`, canvas.width - 50, 15);

        animationId = requestAnimationFrame(draw);
    }

    // Start animation
    draw();

    // Handle resize
    window.addEventListener('resize', resizeCanvas);
}

export function updateSpectrogramPanel() {
    const container = document.getElementById('spectrogramContent');
    if (container) {
        // Refresh track list
        const trackSelect = container.querySelector('#spectrogramTrackSelect');
        if (trackSelect) {
            const tracks = localAppServices.getTracksState ? localAppServices.getTracksState() : [];
            const audioTracks = tracks.filter(t => t.type === 'Audio' || t.type === 'Sampler' || t.type === 'DrumSampler');
            const currentValue = trackSelect.value;
            
            trackSelect.innerHTML = '<option value="master">Master Output</option>' +
                audioTracks.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
            
            // Restore selection if still valid
            if (currentValue && (currentValue === 'master' || audioTracks.some(t => t.id === parseInt(currentValue, 10)))) {
                trackSelect.value = currentValue;
            }
        }
    }
}

export function getSpectrogramWindow() {
    return spectrogramWindow;
}

// Cleanup function
export function closeSpectrogramVisualizer() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    spectrogramData = [];
}
