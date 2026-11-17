import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AnimationMixer, Box3, Euler, Group, Matrix4, MeshBasicMaterial, Quaternion, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBB } from 'three/addons/math/OBB.js';
import { createFishSchoolModel } from '../src/rooms/fishSchoolModel.mjs';
import { FISH_LANE, createFishSchoolRoute, fishSchoolPose } from '../src/rooms/fishSchoolRoute.mjs';
import { FISH_BODY_ANGLES, FISH_FORMATION, FISH_TAIL_SWING, FISH_SCHOOL_RADIUS, createFishMotionSampler } from '../src/rooms/fishSchoolMotion.mjs';
import { COASTER_TUNNEL, createCoasterRoute, createCoasterSupports, tunnelPortalBox } from '../src/rooms/coasterLayout.mjs';
import { createCoasterCart } from '../src/rooms/coasterCart.mjs';
import { createSharkRoute, SHARK_SCALE } from '../src/rooms/sharkRoute.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';
import { createPondLayout, SECOND_POND_FOOTPRINT } from '../src/rooms/pondLayout.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';
import { prepareAsteroid } from '../src/rooms/asteroid.mjs';

const loader = new GLTFLoader();
loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
const read = path => readFile(new URL(path, import.meta.url));
const parse = bytes => loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const { scene: asteroid } = await parse(await read('../src/assets/models/asteroid-v05.glb'));
const layouts = [createPondLayout(asteroid, { heightAt: terrainHeight }),
  createPondLayout(asteroid, { heightAt: terrainHeight, footprint: SECOND_POND_FOOTPRINT })];
const route = createFishSchoolRoute(layouts, FISH_SCHOOL_RADIUS);
const unit = new Vector3(1, 1, 1);
const t = COASTER_TUNNEL;
const portal = tunnelPortalBox();
const vertex = new Vector3();

const bytes = await read('../src/assets/models/props/banco-acquario.glb');
const manifest = JSON.parse(await read('../art/banco-acquario-v01/runtime-export.json'));
const { scene } = await parse(bytes);
const school = createFishSchoolModel(scene, route);
const { mesh } = school;
const section = mesh.geometry.attributes.skinIndex;
const measured = FISH_FORMATION.map(() => new Box3());
const local = FISH_FORMATION.map(() => new Box3());
const motion = createFishMotionSampler(route);
const rootPosition = new Vector3(), rootRotation = new Quaternion();
const scatter = new Vector3(), stroke = new Vector3();

// Fit every variant, tail swing and body pose, including an interpolation margin.
const [pitch, yaw, roll] = FISH_BODY_ANGLES;
const turn = new Euler(0, 0, 0, 'YXZ');
for (const x of [-pitch, 0, pitch]) for (const y of [-yaw, 0, yaw]) {
  for (const z of [-roll, 0, roll]) for (const tail of [-FISH_TAIL_SWING, 0, FISH_TAIL_SWING]) {
    for (let i = 0; i < FISH_FORMATION.length; i++) {
      mesh.skeleton.bones[2 * i].rotation.copy(turn.set(x, y, z));
      mesh.skeleton.bones[2 * i + 1].rotation.y = tail;
    }
    mesh.updateMatrixWorld(true);
    for (let i = 0; i < section.count; i++) {
      const fish = section.getX(i) / 2;
      mesh.getVertexPosition(i, vertex);
      measured[fish].expandByPoint(vertex);
      if (x === 0 && y === 0 && z === 0) local[fish].expandByPoint(vertex);
    }
  }
}
measured.forEach(box => box.expandByScalar(.010));
const sweep = new Box3();

function fishVolume(index, seconds, transform) {
  motion.envelope(FISH_FORMATION[index], seconds, rootPosition, rootRotation, scatter, stroke);
  transform.compose(rootPosition, rootRotation, unit);
  return sweep.copy(measured[index]).translate(scatter).expandByVector(stroke).expandByScalar(.020);
}

test('36 coloured fish fit a single draw, swim independently, and outgrow the source meshes', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  assert.equal(FISH_FORMATION.length, 36);
  assert.equal(mesh.skeleton.bones.length, 72);
  assert.equal(mesh.geometry.index.count / 3,
    FISH_FORMATION.reduce((total, fish) => total + manifest.fish[fish.source].triangles, 0));
  assert.equal(mesh.geometry.groups.length, 0);
  assert.equal(mesh.material.vertexColors, true);
  assert.ok(FISH_FORMATION.every(fish => fish.scale >= 1.29));
  const a = new Vector3(), b = new Vector3(), q = new Quaternion(), r = new Quaternion();
  const delta = new Box3().makeEmpty();
  const fish = FISH_FORMATION[1];
  for (let s = 0; s < 8; s += .08) {
    motion.envelope(fish, s, b, r, scatter, stroke);
    motion.sample(fish, s, a, q);
    delta.expandByPoint(a.sub(b).applyQuaternion(r.invert()).sub(scatter));
  }
  assert.ok(delta.max.x - delta.min.x > .025);
  assert.ok(delta.max.y - delta.min.y > .14);
  assert.ok(delta.max.z - delta.min.z > .16);
  assert.ok(q.angleTo(r.invert()) > .02);
});

function oriented(box, matrix) {
  const result = new OBB().fromBox3(box).applyMatrix4(matrix);
  result.center.copy(box.getCenter(new Vector3()).applyMatrix4(matrix));
  return result;
}

function obstacleSet() {
  // Index conservative volumes by z to keep the full route sweep inexpensive.
  const cells = new Map();
  return {
    add(box, matrix) {
      const aabb = box.clone().applyMatrix4(matrix);
      const entry = { aabb, obb: oriented(box, matrix) };
      for (let k = Math.floor(aabb.min.z); k <= Math.floor(aabb.max.z); k++) {
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(entry);
      }
    },
    intersects(box, matrix, obb) {
      const aabb = box.clone().applyMatrix4(matrix);
      for (let k = Math.floor(aabb.min.z); k <= Math.floor(aabb.max.z); k++) {
        for (const entry of cells.get(k) ?? []) {
          if (aabb.intersectsBox(entry.aabb) && obb.intersectsOBB(entry.obb)) return entry.obb.center.toArray();
        }
      }
      return null;
    },
  };
}

test('the closed lap keeps the school beside the carriage in both directions and in the water', () => {
  const school = fishSchoolPose();
  const matrix = new Matrix4();
  const start = route.sample(0, fishSchoolPose());
  const end = route.sample(route.duration - .001, fishSchoolPose());
  assert.ok(start.position.distanceTo(end.position) < .004);
  assert.ok(start.orientation.angleTo(end.orientation) < .01);
  const visits = { outbound: 0, return: 0, near: 0, far: 0 };
  let minimumWallClearance = Infinity, minBottomClearance = Infinity;
  for (let i = 0; i < 2200; i++) {
    route.sample(i * route.duration / 2200, school);
    const p = school.position, diff = p.x - t.x;
    if (p.z > t.startZ + 4 && p.z < t.endZ - 4) {
      assert.ok(Math.abs(Math.abs(diff) - FISH_LANE) < .24, p.toArray());
      assert.ok(Math.sign(diff) === Math.sign(Math.cos(school.yaw)));
      visits[diff > 0 ? 'outbound' : 'return']++;
    }
    const pondIndex = layouts.findIndex(pond => pond.contains(p.x / WORLD_SCALE, p.z / WORLD_SCALE));
    if (pondIndex >= 0 && p.y > -6.5) visits[pondIndex === 0 ? 'near' : 'far']++;
    const seconds = i * route.duration / 2200;
    for (let index = 0; index < FISH_FORMATION.length; index++) {
      const box = fishVolume(index, seconds, matrix);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          vertex.set(x, y, z).applyMatrix4(matrix);
          assert.ok(vertex.distanceTo(p) < FISH_SCHOOL_RADIUS, 'Formation culling bound');
          if (vertex.z >= t.startZ && vertex.z <= t.endZ) {
            const clearance = t.halfWidth - .31 - Math.abs(vertex.x - t.x);
            minimumWallClearance = Math.min(minimumWallClearance, clearance);
            assert.ok(clearance > 0 && vertex.y > t.floor + .15 && vertex.y < t.ceiling - .05,
              `Tunnel: ${seconds} fish ${index}: ${p.toArray()} / ${vertex.toArray()}`);
          }
          if (portal.containsPoint(vertex)) continue;
          const pond = layouts.find(layout => layout.contains(vertex.x / WORLD_SCALE, vertex.z / WORLD_SCALE));
          const floor = pond?.floorAt(vertex.x / WORLD_SCALE, vertex.z / WORLD_SCALE);
          assert.ok(floor != null && vertex.y < pond.waterY * WORLD_SCALE - .215,
            `Water: ${p.toArray()} / ${vertex.toArray()}`);
          const clearance = vertex.y - floor * WORLD_SCALE;
          minBottomClearance = Math.min(minBottomClearance, clearance);
          assert.ok(clearance > 0, `Bank: ${p.toArray()} / ${vertex.toArray()}`);
        }
      }
    }
  }
  assert.ok(visits.outbound > 400 && visits.return > 400 && visits.near > 90 && visits.far > 90, JSON.stringify(visits));
  console.log({ lapSeconds: route.duration, visits, minimumWallClearance, minBottomClearance });
});

test('all phases are clear of the swept shark, track, supports and all carriage parts', async () => {
  const coaster = createCoasterRoute();
  const terrain = prepareAsteroid(asteroid, new MeshBasicMaterial(), { pondLayouts: layouts });
  const cart = createCoasterCart();
  const parts = [];
  for (const child of cart.children) {
    if (child.name.includes('Seat')) {
      for (const part of child.children) parts.push(new Box3().setFromObject(part));
    } else parts.push(new Box3().setFromObject(child));
  }

  const obstacles = obstacleSet(), sharkObstacles = obstacleSet();
  const transform = new Matrix4();
  const trackBox = new Box3(new Vector3(-.86, -.44, -.20), new Vector3(.86, .11, .20));
  for (let metres = 0; metres < coaster.length; metres += .14) {
    const { position, up, quaternion } = coaster.frameAt(metres / coaster.length);
    if (Math.abs(position.x - t.x) > 14 || position.z < 3 || position.z > 100 || position.y > 4) continue;
    obstacles.add(trackBox, transform.compose(position, quaternion, unit));
    transform.compose(position.addScaledVector(up, .12), quaternion, unit);
    for (const part of parts) obstacles.add(part.clone().expandByScalar(.12), transform);
  }
  for (const { position, size, quaternion } of createCoasterSupports(coaster, (x, z) => {
    const height = terrain.heightAt(x / WORLD_SCALE, z / WORLD_SCALE);
    return height === null ? null : height * WORLD_SCALE;
  })) {
    if (Math.abs(position.x - t.x) > 14 || position.z < 3 || position.z > 100) continue;
    const sizeBox = new Box3().setFromCenterAndSize(new Vector3(), size).expandByScalar(.08);
    obstacles.add(sizeBox, transform.compose(position, quaternion, unit));
  }

  const { scene: shark, animations: [swim] } = await parse(await read('../src/assets/models/props/squalo.glb'));
  const sharkMesh = shark.getObjectByProperty('isSkinnedMesh', true);
  const actor = new Group();
  actor.add(shark);
  shark.scale.setScalar(SHARK_SCALE);
  const mixer = new AnimationMixer(shark);
  mixer.clipAction(swim).play();
  const sections = Array.from({ length: 7 }, () => new Box3());
  const geometry = sharkMesh.geometry;
  const vertices = geometry.attributes.position;
  const memberships = Array.from({ length: vertices.count }, () => new Set());
  for (let i = 0; i < geometry.index.count; i += 3) {
    const indices = [0, 1, 2].map(offset => geometry.index.getX(i + offset));
    const z = indices.reduce((sum, index) => sum + vertices.getZ(index), 0) / 3;
    const index = Math.max(0, Math.min(6, Math.floor((z + 2.1) / .5)));
    for (const i of indices) memberships[i].add(index);
  }
  for (let phase = 0; phase < 48; phase++) {
    mixer.setTime(swim.duration * phase / 48);
    actor.updateMatrixWorld(true);
    for (let i = 0; i < vertices.count; i++) {
      sharkMesh.getVertexPosition(i, vertex).applyMatrix4(sharkMesh.matrixWorld);
      for (const k of memberships[i]) sections[k].expandByPoint(vertex);
    }
  }
  const sharkRoute = createSharkRoute(layouts);
  const sharkPose = { position: new Vector3() };
  for (let seconds = 0; seconds < sharkRoute.duration; seconds += .07) {
    sharkRoute.sample(seconds, sharkPose);
    actor.position.copy(sharkPose.position);
    actor.rotation.set(-sharkPose.pitch, sharkPose.yaw, 0, 'YXZ');
    actor.updateMatrixWorld(true);
    // Added sweep margin exceeds the distance travelled between route samples.
    for (const section of sections) sharkObstacles.add(section.clone().expandByScalar(.21), actor.matrixWorld);
  }

  for (let seconds = 0; seconds < route.duration; seconds += .055) {
    for (let index = 0; index < FISH_FORMATION.length; index++) {
      const box = fishVolume(index, seconds, transform);
      const obb = oriented(box, transform);
      const fixedHit = obstacles.intersects(box, transform, obb);
      assert.equal(fixedHit, null, `Carriage, track or support: ${seconds} fish ${index} / ${rootPosition.toArray()} / ${fixedHit}`);
      const sharkHit = sharkObstacles.intersects(box, transform, obb);
      assert.equal(sharkHit, null, `Shark: ${seconds} fish ${index} / ${rootPosition.toArray()} / ${sharkHit}`);
    }
  }
});

test('neighbouring fish do not cross during sampled passes and turns', () => {
  const boxes = FISH_FORMATION.map(() => new OBB());
  const transforms = FISH_FORMATION.map(() => new Matrix4());
  for (let time = 0; time < route.duration * 3; time += .11) {
    FISH_FORMATION.forEach((spec, i) => {
      motion.sample(spec, time, rootPosition, rootRotation);
      transforms[i].compose(rootPosition, rootRotation, unit);
      boxes[i].copy(oriented(local[i], transforms[i]));
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(!boxes[i].intersectsOBB(boxes[j]), `Fish ${i} and ${j} intersect at ${time}s: ${boxes[i].center.toArray()} / ${boxes[j].center.toArray()} / ${boxes[i].halfSize.toArray()} / ${boxes[j].halfSize.toArray()}`);
    }
  }
  school.dispose();
});
