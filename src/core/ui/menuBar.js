import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture } from './uiCore.js';

/**
 * @module core/ui/menuBar
 * @description Manages the creation and state of the top menu bar UI.
 * This menu bar typically contains buttons to switch between different application modes
 * (e.g., 'construction', 'configuration', 'simulation').
 */

/**
 * @type {GUI.StackPanel | null}
 * @description Holds the GUI.StackPanel container for the top menu bar.
 * Initialized to null.
 * @private
 */
let topMenuBar = null;

/**
 * @type {Object.<string, GUI.Button>}
 * @description An object storing references to the mode-switching buttons in the menu bar.
 * Keys are mode names (e.g., 'construction'), and values are the corresponding `GUI.Button` instances.
 * @private
 */
let modeButtons = {};

/**
 * Creates the top menu bar with buttons for switching application modes.
 * If a menu bar already exists, it is disposed of and recreated.
 * The buttons are styled and configured to call `modeChangeCallback` when clicked.
 * The `initialMode` button is highlighted.
 *
 * @param {string} initialMode - The name of the mode that should be initially highlighted
 *                               (e.g., 'construction', 'configuration', 'simulation').
 * @param {function(string): void} modeChangeCallback - A callback function that is invoked
 *        when a mode button is clicked. It receives the name of the selected mode as an argument.
 */
function createTopMenuBar(initialMode, modeChangeCallback) {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        console.error("Cannot create top menu bar: AdvancedTexture not available.");
        return;
    }
    
    if (topMenuBar) {
        advancedTexture.removeControl(topMenuBar);
        topMenuBar = null;
        modeButtons = {};
    }

    topMenuBar = new GUI.StackPanel("topMenuBar");
    topMenuBar.isVertical = false;
    topMenuBar.height = "40px";
    topMenuBar.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    topMenuBar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    topMenuBar.paddingTop = "10px";
    advancedTexture.addControl(topMenuBar);

    const modes = [
        { name: 'construction', text: 'Construction' },
        { name: 'configuration', text: 'Configuration' },
        { name: 'simulation', text: 'Simulation' }
    ];

    modes.forEach(modeInfo => {
        const button = GUI.Button.CreateSimpleButton(`modeBtn_${modeInfo.name}`, modeInfo.text);
        button.width = "150px";
        button.height = "100%";
        button.color = "white";
        button.background = "gray";
        button.fontSize = 16;
        button.paddingLeft = "5px";
        button.paddingRight = "5px";
        button.onPointerClickObservable.add(() => {
            modeChangeCallback(modeInfo.name);
        });
        topMenuBar.addControl(button);
        modeButtons[modeInfo.name] = button;
    });

    updateTopMenuBar(initialMode);
    console.log("Top menu bar created.");
}

/**
 * Updates the visual state of the mode buttons in the top menu bar to reflect the currently active mode.
 * The button corresponding to `activeMode` is highlighted (e.g., different background color),
 * while other mode buttons are set to an inactive style.
 *
 * @param {string} activeMode - The name of the mode that is currently active and should be highlighted.
 */
function updateTopMenuBar(activeMode) {
    const activeColor = "blue";
    const inactiveColor = "gray";

    for (const modeName in modeButtons) {
        if (modeButtons.hasOwnProperty(modeName)) {
            const button = modeButtons[modeName];
            button.background = (modeName === activeMode) ? activeColor : inactiveColor;
        }
    }
}

export {
    createTopMenuBar,
    updateTopMenuBar
};
