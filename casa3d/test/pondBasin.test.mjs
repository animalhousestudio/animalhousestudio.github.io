import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, DoubleSide, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { POND_RESERVE } from '../src/rooms/landscapeLayout.mjs';
import { createPondLayout, getPondOutline, POND_FOOTPRINT } from '../src/rooms/pondLayout.mjs';
import { createPondBasin, createPondBasinGeometry } from '../src/rooms/pondBasin.mjs';
import { cutHouseGround, insideHouse, surfaceBoundary } from '../src/rooms/asteroid.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';
import { WORLD_SCALE, EYE_HEIGHT } from '../src/rooms/layout.mjs';
import { captureCollisionSource, CollisionWorld } from '../src/player/collisionWorld.mjs';
import { Player } from '../src/player/movement.js';

const bytes = await readFile(new URL('../src/assets/models/asteroid.glb', import.meta.url));
const { scene: asteroid } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
asteroid.updateMatrixWorld(true);
const layout = createPondLayout(asteroid, { heightAt: terrainHeight });
const close = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('pond expands the existing reserve by 8% and reaches half the locally measured asteroid thickness', () => {
  close(layout.rx / POND_RESERVE.rx, 1.08);
  close(layout.rz / POND_RESERVE.rz, 1.08);
  assert.equal(layout.x, POND_RESERVE.x); assert.equal(layout.z, POND_RESERVE.z);
  assert.equal(layout.measurement.method, 'local-shell-raycast');
  close(layout.measurement.undersideY, -26.034428883695227, .001);
  close(layout.excavationDepth / layout.measuredThickness, .5);
  assert.ok(layout.depth * WORLD_SCALE > 60 && layout.depth * WORLD_SCALE < 70);
  assert.ok(layout.bottomY > layout.measurement.shallowestUndersideY + 10);
  assert.ok(Object.isFrozen(layout)); assert.equal(layout.explorationEnabled, false);
  for (const [x, z] of getPondOutline(layout)) assert.equal(insideHouse(x, z), false);
});

test('shell measurements use model-local units under translated and scaled parent transforms', () => {
  const parent = new Group(), transformed = asteroid.clone();
  parent.position.set(12, 20, -8); parent.rotation.y = .45; parent.scale.setScalar(WORLD_SCALE);
  parent.add(transformed); parent.updateMatrixWorld(true);
  const measured = createPondLayout(transformed, { heightAt: terrainHeight });
  close(measured.bottomY, layout.bottomY);
  close(measured.measuredThickness, layout.measuredThickness);
  const bounds = new Box3(new Vector3(-40, -20, -40), new Vector3(40, 0, 40));
  assert.equal(createPondLayout(bounds).measurement.method, 'bounds');
  close(createPondLayout(bounds).bottomY, -10);
  assert.throws(() => createPondLayout(new Box3(new Vector3(-1, 0, -1), new Vector3(1, 1, 1))), /too shallow/);
});

test('the carved terrain has a real opening while preserving the asteroid silhouette and house opening', () => {
  const source = asteroid.getObjectByName('Asteroid_Surface');
  const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
  const originalBoundary = surfaceBoundary(geometry);
  const cut = cutHouseGround(geometry, [getPondOutline(layout)]);
  const mesh = new Mesh(cut, new MeshBasicMaterial({ side: DoubleSide }));
  mesh.updateMatrixWorld(true);
  const ray = new Raycaster(), down = new Vector3(0, -1, 0);
  for (let i = 0; i < 48; i++) {
    const angle = i / 48 * Math.PI * 2;
    for (const radius of [0, .5, .98]) {
      ray.set(new Vector3(layout.x + Math.cos(angle) * layout.rx * radius, 1, layout.z + Math.sin(angle) * layout.rz * radius), down);
      assert.equal(ray.intersectObject(mesh).length, 0, 'No terrain disk may remain beneath the water');
    }
    ray.set(new Vector3(layout.x + Math.cos(angle) * layout.rx * 1.04, 1, layout.z + Math.sin(angle) * layout.rz * 1.04), down);
    assert.ok(ray.intersectObject(mesh).length, 'Ground outside the shore must stay intact');
  }
  ray.set(new Vector3(1.65, 1, -.57), down);
  assert.equal(ray.intersectObject(mesh).length, 0, 'House floor opening stays intact');
  const edges = surfaceBoundary(cut);
  const key = ([a, b]) => [a.map(v => v.toFixed(4)).join(','), b.map(v => v.toFixed(4)).join(',')].sort().join('|');
  const resultingEdges = new Set(edges.map(key));
  for (const edge of originalBoundary) assert.ok(resultingEdges.has(key(edge)), 'Outer asteroid seam may not move');
  cut.dispose(); geometry.dispose(); mesh.material.dispose();
});

test('basin has a closed floor and continuous walls, with only the deliberate top opening', () => {
  const geometry = createPondBasinGeometry(layout), edgeCount = new Map();
  const indices = geometry.index;
  for (let i = 0; i < indices.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = indices.getX(i + j), b = indices.getX(i + (j + 1) % 3), key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
  }
  assert.equal([...edgeCount.values()].filter(n => n === 1).length, layout.sides);
  assert.ok([...edgeCount.values()].every(n => n === 1 || n === 2));
  const mesh = new Mesh(geometry, new MeshBasicMaterial()); mesh.updateMatrixWorld(true);
  const ray = new Raycaster(), down = new Vector3(0, -1, 0);
  for (let i = 0; i < 96; i++) {
    const angle = (i + .31) / 96 * Math.PI * 2;
    for (const radius of [0, .2, .55, .75, .9, .99]) {
      const x = layout.x + Math.cos(angle) * layout.rx * radius, z = layout.z + Math.sin(angle) * layout.rz * radius;
      ray.set(new Vector3(x, 1, z), down);
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, `Missing inward-facing bowl at ${x}, ${z}`);
      close(hit.point.y, layout.floorAt(x, z), .00003);
    }
  }
  geometry.dispose(); mesh.material.dispose();
});

test('surface and volume queries describe real depth and reject points outside the water footprint', () => {
  close(layout.floorAt(layout.x, layout.z), layout.bottomY);
  close(layout.sampleDepth(layout.x, layout.z), layout.depth);
  assert.equal(layout.getSurfaceHeight(layout.x, layout.z), layout.waterY);
  assert.equal(layout.containsVolume(layout.x, layout.bottomY + 1, layout.z), true);
  assert.equal(layout.containsVolume(layout.x, layout.bottomY - .01, layout.z), false);
  assert.equal(layout.containsVolume(layout.x, layout.waterY + .01, layout.z), false);
  for (const [x, z] of getPondOutline(layout)) {
    assert.equal(layout.contains(x, z), true); close(layout.floorAt(x, z), layout.shoreY);
  }
  const outsideX = layout.x + layout.rx + .1;
  assert.equal(layout.contains(outsideX, layout.z), false);
  assert.equal(layout.floorAt(outsideX, layout.z), null);
  assert.equal(layout.sampleDepth(outsideX, layout.z), null);
  assert.equal(layout.getSurfaceHeight(outsideX, layout.z), null);
  assert.deepEqual(POND_FOOTPRINT, { x: -24, z: 3, rx: 2.1 * 1.08, rz: 1.55 * 1.08 });
});

test('static basin stays below a thousand triangles and the real stone shore stops walking', () => {
  const root = new Group(); root.scale.setScalar(WORLD_SCALE);
  const basin = createPondBasin(layout); root.add(basin); root.updateMatrixWorld(true);
  assert.equal(basin.children.length, 2); assert.ok(basin.userData.triangleCount < 1000);
  const source = captureCollisionSource(root);
  assert.deepEqual(source.map(record => record.name), ['Pond_StoneShore']);
  const world = new CollisionWorld().addRoot(root).build();
  const player = new Player(new PerspectiveCamera(), null, { speed: 7.6,
    groundHeightAt: (x, z) => layout.contains(x / WORLD_SCALE, z / WORLD_SCALE) ? null : 0 });
  player.setPosition(new Vector3((layout.x + layout.rx + .8) * WORLD_SCALE, EYE_HEIGHT, layout.z * WORLD_SCALE));
  player.yaw = -Math.PI / 2; player.setMoveState({ forward: true });
  for (let i = 0; i < 240; i++) player.update(1 / 60, world);
  assert.ok(player.camera.position.x > (layout.x + layout.rx) * WORLD_SCALE);
  assert.ok(player.camera.position.y >= EYE_HEIGHT - .01);
  // Even the collision mesh has no face spanning the top of the water.
  const ray = new Raycaster(new Vector3(layout.x * WORLD_SCALE, 10, layout.z * WORLD_SCALE), new Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(basin.getObjectByName('Pond_StoneShore')).length, 0);
  basin.userData.dispose();
});
