import * as THREE from 'three';

/** Front-facing emergency button; geometry lives in the same world as its wall. */
export function createRedButton(parent,x,y,z) {
  const group=new THREE.Group();group.position.set(x,y,z);group.userData.interactable=true;
  group.userData.collisionDisabled=true;parent.add(group);
  function box(size,position,color){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.45}));
    mesh.position.set(...position);group.add(mesh);return mesh;
  }
  box([.29,.29,.065],[0,0,0],0xb7b2a1);
  box([.30,.30,.025],[0,0,.045],0xf3c700);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.119,24,12,0,Math.PI*2,0,Math.PI/2),
    new THREE.MeshStandardMaterial({color:0xed2029,roughness:.22,metalness:.14}));
  cap.rotation.x=Math.PI/2;cap.position.z=.055;group.add(cap);
  for(const sx of [-1,1])for(const sy of [-1,1]){
    const screw=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.006,8),new THREE.MeshStandardMaterial({color:0x989993,metalness:.8,roughness:.3}));
    screw.rotation.x=Math.PI/2;screw.position.set(sx*.124,sy*.123,.061);group.add(screw);
  }
  return group;
}
