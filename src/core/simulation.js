/**
 * @module core/simulation
 * @description Manages the main simulation lifecycle, including initialization,
 * mode transitions (construction, simulation, configuration), physics updates,
 * mesh synchronization, UI integration, objective and condition handling,
 * and level progression. It serves as the central coordinator for various
 * sub-modules like physics, scene rendering, UI, and interactions.
 */
import * as BABYLON from '@babylonjs/core';
import * as Matter from 'matter-js';

import { initializeBabylon, createMeshes, updateMeshes, updateConstraintLines, disposeMeshes, attachPointerObservable, getScene, setSimulationMeshesActive, getEngine as getBabylonEngine, enableCameraControls, disableCameraControls, syncMeshesWithConfig } from './sceneManager.js';

import { initializePhysics, createPhysicsObjects, cleanupPhysics, updatePhysics, getPhysicsEngine, checkPlacementCollision, setSimulationBoundariesActive } from './physicsManager.js';

import { attachKeyboardListener, attachPointerListener, updateDragConstraintTarget, setInteractionMode, getInteractionMode, showPlacementPreview, hidePlacementPreview, startDragOnNewBody, clearConfigSelectionHighlight } from './interactionManager.js';

import { 
    createInventoryUI, disposeUI, createTrashCan, createTopMenuBar,
    updateTopMenuBar, createConfigPanel, showConfigPanel, hideConfigPanel,
    createObjectivesPanel, updateObjectivesPanel, updateUIContent,
    createEndMenu, showEndMenu, hideEndMenu,
    createBriefingPanel, showBriefingPanel,
    createHintPanel
} from './uiManager.js';
import { createMainMenu, showMainMenu, hideMainMenu } from './ui/mainMenu.js';
import { hideLevelSelectMenu, levelFiles } from './ui/levelSelectMenu.js';

import { MaxHeightObjective } from './objectives/MaxHeightObjective.js';
import { MinHeightObjective } from './objectives/MinHeightObjective.js';
import { StayInZoneObjective } from './objectives/StayInZoneObjective.js';
import { LeaveZoneObjective } from './objectives/LeaveZoneObjective.js';
import * as HistoryManager from './historyManager.js';
import { createSettingsMenu, hideSettingsMenu } from './ui/settingsMenuBabylon.js';

import { TimeLimitCondition } from './conditions/TimeLimitCondition.js';
import { StayInZoneEndCondition } from './conditions/StayInZoneEndCondition.js';
import { LeaveZoneEndCondition } from './conditions/LeaveZoneEndCondition.js';
import { MaxHeightEndCondition } from './conditions/MaxHeightEndCondition.js';

/** @type {object | null} The current level configuration object. */
let currentConfig = null;
/** @type {string | null} The path to the current level configuration file. */
let currentScenePath = null;
/** @type {string} The current application mode (e.g., 'construction', 'simulation', 'configuration'). */
let applicationMode = 'construction';
/** @type {string} The application mode before the current 'simulation' mode was entered. */
let previousApplicationMode = 'construction';
/** @type {boolean} Flag indicating if an object is currently being dragged, especially during paused states. */
let isDraggingInPause = false;
/** @type {object | null} The inventory item configuration selected for placement. */
let itemToPlace = null;
/** @type {number} Counter to generate unique IDs for newly placed items. */
let nextItemIdCounter = 0;
/** @type {boolean} Flag indicating if the user has closed the briefing panel for the current level. */
let briefingHasBeenClosedByUser = false;

/** @const {number} Timestep for physics updates when the simulation is running normally. */
const RUNNING_TIMESTEP = 1000 / 30;
/** @const {number} Timestep for physics updates when an object is being dragged (can be different if needed). */
const DRAGGING_TIMESTEP = RUNNING_TIMESTEP;

/** @const {number} Number of sub-steps for physics updates during normal simulation. */
const RUNNING_SUBSTEPS = 100;
/** @const {number} Number of sub-steps for physics updates during dragging. */
const DRAGGING_SUBSTEPS = 100;

/** @const {number} Minimum number of sub-steps per frame for physics updates. */
const MINIMUM_SUBSTEPS = 1;
/** @const {number} Maximum number of sub-steps per frame for physics updates. */
const MAXIMUM_SUBSTEPS = 400;

/** @type {number} The duration of the last physics simulation step in milliseconds. */
let lastSimulationTime = 0;

/** @type {Map<string, Matter.Body>} Map of object configIds to their Matter.js Bodies. */
let bodies = new Map();
/** @type {Map<string, BABYLON.Mesh>} Map of object configIds to their Babylon.js Meshes. */
let meshes = new Map();
/** @type {Map<number, BABYLON.LinesMesh>} Map of constraint indices to their Babylon.js LinesMeshes. */
let constraintLines = new Map();
/** @type {Array<Objective>} Array of active objectives for the current level. */
let activeObjectives = [];
/** @type {Array<Condition>} Array of active end conditions for the current level. */
let activeConditions = [];
/** @type {boolean} Flag indicating if the current level has ended. */
let levelEnded = false;
/** @type {number} Total time elapsed in simulation mode for the current run, in seconds. */
let totalSimulationTimeElapsed = 0;

/**
 * Handles errors during item preview (e.g., if the preview URL is empty or invalid)
 * by reloading the current simulation. This typically occurs if the inventory item
 * configuration is problematic.
 */
function handlePreviewErrorReload() {
    initSimulation(currentConfig, currentScenePath, true); 
}

/**
 * Initializes or re-initializes the simulation with a given configuration.
 * Sets up physics, Babylon.js scene, UI elements, objectives, and conditions.
 * Can be used for initial level loading or for reloading after changes (e.g., item placement/removal).
 * @param {object} config - The level configuration object.
 * @param {string} path - The path to the current level configuration file (used for saving/loading).
 * @param {boolean} [isRestoringOrReloading=false] - Flag indicating if this is a reload/restore operation.
 *                                                 If true, some initialization steps might be skipped or handled differently
 *                                                 (e.g., mesh synchronization instead of full recreation, history not cleared).
 */
function initSimulation(config, path, isRestoringOrReloading = false) {
    if (!isRestoringOrReloading) {
        HistoryManager.clearHistory();
        briefingHasBeenClosedByUser = false;
    }
    currentConfig = config;
    currentScenePath = path;
    applicationMode = 'construction';
    levelEnded = false;

    if (typeof hideMainMenu === 'function') hideMainMenu();
    if (typeof hideLevelSelectMenu === 'function') hideLevelSelectMenu();
    if (typeof hideSettingsMenu === 'function') hideSettingsMenu();
    if (typeof hideEndMenu === 'function') hideEndMenu();

    disposeUI();
    initializeBabylon(currentConfig, isRestoringOrReloading);
    enableCameraControls();
    initializePhysics(currentConfig.world);
    populateSimulation(isRestoringOrReloading);
    attachKeyboardListener();
    attachPointerListener(handlePointerInteraction);

    createInventoryUI(currentConfig, handleAddItemRequest, handlePreviewErrorReload);
    createTopMenuBar(applicationMode, setApplicationMode);
    createTrashCan();
    createConfigPanel(handleConfigUpdate);
    
    const scene = getScene();
    if (scene) {
        createSettingsMenu(scene); 
    } else {
        console.error("Cannot create settings menu: Scene not available.");
    }

    initializeObjectives(currentConfig.objectives);
    initializeConditions(currentConfig.endConditions); 

    if (typeof createEndMenu === 'function') {
        createEndMenu(handleRestartLevel);
    } else {
        console.error("createEndMenu function is not available in simulation.js. Check imports from uiManager.");
    }

    createObjectivesPanel(activeObjectives, activeConditions);

    if (currentConfig.briefingImage) {
        createBriefingPanel(currentConfig.briefingImage, () => {
            briefingHasBeenClosedByUser = true;
        });
        if (!briefingHasBeenClosedByUser) {
            showBriefingPanel();
        }
    }

    if (currentConfig.hintImagePath) {
        createHintPanel(currentConfig.hintImagePath, () => {
        });
    }

    if (scene) {
        scene.executeWhenReady(() => {
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
    } else {
        console.error("Failed to register simulation loop: Babylon scene not available.");
    }

    if (!isRestoringOrReloading) {
        HistoryManager.pushState(currentConfig); 
    }
}

/**
 * Handles pointer (mouse/touch) interactions within the simulation, primarily for item placement.
 * If in 'place' mode and a valid placement location is clicked, it attempts to place the selected item.
 * @param {BABYLON.PointerInfo} pointerInfo - Information about the pointer event.
 * @param {BABYLON.Vector3} worldCoords - The world coordinates of the pointer event.
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
        hidePlacementPreview();
        handlePlaceItem(worldCoords, itemToPlace);
        itemToPlace = null;
    }
}

/**
 * Cancels the current item placement operation.
 * Hides the placement preview and reverts the interaction mode to 'drag'.
 */
function cancelPlacement() {
    if (getInteractionMode() === 'place') {
        itemToPlace = null;
        hidePlacementPreview();
        setInteractionMode('drag');
    }
}

/**
 * Initiates an item placement request from the inventory.
 * Sets the application mode to 'construction', displays a placement preview for the selected item,
 * and sets the interaction mode to 'place'.
 * @param {object} inventoryItem - The inventory item configuration to be placed.
 * @param {string} inventoryItem.id - The base ID of the item.
 * @param {number} inventoryItem.count - The number of this item available in inventory.
 * @param {object} inventoryItem.objectProperties - The properties of the object to be created.
 */
function handleAddItemRequest(inventoryItem) {
    setApplicationMode('construction');

    if (getInteractionMode() === 'place') {
        return;
    }
    if (!inventoryItem || inventoryItem.count <= 0) {
        console.warn(`Cannot add item: Invalid item or count is zero.`);
        return;
    }

    itemToPlace = inventoryItem;
    showPlacementPreview(inventoryItem.objectProperties);
}

/**
 * Finalizes the placement of an item at the specified world coordinates.
 * Decrements the item count in the inventory, creates the physical body and visual mesh
 * for the new object, adds it to the simulation, and saves the updated configuration.
 * @param {BABYLON.Vector3} position - The world coordinates where the item will be placed.
 * @param {object} inventoryItem - The inventory item configuration that was selected for placement.
 */
function handlePlaceItem(position, inventoryItem) {
    if (!currentConfig || !inventoryItem) return;

    HistoryManager.pushState(currentConfig); 

    const invItem = currentConfig.inventory.find(i => i.id === inventoryItem.id);
    if (!invItem || invItem.count <= 0) {
        console.error(`Cannot place item ${inventoryItem.id}: not found or zero count.`);
        setInteractionMode('drag');
        return;
    }

    invItem.count--;

    let newObjectId;
    let currentSuffixToTry = nextItemIdCounter;
    const baseId = inventoryItem.id;
    const existingIds = new Set(currentConfig.objects.map(obj => obj.id));

    while (true) {
        newObjectId = `${baseId}_${currentSuffixToTry}`;
        if (!existingIds.has(newObjectId)) {
            break;
        }
        currentSuffixToTry++;
    }
    nextItemIdCounter = currentSuffixToTry + 1;

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

    if (currentScenePath && currentConfig) {
        try {
            const storageKey = `puzzleshape_config_${currentScenePath}`;
            localStorage.setItem(storageKey, JSON.stringify(currentConfig));
        } catch (e) {
            console.warn("[handlePlaceItem] Failed to save config to localStorage:", e);
        }
    }

    setInteractionMode('drag');
    setApplicationMode('construction');
    startDragOnNewBody(body, mesh, position);
}

/**
 * Removes an object from the simulation.
 * Updates the configuration, increments the corresponding item count in the inventory (if applicable),
 * saves the configuration, and reloads the simulation.
 * @param {string} objectId - The ID of the object to be removed.
 */
function handleRemoveItem(objectId) {
    if (!currentConfig) return;
    HistoryManager.pushState(currentConfig); 

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

    currentConfig.objects.splice(objectIndex, 1)[0];

    const inventoryIdMatch = objectId.match(/^([a-zA-Z0-9_]+?)_\d+$/);
    if (inventoryIdMatch) {
        const baseInventoryId = inventoryIdMatch[1];
        const itemInInventory = currentConfig.inventory.find(i => i.id === baseInventoryId);
        if (itemInInventory) {
            itemInInventory.count++;
        } else {
             console.warn(`Removed object ${objectId} looked like an inventory item, but base ID ${baseInventoryId} not found in inventory.`);
        }
    }

    if (currentScenePath && currentConfig) {
        try {
            const storageKey = `puzzleshape_config_${currentScenePath}`;
            localStorage.setItem(storageKey, JSON.stringify(currentConfig));
        } catch (e) {
            console.warn("[handleRemoveItem] Failed to save config to localStorage:", e);
        }
    }

    initSimulation(currentConfig, currentScenePath, true); 
}

/**
 * Populates the simulation with physical bodies and visual meshes based on the current configuration.
 * This function is called during `initSimulation`. If `isRestoringOrReloading` is true,
 * it attempts to synchronize existing meshes with the configuration rather than recreating them all.
 * @param {boolean} [isRestoringOrReloading=false] - Flag indicating if this is a reload/restore operation.
 */
function populateSimulation(isRestoringOrReloading = false) {
    cleanupPhysics();
    initializePhysics(currentConfig.world);

    const physicsResult = createPhysicsObjects(currentConfig.objects, currentConfig.constraints, currentConfig.world);
    bodies = physicsResult.bodies;

    if (isRestoringOrReloading) {
        const { meshes: updatedMeshes, constraintLines: updatedConstraintLines } = syncMeshesWithConfig(
            currentConfig.objects,
            currentConfig.constraints,
            currentConfig.world,
            meshes,
            constraintLines
        );
        meshes = updatedMeshes;
        constraintLines = updatedConstraintLines;
    } else {
        disposeMeshes(meshes, constraintLines);
        const sceneResult = createMeshes(currentConfig.objects, currentConfig.constraints, currentConfig.world);
        meshes = sceneResult.meshes;
        constraintLines = sceneResult.constraintLines;
    }
}

/**
 * The main simulation loop, executed on every frame.
 * Updates physics, synchronizes meshes, and manages game logic like objectives and conditions
 * based on the current application mode.
 */
function simulationLoop() {
    if (!currentConfig) {
        return;
    }

    if (isDraggingInPause) {
        updateDragConstraintTarget();
    }

    const simStartTime = performance.now();

    if (applicationMode === 'simulation') {
        const subStepDelta = RUNNING_TIMESTEP / RUNNING_SUBSTEPS;
        let step = DRAGGING_SUBSTEPS * getScene().getAnimationRatio();
        step = Math.max(step, MINIMUM_SUBSTEPS);
        step = Math.min(step, MAXIMUM_SUBSTEPS);
        for (let i = 0; i < step; i++) {
            updatePhysics(subStepDelta);
        }
    } else if (isDraggingInPause && (applicationMode === 'construction' || applicationMode === 'configuration')) {
        const subStepDelta = DRAGGING_TIMESTEP / DRAGGING_SUBSTEPS;
        let step = DRAGGING_SUBSTEPS * getScene().getAnimationRatio();
        step = Math.max(step, MINIMUM_SUBSTEPS);
        step = Math.min(step, MAXIMUM_SUBSTEPS);
         for (let i = 0; i < step; i++) {
            updatePhysics(subStepDelta);
        }
    }

    lastSimulationTime = performance.now() - simStartTime;

    updateMeshes(meshes, bodies);
    updateConstraintLines(constraintLines, currentConfig.constraints, bodies);

    if (applicationMode === 'simulation' && !levelEnded) {
        const deltaTime = getBabylonEngine().getDeltaTime() / 1000; 
        totalSimulationTimeElapsed += deltaTime;

        if (activeObjectives.length > 0) {
            activeObjectives.forEach(objective => {
                if (!objective.isComplete && !objective.isFailed) { 
                    objective.update(bodies, deltaTime, totalSimulationTimeElapsed);
                }
            });
        }

        if (activeConditions.length > 0) {
            activeConditions.forEach(condition => {
                if (!condition.isMet) { 
                    condition.update(bodies, activeObjectives, deltaTime);
                }
            });
        }
        
        if (activeObjectives.length > 0 || activeConditions.length > 0) {
            updateObjectivesPanel(activeObjectives, activeConditions);
        }

        if (activeConditions.length > 0) {
            for (const condition of activeConditions) {
                if (condition.isMet) {
                    triggerLevelEnd(condition);
                    break; 
                }
            }
        }
    }
}

/**
 * Gets the current application mode.
 * @returns {string} The current application mode (e.g., 'construction', 'simulation').
 */
function getApplicationMode() {
    return applicationMode;
}

/**
 * Sets the current application mode (e.g., 'construction', 'simulation', 'configuration').
 * Manages UI updates, interaction mode changes, and simulation state transitions
 * associated with switching modes.
 * @param {string} newMode - The new application mode to set.
 */
function setApplicationMode(newMode) {
    if (newMode === applicationMode) return;

    const previousMode = applicationMode;
    applicationMode = newMode;

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
        totalSimulationTimeElapsed = 0;
        if (activeConditions.length > 0) {
            activeConditions.forEach(condition => condition.reset());
        }
        if (activeObjectives.length > 0) {
            activeObjectives.forEach(objective => objective.reset());
        }
        if (typeof hideEndMenu === 'function') {
            hideEndMenu();
        } else {
            console.error("hideEndMenu function is not available in simulation.js. Check imports from uiManager.");
        }
        if (activeObjectives.length > 0 || activeConditions.length > 0) {
            updateObjectivesPanel(activeObjectives, activeConditions);
        }

    } else if (previousMode === 'simulation' && (newMode === 'construction' || newMode === 'configuration')) {
        setSimulationBoundariesActive(false);
        setSimulationMeshesActive(false);
        bodies.forEach(body => {
            if (body && !body.isStatic && body.initialConfig) {
                Matter.Body.setPosition(body, body.initialConfig.position);
                Matter.Body.setAngle(body, body.initialConfig.angle);
                Matter.Body.setVelocity(body, { x: 0, y: 0 });
                Matter.Body.setAngularVelocity(body, 0);
            }
        });
        if (activeObjectives.length > 0 || activeConditions.length > 0) { 
            activeObjectives.forEach(objective => objective.reset());
            updateObjectivesPanel(activeObjectives, activeConditions); 
        }
    }

    // No specific console log needed for entering configuration mode, handled by UI changes.
}

/**
 * Toggles the simulation mode between 'simulation' and the previous mode (construction/configuration).
 * If the level has ended and the mode is 'simulation', it restarts the level.
 */
function toggleSimulationMode() {
    if (applicationMode === 'simulation') {
        if (levelEnded) {
            handleRestartLevel();
        } else {
            setApplicationMode(previousApplicationMode); 
        }
    } else if (applicationMode === 'construction' || applicationMode === 'configuration') {
        previousApplicationMode = applicationMode; 
        setApplicationMode('simulation');
    }
}

/**
 * Updates the configuration of an object (position, angle) after an interaction (e.g., drag completion)
 * and reloads the simulation to reflect the changes.
 * Saves the updated configuration to localStorage.
 * @param {string} bodyId - The ID of the object whose configuration is to be updated.
 * @param {BABYLON.Vector3} finalPosition - The new position of the object.
 * @param {number} finalAngle - The new angle of the object.
 */
function triggerConfigUpdateAndReload(bodyId, finalPosition, finalAngle) {
    if (!currentConfig) return;
    HistoryManager.pushState(currentConfig); 

    const objectInConfig = currentConfig.objects.find(o => o.id === bodyId);
    if (!objectInConfig) {
        console.error(`Could not find object with ID ${bodyId} in config to update.`);
        return;
    }

    if (!objectInConfig.isFixed) {
        objectInConfig.x = finalPosition.x;
        objectInConfig.y = finalPosition.y;
        objectInConfig.angle = finalAngle;
    } else {
        // For fixed objects, we still reload to reset their visual position if moved by physics temporarily.
    }

    if (currentScenePath && currentConfig) {
        try {
            const storageKey = `puzzleshape_config_${currentScenePath}`;
            localStorage.setItem(storageKey, JSON.stringify(currentConfig));
        } catch (e) {
            console.warn("[triggerConfigUpdateAndReload] Failed to save config to localStorage:", e);
        }
    }

    initSimulation(currentConfig, currentScenePath, true); 
}

/**
 * Sets the state indicating whether an object is currently being dragged,
 * particularly for managing physics updates during paused states.
 * @param {boolean} isDragging - True if an object is being dragged, false otherwise.
 */
function setDraggingState(isDragging) {
    isDraggingInPause = isDragging;
}

/**
 * Handles updates to an object's configurable properties (e.g., mass, friction, restitution)
 * from the configuration panel. Updates both the physics body and the stored configuration.
 * Saves the updated configuration to localStorage.
 * @param {string} objectId - The ID of the object being configured.
 * @param {string} property - The name of the property to update.
 * @param {number|string} value - The new value for the property.
 */
function handleConfigUpdate(objectId, property, value) {
    HistoryManager.pushState(currentConfig); 
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
    if (currentScenePath && currentConfig) {
        try {
            const storageKey = `puzzleshape_config_${currentScenePath}`;
            localStorage.setItem(storageKey, JSON.stringify(currentConfig));
        } catch (e) {
            console.warn("[handleConfigUpdate] Failed to save config to localStorage:", e);
        }
    }
}

/**
 * Gets the time taken for the last physics simulation step.
 * @returns {number} The duration of the last simulation step in milliseconds.
 */
function getSimulationTime() {
    return lastSimulationTime;
}

/**
 * Initializes objectives based on the provided configuration.
 * Clears any existing objectives and creates new instances for each objective defined in the level config.
 * @param {Array<object>} objectivesConfig - An array of objective configuration objects.
 */
function initializeObjectives(objectivesConfig) {
    if (activeObjectives && activeObjectives.length > 0) {
        activeObjectives.forEach(obj => obj.dispose());
    }
    activeObjectives = [];

    if (!objectivesConfig || !Array.isArray(objectivesConfig) || objectivesConfig.length === 0) {
        return;
    }

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
                case 'minHeight':
                    if (!scene) throw new Error("Babylon scene is not available for MinHeightObjective.");
                    if (!currentConfig?.world) throw new Error("World config is not available for MinHeightObjective.");
                    objectiveInstance = new MinHeightObjective(config, scene, currentConfig.world);
                    break;
                case 'stayInZone':
                    objectiveInstance = new StayInZoneObjective(config);
                    break;
                case 'leaveZone':
                    objectiveInstance = new LeaveZoneObjective(config);
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
}

/**
 * Initializes end conditions based on the provided configuration.
 * Clears any existing conditions and creates new instances for each condition defined in the level config.
 * @param {Array<object>} conditionsConfig - An array of end condition configuration objects.
 */
function initializeConditions(conditionsConfig) {
    if (activeConditions && activeConditions.length > 0) {
        activeConditions.forEach(cond => cond.dispose());
    }
    activeConditions = [];
    levelEnded = false; 

    if (!conditionsConfig || !Array.isArray(conditionsConfig) || conditionsConfig.length === 0) {
        return;
    }

    conditionsConfig.forEach(config => {
        try {
            let conditionInstance = null;
            switch (config.type) {
                case 'timeLimit':
                    conditionInstance = new TimeLimitCondition(config);
                    break;
                case 'stayInZoneEnd':
                    conditionInstance = new StayInZoneEndCondition(config);
                    break;
                case 'leaveZoneEnd':
                    conditionInstance = new LeaveZoneEndCondition(config);
                    break;
                case 'maxHeightEnd':
                    conditionInstance = new MaxHeightEndCondition(config);
                    break;
                default:
                    console.warn(`Unknown end condition type '${config.type}' for id '${config.id}'. Skipping.`);
                    break;
            }
            if (conditionInstance) {
                activeConditions.push(conditionInstance);
            }
        } catch (error) {
            console.error(`Failed to initialize end condition (id: ${config.id}, type: ${config.type}):`, error);
        }
    });
}

/**
 * Triggers the end of the level when a condition is met.
 * Sets the `levelEnded` flag, calculates scores/stars for objectives,
 * attempts to unlock the next level if all objectives are complete, and shows the end menu.
 * @param {object} metCondition - The condition object that triggered the level end.
 * @param {string} metCondition.displayName - The display name of the met condition.
 * @param {string} metCondition.id - The ID of the met condition.
 */
function triggerLevelEnd(metCondition) {
    if (levelEnded) return; 

    levelEnded = true;
    disableCameraControls();

    const finalSimTime = totalSimulationTimeElapsed;

    activeObjectives.forEach(obj => {
        if (typeof obj.calculateStars === 'function') {
            obj.calculateStars(finalSimTime);
        }
        if (obj.starsEarned > 0) {
            obj.isComplete = true;
        } else {
            obj.isComplete = false;
        }
    });

    const allObjectivesComplete = activeObjectives.every(obj => obj.isComplete);

    const objectivesData = activeObjectives.map(obj => obj.getStatus());

    if (allObjectivesComplete && currentScenePath) {
        const currentLevelIndex = levelFiles.findIndex(file => file === currentScenePath);
        if (currentLevelIndex !== -1) {
            const unlockedLevelIndex = parseInt(localStorage.getItem('unlockedLevelIndex') || '0', 10);
            if (currentLevelIndex + 1 > unlockedLevelIndex) {
                const newUnlockedLevelIndex = currentLevelIndex + 1;
                localStorage.setItem('unlockedLevelIndex', newUnlockedLevelIndex.toString());
            }
        } else {
            console.warn(`Current scene path ${currentScenePath} not found in levelFiles array. Cannot unlock next level.`);
        }
    }

    if (typeof showEndMenu === 'function') {
        showEndMenu(objectivesData);
    } else {
        console.error("showEndMenu function is not available in simulation.js. Check imports from uiManager.");
    }
}

/**
 * Restarts the current level.
 * Hides the end menu (if visible) and re-initializes the simulation with the current configuration.
 */
function handleRestartLevel() {
    if (typeof hideEndMenu === 'function') {
        hideEndMenu();
    } else {
        console.error("hideEndMenu function is not available in simulation.js. Check imports from uiManager.");
    }
    initSimulation(currentConfig, currentScenePath, true); 
}

/**
 * Handles the manual triggering of a level end condition via UI.
 * This function is kept for potential future use or different types of manual triggers,
 * but for TimeLimitCondition, the button now calls condition.triggerManually() directly.
 * @param {string} conditionId - The ID of the condition to trigger.
 */
function handleManualLevelEndTrigger(conditionId) {
    const condition = activeConditions.find(c => c.id === conditionId);
    if (condition) {
        if (typeof condition.triggerManually === 'function') {
            condition.triggerManually();
        } else if (condition.config && condition.config.awaitsManualTrigger) {
            condition.isMet = true; 
        } else {
            console.warn(`Attempted to manually trigger condition ${conditionId}, but it's not configured for manual trigger or config is missing.`);
        }
    } else {
        console.error(`Attempted to manually trigger non-existent condition ID: ${conditionId}`);
    }
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
    currentScenePath, 
    cancelPlacement,
    handleRemoveItem,
    getSimulationTime,
    handleManualLevelEndTrigger,
    returnToMainMenu,
    isSimulationRunning,
};

/**
 * Disposes of the current simulation and returns to the main menu.
 */
function returnToMainMenu() {
    const scene = getScene();
    if (scene && scene.onBeforeRenderObservable.hasObservers()) {
        scene.onBeforeRenderObservable.removeCallback(simulationLoop);
    }

    cleanupPhysics();
    disposeMeshes(meshes, constraintLines);
    disposeUI();

    currentConfig = null;
    currentScenePath = null;
    levelEnded = false;
    applicationMode = 'construction';
    disableCameraControls();

    const currentSceneInstance = getScene(); // Use a different name to avoid conflict with outer scope `scene`
    if (currentSceneInstance) {
        if (typeof hideLevelSelectMenu === 'function') hideLevelSelectMenu();
        if (typeof hideSettingsMenu === 'function') hideSettingsMenu();
        if (typeof hideEndMenu === 'function') hideEndMenu();
        
        showMainMenu();
        createSettingsMenu(currentSceneInstance); 
    } else {
        console.error("Babylon scene not available for recreating main menu.");
    }
}

/**
 * Checks if the simulation is currently running in an active gameplay state.
 * @returns {boolean} True if the application mode is 'simulation' and the level has not ended.
 */
function isSimulationRunning() {
    return applicationMode === 'simulation' && !levelEnded;
}
