// js/GranularSynthEngine.js - Granular Synthesis Engine
// Creates textures from audio via tiny overlapping grains

export class GranularSynthEngine {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.grains = [];
        this.isPlaying = false;
        this.sourceBuffer = null;
        this.position = 0; // 0-1, position in buffer
        this.density = 20; // grains per second
        this.pitch = 0; // semitones up/down
        this.grainSize = 0.1; // seconds
        this.spray = 0.2; // random offset range (0-1)
        this.outputGain = null;
        this.scheduler = null;
        this.nextGrainTime = 0;
    }

    setSource(buffer) {
        this.sourceBuffer = buffer;
    }

    setPosition(val) { this.position = Math.max(0, Math.min(1, val)); }
    setDensity(val) { this.density = Math.max(1, Math.min(100, val)); }
    setPitch(val) { this.pitch = Math.max(-24, Math.min(24, val)); }
    setGrainSize(val) { this.grainSize = Math.max(0.01, Math.min(1, val)); }
    setSpray(val) { this.spray = Math.max(0, Math.min(1, val)); }

    play() {
        if (!this.sourceBuffer || this.isPlaying) return;
        this.isPlaying = true;
        this.nextGrainTime = this.audioContext.currentTime;
        this.scheduleGrains();
    }

    stop() {
        this.isPlaying = false;
        if (this.scheduler) clearTimeout(this.scheduler);
        this.grains.forEach(g => { try { g.source.stop(); } catch(e){} });
        this.grains = [];
    }

    scheduleGrains() {
        if (!this.isPlaying) return;
        const now = this.audioContext.currentTime;
        const interval = 1 / this.density;

        while (this.nextGrainTime < now + 0.1) {
            this.triggerGrain(this.nextGrainTime);
            this.nextGrainTime += interval;
        }

        this.scheduler = setTimeout(() => this.scheduleGrains(), 50);
    }

    triggerGrain(time) {
        if (!this.sourceBuffer) return;
        const sprayOffset = (Math.random() - 0.5) * this.spray;
        const pos = Math.max(0, Math.min(1, this.position + sprayOffset));
        const startSample = Math.floor(pos * this.sourceBuffer.length);
        const grainSamples = Math.floor(this.grainSize * this.sourceBuffer.sampleRate);
        const dur = grainSamples / this.sourceBuffer.sampleRate;

        // Pitch shift via playback rate
        const rate = Math.pow(2, this.pitch / 12);

        const source = this.audioContext.createBufferSource();
        source.buffer = this.sourceBuffer;
        source.playbackRate.value = rate;

        const grainGain = this.audioContext.createGain();
        grainGain.gain.value = 0.3;

        // Envelope for smooth grain attack/release
        const attack = 0.005, release = 0.02;
        const env = this.audioContext.createGain();
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(1, time + attack);
        env.gain.setValueAtTime(1, time + dur - release);
        env.gain.linearRampToValueAtTime(0, time + dur);

        source.connect(env);
        env.connect(grainGain);
        grainGain.connect(this.outputGain || this.audioContext.destination);

        const offset = Math.max(0, startSample / this.sourceBuffer.sampleRate);
        source.start(time, offset, dur);
        source.onended = () => {
            const idx = this.grains.indexOf(source);
            if (idx > -1) this.grains.splice(idx, 1);
        };
        this.grains.push(source);
    }

    connect(dest) {
        this.outputGain = dest;
    }

    getState() {
        return {
            position: this.position,
            density: this.density,
            pitch: this.pitch,
            grainSize: this.grainSize,
            spray: this.spray,
            isPlaying: this.isPlaying
        };
    }
}

let engineInstance = null;

export function initGranularSynthEngine(audioContext) {
    engineInstance = new GranularSynthEngine(audioContext);
    return engineInstance;
}

export function getGranularEngine() {
    return engineInstance;
}

export function openGranularSynthPanel() {
    const existing = document.getElementById('granular-panel');
    if (existing) { existing.remove(); return; }

    const panel = document.createElement('div');
    panel.id = 'granular-panel';
    panel.style.cssText = `
        position: fixed; top: 80px; right: 20px; width: 280px;
        background: #1a1a2e; border: 1px solid #0f0f23; border-radius: 8px;
        padding: 16px; z-index: 1000; color: #a0a0c0; font-size: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="color:#fff;font-weight:600">Granular Synth</span>
            <button onclick="document.getElementById('granular-panel').remove()" style="background:none;border:none;color:#666;cursor:pointer;font-size:16px">×</button>
        </div>
        <div style="margin-bottom:10px">
            <label style="display:block;margin-bottom:4px">Source</label>
            <input type="file" id="granular-file" accept="audio/*" style="width:100%;background:#0d0d1a;border:1px solid #333;color:#a0a0c0;border-radius:4px;padding:4px">
        </div>
        <div style="margin-bottom:10px">
            <label style="display:block;margin-bottom:4px">Position <span id="gr-pos-val">0%</span></label>
            <input type="range" id="gr-position" min="0" max="100" value="0" style="width:100%">
        </div>
        <div style="margin-bottom:10px">
            <label style="display:block;margin-bottom:4px">Density <span id="gr-den-val">20</span>/s</label>
            <input type="range" id="gr-density" min="1" max="100" value="20" style="width:100%">
        </div>
        <div style="margin-bottom:10px">
            <label style="display:block;margin-bottom:4px">Pitch <span id="gr-pit-val">0</span>st</label>
            <input type="range" id="gr-pitch" min="-24" max="24" value="0" style="width:100%">
        </div>
        <div style="margin-bottom:10px">
            <label style="display:block;margin-bottom:4px">Grain Size <span id="gr-size-val">100</span>ms</label>
            <input type="range" id="gr-grain" min="1" max="500" value="100" style="width:100%">
        </div>
        <div style="margin-bottom:10px">
            <label style="display:block;margin-bottom:4px">Spray <span id="gr-spr-val">20</span>%</label>
            <input type="range" id="gr-spray" min="0" max="100" value="20" style="width:100%">
        </div>
        <div style="display:flex;gap:8px">
            <button id="gr-play" style="flex:1;padding:8px;background:#4a4a8a;color:#fff;border:none;border-radius:4px;cursor:pointer">Play</button>
            <button id="gr-stop" style="flex:1;padding:8px;background:#8a4a4a;color:#fff;border:none;border-radius:4px;cursor:pointer">Stop</button>
        </div>
    `;
    document.body.appendChild(panel);

    const eng = getGranularEngine();
    if (!eng) return;

    const posSlider = document.getElementById('gr-position');
    const denSlider = document.getElementById('gr-density');
    const pitSlider = document.getElementById('gr-pitch');
    const grainSlider = document.getElementById('gr-grain');
    const spraySlider = document.getElementById('gr-spray');

    posSlider.oninput = () => {
        eng.setPosition(posSlider.value / 100);
        document.getElementById('gr-pos-val').textContent = posSlider.value + '%';
    };
    denSlider.oninput = () => {
        eng.setDensity(denSlider.value);
        document.getElementById('gr-den-val').textContent = denSlider.value;
    };
    pitSlider.oninput = () => {
        eng.setPitch(parseInt(pitSlider.value));
        document.getElementById('gr-pit-val').textContent = pitSlider.value;
    };
    grainSlider.oninput = () => {
        eng.setGrainSize(grainSlider.value / 1000);
        document.getElementById('gr-size-val').textContent = grainSlider.value;
    };
    spraySlider.oninput = () => {
        eng.setSpray(spraySlider.value / 100);
        document.getElementById('gr-spr-val').textContent = spraySlider.value;
    };

    document.getElementById('gr-play').onclick = () => eng.play();
    document.getElementById('gr-stop').onclick = () => eng.stop();

    document.getElementById('granular-file').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const buf = await file.arrayBuffer();
        const audioBuf = await eng.audioContext.decodeAudioData(buf);
        eng.setSource(audioBuf);
    };
}