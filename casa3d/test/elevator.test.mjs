import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Group, Raycaster, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createElevator, createElevatorTravel, ELEVATOR_CABIN_RADIUS, ELEVATOR_SHAFT_RADIUS,
  ELEVATOR_OPENING_RADIUS, ELEVATOR_DOOR_WIDTH, ELEVATOR_LANDING_OFFSET } from '../src/rooms/elevator.mjs';
import { createInterior } from '../src/rooms/interior.mjs';
import { BASE_FLOOR_Y, FLOOR_Y, HOUSE_X, HOUSE_Z, EYE_HEIGHT, WORLD_SCALE } from '../src/rooms/layout.mjs';

test('authored shaft reaches the cellar and every landing has a real doorway', async () => {
  const bytes=await readFile(new URL('../src/assets/models/mansion-v10.glb',import.meta.url));
  const loader=new GLTFLoader();
  loader.register(()=>({name:'GeometryOnlyImages',loadTexture:async()=>new Texture()}));
  const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.updateMatrixWorld(true);
  const shaft=scene.getObjectByName('M10_Elevator_Shaft_Glass');
  assert.ok(shaft,'Missing circular shaft');
  const bounds=new Box3().setFromObject(shaft);
  assert.ok(Math.abs(bounds.min.y-BASE_FLOOR_Y[0])<.001,'Shaft does not reach the cellar');
  for(let index=0;index<BASE_FLOOR_Y.length;index++) {
    const bridge=scene.getObjectByName(`M10_Lift_BoardingBridge_${String(index).padStart(2,'0')}`);
    assert.ok(bridge,`Missing landing ${index}`);
    assert.ok(Math.abs(new Box3().setFromObject(bridge).max.y-BASE_FLOOR_Y[index])<.008,`Landing ${index} floats above floor`);
    const southGlass=[];
    scene.traverse(node=>{if(node.isMesh&&node.name.startsWith('M10_Elevator_Shaft_Glass'))southGlass.push(node);});
    const ray=new Raycaster(new Vector3(0,BASE_FLOOR_Y[index]+.3,.36),new Vector3(0,0,-1),0,.36);
    assert.equal(ray.intersectObjects(southGlass).length,0,`Glass seals landing ${index}`);
  }
});

test('cellar ceiling has a compact circular lift opening and restores its old square corners', () => {
  const room=createInterior(0);room.updateMatrixWorld(true);
  const ceiling=room.children.filter(node=>node.name.startsWith('BasementCeiling'));
  const y=BASE_FLOOR_Y[1]-.25;
  for(const [x,z] of [[0,0],[.2,0],[-.2,0],[0,.2],[0,-.2],[.14,.14]]) {
    const ray=new Raycaster(new Vector3(room.position.x+x,y+.1,room.position.z+z),new Vector3(0,-1,0),0,.3);
    assert.equal(ray.intersectObjects(ceiling).length,0,`Shaft obstructed at ${x},${z}`);
  }
  for(const [x,z] of [[.25,0],[-.25,0],[0,.25],[0,-.25],[.20,.20],[1.7,1.7]]) {
    const ray=new Raycaster(new Vector3(room.position.x+x,y+.1,room.position.z+z),new Vector3(0,-1,0),0,.3);
    assert.ok(ray.intersectObjects(ceiling).length,`Ceiling gap at ${x},${z}`);
  }
  assert.equal(ELEVATOR_SHAFT_RADIUS,.22);
  assert.equal(ELEVATOR_OPENING_RADIUS,.23);
});

test('cabin floor is flush at every stop and its front entrance is physically open', () => {
  const originalDocument=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({clearRect(){},fillText(){}})})};
  try {
    const lift=createElevator(),world=new Group();world.scale.setScalar(WORLD_SCALE);world.add(lift);
    const cabin=lift.userData.cabin;
    for(const floorY of BASE_FLOOR_Y) {
      cabin.position.y=floorY;lift.userData.updateGates();world.updateMatrixWorld(true);
      const floor=new Box3().setFromObject(cabin.getObjectByName('ElevatorCabinFloor'));
      assert.ok(Math.abs(floor.max.y-floorY*WORLD_SCALE)<1e-5);
      assert.ok(Math.abs(floor.getSize(new Vector3()).x-ELEVATOR_CABIN_RADIUS*2*WORLD_SCALE)<1e-5);
      const ray=new Raycaster(new Vector3(HOUSE_X,floorY*WORLD_SCALE+EYE_HEIGHT,HOUSE_Z+ELEVATOR_LANDING_OFFSET*WORLD_SCALE),new Vector3(0,0,-1),0,ELEVATOR_LANDING_OFFSET*WORLD_SCALE);
      assert.equal(ray.intersectObject(cabin,true).length,0,'Cabin entrance has a blocking panel');
      for(const landingY of BASE_FLOOR_Y) {
        const gateRay=new Raycaster(new Vector3(HOUSE_X,landingY*WORLD_SCALE+EYE_HEIGHT,HOUSE_Z+ELEVATOR_LANDING_OFFSET*WORLD_SCALE),new Vector3(0,0,-1),0,ELEVATOR_LANDING_OFFSET*WORLD_SCALE);
        const blocked=gateRay.intersectObject(lift.userData.landingGates,true).length>0;
        assert.equal(blocked,landingY!==floorY,'Only the served landing may open');
      }
    }
    for(let i=0;i<lift.userData.selectors.length;i++) {
      const panel=new Box3().setFromObject(lift.userData.selectors[i]);
      assert.ok(Math.abs(panel.getCenter(new Vector3()).y-FLOOR_Y[i]-1.28)<1e-5);
      assert.ok(panel.min.x>HOUSE_X+ELEVATOR_DOOR_WIDTH/2*WORLD_SCALE,'Selector obstructs landing route');
      assert.ok(Math.abs(panel.getSize(new Vector3()).x-.22)<1e-5,'Selector is not human-sized');
    }
  } finally {
    if(originalDocument===undefined)delete globalThis.document;
    else globalThis.document=originalDocument;
  }
});

test('travel boards before moving, remains on the cabin floor and exits at the exact destination', () => {
  for(let from=0;from<FLOOR_Y.length;from++)for(const to of [from-1,from+1]) {
    if(to<0||to>=FLOOR_Y.length)continue;
    const start=new Vector3(HOUSE_X+.30*WORLD_SCALE,FLOOR_Y[from]+EYE_HEIGHT,HOUSE_Z-.30*WORLD_SCALE);
    const travel=createElevatorTravel(from,to,start);
    assert.deepEqual(travel.sample(0).position,start);
    for(let step=0;step<=100;step++) {
      const progress=step/100,{position,cabinY}=travel.sample(progress);
      assert.ok(Math.abs(position.y-EYE_HEIGHT-cabinY*WORLD_SCALE)<1e-7,'Passenger disconnected from cabin floor');
      if(progress<.3)assert.equal(cabinY,BASE_FLOOR_Y[from]);
      if(progress>.8)assert.equal(cabinY,BASE_FLOOR_Y[to]);
      if(progress>=.3&&progress<=.8) {
        assert.equal(position.x,HOUSE_X);assert.equal(position.z,HOUSE_Z);
      }
    }
    const end=travel.sample(1);
    assert.ok(Math.abs(end.position.y-FLOOR_Y[to]-EYE_HEIGHT)<1e-7);
    assert.equal(end.position.z,HOUSE_Z+ELEVATOR_LANDING_OFFSET*WORLD_SCALE);
  }
});
