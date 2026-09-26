import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareAccess } from '../src/rooms/access.mjs';
import { HOUSE_X, HOUSE_Z, WORLD_SCALE } from '../src/rooms/layout.mjs';
import { naturalRockPlacements, isRockFootprintClear, intersectsFootprint, PITCH_PLACEMENT } from '../src/rooms/rockLayout.mjs';
import { createRockTemplate, naturalRockTransform } from '../src/rooms/rockPlacement.mjs';

async function model(name) {
  const bytes = await readFile(new URL(`../src/assets/models/${name}.glb`, import.meta.url));
  const loader = new GLTFLoader();
  // Geometry checks need no browser image decoder; preserve all material slots.
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
const { scene: house } = await model('mansion-v09');
const { scene: rocks } = await model('rocks-natural');
const { scene: pitch } = await model('soccer-pitch');

test('v09 exports the floors, window repairs and editable repeated geometry', () => {
  for (const name of ['M01_Reuse_INT_Slab_Living', 'M01_Reuse_INT_Slab_Kitchen',
    'M01_UpperFloor_Slab', 'M01_UpperFloor_Ceiling', 'M06_Observatory_InteriorFloor',
    'M06_Veranda_Threshold', 'M06_Aviary_Threshold', 'M05_Elevator_Controller']) {
    assert.ok(house.getObjectByName(name), `Missing ${name}`);
  }
  let triangles = 0, meshes = 0;
  const geometries = new Set();
  house.traverse(node => {
    assert.ok(!/M06_Original_|Clearance_Cutter|Preview_Ground/.test(node.name), `Service object exported: ${node.name}`);
    if (!node.isMesh) return;
    meshes++; geometries.add(node.geometry);
    const p = node.geometry.getAttribute('position');
    assert.ok(Array.from(p.array).every(Number.isFinite), `Invalid coordinates: ${node.name}`);
    triangles += (node.geometry.index?.count ?? p.count) / 3;
  });
  assert.ok(triangles < 380000, `Unexpected triangle count: ${triangles}`);
  assert.ok(geometries.size < meshes * .65, 'Repeated parts no longer share geometry');
});

test('authored thresholds retain invisible walking support at the corrected levels', () => {
  const nav = prepareAccess(house, { authoredThresholds: true });
  assert.equal(house.getObjectByName('AccessThresholds').visible, false);
  for (const [x, z, height] of [[-8.65, 1.2, 1.487], [-8.4, 1.2, 1.505], [-9.7, 1.2, .98203], [-8.1, .3, 9.912], [8.15, .1, 9.8535]]) {
    const actual = nav.heightAt(HOUSE_X + x * WORLD_SCALE, HOUSE_Z + z * WORLD_SCALE, height * WORLD_SCALE);
    assert.ok(actual !== null && Math.abs(actual / WORLD_SCALE - height) < .025, `Unsupported threshold at ${x}, ${z}: ${actual}`);
  }
});

test('natural rock footprints avoid the actual rotated field, goals and approach', () => {
  pitch.position.set(PITCH_PLACEMENT.x, PITCH_PLACEMENT.y, PITCH_PLACEMENT.z);
  pitch.rotation.y = PITCH_PLACEMENT.yaw;
  const bounds = new Box3().setFromObject(pitch);
  const clear = { minX: bounds.min.x - .75, maxX: bounds.max.x + .75, minZ: bounds.min.z - .75, maxZ: bounds.max.z + .75 };
  rocks.updateMatrixWorld(true);
  const templates = [];
  rocks.traverse(node => {
    if (!node.isMesh) return;
    templates.push(createRockTemplate(node));
  });
  templates.sort((a, b) => a.name.localeCompare(b.name));
  assert.equal(templates.length, 2);
  let accepted = 0;
  naturalRockPlacements.forEach((p, i) => {
    const variant = p.size < 1.2 ? 1 : i % 2;
    const { bounds: box } = naturalRockTransform(templates[variant], p);
    const footprint = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
    if (!isRockFootprintClear(footprint, clear)) return;
    accepted++;
    assert.equal(intersectsFootprint(footprint, clear), false);
  });
  assert.ok(accepted > 30, `Unexpectedly empty landscape: ${accepted}`);
  // A center beyond the sideline still fails when a large stone reaches the turf.
  assert.equal(isRockFootprintClear({ minX: 20.8, maxX: 24.8, minZ: 2, maxZ: 6 }, clear), false);
  assert.equal(isRockFootprintClear({ minX: -1, maxX: 1, minZ: 12, maxZ: 14 }, clear), false);
});
