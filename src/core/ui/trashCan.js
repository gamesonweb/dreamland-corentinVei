import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture } from './uiCore.js';

/**
 * @module core/ui/trashCan
 * @description Manages the creation, visibility, and interaction detection for a trash can UI element.
 * This UI element allows users to drag and drop objects onto it to remove them from the simulation.
 */

/**
 * @type {GUI.Rectangle | null}
 * @description Holds the GUI.Rectangle control representing the trash can.
 * Initialized to null.
 * @private
 */
let trashCanControl = null;

/**
 * Creates the trash can GUI element.
 * The trash can is a `GUI.Rectangle` styled to look like a trash area, initially hidden.
 * It includes hover effects to change its appearance when the pointer is over it.
 * If a trash can control already exists, it is disposed of and recreated.
 */
function createTrashCan() {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        console.error("Cannot create trash can: AdvancedTexture not available.");
        return;
    }
    
    if (trashCanControl) {
        advancedTexture.removeControl(trashCanControl);
        trashCanControl = null;
    }

    trashCanControl = new GUI.Rectangle("trashCan");
    trashCanControl.width = "80px";
    trashCanControl.height = "80px";
    trashCanControl.cornerRadius = 10;
    trashCanControl.color = "white";
    trashCanControl.thickness = 2;
    trashCanControl.background = "rgba(255, 0, 0, 0.5)";
    trashCanControl.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    trashCanControl.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    trashCanControl.paddingRight = "20px";
    trashCanControl.paddingBottom = "20px";
    trashCanControl.isVisible = false;
    
    trashCanControl.onPointerEnterObservable.add(() => {
        trashCanControl.background = "rgba(255, 0, 0, 0.8)";
        console.log("Pointer entered trash can");
    });
    
    trashCanControl.onPointerOutObservable.add(() => {
        trashCanControl.background = "rgba(255, 0, 0, 0.5)";
        console.log("Pointer left trash can");
    });

    const trashText = new GUI.TextBlock("trashText", "Trash");
    trashText.color = "white";
    trashText.fontSize = 16;
    trashCanControl.addControl(trashText);

    advancedTexture.addControl(trashCanControl);
    console.log("Trash can UI created and added to texture.");
}

/**
 * Makes the trash can UI element visible.
 * If the `trashCanControl` has not been created, a warning is logged.
 */
function showTrashCan() {
    console.log("showTrashCan called");
    if (trashCanControl) {
        trashCanControl.isVisible = true;
        console.log("Trash can is now visible");
    } else {
        console.warn("showTrashCan: trashCanControl is null");
    }
}

/**
 * Hides the trash can UI element.
 * If the `trashCanControl` has not been created, a warning is logged.
 */
function hideTrashCan() {
    console.log("hideTrashCan called");
    if (trashCanControl) {
        trashCanControl.isVisible = false;
        console.log("Trash can is now hidden");
    } else {
        console.warn("hideTrashCan: trashCanControl is null");
    }
}

/**
 * Checks if the given screen coordinates (pointerX, pointerY) are within the bounds
 * of the visible trash can UI element.
 * This function manually calculates the absolute screen bounds of the trash can control
 * based on its `_currentMeasure` property and compares them with the pointer coordinates.
 * It also logs a comparison with the native `contains` method for debugging.
 *
 * @param {number} pointerX - The X-coordinate of the pointer on the screen.
 * @param {number} pointerY - The Y-coordinate of the pointer on the screen.
 * @returns {boolean} True if the pointer is over the visible trash can, false otherwise.
 *                    Returns false if the trash can control is not created, not visible,
 *                    or if its measure information is unavailable.
 */
function isPointerOverTrashCan(pointerX, pointerY) {
    console.log(`isPointerOverTrashCan called with coords: ${pointerX}, ${pointerY}`);
    if (!trashCanControl) {
        console.warn("isPointerOverTrashCan: trashCanControl is null");
        return false;
    }
    if (!trashCanControl.isVisible) {
        console.warn("isPointerOverTrashCan: trashCanControl is not visible");
        return false;
    }
    if (!getAdvancedTexture()) {
        console.warn("isPointerOverTrashCan: advancedTexture is null");
        return false;
    }
    
    const measure = trashCanControl._currentMeasure;
    if (!measure) {
        console.warn("isPointerOverTrashCan: trashCanControl._currentMeasure is null");
        return false;
    }
    
    const engine = BABYLON.EngineStore.LastCreatedEngine;
    const screenWidth = engine.getRenderWidth();
    const screenHeight = engine.getRenderHeight();
    
    const left = measure.left;
    const top = measure.top;
    const width = measure.width;
    const height = measure.height;
    
    console.log(`Trash can absolute position: left=${left}, top=${top}, width=${width}, height=${height}`);
    console.log(`Screen dimensions: ${screenWidth}x${screenHeight}`);
    
    const isInBounds = 
        pointerX >= left && 
        pointerX <= left + width && 
        pointerY >= top && 
        pointerY <= top + height;
    
    console.log(`Manual bounds check: ${isInBounds}`);
    
    const isContained = trashCanControl.contains(pointerX, pointerY);
    console.log(`Native contains check: ${isContained}`);
    
    return isInBounds;
}

export {
    createTrashCan,
    showTrashCan,
    hideTrashCan,
    isPointerOverTrashCan
};
