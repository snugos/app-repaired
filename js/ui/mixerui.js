// js/ui/mixerUI.js

let localAppServices = {};

export function initializeMixerUI(appServices) {
    localAppServices = appServices;
}

export function openMixerWindow(savedState = null) {
    // --- DEBUGGING LOG ---
    console.log(`%c[mixerUI.js] openMixerWindow received savedState:`, 'color: #f39c12;', savedState);

    const windowId = 'mixer';
    const openWindows = localAppServices.getOpenWindows();
    if (openWindows.has(windowId) && !savedState) {
        openWindows.get(windowId).restore();
        return;
    }

    const contentContainer = document.createElement('div');
    contentContainer.id = 'mixerContentContainer';
    contentContainer.className = 'p-2 overflow-x-auto whitespace-nowrap h-full bg-white dark:bg-black';
    
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
        updateMixerWindow();
    }
}

export function updateMixerWindow() {
    const mixerWindow = localAppServices.getWindowById('mixer');
    if (!mixerWindow?.element || mixerWindow.isMinimized) return;

    const container = mixerWindow.element.querySelector('#mixerContentContainer');
    if (!container) return;

    const tracks = localAppServices.getTracks();
    const masterGainValue = localAppServices.getMasterGainValue();
    container.innerHTML = '';

    const masterTrackDiv = document.createElement('div');
    masterTrackDiv.className = 'mixer-track master-track inline-block align-top p-1.5 border-2 border-black dark:border-white bg-white dark:bg-black shadow w-28 mr-2 text-xs';
    masterTrackDiv.innerHTML = `<div class="track-name font-bold truncate mb-1 text-black dark:text-white" title="Master">MASTER</div>
        <div id="volumeKnob-mixer-master-placeholder" class="h-16 mx-auto mb-1"></div>
        <div id="mixerMasterMeterContainer" class="h-3 w-full bg-white dark:bg-black rounded border border-black dark:border-white overflow-hidden mt-0.5">
            <div id="mixerMasterMeterBar" class="h-full bg-black dark:bg-white transition-all duration-50 ease-linear" style="width: 0%;"></div>
        </div>`;
    container.appendChild(masterTrackDiv);

    const masterVolKnobPlaceholder = masterTrackDiv.querySelector('#volumeKnob-mixer-master-placeholder');
    if (masterVolKnobPlaceholder) {
        const masterVolKnob = localAppServices.createKnob({
            label: 'Master Vol', min: 0, max: 1.2, step: 0.01,
            initialValue: masterGainValue,
            onValueChange: (val) => {
                if (localAppServices.setActualMasterVolume) localAppServices.setActualMasterVolume(val);
                if (localAppServices.setMasterGainValue) localAppServices.setMasterGainValue(val);
            }
        }, localAppServices);
        masterVolKnobPlaceholder.appendChild(masterVolKnob.element);
    }

    tracks.forEach(track => {
        const trackDiv = document.createElement('div');
        trackDiv.className = 'mixer-track inline-block align-top p-1.5 border border-black dark:border-white bg-white dark:bg-black shadow w-24 mr-2 text-xs';
        trackDiv.innerHTML = `<div class="track-name font-semibold truncate mb-1 text-black dark:text-white" title="${track.name}">${track.name}</div>
            <div id="volumeKnob-mixer-${track.id}-placeholder" class="h-16 mx-auto mb-1"></div>
            <div id="mixerTrackMeterContainer-${track.id}" class="h-3 w-full bg-white dark:bg-black rounded border border-black dark:border-white overflow-hidden mt-0.5">
                <div id="mixerTrackMeterBar-${track.id}" class="h-full bg-black dark:bg-white transition-all duration-50 ease-linear" style="width: 0%;"></div>
            </div>`;
        container.appendChild(trackDiv);

        const volKnobPlaceholder = trackDiv.querySelector(`#volumeKnob-mixer-${track.id}-placeholder`);
        if (volKnobPlaceholder) {
            const volKnob = localAppServices.createKnob({
                label: `Vol ${track.id}`, min: 0, max: 1.2, step: 0.01,
                initialValue: track.previousVolumeBeforeMute,
                onValueChange: (val, o, fromInteraction) => track.setVolume(val, fromInteraction)
            }, localAppServices);
            volKnobPlaceholder.appendChild(volKnob.element);
        }
    });
}
