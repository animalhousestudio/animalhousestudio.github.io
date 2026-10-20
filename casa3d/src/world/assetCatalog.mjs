import { Box3, Group, LoadingManager, Sphere, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createVisualLod, disposeVisualObject } from './visualLod.mjs';
import metadata from '../assets/models/lod/metadata.json';
import fountainNear from '../assets/models/props/triton-chocolate-fountain.glb?url';
import fountainMedium from '../assets/models/lod/triton-chocolate-fountain-medium.glb?url';
import fountainFar from '../assets/models/lod/triton-chocolate-fountain-far.glb?url';
import beehiveNear from '../assets/models/props/beehive-dreamy.glb?url';
import beehiveMedium from '../assets/models/lod/beehive-dreamy-medium.glb?url';
import beehiveFar from '../assets/models/lod/beehive-dreamy-far.glb?url';
import gardenStage from '../assets/models/props/garden-stage.glb?url';
import lynxTempleMetadata from '../assets/models/lod/lynx-temple-metadata.json';
import lynxTempleNear from '../assets/models/props/lynx-temple-near.glb?url';
import lynxTempleMedium from '../assets/models/lod/lynx-temple-medium.glb?url';
import lynxTempleFar from '../assets/models/lod/lynx-temple-far.glb?url';
import lynxTempleCollision from '../assets/models/props/lynx-temple-collision.glb?url';
import lollipopBasket from '../assets/models/props/lollipop-basket.glb?url';
import contactBooth from '../assets/models/props/contact-booth.glb?url';

// Small authored assets do not need a deferred high-detail tier.
export const STATIC_ASSETS = Object.freeze({
  'contact-booth': Object.freeze({ url: contactBooth, units: 'metres', triangles: 6684 }),
  'garden-stage': Object.freeze({ url: gardenStage, units: 'metres', triangles: 18320 }),
  'lynx-temple-collision': Object.freeze({ url: lynxTempleCollision, units: 'metres' }),
  'lollipop-basket': Object.freeze({ url: lollipopBasket, units: 'metres' }),
});

// Thresholds are projected sphere diameters in CSS/render pixels, not model units.
// Importing a URL does not fetch it: medium/near are requested by visualLod only.
export const VISUAL_ASSETS = Object.freeze({
  fountain: Object.freeze({ ...metadata.fountain, urls: { far: fountainFar, medium: fountainMedium, near: fountainNear } }),
  beehive: Object.freeze({ ...metadata.beehive, urls: { far: beehiveFar, medium: beehiveMedium, near: beehiveNear } }),
  'lynx-temple': Object.freeze({ ...lynxTempleMetadata, units: 'metres',
    urls: { far: lynxTempleFar, medium: lynxTempleMedium, near: lynxTempleNear } }),
});

export function assetBounds(id) {
  const asset = VISUAL_ASSETS[id];
  if (!asset) throw new Error(`Unknown visual asset: ${id}`);
  return new Box3(new Vector3(...asset.bounds.min), new Vector3(...asset.bounds.max));
}

/** Each tier owns its GLTF resources; collision hulls live outside this branch. */
export function createAssetVisual(id, parent, prepare = () => {}, prepareForDisplay = async () => {}) {
  const asset = VISUAL_ASSETS[id];
  const root = new Group();
  root.name = `${id}_VisualTiers`;
  root.userData.collisionDisabled = true;
  parent.add(root);
  // A dedicated manager keeps deferred requests out of boot progress reporting.
  const loader = new GLTFLoader(new LoadingManager());
  const lod = createVisualLod({
    root,
    bounds: assetBounds(id).getBoundingSphere(new Sphere()),
    levels: [['far', 0], ['medium', 80], ['near', 260]].map(([level, minPixels]) => ({
      id: level, minPixels,
      load: async () => {
        const { scene } = await loader.loadAsync(asset.urls[level]);
        try {
          scene.userData.visualLevel = level;
          prepare(scene, level);
          if (level !== 'far') await prepareForDisplay(scene);
          return scene;
        } catch (error) {
          disposeVisualObject(scene);
          throw error;
        }
      },
    })),
    hysteresis: .15,
    unloadAfter: 20,
    retryDelay: 15,
    maxRetries: 1,
  });
  return { ...lod, get object() { return lod.object; }, root, assetId: id };
}
