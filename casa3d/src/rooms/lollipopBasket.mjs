import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STATIC_ASSETS } from '../world/assetCatalog.mjs';
import { batchStaticArchitecture } from './optimize.mjs';
import { createLollipopBasketRoot } from './lollipopBasketLayout.mjs';

export async function addLollipopBasket(garden) {
  const { scene } = await new GLTFLoader().loadAsync(STATIC_ASSETS['lollipop-basket'].url);
  const root = createLollipopBasketRoot(scene);
  batchStaticArchitecture(scene, Infinity);
  garden.add(root);
  root.userData.ready = true;
  garden.userData.lollipopBasket = root;
  return root;
}
