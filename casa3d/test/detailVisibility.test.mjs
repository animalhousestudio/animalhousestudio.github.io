import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { registerStaticTextDetails } from '../src/rooms/detailVisibility.mjs';

function label(name = 'Colpisci_forte', height = .1) {
  const mesh = new Mesh(new BoxGeometry(1, .024, height), new MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

function setup() {
  const root = new Group(), text = label(), body = label('Punch machine body');
  root.add(text, body);
  const camera = new PerspectiveCamera(90, 1, .1, 10000);
  return { root, text, body, camera, controller: registerStaticTextDetails(root) };
}

test('only the three named text details are registered, without hiding before collision capture', () => {
  const root = new Group();
  const nodes = ['Colpisci forte', 'Score_label', 'Score_numerals', 'Score label frame', 'Colpisci_forte_extra']
    .map(name => label(name));
  root.add(...nodes);
  const controller = registerStaticTextDetails(root);
  assert.deepEqual(controller.anchors.map(anchor => anchor.node), nodes.slice(0, 3));
  for (const node of nodes) assert.equal(node.visible, true);
  for (const node of nodes.slice(0, 3)) assert.equal(node.userData.staticDetail, true);
  for (const node of nodes.slice(3)) assert.equal(node.userData.staticDetail, undefined);
  assert.ok(controller.anchors.every(anchor => !anchor.initialized));
});

test('unreadable distant letters hide and approaching restores them, while the machine remains', () => {
  const { text, body, camera, controller } = setup();
  camera.position.set(0, 0, 1000);
  controller.update(camera, 720);
  assert.equal(text.visible, false);
  assert.equal(body.visible, true);
  camera.position.set(0, 0, 5);
  controller.update(camera, 720);
  assert.equal(text.visible, true);
  camera.position.copy(controller.anchors[0].sphere.center);
  controller.update(camera, 720);
  assert.equal(text.visible, true);
});

test('hysteresis prevents flicker between 1.5 and 2 pixels on approach and departure', () => {
  const { text, camera, controller } = setup();
  controller.update(camera, 720);
  const anchor = controller.anchors[0];
  const atPixels = pixels => {
    const distance = 360 * anchor.glyphHeight / pixels + anchor.sphere.radius;
    camera.position.copy(anchor.sphere.center).add(new Vector3(0, 0, distance));
    controller.update(camera, 720);
  };
  atPixels(1.7);
  assert.equal(text.visible, true);
  atPixels(1.4);
  assert.equal(text.visible, false);
  atPixels(1.7);
  assert.equal(text.visible, false);
  atPixels(2.1);
  assert.equal(text.visible, true);
  atPixels(1.7);
  assert.equal(text.visible, true);
});

test('bounds initialize after placement and include parent scale and text orientation', () => {
  const { root, text, camera, controller } = setup();
  const world = new Group();
  world.scale.setScalar(5);
  world.position.set(10, 2, -4);
  world.add(root);
  root.position.set(2, 3, 4);
  text.rotation.x = Math.PI / 2;
  text.scale.set(2, 1, 3);
  controller.update(camera, 720);
  const anchor = controller.anchors[0];
  assert.ok(Math.abs(anchor.glyphHeight - 1.5) < 1e-6);
  assert.ok(anchor.sphere.center.distanceTo(new Vector3(20, 17, 16)) < 1e-6);
  // Looking from a parented camera must use its world position, too.
  const rig = new Group();
  rig.position.copy(anchor.sphere.center);
  rig.add(camera);
  camera.position.set(0, 0, 1000);
  controller.update(camera, 720);
  assert.equal(text.visible, false);
  camera.position.set(0, 0, 5);
  controller.update(camera, 720);
  assert.equal(text.visible, true);
});

test('multi-primitive label groups preserve all children as one detail', () => {
  const root = new Group(), group = new Group();
  group.name = 'Score_label';
  const left = label('primitive_left'), right = label('primitive_right');
  left.position.x = -1;
  right.position.x = 1;
  group.add(left, right);
  root.add(group);
  const controller = registerStaticTextDetails(root), camera = new PerspectiveCamera(90, 1, .1, 10000);
  assert.equal(controller.anchors.length, 1);
  assert.equal(group.userData.staticDetail, true);
  assert.equal(left.userData.staticDetail, true);
  assert.equal(right.userData.staticDetail, true);
  camera.position.z = 1000;
  controller.update(camera, 720);
  assert.equal(group.visible, false);
  assert.equal(left.visible, true);
  assert.ok(controller.anchors[0].sphere.radius > 1.5);
});

test('authored hidden text and hidden parent branches are never reactivated', () => {
  const root = new Group(), hidden = label('Score_label'), branch = new Group();
  hidden.visible = false;
  branch.visible = false;
  const child = label('Score_numerals');
  branch.add(child);
  root.add(hidden, branch);
  const controller = registerStaticTextDetails(root), camera = new PerspectiveCamera();
  controller.update(camera, 720);
  assert.equal(hidden.visible, false);
  assert.equal(branch.visible, false);
  assert.equal(child.visible, true);
  assert.ok(controller.anchors.every(anchor => !anchor.authoredVisible));
  controller.update(camera, 0);
  assert.equal(hidden.visible, false);
  assert.equal(branch.visible, false);
});

test('resolution and field of view affect detail while invalid view metrics fail open', () => {
  const { text, camera, controller } = setup();
  camera.position.z = 30;
  controller.update(camera, 720);
  assert.equal(text.visible, false);
  controller.update(camera, 2160);
  assert.equal(text.visible, true);
  controller.update(camera, 720);
  assert.equal(text.visible, false);
  camera.fov = 30;
  camera.updateProjectionMatrix();
  controller.update(camera, 720);
  assert.equal(text.visible, true);
  camera.fov = 90;
  camera.updateProjectionMatrix();
  controller.update(camera, 720);
  assert.equal(text.visible, false);
  controller.update(camera, NaN);
  assert.equal(text.visible, true);
  controller.update(camera, 720);
  assert.equal(text.visible, false);
  camera.position.x = NaN;
  controller.update(camera, 720);
  assert.equal(text.visible, true);
});

test('wide-angle off-axis text remains visible at its projected glyph height', () => {
  const { text, camera, controller } = setup();
  camera.fov = 150;
  camera.updateProjectionMatrix();
  text.position.set(8, 0, -4);
  text.rotation.x = Math.PI / 2;
  controller.update(camera, 720);
  // Measure the actual screen-space letter height near the viewport edge.
  const top = text.localToWorld(new Vector3(0, 0, .05)).project(camera);
  const bottom = text.localToWorld(new Vector3(0, 0, -.05)).project(camera);
  assert.ok(Math.abs(top.x) < 1, 'the label is within the wide camera view');
  assert.ok(Math.abs(top.y - bottom.y) * 360 > 2, 'glyphs are taller than two pixels');
  const { sphere, glyphHeight } = controller.anchors[0];
  const radialEstimate = 360 * camera.projectionMatrix.elements[5] * glyphHeight
    / (sphere.center.distanceTo(camera.position) - sphere.radius);
  assert.ok(radialEstimate < 1.5, 'a radial-distance estimate would incorrectly hide the label');
  assert.equal(text.visible, true);
});
