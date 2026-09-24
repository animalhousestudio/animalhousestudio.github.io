import * as THREE from 'three';
import { HOUSE_X, HOUSE_Z, WORLD_SCALE as S, BASE_FLOOR_Y, EYE_HEIGHT } from './layout.mjs';

import entryProfile from './entryProfile.json' with { type: 'json' };
export const ENTRY_STEPS = entryProfile;

// Human-height treads replace four giant risers created by the 5× house scale.
export function prepareEntrySteps(exterior, model) {
  let material;
  exterior.traverse(node => {
    if (/^M01_Reuse_EXT_EntryStep_\d/.test(node.name)) { material ??= node.material; node.visible = false; }
  });
  if (!material) throw new Error('Entrance steps missing from mansion asset');
  if (!model) throw new Error('Authored entrance model missing');
  model.name = 'AuthoredEntrySteps';
  model.traverse(node => {
    if (node.isMesh) { node.receiveShadow = true; node.castShadow = true; }
  });
  exterior.add(model);
  return model;
}

// Support matches every tread, crosses the threshold, and overlaps the living
// room collider. The old scripted ascent ended outside the walking slab.
export function entryHeightAt(x, z, feet) {
  const lx = (x - HOUSE_X) / S, lz = (z - HOUSE_Z) / S;
  const { front, back, count, top, minX, maxX } = ENTRY_STEPS;
  if (lx < minX || lx > maxX || lz < 5.15 || lz > front) return null;
  let h = top;
  if (lz > back) h = top * Math.max(1, Math.ceil((front - lz) / (front - back) * count)) / count;
  else if (lz < 6.19) h = THREE.MathUtils.lerp(BASE_FLOOR_Y[1], top, THREE.MathUtils.clamp((lz - 5.9) / .29, 0, 1));
  const worldY = h * S;
  // Do not catch someone walking in the basement below this entrance.
  return feet >= worldY - .55 && feet <= worldY + 1.5 ? worldY : null;
}

export function prepareEntryDoor(exterior) {
  exterior.updateMatrixWorld(true);
  const inverse = exterior.matrixWorld.clone().invert();
  const leaves = [];
  const moving = /^M03_Portal_(WalnutLeaf|RecessedPanel|PanelField|IronStrap|Rivet|KnockerBoss|RingKnocker|Hinge)/;
  exterior.traverse(node => { if (node.isMesh && moving.test(node.name)) leaves.push(node); });
  const pivots = [-1.95, -.01].map((x, i) => {
    const pivot = new THREE.Group(); pivot.name = `EntryDoorPivot_${i ? 'Right' : 'Left'}`;
    pivot.position.set(x, 0, 6.38); exterior.add(pivot); return pivot;
  });
  for (const node of leaves) {
    const local = inverse.clone().multiply(node.matrixWorld);
    node.geometry.computeBoundingBox();
    const center = node.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(local);
    const side = center.x < -.98 ? 0 : 1, pivot = pivots[side];
    // Undo the ±100° rotation baked by art/mansion-v04/export_game.py.
    const relative = new THREE.Matrix4().makeRotationY((side ? 1 : -1) * THREE.MathUtils.degToRad(100))
      .multiply(new THREE.Matrix4().makeTranslation(-pivot.position.x, 0, -pivot.position.z)).multiply(local);
    node.removeFromParent(); pivot.add(node);
    relative.decompose(node.position, node.quaternion, node.scale); node.updateMatrix();
  }
  let open = false;
  const center = new THREE.Vector3(-.98, BASE_FLOOR_Y[1], 6.38), worldCenter = new THREE.Vector3();
  return {
    pivots,
    update(position, dt) {
      worldCenter.copy(center); exterior.localToWorld(worldCenter);
      const distance = Math.hypot(position.x - worldCenter.x, position.z - worldCenter.z);
      const onEntryLevel = Math.abs(position.y - EYE_HEIGHT - worldCenter.y) < 5;
      if (distance < 9 && onEntryLevel) open = true;
      else if (distance > 13 || !onEntryLevel) open = false;
      // Open inward into the doorway recess, as in the authored pose.
      pivots.forEach((pivot, i) => {
        const target = open ? (i ? -1 : 1) * THREE.MathUtils.degToRad(100) : 0;
        pivot.rotation.y = THREE.MathUtils.damp(pivot.rotation.y, target, 5, dt);
      });
    },
    blocked(from, to, radius) {
      if (Math.abs(pivots[0].rotation.y) > 1.15) return false;
      const z = HOUSE_Z + 6.38 * S;
      const near = Math.abs(to.z - z) < radius + .65 || (from.z - z) * (to.z - z) < 0;
      return near && to.x > HOUSE_X - 1.95 * S - radius && to.x < HOUSE_X - .01 * S + radius
        && to.y > BASE_FLOOR_Y[1] * S && to.y < 7.54 * S;
    },
  };
}
