// js/ClipColorCoding.js - Clip Color Coding Feature for SnugOS DAW
// Assign colors to clips for visual organization

class ClipColorCoding {
    constructor() {
        this.clipColors = new Map(); // clipId -> color
        this.colorPalette = [
            '#ef4444', // Red
            '#f97316', // Orange
            '#f59e0b', // Amber
            '#eab308', // Yellow
            '#84cc16', // Lime
            '#22c55e', // Green
            '#10b981', // Emerald
            '#14b8a6', // Teal
            '#06b6d4', // Cyan
            '#0ea5e9', // Sky
            '#3b82f6', // Blue
            '#6366f1', // Indigo
            '#8b5cf6', // Violet
            '#a855f7', // Purple
            '#d946ef', // Fuchsia
            '#ec4899', // Pink
            '#f43f5e', // Rose
            '#78716c', // Stone
            '#71717a', // Zinc
            '#6b7280', // Gray
        ];
        this.defaultColor = '#3b82f6';
        this.colorGroups = new Map(); // groupName -> Set of clipIds
    }

    // Initialize with existing clip data
    initialize(clips) {
        if (!clips) return;
        clips.forEach(clip => {
            if (clip.color) {
                this.clipColors.set(clip.id, clip.color);
            }
        });
    }

    // Set color for a clip
    setClipColor(clipId, color) {
        if (!this.colorPalette.includes(color)) {
            console.warn(`Color ${color} not in palette, using anyway`);
        }
        this.clipColors.set(clipId, color);
        this.updateClipUI(clipId, color);
        return true;
    }

    // Get color for a clip
    getClipColor(clipId) {
        return this.clipColors.get(clipId) || this.defaultColor;
    }

    // Remove color assignment for a clip
    removeClipColor(clipId) {
        this.clipColors.delete(clipId);
        // Remove from all groups
        this.colorGroups.forEach(clips => clips.delete(clipId));
    }

    // Update UI for a clip
    updateClipUI(clipId, color) {
        const clipElement = document.querySelector(`[data-clip-id="${clipId}"]`);
        if (clipElement) {
            clipElement.style.borderColor = color;
            clipElement.style.borderLeftWidth = '4px';
            clipElement.style.borderLeftStyle = 'solid';
            
            // Add subtle background tint
            const bgColor = this.hexToRgba(color, 0.15);
            clipElement.style.backgroundColor = bgColor;
        }
    }

    // Convert hex to rgba
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Get all clips with a specific color
    getClipsByColor(color) {
        const clips = [];
        this.clipColors.forEach((c, clipId) => {
            if (c === color) {
                clips.push(clipId);
            }
        });
        return clips;
    }

    // Create a color group
    createColorGroup(groupName, color) {
        if (!this.colorGroups.has(groupName)) {
            this.colorGroups.set(groupName, new Set());
        }
        return true;
    }

    // Add clip to a color group
    addToColorGroup(groupName, clipId) {
        if (!this.colorGroups.has(groupName)) {
            this.createColorGroup(groupName);
        }
        this.colorGroups.get(groupName).add(clipId);
    }

    // Batch color clips
    batchColorClips(clipIds, color) {
        clipIds.forEach(clipId => {
            this.setClipColor(clipId, color);
        });
        return clipIds.length;
    }

    // Get color palette
    getPalette() {
        return [...this.colorPalette];
    }

    // Get random color from palette
    getRandomColor() {
        const index = Math.floor(Math.random() * this.colorPalette.length);
        return this.colorPalette[index];
    }

    // Auto-assign colors based on track or type
    autoAssignColors(clips, mode = 'track') {
        const trackColors = new Map();
        let colorIndex = 0;

        clips.forEach(clip => {
            let key;
            switch (mode) {
                case 'track':
                    key = clip.trackId || 'default';
                    break;
                case 'type':
                    key = clip.type || 'audio';
                    break;
                case 'none':
                default:
                    this.setClipColor(clip.id, this.getRandomColor());
                    return;
            }

            if (!trackColors.has(key)) {
                trackColors.set(key, this.colorPalette[colorIndex % this.colorPalette.length]);
                colorIndex++;
            }
            this.setClipColor(clip.id, trackColors.get(key));
        });
    }

    // Clear all color assignments
    clearAll() {
        this.clipColors.clear();
        this.colorGroups.clear();
    }

    // Export color assignments
    exportColors() {
        return {
            colors: Object.fromEntries(this.clipColors),
            groups: Object.fromEntries(
                Array.from(this.colorGroups.entries()).map(([name, clips]) => [
                    name,
                    Array.from(clips)
                ])
            )
        };
    }

    // Import color assignments
    importColors(data) {
        if (data.colors) {
            Object.entries(data.colors).forEach(([clipId, color]) => {
                this.clipColors.set(clipId, color);
            });
        }
        if (data.groups) {
            Object.entries(data.groups).forEach(([name, clipIds]) => {
                this.colorGroups.set(name, new Set(clipIds));
            });
        }
    }

    // Open color picker panel for a clip
    openColorPicker(clipId, x, y) {
        // Remove existing picker if any
        const existingPicker = document.getElementById('clip-color-picker');
        if (existingPicker) {
            existingPicker.remove();
        }

        const picker = document.createElement('div');
        picker.id = 'clip-color-picker';
        picker.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 12px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

        // Title
        const title = document.createElement('div');
        title.textContent = 'Clip Color';
        title.style.cssText = 'color: #fff; font-weight: 600; margin-bottom: 12px; font-size: 14px;';
        picker.appendChild(title);

        // Color grid
        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;';

        this.colorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `
                width: 28px;
                height: 28px;
                background: ${color};
                border-radius: 4px;
                cursor: pointer;
                border: 2px solid transparent;
                transition: transform 0.1s, border-color 0.1s;
            `;

            // Highlight current color
            if (this.getClipColor(clipId) === color) {
                swatch.style.borderColor = '#fff';
            }

            swatch.addEventListener('mouseenter', () => {
                swatch.style.transform = 'scale(1.1)';
            });
            swatch.addEventListener('mouseleave', () => {
                swatch.style.transform = 'scale(1)';
            });
            swatch.addEventListener('click', () => {
                this.setClipColor(clipId, color);
                picker.remove();
            });

            grid.appendChild(swatch);
        });

        picker.appendChild(grid);

        // Actions row
        const actions = document.createElement('div');
        actions.style.cssText = 'margin-top: 12px; display: flex; gap: 8px;';

        const randomBtn = document.createElement('button');
        randomBtn.textContent = 'Random';
        randomBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: #333;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            font-size: 12px;
        `;
        randomBtn.addEventListener('click', () => {
            this.setClipColor(clipId, this.getRandomColor());
            picker.remove();
        });
        actions.appendChild(randomBtn);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: #333;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            font-size: 12px;
        `;
        clearBtn.addEventListener('click', () => {
            this.removeClipColor(clipId);
            picker.remove();
        });
        actions.appendChild(clearBtn);

        picker.appendChild(actions);

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closePicker(e) {
                if (!picker.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', closePicker);
                }
            });
        }, 10);

        document.body.appendChild(picker);
    }
}

// Open clip color coding panel
function openClipColorCodingPanel() {
    // Remove existing panel if any
    const existingPanel = document.getElementById('clip-color-coding-panel');
    if (existingPanel) {
        existingPanel.remove();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'clip-color-coding-panel';
    panel.style.cssText = `
        position: fixed;
        right: 20px;
        top: 80px;
        width: 280px;
        background: #0f0f1a;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 16px;
        z-index: 9000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
    
    const title = document.createElement('h3');
    title.textContent = 'Clip Color Coding';
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
        padding: 0;
        line-height: 1;
    `;
    closeBtn.addEventListener('click', () => panel.remove());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Palette section
    const paletteSection = document.createElement('div');
    paletteSection.style.cssText = 'margin-bottom: 16px;';
    
    const paletteLabel = document.createElement('div');
    paletteLabel.textContent = 'Color Palette';
    paletteLabel.style.cssText = 'color: #888; font-size: 12px; margin-bottom: 8px;';
    paletteSection.appendChild(paletteLabel);

    const paletteGrid = document.createElement('div');
    paletteGrid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';
    paletteGrid.id = 'palette-grid';

    const colorCoding = window.clipColorCoding;
    if (colorCoding) {
        colorCoding.getPalette().forEach(color => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `
                width: 20px;
                height: 20px;
                background: ${color};
                border-radius: 3px;
                cursor: pointer;
                transition: transform 0.1s;
            `;
            swatch.title = color;
            swatch.addEventListener('click', () => {
                // Copy color to clipboard
                navigator.clipboard.writeText(color);
                swatch.style.transform = 'scale(1.2)';
                setTimeout(() => swatch.style.transform = 'scale(1)', 200);
            });
            paletteGrid.appendChild(swatch);
        });
    }
    paletteSection.appendChild(paletteGrid);
    panel.appendChild(paletteSection);

    // Auto-assign section
    const autoSection = document.createElement('div');
    autoSection.style.cssText = 'margin-bottom: 16px;';
    
    const autoLabel = document.createElement('div');
    autoLabel.textContent = 'Auto-Assign Colors';
    autoLabel.style.cssText = 'color: #888; font-size: 12px; margin-bottom: 8px;';
    autoSection.appendChild(autoLabel);

    const autoBtns = document.createElement('div');
    autoBtns.style.cssText = 'display: flex; gap: 8px;';

    ['By Track', 'By Type', 'Random'].forEach(mode => {
        const btn = document.createElement('button');
        btn.textContent = mode;
        btn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: #222;
            border: 1px solid #444;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            font-size: 11px;
        `;
        btn.addEventListener('click', () => {
            if (window.state && window.state.timelineClips) {
                const modeMap = {
                    'By Track': 'track',
                    'By Type': 'type',
                    'Random': 'none'
                };
                colorCoding.autoAssignColors(window.state.timelineClips, modeMap[mode]);
            }
        });
        autoBtns.appendChild(btn);
    });
    autoSection.appendChild(autoBtns);
    panel.appendChild(autoSection);

    // Statistics
    const statsSection = document.createElement('div');
    statsSection.id = 'color-stats';
    statsSection.style.cssText = 'background: #1a1a2e; padding: 12px; border-radius: 4px;';
    
    const statsLabel = document.createElement('div');
    statsLabel.textContent = 'Statistics';
    statsLabel.style.cssText = 'color: #888; font-size: 12px; margin-bottom: 8px;';
    statsSection.appendChild(statsLabel);

    if (colorCoding) {
        const count = document.createElement('div');
        count.textContent = `Colored clips: ${colorCoding.clipColors.size}`;
        count.style.cssText = 'color: #fff; font-size: 12px;';
        statsSection.appendChild(count);
    }

    panel.appendChild(statsSection);

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 8px; margin-top: 16px;';

    const clearAllBtn = document.createElement('button');
    clearAllBtn.textContent = 'Clear All';
    clearAllBtn.style.cssText = `
        flex: 1;
        padding: 10px;
        background: #ef4444;
        border: none;
        border-radius: 4px;
        color: #fff;
        cursor: pointer;
        font-weight: 600;
    `;
    clearAllBtn.addEventListener('click', () => {
        if (colorCoding && confirm('Clear all clip colors?')) {
            colorCoding.clearAll();
            // Refresh UI
            document.querySelectorAll('[data-clip-id]').forEach(el => {
                el.style.borderColor = '';
                el.style.borderLeftWidth = '';
                el.style.borderLeftStyle = '';
                el.style.backgroundColor = '';
            });
        }
    });
    actions.appendChild(clearAllBtn);

    panel.appendChild(actions);

    document.body.appendChild(panel);
}

// Initialize global instance
function initClipColorCoding() {
    if (!window.clipColorCoding) {
        window.clipColorCoding = new ClipColorCoding();
    }
    return window.clipColorCoding;
}

// Export
window.ClipColorCoding = ClipColorCoding;
window.clipColorCoding = new ClipColorCoding();
window.openClipColorCodingPanel = openClipColorCodingPanel;
window.initClipColorCoding = initClipColorCoding;