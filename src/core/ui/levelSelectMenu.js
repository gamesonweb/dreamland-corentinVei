import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture, PANEL_CONSTANTS } from './uiCore.js';
import { loadSceneConfig } from '../../utils/configLoader.js';
import { initSimulation } from '../simulation.js';
import { showMainMenu } from './mainMenu.js';
import { getScene, disableCameraControls, enableCameraControls } from '../sceneManager.js';

let levelSelectPanel = null;
const levelFiles = [
    'assets/maps/level1.json',
    'assets/maps/level2.json',
    'assets/maps/level3.json',
    'assets/maps/level4.json',
    'assets/maps/level5.json',
    'assets/maps/level6.json',
    'assets/maps/level7.json',
    'assets/maps/level8.json'
];

const localStorageKey = 'unlockedLevelIndex';

/**
 * Creates the level selection menu UI using Babylon.js GUI.
 * @param {BABYLON.Scene} scene - The Babylon.js scene.
 */
function createLevelSelectMenu(scene) {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        console.error("AdvancedDynamicTexture not available for level select menu.");
        return;
    }

    if (levelSelectPanel) {
        levelSelectPanel.dispose();
        levelSelectPanel = null;
    }

    levelSelectPanel = new GUI.StackPanel("levelSelectPanel");
    levelSelectPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    levelSelectPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    levelSelectPanel.width = "600px";
    levelSelectPanel.isVertical = true;
    levelSelectPanel.background = PANEL_CONSTANTS.PANEL_BACKGROUND_COLOR;
    levelSelectPanel.thickness = PANEL_CONSTANTS.PANEL_BORDER_THICKNESS;
    levelSelectPanel.color = PANEL_CONSTANTS.PANEL_BORDER_COLOR;
    levelSelectPanel.paddingTop = "15px";
    levelSelectPanel.paddingBottom = "15px";
    levelSelectPanel.paddingLeft = "15px";
    levelSelectPanel.paddingRight = "15px";
    advancedTexture.addControl(levelSelectPanel);

    const unlockedLevelIndex = parseInt(localStorage.getItem(localStorageKey) || '0', 10);
    console.log(`Highest unlocked level index: ${unlockedLevelIndex}`);

    const title = new GUI.TextBlock("levelSelectTitle");
    title.text = "Select a Level";
    title.color = PANEL_CONSTANTS.TEXT_COLOR;
    title.fontSize = 24;
    title.marginBottom = 20;
    title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    title.width = "100%";
    title.height = "40px";
    levelSelectPanel.addControl(title);

    const buttonStack1 = new GUI.StackPanel("levelButtonStack1");
    buttonStack1.isVertical = false;
    buttonStack1.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    buttonStack1.height = "60px";
    buttonStack1.marginBottom = 10;
    levelSelectPanel.addControl(buttonStack1);

    const buttonStack2 = new GUI.StackPanel("levelButtonStack2");
    buttonStack2.isVertical = false;
    buttonStack2.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    buttonStack2.height = "60px";
    levelSelectPanel.addControl(buttonStack2);

    levelFiles.forEach((file, index) => {
        const button = GUI.Button.CreateSimpleButton(`levelButton${index}`, `${index + 1}`);
        button.width = "50px";
        button.height = "50px";
        button.color = PANEL_CONSTANTS.BUTTON_TEXT_COLOR;
        button.background = PANEL_CONSTANTS.BUTTON_BACKGROUND_COLOR;
        button.fontSize = 20;
        button.margin = 0;
        if (index <= unlockedLevelIndex) {
            button.onPointerClickObservable.add(async () => {
                console.log(`Loading level: ${file}`);
                hideLevelSelectMenu();
                try {
                    const { config, path } = await loadSceneConfig(file);
                    initSimulation(config, path);
                } catch (error) {
                    console.error("Failed to load level:", error);
                    showLevelSelectMenu();
                }
            });
        } else {
            button.isEnabled = false;
            button.background = PANEL_CONSTANTS.BUTTON_BACKGROUND_COLOR_DISABLED || "gray";
            button.color = PANEL_CONSTANTS.BUTTON_TEXT_COLOR_DISABLED || "#cccccc";
        }

        if (index < 5) {
            buttonStack1.addControl(button);
            if (index < 4) {
                const spacer = new GUI.Control();
                spacer.width = "40px";
                buttonStack1.addControl(spacer);
            }
        } else {
            buttonStack2.addControl(button);
            if (index < levelFiles.length - 1) {
                const spacer = new GUI.Control();
                spacer.width = "40px";
                buttonStack2.addControl(spacer);
            }
        }
    });
    

    const backButton = GUI.Button.CreateSimpleButton("backButton", "Back");
    backButton.width = "150px";
    backButton.height = "40px";
    backButton.color = PANEL_CONSTANTS.BUTTON_TEXT_COLOR;
    backButton.background = PANEL_CONSTANTS.BUTTON_BACKGROUND_COLOR;
    backButton.fontSize = 18;
    backButton.marginTop = 20;
    backButton.onPointerClickObservable.add(() => {
        hideLevelSelectMenu();
        showMainMenu();
    });
    levelSelectPanel.addControl(backButton);


    levelSelectPanel.isVisible = false;
}

/**
 * Shows the level selection menu.
 * @returns {GUI.StackPanel | null} The level selection panel, or null if not created.
 */
function showLevelSelectMenu() {
    const scene = getScene();
    if (!scene) {
        console.error("Scene not available for level select menu.");
        return null;
    }
    createLevelSelectMenu(scene);

    if (levelSelectPanel) {
        levelSelectPanel.isVisible = true;
        disableCameraControls();
    }
    return levelSelectPanel;
}

/**
 * Hides the level selection menu.
 */
function hideLevelSelectMenu() {
    if (levelSelectPanel) {
        levelSelectPanel.isVisible = false;
    }
}

export { createLevelSelectMenu, showLevelSelectMenu, hideLevelSelectMenu, levelFiles };
