// js/daw/ui/mixerUI.js

// Corrected imports for state modules
import { getTracks, getSoloedTrackId } from '/app/js/daw/state/trackState.js'; // Corrected path
import { getMasterGainValue, setMasterGainValue } from '/app/js/daw/state/masterState.js'; // Corrected path
import { getOpenWindows, getWindowById } from '/app/js/daw/state/windowState.js'; // Corrected path
import { getThemeColors } from '/app/js/daw/utils.js'; // Corrected path

let localAppServices = {};

export function initializeMixerUI(appServices) {
    localAppServices = appServices;
}

export function openMixerWindow(savedState = null) {
    const windowId = 'mixer';
    const openWindows = getOpenWindows();
    if (openWindows.has(windowId) && !savedState) {
        getWindowById(windowId).restore();
        return;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'mixerContentContainer';
    // Apply theme-aware classes
    contentContainer.className = 'p-2 overflow-x-auto whitespace-nowrap h-full bg-window-content text-primary';
    
    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const mixerOptions = {
        width: Math.min(800, (desktopEl?.offsetWidth || 800) - 40),
        height: 300,
        minWidth: 300,
        minHeight: 200,
        initialContentKey: windowId
    };

    if (savedState) Object.assign(mixerOptions, savedState);
    
    const mixerWindow = localAppServices.createWindow(windowId, 'Mixer', contentContainer, mixerOptions);
    if (mixerWindow?.element) {
        // Set the onRefresh callback for the window
        mixerWindow.onRefreshCallback = updateMixerWindow;
        updateMixerWindow();
    }
}

export function updateMixerWindow() {
    console.log('[mixerUI.js] updateMixerWindow called.');
    const container = document.getElementById('mixerContentContainer');
    if (container) {
        renderMixerTracks(container);
    }
}

function renderMixerTracks(container) {
    const tracks = getTracks();
    console.log(`%c[mixerUI.js] renderMixerTracks called with ${tracks.length} tracks.`, 'color: #f39c12; font-weight: bold;');

    container.innerHTML = '';
    const themeColors = getThemeColors(); // Get current theme colors

    // Master Track
    const masterTrackDiv = document.createElement('div');
    masterTrackDiv.className = 'mixer-track master-track inline-block align-top p-1.5 border shadow w-24 mr-2 text-xs';
    masterTrackDiv.style.borderColor = themeColors.borderPrimary; // Apply border color
    masterTrackDiv.style.backgroundColor = themeColors.bgWindow; // Apply background color
    masterTrackDiv.innerHTML = `<div class="track-name font-semibold truncate mb-1" style="color: ${themeColors.textPrimary};" title="Master">Master</div>
        <div id="volumeKnob-mixer-master-placeholder" class="h-16 mx-auto mb-1"></div>
        <div id="mixerTrackMeterContainer-master" class="h-3 w-full rounded border overflow-hidden mt-0.5" style="background-color: ${themeColors.bgMeterBarContainer}; border-color: ${themeColors.borderMeterBarContainer};">
            <div id="mixerTrackMeterBar-master" class="h-full" style="background-color: ${themeColors.accentMeter}; width: 0%;"></div>
        </div>`;
    container.appendChild(masterTrackDiv);

    const masterVolKnobPlaceholder = masterTrackDiv.querySelector('#volumeKnob-mixer-master-placeholder');
    if (masterVolKnobPlaceholder) {
        const masterVolKnob = localAppServices.createKnob({
            label: 'Master',
            min: 0,
            max: 1.2, // Max volume can go a bit over 1 for boost
            step: 0.01,
            initialValue: getMasterGainValue(),
            onValueChange: (val, oldVal, fromInteraction) => setMasterGainValue(val, fromInteraction)
        }, localAppServices.captureStateForUndo);
        masterVolKnobPlaceholder.appendChild(masterVolKnob.element);
    }

    // Individual Tracks
    tracks.forEach(track => {
        console.log(`[mixerUI.js] Rendering track: ${track.name}`);

        const soloedTrackId = getSoloedTrackId();
        const isEffectivelyMuted = track.isMuted || (soloedTrackId !== null && soloedTrackId !== track.id);

        const trackDiv = document.createElement('div');
        trackDiv.className = 'mixer-track inline-block align-top p-1.5 border shadow w-24 mr-2 text-xs';
        trackDiv.style.borderColor = themeColors.borderPrimary; // Apply border color
        trackDiv.style.backgroundColor = themeColors.bgWindow; // Apply background color
        trackDiv.dataset.trackId = track.id;
        trackDiv.innerHTML = `<div class="track-name font-semibold truncate mb-1" style="color: ${themeColors.textPrimary};" title="${track.name}">${track.name}</div>
            <div id="volumeKnob-mixer-${track.id}-placeholder" class="h-16 mx-auto mb-1"></div>
            <div id="mixerTrackMeterContainer-${track.id}" class="h-3 w-full rounded border overflow-hidden mt-0.5" style="background-color: ${themeColors.bgMeterBarContainer}; border-color: ${themeColors.borderMeterBarContainer};">
                <div id="mixerTrackMeterBar-${track.id}" class="h-full" style="background-color: ${themeColors.accentMeter}; width: 0%;"></div>
            </div>
            <div class="flex justify-around mt-1">
                <button id="mixerMuteBtn-${track.id}" class="px-2 py-0.5 border rounded text-xs" style="background-color: ${themeColors.bgButton}; color: ${themeColors.textButton}; border-color: ${themeColors.borderButton};">${track.isMuted ? 'Unmute' : 'Mute'}</button>
                <button id="mixerSoloBtn-${track.id}" class="px-2 py-0.5 border rounded text-xs" style="background-color: ${themeColors.bgButton}; color: ${themeColors.textButton}; border-color: ${themeColors.borderButton};">${track.isSoloed ? 'Unsolo' : 'Solo'}</button>
            </div>
            `;
        container.appendChild(trackDiv);

        const volKnobPlaceholder = trackDiv.querySelector(`#volumeKnob-mixer-${track.id}-placeholder`);
        if (volKnobPlaceholder) {
            const volKnob = localAppServices.createKnob({
                label: `Vol ${track.id}`,
                min: 0,
                max: 1.2,
                step: 0.01,
                initialValue: track.previousVolumeBeforeMute,
                onValueChange: (val, oldVal, fromInteraction) => track.setVolume(val, fromInteraction)
            }, localAppServices.captureStateForUndo);
            volKnobPlaceholder.appendChild(volKnob.element);
        }

        const mixerMuteBtn = trackDiv.querySelector(`#mixerMuteBtn-${track.id}`);
        if (mixerMuteBtn) {
            mixerMuteBtn.addEventListener('click', () => localAppServices.handleTrackMute(track.id));
            mixerMuteBtn.classList.toggle('muted', isEffectivelyMuted);
        }

        const mixerSoloBtn = trackDiv.querySelector(`#mixerSoloBtn-${track.id}`);
        if (mixerSoloBtn) {
            mixerSoloBtn.addEventListener('click', () => localAppServices.handleTrackSolo(track.id));
            mixerSoloBtn.classList.toggle('soloed', track.isSoloed);
        }
    });
}