import * as THREE from 'three';
import { addAnimatedChocolateDrops, animateChocolateMaterial, chocolateDeviceLevel, createChocolateController } from './chocolateAnimation.mjs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANDING_Z } from '../arrival.mjs';
import { WORLD_SCALE } from './layout.mjs';
import { terrainHeight } from './terrainDetail.mjs';
import fountainUrl from '../assets/models/props/triton-chocolate-fountain.glb?url';

// Opposite the beehive, farther down the approach on the right-hand side.
export const CHOCOLATE_FOUNTAIN_PLACEMENT = Object.freeze({
  x: 9 / WORLD_SCALE,
  z: LANDING_Z - 27.5 / WORLD_SCALE,
  height: 6.3 / WORLD_SCALE,
  yaw: Math.atan2(-9, 27.5) - Math.PI / 12,
});

export async function addChocolateFountain(garden) {
  const { scene: model } = await new GLTFLoader().loadAsync(fountainUrl);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = CHOCOLATE_FOUNTAIN_PLACEMENT.height / size.y;
  model.name = 'ChocolateFountain_AuthoredModel';
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  model.userData.collisionDisabled = true;
  const preparedMaterials = new Set();
  model.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.userData.collisionDisabled = true;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (preparedMaterials.has(material)) continue;
      preparedMaterials.add(material);
      if (/Travertino/.test(material.name)) material.color.setHex(0xd9c9a6);
      else if (/Pietra dei rilievi/.test(material.name)) material.color.setHex(0xb39b74);
      else if (/Cioccolato fondente/.test(material.name)) material.color.setHex(0x582410);
      else if (/Riflessi cioccolata/.test(material.name)) material.color.setHex(0xa45b30);
    }
  });
  const flow = animateChocolateMaterial(model);
  const particles = addAnimatedChocolateDrops(model);

  const root = new THREE.Group();
  root.name = 'ChocolateTritonFountain';
  root.position.set(CHOCOLATE_FOUNTAIN_PLACEMENT.x,
    terrainHeight(CHOCOLATE_FOUNTAIN_PLACEMENT.x, CHOCOLATE_FOUNTAIN_PLACEMENT.z),
    CHOCOLATE_FOUNTAIN_PLACEMENT.z);
  root.rotation.y = CHOCOLATE_FOUNTAIN_PLACEMENT.yaw;
  root.add(model);

  // A small hidden basin hull lets the player walk around the sculpture.
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.35 * scale, 3.35 * scale, .79 * scale, 24),
    new THREE.MeshBasicMaterial({ visible: false }));
  basin.name = 'ChocolateFountain_BasinCollision';
  basin.position.y = .395 * scale;
  basin.userData.collidable = true;
  root.add(basin);
  model.updateMatrix();
  const localBounds = bounds.clone().applyMatrix4(model.matrix).getBoundingSphere(new THREE.Sphere());
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animation = createChocolateController({
    root, localBounds, deviceLevel: chocolateDeviceLevel(navigator),
    setLevel(level) { flow.setActive(level > 0); particles.setLevel(level); },
    update(seconds, detail) { flow.update(seconds); particles.update(seconds, detail); },
  });
  garden.add(root);
  garden.userData.chocolateFountain = root;
  root.userData.animation = animation.state;
  const animationOptions = { enabled: false, reducedMotion: false };
  garden.userData.animateChocolate = (seconds, camera, viewportHeight, enabled) => {
    animationOptions.enabled = enabled && !document.hidden;
    animationOptions.reducedMotion = motionPreference.matches;
    animation.tick(seconds, camera, viewportHeight, animationOptions);
  };
  return root;
}
