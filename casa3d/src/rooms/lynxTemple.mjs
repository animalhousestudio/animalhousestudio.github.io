import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STATIC_ASSETS, assetBounds, createAssetVisual } from '../world/assetCatalog.mjs';
import { createLynxTempleRoot, prepareLynxTempleCollision, prepareLynxTempleVisual } from './lynxTempleLayout.mjs';

export async function addLynxTemple(garden) {
  const root = createLynxTempleRoot(null, { localBounds: assetBounds('lynx-temple') });
  garden.add(root);
  garden.userData.lynxTemple = root;
  const visual = createAssetVisual('lynx-temple', root,
    prepareLynxTempleVisual, garden.userData.prepareVisual);
  garden.userData.visualLods.push(visual);
  const physicsReady = new GLTFLoader().loadAsync(STATIC_ASSETS['lynx-temple-collision'].url)
    .then(({ scene }) => root.add(prepareLynxTempleCollision(scene)));
  // Both the visual fallback and immutable physics are required at arrival.
  // Optional medium/near requests remain owned by the shared LOD controller.
  await Promise.all([visual.ready, physicsReady]);
  root.userData.ready = true;
  return root;
}
