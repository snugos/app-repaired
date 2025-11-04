// js/daw/ui/effectsRackUI.js

// Corrected imports for effectsRegistry and state modules
import { getEffectDefaultParams as getEffectDefaultParamsFromRegistry, AVAILABLE_EFFECTS, getEffectParamDefinitions } from '/app/js/daw/effectsRegistry.js';
import { getMasterEffects, addMasterEffect, removeMasterEffect, updateMasterEffectParam } from '/app/js/daw/state/masterState.js';
import { getTrackById } from '/app/js/daw/state/trackState.js';
import { getOpenWindows, getWindowById } from '/app/js/daw/state/windowState.js';
import { getThemeColors } from '/app/js/daw/utils.js';

let localAppServices = {}; //
let selectedEffectId = {}; // Keyed by ownerId

export function initializeEffectsRackUI(appServices) { //
    localAppServices = appServices; //
}

function refreshEffectsRack(windowInstance) { //
    if (!windowInstance?.element) return; //
    const ownerId = windowInstance.id.includes('master') ? 'master' : windowInstance.id.split('-')[1]; //
    const ownerType = ownerId === 'master' ? 'master' : 'track'; //
    
    let owner; //
    if (ownerType === 'track') { //
        owner = localAppServices.getTrackById(parseInt(ownerId)); //
    } else {
        owner = { effects: { activeEffects: getMasterEffects() } }; // Create a dummy owner object for master
    }

    if (!owner) return; //
    
    const listDiv = windowInstance.element.querySelector(`#effectsList-${ownerId}`); //
    const controlsContainer = windowInstance.element.querySelector(`#effectControlsContainer-${ownerId}`); //
    renderEffectsList(owner, ownerType, listDiv, controlsContainer); //
}

function buildModularEffectsRackDOM(owner, ownerType = 'track') { //
    const ownerId = (ownerType === 'track' && owner) ? owner.id : 'master'; //
    const ownerName = (ownerType === 'track' && owner) ? owner.name : 'Master Bus'; //
    const themeColors = getThemeColors(); // Get current theme colors

    return `<div id="effectsRackContent-${ownerId}" class="p-2 space-y-2 overflow-y-auto h-full" style="background-color: ${themeColors.bgWindowContent}; color: ${themeColors.textPrimary};">
        <h3 class="text-sm font-semibold">${ownerName}</h3>
        <div id="effectsList-${ownerId}" class="space-y-1 min-h-[50px] border rounded p-1" style="background-color: ${themeColors.bgWindow}; border-color: ${themeColors.borderPrimary};"></div>
        <button id="addEffectBtn-${ownerId}" class="w-full text-xs px-2 py-1 border rounded" style="background-color: ${themeColors.bgButton}; color: ${themeColors.textButton}; border-color: ${themeColors.borderButton};">+ Add Effect</button>
        <div id="effectControlsContainer-${ownerId}" class="mt-2 space-y-2 border-t pt-2" style="border-color: ${themeColors.borderPrimary};"></div>
    </div>`; //
}

export function openTrackEffectsRackWindow(trackId, savedState = null) { //
    const track = localAppServices.getTrackById(trackId); //
    if (!track) return null; //
    const windowId = `effectsRack-${trackId}`; //
    
    const existingWindow = getOpenWindows().get(windowId); //

    if (existingWindow) { //
        if (!savedState) { //
            existingWindow.restore(); //
            return existingWindow; //
        } else {
            existingWindow.close(true); //
        }
    }

    const content = buildModularEffectsRackDOM(track, 'track'); //
    
    const rackOptions = { //
        width: 350, height: 400, minWidth: 300, minHeight: 250, //
        onRefresh: refreshEffectsRack //
    };
    if (savedState) Object.assign(rackOptions, savedState); //

    const rackWindow = localAppServices.createWindow(windowId, `Effects: ${track.name}`, content, rackOptions); //
    attachEffectsRackListeners(track, 'track', rackWindow.element); //
}

export function openMasterEffectsRackWindow(savedState = null) { //
    const windowId = 'masterEffectsRack'; //
    if (getOpenWindows().has(windowId) && !savedState) { //
        getWindowById(windowId).restore(); //
        return; //
    }
    const masterOwner = { effects: { activeEffects: getMasterEffects() } }; // Dummy owner for master bus
    const content = buildModularEffectsRackDOM(masterOwner, 'master'); //
    
    const rackOptions = { //
        width: 350, height: 400, minWidth: 300, minHeight: 250, //
        onRefresh: refreshEffectsRack //
    };
    if (savedState) Object.assign(rackOptions, savedState); //

    const rackWindow = localAppServices.createWindow(windowId, 'Master Effects Rack', content, rackOptions); //
    attachEffectsRackListeners(masterOwner, 'master', rackWindow.element); //
}

function attachEffectsRackListeners(owner, ownerType, rackEl) { //
    if (!rackEl) return; //
    const ownerId = (ownerType === 'track') ? owner.id : 'master'; //
    const addEffectBtn = rackEl.querySelector(`#addEffectBtn-${ownerId}`); //
    addEffectBtn?.addEventListener('click', () => showAddEffectModal(owner, ownerType)); //
    const listDiv = rackEl.querySelector(`#effectsList-${ownerId}`); //
    const controlsContainer = rackEl.querySelector(`#effectControlsContainer-${ownerId}`); //
    renderEffectsList(owner, ownerType, listDiv, controlsContainer); //
}

export function renderEffectsList(owner, ownerType, listDiv, controlsContainer) { //
    if (!listDiv) return; //
    const ownerId = (ownerType === 'track') ? owner.id : 'master'; //
    const themeColors = getThemeColors(); // Get current theme colors
    
    const effects = owner.effects.activeEffects; //
    
    listDiv.innerHTML = ''; //

    if (effects.length === 0) { //
        listDiv.innerHTML = `<p class="text-xs text-center italic" style="color: ${themeColors.textPrimary};">No effects added.</p>`; //
    } else {
        effects.forEach(effect => { //
            const effectDiv = document.createElement('div'); //
            effectDiv.className = 'effect-item p-1 border rounded cursor-pointer flex justify-between items-center'; //
            effectDiv.style.backgroundColor = themeColors.bgWindowContent; // Apply background color
            effectDiv.style.borderColor = themeColors.borderPrimary; // Apply border color

            const effectName = AVAILABLE_EFFECTS[effect.type]?.displayName || effect.type; //
            effectDiv.innerHTML = `<span>${effects.indexOf(effect) + 1}. ${effectName}</span><button class="text-xs hover:font-bold" style="color: ${themeColors.textPrimary};" title="Remove Effect">X</button>`; //
            
            if (selectedEffectId[ownerId] === effect.id) { //
                effectDiv.style.backgroundColor = themeColors.accentActive; // Apply accent for selected
                effectDiv.style.color = themeColors.accentActiveText; // Apply text color for selected
                // Also update the button color for the 'X' button
                const deleteBtn = effectDiv.querySelector('button');
                if (deleteBtn) {
                    deleteBtn.style.color = themeColors.accentActiveText; 
                }
            } else {
                effectDiv.style.backgroundColor = themeColors.bgWindow; // Default background
                effectDiv.style.color = themeColors.textPrimary; // Default text color
            }

            effectDiv.addEventListener('click', (e) => { //
                if (e.target.tagName === 'BUTTON') { // If the 'X' button was clicked
                    localAppServices.showConfirmationDialog('Remove Effect', `Are you sure you want to remove "${effectName}"?`, () => {
                        if (ownerType === 'track') owner.effects.removeEffect(effect.id); //
                        else removeMasterEffect(effect.id); // Fix: Corrected call to removeMasterEffect
                        // Reset selected effect if the one being removed was selected
                        if (selectedEffectId[ownerId] === effect.id) {
                            selectedEffectId[ownerId] = null;
                            controlsContainer.innerHTML = ''; // Clear controls area
                        }
                        renderEffectsList(owner, ownerType, listDiv, controlsContainer); // Re-render list
                    });
                } else { // If the effect item itself was clicked
                    selectedEffectId[ownerId] = effect.id; //
                    renderEffectsList(owner, ownerType, listDiv, controlsContainer); // Re-render list to update selection highlighting
                    renderEffectControls(owner, ownerType, effect.id, controlsContainer); // Render controls for selected effect
                }
            });
            listDiv.appendChild(effectDiv); //
        });
    }

    // Ensure controls are rendered only if an effect is selected
    if (selectedEffectId[ownerId]) { //
        renderEffectControls(owner, ownerType, selectedEffectId[ownerId], controlsContainer); //
    } else {
        controlsContainer.innerHTML = ''; //
    }
}

export function renderEffectControls(owner, ownerType, effectId, controlsContainer) { //
    if (!controlsContainer) return; //
    
    const effects = owner.effects.activeEffects; //
    const effect = effects.find(e => e.id === effectId); //
    const themeColors = getThemeColors(); // Get current theme colors
    
    if (!effect) { //
        controlsContainer.innerHTML = ''; //
        return; //
    }

    const paramDefinitions = getEffectParamDefinitions(effect.type) || []; //
    const effectName = AVAILABLE_EFFECTS[effect.type]?.displayName || effect.type; //
    controlsContainer.innerHTML = `<h4 class="text-xs font-bold border-b mb-2 pb-1" style="border-color: ${themeColors.borderPrimary};">${effectName} Controls</h4>`; //
    
    const gridContainer = document.createElement('div'); //
    gridContainer.className = 'grid grid-cols-2 md:grid-cols-3 gap-2'; //

    if (paramDefinitions.length > 0) { //
        paramDefinitions.forEach(paramDef => { //
            const controlWrapper = document.createElement('div'); //
            // Safely get current parameter value, handling nested paths
            let currentValue = effect.params; //
            paramDef.key.split('.').forEach(k => { currentValue = currentValue?.[k]; }); //

            if (paramDef.type === 'knob') { //
                const knob = localAppServices.createKnob({ //
                    label: paramDef.label, //
                    min: paramDef.min, max: paramDef.max, step: paramDef.step, //
                    decimals: paramDef.decimals, //
                    displaySuffix: paramDef.displaySuffix || '', //
                    initialValue: currentValue, //
                    onValueChange: (val, oldVal, fromInteraction) => { // Include fromInteraction
                        if (ownerType === 'track') {
                            owner.effects.updateEffectParam(effect.id, paramDef.key, val); //
                        } else {
                            updateMasterEffectParam(effect.id, paramDef.key, val); //
                        }
                    }
                }, localAppServices.captureStateForUndo); // Pass captureStateForUndo callback
                controlWrapper.appendChild(knob.element); //
            } else if (paramDef.type === 'select') { // Handle select type parameters
                const selectGroup = document.createElement('div');
                selectGroup.className = 'control-group';
                selectGroup.innerHTML = `<label class="block mb-1">${paramDef.label}:</label>`;
                
                const selectEl = document.createElement('select');
                selectEl.className = "w-full p-1 border rounded bg-white dark:bg-black border-black dark:border-white text-black dark:text-white";
                
                paramDef.options.forEach(opt => {
                    const optionEl = document.createElement('option');
                    optionEl.value = opt;
                    optionEl.textContent = opt;
                    if (opt === currentValue) {
                        optionEl.selected = true;
                    }
                    selectEl.appendChild(optionEl);
                });

                selectEl.addEventListener('change', (e) => {
                    const newValue = e.target.value;
                    if (ownerType === 'track') {
                        owner.effects.updateEffectParam(effect.id, paramDef.key, newValue);
                    } else {
                        updateMasterEffectParam(effect.id, paramDef.key, newValue);
                    }
                    localAppServices.captureStateForUndo?.(`Change ${paramDef.label} for ${effectName}`);
                });
                selectGroup.appendChild(selectEl);
                controlWrapper.appendChild(selectGroup);
            }
            gridContainer.appendChild(controlWrapper); //
        });
    }
    controlsContainer.appendChild(gridContainer); //
}

function showAddEffectModal(owner, ownerType) { //
    const ownerName = (ownerType === 'track' && owner) ? owner.name : 'Master'; //
    let content = '<ul class="list-none p-0 m-0">'; //
    const availableEffects = AVAILABLE_EFFECTS || {}; // Ensure AVAILABLE_EFFECTS is available
    for (const key in availableEffects) { //
        content += `<li class="p-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer" data-effect="${key}">${availableEffects[key].displayName}</li>`; //
    }
    content += '</ul>'; //
    
    // Add a "Cancel" button to the buttonsConfig
    const buttons = [{ //
        label: 'Cancel', //
        action: () => { /* no specific action needed, modal will close by default */ } //
    }];

    const modal = localAppServices.showCustomModal(`Add Effect to ${ownerName}`, content, buttons); //

    // Attach event listeners to the dynamically created list items in the modal
    modal.contentDiv.querySelectorAll('li').forEach(li => { //
        li.addEventListener('click', () => { //
            const effectType = li.dataset.effect; // Get effect type from data attribute
            if (ownerType === 'track') { // If adding to a track
                owner.effects.addEffect(effectType); //
            } else { // If adding to master
                addMasterEffect(effectType); // Fix: Call via localAppServices
            }
            modal.overlay.remove(); // Close the modal after selection
        });
    });
}