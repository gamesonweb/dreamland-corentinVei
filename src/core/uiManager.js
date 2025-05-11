import { disposeUI as coreDisposeUI } from './ui/uiCore.js';
import { createInventoryUI, updateUIContent } from './ui/inventoryPanel.js';
import { createTopMenuBar, updateTopMenuBar } from './ui/menuBar.js';
import { createConfigPanel, showConfigPanel, hideConfigPanel } from './ui/configPanel.js';
import { createTrashCan, showTrashCan, hideTrashCan, isPointerOverTrashCan } from './ui/trashCan.js';
import { createObjectivesPanel, updateObjectivesPanel, disposeObjectivesPanel } from './ui/objectivesPanel.js';

/**
 * @module core/uiManager
 * @description Manages the overall UI by coordinating various UI component modules.
 * This module serves as a central point for creating, updating, and disposing of UI elements
 * such as inventory, menu bar, configuration panel, trash can, and objectives panel.
 * It re-exports functions from these specialized UI modules.
 */

/**
 * Disposes of all UI elements managed by the `uiManager`.
 * This function calls the respective disposal functions for each UI component
 * (e.g., objectives panel) and then calls the core UI disposal function
 * to clean up shared resources like the main GUI texture.
 */
function disposeUI() {
    disposeObjectivesPanel();
    coreDisposeUI();
}

export {
    createInventoryUI,
    updateUIContent,
    disposeUI,
    createTrashCan,
    showTrashCan,
    hideTrashCan,
    isPointerOverTrashCan,
    createTopMenuBar,
    updateTopMenuBar,
    createConfigPanel,
    showConfigPanel,
    hideConfigPanel,
    createObjectivesPanel,
    updateObjectivesPanel
};
