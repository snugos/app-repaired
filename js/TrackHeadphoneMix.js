// js/TrackHeadphoneMix.js - Track Headphone Preview Mix Module

import * as Constants from './constants.js';

let localAppServices = {};
let headphoneMixGainNode = null;
let headphoneAnalyserNode = null;
let headphoneMeterNode = null;
let headphoneEnabled = false;

// Per-track headphone send levels: Map<trackId, { level: number, enabled: boolean }>
const trackHeadphoneSends = new Map();

/**
 * Initialize the headphone mix system.
 * @param {Object} services - App services from main.js
 */
export function initTrackHeadphoneMix(services) {
    localAppServices = services || {};
    console.log('[TrackHeadphoneMix] Initialized.');
}

/**
 * Sets up the headphone mix output chain.
 * Creates a separate gain node for headphone output distinct from master output.
 */
function setupHeadphoneMixChain() {
    if (headphoneMixGainNode && !headphoneMixGainNode.disposed) return;
    
    try {
        // Create headphone mix gain node
        headphoneMixGainNode = new Tone.Gain(0.8);
        
        // Create meter and analyser for visualization
        headphoneMeterNode = new Tone.Meter({ smoothing: 0.8 });
        headphoneAnalyserNode = new Tone.Analyser('fft', 128);
        
        // Connect chain: headphoneMixGain -> meter -> analyser -> destination
        headphoneMixGainNode.connect(headphoneMeterNode);
        headphoneMixGainNode.connect(headphoneAnalyserNode);
        headphoneMixGainNode.connect(Tone.Destination);
        
        console.log('[TrackHeadphoneMix] Headphone mix chain created.');
    } catch (e) {
        console.error('[TrackHeadphoneMix] Error setting up headphone chain:', e);
    }
}

/**
 * Enable or disable the headphone mix output.
 * @param {boolean} enabled - True to enable headphone mix
 */
export function setHeadphoneMixEnabled(enabled) {
    headphoneEnabled = !!enabled;
    
    if (headphoneEnabled) {
        setupHeadphoneMixChain();
        
        // Re-route tracks with headphone sends
        trackHeadphoneSends.forEach((sendData, trackId) => {
            if (sendData.enabled && sendData.level > 0) {
                routeTrackToHeadphoneMix(trackId, true);
            }
        });
        
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Headphone mix enabled', 1500);
        }
    } else {
        // Remove headphone routing from all tracks
        trackHeadphoneSends.forEach((sendData, trackId) => {
            routeTrackToHeadphoneMix(trackId, false);
        });
        
        if (localAppServices.showNotification) {
            localAppServices.showNotification('Headphone mix disabled', 1500);
        }
    }
    
    console.log('[TrackHeadphoneMix] Headphone mix:', headphoneEnabled ? 'enabled' : 'disabled');
}

/**
 * Check if headphone mix is enabled.
 * @returns {boolean}
 */
export function isHeadphoneMixEnabled() {
    return headphoneEnabled;
}

/**
 * Route a track's audio to/from the headphone mix.
 * @param {number} trackId - The track ID
 * @param {boolean} connect - True to connect, false to disconnect
 */
function routeTrackToHeadphoneMix(trackId, connect) {
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.gainNode || track.gainNode.disposed) return;
    
    if (!headphoneMixGainNode || headphoneMixGainNode.disposed) {
        setupHeadphoneMixChain();
    }
    
    if (connect && headphoneMixGainNode) {
        // Connect track to headphone mix via a send gain node
        if (!track.headphoneSendNode || track.headphoneSendNode.disposed) {
            track.headphoneSendNode = new Tone.Gain(0.5);
        }
        track.gainNode.connect(track.headphoneSendNode);
        track.headphoneSendNode.connect(headphoneMixGainNode);
        console.log(`[TrackHeadphoneMix] Track ${trackId} routed to headphone mix`);
    } else if (track.headphoneSendNode && !track.headphoneSendNode.disposed) {
        track.headphoneSendNode.disconnect();
        track.headphoneSendNode.dispose();
        track.headphoneSendNode = null;
        console.log(`[TrackHeadphoneMix] Track ${trackId} removed from headphone mix`);
    }
}

/**
 * Set the headphone send level for a track.
 * @param {number} trackId - The track ID
 * @param {number} level - Send level (0-1)
 */
export function setTrackHeadphoneSendLevel(trackId, level) {
    const normalizedLevel = Math.max(0, Math.min(1, parseFloat(level) || 0));
    
    let sendData = trackHeadphoneSends.get(trackId) || { level: 0, enabled: false };
    sendData.level = normalizedLevel;
    trackHeadphoneSends.set(trackId, sendData);
    
    // Update the actual send node if it exists
    const tracks = localAppServices.getTracks?.() || [];
    const track = tracks.find(t => t.id === trackId);
    if (track?.headphoneSendNode && !track.headphoneSendNode.disposed) {
        track.headphoneSendNode.gain.value = normalizedLevel;
    }
    
    console.log(`[TrackHeadphoneMix] Track ${trackId} headphone level: ${normalizedLevel}`);
}

/**
 * Get the headphone send level for a track.
 * @param {number} trackId - The track ID
 * @returns {number} Send level (0-1), default 0
 */
export function getTrackHeadphoneSendLevel(trackId) {
    const sendData = trackHeadphoneSends.get(trackId);
    return sendData?.level ?? 0;
}

/**
 * Enable or disable a track's headphone send.
 * @param {number} trackId - The track ID
 * @param {boolean} enabled - True to enable the send
 */
export function setTrackHeadphoneSendEnabled(trackId, enabled) {
    let sendData = trackHeadphoneSends.get(trackId) || { level: 0, enabled: false };
    sendData.enabled = !!enabled;
    trackHeadphoneSends.set(trackId, sendData);
    
    if (headphoneEnabled) {
        routeTrackToHeadphoneMix(trackId, enabled && sendData.level > 0);
    }
    
    console.log(`[TrackHeadphoneMix] Track ${trackId} headphone send ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Check if a track's headphone send is enabled.
 * @param {number} trackId - The track ID
 * @returns {boolean}
 */
export function isTrackHeadphoneSendEnabled(trackId) {
    const sendData = trackHeadphoneSends.get(trackId);
    return sendData?.enabled ?? false;
}

/**
 * Get the headphone mix master volume.
 * @returns {number}
 */
export function getHeadphoneMixVolume() {
    if (!headphoneMixGainNode || headphoneMixGainNode.disposed) return 0.8;
    return headphoneMixGainNode.gain.value;
}

/**
 * Set the headphone mix master volume.
 * @param {number} volume - Volume level (0-1)
 */
export function setHeadphoneMixVolume(volume) {
    const normalizedVolume = Math.max(0, Math.min(1, parseFloat(volume) || 0.8));
    
    if (headphoneMixGainNode && !headphoneMixGainNode.disposed) {
        headphoneMixGainNode.gain.value = normalizedVolume;
    }
    
    console.log(`[TrackHeadphoneMix] Headphone mix volume: ${normalizedVolume}`);
}

/**
 * Get the headphone mix meter value.
 * @returns {number} Current level in dB
 */
export function getHeadphoneMixMeter() {
    if (!headphoneMeterNode || headphoneMeterNode.disposed) return -60;
    return headphoneMeterNode.getValue();
}

/**
 * Get the headphone mix frequency data for visualization.
 * @returns {Float32Array|null}
 */
export function getHeadphoneMixFrequencyData() {
    if (!headphoneAnalyserNode || headphoneAnalyserNode.disposed) return null;
    return headphoneAnalyserNode.getValue();
}

/**
 * Get all tracks with their headphone send data.
 * @returns {Array<{trackId: number, trackName: string, level: number, enabled: boolean}>}
 */
export function getTrackHeadphoneSendsInfo() {
    const tracks = localAppServices.getTracks?.() || [];
    const result = [];
    
    tracks.forEach(track => {
        const sendData = trackHeadphoneSends.get(track.id) || { level: 0, enabled: false };
        result.push({
            trackId: track.id,
            trackName: track.name,
            level: sendData.level,
            enabled: sendData.enabled
        });
    });
    
    return result;
}

/**
 * Clear all headphone sends (reset).
 */
export function clearAllHeadphoneSends() {
    trackHeadphoneSends.forEach((sendData, trackId) => {
        routeTrackToHeadphoneMix(trackId, false);
    });
    trackHeadphoneSends.clear();
    console.log('[TrackHeadphoneMix] All headphone sends cleared');
}

/**
 * Cleanup and dispose resources.
 */
export function disposeTrackHeadphoneMix() {
    clearAllHeadphoneSends();
    
    if (headphoneMixGainNode && !headphoneMixGainNode.disposed) {
        headphoneMixGainNode.dispose();
        headphoneMixGainNode = null;
    }
    if (headphoneMeterNode && !headphoneMeterNode.disposed) {
        headphoneMeterNode.dispose();
        headphoneMeterNode = null;
    }
    if (headphoneAnalyserNode && !headphoneAnalyserNode.disposed) {
        headphoneAnalyserNode.dispose();
        headphoneAnalyserNode = null;
    }
    
    console.log('[TrackHeadphoneMix] Disposed');
}