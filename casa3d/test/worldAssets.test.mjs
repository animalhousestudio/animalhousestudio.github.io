import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Box3, Group, PerspectiveCamera, Sphere, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createVisualLod } from '../src/world/visualLod.mjs';
import { WORLD_SCALE } from '../src/rooms/layout.mjs';

const repository = new URL('../../', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('../src/assets/models/lod/metadata.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../art/world-lod/manifest.json', import.meta.url), 'utf8'));

async function readModel(record) {
  const bytes = await readFile(new URL(record.path, repository));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${record.path}: GLB signature`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${record.path}: complete GLB payload`);
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim());
  const loader = new GLTFLoader();
  // Preserve geometry/material semantics while making the test independent of
  // DOM image decoding, WebGL and browser-specific texture upload support.
  loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.updateMatrixWorld(true);
  let triangles = 0, vertices = 0;
  scene.traverse(node => {
    if (!node.isMesh) return;
    const position = node.geometry.attributes.position;
    triangles += (node.geometry.index?.count ?? position.count) / 3;
    vertices += position.count;
  });
  return { bytes, document, scene, triangles, vertices, record,
    bounds: new Box3().setFromObject(scene), tightBounds: new Box3().setFromObject(scene, true) };
}

const assets = Object.fromEntries(await Promise.all(Object.entries(manifest.assets).map(async ([id, asset]) => {
  const levels = { near: asset.source, ...asset.tiers };
  return [id, Object.fromEntries(await Promise.all(Object.entries(levels).map(async ([level, record]) => [level, await readModel(record)])))];
})));

function assertBounds(actual, expected, tolerance, label) {
  for (const edge of ['min', 'max']) for (const [index, axis] of ['x', 'y', 'z'].entries()) {
    const expectedValue = Array.isArray(expected[edge]) ? expected[edge][index] : expected[edge][axis];
    assert.ok(Math.abs(actual[edge][axis] - expectedValue) <= tolerance,
      `${label}: ${edge}.${axis} ${actual[edge][axis]} differs from ${expectedValue}`);
  }
}

function sceneStructure(root) {
  const nodes = [];
  function visit(node, path) {
    node.updateMatrix();
    nodes.push({ path, name: node.name, type: node.type, matrix: node.matrix.toArray(),
      materials: node.isMesh ? (Array.isArray(node.material) ? node.material : [node.material]).map(material => material.name) : [] });
    node.children.forEach((child, index) => visit(child, `${path}/${index}`));
  }
  visit(root, 'root');
  return nodes;
}

for (const [id, levels] of Object.entries(assets)) {
  test(`${id}: canonical normalization bounds match Three's default Box3 source bounds`, () => {
    assertBounds(levels.near.bounds, metadata[id].bounds, 1e-5, `${id} canonical bounds`);
    assertBounds(levels.near.bounds, manifest.assets[id].source.bounds, 1e-5, `${id} manifest bounds`);
    // Precise vertex bounds are also recorded, but are not substituted for the
    // default box used to place the original in the existing scene.
    assertBounds(levels.near.tightBounds, manifest.assets[id].source.tightBounds, 1e-5, `${id} precise bounds`);
  });

  test(`${id}: delivered GLBs match triangle/vertex counts, byte budgets and SHA-256 provenance`, () => {
    for (const [level, model] of Object.entries(levels)) {
      const label = `${id}/${level}`;
      assert.equal(model.bytes.length, metadata[id].bytes[level], `${label}: runtime byte count`);
      assert.equal(model.bytes.length, model.record.bytes, `${label}: manifest byte count`);
      assert.equal(model.triangles, metadata[id].triangles[level], `${label}: runtime triangle count`);
      assert.equal(model.triangles, model.record.triangles, `${label}: manifest triangle count`);
      assert.equal(model.vertices, model.record.vertices, `${label}: manifest vertex count`);
      assert.equal(model.document.nodes.length, model.record.nodes, `${label}: node count`);
      assert.equal(model.document.materials.length, model.record.materials, `${label}: material count`);
      assert.equal(createHash('sha256').update(model.bytes).digest('hex'), model.record.sha256, `${label}: content hash`);
      assertBounds(model.bounds, model.record.bounds, 1e-5, `${label} bounds`);
    }
    assert.ok(levels.medium.triangles <= levels.near.triangles * .30, 'Medium must retain at most 30% of source triangles');
    assert.ok(levels.far.triangles <= levels.near.triangles * .12, 'Far must retain at most 12% of source triangles');
    assert.ok(levels.far.bytes.length < levels.medium.bytes.length && levels.medium.bytes.length < levels.near.bytes.length,
      'Lower detail must reduce the actual transferred payload');
  });

  test(`${id}: reduced tiers preserve hierarchy, authored transforms, material semantics and visual envelope`, () => {
    const source = levels.near, sourceStructure = sceneStructure(source.scene);
    const sourceSize = source.tightBounds.getSize(new Vector3());
    for (const level of ['medium', 'far']) {
      const tier = levels[level], label = `${id}/${level}`;
      assert.deepEqual(tier.document.nodes, source.document.nodes, `${label}: authored glTF nodes and transforms`);
      assert.deepEqual(tier.document.scenes, source.document.scenes, `${label}: authored hierarchy roots`);
      assert.deepEqual(tier.document.materials, source.document.materials, `${label}: material definitions and semantic names`);
      assert.deepEqual(sceneStructure(tier.scene), sourceStructure, `${label}: Three scene hierarchy and transforms`);
      for (const axis of ['x', 'y', 'z']) for (const edge of ['min', 'max']) {
        assert.ok(Math.abs(tier.tightBounds[edge][axis] - source.tightBounds[edge][axis]) <= sourceSize[axis] * .02 + 1e-5,
          `${label}: visual ${edge}.${axis} changed by more than 2% of the source envelope`);
      }
      const sourceMeshes = [];
      source.scene.traverse(node => { if (node.isMesh) sourceMeshes.push(node); });
      let meshIndex = 0;
      tier.scene.traverse(node => {
        if (!node.isMesh) return;
        const sourceMesh = sourceMeshes[meshIndex++];
        assert.ok(node.geometry.attributes.normal, `${label}/${node.name}: shading normals retained`);
        if (sourceMesh.geometry.attributes.uv) assert.ok(node.geometry.attributes.uv, `${label}/${node.name}: texture coordinates retained`);
      });
    }
  });

  test(`${id}: real tier swaps keep one canonical placement without recentering or rescaling`, async () => {
    const bounds = new Box3(new Vector3(...metadata[id].bounds.min), new Vector3(...metadata[id].bounds.max));
    const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const world = new Group(), placement = new Group(), normalization = new Group();
    world.scale.setScalar(WORLD_SCALE);
    world.add(placement); placement.position.set(2, .3, -4); placement.rotation.y = .7;
    placement.add(normalization);
    const scale = 1.25 / size.y;
    normalization.scale.setScalar(scale);
    normalization.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    world.updateMatrixWorld(true);
    const canonicalMatrix = normalization.matrixWorld.clone();
    const view = new PerspectiveCamera(60, 1, .1, 10000), requests = [];
    const controller = createVisualLod({
      root: normalization,
      bounds: bounds.getBoundingSphere(new Sphere()),
      hysteresis: 0,
      levels: [['far', 0], ['medium', 80], ['near', 260]].map(([level, minPixels]) => ({
        id: level, minPixels, load: async () => { requests.push(level); return levels[level].scene.clone(true); },
      })),
    });
    const sphere = bounds.getBoundingSphere(new Sphere()).applyMatrix4(canonicalMatrix);
    const expectedBounds = bounds.clone().applyMatrix4(canonicalMatrix);
    await controller.ready;
    try {
      for (const [index, [level, pixels]] of [['far', 40], ['medium', 150], ['near', 500]].entries()) {
        const depth = sphere.radius * 1000 * view.projectionMatrix.elements[5] / pixels;
        view.position.copy(sphere.center).add(new Vector3(0, 0, depth)); view.lookAt(sphere.center);
        controller.update(index + 1, view, 1000);
        for (let pass = 0; pass < 6 && controller.state.activeLevel !== level; pass++) {
          await new Promise(resolve => setImmediate(resolve));
        }
        assert.equal(controller.state.activeLevel, level);
        world.updateMatrixWorld(true);
        assert.ok(normalization.matrixWorld.equals(canonicalMatrix), `${level}: shared normalization remains fixed`);
        assert.equal(normalization.parent, placement);
        assert.ok(controller.object.matrix.equals(levels[level].scene.matrix), `${level}: tier root retains authored transform`);
        // Compare against the near model under exactly the same shared transform.
        // A coarse tier may change its envelope slightly, never its placement.
        const actualBounds = new Box3().setFromObject(controller.object);
        const source = levels.near.scene.clone(true);
        const reference = new Group(); reference.matrixAutoUpdate = false; reference.matrix.copy(canonicalMatrix); reference.add(source);
        reference.updateMatrixWorld(true);
        assertBounds(actualBounds, new Box3().setFromObject(source), expectedBounds.getSize(new Vector3()).length() * .02, `${id}/${level} placed envelope`);
      }
      assert.deepEqual(requests, ['far', 'medium', 'near']);
    } finally {
      controller.dispose();
    }
  });
}
