/**
 * @module core/historyManager
 * @description Manages the undo/redo history for application states.
 * It provides functions to push new states, undo to previous states,
 * redo undone states, clear history, and check if undo/redo operations
 * are available. States are deep-copied to prevent unintended modifications.
 */
let undoStack = [];
let redoStack = [];
const MAX_HISTORY_SIZE = 50;

/**
 * Deep copies an object, including arrays and Date objects.
 * This function is used internally by the history manager to ensure
 * that states are stored as independent copies, preventing unintended
 * modifications to past states when the current state changes.
 * @param {any} obj - The object to deep copy.
 * @returns {any} The deep copied object.
 */
function deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepCopy(item));
    }
    const copy = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            copy[key] = deepCopy(obj[key]);
        }
    }
    return copy;
}

/**
 * Pushes the current state onto the undo stack and clears the redo stack.
 * @param {object} currentState - The current state to save.
 */
export function pushState(currentState) {
    if (!currentState) {
        console.warn("History: Attempted to push null or undefined state.");
        return;
    }
    undoStack.push(deepCopy(currentState));
    redoStack = [];

    if (undoStack.length > MAX_HISTORY_SIZE) {
        undoStack.shift();
    }
    console.log(`History: Pushed state. Undo: ${undoStack.length}, Redo: ${redoStack.length}`);
}

/**
 * Undoes the last action and returns the previous state.
 * @param {object} currentLiveState - The current live state to push to redo stack.
 * @returns {object|null} The previous state or null if undo stack is empty.
 */
export function undo(currentLiveState) {
    if (undoStack.length === 0) {
        console.log("History: Undo stack empty.");
        return null;
    }
    if (!currentLiveState) {
        console.warn("History: Attempted to push null or undefined live state to redo stack during undo.");
    } else {
        redoStack.push(deepCopy(currentLiveState));
    }
    const previousState = undoStack.pop();
    console.log(`History: Undone. Undo: ${undoStack.length}, Redo: ${redoStack.length}`);
    return previousState;
}

/**
 * Redoes the last undone action and returns the next state.
 * @param {object} currentLiveState - The current live state to push to undo stack.
 * @returns {object|null} The next state or null if redo stack is empty.
 */
export function redo(currentLiveState) {
    if (redoStack.length === 0) {
        console.log("History: Redo stack empty.");
        return null;
    }
     if (!currentLiveState) {
        console.warn("History: Attempted to push null or undefined live state to undo stack during redo.");
    } else {
        undoStack.push(deepCopy(currentLiveState));
    }
    const nextState = redoStack.pop();
    console.log(`History: Redone. Undo: ${undoStack.length}, Redo: ${redoStack.length}`);
    return nextState;
}

/**
 * Clears the undo and redo history stacks.
 */
export function clearHistory() {
    undoStack = [];
    redoStack = [];
    console.log("History: Cleared.");
}

/**
 * Checks if there is at least one state to undo.
 * @returns {boolean} True if undo is available, false otherwise.
 */
export function hasUndo() {
    return undoStack.length > 0;
}

/**
 * Checks if there is at least one state to redo.
 * @returns {boolean} True if redo is available, false otherwise.
 */
export function hasRedo() {
    return redoStack.length > 0;
}
