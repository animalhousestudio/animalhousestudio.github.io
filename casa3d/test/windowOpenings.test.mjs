import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3, Texture, DoubleSide } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const bytes = await readFile(new URL('../src/assets/models/mansion-v09.glb', import.meta.url));
const loader = new GLTFLoader();
loader.register(() => ({ name: 'GeometryOnlyImages', loadTexture: async () => new Texture() }));
const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
scene.updateMatrixWorld(true);
const front = [], east = [], west = [];
scene.traverse(node => {
  if (!node.isMesh) return;
  for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.side = DoubleSide;
  if (node.name.startsWith('M01_Reuse_CURVE_Front_Clapboard_')) front.push(node);
  if (node.name.startsWith('M01_Reuse_CURVE_Right_Clapboard_')) east.push(node);
  if (node.name.startsWith('M01_Reuse_CURVE_Left_Clapboard_')) west.push(node);
});

test('all six repaired windows are real through-openings, including both faces and arch crowns', () => {
  for (const [name, x, z, w, h, arch] of [
    ['FrontLeft', -3.83, 2.78, .74, 3.48, 0], ['FrontRight', 3.72, 2.76, 1.10, 4.35, 1.04],
    ['UpperLeft', -3.09, 10.66, 1.84, 4.50, .91], ['UpperRight', 2.84, 10.66, 1.84, 4.50, .91],
  ]) {
    assert.ok(scene.getObjectByName(`M08_Window_${name}_Glass`));
    for (const dx of [-w * .43, 0, w * .43]) for (const height of [z + .06, z + (h - arch) * .52, z + h - arch - .04]) {
      const ray = new Raycaster(new Vector3(x + dx, height, 9), new Vector3(0, 0, -1), 0, 6);
      assert.equal(ray.intersectObjects(front).length, 0, `Opaque cladding inside ${name} at ${dx}, ${height}`);
    }
    if (arch) {
      const ray = new Raycaster(new Vector3(x, z + h - .04, 9), new Vector3(0, 0, -1), 0, 6);
      assert.equal(ray.intersectObjects(front).length, 0, `Blocked arch crown ${name}`);
    }
  }
  for (const [name, y, bottom, height, width] of [['EastLower', 1.77, 2.98, 2.94, .65], ['EastUpper', 2.67, 10.79, 2.91, .63]]) {
    assert.ok(scene.getObjectByName(`M08_Window_${name}_Glass`));
    for (const dy of [-width * .43, 0, width * .43]) for (const dz of [.06, height / 2, height - .06]) {
      const ray = new Raycaster(new Vector3(10, bottom + dz, -y - dy), new Vector3(-1, 0, 0), 0, 4);
      assert.equal(ray.intersectObjects(east).length, 0, `Opaque cladding inside ${name}`);
    }
  }
});

test('side-door wall edges stop inside the wooden jambs without coplanar faces', () => {
  for (const [y, bottom, top] of [[-1.2, 1.487, 4.447], [-.3, 9.912, 12.872]]) {
    for (const side of [-1, 1]) for (const z of [bottom + .03, (bottom + top) / 2, top - .03]) {
      const ray = new Raycaster(new Vector3(-10, z, -(y + side * .829)), new Vector3(1, 0, 0), 0, 3);
      assert.equal(ray.intersectObjects(west).length, 0, 'Wall end overlaps the visible wooden reveal');
    }
  }
});

test('obsolete fake windows and primitive exterior planters are absent', () => {
  scene.traverse(node => assert.ok(!/^M01_Reuse_(DET_|EXT_Planter_|EXT_Plant_|EXT_Organic_Planter_|EXT_WindowSet_RightUpper_recess)/.test(node.name), node.name));
});
