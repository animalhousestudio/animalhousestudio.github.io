import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Texture, Uint32BufferAttribute } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { removeDegenerateTriangles } from '../src/rooms/geometryCleanup.mjs';

function fixture() {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0,
    // This triangle has nonzero area, although it is much smaller than any
    // visible detail. A geometric epsilon would wrongly delete it.
    0, 0, 1, 1e-30, 0, 1, 0, 1e-30, 1,
  ], 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(Array(7).fill([0, 0, 1]).flat(), 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(Array(14).fill(.25), 2));
  geometry.setIndex(new Uint32BufferAttribute([0, 0, 1, 0, 1, 2, 0, 1, 3, 4, 5, 6], 1));
  const root = new Group(), material = new MeshStandardMaterial();
  root.add(new Mesh(geometry, material));
  return { root, geometry, material };
}

test('cleanup preserves shared meshes, attributes, groups, thin faces and triangle order', () => {
  const { root, geometry, material } = fixture();
  root.add(new Mesh(geometry, material));
  geometry.addGroup(0, 6, 3);
  geometry.addGroup(6, 6, 8);
  geometry.setDrawRange(0, 12);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const attributes = { ...geometry.attributes }, bounds = geometry.boundingBox.clone();
  const result = removeDegenerateTriangles(root);
  assert.deepEqual(result, { geometriesChanged: 1, geometriesSkipped: 0, trianglesRemoved: 2, meshTrianglesRemoved: 4 });
  assert.deepEqual(Array.from(geometry.index.array), [0, 1, 2, 4, 5, 6]);
  assert.ok(geometry.index.array instanceof Uint32Array);
  assert.deepEqual(geometry.groups, [{ start: 0, count: 3, materialIndex: 3 }, { start: 3, count: 3, materialIndex: 8 }]);
  assert.deepEqual(geometry.drawRange, { start: 0, count: 6 });
  for (const [name, attribute] of Object.entries(attributes)) assert.equal(geometry.getAttribute(name), attribute);
  for (const mesh of root.children) {
    assert.equal(mesh.geometry, geometry);
    assert.equal(mesh.material, material);
  }
  assert.ok(geometry.boundingBox.equals(bounds));
  const index = geometry.index;
  assert.equal(removeDegenerateTriangles(root).trianglesRemoved, 0);
  assert.equal(geometry.index, index, 'Repeated cleanup must leave an already clean buffer intact');
});

test('deformed geometry and wireframe users protect every shared copy', () => {
  for (const unsupported of ['morph', 'skinned', 'wireframe', 'displaced', 'line']) {
    const { root, geometry } = fixture(), index = geometry.index;
    const shared = new Mesh(geometry, new MeshStandardMaterial());
    root.add(shared);
    if (unsupported === 'morph') geometry.morphAttributes.position = [geometry.attributes.position.clone()];
    if (unsupported === 'skinned') shared.isSkinnedMesh = true;
    if (unsupported === 'wireframe') shared.material.wireframe = true;
    if (unsupported === 'displaced') shared.material.displacementMap = new Texture();
    if (unsupported === 'line') shared.isMesh = false;
    assert.equal(removeDegenerateTriangles(root).geometriesSkipped, 1, unsupported);
    assert.equal(geometry.index, index, unsupported);
  }
});

test('nonindexed triangles, partial draw ranges and unaligned groups are left intact', () => {
  for (const unsupported of ['nonindexed', 'range', 'group']) {
    const { root, geometry } = fixture();
    if (unsupported === 'nonindexed') geometry.setIndex(null);
    if (unsupported === 'range') geometry.setDrawRange(3, 9);
    if (unsupported === 'group') geometry.addGroup(1, 3, 0);
    const index = geometry.index;
    assert.equal(removeDegenerateTriangles(root).geometriesSkipped, 1, unsupported);
    assert.equal(geometry.index, index, unsupported);
  }
});

test('mansion cleanup removes invisible triangles while keeping source meshes and shared attributes', async () => {
  const bytes = await readFile(new URL('../src/assets/models/mansion-v10.glb', import.meta.url));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const originals = [];
  let before = 0;
  scene.traverse(node => {
    if (!node.isMesh) return;
    originals.push({ node, geometry: node.geometry, material: node.material, position: node.geometry.attributes.position });
    before += node.geometry.index.count / 3;
  });
  const result = removeDegenerateTriangles(scene);
  let after = 0;
  for (const { node, geometry, material, position } of originals) {
    assert.equal(node.geometry, geometry);
    assert.equal(node.material, material);
    assert.equal(node.geometry.attributes.position, position);
    after += node.geometry.index.count / 3;
  }
  assert.ok(result.meshTrianglesRemoved >= 2520, 'The collapsed flower poles should all be removed');
  assert.equal(before - after, result.meshTrianglesRemoved);
  assert.equal(removeDegenerateTriangles(scene).trianglesRemoved, 0);
  console.log('Mansion exact-area cleanup:', JSON.stringify({ before, after, ...result }));
});
