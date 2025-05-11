import * as BABYLON from '@babylonjs/core';
import * as Matter from 'matter-js';
import { getScene, getCamera, getCanvas, highlightMesh, restoreMeshColor, highlightColor } from '../sceneManager.js';
import { getPhysicsEngine } from '../physicsManager.js';
import { setDraggingState } from '../simulation.js';
import { showTrashCan, hideTrashCan, isPointerOverTrashCan } from '../uiManager.js';
import { 
    getMatterPointerCoordinates, 
    getIsDragging, 
    setIsDragging,
    MAX_INTERACTION_DISTANCE
} from './inputManager.js';

/**
 * @module core/interactions/dragManager
 * @description Manages the drag-and-drop interactions for physics objects in the scene.
 * This includes creating and managing mouse constraints, highlighting dragged objects,
 * handling temporary state changes (like making other objects static during a drag),
 * and applying physics properties like damping and velocity limits during dragging.
 */

let activeMouseConstraint = null;
let draggedBody = null;
let draggedMesh = null;
let dragInitialMeshColor = null;
let originalStaticStates = new Map();
let originalMasses = new Map();
const DRAG_MASS = 0.1;

const DRAG_STIFFNESS = 0.05;
const DRAG_DAMPING = 30;
const DRAG_ANGULAR_DAMPING = 0.90;
const DRAG_MAX_VELOCITY = 10;
const ROTATION_VELOCITY_STEP = 0.1;

/**
 * Updates the target point (pointB) of the active mouse constraint.
 * This function is called continuously while an object is being dragged. It applies
 * angular damping to the dragged body and updates the constraint's target based on
 * the current pointer position, clamping the distance to `MAX_INTERACTION_DISTANCE`.
 * It also limits the maximum velocity of the dragged body.
 */
function updateDragConstraintTarget() {
    if (!getIsDragging() || !draggedBody || !activeMouseConstraint) return;

    if (draggedBody.angularVelocity !== 0) {
        Matter.Body.setAngularVelocity(draggedBody, draggedBody.angularVelocity * DRAG_ANGULAR_DAMPING);
    }

    const scene = getScene();
    const camera = getCamera();
    if (!scene || !camera) return;
    const pointerCoords = getMatterPointerCoordinates(scene, camera);
    if (!pointerCoords) return;

    const anchorPointWorld = Matter.Vector.add(draggedBody.position, activeMouseConstraint.pointA);
    const delta = Matter.Vector.sub(pointerCoords, anchorPointWorld);
    const distance = Matter.Vector.magnitude(delta);
    let targetPointB = pointerCoords;

    if (distance > MAX_INTERACTION_DISTANCE) {
        const direction = Matter.Vector.normalise(delta);
        const clampedDelta = Matter.Vector.mult(direction, MAX_INTERACTION_DISTANCE);
        targetPointB = Matter.Vector.add(anchorPointWorld, clampedDelta);
    }
    activeMouseConstraint.pointB = targetPointB;
    
    if (draggedBody && draggedBody.velocity) {
        const v = draggedBody.velocity;
        const speed = Math.hypot(v.x, v.y);
        if (speed > DRAG_MAX_VELOCITY) {
            const scale = DRAG_MAX_VELOCITY / speed;
            Matter.Body.setVelocity(draggedBody, { x: v.x * scale, y: v.y * scale });
        }
    }
}

/**
 * Initiates dragging for a newly placed body, as if it were picked up.
 * Sets the dragging state, highlights the mesh, makes other dynamic bodies temporarily static,
 * and creates a mouse constraint to control the new body. Also shows the trash can UI.
 *
 * @param {Matter.Body} body - The Matter.js physics body that has just been placed.
 * @param {BABYLON.Mesh} mesh - The corresponding Babylon.js mesh for the body.
 * @param {{x: number, y: number}} initialPosition - The initial world coordinates where the body was placed
 *                                                  and where the drag should start.
 */
function startDragOnNewBody(body, mesh, initialPosition) {
    setIsDragging(true);
    draggedBody = body;
    draggedMesh = mesh;
    dragInitialMeshColor = highlightMesh(draggedMesh, highlightColor);

    const physicsEngine = getPhysicsEngine();
    const allBodies = Matter.Composite.allBodies(physicsEngine.world);
    originalStaticStates.clear();
    allBodies.forEach(b => {
        if (b.id !== body.id && !b.isStatic) {
            originalStaticStates.set(b.id, b.isStatic);
            Matter.Body.setStatic(b, true);
        }
    });

    activeMouseConstraint = Matter.Constraint.create({
        pointA: { x: 0, y: 0 }, bodyA: body,
        pointB: { x: initialPosition.x, y: initialPosition.y },
        stiffness: DRAG_STIFFNESS, damping: DRAG_DAMPING, render: { visible: false },
        length: 0
    });
    Matter.World.add(physicsEngine.world, activeMouseConstraint);

    setDraggingState(true);
    showTrashCan();
}

/**
 * Starts dragging an existing physics body.
 * Sets the dragging state, highlights the mesh, temporarily changes the body's mass for smoother dragging,
 * makes other dynamic bodies temporarily static, and creates a mouse constraint.
 * Also shows the trash can UI and detaches camera controls.
 *
 * @param {Matter.Body} body - The Matter.js physics body to start dragging.
 * @param {BABYLON.Mesh} mesh - The corresponding Babylon.js mesh for the body.
 * @param {{x: number, y: number}} pointerCoords - The current world coordinates of the pointer,
 *                                                used as the initial target for the drag constraint.
 */
function startDragging(body, mesh, pointerCoords) {
    setIsDragging(true);
    draggedBody = body;
    draggedMesh = mesh;
    dragInitialMeshColor = highlightMesh(draggedMesh, highlightColor);
    
    originalMasses.set(draggedBody.id, draggedBody.mass);
    Matter.Body.setMass(draggedBody, DRAG_MASS);

    const physicsEngine = getPhysicsEngine();
    const physicsBodies = Matter.Composite.allBodies(physicsEngine.world);
    originalStaticStates.clear();
    physicsBodies.forEach(b => {
        if (b.id !== draggedBody.id && !b.isStatic) {
            originalStaticStates.set(b.id, b.isStatic);
            Matter.Body.setStatic(b, true);
        }
    });

    activeMouseConstraint = Matter.Constraint.create({
        pointA: { x: 0, y: 0 }, bodyA: draggedBody, pointB: { x: pointerCoords.x, y: pointerCoords.y },
        stiffness: DRAG_STIFFNESS, damping: DRAG_DAMPING, render: { visible: false },
        length: 0
    });
    Matter.World.add(physicsEngine.world, activeMouseConstraint);

    setDraggingState(true);
    showTrashCan();
    
    const canvas = getCanvas();
    const camera = getCamera();
    if (canvas && camera) camera.detachControl(canvas);
}

/**
 * Stops the current dragging operation.
 * Removes the mouse constraint, restores the original mass and static states of affected bodies,
 * restores the dragged mesh's original color, re-attaches camera controls,
 * and hides the trash can UI. Resets dragging state variables.
 *
 * @returns {{id: string | null, position: {x: number, y: number}, angle: number}}
 *          An object containing the `configId` of the dropped body (or null if no body was dragged),
 *          its final `position`, and `angle`.
 */
function stopDragging() {
    const physicsEngine = getPhysicsEngine();
    
    if (activeMouseConstraint) {
        Matter.World.remove(physicsEngine.world, activeMouseConstraint, true);
        activeMouseConstraint = null;
    }
    
    if (originalMasses.has(draggedBody.id)) {
        Matter.Body.setMass(draggedBody, originalMasses.get(draggedBody.id));
        originalMasses.delete(draggedBody.id);
    }
    
    originalStaticStates.forEach((originalState, bodyId) => {
        const body = Matter.Composite.get(physicsEngine.world, bodyId, 'body');
        if (body) Matter.Body.setStatic(body, originalState);
    });
    originalStaticStates.clear();

    if (draggedMesh && dragInitialMeshColor) restoreMeshColor(draggedMesh, dragInitialMeshColor);
    
    const canvas = getCanvas();
    const camera = getCamera();
    if (canvas && camera) camera.attachControl(canvas, true);

    let finalAngle = 0, finalPosition = { x: 0, y: 0 }, droppedBodyId = null;
    if (draggedBody) {
        Matter.Body.setAngularVelocity(draggedBody, draggedBody.angularVelocity * DRAG_ANGULAR_DAMPING);
        Matter.Body.setVelocity(draggedBody, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(draggedBody, 0);
        finalPosition = { x: draggedBody.position.x, y: draggedBody.position.y };
        finalAngle = draggedBody.angle;
        droppedBodyId = draggedBody.configId;
    }

    const result = {
        id: droppedBodyId,
        position: finalPosition,
        angle: finalAngle
    };

    setIsDragging(false);
    draggedBody = null;
    draggedMesh = null;
    dragInitialMeshColor = null;
    setDraggingState(false);
    hideTrashCan();
    
    return result;
}

/**
 * Checks if the specified Matter.js body is currently being dragged.
 * @param {Matter.Body} body - The Matter.js body to check.
 * @returns {boolean} True if the given body is the one currently being dragged, false otherwise.
 */
function isBodyBeingDragged(body) {
    return getIsDragging() && draggedBody && body.id === draggedBody.id;
}

/**
 * Cleans up all resources and states related to dragging.
 * This includes removing any active mouse constraint, restoring original static states
 * of bodies, restoring the color of the dragged mesh if any, and resetting all
 * drag-related state variables. Hides the trash can UI.
 * This function is typically called when resetting the simulation or changing modes.
 */
function cleanupDrag() {
    const physicsEngine = getPhysicsEngine();
    
    if (activeMouseConstraint) {
        Matter.World.remove(physicsEngine.world, activeMouseConstraint, true);
        activeMouseConstraint = null;
    }
    
    originalStaticStates.forEach((originalState, bodyId) => {
        const body = Matter.Composite.get(physicsEngine.world, bodyId, 'body');
        if (body) Matter.Body.setStatic(body, originalState);
    });
    
    originalStaticStates.clear();
    
    if (draggedMesh && dragInitialMeshColor) {
        restoreMeshColor(draggedMesh, dragInitialMeshColor);
    }
    
    setIsDragging(false);
    draggedBody = null;
    draggedMesh = null;
    dragInitialMeshColor = null;
    setDraggingState(false);
    hideTrashCan();
}

/**
 * Applies a rotational velocity change to the currently dragged body.
 * Used to allow users to rotate objects while dragging them (e.g., via mouse wheel).
 * @param {number} delta - The rotation delta. A positive value typically indicates
 *                         clockwise rotation, negative for counter-clockwise. The magnitude
 *                         influences the speed of rotation.
 */
function applyRotationToDraggedBody(delta) {
    if (getIsDragging() && draggedBody) {
        let angularVelocityChange = (delta < 0) ? -ROTATION_VELOCITY_STEP : (delta > 0) ? ROTATION_VELOCITY_STEP : 0;
        if (angularVelocityChange !== 0) {
            Matter.Body.setAngularVelocity(draggedBody, draggedBody.angularVelocity + angularVelocityChange);
        }
    }
}

export {
    updateDragConstraintTarget,
    startDragOnNewBody,
    startDragging,
    stopDragging,
    isBodyBeingDragged,
    cleanupDrag,
    applyRotationToDraggedBody
};
