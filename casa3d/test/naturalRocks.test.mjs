import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRockTemplate, naturalRockPose, naturalRockTransform } from '../src/rooms/rockPlacement.mjs';
import { naturalRockPlacements, isRockFootprintClear } from '../src/rooms/rockLayout.mjs';
import { terrainHeight } from '../src/rooms/terrainDetail.mjs';

const bytes = await readFile(new URL('../src/assets/models/rocks-natural.glb', import.meta.url));
const loader = new GLTFLoader();
loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
scene.updateMatrixWorld(true);
const templates = [];
scene.traverse(node => { if (node.isMesh) templates.push(createRockTemplate(node)); });
templates.sort((a, b) => a.name.localeCompare(b.name));

test('both authored stones rest on their broad sides without adding mesh detail', () => {
  assert.equal(templates.length, 2);
  for (const template of templates) {
    const size = template.geometry.boundingBox.getSize(new Vector3());
    assert.ok(size.y < .65, `${template.name} still stands on its narrow end`);
    assert.ok(Math.abs(Math.max(size.x, size.z) - 1) < 1e-6);
    assert.equal(template.geometry.index.count, scene.getObjectByName(template.name).geometry.index.count);
  }
});

test('rock poses retain a varied deterministic tilt and burial between 18 and 38 percent', () => {
  const poses = naturalRockPlacements.map(naturalRockPose);
  assert.ok(new Set(poses.map(pose => pose.burial.toFixed(2))).size > 10);
  assert.ok(new Set(poses.map(pose => pose.tiltX.toFixed(2))).size > 10);
  naturalRockPlacements.forEach((placement, index) => {
    assert.deepEqual(naturalRockPose({ ...placement }), poses[index]);
    const template = templates[placement.size < 1.2 ? 1 : index % 2];
    const { bounds, matrix, pose } = naturalRockTransform(template, placement, () => 0);
    const height = bounds.max.y - bounds.min.y;
    const buried = -bounds.min.y / height;
    assert.ok(buried >= .18 - 1e-7 && buried <= .38 + 1e-7);
    assert.ok(Math.abs(buried - pose.burial) < 1e-7);
    assert.ok(bounds.max.y > 0);
    assert.ok(matrix.elements.every(Number.isFinite));
  });
});

test('tilted stones seat their lower surface into slopes and the actual landscape', () => {
  for (const heightAt of [terrainHeight, (x, z) => .2 * x + .12 * z]) {
    for (let i = 0; i < naturalRockPlacements.length; i++) {
      const placement = naturalRockPlacements[i];
      const template = templates[placement.size < 1.2 ? 1 : i % 2];
      const { matrix, bounds } = naturalRockTransform(template, placement, heightAt);
      const footprint = { minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z };
      if (!isRockFootprintClear(footprint)) continue;
      const vertices = template.geometry.getAttribute('position');
      const point = new Vector3();
      const lowerBand = bounds.min.y + (bounds.max.y - bounds.min.y) * .15;
      let aboveGround = false, embedded = 0;
      for (let v = 0; v < vertices.count; v++) {
        point.fromBufferAttribute(vertices, v).applyMatrix4(matrix);
        assert.ok(point.x >= bounds.min.x - 1e-6 && point.x <= bounds.max.x + 1e-6);
        assert.ok(point.z >= bounds.min.z - 1e-6 && point.z <= bounds.max.z + 1e-6);
        if (point.y <= lowerBand) {
          assert.ok(point.y < heightAt(point.x, point.z), `Floating base at rock ${i}`);
          embedded++;
        }
        aboveGround ||= point.y > heightAt(point.x, point.z);
      }
      assert.ok(embedded > 0);
      assert.ok(aboveGround, `Rock ${i} entirely buried`);
    }
  }
});
