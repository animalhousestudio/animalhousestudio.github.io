import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3, PerspectiveCamera } from 'three';
import { GARDEN, POND_RESERVE, PATH_WIDTH, ellipseDistance, lawnDensity, paths, reservedGround, borderDistance } from '../src/rooms/landscapeLayout.mjs';
import { grassSites } from '../src/rooms/grassPlacement.mjs';
import { addRoundStoneLandscape, stonePlacements } from '../src/rooms/roundStoneLandscape.mjs';
import { PITCH_CLEARANCE } from '../src/rooms/rockLayout.mjs';
import { WORLD_SCALE, EYE_HEIGHT } from '../src/rooms/layout.mjs';
import { captureCollisionSource, CollisionWorld } from '../src/player/collisionWorld.mjs';
import { Player } from '../src/player/movement.js';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';

test('the west garden is slightly larger than the house and its pond is central', () => {
  const ratio = Math.PI * GARDEN.rx * GARDEN.rz / (18 * 17.6);
  assert.ok(ratio > 1.1 && ratio < 1.3);
  assert.ok(GARDEN.x + GARDEN.rx < PITCH_CLEARANCE.minX);
  assert.ok(ellipseDistance(POND_RESERVE.x, POND_RESERVE.z, GARDEN) < .15);
});
test('one-person route connects landing, stairs and the garden gate without blocking the field', () => {
  assert.ok(PATH_WIDTH * WORLD_SCALE >= 1.2 && PATH_WIDTH * WORLD_SCALE <= 1.5);
  assert.ok(paths[0].getPointAt(0).distanceTo(new Vector3(0, 0, 43)) < .01);
  assert.ok(paths[0].getPointAt(1).distanceTo(new Vector3(.67, 0, 10.35)) < .01);
  assert.ok(Math.abs(ellipseDistance(paths[1].getPointAt(1).x, paths[1].getPointAt(1).z, GARDEN) - 1) < .002);
  for (const stone of stonePlacements()) {
    assert.ok(!(stone.x > PITCH_CLEARANCE.minX && stone.x < PITCH_CLEARANCE.maxX && stone.z > PITCH_CLEARANCE.minZ && stone.z < PITCH_CLEARANCE.maxZ));
    assert.ok(stone.height * .62 * WORLD_SCALE < .3, 'Stones must remain low walkable treads');
  }
});
test('grass masks create dense lawns and a sparse asteroid, preserving every reserved surface', () => {
  assert.ok(lawnDensity(-23, 6) > lawnDensity(32, 15) * 12);
  const sites = grassSites(6000, (x, z) => !(x > -7.9 && x < 11 && z > -9.8 && z < 8.7));
  assert.equal(sites.length, 6000);
  for (const site of sites) {
    assert.equal(reservedGround(site.x, site.z, .17), false);
    assert.ok(borderDistance(site.x, site.z) >= .27);
  }
  const inner = sites.filter(p => lawnDensity(p.x, p.z) > .7).length;
  const outer = sites.filter(p => lawnDensity(p.x, p.z) < .1).length;
  assert.ok(inner > outer * 5);
});
test('stone instancing shares three small meshes and collision data excludes the pond marker', () => {
  const group = addRoundStoneLandscape(new Group());
  const stones = group.children.filter(n => n.isInstancedMesh);
  assert.equal(stones.length, 3);
  assert.equal(new Set(stones.map(s => s.material)).size, 1);
  assert.ok(stones.reduce((sum, s) => sum + s.count * s.geometry.index.count / 3, 0) < 75000);
  for (const stone of stones) {
    const normals = stone.geometry.attributes.normal;
    assert.ok(normals.getY(normals.count - 2) > .99, 'Flat stone tread must face up');
  }
  const pond = group.getObjectByName('FuturePond_ReservedEarth');
  assert.ok(pond.geometry.attributes.normal.getY(70) > .95);
  const source = captureCollisionSource(group);
  assert.ok(source.length > 3);
  assert.ok(source.every(s => s.name.startsWith('RoundedSteppingStones')));
});
test('the player walks the complete stepping-stone route without snagging or falling', () => {
  const root = new Group(); root.scale.setScalar(WORLD_SCALE);
  addRoundStoneLandscape(root); root.updateMatrixWorld(true);
  const world = new CollisionWorld().addRoot(root).build();
  const player = new Player(new PerspectiveCamera(), null, {
    speed: 11.4, groundHeightAt: (x, z) => terrainHeight(x / WORLD_SCALE, z / WORLD_SCALE) * WORLD_SCALE,
  });
  player.setPosition(new Vector3(0, EYE_HEIGHT + .2, 43 * WORLD_SCALE));
  player.setMoveState({ forward: true });
  const targets = paths[0].getSpacedPoints(160).slice(1);
  for (const target of targets) {
    target.multiplyScalar(WORLD_SCALE);
    let steps = 0;
    while (Math.hypot(target.x - player.camera.position.x, target.z - player.camera.position.z) > .21 && steps++ < 30) {
      player.yaw = Math.atan2(target.x - player.camera.position.x, target.z - player.camera.position.z);
      player.update(1 / 60, world);
    }
    assert.ok(steps < 30, `Stone snags the player near ${target.toArray()}`);
    assert.ok(player.camera.position.y >= EYE_HEIGHT - .01);
  }
});
