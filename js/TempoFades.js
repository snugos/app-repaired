// js/TempoFades.js - Tempo Fades for SnugOS DAW
// Apply crossfade curves to tempo changes

import { getDAW } from './main.js';
import * as Tone from 'tone';

export class TempoFades {
    constructor() {
        this.fades = []; // Array of { id, startTempo, endTempo, startTime, duration, curve }
        this.isEnabled = true;
        this.defaultCurve = 'linear'; // 'linear', 'exponential', 'ease-in', 'ease-out', 'ease-in-out'
        this.onTempoChangeCallback = null;
        this.isProcessing = false;
        this.currentFadeId = null;
        this.animationFrame = null;
    }

    // Add a tempo fade
    addFade(startTempo, endTempo, startTime, duration, curve = this.defaultCurve) {
        const fade = {
            id: `tempo_fade_${Date.now()}`,
            startTempo,
            endTempo,
            startTime,
            duration,
            curve,
            state: 'pending' // 'pending', 'active', 'completed'
        };
        
        // Sort by start time
        this.fades.push(fade);
        this.fades.sort((a, b) => a.startTime - b.startTime);
        
        return fade;
    }

    // Remove a tempo fade
    removeFade(fadeId) {
        const index = this.fades.findIndex(f => f.id === fadeId);
        if (index !== -1) {
            return this.fades.splice(index, 1)[0];
        }
        return null;
    }

    // Clear all fades
    clearFades() {
        this.fades = [];
    }

    // Get current tempo at time
    getTempoAtTime(time) {
        // Find active fade at this time
        const activeFade = this.fades.find(f => 
            time >= f.startTime && time <= f.startTime + f.duration
        );
        
        if (!activeFade) {
            // No fade at this time, return base tempo
            const daw = getDAW();
            return daw?.bpm || 120;
        }
        
        // Calculate tempo based on curve
        const progress = (time - activeFade.startTime) / activeFade.duration;
        return this.calculateTempo(activeFade, progress);
    }

    // Calculate tempo based on curve
    calculateTempo(fade, progress) {
        const { startTempo, endTempo, curve } = fade;
        const delta = endTempo - startTempo;
        
        switch (curve) {
            case 'linear':
                return startTempo + delta * progress;
            
            case 'exponential':
                // Exponential interpolation
                if (startTempo === 0 || endTempo === 0) {
                    return startTempo + delta * progress;
                }
                const ratio = endTempo / startTempo;
                return startTempo * Math.pow(ratio, progress);
            
            case 'ease-in':
                // Accelerate (slow start, fast end)
                const easeIn = progress * progress;
                return startTempo + delta * easeIn;
            
            case 'ease-out':
                // Decelerate (fast start, slow end)
                const easeOut = 1 - Math.pow(1 - progress, 2);
                return startTempo + delta * easeOut;
            
            case 'ease-in-out':
                // Smooth acceleration and deceleration
                let easeInOut;
                if (progress < 0.5) {
                    easeInOut = 2 * progress * progress;
                } else {
                    easeInOut = 1 - Math.pow(-2 * progress + 2, 2) / 2;
                }
                return startTempo + delta * easeInOut;
            
            case 'sine':
                // Sine wave interpolation
                const sine = (1 - Math.cos(progress * Math.PI)) / 2;
                return startTempo + delta * sine;
            
            case 'bounce':
                // Bounce effect
                const bounce = 1 - Math.abs(Math.cos(progress * Math.PI * 3)) * (1 - progress);
                return startTempo + delta * bounce;
            
            default:
                return startTempo + delta * progress;
        }
    }

    // Start processing fades
    start() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processLoop();
    }

    // Stop processing
    stop() {
        this.isProcessing = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    // Processing loop
    processLoop() {
        if (!this.isProcessing) return;
        
        const daw = getDAW();
        if (!daw) {
            this.animationFrame = requestAnimationFrame(() => this.processLoop());
            return;
        }
        
        const currentTime = Tone.Transport.seconds;
        
        // Find and process active fades
        this.fades.forEach(fade => {
            if (fade.state === 'completed') return;
            
            const fadeEndTime = fade.startTime + fade.duration;
            
            // Check if fade should be active
            if (currentTime >= fade.startTime && currentTime <= fadeEndTime) {
                fade.state = 'active';
                this.currentFadeId = fade.id;
                
                const progress = (currentTime - fade.startTime) / fade.duration;
                const newTempo = this.calculateTempo(fade, progress);
                
                // Update transport tempo
                Tone.Transport.bpm.value = newTempo;
                daw.bpm = newTempo;
                
                // Callback
                if (this.onTempoChangeCallback) {
                    this.onTempoChangeCallback({
                        fade,
                        progress,
                        currentTempo: newTempo
                    });
                }
            } else if (currentTime > fadeEndTime && fade.state === 'active') {
                fade.state = 'completed';
                this.currentFadeId = null;
                
                // Set final tempo
                Tone.Transport.bpm.value = fade.endTempo;
                daw.bpm = fade.endTempo;
            }
        });
        
        this.animationFrame = requestAnimationFrame(() => this.processLoop());
    }

    // Create a ramp from current tempo to target
    rampTo(targetTempo, duration, curve = this.defaultCurve) {
        const daw = getDAW();
        const currentTempo = daw?.bpm || Tone.Transport.bpm.value;
        const startTime = Tone.Transport.seconds;
        
        return this.addFade(currentTempo, targetTempo, startTime, duration, curve);
    }

    // Create a series of tempo changes (tempo envelope)
    createEnvelope(points) {
        // points: [{ tempo, time }, ...]
        this.clearFades();
        
        points.sort((a, b) => a.time - b.time);
        
        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];
            
            this.addFade(
                start.tempo,
                end.tempo,
                start.time,
                end.time - start.time,
                this.defaultCurve
            );
        }
        
        return this.fades;
    }

    // Create a tempo LFO (oscillating tempo)
    createTempoLFO(baseTempo, depth, frequency, startTime, duration) {
        // Calculate number of cycles
        const cycles = frequency * duration;
        const points = [];
        
        for (let i = 0; i <= cycles * 2; i++) {
            const time = startTime + (i / (cycles * 2)) * duration;
            const phase = (i / 2) * Math.PI;
            const tempo = baseTempo + Math.sin(phase) * depth;
            
            points.push({ tempo, time });
        }
        
        return this.createEnvelope(points);
    }

    // Get all fades
    getFades() {
        return [...this.fades];
    }

    // Get active fade
    getActiveFade() {
        return this.fades.find(f => f.state === 'active');
    }

    // Get fade by ID
    getFade(fadeId) {
        return this.fades.find(f => f.id === fadeId);
    }

    // Update fade
    updateFade(fadeId, updates) {
        const fade = this.getFade(fadeId);
        if (!fade) return null;
        
        Object.assign(fade, updates);
        
        // Re-sort if time changed
        if (updates.startTime !== undefined) {
            this.fades.sort((a, b) => a.startTime - b.startTime);
        }
        
        return fade;
    }

    // Settings
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.stop();
        }
    }

    setDefaultCurve(curve) {
        this.defaultCurve = curve;
        return this.defaultCurve;
    }

    setOnTempoChangeCallback(callback) {
        this.onTempoChangeCallback = callback;
    }

    // Preview fade curve
    previewCurve(curve, steps = 100) {
        const points = [];
        
        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const fade = {
                startTempo: 120,
                endTempo: 140,
                curve
            };
            points.push({
                progress,
                tempo: this.calculateTempo(fade, progress)
            });
        }
        
        return points;
    }

    // Export fades for project save
    exportFades() {
        return this.fades.map(f => ({
            id: f.id,
            startTempo: f.startTempo,
            endTempo: f.endTempo,
            startTime: f.startTime,
            duration: f.duration,
            curve: f.curve
        }));
    }

    // Import fades from project load
    importFades(fadesData) {
        this.clearFades();
        fadesData.forEach(data => {
            this.addFade(data.startTempo, data.endTempo, data.startTime, data.duration, data.curve);
        });
        return this.fades;
    }

    dispose() {
        this.stop();
        this.fades = [];
        this.onTempoChangeCallback = null;
    }
}

// Singleton instance
let tempoFadesInstance = null;

export function getTempoFades() {
    if (!tempoFadesInstance) {
        tempoFadesInstance = new TempoFades();
    }
    return tempoFadesInstance;
}

export function openTempoFadesPanel() {
    const fades = getTempoFades();
    
    const panel = document.createElement('div');
    panel.id = 'tempo-fades-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-lg p-6 w-full max-w-2xl">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Tempo Fades</h2>
                <button id="close-tempo-fades-panel" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="mb-4">
                <label class="flex items-center gap-2 text-zinc-300">
                    <input type="checkbox" id="fades-enabled" ${fades.isEnabled ? 'checked' : ''}>
                    Enable Tempo Fades
                </label>
            </div>
            
            <div class="grid grid-cols-4 gap-4 mb-4">
                <div>
                    <label class="text-zinc-300 text-sm">Start BPM</label>
                    <input type="number" id="fade-start-tempo" value="120" min="20" max="300"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
                <div>
                    <label class="text-zinc-300 text-sm">End BPM</label>
                    <input type="number" id="fade-end-tempo" value="140" min="20" max="300"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
                <div>
                    <label class="text-zinc-300 text-sm">Duration (s)</label>
                    <input type="number" id="fade-duration" value="4" min="0.1" max="60" step="0.1"
                        class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                </div>
                <div>
                    <label class="text-zinc-300 text-sm">Curve</label>
                    <select id="fade-curve" class="w-full bg-zinc-800 text-white rounded px-3 py-2 mt-1">
                        <option value="linear">Linear</option>
                        <option value="exponential">Exponential</option>
                        <option value="ease-in">Ease In</option>
                        <option value="ease-out">Ease Out</option>
                        <option value="ease-in-out">Ease In/Out</option>
                        <option value="sine">Sine</option>
                        <option value="bounce">Bounce</option>
                    </select>
                </div>
            </div>
            
            <div class="mb-4">
                <button id="add-fade-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded">
                    Add Fade
                </button>
                <button id="ramp-to-btn" class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded ml-2">
                    Ramp to Target
                </button>
                <button id="clear-fades-btn" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded ml-2">
                    Clear All
                </button>
            </div>
            
            <div class="mb-4">
                <h3 class="text-white font-medium mb-2">Active Fades (${fades.fades.length})</h3>
                <div id="fades-list" class="bg-zinc-800 rounded p-2 max-h-40 overflow-auto">
                    ${fades.fades.length === 0 ? '<p class="text-zinc-400 text-sm">No tempo fades defined</p>' : ''}
                </div>
            </div>
            
            <div class="mb-4">
                <h3 class="text-white font-medium mb-2">Curve Preview</h3>
                <div class="bg-zinc-800 rounded h-24 relative overflow-hidden">
                    <canvas id="curve-preview" width="600" height="96" class="w-full h-full"></canvas>
                </div>
            </div>
            
            <div class="flex gap-4">
                <button id="start-processing-btn" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded">
                    Start Processing
                </button>
                <button id="stop-processing-btn" class="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white rounded">
                    Stop
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    const canvas = document.getElementById('curve-preview');
    const ctx = canvas.getContext('2d');
    
    // Event listeners
    document.getElementById('close-tempo-fades-panel').onclick = () => {
        fades.stop();
        panel.remove();
    };
    
    document.getElementById('fades-enabled').onchange = (e) => {
        fades.setEnabled(e.target.checked);
    };
    
    document.getElementById('fade-curve').onchange = (e) => {
        drawCurvePreview(e.target.value);
    };
    
    document.getElementById('add-fade-btn').onclick = () => {
        const startTempo = parseFloat(document.getElementById('fade-start-tempo').value);
        const endTempo = parseFloat(document.getElementById('fade-end-tempo').value);
        const duration = parseFloat(document.getElementById('fade-duration').value);
        const curve = document.getElementById('fade-curve').value;
        
        const daw = getDAW();
        const startTime = daw?.transportTime || Tone.Transport.seconds;
        
        fades.addFade(startTempo, endTempo, startTime, duration, curve);
        updateFadesList();
    };
    
    document.getElementById('ramp-to-btn').onclick = () => {
        const endTempo = parseFloat(document.getElementById('fade-end-tempo').value);
        const duration = parseFloat(document.getElementById('fade-duration').value);
        const curve = document.getElementById('fade-curve').value;
        
        fades.rampTo(endTempo, duration, curve);
        updateFadesList();
    };
    
    document.getElementById('clear-fades-btn').onclick = () => {
        fades.clearFades();
        updateFadesList();
    };
    
    document.getElementById('start-processing-btn').onclick = () => {
        fades.start();
    };
    
    document.getElementById('stop-processing-btn').onclick = () => {
        fades.stop();
    };
    
    function updateFadesList() {
        const list = document.getElementById('fades-list');
        
        if (fades.fades.length === 0) {
            list.innerHTML = '<p class="text-zinc-400 text-sm">No tempo fades defined</p>';
            return;
        }
        
        list.innerHTML = fades.fades.map(f => `
            <div class="flex justify-between items-center py-1 px-2 hover:bg-zinc-700 rounded">
                <span class="text-white">${f.startTempo} → ${f.endTempo} BPM</span>
                <span class="text-zinc-400 text-sm">${f.curve} @ ${f.startTime.toFixed(2)}s</span>
                <button class="text-red-400 hover:text-red-300 text-sm" data-fade-id="${f.id}">Remove</button>
            </div>
        `).join('');
        
        list.querySelectorAll('[data-fade-id]').forEach(btn => {
            btn.onclick = () => {
                fades.removeFade(btn.dataset.fadeId);
                updateFadesList();
            };
        });
    }
    
    function drawCurvePreview(curve) {
        const points = fades.previewCurve(curve);
        
        // Clear
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#3f3f46';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * canvas.height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        // Draw curve
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const minTempo = 120;
        const maxTempo = 140;
        
        points.forEach((point, i) => {
            const x = point.progress * canvas.width;
            const y = canvas.height - ((point.tempo - minTempo) / (maxTempo - minTempo)) * canvas.height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${minTempo}`, 5, canvas.height - 5);
        ctx.fillText(`${maxTempo}`, 5, 15);
    }
    
    updateFadesList();
    drawCurvePreview('linear');
    
    return panel;
}