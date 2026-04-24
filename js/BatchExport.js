/**
 * Batch Export - Export multiple regions at once
 * 
 * Features:
 * - Select multiple regions for export
 * - Export all tracks or selected tracks
 * - Multiple format options (WAV, MP3, FLAC)
 * - Batch naming conventions
 * - Progress tracking
 */

// Batch Export Manager
export class BatchExport {
    constructor(options = {}) {
        this.options = {
            defaultFormat: options.defaultFormat || 'wav',
            defaultBitDepth: options.defaultBitDepth || 24,
            defaultSampleRate: options.defaultSampleRate || 44100,
            ...options
        };
        
        // Export queue
        this.regions = [];
        this.tracks = [];
        this.isExporting = false;
        this.currentExport = null;
        this.progress = 0;
        
        // Callbacks
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        
        console.log('[BatchExport] Initialized');
    }
    
    /**
     * Add a region to export queue
     */
    addRegion(region) {
        this.regions.push({
            id: region.id || Date.now(),
            name: region.name || `Region ${this.regions.length + 1}`,
            start: region.start || 0,
            end: region.end || 0,
            tracks: region.tracks || 'all', // 'all' or array of track IDs
            format: region.format || this.options.defaultFormat,
            bitDepth: region.bitDepth || this.options.defaultBitDepth,
            sampleRate: region.sampleRate || this.options.defaultSampleRate,
            includeEffects: region.includeEffects !== false,
            normalize: region.normalize || false
        });
        
        console.log(`[BatchExport] Added region: ${region.name}`);
        return this.regions[this.regions.length - 1];
    }
    
    /**
     * Add multiple regions
     */
    addRegions(regions) {
        regions.forEach(r => this.addRegion(r));
        return this.regions.length;
    }
    
    /**
     * Remove a region
     */
    removeRegion(regionId) {
        const index = this.regions.findIndex(r => r.id === regionId);
        if (index >= 0) {
            this.regions.splice(index, 1);
            console.log(`[BatchExport] Removed region ${regionId}`);
            return true;
        }
        return false;
    }
    
    /**
     * Clear all regions
     */
    clearRegions() {
        this.regions = [];
        console.log('[BatchExport] Cleared all regions');
    }
    
    /**
     * Set tracks for export
     */
    setTracks(tracks) {
        this.tracks = tracks;
    }
    
    /**
     * Start batch export
     */
    async startExport(exportFunction) {
        if (this.isExporting) {
            console.warn('[BatchExport] Export already in progress');
            return false;
        }
        
        if (this.regions.length === 0) {
            console.warn('[BatchExport] No regions to export');
            return false;
        }
        
        this.isExporting = true;
        this.progress = 0;
        const results = [];
        
        console.log(`[BatchExport] Starting export of ${this.regions.length} regions`);
        
        for (let i = 0; i < this.regions.length; i++) {
            const region = this.regions[i];
            this.currentExport = region;
            this.progress = (i / this.regions.length) * 100;
            
            if (this.onProgress) {
                this.onProgress({
                    current: i + 1,
                    total: this.regions.length,
                    region: region.name,
                    progress: this.progress
                });
            }
            
            try {
                // Call the provided export function
                const result = await this._exportRegion(region, exportFunction);
                results.push({
                    region: region,
                    success: true,
                    data: result
                });
                
                console.log(`[BatchExport] Exported: ${region.name}`);
            } catch (error) {
                console.error(`[BatchExport] Failed to export ${region.name}:`, error);
                results.push({
                    region: region,
                    success: false,
                    error: error.message
                });
                
                if (this.onError) {
                    this.onError({
                        region: region.name,
                        error: error.message
                    });
                }
            }
        }
        
        this.isExporting = false;
        this.currentExport = null;
        this.progress = 100;
        
        if (this.onComplete) {
            this.onComplete({
                total: this.regions.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results: results
            });
        }
        
        console.log(`[BatchExport] Completed: ${results.filter(r => r.success).length}/${this.regions.length} successful`);
        return results;
    }
    
    /**
     * Export a single region
     */
    async _exportRegion(region, exportFunction) {
        // This would integrate with the DAW's actual export functionality
        if (exportFunction) {
            return await exportFunction({
                start: region.start,
                end: region.end,
                tracks: region.tracks,
                format: region.format,
                bitDepth: region.bitDepth,
                sampleRate: region.sampleRate,
                includeEffects: region.includeEffects,
                normalize: region.normalize
            });
        }
        
        // Mock export for standalone use
        return {
            blob: new Blob(),
            filename: `${region.name}.${region.format}`,
            duration: region.end - region.start
        };
    }
    
    /**
     * Cancel current export
     */
    cancelExport() {
        if (this.isExporting) {
            this.isExporting = false;
            this.currentExport = null;
            this.progress = 0;
            console.log('[BatchExport] Export cancelled');
            return true;
        }
        return false;
    }
    
    /**
     * Get current state
     */
    getState() {
        return {
            isExporting: this.isExporting,
            progress: this.progress,
            currentExport: this.currentExport,
            regionCount: this.regions.length,
            regions: this.regions.map(r => ({
                id: r.id,
                name: r.name,
                start: r.start,
                end: r.end,
                duration: r.end - r.start
            }))
        };
    }
}

/**
 * Open Batch Export Panel
 */
export function openBatchExportPanel(services) {
    const { showNotification, getTracks, getTrackById, exportToWav } = services;
    
    const panel = document.createElement('div');
    panel.id = 'batch-export-panel';
    panel.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
    panel.innerHTML = `
        <div class="bg-zinc-900 rounded-xl p-6 w-[900px] max-h-[90vh] overflow-y-auto border border-zinc-700">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-white">Batch Export</h2>
                <button id="close-batch-export" class="text-zinc-400 hover:text-white text-2xl">&times;</button>
            </div>
            
            <div class="grid grid-cols-2 gap-6 mb-6">
                <div class="bg-zinc-800 rounded-lg p-4">
                    <h3 class="text-lg font-semibold text-white mb-4">Export Regions</h3>
                    <div id="regions-list" class="space-y-2 max-h-[300px] overflow-y-auto mb-4">
                        <div class="text-zinc-500 text-sm">No regions defined</div>
                    </div>
                    
                    <div class="flex gap-2 mb-4">
                        <button id="add-region-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm">
                            Add Region
                        </button>
                        <button id="add-markers-btn" class="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white rounded text-sm">
                            From Markers
                        </button>
                        <button id="add-selection-btn" class="px-4 py-2 bg-zinc-600 hover:bg-zinc-500 text-white rounded text-sm">
                            From Selection
                        </button>
                    </div>
                    
                    <div id="region-form" class="hidden bg-zinc-700 rounded-lg p-4">
                        <h4 class="text-white font-medium mb-3">Region Settings</h4>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-zinc-400 text-xs">Name</label>
                                <input type="text" id="region-name" class="w-full bg-zinc-600 text-white rounded p-2 text-sm" placeholder="Region name">
                            </div>
                            <div>
                                <label class="text-zinc-400 text-xs">Format</label>
                                <select id="region-format" class="w-full bg-zinc-600 text-white rounded p-2 text-sm">
                                    <option value="wav">WAV</option>
                                    <option value="mp3">MP3</option>
                                    <option value="flac">FLAC</option>
                                </select>
                            </div>
                            <div>
                                <label class="text-zinc-400 text-xs">Start (bars)</label>
                                <input type="number" id="region-start" class="w-full bg-zinc-600 text-white rounded p-2 text-sm" value="0" min="0" step="0.5">
                            </div>
                            <div>
                                <label class="text-zinc-400 text-xs">End (bars)</label>
                                <input type="number" id="region-end" class="w-full bg-zinc-600 text-white rounded p-2 text-sm" value="4" min="0" step="0.5">
                            </div>
                        </div>
                        <div class="flex gap-2 mt-3">
                            <button id="save-region-btn" class="px-4 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-sm">
                                Save Region
                            </button>
                            <button id="cancel-region-btn" class="px-4 py-1 bg-zinc-600 hover:bg-zinc-500 text-white rounded text-sm">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="bg-zinc-800 rounded-lg p-4">
                    <h3 class="text-lg font-semibold text-white mb-4">Track Selection</h3>
                    <div id="tracks-list" class="space-y-2 max-h-[200px] overflow-y-auto mb-4">
                        <div class="text-zinc-500 text-sm">No tracks available</div>
                    </div>
                    
                    <div class="flex gap-2">
                        <button id="select-all-tracks-btn" class="px-3 py-1 bg-zinc-600 hover:bg-zinc-500 text-white rounded text-sm">
                            Select All
                        </button>
                        <button id="deselect-all-tracks-btn" class="px-3 py-1 bg-zinc-600 hover:bg-zinc-500 text-white rounded text-sm">
                            Deselect All
                        </button>
                    </div>
                    
                    <h3 class="text-lg font-semibold text-white mt-6 mb-4">Export Settings</h3>
                    <div class="space-y-3">
                        <div>
                            <label class="text-zinc-400 text-xs">Default Format</label>
                            <select id="default-format" class="w-full bg-zinc-600 text-white rounded p-2 text-sm">
                                <option value="wav">WAV (24-bit)</option>
                                <option value="wav16">WAV (16-bit)</option>
                                <option value="mp3">MP3 (320kbps)</option>
                                <option value="flac">FLAC</option>
                            </select>
                        </div>
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="include-effects" checked class="accent-blue-500">
                            <label class="text-zinc-400 text-sm">Include master effects</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="normalize-audio" class="accent-blue-500">
                            <label class="text-zinc-400 text-sm">Normalize audio</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="separate-tracks" class="accent-blue-500">
                            <label class="text-zinc-400 text-sm">Export each track separately</label>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="bg-zinc-800 rounded-lg p-4 mb-6">
                <h3 class="text-lg font-semibold text-white mb-2">Export Progress</h3>
                <div class="flex items-center gap-4">
                    <div class="flex-1 bg-zinc-700 rounded-full h-4 overflow-hidden">
                        <div id="export-progress-bar" class="bg-blue-500 h-full transition-all" style="width: 0%"></div>
                    </div>
                    <span id="export-progress-text" class="text-white text-sm">Ready</span>
                </div>
                <div id="export-status" class="text-zinc-400 text-sm mt-2"></div>
            </div>
            
            <div class="flex gap-4">
                <button id="start-export-btn" class="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded font-medium">
                    Start Batch Export
                </button>
                <button id="cancel-export-btn" class="px-6 py-3 bg-red-600/50 hover:bg-red-600 text-white rounded font-medium hidden">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Initialize batch exporter
    const batchExport = new BatchExport();
    let editingRegionId = null;
    
    // Populate tracks
    const tracks = getTracks ? getTracks() : [];
    const tracksList = panel.querySelector('#tracks-list');
    const selectedTrackIds = new Set();
    
    if (tracks.length > 0) {
        tracksList.innerHTML = tracks.map(track => `
            <div class="flex items-center gap-2 bg-zinc-700 rounded p-2">
                <input type="checkbox" class="track-select accent-blue-500" data-track-id="${track.id}">
                <span class="text-white text-sm">${track.name}</span>
                <span class="text-zinc-500 text-xs ml-auto">${track.type}</span>
            </div>
        `).join('');
        
        tracksList.querySelectorAll('.track-select').forEach(cb => {
            cb.onchange = () => {
                if (cb.checked) {
                    selectedTrackIds.add(cb.dataset.trackId);
                } else {
                    selectedTrackIds.delete(cb.dataset.trackId);
                }
            };
        });
    }
    
    // Update regions list
    function updateRegionsList() {
        const listEl = panel.querySelector('#regions-list');
        const state = batchExport.getState();
        
        if (state.regionCount === 0) {
            listEl.innerHTML = '<div class="text-zinc-500 text-sm">No regions defined</div>';
            return;
        }
        
        listEl.innerHTML = state.regions.map(r => `
            <div class="flex items-center justify-between bg-zinc-700 rounded p-2">
                <div>
                    <span class="text-white text-sm">${r.name}</span>
                    <span class="text-zinc-500 text-xs ml-2">Bar ${r.start} - ${r.end} (${r.duration} bars)</span>
                </div>
                <div class="flex gap-1">
                    <button class="edit-region text-blue-400 hover:text-blue-300 text-xs" data-id="${r.id}">Edit</button>
                    <button class="delete-region text-red-400 hover:text-red-300 text-xs" data-id="${r.id}">✕</button>
                </div>
            </div>
        `).join('');
        
        listEl.querySelectorAll('.edit-region').forEach(btn => {
            btn.onclick = () => editRegion(btn.dataset.id);
        });
        
        listEl.querySelectorAll('.delete-region').forEach(btn => {
            btn.onclick = () => {
                batchExport.removeRegion(parseInt(btn.dataset.id));
                updateRegionsList();
            };
        });
    }
    
    // Show region form
    function showRegionForm(region = null) {
        const form = panel.querySelector('#region-form');
        form.classList.remove('hidden');
        
        if (region) {
            editingRegionId = region.id;
            panel.querySelector('#region-name').value = region.name;
            panel.querySelector('#region-start').value = region.start;
            panel.querySelector('#region-end').value = region.end;
            panel.querySelector('#region-format').value = region.format;
        } else {
            editingRegionId = null;
            panel.querySelector('#region-name').value = '';
            panel.querySelector('#region-start').value = '0';
            panel.querySelector('#region-end').value = '4';
        }
    }
    
    // Edit region
    function editRegion(regionId) {
        const region = batchExport.regions.find(r => r.id === parseInt(regionId));
        if (region) {
            showRegionForm(region);
        }
    }
    
    // Event handlers
    panel.querySelector('#close-batch-export').onclick = () => {
        if (batchExport.isExporting) {
            if (!confirm('Export in progress. Cancel and close?')) return;
            batchExport.cancelExport();
        }
        panel.remove();
    };
    
    panel.querySelector('#add-region-btn').onclick = () => showRegionForm();
    
    panel.querySelector('#save-region-btn').onclick = () => {
        const region = {
            id: editingRegionId || Date.now(),
            name: panel.querySelector('#region-name').value || `Region ${batchExport.regions.length + 1}`,
            start: parseFloat(panel.querySelector('#region-start').value) || 0,
            end: parseFloat(panel.querySelector('#region-end').value) || 4,
            format: panel.querySelector('#region-format').value
        };
        
        if (editingRegionId) {
            batchExport.removeRegion(editingRegionId);
        }
        
        batchExport.addRegion(region);
        updateRegionsList();
        
        panel.querySelector('#region-form').classList.add('hidden');
        if (showNotification) showNotification(`Region "${region.name}" saved`, 1500);
    };
    
    panel.querySelector('#cancel-region-btn').onclick = () => {
        panel.querySelector('#region-form').classList.add('hidden');
    };
    
    panel.querySelector('#select-all-tracks-btn').onclick = () => {
        tracksList.querySelectorAll('.track-select').forEach(cb => {
            cb.checked = true;
            selectedTrackIds.add(cb.dataset.trackId);
        });
    };
    
    panel.querySelector('#deselect-all-tracks-btn').onclick = () => {
        tracksList.querySelectorAll('.track-select').forEach(cb => {
            cb.checked = false;
        });
        selectedTrackIds.clear();
    };
    
    // Export handlers
    const startBtn = panel.querySelector('#start-export-btn');
    const cancelBtn = panel.querySelector('#cancel-export-btn');
    const progressBar = panel.querySelector('#export-progress-bar');
    const progressText = panel.querySelector('#export-progress-text');
    const statusText = panel.querySelector('#export-status');
    
    startBtn.onclick = async () => {
        if (batchExport.getState().regionCount === 0) {
            if (showNotification) showNotification('Please add at least one region to export', 2000);
            return;
        }
        
        // Set up callbacks
        batchExport.onProgress = (info) => {
            progressBar.style.width = `${info.progress}%`;
            progressText.textContent = `${info.current}/${info.total} - ${info.region}`;
        };
        
        batchExport.onComplete = (result) => {
            progressBar.style.width = '100%';
            progressText.textContent = 'Complete';
            statusText.textContent = `Exported ${result.successful}/${result.total} regions`;
            startBtn.disabled = false;
            cancelBtn.classList.add('hidden');
            
            if (showNotification) showNotification(`Batch export complete: ${result.successful} successful`, 3000);
        };
        
        batchExport.onError = (info) => {
            statusText.textContent += `\nFailed: ${info.region} - ${info.error}`;
        };
        
        // Start export
        startBtn.disabled = true;
        cancelBtn.classList.remove('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = 'Starting...';
        
        await batchExport.startExport(exportToWav);
    };
    
    cancelBtn.onclick = () => {
        batchExport.cancelExport();
        progressBar.style.width = '0%';
        progressText.textContent = 'Cancelled';
        startBtn.disabled = false;
        cancelBtn.classList.add('hidden');
    };
    
    console.log('[BatchExport] Panel opened');
}

// Default export
export default BatchExport;