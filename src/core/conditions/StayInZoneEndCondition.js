import { Condition } from './Condition.js';

/**
 * @class StayInZoneEndCondition
 * @extends Condition
 * @description An end condition that is met when a specified 'StayInZoneObjective'
 * has been completed, and an additional delay has passed.
 *
 * @param {object} config - The configuration object for this condition.
 * @param {string} config.id - A unique identifier for this condition instance.
 * @param {string} config.type - The type of the condition (must be "stayInZoneEnd").
 * @param {string} [config.displayName='Secure Zone'] - A user-friendly name for display.
 * @param {string} config.objectiveTargetId - The ID of the `StayInZoneObjective` to monitor.
 * @param {number} config.duration - The additional time in seconds to wait after the
 *                                   target objective is completed before this condition is met.
 */
export class StayInZoneEndCondition extends Condition {
    /**
     * Creates an instance of StayInZoneEndCondition.
     * @param {object} config - Condition configuration from JSON.
     * @throws {Error} If `config.objectiveTargetId` is missing or `config.duration` is not a non-negative number.
     */
    constructor(config) {
        super(config);
        if (!config.objectiveTargetId) {
            throw new Error(`StayInZoneEndCondition (id: ${this.id}) requires an 'objectiveTargetId' in config.`);
        }
        if (typeof config.duration !== 'number' || config.duration < 0) {
            throw new Error(`StayInZoneEndCondition (id: ${this.id}) requires a non-negative 'duration' in config.`);
        }
        this.objectiveTargetId = config.objectiveTargetId;
        this.duration = config.duration;
        this.timer = 0;
        this.targetObjectiveCompleted = false;
        this.displayName = config.displayName || 'Secure Zone';
    }

    /**
     * Resets the condition to its initial state.
     * Resets the timer and the flag indicating if the target objective was completed.
     * @override
     */
    reset() {
        super.reset();
        this.timer = 0;
        this.targetObjectiveCompleted = false;
    }

    /**
     * Updates the condition's state.
     * First, it checks if the linked `StayInZoneObjective` (identified by `objectiveTargetId`)
     * is complete. If so, it starts an internal timer for the specified `duration`.
     * The condition is met once this timer elapses.
     *
     * @param {Map<string, Matter.Body>} bodies - A map of all physics bodies (unused by this condition).
     * @param {Array<Objective>} objectives - A list of active objectives in the simulation.
     * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
     * @override
     */
    update(bodies, objectives, deltaTime) {
        if (this.isMet) return;

        if (!this.targetObjectiveCompleted) {
            const targetObjective = objectives.find(obj => obj.id === this.objectiveTargetId && obj.type === 'stayInZone');
            if (targetObjective && targetObjective.isComplete) {
                this.targetObjectiveCompleted = true;
                console.log(`StayInZoneEndCondition (id: ${this.id}): Target objective ${this.objectiveTargetId} completed. Starting delay timer.`);
                if (this.duration === 0) {
                    this.isMet = true;
                    console.log(`StayInZoneEndCondition (id: ${this.id}) met (0s delay).`);
                    return;
                }
            } else if (!targetObjective) {
                if (!this.warnedObjectiveMissing) {
                    console.warn(`StayInZoneEndCondition (id: ${this.id}): Target objective ${this.objectiveTargetId} not found or not a StayInZoneObjective.`);
                    this.warnedObjectiveMissing = true; 
                }
                return;
            }
        }

        if (this.targetObjectiveCompleted) {
            this.timer += deltaTime;
            if (this.timer >= this.duration) {
                this.isMet = true;
                this.timer = this.duration;
                console.log(`StayInZoneEndCondition (id: ${this.id}) met after delay.`);
            }
        }
    }

    /**
     * Disposes of resources used by this condition.
     * (No specific resources to dispose for StayInZoneEndCondition beyond base).
     * @override
     */
    dispose() {
        super.dispose();
    }
}
