import * as THREE from 'three';
import { WORLD_SCALE, HOUSE_X, HOUSE_Z } from './layout.mjs';

export const SIDE_PORTALS = {
  1: {west:[.375,2.025]},
  2: {west:[-.5,1.1],east:[-.725,.925]},
  3: {west:[2.175,3.825]},
};

export function prepareAccess(exterior) {
  const timber=new THREE.MeshStandardMaterial({color:0x75604a,roughness:.85});
  const g=new THREE.Group();g.name='AccessThresholds';exterior.add(g);
  function ramp(name,x0,x1,z,width,y0,y1){
    const positions=[x0,y0,z-width/2,x1,y1,z-width/2,x1,y1,z+width/2,x0,y0,z+width/2];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex([0,2,1,0,3,2]);geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,timber);m.name=name;m.material.side=THREE.DoubleSide;g.add(m);
  }
  ramp('ACCESS_Veranda_Ramp',-7.3,-10.25,1.2,1.55,1.487,.441);
  ramp('ACCESS_Aviary_Threshold',-7.3,-8.6,.3,1.55,9.912,9.962);
  ramp('ACCESS_East_Threshold',7.3,8.6,.1,1.55,9.912,9.795);
  // Capture exact floor triangles, not the bounding box around octagonal towers.
  exterior.updateMatrixWorld(true);
  const inverse=exterior.matrixWorld.clone().invert(),surfaces=[],obstacles=[];
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  exterior.traverse(o=>{
    if(!o.isMesh)return;
    const floor=/Conservatory_Plinth|AVIARY_Left_Floor|Tower_Floor|Bridge_Tread|WestPassage_Assembly|ACCESS_.*(Ramp|Threshold)/.test(o.name);
    const wall=/(Conservatory|AVIARY_Left|Tower|WestPassage).*(Glass|Pier|ArchWall|Back|Assembly|Frame)/.test(o.name);
    if(!floor&&!wall)return;
    const mesh=new THREE.Mesh(o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)),material);
    mesh.updateMatrixWorld(true);if(floor)surfaces.push(mesh);if(wall)obstacles.push(mesh);
  });
  const ray=new THREE.Raycaster();
  return {
    surfaces,
    blocked(from,to,radius){
      const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);if(length<1e-7)return false;
      for(const offset of [0,-.7,-1.3]){
        ray.set(new THREE.Vector3((from.x-HOUSE_X)/WORLD_SCALE,(from.y+offset)/WORLD_SCALE,(from.z-HOUSE_Z)/WORLD_SCALE),new THREE.Vector3(dx/length,0,dz/length));
        ray.far=(length+radius)/WORLD_SCALE;
        if(ray.intersectObjects(obstacles,false).some(h=>Math.abs(h.face.normal.y)<.7))return true;
      }
      return false;
    },
    heightAt(x,z,feet){
      ray.set(new THREE.Vector3((x-HOUSE_X)/WORLD_SCALE,(feet+.55)/WORLD_SCALE,(z-HOUSE_Z)/WORLD_SCALE),new THREE.Vector3(0,-1,0));
      ray.far=1.5/WORLD_SCALE;
      const hit=ray.intersectObjects(surfaces,false).find(h=>Math.abs(h.face.normal.y)>.65);
      return hit?hit.point.y*WORLD_SCALE:null;
    },
  };
}
