/**
 * Project Template Browser - Save and load project templates with all tracks/settings
 * Provides UI for managing project templates with preview and organization
 */

import { createContextMenu } from './utils.js';

let projectTemplateBrowserPanel = null;
let selectedTemplateName = null;

export function openProjectTemplateBrowserPanel() {
    if (projectTemplateBrowserPanel) {
        projectTemplateBrowserPanel.remove();
        projectTemplateBrowserPanel = null;
    }
    
    const templates = appServices.getProjectTemplateNames?.() || [];
    
    const panel = document.createElement('div');
    panel.id = 'projectTemplateBrowserPanel';
    panel.className = 'panel';
    panel.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 600px;
        max-height: 80vh;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 16px 20px;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #16213e;
        border-radius: 8px 8px 0 0;
    `;
    header.innerHTML = `
        <span style="color: #eee; font-size: 16px; font-weight: 600;">Project Templates</span>
        <div>
            <button id="ptb-save" style="margin-right: 8px; padding: 6px 12px; background: #4a90d9; border: none; border-radius: 4px; color: white; cursor: pointer;">Save Current</button>
            <button id="ptb-close" style="padding: 6px 12px; background: #333; border: none; border-radius: 4px; color: white; cursor: pointer;">×</button>
        </div>
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
    `;
    
    const templateList = document.createElement('div');
    templateList.id = 'ptb-template-list';
    templateList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    
    if (templates.length === 0) {
        templateList.innerHTML = `
            <div style="color: #888; text-align: center; padding: 40px 20px; font-style: italic;">
                No templates saved yet.<br>Click "Save Current" to create one.
            </div>
        `;
    } else {
        templates.forEach(name => {
            const template = appServices.getProjectTemplate?.(name);
            const item = createTemplateItem(name, template);
            templateList.appendChild(item);
        });
    }
    
    const saveDialog = document.createElement('div');
    saveDialog.id = 'ptb-save-dialog';
    saveDialog.style.cssText = `
        display: none;
        padding: 16px 20px;
        border-top: 1px solid #333;
        background: #16213e;
    `;
    saveDialog.innerHTML = `
        <div style="display: flex; gap: 12px; align-items: center;">
            <input id="ptb-template-name" type="text" placeholder="Template name..." 
                style="flex: 1; padding: 8px 12px; background: #0f0f1a; border: 1px solid #333; border-radius: 4px; color: #eee;">
            <label style="color: #aaa; display: flex; align-items: center; gap: 4px;">
                <input id="ptb-include-tracks" type="checkbox" checked> Tracks
            </label>
            <label style="color: #aaa; display: flex; align-items: center; gap: 4px;">
                <input id="ptb-include-effects" type="checkbox" checked> Effects
            </label>
            <button id="ptb-save-confirm" style="padding: 8px 16px; background: #4a90d9; border: none; border-radius: 4px; color: white; cursor: pointer;">Save</button>
            <button id="ptb-save-cancel" style="padding: 8px 16px; background: #333; border: none; border-radius: 4px; color: white; cursor: pointer;">Cancel</button>
        </div>
    `;
    
    content.appendChild(templateList);
    content.appendChild(saveDialog);
    panel.appendChild(header);
    panel.appendChild(content);
    
    document.body.appendChild(panel);
    projectTemplateBrowserPanel = panel;
    
    // Event listeners
    document.getElementById('ptb-close').onclick = closeProjectTemplateBrowserPanel;
    document.getElementById('ptb-save').onclick = () => {
        saveDialog.style.display = saveDialog.style.display === 'none' ? 'block' : 'none';
        document.getElementById('ptb-template-name').focus();
    };
    document.getElementById('ptb-save-cancel').onclick = () => {
        saveDialog.style.display = 'none';
    };
    document.getElementById('ptb-save-confirm').onclick = () => {
        const name = document.getElementById('ptb-template-name').value.trim();
        const includeTracks = document.getElementById('ptb-include-tracks').checked;
        const includeEffects = document.getElementById('ptb-include-effects').checked;
        
        if (name) {
            appServices.saveProjectTemplate?.(name, includeTracks, includeEffects);
            saveDialog.style.display = 'none';
            document.getElementById('ptb-template-name').value = '';
            openProjectTemplateBrowserPanel(); // Refresh
        }
    };
    
    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!panel.contains(e.target)) {
                closeProjectTemplateBrowserPanel();
                document.removeEventListener('click', handler);
            }
        });
    }, 100);
}

function createTemplateItem(name, template) {
    const item = document.createElement('div');
    item.className = 'ptb-template-item';
    item.style.cssText = `
        padding: 12px 16px;
        background: #0f0f1a;
        border: 1px solid #333;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
    `;
    
    const trackCount = template?.tracks?.length || 0;
    const effectsCount = template?.masterEffects?.length || 0;
    const createdAt = template?.createdAt ? new Date(template.createdAt).toLocaleString() : 'Unknown';
    
    item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #eee; font-weight: 500;">${name}</span>
            <div>
                <button class="ptb-load-btn" style="padding: 4px 10px; background: #28a745; border: none; border-radius: 4px; color: white; cursor: pointer; margin-right: 4px;">Load</button>
                <button class="ptb-delete-btn" style="padding: 4px 10px; background: #dc3545; border: none; border-radius: 4px; color: white; cursor: pointer;">Delete</button>
            </div>
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #888;">
            ${trackCount} track${trackCount !== 1 ? 's' : ''} · ${effectsCount} effect${effectsCount !== 1 ? 's' : ''} · ${createdAt}
        </div>
    `;
    
    item.querySelector('.ptb-load-btn').onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Load template "${name}"? Current project will be ${appServices.loadProjectTemplate?.(name, true) ? 'replaced' : 'kept'}.')) {
            closeProjectTemplateBrowserPanel();
        }
    };
    
    item.querySelector('.ptb-delete-btn').onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Delete template "${name}"?`)) {
            appServices.deleteProjectTemplate?.(name);
            openProjectTemplateBrowserPanel(); // Refresh
        }
    };
    
    item.onmouseenter = () => {
        item.style.background = '#1a1a2e';
        item.style.borderColor = '#4a90d9';
    };
    item.onmouseleave = () => {
        item.style.background = '#0f0f1a';
        item.style.borderColor = '#333';
    };
    
    return item;
}

export function closeProjectTemplateBrowserPanel() {
    if (projectTemplateBrowserPanel) {
        projectTemplateBrowserPanel.remove();
        projectTemplateBrowserPanel = null;
    }
}