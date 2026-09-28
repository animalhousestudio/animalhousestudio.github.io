import * as THREE from 'three';
import { BASE_HOUSE_X as HOUSE_X, BASE_HOUSE_Z as HOUSE_Z, BASE_FLOOR_Y as FLOOR_Y, FLOOR_NAMES } from './layout.mjs';
import { ELEVATOR_OPENING_RADIUS, ELEVATOR_RADIAL_SEGMENTS } from './elevator.mjs';
import { BASEMENT_FOOTPRINT } from './basementFootprint.mjs';

// The measured living-slab boundary is convex. Offset its intersecting edge
// lines inward, retaining the actual curved segments and a uniform wall width.
function insetContour(contour, distance) {
  const area=contour.reduce((sum,p,i)=>{
    const next=contour[(i+1)%contour.length];return sum+p[0]*next[1]-next[0]*p[1];
  },0);
  const sign=Math.sign(area);
  const edges=contour.map((p,i)=>{
    const next=contour[(i+1)%contour.length];
    const dx=next[0]-p[0], dz=next[1]-p[1], length=Math.hypot(dx,dz);
    return {x:p[0]-sign*dz/length*distance,z:p[1]+sign*dx/length*distance,dx:dx/length,dz:dz/length};
  });
  return edges.map((edge,i)=>{
    const previous=edges[(i+edges.length-1)%edges.length];
    const determinant=previous.dx*edge.dz-previous.dz*edge.dx;
    if(Math.abs(determinant)<1e-9)return [edge.x,edge.z];
    const t=((edge.x-previous.x)*edge.dz-(edge.z-previous.z)*edge.dx)/determinant;
    return [previous.x+previous.dx*t,previous.z+previous.dz*t];
  });
}

function contourPath(contour, Path=THREE.Path) {
  const path=new Path();
  // Extrusion is rotated -90 degrees around X: shape Y is negative world Z.
  contour.forEach(([x,z],i)=>i===0?path.moveTo(x,-z):path.lineTo(x,-z));
  path.closePath();return path;
}

function northWallAt(contour,x) {
  let result=null;
  for(let i=0;i<contour.length;i++){
    const a=contour[i],b=contour[(i+1)%contour.length];
    if(x<Math.min(a[0],b[0])||x>Math.max(a[0],b[0])||Math.abs(b[0]-a[0])<1e-9)continue;
    const z=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
    if(result&&z>=result.z)continue;
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    let nx=-dz/length,nz=dx/length;
    if(nz<0){nx=-nx;nz=-nz;}
    result={x,z,nx,nz};
  }
  return result;
}

export function createInterior(index) {
  const g=new THREE.Group();
  g.name=`Interior_${index}`;g.userData.roomName=FLOOR_NAMES[index];
  g.position.set(HOUSE_X,0,HOUSE_Z);
  // The authored upper rooms supply curved walls, doorways and circular lift
  // openings. Extra rectangular walls/floors would block those actual openings.
  if(index!==0)return g;
  const y=FLOOR_Y[0], top=FLOOR_Y[1]-.25;
  // Keep the whole enclosure below the authored curved footprint, including
  // the part of the basement that rises above the lawn. The slight setback
  // avoids precision fringes along the facade; the .3 m wall grows inward.
  const outside=insetContour(BASEMENT_FOOTPRINT,.025);
  const inside=insetContour(BASEMENT_FOOTPRINT,.325);
  const stone=new THREE.MeshStandardMaterial({color:0x756956,roughness:.96});
  const floorMat=new THREE.MeshStandardMaterial({color:0x554d43,roughness:.95});
  const box=(w,h,d,x,cy,z,mat,name)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,cy,z);
    m.name=name;m.userData.collidable=true;m.receiveShadow=true;g.add(m);return m;
  };
  const extrude=(outer,holes,base,height,material,name)=>{
    const shape=contourPath(outer,THREE.Shape);
    for(const hole of holes)shape.holes.push(contourPath(hole));
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,steps:1,bevelEnabled:false});
    geometry.rotateX(-Math.PI/2);
    const mesh=new THREE.Mesh(geometry,material);mesh.position.y=base;
    mesh.name=name;mesh.userData.collidable=true;mesh.receiveShadow=true;g.add(mesh);
    return mesh;
  };
  extrude(outside,[],y-.2,.2,floorMat,'WalkingSurface');
  extrude(outside,[inside],y,top-y,stone,'BasementPerimeterWalls');
  {
    // A closed slab follows the compact shaft with a 24-sided circular opening.
    const opening=[];
    for(let i=0;i<ELEVATOR_RADIAL_SEGMENTS;i++) {
      const angle=-i*Math.PI*2/ELEVATOR_RADIAL_SEGMENTS;
      const x=Math.cos(angle)*ELEVATOR_OPENING_RADIUS,z=Math.sin(angle)*ELEVATOR_OPENING_RADIUS;
      opening.push([x,z]);
    }
    extrude(outside,[opening],top-.12,.12,stone,'BasementCeilingSlab');
    const trim=new THREE.MeshStandardMaterial({color:0x403c33,roughness:.85});
    extrude(inside,[insetContour(BASEMENT_FOOTPRINT,.445)],y+.03,.18,trim,'StoneSkirting');
    for(const x of [-5,5]) {
      const wall=northWallAt(inside,x);
      const lamp=box(.18,.5,.2,x+wall.nx*.09,-2.8,wall.z+wall.nz*.09,new THREE.MeshStandardMaterial({color:0xffd296,emissive:0xffb65e,emissiveIntensity:1.3}),'WallLamp');
      lamp.rotation.y=Math.atan2(wall.nx,wall.nz);
      lamp.userData.collidable=false;
      const light=new THREE.PointLight(0xffcb8b,18,12,2);light.position.set(x+wall.nx*.6,-2.8,wall.z+wall.nz*.6);g.add(light);
    }
  }
  return g;
}
