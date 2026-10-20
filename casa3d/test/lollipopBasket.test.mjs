import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Box3, Group, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLollipopBasketRoot } from '../src/rooms/lollipopBasketLayout.mjs';
import { ARRIVAL_PICKUP_ANCHOR, BEEHIVE_PLACEMENT, JETPACK_PLACEMENT, LOLLIPOP_BASKET_PLACEMENT } from '../src/rooms/arrivalLayout.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';
import { LANDING_Z } from '../src/arrival.mjs';
import { WORLD_CONTENT } from '../src/world/content.mjs';
import { captureCollisionSource, CollisionWorld } from '../src/player/collisionWorld.mjs';
import { batchStaticArchitecture, instanceStaticMeshes } from '../src/rooms/optimize.mjs';
import { createLollipopEquipment } from '../src/player/lollipopEquipment.mjs';
import { createLollipopPickup } from '../src/player/lollipopPickup.mjs';

const casa = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('art/lollipop-basket-v01/manifest.json', casa), 'utf8'));
const bytes = await readFile(new URL(manifest.output.path, casa));
const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim());
const sha256 = data => createHash('sha256').update(data).digest('hex');
const near = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const loader = new GLTFLoader();
loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');

test('Blender basket retains its source, embedded original logo, metre bounds and geometry budget', async () => {
  assert.equal(sha256(await readFile(new URL(manifest.source.path, casa))), manifest.source.sha256);
  assert.equal(sha256(bytes), manifest.output.sha256);
  assert.equal(bytes.length, manifest.output.bytes);
  assert.ok(bytes.length < 2 * 1024 * 1024);
  let triangles = 0;
  scene.traverse(node => {
    assert.ok(!node.isCamera && !node.isLight, 'No authoring studio in the runtime asset');
    if (node.isMesh) triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
  });
  assert.equal(triangles, manifest.output.triangles);
  assert.ok(triangles < 35000);
  assert.equal(manifest.lollipopCount, 24);
  const bounds = new Box3().setFromObject(scene);
  for (const edge of ['min', 'max']) for (const [index, axis] of ['x', 'y', 'z'].entries()) near(bounds[edge][axis], manifest.output.bounds[edge][index]);
  near(bounds.min.y, 0, 1e-4);
  assert.ok(bounds.max.y > 1 && bounds.max.y < 1.2, 'Life-size basket, not environment-scaled geometry');
  assert.ok(document.buffers.every(buffer => !buffer.uri));
  assert.equal(document.images.length, 1);
  const image = document.images[0], view = document.bufferViews[image.bufferView];
  assert.ok(!image.uri && image.bufferView !== undefined);
  const binaryStart = 20 + bytes.readUInt32LE(12) + 8;
  const embeddedLogo = bytes.subarray(binaryStart + (view.byteOffset ?? 0), binaryStart + (view.byteOffset ?? 0) + view.byteLength);
  assert.equal(sha256(embeddedLogo), manifest.logo.sha256);
  assert.equal(sha256(await readFile(new URL(manifest.logo.path, casa))), manifest.logo.sha256, 'Logo is reused without alteration');
});

test('basket occupies the previous hive site, moves the hive four metres behind and preserves the jetpack dock', () => {
  near(LOLLIPOP_BASKET_PLACEMENT.x * WORLD_SCALE, -4);
  near(LOLLIPOP_BASKET_PLACEMENT.z, LANDING_Z - 9 / WORLD_SCALE);
  near(ARRIVAL_PICKUP_ANCHOR.x, LOLLIPOP_BASKET_PLACEMENT.x);
  near(BEEHIVE_PLACEMENT.x, LOLLIPOP_BASKET_PLACEMENT.x);
  near((LOLLIPOP_BASKET_PLACEMENT.z - BEEHIVE_PLACEMENT.z) * WORLD_SCALE, 4);
  const approachLength = Math.hypot(4, 9);
  near(JETPACK_PLACEMENT.x * WORLD_SCALE, -4 + 4 / approachLength * 2.7);
  near(JETPACK_PLACEMENT.z * WORLD_SCALE, LANDING_Z * WORLD_SCALE - 9 + 9 / approachLength * 2.7);
  const registration = WORLD_CONTENT.find(item => item.id === 'lollipop-basket');
  assert.equal(registration.root, 'LollipopBasket');
  assert.equal(registration.zone, 'outdoor:arrival');
  assert.equal(registration.kind, 'structure', 'Interactive basket remains resident');
});

test('permanent basket hull and pickup target survive batching independently of woven visual geometry', () => {
  const garden = new Group(); garden.scale.setScalar(WORLD_SCALE);
  const root = createLollipopBasketRoot(scene.clone(true)); root.userData.ready = true; garden.add(root);
  garden.updateMatrixWorld(true);
  const size = new Box3().setFromObject(root).getSize(new Vector3());
  near(size.y, manifest.output.bounds.max[1], 1e-4);
  const source = captureCollisionSource(root);
  assert.equal(source.length, 1, 'Woven ribbons, logos and candy sticks never enter physics');
  assert.equal(source[0].name, 'LollipopBasket_Physics');
  const collisions = new CollisionWorld().addSource(source, root.matrixWorld).build();
  const triangles = collisions.stats.triangles;
  assert.ok(triangles > 0 && triangles < 200);
  const eye = root.localToWorld(new Vector3(0, 2, 2.2));
  const equipment = createLollipopEquipment();
  const pickup = createLollipopPickup({ equipment, getBasket: () => root, getEye: () => eye,
    isBlocked: () => false, hasLineOfSight: (from, to) => collisions.hasLineOfSight(from, to) });
  assert.equal(pickup.available(), true, 'Basket rim does not occlude candy-height target');
  const hullPoint = root.localToWorld(new Vector3(0, .3, -1));
  assert.equal(collisions.hasLineOfSight(root.localToWorld(new Vector3(0, .3, 1)), hullPoint), false, 'Hull is solid');
  const matrix = root.matrixWorld.clone();
  batchStaticArchitecture(garden, Infinity); instanceStaticMeshes(garden);
  garden.updateMatrixWorld(true);
  assert.equal(garden.getObjectByName('LollipopBasket'), root);
  assert.ok(root.matrixWorld.equals(matrix));
  assert.equal(collisions.stats.triangles, triangles);
  assert.equal(pickup.collect(), true);
  assert.equal(root.visible, true);
  assert.equal(pickup.collect(), false);
});
