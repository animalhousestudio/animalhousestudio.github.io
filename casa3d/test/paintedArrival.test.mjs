import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Scene, Vector3 } from 'three';
import { createPaintedArrival } from '../src/paintedArrival.mjs';
import { ARRIVAL_DURATION, createArrival } from '../src/arrival.mjs';

const bounds=new Box3(new Vector3(-220,-130,-220),new Vector3(220,98,220));

function setup(detail){
  const scene=new Scene(),camera=new PerspectiveCamera(75,1.6,.1,4000);
  const arrival=createArrival(1.6,2);
  camera.position.copy(arrival.start);
  camera.lookAt(arrival.sample(0).focus);
  const flight=createPaintedArrival(scene,camera,arrival,bounds,detail);
  const pass={target:null,draws:0,
    getDrawingBufferSize(size){return size.set(1600,1000);},
    getRenderTarget(){return this.target;},
    setRenderTarget(target){this.target=target;},
    render(field){
      this.draws++;
      this.surface=this.target;
      this.material=field.children[0].material;
    },
  };
  return {scene,camera,flight,pass};
}

test('turbulence advances at a fixed viewpoint, follows camera motion, and scales with the device',t=>{
  const fetch=t.mock.method(globalThis,'fetch',()=>{throw Error('unexpected image request');});
  let previousWidth=0,previousSteps=0;
  for(const tier of [1,2,3]){
    const {flight,pass,camera}=setup(tier);
    flight.update(.12,900);flight.renderSmoke(pass);
    const {uniforms,defines}=pass.material;
    assert.equal(pass.target,null);
    assert.ok(pass.surface.width>previousWidth && defines.STEPS>previousSteps);
    previousWidth=pass.surface.width;previousSteps=defines.STEPS;
    assert.equal(pass.surface.height,Math.round(previousWidth/1.6));
    const firstTime=uniforms.seconds.value,start=uniforms.eye.value.clone();
    flight.update(.19,900);
    assert.ok(uniforms.seconds.value>firstTime);
    assert.ok(uniforms.eye.value.equals(start));
    camera.position.z-=25;
    flight.update(.23,900);
    assert.ok(uniforms.eye.value.distanceTo(start)>1);
    assert.equal(fetch.mock.callCount(),0);
    flight.dispose();
  }
});

test('the last puff and burst release their resources before touchdown; interruption is idempotent',()=>{
  for(const complete of [true,false]){
    const {scene,camera,flight,pass}=setup(2);
    flight.update(.1,900);flight.renderSmoke(pass);
    const resources=new Set([pass.surface,pass.material,pass.material.uniforms.noiseMap.value]);
    scene.traverse(obj=>{if(obj.geometry){resources.add(obj.geometry);resources.add(obj.material);}});
    camera.traverse(obj=>{if(obj.geometry){resources.add(obj.geometry);resources.add(obj.material);}});
    const releases=new Map();
    for(const resource of resources)resource.addEventListener('dispose',()=>releases.set(resource,(releases.get(resource)??0)+1));
    const show=scene.getObjectByName('ArrivalFireworks');
    assert.equal(show.visible,false);
    assert.equal(show.children[0].geometry.attributes.position.count,3840);
    if(complete){
      assert.ok(flight.update(.41,900)>0);
      assert.equal(show.visible,true);
      assert.ok(scene.getObjectByName('ArrivalSmoke'));
      assert.ok(camera.getObjectByName('ArrivalFlares'));
      flight.update(6200/ARRIVAL_DURATION,900);flight.renderSmoke(pass);
      assert.equal(pass.draws,1);
      assert.equal(releases.get(pass.surface),1);
      assert.equal(scene.getObjectByName('ArrivalSmoke'),undefined);
      assert.equal(camera.getObjectByName('ArrivalFlares'),undefined);
      assert.equal(show.visible,true);
      flight.update(.91,900);
      assert.equal(scene.getObjectByName('ArrivalFireworks'),undefined);
    }
    flight.dispose();flight.dispose();
    assert.equal(scene.children.length,0);
    assert.equal(camera.children.length,0);
    assert.equal(releases.size,resources.size);
    assert.ok([...releases.values()].every(count=>count===1));
  }
});
