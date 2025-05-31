import * as Matter from 'matter-js';
import { initAudio, playCollisionSound } from './soundManager.js';
import { getApplicationMode } from './simulation.js';

/**
 * @module core/physicsManager
 * @description Manages the Matter.js physics engine, including initialization,
 * object creation (bodies and boundaries), collision handling, and simulation updates.
 * It also handles toggling between working and simulation boundaries and provides
 * utility functions for collision checking.
 */

/** @type {Matter.Engine|null} The Matter.js physics engine instance. */
let matterEngine = null;
/** @type {object} Stores the last configuration object used to initialize the physics world. */
let lastWorldConfig = {};
/** @type {number} Default collision group for objects. */
const defaultCollisionGroup = 1;
/** @type {number} Collision category for boundary objects. */
const boundaryCollisionCategory = 0x0002;
/** @type {number} Collision category for dynamic/static physics objects. */
const objectCollisionCategory = 0x0004;
/** @type {number} Default collision mask determining what categories collide with each other. */
const defaultCollisionMask = boundaryCollisionCategory | objectCollisionCategory;

/**
 * Initializes the Matter.js physics engine with the given world configuration.
 * Sets up gravity, solver iterations, and stores the world configuration.
 * @param {object} worldConfig - Configuration object for the physics world.
 * @param {object} [worldConfig.gravity] - Gravity vector for the world.
 * @param {number} [worldConfig.gravity.x=0] - Gravity on the x-axis.
 * @param {number} [worldConfig.gravity.y=1] - Gravity on the y-axis.
 */
function initializePhysics(worldConfig) {
    matterEngine = Matter.Engine.create();
    Matter.Resolver._restingThresh = 1;
    matterEngine.positionIterations = 8;
    matterEngine.velocityIterations = 8;
    matterEngine.gravity.x = worldConfig?.gravity?.x ?? 0;
    matterEngine.gravity.y = worldConfig?.gravity?.y ?? 1;
    lastWorldConfig = worldConfig || {};

    initAudio();

    Matter.Events.on(matterEngine, 'collisionStart', (event) => {
        event.pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;
            const typeA = bodyA.objectType || 'boundary';
            const typeB = bodyB.objectType || 'boundary';

            const relativeVelocityVector = Matter.Vector.sub(bodyA.velocity, bodyB.velocity);
            const relativeVelocity = Matter.Vector.magnitude(relativeVelocityVector);

            const maxExpectedVelocity = 0.1;
            let intensity = Math.min(relativeVelocity / maxExpectedVelocity, 1.0);
            intensity = isNaN(intensity) ? 0 : intensity;

            const intensityThreshold = 0.001;
            if (getApplicationMode() === 'simulation' && intensity > intensityThreshold) {
                playCollisionSound({ intensity, typeA, typeB });
            }
        });
    });
}

/**
 * Creates Matter.js physical bodies (objects and boundaries) and constraints based on the provided configurations.
 * Adds created bodies and constraints to the Matter.js world.
 * @param {Array<object>} objectsConfig - Array of configuration objects for dynamic/static bodies.
 * @param {Array<object>} constraintsConfig - Array of configuration objects for constraints between bodies.
 * @param {object} worldConfig - Configuration for world properties like working and simulation boundaries.
 * @param {object} [worldConfig.workingBounds] - Defines the primary interaction area.
 * @param {object} [worldConfig.simulationBounds] - Defines the broader area for simulation, potentially outside working bounds.
 * @param {number} [worldConfig.wallThickness=60] - Thickness of the boundary walls.
 * @returns {{bodies: Map<string, Matter.Body>, constraints: Array<Matter.Constraint>}} An object containing a map of created bodies (keyed by ID) and an array of created Matter.js constraints. Returns an empty structure if the engine is not initialized.
 */
function createPhysicsObjects(objectsConfig, constraintsConfig, worldConfig) {
    if (!matterEngine) {
        return { bodies: new Map(), constraints: [] };
    }
    const world = matterEngine.world;

    const existingBodies = Matter.Composite.allBodies(world);
    existingBodies.forEach(body => {
        if (body.label && body.label.startsWith('boundary_')) {
            Matter.Composite.remove(world, body);
        }
    });

    const bodies = new Map();
    const matterConstraints = [];
    const bodiesById = {};

    const {
        workingBounds = { x: 0, y: 0, width: 800, height: 600 },
        simulationBounds = { x: -100, y: -100, width: 1000, height: 800 },
        wallThickness = 60
    } = worldConfig || {};

    /**
     * Creates a static rectangular boundary body for the physics world.
     * @param {string} id - A unique identifier for the boundary part (e.g., 'ground', 'leftWall').
     * @param {number} x - The x-coordinate of the center of the boundary.
     * @param {number} y - The y-coordinate of the center of the boundary.
     * @param {number} w - The width of the boundary.
     * @param {number} h - The height of the boundary.
     * @param {string} type - The type of boundary ('working' or 'sim').
     * @returns {Matter.Body} The created Matter.js body.
     */
    const createBoundary = (id, x, y, w, h, type) => {
    const options = {
            isStatic: true,
            label: `boundary_${type}_${id}`,
            boundaryType: type,
            collisionFilter: {
                category: boundaryCollisionCategory,
                mask: defaultCollisionMask
            },
            render: { visible: false }
        };
        const body = Matter.Bodies.rectangle(x, y, w, h, options);
        bodies.set(options.label, body);
        bodiesById[options.label] = body;
        Matter.Composite.add(world, body);
        return body;
    };

    const wb = workingBounds;
    createBoundary('ground', wb.x + wb.width / 2, wb.y + wb.height + wallThickness / 2, wb.width + 2 * wallThickness, wallThickness, 'working');
    createBoundary('ceiling', wb.x + wb.width / 2, wb.y - wallThickness / 2, wb.width + 2 * wallThickness, wallThickness, 'working');
    createBoundary('leftWall', wb.x - wallThickness / 2, wb.y + wb.height / 2, wallThickness, wb.height, 'working');
    createBoundary('rightWall', wb.x + wb.width + wallThickness / 2, wb.y + wb.height / 2, wallThickness, wb.height, 'working');

    const sb = simulationBounds;
    createBoundary('ground', sb.x + sb.width / 2, sb.y + sb.height + wallThickness / 2, sb.width + 2 * wallThickness, wallThickness, 'sim');
    createBoundary('ceiling', sb.x + sb.width / 2, sb.y - wallThickness / 2, sb.width + 2 * wallThickness, wallThickness, 'sim');
    createBoundary('leftWall', sb.x - wallThickness / 2, sb.y + sb.height / 2, wallThickness, sb.height, 'sim');
    createBoundary('rightWall', sb.x + sb.width + wallThickness / 2, sb.y + sb.height / 2, wallThickness, sb.height, 'sim');

    setSimulationBoundariesActive(false);

    objectsConfig.forEach(obj => {
        let body = null;
        const opts = {
            collisionFilter: {
                category: objectCollisionCategory,
                mask: defaultCollisionMask
            },
            restitution: obj.restitution ?? 0.8,
            friction: obj.friction ?? 0.01,
            frictionAir: obj.frictionAir ?? 0.01,
            isStatic: obj.isStatic ?? false,
            angle: obj.angle || 0,
            label: `object_${obj.id}`,
            objectType: obj.type
        };
        if (obj.mass && !opts.isStatic) {
            if (obj.type === 'box') opts.density = obj.mass/(obj.width*obj.height);
            else if (obj.type === 'circle') opts.density = obj.mass/(Math.PI*obj.radius*obj.radius);
        }
        if (obj.type === 'box') {
            body = Matter.Bodies.rectangle(obj.x, obj.y, obj.width, obj.height, opts);
        } else if (obj.type === 'circle') {
            body = Matter.Bodies.circle(obj.x, obj.y, obj.radius, opts);
        }
        if (body) {
            if (obj.isSensor === true) {
                body.isSensor = true;
            }

            body.configId = obj.id;
            bodiesById[obj.id] = body;
            bodies.set(obj.id, body);
            if (!body.isStatic) {
                body.initialConfig = { position: { x: obj.x, y: obj.y }, angle: body.angle };
            }
            Matter.Composite.add(world, body);
        }
    });

    if (constraintsConfig) {
        constraintsConfig.forEach(c => {
            const A = bodiesById[c.bodyA], B = bodiesById[c.bodyB];
            if (A && B) {
                const opts = {
                    bodyA: A,
                    bodyB: B,
                    stiffness: c.stiffness ?? 0.7,
                    damping: c.damping ?? 0.1,
                    length: c.length,
                    pointA: c.pointA || { x:0,y:0 },
                    pointB: c.pointB || { x:0,y:0 }
                };
                const mc = Matter.Constraint.create(opts);
                matterConstraints.push(mc);
                Matter.Composite.add(world, mc);
            }
        });
    }

    return { bodies, constraints: matterConstraints };
}

/**
 * Toggles the collision properties of working boundaries versus simulation boundaries.
 * When simulation boundaries are active, working boundaries become sensors (non-colliding), and vice-versa.
 * This allows switching between a "building" or "setup" phase (working boundaries active) and a "simulation" phase.
 * @param {boolean} isActive - If true, simulation boundaries are made collidable and working boundaries are made sensors. If false, working boundaries are made collidable and simulation boundaries are made sensors.
 */
function setSimulationBoundariesActive(isActive) {
    if (!matterEngine) return;
    const allBodies = Matter.Composite.allBodies(matterEngine.world);

    allBodies.forEach(body => {
        if (body.boundaryType === 'working') {
            body.collisionFilter.mask = isActive ? 0 : defaultCollisionMask;
            body.isSensor = isActive;
        } else if (body.boundaryType === 'sim') {
            body.collisionFilter.mask = isActive ? defaultCollisionMask : 0;
            body.isSensor = !isActive;
        }
    });
}

/**
 * Clears all bodies and constraints from the Matter.js world and resets the engine instance.
 */
function cleanupPhysics() {
    if (matterEngine) {
        Matter.World.clear(matterEngine.world, false);
        Matter.Engine.clear(matterEngine);
        matterEngine = null;
    }
}

/**
 * Advances the physics simulation by a given time step (delta).
 * @param {number} delta - The time step in milliseconds.
 */
function updatePhysics(delta) {
    if (matterEngine) {
        if (isNaN(delta) || delta <= 0) delta = 1000/60;
        Matter.Engine.update(matterEngine, delta);
    }
}

/**
 * Returns the current Matter.js engine instance.
 * @returns {Matter.Engine|null} The physics engine instance, or null if not initialized.
 */
function getPhysicsEngine() {
    return matterEngine;
}

/**
 * Returns the last world configuration object used to initialize the physics engine.
 * @returns {object} The last used world configuration.
 */
function getWorldConfig() {
    return lastWorldConfig;
}

/**
 * Performs a collision check for a given Matter.Body at a specified target position against a list of other bodies.
 * Temporarily moves the body to the target position for the check and then restores its original position and angle.
 * @param {Matter.Body} body - The Matter.js body to check.
 * @param {{x: number, y: number}} targetPosition - The position to check for collisions.
 * @param {Array<Matter.Body>} otherBodies - An array of other Matter.js bodies to check against.
 * @returns {boolean} True if a collision is detected, false otherwise. Returns false if essential parameters are missing.
 */
function checkCollisionAt(body, targetPosition, otherBodies) {
    if (!body || !targetPosition || !otherBodies) return false;
    const origPos = { ...body.position }, origAngle = body.angle;
    Matter.Body.setPosition(body, targetPosition);
    const collided = Matter.Query.collides(body, otherBodies).length > 0;
    Matter.Body.setPosition(body, origPos);
    Matter.Body.setAngle(body, origAngle);
    return collided;
}

/**
 * Checks if placing a new object with given properties at a target position would result in a collision
 * with existing objects in the world.
 * A temporary body is created for the check and then removed.
 * @param {object} objectProperties - Properties of the object to be placed (e.g., type, width, height, radius, mass).
 * @param {{x: number, y: number}} targetPosition - The position where the new object would be placed.
 * @returns {boolean} True if placing the object would cause a collision, false otherwise. Returns false if the engine is not initialized or parameters are missing.
 */
function checkPlacementCollision(objectProperties, targetPosition) {
    if (!matterEngine || !objectProperties || !targetPosition) return false;
    const world = matterEngine.world;
    const opts = {
        isStatic: false,
        restitution: objectProperties.restitution ?? 0.8,
        friction: objectProperties.friction ?? 0.01,
        frictionAir: objectProperties.frictionAir ?? 0.01,
        angle: objectProperties.angle || 0
    };
    if (objectProperties.mass) {
        if (objectProperties.type === 'box') opts.density = objectProperties.mass/(objectProperties.width*objectProperties.height);
        else if (objectProperties.type === 'circle') opts.density = objectProperties.mass/(Math.PI*objectProperties.radius*objectProperties.radius);
    }
    let temp = null;
    if (objectProperties.type === 'box') {
        temp = Matter.Bodies.rectangle(targetPosition.x, targetPosition.y, objectProperties.width, objectProperties.height, opts);
    } else if (objectProperties.type === 'circle') {
        temp = Matter.Bodies.circle(targetPosition.x, targetPosition.y, objectProperties.radius, opts);
    }
    if (!temp) return false;
    Matter.World.add(world, temp);
    const others = Matter.Composite.allBodies(world).filter(b=>b.id!==temp.id);
    const collided = Matter.Query.collides(temp, others).length>0;
    Matter.World.remove(world, temp, true);
    return collided;
}

export {
    initializePhysics,
    createPhysicsObjects,
    cleanupPhysics,
    updatePhysics,
    getPhysicsEngine,
    getWorldConfig,
    checkCollisionAt,
    checkPlacementCollision,
    setSimulationBoundariesActive
};
