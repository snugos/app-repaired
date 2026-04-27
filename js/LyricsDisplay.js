// LyricsDisplay.js - Lyrics synced to playback with word-by-word highlighting
class LyricsDisplay {
    constructor() {
        this.lyrics = [];
        this.currentIndex = -1;
        this.panel = null;
        this.isVisible = false;
    }

    setLyrics(lyricsText) {
        this.lyrics = lyricsText.split('\n').filter(line => line.trim());
        this.currentIndex = -1;
        if (this.isVisible) this.render();
    }

    syncToPlayback(currentTime) {
        const beatLength = 60 / (window.currentBPM || 120);
        const beatIndex = Math.floor(currentTime / beatLength);
        const newIndex = this.lyrics.findIndex((line, i) => {
            const parts = line.match(/\[(\d+)\]/);
            return parts && parseInt(parts[1]) === beatIndex;
        });
        if (newIndex !== -1 && newIndex !== this.currentIndex) {
            this.currentIndex = newIndex;
            this.highlightLine(newIndex);
        }
    }

    highlightLine(index) {
        if (!this.panel) return;
        const lines = this.panel.querySelectorAll('.lyrics-line');
        lines.forEach((line, i) => {
            line.classList.toggle('lyrics-active', i === index);
        });
    }

    openPanel() {
        if (this.panel) {
            this.panel.style.display = 'block';
            this.isVisible = true;
            return;
        }
        this.panel = document.createElement('div');
        this.panel.id = 'lyrics-panel';
        this.panel.innerHTML = `
            <div class="snug-window-titlebar">
                <span>🎤 Lyrics</span>
                <button class="snug-window-close" onclick="lyricsDisplay.closePanel()">×</button>
            </div>
            <div class="lyrics-content"></div>
            <div class="lyrics-controls">
                <textarea placeholder="Enter lyrics with [beat] markers&#10;Example: [0] Hello [4] World [8]!" rows="3"></textarea>
                <button onclick="lyricsDisplay.loadFromTextarea()">Load</button>
            </div>
        `;
        this.panel.style.cssText = 'position:fixed;bottom:60px;right:20px;width:320px;background:#1a1a2e;border:1px solid #333;border-radius:8px;z-index:10001;font-family:system-ui;';
        document.body.appendChild(this.panel);
        this.isVisible = true;
        this.render();
    }

    loadFromTextarea() {
        const textarea = this.panel.querySelector('textarea');
        if (textarea) this.setLyrics(textarea.value);
    }

    closePanel() {
        if (this.panel) {
            this.panel.style.display = 'none';
            this.isVisible = false;
        }
    }

    render() {
        if (!this.panel) return;
        const content = this.panel.querySelector('.lyrics-content');
        if (!content) return;
        content.innerHTML = this.lyrics.map((line, i) =>
            `<div class="lyrics-line ${i === this.currentIndex ? 'lyrics-active' : ''}">${line.replace(/\[\d+\]/g, '')}</div>`
        ).join('');
    }
}

window.lyricsDisplay = new LyricsDisplay();

// Auto-sync to playback via animation frame
let lyricsRAF = null;
function updateLyricsSync() {
    if (window.Tone && window.Tone.Transport) {
        window.lyricsDisplay.syncToPlayback(window.Tone.Transport.seconds);
    }
    lyricsRAF = requestAnimationFrame(updateLyricsSync);
}
updateLyricsSync();
