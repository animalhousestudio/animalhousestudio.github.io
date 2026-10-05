import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Sphere, Texture, Vector3 } from 'three';
import { createLodLoader, createVisualLod, disposeVisualObject } from '../src/world/visualLod.mjs';

const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function model(name, geometry = new BoxGeometry(), material = new MeshBasicMaterial()) {
  const mesh = new Mesh(geometry, material); mesh.name = name;
  return mesh;
}
function setup(overrides = {}) {
  const root = new Group(), camera = new PerspectiveCamera(90, 1, .1, 10000), calls = [];
  camera.position.z = 100;
  const levels = ['far', 'mid', 'near'].map((id, index) => ({ id, minPixels: index * 100,
    load: async () => { calls.push(id); return model(id); } }));
  const controller = createVisualLod({ root, bounds: new Sphere(new Vector3(), 1), levels,
    hysteresis: .1, unloadAfter: 10, ...overrides });
  return { root, camera, calls, controller };
}
function atPixels(camera, pixels) { camera.position.z = 1000 / pixels; }
function visibleLevels(controller) { return controller.state.levels.filter(level => level.node?.visible).map(level => level.id); }

test('boot loads only resident detail and leaves collider siblings and transforms intact', async () => {
  const { root, controller, calls } = setup();
  const collider = model('IndependentCollider'); root.add(collider);
  await controller.ready;
  assert.deepEqual(calls, ['far']);
  assert.deepEqual(visibleLevels(controller), ['far']);
  assert.equal(controller.object, controller.state.levels[0].node);
  assert.equal(collider.parent, root);
  assert.equal(collider.visible, true);
  assert.equal(root.matrixAutoUpdate, true);
  assert.equal(root.userData.streamingBoundary, true);
  assert.equal(controller.state.levels[0].node.parent.userData.collisionDisabled, true);
  controller.dispose();
  assert.equal(collider.parent, root);
  assert.equal(controller.object, null);
});

test('approach loads progressively, deduplicates requests and shows exactly one ready tier', async () => {
  const mid = deferred(), near = deferred(), calls = [];
  const { camera, controller } = setup({ levels: [
    { id: 'far', minPixels: 0, load: async () => model('far') },
    { id: 'mid', minPixels: 100, load: () => { calls.push('mid'); return mid.promise; } },
    { id: 'near', minPixels: 200, load: () => { calls.push('near'); return near.promise; } },
  ] });
  await controller.ready;
  atPixels(camera, 250);
  for (let i = 0; i < 20; i++) controller.update(i / 60, camera, 1000);
  await flush();
  assert.deepEqual(calls, ['mid']);
  assert.deepEqual(visibleLevels(controller), ['far']);
  mid.resolve(model('mid')); await flush();
  assert.deepEqual(calls, ['mid', 'near']);
  assert.deepEqual(visibleLevels(controller), ['mid']);
  near.resolve(model('near')); await flush();
  assert.deepEqual(visibleLevels(controller), ['near']);
  assert.equal(controller.state.targetLevel, 'near');
  controller.dispose();
});

test('hysteresis holds detail across threshold jitter in both directions', async () => {
  const { camera, controller } = setup(); await controller.ready;
  atPixels(camera, 105); controller.update(1, camera, 1000); await flush();
  assert.equal(controller.state.targetLevel, 'far');
  atPixels(camera, 112); controller.update(2, camera, 1000); await flush();
  assert.equal(controller.state.activeLevel, 'mid');
  atPixels(camera, 95); controller.update(3, camera, 1000);
  assert.equal(controller.state.activeLevel, 'mid');
  atPixels(camera, 88); controller.update(4, camera, 1000);
  assert.equal(controller.state.activeLevel, 'far');
  atPixels(camera, 105); controller.update(5, camera, 1000);
  assert.equal(controller.state.activeLevel, 'far');
  controller.dispose();
});

test('fixed bounds include parent transforms, parented camera, viewport and FOV', async () => {
  const { root, camera, controller } = setup({ hysteresis: 0 }); await controller.ready;
  const world = new Group(); world.scale.setScalar(2); world.position.x = 10; world.add(root);
  const rig = new Group(); rig.position.x = 10; rig.add(camera); camera.position.z = 20;
  controller.update(1, camera, 1000); await flush();
  assert.ok(Math.abs(controller.state.projectedPixels - 100) < 1e-6);
  camera.fov = 60; camera.updateProjectionMatrix();
  controller.update(2, camera, 1000);
  assert.ok(Math.abs(controller.state.projectedPixels - 173.20508075688775) < 1e-6);
  controller.update(3, camera, 500);
  assert.ok(Math.abs(controller.state.projectedPixels - 86.60254037844388) < 1e-6);
  // Loaded detail dimensions never become the basis of future selection.
  controller.state.levels[0].node.scale.setScalar(1000);
  controller.update(4, camera, 500);
  assert.ok(Math.abs(controller.state.projectedPixels - 86.60254037844388) < 1e-6);
  controller.dispose();
});

test('offscreen, disabled and hidden roots do not request optional assets', async () => {
  const { root, camera, controller, calls } = setup(); await controller.ready;
  camera.position.set(0, 0, -3);
  controller.update(1, camera, 1000); await flush();
  assert.equal(controller.state.inFrustum, false);
  atPixels(camera, 500); controller.update(2, camera, 1000, { enabled: false }); await flush();
  const parent = new Group(); parent.visible = false; parent.add(root);
  controller.update(3, camera, 1000); await flush();
  assert.deepEqual(calls, ['far']);
  parent.visible = true;
  controller.update(4, camera, 1000); await flush();
  assert.deepEqual(calls, ['far', 'mid', 'near']);
  controller.dispose();
});

test('shared queue caps concurrent work and cancels obsolete queued optional loads', async () => {
  const loader = createLodLoader({ concurrency: 1 }), gate = deferred();
  const { controller, camera, calls } = setup({ loader }); await controller.ready;
  const occupying = loader.run(() => gate.promise);
  atPixels(camera, 250); controller.update(1, camera, 1000); await flush();
  assert.equal(loader.state.active, 1);
  assert.equal(loader.state.pending, 1);
  camera.position.z = -3; controller.update(2, camera, 1000);
  gate.resolve(); await occupying; await flush();
  assert.deepEqual(calls, ['far']);
  assert.equal(controller.state.levels[1].attempts, 0);
  assert.equal(loader.state.active, 0);
  controller.dispose();
});

test('failed fine tier keeps fallback, retries only after delay and stops at its limit', async () => {
  let failures = 0;
  const { controller, camera } = setup({ retryDelay: 5, maxRetries: 1, levels: [
    { id: 'far', minPixels: 0, load: async () => model('far') },
    { id: 'near', minPixels: 100, load: async () => { failures++; throw new Error('offline'); } },
  ] });
  await controller.ready; atPixels(camera, 200);
  controller.update(1, camera, 1000); await flush();
  assert.equal(controller.state.activeLevel, 'far');
  for (let i = 0; i < 100; i++) controller.update(2, camera, 1000);
  await flush(); assert.equal(failures, 1);
  controller.update(6, camera, 1000); await flush(); assert.equal(failures, 2);
  controller.update(100, camera, 1000); await flush(); assert.equal(failures, 2);
  assert.match(controller.state.levels[1].error.message, /offline/);
  controller.dispose();
});

test('resident failure rejects ready for the boot error screen', async () => {
  const { controller } = setup({ levels: [{ id: 'far', minPixels: 0, load: async () => { throw new Error('base unavailable'); } }] });
  await assert.rejects(controller.ready, /base unavailable/);
  assert.equal(controller.state.activeLevel, null);
  controller.dispose();
});

test('leaving detail unloads after timeout, deduplicates disposal and preserves resident shared resources', async () => {
  const texture = new Texture(), sharedMaterial = new MeshBasicMaterial({ map: texture });
  const sharedGeometry = new BoxGeometry(), optionalGeometry = new BoxGeometry();
  const counts = { texture: 0, material: 0, geometry: 0, optional: 0 };
  for (const [resource, name] of [[texture, 'texture'], [sharedMaterial, 'material'], [sharedGeometry, 'geometry'], [optionalGeometry, 'optional']]) {
    resource.addEventListener('dispose', () => counts[name]++);
  }
  const { controller, camera } = setup({ levels: [
    { id: 'far', minPixels: 0, load: async () => model('far', sharedGeometry, sharedMaterial) },
    { id: 'near', minPixels: 100, load: async () => {
      const group = new Group();
      group.add(model('shared', sharedGeometry, sharedMaterial), model('extra', optionalGeometry, sharedMaterial), model('duplicate', optionalGeometry, sharedMaterial));
      return group;
    } },
  ] });
  await controller.ready; atPixels(camera, 200); controller.update(1, camera, 1000); await flush();
  atPixels(camera, 10); controller.update(2, camera, 1000);
  assert.equal(controller.state.activeLevel, 'far');
  controller.update(11, camera, 1000);
  assert.equal(controller.state.levels[1].status, 'loaded');
  controller.update(12, camera, 1000);
  assert.equal(controller.state.levels[1].node, null);
  assert.deepEqual(counts, { texture: 0, material: 0, geometry: 0, optional: 1 });
  controller.dispose(); controller.dispose();
  assert.deepEqual(counts, { texture: 1, material: 1, geometry: 1, optional: 1 });
});

test('cross-controller shared resources survive until their last resident owner disposes', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  let disposed = 0; geometry.addEventListener('dispose', () => disposed++);
  const levels = [{ id: 'far', minPixels: 0, load: async () => model('shared', geometry, material) }];
  const a = setup({ levels }).controller, b = setup({ levels }).controller;
  await Promise.all([a.ready, b.ready]);
  a.dispose(); assert.equal(disposed, 0);
  b.dispose(); assert.equal(disposed, 1);
});

test('late async arrivals are released and never attached after controller disposal', async () => {
  const pending = deferred(), { controller, camera, root } = setup({ levels: [
    { id: 'far', minPixels: 0, load: async () => model('far') },
    { id: 'near', minPixels: 100, load: () => pending.promise },
  ] });
  await controller.ready; atPixels(camera, 200); controller.update(1, camera, 1000); await flush();
  const late = model('late'); let disposed = 0; late.geometry.addEventListener('dispose', () => disposed++);
  controller.dispose(); pending.resolve(late); await flush();
  assert.equal(disposed, 1);
  assert.equal(root.children.length, 0);
  assert.equal(late.parent, null);
  assert.equal(controller.state.activeLevel, null);
});

test('evicted optional detail can be loaded on a later visit', async () => {
  const { controller, camera, calls } = setup({ unloadAfter: 0 }); await controller.ready;
  atPixels(camera, 130); controller.update(1, camera, 1000); await flush();
  atPixels(camera, 10); controller.update(2, camera, 1000);
  atPixels(camera, 130); controller.update(3, camera, 1000); await flush();
  assert.deepEqual(calls, ['far', 'mid', 'mid']);
  assert.equal(controller.state.activeLevel, 'mid');
  controller.dispose();
});

test('a completed optional load cannot restore detail after leaving its zone', async () => {
  const pending = deferred();
  const { controller, camera } = setup({ unloadAfter: 2, levels: [
    { id: 'far', minPixels: 0, load: async () => model('far') },
    { id: 'near', minPixels: 100, load: () => pending.promise },
  ] });
  await controller.ready; atPixels(camera, 200); controller.update(1, camera, 1000); await flush();
  camera.position.z = -3; controller.update(2, camera, 1000);
  controller.update(5, camera, 1000);
  const late = model('obsolete'); let disposed = 0;
  late.geometry.addEventListener('dispose', () => disposed++);
  pending.resolve(late); await flush();
  assert.equal(controller.object.name, 'far');
  assert.equal(controller.state.levels[1].node, null);
  assert.equal(disposed, 1);
  controller.dispose();
});

test('failed preparation cleanup releases its own resources but retains shared resident resources', async () => {
  const material = new MeshBasicMaterial(), geometry = new BoxGeometry(), failedGeometry = new BoxGeometry();
  let sharedDisposed = 0, failedDisposed = 0;
  material.addEventListener('dispose', () => sharedDisposed++);
  failedGeometry.addEventListener('dispose', () => failedDisposed++);
  const { controller } = setup({ levels: [{ id: 'far', minPixels: 0, load: async () => model('resident', geometry, material) }] });
  await controller.ready;
  const failed = model('failed preparation', failedGeometry, material);
  disposeVisualObject(failed);
  assert.equal(failedDisposed, 1);
  assert.equal(sharedDisposed, 0);
  assert.equal(controller.object.visible, true);
  controller.dispose();
  assert.equal(sharedDisposed, 1);
});
