import * as GUI from '@babylonjs/gui';
import * as BABYLON from '@babylonjs/core';
import { getAdvancedTexture, PANEL_CONSTANTS } from './uiCore.js';
import { returnToMainMenu, currentScenePath, initSimulation } from '../simulation.js';
import { disableCameraControls, enableCameraControls } from '../sceneManager.js';
import { loadSceneConfig } from '../../utils/configLoader.js';
import { levelFiles } from './levelSelectMenu.js';

let endMenuContainer = null;
let restartButton = null;
let returnToMenuButton = null;
let nextLevelButton = null;
let scoresStackPanel = null;

/**
 * Creates the end-of-level menu UI.
 * This menu typically appears when a level is completed or failed.
 * It will contain a "Restart Level" button, a "Return to Menu" button, and display scores.
 *
 * @param {function} onRestartCallback - The function to call when the "Restart Level" button is clicked.
 */
export function createEndMenu(onRestartCallback) {
    disposeEndMenu();

    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        console.error("AdvancedTexture not available for creating end menu.");
        return;
    }

    endMenuContainer = new GUI.Rectangle("endMenuContainer");
    endMenuContainer.width = "350px";
    endMenuContainer.height = "350px";
    endMenuContainer.cornerRadius = 25;
    endMenuContainer.color = PANEL_CONSTANTS.PANEL_BORDER_COLOR;
    endMenuContainer.thickness = PANEL_CONSTANTS.PANEL_BORDER_THICKNESS;
    endMenuContainer.background = PANEL_CONSTANTS.PANEL_BACKGROUND_COLOR_SEMI_TRANSPARENT || "rgba(50, 50, 50, 0.85)";
    endMenuContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    endMenuContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    endMenuContainer.zIndex = 200;
    endMenuContainer.isVisible = false;
    advancedTexture.addControl(endMenuContainer);

    const mainStackPanel = new GUI.StackPanel("endMenuMainStackPanel");
    mainStackPanel.width = "100%";
    mainStackPanel.isVertical = true;
    mainStackPanel.paddingTop = "15px";
    mainStackPanel.paddingBottom = "15px";
    endMenuContainer.addControl(mainStackPanel);

    const titleText = new GUI.TextBlock("endMenuTitle", "Level Ended!");
    titleText.color = PANEL_CONSTANTS.TEXT_COLOR_BRIGHT || "white";
    titleText.fontSize = 28;
    titleText.height = "45px";
    titleText.paddingBottom = "10px";
    mainStackPanel.addControl(titleText);


    const scoresTitleText = new GUI.TextBlock("scoresTitle", "Results:");
    scoresTitleText.color = PANEL_CONSTANTS.TEXT_COLOR_SLIGHTLY_DIM || "#cccccc";
    scoresTitleText.fontSize = 20;
    scoresTitleText.height = "30px";
    scoresTitleText.paddingTop = "5px";
    scoresTitleText.paddingBottom = "5px";
    mainStackPanel.addControl(scoresTitleText);

    scoresStackPanel = new GUI.StackPanel("scoresStackPanel");
    scoresStackPanel.width = "90%";
    scoresStackPanel.isVertical = true;
    scoresStackPanel.paddingTop = "5px";
    scoresStackPanel.paddingBottom = "15px";
    mainStackPanel.addControl(scoresStackPanel);

    const buttonsStackPanel = new GUI.StackPanel("endMenuButtonsStackPanel");
    buttonsStackPanel.width = "100%";
    buttonsStackPanel.isVertical = true;
    buttonsStackPanel.paddingTop = "10px";
    mainStackPanel.addControl(buttonsStackPanel);


    nextLevelButton = GUI.Button.CreateSimpleButton("nextLevelButton", "Next Level");
    nextLevelButton.width = "220px";
    nextLevelButton.height = "50px";
    nextLevelButton.color = PANEL_CONSTANTS.BUTTON_TEXT_COLOR_BRIGHT || "white";
    nextLevelButton.cornerRadius = 15;
    nextLevelButton.background = PANEL_CONSTANTS.BUTTON_BACKGROUND_COLOR_PRIMARY || "green";
    nextLevelButton.thickness = 2;
    nextLevelButton.hoverCursor = "pointer";
    nextLevelButton.isVisible = false;
    nextLevelButton.onPointerUpObservable.add(async () => {
        hideEndMenu();
        const currentLevelIndex = levelFiles.findIndex(file => file === currentScenePath);
        if (currentLevelIndex !== -1 && currentLevelIndex < levelFiles.length - 1) {
            const nextLevelPath = levelFiles[currentLevelIndex + 1];
            console.log(`Loading next level: ${nextLevelPath}`);
            try {
                const { config, path } = await loadSceneConfig(nextLevelPath);
                initSimulation(config, path);
            } catch (error) {
                console.error("Failed to load next level:", error);
                returnToMainMenu();
            }
        } else {
            console.warn("Attempted to load next level, but current level not found or is the last level.");
            returnToMainMenu();
        }
    });
    buttonsStackPanel.addControl(nextLevelButton);

    restartButton = GUI.Button.CreateSimpleButton("restartButton", "Restart Level");
    restartButton.width = "220px";
    restartButton.height = "50px";
    restartButton.color = PANEL_CONSTANTS.BUTTON_TEXT_COLOR_BRIGHT || "white";
    restartButton.cornerRadius = 15;
    restartButton.background = PANEL_CONSTANTS.BUTTON_BACKGROUND_COLOR_PRIMARY || "green";
    restartButton.thickness = 2;
    restartButton.hoverCursor = "pointer";
    restartButton.onPointerUpObservable.add(() => {
        if (onRestartCallback) {
            onRestartCallback();
        }
        hideEndMenu();
    });
    buttonsStackPanel.addControl(restartButton);

    returnToMenuButton = GUI.Button.CreateSimpleButton("returnToMenuButton", "Return to Menu");
    returnToMenuButton.width = "220px";
    returnToMenuButton.height = "50px";
    returnToMenuButton.color = PANEL_CONSTANTS.BUTTON_TEXT_COLOR_BRIGHT || "white";
    returnToMenuButton.cornerRadius = 15;
    returnToMenuButton.background = PANEL_CONSTANTS.BUTTON_BACKGROUND_COLOR_SECONDARY || "gray";
    returnToMenuButton.thickness = 2;
    returnToMenuButton.hoverCursor = "pointer";
    returnToMenuButton.marginTop = "10px";
    returnToMenuButton.onPointerUpObservable.add(() => {
        hideEndMenu();
        returnToMainMenu();
    });
    buttonsStackPanel.addControl(returnToMenuButton);

    console.log("End menu created.");
}

/**
 * Shows the end menu and populates it with objective data.
 * @param {Array<object>} objectivesData - An array of objective status objects.
 * Each object should have `displayName`, `statusText`, and `isComplete`.
 */
export function showEndMenu(objectivesData = []) {
    if (endMenuContainer && scoresStackPanel && nextLevelButton) {
        const allObjectivesComplete = objectivesData.every(obj => obj.isComplete);
        const currentLevelIndex = levelFiles.findIndex(file => file === currentScenePath);
        const hasNextLevel = currentLevelIndex !== -1 && currentLevelIndex < levelFiles.length - 1;


        nextLevelButton.isVisible = allObjectivesComplete && hasNextLevel;


        if (nextLevelButton.isVisible) {
            restartButton.marginTop = "10px";
        } else {
            restartButton.marginTop = "0px";
        }

        for (let i = scoresStackPanel.children.length - 1; i >= 0; i--) {
            const child = scoresStackPanel.children[i];
            scoresStackPanel.removeControl(child);
            child.dispose();
        }

        if (objectivesData.length > 0) {
            objectivesData.forEach(objData => {
                let displayText = `${objData.displayName}: ${objData.statusText}`;
                if (objData.starsEarned > 0) {
                    displayText += ` (${'⭐'.repeat(objData.starsEarned)})`;
                }
                const scoreText = new GUI.TextBlock(
                    `score_${objData.id || Math.random().toString(36).substr(2, 9)}`,
                    displayText
                );
                scoreText.color = PANEL_CONSTANTS.TEXT_COLOR_NORMAL || "#f0f0f0";
                scoreText.fontSize = 18;
                scoreText.height = "25px";
                scoreText.textWrapping = GUI.TextWrapping.WordWrap;
                scoreText.resizeToFit = true;
                scoreText.paddingTop = "2px";
                scoreText.paddingBottom = "2px";
                scoresStackPanel.addControl(scoreText);
            });
        } else {
            const noScoresText = new GUI.TextBlock("noScoresText", "No objectives tracked for this level.");
            noScoresText.color = PANEL_CONSTANTS.TEXT_COLOR_DIM || "#aaaaaa";
            noScoresText.fontSize = 16;
            noScoresText.height = "25px";
            noScoresText.paddingTop = "5px";
            scoresStackPanel.addControl(noScoresText);
        }

        endMenuContainer.isVisible = true;
        disableCameraControls();
        console.log("End menu shown with scores.");
    } else {
        console.error("End menu container or scores panel not available to show.");
    }
}

/**
 * Hides the end menu.
 */
export function hideEndMenu() {
    if (endMenuContainer) {
        endMenuContainer.isVisible = false;
        console.log("End menu hidden.");
    }
}

/**
 * Disposes of the end menu UI elements.
 * Removes the container and its children from the advanced texture.
 */
export function disposeEndMenu() {
    if (endMenuContainer) {
        const advancedTexture = getAdvancedTexture();
        if (advancedTexture) {
            advancedTexture.removeControl(endMenuContainer);
        }
        endMenuContainer.dispose();
        endMenuContainer = null;
        restartButton = null;
        returnToMenuButton = null;
        scoresStackPanel = null;
        console.log("End menu disposed.");
    }
}
