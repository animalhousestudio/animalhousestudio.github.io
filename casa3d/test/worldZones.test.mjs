import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PerspectiveCamera, Vector3 } from 'three';
import { WORLD_ZONE_CATALOG, WORLD_ZONE_IDS as ZONE } from '../src/world/catalog.mjs';
import { createWorldZones } from '../src/world/zones.mjs';
import { batchStaticArchitecture, instanceStaticMeshes, partitionInstances } from '../src/rooms/optimize.mjs';
import { BASE_FLOOR_Y, WORLD_SCALE } from '../src/rooms/layout.mjs';

const material = new MeshStandardMaterial();
function box(parent, size = [1, 1, 1]) {
  const geometry = new BoxGeometry(...size); geometry.clearGroups();
  const mesh = new Mesh(geometry, material);
  parent.add(mesh);
  return mesh;
}
function camera() {
  const view = new PerspectiveCamera(60, 1, .1, 1000);
  view.lookAt(0, 0, -1);
  return view;
}

test('zone catalog has stable outdoor/floor identities and explicit model-local units', () => {
  assert.equal(WORLD_ZONE_CATALOG.length, 10);
  assert.equal(new Set(WORLD_ZONE_CATALOG.map(zone => zone.id)).size, 10);
  for (const zone of WORLD_ZONE_CATALOG) {
    assert.equal(zone.coordinateSpace, 'model-local');
    assert.equal(zone.worldScale, WORLD_SCALE);
    assert.equal(zone.resident, true);
    assert.ok(Object.isFrozen(zone) && Object.isFrozen(zone.anchor));
  }
  for (const [index, id] of [ZONE.BASEMENT, ZONE.LIVING, ZONE.KITCHEN, ZONE.GALLERY, ZONE.OBSERVATORY].entries()) {
    assert.equal(WORLD_ZONE_CATALOG.find(zone => zone.id === id).anchor[1], BASE_FLOOR_Y[index]);
  }
});

test('registration preserves existing parent, transforms and content identity with world-scaled bounds', () => {
  const world = new Group(), content = new Group();
  world.scale.setScalar(WORLD_SCALE); world.add(content);
  content.position.set(3, 2, -4); box(content, [2, 2, 2]);
  world.updateMatrixWorld(true);
  const before = content.matrixWorld.clone(), zones = createWorldZones();
  const entry = zones.register(ZONE.GARDEN, content, { contentId: 'garden:flowers' });
  assert.equal(content.parent, world);
  assert.ok(content.matrixWorld.equals(before));
  assert.equal(content.userData.worldZone, ZONE.GARDEN);
  assert.equal(content.userData.streamingBoundary, true);
  assert.equal(content.userData.worldContentId, 'garden:flowers');
  assert.deepEqual(entry.bounds.min.toArray(), [10, 5, -25]);
  assert.deepEqual(entry.bounds.max.toArray(), [20, 15, -15]);
  assert.throws(() => zones.register('unknown', new Group()), /Unknown world zone/);
  assert.throws(() => zones.register(ZONE.GARDEN, content), /already registered/);
});

test('same material meshes in different zones retain identity through parent batching and instancing', () => {
  const world = new Group(), zones = createWorldZones();
  const geometry = new BoxGeometry(); geometry.clearGroups();
  const originals = [];
  for (const id of [ZONE.LIVING, ZONE.KITCHEN]) {
    const room = new Group(); world.add(room);
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(geometry, material); mesh.position.x = i; room.add(mesh);
      originals.push({ mesh, room });
    }
    zones.register(id, room);
  }
  assert.equal(instanceStaticMeshes(world), 0);
  assert.equal(batchStaticArchitecture(world), 0);
  for (const { mesh, room } of originals) {
    assert.equal(mesh.parent, room);
    assert.equal(room.parent, world);
    assert.equal(mesh.matrixAutoUpdate, true);
    assert.equal(room.matrixAutoUpdate, true);
  }
});

test('one boundary root can still optimize internally without losing its registration', () => {
  const world = new Group(), content = new Group(), zones = createWorldZones();
  world.add(content);
  for (let i = 0; i < 3; i++) box(content).position.x = i;
  zones.register(ZONE.ARRIVAL, content, { contentId: 'arrival:decoration', decorative: true });
  assert.equal(batchStaticArchitecture(content), 2);
  assert.equal(content.children.length, 1);
  assert.equal(content.parent, world);
  assert.equal(content.matrixAutoUpdate, true);
  assert.equal(content.userData.worldContentId, 'arrival:decoration');
  assert.equal(zones.entries[0].root, content);
});

test('boundary flags, controlled details, dynamic and excluded branches keep their transforms active', () => {
  const world = new Group(), excluded = [];
  for (const flag of ['worldZone', 'streamingBoundary', 'staticDetail', 'collisionDynamic', 'excluded']) {
    const content = new Group(); world.add(content);
    if (flag === 'excluded') excluded.push(content);
    else content.userData[flag] = flag === 'worldZone' ? ZONE.GARDEN : true;
    for (let i = 0; i < 3; i++) box(content);
  }
  batchStaticArchitecture(world, 10, excluded);
  for (const content of world.children) {
    assert.equal(content.matrixAutoUpdate, true);
    assert.equal(content.children.length, 3);
    for (const child of content.children) assert.equal(child.matrixAutoUpdate, true);
  }
});

test('unregistered static content retains the existing batching and instancing behavior', () => {
  const root = new Group(), geometry = new BoxGeometry(); geometry.clearGroups();
  for (let i = 0; i < 3; i++) root.add(new Mesh(geometry, material));
  assert.equal(instanceStaticMeshes(root), 2);
  assert.equal(root.children.length, 1);
  assert.ok(root.children[0].isInstancedMesh);
  const architecture = new Group(); box(architecture); box(architecture);
  assert.equal(batchStaticArchitecture(architecture), 1);
  assert.equal(architecture.children.length, 1);
});

test('frustum culling stays conservative across windows and never hides structural floors or walls', () => {
  const world = new Group(), zones = createWorldZones(), view = camera();
  const room = new Group(); world.add(room); room.position.z = -15;
  box(room, [4, 1, 4]);
  zones.register(ZONE.LIVING, room);
  const detail = new Group(); world.add(detail); detail.position.z = -15; box(detail);
  zones.register(ZONE.KITCHEN, detail, { decorative: true });
  const wideDetail = new Group(); world.add(wideDetail); wideDetail.position.set(10, 0, -10);
  box(wideDetail, [20, 1, 1]);
  zones.register(ZONE.GARDEN, wideDetail, { decorative: true, margin: 0 });
  zones.update(view);
  assert.equal(detail.visible, true, 'Content in another zone remains visible through a window');
  assert.equal(wideDetail.visible, true, 'Bounds intersecting the view survive even when their center is outside it');
  view.lookAt(0, 0, 1);
  zones.update(view);
  assert.equal(detail.visible, false);
  assert.equal(room.visible, true, 'Structural and walkable roots remain rendered');
  view.lookAt(0, 0, -1);
  zones.update(view);
  assert.equal(detail.visible, true);
});

test('distance thresholds use the nearest bounds surface rather than the content center', () => {
  const detail = new Group(); detail.position.set(100, 0, -20); box(detail, [200, 2, 2]);
  const zones = createWorldZones(), view = camera();
  zones.register(ZONE.ASTEROID, detail, { decorative: true, maxDistance: 30, margin: 0 });
  zones.update(view);
  assert.equal(detail.visible, true);
  view.position.z = 100;
  zones.update(view);
  assert.equal(detail.visible, false);
});

test('disabled culling restores only authored roots and leaves hidden children hidden', () => {
  const detail = new Group(); detail.position.z = 20;
  const hiddenChild = box(detail); hiddenChild.visible = false;
  const hiddenRoot = new Group(); hiddenRoot.visible = false; box(hiddenRoot);
  const zones = createWorldZones();
  zones.register(ZONE.GARDEN, detail, { decorative: true });
  zones.register(ZONE.GARDEN, hiddenRoot, { decorative: true });
  zones.update(camera());
  assert.equal(detail.visible, false);
  zones.update(camera(), { enabled: false });
  assert.equal(detail.visible, true);
  assert.equal(hiddenChild.visible, false);
  assert.equal(hiddenRoot.visible, false);
  zones.update(camera()); zones.update(null);
  assert.equal(detail.visible, true, 'Missing camera safely restores eligible decoration');
});

test('world bounds are cached and explicitly refreshed after placement or content changes', () => {
  const detail = new Group(); detail.position.z = -20; box(detail);
  const zones = createWorldZones(), view = camera();
  zones.register(ZONE.GARDEN, detail, { decorative: true });
  detail.position.z = 20;
  zones.update(view);
  assert.equal(detail.visible, true, 'The frame update does not traverse content to rebuild bounds');
  zones.refreshBounds(detail);
  zones.update(view);
  assert.equal(detail.visible, false);
  detail.position.z = -20; zones.refreshBounds(); zones.update(view);
  assert.equal(detail.visible, true);
  assert.ok(zones.entries[0].bounds.getCenter(new Vector3()).distanceTo(new Vector3(0, 0, -20)) < 1e-8);
});

test('instance cells retain their full extent when distant density drops before zone registration', () => {
  const source = new InstancedMesh(new BoxGeometry(1, 1, 1), material, 8);
  for (let index = 0; index < source.count; index++) source.setMatrixAt(index, new Matrix4().makeTranslation(index, 0, 0));
  const meadow = partitionInstances(source, 8), cell = meadow.children[0];
  const world = new Group(); world.scale.setScalar(WORLD_SCALE); world.add(meadow);
  assert.equal(meadow.children.length, 1);
  // The distant arrival camera can reduce count while other boot assets load.
  // Registration must retain all placements that can reappear when approached.
  cell.count = 1;
  const zones = createWorldZones();
  const entry = zones.register(ZONE.GARDEN, meadow, { decorative: true, margin: 0 });
  assert.equal(entry.bounds.min.x, -.5 * WORLD_SCALE);
  assert.equal(entry.bounds.max.x, 7.5 * WORLD_SCALE);
  cell.count = cell.userData.fullCount;
  zones.refreshBounds(meadow);
  assert.equal(entry.bounds.max.x, 7.5 * WORLD_SCALE, 'Restoring density keeps the same conservative bounds');
});

test('unregister restores root visibility and metadata without disposing or moving its content', () => {
  const parent = new Group(), detail = new Group(); parent.add(detail); detail.position.z = 20;
  const child = box(detail), zones = createWorldZones();
  detail.userData.worldContentId = 'authored';
  zones.register(ZONE.GARDEN, detail, { decorative: true, contentId: 'registered' });
  zones.update(camera()); assert.equal(detail.visible, false);
  assert.equal(zones.unregister(detail), true);
  assert.equal(detail.visible, true);
  assert.equal(detail.userData.worldContentId, 'authored');
  assert.equal(detail.userData.worldZone, undefined);
  assert.equal(detail.userData.streamingBoundary, undefined);
  assert.equal(detail.parent, parent); assert.equal(child.parent, detail);
  assert.equal(zones.entries.length, 0);
  assert.equal(zones.unregister(detail), false);
});
