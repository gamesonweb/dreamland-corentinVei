import * as BABYLON from '@babylonjs/core';
import * as Matter from 'matter-js';

import { initializeBabylon, createMeshes, updateMeshes, updateConstraintLines, disposeMeshes, attachPointerObservable, getScene, setSimulationMeshesActive, getEngine as getBabylonEngine } from './sceneManager.js';

import { initializePhysics, createPhysicsObjects, cleanupPhysics, updatePhysics, getPhysicsEngine, checkPlacementCollision, setSimulationBoundariesActive } from './physicsManager.js';

import { attachKeyboardListener, attachPointerListener, updateDragConstraintTarget, setInteractionMode, getInteractionMode, showPlacementPreview, hidePlacementPreview, startDragOnNewBody, clearConfigSelectionHighlight } from './interactionManager.js';

import { createInventoryUI, disposeUI, createTrashCan, createTopMenuBar, updateTopMenuBar, createConfigPanel, showConfigPanel, hideConfigPanel, createObjectivesPanel, updateObjectivesPanel, updateUIContent } from './uiManager.js';

import { MaxHeightObjective } from './objectives/MaxHeightObjective.js';
import { StayInZoneObjective } from './objectives/StayInZoneObjective.js';

let currentConfig = null;
let currentScenePath = null;
let applicationMode = 'construction';
let previousApplicationMode = 'construction';
let isDraggingInPause = false;
let itemToPlace = null;
let nextItemIdCounter = 0;

const RUNNING_TIMESTEP = 1000 / 60;
const DRAGGING_TIMESTEP = RUNNING_TIMESTEP / 2;

const RUNNING_SUBSTEPS = 100;
const DRAGGING_SUBSTEPS = 10;

let lastSimulationTime = 0;

let bodies = new Map();
let meshes = new Map();
let constraintLines = new Map();
let activeObjectives = [];

/**
 * Handles an error scenario where a preview image generation fails
 * This function logs a warning and triggers a reload of the current simulation state.
 */
function handlePreviewErrorReload() {
    console.warn("Preview error detected (urlampty). Reloading simulation...");
    initSimulation(currentConfig, currentScenePath);
}

/**
 * Initializes or re-initializes the entire simulation environment.
 * This includes setting up or resetting the Babylon.js scene, physics engine,
 * UI elements, event listeners, and objectives based on the provided configuration.
 * @param {object} config - The scene configuration object. This object defines the world properties,
 *                          objects, constraints, inventory items, and objectives for the simulation.
 * @param {string|null} path - The file path from which the `config` was loaded, or null if not applicable.
 *                             Used for reloading purposes.
 */
function initSimulation(config, path) {
    console.log("Initializing simulation...");
    currentConfig = config;
    currentScenePath = path;
    applicationMode = 'construction';

    disposeUI();

    initializeBabylon(currentConfig);

    initializePhysics(currentConfig.world);

    populateSimulation();

    attachKeyboardListener();
    attachPointerListener(handlePointerInteraction);

    createInventoryUI(currentConfig, handleAddItemRequest, handlePreviewErrorReload);
    createTopMenuBar(applicationMode, setApplicationMode);
    createTrashCan();
    createConfigPanel(handleConfigUpdate);

    initializeObjectives(currentConfig.objectives);

    const scene = getScene();
    if (scene) {
        scene.executeWhenReady(() => {
            console.log("Scene ready, updating initial inventory UI content.");
            updateUIContent(currentConfig);
        });
    } else {
        console.error("Scene not available to schedule initial UI update.");
    }

    setSimulationBoundariesActive(false);
    setSimulationMeshesActive(false);

    if (scene) {
        scene.onBeforeRenderObservable.clear();
        scene.onBeforeRenderObservable.add(simulationLoop);
        console.log("Simulation loop registered.");
    } else {
        console.error("Failed to register simulation loop: Babylon scene not available.");
    }

    console.log("Simulation initialization complete.");
}

/**
 * Handles pointer (mouse/touch) interactions within the Babylon.js scene.
 * This function is called by the `interactionManager` when a pointer event occurs.
 * It specifically manages item placement logic when in 'place' interaction mode.
 * @param {BABYLON.PointerInfo} pointerInfo - Detailed information about the pointer event.
 * @param {{x: number, y: number} | null} worldCoords - The Matter.js world coordinates corresponding
 *                                                    to the pointer's position, or null if not applicable
 *                                                    (e.g., pointer up outside canvas).
 */
function handlePointerInteraction(pointerInfo, worldCoords) {
    const currentMode = getInteractionMode();

    if (currentMode !== 'place' || pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN || pointerInfo.event.button !== 0 || !worldCoords || !itemToPlace) {
        return;
    }

    const wb = currentConfig?.world?.workingBounds;
    if (!wb) {
        console.error("Working bounds not defined in world config!");
        cancelPlacement();
        return;
    }
    if (worldCoords.x < wb.x || worldCoords.x > wb.x + wb.width ||
        worldCoords.y < wb.y || worldCoords.y > wb.y + wb.height) {
        console.warn("Placement prevented: Outside working bounds.");
        cancelPlacement();
        return;
    }

    const collisionDetected = checkPlacementCollision(itemToPlace.objectProperties, worldCoords);
    if (collisionDetected) {
        console.warn("Placement prevented: Collision detected at target location.");
        cancelPlacement();
    } else {
        console.log(`Placing item ${itemToPlace.id} at`, worldCoords);
        hidePlacementPreview();
        handlePlaceItem(worldCoords, itemToPlace);
        itemToPlace = null;
    }
}

/**
 * Cancels an ongoing item placement operation.
 * Resets the item to be placed, hides the placement preview, and sets the interaction mode back to 'drag'.
 */
function cancelPlacement() {
    if (getInteractionMode() === 'place') {
        console.log("Cancelling placement.");
        itemToPlace = null;
        hidePlacementPreview();
        setInteractionMode('drag');
    }
}

/**
 * Handles a request to add an item from the inventory to the scene.
 * Switches the application to 'construction' mode, sets the interaction mode to 'place',
 * and prepares the specified inventory item for placement.
 * @param {object} inventoryItem - The configuration object of the inventory item to be placed.
 *                                 This object should contain `id`, `displayName`, `count`,
 *                                 and `objectProperties`.
 */
function handleAddItemRequest(inventoryItem) {

    setApplicationMode('construction');

    if (getInteractionMode() === 'place') {
        console.log("Already in placement mode. Click location or cancel.");
        return;
    }
    if (!inventoryItem || inventoryItem.count <= 0) {
        console.warn(`Cannot add item: Invalid item or count is zero.`);
        return;
    }

    console.log(`Requesting placement for: ${inventoryItem.displayName}`);
    itemToPlace = inventoryItem;
    showPlacementPreview(inventoryItem.objectProperties);
}

/**
 * Handles the actual placement of an inventory item into the simulation.
 * This function is called after a valid placement click. It decrements the item's count
 * in the inventory, creates the new physical body and visual mesh for the item,
 * adds it to the simulation's object list, and initiates dragging for the newly placed item.
 * @param {{x: number, y: number}} position - The world coordinates where the item is to be placed.
 * @param {object} inventoryItem - The inventory item configuration object that was selected for placement.
 */
function handlePlaceItem(position, inventoryItem) {
    if (!currentConfig || !inventoryItem) return;

    const invItem = currentConfig.inventory.find(i => i.id === inventoryItem.id);
    if (!invItem || invItem.count <= 0) {
        console.error(`Cannot place item ${inventoryItem.id}: not found or zero count.`);
        setInteractionMode('drag');
        return;
    }

    invItem.count--;

    const newObjectId = `${inventoryItem.id}_${nextItemIdCounter++}`;
    const newObjectConfig = {
        ...inventoryItem.objectProperties,
        id: newObjectId,
        x: position.x,
        y: position.y,
        isStatic: false,
        angle: 0
    };

    currentConfig.objects.push(newObjectConfig);

    const physicsRes = createPhysicsObjects([newObjectConfig], [], currentConfig.world);
    const body = physicsRes.bodies.get(newObjectId);
    bodies.set(newObjectId, body);

    const sceneRes = createMeshes([newObjectConfig], [], currentConfig.world);
    const mesh = sceneRes.meshes.get(newObjectId);
    meshes.set(newObjectId, mesh);

    setInteractionMode('drag');

    setApplicationMode('construction');
    startDragOnNewBody(body, mesh, position);
    console.log(`Placed and continued drag for ${newObjectId}.`);
}

/**
 * Handles the removal of an object from the simulation.
 * Removes the object from the `currentConfig.objects` array. If the object
 * originated from the inventory (identified by its ID pattern), its count is
 * incremented back in the inventory. Finally, the simulation is re-initialized.
 * Fixed objects cannot be removed.
 * @param {string} objectId - The unique ID of the object to be removed.
 */
function handleRemoveItem(objectId) {
    if (!currentConfig) return;

    const objectIndex = currentConfig.objects.findIndex(o => o.id === objectId);
    if (objectIndex === -1) {
        console.error(`Cannot remove object ${objectId}: Not found in config.`);
        return;
    }

    const configObject = currentConfig.objects[objectIndex];

    if (configObject.isFixed) {
        console.warn(`Attempted to remove fixed object ${objectId}. Operation cancelled.`);
        return;
    }

    const removedObject = currentConfig.objects.splice(objectIndex, 1)[0];
    console.log(`Removed object ${objectId} from config.`);

    const inventoryIdMatch = objectId.match(/^([a-zA-Z0-9_]+?)_\d+$/);
    if (inventoryIdMatch) {
        const baseInventoryId = inventoryIdMatch[1];
        const itemInInventory = currentConfig.inventory.find(i => i.id === baseInventoryId);
        if (itemInInventory) {
            itemInInventory.count++;
            console.log(`Incremented count for inventory item ${baseInventoryId}.`);
        } else {
             console.warn(`Removed object ${objectId} looked like an inventory item, but base ID ${baseInventoryId} not found in inventory.`);
        }
    }

    console.log("Reloading simulation after removal...");

    initSimulation(currentConfig, currentScenePath);
}

/**
 * Clears existing physics objects and visual meshes from the simulation,
 * then recreates them based on the `currentConfig`. This is used to reset
 * the scene or apply changes from a loaded configuration.
 */
function populateSimulation() {
    console.log("Populating simulation...");

    cleanupPhysics();
    initializePhysics(currentConfig.world);

    disposeMeshes(meshes, constraintLines);

    const physicsResult = createPhysicsObjects(currentConfig.objects, currentConfig.constraints, currentConfig.world);
    bodies = physicsResult.bodies;

    const sceneResult = createMeshes(currentConfig.objects, currentConfig.constraints, currentConfig.world);
    meshes = sceneResult.meshes;
    constraintLines = sceneResult.constraintLines;

    console.log("Simulation populated.");
}

/**
 * The main simulation loop, executed before each frame render by Babylon.js.
 * Handles physics updates (stepping the engine), visual updates (synchronizing meshes
 * with physics bodies), and objective updates.
 * Physics updates are conditional based on the `applicationMode` and `isDraggingInPause` state.
 */
function simulationLoop() {

    if (isDraggingInPause) {
        updateDragConstraintTarget();
    }

    const simStartTime = performance.now();

    if (applicationMode === 'simulation') {
        const subStepDelta = RUNNING_TIMESTEP / RUNNING_SUBSTEPS;
        for (let i = 0; i < RUNNING_SUBSTEPS; i++) {
            updatePhysics(subStepDelta);
        }
    } else if (isDraggingInPause && (applicationMode === 'construction' || applicationMode === 'configuration')) {

        const subStepDelta = DRAGGING_TIMESTEP / DRAGGING_SUBSTEPS;
         for (let i = 0; i < DRAGGING_SUBSTEPS; i++) {
            updatePhysics(subStepDelta);
        }
    }

    lastSimulationTime = performance.now() - simStartTime;

    updateMeshes(meshes, bodies);
    updateConstraintLines(constraintLines, currentConfig.constraints, bodies);

    if (applicationMode === 'simulation' && activeObjectives.length > 0) {
        const deltaTime = getBabylonEngine().getDeltaTime() / 1000;
        activeObjectives.forEach(objective => {
            objective.update(bodies, deltaTime);
        });
        updateObjectivesPanel(activeObjectives);
    }
}

/**
 * Gets the current application mode.
 * @returns {'construction' | 'configuration' | 'simulation'} The current application mode.
 */
function getApplicationMode() {
    return applicationMode;
}

/**
 * Sets the application's operational mode and performs associated setup or teardown actions.
 * Modes include 'construction' (placing/moving objects), 'configuration' (editing object properties),
 * and 'simulation' (running physics).
 * @param {'construction' | 'configuration' | 'simulation'} newMode - The desired new application mode.
 */
function setApplicationMode(newMode) {
    if (newMode === applicationMode) return;

    const previousMode = applicationMode;
    applicationMode = newMode;
    console.log(`Application mode set to: ${applicationMode}`);

    updateTopMenuBar(applicationMode);

    if (previousMode === 'construction' && newMode !== 'construction') {
        cancelPlacement();
    }

    if (previousMode === 'configuration' && newMode !== 'configuration') {
        hideConfigPanel();
        clearConfigSelectionHighlight();
    }

    if (newMode === 'simulation') {
        isDraggingInPause = false;
        setInteractionMode('drag');
        setSimulationBoundariesActive(true);
        setSimulationMeshesActive(true);
    } else if (previousMode === 'simulation' && (newMode === 'construction' || newMode === 'configuration')) {

        setSimulationBoundariesActive(false);
        setSimulationMeshesActive(false);

        console.log("Resetting dynamic bodies to initial positions.");
        bodies.forEach(body => {
            if (body && !body.isStatic && body.initialConfig) {
                Matter.Body.setPosition(body, body.initialConfig.position);
                Matter.Body.setAngle(body, body.initialConfig.angle);
                Matter.Body.setVelocity(body, { x: 0, y: 0 });
                Matter.Body.setAngularVelocity(body, 0);
            }
        });

        if (activeObjectives.length > 0) {
            activeObjectives.forEach(objective => objective.reset());
            updateObjectivesPanel(activeObjectives);
        }

    }

    if (newMode === 'configuration') {
        console.log("Entered Configuration mode.");
    }
}

/**
 * Toggles the application mode between 'simulation' and the previously active non-simulation mode
 * (either 'construction' or 'configuration'). This is typically triggered by a keyboard shortcut (e.g., spacebar).
 */
function toggleSimulationMode() {
    if (applicationMode === 'simulation') {
        setApplicationMode(previousApplicationMode);
    } else if (applicationMode === 'construction' || applicationMode === 'configuration') {

        previousApplicationMode = applicationMode;
        setApplicationMode('simulation');
    }

}

/**
 * Updates the in-memory configuration for an object (position and angle) and
 * then triggers a full reload of the simulation to apply these changes.
 * If the object is marked as `isFixed` in the configuration, its position/angle
 * are not saved to the config, but the simulation is still reloaded to reset its visual state.
 * @param {string} bodyId - The `configId` of the physics body whose configuration is to be updated.
 * @param {{x: number, y: number}} finalPosition - The new position of the object.
 * @param {number} finalAngle - The new angle (in radians) of the object.
 */
function triggerConfigUpdateAndReload(bodyId, finalPosition, finalAngle) {
    if (!currentConfig) return;

    const objectInConfig = currentConfig.objects.find(o => o.id === bodyId);

    if (!objectInConfig) {
        console.error(`Could not find object with ID ${bodyId} in config to update.`);
        return;
    }

    if (!objectInConfig.isFixed) {
        objectInConfig.x = finalPosition.x;
        objectInConfig.y = finalPosition.y;
        objectInConfig.angle = finalAngle;
        console.log(`Updated config in memory for ${bodyId} (Pos: ${finalPosition.x.toFixed(1)},${finalPosition.y.toFixed(1)}, Angle: ${finalAngle.toFixed(2)}).`);
    } else {

        console.log(`Object ${bodyId} is fixed. Position/angle changes not saved to config, but reloading to reset position.`);
    }

    console.log(`Reloading simulation after interaction with ${bodyId}...`);

    initSimulation(currentConfig, currentScenePath);
}

/**
 * Sets a flag indicating whether an object is currently being dragged by the user,
 * particularly when the main simulation is paused (i.e., in 'construction' or 'configuration' mode).
 * This allows the simulation loop to selectively update physics for the dragged object.
 * @param {boolean} isDragging - True if dragging is active while paused, false otherwise.
 */
function setDraggingState(isDragging) {
    isDraggingInPause = isDragging;
}

/**
 * Handles updates to an object's properties (mass, friction, restitution)
 * received from the configuration UI panel. Updates both the live Matter.js body
 * and the stored `currentConfig`. Fixed objects cannot have their properties updated.
 * @param {string} objectId - The `configId` of the object being updated.
 * @param {'mass' | 'friction' | 'restitution'} property - The name of the property to update.
 * @param {number} value - The new value for the property.
 */
function handleConfigUpdate(objectId, property, value) {
    const body = bodies.get(objectId);
    const configObject = currentConfig.objects.find(o => o.id === objectId);

    if (!body || !configObject) {
        console.error(`Cannot update config for ${objectId}: Body or config object not found.`);
        return;
    }

    if (configObject.isFixed) {
        console.warn(`Attempted to update properties of fixed object ${objectId}. Operation cancelled.`);
        return;
    }

    console.log(`Updating ${property} for ${objectId} to ${value}`);

    switch (property) {
        case 'mass':
            if (value > 0) {
                Matter.Body.setMass(body, value);
                configObject.mass = value;
            } else {
                console.warn(`Attempted to set invalid mass (${value}) for ${objectId}.`);
            }
            break;
        case 'friction':
            body.friction = value;
            configObject.friction = value;
            break;
        case 'restitution':
            body.restitution = value;
            configObject.restitution = value;
            break;
        default:
            console.warn(`Unknown property update requested: ${property}`);
    }

}

/**
 * Gets the duration (in milliseconds) of the last physics update phase within the simulation loop.
 * This can be used for performance monitoring.
 * @returns {number} The time taken for the last physics update, in milliseconds.
 */
function getSimulationTime() {
    return lastSimulationTime;
}

/**
 * Initializes objectives based on the provided configuration.
 * Clears any existing objectives, then iterates through the `objectivesConfig` array,
 * creating instances of appropriate objective classes (e.g., `MaxHeightObjective`, `StayInZoneObjective`).
 * Finally, it creates or updates the objectives UI panel.
 * @param {Array<object>} objectivesConfig - An array of objective configuration objects
 *                                           from the main scene configuration.
 */
function initializeObjectives(objectivesConfig) {
    if (activeObjectives && activeObjectives.length > 0) {
        console.log("Disposing previous objectives...");
    activeObjectives.forEach(obj => obj.dispose());
}
activeObjectives = [];

if (!objectivesConfig || !Array.isArray(objectivesConfig) || objectivesConfig.length === 0) {
        console.log("No objectives defined in configuration.");
        createObjectivesPanel([]);
        return;
    }

    console.log(`Initializing ${objectivesConfig.length} objectives...`);
    const scene = getScene();

    objectivesConfig.forEach(config => {
        try {
            let objectiveInstance = null;
            switch (config.type) {
                case 'maxHeight':
                    if (!scene) throw new Error("Babylon scene is not available for MaxHeightObjective.");
                    if (!currentConfig?.world) throw new Error("World config is not available for MaxHeightObjective.");
                    objectiveInstance = new MaxHeightObjective(config, scene, currentConfig.world);
                    break;
                case 'stayInZone':
                    objectiveInstance = new StayInZoneObjective(config);
                    break;
                default:
                    console.warn(`Unknown objective type '${config.type}' for objective id '${config.id}'. Skipping.`);
                    break;
            }
            if (objectiveInstance) {
                activeObjectives.push(objectiveInstance);
            }
        } catch (error) {
            console.error(`Failed to initialize objective (id: ${config.id}, type: ${config.type}):`, error);
        }
    });

    createObjectivesPanel(activeObjectives);
}

export {
    initSimulation,
    getApplicationMode,
    setApplicationMode,
    toggleSimulationMode,
    triggerConfigUpdateAndReload,
    setDraggingState,
    handleConfigUpdate,
    bodies,
    currentConfig,
    cancelPlacement,
    handleRemoveItem,
    getSimulationTime
};
