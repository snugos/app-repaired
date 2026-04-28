/**
 * js/MetronomeAccentPatterns.js - Customize which beats have accent sounds in metronome
 * Allows users to define custom accent patterns (e.g., 1 and 3 only, all beats, etc.)
 */

let metronomeAccentPattern = [true, false, false, false]; // Default: accent on beat 1 only
let metronomeAccentPatternInitialized = false;
let accentPatternsDB = {}; // Stored patterns

// Built-in accent patterns
const BUILT_IN_PATTERNS = [
    { id: 'downbeat', name: 'Downbeat Only', pattern: [true, false, false, false], description: 'Accent first beat only' },
    { id: 'two', name: 'Two & Four', pattern: [false, true, false, true], description: 'Backbeat feel (drums)' },
    { id: 'oneThree', name: 'One & Three', pattern: [true, false, true, false], description: 'Waltz feel' },
    { id: 'all', name: 'All Beats', pattern: [true, true, true, true], description: 'Every beat accented' },
    { id: 'even', name: 'Even Beats', pattern: [false, true, false, true], description: 'Same as Two & Four' },
    { id: 'odd', name: 'Odd Beats', pattern: [true, false, true, false], description: 'Alternating start' },
    { id: 'threeFour', name: '3/4 Waltz', pattern: [true, false, false], description: 'Three quarter time' },
    { id: 'sixEight', name: '6/8 Feel', pattern: [true, false, false, true, false, false], description: 'Two groups of three' },
    { id: 'shuffle', name: 'Shuffle', pattern: [true, false, false, true, false, true, false, false], description: 'Eight note shuffle' },
    { id: 'none', name: 'No Accents', pattern: [false, false, false, false], description: 'No accented beats' }
];

// Load accent pattern from localStorage or use default
function loadAccentPattern() {
    try {
        const stored = localStorage.getItem('snaw_metronome_accent_pattern');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed.pattern) && parsed.pattern.length > 0) {
                metronomeAccentPattern = parsed.pattern;
            }
        }
        
        const storedDB = localStorage.getItem('snaw_metronome_accent_patterns_db');
        if (storedDB) {
            accentPatternsDB = JSON.parse(storedDB);
        }
    } catch (e) {
        console.warn('[MetronomeAccentPatterns] Failed to load pattern:', e);
    }
    metronomeAccentPatternInitialized = true;
}

// Save accent pattern to localStorage
function saveAccentPattern() {
    try {
        localStorage.setItem('snaw_metronome_accent_pattern', JSON.stringify({
            pattern: metronomeAccentPattern
        }));
    } catch (e) {
        console.warn('[MetronomeAccentPatterns] Failed to save pattern:', e);
    }
}

// Save custom patterns to localStorage
function saveCustomPatterns() {
    try {
        localStorage.setItem('snaw_metronome_accent_patterns_db', JSON.stringify(accentPatternsDB));
    } catch (e) {
        console.warn('[MetronomeAccentPatterns] Failed to save patterns DB:', e);
    }
}

// Check if a specific beat should be accented
export function isBeatAccented(beatNumber, totalBeats) {
    if (!metronomeAccentPatternInitialized) {
        loadAccentPattern();
    }
    
    // Adjust pattern length if needed
    if (beatNumber <= metronomeAccentPattern.length) {
        return !!metronomeAccentPattern[beatNumber - 1];
    }
    
    // For patterns shorter than total beats, repeat the pattern
    const patternIndex = (beatNumber - 1) % metronomeAccentPattern.length;
    return !!metronomeAccentPattern[patternIndex];
}

// Set the current accent pattern
export function setAccentPattern(pattern) {
    if (!Array.isArray(pattern)) return false;
    metronomeAccentPattern = pattern.map(p => !!p);
    saveAccentPattern();
    return true;
}

// Get the current accent pattern
export function getAccentPattern() {
    if (!metronomeAccentPatternInitialized) {
        loadAccentPattern();
    }
    return [...metronomeAccentPattern];
}

// Toggle accent on a specific beat
export function toggleBeatAccent(beatNumber) {
    if (!metronomeAccentPatternInitialized) {
        loadAccentPattern();
    }
    
    const index = beatNumber - 1;
    if (index < 0 || index >= 16) return false; // Limit to 16 beats max
    
    // Expand pattern if needed
    while (metronomeAccentPattern.length <= index) {
        metronomeAccentPattern.push(false);
    }
    
    metronomeAccentPattern[index] = !metronomeAccentPattern[index];
    saveAccentPattern();
    return true;
}

// Get all built-in patterns
export function getBuiltInPatterns() {
    return BUILT_IN_PATTERNS.map(p => ({...p}));
}

// Get all custom patterns
export function getCustomPatterns() {
    return Object.keys(accentPatternsDB).map(id => ({
        id,
        name: accentPatternsDB[id].name,
        pattern: [...accentPatternsDB[id].pattern],
        description: accentPatternsDB[id].description || 'Custom pattern'
    }));
}

// Get all available patterns (built-in + custom)
export function getAllPatterns() {
    return [...getBuiltInPatterns(), ...getCustomPatterns()];
}

// Save a custom pattern
export function saveCustomPattern(name, pattern, description = '') {
    if (!name || typeof name !== 'string') return false;
    if (!Array.isArray(pattern) || pattern.length === 0) return false;
    
    const id = 'custom_' + Date.now();
    accentPatternsDB[id] = {
        name: name.trim(),
        pattern: pattern.map(p => !!p),
        description: description
    };
    saveCustomPatterns();
    return id;
}

// Delete a custom pattern
export function deleteCustomPattern(id) {
    if (accentPatternsDB[id]) {
        delete accentPatternsDB[id];
        saveCustomPatterns();
        return true;
    }
    return false;
}

// Apply a pattern by ID
export function applyPatternById(patternId) {
    const builtIn = BUILT_IN_PATTERNS.find(p => p.id === patternId);
    if (builtIn) {
        setAccentPattern(builtIn.pattern);
        return true;
    }
    
    if (accentPatternsDB[patternId]) {
        setAccentPattern(accentPatternsDB[patternId].pattern);
        return true;
    }
    
    return false;
}

// Open the accent pattern editor panel
let accentPanel = null;

export function openAccentPatternPanel() {
    if (accentPanel) {
        accentPanel.remove();
        accentPanel = null;
        return;
    }
    
    if (!metronomeAccentPatternInitialized) {
        loadAccentPattern();
    }
    
    const settings = getMetronomeSettingsFromDOM();
    const numBeats = settings.numerator || 4;
    
    accentPanel = document.createElement('div');
    accentPanel.id = 'metronome-accent-panel';
    accentPanel.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        width: 320px;
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        z-index: 10000;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    accentPanel.innerHTML = `
        <div style="
            padding: 12px 16px;
            background: linear-gradient(180deg, #2a2a4e 0%, #1a1a2e 100%);
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <h3 style="margin: 0; color: #fff; font-size: 14px; font-weight: 600;">Metronome Accent Patterns</h3>
            <button id="closeAccentPanel" style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                line-height: 1;
            ">×</button>
        </div>
        
        <div style="padding: 16px; max-height: 400px; overflow-y: auto;">
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Quick Presets</label>
                <select id="accentPresetSelect" style="
                    width: 100%;
                    background: #2a2a4e;
                    color: #fff;
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 8px;
                    font-size: 13px;
                ">
                    <option value="">-- Select Pattern --</option>
                </select>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Click Beats to Toggle Accents</label>
                <div id="accentBeatsGrid" style="
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                    padding: 12px;
                    background: #0a0a1e;
                    border-radius: 6px;
                    border: 1px solid #333;
                "></div>
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #aaa; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Pattern Name</label>
                <input type="text" id="accentPatternName" placeholder="My Custom Pattern" style="
                    width: 100%;
                    background: #2a2a4e;
                    color: #fff;
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 8px;
                    font-size: 13px;
                    box-sizing: border-box;
                ">
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button id="saveAccentPatternBtn" style="
                    flex: 1;
                    background: linear-gradient(180deg, #4a9eff 0%, #2a5eff 100%);
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                ">Save Pattern</button>
                <button id="clearAccentPatternBtn" style="
                    flex: 1;
                    background: #6e3a3a;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 12px;
                    cursor: pointer;
                    font-size: 12px;
                ">Clear All</button>
            </div>
            
            <div id="customPatternsSection" style="display: none;">
                <div style="
                    padding: 8px 0;
                    border-top: 1px solid #333;
                    margin-top: 8px;
                ">
                    <label style="display: block; color: #aaa; font-size: 11px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Saved Patterns</label>
                    <div id="customPatternsList" style="display: flex; flex-direction: column; gap: 4px;"></div>
                </div>
            </div>
            
            <div style="
                padding: 8px 0;
                border-top: 1px solid #333;
                margin-top: 8px;
            ">
                <button id="testAccentBtn" style="
                    width: 100%;
                    background: #3a3a6e;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    padding: 10px;
                    cursor: pointer;
                    font-size: 13px;
                ">Test Pattern</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(accentPanel);
    
    // Populate preset select
    const presetSelect = accentPanel.querySelector('#accentPresetSelect');
    getAllPatterns().forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        presetSelect.appendChild(opt);
    });
    
    // Render beats grid
    renderAccentBeatsGrid(numBeats);
    
    // Update custom patterns list
    updateCustomPatternsList();
    
    // Event handlers
    accentPanel.querySelector('#closeAccentPanel').addEventListener('click', () => {
        accentPanel.remove();
        accentPanel = null;
    });
    
    presetSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            applyPatternById(e.target.value);
            renderAccentBeatsGrid(numBeats);
        }
    });
    
    accentPanel.querySelector('#saveAccentPatternBtn').addEventListener('click', () => {
        const name = accentPanel.querySelector('#accentPatternName').value.trim();
        if (!name) {
            alert('Please enter a pattern name');
            return;
        }
        saveCustomPattern(name, metronomeAccentPattern);
        updateCustomPatternsList();
        accentPanel.querySelector('#accentPatternName').value = '';
    });
    
    accentPanel.querySelector('#clearAccentPatternBtn').addEventListener('click', () => {
        setAccentPattern(metronomeAccentPattern.map(() => false));
        renderAccentBeatsGrid(numBeats);
    });
    
    accentPanel.querySelector('#testAccentBtn').addEventListener('click', () => {
        testAccentPattern();
    });
}

// Render the beats grid for clicking
function renderAccentBeatsGrid(numBeats) {
    const grid = accentPanel?.querySelector('#accentBeatsGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    for (let i = 1; i <= numBeats; i++) {
        const isAccented = isBeatAccented(i, numBeats);
        const btn = document.createElement('button');
        btn.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 6px;
            border: 2px solid ${isAccented ? '#ef4444' : '#444'};
            background: ${isAccented ? 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)' : '#2a2a4e'};
            color: ${isAccented ? '#fff' : '#888'};
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
            box-shadow: ${isAccented ? '0 0 10px rgba(239, 68, 68, 0.5)' : 'none'};
        `;
        btn.textContent = i;
        btn.dataset.beat = i;
        
        btn.addEventListener('click', () => {
            toggleBeatAccent(i);
            renderAccentBeatsGrid(numBeats);
        });
        
        grid.appendChild(btn);
    }
}

// Update custom patterns list in UI
function updateCustomPatternsList() {
    const section = accentPanel?.querySelector('#customPatternsSection');
    const list = accentPanel?.querySelector('#customPatternsList');
    if (!section || !list) return;
    
    const customPatterns = getCustomPatterns();
    
    if (customPatterns.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    list.innerHTML = '';
    
    customPatterns.forEach(p => {
        const item = document.createElement('div');
        item.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 8px;
            background: #2a2a4e;
            border-radius: 4px;
            margin-bottom: 4px;
        `;
        
        item.innerHTML = `
            <span style="color: #fff; font-size: 12px; cursor: pointer;" data-pattern-id="${p.id}">${escapeHtml(p.name)}</span>
            <button style="
                background: transparent;
                border: none;
                color: #888;
                font-size: 14px;
                cursor: pointer;
                padding: 0;
            " data-delete-id="${p.id}">×</button>
        `;
        
        list.appendChild(item);
    });
    
    // Add click handlers
    list.querySelectorAll('span[data-pattern-id]').forEach(span => {
        span.addEventListener('click', () => {
            applyPatternById(span.dataset.patternId);
            const settings = getMetronomeSettingsFromDOM();
            renderAccentBeatsGrid(settings.numerator || 4);
        });
    });
    
    list.querySelectorAll('button[data-delete-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteCustomPattern(btn.dataset.deleteId);
            updateCustomPatternsList();
        });
    });
}

// Test the current accent pattern with audio
function testAccentPattern() {
    const settings = getMetronomeSettingsFromDOM();
    const bpm = settings.bpm || 120;
    const numBeats = settings.numerator || 4;
    
    const intervalMs = (60 / bpm) * 1000;
    let beat = 0;
    
    const playTestBeat = () => {
        beat++;
        if (beat > numBeats) {
            return;
        }
        
        const isAccented = isBeatAccented(beat, numBeats);
        playClickSound(isAccented);
        
        setTimeout(playTestBeat, intervalMs);
    };
    
    playTestBeat();
}

// Play a click sound
function playClickSound(accent = false) {
    try {
        if (typeof Tone !== 'undefined') {
            const osc = new Tone.Oscillator(accent ? 1000 : 800, "sine").toDestination();
            const env = new Tone.AmplitudeEnvelope();
            osc.start();
            osc.stop(Tone.now() + 0.05);
        } else {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = accent ? 1000 : 800;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.05);
        }
    } catch (e) {
        // Silently fail
    }
}

// Get metronome settings from DOM/state
function getMetronomeSettingsFromDOM() {
    const globalState = window.state || {};
    return {
        bpm: globalState.metronomeBPM || 120,
        numerator: globalState.metronomeTimeSigTop || 4,
        denominator: globalState.metronomeTimeSigBottom || 4
    };
}

// Escape HTML helper
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m]);
}

// Initialize on load
loadAccentPattern();

// Export for use by other modules
export function initMetronomeAccentPatterns() {
    loadAccentPattern();
    console.log('[MetronomeAccentPatterns] Initialized with pattern:', metronomeAccentPattern);
}

export default {
    initMetronomeAccentPatterns,
    isBeatAccented,
    setAccentPattern,
    getAccentPattern,
    toggleBeatAccent,
    getBuiltInPatterns,
    getCustomPatterns,
    getAllPatterns,
    saveCustomPattern,
    deleteCustomPattern,
    applyPatternById,
    openAccentPatternPanel
};