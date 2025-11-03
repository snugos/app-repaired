// js/globalControlsUI.js - UI for Global Controls Window

import { SnugWindow } from './SnugWindow.js'; // Assuming SnugWindow is in the same directory
import * as Constants from './constants.js'; // Assuming constants.js is in the same directory
// Note: showNotification would typically be accessed via appServices if needed directly here,
// but for this component, it's primarily for structure.
// The actual event handlers that might trigger notifications are in eventhandlers.js

let localAppServices = {}; // Will be populated if this module needs to call services directly

export function initializeGlobalControlsUIModule(appServicesFromMain) {
    localAppServices = appServicesFromMain;
}

export function openGlobalControlsWindow(onReadyCallback, savedState = null) {
    const windowId = 'globalControls';
    // Access appServices directly if they were set during initialization,
    // otherwise, this function relies on what's passed or available globally (less ideal).
    const getOpenWindows = localAppServices.getOpenWindows || (() => new Map());
    const removeWindowFromStore = localAppServices.removeWindowFromStore;
    const createWindow = localAppServices.createWindow;

    const openWindows = getOpenWindows();

    if (openWindows.has(windowId) && !savedState) {
        const win = openWindows.get(windowId);
        if (win && !win.element) {
            if (removeWindowFromStore) {
                removeWindowFromStore(windowId);
                console.log(`[GlobalControlsUI openGlobalControlsWindow] Removed ghost entry for ${windowId}. Proceeding to recreate.`);
            }
            // Fall through to create a new window
        } else if (win && win.element) {
            win.restore();
            if (typeof onReadyCallback === 'function' && win.element) {
                onReadyCallback({
                    playBtnGlobal: win.element.querySelector('#playBtnGlobal'),
                    recordBtnGlobal: win.element.querySelector('#recordBtnGlobal'),
                    stopBtnGlobal: win.element.querySelector('#stopBtnGlobal'),
                    tempoGlobalInput: win.element.querySelector('#tempoGlobalInput'),
                    midiInputSelectGlobal: win.element.querySelector('#midiInputSelectGlobal'),
                    masterMeterContainerGlobal: win.element.querySelector('#masterMeterContainerGlobal'),
                    masterMeterBarGlobal: win.element.querySelector('#masterMeterBarGlobal'),
                    midiIndicatorGlobal: win.element.querySelector('#midiIndicatorGlobal'),
                    keyboardIndicatorGlobal: win.element.querySelector('#keyboardIndicatorGlobal'),
                    playbackModeToggleBtnGlobal: win.element.querySelector('#playbackModeToggleBtnGlobal')
                });
            }
            return win;
        }
    }

    console.log(`[GlobalControlsUI openGlobalControlsWindow] Creating new window instance for ${windowId}.`);
    const contentHTML = `<div id="global-controls-content" class="p-2.5 space-y-3 text-sm text-gray-700 dark:text-slate-300">
        <div class="grid grid-cols-3 gap-2 items-center">
            <button id="playBtnGlobal" title="Play/Pause (Spacebar)" class="bg-green-500 hover:bg-green-600 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-green-600 dark:hover:bg-green-700">Play</button>
            <button id="stopBtnGlobal" title="Stop All Audio (Panic)" class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-yellow-600 dark:hover:bg-yellow-700">Stop</button>
            <button id="recordBtnGlobal" title="Record Arm/Disarm" class="bg-red-500 hover:bg-red-600 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-red-600 dark:hover:bg-red-700">Record</button>
        </div>
        <div> <label for="tempoGlobalInput" class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-0.5">Tempo (BPM):</label> <input type="number" id="tempoGlobalInput" value="120" min="${Constants.MIN_TEMPO}" max="${Constants.MAX_TEMPO}" step="0.1" class="w-full p-1.5 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> </div>
        <div> <label for="midiInputSelectGlobal" class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-0.5">MIDI Input:</label> <select id="midiInputSelectGlobal" class="w-full p-1.5 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"> <option value="">No MIDI Input</option> </select> </div>
        <div class="pt-1"> <label class="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-0.5">Master Level:</label> <div id="masterMeterContainerGlobal" class="h-5 w-full bg-gray-200 dark:bg-slate-600 rounded border border-gray-300 dark:border-slate-500 overflow-hidden shadow-sm"> <div id="masterMeterBarGlobal" class="h-full bg-blue-500 transition-all duration-50 ease-linear" style="width: 0%;"></div> </div> </div>
        <div class="flex justify-between items-center text-xs mt-1.5"> <span id="midiIndicatorGlobal" title="MIDI Activity" class="px-2 py-1 rounded-full bg-gray-300 text-gray-600 font-medium transition-colors duration-150 dark:bg-slate-600 dark:text-slate-300">MIDI</span> <span id="keyboardIndicatorGlobal" title="Computer Keyboard Activity" class="px-2 py-1 rounded-full bg-gray-300 text-gray-600 font-medium transition-colors duration-150 dark:bg-slate-600 dark:text-slate-300">KBD</span> </div>
        <div class="mt-2"> <button id="playbackModeToggleBtnGlobal" title="Toggle Playback Mode (Sequencer/Timeline)" class="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-1.5 px-3 rounded shadow transition-colors duration-150 dark:bg-sky-600 dark:hover:bg-sky-700">Mode: Sequencer</button> </div>
    </div>`;
    const options = { width: 280, height: 360, minWidth: 250, minHeight: 340, closable: true, minimizable: true, resizable: true, initialContentKey: windowId };
    if (savedState) Object.assign(options, { x: parseInt(savedState.left,10), y: parseInt(savedState.top,10), width: parseInt(savedState.width,10), height: parseInt(savedState.height,10), zIndex: savedState.zIndex, isMinimized: savedState.isMinimized });
    
    const newWindow = createWindow(windowId, 'Global Controls', contentHTML, options);
    if (newWindow?.element && typeof onReadyCallback === 'function') {
        onReadyCallback({
            playBtnGlobal: newWindow.element.querySelector('#playBtnGlobal'),
            recordBtnGlobal: newWindow.element.querySelector('#recordBtnGlobal'),
            stopBtnGlobal: newWindow.element.querySelector('#stopBtnGlobal'),
            tempoGlobalInput: newWindow.element.querySelector('#tempoGlobalInput'),
            midiInputSelectGlobal: newWindow.element.querySelector('#midiInputSelectGlobal'),
            masterMeterContainerGlobal: newWindow.element.querySelector('#masterMeterContainerGlobal'),
            masterMeterBarGlobal: newWindow.element.querySelector('#masterMeterBarGlobal'),
            midiIndicatorGlobal: newWindow.element.querySelector('#midiIndicatorGlobal'),
            keyboardIndicatorGlobal: newWindow.element.querySelector('#keyboardIndicatorGlobal'),
            playbackModeToggleBtnGlobal: newWindow.element.querySelector('#playbackModeToggleBtnGlobal')
        });
    }
    return newWindow;
}
