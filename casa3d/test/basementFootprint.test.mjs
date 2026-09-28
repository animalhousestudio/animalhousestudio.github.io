import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createInterior } from '../src/rooms/interior.mjs';
import { BASEMENT_FOOTPRINT } from '../src/rooms/basementFootprint.mjs';
import { BASE_HOUSE_X, BASE_HOUSE_Z, BASE_FLOOR_Y } from '../src/rooms/layout.mjs';
import { ELEVATOR_OPENING_RADIUS, ELEVATOR_RADIAL_SEGMENTS } from '../src/rooms/elevator.mjs';

const ray=new Raycaster();
const up=new Vector3(0,1,0),down=new Vector3(0,-1,0);
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-5,`${message}: ${actual} != ${expected}`);

const sourceLiving=(async()=>{
  const bytes=await readFile(new URL('../src/assets/models/mansion-v10.glb',import.meta.url));
  const loader=new GLTFLoader();
  loader.register(()=>({name:'GeometryOnlyImages',loadTexture:async()=>new Texture()}));
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.position.set(BASE_HOUSE_X,0,BASE_HOUSE_Z);scene.updateMatrixWorld(true);
  return scene.getObjectByName('M01_Reuse_INT_Slab_Living');
})();

function cast(mesh,x,y,z,direction) {
  ray.set(new Vector3(x+BASE_HOUSE_X,y,z+BASE_HOUSE_Z),direction);
  return ray.intersectObject(mesh,false);
}

test('basement follows the real mansion footprint, including the curved front corners',async()=>{
  const living=await sourceLiving,room=createInterior(0);room.updateMatrixWorld(true);
  const ceiling=room.getObjectByName('BasementCeilingSlab');
  const wall=room.getObjectByName('BasementPerimeterWalls');
  assert.ok(ceiling&&wall);

  // Project actual enclosure vertices and triangle centres onto the source
  // model. This detects both outlying corners and triangles spanning a gap.
  const checked=new Set();
  for(const mesh of [wall,ceiling,room.getObjectByName('WalkingSurface')]){
    const position=mesh.geometry.attributes.position;
    for(let i=0;i<position.count;i+=3){
      const vertices=[0,1,2].map(j=>new Vector3().fromBufferAttribute(position,i+j).applyMatrix4(mesh.matrixWorld));
      vertices.push(vertices[0].clone().add(vertices[1]).add(vertices[2]).divideScalar(3));
      for(const point of vertices){
        const key=`${point.x.toFixed(5)}:${point.z.toFixed(5)}`;
        if(checked.has(key))continue;checked.add(key);
        // The basement floor is intentionally closed below the elevator.
        if(Math.hypot(point.x-BASE_HOUSE_X,point.z-BASE_HOUSE_Z)<ELEVATOR_OPENING_RADIUS+.002)continue;
        ray.set(new Vector3(point.x,2,point.z),down);
        assert.ok(ray.intersectObject(living,false).length,`${mesh.name} outside house at ${key}`);
      }
    }
  }
  assert.ok(checked.size>1000);
  // These were exposed front portions of the old rectangular side walls.
  for(const x of [-7.4,7.4]){
    const hit=cast(wall,x,.6,9,new Vector3(0,0,-1))[0];
    assert.ok(hit,'A closed curved wall must still enclose the basement');
    assert.ok(hit.point.z-BASE_HOUSE_Z<3.1,'The former brown block at z=5.55 must be absent');
  }
});

test('measured footprint remains attached to the living slab edge rather than a bounding rectangle',async()=>{
  const living=await sourceLiving;
  const surfaceY=new Box3().setFromObject(living).max.y;
  const topHits=(x,z)=>cast(living,x,2,z,down).filter(hit=>Math.abs(hit.point.y-surfaceY)<1e-5);
  assert.equal(BASEMENT_FOOTPRINT.length,256);
  // At every measured edge, a tiny radial step must cross the source model's
  // real perimeter. This also catches a stale configuration after asset edits.
  for(let i=0;i<BASEMENT_FOOTPRINT.length;i++){
    const a=BASEMENT_FOOTPRINT[i],b=BASEMENT_FOOTPRINT[(i+1)%BASEMENT_FOOTPRINT.length];
    const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,length=Math.hypot(x,z);
    assert.ok(topHits(x-x/length*.005,z-z/length*.005).length,`Inner edge ${i}`);
    assert.equal(topHits(x+x/length*.005,z+z/length*.005).length,0,`Outer edge ${i}`);
  }
});

test('basement remains sealed with its original floor and ceiling heights and .3-thick walls',()=>{
  const room=createInterior(0);room.updateMatrixWorld(true);
  const wall=room.getObjectByName('BasementPerimeterWalls');
  const floor=room.getObjectByName('WalkingSurface'),ceiling=room.getObjectByName('BasementCeilingSlab');
  const bottom=BASE_FLOOR_Y[0],top=BASE_FLOOR_Y[1]-.25;
  near(new Box3().setFromObject(floor).max.y,bottom,'Walking height');
  near(new Box3().setFromObject(ceiling).max.y,top,'Ceiling top');
  near(new Box3().setFromObject(ceiling).min.y,top-.12,'Ceiling underside');
  for(const y of [bottom+.01,-3,.6,top-.001]){
    for(let i=0;i<128;i++){
      const angle=i*Math.PI*2/128,direction=new Vector3(Math.cos(angle),0,Math.sin(angle));
      const inner=cast(wall,0,y,0,direction)[0];
      assert.ok(inner,`Open perimeter at height ${y}, angle ${angle}`);
      const outer=cast(wall,direction.x*15,y,direction.z*15,direction.clone().negate())[0];
      assert.ok(outer);
      // At oblique incidence the travelled thickness grows; its projection
      // onto the outer face normal remains the original wall thickness.
      const normal=outer.face.normal.clone().transformDirection(wall.matrixWorld);
      const thickness=Math.abs(outer.point.clone().sub(inner.point).dot(normal));
      assert.ok(thickness>.295&&thickness<.305,`Wall thickness ${thickness}`);
    }
  }
  for(const x of [-4,0,4])for(const z of [-3,0,3]){
    near(cast(floor,x,-3,z,down)[0]?.point.y,bottom,'Closed floor');
    if(x||z)near(cast(ceiling,x,-3,z,up)[0]?.point.y,top-.12,'Closed ceiling');
  }
});

test('ceiling retains the circular lift opening and no extra basement walls block its route',()=>{
  const room=createInterior(0);room.updateMatrixWorld(true);
  const ceiling=room.getObjectByName('BasementCeilingSlab'),wall=room.getObjectByName('BasementPerimeterWalls');
  for(let i=0;i<ELEVATOR_RADIAL_SEGMENTS*2;i++){
    const angle=i*Math.PI/ELEVATOR_RADIAL_SEGMENTS;
    for(const radius of [0,.1,ELEVATOR_OPENING_RADIUS-.01]){
      assert.equal(cast(ceiling,Math.cos(angle)*radius,-3,Math.sin(angle)*radius,up).length,0,'Lift must pass through ceiling');
    }
    assert.ok(cast(ceiling,Math.cos(angle)*(ELEVATOR_OPENING_RADIUS+.01),-3,Math.sin(angle)*(ELEVATOR_OPENING_RADIUS+.01),up).length,'Ceiling remains closed beside shaft');
  }
  ray.set(new Vector3(BASE_HOUSE_X,BASE_FLOOR_Y[0]+.33,BASE_HOUSE_Z+.5),new Vector3(0,0,-1));
  const hit=ray.intersectObject(wall,false)[0];
  assert.ok(hit.distance>4,'Landing to shaft route stays open');
  assert.equal(room.children.filter(node=>node.name==='WallLamp').length,2);
  for(const lamp of room.children.filter(node=>node.name==='WallLamp'))assert.equal(lamp.userData.collidable,false);
});
