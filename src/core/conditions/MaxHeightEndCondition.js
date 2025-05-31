import { Condition } from './Condition.js';
import { MaxHeightObjective } from '../objectives/MaxHeightObjective.js';

/**
 * @class MaxHeightEndCondition
 * @extends Condition
 * @description An end condition that is met when a target object, tracked by a
 * `MaxHeightObjective`, reaches a specified height, and then a certain delay passes, resetting the timer whenever a new maximum height is reached.
 *
 * @param {object} config - The configuration object for this condition.
 * @param {string} config.id - A unique identifier for this condition instance.
 * @param {string} config.type - The type of the condition (must be "maxHeightEnd").
 * @param {string} [config.displayName='Peak Performance'] - A user-friendly name for display.
 * @param {string} config.targetId - The `configId` (or base ID prefix) of the physics body to monitor.
 *                                   This is used to find the body directly if `objectiveTargetId` is not primary.
 * @param {string} [config.objectiveTargetId] - Optional. The ID of the `MaxHeightObjective` to primarily monitor.
 *                                             If provided, `targetHeight` might be relative to this objective's tracking.
 * @param {number} config.targetHeight - The Y-coordinate (height) that the object must reach.
 * @param {number} config.delayAfterDescent - Time in seconds to wait after the object starts descending
 *                                            from its peak (at or above `targetHeight`) before the condition is met.
 */
export class MaxHeightEndCondition extends Condition {
    /**
     * Creates an instance of MaxHeightEndCondition.
     * @param {object} config - Condition configuration from JSON.
     * @throws {Error} If essential config properties are missing or invalid.
     */
    constructor(config) {
        super(config);
        if (!config.targetId) {
            throw new Error(`MaxHeightEndCondition (id: ${this.id}) requires a 'targetId' in config.`);
        }
        if (typeof config.targetHeight !== 'number') {
            throw new Error(`MaxHeightEndCondition (id: ${this.id}) requires a 'targetHeight' (number) in config.`);
        }
        if (typeof config.delayAfterDescent !== 'number' || config.delayAfterDescent < 0) {
            throw new Error(`MaxHeightEndCondition (id: ${this.id}) requires a non-negative 'delayAfterDescent' in config.`);
        }

        this.targetId = config.targetId;
        this.objectiveTargetId = config.objectiveTargetId;
        this.targetHeight = config.targetHeight;
        this.delayAfterDescent = config.delayAfterDescent;

        this.displayName = config.displayName || 'Peak Performance';
        this.reachedPeak = false;
        this.descentTimer = 0;
    }

    /**
     * Resets the condition to its initial state.
     * @override
     */
    reset() {
        super.reset();
        this.reachedPeak = false;
        this.descentTimer = 0;
    }

    /**
     * Updates the condition's state.
     * Monitors the target object's height. Once `targetHeight` is reached, it starts a timer.
     * If the timer elapses without the object reaching a new maximum height, the condition is met.
     *
     * @param {Map<string, Matter.Body>} bodies - A map of all physics bodies.
     * @param {Array<Objective>} objectives - A list of active objectives.
     * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
     * @override
     */
    update(bodies, objectives, deltaTime) {
        if (this.isMet) return;

        let currentY = -Infinity;
        let targetBody = null;
        let maxHeightObj = null;

        if (this.objectiveTargetId) {
            maxHeightObj = objectives.find(obj => obj.id === this.objectiveTargetId && obj instanceof MaxHeightObjective);
            if (maxHeightObj) {
                currentY = maxHeightObj.currentMaxYValue;
            }
        }

        if (!maxHeightObj) {
            for (const [id, body] of bodies) {
                if (id.startsWith(this.targetId)) {
                    targetBody = body;
                    break;
                }
            }
        }

        if (targetBody && currentY === -Infinity) {
            currentY = targetBody.position.y;
        } else if (!targetBody && currentY === -Infinity) {
            return;
        }

        if (currentY >= this.targetHeight) {
            if (!this.reachedPeak) {
                this.reachedPeak = true;
            }

            let newMaxReached = false;
            if (maxHeightObj && currentY > maxHeightObj.currentMaxYValue) {
                newMaxReached = true;
            }

            if (newMaxReached) {
                this.descentTimer = 0;
            } else {
                this.descentTimer += deltaTime;
            }

            if (this.descentTimer >= this.delayAfterDescent) {
                this.isMet = true;
            }
        } else {
            this.reachedPeak = false;
            this.descentTimer = 0;
        }
    }

    /**
     * Disposes of resources used by this condition.
     * @override
     */
    dispose() {
        super.dispose();
    }
}
