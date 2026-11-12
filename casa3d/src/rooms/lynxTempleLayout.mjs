import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import { BASE_HOUSE_X, BASE_HOUSE_Z, WORLD_SCALE } from './layout.mjs';
import { batchStaticArchitecture } from './optimize.mjs';

// Garden-local clearing behind the house. All visual tiers and physics share
// the same world scale and the authored origin above the well.
// The Blender export is already in metres. Its well extends below the ground:
// preserve the authored origin instead of lifting the model by its minimum Y.
export const LYNX_TEMPLE_PLACEMENT = Object.freeze({ x: 1, y: 0, z: -20 });
export const LYNX_TEMPLE_SCALE = 5;
export const LYNX_TEMPLE_YAW = Math.atan2(BASE_HOUSE_X - LYNX_TEMPLE_PLACEMENT.x,
  BASE_HOUSE_Z - LYNX_TEMPLE_PLACEMENT.z);
export const LYNX_TEMPLE_FOOTPRINT = Object.freeze({ halfWidth: 5.4, halfDepth: 5.4 });
const approach = { halfWidth: .92, front: 8.4, back: 4.33, height: .64 };

function createTempleApproach() {
  const {halfWidth:w,front,back,height} = approach;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute([
    -w,-.015,front, w,-.015,front, -w,height,4.76, w,height,4.76,
    -w,height,back, w,height,back, -w,0,4.76, w,0,4.76, -w,0,back, w,0,back,
  ],3));
  geometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,0,2,6,1,7,3,
    2,4,6,4,8,6,3,7,5,5,7,9,8,4,5,8,5,9,0,6,1,1,6,7,6,8,7,7,8,9]);
  const ramp = new Mesh(geometry.toNonIndexed(),new MeshStandardMaterial({color:0x887867,roughness:.94}));
  geometry.dispose();
  ramp.geometry.computeVertexNormals();
  ramp.name = 'LynxTemple_StoneApproach';
  ramp.receiveShadow = true;
  ramp.userData.collidable = true;
  return ramp;
}

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
  root.position.set(LYNX_TEMPLE_PLACEMENT.x, LYNX_TEMPLE_PLACEMENT.y, LYNX_TEMPLE_PLACEMENT.z);
  root.rotation.y = LYNX_TEMPLE_YAW;
  root.scale.setScalar(LYNX_TEMPLE_SCALE / WORLD_SCALE);
  const ramp = createTempleApproach();
  root.add(ramp);
  if (localBounds) {
    ramp.geometry.computeBoundingBox();
    root.userData.worldLocalBounds = localBounds.clone().union(ramp.geometry.boundingBox);
  }
  if (collisionModel) root.add(prepareLynxTempleCollision(collisionModel));
  return root;
}

// Distance in world metres to the building or its entrance approach.
export function lynxTempleClearance(x, z) {
  const dx = (x - LYNX_TEMPLE_PLACEMENT.x) * WORLD_SCALE / LYNX_TEMPLE_SCALE;
  const dz = (z - LYNX_TEMPLE_PLACEMENT.z) * WORLD_SCALE / LYNX_TEMPLE_SCALE;
  const localX = Math.cos(LYNX_TEMPLE_YAW) * dx - Math.sin(LYNX_TEMPLE_YAW) * dz;
  const localZ = Math.sin(LYNX_TEMPLE_YAW) * dx + Math.cos(LYNX_TEMPLE_YAW) * dz;
  const platform = Math.hypot(Math.max(0,Math.abs(localX)-LYNX_TEMPLE_FOOTPRINT.halfWidth),
    Math.max(0,Math.abs(localZ)-LYNX_TEMPLE_FOOTPRINT.halfDepth));
  const ramp = Math.hypot(Math.max(0,Math.abs(localX)-approach.halfWidth),
    Math.max(0,approach.back-localZ,localZ-approach.front));
  return Math.min(platform,ramp)*LYNX_TEMPLE_SCALE;
}

export function lynxTempleFootprintContains(x, z, marginMeters = .5) {
  return lynxTempleClearance(x,z)<=marginMeters;
}

// Review positions and targets are local to the metre-sized temple root.
export const LYNX_TEMPLE_REVIEW_POINTS = Object.freeze([
  { name: 'Tempietto · vicino', position: [11, 7, 16], target: [0, 4, 0], hold: true },
  { name: 'Tempietto · media distanza', position: [0, 12, 95], target: [0, 4, 0], hold: true },
  { name: 'Tempietto · lontano', position: [0, 18, 300], target: [0, 4, 0], hold: true },
  { name: 'Tempietto · interno', position: [0, 2.62, 2], target: [0, 3, -2], hold: true },
  { name: 'Tempietto · ingresso', position: [0, .404, 9.2], target: [0, .99, 0], hold: false },
  { name: 'Tempietto · fuori campo', position: [0, 4, 16], target: [0, 4, 50], hold: true },
].map(point => Object.freeze({ ...point,
  position: Object.freeze(point.position), target: Object.freeze(point.target) })));
