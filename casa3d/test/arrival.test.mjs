import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { prepareAsteroid } from '../src/rooms/asteroid.mjs';
import { createArrival, LANDING_Z } from '../src/arrival.mjs';
import { Player } from '../src/player/movement.js';
import { PerspectiveCamera } from 'three';
import { craters, propPlacements, rockPlacements, terrainHeight, bareSoil } from '../src/rooms/terrainDetail.mjs';

test('sculpted craters match visible ground, keep house garden flat and details within the rim', async () => {
  const t = await terrain();
  t.model.updateMatrixWorld(true);
  for (const c of craters) {
    assert.ok(t.heightAt(c.x, c.z) < -.35);
    assert.equal(bareSoil(c.x, c.z), 1);
    const ray = new Raycaster(new Vector3(c.x, 10, c.z), new Vector3(0, -1, 0));
    const hit = ray.intersectObject(t.surface)[0];
    assert.ok(hit);
    assert.ok(Math.abs(hit.point.y - t.heightAt(c.x, c.z)) < .09);
  }
  for (let x = -14; x <= 21; x += 1) for (let z = -12; z <= 18; z += 1) {
    assert.ok(Math.abs(terrainHeight(x, z)) < 1e-8, `protected garden ${x},${z}`);
  }
  for (const p of [...propPlacements, ...rockPlacements]) assert.notEqual(t.heightAt(p.x, p.z), null);
  for (const [x,z] of t.boundary.flat()) assert.ok(Math.abs(terrainHeight(x,z)) < 1e-8);
});

async function terrain() {
  const bytes = await readFile(new URL('../src/assets/models/asteroid.glb', import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  return prepareAsteroid(gltf.scene, new MeshStandardMaterial());
}

test('export has only the two intended meshes; support follows the actual rim and house opening', async () => {
  const t = await terrain();
  let meshes = 0;
  t.model.traverse(n => { if (n.isMesh) meshes++; });
  assert.equal(meshes, 2);
  assert.equal(t.boundary.length, 160);
  assert.equal(t.heightAt(0, LANDING_Z), 0);
  assert.equal(t.heightAt(0, 15), 0);
  assert.equal(t.heightAt(0, 0), null);
  assert.equal(t.heightAt(60, 0), null);
  assert.equal(t.heightAt(45, 45), null);
  t.model.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(0, 10, LANDING_Z), new Vector3(0, -1, 0));
  assert.ok(Math.abs(ray.intersectObject(t.surface)[0].point.y) < 1e-5);
});

test('desktop and portrait flight remain above the terrain, finish inside the edge, and face the house', async () => {
  const t = await terrain();
  for (const aspect of [16/9, 390/844]) {
    const arrival = createArrival(aspect, .37);
    assert.ok(arrival.start.z >= 320);
    let previous = arrival.start;
    for (let i=0; i<=1000; i++) {
      const frame = arrival.sample(i/1000);
      assert.ok(frame.position.z <= previous.z + 1e-6);
      assert.ok(frame.position.y >= .37 - 1e-6);
      if (t.heightAt(frame.position.x, frame.position.z) !== null) assert.ok(frame.position.y >= .35);
      previous = frame.position;
    }
    assert.ok(arrival.sample(1).position.distanceTo(arrival.end) < 1e-6);
    assert.equal(arrival.sample(1).focus.z, 0);
    // The final point lies a few metres inward of the real front edge.
    const edge = Math.max(...t.boundary.flat().filter(([x]) => Math.abs(x) < 1.5).map(([,z]) => z));
    assert.ok(edge - LANDING_Z > 1 && edge - LANDING_Z < 10);
  }
});

test('player remains supported at landing and walking toward the garden; no invisible floor outside', async () => {
  const t = await terrain();
  const player = new Player(new PerspectiveCamera(), null, { groundHeightAt: t.heightAt });
  player.setPosition(new Vector3(0,1.67,LANDING_Z));
  player.yaw = Math.PI;
  player.setMoveState({forward:true});
  for (let i=0;i<240;i++) player.update(1/60, []);
  assert.ok(player.getPosition().z < LANDING_Z - 10);
  assert.ok(Math.abs(player.getPosition().y - 1.65) < 1e-6);
  player.setMoveState({forward:false});
  player.setPosition(new Vector3(60,1.67,0));
  for (let i=0;i<60;i++) player.update(1/60, []);
  assert.ok(player.getPosition().y < -1);
});
