import { Objective } from './Objective.js';

/**
 * @class StayInZoneObjective
 * @extends Objective
 * @description An objective that requires at least one physics body (whose `configId` starts
 * with a specified `baseTargetId`) to remain within a defined rectangular zone for a
 * cumulative `duration`. If all matching targets leave the zone, the timer resets.
 *
 * @param {object} config - The configuration object for this objective.
 * @param {string} config.id - A unique identifier for this objective instance.
 * @param {string} config.type - The type of the objective (e.g., "stayInZone").
 * @param {string} config.displayName - A user-friendly name for display in the UI.
 * @param {string} config.targetId - The base ID prefix of the object(s) to track.
 *                                   Any body whose `configId` starts with this string will be considered.
 * @param {object} config.zone - Defines the rectangular zone.
 * @param {number} config.zone.x - The x-coordinate of the zone's bottom-left corner.
 * @param {number} config.zone.y - The y-coordinate of the zone's bottom-left corner.
 * @param {number} config.zone.width - The width of the zone.
 * @param {number} config.zone.height - The height of the zone.
 * @param {number} config.duration - The total time (in seconds) a target object must spend
 *                                   consecutively within the zone to complete the objective.
 */
export class StayInZoneObjective extends Objective {
    /**
     * Creates an instance of StayInZoneObjective.
     * Initializes the zone, required duration, and tracking variables.
     *
     * @param {object} config - Objective configuration from JSON.
     * @param {string} config.targetId - The base ID prefix of the object(s) to track.
     * @param {object} config.zone - The rectangular zone definition {x, y, width, height}.
     * @param {number} config.duration - Required time in seconds to stay in the zone.
     * @throws {Error} If `config.targetId`, `config.zone` (with all its properties), or `config.duration`
     *                 are missing or invalid.
     */
    constructor(config) {
        super(config);
        if (!config.targetId || !config.zone || typeof config.zone.x !== 'number' || typeof config.zone.y !== 'number' || typeof config.zone.width !== 'number' || typeof config.zone.height !== 'number' || typeof config.duration !== 'number' || config.duration <= 0) {
            throw new Error(`StayInZoneObjective (id: ${this.id}) requires 'targetId' (base ID), a valid 'zone' object {x, y, width, height}, and a positive 'duration' in config.`);
        }
        this.baseTargetId = config.targetId;
        this.zone = config.zone;
        this.requiredDuration = config.duration;
        this.timeSpentInZone = 0;
        this.reset();
    }

    /**
     * Resets the objective to its initial state.
     * Sets `timeSpentInZone` to 0 and updates the `statusText`.
     * @override
     */
    reset() {
        super.reset();
        this.timeSpentInZone = 0;
        this.statusText = `Time in Zone: 0.0 / ${this.requiredDuration.toFixed(1)}s`;
    }

    /**
     * Updates the objective's state based on the current positions of physics bodies.
     * It checks if any of the target bodies (matching `baseTargetId`) are within the defined `zone`.
     * If at least one target is in the zone, `timeSpentInZone` is incremented by `deltaTime`.
     * If `timeSpentInZone` reaches `requiredDuration`, the objective is marked as complete.
     * If no target bodies are found, or if all target bodies leave the zone, `timeSpentInZone` is reset.
     *
     * @param {Map<string, Matter.Body>} bodies - A map of all physics bodies in the simulation,
     *                                          where keys are `configId`s and values are `Matter.Body` instances.
     * @param {number} deltaTime - Time elapsed since the last frame, in seconds.
     * @override
     */
    update(bodies, deltaTime) {
        if (this.isComplete || this.isFailed) return;

        let atLeastOneTargetInZone = false;
        let foundAtLeastOneTarget = false;

        for (const [id, body] of bodies) {
            if (id.startsWith(this.baseTargetId)) {
                foundAtLeastOneTarget = true;

                const pos = body.position;
                const zone = this.zone;
                const bodyIsInZone = pos.x >= zone.x && pos.x <= zone.x + zone.width &&
                                   pos.y >= zone.y && pos.y <= zone.y + zone.height;

                if (bodyIsInZone) {
                    atLeastOneTargetInZone = true;
                    break;
                }
            }
        }

        if (!foundAtLeastOneTarget) {
            this.statusText = `Stay in Zone: No target starting with '${this.baseTargetId}' found.`;
            if (this.timeSpentInZone > 0) {
                this.timeSpentInZone = 0;
            }
            return;
        }

        if (atLeastOneTargetInZone) {
            this.timeSpentInZone += deltaTime;
            if (this.timeSpentInZone >= this.requiredDuration) {
                this.timeSpentInZone = this.requiredDuration;
                this.isComplete = true;
                this.statusText = `Stay in Zone: Complete! (${this.requiredDuration.toFixed(1)}s)`;
            } else {
                 this.statusText = `Time in Zone: ${this.timeSpentInZone.toFixed(1)} / ${this.requiredDuration.toFixed(1)}s`;
            }
        } else {
            if (this.timeSpentInZone > 0) {
                 this.timeSpentInZone = 0;
                 this.statusText = `Time in Zone: 0.0 / ${this.requiredDuration.toFixed(1)}s`;
            }
        }
    }

}
