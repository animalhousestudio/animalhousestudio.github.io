import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STATIC_ASSETS } from '../world/assetCatalog.mjs';
import { createStageRoot } from './stageLayout.mjs';
import { batchStaticArchitecture } from './optimize.mjs';

export async function addGardenStage(garden) {
  const { scene: model } = await new GLTFLoader().loadAsync(STATIC_ASSETS['garden-stage'].url);
  model.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true; node.receiveShadow = true;
    node.userData.collisionDisabled = true;
  });
  // The complete asset fits in one render batch per material. Physics never
  // reads these visual meshes and the parent keeps its own content boundary.
  batchStaticArchitecture(model, Infinity);
  const root = createStageRoot(model);
  garden.add(root);
  garden.userData.stage = root;
  return root;
}
