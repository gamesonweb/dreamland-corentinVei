/**
 * @class Objective
 * @abstract
 * @description Base abstract class for all simulation objectives.
 * It defines the common structure and methods that specific objective types must implement.
 * Objectives represent goals or conditions to be met or tracked within the simulation.
 *
 * @property {string} id - Unique identifier for the objective instance, from config.
 * @property {string} type - Type of the objective (e.g., "maxHeight", "stayInZone"), from config.
 * @property {string} displayName - User-friendly name for display in UI, from config or default.
 * @property {boolean} isComplete - Flag indicating if the objective has been successfully completed.
 * @property {boolean} isFailed - Flag indicating if the objective has been failed (optional, for objectives that can fail).
 * @property {string} statusText - A user-friendly string describing the current status or progress of the objective.
 */
export class Objective {
    /**
     * Initializes a new instance of an Objective.
     * This constructor should not be called directly on `Objective` itself, but rather
     * through `super(config)` in a subclass.
     *
     * @param {object} config - The objective configuration object, typically loaded from a JSON file.
     * @param {string} config.id - A unique identifier for this objective instance.
     * @param {string} config.type - The type of the objective.
     * @param {string} [config.displayName='Unnamed Objective'] - A user-friendly name for the objective.
     * @throws {Error} If `Objective` (the abstract class) is instantiated directly.
     */
    constructor(config) {
        if (this.constructor === Objective) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.id = config.id;
        this.type = config.type;
        this.displayName = config.displayName || 'Unnamed Objective';
        this.isComplete = false;
        this.isFailed = false;
        this.statusText = 'Pending';
    }

    /**
     * Resets the objective's state to its initial default values.
     * This method is typically called when the simulation starts or restarts.
     * Subclasses may override this to perform additional reset logic.
     */
    reset() {
        this.isComplete = false;
        this.isFailed = false;
        this.statusText = 'Pending';
        console.log(`Objective ${this.id} reset.`);
    }

    /**
     * Updates the objective's state based on the current state of the physics world.
     * This method is called on each frame of the simulation.
     * Subclasses MUST implement this method to define their specific logic for
     * checking conditions, updating progress, and setting `isComplete` or `isFailed` flags.
     *
     * @abstract
     * @param {Map<string, Matter.Body>} bodies - A map of all physics bodies currently in the simulation.
     *                                          The keys are `configId`s and values are `Matter.Body` instances.
     * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
     * @throws {Error} If not implemented by a subclass.
     */
    update(bodies, deltaTime) {
        throw new Error("Method 'update()' must be implemented by subclasses.");
    }

    /**
     * Returns an object representing the current status of the objective.
     * This is typically used by the UI to display information about the objective.
     *
     * @returns {{id: string, displayName: string, isComplete: boolean, isFailed: boolean, statusText: string}}
     *          An object containing the objective's ID, display name, completion status, failure status,
     *          and a descriptive status text.
     */
    getStatus() {
         return {
             id: this.id,
             displayName: this.displayName,
             isComplete: this.isComplete,
             isFailed: this.isFailed,
              statusText: this.statusText
          };
     }

     /**
      * Cleans up any resources created or used by the objective.
      * This method should be overridden by subclasses if they create disposable resources,
      * such as visual elements in the scene (e.g., meshes, materials).
      * Called when the objective is no longer needed, for example, when the simulation is reset
      * or a new scene is loaded.
      */
     dispose() {
     }
 }
