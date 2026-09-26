import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Texture, Vector3, Group, InstancedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createTreeTemplates, selectTreePlacements } from '../src/rooms/treePlacement.mjs';
import { PITCH_CLEARANCE, isRockFootprintClear, naturalRockPlacements } from '../src/rooms/rockLayout.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';
import { CollisionWorld, captureCollisionSource } from '../src/player/collisionWorld.mjs';

async function model(name) {
  const bytes = await readFile(new URL(`../src/assets/models/${name}.glb`, import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}
const templates = createTreeTemplates(await model('trees-natural'));
const placements = selectTreePlacements(templates, PITCH_CLEARANCE);

test('three reusable trees have grounded trunks and intact leaf materials', () => {
  assert.equal(templates.length, 3);
  for (const template of templates) {
    assert.equal(template.parts.length, 2);
    assert.ok(Math.abs(template.parts[0].geometry.boundingBox.min.y) < 1e-6);
    assert.ok(Math.abs(template.bounds.max.y - 1) < 1e-6);
    assert.ok(template.parts[1].material.map, 'Missing leaf texture');
    assert.ok(template.parts[1].material.alphaTest > 0, 'Leaf silhouettes require an alpha mask');
  }
});

test('twelve deterministic tree sites preserve field, paths, assets and the asteroid edge', () => {
  assert.equal(placements.length, 12);
  assert.equal(placements.filter(p => p.zone === 'garden').length, 6);
  assert.deepEqual(placements.map(p => [p.x, p.z, p.height]), selectTreePlacements(templates, PITCH_CLEARANCE).map(p => [p.x, p.z, p.height]));
  assert.equal(new Set(placements.map(p => p.variant)).size, 3);
  for (const p of placements) {
    const b = p.bounds;
    assert.ok(isRockFootprintClear({ minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z }));
    assert.ok(naturalRockPlacements.every(r => Math.hypot(p.x - r.x, p.z - r.z) >= r.size * .7 + 1));
    const root = new Vector3(0, 0, 0).applyMatrix4(p.matrix);
    assert.ok(Math.abs(root.y - terrainHeight(root.x, root.z) + .1) < 1e-8);
  }
});

test('house uses the requested number 5 tree and removes the old primitive tree', async () => {
  const house = await model('mansion-v09');
  assert.equal(house.getObjectByName('M01_Reuse_TREE_Left_Trunk'), undefined);
  assert.equal(house.getObjectByName('M01_Reuse_TREE_Left_Foliage'), undefined);
  const parts = ['Branches', 'Leaves'].map(part => house.getObjectByName(`M09_HouseTree_Number5_${part}`));
  assert.ok(parts.every(Boolean));
  const bounds = parts.reduce((b, o) => b.union(new Box3().setFromObject(o)), new Box3());
  assert.ok(Math.abs(bounds.max.y - bounds.min.y - 18.5) < .002, 'Tree must remain upright and correctly scaled');
  assert.ok(bounds.max.x < -7.5, 'New canopy crosses the house wall');
});

test('instanced trunks block the player while leaf cards do not create invisible barriers', () => {
  const placement = placements.find(p => p.variant === 'Gold');
  const layer = new Group();
  for (const part of placement.template.parts) {
    const instance = new InstancedMesh(part.geometry, part.material, 1);
    instance.name = part.name; instance.setMatrixAt(0, placement.matrix);
    instance.userData.collisionDisabled = part.name === 'Leaves';
    layer.add(instance);
  }
  const source = captureCollisionSource(layer);
  assert.equal(source.length, 1); assert.equal(source[0].name, 'Branches');
  const world = new CollisionWorld().addSource(source).build();
  const start = new Vector3(placement.x - 3, terrainHeight(placement.x, placement.z) + 1.65, placement.z);
  const end = world.move(start, new Vector3(6, 0, 0)).position;
  assert.ok(end.distanceTo(start.clone().add(new Vector3(6, 0, 0))) > .5, 'Imported trunk was crossed');
});
