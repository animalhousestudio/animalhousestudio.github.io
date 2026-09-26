import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { batchStaticArchitecture, instanceStaticMeshes, partitionInstances, updateGrassDensity } from '../src/rooms/optimize.mjs';
import { propPlacements } from '../src/rooms/terrainDetail.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';

test('batching preserves mirrored geometry, bounds and front faces', () => {
  const root = new Group(), material = new MeshStandardMaterial();
  root.position.set(10, 2, -4); root.scale.setScalar(5);
  for (let i = 0; i < 6; i++) {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), material);
    mesh.geometry.clearGroups(); // Single-material GLB primitives have no groups.
    mesh.position.set(1 + i * 1.5, 1, 1); mesh.scale.x = i % 2 ? -1 : 1; root.add(mesh);
  }
  root.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(root);
  const ray = new Raycaster(new Vector3(10 + 2.5 * 5, 7, 20), new Vector3(0, 0, -1));
  const before = ray.intersectObject(root, true)[0].point;
  assert.equal(batchStaticArchitecture(root), 5);
  root.updateMatrixWorld(true);
  assert.ok(new Box3().setFromObject(root).equals(bounds));
  assert.ok(ray.intersectObject(root, true)[0].point.distanceTo(before) < 1e-5);
});

test('doors, jetpack, hidden branches and transparent glass survive batching', () => {
  const root = new Group(), geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const door = new Group(); door.name = 'EXT_EntryDoorPivot_Left'; root.add(door);
  const pack = new Group(); pack.name = 'JETPACK_Pickup'; root.add(pack);
  const hidden = new Group(); hidden.visible = false; root.add(hidden);
  for (const parent of [door, pack, hidden]) for (let i = 0; i < 4; i++) parent.add(new Mesh(geometry, material));
  const glass = new Mesh(geometry, new MeshStandardMaterial({ transparent: true, opacity: .3 })); root.add(glass);
  instanceStaticMeshes(root); batchStaticArchitecture(root);
  for (const parent of [door, pack, hidden]) assert.equal(parent.children.length, 4);
  assert.equal(door.matrixAutoUpdate, true); assert.equal(pack.matrixAutoUpdate, true);
  assert.equal(glass.parent, root);
});

test('mirrored window parts keep correct face winding when shared geometry is instanced', () => {
  const root = new Group(), geometry = new BoxGeometry(1, 1, 1), material = new MeshStandardMaterial();
  geometry.clearGroups();
  const mirrors = [];
  for (let i = 0; i < 6; i++) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(i * 2, 0, 0);
    mesh.scale.x = i < 3 ? 1 : -1;
    root.add(mesh);
    if (i >= 3) mirrors.push(mesh);
  }
  root.updateMatrixWorld(true);
  const before = new Box3().setFromObject(root);
  assert.equal(instanceStaticMeshes(root), 2);
  mirrors.forEach(mesh => assert.equal(mesh.parent, root));
  const batch = root.children.find(mesh => mesh.isInstancedMesh), matrix = new Matrix4();
  assert.equal(batch.count, 3);
  for (let i = 0; i < batch.count; i++) {
    batch.getMatrixAt(i, matrix);
    assert.ok(matrix.determinant() > 0);
  }
  batchStaticArchitecture(root);
  root.updateMatrixWorld(true);
  assert.ok(new Box3().setFromObject(root).equals(before));
  const ray = new Raycaster(new Vector3(8, 0, 2), new Vector3(0, 0, -1));
  assert.ok(Math.abs(ray.intersectObject(root, true)[0].point.z - .5) < 1e-5);
});

test('grass cells preserve placements and reduce only distant density', () => {
  const source = new InstancedMesh(new BoxGeometry(.1, .2, .1), new MeshStandardMaterial(), 80);
  for (let i = 0; i < 80; i++) source.setMatrixAt(i, new Matrix4().makeTranslation(i / 2, 0, 0));
  const group = partitionInstances(source);
  assert.equal(group.children.reduce((sum, m) => sum + m.count, 0), 80);
  const positions = [], matrix = new Matrix4();
  for (const cell of group.children) for (let i = 0; i < cell.count; i++) {
    cell.getMatrixAt(i, matrix); positions.push(matrix.elements[12]);
  }
  assert.deepEqual(positions.sort((a,b) => a-b), Array.from({length:80}, (_,i) => i/2));
  updateGrassDensity(group.children, 0, 0, 0);
  assert.equal(group.children[0].count, group.children[0].userData.fullCount);
  assert.ok(group.children.at(-1).count < group.children.at(-1).userData.fullCount / 3);
  const far = group.children.at(-1); updateGrassDensity(group.children, far.boundingSphere.center.x, 0, 0);
  assert.equal(far.count, far.userData.fullCount);
});

test('keyboard has human scale after the environment scale is applied', () => {
  assert.equal(propPlacements.find(p => p.name === 'AsteroidKeyboard').size * WORLD_SCALE, 2.4);
});
