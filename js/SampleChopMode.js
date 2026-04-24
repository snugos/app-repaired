// js/SampleChopMode.js - Sample Chop Mode for SnugOS DAW
// Quick slicer mode for chopping samples with markers

import * as Tone from 'tone';

export class SampleChopMode {
    constructor() {
        this.isActive = false;
        this.audioBuffer = null;
        this.markers = []; // Array of { time, id }
        this.slices = []; // Array of { start, end, id }
        this.gridMode = 'free'; // 'free', 'beat', 'bar', 'transient'
        this.gridDivisions = 16;
        this.currentSliceIndex = -1;
        this.slicePlayers = [];
        this.onChopCallback = null;
        this.onMarkerCallback = null;
        this.waveformData = null;
        this.transients = [];
        this.snapToGrid = true;
        this.fadeTime = 0.005; // 5ms fade
    }

    async loadAudioBuffer(audioBuffer) {
        this.audioBuffer = audioBuffer;
        this.markers = [];
        this.slices = [];
        this.slicePlayers.forEach(p => p.dispose());
        this.slicePlayers = [];
        this.transients = [];
        
        // Extract waveform data for visualization
        await this.extractWaveformData();
        
        // Detect transients if enabled
        if (this.gridMode === 'transient') {
            await this.detectTransients();
        }
        
        return this.audioBuffer;
    }

    async extractWaveformData() {
        if (!this.audioBuffer) return;
        
        const channelData = this.audioBuffer.getChannelData(0);
        const samplesPerPixel = Math.ceil(channelData.length / 1000);
        this.waveformData = [];
        
        for (let i = 0; i < 1000; i++) {
            let max = 0;
            let min = 0;
            const start = i * samplesPerPixel;
            const end = Math.min(start + samplesPerPixel, channelData.length);
            
            for (let j = start; j < end; j++) {
                if (channelData[j] > max) max = channelData[j];
                if (channelData[j] < min) min = channelData[j];
            }
            
            this.waveformData.push({ max, min, time: (start / this.audioBuffer.sampleRate) });
        }
    }

    async detectTransients() {
        if (!this.audioBuffer) return;
        
        const channelData = this.audioBuffer.getChannelData(0);
        const threshold = 0.3;
        const windowSize = 1024;
        this.transients = [];
        
        let prevEnergy = 0;
        
        for (let i = windowSize; i < channelData.length - windowSize; i += windowSize) {
            let energy = 0;
            for (let j = i - windowSize; j < i + windowSize; j++) {
                energy += channelData[j] * channelData[j];
            }
            energy = Math.sqrt(energy / (windowSize * 2));
            
            if (energy > prevEnergy * (1 + threshold)) {
                const time = i / this.audioBuffer.sampleRate;
                this.transients.push(time);
            }
            
            prevEnergy = energy;
        }
        
        // Create markers at transient positions
        if (this.gridMode === 'transient') {
            this.markers = this.transients.map((t, i) => ({ time: t, id: `transient_${i}` }));
        }
    }

    setGridMode(mode) {
        this.gridMode = mode;
        
        if (mode === 'transient' && this.transients.length === 0) {
            this.detectTransients();
        } else if (mode === 'beat' || mode === 'bar') {
            this.autoSlice();
        }
        
        return this.markers;
    }

    setGridDivisions(divisions) {
        this.gridDivisions = Math.max(2, Math.min(64, divisions));
        if (this.gridMode === 'beat') {
            this.autoSlice();
        }
        return this.gridDivisions;
    }

    addMarker(time) {
        if (!this.audioBuffer) return null;
        
        // Clamp time to buffer duration
        time = Math.max(0, Math.min(time, this.audioBuffer.duration));
        
        const id = `marker_${Date.now()}`;
        const marker = { time, id };
        
        // Insert in sorted order
        let insertIndex = this.markers.findIndex(m => m.time > time);
        if (insertIndex === -1) {
            this.markers.push(marker);
        } else {
            this.markers.splice(insertIndex, 0, marker);
        }
        
        if (this.onMarkerCallback) {
            this.onMarkerCallback(marker, 'add');
        }
        
        this.updateSlices();
        return marker;
    }

    removeMarker(id) {
        const index = this.markers.findIndex(m => m.id === id);
        if (index !== -1) {
            const removed = this.markers.splice(index, 1)[0];
            this.updateSlices();
            
            if (this.onMarkerCallback) {
                this.onMarkerCallback(removed, 'remove');
            }
            
            return removed;
        }
        return null;
    }

    moveMarker(id, newTime) {
        const marker = this.markers.find(m => m.id === id);
        if (marker) {
            marker.time = Math.max(0, Math.min(newTime, this.audioBuffer.duration));
            
            // Re-sort markers
            this.markers.sort((a, b) => a.time - b.time);
            this.updateSlices();
            
            if (this.onMarkerCallback) {
                this.onMarkerCallback(marker, 'move');
            }
        }
        return marker;
    }

    autoSlice() {
        if (!this.audioBuffer) return [];
        
        this.markers = [];
        const duration = this.audioBuffer.duration;
        
        if (this.gridMode === 'beat') {
            // Slice at beat divisions
            const sliceDuration = duration / this.gridDivisions;
            for (let i = 0; i < this.gridDivisions; i++) {
                this.markers.push({
                    time: i * sliceDuration,
                    id: `auto_${i}`
                });
            }
        } else if (this.gridMode === 'bar') {
            // Slice at bar boundaries (assuming 4 beats per bar)
            const barsCount = Math.ceil(this.gridDivisions / 4);
            const barDuration = duration / barsCount;
            for (let i = 0; i < barsCount; i++) {
                this.markers.push({
                    time: i * barDuration,
                    id: `bar_${i}`
                });
            }
        }
        
        this.updateSlices();
        return this.markers;
    }

    updateSlices() {
        if (!this.audioBuffer || this.markers.length === 0) {
            this.slices = [];
            return;
        }
        
        this.slices = [];
        const duration = this.audioBuffer.duration;
        
        // Add start marker if not present
        const allMarkers = [{ time: 0, id: 'start' }, ...this.markers];
        
        // Add end marker if not present
        if (allMarkers[allMarkers.length - 1].time < duration - 0.001) {
            allMarkers.push({ time: duration, id: 'end' });
        }
        
        for (let i = 0; i < allMarkers.length - 1; i++) {
            this.slices.push({
                start: allMarkers[i].time,
                end: allMarkers[i + 1].time,
                id: `slice_${i}`,
                duration: allMarkers[i + 1].time - allMarkers[i].time
            });
        }
    }

    async playSlice(sliceIndex, options = {}) {
        if (!this.audioBuffer || sliceIndex < 0 || sliceIndex >= this.slices.length) {
            return false;
        }
        
        const slice = this.slices[sliceIndex];
        const player = new Tone.Player({
            url: this.audioBuffer,
            fadeIn: options.fadeIn ?? this.fadeTime,
            fadeOut: options.fadeOut ?? this.fadeTime,
            loop: options.loop ?? false,
            playbackRate: options.playbackRate ?? 1
        });
        
        player.connect(Tone.Destination);
        this.slicePlayers.push(player);
        
        await player.loaded;
        
        // Calculate offset and duration
        const offset = slice.start;
        const duration = slice.duration / player.playbackRate;
        
        player.start(Tone.now(), offset, duration);
        
        this.currentSliceIndex = sliceIndex;
        
        if (this.onChopCallback) {
            this.onChopCallback(slice, 'play');
        }
        
        // Auto-dispose after playback
        setTimeout(() => {
            player.dispose();
            const idx = this.slicePlayers.indexOf(player);
            if (idx !== -1) this.slicePlayers.splice(idx, 1);
        }, duration * 1000 + 100);
        
        return true;
    }

    playAllSlicesSequential(options = {}) {
        let delay = 0;
        const interval = options.interval ?? 0;
        
        this.slices.forEach((slice, i) => {
            setTimeout(() => {
                this.playSlice(i, options);
            }, delay * 1000);
            delay += slice.duration + interval;
        });
        
        return delay; // Total duration
    }

    async exportSlice(sliceIndex) {
        if (!this.audioBuffer || sliceIndex < 0 || sliceIndex >= this.slices.length) {
            return null;
        }
        
        const slice = this.slices[sliceIndex];
        const sampleRate = this.audioBuffer.sampleRate;
        const startSample = Math.floor(slice.start * sampleRate);
        const endSample = Math.floor(slice.end * sampleRate);
        const numSamples = endSample - startSample;
        
        // Create new buffer for slice
        const offlineContext = new OfflineAudioContext(
            this.audioBuffer.numberOfChannels,
            numSamples,
            sampleRate
        );
        
        const newBuffer = offlineContext.createBuffer(
            this.audioBuffer.numberOfChannels,
            numSamples,
            sampleRate
        );
        
        // Copy slice data
        for (let channel = 0; channel < this.audioBuffer.numberOfChannels; channel++) {
            const sourceData = this.audioBuffer.getChannelData(channel);
            const destData = newBuffer.getChannelData(channel);
            
            for (let i = 0; i < numSamples; i++) {
                // Apply fade in/out
                let sample = sourceData[startSample + i];
                
                // Fade in
                if (i < sampleRate * this.fadeTime) {
                    sample *= i / (sampleRate * this.fadeTime);
                }
                // Fade out
                if (i > numSamples - sampleRate * this.fadeTime) {
                    sample *= (numSamples - i) / (sampleRate * this.fadeTime);
                }
                
                destData[i] = sample;
            }
        }
        
        return newBuffer;
    }

    async exportAllSlices() {
        const exportedSlices = [];
        
        for (let i = 0; i < this.slices.length; i++) {
            const buffer = await this.exportSlice(i);
            if (buffer) {
                exportedSlices.push({
                    buffer,
                    slice: this.slices[i],
                    index: i
                });
            }
        }
        
        return exportedSlices;
    }

    snapMarkerToGrid(time) {
        if (!this.snapToGrid || this.gridMode === 'free') return time;
        
        if (this.gridMode === 'beat') {
            const sliceDuration = this.audioBuffer.duration / this.gridDivisions;
            return Math.round(time / sliceDuration) * sliceDuration;
        }
        
        return time;
    }

    getMarkers() {
        return [...this.markers];
    }

    getSlices() {
        return [...this.slices];
    }

    getWaveformData() {
        return this.waveformData;
    }

    getTransients() {
        return [...this.transients];
    }

    setOnChopCallback(callback) {
        this.onChopCallback = callback;
    }

    setOnMarkerCallback(callback) {
        this.onMarkerCallback = callback;
    }

    setFadeTime(time) {
        this.fadeTime = Math.max(0, time);
        return this.fadeTime;
    }

    setSnapToGrid(enabled) {
        this.snapToGrid = enabled;
    }

    clear() {
        this.audioBuffer = null;
        this.markers = [];
        this.slices = [];
        this.slicePlayers.forEach(p => p.dispose());
        this.slicePlayers = [];
        this.waveformData = null;
        this.transients = [];
        this.currentSliceIndex = -1;
    }

    dispose() {
        this.clear();
        this.onChopCallback = null;
        this.onMarkerCallback = null;
    }
}

// Singleton instance
let sampleChopInstance = null;

export function getSampleChopMode() {
    if (!sampleChopInstance) {
        sampleChopInstance = new SampleChopMode();
    }
    return sampleChopInstance;
}

export function openSampleChopPanel() {
    const chop = getSampleChopMode();
    
    const panel = document.createElement('div');
    panel.id = 'sample-chop-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Sample Chop Mode</h2>
                <button id="close-chop-panel" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="text-zinc-300 text-sm">Grid Mode</label>
                    <select id="chop-grid-mode" class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                        <option value="free">Free</option>
                        <option value="beat">Beat Grid</option>
                        <option value="bar">Bar Grid</option>
                        <option value="transient">Transient Detection</option>
                    </select>
                </div>
                <div>
                    <label class="text-zinc-300 text-sm">Grid Divisions</label>
                    <input type="number" id="chop-divisions" value="${chop.gridDivisions}" min="2" max="64"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
            </div>
            
            <div class="mb-4">
                <label class="flex items-center gap-2 text-zinc-300">
                    <input type="checkbox" id="chop-snap" ${chop.snapToGrid ? 'checked' : ''}>
                    Snap to Grid
                </label>
            </div>
            
            <div id="chop-waveform" class="bg-zinc-800 rounded h-40 mb-4 relative overflow-hidden">
                <div id="chop-waveform-display" class="absolute inset-0"></div>
                <div id="chop-markers-container" class="absolute inset-0"></div>
            </div>
            
            <div class="mb-4">
                <label class="text-zinc-300 text-sm">Fade Time (ms)</label>
                <input type="number" id="chop-fade" value="${chop.fadeTime * 1000}" min="0" max="100"
                    class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
            </div>
            
            <div class="flex gap-4 mb-4">
                <button id="chop-add-marker" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded">
                    Add Marker
                </button>
                <button id="chop-auto-slice" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded">
                    Auto Slice
                </button>
                <button id="chop-clear-markers" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded">
                    Clear Markers
                </button>
            </div>
            
            <div class="mb-4">
                <h3 class="text-white font-medium mb-2">Slices (${chop.slices.length})</h3>
                <div id="chop-slices-list" class="bg-zinc-800 rounded p-2 max-h-40 overflow-auto">
                    ${chop.slices.length === 0 ? '<p class="text-zinc-400 text-sm">No slices yet</p>' : ''}
                </div>
            </div>
            
            <div class="flex gap-4">
                <button id="chop-play-all" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded">
                    Play All Slices
                </button>
                <button id="chop-export-all" class="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded">
                    Export All Slices
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event listeners
    document.getElementById('close-chop-panel').onclick = () => {
        panel.remove();
    };
    
    document.getElementById('chop-grid-mode').onchange = (e) => {
        chop.setGridMode(e.target.value);
        renderSlices();
        renderMarkers();
    };
    
    document.getElementById('chop-divisions').onchange = (e) => {
        chop.setGridDivisions(parseInt(e.target.value));
        renderSlices();
        renderMarkers();
    };
    
    document.getElementById('chop-snap').onchange = (e) => {
        chop.setSnapToGrid(e.target.checked);
    };
    
    document.getElementById('chop-fade').onchange = (e) => {
        chop.setFadeTime(parseInt(e.target.value) / 1000);
    };
    
    document.getElementById('chop-add-marker').onclick = () => {
        const time = Math.random() * (chop.audioBuffer?.duration || 2);
        chop.addMarker(time);
        renderMarkers();
        renderSlices();
    };
    
    document.getElementById('chop-auto-slice').onclick = () => {
        chop.autoSlice();
        renderMarkers();
        renderSlices();
    };
    
    document.getElementById('chop-clear-markers').onclick = () => {
        chop.markers = [];
        chop.updateSlices();
        renderMarkers();
        renderSlices();
    };
    
    document.getElementById('chop-play-all').onclick = () => {
        chop.playAllSlicesSequential({ interval: 0.1 });
    };
    
    document.getElementById('chop-export-all').onclick = async () => {
        const slices = await chop.exportAllSlices();
        console.log('Exported slices:', slices);
    };
    
    // Waveform click to add marker
    document.getElementById('chop-waveform').onclick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = (x / rect.width) * (chop.audioBuffer?.duration || 2);
        chop.addMarker(chop.snapMarkerToGrid(time));
        renderMarkers();
        renderSlices();
    };
    
    function renderMarkers() {
        const container = document.getElementById('chop-markers-container');
        container.innerHTML = chop.markers.map(m => `
            <div class="absolute top-0 bottom-0 w-0.5 bg-yellow-400 cursor-pointer"
                style="left: ${(m.time / (chop.audioBuffer?.duration || 1)) * 100}%"
                data-marker-id="${m.id}"
                title="${m.time.toFixed(3)}s">
            </div>
        `).join('');
        
        // Add drag functionality
        container.querySelectorAll('[data-marker-id]').forEach(el => {
            el.ondblclick = () => {
                chop.removeMarker(el.dataset.markerId);
                renderMarkers();
                renderSlices();
            };
        });
    }
    
    function renderSlices() {
        const list = document.getElementById('chop-slices-list');
        if (chop.slices.length === 0) {
            list.innerHTML = '<p class="text-zinc-400 text-sm">No slices yet</p>';
            return;
        }
        
        list.innerHTML = chop.slices.map((s, i) => `
            <div class="flex justify-between items-center py-1 px-2 hover:bg-zinc-700 rounded cursor-pointer"
                data-slice-index="${i}">
                <span class="text-white">Slice ${i + 1}</span>
                <span class="text-zinc-400 text-sm">${s.start.toFixed(3)}s - ${s.end.toFixed(3)}s</span>
            </div>
        `).join('');
        
        list.querySelectorAll('[data-slice-index]').forEach(el => {
            el.onclick = () => {
                const index = parseInt(el.dataset.sliceIndex);
                chop.playSlice(index);
            };
        });
    }
    
    renderMarkers();
    renderSlices();
    
    return panel;
}