// js/ui/timelineUI.js - Timeline UI Management
import { SnugWindow } from '../SnugWindow.js';
import { showNotification, createContextMenu } from '../utils.js';
import * as Constants from '../constants.js';

let localAppServices = {};

export function initializeTimelineUI(appServicesFromMain) {
    localAppServices = appServicesFromMain || {};
    console.log("[TimelineUI] Initialized with appServices keys:", Object.keys(localAppServices));
}

export function openTimelineWindow(savedState = null) {
    const windowId = 'timeline';
    const getOpenWindows = localAppServices.getOpenWindows || (() => new Map());
    const openWindows = getOpenWindows();

    if (openWindows.has(windowId) && !savedState) {
        const winInstance = openWindows.get(windowId);
        if (winInstance && typeof winInstance.restore === 'function') {
            winInstance.restore();
        }
        return winInstance;
    }

    // --- Start of Corrected Code ---
    const contentHTML = `
        <div id="timeline-container" class="h-full w-full overflow-hidden relative flex flex-col bg-white dark:bg-black">
            <div id="timeline-header" class="h-5 bg-white dark:bg-black border-b border-black dark:border-white relative overflow-hidden flex-shrink-0">
                <div id="timeline-ruler" class="absolute top-0 left-0 h-full" style="width: 4000px;"></div>
            </div>
            <div id="timeline-tracks-and-playhead-container" class="relative flex-grow overflow-auto">
                <div id="timeline-playhead" class="absolute top-0 w-0.5 bg-black dark:bg-white z-20" style="left: 120px; height: 100%;"></div>
                <div id="timeline-tracks-area" class="relative h-full"></div>
            </div>
        </div>`;
    // --- End of Corrected Code ---

    const desktopEl = localAppServices.uiElementsCache?.desktop || document.getElementById('desktop');
    const timelineOptions = { 
        width: Math.min(1200, (desktopEl?.offsetWidth || 1200) - 40), 
        height: 250, 
        x: 30, y: 50,
        minWidth: 400, minHeight: 150,
        initialContentKey: windowId 
    };
    if (savedState) Object.assign(timelineOptions, savedState);

    const timelineWindow = localAppServices.createWindow(windowId, 'Timeline', contentHTML, timelineOptions);

    if (timelineWindow?.element) {
        const ruler = timelineWindow.element.querySelector('#timeline-ruler');
        const tracksAndPlayheadContainer = timelineWindow.element.querySelector('#timeline-tracks-and-playhead-container');
        
        // --- Start of Corrected Code ---
        // This scroll synchronization logic is correct and remains.
        tracksAndPlayheadContainer?.addEventListener('scroll', () => {
            const scrollLeft = tracksAndPlayheadContainer.scrollLeft;
            if (ruler) {
                ruler.style.transform = `translateX(-${scrollLeft}px)`;
            }
        });
        // --- End of Corrected Code ---

        renderTimeline();
    }
}

export function renderTimeline() {
    const timelineWindow = localAppServices.getWindowById('timeline');
    if (!timelineWindow?.element) return;

    const tracksArea = timelineWindow.element.querySelector('#timeline-tracks-area');
    if (!tracksArea) return;

    const tracks = localAppServices.getTracks();
    tracksArea.innerHTML = ''; // Clear existing tracks

    tracks.forEach(track => {
        if (track.type !== 'Audio') return; // For now, only show Audio tracks

        const lane = document.createElement('div');
        // --- Start of Corrected Code ---
        lane.className = 'timeline-track-lane relative flex items-center border-b border-black dark:border-white';
        
        const laneName = document.createElement('div');
        laneName.className = 'timeline-track-lane-name sticky left-0 h-full flex items-center px-2 border-r border-black dark:border-white bg-white dark:bg-black';
        // --- End of Corrected Code ---
        laneName.textContent = track.name;
        
        const clipsArea = document.createElement('div');
        clipsArea.className = 'timeline-clips-area h-full flex-grow relative';

        lane.appendChild(laneName);
        lane.appendChild(clipsArea);
        tracksArea.appendChild(lane);

        track.timelineClips.forEach(clip => {
            const clipDiv = document.createElement('div');
            // --- Start of Corrected Code ---
            clipDiv.className = 'audio-clip absolute h-4/5 top-[10%] rounded-sm overflow-hidden whitespace-nowrap px-2 flex items-center cursor-grab bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white focus:ring-2 ring-black dark:ring-white';
            // --- End of Corrected Code ---
            clipDiv.textContent = clip.name;
            clipDiv.setAttribute('data-clip-id', clip.id);
            clipDiv.setAttribute('data-track-id', track.id);

            const pixelsPerSecond = (60 / Tone.Transport.bpm.value) * 60; 
            clipDiv.style.left = `${clip.startTime * pixelsPerSecond}px`;
            clipDiv.style.width = `${clip.duration * pixelsPerSecond}px`;
            
            clipsArea.appendChild(clipDiv);
        });
    });
}


export function updatePlayheadPosition(transportTime) {
    const timelineWindow = localAppServices.getWindowById('timeline');
    if (!timelineWindow?.element || timelineWindow.isMinimized) return;

    const playhead = timelineWindow.element.querySelector('#timeline-playhead');
    const tracksAndPlayheadContainer = timelineWindow.element.querySelector('#timeline-tracks-and-playhead-container');

    if (!playhead || !tracksAndPlayheadContainer) return;

    const pixelsPerSecond = (60 / Tone.Transport.bpm.value) * 60;
    const trackNameWidthValue = getComputedStyle(document.documentElement).getPropertyValue('--timeline-track-name-width');
    const trackNameWidth = parseInt(trackNameWidthValue, 10) || 120;
    
    const playheadAbsoluteLeft = (transportTime * pixelsPerSecond);
    playhead.style.transform = `translateX(${playheadAbsoluteLeft}px)`;

    if (typeof Tone !== 'undefined' && Tone.Transport.state === 'started') {
        const containerScrollLeft = tracksAndPlayheadContainer.scrollLeft;
        const containerWidth = tracksAndPlayheadContainer.clientWidth;
        
        const playheadVisibleStart = containerScrollLeft;
        const playheadVisibleEnd = containerScrollLeft + containerWidth;
        const scrollBuffer = 50; 

        if (playhead.offsetLeft > playheadVisibleEnd - scrollBuffer) {
            tracksAndPlayheadContainer.scrollLeft = playhead.offsetLeft - containerWidth + scrollBuffer;
        }
        else if (playhead.offsetLeft < playheadVisibleStart + scrollBuffer) {
             tracksAndPlayheadContainer.scrollLeft = Math.max(0, playhead.offsetLeft - scrollBuffer);
        }
    }
}
