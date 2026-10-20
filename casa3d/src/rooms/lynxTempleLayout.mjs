import { Group } from 'three';
import { BASE_HOUSE_X, BASE_HOUSE_Z, WORLD_SCALE } from './layout.mjs';
import { batchStaticArchitecture } from './optimize.mjs';

// Garden-local coordinates on the flat ground beyond the football field.
// The Blender export is already in metres. Its well extends below the ground:
// preserve the authored origin instead of lifting the model by its minimum Y.
export const LYNX_TEMPLE_PLACEMENT = Object.freeze({ x: 17, y: 0, z: -18 });
export const LYNX_TEMPLE_YAW = Math.atan2(BASE_HOUSE_X - LYNX_TEMPLE_PLACEMENT.x,
  BASE_HOUSE_Z - LYNX_TEMPLE_PLACEMENT.z);
export const LYNX_TEMPLE_FOOTPRINT = Object.freeze({ halfWidth: 5.4, halfDepth: 5.4 });

export function prepareLynxTempleCollision(model) {
  model.name = 'LynxTemple_Physics';
  model.userData.streamingBoundary = true;
  // Keep nodes traversable by collision capture. Invisible materials suppress
  // drawing without removing the permanent walkable floors and closed hatch.
  model.traverse(node => {
    node.visible = true;
    node.userData.collisionDisabled = false;
    if (!node.isMesh) return;
    node.userData.collidable = true;
    node.castShadow = false; node.receiveShadow = false;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      material.visible = false;
    }
  });
  return model;
}

export function prepareLynxTempleVisual(tier) {
  tier.userData.collisionDisabled = true;
  tier.userData.streamingBoundary = true;
  tier.traverse(node => {
    if (!node.isMesh) return;
    node.userData.collisionDisabled = true;
    node.userData.collidable = false;
    node.castShadow = true; node.receiveShadow = true;
  });
  // Batch only the newly loaded tier; its independent physics never enters
  // this branch, and the garden's later pass cannot merge separate tiers.
  batchStaticArchitecture(tier, Infinity);
  return tier;
}

export function createLynxTempleRoot(collisionModel = null, { localBounds = null } = {}) {
  const root = new Group(); root.name = 'LynxTemple';
  root.userData.roomName = 'Tempietto della Lince';
  root.userData.streamingBoundary = true;
  root.userData.visualAsset = 'lynx-temple';
  if (localBounds) root.userData.worldLocalBounds = localBounds.clone();
  root.position.set(LYNX_TEMPLE_PLACEMENT.x, LYNX_TEMPLE_PLACEMENT.y, LYNX_TEMPLE_PLACEMENT.z);
  root.rotation.y = LYNX_TEMPLE_YAW;
  root.scale.setScalar(1 / WORLD_SCALE);
  if (collisionModel) root.add(prepareLynxTempleCollision(collisionModel));
  return root;
}

// Keep the authored platform and its approach free of procedural grass.
export function lynxTempleFootprintContains(x, z, marginMeters = .5) {
  const dx = (x - LYNX_TEMPLE_PLACEMENT.x) * WORLD_SCALE;
  const dz = (z - LYNX_TEMPLE_PLACEMENT.z) * WORLD_SCALE;
  const localX = Math.cos(LYNX_TEMPLE_YAW) * dx - Math.sin(LYNX_TEMPLE_YAW) * dz;
  const localZ = Math.sin(LYNX_TEMPLE_YAW) * dx + Math.cos(LYNX_TEMPLE_YAW) * dz;
  return Math.abs(localX) <= LYNX_TEMPLE_FOOTPRINT.halfWidth + marginMeters
    && Math.abs(localZ) <= LYNX_TEMPLE_FOOTPRINT.halfDepth + marginMeters;
}

// Review positions and targets are local to the metre-sized temple root.
export const LYNX_TEMPLE_REVIEW_POINTS = Object.freeze([
  { name: 'Tempietto · vicino', position: [11, 7, 16], target: [0, 4, 0], hold: true },
  { name: 'Tempietto · media distanza', position: [0, 12, 95], target: [0, 4, 0], hold: true },
  { name: 'Tempietto · lontano', position: [0, 18, 300], target: [0, 4, 0], hold: true },
  { name: 'Tempietto · interno', position: [0, 2.62, 2], target: [0, 3, -2], hold: true },
  { name: 'Tempietto · ingresso', position: [0, 2.02, 6.8], target: [0, 2.62, 0], hold: false },
  { name: 'Tempietto · fuori campo', position: [0, 4, 16], target: [0, 4, 50], hold: true },
].map(point => Object.freeze({ ...point,
  position: Object.freeze(point.position), target: Object.freeze(point.target) })));
