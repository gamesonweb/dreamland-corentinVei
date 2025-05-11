import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture } from './uiCore.js';

/**
 * @module core/ui/objectivesPanel
 * @description Manages the creation, updating, and disposal of the objectives display panel.
 * This panel shows the current status of all active simulation objectives to the user.
 */

/**
 * @type {GUI.StackPanel | null}
 * @description Holds the main GUI.StackPanel container for the objectives display.
 * Initialized to null.
 * @private
 */
let objectivesPanel = null;

/**
 * @type {Map<string, GUI.TextBlock>}
 * @description A map storing references to the GUI.TextBlock elements used to display
 * individual objective statuses. The keys are objective IDs, and values are the
 * corresponding TextBlock instances.
 * @private
 */
let objectiveTextBlocks = new Map();

/**
 * Creates the objectives display panel.
 * If a panel already exists, it is disposed of first. The new panel is populated with
 * TextBlock elements for each active objective instance, showing their initial status.
 * The panel is only made visible if there are active objectives.
 *
 * @param {Array<module:core/objectives/Objective.Objective>} objectiveInstances - An array of active
 *        objective instances. Each instance should have a `getStatus()` method returning
 *        its ID, displayName, and statusText.
 */
function createObjectivesPanel(objectiveInstances) {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        console.error("Cannot create objectives panel: AdvancedTexture not available.");
        return;
    }
    
    disposeObjectivesPanel();

    objectivesPanel = new GUI.StackPanel("objectivesPanel");
    objectivesPanel.width = "800px";
    objectivesPanel.isVertical = true;
    objectivesPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    objectivesPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    objectivesPanel.paddingTop = "60px";
    objectivesPanel.paddingRight = "20px";
    objectivesPanel.isVisible = (objectiveInstances && objectiveInstances.length > 0);
    advancedTexture.addControl(objectivesPanel);

    const header = new GUI.TextBlock("objectivesHeader", "Objectives");
    header.height = "30px";
    header.color = "white";
    header.fontSize = 18;
    header.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    objectivesPanel.addControl(header);

    objectiveInstances.forEach(objective => {
        const status = objective.getStatus();
        const textBlock = new GUI.TextBlock(`objText_${status.id}`, `${status.displayName}: ${status.statusText}`);
        textBlock.height = "25px";
        textBlock.color = "white";
        textBlock.fontSize = 14;
        textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        textBlock.paddingLeft = "10px";
        objectivesPanel.addControl(textBlock);
        objectiveTextBlocks.set(status.id, textBlock);
    });

    console.log("Objectives panel created.");
}

/**
 * Updates the text content of the objectives panel to reflect the current status
 * of each active objective. It iterates through the provided `objectiveInstances`,
 * retrieves their latest status, and updates the corresponding TextBlock in the UI.
 * The color of the text may change based on whether an objective is complete or failed.
 *
 * @param {Array<module:core/objectives/Objective.Objective>} objectiveInstances - An array of active
 *        objective instances with potentially updated statuses.
 */
function updateObjectivesPanel(objectiveInstances) {
    if (!objectivesPanel || !objectivesPanel.isVisible) return;

    objectiveInstances.forEach(objective => {
        const status = objective.getStatus();
        const textBlock = objectiveTextBlocks.get(status.id);
        if (textBlock) {
            textBlock.text = `${status.displayName}: ${status.statusText}`;
            if (status.isComplete) {
                textBlock.color = "lightgreen";
            } else if (status.isFailed) {
                textBlock.color = "salmon";
            } else {
                textBlock.color = "white";
            }
        }
    });
}

/**
 * Disposes of the objectives panel UI elements.
 * If the `objectivesPanel` exists, it is disposed of, and the `objectiveTextBlocks` map is cleared.
 * This is typically called when the UI is being reset or rebuilt.
 */
function disposeObjectivesPanel() {
    if (objectivesPanel) {
        console.log("Disposing objectives panel...");
        objectivesPanel.dispose();
        objectivesPanel = null;
    }
    objectiveTextBlocks.clear();
}

export {
    createObjectivesPanel,
    updateObjectivesPanel,
    disposeObjectivesPanel
};
