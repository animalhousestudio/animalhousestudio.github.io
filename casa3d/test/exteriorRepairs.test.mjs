import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Mesh, MeshBasicMaterial, Raycaster, Texture, Triangle, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { repairExterior } from '../src/rooms/exteriorRepairs.mjs';
import { cutHouseGround, insideHouse } from '../src/rooms/asteroid.mjs';
import { BASEMENT_FOOTPRINT } from '../src/rooms/basementFootprint.mjs';
import { BASE_HOUSE_X, BASE_HOUSE_Z, BASE_FLOOR_Y, WORLD_SCALE } from '../src/rooms/layout.mjs';
import { ELEVATOR_CABIN_HEIGHT } from '../src/rooms/elevator.mjs';

async function model(name) {
  const bytes = await readFile(new URL(`../src/assets/models/${name}.glb`, import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.updateMatrixWorld(true);
  return scene;
}
const house = await model('mansion-v10');
const tree = house.getObjectByName('M09_HouseTree_Number5_Branches');
const originalRoots = [];
const point = new Vector3();
for (let i = 0; i < tree.geometry.attributes.position.count; i++) {
  point.fromBufferAttribute(tree.geometry.attributes.position, i).applyMatrix4(tree.matrixWorld);
  if (point.y < 1) originalRoots.push([i, point.clone()]);
}
const repairs = repairExterior(house);
house.updateMatrixWorld(true);

test('terrain covers all curved house corners and keeps the basement opening', async () => {
  const asteroid = await model('asteroid');
  const source = asteroid.getObjectByName('Asteroid_Surface');
  const ground = new Mesh(cutHouseGround(source.geometry.clone().applyMatrix4(source.matrixWorld)), new MeshBasicMaterial());
  ground.updateMatrixWorld(true);
  const ray = new Raycaster();
  for (const [x, z] of BASEMENT_FOOTPRINT) {
    const scale = 1 + .04 / Math.hypot(x, z);
    const wx = BASE_HOUSE_X + x * scale, wz = BASE_HOUSE_Z + z * scale;
    ray.set(new Vector3(wx, 1, wz), new Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(ground).length, `Visible terrain gap at ${wx}, ${wz}`);
    assert.equal(insideHouse(wx, wz), false, 'Visible lawn must support walking');
  }
  for (const x of [-4, 0, 4]) for (const z of [-3, 0, 3]) {
    ray.set(new Vector3(BASE_HOUSE_X + x, 1, BASE_HOUSE_Z + z), new Vector3(0, -1, 0));
    assert.equal(ray.intersectObject(ground).length, 0, 'Terrain seals the basement');
    assert.equal(insideHouse(BASE_HOUSE_X + x, BASE_HOUSE_Z + z), true);
  }
});

test('veranda front, base and roof meet the curved main wall without a slit', () => {
  const meshes = [];
  house.traverse(mesh => { if (mesh.isMesh && /Conservatory|CURVE_Left_Clapboard/.test(mesh.name)) meshes.push(mesh); });
  const ray = new Raycaster();
  // Across the former 1.2-unit open strip: the third glazed bay now meets the house.
  for (const x of [-7.35, -7.1, -6.8, -6.5, -6.2]) {
    for (const y of [.2, .6, 1.2, 2.5, 3.8, 4.2]) {
      ray.set(new Vector3(x, y, 5), new Vector3(0, 0, -1)); ray.far = 1;
      assert.ok(ray.intersectObjects(meshes).length, `Open veranda at ${x}, ${y}`);
    }
    ray.set(new Vector3(x, 7, 4.1), new Vector3(0, -1, 0)); ray.far = 3;
    assert.ok(ray.intersectObjects(meshes).length, `Open roof at ${x}`);
  }
});

test('reshaped branches and leaves clear the buildings while the trunk roots stay fixed', () => {
  assert.ok(repairs.tree.changedVertices > 0);
  assert.ok(originalRoots.length > 0);
  for (const [index, original] of originalRoots) {
    point.fromBufferAttribute(tree.geometry.attributes.position, index).applyMatrix4(tree.matrixWorld);
    assert.ok(point.distanceTo(original) < 1e-5, 'The tree was moved instead of its branches being shaped');
  }
  let overlaps = 0;
  house.traverse(mesh => {
    if (!/^M09_HouseTree_Number5_(Branches|Leaves)$/.test(mesh.name)) return;
    const p = mesh.geometry.attributes.position, index = mesh.geometry.index;
    const triangle = new Triangle();
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      for (const [j, vertex] of [triangle.a, triangle.b, triangle.c].entries()) {
        vertex.fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld);
      }
      // Test full triangles, not only vertices: a branch could otherwise span the glass.
      for (const reserved of repairs.tree.volumes) {
        const building = reserved.clone().expandByScalar(-.18);
        if (building.intersectsTriangle(triangle)) overlaps++;
      }
    }
  });
  assert.equal(overlaps, 0, 'Branches or leaf cards still cross a building');
});

test('15 percent taller cabin has matching door headers and top shaft clearance', () => {
  assert.ok(Math.abs(ELEVATOR_CABIN_HEIGHT * WORLD_SCALE - 2.645) < 1e-8);
  for (const [index, y] of BASE_FLOOR_Y.entries()) {
    const header = house.getObjectByName(`M10_Elevator_DoorHeader_${String(index).padStart(2, '0')}`);
    assert.ok(Math.abs(new Box3().setFromObject(header).min.y - y - ELEVATOR_CABIN_HEIGHT) < 1e-5);
    const glass = [];
    house.traverse(mesh => { if (mesh.isMesh && mesh.name.startsWith('M10_Elevator_Shaft_Glass')) glass.push(mesh); });
    const ray = new Raycaster(new Vector3(0, y + ELEVATOR_CABIN_HEIGHT - .005, .36), new Vector3(0, 0, -1), 0, .36);
    assert.equal(ray.intersectObjects(glass).length, 0, 'Old front glass obstructs the taller doorway');
  }
  const shaft = new Box3().setFromObject(house.getObjectByName('M10_Elevator_Shaft_Glass'));
  assert.ok(shaft.max.y > BASE_FLOOR_Y.at(-1) + ELEVATOR_CABIN_HEIGHT + .05);
});
