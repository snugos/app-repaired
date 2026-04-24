// js/AudioSpectrogram.js - Real-time spectrogram visualization for tracks
export class AudioSpectrogram {
    constructor(canvasElement, audioSource) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.audioSource = audioSource;
        this.analyser = null;
        this.running = false;
        this.dataArray = null;
        this.frequencyData = null;
    }

    initialize(audioContext) {
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.dataArray = new Uint8Array(this.analyser.fftSize);
    }

    connect(audioNode) {
        if (!this.analyser) return;
        audioNode.connect(this.analyser);
    }

    start() {
        this.running = true;
        this.draw();
    }

    stop() {
        this.running = false;
    }

    draw() {
        if (!this.running) return;

        if (this.analyser) {
            this.analyser.getByteFrequencyData(this.frequencyData);
        }

        requestAnimationFrame(() => this.draw());
    }

    setColorMap(map) {
        // map: 'fire', 'ocean', 'grayscale'
        this.colorMap = map || 'fire';
    }
}

export function createSpectrogram(canvasElement, audioSource) {
    return new AudioSpectrogram(canvasElement, audioSource);
}