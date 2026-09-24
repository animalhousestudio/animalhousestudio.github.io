import * as THREE from 'three';
import { BASE_FLOOR_Y as FLOORS, WORLD_SCALE } from './layout.mjs';
import { STAIR_OUTER_RADIUS as OUTER, STAIR_TRAVEL_RADIUS, STAIR_OPENING_RADIUS, STAIR_TURNS, STAIR_START_ANGLE } from './stairLayout.mjs';
export const INTERNAL_STAIR_TRAVEL_RADIUS=STAIR_TRAVEL_RADIUS;
export const INTERNAL_STAIR_OPENING_RADIUS=STAIR_OPENING_RADIUS;
export const INTERNAL_STAIR_FLOORS=FLOORS;

export function createSpiralStairs(){
  const g=new THREE.Group();g.name='SpiralStairs';g.userData.isStairs=true;
  const steps=new THREE.Group();steps.userData.isStepsGroup=true;g.add(steps);
  const oak=new THREE.MeshStandardMaterial({color:0x9a754c,roughness:.72});
  const iron=new THREE.MeshStandardMaterial({color:0x293234,metalness:.72,roughness:.42});
  const brass=new THREE.MeshStandardMaterial({color:0xaa8a4d,metalness:.65,roughness:.36});
  const height=FLOORS.at(-1)-FLOORS[0];
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,height,16),iron);
  pole.position.y=(FLOORS[0]+FLOORS.at(-1))/2;pole.userData.collidable=true;g.add(pole);
  for(let f=0;f<FLOORS.length-1;f++){
    const rise=FLOORS[f+1]-FLOORS[f],turns=STAIR_TURNS[f],count=turns*32,delta=Math.PI*2*turns/count;
    const shape=new THREE.Shape();shape.absarc(0,0,OUTER,0,delta,false);shape.absarc(0,0,.055,delta,0,true);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.028,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:1,steps:1,curveSegments:4});
    geo.rotateX(-Math.PI/2);
    const treads=new THREE.InstancedMesh(geo,oak,count),balusters=new THREE.InstancedMesh(new THREE.CylinderGeometry(.009,.009,.35,6),iron,count);
    const dummy=new THREE.Object3D();
    for(let i=0;i<count;i++){
      const a=STAIR_START_ANGLE+delta*i,y=FLOORS[f]+rise*i/count;
      dummy.position.set(0,y-.028,0);dummy.rotation.set(0,-a,0);dummy.updateMatrix();treads.setMatrixAt(i,dummy.matrix);
      dummy.position.set(Math.cos(a)*OUTER,y+.175,Math.sin(a)*OUTER);dummy.rotation.set(0,0,0);dummy.updateMatrix();balusters.setMatrixAt(i,dummy.matrix);
    }
    treads.name=`OakTreads_${f}`;treads.receiveShadow=true;steps.add(treads);g.add(balusters);
    for(const [radius,offset,tube,mat] of [[OUTER,.35,.018,brass],[OUTER,-.05,.024,iron],[.09,-.045,.015,iron]]){
      const points=[];for(let i=0;i<=count*2;i++){const t=i/(count*2),a=STAIR_START_ANGLE+t*turns*Math.PI*2;points.push(new THREE.Vector3(Math.cos(a)*radius,FLOORS[f]+rise*t+offset,Math.sin(a)*radius));}
      const rail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),count*2,tube,6,false),mat);g.add(rail);
    }
  }
  // Guard the three closed sides of every landing; the front remains accessible.
  for(const y of FLOORS.slice(1)){
    const points=[[-.72,.72],[-.72,-.72],[.72,-.72],[.72,.72]].map(([x,z])=>new THREE.Vector3(x,y+.35,z));
    const rail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,false,'catmullrom',0),24,.018,6,false),brass);g.add(rail);
    const postGeo=new THREE.CylinderGeometry(.012,.012,.35,8);
    for(const [x,z] of [[-.72,.72],[-.72,0],[-.72,-.72],[0,-.72],[.72,-.72],[.72,0],[.72,.72]]){
      const post=new THREE.Mesh(postGeo,iron);post.position.set(x,y+.175,z);g.add(post);
    }
  }
  const bound=new THREE.Mesh(new THREE.CylinderGeometry(OUTER,OUTER,height,16),new THREE.MeshBasicMaterial({visible:false}));
  bound.position.y=(FLOORS[0]+FLOORS.at(-1))/2;bound.userData.isStairsBound=true;g.add(bound);
  const target=new THREE.Mesh(new THREE.CylinderGeometry(OUTER,OUTER,height,16),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
  target.position.y=bound.position.y;target.name='StairsTapTarget';target.userData.isStairsTapTarget=true;g.add(target);
  return g;
}
