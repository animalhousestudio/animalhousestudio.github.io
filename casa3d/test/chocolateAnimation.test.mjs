import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Matrix4, PerspectiveCamera, Sphere, Vector3 } from 'three';
import { addAnimatedChocolateDrops, chocolateDeviceLevel, CHOCOLATE_LEVELS,
  createChocolateController } from '../src/rooms/chocolateAnimation.mjs';

function setup(deviceLevel = 4) {
  const root = new Group(), camera = new PerspectiveCamera(75, 1, .1, 1000);
  camera.position.z = 12;
  const calls = [], levels = [];
  const controller = createChocolateController({ root, localBounds: new Sphere(new Vector3(), 3), deviceLevel,
    update: (seconds, detail) => calls.push({ seconds, detail }), setLevel: level => levels.push(level) });
  const tick = (seconds, options) => controller.tick(seconds, camera, 720, options);
  return { root, camera, controller, calls, levels, tick };
}

test('device hints are conservative, including touch tablets with desktop user agents', () => {
  assert.equal(chocolateDeviceLevel({}), 3);
  assert.equal(chocolateDeviceLevel({ hardwareConcurrency: 4 }), 2);
  assert.equal(chocolateDeviceLevel({ hardwareConcurrency: 16, deviceMemory: 4 }), 2);
  assert.equal(chocolateDeviceLevel({ hardwareConcurrency: 8, userAgent: 'Android' }), 3);
  assert.equal(chocolateDeviceLevel({ hardwareConcurrency: 8, maxTouchPoints: 5 }), 3);
  assert.equal(chocolateDeviceLevel({ hardwareConcurrency: 8, deviceMemory: 8 }), 4);
});

test('near animation is capped at 30 Hz, including high-refresh-rate displays', () => {
  for (const fps of [60, 120, 144]) {
    const s = setup();
    for (let frame = 0; frame < fps * 2; frame++) s.tick(frame / fps);
    assert.equal(s.controller.state.level, 4);
    assert.ok(s.calls.length >= 59 && s.calls.length <= 61, `${fps} Hz: ${s.calls.length} updates`);
  }
  const low = setup(2);
  for (let frame = 0; frame < 120; frame++) low.tick(frame / 60);
  assert.equal(low.calls.length, 40);
  assert.equal(low.calls[0].detail.rings, 0);
});

test('far, out of view, hidden parents, loading and reduced motion stop all updates', () => {
  const s = setup();
  s.tick(0);
  s.camera.position.z = 100; s.tick(1);
  s.camera.position.z = 12; s.camera.rotation.y = Math.PI; s.tick(2);
  s.camera.rotation.y = 0; s.root.visible = false; s.tick(3);
  s.root.visible = true; s.tick(4, { enabled: false });
  s.tick(5, { reducedMotion: true });
  const parent = new Group(); parent.add(s.root); parent.visible = false; s.tick(6);
  assert.equal(s.calls.length, 1);
  assert.equal(s.controller.state.level, 0);
  parent.visible = true; s.tick(1000);
  assert.equal(s.calls.length, 2, 'resume performs one update, with no catch-up loop');
  assert.equal(s.calls.at(-1).seconds, 1000);
});

test('mid-distance uses flow only and hysteresis prevents threshold flicker', () => {
  const s = setup();
  s.tick(0);
  s.camera.position.z = 28; s.tick(1);
  assert.equal(s.controller.state.level, 4);
  s.camera.position.z = 30; s.tick(2);
  assert.equal(s.controller.state.level, 1);
  assert.equal(s.calls.at(-1).detail.drops, 0);
  s.camera.position.z = 28; s.tick(3);
  assert.equal(s.controller.state.level, 1);
  s.camera.position.z = 20; s.tick(4);
  assert.equal(s.controller.state.level, 4);
});

test('world scaling, parented cameras, screen size and partial visibility are respected', () => {
  const s = setup();
  const world = new Group(), rig = new Group();
  world.scale.setScalar(5); world.position.x = 40; world.add(s.root);
  rig.position.x = 40; rig.add(s.camera);
  s.camera.position.z = 24; s.tick(0);
  assert.equal(s.controller.state.level, 4);
  s.root.position.x = 3.8; s.tick(1);
  assert.ok(s.controller.state.level > 0, 'partly visible sphere stays active');
  s.root.position.x = 0;
  s.controller.tick(2, s.camera, 10);
  assert.equal(s.controller.state.level, 0, 'tiny screen footprint does not animate');
});

test('sustained slow frames lower quality, recovery is gradual, resume gaps are ignored', () => {
  const s = setup();
  let seconds = 0; s.tick(seconds);
  for (let i = 0; i < 55; i++) s.tick(seconds += .04);
  assert.equal(s.controller.state.budgetLevel, 3);
  for (let i = 0; i < 55; i++) s.tick(seconds += .04);
  assert.equal(s.controller.state.budgetLevel, 2);
  s.tick(seconds += 100);
  assert.equal(s.controller.state.budgetLevel, 2);
  for (let i = 0; i < 490; i++) s.tick(seconds += 1 / 60);
  assert.equal(s.controller.state.budgetLevel, 3);
  for (let i = 0; i < 490; i++) s.tick(seconds += 1 / 60);
  assert.equal(s.controller.state.budgetLevel, 4);
});

test('particle draw budgets, fixed culling bounds, and uploads match the chosen detail', () => {
  const particles = addAnimatedChocolateDrops(new Group());
  const matrix = new Matrix4(), position = new Vector3(), scale = new Vector3();
  const versions = [particles.drops.instanceMatrix.version, particles.rings.instanceMatrix.version];
  particles.update(0, CHOCOLATE_LEVELS[1]);
  assert.deepEqual([particles.drops.instanceMatrix.version, particles.rings.instanceMatrix.version], versions);
  for (let level = 0; level <= 4; level++) {
    particles.setLevel(level);
    const detail = CHOCOLATE_LEVELS[level];
    assert.equal(particles.drops.count, detail.drops * 4);
    assert.equal(particles.rings.count, detail.rings * 4);
    for (let frame = 0; frame < 120; frame++) {
      particles.update(frame / 60, detail);
      for (const mesh of [particles.drops, particles.rings]) {
        assert.equal(mesh.frustumCulled, true);
        assert.equal(mesh.visible, mesh.count > 0);
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          position.setFromMatrixPosition(matrix); scale.setFromMatrixScale(matrix);
          assert.ok(Number.isFinite(matrix.determinant()));
          assert.ok(position.distanceTo(mesh.boundingSphere.center) + Math.max(scale.x, scale.y, scale.z) * 1.05
            < mesh.boundingSphere.radius, 'bounds cover the full moving instance');
        }
      }
    }
  }
});
