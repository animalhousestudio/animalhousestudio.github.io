import * as THREE from 'three';
import { createInvisibleBoundaryColliders } from './roomShell.js';

export function createBasement() {
  const room = new THREE.Group();
  room.name = 'Basement';
  room.userData.roomName = 'Cantina';
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ visible: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -6.6;
  floor.userData.collidable = true;
  room.add(floor);
  const boundaries = createInvisibleBoundaryColliders(18, 18, 6.55, -6.6);
  room.add(boundaries);
  room.userData.shells = [boundaries];
  return room;
}