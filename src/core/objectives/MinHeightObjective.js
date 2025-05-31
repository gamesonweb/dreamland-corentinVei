import * as BABYLON from '@babylonjs/core';
import { Objective } from './Objective.js';

/**
 * @class MinHeightObjective
 * @extends Objective
 * @description An objective that tracks a "ceiling" height. This ceiling starts at `initialHeight`
 * and can only decrease. The ceiling is lowered if the highest point of any target object
 * falls below the current ceiling.
 * It displays a visual line in the scene indicating this ceiling.
 *
 * @param {object} config - The configuration object for this objective.
 * @param {string} config.id - A unique identifier for this objective instance.
 * @param {string} config.type - The type of the objective (e.g., "minHeight").
 * @param {string} config.displayName - A user-friendly name for display in the UI.
 * @param {string} config.targetId - The base ID prefix of the object(s) to track.
 * @param {number} [config.initialHeight=Infinity] - The starting height from which the minimum is tracked.
 *                                                   The recorded height cannot go above this.
 * @param {BABYLON.Scene} scene - The Babylon.js scene instance.
 * @param {object} worldConfig - The world configuration object.
 * @param {object} worldConfig.simulationBounds - Defines the boundaries of the simulation area.
 */
export class MinHeightObjective extends Objective {
    /**
     * Creates an instance of MinHeightObjective.
     * Initializes tracking variables and creates a visual line mesh in the scene.
     * @param {object} config - Objective configuration from JSON.
     * @param {string} config.targetId - The ID of the object to track.
     * @param {number} [config.initialHeight=Infinity] - The initial height to start tracking from.
     * @param {BABYLON.Scene} scene - The Babylon scene to add the line mesh to.
     * @param {object} worldConfig - The world configuration (for bounds).
     */
    constructor(config, scene, worldConfig) {
        super(config);
        if (!config.targetId) {
            throw new Error(`MinHeightObjective (id: ${this.id}) requires a 'targetId' (base ID) in config.`);
        }
        if (!scene) {
            throw new Error(`MinHeightObjective (id: ${this.id}) requires a 'scene' instance.`);
        }
        if (!worldConfig?.simulationBounds) {
            throw new Error(`MinHeightObjective (id: ${this.id}) requires 'worldConfig' with 'simulationBounds'.`);
        }

        this.baseTargetId = config.targetId;
        this.initialHeight = config.initialHeight !== undefined ? config.initialHeight : Infinity;
        this.currentMinYValue = this.initialHeight;
        this.minHeightLineMesh = null;
        this.scene = scene;
        this.achievedHeightTimes = {};

        const simBounds = worldConfig.simulationBounds;
        const lineWidth = simBounds.width;
        const linePoints = [
            new BABYLON.Vector3(simBounds.x, 0, 10),
            new BABYLON.Vector3(simBounds.x + lineWidth, 0, 10)
        ];
        this.minHeightLineMesh = BABYLON.MeshBuilder.CreateLines(
            `minHeightLine_${this.id}`,
            { points: linePoints, updatable: true },
            this.scene
        );
        const lineMaterial = new BABYLON.StandardMaterial(`minHeightLineMat_${this.id}`, this.scene);
        lineMaterial.emissiveColor = new BABYLON.Color3(0, 0, 1);
        lineMaterial.disableLighting = true;
        lineMaterial.alpha = 0.8;
        this.minHeightLineMesh.material = lineMaterial;
        this.minHeightLineMesh.isPickable = false;

        this.reset();
    }

    /**
     * Resets the objective to its initial state.
     * Sets `currentMinYValue` to `initialHeight`, updates `statusText`,
     * and positions/hides the visual line mesh.
     * @override
     */
    reset() {
        super.reset();
        this.currentMinYValue = this.initialHeight;
        this.statusText = `Ceiling Height: Tracking...`;
        this.achievedHeightTimes = {};

        if (this.minHeightLineMesh && !this.minHeightLineMesh.isDisposed()) {
            if (this.currentMinYValue === Infinity) {
                this.minHeightLineMesh.setEnabled(false);
            } else {
                this.minHeightLineMesh.position.y = this.currentMinYValue;
                this.minHeightLineMesh.setEnabled(true);
            }
        }
    }

    /**
     * Updates the objective's state based on the current positions of physics bodies.
     * It iterates through all bodies, finds those matching `baseTargetId`,
     * and determines the maximum Y-coordinate (highest point) among them.
     * If this highest point is less than `currentMinYValue` (the current ceiling),
     * it updates `currentMinYValue` to this new lower ceiling, updates `statusText`,
     * and the visual line's position.
     *
     * @param {Map<string, Matter.Body>} bodies - A map of all physics bodies.
     * @param {number} deltaTime - Time elapsed since the last frame.
     * @param {number} totalSimulationTime - Total simulation time.
     * @override
     */
    update(bodies, deltaTime, totalSimulationTime) {
        if (this.isComplete || this.isFailed) return;

        let overallHighestYOfAnyTarget = -Infinity;
        let targetFound = false;

        for (const [id, body] of bodies) {
            if (id.startsWith(this.baseTargetId)) {
                targetFound = true;
                if (body.vertices && body.vertices.length > 0) {
                    let bodyHighestY = -Infinity;
                    for (const vertex of body.vertices) {
                        if (vertex.y > bodyHighestY) {
                            bodyHighestY = vertex.y;
                        }
                    }
                    if (bodyHighestY > overallHighestYOfAnyTarget) {
                        overallHighestYOfAnyTarget = bodyHighestY;
                    }
                } else {
                    if (body.position.y > overallHighestYOfAnyTarget) {
                        overallHighestYOfAnyTarget = body.position.y;
                    }
                }
            }
        }

        if (!targetFound) {
            this.statusText = `No target starting with '${this.baseTargetId}' found.`;
            return;
        }
        let newCeilingCandidate = overallHighestYOfAnyTarget;
        if (this.initialHeight !== Infinity) {
            newCeilingCandidate = Math.min(newCeilingCandidate, this.initialHeight);
        }

        if (newCeilingCandidate < this.currentMinYValue) {
            this.currentMinYValue = newCeilingCandidate;

            if (this.minHeightLineMesh && !this.minHeightLineMesh.isDisposed()) {
                if (!this.minHeightLineMesh.isEnabled()) {
                    this.minHeightLineMesh.setEnabled(true);
                }
                this.minHeightLineMesh.position.y = this.currentMinYValue;
            }

            if (this.config.starThresholds && Array.isArray(this.config.starThresholds)) {
                this.config.starThresholds.forEach(threshold => {
                    if (this.currentMinYValue <= threshold.height && !this.achievedHeightTimes[threshold.height]) {
                        this.achievedHeightTimes[threshold.height] = totalSimulationTime;
                    }
                });
            }
        }
        this.statusText = `Ceiling: ${this.currentMinYValue !== Infinity ? this.currentMinYValue.toFixed(1) + 'm' : 'Tracking...'}`;
    }

    /**
     * Calculates stars earned based on how low the ceiling (`currentMinYValue`) got.
     * @param {number} totalSimulationTimeAtLevelEnd - Total simulation time at level end.
     */
    calculateStars(totalSimulationTimeAtLevelEnd) {
        this.starsEarned = 0;
        if (!this.config.starThresholds || !Array.isArray(this.config.starThresholds) || this.config.starThresholds.length === 0) {
            this.statusText = `Ceiling: ${this.currentMinYValue !== Infinity ? this.currentMinYValue.toFixed(1) + 'm' : 'N/A'}`;
            return;
        }

        const sortedThresholds = [...this.config.starThresholds].sort((a, b) => b.stars - a.stars);

        for (const threshold of sortedThresholds) {
            const heightMet = this.currentMinYValue >= threshold.height;
            console.log(`Threshold: ${threshold.height}m, Stars: ${threshold.stars}, Height Met: ${heightMet}, Current Min Y: ${this.currentMinYValue}`);
            if (this.currentMinYValue == this.initialHeight) {
                this.starsEarned = 0;
                break;
            }
            
            let timeMet = true;
            if (threshold.maxTime !== undefined) {
                timeMet = totalSimulationTimeAtLevelEnd <= threshold.maxTime;
            }

            if (heightMet && timeMet) {
                this.starsEarned = threshold.stars;
                break;
            }
        }
        this.statusText = `Ceiling: ${this.currentMinYValue !== Infinity ? this.currentMinYValue.toFixed(1) + 'm' : 'N/A'} (${this.starsEarned} ${this.starsEarned === 1 ? 'Star' : 'Stars'})`;
    }

    /**
     * Disposes of resources used by this objective.
     * @override
     */
    dispose() {
        if (this.minHeightLineMesh) {
            if (!this.minHeightLineMesh.isDisposed()) {
                this.minHeightLineMesh.dispose();
            }
            this.minHeightLineMesh = null;
        }
    }
}
