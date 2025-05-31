/**
 * @module core/postProcess/bloom
 * @description Provides a post-processing bloom effect for enhancing light sources and bright areas.
 * This makes bright lights glow and creates a dreamy atmosphere similar to the visual style 
 * shown in the reference image with glowing lanterns.
 */
import * as BABYLON from '@babylonjs/core';

/**
 * @constant {object} bloomSettings
 * @description Default settings for the bloom post-processing effect.
 * These values are used to initialize the bloom effect parameters.
 * @property {number} threshold - Brightness threshold for bloom effect (areas brighter than this will glow).
 * @property {number} weight - Weight/intensity of the bloom effect (higher values = more pronounced glow).
 * @property {number} kernel - Kernel size for the bloom blur (higher values = larger glow radius).
 * @property {number} scale - Scale of the bloom (affects the size and intensity of the glow).
 */
export const bloomSettings = {
  threshold: 0.2,
  weight: 0.3,
  kernel: 64,
  scale: 0.5,
  enabled: true
};

/**
 * Creates and configures a bloom post-processing effect for the scene.
 * 
 * @param {BABYLON.Scene} scene - The Babylon.js scene to apply the bloom effect to.
 * @param {BABYLON.Camera} camera - The camera to attach the bloom effect to.
 * @param {Object} [settings] - Optional settings to override the default bloomSettings.
 * @returns {Object} The bloom post-process pipeline and its settings.
 */
export function createBloomPostProcess(scene, camera, settings = {}) {
  const currentSettings = { ...bloomSettings, ...settings };
  
  const defaultPipeline = new BABYLON.DefaultRenderingPipeline(
    "bloomPipeline", 
    currentSettings.enabled, 
    scene,
    [camera]
  );


  defaultPipeline.bloomEnabled = currentSettings.enabled;
  defaultPipeline.bloomThreshold = currentSettings.threshold;
  defaultPipeline.bloomWeight = currentSettings.weight;
  defaultPipeline.bloomKernel = currentSettings.kernel;
  defaultPipeline.bloomScale = currentSettings.scale;


  return {
    pipeline: defaultPipeline,
    settings: currentSettings,
    
    updateSettings(newSettings) {
      Object.assign(this.settings, newSettings);

      this.pipeline.bloomEnabled = this.settings.enabled;
      this.pipeline.bloomThreshold = this.settings.threshold;
      this.pipeline.bloomWeight = this.settings.weight;
      this.pipeline.bloomKernel = this.settings.kernel;
      this.pipeline.bloomScale = this.settings.scale;
    }
  };
}
