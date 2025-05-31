import { Condition } from './Condition.js';

/**
 * @class TimeLimitCondition
 * @extends Condition
 * @description An end condition that is met after a specified duration of simulation time has passed.
 *
 * @param {object} config - The configuration object for this condition.
 * @param {string} config.id - A unique identifier for this condition instance.
 * @param {string} config.type - The type of the condition (must be "timeLimit").
 * @param {string} [config.displayName='Time Limit'] - A user-friendly name for display.
 * @param {number} config.duration - The total time in seconds that must elapse for the condition to be met.
 * @param {boolean} [config.awaitsManualTrigger=false] - If true, the timer reaching zero makes a button appear rather than ending the level.
 * @param {string} [config.actionButtonText='Finish Level'] - Text for the manual trigger button if `awaitsManualTrigger` is true.
 */
export class TimeLimitCondition extends Condition {
    /**
     * Creates an instance of TimeLimitCondition.
     * @param {object} config - Condition configuration from JSON.
     * @throws {Error} If `config.duration` is not a positive number.
     */
    constructor(config) {
        super(config);
        if (typeof config.duration !== 'number' || config.duration <= 0) {
            throw new Error(`TimeLimitCondition (id: ${this.id}) requires a positive 'duration' in config.`);
        }
        this.duration = config.duration;
        this.timer = 0;
        this.remainingTime = this.duration;
        this.displayName = config.displayName || 'Time Limit';
        this.awaitsManualTrigger = config.awaitsManualTrigger || false;
        this.actionButtonText = config.actionButtonText || 'Finish Level';
        this.isTimeUp = false;
        console.log(`TimeLimitCondition (id: ${this.id}) initialized with awaitsManualTrigger: ${this.awaitsManualTrigger} (config value was: ${config.awaitsManualTrigger})`);
    }

    /**
     * Resets the condition to its initial state.
     * Sets the internal timer to 0, remainingTime to duration, and isTimeUp to false.
     * @override
     */
    reset() {
        super.reset();
        this.timer = 0;
        this.remainingTime = this.duration;
        this.isTimeUp = false;
    }

    /**
     * Updates the condition's state based on the elapsed time.
     * Increments the internal timer by `deltaTime`.
     * If `awaitsManualTrigger` is true:
     *   - When the timer exceeds `duration`, `isTimeUp` is set to true. `isMet` is not set.
     * If `awaitsManualTrigger` is false:
     *   - When the timer exceeds `duration`, `isMet` is set to true.
     *
     * @param {Map<string, Matter.Body>} bodies - A map of all physics bodies (unused by this condition).
     * @param {Array<Objective>} objectives - A list of active objectives (unused by this condition).
     * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
     * @override
     */
    update(bodies, objectives, deltaTime) {
        if (this.isMet || (this.awaitsManualTrigger && this.isTimeUp)) {
            this.remainingTime = Math.max(0, this.duration - this.timer);
            return;
        }

        this.timer += deltaTime;
        this.remainingTime = Math.max(0, this.duration - this.timer);

        if (this.timer >= this.duration) {
            this.timer = this.duration;
            this.remainingTime = 0;

            if (this.awaitsManualTrigger) {
                if (!this.isTimeUp) {
                    this.isTimeUp = true;
                    console.log(`TimeLimitCondition (id: ${this.id}) time is up. Awaiting manual trigger.`);
                }
            } else {
                this.isMet = true;
                console.log(`TimeLimitCondition (id: ${this.id}) met automatically.`);
            }
        }
    }

    /**
     * Manually triggers the condition to be met.
     * This is used when `awaitsManualTrigger` is true and the user clicks the button.
     */
    triggerManually() {
        if (this.awaitsManualTrigger && this.isTimeUp && !this.isMet) {
            this.isMet = true;
            console.log(`TimeLimitCondition (id: ${this.id}) triggered manually.`);
        } else if (!this.awaitsManualTrigger) {
            console.warn(`TimeLimitCondition (id: ${this.id}) was manually triggered but is not configured to await manual trigger.`);
        } else if (!this.isTimeUp) {
            console.warn(`TimeLimitCondition (id: ${this.id}) was manually triggered but time is not up yet.`);
        }
    }
    
    /**
     * Disposes of resources used by this condition.
     * (No specific resources to dispose for TimeLimitCondition beyond base).
     * @override
     */
    dispose() {
        super.dispose();
    }
}
