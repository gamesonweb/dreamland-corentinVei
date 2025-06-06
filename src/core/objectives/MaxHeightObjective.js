import * as BABYLON from '@babylonjs/core';
import { Objective } from './Objective.js';

/**
 * @class MaxHeightObjective
 * @extends Objective
 * @description An objective that tracks the maximum Y-coordinate (highest point) reached by any
 * physics body whose `configId` starts with a specified `baseTargetId`.
 * It displays a visual line in the scene indicating this highest point.
 * In a Y-up coordinate system (like Matter.js default), a higher Y value means a higher point.
 *
 * @param {object} config - The configuration object for this objective.
 * @param {string} config.id - A unique identifier for this objective instance.
 * @param {string} config.type - The type of the objective (e.g., "maxHeight").
 * @param {string} config.displayName - A user-friendly name for display in the UI.
 * @param {string} config.targetId - The base ID prefix of the object(s) to track.
 *                                   Any body whose `configId` starts with this string will be considered.
 * @param {BABYLON.Scene} scene - The Babylon.js scene instance, used for creating the visual line.
 * @param {object} worldConfig - The world configuration object, used to get simulation bounds
 *                               for positioning and sizing the visual line.
 * @param {object} worldConfig.simulationBounds - Defines the boundaries of the simulation area.
 * @param {number} worldConfig.simulationBounds.x - The x-coordinate of the simulation area's origin.
 * @param {number} worldConfig.simulationBounds.width - The width of the simulation area.
 */
export class MaxHeightObjective extends Objective {
    /**
     * Creates an instance of MaxHeightObjective.
     * Initializes tracking variables and creates a visual line mesh in the scene.
     * @param {object} config - Objective configuration from JSON.
     * @param {string} config.targetId - The ID of the object to track.
     * @param {BABYLON.Scene} scene - The Babylon scene to add the line mesh to.
     * @param {object} worldConfig - The world configuration (for bounds).
     */
    constructor(config, scene, worldConfig) {
        super(config);
        if (!config.targetId) {
            throw new Error(`MaxHeightObjective (id: ${this.id}) requires a 'targetId' (base ID) in config.`);
        }
        if (!scene) {
            throw new Error(`MaxHeightObjective (id: ${this.id}) requires a 'scene' instance.`);
        }
        if (!worldConfig?.simulationBounds) {
            throw new Error(`MaxHeightObjective (id: ${this.id}) requires 'worldConfig' with 'simulationBounds'.`);
        }

        this.baseTargetId = config.targetId;
        this.currentMaxYValue = -Infinity;
        this.maxHeightLineMesh = null;
        this.scene = scene;
        this.achievedHeightTimes = {};

        const simBounds = worldConfig.simulationBounds;
        const lineWidth = simBounds.width;
        const linePoints = [
            new BABYLON.Vector3(simBounds.x, 0, 10),
            new BABYLON.Vector3(simBounds.x + lineWidth, 0, 10)
        ];
        this.maxHeightLineMesh = BABYLON.MeshBuilder.CreateLines(
            `maxHeightLine_${this.id}`,
            { points: linePoints, updatable: true },
            this.scene
        );
        const lineMaterial = new BABYLON.StandardMaterial(`maxHeightLineMat_${this.id}`, this.scene);
        lineMaterial.emissiveColor = new BABYLON.Color3(1, 0, 0);
        lineMaterial.disableLighting = true;
        lineMaterial.alpha = 0.8;
        this.maxHeightLineMesh.material = lineMaterial;
        this.maxHeightLineMesh.isPickable = false;

        this.reset();
    }

    /**
     * Resets the objective to its initial state.
     * Sets the `currentMaxYValue` to negative infinity, updates the `statusText`,
     * and hides the visual line mesh.
     * @override
     */
    reset() {
        super.reset();
        this.currentMaxYValue = -Infinity;
        this.statusText = `Highest Point (Max Y): Tracking...`;
        this.achievedHeightTimes = {};

        if (this.maxHeightLineMesh && !this.maxHeightLineMesh.isDisposed()) {
            this.maxHeightLineMesh.setEnabled(false);
        }
    }

    /**
     * Updates the objective's state based on the current positions of physics bodies.
     * It iterates through all bodies, finds those matching the `baseTargetId`,
     * and determines the maximum Y-coordinate among them. If this value is greater
     * than `currentMaxYValue`, it updates `currentMaxYValue`, the `statusText`,
     * and the position of the visual line. It also records the time when specific
     * height thresholds are met.
     *
     * @param {Map<string, Matter.Body>} bodies - A map of all physics bodies in the simulation.
     * @param {number} deltaTime - Time elapsed since the last frame.
     * @param {number} totalSimulationTime - The total time elapsed in the current simulation run.
     * @override
     */
    update(bodies, deltaTime, totalSimulationTime) {
        if (this.isComplete || this.isFailed) return;

        let lowestMatchingBody = null;
        let overallMaxY = -Infinity;

        for (const [id, body] of bodies) {
            if (id.startsWith(this.baseTargetId)) {
                if (body.position.y > overallMaxY) {
                    overallMaxY = body.position.y;
                    lowestMatchingBody = body;
                }
            }
        }

        if (!lowestMatchingBody) {
            this.statusText = `No target starting with '${this.baseTargetId}' found.`;
            if (this.maxHeightLineMesh && !this.maxHeightLineMesh.isDisposed() && this.maxHeightLineMesh.isEnabled()) {
            }
            return;
        }

        if (overallMaxY > this.currentMaxYValue) {
            this.currentMaxYValue = overallMaxY;

            if (this.maxHeightLineMesh && !this.maxHeightLineMesh.isDisposed()) {
                if (!this.maxHeightLineMesh.isEnabled()) {
                    this.maxHeightLineMesh.setEnabled(true);
                }
                this.maxHeightLineMesh.position.y = this.currentMaxYValue;
            }

            if (this.config.starThresholds && Array.isArray(this.config.starThresholds)) {
                this.config.starThresholds.forEach(threshold => {
                    if (this.currentMaxYValue >= threshold.height && !this.achievedHeightTimes[threshold.height]) {
                        this.achievedHeightTimes[threshold.height] = totalSimulationTime;
                    }
                });
            }
        }
         this.statusText = `Max Height: ${this.currentMaxYValue > -Infinity ? this.currentMaxYValue.toFixed(1) + 'm' : 'Tracking...'}`;
    }

    /**
     * Calculates the number of stars earned based on the achieved height and time.
     * This should be called once at the end of the level.
     * @param {number} totalSimulationTimeAtLevelEnd - The total simulation time when the level ended.
     */
    calculateStars(totalSimulationTimeAtLevelEnd) {
        this.starsEarned = 0;
        if (!this.config.starThresholds || !Array.isArray(this.config.starThresholds) || this.config.starThresholds.length === 0) {
            this.statusText = `Max Height: ${this.currentMaxYValue > -Infinity ? this.currentMaxYValue.toFixed(1) + 'm' : 'N/A'}`;
            return;
        }


        const sortedThresholds = [...this.config.starThresholds].sort((a, b) => b.stars - a.stars);

        for (const threshold of sortedThresholds) {
            const heightMet = this.currentMaxYValue >= threshold.height;
            let timeMet = true;

            if (threshold.maxTime !== undefined) {
                const timeAchieved = this.achievedHeightTimes[threshold.height];
                timeMet = timeAchieved !== undefined && timeAchieved <= threshold.maxTime;
            }

            if (heightMet && timeMet) {
                this.starsEarned = threshold.stars;
                break;
            }
        }
        this.statusText = `Max Height: ${this.currentMaxYValue > -Infinity ? this.currentMaxYValue.toFixed(1) + 'm' : 'N/A'} (${this.starsEarned} ${this.starsEarned === 1 ? 'Star' : 'Stars'})`;
    }

     /**
      * Disposes of resources used by this objective, specifically the visual line mesh.
      * Ensures the mesh is removed from the scene and references are cleared.
      * @override
      */
     dispose() {
         if (this.maxHeightLineMesh) {
             if (!this.maxHeightLineMesh.isDisposed()) {
                 this.maxHeightLineMesh.dispose();
                 console.log(`Disposed maxHeightLine for objective ${this.id}`);
             }
             this.maxHeightLineMesh = null;
         }
     }
 }
