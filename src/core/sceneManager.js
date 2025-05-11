import * as BABYLON from '@babylonjs/core';
import { createOldTVPostProcess } from './postProcess/oldTV.js';
import { getSimulationTime } from './simulation.js';

let babylonEngine = null;
let currentScene = null;
let activeCamera = null;
let canvas = null;
let boundaryMeshes = { working: [], sim: [] };

let fpsCounterSpan = null;
let frameTimeSpan = null;
let simTimeSpan = null;

const highlightColor = new BABYLON.Color3(1, 1, 0);
const collisionHighlightColor = new BABYLON.Color3(1, 0, 0);

/**
 * Initializes the Babylon.js engine and scene.
 * Sets up the main camera, lighting, a visual back wall, and the render loop.
 * Also initializes UI elements for displaying performance statistics and creates static boundary meshes.
 * This function should be called once at the beginning of the application.
 * @param {object} initialConfig - The initial world configuration.
 * @param {object} [initialConfig.world] - Configuration for the world, including bounds.
 * @param {object} [initialConfig.world.workingBounds] - Defines the primary interaction area.
 * @param {number} [initialConfig.world.workingBounds.x=0] - X-coordinate of the top-left corner of working bounds.
 * @param {number} [initialConfig.world.workingBounds.y=0] - Y-coordinate of the top-left corner of working bounds.
 * @param {number} [initialConfig.world.workingBounds.width=800] - Width of the working bounds.
 * @param {number} [initialConfig.world.workingBounds.height=600] - Height of the working bounds.
 * @param {number} [initialConfig.world.wallThickness=60] - Visual thickness for walls.
 */
function initializeBabylon(initialConfig) {
    if (babylonEngine) return;

    canvas = document.getElementById("renderCanvas");
    if (!canvas) {
        console.error("Canvas element #renderCanvas not found!");
        return;
    }

    console.log("Initializing Babylon Engine and Scene...");
    babylonEngine = new BABYLON.Engine(canvas, true);
    currentScene = new BABYLON.Scene(babylonEngine);
    currentScene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.1, 1);

    const {
        workingBounds = { x: 0, y: 0, width: 800, height: 600 },
        wallThickness = 60
    } = initialConfig.world || {};
    const cameraTarget = new BABYLON.Vector3(workingBounds.x + workingBounds.width / 2, workingBounds.y + workingBounds.height / 2, 0);
    activeCamera = new BABYLON.ArcRotateCamera(
        "camera", Math.PI / 2, Math.PI / 2.5, 1200,
        cameraTarget,
        currentScene
    );
    activeCamera.lowerRadiusLimit = Math.max(workingBounds.width, workingBounds.height) * 0.2;
    activeCamera.upperRadiusLimit = Math.max(workingBounds.width, workingBounds.height) * 2.5;
    activeCamera.attachControl(canvas, true);
    activeCamera.inputs.attached.pointers.buttons = [2];

    activeCamera.inputs.attached.pointers.angularSensibilityX = 0;
    activeCamera.inputs.attached.pointers.angularSensibilityY = 0;
    activeCamera.inputs.attached.pointers.axisMovement = false;
    activeCamera.inputs.attached.pointers.panningSensibility = 25;

    if (activeCamera.inputs.attached.mousewheel) {
        activeCamera.inputs.attached.mousewheel.wheelPrecision = 0.5;
        activeCamera.inputs.attached.mousewheel.detachControl(canvas);
    }

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), currentScene);
    light.intensity = 0.7;
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), currentScene);
    dirLight.intensity = 0.5;

     const backWall = BABYLON.MeshBuilder.CreatePlane("backWall", {
         width: workingBounds.width + 2 * wallThickness,
         height: workingBounds.height + 2 * wallThickness
        }, currentScene);
     backWall.position.x = workingBounds.x + workingBounds.width / 2;
     backWall.position.y = workingBounds.y + workingBounds.height / 2;
     backWall.position.z = -100;
     const backMaterial = new BABYLON.StandardMaterial("backMat", currentScene);
     backMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.3);
     backMaterial.isPickable = false;
     backWall.material = backMaterial;

    babylonEngine.runRenderLoop(() => {
        if (currentScene) {
            currentScene.render();
        }
    });

    window.addEventListener("resize", () => {
        if (babylonEngine) {
            babylonEngine.resize();
        }
    });

    createOldTVPostProcess(activeCamera);

    fpsCounterSpan = document.getElementById("fps-counter");
    frameTimeSpan = document.getElementById("frame-time");
    simTimeSpan = document.getElementById("sim-time");

    currentScene.onAfterRenderObservable.add(() => {
        if (fpsCounterSpan) {
            fpsCounterSpan.textContent = babylonEngine.getFps().toFixed(0);
        }
        if (frameTimeSpan) {
            frameTimeSpan.textContent = babylonEngine.getDeltaTime().toFixed(1);
        }
        if (simTimeSpan) {
            simTimeSpan.textContent = getSimulationTime().toFixed(1);
        }
    });

    _createBoundaryMeshes(initialConfig.world);

    console.log("Babylon Engine and Scene initialized.");
}

/**
 * Internal function to create visual meshes for working and simulation boundaries.
 * These meshes are static and created once during initialization.
 * @private
 * @param {object} worldConfig - The world configuration object.
 * @param {object} [worldConfig.workingBounds] - Defines the primary interaction area.
 * @param {object} [worldConfig.simulationBounds] - Defines the broader simulation area.
 * @param {number} [worldConfig.wallThickness=60] - Visual thickness for boundary walls.
 */
function _createBoundaryMeshes(worldConfig) {
    if (!currentScene) return;
    console.log("Creating boundary meshes...");
    boundaryMeshes = { working: [], sim: [] };

    const {
        workingBounds = { x: 0, y: 0, width: 800, height: 600 },
        simulationBounds = { x: -100, y: -100, width: 1000, height: 800 },
        wallThickness = 60
    } = worldConfig || {};

    const workingMat = new BABYLON.StandardMaterial("workingBoundMat", currentScene);
    workingMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    workingMat.alpha = 0.7;

    const simMat = new BABYLON.StandardMaterial("simBoundMat", currentScene);
    simMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.6);
    simMat.alpha = 0.5;

    const boundaryDepth = 50;

    const createBoundaryMesh = (id, x, y, w, h, type, material, isVisibleInitially) => {
        const meshName = `mesh_boundary_${type}_${id}`;
        const mesh = BABYLON.MeshBuilder.CreateBox(meshName, { width: w, height: h, depth: boundaryDepth }, currentScene);
        mesh.position = new BABYLON.Vector3(x, y, -boundaryDepth / 2);
        mesh.material = material;
        mesh.isPickable = false;
        mesh.setEnabled(isVisibleInitially);
        boundaryMeshes[type].push(mesh);
    };

    const wb = workingBounds;
    createBoundaryMesh('ground', wb.x + wb.width / 2, wb.y + wb.height + wallThickness / 2, wb.width + 2 * wallThickness, wallThickness, 'working', workingMat, true);
    createBoundaryMesh('ceiling', wb.x + wb.width / 2, wb.y - wallThickness / 2, wb.width + 2 * wallThickness, wallThickness, 'working', workingMat, true);
    createBoundaryMesh('leftWall', wb.x - wallThickness / 2, wb.y + wb.height / 2, wallThickness, wb.height, 'working', workingMat, true);
    createBoundaryMesh('rightWall', wb.x + wb.width + wallThickness / 2, wb.y + wb.height / 2, wallThickness, wb.height, 'working', workingMat, true);

    const sb = simulationBounds;
    createBoundaryMesh('ground', sb.x + sb.width / 2, sb.y + sb.height + wallThickness / 2, sb.width + 2 * wallThickness, wallThickness, 'sim', simMat, true);
    createBoundaryMesh('ceiling', sb.x + sb.width / 2, sb.y - wallThickness / 2, sb.width + 2 * wallThickness, wallThickness, 'sim', simMat, true);
    createBoundaryMesh('leftWall', sb.x - wallThickness / 2, sb.y + sb.height / 2, wallThickness, sb.height, 'sim', simMat, true);
    createBoundaryMesh('rightWall', sb.x + sb.width + wallThickness / 2, sb.y + sb.height / 2, wallThickness, sb.height, 'sim', simMat, true);
}

/**
 * Creates Babylon.js visual meshes for dynamic objects and constraints based on their configurations.
 * Object meshes are created based on type (box, circle) and properties from `objectsConfig`.
 * Constraint lines are created as visual representations of physical constraints.
 * @param {Array<object>} objectsConfig - Array of configuration objects for each dynamic object.
 * @param {Array<object>} constraintsConfig - Array of configuration objects for each constraint.
 * @param {object} worldConfig - The world configuration (currently unused in this function but passed for consistency).
 * @returns {{meshes: Map<string, BABYLON.Mesh>, constraintLines: Map<number, BABYLON.LinesMesh>}}
 *          An object containing two maps:
 *          - `meshes`: Maps object configId to its corresponding Babylon.js Mesh.
 *          - `constraintLines`: Maps constraint index to its corresponding Babylon.js LinesMesh.
 *          Returns empty maps if the scene is not initialized.
 */
function createMeshes(objectsConfig, constraintsConfig, worldConfig) {
    if (!currentScene) return { meshes: new Map(), constraintLines: new Map() };

    const objectMeshes = new Map();
    const constraintLines = new Map();

    console.log("Creating object/constraint meshes...");

    objectsConfig.forEach(obj => {
        if (!obj.id) return;
        let mesh;
        const material = new BABYLON.StandardMaterial(`mat-${obj.id}`, currentScene);
        material.diffuseColor = new BABYLON.Color3(obj.color?.r ?? 0.5, obj.color?.g ?? 0.5, obj.color?.b ?? 0.5);

        if (typeof obj.color?.a === 'number') {
            material.alpha = obj.color.a;
        }

        if (obj.type === "box") {
            mesh = BABYLON.MeshBuilder.CreateBox(`mesh-${obj.id}`, { width: obj.width, height: obj.height, depth: obj.depth || obj.width }, currentScene);
        } else if (obj.type === "circle") {
            mesh = BABYLON.MeshBuilder.CreateSphere(`mesh-${obj.id}`, { diameter: obj.radius * 2 }, currentScene);
        }

        if (mesh) {
            mesh.material = material;
            mesh.position = new BABYLON.Vector3(obj.x, obj.y, 0);
            mesh.rotation = new BABYLON.Vector3(0, 0, obj.angle || 0);

            if (obj.isSensor === true) {
                mesh.isPickable = false;
                console.log(`Mesh ${mesh.name} set to non-pickable (isSensor).`);
            }

            objectMeshes.set(obj.id, mesh);
        }
    });

    constraintsConfig.forEach((constraint, index) => {
         if (constraint.render?.visible !== false && constraint.bodyA && constraint.bodyB) {
             const line = BABYLON.MeshBuilder.CreateLines(`constraint-${index}`, {
                 points: [BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero()],
                 updatable: true
             }, currentScene);
             const lineMaterial = new BABYLON.StandardMaterial(`constraintMat-${index}`, currentScene);
             lineMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
             line.material = lineMaterial;
             constraintLines.set(index, line);
         }
     });

    return { meshes: objectMeshes, constraintLines };
}

/**
 * Toggles the visibility of the working boundary meshes.
 * Simulation boundary meshes remain always visible.
 * @param {boolean} isActive - If true, simulation mode is considered active, so working boundaries are hidden.
 *                             If false, working boundaries are shown.
 */
function setSimulationMeshesActive(isActive) {
    if (!currentScene) return;

    boundaryMeshes.working.forEach(mesh => {
        if (mesh && !mesh.isDisposed()) {
            mesh.setEnabled(!isActive);
        }
    });
}

/**
 * Updates the positions and rotations of dynamic object meshes to match their corresponding physics bodies.
 * Static boundary meshes are not updated by this function.
 * @param {Map<string, BABYLON.Mesh>} meshes - A map of object configIds to their Babylon.js Meshes.
 * @param {Map<string, Matter.Body>} bodies - A map of object configIds (or boundary labels) to their Matter.js Bodies.
 */
function updateMeshes(meshes, bodies) {
    if (!currentScene) return;
    meshes.forEach((mesh, id) => {
        const body = bodies.get(id);
        if (body && mesh && !mesh.isDisposed()) {
            mesh.position.x = body.position.x;
            mesh.position.y = body.position.y;
            if (!body.isStatic) {
                mesh.rotation.z = body.angle;
            }
        }
    });
}

/**
 * Updates the visual representation of constraint lines to connect the current positions of their linked bodies.
 * @param {Map<number, BABYLON.LinesMesh>} lines - A map of constraint indices to their Babylon.js LinesMeshes.
 * @param {Array<object>} constraintsConfig - The original array of constraint configuration objects.
 * @param {Map<string, Matter.Body>} bodies - A map of object configIds to their Matter.js Bodies.
 */
function updateConstraintLines(lines, constraintsConfig, bodies) {
     if (!currentScene) return;
     lines.forEach((line, index) => {
         const constraintConfig = constraintsConfig[index];
         if (constraintConfig && line && !line.isDisposed()) {
             const bodyA = bodies.get(constraintConfig.bodyA);
             const bodyB = bodies.get(constraintConfig.bodyB);
             if (bodyA && bodyB) {
                 const points = [
                     new BABYLON.Vector3(bodyA.position.x, bodyA.position.y, 0),
                     new BABYLON.Vector3(bodyB.position.x, bodyB.position.y, 0)
                 ];
                 BABYLON.MeshBuilder.CreateLines(line.name, { points: points, instance: line });
             }
         }
     });
 }

/**
 * Disposes of all dynamic object meshes and constraint line meshes from the scene.
 * Static boundary meshes are not disposed by this function as they are persistent.
 * @param {Map<string, BABYLON.Mesh>} meshes - A map of object configIds to their Babylon.js Meshes.
 * @param {Map<number, BABYLON.LinesMesh>} lines - A map of constraint indices to their Babylon.js LinesMeshes.
 */
function disposeMeshes(meshes, lines) {
    console.log("Disposing meshes...");

    meshes.forEach(mesh => {
        if (mesh && !mesh.isDisposed()) mesh.dispose();
    });

    lines.forEach(line => {
        if (line && !line.isDisposed()) line.dispose();
    });

}

/**
 * Attaches an observer to the scene's pointer events.
 * @param {function(BABYLON.PointerInfo): void} callback - The function to be called when a pointer event occurs.
 *        It receives a BABYLON.PointerInfo object containing event details.
 * @returns {BABYLON.Observer<BABYLON.PointerInfo> | null} The observer instance if attached successfully, otherwise null.
 */
function attachPointerObservable(callback) {
    if (currentScene) {
        return currentScene.onPointerObservable.add(callback);
    }
    return null;
}

/**
 * Gets the current Babylon.js scene instance.
 * @returns {BABYLON.Scene | null} The current scene, or null if not initialized.
 */
function getScene() {
    return currentScene;
}

/**
 * Gets the active Babylon.js camera instance.
 * @returns {BABYLON.ArcRotateCamera | null} The active camera, or null if not initialized.
 */
function getCamera() {
    return activeCamera;
}

/**
 * Gets the HTML canvas element used for rendering.
 * @returns {HTMLCanvasElement | null} The canvas element, or null if not initialized.
 */
function getCanvas() {
    return canvas;
}

/**
 * Gets the Babylon.js engine instance.
 * @returns {BABYLON.Engine | null} The engine instance, or null if not initialized.
 */
function getEngine() {
    return babylonEngine;
}

/**
 * Highlights a given mesh by changing its diffuse color.
 * Stores and returns the original diffuse color of the mesh's material.
 * Only works for StandardMaterial or PBRMaterial.
 * @param {BABYLON.Mesh} mesh - The mesh to highlight.
 * @param {BABYLON.Color3} color - The color to apply for highlighting.
 * @returns {BABYLON.Color3 | null} The original diffuse color of the mesh if highlighting was successful, otherwise null.
 */
function highlightMesh(mesh, color) {
    if (mesh && mesh.material && !mesh.isDisposed()) {
        if (mesh.material instanceof BABYLON.StandardMaterial || mesh.material instanceof BABYLON.PBRMaterial) {
            const originalColor = mesh.material.diffuseColor?.clone();
            if (originalColor) {
                 mesh.material.diffuseColor = color;
                 return originalColor;
            }
        } else {
            console.warn(`Highlighting not supported for material type: ${mesh.material.getClassName()} on mesh ${mesh.name}`);
        }
    }
    return null;
}

/**
 * Restores the original diffuse color of a previously highlighted mesh.
 * Only works for StandardMaterial or PBRMaterial.
 * @param {BABYLON.Mesh} mesh - The mesh whose color is to be restored.
 * @param {BABYLON.Color3} originalColor - The original diffuse color to restore.
 */
function restoreMeshColor(mesh, originalColor) {
    if (mesh && mesh.material && !mesh.isDisposed() && originalColor) {
         if (mesh.material instanceof BABYLON.StandardMaterial || mesh.material instanceof BABYLON.PBRMaterial) {
            mesh.material.diffuseColor = originalColor;
        }
    }
}

/**
 * Finds a Babylon.js mesh that corresponds to a given Matter.js physics body.
 * This relies on a naming convention where the mesh name is `mesh-{body.configId}`.
 * Boundary bodies do not have `configId` and will return null.
 * @param {Matter.Body} body - The Matter.js body for which to find the corresponding mesh.
 * @returns {BABYLON.Mesh | null} The Babylon.js mesh if found, otherwise null.
 */
function findMeshByBody(body) {
    if (!body || !body.configId || !currentScene) {
        if (body.label && body.label.startsWith('boundary_')) return null;
        return null;
    }
    const meshName = `mesh-${body.configId}`;
    return currentScene.getMeshByName(meshName);
}

export {
    initializeBabylon,
    createMeshes,
    updateMeshes,
    updateConstraintLines,
    disposeMeshes,
    attachPointerObservable,
    getScene,
    getCamera,
    getCanvas,
    getEngine,
    highlightMesh,
    restoreMeshColor,
    highlightColor,
    collisionHighlightColor,
    findMeshByBody,
    setSimulationMeshesActive
};
