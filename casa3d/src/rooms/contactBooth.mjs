import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STATIC_ASSETS } from '../world/assetCatalog.mjs';
import { createContactBoothRoot } from './contactBoothLayout.mjs';
import { batchStaticArchitecture } from './optimize.mjs';
import {prepareBoothGlass,addBoothControls} from './contactBoothControls.mjs';
import {prepareContactBoothDoor} from './contactBoothDoor.mjs';

export async function addContactBooth(garden) {
  const { scene } = await new GLTFLoader().loadAsync(STATIC_ASSETS['contact-booth'].url);
  const root = createContactBoothRoot(scene);
  prepareBoothGlass(scene);
  root.userData.door=prepareContactBoothDoor(scene);
  batchStaticArchitecture(scene,Infinity);
  root.userData.controls=addBoothControls(root);
  root.userData.ready = true;
  garden.add(root); garden.userData.contactBooth = root;
  return root;
}
