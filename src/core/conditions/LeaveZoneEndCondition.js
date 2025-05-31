import { Condition } from './Condition.js';

/**
 * @class LeaveZoneEndCondition
 * @extends Condition
 * @description Condition is met if the target objective (e.g., StayInZoneObjective) is interrupted (meaning zone exit)
 * before the time limit. If the duration is exceeded and the entity is still in the zone, the condition fails.
 *
 * @param {object} config - The condition configuration.
 * @param {string} config.id - Unique identifier for this condition.
 * @param {string} config.type - Type of the condition (must be "leaveZoneEnd").
 * @param {string} [config.displayName='Leave the zone'] - Display name.
 * @param {string} config.objectiveTargetId - ID of the objective to monitor.
 * @param {number} config.duration - Maximum time (in seconds) to leave the zone.
 */
export class LeaveZoneEndCondition extends Condition {
    constructor(config) {
        super(config);
        if (!config.objectiveTargetId) {
            throw new Error(`LeaveZoneEndCondition (id: ${this.id}) requires an 'objectiveTargetId' in config.`);
        }
        if (typeof config.duration !== 'number' || config.duration < 0) {
            throw new Error(`LeaveZoneEndCondition (id: ${this.id}) requires a non-negative 'duration' in config.`);
        }
        this.objectiveTargetId = config.objectiveTargetId;
        this.duration = config.duration;
        this.timer = 0;
        this.targetObjectiveCompleted = false;
        this.displayName = config.displayName || 'Leave the zone';
    }

    /**
     * Resets the condition to its initial state.
     */
    reset() {
        super.reset();
        this.timer = 0;
        this.targetObjectiveCompleted = false;
    }

    /**
     * Updates the condition state.
     * Waits for the leaveZone objective to be completed, then starts a timer (duration).
     * The condition is met once the timer has elapsed.
     * 
     * @param {Map<string, Matter.Body>} bodies - A map of all physics bodies currently in the simulation.
     * @param {Array<Objective>} objectives - A list of active objectives in the simulation.
     * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
     */
    update(bodies, objectives, deltaTime) {
        if (this.isMet) return;

        if (!this.targetObjectiveCompleted) {
            const targetObjective = objectives.find(obj => obj.id === this.objectiveTargetId && obj.type === 'leaveZone');
            if (targetObjective && targetObjective.isComplete) {
                this.targetObjectiveCompleted = true;
                console.log(`LeaveZoneEndCondition (id: ${this.id}): Target objective ${this.objectiveTargetId} completed. Starting delay timer.`);
                if (this.duration === 0) {
                    this.isMet = true;
                    console.log(`LeaveZoneEndCondition (id: ${this.id}) met (0s delay).`);
                    return;
                }
            } else if (!targetObjective) {
                if (!this.warnedObjectiveMissing) {
                    console.warn(`LeaveZoneEndCondition (id: ${this.id}): Target objective ${this.objectiveTargetId} not found or not a LeaveZoneObjective.`);
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
                console.log(`LeaveZoneEndCondition (id: ${this.id}) met after delay.`);
            }
        }
    }

    /**
     * Performs cleanup when the condition is no longer needed.
     */
    dispose() {
        super.dispose();
    }
}
