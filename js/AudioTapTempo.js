/**
 * Audio Tap Tempo - Tap to set project tempo from audio input timing
 * Detects rhythmic taps via click/keyboard and calculates BPM
 */

let localAppServices = {};
let tapTimes = [];
let lastTapTime = 0;
let tapTimeout = null;
const MAX_TAP_AGE = 3000; // ms - resets if no tap within this time
const MAX_TAPS = 16; // max taps to average
const MIN_BPM = 20;
const MAX_BPM = 300;

export function initAudioTapTempo(appServices) {
    localAppServices = appServices || {};
    console.log('[AudioTapTempo] Initialized');
}

export function getTapTempoBPM() {
    if (tapTimes.length < 2) return null;
    
    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) {
        intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avgInterval <= 0) return null;
    
    let bpm = Math.round((60000 / avgInterval) * 100) / 100;
    bpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
    return bpm;
}

export function handleTap() {
    const now = Date.now();
    
    if (tapTimeout) {
        clearTimeout(tapTimeout);
        tapTimeout = null;
    }
    
    if (tapTimes.length > 0 && (now - lastTapTime) > MAX_TAP_AGE) {
        tapTimes = [];
    }
    
    tapTimes.push(now);
    if (tapTimes.length > MAX_TAPS) {
        tapTimes.shift();
    }
    
    lastTapTime = now;
    
    tapTimeout = setTimeout(() => {
        tapTimes = [];
        tapTimeout = null;
    }, MAX_TAP_AGE + 500);
    
    const bpm = getTapTempoBPM();
    
    if (bpm !== null) {
        if (localAppServices.setTempo) {
            localAppServices.setTempo(bpm);
        }
        if (localAppServices.showNotification) {
            localAppServices.showNotification(`Tap Tempo: ${bpm.toFixed(1)} BPM`, 'info');
        }
    }
    
    return bpm;
}

export function resetTapTempo() {
    tapTimes = [];
    lastTapTime = 0;
    if (tapTimeout) {
        clearTimeout(tapTimeout);
        tapTimeout = null;
    }
}

export function getTapCount() {
    return tapTimes.length;
}