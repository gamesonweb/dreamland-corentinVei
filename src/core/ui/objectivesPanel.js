import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { getAdvancedTexture } from './uiCore.js';

/**
 * @module core/ui/objectivesPanel
 * @description Manages the creation, updating, and disposal of the objectives and manual end conditions display panel.
 */

let objectivesPanel = null;
let objectiveTextBlocks = new Map();
let conditionControls = new Map();

/**
 * Creates the objectives and manual end conditions display panel.
 *
 * @param {Array<module:core/objectives/Objective.Objective>} objectiveInstances - Active objective instances.
 * @param {Array<module:core/conditions/Condition.Condition>} conditionInstances - Active condition instances.
 */
function createObjectivesPanel(objectiveInstances = [], conditionInstances = []) {
    const advancedTexture = getAdvancedTexture();
    if (!advancedTexture) {
        console.error("Cannot create objectives panel: AdvancedTexture not available.");
        return;
    }
    
    disposeObjectivesPanel();

    objectivesPanel = new GUI.StackPanel("objectivesPanel");
    objectivesPanel.width = "420px";
    objectivesPanel.isVertical = true;
    objectivesPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    objectivesPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    objectivesPanel.paddingTop = "60px";
    objectivesPanel.paddingRight = "20px";
    objectivesPanel.isVisible = (objectiveInstances.length > 0 || conditionInstances.length > 0);
    
    advancedTexture.addControl(objectivesPanel);

    if (objectiveInstances.length > 0) {
        const objectivesHeader = new GUI.TextBlock("objectivesHeader", "Objectives");
        objectivesHeader.height = "30px";
        objectivesHeader.color = "white";
        objectivesHeader.fontSize = 18;
        objectivesHeader.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        objectivesPanel.addControl(objectivesHeader);

        objectiveInstances.forEach(objective => {
            const status = objective.getStatus();
            const textBlock = new GUI.TextBlock(`objText_${status.id}`, `${status.displayName}: ${status.statusText}`);
            textBlock.height = "25px";
            textBlock.color = "white";
            textBlock.fontSize = 14;
            textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            textBlock.paddingLeft = "10px";
            objectivesPanel.addControl(textBlock);
            objectiveTextBlocks.set(status.id, textBlock);
        });
    }

    if (conditionInstances.length > 0) {
        const conditionsHeader = new GUI.TextBlock("conditionsHeader", "End Conditions");
        conditionsHeader.height = "30px";
        conditionsHeader.color = "white";
        conditionsHeader.fontSize = 18;
        conditionsHeader.paddingTop = "10px";
        conditionsHeader.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        objectivesPanel.addControl(conditionsHeader);

        conditionInstances.forEach(condition => {
            if (condition.constructor.name === 'TimeLimitCondition') {
                const targetButtonWidth = "280px";
                const targetButtonHeight = "75px";
                const buttonFontSize = 22;
                const buttonPaddingTop = "10px";

                const container = new GUI.StackPanel(`condContainer_${condition.id}`);
                container.isVertical = true;
                container.adaptHeightToChildren = true;
                container.paddingLeft = "10px";

                const textBlock = new GUI.TextBlock(`condText_${condition.id}`, `${condition.displayName}: ${condition.remainingTime.toFixed(1)}s`);
                textBlock.color = "white";
                textBlock.fontSize = 14;
                textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                textBlock.height = "25px";
                textBlock.width = "100%";
                container.addControl(textBlock);

                let button = null;

                if (condition.awaitsManualTrigger) {
                    button = GUI.Button.CreateSimpleButton(`condBtn_${condition.id}`, condition.actionButtonText);
                    button.height = targetButtonHeight;
                    button.width = targetButtonWidth; 
                    button.color = "white";
                    button.background = "darkorange"; 
                    button.fontSize = buttonFontSize; 
                    button.cornerRadius = 8; 
                    button.thickness = 2;
                    button.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
                    button.paddingTop = buttonPaddingTop;
                    button.transformCenterX = 0.5;
                    button.transformCenterY = 0.5;

                    button.alpha = 0;
                    button.width = "0px";
                    button.isVisible = false; 
                    button.scaleX = 1;
                    button.scaleY = 1;

                    button.onPointerUpObservable.add(() => {
                        condition.triggerManually();
                    });
                    container.addControl(button);
                }
                objectivesPanel.addControl(container);
                conditionControls.set(condition.id, { 
                    textBlock, 
                    button, 
                    container, 
                    isButtonVisible: false, 
                    targetButtonWidth,
                    pulseAnimation: null
                });
            } else {
                const textBlock = new GUI.TextBlock(`condText_${condition.id}`, `${condition.displayName}: ${condition.isMet ? 'Met' : 'Pending'}`);
                textBlock.height = "25px";
                textBlock.color = "white";
                textBlock.fontSize = 14;
                textBlock.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
                textBlock.paddingLeft = "10px";
                objectivesPanel.addControl(textBlock);
                conditionControls.set(condition.id, { textBlock, button: null, container: textBlock });
            }
        });
    }
    
    updateObjectivesPanel(objectiveInstances, conditionInstances);
    console.log("Objectives and Conditions panel created.");
}

/**
 * Updates the objectives panel to reflect current statuses and manual trigger buttons.
 *
 * @param {Array<module:core/objectives/Objective.Objective>} objectiveInstances - Active objective instances.
 * @param {Array<module:core/conditions/Condition.Condition>} conditionInstances - Active condition instances.
 */
function updateObjectivesPanel(objectiveInstances = [], conditionInstances = []) {
    if (!objectivesPanel) return;

    objectiveInstances.forEach(objective => {
        const status = objective.getStatus();
        const textBlock = objectiveTextBlocks.get(status.id);
        if (textBlock) {
            textBlock.text = `${status.displayName}: ${status.statusText}`;
            textBlock.color = status.isComplete ? "lightgreen" : (status.isFailed ? "salmon" : "white");
        }
    });

    conditionInstances.forEach(condition => {
        const controls = conditionControls.get(condition.id);
        if (controls) {
            if (condition.constructor.name === 'TimeLimitCondition') {
                controls.textBlock.text = `${condition.displayName}: ${condition.remainingTime.toFixed(1)}s`;
                
                if (controls.button) {
                    const shouldBeVisible = condition.isTimeUp && !condition.isMet;
                    
                    if (shouldBeVisible && !controls.isButtonVisible) {
                        controls.button.isVisible = true;
                        controls.isButtonVisible = true;
                        
                        const scene = getAdvancedTexture().getScene();
                        if (scene) {
                            const animations = [];
                            
                            const alphaAnim = new BABYLON.Animation(
                                `condBtnAlphaAnim_${condition.id}`, 
                                "alpha", 
                                30, 
                                BABYLON.Animation.ANIMATIONTYPE_FLOAT, 
                                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
                            );
                            alphaAnim.setKeys([
                                { frame: 0, value: 0 },
                                { frame: 10, value: 1 }
                            ]);
                            animations.push(alphaAnim);

                            const widthAnim = new BABYLON.Animation(
                                `condBtnWidthAnim_${condition.id}`,
                                "widthInPixels",
                                30,
                                BABYLON.Animation.ANIMATIONTYPE_FLOAT,
                                BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
                            );
                            const targetWidthPx = parseFloat(controls.targetButtonWidth);
                            widthAnim.setKeys([
                                { frame: 0, value: 0 },
                                { frame: 15, value: targetWidthPx }
                            ]);
                            animations.push(widthAnim);
                            

                            scene.beginDirectAnimation(controls.button, animations, 0, 15, false, 1, () => {
                                if (controls.button.isVisible && !controls.pulseAnimation) {
                                    const pulseAnimGroup = new BABYLON.AnimationGroup(`pulseAnimGroup_${condition.id}`);
                                    
                                    const scaleXAnim = new BABYLON.Animation(`pulseScaleX_${condition.id}`, "scaleX", 30, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
                                    scaleXAnim.setKeys([
                                        { frame: 0, value: 1.0 },
                                        { frame: 15, value: 1.05 },
                                        { frame: 30, value: 1.0 }
                                    ]);
                                    const scaleYAnim = new BABYLON.Animation(`pulseScaleY_${condition.id}`, "scaleY", 30, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
                                    scaleYAnim.setKeys([
                                        { frame: 0, value: 1.0 },
                                        { frame: 15, value: 1.05 },
                                        { frame: 30, value: 1.0 }
                                    ]);
                                    
                                    pulseAnimGroup.addTargetedAnimation(scaleXAnim, controls.button);
                                    pulseAnimGroup.addTargetedAnimation(scaleYAnim, controls.button);
                                    pulseAnimGroup.normalize(0, 30);
                                    pulseAnimGroup.play(true);
                                    controls.pulseAnimation = pulseAnimGroup;
                                }
                            });
                        } else {
                            controls.button.alpha = 1;
                            controls.button.width = controls.targetButtonWidth;
                        }

                    } else if (!shouldBeVisible && controls.isButtonVisible) {
                        if (controls.pulseAnimation) {
                            controls.pulseAnimation.stop();
                            controls.pulseAnimation.dispose();
                            controls.pulseAnimation = null;
                            controls.button.scaleX = 1;
                            controls.button.scaleY = 1;
                        }
                        controls.button.isVisible = false;
                        controls.isButtonVisible = false;
                        controls.button.alpha = 0;
                        controls.button.width = "0px";
                    }

                    if (condition.isMet) {
                        if (controls.pulseAnimation) {
                            controls.pulseAnimation.stop();
                            controls.pulseAnimation.dispose();
                            controls.pulseAnimation = null;
                            controls.button.scaleX = 1;
                            controls.button.scaleY = 1;
                        }
                        controls.button.isVisible = false;
                        controls.isButtonVisible = false;
                    }
                }
                if (condition.isMet) {
                    controls.textBlock.color = "lightgreen";
                } else if (condition.isTimeUp) {
                    controls.textBlock.color = "yellow";
                } else {
                    controls.textBlock.color = "white";
                }

            } else {
                controls.textBlock.text = `${condition.displayName}: ${condition.isMet ? 'Met' : 'Pending'}`;
                controls.textBlock.color = condition.isMet ? "lightgreen" : "white";
            }
        }
    });
    
    const hasObjectives = objectiveInstances.length > 0;
    const hasConditions = conditionInstances.length > 0;
    objectivesPanel.isVisible = hasObjectives || hasConditions;
}

/**
 * Disposes of the objectives panel UI elements.
 */
function disposeObjectivesPanel() {
    if (objectivesPanel) {
        console.log("Disposing objectives and conditions panel...");
        objectivesPanel.dispose();
        objectivesPanel = null;
    }
    objectiveTextBlocks.clear();
    conditionControls.forEach(controls => {
        if (controls.textBlock) controls.textBlock.dispose();
        if (controls.button) controls.button.dispose();
        if (controls.container && controls.container !== controls.textBlock) controls.container.dispose();
    });
    conditionControls.clear();
}

export {
    createObjectivesPanel,
    updateObjectivesPanel,
    disposeObjectivesPanel
};
