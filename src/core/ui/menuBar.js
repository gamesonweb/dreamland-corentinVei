import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture } from './uiCore.js';
import { loadSceneConfig } from '../../utils/configLoader.js';
import { initSimulation, currentScenePath, currentConfig } from '../simulation.js';
import { showBriefingPanel } from './briefingPanel.js';
import { showHintPanel } from './hintPanel.js';

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

    const briefingBtn = GUI.Button.CreateSimpleButton("briefingBtn", "Briefing");
    briefingBtn.width = "150px";
    briefingBtn.height = "100%";
    briefingBtn.color = "white";
    briefingBtn.background = "#28a745";
    briefingBtn.fontSize = 16;
    briefingBtn.paddingLeft = "5px";
    briefingBtn.paddingRight = "5px";
    briefingBtn.onPointerClickObservable.add(() => {
        showBriefingPanel();
    });
    topMenuBar.addControl(briefingBtn);

    const solutionBtn = GUI.Button.CreateSimpleButton("solutionBtn", "Save");
    solutionBtn.width = "150px";
    solutionBtn.height = "100%";
    solutionBtn.color = "white";
    solutionBtn.background = "#2288aa";
    solutionBtn.fontSize = 16;
    solutionBtn.paddingLeft = "10px";
    solutionBtn.paddingRight = "5px";
    solutionBtn.onPointerClickObservable.add(() => {
        showSolutionMenu();
    });
    topMenuBar.addControl(solutionBtn);

    const resetBtn = GUI.Button.CreateSimpleButton("resetLevelBtn", "Reset Level");
    resetBtn.width = "200px";
    resetBtn.height = "100%";
    resetBtn.color = "white";
    resetBtn.background = "#4444aa";
    resetBtn.fontSize = 16;
    resetBtn.paddingLeft = "20px";
    resetBtn.paddingRight = "5px";
    resetBtn.onPointerClickObservable.add(async () => {
        if (currentScenePath) {
            const storageKey = `puzzleshape_config_${currentScenePath}`;
            localStorage.removeItem(storageKey);
            const { config } = await loadSceneConfig(currentScenePath);
            initSimulation(config, currentScenePath, false);
        }
    });
    topMenuBar.addControl(resetBtn);
    const hintBtn = GUI.Button.CreateSimpleButton("hintBtn", "Hint");
    hintBtn.width = "150px";
    hintBtn.height = "100%";
    hintBtn.color = "white";
    hintBtn.background = "#8B0000";
    hintBtn.fontSize = 16;
    hintBtn.paddingLeft = "5px";
    hintBtn.paddingRight = "5px";
    hintBtn.onPointerClickObservable.add(() => {
        showHintPanel();
    });
    topMenuBar.addControl(hintBtn);

    updateTopMenuBar(initialMode);
    console.log("Top menu bar created.");
}

/**
 * Displays a Babylon.js GUI menu for saving and loading multiple named solutions for the current level.
 * Solutions are stored in localStorage. The menu allows users to:
 * - Name and save the current level configuration.
 * - View a list of previously saved solutions with their names and save dates.
 * - Load a selected solution, replacing the current level state.
 * - Delete a saved solution.
 * If the menu is already open, it is removed and recreated.
 * @private
 */
function showSolutionMenu() {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) return;

    const oldMenu = advancedTexture.getControlByName("solutionMenuPanel");
    if (oldMenu) advancedTexture.removeControl(oldMenu);

    const panel = new GUI.Rectangle("solutionMenuPanel");
    panel.width = "400px";
    panel.height = "420px";
    panel.cornerRadius = 12;
    panel.color = "white";
    panel.thickness = 2;
    panel.background = "rgba(30, 30, 60, 0.96)";
    panel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    advancedTexture.addControl(panel);

    const stack = new GUI.StackPanel();
    stack.width = "92%";
    stack.paddingTop = "18px";
    panel.addControl(stack);

    const title = new GUI.TextBlock("solutionMenuTitle", "Saved Solutions");
    title.height = "32px";
    title.color = "white";
    title.fontSize = 20;
    title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    stack.addControl(title);

    const nameInput = new GUI.InputText();
    nameInput.width = "95%";
    nameInput.height = "36px";
    nameInput.color = "white";
    nameInput.background = "#222244";
    nameInput.fontSize = 16;
    nameInput.placeholderText = "Solution name...";
    nameInput.marginTop = "10px";
    stack.addControl(nameInput);

    const saveBtn = GUI.Button.CreateSimpleButton("saveSolutionBtn", "Save solution");
    saveBtn.height = "38px";
    saveBtn.color = "white";
    saveBtn.background = "#22aa44";
    saveBtn.fontSize = 16;
    saveBtn.marginTop = "8px";
    saveBtn.onPointerClickObservable.add(() => {
        const name = nameInput.text.trim();
        if (currentScenePath && currentConfig && name) {
            const key = `puzzleshape_solutions_${currentScenePath}`;
            let arr = [];
            try {
                arr = JSON.parse(localStorage.getItem(key)) || [];
            } catch {}
            arr.push({
                name,
                date: new Date().toISOString(),
                config: currentConfig
            });
            localStorage.setItem(key, JSON.stringify(arr));
            nameInput.text = "";
            refreshSolutionList();
        }
    });
    stack.addControl(saveBtn);

    const listTitle = new GUI.TextBlock("listTitle", "Available solutions:");
    listTitle.height = "28px";
    listTitle.color = "white";
    listTitle.fontSize = 16;
    listTitle.marginTop = "18px";
    stack.addControl(listTitle);

    const listPanel = new GUI.StackPanel();
    listPanel.width = "100%";
    listPanel.isVertical = true;
    stack.addControl(listPanel);

    /**
     * Refreshes the list of saved solutions displayed in the menu.
     * Clears the current list and repopulates it with solutions from localStorage.
     * @private
     */
    function refreshSolutionList() {
        listPanel.clearControls();
        if (!currentScenePath) return;
        const key = `puzzleshape_solutions_${currentScenePath}`;
        let arr = [];
        try {
            arr = JSON.parse(localStorage.getItem(key)) || [];
        } catch {}
        if (arr.length === 0) {
            const empty = new GUI.TextBlock("emptySol", "No saved solution.");
            empty.height = "28px";
            empty.color = "#bbb";
            empty.fontSize = 14;
            listPanel.addControl(empty);
            return;
        }
        arr.forEach((sol, idx) => {
            const row = new GUI.StackPanel();
            row.isVertical = false;
            row.height = "36px";
            row.paddingBottom = "4px";
            // Name
            const nameTxt = new GUI.TextBlock();
            nameTxt.text = sol.name;
            nameTxt.width = "120px";
            nameTxt.color = "white";
            nameTxt.fontSize = 15;
            nameTxt.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            row.addControl(nameTxt);
            // Date
            const dateTxt = new GUI.TextBlock();
            dateTxt.text = sol.date ? new Date(sol.date).toLocaleString() : "";
            dateTxt.width = "110px";
            dateTxt.color = "#aaa";
            dateTxt.fontSize = 13;
            dateTxt.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            row.addControl(dateTxt);
            // Load
            const loadBtn = GUI.Button.CreateSimpleButton(`loadSolBtn_${idx}`, "Load");
            loadBtn.width = "60px";
            loadBtn.height = "28px";
            loadBtn.color = "white";
            loadBtn.background = "#aa8822";
            loadBtn.fontSize = 13;
            loadBtn.onPointerClickObservable.add(() => {
                initSimulation(sol.config, currentScenePath, false);
                panel.isVisible = false;
                advancedTexture.removeControl(panel);
            });
            row.addControl(loadBtn);
            // Delete
            const delBtn = GUI.Button.CreateSimpleButton(`delSolBtn_${idx}`, "Delete");
            delBtn.width = "60px";
            delBtn.height = "28px";
            delBtn.color = "white";
            delBtn.background = "#aa2222";
            delBtn.fontSize = 13;
            delBtn.onPointerClickObservable.add(() => {
                arr.splice(idx, 1);
                localStorage.setItem(key, JSON.stringify(arr));
                refreshSolutionList();
            });
            row.addControl(delBtn);
            listPanel.addControl(row);
        });
    }
    refreshSolutionList();

    const closeBtn = GUI.Button.CreateSimpleButton("closeSolutionMenuBtn", "Close");
    closeBtn.height = "36px";
    closeBtn.color = "white";
    closeBtn.background = "#222244";
    closeBtn.fontSize = 15;
    closeBtn.marginTop = "18px";
    closeBtn.onPointerClickObservable.add(() => {
        panel.isVisible = false;
        advancedTexture.removeControl(panel);
    });
    stack.addControl(closeBtn);
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
