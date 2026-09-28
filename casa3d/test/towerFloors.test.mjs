import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { refineTowerFloors, TOWER_OPENING_RADIUS, TOWER_POLE_RADIUS } from '../src/rooms/towerFloors.mjs';
import { CollisionWorld } from '../src/player/collisionWorld.mjs';
import { WORLD_SCALE, BASE_HOUSE_X, BASE_HOUSE_Z, EYE_HEIGHT } from '../src/rooms/layout.mjs';

async function fixture() {
  const bytes = await readFile(new URL('../src/assets/models/mansion-v10.glb', import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.updateMatrixWorld(true);
  return scene;
}

function vertexBounds(mesh) {
  const box = new Box3(), point = new Vector3(), position = mesh.geometry.attributes.position;
  for (let i = 0; i < position.count; i++) box.expandByPoint(point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
  return box;
}

const scene = await fixture(), original = new Map();
scene.traverse(node => { if (node.isMesh) original.set(node.name, { geometry: node.geometry, material: node.material, bounds: vertexBounds(node) }); });
const result = refineTowerFloors(scene);

test('both towers retain their authored slab footprints, thicknesses and floor levels', () => {
  assert.equal(result.openedFloors, 4); assert.equal(result.repairedBases, 2); assert.equal(result.poles, 2);
  for (const tower of result.towers) for (const name of tower.floors) {
    const node = scene.getObjectByName(name), before = original.get(name), after = vertexBounds(node);
    assert.ok(before.bounds.min.distanceTo(after.min) < 1e-5, name);
    assert.ok(before.bounds.max.distanceTo(after.max) < 1e-5, name);
    assert.equal(node.material, before.material, 'Parquet will be applied only to the walking faces later');
  }
  for (const tower of result.towers) assert.equal(scene.getObjectByName(tower.floors[0]).geometry, original.get(tower.floors[0]).geometry);
  assert.equal(refineTowerFloors(scene), result, 'Refinement must be idempotent');
});

test('upper slabs have clear aligned openings, solid surrounding floors and complete hole walls', () => {
  for (const tower of result.towers) for (let i = 1; i < 3; i++) {
    const mesh = scene.getObjectByName(tower.floors[i]), [x, z] = tower.center, y = tower.levels[i];
    for (const angle of [0, .37, 1.8, 4.7]) {
      const at = radius => new Vector3(x + Math.cos(angle) * radius, y + .2, z + Math.sin(angle) * radius);
      assert.equal(new Raycaster(at(TOWER_OPENING_RADIUS * .75), new Vector3(0, -1, 0), 0, .5).intersectObject(mesh).length, 0);
      assert.ok(new Raycaster(at(TOWER_OPENING_RADIUS * 1.1), new Vector3(0, -1, 0), 0, .5).intersectObject(mesh).length > 0);
    }
    const bounds = vertexBounds(mesh), middle = (bounds.min.y + bounds.max.y) / 2;
    assert.ok(new Raycaster(new Vector3(x, middle, z), new Vector3(1, 0, 0), 0, .2).intersectObject(mesh).length > 0, 'The hole has a solid vertical inner wall');
  }
});

test('the repaired base has a single walking surface and retains its external taper and bottom', () => {
  for (const tower of result.towers) {
    const prefix = tower.side === 'West' ? 'M04_WestTurret_' : '';
    const base = scene.getObjectByName(`${prefix}M03_Tower_ClosedBase`), floor = scene.getObjectByName(tower.floors[0]);
    const [x, z] = tower.center, y = tower.levels[0], before = original.get(base.name).bounds, after = vertexBounds(base);
    assert.ok(Math.abs(before.min.y - after.min.y) < 1e-5);
    for (const axis of ['x', 'z']) {
      assert.ok(Math.abs(before.min[axis] - after.min[axis]) < 1e-5);
      assert.ok(Math.abs(before.max[axis] - after.max[axis]) < 1e-5);
    }
    assert.ok(Math.abs(after.max.y - y) < 1e-5);
    const ray = new Raycaster(new Vector3(x + .21, y + .25, z + .07), new Vector3(0, -1, 0), 0, .3);
    assert.equal(ray.intersectObject(base).length, 0, 'The old solid base cap must no longer cover the interior');
    assert.equal(ray.intersectObject(floor).length, 1, 'The original bottom slab is still closed');
  }
});

test('the human capsule passes through both upper holes beside the collidable pole', () => {
  const scaled = scene.clone(true);
  scaled.position.set(BASE_HOUSE_X * WORLD_SCALE, 0, BASE_HOUSE_Z * WORLD_SCALE);
  scaled.scale.setScalar(WORLD_SCALE); scaled.updateMatrixWorld(true);
  const world = new CollisionWorld().addRoot(scaled, { filter: node => /Tower_Floor|Tower_ClosedBase|Tower_FirePole/.test(node.name) }).build();
  for (const tower of result.towers) {
    const x = (tower.center[0] + BASE_HOUSE_X) * WORLD_SCALE, z = (tower.center[1] + BASE_HOUSE_Z) * WORLD_SCALE;
    for (const yModel of tower.levels.slice(1)) for (const angle of [0, .73, 2.3, 4.4]) {
      const y = yModel * WORLD_SCALE;
      const start = new Vector3(x + Math.cos(angle) * .41, y + EYE_HEIGHT + .4, z + Math.sin(angle) * .41);
      const displacement = new Vector3(0, -4, 0), end = start.clone().add(displacement);
      const moved = world.move(start, displacement);
      assert.ok(moved.position.distanceTo(end) < 1e-4, `${tower.side} floor ${yModel}: capsule blocked by ring or pole`);
    }
    const y = tower.levels[1] * WORLD_SCALE + 3;
    const across = world.move(new Vector3(x + .5, y, z), new Vector3(-1, 0, 0));
    assert.ok(across.position.x > x + .3, 'The pole remains a physical collider');
    const grounded = world.move(new Vector3(x + .41, tower.levels[0] * WORLD_SCALE + EYE_HEIGHT + .2, z), new Vector3(0, -.4, 0));
    assert.equal(grounded.grounded, true, 'The bottom landing safely stops a descent');
  }
});

test('both poles use the same human scale and meet their roof mounting collars', () => {
  assert.equal(TOWER_OPENING_RADIUS * WORLD_SCALE * 2, 1.6);
  assert.equal(TOWER_POLE_RADIUS * WORLD_SCALE * 2, .07);
  for (const tower of result.towers) {
    const pole = scene.getObjectByName(tower.pole), bounds = vertexBounds(pole);
    assert.ok(Math.abs(bounds.min.y - tower.levels[0]) < 1e-5);
    assert.ok(Math.abs(bounds.max.y - tower.poleTop) < 1e-5);
    assert.ok(Math.abs((bounds.max.x - bounds.min.x) * WORLD_SCALE - .07) < 1e-5);
    assert.equal(pole.userData.collisionDisabled, undefined);
    const mount = scene.getObjectByName(`${tower.pole}_RoofMount`);
    assert.ok(Math.abs(vertexBounds(mount).max.y - tower.poleTop) < 1e-5);
  }
});
