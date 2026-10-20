import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Group, PerspectiveCamera, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createIntercomCall, placeIntercom, createIntercomAssembly, aimIntercomCamera, INTERCOM_LENS_HEIGHT, INTERCOM_PLACEMENT, INTERCOM_PANEL_SCALE, INTERCOM_SCREEN_HEIGHT } from '../src/rooms/intercomLayout.mjs';
import { EYE_HEIGHT, WORLD_SCALE } from '../src/rooms/layout.mjs';
import { ENTRY_STEPS } from '../src/rooms/entry.mjs';
import { createIntercomPortrait } from '../src/player/intercomPortrait.mjs';
import { createLollipopEquipment } from '../src/player/lollipopEquipment.mjs';
import { renderIntercomSurroundings } from '../src/rooms/intercomBackground.mjs';

for (const failRender of [false, true]) test(`intercom renders real surroundings and restores first-person visibility${failRender ? ' even after an error' : ''}`, () => {
  const garden = new Group(), authoredHidden = new Group(), body = new Group(), monitor = new Group();
  garden.visible = false; authoredHidden.visible = false;
  const hiddenChild = new Group(); hiddenChild.visible = false; garden.add(hiddenChild);
  const entries = [{ root: garden, decorative: true, authoredVisible: true },
    { root: authoredHidden, decorative: true, authoredVisible: false }];
  const scene = new Group(), camera = new PerspectiveCamera(), calls = [];
  const sky = { render(renderer, view) { assert.equal(view, camera); calls.push('sky'); } };
  const renderer = {
    clearDepth() { calls.push('clear sky depth'); },
    render(world, view) {
      assert.equal(world, scene); assert.equal(view, camera);
      assert.equal(garden.visible, true, 'Garden culled by the player camera is visible in the monitor');
      assert.equal(authoredHidden.visible, false); assert.equal(hiddenChild.visible, false);
      assert.equal(body.visible, false); assert.equal(monitor.visible, false);
      calls.push('world'); if (failRender) throw new Error('Render interrupted');
    },
  };
  const render = () => renderIntercomSurroundings({ renderer, camera, scene, sky, entries, hidden: [body, monitor] });
  if (failRender) assert.throws(render, /Render interrupted/); else render();
  assert.deepEqual(calls, ['sky', 'clear sky depth', 'world']);
  assert.equal(garden.visible, false); assert.equal(body.visible, true); assert.equal(monitor.visible, true);
  assert.equal(authoredHidden.visible, false); assert.equal(hiddenChild.visible, false);
});

test('enlarged raised intercom keeps the actual player eye centered without lifting the player', () => {
  const world = new Group(); world.scale.setScalar(WORLD_SCALE);
  const exterior = new Group(); exterior.position.set(1.65, 0, -.57); world.add(exterior);
  const panel = placeIntercom(new Group()); exterior.add(panel);
  const assembly = createIntercomAssembly(); panel.add(assembly);
  const lens = assembly.localToWorld(new Vector3(0, INTERCOM_LENS_HEIGHT, .073));
  const screen = assembly.localToWorld(new Vector3(0, INTERCOM_SCREEN_HEIGHT, .088));
  assert.equal(INTERCOM_PANEL_SCALE, 1.5);
  assert.ok(Math.abs(lens.y - (ENTRY_STEPS.top * WORLD_SCALE + 2.735)) < 1e-8);
  assert.ok(Math.abs(screen.y - (ENTRY_STEPS.top * WORLD_SCALE + 2.255)) < 1e-8);
  const eye = panel.localToWorld(new Vector3(0, EYE_HEIGHT, 1.6));
  const camera = new PerspectiveCamera(38, 1, .08, 8);
  aimIntercomCamera(camera, lens, eye);
  const projectedEye = eye.clone().project(camera);
  assert.ok(Math.abs(projectedEye.x) < 1e-8 && Math.abs(projectedEye.y) < 1e-8, 'Lens above eye level still centers the real first-person eye');
  assert.ok(Math.abs(eye.y - (ENTRY_STEPS.top * WORLD_SCALE + EYE_HEIGHT)) < 1e-8);
  assert.equal(INTERCOM_PLACEMENT.y, ENTRY_STEPS.top);
  assert.ok((INTERCOM_PLACEMENT.x - (-.01)) * WORLD_SCALE > .52 * INTERCOM_PANEL_SCALE / 2, 'Whole housing is outside the moving leaf, on the fixed right jamb');
});

test('a call cannot open before two seconds, cannot restart, and opens exactly once afterwards', () => {
  let starts = 0, opens = 0, finishes = 0;
  const call = createIntercomCall({ getTarget: () => new Vector3(0, 1.68, 0), isBlocked: () => false,
    onStart: () => starts++, onOpen: () => opens++, onFinish: () => finishes++ });
  const eye = new Vector3(0, 2, 1.6);
  assert.equal(call.ring(eye, 10), true);
  assert.equal(call.phase, 'calling'); assert.equal(call.ring(eye, 11), false);
  for (const now of [10, 10.5, 11.999]) { assert.equal(call.update(now), false); assert.equal(opens, 0); }
  assert.equal(call.update(12), true);
  assert.equal(call.phase, 'idle'); assert.equal(call.update(13), false);
  assert.deepEqual([starts, opens, finishes], [1, 1, 1]);
});

test('intercom requires nearby, front-side, unobstructed and enabled gameplay', () => {
  let blocked = false, clear = true, target = new Vector3(0, 1.68, 0);
  const call = createIntercomCall({ getTarget: () => target, isBlocked: () => blocked, hasLineOfSight: () => clear });
  const eye = new Vector3(0, 2, 1.6);
  assert.equal(call.available(eye), true);
  blocked = true; assert.equal(call.ring(eye, 0), false); blocked = false;
  clear = false; assert.equal(call.ring(eye, 0), false); clear = true;
  assert.equal(call.ring(new Vector3(0, 2, 3.1), 0), false);
  assert.equal(call.ring(new Vector3(0, 2, -1), 0), false);
  assert.equal(call.ring(eye, NaN), false);
  target = null; assert.equal(call.ring(eye, 0), false);
});

test('actual bear portrait restores its head and tracks pose, equipment and world placement without changing first-person visibility', async () => {
  const bytes = await readFile(new URL('../src/assets/models/player-bear.glb', import.meta.url));
  const loader = new GLTFLoader(); loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.traverse(node => { if (node.name.startsWith('Head_Bear_Separate')) node.visible = false; });
  const source = new Group(); source.add(scene); source.position.set(8, 7.95, 32); source.rotation.y = Math.PI;
  const equipment = createLollipopEquipment(); equipment.attach(scene);
  const portrait = createIntercomPortrait(source); portrait.sync();
  let heads = 0;
  portrait.root.traverse(node => {
    if (node.name.startsWith('Head_Bear_Separate')) { heads++; assert.equal(node.visible, true); }
    if (node.name.startsWith('PROP_L_Lollipop_')) assert.equal(node.visible, false);
  });
  assert.ok(heads > 0);
  scene.traverse(node => { if (node.name.startsWith('Head_Bear_Separate')) assert.equal(node.visible, false); });
  assert.ok(portrait.root.position.equals(source.position));
  assert.ok(portrait.root.quaternion.equals(source.quaternion));
  equipment.collect(); portrait.sync();
  portrait.root.traverse(node => { if (node.name.startsWith('PROP_L_Lollipop_')) assert.equal(node.visible, true); });
  const bone = scene.getObjectByProperty('isBone', true);
  bone.rotation.z += .12; portrait.sync();
  const portraitBone = portrait.root.getObjectByName(bone.name);
  assert.ok(portraitBone.quaternion.equals(bone.quaternion), 'Active pose is synchronized, not a static screenshot');
  assert.notEqual(portraitBone, bone, 'Portrait has its own skeleton');
  source.updateMatrixWorld(true); portrait.root.updateMatrixWorld(true);
  assert.ok(portraitBone.getWorldPosition(new Vector3()).distanceTo(bone.getWorldPosition(new Vector3())) < 1e-8);
});
