import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture, getMainPanel, emptyImageUrl } from './uiCore.js';
import { createPreviewTexture } from './objectPreview.js';
import { setCameraMouseWheelZoomActive } from '../sceneManager.js';

/**
 * @module core/ui/inventoryPanel
 * @description Manages the creation and dynamic updating of the inventory panel UI.
 * The inventory panel displays items available for placement, showing a 3D preview,
 * name, and count for each item. It allows users to select items to place into the simulation.
 */

/**
 * @type {GUI.StackPanel | null}
 * @description Holds the main GUI.StackPanel container for the inventory items.
 * Initialized to null.
 * @private
 */
let inventoryPanel = null;

/**
 * @type {function(object): void}
 * @description Callback function invoked when an inventory item's "add" action is triggered (e.g., by clicking it).
 * It receives the inventory item object as an argument.
 * Defaults to a console warning if not implemented.
 * @private
 */
let onAddItemRequest = (inventoryItem) => { console.warn("onAddItemRequest not implemented"); };

/**
 * @type {function(): void}
 * @description Callback function invoked if a preview image generation results in an empty image
 * or if the preview cache was populated, indicating that the UI might need a reload to display correctly.
 * Defaults to a console warning if not implemented.
 * @private
 */
let onPreviewErrorRequiresReload = () => { console.warn("onPreviewErrorRequiresReload not implemented"); };

/**
 * Creates the basic structure of the inventory UI, including the header and the main panel
 * where inventory items will be displayed. This function sets up the static parts of the inventory UI.
 * The actual inventory items are populated by `updateUIContent`.
 *
 * @param {object} config - The current scene/level configuration object (not directly used in this function
 *                          but kept for consistency or future use).
 * @param {function(object): void} addItemCallback - The callback function to be called when an item is
 *                                                   selected from the inventory for placement.
 *                                                   Receives the inventory item's configuration object.
 * @param {function(): void} previewErrorCallback - The callback function to be called if an error occurs
 *                                                  during preview generation that requires a UI reload.
 */
function createInventoryUI(config, addItemCallback, previewErrorCallback) {
    onAddItemRequest = addItemCallback;
    onPreviewErrorRequiresReload = previewErrorCallback;

    const scene = BABYLON.EngineStore.LastCreatedScene;
    if (!scene) {
        console.error("Cannot create UI: No active Babylon scene.");
        return;
    }

    const uiPanel = getMainPanel();
    if (!uiPanel) return;

    const inventoryHeader = new GUI.TextBlock("inventoryHeader", "Inventory");
    inventoryHeader.height = "30px";
    inventoryHeader.color = "white";
    inventoryHeader.fontSize = 18;
    inventoryHeader.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    uiPanel.addControl(inventoryHeader);

    inventoryPanel = new GUI.StackPanel("inventoryPanel");
    inventoryPanel.adaptWidthToChildren = true;
    inventoryPanel.isVertical = true;
    inventoryPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    uiPanel.addControl(inventoryPanel);

    console.log("Inventory UI structure created.");
}

/**
 * Dynamically updates the content of the inventory panel based on the provided configuration.
 * It clears existing inventory items and then repopulates the panel with new items,
 * generating 3D preview textures for each. If preview generation populates the cache or
 * results in an empty image, it triggers the `onPreviewErrorRequiresReload` callback.
 *
 * @async
 * @param {object} config - The current scene/level configuration object.
 * @param {Array<object>} config.inventory - An array of inventory item objects. Each item object
 *                                           should have properties like `id`, `displayName`, `type`,
 *                                           `count`, and `objectProperties` for preview generation.
 */
async function updateUIContent(config) {
    if (!inventoryPanel) return;
    let needsReloadThisPass = false;

    for (let i = inventoryPanel.children.length - 1; i >= 0; i--) {
        inventoryPanel.removeControl(inventoryPanel.children[i]);
    }

    const engine = BABYLON.EngineStore.LastCreatedEngine;
    const scene = BABYLON.EngineStore.LastCreatedScene;
    const imageSize = "120px";
    const textHeight = "40px";
    const itemWidth = "120px";
    const totalItemHeight = `${parseInt(imageSize) + parseInt(textHeight)}px`;
    const iconPadding = "5px";

    if (config.inventory && config.inventory.length > 0) {
        const inventoryItemsPromises = config.inventory.map(async (item) => {
            const itemContainer = new GUI.Rectangle(`container_${item.id}`);
            itemContainer.width = itemWidth;
            itemContainer.height = totalItemHeight;
            itemContainer.thickness = 1;
            itemContainer.color = "grey";
            itemContainer.background = "rgba(80, 80, 80, 0.5)";
            itemContainer.cornerRadius = 5;
            itemContainer.paddingTop = iconPadding;
            itemContainer.paddingBottom = iconPadding;
            itemContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

            const contentPanel = new GUI.StackPanel(`content_${item.id}`);
            contentPanel.isVertical = true;
            contentPanel.width = "100%";
            itemContainer.addControl(contentPanel);

            const previewResult = await createPreviewTexture(item, engine, scene, 128);
            let dataUrl = previewResult.dataUrl;

            if (previewResult.didPopulateCache) {
                needsReloadThisPass = true;
            }

            if (dataUrl === emptyImageUrl) {
                console.warn(`Preview for item ${item.id} resulted in emptyImageUrl. This will trigger a reload if not already set.`);
                needsReloadThisPass = true;
            }

            const itemPreviewImage = new GUI.Image(`preview_${item.id}`, dataUrl);
            itemPreviewImage.stretch = GUI.Image.STRETCH_UNIFORM;
            itemPreviewImage.height = imageSize;
            itemPreviewImage.width = itemWidth;

            if (dataUrl) {
                contentPanel.addControl(itemPreviewImage);
            } else {
                const errorText = new GUI.TextBlock(`error_${item.id}`, "Preview N/A");
                errorText.color = "red";
                errorText.fontSize = 14;
                errorText.height = imageSize;
                contentPanel.addControl(errorText);
            }

            const textPanel = new GUI.Grid(`textPanel_${item.id}`);
            textPanel.height = textHeight;
            textPanel.width = "100%";
            textPanel.paddingTop = "2px";
            textPanel.addRowDefinition(1.0);
            textPanel.addColumnDefinition(0.8);
            textPanel.addColumnDefinition(0.2);
            contentPanel.addControl(textPanel);

            const nameText = new GUI.TextBlock(`name_${item.id}`, item.displayName || item.type || 'Item');
            nameText.color = "white";
            nameText.fontSize = 12;
            nameText.textWrapping = true;
            nameText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            nameText.paddingLeft = "5px";
            nameText.shadowColor = "black";
            nameText.shadowOffsetX = 1;
            nameText.shadowOffsetY = 1;
            textPanel.addControl(nameText, 0, 0);

            const countText = new GUI.TextBlock(`count_${item.id}`, item.count.toString());
            countText.color = "white";
            countText.fontSize = 14;
            countText.fontWeight = "bold";
            countText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
            countText.paddingRight = "5px";
            countText.shadowColor = "black";
            countText.shadowOffsetX = 1;
            countText.shadowOffsetY = 1;
            textPanel.addControl(countText, 0, 1);

            if (item.count > 0) {
                itemContainer.isEnabled = true;
                itemContainer.alpha = 1.0;
                itemContainer.hoverCursor = "pointer";

                let isDragging = false;
                let dragStarted = false;
                let pointerMoveObserver = null;
                let pointerUpObserver = null;

                itemContainer.onPointerDownObservable.add((pointerInfo, event) => {
                    if (isDragging) return;
                    isDragging = true;
                    dragStarted = false;

                    setCameraMouseWheelZoomActive(false);

                    const advancedTexture = getAdvancedTexture();
                    const scene = BABYLON.EngineStore.LastCreatedScene;
                    if (!scene || !advancedTexture) return;

                    pointerMoveObserver = scene.onPointerObservable.add((pointerInfo) => {
                        if (!isDragging) return;
                        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE) {
                            if (!dragStarted) {
                                dragStarted = true;
                                if (typeof onAddItemRequest === "function") {
                                    onAddItemRequest(item);
                                }
                            }
                        }
                    });

                    pointerUpObserver = scene.onPointerObservable.add((pointerInfo) => {
                        if (!isDragging) return;
                        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
                            isDragging = false;
                            dragStarted = false;
                            setCameraMouseWheelZoomActive(true);
                            if (pointerMoveObserver) scene.onPointerObservable.remove(pointerMoveObserver);
                            if (pointerUpObserver) scene.onPointerObservable.remove(pointerUpObserver);
                        }
                    });
                });

                itemContainer.onPointerEnterObservable.add(() => { itemContainer.color = "white"; });
                itemContainer.onPointerOutObservable.add(() => { itemContainer.color = "grey"; });
            } else {
                itemContainer.isEnabled = false;
                itemContainer.alpha = 0.5;
                itemContainer.hoverCursor = "default";
            }

            return itemContainer;
        });

        const inventoryItems = await Promise.all(inventoryItemsPromises);

        if (needsReloadThisPass) {
            console.log("UI update requires reload due to cache population or preview error.");
            onPreviewErrorRequiresReload();
            return;
        }

        inventoryItems.forEach(itemContainer => {
            if (itemContainer) {
                inventoryPanel.addControl(itemContainer);
            }
        });

    } else {
        const noInventoryText = new GUI.TextBlock("noInventory", "No items in inventory");
        noInventoryText.color = "gray";
        noInventoryText.fontSize = 14;
        noInventoryText.height = "30px";
        inventoryPanel.addControl(noInventoryText);
    }
}

export {
    createInventoryUI,
    updateUIContent
};
