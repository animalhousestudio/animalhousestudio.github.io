import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyCurvedExterior, archivedExteriorNames } from '../src/rooms/curvedExterior.mjs';

function room() {
  const group = new Group();
  const wall = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  wall.userData.collidable = true;
  const furniture = wall.clone();
  group.add(wall, furniture);
  group.userData.shells = [wall];
  return group;
}

test('hides exactly the archived GLB objects, preserving geometry and retained details', async () => {
  const bytes = await readFile(new URL('../src/assets/models/exterior-home.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
  );
  const before = new Map();
  scene.traverse((node) => before.set(node, {
    visible: node.visible,
    matrix: node.matrix.toArray(),
    geometry: node.geometry,
  }));
  const living = room();
  const kitchen = room();
  const observatory = room();
  const basement = room();
  assert.equal(archivedExteriorNames.length, 244);
  assert.equal(new Set(archivedExteriorNames).size, 244);
  assert.equal(applyCurvedExterior(scene, [living, kitchen, observatory]), true);

  const hidden = [];
  scene.traverse((node) => {
    const original = before.get(node);
    assert.deepEqual(node.matrix.toArray(), original.matrix);
    assert.equal(node.geometry, original.geometry);
    if (original.visible && !node.visible) hidden.push(node.userData.name || node.name);
  });
  assert.deepEqual(hidden.sort(), [...archivedExteriorNames].sort());
  for (const name of [
    'HOUSE_VerticalStretch', 'ObsDome_Curved', 'CURVE_ArchedGable_PaintedTimber',
    'CURVE_Observatory_CylindricalDrum', 'EXT_EntryDoorPivot_Left',
    'EXT_EntryDoorPivot_Right', 'JETPACK_Pickup', 'AVIARY_Left_Floor',
    'INT_Foundation_Back', 'INT_Foundation_Front', 'INT_Foundation_Left',
    'INT_Foundation_Right', 'INT_Slab_Basement', 'INT_Slab_Living', 'INT_Slab_Kitchen',
  ]) {
    const node = scene.getObjectByName(name);
    assert.ok(node, name);
    for (let ancestor = node; ancestor; ancestor = ancestor.parent) {
      assert.equal(ancestor.visible, true, name);
    }
  }
  for (const group of [living, kitchen, observatory]) {
    assert.equal(group.userData.shells[0].visible, false);
    assert.equal(group.userData.shells[0].userData.collidable, true);
    assert.equal(group.children[1].visible, true);
  }
  assert.equal(basement.userData.shells[0].visible, true);
  assert.equal(applyCurvedExterior(scene, [living, kitchen, observatory]), true);
});

test('keeps the legacy shell when no curved replacement is loaded', () => {
  const scene = new Group();
  const legacy = room();
  legacy.name = 'HOUSE_VerticalStretch';
  legacy.children[0].name = 'WallFront';
  scene.add(legacy);
  const living = room();
  assert.equal(applyCurvedExterior(scene, [living]), false);
  assert.equal(legacy.children[0].visible, true);
  assert.equal(living.userData.shells[0].visible, true);
});

test('does not filter new root objects and accepts exports without the archive', () => {
  const scene = new Group();
  for (const name of [
    'CURVE_ArchedGable_PaintedTimber', 'CURVE_Observatory_CylindricalDrum', 'WallFront',
  ]) {
    const node = new Group();
    node.name = name;
    scene.add(node);
  }
  const living = room();
  assert.equal(applyCurvedExterior(scene, [living]), true);
  assert.equal(scene.getObjectByName('WallFront').visible, true);
  assert.equal(living.userData.shells[0].visible, false);
});
