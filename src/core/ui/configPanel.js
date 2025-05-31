import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture } from './uiCore.js';
import { clearConfigSelectionHighlight } from '../interactionManager.js';
import { initSimulation, currentScenePath } from '../simulation.js';
import { loadSceneConfig } from '../../utils/configLoader.js';

/**
 * @module core/ui/configPanel
 * @description Manages the creation and interaction of the object configuration panel.
 * This panel allows users to adjust properties like mass, friction, and restitution
 * for a selected physics object. It uses Babylon.js GUI controls.
 */

/**
 * @type {GUI.Rectangle | null}
 * @description Holds the main GUI.Rectangle container for the configuration panel.
 * Initialized to null.
 * @private
 */
let configPanel = null;

/**
 * @type {string | null}
 * @description Stores the ID of the object currently being configured.
 * Initialized to null.
 * @private
 */
let configObjectId = null;

/**
 * @type {object}
 * @description An object to store references to the GUI controls within the panel (e.g., sliders, text blocks).
 * Example: `{ massSlider: GUI.Slider, massValueText: GUI.TextBlock, ... }`
 * @private
 */
let configControls = {};

/**
 * @type {function(string, string, number): void}
 * @description Callback function to be invoked when a configuration property is updated by the user.
 * It receives the object ID, the property name (e.g., 'mass'), and the new value.
 * Defaults to a console warning if not implemented.
 * @private
 */
let onConfigUpdate = (objectId, property, value) => {};

/**
 * Creates the configuration panel GUI elements.
 * The panel is initially hidden and includes sliders and text displays for mass,
 * friction, and restitution, along with a close button.
 *
 * @param {function(string, string, number): void} configUpdateCallback - A callback function
 *        that will be invoked when a property value changes in the panel.
 *        It receives `(objectId, propertyName, newValue)`.
 */
function createConfigPanel(configUpdateCallback) {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        return;
    }
    
    if (configPanel) {
        configPanel.dispose();
        configControls = {};
    }

    onConfigUpdate = configUpdateCallback;

    configPanel = new GUI.Rectangle("configPanel");
    configPanel.width = "300px";
    configPanel.height = "320px";
    configPanel.cornerRadius = 10;
    configPanel.color = "white";
    configPanel.thickness = 1;
    configPanel.background = "rgba(50, 50, 50, 0.8)";
    configPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    configPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    configPanel.paddingRight = "20px";
    configPanel.isVisible = false;
    advancedTexture.addControl(configPanel);

    const panelStack = new GUI.StackPanel("configStack");
    panelStack.width = "100%";
    panelStack.paddingTop = "10px";
    panelStack.paddingLeft = "10px";
    panelStack.paddingRight = "10px";
    panelStack.paddingBottom = "10px";
    configPanel.addControl(panelStack);

    const header = new GUI.TextBlock("configHeader", "Configure Object");
    header.height = "30px";
    header.color = "white";
    header.fontSize = 18;
    panelStack.addControl(header);

    const massPanel = new GUI.StackPanel("massPanel");
    massPanel.isVertical = false;
    massPanel.height = "40px";
    massPanel.paddingTop = "5px";
    panelStack.addControl(massPanel);

    const massLabel = new GUI.TextBlock("massLabel", "Mass:");
    massLabel.width = "80px";
    massLabel.color = "white";
    massLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    massPanel.addControl(massLabel);

    const massSlider = new GUI.Slider("massSlider");
    massSlider.minimum = 0.1;
    massSlider.maximum = 10.0;
    massSlider.value = 1.0;
    massSlider.height = "20px";
    massSlider.width = "120px";
    massSlider.color = "yellow";
    massSlider.background = "gray";
    massPanel.addControl(massSlider);
    configControls.massSlider = massSlider;

    const massValueText = new GUI.TextBlock("massValueText", "1.00");
    massValueText.width = "50px";
    massValueText.color = "white";
    massValueText.fontSize = 14;
    massValueText.paddingLeft = "10px";
    massPanel.addControl(massValueText);
    configControls.massValueText = massValueText;

    massSlider.onValueChangedObservable.add((value) => {
        const formattedValue = value.toFixed(2);
        massValueText.text = formattedValue;
    });

    massSlider.onPointerUpObservable.add(() => {
        if (configObjectId) {
            onConfigUpdate(configObjectId, 'mass', massSlider.value);
        }
    });

    const frictionPanel = new GUI.StackPanel("frictionPanel");
    frictionPanel.isVertical = false;
    frictionPanel.height = "40px";
    frictionPanel.paddingTop = "5px";
    panelStack.addControl(frictionPanel);

    const frictionLabel = new GUI.TextBlock("frictionLabel", "Friction:");
    frictionLabel.width = "80px";
    frictionLabel.color = "white";
    frictionLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    frictionPanel.addControl(frictionLabel);

    const frictionSlider = new GUI.Slider("frictionSlider");
    frictionSlider.minimum = 0;
    frictionSlider.maximum = 1;
    frictionSlider.value = 0.1;
    frictionSlider.height = "20px";
    frictionSlider.width = "120px";
    frictionSlider.color = "cyan";
    frictionSlider.background = "gray";
    frictionPanel.addControl(frictionSlider);
    configControls.frictionSlider = frictionSlider;

    const frictionValueText = new GUI.TextBlock("frictionValueText", "0.10");
    frictionValueText.width = "50px";
    frictionValueText.color = "white";
    frictionValueText.fontSize = 14;
    frictionValueText.paddingLeft = "10px";
    frictionPanel.addControl(frictionValueText);
    configControls.frictionValueText = frictionValueText;

    frictionSlider.onValueChangedObservable.add((value) => {
        const formattedValue = value.toFixed(2);
        frictionValueText.text = formattedValue;
    });

    frictionSlider.onPointerUpObservable.add(() => {
        if (configObjectId) {
            onConfigUpdate(configObjectId, 'friction', frictionSlider.value);
        }
    });

    const restitutionPanel = new GUI.StackPanel("restitutionPanel");
    restitutionPanel.isVertical = false;
    restitutionPanel.height = "40px";
    restitutionPanel.paddingTop = "5px";
    panelStack.addControl(restitutionPanel);

    const restitutionLabel = new GUI.TextBlock("restitutionLabel", "Restitution:");
    restitutionLabel.width = "80px";
    restitutionLabel.color = "white";
    restitutionLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    restitutionPanel.addControl(restitutionLabel);

    const restitutionSlider = new GUI.Slider("restitutionSlider");
    restitutionSlider.minimum = 0;
    restitutionSlider.maximum = 1;
    restitutionSlider.value = 0.5;
    restitutionSlider.height = "20px";
    restitutionSlider.width = "120px";
    restitutionSlider.color = "magenta";
    restitutionSlider.background = "gray";
    restitutionPanel.addControl(restitutionSlider);
    configControls.restitutionSlider = restitutionSlider;

    const restitutionValueText = new GUI.TextBlock("restitutionValueText", "0.50");
    restitutionValueText.width = "50px";
    restitutionValueText.color = "white";
    restitutionValueText.fontSize = 14;
    restitutionValueText.paddingLeft = "10px";
    restitutionPanel.addControl(restitutionValueText);
    configControls.restitutionValueText = restitutionValueText;

    restitutionSlider.onValueChangedObservable.add((value) => {
        const formattedValue = value.toFixed(2);
        restitutionValueText.text = formattedValue;
    });

    restitutionSlider.onPointerUpObservable.add(() => {
        if (configObjectId) {
            onConfigUpdate(configObjectId, 'restitution', restitutionSlider.value);
        }
    });

    const closeButton = GUI.Button.CreateSimpleButton("closeConfigBtn", "Close");
    closeButton.width = "80px";
    closeButton.height = "30px";
    closeButton.color = "white";
    closeButton.background = "red";
    closeButton.paddingTop = "10px";
    closeButton.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    closeButton.onPointerClickObservable.add(() => {
        hideConfigPanel();
    });
    panelStack.addControl(closeButton);

    console.log("Configuration panel created.");
}

/**
 * Shows the configuration panel and populates it with the properties of the selected object.
 * It adjusts the min/max values of the sliders based on the provided `limits` or defaults.
 * The current values of the object's properties are set on the sliders.
 *
 * @param {string} objectId - The ID of the object to be configured.
 * @param {object} properties - An object containing the current properties of the object
 *                              (e.g., `{ mass: number, friction: number, restitution: number }`).
 * @param {object} [limits={}] - Optional limits for the properties. If not provided, default limits are used.
 *                               Expected format: `{ mass: {min, max}, friction: {min, max}, restitution: {min, max} }`.
 */
function showConfigPanel(objectId, properties, limits = {}) {
    if (!configPanel) {
        console.error("Cannot show config panel: Panel not created.");
        return;
    }
    configObjectId = objectId;

    const defaultLimits = {
        mass: { min: 0.1, max: 10.0 },
        friction: { min: 0.0, max: 1.0 },
        restitution: { min: 0.0, max: 1.0 }
    };

    const massLimits = limits?.mass ?? defaultLimits.mass;
    const frictionLimits = limits?.friction ?? defaultLimits.friction;
    const restitutionLimits = limits?.restitution ?? defaultLimits.restitution;

    if (configControls.massSlider) {
        configControls.massSlider.minimum = massLimits.min;
        configControls.massSlider.maximum = massLimits.max;
    }
    if (configControls.frictionSlider) {
        configControls.frictionSlider.minimum = frictionLimits.min;
        configControls.frictionSlider.maximum = frictionLimits.max;
    }
    if (configControls.restitutionSlider) {
        configControls.restitutionSlider.minimum = restitutionLimits.min;
        configControls.restitutionSlider.maximum = restitutionLimits.max;
    }

    const currentMass = properties.mass ?? defaultLimits.mass.min;
    const currentFriction = properties.friction ?? defaultLimits.friction.min;
    const currentRestitution = properties.restitution ?? defaultLimits.restitution.min;

    const clampedMass = Math.max(massLimits.min, Math.min(massLimits.max, currentMass));
    const clampedFriction = Math.max(frictionLimits.min, Math.min(frictionLimits.max, currentFriction));
    const clampedRestitution = Math.max(restitutionLimits.min, Math.min(restitutionLimits.max, currentRestitution));

    if (configControls.massSlider) {
        configControls.massSlider.value = clampedMass;
    }
    if (configControls.massValueText) {
        configControls.massValueText.text = clampedMass.toFixed(2);
    }
    if (configControls.frictionSlider) {
        configControls.frictionSlider.value = clampedFriction;
    }
    if (configControls.frictionValueText) {
        configControls.frictionValueText.text = clampedFriction.toFixed(2);
    }
    if (configControls.restitutionSlider) {
        configControls.restitutionSlider.value = clampedRestitution;
    }
    if (configControls.restitutionValueText) {
        configControls.restitutionValueText.text = clampedRestitution.toFixed(2);
    }

    configPanel.isVisible = true;
    console.log(`Showing config panel for object: ${objectId} with limits:`, limits);
}

/**
 * Hides the configuration panel.
 * Also clears the `configObjectId` and calls `clearConfigSelectionHighlight`
 * to remove any visual highlight from the configured object in the scene.
 */
function hideConfigPanel() {
    if (configPanel && configPanel.isVisible) {
        configPanel.isVisible = false;
        configObjectId = null;
        clearConfigSelectionHighlight();
        console.log("Hiding config panel and clearing selection highlight.");
    }
}

export {
    createConfigPanel,
    showConfigPanel,
    hideConfigPanel
};
