import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PerspectiveCamera, Vector3, Box3, Ray } from 'three';
import { prepareHouse, FLOOR_LEVELS, EYE_HEIGHT } from '../src/greybox/house.mjs';
import { GreyboxPlayer } from '../src/greybox/player.mjs';

const data = await readFile(new URL('../src/assets/models/house-greybox.glb', import.meta.url));
const { scene } = await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
const house = prepareHouse(scene);
const near = (a, b, tolerance = 0.035) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function walkTo(player, x, z, expectedY, dt = 1 / 60) {
  for (let i = 0; i < 30 / dt; i++) {
    const feet = player.getFeet();
    const dx = x - feet.x, dz = z - feet.z;
    if (Math.hypot(dx, dz) < 0.035) {
      player.setMoveState({ forward: false });
      for (let n = 0; n < 30; n++) player.update(1 / 60);
      if (expectedY != null) near(player.getFeet().y, expectedY, 0.06);
      return;
    }
    player.yaw = Math.atan2(dx, dz);
    player.setMoveState({ forward: true });
    player.update(dt);
  }
  assert.fail(`Could not walk to ${x},${z}; feet=${player.getFeet().toArray()}`);
}
function ascend(player, base, basement = false) {
  walkTo(player, -.4, -3.4, base);
  walkTo(player, -.4, .3, base + (basement ? 2.65 * 8 / 15 : 3.3 * 10 / 19));
  walkTo(player, .9, .3);
  walkTo(player, .9, -3.4, base + (basement ? 2.65 : 3.3));
}
function descend(player, upper, basement = false) {
  walkTo(player, .9, -3.4, upper);
  walkTo(player, .9, .3, upper - (basement ? 2.65 * 7 / 15 : 3.3 * 9 / 19));
  walkTo(player, -.4, .3);
  walkTo(player, -.4, -3.4, upper - (basement ? 2.65 : 3.3));
}

test('gameplay enlargement preserves metre scale and lightweight editable parts', () => {
  assert.equal(house.stats.visualMeshes, 69);
  assert.ok(house.stats.visualTriangles < 10000);
  assert.equal(house.stats.rampCount, 9);
  assert.equal(house.stats.metresPerUnit, 1);
  assert.deepEqual(FLOOR_LEVELS, [-2.45, .2, 3.5, 6.8, 10.1]);
  near(house.visualBounds.max.y, 16.2);
  scene.traverse(o => {
    assert.ok(!o.isCamera && !o.isLight);
    if (o.userData.collision_only) assert.equal(o.visible, false);
    if (o.userData.role === 'stair') {
      near(new Box3().setFromObject(o).getSize(new Vector3()).x, 1.1);
      near(o.userData.going_m, .29);
      assert.ok(o.userData.rise_m >= .17 && o.userData.rise_m <= .18);
    }
  });
});

test('walk outdoors to basement and all floors, independently reach observatory and greenhouse, return outside', () => {
  const p = new GreyboxPlayer(new PerspectiveCamera(), house.octree);
  walkTo(p, -.2, 6.5, .2);
  walkTo(p, -.2, 4.5, .2);
  walkTo(p, -1.7, 4.5, .2);
  walkTo(p, -1.7, -3.4, .2);
  walkTo(p, .9, -3.4, .2);
  descend(p, .2, true);
  walkTo(p, -1.7, -3.4, -2.45);
  walkTo(p, -2.5, 1, -2.45);
  walkTo(p, -1.7, -3.4, -2.45);
  ascend(p, -2.45, true);
  ascend(p, .2);
  ascend(p, 3.5);
  ascend(p, 6.8);
  walkTo(p, 2, -3.4, 10.1);
  walkTo(p, 2, -2.2, 10.1);
  walkTo(p, 2, -3.4, 10.1);
  walkTo(p, .9, -3.4, 10.1);
  descend(p, 10.1);
  walkTo(p, -2.5, -3.4, 6.8);
  walkTo(p, -2.5, -.1, 6.8);
  walkTo(p, -6, -.1, 6.8);
  near(p.camera.position.y - p.getFeet().y, EYE_HEIGHT);
  walkTo(p, -2.5, -.1, 6.8);
  walkTo(p, -2.5, -3.4, 6.8);
  walkTo(p, .9, -3.4, 6.8);
  descend(p, 6.8);
  descend(p, 3.5);
  walkTo(p, -1.7, -3.4, .2);
  walkTo(p, -1.7, 4.5, .2);
  walkTo(p, -.2, 4.5, .2);
  walkTo(p, -.2, 10.5, 0);
});

test('living bay, study, widened passage and private rooms remain reachable', () => {
  const p = new GreyboxPlayer(new PerspectiveCamera(), house.octree);
  p.setFeet(new Vector3(.9, 3.5, -3.4));
  walkTo(p, 3, -3.4, 3.5);
  walkTo(p, 4.5, -3.4, 3.5);
  walkTo(p, 4.5, 2, 3.5);
  walkTo(p, 5.8, 2, 3.5);
  walkTo(p, 3, 2, 3.5);
  walkTo(p, 3, -3.4, 3.5);
  walkTo(p, -2.5, -3.4, 3.5);
  walkTo(p, -2.5, 0, 3.5);
  walkTo(p, -4.5, 0, 3.5);
  walkTo(p, -2.5, 0, 3.5);
  walkTo(p, -2.5, 3.5, 3.5);
  walkTo(p, -2.5, -3.4, 3.5);
  ascend(p, 3.5);
  walkTo(p, -2.5, -3.4, 6.8);
  walkTo(p, -2.5, 3, 6.8);
  walkTo(p, 3.5, 3, 6.8);
});

test('collision blocks exterior walls, retains cellar void and correct ceiling heights', () => {
  const p = new GreyboxPlayer(new PerspectiveCamera(), house.octree);
  p.setFeet(new Vector3(2, .2, 3));
  p.yaw = Math.PI / 2;p.setMoveState({forward:true,run:true});
  for(let i=0;i<60;i++)p.update(.1);
  assert.ok(p.getFeet().x < 5.0);
  const floor=house.octree.rayIntersect(new Ray(new Vector3(-2,-.1,0),new Vector3(0,-1,0)));
  near(floor.position.y,-2.45);
  // Ground reaches the chamfered facade corners without sealing the basement.
  for(const [x,z] of [[-5.9,5.85],[5.3,5.85],[-5.9,-4.8]]) {
    const hit=house.octree.rayIntersect(new Ray(new Vector3(x,.15,z),new Vector3(0,-1,0)));
    near(hit.position.y,0);
  }
  for(const [z,expected] of [[-2.45,2.45],[.2,3.1],[3.5,3.1],[10.1,3.1]]) {
    const hit=house.octree.rayIntersect(new Ray(new Vector3(-2,z+.01,0),new Vector3(0,1,0)));
    near(hit.position.y-z,expected);
  }
});
