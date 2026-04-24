/**
 * Pattern Variations System - Create and manage pattern variations
 * Allows creating, storing, and switching between variations of MIDI patterns
 */

class PatternVariationsSystem {
    constructor() {
        this.variations = new Map(); // Map of patternId -> variations array
        this.activeVariations = new Map(); // Map of patternId -> active variation index
        this.maxVariationsPerPattern = 16;
        this.autoVariation = false;
        this.autoVariationMode = 'random'; // random, sequential, weighted
        this.onVariationChange = null;
    }

    // Create a new variation from a sequence
    createVariation(patternId, sequence, name = null) {
        if (!this.variations.has(patternId)) {
            this.variations.set(patternId, []);
        }
        
        const variations = this.variations.get(patternId);
        
        if (variations.length >= this.maxVariationsPerPattern) {
            console.warn(`Max variations (${this.maxVariationsPerPattern}) reached for pattern ${patternId}`);
            return null;
        }
        
        const variation = {
            id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name || `Variation ${variations.length + 1}`,
            sequence: this.cloneSequence(sequence),
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            usageCount: 0,
            tags: [],
            color: this.getVariationColor(variations.length)
        };
        
        variations.push(variation);
        return variation;
    }

    // Clone a sequence deeply
    cloneSequence(sequence) {
        return {
            ...sequence,
            notes: sequence.notes ? sequence.notes.map(n => ({...n})) : [],
            automation: sequence.automation ? JSON.parse(JSON.stringify(sequence.automation)) : {}
        };
    }

    // Get color for variation
    getVariationColor(index) {
        const colors = [
            '#e94560', '#4ecdc4', '#45b7d1', '#96ceb4',
            '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe',
            '#55efc4', '#81ecec', '#74b9ff', '#fab1a0',
            '#6c5ce7', '#00b894', '#e17055', '#fdcb6e'
        ];
        return colors[index % colors.length];
    }

    // Get all variations for a pattern
    getVariations(patternId) {
        return this.variations.get(patternId) || [];
    }

    // Get active variation for a pattern
    getActiveVariation(patternId) {
        const variations = this.variations.get(patternId);
        const activeIndex = this.activeVariations.get(patternId) ?? 0;
        return variations?.[activeIndex] || null;
    }

    // Set active variation
    setActiveVariation(patternId, index) {
        const variations = this.variations.get(patternId);
        if (variations && index >= 0 && index < variations.length) {
            this.activeVariations.set(patternId, index);
            variations[index].usageCount++;
            if (this.onVariationChange) {
                this.onVariationChange(patternId, variations[index]);
            }
            return true;
        }
        return false;
    }

    // Update a variation
    updateVariation(patternId, variationId, updates) {
        const variations = this.variations.get(patternId);
        if (!variations) return false;
        
        const variation = variations.find(v => v.id === variationId);
        if (variation) {
            if (updates.sequence) {
                variation.sequence = this.cloneSequence(updates.sequence);
            }
            if (updates.name) {
                variation.name = updates.name;
            }
            if (updates.tags) {
                variation.tags = updates.tags;
            }
            variation.modifiedAt = Date.now();
            return true;
        }
        return false;
    }

    // Delete a variation
    deleteVariation(patternId, variationId) {
        const variations = this.variations.get(patternId);
        if (!variations) return false;
        
        const index = variations.findIndex(v => v.id === variationId);
        if (index >= 0) {
            variations.splice(index, 1);
            // Adjust active index if needed
            const activeIndex = this.activeVariations.get(patternId) ?? 0;
            if (activeIndex >= variations.length) {
                this.activeVariations.set(patternId, Math.max(0, variations.length - 1));
            }
            return true;
        }
        return false;
    }

    // Create a morphed variation between two variations
    createMorphedVariation(patternId, variationIndex1, variationIndex2, morphAmount = 0.5) {
        const variations = this.variations.get(patternId);
        if (!variations || variations.length < 2) return null;
        
        const var1 = variations[variationIndex1];
        const var2 = variations[variationIndex2];
        if (!var1 || !var2) return null;
        
        const morphedNotes = this.morphNotes(
            var1.sequence.notes,
            var2.sequence.notes,
            morphAmount
        );
        
        const morphedSequence = {
            ...var1.sequence,
            notes: morphedNotes
        };
        
        return this.createVariation(
            patternId,
            morphedSequence,
            `Morph ${Math.round(morphAmount * 100)}%`
        );
    }

    // Morph between two note arrays
    morphNotes(notes1, notes2, amount) {
        const result = [];
        const usedNotes2 = new Set();
        
        // Match notes by approximate time and pitch
        for (const note1 of notes1) {
            let bestMatch = null;
            let bestScore = Infinity;
            
            for (const note2 of notes2) {
                if (usedNotes2.has(note2)) continue;
                
                const timeDiff = Math.abs(note1.time - note2.time);
                const pitchDiff = Math.abs(note1.note - note2.note);
                const score = timeDiff + pitchDiff * 0.1;
                
                if (score < bestScore) {
                    bestScore = score;
                    bestMatch = note2;
                }
            }
            
            if (bestMatch && bestScore < 10) {
                usedNotes2.add(bestMatch);
                result.push({
                    note: Math.round(note1.note + (bestMatch.note - note1.note) * amount),
                    time: note1.time + (bestMatch.time - note1.time) * amount,
                    duration: note1.duration + (bestMatch.duration - note1.duration) * amount,
                    velocity: note1.velocity + (bestMatch.velocity - note1.velocity) * amount
                });
            } else {
                // Fade out unmatched notes
                result.push({
                    ...note1,
                    velocity: note1.velocity * (1 - amount)
                });
            }
        }
        
        // Add faded in notes from notes2 that weren't matched
        for (const note2 of notes2) {
            if (!usedNotes2.has(note2)) {
                result.push({
                    ...note2,
                    velocity: note2.velocity * amount
                });
            }
        }
        
        return result.sort((a, b) => a.time - b.time);
    }

    // Create a randomized variation
    createRandomizedVariation(patternId, baseVariationIndex, options = {}) {
        const variations = this.variations.get(patternId);
        if (!variations) return null;
        
        const baseVariation = variations[baseVariationIndex];
        if (!baseVariation) return null;
        
        const {
            timingVariance = 0.05, // beats
            velocityVariance = 0.1,
            pitchVariance = 0,
            density = 1.0 // note density multiplier
        } = options;
        
        const randomizedNotes = baseVariation.sequence.notes.map(note => ({
            note: note.note + Math.round((Math.random() - 0.5) * pitchVariance * 2),
            time: note.time + (Math.random() - 0.5) * timingVariance * 2,
            duration: note.duration * (0.9 + Math.random() * 0.2),
            velocity: Math.max(0, Math.min(1, note.velocity + (Math.random() - 0.5) * velocityVariance * 2))
        })).filter(() => Math.random() < density);
        
        const randomizedSequence = {
            ...baseVariation.sequence,
            notes: randomizedNotes.sort((a, b) => a.time - b.time)
        };
        
        return this.createVariation(patternId, randomizedSequence, 'Randomized');
    }

    // Auto-select next variation based on mode
    autoSelectVariation(patternId) {
        if (!this.autoVariation) return;
        
        const variations = this.variations.get(patternId);
        if (!variations || variations.length <= 1) return;
        
        let nextIndex;
        
        switch (this.autoVariationMode) {
            case 'sequential':
                const currentIndex = this.activeVariations.get(patternId) ?? 0;
                nextIndex = (currentIndex + 1) % variations.length;
                break;
            
            case 'weighted':
                // Weight by usage count (less used = higher probability)
                const totalUsage = variations.reduce((sum, v) => sum + v.usageCount, 0);
                const weights = variations.map(v => 1 / (1 + v.usageCount));
                const totalWeight = weights.reduce((sum, w) => sum + w, 0);
                let random = Math.random() * totalWeight;
                nextIndex = 0;
                for (let i = 0; i < weights.length; i++) {
                    random -= weights[i];
                    if (random <= 0) {
                        nextIndex = i;
                        break;
                    }
                }
                break;
            
            case 'random':
            default:
                nextIndex = Math.floor(Math.random() * variations.length);
        }
        
        this.setActiveVariation(patternId, nextIndex);
    }

    // Duplicate a variation
    duplicateVariation(patternId, variationId) {
        const variations = this.variations.get(patternId);
        if (!variations) return null;
        
        const original = variations.find(v => v.id === variationId);
        if (!original) return null;
        
        const duplicate = {
            ...original,
            id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${original.name} (copy)`,
            sequence: this.cloneSequence(original.sequence),
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            usageCount: 0
        };
        
        variations.push(duplicate);
        return duplicate;
    }

    // Reorder variations
    reorderVariations(patternId, fromIndex, toIndex) {
        const variations = this.variations.get(patternId);
        if (!variations) return false;
        
        if (fromIndex < 0 || fromIndex >= variations.length ||
            toIndex < 0 || toIndex >= variations.length) {
            return false;
        }
        
        const [variation] = variations.splice(fromIndex, 1);
        variations.splice(toIndex, 0, variation);
        
        // Update active index
        const activeIndex = this.activeVariations.get(patternId) ?? 0;
        if (activeIndex === fromIndex) {
            this.activeVariations.set(patternId, toIndex);
        } else if (activeIndex > fromIndex && activeIndex <= toIndex) {
            this.activeVariations.set(patternId, activeIndex - 1);
        } else if (activeIndex < fromIndex && activeIndex >= toIndex) {
            this.activeVariations.set(patternId, activeIndex + 1);
        }
        
        return true;
    }

    // Get variation statistics
    getStatistics(patternId) {
        const variations = this.variations.get(patternId);
        if (!variations) return null;
        
        return {
            totalVariations: variations.length,
            totalUsage: variations.reduce((sum, v) => sum + v.usageCount, 0),
            mostUsed: variations.reduce((max, v) => v.usageCount > max.usageCount ? v : max, variations[0]),
            leastUsed: variations.reduce((min, v) => v.usageCount < min.usageCount ? v : min, variations[0]),
            newest: variations.reduce((newest, v) => v.createdAt > newest.createdAt ? v : newest, variations[0]),
            oldest: variations.reduce((oldest, v) => v.createdAt < oldest.createdAt ? v : oldest, variations[0])
        };
    }

    // Export variations to JSON
    exportVariations(patternId) {
        const variations = this.variations.get(patternId);
        if (!variations) return null;
        
        return JSON.stringify({
            patternId,
            variations: variations.map(v => ({
                id: v.id,
                name: v.name,
                sequence: v.sequence,
                tags: v.tags,
                color: v.color
            })),
            activeIndex: this.activeVariations.get(patternId) ?? 0
        }, null, 2);
    }

    // Import variations from JSON
    importVariations(patternId, jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.variations && Array.isArray(data.variations)) {
                this.variations.set(patternId, data.variations.map((v, index) => ({
                    ...v,
                    createdAt: Date.now(),
                    modifiedAt: Date.now(),
                    usageCount: 0,
                    color: v.color || this.getVariationColor(index)
                })));
                this.activeVariations.set(patternId, data.activeIndex ?? 0);
                return true;
            }
        } catch (error) {
            console.error('Failed to import variations:', error);
        }
        return false;
    }

    // Clear all variations for a pattern
    clearVariations(patternId) {
        this.variations.delete(patternId);
        this.activeVariations.delete(patternId);
    }

    // Set auto-variation settings
    setAutoVariation(enabled, mode = 'random') {
        this.autoVariation = enabled;
        this.autoVariationMode = mode;
    }
}

// Global instance
let patternVariationsSystem = null;

// Initialize
function initPatternVariationsSystem() {
    if (!patternVariationsSystem) {
        patternVariationsSystem = new PatternVariationsSystem();
    }
    return patternVariationsSystem;
}

// Open pattern variations panel
function openPatternVariationsPanel(patternId, sequence) {
    if (!patternVariationsSystem) {
        initPatternVariationsSystem();
    }
    
    // Create initial variation from current sequence
    if (patternVariationsSystem.getVariations(patternId).length === 0) {
        patternVariationsSystem.createVariation(patternId, sequence, 'Original');
    }
    
    const panel = document.createElement('div');
    panel.id = 'pattern-variations-panel';
    panel.className = 'pattern-variations-panel';
    
    panel.innerHTML = `
        <div class="pv-header">
            <h2>Pattern Variations</h2>
            <button class="pv-close-btn">×</button>
        </div>
        
        <div class="pv-content">
            <div class="pv-toolbar">
                <button class="pv-btn" id="pv-add-variation">+ New Variation</button>
                <button class="pv-btn" id="pv-randomize">🎲 Randomize</button>
                <button class="pv-btn" id="pv-morph">🔀 Morph</button>
                <select id="pv-auto-mode">
                    <option value="off">Auto: Off</option>
                    <option value="random">Auto: Random</option>
                    <option value="sequential">Auto: Sequential</option>
                    <option value="weighted">Auto: Weighted</option>
                </select>
            </div>
            
            <div class="pv-variations-list" id="pv-variations">
                <!-- Variations listed here -->
            </div>
            
            <div class="pv-details" id="pv-details">
                <h3>Select a variation</h3>
            </div>
        </div>
        
        <div class="pv-footer">
            <button class="pv-btn" id="pv-export">Export</button>
            <button class="pv-btn" id="pv-import">Import</button>
            <button class="pv-btn pv-primary" id="pv-apply">Apply</button>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .pattern-variations-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 700px;
            max-width: 90vw;
            max-height: 80vh;
            background: #1a1a2e;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .pv-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #16213e;
            border-radius: 12px 12px 0 0;
        }
        
        .pv-header h2 {
            margin: 0;
            font-size: 18px;
        }
        
        .pv-close-btn {
            background: transparent;
            border: none;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
        }
        
        .pv-content {
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        
        .pv-toolbar {
            padding: 12px 20px;
            background: #0f0f1a;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .pv-btn {
            padding: 8px 16px;
            background: #333;
            border: none;
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            font-size: 13px;
        }
        
        .pv-btn:hover {
            background: #444;
        }
        
        .pv-primary {
            background: #e94560;
        }
        
        .pv-primary:hover {
            background: #ff5a75;
        }
        
        .pv-variations-list {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }
        
        .pv-variation-item {
            display: flex;
            align-items: center;
            padding: 12px;
            margin-bottom: 8px;
            background: #16213e;
            border-radius: 8px;
            cursor: pointer;
            border-left: 4px solid transparent;
        }
        
        .pv-variation-item:hover {
            background: #1f2b4d;
        }
        
        .pv-variation-item.active {
            background: #1f2b4d;
            border-left-color: #e94560;
        }
        
        .pv-variation-color {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            margin-right: 12px;
        }
        
        .pv-variation-name {
            flex: 1;
        }
        
        .pv-variation-stats {
            color: #888;
            font-size: 12px;
        }
        
        .pv-details {
            padding: 16px;
            background: #0f0f1a;
            border-top: 1px solid #333;
        }
        
        .pv-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 16px 20px;
            background: #16213e;
            border-radius: 0 0 12px 12px;
        }
        
        #pv-auto-mode {
            padding: 8px 12px;
            background: #333;
            border: none;
            border-radius: 6px;
            color: #fff;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(panel);
    
    // Render variations
    function renderVariations() {
        const variations = patternVariationsSystem.getVariations(patternId);
        const activeIndex = patternVariationsSystem.activeVariations.get(patternId) ?? 0;
        
        const list = panel.querySelector('#pv-variations');
        list.innerHTML = variations.map((v, i) => `
            <div class="pv-variation-item ${i === activeIndex ? 'active' : ''}" data-index="${i}">
                <div class="pv-variation-color" style="background: ${v.color}"></div>
                <span class="pv-variation-name">${v.name}</span>
                <span class="pv-variation-stats">${v.sequence.notes.length} notes | used ${v.usageCount}x</span>
                <button class="pv-btn" data-action="delete" data-index="${i}" style="padding: 4px 8px; margin-left: 8px;">×</button>
            </div>
        `).join('');
        
        // Add click handlers
        list.querySelectorAll('.pv-variation-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.dataset.action === 'delete') return;
                const index = parseInt(item.dataset.index);
                patternVariationsSystem.setActiveVariation(patternId, index);
                renderVariations();
            });
        });
        
        // Delete buttons
        list.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                const variations = patternVariationsSystem.getVariations(patternId);
                if (variations.length > 1) {
                    patternVariationsSystem.deleteVariation(patternId, variations[index].id);
                    renderVariations();
                }
            });
        });
    }
    
    // Initial render
    renderVariations();
    
    // Event handlers
    panel.querySelector('.pv-close-btn').addEventListener('click', () => panel.remove());
    
    panel.querySelector('#pv-add-variation').addEventListener('click', () => {
        const activeVar = patternVariationsSystem.getActiveVariation(patternId);
        if (activeVar) {
            patternVariationsSystem.createVariation(patternId, activeVar.sequence);
            renderVariations();
        }
    });
    
    panel.querySelector('#pv-randomize').addEventListener('click', () => {
        const activeIndex = patternVariationsSystem.activeVariations.get(patternId) ?? 0;
        patternVariationsSystem.createRandomizedVariation(patternId, activeIndex);
        renderVariations();
    });
    
    panel.querySelector('#pv-morph').addEventListener('click', () => {
        const variations = patternVariationsSystem.getVariations(patternId);
        if (variations.length >= 2) {
            const i1 = Math.floor(Math.random() * variations.length);
            let i2 = Math.floor(Math.random() * variations.length);
            while (i2 === i1) i2 = Math.floor(Math.random() * variations.length);
            patternVariationsSystem.createMorphedVariation(patternId, i1, i2, 0.5);
            renderVariations();
        }
    });
    
    panel.querySelector('#pv-auto-mode').addEventListener('change', (e) => {
        const mode = e.target.value;
        patternVariationsSystem.setAutoVariation(mode !== 'off', mode);
    });
    
    panel.querySelector('#pv-export').addEventListener('click', () => {
        const data = patternVariationsSystem.exportVariations(patternId);
        if (data) {
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `variations_${patternId}.json`;
            a.click();
        }
    });
    
    panel.querySelector('#pv-apply').addEventListener('click', () => {
        const activeVar = patternVariationsSystem.getActiveVariation(patternId);
        if (activeVar && patternVariationsSystem.onVariationChange) {
            patternVariationsSystem.onVariationChange(patternId, activeVar);
        }
        panel.remove();
    });
    
    return patternVariationsSystem;
}

// Export
window.PatternVariationsSystem = PatternVariationsSystem;
window.initPatternVariationsSystem = initPatternVariationsSystem;
window.openPatternVariationsPanel = openPatternVariationsPanel;