import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MeshStandardMaterial, PerspectiveCamera, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CollisionWorld } from '../src/player/collisionWorld.mjs';
import { Player } from '../src/player/movement.js';
import { WALKING_DEFAULTS } from '../src/player/walkingDefaults.mjs';
import { prepareAsteroid } from '../src/rooms/asteroid.mjs';
import { paths } from '../src/rooms/landscapeLayout.mjs';
import { EYE_HEIGHT, WORLD_SCALE } from '../src/rooms/layout.mjs';
import { getPondOutline, POND_FOOTPRINTS } from '../src/rooms/pondLayout.mjs';
import { LYNX_TEMPLE_PLACEMENT } from '../src/rooms/lynxTempleLayout.mjs';
import { craters, originalTerrainHeight, terrainHeight, terrainSculptOffset } from '../src/rooms/terrainDetail.mjs';

test('the new asteroid relief has real bowls and ridges without steep transitions', () => {
  let lowest = 0, highest = 0, maxGrade = 0, maxAddedGrade = 0;
  const gradeAt = (heightAt, x, z) => Math.hypot(
    heightAt(x + .125, z) - heightAt(x - .125, z),
    heightAt(x, z + .125) - heightAt(x, z - .125),
  ) / .25;
  for (let z = -37; z <= 39; z += .125) {
    for (let x = -37; x <= 37; x += .125) {
      const offset = terrainSculptOffset(x, z);
      assert.ok(Math.abs(terrainHeight(x, z) - originalTerrainHeight(x, z) - offset) < 1e-12);
      lowest = Math.min(lowest, offset);
      highest = Math.max(highest, offset);
      if (offset === 0) continue;
      maxGrade = Math.max(maxGrade, gradeAt(terrainHeight, x, z));
      maxAddedGrade = Math.max(maxAddedGrade, gradeAt(terrainSculptOffset, x, z));
    }
  }
  assert.ok(lowest * WORLD_SCALE <= -.65 && lowest * WORLD_SCALE >= -.9, lowest);
  assert.ok(highest * WORLD_SCALE >= .6 && highest * WORLD_SCALE <= .85, highest);
  assert.ok(maxGrade < .4, maxGrade);
  assert.ok(maxAddedGrade < .18, maxAddedGrade);
});

test('the sculpt keeps the stepping stones, pond seams and temple platform at their original heights', () => {
  for (const path of paths) {
    for (const { x, z } of path.getSpacedPoints(250)) {
      for (const side of [-.3, 0, .3]) assert.equal(terrainSculptOffset(x + side, z), 0);
    }
  }
  for (const pond of POND_FOOTPRINTS) {
    for (const [x, z] of [[pond.x, pond.z], ...getPondOutline(pond)]) {
      assert.equal(terrainSculptOffset(x, z), 0);
    }
  }
  const { x, z } = LYNX_TEMPLE_PLACEMENT;
  assert.equal(terrainSculptOffset(x, z), 0);
  for (const crater of craters) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
      for (const radius of [0, .8, 1.1, 1.3]) {
        assert.equal(terrainSculptOffset(crater.x + Math.cos(angle) * radius * crater.radius,
          crater.z + Math.sin(angle) * radius * crater.radius), 0);
      }
    }
  }
});

test('normal walking follows a new bowl and ridge in both directions', () => {
  const seconds = 6;
  const world = new CollisionWorld().build();
  const groundHeightAt = (x, z) => terrainHeight(x / WORLD_SCALE, z / WORLD_SCALE) * WORLD_SCALE;
  for (const direction of [-1, 1]) {
    const startZ = (31 - direction * 5) * WORLD_SCALE;
    const x = -7.8 * WORLD_SCALE;
    const player = new Player(new PerspectiveCamera(), null, { ...WALKING_DEFAULTS, groundHeightAt });
    player.setPosition(new Vector3(x, groundHeightAt(x, startZ) + EYE_HEIGHT, startZ));
    player.yaw = direction > 0 ? 0 : Math.PI;
    player.setMoveState({ forward: true });
    let low = Infinity, high = -Infinity;
    for (let i = 0; i < seconds * 60; i++) {
      player.update(1 / 60, world);
      const { y, z } = player.camera.position;
      assert.ok(player.grounded);
      assert.ok(Math.abs(y - EYE_HEIGHT - groundHeightAt(x, z)) < 1e-6);
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
    assert.ok(high - low > .7);
    assert.ok(Math.abs(player.camera.position.z - startZ - direction * WALKING_DEFAULTS.speed * seconds) < 1e-6);
  }
});

test('the game mesh and walking profile agree over the sculpted clearings', async () => {
  const bytes = await readFile(new URL('../src/assets/models/asteroid-v05.glb', import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const { model, surface, boundary, heightAt } = prepareAsteroid(gltf.scene, new MeshStandardMaterial());
  for (const [a, b] of boundary) {
    for (const t of [0, .25, .5, .75, 1]) {
      assert.equal(terrainSculptOffset(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])), 0);
    }
  }
  model.scale.setScalar(WORLD_SCALE);
  model.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  for (const [startX, startZ, dx, dz] of [[-39, 138, 0, 1], [170, -6, -1, 0]]) {
    for (let i = 0; i <= 40; i++) {
      const x = startX + i * dx, z = startZ + i * dz;
      ray.ray.origin.set(x, 15, z);
      const visibleHeight = ray.intersectObject(surface, false)[0]?.point.y;
      const ground = heightAt(x / WORLD_SCALE, z / WORLD_SCALE);
      assert.ok(visibleHeight !== undefined && ground !== null, `Missing terrain at ${x},${z}`);
      assert.ok(Math.abs(visibleHeight - ground * WORLD_SCALE) < .18, `Ground mismatch at ${x},${z}`);
    }
  }
});
