import { 
    attachKeyboardListener,
    setInteractionMode, 
    getInteractionMode 
} from './interactions/inputManager.js';

import { 
    updateDragConstraintTarget,
    startDragOnNewBody 
} from './interactions/dragManager.js';

import { 
    showPlacementPreview, 
    hidePlacementPreview 
} from './interactions/placementManager.js';

import { 
    clearConfigSelectionHighlight 
} from './interactions/configManager.js';

import { 
    attachPointerListener 
} from './interactions/pointerManager.js';

/**
 * @module core/interactionManager
 * @description User interaction management module.
 * This file serves as an entry point for all interaction functionalities.
 * It imports and exports functions from various specialized modules.
 */

export {
    attachKeyboardListener,
    attachPointerListener,
    updateDragConstraintTarget,
    setInteractionMode,
    getInteractionMode,
    showPlacementPreview,
    hidePlacementPreview,
    startDragOnNewBody,
    clearConfigSelectionHighlight
};
