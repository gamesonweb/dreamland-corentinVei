# PuzzleShape

## Introduction

Welcome to **PuzzleShape**, a captivating physics-based puzzle game where your imagination and engineering skills take center stage! Step into a charming, toy-like 2D world, brought to life with a unique 3D perspective. Here, you'll arrange simple blocks and shapes to construct ingenious solutions for a variety of playful challenges.

PuzzleShape invites you to tap into your creativity and problem-solving abilities. Design your contraptions in **Construction Mode**, fine-tune object properties in **Configuration Mode**, and then hit **Simulation Mode** to watch the laws of physics unfold before your eyes. Witness satisfying chain reactions, guide objects to their goals, and experience the joy of seeing your designs come to life, all accompanied by uniquely generated procedural sound effects that make every interaction distinct.

## Project Resources

* **[📹 Presentation Video](https://youtu.be/_lrPfQzOBlk)** - Watch the complete project presentation
* **[🎮 Gameplay Demo](https://youtu.be/qEtjsIvMaQ8)** - See PuzzleShape in action
* **[📚 Documentation](https://corentinvei.github.io/PuzzleShape/)** - Detailed technical documentation
* **[🌐 Play the Game](https://puzzleshape.corentin.cc/)** - Try PuzzleShape in your browser

## Project Participants
*   **Corentin Veillard** SI3 Polytech


## Core Technologies

*   **Babylon.js:** Used for 3D rendering of the 2D physics scene, camera control, lighting, and the user interface (Babylon.GUI).
*   **Matter.js:** Powers the 2D physics simulation, handling object dynamics, collisions, and constraints.
*   **Web Audio API:** For [procedural sound generation](#procedural-sound-generation) triggered by physics-based collision impacts.

## Key Features

*   **Scene Management:**
    *   Load scenes from JSON configuration files (located in `assets/maps`).
    *   A default scene is loaded if no specific scene is requested.
    *   Scenes define world properties, initial objects, constraints, inventory items, and objectives.
*   **Physics Simulation:**
    *   Realistic 2D physics for various object types (e.g., boxes, circles).
    *   Configurable physical properties: mass, friction, restitution, static/dynamic state.
*   **3D Rendering of 2D Physics:**
    *   The 2D physics simulation is visualized in a 3D environment, providing depth and perspective.
*   **Application Modes:**
    *   **Construction Mode:** Interactively place new objects from an inventory into the scene. Drag and move existing objects.
    *   **Configuration Mode:** Select existing objects in the scene to view and modify their physical properties (mass, friction, restitution) via a dedicated UI panel.
    *   **Simulation Mode:** Run the physics simulation to observe how objects interact based on their properties and the defined physics laws.
*   **Interactive Controls:**
    *   **Drag and Drop:** Click and drag objects to reposition them in Construction or Configuration mode.
    *   **Object Rotation:** Rotate objects using the mouse wheel while dragging.
    *   **Object Placement:** Select items from the inventory and click in the scene to place them. A preview shows where the object will be placed and indicates potential collisions.
    *   **Keyboard Shortcuts:**
        *   `Spacebar`: Toggle between the current non-simulation mode (Construction/Configuration) and Simulation mode.
        *   `Escape`: Cancel an ongoing object placement operation.
*   **Objectives System:**
    *   Supports defining and tracking various simulation objectives. The base class for all objectives is [Objective](./src/core/objectives/Objective.js).
    *   Implemented objective types include:
        *   [MaxHeightObjective](./src/core/objectives/MaxHeightObjective.js): Tracks and displays the maximum height reached by specified objects.
        *   [MinHeightObjective](./src/core/objectives/MinHeightObjective.js): Tracks and displays the minimum height reached by specified objects.
        *   [StayInZoneObjective](./src/core/objectives/StayInZoneObjective.js): Requires target objects to remain within a defined area for a set duration.
        *   [LeaveZoneObjective](./src/core/objectives/LeaveZoneObjective.js): Requires target objects to exit a defined area.
    *   **End Conditions:** Objectives can be associated with end conditions that determine when a simulation or level attempt concludes. The base class for conditions is [Condition](./src/core/conditions/Condition.js).
    *   Implemented end condition types include:
        *   [MaxHeightEndCondition](./src/core/conditions/MaxHeightEndCondition.js): Ends the simulation when a specified maximum height is reached.
        *   [LeaveZoneEndCondition](./src/core/conditions/LeaveZoneEndCondition.js): Ends the simulation when specified objects leave a designated zone.
        *   [StayInZoneEndCondition](./src/core/conditions/StayInZoneEndCondition.js): Ends the simulation based on objects staying within a zone for a duration (or failing to do so).
        *   [TimeLimitCondition](./src/core/conditions/TimeLimitCondition.js): Ends the simulation after a set amount of time has passed.
*   **Post-Processing Effects:**
    *   **Bloom Effect:** Enhances bright areas of the scene to create a glowing effect.

## Procedural Sound Generation

The application utilizes the **Web Audio API** to generate sounds procedurally in real-time, primarily for collision impacts. When objects collide in the physics simulation (managed by Matter.js), the `soundManager` module is triggered. It synthesizes impact sounds by:

*   Generating a base noise signal.
*   Shaping the sound using an envelope (attack, decay, sustain) to control its loudness over time.
*   Applying a lowpass filter to modify the timbre (brightness/dullness) of the sound.
*   Adjusting sound parameters (e.g., filter frequency, envelope times) based on the intensity of the collision and the types of objects involved (e.g., a "box" hitting another "box" sounds different from a "sphere" hitting a "box").
*   Adding a synthetic reverb effect for a sense of space.
