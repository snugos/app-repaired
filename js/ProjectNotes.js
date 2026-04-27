/**
 * ProjectNotes - Quick notes panel for the current project
 * Small enhancement for snaw (SnugOS DAW)
 */
window.ProjectNotes = (function() {
    let notes = '';
    let panel = null;
    
    function getPanel() {
        if (panel) return panel;
        panel = document.createElement('div');
        panel.id = 'project-notes-panel';
        panel.style.cssText = `
            position: fixed; bottom: 60px; right: 20px; width: 300px; max-height: 250px;
            background: rgba(20,20,30,0.95); border: 1px solid #444; border-radius: 8px;
            padding: 12px; z-index: 1001; display: none; flex-direction: column; gap: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
        header.innerHTML = '<span style="color:#fff;font-weight:bold;">Project Notes</span><button id="pnotes-close" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px;">×</button>';
        
        const textarea = document.createElement('textarea');
        textarea.id = 'pnotes-text';
        textarea.placeholder = 'Write notes about your project...';
        textarea.style.cssText = `
            width: 100%; height: 120px; resize: none; background: #1a1a2e; color: #ccc;
            border: 1px solid #333; border-radius: 4px; padding: 8px; font-size: 13px;
            font-family: inherit; box-sizing: border-box;
        `;
        textarea.value = notes;
        textarea.addEventListener('input', (e) => { notes = e.target.value; saveNotes(); });
        
        panel.append(header, textarea);
        document.body.appendChild(panel);
        
        document.getElementById('pnotes-close').onclick = togglePanel;
        return panel;
    }
    
    function togglePanel() {
        const p = getPanel();
        p.style.display = p.style.display === 'none' ? 'flex' : 'none';
    }
    
    function saveNotes() {
        localStorage.setItem('snaw_project_notes', notes);
    }
    
    function loadNotes() {
        notes = localStorage.getItem('snaw_project_notes') || '';
        const ta = document.getElementById('pnotes-text');
        if (ta) ta.value = notes;
    }
    
    function openPanel() {
        getPanel();
        panel.style.display = 'flex';
    }
    
    function closePanel() {
        if (panel) panel.style.display = 'none';
    }
    
    function getNotes() { return notes; }
    
    return { togglePanel, openPanel, closePanel, getNotes };
})();
