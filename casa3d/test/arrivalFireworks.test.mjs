import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { COASTER_FIREWORKS, createArrivalFlares, createArrivalFireworks, createCoasterFireworks } from '../src/arrivalFireworks.mjs';
import { COASTER_DURATION, createCoasterRoute, createCoasterRide } from '../src/rooms/coasterLayout.mjs';

const bounds = new Box3(new Vector3(-245,-75,-225),new Vector3(245,153,238));

function checkShow(layout, count) {
  const scene = new Scene();
  const fireworks = createArrivalFireworks(scene,{bounds,...layout});
  const group = scene.getObjectByName('ArrivalFireworks');
  const [sparks, trails] = group.children;
  assert.equal(group.children.length, 2);
  assert.equal(sparks.geometry.attributes.position.count,count*120);
  assert.equal(trails.geometry.attributes.position.count,count*360);
  const {normal:axes,edge} = group.userData.rearPlane;
  const normal = new Vector3(...axes), position = new Vector3(), speed = new Vector3();
  const attrs = sparks.geometry.attributes;
  for (let i=0;i<attrs.position.count;i++) {
    const age = attrs.spark.getY(i);
    const travel = (1-Math.exp(-age*1.65))/1.65+age*.16;
    const projected = position.fromBufferAttribute(attrs.position,i).dot(normal)
      + Math.max(0,speed.fromBufferAttribute(attrs.velocity,i).dot(normal))*travel;
    assert.ok(projected < edge);
  }
  for (let i=0;i<=20;i++) assert.ok(layout.sample(i/20).position.dot(normal)>edge);
  const resources = [sparks.geometry, sparks.material, trails.geometry, trails.material];
  let released = 0;
  resources.forEach(resource => resource.addEventListener('dispose', () => released++));
  fireworks.update(4, 660);
  assert.equal(sparks.material.uniforms.elapsed.value, 4);
  assert.equal(trails.material.uniforms.viewportHeight.value, 660);
  assert.equal(sparks.geometry.attributes.position.version, 0);
  fireworks.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(released, resources.length);
}

test('arrival bursts remain behind the world and release both fixed buffers', () => {
  checkShow({duration:14,sample: t => ({position:new Vector3(0,90-80*t,1600-1385*t),
    forward:new Vector3(0,-.14,-1).normalize()})},32);
});

test('the coaster keeps dense overlapping bursts in bounded windows throughout the ride', () => {
  const ride = createCoasterRide(createCoasterRoute());
  const {start,end} = COASTER_FIREWORKS;
  assert.ok(start <= .12 && end >= .98);
  const scene = new Scene();
  const duration = (end-start)*COASTER_DURATION;
  const show = createCoasterFireworks(scene,{bounds,duration,sample:t => {
    const {eye,forward,up} = ride.sample(start+t*(end-start));
    return {position:eye,forward,up};
  }});
  const group = scene.getObjectByName('ArrivalFireworks');
  show.update(4.9,720);
  const prior = group.children[0].geometry;
  const positionsAt = (geometry,cue) => {
    const {spark,position} = geometry.attributes;
    const positions = [];
    for (let i=0;i<spark.count;i++) if (Math.abs(spark.getX(i)-cue)<.113)
      positions.push([position.getX(i),position.getY(i),position.getZ(i)]);
    return positions;
  };
  show.update(5,720);
  assert.notEqual(prior,group.children[0].geometry);
  assert.equal(positionsAt(prior,4.59).length,120);
  assert.deepEqual(positionsAt(prior,4.59),positionsAt(group.children[0].geometry,4.59));
  for (const time of [0,25,43,65,82,duration-.3]) {
    show.update(time,720);
    assert.ok(group.userData.cues>=18 && group.userData.cues<=32,`cues at ${time}`);
    assert.equal(group.children.length,2);
  }
  show.update(75,720,false);
  assert.equal(group.visible,false);
  show.dispose();
  assert.equal(scene.children.length,0);
});

test('five bengals spread around the world direction to the house and switch off before landing', () => {
  const camera = new PerspectiveCamera();
  camera.position.set(25,80,260);
  camera.lookAt(0,20,0);
  const house = new Vector3(0,8,0);
  const show = createArrivalFlares(camera,14,house);
  const group = camera.getObjectByName('ArrivalFlares');
  const [core,rays] = group.children;
  const {position,emitter} = core.geometry.attributes;
  assert.equal(group.userData.emitters,5);
  assert.equal(position.count,5*6);
  assert.equal(rays.geometry.attributes.position.count,5*260);
  assert.deepEqual(Array.from({length:5},(_,i)=>emitter.getX(i*6)),[0,1,2,3,4]);
  assert.ok([...rays.geometry.attributes.pattern.array].every(Number.isFinite));
  const {origins,tips,cutoff} = core.material.uniforms;
  for (const [aspect,eye,look] of [
    [16/9,[25,80,260],[0,20,0]],
    [.8,[-30,37,95],[0,34,0]],
  ]) {
    camera.aspect = aspect;
    camera.position.set(...eye);
    camera.lookAt(...look);
    camera.updateProjectionMatrix();
    show.update(4);
    const yawOffsets = origins.value.map((local,i) => {
      assert.ok(local.clone().applyMatrix4(camera.projectionMatrix).y < -1.1);
      const origin = camera.localToWorld(local.clone());
      const forward = house.clone().sub(origin).normalize();
      const direction = camera.localToWorld(tips.value[i].clone()).sub(origin).normalize();
      assert.ok(direction.dot(forward)>.8);
      assert.ok(Math.abs(direction.y-forward.y)<1e-9);
      return Math.atan2(new Vector3().crossVectors(forward,direction).y,
        forward.x*direction.x+forward.z*direction.z);
    });
    assert.ok(yawOffsets[0]>.5 && yawOffsets.at(-1)<-.5);
    assert.ok(yawOffsets.every((yaw,i)=>i===0 || yawOffsets[i-1]-yaw>.18));
  }
  assert.equal(core.material.uniforms.elapsed.value,4);
  assert.ok(core.material.depthTest);
  assert.ok(cutoff.value<12);
  show.update(12);
  assert.equal(group.visible,false);
  show.dispose();
  assert.equal(camera.children.length,0);
});
