/**
 * Pattern Variations System Enhancement
 * Advanced pattern transformation and variation generation
 */

// ===== NEW TRANSFORM TYPES =====

/**
 * Generate Euclidean rhythm pattern
 * Distributes hits evenly across steps
 */
export function generateEuclideanPattern(steps, hits, rotation = 0) {
    const pattern = new Array(steps).fill(null);
    
    if (hits === 0) return pattern.map((_, i) => ({ active: false, velocity: 0, duration: 1, step: i }));
    if (hits >= steps) return pattern.map((_, i) => ({ active: true, velocity: 1, duration: 1, step: i }));
    
    // Bjorklund's algorithm for Euclidean rhythm
    const bucket = [];
    let remainder = hits;
    let divisor = steps - hits;
    let level = 0;
    
    // Initialize
    bucket[level] = { count: hits, remainder: 0 };
    
    const buildSequence = (level, seq) => {
        if (level >= bucket.length) return seq;
        
        const newSeq = [];
        for (let i = 0; i < seq.length; i++) {
            if (seq[i] === 'x') {
                newSeq.push('x');
            } else {
                newSeq.push('x', '.');
            }
        }
        return buildSequence(level + 1, newSeq);
    };
    
    // Simplified Euclidean distribution
    const positions = [];
    for (let i = 0; i < hits; i++) {
        const pos = Math.floor((i * steps) / hits);
        positions.push(pos);
    }
    
    // Apply rotation
    for (let i = 0; i < steps; i++) {
        const rotatedPos = (i + rotation) % steps;
        if (positions.includes(rotatedPos)) {
            pattern[i] = { active: true, velocity: 0.8, duration: 1, step: i };
        } else {
            pattern[i] = { active: false, velocity: 0, duration: 1, step: i };
        }
    }
    
    return pattern;
}

/**
 * Apply Euclidean rhythm to sequence data
 */
export function applyEuclideanTransform(data, options = {}) {
    const hits = options.hits || 4;
    const rotation = options.rotation || 0;
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    for (let row = 0; row < numRows; row++) {
        const euclideanPattern = generateEuclideanPattern(numCols, hits, rotation);
        for (let col = 0; col < numCols; col++) {
            if (euclideanPattern[col].active) {
                if (!data[row][col]) {
                    data[row][col] = {
                        active: true,
                        velocity: 0.7 + Math.random() * 0.3,
                        duration: 1
                    };
                }
            } else {
                // Remove note if it exists and we're strictly applying Euclidean
                if (options.strict && data[row][col]) {
                    data[row][col] = null;
                }
            }
        }
    }
}

/**
 * Add ghost notes to pattern
 */
export function addGhostNotes(data, options = {}) {
    const probability = options.probability ?? 0.3;
    const velocityMultiplier = options.velocityMultiplier ?? 0.3;
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (data[row][col] && data[row][col].active) {
                const vel = data[row][col].velocity || 0.8;
                
                // Add ghost on next step if empty
                if (col + 1 < numCols && !data[row][col + 1] && Math.random() < probability) {
                    data[row][col + 1] = {
                        active: true,
                        velocity: vel * velocityMultiplier,
                        duration: 0.5,
                        ghost: true
                    };
                }
                
                // Maybe add ghost before (anticipation)
                if (col > 0 && !data[row][col - 1] && Math.random() < probability * 0.5) {
                    data[row][col - 1] = {
                        active: true,
                        velocity: vel * velocityMultiplier * 0.8,
                        duration: 0.5,
                        ghost: true,
                        anticipation: true
                    };
                }
            }
        }
    }
}

/**
 * Add flams to pattern
 */
export function addFlams(data, options = {}) {
    const probability = options.probability ?? 0.5;
    const flamOffset = options.offset ?? 0.05; // timing offset as fraction of step
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (data[row][col] && data[row][col].active && Math.random() < probability) {
                // Mark as flam - will be played as two quick hits
                data[row][col].flam = true;
                data[row][col].flamVelocity = (data[row][col].velocity || 0.8) * 0.6;
                data[row][col].flamOffset = flamOffset;
            }
        }
    }
}

/**
 * Add rolls to pattern
 */
export function addRolls(data, options = {}) {
    const probability = options.probability ?? 0.3;
    const rollLength = options.length ?? 3;
    const rollSubdivision = options.subdivision ?? 2; // subdivisions per step
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (data[row][col] && data[row][col].active && Math.random() < probability) {
                data[row][col].roll = true;
                data[row][col].rollLength = rollLength;
                data[row][col].rollSubdivision = rollSubdivision;
                data[row][col].rollVelocityDecay = options.velocityDecay ?? 0.1;
            }
        }
    }
}

/**
 * Apply accent pattern
 */
export function applyAccentPattern(data, options = {}) {
    const pattern = options.pattern || 'strong-weak'; // 'strong-weak', 'syncopated', 'every-n', 'custom'
    const accentBoost = options.boost ?? 0.3;
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    const getAccentMultiplier = (col, row) => {
        switch (pattern) {
            case 'strong-weak':
                // Strong on beats, weak on off-beats
                return col % 4 === 0 ? 1 + accentBoost : 1 - accentBoost * 0.5;
            case 'syncopated':
                // Accent off-beats
                return col % 4 === 0 ? 1 - accentBoost * 0.5 : 1 + accentBoost;
            case 'every-n':
                const n = options.every || 4;
                return col % n === 0 ? 1 + accentBoost : 1;
            case 'crescendo':
                return 1 + (col / numCols) * accentBoost;
            case 'decrescendo':
                return 1 + ((numCols - col) / numCols) * accentBoost;
            case 'custom':
                if (options.customPattern && options.customPattern[col] !== undefined) {
                    return options.customPattern[col];
                }
                return 1;
            default:
                return 1;
        }
    };
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (data[row][col] && data[row][col].active) {
                const multiplier = getAccentMultiplier(col, row);
                const currentVel = data[row][col].velocity || 0.8;
                data[row][col].velocity = Math.max(0.1, Math.min(1, currentVel * multiplier));
            }
        }
    }
}

/**
 * Apply velocity ramp (crescendo/decrescendo)
 */
export function applyVelocityRamp(data, options = {}) {
    const startVelocity = options.startVelocity ?? 0.3;
    const endVelocity = options.endVelocity ?? 1.0;
    const curve = options.curve || 'linear'; // 'linear', 'exponential', 's-curve'
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    const getVelocity = (col) => {
        const t = col / (numCols - 1);
        switch (curve) {
            case 'linear':
                return startVelocity + (endVelocity - startVelocity) * t;
            case 'exponential':
                return startVelocity * Math.pow(endVelocity / startVelocity, t);
            case 's-curve':
                const s = t < 0.5 
                    ? 2 * t * t 
                    : 1 - Math.pow(-2 * t + 2, 2) / 2;
                return startVelocity + (endVelocity - startVelocity) * s;
            default:
                return startVelocity + (endVelocity - startVelocity) * t;
        }
    };
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (data[row][col] && data[row][col].active) {
                data[row][col].velocity = getVelocity(col);
            }
        }
    }
}

/**
 * Apply note repeat
 */
export function applyNoteRepeat(data, options = {}) {
    const repeatCount = options.count ?? 2;
    const decay = options.decay ?? 0.1;
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (data[row][col] && data[row][col].active) {
                data[row][col].repeat = repeatCount;
                data[row][col].repeatDecay = decay;
            }
        }
    }
}

/**
 * Apply octave shift
 */
export function applyOctaveShift(data, options = {}) {
    const octaveOffset = options.octaves ?? 1;
    const direction = options.direction || 'up'; // 'up', 'down', 'both'
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    for (let row = 0; row < numRows; row++) {
        let newRow = row;
        
        if (direction === 'up') {
            newRow = Math.min(numRows - 1, row + octaveOffset * 12); // Assuming 1 row per semitone
        } else if (direction === 'down') {
            newRow = Math.max(0, row - octaveOffset * 12);
        }
        
        // Move notes to new row if direction is 'both', create harmonic
        if (direction === 'both' && row + octaveOffset * 12 < numRows) {
            for (let col = 0; col < numCols; col++) {
                if (data[row][col] && data[row][col].active) {
                    const targetRow = row + octaveOffset * 12;
                    if (!data[targetRow][col]) {
                        data[targetRow][col] = {
                            ...data[row][col],
                            harmonic: true
                        };
                    }
                }
            }
        }
    }
}

/**
 * Quantize notes to scale
 */
export function quantizeToScale(data, options = {}) {
    const scale = options.scale || 'major'; // 'major', 'minor', 'pentatonic', 'blues', 'chromatic'
    const rootNote = options.root || 0; // 0 = C, 1 = C#, etc.
    
    const scales = {
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
        pentatonic: [0, 2, 4, 7, 9],
        blues: [0, 3, 5, 6, 7, 10],
        chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        dorian: [0, 2, 3, 5, 7, 9, 10],
        mixolydian: [0, 2, 4, 5, 7, 9, 10],
        harmonic_minor: [0, 2, 3, 5, 7, 8, 11]
    };
    
    const scaleNotes = scales[scale] || scales.major;
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (data[row][col] && data[row][col].active) {
                const noteInOctave = (row + rootNote) % 12;
                const nearestScaleNote = scaleNotes.reduce((prev, curr) => {
                    const prevDist = Math.min(Math.abs(noteInOctave - prev), 12 - Math.abs(noteInOctave - prev));
                    const currDist = Math.min(Math.abs(noteInOctave - curr), 12 - Math.abs(noteInOctave - curr));
                    return currDist < prevDist ? curr : prev;
                });
                
                const octave = Math.floor((row + rootNote) / 12);
                const newRow = nearestScaleNote - rootNote + octave * 12;
                
                if (newRow >= 0 && newRow < numRows && newRow !== row) {
                    // Move note to nearest scale note
                    if (!data[newRow][col]) {
                        data[newRow][col] = { ...data[row][col], quantized: true };
                        data[row][col] = null;
                    }
                }
            }
        }
    }
}

/**
 * Add probability to notes
 */
export function addNoteProbability(data, options = {}) {
    const baseProbability = options.probability ?? 0.8;
    const variation = options.variation ?? 0.2;
    const numRows = data.length;
    const numCols = data[0]?.length || 16;
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (data[row][col] && data[row][col].active) {
                const prob = baseProbability + (Math.random() - 0.5) * variation * 2;
                data[row][col].probability = Math.max(0, Math.min(1, prob));
            }
        }
    }
}

/**
 * Apply groove template
 */
export function applyGrooveTemplate(data, options = {}) {
    const template = options.template || 'straight'; // 'straight', 'swing', 'shuffle', 'latinx', 'custom'
    const amount = options.amount ?? 0.5;
    const numCols = data[0]?.length || 16;
    
    const grooveOffsets = {
        straight: new Array(numCols).fill(0),
        swing: [0, 0.1, 0, 0.1, 0, 0.1, 0, 0.1, 0, 0.1, 0, 0.1, 0, 0.1, 0, 0.1],
        shuffle: [0, 0.15, 0, 0.15, 0, 0.15, 0, 0.15, 0, 0.15, 0, 0.15, 0, 0.15, 0, 0.15],
        sixties_swing: [0, 0.08, 0, 0.08, 0, 0.12, 0, 0.08, 0, 0.08, 0, 0.12, 0, 0.08, 0, 0.08],
        latin: [0, 0, 0.05, 0, 0, 0, 0.05, 0, 0, 0, 0.05, 0, 0, 0, 0.05, 0]
    };
    
    const offsets = grooveOffsets[template] || grooveOffsets.straight;
    const numRows = data.length;
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < numCols; col++) {
            if (data[row][col] && data[row][col].active) {
                data[row][col].timingOffset = (offsets[col % offsets.length] || 0) * amount;
            }
        }
    }
}

// ===== VARIATION PRESETS =====

export const VARIATION_PRESETS = {
    'drums_basic': {
        name: 'Drums - Basic',
        transforms: [
            { type: 'euclidean', options: { hits: 4, rotation: 0 } },
            { type: 'accent', options: { pattern: 'strong-weak', boost: 0.25 } }
        ]
    },
    'drums_ghost': {
        name: 'Drums - Ghost Notes',
        transforms: [
            { type: 'ghost', options: { probability: 0.4, velocityMultiplier: 0.3 } }
        ]
    },
    'drums_flams': {
        name: 'Drums - Flams',
        transforms: [
            { type: 'flams', options: { probability: 0.6, offset: 0.03 } }
        ]
    },
    'drums_swing': {
        name: 'Drums - Swing',
        transforms: [
            { type: 'groove', options: { template: 'swing', amount: 0.8 } }
        ]
    },
    'melody_crescendo': {
        name: 'Melody - Crescendo',
        transforms: [
            { type: 'velocityRamp', options: { startVelocity: 0.3, endVelocity: 1.0, curve: 'linear' } }
        ]
    },
    'melody_scale': {
        name: 'Melody - Scale Quantize',
        transforms: [
            { type: 'scale', options: { scale: 'major', root: 0 } }
        ]
    },
    'melody_humanize': {
        name: 'Melody - Humanize',
        transforms: [
            { type: 'humanize', options: { amount: 0.15 } }
        ]
    },
    'rhythm_euclidean': {
        name: 'Rhythm - Euclidean (4,16)',
        transforms: [
            { type: 'euclidean', options: { hits: 4, rotation: 0 } }
        ]
    },
    'rhythm_euclidean_5': {
        name: 'Rhythm - Euclidean (5,16)',
        transforms: [
            { type: 'euclidean', options: { hits: 5, rotation: 2 } }
        ]
    },
    'rhythm_rolls': {
        name: 'Rhythm - Rolls',
        transforms: [
            { type: 'rolls', options: { probability: 0.3, length: 3, subdivision: 2 } }
        ]
    },
    'full_groove': {
        name: 'Full - Groove Template',
        transforms: [
            { type: 'groove', options: { template: 'shuffle', amount: 0.7 } },
            { type: 'humanize', options: { amount: 0.1 } }
        ]
    },
    'full_complex': {
        name: 'Full - Complex',
        transforms: [
            { type: 'ghost', options: { probability: 0.3 } },
            { type: 'flams', options: { probability: 0.4 } },
            { type: 'accent', options: { pattern: 'syncopated', boost: 0.2 } },
            { type: 'groove', options: { template: 'swing', amount: 0.5 } }
        ]
    }
};

// ===== UI PANEL =====

/**
 * Create Pattern Variations Panel
 */
export function openPatternVariationsPanel(trackId, sequenceId) {
    const panel = document.createElement('div');
    panel.id = 'pattern-variations-panel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1a2e;
        border: 1px solid #444;
        border-radius: 8px;
        padding: 20px;
        z-index: 10000;
        min-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    let currentPreview = null;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #fff;">Pattern Variations</h3>
            <button id="close-variations" style="background: #444; border: none; color: #fff; padding: 5px 10px; cursor: pointer; border-radius: 4px;">×</button>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="color: #aaa; display: block; margin-bottom: 5px;">Quick Presets</label>
            <select id="variation-preset" style="width: 100%; padding: 8px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px;">
                <option value="">-- Select Preset --</option>
                ${Object.entries(VARIATION_PRESETS).map(([key, preset]) => 
                    `<option value="${key}">${preset.name}</option>`
                ).join('')}
            </select>
        </div>
        
        <div style="margin-bottom: 15px; padding: 10px; background: #222; border-radius: 4px;">
            <h4 style="color: #888; margin: 0 0 10px 0;">Transform Options</h4>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <label style="color: #aaa; font-size: 12px;">Euclidean Hits</label>
                    <input type="range" id="euclidean-hits" min="1" max="16" value="4" style="width: 100%;">
                    <span id="euclidean-hits-val" style="color: #666; font-size: 11px;">4</span>
                </div>
                <div>
                    <label style="color: #aaa; font-size: 12px;">Euclidean Rotation</label>
                    <input type="range" id="euclidean-rotation" min="0" max="15" value="0" style="width: 100%;">
                    <span id="euclidean-rotation-val" style="color: #666; font-size: 11px;">0</span>
                </div>
                <div>
                    <label style="color: #aaa; font-size: 12px;">Ghost Note Prob</label>
                    <input type="range" id="ghost-prob" min="0" max="1" step="0.1" value="0.3" style="width: 100%;">
                    <span id="ghost-prob-val" style="color: #666; font-size: 11px;">0.3</span>
                </div>
                <div>
                    <label style="color: #aaa; font-size: 12px;">Flam Probability</label>
                    <input type="range" id="flam-prob" min="0" max="1" step="0.1" value="0.5" style="width: 100%;">
                    <span id="flam-prob-val" style="color: #666; font-size: 11px;">0.5</span>
                </div>
                <div>
                    <label style="color: #aaa; font-size: 12px;">Groove Template</label>
                    <select id="groove-template" style="width: 100%; padding: 4px; background: #333; color: #fff; border: 1px solid #555;">
                        <option value="straight">Straight</option>
                        <option value="swing">Swing</option>
                        <option value="shuffle">Shuffle</option>
                        <option value="latin">Latin</option>
                    </select>
                </div>
                <div>
                    <label style="color: #aaa; font-size: 12px;">Groove Amount</label>
                    <input type="range" id="groove-amount" min="0" max="1" step="0.1" value="0.5" style="width: 100%;">
                    <span id="groove-amount-val" style="color: #666; font-size: 11px;">0.5</span>
                </div>
                <div>
                    <label style="color: #aaa; font-size: 12px;">Scale</label>
                    <select id="scale-select" style="width: 100%; padding: 4px; background: #333; color: #fff; border: 1px solid #555;">
                        <option value="major">Major</option>
                        <option value="minor">Minor</option>
                        <option value="pentatonic">Pentatonic</option>
                        <option value="blues">Blues</option>
                        <option value="dorian">Dorian</option>
                        <option value="mixolydian">Mixolydian</option>
                    </select>
                </div>
                <div>
                    <label style="color: #aaa; font-size: 12px;">Accent Pattern</label>
                    <select id="accent-pattern" style="width: 100%; padding: 4px; background: #333; color: #fff; border: 1px solid #555;">
                        <option value="strong-weak">Strong-Weak</option>
                        <option value="syncopated">Syncopated</option>
                        <option value="crescendo">Crescendo</option>
                        <option value="decrescendo">Decrescendo</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 15px;">
            <h4 style="color: #888; margin: 0 0 10px 0;">Quick Transforms</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                <button class="transform-btn" data-transform="euclidean" style="padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Euclidean</button>
                <button class="transform-btn" data-transform="ghost" style="padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Ghost Notes</button>
                <button class="transform-btn" data-transform="flams" style="padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Flams</button>
                <button class="transform-btn" data-transform="rolls" style="padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Rolls</button>
                <button class="transform-btn" data-transform="accent" style="padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Accent</button>
                <button class="transform-btn" data-transform="groove" style="padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Groove</button>
                <button class="transform-btn" data-transform="scale" style="padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Scale Quantize</button>
                <button class="transform-btn" data-transform="velocityRamp" style="padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Crescendo</button>
                <button class="transform-btn" data-transform="probability" style="padding: 6px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer;">Probability</button>
            </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button id="apply-variations" style="flex: 1; padding: 10px; background: #4a9eff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Apply to Sequence</button>
            <button id="create-variation" style="flex: 1; padding: 10px; background: #2d8a4e; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Create New Variation</button>
            <button id="preview-variations" style="flex: 1; padding: 10px; background: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Preview</button>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Event handlers
    const closeBtn = panel.querySelector('#close-variations');
    closeBtn.onclick = () => panel.remove();
    
    // Update value displays
    const sliders = ['euclidean-hits', 'euclidean-rotation', 'ghost-prob', 'flam-prob', 'groove-amount'];
    sliders.forEach(id => {
        const slider = panel.querySelector(`#${id}`);
        const display = panel.querySelector(`#${id}-val`);
        if (slider && display) {
            slider.oninput = () => display.textContent = slider.value;
        }
    });
    
    // Transform buttons
    panel.querySelectorAll('.transform-btn').forEach(btn => {
        btn.onclick = () => {
            const transform = btn.dataset.transform;
            applyTransform(transform, getTransformOptions(panel));
        };
    });
    
    // Preset selection
    const presetSelect = panel.querySelector('#variation-preset');
    presetSelect.onchange = () => {
        const presetKey = presetSelect.value;
        if (presetKey && VARIATION_PRESETS[presetKey]) {
            applyPreset(VARIATION_PRESETS[presetKey], trackId, sequenceId);
        }
    };
    
    // Apply button
    const applyBtn = panel.querySelector('#apply-variations');
    applyBtn.onclick = () => {
        const options = getTransformOptions(panel);
        applyAllTransforms(options, trackId, sequenceId, false);
        panel.remove();
    };
    
    // Create variation button
    const createBtn = panel.querySelector('#create-variation');
    createBtn.onclick = () => {
        const options = getTransformOptions(panel);
        applyAllTransforms(options, trackId, sequenceId, true);
        panel.remove();
    };
    
    // Preview button
    const previewBtn = panel.querySelector('#preview-variations');
    previewBtn.onclick = () => {
        const options = getTransformOptions(panel);
        previewTransform(options, trackId, sequenceId);
    };
    
    return panel;
}

function getTransformOptions(panel) {
    return {
        euclidean: {
            hits: parseInt(panel.querySelector('#euclidean-hits').value),
            rotation: parseInt(panel.querySelector('#euclidean-rotation').value)
        },
        ghost: {
            probability: parseFloat(panel.querySelector('#ghost-prob').value)
        },
        flams: {
            probability: parseFloat(panel.querySelector('#flam-prob').value)
        },
        groove: {
            template: panel.querySelector('#groove-template').value,
            amount: parseFloat(panel.querySelector('#groove-amount').value)
        },
        scale: {
            scale: panel.querySelector('#scale-select').value
        },
        accent: {
            pattern: panel.querySelector('#accent-pattern').value
        }
    };
}

function applyTransform(transformType, options) {
    // This would integrate with the Track.js transform system
    console.log(`Applying transform: ${transformType}`, options);
    
    // Emit event for Track.js to handle
    window.dispatchEvent(new CustomEvent('patternVariationTransform', {
        detail: { type: transformType, options: options[transformType] || {} }
    }));
}

function applyPreset(preset, trackId, sequenceId) {
    console.log(`Applying preset: ${preset.name}`, preset.transforms);
    
    window.dispatchEvent(new CustomEvent('patternVariationPreset', {
        detail: { preset, trackId, sequenceId }
    }));
}

function applyAllTransforms(options, trackId, sequenceId, createNew) {
    window.dispatchEvent(new CustomEvent('patternVariationApply', {
        detail: { options, trackId, sequenceId, createNew }
    }));
}

function previewTransform(options, trackId, sequenceId) {
    window.dispatchEvent(new CustomEvent('patternVariationPreview', {
        detail: { options, trackId, sequenceId }
    }));
}

// Export all functions and constants
export default {
    generateEuclideanPattern,
    applyEuclideanTransform,
    addGhostNotes,
    addFlams,
    addRolls,
    applyAccentPattern,
    applyVelocityRamp,
    applyNoteRepeat,
    applyOctaveShift,
    quantizeToScale,
    addNoteProbability,
    applyGrooveTemplate,
    VARIATION_PRESETS,
    openPatternVariationsPanel
};