import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationMixer, Box3, Group, Matrix4, MeshBasicMaterial, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBB } from 'three/addons/math/OBB.js';
import { createCoasterCart } from '../src/rooms/coasterCart.mjs';
import { COASTER_TUNNEL, createCoasterRoute, createCoasterSupports, tunnelPortalBox } from '../src/rooms/coasterLayout.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';
import { createPondLayout, SECOND_POND_FOOTPRINT } from '../src/rooms/pondLayout.mjs';
import { createSharkRoute, SHARK_SCALE } from '../src/rooms/sharkRoute.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';
import { prepareAsteroid } from '../src/rooms/asteroid.mjs';

const loader = new GLTFLoader();
loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
async function load(path) {
  const bytes = await readFile(new URL(path, import.meta.url));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}
const { scene: asteroid } = await load('../src/assets/models/asteroid-v05.glb');
const layouts = [createPondLayout(asteroid, { heightAt: terrainHeight }),
  createPondLayout(asteroid, { heightAt: terrainHeight, footprint: SECOND_POND_FOOTPRINT })];
const route = createSharkRoute(layouts);
const { scene: model, animations } = await load('../src/assets/models/props/squalo.glb');
const mesh = model.getObjectByProperty('isSkinnedMesh', true);
const { position } = mesh.geometry.attributes;
const clip = animations[0];
const mixer = new AnimationMixer(model);
mixer.clipAction(clip).play();

function pose() { return { position: new Vector3() }; }

test('shark route closes smoothly and visits both lakes on every lap', () => {
  const start = route.sample(0, pose());
  const end = route.sample(route.duration, pose());
  const before = route.sample(route.duration - .001, pose());
  assert.ok(start.position.distanceTo(end.position) < 1e-8);
  assert.ok(start.position.distanceTo(before.position) < .004);
  assert.ok(Math.cos(start.yaw - before.yaw) > .999);
  const visits = [];
  const frame = pose();
  let current;
  const step = .02;
  for (let time = 0; time < route.duration; time += step) {
    route.sample(time, frame);
    if (frame.surface && frame.position.y >= frame.water - .94 * SHARK_SCALE) {
      if (!current) {
        const pond = layouts.findIndex(layout => layout.contains(
          frame.position.x / WORLD_SCALE, frame.position.z / WORLD_SCALE));
        current = { pond, start: time, duration: 0, distance: 0 };
        visits.push(current);
      } else {
        current.duration = time - current.start;
        current.distance += frame.position.distanceTo(current.lastPosition);
      }
      current.lastPosition = frame.position.clone();
    } else {
      current = null;
    }
  }
  const sustained = visits.filter(visit => visit.duration >= 10 && visit.distance >= 8);
  assert.deepEqual(sustained.map(visit => visit.pond).sort(), [0, 1],
    JSON.stringify(visits.map(({ pond, duration, distance }) => ({ pond, duration, distance }))));
  console.log({ surfaceSeconds: sustained.map(({ pond, duration }) => [pond, duration]) });
});

test('skinned shark clears both tunnel lanes, basin slopes and the full swept train', () => {
  assert.equal(clip.name, 'Swim');
  assert.ok(Math.abs(clip.duration - 32 / 24) < 1e-5);
  assert.equal(mesh.skeleton.bones.length, 8);
  const t = COASTER_TUNNEL, portal = tunnelPortalBox();
  const coaster = createCoasterRoute();
  const terrain = prepareAsteroid(asteroid, new MeshBasicMaterial(), { pondLayouts: layouts });
  const cart = createCoasterCart();
  const shell = new Box3(), seats = [];
  for (const child of cart.children) {
    if (child.name.includes('Seat')) {
      for (const part of child.children) seats.push(new Box3().setFromObject(part));
    } else shell.expandByObject(child);
  }
  // All four cars traverse these same frames. Include the entire
  // chassis and seat envelopes, plus the route-local rails and sleepers.
  const train = [shell, ...seats].map(box => box.expandByScalar(.08));
  const rails = new Box3(new Vector3(-.84, -.43, -.13), new Vector3(.84, .1, .13));
  const transform = new Matrix4(), unit = new Vector3(1, 1, 1);
  const obstacles = [];
  function obstacle(bounds, matrix) {
    // Construct in world coordinates directly, including the rotated offset
    // of a box whose local origin is not at its center.
    const center = bounds.getCenter(new Vector3()).applyMatrix4(matrix);
    const box = new OBB().fromBox3(bounds).applyMatrix4(matrix);
    box.center.copy(center);
    obstacles.push({ box, aabb: bounds.clone().applyMatrix4(matrix) });
  }
  for (let metres = 0; metres < coaster.length; metres += .15) {
    const { position, up, quaternion } = coaster.frameAt(metres / coaster.length);
    if (Math.abs(position.x - t.x) > 14 || position.z < 3 || position.z > 100 || position.y > 3) continue;
    obstacle(rails, transform.compose(position, quaternion, unit));
    transform.compose(position.addScaledVector(up, .12), quaternion, unit);
    for (const box of train) obstacle(box, transform);
  }
  for (const { position, size, quaternion } of createCoasterSupports(coaster, (x, z) => {
    const height = terrain.heightAt(x / WORLD_SCALE, z / WORLD_SCALE);
    return height === null ? null : height * WORLD_SCALE;
  })) {
    if (Math.abs(position.x - t.x) > 14 || position.z < 3 || position.z > 100) continue;
    const box = new Box3().setFromCenterAndSize(new Vector3(), size).expandByScalar(.08);
    obstacle(box, transform.compose(position, quaternion, unit));
  }
  const actor = new Group();
  model.scale.setScalar(SHARK_SCALE);
  actor.add(model);
  const vertex = new Vector3(), local = new Vector3(), envelope = new Box3();
  const swimSections = Array.from({ length: 7 }, () => new Box3());
  const sectionFor = z => Math.max(0, Math.min(6, Math.floor((z + 2.1) / .5)));
  const index = mesh.geometry.index;
  const groups = Array.from({ length: position.count }, () => new Set());
  for (let i = 0; i < index.count; i += 3) {
    const corners = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const section = sectionFor(corners.reduce((total, k) => total + position.getZ(k), 0) / 3);
    for (const k of corners) groups[k].add(section);
  }
  const phases = Array.from({ length: 64 }, (_, i) => {
    mixer.setTime(i * clip.duration / 64);
    actor.updateMatrixWorld(true);
    const vertices = new Float32Array(position.count * 3);
    for (let k = 0; k < position.count; k++) {
      mesh.getVertexPosition(k, vertex).applyMatrix4(mesh.matrixWorld).toArray(vertices, k * 3);
      for (const section of groups[k]) swimSections[section].expandByPoint(vertex);
    }
    return vertices;
  });
  swimSections.forEach(box => box.expandByScalar(.025));
  const p = pose();
  const candidateObstacles = [];
  let maxShoreRadius = 0, minSurfaceDepth = Infinity, minPhysicalClearance = Infinity;
  let shallowest;
  for (let i = 0; i < 1600; i++) {
    route.sample(i * route.duration / 1600, p);
    actor.position.copy(p.position);
    actor.rotation.set(-p.pitch, p.yaw, 0, 'YXZ');
    actor.updateMatrixWorld(true);
    candidateObstacles.length = 0;
    for (const obstacle of obstacles) {
      if (obstacle.aabb.distanceToPoint(p.position) < 2.5) candidateObstacles.push(obstacle);
    }
    for (const section of swimSections) {
      envelope.copy(section).applyMatrix4(actor.matrixWorld);
      const shark = new OBB().fromBox3(section).applyMatrix4(actor.matrixWorld);
      shark.center.copy(section.getCenter(vertex).applyMatrix4(actor.matrixWorld));
      for (const { box, aabb } of candidateObstacles) {
        if (envelope.intersectsBox(aabb)) assert.ok(!shark.intersectsOBB(box),
          `Train/rail clearance at ${p.position.toArray()} against ${box.center.toArray()}`);
      }
    }
    // Test the deformed silhouette in four swim phases at each route sample.
    for (let phase = 0; phase < 4; phase++) {
      const vertices = phases[(phase * 16 + i) % phases.length];
      let top = -Infinity;
      for (let k = 0; k < position.count; k++) {
        vertex.fromArray(vertices, k * 3).applyMatrix4(actor.matrixWorld);
        top = Math.max(top, vertex.y);
        if (vertex.z >= t.startZ && vertex.z <= t.endZ) {
          const wall = t.halfWidth - .30 - Math.abs(vertex.x - t.x);
          const clearance = Math.min(wall, vertex.y - (t.floor + .15), t.ceiling - .05 - vertex.y);
          minPhysicalClearance = Math.min(minPhysicalClearance, clearance);
          if (clearance <= .035) assert.fail(`Tunnel at ${p.position.toArray()} / ${vertex.toArray()}`);
        }
        if (portal.containsPoint(vertex)) continue;
        local.copy(vertex).divideScalar(WORLD_SCALE);
        const pond = layouts.find(layout => layout.contains(local.x, local.z));
        const floor = pond?.floorAt(local.x, local.z);
        if (floor == null || local.y < floor) assert.fail(`Bank at ${p.position.toArray()} / ${vertex.toArray()}`);
        if (p.position.y > p.water - 1.25) {
          if (vertex.y > p.water - .215) {
            maxShoreRadius = Math.max(maxShoreRadius, pond.normalizedRadius(local.x, local.z));
          }
          // Blender's second-highest part ends at .66 m in the source; all
          // source vertices higher than that are on the main dorsal fin.
          if (position.getY(k) <= .66 + 1e-6 && p.water - vertex.y < minSurfaceDepth) {
            minSurfaceDepth = p.water - vertex.y;
            shallowest = { centre: p.position.toArray(), vertex: vertex.toArray(),
              sourceY: position.getY(k), pitch: p.pitch, water: p.water };
          }
        }
      }
      if (p.surface && p.position.y >= p.water - .94 * SHARK_SCALE) assert.ok(top >= p.water + .04);
    }
  }
  assert.ok(maxShoreRadius < .80, maxShoreRadius);
  assert.ok(Number.isFinite(minSurfaceDepth) && minSurfaceDepth >= .215,
    JSON.stringify({ minSurfaceDepth, shallowest }));
  console.log({ lapSeconds: route.duration, minPhysicalClearance, maxShoreRadius, minSurfaceDepth });
});
