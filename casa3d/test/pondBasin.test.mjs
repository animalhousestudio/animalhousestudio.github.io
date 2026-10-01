import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { POND_RESERVE } from '../src/rooms/landscapeLayout.mjs';
import { createPondLayout, getPondOutline, POND_FOOTPRINT } from '../src/rooms/pondLayout.mjs';
import { createPondBasin, createPondBasinGeometry } from '../src/rooms/pondBasin.mjs';
import { cutHouseGround, insideHouse, surfaceBoundary } from '../src/rooms/asteroid.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';
import { captureCollisionSource } from '../src/player/collisionWorld.mjs';

const bytes = await readFile(new URL('../src/assets/models/asteroid.glb', import.meta.url));
const { scene: asteroid } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
asteroid.updateMatrixWorld(true);
const layout = createPondLayout(asteroid, { heightAt: terrainHeight });
const close = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('organic pond doubles the former area and reaches half the locally measured asteroid thickness', () => {
  close(layout.rx / POND_RESERVE.rx, 1.08 * Math.SQRT2);
  close(layout.rz / POND_RESERVE.rz, 1.08 * Math.SQRT2);
  const outline = getPondOutline(layout);
  const area = Math.abs(outline.reduce((sum, [x, z], i) => {
    const [nx, nz] = outline[(i + 1) % outline.length];
    return sum + x * nz - nx * z;
  }, 0) / 2);
  close(area, 2 * Math.PI * (POND_RESERVE.rx * 1.08) * (POND_RESERVE.rz * 1.08));
  const radii = outline.map(([x, z]) => Math.hypot((x - layout.x) / layout.rx, (z - layout.z) / layout.rz));
  assert.ok(Math.max(...radii) - Math.min(...radii) > .25, 'Natural coves must visibly depart from an ellipse');
  assert.equal(layout.x, POND_RESERVE.x); assert.equal(layout.z, POND_RESERVE.z);
  assert.equal(layout.measurement.method, 'local-shell-raycast');
  close(layout.measurement.undersideY, -26.034428883695227, .001);
  close(layout.excavationDepth / layout.measuredThickness, .5);
  assert.ok(layout.depth * WORLD_SCALE > 60 && layout.depth * WORLD_SCALE < 70);
  assert.ok(layout.bottomY > layout.measurement.shallowestUndersideY + 10);
  assert.ok(Object.isFrozen(layout)); assert.equal(layout.explorationEnabled, true);
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
      const [x, z] = layout.pointAtAngle(angle, radius);
      ray.set(new Vector3(x, 1, z), down);
      assert.equal(ray.intersectObject(mesh).length, 0, 'No terrain disk may remain beneath the water');
    }
    const [x, z] = layout.pointAtAngle(angle, 1.04);
    ray.set(new Vector3(x, 1, z), down);
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
    for (const radius of [0, .2, .55, .75, .9, .955, .99]) {
      const [x, z] = layout.pointAtAngle(angle, radius);
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
    assert.equal(layout.contains(x, z), true); close(layout.floorAt(x, z), terrainHeight(x, z));
  }
  const [outsideX, outsideZ] = layout.pointAtAngle(0, 1.1);
  assert.equal(layout.contains(outsideX, outsideZ), false);
  assert.equal(layout.floorAt(outsideX, outsideZ), null);
  assert.equal(layout.sampleDepth(outsideX, outsideZ), null);
  assert.equal(layout.getSurfaceHeight(outsideX, outsideZ), null);
  assert.deepEqual(POND_FOOTPRINT, { x: -24, z: 3, rx: 2.1 * 1.08 * Math.SQRT2, rz: 1.55 * 1.08 * Math.SQRT2 });
});

test('natural bank and deep basin share one cheap mesh with no obstacle blocking water entry', () => {
  const root = new Group(); root.scale.setScalar(WORLD_SCALE);
  const basin = createPondBasin(layout); root.add(basin); root.updateMatrixWorld(true);
  assert.equal(basin.children.length, 1); assert.ok(basin.userData.triangleCount < 700);
  const source = captureCollisionSource(root);
  assert.deepEqual(source, []);
  assert.equal(basin.getObjectByName('Pond_StoneShore'), undefined);
  // The dry bank has no raised lip, and its outer vertices meet the ground.
  for (let i = 0; i < 48; i++) {
    const angle = i / 48 * Math.PI * 2;
    const [outerX, outerZ] = layout.pointAtAngle(angle);
    const [innerX, innerZ] = layout.pointAtAngle(angle, .86);
    close(layout.floorAt(outerX, outerZ), terrainHeight(outerX, outerZ));
    const rise = layout.floorAt(outerX, outerZ) - layout.floorAt(innerX, innerZ);
    assert.ok(rise >= 0 && rise / Math.hypot(outerX - innerX, outerZ - innerZ) < .5, 'Bank must be walkable back out of the water');
  }
  basin.userData.dispose();
});
