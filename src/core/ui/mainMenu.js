import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture, PANEL_CONSTANTS } from './uiCore.js';
import { showLevelSelectMenu } from './levelSelectMenu.js'; // Import for showing level select menu
import { toggleSettingsMenuVisibility } from './settingsMenuBabylon.js'; // Import for showing settings menu
import { getScene, disableCameraControls, enableCameraControls } from '../sceneManager.js'; // Import getScene and camera controls

let mainMenuPanel = null;

/**
 * Creates the main menu UI using Babylon.js GUI.
 * @param {BABYLON.Scene} scene - The Babylon.js scene.
 */
function createMainMenu(scene) {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        console.error("AdvancedDynamicTexture not available for main menu.");
        return;
    }

    if (mainMenuPanel) {
        mainMenuPanel.dispose();
        mainMenuPanel = null;
    }

    mainMenuPanel = new GUI.StackPanel("mainMenuPanel");
    mainMenuPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    mainMenuPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    mainMenuPanel.width = "300px";
    mainMenuPanel.isVertical = true;
    mainMenuPanel.background = PANEL_CONSTANTS.PANEL_BACKGROUND_COLOR;
    mainMenuPanel.thickness = PANEL_CONSTANTS.PANEL_BORDER_THICKNESS;
    mainMenuPanel.color = PANEL_CONSTANTS.PANEL_BORDER_COLOR;
    mainMenuPanel.paddingTop = "20px";
    mainMenuPanel.paddingBottom = "20px";
    mainMenuPanel.paddingLeft = "20px";
    mainMenuPanel.paddingRight = "20px";
    advancedTexture.addControl(mainMenuPanel);

    const title = new GUI.TextBlock("menuTitle");
    title.text = "PuzzleShape";
    title.color = PANEL_CONSTANTS.TEXT_COLOR;
    title.fontSize = 24;
    title.marginBottom = 20;
    title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    title.width = "100%";
    title.height = "40px";
    mainMenuPanel.addControl(title);


    const playButton = GUI.Button.CreateSimpleButton("playButton", "Play");
    playButton.width = "200px";
    playButton.height = "50px";
    playButton.color = PANEL_CONSTANTS.BUTTON_TEXT_COLOR;
    playButton.background = PANEL_CONSTANTS.BUTTON_BACKGROUND_COLOR;
    playButton.fontSize = 20;
    playButton.onPointerClickObservable.add(() => {
        hideMainMenu();
        showLevelSelectMenu();
    });
    mainMenuPanel.addControl(playButton);

    const settingsButton = GUI.Button.CreateSimpleButton("settingsButton", "Settings");
    settingsButton.width = "200px";
    settingsButton.height = "50px";
    settingsButton.color = PANEL_CONSTANTS.BUTTON_TEXT_COLOR;
    settingsButton.background = PANEL_CONSTANTS.BUTTON_BACKGROUND_COLOR;
    settingsButton.fontSize = 20;
    settingsButton.marginTop = 10;
    settingsButton.onPointerClickObservable.add(() => {
        toggleSettingsMenuVisibility(); 
    });
    mainMenuPanel.addControl(settingsButton);

    mainMenuPanel.isVisible = false;
}

/**
 * Shows the main menu.
 * @returns {GUI.StackPanel | null} The main menu panel, or null if not created.
 */
function showMainMenu() {
    const scene = getScene();
    if (!scene) {
        console.error("Scene not available for main menu.");
        return null;
    }
    createMainMenu(scene); 

    if (mainMenuPanel) {
        mainMenuPanel.isVisible = true;
        disableCameraControls();
    }
    return mainMenuPanel;
}

/**
 * Hides the main menu.
 */
function hideMainMenu() {
    if (mainMenuPanel) {
        mainMenuPanel.isVisible = false;
    }
}

export { createMainMenu, showMainMenu, hideMainMenu };
