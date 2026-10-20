import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';
import { WORLD_SCALE } from './layout.mjs';
import { terrainHeight } from './terrainDetail.mjs';

// Minimal ground pickup; the hand keeps using the original authored LAB mug.
export function addLandingMug(garden) {
  const root=new Group();root.name='LandingMug';root.scale.setScalar(1/WORLD_SCALE);
  root.position.set(-1/WORLD_SCALE,terrainHeight(-1/WORLD_SCALE,212/WORLD_SCALE),212/WORLD_SCALE);
  root.userData.streamingBoundary=true;root.userData.collisionDisabled=true;
  root.userData.ready=true;root.userData.roomName='Tazza';
  const material=new MeshStandardMaterial({color:0x171d20,roughness:.45,metalness:.15,side:2});
  const body=new Mesh(new CylinderGeometry(.18,.15,.31,20,1,true),material);body.position.y=.17;root.add(body);
  const base=new Mesh(new CylinderGeometry(.15,.15,.025,20),material);base.position.y=.025;root.add(base);
  const handle=new Mesh(new TorusGeometry(.105,.027,8,16),material);handle.position.set(.205,.18,0);root.add(handle);
  garden.add(root);garden.userData.mug=root;return root;
}
