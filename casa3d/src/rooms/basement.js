import * as THREE from 'three';
import { roundedBox, createHoledCeiling } from './roomShell.js';
export function createBasement(){
  const g = new THREE.Group(); g.name='Basement'; g.userData.roomName='Cantina';
  const y = -5.5;
  const width = 18, depth = 18, wallHeight = 6.55;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(width,0.2,depth), new THREE.MeshStandardMaterial({color:0x382b48, roughness:0.9})); floor.position.set(0,y,0); floor.userData.collidable=true; g.add(floor);

  // walls - softened corners (RoundedBoxGeometry keeps the same bounding
  // box as a plain box, so collision is unaffected by the rounder look)
  const wallMat = new THREE.MeshStandardMaterial({color:0x2b2940, roughness:0.92});
  const left = new THREE.Mesh(roundedBox(0.2,wallHeight,depth), wallMat); left.position.set(-width/2 - 0.1,y+wallHeight/2,0); left.userData.collidable=true; g.add(left);
  const right = left.clone(); right.position.set(width/2 + 0.1,y+wallHeight/2,0); g.add(right);
  const back = new THREE.Mesh(roundedBox(width,wallHeight,0.2), wallMat); back.position.set(0,y+wallHeight/2,-depth/2 - 0.1); back.userData.collidable=true; g.add(back);
  // ceiling: fully closed except a hole around the central stairwell shaft,
  // so the room reads as enclosed rather than open to the stars above.
  const ceiling = createHoledCeiling(width, depth, 2.0, new THREE.MeshStandardMaterial({color:0x241d33, roughness:0.95}));
  ceiling.position.set(0, y+wallHeight, 0); g.add(ceiling);
  g.userData.shells = [left, right, back, ceiling];

  // arcade cabinet box
  const arcade = new THREE.Mesh(new THREE.BoxGeometry(1.25,2.1,0.8), new THREE.MeshStandardMaterial({color:0xefaa40, metalness:0.15})); arcade.position.set(-4.4,y+1.05,4.5); arcade.userData.collidable=true; g.add(arcade);
  const arcadeTop = new THREE.Mesh(new THREE.BoxGeometry(1.35,0.45,0.68), new THREE.MeshStandardMaterial({color:0xd15193, emissive:0x5f164d, emissiveIntensity:0.35})); arcadeTop.position.set(-4.4,y+1.82,4.58); arcadeTop.rotation.x=-0.35; arcadeTop.userData.collidable=false; g.add(arcadeTop);

  // shelves
  const shelfMat = new THREE.MeshStandardMaterial({color:0x5b3f2f});
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.5,1.4,0.7), shelfMat); shelf.position.set(5.5,y+1.2,4.8); shelf.userData.collidable=true; g.add(shelf);

  // old TV set with a dark screen
  const tv = new THREE.Mesh(new THREE.BoxGeometry(1.5,1.05,0.6), new THREE.MeshStandardMaterial({color:0x352a42})); tv.position.set(5.3,y+1.5,-4.6); tv.userData.collidable=true; g.add(tv);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.18,0.72,0.02), new THREE.MeshStandardMaterial({color:0x111111, emissive:0x2a8fc5, emissiveIntensity:0.65})); screen.position.set(5.3,y+1.5,-4.28); screen.userData.collidable=false; g.add(screen);

  // stacked storage crates
  const crateMat = new THREE.MeshStandardMaterial({color:0x8b6f47});
  for (let i=0;i<3;i++){ const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.9,0.9), crateMat); crate.position.set(-5.8, y+0.45+i*0.92, -4.7); crate.userData.collidable = i===0; g.add(crate); }

  // arcade cabinet screen glow
  const arcadeScreen = new THREE.Mesh(new THREE.BoxGeometry(0.75,0.6,0.05), new THREE.MeshStandardMaterial({color:0x111111, emissive:0x76e4ff, emissiveIntensity:0.65})); arcadeScreen.position.set(-4.4,y+1.38,4.91); arcadeScreen.userData.collidable=false; g.add(arcadeScreen);

  return g;
}
