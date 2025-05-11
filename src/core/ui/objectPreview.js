import * as BABYLON from '@babylonjs/core';
import { RenderTargetTexture, FreeCamera, Vector3, Color4, MeshBuilder, StandardMaterial, EngineStore, Camera } from '@babylonjs/core';
import { emptyImageUrl } from './uiCore.js';

/**
 * @module core/ui/objectPreview
 * @description Provides functionality to generate 2D preview images (as data URLs)
 * of 3D objects. These previews are typically used in UI elements like inventory panels.
 * It utilizes Babylon.js RenderTargetTexture (RTT) for off-screen rendering and
 * includes a localStorage-based caching mechanism to improve performance.
 */

/**
 * Creates a 2D preview texture (as a data URL) for a given inventory item.
 * It first checks localStorage for a cached version of the preview. If not found,
 * it generates a new preview by:
 * 1. Creating a `RenderTargetTexture` (RTT).
 * 2. Setting up a dedicated orthographic camera for the RTT.
 * 3. Creating a temporary 3D mesh based on `itemData.objectProperties` (type, dimensions, color).
 *    The mesh is scaled to fit within a normalized preview size.
 * 4. Rendering this mesh to the RTT.
 * 5. Reading the pixel data from the RTT and converting it to a PNG data URL.
 * 6. Storing the new data URL in localStorage for future use.
 *
 * The function handles potential errors during rendering or localStorage access and
 * cleans up temporary Babylon.js resources (RTT, camera, mesh).
 *
 * @async
 * @param {object} itemData - Data object for the inventory item.
 * @param {string} itemData.id - Unique ID of the item (used in cache key).
 * @param {object} itemData.objectProperties - Properties defining the 3D object.
 * @param {string} itemData.objectProperties.type - Type of the object (e.g., "box", "circle").
 * @param {object} [itemData.objectProperties.color] - Optional color {r, g, b}.
 * @param {number} [itemData.objectProperties.width] - Width (for box type).
 * @param {number} [itemData.objectProperties.height] - Height (for box type).
 * @param {number} [itemData.objectProperties.depth] - Depth (for box type).
 * @param {number} [itemData.objectProperties.radius] - Radius (for circle type).
 * @param {BABYLON.Engine} engine - The Babylon.js engine instance.
 * @param {BABYLON.Scene} scene - The Babylon.js scene instance.
 * @param {number} size - The desired width and height of the preview texture in pixels.
 * @returns {Promise<{dataUrl: string | null, didPopulateCache: boolean}>}
 *          A promise that resolves to an object containing:
 *          - `dataUrl`: The data URL (base64 encoded PNG) of the preview image, or `null` if generation failed.
 *                       Can also be `emptyImageUrl` if the generated image is effectively empty.
 *          - `didPopulateCache`: A boolean indicating if a new preview was generated and successfully stored in localStorage.
 */
async function createPreviewTexture(itemData, engine, scene, size) {
    let didPopulateCache = false;
    
    if (!engine || !scene || !itemData || !itemData.objectProperties || !itemData.objectProperties.type) {
        console.warn(`Cannot create preview for item: Missing data, objectProperties, or type. Item ID: ${itemData?.id}`);
        return { dataUrl: null, didPopulateCache };
    }
    
    const props = itemData.objectProperties;

    const colorString = props.color ? `${props.color.r}_${props.color.g}_${props.color.b}` : 'no_color';
    const dimensionsString = `${props.width || 'defW'}_${props.height || 'defH'}_${props.depth || 'defD'}_${props.radius || 'defR'}`;
    const cacheKey = `preview_${itemData.id}_${props.type}_${colorString}_${dimensionsString}`;

    try {
        const cachedDataUrl = localStorage.getItem(cacheKey);
        if (cachedDataUrl) {
            return { dataUrl: cachedDataUrl, didPopulateCache: false };
        }
    } catch (e) {
        console.warn("localStorage access error (getItem):", e);
    }

    const rttName = `rtt_${itemData.id}_${Date.now()}`;
    const rtt = new RenderTargetTexture(rttName, size, scene, false);
    rtt.clearColor = new Color4(0, 0, 0, 0);

    const cameraName = `previewCam_${itemData.id}`;
    const previewCamera = new FreeCamera(cameraName, new Vector3(1, 1, -2.5), scene);
    previewCamera.setTarget(Vector3.Zero());
    previewCamera.mode = Camera.ORTHOGRAPHIC_CAMERA;

    const orthoSize = 1.2;
    previewCamera.orthoTop = orthoSize;
    previewCamera.orthoBottom = -orthoSize;
    previewCamera.orthoLeft = -orthoSize;
    previewCamera.orthoRight = orthoSize;

    rtt.activeCamera = previewCamera;

    let previewMesh = null;
    const meshName = `previewMesh_${itemData.id}`;
    const material = new StandardMaterial(`previewMat_${itemData.id}`, scene);
    material.diffuseColor = new BABYLON.Color3(props.color?.r ?? 0.5, props.color?.g ?? 0.5, props.color?.b ?? 0.5);
    material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);

    const previewSize = 1.0;

    if (props.type === "box") {
        const maxDim = Math.max(props.width || 1, props.height || 1, props.depth || props.width || 1);
        const scale = previewSize / maxDim;
        previewMesh = MeshBuilder.CreateBox(meshName, {
            width: (props.width || 1) * scale,
            height: (props.height || 1) * scale,
            depth: (props.depth || props.width || 1) * scale
        }, scene);
    } else if (props.type === "circle") {
        const scale = previewSize / (props.radius * 2 || 1);
        previewMesh = MeshBuilder.CreateSphere(meshName, {
            diameter: (props.radius * 2 || 1) * scale
        }, scene);
    } else {
        console.warn(`Unknown item type for preview: ${props.type}. Using default sphere.`);
        previewMesh = MeshBuilder.CreateSphere(meshName, { diameter: previewSize * 0.8 }, scene);
    }

    if (!previewMesh) {
        console.error(`Failed to create preview mesh for item: ${itemData.id}`);
        rtt.dispose();
        previewCamera.dispose();
        return { dataUrl: null, didPopulateCache };
    }

    previewMesh.material = material;
    previewMesh.position = Vector3.Zero();
    
    if (props.type === "box") {
        previewMesh.rotation = new Vector3(0, Math.PI / 1, 0);
    } else {
        previewMesh.rotation = Vector3.Zero();
    }

    rtt.renderList = [previewMesh];
    previewMesh.isPickable = false;

    let dataUrl = null;
    try {
        const renderResult = await new Promise((resolve, reject) => {
            const checkReadiness = () => {
                if (rtt.isReadyForRendering()) {
                    const originalRenderTargets = [...scene.customRenderTargets];
                    scene.customRenderTargets.push(rtt);
                    scene.render();
                    
                    scene.customRenderTargets = originalRenderTargets;
                    
                    rtt.readPixels()
                        .then(buffer => resolve(buffer))
                        .catch(err => reject(err));
                } else {
                    setTimeout(checkReadiness, 50);
                }
            };
            checkReadiness();
        });
        
        if (renderResult) {
            const flippedResult = new Uint8Array(renderResult.length);
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const sourceIndex = y * size * 4 + x * 4;
                    const destIndex = (size - y - 1) * size * 4 + x * 4;
                    
                    flippedResult[destIndex] = renderResult[sourceIndex];
                    flippedResult[destIndex + 1] = renderResult[sourceIndex + 1];
                    flippedResult[destIndex + 2] = renderResult[sourceIndex + 2];
                    flippedResult[destIndex + 3] = renderResult[sourceIndex + 3];
                }
            }
            
            dataUrl = await new Promise(resolve => {
                BABYLON.Tools.DumpData(size, size, flippedResult, imageDataURL => {
                    resolve(imageDataURL);
                });
            });
            
            let hasContent = false;
            for (let i = 0; i < renderResult.length; i++) {
                if (renderResult[i] > 0) {
                    hasContent = true;
                    break;
                }
            }

            if (!hasContent) {
                dataUrl = emptyImageUrl;
            }
        } else {
            console.error(`Failed to read pixels from RTT for preview: ${itemData.id}`);
        }
    } catch (error) {
        console.error(`Error generating preview data URL for item ${itemData.id}:`, error);
    } finally {
        if (rtt) rtt.dispose();
        if (previewMesh && !previewMesh.isDisposed()) previewMesh.dispose();
        if (previewCamera && !previewCamera.isDisposed()) previewCamera.dispose();
    }

    if (dataUrl && dataUrl !== emptyImageUrl) {
        try {
            localStorage.setItem(cacheKey, dataUrl);
            didPopulateCache = true;
        } catch (e) {
            console.warn(`localStorage access error (setItem) for ${itemData.id}:`, e);
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.warn("LocalStorage quota exceeded. Consider implementing a cache eviction strategy.");
            }
        }
    }

    return { dataUrl, didPopulateCache };
}

export {
    createPreviewTexture
};
