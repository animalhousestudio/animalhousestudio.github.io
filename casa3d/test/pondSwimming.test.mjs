import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { Player } from '../src/player/movement.js';
import { createPondSwimming } from '../src/player/pondSwimming.mjs';
import { movementStateFromKeys } from '../src/player/input.mjs';
import { createPondLayout, getPondOutline } from '../src/rooms/pondLayout.mjs';
import { WORLD_SCALE, EYE_HEIGHT } from '../src/rooms/layout.mjs';

const layout = createPondLayout(new Box3(new Vector3(-100, -26, -100), new Vector3(100, 0, 100)));
const water = layout.waterY * WORLD_SCALE;
const center = new Vector3(layout.x * WORLD_SCALE, water, layout.z * WORLD_SCALE);
function makePlayer() {
  return new Player(new PerspectiveCamera(), null, {
    speed: 7.6,
    pondSwimming: createPondSwimming(layout, { worldScale: WORLD_SCALE }),
    groundHeightAt: (x, z) => (layout.floorAt(x / WORLD_SCALE, z / WORLD_SCALE) ?? 0) * WORLD_SCALE,
  });
}
const tick = (player, count, colliders = []) => { for (let i = 0; i < count; i++) player.update(1 / 60, colliders); };

test('walking down the bank enters water naturally and swimming bypasses terrain collision work', () => {
  const player = makePlayer(), edge = getPondOutline(layout)[0];
  player.setPosition(new Vector3((edge[0] + 1) * WORLD_SCALE, EYE_HEIGHT, edge[1] * WORLD_SCALE));
  player.yaw = -Math.PI / 2;
  player.setMoveState({ forward: true });
  for (let i = 0; i < 300 && !player.swimming; i++) player.update(1 / 60);
  assert.equal(player.swimming, true);
  const forbiddenWorld = { move() { assert.fail('Water movement must not query the terrain collision tree'); } };
  tick(player, 5, forbiddenWorld);
  assert.equal(player.jetpackThrusting, false);
});

test('diving reaches below the old respawn threshold and stops above the measured floor', () => {
  const player = makePlayer();
  player.setPosition(center.clone());
  player.setMoveState({ down: true });
  tick(player, 1100);
  assert.equal(player.swimming, true);
  assert.equal(player.underwater, true);
  assert.ok(player.camera.position.y < -40);
  const floor = layout.floorAt(layout.x, layout.z) * WORLD_SCALE;
  assert.ok(player.camera.position.y >= floor + player.colliderRadius);
  assert.ok(player.camera.position.y < floor + 1);
  player.setMoveState({ down: false });
  const restingDepth = player.camera.position.y;
  tick(player, 120);
  assert.ok(Math.abs(player.camera.position.y - restingDepth) < .01, 'No constant buoyancy drags a diver upwards');
});

test('looking down steers a swimmer and deep walls contain the body with jetpack enabled', () => {
  const player = makePlayer();
  player.setPosition(center.clone().setY(water - 20));
  player.enableJetpack();
  player.pitch = -.5;
  player.yaw = Math.PI / 2;
  player.setMoveState({ forward: true });
  tick(player, 40);
  assert.ok(player.camera.position.y < water - 20.5);
  player.pitch = 0;
  tick(player, 600);
  const p = player.camera.position, radius = player.colliderRadius;
  assert.equal(player.swimming, true);
  assert.equal(player.jetpackThrusting, false);
  for (const [dx, dz] of [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]]) {
    const floor = layout.floorAt((p.x + dx) / WORLD_SCALE, (p.z + dz) / WORLD_SCALE);
    assert.notEqual(floor, null);
    assert.ok(p.y >= floor * WORLD_SCALE + radius - .001);
  }
});

test('a swimmer can surface, stand up on the bank, and walk out without a respawn', () => {
  const player = makePlayer();
  player.setPosition(center.clone().setY(water - 3));
  player.setMoveState({ up: true });
  tick(player, 120);
  assert.ok(player.camera.position.y > water);
  assert.equal(player.underwater, false);
  player.setMoveState({ up: false, forward: true });
  player.yaw = Math.PI / 2;
  tick(player, 700);
  assert.equal(player.swimming, false);
  assert.equal(layout.contains(player.camera.position.x / WORLD_SCALE, player.camera.position.z / WORLD_SCALE), false);
  assert.ok(player.camera.position.y >= EYE_HEIGHT - .05);
});

test('far away players skip the pond profile entirely and teleporting clears water state', () => {
  let queries = 0;
  const measured = { ...layout, floorAt(x, z) { queries++; return layout.floorAt(x, z); } };
  const player = makePlayer();
  player.pondSwimming = createPondSwimming(measured, { worldScale: WORLD_SCALE });
  player.setPosition(new Vector3(50, EYE_HEIGHT, 50));
  assert.equal(player.pondSwimming.update(player, 1 / 60), false);
  assert.equal(queries, 0);
  player.setPosition(center.clone());
  player.update(1 / 60);
  assert.equal(player.swimming, true);
  player.setPosition(new Vector3(50, EYE_HEIGHT, 50));
  assert.equal(player.swimming, false);
  assert.equal(player.underwater, false);
});

test('keyboard and mobile-held key codes share vertical swim controls and respect input blocking', () => {
  const keys = new Set(['Space', 'KeyC', 'KeyW']);
  const swimming = movementStateFromKeys(keys, { swimming: true });
  assert.equal(swimming.up, true); assert.equal(swimming.down, true); assert.equal(swimming.forward, true);
  assert.equal(movementStateFromKeys(new Set(['Space']), { swimming: true }).forward, false);
  assert.equal(movementStateFromKeys(new Set(['ControlLeft']), { swimming: true }).down, true);
  assert.equal(movementStateFromKeys(new Set(['Space'])).forward, true);
  assert.equal(movementStateFromKeys(keys).up, false);
  assert.ok(Object.values(movementStateFromKeys(keys, { swimming: true, blocked: true })).every(value => !value));
});
