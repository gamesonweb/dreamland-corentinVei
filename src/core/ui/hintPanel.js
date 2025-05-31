import * as GUI from '@babylonjs/gui';
import * as BABYLON from '@babylonjs/core';
import { getAdvancedTexture } from './uiCore.js';

let hintContainer = null;
let hintImageControl = null;
let closeButton = null;

/**
 * @module core/ui/hintPanel
 * @description Manages the display of a hint image panel.
 */

/**
 * Creates the hint panel UI.
 * @param {string} imageUrl - The URL of the image to display.
 * @param {function} onCloseCallback - Callback function to execute when the panel is closed.
 */
function createHintPanel(imageUrl, onCloseCallback) {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        console.error("Hint Panel: AdvancedTexture is not available.");
        return;
    }

    if (hintContainer) {
        disposeHintPanel();
    }

    hintContainer = new GUI.Rectangle("hintContainer");
    hintContainer.width = "80%";
    hintContainer.height = "80%";
    hintContainer.cornerRadius = 20;
    hintContainer.color = "Orange";
    hintContainer.thickness = 2;
    hintContainer.background = "rgba(0, 0, 0, 0.7)";
    hintContainer.isHitTestVisible = true;
    hintContainer.isPointerBlocker = true;
    advancedTexture.addControl(hintContainer);
    hintContainer.isVisible = false;

    if (imageUrl) {
        const imageDisplayContainer = document.createElement('div');
        imageDisplayContainer.id = 'hintImageDisplayContainer';
        imageDisplayContainer.style.position = 'fixed';
        imageDisplayContainer.style.top = '0';
        imageDisplayContainer.style.left = '0';
        imageDisplayContainer.style.width = '100%';
        imageDisplayContainer.style.height = '100%';
        imageDisplayContainer.style.display = 'flex';
        imageDisplayContainer.style.justifyContent = 'center';
        imageDisplayContainer.style.alignItems = 'center';
        imageDisplayContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        imageDisplayContainer.style.zIndex = '1000';
        imageDisplayContainer.style.display = 'none';
        document.body.appendChild(imageDisplayContainer);

        const imageElement = document.createElement('img');
        imageElement.src = imageUrl;
        imageElement.style.maxWidth = '90%';
        imageElement.style.maxHeight = '90%';
        imageElement.style.objectFit = 'contain';
        imageElement.style.display = 'block';
        imageDisplayContainer.appendChild(imageElement);

    
        const closeButtonHTML = document.createElement('button');
        closeButtonHTML.textContent = 'Close';
        closeButtonHTML.style.position = 'absolute';
        closeButtonHTML.style.bottom = '5%';
        closeButtonHTML.style.padding = '10px 30px';
        closeButtonHTML.style.backgroundColor = 'red';
        closeButtonHTML.style.color = 'white';
        closeButtonHTML.style.border = 'none';
        closeButtonHTML.style.borderRadius = '10px';
        closeButtonHTML.style.cursor = 'pointer';
        closeButtonHTML.onclick = () => {
            hideHintPanel();
            if (onCloseCallback) {
                onCloseCallback();
            }
        };
        imageDisplayContainer.appendChild(closeButtonHTML);

        hintImageControl = {
            type: 'dom',
            element: imageDisplayContainer,
            dispose: () => {
                if (imageDisplayContainer && imageDisplayContainer.parentNode) {
                    imageDisplayContainer.parentNode.removeChild(imageDisplayContainer);
                }
            }
        };
    } else {
        const imageHolder = new GUI.Rectangle("hintImageHolder");
        imageHolder.width = "100%";
        imageHolder.height = "100%";
        imageHolder.thickness = 0;
        imageHolder.isHitTestVisible = false;
        imageHolder.paddingTop = "20px";
        imageHolder.paddingBottom = "20px"; 
        imageHolder.paddingLeft = "20px";
        imageHolder.paddingRight = "20px";
        hintContainer.addControl(imageHolder);
        const noHintText = new GUI.TextBlock("noHintText", "No hint available.");
        noHintText.color = "white";
        noHintText.fontSize = 24;
        imageHolder.addControl(noHintText);
        
        closeButton = GUI.Button.CreateSimpleButton("closeNoHintButton", "Close");
        closeButton.width = "150px";
        closeButton.height = "40px";
        closeButton.color = "white";
        closeButton.cornerRadius = 10;
        closeButton.background = "#8B0000";
        closeButton.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        closeButton.paddingBottom = "10px";
        hintContainer.addControl(closeButton);

        closeButton.onPointerUpObservable.add(() => {
            hideHintPanel();
            if (onCloseCallback) {
                onCloseCallback();
            }
        });
    }
}

/**
 * Shows the hint panel.
 */
function showHintPanel() {
    if (hintContainer) {
        hintContainer.isVisible = true;
        if (hintImageControl && hintImageControl.type === 'dom' && hintImageControl.element) {
            hintImageControl.element.style.display = 'flex';
        }
    }
}

/**
 * Hides the hint panel.
 */
function hideHintPanel() {
    if (hintContainer) {
        hintContainer.isVisible = false;
        if (hintImageControl && hintImageControl.type === 'dom' && hintImageControl.element) {
            hintImageControl.element.style.display = 'none';
        }
    }
}

/**
 * Disposes of the hint panel UI elements.
 */
function disposeHintPanel() {
    if (hintContainer) {
        hintContainer.dispose();
        hintContainer = null;
    }
    
    if (hintImageControl) {
        if (hintImageControl.type === 'dom' && typeof hintImageControl.dispose === 'function') {
            hintImageControl.dispose();
        } else if (hintImageControl.dispose) {
            hintImageControl.dispose();
        }
        hintImageControl = null;
    }
    
    if (closeButton) {
        closeButton.dispose();
        closeButton = null;
    }
}

export { createHintPanel, showHintPanel, hideHintPanel, disposeHintPanel };
