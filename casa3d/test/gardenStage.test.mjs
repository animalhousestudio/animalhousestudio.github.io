import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Box3, Group, PerspectiveCamera, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createStageCollision, createStageRoot, STAGE_DECK, STAGE_PLACEMENT, STAGE_YAW, STAGE_STAIRS, STAGE_STRUCTURE_SCALE } from '../src/rooms/stageLayout.mjs';
import { BASE_HOUSE_X, BASE_HOUSE_Z, EYE_HEIGHT, WORLD_SCALE } from '../src/rooms/layout.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';
import { instanceStaticMeshes, batchStaticArchitecture } from '../src/rooms/optimize.mjs';
import { captureCollisionSource, CollisionWorld } from '../src/player/collisionWorld.mjs';
import { Player } from '../src/player/movement.js';

const bytes = await readFile(new URL('../src/assets/models/props/garden-stage.glb', import.meta.url));
const report = JSON.parse(await readFile(new URL('../art/garden-stage-v01/export-report.json', import.meta.url), 'utf8'));
const jsonLength = bytes.readUInt32LE(12);
const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
const binary = bytes.subarray(20 + jsonLength + 8);
const loader = new GLTFLoader();
// Exercise the actual exported geometry/materials without browser image decoding.
loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
const { scene: authored } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
authored.updateMatrixWorld(true);

const near = (actual, expected, tolerance = 1e-5, message = '') =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);

function stageWorld() {
  const world = new Group(); world.scale.setScalar(WORLD_SCALE);
  const visual = authored.clone(true), root = createStageRoot(visual);
  world.add(root); world.updateMatrixWorld(true);
  const source = captureCollisionSource(root);
  const collisions = new CollisionWorld().addSource(source, root.matrixWorld).build();
  return { world, root, visual, source, collisions,
    toWorld: (x, y, z) => root.localToWorld(new Vector3(x, y, z)),
    toLocal: position => root.worldToLocal(position.clone()) };
}

test('garden stage GLB is the approved, self-contained export with real wood textures', async () => {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(bytes.length, report.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.sha256);
  assert.equal(document.materials.length, report.materialCount);
  assert.equal(document.meshes.length, report.meshCount);
  assert.ok(!document.cameras?.length, 'Review cameras must stay outside the runtime asset');
  assert.ok(!document.extensionsUsed?.includes('KHR_lights_punctual'), 'Studio lights must not enter the game');
  assert.ok(!document.nodes.some(node => /Studio|Backdrop|Camera/i.test(node.name)), 'No studio backdrop or camera nodes');
  assert.ok(document.buffers.every(buffer => !buffer.uri), 'Geometry is embedded');
  assert.equal(document.images.length, report.textures.length);

  for (const expected of report.textures) {
    const material = document.materials.find(item => item.name === expected.material);
    const texture = document.textures[material?.pbrMetallicRoughness.baseColorTexture?.index];
    assert.ok(texture, `${expected.material}: baked base-color texture is assigned`);
    const image = document.images[texture.source], view = document.bufferViews[image.bufferView];
    assert.equal(image.mimeType, 'image/png'); assert.equal(image.uri, undefined);
    const png = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], expected.size);
    assert.equal(createHash('sha256').update(png).digest('hex'), expected.sha256, `${expected.material}: embedded texture provenance`);
  }

  let triangles = 0, meshPrimitives = 0;
  authored.traverse(node => {
    assert.ok(!node.isCamera && !node.isLight);
    if (!node.isMesh) return;
    meshPrimitives++;
    const position = node.geometry.attributes.position;
    triangles += (node.geometry.index?.count ?? position.count) / 3;
    assert.ok(node.geometry.attributes.normal, `${node.name}: shading normals`);
    assert.ok(Array.from(position.array).every(Number.isFinite), `${node.name}: finite vertices`);
    if (/^Stage_Plank|^Stage_StairTread/.test(node.name)) {
      assert.match(node.material.name, /^Stage_Walnut_/);
      assert.ok(node.material.map && node.geometry.attributes.uv, `${node.name}: textured wood`);
    }
  });
  assert.equal(triangles, report.triangles);
  assert.equal(document.meshes.length, 200);
  assert.equal(meshPrimitives, 202, 'glTF mesh definitions can contain multiple rendered primitives');
  assert.ok(triangles < 20000, 'The enlarged stage must retain its modest geometry budget');
  assert.equal(document.nodes.filter(node => /^Stage_LampHousing_/.test(node.name)).length, 4);
});

test('stage structure is three times larger in real metres and points its front toward the house', () => {
  const { root, toWorld } = stageWorld();
  assert.equal(WORLD_SCALE, 5); assert.equal(EYE_HEIGHT, 2);
  assert.equal(STAGE_STRUCTURE_SCALE, 3);
  near(toWorld(STAGE_DECK.width, 0, 0).distanceTo(toWorld(0, 0, 0)), 8 * 3);
  near(toWorld(0, 0, STAGE_DECK.depth).distanceTo(toWorld(0, 0, 0)), 4 * 3);
  near(toWorld(0, STAGE_DECK.height, 0).y - toWorld(0, 0, 0).y, .64 * 3);
  const bounds = new Box3().setFromObject(authored, true);
  near(bounds.min.y, 0); near(bounds.max.y, 4.555 * 3);
  near(bounds.getSize(new Vector3()).x, 9.96 * 3);
  near(bounds.getSize(new Vector3()).z, 15.58, 1e-5, 'Redesigned stairs use human-height risers');
  const deckBoards = new Box3();
  authored.traverse(node => {
    if (/^Stage_Plank_/.test(node.name)) deckBoards.union(new Box3().setFromObject(node, true));
  });
  near(deckBoards.getSize(new Vector3()).x, (8 - .006) * 3);
  near(deckBoards.getSize(new Vector3()).z, (4 - .006) * 3);
  near(deckBoards.max.y, 1.92);
  const post = new Box3().setFromObject(authored.getObjectByName('Stage_Post_L_Front'), true);
  near(post.getSize(new Vector3()).y, 3.84 * 3, 1e-5, 'Structural upright height grows threefold');
  assert.deepEqual(root.position.toArray(), [STAGE_PLACEMENT.x, STAGE_PLACEMENT.y, STAGE_PLACEMENT.z]);
  near(root.rotation.y, STAGE_YAW);
  const front = toWorld(0, 0, 1).sub(toWorld(0, 0, 0)).normalize();
  const towardHouse = new Vector3(BASE_HOUSE_X - STAGE_PLACEMENT.x, 0, BASE_HOUSE_Z - STAGE_PLACEMENT.z).normalize();
  assert.ok(front.dot(towardHouse) > .999999, 'The two stairs face inward toward the house');
  assert.equal(root.userData.edgeClearanceMeters, 1);
});

test('monitor wedges and microphone stay life-size on the enlarged deck', () => {
  for (const side of [-1, 1]) {
    const monitor = authored.getObjectByName(`Stage_Monitor_${side}`);
    assert.ok(monitor);
    const bounds = new Box3().setFromObject(monitor, true), size = bounds.getSize(new Vector3());
    near(size.x, .58); near(size.z, .48);
    // Beveling trims about 5.4 mm from the original 32 cm wedge's top edge.
    near(size.y, .32, .006, 'The original monitor remains human-scale');
    near(bounds.min.y, STAGE_DECK.height, 1e-5, 'Monitor rests directly on the enlarged deck');
  }
  const base = new Box3().setFromObject(authored.getObjectByName('Stage_MicrophoneBase'), true);
  const stand = new Box3().setFromObject(authored.getObjectByName('Stage_MicrophoneStand'), true);
  const mic = new Box3().setFromObject(authored.getObjectByName('Stage_Microphone'), true);
  near(base.getSize(new Vector3()).x, .34); near(base.getSize(new Vector3()).z, .34);
  near(base.getSize(new Vector3()).y, .034);
  near(base.min.y, STAGE_DECK.height + .003, 1e-5, 'Original 3 mm microphone foot clearance is preserved');
  near(stand.getSize(new Vector3()).y, 1.488); near(stand.getSize(new Vector3()).x, .024);
  near(stand.min.y, STAGE_DECK.height + .032); near(stand.max.y, STAGE_DECK.height + 1.52);
  near(mic.getSize(new Vector3()).x, .048);
  near(mic.max.y - STAGE_DECK.height, 1.6689132, 1e-5, 'Complete microphone reaches the same performer height');
});

test('invisible collision treads match the exported stairs and wooden deck', () => {
  const physics = createStageCollision(); physics.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  assert.equal(STAGE_STAIRS.count, 11);
  near(STAGE_STAIRS.rise, .16);
  near((STAGE_STAIRS.count + 1) * STAGE_STAIRS.rise, STAGE_DECK.height);
  for (const side of ['Left', 'Right']) for (let step = 1; step <= STAGE_STAIRS.count; step++) {
    const tread = authored.getObjectByName(`Stage_StairTread_${side}_${step}`);
    assert.ok(tread);
    const bounds = new Box3().setFromObject(tread, true), center = bounds.getCenter(new Vector3());
    near(bounds.getSize(new Vector3()).x, STAGE_STAIRS.width);
    near(bounds.getSize(new Vector3()).z, STAGE_STAIRS.run);
    near(bounds.max.y, step * STAGE_STAIRS.rise);
    ray.ray.origin.set(center.x, STAGE_DECK.height + 1, center.z);
    const hits = ray.intersectObject(physics, true);
    assert.ok(hits.length, `${side} stair ${step}: physical support exists`);
    near(hits[0].point.y, bounds.max.y, 1e-5, `${side} stair ${step}: no invisible hovering or sinking`);
  }
  const plank = authored.getObjectByName('Stage_Plank_01_1');
  const bounds = new Box3().setFromObject(plank, true), center = bounds.getCenter(new Vector3());
  ray.ray.origin.set(center.x, STAGE_DECK.height + 1, center.z);
  near(ray.intersectObject(physics, true)[0].point.y, bounds.max.y);
});

test('collision capture excludes the visual GLB and survives batching and visibility changes', () => {
  const { world, root, visual, source, toWorld } = stageWorld();
  assert.ok(source.length > STAGE_STAIRS.count * 2 && source.length < 64, 'Physics uses simple stable hulls');
  assert.ok(source.every(record => record.name.startsWith('StageCollision_')));
  assert.equal(source.length, captureCollisionSource(createStageCollision()).length);
  assert.equal(root.userData.streamingBoundary, true);
  assert.equal(visual.userData.collisionDisabled, true);
  const matrix = root.matrixWorld.clone();
  const geometries = source.map(record => record.geometry);
  instanceStaticMeshes(visual); batchStaticArchitecture(visual);
  instanceStaticMeshes(world); batchStaticArchitecture(world);
  world.updateMatrixWorld(true);
  assert.equal(root.parent, world); assert.equal(visual.parent, root);
  assert.ok(root.matrixWorld.equals(matrix), 'Parent optimization preserves the content transform');
  assert.ok(source.every((record, index) => record.geometry === geometries[index]));
  assert.deepEqual(captureCollisionSource(root).map(record => record.name), source.map(record => record.name));
  root.visible = false;
  const collisions = new CollisionWorld().addSource(source, root.matrixWorld).build();
  const landing = collisions.move(toWorld(0, EYE_HEIGHT + 3, 0), new Vector3(0, -5, 0), { eyeHeight: EYE_HEIGHT });
  assert.equal(landing.grounded, true);
  near(landing.position.y, toWorld(0, STAGE_DECK.height + EYE_HEIGHT, 0).y, .002);
});

function playerAt(fixture, x, feetY, z, speed) {
  const player = new Player(new PerspectiveCamera(), null, {
    speed,
    groundHeightAt: (worldX, worldZ) => terrainHeight(worldX / WORLD_SCALE, worldZ / WORLD_SCALE) * WORLD_SCALE,
  });
  player.setPosition(fixture.toWorld(x, feetY + EYE_HEIGHT, z));
  return player;
}

for (const [speed, dt] of [[4, 1 / 60], [11.4, 1 / 30], [11.4, 1 / 20]]) {
  test(`both stage stairs support walking up, stopping and walking down at ${speed} m/s, ${Math.round(1 / dt)} FPS`, () => {
    const fixture = stageWorld();
    for (const x of [-STAGE_STAIRS.x, STAGE_STAIRS.x]) {
      const player = playerAt(fixture, x, 0, 11, speed);
      player.yaw = STAGE_YAW + Math.PI; player.setMoveState({ forward: true });
      let frames = 0;
      while (fixture.toLocal(player.camera.position).z > 2 && frames++ < 480) {
        player.update(dt, fixture.collisions);
        assert.ok(player.camera.position.y >= fixture.toWorld(0, EYE_HEIGHT, 0).y - .01);
        assert.ok(player.camera.position.y <= fixture.toWorld(0, EYE_HEIGHT + STAGE_DECK.height, 0).y + .015,
          'Walking over stair edges must not launch the player upward');
      }
      assert.ok(frames < 480, `${x < 0 ? 'Left' : 'Right'} stair must not snag the player`);
      player.setMoveState({ forward: false });
      for (let i = 0; i < 60; i++) player.update(dt, fixture.collisions);
      let local = fixture.toLocal(player.camera.position);
      near(local.x, x, .03, 'Player stays on the intended stair route');
      near(local.y - EYE_HEIGHT, STAGE_DECK.height, .002, 'Stable support on the wooden deck');
      assert.equal(player.grounded, true);
      player.yaw = STAGE_YAW; player.setMoveState({ forward: true }); frames = 0;
      while (fixture.toLocal(player.camera.position).z < 11 && frames++ < 480) player.update(dt, fixture.collisions);
      assert.ok(frames < 480, 'The stairs are usable in the reverse direction');
      player.setMoveState({ forward: false });
      for (let i = 0; i < 90; i++) player.update(dt, fixture.collisions);
      local = fixture.toLocal(player.camera.position);
      near(local.y - EYE_HEIGHT, 0, .002, 'Returned to garden ground');
      assert.equal(player.grounded, true);
    }
  });
}

test('the 1.92 metre deck side remains a wall while the jetpack can land on top', () => {
  const fixture = stageWorld();
  const walker = playerAt(fixture, STAGE_DECK.width / 2 + 2, 0, -.5, 4);
  walker.yaw = STAGE_YAW - Math.PI / 2; walker.setMoveState({ forward: true });
  for (let i = 0; i < 180; i++) walker.update(1 / 60, fixture.collisions);
  const stopped = fixture.toLocal(walker.camera.position);
  assert.ok(stopped.x >= STAGE_DECK.width / 2 + walker.colliderRadius - .01, 'Deck sides cannot be walked through or auto-stepped');
  near(stopped.y - EYE_HEIGHT, 0, .01);

  const flyer = playerAt(fixture, 0, STAGE_DECK.height + 6, 0, 4);
  flyer.enableJetpack(); flyer.setMoveState({ down: true });
  for (let i = 0; i < 120; i++) flyer.update(1 / 30, fixture.collisions);
  assert.equal(flyer.grounded, true);
  near(fixture.toLocal(flyer.camera.position).y - EYE_HEIGHT, STAGE_DECK.height, .002, 'Jetpack landing uses the same deck');
  flyer.disableJetpack();
  for (let i = 0; i < 30; i++) flyer.update(1 / 60, fixture.collisions);
  near(fixture.toLocal(flyer.camera.position).y - EYE_HEIGHT, STAGE_DECK.height, .002, 'Deck stays solid after landing');
});
