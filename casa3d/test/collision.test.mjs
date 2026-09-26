import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CollisionWorld, captureCollisionSource } from '../src/player/collisionWorld.mjs';
import { Player } from '../src/player/movement.js';
import { prepareEntryDoor } from '../src/rooms/entry.mjs';
import { instanceStaticMeshes, batchStaticArchitecture } from '../src/rooms/optimize.mjs';
import { BASE_HOUSE_X, BASE_HOUSE_Z, FLOOR_Y, HOUSE_X, HOUSE_Z, WORLD_SCALE, EYE_HEIGHT } from '../src/rooms/layout.mjs';

const material = new MeshBasicMaterial();
const box = (size, position) => {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.position.set(...position); return mesh;
};
const collisionWorld = (...meshes) => {
  const group = new Group(); group.add(...meshes);
  return new CollisionWorld().addRoot(group).build();
};
const walk = (world, start, displacement) => world.move(new Vector3(...start), new Vector3(...displacement)).position;

test('capsule blocks both sides of thin walls even over a large low-FPS movement', () => {
  const wall = new Mesh(new PlaneGeometry(20, 10), material); wall.position.y = 4;
  const world = collisionWorld(wall);
  assert.ok(walk(world, [0, 1.65, -4], [0, 0, 12]).z <= -.349);
  assert.ok(walk(world, [0, 1.65, 4], [0, 0, -12]).z >= .349);
});

test('diagonal input slides along a wall without tunneling at its triangle seam', () => {
  const world = collisionWorld(box([20, 5, .025], [0, 2, 0]));
  const end = walk(world, [-4, 1.65, -3], [8, 0, 6]);
  assert.ok(end.z < -.36, end.toArray());
  assert.ok(end.x > 3.9, 'parallel motion should remain available');
  assert.ok(Math.abs(end.y - 1.65) < .0001, 'triangulation seams should not move the player vertically');
});

test('full body catches a low asset below eye height, floors and jetpack ceilings', () => {
  const world = collisionWorld(box([2, .9, 2], [0, .45, 0]), box([20, .1, 20], [0, -.05, 0]), box([20, .1, 20], [0, 3.05, 0]));
  assert.ok(walk(world, [0, 1.65, -4], [0, 0, 8]).z < -1.3);
  const landing = world.move(new Vector3(5, 8, 0), new Vector3(0, -20, 0));
  assert.equal(landing.grounded, true);
  assert.ok(Math.abs(landing.position.y - 4.75) < .002, 'land on the roof from above');
  const ceiling = world.move(new Vector3(5, 1.65, 0), new Vector3(0, 12, 0));
  assert.equal(ceiling.ceiling, true);
  assert.ok(Math.abs(ceiling.position.y - 2.84) < .002);
  assert.ok(Math.abs(walk(world, [5, 2, 0], [0, -6, 0]).y - 1.65) < .002);
});

test('a real doorway stays open and instanced assets collide individually', () => {
  const instances = new InstancedMesh(new BoxGeometry(1, 1, 1), material, 2);
  instances.setMatrixAt(0, new Matrix4().makeTranslation(-5, .5, 4));
  instances.setMatrixAt(1, new Matrix4().makeTranslation(5, .5, 4));
  const world = collisionWorld(box([4, 5, .1], [-3, 2, 0]), box([4, 5, .1], [3, 2, 0]), instances);
  assert.ok(walk(world, [0, 1.65, -3], [0, 0, 9]).z > 5.9, 'empty space between instances must remain traversable');
  assert.ok(walk(world, [5, 1.65, 2], [0, 0, 4]).z < 3.3);
});

test('moving doors update their collision geometry without leaving a closed-door ghost', () => {
  const root = new Group(); root.name = 'EntryDoorPivot_Left';
  root.add(box([2, 3, .1], [1, 1.5, 0]));
  const world = new CollisionWorld().addDynamicRoot(root).build();
  assert.ok(walk(world, [1, 1.65, -2], [0, 0, 4]).z < -.39);
  root.rotation.y = Math.PI / 2;
  assert.ok(walk(world, [1, 1.65, -2], [0, 0, 4]).z > 1.99);
  // Sliding landing gates move below an otherwise stationary root group.
  root.rotation.y = 0; root.children[0].position.x += 4;
  assert.ok(walk(world, [1, 1.65, -2], [0, 0, 4]).z > 1.99);
});

test('small steps climb, while tall assets remain obstacles for the controller', () => {
  const world = collisionWorld(box([30, .1, 30], [0, -.05, 0]), box([4, .2, 4], [0, .1, 0]), box([4, 1, 4], [0, .5, 7]));
  const player = new Player(new PerspectiveCamera(), null, { speed: 4, groundHeightAt: () => 0 });
  player.setPosition(new Vector3(0, EYE_HEIGHT, -4));
  player.setMoveState({ forward: true });
  for (let i = 0; i < 180; i++) player.update(1 / 60, world);
  assert.ok(player.camera.position.z > 4, 'the low step must not snag the player');
  assert.ok(player.camera.position.z < 4.66, 'the tall asset must not be climbed');
});

test('controller collides while walking and boosting, including a stalled frame', () => {
  const world = collisionWorld(box([10, 5, .02], [0, 2, 0]));
  const player = new Player(new PerspectiveCamera(), null, { speed: 11.4, groundHeightAt: () => 0 });
  player.setPosition(new Vector3(0, EYE_HEIGHT, -1));
  player.setMoveState({ forward: true });
  player.update(.25, world);
  assert.ok(player.camera.position.z < -.35);
  player.enableJetpack(); player.setMoveState({ up: true }); player.update(.25, world);
  assert.ok(player.camera.position.z < -.35);
});

async function readModel(name) {
  const bytes = await readFile(new URL(`../src/assets/models/${name}.glb`, import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}

test('the imported natural rock mesh blocks movement at its transformed instance', async () => {
  const rocks = await readModel('rocks-natural');
  rocks.updateMatrixWorld(true);
  let original;
  rocks.traverse(node => { if (!original && node.isMesh) original = node; });
  const geometry = original.geometry.clone().applyMatrix4(original.matrixWorld);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new Vector3());
  const scale = 4 / Math.max(size.x, size.y, size.z);
  const center = geometry.boundingBox.getCenter(new Vector3());
  geometry.translate(-center.x, -center.y, -center.z).scale(scale, scale, scale);
  const instance = new InstancedMesh(geometry, material, 1);
  instance.setMatrixAt(0, new Matrix4().makeRotationY(.73).setPosition(8, 2, -6));
  const world = collisionWorld(instance);
  const transformed = new Box3().setFromObject(instance);
  const mid = transformed.getCenter(new Vector3());
  const start = new Vector3(mid.x, mid.y + .5, transformed.min.z - 2);
  const displacement = new Vector3(0, 0, transformed.max.z - transformed.min.z + 4);
  const end = world.move(start, displacement).position;
  // An oblique boulder can redirect the walker along its side; the straight
  // trajectory through its volume must nevertheless be interrupted.
  assert.ok(end.distanceTo(start.clone().add(displacement)) > 1, `imported boulder ignored: ${end.toArray()}`);
});

test('real mansion walls, panes and floors remain solid after render optimization; entrance opens', async () => {
  const house = await readModel('mansion-v09');
  house.position.set(BASE_HOUSE_X, 0, BASE_HOUSE_Z);
  house.traverse(node => { if (/^M05_Elevator_Cabin/.test(node.name)) node.visible = false; });
  const door = prepareEntryDoor(house);
  const source = captureCollisionSource(house);
  assert.ok(!source.some(record => /Ivy|WindowCat|JETPACK|WalnutLeaf/.test(record.name)));
  instanceStaticMeshes(house); batchStaticArchitecture(house);
  const root = new Group(); root.scale.setScalar(WORLD_SCALE); root.add(house); root.updateMatrixWorld(true);
  const world = new CollisionWorld().addSource(source, house.matrixWorld).build();
  for (const pivot of door.pivots) world.addDynamicRoot(pivot, { filter: node => /WalnutLeaf/.test(node.name) });
  const level = FLOOR_Y[1] + EYE_HEIGHT;
  const rear = walk(world, [HOUSE_X, level, HOUSE_Z - 15], [0, 0, -60]);
  assert.ok(rear.z > HOUSE_Z - 50, `rear wall crossed: ${rear.toArray()}`);
  const side = walk(world, [HOUSE_X + 15, level, HOUSE_Z - 15], [70, 0, 0]);
  assert.ok(side.x < HOUSE_X + 65, `side wall crossed: ${side.toArray()}`);
  const floor = walk(world, [HOUSE_X + 20, level + 3, HOUSE_Z + 15], [0, -8, 0]);
  assert.ok(Math.abs(floor.y - level) < .015, `floor missing: ${floor.toArray()}`);
  const entryX = HOUSE_X - .98 * WORLD_SCALE;
  const closed = walk(world, [entryX, level + .7, HOUSE_Z + 7 * WORLD_SCALE], [0, 0, -8]);
  assert.ok(closed.z > HOUSE_Z + 6 * WORLD_SCALE, `closed door crossed: ${closed.toArray()}`);
  for (let i = 0; i < 180; i++) door.update(new Vector3(entryX, level, HOUSE_Z + 7 * WORLD_SCALE), 1 / 60);
  const opened = walk(world, [entryX, level + .7, HOUSE_Z + 7 * WORLD_SCALE], [0, 0, -8]);
  assert.ok(opened.z < HOUSE_Z + 5.6 * WORLD_SCALE, `open entrance blocked: ${opened.toArray()}`);
  assert.ok(world.stats.lastTriangleTests < world.stats.triangles / 4, 'broad phase should exclude distant triangles');
});
