// Track Delay Compensation - Automatically compensate for plugin latency per track
const TrackDelayCompensation = {
    latencyMap: new Map(), // trackId -> latency in ms
    
    // Analyze track and estimate plugin latency
    analyzeTrackLatency: (track) => {
        if (!track || !track.effects) return 0;
        
        let totalLatency = 0;
        const bufferSize = 2048; // Typical buffer size
        const sampleRate = 44100; // Typical sample rate
        
        track.effects.forEach(effect => {
            // Each effect plugin may introduce latency
            if (effect && effect.bufferSize) {
                totalLatency += (effect.bufferSize / sampleRate) * 1000;
            } else if (effect && effect.latency !== undefined) {
                totalLatency += effect.latency;
            } else if (effect && effect.type === 'Convolver') {
                // Reverb typically has significant latency
                totalLatency += 50;
            } else if (effect && effect.type === 'Delay') {
                // Delay effect
                totalLatency += 10;
            }
        });
        
        return totalLatency;
    },
    
    // Set manual latency compensation for a track
    setTrackLatency: (trackId, latencyMs) => {
        TrackDelayCompensation.latencyMap.set(trackId, latencyMs);
        TrackDelayCompensation.applyCompensation(trackId);
    },
    
    // Get total latency for a track
    getTrackLatency: (trackId) => {
        return TrackDelayCompensation.latencyMap.get(trackId) || 0;
    },
    
    // Apply compensation by adjusting track audio offset
    applyCompensation: (trackId) => {
        const track = getTrackState(trackId);
        if (!track) return;
        
        const latencyMs = TrackDelayCompensation.getTrackLatency(trackId);
        if (latencyMs > 0 && track.audioNode) {
            // Negative delay to compensate (push audio earlier)
            const delaySeconds = -(latencyMs / 1000);
            if (track.audioNode.delayNode) {
                track.audioNode.delayNode.delayTime.value = Math.max(0, delaySeconds);
            }
        }
    },
    
    // Auto-detect and compensate all tracks
    autoCompensateAll: () => {
        const tracks = getTracksState();
        if (!tracks) return;
        
        tracks.forEach(track => {
            if (track && track.id) {
                const latency = TrackDelayCompensation.analyzeTrackLatency(track);
                if (latency > 0) {
                    TrackDelayCompensation.setTrackLatency(track.id, latency);
                }
            }
        });
    },
    
    // Get summary of all track latencies
    getLatencySummary: () => {
        const summary = [];
        TrackDelayCompensation.latencyMap.forEach((latency, trackId) => {
            summary.push({ trackId, latencyMs: latency });
        });
        return summary;
    },
    
    // Reset compensation for a track
    resetCompensation: (trackId) => {
        TrackDelayCompensation.latencyMap.delete(trackId);
        const track = getTrackState(trackId);
        if (track && track.audioNode && track.audioNode.delayNode) {
            track.audioNode.delayNode.delayTime.value = 0;
        }
    },
    
    // Open compensation panel
    openCompensationPanel: () => {
        const panel = document.getElementById('delayCompensationPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            if (panel.style.display === 'block') {
                TrackDelayCompensation.updatePanel();
            }
        }
    },
    
    // Update panel display
    updatePanel: () => {
        const content = document.getElementById('delayCompensationContent');
        if (!content) return;
        
        const summary = TrackDelayCompensation.getLatencySummary();
        if (summary.length === 0) {
            content.innerHTML = '<p>No track latency data. Click "Auto-Detect" to analyze tracks.</p>';
            return;
        }
        
        let html = '<table style="width:100%"><tr><th>Track</th><th>Latency (ms)</th><th>Action</th></tr>';
        summary.forEach(entry => {
            const track = getTrackState(entry.trackId);
            const trackName = track ? track.name : entry.trackId;
            html += `<tr>
                <td>${trackName}</td>
                <td>${entry.latencyMs.toFixed(2)}</td>
                <td><button onclick="TrackDelayCompensation.resetCompensation('${entry.trackId}')">Reset</button></td>
            </tr>`;
        });
        html += '</table>';
        content.innerHTML = html;
    }
};

// Make globally accessible
window.TrackDelayCompensation = TrackDelayCompensation;