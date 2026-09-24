import * as THREE from 'three';
import { createInvisibleBoundaryColliders } from './roomShell.js';

export function createKitchen() {
  const room = new THREE.Group();
  room.name = 'Kitchen';
  room.userData.roomName = 'Cucina';
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ visible: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 8.4;
  floor.userData.collidable = true;
  room.add(floor);
  const boundaries = createInvisibleBoundaryColliders(18, 18, 6.05, 8.4);
  room.add(boundaries);
  room.userData.shells = [boundaries];
  return room;
}