import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture } from './uiCore.js';
import { setMusicVolume } from '../musicPlayer.js';
import { setSoundEffectsVolume } from '../soundManager.js';
import { returnToMainMenu, isSimulationRunning } from '../simulation.js';
import { disableCameraControls, enableCameraControls } from '../sceneManager.js';

const MUSIC_VOLUME_KEY = 'settings_musicVolume';
const SFX_VOLUME_KEY = 'settings_sfxVolume';

let settingsPanel = null;
let musicVolumeSlider = null;
let sfxVolumeSlider = null;

function createSettingsMenu(scene) {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        console.error("Settings Menu: AdvancedDynamicTexture not available.");
        return;
    }

    if (settingsPanel) {
        settingsPanel.dispose();
        settingsPanel = null;
    }

    settingsPanel = new GUI.Rectangle("settingsPanel");
    settingsPanel.width = "320px";
    settingsPanel.height = "270px";
    settingsPanel.cornerRadius = 20;
    settingsPanel.color = "Orange";
    settingsPanel.thickness = 2;
    settingsPanel.background = "rgba(0, 0, 0, 0.85)";
    settingsPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    settingsPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    settingsPanel.zIndex = 200;
    settingsPanel.isVisible = false;
    advancedTexture.addControl(settingsPanel);

    const mainStack = new GUI.StackPanel("mainSettingsStack");
    mainStack.width = "100%";
    mainStack.isVertical = true;
    mainStack.paddingTop = "10px";
    mainStack.paddingBottom = "10px";
    mainStack.paddingLeft = "15px";
    mainStack.paddingRight = "15px";
    settingsPanel.addControl(mainStack);


    const titleText = new GUI.TextBlock("titleText", "Settings");
    titleText.color = "white";
    titleText.fontSize = 22;
    titleText.height = "40px";
    titleText.paddingBottom = "10px";
    mainStack.addControl(titleText);


    const musicGrid = new GUI.Grid("musicGrid");
    musicGrid.width = "100%";
    musicGrid.height = "60px";
    musicGrid.addColumnDefinition(0.45);
    musicGrid.addColumnDefinition(0.55);
    mainStack.addControl(musicGrid);

    const musicLabel = new GUI.TextBlock("musicLabel", "Music Volume:");
    musicLabel.color = "white";
    musicLabel.fontSize = 16;
    musicLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    musicLabel.paddingRight = "10px";
    musicGrid.addControl(musicLabel, 0, 0);

    musicVolumeSlider = new GUI.Slider("musicVolumeSlider");
    musicVolumeSlider.minimum = 0;
    musicVolumeSlider.maximum = 1;
    musicVolumeSlider.value = parseFloat(localStorage.getItem(MUSIC_VOLUME_KEY) || "0.75");
    musicVolumeSlider.height = "20px";
    musicVolumeSlider.width = "100%";
    musicVolumeSlider.color = "Orange";
    musicVolumeSlider.background = "gray";
    musicVolumeSlider.thumbWidth = "20px";
    musicGrid.addControl(musicVolumeSlider, 0, 1);

    setMusicVolume(musicVolumeSlider.value);

    musicVolumeSlider.onValueChangedObservable.add((value) => {
        setMusicVolume(value);
        localStorage.setItem(MUSIC_VOLUME_KEY, value.toString());
    });


    const sfxGrid = new GUI.Grid("sfxGrid");
    sfxGrid.width = "100%";
    sfxGrid.height = "60px";
    sfxGrid.addColumnDefinition(0.45);
    sfxGrid.addColumnDefinition(0.55);
    mainStack.addControl(sfxGrid);

    const sfxLabel = new GUI.TextBlock("sfxLabel", "SFX Volume:");
    sfxLabel.color = "white";
    sfxLabel.fontSize = 16;
    sfxLabel.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    sfxLabel.paddingRight = "10px";
    sfxGrid.addControl(sfxLabel, 0, 0);

    sfxVolumeSlider = new GUI.Slider("sfxVolumeSlider");
    sfxVolumeSlider.minimum = 0;
    sfxVolumeSlider.maximum = 1;
    sfxVolumeSlider.value = parseFloat(localStorage.getItem(SFX_VOLUME_KEY) || "0.75");
    sfxVolumeSlider.height = "20px";
    sfxVolumeSlider.width = "100%";
    sfxVolumeSlider.color = "Orange";
    sfxVolumeSlider.background = "gray";
    sfxVolumeSlider.thumbWidth = "20px";
    sfxGrid.addControl(sfxVolumeSlider, 0, 1);

    setSoundEffectsVolume(sfxVolumeSlider.value);

    sfxVolumeSlider.onValueChangedObservable.add((value) => {
        setSoundEffectsVolume(value);
        localStorage.setItem(SFX_VOLUME_KEY, value.toString());
    });
    
    const closeButton = GUI.Button.CreateSimpleButton("closeSettingsButton", "Close");
    closeButton.width = "100px";
    closeButton.height = "40px";
    closeButton.color = "white";
    closeButton.background = "DimGray";
    closeButton.paddingTop = "10px";
    closeButton.onPointerUpObservable.add(() => {
        toggleSettingsMenuVisibility();
    });
    mainStack.addControl(closeButton);

    const quitButton = GUI.Button.CreateSimpleButton("quitButton", "Quit");
    quitButton.width = "100px";
    quitButton.height = "40px";
    quitButton.color = "white";
    quitButton.background = "DarkRed";
    quitButton.paddingTop = "10px";
    quitButton.onPointerUpObservable.add(() => {
        toggleSettingsMenuVisibility();
        returnToMainMenu();
    });
    mainStack.addControl(quitButton);


    console.log("Settings menu created with revised layout.");
}

function toggleSettingsMenuVisibility() {
    if (settingsPanel) {
        settingsPanel.isVisible = !settingsPanel.isVisible;
        console.log(`Settings menu visibility toggled to: ${settingsPanel.isVisible}`);
        if (settingsPanel.isVisible) {
            disableCameraControls();
            if (musicVolumeSlider) {
                 const storedMusicVol = parseFloat(localStorage.getItem(MUSIC_VOLUME_KEY) || "0.75");
                 if (musicVolumeSlider.value !== storedMusicVol) musicVolumeSlider.value = storedMusicVol;
                 setMusicVolume(musicVolumeSlider.value);
            }
            if (sfxVolumeSlider) {
                const storedSfxVol = parseFloat(localStorage.getItem(SFX_VOLUME_KEY) || "0.75");
                if(sfxVolumeSlider.value !== storedSfxVol) sfxVolumeSlider.value = storedSfxVol;
                setSoundEffectsVolume(sfxVolumeSlider.value);
            }
        } else {
            if (isSimulationRunning()) {
                enableCameraControls(); 
            }
        }
    } else {
        console.warn("Cannot toggle settings menu: panel not initialized.");
    }
}

function hideSettingsMenu() {
    if (settingsPanel && settingsPanel.isVisible) {
        settingsPanel.isVisible = false;
        if (isSimulationRunning()) {
            enableCameraControls();
        }
        console.log("Settings menu hidden explicitly.");
    } else if (settingsPanel) {
        settingsPanel.isVisible = false;
    }
}

export { createSettingsMenu, toggleSettingsMenuVisibility, hideSettingsMenu };
