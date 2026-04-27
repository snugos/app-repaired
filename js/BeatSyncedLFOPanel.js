// js/BeatSyncedLFOPanel.js - Beat-synced LFO Panel UI
import { BeatSyncedLFO } from './BeatSyncedLFO.js';

let localAppServices = {};
let lfoInstance = null;
let lfoGainNode = null;
let lfoDestination = null;

export function initBeatSyncedLFOPanel(services) {
    localAppServices = services || {};
    console.log('[BeatSyncedLFOPanel] Initialized');
}

function getAudioContext() {
    if (typeof Tone !== 'undefined' && Tone.getContext) {
        return Tone.getContext().rawContext;
    }
    if (window.audioContext) return window.audioContext;
    if (typeof AudioContext !== 'undefined') {
        window.audioContext = new AudioContext();
        return window.audioContext;
    }
    return null;
}

function getTempo() {
    return localAppServices.getTempoState ? localAppServices.getTempoState() : 120;
}

export function openBeatSyncedLFOPanel(savedState = null) {
    const windowId = 'beatSyncedLFO';
    const getOpenWindows = localAppServices.getOpenWindows || (() => new Map());
    const openWindows = getOpenWindows();

    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        renderLFOContent();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'lfoContent';
    contentContainer.className = 'p-4 flex flex-col gap-4 bg-gray-100 dark:bg-slate-800 h-full overflow-y-auto';

    const options = {
        width: 420, height: 380, minWidth: 360, minHeight: 300,
        initialContentKey: windowId, closable: true, minimizable: true, resizable: true
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

    const createWindowFn = localAppServices.createWindow || window.createWindow;
    if (!createWindowFn) {
        console.error('[BeatSyncedLFOPanel] createWindow not available');
        return null;
    }

    const win = createWindowFn(windowId, 'Beat-Synced LFO', contentContainer, options);
    if (win?.element) {
        initLFO();
        renderLFOContent();
    }
    return win;
}

function initLFO() {
    if (lfoInstance) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const tempo = getTempo();
    lfoInstance = new BeatSyncedLFO(ctx, { tempo, rateDivision: '1/4', type: 'sine', depth: 1 });
    lfoInstance.start();
    console.log('[BeatSyncedLFOPanel] LFO started');
}

function renderLFOContent() {
    const container = document.getElementById('lfoContent');
    if (!container) return;

    const tempo = getTempo();
    const settings = lfoInstance ? lfoInstance.getSettings() : { rateDivision: '1/4', type: 'sine', depth: 1, isRunning: false };

    container.innerHTML = `
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Tempo-synced LFO for filter/amp modulation. Rate divisions lock to BPM.
        </div>

        <div class="flex items-center gap-4 mb-3">
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-600 dark:text-gray-400">Wave:</span>
                <select id="lfoWaveType" class="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded px-2 py-1 text-sm text-gray-800 dark:text-gray-200">
                    <option value="sine" ${settings.type === 'sine' ? 'selected' : ''}>Sine</option>
                    <option value="triangle" ${settings.type === 'triangle' ? 'selected' : ''}>Triangle</option>
                    <option value="square" ${settings.type === 'square' ? 'selected' : ''}>Square</option>
                    <option value="sawtooth" ${settings.type === 'sawtooth' ? 'selected' : ''}>Sawtooth</option>
                </select>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-600 dark:text-gray-400">Division:</span>
                <select id="lfoRateDiv" class="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded px-2 py-1 text-sm text-gray-800 dark:text-gray-200">
                    <option value="4/1" ${settings.rateDivision === '4/1' ? 'selected' : ''}>4/1 (4 bars)</option>
                    <option value="2/1" ${settings.rateDivision === '2/1' ? 'selected' : ''}>2/1 (2 bars)</option>
                    <option value="1/1" ${settings.rateDivision === '1/1' ? 'selected' : ''}>1/1 (1 bar)</option>
                    <option value="1/2" ${settings.rateDivision === '1/2' ? 'selected' : ''}>1/2 (half)</option>
                    <option value="1/4" ${settings.rateDivision === '1/4' ? 'selected' : ''}>1/4 (quarter)</option>
                    <option value="1/8" ${settings.rateDivision === '1/8' ? 'selected' : ''}>1/8 (eighth)</option>
                    <option value="1/16" ${settings.rateDivision === '1/16' ? 'selected' : ''}>1/16 (sixteenth)</option>
                    <option value="1/32" ${settings.rateDivision === '1/32' ? 'selected' : ''}>1/32 (thirty-second)</option>
                    <option value="1/64" ${settings.rateDivision === '1/64' ? 'selected' : ''}>1/64 (sixty-fourth)</option>
                </select>
            </div>
        </div>

        <div class="mb-3">
            <div class="flex items-center justify-between mb-1">
                <span class="text-xs text-gray-600 dark:text-gray-400">Depth</span>
                <span id="lfoDepthVal" class="text-xs text-gray-500">${Math.round(settings.depth * 100)}%</span>
            </div>
            <input type="range" id="lfoDepth" min="0" max="100" value="${Math.round(settings.depth * 100)}" class="w-full h-2 bg-gray-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer">
        </div>

        <div class="mb-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="grid grid-cols-4 gap-2">
                ${['sine', 'triangle', 'square', 'sawtooth'].map(w => `
                    <button class="lfo-wave-btn px-2 py-1 text-xs rounded border ${settings.type === w ? 'bg-purple-500 text-white border-purple-600' : 'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-500 hover:bg-gray-200 dark:hover:bg-slate-500'}" data-wave="${w}">
                        ${w.charAt(0).toUpperCase() + w.slice(1)}
                    </button>
                `).join('')}
            </div>
            <div id="lfoWavePreview" class="mt-3 h-16 bg-black rounded flex items-center justify-center">
                <canvas id="lfoCanvas" class="w-full h-full rounded"></canvas>
            </div>
        </div>

        <div class="mb-3 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Rate Division</div>
            <div class="grid grid-cols-3 gap-1">
                ${[['4/1','4 bars'],['2/1','2 bars'],['1/1','1 bar'],['1/2','1/2'],['1/4','1/4'],['1/8','1/8'],['1/16','1/16'],['1/32','1/32'],['1/64','1/64']].map(([div, label]) => `
                    <button class="lfo-div-btn px-1 py-1 text-xs rounded border ${settings.rateDivision === div ? 'bg-purple-500 text-white border-purple-600' : 'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-slate-500 hover:bg-gray-200 dark:hover:bg-slate-500'}" data-division="${div}">
                        ${label}
                    </button>
                `).join('')}
            </div>
        </div>

        <div class="flex items-center justify-between p-2 bg-gray-200 dark:bg-slate-600 rounded">
            <div class="text-xs text-gray-600 dark:text-gray-400">
                Tempo: <span id="lfoTempoDisplay" class="font-mono text-gray-800 dark:text-gray-200">${tempo}</span> BPM
                <span class="ml-2 text-xs text-purple-600 dark:text-purple-400">
                    → <span id="lfoFreqDisplay">--</span> Hz
                </span>
            </div>
            <div class="flex items-center gap-2">
                <button id="lfoToggleBtn" class="px-3 py-1 text-xs rounded font-medium ${settings.isRunning ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}">
                    ${settings.isRunning ? 'Running' : 'Stopped'}
                </button>
            </div>
        </div>
    `;

    // Wave type select
    container.querySelector('#lfoWaveType')?.addEventListener('change', (e) => {
        if (lfoInstance) lfoInstance.setType(e.target.value);
        renderLFOContent();
    });

    // Rate division select
    container.querySelector('#lfoRateDiv')?.addEventListener('change', (e) => {
        if (lfoInstance) lfoInstance.setRateDivision(e.target.value);
        updateFreqDisplay();
    });

    // Depth slider
    const depthSlider = container.querySelector('#lfoDepth');
    const depthVal = container.querySelector('#lfoDepthVal');
    depthSlider?.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) / 100;
        if (depthVal) depthVal.textContent = `${Math.round(val * 100)}%`;
        if (lfoInstance) lfoInstance.setDepth(val);
    });

    // Wave type buttons
    container.querySelectorAll('.lfo-wave-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (lfoInstance) lfoInstance.setType(btn.dataset.wave);
            renderLFOContent();
        });
    });

    // Rate division buttons
    container.querySelectorAll('.lfo-div-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (lfoInstance) lfoInstance.setRateDivision(btn.dataset.division);
            renderLFOContent();
            updateFreqDisplay();
        });
    });

    // Toggle button
    container.querySelector('#lfoToggleBtn')?.addEventListener('click', () => {
        if (!lfoInstance) return;
        if (lfoInstance.isRunning) {
            lfoInstance.stop();
        } else {
            lfoInstance.start();
        }
        renderLFOContent();
    });

    updateFreqDisplay();
    drawLFOWavePreview();
}

function updateFreqDisplay() {
    if (!lfoInstance) return;
    const container = document.getElementById('lfoContent');
    if (!container) return;
    const freqEl = container.querySelector('#lfoFreqDisplay');
    const settings = lfoInstance.getSettings();
    if (freqEl) freqEl.textContent = settings.frequency.toFixed(2);
}

function drawLFOWavePreview() {
    const container = document.getElementById('lfoContent');
    if (!container) return;
    const canvas = container.querySelector('#lfoCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height - 4;

    const settings = lfoInstance ? lfoInstance.getSettings() : { type: 'sine' };
    const type = settings.type;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const amp = canvas.height * 0.4;
    const midY = canvas.height / 2;
    const period = canvas.width / 2;

    for (let x = 0; x < canvas.width; x++) {
        const t = (x / period) * Math.PI;
        let y;
        switch (type) {
            case 'sine': y = Math.sin(t); break;
            case 'triangle': y = Math.asin(Math.sin(t)) * (2 / Math.PI); break;
            case 'square': y = Math.sin(t) >= 0 ? 1 : -1; break;
            case 'sawtooth': y = 2 * ((t / (2 * Math.PI)) % 1) - 1; break;
            default: y = Math.sin(t);
        }
        const yPos = midY - y * amp;
        if (x === 0) ctx.moveTo(x, yPos);
        else ctx.lineTo(x, yPos);
    }
    ctx.stroke();
}

export function getBeatSyncedLFOInstance() {
    return lfoInstance;
}