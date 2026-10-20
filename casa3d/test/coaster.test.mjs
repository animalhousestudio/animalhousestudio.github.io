import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Quaternion, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCoasterRoute, createCoasterRide, createCoasterSupports, COASTER_DURATION, tunnelPortalBox } from '../src/rooms/coasterLayout.mjs';
import { createCoasterLook } from '../src/player/coasterLook.mjs';
import { createCoasterCart } from '../src/rooms/coasterCart.mjs';
import { batchStaticArchitecture } from '../src/rooms/optimize.mjs';
import { createPondLayout, SECOND_POND_FOOTPRINT, getPondOutline } from '../src/rooms/pondLayout.mjs';
import { prepareAsteroid } from '../src/rooms/asteroid.mjs';
import { createPondBasinGeometry } from '../src/rooms/pondBasin.mjs';
import { cutBasinPortal } from '../src/rooms/basinPortal.mjs';
import { connectedPondVolume, createConnectedPondSwimming } from '../src/player/connectedPonds.mjs';
import { WORLD_SCALE as S } from '../src/rooms/layout.mjs';
import { Player } from '../src/player/movement.js';

const bytes=await readFile(new URL('../src/assets/models/asteroid.glb',import.meta.url));
const loader=new GLTFLoader();loader.register(()=>({name:'GeometryOnlyImages',loadTexture:async()=>new Texture()}));
const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const layouts=[createPondLayout(scene),createPondLayout(scene,{footprint:SECOND_POND_FOOTPRINT})];
const route=createCoasterRoute(), volume=connectedPondVolume(layouts);

test('cart batches into seven material draws without losing triangles or moving its bounds',()=>{
  const cart=createCoasterCart(),before=new Box3().setFromObject(cart);
  const count=()=>{let meshes=0,triangles=0;cart.traverse(node=>{if(node.isMesh){meshes++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});return{meshes,triangles};};
  const original=count();batchStaticArchitecture(cart,Infinity);const optimized=count();
  assert.equal(optimized.meshes,7);assert.equal(optimized.triangles,original.triangles);
  const after=new Box3().setFromObject(cart);assert.ok(before.min.distanceTo(after.min)<1e-6&&before.max.distanceTo(after.max)<1e-6);
});

test('all four parked cars sit straight and level along the extended boarding platform',()=>{
  for(let i=0;i<4;i++){
    const frame=route.frameAt(i?1-i*4.2/route.length:0);
    assert.ok(Math.abs(frame.position.x-9)<.01);
    assert.ok(Math.abs(frame.position.y-.8)<.01);
    assert.ok(frame.forward.dot(new Vector3(0,0,-1))>.999);
    assert.ok(frame.up.dot(new Vector3(0,1,0))>.999);
    assert.ok(frame.position.z>=207-.01&&frame.position.z<226);
  }
});

test('blue cart has an occupied centre seat and two empty side seats without blocking the existing eye',()=>{
  const cart=createCoasterCart(),seats=cart.children.filter(node=>/^Cart_(CentreSeat|EmptySeat)$/.test(node.name));
  assert.equal(seats.length,3);assert.equal(seats.filter(seat=>seat.userData.occupied).length,1);
  assert.equal(seats.find(seat=>seat.userData.occupied).position.x,0);cart.updateMatrixWorld(true);
  const eye=new Vector3(0,2.08,0),ray=new Raycaster();
  for(const yaw of [-Math.PI/3,0,Math.PI/3]){
    ray.set(eye,new Vector3(Math.sin(yaw),0,Math.cos(yaw)));
    assert.equal(ray.intersectObject(cart,true).length,0,'Forward and side glances remain open');
  }
});

test('ride look stays relative to banking, allows bounded left/right movement and resets',()=>{
  const look=createCoasterLook(),frame=route.frameAt(.25);
  const base=frame.quaternion.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI));
  look.rotate(180,-80);assert.ok(look.yaw<0&&look.pitch>0);
  const result=look.apply(base.clone());assert.ok(result.angleTo(base)>.4);
  look.rotate(10000,-10000);assert.equal(look.yaw,-Math.PI/3);assert.equal(look.pitch,Math.PI/9);
  look.reset();assert.ok(look.apply(base.clone()).angleTo(base)<1e-7);
});

test('support columns and crossbars clear the entire passenger corridor, including 15 percent',()=>{
  const supports=createCoasterSupports(route,()=>0);
  assert.ok(supports.length>30);
  const bounds=supports.map(({position,size,quaternion})=>new Box3().setFromCenterAndSize(new Vector3(),size)
    .applyMatrix4(new Matrix4().compose(position,quaternion,new Vector3(1,1,1))));
  for(let i=0;i<=7000;i++){
    const {eye,feet}=route.frameAt(i/7000);
    for(const box of bounds)if(box.max.y>Math.min(eye.y,feet.y)-.2&&box.min.y<Math.max(eye.y,feet.y)+.4){
      const distance=Math.hypot(Math.max(box.min.x-eye.x,0,eye.x-box.max.x),Math.max(box.min.z-eye.z,0,eye.z-box.max.z));
      assert.ok(distance>1,`Support intrudes on passenger at route u=${i/7000}`);
    }
  }
});

test('second lake reuses the exact organic outline and both openings cut the real asteroid surface',()=>{
  const [a,b]=layouts;assert.equal(a.rx,b.rx);assert.equal(a.rz,b.rz);assert.equal(a.waterY,b.waterY);
  const outlineA=getPondOutline(a),outlineB=getPondOutline(b);
  outlineA.forEach(([x,z],i)=>{assert.ok(Math.abs(x-outlineB[i][0])<1e-8);assert.ok(Math.abs((z-a.z)-(outlineB[i][1]-b.z))<1e-8);});
  const asteroid=prepareAsteroid(scene,new MeshBasicMaterial(),{pondLayouts:layouts});
  const ray=new Raycaster();
  for(const layout of layouts){
    ray.set(new Vector3(layout.x,2,layout.z),new Vector3(0,-1,0));
    assert.equal(ray.intersectObject(asteroid.surface).length,0,'No uncut ground above either water volume');
    assert.equal(asteroid.heightAt(layout.x,layout.z),layout.bottomY);
  }
});

test('both lake walls contain actual tunnel apertures while adjacent bank triangles stay closed',()=>{
  for(const [i,layout]of layouts.entries()) {
    const original=createPondBasinGeometry(layout),cut=cutBasinPortal(original,tunnelPortalBox(1/S));
    const before=new Mesh(original,new MeshBasicMaterial()),after=new Mesh(cut,new MeshBasicMaterial());
    before.updateMatrixWorld(true);after.updateMatrixWorld(true);
    const direction=new Vector3(0,0,i?-1:1),ray=new Raycaster(new Vector3(layout.x,-8/S,layout.z),direction);
    assert.ok(ray.intersectObject(before).length,'Original deep bowl blocks the passage');
    assert.equal(ray.intersectObject(after).length,0,'Coaster passes through a real opening, not a hidden wall');
    ray.set(new Vector3(layout.x+6/S,-8/S,layout.z),direction);
    assert.ok(ray.intersectObject(after).length,'The sponde next to the opening remain solid');
    assert.ok(Array.from(cut.attributes.position.array).every(Number.isFinite));
  }
});

test('ride is a closed smooth route around the mansion, out in space and through both connected lakes',()=>{
  let space=0,high=0,submerged=0;
  assert.ok(route.length>2000&&route.length<3000);
  assert.ok(route.frameAt(0).position.distanceTo(route.frameAt(1).position)<1e-6);
  for(let i=0;i<=5000;i++) {
    const frame=route.frameAt(i/5000),p=frame.position,e=frame.eye;
    assert.ok([...p.toArray(),...frame.quaternion.toArray()].every(Number.isFinite));
    assert.ok(Math.abs(frame.up.dot(frame.forward))<1e-7);
    assert.ok(Math.abs(frame.right.length()-1)<1e-7);
    assert.ok(Math.abs(frame.bank)<=.32+1e-8);
    if(Math.hypot(p.x,p.z)>220)space++;
    if(p.y>150)high++;
    if(e.y<layouts[0].waterY*S){
      submerged++;
      const floor=volume.floorAt(e.x/S,e.z/S);
      assert.notEqual(floor,null,`Ride entered solid ground at ${e.toArray()}`);
      assert.ok(e.y>floor*S+.4,`Camera too close to floor at u=${i/5000}: ${e.toArray()}, floor=${floor*S}`);
      const ceiling=volume.ceilingAt(e.x/S,e.z/S);
      if(ceiling<layouts[0].waterY)assert.ok(e.y<ceiling*S-.4);
    }
    // Conservative main-house envelope; route may fly above it, never through it.
    assert.ok(!(p.x>-72&&p.x<92&&p.z>-65&&p.z<48&&p.y<150),'Track intersects mansion envelope');
  }
  assert.ok(space>1000&&high>1000&&submerged>50);
});

test('ride starts once, pauses, cancels and finishes at the station consistently at 30/60 FPS',()=>{
  for(const dt of [1/30,1/60]){
    const ride=createCoasterRide(route);assert.equal(ride.active,false);assert.equal(ride.start(),true);assert.equal(ride.start(),false);
    ride.update(0);assert.equal(ride.progress,0);
    let frame;for(let i=0;i<Math.ceil(COASTER_DURATION/dt)+1;i++)frame=ride.update(dt);
    assert.equal(frame.finished,true);assert.ok(frame.position.distanceTo(route.frameAt(0).position)<1e-6);
    assert.equal(ride.stop(),true);assert.equal(ride.stop(),false);assert.equal(ride.update(dt),null);
    assert.equal(ride.start(),true);assert.equal(ride.progress,0);
  }
});

test('the underwater passage can also be swum between lakes and its roof contains ascent',()=>{
  const player=new Player(new PerspectiveCamera(),null,{speed:7.6,pondSwimming:createConnectedPondSwimming(layouts)});
  player.setPosition(new Vector3(-120,-8,20));player.yaw=0;player.setMoveState({forward:true});
  for(let i=0;i<450;i++)player.update(1/30,[]);
  assert.ok(player.getPosition().z>78,`Could not reach second pond: ${player.getPosition().toArray()}`);
  player.setPosition(new Vector3(-120,-8,45));player.setMoveState({forward:false,up:true});
  for(let i=0;i<300;i++)player.update(1/30,[]);
  assert.ok(player.getPosition().y<=-4.4,'Cannot rise through the tunnel ceiling');
});
