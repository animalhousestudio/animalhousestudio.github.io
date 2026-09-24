import * as THREE from 'three';
import { BASE_FLOOR_Y } from './layout.mjs';
import { STAIR_OPENING_RADIUS } from './stairLayout.mjs';

// Fill the old 4.2 m square opening without altering the source asset.
// Every insert meets the existing slab at its top and bottom surfaces.
export function fitStairOpenings(exterior) {
  const floors=[['M01_Reuse_INT_Slab_Living',1.26,BASE_FLOOR_Y[1]],['M01_Reuse_INT_Slab_Kitchen',9.685,BASE_FLOOR_Y[2]],['M01_UpperFloor_Slab',16.92,17.2],['M01_UpperFloor_Ceiling',22.12,22.32]];
  const wood=new THREE.MeshStandardMaterial({color:0x75604a,roughness:.85});
  const g=new THREE.Group();g.name='StairwellFloorInfill';
  const outer=2.11,inner=STAIR_OPENING_RADIUS;
  for(const [name,bottom,top] of floors) {
    const slab=exterior.getObjectByName(name);if(!slab)continue;
    if(name.includes('Slab'))slab.material=wood;
    const material=slab.material;
    for(const [w,d,x,z] of [[outer-inner,outer*2,-(outer+inner)/2,0],[outer-inner,outer*2,(outer+inner)/2,0],[inner*2,outer-inner,0,-(outer+inner)/2],[inner*2,outer-inner,0,(outer+inner)/2]]) {
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,top-bottom,d),material);
      mesh.name=`Infill_${name}`;mesh.position.set(x,(top+bottom)/2,z);mesh.receiveShadow=true;g.add(mesh);
    }
  }
  exterior.add(g);return g;
}
