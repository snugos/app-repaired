// js/TrackNotes.js - Track Notes Feature for SnugOS DAW
// Add text notes to tracks for documentation

class TrackNotes {
    constructor() {
        this.notes = new Map(); // trackId -> { text, color, timestamp, author }
        this.noteColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
        this.defaultColor = '#3b82f6';
        this.maxNoteLength = 2000;
    }

    // Initialize with existing track data
    initialize(tracks) {
        if (!tracks) return;
        tracks.forEach(track => {
            if (track.notes) {
                this.notes.set(track.id, {
                    text: track.notes.text || '',
                    color: track.notes.color || this.defaultColor,
                    timestamp: track.notes.timestamp || Date.now(),
                    author: track.notes.author || 'User'
                });
            }
        });
    }

    // Set note for a track
    setNote(trackId, text, color = null) {
        if (text.length > this.maxNoteLength) {
            console.warn(`Note truncated to ${this.maxNoteLength} characters`);
            text = text.slice(0, this.maxNoteLength);
        }

        const note = {
            text: text,
            color: color || this.notes.get(trackId)?.color || this.defaultColor,
            timestamp: Date.now(),
            author: 'User'
        };

        this.notes.set(trackId, note);
        this.updateTrackUI(trackId, note);
        return true;
    }

    // Get note for a track
    getNote(trackId) {
        return this.notes.get(trackId) || null;
    }

    // Remove note from a track
    removeNote(trackId) {
        this.notes.delete(trackId);
        this.clearTrackUI(trackId);
    }

    // Update track UI to show note indicator
    updateTrackUI(trackId, note) {
        // Find track header element
        const trackHeader = document.querySelector(`[data-track-id="${trackId}"] .track-header`);
        if (!trackHeader) return;

        // Remove existing indicator if any
        const existing = trackHeader.querySelector('.track-note-indicator');
        if (existing) existing.remove();

        if (note.text) {
            // Add note indicator
            const indicator = document.createElement('div');
            indicator.className = 'track-note-indicator';
            indicator.style.cssText = `
                width: 8px;
                height: 8px;
                background: ${note.color};
                border-radius: 50%;
                margin-left: 8px;
                cursor: pointer;
                flex-shrink: 0;
            `;
            indicator.title = note.text.slice(0, 100) + (note.text.length > 100 ? '...' : '');
            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openNoteEditor(trackId);
            });
            trackHeader.appendChild(indicator);
        }
    }

    // Clear note indicator from track UI
    clearTrackUI(trackId) {
        const trackHeader = document.querySelector(`[data-track-id="${trackId}"] .track-header`);
        if (trackHeader) {
            const indicator = trackHeader.querySelector('.track-note-indicator');
            if (indicator) indicator.remove();
        }
    }

    // Get all tracks with notes
    getTracksWithNotes() {
        return Array.from(this.notes.entries())
            .filter(([_, note]) => note.text)
            .map(([trackId, note]) => ({ trackId, ...note }));
    }

    // Search notes by text
    searchNotes(query) {
        const results = [];
        this.notes.forEach((note, trackId) => {
            if (note.text.toLowerCase().includes(query.toLowerCase())) {
                results.push({ trackId, ...note });
            }
        });
        return results;
    }

    // Export all notes
    exportNotes() {
        return Object.fromEntries(this.notes);
    }

    // Import notes
    importNotes(data) {
        Object.entries(data).forEach(([trackId, note]) => {
            this.notes.set(trackId, note);
        });
    }

    // Open note editor for a track
    openNoteEditor(trackId, x = null, y = null) {
        // Remove existing editor if any
        const existingEditor = document.getElementById('track-note-editor');
        if (existingEditor) existingEditor.remove();

        const currentNote = this.getNote(trackId) || { text: '', color: this.defaultColor };

        const editor = document.createElement('div');
        editor.id = 'track-note-editor';
        
        // Position
        if (x !== null && y !== null) {
            editor.style.cssText = `
                position: fixed;
                left: ${x}px;
                top: ${y}px;
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 16px;
                z-index: 10000;
                width: 300px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            `;
        } else {
            editor.style.cssText = `
                position: fixed;
                right: 20px;
                top: 80px;
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 16px;
                z-index: 10000;
                width: 300px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            `;
        }

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
        
        const title = document.createElement('div');
        title.textContent = `Track Note`;
        title.style.cssText = 'color: #fff; font-weight: 600; font-size: 14px;';
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
        closeBtn.addEventListener('click', () => editor.remove());
        header.appendChild(closeBtn);

        editor.appendChild(header);

        // Color selector
        const colorSection = document.createElement('div');
        colorSection.style.cssText = 'margin-bottom: 12px;';
        
        const colorLabel = document.createElement('div');
        colorLabel.textContent = 'Color';
        colorLabel.style.cssText = 'color: #888; font-size: 11px; margin-bottom: 6px;';
        colorSection.appendChild(colorLabel);

        const colorRow = document.createElement('div');
        colorRow.style.cssText = 'display: flex; gap: 6px;';

        this.noteColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.style.cssText = `
                width: 24px;
                height: 24px;
                background: ${color};
                border-radius: 4px;
                cursor: pointer;
                border: 2px solid transparent;
                transition: transform 0.1s;
            `;

            if (currentNote.color === color) {
                swatch.style.borderColor = '#fff';
            }

            swatch.addEventListener('click', () => {
                // Update selection
                colorRow.querySelectorAll('div').forEach(s => {
                    s.style.borderColor = 'transparent';
                });
                swatch.style.borderColor = '#fff';
                currentNote.color = color;
            });

            colorRow.appendChild(swatch);
        });

        colorSection.appendChild(colorRow);
        editor.appendChild(colorSection);

        // Text area
        const textArea = document.createElement('textarea');
        textArea.value = currentNote.text;
        textArea.placeholder = 'Add notes, reminders, or documentation for this track...';
        textArea.style.cssText = `
            width: 100%;
            height: 120px;
            background: #0a0a14;
            border: 1px solid #333;
            border-radius: 4px;
            color: #fff;
            padding: 10px;
            font-family: inherit;
            font-size: 13px;
            resize: vertical;
            box-sizing: border-box;
        `;
        textArea.addEventListener('input', () => {
            // Character count
            charCount.textContent = `${textArea.value.length}/${this.maxNoteLength}`;
        });
        editor.appendChild(textArea);

        // Character count
        const charCount = document.createElement('div');
        charCount.textContent = `${currentNote.text.length}/${this.maxNoteLength}`;
        charCount.style.cssText = 'color: #666; font-size: 11px; text-align: right; margin-top: 4px;';
        editor.appendChild(charCount);

        // Buttons
        const buttons = document.createElement('div');
        buttons.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            flex: 1;
            padding: 10px;
            background: #3b82f6;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            font-weight: 600;
        `;
        saveBtn.addEventListener('click', () => {
            if (textArea.value.trim()) {
                this.setNote(trackId, textArea.value, currentNote.color);
            } else {
                this.removeNote(trackId);
            }
            editor.remove();
        });
        buttons.appendChild(saveBtn);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText = `
            flex: 1;
            padding: 10px;
            background: #333;
            border: none;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
        `;
        clearBtn.addEventListener('click', () => {
            textArea.value = '';
            charCount.textContent = `0/${this.maxNoteLength}`;
        });
        buttons.appendChild(clearBtn);

        editor.appendChild(buttons);

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeEditor(e) {
                if (!editor.contains(e.target)) {
                    editor.remove();
                    document.removeEventListener('click', closeEditor);
                }
            });
        }, 10);

        document.body.appendChild(editor);
        textArea.focus();
    }

    // Open notes overview panel
    openNotesPanel() {
        // Remove existing panel if any
        const existingPanel = document.getElementById('track-notes-panel');
        if (existingPanel) {
            existingPanel.remove();
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'track-notes-panel';
        panel.style.cssText = `
            position: fixed;
            right: 20px;
            top: 80px;
            width: 320px;
            max-height: 500px;
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
        title.textContent = 'Track Notes';
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

        // Search
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search notes...';
        searchInput.style.cssText = `
            width: 100%;
            padding: 10px;
            background: #1a1a2e;
            border: 1px solid #333;
            border-radius: 4px;
            color: #fff;
            font-size: 13px;
            box-sizing: border-box;
            margin-bottom: 12px;
        `;
        panel.appendChild(searchInput);

        // Notes list
        const notesList = document.createElement('div');
        notesList.id = 'notes-list';
        notesList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        const renderNotes = (filter = '') => {
            notesList.innerHTML = '';
            const notes = filter ? this.searchNotes(filter) : this.getTracksWithNotes();
            
            if (notes.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = filter ? 'No matching notes' : 'No notes yet';
                empty.style.cssText = 'color: #666; text-align: center; padding: 20px;';
                notesList.appendChild(empty);
                return;
            }

            notes.forEach(({ trackId, text, color, timestamp }) => {
                const noteCard = document.createElement('div');
                noteCard.style.cssText = `
                    background: #1a1a2e;
                    border-radius: 6px;
                    padding: 12px;
                    border-left: 3px solid ${color};
                    cursor: pointer;
                `;
                noteCard.addEventListener('click', () => {
                    this.openNoteEditor(trackId);
                });

                const trackLabel = document.createElement('div');
                trackLabel.textContent = `Track: ${trackId}`;
                trackLabel.style.cssText = 'color: #888; font-size: 11px; margin-bottom: 4px;';
                noteCard.appendChild(trackLabel);

                const noteText = document.createElement('div');
                noteText.textContent = text.slice(0, 100) + (text.length > 100 ? '...' : '');
                noteText.style.cssText = 'color: #fff; font-size: 13px; line-height: 1.4;';
                noteCard.appendChild(noteText);

                const timeLabel = document.createElement('div');
                timeLabel.textContent = new Date(timestamp).toLocaleDateString();
                timeLabel.style.cssText = 'color: #666; font-size: 10px; margin-top: 6px;';
                noteCard.appendChild(timeLabel);

                notesList.appendChild(noteCard);
            });
        };

        searchInput.addEventListener('input', (e) => {
            renderNotes(e.target.value);
        });

        panel.appendChild(notesList);
        renderNotes();

        document.body.appendChild(panel);
    }
}

// Initialize global instance
function initTrackNotes() {
    if (!window.trackNotes) {
        window.trackNotes = new TrackNotes();
    }
    return window.trackNotes;
}

// Export
window.TrackNotes = TrackNotes;
window.trackNotes = new TrackNotes();
window.openTrackNotesPanel = () => window.trackNotes.openNotesPanel();
window.initTrackNotes = initTrackNotes;