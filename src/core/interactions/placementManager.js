import * as BABYLON from '@babylonjs/core';
import { getScene, getCamera } from '../sceneManager.js';
import { checkPlacementCollision, getWorldConfig } from '../physicsManager.js';
import { getMatterPointerCoordinates, setInteractionMode } from './inputManager.js';

/**
 * @module core/interactions/placementManager
 * @description Manages the visual preview and logic for placing new objects into the scene.
 * This includes creating a temporary preview mesh that follows the mouse,
 * checking for collisions and boundary violations at the potential placement location,
 * and updating the preview mesh's appearance accordingly.
 */

let placementPreviewMesh = null;
let placementPreviewProperties = null;
let placementPreviewOriginalColor = null;
const placementPreviewCollisionColor = new BABYLON.Color3(1, 0.2, 0.2);

/**
 * Creates and displays a semi-transparent preview mesh at the mouse position,
 * representing the object to be placed. Sets the interaction mode to 'place'.
 * The preview mesh's shape and initial color are determined by `objectProperties`.
 *
 * @param {object} objectProperties - Properties defining the mesh to be created for preview.
 *                                    Expected to have `type` (e.g., "box", "circle"), dimensions,
 *                                    and optionally `color`.
 */
function showPlacementPreview(objectProperties) {
    hidePlacementPreview();

    const scene = getScene();
    if (!scene || !objectProperties) return;

    let mesh;
    const meshName = "placementPreviewMesh";

    if (objectProperties.type === "box") {
        mesh = BABYLON.MeshBuilder.CreateBox(meshName, {
            width: objectProperties.width, 
            height: objectProperties.height, 
            depth: objectProperties.depth || objectProperties.width
        }, scene);
    } else if (objectProperties.type === "circle") {
        mesh = BABYLON.MeshBuilder.CreateSphere(meshName, { 
            diameter: objectProperties.radius * 2 
        }, scene);
    } else {
        console.warn("Unsupported object type for placement preview:", objectProperties.type);
        return;
    }

    const material = new BABYLON.StandardMaterial(meshName + "Mat", scene);
    const color = objectProperties.color || { r: 0.8, g: 0.8, b: 0.8 };
    material.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
    material.alpha = 0.5;
    mesh.material = material;
    mesh.isPickable = false;

    placementPreviewOriginalColor = material.diffuseColor.clone();
    placementPreviewProperties = objectProperties;
    placementPreviewMesh = mesh;
    setInteractionMode('place');

    const camera = getCamera();
    const initialCoords = getMatterPointerCoordinates(scene, camera);
    if (initialCoords && placementPreviewMesh) {
        placementPreviewMesh.position.x = initialCoords.x;
        placementPreviewMesh.position.y = initialCoords.y;
        placementPreviewMesh.position.z = 0;
    }
    console.log("Showing placement preview for:", objectProperties.type);
}

/**
 * Hides and disposes of the current placement preview mesh, if one exists.
 * Resets placement preview state variables.
 */
function hidePlacementPreview() {
    if (placementPreviewMesh) {
        console.log("Hiding placement preview.");
        placementPreviewMesh.dispose();
        placementPreviewMesh = null;
        placementPreviewProperties = null;
        placementPreviewOriginalColor = null;
    }
}

/**
 * Updates the position and appearance of the active placement preview mesh.
 * The mesh follows the provided `pointerCoords`. Its color changes to
 * `placementPreviewCollisionColor` if a collision is detected at the current
 * location or if it's outside the defined working bounds. Otherwise, it uses
 * `placementPreviewOriginalColor`.
 *
 * @param {{x: number, y: number}} pointerCoords - The current world coordinates of the pointer.
 * @returns {{isValid: boolean, mesh: BABYLON.Mesh | null, properties: object | null, position: {x: number, y: number} | null}}
 *          An object indicating the state of the preview:
 *          - `isValid`: True if placement at the current `pointerCoords` is valid (no collision, within bounds).
 *          - `mesh`: The placement preview mesh instance.
 *          - `properties`: The properties of the object being previewed.
 *          - `position`: The current world coordinates of the preview.
 *          Returns `{ isValid: false }` if no preview is active or `pointerCoords` are missing.
 */
function updatePlacementPreview(pointerCoords) {
    if (!placementPreviewMesh || !pointerCoords || !placementPreviewProperties) 
        return { isValid: false };
    
    placementPreviewMesh.position.x = pointerCoords.x;
    placementPreviewMesh.position.y = pointerCoords.y;
    placementPreviewMesh.position.z = 0;

    const worldConfig = getWorldConfig();
    const wb = worldConfig?.workingBounds;
    let isOutsideBounds = true;
    if (wb) {
        isOutsideBounds = pointerCoords.x < wb.x || pointerCoords.x > wb.x + wb.width ||
                         pointerCoords.y < wb.y || pointerCoords.y > wb.y + wb.height;
    } else {
        console.warn("Working bounds not found in world config for placement check.");
    }

    const collisionDetected = checkPlacementCollision(placementPreviewProperties, pointerCoords);

    if (placementPreviewMesh.material && placementPreviewOriginalColor) {
        const targetColor = (collisionDetected || isOutsideBounds) ? 
                           placementPreviewCollisionColor : 
                           placementPreviewOriginalColor;
        if (!placementPreviewMesh.material.diffuseColor.equals(targetColor)) {
            placementPreviewMesh.material.diffuseColor = targetColor;
        }
    }

    return {
        isValid: !collisionDetected && !isOutsideBounds,
        mesh: placementPreviewMesh,
        properties: placementPreviewProperties,
        position: pointerCoords
    };
}

/**
 * Checks if a placement preview is currently active (i.e., a preview mesh exists).
 * @returns {boolean} True if a placement preview is active, false otherwise.
 */
function hasActivePlacementPreview() {
    return placementPreviewMesh !== null;
}

export {
    showPlacementPreview,
    hidePlacementPreview,
    updatePlacementPreview,
    hasActivePlacementPreview
};
