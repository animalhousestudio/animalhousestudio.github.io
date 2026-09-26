import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Group, Box3, PerspectiveCamera, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createInterior } from '../src/rooms/interior.mjs';
import { Player } from '../src/player/movement.js';
import { WORLD_SCALE, BASE_FLOOR_Y, FLOOR_Y, HOUSE_X, HOUSE_Z, EYE_HEIGHT, BASE_HOUSE_X, BASE_HOUSE_Z } from '../src/rooms/layout.mjs';

test('5x environment uses authored upper slabs with aligned human eye height',async()=>{
  const world=new Group();world.scale.setScalar(WORLD_SCALE);
  const rooms=FLOOR_Y.map((_,i)=>createInterior(i));world.add(...rooms);
  const bytes=await readFile(new URL('../src/assets/models/mansion-v09.glb',import.meta.url));
  const loader=new GLTFLoader();
  loader.register(()=>({name:'GeometryOnlyImages',loadTexture:async()=>new Texture()}));
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.position.set(BASE_HOUSE_X,0,BASE_HOUSE_Z);world.add(scene);world.updateMatrixWorld(true);
  const basementFloor=new Box3().setFromObject(rooms[0].getObjectByName('WalkingSurface'));
  assert.ok(Math.abs(basementFloor.max.y-BASE_FLOOR_Y[0]*WORLD_SCALE)<1e-5);
  const player=new Player(new PerspectiveCamera(),null);
  player.setPosition(new Vector3(HOUSE_X+2,FLOOR_Y[0]+EYE_HEIGHT+.1,HOUSE_Z+7));
  for(let frame=0;frame<120;frame++)player.update(1/60,[basementFloor]);
  assert.ok(Math.abs(player.camera.position.y-FLOOR_Y[0]-EYE_HEIGHT)<1e-5);
  for(let i=1;i<rooms.length;i++) {
    assert.equal(rooms[i].children.length,0,'No phantom rectangular upper floor or wall');
    const ray=new Raycaster(new Vector3(HOUSE_X-2.5*WORLD_SCALE,FLOOR_Y[i]+.5,HOUSE_Z),new Vector3(0,-1,0),0,1);
    const hits=ray.intersectObject(scene,true);
    assert.ok(hits.length,`Authored floor ${i} supplies walking geometry`);
    assert.ok(Math.abs(hits[0].point.y-FLOOR_Y[i])<.005,`Floor ${i} is ${hits[0].point.y}`);
  }
  assert.equal(WORLD_SCALE,5);
  assert.equal(EYE_HEIGHT,1.65);
});
