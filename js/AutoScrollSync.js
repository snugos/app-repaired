// js/AutoScrollSync.js - Auto-Scroll Sync Feature
// Timeline auto-scrolls during playback to keep playhead centered in view

let autoScrollEnabled = false;
let lastScrollPosition = 0;

export function getAutoScrollEnabled() {
    return autoScrollEnabled;
}

export function setAutoScrollEnabled(enabled) {
    autoScrollEnabled = !!enabled;
    console.log(`[AutoScrollSync] Auto-scroll ${autoScrollEnabled ? 'enabled' : 'disabled'}`);
    updateAutoScrollButton();
}

export function toggleAutoScroll() {
    setAutoScrollEnabled(!autoScrollEnabled);
}

function updateAutoScrollButton() {
    const btn = document.getElementById('autoScrollToggleBtn');
    if (btn) {
        btn.textContent = `Auto-Scroll: ${autoScrollEnabled ? 'On' : 'Off'}`;
        btn.classList.toggle('bg-green-600', autoScrollEnabled);
        btn.classList.toggle('hover:bg-green-700', autoScrollEnabled);
        btn.classList.toggle('bg-gray-600', !autoScrollEnabled);
        btn.classList.toggle('hover:bg-gray-500', !autoScrollEnabled);
    }
}

/**
 * Find the timeline/sequencer container element that can be scrolled
 */
function findTimelineContainer() {
    // Try common timeline container selectors
    const selectors = [
        '#timelineContent',
        '#sequencerContent', 
        '.timeline-content',
        '.sequencer-content',
        '#trackSequencerContent',
        '.track-sequencer-content'
    ];
    
    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && (el.scrollWidth > el.clientWidth || el.style.overflowX === 'auto')) {
            return el;
        }
    }
    
    // Fallback: look for any scrollable container in desktop
    const desktop = document.getElementById('desktop');
    if (desktop) {
        const scrollable = desktop.querySelector('[class*="overflow"]');
        if (scrollable) return scrollable;
    }
    
    return null;
}

/**
 * Calculate playhead position as a percentage of the timeline width
 */
function getPlayheadPercent() {
    if (typeof Tone === 'undefined' || !Tone.Transport) return 0;
    
    const currentTime = Tone.Transport.seconds;
    const bpm = Tone.Transport.bpm?.value || 120;
    const beatsPerSecond = bpm / 60;
    const totalBeats = 16 * beatsPerSecond; // Default 16 bars
    const percent = (currentTime * beatsPerSecond) / totalBeats;
    
    return Math.max(0, Math.min(1, percent));
}

/**
 * Scroll the timeline to keep the playhead centered
 */
export function autoScrollTimeline() {
    if (!autoScrollEnabled) return;
    
    const container = findTimelineContainer();
    if (!container) return;
    
    const playheadPercent = getPlayheadPercent();
    const containerWidth = container.clientWidth;
    const scrollWidth = container.scrollWidth;
    
    // Calculate target scroll position to center playhead
    const targetScrollLeft = (playheadPercent * scrollWidth) - (containerWidth / 2);
    const clampedScrollLeft = Math.max(0, Math.min(targetScrollLeft, scrollWidth - containerWidth));
    
    // Only scroll if position changed significantly
    if (Math.abs(clampedScrollLeft - container.scrollLeft) > 5) {
        container.scrollLeft = clampedScrollLeft;
        lastScrollPosition = clampedScrollLeft;
    }
}

/**
 * Initialize auto-scroll sync feature
 */
export function initAutoScrollSync() {
    // Add UI button to transport bar
    const transportBar = document.getElementById('globalControlsBar');
    if (!transportBar) {
        console.warn('[AutoScrollSync] Transport bar not found');
        return;
    }
    
    // Check if button already exists
    if (document.getElementById('autoScrollToggleBtn')) {
        return; // Already initialized
    }
    
    // Create auto-scroll toggle button
    const btn = document.createElement('button');
    btn.id = 'autoScrollToggleBtn';
    btn.className = 'transport-btn px-2 text-xs bg-gray-600 hover:bg-gray-500';
    btn.textContent = 'Auto-Scroll: Off';
    btn.title = 'Toggle auto-scroll during playback';
    
    btn.addEventListener('click', () => {
        toggleAutoScroll();
    });
    
    // Insert after metronome button if it exists
    const metronomeBtn = document.getElementById('metronomeToggleBtnGlobal');
    if (metronomeBtn && metronomeBtn.parentNode) {
        metronomeBtn.parentNode.insertBefore(btn, metronomeBtn.nextSibling);
    } else {
        transportBar.appendChild(btn);
    }
    
    console.log('[AutoScrollSync] Initialized');
}

/**
 * Clean up auto-scroll sync feature
 */
export function destroyAutoScrollSync() {
    const btn = document.getElementById('autoScrollToggleBtn');
    if (btn && btn.parentNode) {
        btn.parentNode.removeChild(btn);
    }
    autoScrollEnabled = false;
}
