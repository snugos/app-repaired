// js/LyricsDisplay.js - Karaoke-style lyrics display synced to playback
import { showNotification, createWindow } from './utils.js';

let lyricsData = []; // Array of { time: seconds, text: string }
let currentLyricIndex = 0;
let isPlaying = false;
let panelWindow = null;

const SAMPLE_LYRICS = [
    { time: 0.0, text: "♫ Welcome to SnugOS ♫" },
    { time: 2.0, text: "The browser-based DAW" },
    { time: 4.0, text: "Create, mix, and produce" },
    { time: 6.0, text: "With powerful audio tools" },
    { time: 8.0, text: "Let's make some music!" },
    { time: 10.0, text: "♪ ♫ ♪ ♫ ♪" },
];

export function initLyricsDisplay() {
    console.log('[LyricsDisplay] Module initialized');
}

export function openLyricsPanel() {
    const windowId = 'lyricsDisplay';
    const existingWindows = window.windowsMap || new Map();
    
    if (existingWindows.has(windowId)) {
        const win = existingWindows.get(windowId);
        win.restore();
        return win;
    }
    
    const container = document.createElement('div');
    container.id = 'lyricsPanelContent';
    container.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900 select-none';
    
    const options = {
        width: 500,
        height: 300,
        minWidth: 350,
        minHeight: 200,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = createWindow(windowId, 'Lyrics Display', container, options);
    
    if (win?.element) {
        renderLyricsContent();
        startPlaybackSync();
    }
    
    panelWindow = win;
    return win;
}

function renderLyricsContent() {
    const container = document.getElementById('lyricsPanelContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-white">Karaoke Mode</h3>
            <div class="flex items-center gap-2">
                <button id="lyricsImportBtn" class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">
                    Import Lyrics
                </button>
                <button id="lyricsClearBtn" class="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">
                    Clear
                </button>
            </div>
        </div>
        
        <div id="lyricsDisplayArea" class="flex-1 bg-black rounded border border-gray-700 p-4 overflow-y-auto">
            <div id="lyricsCurrent" class="text-center text-2xl font-bold text-green-400 mb-2" style="min-height: 40px;">
                No lyrics loaded
            </div>
            <div id="lyricsNext" class="text-center text-lg text-gray-500" style="min-height: 30px;">
                &nbsp;
            </div>
        </div>
        
        <div class="flex items-center justify-between mt-2 text-xs text-gray-400">
            <div class="flex items-center gap-2">
                <label>Time:</label>
                <input type="number" id="lyricsAddTime" value="0" step="0.1" min="0" class="w-16 p-1 bg-gray-800 border border-gray-600 rounded text-white text-xs">
                <button id="lyricsAddBtn" class="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                    Add Line
                </button>
            </div>
            <div class="flex items-center gap-2">
                <button id="lyricsPrevBtn" class="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">◀ Prev</button>
                <button id="lyricsNextBtn" class="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500">Next ▶</button>
            </div>
        </div>
        
        <div class="mt-2">
            <input type="text" id="lyricsNewLine" placeholder="Enter lyric text and click Add Line" 
                class="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white text-sm">
        </div>
    `;
    
    // Event handlers
    document.getElementById('lyricsImportBtn')?.addEventListener('click', importLyricsFromFile);
    document.getElementById('lyricsClearBtn')?.addEventListener('click', clearLyrics);
    document.getElementById('lyricsAddBtn')?.addEventListener('click', addLyricLine);
    document.getElementById('lyricsPrevBtn')?.addEventListener('click', prevLyric);
    document.getElementById('lyricsNextBtn')?.addEventListener('click', nextLyric);
    
    document.getElementById('lyricsNewLine')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addLyricLine();
    });
}

function importLyricsFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.lrc';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            parseLyrics(text);
            showNotification(`Loaded lyrics from ${file.name}`, 1500);
        };
        reader.readAsText(file);
    };
    input.click();
}

function parseLyrics(text) {
    lyricsData = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        
        // Try LRC format: [00:12.34] lyric text
        const lrcMatch = line.match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
        if (lrcMatch) {
            const minutes = parseInt(lrcMatch[1]);
            const seconds = parseInt(lrcMatch[2]);
            const ms = parseInt(lrcMatch[3]);
            const time = minutes * 60 + seconds + ms / 100;
            const lyricText = lrcMatch[4].trim();
            if (lyricText) {
                lyricsData.push({ time, text: lyricText });
            }
            return;
        }
        
        // Plain text format: "00:12.34 - lyric text" or just timing
        const simpleMatch = line.match(/^(\d+\.?\d*)\s*[-–]?\s*(.+)/);
        if (simpleMatch) {
            const time = parseFloat(simpleMatch[1]);
            const lyricText = simpleMatch[2].trim();
            if (lyricText) {
                lyricsData.push({ time, text: lyricText });
            }
            return;
        }
        
        // Simple text line without timing - use last time + 3 seconds
        const lastTime = lyricsData.length > 0 ? lyricsData[lyricsData.length - 1].time + 3 : 0;
        lyricsData.push({ time: lastTime, text: line });
    });
    
    lyricsData.sort((a, b) => a.time - b.time);
    currentLyricIndex = 0;
    updateLyricsDisplay();
}

function clearLyrics() {
    lyricsData = [];
    currentLyricIndex = 0;
    updateLyricsDisplay();
    showNotification('Lyrics cleared', 1000);
}

function addLyricLine() {
    const timeInput = document.getElementById('lyricsAddTime');
    const textInput = document.getElementById('lyricsNewLine');
    
    const time = parseFloat(timeInput?.value) || 0;
    const text = textInput?.value?.trim();
    
    if (!text) {
        showNotification('Please enter lyric text', 1500);
        return;
    }
    
    lyricsData.push({ time, text });
    lyricsData.sort((a, b) => a.time - b.time);
    
    textInput.value = '';
    updateLyricsDisplay();
    showNotification(`Added: "${text}" at ${time.toFixed(1)}s`, 1500);
}

function prevLyric() {
    if (currentLyricIndex > 0) {
        currentLyricIndex--;
        updateLyricsDisplay();
    }
}

function nextLyric() {
    if (currentLyricIndex < lyricsData.length - 1) {
        currentLyricIndex++;
        updateLyricsDisplay();
    }
}

function updateLyricsDisplay() {
    const currentEl = document.getElementById('lyricsCurrent');
    const nextEl = document.getElementById('lyricsNext');
    
    if (!currentEl || !nextEl) return;
    
    if (lyricsData.length === 0) {
        currentEl.textContent = 'No lyrics loaded';
        currentEl.className = 'text-center text-2xl font-bold text-gray-500 mb-2';
        nextEl.textContent = '\u00A0';
        return;
    }
    
    const current = lyricsData[currentLyricIndex];
    const next = lyricsData[currentLyricIndex + 1];
    
    currentEl.textContent = current?.text || '';
    currentEl.className = 'text-center text-2xl font-bold text-green-400 mb-2 animate-pulse';
    nextEl.textContent = next?.text || '\u00A0';
}

function startPlaybackSync() {
    // Check playback position every 100ms
    setInterval(() => {
        if (typeof Tone !== 'undefined' && Tone.Transport) {
            const currentTime = Tone.Transport.seconds;
            
            // Find current lyric based on time
            while (currentLyricIndex < lyricsData.length - 1 && 
                   lyricsData[currentLyricIndex + 1].time <= currentTime) {
                currentLyricIndex++;
            }
            
            // Also check if we need to go back (seeking)
            while (currentLyricIndex > 0 && 
                   lyricsData[currentLyricIndex].time > currentTime) {
                currentLyricIndex--;
            }
            
            updateLyricsDisplay();
        }
    }, 100);
}

export function getLyricsData() {
    return [...lyricsData];
}

export function setLyricsData(data) {
    lyricsData = Array.isArray(data) ? data : [];
    currentLyricIndex = 0;
    updateLyricsDisplay();
}

export function loadSampleLyrics() {
    lyricsData = SAMPLE_LYRICS.map(l => ({ ...l }));
    currentLyricIndex = 0;
    updateLyricsDisplay();
    showNotification('Sample lyrics loaded', 1500);
}