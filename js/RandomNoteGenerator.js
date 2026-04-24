/**
 * Random Note Generator - Add random notes within a scale/range
 * Generates rhythmic patterns, melodies, or percussion using musical constraints
 */

let randomNoteGeneratorPanel = null;

export function openRandomNoteGeneratorPanel() {
    if (randomNoteGeneratorPanel) {
        randomNoteGeneratorPanel.remove();
        randomNoteGeneratorPanel = null;
    }
    
    const panel = document.createElement('div');
    panel.id = 'randomNoteGeneratorPanel';
    panel.className = 'panel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 450px;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 16px 20px;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #16213e;
        border-radius: 8px 8px 0 0;
    `;
    header.innerHTML = `
        <span style="color: #eee; font-size: 16px; font-weight: 600;">Random Note Generator</span>
        <button id="rng-close" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: white; cursor: pointer;">×</button>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        padding: 20px;
    `;
    
    content.innerHTML = `
        <div style="margin-bottom: 16px;">
            <label style="display: block; color: #aaa; margin-bottom: 6px; font-size: 13px;">Scale / Mode</label>
            <select id="rng-scale" style="
                width: 100%;
                padding: 8px 12px;
                background: #0f0f1a;
                border: 1px solid #333;
                border-radius: 4px;
                color: #eee;
            ">
                <option value="chromatic">Chromatic (all notes)</option>
                <option value="major" selected>Major</option>
                <option value="minor">Natural Minor</option>
                <option value="dorian">Dorian</option>
                <option value="mixolydian">Mixolydian</option>
                <option value="pentatonic">Pentatonic Major</option>
                <option value="blues">Blues</option>
                <option value="drum">Drum (C1-C5)</option>
            </select>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
                <label style="display: block; color: #aaa; margin-bottom: 6px; font-size: 13px;">Octave Range</label>
                <select id="rng-octave" style="
                    width: 100%;
                    padding: 8px 12px;
                    background: #0f0f1a;
                    border: 1px solid #333;
                    border-radius: 4px;
                    color: #eee;
                ">
                    <option value="2">2 octaves</option>
                    <option value="3" selected>3 octaves</option>
                    <option value="4">4 octaves</option>
                </select>
            </div>
            <div>
                <label style="display: block; color: #aaa; margin-bottom: 6px; font-size: 13px;">Density</label>
                <select id="rng-density" style="
                    width: 100%;
                    padding: 8px 12px;
                    background: #0f0f1a;
                    border: 1px solid #333;
                    border-radius: 4px;
                    color: #eee;
                ">
                    <option value="sparse">Sparse (1/8)</option>
                    <option value="medium" selected>Medium (1/16)</option>
                    <option value="dense">Dense (1/32)</option>
                </select>
            </div>
        </div>
        
        <div style="margin-top: 16px;">
            <label style="display: block; color: #aaa; margin-bottom: 6px; font-size: 13px;">Note Length</label>
            <select id="rng-notelength" style="
                width: 100%;
                padding: 8px 12px;
                background: #0f0f1a;
                border: 1px solid #333;
                border-radius: 4px;
                color: #eee;
            ">
                <option value="4n">Quarter</option>
                <option value="8n" selected>Eighth</option>
                <option value="16n">Sixteenth</option>
                <option value="8n.">Dotted Eighth</option>
            </select>
        </div>
        
        <div style="margin-top: 16px;">
            <label style="display: block; color: #aaa; margin-bottom: 6px; font-size: 13px;">Probability</label>
            <input id="rng-probability" type="range" min="10" max="100" value="70" 
                style="width: 100%; height: 8px; border-radius: 4px; background: #2a2a4a; -webkit-appearance: none; cursor: pointer;">
            <div style="display: flex; justify-content: space-between; color: #666; font-size: 11px; margin-top: 4px;">
                <span>10%</span>
                <span id="rng-prob-value">70%</span>
                <span>100%</span>
            </div>
        </div>
        
        <div style="margin-top: 16px;">
            <label style="display: block; color: #aaa; margin-bottom: 6px; font-size: 13px;">Bars</label>
            <select id="rng-bars" style="
                width: 100%;
                padding: 8px 12px;
                background: #0f0f1a;
                border: 1px solid #333;
                border-radius: 4px;
                color: #eee;
            ">
                <option value="1">1 bar</option>
                <option value="2" selected>2 bars</option>
                <option value="4">4 bars</option>
                <option value="8">8 bars</option>
            </select>
        </div>
        
        <div style="margin-top: 20px;">
            <label style="display: flex; align-items: center; gap: 8px; color: #aaa; cursor: pointer;">
                <input id="rng-root" type="checkbox" checked>
                <span>Force root note on downbeats</span>
            </label>
        </div>
        
        <button id="rng-generate" style="
            width: 100%;
            margin-top: 20px;
            padding: 12px;
            background: linear-gradient(135deg, #4a90d9, #7bc4ff);
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 15px;
            font-weight: 600;
        ">Generate Random Notes</button>
        
        <div id="rng-preview" style="margin-top: 12px; display: none;">
            <div style="padding: 12px; background: #0f0f1a; border-radius: 4px; color: #888; font-size: 12px; text-align: center;">
                Preview: <span id="rng-preview-text"></span>
            </div>
        </div>
    `;
    
    panel.appendChild(header);
    panel.appendChild(content);
    
    document.body.appendChild(panel);
    randomNoteGeneratorPanel = panel;
    
    // Event listeners
    document.getElementById('rng-close').onclick = closeRandomNoteGeneratorPanel;
    
    const probabilitySlider = document.getElementById('rng-probability');
    const probValue = document.getElementById('rng-prob-value');
    
    probabilitySlider.oninput = (e) => {
        probValue.textContent = `${e.target.value}%`;
    };
    
    document.getElementById('rng-generate').onclick = () => {
        generateRandomNotes();
    };
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!panel.contains(e.target)) {
                closeRandomNoteGeneratorPanel();
                document.removeEventListener('click', handler);
            }
        });
    }, 100);
}

const SCALES = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
    drum: [36, 38, 42, 46, 49, 51, 53, 55] // C1 to G3 (MIDI note numbers)
};

function generateRandomNotes() {
    const scaleType = document.getElementById('rng-scale').value;
    const octaveRange = parseInt(document.getElementById('rng-octave').value, 10);
    const density = document.getElementById('rng-density').value;
    const noteLength = document.getElementById('rng-notelength').value;
    const probability = parseInt(document.getElementById('rng-probability').value, 10) / 100;
    const bars = parseInt(document.getElementById('rng-bars').value, 10);
    const forceRoot = document.getElementById('rng-root').checked;
    
    const scale = SCALES[scaleType] || SCALES.chromatic;
    const BPM = appServices.getBPM?.() || 120;
    
    // Calculate step duration in seconds
    let stepDuration;
    switch (density) {
        case 'sparse': stepDuration = 60 / BPM / 2; break; // 1/8 at 120
        case 'dense': stepDuration = 60 / BPM / 8; break; // 1/32 at 120
        default: stepDuration = 60 / BPM / 4; break; // 1/16 at 120
    }
    
    const barDuration = (60 / BPM) * 4;
    const totalDuration = barDuration * bars;
    const stepsPerBar = Math.floor(barDuration / stepDuration);
    
    const notes = [];
    const startOctave = 3;
    
    for (let bar = 0; bar < bars; bar++) {
        for (let step = 0; step < stepsPerBar; step++) {
            const time = bar * barDuration + step * stepDuration;
            
            // Force root on downbeats
            if (forceRoot && step % (stepsPerBar / 4) === 0) {
                const rootNote = 12 * (startOctave + Math.floor(octaveRange / 2)) + scale[0];
                notes.push({ start: time, note: rootNote, length: noteLength });
                continue;
            }
            
            // Random probability check
            if (Math.random() < probability) {
                const octaveOffset = Math.floor(Math.random() * octaveRange);
                const noteIndex = Math.floor(Math.random() * scale.length);
                const midiNote = 12 * (startOctave + octaveOffset) + scale[noteIndex];
                
                notes.push({ start: time, note: midiNote, length: noteLength });
            }
        }
    }
    
    // Display preview
    const previewEl = document.getElementById('rng-preview');
    const previewText = document.getElementById('rng-preview-text');
    previewEl.style.display = 'block';
    previewText.textContent = `${notes.length} note(s) generated`;
    
    // Add notes to the currently selected track via appServices
    if (appServices.addGeneratedNotes) {
        appServices.addGeneratedNotes(notes);
    } else if (appServices.getActiveTrack) {
        const track = appServices.getActiveTrack();
        if (track && track.addMIDIEvent) {
            notes.forEach(n => {
                track.addMIDIEvent({
                    type: 'note',
                    startTime: n.start,
                    noteNumber: n.note,
                    duration: n.length,
                    velocity: 100
                });
            });
        }
    }
    
    appServices.showNotification?.(`Generated ${notes.length} random notes`, 'success');
    
    setTimeout(closeRandomNoteGeneratorPanel, 1500);
}

export function closeRandomNoteGeneratorPanel() {
    if (randomNoteGeneratorPanel) {
        randomNoteGeneratorPanel.remove();
        randomNoteGeneratorPanel = null;
    }
}