/**
 * @module index
 * @description Entry point for the Dreamland Physics application.
 * This module handles the initial setup of the UI, loading of scene configurations,
 * and initialization of the main simulation. It listens for the DOMContentLoaded event
 * to start the application.
 */
import { loadSceneConfig } from './utils/configLoader.js';
import { initSimulation } from './core/simulation.js';
import { setupBackgroundMusicPlayer } from './core/musicPlayer.js';
import { initAudio } from './core/soundManager.js';
import { createMainMenu, showMainMenu } from './core/ui/mainMenu.js';
import { createSettingsMenu } from './core/ui/settingsMenuBabylon.js';
import { initializeBabylon, getScene, disableCameraControls } from './core/sceneManager.js';

/**
 * Event listener for the 'DOMContentLoaded' event.
 * This function serves as the main entry point for the application.
 * It performs the following steps:
 * 1. Initializes the Babylon.js engine and scene.
 * 2. Initializes audio and background music.
 * 3. Creates and shows the main menu.
 *
 * @async
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  initializeBabylon({});

  initAudio();
  setupBackgroundMusicPlayer();

  const scene = getScene();
  if (scene) {
      createMainMenu(scene);
      createSettingsMenu(scene);
      showMainMenu();
      disableCameraControls();
  } else {
      console.error("Babylon scene not available for creating main menu.");
  }
});
