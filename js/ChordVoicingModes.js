/**
 * js/ChordVoicingModes.js - Chord Voicing Modes for SnugOS DAW
 * Change how chords are voiced: close, open, drop 2, drop 3, inversions
 */

let localAppServices = {};
let currentVoicingMode = 'close';
let currentInversion = 0;

const VOICING_MODES = [
    { id: 'close', name: 'Close Voicing', description: 'Notes stacked within one octave' },
    { id: 'open', name: 'Open Voicing', description: 'Notes spread across multiple octaves' },
    { id: 'drop2', name: 'Drop 2', description: 'Second note from top dropped an octave' },
    { id: 'drop3', name: 'Drop 3', description: 'Third note from top dropped an octave' },
    { id: 'spread', name: 'Spread', description: 'Wide spread with root in bass' },
    { id: 'block', name: 'Block', description: 'All notes same octave' }
];

export function initChordVoicingModes(services) {
    localAppServices = services || {};
    console.log('[ChordVoicingModes] Initialized');
}

export function getVoicingModes() {
    return VOICING_MODES;
}

export function getCurrentVoicingMode() {
    return currentVoicingMode;
}

export function getCurrentInversion() {
    return currentInversion;
}

export function setVoicingMode(mode) {
    if (VOICING_MODES.find(m => m.id === mode)) {
        currentVoicingMode = mode;
        console.log(`[ChordVoicingModes] Mode set to: ${mode}`);
        return true;
    }
    return false;
}

export function setInversion(inversion) {
    currentInversion = Math.max(0, Math.min(3, inversion));
    console.log(`[ChordVoicingModes] Inversion set to: ${currentInversion}`);
}

/**
 * Apply voicing mode to a chord
 * @param {number[]} notes - Array of MIDI note numbers (e.g., [60, 64, 67] for C major)
 * @param {string} voicing - Voicing mode ID
 * @param {number} inversion - Number of inversions (0 = root position)
 * @returns {number[]} Respaced note array
 */
export function applyVoicing(notes, voicing = 'close', inversion = 0) {
    if (!notes || notes.length < 2) return notes;
    
    let voiced = [...notes].sort((a, b) => a - b);
    const root = voiced[0];
    
    switch (voicing) {
        case 'close':
            voiced = applyCloseVoicing(voiced);
            break;
        case 'open':
            voiced = applyOpenVoicing(voiced);
            break;
        case 'drop2':
            voiced = applyDrop2Voicing(voiced);
            break;
        case 'drop3':
            voiced = applyDrop3Voicing(voiced);
            break;
        case 'spread':
            voiced = applySpreadVoicing(voiced, root);
            break;
        case 'block':
            voiced = applyBlockVoicing(voiced, root);
            break;
    }
    
    if (inversion > 0) {
        voiced = applyInversion(voiced, inversion);
    }
    
    return voiced;
}

function applyCloseVoicing(notes) {
    // Stack notes within one octave (12 semitones max between consecutive notes)
    const result = [notes[0]];
    for (let i = 1; i < notes.length; i++) {
        let note = notes[i];
        while (note - result[result.length - 1] > 12) {
            note -= 12;
        }
        result.push(note);
    }
    return result;
}

function applyOpenVoicing(notes) {
    // Spread notes across octaves with comfortable spacing
    const result = [notes[0]];
    for (let i = 1; i < notes.length; i++) {
        let note = notes[i];
        const lastNote = result[result.length - 1];
        const interval = note - (notes[0] - 12);
        if (lastNote > note - 12) {
            note = lastNote + interval;
        }
        result.push(note);
    }
    return result;
}

function applyDrop2Voicing(notes) {
    // Drop second note from top
    if (notes.length < 3) return notes;
    const sorted = [...notes].sort((a, b) => a - b);
    const topNote = sorted.pop();
    const secondNote = sorted.pop();
    sorted.unshift(secondNote - 12);
    sorted.push(topNote);
    return sorted;
}

function applyDrop3Voicing(notes) {
    // Drop third note from top
    if (notes.length < 3) return notes;
    const sorted = [...notes].sort((a, b) => a - b);
    const topNote = sorted.pop();
    sorted.shift();
    sorted.push(topNote);
    sorted.unshift(sorted[0] - 12);
    sorted.splice(2, 1);
    return sorted;
}

function applySpreadVoicing(notes, root) {
    // Wide spread with root in bass, 4ths and 5ths spacing
    const result = [root];
    const intervals = [0, 7, 12, 19]; // Root, 5th, octave, 11th
    for (let i = 1; i < Math.min(notes.length, 4); i++) {
        result.push(root + intervals[i]);
    }
    return result;
}

function applyBlockVoicing(notes, root) {
    // All notes same octave as root
    const octave = Math.floor(root / 12) * 12;
    return notes.map(n => octave + (n % 12));
}

function applyInversion(notes, inv) {
    let result = [...notes];
    for (let i = 0; i < inv; i++) {
        if (result.length > 1) {
            const lowest = result.shift();
            result.push(lowest + 12);
        }
    }
    return result;
}

/**
 * Get chord from scale degree and chord type
 */
export function getChordFromDegree(rootMidi, degree, chordType = 'major') {
    const chordIntervals = {
        major: [0, 4, 7],
        minor: [0, 3, 7],
        diminished: [0, 3, 6],
        augmented: [0, 4, 8],
        major7: [0, 4, 7, 11],
        minor7: [0, 3, 7, 10],
        dominant7: [0, 4, 7, 10],
        dim7: [0, 3, 6, 9],
        halfdim7: [0, 3, 6, 10],
        sus2: [0, 2, 7],
        sus4: [0, 5, 7],
        add9: [0, 4, 7, 14],
        major9: [0, 4, 7, 11, 14],
        minor9: [0, 3, 7, 10, 14],
        dominant9: [0, 4, 7, 10, 14]
    };
    
    const intervals = chordIntervals[chordType] || chordIntervals.major;
    return intervals.map(i => rootMidi + i);
}

/**
 * Open the chord voicing panel
 */
export function openChordVoicingPanel() {
    const existingPanel = document.getElementById('chordVoicingPanel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'chordVoicingPanel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        right: 20px;
        width: 340px;
        background: linear-gradient(180deg, #1e1e2e 0%, #16162a 100%);
        border: 1px solid #444;
        border-radius: 12px;
        padding: 16px;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        color: #eee;
        font-family: system-ui, -apple-system, sans-serif;
    `;

    panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:18px;">🎹</span>
                <h3 style="margin:0;font-size:16px;font-weight:600;">Chord Voicing Modes</h3>
            </div>
            <button id="closeVoicingPanel" style="background:#333;border:none;color:#fff;padding:4px 10px;cursor:pointer;border-radius:4px;font-size:13px;">×</button>
        </div>
        
        <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;color:#888;margin-bottom:6px;">Voicing Mode</label>
            <select id="voicingModeSelect" style="
                width:100%;
                padding:8px 10px;
                background:#2a2a3e;
                border:1px solid #444;
                border-radius:6px;
                color:#fff;
                font-size:13px;
                cursor:pointer;
            ">
                ${VOICING_MODES.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
            </select>
            <div id="voicingDesc" style="font-size:11px;color:#666;margin-top:4px;">${VOICING_MODES[0].description}</div>
        </div>
        
        <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;color:#888;margin-bottom:6px;">Inversion</label>
            <div style="display:flex;gap:6px;">
                <button class="inversion-btn" data-inv="0" style="flex:1;padding:8px;background:#4a9eff;border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">Root</button>
                <button class="inversion-btn" data-inv="1" style="flex:1;padding:8px;background:#333;border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">1st</button>
                <button class="inversion-btn" data-inv="2" style="flex:1;padding:8px;background:#333;border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">2nd</button>
                <button class="inversion-btn" data-inv="3" style="flex:1;padding:8px;background:#333;border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">3rd</button>
            </div>
        </div>
        
        <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;color:#888;margin-bottom:6px;">Preview Notes</label>
            <div id="previewNotes" style="display:flex;gap:6px;flex-wrap:wrap;">
                <span style="padding:6px 10px;background:#333;border-radius:4px;font-size:12px;">C4</span>
                <span style="padding:6px 10px;background:#333;border-radius:4px;font-size:12px;">E4</span>
                <span style="padding:6px 10px;background:#333;border-radius:4px;font-size:12px;">G4</span>
            </div>
        </div>
        
        <div style="display:flex;gap:8px;">
            <button id="applyVoicingBtn" style="flex:1;padding:10px;background:#22c55e;border:none;border-radius:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Apply to Selected</button>
            <button id="previewVoicingBtn" style="flex:1;padding:10px;background:#4a9eff;border:none;border-radius:6px;color:#fff;font-size:13px;cursor:pointer;">Preview</button>
        </div>
    `;

    document.body.appendChild(panel);

    const modeSelect = panel.querySelector('#voicingModeSelect');
    const descEl = panel.querySelector('#voicingDesc');
    const invBtns = panel.querySelectorAll('.inversion-btn');

    modeSelect.value = currentVoicingMode;
    modeSelect.addEventListener('change', (e) => {
        currentVoicingMode = e.target.value;
        const mode = VOICING_MODES.find(m => m.id === currentVoicingMode);
        descEl.textContent = mode?.description || '';
        updatePreviewNotes();
    });

    invBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            invBtns.forEach(b => b.style.background = '#333');
            btn.style.background = '#4a9eff';
            currentInversion = parseInt(btn.dataset.inv);
            updatePreviewNotes();
        });
    });

    function updatePreviewNotes() {
        const sampleChord = [60, 64, 67]; // C major
        const voiced = applyVoicing(sampleChord, currentVoicingMode, currentInversion);
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const preview = panel.querySelector('#previewNotes');
        preview.innerHTML = voiced.map(n => {
            const noteName = noteNames[n % 12];
            const octave = Math.floor(n / 12) - 1;
            return `<span style="padding:6px 10px;background:#333;border-radius:4px;font-size:12px;">${noteName}${octave}</span>`;
        }).join('');
    }

    panel.querySelector('#previewVoicingBtn').addEventListener('click', () => {
        updatePreviewNotes();
        // Play preview sound if Tone is available
        if (typeof Tone !== 'undefined') {
            const sampleChord = [60, 64, 67];
            const voiced = applyVoicing(sampleChord, currentVoicingMode, currentInversion);
            const synth = new Tone.PolySynth(Tone.Synth).toDestination();
            const freqs = voiced.map(n => Tone.Frequency(n, 'midi').toFrequency());
            synth.triggerAttackRelease(freqs, '1n');
        }
    });

    panel.querySelector('#applyVoicingBtn').addEventListener('click', () => {
        applyVoicingToSelectedTrack();
        panel.remove();
    });

    panel.querySelector('#closeVoicingPanel').addEventListener('click', () => panel.remove());

    updatePreviewNotes();
    invBtns[currentInversion]?.click();
}

function applyVoicingToSelectedTrack() {
    const tracks = localAppServices.getTracks?.() || [];
    const activeId = localAppServices.getActiveSequencerTrackId?.() || (tracks[0]?.id);
    const track = tracks.find(t => t.id === activeId);
    
    if (!track) {
        localAppServices.showNotification?.('No track selected', 2000);
        return;
    }
    
    // Apply voicing to track's chord memory if available
    if (track.chordMemory && track.chordMemory.length > 0) {
        track.chordMemory = track.chordMemory.map(chord => ({
            ...chord,
            notes: applyVoicing(chord.notes, currentVoicingMode, currentInversion)
        }));
        localAppServices.showNotification?.(`Applied ${currentVoicingMode} voicing to ${track.name}`, 2000);
    } else {
        localAppServices.showNotification?.(`Voicing mode set to ${currentVoicingMode}`, 2000);
    }
    
    // Store in track settings for persistence
    if (!track.voicingSettings) track.voicingSettings = {};
    track.voicingSettings.mode = currentVoicingMode;
    track.voicingSettings.inversion = currentInversion;
}

export default {
    initChordVoicingModes,
    getVoicingModes,
    getCurrentVoicingMode,
    setVoicingMode,
    setInversion,
    applyVoicing,
    openChordVoicingPanel
};
