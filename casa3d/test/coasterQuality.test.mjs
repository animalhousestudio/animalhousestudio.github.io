import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { coasterVisualQuality,grassCellCount } from '../src/rooms/coasterQuality.mjs';
import { createCoasterRoute,createCoasterRide } from '../src/rooms/coasterLayout.mjs';

test('approach to the house and lake uses only resident far assets along the actual ride',()=>{
  const ride=createCoasterRide(createCoasterRoute());
  for(const progress of [.65,.675,.7,.725,.75,.76]){
    assert.equal(coasterVisualQuality(true,ride.sample(progress).eye,0).maxDetail,0,`progress ${progress}`);
  }
  assert.equal(coasterVisualQuality(true,ride.sample(.4).eye,0).maxDetail,1);
});

test('ride grass has a three percent ceiling, fades with altitude and vanishes above nine metres',()=>{
  assert.equal(coasterVisualQuality(true,new Vector3(0,3,200),0).grassDensity,.03);
  const middle=coasterVisualQuality(true,new Vector3(0,6,200),0).grassDensity;
  assert.ok(middle>0&&middle<.03);
  for(const y of [-1,9,40,200])assert.equal(coasterVisualQuality(true,new Vector3(0,y,200),0).grassDensity,0);
  assert.equal(coasterVisualQuality(true,new Vector3(0,7,200),4).grassDensity,.03,'Height is measured above terrain');
  assert.equal(coasterVisualQuality(true,new Vector3(0,3,200),null).grassDensity,0);
});

test('all grass draws can reach zero, distant cells stay off, and walking restores normal density',()=>{
  assert.equal(grassCellCount(1000,1,3,0,true),0);
  assert.equal(grassCellCount(1000,8,3,.03,true),0);
  assert.equal(grassCellCount(1000,1,3,.03,true),30);
  assert.equal(grassCellCount(1000,1,3,1,false),1000);
  const quality=coasterVisualQuality(false,new Vector3(0,4,0),0);
  assert.equal(quality.maxDetail,Infinity);assert.equal(quality.grassDensity,1);
});
