import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, OrthographicCamera, PerspectiveCamera, Sphere, Vector3 } from 'three';
import { createPondQuality, pondDeviceLevel, POND_LEVELS } from '../src/rooms/pondQuality.mjs';

function setup(deviceLevel = 3) {
  const root = new Group(), camera = new PerspectiveCamera(75, 1, .1, 2000);
  camera.position.z = 10;
  const steps = [], levels = [];
  const controller = createPondQuality({ root, localBounds: new Sphere(new Vector3(), 3), deviceLevel,
    onStep: (seconds, dt, level) => steps.push({ seconds, dt, level }),
    onLevel: (level, profile) => levels.push({ level, profile }) });
  const tick = (seconds, options) => controller.tick(seconds, camera, 720, options);
  return { root, camera, controller, steps, levels, tick };
}

test('device hints select analytical low-end, bounded mobile and desktop simulation', () => {
  assert.equal(pondDeviceLevel({}), 2);
  assert.equal(pondDeviceLevel({ hardwareConcurrency: 4 }), 1);
  assert.equal(pondDeviceLevel({ hardwareConcurrency: 16, deviceMemory: 4 }), 1);
  assert.equal(pondDeviceLevel({ hardwareConcurrency: 8, userAgent: 'Android' }), 2);
  assert.equal(pondDeviceLevel({ hardwareConcurrency: 12, maxTouchPoints: 5 }), 2);
  assert.equal(pondDeviceLevel({ hardwareConcurrency: 8, deviceMemory: 8 }), 3);
  assert.deepEqual(POND_LEVELS.map(p => [p.hz, p.simulationSize]), [[0, 0], [10, 0], [15, 64], [30, 128]]);
});

test('every device is capped at its update rate, also on high-refresh-rate displays', () => {
  for (const fps of [60, 90, 120, 144]) {
    for (const level of [1, 2, 3]) {
      const s = setup(level);
      for (let frame = 0; frame < fps * 2; frame++) s.tick(frame / fps);
      assert.equal(s.controller.state.level, level);
      assert.equal(s.steps.length, POND_LEVELS[level].hz * 2, `${fps}fps, level ${level}`);
      assert.ok(s.steps.every(step => step.dt === POND_LEVELS[level].fixedDt));
      assert.equal(s.controller.state.simulationUpdates, level > 1 ? s.steps.length : 0);
    }
  }
});

test('far, tiny, offscreen, hidden, and disabled water perform no work; partial visibility stays active', () => {
  const s = setup();
  assert.equal(s.tick(0), true);
  s.camera.position.z = 200; assert.equal(s.tick(1), false);
  s.camera.position.z = 10; s.camera.rotation.y = Math.PI; assert.equal(s.tick(2), false);
  s.camera.rotation.y = 0;
  assert.equal(s.controller.tick(3, s.camera, 10), false);
  s.root.visible = false; assert.equal(s.tick(4), false);
  s.root.visible = true; assert.equal(s.tick(5, { enabled: false }), false);
  const parent = new Group(); parent.add(s.root); parent.visible = false;
  assert.equal(s.tick(6), false);
  assert.equal(s.steps.length, 1);
  parent.visible = true;
  s.root.position.x = 8;
  assert.equal(s.tick(7), true, 'surface crossing the viewport edge remains active');
  s.root.position.x = 30;
  assert.equal(s.tick(8), false);
});

test('intermediate distance becomes analytic and spatial hysteresis avoids rapid simulation changes', () => {
  const s = setup();
  s.tick(0);
  assert.equal(s.controller.state.level, 3);
  s.camera.position.z = 16; s.tick(1);
  assert.equal(s.controller.state.level, 3, 'high detail retains its wider exit range');
  s.camera.position.z = 18; s.tick(2);
  assert.equal(s.controller.state.level, 2);
  s.camera.position.z = 16; s.tick(3);
  assert.equal(s.controller.state.level, 2, 'entering high detail requires getting closer');
  s.camera.position.z = 31; s.tick(4);
  assert.equal(s.controller.state.level, 1);
  const simulationSteps = s.controller.state.simulationUpdates;
  for (let frame = 0; frame < 120; frame++) s.tick(5 + frame / 60);
  assert.equal(s.controller.state.simulationUpdates, simulationSteps);
  assert.equal(s.steps.at(-1).level, 1);
});

test('world transforms and a parented camera control distance and projected footprint', () => {
  const s = setup();
  const world = new Group(), rig = new Group();
  world.scale.setScalar(5); world.position.set(40, 20, -100); world.add(s.root);
  rig.position.copy(world.position); rig.add(s.camera); s.camera.position.z = 35;
  s.tick(0);
  assert.equal(s.controller.state.level, 3);
  assert.equal(s.controller.state.distance, 20);
  assert.ok(s.controller.state.pixels > 220);
  world.position.x += 100;
  s.tick(1);
  assert.equal(s.controller.state.level, 0, 'the controller follows the interpolated root transform');
});

test('orthographic screen footprint does not shrink with camera distance', () => {
  const s = setup();
  const camera = new OrthographicCamera(-10, 10, 10, -10, .1, 1000);
  camera.position.z = 10;
  s.controller.tick(0, camera, 720);
  const pixels = s.controller.state.pixels;
  camera.position.z = 40;
  s.controller.tick(1, camera, 720);
  assert.equal(s.controller.state.pixels, pixels);
  assert.equal(s.controller.state.level, 1, 'distance still prevents distant simulation');
});

test('live reduced motion is static, and missing RTT support caps work to analytic updates', () => {
  const s = setup();
  s.tick(0);
  assert.equal(s.tick(.01, { reducedMotion: true }), false);
  assert.equal(s.controller.state.level, 1);
  assert.equal(s.tick(100, { reducedMotion: true }), false);
  assert.equal(s.steps.length, 1);
  assert.equal(s.tick(101, { reducedMotion: false, simulationSupported: false }), true);
  assert.equal(s.controller.state.level, 1);
  assert.equal(s.controller.state.simulationUpdates, 1);
  assert.equal(s.tick(102, { simulationSupported: true }), true);
  assert.equal(s.controller.state.level, 3);
});

test('resume, clock resets and slow frames never trigger catch-up steps or unbounded dt', () => {
  const s = setup();
  s.tick(0);
  assert.equal(s.tick(0), false, 'the same animation timestamp cannot step twice');
  s.tick(.01, { enabled: false });
  s.tick(1000);
  assert.equal(s.steps.length, 2);
  assert.equal(s.steps.at(-1).dt, 1 / 30);
  s.tick(1001);
  assert.equal(s.steps.length, 3);
  s.tick(0);
  assert.equal(s.steps.length, 4);
  assert.equal(s.tick(NaN), false);
  assert.equal(s.tick(Infinity), false);
  assert.equal(s.controller.state.budgetLevel, 3);
});

test('mixed sustained poor frames lower quality to analytic and recovery is slow and gradual', () => {
  const s = setup();
  let seconds = 0;
  s.tick(seconds);
  for (let frame = 0; frame < 130; frame++) s.tick(seconds += frame % 3 === 0 ? 1 / 60 : .055);
  assert.equal(s.controller.state.budgetLevel, 2, 'isolated fast frames do not erase overload history');
  for (let frame = 0; frame < 170; frame++) s.tick(seconds += frame % 3 === 0 ? 1 / 60 : .055);
  assert.equal(s.controller.state.budgetLevel, 1);
  assert.equal(s.controller.state.level, 1);
  const simulationSteps = s.controller.state.simulationUpdates;
  for (let frame = 0; frame < 120; frame++) s.tick(seconds += 1 / 60);
  assert.equal(s.controller.state.budgetLevel, 1, 'two seconds of good frames cannot undo a downgrade');
  assert.equal(s.controller.state.simulationUpdates, simulationSteps);
  for (let frame = 0; frame < 900; frame++) s.tick(seconds += 1 / 60);
  assert.equal(s.controller.state.budgetLevel, 2);
  for (let frame = 0; frame < 1020; frame++) s.tick(seconds += 1 / 60);
  assert.equal(s.controller.state.budgetLevel, 3);
});

test('inactive time and resume gaps neither punish nor restore the adaptive budget', () => {
  const s = setup();
  let seconds = 0; s.tick(seconds);
  for (let frame = 0; frame < 100; frame++) s.tick(seconds += .05);
  assert.equal(s.controller.state.budgetLevel, 2);
  for (let frame = 0; frame < 100; frame++) s.tick(seconds += 1, { enabled: false });
  s.tick(seconds += 1000);
  assert.equal(s.controller.state.budgetLevel, 2);
  assert.equal(s.steps.at(-1).dt, 1 / 15);
  assert.equal(s.levels[0].level, 0);
  assert.ok(s.levels.every(({ level, profile }) => profile === POND_LEVELS[level]));
});
