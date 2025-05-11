/**
 * @module utils/configLoader
 * @description Provides functionality to load scene configurations from JSON files
 * or use a default configuration if a specific scene path is not provided or fails to load.
 */

/**
 * @constant {object} defaultConfig
 * @description A default scene configuration object used as a fallback.
 * Includes basic world properties, a couple of default objects, and a default inventory item.
 * @property {object} world - Default world settings.
 * @property {number} world.width - Default width of the world.
 * @property {number} world.height - Default height of the world.
 * @property {number} world.wallThickness - Default thickness of boundary walls.
 * @property {object} world.gravity - Default gravity vector.
 * @property {number} world.gravity.x - Default gravity on the x-axis.
 * @property {number} world.gravity.y - Default gravity on the y-axis.
 * @property {Array<object>} objects - Default list of objects in the scene.
 * @property {Array<object>} inventory - Default list of items available in the inventory.
 */
const defaultConfig = {
    world: {
        width: 800,
        height: 600,
        wallThickness: 60,
        gravity: { x: 0, y: -1 }
    },
    objects: [
        { id: "default_box", type: "box", x: 400, y: 300, width: 80, height: 80, depth: 80, restitution: 0.8, friction: 0.01, mass: 1, isStatic: false, color: { r: 0.8, g: 0.2, b: 0.2 } },
        { id: "default_circle", type: "circle", x: 500, y: 300, radius: 40, restitution: 0.9, friction: 0.01, mass: 1, isStatic: false, color: { r: 0.2, g: 0.6, b: 0.9 } }
    ],
    inventory: [
        {
            "id": "default_inv_sphere",
            "displayName": "Default Sphere",
            "count": 3,
            "objectProperties": {
                "type": "circle", "radius": 20, "mass": 0.7, "restitution": 0.7, "friction": 0.02, "color": { "r": 0.8, "g": 0.8, "b": 0.2 }
            }
        }
    ]
};

/**
 * Asynchronously loads a scene configuration from a specified JSON file path.
 * If `scenePath` is not provided or if loading fails, it falls back to a deep copy of `defaultConfig`.
 * Ensures that the loaded or default configuration object has essential top-level keys
 * (`world`, `objects`, `constraints`, `inventory`).
 *
 * @async
 * @param {string|null} scenePath - The path to the JSON configuration file. If null or undefined,
 *                                  the `defaultConfig` is used.
 * @returns {Promise<{config: object, path: string|null}>} A promise that resolves to an object
 *          containing the loaded (or default) configuration (`config`) and the path from which
 *          it was loaded (`path`), which will be `null` if the default config was used or loading failed.
 */
async function loadSceneConfig(scenePath) {
    if (scenePath) {
        try {
            console.log(`Fetching scene config from: ${scenePath}`);
            const response = await fetch(scenePath);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status} fetching ${scenePath}`);
            }
            const config = await response.json();
            console.log(`Successfully loaded config from: ${scenePath}`);
            config.world = config.world || {};
            config.objects = config.objects || [];
            config.constraints = config.constraints || [];
            config.inventory = config.inventory || [];
            return { config: config, path: scenePath };
        } catch (error) {
            console.error(`Error loading scene from ${scenePath}:`, error);
            console.warn("Falling back to default configuration.");
            return { config: JSON.parse(JSON.stringify(defaultConfig)), path: null };
        }
    } else {
        console.log("Loading default scene configuration.");
        return { config: JSON.parse(JSON.stringify(defaultConfig)), path: null };
    }
}

export { loadSceneConfig, defaultConfig };
