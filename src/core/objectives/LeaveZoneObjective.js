import { Objective } from './Objective.js';

/**
 * @class LeaveZoneObjective
 * @extends Objective
 * @description Objective: leave the zone before the time runs out.
 *
 * @param {object} config - Objective configuration.
 * @param {string} config.id - Unique identifier.
 * @param {string} config.type - Objective type (ex: "leaveZone").
 * @param {string} config.displayName - Display name.
 * @param {string} config.targetId - ID prefix of objects to monitor.
 * @param {object} config.zone - Rectangular zone {x, y, width, height}.
 * @param {number} config.duration - Maximum time to leave the zone.
 */
export class LeaveZoneObjective extends Objective {
    constructor(config) {
        super(config);
        if (!config.targetId || !config.zone || typeof config.zone.x !== 'number' || typeof config.zone.y !== 'number' || typeof config.zone.width !== 'number' || typeof config.zone.height !== 'number' || typeof config.duration !== 'number' || config.duration <= 0) {
            throw new Error(`LeaveZoneObjective (id: ${this.id}) requires 'targetId', a valid 'zone' object {x, y, width, height}, and a positive 'duration' in config.`);
        }
        this.baseTargetId = config.targetId;
        this.zone = config.zone;
        this.maxDuration = config.duration;
        this.timer = 0;
        this.isFailed = false;
        this.statusText = `Leave the zone in less than ${this.maxDuration.toFixed(1)}s`;
    }

    reset() {
        super.reset();
        this.timer = 0;
        this.isFailed = false;
        this.isComplete = false;
        this.statusText = `Leave the zone in less than ${this.maxDuration.toFixed(1)}s`;
    }

    /**
     * Updates the objective: if the object leaves the zone before time runs out, objective is successful.
     * Otherwise, fails if time is up.
     */
    update(bodies, deltaTime, totalSimulationTime) {
        if (this.isComplete || this.isFailed) return;

        let foundAtLeastOneTarget = false;
        let allTargetsOutOfZone = true;

        for (const [id, body] of bodies) {
            if (id.startsWith(this.baseTargetId)) {
                foundAtLeastOneTarget = true;

                const pos = body.position;
                const zoneConfig = this.zone;
                const zoneMinX = zoneConfig.x - zoneConfig.width / 2;
                const zoneMaxX = zoneConfig.x + zoneConfig.width / 2;
                const zoneMinY = zoneConfig.y - zoneConfig.height / 2;
                const zoneMaxY = zoneConfig.y + zoneConfig.height / 2;

                const bodyIsInZone = pos.x >= zoneMinX && pos.x <= zoneMaxX &&
                                     pos.y >= zoneMinY && pos.y <= zoneMaxY;

                if (bodyIsInZone) {
                    allTargetsOutOfZone = false;
                }
            }
        }

        this.timer += deltaTime;

        if (!foundAtLeastOneTarget) {
            this.statusText = `Leave Zone: No object with prefix '${this.baseTargetId}' found.`;
            return;
        }

        if (allTargetsOutOfZone) {
            this.isComplete = true;
            this.statusText = `Objective completed: left the zone in ${this.timer.toFixed(1)}s`;
        } else if (this.timer >= this.maxDuration) {
            this.isFailed = true;
            this.statusText = `Failed: time expired without leaving the zone.`;
        } else {
            this.statusText = `Time remaining: ${(this.maxDuration - this.timer).toFixed(1)}s`;
        }
    }

    calculateStars(totalSimulationTimeAtLevelEnd) {
        this.starsEarned = 0;
        if (!this.isComplete || !this.config.starThresholds || !Array.isArray(this.config.starThresholds) || this.config.starThresholds.length === 0) {
            return;
        }
        const sortedThresholds = [...this.config.starThresholds].sort((a, b) => b.stars - a.stars);
        for (const threshold of sortedThresholds) {
            let conditionMet = true;
            if (threshold.completedWithinTime !== undefined) {
                if (this.timer > threshold.completedWithinTime) {
                    conditionMet = false;
                }
            }
            if (conditionMet) {
                this.starsEarned = threshold.stars;
                break;
            }
        }
    }
}
