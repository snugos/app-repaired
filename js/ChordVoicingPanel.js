// SnugOS DAW - Chord Voicing Panel
// Visual panel to select chord voicings (close, open, spread) and preview on piano roll

window.ChordVoicingPanel = {
    currentVoicing: 'seventh',
    currentRoot: 'C4',
    currentType: 'major',
    isVisible: false,
    
    // Voicing definitions: intervals from root
    voicings: {
        'triad': [0, 4, 7],
        'firstInv': [4, 7, 12],
        'secondInv': [7, 12, 16],
        'seventh': [0, 4, 7, 11],
        'seventhOpen': [0, 4, 12, 16],
        'drop2': [0, 3, 7, 14],
        'drop3': [0, 4, 10, 14],
        'spread': [0, 12, 16, 21],
        'block': [0, 4, 7, 12],
        'shell': [0, 3, 10]
    },
    
    voicingLabels: {
        'triad': 'Triad (3-note)',
        'firstInv': '1st Inversion',
        'secondInv': '2nd Inversion',
        'seventh': '7th Close',
        'seventhOpen': '7th Open',
        'drop2': 'Drop 2',
        'drop3': 'Drop 3',
        'spread': 'Spread',
        'block': 'Block',
        'shell': 'Shell (3+7)'
    },
    
    openPanel() {
        let panel = document.getElementById('chordVoicingPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            this.isVisible = panel.style.display !== 'none';
            return;
        }
        
        this.buildPanel();
        this.isVisible = true;
        this.updatePianoRoll();
    },
    
    buildPanel() {
        const panel = document.createElement('div');
        panel.id = 'chordVoicingPanel';
        panel.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 20px;
            background: rgba(15, 15, 25, 0.97);
            border: 1px solid rgba(80, 80, 120, 0.3);
            border-radius: 12px;
            padding: 16px;
            z-index: 10000;
            color: #e0e0e0;
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 13px;
            min-width: 320px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        `;
        
        let voicingButtons = Object.keys(this.voicings).map(key => `
            <button id="cv-btn-${key}" data-voicing="${key}" style="
                padding: 6px 10px;
                margin: 3px;
                border: 1px solid rgba(100, 100, 140, 0.3);
                border-radius: 6px;
                background: rgba(30, 30, 50, 0.8);
                color: #b0b0c0;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.15s;
            ">${this.voicingLabels[key] || key}</button>
        `).join('');
        
        panel.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span style="color: #4fc3f7; font-size: 14px; font-weight: 600;">Chord Voicings</span>
                <button id="cv-close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 18px; padding: 0 4px;">×</button>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="color: #8080a0; font-size: 11px; margin-bottom: 6px;">VOICING STYLE</div>
                <div style="display: flex; flex-wrap: wrap; max-width: 300px;">
                    ${voicingButtons}
                </div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="color: #8080a0; font-size: 11px; margin-bottom: 6px;">ROOT NOTE</div>
                <select id="cv-root" style="
                    background: rgba(30, 30, 50, 0.9);
                    border: 1px solid rgba(100, 100, 140, 0.3);
                    border-radius: 6px;
                    color: #e0e0e0;
                    padding: 6px 10px;
                    font-size: 12px;
                    width: 80px;
                ">
                    <option value="C3">C3</option>
                    <option value="C4" selected>C4</option>
                    <option value="C5">C5</option>
                    <option value="D3">D3</option>
                    <option value="D4">D4</option>
                    <option value="E3">E3</option>
                    <option value="E4">E4</option>
                    <option value="F3">F3</option>
                    <option value="F4">F4</option>
                    <option value="G3">G3</option>
                    <option value="G4">G4</option>
                </select>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="color: #8080a0; font-size: 11px; margin-bottom: 6px;">CHORD TYPE</div>
                <select id="cv-type" style="
                    background: rgba(30, 30, 50, 0.9);
                    border: 1px solid rgba(100, 100, 140, 0.3);
                    border-radius: 6px;
                    color: #e0e0e0;
                    padding: 6px 10px;
                    font-size: 12px;
                    width: 120px;
                ">
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                    <option value="7">Dominant 7</option>
                    <option value="maj7">Major 7</option>
                    <option value="min7">Minor 7</option>
                    <option value="dim">Diminished</option>
                    <option value="aug">Augmented</option>
                    <option value="sus2">Sus2</option>
                    <option value="sus4">Sus4</option>
                </select>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="color: #8080a0; font-size: 11px; margin-bottom: 6px;">PIANO ROLL PREVIEW</div>
                <div id="cv-piano-roll" style="
                    position: relative;
                    width: 100%;
                    height: 80px;
                    background: rgba(20, 20, 35, 0.9);
                    border: 1px solid rgba(80, 80, 120, 0.3);
                    border-radius: 8px;
                    overflow: hidden;
                "></div>
            </div>
            
            <div style="font-size: 11px; color: #6060a0; text-align: center;">
                Click voicing to preview on piano roll
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Event listeners
        panel.querySelector('#cv-close').onclick = () => {
            panel.style.display = 'none';
            this.isVisible = false;
        };
        
        panel.querySelector('#cv-root').onchange = (e) => {
            this.currentRoot = e.target.value;
            this.updatePianoRoll();
        };
        
        panel.querySelector('#cv-type').onchange = (e) => {
            this.currentType = e.target.value;
            this.updatePianoRoll();
        };
        
        // Voicing button clicks
        Object.keys(this.voicings).forEach(key => {
            const btn = panel.querySelector(`#cv-btn-${key}`);
            if (btn) {
                btn.onclick = () => this.selectVoicing(key);
            }
        });
        
        // Initial selection highlight
        this.highlightSelectedVoicing();
    },
    
    selectVoicing(voicingKey) {
        this.currentVoicing = voicingKey;
        this.highlightSelectedVoicing();
        this.updatePianoRoll();
        
        // Notify other components if needed
        if (window.chordVoicingChanged) {
            window.chordVoicingChanged(this.currentVoicing, this.getNotes());
        }
    },
    
    highlightSelectedVoicing() {
        Object.keys(this.voicings).forEach(key => {
            const btn = document.querySelector(`#cv-btn-${key}`);
            if (btn) {
                if (key === this.currentVoicing) {
                    btn.style.background = 'rgba(79, 195, 247, 0.25)';
                    btn.style.borderColor = 'rgba(79, 195, 247, 0.6)';
                    btn.style.color = '#4fc3f7';
                } else {
                    btn.style.background = 'rgba(30, 30, 50, 0.8)';
                    btn.style.borderColor = 'rgba(100, 100, 140, 0.3)';
                    btn.style.color = '#b0b0c0';
                }
            }
        });
    },
    
    getNotes() {
        // Parse root MIDI from note name
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const match = this.currentRoot.match(/^([A-G]#?)(\d+)$/);
        if (!match) return [];
        
        const noteName = match[1];
        const octave = parseInt(match[2]);
        let rootMidi = noteNames.indexOf(noteName) + (octave * 12) + 12; // C4 = 60
        
        // Base intervals for chord type
        const baseIntervals = {
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            '7': [0, 4, 7, 10],
            'maj7': [0, 4, 7, 11],
            'min7': [0, 3, 7, 10],
            'dim': [0, 3, 6],
            'aug': [0, 4, 8],
            'sus2': [0, 2, 7],
            'sus4': [0, 5, 7]
        };
        
        const base = baseIntervals[this.currentType] || baseIntervals['major'];
        const voicingIntervals = this.voicings[this.currentVoicing] || this.voicings['seventh'];
        
        // Combine base intervals with voicing offsets
        const notes = base.map(interval => rootMidi + interval);
        
        // Apply voicing - replace some notes with voicing versions
        // For simplicity, just add the voicing intervals to create extra notes
        if (voicingIntervals.length > base.length) {
            voicingIntervals.slice(base.length).forEach(offset => {
                notes.push(rootMidi + offset);
            });
        }
        
        return notes.map(midi => ({
            midi: midi,
            note: noteNames[midi % 12] + Math.floor(midi / 12 - 1)
        }));
    },
    
    updatePianoRoll() {
        const container = document.getElementById('cv-piano-roll');
        if (!container) return;
        
        const notes = this.getNotes();
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Create piano keys representation
        const startMidi = 48; // C3
        const endMidi = 72; // C5
        const keyCount = endMidi - startMidi;
        
        let html = '';
        for (let midi = startMidi; midi < endMidi; midi++) {
            const isBlack = [1, 3, 6, 8, 10].includes(midi % 12);
            const isNote = notes.some(n => n.midi === midi);
            const noteName = noteNames[midi % 12];
            
            const bgColor = isNote 
                ? 'rgba(79, 195, 247, 0.8)' 
                : (isBlack ? 'rgba(20, 20, 30, 0.95)' : 'rgba(240, 240, 250, 0.9)');
            
            const width = isBlack ? '10px' : '14px';
            
            html += `<div style="
                position: absolute;
                left: ${(midi - startMidi) * 14}px;
                top: 0;
                width: ${width};
                height: 100%;
                background: ${bgColor};
                border-right: 1px solid rgba(60, 60, 80, 0.3);
                ${isNote ? 'box-shadow: inset 0 0 8px rgba(79, 195, 247, 0.5);' : ''}
            " title="${noteName}${Math.floor(midi/12)}"></div>`;
        }
        
        container.innerHTML = html;
        
        // Show note names below
        const noteDisplay = notes.map(n => n.note).join(' · ');
        container.innerHTML += `<div style="
            position: absolute;
            bottom: 4px;
            left: 4px;
            font-size: 10px;
            color: #4fc3f7;
            background: rgba(15, 15, 25, 0.8);
            padding: 2px 6px;
            border-radius: 4px;
        ">${noteDisplay || 'No chord'}</div>`;
    },
    
    getCurrentVoicing() {
        return this.currentVoicing;
    },
    
    getVoicingInfo() {
        return {
            voicing: this.currentVoicing,
            root: this.currentRoot,
            type: this.currentType,
            notes: this.getNotes()
        };
    },
    
    close() {
        const panel = document.getElementById('chordVoicingPanel');
        if (panel) {
            panel.style.display = 'none';
            this.isVisible = false;
        }
    },
    
    toggle() {
        if (this.isVisible) this.close();
        else this.openPanel();
    }
};

// Also expose globally for app services integration
window.openChordVoicingPanel = () => window.ChordVoicingPanel.openPanel();
window.getChordVoicingInfo = () => window.ChordVoicingPanel.getVoicingInfo();