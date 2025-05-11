import * as BABYLON from '@babylonjs/core';
import { highlightMesh, restoreMeshColor } from '../sceneManager.js';
import { showConfigPanel, hideConfigPanel } from '../uiManager.js';

/**
 * @module core/interactions/configManager
 * @description Manages the selection and configuration of scene objects.
 * This module handles highlighting selected objects, displaying a configuration panel
 * with their properties, and restoring their appearance when deselected or when
 * configuration is cancelled.
 */

let configSelectedMesh = null;
let configSelectedMeshOriginalColor = null;
const configHighlightColor = new BABYLON.Color3(1, 1, 0);

/**
 * Clears the highlight from the currently selected mesh for configuration, if any.
 * Restores its original color and resets selection variables.
 */
function clearConfigSelectionHighlight() {
    if (configSelectedMesh && configSelectedMeshOriginalColor) {
        restoreMeshColor(configSelectedMesh, configSelectedMeshOriginalColor);
    }
    configSelectedMesh = null;
    configSelectedMeshOriginalColor = null;
}

/**
 * Selects a mesh for configuration.
 * It clears any previous selection, highlights the new mesh, and displays the
 * configuration panel populated with the object's properties and optional limits.
 *
 * @param {BABYLON.Mesh} mesh - The Babylon.js mesh to be selected for configuration.
 * @param {string} objectId - The ID of the scene object associated with the mesh.
 * @param {object} properties - The current properties of the object
 * @param {object} [limits={}] - Optional limits for the properties
 * @returns {boolean} True if the selection was successful (mesh is valid), false otherwise.
 */
function selectObjectForConfig(mesh, objectId, properties, limits = {}) {
    clearConfigSelectionHighlight();
    
    configSelectedMesh = mesh;
    configSelectedMeshOriginalColor = highlightMesh(configSelectedMesh, configHighlightColor);
    
    showConfigPanel(objectId, properties, limits);
    
    return true;
}

/**
 * Gets the mesh currently selected for configuration.
 * @returns {BABYLON.Mesh | null} The currently selected Babylon.js mesh, or null if no mesh is selected.
 */
function getSelectedConfigMesh() {
    return configSelectedMesh;
}

/**
 * Cancels the current configuration selection.
 * Clears the highlight from the selected mesh and hides the configuration panel.
 */
function cancelConfigSelection() {
    clearConfigSelectionHighlight();
    hideConfigPanel();
}

export {
    clearConfigSelectionHighlight,
    selectObjectForConfig,
    getSelectedConfigMesh,
    cancelConfigSelection
};
