import * as THREE from 'three';
import { createInvisibleBoundaryColliders } from './roomShell.js';

export function createKitchen(){
  const g = new THREE.Group(); g.name='Kitchen'; g.userData.roomName='Cucina';
  const y = 8.4;
  const width = 18, depth = 18, wallHeight = 6.05;
  const floorCollider = new THREE.Mesh(new THREE.PlaneGeometry(width,depth), new THREE.MeshBasicMaterial({visible:false})); floorCollider.rotation.x = -Math.PI / 2; floorCollider.position.set(0,y,0); floorCollider.userData.collidable=true; g.add(floorCollider);

  const boundaries = createInvisibleBoundaryColliders(width, depth, wallHeight, y);
  g.add(boundaries);
  g.userData.shells = [boundaries];

  // kitchen furniture
  const fridgeMat = new THREE.MeshStandardMaterial({color:0xe9e9db, metalness:0.25, roughness:0.35});
  const fridge = new THREE.Mesh(new THREE.BoxGeometry(1.5,2.4,1.0), fridgeMat); fridge.position.set(6.2,y+1.2,-4.8); fridge.userData.collidable=true; g.add(fridge);
  const fridgeDoor = new THREE.Mesh(new THREE.BoxGeometry(1.32,1.05,0.04), new THREE.MeshStandardMaterial({color:0xb6dfdd, emissive:0x1c5d70, emissiveIntensity:0.15})); fridgeDoor.position.set(6.2,y+1.55,-4.28); fridgeDoor.userData.collidable=false; g.add(fridgeDoor);
  const fridgeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.65,8), new THREE.MeshStandardMaterial({color:0x394b65, metalness:0.8})); fridgeHandle.position.set(6.7,y+1.55,-4.22); fridgeHandle.userData.collidable=false; g.add(fridgeHandle);

  // table
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.65,1.45,0.16,6), new THREE.MeshStandardMaterial({color:0xb46b78, roughness:0.6})); table.position.set(0,y+0.9,2.8); table.userData.collidable=true; g.add(table);
  const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.3,0.9,12), new THREE.MeshStandardMaterial({color:0x5b3956})); tableLeg.position.set(0,y+0.45,2.8); tableLeg.userData.collidable=false; g.add(tableLeg);

  // chairs
  const chairMat = new THREE.MeshStandardMaterial({color:0x6752a2, roughness:0.6});
  for (const [x, z] of [[-2.2,2.8], [2.2,2.8], [0,5]]) {
    const chair = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.55,0.62,8), chairMat);
    chair.position.set(x,y+0.31,z); chair.userData.collidable=true; g.add(chair);
    const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.75,0.13), chairMat);
    chairBack.position.set(x,y+0.72,z+0.35); chairBack.userData.collidable=false; g.add(chairBack);
  }

  // stove/oven with a couple of burner discs on top
  const stoveMat = new THREE.MeshStandardMaterial({color:0x2b2b2b, metalness:0.4, roughness:0.5});
  const stove = new THREE.Mesh(new THREE.BoxGeometry(1.4,1.05,0.9), stoveMat); stove.position.set(-6.1,y+0.53,-4.8); stove.userData.collidable=true; g.add(stove);
  const burnerMat = new THREE.MeshStandardMaterial({color:0x111111});
  for (const bx of [-6.45,-5.75]) { const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.03,16), burnerMat); burner.position.set(bx,y+1.06,-4.8); burner.userData.collidable=false; g.add(burner); }

  // countertop / cabinet next to fridge
  const cabinetMat = new THREE.MeshStandardMaterial({color:0xd9c9a8});
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(3.6,1.0,0.85), cabinetMat); cabinet.position.set(1.7,y+0.5,-5.0); cabinet.userData.collidable=true; g.add(cabinet);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.12,1.0), new THREE.MeshStandardMaterial({color:0x49374f, roughness:0.35})); counter.position.set(1.7,y+1.06,-5.0); counter.userData.collidable=false; g.add(counter);

  // hanging ceiling lamp above the table
  const lampMat = new THREE.MeshStandardMaterial({color:0xffe9a8, emissive:0xffcf6b, emissiveIntensity:0.5});
  const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.48,0.55,12), lampMat); lamp.position.set(0,y+2.6,2.8); lamp.userData.collidable=false; g.add(lamp);

  return g;
}
