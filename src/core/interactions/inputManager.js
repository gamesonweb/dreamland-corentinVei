import * as BABYLON from '@babylonjs/core';
import * as Matter from 'matter-js';
import { getScene, getCamera, getCanvas } from '../sceneManager.js';
import { getApplicationMode, toggleSimulationMode, cancelPlacement, initSimulation, currentConfig, currentScenePath } from '../simulation.js';
import * as HistoryManager from '../historyManager.js';
import { toggleSettingsMenuVisibility } from '../ui/settingsMenuBabylon.js';
import { hideMainMenu } from '../ui/mainMenu.js';
import { hideLevelSelectMenu } from '../ui/levelSelectMenu.js';

/**
 * @module core/interactions/inputManager
 * @description Manages general input handling, including keyboard events for simulation control
 * and pointer coordinate conversions. It also tracks the current interaction mode (drag/place)
 * and dragging state.
 */

/**
 * @callback PointerInteractionHandler
 * @param {BABYLON.PointerInfo} pointerInfo - The Babylon.js pointer event information.
 * @param {{x: number, y: number}|null} worldCoordinates - The converted Matter.js world coordinates of the pointer, or null.
 * @returns {void}
 */

let interactionMode = 'drag';
let pointerObserver = null;
let pointerInteractionCallback = null;
let isDragging = false;

/**
 * @constant {number} MAX_INTERACTION_DISTANCE
 * @description Maximum distance (in world units) the pointer can be from a dragged object's anchor
 * before the drag target is clamped. This prevents objects from being flung too far.
 */
const MAX_INTERACTION_DISTANCE = 100;

/**
 * @constant {number} ROTATION_VELOCITY_STEP
 * @description The increment/decrement value applied to a dragged body's angular velocity
 * when a rotation input (e.e., mouse wheel) is received.
 */
const ROTATION_VELOCITY_STEP = 0.1;

/**
 * Attaches a global keyboard listener to the document for simulation control.
 * Handles 'Escape' key for cancelling placement and 'Space' key for toggling simulation mode.
 * Ensures that the listener is not attached multiple times.
 */
function attachKeyboardListener() {
    document.removeEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleKeyDown);
    console.log("Keyboard listener attached.");
}

/**
 * Handles keydown events on the document.
 * - If 'Escape' is pressed while in 'place' interaction mode, it cancels the placement.
 * - If 'Escape' is pressed and a level is active (main menu is hidden), it returns to the main menu.
 * - If 'Space' is pressed and not currently dragging an object, it toggles the simulation mode (play/pause).
 * @param {KeyboardEvent} event - The keyboard event object.
 */
function handleKeyDown(event) {
    console.log(`InputManager: KeyDown - Code: ${event.code}, Ctrl: ${event.ctrlKey}, Meta: ${event.metaKey}, Shift: ${event.shiftKey}`);

    if (event.code === 'Escape') {
        event.preventDefault();
        if (interactionMode === 'place') {
            console.log("InputManager: Escape pressed in place mode - cancelling placement.");
            cancelPlacement();
        } else if (currentConfig) {
            console.log("InputManager: Escape pressed during active level - toggling in-game settings menu.");
            if (typeof hideMainMenu === 'function') hideMainMenu();
            if (typeof hideLevelSelectMenu === 'function') hideLevelSelectMenu();
            toggleSettingsMenuVisibility();
        } else { 
            console.log("InputManager: Escape pressed (no active level). Settings menu not toggled.");
        }
        return;
    }

    if (!isDragging && event.code === 'Space') {
        console.log("InputManager: Space pressed.");
        event.preventDefault();
        toggleSimulationMode();
        return;
    }

    const isUndo = ((event.ctrlKey || event.metaKey) && (event.code === 'KeyZ' || event.code === 'KeyW')) && !event.shiftKey;
    if (isUndo) {
        console.log(`InputManager: Undo shortcut detected (Code: ${event.code}).`);
        event.preventDefault();
        if (HistoryManager.hasUndo()) {
            console.log("InputManager: History has undo states. Attempting undo.");
            const liveConfig = currentConfig;
            const prevState = HistoryManager.undo(liveConfig);
            if (prevState) {
                console.log("InputManager: Previous state retrieved. Initializing simulation for undo.");
                const scenePath = currentScenePath;
                initSimulation(prevState, scenePath, true);
            } else {
                console.log("InputManager: HistoryManager.undo() returned null.");
            }
        } else {
            console.log("InputManager: HistoryManager reports nothing to undo.");
        }
        return;
    }


    const isRedo = (event.ctrlKey && event.code === 'KeyY') ||
                   ((event.metaKey && event.shiftKey) && (event.code === 'KeyZ' || event.code === 'KeyW'));
    if (isRedo) {
        console.log(`InputManager: Redo shortcut detected (Code: ${event.code}).`);
        event.preventDefault();
        if (HistoryManager.hasRedo()) {
            console.log("InputManager: History has redo states. Attempting redo.");
            const liveConfig = currentConfig;
            const nextState = HistoryManager.redo(liveConfig);
            if (nextState) {
                console.log("InputManager: Next state retrieved. Initializing simulation for redo.");
                const scenePath = currentScenePath;
                initSimulation(nextState, scenePath, true);
            } else {
                console.log("InputManager: HistoryManager.redo() returned null.");
            }
        } else {
            console.log("InputManager: HistoryManager reports nothing to redo.");
        }
        return;
    }
}

/**
 * Converts Babylon.js pointer coordinates (from screen space) to Matter.js world coordinates.
 * This is achieved by creating a picking ray from the camera through the pointer's screen position
 * and finding its intersection with a plane at Z=0 (the 2D physics plane).
 *
 * @param {BABYLON.Scene} scene - The current Babylon.js scene.
 * @param {BABYLON.Camera} camera - The active camera in the scene.
 * @returns {{x: number, y: number} | null} An object with `x` and `y` world coordinates,
 *                                          or `null` if the conversion is not possible (e.g., ray doesn't intersect plane).
 */
function getMatterPointerCoordinates(scene, camera) {
    if (!scene || !camera) return null;
    const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), camera);
    const plane = new BABYLON.Plane(0, 0, -1, 0);
    const distance = ray.intersectsPlane(plane);

    if (distance !== null) {
        const point = ray.origin.add(ray.direction.scale(distance));
        return { x: point.x, y: point.y };
    }
    return null;
}

/**
 * Sets the current interaction mode for pointer interactions.
 * @param {'drag' | 'place'} mode - The interaction mode to set.
 *                                  'drag' for dragging existing objects.
 *                                  'place' for placing new objects from inventory.
 */
function setInteractionMode(mode) {
    if (mode === 'drag' || mode === 'place') {
        interactionMode = mode;
        console.log(`Interaction mode set to: ${interactionMode}`);
    } else {
        console.warn(`Invalid interaction mode: ${mode}`);
    }
}

/**
 * Gets the current interaction mode.
 * @returns {'drag' | 'place'} The current interaction mode.
 */
function getInteractionMode() {
    return interactionMode;
}

/**
 * Sets the flag indicating whether an object is currently being dragged.
 * @param {boolean} value - True if dragging is active, false otherwise.
 */
function setIsDragging(value) {
    isDragging = value;
}

/**
 * Gets the current dragging state.
 * @returns {boolean} True if an object is currently being dragged, false otherwise.
 */
function getIsDragging() {
    return isDragging;
}

/**
 * Gets the current Babylon.js pointer observer instance.
 * @returns {BABYLON.Observer<BABYLON.PointerInfo> | null} The current pointer observer, or null if not set.
 */
function getPointerObserver() {
    return pointerObserver;
}

/**
 * Sets the Babylon.js pointer observer instance.
 * This is typically used by `pointerManager.js` to store the observer it creates.
 * @param {BABYLON.Observer<BABYLON.PointerInfo> | null} observer - The pointer observer to set, or null to clear it.
 */
function setPointerObserver(observer) {
    pointerObserver = observer;
}

/**
 * Sets the callback function to be invoked by `pointerManager.js` when pointer interactions occur.
 * This callback is typically provided by `simulation.js` to handle game logic based on pointer events.
 * @param {PointerInteractionHandler | null} callback - The callback function,
 *        or null to clear it.
 */
function setPointerInteractionCallback(callback) {
    pointerInteractionCallback = callback;
}

/**
 * Gets the currently set pointer interaction callback function.
 * @returns {PointerInteractionHandler | null} The current callback function, or null.
 */
function getPointerInteractionCallback() {
    return pointerInteractionCallback;
}

export {
    attachKeyboardListener,
    handleKeyDown,
    getMatterPointerCoordinates,
    setInteractionMode,
    getInteractionMode,
    setIsDragging,
    getIsDragging,
    getPointerObserver,
    setPointerObserver,
    setPointerInteractionCallback,
    getPointerInteractionCallback,
    MAX_INTERACTION_DISTANCE,
    ROTATION_VELOCITY_STEP
};
