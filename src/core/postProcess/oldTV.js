/**
 * @module core/postProcess/oldTV
 * @description Provides a post-processing effect to simulate an old CRT television screen.
 * This includes effects like scanlines, noise, vignette, color banding (posterization),
 * and screen flicker. The module exports default settings for the effect and a function
 * to create and configure the Babylon.js `PostProcess` object.
 */
import * as BABYLON from '@babylonjs/core';

/**
 * @constant {object} oldTVSettings
 * @description Default settings for the Old TV post-processing effect.
 * These values are used to initialize the shader uniforms.
 * @property {number} scanlineCount - Number of scanlines across the screen.
 * @property {number} scanlineIntensity - Intensity/visibility of the scanlines.
 * @property {number} scanlineMovement - Speed at which scanlines move vertically.
 * @property {number} noiseIntensity - Intensity of the random noise overlay.
 * @property {number} luminosityAmplification - Factor to amplify overall screen luminosity.
 * @property {number} vignetteStrength - Strength of the vignette effect (darkening of screen edges).
 * @property {number} colorBands - Number of color bands per channel for posterization (less bands = more posterized).
 * @property {number} darkThreshold - Luminosity threshold below which original colors are preserved during posterization.
 * @property {number} flickerSpeed - Speed of the screen brightness flicker.
 * @property {number} flickerIntensity - Intensity of the screen brightness flicker.
 */
export const oldTVSettings = {
  scanlineCount: 800.0,
  scanlineIntensity: 0.04,
  scanlineMovement: 2.0,
  noiseIntensity: 0.08,
  luminosityAmplification: 1.5,
  vignetteStrength: 1.0,
  colorBands: 8.0,
  darkThreshold: 0.3,
  flickerSpeed: 5.0,
  flickerIntensity: 0.05,
};

/**
 * @constant {string} oldTVShader
 * @description GLSL fragment shader code for the Old TV post-processing effect.
 * This shader applies various visual distortions to simulate an old television screen.
 * It takes several uniforms (defined in `oldTVSettings`) to control the intensity
 * and behavior of these effects.
 *
 * Effects include:
 * - Luminosity amplification (simulating night vision or old TV brightness).
 * - Posterization (color banding), with preservation of dark areas.
 * - Screen flicker (oscillating brightness).
 * - Moving scanlines.
 * - Vignette effect (darkened corners).
 * - Static noise.
 */
const oldTVShader = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float time;
uniform float scanlineCount;
uniform float scanlineIntensity;
uniform float scanlineMovement;
uniform float noiseIntensity;
uniform float luminosityAmplification;
uniform float vignetteStrength;
uniform float colorBands;
uniform float darkThreshold;
uniform float flickerSpeed;
uniform float flickerIntensity;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
}

void main(void) {
  vec2 uv = vUV;
  vec4 color = texture2D(textureSampler, uv);

  float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  
  lum = pow(lum, 0.6) * luminosityAmplification;
  
  vec3 originalColor = color.rgb;
  if (colorBands > 0.0) {
    vec3 posterizedColor;
    posterizedColor.r = floor(color.r * colorBands) / colorBands;
    posterizedColor.g = floor(color.g * colorBands) / colorBands;
    posterizedColor.b = floor(color.b * colorBands) / colorBands;
    
    float blendFactor = smoothstep(darkThreshold, darkThreshold + 0.2, lum);
    color.rgb = mix(originalColor, posterizedColor, blendFactor);
  }
  
  float flicker = 1.0 + sin(time * flickerSpeed) * flickerIntensity;
  
  float scanLine = sin(uv.y * scanlineCount + time * scanlineMovement) * scanlineIntensity;
  
  float vignette = 1.0 - vignetteStrength * length(vec2(0.5, 0.5) - uv);
  
  float noise = (rand(uv + time) - 0.5) * noiseIntensity;
  
  vec3 enhancedColor = color.rgb * luminosityAmplification;
  
  enhancedColor = enhancedColor * flicker;
  enhancedColor -= vec3(scanLine);
  enhancedColor += vec3(noise);
  enhancedColor *= vignette;
  
  gl_FragColor = vec4(enhancedColor, 1.0);
}
`;

BABYLON.Effect.ShadersStore["oldTVPixelShader"] = oldTVShader;

/**
 * Creates and configures a Babylon.js `PostProcess` object for the Old TV effect.
 * This function initializes the post-process with the custom "oldTV" shader and
 * sets up an `onApply` callback to update shader uniforms with values from
 * `oldTVSettings` and the current time (for animated effects like scanline movement and noise).
 *
 * @param {BABYLON.Camera} camera - The camera to which this post-processing effect will be attached.
 * @returns {BABYLON.PostProcess} A configured `PostProcess` instance for the Old TV effect.
 */
export function createOldTVPostProcess(camera) {
    const post = new BABYLON.PostProcess(
      "oldTV",
      "oldTV",
      [
        "time",
        "scanlineCount",
        "scanlineIntensity",
        "scanlineMovement",
        "noiseIntensity",
        "luminosityAmplification",
        "vignetteStrength",
        "colorBands",
        "darkThreshold",
        "flickerSpeed",
        "flickerIntensity"
      ],
      null,
      1.0,
      camera
    );

    post.onApply = (effect) => {
      const t = performance.now() * 0.001;
      effect.setFloat("time", t);
      effect.setFloat("scanlineCount", oldTVSettings.scanlineCount);
      effect.setFloat("scanlineIntensity", oldTVSettings.scanlineIntensity);
      effect.setFloat("scanlineMovement", oldTVSettings.scanlineMovement);
      effect.setFloat("noiseIntensity", oldTVSettings.noiseIntensity);
      effect.setFloat("luminosityAmplification", oldTVSettings.luminosityAmplification);
      effect.setFloat("vignetteStrength", oldTVSettings.vignetteStrength);
      effect.setFloat("colorBands", oldTVSettings.colorBands);
      effect.setFloat("darkThreshold", oldTVSettings.darkThreshold);
      effect.setFloat("flickerSpeed", oldTVSettings.flickerSpeed);
      effect.setFloat("flickerIntensity", oldTVSettings.flickerIntensity);
    };

  return post;
}
