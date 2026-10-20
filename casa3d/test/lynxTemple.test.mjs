import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Box3, Group, PerspectiveCamera, Raycaster, Sphere, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  createLynxTempleRoot, prepareLynxTempleVisual, lynxTempleFootprintContains,
  LYNX_TEMPLE_PLACEMENT, LYNX_TEMPLE_YAW,
} from '../src/rooms/lynxTempleLayout.mjs';
import { BASE_HOUSE_X, BASE_HOUSE_Z, EYE_HEIGHT, WORLD_SCALE } from '../src/rooms/layout.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';
import { landscapeFootprintClear } from '../src/rooms/landscapeLayout.mjs';
import { instanceStaticMeshes, batchStaticArchitecture } from '../src/rooms/optimize.mjs';
import { captureCollisionSource, CollisionWorld } from '../src/player/collisionWorld.mjs';
import { Player } from '../src/player/movement.js';
import { createVisualLod } from '../src/world/visualLod.mjs';
import { createWorldZones } from '../src/world/zones.mjs';
import { WORLD_CONTENT } from '../src/world/content.mjs';

const repository = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('../art/lynx-temple-v01/manifest.json', import.meta.url), 'utf8'));
const metadata = JSON.parse(await readFile(new URL('../src/assets/models/lod/lynx-temple-metadata.json', import.meta.url), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const near = (actual, expected, tolerance = 1e-5, message = '') =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);

async function readModel(record) {
  const bytes = await readFile(new URL(record.path, repository));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${record.path}: GLB signature`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${record.path}: complete payload`);
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim());
  const loader = new GLTFLoader();
  // Inspect real geometry and material definitions without browser image decoding.
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.updateMatrixWorld(true);
  let triangles = 0;
  scene.traverse(node => {
    if (node.isMesh) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
  });
  return { bytes, document, scene, triangles, record,
    bounds: new Box3().setFromObject(scene), tightBounds: new Box3().setFromObject(scene, true) };
}

const models = Object.fromEntries(await Promise.all(Object.entries({ ...manifest.tiers, collision: manifest.collision })
  .map(async ([level, record]) => [level, await readModel(record)])));

function assertBounds(actual, expected, tolerance = 1e-5, label = '') {
  for (const edge of ['min', 'max']) for (const [index, axis] of ['x', 'y', 'z'].entries()) {
    const value = Array.isArray(expected[edge]) ? expected[edge][index] : expected[edge][axis];
    near(actual[edge][axis], value, tolerance, `${label} ${edge}.${axis}`);
  }
}

function templeWorld(level = 'far') {
  const world = new Group(); world.scale.setScalar(WORLD_SCALE);
  const localBounds = new Box3(new Vector3(...metadata.bounds.min), new Vector3(...metadata.bounds.max));
  const root = createLynxTempleRoot(models.collision.scene.clone(true), { localBounds });
  const visual = models[level].scene.clone(true);
  prepareLynxTempleVisual(visual); root.add(visual); world.add(root); world.updateMatrixWorld(true);
  const source = captureCollisionSource(root);
  const collisions = new CollisionWorld().addSource(source, root.matrixWorld).build();
  return { world, root, visual, source, collisions,
    toWorld: (x, y, z) => root.localToWorld(new Vector3(x, y, z)),
    toLocal: position => root.worldToLocal(position.clone()) };
}

function playerAt(fixture, x, feetY, z, speed = 4) {
  const player = new Player(new PerspectiveCamera(), null, {
    speed,
    groundHeightAt: (worldX, worldZ) => terrainHeight(worldX / WORLD_SCALE, worldZ / WORLD_SCALE) * WORLD_SCALE,
  });
  player.setPosition(fixture.toWorld(x, feetY + EYE_HEIGHT, z));
  return player;
}

function settle(player, collisions, dt = 1 / 60) {
  player.setMoveState({ forward: false });
  for (let frame = 0; frame < 90; frame++) player.update(dt, collisions);
}

test('lynx temple retains the saved Blender source and verified, self-contained runtime exports', async () => {
  const source = await readFile(new URL(manifest.source.path, repository));
  assert.equal(sha256(source), manifest.source.sha256, 'Saved editable source matches the export provenance');
  for (const [level, model] of Object.entries(models)) {
    const { bytes, document, record, scene } = model;
    assert.equal(sha256(bytes), record.sha256, `${level}: exported hash`);
    assert.equal(bytes.length, record.bytes, `${level}: exported byte count`);
    assert.equal(model.triangles, record.triangles, `${level}: actual triangle count`);
    assertBounds(model.bounds, record.bounds, 1e-4, `${level}: recorded bounds`);
    assert.ok(document.buffers.every(buffer => !buffer.uri), `${level}: embedded geometry`);
    assert.ok((document.images ?? []).every(image => !image.uri && image.bufferView !== undefined), `${level}: embedded textures`);
    assert.ok(!document.cameras?.length, `${level}: no review cameras`);
    assert.ok(!document.extensionsUsed?.includes('KHR_lights_punctual'), `${level}: no studio lights`);
    assert.ok(!document.nodes.some(node => /^(CUT|Studio|Backdrop|Camera)|cutter/i.test(node.name ?? '')), `${level}: no studio or boolean cutters`);
    scene.traverse(node => {
      assert.ok(!node.isCamera && !node.isLight, `${level}: runtime-only scene`);
      if (!node.isMesh) return;
      assert.ok(node.geometry.attributes.normal, `${level}/${node.name}: shading normals`);
      for (const attribute of Object.values(node.geometry.attributes)) {
        assert.ok(Array.from(attribute.array).every(Number.isFinite), `${level}/${node.name}: finite geometry attributes`);
      }
    });
  }
});

test('lynx temple tiers reduce transferred geometry while keeping materials and canonical metre bounds', () => {
  const source = models.near;
  assertBounds(source.bounds, metadata.bounds, 1e-4, 'Canonical source envelope');
  near(source.bounds.min.y, -1.28, .01, 'Authored well stays underground instead of lifting the whole temple');
  near(source.bounds.getSize(new Vector3()).x, 10.8, .03, 'Ten-metre architecture retains source metres');
  assert.ok(models.medium.triangles <= source.triangles * .30, 'Medium <=30% of near triangles');
  assert.ok(models.far.triangles <= source.triangles * .12, 'Far <=12% of near triangles');
  assert.ok(models.far.bytes.length < models.medium.bytes.length && models.medium.bytes.length < source.bytes.length);
  const sourceMaterials = new Map(source.document.materials.map(material => [material.name, material]));
  for (const level of ['near', 'medium', 'far']) {
    const model = models[level];
    assert.equal(model.bytes.length, metadata.bytes[level], `${level}: runtime bytes`);
    assert.equal(model.triangles, metadata.triangles[level], `${level}: runtime triangles`);
    for (const material of model.document.materials) {
      assert.deepEqual(material, sourceMaterials.get(material.name), `${level}: ${material.name} keeps its material semantics`);
    }
    assertBounds(model.bounds, source.bounds, .03, `${level}: same placement envelope`);
  }
});

test('lynx temple placement faces the house and leaves the house, pond and paths clear', () => {
  const { root, toWorld, visual } = templeWorld();
  assert.equal(EYE_HEIGHT, 2);
  near(toWorld(1, 0, 0).distanceTo(toWorld(0, 0, 0)), 1, 1e-8, 'One source metre is one world metre');
  assert.deepEqual(root.position.toArray(), [LYNX_TEMPLE_PLACEMENT.x, LYNX_TEMPLE_PLACEMENT.y, LYNX_TEMPLE_PLACEMENT.z]);
  near(root.rotation.y, LYNX_TEMPLE_YAW);
  const front = toWorld(0, 0, 1).sub(toWorld(0, 0, 0)).normalize();
  const house = new Vector3(BASE_HOUSE_X - root.position.x, 0, BASE_HOUSE_Z - root.position.z).normalize();
  assert.ok(front.dot(house) > .999999, 'Entrance points toward the house');
  const bounds = new Box3().setFromObject(visual, true);
  const footprint = { minX: bounds.min.x / WORLD_SCALE, maxX: bounds.max.x / WORLD_SCALE,
    minZ: bounds.min.z / WORLD_SCALE, maxZ: bounds.max.z / WORLD_SCALE };
  assert.equal(landscapeFootprintClear(footprint), true, 'Pond and stone paths remain clear');
  assert.ok(footprint.minX > 11 || footprint.maxX < -15 || footprint.maxZ < -9.8 || footprint.minZ > 8.7,
    'Temple lies outside the existing house and veranda footprint');
  for (const point of [[0, 0], [0, 5.35], [5.35, 0], [-5.35, 0], [0, -5.35]]) {
    const world = toWorld(point[0], 0, point[1]);
    near(terrainHeight(world.x / WORLD_SCALE, world.z / WORLD_SCALE) * WORLD_SCALE, 0, .01, 'Flat terrain under the temple');
    assert.ok(lynxTempleFootprintContains(world.x / WORLD_SCALE, world.z / WORLD_SCALE), 'Procedural dressing excludes temple footprint');
  }
});

test('real collision hulls match all three visible step heights and the sealed hatch', () => {
  const physics = models.collision.scene;
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  for (const [z, height] of [[5.25, .11], [5.02, .33], [4.7, .62]]) {
    ray.ray.origin.set(0, .95, z);
    const solid = ray.intersectObject(physics, true)[0];
    const visible = ray.intersectObject(models.near.scene, true)[0];
    assert.ok(solid && visible, `Step at ${z}: visible and physical support`);
    near(solid.point.y, height, .003, 'Physical step top');
    near(solid.point.y, visible.point.y, .006, 'Physics follows the visible stone');
  }
  for (const x of [1.5, 1.8, 2.1]) for (const z of [-.75, -.35, .05]) {
    ray.ray.origin.set(x, .9, z);
    const solid = ray.intersectObject(physics, true)[0], visible = ray.intersectObject(models.near.scene, true)[0];
    assert.ok(solid && visible, 'Closed hatch supports the full interior of its opening');
    assert.match(solid.object.name, /HatchCover/);
    near(solid.point.y, visible.point.y, .006, 'Closed hatch collider follows its visible lid');
  }
});

for (const [speed, dt] of [[4, 1 / 60], [11.4, 1 / 30], [11.4, 1 / 20]]) {
  test(`walk from garden up temple steps through the doorway and return at ${speed} m/s, ${Math.round(1 / dt)} FPS`, () => {
    const fixture = templeWorld(), player = playerAt(fixture, 0, 0, 7, speed);
    player.yaw = LYNX_TEMPLE_YAW + Math.PI; player.setMoveState({ forward: true });
    let frames = 0;
    while (fixture.toLocal(player.camera.position).z > 1.6 && frames++ < 360) {
      player.update(dt, fixture.collisions);
      const local = fixture.toLocal(player.camera.position);
      assert.ok(local.y >= EYE_HEIGHT - .015, 'Player stays above the terrain');
      assert.ok(local.y <= EYE_HEIGHT + .635, 'Stair edges do not launch the player');
      near(local.x, 0, .035, 'Central entrance route stays unobstructed');
    }
    assert.ok(frames < 360, 'All steps and the actual doorway pass the full player capsule');
    settle(player, fixture.collisions, dt);
    near(fixture.toLocal(player.camera.position).y - EYE_HEIGHT, .62, .003, 'Interior stone floor supports the player');
    assert.equal(player.grounded, true);
    player.yaw = LYNX_TEMPLE_YAW; player.setMoveState({ forward: true }); frames = 0;
    while (fixture.toLocal(player.camera.position).z < 7 && frames++ < 360) player.update(dt, fixture.collisions);
    assert.ok(frames < 360, 'Entrance is also passable outward');
    settle(player, fixture.collisions, dt);
    near(fixture.toLocal(player.camera.position).y - EYE_HEIGHT, 0, .003, 'Returned to garden ground');
    assert.equal(player.grounded, true);
  });
}

test('temple walls, front columns and the oracle remain solid while the sealed hatch supports a landing', () => {
  const fixture = templeWorld();
  const wall = playerAt(fixture, 0, .62, -4.05);
  wall.yaw = LYNX_TEMPLE_YAW; wall.setMoveState({ forward: true });
  for (let frame = 0; frame < 180; frame++) wall.update(1 / 60, fixture.collisions);
  assert.ok(fixture.toLocal(wall.camera.position).z < -3.7, 'Rear cella wall cannot be walked through');
  const column = playerAt(fixture, 1.436929, .62, 5.15);
  column.yaw = LYNX_TEMPLE_YAW + Math.PI; column.setMoveState({ forward: true });
  for (let frame = 0; frame < 120; frame++) {
    column.update(1 / 60, fixture.collisions);
    const local = fixture.toLocal(column.camera.position);
    // A round shaft can redirect a walker around its edge. Check the whole
    // trajectory for penetration rather than requiring it to halt forever.
    assert.ok(Math.hypot(local.x - 1.436929, local.z - 4.422413) >= .58,
      `Player capsule must not cross the column shaft: ${local.toArray()}`);
  }
  const oracle = playerAt(fixture, 0, .62, 1.7);
  oracle.yaw = LYNX_TEMPLE_YAW + Math.PI; oracle.setMoveState({ forward: true });
  for (let frame = 0; frame < 180; frame++) oracle.update(1 / 60, fixture.collisions);
  assert.ok(fixture.toLocal(oracle.camera.position).z > .35, 'Oracle and pedestal cannot be crossed');
  const landing = fixture.collisions.move(fixture.toWorld(1.8, EYE_HEIGHT + 1.5, -.35), new Vector3(0, -2, 0), { eyeHeight: EYE_HEIGHT });
  assert.equal(landing.grounded, true);
  near(fixture.toLocal(landing.position).y - EYE_HEIGHT, .645, .006, 'Hatch remains sealed under a full player capsule');
});

test('real visual tier swaps preserve registration, placement and physics through parent optimization and visibility changes', async () => {
  const fixture = templeWorld(); fixture.visual.removeFromParent();
  const { root, world, source } = fixture, visualRoot = new Group();
  visualRoot.userData.collisionDisabled = true; root.add(visualRoot);
  const bounds = new Box3(new Vector3(...metadata.bounds.min), new Vector3(...metadata.bounds.max));
  const controller = createVisualLod({ root: visualRoot, bounds: bounds.getBoundingSphere(new Sphere()), hysteresis: 0,
    levels: [['far', 0], ['medium', 80], ['near', 260]].map(([level, minPixels]) => ({ id: level, minPixels,
      load: async () => { const model = models[level].scene.clone(true); prepareLynxTempleVisual(model); return model; },
    })),
  });
  await controller.ready;
  const content = WORLD_CONTENT.find(entry => entry.root === root.name);
  assert.ok(content, 'Temple has a stable catalog entry');
  assert.equal(content.kind, 'structure', 'Walkable architecture is resident');
  const zones = createWorldZones(), entry = zones.register(content.zone, root, {
    contentId: content.id, decorative: content.kind === 'decoration', margin: 3, localBounds: root.userData.worldLocalBounds,
  });
  assert.equal(root.userData.streamingBoundary, true);
  assert.equal(root.userData.worldContentId, content.id);
  assert.ok(source.length > 10 && source.length < 100, 'Physics remains a bounded structural hull set');
  assert.ok(source.every(record => record.name.startsWith('TempleCollision_')));
  const matrix = root.matrixWorld.clone(), registeredBounds = entry.bounds.clone();
  assertBounds(registeredBounds, bounds.clone().applyMatrix4(matrix), 1e-5, 'Full source envelope is registered before optional detail loads');
  const view = new PerspectiveCamera(60, 1, .1, 10000);
  const sphere = bounds.getBoundingSphere(new Sphere()).applyMatrix4(matrix);
  try {
    for (const [index, [level, pixels]] of [['far', 40], ['medium', 150], ['near', 500], ['far', 40]].entries()) {
      const depth = sphere.radius * 1000 * view.projectionMatrix.elements[5] / pixels;
      view.position.copy(sphere.center).add(new Vector3(0, 0, depth)); view.lookAt(sphere.center);
      controller.update(index + 1, view, 1000);
      for (let pass = 0; pass < 8 && controller.state.activeLevel !== level; pass++) await new Promise(resolve => setImmediate(resolve));
      assert.equal(controller.state.activeLevel, level);
      instanceStaticMeshes(world); batchStaticArchitecture(world); world.updateMatrixWorld(true);
      assert.equal(root.parent, world); assert.equal(visualRoot.parent, root);
      assert.ok(root.matrixWorld.equals(matrix), `${level}: canonical metre transform is stable`);
      assert.ok(entry.bounds.equals(registeredBounds), `${level}: registered envelope stays stable`);
      const captured = captureCollisionSource(root);
      assert.deepEqual(captured.map(record => record.name), source.map(record => record.name));
      assert.ok(captured.every((record, i) => record.geometry === source[i].geometry && record.matrix.equals(source[i].matrix)),
        `${level}: source hulls and transforms survive tier replacement`);
      root.visible = false;
      const landing = fixture.collisions.move(fixture.toWorld(1.8, EYE_HEIGHT + 1.5, -.35), new Vector3(0, -2, 0), { eyeHeight: EYE_HEIGHT });
      assert.equal(landing.grounded, true, `${level}: captured physics survives hidden render root`);
      near(fixture.toLocal(landing.position).y - EYE_HEIGHT, .645, .006, 'No physical LOD change');
      root.visible = true; view.lookAt(view.position.clone().add(new Vector3(0, 0, 1))); zones.update(view);
      assert.equal(root.visible, true, 'World culling never hides the resident temple');
    }
  } finally { controller.dispose(); }
});
