import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Raycaster, SphereGeometry, Vector3 } from 'three';
import { batchStaticArchitecture, instanceStaticMeshes, partitionInstances, updateGrassDensity } from '../src/rooms/optimize.mjs';
import { propPlacements } from '../src/rooms/terrainDetail.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';
import { captureCollisionSource } from '../src/player/collisionWorld.mjs';

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

test('expensive repeated details form local instance bounds while cheap rails stay shared', () => {
  for (const [geometry, expectedBatches] of [[new SphereGeometry(1, 16, 8), 2], [new BoxGeometry(1, 1, 1), 1]]) {
    const root = new Group(), material = new MeshStandardMaterial();
    root.position.set(15, 3, -10); root.scale.setScalar(5);
    for (const offset of [0, 40]) for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(geometry, material); mesh.position.set(offset + 2 + i, 2, 2); root.add(mesh);
    }
    const before = new Box3().setFromObject(root);
    instanceStaticMeshes(root, { cellSize: 10 });
    const batches = root.children.filter(node => node.isInstancedMesh);
    assert.equal(batches.length, expectedBatches);
    assert.equal(batches.reduce((sum, batch) => sum + batch.count, 0), 6);
    assert.ok(new Box3().setFromObject(root).equals(before));
    if (expectedBatches === 2) for (const batch of batches) assert.ok(batch.boundingSphere.radius < 5);
  }
});

test('visibility-controlled static details retain their hierarchy through both batching passes', () => {
  const root = new Group(), details = new Group(); details.userData.staticDetail = true; root.add(details);
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial(); geometry.clearGroups();
  for (let i = 0; i < 4; i++) details.add(new Mesh(geometry, material));
  instanceStaticMeshes(root); batchStaticArchitecture(root);
  assert.equal(details.parent, root);
  assert.equal(details.children.length, 4);
  details.visible = false;
  let visibleMeshes = 0; root.traverseVisible(node => { if (node.isMesh) visibleMeshes++; });
  assert.equal(visibleMeshes, 0);
});

function finishedSlab(materials) {
  const geometry = new BoxGeometry(2, .2, 2);
  geometry.clearGroups();
  geometry.addGroup(0, 12, 0); geometry.addGroup(12, 6, 1); geometry.addGroup(18, 18, 0);
  const mesh = new Mesh(geometry, materials); mesh.userData.parquetFinish = true;
  return mesh;
}

function renderedTriangleSignatures(root) {
  root.updateMatrixWorld(true);
  const signatures = [], point = new Vector3();
  root.traverseVisible(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry, position = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < geometry.index.count; i += 3) {
      const group = geometry.groups.find(group => i >= group.start && i < group.start + group.count);
      const material = Array.isArray(node.material) ? node.material[group.materialIndex] : node.material;
      const vertices = [0, 1, 2].map(offset => {
        const index = geometry.index.getX(i + offset);
        point.fromBufferAttribute(position, index).applyMatrix4(node.matrixWorld);
        return [...point.toArray().map(value => value.toFixed(4)), uv.getX(index).toFixed(4), uv.getY(index).toFixed(4)].join(',');
      }).sort();
      signatures.push(`${material.uuid}:${vertices.join('|')}`);
    }
  });
  return signatures.sort();
}

test('parquet draw groups batch by material without changing triangles, UVs or captured collisions', () => {
  const root = new Group(), materials = [new MeshStandardMaterial(), new MeshStandardMaterial()];
  root.position.set(15, 3, -10); root.scale.setScalar(5); root.rotation.y = .37;
  const originals = [];
  for (let i = 0; i < 4; i++) {
    const slab = finishedSlab(materials); slab.name = `Floor_${i}`;
    slab.position.set(1 + i * 2, 2, 2); slab.scale.x = i === 2 ? -1 : 1;
    root.add(slab);
    originals.push({ slab, geometry: slab.geometry, index: slab.geometry.index, indices: Array.from(slab.geometry.index.array) });
  }
  const before = renderedTriangleSignatures(root), collisions = captureCollisionSource(root);
  batchStaticArchitecture(root);
  assert.equal(root.userData.parquetDrawGroupsSeparated, 4);
  assert.equal(root.children.length, 2, 'Eight material draw groups should become two local material batches');
  assert.deepEqual(renderedTriangleSignatures(root), before);
  for (const [i, original] of originals.entries()) {
    assert.equal(original.slab.geometry, original.geometry, 'The source geometry stays available to collision data');
    assert.equal(original.geometry.index, original.index);
    assert.deepEqual(Array.from(original.geometry.index.array), original.indices);
    assert.equal(collisions[i].geometry, original.geometry);
  }
  batchStaticArchitecture(root);
  assert.equal(root.userData.parquetDrawGroupsSeparated, 4, 'A second batch pass must not split mono-material results again');
  assert.deepEqual(renderedTriangleSignatures(root), before);
});

test('parquet splitting respects hidden, excluded, movable, collision-marked and controlled branches', () => {
  const root = new Group(), materials = [new MeshStandardMaterial(), new MeshStandardMaterial()], excludedRoots = [];
  const nodes = [];
  for (const kind of ['hidden', 'excluded-group', 'excluded-mesh', 'movable', 'collidable', 'controlled', 'unmarked']) {
    const parent = new Group(), slab = finishedSlab(materials); root.add(parent); parent.add(slab);
    if (kind === 'hidden') parent.visible = false;
    if (kind === 'excluded-group') excludedRoots.push(parent);
    if (kind === 'excluded-mesh') excludedRoots.push(slab);
    if (kind === 'movable') parent.userData.interactable = true;
    if (kind === 'collidable') slab.userData.collidable = true;
    if (kind === 'controlled') parent.userData.staticDetail = true;
    if (kind === 'unmarked') delete slab.userData.parquetFinish;
    nodes.push({ parent, slab, geometry: slab.geometry });
  }
  batchStaticArchitecture(root, 10, excludedRoots);
  for (const { parent, slab, geometry } of nodes) {
    assert.deepEqual(parent.children, [slab]); assert.equal(slab.geometry, geometry); assert.equal(slab.material, materials);
  }
  const whollyExcluded = new Group(), slab = finishedSlab(materials); whollyExcluded.add(slab);
  assert.equal(batchStaticArchitecture(whollyExcluded, 10, [whollyExcluded]), 0);
  assert.deepEqual(whollyExcluded.children, [slab]);
});
