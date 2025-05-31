/**
 * @class Condition
 * @abstract
 * @description Base abstract class for all simulation end conditions.
 * It defines the common structure and methods that specific condition types must implement.
 * Conditions represent criteria that, when met, can trigger the end of a level or simulation phase.
 *
 * @property {string} id - Unique identifier for the condition instance, from config.
 * @property {string} type - Type of the condition (e.g., "timeLimit", "stayInZoneEnd"), from config.
 * @property {string} displayName - User-friendly name for display, from config or default.
 * @property {boolean} isMet - Flag indicating if the condition has been met.
 */
export class Condition {
    /**
     * Initializes a new instance of a Condition.
     * This constructor should not be called directly on `Condition` itself, but rather
     * through `super(config)` in a subclass.
     *
     * @param {object} config - The condition configuration object, typically loaded from a JSON file.
     * @param {string} config.id - A unique identifier for this condition instance.
     * @param {string} config.type - The type of the condition.
     * @param {string} [config.displayName='Unnamed Condition'] - A user-friendly name for the condition.
     * @throws {Error} If `Condition` (the abstract class) is instantiated directly.
     */
    constructor(config) {
        if (this.constructor === Condition) {
            throw new Error("Abstract classes can't be instantiated.");
        }
        this.id = config.id;
        this.type = config.type;
        this.displayName = config.displayName || 'Unnamed Condition';
        this.isMet = false;
    }

    /**
     * Resets the condition's state to its initial default values.
     * This method is typically called when the simulation starts or restarts.
     * Subclasses may override this to perform additional reset logic.
     */
    reset() {
        this.isMet = false;
        console.log(`Condition ${this.id} reset.`);
    }

    /**
     * Updates the condition's state based on the current state of the simulation.
     * This method is called on each frame of the simulation when active.
     * Subclasses MUST implement this method to define their specific logic for
     * checking criteria and setting the `isMet` flag.
     *
     * @abstract
     * @param {Map<string, Matter.Body>} bodies - A map of all physics bodies currently in the simulation.
     * @param {Array<Objective>} objectives - A list of active objectives in the simulation.
     * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
     * @throws {Error} If not implemented by a subclass.
     */
    update(bodies, objectives, deltaTime) {
        throw new Error("Method 'update()' must be implemented by subclasses.");
    }

    /**
     * Cleans up any resources created or used by the condition.
     * This method should be overridden by subclasses if they create disposable resources.
     * Called when the condition is no longer needed, for example, when the simulation is reset
     * or a new scene is loaded.
     */
    dispose() {
        console.log(`Condition ${this.id} disposed.`);
    }
}
