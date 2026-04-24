// js/ProjectStatisticsPanel.js - Project Statistics Panel for SnugOS DAW
// Show detailed project stats (tracks, clips, notes, duration)

class ProjectStatisticsPanel {
    constructor() {
        this.stats = {
            tracks: { total: 0, audio: 0, midi: 0, synth: 0, sampler: 0, drum: 0 },
            clips: { total: 0, audio: 0, midi: 0, totalDuration: 0 },
            notes: { total: 0, unique: 0, velocityAvg: 0, density: 0 },
            effects: { total: 0, byType: {} },
            project: { duration: 0, bpm: 120, timeSignature: '4/4', sampleRate: 44100 }
        };
        this.updateInterval = null;
    }

    // Calculate statistics from state
    calculate(state) {
        if (!state) return this.stats;

        const stats = {
            tracks: { total: 0, audio: 0, midi: 0, synth: 0, sampler: 0, drum: 0 },
            clips: { total: 0, audio: 0, midi: 0, totalDuration: 0 },
            notes: { total: 0, unique: new Set(), velocitySum: 0, density: 0 },
            effects: { total: 0, byType: {} },
            project: { 
                duration: state.projectDuration || 0, 
                bpm: state.bpm || 120, 
                timeSignature: state.timeSignature || '4/4',
                sampleRate: 44100
            }
        };

        // Track statistics
        if (state.tracks) {
            state.tracks.forEach(track => {
                stats.tracks.total++;
                
                switch (track.type) {
                    case 'Audio':
                        stats.tracks.audio++;
                        break;
                    case 'Synth':
                        stats.tracks.synth++;
                        break;
                    case 'Sampler':
                        stats.tracks.sampler++;
                        break;
                    case 'DrumSampler':
                        stats.tracks.drum++;
                        break;
                    default:
                        stats.tracks.midi++;
                }

                // Effects per track
                if (track.effects) {
                    track.effects.forEach(effect => {
                        stats.effects.total++;
                        const type = effect.type || effect.name || 'Unknown';
                        stats.effects.byType[type] = (stats.effects.byType[type] || 0) + 1;
                    });
                }

                // Notes from sequences
                if (track.sequences) {
                    track.sequences.forEach(seq => {
                        if (seq.notes) {
                            seq.notes.forEach(note => {
                                stats.notes.total++;
                                stats.notes.unique.add(note.note || note.midi);
                                stats.notes.velocitySum += note.velocity || 100;
                            });
                        }
                    });
                }
            });
        }

        // Clip statistics
        if (state.timelineClips) {
            state.timelineClips.forEach(clip => {
                stats.clips.total++;
                if (clip.type === 'audio') {
                    stats.clips.audio++;
                } else {
                    stats.clips.midi++;
                }
                stats.clips.totalDuration += clip.duration || 0;
            });
        }

        // Convert unique notes to count
        stats.notes.unique = stats.notes.unique.size;
        stats.notes.velocityAvg = stats.notes.total > 0 
            ? Math.round(stats.notes.velocitySum / stats.notes.total) 
            : 0;

        // Calculate note density (notes per second)
        const projectDurationSeconds = stats.project.duration * 60 / stats.project.bpm;
        stats.notes.density = projectDurationSeconds > 0 
            ? (stats.notes.total / projectDurationSeconds).toFixed(2) 
            : 0;

        this.stats = stats;
        return stats;
    }

    // Get formatted statistics
    getFormattedStats() {
        const s = this.stats;
        return {
            overview: [
                { label: 'Total Tracks', value: s.tracks.total },
                { label: 'Total Clips', value: s.clips.total },
                { label: 'Total Notes', value: s.notes.total },
                { label: 'Project Duration', value: this.formatDuration(s.project.duration, s.project.bpm) }
            ],
            tracks: [
                { label: 'Audio Tracks', value: s.tracks.audio, color: '#ef4444' },
                { label: 'Synth Tracks', value: s.tracks.synth, color: '#3b82f6' },
                { label: 'Sampler Tracks', value: s.tracks.sampler, color: '#22c55e' },
                { label: 'Drum Tracks', value: s.tracks.drum, color: '#f59e0b' },
                { label: 'Other MIDI Tracks', value: s.tracks.midi, color: '#8b5cf6' }
            ],
            notes: [
                { label: 'Total Notes', value: s.notes.total },
                { label: 'Unique Pitches', value: s.notes.unique },
                { label: 'Avg Velocity', value: s.notes.velocityAvg },
                { label: 'Note Density', value: `${s.notes.density} notes/sec` }
            ],
            effects: [
                { label: 'Total Effects', value: s.effects.total },
                ...Object.entries(s.effects.byType).map(([type, count]) => ({
                    label: type,
                    value: count
                }))
            ],
            project: [
                { label: 'BPM', value: s.project.bpm },
                { label: 'Time Signature', value: s.project.timeSignature },
                { label: 'Sample Rate', value: `${s.project.sampleRate} Hz` },
                { label: 'Clip Duration', value: this.formatSeconds(s.clips.totalDuration) }
            ]
        };
    }

    // Format duration from bars
    formatDuration(bars, bpm) {
        const seconds = (bars * 4 * 60) / bpm; // Assuming 4/4 time
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // Format seconds
    formatSeconds(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Open statistics panel
    openPanel(state = null) {
        // Remove existing panel if any
        const existingPanel = document.getElementById('project-stats-panel');
        if (existingPanel) {
            existingPanel.remove();
            return;
        }

        // Calculate stats
        if (state || window.state) {
            this.calculate(state || window.state);
        }

        const panel = document.createElement('div');
        panel.id = 'project-stats-panel';
        panel.style.cssText = `
            position: fixed;
            right: 20px;
            top: 80px;
            width: 320px;
            max-height: 600px;
            background: #0f0f1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 16px;
            z-index: 9000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            overflow-y: auto;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
        
        const title = document.createElement('h3');
        title.textContent = 'Project Statistics';
        title.style.cssText = 'color: #fff; margin: 0; font-size: 16px;';
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: #888;
            font-size: 20px;
            cursor: pointer;
        `;
        closeBtn.addEventListener('click', () => panel.remove());
        header.appendChild(closeBtn);

        panel.appendChild(header);

        // Refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '↻ Refresh';
        refreshBtn.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            margin-bottom: 16px;
            font-size: 12px;
        `;
        refreshBtn.addEventListener('click', () => {
            if (window.state) {
                this.calculate(window.state);
                this.updatePanelContent(panel);
            }
        });
        panel.appendChild(refreshBtn);

        // Content container
        const content = document.createElement('div');
        content.id = 'stats-content';
        panel.appendChild(content);

        this.renderContent(content);

        document.body.appendChild(panel);
    }

    // Update panel content
    updatePanelContent(panel) {
        const content = panel.querySelector('#stats-content');
        if (content) {
            content.innerHTML = '';
            this.renderContent(content);
        }
    }

    // Render statistics content
    renderContent(container) {
        const formatted = this.getFormattedStats();

        // Overview section
        const overviewSection = this.createSection('Overview', formatted.overview);
        container.appendChild(overviewSection);

        // Tracks section with chart
        const tracksSection = this.createSection('Tracks by Type', formatted.tracks, true);
        container.appendChild(tracksSection);

        // Notes section
        const notesSection = this.createSection('Notes', formatted.notes);
        container.appendChild(notesSection);

        // Effects section
        const effectsSection = this.createSection('Effects', formatted.effects.slice(0, 6));
        container.appendChild(effectsSection);

        // Project section
        const projectSection = this.createSection('Project Info', formatted.project);
        container.appendChild(projectSection);

        // Memory usage
        if (performance.memory) {
            const memorySection = document.createElement('div');
            memorySection.style.cssText = 'background: #1a1a2e; padding: 12px; border-radius: 6px; margin-top: 12px;';
            
            const memoryLabel = document.createElement('div');
            memoryLabel.textContent = 'Memory Usage';
            memoryLabel.style.cssText = 'color: #888; font-size: 11px; margin-bottom: 8px;';
            memorySection.appendChild(memoryLabel);

            const usedMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            const totalMB = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0);
            
            const memoryBar = document.createElement('div');
            memoryBar.style.cssText = `
                background: #333;
                height: 6px;
                border-radius: 3px;
                overflow: hidden;
            `;
            const memoryFill = document.createElement('div');
            memoryFill.style.cssText = `
                background: #3b82f6;
                height: 100%;
                width: ${(usedMB / totalMB * 100).toFixed(1)}%;
            `;
            memoryBar.appendChild(memoryFill);
            memorySection.appendChild(memoryBar);

            const memoryText = document.createElement('div');
            memoryText.textContent = `${usedMB} MB / ${totalMB} MB`;
            memoryText.style.cssText = 'color: #fff; font-size: 12px; margin-top: 6px;';
            memorySection.appendChild(memoryText);

            container.appendChild(memorySection);
        }
    }

    // Create a statistics section
    createSection(title, items, showChart = false) {
        const section = document.createElement('div');
        section.style.cssText = 'background: #1a1a2e; padding: 12px; border-radius: 6px; margin-bottom: 12px;';

        const sectionTitle = document.createElement('div');
        sectionTitle.textContent = title;
        sectionTitle.style.cssText = 'color: #888; font-size: 11px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;';
        section.appendChild(sectionTitle);

        if (showChart && items.some(i => i.color)) {
            // Create bar chart for tracks
            const chartContainer = document.createElement('div');
            chartContainer.style.cssText = 'display: flex; gap: 4px; height: 60px; align-items: flex-end; margin-bottom: 12px;';

            const maxValue = Math.max(...items.map(i => i.value), 1);
            
            items.forEach(item => {
                if (item.value > 0) {
                    const bar = document.createElement('div');
                    const height = (item.value / maxValue) * 100;
                    bar.style.cssText = `
                        flex: 1;
                        background: ${item.color || '#3b82f6'};
                        height: ${height}%;
                        min-height: 4px;
                        border-radius: 2px 2px 0 0;
                        transition: height 0.3s;
                    `;
                    bar.title = `${item.label}: ${item.value}`;
                    chartContainer.appendChild(bar);
                }
            });

            section.appendChild(chartContainer);
        }

        // Items list
        items.forEach(item => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; justify-content: space-between; padding: 4px 0;';

            const label = document.createElement('span');
            label.textContent = item.label;
            label.style.cssText = 'color: #aaa; font-size: 13px;';
            row.appendChild(label);

            const value = document.createElement('span');
            value.textContent = item.value;
            value.style.cssText = `color: ${item.color || '#fff'}; font-size: 13px; font-weight: 500;`;
            row.appendChild(value);

            section.appendChild(row);
        });

        return section;
    }

    // Export statistics as JSON
    exportStats() {
        return JSON.stringify(this.stats, null, 2);
    }

    // Start auto-update
    startAutoUpdate(intervalMs = 5000) {
        this.stopAutoUpdate();
        this.updateInterval = setInterval(() => {
            if (window.state) {
                this.calculate(window.state);
                const panel = document.getElementById('project-stats-panel');
                if (panel) {
                    this.updatePanelContent(panel);
                }
            }
        }, intervalMs);
    }

    // Stop auto-update
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// Export functions for use by renderProjectStatisticsContent in ui.js
export function calculateProjectStatistics(tracks, playbackPosition) {
    const panel = new ProjectStatisticsPanel();
    const state = {
        tracks: tracks || [],
        projectDuration: 0,
        bpm: typeof getGlobalBPM === 'function' ? getGlobalBPM() : 120,
        timeSignature: '4/4'
    };
    return panel.calculate(state);
}

export function formatProjectStatistics(stats) {
    const panel = new ProjectStatisticsPanel();
    panel.stats = stats;
    return panel.getFormattedStats();
}

// Export class for external use
export { ProjectStatisticsPanel };

// Initialize global instance
function initProjectStatisticsPanel() {
    if (!window.projectStatisticsPanel) {
        window.projectStatisticsPanel = new ProjectStatisticsPanel();
    }
    return window.projectStatisticsPanel;
}

// Open panel function
function openProjectStatisticsPanel(state = null) {
    const panel = initProjectStatisticsPanel();
    panel.openPanel(state);
}

// Export
window.ProjectStatisticsPanel = ProjectStatisticsPanel;
window.projectStatisticsPanel = new ProjectStatisticsPanel();
window.openProjectStatisticsPanel = openProjectStatisticsPanel;
window.initProjectStatisticsPanel = initProjectStatisticsPanel;