import test from 'node:test';
import assert from 'node:assert/strict';
import { createGamepadReader } from '../src/player/gamepad.mjs';

function controller() {
  return { index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
}

test('sticks have a dead zone and preserve proportional movement', () => {
  const { read } = createGamepadReader(), pad = controller();
  pad.axes = [.1, -.1, .1, 0];
  assert.deepEqual(read([pad], { dt: .02 }).move,
    { forward: 0, back: 0, left: 0, right: 0, run: false, up: false, down: false });
  pad.axes = [0, -.59, 1, 0];
  const frame = read([pad], { dt: .02 });
  assert.ok(Math.abs(frame.move.forward - .5) < 1e-10);
  pad.axes = [1, -1, 0, 0];
  const { forward, right } = read([pad], { dt: .02 }).move;
  assert.ok(Math.abs(Math.hypot(forward, right) - 1) < 1e-10);
  pad.axes = [0, 1, 0, 0];
  assert.equal(read([pad], { dt: .02 }).select, 1);
  assert.equal(read([pad], { dt: .02 }).select, 0);
  pad.axes = [-1, 0, 0, 0];
  assert.equal(read([pad], { dt: .02 }).select, -1);
});

test('action fires once per press and flight controls stay separate', () => {
  const { read } = createGamepadReader(), pad = controller();
  const ground = { dt: .02, jetpackCollected: false };
  const flight = { dt: .02, jetpackCollected: true, jetpack: true };
  pad.buttons[5].pressed = true;
  const sprint = read([pad], ground);
  assert.equal(sprint.action, false);
  assert.equal(sprint.move.run, true);
  pad.buttons[0].pressed = true;
  assert.equal(read([pad], ground).action, true);
  assert.equal(read([pad], ground).action, false);
  pad.buttons[0].pressed = false;
  pad.buttons[7].value = .8;
  assert.equal(read([pad], ground).action, true);
  assert.equal(read([pad], flight).move.up, true);
  pad.buttons[7].value = 0;
  pad.buttons[6].pressed = true;
  assert.equal(read([pad], flight).move.down, true);
  pad.buttons[4].pressed = true;
  const toggle = read([pad], flight);
  assert.equal(toggle.toggleJetpack, true);
  assert.equal(toggle.action, false);
  assert.equal(read([pad], flight).toggleJetpack, false);
  assert.equal(read([null], flight), null);
});

test('gamepad look integrates consistently, slows small movements and caps slow-frame turns', () => {
  const pad = controller();
  const turn = (dt, frames, axis) => {
    const { read } = createGamepadReader();
    pad.axes[2] = axis;
    let angle = 0;
    for (let i = 0; i < frames; i++) angle += read([pad], { dt }).lookX;
    return angle;
  };
  const turn60 = turn(1 / 60, 60, 1);
  assert.ok(Math.abs(turn(1 / 120, 120, 1) - turn60) < 1e-9);
  assert.ok(Math.abs(turn(1 / 30, 30, 1) - turn60) < 1e-9);
  assert.ok(turn(1 / 60, 60, .59) < turn60 * .4);
  assert.equal(turn(.2, 1, 1), turn(1 / 30, 1, 1));
});

test('gamepad look brakes on release and clears residual rotation when interrupted', () => {
  const { read, resetLook } = createGamepadReader(), pad = controller();
  const dt = 1 / 60;
  pad.axes[2] = 1;
  for (let i = 0; i < 20; i++) read([pad], { dt });
  const turning = read([pad], { dt }).lookX;
  pad.axes[2] = 0;
  const braking = read([pad], { dt }).lookX;
  assert.ok(braking > 0 && braking < turning);
  assert.ok(read([pad], { dt }).lookX < braking);
  resetLook();
  assert.equal(read([pad], { dt }).lookX, 0);
  pad.axes[2] = 1;
  read([pad], { dt });
  assert.equal(read([pad], { dt, lookEnabled: false }).lookX, 0);
  pad.axes[2] = 0;
  assert.equal(read([pad], { dt }).lookX, 0);
});
