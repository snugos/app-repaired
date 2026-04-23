// js/RhythmCoach.js - Visual metronome trainer with timing accuracy feedback
import { showNotification } from './utils.js';

// State
let rhythmCoachEnabled = false;
let timingRecords = []; // Array of { time: ms, deviation: ms (positive=late, negative=early), note: pitch }
let currentSessionStats = { totalNotes: 0, averageDeviation: 0, worstDeviation: 0, accuracy: 0 };
const MAX_TIMING_RECORDS = 64;

// Thresholds for rating (in ms)
const EXCELLENT_THRESHOLD = 15;
const GOOD_THRESHOLD = 35;
const OK_THRESHOLD = 70;

let localAppServices = {};

/**
 * Initialize Rhythm Coach with app services
 */
export function initRhythmCoach(services) {
    localAppServices = services || {};
}

/**
 * Enable/disable rhythm coach
 */
export function setRhythmCoachEnabled(enabled) {
    rhythmCoachEnabled = !!enabled;
    if (rhythmCoachEnabled) {
        timingRecords = [];
        resetSessionStats();
        console.log('[RhythmCoach] Enabled');
    } else {
        console.log('[RhythmCoach] Disabled');
    }
}

/**
 * Check if rhythm coach is enabled
 */
export function getRhythmCoachEnabled() {
    return rhythmCoachEnabled;
}

/**
 * Reset session statistics
 */
function resetSessionStats() {
    currentSessionStats = { totalNotes: 0, averageDeviation: 0, worstDeviation: 0, accuracy: 0 };
}

/**
 * Record a timing event
 * @param {number} deviationMs - Deviation from metronome in ms (positive=late, negative=early)
 * @param {number} note - MIDI pitch
 */
export function recordTimingEvent(deviationMs, note = 60) {
    if (!rhythmCoachEnabled) return;

    timingRecords.push({
        time: Date.now(),
        deviation: deviationMs,
        note: note
    });

    if (timingRecords.length > MAX_TIMING_RECORDS) {
        timingRecords.shift();
    }

    updateSessionStats();
    updateRhythmCoachUI();
}

/**
 * Update session statistics based on timing records
 */
function updateSessionStats() {
    if (timingRecords.length === 0) {
        resetSessionStats();
        return;
    }

    const deviations = timingRecords.map(r => r.deviation);
    const totalDeviation = deviations.reduce((a, b) => a + b, 0);
    const avgDev = totalDeviation / deviations.length;
    const absDeviations = deviations.map(d => Math.abs(d));
    const worst = Math.max(...absDeviations);

    // Calculate accuracy percentage (100% = perfect, 0% = awful)
    const accuracyScores = deviations.map(d => {
        const abs = Math.abs(d);
        if (abs <= EXCELLENT_THRESHOLD) return 100;
        if (abs <= GOOD_THRESHOLD) return 100 - ((abs - EXCELLENT_THRESHOLD) / (GOOD_THRESHOLD - EXCELLENT_THRESHOLD)) * 30;
        if (abs <= OK_THRESHOLD) return 70 - ((abs - GOOD_THRESHOLD) / (OK_THRESHOLD - GOOD_THRESHOLD)) * 50;
        return Math.max(0, 20 - ((abs - OK_THRESHOLD) / 100) * 20);
    });
    const accuracy = accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length;

    currentSessionStats = {
        totalNotes: timingRecords.length,
        averageDeviation: avgDev,
        worstDeviation: worst,
        accuracy: accuracy
    };
}

/**
 * Get timing rating based on deviation
 */
function getTimingRating(deviationMs) {
    const abs = Math.abs(deviationMs);
    if (abs <= EXCELLENT_THRESHOLD) return 'excellent';
    if (abs <= GOOD_THRESHOLD) return 'good';
    if (abs <= OK_THRESHOLD) return 'ok';
    return 'miss';
}

/**
 * Open the Rhythm Coach panel
 */
export function openRhythmCoachPanel(savedState = null) {
    const windowId = 'rhythmCoach';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();

    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        win.restore();
        return win;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'rhythmCoachContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-900 dark:bg-slate-900';

    const options = {
        width: 480,
        height: 520,
        minWidth: 400,
        minHeight: 400,
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

    const win = localAppServices.createWindow(windowId, '🎯 Rhythm Coach', contentContainer, options);
    if (win?.element) {
        setTimeout(() => renderRhythmCoachContent(), 50);
    }
    return win;
}

/**
 * Render the Rhythm Coach panel content
 */
function renderRhythmCoachContent() {
    const container = document.getElementById('rhythmCoachContent');
    if (!container) return;

    container.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="rhythmCoachEnabled" ${rhythmCoachEnabled ? 'checked' : ''} class="w-5 h-5 accent-green-500">
                    <span class="text-sm font-medium text-white">Enable Coach</span>
                </label>
            </div>
            <button id="rhythmCoachReset" class="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">
                Reset Stats
            </button>
        </div>

        <div class="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
            <div class="text-xs text-gray-400 mb-2">Session Statistics</div>
            <div class="grid grid-cols-2 gap-3">
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-400" id="rhythmCoachAccuracy">0%</div>
                    <div class="text-xs text-gray-500">Accuracy</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-400" id="rhythmCoachNotes">0</div>
                    <div class="text-xs text-gray-500">Notes Recorded</div>
                </div>
                <div class="text-center">
                    <div class="text-xl font-bold" id="rhythmCoachAvgDev">0ms</div>
                    <div class="text-xs text-gray-500">Avg Deviation</div>
                </div>
                <div class="text-center">
                    <div class="text-xl font-bold text-red-400" id="rhythmCoachWorst">0ms</div>
                    <div class="text-xs text-gray-500">Worst Timing</div>
                </div>
            </div>
        </div>

        <div class="mb-4">
            <div class="text-xs text-gray-400 mb-2">Timing Feedback</div>
            <div id="rhythmCoachFeedback" class="h-16 flex items-center justify-center bg-black rounded border border-gray-700">
                <div class="text-gray-500 text-sm">Play notes to see timing feedback</div>
            </div>
        </div>

        <div class="mb-4">
            <div class="text-xs text-gray-400 mb-2">Timing History</div>
            <div id="rhythmCoachHistory" class="h-24 flex items-end gap-1 bg-black rounded border border-gray-700 p-2 overflow-hidden">
                <!-- Timing bars will be rendered here -->
            </div>
            <div class="flex justify-between mt-1 text-xs text-gray-600">
                <span>Early ←</span>
                <span>→ Late</span>
            </div>
        </div>

        <div class="flex-1">
            <div class="text-xs text-gray-400 mb-2">Legend</div>
            <div class="grid grid-cols-4 gap-2 text-xs">
                <div class="flex items-center gap-1">
                    <div class="w-3 h-3 rounded bg-green-500"></div>
                    <span class="text-gray-400">±15ms Excellent</span>
                </div>
                <div class="flex items-center gap-1">
                    <div class="w-3 h-3 rounded bg-yellow-500"></div>
                    <span class="text-gray-400">±35ms Good</span>
                </div>
                <div class="flex items-center gap-1">
                    <div class="w-3 h-3 rounded bg-orange-500"></div>
                    <span class="text-gray-400">±70ms OK</span>
                </div>
                <div class="flex items-center gap-1">
                    <div class="w-3 h-3 rounded bg-red-500"></div>
                    <span class="text-gray-400">>70ms Miss</span>
                </div>
            </div>
        </div>

        <div class="mt-4 p-2 bg-blue-900/30 rounded border border-blue-700">
            <div class="text-xs text-blue-300">
                💡 <strong>Tip:</strong> Enable Rhythm Coach, start playback, and play notes in time with the metronome.
                Your timing deviations will be tracked and displayed in real-time.
            </div>
        </div>
    `;

    // Add event listeners
    const enabledCheckbox = container.querySelector('#rhythmCoachEnabled');
    enabledCheckbox?.addEventListener('change', (e) => {
        setRhythmCoachEnabled(e.target.checked);
        if (e.target.checked) {
            updateRhythmCoachUI();
        }
    });

    const resetBtn = container.querySelector('#rhythmCoachReset');
    resetBtn?.addEventListener('click', () => {
        timingRecords = [];
        resetSessionStats();
        updateRhythmCoachUI();
        showNotification('Rhythm Coach stats reset', 1500);
    });

    updateRhythmCoachUI();
}

/**
 * Update the Rhythm Coach UI with current stats
 */
function updateRhythmCoachUI() {
    const container = document.getElementById('rhythmCoachContent');
    if (!container) return;

    // Update stats display
    const accuracyEl = container.querySelector('#rhythmCoachAccuracy');
    const notesEl = container.querySelector('#rhythmCoachNotes');
    const avgDevEl = container.querySelector('#rhythmCoachAvgDev');
    const worstEl = container.querySelector('#rhythmCoachWorst');
    const feedbackEl = container.querySelector('#rhythmCoachFeedback');
    const historyEl = container.querySelector('#rhythmCoachHistory');

    if (accuracyEl) {
        accuracyEl.textContent = `${Math.round(currentSessionStats.accuracy)}%`;
        accuracyEl.className = `text-2xl font-bold ${getAccuracyColor(currentSessionStats.accuracy)}`;
    }
    if (notesEl) notesEl.textContent = currentSessionStats.totalNotes;
    if (avgDevEl) {
        avgDevEl.textContent = `${Math.round(currentSessionStats.averageDeviation)}ms`;
        avgDevEl.className = `text-xl font-bold ${getDeviationColor(currentSessionStats.averageDeviation)}`;
    }
    if (worstEl) {
        worstEl.textContent = `${Math.round(currentSessionStats.worstDeviation)}ms`;
    }

    // Update timing history visualization
    if (historyEl) {
        renderTimingHistory(historyEl);
    }

    // Update feedback with most recent timing
    if (feedbackEl && timingRecords.length > 0) {
        const lastRecord = timingRecords[timingRecords.length - 1];
        const rating = getTimingRating(lastRecord.deviation);
        const direction = lastRecord.deviation > 0 ? 'LATE' : 'EARLY';
        const amount = Math.abs(lastRecord.deviation);

        feedbackEl.innerHTML = `
            <div class="text-center">
                <div class="text-3xl font-bold ${getRatingColor(rating)}">${rating.toUpperCase()}</div>
                <div class="text-sm text-gray-400">${amount}ms ${direction}</div>
            </div>
        `;
    }
}

/**
 * Get color for accuracy percentage
 */
function getAccuracyColor(accuracy) {
    if (accuracy >= 90) return 'text-green-400';
    if (accuracy >= 70) return 'text-yellow-400';
    if (accuracy >= 50) return 'text-orange-400';
    return 'text-red-400';
}

/**
 * Get color for deviation amount
 */
function getDeviationColor(deviation) {
    const abs = Math.abs(deviation);
    if (abs <= EXCELLENT_THRESHOLD) return 'text-green-400';
    if (abs <= GOOD_THRESHOLD) return 'text-yellow-400';
    if (abs <= OK_THRESHOLD) return 'text-orange-400';
    return 'text-red-400';
}

/**
 * Get color for timing rating
 */
function getRatingColor(rating) {
    switch (rating) {
        case 'excellent': return 'text-green-400';
        case 'good': return 'text-yellow-400';
        case 'ok': return 'text-orange-400';
        default: return 'text-red-400';
    }
}

/**
 * Render timing history bars
 */
function renderTimingHistory(container) {
    if (timingRecords.length === 0) {
        container.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-600 text-sm">No timing data yet</div>';
        return;
    }

    const maxHeight = container.clientHeight - 8;
    const maxDeviation = Math.max(100, ...timingRecords.map(r => Math.abs(r.deviation)));

    container.innerHTML = timingRecords.map(record => {
        const height = Math.min(maxHeight, (Math.abs(record.deviation) / maxDeviation) * maxHeight);
        const color = getDeviationColor(record.deviation).replace('text-', 'bg-');
        const isLate = record.deviation > 0;
        return `<div class="w-full flex-1 ${color} rounded-t" style="height: ${height}px;" title="${record.deviation > 0 ? '+' : ''}${record.deviation}ms ${isLate ? 'late' : 'early'}"></div>`;
    }).join('');
}

/**
 * Update the Rhythm Coach panel if it's open
 */
export function updateRhythmCoachPanel() {
    updateRhythmCoachUI();
}

/**
 * Calculate timing deviation when user plays a note
 * Called when a MIDI note is triggered during recording/playback
 * @param {number} expectedBeatTime - Expected time of the beat in Tone.js Transport time
 * @param {number} actualTime - Actual time the note was played
 * @param {number} note - MIDI pitch
 */
export function calculateTimingDeviation(expectedBeatTime, actualTime, note = 60) {
    if (!rhythmCoachEnabled) return null;

    // Calculate deviation in milliseconds
    const deviationMs = (actualTime - expectedBeatTime) * 1000;

    recordTimingEvent(deviationMs, note);

    return {
        deviationMs,
        rating: getTimingRating(deviationMs)
    };
}