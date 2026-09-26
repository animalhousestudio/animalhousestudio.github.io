import * as THREE from 'three';
import { BASE_HOUSE_X as HOUSE_X, BASE_HOUSE_Z as HOUSE_Z, BASE_FLOOR_Y as FLOOR_Y, FLOOR_NAMES } from './layout.mjs';
import { ELEVATOR_OPENING_RADIUS, ELEVATOR_RADIAL_SEGMENTS } from './elevator.mjs';

export function createInterior(index) {
  const g=new THREE.Group();
  g.name=`Interior_${index}`;g.userData.roomName=FLOOR_NAMES[index];
  g.position.set(HOUSE_X,0,HOUSE_Z);
  // The authored upper rooms supply curved walls, doorways and circular lift
  // openings. Extra rectangular walls/floors would block those actual openings.
  if(index!==0)return g;
  const y=FLOOR_Y[0], top=FLOOR_Y[1]-.25;
  const width=14.8, depth=10.8;
  const stone=new THREE.MeshStandardMaterial({color:0x756956,roughness:.96});
  const floorMat=new THREE.MeshStandardMaterial({color:0x554d43,roughness:.95});
  const box=(w,h,d,x,cy,z,mat,name)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,cy,z);
    m.name=name;m.userData.collidable=true;m.receiveShadow=true;g.add(m);return m;
  };
  box(width,.2,depth,0,y-.1,0,floorMat,'WalkingSurface');
  const walls=stone;
  for(const [side,sign] of [['west',-1],['east',1]]){
    const x=sign*(width/2+.15);
    box(.3,top-y,depth+.6,x,(top+y)/2,0,walls,`Wall_${side}`);
  }
  box(width,top-y,.3,0,(top+y)/2,-depth/2-.15,walls,'WallNorth');
  box(width,top-y,.3,0,(top+y)/2,depth/2+.15,walls,'WallSouth');
  {
    // A closed slab follows the compact shaft with a 24-sided circular opening.
    const outerX=width/2+.3, outerZ=depth/2+.3;
    const slab=new THREE.Shape();
    slab.moveTo(-outerX,-outerZ);slab.lineTo(outerX,-outerZ);
    slab.lineTo(outerX,outerZ);slab.lineTo(-outerX,outerZ);slab.closePath();
    const opening=new THREE.Path();
    for(let i=0;i<ELEVATOR_RADIAL_SEGMENTS;i++) {
      const angle=-i*Math.PI*2/ELEVATOR_RADIAL_SEGMENTS;
      const x=Math.cos(angle)*ELEVATOR_OPENING_RADIUS,z=Math.sin(angle)*ELEVATOR_OPENING_RADIUS;
      if(i===0)opening.moveTo(x,z);else opening.lineTo(x,z);
    }
    opening.closePath();slab.holes.push(opening);
    const ceilingGeometry=new THREE.ExtrudeGeometry(slab,{depth:.12,steps:1,bevelEnabled:false});
    ceilingGeometry.rotateX(-Math.PI/2);
    const ceiling=new THREE.Mesh(ceilingGeometry,stone);
    ceiling.name='BasementCeilingSlab';ceiling.position.y=top-.12;
    ceiling.userData.collidable=true;ceiling.receiveShadow=true;g.add(ceiling);
    const trim=new THREE.MeshStandardMaterial({color:0x403c33,roughness:.85});
    for(const z of [-depth/2,depth/2])box(width,.18,.12,0,y+.12,z,trim,'StoneSkirting');
    for(const x of [-width/2,width/2])box(.12,.18,depth,x,y+.12,0,trim,'StoneSkirting');
    for(const x of [-5,5]) {
      const lamp=box(.18,.5,.2,x,-2.8,-depth/2+.18,new THREE.MeshStandardMaterial({color:0xffd296,emissive:0xffb65e,emissiveIntensity:1.3}),'WallLamp');
      lamp.userData.collidable=false;
      const light=new THREE.PointLight(0xffcb8b,18,12,2);light.position.set(x,-2.8,-depth/2+.6);g.add(light);
    }
  }
  return g;
}
