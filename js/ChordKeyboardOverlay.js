/**
 * ChordKeyboardOverlay.js
 * Displays a virtual piano keyboard overlay showing chord fingerings.
 * Helps musicians see which keys to play for detected/selected chords.
 */

class ChordKeyboardOverlay {
    constructor() {
        this.overlay = null;
        this.isVisible = false;
        this.currentChord = null;
        this.keyWidth = 36;
        this.keyHeight = 120;
        this.whiteKeyCount = 14; // Two octaves
        this.activeKeys = new Set();
        this.buildOverlay();
    }

    buildOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'chord-keyboard-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(15, 15, 20, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px;
            z-index: 10000;
            display: none;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            font-family: 'Inter', system-ui, sans-serif;
        `;

        this.overlay.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #fff; font-size: 13px; font-weight: 600;">Chord Keyboard</span>
                <button id="cko-close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 18px; padding: 0 4px;">×</button>
            </div>
            <div id="cko-chord-name" style="color: #4fc3f7; font-size: 20px; font-weight: 700; margin-bottom: 8px; text-align: center;">—</div>
            <div id="cko-keys" style="position: relative; width: ${this.keyWidth * this.whiteKeyCount}px; height: ${this.keyHeight}px;"></div>
            <div id="cko-notes" style="color: #aaa; font-size: 11px; margin-top: 6px; text-align: center;">—</div>
        `;

        document.body.appendChild(this.overlay);

        document.getElementById('cko-close').addEventListener('click', () => this.hide());

        this.renderKeys();
    }

    renderKeys() {
        const keysContainer = document.getElementById('cko-keys');
        keysContainer.innerHTML = '';

        // Note: C D E F G A B (white keys) and C# D# F# G# A# (black keys)
        const whiteNotes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const blackKeys = [
            { note: 'C#', offset: 0.6 },
            { note: 'D#', offset: 1.6 },
            { note: 'F#', offset: 3.6 },
            { note: 'G#', offset: 4.6 },
            { note: 'A#', offset: 5.6 }
        ];

        // White keys
        whiteNotes.forEach((note, i) => {
            for (let octave = 4; octave <= 5; octave++) {
                const key = document.createElement('div');
                key.dataset.note = `${note}${octave}`;
                key.style.cssText = `
                    position: absolute;
                    left: ${i * this.keyWidth + (octave - 4) * 7 * this.keyWidth}px;
                    top: 0;
                    width: ${this.keyWidth - 2}px;
                    height: ${this.keyHeight}px;
                    background: linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%);
                    border: 1px solid #ccc;
                    border-radius: 0 0 4px 4px;
                    cursor: pointer;
                    transition: background 0.1s;
                    box-shadow: inset 0 -2px 4px rgba(0,0,0,0.1);
                `;
                key.addEventListener('mouseenter', () => {
                    key.style.background = '#d4d4d4';
                });
                key.addEventListener('mouseleave', () => {
                    key.style.background = this.activeKeys.has(key.dataset.note)
                        ? 'linear-gradient(180deg, #4fc3f7 0%, #0288d1 100%)'
                        : 'linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)';
                });
                keysContainer.appendChild(key);
            }
        });

        // Black keys
        blackKeys.forEach(({ note, offset }) => {
            for (let octave = 4; octave <= 5; octave++) {
                const key = document.createElement('div');
                key.dataset.note = `${note}${octave}`;
                key.style.cssText = `
                    position: absolute;
                    left: ${offset * this.keyWidth + (octave - 4) * 7 * this.keyWidth}px;
                    top: 0;
                    width: ${this.keyWidth * 0.6}px;
                    height: ${this.keyHeight * 0.65}px;
                    background: linear-gradient(180deg, #3a3a3a 0%, #222 100%);
                    border: 1px solid #111;
                    border-radius: 0 0 3px 3px;
                    z-index: 2;
                    cursor: pointer;
                    transition: background 0.1s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
                `;
                key.addEventListener('mouseenter', () => {
                    key.style.background = '#555';
                });
                key.addEventListener('mouseleave', () => {
                    key.style.background = this.activeKeys.has(key.dataset.note)
                        ? 'linear-gradient(180deg, #4fc3f7 0%, #0288d1 100%)'
                        : 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)';
                });
                keysContainer.appendChild(key);
            }
        });
    }

    /**
     * Show the chord keyboard overlay
     * @param {Object} chordData - { name: 'Cmaj7', notes: ['C4', 'E4', 'G4', 'B4'], type: 'maj7' }
     */
    show(chordData = null) {
        if (chordData) {
            this.currentChord = chordData;
            this.updateDisplay();
        }
        this.overlay.style.display = 'block';
        this.isVisible = true;
    }

    hide() {
        this.overlay.style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) this.hide();
        else this.show(this.currentChord);
    }

    /**
     * Update the display with new chord data
     * @param {Object} chordData - { name: 'Cmaj7', notes: ['C4', 'E4', 'G4', 'B4'] }
     */
    updateChord(chordData) {
        this.currentChord = chordData;
        if (this.isVisible) this.updateDisplay();
    }

    updateDisplay() {
        const chordNameEl = document.getElementById('cko-chord-name');
        const notesEl = document.getElementById('cko-notes');

        if (!this.currentChord || !this.currentChord.name) {
            chordNameEl.textContent = '—';
            notesEl.textContent = '—';
            this.clearActiveKeys();
            return;
        }

        chordNameEl.textContent = this.currentChord.name;
        notesEl.textContent = this.currentChord.notes ? this.currentChord.notes.join(' · ') : '';

        // Highlight active keys
        this.activeKeys.clear();
        if (this.currentChord.notes) {
            this.currentChord.notes.forEach(note => {
                this.activeKeys.add(note);
                const keyEl = document.querySelector(`[data-note="${note}"]`);
                if (keyEl) {
                    keyEl.style.background = 'linear-gradient(180deg, #4fc3f7 0%, #0288d1 100%)';
                    keyEl.style.boxShadow = '0 0 12px rgba(79, 195, 247, 0.6), inset 0 -2px 4px rgba(0,0,0,0.2)';
                }
            });
        }
    }

    clearActiveKeys() {
        document.querySelectorAll('#cko-keys > div').forEach(key => {
            const isBlack = key.style.zIndex === '2';
            key.style.background = isBlack
                ? 'linear-gradient(180deg, #3a3a3a 0%, #222 100%)'
                : 'linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)';
            key.style.boxShadow = isBlack ? '0 2px 4px rgba(0,0,0,0.5)' : 'inset 0 -2px 4px rgba(0,0,0,0.1)';
        });
        this.activeKeys.clear();
    }
}

// Export singleton
const chordKeyboardOverlay = new ChordKeyboardOverlay();