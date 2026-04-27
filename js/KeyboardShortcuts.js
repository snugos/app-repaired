/**
 * KeyboardShortcuts - Global keyboard shortcut manager for SnugOS DAW
 * Allows customization and display of all keyboard shortcuts
 */
const KeyboardShortcuts = (function() {
    const shortcuts = new Map();
    const enabled = { value: true };

    function register(key, modifiers, action, description, category = 'General') {
        const id = `${modifiers.join('+')}+${key}`.toLowerCase();
        shortcuts.set(id, { key, modifiers, action, description, category });
    }

    function handleKeyDown(e) {
        if (!enabled.value) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        
        const modifiers = [];
        if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
        if (e.shiftKey) modifiers.push('shift');
        if (e.altKey) modifiers.push('alt');
        
        const key = e.key.toLowerCase();
        const id = `${modifiers.join('+')}+${key}`;
        const shortcut = shortcuts.get(id);
        
        if (shortcut) {
            e.preventDefault();
            try { shortcut.action(e); } catch (err) { console.warn('Shortcut error:', err); }
        }
    }

    document.addEventListener('keydown', handleKeyDown);

    function getShortcutsByCategory() {
        const cats = {};
        shortcuts.forEach(s => { if (!cats[s.category]) cats[s.category] = []; cats[s.category].push(s); });
        return cats;
    }

    function exportShortcuts() {
        const cats = getShortcutsByCategory();
        let md = '# SnugOS Keyboard Shortcuts\n\n';
        Object.keys(cats).sort().forEach(cat => {
            md += `## ${cat}\n`;
            cats[cat].forEach(s => {
                md += `- **${s.modifiers.join('+').toUpperCase()}+${s.key.toUpperCase()}**: ${s.description}\n`;
            });
            md += '\n';
        });
        return md;
    }

    function enable() { enabled.value = true; }
    function disable() { enabled.value = false; }
    function isEnabled() { return enabled.value; }
    function clear() { shortcuts.clear(); }

    // Built-in shortcuts
    register('s', ['ctrl'], () => { if (typeof saveProject === 'function') saveProject(); }, 'Save Project', 'File');
    register('z', ['ctrl'], () => { if (typeof undo === 'function') undo(); }, 'Undo', 'Edit');
    register('z', ['ctrl', 'shift'], () => { if (typeof redo === 'function') redo(); }, 'Redo', 'Edit');
    register(' ', [], () => { if (typeof togglePlayback === 'function') togglePlayback(); }, 'Play/Stop', 'Transport');
    register('enter', [], () => { if (typeof stopPlayback === 'function') stopPlayback(); }, 'Stop', 'Transport');
    register('m', ['ctrl'], () => { if (typeof toggleMetronome === 'function') toggleMetronome(); }, 'Toggle Metronome', 'Transport');
    register('l', ['ctrl'], () => { if (typeof toggleLoop === 'function') toggleLoop(); }, 'Toggle Loop', 'Transport');
    register('n', ['ctrl'], () => { if (typeof addNewTrack === 'function') addNewTrack(); }, 'New Track', 'Track');
    register('delete', [], () => { if (typeof deleteSelected === 'function') deleteSelected(); }, 'Delete Selected', 'Edit');
    register('a', ['ctrl'], () => { if (typeof selectAll === 'function') selectAll(); }, 'Select All', 'Edit');
    register('c', ['ctrl'], () => { if (typeof copySelection === 'function') copySelection(); }, 'Copy', 'Edit');
    register('v', ['ctrl'], () => { if (typeof pasteSelection === 'function') pasteSelection(); }, 'Paste', 'Edit');
    register('x', ['ctrl'], () => { if (typeof cutSelection === 'function') cutSelection(); }, 'Cut', 'Edit');

    return { register, enable, disable, isEnabled, clear, getShortcutsByCategory, exportShortcuts };
})();

window.KeyboardShortcuts = KeyboardShortcuts;
