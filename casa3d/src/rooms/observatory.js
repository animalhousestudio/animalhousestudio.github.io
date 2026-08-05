import * as THREE from 'three';
export function createObservatory(){
  const g = new THREE.Group(); g.name='Observatory'; g.userData.roomName='Osservatorio';
  const y = 17.04;
  const width = 12, depth = 14, wallHeight = 5.45;
  const floorCollider = new THREE.Mesh(new THREE.PlaneGeometry(width,depth), new THREE.MeshBasicMaterial({visible:false})); floorCollider.rotation.x = -Math.PI / 2; floorCollider.position.set(0,y,0); floorCollider.userData.collidable=true; g.add(floorCollider);

  // Blender now owns the observatory shell, roof ring, and dome. Keep only
  // invisible JS wall colliders so navigation remains aligned to its bounds.
  const colliderMaterial = new THREE.MeshBasicMaterial({ visible:false });
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.2,wallHeight,depth), colliderMaterial); left.position.set(-width/2 - 0.1,y+wallHeight/2,0); left.userData.collidable=true; g.add(left);
  const right = left.clone(); right.position.set(width/2 + 0.1,y+wallHeight/2,0); g.add(right);
  const back = new THREE.Mesh(new THREE.BoxGeometry(width,wallHeight,0.2), colliderMaterial); back.position.set(0,y+wallHeight/2,-depth/2 - 0.1); back.userData.collidable=true; g.add(back);
  const front = back.clone(); front.position.set(0,y+wallHeight/2,depth/2 + 0.1); g.add(front);
  g.userData.shells = [left, right, back, front];

  // telescope
  const telescopeMat = new THREE.MeshStandardMaterial({color:0x1a1a1a, metalness:0.6, roughness:0.3});
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,3.4,16), telescopeMat);
  tube.rotation.z = Math.PI/2.2; tube.position.set(1.4,y+1.8,-1.2); tube.userData.collidable=true; g.add(tube);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.16,16), new THREE.MeshStandardMaterial({color:0x7ae7ff, emissive:0x136a93, emissiveIntensity:0.8, metalness:0.7}));
  lens.rotation.z=Math.PI/2.2; lens.position.set(2.9,y+2.48,-1.2); lens.userData.collidable=false; g.add(lens);
  for (const [x,z] of [[1.1,-1.7],[1.8,-1.7],[1.45,-0.55]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,1.8,8), telescopeMat); leg.position.set(x,y+0.9,z); leg.rotation.z=(x-1.45)*0.25; leg.userData.collidable=false; g.add(leg); }

  // desk + chair
  const deskMat = new THREE.MeshStandardMaterial({color:0x5a4a3a});
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.75,1.0), deskMat); desk.position.set(-3.8,y+0.6,3.7); desk.userData.collidable=true; g.add(desk);
  const chair = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.58,0.75,8), new THREE.MeshStandardMaterial({color:0x8c5a9e})); chair.position.set(-3.8,y+0.38,5.0); chair.userData.collidable=true; g.add(chair);

  // Constellation panels evoke the illustrated planetarium interior.
  const panelMat = new THREE.MeshStandardMaterial({color:0x192441, emissive:0x263f83, emissiveIntensity:0.35});
  for (const x of [-3.8, -1.5, 1.5, 3.8]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.45,1.05,0.05), panelMat);
    panel.position.set(x,y+1.9,-depth/2+0.13); panel.userData.collidable=false; g.add(panel);
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.07,8,8), new THREE.MeshStandardMaterial({color:0xe6d9ff, emissive:0xa389ff, emissiveIntensity:1}));
    star.position.set(x,y+2.0,-depth/2+0.08); star.userData.collidable=false; g.add(star);
  }

  return g;
}
