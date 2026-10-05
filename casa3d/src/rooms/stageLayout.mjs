import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { BASE_HOUSE_X, BASE_HOUSE_Z, WORLD_SCALE } from './layout.mjs';

// Garden-local placement; all asset dimensions below are real metres.
// Measured against asteroid.glb, with the front (+Z) aimed toward the house.
export const STAGE_PLACEMENT = Object.freeze({
  x: -40.74084633564005, y: 0, z: 21.261090453849086,
  edgeClearanceMeters: 1,
});
export const STAGE_YAW = Math.atan2(BASE_HOUSE_X - STAGE_PLACEMENT.x,
  BASE_HOUSE_Z - STAGE_PLACEMENT.z);
export const STAGE_STRUCTURE_SCALE = 3;
export const STAGE_DECK = Object.freeze({ width: 24, depth: 12, height: 1.92 });
export const STAGE_STAIRS = Object.freeze({ x: 7.95, count: 11, firstZ: 9.36, run: .32, rise: .16, width: 4.02 });

/** Stable simple physics, separate from visual boards, textures and batching. */
export function createStageCollision() {
  const root = new Group(); root.name = 'GardenStage_Physics';
  const material = new MeshBasicMaterial({ visible: false });
  const add = (name, size, position, scale = STAGE_STRUCTURE_SCALE) => {
    const mesh = new Mesh(new BoxGeometry(...size.map(v => v * scale)), material);
    mesh.name = `StageCollision_${name}`;
    mesh.position.set(...position.map(v => v * scale));
    mesh.userData.collidable = true;
    root.add(mesh);
  };
  add('Deck', [8, .64, 4], [0, .32, 0]);
  for (const side of [-1, 1]) {
    for (let step = 0; step < STAGE_STAIRS.count; step++) {
      const height = STAGE_STAIRS.rise * (step + 1);
      add(`Stair_${side}_${step}`, [STAGE_STAIRS.width, height, STAGE_STAIRS.run],
        [side * STAGE_STAIRS.x, height / 2, STAGE_STAIRS.firstZ - step * STAGE_STAIRS.run], 1);
    }
    for (const z of [-1.72, 1.72]) {
      add(`Post_${side}_${z}`, [.15, 3.88, .15], [side * 3.74, 2.58, z]);
    }
    add(`Sub_${side}`, [.8, .88, .73], [side * 4.58, .44, 1.4]);
    add(`Speaker_${side}`, [.59, .84, .49], [side * 4.58, 1.83, 1.4]);
    add(`Mast_${side}`, [.056, .57, .056], [side * 4.58, 1.145, 1.4]);
    add(`Monitor_${side}`, [.58, .32, .48], [side * 4.8, STAGE_DECK.height + .16, 4.29], 1);
    add(`SideBeam_${side}`, [.13, .13, 3.44], [side * 3.74, 4.48, 0]);
  }
  for (const z of [-1.72, 1.72]) add(`Header_${z}`, [7.62, .15, .15], [0, 4.48, z]);
  add('LightingRail', [7.48, .1, .1], [0, 4.19, 1.72]);
  return root;
}

export function createStageRoot(model) {
  const root = new Group(); root.name = 'GardenStage';
  root.userData.roomName = 'Palco';
  root.userData.streamingBoundary = true;
  root.userData.edgeClearanceMeters = STAGE_PLACEMENT.edgeClearanceMeters;
  root.position.set(STAGE_PLACEMENT.x, STAGE_PLACEMENT.y, STAGE_PLACEMENT.z);
  root.rotation.y = STAGE_YAW;
  root.scale.setScalar(1 / WORLD_SCALE);
  if (model) {
    model.name = 'GardenStage_Visual';
    model.userData.collisionDisabled = true;
    root.add(model);
  }
  root.add(createStageCollision());
  return root;
}

// Keep procedural dressing out of the stage and the foot of its two stairs.
export function stageFootprintContains(x, z, marginMeters = .3) {
  const dx = (x - STAGE_PLACEMENT.x) * WORLD_SCALE;
  const dz = (z - STAGE_PLACEMENT.z) * WORLD_SCALE;
  const localX = Math.cos(STAGE_YAW) * dx - Math.sin(STAGE_YAW) * dz;
  const localZ = Math.sin(STAGE_YAW) * dx + Math.cos(STAGE_YAW) * dz;
  return Math.abs(localX) <= 14.94 + marginMeters
    && localZ >= -6.06 - marginMeters && localZ <= 9.55 + marginMeters;
}
