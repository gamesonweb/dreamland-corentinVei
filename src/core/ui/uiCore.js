import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';

/**
 * @module core/ui/uiCore
 * @description Provides core functionalities and shared resources for the UI system.
 * This includes managing the main `AdvancedDynamicTexture` for GUI elements,
 * a primary `StackPanel` for organizing UI sections, and a utility for disposing
 * of the entire UI. It also exports a placeholder image URL for error states.
 */

/**
 * @type {GUI.AdvancedDynamicTexture | null}
 * @description The main Babylon.js GUI AdvancedDynamicTexture instance used for rendering all UI elements.
 * It is created on demand by `getAdvancedTexture()`.
 * @private
 */
let advancedTexture = null;

/**
 * @type {GUI.StackPanel | null}
 * @description The main container (StackPanel) for organizing major UI sections like inventory, objectives, etc.
 * It is created on demand by `getMainPanel()`.
 * @private
 */
let uiPanel = null;

/**
 * @constant {string} emptyImageUrl
 * @description A base64 encoded data URL for a transparent 128x128 PNG image.
 * Used as a placeholder or fallback when an image preview cannot be generated or is empty,
 * helping to identify issues with image generation or caching.
 */
const emptyImageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IArs4c6QAAAdFJREFUeF7t1AENAAAMg7DPv+kLKXMAIds12sBo+uCvAPAICqAAcAM4fg9QALgBHL8HKADcAI7fAxQAbgDH7wEKADeA4/cABYAbwPF7gALADeD4PUAB4AZw/B6gAHADOH4PUAC4ARy/BygA3ACO3wMUAG4Ax+8BCgA3gOP3AAWAG8Dxe4ACwA3g+D1AAeAGcPweoABwAzh+D1AAuAEcvwcoANwAjt8DFABuAMfvAQoAN4Dj9wAFgBvA8XuAAsAN4Pg9QAHgBnD8HqAAcAM4fg9QALgBHL8HKADcAI7fAxQAbgDH7wEKADeA4/cABYAbwPF7gALADeD4PUAB4AZw/B6gAHADOH4PUAC4ARy/BygA3ACO3wMUAG4Ax+8BCgA3gOP3AAWAG8Dxe4ACwA3g+D1AAeAGcPweoABwAzh+D1AAuAEcvwcoANwAjt8DFABuAMfvAQoAN4Dj9wAFgBvA8XuAAsAN4Pg9QAHgBnD8HqAAcAM4fg9QALgBHL8HKADcAI7fAxQAbgDH7wEKADeA4/cABYAbwPF7gALADeD4PUAB4AZw/B6gAHADOH4PUAC4ARy/BygA3ACO3wMUAG4Ax+8BCgA3gOP3AAWAG8DxewA8gAekjwCBZtfVOwAAAABJRU5ErkJggg==";
/**
 * Retrieves or initializes the main `AdvancedDynamicTexture` for the UI.
 * If the texture does not exist, it creates a fullscreen UI texture attached to the
 * last created Babylon.js scene. It also sets up an observer to update the
 * texture's ideal dimensions on engine resize to maintain 1:1 pixel mapping for previews.
 *
 * @returns {GUI.AdvancedDynamicTexture | null} The main UI texture, or `null` if a scene is not available.
 */
function getAdvancedTexture() {
    if (!advancedTexture) {
        const scene = BABYLON.EngineStore.LastCreatedScene;
        if (!scene) {
            console.error("Cannot create UI: No active Babylon scene.");
            return null;
        }
        
        advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");
        const engine = BABYLON.EngineStore.LastCreatedEngine;
        advancedTexture.idealWidth = engine.getRenderWidth();
        advancedTexture.idealHeight = engine.getRenderHeight();
        
        engine.onResizeObservable.add(() => {
            advancedTexture.idealWidth = engine.getRenderWidth();
            advancedTexture.idealHeight = engine.getRenderHeight();
        });
    }
    return advancedTexture;
}

/**
 * Retrieves or initializes the main UI panel (`GUI.StackPanel`).
 * This panel serves as a primary container for major UI sections (e.g., inventory, objectives).
 * If the panel already exists, it is removed from the `advancedTexture` and recreated
 * to ensure a clean state.
 *
 * @returns {GUI.StackPanel | null} The main UI StackPanel, or `null` if the `advancedTexture` is not available.
 */
function getMainPanel() {
    const texture = getAdvancedTexture();
    if (!texture) return null;
    
    if (uiPanel) {
        texture.removeControl(uiPanel);
    }
    
    uiPanel = new GUI.StackPanel("inventoryPanelContainer");
    uiPanel.width = "200px";
    uiPanel.isVertical = true;
    uiPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    uiPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    uiPanel.paddingTop = "60px";
    uiPanel.paddingLeft = "10px";
    texture.addControl(uiPanel);
    
    return uiPanel;
}

/**
 * Disposes of the entire UI system.
 * If the `advancedTexture` exists, it is disposed of, which in turn disposes all
 * GUI controls attached to it. Module-level references to `advancedTexture` and `uiPanel`
 * are then reset to `null`.
 */
function disposeUI() {
    if (advancedTexture) {
        console.log("Disposing entire UI...");
        advancedTexture.dispose();
        advancedTexture = null;
        uiPanel = null;
    }
}

export {
    getAdvancedTexture,
    getMainPanel,
    disposeUI,
    emptyImageUrl
};
