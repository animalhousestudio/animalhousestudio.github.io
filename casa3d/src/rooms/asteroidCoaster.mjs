import * as THREE from 'three';
import { WORLD_SCALE, EYE_HEIGHT } from './layout.mjs';
import { terrainHeight } from './terrainDetail.mjs';
import { createCoasterRoute, createCoasterRide, createCoasterSupports, COASTER_STATION, COASTER_TUNNEL, tunnelPortalBox } from './coasterLayout.mjs';
import { cutBasinPortal } from './basinPortal.mjs';
import { createCoasterCart } from './coasterCart.mjs';
import { batchStaticArchitecture } from './optimize.mjs';

const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(1,1,1);
function instances(name, geometry, material, placements) {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length); mesh.name = name;
  placements.forEach(({ position, quaternion = new THREE.Quaternion(), size = scale }, i) => {
    matrix.compose(position, quaternion, size); mesh.setMatrixAt(i, matrix);
  });
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}
function railGeometry(frames, side, vertical, radius) {
  const positions = [], normals = [], indices = [], sides = 6;
  frames.forEach(({position,right,up}, i) => {
    for (let j=0;j<sides;j++) {
      const angle = j/sides*Math.PI*2, normal = right.clone().multiplyScalar(Math.cos(angle)).addScaledVector(up,Math.sin(angle));
      positions.push(...position.clone().addScaledVector(right,side).addScaledVector(up,vertical).addScaledVector(normal,radius).toArray());
      normals.push(...normal.toArray());
      if (i) { const a=(i-1)*sides+j,b=(i-1)*sides+(j+1)%sides,c=i*sides+j,d=i*sides+(j+1)%sides; indices.push(a,b,c,b,d,c); }
    }
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3)); geometry.setIndex(indices);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}
function signTexture() {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#102c36';ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle='#67e3d4';ctx.lineWidth=12;ctx.strokeRect(10,10,1004,236);
  ctx.textAlign='center';ctx.fillStyle='#f5e6c9';ctx.font='bold 62px sans-serif';ctx.fillText('GIRO DELL’ASTEROIDE',512,110);
  ctx.font='38px sans-serif';ctx.fillText('SALI SUL CARRELLO',512,187);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function addAsteroidCoaster(garden, asteroid, ponds) {
  const root=new THREE.Group();root.name='AsteroidCoaster';root.scale.setScalar(1/WORLD_SCALE);
  root.userData.streamingBoundary=true;root.userData.roomName='Montagne russe dell’asteroide';garden.add(root);
  const visual=new THREE.Group();visual.name='Coaster_Visual';visual.userData.collisionDisabled=true;root.add(visual);
  const route=createCoasterRoute(), ride=createCoasterRide(route);
  const steel=new THREE.MeshStandardMaterial({color:0x1a638a,metalness:.65,roughness:.3});
  const spine=new THREE.MeshStandardMaterial({color:0x263b4b,metalness:.65,roughness:.46});
  const wood=new THREE.MeshStandardMaterial({color:0x94643b,roughness:.9});
  const darkWood=new THREE.MeshStandardMaterial({color:0x513b2a,roughness:.94});
  const steps=Math.ceil(route.length/1.35), frames=Array.from({length:steps+1},(_,i)=>route.frameAt(i/steps));
  for(const side of [-.65,.65]) {const mesh=new THREE.Mesh(railGeometry(frames,side,0,.075),steel);mesh.name='Coaster_BlueRail';visual.add(mesh);}
  visual.add(new THREE.Mesh(railGeometry(frames,0,-.27,.12),spine));
  visual.add(instances('Coaster_Sleepers',new THREE.BoxGeometry(1.6,.12,.22),darkWood,
    frames.slice(0,-1).map(frame=>({position:frame.position.clone().addScaledVector(frame.up,-.09),quaternion:frame.quaternion}))));
  const supports=createCoasterSupports(route,(x,z)=>{
    const ground=asteroid.heightAt(x/WORLD_SCALE,z/WORLD_SCALE);return ground===null?null:ground*WORLD_SCALE;
  });
  visual.add(instances('Coaster_Supports',new THREE.BoxGeometry(1,1,1),spine,supports));
  const station=new THREE.Group();station.name='Coaster_Station';visual.add(station);
  const physics=new THREE.Group();physics.name='Coaster_StationPhysics';root.add(physics);
  const invisible=new THREE.MeshBasicMaterial({visible:false});
  function platform(w,h,d,x,y,z) {
    const geometry=new THREE.BoxGeometry(w,h,d),mesh=new THREE.Mesh(geometry,wood);mesh.position.set(x,y,z);station.add(mesh);
    const hull=new THREE.Mesh(geometry,invisible);hull.position.copy(mesh.position);hull.userData.collidable=true;physics.add(hull);
  }
  platform(7.8,.5,24,9,.25,216);
  platform(.7,.34,3,4.75,.17,215);platform(.7,.17,3,4.05,.085,215);
  platform(3,.34,.7,9,.17,228.35);platform(3,.17,.7,9,.085,229.05);
  const cream=new THREE.MeshStandardMaterial({color:0xe3ca97,roughness:.65});
  const brass=new THREE.MeshStandardMaterial({color:0xb38a4c,metalness:.65,roughness:.35});
  const warm=new THREE.MeshBasicMaterial({color:0xffd891});
  const deck=[],edge=[],lamps=[];
  for(let z=204.25;z<228;z+=.5)deck.push({position:new THREE.Vector3(9,.515,z),size:new THREE.Vector3(7.7,.04,.455)});
  station.add(instances('Station_DeckPlanks',new THREE.BoxGeometry(1,1,1),wood,deck));
  for(const x of [5.18,12.82])edge.push({position:new THREE.Vector3(x,.57,216),size:new THREE.Vector3(.12,.12,24)});
  station.add(instances('Station_CreamEdging',new THREE.BoxGeometry(1,1,1),cream,edge));
  for(const x of [5.35,12.65])for(const z of [205,209,222,226]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,.68,8),brass);post.position.set(x,.87,z);station.add(post);
    lamps.push({position:new THREE.Vector3(x,1.23,z),size:new THREE.Vector3(.22,.22,.22)});
  }
  station.add(instances('Station_WarmLamps',new THREE.SphereGeometry(.5,10,6),warm,lamps));
  const posts=[{position:new THREE.Vector3(5.3,2.3,206.1)},{position:new THREE.Vector3(12.7,2.3,206.1)}];
  station.add(instances('Coaster_EntryPosts',new THREE.BoxGeometry(.18,4.6,.18),spine,posts));
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(5.7,1.05),new THREE.MeshBasicMaterial({map:signTexture(),toneMapped:false}));
  sign.position.set(9,4.1,206.2);station.add(sign);
  const startButton=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.09,24),new THREE.MeshStandardMaterial({color:0x43d5a8,emissive:0x14644e}));
  startButton.rotation.x=Math.PI/2;startButton.position.set(10.8,1.2,209.7);startButton.name='CoasterStartButton';station.add(startButton);
  const board=new THREE.Group();board.name='Coaster_Train';board.userData.interactable=true;visual.add(board);
  const lead=createCoasterCart();batchStaticArchitecture(lead,Infinity);board.add(lead);
  const trailers=[];
  for(let i=1;i<=3;i++){
    const car=lead.clone(true);car.name='Coaster_Trailer_'+i;car.matrixAutoUpdate=false;
    car.traverse(node=>{if(node.userData.occupied)node.userData.occupied=false;});
    board.add(car);trailers.push(car);
  }
  const t=COASTER_TUNNEL, tunnel=new THREE.Group();tunnel.name='Coaster_UnderwaterPassage';visual.add(tunnel);
  const rock=new THREE.MeshStandardMaterial({color:0x304345,roughness:1});
  function tunnelBox(w,h,d,x,y,z) {const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),rock);mesh.position.set(x,y,z);tunnel.add(mesh);}
  const tunnelLength=t.endZ-t.startZ, middle=(t.endZ+t.startZ)/2;
  tunnelBox(8.9,.5,tunnelLength,t.x,t.floor-.1,middle);tunnelBox(8.9,.6,tunnelLength,t.x,t.ceiling+.25,middle);
  for(const side of [-1,1])tunnelBox(.5,9.4,tunnelLength,t.x+side*4.25,-8.5,middle);
  const lights=[], glow=new THREE.MeshBasicMaterial({color:0x58d8da});
  for(let z=t.startZ;z<=t.endZ;z+=6) {
    lights.push({position:new THREE.Vector3(t.x,-4.04,z),size:new THREE.Vector3(8,.055,.08)});
    for(const side of [-1,1])lights.push({position:new THREE.Vector3(t.x+side*3.98,-8.4,z),size:new THREE.Vector3(.055,8.7,.08)});
  }
  tunnel.add(instances('Coaster_TunnelLights',new THREE.BoxGeometry(1,1,1),glow,lights));
  for(const pond of ponds) {
    const basin=pond.root.getObjectByName('Pond_ClosedBasin'), original=basin.geometry;
    basin.geometry=cutBasinPortal(original,tunnelPortalBox(1/WORLD_SCALE));
    // The pond's legacy underwater clone shares this basin too.
    pond.submergedScene.traverse(node=>{if(node.name===basin.name)node.geometry=basin.geometry;});
    original.dispose();
  }
  const submergedScene=new THREE.Scene();submergedScene.background=new THREE.Color('#12383e');submergedScene.fog=new THREE.FogExp2('#12383e',.026);
  submergedScene.add(new THREE.HemisphereLight(0xb1e7d8,0x234450,1.8));
  const submergedCopies=[];
  for(const source of [root,...ponds.map(pond=>pond.root)]) {
    source.updateWorldMatrix(true,true);const copy=source.clone(true);copy.matrixAutoUpdate=false;copy.matrix.copy(source.matrixWorld);
    submergedScene.add(copy);submergedCopies.push([source,copy]);
  }
  const submergedBoard=submergedCopies[0][1].getObjectByName(board.name);
  const inverseTrain=new THREE.Matrix4(),trailerMatrix=new THREE.Matrix4();
  function setBoard(frame) {
    board.position.copy(frame.position).addScaledVector(frame.up,.12);board.quaternion.copy(frame.quaternion);board.updateMatrix();
    submergedBoard.position.copy(board.position);submergedBoard.quaternion.copy(board.quaternion);submergedBoard.updateMatrix();
    inverseTrain.copy(board.matrix).invert();
    trailers.forEach((car,i)=>{
      const u=THREE.MathUtils.euclideanModulo(frame.u-(i+1)*4.2/route.length,1),tail=route.frameAt(u);
      trailerMatrix.compose(tail.position.clone().addScaledVector(tail.up,.12),tail.quaternion,scale);
      car.matrix.multiplyMatrices(inverseTrain,trailerMatrix);
      submergedBoard.getObjectByName(car.name).matrix.copy(car.matrix);
    });
  }
  setBoard(route.frameAt(0));
  const waterY=ponds[0].layout.waterY*WORLD_SCALE;
  const portal=tunnelPortalBox();
  return {
    root,route,ride,board,startButton,stationMesh:station,submergedScene,ponds,waterY,
    station:new THREE.Vector3(COASTER_STATION.x,1,COASTER_STATION.z),
    exitPosition:new THREE.Vector3(12.1,.5+EYE_HEIGHT,208.7),
    setBoard,
    containsWater(eye) {
      if(eye.y>=waterY-.06)return false;
      return portal.containsPoint(eye)||ponds.some(({layout})=>layout.contains(eye.x/WORLD_SCALE,eye.z/WORLD_SCALE)
        &&eye.y>=layout.floorAt(eye.x/WORLD_SCALE,eye.z/WORLD_SCALE)*WORLD_SCALE);
    },
    updateUnderwater() {
      for(const [source,copy]of submergedCopies) {
        source.updateWorldMatrix(true,false);copy.matrix.copy(source.matrixWorld);
        if(source!==root)copy.traverse(node=>{if(node.isMesh&&node.name==='DeepPond_WaterSurface'){const live=source.getObjectByName(node.name);if(live)node.geometry=live.geometry;}});
      }
    },
  };
}
