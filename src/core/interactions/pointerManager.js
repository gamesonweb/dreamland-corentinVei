import * as BABYLON from '@babylonjs/core';
import * as Matter from 'matter-js';
import { getScene, getCamera, getCanvas } from '../sceneManager.js';
import { getPhysicsEngine } from '../physicsManager.js';
import { getApplicationMode, handleRemoveItem, triggerConfigUpdateAndReload, bodies as simBodies, currentConfig as simCurrentConfig } from '../simulation.js';
import { showTrashCan, hideTrashCan, isPointerOverTrashCan } from '../uiManager.js';
import { 
    getMatterPointerCoordinates, 
    getInteractionMode, 
    getPointerObserver,
    setPointerObserver, 
    getPointerInteractionCallback,
    setIsDragging,
    getIsDragging,
    setPointerInteractionCallback as setInputPointerInteractionCallback
} from './inputManager.js';
import { 
    startDragging, 
    stopDragging,
    applyRotationToDraggedBody
} from './dragManager.js';
import { 
    updatePlacementPreview, 
    hidePlacementPreview
} from './placementManager.js';
import {
    selectObjectForConfig,
    clearConfigSelectionHighlight
} from './configManager.js';

/**
 * @module core/interactions/pointerManager
 * @description Manages pointer (mouse/touch) interactions within the Babylon.js scene.
 * This module is responsible for attaching pointer event listeners and dispatching
 * actions based on the event type, current application mode, and interaction mode.
 * It coordinates with dragManager, placementManager, configManager, and simulation
 * to handle object dragging, placement, configuration selection, and removal via trash can.
 */

let pointerInteractionCallback = null;

/**
 * Attaches pointer event listeners to the Babylon.js scene using its onPointerObservable.
 * It sets up a callback function (typically from `simulation.js`) to handle high-level
 * interaction logic based on pointer events. Ensures that any previous pointer observer
 * is removed and cleans up any lingering interaction states.
 *
 * @param {module:core/interactions/inputManager.PointerInteractionHandler} interactionCallback -
 *        A callback function from `simulation.js` to handle pointer events.
 *        It receives Babylon's `PointerInfo` and Matter.js world coordinates.
 */
function attachPointerListener(interactionCallback) {
    const scene = getScene();
    if (!scene) return;

    pointerInteractionCallback = interactionCallback;
    setInputPointerInteractionCallback(interactionCallback);

    if (getPointerObserver()) {
        scene.onPointerObservable.remove(getPointerObserver());
        console.log("Removed previous pointer observer.");
    }

    cleanupLingering();

    setPointerObserver(scene.onPointerObservable.add(handlePointerEvent));
    console.log("Pointer listener attached to scene.");
}

/**
 * Cleans up any lingering interaction-related states or objects.
 * This includes removing active Matter.js mouse constraints, hiding the trash can UI,
 * hiding any active placement preview, and clearing configuration selection highlights.
 * Called during `attachPointerListener` to ensure a clean state.
 */
function cleanupLingering() {
    const physicsEngine = getPhysicsEngine();
    
    if (physicsEngine) {
        const constraints = Matter.Composite.allConstraints(physicsEngine.world);
        constraints.forEach(constraint => {
            if (constraint.label === 'Mouse Constraint') {
                Matter.World.remove(physicsEngine.world, constraint, true);
                console.log("Cleaned up lingering mouse constraint.");
            }
        });
    }
    
    hideTrashCan();
    hidePlacementPreview();
    clearConfigSelectionHighlight();
}

/**
 * Central handler for all Babylon.js pointer events (POINTERDOWN, POINTERMOVE, POINTERUP, POINTERWHEEL).
 * This function determines the appropriate action based on the current application mode
 * (`construction`, `configuration`, `simulation`), interaction mode (`drag`, `place`),
 * and the type of pointer event.
 *
 * Actions include:
 * - Invoking the main `pointerInteractionCallback` (from `simulation.js`) for general handling.
 * - Updating placement previews during pointer move in 'place' mode.
 * - Handling object rotation via mouse wheel during drag in 'construction' or 'configuration' modes.
 * - Initiating object configuration selection on click in 'configuration' mode.
 * - Managing drag start/end in 'construction' or 'configuration' modes.
 * - Handling right-click to cancel placement in 'place' mode.
 * - Cancelling drag if simulation starts while dragging.
 *
 * @param {BABYLON.PointerInfo} pointerInfo - Detailed information about the pointer event.
 */
function handlePointerEvent(pointerInfo) {
    const scene = getScene();
    const camera = getCamera();
    const canvas = getCanvas();
    const physicsEngine = getPhysicsEngine();

    if (!scene || !camera || !canvas || !physicsEngine) return;    const currentAppMode = getApplicationMode();
    const pointerCoords = getMatterPointerCoordinates(scene, camera);
    const interactionMode = getInteractionMode();

    if (pointerInteractionCallback) {
        pointerInteractionCallback(pointerInfo, pointerCoords);
    }

    if (interactionMode === 'place' && 
        pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE && 
        pointerCoords) {
        
        const previewState = updatePlacementPreview(pointerCoords);        
        if (previewState.isValid) {
            pointerInteractionCallback(
                { type: BABYLON.PointerEventTypes.POINTERDOWN, event: { button: 0 } },
                pointerCoords
            );
        }
    }

    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
        const event = pointerInfo.event;
        const isDragging = getIsDragging();
        console.log(`PointerManager: POINTERWHEEL - isDragging: ${isDragging}, interactionMode: ${interactionMode}, currentAppMode: ${currentAppMode}`);

        if (isDragging && interactionMode === 'drag' && (currentAppMode === 'construction' || currentAppMode === 'configuration')) {
            console.log("PointerManager: POINTERWHEEL - Applying rotation to dragged body.");
            const delta = event.deltaY || event.detail || event.wheelDelta;
            applyRotationToDraggedBody(delta);
            event.preventDefault();
        } else {
            console.log("PointerManager: POINTERWHEEL - Conditions for rotation not met, allowing default camera zoom (if active).");

        }
        return;
    }

    if (currentAppMode === 'configuration' && 
        pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN && 
        pointerInfo.event.button === 0 && 
        !getIsDragging()) {
        
        handleConfigClick(pointerInfo);
        return;
    }

    if (interactionMode === 'drag' && (currentAppMode === 'construction' || currentAppMode === 'configuration')) {
        if (!pointerCoords) return;

        switch (pointerInfo.type) {
            case BABYLON.PointerEventTypes.POINTERDOWN:
                if (pointerInfo.event.button === 0 && !getIsDragging()) {
                    handleDragStart(pointerInfo, pointerCoords);
                }
                break;

            case BABYLON.PointerEventTypes.POINTERMOVE:
                break;

            case BABYLON.PointerEventTypes.POINTERUP:
                if (pointerInfo.event.button === 0 && getIsDragging()) {
                    handleDragEnd(pointerInfo, scene);
                }
                break;
        }    } else if (interactionMode === 'place') {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN && pointerInfo.event.button === 2) {
            if (pointerInteractionCallback) {
                pointerInteractionCallback({ type: 'cancel-placement' }, null);
            }
        }
    } else if (currentAppMode === 'simulation' && getIsDragging()) {
        console.log("Simulation mode started during drag, cancelling drag.");
        setIsDragging(false);
        stopDragging();
    }
}

/**
 * Handles the start of a drag operation (typically on POINTERDOWN).
 * If a pickable, non-static, non-fixed physics object is under the pointer,
 * it initiates dragging for that object using `dragManager.startDragging`.
 * Prevents default event behavior to stop camera movement or other interactions.
 *
 * @param {BABYLON.PointerInfo} pointerInfo - The Babylon.js pointer event information.
 * @param {{x: number, y: number}} pointerCoords - The Matter.js world coordinates of the pointer.
 */
function handleDragStart(pointerInfo, pointerCoords) {
    const scene = getScene();
    const physicsEngine = getPhysicsEngine();
    
    const pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && pickResult.pickedMesh && 
        (!pickResult.pickedMesh.layerMask || pickResult.pickedMesh.layerMask !== 0x20000000)) {
        
        const physicsBodies = Matter.Composite.allBodies(physicsEngine.world);
        const pickedBody = physicsBodies.find(b => 
            `mesh-${b.configId}` === pickResult.pickedMesh.name && !b.isStatic);

        if (pickedBody) {
            const configData = simCurrentConfig.objects.find(o => o.id === pickedBody.configId);
            if (configData?.isFixed) {
                console.log(`Object ${pickedBody.configId} is fixed, dragging prevented.`);
                pointerInfo.event.preventDefault();
                return;
            }

            startDragging(pickedBody, pickResult.pickedMesh, pointerCoords);
            pointerInfo.event.preventDefault();
        }
    }
}

/**
 * Handles the end of a drag operation (typically on POINTERUP).
 * Stops the drag using `dragManager.stopDragging`. If the object is dropped over
 * the trash can UI and is not fixed, it triggers `handleRemoveItem` from `simulation.js`.
 * Otherwise, it triggers a configuration update and reload to save the object's new
 * position and angle. Includes error handling and fallback mechanisms.
 *
 * @param {BABYLON.PointerInfo} pointerInfo - The Babylon.js pointer event information.
 * @param {BABYLON.Scene} scene - The current Babylon.js scene.
 */
function handleDragEnd(pointerInfo, scene) {
    console.log("handleDragEnd called");
    
    const droppedBody = stopDragging();
    if (!droppedBody || !droppedBody.id) {
        console.warn("Invalid dropped body or missing ID");
        return;
    }
    
    const pointerScreenCoords = { x: scene.pointerX, y: scene.pointerY };
    console.log(`Pointer coordinates at drop: ${pointerScreenCoords.x}, ${pointerScreenCoords.y}`);
    
    const droppedConfigData = droppedBody.id ? 
                             simCurrentConfig.objects.find(o => o.id === droppedBody.id) : 
                             null;
    
    console.log(`Checking if pointer is over trash can...`);
    
    try {
        const isOverTrashManual = isNearTrashArea(pointerScreenCoords.x, pointerScreenCoords.y);
        const isOverTrashNormal = isPointerOverTrashCan(pointerScreenCoords.x, pointerScreenCoords.y);
        
        console.log(`Manual trash area check: ${isOverTrashManual}`);
        console.log(`Standard trash area check: ${isOverTrashNormal}`);
        
        const isOverTrash = isOverTrashManual || isOverTrashNormal;
        console.log(`Final trash detection result: ${isOverTrash}`);
        
        if (isOverTrash) {
            console.log(`Dropping body ${droppedBody.id} onto trash can.`);
            if (droppedBody.id !== null && !droppedConfigData?.isFixed) {
                console.log(`Attempting to remove item with ID: ${droppedBody.id}`);
                
                try {
                    if (typeof handleRemoveItem === 'function') {
                        handleRemoveItem(droppedBody.id);
                        console.log(`Item removal function called successfully for ID: ${droppedBody.id}`);
                    } else {
                        console.error("handleRemoveItem is not a function:", handleRemoveItem);
                    }
                } catch (err) {
                    console.error("Error during item removal:", err);
                }
            } else {
                if (droppedConfigData?.isFixed) {
                    console.log(`Object ${droppedBody.id} is fixed, deletion prevented.`);
                    triggerConfigUpdateAndReload(droppedBody.id, droppedBody.position, droppedBody.angle);
                } else {
                    console.warn(`Cannot remove: droppedBody.id is ${droppedBody.id} or droppedConfigData not found`);
                }
            }
        } else {
            console.log("Normal drop - updating position.");
            console.log("Dropped body:", droppedBody.id, "at", droppedBody.position, "angle", droppedBody.angle);
            triggerConfigUpdateAndReload(droppedBody.id, droppedBody.position, droppedBody.angle);
        }
    } catch (error) {
        console.error("Error in handleDragEnd:", error);
        if (droppedBody.id !== null) {
            triggerConfigUpdateAndReload(droppedBody.id, droppedBody.position, droppedBody.angle);
        }
    }
}

/**
 * A simple fallback function to detect if the pointer is near the trash can area.
 * This checks if the pointer's screen coordinates (x, y) are within a 100x100 pixel
 * area in the bottom-right corner of the canvas. Used as a secondary check if
 * `uiManager.isPointerOverTrashCan` might not be reliable in all cases.
 *
 * @param {number} x - The screen X-coordinate of the pointer.
 * @param {number} y - The screen Y-coordinate of the pointer.
 * @returns {boolean} True if the pointer is considered near the trash area, false otherwise.
 */
function isNearTrashArea(x, y) {
    const engine = BABYLON.EngineStore.LastCreatedEngine;
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    
    const isNearTrash = x > width - 100 && y > height - 100;
    console.log(`Screen dimensions: ${width}x${height}, isNearTrash: ${isNearTrash}`);
    return isNearTrash;
}

/**
 * Handles clicks when the application is in 'configuration' mode.
 * If a pickable, non-fixed physics object is clicked, it retrieves the object's
 * current properties (mass, friction, restitution) and any configured limits
 * (e.g., from its inventory definition). It then calls `configManager.selectObjectForConfig`
 * to highlight the object and display the configuration panel.
 * If empty space or a non-configurable object is clicked, it clears any existing
 * configuration selection.
 *
 * @param {BABYLON.PointerInfo} pointerInfo - The Babylon.js pointer event information.
 */
function handleConfigClick(pointerInfo) {
    const scene = getScene();
    const physicsEngine = getPhysicsEngine();
    
    const pickResult = scene.pick(scene.pointerX, scene.pointerY);
    if (pickResult.hit && pickResult.pickedMesh && 
        (!pickResult.pickedMesh.layerMask || pickResult.pickedMesh.layerMask !== 0x20000000)) {
        
        const physicsBodies = Matter.Composite.allBodies(physicsEngine.world);
        const pickedBody = physicsBodies.find(b => `mesh-${b.configId}` === pickResult.pickedMesh.name);

        if (pickedBody) {
            const objectId = pickedBody.configId;
            
            const bodyData = simBodies.get(objectId);
            const configData = simCurrentConfig.objects.find(o => o.id === objectId);

            if (bodyData && configData) {
                if (configData.isFixed) {
                    console.log(`Object ${objectId} is fixed, configuration prevented.`);
                    pointerInfo.event.preventDefault();
                    return;
                }

                let limits = {};
                const baseIdMatch = objectId.match(/^([a-zA-Z0-9_]+?)_\d+$/);
                if (baseIdMatch && simCurrentConfig && simCurrentConfig.inventory) {
                    const baseInventoryId = baseIdMatch[1];
                    const inventoryItem = simCurrentConfig.inventory.find(item => item.id === baseInventoryId);
                    if (inventoryItem && inventoryItem.objectProperties && inventoryItem.objectProperties.configLimits) {
                        limits = inventoryItem.objectProperties.configLimits;
                        console.log(`Found limits for ${baseInventoryId}:`, limits);
                    } else {
                        console.log(`No specific limits found for base ID ${baseInventoryId}, using defaults.`);
                    }
                } else {
                    console.log(`Could not extract base ID or inventory not available for ${objectId}, using default limits.`);
                }

                const properties = {
                    mass: bodyData.mass,
                    friction: bodyData.friction,
                    restitution: bodyData.restitution
                };
                console.log(`Configuration click on ${objectId}, properties:`, properties);
                
                selectObjectForConfig(pickResult.pickedMesh, objectId, properties, limits);
                pointerInfo.event.preventDefault();
                return;
            } else {
                console.warn(`Could not find body data or config data for clicked object ${objectId}`);
                clearConfigSelectionHighlight();
            }
        } else {
            clearConfigSelectionHighlight();
        }
    } else {
        clearConfigSelectionHighlight();
    }
}

/**
 * Sets the local pointer interaction callback function for this module.
 * This function is primarily intended to be called by `attachPointerListener`
 * to store the callback provided by `simulation.js`.
 *
 * @param {module:core/interactions/inputManager.PointerInteractionHandler} callback -
 *        The callback function to be stored.
 */
function setPointerInteractionCallback(callback) {
    if (typeof callback === 'function') {
        pointerInteractionCallback = callback;
    }
}

export {
    attachPointerListener,
    cleanupLingering,
    handlePointerEvent,
    setPointerInteractionCallback
};
