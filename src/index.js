/**
 * @module index
 * @description Entry point for the Dreamland Physics application.
 * This module handles the initial setup of the UI, loading of scene configurations,
 * and initialization of the main simulation. It listens for the DOMContentLoaded event
 * to start the application.
 */
import { loadSceneConfig } from './utils/configLoader.js';
import { initSimulation } from './core/simulation.js';

/**
 * Event listener for the 'DOMContentLoaded' event.
 * This function serves as the main entry point for the application.
 * It performs the following steps:
 * 1. Calls `setupUI()` to create basic UI elements like the scene selector.
 * 2. Parses URL parameters to determine if a specific scene file is requested.
 * 3. Asynchronously loads the scene configuration using `loadSceneConfig`.
 * 4. Initializes the main simulation with the loaded configuration using `initSimulation`.
 * Includes error handling for the scene loading process.
 *
 * @async
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', async () => {
  setupUI();

  const urlParams = new URLSearchParams(window.location.search);
  const scenePath = urlParams.get('scene') || null;

  try {
    const { config, path } = await loadSceneConfig(scenePath);
    initSimulation(config, path);
  } catch (error) {
      console.error("Failed to load initial scene:", error);
  }
});

/**
 * Sets up the initial user interface elements for the application.
 * This function creates and appends a UI container to the document body,
 * The scene selector is populated with predefined scene options. When a scene is
 * selected, the page reloads with a `scene` URL parameter pointing to the
 * chosen scene's JSON configuration file. The selector also reflects the
 * currently loaded scene based on the URL.
 */
function setupUI() {
  const uiContainer = document.createElement('div');
  uiContainer.id = 'ui-container';
  uiContainer.style.position = 'absolute';
  uiContainer.style.top = '10px';
  uiContainer.style.right = '10px';
  uiContainer.style.padding = '10px';
  uiContainer.style.backgroundColor = 'rgba(0,0,0,0.7)';
  uiContainer.style.color = 'white';
  uiContainer.style.borderRadius = '5px';
  uiContainer.style.zIndex = '100';
  
  const title = document.createElement('h3');
  title.textContent = 'Dreamland Physics';
  title.style.margin = '0 0 10px 0';
  uiContainer.appendChild(title);
  
  const sceneSelector = document.createElement('select');
  sceneSelector.id = 'scene-selector';
  
  const scenes = [
    { name: 'Scène par défaut', value: '' },
    { name: 'Pendule simple', value: 'src/examples/basic_pendulum.json' },
    { name: 'Balles et boîtes', value: 'src/examples/balls_and_boxes.json' },
    { name: 'Pendule double', value: 'src/examples/double_pendulum.json' },
    { name: 'Tower', value: 'src/examples/tower.json' },
  ];
  
  scenes.forEach(scene => {
    const option = document.createElement('option');
    option.value = scene.value;
    option.textContent = scene.name;
    sceneSelector.appendChild(option);
  });
  
  sceneSelector.addEventListener('change', (e) => {
    if (e.target.value) {
      window.location.href = `?scene=${e.target.value}`;
    } else {
      window.location.href = window.location.pathname;
    }
  });
  
  const urlParams = new URLSearchParams(window.location.search);
  const currentScene = urlParams.get('scene');
  if (currentScene) {
    sceneSelector.value = currentScene;
  }
  
  const selectorContainer = document.createElement('div');
  selectorContainer.style.marginBottom = '10px';
  
  const label = document.createElement('label');
  label.htmlFor = 'scene-selector';
  label.textContent = 'Choisir une scène: ';
  selectorContainer.appendChild(label);
  selectorContainer.appendChild(sceneSelector);
  
  uiContainer.appendChild(selectorContainer);
  
  document.body.appendChild(uiContainer);
}
