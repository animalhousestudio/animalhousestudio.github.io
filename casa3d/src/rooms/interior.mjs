import * as THREE from 'three';
import { BASE_HOUSE_X as HOUSE_X, BASE_HOUSE_Z as HOUSE_Z, BASE_FLOOR_Y as FLOOR_Y, FLOOR_NAMES } from './layout.mjs';
import { createHoledCeiling } from './roomShell.js';
import { STAIR_OPENING_RADIUS } from './stairLayout.mjs';
import { SIDE_PORTALS } from './access.mjs';

export function createInterior(index) {
  const g=new THREE.Group();
  g.name=`Interior_${index}`;g.userData.roomName=FLOOR_NAMES[index];
  g.position.set(HOUSE_X,0,HOUSE_Z);
  const y=FLOOR_Y[index], top=index===4?29.05:FLOOR_Y[index+1]-.25;
  const width=index===4?6.8:14.8, depth=index===4?5.4:10.8;
  const hidden=new THREE.MeshBasicMaterial({visible:false});
  const stone=new THREE.MeshStandardMaterial({color:0x756956,roughness:.96});
  const floorMat=new THREE.MeshStandardMaterial({color:0x554d43,roughness:.95});
  const box=(w,h,d,x,cy,z,mat,name)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,cy,z);
    m.name=name;m.userData.collidable=true;m.receiveShadow=true;g.add(m);return m;
  };
  box(width,.2,depth,0,y-.1,0,index===0?floorMat:hidden,'WalkingSurface');
  const walls=index===0?stone:hidden;
  for(const [side,sign] of [['west',-1],['east',1]]){
    const portal=SIDE_PORTALS[index]?.[side];
    const x=sign*(width/2+.15);
    if(!portal)box(.3,top-y,depth+.6,x,(top+y)/2,0,walls,`Wall_${side}`);
    else {
      const [a,b]=portal,lo=-depth/2-.3,hi=depth/2+.3;
      box(.3,top-y,a-lo,x,(top+y)/2,(lo+a)/2,walls,`Wall_${side}_A`);
      box(.3,top-y,hi-b,x,(top+y)/2,(b+hi)/2,walls,`Wall_${side}_B`);
    }
  }
  box(width,top-y,.3,0,(top+y)/2,-depth/2-.15,walls,'WallNorth');
  if(index===1) {
    // The only ground entrance is aligned with the antique portal.
    const left=-1.95,right=-.01;
    box(left+width/2,top-y,.3,(-width/2+left)/2,(top+y)/2,6.1,hidden,'FrontLeft');
    box(width/2-right,top-y,.3,(width/2+right)/2,(top+y)/2,6.1,hidden,'FrontRight');
  } else box(width,top-y,.3,0,(top+y)/2,depth/2+.15,walls,'WallSouth');
  if(index===0) {
    const ceiling=createHoledCeiling(width+.6,depth+.6,STAIR_OPENING_RADIUS,stone);
    ceiling.position.y=FLOOR_Y[1]-.25;g.add(ceiling);
    const trim=new THREE.MeshStandardMaterial({color:0x403c33,roughness:.85});
    for(const z of [-depth/2,depth/2])box(width,.18,.12,0,y+.12,z,trim,'StoneSkirting');
    for(const x of [-width/2,width/2])box(.12,.18,depth,x,y+.12,0,trim,'StoneSkirting');
    for(const x of [-5,5]) {
      const lamp=box(.18,.5,.2,x,-2.8,-depth/2+.18,new THREE.MeshStandardMaterial({color:0xffd296,emissive:0xffb65e,emissiveIntensity:1.3}),'WallLamp');
      lamp.userData.collidable=false;
      const light=new THREE.PointLight(0xffcb8b,18,12,2);light.position.set(x,-2.8,-depth/2+.6);g.add(light);
    }
  }
  if(index===4) {
    // The drum is elliptical and offset from the stair axis. Fit its full interior.
    const shape=new THREE.Shape();shape.absellipse(-1.04,-1.045,4.76,4.02,0,Math.PI*2,false,0);
    const hole=new THREE.Path();hole.absarc(0,0,STAIR_OPENING_RADIUS,0,Math.PI*2,true);shape.holes.push(hole);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.10,bevelEnabled:false,curveSegments:48});geometry.rotateX(Math.PI/2);
    const deck=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x75604a,roughness:.85,side:THREE.DoubleSide}));
    deck.name='ObservatoryFittedDeck';deck.receiveShadow=true;
    deck.position.y=y;g.add(deck);
  }
  return g;
}
