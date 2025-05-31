/**
 * @module core/sceneManager
 * @description Manages the Babylon.js scene, including engine setup, camera, lighting,
 * 3D model loading, mesh creation for physics objects and boundaries, and rendering.
 * It provides functions to initialize and update the visual representation of the simulation,
 * handle pointer events, and control camera interactions.
 */
import * as BABYLON from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { createBloomPostProcess } from './postProcess/bloom.js';
import { getSimulationTime } from './simulation.js';

/** @type {BABYLON.Engine | null} The Babylon.js engine instance. */
let babylonEngine = null;
/** @type {BABYLON.Scene | null} The current Babylon.js scene. */
let currentScene = null;
/** @type {BABYLON.ArcRotateCamera | null} The active camera in the scene. */
let activeCamera = null;
/** @type {HTMLCanvasElement | null} The HTML canvas element used for rendering. */
let canvas = null;
/** @type {BABYLON.ArcRotateCameraMouseWheelInput | null} Reference to the camera's mouse wheel input. */
let cameraMouseWheelInput = null;
/** @type {{working: BABYLON.Mesh[], sim: BABYLON.Mesh[]}} Stores arrays of meshes for working and simulation boundaries. */
let boundaryMeshes = { working: [], sim: [] };
/** @type {BABYLON.AbstractMesh | null} Root mesh of the loaded bedroom model. */
let bedroomModelRoot = null;
/** @const {string} Name of the root node for the 3D bedroom model. */
const bedroomModelName = "3D_Isometric_BEDROOM_root";
/** @type {any | null} Reference to the bloom post-processing effect. */
let bloomEffect = null;
/** @type {HTMLSpanElement | null} Span element to display FPS. */
let fpsCounterSpan = null;
/** @type {HTMLSpanElement | null} Span element to display frame time. */
let frameTimeSpan = null;
/** @type {HTMLSpanElement | null} Span element to display simulation time. */
let simTimeSpan = null;
/** @const {BABYLON.Color3} Default color for highlighting objects. */
const highlightColor = new BABYLON.Color3(1, 1, 0);
/** @const {BABYLON.Color3} Color for highlighting objects during a collision in placement mode. */
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
 * @param {boolean} [isRestoringOrReloading=false] - Flag to indicate if the scene is being reloaded (e.g., after object move).
 */
function initializeBabylon(initialConfig, isRestoringOrReloading = false) {
    canvas = document.getElementById("renderCanvas");
    if (!canvas) {
        console.error("Canvas element #renderCanvas not found!");
        return;
    }

    if (!babylonEngine) {
        babylonEngine = new BABYLON.Engine(canvas, true);
        currentScene = new BABYLON.Scene(babylonEngine);
        currentScene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

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
    }

    const {
        workingBounds = { x: 0, y: 0, width: 800, height: 600 },
        wallThickness = 60
    } = initialConfig.world || {};

    const cameraTarget = new BABYLON.Vector3(workingBounds.x + workingBounds.width / 2, workingBounds.y + workingBounds.height / 2, 0);

    if (!activeCamera) {
        activeCamera = new BABYLON.ArcRotateCamera(
            "camera", Math.PI / 2, Math.PI / 2.5, 1200,
            cameraTarget,
            currentScene
        );
        activeCamera.attachControl(canvas, true);
        activeCamera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
        activeCamera.inputs.attached.pointers.buttons = [2];
        activeCamera.inputs.attached.pointers.angularSensibilityX = 0;
        activeCamera.inputs.attached.pointers.angularSensibilityY = 0;
        activeCamera.inputs.attached.pointers.axisMovement = false;
        activeCamera.inputs.attached.pointers.panningSensibility = 25;
        if (activeCamera.inputs.attached.mousewheel) {
            cameraMouseWheelInput = activeCamera.inputs.attached.mousewheel;
            cameraMouseWheelInput.wheelPrecision = 0.5;
            activeCamera.inputs.remove(cameraMouseWheelInput);
        }

        if (!bloomEffect || !isRestoringOrReloading) {
            if (bloomEffect) {
                bloomEffect.updateSettings({});
            } else {
                bloomEffect = createBloomPostProcess(currentScene, activeCamera);
            }
            currentScene.bloomEffect = bloomEffect;
        }
    } else {
        if (!isRestoringOrReloading) {
            activeCamera.setTarget(cameraTarget);
            activeCamera.alpha = Math.PI / 2;
            activeCamera.beta = Math.PI / 2.5;
            activeCamera.radius = 1200;
        }
    }

    activeCamera.lowerRadiusLimit = Math.max(workingBounds.width, workingBounds.height) * 0.2;
    activeCamera.upperRadiusLimit = Math.max(workingBounds.width, workingBounds.height) * 2.5;

    if (!currentScene.getMeshByName(bedroomModelName)) {
        SceneLoader.ImportMeshAsync("", "assets/", "3D_Isometric_BEDROOM.glb", currentScene).then((result) => {
            bedroomModelRoot = result.meshes[0];
            if (bedroomModelRoot) {
                bedroomModelRoot.name = bedroomModelName;
                bedroomModelRoot.position = new BABYLON.Vector3(+500, -650, -1000);
                bedroomModelRoot.scaling.scaleInPlace(2000);
                bedroomModelRoot.rotation = new BABYLON.Vector3(0, Math.PI / 1.5, 0);

                result.meshes.forEach(mesh => {
                    mesh.isPickable = false;
                });
            }
        }).catch((error) => {
            console.error("Error loading 3D_Isometric_BEDROOM.glb:", error);
        });
    }

    const existingHemisphericLight = currentScene.getLightByName("light");
    if (existingHemisphericLight) {
        existingHemisphericLight.dispose();
    }
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), currentScene);
    light.intensity = 0.7;

    const existingDirectionalLight = currentScene.getLightByName("dirLight");
    if (existingDirectionalLight) {
        existingDirectionalLight.dispose();
    }
    const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), currentScene);
    dirLight.intensity = 0.5;

    _createBoundaryMeshes(initialConfig.world);
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

    const newWorkingMeshes = [];
    const newSimMeshes = [];
    const allCurrentlyRequiredMeshNames = new Set();

    const {
        workingBounds = { x: 0, y: 0, width: 800, height: 600 },
        simulationBounds = { x: -100, y: -100, width: 1000, height: 800 },
        wallThickness = 60
    } = worldConfig || {};

    const textureUnitSize = 100;
    const boundaryDepth = 50;
    const rectDepth = 20;

    let baseWorkingMat = currentScene.getMaterialByName("baseWorkingBoundMat");
    if (!baseWorkingMat) {
        baseWorkingMat = new BABYLON.StandardMaterial("baseWorkingBoundMat", currentScene);
        baseWorkingMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        const baseWorkingDiffuseTex = new BABYLON.Texture("assets/images/wood/plywood_diff_4k.jpg", currentScene);
        baseWorkingDiffuseTex.level = 1.8;
        baseWorkingMat.diffuseTexture = baseWorkingDiffuseTex;
        const baseWorkingNormalTex = new BABYLON.Texture("assets/images/wood/plywood_nor_gl_4k.jpg", currentScene);
        baseWorkingMat.bumpTexture = baseWorkingNormalTex;
        baseWorkingMat.alpha = 1;
    }

    let baseSimMat = currentScene.getMaterialByName("baseSimBoundMat");
    if (!baseSimMat) {
        baseSimMat = new BABYLON.StandardMaterial("baseSimBoundMat", currentScene);
        baseSimMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        const baseSimDiffuseTex = new BABYLON.Texture("assets/images/wood/plywood_diff_4k.jpg", currentScene);
        baseSimDiffuseTex.level = 1.8;
        baseSimMat.diffuseTexture = baseSimDiffuseTex;
        const baseSimNormalTex = new BABYLON.Texture("assets/images/wood/plywood_nor_gl_4k.jpg", currentScene);
        baseSimMat.bumpTexture = baseSimNormalTex;
        baseSimMat.alpha = 1;
    }

    const wb = workingBounds;
    const sb = simulationBounds;

    const boundaryElementsConfig = [
        { name: 'mesh_boundary_working_ground', type: 'working', x: wb.x + wb.width / 2, y: wb.y + wb.height + wallThickness / 2, z: -boundaryDepth / 2, w: wb.width + 2 * wallThickness, h: wallThickness, depth: boundaryDepth, rotZ: 0, baseMat: baseWorkingMat, isVisible: true },
        { name: 'mesh_boundary_working_ceiling', type: 'working', x: wb.x + wb.width / 2, y: wb.y - wallThickness / 2, z: -boundaryDepth / 2, w: wb.width + 2 * wallThickness, h: wallThickness, depth: boundaryDepth, rotZ: 0, baseMat: baseWorkingMat, isVisible: true },
        { name: 'mesh_boundary_working_leftWall', type: 'working', x: wb.x - wallThickness / 2, y: wb.y + wb.height / 2, z: -boundaryDepth / 2, w: wallThickness, h: wb.height, depth: boundaryDepth, rotZ: 0, baseMat: baseWorkingMat, isVisible: true },
        { name: 'mesh_boundary_working_rightWall', type: 'working', x: wb.x + wb.width + wallThickness / 2, y: wb.y + wb.height / 2, z: -boundaryDepth / 2, w: wallThickness, h: wb.height, depth: boundaryDepth, rotZ: 0, baseMat: baseWorkingMat, isVisible: true },
        { name: 'mesh_boundary_sim_ground', type: 'sim', x: sb.x + sb.width / 2, y: sb.y + sb.height + wallThickness / 2, z: -boundaryDepth / 2, w: sb.width + 2 * wallThickness, h: wallThickness, depth: boundaryDepth, rotZ: 0, baseMat: baseSimMat, isVisible: true },
        { name: 'mesh_boundary_sim_ceiling', type: 'sim', x: sb.x + sb.width / 2, y: sb.y - wallThickness / 2, z: -boundaryDepth / 2, w: sb.width + 2 * wallThickness, h: wallThickness, depth: boundaryDepth, rotZ: 0, baseMat: baseSimMat, isVisible: true },
        { name: 'mesh_boundary_sim_leftWall', type: 'sim', x: sb.x - wallThickness / 2, y: sb.y + sb.height / 2, z: -boundaryDepth / 2, w: wallThickness, h: sb.height, depth: boundaryDepth, rotZ: 0, baseMat: baseSimMat, isVisible: true },
        { name: 'mesh_boundary_sim_rightWall', type: 'sim', x: sb.x + sb.width + wallThickness / 2, y: sb.y + sb.height / 2, z: -boundaryDepth / 2, w: wallThickness, h: sb.height, depth: boundaryDepth, rotZ: 0, baseMat: baseSimMat, isVisible: true },
    ];

    const bottomLeftOffsetX = -150;
    const bottomLeftOffsetY = 0;
    const bottomLeftRectWidth = 300;
    const bottomLeftRectHeight = 50;
    const bottomLeftRectAngle = Math.PI / 4;
    const bottomLeftRectPosY = 0;

    boundaryElementsConfig.push({
        name: 'sim_bottom_left_rectangle', type: 'sim',
        x: sb.x + bottomLeftOffsetX, y: bottomLeftRectPosY + bottomLeftOffsetY, z: -20,
        w: bottomLeftRectWidth, h: bottomLeftRectHeight, depth: rectDepth, rotZ: bottomLeftRectAngle,
        baseMat: baseSimMat, isVisible: true, isPillar: true
    });

    const bottomRightOffsetX = -bottomLeftOffsetX;
    const bottomRightOffsetY = -bottomLeftOffsetY;
    const bottomRightRectAngle = -bottomLeftRectAngle;
    const bottomRightRectPosY = 0;

    boundaryElementsConfig.push({
        name: 'sim_bottom_right_rectangle', type: 'sim',
        x: sb.x + sb.width + bottomRightOffsetX, y: bottomRightRectPosY + bottomRightOffsetY, z: -20,
        w: bottomLeftRectWidth, h: bottomLeftRectHeight, depth: rectDepth, rotZ: bottomRightRectAngle,
        baseMat: baseSimMat, isVisible: true, isPillar: true
    });

    boundaryElementsConfig.forEach(config => {
        let mesh = currentScene.getMeshByName(config.name);
        allCurrentlyRequiredMeshNames.add(config.name);
        let recreationNeeded = false;

        if (mesh && !mesh.isDisposed()) {
            if (!mesh.metadata ||
                mesh.metadata.width !== config.w ||
                mesh.metadata.height !== config.h ||
                mesh.metadata.depth !== config.depth) {
                mesh.dispose();
                mesh = null;
            }
        } else if (mesh && mesh.isDisposed()) {
            mesh = null;
        }

        if (!mesh) {
            mesh = BABYLON.MeshBuilder.CreateBox(config.name, { width: config.w, height: config.h, depth: config.depth }, currentScene);
            mesh.metadata = { width: config.w, height: config.h, depth: config.depth };

            mesh.position.set(config.x, config.y, config.z);
            mesh.rotation.z = config.rotZ;

            const meshMaterial = config.baseMat.clone(`${config.name}_material`);
            if (config.type === 'sim' && !config.isPillar) {
                meshMaterial.diffuseColor.multiplyInPlace(new BABYLON.Color3(0.9, 0.9, 1));
            }

            if (meshMaterial.diffuseTexture && meshMaterial.diffuseTexture instanceof BABYLON.Texture) {
                meshMaterial.diffuseTexture = meshMaterial.diffuseTexture.clone();
                meshMaterial.diffuseTexture.uScale = config.w / textureUnitSize;
                meshMaterial.diffuseTexture.vScale = config.h / textureUnitSize;
                meshMaterial.diffuseTexture.uOffset = Math.random();
                meshMaterial.diffuseTexture.vOffset = Math.random();
            }
            if (meshMaterial.bumpTexture && meshMaterial.bumpTexture instanceof BABYLON.Texture) {
                meshMaterial.bumpTexture = meshMaterial.bumpTexture.clone();
                meshMaterial.bumpTexture.uScale = config.w / textureUnitSize;
                meshMaterial.bumpTexture.vScale = config.h / textureUnitSize;
                if (meshMaterial.diffuseTexture instanceof BABYLON.Texture) {
                    meshMaterial.bumpTexture.uOffset = meshMaterial.diffuseTexture.uOffset;
                    meshMaterial.bumpTexture.vOffset = meshMaterial.diffuseTexture.vOffset;
                }
            }
            mesh.material = meshMaterial;
            mesh.isPickable = false;
        } else {
            mesh.position.set(config.x, config.y, config.z);
            mesh.rotation.z = config.rotZ;

            const material = mesh.material;
            if (material && material.diffuseTexture instanceof BABYLON.Texture) {
                material.diffuseTexture.uScale = config.w / textureUnitSize;
                material.diffuseTexture.vScale = config.h / textureUnitSize;
            }
            if (material && material.bumpTexture instanceof BABYLON.Texture) {
                material.bumpTexture.uScale = config.w / textureUnitSize;
                material.bumpTexture.vScale = config.h / textureUnitSize;
            }
        }
        mesh.setEnabled(config.isVisible);

        if (config.type === 'working') {
            newWorkingMeshes.push(mesh);
        } else {
            newSimMeshes.push(mesh);
        }
    });

    const oldMeshes = [...(boundaryMeshes.working || []), ...(boundaryMeshes.sim || [])];
    oldMeshes.forEach(oldMesh => {
        if (oldMesh && !oldMesh.isDisposed() && !allCurrentlyRequiredMeshNames.has(oldMesh.name)) {
            oldMesh.dispose();
        }
    });

    boundaryMeshes.working = newWorkingMeshes;
    boundaryMeshes.sim = newSimMeshes;
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

            if (material.alpha === 1) {
                const diffuseTexture = new BABYLON.Texture("assets/images/wood/plywood_diff_4k.jpg", currentScene);
                diffuseTexture.level = 1.8;
                material.diffuseTexture = diffuseTexture;

                const normalTexture = new BABYLON.Texture("assets/images/wood/plywood_nor_gl_4k.jpg", currentScene);
                material.bumpTexture = normalTexture;
            }

        } else if (obj.type === "circle") {
            mesh = BABYLON.MeshBuilder.CreateSphere(`mesh-${obj.id}`, { diameter: obj.radius * 2 }, currentScene);
            if (material.alpha === 1) {
                const diffuseTexture = new BABYLON.Texture("assets/images/wood/plywood_diff_4k.jpg", currentScene);
                diffuseTexture.level = 1.8;
                material.diffuseTexture = diffuseTexture;

                const normalTexture = new BABYLON.Texture("assets/images/wood/plywood_nor_gl_4k.jpg", currentScene);
                material.bumpTexture = normalTexture;
            }
        }

        if (mesh) {
            mesh.material = material;
            mesh.position = new BABYLON.Vector3(obj.x, obj.y, 0);
            mesh.rotation = new BABYLON.Vector3(0, 0, obj.angle || 0);

            if (obj.isSensor === true) {
                mesh.isPickable = false;
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
 * Gets the bloom effect instance.
 * @returns {Object | null} The bloom effect instance, or null if not initialized.
 */
function getBloomEffect() {
    return bloomEffect;
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

/**
 * Enables camera controls (panning, zooming).
 */
function enableCameraControls() {
    if (activeCamera && canvas) {
        if (!activeCamera.inputs.isAttached) {
            activeCamera.attachControl(canvas, true);
        }
        setCameraMouseWheelZoomActive(true);
    }
}

/**
 * Disables camera controls (panning, zooming).
 */
function disableCameraControls() {
    if (activeCamera && canvas && activeCamera.inputs.attached.pointers) {
        activeCamera.detachControl(canvas);
    }
}

export {
    initializeBabylon,
    createMeshes,
    syncMeshesWithConfig,
    updateMeshes,
    updateConstraintLines,
    disposeMeshes,
    attachPointerObservable,
    getScene,
    getCamera,
    getBloomEffect,
    getCanvas,
    getEngine,
    highlightMesh,
    restoreMeshColor,
    highlightColor,
    collisionHighlightColor,
    findMeshByBody,
    setSimulationMeshesActive,
    enableCameraControls,
    disableCameraControls,
    setCameraMouseWheelZoomActive
};

/**
 * Activates or deactivates the camera's mouse wheel zoom functionality.
 * It manages the attachment and detachment of the mouse wheel input controller.
 * @param {boolean} isActive - True to activate mouse wheel zoom, false to deactivate.
 */
function setCameraMouseWheelZoomActive(isActive) {
    if (!activeCamera || !canvas) {
        console.warn(`SceneManager: setCameraMouseWheelZoomActive(${isActive}) - Active camera or canvas not available.`);
        return;
    }

    if (isActive) {
        if (cameraMouseWheelInput && !activeCamera.inputs.attached.mousewheel) {
            activeCamera.inputs.add(cameraMouseWheelInput);
        } else if (!cameraMouseWheelInput) {
            console.warn(`SceneManager: setCameraMouseWheelZoomActive(${isActive}) - Stored cameraMouseWheelInput is null. Cannot attach.`);
        }
    } else {
        if (activeCamera.inputs.attached.mousewheel) {
            if (!cameraMouseWheelInput) {
                cameraMouseWheelInput = activeCamera.inputs.attached.mousewheel;
            }
            activeCamera.inputs.remove(activeCamera.inputs.attached.mousewheel);
        }
    }
}

/**
 * Synchronizes Babylon.js visual meshes and constraint lines with the provided configurations.
 * Updates existing meshes, creates new ones, and disposes of meshes no longer in the config.
 * @param {Array<object>} objectsConfig - Array of configuration objects for each dynamic object.
 * @param {Array<object>} constraintsConfig - Array of configuration objects for each constraint.
 * @param {object} worldConfig - The world configuration.
 * @param {Map<string, BABYLON.Mesh>} existingObjectMeshes - Current map of object configId to its Babylon.js Mesh.
 * @param {Map<number, BABYLON.LinesMesh>} existingConstraintLines - Current map of constraint index to its Babylon.js LinesMesh.
 * @returns {{meshes: Map<string, BABYLON.Mesh>, constraintLines: Map<number, BABYLON.LinesMesh>}}
 *          An object containing two maps:
 *          - `meshes`: The updated map of object configId to its Babylon.js Mesh.
 *          - `constraintLines`: The updated map of constraint index to its Babylon.js LinesMesh.
 */
function syncMeshesWithConfig(objectsConfig, constraintsConfig, worldConfig, existingObjectMeshes, existingConstraintLines) {
    if (!currentScene) return { meshes: new Map(), constraintLines: new Map() };

    const newObjectMeshes = new Map();
    const newConstraintLines = new Map();
    const existingMeshIds = new Set(existingObjectMeshes.keys());
    const existingConstraintIndices = new Set(existingConstraintLines.keys());

    objectsConfig.forEach(obj => {
        if (!obj.id) return;

        let mesh = existingObjectMeshes.get(obj.id);
        if (mesh) {
            if (mesh.isDisposed()) {
                mesh = null;
            } else {
                mesh.position.x = obj.x;
                mesh.position.y = obj.y;
                mesh.rotation.z = obj.angle || 0;

                if (mesh.material instanceof BABYLON.StandardMaterial) {
                    const material = mesh.material;
                    material.diffuseColor.set(obj.color?.r ?? 0.5, obj.color?.g ?? 0.5, obj.color?.b ?? 0.5);

                    let newAlpha = 1;
                    if (typeof obj.color?.a === 'number') {
                        newAlpha = obj.color.a;
                    }
                    material.alpha = newAlpha;

                    if (newAlpha === 1) {
                        if (!material.diffuseTexture) {
                            const diffuseTexture = new BABYLON.Texture("assets/images/wood/plywood_diff_4k.jpg", currentScene);
                            diffuseTexture.level = 1.8;
                            material.diffuseTexture = diffuseTexture;

                            const normalTexture = new BABYLON.Texture("assets/images/wood/plywood_nor_gl_4k.jpg", currentScene);
                            material.bumpTexture = normalTexture;
                        } else if (material.diffuseTexture instanceof BABYLON.Texture && material.diffuseTexture.level !== 1.8) {
                            material.diffuseTexture.level = 1.8;
                        }
                    } else {
                        if (material.diffuseTexture) {
                            if (material.diffuseTexture.dispose) material.diffuseTexture.dispose();
                            material.diffuseTexture = null;
                        }
                        if (material.bumpTexture) {
                            if (material.bumpTexture.dispose) material.bumpTexture.dispose();
                            material.bumpTexture = null;
                        }
                    }
                }
                newObjectMeshes.set(obj.id, mesh);
                existingMeshIds.delete(obj.id);
            }
        }

        if (!mesh) {
            const material = new BABYLON.StandardMaterial(`mat-${obj.id}`, currentScene);
            material.diffuseColor = new BABYLON.Color3(obj.color?.r ?? 0.5, obj.color?.g ?? 0.5, obj.color?.b ?? 0.5);
            if (typeof obj.color?.a === 'number') {
                material.alpha = obj.color.a;
            }

            if (obj.type === "box") {
                mesh = BABYLON.MeshBuilder.CreateBox(`mesh-${obj.id}`, { width: obj.width, height: obj.height, depth: obj.depth || obj.width }, currentScene);
                if (material.alpha === 1) {
                    const diffuseTexture = new BABYLON.Texture("assets/images/wood/plywood_diff_4k.jpg", currentScene);
                    diffuseTexture.level = 0.7; // Corrected from 1.8 to 0.7 as per original logic for new meshes
                    material.diffuseTexture = diffuseTexture;

                    const normalTexture = new BABYLON.Texture("assets/images/wood/plywood_nor_gl_4k.jpg", currentScene);
                    material.bumpTexture = normalTexture;
                }

            } else if (obj.type === "circle") {
                mesh = BABYLON.MeshBuilder.CreateSphere(`mesh-${obj.id}`, { diameter: obj.radius * 2 }, currentScene);
                if (material.alpha === 1) {
                    const diffuseTexture = new BABYLON.Texture("assets/images/wood/plywood_diff_4k.jpg", currentScene);
                    diffuseTexture.level = 0.7; // Corrected from 1.8 to 0.7
                    material.diffuseTexture = diffuseTexture;

                    const normalTexture = new BABYLON.Texture("assets/images/wood/plywood_nor_gl_4k.jpg", currentScene);
                    material.bumpTexture = normalTexture;
                }
            }

            if (mesh) {
                mesh.material = material;
                mesh.position = new BABYLON.Vector3(obj.x, obj.y, 0);
                mesh.rotation = new BABYLON.Vector3(0, 0, obj.angle || 0);
                if (obj.isSensor === true) {
                    mesh.isPickable = false;
                }
                newObjectMeshes.set(obj.id, mesh);
            }
        }
    });

    existingMeshIds.forEach(idToRemove => {
        const meshToDispose = existingObjectMeshes.get(idToRemove);
        if (meshToDispose && !meshToDispose.isDisposed()) {
            meshToDispose.dispose();
        }
    });

    constraintsConfig.forEach((constraint, index) => {
        let line = existingConstraintLines.get(index);

        if (constraint.render?.visible !== false && constraint.bodyA && constraint.bodyB) {
            if (line) {
                 if (line.isDisposed()) {
                    line = null;
                } else {
                    newConstraintLines.set(index, line);
                    existingConstraintIndices.delete(index);
                }
            }

            if (!line) {
                line = BABYLON.MeshBuilder.CreateLines(`constraint-${index}`, {
                    points: [BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero()],
                    updatable: true
                }, currentScene);
                const lineMaterial = new BABYLON.StandardMaterial(`constraintMat-${index}`, currentScene);
                lineMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
                line.material = lineMaterial;
                newConstraintLines.set(index, line);
            }
        } else {
            if (line && !line.isDisposed()) {
                line.dispose();
            }
            existingConstraintIndices.delete(index); // Ensure it's removed if not visible or invalid
        }
    });

    existingConstraintIndices.forEach(indexToRemove => {
        const lineToDispose = existingConstraintLines.get(indexToRemove);
        if (lineToDispose && !lineToDispose.isDisposed()) {
            lineToDispose.dispose();
        }
    });

    return { meshes: newObjectMeshes, constraintLines: newConstraintLines };
}
