import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CAT_CLEARINGS, CAT_SIZE_MULTIPLIER, CAT_VISUAL_RADIUS, createCatColonyLayout, sampleCat } from '../src/rooms/catColonyLayout.mjs';
import { LANDING_Z } from '../src/arrival.mjs';
import { createCatColonyModel } from '../src/rooms/catColonyModel.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';
import { getPondRadius, POND_FOOTPRINTS } from '../src/rooms/pondLayout.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';

const { routes, bounds } = createCatColonyLayout(terrainHeight);
const makePose = () => ({ position: new Vector3() });

test('24 distinct cats patrol nine clearings, with a single cat near the landing', () => {
  assert.equal(routes.length, 24);
  assert.equal(new Set(routes.map(route => route.fur)).size, 24);
  assert.equal(new Set(routes.map(route => route.id)).size, 24);
  assert.equal(CAT_CLEARINGS.length, 9);
  for (const { id, catIds } of CAT_CLEARINGS) {
    assert.deepEqual(routes.filter(route => route.clearing === id).map(route => route.id), catIds.map(catId => `cat-${catId}`));
  }
  assert.deepEqual(routes.filter(route => route.points.some(point =>
    Math.hypot(point.x, point.z - LANDING_Z * WORLD_SCALE) < 44)).map(route => route.id), ['cat-1']);
  for (const route of routes) {
    const period = route.durations.reduce((sum, time) => sum + time, 0);
    const types = new Set();
    let previous = sampleCat(route, 0, makePose()).position;
    for (let time = .04; time <= period; time += .04) {
      const pose = sampleCat(route, time, makePose());
      const { x, z } = pose.position;
      assert.ok(bounds.containsPoint(pose.position));
      assert.ok(POND_FOOTPRINTS.every(pond => getPondRadius(pond, x / WORLD_SCALE, z / WORLD_SCALE, .35 * CAT_SIZE_MULTIPLIER) >= 1));
      assert.ok(previous.distanceTo(pose.position) < route.speed * .052, 'no teleport or jump in the loop');
      previous = pose.position;
      types.add(pose.action);
    }
    assert.deepEqual([...types].sort(), ['groom', 'rest', 'walk']);
    const first = sampleCat(route, 0, makePose());
    const next = sampleCat(route, period, makePose());
    assert.ok(first.position.distanceTo(next.position) < 1e-6);
  }
});

test('the supplied model shares its geometry but animates independent, grounded rigs', async () => {
  const file = new URL('../art/threejs-cat-master/assets/models/toon_cat_free.glb', import.meta.url);
  const glb = await readFile(file);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const asset = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  const model = createCatColonyModel(asset);
  const cat = model.createActor(routes[0]);
  const other = model.createActor(routes.find(route => route.id === 'cat-2'));
  assert.equal(cat.node.scale.y, 1.02 * 1.2);
  assert.equal(other.node.scale.y, 1.14 * 1.2);
  const skin = cat.node.getObjectByProperty('isSkinnedMesh', true);
  const otherSkin = other.node.getObjectByProperty('isSkinnedMesh', true);
  assert.equal(skin.geometry, otherSkin.geometry);
  assert.equal(skin.geometry.index.count / 3, 2636);
  assert.equal(skin.material.map, otherSkin.material.map);
  assert.notEqual(skin.skeleton, otherSkin.skeleton);
  const original = otherSkin.skeleton.bones.map(bone => bone.quaternion.toArray());
  const height = {};
  for (const action of ['walk', 'rest', 'groom']) {
    for (let frame = 0; frame < 12; frame++) {
      const pose = sampleCat(routes[0], frame * .11, makePose(), action);
      cat.evaluate(pose, frame * .11);
      cat.node.updateMatrixWorld(true);
      const box = new Box3().setFromObject(cat.node, true);
      assert.ok(Math.abs(box.min.y) < .065, `${action}: paws near the ground (${box.min.y})`);
      assert.ok(box.max.length() < CAT_VISUAL_RADIUS, `${action}: within the culling sphere`);
      height[action] = box.max.y;
    }
  }
  assert.ok(height.rest < height.walk - .07, 'rest lowers the body');
  assert.deepEqual(otherSkin.skeleton.bones.map(bone => bone.quaternion.toArray()), original);
  cat.dispose();
  other.dispose();
});
