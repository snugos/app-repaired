/**
 * Step Sequencer Probability Enhancement - Conditional probability
 * Advanced probability system for step sequencer with conditional logic
 */

// Conditional Probability State
const conditionalProbState = {
    // Per-step probability settings
    stepProbabilities: new Map(), // stepId -> probability config
    
    // Conditional rules
    conditionalRules: [],
    
    // Global probability settings
    globalProbability: {
        enabled: false,
        baseProbability: 100,
        variation: 0,
        mode: 'random' // random, weighted, conditional
    },
    
    // Context tracking
    lastStepPlayed: null,
    recentSteps: [], // Last N steps played
    stepHistory: [], // Full history for analysis
    
    // Rule types
    ruleTypes: {
        afterStep: {
            name: 'After Step',
            description: 'Probability changes after a specific step is played'
        },
        consecutivePlays: {
            name: 'Consecutive Plays',
            description: 'Probability decreases after consecutive plays'
        },
        consecutiveSkips: {
            name: 'Consecutive Skips',
            description: 'Probability increases after consecutive skips'
        },
        stepDensity: {
            name: 'Step Density',
            description: 'Probability based on how many recent steps played'
        },
        patternPosition: {
            name: 'Pattern Position',
            description: 'Probability varies by position in pattern'
        },
        measurePosition: {
            name: 'Measure Position',
            description: 'Probability varies by position in measure'
        },
        velocityThreshold: {
            name: 'Velocity Threshold',
            description: 'Probability based on incoming velocity'
        },
        randomWalk: {
            name: 'Random Walk',
            description: 'Probability drifts randomly over time'
        },
        euclidean: {
            name: 'Euclidean',
            description: 'Euclidean rhythm-based probability'
        }
    },
    
    // Probability presets
    presets: {
        basic: {
            name: 'Basic',
            description: 'Simple fixed probability per step'
        },
        groove: {
            name: 'Groove',
            description: 'Probability varies for groove feel'
        },
        fill: {
            name: 'Fill Builder',
            description: 'Increasing probability towards pattern end'
        },
        sparse: {
            name: 'Sparse',
            description: 'Low density with occasional hits'
        },
        dense: {
            name: 'Dense',
            description: 'High density with occasional skips'
        },
        evolving: {
            name: 'Evolving',
            description: 'Probability evolves over time'
        },
        reactive: {
            name: 'Reactive',
            description: 'Probability responds to what was played'
        },
        chaotic: {
            name: 'Chaotic',
            description: 'Highly unpredictable patterns'
        }
    },
    
    // Callbacks
    onProbabilityChange: null,
    onRuleTrigger: null
};

/**
 * Set step probability
 */
function setStepProbability(stepId, probability, options = {}) {
    const config = {
        stepId,
        baseProbability: probability, // 0-100
        conditions: options.conditions || [],
        modifiers: options.modifiers || [],
        minValue: options.minValue || 0,
        maxValue: options.maxValue || 100,
        currentProbability: probability,
        lastResult: null,
        playCount: 0,
        skipCount: 0
    };
    
    conditionalProbState.stepProbabilities.set(stepId, config);
    
    if (conditionalProbState.onProbabilityChange) {
        conditionalProbState.onProbabilityChange(stepId, config);
    }
    
    return { success: true, config };
}

/**
 * Get effective probability for a step
 */
function getEffectiveProbability(stepId, context = {}) {
    const config = conditionalProbState.stepProbabilities.get(stepId);
    if (!config) return 100; // Default always play
    
    let probability = config.baseProbability;
    
    // Apply conditional modifiers
    for (const rule of conditionalProbState.conditionalRules) {
        if (rule.enabled && rule.appliesTo.includes(stepId)) {
            const modifier = evaluateConditionalRule(rule, stepId, context);
            probability = probability * modifier;
        }
    }
    
    // Apply step-specific conditions
    for (const condition of config.conditions) {
        const modifier = evaluateCondition(condition, stepId, context);
        probability = probability * modifier;
    }
    
    // Clamp to valid range
    probability = Math.max(config.minValue, Math.min(config.maxValue, probability));
    
    // Update current probability
    config.currentProbability = probability;
    
    return probability;
}

/**
 * Determine if step should play
 */
function shouldStepPlay(stepId, context = {}) {
    const probability = getEffectiveProbability(stepId, context);
    const random = Math.random() * 100;
    const shouldPlay = random < probability;
    
    // Update step stats
    const config = conditionalProbState.stepProbabilities.get(stepId);
    if (config) {
        config.lastResult = shouldPlay;
        if (shouldPlay) {
            config.playCount++;
        } else {
            config.skipCount++;
        }
    }
    
    // Update history
    conditionalProbState.stepHistory.push({
        stepId,
        played: shouldPlay,
        probability,
        timestamp: Date.now()
    });
    
    // Update recent steps (keep last 16)
    conditionalProbState.recentSteps.push({ stepId, played: shouldPlay });
    if (conditionalProbState.recentSteps.length > 16) {
        conditionalProbState.recentSteps.shift();
    }
    
    conditionalProbState.lastStepPlayed = shouldPlay ? stepId : null;
    
    return shouldPlay;
}

/**
 * Create conditional rule
 */
function createConditionalRule(type, config) {
    const rule = {
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        enabled: true,
        appliesTo: config.appliesTo || 'all', // 'all', or array of step IDs
        priority: config.priority || 0,
        
        // Type-specific config
        config: {
            ...config
        },
        
        // Statistics
        triggerCount: 0,
        lastTriggered: null
    };
    
    conditionalProbState.conditionalRules.push(rule);
    conditionalProbState.conditionalRules.sort((a, b) => b.priority - a.priority);
    
    return { success: true, rule };
}

/**
 * Evaluate a conditional rule
 */
function evaluateConditionalRule(rule, stepId, context) {
    // Check if rule applies to this step
    if (rule.appliesTo !== 'all' && !rule.appliesTo.includes(stepId)) {
        return 1; // No modification
    }
    
    let modifier = 1;
    
    switch (rule.type) {
        case 'afterStep':
            modifier = evaluateAfterStepRule(rule, stepId);
            break;
            
        case 'consecutivePlays':
            modifier = evaluateConsecutivePlaysRule(rule, stepId);
            break;
            
        case 'consecutiveSkips':
            modifier = evaluateConsecutiveSkipsRule(rule, stepId);
            break;
            
        case 'stepDensity':
            modifier = evaluateStepDensityRule(rule);
            break;
            
        case 'patternPosition':
            modifier = evaluatePatternPositionRule(rule, context);
            break;
            
        case 'measurePosition':
            modifier = evaluateMeasurePositionRule(rule, context);
            break;
            
        case 'velocityThreshold':
            modifier = evaluateVelocityThresholdRule(rule, context);
            break;
            
        case 'randomWalk':
            modifier = evaluateRandomWalkRule(rule, stepId);
            break;
            
        case 'euclidean':
            modifier = evaluateEuclideanRule(rule, context);
            break;
    }
    
    // Track rule trigger
    if (modifier !== 1) {
        rule.triggerCount++;
        rule.lastTriggered = Date.now();
        
        if (conditionalProbState.onRuleTrigger) {
            conditionalProbState.onRuleTrigger(rule, modifier);
        }
    }
    
    return modifier;
}

/**
 * Evaluate "After Step" rule
 */
function evaluateAfterStepRule(rule, stepId) {
    const config = rule.config;
    const targetStepId = config.targetStep;
    
    // Check if target step was recently played
    const recentIndex = conditionalProbState.recentSteps.findIndex(
        s => s.stepId === targetStepId
    );
    
    if (recentIndex >= 0 && config.lookbackDistance >= recentIndex) {
        // Target was played, apply modifier
        if (config.targetWasPlayed) {
            return config.playedModifier || 0.5;
        } else {
            return config.notPlayedModifier || 1.5;
        }
    }
    
    return 1;
}

/**
 * Evaluate "Consecutive Plays" rule
 */
function evaluateConsecutivePlaysRule(rule, stepId) {
    const config = rule.config;
    let consecutive = 0;
    
    for (let i = conditionalProbState.recentSteps.length - 1; i >= 0; i--) {
        const step = conditionalProbState.recentSteps[i];
        if (step.played) {
            consecutive++;
        } else {
            break;
        }
    }
    
    if (consecutive >= config.threshold) {
        // Reduce probability after threshold consecutive plays
        return Math.max(0.1, 1 - (consecutive - config.threshold) * config.decayRate);
    }
    
    return 1;
}

/**
 * Evaluate "Consecutive Skips" rule
 */
function evaluateConsecutiveSkipsRule(rule, stepId) {
    const config = rule.config;
    let consecutive = 0;
    
    for (let i = conditionalProbState.recentSteps.length - 1; i >= 0; i--) {
        const step = conditionalProbState.recentSteps[i];
        if (!step.played) {
            consecutive++;
        } else {
            break;
        }
    }
    
    if (consecutive >= config.threshold) {
        // Increase probability after threshold consecutive skips
        return Math.min(2.0, 1 + (consecutive - config.threshold) * config.increaseRate);
    }
    
    return 1;
}

/**
 * Evaluate "Step Density" rule
 */
function evaluateStepDensityRule(rule) {
    const config = rule.config;
    const recentSteps = conditionalProbState.recentSteps.slice(-config.windowSize || 8);
    
    const playedCount = recentSteps.filter(s => s.played).length;
    const density = playedCount / recentSteps.length;
    
    if (density > config.highThreshold) {
        return config.highDensityModifier || 0.7;
    } else if (density < config.lowThreshold) {
        return config.lowDensityModifier || 1.3;
    }
    
    return 1;
}

/**
 * Evaluate "Pattern Position" rule
 */
function evaluatePatternPositionRule(rule, context) {
    const config = rule.config;
    const position = context.patternPosition || 0; // 0-1
    const patternLength = context.patternLength || 16;
    const stepIndex = context.stepIndex || 0;
    
    if (config.curve === 'linear') {
        return config.startValue + (config.endValue - config.startValue) * position;
    } else if (config.curve === 'fill') {
        // Increase towards end
        const fillPoint = config.fillStart || 0.75;
        if (position > fillPoint) {
            return 1 + (position - fillPoint) * 2;
        }
        return 1;
    } else if (config.curve === 'sparse') {
        // Decrease towards end
        return 1 - position * 0.5;
    }
    
    return 1;
}

/**
 * Evaluate "Measure Position" rule
 */
function evaluateMeasurePositionRule(rule, context) {
    const config = rule.config;
    const measurePosition = context.measurePosition || 0; // 0-1
    const beat = context.beat || 0;
    
    // Apply modifiers based on position
    const beatModifiers = config.beatModifiers || [1, 1, 1, 1];
    
    if (beat < beatModifiers.length) {
        return beatModifiers[beat];
    }
    
    return 1;
}

/**
 * Evaluate "Velocity Threshold" rule
 */
function evaluateVelocityThresholdRule(rule, context) {
    const config = rule.config;
    const velocity = context.velocity || 100;
    
    if (velocity > config.highThreshold) {
        return config.highVelocityModifier || 1.2;
    } else if (velocity < config.lowThreshold) {
        return config.lowVelocityModifier || 0.8;
    }
    
    return 1;
}

/**
 * Evaluate "Random Walk" rule
 */
function evaluateRandomWalkRule(rule, stepId) {
    const config = rule.config;
    const stepConfig = conditionalProbState.stepProbabilities.get(stepId);
    
    if (!stepConfig) return 1;
    
    // Drift probability randomly
    const drift = (Math.random() - 0.5) * 2 * (config.driftRate || 0.1);
    stepConfig.baseProbability = Math.max(config.minDrift || 10, 
        Math.min(config.maxDrift || 100, 
            stepConfig.baseProbability + drift * 100));
    
    return stepConfig.baseProbability / 100;
}

/**
 * Evaluate "Euclidean" rule
 */
function evaluateEuclideanRule(rule, context) {
    const config = rule.config;
    const stepIndex = context.stepIndex || 0;
    const patternLength = context.patternLength || 16;
    const hits = config.hits || 8;
    
    // Euclidean rhythm algorithm
    const pattern = generateEuclideanPattern(patternLength, hits);
    
    // Return 0 or 1 based on euclidean pattern
    return pattern[stepIndex % patternLength] ? config.playModifier || 1.5 : config.skipModifier || 0.5;
}

/**
 * Generate Euclidean rhythm pattern
 */
function generateEuclideanPattern(steps, hits) {
    if (hits === 0) return new Array(steps).fill(false);
    if (hits >= steps) return new Array(steps).fill(true);
    
    const pattern = [];
    let groups = [];
    
    // Initialize groups with single hits and rests
    for (let i = 0; i < hits; i++) {
        groups.push([true]);
    }
    for (let i = 0; i < steps - hits; i++) {
        groups[i % hits].push(false);
    }
    
    // Interleave until we have the right number of groups
    while (groups.length > hits && groups.length !== steps) {
        const newGroups = [];
        for (let i = 0; i < Math.min(hits, groups.length - hits); i++) {
            newGroups.push([...groups[i], ...groups[hits + i]]);
        }
        for (let i = newGroups.length; i < hits; i++) {
            if (groups[i]) newGroups.push(groups[i]);
        }
        groups = newGroups;
    }
    
    // Flatten
    for (const group of groups) {
        pattern.push(...group);
    }
    
    return pattern;
}

/**
 * Apply preset to steps
 */
function applyProbabilityPreset(presetName, stepIds, config = {}) {
    const preset = conditionalProbState.presets[presetName];
    if (!preset) {
        return { success: false, error: 'Unknown preset' };
    }
    
    for (const stepId of stepIds) {
        switch (presetName) {
            case 'basic':
                setStepProbability(stepId, config.probability || 50);
                break;
                
            case 'groove':
                // Slight variations for groove
                const grooveBase = config.baseProbability || 70;
                const variation = Math.random() * 20 - 10;
                setStepProbability(stepId, grooveBase + variation);
                break;
                
            case 'fill':
                // Increase towards end
                const position = stepIds.indexOf(stepId) / stepIds.length;
                const fillProb = 30 + position * 70;
                setStepProbability(stepId, fillProb);
                break;
                
            case 'sparse':
                setStepProbability(stepId, config.probability || 25);
                break;
                
            case 'dense':
                setStepProbability(stepId, config.probability || 85);
                break;
                
            case 'evolving':
                setStepProbability(stepId, 50);
                createConditionalRule('randomWalk', {
                    appliesTo: [stepId],
                    driftRate: 0.05,
                    minDrift: 20,
                    maxDrift: 100
                });
                break;
                
            case 'reactive':
                setStepProbability(stepId, 50);
                createConditionalRule('consecutivePlays', {
                    appliesTo: [stepId],
                    threshold: 2,
                    decayRate: 0.2
                });
                break;
                
            case 'chaotic':
                setStepProbability(stepId, Math.random() * 100);
                break;
        }
    }
    
    return { success: true };
}

/**
 * Clear all probability settings
 */
function clearAllProbabilities() {
    conditionalProbState.stepProbabilities.clear();
    conditionalProbState.conditionalRules = [];
    conditionalProbState.stepHistory = [];
    conditionalProbState.recentSteps = [];
    
    return { success: true };
}

/**
 * Get probability statistics
 */
function getProbabilityStatistics(stepId) {
    const config = conditionalProbState.stepProbabilities.get(stepId);
    if (!config) return null;
    
    const history = conditionalProbState.stepHistory.filter(h => h.stepId === stepId);
    
    return {
        stepId,
        baseProbability: config.baseProbability,
        currentProbability: config.currentProbability,
        playCount: config.playCount,
        skipCount: config.skipCount,
        totalAttempts: config.playCount + config.skipCount,
        actualProbability: config.playCount / (config.playCount + config.skipCount) * 100 || 0,
        lastResult: config.lastResult,
        history: history.slice(-20)
    };
}

/**
 * Get all rules
 */
function getConditionalRules() {
    return conditionalProbState.conditionalRules;
}

/**
 * Delete rule
 */
function deleteConditionalRule(ruleId) {
    const index = conditionalProbState.conditionalRules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
        conditionalProbState.conditionalRules.splice(index, 1);
        return { success: true };
    }
    return { success: false, error: 'Rule not found' };
}

/**
 * Toggle rule
 */
function toggleConditionalRule(ruleId, enabled) {
    const rule = conditionalProbState.conditionalRules.find(r => r.id === ruleId);
    if (rule) {
        rule.enabled = enabled;
        return { success: true };
    }
    return { success: false, error: 'Rule not found' };
}

/**
 * Get rule types
 */
function getRuleTypes() {
    return Object.entries(conditionalProbState.ruleTypes).map(([key, type]) => ({
        id: key,
        ...type
    }));
}

/**
 * Get presets
 */
function getProbabilityPresets() {
    return Object.entries(conditionalProbState.presets).map(([key, preset]) => ({
        id: key,
        ...preset
    }));
}

/**
 * Export probability settings
 */
function exportProbabilitySettings() {
    return JSON.stringify({
        stepProbabilities: Array.from(conditionalProbState.stepProbabilities.entries()),
        conditionalRules: conditionalProbState.conditionalRules,
        globalProbability: conditionalProbState.globalProbability
    }, null, 2);
}

/**
 * Import probability settings
 */
function importProbabilitySettings(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        conditionalProbState.stepProbabilities = new Map(data.stepProbabilities || []);
        conditionalProbState.conditionalRules = data.conditionalRules || [];
        conditionalProbState.globalProbability = data.globalProbability || conditionalProbState.globalProbability;
        
        return { success: true };
    } catch (error) {
        return { success: false, error: 'Failed to parse settings' };
    }
}

// Export functions
window.setStepProbability = setStepProbability;
window.getEffectiveProbability = getEffectiveProbability;
window.shouldStepPlay = shouldStepPlay;
window.createConditionalRule = createConditionalRule;
window.applyProbabilityPreset = applyProbabilityPreset;
window.clearAllProbabilities = clearAllProbabilities;
window.getProbabilityStatistics = getProbabilityStatistics;
window.getConditionalRules = getConditionalRules;
window.deleteConditionalRule = deleteConditionalRule;
window.toggleConditionalRule = toggleConditionalRule;
window.getRuleTypes = getRuleTypes;
window.getProbabilityPresets = getProbabilityPresets;
window.exportProbabilitySettings = exportProbabilitySettings;
window.importProbabilitySettings = importProbabilitySettings;
window.conditionalProbState = conditionalProbState;

console.log('[StepSequencerProbabilityEnhancement] Module loaded');