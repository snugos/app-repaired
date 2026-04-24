/**
 * PerformanceMode.js
 * Live performance interface with scene triggering
 */

// Scene types
export const SCENE_TYPES = {
    LINEAR: 'linear',
    LOOP: 'loop',
    ONE_SHOT: 'one_shot',
    TRIGGER: 'trigger'
};

// Trigger modes
export const TRIGGER_MODES = {
    IMMEDIATE: 'immediate',
    QUANTIZED: 'quantized',
    NEXT_BEAT: 'next_beat',
    NEXT_BAR: 'next_bar'
};

// Performance state
let isPerformanceMode = false;
let performanceContainer = null;
let scenes = [];
let currentSceneIndex = -1;
let sceneGrid = null;
let launchQuantize = TRIGGER_MODES.NEXT_BEAT;
let bpm = 120;
let isPlaying = false;

// Scene class
export class Scene {
    constructor(config = {}) {
        this.id = config.id || `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.name = config.name || 'Untitled Scene';
        this.type = config.type || SCENE_TYPES.LINEAR;
        this.color = config.color || this.getRandomColor();
        this.tracks = config.tracks || []; // Track configurations for this scene
        this.clips = config.clips || []; // Clips to play
        this.patterns = config.patterns || []; // Patterns to trigger
        this.duration = config.duration || 4; // Duration in bars
        this.loopCount = config.loopCount || 1; // Number of times to loop (if type is LOOP)
        this.volume = config.volume ?? 1.0;
        this.muted = config.muted ?? false;
        this.soloed = config.soloed ?? false;
        this.fadeIn = config.fadeIn || 0; // Fade in time in ms
        this.fadeOut = config.fadeOut || 0; // Fade out time in ms
        this.automation = config.automation || []; // Automation for this scene
        this.isLoaded = false;
        this.isPlaying = false;
        this.playCount = 0;
        this.currentBar = 0;
        this.triggerTime = null;
    }
    
    getRandomColor() {
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
            '#dfe6e9', '#fd79a8', '#a29bfe', '#6c5ce7', '#00b894',
            '#e17055', '#fdcb6e', '#00cec9', '#74b9ff', '#fab1a0'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            color: this.color,
            tracks: this.tracks,
            clips: this.clips,
            patterns: this.patterns,
            duration: this.duration,
            loopCount: this.loopCount,
            volume: this.volume,
            muted: this.muted,
            soloed: this.soloed,
            fadeIn: this.fadeIn,
            fadeOut: this.fadeOut,
            automation: this.automation
        };
    }
    
    static fromJSON(json) {
        return new Scene(json);
    }
}

// Performance Mode Manager
export class PerformanceMode {
    constructor(appServices = {}) {
        this.appServices = appServices;
        this.scenes = [];
        this.currentScene = null;
        this.nextScene = null;
        this.isPlaying = false;
        this.isPerformanceMode = false;
        this.launchQuantize = TRIGGER_MODES.NEXT_BEAT;
        this.bpm = 120;
        this.gridColumns = 4;
        this.gridRows = 4;
        this.container = null;
        this.sceneElements = new Map();
        this.playhead = null;
        this.barCounter = null;
        this.metronomeEnabled = false;
        this.countIn = false;
        this.countInBars = 1;
        this.autoAdvance = false;
        this.followScene = true;
        
        // Playback state
        this.currentBar = 0;
        this.beatInBar = 0;
        this.lastBeatTime = 0;
        this.beatInterval = 500; // ms per beat at 120 BPM
        
        // Undo/redo
        this.sceneHistory = [];
        this.historyIndex = -1;
        
        // MIDI learn
        this.midiLearnMode = false;
        this.midiMappings = new Map(); // note -> sceneId
        
        // Recording
        this.isRecording = false;
        this.recordedScenes = [];
        
        // Callbacks
        this.onSceneTrigger = null;
        this.onSceneStop = null;
        this.onBeat = null;
        this.onBar = null;
        
        console.log('[PerformanceMode] Initialized');
    }
    
    init(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container "${containerId}" not found`);
            return;
        }
        
        this.container = container;
        this.container.innerHTML = '';
        this.container.style.cssText = `
            background: #0a0a1a;
            color: #ffffff;
            font-family: 'Segoe UI', system-ui, sans-serif;
            padding: 16px;
            min-height: 100%;
            box-sizing: border-box;
        `;
        
        this.createHeader();
        this.createGrid();
        this.createControls();
        this.createStatusBar();
        
        performanceContainer = container;
        isPerformanceMode = true;
        
        console.log('[PerformanceMode] UI created');
    }
    
    createHeader() {
        const header = document.createElement('div');
        header.className = 'performance-header';
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 16px;
            border-bottom: 1px solid #333;
            margin-bottom: 16px;
        `;
        
        // Title and BPM
        const titleSection = document.createElement('div');
        titleSection.innerHTML = `
            <h2 style="color: #00ff88; margin: 0 0 4px 0; font-size: 20px;">Performance Mode</h2>
            <div style="display: flex; gap: 16px; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: #888;">BPM:</span>
                    <input type="number" id="perf-bpm" value="${this.bpm}" min="20" max="300" 
                        style="width: 60px; background: #222; border: 1px solid #444; color: #fff; padding: 4px; border-radius: 4px;">
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: #888;">Quantize:</span>
                    <select id="perf-quantize" style="background: #222; border: 1px solid #444; color: #fff; padding: 4px; border-radius: 4px;">
                        <option value="immediate">Immediate</option>
                        <option value="next_beat" selected>Next Beat</option>
                        <option value="next_bar">Next Bar</option>
                    </select>
                </div>
            </div>
        `;
        header.appendChild(titleSection);
        
        // Main controls
        const controls = document.createElement('div');
        controls.style.cssText = 'display: flex; gap: 8px;';
        
        const playBtn = this.createButton('▶ Play', 'play', () => this.play());
        const stopBtn = this.createButton('■ Stop', 'stop', () => this.stop());
        const recordBtn = this.createButton('● Record', 'record', () => this.toggleRecord());
        
        controls.appendChild(playBtn);
        controls.appendChild(stopBtn);
        controls.appendChild(recordBtn);
        header.appendChild(controls);
        
        this.container.appendChild(header);
        
        // Event listeners
        document.getElementById('perf-bpm').addEventListener('change', (e) => {
            this.bpm = parseInt(e.target.value) || 120;
            this.updateBeatInterval();
        });
        
        document.getElementById('perf-quantize').addEventListener('change', (e) => {
            this.launchQuantize = e.target.value;
        });
    }
    
    createGrid() {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'scene-grid-container';
        gridContainer.style.cssText = `
            position: relative;
            flex: 1;
            display: flex;
            flex-direction: column;
        `;
        
        // Grid header
        const gridHeader = document.createElement('div');
        gridHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
        `;
        
        const addSceneBtn = this.createButton('+ Add Scene', 'add', () => this.addScene());
        const clearAllBtn = this.createButton('Clear All', 'clear', () => this.clearAllScenes());
        const loadBtn = this.createButton('Load', 'load', () => this.loadScenes());
        const saveBtn = this.createButton('Save', 'save', () => this.saveScenes());
        
        gridHeader.appendChild(addSceneBtn);
        gridHeader.appendChild(loadBtn);
        gridHeader.appendChild(saveBtn);
        gridHeader.appendChild(clearAllBtn);
        gridContainer.appendChild(gridHeader);
        
        // Scene grid
        sceneGrid = document.createElement('div');
        sceneGrid.className = 'scene-grid';
        sceneGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${this.gridColumns}, 1fr);
            gap: 8px;
            padding: 8px;
            background: #111;
            border-radius: 8px;
            min-height: 400px;
        `;
        gridContainer.appendChild(sceneGrid);
        
        this.container.appendChild(gridContainer);
        
        // Initialize with empty slots
        this.updateGrid();
    }
    
    createControls() {
        const controls = document.createElement('div');
        controls.className = 'performance-controls';
        controls.style.cssText = `
            display: flex;
            gap: 16px;
            padding: 16px 0;
            border-top: 1px solid #333;
            margin-top: 16px;
        `;
        
        // Scene settings
        const settingsPanel = document.createElement('div');
        settingsPanel.style.cssText = `
            flex: 1;
            background: #111;
            border-radius: 8px;
            padding: 12px;
        `;
        settingsPanel.innerHTML = `
            <h4 style="color: #00ff88; margin: 0 0 12px 0;">Scene Settings</h4>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                <div>
                    <label style="color: #888; font-size: 12px;">Name</label>
                    <input type="text" id="scene-name" placeholder="Scene Name"
                        style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; margin-top: 4px;">
                </div>
                <div>
                    <label style="color: #888; font-size: 12px;">Type</label>
                    <select id="scene-type" style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; margin-top: 4px;">
                        <option value="linear">Linear</option>
                        <option value="loop">Loop</option>
                        <option value="one_shot">One Shot</option>
                        <option value="trigger">Trigger</option>
                    </select>
                </div>
                <div>
                    <label style="color: #888; font-size: 12px;">Duration (bars)</label>
                    <input type="number" id="scene-duration" value="4" min="1" max="64"
                        style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; margin-top: 4px;">
                </div>
                <div>
                    <label style="color: #888; font-size: 12px;">Loop Count</label>
                    <input type="number" id="scene-loop-count" value="1" min="1" max="32"
                        style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; margin-top: 4px;">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px;">
                <div>
                    <label style="color: #888; font-size: 12px;">Volume</label>
                    <input type="range" id="scene-volume" min="0" max="1" step="0.01" value="1"
                        style="width: 100%; margin-top: 4px;">
                </div>
                <div>
                    <label style="color: #888; font-size: 12px;">Fade In (ms)</label>
                    <input type="number" id="scene-fade-in" value="0" min="0" max="5000"
                        style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; margin-top: 4px;">
                </div>
                <div>
                    <label style="color: #888; font-size: 12px;">Fade Out (ms)</label>
                    <input type="number" id="scene-fade-out" value="0" min="0" max="5000"
                        style="width: 100%; background: #222; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; margin-top: 4px;">
                </div>
                <div style="display: flex; align-items: flex-end;">
                    <button id="apply-scene-settings" style="width: 100%; background: #00aa66; border: none; color: #fff; padding: 8px; border-radius: 4px; cursor: pointer;">
                        Apply
                    </button>
                </div>
            </div>
        `;
        controls.appendChild(settingsPanel);
        
        // Quick actions
        const actionsPanel = document.createElement('div');
        actionsPanel.style.cssText = `
            background: #111;
            border-radius: 8px;
            padding: 12px;
            min-width: 150px;
        `;
        actionsPanel.innerHTML = `
            <h4 style="color: #00ff88; margin: 0 0 12px 0;">Quick Actions</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button id="perf-metronome" class="quick-action-btn">🥁 Metronome</button>
                <button id="perf-count-in" class="quick-action-btn">📋 Count In</button>
                <button id="perf-auto-advance" class="quick-action-btn">⏭ Auto Advance</button>
                <button id="perf-midi-learn" class="quick-action-btn">🎹 MIDI Learn</button>
            </div>
        `;
        controls.appendChild(actionsPanel);
        
        this.container.appendChild(controls);
        
        // Event listeners
        document.getElementById('apply-scene-settings').addEventListener('click', () => {
            this.applySceneSettings();
        });
        
        document.getElementById('perf-metronome').addEventListener('click', () => {
            this.toggleMetronome();
        });
        
        document.getElementById('perf-count-in').addEventListener('click', () => {
            this.toggleCountIn();
        });
        
        document.getElementById('perf-auto-advance').addEventListener('click', () => {
            this.toggleAutoAdvance();
        });
        
        document.getElementById('perf-midi-learn').addEventListener('click', () => {
            this.toggleMidiLearn();
        });
        
        // Style quick action buttons
        const quickBtns = actionsPanel.querySelectorAll('.quick-action-btn');
        quickBtns.forEach(btn => {
            btn.style.cssText = `
                width: 100%;
                background: #222;
                border: 1px solid #444;
                color: #fff;
                padding: 8px;
                border-radius: 4px;
                cursor: pointer;
                text-align: left;
                transition: all 0.2s;
            `;
            btn.addEventListener('mouseenter', () => btn.style.background = '#333');
            btn.addEventListener('mouseleave', () => btn.style.background = '#222');
        });
    }
    
    createStatusBar() {
        const statusBar = document.createElement('div');
        statusBar.className = 'performance-status';
        statusBar.style.cssText = `
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-top: 1px solid #333;
            margin-top: 12px;
            font-size: 12px;
            color: #888;
        `;
        
        // Time info
        this.barCounter = document.createElement('div');
        this.barCounter.innerHTML = `
            <span style="color: #00ff88; font-weight: bold; font-size: 16px;">1</span>
            <span style="margin-left: 4px;">/ 4</span>
        `;
        statusBar.appendChild(this.barCounter);
        
        // Playhead
        this.playhead = document.createElement('div');
        this.playhead.style.cssText = `
            flex: 1;
            height: 8px;
            background: #222;
            border-radius: 4px;
            margin: 0 16px;
            position: relative;
            overflow: hidden;
        `;
        
        const playheadFill = document.createElement('div');
        playheadFill.id = 'playhead-fill';
        playheadFill.style.cssText = `
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #00ff88, #00aaff);
            border-radius: 4px;
            transition: width 0.1s linear;
        `;
        this.playhead.appendChild(playheadFill);
        statusBar.appendChild(this.playhead);
        
        // Current scene
        const currentSceneInfo = document.createElement('div');
        currentSceneInfo.id = 'current-scene-info';
        currentSceneInfo.textContent = 'No scene active';
        statusBar.appendChild(currentSceneInfo);
        
        this.container.appendChild(statusBar);
    }
    
    createButton(text, className, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = `perf-btn perf-btn-${className}`;
        btn.style.cssText = `
            padding: 8px 16px;
            background: ${className === 'stop' ? '#aa3333' : className === 'record' ? '#aa6600' : '#00aa66'};
            border: none;
            color: #fff;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        `;
        btn.addEventListener('click', onClick);
        btn.addEventListener('mouseenter', () => btn.style.opacity = '0.8');
        btn.addEventListener('mouseleave', () => btn.style.opacity = '1');
        return btn;
    }
    
    updateGrid() {
        if (!sceneGrid) return;
        
        sceneGrid.innerHTML = '';
        this.sceneElements.clear();
        
        const totalSlots = this.gridColumns * this.gridRows;
        
        for (let i = 0; i < totalSlots; i++) {
            const scene = this.scenes[i];
            const slot = document.createElement('div');
            slot.className = 'scene-slot';
            slot.dataset.index = i;
            
            if (scene) {
                slot.style.cssText = `
                    background: ${scene.color}20;
                    border: 2px solid ${scene.color};
                    border-radius: 8px;
                    padding: 12px;
                    min-height: 100px;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.2s;
                `;
                
                // Scene content
                slot.innerHTML = `
                    <div style="font-weight: bold; color: #fff; margin-bottom: 4px;">${scene.name}</div>
                    <div style="font-size: 10px; color: #888;">${scene.type.toUpperCase()} | ${scene.duration} bars</div>
                    <div style="font-size: 10px; color: #666; margin-top: 4px;">${scene.clips.length} clips | ${scene.patterns.length} patterns</div>
                    ${scene.isPlaying ? '<div style="position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; background: #00ff88; border-radius: 50%; animation: pulse 1s infinite;"></div>' : ''}
                `;
                
                // Event handlers
                slot.addEventListener('click', (e) => {
                    if (e.shiftKey) {
                        this.editScene(i);
                    } else {
                        this.triggerScene(i);
                    }
                });
                
                slot.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showSceneContextMenu(e, i);
                });
                
                slot.addEventListener('mouseenter', () => {
                    slot.style.transform = 'scale(1.02)';
                });
                
                slot.addEventListener('mouseleave', () => {
                    slot.style.transform = 'scale(1)';
                });
                
                this.sceneElements.set(scene.id, slot);
            } else {
                slot.style.cssText = `
                    background: #111;
                    border: 2px dashed #333;
                    border-radius: 8px;
                    padding: 12px;
                    min-height: 100px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                slot.innerHTML = '<span style="color: #444;">+ Empty</span>';
                
                slot.addEventListener('click', () => this.addScene(i));
                slot.addEventListener('mouseenter', () => {
                    slot.style.borderColor = '#00ff88';
                });
                slot.addEventListener('mouseleave', () => {
                    slot.style.borderColor = '#333';
                });
            }
            
            sceneGrid.appendChild(slot);
        }
    }
    
    addScene(index = null) {
        const sceneIndex = index ?? this.scenes.length;
        const scene = new Scene({
            name: `Scene ${sceneIndex + 1}`,
            type: SCENE_TYPES.LINEAR,
            duration: 4
        });
        
        // Insert scene at index
        if (index !== null && index < this.scenes.length) {
            this.scenes.splice(index, 0, scene);
        } else {
            this.scenes[sceneIndex] = scene;
        }
        
        this.updateGrid();
        this.saveToHistory();
        
        console.log(`[PerformanceMode] Added scene: ${scene.name}`);
        return scene;
    }
    
    editScene(index) {
        const scene = this.scenes[index];
        if (!scene) return;
        
        // Populate settings panel
        document.getElementById('scene-name').value = scene.name;
        document.getElementById('scene-type').value = scene.type;
        document.getElementById('scene-duration').value = scene.duration;
        document.getElementById('scene-loop-count').value = scene.loopCount;
        document.getElementById('scene-volume').value = scene.volume;
        document.getElementById('scene-fade-in').value = scene.fadeIn;
        document.getElementById('scene-fade-out').value = scene.fadeOut;
        
        // Store current edit index
        this.currentEditIndex = index;
        
        console.log(`[PerformanceMode] Editing scene: ${scene.name}`);
    }
    
    applySceneSettings() {
        if (this.currentEditIndex === undefined || !this.scenes[this.currentEditIndex]) return;
        
        const scene = this.scenes[this.currentEditIndex];
        scene.name = document.getElementById('scene-name').value || scene.name;
        scene.type = document.getElementById('scene-type').value;
        scene.duration = parseInt(document.getElementById('scene-duration').value) || 4;
        scene.loopCount = parseInt(document.getElementById('scene-loop-count').value) || 1;
        scene.volume = parseFloat(document.getElementById('scene-volume').value) || 1;
        scene.fadeIn = parseInt(document.getElementById('scene-fade-in').value) || 0;
        scene.fadeOut = parseInt(document.getElementById('scene-fade-out').value) || 0;
        
        this.updateGrid();
        this.saveToHistory();
        
        console.log(`[PerformanceMode] Applied settings to scene: ${scene.name}`);
    }
    
    showSceneContextMenu(event, index) {
        const scene = this.scenes[index];
        if (!scene) return;
        
        // Remove existing context menu
        const existing = document.querySelector('.scene-context-menu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.className = 'scene-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: #222;
            border: 1px solid #444;
            border-radius: 4px;
            padding: 4px;
            z-index: 1000;
        `;
        
        const actions = [
            { label: 'Edit', action: () => this.editScene(index) },
            { label: 'Duplicate', action: () => this.duplicateScene(index) },
            { label: scene.muted ? 'Unmute' : 'Mute', action: () => this.toggleSceneMute(index) },
            { label: scene.soloed ? 'Unsolo' : 'Solo', action: () => this.toggleSceneSolo(index) },
            { label: 'Delete', action: () => this.deleteScene(index) }
        ];
        
        actions.forEach(({ label, action }) => {
            const item = document.createElement('div');
            item.textContent = label;
            item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-radius: 4px;
                color: ${label === 'Delete' ? '#ff4444' : '#fff'};
            `;
            item.addEventListener('click', () => {
                action();
                menu.remove();
            });
            item.addEventListener('mouseenter', () => item.style.background = '#333');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');
            menu.appendChild(item);
        });
        
        document.body.appendChild(menu);
        
        // Close on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }
    
    duplicateScene(index) {
        const scene = this.scenes[index];
        if (!scene) return;
        
        const newScene = Scene.fromJSON(scene.toJSON());
        newScene.id = `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        newScene.name = `${scene.name} (Copy)`;
        
        this.scenes.splice(index + 1, 0, newScene);
        this.updateGrid();
        this.saveToHistory();
        
        console.log(`[PerformanceMode] Duplicated scene: ${scene.name}`);
    }
    
    deleteScene(index) {
        const scene = this.scenes[index];
        if (!scene) return;
        
        if (scene.isPlaying) {
            this.stopScene(index);
        }
        
        this.scenes.splice(index, 1);
        this.updateGrid();
        this.saveToHistory();
        
        console.log(`[PerformanceMode] Deleted scene: ${scene.name}`);
    }
    
    toggleSceneMute(index) {
        const scene = this.scenes[index];
        if (!scene) return;
        
        scene.muted = !scene.muted;
        this.updateGrid();
    }
    
    toggleSceneSolo(index) {
        const scene = this.scenes[index];
        if (!scene) return;
        
        scene.soloed = !scene.soloed;
        
        // If soloing, mute all others
        if (scene.soloed) {
            this.scenes.forEach((s, i) => {
                if (i !== index) s.muted = true;
            });
        }
        
        this.updateGrid();
    }
    
    clearAllScenes() {
        if (confirm('Are you sure you want to clear all scenes?')) {
            this.stopAllScenes();
            this.scenes = [];
            this.updateGrid();
            this.saveToHistory();
            console.log('[PerformanceMode] Cleared all scenes');
        }
    }
    
    triggerScene(index) {
        const scene = this.scenes[index];
        if (!scene || scene.muted) return;
        
        // Check for soloed scenes
        const hasSolo = this.scenes.some(s => s.soloed);
        if (hasSolo && !scene.soloed) return;
        
        if (this.launchQuantize === TRIGGER_MODES.IMMEDIATE) {
            this.playScene(index);
        } else {
            this.queueScene(index);
        }
    }
    
    queueScene(index) {
        const scene = this.scenes[index];
        if (!scene) return;
        
        this.nextScene = { index, scene };
        
        // Visual indicator
        const slot = this.sceneElements.get(scene.id);
        if (slot) {
            slot.style.borderColor = '#ffff00';
        }
        
        console.log(`[PerformanceMode] Queued scene: ${scene.name}`);
    }
    
    playScene(index) {
        const scene = this.scenes[index];
        if (!scene) return;
        
        // Stop current scene if playing
        if (this.currentScene && this.currentScene.isPlaying) {
            this.stopScene(this.scenes.indexOf(this.currentScene));
        }
        
        // Start new scene
        this.currentScene = scene;
        scene.isPlaying = true;
        scene.playCount++;
        scene.currentBar = 0;
        scene.triggerTime = Date.now();
        
        // Fade in if set
        if (scene.fadeIn > 0 && this.appServices.setMasterVolume) {
            this.appServices.setMasterVolume(0);
            setTimeout(() => {
                this.appServices.setMasterVolume(scene.volume, scene.fadeIn);
            }, 50);
        }
        
        // Trigger clips and patterns
        this.triggerSceneContent(scene);
        
        // Update UI
        this.updateGrid();
        document.getElementById('current-scene-info').textContent = `Playing: ${scene.name}`;
        
        // Callback
        if (this.onSceneTrigger) {
            this.onSceneTrigger(scene);
        }
        
        console.log(`[PerformanceMode] Playing scene: ${scene.name}`);
    }
    
    stopScene(index) {
        const scene = this.scenes[index];
        if (!scene) return;
        
        // Fade out if set
        if (scene.fadeOut > 0 && this.appServices.setMasterVolume) {
            this.appServices.setMasterVolume(0, scene.fadeOut);
        }
        
        scene.isPlaying = false;
        
        // Stop clips and patterns
        this.stopSceneContent(scene);
        
        // Update UI
        this.updateGrid();
        if (this.currentScene === scene) {
            this.currentScene = null;
            document.getElementById('current-scene-info').textContent = 'No scene active';
        }
        
        // Callback
        if (this.onSceneStop) {
            this.onSceneStop(scene);
        }
        
        console.log(`[PerformanceMode] Stopped scene: ${scene.name}`);
    }
    
    stopAllScenes() {
        this.scenes.forEach((scene, index) => {
            if (scene.isPlaying) {
                this.stopScene(index);
            }
        });
    }
    
    triggerSceneContent(scene) {
        // Trigger clips
        scene.clips.forEach(clip => {
            if (this.appServices.playClip) {
                this.appServices.playClip(clip.id, clip.startTime);
            }
        });
        
        // Trigger patterns
        scene.patterns.forEach(pattern => {
            if (this.appServices.playPattern) {
                this.appServices.playPattern(pattern.id);
            }
        });
        
        // Set track configurations
        scene.tracks.forEach(trackConfig => {
            if (this.appServices.setTrackConfig) {
                this.appServices.setTrackConfig(trackConfig.trackId, trackConfig);
            }
        });
    }
    
    stopSceneContent(scene) {
        // Stop clips
        scene.clips.forEach(clip => {
            if (this.appServices.stopClip) {
                this.appServices.stopClip(clip.id);
            }
        });
        
        // Stop patterns
        scene.patterns.forEach(pattern => {
            if (this.appServices.stopPattern) {
                this.appServices.stopPattern(pattern.id);
            }
        });
    }
    
    play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.lastBeatTime = Date.now();
        this.updateBeatInterval();
        
        // Count in if enabled
        if (this.countIn) {
            this.doCountIn();
            return;
        }
        
        // Start beat loop
        this.startBeatLoop();
        
        console.log('[PerformanceMode] Playback started');
    }
    
    stop() {
        this.isPlaying = false;
        this.stopAllScenes();
        this.currentBar = 0;
        this.beatInBar = 0;
        
        // Reset playhead
        const fill = document.getElementById('playhead-fill');
        if (fill) fill.style.width = '0%';
        
        console.log('[PerformanceMode] Playback stopped');
    }
    
    doCountIn() {
        let count = 0;
        const countBeats = this.countInBars * 4;
        
        const countInterval = setInterval(() => {
            count++;
            
            // Play metronome click
            if (this.metronomeEnabled && this.appServices.playMetronomeClick) {
                this.appServices.playMetronomeClick(count % 4 === 0 ? 'downbeat' : 'beat');
            }
            
            if (count >= countBeats) {
                clearInterval(countInterval);
                this.startBeatLoop();
            }
        }, this.beatInterval);
    }
    
    startBeatLoop() {
        const beatLoop = () => {
            if (!this.isPlaying) return;
            
            const now = Date.now();
            const elapsed = now - this.lastBeatTime;
            
            if (elapsed >= this.beatInterval) {
                this.lastBeatTime = now;
                this.onBeat();
            }
            
            requestAnimationFrame(beatLoop);
        };
        
        requestAnimationFrame(beatLoop);
    }
    
    onBeat() {
        this.beatInBar = (this.beatInBar + 1) % 4;
        
        // Metronome
        if (this.metronomeEnabled && this.appServices.playMetronomeClick) {
            this.appServices.playMetronomeClick(this.beatInBar === 0 ? 'downbeat' : 'beat');
        }
        
        // Bar change
        if (this.beatInBar === 0) {
            this.onBar();
        }
        
        // Update playhead
        this.updatePlayhead();
        
        // Check for queued scene
        if (this.nextScene) {
            if (this.launchQuantize === TRIGGER_MODES.NEXT_BEAT) {
                this.playScene(this.nextScene.index);
                this.nextScene = null;
            }
        }
        
        // Callback
        if (this.onBeat) {
            this.onBeat(this.beatInBar);
        }
    }
    
    onBar() {
        this.currentBar++;
        
        if (this.currentScene) {
            this.currentScene.currentBar = this.currentBar;
            
            // Update bar counter
            if (this.barCounter) {
                this.barCounter.innerHTML = `
                    <span style="color: #00ff88; font-weight: bold; font-size: 16px;">${this.currentBar}</span>
                    <span style="margin-left: 4px;">/ ${this.currentScene.duration}</span>
                `;
            }
            
            // Check for scene end
            if (this.currentBar >= this.currentScene.duration) {
                if (this.currentScene.type === SCENE_TYPES.LOOP && 
                    this.currentScene.playCount < this.currentScene.loopCount) {
                    // Loop
                    this.currentBar = 0;
                    this.currentScene.playCount++;
                } else if (this.autoAdvance) {
                    // Auto advance to next scene
                    const nextIndex = this.scenes.indexOf(this.currentScene) + 1;
                    if (nextIndex < this.scenes.length) {
                        this.triggerScene(nextIndex);
                    } else {
                        this.stopScene(this.scenes.indexOf(this.currentScene));
                    }
                } else {
                    // Stop
                    this.stopScene(this.scenes.indexOf(this.currentScene));
                }
            }
        }
        
        // Check for queued scene (next_bar quantize)
        if (this.nextScene && this.launchQuantize === TRIGGER_MODES.NEXT_BAR) {
            this.playScene(this.nextScene.index);
            this.nextScene = null;
        }
        
        // Callback
        if (this.onBar) {
            this.onBar(this.currentBar);
        }
    }
    
    updatePlayhead() {
        if (!this.currentScene) return;
        
        const fill = document.getElementById('playhead-fill');
        if (!fill) return;
        
        // Calculate progress
        const barProgress = this.beatInBar / 4;
        const totalBars = this.currentScene.duration;
        const sceneProgress = ((this.currentBar - 1) + barProgress) / totalBars;
        
        fill.style.width = `${Math.min(100, sceneProgress * 100)}%`;
    }
    
    updateBeatInterval() {
        this.beatInterval = 60000 / this.bpm; // ms per beat
    }
    
    toggleRecord() {
        this.isRecording = !this.isRecording;
        
        const btn = document.querySelector('.perf-btn-record');
        if (btn) {
            btn.style.background = this.isRecording ? '#ff4444' : '#aa6600';
            btn.textContent = this.isRecording ? '● Recording...' : '● Record';
        }
        
        if (this.isRecording) {
            this.recordedScenes = [];
            console.log('[PerformanceMode] Recording started');
        } else {
            console.log(`[PerformanceMode] Recording stopped. Captured ${this.recordedScenes.length} scene triggers`);
        }
    }
    
    toggleMetronome() {
        this.metronomeEnabled = !this.metronomeEnabled;
        
        const btn = document.getElementById('perf-metronome');
        if (btn) {
            btn.style.background = this.metronomeEnabled ? '#00aa66' : '#222';
        }
        
        console.log(`[PerformanceMode] Metronome ${this.metronomeEnabled ? 'enabled' : 'disabled'}`);
    }
    
    toggleCountIn() {
        this.countIn = !this.countIn;
        
        const btn = document.getElementById('perf-count-in');
        if (btn) {
            btn.style.background = this.countIn ? '#00aa66' : '#222';
        }
        
        console.log(`[PerformanceMode] Count-in ${this.countIn ? 'enabled' : 'disabled'}`);
    }
    
    toggleAutoAdvance() {
        this.autoAdvance = !this.autoAdvance;
        
        const btn = document.getElementById('perf-auto-advance');
        if (btn) {
            btn.style.background = this.autoAdvance ? '#00aa66' : '#222';
        }
        
        console.log(`[PerformanceMode] Auto-advance ${this.autoAdvance ? 'enabled' : 'disabled'}`);
    }
    
    toggleMidiLearn() {
        this.midiLearnMode = !this.midiLearnMode;
        
        const btn = document.getElementById('perf-midi-learn');
        if (btn) {
            btn.style.background = this.midiLearnMode ? '#aa6600' : '#222';
        }
        
        console.log(`[PerformanceMode] MIDI learn ${this.midiLearnMode ? 'enabled' : 'disabled'}`);
    }
    
    handleMidiNote(note, velocity) {
        if (this.midiLearnMode) {
            // Map this note to the currently selected scene
            if (this.currentEditIndex !== undefined) {
                const scene = this.scenes[this.currentEditIndex];
                if (scene) {
                    this.midiMappings.set(note, scene.id);
                    console.log(`[PerformanceMode] MIDI learn: Note ${note} -> Scene "${scene.name}"`);
                }
            }
        } else {
            // Trigger scene mapped to this note
            const sceneId = this.midiMappings.get(note);
            if (sceneId) {
                const index = this.scenes.findIndex(s => s.id === sceneId);
                if (index !== -1) {
                    if (velocity > 0) {
                        this.triggerScene(index);
                    } else {
                        this.stopScene(index);
                    }
                }
            }
        }
    }
    
    saveToHistory() {
        const state = this.scenes.map(s => s.toJSON());
        this.sceneHistory = this.sceneHistory.slice(0, this.historyIndex + 1);
        this.sceneHistory.push(state);
        this.historyIndex = this.sceneHistory.length - 1;
    }
    
    undo() {
        if (this.historyIndex <= 0) return;
        
        this.historyIndex--;
        const state = this.sceneHistory[this.historyIndex];
        this.scenes = state.map(json => Scene.fromJSON(json));
        this.updateGrid();
        
        console.log('[PerformanceMode] Undo');
    }
    
    redo() {
        if (this.historyIndex >= this.sceneHistory.length - 1) return;
        
        this.historyIndex++;
        const state = this.sceneHistory[this.historyIndex];
        this.scenes = state.map(json => Scene.fromJSON(json));
        this.updateGrid();
        
        console.log('[PerformanceMode] Redo');
    }
    
    saveScenes() {
        const data = {
            version: '1.0',
            bpm: this.bpm,
            launchQuantize: this.launchQuantize,
            midiMappings: Array.from(this.midiMappings.entries()),
            scenes: this.scenes.map(s => s.toJSON())
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log('[PerformanceMode] Scenes saved');
    }
    
    loadScenes() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.bpm = data.bpm || 120;
                    this.launchQuantize = data.launchQuantize || TRIGGER_MODES.NEXT_BEAT;
                    this.midiMappings = new Map(data.midiMappings || []);
                    this.scenes = (data.scenes || []).map(json => Scene.fromJSON(json));
                    
                    // Update UI
                    document.getElementById('perf-bpm').value = this.bpm;
                    document.getElementById('perf-quantize').value = this.launchQuantize;
                    this.updateGrid();
                    this.saveToHistory();
                    
                    console.log(`[PerformanceMode] Loaded ${this.scenes.length} scenes`);
                } catch (err) {
                    console.error('[PerformanceMode] Error loading scenes:', err);
                }
            };
            reader.readAsText(file);
        });
        
        input.click();
    }
    
    // Set app services
    setAppServices(services) {
        this.appServices = services;
    }
    
    // Set BPM from external source
    setBPM(newBpm) {
        this.bpm = newBpm;
        this.updateBeatInterval();
        
        const input = document.getElementById('perf-bpm');
        if (input) input.value = newBpm;
    }
    
    // Destroy
    destroy() {
        this.stop();
        if (this.container) {
            this.container.innerHTML = '';
        }
        isPerformanceMode = false;
        performanceContainer = null;
        console.log('[PerformanceMode] Destroyed');
    }
}

// Global functions
export function isPerformanceModeActive() {
    return isPerformanceMode;
}

export function getPerformanceContainer() {
    return performanceContainer;
}

export function getScenes() {
    return scenes;
}

export function getCurrentSceneIndex() {
    return currentSceneIndex;
}

// Initialize performance mode panel
export function initPerformanceMode(containerId, appServices = {}) {
    const perf = new PerformanceMode(appServices);
    perf.init(containerId);
    return perf;
}

// Open performance mode in modal
export function openPerformanceModePanel(appServices = {}) {
    // Remove existing panel
    const existing = document.getElementById('performance-mode-panel');
    if (existing) {
        existing.remove();
        return null;
    }
    
    const panel = document.createElement('div');
    panel.id = 'performance-mode-panel';
    panel.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        overflow: auto;
    `;
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        width: 40px;
        height: 40px;
        background: #aa3333;
        border: none;
        border-radius: 50%;
        color: #fff;
        font-size: 20px;
        cursor: pointer;
        z-index: 10001;
    `;
    closeBtn.addEventListener('click', () => {
        perf.destroy();
        panel.remove();
    });
    panel.appendChild(closeBtn);
    
    // Container
    const container = document.createElement('div');
    container.id = 'performance-mode-container';
    container.style.cssText = 'width: 100%; height: 100%;';
    panel.appendChild(container);
    
    document.body.appendChild(panel);
    
    const perf = initPerformanceMode('performance-mode-container', appServices);
    return perf;
}

console.log('[PerformanceMode] Module loaded');