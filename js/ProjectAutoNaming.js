/**
 * Project Auto-Naming Module
 * Automatically suggests and applies smart names for clips and tracks based on content type
 */

const ProjectAutoNaming = {
    clipCounter: {},
    trackCounter: {},
    
    init() {
        this.clipCounter = {};
        this.trackCounter = {};
        console.log("ProjectAutoNaming initialized");
    },
    
    // Generate smart name for audio clips
    generateAudioClipName(trackId) {
        if (!this.clipCounter[trackId]) this.clipCounter[trackId] = 0;
        this.clipCounter[trackId]++;
        const base = "Audio";
        return `${base}_${String(this.clipCounter[trackId]).padStart(2, '0')}`;
    },
    
    // Generate smart name for MIDI clips
    generateMIDIClipName(trackId) {
        if (!this.clipCounter[trackId]) this.clipCounter[trackId] = 0;
        this.clipCounter[trackId]++;
        const base = "MIDI";
        return `${base}_${String(this.clipCounter[trackId]).padStart(2, '0')}`;
    },
    
    // Generate smart name for instrument tracks
    generateTrackName(type = 'instrument') {
        if (!this.trackCounter[type]) this.trackCounter[type] = 0;
        this.trackCounter[type]++;
        const typeNames = {
            instrument: 'Instrument',
            audio: 'Audio',
            midi: 'MIDI',
            aux: 'Aux',
            master: 'Master'
        };
        const base = typeNames[type] || 'Track';
        return `${base}_${String(this.trackCounter[type]).padStart(2, '0')}`;
    },
    
    // Suggest name for recording based on timestamp
    generateRecordingName() {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        return `Recording_${month}${day}_${hour}${min}`;
    },
    
    // Suggest project name based on date and session
    generateProjectName(sessionName = '') {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        if (sessionName) return `${sessionName}_${year}${month}${day}`;
        return `Project_${year}${month}${day}`;
    },
    
    // Apply auto-naming to newly created clip
    onClipCreated(clip, trackId, clipType) {
        if (!clip.name || clip.name === 'Untitled') {
            if (clipType === 'midi') {
                clip.name = this.generateMIDIClipName(trackId);
            } else {
                clip.name = this.generateAudioClipName(trackId);
            }
        }
        return clip;
    },
    
    // Apply auto-naming to newly created track
    onTrackCreated(track, trackType) {
        if (!track.name || track.name === 'Untitled' || track.name === 'New Track') {
            track.name = this.generateTrackName(trackType || track.type || 'instrument');
        }
        return track;
    },
    
    // Reset counters for new project
    resetCounters() {
        this.clipCounter = {};
        this.trackCounter = {};
    }
};

// Auto-init
ProjectAutoNaming.init();

window.ProjectAutoNaming = ProjectAutoNaming;