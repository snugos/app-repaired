/**
 * Track Routing Presets - Save/load track routing configurations
 * Allows saving and recalling track routing setups
 */

export class TrackRoutingPresets {
    constructor(dawState) {
        this.dawState = dawState;
        
        // Presets storage
        this.presets = new Map(); // presetId -> preset data
        
        // Load saved presets from localStorage
        this.loadFromStorage();
        
        // Callbacks
        this.onPresetSave = null;
        this.onPresetLoad = null;
        this.onPresetDelete = null;
    }
    
    savePreset(name, routing, options = {}) {
        const preset = {
            id: options.id ?? `routing-preset-${Date.now()}`,
            name,
            routing: this.extractRouting(routing),
            created: Date.now(),
            description: options.description ?? '',
            tags: options.tags ?? []
        };
        
        this.presets.set(preset.id, preset);
        this.saveToStorage();
        
        if (this.onPresetSave) {
            this.onPresetSave(preset);
        }
        
        return preset;
    }
    
    extractRouting(routing) {
        // Extract routing configuration from track data
        return {
            // Input routing
            input: routing.input ?? null,
            
            // Output routing
            output: routing.output ?? 'master',
            outputGain: routing.outputGain ?? 1,
            
            // Sends
            sends: (routing.sends ?? []).map(send => ({
                destination: send.destination,
                gain: send.gain,
                preFader: send.preFader ?? false,
                muted: send.muted ?? false
            })),
            
            // Insert effects
            inserts: (routing.inserts ?? []).map(insert => ({
                effectId: insert.effectId,
                effectType: insert.effectType,
                enabled: insert.enabled ?? true,
                params: insert.params ?? {}
            })),
            
            // Sidechain
            sidechain: routing.sidechain ? {
                source: routing.sidechain.source,
                threshold: routing.sidechain.threshold,
                ratio: routing.sidechain.ratio,
                enabled: routing.sidechain.enabled ?? true
            } : null,
            
            // Groups
            group: routing.group ?? null,
            
            // MIDI routing
            midiInput: routing.midiInput ?? null,
            midiOutput: routing.midiOutput ?? null,
            midiChannel: routing.midiChannel ?? null
        };
    }
    
    loadPreset(presetId, trackId) {
        const preset = this.presets.get(presetId);
        
        if (!preset) {
            throw new Error(`Preset ${presetId} not found`);
        }
        
        // Apply routing to track
        this.applyRouting(trackId, preset.routing);
        
        if (this.onPresetLoad) {
            this.onPresetLoad(preset, trackId);
        }
        
        return preset;
    }
    
    applyRouting(trackId, routing) {
        if (!this.dawState || !this.dawState.updateTrack) {
            throw new Error('DAW state not available');
        }
        
        const updates = {};
        
        // Apply output routing
        if (routing.output) {
            updates.output = routing.output;
        }
        
        if (routing.outputGain !== undefined) {
            updates.volume = routing.outputGain;
        }
        
        // Apply sends
        if (routing.sends) {
            updates.sends = routing.sends;
        }
        
        // Apply inserts
        if (routing.inserts) {
            updates.inserts = routing.inserts;
        }
        
        // Apply sidechain
        if (routing.sidechain) {
            updates.sidechain = routing.sidechain;
        }
        
        // Apply group
        if (routing.group !== undefined) {
            updates.group = routing.group;
        }
        
        // Apply MIDI routing
        if (routing.midiInput !== undefined) {
            updates.midiInput = routing.midiInput;
        }
        
        if (routing.midiOutput !== undefined) {
            updates.midiOutput = routing.midiOutput;
        }
        
        if (routing.midiChannel !== undefined) {
            updates.midiChannel = routing.midiChannel;
        }
        
        // Update track
        this.dawState.updateTrack(trackId, updates);
        
        return updates;
    }
    
    deletePreset(presetId) {
        const preset = this.presets.get(presetId);
        
        if (!preset) {
            return false;
        }
        
        this.presets.delete(presetId);
        this.saveToStorage();
        
        if (this.onPresetDelete) {
            this.onPresetDelete(preset);
        }
        
        return true;
    }
    
    getPreset(presetId) {
        return this.presets.get(presetId);
    }
    
    getAllPresets() {
        return Array.from(this.presets.values());
    }
    
    getPresetsByTag(tag) {
        return this.getAllPresets().filter(p => p.tags.includes(tag));
    }
    
    searchPresets(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAllPresets().filter(p => 
            p.name.toLowerCase().includes(lowerQuery) ||
            p.description.toLowerCase().includes(lowerQuery) ||
            p.tags.some(t => t.toLowerCase().includes(lowerQuery))
        );
    }
    
    updatePreset(presetId, updates) {
        const preset = this.presets.get(presetId);
        
        if (!preset) {
            return false;
        }
        
        if (updates.name) preset.name = updates.name;
        if (updates.description) preset.description = updates.description;
        if (updates.tags) preset.tags = updates.tags;
        if (updates.routing) preset.routing = this.extractRouting(updates.routing);
        
        this.saveToStorage();
        return true;
    }
    
    saveToStorage() {
        const data = Array.from(this.presets.entries());
        localStorage.setItem('trackRoutingPresets', JSON.stringify(data));
    }
    
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('trackRoutingPresets');
            if (stored) {
                const data = JSON.parse(stored);
                for (const [id, preset] of data) {
                    this.presets.set(id, preset);
                }
            }
        } catch (error) {
            console.warn('Failed to load routing presets from storage:', error);
        }
    }
    
    // Export/Import
    exportPreset(presetId) {
        const preset = this.presets.get(presetId);
        if (!preset) return null;
        
        return JSON.stringify(preset, null, 2);
    }
    
    exportAllPresets() {
        return JSON.stringify({
            version: 1,
            presets: this.getAllPresets()
        }, null, 2);
    }
    
    importPreset(jsonString) {
        try {
            const preset = JSON.parse(jsonString);
            
            // Generate new ID to avoid conflicts
            preset.id = `routing-preset-${Date.now()}`;
            preset.created = Date.now();
            
            this.presets.set(preset.id, preset);
            this.saveToStorage();
            
            return preset;
        } catch (error) {
            console.error('Failed to import preset:', error);
            return null;
        }
    }
    
    importAllPresets(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (!data.presets) return 0;
            
            let imported = 0;
            for (const preset of data.presets) {
                // Generate new ID to avoid conflicts
                preset.id = `routing-preset-${Date.now()}-${imported}`;
                
                this.presets.set(preset.id, preset);
                imported++;
            }
            
            this.saveToStorage();
            return imported;
        } catch (error) {
            console.error('Failed to import presets:', error);
            return 0;
        }
    }
    
    // Built-in presets
    getBuiltInPresets() {
        return [
            {
                id: 'builtin-simple-vocal',
                name: 'Simple Vocal Chain',
                description: 'Basic vocal routing with reverb send',
                tags: ['vocal', 'basic'],
                routing: {
                    output: 'master',
                    outputGain: 1,
                    sends: [
                        { destination: 'reverb', gain: 0.3, preFader: false }
                    ],
                    inserts: [
                        { effectType: 'compressor', enabled: true, params: { threshold: -18, ratio: 4 } },
                        { effectType: 'eq', enabled: true, params: { highpass: 80 } }
                    ]
                }
            },
            {
                id: 'builtin-drum-bus',
                name: 'Drum Bus',
                description: 'Drum group routing with parallel compression',
                tags: ['drums', 'bus', 'parallel'],
                routing: {
                    output: 'master',
                    outputGain: 1,
                    sends: [
                        { destination: 'parallel-compression', gain: 0.5, preFader: true }
                    ],
                    inserts: [
                        { effectType: 'compressor', enabled: true, params: { threshold: -12, ratio: 2, attack: 30 } }
                    ]
                }
            },
            {
                id: 'builtin-sidechain-bass',
                name: 'Sidechain Bass',
                description: 'Bass routing with kick sidechain',
                tags: ['bass', 'sidechain', 'edm'],
                routing: {
                    output: 'master',
                    outputGain: 1,
                    sidechain: {
                        source: 'kick',
                        threshold: -20,
                        ratio: 4,
                        enabled: true
                    }
                }
            }
        ];
    }
    
    loadBuiltInPresets() {
        for (const preset of this.getBuiltInPresets()) {
            this.presets.set(preset.id, {
                ...preset,
                created: Date.now()
            });
        }
        this.saveToStorage();
    }
    
    destroy() {
        this.presets.clear();
    }
}

// Factory function
export function createTrackRoutingPresets(dawState) {
    return new TrackRoutingPresets(dawState);
}

// UI Panel
export function createRoutingPresetsPanel(routingPresets, appServices) {
    const container = document.createElement('div');
    container.className = 'routing-presets-panel';
    container.style.cssText = `
        padding: 16px;
        background: #1a1a2e;
        border-radius: 8px;
        color: white;
        font-family: system-ui, sans-serif;
        min-width: 400px;
        max-height: 600px;
        overflow-y: auto;
    `;
    
    // Title
    const title = document.createElement('h3');
    title.textContent = 'Track Routing Presets';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 16px;';
    container.appendChild(title);
    
    // Save section
    const saveSection = document.createElement('div');
    saveSection.style.cssText = 'margin-bottom: 16px; padding: 12px; background: #0a0a14; border-radius: 4px;';
    saveSection.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Save Current Routing</div>
        <div style="display: flex; gap: 8px;">
            <input type="text" id="presetName" placeholder="Preset name" style="flex: 1; padding: 8px; background: #374151; border: none; border-radius: 4px; color: white;">
            <button id="savePreset" style="padding: 8px 16px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer;">
                Save
            </button>
        </div>
        <textarea id="presetDescription" placeholder="Description (optional)" style="width: 100%; margin-top: 8px; padding: 8px; background: #374151; border: none; border-radius: 4px; color: white; resize: vertical; min-height: 50px;"></textarea>
    `;
    container.appendChild(saveSection);
    
    // Presets list
    const listSection = document.createElement('div');
    listSection.id = 'presetsList';
    listSection.style.cssText = 'margin-bottom: 16px;';
    container.appendChild(listSection);
    
    // Update list
    updatePresetsList(listSection, routingPresets);
    
    // Actions
    const actionsSection = document.createElement('div');
    actionsSection.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
    actionsSection.innerHTML = `
        <button id="loadBuiltIn" style="flex: 1; padding: 10px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Load Built-ins
        </button>
        <button id="exportAll" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Export All
        </button>
        <button id="importPreset" style="flex: 1; padding: 10px; background: #374151; border: none; border-radius: 4px; color: white; cursor: pointer;">
            Import
        </button>
    `;
    container.appendChild(actionsSection);
    
    // Hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    container.appendChild(fileInput);
    
    // Event handlers
    document.getElementById('savePreset').addEventListener('click', () => {
        const name = document.getElementById('presetName').value.trim();
        const description = document.getElementById('presetDescription').value.trim();
        
        if (!name) {
            if (appServices && appServices.showNotification) {
                appServices.showNotification('Please enter a preset name', 2000);
            }
            return;
        }
        
        // Get current routing from selected track (simplified)
        const routing = {
            output: 'master',
            outputGain: 1,
            sends: [],
            inserts: []
        };
        
        routingPresets.savePreset(name, routing, { description });
        updatePresetsList(listSection, routingPresets);
        
        document.getElementById('presetName').value = '';
        document.getElementById('presetDescription').value = '';
        
        if (appServices && appServices.showNotification) {
            appServices.showNotification(`Saved routing preset: ${name}`, 2000);
        }
    });
    
    document.getElementById('loadBuiltIn').addEventListener('click', () => {
        routingPresets.loadBuiltInPresets();
        updatePresetsList(listSection, routingPresets);
        
        if (appServices && appServices.showNotification) {
            appServices.showNotification('Loaded built-in presets', 2000);
        }
    });
    
    document.getElementById('exportAll').addEventListener('click', () => {
        const data = routingPresets.exportAllPresets();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'routing-presets.json';
        a.click();
        
        URL.revokeObjectURL(url);
    });
    
    document.getElementById('importPreset').addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const text = await file.text();
            const count = routingPresets.importAllPresets(text);
            updatePresetsList(listSection, routingPresets);
            
            if (appServices && appServices.showNotification) {
                appServices.showNotification(`Imported ${count} presets`, 2000);
            }
        }
    });
    
    return container;
}

function updatePresetsList(container, routingPresets) {
    const presets = routingPresets.getAllPresets();
    
    if (presets.length === 0) {
        container.innerHTML = `
            <div style="color: #6b7280; font-style: italic; text-align: center; padding: 16px;">
                No presets saved. Save a routing configuration or load built-ins.
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div style="margin-bottom: 8px; font-size: 14px; color: #9ca3af;">Saved Presets (${presets.length})</div>
        <div style="max-height: 300px; overflow-y: auto;">
            ${presets.map(preset => `
                <div class="preset-item" data-id="${preset.id}" style="padding: 12px; background: #1e1e2e; margin-bottom: 8px; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <div style="font-weight: 600;">${preset.name}</div>
                            <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${preset.description || 'No description'}</div>
                            ${preset.tags.length > 0 ? `
                                <div style="margin-top: 4px;">
                                    ${preset.tags.map(t => `<span style="font-size: 10px; padding: 2px 6px; background: #374151; border-radius: 2px; margin-right: 4px;">${t}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button class="apply-preset" data-id="${preset.id}" style="padding: 4px 8px; background: #22c55e; border: none; border-radius: 4px; color: white; cursor: pointer;">
                                Apply
                            </button>
                            <button class="export-preset" data-id="${preset.id}" style="padding: 4px 8px; background: #3b82f6; border: none; border-radius: 4px; color: white; cursor: pointer;">
                                Export
                            </button>
                            <button class="delete-preset" data-id="${preset.id}" style="padding: 4px 8px; background: #ef4444; border: none; border-radius: 4px; color: white; cursor: pointer;">
                                ✕
                            </button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Add event handlers
    container.querySelectorAll('.apply-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.id;
            // In real implementation, would prompt for track selection
            if (appServices && appServices.showNotification) {
                appServices.showNotification('Select a track to apply the preset', 2000);
            }
        });
    });
    
    container.querySelectorAll('.export-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.id;
            const data = routingPresets.exportPreset(presetId);
            if (data) {
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `routing-preset-${presetId}.json`;
                a.click();
                
                URL.revokeObjectURL(url);
            }
        });
    });
    
    container.querySelectorAll('.delete-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetId = btn.dataset.id;
            if (confirm('Delete this preset?')) {
                routingPresets.deletePreset(presetId);
                updatePresetsList(container, routingPresets);
            }
        });
    });
}

export default TrackRoutingPresets;