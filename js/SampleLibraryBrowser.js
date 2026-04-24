/**
 * Sample Library Browser - Browse and preview samples from built-in library
 * Provides a UI for browsing, previewing, and importing samples
 */

// Built-in sample library with categories
const SAMPLE_LIBRARY = {
    drums: {
        name: 'Drums',
        samples: [
            { name: 'Kick 808', file: 'samples/drums/kick_808.wav', duration: 0.5, bpm: 120 },
            { name: 'Kick Acoustic', file: 'samples/drums/kick_acoustic.wav', duration: 0.4, bpm: null },
            { name: 'Snare 808', file: 'samples/drums/snare_808.wav', duration: 0.3, bpm: 120 },
            { name: 'Snare Tight', file: 'samples/drums/snare_tight.wav', duration: 0.2, bpm: null },
            { name: 'Hi-Hat Closed', file: 'samples/drums/hh_closed.wav', duration: 0.1, bpm: null },
            { name: 'Hi-Hat Open', file: 'samples/drums/hh_open.wav', duration: 0.3, bpm: null },
            { name: 'Crash', file: 'samples/drums/crash.wav', duration: 1.5, bpm: null },
            { name: 'Ride', file: 'samples/drums/ride.wav', duration: 0.8, bpm: null },
            { name: 'Tom Hi', file: 'samples/drums/tom_hi.wav', duration: 0.4, bpm: null },
            { name: 'Tom Lo', file: 'samples/drums/tom_lo.wav', duration: 0.5, bpm: null },
            { name: 'Clap', file: 'samples/drums/clap.wav', duration: 0.2, bpm: null },
            { name: 'Rim', file: 'samples/drums/rim.wav', duration: 0.15, bpm: null }
        ]
    },
    bass: {
        name: 'Bass',
        samples: [
            { name: 'Bass C2', file: 'samples/bass/bass_c2.wav', duration: 1.0, key: 'C2' },
            { name: 'Bass E2', file: 'samples/bass/bass_e2.wav', duration: 1.0, key: 'E2' },
            { name: 'Bass G2', file: 'samples/bass/bass_g2.wav', duration: 1.0, key: 'G2' },
            { name: 'Sub Bass C1', file: 'samples/bass/sub_c1.wav', duration: 2.0, key: 'C1' },
            { name: 'Sub Bass E1', file: 'samples/bass/sub_e1.wav', duration: 2.0, key: 'E1' },
            { name: 'Bass Pluck C2', file: 'samples/bass/pluck_c2.wav', duration: 0.3, key: 'C2' }
        ]
    },
    synths: {
        name: 'Synths',
        samples: [
            { name: 'Synth Pad C3', file: 'samples/synths/pad_c3.wav', duration: 2.0, key: 'C3' },
            { name: 'Synth Pad E3', file: 'samples/synths/pad_e3.wav', duration: 2.0, key: 'E3' },
            { name: 'Synth Lead C4', file: 'samples/synths/lead_c4.wav', duration: 1.0, key: 'C4' },
            { name: 'Synth Pluck C4', file: 'samples/synths/pluck_c4.wav', duration: 0.5, key: 'C4' },
            { name: 'Synth Stab C3', file: 'samples/synths/stab_c3.wav', duration: 0.3, key: 'C3' }
        ]
    },
    fx: {
        name: 'FX',
        samples: [
            { name: 'Riser', file: 'samples/fx/riser.wav', duration: 4.0, bpm: 128 },
            { name: 'Impact', file: 'samples/fx/impact.wav', duration: 1.0, bpm: null },
            { name: 'Downlifter', file: 'samples/fx/downlifter.wav', duration: 2.0, bpm: 128 },
            { name: 'Uplifter', file: 'samples/fx/uplifter.wav', duration: 2.0, bpm: 128 },
            { name: 'Swoosh', file: 'samples/fx/swoosh.wav', duration: 0.5, bpm: null },
            { name: 'White Noise', file: 'samples/fx/white_noise.wav', duration: 1.0, bpm: null }
        ]
    },
    vocals: {
        name: 'Vocals',
        samples: [
            { name: 'Vocal Chop 1', file: 'samples/vocals/chop1.wav', duration: 0.3, key: 'C4' },
            { name: 'Vocal Chop 2', file: 'samples/vocals/chop2.wav', duration: 0.3, key: 'E4' },
            { name: 'Vocal Chop 3', file: 'samples/vocals/chop3.wav', duration: 0.3, key: 'G4' },
            { name: 'Vocal Ah', file: 'samples/vocals/ah.wav', duration: 1.0, key: 'C4' },
            { name: 'Vocal Ooh', file: 'samples/vocals/ooh.wav', duration: 1.0, key: 'E4' }
        ]
    },
    percussion: {
        name: 'Percussion',
        samples: [
            { name: 'Conga Hi', file: 'samples/perc/conga_hi.wav', duration: 0.3, bpm: null },
            { name: 'Conga Lo', file: 'samples/perc/conga_lo.wav', duration: 0.4, bpm: null },
            { name: 'Tambourine', file: 'samples/perc/tamb.wav', duration: 0.2, bpm: null },
            { name: 'Shaker', file: 'samples/perc/shaker.wav', duration: 0.2, bpm: null },
            { name: 'Cowbell', file: 'samples/perc/cowbell.wav', duration: 0.2, bpm: null },
            { name: 'Guiro', file: 'samples/perc/guiro.wav', duration: 0.4, bpm: null }
        ]
    }
};

// Sample Library Browser class
class SampleLibraryBrowser {
    constructor() {
        this.isOpen = false;
        this.selectedCategory = 'drums';
        this.selectedSample = null;
        this.previewPlayer = null;
        this.searchQuery = '';
        this.favorites = this.loadFavorites();
        this.recentSamples = this.loadRecentSamples();
        this.customSamples = this.loadCustomSamples();
        this.onSampleSelect = null;
        this.audioContext = null;
        this.previewVolume = 0.7;
        this.isPlaying = false;
    }

    // Initialize audio context for preview
    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    // Load favorites from localStorage
    loadFavorites() {
        try {
            return JSON.parse(localStorage.getItem('sampleBrowser_favorites') || '[]');
        } catch {
            return [];
        }
    }

    // Save favorites to localStorage
    saveFavorites() {
        localStorage.setItem('sampleBrowser_favorites', JSON.stringify(this.favorites));
    }

    // Load recent samples from localStorage
    loadRecentSamples() {
        try {
            return JSON.parse(localStorage.getItem('sampleBrowser_recent') || '[]');
        } catch {
            return [];
        }
    }

    // Save recent samples
    saveRecentSamples() {
        localStorage.setItem('sampleBrowser_recent', JSON.stringify(this.recentSamples.slice(0, 20)));
    }

    // Load custom samples
    loadCustomSamples() {
        try {
            return JSON.parse(localStorage.getItem('sampleBrowser_custom') || '[]');
        } catch {
            return [];
        }
    }

    // Save custom samples
    saveCustomSamples() {
        localStorage.setItem('sampleBrowser_custom', JSON.stringify(this.customSamples));
    }

    // Add to favorites
    toggleFavorite(sample) {
        const sampleKey = `${sample.category}/${sample.name}`;
        const index = this.favorites.indexOf(sampleKey);
        if (index >= 0) {
            this.favorites.splice(index, 1);
        } else {
            this.favorites.push(sampleKey);
        }
        this.saveFavorites();
    }

    // Check if sample is favorite
    isFavorite(sample) {
        const sampleKey = `${sample.category}/${sample.name}`;
        return this.favorites.includes(sampleKey);
    }

    // Add to recent
    addToRecent(sample) {
        const sampleKey = `${sample.category}/${sample.name}`;
        const index = this.recentSamples.indexOf(sampleKey);
        if (index >= 0) {
            this.recentSamples.splice(index, 1);
        }
        this.recentSamples.unshift(sampleKey);
        this.saveRecentSamples();
    }

    // Get all samples as flat array with category
    getAllSamples() {
        const samples = [];
        for (const [categoryKey, category] of Object.entries(SAMPLE_LIBRARY)) {
            for (const sample of category.samples) {
                samples.push({
                    ...sample,
                    category: categoryKey,
                    categoryName: category.name
                });
            }
        }
        // Add custom samples
        for (const sample of this.customSamples) {
            samples.push({
                ...sample,
                category: 'custom',
                categoryName: 'Custom'
            });
        }
        return samples;
    }

    // Search samples
    searchSamples(query) {
        if (!query) return this.getAllSamples();
        const lowerQuery = query.toLowerCase();
        return this.getAllSamples().filter(s => 
            s.name.toLowerCase().includes(lowerQuery) ||
            s.categoryName.toLowerCase().includes(lowerQuery) ||
            (s.key && s.key.toLowerCase().includes(lowerQuery))
        );
    }

    // Preview sample
    async previewSample(sample) {
        this.initAudioContext();
        
        try {
            // For demo, use a synthesized preview
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Map sample name to frequency for demo
            const freqMap = {
                'Kick': 60,
                'Snare': 200,
                'Hi-Hat': 8000,
                'Crash': 5000,
                'Tom': 100,
                'Clap': 1000,
                'Rim': 800,
                'Conga': 200,
                'Shaker': 4000,
                'Bass': 80,
                'Synth': 440,
                'Vocal': 350,
                'Riser': 2000,
                'Impact': 50
            };
            
            let freq = 440;
            for (const [key, f] of Object.entries(freqMap)) {
                if (sample.name.includes(key)) {
                    freq = f;
                    break;
                }
            }
            
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            oscillator.type = sample.category === 'drums' || sample.category === 'percussion' ? 'square' : 'sine';
            
            gainNode.gain.setValueAtTime(this.previewVolume * 0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sample.duration);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + sample.duration);
            
            this.isPlaying = true;
            oscillator.onended = () => {
                this.isPlaying = false;
            };
            
        } catch (error) {
            console.error('Error previewing sample:', error);
        }
    }

    // Stop preview
    stopPreview() {
        if (this.audioContext && this.isPlaying) {
            // Stop all oscillators
            this.isPlaying = false;
        }
    }

    // Import custom sample
    async importCustomSample(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const sample = {
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    file: e.target.result, // Data URL
                    duration: 1.0, // Would need to decode to get actual duration
                    category: 'custom',
                    addedAt: Date.now()
                };
                this.customSamples.push(sample);
                this.saveCustomSamples();
                resolve(sample);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Select sample for use
    selectSample(sample) {
        this.selectedSample = sample;
        this.addToRecent(sample);
        if (this.onSampleSelect) {
            this.onSampleSelect(sample);
        }
    }

    // Get samples by category
    getSamplesByCategory(category) {
        if (category === 'favorites') {
            return this.getAllSamples().filter(s => this.isFavorite(s));
        }
        if (category === 'recent') {
            return this.recentSamples.map(key => {
                const [cat, ...nameParts] = key.split('/');
                const name = nameParts.join('/');
                return this.getAllSamples().find(s => s.category === cat && s.name === name);
            }).filter(Boolean);
        }
        if (category === 'custom') {
            return this.customSamples.map(s => ({...s, category: 'custom', categoryName: 'Custom'}));
        }
        const categoryData = SAMPLE_LIBRARY[category];
        if (categoryData) {
            return categoryData.samples.map(s => ({
                ...s,
                category,
                categoryName: categoryData.name
            }));
        }
        return [];
    }

    // Set preview volume
    setPreviewVolume(volume) {
        this.previewVolume = Math.max(0, Math.min(1, volume));
    }
}

// Global instance
let sampleLibraryBrowser = null;

// Initialize the sample library browser
function initSampleLibraryBrowser() {
    if (!sampleLibraryBrowser) {
        sampleLibraryBrowser = new SampleLibraryBrowser();
    }
    return sampleLibraryBrowser;
}

// Open sample library browser panel
function openSampleLibraryBrowserPanel() {
    if (!sampleLibraryBrowser) {
        initSampleLibraryBrowser();
    }
    sampleLibraryBrowser.isOpen = true;
    
    // Create panel HTML
    const panel = document.createElement('div');
    panel.id = 'sample-library-browser-panel';
    panel.className = 'sample-library-panel';
    panel.innerHTML = `
        <div class="sample-library-header">
            <h2>Sample Library</h2>
            <button id="close-sample-browser" class="close-btn">×</button>
        </div>
        
        <div class="sample-library-search">
            <input type="text" id="sample-search-input" placeholder="Search samples..." />
        </div>
        
        <div class="sample-library-content">
            <div class="sample-categories">
                <h3>Categories</h3>
                <div class="category-list">
                    <button class="category-btn active" data-category="drums">🥁 Drums</button>
                    <button class="category-btn" data-category="bass">🎸 Bass</button>
                    <button class="category-btn" data-category="synths">🎹 Synths</button>
                    <button class="category-btn" data-category="fx">✨ FX</button>
                    <button class="category-btn" data-category="vocals">🎤 Vocals</button>
                    <button class="category-btn" data-category="percussion">🪘 Percussion</button>
                    <hr/>
                    <button class="category-btn" data-category="favorites">⭐ Favorites</button>
                    <button class="category-btn" data-category="recent">🕐 Recent</button>
                    <button class="category-btn" data-category="custom">📁 Custom</button>
                </div>
                
                <div class="import-section">
                    <h3>Import</h3>
                    <input type="file" id="import-sample-file" accept="audio/*" multiple />
                    <button id="import-sample-btn" class="import-btn">+ Add Samples</button>
                </div>
            </div>
            
            <div class="sample-list-container">
                <div class="sample-list" id="sample-list">
                    <!-- Samples populated here -->
                </div>
            </div>
            
            <div class="sample-details" id="sample-details">
                <h3>Select a sample</h3>
                <p>Click a sample to see details and preview</p>
            </div>
        </div>
        
        <div class="sample-library-footer">
            <div class="preview-controls">
                <label>Preview Volume:</label>
                <input type="range" id="preview-volume" min="0" max="100" value="70" />
            </div>
            <button id="use-sample-btn" class="use-btn" disabled>Use Sample</button>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .sample-library-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 900px;
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
        
        .sample-library-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #16213e;
            border-radius: 12px 12px 0 0;
        }
        
        .sample-library-header h2 {
            margin: 0;
            font-size: 20px;
        }
        
        .close-btn {
            background: transparent;
            border: none;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            opacity: 0.7;
        }
        
        .close-btn:hover {
            opacity: 1;
        }
        
        .sample-library-search {
            padding: 12px 20px;
            background: #0f0f1a;
        }
        
        .sample-library-search input {
            width: 100%;
            padding: 10px 16px;
            border-radius: 8px;
            border: 1px solid #333;
            background: #1a1a2e;
            color: #fff;
            font-size: 14px;
        }
        
        .sample-library-content {
            display: flex;
            flex: 1;
            overflow: hidden;
        }
        
        .sample-categories {
            width: 200px;
            padding: 16px;
            background: #0f0f1a;
            overflow-y: auto;
        }
        
        .sample-categories h3 {
            margin: 0 0 12px;
            font-size: 14px;
            color: #888;
            text-transform: uppercase;
        }
        
        .category-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .category-btn {
            padding: 10px 12px;
            background: transparent;
            border: none;
            border-radius: 6px;
            color: #ccc;
            cursor: pointer;
            text-align: left;
            font-size: 14px;
            transition: all 0.2s;
        }
        
        .category-btn:hover {
            background: #1a1a2e;
        }
        
        .category-btn.active {
            background: #e94560;
            color: #fff;
        }
        
        .import-section {
            margin-top: 20px;
        }
        
        .import-section input[type="file"] {
            display: none;
        }
        
        .import-btn {
            width: 100%;
            padding: 10px;
            background: #4a4a6a;
            border: none;
            border-radius: 6px;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
        }
        
        .import-btn:hover {
            background: #5a5a7a;
        }
        
        .sample-list-container {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
        }
        
        .sample-list {
            display: grid;
            gap: 8px;
        }
        
        .sample-item {
            display: flex;
            align-items: center;
            padding: 12px;
            background: #16213e;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .sample-item:hover {
            background: #1f2b4d;
        }
        
        .sample-item.selected {
            background: #e94560;
        }
        
        .sample-item-name {
            flex: 1;
            font-size: 14px;
        }
        
        .sample-item-meta {
            font-size: 12px;
            color: #888;
        }
        
        .sample-favorite-btn {
            background: transparent;
            border: none;
            color: #666;
            cursor: pointer;
            font-size: 18px;
            margin-right: 8px;
        }
        
        .sample-favorite-btn.active {
            color: #ffd700;
        }
        
        .sample-details {
            width: 250px;
            padding: 16px;
            background: #0f0f1a;
            border-left: 1px solid #333;
        }
        
        .sample-details h3 {
            margin: 0 0 12px;
            font-size: 16px;
        }
        
        .sample-detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #333;
            font-size: 13px;
        }
        
        .sample-detail-label {
            color: #888;
        }
        
        .sample-library-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #16213e;
            border-radius: 0 0 12px 12px;
        }
        
        .preview-controls {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .use-btn {
            padding: 12px 24px;
            background: #e94560;
            border: none;
            border-radius: 8px;
            color: #fff;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
        }
        
        .use-btn:disabled {
            background: #444;
            cursor: not-allowed;
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(panel);
    
    // Event handlers
    const closeBtn = panel.querySelector('#close-sample-browser');
    const searchInput = panel.querySelector('#sample-search-input');
    const sampleList = panel.querySelector('#sample-list');
    const sampleDetails = panel.querySelector('#sample-details');
    const useBtn = panel.querySelector('#use-sample-btn');
    const previewVolume = panel.querySelector('#preview-volume');
    const categoryBtns = panel.querySelectorAll('.category-btn');
    const importFileInput = panel.querySelector('#import-sample-file');
    const importBtn = panel.querySelector('#import-sample-btn');
    
    // Render samples for current category
    function renderSamples(category = 'drums') {
        const samples = sampleLibraryBrowser.searchQuery 
            ? sampleLibraryBrowser.searchSamples(sampleLibraryBrowser.searchQuery)
            : sampleLibraryBrowser.getSamplesByCategory(category);
        
        sampleList.innerHTML = samples.map(sample => `
            <div class="sample-item ${sampleLibraryBrowser.selectedSample?.name === sample.name ? 'selected' : ''}" 
                 data-sample-name="${sample.name}" data-category="${sample.category}">
                <button class="sample-favorite-btn ${sampleLibraryBrowser.isFavorite(sample) ? 'active' : ''}"
                        data-sample-name="${sample.name}" data-category="${sample.category}">★</button>
                <span class="sample-item-name">${sample.name}</span>
                <span class="sample-item-meta">${sample.duration?.toFixed(1) || '?'}s ${sample.key || sample.bpm || ''}</span>
            </div>
        `).join('');
        
        // Add click handlers
        sampleList.querySelectorAll('.sample-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('sample-favorite-btn')) return;
                
                const name = item.dataset.sampleName;
                const cat = item.dataset.category;
                const sample = samples.find(s => s.name === name && s.category === cat);
                if (sample) {
                    sampleLibraryBrowser.selectSample(sample);
                    useBtn.disabled = false;
                    renderSampleDetails(sample);
                    sampleLibraryBrowser.previewSample(sample);
                }
            });
        });
        
        // Favorite buttons
        sampleList.querySelectorAll('.sample-favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const name = btn.dataset.sampleName;
                const cat = btn.dataset.category;
                const sample = samples.find(s => s.name === name && s.category === cat);
                if (sample) {
                    sampleLibraryBrowser.toggleFavorite(sample);
                    btn.classList.toggle('active');
                }
            });
        });
    }
    
    // Render sample details
    function renderSampleDetails(sample) {
        sampleDetails.innerHTML = `
            <h3>${sample.name}</h3>
            <div class="sample-detail-row">
                <span class="sample-detail-label">Category</span>
                <span>${sample.categoryName}</span>
            </div>
            <div class="sample-detail-row">
                <span class="sample-detail-label">Duration</span>
                <span>${sample.duration?.toFixed(2) || '?'}s</span>
            </div>
            ${sample.key ? `
            <div class="sample-detail-row">
                <span class="sample-detail-label">Key</span>
                <span>${sample.key}</span>
            </div>
            ` : ''}
            ${sample.bpm ? `
            <div class="sample-detail-row">
                <span class="sample-detail-label">BPM</span>
                <span>${sample.bpm}</span>
            </div>
            ` : ''}
            <button id="preview-sample-btn" class="use-btn" style="width: 100%; margin-top: 16px;">
                ▶ Preview
            </button>
        `;
        
        const previewBtn = sampleDetails.querySelector('#preview-sample-btn');
        previewBtn?.addEventListener('click', () => {
            if (sampleLibraryBrowser.isPlaying) {
                sampleLibraryBrowser.stopPreview();
                previewBtn.textContent = '▶ Preview';
            } else {
                sampleLibraryBrowser.previewSample(sample);
                previewBtn.textContent = '⏹ Stop';
            }
        });
    }
    
    // Close button
    closeBtn.addEventListener('click', () => {
        sampleLibraryBrowser.isOpen = false;
        panel.remove();
    });
    
    // Search
    searchInput.addEventListener('input', (e) => {
        sampleLibraryBrowser.searchQuery = e.target.value;
        renderSamples(sampleLibraryBrowser.selectedCategory);
    });
    
    // Category selection
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sampleLibraryBrowser.selectedCategory = btn.dataset.category;
            renderSamples(btn.dataset.category);
        });
    });
    
    // Preview volume
    previewVolume.addEventListener('input', (e) => {
        sampleLibraryBrowser.setPreviewVolume(e.target.value / 100);
    });
    
    // Use sample
    useBtn.addEventListener('click', () => {
        if (sampleLibraryBrowser.selectedSample) {
            sampleLibraryBrowser.selectSample(sampleLibraryBrowser.selectedSample);
            sampleLibraryBrowser.isOpen = false;
            panel.remove();
        }
    });
    
    // Import samples
    importBtn.addEventListener('click', () => {
        importFileInput.click();
    });
    
    importFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            await sampleLibraryBrowser.importCustomSample(file);
        }
        renderSamples('custom');
        // Switch to custom category
        categoryBtns.forEach(b => b.classList.remove('active'));
        panel.querySelector('[data-category="custom"]')?.classList.add('active');
    });
    
    // Initial render
    renderSamples('drums');
    
    return sampleLibraryBrowser;
}

// Export
window.SampleLibraryBrowser = SampleLibraryBrowser;
window.initSampleLibraryBrowser = initSampleLibraryBrowser;
window.openSampleLibraryBrowserPanel = openSampleLibraryBrowserPanel;