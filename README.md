# PuzzleShape

## Introduction

PuzzleShape is an interactive 2D physics simulation environment built with JavaScript.
Gameplay is in working progress, currently only the technical side of the project is finished.

## Project Participants
*   **Corentin Veillard**


## Core Technologies

*   **Babylon.js:** Used for 3D rendering of the 2D physics scene, camera control, lighting, and the user interface (Babylon.GUI).
*   **Matter.js:** Powers the 2D physics simulation, handling object dynamics, collisions, and constraints.

## Key Features

*   **Scene Management:**
    *   Load scenes from JSON configuration files (located in `src/examples/`).
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
    *   Supports defining and tracking various simulation objectives.
    *   Implemented examples include:
        *   `MaxHeightObjective`: Tracks and displays the maximum height reached by specified objects.
        *   `StayInZoneObjective`: Requires target objects to remain within a defined area for a set duration.
*   **Post-Processing Effects:**
    *   **Old TV Effect:** Applies a retro CRT screen visual style, including scanlines, noise, vignette, and flicker.


