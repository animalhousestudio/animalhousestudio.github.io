import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Group,PerspectiveCamera,Vector3,Texture} from 'three';
import {prepareAccess} from '../src/rooms/access.mjs';import {Player} from '../src/player/movement.js';
import {CollisionWorld} from '../src/player/collisionWorld.mjs';
import {HOUSE_X,HOUSE_Z,WORLD_SCALE as S,EYE_HEIGHT as E,BASE_HOUSE_X,BASE_HOUSE_Z,BASE_FLOOR_Y} from '../src/rooms/layout.mjs';
const bytes=await readFile(new URL('../src/assets/models/mansion-v09.glb',import.meta.url));
const loader=new GLTFLoader();
loader.register(()=>({name:'GeometryOnlyImages',loadTexture:async()=>new Texture()}));
const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.updateMatrixWorld(true);
const nav=prepareAccess(scene,{authoredThresholds:true});
scene.position.set(BASE_HOUSE_X,0,BASE_HOUSE_Z);
const world=new Group();world.scale.setScalar(S);world.add(scene);world.updateMatrixWorld(true);
const collisions=new CollisionWorld().addRoot(scene).build();
for(const [name,index,start,end,height] of [['veranda',1,[-6,1.2],[-10.9,1.2],.441],['voliera',2,[-6,.3],[-10,.3],9.912],['torre est',2,[6.7,.1],[14,.1],9.845],['torre ovest',3,[-6,3],[-12.5,4.5],17.233]]){
 test(`continuous walking route to ${name}`,()=>{
  const player=new Player(new PerspectiveCamera(),null,{groundHeightAt:nav.heightAt});
  player.setPosition(new Vector3(HOUSE_X+start[0]*S,BASE_FLOOR_Y[index]*S+E,HOUSE_Z+start[1]*S));
  player.yaw=Math.atan2(end[0]-start[0],end[1]-start[1]);player.setMoveState({forward:true});
  const frames=Math.ceil(Math.hypot(end[0]-start[0],end[1]-start[1])*S/4*60);
  for(let i=0;i<frames;i++)player.update(1/60,collisions);
  player.setMoveState({forward:false});for(let i=0;i<60;i++)player.update(1/60,collisions);
  assert.ok(Math.hypot(player.camera.position.x-(HOUSE_X+end[0]*S),player.camera.position.z-(HOUSE_Z+end[1]*S))<.6,`blocked at ${player.camera.position.toArray()}`);
  assert.ok(Math.abs(player.camera.position.y-E-height*S)<.12,`unsupported at ${player.camera.position.y-E}`);
 });
}
