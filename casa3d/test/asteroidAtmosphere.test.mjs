import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera } from 'three';
import { addAsteroidAtmosphere } from '../src/rooms/asteroidAtmosphere.mjs';
import { createCoasterRoute, createCoasterSupports } from '../src/rooms/coasterLayout.mjs';
import { LANDING_Z } from '../src/arrival.mjs';
import { HOUSE_X, HOUSE_Z, WORLD_SCALE } from '../src/rooms/layout.mjs';
import { captureCollisionSource } from '../src/player/collisionWorld.mjs';

test('asteroid atmosphere keeps a fixed light budget, animates locally and disposes its resources', () => {
  const world = new Group();
  world.scale.setScalar(WORLD_SCALE);
  const supports = createCoasterSupports(createCoasterRoute(),() => 0);
  const effect = addAsteroidAtmosphere(world,() => 0,supports);
  const root = world.getObjectByName('AsteroidAtmosphere');
  const camera = new PerspectiveCamera();
  camera.position.set(0,10,211);
  const lights = root.children.filter(node => node.isSpotLight);
  const smoke = root.getObjectByName('AsteroidColorSmoke');
  const mist = root.getObjectByName('AsteroidGroundMist');
  assert.equal(lights.length,3);
  assert.ok(lights.every(light => !light.castShadow));
  assert.equal(smoke.geometry.instanceCount,effect.state.vents*18);
  const origins = smoke.geometry.getAttribute('origin');
  for (let i=0;i<origins.count;i++)
    assert.ok(Math.hypot(origins.getX(i)/30,(origins.getZ(i)-LANDING_Z*WORLD_SCALE)/26)>=1.35);
  assert.equal(captureCollisionSource(root).length,0);
  assert.equal(effect.state.highFixtures,14);
  assert.equal(effect.state.groundFixtures,4);
  assert.ok(effect.state.vents>=48);
  assert.ok(lights.every(light => light.angle >= .55));
  effect.update(0,camera);
  assert.equal(effect.state.smoke,false);
  assert.equal(mist.visible,false);
  assert.equal(effect.state.groundIndex,-1);
  effect.update(23,camera,{previewTarget:supports.find(s => s.column?.span === 23).position});
  assert.ok(lights.slice(0,2).every(light => light.intensity>0 && light.position.y>=85));
  for (const light of lights.slice(0,2).filter(light => light.intensity>0)) {
    assert.ok(light.position.y>=85);
    assert.ok(Math.hypot(light.target.position.x-HOUSE_X,light.target.position.z-HOUSE_Z)<15);
    assert.ok(supports.some(s => s.column && Math.abs(s.position.y+s.size.y/2-light.position.y-2.7)<1e-8
      && Math.hypot(s.position.x-light.position.x,s.position.z-light.position.z)<.87));
  }
  const groundOrigins = new Set();
  for (const [time,index] of [[9.99,-1],[10,0],[13.99,0],[14,1],[18,2],[22,3],[26,0]]) {
    effect.update(time,camera,{previewTarget:camera.position});
    assert.equal(effect.state.groundIndex,index);
    assert.equal(lights[2].intensity>0,index>=0);
    if (index>=0) {
      assert.ok(lights[2].target.position.y>lights[2].position.y);
      groundOrigins.add(lights[2].position.toArray().join(','));
    }
  }
  assert.equal(groundOrigins.size,4);
  assert.ok(smoke.visible);
  assert.ok(mist.visible);
  assert.equal(mist.material.uniforms.grain.value,smoke.material.uniforms.grain.value);
  camera.position.y = 120;
  effect.update(40,camera);
  assert.equal(mist.visible,false);
  effect.update(41,camera,{enabled:false});
  assert.equal(smoke.visible,false);
  assert.ok(lights.every(light => light.intensity===0));
  const assets = [smoke.geometry,smoke.material,mist.geometry,mist.material,smoke.material.uniforms.grain.value];
  let released = 0;
  assets.forEach(asset => asset.addEventListener('dispose',() => released++));
  effect.dispose();
  assert.equal(released,assets.length);
  assert.equal(world.children.length,0);
});
