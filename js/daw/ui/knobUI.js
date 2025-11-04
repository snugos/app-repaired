// js/daw/ui/knobUI.js - Knob UI Component

/**
 * Creates a customizable UI knob component.
 * @param {object} options - Configuration options for the knob:
 * - {string} label: The label displayed above the knob.
 * - {number} min: The minimum value of the knob.
 * - {number} max: The maximum value of the knob.
 * - {number} step: The step increment/decrement for the knob value.
 * - {number} [initialValue]: The initial value of the knob. Defaults to `min` if not provided.
 * - {number} [decimals]: Number of decimal places to display for the value.
 * - {string} [displayPrefix]: Text to prefix the displayed value.
 * - {string} [displaySuffix]: Text to suffix the displayed value.
 * - {function(newValue: number, oldValue: number, fromInteraction: boolean)} [onValueChange]: Callback function invoked when the value changes. `fromInteraction` is true if triggered by user drag/touch.
 * - {boolean} [disabled=false]: If true, the knob is not interactive and appears dimmed.
 * @param {function(actionDescription: string)} [captureStateForUndoCallback=()=>{}] - Callback to capture state for undo/redo, typically called on interaction end.
 * @returns {object} An object containing the knob's DOM element, methods to set/get its value, and a method to refresh its visuals.
 */
export function createKnob(options, captureStateForUndoCallback = () => {}) {
    const container = document.createElement('div');
    container.className = 'knob-container';

    const labelEl = document.createElement('div');
    labelEl.className = 'knob-label';
    labelEl.textContent = options.label || '';
    labelEl.title = options.label || '';
    container.appendChild(labelEl);

    const knobEl = document.createElement('div');
    knobEl.className = 'knob';
    const handleEl = document.createElement('div');
    handleEl.className = 'knob-handle';
    knobEl.appendChild(handleEl);
    container.appendChild(knobEl);

    const valueEl = document.createElement('div');
    valueEl.className = 'knob-value';
    container.appendChild(valueEl);

    let currentValue = options.initialValue === undefined ? (options.min !== undefined ? options.min : 0) : options.initialValue;
    const min = options.min === undefined ? 0 : options.min;
    const max = options.max === undefined ? 100 : options.max;
    const step = options.step === undefined ? 1 : options.step;
    const range = max - min;
    const maxDegrees = 270; // Total rotation range for the handle
    let initialValueBeforeInteraction = currentValue; // Stores value when drag/touch starts for undo


    /**
     * Sets the knob's value and updates its visual representation.
     * @param {number} newValue - The new value to set.
     * @param {boolean} [fromInteraction=false] - True if the value change is due to user interaction (drag/touch).
     */
    function setValue(newValue, fromInteraction = false) {
        // Clamp and step value
        newValue = Math.max(min, Math.min(max, newValue));
        newValue = Math.round(newValue / step) * step;

        if (newValue !== currentValue) {
            const oldValue = currentValue; // Store old value for callback
            currentValue = newValue;
            const percentage = (currentValue - min) / range;
            const degrees = percentage * maxDegrees - (maxDegrees / 2); // Map 0-1 percentage to -135 to +135 degrees
            handleEl.style.transform = `translateX(-50%) rotate(${degrees}deg)`;
            valueEl.textContent = `${options.displayPrefix || ''}${options.decimals !== undefined ? currentValue.toFixed(options.decimals) : currentValue}${options.displaySuffix || ''}`;
            
            // Only call onValueChange if it's explicitly provided in options
            if (options.onValueChange) {
                options.onValueChange(currentValue, oldValue, fromInteraction);
            }
        }
    }

    // Attach event listeners for mouse and touch interactions
    knobEl.addEventListener('mousedown', onMouseDown);
    knobEl.addEventListener('touchstart', onTouchStart, { passive: false }); // Use passive: false for e.preventDefault()

    function onMouseDown(e) {
        if (options.disabled) return;
        e.preventDefault(); // Prevent text selection and default drag behavior
        initialValueBeforeInteraction = currentValue; // Capture state for undo/redo
        const startY = e.clientY;
        const startValue = currentValue;
        const pixelsForFullRange = 300; // Pixels to move mouse for full range

        function onMouseMove(moveEvent) {
            const deltaY = startY - moveEvent.clientY;
            let valueChange = (deltaY / pixelsForFullRange) * range;
            setValue(startValue + valueChange, true); // Indicate change is from interaction
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            // Only capture state if value changed and callback is provided
            if (currentValue !== initialValueBeforeInteraction && captureStateForUndoCallback) {
                captureStateForUndoCallback(`Change ${options.label} to ${valueEl.textContent}`);
            }
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function onTouchStart(e) {
        if (options.disabled) return;
        e.preventDefault(); // Prevent scrolling
        initialValueBeforeInteraction = currentValue; // Capture state for undo/redo
        const startY = e.touches[0].clientY;
        const startValue = currentValue;
        const pixelsForFullRange = 450; // More pixels for touch sensitivity

        function onTouchMove(moveEvent) {
            const deltaY = startY - moveEvent.touches[0].clientY;
            let valueChange = (deltaY / pixelsForFullRange) * range;
            setValue(startValue + valueChange, true); // Indicate change is from interaction
        }

        function onTouchEnd() {
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            // Only capture state if value changed and callback is provided
            if (currentValue !== initialValueBeforeInteraction && captureStateForUndoCallback) {
                captureStateForUndoCallback(`Change ${options.label} to ${valueEl.textContent}`);
            }
        }

        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    // Set initial value when knob is created
    options.disabled = !!options.disabled; // Ensure disabled is boolean
    setValue(currentValue, false); // Set initial value, not from interaction

    /**
     * Refreshes the visual state of the knob (e.g., disabled/enabled).
     * @param {boolean} disabledState - True to disable the knob, false to enable.
     */
    function refreshVisuals(disabledState) {
        options.disabled = !!disabledState;
        knobEl.style.opacity = options.disabled ? '0.5' : '1';
        knobEl.style.cursor = options.disabled ? 'default' : 'ns-resize';
        // You might want to disable the actual event listeners here too if `options.disabled` is true
        // For simplicity, the `onMouseDown` and `onTouchStart` already check `options.disabled`.
    }

    refreshVisuals(options.disabled);

    return {
        element: container,
        setValue,
        getValue: () => currentValue,
        type: 'knob',
        refreshVisuals,
    };
}