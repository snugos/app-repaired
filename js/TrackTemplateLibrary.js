/**
 * js/TrackTemplateLibrary.js - Track Template Library
 * 
 * Save and browse track templates containing instrument + effects + settings.
 * Templates allow quick track creation with pre-configured setups.
 */

let localAppServices = {};
let trackTemplates = {}; // { templateName: templateData }
const STORAGE_KEY = 'snugosTrackTemplates';

// Load templates from localStorage on init
function loadTemplates() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            trackTemplates = JSON.parse(stored);
            console.log(`[TrackTemplateLibrary] Loaded ${Object.keys(trackTemplates).length} templates from storage`);
        }
    } catch (e) {
        console.warn('[TrackTemplateLibrary] Failed to load templates:', e);
        trackTemplates = {};
    }
}

// Save templates to localStorage
function saveTemplates() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trackTemplates));
    } catch (e) {
        console.warn('[TrackTemplateLibrary] Failed to save templates:', e);
    }
}

/**
 * Initialize the module with app services
 */
export function initTrackTemplateLibrary(appServices) {
    localAppServices = appServices || {};
    loadTemplates();
    console.log('[TrackTemplateLibrary] Module initialized');
}

/**
 * Save current track as a template
 * @param {number} trackId - Track ID to save as template
 * @param {string} name - Template name
 * @returns {boolean} Success status
 */
export function saveTrackTemplate(trackId, name) {
    if (!name || !name.trim()) {
        console.warn('[TrackTemplateLibrary] Invalid template name');
        return false;
    }
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    const track = tracks.find(t => t.id === trackId);
    
    if (!track) {
        console.warn(`[TrackTemplateLibrary] Track ${trackId} not found`);
        return false;
    }
    
    const templateName = name.trim();
    
    // Build template data
    const templateData = {
        name: templateName,
        createdAt: new Date().toISOString(),
        type: track.type,
        color: track.color,
        // Instrument settings
        instrumentType: track.instrumentType || track.type,
        synthParams: track.synthParams ? JSON.parse(JSON.stringify(track.synthParams)) : {},
        samplerSettings: track.samplerAudioData ? JSON.parse(JSON.stringify(track.samplerAudioData)) : null,
        // Effects
        activeEffects: track.activeEffects ? track.activeEffects.map(e => ({
            type: e.type,
            params: e.params ? JSON.parse(JSON.stringify(e.params)) : {}
        })) : [],
        // Track settings
        volume: track.volume !== undefined ? track.volume : 0.7,
        pan: track.pan !== undefined ? track.pan : 0,
        mute: false,
        solo: false,
        // Sequencer settings
        stepsPerBeat: track.stepsPerBeat || 4,
        // Send levels
        sendLevels: track.sendLevels ? JSON.parse(JSON.stringify(track.sendLevels)) : {}
    };
    
    trackTemplates[templateName] = templateData;
    saveTemplates();
    
    console.log(`[TrackTemplateLibrary] Saved template "${templateName}" for track "${track.name}"`);
    
    if (localAppServices.showNotification) {
        localAppServices.showNotification(`Template "${templateName}" saved`, 1500);
    }
    
    return true;
}

/**
 * Get all template names
 * @returns {string[]} Array of template names
 */
export function getTrackTemplateNames() {
    return Object.keys(trackTemplates).sort();
}

/**
 * Get a template by name
 * @param {string} name - Template name
 * @returns {object|null} Template data or null
 */
export function getTrackTemplate(name) {
    const template = trackTemplates[name];
    return template ? JSON.parse(JSON.stringify(template)) : null;
}

/**
 * Delete a template
 * @param {string} name - Template name
 * @returns {boolean} Success status
 */
export function deleteTrackTemplate(name) {
    if (trackTemplates[name]) {
        delete trackTemplates[name];
        saveTemplates();
        console.log(`[TrackTemplateLibrary] Deleted template "${name}"`);
        return true;
    }
    return false;
}

/**
 * Rename a template
 * @param {string} oldName - Current name
 * @param {string} newName - New name
 * @returns {boolean} Success status
 */
export function renameTrackTemplate(oldName, newName) {
    if (!trackTemplates[oldName] || !newName || !newName.trim()) {
        return false;
    }
    
    const templateData = trackTemplates[oldName];
    const newTemplateName = newName.trim();
    
    trackTemplates[newTemplateName] = {
        ...templateData,
        name: newTemplateName,
        renamedFrom: oldName,
        updatedAt: new Date().toISOString()
    };
    
    delete trackTemplates[oldName];
    saveTemplates();
    
    console.log(`[TrackTemplateLibrary] Renamed template "${oldName}" to "${newTemplateName}"`);
    return true;
}

/**
 * Apply a template to create a new track
 * @param {string} templateName - Name of template to apply
 * @param {string} newTrackName - Name for the new track (optional)
 * @returns {object|null} The created track or null
 */
export async function applyTrackTemplate(templateName, newTrackName = null) {
    const template = trackTemplates[templateName];
    if (!template) {
        console.warn(`[TrackTemplateLibrary] Template "${templateName}" not found`);
        return null;
    }
    
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    // Determine track name
    let trackName = newTrackName || templateName;
    // Ensure unique name
    const existingNames = tracks.map(t => t.name);
    let counter = 1;
    let baseName = trackName;
    while (existingNames.includes(trackName)) {
        trackName = `${baseName} ${counter}`;
        counter++;
    }
    
    // Get state functions
    const { addTrackToState } = localAppServices;
    if (!addTrackToState) {
        console.warn('[TrackTemplateLibrary] addTrackToState not available');
        return null;
    }
    
    // Create track data
    const trackData = {
        name: trackName,
        type: template.type,
        color: template.color,
        instrumentType: template.instrumentType,
        synthParams: template.synthParams ? JSON.parse(JSON.stringify(template.synthParams)) : {},
        samplerAudioData: template.samplerSettings,
        volume: template.volume,
        pan: template.pan,
        stepsPerBeat: template.stepsPerBeat,
        sendLevels: template.sendLevels ? JSON.parse(JSON.stringify(template.sendLevels)) : {},
        activeEffects: template.activeEffects ? template.activeEffects.map((e, i) => ({
            id: `effect_${Date.now()}_${i}`,
            type: e.type,
            params: e.params
        })) : []
    };
    
    try {
        const newTrack = await addTrackToState(trackData);
        
        if (newTrack && localAppServices.showNotification) {
            localAppServices.showNotification(`Created track from template "${templateName}"`, 1500);
        }
        
        return newTrack;
    } catch (e) {
        console.error('[TrackTemplateLibrary] Failed to apply template:', e);
        return null;
    }
}

/**
 * Export all templates as JSON string
 * @returns {string} JSON string of templates
 */
export function exportTemplates() {
    return JSON.stringify(trackTemplates, null, 2);
}

/**
 * Import templates from JSON string
 * @param {string} jsonString - JSON string of templates
 * @returns {number} Number of templates imported
 */
export function importTemplates(jsonString) {
    try {
        const imported = JSON.parse(jsonString);
        if (typeof imported !== 'object' || Array.isArray(imported)) {
            throw new Error('Invalid template format');
        }
        
        let count = 0;
        for (const [name, data] of Object.entries(imported)) {
            if (name && typeof data === 'object') {
                trackTemplates[name] = data;
                count++;
            }
        }
        
        saveTemplates();
        console.log(`[TrackTemplateLibrary] Imported ${count} templates`);
        return count;
    } catch (e) {
        console.error('[TrackTemplateLibrary] Import failed:', e);
        return 0;
    }
}

/**
 * Get all template data for UI display
 * @returns {object[]} Array of template info objects
 */
export function getTemplatesState() {
    return Object.entries(trackTemplates).map(([name, data]) => ({
        name,
        type: data.type,
        color: data.color,
        effectCount: data.activeEffects ? data.activeEffects.length : 0,
        createdAt: data.createdAt
    }));
}

/**
 * Open the Track Template Library panel
 */
export function openTrackTemplateLibraryPanel() {
    const windowId = 'trackTemplateLibrary';
    const openWindows = localAppServices.getOpenWindows ? localAppServices.getOpenWindows() : new Map();
    
    if (openWindows.has(windowId)) {
        const win = openWindows.get(windowId);
        win.restore();
        renderTemplateLibraryContent();
        return win;
    }
    
    const contentContainer = document.createElement('div');
    contentContainer.id = 'trackTemplateContent';
    contentContainer.className = 'p-4 h-full flex flex-col bg-gray-100 dark:bg-slate-800 overflow-y-auto';
    
    const options = {
        width: 500,
        height: 450,
        minWidth: 400,
        minHeight: 350,
        initialContentKey: windowId,
        closable: true,
        minimizable: true,
        resizable: true
    };
    
    const win = localAppServices.createWindow(windowId, 'Track Template Library', contentContainer, options);
    
    if (win?.element) {
        renderTemplateLibraryContent();
    }
    
    return win;
}

/**
 * Render the template library content
 */
function renderTemplateLibraryContent() {
    const container = document.getElementById('trackTemplateContent');
    if (!container) return;
    
    const templates = getTemplatesState();
    const tracks = localAppServices.getTracks ? localAppServices.getTracks() : [];
    
    let html = `
        <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600 dark:text-gray-300">${templates.length} template${templates.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="flex items-center gap-2">
                <button id="importTemplatesBtn" class="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600">
                    Import
                </button>
                <button id="exportTemplatesBtn" class="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600">
                    Export
                </button>
            </div>
        </div>
        
        <!-- Save from track section -->
        <div class="mb-4 p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Save Current Track as Template</h3>
            <div class="flex items-center gap-2">
                <select id="templateSourceTrack" class="flex-1 p-2 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                    <option value="">Select a track...</option>
                    ${tracks.map(t => `<option value="${t.id}">${t.name} (${t.type})</option>`).join('')}
                </select>
                <input type="text" id="templateNameInput" placeholder="Template name..." 
                    class="flex-1 p-2 text-sm bg-gray-50 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded text-gray-700 dark:text-gray-200">
                <button id="saveTemplateBtn" class="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
                    Save
                </button>
            </div>
        </div>
        
        <!-- Templates list -->
        <div class="flex-1 overflow-y-auto">
            ${templates.length === 0 ? `
                <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>No templates saved yet.</p>
                    <p class="text-sm mt-1">Select a track above and save it as a template.</p>
                </div>
            ` : `
                <div class="space-y-2">
                    ${templates.map(t => `
                        <div class="p-3 bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-4 h-4 rounded" style="background-color: ${t.color || '#666'}"></div>
                                <div>
                                    <div class="font-medium text-sm text-gray-800 dark:text-gray-200">${t.name}</div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400">${t.type} • ${t.effectCount} effect${t.effectCount !== 1 ? 's' : ''}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button class="apply-template-btn px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600" data-template="${t.name}">
                                    Apply
                                </button>
                                <button class="rename-template-btn px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500" data-template="${t.name}">
                                    Rename
                                </button>
                                <button class="delete-template-btn px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" data-template="${t.name}">
                                    Delete
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;
    
    container.innerHTML = html;
    
    // Attach event handlers
    container.querySelector('#saveTemplateBtn')?.addEventListener('click', () => {
        const trackId = parseInt(container.querySelector('#templateSourceTrack')?.value, 10);
        const name = container.querySelector('#templateNameInput')?.value || '';
        
        if (!trackId) {
            localAppServices.showNotification?.('Please select a track', 1500);
            return;
        }
        if (!name.trim()) {
            localAppServices.showNotification?.('Please enter a template name', 1500);
            return;
        }
        
        if (saveTrackTemplate(trackId, name.trim())) {
            container.querySelector('#templateSourceTrack').value = '';
            container.querySelector('#templateNameInput').value = '';
            renderTemplateLibraryContent();
        }
    });
    
    container.querySelectorAll('.apply-template-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const templateName = e.target.dataset.template;
            const track = await applyTrackTemplate(templateName);
            if (track && localAppServices.renderTracks) {
                localAppServices.renderTracks();
            }
        });
    });
    
    container.querySelectorAll('.rename-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const oldName = e.target.dataset.template;
            const newName = prompt('Enter new template name:', oldName);
            if (newName && renameTrackTemplate(oldName, newName.trim())) {
                renderTemplateLibraryContent();
            }
        });
    });
    
    container.querySelectorAll('.delete-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const name = e.target.dataset.template;
            if (confirm(`Delete template "${name}"?`)) {
                deleteTrackTemplate(name);
                renderTemplateLibraryContent();
            }
        });
    });
    
    container.querySelector('#exportTemplatesBtn')?.addEventListener('click', () => {
        const json = exportTemplates();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'track-templates.json';
        a.click();
        URL.revokeObjectURL(url);
        localAppServices.showNotification?.('Templates exported', 1500);
    });
    
    container.querySelector('#importTemplatesBtn')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const text = await file.text();
            const count = importTemplates(text);
            localAppServices.showNotification?.(`Imported ${count} templates`, 1500);
            renderTemplateLibraryContent();
        };
        input.click();
    });
}

// Export functions for external access
export function getTrackTemplatesState() {
    return trackTemplates;
}