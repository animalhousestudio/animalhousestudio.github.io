import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createArrivalFireworks } from '../src/arrivalFireworks.mjs';

test('the flight uses two draws with fixed buffers and releases every resource on landing', () => {
  const camera = new PerspectiveCamera(75, 16 / 9);
  const fireworks = createArrivalFireworks(camera, {
    duration: 14,
    launchAt: progress => new Vector3(0, 25, 300 - progress * 100),
    target: new Vector3(8, 15, 0),
    groundAt: () => 1.2,
  });
  const group = camera.getObjectByName('ArrivalFireworks');
  const [sparks, trails] = group.children;
  assert.equal(group.children.length, 2);
  assert.equal(sparks.geometry.attributes.position.count, 7844);
  assert.equal(trails.geometry.attributes.position.count, 23088);
  assert.deepEqual([...new Set(sparks.geometry.attributes.effect.array)], [0, 1, 2]);
  const firstFountain = sparks.geometry.attributes.effect.array.indexOf(2);
  assert.ok(Math.abs(sparks.geometry.attributes.position.getY(firstFountain) - 1.32) < .001);
  const resources = [sparks.geometry, sparks.material, trails.geometry, trails.material];
  let released = 0;
  resources.forEach(resource => resource.addEventListener('dispose', () => released++));
  fireworks.update(4, 660);
  assert.equal(sparks.material.uniforms.elapsed.value, 4);
  assert.equal(trails.material.uniforms.viewportHeight.value, 660);
  assert.equal(sparks.geometry.attributes.position.version, 0);
  fireworks.dispose();
  assert.equal(camera.children.length, 0);
  assert.equal(released, resources.length);
});
