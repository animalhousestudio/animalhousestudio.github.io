import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Raycaster,Vector3} from 'three';
import {fitStairOpenings} from '../src/rooms/stairFloor.mjs';
import {STAIR_OPENING_RADIUS,STAIR_OUTER_RADIUS,STAIR_TRAVEL_RADIUS,STAIR_TURNS} from '../src/rooms/stairLayout.mjs';
import {WORLD_SCALE,BASE_FLOOR_Y} from '../src/rooms/layout.mjs';

test('replacement slab closes the old opening while preserving the compact stair shaft',async()=>{
  const b=await readFile(new URL('../src/assets/models/mansion-v04.glb',import.meta.url));
  const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
  const fill=fitStairOpenings(scene);scene.updateMatrixWorld(true);
  for(const top of [1.487,9.912,17.2,22.32]){
    for(const [x,z] of [[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]]){
      const ray=new Raycaster(new Vector3(x,top+.1,z),new Vector3(0,-1,0),0,.2);
      const hits=ray.intersectObject(fill,true);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-top)<1e-5);
    }
    assert.equal(new Raycaster(new Vector3(0,top+.1,0),new Vector3(0,-1,0),0,.2).intersectObject(fill,true).length,0);
  }
  assert.ok(STAIR_OPENING_RADIUS>STAIR_OUTER_RADIUS);
  assert.ok((STAIR_OUTER_RADIUS-STAIR_TRAVEL_RADIUS)*WORLD_SCALE>.35);
  for(let i=0;i<STAIR_TURNS.length;i++)assert.ok((BASE_FLOOR_Y[i+1]-BASE_FLOOR_Y[i])*WORLD_SCALE/STAIR_TURNS[i]>2.5);
});
