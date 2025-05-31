import * as GUI from '@babylonjs/gui';
import * as BABYLON from '@babylonjs/core';
import { getAdvancedTexture } from './uiCore.js';

let briefingContainer = null;
let briefingImageControl = null;
let closeButton = null;
let gifSprite = null;

/**
 * @module core/ui/briefingPanel
 * @description Manages the display of a briefing image panel at the start of a level.
 */

/**
 * Creates the briefing panel UI.
 * @param {string} imageUrl - The URL of the image to display.
 * @param {function} onCloseCallback - Callback function to execute when the panel is closed.
 */
function createBriefingPanel(imageUrl, onCloseCallback) {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        return;
    }

    if (briefingContainer) {
        disposeBriefingPanel();
    }

    briefingContainer = new GUI.Rectangle("briefingContainer");
    briefingContainer.width = "80%";
    briefingContainer.height = "80%";
    briefingContainer.cornerRadius = 20;
    briefingContainer.color = "Orange";
    briefingContainer.thickness = 2;
    briefingContainer.background = "rgba(0, 0, 0, 0.7)";
    briefingContainer.isHitTestVisible = true;
    briefingContainer.isPointerBlocker = true;
    advancedTexture.addControl(briefingContainer);    
    briefingContainer.isVisible = false;

    const imageDisplayContainer = document.createElement('div');
    imageDisplayContainer.id = 'briefingImageContainer';
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
        hideBriefingPanel();
        if (onCloseCallback) {
            onCloseCallback();
        }
    };
    imageDisplayContainer.appendChild(closeButtonHTML);
 
    briefingImageControl = {
        type: 'dom',
        element: imageDisplayContainer,
        dispose: () => {
            if (imageDisplayContainer && imageDisplayContainer.parentNode) {
                imageDisplayContainer.parentNode.removeChild(imageDisplayContainer);
            }
        }
    };
}

/**
 * Shows the briefing panel.
 */
function showBriefingPanel() {
    if (briefingContainer) {
        briefingContainer.isVisible = true;
        
        if (briefingImageControl && briefingImageControl.type === 'dom' && briefingImageControl.element) {
            briefingImageControl.element.style.display = 'flex';
        }
        
        console.log("Briefing panel shown.");
    } else {
        console.warn("Briefing Panel: Attempted to show panel, but it's not created.");
    }
}

/**
 * Hides the briefing panel.
 */
function hideBriefingPanel() {
    if (briefingContainer) {
        briefingContainer.isVisible = false;
        
        if (briefingImageControl && briefingImageControl.type === 'dom' && briefingImageControl.element) {
            briefingImageControl.element.style.display = 'none';
        }
    }
}

/**
 * Disposes of the briefing panel UI elements.
 */
function disposeBriefingPanel() {
    if (briefingContainer) {
        briefingContainer.dispose();
        briefingContainer = null;
    }
    
    if (briefingImageControl) {
        if (briefingImageControl.type === 'dom' && typeof briefingImageControl.dispose === 'function') {
            briefingImageControl.dispose();
        } else if (briefingImageControl.dispose) {
            briefingImageControl.dispose();
        }
        briefingImageControl = null;
    }
    
    if (closeButton) {
        closeButton.dispose();
        closeButton = null;
    }
}

export { createBriefingPanel, showBriefingPanel, hideBriefingPanel, disposeBriefingPanel };
