/**
 * Pattern Morphing - Smoothly transition between patterns
 * Provides interpolation between MIDI patterns for creative transitions
 */

class PatternMorphing {
    constructor() {
        this.morphDuration = 4; // seconds
        this.morphCurve = 'linear'; // linear, exponential, sine, ease-in, ease-out
        this.sourcePattern = null;
        this.targetPattern = null;
        this.morphProgress = 0;
        this.isPlaying = false;
        this.morphSteps = [];
        this.onMorphComplete = null;
        this.onMorphProgress = null;
        this.availableCurves = {
            linear: t => t,
            exponential: t => t * t,
            'ease-in': t => t * t,
            'ease-out': t => 1 - (1 - t) * (1 - t),
            sine: t => (1 - Math.cos(t * Math.PI)) / 2,
            'ease-in-out': t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        };
    }

    /**
     * Set source pattern for morphing
     * @param {Object} pattern - Source pattern with notes
     */
    setSourcePattern(pattern) {
        this.sourcePattern = this.normalizePattern(pattern);
        return this;
    }

    /**
     * Set target pattern for morphing
     * @param {Object} pattern - Target pattern with notes
     */
    setTargetPattern(pattern) {
        this.targetPattern = this.normalizePattern(pattern);
        return this;
    }

    /**
     * Normalize pattern for morphing
     */
    normalizePattern(pattern) {
        if (!pattern) return null;

        const normalized = {
            id: pattern.id,
            name: pattern.name,
            duration: pattern.duration || 4,
            notes: []
        };

        if (pattern.notes && Array.isArray(pattern.notes)) {
            normalized.notes = pattern.notes.map(note => ({
                pitch: note.pitch || note.midi || 60,
                velocity: note.velocity || 100,
                start: note.start || note.time || 0,
                duration: note.duration || note.length || 0.5,
                pan: note.pan || 0,
                probability: note.probability || 1
            }));
        }

        return normalized;
    }

    /**
     * Calculate morph between two patterns
     * @param {number} progress - Morph progress (0-1)
     * @returns {Object} - Morphed pattern
     */
    calculateMorph(progress) {
        if (!this.sourcePattern || !this.targetPattern) {
            return null;
        }

        const curve = this.availableCurves[this.morphCurve] || this.availableCurves.linear;
        const curvedProgress = curve(Math.max(0, Math.min(1, progress)));

        const morphedNotes = [];
        const matchedPairs = this.matchNotes(this.sourcePattern.notes, this.targetPattern.notes);

        // Process matched note pairs
        for (const pair of matchedPairs) {
            if (pair.source && pair.target) {
                // Interpolate between matched notes
                const morphedNote = {
                    pitch: this.interpolateDiscrete(pair.source.pitch, pair.target.pitch, curvedProgress),
                    velocity: this.interpolateLinear(pair.source.velocity, pair.target.velocity, curvedProgress),
                    start: this.interpolateLinear(pair.source.start, pair.target.start, curvedProgress),
                    duration: this.interpolateLinear(pair.source.duration, pair.target.duration, curvedProgress),
                    pan: this.interpolateLinear(pair.source.pan, pair.target.pan, curvedProgress),
                    probability: this.interpolateLinear(pair.source.probability, pair.target.probability, curvedProgress),
                    sourceId: pair.source.id,
                    targetId: pair.target.id
                };
                morphedNotes.push(morphedNote);
            } else if (pair.source && progress < 0.5) {
                // Fade out source-only notes
                const fadeNote = { ...pair.source };
                fadeNote.velocity = pair.source.velocity * (1 - curvedProgress * 2);
                fadeNote.probability = pair.source.probability * (1 - curvedProgress * 2);
                if (fadeNote.velocity > 5) {
                    morphedNotes.push(fadeNote);
                }
            } else if (pair.target && progress > 0.5) {
                // Fade in target-only notes
                const fadeNote = { ...pair.target };
                fadeNote.velocity = pair.target.velocity * ((curvedProgress - 0.5) * 2);
                fadeNote.probability = pair.target.probability * ((curvedProgress - 0.5) * 2);
                if (fadeNote.velocity > 5) {
                    morphedNotes.push(fadeNote);
                }
            }
        }

        // Calculate morphed duration
        const duration = this.interpolateLinear(
            this.sourcePattern.duration,
            this.targetPattern.duration,
            curvedProgress
        );

        return {
            id: `morph-${Date.now()}`,
            name: `Morph: ${this.sourcePattern.name} → ${this.targetPattern.name}`,
            duration,
            notes: morphedNotes,
            progress: progress,
            curvedProgress
        };
    }

    /**
     * Match notes between source and target patterns
     */
    matchNotes(sourceNotes, targetNotes) {
        const pairs = [];
        const usedSource = new Set();
        const usedTarget = new Set();

        // Sort notes by start time
        const sortedSource = [...sourceNotes].sort((a, b) => a.start - b.start);
        const sortedTarget = [...targetNotes].sort((a, b) => a.start - b.start);

        // First pass: exact pitch matches at similar times
        for (let i = 0; i < sortedSource.length; i++) {
            const src = sortedSource[i];
            for (let j = 0; j < sortedTarget.length; j++) {
                const tgt = sortedTarget[j];
                if (!usedTarget.has(j) && src.pitch === tgt.pitch) {
                    const timeDiff = Math.abs(src.start - tgt.start);
                    if (timeDiff < 0.25) { // Within a quarter beat
                        pairs.push({ source: src, target: tgt, distance: timeDiff });
                        usedSource.add(i);
                        usedTarget.add(j);
                        break;
                    }
                }
            }
        }

        // Second pass: closest notes by pitch and time
        for (let i = 0; i < sortedSource.length; i++) {
            if (usedSource.has(i)) continue;
            const src = sortedSource[i];

            let bestMatch = null;
            let bestDistance = Infinity;

            for (let j = 0; j < sortedTarget.length; j++) {
                if (usedTarget.has(j)) continue;
                const tgt = sortedTarget[j];

                const pitchDiff = Math.abs(src.pitch - tgt.pitch);
                const timeDiff = Math.abs(src.start - tgt.start);
                const distance = pitchDiff * 0.1 + timeDiff; // Weight pitch less

                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = { source: src, target: tgt, index: j, distance };
                }
            }

            if (bestMatch && bestDistance < 5) { // Threshold for matching
                pairs.push(bestMatch);
                usedSource.add(i);
                usedTarget.add(bestMatch.index);
            } else {
                pairs.push({ source: src, target: null });
            }
        }

        // Add remaining target notes
        for (let j = 0; j < sortedTarget.length; j++) {
            if (!usedTarget.has(j)) {
                pairs.push({ source: null, target: sortedTarget[j] });
            }
        }

        // Sort pairs by time
        pairs.sort((a, b) => {
            const aTime = a.source?.start ?? a.target?.start ?? 0;
            const bTime = b.source?.start ?? b.target?.start ?? 0;
            return aTime - bTime;
        });

        return pairs;
    }

    /**
     * Linear interpolation
     */
    interpolateLinear(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Discrete interpolation for pitch (snap to nearest semitone)
     */
    interpolateDiscrete(a, b, t) {
        const value = a + (b - a) * t;
        return Math.round(value);
    }

    /**
     * Set morph duration
     */
    setDuration(duration) {
        this.morphDuration = Math.max(0.1, duration);
        return this;
    }

    /**
     * Set morph curve
     */
    setCurve(curveName) {
        if (this.availableCurves[curveName]) {
            this.morphCurve = curveName;
        }
        return this;
    }

    /**
     * Generate morph steps for playback
     * @param {number} numSteps - Number of intermediate steps
     * @returns {Array} - Array of morphed patterns
     */
    generateMorphSteps(numSteps = 20) {
        this.morphSteps = [];
        
        for (let i = 0; i <= numSteps; i++) {
            const progress = i / numSteps;
            const step = this.calculateMorph(progress);
            if (step) {
                this.morphSteps.push(step);
            }
        }
        
        return this.morphSteps;
    }

    /**
     * Get morph step at progress
     * @param {number} progress - Progress (0-1)
     * @returns {Object} - Morphed pattern at that point
     */
    getStep(progress) {
        return this.calculateMorph(progress);
    }

    /**
     * Preview morph at specific points
     * @returns {Array} - Array of preview patterns at 0%, 25%, 50%, 75%, 100%
     */
    getPreviewMorphs() {
        return [0, 0.25, 0.5, 0.75, 1].map(p => ({
            progress: p * 100,
            pattern: this.calculateMorph(p)
        }));
    }

    /**
     * Open morphing panel UI
     */
    openMorphingPanel(availablePatterns, onApply) {
        const existing = document.getElementById('pattern-morph-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'pattern-morph-panel';

        const patternOptions = availablePatterns
            .map(p => `<option value="${p.id}">${p.name}</option>`)
            .join('');

        const curveOptions = Object.keys(this.availableCurves)
            .map(c => `<option value="${c}">${c}</option>`)
            .join('');

        panel.innerHTML = `
            <div class="morph-content" style="background: #1a1a2e; padding: 20px; border-radius: 8px; max-width: 700px;">
                <h3 style="margin: 0 0 16px 0; color: #fff; font-size: 18px;">🔄 Pattern Morphing</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">Source Pattern</label>
                        <select id="morph-source" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                            <option value="">Select pattern...</option>
                            ${patternOptions}
                        </select>
                    </div>
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">Target Pattern</label>
                        <select id="morph-target" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                            <option value="">Select pattern...</option>
                            ${patternOptions}
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">Morph Duration (seconds)</label>
                        <input type="number" id="morph-duration" value="${this.morphDuration}" min="0.5" max="60" step="0.5"
                            style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                    </div>
                    <div>
                        <label style="color: #a0a0a0; font-size: 12px;">Morph Curve</label>
                        <select id="morph-curve" style="width: 100%; margin-top: 8px; padding: 10px; background: #2a2a4e; color: #fff; border: 1px solid #3b3b5e; border-radius: 4px;">
                            ${curveOptions}
                        </select>
                    </div>
                </div>

                <div id="morph-preview" style="display: none; background: #2a2a4e; padding: 16px; border-radius: 4px; margin-bottom: 16px;">
                    <div style="color: #a0a0a0; font-size: 12px; margin-bottom: 12px;">Morph Preview</div>
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 10px; color: #6b7280;">0%</div>
                            <div id="preview-0" style="height: 60px; background: #1a1a2e; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #a0a0a0;">Source</div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 10px; color: #6b7280;">25%</div>
                            <div id="preview-25" style="height: 60px; background: #1a1a2e; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #a0a0a0;"></div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 10px; color: #6b7280;">50%</div>
                            <div id="preview-50" style="height: 60px; background: #1a1a2e; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #a0a0a0;"></div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 10px; color: #6b7280;">75%</div>
                            <div id="preview-75" style="height: 60px; background: #1a1a2e; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #a0a0a0;"></div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 10px; color: #6b7280;">100%</div>
                            <div id="preview-100" style="height: 60px; background: #1a1a2e; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #a0a0a0;">Target</div>
                        </div>
                    </div>
                    <div id="morph-info" style="color: #a0a0a0; font-size: 11px;"></div>
                </div>

                <div style="margin-bottom: 16px;">
                    <label style="color: #a0a0a0; font-size: 12px;">Real-time Slider</label>
                    <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                        <span style="color: #6b7280; font-size: 12px;">Source</span>
                        <input type="range" id="morph-slider" min="0" max="100" value="0" 
                            style="flex: 1; accent-color: #8b5cf6;">
                        <span style="color: #6b7280; font-size: 12px;">Target</span>
                        <span id="morph-percent" style="color: #fff; font-size: 14px; font-weight: bold; min-width: 50px;">0%</span>
                    </div>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button id="morph-preview-btn" style="flex: 1; padding: 12px; background: #3b82f6; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Generate Preview
                    </button>
                    <button id="morph-apply-btn" style="flex: 1; padding: 12px; background: #10b981; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;" disabled>
                        Create Morph Pattern
                    </button>
                    <button id="morph-close-btn" style="padding: 12px 20px; background: #374151; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #pattern-morph-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10000;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // State
        let currentProgress = 0;
        let previewGenerated = false;

        // Event handlers
        const sourceSelect = document.getElementById('morph-source');
        const targetSelect = document.getElementById('morph-target');
        const durationInput = document.getElementById('morph-duration');
        const curveSelect = document.getElementById('morph-curve');
        const slider = document.getElementById('morph-slider');
        const percentSpan = document.getElementById('morph-percent');
        const previewBtn = document.getElementById('morph-preview-btn');
        const applyBtn = document.getElementById('morph-apply-btn');
        const closeBtn = document.getElementById('morph-close-btn');
        const previewDiv = document.getElementById('morph-preview');
        const morphInfo = document.getElementById('morph-info');

        // Update slider display
        slider.addEventListener('input', (e) => {
            currentProgress = parseInt(e.target.value);
            percentSpan.textContent = `${currentProgress}%`;
            
            if (previewGenerated) {
                updatePreviewDisplay();
            }
        });

        // Update settings
        durationInput.addEventListener('change', (e) => {
            this.setDuration(parseFloat(e.target.value));
        });

        curveSelect.addEventListener('change', (e) => {
            this.setCurve(e.target.value);
            if (previewGenerated) {
                generatePreview();
            }
        });

        // Pattern selection
        const updatePatternSelection = () => {
            previewGenerated = false;
            previewDiv.style.display = 'none';
            applyBtn.disabled = true;

            const sourceId = sourceSelect.value;
            const targetId = targetSelect.value;

            if (sourceId && targetId && sourceId !== targetId) {
                const sourcePattern = availablePatterns.find(p => p.id === sourceId);
                const targetPattern = availablePatterns.find(p => p.id === targetId);
                
                if (sourcePattern && targetPattern) {
                    this.setSourcePattern(sourcePattern);
                    this.setTargetPattern(targetPattern);
                    previewBtn.disabled = false;
                }
            } else {
                previewBtn.disabled = true;
            }
        };

        sourceSelect.addEventListener('change', updatePatternSelection);
        targetSelect.addEventListener('change', updatePatternSelection);

        // Generate preview
        const generatePreview = () => {
            if (!this.sourcePattern || !this.targetPattern) return;

            const previews = this.getPreviewMorphs();
            previewGenerated = true;
            previewDiv.style.display = 'block';
            applyBtn.disabled = false;

            // Update preview displays
            previews.forEach(p => {
                const el = document.getElementById(`preview-${p.progress}`);
                if (el) {
                    el.innerHTML = `<span>${p.pattern?.notes?.length || 0} notes</span>`;
                }
            });

            // Update info
            morphInfo.innerHTML = `
                Source: ${this.sourcePattern.notes.length} notes | 
                Target: ${this.targetPattern.notes.length} notes | 
                Duration: ${this.sourcePattern.duration}s → ${this.targetPattern.duration}s
            `;

            updatePreviewDisplay();
        };

        previewBtn.addEventListener('click', generatePreview);

        // Update preview display
        const updatePreviewDisplay = () => {
            const step = this.getStep(currentProgress / 100);
            if (step) {
                percentSpan.textContent = `${currentProgress}% (${step.notes.length} notes)`;
            }
        };

        // Apply morph
        applyBtn.addEventListener('click', () => {
            const morphedPattern = this.getStep(currentProgress / 100);
            
            if (morphedPattern && onApply) {
                onApply(morphedPattern);
            }

            panel.remove();
            style.remove();
        });

        // Close
        closeBtn.addEventListener('click', () => {
            panel.remove();
            style.remove();
        });

        // Initialize
        curveSelect.value = this.morphCurve;
    }
}

// Export singleton
const patternMorphing = new PatternMorphing();

export { PatternMorphing, patternMorphing };